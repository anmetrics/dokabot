import { BadRequestException } from '@nestjs/common';
import { Candle } from '../exchange/exchange.types';
import { STRATEGY_LIBRARY } from './library';
import { Signal } from './strategy.types';
import { StrategyRegistry } from './strategy-registry.service';

/** Builds a candle series from close prices, with a plausible high/low around each. */
const series = (prices: number[]): Candle[] =>
  prices.map((price, i) => ({
    openTime: i * 60_000,
    open: String(i === 0 ? price : prices[i - 1]),
    high: String(price * 1.002),
    low: String(price * 0.998),
    close: String(price),
    volume: '100',
    closeTime: i * 60_000 + 59_999,
  }));

const rising = (n: number, from = 100, step = 1) =>
  series(Array.from({ length: n }, (_, i) => from + i * step));
const falling = (n: number, from = 300, step = 1) =>
  series(Array.from({ length: n }, (_, i) => from - i * step));
const flat = (n: number, price = 100) => series(new Array(n).fill(price));

describe('StrategyRegistry', () => {
  const registry = new StrategyRegistry();

  describe('catalogue', () => {
    it('exposes every strategy without leaking the implementation', () => {
      const catalog = registry.catalog();
      expect(catalog).toHaveLength(STRATEGY_LIBRARY.length);
      for (const entry of catalog) {
        expect(entry).not.toHaveProperty('evaluate');
      }
    });

    it('gives every strategy the metadata the UI form needs', () => {
      for (const entry of registry.catalog()) {
        expect(entry.key).toMatch(/^[a-z0-9-]+$/);
        expect(entry.name.length).toBeGreaterThan(0);
        expect(entry.description.length).toBeGreaterThan(0);
        expect(entry.params.length).toBeGreaterThan(0);
      }
    });

    it('uses unique parameter keys within each strategy', () => {
      for (const entry of registry.catalog()) {
        const keys = entry.params.map((p) => p.key);
        expect(new Set(keys).size).toBe(keys.length);
      }
    });

    it('gives every numeric parameter a default inside its own range', () => {
      for (const entry of registry.catalog()) {
        for (const param of entry.params) {
          if (param.type !== 'number') continue;
          expect(param.min).toBeLessThan(param.max);
          expect(param.default).toBeGreaterThanOrEqual(param.min);
          expect(param.default).toBeLessThanOrEqual(param.max);
        }
      }
    });

    it('gives every enum parameter a default that is one of its options', () => {
      for (const entry of registry.catalog()) {
        for (const param of entry.params) {
          if (param.type !== 'enum') continue;
          expect(param.options.map((o) => o.value)).toContain(param.default);
        }
      }
    });

    it('rejects an unknown strategy key', () => {
      expect(() => registry.get('nope')).toThrow(BadRequestException);
    });
  });

  describe('config validation', () => {
    it('fills in defaults for anything the user left blank', () => {
      const config = registry.validateConfig('rsi-reversal', {});
      expect(config.period).toBe(14);
      expect(config.oversold).toBe(30);
      expect(config.takeProfitPercent).toBe(2);
    });

    it('keeps the values the user did set', () => {
      const config = registry.validateConfig('rsi-reversal', { period: 7 });
      expect(config.period).toBe(7);
    });

    it('rejects a value outside the allowed range', () => {
      expect(() =>
        registry.validateConfig('rsi-reversal', { period: 9999 }),
      ).toThrow(/between 2 and 100/);
    });

    it('rejects a setting the strategy does not have', () => {
      // Silently dropping it would look to the user like the platform obeyed them.
      expect(() =>
        registry.validateConfig('rsi-reversal', { leverage: 100 }),
      ).toThrow(/Unknown setting/);
    });

    it('rejects a wrongly typed value', () => {
      expect(() =>
        registry.validateConfig('rsi-reversal', { period: 'fast' }),
      ).toThrow(/must be a number/);
      expect(() =>
        registry.validateConfig('rsi-reversal', { requireTurn: 'yes' }),
      ).toThrow(/must be true or false/);
    });

    it('accepts every strategy with its own defaults', () => {
      for (const entry of registry.catalog()) {
        expect(() => registry.validateConfig(entry.key, {})).not.toThrow();
      }
    });
  });

  describe('evaluation contract', () => {
    it('holds rather than guessing when there is not enough history', () => {
      const signal = registry.evaluate('rsi-reversal', flat(5));
      expect(signal.action).toBe('HOLD');
      expect(signal.reason).toMatch(/Cần ít nhất/);
    });

    it.each(STRATEGY_LIBRARY.map((s) => s.key))(
      '%s always returns a well-formed signal',
      (key) => {
        const strategy = registry.get(key);
        const inputs = [
          rising(strategy.minCandles + 50),
          falling(strategy.minCandles + 50),
          flat(strategy.minCandles + 50),
          series(
            Array.from(
              { length: strategy.minCandles + 50 },
              (_, i) => 100 + Math.sin(i / 3) * 10,
            ),
          ),
        ];

        for (const candles of inputs) {
          const signal = registry.evaluate(key, candles);
          expect(['BUY', 'SELL', 'HOLD']).toContain(signal.action);
          expect(signal.confidence).toBeGreaterThanOrEqual(0);
          expect(signal.confidence).toBeLessThanOrEqual(1);
          expect(signal.reason.length).toBeGreaterThan(0);
        }
      },
    );

    it.each(STRATEGY_LIBRARY.map((s) => s.key))(
      '%s never throws on degenerate input',
      (key) => {
        const strategy = registry.get(key);
        const zeroes = series(new Array(strategy.minCandles + 50).fill(0));
        const huge = series(new Array(strategy.minCandles + 50).fill(1e12));

        expect(() => registry.evaluate(key, zeroes)).not.toThrow();
        expect(() => registry.evaluate(key, huge)).not.toThrow();
      },
    );

    it.each(STRATEGY_LIBRARY.map((s) => s.key))(
      '%s is a pure function of its inputs',
      (key) => {
        const strategy = registry.get(key);
        const candles = series(
          Array.from({ length: strategy.minCandles + 60 }, (_, i) => 100 + Math.sin(i / 5) * 8),
        );
        // Purity is what makes strategies backtestable and safe to shard.
        expect(registry.evaluate(key, candles)).toEqual(
          registry.evaluate(key, candles),
        );
      },
    );
  });

  describe('strategy behaviour', () => {
    it('RSI buys an oversold market', () => {
      const signal = registry.evaluate('rsi-reversal', [
        ...falling(60, 300, 3),
        // A tick back up so the "wait for the turn" filter is satisfied.
        ...series([125]),
      ]);
      expect(signal.action).toBe('BUY');
      expect(signal.indicators?.rsi).toBeLessThan(30);
    });

    it('RSI sells an overbought market', () => {
      const signal = registry.evaluate('rsi-reversal', [
        ...rising(60, 100, 3),
        ...series([278]),
      ]);
      expect(signal.action).toBe('SELL');
    });

    it('RSI holds in the middle of the range', () => {
      const choppy = series(
        Array.from({ length: 80 }, (_, i) => 100 + (i % 2 ? 1 : -1)),
      );
      expect(registry.evaluate('rsi-reversal', choppy).action).toBe('HOLD');
    });

    it('RSI respects a user-widened threshold', () => {
      const candles = [...falling(60, 300, 3), ...series([125])];
      // The same market is not a signal once the user demands a deeper oversold.
      expect(
        registry.evaluate('rsi-reversal', candles, { oversold: 5 }).action,
      ).toBe('HOLD');
    });

    it('EMA cross rejects a configuration where fast is not faster', () => {
      const signal = registry.evaluate('ema-cross', rising(300), {
        fastPeriod: 100,
        slowPeriod: 50,
      });
      expect(signal.action).toBe('HOLD');
      expect(signal.reason).toMatch(/nhỏ hơn/);
    });

    it('EMA cross fires on a golden cross', () => {
      // Long decline, then a sharp reversal: the fast EMA crosses up through the slow.
      const candles = series([
        ...Array.from({ length: 200 }, (_, i) => 300 - i),
        ...Array.from({ length: 120 }, (_, i) => 100 + i * 4),
      ]);
      const signals: Signal[] = [];
      for (let i = 260; i < candles.length; i++) {
        signals.push(
          registry.evaluate('ema-cross', candles.slice(0, i), {
            fastPeriod: 10,
            slowPeriod: 30,
          }),
        );
      }
      expect(signals.some((s) => s.action === 'BUY')).toBe(true);
    });

    it('Bollinger buys a close below the lower band', () => {
      const candles = [...flat(40, 100), ...series([80])];
      const signal = registry.evaluate('bollinger-reversion', candles);
      expect(signal.action).toBe('BUY');
    });

    it('Donchian measures the breakout against the prior window, not itself', () => {
      // A steadily rising series: the last bar is always the highest, but that must
      // not by itself count as breaking out of a channel it defines.
      const signal = registry.evaluate('donchian-breakout', rising(80), {
        atrFilter: false,
      });
      expect(signal.indicators?.upper).toBeLessThan(signal.indicators!.price);
      expect(signal.action).toBe('BUY');
    });

    it('Donchian holds inside the channel', () => {
      const signal = registry.evaluate('donchian-breakout', flat(80), {
        atrFilter: false,
      });
      expect(signal.action).toBe('HOLD');
    });

    it('Grid DCA scales the level with the size of the drop', () => {
      const shallow = registry.evaluate(
        'grid-dca',
        series([...new Array(19).fill(100), 97]),
        { stepPercent: 2, maxLevels: 5, lookback: 20 },
      );
      const deep = registry.evaluate(
        'grid-dca',
        series([...new Array(19).fill(100), 90]),
        { stepPercent: 2, maxLevels: 5, lookback: 20 },
      );

      expect(shallow.action).toBe('BUY');
      expect(deep.action).toBe('BUY');
      expect(deep.indicators!.level).toBeGreaterThan(shallow.indicators!.level);
    });

    it('Grid DCA never exceeds the user’s maximum level', () => {
      const crash = registry.evaluate(
        'grid-dca',
        series([...new Array(19).fill(100), 10]),
        { stepPercent: 1, maxLevels: 3, lookback: 20 },
      );
      expect(crash.indicators!.level).toBeLessThanOrEqual(3);
    });
  });
});
