import { EMA, MACD, RSI } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { IStrategy } from './strategy.interface';
import { BinanceService } from 'src/modules/binance/binance.service';
import { Candle, Order } from 'binance-api-node';
import { TradeEvent } from '../events/trade.event';
import Decimal from 'decimal.js';
import { randomUUID } from 'crypto';

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

  private emaShortPeriod = 12;
  private emaLongPeriod = 26;
  private macdFastPeriod = 12;
  private macdSlowPeriod = 26;
  private macdSignalPeriod = 9;

  private rsiPeriod = 14;
  private rsiOverbought = 70;
  private rsiOversold = 30;

  // === Settings for sideway trading ===
  private maxBuyPrice = 1010;
  private rebuyDropPct = 1;

  // Quản lý nhiều vị thế
  private positions: Position[] = [];
  private maxPositions = 4;
  private tradePerBuyUsd = 10; // mỗi lần mua 10$

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
    private readonly emitEvent?: (event: TradeEvent) => void,
  ) {}

  async start() {
    this.logger.log(`Starting EMA+MACD spot strategy for ${this.symbol}`);
    let currentTrend: 'up' | 'down' | 'neutral' = 'neutral';

    const historicalCandles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      '5m',
      120,
    );
    this.prices = historicalCandles.map((c) => Number(c.close));
    this.running = true;

    const lastCandles: Candle[] = [];

    this.binanceService.subscribeCandles(this.symbol, '5m', (trade) => {
      lastCandles.push(trade);

      if (lastCandles.length > 3) lastCandles.shift();

      const price = Number(trade.close);
      this.prices.push(price);

      const result = this.binanceService.detectReversalCandle(
        lastCandles[lastCandles.length - 1],
        lastCandles[lastCandles.length - 2],
        lastCandles[lastCandles.length - 3],
      );

      console.log('analysis: ', result);

      currentTrend = result.trend;
      if (this.prices.length > 120) this.prices.shift();

      this.calcPrice(currentTrend);
    });

    // const marketTrend = await this.binanceService.detectMarketTrend('BTCUSDT', {
    //   candleInterval: '5m',
    //   lookback: 96,
    //   emaPeriod: 26,
    //   atrPeriod: 14,
    //   sidewayThresholdPct: 2,
    //   slopeThresholdPct: 0.2,
    // });

    // console.log('Market trend:', marketTrend); // UPTREND | DOWNTREND | SIDEWAY
  }

  async calcPrice(currentTrend: 'up' | 'down' | 'neutral') {
    try {
      const price = await this.binanceService.getPrice(this.symbol);
      if (
        !price ||
        this.prices.length <
          Math.max(
            this.emaLongPeriod,
            this.macdSlowPeriod + this.macdSignalPeriod,
          )
      ) {
        return;
      }

      const rsiValues = RSI.calculate({
        values: this.prices,
        period: this.rsiPeriod,
      });
      const lastRsi = rsiValues[rsiValues.length - 1];
      if (!lastRsi) return;

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

      const trendUp = lastEmaShort > lastEmaLong;
      const trendDown = lastEmaShort < lastEmaLong;

      const macdResult = MACD.calculate({
        values: this.prices,
        fastPeriod: this.macdFastPeriod,
        slowPeriod: this.macdSlowPeriod,
        signalPeriod: this.macdSignalPeriod,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      const lastMacd = macdResult[macdResult.length - 1];
      if (!lastMacd || !lastMacd.MACD || !lastMacd.signal) return;

      // === BUY logic ===
      if (
        this.positions.length < this.maxPositions &&
        trendUp &&
        lastMacd.MACD > lastMacd.signal &&
        lastRsi < this.rsiOversold &&
        currentTrend === 'up' &&
        price < this.maxBuyPrice &&
        (this.positions.length === 0 ||
          price <
            Math.min(...this.positions.map((p) => p.buyPrice)) *
              (1 - this.rebuyDropPct / 100))
      ) {
        const qty = this.usdToQty(price, this.tradePerBuyUsd);
        if (qty > 0) {
          console.log('----------------');
          console.log(`BUY ${qty} ${this.symbol} @ ${price}`);
          const order = await this.binanceService.placeMarketOrder(
            this.symbol,
            'BUY',
            qty,
          );
          console.log('----------------');

          this.positions.push({
            id: randomUUID(),
            buyPrice: price,
            qty,
            usdSpent: await this.getFeeFromOrder(order),
          });

          // this.emitEvent?.({
          //   side: 'BUY',
          //   symbol: this.symbol,
          //   price,
          //   qty,
          //   timestamp: Date.now(),
          //   strategy: 'EmaMacdStrategy',
          // });
        }
      }

      // === SELL logic (theo từng position) ===
      else if (
        trendDown &&
        lastMacd.MACD < lastMacd.signal &&
        lastRsi > this.rsiOverbought &&
        this.positions.length > 0
      ) {
        const balances = await this.binanceService.getAccount();
        const asset = this.symbol.replace('USDT', '');
        const free = Number(
          balances.balances.find((b) => b.asset === asset)?.free || 0,
        );

        const sellable = this.positions.filter(
          (pos) => price > pos.buyPrice * 1.005,
        );

        // Tính tổng qty cần bán
        const totalQty = sellable.reduce(
          (sum, pos) => sum.plus(new Decimal(pos.qty)),
          new Decimal(0),
        );

        if (totalQty.lessThanOrEqualTo(0)) return;

        if (totalQty.lessThanOrEqualTo(free)) {
          // === Tính lãi/lỗ ===
          // Cộng dồn vào cumulativeProfit

          const order = await this.binanceService.placeMarketOrder(
            this.symbol,
            'SELL',
            totalQty.toNumber(),
          );

          const currentProfit = await this.getRevenueFromSellOrder(order);
          this.cumulativeProfit += currentProfit;

          console.log('--------------------------');
          console.log(
            `SELL ${totalQty.toNumber()} ${asset} @ ${price}, Tổng lãi / lỗ: ${this.cumulativeProfit}USDT`,
          );
          console.log(
            `PROFIT THIS SELL: ${currentProfit.toFixed(4)} USDT | CUMULATIVE PROFIT: ${this.cumulativeProfit.toFixed(4)} USDT`,
          );
          console.log('--------------------------');

          // this.emitEvent?.({
          //   side: 'SELL',
          //   symbol: this.symbol,
          //   price,
          //   qty: free,
          //   timestamp: Date.now(),
          //   strategy: '',
          // });

          // Xoá các position đã bán
          const soldIds = new Set(sellable.map((item) => item.id));
          this.positions = this.positions.filter((pos) => !soldIds.has(pos.id));
        }
      }
    } catch (err) {
      this.logger.error('Strategy error: ' + JSON.stringify(err));
    }
  }

  stop() {
    this.running = false;
    this.logger.log(`Stopped EMA+MACD strategy for ${this.symbol}`);
  }

  private usdToQty(price: number, usd: number) {
    return Math.floor((usd / price) * 1e6) / 1e6;
  }

  private async getFeeFromOrder(order: Order) {
    let totalFeeUSDT = 0;

    if (order.fills) {
      for (const fill of order.fills) {
        const commission = parseFloat(fill.commission);
        const asset = fill.commissionAsset;

        if (asset === 'USDT') {
          totalFeeUSDT += commission;
        } else if (asset === this.symbol.replace('USDT', '')) {
          // phí cùng loại với đồng trade (vd: BTC trong BTCUSDT)
          totalFeeUSDT += commission * parseFloat(fill.price);
        } else {
          // phí bằng đồng khác (vd: BNB)
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
        const fillQty = parseFloat(fill.qty);
        const fillPrice = parseFloat(fill.price);
        const gross = fillQty * fillPrice;

        // Trừ fee
        let feeUSDT = 0;
        const commission = parseFloat(fill.commission);
        const asset = fill.commissionAsset;

        if (asset === 'USDT') {
          feeUSDT = commission;
        } else if (asset === this.symbol.replace('USDT', '')) {
          feeUSDT = commission * fillPrice;
        } else {
          const assetPrice = await this.binanceService.getPrice(`${asset}USDT`);
          feeUSDT = commission * assetPrice;
        }

        revenueUSDT += gross - feeUSDT;
      }
    }

    return revenueUSDT;
  }
}
