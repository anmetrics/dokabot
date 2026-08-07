import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { AuthenticationGuard } from '../authentication/guards/authentication.guard';
import { StrategyRegistry } from './strategy-registry.service';
import { INDICATORS } from './library/rules';

@Controller('strategies')
@UseGuards(AuthenticationGuard)
export class StrategiesController {
  constructor(private readonly registry: StrategyRegistry) {}

  /** Drives the strategy picker and the dynamic settings form in the UI. */
  @Get()
  list() {
    return this.registry.catalog();
  }

  /**
   * Everything the rule builder needs: which indicators exist, what each one
   * outputs, and which parameters it takes.
   */
  @Get('indicators')
  indicators() {
    return {
      indicators: INDICATORS,
      operators: [
        { value: 'gt', label: 'lớn hơn' },
        { value: 'gte', label: 'lớn hơn hoặc bằng' },
        { value: 'lt', label: 'nhỏ hơn' },
        { value: 'lte', label: 'nhỏ hơn hoặc bằng' },
        { value: 'crossesAbove', label: 'cắt lên trên' },
        { value: 'crossesBelow', label: 'cắt xuống dưới' },
        { value: 'between', label: 'nằm trong khoảng' },
        { value: 'outside', label: 'nằm ngoài khoảng' },
      ],
    };
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
