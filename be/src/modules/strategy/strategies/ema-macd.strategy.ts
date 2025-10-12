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

export class EmaMacdStrategy implements IStrategy {
  private logger = new Logger('EmaMacdStrategy');
  private prices: number[] = [];
  private running = false;

  private cumulativeProfit = 0;

  // === EMA + MACD + RSI (Short-term swing) ===
  private emaShortPeriod = 5;
  private emaLongPeriod = 10;
  private macdFastPeriod = 4;
  private macdSlowPeriod = 12;
  private macdSignalPeriod = 4;

  private rsiPeriod = 6;
  private rsiOverbought = 65;
  private rsiOversold = 35;

  // === Settings for sideway trading ===
  private maxBuyPrice = 1250;
  private rebuyDropPct = 0.98;
  private tradePerBuyUsd = 20;

  // Quản lý nhiều vị thế
  private positions: Position[] = [];
  private maxPositions = 5;

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
    private readonly emitEvent?: (event: TradeEvent) => void,
  ) {
    this.positions = loadPositions();
    console.log(
      'CURRENT_POSITION:',
      this.positions,
      'length: ',
      this.positions.length,
    );
  }

  async start() {
    this.logger.log(`Starting EMA+MACD spot strategy for ${this.symbol}`);

    const historicalCandles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      '1m',
      40,
    );
    this.prices = historicalCandles.map((c) => Number(c.close));
    console.log('prices', this.prices[this.prices.length - 1]);
    this.running = true;

    const lastCandles: Candle[] = [];

    this.binanceService.subscribeCandles(this.symbol, '1m', (trade) => {
      lastCandles.push(trade);
      if (lastCandles.length > 3) lastCandles.shift();

      const price = Number(trade.close);
      this.prices.push(price);
      if (this.prices.length > 40) this.prices.shift();

      this.calcPrice(lastCandles);
    });
  }

  async calcPrice(lastCandles: Candle[]) {
    try {
      const price = await this.binanceService.getPrice(this.symbol);
      if (
        !price ||
        this.prices.length <
          Math.max(
            this.emaLongPeriod,
            this.macdSlowPeriod + this.macdSignalPeriod,
          )
      )
        return;

      // === RSI ===
      const rsiValues = RSI.calculate({
        values: this.prices,
        period: this.rsiPeriod,
      });
      const lastRsi = rsiValues[rsiValues.length - 1];
      if (!lastRsi) return;
      const prevRsi = rsiValues[rsiValues.length - 2];
      const rsiRising = lastRsi > prevRsi && lastRsi < this.rsiOversold;

      // === EMA ===
      const emaShort = EMA.calculate({
        period: this.emaShortPeriod,
        values: this.prices,
      });
      const emaLong = EMA.calculate({
        period: this.emaLongPeriod,
        values: this.prices,
      });
      const lastEmaShort = emaShort[emaShort.length - 1];
      const lastEmaLong = emaLong[emaLong.length - 1];
      const trendDown = lastEmaShort < lastEmaLong;

      // === MACD ===
      const macdResult = MACD.calculate({
        values: this.prices,
        fastPeriod: this.macdFastPeriod,
        slowPeriod: this.macdSlowPeriod,
        signalPeriod: this.macdSignalPeriod,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      const lastMacd = macdResult[macdResult.length - 1];
      if (
        !lastMacd ||
        lastMacd.MACD === undefined ||
        lastMacd.signal === undefined
      )
        return;
      const prevMacd =
        macdResult.length >= 2 ? macdResult[macdResult.length - 2] : undefined;
      if (!prevMacd?.MACD) return;
      const macdPeaking =
        lastMacd.MACD < prevMacd.MACD && lastMacd.MACD > lastMacd.signal;

      if (lastCandles.length < 3) return;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, c2, c3] = lastCandles.slice(-3);

      // === Bullish Engulfing nhạy hơn ===
      const isBullishEngulfing =
        Number(c2.close) < Number(c2.open) &&
        Number(c3.close) > Number(c2.open);
      const volumeSpike =
        Number(c3.volume) >
        Number(lastCandles[lastCandles.length - 2].volume) * 1.15;

      // === Check Buy ===
      const isValidBuy =
        this.positions.length < this.maxPositions &&
        isBullishEngulfing &&
        rsiRising &&
        volumeSpike &&
        lastRsi < this.rsiOversold &&
        lastRsi > prevRsi &&
        price < this.maxBuyPrice &&
        (this.positions.length === 0 ||
          price <
            Math.min(...this.positions.map((p) => p.buyPrice)) *
              (1 - this.rebuyDropPct / 100));

      // === Check Sell ===
      const isValidSell =
        (trendDown || macdPeaking) &&
        lastMacd.MACD < lastMacd.signal &&
        lastRsi > this.rsiOverbought &&
        this.positions.length > 0;

      console.log(
        '\x1b[33m%s\x1b[0m',
        '=============================',
        formatDate(new Date()),
      );

      console.log('Current RSI       :', lastRsi.toFixed(2));

      console.log('\x1b[32m%s\x1b[0m', '===== BUY CHECK =====');
      console.log('Bullish Engulfing :', isBullishEngulfing);
      console.log('RSI Rising/Oversold:', rsiRising);
      console.log('Volume Spike      :', volumeSpike);
      console.log('=> IS VALID BUY   :', isValidBuy);

      console.log('\x1b[31m%s\x1b[0m', '===== SELL CHECK =====');
      console.log('Trend Down        :', trendDown);
      console.log('MACD Bearish      :', lastMacd.MACD < lastMacd.signal);
      console.log('RSI > Overbought  :', lastRsi > this.rsiOverbought);
      console.log('Has Position      :', this.positions.length > 0);
      console.log('=> IS VALID SELL  :', isValidSell);

      // === Execute Buy ===
      if (isValidBuy) {
        const qty = this.usdToQty(price, this.tradePerBuyUsd);
        if (qty > 0) {
          console.log(`BUY ${qty} ${this.symbol} @ ${price}`);
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

        if (totalQty.lessThanOrEqualTo(0)) return;
        if (totalQty.lessThanOrEqualTo(free)) {
          const order = await this.binanceService.placeMarketOrder(
            this.symbol,
            'SELL',
            this.adjustToStepSize(totalQty.toNumber()),
          );
          const revenue = await this.getRevenueFromSellOrder(order);
          const currentProfit = revenue - totalUsdSpent;
          this.cumulativeProfit += currentProfit;

          console.log(
            `SELL ${totalQty.toNumber()} ${asset} @ ${price}, Profit: ${currentProfit.toFixed(4)} USDT, Cumulative: ${this.cumulativeProfit.toFixed(4)} USDT`,
          );

          const soldIds = new Set(sellable.map((item) => item.id));
          this.positions = this.positions.filter((pos) => !soldIds.has(pos.id));
          savePositions(this.positions);
        }
      }
    } catch (err) {
      console.log('Strategy error: ' + err);
    }
  }

  stop() {
    this.running = false;
    this.logger.log(`Stopped EMA+MACD strategy for ${this.symbol}`);
  }

  private adjustToStepSize(qty: number, stepSize = 0.001) {
    const adjusted = Math.floor(qty / stepSize) * stepSize;
    return parseFloat(adjusted.toFixed(3));
  }

  private usdToQty(price: number, usd: number) {
    return this.adjustToStepSize(usd / price, 0.001);
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
}
