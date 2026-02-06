import { CandleChartResult } from 'binance-api-node';

// ============================================================================
// INTERFACES
// ============================================================================

export interface VolumeProfileBin {
  priceLevel: number;
  priceLow: number;
  priceHigh: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  tradeCount: number;
  buyRatio: number;
  sellRatio: number;
  isHVN: boolean;
  isLVN: boolean;
  percentOfMax: number;
}

export interface ResistanceLevel {
  priceZoneLow: number;
  priceZoneHigh: number;
  priceZoneCenter: number;
  strength: number;
  totalVolume: number;
  sellVolume: number;
  buyVolume: number;
  sellDominance: number;
  timesTestedCount: number;
  lastTestedTimestamp: number | null;
  distanceFromCurrentPrice: number;
  distanceAbsolute: number;
  breakoutProbability: number;
  breakoutFactors: BreakoutProbabilityFactors | null;
}

export interface SupportLevel {
  priceZoneLow: number;
  priceZoneHigh: number;
  priceZoneCenter: number;
  strength: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  buyDominance: number;
  timesTestedCount: number;
  lastTestedTimestamp: number | null;
  distanceFromCurrentPrice: number;
  distanceAbsolute: number;
}

export interface BreakoutProbabilityFactors {
  volumeMomentumScore: number;
  testCountScore: number;
  volumeTrendScore: number;
  buySellRatioScore: number;
  distanceScore: number;
  compositeScore: number;
}

export interface VolumeResistanceAnalysis {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  analyzedCandles: number;
  analyzedFrom: number;
  analyzedTo: number;
  volumeProfile: VolumeProfileBin[];
  resistanceLevels: ResistanceLevel[];
  supportLevels: SupportLevel[];
  nextResistance: ResistanceLevel | null;
  nextSupport: SupportLevel | null;
  pointOfControl: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  totalVolumeAnalyzed: number;
  updatedAt: number;
}

interface VolumeProfileConfig {
  numberOfBins: number;
  hvnThreshold: number;
  lvnThreshold: number;
  resistanceSellRatio: number;
  supportBuyRatio: number;
}

// ============================================================================
// VOLUME PROFILE ANALYZER
// ============================================================================

export class VolumeProfileAnalyzer {
  private config: VolumeProfileConfig;

  constructor(config?: Partial<VolumeProfileConfig>) {
    this.config = {
      numberOfBins: 80,
      hvnThreshold: 0.7,
      lvnThreshold: 0.3,
      resistanceSellRatio: 0.52,
      supportBuyRatio: 0.52,
      ...config,
    };
  }

  analyze(
    candles: CandleChartResult[],
    currentPrice: number,
    symbol: string,
    timeframe: string,
  ): VolumeResistanceAnalysis {
    if (candles.length < 10) {
      return this.emptyAnalysis(symbol, timeframe, currentPrice);
    }

    const bins = this.buildVolumeProfile(candles);
    const { poc, valueAreaHigh, valueAreaLow } =
      this.calculateValueArea(bins);
    const totalVolumeAnalyzed = bins.reduce((s, b) => s + b.totalVolume, 0);

    const resistanceLevels = this.identifyResistanceLevels(
      bins,
      candles,
      currentPrice,
      totalVolumeAnalyzed,
    );
    const supportLevels = this.identifySupportLevels(
      bins,
      candles,
      currentPrice,
      totalVolumeAnalyzed,
    );

    // Calculate breakout probability for each resistance
    for (const level of resistanceLevels) {
      const factors = this.calculateBreakoutProbability(
        level,
        candles,
        currentPrice,
      );
      level.breakoutProbability = factors.compositeScore;
      level.breakoutFactors = factors;
    }

    const nextResistance =
      resistanceLevels
        .filter((r) => r.priceZoneCenter > currentPrice)
        .sort((a, b) => a.priceZoneCenter - b.priceZoneCenter)[0] || null;

    const nextSupport =
      supportLevels
        .filter((s) => s.priceZoneCenter < currentPrice)
        .sort((a, b) => b.priceZoneCenter - a.priceZoneCenter)[0] || null;

    return {
      symbol,
      timeframe,
      currentPrice,
      analyzedCandles: candles.length,
      analyzedFrom: candles[0]?.openTime || 0,
      analyzedTo: candles[candles.length - 1]?.closeTime || 0,
      volumeProfile: bins,
      resistanceLevels,
      supportLevels,
      nextResistance,
      nextSupport,
      pointOfControl: poc,
      valueAreaHigh,
      valueAreaLow,
      totalVolumeAnalyzed,
      updatedAt: Date.now(),
    };
  }

