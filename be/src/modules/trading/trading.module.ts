import { Module } from '@nestjs/common';
import { ExchangeAccountsModule } from '../exchange-accounts/exchange-accounts.module';
import { BotsService } from './bots.service';
import { OrdersService } from './orders.service';
import { ReconcilerService } from './reconciler.service';
import { StrategyRunnerService } from './strategy-runner.service';
import { BotsController, OrdersController } from './trading.controller';

@Module({
  imports: [ExchangeAccountsModule],
  controllers: [BotsController, OrdersController],
  providers: [
    BotsService,
    OrdersService,
    ReconcilerService,
    StrategyRunnerService,
  ],
  exports: [
    BotsService,
    OrdersService,
    ReconcilerService,
    StrategyRunnerService,
  ],
})
export class TradingModule {}
