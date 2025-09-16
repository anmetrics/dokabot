export enum StrategyEventType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export interface StrategyEvent {
  type: StrategyEventType;
  symbol: string;
  price: number;
  qty: number;
  time: number;
}
