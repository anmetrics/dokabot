import { Candle } from '../../exchange/exchange.types';

/**
 * Thin numeric helpers over the candle stream.
 *
 * Strategies work on `number[]`, not `Candle[]`, so the same maths can be reused
 * across sources and tested without constructing candles.
 */
export const closes = (candles: Candle[]): number[] =>
  candles.map((c) => Number(c.close));
export const highs = (candles: Candle[]): number[] =>
  candles.map((c) => Number(c.high));
export const lows = (candles: Candle[]): number[] =>
  candles.map((c) => Number(c.low));
export const volumes = (candles: Candle[]): number[] =>
  candles.map((c) => Number(c.volume));

export const last = <T>(values: T[]): T => values[values.length - 1];

/** Simple moving average, aligned so index i is the average ending at i. */
export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : NaN);
  }
  return out;
}

/** Exponential moving average, seeded with the first SMA so it is deterministic. */
export function ema(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;

  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;

  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI — the smoothing the original definition uses, not a plain EMA. */
export function rsi(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length <= period) return out;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function macd(
  values: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): { macd: number[]; signal: number[]; histogram: number[] } {
  const fast = ema(values, fastPeriod);
  const slow = ema(values, slowPeriod);
  const macdLine = values.map((_, i) =>
    Number.isNaN(fast[i]) || Number.isNaN(slow[i]) ? NaN : fast[i] - slow[i],
  );

  // The signal line is an EMA of the MACD line, so it can only start once the
  // MACD line does.
  const firstValid = macdLine.findIndex((v) => !Number.isNaN(v));
  const signalTail =
    firstValid === -1 ? [] : ema(macdLine.slice(firstValid), signalPeriod);

  const signal: number[] = new Array(values.length).fill(NaN);
  signalTail.forEach((v, i) => {
    signal[firstValid + i] = v;
  });

  const histogram = macdLine.map((v, i) =>
    Number.isNaN(v) || Number.isNaN(signal[i]) ? NaN : v - signal[i],
  );

  return { macd: macdLine, signal, histogram };
}

export function stdDev(values: number[], period: number): number[] {
  const means = sma(values, period);
  return values.map((_, i) => {
    if (i < period - 1) return NaN;
    const window = values.slice(i - period + 1, i + 1);
    const mean = means[i];
    const variance =
      window.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    return Math.sqrt(variance);
  });
}

export function bollinger(
  values: number[],
  period: number,
  multiplier: number,
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(values, period);
  const deviation = stdDev(values, period);
  return {
    middle,
    upper: middle.map((m, i) => m + deviation[i] * multiplier),
    lower: middle.map((m, i) => m - deviation[i] * multiplier),
  };
}

/** Wilder's ATR, used for volatility-scaled stops and channels. */
export function atr(candles: Candle[], period: number): number[] {
  const out: number[] = new Array(candles.length).fill(NaN);
  if (candles.length <= period) return out;

  const trueRanges: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const high = Number(candles[i].high);
    const low = Number(candles[i].low);
    const prevClose = Number(candles[i - 1].close);
    trueRanges.push(
      Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)),
    );
  }

  let prev =
    trueRanges.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  out[period] = prev;
  for (let i = period + 1; i < candles.length; i++) {
    prev = (prev * (period - 1) + trueRanges[i]) / period;
    out[i] = prev;
  }
  return out;
}

/** Stochastic oscillator: %K and its %D smoothing. */
export function stochastic(
  candles: Candle[],
  period: number,
  smoothing: number,
): { k: number[]; d: number[] } {
  const k: number[] = new Array(candles.length).fill(NaN);

  for (let i = period - 1; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1);
    const highest = Math.max(...window.map((c) => Number(c.high)));
    const lowest = Math.min(...window.map((c) => Number(c.low)));
    const close = Number(candles[i].close);
    // A flat window has no range to position the close within; 50 is the neutral
    // reading rather than a division by zero.
    k[i] = highest === lowest ? 50 : ((close - lowest) / (highest - lowest)) * 100;
  }

  const firstValid = k.findIndex((v) => !Number.isNaN(v));
  const dTail = firstValid === -1 ? [] : sma(k.slice(firstValid), smoothing);
  const d: number[] = new Array(candles.length).fill(NaN);
  dTail.forEach((v, i) => {
    d[firstValid + i] = v;
  });

  return { k, d };
}

/** True when `series` moved from at-or-below `other` to strictly above it. */
export function crossedAbove(series: number[], other: number[]): boolean {
  const i = series.length - 1;
  if (i < 1) return false;
  const [prevA, prevB, curA, curB] = [
    series[i - 1],
    other[i - 1],
    series[i],
    other[i],
  ];
  if ([prevA, prevB, curA, curB].some(Number.isNaN)) return false;
  return prevA <= prevB && curA > curB;
}

export function crossedBelow(series: number[], other: number[]): boolean {
  return crossedAbove(other, series);
}
