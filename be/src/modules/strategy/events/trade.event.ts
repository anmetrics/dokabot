export interface TradeEvent {
  strategy: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  qty: number;
  timestamp: number;
}
