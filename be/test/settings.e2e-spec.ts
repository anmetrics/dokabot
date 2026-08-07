import {
  createTestApp,
  registerUser,
  registerUserWithAccount,
  resetDatabase,
  TestContext,
  waitFor,
} from './helpers';

describe('Settings (e2e)', () => {
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
  const oversold = () =>
    candles([...Array.from({ length: 60 }, (_, i) => 300 - i * 3), 125]);

  const startBot = async (user: { accessToken: string; accountId: string }) => {
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
        config: { orderSizeUsd: 500 },
      })
      .expect(201);
    await ctx
      .http()
      .post(`/api/bots/${created.body.id}/start`)
      .set(auth(user.accessToken))
      .expect(201);
    return ctx.prisma.bot.findUniqueOrThrow({ where: { id: created.body.id } });
  };

  describe('defaults', () => {
    it('creates the settings row on first read', async () => {
      const user = await registerUser(ctx);
      const response = await ctx
        .http()
        .get('/api/settings')
        .set(auth(user.accessToken))
        .expect(200);

      expect(Number(response.body.defaultOrderSizeUsd)).toBe(50);
      expect(response.body.symbolRules).toEqual([]);
      expect(response.body.tradingPaused).toBe(false);
    });

    it('is per user, not global', async () => {
      const alice = await registerUser(ctx);
      const bob = await registerUser(ctx);

      await ctx
        .http()
        .patch('/api/settings')
        .set(auth(alice.accessToken))
        .send({ defaultOrderSizeUsd: 999 })
        .expect(200);

      const bobSettings = await ctx
        .http()
        .get('/api/settings')
        .set(auth(bob.accessToken))
        .expect(200);

      // The old design had one global row; this is what replacing it must buy us.
      expect(Number(bobSettings.body.defaultOrderSizeUsd)).toBe(50);
    });

    it('applies the user’s defaults to a new bot', async () => {
      const user = await registerUserWithAccount(ctx);
      await ctx
        .http()
        .patch('/api/settings')
        .set(auth(user.accessToken))
        .send({
          defaultOrderSizeUsd: 250,
          defaultTakeProfitPercent: 7,
          defaultStopLossPercent: 3,
        })
        .expect(200);

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

      expect(bot.body.config.orderSizeUsd).toBe(250);
      expect(bot.body.config.takeProfitPercent).toBe(7);
    });

    it('lets an explicit bot setting override the default', async () => {
      const user = await registerUserWithAccount(ctx);
      await ctx
        .http()
        .patch('/api/settings')
        .set(auth(user.accessToken))
        .send({ defaultOrderSizeUsd: 250 })
        .expect(200);

      const bot = await ctx
        .http()
        .post('/api/bots')
        .set(auth(user.accessToken))
        .send({
          exchangeAccountId: user.accountId,
          strategyKey: 'rsi-reversal',
          symbol: 'BTCUSDT',
          timeframe: '5m',
          config: { orderSizeUsd: 33 },
        })
        .expect(201);

      expect(bot.body.config.orderSizeUsd).toBe(33);
    });

    it('enforces the user’s own bot limit', async () => {
      const user = await registerUserWithAccount(ctx);
      await ctx
        .http()
        .patch('/api/settings')
        .set(auth(user.accessToken))
        .send({ maxConcurrentBots: 1 })
        .expect(200);

      const create = () =>
        ctx
          .http()
          .post('/api/bots')
          .set(auth(user.accessToken))
          .send({
            exchangeAccountId: user.accountId,
            strategyKey: 'rsi-reversal',
            symbol: 'BTCUSDT',
            timeframe: '5m',
          });

      await create().expect(201);
      await create().expect(400);
    });
  });

  describe('symbol rules', () => {
    it('accepts an unbounded list of pairs', async () => {
      const user = await registerUser(ctx);
      const rules = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'].map(
        (symbol) => ({
          symbol,
          maxBuyPrice: 100,
          minBuyPrice: 0,
          maxSellPrice: 0,
          minSellPrice: 0,
          enabled: true,
        }),
      );

      const response = await ctx
        .http()
        .patch('/api/settings')
        .set(auth(user.accessToken))
        .send({ symbolRules: rules })
        .expect(200);

      // The old design had one hardcoded field per coin; adding a market meant a
      // schema change.
      expect(response.body.symbolRules).toHaveLength(5);
    });

    it('rejects a duplicated pair', async () => {
      const user = await registerUser(ctx);
      const rule = {
        symbol: 'BTCUSDT',
        maxBuyPrice: 100,
        minBuyPrice: 0,
        maxSellPrice: 0,
        minSellPrice: 0,
        enabled: true,
      };

      await ctx
        .http()
        .patch('/api/settings')
        .set(auth(user.accessToken))
        .send({ symbolRules: [rule, rule] })
        .expect(400);
    });

    it('rejects bounds that cross', async () => {
      const user = await registerUser(ctx);
      await ctx
        .http()
        .patch('/api/settings')
        .set(auth(user.accessToken))
        .send({
          symbolRules: [
            {
              symbol: 'BTCUSDT',
              minBuyPrice: 200,
              maxBuyPrice: 100,
              maxSellPrice: 0,
              minSellPrice: 0,
              enabled: true,
            },
          ],
        })
        // Crossed bounds would silently block every order on that pair.
        .expect(400);
    });

    it('rejects a malformed symbol', async () => {
      const user = await registerUser(ctx);
      await ctx
        .http()
        .patch('/api/settings')
        .set(auth(user.accessToken))
        .send({
          symbolRules: [
            {
              symbol: 'btc/usdt',
              maxBuyPrice: 0,
              minBuyPrice: 0,
              maxSellPrice: 0,
              minSellPrice: 0,
              enabled: true,
            },
          ],
        })
        .expect(400);
    });

    it('blocks a buy above the account-wide ceiling for that pair', async () => {
      const user = await registerUserWithAccount(ctx);
      const bot = await startBot(user);
      await ctx
        .http()
        .patch('/api/settings')
        .set(auth(user.accessToken))
        .send({
          symbolRules: [
            {
              symbol: 'BTCUSDT',
              maxBuyPrice: 100, // last close is 125
              minBuyPrice: 0,
              maxSellPrice: 0,
              minSellPrice: 0,
              enabled: true,
            },
          ],
        })
        .expect(200);

      ctx.fake.candles = oversold();
      expect(await runner.runBot(bot)).toBe(false);
      expect(ctx.fake.placed).toHaveLength(0);
    });

    it('ignores a rule that is switched off', async () => {
      const user = await registerUserWithAccount(ctx);
      const bot = await startBot(user);
      await ctx
        .http()
        .patch('/api/settings')
        .set(auth(user.accessToken))
        .send({
          symbolRules: [
            {
              symbol: 'BTCUSDT',
              maxBuyPrice: 100,
              minBuyPrice: 0,
              maxSellPrice: 0,
              minSellPrice: 0,
              enabled: false,
            },
          ],
        })
        .expect(200);

      ctx.fake.candles = oversold();
      expect(await runner.runBot(bot)).toBe(true);
    });

    it('leaves other pairs untouched', async () => {
      const user = await registerUserWithAccount(ctx);
      const bot = await startBot(user);
      await ctx
        .http()
        .patch('/api/settings')
        .set(auth(user.accessToken))
        .send({
          symbolRules: [
            {
              symbol: 'ETHUSDT',
              maxBuyPrice: 1,
              minBuyPrice: 0,
              maxSellPrice: 0,
              minSellPrice: 0,
              enabled: true,
            },
          ],
        })
        .expect(200);

      ctx.fake.candles = oversold();
      expect(await runner.runBot(bot)).toBe(true);
    });
  });

  describe('per-user pause', () => {
    it('stops that user’s bots without an operator', async () => {
      const user = await registerUserWithAccount(ctx);
      const bot = await startBot(user);
      await ctx
        .http()
        .patch('/api/settings')
        .set(auth(user.accessToken))
        .send({ tradingPaused: true })
        .expect(200);

      ctx.fake.candles = oversold();
      expect(await runner.runBot(bot)).toBe(false);

      const updated = await ctx.prisma.bot.findUniqueOrThrow({ where: { id: bot.id } });
      expect(updated.lastError).toMatch(/tạm dừng/i);
    });

    it('does not affect another user', async () => {
      const alice = await registerUserWithAccount(ctx);
      const bob = await registerUserWithAccount(ctx);
      const bobBot = await startBot(bob);

      await ctx
        .http()
        .patch('/api/settings')
        .set(auth(alice.accessToken))
        .send({ tradingPaused: true })
        .expect(200);

      ctx.fake.candles = oversold();
      expect(await runner.runBot(bobBot)).toBe(true);
    });
  });

  describe('security', () => {
    it('changes the password and kills every session', async () => {
      const user = await registerUser(ctx);

      await ctx
        .http()
        .post('/api/settings/change-password')
        .set(auth(user.accessToken))
        .send({
          currentPassword: 'CorrectHorse123',
          newPassword: 'BrandNewSecret456',
        })
        .expect(201);

      // Changing a password is what you do when you suspect a compromise.
      await ctx
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);

      await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: user.email, password: 'BrandNewSecret456' })
        .expect(201);
    });

    it('refuses a wrong current password', async () => {
      const user = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/settings/change-password')
        .set(auth(user.accessToken))
        .send({ currentPassword: 'WrongPassword12', newPassword: 'BrandNewSecret456' })
        .expect(401);
    });

    it('refuses reusing the same password', async () => {
      const user = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/settings/change-password')
        .set(auth(user.accessToken))
        .send({
          currentPassword: 'CorrectHorse123',
          newPassword: 'CorrectHorse123',
        })
        .expect(400);
    });

    it('refuses a weak new password', async () => {
      const user = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/settings/change-password')
        .set(auth(user.accessToken))
        .send({ currentPassword: 'CorrectHorse123', newPassword: 'short' })
        .expect(400);
    });

    it('lists sessions without exposing any token material', async () => {
      const user = await registerUser(ctx);
      const response = await ctx
        .http()
        .get('/api/settings/sessions')
        .set(auth(user.accessToken))
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);
      const serialised = JSON.stringify(response.body);
      expect(serialised).not.toContain(user.refreshToken);
      expect(response.body[0]).not.toHaveProperty('tokenHash');
    });

    it('revokes a single session', async () => {
      const user = await registerUser(ctx);
      const sessions = await ctx
        .http()
        .get('/api/settings/sessions')
        .set(auth(user.accessToken))
        .expect(200);

      await ctx
        .http()
        .delete(`/api/settings/sessions/${sessions.body[0].id}`)
        .set(auth(user.accessToken))
        .expect(200);

      await ctx
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);
    });

    it('cannot revoke another user’s session', async () => {
      const alice = await registerUser(ctx);
      const bob = await registerUser(ctx);
      const aliceSessions = await ctx
        .http()
        .get('/api/settings/sessions')
        .set(auth(alice.accessToken))
        .expect(200);

      await ctx
        .http()
        .delete(`/api/settings/sessions/${aliceSessions.body[0].id}`)
        .set(auth(bob.accessToken))
        .expect(400);
    });

    it('shows the user their own activity only', async () => {
      const alice = await registerUser(ctx);
      const bob = await registerUser(ctx);

      await waitFor(() =>
        ctx.prisma.auditLog.findFirst({ where: { userId: alice.id } }),
      );

      const response = await ctx
        .http()
        .get('/api/settings/activity')
        .set(auth(bob.accessToken))
        .expect(200);

      for (const entry of response.body) {
        expect(entry.action).toEqual(expect.any(String));
      }
      const alicesEntries = await ctx.prisma.auditLog.count({
        where: { userId: alice.id },
      });
      expect(alicesEntries).toBeGreaterThan(0);
      expect(response.body.length).toBeLessThan(alicesEntries + 5);
    });
  });

  describe('access control', () => {
    it.each([
      ['GET', '/api/settings'],
      ['GET', '/api/settings/sessions'],
      ['GET', '/api/settings/activity'],
    ])('requires authentication for %s %s', async (method, path) => {
      await ctx
        .http()
        [method.toLowerCase() as 'get'](path)
        .expect(401);
    });
  });
});
