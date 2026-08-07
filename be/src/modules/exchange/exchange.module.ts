import { Global, Module } from '@nestjs/common';
import { BinanceAdapter } from './adapters/binance.adapter';
import { BybitAdapter } from './adapters/bybit.adapter';
import { ExchangeRegistry } from './exchange.registry';
import { PlatformNetworkService } from './platform-network.service';
import { RateLimiterService } from './rate-limiter.service';

@Global()
@Module({
  providers: [
    RateLimiterService,
    BinanceAdapter,
    BybitAdapter,
    ExchangeRegistry,
    PlatformNetworkService,
  ],
  exports: [ExchangeRegistry, RateLimiterService, PlatformNetworkService],
})
export class ExchangeModule {}
