import { Module } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { StrategyController } from './strategy.controller';
import { BinanceModule } from '../binance/binance.module';
import { TradeListener } from './listeners/trade.listener';

@Module({
  imports: [BinanceModule],
  controllers: [StrategyController],
  providers: [StrategyService, TradeListener],
  exports: [StrategyService],
})
export class StrategyModule {}
