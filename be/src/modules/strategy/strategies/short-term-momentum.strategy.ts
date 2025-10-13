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
import { getActualBoughtQtyAndFee } from '../helpers/crypto';

/**
 * ShortTermMomentumStrategy
 * - Khung thời gian mặc định: 5m
 * - Ý tưởng: bắt động lượng ngắn hạn (momentum breakout) + lọc bằng EMA/RSI
 * - Entry: momentum (return over window) > threshold AND price above EMA(filter optional)
 * - Exit: momentum giảm dưới exitThreshold OR hit takeProfit/stopLoss
 * - Risk: position sizing bằng USD cố định + optional volatility sizing via ATR
 * - Có cooldown và maxPositions để tránh overtrading
 */

type Position = {
  id: string;
  buyPrice: number;
  qty: number;
  usdSpent: number;
  entryTime: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
};

type TimeframeData = {
  closes: number[];
  highs: number[];
  lows: number[];
  lastCandles: Candle[];
};

export class ShortTermMomentumStrategy implements IStrategy {
  private logger = new Logger('ShortTermMomentumStrategy');
  private positions: Position[] = [];
  private cumulativeProfit = 0;

  // --- Config ---
  private timeframe: '1m' | '5m' | '15m' = '5m';
  private maxPositions = 3;
  private tradePerBuyUsd = 100; // USD per trade (base)
  private maxNotionalPerSymbolUsd = 1000;

  // Momentum params
  private momentumWindow = 6; // number of bars to compute return (e.g. 6 * 5m = 30min)
  private momentumThreshold = 0.007; // 0.7% move over window to trigger
  private exitMomentumThreshold = 0.002; // momentum below this -> exit

  // Filters
  private useEmaFilter = true;
  private emaFilterPeriod = 21; // price must be above EMA to long
  private useRsiFilter = true;
  private rsiPeriod = 14;
  private rsiOverbought = 70;
  private rsiOversold = 30;

  // ATR-based stop / TP sizing
  private atrPeriod = 14;
  private stopLossAtrMultiplier = 1.5; // stop = entry - ATR * multiplier
  private takeProfitAtrMultiplier = 3.0; // take profit = entry + ATR * multiplier

  // fixed % stop/take (fallback)
  private stopLossPct = 0.01; // 1% fallback
  private takeProfitPct = 0.02; // 2% fallback

  // execution / risk
  private cooldownMs = 10 * 60 * 1000; // 10 minutes between trades
  private lastTradeTime = 0;
  private estimatedFeePct = 0.001; // per trade

