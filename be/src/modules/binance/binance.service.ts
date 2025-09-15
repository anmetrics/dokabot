import { Injectable, Logger } from '@nestjs/common';
import Binance, { CandleChartInterval_LT, OrderType } from 'binance-api-node';

@Injectable()
export class BinanceService {
  private client: ReturnType<typeof Binance> | null = null;
  private logger = new Logger('BinanceService');

  constructor() {
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
  subscribeCandles(symbol: string, interval = '1m', cb: (candle: any) => void) {
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
}
