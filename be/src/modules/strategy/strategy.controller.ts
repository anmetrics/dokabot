import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { AuthenticationGuard } from '../authentication/guards/authentication.guard';
import { BinanceService } from '../binance/binance.service';

@Controller('strategy')
@UseGuards(AuthenticationGuard)
export class StrategyController {
  constructor(
    private readonly strategyService: StrategyService,
    private readonly binanceService: BinanceService,
  ) {}

  // ============================================================================
  // ICT ANALYSIS ENDPOINTS
  // ============================================================================

  @Get('ict/analysis')
  @HttpCode(HttpStatus.OK)
  getICTAnalysis() {
    return this.strategyService.getICTAnalysis();
  }

  @Get('ict/analysis/:symbol')
  @HttpCode(HttpStatus.OK)
  getICTAnalysisBySymbol(@Param('symbol') symbol: string) {
    return this.strategyService.getICTAnalysisBySymbol(symbol.toUpperCase());
  }

  @Get('ict/candles/:symbol')
  @HttpCode(HttpStatus.OK)
  getICTCandleData(@Param('symbol') symbol: string) {
    return this.strategyService.getICTCandleData(symbol.toUpperCase());
  }

  // ============================================================================
  // PERFORMANCE / ALPHA METRICS
  // ============================================================================

  @Get('performance')
  @HttpCode(HttpStatus.OK)
  async getPerformanceMetrics() {
    // Get trading history for alpha calculation
    const histories = await this.binanceService.getHistories(1, 1000);
    const profits = await this.binanceService.getDateProfits();
    const cumulative = await this.binanceService.getCumulativeProfits();

    // Calculate metrics
    const trades = histories.data || [];
    const totalTrades = trades.length;
    const winningTrades = trades.filter((t: any) => t.totalProfit > 0).length;
    const losingTrades = trades.filter((t: any) => t.totalProfit < 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const totalProfit = trades.reduce(
      (sum: number, t: any) => sum + (t.totalProfit || 0),
      0,
    );
    const avgProfit =
      totalTrades > 0
        ? trades.reduce(
            (sum: number, t: any) => sum + (t.totalProfit || 0),
            0,
          ) / totalTrades
        : 0;

    const winners = trades.filter((t: any) => t.totalProfit > 0);
    const losers = trades.filter((t: any) => t.totalProfit < 0);

    const avgWin =
      winners.length > 0
        ? winners.reduce((sum: number, t: any) => sum + t.totalProfit, 0) /
          winners.length
        : 0;
    const avgLoss =
      losers.length > 0
        ? Math.abs(
            losers.reduce((sum: number, t: any) => sum + t.totalProfit, 0) /
              losers.length,
          )
        : 0;

    // Profit Factor
    const grossProfit = winners.reduce(
      (sum: number, t: any) => sum + t.totalProfit,
      0,
    );
    const grossLoss = Math.abs(
      losers.reduce((sum: number, t: any) => sum + t.totalProfit, 0),
    );
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;

    // Sharpe Ratio approximation (simplified)
    const returns = trades.map((t: any) => t.totalProfit || 0);
    const avgReturn = returns.length > 0 ? totalProfit / returns.length : 0;
    const variance =
      returns.length > 0
        ? returns.reduce(
            (sum: number, r: number) => sum + Math.pow(r - avgReturn, 2),
            0,
          ) / returns.length
        : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    // Max Drawdown
    let maxDrawdown = 0;
    let peak = 0;
    let runningPnL = 0;
    for (const trade of trades) {
      runningPnL += trade.totalProfit || 0;
      if (runningPnL > peak) peak = runningPnL;
      const drawdown = peak - runningPnL;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Daily/Weekly/Monthly breakdown
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayTrades = trades.filter(
      (t: any) => new Date(t.createdAt) >= todayStart,
    );
    const weekTrades = trades.filter(
      (t: any) => new Date(t.createdAt) >= weekStart,
    );
    const monthTrades = trades.filter(
      (t: any) => new Date(t.createdAt) >= monthStart,
    );

    const todayProfit = todayTrades.reduce(
      (sum: number, t: any) => sum + (t.totalProfit || 0),
      0,
    );
    const weekProfit = weekTrades.reduce(
      (sum: number, t: any) => sum + (t.totalProfit || 0),
      0,
    );
    const monthProfit = monthTrades.reduce(
      (sum: number, t: any) => sum + (t.totalProfit || 0),
      0,
    );

    return {
      summary: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate: Number(winRate.toFixed(2)),
        totalProfit: Number(totalProfit.toFixed(2)),
        avgProfit: Number(avgProfit.toFixed(2)),
      },
      riskMetrics: {
        avgWin: Number(avgWin.toFixed(2)),
        avgLoss: Number(avgLoss.toFixed(2)),
        profitFactor: Number(profitFactor.toFixed(2)),
        sharpeRatio: Number(sharpeRatio.toFixed(2)),
        maxDrawdown: Number(maxDrawdown.toFixed(2)),
        riskRewardRatio: avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : 0,
      },
      periodBreakdown: {
        today: {
          trades: todayTrades.length,
          profit: Number(todayProfit.toFixed(2)),
        },
        week: {
          trades: weekTrades.length,
          profit: Number(weekProfit.toFixed(2)),
        },
        month: {
          trades: monthTrades.length,
          profit: Number(monthProfit.toFixed(2)),
        },
      },
      dailyProfits: profits,
      cumulativeProfits: cumulative,
    };
  }

  // ============================================================================
  // RECENT SIGNALS / LOGS
  // ============================================================================

  @Get('signals')
  @HttpCode(HttpStatus.OK)
  async getRecentSignals() {
    const ictAnalysis = this.strategyService.getICTAnalysis();
    const signals: any[] = [];

    for (const analysis of ictAnalysis) {
      if (analysis.currentSetup?.valid) {
        signals.push({
          symbol: analysis.symbol,
          type: 'BUY_SIGNAL',
          confidence: analysis.currentSetup.confidence,
          reasons: analysis.currentSetup.reasons,
          entry: analysis.currentSetup.entry,
          stopLoss: analysis.currentSetup.stopLoss,
          takeProfit: analysis.currentSetup.takeProfit,
          timestamp: Date.now(),
        });
      }

      if (analysis.sellConditions?.shouldSell) {
        signals.push({
          symbol: analysis.symbol,
          type: 'SELL_SIGNAL',
          reasons: analysis.sellConditions.reasons,
          currentPrice: analysis.currentPrice,
          timestamp: Date.now(),
        });
      }
    }

    return signals;
  }

  // ============================================================================
  // BACKTEST ENDPOINT
  // ============================================================================

  @Post('backtest')
  @HttpCode(HttpStatus.OK)
  async runBacktest(
    @Body()
    params: {
      symbol?: string;
      ltfTimeframe?: string;
      days?: number;
      leverage?: number;
      usdPerTrade?: number;
      profitTargetPct?: number;
      stopLossPct?: number;
      minConfidence?: number;
      rsiOverbought?: number;
      rsiOversold?: number;
    },
  ) {
    return this.strategyService.runBacktest(params);
  }

  @Get('backtest/settings')
  @HttpCode(HttpStatus.OK)
  getBacktestSettings() {
    return this.strategyService.getBacktestSettings();
  }
}
