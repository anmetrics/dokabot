import { RSI, ATR, EMA } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { BinanceService } from 'src/modules/binance/binance.service';
import { Candle, CandleChartInterval_LT } from 'binance-api-node';
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { Position } from 'generated/prisma';
import {
  getSettingKeyBySymbolMini,
  LIST_SYMBOL,
  SETTING_KEY,
} from 'src/modules/settings/settings.enum';
import { IStrategy } from '../../strategy.interface';
import { adjustToStepSize, getActualBought } from '../../helpers/crypto';
import { RegimeRiskManager } from '../helpers/regime-hmm';

type TimeframeData = {
  closes: number[];
  highs: number[];
  lows: number[];
  lastCandles: Candle[];
};

export const MINI_RSI_SUFFIX = '_MINI';

export class MiniReversalDcaStrategy implements IStrategy {
  private logger = new Logger('MiniReversalDcaStrategy');
  private cumulativeProfit = 0;

  // === CONFIG ===
  private maxDcaTimes = 20; // fallback max dca
  private rsiPeriod = 8;
  private atrPeriod = 8;
  private rsiBuyThreshold = 18;

  private cooldownMs = 1 * 60 * 1000; // 1 phút
  private lastTradeTime = 0;

  private emaShortPeriod = 7;
  private emaShortThreshold3m = -0.0005;
  private emaShortThreshold5m = -0.002;

  private timeframeData: Record<string, TimeframeData> = {};

  // Regime manager
  private regimeManager = new RegimeRiskManager(3);

