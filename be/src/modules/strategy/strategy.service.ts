import { Injectable, Logger } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { IStrategy } from './strategy.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RsiReversalDcaStrategy } from './strategies/rsi-reversal.strategy';
import { MiniReversalDcaStrategy } from './strategies/mini-rsi-reversal.strategy';
import { SuperMiniReversalDcaStrategy } from './strategies/super-mini-rsi-reversal.strategy';

@Injectable()
export class StrategyService {
  private logger = new Logger('StrategyService');
  private strategy1: IStrategy;
  private strategy2: IStrategy;
  private strategy3: IStrategy;
  private strategy4: IStrategy;
  private strategy5: IStrategy;
  private strategy6: IStrategy;

  private supermini1: IStrategy;
  private supermini2: IStrategy;
  private supermini3: IStrategy;

  constructor(
    private readonly binanceService: BinanceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  startStrategy(name: string) {
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
    this.strategy6 = new RsiReversalDcaStrategy(
      this.binanceService,
      'SOLUSDT',
      20,
      '3m',
      0.03,
    );

    // Mini sclaping

    this.strategy3 = new MiniReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      50,
      '1m',
      0.006,
      1252,
    );
    this.strategy4 = new MiniReversalDcaStrategy(
      this.binanceService,
      'BTCUSDT',
      50,
      '1m',
      0.006,
      114000,
    );

    this.strategy5 = new MiniReversalDcaStrategy(
      this.binanceService,
      'SOLUSDT',
      50,
      '1m',
      0.008,
      189,
    );

    this.supermini1 = new SuperMiniReversalDcaStrategy(
      this.binanceService,
      'SOLUSDT',
      10,
      '1m',
      0.004,
      190,
    );
    this.supermini2 = new SuperMiniReversalDcaStrategy(
      this.binanceService,
      'BTCUSDT',
      10,
      '1m',
      0.004,
      110500,
    );
    this.supermini3 = new SuperMiniReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      10,
      '1m',
      0.004,
      1100,
    );

    // Normal
    this.strategy1.startAll();
    this.strategy2.startAll();
    this.strategy3.startAll();

    // Mini
    this.strategy4.startAll();
    this.strategy5.startAll();
    this.strategy6.startAll();

    // Supermini
    this.supermini1.startAll();
    this.supermini2.startAll();
    this.supermini3.startAll();

    this.logger.log(`Started strategy: ${name}`);
  }
}
