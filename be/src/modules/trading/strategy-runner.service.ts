import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';
import { Bot, BotStatus, OrderState } from 'generated/prisma';
import { PrismaService } from 'src/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExchangeRegistry } from '../exchange/exchange.registry';
import { Candle } from '../exchange/exchange.types';
import { StrategyRegistry } from '../strategies/strategy-registry.service';
import { Signal } from '../strategies/strategy.types';
import { computePosition, sizeFromBudget, unrealisedReturn } from './position';
import { OrdersService } from './orders.service';

/** A bot that fails this many ticks in a row is parked rather than retried forever. */
const MAX_CONSECUTIVE_FAILURES = 5;

/** Ceiling on bots handled per tick, so a spike degrades latency and not the process. */
const MAX_BOTS_PER_TICK = 500;

type Decision =
  | { kind: 'none'; reason: string }
  | { kind: 'entry'; signal: Signal; quantity: Decimal }
  | { kind: 'exit'; reason: string; quantity: Decimal };

/**
 * Turns strategy signals into orders.
 *
 * The link between "the strategy thinks X" and "money moves". Three rules shape
 * everything here:
 *
 * 1. **Only closed candles.** The forming candle changes under us, so a signal
 *    computed from it can appear and vanish within the same bar — the classic
 *    repainting bug that backtests never show.
 * 2. **One decision per candle.** The idempotency key is derived from the candle's
 *    open time, so replaying a tick, restarting the process or running two workers
 *    on the same bot cannot place a second order for the same bar.
 * 3. **Risk exits beat entries.** Take-profit and stop-loss are evaluated before the
 *    strategy is even asked, so a bug in a strategy cannot keep a losing position open.
 */
@Injectable()
export class StrategyRunnerService {
  private readonly logger = new Logger(StrategyRunnerService.name);
  private running = false;
  private readonly failures = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly strategies: StrategyRegistry,
    private readonly exchanges: ExchangeRegistry,
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (this.config.get<string>('RUNNER_ENABLED') === 'false') return;