  // --------------------------------------------------------------------------
  // BUILD VOLUME PROFILE
  // --------------------------------------------------------------------------

  private buildVolumeProfile(candles: CandleChartResult[]): VolumeProfileBin[] {
    const highs = candles.map((c) => +c.high);
    const lows = candles.map((c) => +c.low);
    const priceMax = Math.max(...highs);
    const priceMin = Math.min(...lows);

    if (priceMax === priceMin) {
      return [];
    }

    const { numberOfBins } = this.config;
    const binSize = (priceMax - priceMin) / numberOfBins;

    // Initialize bins
    const bins: VolumeProfileBin[] = [];
    for (let i = 0; i < numberOfBins; i++) {
      const priceLow = priceMin + i * binSize;
      const priceHigh = priceLow + binSize;
      bins.push({
        priceLevel: (priceLow + priceHigh) / 2,
        priceLow,
        priceHigh,
        totalVolume: 0,
        buyVolume: 0,
        sellVolume: 0,
        tradeCount: 0,
        buyRatio: 0,
        sellRatio: 0,
        isHVN: false,
        isLVN: false,
        percentOfMax: 0,
      });
    }

    // Distribute candle volume proportionally across bins
    for (const candle of candles) {
      const cLow = +candle.low;
      const cHigh = +candle.high;
      const totalVol = +candle.volume;
      const buyVol = +candle.baseAssetVolume;
      const sellVol = totalVol - buyVol;
      const candleRange = cHigh - cLow;

      if (candleRange === 0 || totalVol === 0) {
        // Doji or zero-volume: assign to single bin
        const idx = this.getBinIndex(+candle.close, priceMin, binSize, numberOfBins);
        bins[idx].totalVolume += totalVol;
        bins[idx].buyVolume += buyVol;
        bins[idx].sellVolume += sellVol;
        bins[idx].tradeCount += 1;
        continue;
      }

      for (let i = 0; i < numberOfBins; i++) {
        const overlapLow = Math.max(bins[i].priceLow, cLow);
        const overlapHigh = Math.min(bins[i].priceHigh, cHigh);
        if (overlapHigh <= overlapLow) continue;

        const proportion = (overlapHigh - overlapLow) / candleRange;
        bins[i].totalVolume += totalVol * proportion;
        bins[i].buyVolume += buyVol * proportion;
        bins[i].sellVolume += sellVol * proportion;
        bins[i].tradeCount += 1;
      }
    }

    // Calculate ratios and classify HVN/LVN
    const maxVolume = Math.max(...bins.map((b) => b.totalVolume));
    if (maxVolume === 0) return bins;

    const volumes = bins.map((b) => b.totalVolume).sort((a, b) => a - b);
    const hvnCutoff = volumes[Math.floor(volumes.length * this.config.hvnThreshold)] || 0;
    const lvnCutoff = volumes[Math.floor(volumes.length * this.config.lvnThreshold)] || 0;

    for (const bin of bins) {
      bin.percentOfMax = (bin.totalVolume / maxVolume) * 100;
      bin.buyRatio = bin.totalVolume > 0 ? bin.buyVolume / bin.totalVolume : 0;
      bin.sellRatio = bin.totalVolume > 0 ? bin.sellVolume / bin.totalVolume : 0;
      bin.isHVN = bin.totalVolume >= hvnCutoff;
      bin.isLVN = bin.totalVolume <= lvnCutoff;
    }

    return bins;
  }

  // --------------------------------------------------------------------------
  // VALUE AREA & POC
  // --------------------------------------------------------------------------

