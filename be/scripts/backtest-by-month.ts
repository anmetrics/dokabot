/**
 * Backtest script that analyzes trades by month
 * Helps identify problematic periods and stop loss patterns
 *
 * Run: npx tsx scripts/backtest-by-month.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { FuturesEmaStrategy } from '../src/modules/strategy/strategies/futures/future.strategy';

type Candle = {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  baseAssetVolume: string;
  quoteAssetVolume: string;
};

// Load data from JSON files
function loadData(filename: string): Candle[] {
  const filePath = path.join(__dirname, '..', 'data', filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return [];
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  return data.map((c: any) => ({
    openTime: c.openTime,
    open: String(c.open),
    high: String(c.high),
    low: String(c.low),
    close: String(c.close),
    volume: String(c.volume),
    closeTime: c.closeTime,
    quoteVolume: '0',
    trades: 0,
    baseAssetVolume: '0',
    quoteAssetVolume: '0',
  }));
}

// Filter candles by month
function filterByMonth(candles: Candle[], year: number, month: number): Candle[] {
  return candles.filter((c) => {
    const d = new Date(c.openTime);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

// Simple backtest runner that returns trades
function runMonthBacktest(
  dailyData: Candle[],
  h8Data: Candle[],
  h4Data: Candle[],
  htfData: Candle[],
  ltfData: Candle[],
  settings: {
    leverage: number;
    usdPerTrade: number;
    profitTargetPct: number;
    stopLossPct: number;
    minConfidence: number;
    rsiOverbought: number;
    rsiOversold: number;
  },
) {
  const strategy = new FuturesEmaStrategy(null);

  strategy.setBacktestData({
    daily: dailyData,
    h8: h8Data.length ? h8Data : h4Data,
    h4: h4Data,
    htf: htfData,
    ltf: ltfData,
  });

  return strategy.runBacktestAndGetResults(settings);
}

async function main() {
  console.log('='.repeat(70));
  console.log('BACKTEST BY MONTH - Stop Loss Analysis');
  console.log('='.repeat(70));

  // Load all data
  const dailyData = loadData('btc_1d_365d.json');
  const h8Data = loadData('btc_8h_365d.json');
  const h4Data = loadData('btc_4h_365d.json');
  const htfData = loadData('btc_1h_180d.json');
  const ltfData = loadData('btc_3m_90d.json');

  if (!dailyData.length || !h4Data.length || !ltfData.length) {
    console.log('\nMissing data files!');
    return;
  }

  const settings = {
    leverage: 100, // Full leverage
    usdPerTrade: 200, // Scale lên $200 per trade để đạt $500/tháng
    profitTargetPct: 0.015, // 1.5% TP
    stopLossPct: 0.005, // 0.5% SL → R:R = 3:1
    minConfidence: 175, // More trades
    rsiOverbought: 70,
    rsiOversold: 30,
  };

  console.log('\nSettings:', settings);
  console.log('');

  // Get date range from LTF data
  const firstDate = new Date(ltfData[0].openTime);
  const lastDate = new Date(ltfData[ltfData.length - 1].openTime);
  console.log(`Data range: ${firstDate.toISOString().split('T')[0]} to ${lastDate.toISOString().split('T')[0]}`);
  console.log('');

  // Test each month
  const months = [
    { year: 2026, month: 1, name: 'Jan 2026' },
    { year: 2025, month: 12, name: 'Dec 2025' },
    { year: 2025, month: 11, name: 'Nov 2025' },
  ];

  for (const { year, month, name } of months) {
    console.log('='.repeat(70));
    console.log(`MONTH: ${name}`);
    console.log('='.repeat(70));

    // Filter LTF data for this month (plus some warmup)
    const monthStart = new Date(year, month - 1, 1).getTime();
    const monthEnd = new Date(year, month, 0, 23, 59, 59).getTime();

    // Get candles for this month plus 500 warmup candles before
    const monthStartIndex = ltfData.findIndex((c) => c.openTime >= monthStart);
    if (monthStartIndex < 0) {
      console.log(`No data for ${name}\n`);
      continue;
    }

    const warmupStart = Math.max(0, monthStartIndex - 500);
    const monthEndIndex = ltfData.findIndex((c) => c.openTime > monthEnd);
    const endIndex = monthEndIndex > 0 ? monthEndIndex : ltfData.length;

    const monthLtf = ltfData.slice(warmupStart, endIndex);

    if (monthLtf.length < 600) {
      console.log(`Not enough data for ${name} (${monthLtf.length} candles)\n`);
      continue;
    }

    console.log(`Candles: ${monthLtf.length} (including 500 warmup)`);

    // Run backtest
    const results = runMonthBacktest(
      dailyData,
      h8Data,
      h4Data,
      htfData,
      monthLtf,
      settings,
    );

    console.log(`\nRESULTS:`);
    console.log(`  Total Trades: ${results.totalTrades}`);
    console.log(`  Wins: ${results.wins} | Losses: ${results.losses}`);
    console.log(`  Win Rate: ${results.winRate.toFixed(1)}%`);
    console.log(`  Total Profit: $${results.totalProfit.toFixed(2)}`);
    console.log(`  Avg Win: $${results.avgWin.toFixed(2)} | Avg Loss: $${results.avgLoss.toFixed(2)}`);
    console.log(`  R:R: ${results.riskReward.toFixed(2)}`);

    // Analyze by side
    const longTrades = results.trades.filter((t: any) => t.side === 'LONG');
    const shortTrades = results.trades.filter((t: any) => t.side === 'SHORT');
    const longWins = longTrades.filter((t: any) => t.profit > 0).length;
    const shortWins = shortTrades.filter((t: any) => t.profit > 0).length;

    console.log(`\n  BY SIDE (last 50 trades):`);
    console.log(`    LONG: ${longTrades.length} trades, ${longWins} wins (${longTrades.length > 0 ? ((longWins / longTrades.length) * 100).toFixed(1) : 0}% WR)`);
    console.log(`    SHORT: ${shortTrades.length} trades, ${shortWins} wins (${shortTrades.length > 0 ? ((shortWins / shortTrades.length) * 100).toFixed(1) : 0}% WR)`);

    // Analyze stop losses
    const stopLossTrades = results.trades.filter((t: any) => t.exitType === 'STOP_LOSS');
    console.log(`\n  STOP LOSS ANALYSIS (${stopLossTrades.length} trades):`);

    if (stopLossTrades.length > 0) {
      const slLongs = stopLossTrades.filter((t: any) => t.side === 'LONG');
      const slShorts = stopLossTrades.filter((t: any) => t.side === 'SHORT');
      const avgSlLoss = stopLossTrades.reduce((s: number, t: any) => s + Math.abs(t.profit), 0) / stopLossTrades.length;

      console.log(`    LONG SL: ${slLongs.length} | SHORT SL: ${slShorts.length}`);
      console.log(`    Avg SL Loss: $${avgSlLoss.toFixed(2)}`);

      // Show worst 5 stop losses
      const worstSL = stopLossTrades.sort((a: any, b: any) => a.profit - b.profit).slice(0, 5);
      console.log(`\n    WORST STOP LOSSES:`);
      for (const t of worstSL) {
        const entryTime = new Date(t.entryTime).toISOString().split('T').join(' ').split('.')[0];
        console.log(`      ${t.side} @ $${t.entryPrice.toFixed(0)} -> $${t.exitPrice.toFixed(0)} = $${t.profit.toFixed(2)} | ${entryTime}`);
      }
    }

    // Show exit type distribution
    console.log(`\n  EXIT TYPES:`);
    for (const [type, count] of Object.entries(results.exitTypes)) {
      console.log(`    ${type}: ${count}`);
    }

    console.log('');
  }

  // Full period analysis
  console.log('='.repeat(70));
  console.log('FULL PERIOD ANALYSIS');
  console.log('='.repeat(70));

  const fullResults = runMonthBacktest(
    dailyData,
    h8Data,
    h4Data,
    htfData,
    ltfData,
    settings,
  );

  console.log(`\nTotal Trades: ${fullResults.totalTrades}`);
  console.log(`Win Rate: ${fullResults.winRate.toFixed(1)}%`);
  console.log(`Total Profit: $${fullResults.totalProfit.toFixed(2)}`);
  console.log(`\nIf this is 90 days, monthly avg: $${(fullResults.totalProfit / 3).toFixed(2)}`);
  console.log('Target: $500/month\n');
}

main().catch(console.error);
