import { Module } from '@nestjs/common';
import { UserStrategyRegistry } from './user-strategy-registry.service';
import { UserStrategyController } from './user-strategy.controller';
import { BinanceModule } from '../binance/binance.module';
import { TelegramModule } from '../telegram/telegram.module';
import { PlatformCredentialModule } from '../platform-credential/platform-credential.module';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [
    BinanceModule,
    TelegramModule,
    PlatformCredentialModule,
    MarketDataModule,
  ],
  controllers: [UserStrategyController],
  providers: [UserStrategyRegistry],
  exports: [UserStrategyRegistry],
})
export class UserStrategyModule {}
