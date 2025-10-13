/**
 *
 * Ensemble Learning Strategy
 * - Combine multiple weak models (momentum, mean reversion, volatility)
 * - Aggregate into a unified signal
 * - Suitable for SPOT trading
 *
 * Inspired by quant multi-model ensemble (Jim Simons style)
 */

import { EMA } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { BinanceService } from 'src/modules/binance/binance.service';

type ModelScore = { name: string; score: number; weight?: number };

export class EnsembleLearningStrategy {
  private logger = new Logger('EnsembleLearningStrategy');
  private timeframe: '15m' | '1h' = '15m';
  private entryThreshold = 0.6;
  private exitThreshold = 0.2;

  private lastTradeAt: number = 0;
  private cooldownMs = 10 * 60 * 1000; // 10 min cooldown

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
  ) {}

  async start() {
    this.logger.log(`Starting Ensemble Learning Strategy on ${this.symbol}`);
    const candles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      this.timeframe,
      300,
    );
    const closes = candles.map((c) => +c.close);

    this.binanceService.subscribeCandles(
      this.symbol,
      this.timeframe,
      async (c) => {
        closes.push(+c.close);
        if (closes.length > 500) closes.shift();
        await this.onNewBar(closes);
      },
    );
  }

  private async onNewBar(closes: number[]) {
    if (closes.length < 50) return;

    const now = Date.now();
    if (now - this.lastTradeAt < this.cooldownMs) return;

    const price = closes[closes.length - 1];
    const models = this.computeModelScores(closes);
    const aggScore = this.aggregateScores(models);

    console.log(
      `[${this.symbol}] aggScore=${aggScore.toFixed(3)} price=${price.toFixed(4)}`,
    );

    if (Math.abs(aggScore) < this.exitThreshold) {
      console.log('→ EXIT signal');
      // await this.exitPosition(price);
      this.lastTradeAt = now;
      return;
    }

    if (aggScore > this.entryThreshold) {
      console.log('→ BUY signal');
      // await this.enterLong(price);
      this.lastTradeAt = now;
    } else if (aggScore < -this.entryThreshold) {
      console.log('→ SELL signal');
      // await this.enterShort(price);
      this.lastTradeAt = now;
    }
  }

  // -------------------- MODELS ---------------------

  private computeModelScores(closes: number[]): ModelScore[] {
    const scores: ModelScore[] = [];

    // 1️⃣ Momentum
    const ret = closes.at(-1)! / closes.at(-6)! - 1;
    scores.push({ name: 'momentum', score: Math.tanh(ret * 10), weight: 0.5 });

    // 2️⃣ Mean Reversion (z-score)
    const mean = this.mean(closes.slice(-50));
    const std = this.std(closes.slice(-50));
    const z = (closes.at(-1)! - mean) / (std || 1e-8);
    scores.push({ name: 'mean-rev', score: -z, weight: 0.8 });

    // 3️⃣ EMA Crossover
    const emaFast = EMA.calculate({ period: 9, values: closes });
    const emaSlow = EMA.calculate({ period: 21, values: closes });
    const diff = emaFast.at(-1)! - emaSlow.at(-1)!;
    scores.push({
      name: 'ema-cross',
      score: Math.tanh(diff / (emaSlow.at(-1)! * 0.01)),
      weight: 0.7,
    });

    // 4️⃣ Volatility Jump Detector
    const std20 = this.std(closes.slice(-20));
    const jump = closes.at(-1)! - closes.at(-2)!;
    const jumpZ = jump / (std20 || 1e-8);
    scores.push({ name: 'vol-jump', score: Math.tanh(jumpZ), weight: 0.4 });

    return scores;
  }

  // -------------------- AGGREGATION ---------------------

  private aggregateScores(scores: ModelScore[]): number {
    const weighted = scores.map((s) => ({
      v: Math.tanh(s.score) * (s.weight ?? 1),
      w: s.weight ?? 1,
    }));
    const sumW = weighted.reduce((a, b) => a + b.w, 0);
    return Math.max(
      -1,
      Math.min(1, weighted.reduce((a, b) => a + b.v, 0) / sumW),
    );
  }

  // -------------------- HELPERS ---------------------

  private mean(arr: number[]) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private std(arr: number[]) {
    const m = this.mean(arr);
    return Math.sqrt(
      arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1),
    );
  }
}
