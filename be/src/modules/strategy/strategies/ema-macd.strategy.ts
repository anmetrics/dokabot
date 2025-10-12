import { EMA, MACD, RSI } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { IStrategy } from './strategy.interface';
import { BinanceService } from 'src/modules/binance/binance.service';
import { Candle, Order } from 'binance-api-node';
import { TradeEvent } from '../events/trade.event';
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

type Position = {
  id: string;
  buyPrice: number;
  qty: number;
  usdSpent: number;
  totalQtyActual: number;
  buyTime: number;
};

type TimeframeData = {
  prices: number[];
  lastCandles: Candle[];
};

export class EmaMacdStrategy implements IStrategy {
  private logger = new Logger('EmaMacdStrategy');
  private cumulativeProfit = 0;
  private positions: Position[] = [];

  private maxPositions = 5;
  private maxBuyPrice = 1500;
  private rebuyDropPct = 2.8; // giá giảm bao nhiêu % thì rebuy
  private tradePerBuyUsd = 50;

  // Indicator periods
  private emaFastPeriod = 7;
  private emaSlowPeriod = 99;
  private emaMidPeriod = 25; // EMA25 để xác nhận cross nhanh
  private macdFastPeriod = 8;
  private macdSlowPeriod = 21;
  private macdSignalPeriod = 5;
  private rsiPeriod = 14;
  private rsiOverbought = 70;
  private rsiOversold = 35;

  // EMA confirmation params
  private confirmationCandles = 2;
  private minDistancePct = 0.001;
  private distanceTolerancePct = 0.001;

