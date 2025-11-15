import { Module } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service';
import { MempoolListener } from './listeners/mempool.listener';

@Module({
  providers: [ArbitrageService, MempoolListener],
  exports: [ArbitrageService],
})
export class ArbitrageModule {}
