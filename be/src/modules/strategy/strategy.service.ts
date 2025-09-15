import { Injectable, Logger } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { EmaMacdStrategy } from './strategies/ema-macd.strategy';
import { EmaRsiStrategy } from './strategies/ema-rsi.strategy';
import { IStrategy } from './strategies/strategy.interface';

@Injectable()
export class StrategyService {
  private logger = new Logger('StrategyService');
  private strategy: IStrategy;

  constructor(private readonly binanceService: BinanceService) {}

  async startStrategy(name: string) {
    const symbol = (process.env.SYMBOL || 'BTCUSDT').toUpperCase();
    const tradeUsd = Number(process.env.TRADE_QUANTITY_USD || '50');

    if (name === 'ema-macd') {
      this.strategy = new EmaMacdStrategy(
        this.binanceService,
        symbol,
        tradeUsd,
      );
    } else if (name === 'ema-rsi') {
      this.strategy = new EmaRsiStrategy(this.binanceService, symbol, tradeUsd);
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
