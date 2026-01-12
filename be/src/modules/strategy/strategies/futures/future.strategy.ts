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

  // Threshold cho trend detection (nới lỏng để có nhiều tín hiệu)
  private strongTrendThreshold = 0.0002; // 0.02% - Trend nhẹ
  private sidewayThreshold = 0.00005; // 0.005% - Đi ngang

  // Profit targets - tối ưu để giữ lâu hơn
  private quickProfitTarget = 2; // $2 chốt nhanh (target cao hơn)
  private minProfitToExit = 0.2; // $0.2 - profit tối thiểu để exit khi sideway/reversal
  private cutLossAmount = -1; // -$1 cắt lỗ (rộng hơn để tránh stop sớm)

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
    console.log('=== Starting Futures Strategy (SOLUSDT 1m) ===\n');

    // Lấy historical data để backtest
    const historicalCandles =
      await this.binanceService.getFuturesHistoricalCandles(
        this.symbol,
        this.timeframe,
        1500,
      );

    console.log(`Loaded ${historicalCandles.length} candles for backtest\n`);

    // Run backtest với historical data (simulate live trading)
    await this.runHistoricalBacktest(historicalCandles as any);

    return;

    // Uncomment dòng này để chạy live trading thật
    // this.initLiveTrading(historicalCandles as any);
  }

  /**
   * Backtest với historical data - giống y hệt live trading
   * Không có logic riêng biệt, chỉ là simulate từng nến như live
   */
  private async runHistoricalBacktest(historicalCandles: Candle[]) {
    // Khởi tạo EMA với warmup data (500 nến đầu)
    const warmupCount = 500;
    const warmupCandles = historicalCandles.slice(0, warmupCount);
    this.initializeTimeframe(this.timeframe, warmupCandles);

    // Tracking cho backtest
    const trades: any[] = [];
    let currentPosition: any = null;
    let totalProfit = 0;

    // Simulate live trading với từng nến
    const testCandles = historicalCandles.slice(warmupCount);
    console.log(`Running backtest on ${testCandles.length} candles...\n`);

    const isBacktest = true;

    for (let i = 0; i < testCandles.length; i++) {
      const candle = testCandles[i];

      // Simulate vị trí hiện tại (giống live trading)
      const position = currentPosition
        ? {
            positionSide: currentPosition.side,
            entryPrice: currentPosition.entryPrice.toString(),
          }
        : null;

      // Gọi onCandle - với isBacktest=true để không call Binance API
      const signal = await this.onCandle(
        this.timeframe,
        candle,
        isBacktest,
        position as any,
      );

      // Xử lý signal (nếu có)
      if (signal) {
        // Signal có thể là: entry mới hoặc exit
        if ((signal as any).exitPrice) {
          // Exit signal
          const exitTrade = {
            side: currentPosition.side,
            entryPrice: currentPosition.entryPrice,
            entryTime: currentPosition.entryTime,
            exitPrice: (signal as any).exitPrice,
            exitTime: (signal as any).exitTime,
            profit: (signal as any).profit,
            exitType: (signal as any).quickProfit
              ? 'QUICK_PROFIT'
              : (signal as any).cutLoss
                ? 'CUT_LOSS'
                : (signal as any).sidewayExit
                  ? 'SIDEWAY'
                  : (signal as any).reversalExit
                    ? 'REVERSAL'
                    : 'OTHER',
          };
          trades.push(exitTrade);
          totalProfit += (signal as any).profit;
          currentPosition = null;

          console.log(
            `[${i}/${testCandles.length}] EXIT ${exitTrade.side} | ${exitTrade.exitType} | Profit: $${exitTrade.profit.toFixed(2)}`,
          );
        } else if ((signal as any).positionSide && !currentPosition) {
          // Entry signal
          currentPosition = {
            side: (signal as any).positionSide,
            entryPrice: (signal as any).entryPrice,
            entryTime: (signal as any).entryTime,
          };
          console.log(
            `[${i}/${testCandles.length}] ENTER ${currentPosition.side} @ ${currentPosition.entryPrice}`,
          );
        }
      }
    }

    // Đóng position còn mở (nếu có)
    if (currentPosition) {
      const lastCandle = testCandles[testCandles.length - 1];
      const closePrice = +lastCandle.close;
      const pnlPct =
        currentPosition.side === 'LONG'
          ? (closePrice - currentPosition.entryPrice) /
            currentPosition.entryPrice
          : (currentPosition.entryPrice - closePrice) /
            currentPosition.entryPrice;

      const profitBeforeFee = pnlPct * this.usdPerTrade * this.maxLeverage;
      const feeAmount = this.usdPerTrade * this.maxLeverage * this.feePerTrade;
      const profit = profitBeforeFee - feeAmount;

      trades.push({
        side: currentPosition.side,
        entryPrice: currentPosition.entryPrice,
        entryTime: currentPosition.entryTime,
        exitPrice: closePrice,
        exitTime: new Date(lastCandle.closeTime),
        profit,
        exitType: 'END_OF_DATA',
      });
      totalProfit += profit;
    }

    // Tính winrate
    const wins = trades.filter((t) => t.profit > 0).length;
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
    const initialCapital = 1000;
    const finalCapital = initialCapital + totalProfit;
    const returnPercent =
      ((finalCapital - initialCapital) / initialCapital) * 100;

    // Hiển thị kết quả
    console.log('\n=== BACKTEST RESULTS ===');
    console.log(`Total Trades: ${trades.length}`);
    console.log(`Winning Trades: ${wins}`);
    console.log(`Losing Trades: ${trades.length - wins}`);
    console.log(`Winrate: ${winRate.toFixed(2)}%`);
    console.log(`Total Profit: $${totalProfit.toFixed(2)}`);
    console.log(`Return: ${returnPercent.toFixed(2)}%`);
    console.log(`Final Capital: $${finalCapital.toFixed(2)}`);

    // Chi tiết trades
    if (trades.length > 0) {
      const avgWin =
        wins > 0
          ? trades
              .filter((t) => t.profit > 0)
              .reduce((s, t) => s + t.profit, 0) / wins
          : 0;
      const avgLoss =
        trades.length - wins > 0
          ? trades
              .filter((t) => t.profit <= 0)
              .reduce((s, t) => s + t.profit, 0) /
            (trades.length - wins)
          : 0;
      console.log(`\nAverage Win: $${avgWin.toFixed(2)}`);
      console.log(`Average Loss: $${avgLoss.toFixed(2)}`);

      // Exit type breakdown
      const exitTypes: Record<string, number> = {};
      trades.forEach((t) => {
        exitTypes[t.exitType] = (exitTypes[t.exitType] || 0) + 1;
      });
      console.log('\nExit Types:');
      Object.entries(exitTypes).forEach(([type, count]) => {
        const percentage = ((count / trades.length) * 100).toFixed(1);
        console.log(`  ${type}: ${count} (${percentage}%)`);
      });
    }

    console.log('\n=== END BACKTEST ===\n');
  }

  /**
   * In thống kê chi tiết của backtest
   */
  private printDetailedStats(result: any) {
    const trades = result.trades;
    const winTrades = trades.filter((t: any) => t.profit > 0);
    const lossTrades = trades.filter((t: any) => t.profit <= 0);

    console.log('\n=== DETAILED STATISTICS ===');
    console.log(`Total Trades: ${trades.length}`);
    console.log(`Winning Trades: ${winTrades.length}`);
    console.log(`Losing Trades: ${lossTrades.length}`);
    console.log(`Winrate: ${result.winRate.toFixed(2)}%`);
    console.log(`Total Profit: $${result.totalProfit.toFixed(2)}`);
    console.log(`Return: ${result.returnPercent.toFixed(2)}%`);

    if (winTrades.length > 0) {
      const avgWin =
        winTrades.reduce((s: number, t: any) => s + t.profit, 0) /
        winTrades.length;
      const maxWin = Math.max(...winTrades.map((t: any) => t.profit));
      console.log(`Average Win: $${avgWin.toFixed(2)}`);
      console.log(`Max Win: $${maxWin.toFixed(2)}`);
    }

    if (lossTrades.length > 0) {
      const avgLoss =
        lossTrades.reduce((s: number, t: any) => s + t.profit, 0) /
        lossTrades.length;
      const maxLoss = Math.min(...lossTrades.map((t: any) => t.profit));
      console.log(`Average Loss: $${avgLoss.toFixed(2)}`);
      console.log(`Max Loss: $${maxLoss.toFixed(2)}`);
    }

    // Exit type breakdown
    const quickProfitExits = trades.filter((t: any) => t.quickProfit).length;
    const cutLossExits = trades.filter((t: any) => t.cutLoss).length;
    const sidewayExits = trades.filter((t: any) => t.sidewayExit).length;
    const reversalExits = trades.filter((t: any) => t.reversalExit).length;
    const otherExits =
      trades.length -
      quickProfitExits -
      cutLossExits -
      sidewayExits -
      reversalExits;

    console.log('\nExit Type Breakdown:');
    console.log(
      `  Quick Profit: ${quickProfitExits} (${((quickProfitExits / trades.length) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  Cut Loss: ${cutLossExits} (${((cutLossExits / trades.length) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  Sideway: ${sidewayExits} (${((sidewayExits / trades.length) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  Reversal: ${reversalExits} (${((reversalExits / trades.length) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  Other: ${otherExits} (${((otherExits / trades.length) * 100).toFixed(1)}%)`,
    );

    // Position side breakdown
    const longTrades = trades.filter((t: any) => t.positionSide === 'LONG');
    const shortTrades = trades.filter((t: any) => t.positionSide === 'SHORT');
    const longWins = longTrades.filter((t: any) => t.profit > 0).length;
    const shortWins = shortTrades.filter((t: any) => t.profit > 0).length;

    console.log('\nPosition Side Breakdown:');
    console.log(
      `  LONG: ${longTrades.length} trades | Winrate: ${longTrades.length > 0 ? ((longWins / longTrades.length) * 100).toFixed(1) : 0}%`,
    );
    console.log(
      `  SHORT: ${shortTrades.length} trades | Winrate: ${shortTrades.length > 0 ? ((shortWins / shortTrades.length) * 100).toFixed(1) : 0}%`,
    );
    console.log('=== END STATISTICS ===\n');
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

      // 3. TREND ĐI NGANG - Exit khi trend yếu đi (chỉ khi có lời tối thiểu)
      const isSideway = slopeMedium < this.sidewayThreshold;
      if (isSideway && profit > this.minProfitToExit) {
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

      // 4. DẤU HIỆU ĐẢO CHIỀU MẠNH - SuperFast cắt Fast ngược chiều (exit nhanh)
      const superFastCrossFast =
        position.positionSide === 'LONG'
          ? superFastNow < fastNow && profit > this.minProfitToExit // SuperFast cắt xuống Fast
          : superFastNow > fastNow && profit > this.minProfitToExit; // SuperFast cắt lên Fast

      if (superFastCrossFast) {
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

    // ==== ENTRY SIGNAL (TỐI ƯU ĐỂ NHIỀU TÍN HIỆU HƠN) ====

    // 1. TREND DETECTION - Nới lỏng: chỉ cần 1 trong 3 EMA có movement
    const hasTrend =
      slopeMedium > this.strongTrendThreshold ||
      slopeFast > this.strongTrendThreshold ||
      slopeSlow > this.strongTrendThreshold;

    // 2. EMA ALIGNMENT - Chỉ cần Fast và Medium align (bỏ Slow để nới lỏng)
    const emasBullish = fastNow > mediumNow;
    const emasBearish = fastNow < mediumNow;

    // 3. CROSSOVER CONFIRMATION - Fast cross Medium (tín hiệu entry)
    const fastCrossUpMedium = fastPrev <= mediumPrev && fastNow > mediumNow;
    const fastCrossDownMedium = fastPrev >= mediumPrev && fastNow < mediumNow;

    // 4. MOMENTUM CONFIRMATION - SuperFast phải cùng hướng với Fast
    const bullishMomentum = superFastNow > fastNow;
    const bearishMomentum = superFastNow < fastNow;

    // 5. PRICE POSITION - Price phải ở phía đúng của Medium
    const priceAboveMedium = closePrice > mediumNow;
    const priceBelowMedium = closePrice < mediumNow;

    // TÍN HIỆU LONG: Có trend + Fast > Medium + Fast cắt lên + Momentum + Price > Medium
    const strongLongSignal =
      hasTrend &&
      emasBullish &&
      fastCrossUpMedium &&
      bullishMomentum &&
      priceAboveMedium;

    // TÍN HIỆU SHORT: Có trend + Fast < Medium + Fast cắt xuống + Momentum + Price < Medium
    const strongShortSignal =
      hasTrend &&
      emasBearish &&
      fastCrossDownMedium &&
      bearishMomentum &&
      priceBelowMedium;

    if (!strongLongSignal && !strongShortSignal) return null;

    const positionSide: 'LONG' | 'SHORT' = strongLongSignal ? 'LONG' : 'SHORT';
    const qty = (this.usdPerTrade * this.maxLeverage) / closePrice;

    const deadZone = 0.001; // 0.1%
    if (Math.abs(fastNow - slowNow) / slowNow < deadZone) return;

    if (isBacktest) {
      return {
        positionSide,
        entryTime: this.toVietnamTime(new Date(candle.closeTime)),
        entryPrice: closePrice,
        qty,
      };
    }

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
