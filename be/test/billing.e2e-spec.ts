import { privateKeyToAccount } from 'viem/accounts';
import {
  createTestApp,
  registerUser,
  resetDatabase,
  TestContext,
} from './helpers';

/** Deterministic throwaway key — test fixture only, never used anywhere real. */
const TEST_KEY =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const account = privateKeyToAccount(TEST_KEY);

describe('Billing (e2e)', () => {
  let ctx: TestContext;
  let listener: import('../src/modules/billing/payment-listener.service').PaymentListenerService;
  let subscriptions: import('../src/modules/billing/subscription.service').SubscriptionService;

  beforeAll(async () => {
    ctx = await createTestApp();
    const { PaymentListenerService } = await import(
      '../src/modules/billing/payment-listener.service'
    );
    const { SubscriptionService } = await import(
      '../src/modules/billing/subscription.service'
    );
    listener = ctx.app.get(PaymentListenerService);
    subscriptions = ctx.app.get(SubscriptionService);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Links `account`'s address to the user by producing a real signature. */
  const linkWallet = async (user: { accessToken: string }) => {
    const challenge = await ctx
      .http()
      .post('/api/billing/wallets/challenge')
      .set(auth(user.accessToken))
      .send({ address: account.address })
      .expect(201);

    const signature = await account.signMessage({
      message: challenge.body.message,
    });

    await ctx
      .http()
      .post('/api/billing/wallets/verify')
      .set(auth(user.accessToken))
      .send({ address: account.address, signature })
      .expect(201);

    return account.address.toLowerCase();
  };

  const chargedLog = (overrides: Record<string, unknown> = {}) => ({
    eventName: 'Charged',
    args: {
      user: account.address,
      // 4 USDT at 18 decimals — the decimals BSC-USD actually uses.
      amount: 4n * 10n ** 18n,
      chargeCount: 1,
      timestamp: Math.floor(Date.now() / 1000),
    },
    blockNumber: 100n,
    transactionHash: '0xaaa',
    logIndex: 0,
    ...overrides,
  });

  describe('plan catalogue', () => {
    it('publishes the price and the token the checkout must use', async () => {
      const user = await registerUser(ctx);
      const response = await ctx
        .http()
        .get('/api/billing/plan')
        .set(auth(user.accessToken))
        .expect(200);

      expect(response.body.tiers.find((t: any) => t.tier === 'PRO').priceUsd).toBe(4);
      expect(response.body.periodDays).toBe(30);
      // Assuming 6 decimals here would charge a millionth of the intended amount.
      expect(response.body.token.decimals).toBe(18);
    });

    it('requires authentication', async () => {
      await ctx.http().get('/api/billing/plan').expect(401);
    });
  });

  describe('wallet ownership', () => {
    it('accepts a valid signature', async () => {
      const user = await registerUser(ctx);
      const address = await linkWallet(user);

      const wallets = await ctx
        .http()
        .get('/api/billing/wallets')
        .set(auth(user.accessToken))
        .expect(200);

      expect(wallets.body[0].address).toBe(address);
      expect(wallets.body[0].verifiedAt).not.toBeNull();
    });

    it('rejects a signature from a different key', async () => {
      const user = await registerUser(ctx);
      const challenge = await ctx
        .http()
        .post('/api/billing/wallets/challenge')
        .set(auth(user.accessToken))
        .send({ address: account.address })
        .expect(201);

      const impostor = privateKeyToAccount(
        '0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61',
      );
      const signature = await impostor.signMessage({
        message: challenge.body.message,
      });

      await ctx
        .http()
        .post('/api/billing/wallets/verify')
        .set(auth(user.accessToken))
        .send({ address: account.address, signature })
        .expect(400);
    });

    it('rejects a signature over a different message', async () => {
      const user = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/billing/wallets/challenge')
        .set(auth(user.accessToken))
        .send({ address: account.address })
        .expect(201);

      // Without the nonce binding, any signature the user ever made for this app
      // could be replayed to claim the wallet.
      const signature = await account.signMessage({ message: 'gm' });

      await ctx
        .http()
        .post('/api/billing/wallets/verify')
        .set(auth(user.accessToken))
        .send({ address: account.address, signature })
        .expect(400);
    });

    it('refuses to link a wallet another account already owns', async () => {
      const alice = await registerUser(ctx);
      await linkWallet(alice);

      const bob = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/billing/wallets/challenge')
        .set(auth(bob.accessToken))
        .send({ address: account.address })
        .expect(400);
    });

    it('rejects a malformed address', async () => {
      const user = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/billing/wallets/challenge')
        .set(auth(user.accessToken))
        .send({ address: 'not-an-address' })
        .expect(400);
    });

    it('rotates the nonce so the same signature cannot be replayed', async () => {
      const user = await registerUser(ctx);
      const challenge = await ctx
        .http()
        .post('/api/billing/wallets/challenge')
        .set(auth(user.accessToken))
        .send({ address: account.address })
        .expect(201);
      const signature = await account.signMessage({
        message: challenge.body.message,
      });

      await ctx
        .http()
        .post('/api/billing/wallets/verify')
        .set(auth(user.accessToken))
        .send({ address: account.address, signature })
        .expect(201);

      await ctx
        .http()
        .post('/api/billing/wallets/verify')
        .set(auth(user.accessToken))
        .send({ address: account.address, signature })
        .expect(400);
    });
  });

  describe('applying an on-chain charge', () => {
    it('grants Pro for 30 days', async () => {
      const user = await registerUser(ctx);
      await linkWallet(user);

      await listener.handle(chargedLog());

      const status = await ctx
        .http()
        .get('/api/billing')
        .set(auth(user.accessToken))
        .expect(200);

      expect(status.body.tier).toBe('PRO');
      expect(status.body.isPro).toBe(true);

      const days =
        (new Date(status.body.currentPeriodEnd).getTime() -
          new Date(status.body.currentPeriodStart).getTime()) /
        86_400_000;
      expect(Math.round(days)).toBe(30);
    });

    it('converts the raw amount using the token’s 18 decimals', async () => {
      const user = await registerUser(ctx);
      await linkWallet(user);

      await listener.handle(chargedLog());

      const payments = await ctx
        .http()
        .get('/api/billing/payments')
        .set(auth(user.accessToken))
        .expect(200);

      expect(Number(payments.body[0].amountUsd)).toBe(4);
    });

    it('is idempotent on (txHash, logIndex)', async () => {
      const user = await registerUser(ctx);
      await linkWallet(user);

      await listener.handle(chargedLog());
      const first = await subscriptions.get(user.id);

      // A backfill overlapping the live stream delivers the same log twice.
      await listener.handle(chargedLog());
      const second = await subscriptions.get(user.id);

      expect(await ctx.prisma.payment.count()).toBe(1);
      expect(second.currentPeriodEnd).toEqual(first.currentPeriodEnd);
    });

    it('treats a different log in the same transaction as a separate payment', async () => {
      const user = await registerUser(ctx);
      await linkWallet(user);

      await listener.handle(chargedLog({ logIndex: 0 }));
      await listener.handle(chargedLog({ logIndex: 1 }));

      expect(await ctx.prisma.payment.count()).toBe(2);
    });

    it('stacks a renewal onto the remaining period instead of resetting it', async () => {
      const user = await registerUser(ctx);
      await linkWallet(user);

      await listener.handle(chargedLog());
      const first = await subscriptions.get(user.id);

      await listener.handle(chargedLog({ transactionHash: '0xbbb' }));
      const second = await subscriptions.get(user.id);

      // Paying early must not throw away the days already bought.
      expect(second.currentPeriodEnd!.getTime()).toBeGreaterThan(
        first.currentPeriodEnd!.getTime(),
      );
    });

    it('ignores an event from a wallet nobody has proven', async () => {
      const user = await registerUser(ctx);
      // No linkWallet: the payment is real but cannot be attributed.
      await listener.handle(chargedLog());

      expect(await ctx.prisma.payment.count()).toBe(0);
      expect(await subscriptions.hasPro(user.id)).toBe(false);
    });

    it('does not credit a different user’s account', async () => {
      const alice = await registerUser(ctx);
      const bob = await registerUser(ctx);
      await linkWallet(alice);

      await listener.handle(chargedLog());

      expect(await subscriptions.hasPro(alice.id)).toBe(true);
      expect(await subscriptions.hasPro(bob.id)).toBe(false);
    });
  });

  describe('subscribe and cancel events', () => {
    it('records an opt-in before any payment, without granting Pro', async () => {
      const user = await registerUser(ctx);
      await linkWallet(user);

      await listener.handle({
        eventName: 'Subscribed',
        args: { user: account.address, timestamp: 1 },
        blockNumber: 1n,
        transactionHash: '0xccc',
        logIndex: 0,
      });

      // Opting in is not paying.
      expect(await subscriptions.hasPro(user.id)).toBe(false);
    });

    it('keeps access to the end of the paid period after cancelling', async () => {
      const user = await registerUser(ctx);
      await linkWallet(user);
      await listener.handle(chargedLog());

      await listener.handle({
        eventName: 'Unsubscribed',
        args: { user: account.address, timestamp: 2 },
        blockNumber: 2n,
        transactionHash: '0xddd',
        logIndex: 0,
      });

      const subscription = await subscriptions.get(user.id);
      expect(subscription.status).toBe('CANCELLED');
      // They paid for the month; cancelling does not refund it, so it must not
      // revoke it either.
      expect(subscriptions.isProActive(subscription)).toBe(true);
    });
  });

  describe('lapse handling', () => {
    it('moves a lapsed subscription into grace, keeping access', async () => {
      const user = await registerUser(ctx);
      await linkWallet(user);
      await listener.handle(chargedLog());

      await ctx.prisma.subscription.update({
        where: { userId: user.id },
        data: { currentPeriodEnd: new Date(Date.now() - 60_000) },
      });

      await subscriptions.reconcileLapsed();
      const subscription = await subscriptions.get(user.id);

      expect(subscription.status).toBe('GRACE');
      // A failed pull is usually an empty wallet, not a cancellation.
      expect(subscriptions.isProActive(subscription)).toBe(true);
    });

    it('expires once grace runs out', async () => {
      const user = await registerUser(ctx);
      await linkWallet(user);
      await listener.handle(chargedLog());

      await ctx.prisma.subscription.update({
        where: { userId: user.id },
        data: {
          status: 'GRACE',
          currentPeriodEnd: new Date(Date.now() - 10 * 86_400_000),
          graceEndsAt: new Date(Date.now() - 86_400_000),
        },
      });

      await subscriptions.reconcileLapsed();
      const subscription = await subscriptions.get(user.id);

      expect(subscription.status).toBe('EXPIRED');
      expect(subscription.tier).toBe('FREE');
      expect(subscriptions.isProActive(subscription)).toBe(false);
    });
  });

  describe('access control', () => {
    it('does not expose another user’s payments', async () => {
      const alice = await registerUser(ctx);
      await linkWallet(alice);
      await listener.handle(chargedLog());

      const bob = await registerUser(ctx);
      const payments = await ctx
        .http()
        .get('/api/billing/payments')
        .set(auth(bob.accessToken))
        .expect(200);

      expect(payments.body).toEqual([]);
    });

    it('cannot unlink a wallet belonging to someone else', async () => {
      const alice = await registerUser(ctx);
      await linkWallet(alice);
      const bob = await registerUser(ctx);

      await ctx
        .http()
        .delete(`/api/billing/wallets/${account.address}`)
        .set(auth(bob.accessToken))
        .expect(400);
    });
  });
});
