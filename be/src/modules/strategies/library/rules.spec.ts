import { Candle } from '../../exchange/exchange.types';
import { adx, cci, mfi, obv, psar, roc, vwap, williamsR } from './indicators';
import {
  evaluateCondition,
  evaluateGroup,
  INDICATORS,
  requiredCandlesForGroup,
  RuleGroup,
} from './rules';

const bar = (
  close: number,
  high = close * 1.01,
  low = close * 0.99,
  volume = 100,
): Candle => ({
  openTime: 0,
  open: String(close),
  high: String(high),
  low: String(low),
  close: String(close),
  volume: String(volume),
  closeTime: 0,
});

const rising = (n: number, from = 100, step = 1) =>
  Array.from({ length: n }, (_, i) => bar(from + i * step));
const falling = (n: number, from = 300, step = 1) =>
  Array.from({ length: n }, (_, i) => bar(from - i * step));
const flat = (n: number, price = 100) =>
  Array.from({ length: n }, () => bar(price));

describe('advanced indicators', () => {
  describe('adx', () => {
    it('reads a strong trend as high ADX with +DI on top', () => {
      const result = adx(rising(120), 14);
      expect(result.adx[119]).toBeGreaterThan(25);
      expect(result.plusDI[119]).toBeGreaterThan(result.minusDI[119]);
    });

    it('puts −DI on top in a downtrend', () => {
      const result = adx(falling(120), 14);
      expect(result.minusDI[119]).toBeGreaterThan(result.plusDI[119]);
    });

    it('measures strength, not direction', () => {
      // The classic misreading: a high ADX in a downtrend is not bearish-vs-bullish,
      // it just means the move is strong. Both trends should score high.
      const up = adx(rising(120), 14).adx[119];
      const down = adx(falling(120), 14).adx[119];
      expect(up).toBeGreaterThan(25);
      expect(down).toBeGreaterThan(25);
    });

    it('stays within 0 and 100', () => {
      const values = adx(
        Array.from({ length: 200 }, (_, i) => bar(100 + Math.sin(i / 4) * 12)),
        14,
      );
      for (const key of ['adx', 'plusDI', 'minusDI'] as const) {
        for (const value of values[key].filter((v) => !Number.isNaN(v))) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe('williamsR', () => {
    it('reads 0 at the top of the range and −100 at the bottom', () => {
      const top = williamsR([...flat(20, 100), bar(110, 110, 90)], 14);
      expect(top[20]).toBeCloseTo(0, 6);

      const bottom = williamsR([...flat(20, 100), bar(90, 110, 90)], 14);
      expect(bottom[20]).toBeCloseTo(-100, 6);
    });

    it('returns the neutral −50 for a flat window', () => {
      const values = williamsR(
        Array.from({ length: 20 }, () => bar(100, 100, 100)),
        14,
      );
      expect(values[19]).toBe(-50);
    });
  });

  describe('mfi', () => {
    it('reads 100 when every bar rises', () => {
      expect(mfi(rising(40), 14)[39]).toBeCloseTo(100, 6);
    });

    it('weights by volume, unlike RSI', () => {
      // Same prices; the version with heavy volume on down bars must read lower.
      const prices = Array.from({ length: 40 }, (_, i) => 100 + (i % 2 ? 2 : -2));
      const even = prices.map((p) => bar(p, p * 1.01, p * 0.99, 100));
      const heavyDown = prices.map((p, i) =>
        bar(p, p * 1.01, p * 0.99, i % 2 ? 100 : 1000),
      );
      expect(mfi(heavyDown, 14)[39]).toBeLessThan(mfi(even, 14)[39]);
    });
  });

  describe('cci', () => {
    it('is zero when price sits exactly on its mean', () => {
      expect(cci(flat(40), 20)[39]).toBe(0);
    });

    it('goes strongly positive in a sharp advance', () => {
      expect(cci(rising(60, 100, 3), 20)[59]).toBeGreaterThan(100);
    });
  });

  describe('obv', () => {
    it('accumulates volume on up bars and sheds it on down bars', () => {
      const candles = [bar(100, 101, 99, 10), bar(101, 102, 100, 20), bar(99, 100, 98, 30)];
      expect(obv(candles)).toEqual([0, 20, -10]);
    });

    it('ignores unchanged bars', () => {
      const candles = [bar(100, 101, 99, 10), bar(100, 101, 99, 50)];
      expect(obv(candles)[1]).toBe(0);
    });
  });

  describe('vwap', () => {
    it('is pulled toward the price that traded the most volume', () => {
      const candles = [
        ...Array.from({ length: 19 }, () => bar(100, 100, 100, 1)),
        bar(200, 200, 200, 1000),
      ];
      const value = vwap(candles, 20)[19];
      expect(value).toBeGreaterThan(150);
    });

    it('falls back to the typical price when there is no volume', () => {
      const candles = Array.from({ length: 20 }, () => bar(100, 100, 100, 0));
      expect(vwap(candles, 20)[19]).toBe(100);
    });
  });

  describe('roc', () => {
    it('reports the percentage change over the period', () => {
      expect(roc([100, 0, 0, 0, 0, 110], 5)[5]).toBeCloseTo(10, 10);
    });
  });

  describe('psar', () => {
    it('sits below price in an uptrend and above it in a downtrend', () => {
      const up = rising(60);
      expect(psar(up)[59]).toBeLessThan(Number(up[59].close));

      const down = falling(60);
      expect(psar(down)[59]).toBeGreaterThan(Number(down[59].close));
    });

    it('flips side after the trend reverses', () => {
      const candles = [...rising(40), ...falling(40, 139)];
      const series = psar(candles);
      // Before the turn it trails below; well after it, above.
      expect(series[38]).toBeLessThan(Number(candles[38].close));
      expect(series[75]).toBeGreaterThan(Number(candles[75].close));
    });
  });
});

describe('rule engine', () => {
  describe('metadata', () => {
    it('gives every indicator at least one output', () => {
      for (const indicator of INDICATORS) {
        expect(indicator.outputs.length).toBeGreaterThan(0);
        expect(indicator.description.length).toBeGreaterThan(10);
      }
    });

    it('gives every parameter a default inside its range', () => {
      for (const indicator of INDICATORS) {
        for (const param of indicator.params) {
          expect(param.default).toBeGreaterThanOrEqual(param.min);
          expect(param.default).toBeLessThanOrEqual(param.max);
        }
      }
    });

    it('can resolve every declared output of every indicator', () => {
      const candles = Array.from({ length: 400 }, (_, i) =>
        bar(100 + Math.sin(i / 7) * 15 + i * 0.1),
      );

      for (const indicator of INDICATORS) {
        for (const output of indicator.outputs) {
          expect(() =>
            evaluateCondition(
              {
                left: { type: 'indicator', name: indicator.name, output: output.key },
                operator: 'gt',
                right: { type: 'constant', value: -1e12 },
              },
              candles,
            ),
          ).not.toThrow();
        }
      }
    });
  });

  describe('comparisons', () => {
    const candles = rising(120);

    it('compares an indicator against a constant', () => {
      const result = evaluateCondition(
        {
          left: { type: 'indicator', name: 'RSI', params: { period: 14 } },
          operator: 'gt',
          right: { type: 'constant', value: 50 },
        },
        candles,
      );
      expect(result.passed).toBe(true);
    });

    it('compares two indicators against each other', () => {
      const result = evaluateCondition(
        {
          left: { type: 'indicator', name: 'EMA', params: { period: 10 } },
          operator: 'gt',
          right: { type: 'indicator', name: 'EMA', params: { period: 50 } },
        },
        candles,
      );
      expect(result.passed).toBe(true);
    });

    it('compares price against an indicator', () => {
      const result = evaluateCondition(
        {
          left: { type: 'price', source: 'close' },
          operator: 'gt',
          right: { type: 'indicator', name: 'SMA', params: { period: 20 } },
        },
        candles,
      );
      expect(result.passed).toBe(true);
    });

    it('detects a cross rather than a persistent inequality', () => {
      // A series already above its average must not report a cross every bar.
      const condition = {
        left: { type: 'price' as const, source: 'close' as const },
        operator: 'crossesAbove' as const,
        right: { type: 'indicator' as const, name: 'SMA' as const, params: { period: 20 } },
      };
      expect(evaluateCondition(condition, candles).passed).toBe(false);
    });

    it('fires on a genuine cross', () => {
      const reversal = [...falling(60, 300, 2), ...rising(30, 182, 6)];
      let crossed = false;
      // The cross lands a few bars after the turn, once the SMA has caught up.
      for (let i = 61; i <= reversal.length; i++) {
        const result = evaluateCondition(
          {
            left: { type: 'price', source: 'close' },
            operator: 'crossesAbove',
            right: { type: 'indicator', name: 'SMA', params: { period: 20 } },
          },
          reversal.slice(0, i),
        );
        if (result.passed) crossed = true;
      }
      expect(crossed).toBe(true);
    });

    it('handles between, including bounds given the wrong way round', () => {
      const inRange = evaluateCondition(
        {
          left: { type: 'price', source: 'close' },
          operator: 'between',
          right: { type: 'constant', value: 300 },
          right2: { type: 'constant', value: 100 },
        },
        candles,
      );
      // A user swapping the two bounds is a slip, not a reason to never fire.
      expect(inRange.passed).toBe(true);
    });

    it('handles outside as the exact negation of between', () => {
      const base = {
        left: { type: 'price' as const, source: 'close' as const },
        right: { type: 'constant' as const, value: 0 },
        right2: { type: 'constant' as const, value: 50 },
      };
      expect(evaluateCondition({ ...base, operator: 'between' }, candles).passed).toBe(
        false,
      );
      expect(evaluateCondition({ ...base, operator: 'outside' }, candles).passed).toBe(
        true,
      );
    });

    it('never passes while an indicator is still warming up', () => {
      const result = evaluateCondition(
        {
          left: { type: 'indicator', name: 'EMA', params: { period: 200 } },
          operator: 'gt',
          right: { type: 'constant', value: 0 },
        },
        rising(20),
      );
      // A half-computed series must not be able to open a trade.
      expect(result.passed).toBe(false);
      expect(result.detail).toMatch(/chưa đủ dữ liệu/);
    });

    it('rejects a parameter outside the indicator’s range', () => {
      expect(() =>
        evaluateCondition(
          {
            left: { type: 'indicator', name: 'RSI', params: { period: 9999 } },
            operator: 'gt',
            right: { type: 'constant', value: 50 },
          },
          candles,
        ),
      ).toThrow(/phải trong khoảng/);
    });

    it('rejects an output the indicator does not have', () => {
      expect(() =>
        evaluateCondition(
          {
            left: { type: 'indicator', name: 'RSI', output: 'signal' },
            operator: 'gt',
            right: { type: 'constant', value: 50 },
          },
          candles,
        ),
      ).toThrow(/không có giá trị/);
    });

    it('rejects an unknown indicator', () => {
      expect(() =>
        evaluateCondition(
          {
            left: { type: 'indicator', name: 'ASTROLOGY' as never },
            operator: 'gt',
            right: { type: 'constant', value: 1 },
          },
          candles,
        ),
      ).toThrow(/không tồn tại/);
    });

    it('requires both bounds for a range comparison', () => {
      expect(() =>
        evaluateCondition(
          {
            left: { type: 'price' },
            operator: 'between',
            right: { type: 'constant', value: 1 },
          },
          candles,
        ),
      ).toThrow(/đủ hai cận/);
    });
  });

  describe('groups', () => {
    const candles = rising(200);

    const trueCondition = {
      left: { type: 'price' as const },
      operator: 'gt' as const,
      right: { type: 'constant' as const, value: 0 },
    };
    const falseCondition = {
      left: { type: 'price' as const },
      operator: 'lt' as const,
      right: { type: 'constant' as const, value: 0 },
    };

    it('AND needs every condition', () => {
      const group: RuleGroup = {
        logic: 'AND',
        conditions: [trueCondition, falseCondition],
      };
      expect(evaluateGroup(group, candles).passed).toBe(false);
    });

    it('OR needs only one', () => {
      const group: RuleGroup = {
        logic: 'OR',
        conditions: [trueCondition, falseCondition],
      };
      expect(evaluateGroup(group, candles).passed).toBe(true);
    });

    it('reports how many conditions matched, for confidence scaling', () => {
      const result = evaluateGroup(
        { logic: 'OR', conditions: [trueCondition, trueCondition, falseCondition] },
        candles,
      );
      expect(result.matched).toBe(2);
      expect(result.total).toBe(3);
    });

    it('an empty group never fires', () => {
      // Otherwise a bot with no rules would trade on every candle.
      expect(evaluateGroup({ logic: 'AND', conditions: [] }, candles).passed).toBe(
        false,
      );
    });
  });

  describe('history requirements', () => {
    it('scales with the slowest indicator in the group', () => {
      const shallow = requiredCandlesForGroup({
        logic: 'AND',
        conditions: [
          {
            left: { type: 'indicator', name: 'RSI', params: { period: 7 } },
            operator: 'lt',
            right: { type: 'constant', value: 30 },
          },
        ],
      });
      const deep = requiredCandlesForGroup({
        logic: 'AND',
        conditions: [
          {
            left: { type: 'indicator', name: 'EMA', params: { period: 200 } },
            operator: 'lt',
            right: { type: 'constant', value: 30 },
          },
        ],
      });
      expect(deep).toBeGreaterThan(shallow);
      expect(deep).toBeGreaterThanOrEqual(600);
    });
  });
});
