/**
 * quant-ensemble.strategy.ts
 *
 * Multi-model ensemble strategy (quant-style)
 * - Designed for SPOT trading (adaptable to futures)
 * - Run many small signal models in parallel (mean-reversion, momentum, pattern)
 * - Aggregate model scores -> portfolio score per symbol
 * - Position sizing by volatility / risk-parity style
 *
 * IMPORTANT:
 * - This is an educational / engineering template inspired by quantitative practice.
 * - Jim Simons / Medallion use proprietary approaches we cannot reproduce; this is a
 *   practical, extensible starting point for building many small edges.
 */

import { EMA } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { BinanceService } from 'src/modules/binance/binance.service';
import { Candle, Order } from 'binance-api-node';
import Decimal from 'decimal.js';
import { randomUUID } from 'crypto';
import {
  loadPositions,
  savePositions,
  logSellSuccess,
  SellSuccessLog,
  logTotalProfit,
  Position,
} from '../helpers/savePosition';
import { formatDate } from '../helpers/formatDate';
import { getActualBoughtQtyAndFee } from '../helpers/crypto';
import { IStrategy, STRATEGIES } from '.';

type TimeframeData = {
  closes: number[];
  highs: number[];
  lows: number[];
  lastCandles: Candle[];
};

type ModelScore = {
  name: string;
  score: number; // -1..1 where positive = buy pressure, negative = sell pressure
  weight?: number;
};

export class QuantEnsembleStrategy implements IStrategy {
  private logger = new Logger('QuantEnsembleStrategy');

  // portfolio & risk
  private positions: Position[] = [];
  private cumulativeProfit = 0;
  private maxNotionalPerSymbolUsd = 1000; // cap per symbol exposure
  private totalPortfolioUsd = 20000; // used for sizing (should be dynamic)
  private maxPortfolioRiskPct = 10; // max total exposure in % of portfolio

  // ensemble config
  private modelConfigs = {
    meanReversionWindows: [20, 50, 100], // windows for zscore models
    momentumWindows: [5, 10, 20], // short-term momentum
    emaPeriods: [9, 21, 50], // simple ema signals used in patterns
  };

  private entryThreshold = 0.6; // aggregated score threshold to enter
  private exitThreshold = 0.2; // aggregated score threshold to exit (toward zero)
  private cooldownMs = 20 * 60 * 1000; // 20 minutes between trades per symbol
  private lastTradeAt: Record<string, number> = {};

  // trade execution
  private tradePerSignalUsd = 200; // base nominal per signal (will scale)
  private minUsdPerTrade = 10;
  private estimatedFeePct = 0.001; // 0.1% per leg

