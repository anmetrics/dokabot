import { Injectable, Logger } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { IStrategy } from './strategy.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RsiReversalDcaStrategy } from './strategies/rsi-reversal.strategy';
import { MiniReversalDcaStrategy } from './strategies/mini-rsi-reversal.strategy';

@Injectable()
export class StrategyService {
  private logger = new Logger('StrategyService');
  private strategy1: IStrategy;
  private strategy2: IStrategy;
  private strategy3: IStrategy;
  private strategy4: IStrategy;
  private strategy5: IStrategy;

  constructor(
    private readonly binanceService: BinanceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  startStrategy(name: string) {
    this.strategy1 = new RsiReversalDcaStrategy(
      this.binanceService,
      'BTCUSDT',
      50,
      '5m',
      0.01,
    );
    this.strategy2 = new RsiReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      100,
      '3m',
      0.024,
    );

    this.strategy3 = new MiniReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      10,
      '1m',
      0.005,
      1300,
    );
    this.strategy4 = new MiniReversalDcaStrategy(
      this.binanceService,
      'BTCUSDT',
      10,
      '1m',
      0.005,
      118000,
    );

    this.strategy5 = new MiniReversalDcaStrategy(
      this.binanceService,
      'SOLUSDT',
      10,
      '1m',
      0.005,
      210,
    );

    this.strategy1.startAll();
    this.strategy2.startAll();
    this.strategy3.startAll();
    this.strategy4.startAll();
    this.strategy5.startAll();

    this.logger.log(`Started strategy: ${name}`);
  }
}
