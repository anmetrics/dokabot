import { ATR, EMA } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { BinanceService } from 'src/modules/binance/binance.service';
import { Candle, CandleChartInterval_LT } from 'binance-api-node';
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { Position } from 'generated/prisma';
import {
  getSettingKeyBySymbolICT,
  LIST_SYMBOL,
  SETTING_KEY,
} from 'src/modules/settings/settings.enum';
import { IStrategy } from '../../strategy.interface';
import { adjustToStepSize, getActualBought } from '../../helpers/crypto';

// ============================================================================
// ICT MULTI-TIMEFRAME SCALPING STRATEGY
// ============================================================================
// Proper ICT approach:
// - HTF (Daily/4H): Determine bias, major OBs, liquidity pools
// - LTF (5m): Execute at HTF POIs with precision
// ============================================================================

type TimeframeData = {
  closes: number[];
  highs: number[];
  lows: number[];
  opens: number[];
  volumes: number[];
  timestamps: number[];
  lastCandles: Candle[];
};

export interface SwingPoint {
  price: number;
  index: number;
  type: 'high' | 'low';
  timestamp: number;
}

export interface OrderBlock {
  high: number;
  low: number;
  type: 'bullish' | 'bearish';
  index: number;
  mitigated: boolean;
  strength: number;
  timeframe: string;
}

export interface FairValueGap {
  high: number;
  low: number;
  type: 'bullish' | 'bearish';
  index: number;
  filled: boolean;
  midpoint: number;
  timeframe: string;
}

export interface MarketStructure {
  trend: 'bullish' | 'bearish' | 'ranging';
  lastBOS: SwingPoint | null;
  lastCHoCH: SwingPoint | null;
  swingHigh: SwingPoint | null;
  swingLow: SwingPoint | null;
  premiumZone: number;
  discountZone: number;
  equilibrium: number;
}

export interface HTFContext {
  dailyBias: 'bullish' | 'bearish' | 'ranging';
  h4Bias: 'bullish' | 'bearish' | 'ranging';
  dailyStructure: MarketStructure;
  h4Structure: MarketStructure;
  htfOrderBlocks: OrderBlock[];
  htfFairValueGaps: FairValueGap[];
  dailyPremiumDiscount: { premium: number; discount: number; eq: number };
  h4PremiumDiscount: { premium: number; discount: number; eq: number };
}

export interface TradeSetup {
  valid: boolean;
  type: 'long' | 'short';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  reasons: string[];
}

export const ICT_SUFFIX = '_ICT';

export class IctSclapingStrategy implements IStrategy {
  private logger = new Logger('ICT_MTF_Strategy');
  private cumulativeProfit = 0;

  // === TIMEFRAMES ===
  private htfTimeframes: CandleChartInterval_LT[] = ['1d', '4h'];
  private ltfTimeframe: CandleChartInterval_LT = '5m';

  // === ICT CONFIG ===
  private swingLookbackHTF = 10; // swings on HTF (10 x 1d = 10 days)
  private swingLookbackLTF = 20; // swings on LTF
  private obLookbackHTF = 20; // OBs on HTF
  private obLookbackLTF = 30; // OBs on LTF
  private fvgMinSizeHTF = 0.003; // larger FVG for HTF
  private fvgMinSizeLTF = 0.001; // smaller FVG for LTF
  private liquiditySweepThreshold = 0.0005;
  private oteZoneLow = 0.618;
  private oteZoneHigh = 0.79;

  // Risk Management
  private maxDcaTimes = 10;
  private atrPeriod = 14;
  private atrMultiplierSL = 2.0;
  private atrMultiplierTP = 3.0;

  // Cooldown
  private cooldownMs = 3 * 60 * 1000; // 3 minutes
  private lastTradeTime = 0;

  // EMA
  private emaPeriod = 21;

  // Data storage per timeframe
  private timeframeData: Record<string, TimeframeData> = {};

  // HTF Context
  private htfContext: HTFContext = {
    dailyBias: 'ranging',
    h4Bias: 'ranging',
    dailyStructure: this.getEmptyStructure(),
    h4Structure: this.getEmptyStructure(),
    htfOrderBlocks: [],
    htfFairValueGaps: [],
    dailyPremiumDiscount: { premium: 0, discount: 0, eq: 0 },
    h4PremiumDiscount: { premium: 0, discount: 0, eq: 0 },
  };

  // LTF Data
  private ltfOrderBlocks: OrderBlock[] = [];
  private ltfFairValueGaps: FairValueGap[] = [];
  private ltfStructure: MarketStructure = this.getEmptyStructure();

  // Backtest
  private isRunBacktest = false;
  private backtestPositions: Position[] = [];
  private sellSuccess: any = [];
  private backtestProfit = 0;

