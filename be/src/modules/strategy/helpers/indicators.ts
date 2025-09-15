// src/strategies/indicators.ts
export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const res: number[] = [];
  if (!values.length) return res;
  // seed with SMA of first period
  let sma = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  res[period - 1] = sma;
  for (let i = period; i < values.length; i++) {
    const prev = res[i - 1] ?? sma;
    res[i] = values[i] * k + prev * (1 - k);
  }
  // fill earlier indices with undefined (or copy first valid)
  for (let i = 0; i < period - 1; i++) res[i] = NaN;
  return res;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  if (values.length < slow) return { macd: [], signal: [], hist: [] };
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const a = emaFast[i];
    const b = emaSlow[i];
    macdLine[i] = isFinite(a) && isFinite(b) ? a - b : NaN;
  }
  const signalLine = ema(
    macdLine.filter((v) => !isNaN(v)),
    signal,
  );
  // align signalLine back to full length (signalLine starts at index (slow-1)+(signal-1) roughly)
  const fullSignal: number[] = Array(values.length).fill(NaN);
  let sigIdx = 0;
  for (let i = 0; i < values.length; i++) {
    if (!isNaN(macdLine[i])) {
      if (sigIdx < signalLine.length) {
        fullSignal[i] = signalLine[sigIdx++];
      } else {
        fullSignal[i] = NaN;
      }
    }
  }
  const hist = macdLine.map((m, i) =>
    isFinite(m) && isFinite(fullSignal[i]) ? m - fullSignal[i] : NaN,
  );
  return { macd: macdLine, signal: fullSignal, hist };
}

export function rsi(values: number[], period = 14) {
  const res: number[] = Array(values.length).fill(NaN);
  if (values.length <= period) return res;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gains += change;
    else losses += -change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  res[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    res[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return res;
}
