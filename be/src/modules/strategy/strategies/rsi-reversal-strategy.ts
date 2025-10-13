import { RSI, ATR } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { IStrategy } from './strategy.interface';
import { BinanceService } from 'src/modules/binance/binance.service';
import { Candle } from 'binance-api-node';
import Decimal from 'decimal.js';
import { randomUUID } from 'crypto';
import {
  loadPositions,
  savePositions,
  logSellSuccess,
  logTotalProfit,
  SellSuccessLog,
  Position,
} from '../helpers/savePosition';
import { formatDate } from '../helpers/formatDate';
import { STRATEGIES } from '.';

type TimeframeData = {
  closes: number[];
  highs: number[];
  lows: number[];
  lastCandles: Candle[];
};

export class RsiReversalStrategy implements IStrategy {
  private logger = new Logger('RsiReversalStrategy');
  private positions: Position[] = [];
  private cumulativeProfit = 0;

  // === CONFIG ===
  private maxPositions = 1;
  private tradePerBuyUsd = 100;
  private accountSizeUsd = 10000;

  private rsiPeriod = 14;
  private atrPeriod = 14;
  private atrStopLossMultiplier = 2;

  private rsiBuyThreshold = 30;
  private rsiSellThreshold = 70;
  private minProfitPct = 0.02; // chỉ bán khi có lãi >= 2%

  private cooldownMs = 30 * 60 * 1000; // 30 phút
  private lastTradeTime = 0;

  private timeframeData: Record<string, TimeframeData> = {};

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
  ) {
    this.positions = loadPositions(STRATEGIES.RSI_REVERSAL);
  }

  async startAll() {
    await this.start('15m'); // RSI đảo chiều hoạt động tốt khung nhỏ
  }

  private async start(timeframe: '15m') {
    this.logger.log(
      `Starting RSI Reversal Strategy for ${this.symbol} [${timeframe}]`,
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

      console.log('==============', formatDate(new Date()));
      console.log('RSI:', lastRsi.toFixed(2), 'ATR:', lastAtr.toFixed(2));

      // === BUY ===
      if (
        lastRsi <= this.rsiBuyThreshold &&
        cooldownOk &&
        this.positions.length < this.maxPositions
      ) {
        const qty = this.adjustToStepSize(this.tradePerBuyUsd / price);

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

      // === SELL ===
      if (lastRsi >= this.rsiSellThreshold && this.positions.length > 0) {
        const pos = this.positions[0];
        const profitPct = ((price - pos.buyPrice) / pos.buyPrice) * 100;

        if (profitPct >= this.minProfitPct * 100) {
          const order = await this.binanceService.placeMarketOrder(
            this.symbol,
            'SELL',
            this.adjustToStepSize(pos.qty),
          );

          const revenueUsdt = pos.qty * price;
          const profit = revenueUsdt - pos.usdSpent;
          this.cumulativeProfit += profit;

          const sellLog: SellSuccessLog = {
            symbol: this.symbol,
            buyPrices: [pos.buyPrice],
            sellPrice: price,
            totalAmountBuyActual: pos.qty,
            totalAmountBuyUsdtSpent: pos.usdSpent,
            totalProfit: profit,
            totalRevenueUsdt: revenueUsdt,
          };

          logSellSuccess(sellLog);
          this.positions = [];
          savePositions(this.positions);
          console.log(
            `[${timeframe}] SELL ${pos.qty} ${this.symbol} @ ${price} — Profit: ${profit.toFixed(2)}`,
          );
        } else {
          console.log(
            `[${timeframe}] RSI high but profit < ${this.minProfitPct * 100}% — HOLD.`,
          );
        }
      }

      // === STOP LOSS ===
      if (this.positions.length > 0) {
        const pos = this.positions[0];
        const stopLoss =
          pos.buyPrice - pos.atrAtBuy * this.atrStopLossMultiplier;
        if (price <= stopLoss) {
          console.log(
            `[${timeframe}] STOP LOSS triggered @ ${price}, below ${stopLoss}`,
          );
          await this.binanceService.placeMarketOrder(
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
      console.error(`[${timeframe}] Error in RSI reversal strategy:`, e);
    } finally {
      logTotalProfit();
    }
  }

  stop() {
    this.logger.log(`Stopped RSI Reversal strategy for ${this.symbol}`);
  }

  private adjustToStepSize(qty: number, stepSize = 0.001) {
    return parseFloat((Math.floor(qty / stepSize) * stepSize).toFixed(3));
  }
}
