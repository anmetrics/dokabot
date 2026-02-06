import keyMirror from '../common/helpers/keyMirror';

export const SETTING_KEY = keyMirror({
  ENABLE_BUY: null,
  ENABLE_SELL: null,
  MAX_BNB_PRICE: null,
  MAX_SOL_PRICE: null,
  MAX_BTC_PRICE: null,
  MAX_PAXG_PRICE: null,
  MAX_BNB_PRICE_MINI: null,
  MAX_SOL_PRICE_MINI: null,
  MAX_BTC_PRICE_MINI: null,
  DCA_WHEN_DROP_PERCENT: null,
  ENABLE_BUY_MINI: null,
  ENABLE_SELL_MINI: null,
  DCA_WHEN_DROP_PERCENT_MINI: null,
  PAXG_BUY_AMOUNT: null,
  MINI_BUY_AMOUNT: null,
  ENABLE_FUTURE: null,
  // ICT Strategy Settings
  ENABLE_BUY_ICT: null,
  ENABLE_SELL_ICT: null,
  MAX_BNB_PRICE_ICT: null,
  MAX_SOL_PRICE_ICT: null,
  MAX_BTC_PRICE_ICT: null,
  DCA_WHEN_DROP_PERCENT_ICT: null,
  ICT_BUY_AMOUNT: null,
  // BNB Accumulation Strategy
  ENABLE_ACCUMULATE: null,
});

export type SETTING_KEY = keyof typeof SETTING_KEY;

export const LIST_SYMBOL = keyMirror({
  BNBUSDT: null,
  SOLUSDT: null,
  BTCUSDT: null,
  PAXGUSDT: null,
});

export function getSettingKeyBySymbol(symbol: string): SETTING_KEY | null {
  switch (symbol.toUpperCase()) {
    case LIST_SYMBOL.BNBUSDT:
      return SETTING_KEY.MAX_BNB_PRICE;
    case LIST_SYMBOL.SOLUSDT:
      return SETTING_KEY.MAX_SOL_PRICE;
    case LIST_SYMBOL.BTCUSDT:
      return SETTING_KEY.MAX_BTC_PRICE;
    case LIST_SYMBOL.PAXGUSDT:
      return SETTING_KEY.MAX_PAXG_PRICE;
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

export function getSettingKeyBySymbolICT(symbol: string): SETTING_KEY | null {
  switch (symbol.toUpperCase()) {
    case LIST_SYMBOL.BNBUSDT:
      return SETTING_KEY.MAX_BNB_PRICE_ICT;
    case LIST_SYMBOL.SOLUSDT:
      return SETTING_KEY.MAX_SOL_PRICE_ICT;
    case LIST_SYMBOL.BTCUSDT:
      return SETTING_KEY.MAX_BTC_PRICE_ICT;
    default:
      return null;
  }
}
