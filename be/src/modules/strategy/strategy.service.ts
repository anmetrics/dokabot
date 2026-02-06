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
import {
  VolumeProfileAnalyzer,
  VolumeResistanceAnalysis,
} from './helpers/volume-profile';

@Injectable()
export class StrategyService {
  private logger = new Logger('StrategyService');
  private volumeAnalyzer = new VolumeProfileAnalyzer();

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
  // VOLUME RESISTANCE ANALYSIS API
  // ============================================================================

  async getVolumeResistanceAnalysis(): Promise<VolumeResistanceAnalysis[]> {
    const symbols = ['BNBUSDT', 'BTCUSDT', 'SOLUSDT'];
    const results: VolumeResistanceAnalysis[] = [];

    for (const symbol of symbols) {
      const candles = await this.binanceService.getHistoricalCandles(
        symbol,
        '1h',
        500,
      );
      if (!candles.length) continue;
      const currentPrice = +candles[candles.length - 1].close;
      results.push(
        this.volumeAnalyzer.analyze(candles, currentPrice, symbol, '1h'),
      );
    }

    return results;
  }

  async getVolumeResistanceBySymbol(
    symbol: string,
    timeframe: '1h' | '4h' = '1h',
  ): Promise<VolumeResistanceAnalysis | null> {
    const candles = await this.binanceService.getHistoricalCandles(
      symbol,
      timeframe,
      500,
    );
    if (!candles.length) return null;
    const currentPrice = +candles[candles.length - 1].close;
    return this.volumeAnalyzer.analyze(
      candles,
      currentPrice,
      symbol,
      timeframe,
    );
  }
}
