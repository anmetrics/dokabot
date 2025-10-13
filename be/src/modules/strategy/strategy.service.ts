import { Injectable, Logger } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { IStrategy } from './strategies/strategy.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RsiReversalDcaStrategy } from './strategies/rsi-reversal.strategy';

@Injectable()
export class StrategyService {
  private logger = new Logger('StrategyService');
  private strategy: IStrategy;

  constructor(
    private readonly binanceService: BinanceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async startStrategy(name: string) {
    const symbol = (process.env.SYMBOL || 'BTCUSDT').toUpperCase();

    if (name === 'ema-macd') {
      this.strategy = new RsiReversalDcaStrategy(this.binanceService, symbol);
    } else {
      throw new Error('Strategy not found');
    }

    await this.strategy.startAll();

    this.logger.log(`Started strategy: ${name}`);
  }

  stopStrategy() {
    if (this.strategy) {
      this.strategy.stop();
      this.logger.log('Stopped strategy');
    }
  }
}
