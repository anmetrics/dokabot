import Decimal from 'decimal.js';
import {
  computePosition,
  floorToStep,
  sizeFromBudget,
  unrealisedReturn,
} from './position';

const buy = (filledQuantity: string, averagePrice: string) => ({
  side: 'BUY',
  filledQuantity,
  averagePrice,
});
const sell = (filledQuantity: string, averagePrice: string) => ({
  side: 'SELL',
  filledQuantity,
  averagePrice,
});

describe('computePosition', () => {
  it('is flat with no fills', () => {
    const position = computePosition([]);
    expect(position.quantity.toNumber()).toBe(0);
    expect(position.entryPrice.toNumber()).toBe(0);
    expect(position.realisedPnl.toNumber()).toBe(0);
  });

  it('tracks a single buy', () => {
    const position = computePosition([buy('2', '100')]);
    expect(position.quantity.toNumber()).toBe(2);
    expect(position.entryPrice.toNumber()).toBe(100);
  });

  it('averages the entry across a DCA ladder', () => {
    // 1 @ 100 and 1 @ 80 → 2 @ 90.
    const position = computePosition([buy('1', '100'), buy('1', '80')]);
    expect(position.quantity.toNumber()).toBe(2);
    expect(position.entryPrice.toNumber()).toBe(90);
  });

  it('weights the average by size, not by fill count', () => {
    // 3 @ 100 and 1 @ 60 → 4 @ 90, not @ 80.
    const position = computePosition([buy('3', '100'), buy('1', '60')]);
    expect(position.entryPrice.toNumber()).toBe(90);
  });

  it('realises profit on a full exit and goes flat', () => {
    const position = computePosition([buy('2', '100'), sell('2', '120')]);
    expect(position.quantity.toNumber()).toBe(0);
    expect(position.entryPrice.toNumber()).toBe(0);
    expect(position.realisedPnl.toNumber()).toBe(40);
  });

  it('realises loss on a full exit', () => {
    const position = computePosition([buy('2', '100'), sell('2', '90')]);
    expect(position.realisedPnl.toNumber()).toBe(-20);
  });

  it('leaves the average entry untouched after a partial exit', () => {
    const position = computePosition([
      buy('1', '100'),
      buy('1', '80'),
      sell('1', '95'),
    ]);
    expect(position.quantity.toNumber()).toBe(1);
    // Still 90: selling part of the lot does not change what the rest cost.
    expect(position.entryPrice.toNumber()).toBe(90);
    expect(position.realisedPnl.toNumber()).toBe(5);
  });

  it('re-entering after a full exit starts a fresh average', () => {
    const position = computePosition([
      buy('1', '100'),
      sell('1', '110'),
      buy('1', '50'),
    ]);
    expect(position.entryPrice.toNumber()).toBe(50);
    expect(position.realisedPnl.toNumber()).toBe(10);
  });

  it('ignores unfilled orders', () => {
    const position = computePosition([buy('0', '100'), buy('1', '50')]);
    expect(position.quantity.toNumber()).toBe(1);
    expect(position.entryPrice.toNumber()).toBe(50);
  });

  it('never goes short when a sell exceeds the holding', () => {
    // A stray oversized sell must not leave a negative quantity that corrupts
    // every later average.
    const position = computePosition([buy('1', '100'), sell('5', '120')]);
    expect(position.quantity.toNumber()).toBe(0);
    expect(position.entryPrice.toNumber()).toBe(0);
  });

  it('keeps precision that floating point would lose', () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point.
    const position = computePosition([buy('0.1', '1'), buy('0.2', '1')]);
    expect(position.quantity.toString()).toBe('0.3');
  });

  it('handles satoshi-scale quantities exactly', () => {
    const position = computePosition([
      buy('0.00000001', '100000000'),
      sell('0.00000001', '200000000'),
    ]);
    expect(position.realisedPnl.toNumber()).toBe(1);
  });
});

describe('floorToStep', () => {
  it('rounds down to the lot size', () => {
    expect(floorToStep(new Decimal('1.23456'), '0.001').toString()).toBe('1.234');
  });

  it('never rounds up — that would exceed the balance', () => {
    expect(floorToStep(new Decimal('1.999'), '1').toString()).toBe('1');
  });

  it('returns zero when the quantity is below one lot', () => {
    expect(floorToStep(new Decimal('0.0005'), '0.001').toString()).toBe('0');
  });

  it('passes the quantity through when there is no lot size', () => {
    expect(floorToStep(new Decimal('1.23456'), '0').toString()).toBe('1.23456');
  });
});

describe('sizeFromBudget', () => {
  it('converts a USD budget at the given price', () => {
    expect(sizeFromBudget(100, '50', '0.001').toString()).toBe('2');
  });

  it('rounds down to a tradable lot', () => {
    expect(sizeFromBudget(100, '3', '0.01').toString()).toBe('33.33');
  });

  it('refuses to size against a zero or negative price', () => {
    expect(sizeFromBudget(100, '0', '0.001').toNumber()).toBe(0);
    expect(sizeFromBudget(100, '-5', '0.001').toNumber()).toBe(0);
  });
});

describe('unrealisedReturn', () => {
  it('measures the gain on the open lot', () => {
    const position = computePosition([buy('1', '100')]);
    expect(unrealisedReturn(position, '110').toNumber()).toBeCloseTo(0.1, 10);
  });

  it('measures the loss on the open lot', () => {
    const position = computePosition([buy('1', '100')]);
    expect(unrealisedReturn(position, '95').toNumber()).toBeCloseTo(-0.05, 10);
  });

  it('is zero when flat, rather than dividing by zero', () => {
    expect(unrealisedReturn(computePosition([]), '100').toNumber()).toBe(0);
  });
});
