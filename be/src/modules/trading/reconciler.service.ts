import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';
import { BotStatus, OrderState } from 'generated/prisma';
import { PrismaService } from 'src/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OrdersService } from './orders.service';

/** Bounded per tick so a backlog degrades latency, never availability. */
const BATCH_SIZE = 200;

/**
 * A PENDING order older than this was almost certainly interrupted mid-flight
 * rather than merely slow, so it is worth asking the exchange about.
 */
const STALE_AFTER_MS = 30_000;

/**
 * Closes the loop between what we think happened and what the exchange did.
 *
 * The request path is optimistic — it records intent, calls the exchange and moves
 * on. Anything that falls through the cracks (timeout, crash, partial fill, a
 * cancel made on the exchange's own UI) is caught here.
 *
 * Phase 3 moves this into the execution worker, driven by the user-data websocket
 * with this poll kept as the safety net.
 */
@Injectable()
export class ReconcilerService {
  private readonly logger = new Logger(ReconcilerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick(): Promise<void> {
    if (this.config.get<string>('RECONCILER_ENABLED') === 'false') return;

    // Ticks must not overlap: two passes on the same order would both try to
    // settle it.
    if (this.running) {
      this.logger.warn('Previous reconciliation still running, skipping tick');
      return;
    }
    this.running = true;
    try {
      await this.reconcileOpenOrders();
      await this.enforceLossLimits();
    } catch (error) {
      this.logger.error(`Reconciliation failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Refreshes every order that could still have moved. */
  async reconcileOpenOrders(): Promise<{ checked: number; changed: number }> {
    const candidates = await this.prisma.order.findMany({
      where: {
        isPaper: false,
        OR: [
          { state: { in: [OrderState.NEW, OrderState.PARTIALLY_FILLED] } },
          {
            state: OrderState.PENDING,
            createdAt: { lt: new Date(Date.now() - STALE_AFTER_MS) },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    let changed = 0;
    for (const order of candidates) {
      try {
        const updated = await this.orders.sync(order.userId, order.id);
        if (updated.state === order.state) continue;

        changed++;
        this.audit.record({
          userId: order.userId,
          action: 'order.reconciled',
          resourceType: 'order',
          resourceId: order.id,
          metadata: { from: order.state, to: updated.state },
        });
      } catch (error) {
        // One unreachable account must not stall the rest of the batch.
        this.logger.warn(
          `Could not reconcile order ${order.id}: ${(error as Error).message}`,
        );
      }
    }

    if (candidates.length) {
      this.logger.log(
        `Reconciled ${candidates.length} order(s), ${changed} changed`,
      );
    }
    return { checked: candidates.length, changed };
  }

  /**
   * Stops any bot that has lost more than its configured limit.
   *
   * The backstop for a strategy bug: whatever the strategy believes, the platform
   * stops it once real losses cross the line the user set.
   */
  async enforceLossLimits(): Promise<void> {
    const bots = await this.prisma.bot.findMany({
      where: {
        status: BotStatus.RUNNING,
        isPaper: false,
        maxLossUsd: { not: null },
      },
    });

    for (const bot of bots) {
      const pnl = await this.realisedPnl(bot.id);
      const limit = new Decimal(bot.maxLossUsd!.toString());

      if (pnl.gte(limit.negated())) continue;

      await this.prisma.bot.update({
        where: { id: bot.id },
        data: {
          status: BotStatus.STOPPED,
          lastError: `Stopped automatically: realised loss ${pnl.toFixed(2)} USD exceeded the ${limit.toFixed(2)} USD limit.`,
        },
      });

      this.audit.record({
        userId: bot.userId,
        action: 'bot.stopped.loss_limit',
        resourceType: 'bot',
        resourceId: bot.id,
        metadata: { realisedPnl: pnl.toFixed(8), limit: limit.toFixed(8) },
      });

      this.logger.warn(
        `Bot ${bot.id} stopped: realised PnL ${pnl.toFixed(2)} below -${limit.toFixed(2)}`,
      );
    }
  }

  /**
   * Realised PnL from filled orders: sell proceeds minus buy cost.
   *
   * Deliberately ignores open inventory — this is a loss *limit*, and marking
   * unrealised positions to market would make it depend on a live price feed the
   * reconciler should not need.
   */
  private async realisedPnl(botId: string): Promise<Decimal> {
    const fills = await this.prisma.order.findMany({
      where: {
        botId,
        state: { in: [OrderState.FILLED, OrderState.PARTIALLY_FILLED] },
      },
      select: { side: true, filledQuantity: true, averagePrice: true },
    });

    return fills.reduce((total, fill) => {
      const notional = new Decimal(fill.filledQuantity.toString()).times(
        fill.averagePrice.toString(),
      );
      return fill.side === 'SELL' ? total.plus(notional) : total.minus(notional);
    }, new Decimal(0));
  }
}
