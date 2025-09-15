import { Module } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { BinanceModule } from '../binance/binance.module';

@Module({
  imports: [BinanceModule],
  providers: [StrategyService],
  exports: [StrategyService],
})
export class StrategyModule {}
