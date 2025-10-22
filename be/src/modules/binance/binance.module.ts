import { Module } from '@nestjs/common';
import { BinanceService } from './binance.service';
import { OrderBookListener } from './listeners/orderbook.listener';
import { TelegramModule } from '../telegram/telegram.module';
import { BinanceController } from './binance.controller';

@Module({
  imports: [TelegramModule],
  controllers: [BinanceController],
  providers: [BinanceService, OrderBookListener],
  exports: [BinanceService],
})
export class BinanceModule {}
