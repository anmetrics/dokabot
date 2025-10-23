import { Injectable, Logger } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { IStrategy } from './strategy.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RsiReversalDcaStrategy } from './strategies/rsi-reversal.strategy';
import { MiniReversalDcaStrategy } from './strategies/mini-rsi-reversal.strategy';
import { SuperMiniReversalDcaStrategy } from './strategies/super-mini-rsi-reversal.strategy';
import { PrismaService } from 'src/prisma.service';
import { SETTING_KEY } from '../settings/settings.enum';

@Injectable()
export class StrategyService {
  private logger = new Logger('StrategyService');
  private strategy1: IStrategy;
  private strategy2: IStrategy;
  private strategy3: IStrategy;

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

  async startStrategy(name: string) {
    const bnbSetting = await this.getSettingByKey(SETTING_KEY.MAX_BNB_PRICE);
    const btcSetting = await this.getSettingByKey(SETTING_KEY.MAX_BTC_PRICE);
    const solSetting = await this.getSettingByKey(SETTING_KEY.MAX_SOL_PRICE);

    this.strategy1 = new RsiReversalDcaStrategy(
      this.binanceService,
      'BTCUSDT',
      90,
      '5m',
      0.02,
    );
    this.strategy2 = new RsiReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      120,
      '3m',
      0.03,
    );
    this.strategy3 = new RsiReversalDcaStrategy(
      this.binanceService,
      'SOLUSDT',
      10,
      '3m',
      0.026,
    );

    // Mini sclaping
    this.mini1 = new MiniReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      40,
      '3m',
      0.006,
      Number(bnbSetting?.value),
    );
    this.mini2 = new MiniReversalDcaStrategy(
      this.binanceService,
      'BTCUSDT',
      40,
      '3m',
      0.006,
      Number(btcSetting?.value),
    );

    this.mini3 = new MiniReversalDcaStrategy(
      this.binanceService,
      'SOLUSDT',
      40,
      '3m',
      0.008,
      Number(solSetting?.value),
    );

    // Supermini sclaping
    this.supermini1 = new SuperMiniReversalDcaStrategy(
      this.binanceService,
      'SOLUSDT',
      10,
      '1m',
      0.004,
      Number(solSetting?.value),
    );
    this.supermini2 = new SuperMiniReversalDcaStrategy(
      this.binanceService,
      'BTCUSDT',
      10,
      '1m',
      0.004,
      Number(btcSetting?.value),
    );
    this.supermini3 = new SuperMiniReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      10,
      '1m',
      0.004,
      Number(bnbSetting?.value),
    );

    // Normal
    this.strategy1.startAll();
    this.strategy2.startAll();
    this.strategy3.startAll();

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
