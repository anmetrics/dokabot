import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { THROTTLE } from './common/throttle.config';
import { SharedModule } from './modules/shared/shared.module';
import { SecurityModule } from './modules/security/security.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { ExchangeModule } from './modules/exchange/exchange.module';
import { StrategiesModule } from './modules/strategies/strategies.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { ExchangeAccountsModule } from './modules/exchange-accounts/exchange-accounts.module';
import { TradingModule } from './modules/trading/trading.module';
import { AutoInvestModule } from './modules/auto-invest/auto-invest.module';
import { SettingsModule } from './modules/settings/settings.module';
import { BillingModule } from './modules/billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedModule,
    SecurityModule,
    AuditModule,
    HealthModule,
    ExchangeModule,
    StrategiesModule,
    // Baseline abuse protection. Per-tenant quotas move to the API gateway in Phase 4.
    ThrottlerModule.forRoot([{ name: 'default', ...THROTTLE.default }]),
    ScheduleModule.forRoot(),
    AuthenticationModule,
    SettingsModule,
    BillingModule,
    ExchangeAccountsModule,
    TradingModule,
    AutoInvestModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
