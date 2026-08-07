import { RateLimiterService } from './rate-limiter.service';

describe('RateLimiterService', () => {
  const config = { capacity: 3, refillPerSecond: 100 };
  let limiter: RateLimiterService;

  beforeEach(() => {
    limiter = new RateLimiterService();
  });

  it('lets a burst through up to the bucket capacity', async () => {
    const started = Date.now();
    for (let i = 0; i < config.capacity; i++) {
      await limiter.consume('key', config);
    }
    expect(Date.now() - started).toBeLessThan(20);
  });

  it('throttles once the bucket is empty', async () => {
    for (let i = 0; i < config.capacity; i++) {
      await limiter.consume('key', config);
    }

    const started = Date.now();
    // 2 tokens at 100/s ⇒ roughly 20ms of waiting.
    await limiter.consume('key', config, 2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(10);
  });

  it('keeps buckets independent per key', async () => {
    for (let i = 0; i < config.capacity; i++) {
      await limiter.consume('a', config);
    }

    const started = Date.now();
    await limiter.consume('b', config);
    expect(Date.now() - started).toBeLessThan(20);
  });
});
