import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { AuthenticationGuard } from '../authentication/guards/authentication.guard';
import { StrategyRegistry } from './strategy-registry.service';

@Controller('strategies')
@UseGuards(AuthenticationGuard)
export class StrategiesController {
  constructor(private readonly registry: StrategyRegistry) {}

  /** Drives the strategy picker and the dynamic settings form in the UI. */
  @Get()
  list() {
    return this.registry.catalog();
  }

  @Get(':key')
  detail(@Param('key') key: string) {
    if (!this.registry.has(key)) {
      throw new NotFoundException(`Unknown strategy "${key}"`);
    }
    const { evaluate, ...definition } = this.registry.get(key);
    return definition;
  }
}
