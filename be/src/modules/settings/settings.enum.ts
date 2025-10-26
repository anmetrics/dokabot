import keyMirror from '../common/helpers/keyMirror';

export const SETTING_KEY = keyMirror({
  ENABLE_BUY: null,
  ENABLE_SELL: null,
  MAX_BNB_PRICE: null,
  MAX_SOL_PRICE: null,
  MAX_BTC_PRICE: null,
  MAX_BNB_PRICE_MINI: null,
  MAX_SOL_PRICE_MINI: null,
  MAX_BTC_PRICE_MINI: null,
});

export type SETTING_KEY = keyof typeof SETTING_KEY;

export const LIST_SYMBOL = keyMirror({
  BNBUSDT: null,
  SOLUSDT: null,
  BTCUSDT: null,
});

export function getSettingKeyBySymbol(symbol: string): SETTING_KEY | null {
  switch (symbol.toUpperCase()) {
    case LIST_SYMBOL.BNBUSDT:
      return SETTING_KEY.MAX_BNB_PRICE;
    case LIST_SYMBOL.SOLUSDT:
      return SETTING_KEY.MAX_SOL_PRICE;
    case LIST_SYMBOL.BTCUSDT:
      return SETTING_KEY.MAX_BTC_PRICE;
    default:
      return null;
  }
}

export function getSettingKeyBySymbolMini(symbol: string): SETTING_KEY | null {
  switch (symbol.toUpperCase()) {
    case LIST_SYMBOL.BNBUSDT:
      return SETTING_KEY.MAX_BNB_PRICE_MINI;
    case LIST_SYMBOL.SOLUSDT:
      return SETTING_KEY.MAX_SOL_PRICE_MINI;
    case LIST_SYMBOL.BTCUSDT:
      return SETTING_KEY.MAX_BTC_PRICE_MINI;
    default:
      return null;
  }
}
