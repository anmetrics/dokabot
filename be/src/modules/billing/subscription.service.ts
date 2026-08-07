import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  PlanTier,
  Subscription,
  SubscriptionStatus,
} from 'generated/prisma';
import { PrismaService } from 'src/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  BSC_USDT,
  GRACE_DAYS,
  PERIOD_DAYS,
  PRO_PRICE_USD,
} from './billing.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

export type ConfirmedCharge = {
  walletAddress: string;
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  /** Raw on-chain amount, smallest unit. */
  amountRaw: bigint;
  chargeCount: number;
  timestamp: Date;
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(userId: string): Promise<Subscription> {
    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    try {
      return await this.prisma.subscription.create({
        data: { userId, priceUsd: PRO_PRICE_USD },
      });
    } catch {
      // Lost a race with a concurrent first read; the unique index arbitrated.
      return this.prisma.subscription.findUniqueOrThrow({ where: { userId } });
    }
  }

  /**
   * Whether the account may use paid features right now.
   *
   * Computed from dates rather than trusting the stored status, so a subscription
   * that expired while no job was running is still treated as expired.
   */
  async hasPro(userId: string): Promise<boolean> {
    const subscription = await this.get(userId);
    return this.isProActive(subscription);
  }

  isProActive(subscription: Subscription, now = new Date()): boolean {
    if (subscription.tier !== PlanTier.PRO) return false;
    if (subscription.status === SubscriptionStatus.CANCELLED) {
      // Cancelling mid-period keeps access until the period actually ends.
      return !!subscription.currentPeriodEnd && subscription.currentPeriodEnd > now;
    }
    const until = subscription.graceEndsAt ?? subscription.currentPeriodEnd;
    return !!until && until > now;
  }

  /** Links the paying wallet, before any charge has happened. */
  async attachWallet(userId: string, walletAddress: string) {
    const subscription = await this.get(userId);
    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { walletAddress: walletAddress.toLowerCase() },
    });
  }

  /**
   * Records a confirmed on-chain charge and extends the period.
   *
   * Idempotent on (txHash, logIndex): a reorg or a backfill overlapping the live
   * stream will deliver the same log twice, and the second must be a no-op rather
   * than a free extra month.
   */
  async applyCharge(
    userId: string,
    charge: ConfirmedCharge,
  ): Promise<{ applied: boolean; subscription: Subscription }> {
    const subscription = await this.get(userId);

    const existing = await this.prisma.payment.findUnique({
      where: {
        txHash_logIndex: { txHash: charge.txHash, logIndex: charge.logIndex },
      },
    });
    if (existing) {
      return { applied: false, subscription };
    }

    const amountUsd = new Decimal(charge.amountRaw.toString()).div(
      new Decimal(10).pow(BSC_USDT.decimals),
    );

    // Extend from whichever is later: the current period end, or now. Paying late
    // must not silently donate the lapsed days back to the user.
    const base =
      subscription.currentPeriodEnd && subscription.currentPeriodEnd > charge.timestamp
        ? subscription.currentPeriodEnd
        : charge.timestamp;
    const periodEnd = new Date(base.getTime() + PERIOD_DAYS * DAY_MS);

    const [, updated] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          userId,
          txHash: charge.txHash,
          logIndex: charge.logIndex,
          blockNumber: charge.blockNumber,
          walletAddress: charge.walletAddress.toLowerCase(),
          amountUsd: amountUsd.toString(),
          amountRaw: charge.amountRaw.toString(),
          chargeCount: charge.chargeCount,
          confirmedAt: charge.timestamp,
        },
      }),
      this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          tier: PlanTier.PRO,
          status: SubscriptionStatus.ACTIVE,
          walletAddress: charge.walletAddress.toLowerCase(),
          currentPeriodStart: charge.timestamp,
          currentPeriodEnd: periodEnd,
          graceEndsAt: null,
          cancelledAt: null,
          lastError: null,
        },
      }),
    ]);

    this.audit.record({
      userId,
      action: 'subscription.charged',
      resourceType: 'subscription',
      resourceId: subscription.id,
      metadata: {
        amountUsd: amountUsd.toFixed(2),
        txHash: charge.txHash,
        periodEnd: periodEnd.toISOString(),
      },
    });

    return { applied: true, subscription: updated };
  }

  /** The user revoked on-chain. Access runs to the end of the paid period. */
  async markCancelled(userId: string): Promise<Subscription> {
    const subscription = await this.get(userId);
    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
  }

  /** The user opted in on-chain but has not been charged yet. */
  async markSubscribed(userId: string, walletAddress: string) {
    const subscription = await this.get(userId);
    if (subscription.status === SubscriptionStatus.ACTIVE) return subscription;

    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        walletAddress: walletAddress.toLowerCase(),
        status: SubscriptionStatus.NONE,
        cancelledAt: null,
      },
    });
  }

  /**
   * Moves lapsed subscriptions through grace and then to expired.
   *
   * A failed pull is usually an empty wallet rather than a cancellation, so access
   * is not cut the same hour a balance dips.
   */
  async reconcileLapsed(now = new Date()): Promise<{ toGrace: number; expired: number }> {
    const lapsed = await this.prisma.subscription.findMany({
      where: {
        tier: PlanTier.PRO,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { lt: now },
      },
    });

    for (const subscription of lapsed) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.GRACE,
          graceEndsAt: new Date(
            (subscription.currentPeriodEnd ?? now).getTime() + GRACE_DAYS * DAY_MS,
          ),
        },
      });
    }

    const expired = await this.prisma.subscription.updateMany({
      where: {
        status: { in: [SubscriptionStatus.GRACE, SubscriptionStatus.CANCELLED] },
        OR: [
          { graceEndsAt: { lt: now } },
          { status: SubscriptionStatus.CANCELLED, currentPeriodEnd: { lt: now } },
        ],
      },
      data: { status: SubscriptionStatus.EXPIRED, tier: PlanTier.FREE },
    });

    if (lapsed.length || expired.count) {
      this.logger.log(
        `Billing: ${lapsed.length} moved to grace, ${expired.count} expired`,
      );
    }
    return { toGrace: lapsed.length, expired: expired.count };
  }

  /** Subscriptions the charger should attempt this run. */
  dueForCharge(now = new Date()) {
    return this.prisma.subscription.findMany({
      where: {
        walletAddress: { not: null },
        status: {
          in: [SubscriptionStatus.NONE, SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE],
        },
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { lte: now } }],
      },
      select: { id: true, userId: true, walletAddress: true, status: true },
    });
  }

  async payments(userId: string, limit = 24) {
    const rows = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { confirmedAt: 'desc' },
      take: Math.min(limit, 100),
    });

    // `blockNumber` is a BigInt, which JSON.stringify throws on rather than
    // coercing — it has to be rendered explicitly before it leaves the service.
    return rows.map((payment) => ({
      ...payment,
      blockNumber: payment.blockNumber.toString(),
    }));
  }

  async requirePro(userId: string): Promise<void> {
    if (!(await this.hasPro(userId))) {
      throw new BadRequestException(
        'Tính năng này thuộc gói Pro. Nâng cấp trong mục Gói cước.',
      );
    }
  }
}
