import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma.service';
import { CONFIRMATIONS } from './billing.constants';
import { ChainLog, IChainClient } from './chain-client';
import { SubscriptionService } from './subscription.service';
import { WalletService } from './wallet.service';

/** Cap on a single backfill query, since RPC providers limit log ranges. */
const MAX_BLOCK_SPAN = 2_000n;

/**
 * Turns on-chain events into subscription state.
 *
 * Correctness comes from the **backfill**, not from the websocket. A socket that
 * dies silently — which they do — would otherwise lose every payment made while it
 * was down, and the user would have paid for nothing. The stream is only a latency
 * optimisation on top; every event is ultimately confirmed by a range scan from a
 * persisted cursor.
 *
 * Three rules:
 *
 * 1. **Wait for confirmations.** Crediting at the chain head means occasionally
 *    granting Pro for a transaction a reorg then rolls back.
 * 2. **Idempotency is (txHash, logIndex).** The same log arrives twice whenever a
 *    backfill overlaps the live stream.
 * 3. **Only this contract's `Charged` event counts.** A token `Transfer` into the
 *    treasury proves nothing — anyone can send USDT to any address.
 */
@Injectable()
export class PaymentListenerService implements OnModuleDestroy {
  private readonly logger = new Logger(PaymentListenerService.name);
  private unwatch?: () => void;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
    private readonly wallets: WalletService,
    private readonly chain: IChainClient | null,
    private readonly contractAddress: string | null,
    private readonly startBlock: bigint = 0n,
  ) {}

  onModuleDestroy(): void {
    this.unwatch?.();
  }

  get enabled(): boolean {
    return !!this.chain && !!this.contractAddress;
  }

  /**
   * Starts the live stream.
   *
   * Incoming logs only nudge the cursor forward — they are never applied directly,
   * because a streamed log has no confirmations yet.
   */
  start(): void {
    if (!this.enabled) {
      this.logger.warn(
        'Billing listener disabled: BILLING_CONTRACT_ADDRESS / RPC not configured',
      );
      return;
    }

    this.unwatch = this.chain!.watch({
      address: this.contractAddress!,
      onLogs: (logs) => {
        this.logger.log(`Saw ${logs.length} billing event(s) at the head`);
        void this.sync();
      },
      onError: (error) => {
        // Not fatal: the scheduled sync keeps working without the socket.
        this.logger.error(`Billing websocket error: ${error.message}`);
      },
    });

    this.logger.log(`Billing listener watching ${this.contractAddress}`);
  }

  /** Safety net: runs even when the socket is silent or dead. */
  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (!this.enabled) return;
    await this.sync();
  }

  /** Processes everything from the cursor up to the last confirmed block. */
  async sync(): Promise<{ processed: number; toBlock: bigint }> {
    if (!this.enabled) return { processed: 0, toBlock: 0n };
    if (this.running) return { processed: 0, toBlock: 0n };
    this.running = true;

    try {
      const head = await this.chain!.getBlockNumber();
      const confirmed = head - BigInt(CONFIRMATIONS);
      if (confirmed <= 0n) return { processed: 0, toBlock: 0n };

      const cursor = await this.cursor();
      let from = cursor + 1n;
      let processed = 0;

      while (from <= confirmed) {
        const to =
          from + MAX_BLOCK_SPAN - 1n > confirmed ? confirmed : from + MAX_BLOCK_SPAN - 1n;

        const logs = await this.chain!.getLogs({
          address: this.contractAddress!,
          fromBlock: from,
          toBlock: to,
        });

        for (const log of logs) {
          await this.handle(log);
          processed++;
        }

        // Advance only after the batch is durably applied: a crash mid-range must
        // re-read that range, not skip it.
        await this.saveCursor(to);
        from = to + 1n;
      }

      if (processed) {
        this.logger.log(`Applied ${processed} billing event(s) up to block ${confirmed}`);
      }
      return { processed, toBlock: confirmed };
    } catch (error) {
      this.logger.error(`Billing sync failed: ${(error as Error).message}`);
      return { processed: 0, toBlock: 0n };
    } finally {
      this.running = false;
    }
  }

  /** Exposed for tests and for an operator replaying a range by hand. */
  async handle(log: ChainLog): Promise<void> {
    const address = String(log.args.user ?? '').toLowerCase();
    if (!address) return;

    const userId = await this.wallets.ownerOf(address);
    if (!userId) {
      // Someone subscribed on-chain with a wallet no account has proven. Their
      // payment is real; it just cannot be attributed until they link the wallet.
      this.logger.warn(
        `Billing event for unlinked wallet ${address} (${log.eventName})`,
      );
      return;
    }

    switch (log.eventName) {
      case 'Charged': {
        await this.subscriptions.applyCharge(userId, {
          walletAddress: address,
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          blockNumber: log.blockNumber,
          amountRaw: BigInt(String(log.args.amount ?? '0')),
          chargeCount: Number(log.args.chargeCount ?? 0),
          timestamp: new Date(Number(log.args.timestamp ?? 0) * 1000),
        });
        break;
      }
      case 'Subscribed':
        await this.subscriptions.markSubscribed(userId, address);
        break;
      case 'Unsubscribed':
        await this.subscriptions.markCancelled(userId);
        break;
      case 'ChargeFailed':
        this.logger.warn(
          `Charge failed for ${address}: ${String(log.args.reason ?? '')}`,
        );
        break;
    }
  }

  private async cursor(): Promise<bigint> {
    const row = await this.prisma.chainCursor.findUnique({
      where: {
        chainId_contractAddress: {
          chainId: this.chain!.chainId,
          contractAddress: this.contractAddress!,
        },
      },
    });
    return row?.lastProcessedBlock ?? this.startBlock;
  }

  private async saveCursor(block: bigint): Promise<void> {
    await this.prisma.chainCursor.upsert({
      where: {
        chainId_contractAddress: {
          chainId: this.chain!.chainId,
          contractAddress: this.contractAddress!,
        },
      },
      create: {
        chainId: this.chain!.chainId,
        contractAddress: this.contractAddress!,
        lastProcessedBlock: block,
      },
      update: { lastProcessedBlock: block },
    });
  }
}
