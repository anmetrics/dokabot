import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
  BotStatus,
  ExchangeAccountStatus,
  OrderState,
} from 'generated/prisma';
import { PrismaService } from 'src/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExchangeRegistry } from '../exchange/exchange.registry';
import { StrategyRegistry } from '../strategies/strategy-registry.service';
import { RequestContext } from '../authentication/interfaces/authentication.interface';
import { CreateBotDto, UpdateBotDto } from './dto/bot.dto';

/**
 * Number of strategy-worker shards. A bot is pinned to `hash(id) % SHARD_COUNT`
 * so any worker can decide, without coordination, whether a bot is its business.
 */
const SHARD_COUNT = Number(process.env.STRATEGY_SHARD_COUNT ?? 16);

const MAX_BOTS_PER_USER = 50;

@Injectable()
export class BotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ExchangeRegistry,
    private readonly strategies: StrategyRegistry,
    private readonly audit: AuditService,
  ) {}

  list(userId: string) {
    return this.prisma.bot.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateBotDto, context: RequestContext) {
    const count = await this.prisma.bot.count({ where: { userId } });
    if (count >= MAX_BOTS_PER_USER) {
      throw new BadRequestException(
        `You can run at most ${MAX_BOTS_PER_USER} bots`,
      );
    }

    const account = await this.prisma.exchangeAccount.findFirst({
      where: { id: dto.exchangeAccountId, userId },
    });
    if (!account) throw new NotFoundException('Exchange account not found');
    if (account.status !== ExchangeAccountStatus.ACTIVE) {
      throw new BadRequestException(
        'That exchange account is not active. Verify the API key first.',
      );
    }

    // Fail here rather than on the first candle: an unsupported symbol or an
    // out-of-range setting is a configuration mistake, not a runtime condition.
    await this.registry.get(account.exchange).fetchSymbolInfo(dto.symbol);
    const config = this.strategies.validateConfig(dto.strategyKey, dto.config);

    const id = crypto.randomUUID();
    const bot = await this.prisma.bot.create({
      data: {
        id,
        userId,
        exchangeAccountId: dto.exchangeAccountId,
        strategyKey: dto.strategyKey,
        symbol: dto.symbol,
        timeframe: dto.timeframe,
        config: config as object,
        // Real money is opt-in, never the default.
        isPaper: dto.isPaper ?? true,
        maxLossUsd: dto.maxLossUsd ?? null,
        shardId: this.shardFor(id),
        status: BotStatus.DRAFT,
      },
    });

    this.audit.record({
      userId,
      action: 'bot.create',
      resourceType: 'bot',
      resourceId: bot.id,
      metadata: { symbol: bot.symbol, isPaper: bot.isPaper },
      ...context,
    });

    return bot;
  }

  async update(userId: string, id: string, dto: UpdateBotDto) {
    const bot = await this.mustOwn(userId, id);
    if (bot.status === BotStatus.RUNNING) {
      throw new BadRequestException('Pause the bot before changing its settings');
    }

    return this.prisma.bot.update({
      where: { id },
      data: {
        config:
          dto.config === undefined
            ? undefined
            : (this.strategies.validateConfig(
                bot.strategyKey,
                dto.config,
              ) as object),
        maxLossUsd: dto.maxLossUsd,
        isPaper: dto.isPaper,
      },
    });
  }

  async setStatus(
    userId: string,
    id: string,
    status: BotStatus,
    context: RequestContext,
  ) {
    const bot = await this.mustOwn(userId, id);

    if (status === BotStatus.RUNNING) {
      const account = await this.prisma.exchangeAccount.findUniqueOrThrow({
        where: { id: bot.exchangeAccountId },
      });
      if (!bot.isPaper && account.status !== ExchangeAccountStatus.ACTIVE) {
        throw new BadRequestException(
          'The API key for this bot is not active. Verify it before starting.',
        );
      }
    }

    const updated = await this.prisma.bot.update({
      where: { id },
      data: { status, lastError: null },
    });

    this.audit.record({
      userId,
      action: `bot.${status.toLowerCase()}`,
      resourceType: 'bot',
      resourceId: id,
      ...context,
    });

    return updated;
  }

  async remove(userId: string, id: string, context: RequestContext) {
    const bot = await this.mustOwn(userId, id);

    const open = await this.prisma.order.count({
      where: {
        botId: id,
        state: { in: [OrderState.PENDING, OrderState.NEW, OrderState.PARTIALLY_FILLED] },
      },
    });
    if (open > 0) {
      throw new BadRequestException(
        `This bot has ${open} open order(s). Cancel them before deleting it.`,
      );
    }

    await this.prisma.bot.delete({ where: { id: bot.id } });
    this.audit.record({
      userId,
      action: 'bot.delete',
      resourceType: 'bot',
      resourceId: id,
      ...context,
    });

    return { success: true as const };
  }

  /** Deterministic, stable across restarts and independent of worker count changes. */
  shardFor(botId: string): number {
    const digest = createHash('sha256').update(botId).digest();
    return digest.readUInt32BE(0) % SHARD_COUNT;
  }

  private async mustOwn(userId: string, id: string) {
    const bot = await this.prisma.bot.findFirst({ where: { id, userId } });
    if (!bot) throw new NotFoundException('Bot not found');
    return bot;
  }
}
