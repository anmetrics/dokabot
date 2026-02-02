/**
 * Backtest BTC ICT Futures Strategy - ULTRA HIGH WIN RATE
 * - Main trend: 1h, 4h, Daily, Weekly (TẤT CẢ phải cùng hướng)
 * - Entry: RSI extreme + EMA stall + ICT confirmation
 * - Scalping nhanh ăn sóng ngắn
 * Chạy: npx tsx scripts/backtest-mtf-futures.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

interface SwingPoint {
  price: number;
  index: number;
  type: 'high' | 'low';
}

interface OrderBlock {
  high: number;
  low: number;
  type: 'bullish' | 'bearish';
  index: number;
  strength: number;
}

interface FairValueGap {
  high: number;
  low: number;
  type: 'bullish' | 'bearish';
  midpoint: number;
}

interface MarketStructure {
  trend: 'bullish' | 'bearish' | 'ranging';
  swingHigh: SwingPoint | null;
  swingLow: SwingPoint | null;
  premium: number;
  discount: number;
  equilibrium: number;
}

interface TimeframeData {
  opens: number[];
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  timestamps: number[];
}

// === SETTINGS ===
const SETTINGS = {
  // Position sizing
  usdPerTrade: 20,
  maxLeverage: 10,
  takerFee: 0.0004,

  // ICT Settings
  swingLookback: 5,
  obLookback: 20,
  fvgMinSize: 0.0003,
  liquiditySweepThreshold: 0.0002,
  oteZoneLow: 0.618,
  oteZoneHigh: 0.786,

  // Trade management - 95%+ WIN RATE TARGET
  profitTargetPct: 0.0015, // 0.15% TP - scalping siêu nhanh
  stopLossPct: 0.01, // 1% SL - rất rộng để tránh bị stop
  trailingActivation: 0.001,
  trailingDistance: 0.0005,
  minConfidence: 230, // Cực kỳ strict
  enableICTExit: true,

  // RSI thresholds - CHỈ CỰC EXTREME
  rsiOverbought: 77, // SHORT khi RSI > 77
  rsiOversold: 23, // LONG khi RSI < 23

  // EMA stall detection
  emaStallThreshold: 0.001,

  // Cooldown
  cooldownMs: 180000, // 3 phút cooldown
};

// === TECHNICAL INDICATORS ===

// RSI - Relative Strength Index
function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;

  const recentCloses = closes.slice(-period - 1);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < recentCloses.length; i++) {
    const change = recentCloses[i] - recentCloses[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// EMA - Exponential Moving Average
function calculateEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1];

  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b) / period;

  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

// Bollinger Bands
function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  stdDev: number = 2,
): { upper: number; middle: number; lower: number; width: number } {
  if (closes.length < period) {
    const last = closes[closes.length - 1];
    return { upper: last, middle: last, lower: last, width: 0 };
  }

  const recentCloses = closes.slice(-period);
  const sma = recentCloses.reduce((a, b) => a + b) / period;

  const variance = recentCloses.reduce((sum, c) => sum + Math.pow(c - sma, 2), 0) / period;
  const std = Math.sqrt(variance);

  return {
    upper: sma + stdDev * std,
    middle: sma,
    lower: sma - stdDev * std,
    width: ((sma + stdDev * std - (sma - stdDev * std)) / sma) * 100,
  };
}

// MACD
function calculateMACD(
  closes: number[],
): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12 - ema26;

  // Signal line (9-period EMA of MACD) - simplified
  const ema9 = calculateEMA(closes.slice(-26), 9);
  const signal = (ema12 - ema26) * 0.2 + ema9 * 0.8; // Approximation

  return {
    macd,
    signal,
    histogram: macd - signal,
  };
}

// Volume analysis
function isVolumeSpike(volumes: number[], threshold: number = 1.5): boolean {
  if (volumes.length < 20) return false;
  const recentVol = volumes[volumes.length - 1];
  const avgVol = volumes.slice(-20, -1).reduce((a, b) => a + b) / 19;
  return recentVol > avgVol * threshold;
}

// EMA Stall Detection - khi EMA9 và EMA21 gần nhau và đang flatten
function isEMAStall(closes: number[]): { stall: boolean; direction: 'up' | 'down' | 'flat' } {
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema9Prev = calculateEMA(closes.slice(0, -3), 9);
  const ema21Prev = calculateEMA(closes.slice(0, -3), 21);

  const currentDiff = Math.abs(ema9 - ema21) / ema21;
  const prevDiff = Math.abs(ema9Prev - ema21Prev) / ema21Prev;

  // Stall khi EMAs đang hội tụ (cách nhau < 0.15%)
  const isStalling = currentDiff < 0.0015;

  // Xác định hướng
  let direction: 'up' | 'down' | 'flat' = 'flat';
  if (ema9 > ema21 && ema9 > ema9Prev) direction = 'up';
  else if (ema9 < ema21 && ema9 < ema9Prev) direction = 'down';

  return { stall: isStalling, direction };
}

// RSI Divergence - giá tăng nhưng RSI giảm (bearish) hoặc ngược lại
function checkRSIDivergence(
  closes: number[],
  lookback: number = 10,
): { hasDivergence: boolean; type: 'bullish' | 'bearish' | null } {
  if (closes.length < lookback + 14) return { hasDivergence: false, type: null };

  const currentPrice = closes[closes.length - 1];
  const prevPrice = closes[closes.length - lookback];
  const currentRSI = calculateRSI(closes, 14);
  const prevRSI = calculateRSI(closes.slice(0, -lookback + 1), 14);

  // Bearish divergence: giá tăng nhưng RSI giảm
  if (currentPrice > prevPrice && currentRSI < prevRSI - 5) {
    return { hasDivergence: true, type: 'bearish' };
  }

  // Bullish divergence: giá giảm nhưng RSI tăng
  if (currentPrice < prevPrice && currentRSI > prevRSI + 5) {
    return { hasDivergence: true, type: 'bullish' };
  }

  return { hasDivergence: false, type: null };
}

// === HELPER FUNCTIONS ===
function loadData(filename: string): Candle[] {
  const filePath = path.join(__dirname, '..', 'data', filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function toTimeframeData(candles: Candle[]): TimeframeData {
  return {
    opens: candles.map((c) => c.open),
    closes: candles.map((c) => c.close),
    highs: candles.map((c) => c.high),
    lows: candles.map((c) => c.low),
    volumes: candles.map((c) => c.volume),
    timestamps: candles.map((c) => c.openTime),
  };
}

function emptyStructure(): MarketStructure {
  return {
    trend: 'ranging',
    swingHigh: null,
    swingLow: null,
    premium: 0,
    discount: 0,
    equilibrium: 0,
  };
}

// === ICT ANALYSIS ===
function findSwingPoints(data: TimeframeData): SwingPoint[] {
  const swings: SwingPoint[] = [];
  const lb = SETTINGS.swingLookback;

  for (let i = lb; i < data.closes.length - lb; i++) {
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= lb; j++) {
      if (data.highs[i] <= data.highs[i - j] || data.highs[i] <= data.highs[i + j]) {
        isSwingHigh = false;
      }
      if (data.lows[i] >= data.lows[i - j] || data.lows[i] >= data.lows[i + j]) {
        isSwingLow = false;
      }
    }

    if (isSwingHigh) swings.push({ price: data.highs[i], index: i, type: 'high' });
    if (isSwingLow) swings.push({ price: data.lows[i], index: i, type: 'low' });
  }

  return swings.sort((a, b) => a.index - b.index);
}

function analyzeMarketStructure(data: TimeframeData): MarketStructure {
  if (data.closes.length < 50) return emptyStructure();

  const swings = findSwingPoints(data);
  if (swings.length < 4) return emptyStructure();

  const recentSwings = swings.slice(-10);
  const swingHighs = recentSwings.filter((s) => s.type === 'high');
  const swingLows = recentSwings.filter((s) => s.type === 'low');

  if (swingHighs.length < 2 || swingLows.length < 2) return emptyStructure();

  const latestHigh = swingHighs[swingHighs.length - 1];
  const prevHigh = swingHighs[swingHighs.length - 2];
  const latestLow = swingLows[swingLows.length - 1];
  const prevLow = swingLows[swingLows.length - 2];

  const higherHighs = latestHigh.price > prevHigh.price;
  const higherLows = latestLow.price > prevLow.price;
  const lowerHighs = latestHigh.price < prevHigh.price;
  const lowerLows = latestLow.price < prevLow.price;

  let trend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
  if (higherHighs && higherLows) trend = 'bullish';
  else if (lowerHighs && lowerLows) trend = 'bearish';

  const rangeHigh = Math.max(latestHigh.price, prevHigh.price);
  const rangeLow = Math.min(latestLow.price, prevLow.price);
  const equilibrium = (rangeHigh + rangeLow) / 2;

  return {
    trend,
    swingHigh: latestHigh,
    swingLow: latestLow,
    premium: equilibrium + (rangeHigh - equilibrium) * 0.5,
    discount: equilibrium - (equilibrium - rangeLow) * 0.5,
    equilibrium,
  };
}

function identifyOrderBlocks(data: TimeframeData): OrderBlock[] {
  const obs: OrderBlock[] = [];
  const len = data.closes.length;

  for (let i = 3; i < Math.min(len - 1, SETTINGS.obLookback); i++) {
    const idx = len - 1 - i;

    // Bullish OB
    const isBearish = data.closes[idx] < data.opens[idx];
    const nextBullish = data.closes[idx + 1] > data.opens[idx + 1];
    const strongBullMove = (data.closes[idx + 1] - data.opens[idx + 1]) / data.opens[idx + 1] > 0.001;

    if (isBearish && nextBullish && strongBullMove) {
      const moveAfter = Math.max(...data.highs.slice(idx + 1, idx + 5)) - data.highs[idx];
      const strength = Math.min(moveAfter / data.highs[idx] / 0.005, 1);
      obs.push({ high: data.highs[idx], low: data.lows[idx], type: 'bullish', index: idx, strength });
    }

    // Bearish OB
    const isBullish = data.closes[idx] > data.opens[idx];
    const nextBearish = data.closes[idx + 1] < data.opens[idx + 1];
    const strongBearMove = (data.opens[idx + 1] - data.closes[idx + 1]) / data.opens[idx + 1] > 0.001;

    if (isBullish && nextBearish && strongBearMove) {
      const moveAfter = data.lows[idx] - Math.min(...data.lows.slice(idx + 1, idx + 5));
      const strength = Math.min(moveAfter / data.lows[idx] / 0.005, 1);
      obs.push({ high: data.highs[idx], low: data.lows[idx], type: 'bearish', index: idx, strength });
    }
  }

  return obs.filter((ob) => ob.strength > 0.3).slice(0, 5);
}

function identifyFairValueGaps(data: TimeframeData): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  const len = data.closes.length;

  for (let i = 2; i < Math.min(len - 1, 20); i++) {
    const idx = len - 1 - i;

    // Bullish FVG
    const bullishGapHigh = data.lows[idx + 2];
    const bullishGapLow = data.highs[idx];
    if (bullishGapHigh > bullishGapLow) {
      const gapSize = (bullishGapHigh - bullishGapLow) / data.closes[idx];
      if (gapSize > SETTINGS.fvgMinSize) {
        fvgs.push({
          high: bullishGapHigh,
          low: bullishGapLow,
          type: 'bullish',
          midpoint: (bullishGapHigh + bullishGapLow) / 2,
        });
      }
    }

    // Bearish FVG
    const bearishGapHigh = data.lows[idx];
    const bearishGapLow = data.highs[idx + 2];
    if (bearishGapHigh > bearishGapLow) {
      const gapSize = (bearishGapHigh - bearishGapLow) / data.closes[idx];
      if (gapSize > SETTINGS.fvgMinSize) {
        fvgs.push({
          high: bearishGapHigh,
          low: bearishGapLow,
          type: 'bearish',
          midpoint: (bearishGapHigh + bearishGapLow) / 2,
        });
      }
    }
  }

  return fvgs.slice(0, 5);
}

function checkLiquiditySweep(
  data: TimeframeData,
  structure: MarketStructure,
): { swept: boolean; type: 'high' | 'low' | null } {
  if (!structure.swingHigh || !structure.swingLow) return { swept: false, type: null };

  const currentHigh = data.highs[data.highs.length - 1];
  const currentLow = data.lows[data.lows.length - 1];
  const currentClose = data.closes[data.closes.length - 1];

  const swingHigh = structure.swingHigh.price;
  const swingLow = structure.swingLow.price;

  if (currentHigh > swingHigh * (1 + SETTINGS.liquiditySweepThreshold) && currentClose < swingHigh) {
    return { swept: true, type: 'high' };
  }

  if (currentLow < swingLow * (1 - SETTINGS.liquiditySweepThreshold) && currentClose > swingLow) {
    return { swept: true, type: 'low' };
  }

  return { swept: false, type: null };
}

function isInOTEZone(price: number, structure: MarketStructure): boolean {
  if (!structure.swingHigh || !structure.swingLow) return false;

  const range = structure.swingHigh.price - structure.swingLow.price;
  if (range <= 0) return false;

  if (structure.trend === 'bullish') {
    const retracement = (structure.swingHigh.price - price) / range;
    return retracement >= SETTINGS.oteZoneLow && retracement <= SETTINGS.oteZoneHigh;
  }

  if (structure.trend === 'bearish') {
    const retracement = (price - structure.swingLow.price) / range;
    return retracement >= SETTINGS.oteZoneLow && retracement <= SETTINGS.oteZoneHigh;
  }

  return false;
}

function isKillZone(timestamp: number): boolean {
  const date = new Date(timestamp);
  const utcHour = date.getUTCHours();
  return (utcHour >= 7 && utcHour <= 10) || (utcHour >= 12 && utcHour <= 15) || (utcHour >= 10 && utcHour <= 12);
}

// === MAIN TREND DETERMINATION ===
function getMainTrend(dailyTrend: string, h8Trend: string, h4Trend: string): 'bullish' | 'bearish' | 'neutral' {
  const trends = [dailyTrend, h8Trend, h4Trend];
  const bullishCount = trends.filter((t) => t === 'bullish').length;
  const bearishCount = trends.filter((t) => t === 'bearish').length;

  if (bullishCount >= 2) return 'bullish';
  if (bearishCount >= 2) return 'bearish';
  return 'neutral';
}

// === SIGNAL GENERATION ===
function generateSignal(
  price: number,
  timestamp: number,
  mainTrend: 'bullish' | 'bearish' | 'neutral',
  htfStructure: MarketStructure,
  ltfStructure: MarketStructure,
  ltfData: TimeframeData,
  orderBlocks: OrderBlock[],
  fairValueGaps: FairValueGap[],
): { side: 'LONG' | 'SHORT'; confidence: number; reasons: string[] } | null {
  // === ĐIỀU KIỆN TIÊN QUYẾT ===
  // 1. Phải có xu hướng rõ ràng
  if (mainTrend === 'neutral') return null;

  // 2. Phải trong Kill Zone (London/NY session)
  const inKillZone = isKillZone(timestamp);
  if (!inKillZone) return null;

  // === TECHNICAL INDICATORS ===
  const rsi = calculateRSI(ltfData.closes, 14);
  const bb = calculateBollingerBands(ltfData.closes, 20, 2);
  const macd = calculateMACD(ltfData.closes);
  const ema9 = calculateEMA(ltfData.closes, 9);
  const ema21 = calculateEMA(ltfData.closes, 21);
  const emaStall = isEMAStall(ltfData.closes);
  const rsiDivergence = checkRSIDivergence(ltfData.closes, 10);
  const volumeSpike = isVolumeSpike(ltfData.volumes, 1.5);

  const reasons: string[] = [];
  let confidence = 0;

  // Base confidence từ trend confirmation
  reasons.push(`Trend:${mainTrend.toUpperCase()}`);
  confidence += 40; // Xu hướng chính được xác nhận từ HTF
  confidence += 20; // Kill Zone bonus
  reasons.push('KZ');

  const sweep = checkLiquiditySweep(ltfData, ltfStructure);
  const inOTE = isInOTEZone(price, ltfStructure);

  // === SHORT SIGNAL (khi mainTrend = bearish) ===
  if (mainTrend === 'bearish') {
    // ĐK1: RSI PHẢI > 70 (overbought) - BẮT BUỘC
    if (rsi < SETTINGS.rsiOverbought) return null;

    if (rsi > 80) {
      confidence += 50; // Cực kỳ overbought - HOÀN HẢO
      reasons.push(`RSI:${rsi.toFixed(0)}!!!`);
    } else if (rsi > 75) {
      confidence += 40;
      reasons.push(`RSI:${rsi.toFixed(0)}!!`);
    } else {
      confidence += 30;
      reasons.push(`RSI:${rsi.toFixed(0)}!`);
    }

    // ĐK2: Giá tại hoặc vượt BB Upper - BẮT BUỘC
    if (price < bb.upper * 0.998) return null;

    if (price >= bb.upper * 1.005) {
      confidence += 40; // Vượt BB - HOÀN HẢO
      reasons.push('BB+++');
    } else if (price >= bb.upper) {
      confidence += 30;
      reasons.push('BB++');
    } else {
      confidence += 20;
      reasons.push('BB+');
    }

    // ĐK3: EMA stall hoặc bearish crossover
    if (emaStall.stall) {
      confidence += 25;
      reasons.push('EMA_STALL');
    } else if (ema9 < ema21) {
      confidence += 20;
      reasons.push('EMA↓');
    }

    // ĐK4: RSI Bearish Divergence - BONUS LỚN
    if (rsiDivergence.hasDivergence && rsiDivergence.type === 'bearish') {
      confidence += 35;
      reasons.push('RSI_DIV↓');
    }

    // ĐK5: MACD bearish
    if (macd.histogram < 0 || macd.macd < macd.signal) {
      confidence += 15;
      reasons.push('MACD-');
    }

    // ĐK6: HTF confirmation
    if (htfStructure.trend === 'bearish') {
      confidence += 20;
      reasons.push('HTF↓');
    }

    // === ICT CONFIRMATIONS ===
    // OTE Zone
    if (inOTE) {
      confidence += 20;
      reasons.push('OTE');
    }

    // Premium Zone
    if (price > ltfStructure.premium) {
      confidence += 20;
      reasons.push('Premium');
    }

    // Bearish Order Block
    const atBearishOB = orderBlocks.find(
      (ob) => ob.type === 'bearish' && price >= ob.low * 0.998 && price <= ob.high * 1.002,
    );
    if (atBearishOB) {
      confidence += 25;
      reasons.push('OB');
    }

    // Bearish FVG
    const atBearishFVG = fairValueGaps.find(
      (fvg) => fvg.type === 'bearish' && price >= fvg.low && price <= fvg.high,
    );
    if (atBearishFVG) {
      confidence += 20;
      reasons.push('FVG');
    }

    // Liquidity Sweep High
    if (sweep.swept && sweep.type === 'high') {
      confidence += 30;
      reasons.push('SWEEP↑');
    }

    // Volume spike
    if (volumeSpike) {
      confidence += 15;
      reasons.push('VOL↑');
    }

    if (confidence >= SETTINGS.minConfidence) {
      return { side: 'SHORT', confidence, reasons };
    }
  }

  // === LONG SIGNAL (khi mainTrend = bullish) ===
  if (mainTrend === 'bullish') {
    // ĐK1: RSI PHẢI < 28 (oversold) - BẮT BUỘC
    if (rsi > SETTINGS.rsiOversold) return null;

    if (rsi < 20) {
      confidence += 50; // Cực kỳ oversold - HOÀN HẢO
      reasons.push(`RSI:${rsi.toFixed(0)}!!!`);
    } else if (rsi < 25) {
      confidence += 40;
      reasons.push(`RSI:${rsi.toFixed(0)}!!`);
    } else {
      confidence += 30;
      reasons.push(`RSI:${rsi.toFixed(0)}!`);
    }

    // ĐK2: Giá tại hoặc dưới BB Lower - BẮT BUỘC
    if (price > bb.lower * 1.002) return null;

    if (price <= bb.lower * 0.995) {
      confidence += 40;
      reasons.push('BB---');
    } else if (price <= bb.lower) {
      confidence += 30;
      reasons.push('BB--');
    } else {
      confidence += 20;
      reasons.push('BB-');
    }

    // ĐK3: EMA stall hoặc bullish crossover
    if (emaStall.stall) {
      confidence += 25;
      reasons.push('EMA_STALL');
    } else if (ema9 > ema21) {
      confidence += 20;
      reasons.push('EMA↑');
    }

    // ĐK4: RSI Bullish Divergence
    if (rsiDivergence.hasDivergence && rsiDivergence.type === 'bullish') {
      confidence += 35;
      reasons.push('RSI_DIV↑');
    }

    // ĐK5: MACD bullish
    if (macd.histogram > 0 || macd.macd > macd.signal) {
      confidence += 15;
      reasons.push('MACD+');
    }

    // ĐK6: HTF confirmation
    if (htfStructure.trend === 'bullish') {
      confidence += 20;
      reasons.push('HTF↑');
    }

    // === ICT CONFIRMATIONS ===
    if (inOTE) {
      confidence += 20;
      reasons.push('OTE');
    }

    if (price < ltfStructure.discount) {
      confidence += 20;
      reasons.push('Discount');
    }

    const atBullishOB = orderBlocks.find(
      (ob) => ob.type === 'bullish' && price >= ob.low * 0.998 && price <= ob.high * 1.002,
    );
    if (atBullishOB) {
      confidence += 25;
      reasons.push('OB');
    }

    const atBullishFVG = fairValueGaps.find(
      (fvg) => fvg.type === 'bullish' && price >= fvg.low && price <= fvg.high,
    );
    if (atBullishFVG) {
      confidence += 20;
      reasons.push('FVG');
    }

    if (sweep.swept && sweep.type === 'low') {
      confidence += 30;
      reasons.push('SWEEP↓');
    }

    if (volumeSpike) {
      confidence += 15;
      reasons.push('VOL↑');
    }

    if (confidence >= SETTINGS.minConfidence) {
      return { side: 'LONG', confidence, reasons };
    }
  }

  return null;
}

// === BACKTEST ===
async function runBacktest() {
  console.log('='.repeat(60));
  console.log('BTC ICT FUTURES STRATEGY - Multi-Timeframe Backtest');
  console.log('='.repeat(60));

  // Load data
  console.log('\nLoading data...');
  const dailyCandles = loadData('btc_1d_365d.json');
  const h8Candles = loadData('btc_8h_365d.json');
  const h4Candles = loadData('btc_4h_365d.json');
  const h1Candles = loadData('btc_1h_180d.json'); // Use as HTF
  const entryCandles = loadData('btc_5m_30d.json'); // Entry timeframe

  if (!dailyCandles.length || !h4Candles.length || !entryCandles.length) {
    console.log('\n⚠️ Missing data files. Running fetch script first...');
    console.log('Run: npx tsx scripts/fetch-btc-data.ts');
    return;
  }

  console.log(`Daily: ${dailyCandles.length} candles`);
  console.log(`H8: ${h8Candles.length} candles`);
  console.log(`H4: ${h4Candles.length} candles`);
  console.log(`H1 (HTF): ${h1Candles.length} candles`);
  console.log(`5m (Entry): ${entryCandles.length} candles`);

  // Initialize structures
  const dailyData = toTimeframeData(dailyCandles);
  const h8Data = h8Candles.length ? toTimeframeData(h8Candles) : toTimeframeData(h4Candles);
  const h4Data = toTimeframeData(h4Candles);
  const htfData = toTimeframeData(h1Candles);

  const dailyStructure = analyzeMarketStructure(dailyData);
  const h8Structure = analyzeMarketStructure(h8Data);
  const h4Structure = analyzeMarketStructure(h4Data);
  let htfStructure = analyzeMarketStructure(htfData);

  let mainTrend = getMainTrend(dailyStructure.trend, h8Structure.trend, h4Structure.trend);

  console.log('\n=== MULTI-TIMEFRAME ANALYSIS ===');
  console.log(`Daily Trend: ${dailyStructure.trend}`);
  console.log(`H8 Trend: ${h8Structure.trend}`);
  console.log(`H4 Trend: ${h4Structure.trend}`);
  console.log(`HTF (1h) Trend: ${htfStructure.trend}`);
  console.log(`>>> MAIN TREND: ${mainTrend.toUpperCase()} <<<`);
  console.log('================================\n');

  // Initialize LTF data with warmup
  const warmupCount = 200;
  const warmup = entryCandles.slice(0, warmupCount);
  let ltfData = toTimeframeData(warmup);
  let ltfStructure = analyzeMarketStructure(ltfData);
  let orderBlocks = identifyOrderBlocks(ltfData);
  let fairValueGaps = identifyFairValueGaps(ltfData);

  // Backtest
  const trades: any[] = [];
  let currentPosition: any = null;
  let totalProfit = 0;
  let highestProfit = 0;
  let lastTradeTime = 0;

  const testCandles = entryCandles.slice(warmupCount);
  console.log(`\nRunning backtest on ${testCandles.length} candles...\n`);

  for (let i = 0; i < testCandles.length; i++) {
    const candle = testCandles[i];
    const price = candle.close;

    // Update LTF data
    ltfData.opens.push(candle.open);
    ltfData.closes.push(candle.close);
    ltfData.highs.push(candle.high);
    ltfData.lows.push(candle.low);
    ltfData.volumes.push(candle.volume);
    ltfData.timestamps.push(candle.openTime);

    if (ltfData.closes.length > 500) {
      ltfData.opens.shift();
      ltfData.closes.shift();
      ltfData.highs.shift();
      ltfData.lows.shift();
      ltfData.volumes.shift();
      ltfData.timestamps.shift();
    }

    // Update analysis every 15 candles
    if (i % 15 === 0) {
      ltfStructure = analyzeMarketStructure(ltfData);
      orderBlocks = identifyOrderBlocks(ltfData);
      fairValueGaps = identifyFairValueGaps(ltfData);
    }

    // Update HTF analysis every 100 candles
    if (i % 100 === 0 && i > 0) {
      htfStructure = analyzeMarketStructure(htfData);
      // In real trading, we would fetch new HTF data here
    }

    // === EXIT LOGIC ===
    if (currentPosition) {
      const pnlPct =
        currentPosition.side === 'LONG'
          ? (price - currentPosition.entryPrice) / currentPosition.entryPrice
          : (currentPosition.entryPrice - price) / currentPosition.entryPrice;

      const profit =
        pnlPct * SETTINGS.usdPerTrade * SETTINGS.maxLeverage -
        SETTINGS.usdPerTrade * SETTINGS.maxLeverage * SETTINGS.takerFee * 2;

      if (profit > highestProfit) highestProfit = profit;

      let exitType = '';

      if (pnlPct >= SETTINGS.profitTargetPct) {
        exitType = 'TAKE_PROFIT';
      } else if (pnlPct <= -SETTINGS.stopLossPct) {
        exitType = 'STOP_LOSS';
      } else if (highestProfit > SETTINGS.trailingActivation * SETTINGS.usdPerTrade * SETTINGS.maxLeverage) {
        if (profit < highestProfit - SETTINGS.trailingDistance * SETTINGS.usdPerTrade * SETTINGS.maxLeverage) {
          exitType = 'TRAILING';
        }
      } else if (SETTINGS.enableICTExit) {
        // ICT OB Exit (optional - disabled by default to let profits run)
        if (currentPosition.side === 'LONG') {
          const atBearishOB = orderBlocks.find(
            (ob) => ob.type === 'bearish' && price >= ob.low && price <= ob.high,
          );
          if (atBearishOB && profit > 0) exitType = 'ICT_OB_EXIT';
        } else {
          const atBullishOB = orderBlocks.find(
            (ob) => ob.type === 'bullish' && price >= ob.low && price <= ob.high,
          );
          if (atBullishOB && profit > 0) exitType = 'ICT_OB_EXIT';
        }
      }

      if (exitType) {
        trades.push({
          side: currentPosition.side,
          entryPrice: currentPosition.entryPrice,
          exitPrice: price,
          profit,
          exitType,
          entryTime: currentPosition.entryTime,
          exitTime: candle.openTime,
        });

        totalProfit += profit;
        console.log(
          `[${i}] EXIT ${currentPosition.side} | ${exitType} | ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`,
        );

        currentPosition = null;
        highestProfit = 0;
        lastTradeTime = candle.closeTime;
      }
    }

    // === ENTRY LOGIC ===
    if (!currentPosition && candle.closeTime - lastTradeTime >= SETTINGS.cooldownMs) {
      const signal = generateSignal(
        price,
        candle.closeTime,
        mainTrend,
        htfStructure,
        ltfStructure,
        ltfData,
        orderBlocks,
        fairValueGaps,
      );

      if (signal) {
        currentPosition = {
          side: signal.side,
          entryPrice: price,
          entryTime: candle.openTime,
        };
        highestProfit = 0;

        console.log(
          `[${i}] ENTER ${signal.side} @ $${price.toFixed(2)} | Conf: ${signal.confidence} | ${signal.reasons.join(', ')}`,
        );
      }
    }
  }

  // Close open position
  if (currentPosition) {
    const lastPrice = testCandles[testCandles.length - 1].close;
    const pnlPct =
      currentPosition.side === 'LONG'
        ? (lastPrice - currentPosition.entryPrice) / currentPosition.entryPrice
        : (currentPosition.entryPrice - lastPrice) / currentPosition.entryPrice;
    const profit =
      pnlPct * SETTINGS.usdPerTrade * SETTINGS.maxLeverage -
      SETTINGS.usdPerTrade * SETTINGS.maxLeverage * SETTINGS.takerFee * 2;

    trades.push({
      side: currentPosition.side,
      entryPrice: currentPosition.entryPrice,
      exitPrice: lastPrice,
      profit,
      exitType: 'END_OF_DATA',
    });
    totalProfit += profit;
  }

  // Print results
  printResults(trades, totalProfit);
}

function printResults(trades: any[], totalProfit: number) {
  const wins = trades.filter((t) => t.profit > 0).length;
  const losses = trades.filter((t) => t.profit <= 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

  console.log('\n' + '='.repeat(60));
  console.log('BTC ICT FUTURES MTF BACKTEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Capital: $${SETTINGS.usdPerTrade} | Leverage: ${SETTINGS.maxLeverage}x`);
  console.log(`TP: ${SETTINGS.profitTargetPct * 100}% | SL: ${SETTINGS.stopLossPct * 100}%`);
  console.log('-'.repeat(60));
  console.log(`Total Trades: ${trades.length}`);
  console.log(`Wins: ${wins} | Losses: ${losses}`);
  console.log(`Win Rate: ${winRate.toFixed(1)}%`);
  console.log(`Total Profit: $${totalProfit.toFixed(2)}`);
  console.log(`ROI: ${((totalProfit / SETTINGS.usdPerTrade) * 100).toFixed(2)}%`);

  if (trades.length > 0) {
    const avgWin = wins > 0 ? trades.filter((t) => t.profit > 0).reduce((s, t) => s + t.profit, 0) / wins : 0;
    const avgLoss =
      losses > 0 ? Math.abs(trades.filter((t) => t.profit <= 0).reduce((s, t) => s + t.profit, 0)) / losses : 0;

    console.log(`\nAvg Win: $${avgWin.toFixed(2)}`);
    console.log(`Avg Loss: $${avgLoss.toFixed(2)}`);
    console.log(`Risk/Reward: ${avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : 'N/A'}`);

    // Exit types
    const exitTypes: Record<string, number> = {};
    trades.forEach((t) => {
      exitTypes[t.exitType] = (exitTypes[t.exitType] || 0) + 1;
    });
    console.log('\nExit Types:');
    Object.entries(exitTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} (${((count / trades.length) * 100).toFixed(1)}%)`);
    });

    // Long vs Short
    const longTrades = trades.filter((t) => t.side === 'LONG');
    const shortTrades = trades.filter((t) => t.side === 'SHORT');
    console.log('\nBy Side:');
    console.log(
      `  LONG: ${longTrades.length} | WR: ${longTrades.length > 0 ? ((longTrades.filter((t) => t.profit > 0).length / longTrades.length) * 100).toFixed(1) : 0}% | P/L: $${longTrades.reduce((s, t) => s + t.profit, 0).toFixed(2)}`,
    );
    console.log(
      `  SHORT: ${shortTrades.length} | WR: ${shortTrades.length > 0 ? ((shortTrades.filter((t) => t.profit > 0).length / shortTrades.length) * 100).toFixed(1) : 0}% | P/L: $${shortTrades.reduce((s, t) => s + t.profit, 0).toFixed(2)}`,
    );
  }

  console.log('='.repeat(60) + '\n');
}

runBacktest().catch(console.error);
