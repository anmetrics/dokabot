import { EMA, MACD, RSI } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { IStrategy } from './strategy.interface';
import { BinanceService } from 'src/modules/binance/binance.service';
import { Candle } from 'binance-api-node';
import { TradeEvent } from '../events/trade.event';

export class EmaMacdStrategy implements IStrategy {
  private logger = new Logger('EmaMacdStrategy');
  private prices: number[] = [];
  private running = false;
  private hasPosition = false;

  private emaShortPeriod = 12;
  private emaLongPeriod = 26;
  private macdFastPeriod = 12;
  private macdSlowPeriod = 26;
  private macdSignalPeriod = 9;

  private rsiPeriod = 14;
  private rsiOverbought = 70;
  private rsiOversold = 30;

  // === Settings for sideway trading ===
  private maxBuyPrice = 30000; // Chỉ mua nếu giá < 30,000
  private minSellPrice = 31000; // Chỉ bán nếu giá > 31,000
  private rebuyDropPct = 1.5; // Mua lần 2 nếu giá giảm > 1.5% so với lần mua 1

  private lastBuyPrice: number | null = null;

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
    private readonly tradeUsd: number,
    private readonly emitEvent?: (event: TradeEvent) => void,
  ) {}

  async start() {
    this.logger.log(`Starting EMA+MACD spot strategy for ${this.symbol}`);
    let currentTrend: 'up' | 'down' | 'neutral' = 'neutral';

    const historicalCandles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      '5m',
      192,
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
      if (this.prices.length > 240) this.prices.shift();

      this.calcPrice(currentTrend);
    });

    const marketTrend = await this.binanceService.detectMarketTrend('BTCUSDT', {
      candleInterval: '5m',
      lookback: 96,
      emaPeriod: 26,
      atrPeriod: 14,
      sidewayThresholdPct: 2,
      slopeThresholdPct: 0.2,
    });

    console.log('Market trend:', marketTrend); // UPTREND | DOWNTREND | SIDEWAY
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

      console.log('TREND: ', trendUp ? 'Up' : trendDown ? 'DOWN' : 'UNKNOWN');

      console.log('RSI: ', lastRsi);

      console.log('lastMacd: ', lastMacd);

      // === BUY logic ===
      if (
        trendUp &&
        lastMacd.MACD > lastMacd.signal &&
        lastRsi < this.rsiOversold &&
        currentTrend === 'up' &&
        !this.hasPosition &&
        price < this.maxBuyPrice &&
        (this.lastBuyPrice === null ||
          price < this.lastBuyPrice * (1 - this.rebuyDropPct / 100))
      ) {
        const qty = this.usdToQty(price);
        if (qty > 0) {
          this.logger.log(`BUY ${qty} ${this.symbol} @ ${price}`);
          // await this.binanceService.placeMarketOrder(this.symbol, 'BUY', qty);
          this.hasPosition = true;
          this.lastBuyPrice = price;

          this.emitEvent?.({
            side: 'BUY',
            symbol: this.symbol,
            price,
            qty,
            timestamp: Date.now(),
            strategy: '',
          });
        }
      }

      // === SELL logic ===
      else if (
        trendDown &&
        lastMacd.MACD < lastMacd.signal &&
        lastRsi > this.rsiOverbought &&
        this.hasPosition &&
        price > this.minSellPrice
      ) {
        const balances = await this.binanceService.getAccount();
        const asset = this.symbol.replace('USDT', '');
        const free = Number(
          balances.balances.find((b) => b.asset === asset)?.free || 0,
        );

        if (free > 0) {
          this.logger.log(`SELL ${free} ${asset} @ ${price}`);
          // await this.binanceService.placeMarketOrder(this.symbol, 'SELL', free);
          this.hasPosition = false;
          this.lastBuyPrice = null;

          this.emitEvent?.({
            side: 'SELL',
            symbol: this.symbol,
            price,
            qty: free,
            timestamp: Date.now(),
            strategy: '',
          });
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

  private usdToQty(price: number) {
    return Math.floor((this.tradeUsd / price) * 1e6) / 1e6;
  }

  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }
}
