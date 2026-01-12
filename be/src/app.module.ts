import { Global, Module } from '@nestjs/common';
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
import { UserModule } from './modules/user/user.module';
import { PlatformCredentialModule } from './modules/platform-credential/platform-credential.module';
import { UserStrategyModule } from './modules/user-strategy/user-strategy.module';

@Global()
@Module({
  imports: [
    SharedModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    AuthenticationModule,
    UserModule,
    PlatformCredentialModule,
    TelegramModule,
    BinanceModule,
    StrategyModule,
    UserStrategyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
