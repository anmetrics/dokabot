/**
 * Backtest script that uses FuturesEmaStrategy from future.strategy.ts
 * Data is loaded from JSON files instead of fetching from Binance
 *
 * Chạy: npx tsx scripts/backtest-futures.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { FuturesEmaStrategy } from '../src/modules/strategy/strategies/futures/future.strategy';

// Load data from JSON files
function loadData(filename: string): any[] {
  const filePath = path.join(__dirname, '..', 'data', filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return [];
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Convert to Candle format expected by strategy
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

async function main() {
  console.log('='.repeat(60));
  console.log('BACKTEST: FuturesEmaStrategy');
  console.log('='.repeat(60));

  // Load all required data
  console.log('\nLoading data from files...');

  const dailyData = loadData('btc_1d_365d.json');
  const h8Data = loadData('btc_8h_365d.json');
  const h4Data = loadData('btc_4h_365d.json');
  const htfData = loadData('btc_1h_180d.json'); // 1h as HTF
  const ltfData = loadData('btc_3m_90d.json'); // 3m as LTF for entry (3 months)

  if (!dailyData.length || !h4Data.length || !ltfData.length) {
    console.log('\n⚠️ Missing data files!');
    console.log('Run: npx tsx scripts/fetch-btc-data.ts');
    return;
  }

  console.log(`Loaded: Daily=${dailyData.length}, H8=${h8Data.length}, H4=${h4Data.length}, HTF=${htfData.length}, LTF=${ltfData.length}`);

  // Create strategy instance without BinanceService (backtest mode)
  const strategy = new FuturesEmaStrategy(null);

  // Inject backtest data
  strategy.setBacktestData({
    daily: dailyData,
    h8: h8Data.length ? h8Data : h4Data, // Fallback to H4 if H8 not available
    h4: h4Data,
    htf: htfData,
    ltf: ltfData,
  });

  // Run the strategy (which will use the injected data)
  await strategy.startAll();
}

main().catch(console.error);
