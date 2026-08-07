import {
  createTestApp,
  registerUser,
  registerUserWithAccount,
  resetDatabase,
  TestContext,
  waitFor,
} from './helpers';

const VALID_KEY = { apiKey: 'A'.repeat(64), apiSecret: 'S'.repeat(64) };

describe('Exchange accounts (e2e)', () => {
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

  describe('storing credentials', () => {
    it('encrypts the secret and never returns it', async () => {
      const user = await registerUser(ctx);

      const response = await ctx
        .http()
        .post('/api/exchange-accounts')
        .set(auth(user.accessToken))
        .send({ exchange: 'BINANCE', label: 'main', ...VALID_KEY })
        .expect(201);

      const serialised = JSON.stringify(response.body);
      expect(serialised).not.toContain(VALID_KEY.apiKey);
      expect(serialised).not.toContain(VALID_KEY.apiSecret);
      expect(response.body.apiKeyMasked).toBe('••••••••AAAA');

      const row = await ctx.prisma.exchangeAccount.findFirstOrThrow();
      expect(row.secretCiphertext).not.toContain(VALID_KEY.apiSecret);
      expect(row.wrappedDek).not.toBe('');
    });

    it('refuses a key that can withdraw funds', async () => {
      const user = await registerUser(ctx);
      ctx.fake.verifyResult = {
        ok: true,
        permissions: {
          canRead: true,
          canTrade: true,
          canWithdraw: true,
          raw: ['enableWithdrawals'],
        },
      };

      const response = await ctx
        .http()
        .post('/api/exchange-accounts')
        .set(auth(user.accessToken))
        .send({ exchange: 'BINANCE', label: 'danger', ...VALID_KEY })
        .expect(422);

      expect(response.body.message).toMatch(/withdrawal permission/i);
      // Nothing is persisted — a rejected key must not linger in the database.
      expect(await ctx.prisma.exchangeAccount.count()).toBe(0);
    });

    it('refuses a key that cannot trade', async () => {
      const user = await registerUser(ctx);
      ctx.fake.verifyResult = {
        ok: true,
        permissions: {
          canRead: true,
          canTrade: false,
          canWithdraw: false,
          raw: ['enableReading'],
        },
      };

      await ctx
        .http()
        .post('/api/exchange-accounts')
        .set(auth(user.accessToken))
        .send({ exchange: 'BINANCE', label: 'readonly', ...VALID_KEY })
        .expect(422);
    });

    it('refuses credentials the exchange rejects', async () => {
      const user = await registerUser(ctx);
      ctx.fake.verifyResult = { ok: false, reason: 'Invalid API-key' };

      await ctx
        .http()
        .post('/api/exchange-accounts')
        .set(auth(user.accessToken))
        .send({ exchange: 'BINANCE', label: 'bad', ...VALID_KEY })
        .expect(422);
    });

    it('rejects a duplicate label on the same exchange', async () => {
      const user = await registerUserWithAccount(ctx, 'main');

      await ctx
        .http()
        .post('/api/exchange-accounts')
        .set(auth(user.accessToken))
        .send({ exchange: 'BINANCE', label: 'main', ...VALID_KEY })
        .expect(409);
    });

    it('records the creation in the audit trail', async () => {
      const user = await registerUserWithAccount(ctx);

      const log = await waitFor(() =>
        ctx.prisma.auditLog.findFirst({
          where: { userId: user.id, action: 'exchange_account.create' },
        }),
      );
      expect(log.success).toBe(true);
    });
  });

  describe('tenant isolation', () => {
    it('does not list another user’s accounts', async () => {
      const alice = await registerUserWithAccount(ctx, 'alice-key');
      const bob = await registerUser(ctx);

      const response = await ctx
        .http()
        .get('/api/exchange-accounts')
        .set(auth(bob.accessToken))
        .expect(200);

      expect(response.body).toEqual([]);
      expect(
        await ctx.prisma.exchangeAccount.count({ where: { userId: alice.id } }),
      ).toBe(1);
    });

    it.each([
      ['read', 'patch' as const],
      ['verify', 'post' as const],
      ['revoke', 'delete' as const],
    ])(
      'returns 404 rather than 403 when another user tries to %s an account',
      async (_label, method) => {
        const alice = await registerUserWithAccount(ctx);
        const bob = await registerUser(ctx);

        const path =
          method === 'post'
            ? `/api/exchange-accounts/${alice.accountId}/verify`
            : `/api/exchange-accounts/${alice.accountId}`;

        // 404, not 403: telling Bob the id exists is itself a leak.
        await ctx
          .http()
          [method](path)
          .set(auth(bob.accessToken))
          .send(method === 'patch' ? { label: 'stolen' } : undefined)
          .expect(404);
      },
    );

    it('keeps the account intact after a failed cross-tenant revoke', async () => {
      const alice = await registerUserWithAccount(ctx);
      const bob = await registerUser(ctx);

      await ctx
        .http()
        .delete(`/api/exchange-accounts/${alice.accountId}`)
        .set(auth(bob.accessToken))
        .expect(404);

      const row = await ctx.prisma.exchangeAccount.findUniqueOrThrow({
        where: { id: alice.accountId },
      });
      expect(row.status).toBe('ACTIVE');
      expect(row.secretCiphertext).not.toBe('');
    });
  });

  describe('revocation', () => {
    it('wipes the ciphertext so a later backup cannot recover it', async () => {
      const user = await registerUserWithAccount(ctx);

      await ctx
        .http()
        .delete(`/api/exchange-accounts/${user.accountId}`)
        .set(auth(user.accessToken))
        .expect(200);

      const row = await ctx.prisma.exchangeAccount.findUniqueOrThrow({
        where: { id: user.accountId },
      });
      expect(row.status).toBe('REVOKED');
      expect(row.secretCiphertext).toBe('');
      expect(row.wrappedDek).toBe('');
    });

    it('hides revoked accounts from the list', async () => {
      const user = await registerUserWithAccount(ctx);

      await ctx
        .http()
        .delete(`/api/exchange-accounts/${user.accountId}`)
        .set(auth(user.accessToken))
        .expect(200);

      const response = await ctx
        .http()
        .get('/api/exchange-accounts')
        .set(auth(user.accessToken))
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('verification', () => {
    it('marks an account invalid when withdrawal is switched on later', async () => {
      const user = await registerUserWithAccount(ctx);

      // The user changed the key's permissions on the exchange after connecting it.
      ctx.fake.verifyResult = {
        ok: true,
        permissions: {
          canRead: true,
          canTrade: true,
          canWithdraw: true,
          raw: ['enableWithdrawals'],
        },
      };

      const response = await ctx
        .http()
        .post(`/api/exchange-accounts/${user.accountId}/verify`)
        .set(auth(user.accessToken))
        .expect(201);

      expect(response.body.status).toBe('INVALID');
      expect(response.body.lastError).toMatch(/withdrawal/i);
    });
  });
});
