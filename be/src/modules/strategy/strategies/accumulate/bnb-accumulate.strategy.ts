import { Logger } from '@nestjs/common';
import { ATR } from 'technicalindicators';
import { Candle } from 'binance-api-node';
import { BinanceService } from 'src/modules/binance/binance.service';
import { SETTING_KEY, LIST_SYMBOL } from 'src/modules/settings/settings.enum';
import { IStrategy } from '../../strategy.interface';
import { adjustToStepSize, getActualBought } from '../../helpers/crypto';
import { ema, rsi, macd } from '../../helpers/indicators';
import { getEma3Momentum } from '../helpers/ema';

// ============================================================================
// TYPES
// ============================================================================

type AccumulateState = 'IDLE' | 'SOLD' | 'BOUGHT_BACK';

interface SwingRecord {
  sellPrice: number;
  sellQty: number;
  soldUsdtReceived: number;
  sellTimestamp: number;
  candlesSinceSell: number;
  targetBuybackPrice: number;
  safetyStopPrice: number;
  confidence: number;
  reasons: string[];
}

interface SwingResult {
  sellPrice: number;
  buybackPrice: number;
  sellQty: number;
  buybackQty: number;
  coinDelta: number;
  outcome: 'TARGET_HIT' | 'SAFETY_STOP' | 'TIMEOUT';
  durationCandles: number;
  timestamp: number;
}

interface CandleBuffer {
  closes: number[];
  highs: number[];
  lows: number[];
  opens: number[];
  volumes: number[];
}

// ============================================================================
// BNB ACCUMULATION SWING STRATEGY
// ============================================================================

export class BnbAccumulateStrategy implements IStrategy {
  private logger = new Logger('BNB_Accumulate');

  // Configuration
  private readonly SYMBOL = 'BNBUSDT';
  private readonly TIMEFRAME = '5m';
  private readonly BUFFER_SIZE = 500;

  // Peak detection - Tier 1
  private readonly RSI_PERIOD = 14;
  private readonly RSI_CROSS_DOWN = 70;
  private readonly RSI_WAS_ABOVE = 75;
  private readonly RSI_LOOKBACK = 5;
  private readonly ATR_PERIOD = 14;
  private readonly EMA_TREND_PERIOD = 21;
  private readonly BEARISH_BODY_ATR_RATIO = 0.5;

  // Peak detection - Tier 2
  private readonly VOLUME_SPIKE_RATIO = 1.5;
  private readonly VOLUME_AVG_PERIOD = 20;
  private readonly TIER2_REQUIRED = 2;

  // Sizing
  private readonly MIN_CONFIDENCE = 70;
  private readonly MIN_BNB_KEEP = 0.01;
  private readonly MIN_NOTIONAL = 11;

  // Buyback
  private readonly ATR_TARGET_MULTIPLIER = 1.5;
  private readonly MIN_TARGET_DROP_PCT = 0.003;
  private readonly SAFETY_STOP_PCT = 0.003;
  private readonly TIMEOUT_CANDLES = 20;
  private readonly COOLDOWN_CANDLES = 6;

  // State
  private state: AccumulateState = 'IDLE';
  private currentSwing: SwingRecord | null = null;
  private cooldownRemaining = 0;
  private swingHistory: SwingResult[] = [];
  private totalCoinAccumulated = 0;

  // Candle data
  private data: CandleBuffer = {
    closes: [],
    highs: [],
    lows: [],
    opens: [],
    volumes: [],
  };
  private prevRsi = NaN;

  constructor(private readonly binanceService: BinanceService) {}

  // --------------------------------------------------------------------------
  // LIFECYCLE
  // --------------------------------------------------------------------------

  async startAll(): Promise<void> {
    await this.start();
  }

  stop(): void {
    this.logger.log('Stopped BNB Accumulation strategy');
  }

