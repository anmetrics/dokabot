import {
  createTestApp,
  registerUser,
  registerUserWithAccount,
  resetDatabase,
  TestContext,
  waitFor,
} from './helpers';

describe('Auto-invest (e2e)', () => {
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

  const enable = (
    user: { accessToken: string; accountId: string },
    body: Record<string, unknown> = {},
  ) =>
    ctx
      .http()
      .post('/api/auto-invest/enable')
      .set(auth(user.accessToken))
      .send({
        exchangeAccountId: user.accountId,
        profile: 'BALANCED',
        budgetUsd: 1000,
        ...body,
      });

  describe('presets', () => {
    it('publishes the three risk profiles', async () => {
      const user = await registerUser(ctx);
      const response = await ctx
        .http()
        .get('/api/auto-invest/presets')
        .set(auth(user.accessToken))
        .expect(200);

      expect(response.body.map((p: any) => p.profile)).toEqual([
        'CONSERVATIVE',
        'BALANCED',
        'GROWTH',
      ]);
    });

    it('gives each profile weights that sum to the whole budget', async () => {
      const user = await registerUser(ctx);
      const response = await ctx
        .http()
        .get('/api/auto-invest/presets')
        .set(auth(user.accessToken))
        .expect(200);

      for (const preset of response.body) {
        const total = preset.legs.reduce((sum: number, leg: any) => sum + leg.weight, 0);
        // Anything else silently under- or over-invests the user's money.
        expect(total).toBeCloseTo(1, 6);
      }
    });

    it('only uses strategies that actually exist', async () => {
      const user = await registerUser(ctx);
      const presets = await ctx
        .http()
        .get('/api/auto-invest/presets')
        .set(auth(user.accessToken))
        .expect(200);
      const catalog = await ctx
        .http()
        .get('/api/strategies')
        .set(auth(user.accessToken))
        .expect(200);

      const known = catalog.body.map((s: any) => s.key);
      for (const preset of presets.body) {
        for (const leg of preset.legs) {
          expect(known).toContain(leg.strategyKey);
        }
      }
    });

    it('spreads each profile across more than one strategy', async () => {
      const user = await registerUser(ctx);
      const response = await ctx
        .http()
        .get('/api/auto-invest/presets')
        .set(auth(user.accessToken))
        .expect(200);

      for (const preset of response.body) {
        const strategies = new Set(preset.legs.map((l: any) => l.strategyKey));
        // A trend follower and a mean-reverter lose in opposite markets — that is
        // the entire reason to run a portfolio instead of one bot.
        expect(strategies.size).toBeGreaterThan(1);
      }
    });

    it('requires authentication', async () => {
      await ctx.http().get('/api/auto-invest/presets').expect(401);
    });
  });

  describe('enabling', () => {
    it('creates and starts the whole portfolio from one call', async () => {
      const user = await registerUserWithAccount(ctx);
      const response = await enable(user).expect(201);

      expect(response.body.enabled).toBe(true);
      expect(response.body.profile).toBe('BALANCED');
      expect(response.body.botCount).toBe(4);
      expect(response.body.runningCount).toBe(4);
    });

    it('defaults to paper trading', async () => {
      const user = await registerUserWithAccount(ctx);
      const response = await enable(user).expect(201);
      // Real money is never the default, not even behind a one-click feature.
      expect(response.body.isPaper).toBe(true);
    });

    it('honours an explicit choice to trade real money', async () => {
      const user = await registerUserWithAccount(ctx);
      const response = await enable(user, { isPaper: false }).expect(201);
      expect(response.body.isPaper).toBe(false);
    });

    it('splits the budget by weight rather than concentrating it', async () => {
      const user = await registerUserWithAccount(ctx);
      await enable(user, { budgetUsd: 1000 }).expect(201);

      const bots = await ctx.prisma.bot.findMany({ where: { userId: user.id } });
      const sizes = bots.map(
        (b) => Number((b.config as any).orderSizeUsd),
      );

      expect(sizes.every((s) => s > 0)).toBe(true);
      // No single leg may hold more than half the budget.
      expect(Math.max(...sizes)).toBeLessThan(500);
    });

    it('gives every bot a loss limit derived from the profile', async () => {
      const user = await registerUserWithAccount(ctx);
      await enable(user, { profile: 'CONSERVATIVE', budgetUsd: 1000 }).expect(201);

      const bots = await ctx.prisma.bot.findMany({ where: { userId: user.id } });
      for (const bot of bots) {
        expect(bot.maxLossUsd).not.toBeNull();
        expect(Number(bot.maxLossUsd)).toBeGreaterThan(0);
      }
    });

    it('replaces the old portfolio when the profile changes', async () => {
      const user = await registerUserWithAccount(ctx);
      await enable(user, { profile: 'CONSERVATIVE' }).expect(201);
      const after = await enable(user, { profile: 'GROWTH' }).expect(201);

      expect(after.body.profile).toBe('GROWTH');
      // Leaving the old bots running would trade against a budget that is gone.
      expect(after.body.botCount).toBe(4);
      const bots = await ctx.prisma.bot.findMany({ where: { userId: user.id } });
      expect(bots).toHaveLength(4);
    });

    it('refuses an unknown risk profile', async () => {
      const user = await registerUserWithAccount(ctx);
      await enable(user, { profile: 'YOLO' }).expect(400);
    });

    it('refuses a budget below the minimum', async () => {
      const user = await registerUserWithAccount(ctx);
      await enable(user, { budgetUsd: 5 }).expect(400);
    });

    it('refuses an exchange account that is not active', async () => {
      const user = await registerUserWithAccount(ctx);
      await ctx.prisma.exchangeAccount.update({
        where: { id: user.accountId },
        data: { status: 'INVALID' },
      });

      await enable(user).expect(400);
      expect(await ctx.prisma.bot.count()).toBe(0);
    });

    it('refuses another user’s exchange account', async () => {
      const alice = await registerUserWithAccount(ctx);
      const bob = await registerUser(ctx);

      await ctx
        .http()
        .post('/api/auto-invest/enable')
        .set(auth(bob.accessToken))
        .send({
          exchangeAccountId: alice.accountId,
          profile: 'BALANCED',
          budgetUsd: 1000,
        })
        .expect(404);
    });

    it('records the decision in the audit trail', async () => {
      const user = await registerUserWithAccount(ctx);
      await enable(user).expect(201);

      const log = await waitFor(() =>
        ctx.prisma.auditLog.findFirst({
          where: { userId: user.id, action: 'auto_invest.enable' },
        }),
      );
      expect((log.metadata as any).profile).toBe('BALANCED');
    });
  });

  describe('disabling', () => {
    it('stops every managed bot', async () => {
      const user = await registerUserWithAccount(ctx);
      await enable(user).expect(201);

      const response = await ctx
        .http()
        .post('/api/auto-invest/disable')
        .set(auth(user.accessToken))
        .expect(201);

      expect(response.body.enabled).toBe(false);
      expect(response.body.runningCount).toBe(0);
      // Stopped, not deleted: the user can look at what it did.
      expect(response.body.botCount).toBe(4);
    });

    it('refuses when it was never enabled', async () => {
      const user = await registerUserWithAccount(ctx);
      await ctx
        .http()
        .post('/api/auto-invest/disable')
        .set(auth(user.accessToken))
        .expect(400);
    });
  });

  describe('isolation from hand-made bots', () => {
    it('leaves a user’s own bots alone', async () => {
      const user = await registerUserWithAccount(ctx);

      const manual = await ctx
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

      await enable(user).expect(201);
      const status = await ctx
        .http()
        .get('/api/auto-invest')
        .set(auth(user.accessToken))
        .expect(200);

      // The manual bot is neither counted nor touched.
      expect(status.body.botCount).toBe(4);
      expect(
        await ctx.prisma.bot.findUnique({ where: { id: manual.body.id } }),
      ).not.toBeNull();
    });

    it('does not delete a hand-made bot when the profile is replaced', async () => {
      const user = await registerUserWithAccount(ctx);
      const manual = await ctx
        .http()
        .post('/api/bots')
        .set(auth(user.accessToken))
        .send({
          exchangeAccountId: user.accountId,
          strategyKey: 'macd-cross',
          symbol: 'ETHUSDT',
          timeframe: '1h',
        })
        .expect(201);

      await enable(user, { profile: 'CONSERVATIVE' }).expect(201);
      await enable(user, { profile: 'GROWTH' }).expect(201);

      expect(
        await ctx.prisma.bot.findUnique({ where: { id: manual.body.id } }),
      ).not.toBeNull();
    });

    it('does not expose another user’s portfolio', async () => {
      const alice = await registerUserWithAccount(ctx);
      await enable(alice).expect(201);
      const bob = await registerUser(ctx);

      const status = await ctx
        .http()
        .get('/api/auto-invest')
        .set(auth(bob.accessToken))
        .expect(200);

      expect(status.body.enabled).toBe(false);
      expect(status.body.botCount).toBe(0);
    });
  });
});
