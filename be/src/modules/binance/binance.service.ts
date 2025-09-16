import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Binance, {
  Candle,
  CandleChartInterval_LT,
  OrderType,
} from 'binance-api-node';
import { OrderbookEvent } from './events/orderbook.event';
import { MarketTrend } from './binance.enum';
import { ATR, EMA } from 'technicalindicators';

@Injectable()
export class BinanceService {
  private client: ReturnType<typeof Binance> | null = null;
  private logger = new Logger('BinanceService');

  constructor(private eventEmitter: EventEmitter2) {
    this.init();
  }

  init() {
    const apiKey = process.env.BINANCE_API_KEY || '';
    const apiSecret = process.env.BINANCE_API_SECRET || '';
    const useTestnet = !!process.env.BINANCE_TESTNET;

    this.client = Binance({
      apiKey,
      apiSecret,
      httpBase: useTestnet ? 'https://testnet.binance.vision' : undefined,
      wsBase: useTestnet ? 'wss://testnet.binance.vision' : undefined,
    });

    this.logger.log(
      'Binance client initialized' + (useTestnet ? ' (TESTNET)' : ''),
    );
  }

  // existing methods...
  subscribeAggTrades(symbol: string, cb: (trade: any) => void) {
    if (!this.client) throw new Error('Client not initialized');
    const lowercase = symbol.toLowerCase();
    return this.client.ws.aggTrades(lowercase, cb);
  }

  async getPrice(symbol: string) {
    if (!this.client) throw new Error('Client not initialized');
    const res = await this.client.prices();
    return Number(res[symbol]);
  }

