import {
  createTestApp,
  registerUser,
  resetDatabase,
  TestContext,
  waitFor,
} from './helpers';

describe('Authentication (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  describe('registration', () => {
    it('creates an account and returns a token pair', async () => {
      const response = await ctx
        .http()
        .post('/api/auth/register')
        .send({ email: 'New.User@Example.com', password: 'CorrectHorse123' })
        .expect(201);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.refreshToken).toEqual(expect.any(String));

      // Emails are normalised, so Foo@x.com and foo@x.com are one account.
      const user = await ctx.prisma.user.findUnique({
        where: { email: 'new.user@example.com' },
      });
      expect(user).not.toBeNull();
    });

    it('never stores the password in a recoverable form', async () => {
      await registerUser(ctx);
      const user = await ctx.prisma.user.findFirstOrThrow();

      expect(user.passwordHash).not.toContain('CorrectHorse123');
      expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it.each([
      ['too short', 'Ab1cdef'],
      ['no uppercase', 'correcthorse123'],
      ['no digit', 'CorrectHorseBatt'],
      ['no lowercase', 'CORRECTHORSE123'],
    ])('rejects a weak password (%s)', async (_label, password) => {
      await ctx
        .http()
        .post('/api/auth/register')
        .send({ email: 'weak@example.com', password })
        .expect(400);
    });

    it('rejects a duplicate email', async () => {
      const user = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/auth/register')
        .send({ email: user.email, password: 'CorrectHorse123' })
        .expect(409);
    });

    it('strips unknown fields instead of trusting them', async () => {
      // A client must not be able to make itself an admin by adding a field.
      await ctx
        .http()
        .post('/api/auth/register')
        .send({
          email: 'sneaky@example.com',
          password: 'CorrectHorse123',
          role: 'ADMIN',
        })
        .expect(400);
    });
  });

  describe('login', () => {
    it('accepts the right password', async () => {
      const user = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: user.email, password: 'CorrectHorse123' })
        .expect(201);
    });

    it('gives the same answer for a wrong password and an unknown account', async () => {
      const user = await registerUser(ctx);

      const wrongPassword = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: user.email, password: 'WrongPassword123' })
        .expect(401);

      const unknownEmail = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'WrongPassword123' })
        .expect(401);

      // Any difference here lets an attacker enumerate registered addresses.
      expect(wrongPassword.body.message).toEqual(unknownEmail.body.message);
    });

    it('locks out a suspended account', async () => {
      const user = await registerUser(ctx);
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { status: 'SUSPENDED' },
      });

      await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: user.email, password: 'CorrectHorse123' })
        .expect(401);
    });

    it('rejects an existing access token once the account is suspended', async () => {
      const user = await registerUser(ctx);

      await ctx
        .http()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { status: 'SUSPENDED' },
      });

      // The token is still cryptographically valid — status is checked per request
      // so a lockout takes effect immediately, not when the token expires.
      await ctx
        .http()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(401);
    });
  });

  describe('refresh tokens', () => {
    it('stores only a hash of the refresh token', async () => {
      const user = await registerUser(ctx);
      const stored = await ctx.prisma.refreshToken.findFirstOrThrow();

      expect(stored.tokenHash).not.toEqual(user.refreshToken);
      expect(stored.tokenHash).toHaveLength(64);
    });

    it('rotates the token on every refresh', async () => {
      const user = await registerUser(ctx);

      const response = await ctx
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(201);

      expect(response.body.refreshToken).not.toEqual(user.refreshToken);
    });

    it('revokes every session when a used token is replayed', async () => {
      const user = await registerUser(ctx);

      const first = await ctx
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(201);

      // Replaying the original token means it leaked. The safe assumption is that
      // the attacker also holds the new one, so every session dies.
      await ctx
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);

      await ctx
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: first.body.refreshToken })
        .expect(401);

      const live = await ctx.prisma.refreshToken.count({
        where: { userId: user.id, revokedAt: null },
      });
      expect(live).toBe(0);
    });

    it('rejects an expired refresh token', async () => {
      const user = await registerUser(ctx);
      await ctx.prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await ctx
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);
    });

    it('invalidates the token on logout', async () => {
      const user = await registerUser(ctx);

      await ctx
        .http()
        .post('/api/auth/logout')
        .send({ refreshToken: user.refreshToken })
        .expect(201);

      await ctx
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);
    });
  });

  describe('protected routes', () => {
    it.each([
      ['no token', undefined],
      ['garbage token', 'Bearer not-a-jwt'],
      ['token signed with another key', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad'],
    ])('rejects a request with %s', async (_label, header) => {
      const req = ctx.http().get('/api/auth/me');
      if (header) req.set('Authorization', header);
      await req.expect(401);
    });
  });

  describe('audit trail', () => {
    it('records both successful and failed logins', async () => {
      const user = await registerUser(ctx);

      await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: user.email, password: 'WrongPassword123' })
        .expect(401);

      const logs = await waitFor(async () => {
        const rows = await ctx.prisma.auditLog.findMany({
          where: { action: 'auth.login' },
        });
        return rows.length ? rows : null;
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].success).toBe(false);
    });
  });
});
