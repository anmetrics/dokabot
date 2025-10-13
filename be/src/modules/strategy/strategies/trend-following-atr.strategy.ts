import { EMA, ATR } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { IStrategy } from './strategy.interface';
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
} from '../helpers/savePosition';
import { formatDate } from '../helpers/formatDate';

type Position = {
  id: string;
  buyPrice: number;
  qty: number;
  usdSpent: number;
  atrAtBuy: number;
  buyTime: number;
};

type TimeframeData = {
  closes: number[];
  highs: number[];
  lows: number[];
  lastCandles: Candle[];
};

/**
 * TrendFollowingAtrStrategy
 * ---------------------------------------------
 * - EMA50 cắt lên EMA200 => BUY (vào xu hướng tăng)
 * - EMA50 cắt xuống EMA200 => SELL (thoát xu hướng, nhưng chỉ khi có lãi)
 * - StopLoss theo ATR (Average True Range)
 * - Quản lý rủi ro: mỗi lệnh rủi ro tối đa X% tài khoản
 */
export class TrendFollowingAtrStrategy implements IStrategy {
  private logger = new Logger('TrendFollowingAtrStrategy');
  private positions: Position[] = [];
  private cumulativeProfit = 0;

  // === Cấu hình cơ bản ===
  private maxPositions = 1;
  private tradePerBuyUsd = 100;
  private maxBuyPrice = 200000; // limit for some assets

  // === EMA & ATR ===
  private emaFastPeriod = 50;
  private emaSlowPeriod = 200;
  private atrPeriod = 14;
  private atrStopLossMultiplier = 2.5; // stop = buyPrice - 2.5 * ATR

  // === Risk Management ===
  private riskPerTradePct = 1; // 1% vốn
  private accountSizeUsd = 10000;

  // === Cooldown ===
  private cooldownMs = 60 * 60 * 1000; // 1 giờ
  private lastTradeTime = 0;

  // === SELL Condition ===
  private minProfitPct = 0.03; // Chỉ SELL khi lợi nhuận >= 4% (>= 0.01 => +1%)

