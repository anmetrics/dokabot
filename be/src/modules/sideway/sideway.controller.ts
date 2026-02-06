import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SidewayService } from './sideway.service';
import { SidewayStrategy } from './sideway.strategy';
import { AuthenticationGuard } from '../authentication/guards/authentication.guard';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';

@Controller('sideway')
@UseGuards(AuthenticationGuard)
export class SidewayController {
  constructor(
    private readonly sidewayService: SidewayService,
    private readonly sidewayStrategy: SidewayStrategy,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.sidewayService.findAll();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: string) {
    return this.sidewayService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateScenarioDto) {
    return this.sidewayService.create(dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(@Param('id') id: string, @Body() dto: UpdateScenarioDto) {
    return this.sidewayService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.sidewayService.remove(id);
  }

  @Post(':id/toggle')
  @HttpCode(HttpStatus.OK)
  async toggle(@Param('id') id: string) {
    const result = await this.sidewayService.toggle(id);
    // Refresh subscriptions after toggle
    await this.sidewayStrategy.refreshSubscriptions();
    return result;
  }

  @Post(':id/reset')
  @HttpCode(HttpStatus.OK)
  async reset(@Param('id') id: string) {
    const result = await this.sidewayService.resetScenario(id);
    await this.sidewayStrategy.refreshSubscriptions();
    return result;
  }
}
