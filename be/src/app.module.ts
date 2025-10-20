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

@Global()
@Module({
  imports: [
    SharedModule,
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    TelegramModule,
    BinanceModule,
    StrategyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
