import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { StrategyService } from './modules/strategy/strategy.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const strategyService = app.get(StrategyService);
  const strategy = process.env.STRATEGY || 'ema-macd';

  await app.listen(process.env.PORT ?? 3333);
  strategyService.startStrategy(strategy);
}
bootstrap();