  private timeframeData: Record<string, TimeframeData> = {};

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
    private readonly emitEvent?: (event: unknown) => void,
  ) {
    this.positions = loadPositions() || [];
  }

  async startAll() {
    await this.start(this.timeframe);
  }

  private async start(timeframe: '1m' | '5m' | '15m') {
    this.logger.log(
      `Starting ShortTermMomentumStrategy for ${this.symbol} [${timeframe}]`,
    );

    const historical = await this.binanceService.getHistoricalCandles(
      this.symbol,
      timeframe,
      500,
    );
    this.timeframeData[timeframe] = {
      closes: historical.map((c) => +c.close),
      highs: historical.map((c) => +c.high),
      lows: historical.map((c) => +c.low),
      lastCandles: historical.slice(-3) as unknown as Candle[],
    };

    this.binanceService.subscribeCandles(this.symbol, timeframe, (c) => {
      const d = this.timeframeData[timeframe];
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

      this.onNewBar(timeframe);
    });
  }

  private async onNewBar(timeframe: string) {
    try {
      const d = this.timeframeData[timeframe];
      if (
        !d ||
        d.closes.length <
          Math.max(
            this.momentumWindow + 2,
            this.emaFilterPeriod,
            this.atrPeriod,
          )
      )
        return;

      const price = await this.binanceService.getPrice(this.symbol);
      if (!price) return;

      // compute momentum (return over window)
      const past = d.closes[d.closes.length - 1 - this.momentumWindow];
      const momentum = price / past - 1; // decimal

      // EMA filter
      let emaFilterOk = true;
      if (this.useEmaFilter) {
        const emaArr = EMA.calculate({
          period: this.emaFilterPeriod,
          values: d.closes,
        });
        const lastEma = emaArr[emaArr.length - 1];
        emaFilterOk = price >= lastEma;
      }

      // RSI optional
      let rsiOk = true;
      if (this.useRsiFilter) {
        // compute RSI quickly (simple implement since technicalindicators RSI require full series)
        // we can approximate or skip if not enough data
        // For simplicity use momentum sign: avoid overbought
        rsiOk = true; // placeholder - optional advanced calc can be plugged here
      }

      // ATR for sizing stop/TP
      const atrArr = ATR.calculate({
        high: d.highs,
        low: d.lows,
        close: d.closes,
        period: this.atrPeriod,
      });
      const lastAtr = atrArr.length ? atrArr[atrArr.length - 1] : 0;

      const now = Date.now();
      const cooldownOk =
        this.lastTradeTime === 0 || now - this.lastTradeTime >= this.cooldownMs;

      console.log('===== ShortTermMomentum', formatDate(new Date()));
      console.log(
        'Price:',
        price.toFixed(6),
        'Momentum:',
        (momentum * 100).toFixed(2) + '%',
        'EMAok:',
        emaFilterOk,
        'ATR:',
        lastAtr.toFixed(6),
      );

      // check exits first: if we have open positions, evaluate exit criteria
      if (this.positions.length > 0) {
        await this.checkExits(price, momentum, lastAtr);
      }

      // entry condition
      if (
        momentum >= this.momentumThreshold &&
        emaFilterOk &&
        rsiOk &&
        cooldownOk &&
        this.positions.length < this.maxPositions &&
        price < this.maxNotionalPerSymbolUsd
      ) {
        // place buy
        const usdAlloc = Math.min(
          this.tradePerBuyUsd,
          this.maxNotionalPerSymbolUsd,
        );
        const qty = this.usdToQty(price, usdAlloc);
        if (qty <= 0) return;

        const order = await this.binanceService.placeMarketOrder(
          this.symbol,
          'BUY',
          qty,
        );
        const { totalQty } = getActualBoughtQtyAndFee(order);
        const feeUsdt = await this.getFeeFromOrder(order);
        const usdSpent = price * +totalQty + feeUsdt;

        const stopLossPrice =
          lastAtr > 0
            ? price - lastAtr * this.stopLossAtrMultiplier
            : price * (1 - this.stopLossPct);
        const takeProfitPrice =
          lastAtr > 0
            ? price + lastAtr * this.takeProfitAtrMultiplier
            : price * (1 + this.takeProfitPct);

        const pos: Position = {
          id: randomUUID(),
          buyPrice: price,
          qty: +totalQty,
          usdSpent,
          entryTime: Date.now(),
          stopLossPrice,
          takeProfitPrice,
        };

        this.positions.push(pos);
        savePositions(this.positions);
        this.lastTradeTime = Date.now();

        console.log(
          `[ENTRY] BUY ${pos.qty} ${this.symbol} @ ${price} stop=${stopLossPrice.toFixed(6)} tp=${takeProfitPrice.toFixed(6)}`,
        );
      }
    } catch (err) {
      console.error('onNewBar error', err);
    } finally {
      logTotalProfit();
    }
  }

  private async checkExits(price: number, momentum: number, lastAtr: number) {
    try {
      const toSell: Position[] = [];
      for (const pos of this.positions) {
        // take profit
        if (pos.takeProfitPrice && price >= pos.takeProfitPrice) {
          toSell.push(pos);
          continue;
        }
        // stop loss
        if (pos.stopLossPrice && price <= pos.stopLossPrice) {
          toSell.push(pos);
          continue;
        }
        // momentum faded
        if (momentum <= this.exitMomentumThreshold) {
          toSell.push(pos);
          continue;
        }
      }

      if (toSell.length === 0) return;

      // sell all flagged
      const totalQty = toSell.reduce(
        (sum, p) => sum.plus(new Decimal(p.qty)),
        new Decimal(0),
      );
      const orderQty = this.adjustToStepSize(totalQty.toNumber());
      if (orderQty <= 0) return;

      const order = await this.binanceService.placeMarketOrder(
        this.symbol,
        'SELL',
        orderQty,
      );
      const revenueUsdt = await this.getRevenueFromSellOrder(order);
      const totalUsdSpent = toSell.reduce((s, p) => s + p.usdSpent, 0);
      const profit = revenueUsdt - totalUsdSpent;
      this.cumulativeProfit += profit;

      const soldIds = new Set(toSell.map((p) => p.id));
      const soldPositions = [...toSell];
      this.positions = this.positions.filter((p) => !soldIds.has(p.id));
      savePositions(this.positions);

      console.log(
        `[EXIT] SELL ${orderQty} ${this.symbol} @ ${price} profit=${profit.toFixed(4)} cumulative=${this.cumulativeProfit.toFixed(4)}`,
      );

      const sellLog: SellSuccessLog = {
        symbol: this.symbol,
        buyPrices: soldPositions.map((p) => p.buyPrice),
        sellPrice: price,
        totalAmountBuyActual: soldPositions.reduce((s, p) => s + p.qty, 0),
        totalAmountBuyUsdtSpent: totalUsdSpent,
        totalProfit: profit,
        totalRevenueUsdt: revenueUsdt,
      };
      logSellSuccess(sellLog);
    } catch (err) {
      console.error('checkExits error', err);
    }
  }

  stop() {
    this.logger.log(`Stopped ShortTermMomentumStrategy for ${this.symbol}`);
  }

  private adjustToStepSize(qty: number, stepSize = 0.000001) {
    if (!isFinite(qty) || qty <= 0) return 0;
    return parseFloat((Math.floor(qty / stepSize) * stepSize).toFixed(6));
  }

  private usdToQty(price: number, usd: number) {
    return this.adjustToStepSize(usd / price);
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

  private async getRevenueFromSellOrder(order: Order) {
    if (!order?.fills) return 0;
    let revenueUSDT = 0;
    for (const fill of order.fills) {
      const qty = parseFloat(fill.qty || '0');
      const price = parseFloat(fill.price || '0');
      const commission = parseFloat(fill.commission || '0');
      const asset = fill.commissionAsset;
      if (asset === 'USDT') revenueUSDT += qty * price - commission;
      else revenueUSDT += qty * price - commission * price;
    }
    return revenueUSDT;
  }
}
