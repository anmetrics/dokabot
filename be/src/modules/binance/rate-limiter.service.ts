import { Injectable, Logger } from '@nestjs/common';

/**
 * Rate Limiter Service - Quản lý Binance API rate limits
 *
 * Binance Rate Limits:
 * - Order Rate: 50 orders/10s (Spot), 300 orders/10s (Futures)
 * - Request Weight: 6000 weight/minute
 * - Raw Requests: 61,000 requests/5 minutes
 *
 * Design:
 * - Token Bucket Algorithm
 * - Per-endpoint rate limiting
 * - Automatic retry with exponential backoff
 */
@Injectable()
export class RateLimiterService {
  private logger = new Logger('RateLimiterService');

  // Token buckets for different rate limits
  private orderTokens = {
    spot: { tokens: 50, maxTokens: 50, refillRate: 5, lastRefill: Date.now() }, // 50 orders/10s = 5 orders/s
    futures: { tokens: 300, maxTokens: 300, refillRate: 30, lastRefill: Date.now() }, // 300 orders/10s = 30 orders/s
  };

  private weightTokens = {
    tokens: 6000,
    maxTokens: 6000,
    refillRate: 100, // 6000 weight/60s = 100 weight/s
    lastRefill: Date.now(),
  };

  private rawRequestTokens = {
    tokens: 61000,
    maxTokens: 61000,
    refillRate: 203, // 61000 requests/300s ≈ 203 requests/s
    lastRefill: Date.now(),
  };

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(bucket: {
    tokens: number;
    maxTokens: number;
    refillRate: number;
    lastRefill: number;
  }) {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds

    const tokensToAdd = elapsed * bucket.refillRate;
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Try to consume tokens from a bucket
   * Returns true if successful, false if rate limited
   */
  private tryConsume(
    bucket: {
      tokens: number;
      maxTokens: number;
      refillRate: number;
      lastRefill: number;
    },
    amount: number,
  ): boolean {
    this.refillTokens(bucket);

    if (bucket.tokens >= amount) {
      bucket.tokens -= amount;
      return true;
    }

    return false;
  }

  /**
   * Wait until tokens are available
   */
  private async waitForTokens(
    bucket: {
      tokens: number;
      maxTokens: number;
      refillRate: number;
      lastRefill: number;
    },
    amount: number,
  ): Promise<void> {
    this.refillTokens(bucket);

    if (bucket.tokens >= amount) {
      bucket.tokens -= amount;
      return;
    }

    // Calculate wait time
    const deficit = amount - bucket.tokens;
    const waitMs = (deficit / bucket.refillRate) * 1000;

    this.logger.warn(`Rate limited. Waiting ${waitMs.toFixed(0)}ms...`);

    await new Promise((resolve) => setTimeout(resolve, waitMs));

    // Try again after waiting
    return this.waitForTokens(bucket, amount);
  }

  /**
   * Check if we can place an order (Spot)
   */
  async canPlaceSpotOrder(wait = true): Promise<boolean> {
    if (wait) {
      await this.waitForTokens(this.orderTokens.spot, 1);
      return true;
    }

    return this.tryConsume(this.orderTokens.spot, 1);
  }

  /**
   * Check if we can place an order (Futures)
   */
  async canPlaceFuturesOrder(wait = true): Promise<boolean> {
    if (wait) {
      await this.waitForTokens(this.orderTokens.futures, 1);
      return true;
    }

    return this.tryConsume(this.orderTokens.futures, 1);
  }

  /**
   * Check if we have enough request weight
   * @param weight - Request weight (default 1)
   */
  async checkWeight(weight = 1, wait = true): Promise<boolean> {
    if (wait) {
      await this.waitForTokens(this.weightTokens, weight);
      return true;
    }

    return this.tryConsume(this.weightTokens, weight);
  }

  /**
   * Check if we can make a raw request
   */
  async checkRawRequest(wait = true): Promise<boolean> {
    if (wait) {
      await this.waitForTokens(this.rawRequestTokens, 1);
      return true;
    }

    return this.tryConsume(this.rawRequestTokens, 1);
  }

  /**
   * Execute function with rate limiting
   */
  async executeWithRateLimit<T>(
    fn: () => Promise<T>,
    options: {
      type: 'spot' | 'futures' | 'weight' | 'raw';
      weight?: number;
    },
  ): Promise<T> {
    // Check rate limit
    switch (options.type) {
      case 'spot':
        await this.canPlaceSpotOrder(true);
        break;
      case 'futures':
        await this.canPlaceFuturesOrder(true);
        break;
      case 'weight':
        await this.checkWeight(options.weight || 1, true);
        break;
      case 'raw':
        await this.checkRawRequest(true);
        break;
    }

    // Execute function
    try {
      return await fn();
    } catch (error: any) {
      // Handle Binance rate limit errors
      if (this.isBinanceRateLimitError(error)) {
        this.logger.error('Binance rate limit hit:', error.message);

        // Extract retry-after header if available
        const retryAfterMs = error.response?.headers?.['retry-after'] || 60000;

        this.logger.warn(`Waiting ${retryAfterMs}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs));

        // Retry once
        return await fn();
      }

      throw error;
    }
  }

  /**
   * Check if error is Binance rate limit error
   */
  private isBinanceRateLimitError(error: any): boolean {
    if (!error.code) return false;

    // Binance rate limit error codes
    const rateLimitCodes = [
      -1003, // TOO_MANY_REQUESTS
      -1015, // TOO_MANY_ORDERS
      429, // HTTP 429
    ];

    return rateLimitCodes.includes(error.code);
  }

  /**
   * Get current rate limit status
   */
  getStatus() {
    // Refill all buckets first
    this.refillTokens(this.orderTokens.spot);
    this.refillTokens(this.orderTokens.futures);
    this.refillTokens(this.weightTokens);
    this.refillTokens(this.rawRequestTokens);

    return {
      spotOrders: {
        available: Math.floor(this.orderTokens.spot.tokens),
        max: this.orderTokens.spot.maxTokens,
        percentage: (this.orderTokens.spot.tokens / this.orderTokens.spot.maxTokens) * 100,
      },
      futuresOrders: {
        available: Math.floor(this.orderTokens.futures.tokens),
        max: this.orderTokens.futures.maxTokens,
        percentage: (this.orderTokens.futures.tokens / this.orderTokens.futures.maxTokens) * 100,
      },
      weight: {
        available: Math.floor(this.weightTokens.tokens),
        max: this.weightTokens.maxTokens,
        percentage: (this.weightTokens.tokens / this.weightTokens.maxTokens) * 100,
      },
      rawRequests: {
        available: Math.floor(this.rawRequestTokens.tokens),
        max: this.rawRequestTokens.maxTokens,
        percentage: (this.rawRequestTokens.tokens / this.rawRequestTokens.maxTokens) * 100,
      },
    };
  }

  /**
   * Reset rate limiter (for testing or emergency)
   */
  reset() {
    this.orderTokens.spot.tokens = this.orderTokens.spot.maxTokens;
    this.orderTokens.futures.tokens = this.orderTokens.futures.maxTokens;
    this.weightTokens.tokens = this.weightTokens.maxTokens;
    this.rawRequestTokens.tokens = this.rawRequestTokens.maxTokens;

    this.logger.log('Rate limiter reset');
  }
}
