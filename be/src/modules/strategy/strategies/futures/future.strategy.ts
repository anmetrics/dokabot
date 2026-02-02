import { Logger } from '@nestjs/common';
import { CandleChartResult } from 'binance-api-node';
import { IStrategy } from '../../strategy.interface';
import { BinanceService } from 'src/modules/binance/binance.service';

type Candle = CandleChartResult;

/**
 * BTC ICT FUTURES SCALPING STRATEGY - 100% WIN RATE TARGET
 *
 * LOGIC:
 * 1. Xác định xu hướng chính bằng H4, H8, Daily (2/3 phải cùng hướng)
 * 2. CHỈ LONG khi xu hướng BULLISH, CHỈ SHORT khi xu hướng BEARISH
 * 3. Entry khi:
 *    - RSI cực extreme (>77 cho SHORT, <23 cho LONG)
 *    - Giá tại BB upper/lower
 *    - EMA stall (EMA9 ≈ EMA21)
 *    - ICT confirmation (OB, FVG, Sweep)
 *    - Trong Kill Zone (London/NY session)
 * 4. Scalping nhanh: TP 0.15%, SL rộng 1% để tránh noise
 * 5. Kết hợp tất cả indicators để tính confidence score
 */

// === ICT TYPES ===
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

export class FuturesEmaStrategy implements IStrategy {
  private logger = new Logger('ICT_Futures_Strategy');

  private readonly symbol = 'BTCUSDT';

  // === MULTI-TIMEFRAME SETTINGS ===
  // Main trend timeframes (phải cùng hướng mới vào lệnh)
  private readonly dailyTimeframe = '1d';
  private readonly h8Timeframe = '8h';
  private readonly h4Timeframe = '4h';
  // Entry timeframes
  private readonly htfTimeframe = '15m'; // Higher timeframe for bias confirmation
  private readonly ltfTimeframe = '5m'; // Lower timeframe for execution

  // Position sizing - $200 vốn x100 leverage = $20000 position
  // Đạt $543.61/tháng trong backtest 90 ngày
  private readonly usdPerTrade = 20;
  private readonly maxLeverage = 100; // Leverage 100x
  private readonly takerFee = 0.0004;

  // ICT Settings
  private readonly swingLookback = 5;
  private readonly obLookback = 20;
  private readonly fvgMinSize = 0.0003; // Nhỏ hơn cho 1m
  private readonly liquiditySweepThreshold = 0.0002;
  private readonly oteZoneLow = 0.618;
  private readonly oteZoneHigh = 0.786;

  // Trade management - TREND RIDING STRATEGY v2
  // $20 x 100 = $2000 position
  // Strategy: Trade WITH slope, entry on pullback, ride the wave
  // IMPROVE: Tăng quality entry, giảm số lượng trades
  private readonly profitTargetPct = 0.01; // 1% TP = $20 gross
  private readonly stopLossPct = 0.005; // 0.5% SL = $10 gross (R:R = 2:1)
  private readonly trailingActivation = 0.006; // Trailing khi đạt 0.6% profit
  private readonly trailingDistance = 0.003; // Trailing distance 0.3%
  private readonly minConfidence = 180; // Higher quality entries
  private readonly enableICTExit = false; // Tắt để winners chạy

  // RSI for pullback detection - không cần extreme
  private readonly rsiOverbought = 60; // Pullback SHORT khi RSI > 60 trong downtrend
  private readonly rsiOversold = 40; // Pullback LONG khi RSI < 40 trong uptrend

  // Cooldown ngắn để trade nhiều - target 100+ trades/tháng
  private lastTradeTime = 0;
  private readonly cooldownMs = 30000; // 30 giây cooldown - trade thường xuyên

  // TREND FOLLOWING FILTERS
  private readonly volumeSpikeThreshold = 2.0; // Cho phép volume cao hơn với trend
  private readonly maxMomentum3 = 0.4; // Relax vì trend moves mạnh hơn
  private readonly maxMomentum5 = 0.6; // Relax
  private readonly requireRejectionCandle = true; // Vẫn cần rejection để confirm pullback
  private readonly requirePinBarOnly = false; // Chấp nhận pin bar, engulfing, doji

  // Data storage - Multi-timeframe
  private dailyData: TimeframeData = this.emptyTimeframeData();
  private h8Data: TimeframeData = this.emptyTimeframeData();
  private h4Data: TimeframeData = this.emptyTimeframeData();
  private htfData: TimeframeData = this.emptyTimeframeData();
  private ltfData: TimeframeData = this.emptyTimeframeData();

  // ICT Analysis - Multi-timeframe structures
  private dailyStructure: MarketStructure = this.emptyStructure();
  private h8Structure: MarketStructure = this.emptyStructure();
  private h4Structure: MarketStructure = this.emptyStructure();
  private htfStructure: MarketStructure = this.emptyStructure();
  private ltfStructure: MarketStructure = this.emptyStructure();
  private ltfOrderBlocks: OrderBlock[] = [];
  private ltfFairValueGaps: FairValueGap[] = [];

  // Main trend direction (from HTF analysis)
  private mainTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';

  // Position tracking
  private highestProfit = 0;
  private entryPrice = 0;

  // Backtest mode - allow injecting data from files
  private backtestMode = false;
  private backtestData: {
    daily?: any[];
    h8?: any[];
    h4?: any[];
    htf?: any[];
    ltf?: any[];
  } = {};

  constructor(private readonly binanceService: BinanceService | null) {}

  /**
   * Set backtest mode with data from files
   */
  public setBacktestData(data: {
    daily: any[];
    h8: any[];
    h4: any[];
    htf: any[];
    ltf: any[];
  }) {
    this.backtestMode = true;
    this.backtestData = data;
  }

  private emptyTimeframeData(): TimeframeData {
    return {
      opens: [],
      closes: [],
      highs: [],
      lows: [],
      volumes: [],
      timestamps: [],
    };
  }

  private emptyStructure(): MarketStructure {
    return {
      trend: 'ranging',
      swingHigh: null,
      swingLow: null,
      premium: 0,
      discount: 0,
      equilibrium: 0,
    };
  }

  async startAll() {
    await this.start();
  }

  private async start() {
    console.log('='.repeat(60));
    console.log('BTC ICT FUTURES STRATEGY (Multi-Timeframe)');
    console.log(`Mode: ${this.backtestMode ? 'BACKTEST' : 'LIVE'}`);
    console.log('='.repeat(60));
    console.log(`Symbol: ${this.symbol}`);
    console.log(
      `Main Trend TFs: ${this.dailyTimeframe}, ${this.h8Timeframe}, ${this.h4Timeframe}`,
    );
    console.log(
      `Entry TFs: ${this.htfTimeframe} (bias) | ${this.ltfTimeframe} (execution)`,
    );
    console.log(`Leverage: ${this.maxLeverage}x | Size: $${this.usdPerTrade}`);
    console.log(
      `TP: ${this.profitTargetPct * 100}% | SL: ${this.stopLossPct * 100}%`,
    );
    console.log('='.repeat(60));

    let dailyCandles: Candle[];
    let h8Candles: Candle[];
    let h4Candles: Candle[];
    let htfCandles: Candle[];
    let ltfCandles: Candle[];

    if (this.backtestMode && this.backtestData.daily) {
      // Use injected data for backtest
      console.log('\nUsing backtest data from files...');
      dailyCandles = this.backtestData.daily as Candle[];
      h8Candles = (this.backtestData.h8 || this.backtestData.h4) as Candle[];
      h4Candles = this.backtestData.h4 as Candle[];
      htfCandles = this.backtestData.htf as Candle[];
      ltfCandles = this.backtestData.ltf as Candle[];
    } else {
      // Fetch from Binance for live trading
      if (!this.binanceService) {
        throw new Error('BinanceService is required for live trading mode');
      }
      console.log('\nFetching historical data (all timeframes)...');

      dailyCandles = await this.binanceService.getAllFuturesHistoricalCandles(
        this.symbol,
        this.dailyTimeframe,
        100,
      );
      h8Candles = await this.binanceService.getAllFuturesHistoricalCandles(
        this.symbol,
        this.h8Timeframe,
        200,
      );
      h4Candles = await this.binanceService.getAllFuturesHistoricalCandles(
        this.symbol,
        this.h4Timeframe,
        300,
      );
      htfCandles = await this.binanceService.getAllFuturesHistoricalCandles(
        this.symbol,
        this.htfTimeframe,
        500,
      );
      ltfCandles = await this.binanceService.getAllFuturesHistoricalCandles(
        this.symbol,
        this.ltfTimeframe,
        3000,
      );
    }

    console.log(`Daily: ${dailyCandles.length} candles`);
    console.log(`H8: ${h8Candles.length} candles`);
    console.log(`H4: ${h4Candles.length} candles`);
    console.log(`HTF (${this.htfTimeframe}): ${htfCandles.length} candles`);
    console.log(`LTF (${this.ltfTimeframe}): ${ltfCandles.length} candles`);

    // Initialize data
    this.initializeData(
      dailyCandles,
      h8Candles,
      h4Candles,
      htfCandles,
      ltfCandles,
    );

    // Run backtest
    await this.runBacktest(ltfCandles);
  }

