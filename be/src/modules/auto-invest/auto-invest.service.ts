import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { BotStatus, ExchangeAccountStatus, OrderState } from 'generated/prisma';
import { PrismaService } from 'src/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StrategyRegistry } from '../strategies/strategy-registry.service';
import { BotsService } from '../trading/bots.service';
import { computePosition } from '../trading/position';
import { RequestContext } from '../authentication/interfaces/authentication.interface';
import { EnableAutoInvestDto } from './dto/auto-invest.dto';
import { PRESET_LIST, PRESETS, RiskProfile } from './presets';

/** Marks the bots this feature owns, so it never touches a hand-made bot. */
const MANAGED_PREFIX = 'auto:';

export type AutoInvestStatus = {
  enabled: boolean;
  profile: RiskProfile | null;
  budgetUsd: string;
  isPaper: boolean;
  botCount: number;
  runningCount: number;
  realisedPnl: string;
  bots: {
    id: string;
    symbol: string;
    strategyKey: string;
    timeframe: string;
    status: BotStatus;
    allocationUsd: string;
    lastError: string | null;
  }[];
};

/**
 * One switch that runs a diversified portfolio of bots on the user's behalf.
 *
 * Every bot it creates is tagged in `config.__auto`, so enabling, disabling and
 * reporting only ever act on bots this feature owns. A user's hand-built bots are
 * invisible to it.
 */
@Injectable()
export class AutoInvestService {
  private readonly logger = new Logger(AutoInvestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bots: BotsService,
    private readonly strategies: StrategyRegistry,
    private readonly audit: AuditService,
  ) {}

  presets() {
    return PRESET_LIST;
  }

  async status(userId: string): Promise<AutoInvestStatus> {
    const managed = await this.managedBots(userId);

    const orders = managed.length
      ? await this.prisma.order.findMany({
          where: {
            botId: { in: managed.map((b) => b.id) },
            state: { in: [OrderState.FILLED, OrderState.PARTIALLY_FILLED] },
          },
          select: { side: true, filledQuantity: true, averagePrice: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const first = managed[0]?.config as Record<string, any> | undefined;

    return {
      enabled: managed.some((b) => b.status === BotStatus.RUNNING),
      profile: (first?.__auto?.profile as RiskProfile) ?? null,
      budgetUsd: String(first?.__auto?.budgetUsd ?? 0),
      isPaper: managed[0]?.isPaper ?? true,
      botCount: managed.length,
      runningCount: managed.filter((b) => b.status === BotStatus.RUNNING).length,
      realisedPnl: computePosition(orders).realisedPnl.toFixed(2),
      bots: managed.map((bot) => ({
        id: bot.id,
        symbol: bot.symbol,
        strategyKey: bot.strategyKey,
        timeframe: bot.timeframe,
        status: bot.status,
        allocationUsd: String(
          (bot.config as Record<string, any>).orderSizeUsd ?? 0,
        ),
        lastError: bot.lastError,
      })),
    };
  }

  async enable(
    userId: string,
    dto: EnableAutoInvestDto,
    context: RequestContext,
  ): Promise<AutoInvestStatus> {
    const account = await this.prisma.exchangeAccount.findFirst({
      where: { id: dto.exchangeAccountId, userId },
    });
    if (!account) throw new NotFoundException('Exchange account not found');
    if (account.status !== ExchangeAccountStatus.ACTIVE) {
      throw new BadRequestException(
        'API key chưa hoạt động. Hãy kiểm tra lại key trước khi bật đầu tư tự động.',
      );
    }

    const preset = PRESETS[dto.profile];
    const isPaper = dto.isPaper ?? true;
    const budget = new Decimal(dto.budgetUsd);

    // Rebuild from scratch: switching profile must not leave bots from the old one
    // running against a budget that no longer exists.
    await this.removeManaged(userId);

    for (const leg of preset.legs) {
      const allocation = budget.times(leg.weight);

      const config = this.strategies.validateConfig(leg.strategyKey, {
        ...leg.config,
        // Each leg trades a fixed slice per order, so one leg cannot consume the
        // whole budget however often it fires.
        orderSizeUsd: allocation.div(4).toDecimalPlaces(2).toNumber(),
      });

      const bot = await this.bots.create(
        userId,
        {
          exchangeAccountId: dto.exchangeAccountId,
          strategyKey: leg.strategyKey,
          symbol: leg.symbol,
          timeframe: leg.timeframe,
          config,
          isPaper,
          maxLossUsd: allocation
            .times(preset.maxDrawdownPercent)
            .div(100)
            .toDecimalPlaces(2)
            .toString(),
        },
        context,
      );

      // The tag lives in config so no schema change is needed and it survives any
      // future move to a different persistence layer.
      await this.prisma.bot.update({
        where: { id: bot.id },
        data: {
          config: {
            ...config,
            __auto: {
              profile: dto.profile,
              budgetUsd: dto.budgetUsd,
              weight: leg.weight,
            },
          } as object,
          status: BotStatus.RUNNING,
        },
      });
    }

    this.audit.record({
      userId,
      action: 'auto_invest.enable',
      metadata: {
        profile: dto.profile,
        budgetUsd: dto.budgetUsd,
        isPaper,
        legs: preset.legs.length,
      },
      ...context,
    });

    this.logger.log(
      `Auto-invest enabled for ${userId}: ${dto.profile}, ${preset.legs.length} bots, paper=${isPaper}`,
    );

    return this.status(userId);
  }

  /**
   * Stops the portfolio without deleting it.
   *
   * Open positions are deliberately left alone — force-selling on a pause would
   * realise losses the user did not ask to take. They stay visible under Orders.
   */
  async disable(
    userId: string,
    context: RequestContext,
  ): Promise<AutoInvestStatus> {
    const managed = await this.managedBots(userId);
    if (!managed.length) {
      throw new BadRequestException('Đầu tư tự động chưa được bật');
    }

    await this.prisma.bot.updateMany({
      where: { id: { in: managed.map((b) => b.id) } },
      data: { status: BotStatus.STOPPED },
    });

    this.audit.record({
      userId,
      action: 'auto_invest.disable',
      metadata: { bots: managed.length },
      ...context,
    });

    return this.status(userId);
  }

  private async managedBots(userId: string) {
    const bots = await this.prisma.bot.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return bots.filter(
      (bot) => (bot.config as Record<string, any>)?.__auto !== undefined,
    );
  }

  private async removeManaged(userId: string): Promise<void> {
    const managed = await this.managedBots(userId);
    if (!managed.length) return;

    const ids = managed.map((b) => b.id);
    // Orders survive their bot (`botId` is SET NULL), so history is never lost.
    await this.prisma.bot.deleteMany({ where: { id: { in: ids } } });
  }
}
