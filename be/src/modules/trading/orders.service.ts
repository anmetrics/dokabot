import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';
import { OrderState } from 'generated/prisma';
import { PrismaService } from 'src/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExchangeRegistry } from '../exchange/exchange.registry';
import { ExchangeError } from '../exchange/exchange.errors';
import { OrderResult, OrderStatus } from '../exchange/exchange.types';
import { ExchangeAccountsService } from '../exchange-accounts/exchange-accounts.service';
import { RequestContext } from '../authentication/interfaces/authentication.interface';
import { deriveClientOrderId } from './client-order-id';
import { PlaceOrderDto } from './dto/place-order.dto';

const STATE_MAP: Record<OrderStatus, OrderState> = {
  NEW: OrderState.NEW,
  PARTIALLY_FILLED: OrderState.PARTIALLY_FILLED,
  FILLED: OrderState.FILLED,
  CANCELED: OrderState.CANCELED,
  REJECTED: OrderState.REJECTED,
  EXPIRED: OrderState.EXPIRED,
};

/** States where the intent is settled and a replay must not resend anything. */
const TERMINAL_STATES: OrderState[] = [
  OrderState.FILLED,
  OrderState.CANCELED,
  OrderState.REJECTED,
  OrderState.EXPIRED,
];

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: ExchangeAccountsService,
    private readonly registry: ExchangeRegistry,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Places an order, exactly once per intent.
   *
   * The row is written *before* the exchange call. If the process dies mid-flight
   * the intent is still recorded as PENDING and the reconciler can find out what
   * actually happened — the failure mode we must never have is "money moved and
   * nobody wrote it down".
   */
  async place(userId: string, dto: PlaceOrderDto, context: RequestContext) {
    this.assertTradingEnabled();

    if (dto.type === 'LIMIT' && !dto.price) {
      throw new BadRequestException('A LIMIT order requires a price');
    }
    if (new Decimal(dto.quantity).lte(0)) {
      throw new BadRequestException('quantity must be greater than zero');
    }

    const bot = dto.botId ? await this.loadBot(userId, dto.botId) : null;
    const clientOrderId = deriveClientOrderId(userId, dto.idempotencyKey);

    const existing = await this.prisma.order.findUnique({
      where: { clientOrderId },
    });
    if (existing) {
      // Same intent replayed. Terminal orders are returned as-is; anything still
      // live is refreshed from the exchange so the caller sees the truth.
      if (TERMINAL_STATES.includes(existing.state)) return existing;
      return this.sync(userId, existing.id);
    }

    const credentials = await this.accounts.getCredentials(
      userId,
      dto.exchangeAccountId,
    );
    const account = await this.prisma.exchangeAccount.findFirstOrThrow({
      where: { id: dto.exchangeAccountId, userId },
      select: { exchange: true },
    });

    const isPaper = bot?.isPaper ?? false;

    const order = await this.prisma.order.create({
      data: {
        userId,
        botId: bot?.id ?? null,
        exchangeAccountId: dto.exchangeAccountId,
        exchange: account.exchange,
        symbol: dto.symbol,
        side: dto.side,
        type: dto.type,
        clientOrderId,
        price: dto.price ?? '0',
        quantity: dto.quantity,
        state: OrderState.PENDING,
        isPaper,
      },
    });

    if (isPaper) {
      // Paper bots run the whole pipeline except the exchange call, so a strategy
      // bug shows up here rather than in a real position.
      return this.prisma.order.update({
        where: { id: order.id },
        data: {
          state: OrderState.FILLED,
          filledQuantity: dto.quantity,
          averagePrice: dto.price ?? '0',
          exchangeOrderId: `paper-${order.id}`,
        },
      });
    }

    try {
      const result = await this.registry
        .get(account.exchange)
        .placeOrder(credentials, {
          symbol: dto.symbol,
          side: dto.side,
          type: dto.type,
          quantity: dto.quantity,
          price: dto.price,
          clientOrderId,
        });

      this.audit.record({
        userId,
        action: 'order.place',
        resourceType: 'order',
        resourceId: order.id,
        metadata: {
          exchange: account.exchange,
          symbol: dto.symbol,
          side: dto.side,
          quantity: dto.quantity,
        },
        ...context,
      });

      return this.applyResult(order.id, result);
    } catch (error) {
      const message = (error as Error).message;
      const retryable =
        error instanceof ExchangeError ? error.retryable : false;

      // A retryable failure leaves the row PENDING: the order may well exist on
      // the exchange, and the reconciler — not this request — decides.
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          state: retryable ? OrderState.PENDING : OrderState.REJECTED,
          lastError: message,
        },
      });

      this.audit.record({
        userId,
        action: 'order.place',
        resourceType: 'order',
        resourceId: order.id,
        success: false,
        metadata: { reason: message, retryable },
        ...context,
      });

      throw new BadRequestException(message);
    }
  }

  /** Re-reads an order from the exchange and reconciles the local row. */
  async sync(userId: string, orderId: string) {
    const order = await this.mustOwn(userId, orderId);
    if (order.isPaper) return order;

    const credentials = await this.accounts.getCredentials(
      userId,
      order.exchangeAccountId,
    );

    const result = await this.registry
      .get(order.exchange)
      .fetchOrder(credentials, {
        symbol: order.symbol,
        clientOrderId: order.clientOrderId,
      });

    if (!result) {
      // The exchange has never heard of it, so the submission never landed.
      return this.prisma.order.update({
        where: { id: order.id },
        data: {
          state: OrderState.REJECTED,
          lastError: 'Order was not found on the exchange',
        },
      });
    }

    return this.applyResult(order.id, result);
  }

  async cancel(userId: string, orderId: string, context: RequestContext) {
    const order = await this.mustOwn(userId, orderId);
    if (TERMINAL_STATES.includes(order.state)) {
      throw new BadRequestException('This order is already closed');
    }
    if (order.isPaper) {
      return this.prisma.order.update({
        where: { id: order.id },
        data: { state: OrderState.CANCELED },
      });
    }

    const credentials = await this.accounts.getCredentials(
      userId,
      order.exchangeAccountId,
    );
    const result = await this.registry
      .get(order.exchange)
      .cancelOrder(credentials, {
        symbol: order.symbol,
        clientOrderId: order.clientOrderId,
      });

    this.audit.record({
      userId,
      action: 'order.cancel',
      resourceType: 'order',
      resourceId: order.id,
      ...context,
    });

    return this.applyResult(order.id, result);
  }

  list(userId: string, params: { botId?: string; limit?: number }) {
    return this.prisma.order.findMany({
      where: { userId, ...(params.botId ? { botId: params.botId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(params.limit ?? 50, 200),
    });
  }

  // ── internals ──

  private assertTradingEnabled(): void {
    // Global kill switch. One flag stops every new order across the platform —
    // the first thing to reach for when something is going wrong.
    if (this.config.get<string>('TRADING_KILL_SWITCH') === 'true') {
      throw new ForbiddenException(
        'Trading is temporarily disabled by the platform. No new orders are being accepted.',
      );
    }
  }

  private applyResult(orderId: string, result: OrderResult) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        exchangeOrderId: result.exchangeOrderId,
        state: STATE_MAP[result.status] ?? OrderState.NEW,
        price: result.price,
        filledQuantity: result.filledQuantity,
        averagePrice: result.averagePrice,
        lastError: null,
        raw: result as unknown as object,
      },
    });
  }

  private async loadBot(userId: string, botId: string) {
    const bot = await this.prisma.bot.findFirst({ where: { id: botId, userId } });
    if (!bot) throw new NotFoundException('Bot not found');
    return bot;
  }

  private async mustOwn(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
