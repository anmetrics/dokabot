import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma.service';

/**
 * Liveness and readiness, split on purpose.
 *
 * A load balancer that restarts a pod because the *database* is down turns one
 * outage into two. Liveness answers "is this process wedged", readiness answers
 * "can it serve traffic right now".
 */
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  live() {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  @Get('ready')
  async ready() {
    const checks: Record<string, 'ok' | 'fail'> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'fail';
    }

    // Surfaced so an operator can see the kill switch is on without reading env.
    const tradingEnabled =
      this.config.get<string>('TRADING_KILL_SWITCH') !== 'true';

    if (Object.values(checks).includes('fail')) {
      throw new ServiceUnavailableException({ status: 'degraded', checks });
    }

    return { status: 'ok', checks, tradingEnabled };
  }
}