  private timeframeData: Record<string, TimeframeData> = {};

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
  ) {
    this.positions = loadPositions();
  }

  async startAll() {
    await this.start('1h'); // chạy khung H1 cho trend dài
  }

  private async start(timeframe: '1h') {
    this.logger.log(
      `Starting Trend Following + ATR strategy for ${this.symbol} [${timeframe}]`,
    );

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

  private async calcSignal(timeframe: string) {
    try {
      const data = this.timeframeData[timeframe];
      if (!data || data.closes.length < this.emaSlowPeriod + 1) return;

      const emaFast = EMA.calculate({
        period: this.emaFastPeriod,
        values: data.closes,
      });
      const emaSlow = EMA.calculate({
        period: this.emaSlowPeriod,
        values: data.closes,
      });

      const atr = ATR.calculate({
        high: data.highs,
        low: data.lows,
        close: data.closes,
        period: this.atrPeriod,
      });

      if (emaFast.length < 2 || emaSlow.length < 2 || atr.length < 1) return;

      const lastEmaFast = emaFast[emaFast.length - 1];
      const prevEmaFast = emaFast[emaFast.length - 2];
      const lastEmaSlow = emaSlow[emaSlow.length - 1];
      const prevEmaSlow = emaSlow[emaSlow.length - 2];
      const lastAtr = atr[atr.length - 1];
      const price = data.closes[data.closes.length - 1];

      const now = Date.now();
      const cooldownOk =
        this.lastTradeTime === 0 || now - this.lastTradeTime >= this.cooldownMs;

      const bullishCross =
        prevEmaFast < prevEmaSlow && lastEmaFast > lastEmaSlow;
      const bearishCross =
        prevEmaFast > prevEmaSlow && lastEmaFast < lastEmaSlow;

      console.log('==============', formatDate(new Date()));
      console.log(
        'EMA50:',
        lastEmaFast.toFixed(2),
        'EMA200:',
        lastEmaSlow.toFixed(2),
        'ATR:',
        lastAtr.toFixed(2),
      );

      // === BUY ===
      if (
        bullishCross &&
        cooldownOk &&
        this.positions.length < this.maxPositions
      ) {
        const riskUsd = (this.riskPerTradePct / 100) * this.accountSizeUsd;
        const stopPrice = price - this.atrStopLossMultiplier * lastAtr;
        const riskPerUnit = price - stopPrice;
        const qty = this.adjustToStepSize(riskUsd / riskPerUnit);

        if (qty > 0 && price < this.maxBuyPrice) {
          const order = await this.binanceService.placeMarketOrder(
            this.symbol,
            'BUY',
            qty,
          );
          const usdSpent = qty * price;

          this.positions.push({
            id: randomUUID(),
            buyPrice: price,
            qty,
            usdSpent,
            atrAtBuy: lastAtr,
            buyTime: Date.now(),
          });
          savePositions(this.positions);
          this.lastTradeTime = now;
          console.log(`[${timeframe}] BUY ${qty} ${this.symbol} @ ${price}`);
        }
      }

      // === SELL === (chỉ bán khi có lãi)
      if (bearishCross && this.positions.length > 0 && cooldownOk) {
        const totalQty = this.positions.reduce((sum, p) => {
          return sum.plus(p.qty);
        }, new Decimal(0));
        const avgBuyPrice =
          this.positions.reduce((sum, p) => sum + p.buyPrice, 0) /
          this.positions.length;

        const currentPrice = price;
        const profitPct = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;

        if (profitPct >= this.minProfitPct) {
          await this.binanceService.placeMarketOrder(
            this.symbol,
            'SELL',
            this.adjustToStepSize(totalQty.toNumber()),
          );

          const revenueUsdt = totalQty.toNumber() * currentPrice;
          const usdSpent = totalQty.toNumber() * avgBuyPrice;
          const profit = revenueUsdt - usdSpent;

          this.cumulativeProfit += profit;
          const soldPositions = [...this.positions];
          this.positions = [];
          savePositions(this.positions);
          this.lastTradeTime = now;

          const sellLog: SellSuccessLog = {
            symbol: this.symbol,
            buyPrices: soldPositions.map((p) => p.buyPrice),
            sellPrice: currentPrice,
            totalAmountBuyActual: totalQty.toNumber(),
            totalAmountBuyUsdtSpent: usdSpent,
            totalProfit: profit,
            totalRevenueUsdt: revenueUsdt,
          };

          logSellSuccess(sellLog);
          console.log(
            `[${timeframe}] SELL ${totalQty.toNumber()} ${this.symbol} @ ${currentPrice} — Profit: ${profit.toFixed(
              2,
            )}, Total: ${this.cumulativeProfit.toFixed(2)}`,
          );
        } else {
          console.log(
            `[${timeframe}] Bearish cross detected but profit (${profitPct.toFixed(
              2,
            )}%) < ${this.minProfitPct}% — HOLD position.`,
          );
        }
      }

      // === Stop Loss check ===
      if (this.positions.length > 0) {
        const pos = this.positions[0];
        const stopLoss =
          pos.buyPrice - pos.atrAtBuy * this.atrStopLossMultiplier;
        if (price <= stopLoss) {
          console.log(
            `[${timeframe}] STOP LOSS triggered @ ${price}, below ${stopLoss}`,
          );
          const order = await this.binanceService.placeMarketOrder(
            this.symbol,
            'SELL',
            this.adjustToStepSize(pos.qty),
          );
          const revenueUsdt = pos.qty * price;
          const profit = revenueUsdt - pos.usdSpent;
          this.cumulativeProfit += profit;
          this.positions = [];
          savePositions(this.positions);
        }
      }
    } catch (e) {
      console.error(`[${timeframe}] Error in trend following:`, e);
    } finally {
      logTotalProfit();
    }
  }

  stop() {
    this.logger.log(`Stopped Trend Following ATR strategy for ${this.symbol}`);
  }

  private adjustToStepSize(qty: number, stepSize = 0.001) {
    return parseFloat((Math.floor(qty / stepSize) * stepSize).toFixed(3));
  }
}
