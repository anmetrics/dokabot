import {
  createTestApp,
  registerUser,
  registerUserWithAccount,
  resetDatabase,
  TestContext,
  waitFor,
} from './helpers';

describe('Trading (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.fake.reset();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const createBot = async (
    user: { accessToken: string; accountId: string },
    overrides: Record<string, unknown> = {},
  ) => {
    const response = await ctx
      .http()
      .post('/api/bots')
      .set(auth(user.accessToken))
      .send({
        exchangeAccountId: user.accountId,
        strategyKey: 'rsi-reversal',
        symbol: 'BTCUSDT',
        timeframe: '5m',
        ...overrides,
      })
      .expect(201);
    return response.body;
  };

  const placeOrder = (
    user: { accessToken: string; accountId: string },
    overrides: Record<string, unknown> = {},
  ) =>
    ctx
      .http()
      .post('/api/orders')
      .set(auth(user.accessToken))
      .send({
        exchangeAccountId: user.accountId,
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: '0.01',
        idempotencyKey: 'intent-0001',
        ...overrides,
      });

  describe('bots', () => {
    it('defaults a new bot to paper trading', async () => {
      const user = await registerUserWithAccount(ctx);
      const bot = await createBot(user);

      // Real money must always be an explicit choice.
      expect(bot.isPaper).toBe(true);
      expect(bot.status).toBe('DRAFT');
    });

    it('assigns a stable shard', async () => {
      const user = await registerUserWithAccount(ctx);
      const bot = await createBot(user);

      expect(bot.shardId).toBeGreaterThanOrEqual(0);
      expect(bot.shardId).toBeLessThan(16);
    });

    it('refuses a bot on an exchange account that is not active', async () => {
      const user = await registerUserWithAccount(ctx);
      await ctx.prisma.exchangeAccount.update({
        where: { id: user.accountId },
        data: { status: 'INVALID' },
      });

      await ctx
        .http()
        .post('/api/bots')
        .set(auth(user.accessToken))
        .send({
          exchangeAccountId: user.accountId,
          strategyKey: 'rsi-reversal',
          symbol: 'BTCUSDT',
          timeframe: '5m',
        })
        .expect(400);
    });

    it('refuses a bot on another user’s exchange account', async () => {
      const alice = await registerUserWithAccount(ctx);
      const bob = await registerUser(ctx);

      await ctx
        .http()
        .post('/api/bots')
        .set(auth(bob.accessToken))
        .send({
          exchangeAccountId: alice.accountId,
          strategyKey: 'rsi-reversal',
          symbol: 'BTCUSDT',
          timeframe: '5m',
        })
        .expect(404);
    });

    it('does not expose another user’s bots', async () => {
      const alice = await registerUserWithAccount(ctx);
      await createBot(alice);
      const bob = await registerUser(ctx);

      const response = await ctx
        .http()
        .get('/api/bots')
        .set(auth(bob.accessToken))
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it.each(['start', 'pause', 'stop'])(
      'refuses to %s another user’s bot',
      async (action) => {
        const alice = await registerUserWithAccount(ctx);
        const bot = await createBot(alice);
        const bob = await registerUser(ctx);

        await ctx
          .http()
          .post(`/api/bots/${bot.id}/${action}`)
          .set(auth(bob.accessToken))
          .expect(404);
      },
    );

    it('refuses to delete a bot that still has open orders', async () => {
      const user = await registerUserWithAccount(ctx);
      const bot = await createBot(user, { isPaper: false });
      await placeOrder(user, { botId: bot.id }).expect(201);

      await ctx
        .http()
        .delete(`/api/bots/${bot.id}`)
        .set(auth(user.accessToken))
        .expect(400);
    });

    it('keeps order history when a bot is deleted', async () => {
      const user = await registerUserWithAccount(ctx);
      const bot = await createBot(user, { isPaper: true });
      await placeOrder(user, { botId: bot.id }).expect(201);

      await ctx
        .http()
        .delete(`/api/bots/${bot.id}`)
        .set(auth(user.accessToken))
        .expect(200);

      const orders = await ctx.prisma.order.findMany();
      expect(orders).toHaveLength(1);
      // SET NULL, not cascade: deleting a bot must not erase what it traded.
      expect(orders[0].botId).toBeNull();
    });
  });

  describe('order idempotency', () => {
    it('sends one order to the exchange when the same intent is replayed', async () => {
      const user = await registerUserWithAccount(ctx);

      const first = await placeOrder(user).expect(201);
      const second = await placeOrder(user).expect(201);

      expect(second.body.id).toBe(first.body.id);
      // The whole point: a retry after a timeout must not open a second position.
      expect(ctx.fake.placed).toHaveLength(1);
      expect(await ctx.prisma.order.count()).toBe(1);
    });

    it('treats a different intent key as a different order', async () => {
      const user = await registerUserWithAccount(ctx);

      await placeOrder(user, { idempotencyKey: 'intent-0001' }).expect(201);
      await placeOrder(user, { idempotencyKey: 'intent-0002' }).expect(201);

      expect(ctx.fake.placed).toHaveLength(2);
    });

    it('does not let one user’s intent key collide with another’s', async () => {
      const alice = await registerUserWithAccount(ctx);
      const bob = await registerUserWithAccount(ctx);

      await placeOrder(alice, { idempotencyKey: 'same-key-both' }).expect(201);
      await placeOrder(bob, { idempotencyKey: 'same-key-both' }).expect(201);

      expect(ctx.fake.placed).toHaveLength(2);
      expect(await ctx.prisma.order.count()).toBe(2);
    });

    it('survives concurrent replays of the same intent', async () => {
      const user = await registerUserWithAccount(ctx);

      const results = await Promise.allSettled([
        placeOrder(user),
        placeOrder(user),
        placeOrder(user),
      ]);

      const succeeded = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 201,
      );
      expect(succeeded.length).toBeGreaterThanOrEqual(1);
      // The unique index is what guarantees this, not application logic.
      expect(await ctx.prisma.order.count()).toBe(1);
      expect(ctx.fake.placed).toHaveLength(1);
    });
  });

  describe('order safety', () => {
    it('never reaches the exchange for a paper bot', async () => {
      const user = await registerUserWithAccount(ctx);
      const bot = await createBot(user, { isPaper: true });

      const response = await placeOrder(user, { botId: bot.id }).expect(201);

      expect(response.body.isPaper).toBe(true);
      expect(response.body.state).toBe('FILLED');
      expect(ctx.fake.placed).toHaveLength(0);
    });

    it('leaves the order PENDING when the exchange fails in a retryable way', async () => {
      const user = await registerUserWithAccount(ctx);
      const { ExchangeError } = await import(
        '../src/modules/exchange/exchange.errors'
      );
      ctx.fake.placeError = new ExchangeError('BINANCE', 'gateway down', 500, true);

      await placeOrder(user).expect(400);

      const order = await ctx.prisma.order.findFirstOrThrow();
      // The order may well exist on the exchange — the reconciler decides, not us.
      expect(order.state).toBe('PENDING');
      expect(order.lastError).toMatch(/gateway down/);
    });

    it('marks the order REJECTED when the failure is permanent', async () => {
      const user = await registerUserWithAccount(ctx);
      const { ExchangeError } = await import(
        '../src/modules/exchange/exchange.errors'
      );
      ctx.fake.placeError = new ExchangeError('BINANCE', 'invalid symbol', -1121, false);

      await placeOrder(user).expect(400);

      const order = await ctx.prisma.order.findFirstOrThrow();
      expect(order.state).toBe('REJECTED');
    });

    it('records the intent even when the exchange call throws', async () => {
      const user = await registerUserWithAccount(ctx);
      ctx.fake.placeError = new Error('socket hang up');

      await placeOrder(user).expect(400);

      // Money must never move without a row describing why we tried.
      expect(await ctx.prisma.order.count()).toBe(1);
    });

    it.each([
      ['zero quantity', { quantity: '0' }],
      ['negative quantity', { quantity: '-1' }],
      ['limit order with no price', { type: 'LIMIT' }],
      ['unknown side', { side: 'HODL' }],
      ['malformed symbol', { symbol: 'btc/usdt' }],
      ['non-numeric quantity', { quantity: 'lots' }],
    ])('rejects an order with %s', async (_label, overrides) => {
      const user = await registerUserWithAccount(ctx);
      await placeOrder(user, overrides).expect(400);
      expect(ctx.fake.placed).toHaveLength(0);
    });

    it('refuses to place an order on another user’s exchange account', async () => {
      const alice = await registerUserWithAccount(ctx);
      const bob = await registerUser(ctx);

      await ctx
        .http()
        .post('/api/orders')
        .set(auth(bob.accessToken))
        .send({
          exchangeAccountId: alice.accountId,
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'MARKET',
          quantity: '0.01',
          idempotencyKey: 'theft-attempt',
        })
        .expect(404);

      expect(ctx.fake.placed).toHaveLength(0);
    });

    it('refuses to place an order on a revoked exchange account', async () => {
      const user = await registerUserWithAccount(ctx);
      await ctx
        .http()
        .delete(`/api/exchange-accounts/${user.accountId}`)
        .set(auth(user.accessToken))
        .expect(200);

      // 400, not 404: the account is the caller's own, soft-revoked rather than
      // gone, so there is nothing to hide by saying it is inactive.
      await placeOrder(user).expect(400);
      expect(ctx.fake.placed).toHaveLength(0);
    });
  });

  describe('order lifecycle', () => {
    it('reflects a fill that happened on the exchange', async () => {
      const user = await registerUserWithAccount(ctx);
      const created = await placeOrder(user).expect(201);

      ctx.fake.fill(created.body.clientOrderId, '65000');

      const synced = await ctx
        .http()
        .post(`/api/orders/${created.body.id}/sync`)
        .set(auth(user.accessToken))
        .expect(201);

      expect(synced.body.state).toBe('FILLED');
      expect(Number(synced.body.averagePrice)).toBe(65000);
    });

    it('marks an order rejected when the exchange has never seen it', async () => {
      const user = await registerUserWithAccount(ctx);
      const created = await placeOrder(user).expect(201);

      ctx.fake.reset(); // the exchange no longer knows this order

      const synced = await ctx
        .http()
        .post(`/api/orders/${created.body.id}/sync`)
        .set(auth(user.accessToken))
        .expect(201);

      expect(synced.body.state).toBe('REJECTED');
    });

    it('cancels a live order', async () => {
      const user = await registerUserWithAccount(ctx);
      const created = await placeOrder(user).expect(201);

      const cancelled = await ctx
        .http()
        .delete(`/api/orders/${created.body.id}`)
        .set(auth(user.accessToken))
        .expect(200);

      expect(cancelled.body.state).toBe('CANCELED');
    });

    it('refuses to cancel an order that is already closed', async () => {
      const user = await registerUserWithAccount(ctx);
      const created = await placeOrder(user).expect(201);

      await ctx
        .http()
        .delete(`/api/orders/${created.body.id}`)
        .set(auth(user.accessToken))
        .expect(200);

      await ctx
        .http()
        .delete(`/api/orders/${created.body.id}`)
        .set(auth(user.accessToken))
        .expect(400);
    });

    it('does not let one user cancel another’s order', async () => {
      const alice = await registerUserWithAccount(ctx);
      const created = await placeOrder(alice).expect(201);
      const bob = await registerUser(ctx);

      await ctx
        .http()
        .delete(`/api/orders/${created.body.id}`)
        .set(auth(bob.accessToken))
        .expect(404);

      const order = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: created.body.id },
      });
      expect(order.state).not.toBe('CANCELED');
    });

    it('does not list another user’s orders', async () => {
      const alice = await registerUserWithAccount(ctx);
      await placeOrder(alice).expect(201);
      const bob = await registerUser(ctx);

      const response = await ctx
        .http()
        .get('/api/orders')
        .set(auth(bob.accessToken))
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('writes an audit entry for every placed order', async () => {
      const user = await registerUserWithAccount(ctx);
      await placeOrder(user).expect(201);

      const log = await waitFor(() =>
        ctx.prisma.auditLog.findFirst({
          where: { userId: user.id, action: 'order.place' },
        }),
      );
      expect(log.success).toBe(true);
    });
  });
});
