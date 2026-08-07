import { Candle } from '../../exchange/exchange.types';
import { atr, bollinger, crossedAbove, ema, macd, rsi, sma, stochastic } from './indicators';

const candle = (high: number, low: number, close: number): Candle => ({
  openTime: 0,
  open: String(close),
  high: String(high),
  low: String(low),
  close: String(close),
  volume: '1',
  closeTime: 0,
});

describe('indicators', () => {
  describe('sma', () => {
    it('averages the trailing window', () => {
      expect(sma([1, 2, 3, 4, 5], 3).slice(2)).toEqual([2, 3, 4]);
    });

    it('leaves the warm-up period undefined rather than guessing', () => {
      const result = sma([1, 2, 3], 3);
      expect(result[0]).toBeNaN();
      expect(result[1]).toBeNaN();
    });
  });

  describe('ema', () => {
    it('seeds from the SMA so the series is deterministic', () => {
      // First value must equal the SMA of the first `period` inputs.
      expect(ema([1, 2, 3, 4, 5], 3)[2]).toBeCloseTo(2, 10);
    });

    it('weights recent values more than a plain average', () => {
      const values = [10, 10, 10, 10, 20];
      const emaResult = ema(values, 4);
      const smaResult = sma(values, 4);
      expect(emaResult[4]).toBeGreaterThan(smaResult[4]);
    });

    it('returns all NaN when there is not enough data', () => {
      expect(ema([1, 2], 5).every(Number.isNaN)).toBe(true);
    });
  });

  describe('rsi', () => {
    it('reads 100 when every move is upward', () => {
      const rising = Array.from({ length: 30 }, (_, i) => 100 + i);
      expect(rsi(rising, 14)[29]).toBeCloseTo(100, 6);
    });

    it('reads 0 when every move is downward', () => {
      const falling = Array.from({ length: 30 }, (_, i) => 100 - i);
      expect(rsi(falling, 14)[29]).toBeCloseTo(0, 6);
    });

    it('sits near the middle for an alternating series', () => {
      const choppy = Array.from({ length: 60 }, (_, i) => 100 + (i % 2));
      const value = rsi(choppy, 14)[59];
      expect(value).toBeGreaterThan(30);
      expect(value).toBeLessThan(70);
    });

    it('stays within 0 and 100 for random-ish input', () => {
      const values = Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i) * 10);
      for (const value of rsi(values, 14).filter((v) => !Number.isNaN(v))) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('macd', () => {
    it('aligns the signal line with the MACD line', () => {
      const values = Array.from({ length: 100 }, (_, i) => 100 + i);
      const { macd: line, signal, histogram } = macd(values, 12, 26, 9);

      expect(line).toHaveLength(values.length);
      expect(signal).toHaveLength(values.length);
      // Histogram is only defined where both inputs are.
      histogram.forEach((v, i) => {
        const defined = !Number.isNaN(line[i]) && !Number.isNaN(signal[i]);
        expect(Number.isNaN(v)).toBe(!defined);
      });
    });

    it('is positive in a steady uptrend', () => {
      const values = Array.from({ length: 120 }, (_, i) => 100 + i * 2);
      const { macd: line } = macd(values, 12, 26, 9);
      expect(line[119]).toBeGreaterThan(0);
    });
  });

  describe('bollinger', () => {
    it('collapses the bands when price does not move', () => {
      const flat = new Array(30).fill(100);
      const { upper, middle, lower } = bollinger(flat, 20, 2);
      expect(upper[29]).toBeCloseTo(100, 10);
      expect(middle[29]).toBeCloseTo(100, 10);
      expect(lower[29]).toBeCloseTo(100, 10);
    });

    it('keeps the bands ordered', () => {
      const values = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i) * 5);
      const { upper, middle, lower } = bollinger(values, 20, 2);
      expect(upper[59]).toBeGreaterThan(middle[59]);
      expect(middle[59]).toBeGreaterThan(lower[59]);
    });
  });

  describe('atr', () => {
    it('measures the average range', () => {
      const candles = Array.from({ length: 40 }, () => candle(110, 100, 105));
      expect(atr(candles, 14)[39]).toBeCloseTo(10, 6);
    });
  });

  describe('stochastic', () => {
    it('reads 100 when the close is the top of the window', () => {
      const candles = [
        ...Array.from({ length: 20 }, () => candle(110, 90, 100)),
        candle(110, 90, 110),
      ];
      expect(stochastic(candles, 14, 3).k[20]).toBeCloseTo(100, 6);
    });

    it('returns the neutral 50 for a flat window instead of dividing by zero', () => {
      const candles = Array.from({ length: 20 }, () => candle(100, 100, 100));
      expect(stochastic(candles, 14, 3).k[19]).toBe(50);
    });
  });

  describe('crossedAbove', () => {
    it('detects a genuine cross', () => {
      expect(crossedAbove([1, 3], [2, 2])).toBe(true);
    });

    it('ignores a series that was already above', () => {
      expect(crossedAbove([3, 4], [2, 2])).toBe(false);
    });

    it('treats touching then rising as a cross', () => {
      expect(crossedAbove([2, 3], [2, 2])).toBe(true);
    });

    it('never reports a cross while values are undefined', () => {
      expect(crossedAbove([NaN, 3], [2, 2])).toBe(false);
    });
  });
});
