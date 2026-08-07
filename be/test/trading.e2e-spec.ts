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

describe('Strategies (e2e)', () => {
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

  it('publishes a catalogue the UI can build a form from', async () => {
    const user = await registerUser(ctx);
    const response = await ctx
      .http()
      .get('/api/strategies')
      .set(auth(user.accessToken))
      .expect(200);

    expect(response.body.length).toBeGreaterThanOrEqual(8);
    for (const strategy of response.body) {
      expect(strategy).toMatchObject({
        key: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        category: expect.any(String),
        params: expect.any(Array),
      });
      expect(strategy).not.toHaveProperty('evaluate');
    }
  });

  it('requires authentication to read the catalogue', async () => {
    await ctx.http().get('/api/strategies').expect(401);
  });

  it('stores a bot with defaults filled in', async () => {
    const user = await registerUserWithAccount(ctx);

    const response = await ctx
      .http()
      .post('/api/bots')
      .set(auth(user.accessToken))
      .send({
        exchangeAccountId: user.accountId,
        strategyKey: 'rsi-reversal',
        symbol: 'BTCUSDT',
        timeframe: '5m',
        config: { period: 7 },
      })
      .expect(201);

    expect(response.body.config.period).toBe(7);
    // Everything the user left blank comes back explicit, so the bot's behaviour
    // is fully described by its stored config.
    expect(response.body.config.oversold).toBe(30);
    expect(response.body.config.takeProfitPercent).toBe(2);
  });

  it('rejects a setting outside its allowed range', async () => {
    const user = await registerUserWithAccount(ctx);

    await ctx
      .http()
      .post('/api/bots')
      .set(auth(user.accessToken))
      .send({
        exchangeAccountId: user.accountId,
        strategyKey: 'rsi-reversal',
        symbol: 'BTCUSDT',
        timeframe: '5m',
        config: { period: 100000 },
      })
      .expect(400);
  });

  it('rejects a setting the strategy does not have', async () => {
    const user = await registerUserWithAccount(ctx);

    await ctx
      .http()
      .post('/api/bots')
      .set(auth(user.accessToken))
      .send({
        exchangeAccountId: user.accountId,
        strategyKey: 'rsi-reversal',
        symbol: 'BTCUSDT',
        timeframe: '5m',
        config: { leverage: 100 },
      })
      .expect(400);
  });

  it('rejects an unknown strategy', async () => {
    const user = await registerUserWithAccount(ctx);

    await ctx
      .http()
      .post('/api/bots')
      .set(auth(user.accessToken))
      .send({
        exchangeAccountId: user.accountId,
        strategyKey: 'get-rich-quick',
        symbol: 'BTCUSDT',
        timeframe: '5m',
      })
      .expect(400);
  });

  it('validates settings again when they are updated', async () => {
    const user = await registerUserWithAccount(ctx);
    const bot = await ctx
      .http()
      .post('/api/bots')
      .set(auth(user.accessToken))
      .send({
        exchangeAccountId: user.accountId,
        strategyKey: 'rsi-reversal',
        symbol: 'BTCUSDT',
        timeframe: '5m',
      })
      .expect(201);

    await ctx
      .http()
      .patch(`/api/bots/${bot.body.id}`)
      .set(auth(user.accessToken))
      .send({ config: { oversold: 999 } })
      .expect(400);

    await ctx
      .http()
      .patch(`/api/bots/${bot.body.id}`)
      .set(auth(user.accessToken))
      .send({ config: { oversold: 25 } })
      .expect(200);
  });
});

