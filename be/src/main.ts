import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.validation';
import { StrategyService } from './modules/strategy/strategy.service';
import { SidewayStrategy } from './modules/sideway/sideway.strategy';

async function bootstrap() {
  // Refuse to start on a bad configuration rather than silently defaulting.
  const env = validateEnv();
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  logger.log(`API listening on :${env.PORT} (${env.NODE_ENV})`);

  // The in-process strategy runners are the single-tenant legacy path and only run
  // when explicitly enabled. Phase 3 moves them into dedicated strategy workers —
  // see docs/ARCHITECTURE.md §2.3.
  if (process.env.RUN_LEGACY_STRATEGIES === 'true') {
    logger.warn(
      'RUN_LEGACY_STRATEGIES=true — single-tenant strategy runners started in the API process',
    );
    app.get(StrategyService).startStrategy(process.env.STRATEGY || 'ema-macd');
    app.get(SidewayStrategy).start();
  }
}

void bootstrap();
