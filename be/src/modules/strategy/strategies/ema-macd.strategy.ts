import { EMA, MACD, RSI } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { IStrategy } from './strategy.interface';
import { BinanceService } from 'src/modules/binance/binance.service';
import { Candle, Order } from 'binance-api-node';
import { TradeEvent } from '../events/trade.event';
import Decimal from 'decimal.js';
import { randomUUID } from 'crypto';
import { loadPositions, savePositions } from '../helpers/savePosition';
import { formatDate } from '../helpers/formatDate';

type Position = {
  id: string;
  buyPrice: number;
  qty: number;
  usdSpent: number;
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
  private maxBuyPrice = 1280;
  // 2%
  private rebuyDropPct = 0.02;
  private tradePerBuyUsd = 50;

  // indicator periods
  private emaFastPeriod = 7;
  private emaSlowPeriod = 99;
  private macdFastPeriod = 8;
  private macdSlowPeriod = 21;
  private macdSignalPeriod = 5;
  private rsiPeriod = 14;
  private rsiOverbought = 70;
  private rsiOversold = 30;

  // confirmation settings
  private confirmationCandles = 2; // số nến dùng để confirm trend
  private distanceTolerancePct = 0.001; // 0.1% tolerance khi kiểm tra mở rộng khoảng cách
  private minDistancePct = 0.001; // yêu cầu khoảng cách tối thiểu (0.1% of slow ema)

  private timeframeData: Record<string, TimeframeData> = {};

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
    private readonly emitEvent?: (event: TradeEvent) => void,
  ) {
    this.positions = loadPositions();
    this.logger.log(`Loaded positions: ${this.positions.length}`);
  }

  async startAll() {
    await Promise.all([this.start('5m')]);
  }

  private async start(timeframe: '5m' | '15m') {
    this.logger.log(
      `Starting EMA${this.emaFastPeriod} x EMA${this.emaSlowPeriod} ${timeframe} strategy for ${this.symbol}`,
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

      this.calcPrice(timeframe).catch((err) =>
        this.logger.error('calcPrice error', err),
      );
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
      const rsiRising =
        lastRsi !== undefined &&
        prevRsi !== undefined &&
        lastRsi > prevRsi &&
        lastRsi < this.rsiOversold;

      // === EMA ===
      const emaFast = EMA.calculate({
        period: this.emaFastPeriod,
        values: prices,
      });
      const emaSlow = EMA.calculate({
        period: this.emaSlowPeriod,
        values: prices,
      });
      const lastEmaFast = emaFast[emaFast.length - 1];
      const prevEmaFast = emaFast[emaFast.length - 2];
      const lastEmaSlow = emaSlow[emaSlow.length - 1];
      const prevEmaSlow = emaSlow[emaSlow.length - 2];

      const emaBullishCross =
        prevEmaFast < prevEmaSlow && lastEmaFast > lastEmaSlow;
      const emaBearishCross =
        prevEmaFast > prevEmaSlow && lastEmaFast < lastEmaSlow;

      const trendUp = lastEmaFast > lastEmaSlow;
      const trendDown = lastEmaFast < lastEmaSlow;

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
        prevMacd.MACD < prevMacd.signal && lastMacd.MACD > lastMacd.signal;
      const macdBearish = lastMacd.MACD < lastMacd.signal;

      if (lastCandles.length < 3) return;
      const [_, c2, c3] = lastCandles.slice(-3);
      const volumeSpike =
        Number(c3.volume) >
        Number(lastCandles[lastCandles.length - 2].volume) * 1.15;
      const isBullishEngulfing =
        Number(c2.close) < Number(c2.open) &&
        Number(c3.close) > Number(c2.open);

      // EMA 25
      const ema25 = EMA.calculate({ period: 25, values: prices });
      const lastEma25 = ema25[ema25.length - 1];
      const prevEma25 = ema25[ema25.length - 2];

      const ema7_25_BullishCross =
        prevEmaFast < prevEma25 && lastEmaFast > lastEma25 && trendUp;
      const ema7_25_BearishCross =
        prevEmaFast > prevEma25 && lastEmaFast < lastEma25 && trendDown;

      // Confirm EMA7-25 crosses with distance check (optional but reduces false signals)
      const ema7_25_BullishConfirmed =
        ema7_25_BullishCross &&
        this.isTrendConfirmedSimple(
          emaFast,
          ema25,
          this.confirmationCandles,
          true,
        );
      const ema7_25_BearishConfirmed =
        ema7_25_BearishCross &&
        this.isTrendConfirmedSimple(
          emaFast,
          ema25,
          this.confirmationCandles,
          false,
        );

      // Confirm main EMA cross (7 x 99)
      const emaBullishCrossConfirmed =
        emaBullishCross &&
        this.isTrendConfirmedSimple(
          emaFast,
          emaSlow,
          this.confirmationCandles,
          true,
        );
      const emaBearishCrossConfirmed =
        emaBearishCross &&
        this.isTrendConfirmedSimple(
          emaFast,
          emaSlow,
          this.confirmationCandles,
          false,
        );

      // === Check Buy ===
      const isValidBuy =
        rsiRising &&
        this.positions.length < this.maxPositions &&
        (emaBullishCrossConfirmed ||
          ema7_25_BullishConfirmed ||
          (macdBullishCross && isBullishEngulfing && volumeSpike)) &&
        price < this.maxBuyPrice &&
        (this.positions.length === 0 ||
          price <
            Math.min(...this.positions.map((p) => p.buyPrice)) *
              (1 - this.rebuyDropPct));

      // === Check Sell ===
      const isValidSell =
        this.positions.length > 0 &&
        (emaBearishCrossConfirmed ||
          ema7_25_BearishConfirmed ||
          (lastRsi > this.rsiOverbought && trendDown));

      // === LOG CHECK DETAIL ===
      console.log(
        '\x1b[33m%s\x1b[0m',
        '=============================',
        formatDate(new Date()),
      );
      console.log('Timeframe          :', timeframe);
      console.log('Current Price      :', price.toFixed(2));
      console.log('Current RSI        :', lastRsi?.toFixed(2));

      console.log('\x1b[32m%s\x1b[0m', '===== BUY CHECK =====');
      console.log('Bullish Engulfing  :', isBullishEngulfing);
      console.log('RSI Rising/Oversold:', rsiRising);
      console.log('Volume Spike       :', volumeSpike);
      console.log('EMA Bullish Cross  :', emaBullishCross);
      console.log('EMA7-25 Bullish    :', ema7_25_BullishCross);
      console.log('EMA7-25 Confirmed  :', ema7_25_BullishConfirmed);
      console.log('MACD Bullish Cross :', macdBullishCross);
      console.log('EMA Bullish Confirm:', emaBullishCrossConfirmed);
      console.log('=> IS VALID BUY    :', isValidBuy);

      console.log('\x1b[31m%s\x1b[0m', '===== SELL CHECK =====');
      console.log('Trend Down         :', trendDown);
      console.log('EMA Bearish Cross  :', emaBearishCross);
      console.log('EMA7-25 Bearish    :', ema7_25_BearishCross);
      console.log('EMA7-25 Confirmed  :', ema7_25_BearishConfirmed);
      console.log('MACD Bearish       :', macdBearish);
      console.log('RSI > Overbought   :', lastRsi > this.rsiOverbought);
      console.log('EMA Bearish Confirm:', emaBearishCrossConfirmed);
      console.log('Has Position       :', this.positions.length > 0);
      console.log('=> IS VALID SELL   :', isValidSell);

      // === Execute Buy ===
      if (isValidBuy) {
        const qty = this.usdToQty(price, this.tradePerBuyUsd);
        if (qty > 0) {
          const order = await this.binanceService.placeMarketOrder(
            this.symbol,
            'BUY',
            qty,
          );
          this.positions.push({
            id: randomUUID(),
            buyPrice: price,
            qty,
            usdSpent: await this.getFeeFromOrder(order),
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
          (pos) => price > pos.buyPrice * 1.006,
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
        const revenue = await this.getRevenueFromSellOrder(order);
        const profit = revenue - totalUsdSpent;
        this.cumulativeProfit += profit;

        const soldIds = new Set(sellable.map((p) => p.id));
        this.positions = this.positions.filter((p) => !soldIds.has(p.id));
        savePositions(this.positions);

        console.log(
          `[${timeframe}] SELL ${totalQty.toNumber()} ${asset} @ ${price}, Profit: ${profit.toFixed(4)}, Cumulative: ${this.cumulativeProfit.toFixed(4)}`,
        );
      }
    } catch (err) {
      console.error(`[${timeframe}] Strategy error:`, err);
    }
  }

  stop() {
    this.logger.log(
      `Stopped EMA${this.emaFastPeriod} x EMA${this.emaSlowPeriod} strategy for ${this.symbol}`,
    );
  }

  private adjustToStepSize(qty: number, stepSize = 0.001) {
    return parseFloat((Math.floor(qty / stepSize) * stepSize).toFixed(3));
  }

  private usdToQty(price: number, usd: number) {
    return this.adjustToStepSize(usd / price);
  }

  private async getFeeFromOrder(order: Order) {
    let totalFeeUSDT = 0;
    if (order.fills) {
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
    }
    return totalFeeUSDT;
  }

  private async getRevenueFromSellOrder(order: Order) {
    let revenueUSDT = 0;
    if (order.fills) {
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
    }
    return revenueUSDT;
  }

  // Simplified trend confirmation that checks whether distance (fast - slow) keeps expanding
  // confirmationCandles: số nến dùng để so sánh (ví dụ 2 => dùng 3 giá trị: prev-prev, prev, last)
  private isTrendConfirmedSimple(
    emaFastArr: number[],
    emaSlowArr: number[],
    confirmationCandles: number,
    isBullish: boolean,
  ) {
    if (
      emaFastArr.length < confirmationCandles + 1 ||
      emaSlowArr.length < confirmationCandles + 1
    )
      return false;

    const fastSlice = emaFastArr.slice(-confirmationCandles - 1);
    const slowSlice = emaSlowArr.slice(-confirmationCandles - 1);

    const distances = fastSlice.map((v, i) => v - slowSlice[i]);
    const last = distances[distances.length - 1];
    // const prev = distances[distances.length - 2];

    // phải cùng phía
    if (isBullish && last <= 0) return false;
    if (!isBullish && last >= 0) return false;

    // yêu cầu khoảng cách tối thiểu
    const minDistance =
      Math.abs(slowSlice[slowSlice.length - 1]) * this.minDistancePct;
    if (Math.abs(last) < minDistance) return false;

    // kiểm tra mở rộng tổng thể: tính slope đơn giản (last - first)
    const first = distances[0];
    const expansion = isBullish ? last - first : first - last; // phải dương để coi là mở rộng
    // cho phép một tolerance nhỏ vì EMA có thể rung
    const tolerance = Math.abs(first) * this.distanceTolerancePct;

    return expansion > -tolerance; // nếu expansion âm nhiều hơn tolerance => reject
  }
}
