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

// ─────────────────────────────────────────────────────────────
// Directional movement (Wilder)
// ─────────────────────────────────────────────────────────────

/**
 * ADX with its +DI / −DI components.
 *
 * ADX measures how *strong* a trend is, not its direction — the usual mistake is
 * reading a rising ADX as bullish. Direction comes from which DI is on top.
 * Wilder's own smoothing throughout, not an EMA approximation.
 */
export function adx(
  candles: Candle[],
  period: number,
): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  const n = candles.length;
  const out = {
    adx: new Array<number>(n).fill(NaN),
    plusDI: new Array<number>(n).fill(NaN),
    minusDI: new Array<number>(n).fill(NaN),
  };
  if (n < period * 2) return out;

  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  const tr: number[] = [0];

  for (let i = 1; i < n; i++) {
    const high = Number(candles[i].high);
    const low = Number(candles[i].low);
    const prevHigh = Number(candles[i - 1].high);
    const prevLow = Number(candles[i - 1].low);
    const prevClose = Number(candles[i - 1].close);

    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    // Only the larger move counts, and only when it is positive — an inside bar
    // contributes no directional movement at all.
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(
      Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)),
    );
  }

  const sum = (values: number[], from: number, count: number) =>
    values.slice(from, from + count).reduce((a, b) => a + b, 0);

  let smoothedTR = sum(tr, 1, period);
  let smoothedPlus = sum(plusDM, 1, period);
  let smoothedMinus = sum(minusDM, 1, period);

  const dx: number[] = new Array<number>(n).fill(NaN);

  for (let i = period; i < n; i++) {
    if (i > period) {
      // Wilder's smoothing: drop 1/period of the running total, add the new bar.
      smoothedTR = smoothedTR - smoothedTR / period + tr[i];
      smoothedPlus = smoothedPlus - smoothedPlus / period + plusDM[i];
      smoothedMinus = smoothedMinus - smoothedMinus / period + minusDM[i];
    }

    const plus = smoothedTR === 0 ? 0 : (smoothedPlus / smoothedTR) * 100;
    const minus = smoothedTR === 0 ? 0 : (smoothedMinus / smoothedTR) * 100;
    out.plusDI[i] = plus;
    out.minusDI[i] = minus;

    const total = plus + minus;
    dx[i] = total === 0 ? 0 : (Math.abs(plus - minus) / total) * 100;
  }

  const firstAdx = period * 2 - 1;
  if (firstAdx < n) {
    let value = sum(dx, period, period) / period;
    out.adx[firstAdx] = value;
    for (let i = firstAdx + 1; i < n; i++) {
      value = (value * (period - 1) + dx[i]) / period;
      out.adx[i] = value;
    }
  }

  return out;
}

/** Typical price — the (H+L+C)/3 that CCI, MFI and VWAP are all built on. */
export function typicalPrice(candles: Candle[]): number[] {
  return candles.map(
    (c) => (Number(c.high) + Number(c.low) + Number(c.close)) / 3,
  );
}

/**
 * Commodity Channel Index.
 *
 * Uses mean *absolute* deviation, not standard deviation — that is Lambert's
 * original definition and the 0.015 constant only calibrates against it.
 */
export function cci(candles: Candle[], period: number): number[] {
  const tp = typicalPrice(candles);
  const means = sma(tp, period);
  return tp.map((_, i) => {
    if (i < period - 1) return NaN;
    const window = tp.slice(i - period + 1, i + 1);
    const mean = means[i];
    const meanDeviation =
      window.reduce((acc, v) => acc + Math.abs(v - mean), 0) / period;
    return meanDeviation === 0 ? 0 : (tp[i] - mean) / (0.015 * meanDeviation);
  });
}

/** Williams %R — where the close sits in the range, scaled −100…0. */
export function williamsR(candles: Candle[], period: number): number[] {
  const out = new Array<number>(candles.length).fill(NaN);
  for (let i = period - 1; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1);
    const highest = Math.max(...window.map((c) => Number(c.high)));
    const lowest = Math.min(...window.map((c) => Number(c.low)));
    out[i] =
      highest === lowest
        ? -50
        : ((highest - Number(candles[i].close)) / (highest - lowest)) * -100;
  }
  return out;
}

/**
 * Money Flow Index — RSI weighted by volume.
 *
 * Divergence between MFI and price is the reason to prefer it over RSI: price can
 * make a new high on falling money flow.
 */