  // Backtest
  private isRunBacktest = false;
  private backtestPositions: Position[] = [];
  private sellSuccess: any = [];
  private backtestProfit = 0;

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
    private readonly timeframe: '1m' | '3m' | '5m' | '15m' | '30m',
    private readonly minProfitPct: number,
  ) {}

  async startAll() {
    await this.start(this.timeframe);
  }

  private async start(timeframe: '1m' | '3m' | '5m' | '15m' | '30m') {
    console.log(
      `Starting SUPERMINI RSI Reversal + DCA Strategy for ${this.symbol} [${timeframe}]R, BaseProfit:${this.minProfitPct}`,
    );

    if (this.isRunBacktest) {
      this.backtestCandles(this.timeframe);
      return;
    }

    const positions = await this.binanceService.getOpenPositions(
      this.symbol + MINI_RSI_SUFFIX,
    );
    console.log(this.symbol + MINI_RSI_SUFFIX, positions);

    const historicalCandles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      timeframe,
      500,
    );

    this.timeframeData[timeframe] = {
      closes: historicalCandles.map((c) => +c.close),
      highs: historicalCandles.map((c) => +c.high),
      lows: historicalCandles.map((c) => +c.low),
      lastCandles: historicalCandles.slice(-3) as unknown as Candle[],
    };

    // seed regime obs from historical
    this.seedRegimeFromHistory(timeframe);

    this.binanceService.subscribeCandles(this.symbol, timeframe, (candle) => {
      const data = this.timeframeData[timeframe];
      data.lastCandles.push(candle);
      if (data.lastCandles.length > 3) data.lastCandles.shift();

      data.closes.push(+candle.close);
      data.highs.push(+candle.high);
      data.lows.push(+candle.low);
      if (data.closes.length > 500) {
        data.closes.shift();
        data.highs.shift();
        data.lows.shift();
      }

      this.calcSignal(timeframe);
    });
  }

  public async backtestCandles(timeframe: CandleChartInterval_LT) {
    const historicalCandles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      timeframe,
      1500,
    );

    this.timeframeData[this.timeframe] = {
      closes: [],
      highs: [],
      lows: [],
      lastCandles: [],
    };
    this.regimeManager = new RegimeRiskManager(2);
    this.backtestPositions = [];
    this.backtestProfit = 0;
    this.lastTradeTime = 0;

    const data = this.timeframeData[this.timeframe];

    for (let i = 0; i < historicalCandles.length; i++) {
      const candle = historicalCandles[i];
      data.closes.push(+candle.close);
      data.highs.push(+candle.high);
      data.lows.push(+candle.low);
      data.lastCandles.push(candle as any);
      if (data.lastCandles.length > 3) data.lastCandles.shift();
      if (data.closes.length > 500) {
        data.closes.shift();
        data.highs.shift();
        data.lows.shift();
      }

      await this.calcSignal(this.timeframe);
    }

    console.log('positions:', this.backtestPositions);
    console.log('sell_success:', this.sellSuccess);

    console.log(
      `[BACKTEST] Done. Profit: ${this.backtestProfit.toFixed(2)} USD`,
    );
  }

  private seedRegimeFromHistory(timeframe: string) {
    const data = this.timeframeData[timeframe];
    if (!data) return;
    const closes = data.closes;
    const atr = ATR.calculate({
      high: data.highs,
      low: data.lows,
      close: data.closes,
      period: this.atrPeriod,
    });
    for (let i = 1; i < closes.length && i < atr.length; i++) {
      const ret = (closes[i] - closes[i - 1]) / closes[i - 1];
      const a = atr[i - 1] || atr[atr.length - 1] || 1;
      const obs = ret * a;
      this.regimeManager.pushObservation(obs);
    }
    // optional: log HMM params after seed
    const hmm = this.regimeManager.getHMMParams();
    console.log(
      `[seedRegime] HMM mu: ${JSON.stringify(hmm.mu)}, sigma: ${JSON.stringify(hmm.sigma)}`,
    );
  }

  private async calcSignal(timeframe: string) {
    try {
      const data = this.timeframeData[timeframe];
      if (!data || data.closes.length < this.rsiPeriod + 1) return;

      const rsi = RSI.calculate({
        period: this.rsiPeriod,
        values: data.closes,
      });
      const atr = ATR.calculate({
        high: data.highs,
        low: data.lows,
        close: data.closes,
        period: this.atrPeriod,
      });

      if (rsi.length < 1 || atr.length < 1) return;

      const lastRsi = rsi[rsi.length - 1];
      const lastAtr = atr[atr.length - 1];
      const price = data.closes[data.closes.length - 1];
      const now = Date.now();
      const cooldownOk =
        this.lastTradeTime === 0 || now - this.lastTradeTime >= this.cooldownMs;

      // update regime manager with a new observation
      const closes = data.closes;
      const len = closes.length;
      if (len >= 2) {
        const ret = (closes[len - 1] - closes[len - 2]) / closes[len - 2];
        const obs = ret * lastAtr;
        this.regimeManager.pushObservation(obs);
      }

      const openPositions = this.isRunBacktest
        ? this.backtestPositions
        : await this.binanceService.getOpenPositions(
            this.symbol + MINI_RSI_SUFFIX,
          );

      // query current regime policy (adaptive)
      const recentObsSample = this.regimeManager.getObsWindowTail(50);
      const policy = this.regimeManager.getPolicy(recentObsSample);

      // === BUY or DCA with ATR filter & dynamic size ===

      if (!this.isRunBacktest && !cooldownOk) {
        return;
      }

      if (lastRsi <= this.rsiBuyThreshold && policy.allowBuy) {
        const minBuyPrice = openPositions.length
          ? Math.min(...openPositions.map((p) => p.buyPrice))
          : price;
        const dcaTimes = openPositions.length - 1;
        const dcaIndex = dcaTimes + 1;

        const dcaPriceSetting = await this.binanceService.getSettingByKey(
          SETTING_KEY.DCA_WHEN_DROP_PERCENT_SUPERMINI,
        );
        const DCA_PRICE_DROP_PCT = Number(dcaPriceSetting || 0.02);
        const DCA_PERCENT = 1 - DCA_PRICE_DROP_PCT;

        const isDcaValid =
          dcaTimes < Math.min(this.maxDcaTimes, policy.maxDcaTimes) &&
          price < minBuyPrice - lastAtr &&
          price < minBuyPrice * DCA_PERCENT;

        const emaShort = EMA.calculate({
          period: this.emaShortPeriod,
          values: data.closes,
        });

        if (emaShort.length < 2) return; // cần ít nhất 2 giá trị EMA để tính slope

        const lastEmaShort = emaShort[emaShort.length - 1];
        const prevemaShort = emaShort[emaShort.length - 2];

        const ema7SlopePct = (lastEmaShort - prevemaShort) / prevemaShort;

        const emaShortTrendOk = ema7SlopePct >= this.getEmathreshold();

        console.log('emaShortTrendOk', emaShortTrendOk, ema7SlopePct);

        if (openPositions.length === 0 || isDcaValid) {
          const [settingMaxBuyPrice, enableBuy] = await Promise.all([
            this.binanceService.getSettingByKey(
              getSettingKeyBySymbolMini(this.symbol),
            ),
            this.binanceService.getSettingByKey(
              SETTING_KEY.ENABLE_BUY_SUPERMINI,
            ),
          ]);

          if (
            enableBuy === 'true' &&
            price < Number(settingMaxBuyPrice || 0) &&
            emaShortTrendOk
          ) {
            // buyPosition uses policy.sizeMultiplier to adjust usdToSpend
            await this.buyPosition(price, dcaIndex || 0, policy.sizeMultiplier);
            this.lastTradeTime = now;
          }
        }
      }

      // === SELL with dynamic minProfitPct (trailing by DCA index) ===
      if (openPositions.length > 0) {
        const sellablePositions = openPositions.filter((pos) => {
          const dynamicMinProfitPct =
            this.getDynamicMinProfitPct(pos?.dcaIndex || 0) *
            (policy.minProfitMultiplier || 1);
          return (
            !pos.isDualInvestment &&
            price >= pos.buyPrice * (1 + dynamicMinProfitPct)
          );
        });

        const enableSell = await this.binanceService.getSettingByKey(
          SETTING_KEY.ENABLE_SELL_SUPERMINI,
        );

        if (!sellablePositions.length || enableSell !== 'true') {
          return;
        }

        for (const pos of sellablePositions) {
          if (pos.sellPrice && pos.sellPrice > 0 && price < pos.sellPrice) {
            continue;
          }
          await this.sellPosition(pos, price, timeframe);
        }
      }
    } catch (e) {
      console.error(`[${timeframe}] Error in DCA RSI strategy:`, e);
    }
  }

  private getEmathreshold() {
    return this.timeframe === '3m'
      ? this.emaShortThreshold3m
      : this.emaShortThreshold5m;
  }

  private async buyPosition(
    price: number,
    dcaIndex: number,
    sizeMultiplier = 1,
  ) {
    const baseBuyUsd = await this.binanceService.getSettingByKey(
      SETTING_KEY.SUPER_MINI_BUY_AMOUNT,
    );
    const usdToSpend = Math.max(Number(baseBuyUsd || 0) * sizeMultiplier, 10);

    if (usdToSpend < 5) {
      return;
    }

    const [rootPositions] = await Promise.all([
      this.binanceService.getOpenPositions(this.symbol),
    ]);

    const rootMinBuyPrice = Math.min(
      ...(rootPositions?.map((p) => p.buyPrice) || [Infinity]),
    );

    if (rootPositions?.length && price > rootMinBuyPrice * 1.03) return;

    const qty = adjustToStepSize(usdToSpend / price, this.symbol);

    if (this.isRunBacktest) {
      this.backtestPositions.push({
        id: randomUUID(),
        buyPrice: price,
        qty,
        usdSpent: usdToSpend,
        totalQtyActual: usdToSpend,
        dcaIndex,
        strategy: this.symbol + MINI_RSI_SUFFIX,
        symbol: this.symbol,
        sellPrice: null,
        isDualInvestment: false,
        createdAt: new Date(),
        updatedAt: null,
      });
      return;
    }

    const balances = await this.binanceService.getAccount();
    const freeUsdt = Number(
      balances.balances.find((b) => b.asset === 'USDT')?.free || 0,
    );

    if (freeUsdt < usdToSpend) {
      console.log(
        `[DCA ${dcaIndex}] Not enough USDT (${freeUsdt.toFixed(2)}) to buy need ${usdToSpend.toFixed(2)} USD`,
      );
      return;
    }

    const order = await this.binanceService.placeMarketOrder(
      this.symbol,
      'BUY',
      qty,
    );

    const bnbPrice = await this.binanceService.getPrice(LIST_SYMBOL.BNBUSDT);
    const {
      totalQty: totalQtyActual,
      totalSpent,
      avgPrice,
    } = getActualBought(order, bnbPrice);

    await this.binanceService.savePosition({
      id: randomUUID(),
      buyPrice: avgPrice,
      qty,
      usdSpent: totalSpent,
      totalQtyActual,
      dcaIndex,
      strategy: this.symbol + MINI_RSI_SUFFIX,
      symbol: this.symbol,
    });
    console.log(
      `[DCA ${dcaIndex}] BUY ${qty} ${this.symbol} @ ${price} USD=${usdToSpend}`,
    );
  }

  private getDynamicMinProfitPct(dcaIndex: number) {
    const base = this.minProfitPct;
    const increment = 0.0007;
    return Math.max(base + dcaIndex * increment, 0.003);
  }

  private async sellPosition(pos: Position, price: number, timeframe: string) {
    if (this.isRunBacktest) {
      const profit = pos.qty * (price - pos.buyPrice);
      this.backtestProfit += profit;
      this.backtestPositions = this.backtestPositions.filter(
        (p) => p.id !== pos.id,
      );
      console.log(
        `[BACKTEST ${timeframe}] SELL (DCA ${pos.dcaIndex}) ${pos.qty} ${this.symbol} @ ${price} — Profit: ${profit.toFixed(2)}`,
      );
      this.sellSuccess.push({
        symbol: this.symbol,
        buyPrices: [pos.buyPrice],
        sellPrice: price,
        totalAmountBuyActual: pos.qty,
        totalAmountBuyUsdtSpent: pos.usdSpent,
        totalProfit: profit,
      });
      return pos;
    }

    const balances = await this.binanceService.getAccount();
    const asset = this.symbol.replace('USDT', '');
    const free = Number(
      balances.balances.find((b) => b.asset === asset)?.free || 0,
    );

    if (new Decimal(pos.qty).greaterThan(free)) {
      console.log('NOT ENOUGH TOKEN TO SELL : ', pos.qty);
      return;
    }

    const order = await this.binanceService.placeMarketOrder(
      this.symbol,
      'SELL',
      pos.qty,
    );

    const revenueUsdt = await this.binanceService.getRevenueFromSellOrder(
      order,
      this.symbol,
    );

    const profit = revenueUsdt - pos.usdSpent;
    this.cumulativeProfit += profit;

    await this.binanceService.deletePosition(pos.id);

    await this.binanceService.saveSellSuccess({
      symbol: this.symbol,
      buyPrices: [pos.buyPrice],
      sellPrice: price,
      totalAmountBuyActual: pos.qty,
      totalAmountBuyUsdtSpent: pos.usdSpent,
      totalProfit: profit,
      totalRevenueUsdt: revenueUsdt,
    });
    console.log(
      `[${timeframe}] SELL (DCA ${pos.dcaIndex}) ${pos.qty} ${this.symbol} @ ${price} — Profit: ${profit.toFixed(2)}`,
    );

    return pos;
  }

  stop() {
    this.logger.log(`Stopped RSI DCA strategy for ${this.symbol}`);
  }
}