  private calculateValueArea(bins: VolumeProfileBin[]): {
    poc: number;
    valueAreaHigh: number;
    valueAreaLow: number;
  } {
    if (bins.length === 0) {
      return { poc: 0, valueAreaHigh: 0, valueAreaLow: 0 };
    }

    // POC = bin with highest volume
    let pocIndex = 0;
    let maxVol = 0;
    for (let i = 0; i < bins.length; i++) {
      if (bins[i].totalVolume > maxVol) {
        maxVol = bins[i].totalVolume;
        pocIndex = i;
      }
    }

    const poc = bins[pocIndex].priceLevel;
    const totalVolume = bins.reduce((s, b) => s + b.totalVolume, 0);
    const targetVolume = totalVolume * 0.7;

    // Expand from POC alternately up/down
    let accumulated = bins[pocIndex].totalVolume;
    let upper = pocIndex;
    let lower = pocIndex;

    while (accumulated < targetVolume && (upper < bins.length - 1 || lower > 0)) {
      const upVol = upper < bins.length - 1 ? bins[upper + 1].totalVolume : -1;
      const downVol = lower > 0 ? bins[lower - 1].totalVolume : -1;

      if (upVol >= downVol && upper < bins.length - 1) {
        upper++;
        accumulated += bins[upper].totalVolume;
      } else if (lower > 0) {
        lower--;
        accumulated += bins[lower].totalVolume;
      } else {
        break;
      }
    }

    return {
      poc,
      valueAreaHigh: bins[upper].priceHigh,
      valueAreaLow: bins[lower].priceLow,
    };
  }

  // --------------------------------------------------------------------------
  // RESISTANCE LEVELS
  // --------------------------------------------------------------------------

  private identifyResistanceLevels(
    bins: VolumeProfileBin[],
    candles: CandleChartResult[],
    currentPrice: number,
    totalVolumeAnalyzed: number,
  ): ResistanceLevel[] {
    // Find HVN bins above current price with sell dominance
    const candidateBins = bins.filter(
      (b) =>
        b.priceLevel > currentPrice &&
        b.isHVN &&
        b.sellRatio >= this.config.resistanceSellRatio,
    );

    if (candidateBins.length === 0) return [];

    // Merge adjacent bins into zones
    const zones = this.mergeBinsIntoZones(candidateBins);

    // Score and build resistance levels
    const resistanceLevels: ResistanceLevel[] = zones.map((zone) => {
      const { count, lastTimestamp } = this.countTimesTestedResistance(
        candles,
        zone.low,
        zone.high,
      );
      const zoneVolume = zone.totalVolume;
      const volumeConcentration =
        totalVolumeAnalyzed > 0 ? (zoneVolume / totalVolumeAnalyzed) * 100 : 0;
      const sellDominance = zone.sellVolume / zone.totalVolume;

      // Normalize times tested (cap at 10 for scoring)
      const testFactor = Math.min(count, 10) / 10;

      const strength =
        0.4 * (sellDominance * 100) +
        0.35 * Math.min(volumeConcentration * 10, 100) +
        0.25 * (testFactor * 100);

      const distanceAbsolute = zone.center - currentPrice;
      const distanceFromCurrentPrice =
        (distanceAbsolute / currentPrice) * 100;

      return {
        priceZoneLow: +zone.low.toFixed(6),
        priceZoneHigh: +zone.high.toFixed(6),
        priceZoneCenter: +zone.center.toFixed(6),
        strength: +strength.toFixed(1),
        totalVolume: +zoneVolume.toFixed(2),
        sellVolume: +zone.sellVolume.toFixed(2),
        buyVolume: +zone.buyVolume.toFixed(2),
        sellDominance: +(sellDominance * 100).toFixed(1),
        timesTestedCount: count,
        lastTestedTimestamp: lastTimestamp,
        distanceFromCurrentPrice: +distanceFromCurrentPrice.toFixed(2),
        distanceAbsolute: +distanceAbsolute.toFixed(6),
        breakoutProbability: 0,
        breakoutFactors: null,
      };
    });

    return resistanceLevels
      .sort((a, b) => a.priceZoneCenter - b.priceZoneCenter)
      .slice(0, 10);
  }

  // --------------------------------------------------------------------------
  // SUPPORT LEVELS
  // --------------------------------------------------------------------------