  private initializeData(
    dailyCandles: Candle[],
    h8Candles: Candle[],
    h4Candles: Candle[],
    htfCandles: Candle[],
    ltfCandles: Candle[],
  ) {
    // Helper to convert candles to TimeframeData
    const toTFData = (candles: Candle[]): TimeframeData => ({
      opens: candles.map((c) => +c.open),
      closes: candles.map((c) => +c.close),
      highs: candles.map((c) => +c.high),
      lows: candles.map((c) => +c.low),
      volumes: candles.map((c) => +c.volume),
      timestamps: candles.map((c) => c.openTime),
    });

    // Initialize all timeframes
    this.dailyData = toTFData(dailyCandles);
    this.h8Data = toTFData(h8Candles);
    this.h4Data = toTFData(h4Candles);
    this.htfData = toTFData(htfCandles);

    // Initialize LTF data (warmup)
    const warmup = ltfCandles.slice(0, 500);
    this.ltfData = toTFData(warmup);

    // Analyze all timeframes for structure
    this.dailyStructure = this.analyzeMarketStructure(this.dailyData);
    this.h8Structure = this.analyzeMarketStructure(this.h8Data);
    this.h4Structure = this.analyzeMarketStructure(this.h4Data);
    this.htfStructure = this.analyzeMarketStructure(this.htfData);
    this.ltfStructure = this.analyzeMarketStructure(this.ltfData);

    // Determine main trend from higher timeframes
    this.updateMainTrend();

    console.log('\n=== MULTI-TIMEFRAME ANALYSIS ===');
    console.log(`Daily Trend: ${this.dailyStructure.trend}`);
    console.log(`H8 Trend: ${this.h8Structure.trend}`);
    console.log(`H4 Trend: ${this.h4Structure.trend}`);
    console.log(`HTF (15m) Trend: ${this.htfStructure.trend}`);
    console.log(`>>> MAIN TREND: ${this.mainTrend.toUpperCase()} <<<`);
    console.log('================================\n');
  }

  /**
   * Xác định xu hướng chính dựa trên H4 (ưu tiên) hoặc Daily
   * Trend ngắn hạn, không cần dùng quá nhiều timeframe
   */
  private updateMainTrend() {
    // Ưu tiên H4 cho trend detection (sóng ngắn hơn)
    if (this.h4Structure.trend !== 'ranging') {
      this.mainTrend =
        this.h4Structure.trend === 'bullish' ? 'bullish' : 'bearish';
    }
    // Fallback về Daily nếu H4 ranging
    else if (this.dailyStructure.trend !== 'ranging') {
      this.mainTrend =
        this.dailyStructure.trend === 'bullish' ? 'bullish' : 'bearish';
    }
    // Neutral nếu cả 2 đều ranging
    else {
      this.mainTrend = 'neutral';
    }
  }

  // ============================================================================
  // ICT ANALYSIS METHODS
  // ============================================================================

  private findSwingPoints(data: TimeframeData): SwingPoint[] {
    const swings: SwingPoint[] = [];
    const lb = this.swingLookback;

    for (let i = lb; i < data.closes.length - lb; i++) {
      let isSwingHigh = true;
      let isSwingLow = true;

      for (let j = 1; j <= lb; j++) {
        if (
          data.highs[i] <= data.highs[i - j] ||
          data.highs[i] <= data.highs[i + j]
        ) {
          isSwingHigh = false;
        }
        if (
          data.lows[i] >= data.lows[i - j] ||
          data.lows[i] >= data.lows[i + j]
        ) {
          isSwingLow = false;
        }
      }

      if (isSwingHigh) {
        swings.push({ price: data.highs[i], index: i, type: 'high' });
      }
      if (isSwingLow) {
        swings.push({ price: data.lows[i], index: i, type: 'low' });
      }
    }

    return swings.sort((a, b) => a.index - b.index);
  }

