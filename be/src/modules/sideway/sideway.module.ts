import { Module } from '@nestjs/common';
import { SidewayService } from './sideway.service';
import { SidewayStrategy } from './sideway.strategy';
import { SidewayController } from './sideway.controller';
import { BinanceModule } from '../binance/binance.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [BinanceModule, TelegramModule],
  controllers: [SidewayController],
  providers: [SidewayService, SidewayStrategy],
  exports: [SidewayService, SidewayStrategy],
})
export class SidewayModule {}
