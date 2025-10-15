import { Injectable, Logger } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { IStrategy } from './strategy.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RsiReversalDcaStrategy } from './strategies/rsi-reversal.strategy';

@Injectable()
export class StrategyService {
  private logger = new Logger('StrategyService');
  private strategy1: IStrategy;
  private strategy2: IStrategy;

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
    );
    this.strategy2 = new RsiReversalDcaStrategy(
      this.binanceService,
      'BNBUSDT',
      100,
      '3m',
    );

    this.strategy1.startAll();
    this.strategy2.startAll();

    this.logger.log(`Started strategy: ${name}`);
  }
}
