import { createTestApp, TestContext } from './helpers';

describe('Health (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('answers liveness without authentication', async () => {
    // A probe that needs a token cannot be used by a load balancer.
    const response = await ctx.http().get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('reports readiness with its dependency checks', async () => {
    const response = await ctx.http().get('/api/health/ready').expect(200);
    expect(response.body.checks.database).toBe('ok');
    expect(response.body.tradingEnabled).toBe(true);
  });
});