  // data
  private timeframe: '15m' | '1h' = '15m';
  private timeframeData: Record<string, TimeframeData> = {};

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
  ) {
    this.positions = loadPositions(STRATEGIES.QUANT_ENSEMBLE) || [];
  }

  async startAll() {
    await this.startForSymbol(this.symbol, this.timeframe);
  }

  private async startForSymbol(symbol: string, timeframe: '15m' | '1h') {
    this.logger.log(`Starting QuantEnsemble for ${symbol} [${timeframe}]`);

    const historical = await this.binanceService.getHistoricalCandles(
      symbol,
      timeframe,
      1000,
    );
    this.timeframeData[symbol] = {
      closes: historical.map((c) => +c.close),
      highs: historical.map((c) => +c.high),
      lows: historical.map((c) => +c.low),
      lastCandles: historical.slice(-3) as unknown as Candle[],
    };

    this.binanceService.subscribeCandles(symbol, timeframe, (c) => {
      const d = this.timeframeData[symbol];
      d.lastCandles.push(c);
      if (d.lastCandles.length > 3) d.lastCandles.shift();

      d.closes.push(+c.close);
      d.highs.push(+c.high);
      d.lows.push(+c.low);
      if (d.closes.length > 1000) {
        d.closes.shift();
        d.highs.shift();
        d.lows.shift();
      }

      // main pipeline
      this.onNewBar(symbol);
    });
  }

  private async onNewBar(symbol: string) {
    try {
      const data = this.timeframeData[symbol];
      if (!data || data.closes.length < 50) return;

      const price = await this.binanceService.getPrice(symbol);
      if (!price) return;

      // 1) compute model scores
      const modelScores = this.computeModelScores(symbol, data);

      // 2) aggregate
      const aggregated = this.aggregateScores(modelScores);

      // 3) risk checks & cooldown
      const now = Date.now();
      const last = this.lastTradeAt[symbol] || 0;
      const cooldownOk = now - last >= this.cooldownMs;

      // 4) current exposure on this symbol (net)
      const exposureUsd = this.currentExposureUsd(symbol);
      const portfolioExposurePct =
        this.totalPortfolioUsd === 0
          ? 0
          : (this.totalGrossExposureUsd() / this.totalPortfolioUsd) * 100;

      console.log('===== QuantEnsemble', symbol, formatDate(new Date()));
      console.log(
        'Price:',
        price.toFixed(6),
        'AggScore:',
        aggregated.toFixed(3),
        'ExposureUSD:',
        exposureUsd.toFixed(2),
        'PortfolioExp%:',
        portfolioExposurePct.toFixed(2),
      );

      // ENTRY/EXIT rules:
      // If aggregated score > entryThreshold => net long pressure -> buy
      // If aggregated score < -entryThreshold => net short pressure -> sell (in spot we can only sell what we hold)
      // Exit when aggregated moves toward zero (abs < exitThreshold) or reverse strongly
      if (Math.abs(aggregated) < this.exitThreshold) {
        // try to exit existing position on symbol
        if (this.hasPosition(symbol)) {
          await this.closeSymbolPositions(price);
          this.lastTradeAt[symbol] = Date.now();
        }
        return;
      }

      if (!cooldownOk) return;

      if (aggregated >= this.entryThreshold) {
        // BUY signal
        if (portfolioExposurePct >= this.maxPortfolioRiskPct) {
          console.log('Skip buy: portfolio exposure limit reached');
        } else {
          await this.enterLong(symbol, price, aggregated);
          this.lastTradeAt[symbol] = Date.now();
        }
      } else if (aggregated <= -this.entryThreshold) {
        // Strong negative score -> reduce longs on symbol (in spot we can only sell existing)
        if (this.hasPosition(symbol)) {
          await this.closeSymbolPositions(price);
          this.lastTradeAt[symbol] = Date.now();
        }
      }
    } catch (err) {
      console.error('onNewBar error', err);
    } finally {
      logTotalProfit();
    }
  }

  // ------------------ Models ------------------

  private computeModelScores(
    symbol: string,
    data: TimeframeData,
  ): ModelScore[] {
    const scores: ModelScore[] = [];

    // 1) Mean reversion z-score models (multi windows)
    for (const w of this.modelConfigs.meanReversionWindows) {
      if (data.closes.length < w + 2) continue;
      const slice = data.closes.slice(-w);
      const mean = this.mean(slice);
      const std = this.std(slice, mean) || 1e-8;
      const last = data.closes[data.closes.length - 1];
      const z = (last - mean) / std; // positive => above mean (overpriced)
      // For spot: positive z -> small sell pressure, negative z -> buy pressure
      scores.push({ name: `z-${w}`, score: -z, weight: 1 }); // invert so positive = buy
    }

    // 2) Momentum models (short windows) — normalized returns
    for (const w of this.modelConfigs.momentumWindows) {
      if (data.closes.length < w + 1) continue;
      const ret =
        data.closes[data.closes.length - 1] /
          data.closes[data.closes.length - 1 - w] -
        1;
      // raw momentum: positive -> buy
      scores.push({ name: `mom-${w}`, score: ret * 10, weight: 0.5 }); // scale to comparable range
    }

    // 3) EMA crossover ensemble (fast vs slow small windows)
    for (let i = 0; i < this.modelConfigs.emaPeriods.length - 1; i++) {
      const fast = this.modelConfigs.emaPeriods[i];
      const slow = this.modelConfigs.emaPeriods[i + 1];
      if (data.closes.length < slow + 2) continue;
      const emaFastArr = EMA.calculate({ period: fast, values: data.closes });
      const emaSlowArr = EMA.calculate({ period: slow, values: data.closes });
      if (emaFastArr.length < 2 || emaSlowArr.length < 2) continue;
      const lastDiff =
        emaFastArr[emaFastArr.length - 1] - emaSlowArr[emaSlowArr.length - 1];
      const prevDiff =
        emaFastArr[emaFastArr.length - 2] - emaSlowArr[emaSlowArr.length - 2];
      const cross = Math.sign(lastDiff) - Math.sign(prevDiff); // 2/-2 for a cross, 0 otherwise
      const score = Math.tanh(
        lastDiff / (Math.abs(emaSlowArr[emaSlowArr.length - 1]) * 0.01),
      ); // normalized
      scores.push({ name: `ema-x-${fast}-${slow}`, score, weight: 0.7 });
    }

    // 4) Volatility breakout detector (simple)
    {
      const w = 20;
      if (data.closes.length >= w + 1) {
        const slice = data.closes.slice(-w);
        const std = this.std(slice);
        const last = data.closes[data.closes.length - 1];
        const prev = data.closes[data.closes.length - 2];
        // if price jumps > 2*std in one bar -> momentum continuation => align with sign of move
        const jumpZ = (last - prev) / (std || 1e-8);
        scores.push({ name: 'vol-jump', score: Math.tanh(jumpZ), weight: 0.4 });
      }
    }

    // 5) Pattern detector placeholder (user can plug ML model here)
    // e.g., we compute similarity with a short “reversal” template (simple)
    {
      const w = 5;
      if (data.closes.length >= w + 1) {
        const slice = data.closes.slice(-w - 1);
        // compute simple slope change: if slope turned up after downtrend -> buy
        const slopePrev = slice
          .slice(0, Math.floor(w / 2))
          .reduce((a, b, i, arr) => a + (b - arr[0]), 0);
        const slopeLast = slice
          .slice(Math.floor(w / 2))
          .reduce((a, b, i, arr) => a + (b - slice[Math.floor(w / 2)]), 0);
        const pattScore = Math.tanh(
          (slopeLast - slopePrev) / (this.std(slice) || 1e-8),
        );
        scores.push({
          name: 'pattern-short',
          score: pattScore * 0.6,
          weight: 0.6,
        });
      }
    }

    return scores;
  }

  // ------------------ Aggregation & sizing ------------------

  private aggregateScores(scores: ModelScore[]) {
    if (scores.length === 0) return 0;
    // normalize each score to [-1,1] modestly (scores may already be scaled)
    const weighted = scores.map((s) => {
      const w = s.weight ?? 1;
      let val = s.score;
      // squash extreme values
      val = Math.tanh(val);
      return { v: val * w, w };
    });
    const sumW = weighted.reduce((a, b) => a + b.w, 0) || 1;
    const agg = weighted.reduce((a, b) => a + b.v, 0) / sumW;
    // clamp
    return Math.max(-1, Math.min(1, agg));
  }

  private volatilitySizing(symbol: string) {
    // return a target USD allocation based on symbol volatility (lower vol -> bigger size)
    const data = this.timeframeData[symbol];
    const w = 50;
    if (!data || data.closes.length < w) return this.tradePerSignalUsd;
    const slice = data.closes.slice(-w);
    const volPct = this.stdPct(slice);
    // desired risk per trade = fixed fraction of portfolio
    const targetRiskUsd = this.totalPortfolioUsd * 0.005; // e.g. 0.5% per trade
    // approximate position size so that 1 ATR move equals targetRiskUsd
    const atrApprox = this.std(slice) * Math.sqrt(1); // proxy, not true ATR
    const price = data.closes[data.closes.length - 1];
    if (atrApprox <= 0) return this.tradePerSignalUsd;
    const qty = targetRiskUsd / (atrApprox * price); // rough qty
    const usd = Math.max(
      this.minUsdPerTrade,
      Math.min(this.maxNotionalPerSymbolUsd, qty * price),
    );
    return usd;
  }

  private currentExposureUsd() {
    return this.positions.reduce((s, p) => s + p.qty * p.buyPrice, 0);
  }

  private totalGrossExposureUsd() {
    return this.positions.reduce((s, p) => s + p.qty * p.buyPrice, 0);
  }

  // ------------------ Execution / entry / exit ------------------

  private async enterLong(symbol: string, price: number, score: number) {
    try {
      const usdAlloc = this.volatilitySizing(symbol);
      const usd = Math.min(usdAlloc, this.maxNotionalPerSymbolUsd);
      if (usd < this.minUsdPerTrade) {
        console.log('usdAlloc too small, skip');
        return;
      }
      const qty = this.usdToQty(price, usd);
      if (qty <= 0) return;

      console.log(
        `[${symbol}] ENTER LONG qty=${qty} usd=${(qty * price).toFixed(2)} score=${score.toFixed(3)}`,
      );
      const order = await this.binanceService.placeMarketOrder(
        symbol,
        'BUY',
        qty,
      );
      const { totalQty } = getActualBoughtQtyAndFee(order);
      const usdSpent = (await this.getFeeFromOrder(order)) + +totalQty * price; // crudely include fees
      const pos: Position = {
        id: randomUUID(),
        strategy: STRATEGIES.QUANT_ENSEMBLE,
        buyPrice: price,
        qty,
        usdSpent: await this.getFeeFromOrder(order),
        totalQtyActual: +totalQty,
        buyTime: Date.now(),
      };
      this.positions.push(pos);
      savePositions(this.positions);
    } catch (err) {
      console.error('enterLong error', err);
    }
  }

  private hasPosition(symbol: string) {
    return this.positions.some((p) => p.symbol === symbol);
  }

  private async closeSymbolPositions(price: number) {
    try {
      const toClose = this.positions;
      if (toClose.length === 0) return;
      // For simplicity, sell all longs on symbol

      const usdSpent = toClose.reduce((s, p) => s + p.usdSpent, 0);

      const totalQty = toClose.reduce(
        (acc, p) => acc.plus(new Decimal(p.qty)),
        new Decimal(0),
      );

      // Giá trị hiện tại nếu bán ở giá thị trường
      const currentValue = toClose.reduce((s, p) => s + p.qty * price, 0);
      const unrealizedProfit = currentValue - usdSpent;

      // 🔒 Chỉ đóng khi có lãi ngưỡng tối thiểu, 2%
      const profitPct = unrealizedProfit / usdSpent;
      if (profitPct < 0.02) {
        // < 2% thì không bán
        console.log(
          `[${this.symbol}] Skip close — unrealized profit ${(
            profitPct * 100
          ).toFixed(2)}% < 2%`,
        );
        return;
      }

      const qtyNum = this.adjustToStepSize(totalQty.toNumber());
      if (qtyNum <= 0) return;
      const order = await this.binanceService.placeMarketOrder(
        this.symbol,
        'SELL',
        qtyNum,
      );
      const revenue = await this.binanceService.getRevenueFromSellOrder(
        this.symbol,
        order,
      );
      const profit = revenue - usdSpent;
      this.cumulativeProfit += profit;
      // remove positions
      const ids = new Set(toClose.map((p) => p.id));
      this.positions = this.positions.filter((p) => !ids.has(p.id));
      savePositions(this.positions);

      const sellLog: SellSuccessLog = {
        symbol: this.symbol,
        strategy: STRATEGIES.QUANT_ENSEMBLE,
        buyPrices: toClose.map((p) => p.buyPrice),
        sellPrice: price,
        totalAmountBuyActual: toClose.reduce((s, p) => s + p.qty, 0),
        totalAmountBuyUsdtSpent: usdSpent,
        totalProfit: profit,
        totalRevenueUsdt: revenue,
      };
      logSellSuccess(sellLog);

      console.log(
        `[${this.symbol}] CLOSED qty=${qtyNum} profit=${profit.toFixed(4)}`,
      );
    } catch (err) {
      console.error('closeSymbolPositions error', err);
    }
  }

  // ------------------ Helpers ------------------

  private mean(arr: number[]) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private std(arr: number[], meanVal?: number) {
    if (!arr.length) return 0;
    const m = meanVal ?? this.mean(arr);
    const v =
      arr.reduce((s, x) => s + (x - m) * (x - m), 0) / (arr.length - 1 || 1);
    return Math.sqrt(v);
  }

  private stdPct(arr: number[]) {
    // returns std of percent returns
    const rets: number[] = [];
    for (let i = 1; i < arr.length; i++) rets.push(arr[i] / arr[i - 1] - 1);
    return this.std(rets) || 1e-8;
  }

  private usdToQty(price: number, usd: number) {
    return this.adjustToStepSize(usd / price);
  }

  private adjustToStepSize(qty: number, stepSize = 0.000001) {
    if (!isFinite(qty) || qty <= 0) return 0;
    return parseFloat((Math.floor(qty / stepSize) * stepSize).toFixed(6));
  }

  private async getFeeFromOrder(order: Order) {
    let totalFeeUSDT = 0;
    if (!order?.fills) return 0;
    for (const fill of order.fills) {
      const commission = parseFloat(fill.commission || '0');
      const asset = fill.commissionAsset;
      if (asset === 'USDT') totalFeeUSDT += commission;
      else {
        const assetPrice = await this.binanceService.getPrice(`${asset}USDT`);
        totalFeeUSDT += commission * (assetPrice || 0);
      }
    }
    return totalFeeUSDT;
  }

  stop() {
    this.logger.log('Stopped QuantEnsembleStrategy');
  }
}
