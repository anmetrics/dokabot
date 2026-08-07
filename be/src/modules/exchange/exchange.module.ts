import { Global, Module } from '@nestjs/common';
import { BinanceAdapter } from './adapters/binance.adapter';
import { BybitAdapter } from './adapters/bybit.adapter';
import { ExchangeRegistry } from './exchange.registry';
import { RateLimiterService } from './rate-limiter.service';

@Global()
@Module({
  providers: [
    RateLimiterService,
    BinanceAdapter,
    BybitAdapter,
    ExchangeRegistry,
  ],
  exports: [ExchangeRegistry, RateLimiterService],
})
export class ExchangeModule {}