  private timeframeData: Record<string, TimeframeData> = {};

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
    private readonly emitEvent?: (event: TradeEvent) => void,
  ) {
    this.positions = loadPositions();
    console.log(
      'CURRENT_POSITION:',
      this.positions,
      'length:',
      this.positions.length,
    );
  }

  async startAll() {
    await Promise.all([this.start('1m')]);
  }

  private async start(timeframe: '1m' | '15m') {
    this.logger.log(
      `Starting EMA7 x EMA99 strategy for ${this.symbol} [${timeframe}]`,
    );

    const historicalCandles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      timeframe,
      500,
    );

    this.timeframeData[timeframe] = {
      prices: historicalCandles.map((c) => Number(c.close)),
      lastCandles: historicalCandles.slice(-3) as unknown as Candle[],
    };

    this.binanceService.subscribeCandles(this.symbol, timeframe, (trade) => {
      const data = this.timeframeData[timeframe];
      data.lastCandles.push(trade);
      if (data.lastCandles.length > 3) data.lastCandles.shift();

      data.prices.push(Number(trade.close));
      if (data.prices.length > 500) data.prices.shift();

      this.calcPrice(timeframe);
    });
  }

  private async calcPrice(timeframe: string) {
    try {
      const data = this.timeframeData[timeframe];
      if (!data || data.prices.length < this.emaSlowPeriod) return;

      const price = await this.binanceService.getPrice(this.symbol);
      if (!price) return;

      const { prices, lastCandles } = data;

      // === RSI ===
      const rsiValues = RSI.calculate({
        values: prices,
        period: this.rsiPeriod,
      });
      const lastRsi = rsiValues[rsiValues.length - 1];
      const prevRsi = rsiValues[rsiValues.length - 2];
      const rsiRising = lastRsi > prevRsi && lastRsi < this.rsiOversold;

      // === EMA ===
      const emaFast = EMA.calculate({
        period: this.emaFastPeriod,
        values: prices,
      });
      const emaSlow = EMA.calculate({
        period: this.emaSlowPeriod,
        values: prices,
      });
      const emaMid = EMA.calculate({
        period: this.emaMidPeriod,
        values: prices,
      });

      const lastEmaFast = emaFast[emaFast.length - 1];
      const prevEmaFast = emaFast[emaFast.length - 2];
      const lastEmaSlow = emaSlow[emaSlow.length - 1];
      const prevEmaSlow = emaSlow[emaSlow.length - 2];
      const lastEmaMid = emaMid[emaMid.length - 1];
      const prevEmaMid = emaMid[emaMid.length - 2];

      const trendUp = lastEmaFast > lastEmaSlow;
      const trendDown = lastEmaFast < lastEmaSlow;

      const emaBullishCross =
        prevEmaFast < prevEmaSlow && lastEmaFast > lastEmaSlow;
      const emaBearishCross =
        prevEmaFast > prevEmaSlow && lastEmaFast < lastEmaSlow;

      const ema7_25_BullishCross =
        prevEmaFast < prevEmaMid && lastEmaFast > lastEmaMid && trendUp;
      const ema7_25_BearishCross =
        prevEmaFast > prevEmaMid && lastEmaFast < lastEmaMid && trendDown;

      // Confirm EMA cross
      const emaBullishConfirmed =
        emaBullishCross &&
        this.confirmEmaCross(emaFast, emaSlow, this.confirmationCandles, true);
      const emaBearishConfirmed =
        emaBearishCross &&
        this.confirmEmaCross(emaFast, emaSlow, this.confirmationCandles, false);

      const ema7_25_BullishConfirmed =
        ema7_25_BullishCross &&
        this.confirmEmaCross(emaFast, emaMid, this.confirmationCandles, true);
      const ema7_25_BearishConfirmed =
        ema7_25_BearishCross &&
        this.confirmEmaCross(emaFast, emaMid, this.confirmationCandles, false);

      // === MACD ===
      const macdResult = MACD.calculate({
        values: prices,
        fastPeriod: this.macdFastPeriod,
        slowPeriod: this.macdSlowPeriod,
        signalPeriod: this.macdSignalPeriod,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      const lastMacd = macdResult[macdResult.length - 1];
      const prevMacd =
        macdResult.length >= 2 ? macdResult[macdResult.length - 2] : undefined;

      if (
        !prevMacd ||
        !prevMacd.MACD ||
        !prevMacd.signal ||
        !lastMacd ||
        lastMacd.MACD === undefined ||
        lastMacd.signal === undefined
      )
        return;
      const macdBullishCross =
        prevMacd &&
        prevMacd.MACD < prevMacd.signal &&
        lastMacd.MACD > lastMacd.signal;

      // === Candle pattern / Volume spike ===
      if (lastCandles.length < 3) return;
      const [_, c2, c3] = lastCandles.slice(-3);
      const volumeSpike =
        Number(c3.volume) >
        Number(lastCandles[lastCandles.length - 2].volume) * 1.15;
      const isBullishEngulfing =
        Number(c2.close) < Number(c2.open) &&
        Number(c3.close) > Number(c2.open);

      // === Check Buy ===

      const rebuyCondition =
  this.positions.length > 3
    ? price < Math.min(...this.positions.map((p) => p.buyPrice)) * (1 - this.rebuyDropPct)
    : true; 


    const lastBuyTime = this.positions.length > 0 
  ? Math.max(...this.positions.map((p) => p.buyTime || 0)) 
  : 0;
  
const now = Date.now();
const timeDiffOk = lastBuyTime === 0 || now - lastBuyTime >= 10 * 60 * 1000;

    
      const isValidBuy =
      timeDiffOk &&
        this.positions.length < this.maxPositions &&
        (emaBullishConfirmed ||
          ema7_25_BullishConfirmed ||
          (macdBullishCross &&
            rsiRising &&
            isBullishEngulfing &&
            volumeSpike)) &&
        price < this.maxBuyPrice &&
    rebuyCondition;

      // === Check Sell ===
      const isValidSell =
        trendDown &&
        this.positions.length > 0 &&
        (emaBearishConfirmed ||
          ema7_25_BearishConfirmed ||
          lastRsi > this.rsiOverbought);

      // === LOG ===
      console.log('====================', formatDate(new Date()));
      console.log('Price:', price.toFixed(2), 'RSI:', lastRsi.toFixed(2));
      console.log('Valid BUY:', isValidBuy, 'Valid SELL:', isValidSell);

      // === Execute Buy ===
      if (isValidBuy) {
        const qty = this.usdToQty(price, this.tradePerBuyUsd);
        if (qty > 0) {
          const order = await this.binanceService.placeMarketOrder(
            this.symbol,
            'BUY',
            qty,
          );
          const { totalQty } = getActualBoughtQtyAndFee(order);

          this.positions.push({
            id: randomUUID(),
            buyPrice: price,
            qty,
            usdSpent: await this.getFeeFromOrder(order),
            totalQtyActual: +totalQty,
            buyTime: Date.now()
          });
          savePositions(this.positions);
          console.log(`[${timeframe}] BUY ${qty} ${this.symbol} @ ${price}`);
        }
      }

      // === Execute Sell ===
      if (isValidSell) {
        const balances = await this.binanceService.getAccount();
        const asset = this.symbol.replace('USDT', '');
        const free = Number(
          balances.balances.find((b) => b.asset === asset)?.free || 0,
        );

        const sellable = this.positions.filter(
          (pos) => price > pos.buyPrice * 1.0087,
        );
        const totalQty = sellable.reduce(
          (sum, pos) => sum.plus(new Decimal(pos.qty)),
          new Decimal(0),
        );
        const totalUsdSpent = sellable.reduce(
          (sum, pos) => sum + pos.usdSpent,
          0,
        );

        if (totalQty.lessThanOrEqualTo(0) || totalQty.greaterThan(free)) return;

        const order = await this.binanceService.placeMarketOrder(
          this.symbol,
          'SELL',
          this.adjustToStepSize(totalQty.toNumber()),
        );

        const revenueUsdt = await this.getRevenueFromSellOrder(order);
        const profit = revenueUsdt - totalUsdSpent;
        this.cumulativeProfit += profit;

        const soldIds = new Set(sellable.map((p) => p.id));
        this.positions = this.positions.filter((p) => !soldIds.has(p.id));
        savePositions(this.positions);

        console.log(
          `[${timeframe}] SELL ${totalQty.toNumber()} ${asset} @ ${price}, Profit: ${profit.toFixed(4)}, Cumulative: ${this.cumulativeProfit.toFixed(4)}`,
        );

        const sellLog: SellSuccessLog = {
          symbol: this.symbol,
          buyPrices: sellable.map((p) => p.buyPrice),
          sellPrice: price,
          totalAmountBuyActual: sellable.reduce(
            (sum, p) => sum + p.totalQtyActual,
            0,
          ),
          totalAmountBuyUsdtSpent: totalUsdSpent,
          totalProfit: profit,
          totalRevenueUsdt: revenueUsdt,
        };

        logSellSuccess(sellLog);
      }
    } catch (err) {
      console.error(`[${timeframe}] Strategy error:`, err);
    } finally {
      logTotalProfit();
    }
  }

  stop() {
    this.logger.log(`Stopped EMA7 x EMA99 strategy for ${this.symbol}`);
  }

  private adjustToStepSize(qty: number, stepSize = 0.001) {
    return parseFloat((Math.floor(qty / stepSize) * stepSize).toFixed(3));
  }

  private usdToQty(price: number, usd: number) {
    return this.adjustToStepSize(usd / price);
  }

  private async getFeeFromOrder(order: Order) {
    let totalFeeUSDT = 0;
    if (!order.fills) return 0;
    for (const fill of order.fills) {
      const commission = parseFloat(fill.commission);
      const asset = fill.commissionAsset;
      if (asset === 'USDT') totalFeeUSDT += commission;
      else if (asset === this.symbol.replace('USDT', ''))
        totalFeeUSDT += commission * parseFloat(fill.price);
      else {
        const assetPrice = await this.binanceService.getPrice(`${asset}USDT`);
        totalFeeUSDT += commission * assetPrice;
      }
    }
    return totalFeeUSDT;
  }

  private async getRevenueFromSellOrder(order: Order) {
    let revenueUSDT = 0;
    if (!order.fills) return 0;
    for (const fill of order.fills) {
      const qty = parseFloat(fill.qty);
      const price = parseFloat(fill.price);
      let feeUSDT = 0;
      const commission = parseFloat(fill.commission);
      const asset = fill.commissionAsset;

      if (asset === 'USDT') feeUSDT = commission;
      else if (asset === this.symbol.replace('USDT', ''))
        feeUSDT = commission * price;
      else {
        const assetPrice = await this.binanceService.getPrice(`${asset}USDT`);
        feeUSDT = commission * assetPrice;
      }

      revenueUSDT += qty * price - feeUSDT;
    }
    return revenueUSDT;
  }

  /**
   * Xác nhận EMA cross chắc chắn, giảm tín hiệu nhiễu khi sideway
   */
  private confirmEmaCross(
    emaFast: number[],
    emaSlow: number[],
    lookback = 2,
    isBullish: boolean,
  ): boolean {
    if (emaFast.length < lookback + 1 || emaSlow.length < lookback + 1)
      return false;

    const fastSlice = emaFast.slice(-lookback - 1);
    const slowSlice = emaSlow.slice(-lookback - 1);

    const distances = fastSlice.map((v, i) => v - slowSlice[i]);
    const lastDistance = distances[distances.length - 1];

    if (isBullish && lastDistance <= 0) return false;
    if (!isBullish && lastDistance >= 0) return false;

    const minDistance =
      Math.abs(slowSlice[slowSlice.length - 1]) * this.minDistancePct;
    if (Math.abs(lastDistance) < minDistance) return false;

    const firstDistance = distances[0];
    const expansion = isBullish
      ? lastDistance - firstDistance
      : firstDistance - lastDistance;
    const tolerance = Math.abs(firstDistance) * this.distanceTolerancePct;

    return expansion > -tolerance;
  }
}