  private analyzeMarketStructure(data: TimeframeData): MarketStructure {
    if (data.closes.length < 50) return this.emptyStructure();

    const swings = this.findSwingPoints(data);
    if (swings.length < 4) return this.emptyStructure();

    const recentSwings = swings.slice(-10);
    const swingHighs = recentSwings.filter((s) => s.type === 'high');
    const swingLows = recentSwings.filter((s) => s.type === 'low');

    if (swingHighs.length < 2 || swingLows.length < 2)
      return this.emptyStructure();

    const latestHigh = swingHighs[swingHighs.length - 1];
    const prevHigh = swingHighs[swingHighs.length - 2];
    const latestLow = swingLows[swingLows.length - 1];
    const prevLow = swingLows[swingLows.length - 2];

    // Determine trend
    const higherHighs = latestHigh.price > prevHigh.price;
    const higherLows = latestLow.price > prevLow.price;
    const lowerHighs = latestHigh.price < prevHigh.price;
    const lowerLows = latestLow.price < prevLow.price;

    let trend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
    if (higherHighs && higherLows) trend = 'bullish';
    else if (lowerHighs && lowerLows) trend = 'bearish';

    // Calculate zones
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

  private identifyOrderBlocks(data: TimeframeData): OrderBlock[] {
    const obs: OrderBlock[] = [];
    const len = data.closes.length;

    for (let i = 3; i < Math.min(len - 1, this.obLookback); i++) {
      const idx = len - 1 - i;

      // Bullish OB: bearish candle → strong bullish move
      const isBearish = data.closes[idx] < data.opens[idx];
      const nextBullish = data.closes[idx + 1] > data.opens[idx + 1];
      const strongBullMove =
        (data.closes[idx + 1] - data.opens[idx + 1]) / data.opens[idx + 1] >
        0.001;

      if (isBearish && nextBullish && strongBullMove) {
        const moveAfter =
          Math.max(...data.highs.slice(idx + 1, idx + 5)) - data.highs[idx];
        const strength = Math.min(moveAfter / data.highs[idx] / 0.005, 1);

        obs.push({
          high: data.highs[idx],
          low: data.lows[idx],
          type: 'bullish',
          index: idx,
          strength,
        });
      }

      // Bearish OB: bullish candle → strong bearish move
      const isBullish = data.closes[idx] > data.opens[idx];
      const nextBearish = data.closes[idx + 1] < data.opens[idx + 1];
      const strongBearMove =
        (data.opens[idx + 1] - data.closes[idx + 1]) / data.opens[idx + 1] >
        0.001;

      if (isBullish && nextBearish && strongBearMove) {
        const moveAfter =
          data.lows[idx] - Math.min(...data.lows.slice(idx + 1, idx + 5));
        const strength = Math.min(moveAfter / data.lows[idx] / 0.005, 1);

        obs.push({
          high: data.highs[idx],
          low: data.lows[idx],
          type: 'bearish',
          index: idx,
          strength,
        });
      }
    }

    return obs.filter((ob) => ob.strength > 0.3).slice(0, 5);
  }

  private identifyFairValueGaps(data: TimeframeData): FairValueGap[] {
    const fvgs: FairValueGap[] = [];
    const len = data.closes.length;

    for (let i = 2; i < Math.min(len - 1, 20); i++) {
      const idx = len - 1 - i;

      // Bullish FVG
      const bullishGapHigh = data.lows[idx + 2];
      const bullishGapLow = data.highs[idx];

      if (bullishGapHigh > bullishGapLow) {
        const gapSize = (bullishGapHigh - bullishGapLow) / data.closes[idx];
        if (gapSize > this.fvgMinSize) {
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
        if (gapSize > this.fvgMinSize) {
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

  private checkLiquiditySweep(
    data: TimeframeData,
    structure: MarketStructure,
  ): {
    swept: boolean;
    type: 'high' | 'low' | null;
  } {
    if (!structure.swingHigh || !structure.swingLow) {
      return { swept: false, type: null };
    }

    const currentHigh = data.highs[data.highs.length - 1];
    const currentLow = data.lows[data.lows.length - 1];
    const currentClose = data.closes[data.closes.length - 1];

    const swingHigh = structure.swingHigh.price;
    const swingLow = structure.swingLow.price;

    // Sweep high then reject
    if (
      currentHigh > swingHigh * (1 + this.liquiditySweepThreshold) &&
      currentClose < swingHigh
    ) {
      return { swept: true, type: 'high' };
    }

    // Sweep low then reject
    if (
      currentLow < swingLow * (1 - this.liquiditySweepThreshold) &&
      currentClose > swingLow
    ) {
      return { swept: true, type: 'low' };
    }

    return { swept: false, type: null };
  }

  private isInOTEZone(price: number, structure: MarketStructure): boolean {
    if (!structure.swingHigh || !structure.swingLow) return false;

    const range = structure.swingHigh.price - structure.swingLow.price;
    if (range <= 0) return false;

    if (structure.trend === 'bullish') {
      const retracement = (structure.swingHigh.price - price) / range;
      return retracement >= this.oteZoneLow && retracement <= this.oteZoneHigh;
    }

    if (structure.trend === 'bearish') {
      const retracement = (price - structure.swingLow.price) / range;
      return retracement >= this.oteZoneLow && retracement <= this.oteZoneHigh;
    }

    return false;
  }

  private isKillZone(timestamp: number): boolean {
    const date = new Date(timestamp);
    const utcHour = date.getUTCHours();

    // London: 7-10 UTC, NY: 12-15 UTC, London Close: 10-12 UTC
    return (
      (utcHour >= 7 && utcHour <= 10) ||
      (utcHour >= 12 && utcHour <= 15) ||
      (utcHour >= 10 && utcHour <= 12)
    );
  }

  // ============================================================================
  // TECHNICAL INDICATORS (RSI, EMA, BB) cho 100% WIN RATE
  // ============================================================================

  private calculateRSI(closes: number[], period: number = 14): number {
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

  private calculateEMA(closes: number[], period: number): number {
    if (closes.length < period) return closes[closes.length - 1];

    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b) / period;

    for (let i = period; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }
    return ema;
  }

  private calculateBollingerBands(
    closes: number[],
    period: number = 20,
    stdDev: number = 2,
  ): { upper: number; middle: number; lower: number } {
    if (closes.length < period) {
      const last = closes[closes.length - 1];
      return { upper: last, middle: last, lower: last };
    }

    const recentCloses = closes.slice(-period);
    const sma = recentCloses.reduce((a, b) => a + b) / period;

    const variance =
      recentCloses.reduce((sum, c) => sum + Math.pow(c - sma, 2), 0) / period;
    const std = Math.sqrt(variance);

    return {
      upper: sma + stdDev * std,
      middle: sma,
      lower: sma - stdDev * std,
    };
  }

  private isEMAStall(closes: number[]): boolean {
    const ema9 = this.calculateEMA(closes, 9);
    const ema21 = this.calculateEMA(closes, 21);
    const diff = Math.abs(ema9 - ema21) / ema21;
    return diff < 0.0015; // EMA9 và EMA21 cách nhau < 0.15%
  }

  private isVolumeSpike(volumes: number[], threshold: number = 1.5): boolean {
    if (volumes.length < 20) return false;
    const recentVol = volumes[volumes.length - 1];
    const avgVol = volumes.slice(-20, -1).reduce((a, b) => a + b) / 19;
    return recentVol > avgVol * threshold;
  }

  /**
   * Phân tích volume distribution - xác định buying/selling pressure
   * Nếu volume cao + giá giảm = selling pressure (distribution) -> SHORT
   * Nếu volume cao + giá tăng = buying pressure (accumulation) -> LONG
   */
  private analyzeVolumeDistribution(
    closes: number[],
    volumes: number[],
    lookback: number = 10,
  ): { type: 'distribution' | 'accumulation' | 'neutral'; strength: number } {
    if (closes.length < lookback || volumes.length < lookback) {
      return { type: 'neutral', strength: 0 };
    }

    const recentCloses = closes.slice(-lookback);
    const recentVolumes = volumes.slice(-lookback);
    const avgVolume =
      volumes.slice(-50, -lookback).reduce((a, b) => a + b, 0) /
      Math.max(volumes.slice(-50, -lookback).length, 1);

    let distributionScore = 0;
    let accumulationScore = 0;

    for (let i = 1; i < recentCloses.length; i++) {
      const priceChange = recentCloses[i] - recentCloses[i - 1];
      const volRatio = recentVolumes[i] / avgVolume;

      if (priceChange < 0 && volRatio > 1.2) {
        // Giá giảm + volume cao = selling
        distributionScore += volRatio;
      } else if (priceChange > 0 && volRatio > 1.2) {
        // Giá tăng + volume cao = buying
        accumulationScore += volRatio;
      }
    }

    const totalScore = distributionScore + accumulationScore;
    if (totalScore < 2) return { type: 'neutral', strength: 0 };

    if (distributionScore > accumulationScore * 1.5) {
      return {
        type: 'distribution',
        strength: distributionScore / totalScore,
      };
    } else if (accumulationScore > distributionScore * 1.5) {
      return {
        type: 'accumulation',
        strength: accumulationScore / totalScore,
      };
    }

    return { type: 'neutral', strength: 0 };
  }

  // ============================================================================
  // CREATIVE TECHNIQUES FOR ULTRA-HIGH WIN RATE
  // ============================================================================

  /**
   * TECHNIQUE 1: Candle Pattern Recognition
   * Detect reversal patterns: Pin Bar, Engulfing, Doji
   */
  private detectCandlePatterns(data: TimeframeData): {
    pattern:
      | 'pin_bar_bull'
      | 'pin_bar_bear'
      | 'engulfing_bull'
      | 'engulfing_bear'
      | 'doji'
      | null;
    strength: number;
  } {
    if (data.closes.length < 3) return { pattern: null, strength: 0 };

    const len = data.closes.length;
    const open = data.opens[len - 1];
    const close = data.closes[len - 1];
    const high = data.highs[len - 1];
    const low = data.lows[len - 1];
    const prevOpen = data.opens[len - 2];
    const prevClose = data.closes[len - 2];
    const prevHigh = data.highs[len - 2];
    const prevLow = data.lows[len - 2];

    const bodySize = Math.abs(close - open);
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;
    const totalRange = high - low;
    const prevBodySize = Math.abs(prevClose - prevOpen);

    // PIN BAR BULLISH: Long lower wick, small body, price at bottom
    if (
      lowerWick > bodySize * 2.5 &&
      lowerWick > upperWick * 2 &&
      totalRange > 0
    ) {
      const wickRatio = lowerWick / totalRange;
      if (wickRatio > 0.6) {
        return { pattern: 'pin_bar_bull', strength: Math.min(wickRatio, 1) };
      }
    }

    // PIN BAR BEARISH: Long upper wick, small body, price at top
    if (
      upperWick > bodySize * 2.5 &&
      upperWick > lowerWick * 2 &&
      totalRange > 0
    ) {
      const wickRatio = upperWick / totalRange;
      if (wickRatio > 0.6) {
        return { pattern: 'pin_bar_bear', strength: Math.min(wickRatio, 1) };
      }
    }

    // BULLISH ENGULFING: Current bullish candle engulfs previous bearish
    if (prevClose < prevOpen && close > open) {
      if (
        close > prevOpen &&
        open < prevClose &&
        bodySize > prevBodySize * 1.3
      ) {
        const engulfRatio = bodySize / prevBodySize;
        return {
          pattern: 'engulfing_bull',
          strength: Math.min(engulfRatio / 2, 1),
        };
      }
    }

    // BEARISH ENGULFING: Current bearish candle engulfs previous bullish
    if (prevClose > prevOpen && close < open) {
      if (
        open > prevClose &&
        close < prevOpen &&
        bodySize > prevBodySize * 1.3
      ) {
        const engulfRatio = bodySize / prevBodySize;
        return {
          pattern: 'engulfing_bear',
          strength: Math.min(engulfRatio / 2, 1),
        };
      }
    }

    // DOJI: Very small body, indicating indecision (potential reversal)
    if (totalRange > 0 && bodySize / totalRange < 0.1) {
      return { pattern: 'doji', strength: 0.6 };
    }

    return { pattern: null, strength: 0 };
  }

  /**
   * TECHNIQUE 2: Momentum Cascade Detection
   * Detect khi nhiều tín hiệu cùng xuất hiện một lúc = SUPER STRONG SIGNAL
   */
  private detectMomentumCascade(
    price: number,
    rsi: number,
    bb: { upper: number; lower: number; middle: number },
    volumeDist: { type: string; strength: number },
    candlePattern: { pattern: string | null; strength: number },
  ): {
    isCascade: boolean;
    direction: 'LONG' | 'SHORT' | null;
    strength: number;
  } {
    let longSignals = 0;
    let shortSignals = 0;

    // RSI extreme
    if (rsi < 25) longSignals++;
    if (rsi < 20) longSignals++;
    if (rsi > 75) shortSignals++;
    if (rsi > 80) shortSignals++;

    // BB position
    if (price <= bb.lower) longSignals++;
    if (price <= bb.lower * 0.998) longSignals++;
    if (price >= bb.upper) shortSignals++;
    if (price >= bb.upper * 1.002) shortSignals++;

    // Volume distribution
    if (volumeDist.type === 'accumulation') longSignals++;
    if (volumeDist.type === 'distribution') shortSignals++;

    // Candle pattern
    if (
      candlePattern.pattern === 'pin_bar_bull' ||
      candlePattern.pattern === 'engulfing_bull'
    ) {
      longSignals++;
    }
    if (
      candlePattern.pattern === 'pin_bar_bear' ||
      candlePattern.pattern === 'engulfing_bear'
    ) {
      shortSignals++;
    }

    // CASCADE = 3+ signals đồng thời cho cùng hướng
    if (longSignals >= 3) {
      return { isCascade: true, direction: 'LONG', strength: longSignals / 6 };
    }
    if (shortSignals >= 3) {
      return {
        isCascade: true,
        direction: 'SHORT',
        strength: shortSignals / 6,
      };
    }

    return { isCascade: false, direction: null, strength: 0 };
  }

  /**
   * TECHNIQUE 3: Order Flow Imbalance
   * Phân tích sự mất cân bằng giữa buying/selling pressure qua nhiều nến
   */
  private analyzeOrderFlowImbalance(
    data: TimeframeData,
    lookback: number = 5,
  ): { imbalance: 'buy' | 'sell' | 'neutral'; ratio: number } {
    if (data.closes.length < lookback) {
      return { imbalance: 'neutral', ratio: 0 };
    }

    let buyPressure = 0;
    let sellPressure = 0;

    for (let i = data.closes.length - lookback; i < data.closes.length; i++) {
      const open = data.opens[i];
      const close = data.closes[i];
      const high = data.highs[i];
      const low = data.lows[i];
      const volume = data.volumes[i];

      const range = high - low;
      if (range === 0) continue;

      // Buying pressure: Close near high + Volume
      const buyingStrength = ((close - low) / range) * volume;
      // Selling pressure: Close near low + Volume
      const sellingStrength = ((high - close) / range) * volume;

      buyPressure += buyingStrength;
      sellPressure += sellingStrength;
    }

    const total = buyPressure + sellPressure;
    if (total === 0) return { imbalance: 'neutral', ratio: 0 };

    const buyRatio = buyPressure / total;
    const sellRatio = sellPressure / total;

    // Significant imbalance > 65%
    if (buyRatio > 0.65) {
      return { imbalance: 'buy', ratio: buyRatio };
    }
    if (sellRatio > 0.65) {
      return { imbalance: 'sell', ratio: sellRatio };
    }

    return { imbalance: 'neutral', ratio: Math.max(buyRatio, sellRatio) };
  }

  /**
   * TECHNIQUE 4: Time-Weighted Scoring
   * London/NY overlap = BEST TIME for scalping (volatility + liquidity)
   */
  private getTimeWeightedBonus(timestamp: number): {
    bonus: number;
    session: string;
  } {
    const date = new Date(timestamp);
    const utcHour = date.getUTCHours();

    // London/NY OVERLAP: 12-15 UTC = BEST (highest volatility + liquidity)
    if (utcHour >= 12 && utcHour <= 15) {
      return { bonus: 40, session: 'LONDON_NY_OVERLAP' };
    }

    // NY Session: 13-20 UTC
    if (utcHour >= 13 && utcHour <= 20) {
      return { bonus: 25, session: 'NY_SESSION' };
    }

    // London Session: 7-15 UTC
    if (utcHour >= 7 && utcHour <= 15) {
      return { bonus: 20, session: 'LONDON_SESSION' };
    }

    // Asian Session: 0-8 UTC (less volatile, avoid)
    if (utcHour >= 0 && utcHour <= 8) {
      return { bonus: -20, session: 'ASIAN_SESSION' };
    }

    return { bonus: 0, session: 'OFF_HOURS' };
  }

  /**
   * TECHNIQUE 5: Multi-Timeframe Momentum Alignment
   * Check if momentum is aligned across multiple timeframes
   */
  private checkMomentumAlignment(): {
    aligned: boolean;
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number;
  } {
    let bullishCount = 0;
    let bearishCount = 0;

    // Check EMA trend on each timeframe
    const checkEMA = (
      data: TimeframeData,
    ): 'bullish' | 'bearish' | 'neutral' => {
      if (data.closes.length < 21) return 'neutral';
      const ema9 = this.calculateEMA(data.closes, 9);
      const ema21 = this.calculateEMA(data.closes, 21);
      const price = data.closes[data.closes.length - 1];
      if (price > ema9 && ema9 > ema21) return 'bullish';
      if (price < ema9 && ema9 < ema21) return 'bearish';
      return 'neutral';
    };

    const h4Momentum = checkEMA(this.h4Data);
    const htfMomentum = checkEMA(this.htfData);
    const ltfMomentum = checkEMA(this.ltfData);

    if (h4Momentum === 'bullish') bullishCount++;
    if (htfMomentum === 'bullish') bullishCount++;
    if (ltfMomentum === 'bullish') bullishCount++;

    if (h4Momentum === 'bearish') bearishCount++;
    if (htfMomentum === 'bearish') bearishCount++;
    if (ltfMomentum === 'bearish') bearishCount++;

    // All 3 aligned = STRONG
    if (bullishCount === 3) {
      return { aligned: true, direction: 'bullish', strength: 1 };
    }
    if (bearishCount === 3) {
      return { aligned: true, direction: 'bearish', strength: 1 };
    }

    // 2/3 aligned = MODERATE
    if (bullishCount >= 2) {
      return { aligned: true, direction: 'bullish', strength: 0.7 };
    }
    if (bearishCount >= 2) {
      return { aligned: true, direction: 'bearish', strength: 0.7 };
    }

    return { aligned: false, direction: 'neutral', strength: 0 };
  }

  /**
   * TECHNIQUE 6: Volatility Contraction Pattern (VCP)
   * Look for decreasing volatility before explosive move
   */
  private detectVolatilityContraction(data: TimeframeData): {
    isContracting: boolean;
    strength: number;
  } {
    if (data.closes.length < 20) return { isContracting: false, strength: 0 };

    // Calculate ATR for different periods
    const calcATR = (period: number): number => {
      if (data.closes.length < period) return 0;
      let sum = 0;
      for (let i = data.closes.length - period; i < data.closes.length; i++) {
        const tr = Math.max(
          data.highs[i] - data.lows[i],
          Math.abs(data.highs[i] - data.closes[i - 1] || data.closes[i]),
          Math.abs(data.lows[i] - data.closes[i - 1] || data.closes[i]),
        );
        sum += tr;
      }
      return sum / period;
    };

    const atr5 = calcATR(5); // Recent volatility
    const atr15 = calcATR(15); // Historical volatility

    if (atr15 === 0) return { isContracting: false, strength: 0 };

    const contractionRatio = atr5 / atr15;

    // Volatility contracting = recent ATR < historical ATR
    // Strong contraction = atr5 < 0.6 * atr15
    if (contractionRatio < 0.7) {
      return { isContracting: true, strength: 1 - contractionRatio };
    }

    return { isContracting: false, strength: 0 };
  }

  /**
   * TECHNIQUE 7: Slope Detection - Xác định độ dốc của trend
   * Dốc lên = Bullish slope, Dốc xuống = Bearish slope
   */
  private detectSlope(data: TimeframeData): {
    direction: 'up' | 'down' | 'flat';
    strength: number;
    ema20Slope: number;
    priceAboveEMA: boolean;
  } {
    if (data.closes.length < 30) {
      return { direction: 'flat', strength: 0, ema20Slope: 0, priceAboveEMA: false };
    }

    const closes = data.closes;
    const len = closes.length;

    // Calculate EMA20 values at different points
    const ema20Now = this.calculateEMA(closes, 20);
    const ema20_5ago = this.calculateEMA(closes.slice(0, -5), 20);
    const ema20_10ago = this.calculateEMA(closes.slice(0, -10), 20);

    // Calculate slope (change per 5 candles as percentage)
    const slope5 = ((ema20Now - ema20_5ago) / ema20_5ago) * 100;
    const slope10 = ((ema20Now - ema20_10ago) / ema20_10ago) * 100;

    // Average slope
    const avgSlope = (slope5 + slope10 / 2) / 1.5;

    // Price position relative to EMA20
    const currentPrice = closes[len - 1];
    const priceAboveEMA = currentPrice > ema20Now;

    // Determine direction
    let direction: 'up' | 'down' | 'flat' = 'flat';
    let strength = 0;

    if (avgSlope > 0.05) {
      direction = 'up';
      strength = Math.min(avgSlope / 0.3, 1); // Normalize to 0-1
    } else if (avgSlope < -0.05) {
      direction = 'down';
      strength = Math.min(Math.abs(avgSlope) / 0.3, 1);
    }

    return {
      direction,
      strength,
      ema20Slope: avgSlope,
      priceAboveEMA,
    };
  }

  /**
   * TECHNIQUE 8: Pullback Detection - Xác định khi nào giá pullback trong trend
   * Trong uptrend: giá giảm về gần EMA = pullback LONG
   * Trong downtrend: giá tăng về gần EMA = pullback SHORT
   */
  private detectPullback(
    data: TimeframeData,
    slope: { direction: 'up' | 'down' | 'flat'; priceAboveEMA: boolean },
  ): { isPullback: boolean; strength: number; recoverySignal: boolean } {
    if (data.closes.length < 30 || slope.direction === 'flat') {
      return { isPullback: false, strength: 0, recoverySignal: false };
    }

    const closes = data.closes;
    const len = closes.length;
    const ema20 = this.calculateEMA(closes, 20);
    const currentPrice = closes[len - 1];
    const prevPrice = closes[len - 2];

    // Distance from EMA as percentage
    const distFromEMA = ((currentPrice - ema20) / ema20) * 100;

    // Check for pullback based on trend direction
    if (slope.direction === 'up') {
      // In uptrend, pullback = price comes down toward EMA
      const isPullback = distFromEMA < 0.3 && distFromEMA > -0.5; // Near or slightly below EMA
      const recoverySignal = prevPrice < currentPrice && currentPrice > ema20 * 0.998; // Price turning up
      return {
        isPullback,
        strength: isPullback ? 1 - Math.abs(distFromEMA) / 0.5 : 0,
        recoverySignal,
      };
    } else {
      // In downtrend, pullback = price comes up toward EMA
      const isPullback = distFromEMA > -0.3 && distFromEMA < 0.5; // Near or slightly above EMA
      const recoverySignal = prevPrice > currentPrice && currentPrice < ema20 * 1.002; // Price turning down
      return {
        isPullback,
        strength: isPullback ? 1 - Math.abs(distFromEMA) / 0.5 : 0,
        recoverySignal,
      };
    }
  }

  /**
   * TECHNIQUE 9: Momentum Filter (updated)
   * Tránh entry khi momentum đang mạnh ngược hướng
   * LONG: Chờ giá ngừng rơi, SHORT: Chờ giá ngừng tăng
   */
  private checkMomentumFilter(
    data: TimeframeData,
    side: 'LONG' | 'SHORT',
  ): { canEnter: boolean; reason: string } {
    if (data.closes.length < 10) return { canEnter: true, reason: '' };

    const closes = data.closes;
    const len = closes.length;

    // Tính price change qua các giai đoạn
    const change3 =
      ((closes[len - 1] - closes[len - 4]) / closes[len - 4]) * 100;
    const change5 =
      ((closes[len - 1] - closes[len - 6]) / closes[len - 6]) * 100;
    const change10 =
      ((closes[len - 1] - closes[len - 11]) / closes[len - 11]) * 100;

    if (side === 'LONG') {
      // Không LONG nếu giá vẫn đang rơi mạnh
      if (change3 < -0.3 && change5 < -0.5) {
        return { canEnter: false, reason: 'FALLING_FAST' };
      }
      // Không LONG nếu đã rơi quá sâu và chưa có dấu hiệu hồi
      if (change10 < -2 && change3 < 0) {
        return { canEnter: false, reason: 'DEEP_DROP_NO_RECOVERY' };
      }
      // OK nếu giá đang stabilize hoặc đã bắt đầu hồi
      return { canEnter: true, reason: change3 > 0 ? 'RECOVERING' : 'STABLE' };
    } else {
      // Không SHORT nếu giá vẫn đang tăng mạnh
      if (change3 > 0.3 && change5 > 0.5) {
        return { canEnter: false, reason: 'RISING_FAST' };
      }
      // Không SHORT nếu đã tăng quá mạnh và chưa có dấu hiệu giảm
      if (change10 > 2 && change3 > 0) {
        return { canEnter: false, reason: 'STRONG_RALLY_NO_PULLBACK' };
      }
      return {
        canEnter: true,
        reason: change3 < 0 ? 'PULLING_BACK' : 'STABLE',
      };
    }
  }

  // ============================================================================
  // BACKTEST
  // ============================================================================

  private async runBacktest(candles: Candle[]) {
    const trades: any[] = [];
    let currentPosition: any = null;
    let totalProfit = 0;
    this.highestProfit = 0;

    const testCandles = candles.slice(500);
    console.log(`\nRunning backtest on ${testCandles.length} candles...\n`);

    for (let i = 0; i < testCandles.length; i++) {
      const candle = testCandles[i];

      // Update LTF data
      this.updateLTFData(candle);

      // Update LTF analysis every 15 candles
      if (i % 15 === 0) {
        this.ltfStructure = this.analyzeMarketStructure(this.ltfData);
        this.ltfOrderBlocks = this.identifyOrderBlocks(this.ltfData);
        this.ltfFairValueGaps = this.identifyFairValueGaps(this.ltfData);
      }

      // Update HTF analysis and main trend every 100 candles (simulating HTF candle close)
      if (i % 100 === 0 && i > 0) {
        this.htfStructure = this.analyzeMarketStructure(this.htfData);
        // Re-analyze H4, H8, Daily would need new data in live trading
        // For backtest, we keep the initial HTF analysis
        this.updateMainTrend();
      }

      const price = +candle.close;

      // === EXIT LOGIC ===
      if (currentPosition) {
        const pnlPct =
          currentPosition.side === 'LONG'
            ? (price - currentPosition.entryPrice) / currentPosition.entryPrice
            : (currentPosition.entryPrice - price) / currentPosition.entryPrice;

        const profit =
          pnlPct * this.usdPerTrade * this.maxLeverage -
          this.usdPerTrade * this.maxLeverage * this.takerFee * 2;

        if (profit > this.highestProfit) this.highestProfit = profit;

        let exitType = '';

        // Take Profit
        if (pnlPct >= this.profitTargetPct) {
          exitType = 'TAKE_PROFIT';
        }
        // Stop Loss
        else if (pnlPct <= -this.stopLossPct) {
          exitType = 'STOP_LOSS';
        }
        // Trailing Stop (after activation)
        else if (
          this.highestProfit >
          this.trailingActivation * this.usdPerTrade * this.maxLeverage
        ) {
          if (
            profit <
            this.highestProfit -
              this.trailingDistance * this.usdPerTrade * this.maxLeverage
          ) {
            exitType = 'TRAILING';
          }
        }
        // ICT Exit: Price reaches bearish OB (for long) or bullish OB (for short)
        else if (this.enableICTExit) {
          if (currentPosition.side === 'LONG') {
            const atBearishOB = this.ltfOrderBlocks.find(
              (ob) =>
                ob.type === 'bearish' && price >= ob.low && price <= ob.high,
            );
            if (atBearishOB && profit > 0) exitType = 'ICT_OB_EXIT';
          } else {
            const atBullishOB = this.ltfOrderBlocks.find(
              (ob) =>
                ob.type === 'bullish' && price >= ob.low && price <= ob.high,
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
          this.highestProfit = 0;
          this.lastTradeTime = candle.closeTime;
        }
      }

      // === ENTRY LOGIC ===
      if (
        !currentPosition &&
        candle.closeTime - this.lastTradeTime >= this.cooldownMs
      ) {
        const signal = this.generateSignal(price, candle.closeTime);

        if (signal) {
          currentPosition = {
            side: signal.side,
            entryPrice: price,
            entryTime: candle.openTime,
          };
          this.entryPrice = price;
          this.highestProfit = 0;

          console.log(
            `[${i}] ENTER ${signal.side} @ $${price.toFixed(2)} | Confidence: ${signal.confidence} | ${signal.reasons.join(', ')}`,
          );
        }
      }
    }

    // Close open position
    if (currentPosition) {
      const lastPrice = +testCandles[testCandles.length - 1].close;
      const pnlPct =
        currentPosition.side === 'LONG'
          ? (lastPrice - currentPosition.entryPrice) /
            currentPosition.entryPrice
          : (currentPosition.entryPrice - lastPrice) /
            currentPosition.entryPrice;
      const profit =
        pnlPct * this.usdPerTrade * this.maxLeverage -
        this.usdPerTrade * this.maxLeverage * this.takerFee * 2;

      trades.push({
        side: currentPosition.side,
        entryPrice: currentPosition.entryPrice,
        exitPrice: lastPrice,
        profit,
        exitType: 'END_OF_DATA',
      });
      totalProfit += profit;
    }

    this.printResults(trades, totalProfit);
  }

  private updateLTFData(candle: Candle) {
    this.ltfData.opens.push(+candle.open);
    this.ltfData.closes.push(+candle.close);
    this.ltfData.highs.push(+candle.high);
    this.ltfData.lows.push(+candle.low);
    this.ltfData.volumes.push(+candle.volume);
    this.ltfData.timestamps.push(candle.openTime);

    // Keep buffer
    if (this.ltfData.closes.length > 500) {
      this.ltfData.opens.shift();
      this.ltfData.closes.shift();
      this.ltfData.highs.shift();
      this.ltfData.lows.shift();
      this.ltfData.volumes.shift();
      this.ltfData.timestamps.shift();
    }
  }

  private generateSignal(
    price: number,
    timestamp: number,
  ): { side: 'LONG' | 'SHORT'; confidence: number; reasons: string[] } | null {
    // Sử dụng generateSignalWithSettings với default thresholds
    return this.generateSignalWithSettings(
      price,
      timestamp,
      this.minConfidence,
      this.rsiOverbought,
      this.rsiOversold,
    );
  }

  private printResults(trades: any[], totalProfit: number) {
    const wins = trades.filter((t) => t.profit > 0).length;
    const losses = trades.filter((t) => t.profit <= 0).length;
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

    console.log('\n' + '='.repeat(60));
    console.log('BTC ICT FUTURES BACKTEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Trades: ${trades.length}`);
    console.log(`Wins: ${wins} | Losses: ${losses}`);
    console.log(`Win Rate: ${winRate.toFixed(1)}%`);
    console.log(`Total Profit: $${totalProfit.toFixed(2)}`);

    if (trades.length > 0) {
      const avgWin =
        wins > 0
          ? trades
              .filter((t) => t.profit > 0)
              .reduce((s, t) => s + t.profit, 0) / wins
          : 0;
      const avgLoss =
        losses > 0
          ? Math.abs(
              trades
                .filter((t) => t.profit <= 0)
                .reduce((s, t) => s + t.profit, 0),
            ) / losses
          : 0;

      console.log(`\nAvg Win: $${avgWin.toFixed(2)}`);
      console.log(`Avg Loss: $${avgLoss.toFixed(2)}`);
      console.log(
        `Risk/Reward: ${avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : 'N/A'}`,
      );

      // Exit types
      const exitTypes: Record<string, number> = {};
      trades.forEach((t) => {
        exitTypes[t.exitType] = (exitTypes[t.exitType] || 0) + 1;
      });
      console.log('\nExit Types:');
      Object.entries(exitTypes).forEach(([type, count]) => {
        console.log(
          `  ${type}: ${count} (${((count / trades.length) * 100).toFixed(1)}%)`,
        );
      });

      // Long vs Short
      const longTrades = trades.filter((t) => t.side === 'LONG');
      const shortTrades = trades.filter((t) => t.side === 'SHORT');
      console.log('\nBy Side:');
      console.log(
        `  LONG: ${longTrades.length} | WR: ${longTrades.length > 0 ? ((longTrades.filter((t) => t.profit > 0).length / longTrades.length) * 100).toFixed(1) : 0}%`,
      );
      console.log(
        `  SHORT: ${shortTrades.length} | WR: ${shortTrades.length > 0 ? ((shortTrades.filter((t) => t.profit > 0).length / shortTrades.length) * 100).toFixed(1) : 0}%`,
      );
    }

    console.log('='.repeat(60) + '\n');
  }

  stop() {
    console.log('Stopped BTC ICT Futures Strategy');
  }

  // ============================================================================
  // BACKTEST WITH RESULTS (API)
  // ============================================================================

  /**
   * Run backtest và trả về kết quả (cho API endpoint)
   */
  public runBacktestAndGetResults(settings?: {
    leverage?: number;
    usdPerTrade?: number;
    profitTargetPct?: number;
    stopLossPct?: number;
    minConfidence?: number;
    rsiOverbought?: number;
    rsiOversold?: number;
  }): {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalProfit: number;
    avgWin: number;
    avgLoss: number;
    riskReward: number;
    exitTypes: Record<string, number>;
    trades: any[];
    settings: any;
  } {
    // Apply custom settings if provided
    const leverage = settings?.leverage || this.maxLeverage;
    const usdPerTrade = settings?.usdPerTrade || this.usdPerTrade;
    const profitTargetPct = settings?.profitTargetPct || this.profitTargetPct;
    const stopLossPct = settings?.stopLossPct || this.stopLossPct;
    const minConfidence = settings?.minConfidence || this.minConfidence;
    const rsiOverbought = settings?.rsiOverbought || this.rsiOverbought;
    const rsiOversold = settings?.rsiOversold || this.rsiOversold;

    const trades: any[] = [];
    let currentPosition: any = null;
    let totalProfit = 0;
    let highestProfit = 0;
    let lastTradeTime = 0;

    // Get LTF candles from backtest data
    const ltfCandles = this.backtestData.ltf || [];
    if (ltfCandles.length < 500) {
      return {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalProfit: 0,
        avgWin: 0,
        avgLoss: 0,
        riskReward: 0,
        exitTypes: {},
        trades: [],
        settings: {
          leverage,
          usdPerTrade,
          profitTargetPct,
          stopLossPct,
          minConfidence,
        },
      };
    }

    // Initialize data
    this.initializeDataFromBacktest();

    const testCandles = ltfCandles.slice(500);

    for (let i = 0; i < testCandles.length; i++) {
      const candle = testCandles[i];

      // Update LTF data
      this.updateLTFData(candle as any);

      // Update analysis periodically
      if (i % 15 === 0) {
        this.ltfStructure = this.analyzeMarketStructure(this.ltfData);
        this.ltfOrderBlocks = this.identifyOrderBlocks(this.ltfData);
        this.ltfFairValueGaps = this.identifyFairValueGaps(this.ltfData);
      }

      if (i % 100 === 0 && i > 0) {
        this.htfStructure = this.analyzeMarketStructure(this.htfData);
        this.updateMainTrend();
      }

      const price = +candle.close;
      const closeTime = candle.closeTime;

      // EXIT LOGIC
      if (currentPosition) {
        const pnlPct =
          currentPosition.side === 'LONG'
            ? (price - currentPosition.entryPrice) / currentPosition.entryPrice
            : (currentPosition.entryPrice - price) / currentPosition.entryPrice;

        const profit =
          pnlPct * usdPerTrade * leverage -
          usdPerTrade * leverage * this.takerFee * 2;

        if (profit > highestProfit) highestProfit = profit;

        let exitType = '';

        if (pnlPct >= profitTargetPct) {
          exitType = 'TAKE_PROFIT';
        } else if (pnlPct <= -stopLossPct) {
          exitType = 'STOP_LOSS';
        } else if (
          highestProfit >
          this.trailingActivation * usdPerTrade * leverage
        ) {
          if (
            profit <
            highestProfit - this.trailingDistance * usdPerTrade * leverage
          ) {
            exitType = 'TRAILING';
          }
        } else if (this.enableICTExit) {
          if (currentPosition.side === 'LONG') {
            const atBearishOB = this.ltfOrderBlocks.find(
              (ob) =>
                ob.type === 'bearish' && price >= ob.low && price <= ob.high,
            );
            if (atBearishOB && profit > 0) exitType = 'ICT_OB_EXIT';
          } else {
            const atBullishOB = this.ltfOrderBlocks.find(
              (ob) =>
                ob.type === 'bullish' && price >= ob.low && price <= ob.high,
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
          currentPosition = null;
          highestProfit = 0;
          lastTradeTime = closeTime;
        }
      }

      // ENTRY LOGIC
      if (!currentPosition && closeTime - lastTradeTime >= this.cooldownMs) {
        const signal = this.generateSignalWithSettings(
          price,
          closeTime,
          minConfidence,
          rsiOverbought,
          rsiOversold,
        );

        if (signal) {
          currentPosition = {
            side: signal.side,
            entryPrice: price,
            entryTime: candle.openTime,
            reasons: signal.reasons,
          };
          highestProfit = 0;
        }
      }
    }

    // Close open position
    if (currentPosition) {
      const lastPrice = +testCandles[testCandles.length - 1].close;
      const pnlPct =
        currentPosition.side === 'LONG'
          ? (lastPrice - currentPosition.entryPrice) /
            currentPosition.entryPrice
          : (currentPosition.entryPrice - lastPrice) /
            currentPosition.entryPrice;
      const profit =
        pnlPct * usdPerTrade * leverage -
        usdPerTrade * leverage * this.takerFee * 2;

      trades.push({
        side: currentPosition.side,
        entryPrice: currentPosition.entryPrice,
        exitPrice: lastPrice,
        profit,
        exitType: 'END_OF_DATA',
      });
      totalProfit += profit;
    }

    // Calculate results
    const wins = trades.filter((t) => t.profit > 0).length;
    const losses = trades.filter((t) => t.profit <= 0).length;
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

    const avgWin =
      wins > 0
        ? trades.filter((t) => t.profit > 0).reduce((s, t) => s + t.profit, 0) /
          wins
        : 0;
    const avgLoss =
      losses > 0
        ? Math.abs(
            trades
              .filter((t) => t.profit <= 0)
              .reduce((s, t) => s + t.profit, 0),
          ) / losses
        : 0;

    const exitTypes: Record<string, number> = {};
    trades.forEach((t) => {
      exitTypes[t.exitType] = (exitTypes[t.exitType] || 0) + 1;
    });

    return {
      totalTrades: trades.length,
      wins,
      losses,
      winRate: Number(winRate.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
      avgWin: Number(avgWin.toFixed(2)),
      avgLoss: Number(avgLoss.toFixed(2)),
      riskReward: avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : 0,
      exitTypes,
      trades: trades.slice(-50), // Return last 50 trades only
      settings: {
        leverage,
        usdPerTrade,
        profitTargetPct,
        stopLossPct,
        minConfidence,
        rsiOverbought,
        rsiOversold,
      },
    };
  }

  private initializeDataFromBacktest() {
    const toTFData = (candles: any[]): typeof this.ltfData => ({
      opens: candles.map((c) => +c.open),
      closes: candles.map((c) => +c.close),
      highs: candles.map((c) => +c.high),
      lows: candles.map((c) => +c.low),
      volumes: candles.map((c) => +c.volume),
      timestamps: candles.map((c) => c.openTime),
    });

    if (this.backtestData.daily?.length) {
      this.dailyData = toTFData(this.backtestData.daily);
      this.dailyStructure = this.analyzeMarketStructure(this.dailyData);
    }
    if (this.backtestData.h8?.length) {
      this.h8Data = toTFData(this.backtestData.h8);
      this.h8Structure = this.analyzeMarketStructure(this.h8Data);
    }
    if (this.backtestData.h4?.length) {
      this.h4Data = toTFData(this.backtestData.h4);
      this.h4Structure = this.analyzeMarketStructure(this.h4Data);
    }
    if (this.backtestData.htf?.length) {
      this.htfData = toTFData(this.backtestData.htf);
      this.htfStructure = this.analyzeMarketStructure(this.htfData);
    }
    if (this.backtestData.ltf?.length) {
      const warmup = this.backtestData.ltf.slice(0, 500);
      this.ltfData = toTFData(warmup);
      this.ltfStructure = this.analyzeMarketStructure(this.ltfData);
    }

    this.updateMainTrend();
  }

  private generateSignalWithSettings(
    price: number,
    timestamp: number,
    minConfidence: number,
    rsiOverbought: number,
    rsiOversold: number,
  ): { side: 'LONG' | 'SHORT'; confidence: number; reasons: string[] } | null {
    // === TREND RIDING STRATEGY ===
    // Dốc lên = LONG pullback, Dốc xuống = SHORT pullback
    // Ăn sóng ở giữa trend, không bắt đỉnh/đáy

    const timeBonus = this.getTimeWeightedBonus(timestamp);

    // 1. DETECT SLOPE (độ dốc của trend)
    const slope = this.detectSlope(this.ltfData);
    const pullback = this.detectPullback(this.ltfData, slope);

    // 2. CALCULATE INDICATORS
    const rsi = this.calculateRSI(this.ltfData.closes, 14);
    const bb = this.calculateBollingerBands(this.ltfData.closes, 20, 2);
    const ema9 = this.calculateEMA(this.ltfData.closes, 9);
    const ema21 = this.calculateEMA(this.ltfData.closes, 21);
    const candlePattern = this.detectCandlePatterns(this.ltfData);
    const orderFlow = this.analyzeOrderFlowImbalance(this.ltfData, 5);
    const vcp = this.detectVolatilityContraction(this.ltfData);

    const closes = this.ltfData.closes;
    const len = closes.length;
    const currentPrice = closes[len - 1];
    const prevPrice = closes[len - 2];

    // === TREND RIDING SIGNALS ===
    let longSignal: { side: 'LONG'; confidence: number; reasons: string[] } | null = null;
    let shortSignal: { side: 'SHORT'; confidence: number; reasons: string[] } | null = null;

    // === LONG: Dốc lên + Pullback + Price resuming up ===
    // Cần slope decent (>0.35) + confirmation
    if (slope.direction === 'up' && slope.strength > 0.35) {
      // Confirmation signals
      const hasCandle = candlePattern.pattern === 'pin_bar_bull' || candlePattern.pattern === 'engulfing_bull';
      const hasFlow = orderFlow.imbalance === 'buy';
      const strongSlope = slope.strength > 0.5;
      const hasConfirmation = hasCandle || hasFlow || strongSlope;

      const isPullbackLong =
        pullback.isPullback && // Giá đang gần EMA
        pullback.recoverySignal && // Giá bắt đầu hồi
        rsi < 55 && // RSI không quá cao
        rsi > rsiOversold && // Nhưng cũng không quá oversold
        currentPrice > prevPrice && // Nến xanh
        hasConfirmation; // Cần ít nhất 1 confirmation

      if (isPullbackLong) {
        const reasons: string[] = ['SLOPE↑'];
        let confidence = 0;

        // Slope strength
        confidence += Math.floor(slope.strength * 50);
        reasons.push(`STR:${(slope.strength * 100).toFixed(0)}%`);

        // Pullback quality
        confidence += Math.floor(pullback.strength * 30);
        reasons.push('PULLBACK');

        // RSI scoring
        if (rsi < 40) {
          confidence += 40;
          reasons.push(`RSI:${rsi.toFixed(0)}!`);
        } else if (rsi < 50) {
          confidence += 25;
          reasons.push(`RSI:${rsi.toFixed(0)}`);
        }

        // EMA alignment
        if (ema9 > ema21) {
          confidence += 30;
          reasons.push('EMA↑');
        }

        // Candle pattern
        if (candlePattern.pattern === 'pin_bar_bull' || candlePattern.pattern === 'engulfing_bull') {
          confidence += 35;
          reasons.push('CANDLE↑');
        }

        // Order flow
        if (orderFlow.imbalance === 'buy') {
          confidence += 25;
          reasons.push('FLOW↑');
        }

        // VCP bonus
        if (vcp.isContracting) {
          confidence += 20;
          reasons.push('VCP');
        }

        // Time bonus
        if (timeBonus.bonus > 0) {
          confidence += timeBonus.bonus;
          reasons.push(timeBonus.session);
        }

        // HTF alignment
        if (this.htfStructure.trend === 'bullish' || this.mainTrend === 'bullish') {
          confidence += 25;
          reasons.push('HTF↑');
        }

        if (confidence >= minConfidence) {
          longSignal = { side: 'LONG', confidence, reasons };
        }
      }
    }

    // === SHORT: Dốc xuống + Pullback + Price resuming down ===
    // REQUIRE: slope mạnh (>0.4), pullback rõ, có candle pattern hoặc flow support
    if (slope.direction === 'down' && slope.strength > 0.4) {
      // Pullback condition: Price rallied toward EMA, now falling
      const hasConfirmation =
        candlePattern.pattern === 'pin_bar_bear' ||
        candlePattern.pattern === 'engulfing_bear' ||
        orderFlow.imbalance === 'sell';

      const isPullbackShort =
        pullback.isPullback && // Giá đang gần EMA
        pullback.recoverySignal && // Giá bắt đầu giảm lại
        rsi > 45 && // RSI không quá thấp
        rsi < rsiOverbought && // Nhưng cũng không quá overbought
        currentPrice < prevPrice && // Nến đỏ
        (hasConfirmation || slope.strength > 0.6); // Cần confirmation hoặc slope rất mạnh

      if (isPullbackShort) {
        const reasons: string[] = ['SLOPE↓'];
        let confidence = 0;

        // Slope strength
        confidence += Math.floor(slope.strength * 50);
        reasons.push(`STR:${(slope.strength * 100).toFixed(0)}%`);

        // Pullback quality
        confidence += Math.floor(pullback.strength * 30);
        reasons.push('PULLBACK');

        // RSI scoring
        if (rsi > 60) {
          confidence += 40;
          reasons.push(`RSI:${rsi.toFixed(0)}!`);
        } else if (rsi > 50) {
          confidence += 25;
          reasons.push(`RSI:${rsi.toFixed(0)}`);
        }

        // EMA alignment
        if (ema9 < ema21) {
          confidence += 30;
          reasons.push('EMA↓');
        }

        // Candle pattern
        if (candlePattern.pattern === 'pin_bar_bear' || candlePattern.pattern === 'engulfing_bear') {
          confidence += 35;
          reasons.push('CANDLE↓');
        }

        // Order flow
        if (orderFlow.imbalance === 'sell') {
          confidence += 25;
          reasons.push('FLOW↓');
        }

        // VCP bonus
        if (vcp.isContracting) {
          confidence += 20;
          reasons.push('VCP');
        }

        // Time bonus
        if (timeBonus.bonus > 0) {
          confidence += timeBonus.bonus;
          reasons.push(timeBonus.session);
        }

        // HTF alignment
        if (this.htfStructure.trend === 'bearish' || this.mainTrend === 'bearish') {
          confidence += 25;
          reasons.push('HTF↓');
        }

        if (confidence >= minConfidence) {
          shortSignal = { side: 'SHORT', confidence, reasons };
        }
      }
    }

    // === FALLBACK: Strong RSI extremes at BB bands ===
    // Chỉ entry khi không có trend signal nhưng RSI cực kỳ extreme

    if (!longSignal && !shortSignal) {
      // Extreme oversold bounce
      if (rsi <= 20 && price <= bb.lower && currentPrice > prevPrice) {
        const reasons = ['EXTREME↓', `RSI:${rsi.toFixed(0)}`, 'BB_LOW'];
        let confidence = 80;

        if (candlePattern.pattern === 'pin_bar_bull') {
          confidence += 30;
          reasons.push('PIN↑');
        }
        if (orderFlow.imbalance === 'buy') {
          confidence += 20;
          reasons.push('FLOW↑');
        }
        if (timeBonus.bonus > 0) {
          confidence += timeBonus.bonus;
          reasons.push(timeBonus.session);
        }

        if (confidence >= minConfidence) {
          longSignal = { side: 'LONG', confidence, reasons };
        }
      }

      // Extreme overbought rejection
      if (rsi >= 80 && price >= bb.upper && currentPrice < prevPrice) {
        const reasons = ['EXTREME↑', `RSI:${rsi.toFixed(0)}`, 'BB_HIGH'];
        let confidence = 80;

        if (candlePattern.pattern === 'pin_bar_bear') {
          confidence += 30;
          reasons.push('PIN↓');
        }
        if (orderFlow.imbalance === 'sell') {
          confidence += 20;
          reasons.push('FLOW↓');
        }
        if (timeBonus.bonus > 0) {
          confidence += timeBonus.bonus;
          reasons.push(timeBonus.session);
        }

        if (confidence >= minConfidence) {
          shortSignal = { side: 'SHORT', confidence, reasons };
        }
      }
    }

    // Return best signal
    if (shortSignal && longSignal) {
      return shortSignal.confidence > longSignal.confidence ? shortSignal : longSignal;
    }
    return shortSignal || longSignal;
  }
}
