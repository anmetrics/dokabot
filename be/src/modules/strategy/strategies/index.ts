import keyMirror from '../helpers/keymirror';

export interface IStrategy {
  startAll(): Promise<void>;
  stop(): void;
}

export const STRATEGIES = keyMirror({
  EMA7_EMA99: null,
  QUANT_ENSEMBLE: null,
  RSI_REVERSAL: null,
});
