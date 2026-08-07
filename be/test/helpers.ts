import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { ExchangeRegistry } from '../src/modules/exchange/exchange.registry';
import {
  Candle,
  ExchangeCredentials,
  IExchangeAdapter,
  OrderResult,
  PlaceOrderRequest,
  VerificationResult,
} from '../src/modules/exchange/exchange.types';

/**
 * Stand-in for a real exchange.
 *
 * E2E covers *our* logic — ownership, idempotency, state machines. Hitting a live
 * exchange would make the suite slow, flaky and dependent on someone else's uptime.
 * The adapter contract itself is verified separately against testnet.
 */
export class FakeAdapter implements IExchangeAdapter {
  readonly exchange = 'BINANCE' as const;

  /** Overridden per test to simulate exchange behaviour. */
  verifyResult: VerificationResult = {
    ok: true,
    permissions: { canRead: true, canTrade: true, canWithdraw: false, raw: [] },
  };
  placeError: Error | null = null;
  /** Candle series returned by fetchOHLCV. */
  candles: Candle[] = [];
  /** Symbols whose info lookup should fail, to simulate a delisted market. */
  readonly symbolErrors = new Set<string>();
  readonly placed: PlaceOrderRequest[] = [];
  private readonly orders = new Map<string, OrderResult>();

  reset(): void {
    this.verifyResult = {
      ok: true,
      permissions: { canRead: true, canTrade: true, canWithdraw: false, raw: [] },
    };
    this.placeError = null;
    this.candles = [];
    this.symbolErrors.clear();
    this.placed.length = 0;
    this.orders.clear();
  }

  verifyCredentials(): Promise<VerificationResult> {
    return Promise.resolve(this.verifyResult);
  }

  fetchOHLCV() {
    return Promise.resolve(this.candles);
  }

  fetchSymbolInfo(symbol: string) {
    if (this.symbolErrors.has(symbol)) {
      return Promise.reject(new Error(`Unknown symbol ${symbol}`));
    }
    return Promise.resolve({
      symbol,
      base: symbol.replace('USDT', ''),
      quote: 'USDT',
      stepSize: '0.00001',
      tickSize: '0.01',
      minQty: '0.00001',
      minNotional: '5',
    });
  }

  fetchBalances() {
    return Promise.resolve([{ asset: 'USDT', free: '1000', locked: '0' }]);
  }

  placeOrder(
    _credentials: ExchangeCredentials,
    request: PlaceOrderRequest,
  ): Promise<OrderResult> {
    if (this.placeError) return Promise.reject(this.placeError);

    this.placed.push(request);
    const order: OrderResult = {
      clientOrderId: request.clientOrderId,
      exchangeOrderId: `ex-${this.orders.size + 1}`,
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      status: 'NEW',
      price: request.price ?? '0',
      quantity: request.quantity,
      filledQuantity: '0',
      averagePrice: '0',
      createdAt: Date.now(),
    };
    this.orders.set(request.clientOrderId, order);
    return Promise.resolve(order);
  }

  cancelOrder(
    _credentials: ExchangeCredentials,
    params: { symbol: string; clientOrderId: string },
  ): Promise<OrderResult> {
    const order = this.orders.get(params.clientOrderId);
    if (!order) return Promise.reject(new Error('unknown order'));
    const cancelled = { ...order, status: 'CANCELED' as const };
    this.orders.set(params.clientOrderId, cancelled);
    return Promise.resolve(cancelled);
  }

  fetchOrder(
    _credentials: ExchangeCredentials,
    params: { symbol: string; clientOrderId: string },
  ): Promise<OrderResult | null> {
    return Promise.resolve(this.orders.get(params.clientOrderId) ?? null);
  }

  fetchOpenOrders(): Promise<OrderResult[]> {
    return Promise.resolve([...this.orders.values()]);
  }

  /** Test seam: simulate a fill happening on the exchange. */
  fill(clientOrderId: string, price: string): void {
    const order = this.orders.get(clientOrderId);
    if (!order) throw new Error(`unknown order ${clientOrderId}`);
    this.orders.set(clientOrderId, {
      ...order,
      status: 'FILLED',
      filledQuantity: order.quantity,
      averagePrice: price,
    });
  }
}

export type TestContext = {
  app: INestApplication;
  prisma: PrismaService;
  fake: FakeAdapter;
  http: () => request.Test | any;
};

export async function createTestApp(): Promise<TestContext> {
  const fake = new FakeAdapter();

  const builder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ExchangeRegistry)
    .useValue({
      get: () => fake,
      supported: () => ['BINANCE', 'BYBIT'],
    });

  const moduleRef: TestingModule = await builder.compile();

  const app = moduleRef.createNestApplication();
  // Mirror main.ts: a pipe that only exists in production would make these tests
  // prove the wrong thing.
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    fake,
    http: () => request(app.getHttpServer()),
  };
}

/**
 * Polls until `check` returns a truthy value.
 *
 * Audit writes are deliberately fire-and-forget — an audit failure must never break
 * the user's action — so assertions about them cannot assume the row is already
 * committed when the response returns.
 */
export async function waitFor<T>(
  check: () => Promise<T | null | undefined | false>,
  timeoutMs = 2000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result) return result;
    if (Date.now() > deadline) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** Order matters: children before parents. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.order.deleteMany();
  await prisma.bot.deleteMany();
  await prisma.exchangeAccount.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
}

export type TestUser = {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
};

let userCounter = 0;

export async function registerUser(ctx: TestContext): Promise<TestUser> {
  const email = `user${++userCounter}-${Date.now()}@example.com`;
  const response = await ctx
    .http()
    .post('/api/auth/register')
    .send({ email, password: 'CorrectHorse123' })
    .expect(201);

  const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });

  return {
    id: user.id,
    email,
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken,
  };
}

/** Registers a user with a verified exchange account and returns both ids. */
export async function registerUserWithAccount(
  ctx: TestContext,
  label = 'main',
): Promise<TestUser & { accountId: string }> {
  const user = await registerUser(ctx);
  const response = await ctx
    .http()
    .post('/api/exchange-accounts')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({
      exchange: 'BINANCE',
      label,
      apiKey: 'A'.repeat(64),
      apiSecret: 'S'.repeat(64),
    })
    .expect(201);

  return { ...user, accountId: response.body.id };
}
