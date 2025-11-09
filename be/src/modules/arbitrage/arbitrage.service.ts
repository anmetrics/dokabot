import { Injectable } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import Decimal from 'decimal.js';

interface ArbPair {
  path: string[]; // e.g. ['USDT','SOL','BTC','USDT']
  tradeAmount: number;
  profitThreshold: number;
}

@Injectable()
export class ArbitrageService {
  private pricesMap: Record<string, Decimal> = {};
  private lastTradeTime: number = 0;
  private tradeCooldown = 2000; // 2s cooldown giữa các lệnh

  constructor(private readonly binanceService: BinanceService) {}

  async checkTriangularArbitrageForPair(pair: ArbPair) {
    const [base, mid1, mid2, baseEnd] = pair.path;
    const symbols = [`${mid1}${base}`, `${mid2}${mid1}`, `${mid2}${baseEnd}`];
    const pricesRaw = await this.binanceService.getPrices(symbols);

    const prices = Object.fromEntries(
      Object.entries(pricesRaw).map(([k, v]) => [k, new Decimal(v)]),
    );

    const p1 = prices[`${mid1}${base}`]; // mid1/base
    const p2 = prices[`${mid2}${mid1}`]; // mid2/mid1
    const p3 = prices[`${mid2}${baseEnd}`]; // mid2/base

    if (!p1 || !p2 || !p3) return null;

    const qtyMid1 = new Decimal(pair.tradeAmount).div(p1); // mua mid1 bằng base
    const qtyMid2 = qtyMid1.div(p2); // mua mid2 bằng mid1
    const baseFinal = qtyMid2.mul(p3); // bán mid2 ra base
    const profitPct = baseFinal
      .sub(pair.tradeAmount)
      .div(pair.tradeAmount)
      .mul(100);

    if (profitPct.gte(pair.profitThreshold)) {
      console.log(
        `💰 Arbitrage opportunity detected! Profit: ${profitPct.toFixed(
          3,
        )}% for path ${pair.path.join(' → ')}`,
      );
      return { qtyMid1, qtyMid2, profitPct, prices };
    }
    return null;
  }

  async executeTriangularTradeForPair(pair: ArbPair) {
    // debounce: tránh spam trade
    const now = Date.now();
    if (now - this.lastTradeTime < this.tradeCooldown) return;
    this.lastTradeTime = now;

    const arb = await this.checkTriangularArbitrageForPair(pair);
    if (!arb) return;

    const [base, mid1, mid2, baseEnd] = pair.path;

    try {
      // Buy mid1 bằng base
      await this.binanceService.placeMarketOrder(
        `${mid1}${base}`,
        'BUY',
        arb.qtyMid1.toNumber(),
      );

      // Buy mid2 bằng mid1
      await this.binanceService.placeMarketOrder(
        `${mid2}${mid1}`,
        'BUY',
        arb.qtyMid2.toNumber(),
      );

      // Sell mid2 ra base
      await this.binanceService.placeMarketOrder(
        `${mid2}${baseEnd}`,
        'SELL',
        arb.qtyMid2.toNumber(),
      );

      console.log(
        `✅ Triangular trade executed! Profit ~${arb.profitPct.toFixed(3)}%`,
      );
    } catch (err) {
      console.error('Triangular trade failed: ' + err.message);
    }
  }

  subscribeTriangularBot() {
    const pairs: ArbPair[] = [
      {
        path: ['USDT', 'SOL', 'BTC', 'USDT'],
        tradeAmount: 100,
        profitThreshold: 0.3,
      },
      {
        path: ['USDT', 'ADA', 'BNB', 'USDT'],
        tradeAmount: 50,
        profitThreshold: 0.5,
      },
    ];

    // Tạo danh sách symbol duy nhất để subscribe WS
    const symbols = Array.from(
      new Set(
        pairs.flatMap((pair) => [
          `${pair.path[1]}${pair.path[0]}`,
          `${pair.path[2]}${pair.path[1]}`,
          `${pair.path[2]}${pair.path[0]}`,
        ]),
      ),
    );

    if (!this.binanceService?.client) return;

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.binanceService.client.ws.miniTicker(symbols, async (ticker) => {
      this.pricesMap[ticker.symbol] = new Decimal(ticker.curDayClose);

      for (const pair of pairs) {
        const [base, mid1, mid2, baseEnd] = pair.path;
        if (
          this.pricesMap[`${mid1}${base}`] &&
          this.pricesMap[`${mid2}${mid1}`] &&
          this.pricesMap[`${mid2}${baseEnd}`]
        ) {
          await this.executeTriangularTradeForPair(pair);
        }
      }
    });

    console.log('Triangular arbitrage bot started (realtime)');
  }
}
