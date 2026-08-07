import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { THROTTLE } from './common/throttle.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BinanceModule } from './modules/binance/binance.module';
import { StrategyModule } from './modules/strategy/strategy.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from './modules/telegram/telegram.module';
import { SharedModule } from './modules/shared/shared.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { SidewayModule } from './modules/sideway/sideway.module';
import { SecurityModule } from './modules/security/security.module';
import { AuditModule } from './modules/audit/audit.module';
import { ExchangeModule } from './modules/exchange/exchange.module';
import { ExchangeAccountsModule } from './modules/exchange-accounts/exchange-accounts.module';
import { TradingModule } from './modules/trading/trading.module';
import { StrategiesModule } from './modules/strategies/strategies.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedModule,
    HealthModule,
    SecurityModule,
    AuditModule,
    ExchangeModule,
    StrategiesModule,
    // Baseline abuse protection. Per-tenant quotas move to the API gateway in Phase 4.
    ThrottlerModule.forRoot([{ name: 'default', ...THROTTLE.default }]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    AuthenticationModule,
    ExchangeAccountsModule,
    TradingModule,
    TelegramModule,
    BinanceModule,
    StrategyModule,
    SidewayModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
