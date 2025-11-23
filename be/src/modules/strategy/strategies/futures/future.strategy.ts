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
  private readonly timeframe = '15m';

  private readonly emaSuperFastPeriod = 3;
  private readonly emaFastPeriod = 7;
  private readonly emaMediumPeriod = 25;
  private readonly emaSlowPeriod = 99;

  private readonly usdPerTrade = 6; // 4 USD rủi ro mỗi lệnh
  private readonly maxLeverage = 10;
  private readonly sidewayThreshold = 0.001;

  private readonly sidewaySlowThreadhold = 0.00011;

  private readonly sidewayMediumThreadhold = 0.0006;

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
    console.log(
      '=== Starting Futures EMA Crossover Strategy (SOLUSDT 15m) ===',
    );

    const historicalCandles =
      await this.binanceService.getFuturesHistoricalCandles(
        this.symbol,
        this.timeframe,
        1500,
      );

    // const backtestResult = await this.runBacktest(historicalCandles as any);
    // console.log('Backtest finished:', backtestResult);

    this.initLiveTrading(historicalCandles as any);
    this.subscribe1MinCandles();
  }

  private initLiveTrading(historicalCandles: Candle[]) {
    // Khởi tạo dữ liệu EMA với nến lịch sử
    this.initializeTimeframe(this.timeframe, historicalCandles);

    // Subscribe nến futures live từ Binance
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
          // Chỉ lấy position đang mở (giả định chỉ 1 position mỗi side)
          const pos = positions[0];
          position = pos;
        }

        // Gọi onCandle với position hiện tại để xử lý sideway và crossover
        await this.onCandle(this.timeframe, candle, false, position);
      },
    );
  }

  /** ================= SUBSCRIBE 1 MIN CANDLES ================= */
  private subscribe1MinCandles() {
    this.binanceService.subscribeFuturesCandles(
      this.symbol,
      '1m',
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (candle) => {
        const positions = await this.binanceService.getFuturesPositions(
          this.symbol,
        );
        const position =
          positions && positions.length > 0 ? positions[0] : null;

        if (position) {
          await this.check1MinCandleForEarlyExit(position, +candle.close);
        }
      },
    );
  }

  /** ================= CHECK 1 MIN CANDLE FOR EARLY EXIT ================= */
  private async check1MinCandleForEarlyExit(
    position: FuturesAccountPosition,
    currentPrice: number,
  ) {
    const pnlPct =
      position.positionSide === 'LONG'
        ? (currentPrice - Number(position.entryPrice)) /
          Number(position.entryPrice)
        : (Number(position.entryPrice) - currentPrice) /
          Number(position.entryPrice);

    const profit = pnlPct * this.usdPerTrade * this.maxLeverage;

    if (profit >= 0.2) {
      await this.binanceService.closeFuturesPosition(
        this.symbol,
        position.positionSide,
      );
      console.log(
        `[1M EARLY EXIT] Closed ${position.positionSide} | Profit: $${profit.toFixed(
          2,
        )} | Price: ${currentPrice}`,
      );
    }
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

    const fastNow = data.emaFast[data.emaFast.length - 1];
    const fastPrev = data.emaFast[data.emaFast.length - 2];
    const superFastNow = data.emaSuperFast[data.emaSuperFast.length - 1];
    const superFastPrev = data.emaSuperFast[data.emaSuperFast.length - 2];
    const mediumNow = data.emaMedium[data.emaMedium.length - 1];
    const mediumPrev = data.emaMedium[data.emaMedium.length - 2];
    const slowNow = data.emaSlow[data.emaSlow.length - 1];
    const slowPrev = data.emaSlow[data.emaSlow.length - 2];

    // ==== SIDEWAY CHECK ====
    const slope = Math.abs((fastNow - fastPrev) / slowPrev);

    const slopeMedium = Math.abs((mediumNow - mediumPrev) / mediumPrev);

    const slopeSlow = Math.abs((slowNow - slowPrev) / slowPrev);

    const fastCrossUp = fastPrev <= superFastPrev && fastNow > superFastNow;
    const fastCrossDown = fastPrev >= superFastPrev && fastNow < superFastNow;

    if (slope < this.sidewayThreshold || fastCrossUp || fastCrossDown) {
      if (position) {
        const pnlPct =
          position.positionSide === 'LONG'
            ? (closePrice - Number(position.entryPrice)) /
              Number(position.entryPrice)
            : (Number(position.entryPrice) - closePrice) /
              Number(position.entryPrice);
        const profit = pnlPct * this.usdPerTrade * this.maxLeverage;
        if (profit > 0.2 && slope < this.sidewayThreshold) {
          if (isBacktest) {
            return {
              ...position,
              exitPrice: closePrice,
              exitTime: this.toVietnamTime(new Date(candle.closeTime)),
              profit,
              isSideway: true,
            };
          } else {
            await this.binanceService.closeFuturesPosition(
              this.symbol,
              position.positionSide,
            );
            return null;
          }
        }

        if (profit > 0.2) {
          if (position.positionSide === 'LONG' && fastCrossUp) {
            // close LONG
            if (isBacktest) {
              return {
                ...position,
                exitPrice: closePrice,
                exitTime: this.toVietnamTime(new Date(candle.closeTime)),
                profit,
                earlyExit: true,
              };
            }

            await this.binanceService.closeFuturesPosition(this.symbol, 'LONG');
            return null;
          }

          if (position.positionSide === 'SHORT' && fastCrossDown) {
            // close SHORT
            if (isBacktest) {
              return {
                ...position,
                exitPrice: closePrice,
                exitTime: this.toVietnamTime(new Date(candle.closeTime)),
                profit,
                earlyExit: true,
              };
            }

            await this.binanceService.closeFuturesPosition(
              this.symbol,
              'SHORT',
            );
            return null;
          }
        }
      }
    }

    if (position) {
      const pnlPct =
        position.positionSide === 'LONG'
          ? (closePrice - Number(position.entryPrice)) /
            Number(position.entryPrice)
          : (Number(position.entryPrice) - closePrice) /
            Number(position.entryPrice);

      const profit = pnlPct * this.usdPerTrade * this.maxLeverage;

      // ==== CUT-LOSS ====
      if (profit < -1) {
        // nếu lỗ > 1 USD
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
          return null;
        }
      }
    }

    // ==== CROSS SIGNAL ====
    const crossUp = fastPrev <= slowPrev && fastNow > slowNow; // LONG
    const crossDown = superFastPrev >= slowPrev && superFastNow < slowNow; // SHORT

    if (
      (crossUp && slopeSlow < this.sidewaySlowThreadhold) ||
      (crossDown && slopeSlow < this.sidewaySlowThreadhold) ||
      (crossUp && slopeMedium < this.sidewayMediumThreadhold) ||
      (crossDown && slopeMedium < this.sidewayMediumThreadhold)
    ) {
      return;
    }

    if (crossUp) {
      console.log('crossUp', crossUp, closePrice, slopeMedium);
    }

    if (!crossUp && !crossDown) return null;

    const positionSide: 'LONG' | 'SHORT' = crossUp ? 'LONG' : 'SHORT';
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
        position.profit = pnlPct * this.usdPerTrade * this.maxLeverage;
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
      position.profit = pnlPct * this.usdPerTrade * this.maxLeverage;
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
