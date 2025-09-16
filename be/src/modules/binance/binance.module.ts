import { Module } from '@nestjs/common';
import { BinanceService } from './binance.service';
import { OrderBookListener } from './listeners/orderbook.listener';

@Module({
  imports: [],
  providers: [BinanceService, OrderBookListener],
  exports: [BinanceService],
})
export class BinanceModule {}