  private async start(): Promise<void> {
    this.logger.log('Starting BNB Accumulation Swing Strategy');
    this.logger.log('  Symbol: BNBUSDT | Timeframe: 5m');
    this.logger.log('  Goal: Accumulate more BNB via peak swing sells');

    const historicalCandles =
      await this.binanceService.getHistoricalCandles(
        this.SYMBOL,
        this.TIMEFRAME,
        this.BUFFER_SIZE,
      );

    this.data = {
      closes: historicalCandles.map((c) => +c.close),
      highs: historicalCandles.map((c) => +c.high),
      lows: historicalCandles.map((c) => +c.low),
      opens: historicalCandles.map((c) => +c.open),
      volumes: historicalCandles.map((c) => +c.volume),
    };

    // Seed prevRsi
    const rsiValues = rsi(this.data.closes, this.RSI_PERIOD);
    const validRsi = rsiValues.filter((v) => !isNaN(v));
    if (validRsi.length >= 2) {
      this.prevRsi = validRsi[validRsi.length - 2];
    }

    this.logger.log(
      `Loaded ${this.data.closes.length} historical candles`,
    );

    this.binanceService.subscribeCandles(
      this.SYMBOL,
      this.TIMEFRAME,
      (candle) => {
        void this.onNewCandle(candle);
      },
    );
  }

  // --------------------------------------------------------------------------
  // CANDLE HANDLER
  // --------------------------------------------------------------------------

  private async onNewCandle(candle: Candle): Promise<void> {
    this.data.closes.push(+candle.close);
    this.data.highs.push(+candle.high);
    this.data.lows.push(+candle.low);
    this.data.opens.push(+candle.open);
    this.data.volumes.push(+candle.volume);

    if (this.data.closes.length > this.BUFFER_SIZE) {
      this.data.closes.shift();
      this.data.highs.shift();
      this.data.lows.shift();
      this.data.opens.shift();
      this.data.volumes.shift();
    }

    await this.tick();
  }

  // --------------------------------------------------------------------------
  // STATE MACHINE
  // --------------------------------------------------------------------------

  private async tick(): Promise<void> {
    try {
      if (this.data.closes.length < 50) return;

      const price = this.data.closes[this.data.closes.length - 1];

      switch (this.state) {
        case 'IDLE':
          await this.handleIdle(price);
          break;
        case 'SOLD':
          await this.handleSold(price);
          break;
        case 'BOUGHT_BACK':
          this.handleBoughtBack();
          break;
      }
    } catch (e) {
      this.logger.error('Error in tick: ' + String(e));
    }
  }

  // --------------------------------------------------------------------------
  // IDLE - PEAK DETECTION
  // --------------------------------------------------------------------------

  private async handleIdle(price: number): Promise<void> {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining--;
      return;
    }

    const enableSetting = await this.binanceService.getSettingByKey(
      SETTING_KEY.ENABLE_ACCUMULATE,
    );
    if (enableSetting !== 'true') return;

    const detection = this.detectPeak();
    if (!detection.isPeak || detection.confidence < this.MIN_CONFIDENCE) {
      return;
    }