  // HTF refresh interval
  private lastHTFRefresh = 0;
  private htfRefreshIntervalMs = 15 * 60 * 1000; // Refresh HTF every 15 minutes

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
    private readonly timeframe: '1m' | '3m' | '5m' | '15m' | '30m',
    private readonly minProfitPct: number,
  ) {
    this.ltfTimeframe = timeframe;
  }

  private getEmptyStructure(): MarketStructure {
    return {
      trend: 'ranging',
      lastBOS: null,
      lastCHoCH: null,
      swingHigh: null,
      swingLow: null,
      premiumZone: 0,
      discountZone: 0,
      equilibrium: 0,
    };
  }

  async startAll() {
    await this.start();
  }

  private async start() {
    console.log(
      `Starting ICT MTF Strategy for ${this.symbol}`,
      `\n  HTF: 1D, 4H (bias & structure)`,
      `\n  LTF: ${this.ltfTimeframe} (execution)`,
      `\n  MinProfit: ${this.minProfitPct}`,
    );

    if (this.isRunBacktest) {
      await this.backtestCandles(this.ltfTimeframe);
      return;
    }

    // Initialize HTF data
    await this.initializeHTFData();

    // Initialize LTF data
    await this.initializeLTFData();

    // Subscribe to LTF candles for execution
    this.binanceService.subscribeCandles(
      this.symbol,
      this.ltfTimeframe,
      (candle) => {
        void this.onNewCandle(candle);
      },
    );
  }

  private async initializeHTFData() {
    console.log(`[${this.symbol}] Loading HTF data...`);

    // Load Daily data
    const dailyCandles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      '1d',
      100,
    );
    this.timeframeData['1d'] = this.candlesToTimeframeData(dailyCandles);

    // Load 4H data
    const h4Candles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      '4h',
      200,
    );
    this.timeframeData['4h'] = this.candlesToTimeframeData(h4Candles);

    // Analyze HTF
    this.analyzeHTF();

    console.log(
      `[${this.symbol}] HTF Bias: Daily=${this.htfContext.dailyBias}, 4H=${this.htfContext.h4Bias}`,
    );
    console.log(
      `[${this.symbol}] HTF OBs: ${this.htfContext.htfOrderBlocks.length}, HTF FVGs: ${this.htfContext.htfFairValueGaps.length}`,
    );
  }

  private async initializeLTFData() {
    const ltfCandles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      this.ltfTimeframe,
      500,
    );
    this.timeframeData[this.ltfTimeframe] =
      this.candlesToTimeframeData(ltfCandles);

    this.analyzeLTF();
  }

  private candlesToTimeframeData(candles: any[]): TimeframeData {
    return {
      closes: candles.map((c) => +c.close),
      highs: candles.map((c) => +c.high),
      lows: candles.map((c) => +c.low),
      opens: candles.map((c) => +c.open),
      volumes: candles.map((c) => +c.volume),
      timestamps: candles.map((c) => +(c as any).openTime || Date.now()),
      lastCandles: candles.slice(-3) as Candle[],
    };
  }

  private async onNewCandle(candle: Candle) {
    const data = this.timeframeData[this.ltfTimeframe];
    if (!data) return;

    // Update LTF data
    data.closes.push(+candle.close);
    data.highs.push(+candle.high);
    data.lows.push(+candle.low);
    data.opens.push(+candle.open);
    data.volumes.push(+candle.volume);
    data.timestamps.push(Date.now());
    data.lastCandles.push(candle);
    if (data.lastCandles.length > 3) data.lastCandles.shift();

    if (data.closes.length > 500) {
      data.closes.shift();
      data.highs.shift();
      data.lows.shift();
      data.opens.shift();
      data.volumes.shift();
      data.timestamps.shift();
    }

    // Refresh HTF periodically
    const now = Date.now();
    if (now - this.lastHTFRefresh > this.htfRefreshIntervalMs) {
      await this.refreshHTFData();
      this.lastHTFRefresh = now;
    }

    // Analyze and execute
    await this.calcSignal();
  }

  private async refreshHTFData() {
    try {
      // Refresh 4H (more frequently needed)
      const h4Candles = await this.binanceService.getHistoricalCandles(
        this.symbol,
        '4h',
        50,
      );

      const data = this.timeframeData['4h'];
      if (data && h4Candles.length > 0) {
        // Update last candles
        const lastH4 = h4Candles[h4Candles.length - 1];
        data.closes[data.closes.length - 1] = +lastH4.close;
        data.highs[data.highs.length - 1] = +lastH4.high;
        data.lows[data.lows.length - 1] = +lastH4.low;
      }

      this.analyzeHTF();
    } catch (e) {
      console.error('Error refreshing HTF data:', e);
    }
  }

  // ============================================================================
  // HTF ANALYSIS (Daily + 4H)
  // ============================================================================

  private analyzeHTF() {
    // Analyze Daily
    this.htfContext.dailyStructure = this.analyzeMarketStructure(
      '1d',
      this.swingLookbackHTF,
    );
    this.htfContext.dailyBias = this.htfContext.dailyStructure.trend;
    this.htfContext.dailyPremiumDiscount = {
      premium: this.htfContext.dailyStructure.premiumZone,
      discount: this.htfContext.dailyStructure.discountZone,
      eq: this.htfContext.dailyStructure.equilibrium,
    };

    // Analyze 4H
    this.htfContext.h4Structure = this.analyzeMarketStructure(
      '4h',
      this.swingLookbackHTF,
    );
    this.htfContext.h4Bias = this.htfContext.h4Structure.trend;
    this.htfContext.h4PremiumDiscount = {
      premium: this.htfContext.h4Structure.premiumZone,
      discount: this.htfContext.h4Structure.discountZone,
      eq: this.htfContext.h4Structure.equilibrium,
    };

    // Identify HTF Order Blocks
    const dailyOBs = this.identifyOrderBlocks(
      '1d',
      this.obLookbackHTF,
      this.fvgMinSizeHTF,
    );
    const h4OBs = this.identifyOrderBlocks(
      '4h',
      this.obLookbackHTF,
      this.fvgMinSizeHTF,
    );
    this.htfContext.htfOrderBlocks = [...dailyOBs, ...h4OBs];

    // Identify HTF FVGs
    const dailyFVGs = this.identifyFairValueGaps('1d', this.fvgMinSizeHTF);
    const h4FVGs = this.identifyFairValueGaps('4h', this.fvgMinSizeHTF);
    this.htfContext.htfFairValueGaps = [...dailyFVGs, ...h4FVGs];
  }

  // ============================================================================
  // LTF ANALYSIS (5m)
  // ============================================================================

  private analyzeLTF() {
    this.ltfStructure = this.analyzeMarketStructure(
      this.ltfTimeframe,
      this.swingLookbackLTF,
    );
    this.ltfOrderBlocks = this.identifyOrderBlocks(
      this.ltfTimeframe,
      this.obLookbackLTF,
      this.fvgMinSizeLTF,
    );
    this.ltfFairValueGaps = this.identifyFairValueGaps(
      this.ltfTimeframe,
      this.fvgMinSizeLTF,
    );
  }

  // ============================================================================
  // CORE ICT ANALYSIS METHODS
  // ============================================================================

  private findSwingPoints(timeframe: string, lookback: number): SwingPoint[] {
    const data = this.timeframeData[timeframe];
    if (!data || data.closes.length < lookback * 2) return [];

    const swings: SwingPoint[] = [];
    const lb = Math.min(lookback, 5);

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
        swings.push({
          price: data.highs[i],
          index: i,
          type: 'high',
          timestamp: data.timestamps[i] || Date.now(),
        });
      }
      if (isSwingLow) {
        swings.push({
          price: data.lows[i],
          index: i,
          type: 'low',
          timestamp: data.timestamps[i] || Date.now(),
        });
      }
    }

    return swings.sort((a, b) => a.index - b.index);
  }

  private analyzeMarketStructure(
    timeframe: string,
    lookback: number,
  ): MarketStructure {
    const data = this.timeframeData[timeframe];
    if (!data || data.closes.length < 50) return this.getEmptyStructure();

    const swings = this.findSwingPoints(timeframe, lookback);
    if (swings.length < 4) return this.getEmptyStructure();

    const recentSwings = swings.slice(-10);
    const swingHighs = recentSwings.filter((s) => s.type === 'high');
    const swingLows = recentSwings.filter((s) => s.type === 'low');

    if (swingHighs.length < 2 || swingLows.length < 2)
      return this.getEmptyStructure();

    const latestHigh = swingHighs[swingHighs.length - 1];
    const prevHigh = swingHighs[swingHighs.length - 2];
    const latestLow = swingLows[swingLows.length - 1];
    const prevLow = swingLows[swingLows.length - 2];

    const currentPrice = data.closes[data.closes.length - 1];

    const higherHighs = latestHigh.price > prevHigh.price;
    const higherLows = latestLow.price > prevLow.price;
    const lowerHighs = latestHigh.price < prevHigh.price;
    const lowerLows = latestLow.price < prevLow.price;

    let trend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
    let lastBOS: SwingPoint | null = null;
    let lastCHoCH: SwingPoint | null = null;

    if (higherHighs && higherLows) {
      trend = 'bullish';
      if (currentPrice > prevHigh.price) lastBOS = latestHigh;
    } else if (lowerHighs && lowerLows) {
      trend = 'bearish';
      if (currentPrice < prevLow.price) lastBOS = latestLow;
    }

    if (trend === 'bullish' && currentPrice < latestLow.price) {
      lastCHoCH = latestLow;
    } else if (trend === 'bearish' && currentPrice > latestHigh.price) {
      lastCHoCH = latestHigh;
    }

    const rangeHigh = Math.max(latestHigh.price, prevHigh.price);
    const rangeLow = Math.min(latestLow.price, prevLow.price);
    const equilibrium = (rangeHigh + rangeLow) / 2;

    return {
      trend,
      lastBOS,
      lastCHoCH,
      swingHigh: latestHigh,
      swingLow: latestLow,
      premiumZone: equilibrium + (rangeHigh - equilibrium) * 0.5,
      discountZone: equilibrium - (equilibrium - rangeLow) * 0.5,
      equilibrium,
    };
  }

  private identifyOrderBlocks(
    timeframe: string,
    lookback: number,
    minMove: number,
  ): OrderBlock[] {
    const data = this.timeframeData[timeframe];
    if (!data || data.closes.length < lookback) return [];

    const obs: OrderBlock[] = [];
    const len = data.closes.length;

    for (let i = 3; i < Math.min(len - 1, lookback); i++) {
      const idx = len - 1 - i;

      // Bullish OB
      const isBearish = data.closes[idx] < data.opens[idx];
      const nextBullish = data.closes[idx + 1] > data.opens[idx + 1];
      const strongMove =
        (data.closes[idx + 1] - data.opens[idx + 1]) / data.opens[idx + 1] >
        minMove;

      if (isBearish && nextBullish && strongMove) {
        const moveAfter =
          Math.max(...data.highs.slice(idx + 1, idx + 5)) - data.highs[idx];
        const strength = Math.min(moveAfter / data.highs[idx] / 0.01, 1);
        const mitigated = data.lows
          .slice(idx + 2)
          .some((low) => low <= data.highs[idx]);

        obs.push({
          high: data.highs[idx],
          low: data.lows[idx],
          type: 'bullish',
          index: idx,
          mitigated,
          strength,
          timeframe,
        });
      }

      // Bearish OB
      const isBullish = data.closes[idx] > data.opens[idx];
      const nextBearish = data.closes[idx + 1] < data.opens[idx + 1];
      const strongBearMove =
        (data.opens[idx + 1] - data.closes[idx + 1]) / data.opens[idx + 1] >
        minMove;

      if (isBullish && nextBearish && strongBearMove) {
        const moveAfter =
          data.lows[idx] - Math.min(...data.lows.slice(idx + 1, idx + 5));
        const strength = Math.min(moveAfter / data.lows[idx] / 0.01, 1);
        const mitigated = data.highs
          .slice(idx + 2)
          .some((high) => high >= data.lows[idx]);

        obs.push({
          high: data.highs[idx],
          low: data.lows[idx],
          type: 'bearish',
          index: idx,
          mitigated,
          strength,
          timeframe,
        });
      }
    }

    return obs.filter((ob) => !ob.mitigated && ob.strength > 0.3).slice(0, 10);
  }

  private identifyFairValueGaps(
    timeframe: string,
    minSize: number,
  ): FairValueGap[] {
    const data = this.timeframeData[timeframe];
    if (!data || data.closes.length < 10) return [];

    const fvgs: FairValueGap[] = [];
    const len = data.closes.length;

    for (let i = 2; i < Math.min(len - 1, 30); i++) {
      const idx = len - 1 - i;

      // Bullish FVG
      const bullishGapHigh = data.lows[idx + 2];
      const bullishGapLow = data.highs[idx];

      if (bullishGapHigh > bullishGapLow) {
        const gapSize = (bullishGapHigh - bullishGapLow) / data.closes[idx];
        if (gapSize > minSize) {
          const filled = data.lows
            .slice(idx + 3)
            .some((low) => low <= bullishGapLow);

          fvgs.push({
            high: bullishGapHigh,
            low: bullishGapLow,
            type: 'bullish',
            index: idx + 1,
            filled,
            midpoint: (bullishGapHigh + bullishGapLow) / 2,
            timeframe,
          });
        }
      }

      // Bearish FVG
      const bearishGapHigh = data.lows[idx];
      const bearishGapLow = data.highs[idx + 2];

      if (bearishGapHigh > bearishGapLow) {
        const gapSize = (bearishGapHigh - bearishGapLow) / data.closes[idx];
        if (gapSize > minSize) {
          const filled = data.highs
            .slice(idx + 3)
            .some((high) => high >= bearishGapHigh);

          fvgs.push({
            high: bearishGapHigh,
            low: bearishGapLow,
            type: 'bearish',
            index: idx + 1,
            filled,
            midpoint: (bearishGapHigh + bearishGapLow) / 2,
            timeframe,
          });
        }
      }
    }

    return fvgs.filter((fvg) => !fvg.filled).slice(0, 10);
  }

  private checkLiquiditySweep(): {
    swept: boolean;
    type: 'high' | 'low' | null;
  } {
    const data = this.timeframeData[this.ltfTimeframe];
    if (!data || !this.ltfStructure.swingHigh || !this.ltfStructure.swingLow) {
      return { swept: false, type: null };
    }

    const currentHigh = data.highs[data.highs.length - 1];
    const currentLow = data.lows[data.lows.length - 1];
    const currentClose = data.closes[data.closes.length - 1];

    const swingHigh = this.ltfStructure.swingHigh.price;
    const swingLow = this.ltfStructure.swingLow.price;

    if (
      currentHigh > swingHigh * (1 + this.liquiditySweepThreshold) &&
      currentClose < swingHigh
    ) {
      return { swept: true, type: 'high' };
    }

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

    const swingHigh = structure.swingHigh.price;
    const swingLow = structure.swingLow.price;
    const range = swingHigh - swingLow;
    if (range <= 0) return false;

    if (structure.trend === 'bullish') {
      const retracement = (swingHigh - price) / range;
      return retracement >= this.oteZoneLow && retracement <= this.oteZoneHigh;
    }

    if (structure.trend === 'bearish') {
      const retracement = (price - swingLow) / range;
      return retracement >= this.oteZoneLow && retracement <= this.oteZoneHigh;
    }

    return false;
  }

  private isKillZone(): boolean {
    const now = new Date();
    const utcHour = now.getUTCHours();

    // London KZ: 2:00 - 5:00 UTC
    const londonKZ = utcHour >= 2 && utcHour <= 5;
    // NY KZ: 12:00 - 15:00 UTC
    const nyKZ = utcHour >= 12 && utcHour <= 15;
    // London Close: 10:00 - 12:00 UTC
    const londonCloseKZ = utcHour >= 10 && utcHour <= 12;

    return londonKZ || nyKZ || londonCloseKZ;
  }

  // ============================================================================
  // ICT SELL CONDITIONS CHECK
  // ============================================================================

  private checkICTSellConditions(price: number): {
    shouldSell: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    // 1. Price in HTF Premium Zone (above equilibrium)
    const inDailyPremium =
      this.htfContext.dailyPremiumDiscount.premium > 0 &&
      price > this.htfContext.dailyPremiumDiscount.premium;
    const inH4Premium =
      this.htfContext.h4PremiumDiscount.premium > 0 &&
      price > this.htfContext.h4PremiumDiscount.premium;

    if (inDailyPremium) {
      reasons.push('Price in Daily PREMIUM zone (above EQ)');
    }
    if (inH4Premium) {
      reasons.push('Price in 4H PREMIUM zone (above EQ)');
    }

    // 2. Price at HTF Bearish Order Block
    const atBearishOB = this.htfContext.htfOrderBlocks.find(
      (ob) => ob.type === 'bearish' && price >= ob.low && price <= ob.high,
    );
    if (atBearishOB) {
      reasons.push(`At HTF Bearish OB (${atBearishOB.timeframe})`);
    }

    // 3. Price at HTF Bearish FVG
    const atBearishFVG = this.htfContext.htfFairValueGaps.find(
      (fvg) => fvg.type === 'bearish' && price >= fvg.low && price <= fvg.high,
    );
    if (atBearishFVG) {
      reasons.push(`At HTF Bearish FVG (${atBearishFVG.timeframe})`);
    }

    // 4. Liquidity Sweep above swing high (sell the news)
    const { swept, type: sweepType } = this.checkLiquiditySweep();
    if (swept && sweepType === 'high') {
      reasons.push('Liquidity sweep above swing high');
    }

    // 5. LTF CHoCH (Change of Character) from bullish to bearish
    const ltfCHoCHBearish =
      this.ltfStructure.trend === 'bearish' && this.ltfStructure.lastCHoCH;
    if (ltfCHoCHBearish) {
      reasons.push('LTF CHoCH bearish detected');
    }

    // 6. Price above previous swing high (taking profit at resistance)
    const aboveSwingHigh =
      this.ltfStructure.swingHigh &&
      price > this.ltfStructure.swingHigh.price * 1.001;
    if (aboveSwingHigh) {
      reasons.push('Price above LTF swing high');
    }

    // Sell if ANY ICT condition is met
    const shouldSell = reasons.length > 0;

    return { shouldSell, reasons };
  }

  // ============================================================================
  // TRADE SETUP WITH MTF CONFLUENCE
  // ============================================================================

  private generateTradeSetup(): TradeSetup {
    const data = this.timeframeData[this.ltfTimeframe];
    if (!data || data.closes.length < 50) {
      return {
        valid: false,
        type: 'long',
        entry: 0,
        stopLoss: 0,
        takeProfit: 0,
        confidence: 0,
        reasons: [],
      };
    }

    const price = data.closes[data.closes.length - 1];
    const reasons: string[] = [];
    let confidence = 0;

    // Update LTF analysis
    this.analyzeLTF();

    const { swept, type: sweepType } = this.checkLiquiditySweep();
    const inKillZone = this.isKillZone();

    // Calculate ATR
    const atr = ATR.calculate({
      high: data.highs,
      low: data.lows,
      close: data.closes,
      period: this.atrPeriod,
    });
    const lastATR = atr[atr.length - 1] || price * 0.01;

    // EMA
    const ema = EMA.calculate({ period: this.emaPeriod, values: data.closes });
    const lastEMA = ema[ema.length - 1];

    // ===== HTF BIAS CHECK (Critical for ICT) =====
    const dailyBias = this.htfContext.dailyBias;
    const h4Bias = this.htfContext.h4Bias;
    const htfAligned = dailyBias === h4Bias && dailyBias !== 'ranging';

    // ===== BULLISH SETUP =====
    if (dailyBias === 'bullish' || h4Bias === 'bullish') {
      // HTF Bias alignment
      if (dailyBias === 'bullish') {
        confidence += 25;
        reasons.push('Daily bias BULLISH');
      }
      if (h4Bias === 'bullish') {
        confidence += 20;
        reasons.push('4H bias BULLISH');
      }
      if (htfAligned && dailyBias === 'bullish') {
        confidence += 10;
        reasons.push('HTF confluence (D+4H aligned)');
      }

      // Price in HTF discount zone
      const inDailyDiscount =
        price < this.htfContext.dailyPremiumDiscount.discount;
      const inH4Discount = price < this.htfContext.h4PremiumDiscount.discount;

      if (inDailyDiscount) {
        confidence += 15;
        reasons.push('Price in Daily DISCOUNT zone');
      }
      if (inH4Discount) {
        confidence += 10;
        reasons.push('Price in 4H DISCOUNT zone');
      }

      // Price at HTF Order Block
      const atHTFBullishOB = this.htfContext.htfOrderBlocks.find(
        (ob) =>
          ob.type === 'bullish' && price >= ob.low && price <= ob.high * 1.002,
      );
      if (atHTFBullishOB) {
        confidence += 20;
        reasons.push(`At HTF Bullish OB (${atHTFBullishOB.timeframe})`);
      }

      // Price at HTF FVG
      const atHTFBullishFVG = this.htfContext.htfFairValueGaps.find(
        (fvg) =>
          fvg.type === 'bullish' && price >= fvg.low && price <= fvg.high,
      );
      if (atHTFBullishFVG) {
        confidence += 15;
        reasons.push(`At HTF Bullish FVG (${atHTFBullishFVG.timeframe})`);
      }

      // LTF confirmation
      const inLTFOTE = this.isInOTEZone(price, this.ltfStructure);
      if (inLTFOTE) {
        confidence += 10;
        reasons.push('LTF in OTE zone (61.8-79%)');
      }

      // Liquidity sweep
      if (swept && sweepType === 'low') {
        confidence += 15;
        reasons.push('Liquidity sweep below swing low');
      }

      // LTF OB/FVG
      const atLTFBullishOB = this.ltfOrderBlocks.find(
        (ob) =>
          ob.type === 'bullish' && price >= ob.low && price <= ob.high * 1.002,
      );
      if (atLTFBullishOB) {
        confidence += 5;
        reasons.push('At LTF Bullish OB');
      }

      // Kill Zone
      if (inKillZone) {
        confidence += 5;
        reasons.push('In Kill Zone session');
      }

      // EMA
      if (price > lastEMA) {
        confidence += 3;
        reasons.push('Above EMA21');
      }

      // Minimum confidence for bullish: 50 (need HTF + some confluence)
      if (confidence >= 50) {
        return {
          valid: true,
          type: 'long',
          entry: price,
          stopLoss: price - lastATR * this.atrMultiplierSL,
          takeProfit: price + lastATR * this.atrMultiplierTP,
          confidence,
          reasons,
        };
      }
    }

    // ===== BEARISH CONTEXT (LOG ONLY) =====
    if (dailyBias === 'bearish' || h4Bias === 'bearish') {
      const bearishReasons: string[] = [];
      let bearishConf = 0;

      if (dailyBias === 'bearish') {
        bearishConf += 25;
        bearishReasons.push('Daily bias BEARISH');
      }
      if (h4Bias === 'bearish') {
        bearishConf += 20;
        bearishReasons.push('4H bias BEARISH');
      }

      const inDailyPremium =
        price > this.htfContext.dailyPremiumDiscount.premium;
      if (inDailyPremium) {
        bearishConf += 15;
        bearishReasons.push('Price in Daily PREMIUM zone');
      }

      if (bearishConf >= 50) {
        console.log(
          `[ICT] Bearish context (conf: ${bearishConf}): ${bearishReasons.join(', ')}`,
        );
      }
    }

    return {
      valid: false,
      type: 'long',
      entry: 0,
      stopLoss: 0,
      takeProfit: 0,
      confidence,
      reasons,
    };
  }

  // ============================================================================
  // MAIN SIGNAL CALCULATION
  // ============================================================================

  private async calcSignal() {
    try {
      const data = this.timeframeData[this.ltfTimeframe];
      if (!data || data.closes.length < 50) return;

      const price = data.closes[data.closes.length - 1];
      const now = Date.now();
      const cooldownOk =
        this.lastTradeTime === 0 || now - this.lastTradeTime >= this.cooldownMs;

      const openPositions = this.isRunBacktest
        ? this.backtestPositions
        : await this.binanceService.getOpenPositions(this.symbol + ICT_SUFFIX);

      // Generate MTF trade setup
      const setup = this.generateTradeSetup();

      // === BUY LOGIC ===
      if (!this.isRunBacktest && !cooldownOk) {
        // Skip buy check but still check sells
      } else if (
        setup.valid &&
        setup.type === 'long' &&
        setup.confidence >= 50
      ) {
        const minBuyPrice = openPositions.length
          ? Math.min(...openPositions.map((p) => p.buyPrice))
          : price;
        const dcaTimes = openPositions.length - 1;
        const dcaIndex = dcaTimes + 1;

        const dcaPriceSetting = await this.binanceService.getSettingByKey(
          SETTING_KEY.DCA_WHEN_DROP_PERCENT_ICT,
        );
        const DCA_PRICE_DROP_PCT = Number(dcaPriceSetting || 0.02);

        const atr = ATR.calculate({
          high: data.highs,
          low: data.lows,
          close: data.closes,
          period: this.atrPeriod,
        });
        const lastATR = atr[atr.length - 1] || price * 0.01;

        const isDcaValid =
          dcaTimes < this.maxDcaTimes &&
          price < minBuyPrice - lastATR * 0.8 &&
          price < minBuyPrice * (1 - DCA_PRICE_DROP_PCT);

        if (openPositions.length === 0 || isDcaValid) {
          const [settingMaxBuyPrice, enableBuy] = await Promise.all([
            this.binanceService.getSettingByKey(
              getSettingKeyBySymbolICT(this.symbol),
            ),
            this.binanceService.getSettingByKey(SETTING_KEY.ENABLE_BUY_ICT),
          ]);

          if (enableBuy === 'true' && price < Number(settingMaxBuyPrice || 0)) {
            // Size based on confidence
            const sizeMultiplier =
              setup.confidence >= 80 ? 1.3 : setup.confidence >= 65 ? 1.1 : 1.0;

            console.log(
              `[ICT MTF] BUY Signal (conf: ${setup.confidence}%):`,
              `\n  ${setup.reasons.join('\n  ')}`,
            );

            await this.buyPosition(price, dcaIndex || 0, sizeMultiplier);
            this.lastTradeTime = now;
          }
        }
      }

      // === SELL LOGIC (ICT Targets Only) ===
      if (openPositions.length > 0) {
        const enableSell = await this.binanceService.getSettingByKey(
          SETTING_KEY.ENABLE_SELL_ICT,
        );

        if (enableSell !== 'true') {
          return;
        }

        // === ICT SELL CONDITIONS ===
        const sellConditions = this.checkICTSellConditions(price);

        // Only sell if at least one ICT target is hit
        if (!sellConditions.shouldSell) {
          return;
        }

        const sellablePositions = openPositions.filter((pos) => {
          const dynamicMinProfitPct = this.getDynamicMinProfitPct(
            pos?.dcaIndex || 0,
          );
          return (
            !pos.isDualInvestment &&
            price >= pos.buyPrice * (1 + dynamicMinProfitPct)
          );
        });

        if (!sellablePositions.length) {
          return;
        }

        for (const pos of sellablePositions) {
          if (pos.sellPrice && pos.sellPrice > 0 && price < pos.sellPrice) {
            continue;
          }

          console.log(
            `[ICT MTF] SELL at ICT Target:`,
            `\n  ${sellConditions.reasons.join('\n  ')}`,
          );

          await this.sellPosition(pos, price);
        }
      }
    } catch (e) {
      console.error(`[${this.ltfTimeframe}] Error in ICT MTF strategy:`, e);
    }
  }

  // ============================================================================
  // BUY / SELL EXECUTION
  // ============================================================================

  private async buyPosition(
    price: number,
    dcaIndex: number,
    sizeMultiplier = 1,
  ) {
    const baseBuyUsd = await this.binanceService.getSettingByKey(
      SETTING_KEY.ICT_BUY_AMOUNT,
    );
    const usdToSpend = Math.max(Number(baseBuyUsd || 0) * sizeMultiplier, 10);

    if (usdToSpend < 5) return;

    const [rootPositions] = await Promise.all([
      this.binanceService.getOpenPositions(this.symbol),
    ]);

    const rootMinBuyPrice = Math.min(
      ...(rootPositions?.map((p) => p.buyPrice) || [Infinity]),
    );

    if (rootPositions?.length && price > rootMinBuyPrice * 1.03) return;

    const qty = adjustToStepSize(usdToSpend / price, this.symbol);

    if (this.isRunBacktest) {
      this.backtestPositions.push({
        id: randomUUID(),
        buyPrice: price,
        qty,
        usdSpent: usdToSpend,
        totalQtyActual: usdToSpend,
        dcaIndex,
        strategy: this.symbol + ICT_SUFFIX,
        symbol: this.symbol,
        sellPrice: null,
        isDualInvestment: false,
        createdAt: new Date(),
        updatedAt: null,
      });
      return;
    }

    const balances = await this.binanceService.getAccount();
    const freeUsdt = Number(
      balances.balances.find((b) => b.asset === 'USDT')?.free || 0,
    );

    if (freeUsdt < usdToSpend) {
      console.log(`[DCA ${dcaIndex}] Not enough USDT (${freeUsdt.toFixed(2)})`);
      return;
    }

    const order = await this.binanceService.placeMarketOrder(
      this.symbol,
      'BUY',
      qty,
    );

    const bnbPrice = await this.binanceService.getPrice(LIST_SYMBOL.BNBUSDT);
    const {
      totalQty: totalQtyActual,
      totalSpent,
      avgPrice,
    } = getActualBought(order, bnbPrice);

    await this.binanceService.savePosition({
      id: randomUUID(),
      buyPrice: avgPrice,
      qty,
      usdSpent: totalSpent,
      totalQtyActual,
      dcaIndex,
      strategy: this.symbol + ICT_SUFFIX,
      symbol: this.symbol,
    });

    console.log(
      `[ICT MTF DCA ${dcaIndex}] BUY ${qty} ${this.symbol} @ ${price} USD=${usdToSpend}`,
    );
  }

  private getDynamicMinProfitPct(dcaIndex: number) {
    const base = this.minProfitPct;
    const increment = 0.0007;
    return Math.max(base + dcaIndex * increment, 0.003);
  }

  private async sellPosition(pos: Position, price: number) {
    if (this.isRunBacktest) {
      const profit = pos.qty * (price - pos.buyPrice);
      this.backtestProfit += profit;
      this.backtestPositions = this.backtestPositions.filter(
        (p) => p.id !== pos.id,
      );
      console.log(
        `[BACKTEST] SELL (DCA ${pos.dcaIndex}) ${pos.qty} @ ${price} — Profit: ${profit.toFixed(2)}`,
      );
      this.sellSuccess.push({
        symbol: this.symbol,
        buyPrices: [pos.buyPrice],
        sellPrice: price,
        totalAmountBuyActual: pos.qty,
        totalAmountBuyUsdtSpent: pos.usdSpent,
        totalProfit: profit,
      });
      return pos;
    }

    const balances = await this.binanceService.getAccount();
    const asset = this.symbol.replace('USDT', '');
    const free = Number(
      balances.balances.find((b) => b.asset === asset)?.free || 0,
    );

    if (new Decimal(pos.qty).greaterThan(free)) {
      console.log('NOT ENOUGH TOKEN TO SELL:', pos.qty);
      return;
    }

    const order = await this.binanceService.placeMarketOrder(
      this.symbol,
      'SELL',
      pos.qty,
    );

    const revenueUsdt = await this.binanceService.getRevenueFromSellOrder(
      order,
      this.symbol,
    );

    const profit = revenueUsdt - pos.usdSpent;
    this.cumulativeProfit += profit;

    await this.binanceService.deletePosition(pos.id);

    await this.binanceService.saveSellSuccess({
      symbol: this.symbol,
      buyPrices: [pos.buyPrice],
      sellPrice: price,
      totalAmountBuyActual: pos.qty,
      totalAmountBuyUsdtSpent: pos.usdSpent,
      totalProfit: profit,
      totalRevenueUsdt: revenueUsdt,
    });

    console.log(
      `[ICT MTF] SELL (DCA ${pos.dcaIndex}) ${pos.qty} @ ${price} — Profit: ${profit.toFixed(2)}`,
    );

    return pos;
  }

  // ============================================================================
  // BACKTEST
  // ============================================================================

  public async backtestCandles(timeframe: CandleChartInterval_LT) {
    console.log(`[BACKTEST] Starting ICT MTF backtest for ${this.symbol}...`);

    // Initialize HTF first
    await this.initializeHTFData();

    const historicalCandles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      timeframe,
      1500,
    );

    this.timeframeData[this.ltfTimeframe] = {
      closes: [],
      highs: [],
      lows: [],
      opens: [],
      volumes: [],
      timestamps: [],
      lastCandles: [],
    };
    this.backtestPositions = [];
    this.backtestProfit = 0;
    this.lastTradeTime = 0;

    const data = this.timeframeData[this.ltfTimeframe];

    for (let i = 0; i < historicalCandles.length; i++) {
      const candle = historicalCandles[i];
      data.closes.push(+candle.close);
      data.highs.push(+candle.high);
      data.lows.push(+candle.low);
      data.opens.push(+candle.open);
      data.volumes.push(+candle.volume);
      data.timestamps.push(+(candle as any).openTime || Date.now());
      data.lastCandles.push(candle as any);
      if (data.lastCandles.length > 3) data.lastCandles.shift();
      if (data.closes.length > 500) {
        data.closes.shift();
        data.highs.shift();
        data.lows.shift();
        data.opens.shift();
        data.volumes.shift();
        data.timestamps.shift();
      }

      await this.calcSignal();
    }

    console.log('positions:', this.backtestPositions);
    console.log('sell_success:', this.sellSuccess);
    console.log(
      `[BACKTEST] Done. Profit: ${this.backtestProfit.toFixed(2)} USD`,
    );
  }

  stop() {
    this.logger.log(`Stopped ICT MTF strategy for ${this.symbol}`);
  }

  // ============================================================================
  // PUBLIC GETTERS FOR DASHBOARD
  // ============================================================================

  public getAnalysisData() {
    const data = this.timeframeData[this.ltfTimeframe];
    const currentPrice = data?.closes?.[data.closes.length - 1] || 0;

    // Generate current setup
    const setup = data?.closes?.length >= 50 ? this.generateTradeSetup() : null;
    const sellConditions = this.checkICTSellConditions(currentPrice);

    return {
      symbol: this.symbol,
      timeframe: this.ltfTimeframe,
      currentPrice,
      htfContext: {
        dailyBias: this.htfContext.dailyBias,
        h4Bias: this.htfContext.h4Bias,
        dailyStructure: this.htfContext.dailyStructure,
        h4Structure: this.htfContext.h4Structure,
        dailyPremiumDiscount: this.htfContext.dailyPremiumDiscount,
        h4PremiumDiscount: this.htfContext.h4PremiumDiscount,
      },
      orderBlocks: this.htfContext.htfOrderBlocks,
      fairValueGaps: this.htfContext.htfFairValueGaps,
      ltfStructure: this.ltfStructure,
      ltfOrderBlocks: this.ltfOrderBlocks,
      ltfFairValueGaps: this.ltfFairValueGaps,
      currentSetup: setup,
      sellConditions: sellConditions,
      isKillZone: this.isKillZone(),
      cumulativeProfit: this.cumulativeProfit,
      lastTradeTime: this.lastTradeTime,
    };
  }

  public getSymbol() {
    return this.symbol;
  }

  public getCandleData() {
    const data = this.timeframeData[this.ltfTimeframe];
    if (!data) return null;

    return {
      closes: data.closes.slice(-100),
      highs: data.highs.slice(-100),
      lows: data.lows.slice(-100),
      opens: data.opens.slice(-100),
      timestamps: data.timestamps.slice(-100),
    };
  }
}
