import { EMA } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { Candle, FuturesAccountPosition } from 'binance-api-node';
import { IStrategy } from '../../strategy.interface';
import { BinanceService } from 'src/modules/binance/binance.service';
import { adjustToStepSize } from '../../helpers/crypto';
import { SETTING_KEY } from 'src/modules/settings/settings.enum';

export class FuturesEmaStrategy implements IStrategy {
  private logger = new Logger('FuturesEmaStrategy');

  private readonly symbol = 'SOLUSDT';
  private readonly timeframe = '1m';

  private readonly emaSuperFastPeriod = 3;
  private readonly emaFastPeriod = 7;
  private readonly emaMediumPeriod = 25;
  private readonly emaSlowPeriod = 99;

  private readonly usdPerTrade = 6; // USD mỗi lệnh
  private readonly maxLeverage = 10;

  // Phí giao dịch Binance Futures
  private readonly takerFee = 0.0005; // 0.05% taker fee
  private readonly feePerTrade = this.takerFee * 2; // Entry + Exit = 0.1% tổng

  // Threshold cho trend detection (nới lỏng hơn)
  private readonly strongTrendThreshold = 0.0003; // 0.03% - Trend mạnh
  private readonly sidewayThreshold = 0.0001; // 0.01% - Đi ngang

  // Quick profit targets
  private readonly quickProfitTarget = 0.5; // $0.4 chốt nhanh
  private readonly cutLossAmount = -0.5; // -$0.5 cắt lỗ nhanh

  private timeframes: Record<
    string,
    {
      closes: number[];
      lastCandles: Candle[];
      emaSuperFast: number[];
      emaFast: number[];
      emaMedium: number[];
      emaSlow: number[];
    }
  > = {};

  constructor(private readonly binanceService: BinanceService) {}

  async startAll() {
    await this.start();
  }

  private async start() {
    console.log('=== Starting Futures EMA Crossover Strategy (SOLUSDT 1m) ===');

    const historicalCandles =
      await this.binanceService.getFuturesHistoricalCandles(
        this.symbol,
        this.timeframe,
        1500,
      );

    const backtestResult = await this.runBacktest(historicalCandles as any);
    console.log('Backtest finished:', backtestResult);
    return;

    this.initLiveTrading(historicalCandles as any);
  }

  private initLiveTrading(historicalCandles: Candle[]) {
    // Khởi tạo dữ liệu EMA với nến lịch sử
    this.initializeTimeframe(this.timeframe, historicalCandles);

    // Subscribe nến futures live từ Binance (1m)
    this.binanceService.subscribeFuturesCandles(
      this.symbol,
      this.timeframe,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (candle) => {
        // Lấy tất cả position hiện tại trên sàn
        const positions = await this.binanceService.getFuturesPositions(
          this.symbol,
        );
        let position: FuturesAccountPosition | null = null;

        if (positions && positions.length > 0) {
          const pos = positions[0];
          position = pos;
        }

        // Xử lý logic vào lệnh và exit cho 1m
        await this.onCandle(this.timeframe, candle, false, position);
      },
    );
  }

  private initializeTimeframe(tf: string, candles: Candle[]) {
    const closes = candles.map((c) => +c.close);
    this.timeframes[tf] = {
      closes,
      lastCandles: candles.slice(-3) as unknown as Candle[],
      emaSuperFast: [],
      emaFast: [],
      emaMedium: [],
      emaSlow: [],
    };
    this.warmupEMAs(tf);
  }

  private warmupEMAs(tf: string) {
    const data = this.timeframes[tf];
    if (data.closes.length < this.emaSlowPeriod + 100) return;
    data.emaSuperFast = EMA.calculate({
      period: this.emaSuperFastPeriod,
      values: data.closes,
    });
    data.emaFast = EMA.calculate({
      period: this.emaFastPeriod,
      values: data.closes,
    });
    data.emaMedium = EMA.calculate({
      period: this.emaMediumPeriod,
      values: data.closes,
    });
    data.emaSlow = EMA.calculate({
      period: this.emaSlowPeriod,
      values: data.closes,
    });
  }

  private updateEMA(price: number, period: number, prevEma?: number): number {
    if (prevEma === undefined) return price;
    const k = 2 / (period + 1);
    return price * k + prevEma * (1 - k);
  }

