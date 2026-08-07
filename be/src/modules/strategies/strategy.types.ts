import { Candle } from '../exchange/exchange.types';

/** A single tunable knob, rendered as one form field in the UI. */
export type ParamSpec =
  | {
      key: string;
      label: string;
      type: 'number';
      default: number;
      min: number;
      max: number;
      step?: number;
      /** Shown under the field. Say what the number *does*, not what it is. */
      help?: string;
      /** Renders as a percentage field; the stored value stays a fraction. */
      unit?: '%' | 'x' | 'bars' | 'USD';
    }
  | {
      key: string;
      label: string;
      type: 'boolean';
      default: boolean;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: 'enum';
      default: string;
      options: { value: string; label: string }[];
      help?: string;
    };

export type StrategyCategory =
  | 'momentum'
  | 'mean-reversion'
  | 'trend'
  | 'volatility'
  | 'breakout';

export type SignalAction = 'BUY' | 'SELL' | 'HOLD';

export type Signal = {
  action: SignalAction;
  /** 0–1. Lets the caller size a position or ignore weak signals. */
  confidence: number;
  /** Human-readable justification, surfaced in the UI and the audit trail. */
  reason: string;
  /** Indicator values behind the decision, for charting and debugging. */
  indicators?: Record<string, number>;
};

export const HOLD = (reason: string): Signal => ({
  action: 'HOLD',
  confidence: 0,
  reason,
});

export type StrategyParams = Record<string, number | boolean | string>;

/**
 * A strategy is a pure function of (candles, params) → signal.
 *
 * Purity is the point: it makes strategies backtestable, unit-testable and safe to
 * run in any worker, and it keeps order placement — the part that spends money —
 * out of strategy code entirely.
 */
export type StrategyDefinition = {
  key: string;
  name: string;
  description: string;
  category: StrategyCategory;
  /** Fewest candles the strategy needs before it can say anything. */
  minCandles: number;
  params: ParamSpec[];
  evaluate: (candles: Candle[], params: StrategyParams) => Signal;
};