  private identifySupportLevels(
    bins: VolumeProfileBin[],
    candles: CandleChartResult[],
    currentPrice: number,
    totalVolumeAnalyzed: number,
  ): SupportLevel[] {
    const candidateBins = bins.filter(
      (b) =>
        b.priceLevel < currentPrice &&
        b.isHVN &&
        b.buyRatio >= this.config.supportBuyRatio,
    );

    if (candidateBins.length === 0) return [];

    const zones = this.mergeBinsIntoZones(candidateBins);

    const supportLevels: SupportLevel[] = zones.map((zone) => {
      const { count, lastTimestamp } = this.countTimesTestedSupport(
        candles,
        zone.low,
        zone.high,
      );
      const zoneVolume = zone.totalVolume;
      const volumeConcentration =
        totalVolumeAnalyzed > 0 ? (zoneVolume / totalVolumeAnalyzed) * 100 : 0;
      const buyDominance = zone.buyVolume / zone.totalVolume;
      const testFactor = Math.min(count, 10) / 10;

      const strength =
        0.4 * (buyDominance * 100) +
        0.35 * Math.min(volumeConcentration * 10, 100) +
        0.25 * (testFactor * 100);

      const distanceAbsolute = currentPrice - zone.center;
      const distanceFromCurrentPrice =
        (distanceAbsolute / currentPrice) * 100;

      return {
        priceZoneLow: +zone.low.toFixed(6),
        priceZoneHigh: +zone.high.toFixed(6),
        priceZoneCenter: +zone.center.toFixed(6),
        strength: +strength.toFixed(1),
        totalVolume: +zoneVolume.toFixed(2),
        buyVolume: +zone.buyVolume.toFixed(2),
        sellVolume: +zone.sellVolume.toFixed(2),
        buyDominance: +(buyDominance * 100).toFixed(1),
        timesTestedCount: count,
        lastTestedTimestamp: lastTimestamp,
        distanceFromCurrentPrice: +distanceFromCurrentPrice.toFixed(2),
        distanceAbsolute: +distanceAbsolute.toFixed(6),
      };
    });

    return supportLevels
      .sort((a, b) => b.priceZoneCenter - a.priceZoneCenter)
      .slice(0, 10);
  }

  // --------------------------------------------------------------------------
  // BREAKOUT PROBABILITY
  // --------------------------------------------------------------------------