  /**
   * onCandle logic chung cho backtest và live
   * - isBacktest: true → chỉ tạo signal cho backtest
   * - position: truyền vào backtest để chốt khi sideway
   */
  private async onCandle(
    tf: string,
    candle: Candle,
    isBacktest = false,
    position?: FuturesAccountPosition | null,
  ) {
    let data = this.timeframes[tf];
    if (!data) {
      this.timeframes[tf] = {
        closes: [],
        lastCandles: [],
        emaSuperFast: [],
        emaFast: [],
        emaMedium: [],
        emaSlow: [],
      };
      data = this.timeframes[tf];
    }

    const closePrice = +candle.close;
    data.closes.push(closePrice);
    data.lastCandles.push(candle);
    if (data.lastCandles.length > 3) data.lastCandles.shift();

    const prevSuperFast = data.emaSuperFast[data.emaSuperFast.length - 1];
    const prevFast = data.emaFast[data.emaFast.length - 1];
    const prevMedium = data.emaMedium[data.emaMedium.length - 1];
    const prevSlow = data.emaSlow[data.emaSlow.length - 1];

    const newSuperFast = this.updateEMA(
      closePrice,
      this.emaSuperFastPeriod,
      prevSuperFast,
    );
    const newFast = this.updateEMA(closePrice, this.emaFastPeriod, prevFast);
    const newMedium = this.updateEMA(
      closePrice,
      this.emaMediumPeriod,
      prevMedium,
    );
    const newSlow = this.updateEMA(closePrice, this.emaSlowPeriod, prevSlow);

    data.emaSuperFast.push(newSuperFast);
    data.emaFast.push(newFast);
    data.emaMedium.push(newMedium);
    data.emaSlow.push(newSlow);

    if (data.closes.length > 500) {
      data.closes.shift();
      data.emaSuperFast.shift();
      data.emaFast.shift();
      data.emaMedium.shift();
      data.emaSlow.shift();
    }

    if (
      data.emaFast.length < 2 ||
      data.emaSlow.length < 2 ||
      data.emaSuperFast.length < 2
    )
      return null;

    const superFastNow = data.emaSuperFast[data.emaSuperFast.length - 1];
    const fastNow = data.emaFast[data.emaFast.length - 1];
    const fastPrev = data.emaFast[data.emaFast.length - 2];
    const mediumNow = data.emaMedium[data.emaMedium.length - 1];
    const mediumPrev = data.emaMedium[data.emaMedium.length - 2];
    const slowNow = data.emaSlow[data.emaSlow.length - 1];
    const slowPrev = data.emaSlow[data.emaSlow.length - 2];

    // Tính slope để detect trend
    const slopeFast = Math.abs((fastNow - fastPrev) / fastPrev);
    const slopeMedium = Math.abs((mediumNow - mediumPrev) / mediumPrev);
    const slopeSlow = Math.abs((slowNow - slowPrev) / slowPrev);

    // ==== EXIT LOGIC (TREND ĐI NGANG HOẶC ĐẢO CHIỀU) ====
    if (position) {
      const pnlPct =
        position.positionSide === 'LONG'
          ? (closePrice - Number(position.entryPrice)) /
            Number(position.entryPrice)
          : (Number(position.entryPrice) - closePrice) /
            Number(position.entryPrice);

      // Tính profit sau phí (entry 0.05% + exit 0.05% = 0.1% total)
      const profitBeforeFee = pnlPct * this.usdPerTrade * this.maxLeverage;
      const feeAmount = this.usdPerTrade * this.maxLeverage * this.feePerTrade;
      const profit = profitBeforeFee - feeAmount;

      // 1. QUICK PROFIT - Chốt nhanh khi đạt target
      if (profit >= this.quickProfitTarget) {
        if (isBacktest) {
          return {
            ...position,
            exitPrice: closePrice,
            exitTime: this.toVietnamTime(new Date(candle.closeTime)),
            profit,
            quickProfit: true,
          };
        } else {
          await this.binanceService.closeFuturesPosition(
            this.symbol,
            position.positionSide,
          );
          console.log(
            `[QUICK EXIT] ${position.positionSide} +$${profit.toFixed(2)}`,
          );
          return null;
        }
      }

      // 2. CUT LOSS - Cắt lỗ nhanh
      if (profit <= this.cutLossAmount) {
        if (isBacktest) {
          return {
            ...position,
            exitPrice: closePrice,
            exitTime: this.toVietnamTime(new Date(candle.closeTime)),
            profit,
            cutLoss: true,
          };
        } else {
          await this.binanceService.closeFuturesPosition(
            this.symbol,
            position.positionSide,
          );
          console.log(
            `[CUT LOSS] ${position.positionSide} -$${Math.abs(profit).toFixed(2)}`,
          );
          return null;
        }
      }

      // 3. TREND ĐI NGANG - Exit khi trend yếu đi + có lời
      const isSideway = slopeMedium < this.sidewayThreshold;
      if (isSideway && profit > 0.1) {
        if (isBacktest) {
          return {
            ...position,
            exitPrice: closePrice,
            exitTime: this.toVietnamTime(new Date(candle.closeTime)),
            profit,
            sidewayExit: true,
          };
        } else {
          await this.binanceService.closeFuturesPosition(
            this.symbol,
            position.positionSide,
          );
          console.log(
            `[SIDEWAY EXIT] ${position.positionSide} +$${profit.toFixed(2)}`,
          );
          return null;
        }
      }

      // 4. DẤU HIỆU ĐẢO CHIỀU - EMA đảo chiều + có lời
      const fastCrossMedium =
        position.positionSide === 'LONG'
          ? fastPrev >= mediumPrev && fastNow < mediumNow // Fast cắt xuống Medium
          : fastPrev <= mediumPrev && fastNow > mediumNow; // Fast cắt lên Medium

      if (fastCrossMedium && profit > 0.1) {
        if (isBacktest) {
          return {
            ...position,
            exitPrice: closePrice,
            exitTime: this.toVietnamTime(new Date(candle.closeTime)),
            profit,
            reversalExit: true,
          };
        } else {
          await this.binanceService.closeFuturesPosition(
            this.symbol,
            position.positionSide,
          );
          console.log(
            `[REVERSAL EXIT] ${position.positionSide} +$${profit.toFixed(2)}`,
          );
          return null;
        }
      }
    }

    // ==== ENTRY SIGNAL (NỚI LỎNG HƠN) ====

    // 1. TREND DETECTION - Chỉ cần Medium hoặc Fast có trend + Slow không quá flat
    const hasTrend =
      (slopeMedium > this.strongTrendThreshold ||
        slopeFast > this.strongTrendThreshold) &&
      slopeSlow > this.sidewayThreshold;

    // 2. EMA ALIGNMENT - Chỉ cần Fast, Medium, Slow align (bỏ SuperFast)
    const emasBullish = fastNow > mediumNow && mediumNow > slowNow;
    const emasBearish = fastNow < mediumNow && mediumNow < slowNow;

    // 3. CROSSOVER CONFIRMATION - Fast cross Medium (tín hiệu entry)
    const fastCrossUpMedium = fastPrev <= mediumPrev && fastNow > mediumNow;
    const fastCrossDownMedium = fastPrev >= mediumPrev && fastNow < mediumNow;

    // 4. MOMENTUM CONFIRMATION - SuperFast phải cùng hướng với Fast
    const bullishMomentum = superFastNow > fastNow;
    const bearishMomentum = superFastNow < fastNow;

    // TÍN HIỆU LONG: Có trend + EMA bullish + Fast cắt lên Medium + Momentum bullish
    const strongLongSignal =
      hasTrend && emasBullish && fastCrossUpMedium && bullishMomentum;

    // TÍN HIỆU SHORT: Có trend + EMA bearish + Fast cắt xuống Medium + Momentum bearish
    const strongShortSignal =
      hasTrend && emasBearish && fastCrossDownMedium && bearishMomentum;

    if (!strongLongSignal && !strongShortSignal) return null;

    const positionSide: 'LONG' | 'SHORT' = strongLongSignal ? 'LONG' : 'SHORT';
    const qty = (this.usdPerTrade * this.maxLeverage) / closePrice;

    if (isBacktest) {
      return {
        positionSide,
        entryTime: this.toVietnamTime(new Date(candle.closeTime)),
        entryPrice: closePrice,
        qty,
      };
    }

    const deadZone = 0.001; // 0.1%
    if (Math.abs(fastNow - slowNow) / slowNow < deadZone) return;

    // ==== LIVE TRADING ====
    const enable = await this.binanceService.getSettingByKey(
      SETTING_KEY.ENABLE_FUTURE,
    );
    if (enable !== 'true') return null;

    const positions = await this.binanceService.getFuturesPositions(
      this.symbol,
    );
    for (const pos of positions || []) {
      if (pos.positionSide !== positionSide) {
        await this.binanceService.closeFuturesPosition(
          this.symbol,
          pos.positionSide,
        );
        console.log(`Closed opposite ${pos.positionSide} position`);
      }
    }

    const adjustedQty = adjustToStepSize(qty, this.symbol);
    await this.binanceService.placeFuturesMarketOrder(
      this.symbol,
      positionSide === 'LONG' ? 'BUY' : 'SELL',
      adjustedQty,
    );
    console.log(
      `[LIVE] OPENED ${positionSide} | Qty: ${adjustedQty.toFixed(4)} | Price: ${closePrice.toFixed(4)}`,
    );

    return null;
  }

