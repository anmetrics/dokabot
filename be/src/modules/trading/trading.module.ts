import { Module } from '@nestjs/common';
import { ExchangeAccountsModule } from '../exchange-accounts/exchange-accounts.module';
import { BotsService } from './bots.service';
import { OrdersService } from './orders.service';
import { ReconcilerService } from './reconciler.service';
import { BotsController, OrdersController } from './trading.controller';

@Module({
  imports: [ExchangeAccountsModule],
  controllers: [BotsController, OrdersController],
  providers: [BotsService, OrdersService, ReconcilerService],
  exports: [BotsService, OrdersService, ReconcilerService],
})
export class TradingModule {}
