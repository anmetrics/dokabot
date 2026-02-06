import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { BinanceService } from '../binance/binance.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';

@Injectable()
export class SidewayService {
  private logger = new Logger('SidewayService');

  constructor(
    private readonly prismaService: PrismaService,
    private readonly binanceService: BinanceService,
  ) {}

  async create(dto: CreateScenarioDto) {
    if (!dto.steps || dto.steps.length < 2) {
      throw new BadRequestException('Cần ít nhất 2 bước trong kịch bản');
    }

    return this.prismaService.sidewayScenario.create({
      data: {
        name: dto.name,
        symbol: dto.symbol,
        qty: dto.qty,
        steps: dto.steps as any,
        isLoop: dto.isLoop,
        enabled: false,
        status: 'idle',
        currentStepIndex: 0,
      },
    });
  }

  async findAll() {
    const scenarios = await this.prismaService.sidewayScenario.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Get current prices for all unique symbols
    const symbols = [...new Set(scenarios.map((s) => s.symbol))];
    let priceMap: Record<string, number> = {};
    if (symbols.length > 0) {
      priceMap = await this.binanceService.getPrices(symbols);
    }

    return scenarios.map((s) => ({
      ...s,
      currentPrice: priceMap[s.symbol] ?? 0,
    }));
  }

  async findOne(id: string) {
    const scenario = await this.prismaService.sidewayScenario.findFirst({
      where: { id },
    });
    if (!scenario) {
      throw new BadRequestException('Kịch bản không tồn tại');
    }
    return scenario;
  }

  async update(id: string, dto: UpdateScenarioDto) {
    const scenario = await this.findOne(id);
    if (scenario.enabled) {
      throw new BadRequestException(
        'Không thể sửa kịch bản đang chạy. Hãy tắt trước.',
      );
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.symbol !== undefined) data.symbol = dto.symbol;
    if (dto.qty !== undefined) data.qty = dto.qty;
    if (dto.steps !== undefined) {
      if (dto.steps.length < 2) {
        throw new BadRequestException('Cần ít nhất 2 bước trong kịch bản');
      }
      data.steps = dto.steps;
      data.currentStepIndex = 0;
    }
    if (dto.isLoop !== undefined) data.isLoop = dto.isLoop;

    return this.prismaService.sidewayScenario.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    const scenario = await this.findOne(id);
    if (scenario.enabled) {
      throw new BadRequestException(
        'Không thể xoá kịch bản đang chạy. Hãy tắt trước.',
      );
    }
    return this.prismaService.sidewayScenario.delete({
      where: { id },
    });
  }

  async toggle(id: string) {
    const scenario = await this.findOne(id);
    const newEnabled = !scenario.enabled;

    const data: any = { enabled: newEnabled };
    if (newEnabled) {
      data.status = 'running';
    } else {
      data.status = 'idle';
    }

    return this.prismaService.sidewayScenario.update({
      where: { id },
      data,
    });
  }

  async resetScenario(id: string) {
    return this.prismaService.sidewayScenario.update({
      where: { id },
      data: {
        currentStepIndex: 0,
        status: 'idle',
        enabled: false,
      },
    });
  }

  async getActiveScenarios() {
    return this.prismaService.sidewayScenario.findMany({
      where: { enabled: true },
    });
  }

  async advanceStep(id: string, nextIndex: number) {
    return this.prismaService.sidewayScenario.update({
      where: { id },
      data: {
        currentStepIndex: nextIndex,
        lastExecutedAt: new Date(),
      },
    });
  }

  async completeScenario(id: string) {
    return this.prismaService.sidewayScenario.update({
      where: { id },
      data: {
        status: 'completed',
        enabled: false,
        lastExecutedAt: new Date(),
      },
    });
  }

  async setError(id: string, error: string) {
    this.logger.error(`Scenario ${id} error: ${error}`);
    return this.prismaService.sidewayScenario.update({
      where: { id },
      data: {
        status: 'error',
        enabled: false,
      },
    });
  }
}
