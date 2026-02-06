import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { StrategyService } from './modules/strategy/strategy.service';
import { SidewayStrategy } from './modules/sideway/sideway.strategy';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  const strategyService = app.get(StrategyService);
  const strategy = process.env.STRATEGY || 'ema-macd';

  const sidewayStrategy = app.get(SidewayStrategy);

  await app.listen(3000);
  strategyService.startStrategy(strategy);
  sidewayStrategy.start();
}
bootstrap();