    // Overlapping ticks would evaluate the same bot twice concurrently.
    if (this.running) {
      this.logger.warn('Previous run still in progress, skipping tick');
      return;
    }
    this.running = true;
    try {
      await this.runAll();
    } catch (error) {
      this.logger.error(`Runner tick failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async runAll(): Promise<{ evaluated: number; acted: number }> {
    const bots = await this.prisma.bot.findMany({
      where: { status: BotStatus.RUNNING, shardId: { in: this.ownedShards() } },
      take: MAX_BOTS_PER_TICK,
    });

    let acted = 0;
    for (const bot of bots) {
      try {
        if (await this.runBot(bot)) acted++;
        this.failures.delete(bot.id);
      } catch (error) {
        // One bad bot — a delisted symbol, a revoked key — must not stop the rest.
        await this.recordFailure(bot, error as Error);
      }
    }

    if (bots.length) {
      this.logger.log(`Evaluated ${bots.length} bot(s), ${acted} acted`);
    }
    return { evaluated: bots.length, acted };
  }

  /** Returns true when the bot placed an order. */
  async runBot(bot: Bot): Promise<boolean> {
    const account = await this.prisma.exchangeAccount.findUniqueOrThrow({
      where: { id: bot.exchangeAccountId },
    });

    const config = bot.config as Record<string, unknown>;
    const required = this.strategies.requiredCandles(bot.strategyKey, config);

    const candles = this.closedCandles(
      await this.exchanges.get(account.exchange).fetchOHLCV({
        symbol: bot.symbol,
        interval: bot.timeframe,
        // One extra for the bar still forming, which is then dropped.
        limit: required + 1,
      }),
    );

    if (candles.length < required) {
      await this.note(bot, `Chưa đủ nến (${candles.length}/${required})`);
      return false;
    }

    const bar = candles[candles.length - 1];
    const price = new Decimal(bar.close);

    const decision = await this.decide(bot, candles, price, config);
    await this.prisma.bot.update({
      where: { id: bot.id },
      data: { lastSignalAt: new Date(), lastError: null },
    });

    if (decision.kind === 'none' || decision.quantity.lte(0)) {
      return false;
    }

    const action = decision.kind === 'entry' ? decision.signal.action : 'SELL';
    const reason =
      decision.kind === 'entry' ? decision.signal.reason : decision.reason;

    // Keyed by the candle, so the same bar can only ever produce one order —
    // whatever happens to this process in between.
    const idempotencyKey = `bot:${bot.id}:${bar.openTime}:${action}`;

    await this.orders.place(
      bot.userId,
      {
        exchangeAccountId: bot.exchangeAccountId,
        botId: bot.id,
        symbol: bot.symbol,
        side: action as 'BUY' | 'SELL',
        type: 'MARKET',
        quantity: decision.quantity.toString(),
        idempotencyKey,
      },
      {},
    );

    this.audit.record({
      userId: bot.userId,
      action: 'bot.signal.executed',
      resourceType: 'bot',
      resourceId: bot.id,
      metadata: {
        side: action,
        quantity: decision.quantity.toString(),
        price: price.toString(),
        candleOpenTime: bar.openTime,
        reason,
      },
    });

    this.logger.log(`Bot ${bot.id}: ${action} ${decision.quantity} — ${reason}`);
    return true;
  }

  // ── internals ──

  /**
   * Risk exits first, then the strategy.
   *
   * A stop-loss that only fires when the strategy happens to agree is not a
   * stop-loss.
   */
  private async decide(
    bot: Bot,
    candles: Candle[],
    price: Decimal,
    config: Record<string, unknown>,
  ): Promise<Decision> {
    const fills = await this.prisma.order.findMany({
      where: {
        botId: bot.id,
        state: { in: [OrderState.FILLED, OrderState.PARTIALLY_FILLED] },
      },
      select: { side: true, filledQuantity: true, averagePrice: true },
      orderBy: { createdAt: 'asc' },
    });

    const position = computePosition(fills);
    const params = this.strategies.validateConfig(bot.strategyKey, config);

    if (position.quantity.gt(0)) {
      const change = unrealisedReturn(position, price);
      const takeProfit = new Decimal(Number(params.takeProfitPercent)).div(100);
      const stopLoss = new Decimal(Number(params.stopLossPercent)).div(100);

      if (change.gte(takeProfit)) {
        return {
          kind: 'exit',
          reason: `Chốt lời: +${change.times(100).toFixed(2)}%`,
          quantity: position.quantity,
        };
      }
      if (change.lte(stopLoss.negated())) {
        return {
          kind: 'exit',
          reason: `Cắt lỗ: ${change.times(100).toFixed(2)}%`,
          quantity: position.quantity,
        };
      }
    }

    const signal = this.strategies.evaluate(bot.strategyKey, candles, config);

    if (signal.action === 'BUY') {
      const info = await this.symbolInfo(bot);
      const quantity = sizeFromBudget(
        Number(params.orderSizeUsd),
        price,
        info.stepSize,
      );

      if (quantity.lte(0)) {
        return { kind: 'none', reason: 'Kích thước lệnh nhỏ hơn bước khối lượng' };
      }
      if (quantity.times(price).lt(info.minNotional)) {
        return {
          kind: 'none',
          reason: `Giá trị lệnh dưới mức tối thiểu ${info.minNotional} của sàn`,
        };
      }
      return { kind: 'entry', signal, quantity };
    }

    if (signal.action === 'SELL') {
      // Spot only: there is nothing to sell without inventory, and the platform
      // does not open shorts on a user's behalf.
      if (position.quantity.lte(0)) {
        return { kind: 'none', reason: 'Tín hiệu bán nhưng không có vị thế' };
      }
      return { kind: 'exit', reason: signal.reason, quantity: position.quantity };
    }

    return { kind: 'none', reason: signal.reason };
  }

  private async symbolInfo(bot: Bot) {
    const account = await this.prisma.exchangeAccount.findUniqueOrThrow({
      where: { id: bot.exchangeAccountId },
      select: { exchange: true },
    });
    return this.exchanges.get(account.exchange).fetchSymbolInfo(bot.symbol);
  }

  /**
   * Drops the bar that is still forming.
   *
   * `closeTime` is in the future for the current candle; acting on it means acting
   * on a value that can still change.
   */
  private closedCandles(candles: Candle[]): Candle[] {
    const now = Date.now();
    return candles.filter((candle) => candle.closeTime <= now);
  }

  /** Which shards this process is responsible for. */
  private ownedShards(): number[] {
    const total = Number(this.config.get('STRATEGY_SHARD_COUNT') ?? 16);
    const index = this.config.get<string>('WORKER_SHARD_INDEX');
    const workers = Number(this.config.get('WORKER_COUNT') ?? 1);

    const all = Array.from({ length: total }, (_, i) => i);
    if (index === undefined || workers <= 1) return all;

    // Round-robin: shard s belongs to worker s % workerCount. Adding a worker
    // reshuffles deterministically without any coordination.
    return all.filter((shard) => shard % workers === Number(index));
  }

  private async note(bot: Bot, message: string): Promise<void> {
    await this.prisma.bot.update({
      where: { id: bot.id },
      data: { lastError: message },
    });
  }

  private async recordFailure(bot: Bot, error: Error): Promise<void> {
    const count = (this.failures.get(bot.id) ?? 0) + 1;
    this.failures.set(bot.id, count);

    this.logger.warn(
      `Bot ${bot.id} failed (${count}/${MAX_CONSECUTIVE_FAILURES}): ${error.message}`,
    );

    if (count < MAX_CONSECUTIVE_FAILURES) {
      await this.note(bot, error.message);
      return;
    }

    // Repeated failure is a configuration problem, not a transient one. Park the
    // bot so it stops burning API budget and the user is told.
    await this.prisma.bot.update({
      where: { id: bot.id },
      data: {
        status: BotStatus.ERROR,
        lastError: `Dừng sau ${count} lần lỗi liên tiếp: ${error.message}`,
      },
    });
    this.failures.delete(bot.id);

    this.audit.record({
      userId: bot.userId,
      action: 'bot.stopped.repeated_failure',
      resourceType: 'bot',
      resourceId: bot.id,
      success: false,
      metadata: { error: error.message },
    });
  }
}