export function mfi(candles: Candle[], period: number): number[] {
  const tp = typicalPrice(candles);
  const out = new Array<number>(candles.length).fill(NaN);

  for (let i = period; i < candles.length; i++) {
    let positive = 0;
    let negative = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const flow = tp[j] * Number(candles[j].volume);
      if (tp[j] > tp[j - 1]) positive += flow;
      else if (tp[j] < tp[j - 1]) negative += flow;
      // An unchanged typical price contributes to neither side.
    }
    out[i] = negative === 0 ? 100 : 100 - 100 / (1 + positive / negative);
  }
  return out;
}

/** Rate of change, in percent. */
export function roc(values: number[], period: number): number[] {
  return values.map((value, i) => {
    if (i < period) return NaN;
    const past = values[i - period];
    return past === 0 ? 0 : ((value - past) / past) * 100;
  });
}

/** On-balance volume — a running total that only its slope is read for. */
export function obv(candles: Candle[]): number[] {
  const out = [0];
  for (let i = 1; i < candles.length; i++) {
    const close = Number(candles[i].close);
    const prev = Number(candles[i - 1].close);
    const volume = Number(candles[i].volume);
    out.push(out[i - 1] + (close > prev ? volume : close < prev ? -volume : 0));
  }
  return out;
}

/**
 * Rolling VWAP over `period` bars.
 *
 * Note this is not the session VWAP an exchange shows — that one resets daily.
 * A rolling window is what makes sense on a continuous crypto market.
 */
export function vwap(candles: Candle[], period: number): number[] {
  const tp = typicalPrice(candles);
  const out = new Array<number>(candles.length).fill(NaN);

  for (let i = period - 1; i < candles.length; i++) {
    let volumePrice = 0;
    let volume = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const v = Number(candles[j].volume);
      volumePrice += tp[j] * v;
      volume += v;
    }
    out[i] = volume === 0 ? tp[i] : volumePrice / volume;
  }
  return out;
}

/** Keltner channels: EMA centre, ATR-scaled bands. */
export function keltner(
  candles: Candle[],
  period: number,
  multiplier: number,
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = ema(closes(candles), period);
  const range = atr(candles, period);
  return {
    middle,
    upper: middle.map((m, i) => m + range[i] * multiplier),
    lower: middle.map((m, i) => m - range[i] * multiplier),
  };
}

/**
 * Parabolic SAR.
 *
 * Stateful by construction: the acceleration factor only resets on a flip, so the
 * series cannot be computed pointwise.
 */
export function psar(
  candles: Candle[],
  step = 0.02,
  maxStep = 0.2,
): number[] {
  const n = candles.length;
  const out = new Array<number>(n).fill(NaN);
  if (n < 3) return out;

  let rising = Number(candles[1].close) >= Number(candles[0].close);
  let sar = rising ? Number(candles[0].low) : Number(candles[0].high);
  let extreme = rising ? Number(candles[1].high) : Number(candles[1].low);
  let acceleration = step;
  out[1] = sar;

  for (let i = 2; i < n; i++) {
    const high = Number(candles[i].high);
    const low = Number(candles[i].low);

    sar = sar + acceleration * (extreme - sar);

    // The SAR may never move inside the previous two bars' range.
    if (rising) {
      sar = Math.min(sar, Number(candles[i - 1].low), Number(candles[i - 2].low));
    } else {
      sar = Math.max(sar, Number(candles[i - 1].high), Number(candles[i - 2].high));
    }

    const flipped = rising ? low < sar : high > sar;
    if (flipped) {
      rising = !rising;
      sar = extreme;
      extreme = rising ? high : low;
      acceleration = step;
    } else if ((rising && high > extreme) || (!rising && low < extreme)) {
      extreme = rising ? high : low;
      acceleration = Math.min(acceleration + step, maxStep);
    }

    out[i] = sar;
  }
  return out;
}

/** Ichimoku conversion and base lines, plus both leading spans (unshifted). */
export function ichimoku(
  candles: Candle[],
  conversionPeriod = 9,
  basePeriod = 26,
  spanPeriod = 52,
): { conversion: number[]; base: number[]; spanA: number[]; spanB: number[] } {
  const midpoint = (period: number) => {
    const out = new Array<number>(candles.length).fill(NaN);
    for (let i = period - 1; i < candles.length; i++) {
      const window = candles.slice(i - period + 1, i + 1);
      const highest = Math.max(...window.map((c) => Number(c.high)));
      const lowest = Math.min(...window.map((c) => Number(c.low)));
      out[i] = (highest + lowest) / 2;
    }
    return out;
  };

  const conversion = midpoint(conversionPeriod);
  const base = midpoint(basePeriod);

  return {
    conversion,
    base,
    spanA: conversion.map((c, i) =>
      Number.isNaN(c) || Number.isNaN(base[i]) ? NaN : (c + base[i]) / 2,
    ),
    spanB: midpoint(spanPeriod),
  };
}
