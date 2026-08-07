import { ConfigService } from '@nestjs/config';
import { ReconcilerService } from './reconciler.service';

type Fill = { side: string; filledQuantity: string; averagePrice: string };

function makeService(bots: any[], fills: Fill[]) {
  const updates: any[] = [];
  const prisma = {
    bot: {
      findMany: jest.fn().mockResolvedValue(bots),
      update: jest.fn((args: any) => {
        updates.push(args);
        return Promise.resolve(args);
      }),
    },
    order: { findMany: jest.fn().mockResolvedValue(fills) },
  };
  const audit = { record: jest.fn() };
  const config = { get: () => 'true' } as unknown as ConfigService;

  const service = new ReconcilerService(
    prisma as any,
    {} as any,
    audit as any,
    config,
  );
  return { service, updates, audit };
}

const bot = (maxLossUsd: string) => ({
  id: 'bot-1',
  userId: 'user-1',
  maxLossUsd: { toString: () => maxLossUsd },
});

describe('ReconcilerService.enforceLossLimits', () => {
  it('stops a bot once realised loss passes its limit', async () => {
    // Bought 1 @ 100, sold 1 @ 60 ⇒ realised -40, limit 25.
    const { service, updates, audit } = makeService(
      [bot('25')],
      [
        { side: 'BUY', filledQuantity: '1', averagePrice: '100' },
        { side: 'SELL', filledQuantity: '1', averagePrice: '60' },
      ],
    );

    await service.enforceLossLimits();

    expect(updates).toHaveLength(1);
    expect(updates[0].data.status).toBe('STOPPED');
    expect(updates[0].data.lastError).toContain('-40.00');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'bot.stopped.loss_limit' }),
    );
  });

  it('leaves a bot running while the loss is within the limit', async () => {
    const { service, updates } = makeService(
      [bot('100')],
      [
        { side: 'BUY', filledQuantity: '1', averagePrice: '100' },
        { side: 'SELL', filledQuantity: '1', averagePrice: '60' },
      ],
    );

    await service.enforceLossLimits();
    expect(updates).toHaveLength(0);
  });

  it('leaves a profitable bot alone', async () => {
    const { service, updates } = makeService(
      [bot('25')],
      [
        { side: 'BUY', filledQuantity: '1', averagePrice: '100' },
        { side: 'SELL', filledQuantity: '1', averagePrice: '150' },
      ],
    );

    await service.enforceLossLimits();
    expect(updates).toHaveLength(0);
  });

  it('keeps full precision on fractional quantities', async () => {
    // 0.00000001 * 100000000 is exactly 1 in decimal, but not in binary floats.
    const { service, updates } = makeService(
      [bot('0.5')],
      [
        { side: 'BUY', filledQuantity: '0.00000001', averagePrice: '100000000' },
        { side: 'SELL', filledQuantity: '0.00000001', averagePrice: '0' },
      ],
    );

    await service.enforceLossLimits();
    expect(updates).toHaveLength(1);
    expect(updates[0].data.lastError).toContain('-1.00');
  });
});
