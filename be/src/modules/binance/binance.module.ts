import { Module } from '@nestjs/common';
import { BinanceService } from './binance.service';
import { OrderBookListener } from './listeners/orderbook.listener';
import { TelegramModule } from '../telegram/telegram.module';
import { BinanceController } from './binance.controller';
import { PlatformCredentialModule } from '../platform-credential/platform-credential.module';
import { RateLimiterService } from './rate-limiter.service';

@Module({
  imports: [TelegramModule, PlatformCredentialModule],
  controllers: [BinanceController],
  providers: [BinanceService, OrderBookListener, RateLimiterService],
  exports: [BinanceService, RateLimiterService],
})
export class BinanceModule {}
