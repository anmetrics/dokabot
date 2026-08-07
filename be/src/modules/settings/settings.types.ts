/**
 * A price guard for one trading pair.
 *
 * The list is unbounded on purpose: the previous design had a fixed field per coin
 * (BNB, SOL, BTC, PAXG), which meant adding a market required a schema change and
 * a deploy. A user should be able to guard any pair they trade.
 *
 * Zero means "no limit" on that side, so a rule can bound one direction only.
 */
export type SymbolRule = {
  symbol: string;
  maxBuyPrice: number;
  minBuyPrice: number;
  maxSellPrice: number;
  minSellPrice: number;
  /** Turns the rule off without losing the numbers behind it. */
  enabled: boolean;
  note?: string;
};

export const EMPTY_RULE = (symbol: string): SymbolRule => ({
  symbol,
  maxBuyPrice: 0,
  minBuyPrice: 0,
  maxSellPrice: 0,
  minSellPrice: 0,
  enabled: true,
});