  async placeMarketOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
  ) {
    if (!this.client) throw new Error('Client not initialized');
    try {
      const order = await this.client.order({
        symbol,
        side,
        type: OrderType.MARKET,
        quantity: quantity.toString(),
      });
      this.logger.log(`Order placed: ${JSON.stringify(order)}`);
      return order;
    } catch (err) {
      this.logger.error('Order error: ' + JSON.stringify(err));
      throw err;
    }
  }

  subscribeOrderBook(symbol: string) {
    if (!this.client) throw new Error('Client not initialized');
    this.client.ws.depth(symbol.toLowerCase(), (depth) => {
      this.eventEmitter.emit(OrderbookEvent.UPDATE, depth);
    });
  }

  async getAccount() {
    if (!this.client) throw new Error('Client not initialized');
    return this.client.accountInfo();
  }

  // -------------------------
  // NEW: get historical candles (REST)
  async getHistoricalCandles(
    symbol: string,
    interval: CandleChartInterval_LT = '1m',
    limit = 500,
  ) {
    if (!this.client) throw new Error('Client not initialized');
    // binance-api-node provides client.candles
    // returns array of { openTime, open, high, low, close, volume, closeTime, ...}
    return this.client.candles({ symbol, interval, limit });
  }

  // NEW: subscribe to kline/candles via websocket
  subscribeCandles(
    symbol: string,
    interval = '1m',
    cb: (candle: Candle) => void,
  ) {
    if (!this.client) throw new Error('Client not initialized');
    const lowercase = symbol.toLowerCase();
    const unsub = this.client.ws.candles(lowercase, interval, (candle) => {
      // candle structure from binance-api-node: { isFinal, open, high, low, close, ... }
      // We'll only call cb when candle.isFinal === true to avoid painting on partial bars
      if (candle.isFinal) cb(candle);
    });
    // client.ws.candles returns an unsubscribe function
    return unsub as () => void;
  }

  async detectMarketTrend(
    symbol: string,
    options?: {
      candleInterval?: CandleChartInterval_LT;
      lookback?: number; // số nến dùng để phân tích
      emaPeriod?: number; // EMA dài hạn
      atrPeriod?: number; // ATR period
      sidewayThresholdPct?: number; // biên độ % để coi là sideway
      slopeThresholdPct?: number; // slope EMA tối thiểu để coi trend
    },
  ): Promise<MarketTrend> {
    const candleInterval = options?.candleInterval || '1h';
    const lookback = options?.lookback || 50;
    const emaPeriod = options?.emaPeriod || 26;
    const atrPeriod = options?.atrPeriod || 14;
    const sidewayThresholdPct = options?.sidewayThresholdPct || 2; // 2% biến động = sideway
    const slopeThresholdPct = options?.slopeThresholdPct || 0.2; // EMA slope %

    // 1. Lấy nến lịch sử
    const candles = await this.getHistoricalCandles(
      symbol,
      candleInterval,
      lookback,
    );
    const closes = candles.map((c) => Number(c.close));
    const highs = candles.map((c) => Number(c.high));
    const lows = candles.map((c) => Number(c.low));

    // 2. Tính ATR để đo volatility
    const atrValues = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: atrPeriod,
    });
    const lastAtr = atrValues[atrValues.length - 1];
    const lastClose = closes[closes.length - 1];

    // ATR % so với giá đóng cửa
    const atrPct = (lastAtr / lastClose) * 100;

    // Nếu biến động nhỏ → sideway
    if (atrPct < sidewayThresholdPct) return 'SIDEWAY';

    // 3. EMA dài hạn và slope
    const emaValues = EMA.calculate({ period: emaPeriod, values: closes });
    const lastEma = emaValues[emaValues.length - 1];
    const firstEma = emaValues[0];
    const emaSlopePct = ((lastEma - firstEma) / firstEma) * 100;

    if (Math.abs(emaSlopePct) < slopeThresholdPct) return 'SIDEWAY';
    if (emaSlopePct > 0) return 'UPTREND';
    return 'DOWNTREND';
  }

  detectReversalCandle(candle: Candle, prevCandle?: Candle) {
    if (
      !candle ||
      !candle.open ||
      !candle.close ||
      !candle.high ||
      !candle.low
    ) {
      return [{ name: 'Invalid candle data', trend: 'neutral' }];
    }

    const open = parseFloat(candle.open);
    const close = parseFloat(candle.close);
    const high = parseFloat(candle.high);
    const low = parseFloat(candle.low);

    if ([open, close, high, low].some(isNaN)) {
      return [{ name: 'Invalid candle data', trend: 'neutral' }];
    }

    const body = Math.abs(close - open);
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;
    const results: { name: string; trend: 'up' | 'down' | 'neutral' }[] = [];

    // Hammer & Hanging Man
    if (lowerShadow >= 2 * body && upperShadow <= body) {
      if (close > open)
        results.push({ name: 'Hammer (Bullish Reversal)', trend: 'up' });
      else
        results.push({ name: 'Hanging Man (Bearish Reversal)', trend: 'down' });
    }

    // Inverted Hammer & Shooting Star
    if (upperShadow >= 2 * body && lowerShadow <= body) {
      if (close > open)
        results.push({
          name: 'Inverted Hammer (Bullish Reversal)',
          trend: 'up',
        });
      else
        results.push({
          name: 'Shooting Star (Bearish Reversal)',
          trend: 'down',
        });
    }

    // Doji
    if (body <= (high - low) * 0.1) {
      results.push({ name: 'Doji (Indecision)', trend: 'neutral' });
    }

    // Bullish Engulfing
    if (
      prevCandle &&
      parseFloat(prevCandle.close) < parseFloat(prevCandle.open) &&
      close > open &&
      open < parseFloat(prevCandle.close) &&
      close > parseFloat(prevCandle.open)
    ) {
      results.push({
        name: 'Bullish Engulfing (Bullish Reversal)',
        trend: 'up',
      });
    }

    // Bearish Engulfing
    if (
      prevCandle &&
      parseFloat(prevCandle.close) > parseFloat(prevCandle.open) &&
      close < open &&
      open > parseFloat(prevCandle.close) &&
      close < parseFloat(prevCandle.open)
    ) {
      results.push({
        name: 'Bearish Engulfing (Bearish Reversal)',
        trend: 'down',
      });
    }

    return results.length ? results : [];
  }
}
