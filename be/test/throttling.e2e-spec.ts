/**
 * Rate limiting has its own spec because it is the one behaviour every other
 * suite has to switch off — the limits are raised in .env.test so the limiter
 * never decides the outcome of a test that is about something else.
 */
process.env.THROTTLE_LOGIN_LIMIT = '3';
process.env.THROTTLE_REGISTER_LIMIT = '2';

import { createTestApp, resetDatabase, TestContext } from './helpers';

describe('Rate limiting (e2e)', () => {
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

  it('stops a login brute-force after the configured number of attempts', async () => {
    const attempt = () =>
      ctx
        .http()
        .post('/api/auth/login')
        .send({ email: 'victim@example.com', password: 'GuessGuess123' });

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await attempt();
      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
    // Credential stuffing must hit the wall well before it gets many guesses in.
    expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(3);
  });

  it('limits registration attempts', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const response = await ctx
        .http()
        .post('/api/auth/register')
        .send({ email: `flood${i}@example.com`, password: 'CorrectHorse123' });
      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
  });
});
