import { Module } from '@nestjs/common';
import { TradingModule } from '../trading/trading.module';
import { AutoInvestController } from './auto-invest.controller';
import { AutoInvestService } from './auto-invest.service';

@Module({
  imports: [TradingModule],
  controllers: [AutoInvestController],
  providers: [AutoInvestService],
})
export class AutoInvestModule {}
