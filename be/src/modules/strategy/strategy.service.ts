import { Injectable, Logger } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { IStrategy } from './strategy.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RsiReversalDcaStrategy } from './strategies/rsi-reversal.strategy';
import { MiniReversalDcaStrategy } from './strategies/mini-rsi-reversal.strategy';
import { SuperMiniReversalDcaStrategy } from './strategies/super-mini-rsi-reversal.strategy';
import { PrismaService } from 'src/prisma.service';
import { SETTING_KEY } from '../settings/settings.enum';
import { ChildRsiReversalDcaStrategy } from './strategies/child-rsi-reversal.strategy';

@Injectable()
export class StrategyService {
  private logger = new Logger('StrategyService');
  private strategy1: IStrategy;
  private strategy2: IStrategy;
  private strategy3: IStrategy;

  private childStrategy1: IStrategy;
  private childStrategy2: IStrategy;
  private childStrategy3: IStrategy;

  private mini1: IStrategy;
  private mini2: IStrategy;
  private mini3: IStrategy;

  private supermini1: IStrategy;
  private supermini2: IStrategy;
  private supermini3: IStrategy;

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
    //  Strategy
    this.strategy1 = new RsiReversalDcaStrategy(
      this.binanceService,
      'BTCUSDT',
      50,
      '5m',
      0.02,
    );
    this.strategy2 = new RsiReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      50,
      '5m',
      0.03,
    );
    this.strategy3 = new RsiReversalDcaStrategy(
      this.binanceService,
      'SOLUSDT',
      20,
      '5m',
      0.02,
    );

    // Child strategy
    this.childStrategy1 = new ChildRsiReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      100,
      '5m',
      0.004,
    );
    this.childStrategy2 = new ChildRsiReversalDcaStrategy(
      this.binanceService,
      'BTCUSDT',
      100,
      '5m',
      0.004,
    );
    this.childStrategy3 = new ChildRsiReversalDcaStrategy(
      this.binanceService,
      'SOLUSDT',
      50,
      '5m',
      0.004,
    );

    // Super

    // Mini sclaping
    this.mini1 = new MiniReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      '3m',
      0.005,
    );
    this.mini2 = new MiniReversalDcaStrategy(
      this.binanceService,
      'BTCUSDT',
      '3m',
      0.005,
    );

    this.mini3 = new MiniReversalDcaStrategy(
      this.binanceService,
      'SOLUSDT',
      '3m',
      0.005,
    );

    // Supermini sclaping
    this.supermini1 = new SuperMiniReversalDcaStrategy(
      this.binanceService,
      'SOLUSDT',
      '1m',
      0.005,
    );
    this.supermini2 = new SuperMiniReversalDcaStrategy(
      this.binanceService,
      'BTCUSDT',
      '1m',
      0.005,
    );
    this.supermini3 = new SuperMiniReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      '1m',
      0.005,
    );

    // Normal
    this.strategy1.startAll();
    this.strategy2.startAll();
    this.strategy3.startAll();

    // Child strategy
    this.childStrategy1.startAll();
    this.childStrategy2.startAll();
    this.childStrategy3.startAll();

    // Mini
    this.mini1.startAll();
    this.mini2.startAll();
    this.mini3.startAll();

    // Supermini
    this.supermini1.startAll();
    this.supermini2.startAll();
    this.supermini3.startAll();

    this.logger.log(`Started strategy: ${name}`);
  }
}
