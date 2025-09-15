import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BinanceModule } from './modules/binance/binance.module';
import { StrategyModule } from './modules/strategy/strategy.module';

@Module({
  imports: [BinanceModule, StrategyModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
