import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { BinanceModule } from '../binance/binance.module';

@Module({
  imports: [BinanceModule],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
