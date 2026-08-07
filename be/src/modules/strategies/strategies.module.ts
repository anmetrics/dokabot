import { Global, Module } from '@nestjs/common';
import { StrategiesController } from './strategies.controller';
import { StrategyRegistry } from './strategy-registry.service';

@Global()
@Module({
  controllers: [StrategiesController],
  providers: [StrategyRegistry],
  exports: [StrategyRegistry],
})
export class StrategiesModule {}
