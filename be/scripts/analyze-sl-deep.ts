/**
 * Deep Stop Loss Analysis - Tìm nguyên nhân và khắc phục để đạt 99% WR
 * Phân tích: Volume, Price Action, Market Structure trước khi SL
 */

import * as fs from 'fs';
import * as path from 'path';

type Candle = {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
};

function loadData(filename: string): Candle[] {
  const filePath = path.join(__dirname, '..', 'data', filename);
  if (!fs.existsSync(filePath)) return [];
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data.map((c: any) => ({
    openTime: c.openTime,
    open: String(c.open),
    high: String(c.high),
    low: String(c.low),
    close: String(c.close),
    volume: String(c.volume),
    closeTime: c.closeTime,
  }));
}

// Calculate RSI
function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const recentCloses = closes.slice(-period - 1);
  let gains = 0, losses = 0;
  for (let i = 1; i < recentCloses.length; i++) {
    const change = recentCloses[i] - recentCloses[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// Calculate BB
function calcBB(closes: number[], period = 20) {
  if (closes.length < period) {
    const last = closes[closes.length - 1];
    return { upper: last, middle: last, lower: last };
  }
  const recentCloses = closes.slice(-period);
  const sma = recentCloses.reduce((a, b) => a + b) / period;
  const variance = recentCloses.reduce((sum, c) => sum + Math.pow(c - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  return { upper: sma + 2 * std, middle: sma, lower: sma - 2 * std };
}

// Detect volume spike
function getVolumeRatio(volumes: number[], idx: number, lookback = 20): number {
  if (idx < lookback || volumes.length < lookback) return 1;
  const avgVol = volumes.slice(idx - lookback, idx).reduce((a, b) => a + b) / lookback;
  return avgVol > 0 ? volumes[idx] / avgVol : 1;
}

// Check if price is making new high/low
function isNewExtreme(candles: Candle[], idx: number, lookback = 20, type: 'high' | 'low'): boolean {
  if (idx < lookback) return false;
  const current = type === 'high' ? +candles[idx].high : +candles[idx].low;
  for (let i = idx - lookback; i < idx; i++) {
    const val = type === 'high' ? +candles[i].high : +candles[i].low;
    if (type === 'high' && val >= current) return false;
    if (type === 'low' && val <= current) return false;
  }
  return true;
}

// Check momentum before entry
function getMomentum(closes: number[], idx: number): { m3: number; m5: number; m10: number } {
  if (idx < 11) return { m3: 0, m5: 0, m10: 0 };
  return {
    m3: ((closes[idx] - closes[idx - 3]) / closes[idx - 3]) * 100,
    m5: ((closes[idx] - closes[idx - 5]) / closes[idx - 5]) * 100,
    m10: ((closes[idx] - closes[idx - 10]) / closes[idx - 10]) * 100,
  };
}

// Check if candle is rejection (long wick)
function isRejectionCandle(candle: Candle, type: 'bull' | 'bear'): boolean {
  const open = +candle.open;
  const close = +candle.close;
  const high = +candle.high;
  const low = +candle.low;
  const body = Math.abs(close - open);
  const totalRange = high - low;
  if (totalRange === 0) return false;

  if (type === 'bull') {
    // Long lower wick, close near high
    const lowerWick = Math.min(open, close) - low;
    return lowerWick > body * 2 && lowerWick / totalRange > 0.5;
  } else {
    // Long upper wick, close near low
    const upperWick = high - Math.max(open, close);
    return upperWick > body * 2 && upperWick / totalRange > 0.5;
  }
}

// Run backtest and capture detailed trade info
function runDetailedBacktest(ltfData: Candle[], settings: any) {
  const trades: any[] = [];
  let currentPosition: any = null;
  let lastTradeTime = 0;
  const cooldownMs = 120000; // 2 minutes

  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const volumes: number[] = [];

  // Warmup
  for (let i = 0; i < 500 && i < ltfData.length; i++) {
    closes.push(+ltfData[i].close);
    highs.push(+ltfData[i].high);
    lows.push(+ltfData[i].low);
    volumes.push(+ltfData[i].volume);
  }

  for (let i = 500; i < ltfData.length; i++) {
    const candle = ltfData[i];
    const price = +candle.close;

    closes.push(price);
    highs.push(+candle.high);
    lows.push(+candle.low);
    volumes.push(+candle.volume);

    if (closes.length > 500) {
      closes.shift();
      highs.shift();
      lows.shift();
      volumes.shift();
    }

    // Exit logic
    if (currentPosition) {
      const pnlPct = currentPosition.side === 'LONG'
        ? (price - currentPosition.entryPrice) / currentPosition.entryPrice
        : (currentPosition.entryPrice - price) / currentPosition.entryPrice;

      const profit = pnlPct * settings.usdPerTrade * settings.leverage -
        settings.usdPerTrade * settings.leverage * 0.0004 * 2;

      let exitType = '';
      if (pnlPct >= settings.profitTargetPct) exitType = 'TAKE_PROFIT';
      else if (pnlPct <= -settings.stopLossPct) exitType = 'STOP_LOSS';

      if (exitType) {
        // Capture market conditions at exit
        const volRatioAtExit = getVolumeRatio(volumes, volumes.length - 1);
        const momentumAtExit = getMomentum(closes, closes.length - 1);

        trades.push({
          ...currentPosition,
          exitPrice: price,
          exitTime: candle.openTime,
          exitIndex: i,
          profit,
          exitType,
          volRatioAtExit,
          momentumAtExit,
          candlesHeld: i - currentPosition.entryIndex,
        });
        currentPosition = null;
        lastTradeTime = candle.closeTime;
      }
    }

    // Entry logic
    if (!currentPosition && candle.closeTime - lastTradeTime >= cooldownMs) {
      const rsi = calcRSI(closes, 14);
      const bb = calcBB(closes, 20);
      const volRatio = getVolumeRatio(volumes, volumes.length - 1);
      const momentum = getMomentum(closes, closes.length - 1);
      const isNewHigh = isNewExtreme(ltfData, i, 20, 'high');
      const isNewLow = isNewExtreme(ltfData, i, 20, 'low');
      const hasBullRejection = isRejectionCandle(candle, 'bull');
      const hasBearRejection = isRejectionCandle(candle, 'bear');

      let signal: any = null;

      // SHORT signal
      if (rsi >= settings.rsiOverbought && price >= bb.upper * 0.998) {
        signal = {
          side: 'SHORT',
          rsi,
          bbPosition: 'upper',
          volRatio,
          momentum,
          isNewHigh,
          hasBearRejection,
        };
      }

      // LONG signal
      if (rsi <= settings.rsiOversold && price <= bb.lower * 1.002) {
        signal = {
          side: 'LONG',
          rsi,
          bbPosition: 'lower',
          volRatio,
          momentum,
          isNewLow,
          hasBullRejection,
        };
      }

      if (signal) {
        currentPosition = {
          ...signal,
          entryPrice: price,
          entryTime: candle.openTime,
          entryIndex: i,
        };
      }
    }
  }

  return trades;
}

async function main() {
  console.log('='.repeat(70));
  console.log('DEEP STOP LOSS ANALYSIS - Tìm nguyên nhân 99% WR');
  console.log('='.repeat(70));

  const ltfData = loadData('btc_3m_90d.json');
  if (!ltfData.length) {
    console.log('Missing data!');
    return;
  }

  const settings = {
    leverage: 100,
    usdPerTrade: 200,
    profitTargetPct: 0.015,
    stopLossPct: 0.005,
    rsiOverbought: 70,
    rsiOversold: 30,
  };

  console.log('\nSettings:', settings);
  console.log('');

  const trades = runDetailedBacktest(ltfData, settings);
  const stopLosses = trades.filter(t => t.exitType === 'STOP_LOSS');
  const takeProfits = trades.filter(t => t.exitType === 'TAKE_PROFIT');

  console.log(`Total trades: ${trades.length}`);
  console.log(`Take Profits: ${takeProfits.length} (${((takeProfits.length / trades.length) * 100).toFixed(1)}%)`);
  console.log(`Stop Losses: ${stopLosses.length} (${((stopLosses.length / trades.length) * 100).toFixed(1)}%)`);

  // Categorize stop losses by cause
  const causes: Record<string, any[]> = {
    'VOLUME_DUMP_LONG': [], // Volume spike khi LONG bị SL
    'VOLUME_PUMP_SHORT': [], // Volume spike khi SHORT bị SL
    'MOMENTUM_AGAINST_LONG': [], // Momentum vẫn giảm khi vào LONG
    'MOMENTUM_AGAINST_SHORT': [], // Momentum vẫn tăng khi vào SHORT
    'NO_REJECTION_LONG': [], // LONG không có rejection candle
    'NO_REJECTION_SHORT': [], // SHORT không có rejection candle
    'BREAKOUT_LONG': [], // Price breaking new low
    'BREAKOUT_SHORT': [], // Price breaking new high
    'OTHER': [],
  };

  for (const sl of stopLosses) {
    let categorized = false;

    // Check volume at entry
    if (sl.side === 'LONG' && sl.volRatio > 2) {
      causes['VOLUME_DUMP_LONG'].push(sl);
      categorized = true;
    }
    if (sl.side === 'SHORT' && sl.volRatio > 2) {
      causes['VOLUME_PUMP_SHORT'].push(sl);
      categorized = true;
    }

    // Check momentum at entry
    if (sl.side === 'LONG' && sl.momentum.m5 < -0.5) {
      causes['MOMENTUM_AGAINST_LONG'].push(sl);
      categorized = true;
    }
    if (sl.side === 'SHORT' && sl.momentum.m5 > 0.5) {
      causes['MOMENTUM_AGAINST_SHORT'].push(sl);
      categorized = true;
    }

    // Check rejection candle
    if (sl.side === 'LONG' && !sl.hasBullRejection) {
      causes['NO_REJECTION_LONG'].push(sl);
      categorized = true;
    }
    if (sl.side === 'SHORT' && !sl.hasBearRejection) {
      causes['NO_REJECTION_SHORT'].push(sl);
      categorized = true;
    }

    // Check breakout
    if (sl.side === 'LONG' && sl.isNewLow) {
      causes['BREAKOUT_LONG'].push(sl);
      categorized = true;
    }
    if (sl.side === 'SHORT' && sl.isNewHigh) {
      causes['BREAKOUT_SHORT'].push(sl);
      categorized = true;
    }

    if (!categorized) {
      causes['OTHER'].push(sl);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('STOP LOSS CAUSES ANALYSIS');
  console.log('='.repeat(70));

  let totalCaused = 0;
  for (const [cause, slList] of Object.entries(causes)) {
    if (slList.length === 0) continue;
    totalCaused += slList.length;
    const pct = ((slList.length / stopLosses.length) * 100).toFixed(1);
    console.log(`\n${cause}: ${slList.length} (${pct}%)`);

    // Show 3 examples
    for (let i = 0; i < Math.min(3, slList.length); i++) {
      const sl = slList[i];
      const time = new Date(sl.entryTime).toISOString().split('T').join(' ').split('.')[0];
      console.log(`  ${sl.side} @ $${sl.entryPrice.toFixed(0)} | RSI:${sl.rsi.toFixed(0)} | VolRatio:${sl.volRatio.toFixed(2)} | M5:${sl.momentum.m5.toFixed(2)}% | ${time}`);
    }
  }

  // Recommendations
  console.log('\n' + '='.repeat(70));
  console.log('RECOMMENDATIONS FOR 99% WIN RATE');
  console.log('='.repeat(70));

  const longSL = stopLosses.filter(s => s.side === 'LONG');
  const shortSL = stopLosses.filter(s => s.side === 'SHORT');

  console.log(`\nLONG SL: ${longSL.length} | SHORT SL: ${shortSL.length}`);

  if (causes['VOLUME_DUMP_LONG'].length + causes['VOLUME_PUMP_SHORT'].length > stopLosses.length * 0.2) {
    console.log('\n1. VOLUME FILTER: Không entry khi volume đang spike (volRatio > 1.5)');
    console.log('   - Đợi volume giảm về bình thường trước khi entry');
  }

  if (causes['MOMENTUM_AGAINST_LONG'].length + causes['MOMENTUM_AGAINST_SHORT'].length > stopLosses.length * 0.2) {
    console.log('\n2. MOMENTUM FILTER: Không entry khi momentum vẫn mạnh ngược hướng');
    console.log('   - LONG: Chờ m5 > -0.3%');
    console.log('   - SHORT: Chờ m5 < 0.3%');
  }

  if (causes['NO_REJECTION_LONG'].length + causes['NO_REJECTION_SHORT'].length > stopLosses.length * 0.3) {
    console.log('\n3. REJECTION CANDLE: YÊU CẦU có rejection candle trước khi entry');
    console.log('   - LONG: Cần pin bar bullish (long lower wick)');
    console.log('   - SHORT: Cần pin bar bearish (long upper wick)');
  }

  if (causes['BREAKOUT_LONG'].length + causes['BREAKOUT_SHORT'].length > stopLosses.length * 0.1) {
    console.log('\n4. BREAKOUT FILTER: Không entry khi giá đang break new high/low');
    console.log('   - Đây là dấu hiệu trend continuation, không nên counter-trade');
  }

  // Calculate potential improvement
  const preventable =
    causes['VOLUME_DUMP_LONG'].length +
    causes['VOLUME_PUMP_SHORT'].length +
    causes['MOMENTUM_AGAINST_LONG'].length +
    causes['MOMENTUM_AGAINST_SHORT'].length +
    causes['NO_REJECTION_LONG'].length +
    causes['NO_REJECTION_SHORT'].length +
    causes['BREAKOUT_LONG'].length +
    causes['BREAKOUT_SHORT'].length;

  const uniquePreventable = new Set([
    ...causes['VOLUME_DUMP_LONG'],
    ...causes['VOLUME_PUMP_SHORT'],
    ...causes['MOMENTUM_AGAINST_LONG'],
    ...causes['MOMENTUM_AGAINST_SHORT'],
    ...causes['NO_REJECTION_LONG'],
    ...causes['NO_REJECTION_SHORT'],
    ...causes['BREAKOUT_LONG'],
    ...causes['BREAKOUT_SHORT'],
  ]).size;

  console.log('\n' + '='.repeat(70));
  console.log('POTENTIAL IMPROVEMENT');
  console.log('='.repeat(70));
  console.log(`\nPreventable SLs: ${uniquePreventable} / ${stopLosses.length}`);
  const newWR = ((trades.length - stopLosses.length + uniquePreventable) / trades.length * 100);
  console.log(`Potential Win Rate: ${newWR.toFixed(1)}%`);

  if (newWR < 99) {
    console.log('\nĐể đạt 99% WR, cần thêm filters:');
    console.log('- RSI extreme hơn (>80 cho SHORT, <20 cho LONG)');
    console.log('- BB extreme hơn (price > upper*1.01 cho SHORT)');
    console.log('- Require 3+ confirmation signals');
    console.log('- Wider SL (0.8-1%) để tránh noise');
    console.log('- Smaller TP (0.5%) để exit nhanh');
  }
}

main().catch(console.error);