describe('Strategy runner (e2e)', () => {
  let ctx: TestContext;
  let runner: import('../src/modules/trading/strategy-runner.service').StrategyRunnerService;

  beforeAll(async () => {
    ctx = await createTestApp();
    const { StrategyRunnerService } = await import(
      '../src/modules/trading/strategy-runner.service'
    );
    runner = ctx.app.get(StrategyRunnerService);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.fake.reset();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Candle series ending in the past, so every bar counts as closed. */
  const candles = (prices: number[], intervalMs = 300_000) => {
    const end = Date.now() - intervalMs;
    return prices.map((price, i) => {
      const openTime = end - (prices.length - 1 - i) * intervalMs;
      return {
        openTime,
        open: String(i === 0 ? price : prices[i - 1]),
        high: String(price * 1.002),
        low: String(price * 0.998),
        close: String(price),
        volume: '100',
        closeTime: openTime + intervalMs - 1,
      };
    });
  };

  /** A long decline then a small bounce: deeply oversold on RSI. */
  const oversold = () =>
    candles([...Array.from({ length: 60 }, (_, i) => 300 - i * 3), 125]);

  const startBot = async (
    user: { accessToken: string; accountId: string },
    overrides: Record<string, unknown> = {},
  ) => {
    const created = await ctx
      .http()
      .post('/api/bots')
      .set(auth(user.accessToken))
      .send({
        exchangeAccountId: user.accountId,
        strategyKey: 'rsi-reversal',
        symbol: 'BTCUSDT',
        timeframe: '5m',
        isPaper: false,
        ...overrides,
      })
      .expect(201);

    await ctx
      .http()
      .post(`/api/bots/${created.body.id}/start`)
      .set(auth(user.accessToken))
      .expect(201);

    return ctx.prisma.bot.findUniqueOrThrow({ where: { id: created.body.id } });
  };

  it('turns a buy signal into an order', async () => {
    const user = await registerUserWithAccount(ctx);
    const bot = await startBot(user, { config: { orderSizeUsd: 500 } });
    ctx.fake.candles = oversold();

    const acted = await runner.runBot(bot);

    expect(acted).toBe(true);
    expect(ctx.fake.placed).toHaveLength(1);
    expect(ctx.fake.placed[0].side).toBe('BUY');
    // 500 USD at ~125 → 4 units, floored to the 0.00001 lot size.
    expect(Number(ctx.fake.placed[0].quantity)).toBeCloseTo(4, 2);
  });

  it('places at most one order per candle, however often it runs', async () => {
    const user = await registerUserWithAccount(ctx);
    const bot = await startBot(user);
    ctx.fake.candles = oversold();

    await runner.runBot(bot);
    await runner.runBot(bot);
    await runner.runBot(bot);

    // Restarts, overlapping workers and retried ticks all look like this.
    expect(ctx.fake.placed).toHaveLength(1);
    expect(await ctx.prisma.order.count()).toBe(1);
  });

  it('ignores the candle that is still forming', async () => {
    const user = await registerUserWithAccount(ctx);
    const bot = await startBot(user);

    const closed = oversold();
    // A forming bar whose close would flip the signal the other way.
    ctx.fake.candles = [
      ...closed,
      {
        openTime: Date.now(),
        open: '125',
        high: '400',
        low: '125',
        close: '400',
        volume: '100',
        closeTime: Date.now() + 300_000,
      },
    ];

    await runner.runBot(bot);

    // Acting on the forming bar is the repainting bug backtests never show.
    expect(ctx.fake.placed).toHaveLength(1);
    expect(ctx.fake.placed[0].side).toBe('BUY');
  });

  it('does nothing on a HOLD signal', async () => {
    const user = await registerUserWithAccount(ctx);
    const bot = await startBot(user);
    ctx.fake.candles = candles(
      Array.from({ length: 80 }, (_, i) => 100 + (i % 2 ? 1 : -1)),
    );

    expect(await runner.runBot(bot)).toBe(false);
    expect(ctx.fake.placed).toHaveLength(0);
  });

  it('never sells without inventory', async () => {
    const user = await registerUserWithAccount(ctx);
    const bot = await startBot(user);
    // Overbought, then a pullback: the strategy wants to sell.
    ctx.fake.candles = candles([
      ...Array.from({ length: 60 }, (_, i) => 100 + i * 3),
      270,
    ]);

    expect(await runner.runBot(bot)).toBe(false);
    expect(ctx.fake.placed).toHaveLength(0);
  });

  it('takes profit before consulting the strategy', async () => {
    const user = await registerUserWithAccount(ctx);
    const bot = await startBot(user, { config: { takeProfitPercent: 5 } });

    await ctx.prisma.order.create({
      data: {
        userId: bot.userId,
        botId: bot.id,
        exchangeAccountId: bot.exchangeAccountId,
        exchange: 'BINANCE',
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        clientOrderId: 'seed-entry',
        quantity: '1',
        filledQuantity: '1',
        averagePrice: '100',
        state: 'FILLED',
      },
    });

    // Price well above the entry, in a market the strategy itself reads as a buy.
    ctx.fake.candles = candles([
      ...Array.from({ length: 60 }, (_, i) => 300 - i * 3),
      125,
    ]);

    await runner.runBot(bot);

    expect(ctx.fake.placed).toHaveLength(1);
    expect(ctx.fake.placed[0].side).toBe('SELL');
    expect(Number(ctx.fake.placed[0].quantity)).toBe(1);
  });

  it('stops out a losing position even while the strategy says buy', async () => {
    const user = await registerUserWithAccount(ctx);
    const bot = await startBot(user, { config: { stopLossPercent: 10 } });

    await ctx.prisma.order.create({
      data: {
        userId: bot.userId,
        botId: bot.id,
        exchangeAccountId: bot.exchangeAccountId,
        exchange: 'BINANCE',
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        clientOrderId: 'seed-losing-entry',
        quantity: '2',
        filledQuantity: '2',
        averagePrice: '1000',
        state: 'FILLED',
      },
    });

    ctx.fake.candles = oversold(); // last close 125, far below the 1000 entry

    await runner.runBot(bot);

    // A stop-loss that only fires when the strategy agrees is not a stop-loss.
    expect(ctx.fake.placed).toHaveLength(1);
    expect(ctx.fake.placed[0].side).toBe('SELL');
    expect(Number(ctx.fake.placed[0].quantity)).toBe(2);
  });

  it('holds a position that is inside its risk bands', async () => {
    const user = await registerUserWithAccount(ctx);
    const bot = await startBot(user, {
      config: { takeProfitPercent: 50, stopLossPercent: 50 },
    });

    await ctx.prisma.order.create({
      data: {
        userId: bot.userId,
        botId: bot.id,
        exchangeAccountId: bot.exchangeAccountId,
        exchange: 'BINANCE',
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        clientOrderId: 'seed-neutral',
        quantity: '1',
        filledQuantity: '1',
        averagePrice: '130',
        state: 'FILLED',
      },
    });

    ctx.fake.candles = oversold();
    await runner.runBot(bot);

    // Still a BUY (adding to the position), not an exit.
    expect(ctx.fake.placed[0]?.side).toBe('BUY');
  });

  it('routes a paper bot through the whole pipeline without touching the exchange', async () => {
    const user = await registerUserWithAccount(ctx);
    const bot = await startBot(user, { isPaper: true });
    ctx.fake.candles = oversold();

    expect(await runner.runBot(bot)).toBe(true);
    expect(ctx.fake.placed).toHaveLength(0);

    const order = await ctx.prisma.order.findFirstOrThrow();
    expect(order.isPaper).toBe(true);
    expect(order.state).toBe('FILLED');
  });

  it('respects the global kill switch', async () => {
    const user = await registerUserWithAccount(ctx);
    const bot = await startBot(user);
    ctx.fake.candles = oversold();

    process.env.TRADING_KILL_SWITCH = 'true';
    try {
      await expect(runner.runBot(bot)).rejects.toThrow();
      expect(ctx.fake.placed).toHaveLength(0);
    } finally {
      process.env.TRADING_KILL_SWITCH = 'false';
    }
  });

  it('waits rather than guessing when history is short', async () => {
    const user = await registerUserWithAccount(ctx);
    const bot = await startBot(user);
    ctx.fake.candles = candles([100, 101, 102]);

    expect(await runner.runBot(bot)).toBe(false);
    const updated = await ctx.prisma.bot.findUniqueOrThrow({ where: { id: bot.id } });
    expect(updated.lastError).toMatch(/Chưa đủ nến/);
  });

  it('only runs bots that are RUNNING', async () => {
    const user = await registerUserWithAccount(ctx);
    await startBot(user); // running
    const idle = await ctx
      .http()
      .post('/api/bots')
      .set(auth(user.accessToken))
      .send({
        exchangeAccountId: user.accountId,
        strategyKey: 'rsi-reversal',
        symbol: 'ETHUSDT',
        timeframe: '5m',
      })
      .expect(201);
    ctx.fake.candles = oversold();

    const result = await runner.runAll();

    expect(result.evaluated).toBe(1);
    const untouched = await ctx.prisma.bot.findUniqueOrThrow({
      where: { id: idle.body.id },
    });
    expect(untouched.lastSignalAt).toBeNull();
  });

  it('keeps going when one bot fails', async () => {
    const user = await registerUserWithAccount(ctx);
    const broken = await startBot(user, { symbol: 'BADCOIN' });
    await startBot(user, { symbol: 'ETHUSDT' });
    ctx.fake.candles = oversold();
    ctx.fake.symbolErrors.add('BADCOIN');

    const result = await runner.runAll();

    expect(result.evaluated).toBe(2);
    // The healthy bot still traded.
    expect(ctx.fake.placed).toHaveLength(1);
    const failed = await ctx.prisma.bot.findUniqueOrThrow({ where: { id: broken.id } });
    expect(failed.lastError).toBeTruthy();
  });

  it('parks a bot that keeps failing instead of retrying forever', async () => {
    const user = await registerUserWithAccount(ctx);
    const bot = await startBot(user, { symbol: 'BADCOIN' });
    // Candles must be present, or the bot stops at "not enough history" and never
    // reaches the lookup that fails.
    ctx.fake.candles = oversold();
    ctx.fake.symbolErrors.add('BADCOIN');

    for (let i = 0; i < 5; i++) await runner.runAll();

    const parked = await ctx.prisma.bot.findUniqueOrThrow({ where: { id: bot.id } });
    expect(parked.status).toBe('ERROR');
    expect(parked.lastError).toMatch(/lỗi liên tiếp/);
  });

  it('records every executed signal in the audit trail', async () => {
    const user = await registerUserWithAccount(ctx);
    const bot = await startBot(user);
    ctx.fake.candles = oversold();

    await runner.runBot(bot);

    const log = await waitFor(() =>
      ctx.prisma.auditLog.findFirst({
        where: { userId: user.id, action: 'bot.signal.executed' },
      }),
    );
    expect((log.metadata as any).side).toBe('BUY');
  });
});
