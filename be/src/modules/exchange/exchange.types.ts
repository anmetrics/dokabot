export type ExchangeId = 'BINANCE' | 'BYBIT';

export type ExchangeCredentials = {
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
};

export type KeyPermissions = {
  /** Read account/market data. */
  canRead: boolean;
  /** Place and cancel orders (spot and/or derivatives). */
  canTrade: boolean;
  /**
   * Move funds off the exchange. A key with this permission is REJECTED —
   * see docs/ARCHITECTURE.md §2.4.
   */
  canWithdraw: boolean;
  /** Raw permission list as reported by the exchange, for the audit trail. */
  raw: string[];
};

export type VerificationResult =
  | { ok: true; permissions: KeyPermissions; accountLabel?: string }
  | { ok: false; reason: string };

/**
 * Prices and quantities cross this boundary as strings.
 *
 * IEEE-754 cannot hold 8-decimal crypto quantities exactly, and a rounding error
 * here becomes a real order for the wrong size. Callers parse with decimal.js.
 */
export type Numeric = string;

export type Candle = {
  openTime: number;
  open: Numeric;
  high: Numeric;
  low: Numeric;
  close: Numeric;
  volume: Numeric;
  closeTime: number;
};

export type Balance = {
  asset: string;
  free: Numeric;
  locked: Numeric;
};

export type SymbolInfo = {
  symbol: string;
  base: string;
  quote: string;
  /** Quantity must be a multiple of this. */
  stepSize: Numeric;
  /** Price must be a multiple of this. */
  tickSize: Numeric;
  minQty: Numeric;
  minNotional: Numeric;
};

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';
export type OrderStatus =
  | 'NEW'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'REJECTED'
  | 'EXPIRED';

export type PlaceOrderRequest = {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: Numeric;
  /** Required for LIMIT orders. */
  price?: Numeric;
  /**
   * Caller-generated, deterministic id. Replaying the same request with the same
   * id must never create a second order — this is the platform's idempotency key.
   */
  clientOrderId: string;
};

export type OrderResult = {
  clientOrderId: string;
  exchangeOrderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  price: Numeric;
  quantity: Numeric;
  filledQuantity: Numeric;
  /** Volume-weighted average fill price, '0' when nothing has filled. */
  averagePrice: Numeric;
  createdAt: number;
};

export type OhlcvRequest = {
  symbol: string;
  /** '1m' | '5m' | '15m' | '1h' | '4h' | '1d' */
  interval: string;
  limit?: number;
  startTime?: number;
  endTime?: number;
};

/**
 * Everything the platform needs from an exchange, so strategies and the execution
 * path never import an exchange SDK directly.
 *
 * Adapters are stateless: credentials are passed per call rather than held, so a
 * single instance safely serves every tenant.
 */
export interface IExchangeAdapter {
  readonly exchange: ExchangeId;

  /** Verifies credentials are live and reports what they are allowed to do. */
  verifyCredentials(
    credentials: ExchangeCredentials,
  ): Promise<VerificationResult>;

  // ── Public market data (no credentials) ──
  fetchOHLCV(request: OhlcvRequest): Promise<Candle[]>;
  fetchSymbolInfo(symbol: string): Promise<SymbolInfo>;

  // ── Private (credentialed) ──
  fetchBalances(credentials: ExchangeCredentials): Promise<Balance[]>;
  placeOrder(
    credentials: ExchangeCredentials,
    request: PlaceOrderRequest,
  ): Promise<OrderResult>;
  cancelOrder(
    credentials: ExchangeCredentials,
    params: { symbol: string; clientOrderId: string },
  ): Promise<OrderResult>;
  fetchOrder(
    credentials: ExchangeCredentials,
    params: { symbol: string; clientOrderId: string },
  ): Promise<OrderResult | null>;
  fetchOpenOrders(
    credentials: ExchangeCredentials,
    symbol?: string,
  ): Promise<OrderResult[]>;
}
