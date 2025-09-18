import { EMA, MACD, RSI } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { IStrategy } from './strategy.interface';
import { BinanceService } from 'src/modules/binance/binance.service';
import { StrategyEvent, StrategyEventType } from '../events/strategy.event';
import { Candle } from 'binance-api-node';

export class EmaMacdStrategy implements IStrategy {
  private logger = new Logger('EmaMacdStrategy');
  private prices: number[] = [];
  private running = false;
  private hasPosition = false; // Spot: true = đang giữ coin, false = không giữ

  private emaShortPeriod = 12;
  private emaLongPeriod = 26;
  private macdFastPeriod = 12;
  private macdSlowPeriod = 26;
  private macdSignalPeriod = 9;

  // RSI

  private rsiPeriod = 14; // thường dùng 14 candle
  private rsiOverbought = 70;
  private rsiOversold = 30;

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
    private readonly tradeUsd: number,
    private readonly emitEvent?: (event: StrategyEvent) => void,
  ) {}

  async start() {
    this.logger.log(`Starting EMA+MACD spot strategy for ${this.symbol}`);

    let currentTrend: 'up' | 'down' | 'neutral' = 'neutral';

    // 1. Lấy nến lịch sử 15 phút trước khi subscribe
    const historicalCandles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      '15m',
      192,
    );
    this.prices = historicalCandles.map((c) => Number(c.close));

    this.running = true;

    const lastCandles: Candle[] = [];

    // Subscribe trade stream
    this.binanceService.subscribeCandles(this.symbol, '1m', (trade) => {
      lastCandles.push(trade);
      if (lastCandles.length > 3) {
        lastCandles.shift();
      }

      const price = Number(trade.close);
      this.prices.push(price);

      const result = this.binanceService.detectReversalCandle(
        lastCandles[lastCandles.length - 1],
        lastCandles[lastCandles.length - 2],
        lastCandles[lastCandles.length - 3],
      );

      currentTrend = result.trend;

      console.log('result', result);
      if (this.prices.length > 500) this.prices.shift();

      this.calcPrice(currentTrend);
    });

    const marketTrend = await this.binanceService.detectMarketTrend('BTCUSDT', {
      candleInterval: '30m',
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

      console.log('price', price);
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

      // Tính RSI
      const rsiValues = RSI.calculate({
        values: this.prices,
        period: this.rsiPeriod,
      });
      const lastRsi = rsiValues[rsiValues.length - 1];
      if (!lastRsi) {
        return;
      }

      console.log('lastRsi', lastRsi);

      // EMA
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

      console.log('trendUp', trendUp);
      console.log('trendDown', trendDown);

      // MACD
      const macdResult = MACD.calculate({
        values: this.prices,
        fastPeriod: this.macdFastPeriod,
        slowPeriod: this.macdSlowPeriod,
        signalPeriod: this.macdSignalPeriod,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      const lastMacd = macdResult[macdResult.length - 1];
      if (!lastMacd || !lastMacd.MACD || !lastMacd.signal) {
        return;
      }

      console.log('lastMacd', lastMacd);

      // ==== Trading logic cho Spot ====
      if (
        trendUp &&
        lastMacd.MACD > lastMacd.signal &&
        lastRsi < this.rsiOversold &&
        currentTrend &&
        currentTrend === ('up' as any) &&
        !this.hasPosition
      ) {
        // BUY
        const qty = this.usdToQty(price);
        if (qty > 0) {
          this.logger.log(`BUY ${qty} ${this.symbol} @ ${price}`);
          await this.binanceService.placeMarketOrder(this.symbol, 'BUY', qty);
          this.hasPosition = true;
          this.emitEvent?.({
            type: StrategyEventType.BUY,
            symbol: this.symbol,
            price,
            qty,
            time: Date.now(),
          });
        }
      } else if (
        trendDown &&
        lastMacd.MACD < lastMacd.signal &&
        lastRsi > this.rsiOverbought &&
        lastMacd.signal &&
        this.hasPosition
      ) {
        // SELL: lấy số coin thực tế trong ví
        const balances = await this.binanceService.getAccount();
        const asset = this.symbol.replace('USDT', ''); // BTCUSDT -> BTC
        const free = Number(
          balances.balances.find((b) => b.asset === asset)?.free || 0,
        );

        if (free > 0) {
          this.logger.log(`SELL ${free} ${asset} @ ${price}`);
          await this.binanceService.placeMarketOrder(this.symbol, 'SELL', free);
          this.hasPosition = false;
          this.emitEvent?.({
            type: StrategyEventType.SELL,
            symbol: this.symbol,
            price,
            qty: free,
            time: Date.now(),
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
