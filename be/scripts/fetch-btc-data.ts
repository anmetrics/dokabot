/**
 * Fetch BTC historical data từ Binance Futures và lưu JSON
 * Chạy: npx tsx scripts/fetch-btc-data.ts
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

async function fetchBinanceData(
  symbol: string,
  interval: string,
  days: number,
): Promise<Candle[]> {
  const allCandles: Candle[] = [];
  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;
  let currentEnd = endTime;

  console.log(`Fetching ${symbol} ${interval} data for ${days} days...`);

  while (currentEnd > startTime) {
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&endTime=${currentEnd}&limit=1500`;

    try {
      const response = await fetch(url);
      const data = (await response.json()) as any[];

      if (!data || data.length === 0) break;

      const candles = data.map((c) => ({
        openTime: c[0],
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5]),
        closeTime: c[6],
      }));

      allCandles.unshift(...candles);
      currentEnd = data[0][0] - 1;

      process.stdout.write(`\rFetched ${allCandles.length} candles...`);
      await new Promise((r) => setTimeout(r, 200));
    } catch (error) {
      console.error('\nFetch error:', error);
      break;
    }
  }

  console.log(`\nTotal: ${allCandles.length} candles`);
  return allCandles;
}

async function main() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Fetch multiple timeframes including HTF for trend confirmation
  const configs = [
    // Entry timeframes
    { symbol: 'BTCUSDT', interval: '1m', days: 90, filename: 'btc_1m_90d.json' }, // 3 tháng 1m
    {
      symbol: 'BTCUSDT',
      interval: '3m',
      days: 90,
      filename: 'btc_3m_90d.json',
    },
    { symbol: 'BTCUSDT', interval: '5m', days: 90, filename: 'btc_5m_90d.json' },
    { symbol: 'BTCUSDT', interval: '15m', days: 90, filename: 'btc_15m_90d.json' },
    { symbol: 'BTCUSDT', interval: '1h', days: 180, filename: 'btc_1h_180d.json' },
    // Main trend timeframes
    { symbol: 'BTCUSDT', interval: '4h', days: 365, filename: 'btc_4h_365d.json' },
    { symbol: 'BTCUSDT', interval: '8h', days: 365, filename: 'btc_8h_365d.json' },
    { symbol: 'BTCUSDT', interval: '1d', days: 365, filename: 'btc_1d_365d.json' },
  ];

  for (const config of configs) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Fetching ${config.filename}...`);

    const candles = await fetchBinanceData(config.symbol, config.interval, config.days);

    const filePath = path.join(dataDir, config.filename);
    fs.writeFileSync(filePath, JSON.stringify(candles, null, 2));

    console.log(`Saved to ${filePath}`);
    console.log(`Period: ${new Date(candles[0]?.openTime).toISOString()} - ${new Date(candles[candles.length - 1]?.openTime).toISOString()}`);
  }

  console.log('\n✅ All data fetched successfully!');
}

main().catch(console.error);
