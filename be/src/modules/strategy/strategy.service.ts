import { Injectable, Logger } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { IStrategy } from './strategy.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma.service';
import { SETTING_KEY } from '../settings/settings.enum';
import { FuturesEmaStrategy } from './strategies/futures/future.strategy';
import { MiniReversalDcaStrategy } from './strategies/mini/mini_reversal_dca.strategy';
import { GoldReversalDcaStrategy } from './strategies/gold/gold-rsi-reversal.strategy';

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
    // Mini sclaping
    this.mini1 = new MiniReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      '5m',
      0.005,
    );
    this.mini2 = new MiniReversalDcaStrategy(
      this.binanceService,
      'BTCUSDT',
      '5m',
      0.005,
    );

    this.mini3 = new MiniReversalDcaStrategy(
      this.binanceService,
      'SOLUSDT',
      '5m',
      0.005,
    );

    // Supermini sclaping
    this.supermini1 = new MiniReversalDcaStrategy(
      this.binanceService,
      'SOLUSDT',
      '3m',
      0.005,
    );
    this.supermini2 = new MiniReversalDcaStrategy(
      this.binanceService,
      'BTCUSDT',
      '3m',
      0.005,
    );
    this.supermini3 = new MiniReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      '3m',
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
    this.supermini1.startAll();
    this.supermini2.startAll();
    this.supermini3.startAll();

    // Gold
    this.goldStrategy1.startAll();

    this.logger.log(`Started strategy: ${name}`);
  }
}
