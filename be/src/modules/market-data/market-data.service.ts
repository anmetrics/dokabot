import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

/**
 * Market Data Service - SHARED cho tất cả users
 *
 * Design pattern từ Cryptohopper, 3Commas:
 * - 1 WebSocket connection cho market data
 * - Broadcast data đến tất cả users đang subscribe
 * - Không cần riêng connection cho mỗi user
 *
 * Benefits:
 * - Giảm số WebSocket connections
 * - Không bị rate limit
 * - Scale tốt cho 100-1000 users
 */
@Injectable()
export class MarketDataService implements OnModuleInit {
  private logger = new Logger('MarketDataService');

  // Cache latest prices
  private latestPrices: Map<string, PriceUpdate> = new Map();

  // Track which symbols are being subscribed
  private activeSymbols: Set<string> = new Set();

  // Cleanup functions
  private cleanupFns: Map<string, () => void> = new Map();

  constructor(
    private readonly binanceService: BinanceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    // Subscribe to common symbols on startup
    const defaultSymbols = ['BTCUSDT', 'BNBUSDT', 'SOLUSDT', 'ETHUSDT'];

    for (const symbol of defaultSymbols) {
      await this.subscribeSymbol(symbol);
    }

    this.logger.log(`📊 Market Data Service initialized with ${defaultSymbols.length} symbols`);
  }

  /**
   * Subscribe to a symbol's market data
   * Multiple users can subscribe to same symbol - only 1 WebSocket connection
   */
  async subscribeSymbol(symbol: string): Promise<void> {
    // Already subscribed? Just return
    if (this.activeSymbols.has(symbol)) {
      this.logger.debug(`Symbol ${symbol} already subscribed`);
      return;
    }

    this.logger.log(`📈 Subscribing to ${symbol} market data`);

    // Subscribe to aggTrades (price updates)
    const unsubscribe = this.binanceService.subscribeAggTrades(
      symbol,
      (trade) => {
        const priceUpdate: PriceUpdate = {
          symbol,
          price: parseFloat(trade.price),
          timestamp: trade.eventTime,
        };

        // Cache latest price
        this.latestPrices.set(symbol, priceUpdate);

        // Emit event - all users listening will receive this
        this.eventEmitter.emit('market.price.update', priceUpdate);

        // Debug log (only occasionally to avoid spam)
        if (Math.random() < 0.01) { // 1% của updates
          this.logger.debug(`${symbol}: $${priceUpdate.price}`);
        }
      },
    );

    this.activeSymbols.add(symbol);
    this.cleanupFns.set(symbol, unsubscribe);

    this.logger.log(`✅ Subscribed to ${symbol}`);
  }

  /**
   * Unsubscribe from a symbol
   * (only when NO users need it anymore)
   */
  unsubscribeSymbol(symbol: string): void {
    const cleanup = this.cleanupFns.get(symbol);
    if (cleanup) {
      cleanup();
      this.activeSymbols.delete(symbol);
      this.cleanupFns.delete(symbol);
      this.logger.log(`🗑️ Unsubscribed from ${symbol}`);
    }
  }

  /**
   * Get latest price for a symbol (cached)
   */
  getLatestPrice(symbol: string): number | null {
    const update = this.latestPrices.get(symbol);
    return update ? update.price : null;
  }

  /**
   * Get all latest prices
   */
  getAllPrices(): Map<string, number> {
    const prices = new Map<string, number>();
    this.latestPrices.forEach((update, symbol) => {
      prices.set(symbol, update.price);
    });
    return prices;
  }

  /**
   * Get active symbols
   */
  getActiveSymbols(): string[] {
    return Array.from(this.activeSymbols);
  }

  /**
   * Subscribe to price updates via EventEmitter
   * Example: this.marketData.onPriceUpdate((update) => { ... })
   */
  onPriceUpdate(callback: (update: PriceUpdate) => void): void {
    this.eventEmitter.on('market.price.update', callback);
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy() {
    this.cleanupFns.forEach((cleanup) => cleanup());
    this.logger.log('📊 Market Data Service stopped');
  }
}
