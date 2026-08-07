import { Injectable } from '@nestjs/common';

type Bucket = {
  tokens: number;
  lastRefillMs: number;
};

export type BucketConfig = {
  /** Maximum burst. */
  capacity: number;
  /** Tokens replenished per second. */
  refillPerSecond: number;
};

/**
 * Token bucket keyed by (exchange, api key).
 *
 * Exchange request weight — not CPU — is the real ceiling on this platform
 * (docs/ARCHITECTURE.md §4). Shaping traffic here keeps one busy tenant from
 * burning the whole account's budget and getting the key banned.
 *
 * In-process for now; Phase 3 moves this to a Redis-backed bucket shared across
 * execution workers.
 */
@Injectable()
export class RateLimiterService {
  private readonly buckets = new Map<string, Bucket>();

  /** Blocks until a token is available, then consumes `weight` of them. */
  async consume(
    key: string,
    config: BucketConfig,
    weight = 1,
  ): Promise<void> {
    for (;;) {
      const waitMs = this.tryConsume(key, config, weight);
      if (waitMs === 0) return;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  /** Returns 0 when consumed, otherwise the milliseconds to wait before retrying. */
  private tryConsume(key: string, config: BucketConfig, weight: number): number {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? {
      tokens: config.capacity,
      lastRefillMs: now,
    };

    const elapsedSeconds = (now - bucket.lastRefillMs) / 1000;
    bucket.tokens = Math.min(
      config.capacity,
      bucket.tokens + elapsedSeconds * config.refillPerSecond,
    );
    bucket.lastRefillMs = now;

    if (bucket.tokens >= weight) {
      bucket.tokens -= weight;
      this.buckets.set(key, bucket);
      return 0;
    }

    this.buckets.set(key, bucket);
    const deficit = weight - bucket.tokens;
    return Math.ceil((deficit / config.refillPerSecond) * 1000);
  }

  /** Test seam. */
  reset(): void {
    this.buckets.clear();
  }
}
