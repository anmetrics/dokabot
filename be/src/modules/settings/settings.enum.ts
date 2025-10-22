import keyMirror from '../common/helpers/keyMirror';

export const SETTING_KEY = keyMirror({
  ENABLED: null,
  MAX_BNB_PRICE: null,
  MAX_SOL_PRICE: null,
  MAX_BTC_PRICE: null,
});

export type SETTING_KEY = keyof typeof SETTING_KEY;