  stop() {
    console.log('Stopped Futures EMA Strategy');
  }

  async runBacktest(rawCandles: Candle[], warmupCount = 500) {
    console.log(`\n=== BACKTEST ${this.symbol} ${this.timeframe} ===`);

    const tf = this.timeframe;
    this.timeframes[tf] = {
      closes: [],
      lastCandles: [],
      emaSuperFast: [],
      emaFast: [],
      emaMedium: [],
      emaSlow: [],
    };
    const data = this.timeframes[tf];
    const trades: any[] = [];
    let position: any = null;

    // Warmup EMA với nến đầu tiên
    const warmupCandles = rawCandles.slice(0, warmupCount);
    warmupCandles.forEach((c) => data.closes.push(+c.close));
    this.warmupEMAs(tf);

    // Bắt đầu backtest từ nến tiếp theo
    const testCandles = rawCandles.slice(warmupCount);

    for (const candle of testCandles) {
      const signal = await this.onCandle(tf, candle, true, position);

      // Nếu không có signal → tiếp tục
      if (!signal) continue;

      const closePrice = +candle.close;

      // Nếu signal là sideway exit → đóng position
      if ((signal as any).exitPrice) {
        trades.push({ ...signal });
        position = null;
        continue;
      }

      // Nếu đảo chiều → đóng position cũ
      if (position && position.positionSide !== signal.positionSide) {
        const pnlPct =
          position.positionSide === 'LONG'
            ? (closePrice - position.entryPrice) / position.entryPrice
            : (position.entryPrice - closePrice) / position.entryPrice;

        position.exitPrice = closePrice;
        position.exitTime = this.toVietnamTime(new Date(candle.closeTime));
        const profitBeforeFee = pnlPct * this.usdPerTrade * this.maxLeverage;
        const feeAmount =
          this.usdPerTrade * this.maxLeverage * this.feePerTrade;
        position.profit = profitBeforeFee - feeAmount;
        trades.push({ ...position });
        position = null;
      }

      // Mở position mới nếu chưa có
      if (!position) {
        position = {
          ...signal,
          qty: signal?.qty,
        };
      }
    }

    // Đóng lệnh còn mở cuối cùng
    if (position) {
      const lastClose = +testCandles[testCandles.length - 1].close;
      const pnlPct =
        position.positionSide === 'LONG'
          ? (lastClose - position.entryPrice) / position.entryPrice
          : (position.entryPrice - lastClose) / position.entryPrice;

      position.exitPrice = lastClose;
      position.exitTime = this.toVietnamTime(
        new Date(testCandles[testCandles.length - 1].closeTime),
      );
      const profitBeforeFee = pnlPct * this.usdPerTrade * this.maxLeverage;
      const feeAmount = this.usdPerTrade * this.maxLeverage * this.feePerTrade;
      position.profit = profitBeforeFee - feeAmount;
      trades.push(position);
    }

    // Tính tổng lợi nhuận và winrate
    const closed = trades.filter((t) => t.profit !== undefined);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const totalProfit = closed.reduce((s, t) => s + (t.profit || 0), 0);
    const wins = closed.filter((t) => (t.profit || 0) > 0).length;
    const winRate = closed.length ? (wins / closed.length) * 100 : 0;

    const initialCapital = 1000;
    const finalCapital = initialCapital + totalProfit;
    const returnPercent = (finalCapital / initialCapital - 1) * 100;

    return {
      trades,
      totalProfit,
      winRate,
      finalCapital,
      returnPercent,
    };
  }

  private toVietnamTime(date: Date | number): Date {
    return new Date(new Date(date).getTime() + 7 * 60 * 60 * 1000);
  }
}
