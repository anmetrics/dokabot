import { Injectable, Logger } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { IStrategy } from './strategy.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma.service';
import { SETTING_KEY } from '../settings/settings.enum';
import { FuturesEmaStrategy } from './strategies/futures/future.strategy';
import { MiniReversalDcaStrategy } from './strategies/mini/mini_reversal_dca.strategy';
import { GoldReversalDcaStrategy } from './strategies/gold/gold-rsi-reversal.strategy';
import { IctSclapingStrategy } from './strategies/mini/ict.strategy';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StrategyService {
  private logger = new Logger('StrategyService');

  private mini1: IStrategy;
  private mini2: IStrategy;
  private mini3: IStrategy;

  private supermini1: IStrategy;
  private supermini2: IStrategy;
  private supermini3: IStrategy;

  private goldStrategy1: IStrategy;

  private future: IStrategy;

  constructor(
    private readonly binanceService: BinanceService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prismaService: PrismaService,
  ) {}

  async getSettingByKey(key: SETTING_KEY) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.prismaService.setting.findFirst({
      where: {
        key,
      },
    });
  }

  startStrategy(name: string) {
    // ICT Multi-Timeframe Strategy
    // HTF: 1D + 4H (bias & structure)
    // LTF: 5m (execution)
    this.mini1 = new IctSclapingStrategy(
      this.binanceService,
      'BNBUSDT',
      '5m',
      0.006,
    );
    this.mini2 = new IctSclapingStrategy(
      this.binanceService,
      'BTCUSDT',
      '5m',
      0.006,
    );

    this.mini3 = new IctSclapingStrategy(
      this.binanceService,
      'SOLUSDT',
      '5m',
      0.006,
    );

    // Supermini sclaping
    this.supermini1 = new MiniReversalDcaStrategy(
      this.binanceService,
      'SOLUSDT',
      '5m',
      0.005,
    );
    this.supermini2 = new MiniReversalDcaStrategy(
      this.binanceService,
      'BTCUSDT',
      '5m',
      0.005,
    );
    this.supermini3 = new MiniReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      '5m',
      0.005,
    );

    //  Gold
    this.goldStrategy1 = new GoldReversalDcaStrategy(
      this.binanceService,
      'PAXGUSDT',
      '5m',
      0.0042,
    );

    // Futures
    this.future = new FuturesEmaStrategy(this.binanceService);

    // // Mini
    this.mini1.startAll();
    this.mini2.startAll();
    this.mini3.startAll();

    // Supermini
    // this.supermini1.startAll();
    // this.supermini2.startAll();
    // this.supermini3.startAll();

    // Gold
    // this.goldStrategy1.startAll();

    this.logger.log(`Started strategy: ${name}`);
  }

  // ============================================================================
  // ICT ANALYSIS API
  // ============================================================================

  getICTStrategies(): IctSclapingStrategy[] {
    const strategies: IctSclapingStrategy[] = [];
    if (this.mini1 instanceof IctSclapingStrategy) strategies.push(this.mini1);
    if (this.mini2 instanceof IctSclapingStrategy) strategies.push(this.mini2);
    if (this.mini3 instanceof IctSclapingStrategy) strategies.push(this.mini3);
    return strategies;
  }

  getICTAnalysis() {
    const strategies = this.getICTStrategies();
    return strategies.map((s) => s.getAnalysisData());
  }

  getICTAnalysisBySymbol(symbol: string) {
    const strategies = this.getICTStrategies();
    const strategy = strategies.find((s) => s.getSymbol() === symbol);
    return strategy ? strategy.getAnalysisData() : null;
  }

  getICTCandleData(symbol: string) {
    const strategies = this.getICTStrategies();
    const strategy = strategies.find((s) => s.getSymbol() === symbol);
    return strategy ? strategy.getCandleData() : null;
  }

  // ============================================================================
  // BACKTEST
  // ============================================================================

  private loadBacktestData(filename: string): any[] {
    const filePath = path.join(__dirname, '..', '..', '..', 'data', filename);
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`File not found: ${filePath}`);
      return [];
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    // Convert to Candle format
    return data.map((c: any) => ({
      openTime: c.openTime,
      open: String(c.open),
      high: String(c.high),
      low: String(c.low),
      close: String(c.close),
      volume: String(c.volume),
      closeTime: c.closeTime,
      quoteVolume: '0',
      trades: 0,
      baseAssetVolume: '0',
      quoteAssetVolume: '0',
    }));
  }

  getBacktestSettings() {
    return {
      symbols: ['BTCUSDT'],
      timeframes: ['1m', '3m', '5m', '15m'],
      defaults: {
        symbol: 'BTCUSDT',
        ltfTimeframe: '3m',
        days: 90,
        leverage: 50,
        usdPerTrade: 20,
        profitTargetPct: 0.005,
        stopLossPct: 0.005,
        minConfidence: 200,
        rsiOverbought: 72,
        rsiOversold: 28,
      },
      availableData: {
        '1m': fs.existsSync(
          path.join(__dirname, '..', '..', '..', 'data', 'btc_1m_90d.json'),
        ),
        '3m': fs.existsSync(
          path.join(__dirname, '..', '..', '..', 'data', 'btc_3m_90d.json'),
        ),
        '5m': fs.existsSync(
          path.join(__dirname, '..', '..', '..', 'data', 'btc_5m_90d.json'),
        ),
      },
    };
  }

  async runBacktest(params: {
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
  }) {
    const {
      ltfTimeframe = '3m',
      leverage = 50,
      usdPerTrade = 20,
      profitTargetPct = 0.005,
      stopLossPct = 0.005,
      minConfidence = 200,
      rsiOverbought = 72,
      rsiOversold = 28,
    } = params;

    // Load data from files
    const dailyData = this.loadBacktestData('btc_1d_365d.json');
    const h8Data = this.loadBacktestData('btc_8h_365d.json');
    const h4Data = this.loadBacktestData('btc_4h_365d.json');
    const htfData = this.loadBacktestData('btc_1h_180d.json');

    // Load LTF data based on selected timeframe
    let ltfFilename = 'btc_3m_90d.json';
    if (ltfTimeframe === '1m') ltfFilename = 'btc_1m_90d.json';
    else if (ltfTimeframe === '5m') ltfFilename = 'btc_5m_90d.json';
    const ltfData = this.loadBacktestData(ltfFilename);

    if (!dailyData.length || !h4Data.length || !ltfData.length) {
      return {
        success: false,
        error: 'Missing data files. Run: npx tsx scripts/fetch-btc-data.ts',
      };
    }

    // Create strategy instance with custom settings
    const strategy = new FuturesEmaStrategy(null);

    // Apply custom settings (need to modify FuturesEmaStrategy to accept these)
    strategy.setBacktestData({
      daily: dailyData,
      h8: h8Data.length ? h8Data : h4Data,
      h4: h4Data,
      htf: htfData,
      ltf: ltfData,
    });

    // Run backtest and capture results
    const results = strategy.runBacktestAndGetResults({
      leverage,
      usdPerTrade,
      profitTargetPct,
      stopLossPct,
      minConfidence,
      rsiOverbought,
      rsiOversold,
    });

    return {
      success: true,
      params: {
        ltfTimeframe,
        leverage,
        usdPerTrade,
        profitTargetPct,
        stopLossPct,
        minConfidence,
        rsiOverbought,
        rsiOversold,
      },
      results,
    };
  }
}
