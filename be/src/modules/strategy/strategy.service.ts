import { Injectable, Logger } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { EmaMacdStrategy } from './strategies/ema-macd.strategy';
import { IStrategy } from './strategies/strategy.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
    const tradeUsd = Number(process.env.TRADE_QUANTITY_USD || '50');

    if (name === 'ema-macd') {
      this.strategy = new EmaMacdStrategy(
        this.binanceService,
        symbol,
        tradeUsd,
        (event) => {
          this.eventEmitter.emit('trade.executed', event);
        },
      );
    } else {
      throw new Error('Strategy not found');
    }

    await this.strategy.start();
    this.logger.log(`Started strategy: ${name}`);
  }

  stopStrategy() {
    if (this.strategy) {
      this.strategy.stop();
      this.logger.log('Stopped strategy');
    }
  }
}
