import { Module } from '@nestjs/common';
import { BinanceService } from './binance.service';
import { OrderBookListener } from './listeners/orderbook.listener';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  providers: [BinanceService, OrderBookListener],
  exports: [BinanceService],
})
export class BinanceModule {}