    const sellPct = this.getSellPercentage(detection.confidence);
    await this.executeSell(price, sellPct, detection);
  }

  private detectPeak(): {
    isPeak: boolean;
    confidence: number;
    reasons: string[];
  } {
    const len = this.data.closes.length;
    const reasons: string[] = [];
    let confidence = 0;

    // ======================== TIER 1 (ALL required) ========================

    // T1.1: RSI crossed DOWN below 70 from above 75 recently
    const rsiValues = rsi(this.data.closes, this.RSI_PERIOD);
    const currentRsi = rsiValues[rsiValues.length - 1];
    const prevRsiVal = this.prevRsi;
    this.prevRsi = currentRsi;

    if (isNaN(currentRsi) || isNaN(prevRsiVal)) {
      return { isPeak: false, confidence: 0, reasons: [] };
    }

    // Check if RSI was above 75 within the last RSI_LOOKBACK candles
    let wasAbove75 = false;
    for (
      let i = Math.max(0, rsiValues.length - this.RSI_LOOKBACK - 1);
      i < rsiValues.length - 1;
      i++
    ) {
      if (!isNaN(rsiValues[i]) && rsiValues[i] >= this.RSI_WAS_ABOVE) {
        wasAbove75 = true;
        break;
      }
    }

    const rsiCrossedDown =
      wasAbove75 && currentRsi < this.RSI_CROSS_DOWN;

    if (!rsiCrossedDown) {
      return { isPeak: false, confidence: 0, reasons: [] };
    }
    reasons.push(
      `RSI crossed down below ${this.RSI_CROSS_DOWN}: now ${currentRsi.toFixed(1)}`,
    );
    confidence += 25;

    // T1.2: Current candle bearish with body > 0.5x ATR
    const currentOpen = this.data.opens[len - 1];
    const currentClose = this.data.closes[len - 1];

    if (currentClose >= currentOpen) {
      return { isPeak: false, confidence: 0, reasons: [] };
    }

    const bearishBody = currentOpen - currentClose;
    const atrValues = ATR.calculate({
      high: this.data.highs,
      low: this.data.lows,
      close: this.data.closes,
      period: this.ATR_PERIOD,
    });
    const lastAtr = atrValues[atrValues.length - 1];

    if (!lastAtr || bearishBody < lastAtr * this.BEARISH_BODY_ATR_RATIO) {
      return { isPeak: false, confidence: 0, reasons: [] };
    }
    reasons.push(
      `Strong bearish candle: body ${bearishBody.toFixed(2)} > ${(lastAtr * this.BEARISH_BODY_ATR_RATIO).toFixed(2)} (0.5x ATR)`,
    );
    confidence += 20;

    // T1.3: Price above EMA(21) (was in uptrend)
    const ema21 = ema(this.data.closes, this.EMA_TREND_PERIOD);
    const lastEma = ema21[ema21.length - 1];

    if (isNaN(lastEma) || currentClose <= lastEma) {
      return { isPeak: false, confidence: 0, reasons: [] };
    }
    reasons.push(
      `Price ${currentClose.toFixed(2)} above EMA21 ${lastEma.toFixed(2)}`,
    );
    confidence += 15;

    // ======================== TIER 2 (at least 2/3) ========================
    let tier2Count = 0;

    // T2.1: EMA momentum bearish
    const ema8Values = ema(this.data.closes, 8);
    const momentum = getEma3Momentum(ema8Values);
    const bearishSignals = ['bear', 'strong_bear', 'fake_pump'];
    if (bearishSignals.includes(momentum.signal)) {
      tier2Count++;
      confidence += 15;
      reasons.push(`EMA momentum: ${momentum.signal}`);
    }

    // T2.2: Volume spike
    const recentVolumes = this.data.volumes.slice(
      -(this.VOLUME_AVG_PERIOD + 1),
      -1,
    );
    const avgVolume =
      recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const currentVolume = this.data.volumes[len - 1];

    if (currentVolume > avgVolume * this.VOLUME_SPIKE_RATIO) {
      tier2Count++;
      confidence += 10;
      reasons.push(
        `Volume spike: ${currentVolume.toFixed(0)} > ${(avgVolume * this.VOLUME_SPIKE_RATIO).toFixed(0)} (1.5x avg)`,
      );
    }

    // T2.3: Bearish engulfing OR MACD histogram turned negative
    let tier2_3 = false;

    if (len >= 2) {
      const prevOpen = this.data.opens[len - 2];
      const prevClose = this.data.closes[len - 2];
      const prevWasBullish = prevClose > prevOpen;
      const engulfing =
        prevWasBullish &&
        currentOpen >= prevClose &&
        currentClose <= prevOpen &&
        bearishBody > prevClose - prevOpen;

      if (engulfing) {
        tier2_3 = true;
        reasons.push('Bearish engulfing pattern');
      }
    }

    if (!tier2_3) {
      const macdResult = macd(this.data.closes, 12, 26, 9);
      const histLen = macdResult.hist.length;
      if (histLen >= 2) {
        const currentHist = macdResult.hist[histLen - 1];
        const prevHist = macdResult.hist[histLen - 2];
        if (
          !isNaN(currentHist) &&
          !isNaN(prevHist) &&
          currentHist < 0 &&
          prevHist >= 0
        ) {
          tier2_3 = true;
          reasons.push(
            `MACD histogram turned negative: ${prevHist.toFixed(4)} -> ${currentHist.toFixed(4)}`,
          );
        }
      }
    }

    if (tier2_3) {
      tier2Count++;
      confidence += 10;
    }

    if (tier2Count < this.TIER2_REQUIRED) {
      return { isPeak: false, confidence: 0, reasons: [] };
    }

    return { isPeak: true, confidence, reasons };
  }

  // --------------------------------------------------------------------------
  // SELL EXECUTION
  // --------------------------------------------------------------------------

  private getSellPercentage(confidence: number): number {
    if (confidence >= 90) return 70;
    if (confidence >= 80) return 50;
    return 30;
  }

  private async executeSell(
    price: number,
    sellPct: number,
    detection: { confidence: number; reasons: string[] },
  ): Promise<void> {
    const account = await this.binanceService.getAccount();
    const freeBnb = Number(
      account.balances.find((b) => b.asset === 'BNB')?.free || 0,
    );

    const availableBnb = Math.max(0, freeBnb - this.MIN_BNB_KEEP);
    const sellQty = adjustToStepSize(
      availableBnb * (sellPct / 100),
      this.SYMBOL,
    );

    const notionalValue = sellQty * price;
    if (sellQty <= 0 || notionalValue < this.MIN_NOTIONAL) {
      this.logger.warn(
        `Sell qty too small: ${sellQty} BNB ($${notionalValue.toFixed(2)})`,
      );
      return;
    }

    console.log(`\n========================================`);
    console.log(`[BNB_ACCUM] PEAK DETECTED - SELLING`);
    console.log(`  Confidence: ${detection.confidence}%`);
    console.log(`  Reasons:`);
    detection.reasons.forEach((r) => console.log(`    - ${r}`));
    console.log(
      `  Sell: ${sellQty} BNB (${sellPct}% of ${freeBnb.toFixed(3)} free)`,
    );
    console.log(`  Price: $${price.toFixed(2)}`);
    console.log(`========================================\n`);

    const order = await this.binanceService.placeMarketOrder(
      this.SYMBOL,
      'SELL',
      sellQty,
    );
    const usdtReceived =
      await this.binanceService.getRevenueFromSellOrder(order, this.SYMBOL);

    // Calculate buyback targets
    const atrValues = ATR.calculate({
      high: this.data.highs,
      low: this.data.lows,
      close: this.data.closes,
      period: this.ATR_PERIOD,
    });
    const lastAtr = atrValues[atrValues.length - 1] || price * 0.005;

    const atrTarget = price - lastAtr * this.ATR_TARGET_MULTIPLIER;
    const minDropTarget = price * (1 - this.MIN_TARGET_DROP_PCT);
    const targetBuybackPrice = Math.min(atrTarget, minDropTarget);
    const safetyStopPrice = price * (1 + this.SAFETY_STOP_PCT);

    this.currentSwing = {
      sellPrice: price,
      sellQty,
      soldUsdtReceived: usdtReceived,
      sellTimestamp: Date.now(),
      candlesSinceSell: 0,
      targetBuybackPrice,
      safetyStopPrice,
      confidence: detection.confidence,
      reasons: detection.reasons,
    };
    this.state = 'SOLD';

    this.logger.log(`SOLD ${sellQty} BNB @ $${price.toFixed(2)}`);
    this.logger.log(`  USDT received: $${usdtReceived.toFixed(2)}`);
    this.logger.log(
      `  Target buyback: $${targetBuybackPrice.toFixed(2)}`,
    );
    this.logger.log(
      `  Safety stop: $${safetyStopPrice.toFixed(2)}`,
    );
    this.logger.log(`  Timeout: ${this.TIMEOUT_CANDLES} candles`);
  }

  // --------------------------------------------------------------------------
  // SOLD - WAITING FOR BUYBACK
  // --------------------------------------------------------------------------

  private async handleSold(price: number): Promise<void> {
    if (!this.currentSwing) {
      this.state = 'IDLE';
      return;
    }

    this.currentSwing.candlesSinceSell++;

    // Check 1: Target price hit (success!)
    if (price <= this.currentSwing.targetBuybackPrice) {
      this.logger.log(
        `TARGET HIT! Price $${price.toFixed(2)} <= $${this.currentSwing.targetBuybackPrice.toFixed(2)}`,
      );
      await this.executeBuyback('TARGET_HIT');
      return;
    }

    // Check 2: Safety stop (price going up, buy back to limit loss)
    if (price >= this.currentSwing.safetyStopPrice) {
      this.logger.warn(
        `SAFETY STOP! Price $${price.toFixed(2)} >= $${this.currentSwing.safetyStopPrice.toFixed(2)}`,
      );
      await this.executeBuyback('SAFETY_STOP');
      return;
    }

    // Check 3: Timeout
    if (this.currentSwing.candlesSinceSell >= this.TIMEOUT_CANDLES) {
      this.logger.warn(
        `TIMEOUT! ${this.currentSwing.candlesSinceSell} candles elapsed`,
      );
      await this.executeBuyback('TIMEOUT');
      return;
    }

    // Status log every 4 candles
    if (this.currentSwing.candlesSinceSell % 4 === 0) {
      console.log(
        `[BNB_ACCUM] Waiting... candle ${this.currentSwing.candlesSinceSell}/${this.TIMEOUT_CANDLES} | ` +
          `price=$${price.toFixed(2)} | target=$${this.currentSwing.targetBuybackPrice.toFixed(2)} | ` +
          `stop=$${this.currentSwing.safetyStopPrice.toFixed(2)}`,
      );
    }
  }

  // --------------------------------------------------------------------------
  // BUYBACK EXECUTION
  // --------------------------------------------------------------------------

  private async executeBuyback(
    outcome: 'TARGET_HIT' | 'SAFETY_STOP' | 'TIMEOUT',
  ): Promise<void> {
    if (!this.currentSwing) return;

    const usdtAvailable = this.currentSwing.soldUsdtReceived;
    const currentPrice = await this.binanceService.getPrice(this.SYMBOL);

    // Calculate max qty we can buy with the USDT we have
    // Leave a small margin for price slippage
    const buyQty = adjustToStepSize(
      (usdtAvailable * 0.999) / currentPrice,
      this.SYMBOL,
    );

    if (buyQty <= 0) {
      this.logger.error('Cannot buy back: quantity is 0');
      this.state = 'IDLE';
      this.currentSwing = null;
      return;
    }

    const order = await this.binanceService.placeMarketOrder(
      this.SYMBOL,
      'BUY',
      buyQty,
    );

    const bnbPrice = await this.binanceService.getPrice(
      LIST_SYMBOL.BNBUSDT,
    );
    const { totalQty: actualBoughtQty, avgPrice: buybackPrice } =
      getActualBought(order, bnbPrice);

    const coinDelta = actualBoughtQty - this.currentSwing.sellQty;

    const result: SwingResult = {
      sellPrice: this.currentSwing.sellPrice,
      buybackPrice,
      sellQty: this.currentSwing.sellQty,
      buybackQty: actualBoughtQty,
      coinDelta,
      outcome,
      durationCandles: this.currentSwing.candlesSinceSell,
      timestamp: Date.now(),
    };
    this.swingHistory.push(result);
    this.totalCoinAccumulated += coinDelta;

    const tag = coinDelta >= 0 ? 'ACCUMULATED' : 'LOSS';
    console.log(`\n========================================`);
    console.log(`[BNB_ACCUM] SWING COMPLETE - ${tag}`);
    console.log(`  Outcome: ${outcome}`);
    console.log(
      `  Sold:   ${this.currentSwing.sellQty} BNB @ $${this.currentSwing.sellPrice.toFixed(2)}`,
    );
    console.log(
      `  Bought: ${actualBoughtQty.toFixed(4)} BNB @ $${buybackPrice.toFixed(2)}`,
    );
    console.log(
      `  Coin Delta: ${coinDelta >= 0 ? '+' : ''}${coinDelta.toFixed(6)} BNB`,
    );
    console.log(
      `  Total Accumulated: ${this.totalCoinAccumulated >= 0 ? '+' : ''}${this.totalCoinAccumulated.toFixed(6)} BNB`,
    );
    console.log(`  Duration: ${this.currentSwing.candlesSinceSell} candles`);
    console.log(
      `  History: ${this.swingHistory.length} swings | Win: ${this.getWinCount()}`,
    );
    console.log(`========================================\n`);

    this.state = 'BOUGHT_BACK';
    this.cooldownRemaining = this.COOLDOWN_CANDLES;
    this.currentSwing = null;
  }

  // --------------------------------------------------------------------------
  // BOUGHT_BACK - COOLDOWN
  // --------------------------------------------------------------------------

  private handleBoughtBack(): void {
    this.state = 'IDLE';
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  private getWinCount(): number {
    return this.swingHistory.filter((r) => r.coinDelta > 0).length;
  }

  // Public getters for potential dashboard API
  getState(): AccumulateState {
    return this.state;
  }

  getCurrentSwing(): SwingRecord | null {
    return this.currentSwing;
  }

  getSwingHistory(): SwingResult[] {
    return this.swingHistory;
  }

  getTotalAccumulated(): number {
    return this.totalCoinAccumulated;
  }

  getSymbol(): string {
    return this.SYMBOL;
  }
}
