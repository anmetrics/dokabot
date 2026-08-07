import Decimal from 'decimal.js';

/** The subset of an order row this maths needs. */
export type FillLike = {
  side: string;
  filledQuantity: Decimal | string | number;
  averagePrice: Decimal | string | number;
};

export type Position = {
  /** Net base-asset quantity held. Zero means flat. */
  quantity: Decimal;
  /** Weighted average price of the open lot. Zero when flat. */
  entryPrice: Decimal;
  /** Realised profit or loss in quote currency. */
  realisedPnl: Decimal;
};

const dec = (value: Decimal | string | number): Decimal =>
  new Decimal(value.toString());

/**
 * Rebuilds the current position from the bot's fills.
 *
 * Derived rather than stored: a cached position that drifts from the order history
 * is the kind of bug that silently doubles a bet. The orders table is the record
 * the exchange also agrees with, so it is the only safe source of truth.
 *
 * Uses weighted-average cost. A sell realises PnL against the average entry and
 * leaves that average unchanged, which is what a DCA strategy expects.
 */
export function computePosition(fills: FillLike[]): Position {
  let quantity = new Decimal(0);
  let cost = new Decimal(0);
  let realisedPnl = new Decimal(0);

  for (const fill of fills) {
    const amount = dec(fill.filledQuantity);
    const price = dec(fill.averagePrice);
    if (amount.lte(0)) continue;

    if (fill.side === 'BUY') {
      quantity = quantity.plus(amount);
      cost = cost.plus(amount.times(price));
      continue;
    }

    // Selling more than we hold would make the average entry meaningless; cap it
    // so a stray fill cannot corrupt every later calculation.
    const sold = Decimal.min(amount, quantity);
    if (sold.lte(0)) {
      realisedPnl = realisedPnl.plus(amount.times(price));
      continue;
    }

    const entry = quantity.gt(0) ? cost.div(quantity) : new Decimal(0);
    realisedPnl = realisedPnl.plus(price.minus(entry).times(sold));
    cost = cost.minus(entry.times(sold));
    quantity = quantity.minus(sold);
  }

  return {
    quantity,
    entryPrice: quantity.gt(0) ? cost.div(quantity) : new Decimal(0),
    realisedPnl,
  };
}

/**
 * Rounds a quantity down to the exchange's lot size.
 *
 * Always down: rounding up can exceed the balance and get the order rejected, and
 * on a sell it would try to dispose of more than is held.
 */
export function floorToStep(quantity: Decimal, step: string): Decimal {
  const stepSize = new Decimal(step);
  if (stepSize.lte(0)) return quantity;
  return quantity.div(stepSize).floor().times(stepSize);
}

/** Converts a USD budget into a base-asset quantity at the given price. */
export function sizeFromBudget(
  budgetUsd: number,
  price: Decimal | string | number,
  stepSize: string,
): Decimal {
  const p = dec(price);
  if (p.lte(0)) return new Decimal(0);
  return floorToStep(new Decimal(budgetUsd).div(p), stepSize);
}

/** Unrealised return of the open lot, as a fraction (0.02 = +2%). */
export function unrealisedReturn(
  position: Position,
  price: Decimal | string | number,
): Decimal {
  if (position.quantity.lte(0) || position.entryPrice.lte(0)) {
    return new Decimal(0);
  }
  return dec(price).minus(position.entryPrice).div(position.entryPrice);
}
