import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { StrategyService } from './modules/strategy/strategy.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  const strategyService = app.get(StrategyService);
  const strategy = process.env.STRATEGY || 'ema-macd';

  await app.listen(3000);
  strategyService.startStrategy(strategy);
}
bootstrap();