  private calculateBreakoutProbability(
    resistance: ResistanceLevel,
    candles: CandleChartResult[],
    currentPrice: number,
  ): BreakoutProbabilityFactors {
    const recentCandles = candles.slice(-20);
    const recentVolumeCandles = candles.slice(-10);

    // 1. Volume Momentum: recent avg volume vs overall avg volume
    const recentAvgVol =
      recentVolumeCandles.reduce((s, c) => s + +c.volume, 0) /
      (recentVolumeCandles.length || 1);
    const overallAvgVol =
      candles.reduce((s, c) => s + +c.volume, 0) / (candles.length || 1);
    const volRatio = overallAvgVol > 0 ? recentAvgVol / overallAvgVol : 1;
    const volumeMomentumScore = clamp(volRatio * 50, 0, 100);

    // 2. Test Count: fewer tests = more likely to break (untested resistance is weaker)
    let testCountScore: number;
    const tests = resistance.timesTestedCount;
    if (tests === 0) testCountScore = 80;
    else if (tests === 1) testCountScore = 60;
    else if (tests === 2) testCountScore = 40;
    else if (tests <= 4) testCountScore = 25;
    else testCountScore = 15;

    // 3. Volume Trend: is volume increasing as price approaches resistance?
    let volumeTrendScore = 50;
    if (recentCandles.length >= 10) {
      const firstHalf = recentCandles.slice(0, 10);
      const secondHalf = recentCandles.slice(10);
      const firstAvg =
        firstHalf.reduce((s, c) => s + +c.volume, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.length > 0
          ? secondHalf.reduce((s, c) => s + +c.volume, 0) / secondHalf.length
          : firstAvg;
      if (firstAvg > 0) {
        const trend = secondAvg / firstAvg;
        if (trend > 1.3) volumeTrendScore = 85;
        else if (trend > 1.1) volumeTrendScore = 70;
        else if (trend > 0.9) volumeTrendScore = 50;
        else if (trend > 0.7) volumeTrendScore = 30;
        else volumeTrendScore = 15;
      }
    }

    // 4. Buy/Sell Ratio: recent buy pressure
    const recentBuyVol = recentVolumeCandles.reduce(
      (s, c) => s + +c.baseAssetVolume,
      0,
    );
    const recentTotalVol = recentVolumeCandles.reduce(
      (s, c) => s + +c.volume,
      0,
    );
    const recentBuyRatio =
      recentTotalVol > 0 ? recentBuyVol / recentTotalVol : 0.5;
    const buySellRatioScore = clamp(recentBuyRatio * 100, 0, 100);

    // 5. Distance: closer = more immediately relevant
    const distancePct = resistance.distanceFromCurrentPrice;
    let distanceScore: number;
    if (distancePct < 0.5) distanceScore = 90;
    else if (distancePct < 1) distanceScore = 70;
    else if (distancePct < 2) distanceScore = 50;
    else if (distancePct < 5) distanceScore = 30;
    else distanceScore = 10;

    // Weighted composite
    const compositeScore =
      0.25 * volumeMomentumScore +
      0.25 * testCountScore +
      0.2 * volumeTrendScore +
      0.2 * buySellRatioScore +
      0.1 * distanceScore;

    return {
      volumeMomentumScore: +volumeMomentumScore.toFixed(1),
      testCountScore: +testCountScore.toFixed(1),
      volumeTrendScore: +volumeTrendScore.toFixed(1),
      buySellRatioScore: +buySellRatioScore.toFixed(1),
      distanceScore: +distanceScore.toFixed(1),
      compositeScore: +compositeScore.toFixed(1),
    };
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  private getBinIndex(
    price: number,
    priceMin: number,
    binSize: number,
    numberOfBins: number,
  ): number {
    const idx = Math.floor((price - priceMin) / binSize);
    return Math.max(0, Math.min(idx, numberOfBins - 1));
  }

  private mergeBinsIntoZones(bins: VolumeProfileBin[]): Array<{
    low: number;
    high: number;
    center: number;
    totalVolume: number;
    buyVolume: number;
    sellVolume: number;
  }> {
    if (bins.length === 0) return [];

    // Sort by price
    const sorted = [...bins].sort((a, b) => a.priceLow - b.priceLow);
    const zones: Array<{
      low: number;
      high: number;
      center: number;
      totalVolume: number;
      buyVolume: number;
      sellVolume: number;
    }> = [];

    let currentZone = {
      low: sorted[0].priceLow,
      high: sorted[0].priceHigh,
      center: sorted[0].priceLevel,
      totalVolume: sorted[0].totalVolume,
      buyVolume: sorted[0].buyVolume,
      sellVolume: sorted[0].sellVolume,
    };

    for (let i = 1; i < sorted.length; i++) {
      // If bins are adjacent (within small tolerance), merge
      if (sorted[i].priceLow <= currentZone.high * 1.001) {
        currentZone.high = sorted[i].priceHigh;
        currentZone.totalVolume += sorted[i].totalVolume;
        currentZone.buyVolume += sorted[i].buyVolume;
        currentZone.sellVolume += sorted[i].sellVolume;
        currentZone.center = (currentZone.low + currentZone.high) / 2;
      } else {
        zones.push({ ...currentZone });
        currentZone = {
          low: sorted[i].priceLow,
          high: sorted[i].priceHigh,
          center: sorted[i].priceLevel,
          totalVolume: sorted[i].totalVolume,
          buyVolume: sorted[i].buyVolume,
          sellVolume: sorted[i].sellVolume,
        };
      }
    }
    zones.push({ ...currentZone });

    return zones;
  }

  private countTimesTestedResistance(
    candles: CandleChartResult[],
    zoneLow: number,
    zoneHigh: number,
  ): { count: number; lastTimestamp: number | null } {
    let count = 0;
    let lastTimestamp: number | null = null;

    for (const candle of candles) {
      const high = +candle.high;
      const close = +candle.close;
      // Price reached into the zone but closed below it
      if (high >= zoneLow && close < zoneHigh) {
        count++;
        lastTimestamp = candle.closeTime;
      }
    }

    return { count, lastTimestamp };
  }

  private countTimesTestedSupport(
    candles: CandleChartResult[],
    zoneLow: number,
    zoneHigh: number,
  ): { count: number; lastTimestamp: number | null } {
    let count = 0;
    let lastTimestamp: number | null = null;

    for (const candle of candles) {
      const low = +candle.low;
      const close = +candle.close;
      // Price dipped into the zone but closed above it
      if (low <= zoneHigh && close > zoneLow) {
        count++;
        lastTimestamp = candle.closeTime;
      }
    }

    return { count, lastTimestamp };
  }

  private emptyAnalysis(
    symbol: string,
    timeframe: string,
    currentPrice: number,
  ): VolumeResistanceAnalysis {
    return {
      symbol,
      timeframe,
      currentPrice,
      analyzedCandles: 0,
      analyzedFrom: 0,
      analyzedTo: 0,
      volumeProfile: [],
      resistanceLevels: [],
      supportLevels: [],
      nextResistance: null,
      nextSupport: null,
      pointOfControl: 0,
      valueAreaHigh: 0,
      valueAreaLow: 0,
      totalVolumeAnalyzed: 0,
      updatedAt: Date.now(),
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
