/**
 * Deep analysis of stop loss cases
 * Identifies patterns and root causes
 *
 * Run: npx tsx scripts/analyze-stoploss.ts
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

type Trade = {
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  profit: number;
  exitType: string;
  entryTime: number;
  exitTime: number;
  reasons?: string[];
};

// Load data
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

// Calculate price change over N candles
function priceChange(candles: Candle[], from: number, count: number): number {
  if (from + count >= candles.length) return 0;
  const startPrice = +candles[from].close;
  const endPrice = +candles[from + count].close;
  return ((endPrice - startPrice) / startPrice) * 100;
}

// Find candle index by time
function findCandleIndex(candles: Candle[], time: number): number {
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].openTime >= time) return i;
  }
  return -1;
}

// Analyze what happened after entry
function analyzeAfterEntry(candles: Candle[], entryIndex: number, side: 'LONG' | 'SHORT', windowSize = 50) {
  if (entryIndex < 0 || entryIndex + windowSize >= candles.length) return null;

  const entryPrice = +candles[entryIndex].close;
  const analysis: any = {
    entryPrice,
    maxDrawdown: 0,
    maxProfit: 0,
    candlesToMaxDrawdown: 0,
    candlesToMaxProfit: 0,
    priceAfter5: 0,
    priceAfter10: 0,
    priceAfter20: 0,
  };

  for (let i = 1; i <= windowSize; i++) {
    const price = +candles[entryIndex + i].close;
    const high = +candles[entryIndex + i].high;
    const low = +candles[entryIndex + i].low;

    let pnl: number, dd: number;
    if (side === 'LONG') {
      pnl = ((price - entryPrice) / entryPrice) * 100;
      dd = ((low - entryPrice) / entryPrice) * 100;
      const maxUp = ((high - entryPrice) / entryPrice) * 100;
      if (maxUp > analysis.maxProfit) {
        analysis.maxProfit = maxUp;
        analysis.candlesToMaxProfit = i;
      }
    } else {
      pnl = ((entryPrice - price) / entryPrice) * 100;
      dd = ((entryPrice - high) / entryPrice) * 100;
      const maxUp = ((entryPrice - low) / entryPrice) * 100;
      if (maxUp > analysis.maxProfit) {
        analysis.maxProfit = maxUp;
        analysis.candlesToMaxProfit = i;
      }
    }

    if (dd < analysis.maxDrawdown) {
      analysis.maxDrawdown = dd;
      analysis.candlesToMaxDrawdown = i;
    }

    if (i === 5) analysis.priceAfter5 = pnl;
    if (i === 10) analysis.priceAfter10 = pnl;
    if (i === 20) analysis.priceAfter20 = pnl;
  }

  return analysis;
}

// Run manual backtest to capture all trades with reasons
function runDetailedBacktest(ltfData: Candle[], settings: any) {
  const trades: Trade[] = [];
  let currentPosition: any = null;
  let lastTradeTime = 0;
  const cooldownMs = 90000;

  // Initialize data structures
  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const opens: number[] = [];
  const volumes: number[] = [];

  // Warmup
  for (let i = 0; i < 500 && i < ltfData.length; i++) {
    closes.push(+ltfData[i].close);
    highs.push(+ltfData[i].high);
    lows.push(+ltfData[i].low);
    opens.push(+ltfData[i].open);
    volumes.push(+ltfData[i].volume);
  }

  // Process candles
  for (let i = 500; i < ltfData.length; i++) {
    const candle = ltfData[i];
    const price = +candle.close;

    // Update data
    closes.push(price);
    highs.push(+candle.high);
    lows.push(+candle.low);
    opens.push(+candle.open);
    volumes.push(+candle.volume);

    if (closes.length > 500) {
      closes.shift();
      highs.shift();
      lows.shift();
      opens.shift();
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
        trades.push({
          side: currentPosition.side,
          entryPrice: currentPosition.entryPrice,
          exitPrice: price,
          profit,
          exitType,
          entryTime: currentPosition.entryTime,
          exitTime: candle.openTime,
          reasons: currentPosition.reasons,
        });
        currentPosition = null;
        lastTradeTime = candle.closeTime;
      }
    }

    // Entry logic (simplified)
    if (!currentPosition && candle.closeTime - lastTradeTime >= cooldownMs) {
      const rsi = calcRSI(closes, 14);

      // Simple signal generation
      const signal = generateSimpleSignal(price, rsi, closes, settings);
      if (signal) {
        currentPosition = {
          side: signal.side,
          entryPrice: price,
          entryTime: candle.openTime,
          reasons: signal.reasons,
        };
      }
    }
  }

  return trades;
}

function generateSimpleSignal(price: number, rsi: number, closes: number[], settings: any) {
  // Calculate BB
  const period = 20;
  if (closes.length < period) return null;

  const recentCloses = closes.slice(-period);
  const sma = recentCloses.reduce((a, b) => a + b) / period;
  const variance = recentCloses.reduce((sum, c) => sum + Math.pow(c - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  const bbUpper = sma + 2 * std;
  const bbLower = sma - 2 * std;

  const reasons: string[] = [];

  // SHORT signal
  if (rsi >= settings.rsiOverbought && price >= bbUpper * 0.998) {
    reasons.push(`RSI:${rsi.toFixed(0)}`);
    reasons.push('BB_UPPER');
    return { side: 'SHORT' as const, reasons };
  }

  // LONG signal
  if (rsi <= settings.rsiOversold && price <= bbLower * 1.002) {
    reasons.push(`RSI:${rsi.toFixed(0)}`);
    reasons.push('BB_LOWER');
    return { side: 'LONG' as const, reasons };
  }

  // Counter-trend LONG (retracement)
  if (rsi <= 50 && price <= sma) {
    const priceChange5 = closes.length >= 5
      ? ((price - closes[closes.length - 5]) / closes[closes.length - 5]) * 100
      : 0;

    // Only if price dropped significantly
    if (priceChange5 < -1) {
      reasons.push(`RSI:${rsi.toFixed(0)}`);
      reasons.push('RETRACE');
      reasons.push(`DROP:${priceChange5.toFixed(1)}%`);
      return { side: 'LONG' as const, reasons };
    }
  }

  return null;
}

async function main() {
  console.log('='.repeat(70));
  console.log('STOP LOSS DEEP ANALYSIS');
  console.log('='.repeat(70));

  const ltfData = loadData('btc_3m_90d.json');
  if (!ltfData.length) {
    console.log('Missing LTF data!');
    return;
  }

  const settings = {
    leverage: 100,
    usdPerTrade: 20,
    profitTargetPct: 0.008,
    stopLossPct: 0.005,
    rsiOverbought: 65,
    rsiOversold: 38,
  };

  console.log('\nRunning detailed backtest...\n');

  const trades = runDetailedBacktest(ltfData, settings);
  const stopLosses = trades.filter(t => t.exitType === 'STOP_LOSS');

  console.log(`Total trades: ${trades.length}`);
  console.log(`Stop losses: ${stopLosses.length} (${((stopLosses.length / trades.length) * 100).toFixed(1)}%)`);

  // Categorize stop losses
  const categories: Record<string, Trade[]> = {
    'LONG_immediate_reversal': [], // Price continued down after entry
    'LONG_spike_down': [], // Quick spike down then recovered
    'LONG_trend_continuation': [], // Bearish trend continued
    'SHORT_immediate_reversal': [],
    'SHORT_spike_up': [],
    'SHORT_trend_continuation': [],
  };

  for (const trade of stopLosses) {
    const entryIdx = findCandleIndex(ltfData, trade.entryTime);
    if (entryIdx < 0) continue;

    const analysis = analyzeAfterEntry(ltfData, entryIdx, trade.side, 50);
    if (!analysis) continue;

    const prefix = trade.side;

    // Was it a quick spike or sustained move?
    if (analysis.candlesToMaxDrawdown <= 3) {
      // Quick spike
      categories[`${prefix}_spike_${trade.side === 'LONG' ? 'down' : 'up'}`].push(trade);
    } else if (analysis.maxProfit > 0.5) {
      // Eventually would have been profitable
      categories[`${prefix}_immediate_reversal`].push(trade);
    } else {
      // Trend continued against position
      categories[`${prefix}_trend_continuation`].push(trade);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('STOP LOSS CATEGORIES');
  console.log('='.repeat(70));

  for (const [cat, catTrades] of Object.entries(categories)) {
    if (catTrades.length === 0) continue;

    console.log(`\n${cat}: ${catTrades.length} trades`);
    console.log('-'.repeat(50));

    // Show first 3 examples
    for (let i = 0; i < Math.min(3, catTrades.length); i++) {
      const t = catTrades[i];
      const entryIdx = findCandleIndex(ltfData, t.entryTime);
      const analysis = analyzeAfterEntry(ltfData, entryIdx, t.side, 50);

      const entryTime = new Date(t.entryTime).toISOString().split('T').join(' ').split('.')[0];
      console.log(`  ${t.side} @ $${t.entryPrice.toFixed(0)} | ${entryTime}`);
      console.log(`    Reasons: ${t.reasons?.join(', ') || 'N/A'}`);
      console.log(`    Exit: $${t.exitPrice.toFixed(0)} | Loss: $${t.profit.toFixed(2)}`);
      if (analysis) {
        console.log(`    Max Drawdown: ${analysis.maxDrawdown.toFixed(2)}% in ${analysis.candlesToMaxDrawdown} candles`);
        console.log(`    Max Profit potential: ${analysis.maxProfit.toFixed(2)}% in ${analysis.candlesToMaxProfit} candles`);
        console.log(`    P&L after 5/10/20 candles: ${analysis.priceAfter5.toFixed(2)}%/${analysis.priceAfter10.toFixed(2)}%/${analysis.priceAfter20.toFixed(2)}%`);
      }
      console.log('');
    }
  }

  // Summary and recommendations
  console.log('\n' + '='.repeat(70));
  console.log('ROOT CAUSE ANALYSIS & RECOMMENDATIONS');
  console.log('='.repeat(70));

  const longSL = stopLosses.filter(t => t.side === 'LONG');
  const shortSL = stopLosses.filter(t => t.side === 'SHORT');

  console.log(`\nLONG Stop Losses: ${longSL.length} (${((longSL.length / stopLosses.length) * 100).toFixed(1)}%)`);
  console.log(`SHORT Stop Losses: ${shortSL.length} (${((shortSL.length / stopLosses.length) * 100).toFixed(1)}%)`);

  // Analyze patterns
  const spikeDownCount = categories['LONG_spike_down'].length;
  const spikeUpCount = categories['SHORT_spike_up'].length;
  const wouldBeProfitable = categories['LONG_immediate_reversal'].length + categories['SHORT_immediate_reversal'].length;

  console.log(`\nQuick spike stop-outs: ${spikeDownCount + spikeUpCount}`);
  console.log(`Would-be-profitable (SL too tight): ${wouldBeProfitable}`);
  console.log(`Trend continuation (wrong direction): ${stopLosses.length - spikeDownCount - spikeUpCount - wouldBeProfitable}`);

  console.log(`\n${'='.repeat(70)}`);
  console.log('RECOMMENDATIONS:');
  console.log('='.repeat(70));

  if (spikeDownCount + spikeUpCount > stopLosses.length * 0.3) {
    console.log('\n1. WIDEN STOP LOSS: Many trades hit SL due to quick spikes');
    console.log('   Current: 0.5% -> Suggest: 0.7-0.8%');
  }

  if (wouldBeProfitable > stopLosses.length * 0.2) {
    console.log('\n2. SL TOO TIGHT: Many trades would have been profitable');
    console.log('   Consider trailing stop instead of fixed SL');
  }

  if (longSL.length > shortSL.length * 1.5) {
    console.log('\n3. LONG TRADES FAILING: Counter-trend LONGs need stricter entry');
    console.log('   - Increase minConfidence for RETRACE trades');
    console.log('   - Require bullish candle pattern confirmation');
    console.log('   - Wait for RSI divergence before entry');
  }

  if (shortSL.length > longSL.length * 1.5) {
    console.log('\n3. SHORT TRADES FAILING: Need better entry timing');
    console.log('   - Wait for rejection candle at resistance');
    console.log('   - Require volume spike confirmation');
  }

  console.log('\n4. GENERAL IMPROVEMENTS:');
  console.log('   - Add ATR-based dynamic stop loss');
  console.log('   - Avoid entry during high volatility periods');
  console.log('   - Require price to stabilize before entry');
}

main().catch(console.error);
