import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import {
  ExchangeAuthError,
  ExchangeError,
  ExchangeRateLimitError,
} from '../exchange.errors';
import { RateLimiterService } from '../rate-limiter.service';
import {
  Balance,
  Candle,
  ExchangeCredentials,
  IExchangeAdapter,
  OhlcvRequest,
  OrderResult,
  OrderSide,
  OrderStatus,
  OrderType,
  PlaceOrderRequest,
  SymbolInfo,
  VerificationResult,
} from '../exchange.types';

const LIVE_BASE = 'https://api.bybit.com';
const TESTNET_BASE = 'https://api-testnet.bybit.com';
const RECV_WINDOW = '5000';
const TIMEOUT_MS = 10_000;
const CATEGORY = 'spot';

/** Bybit v5 allows 600 requests / 5s per key; 100/s with a 300 burst stays clear. */
const BUCKET = { capacity: 300, refillPerSecond: 100 };

/** Bybit expresses intervals in minutes, or D/W/M. */
const INTERVAL_MAP: Record<string, string> = {
  '1m': '1',
  '3m': '3',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '2h': '120',
  '4h': '240',
  '6h': '360',
  '12h': '720',
  '1d': 'D',
  '1w': 'W',
  '1M': 'M',
};

const STATUS_MAP: Record<string, OrderStatus> = {
  New: 'NEW',
  PartiallyFilled: 'PARTIALLY_FILLED',
  Filled: 'FILLED',
  Cancelled: 'CANCELED',
  PartiallyFilledCanceled: 'CANCELED',
  Rejected: 'REJECTED',
  Deactivated: 'EXPIRED',
};

type BybitEnvelope<T> = { retCode: number; retMsg: string; result: T };

type BybitOrder = {
  symbol: string;
  orderId: string;
  orderLinkId: string;
  side: string;
  orderType: string;
  price: string;
  qty: string;
  cumExecQty: string;
  avgPrice: string;
  orderStatus: string;
  createdTime: string;
};

/** Bybit v5. Signature = HMAC_SHA256(timestamp + apiKey + recvWindow + payload). */
@Injectable()
export class BybitAdapter implements IExchangeAdapter {
  readonly exchange = 'BYBIT' as const;

  constructor(private readonly rateLimiter: RateLimiterService) {}

  async verifyCredentials(
    credentials: ExchangeCredentials,
  ): Promise<VerificationResult> {
    try {
      const info = await this.signed<{
        note?: string;
        readOnly?: number;
        permissions?: Record<string, string[]>;
      }>('GET', '/v5/user/query-api', credentials);

      const groups = info.permissions ?? {};
      const raw = Object.entries(groups).flatMap(([group, actions]) =>
        actions.map((action) => `${group}.${action}`),
      );
      const has = (group: string) => (groups[group]?.length ?? 0) > 0;

      return {
        ok: true,
        accountLabel: info.note,
        permissions: {
          // Any key that authenticates can read.
          canRead: true,
          canTrade:
            info.readOnly !== 1 &&
            (has('Spot') || has('ContractTrade') || has('Derivatives')),
          canWithdraw: has('Withdraw') || has('Transfer'),
          raw,
        },
      };
    } catch (error) {
      return { ok: false, reason: (error as Error).message };
    }
  }

  async fetchOHLCV(request: OhlcvRequest): Promise<Candle[]> {
    const interval = INTERVAL_MAP[request.interval];
    if (!interval) {
      throw new ExchangeError(
        this.exchange,
        `Unsupported interval "${request.interval}"`,
      );
    }

    const params = new URLSearchParams({
      category: CATEGORY,
      symbol: request.symbol,
      interval,
      limit: String(request.limit ?? 500),
    });
    if (request.startTime) params.set('start', String(request.startTime));
    if (request.endTime) params.set('end', String(request.endTime));

    const result = await this.public<{ list: string[][] }>(
      '/v5/market/kline',
      params,
      false,
    );

    const intervalMs = this.intervalMs(request.interval);
    // Bybit returns newest-first; the rest of the platform assumes ascending time.
    return result.list
      .map((row) => ({
        openTime: Number(row[0]),
        open: row[1],
        high: row[2],
        low: row[3],
        close: row[4],
        volume: row[5],
        closeTime: Number(row[0]) + intervalMs - 1,
      }))
      .sort((a, b) => a.openTime - b.openTime);
  }

  async fetchSymbolInfo(symbol: string): Promise<SymbolInfo> {
    const result = await this.public<{
      list: {
        symbol: string;
        baseCoin: string;
        quoteCoin: string;
        lotSizeFilter: {
          basePrecision?: string;
          minOrderQty?: string;
          minOrderAmt?: string;
        };
        priceFilter: { tickSize?: string };
      }[];
    }>(
      '/v5/market/instruments-info',
      new URLSearchParams({ category: CATEGORY, symbol }),
      false,
    );

    const entry = result.list?.[0];
    if (!entry) {
      throw new ExchangeError(this.exchange, `Unknown symbol ${symbol}`);
    }

    return {
      symbol: entry.symbol,
      base: entry.baseCoin,
      quote: entry.quoteCoin,
      stepSize: entry.lotSizeFilter.basePrecision ?? '0',
      tickSize: entry.priceFilter.tickSize ?? '0',
      minQty: entry.lotSizeFilter.minOrderQty ?? '0',
      minNotional: entry.lotSizeFilter.minOrderAmt ?? '0',
    };
  }

  async fetchBalances(credentials: ExchangeCredentials): Promise<Balance[]> {
    const result = await this.signed<{
      list: {
        coin: { coin: string; walletBalance: string; locked: string }[];
      }[];
    }>(
      'GET',
      '/v5/account/wallet-balance',
      credentials,
      new URLSearchParams({ accountType: 'UNIFIED' }),
    );

    return (result.list ?? [])
      .flatMap((account) => account.coin ?? [])
      .filter((c) => Number(c.walletBalance) > 0 || Number(c.locked) > 0)
      .map((c) => ({
        asset: c.coin,
        free: String(Number(c.walletBalance || '0') - Number(c.locked || '0')),
        locked: c.locked || '0',
      }));
  }

  async placeOrder(
    credentials: ExchangeCredentials,
    request: PlaceOrderRequest,
  ): Promise<OrderResult> {
    if (request.type === 'LIMIT' && !request.price) {
      throw new ExchangeError(this.exchange, 'A LIMIT order requires a price');
    }

    const body: Record<string, string> = {
      category: CATEGORY,
      symbol: request.symbol,
      side: request.side === 'BUY' ? 'Buy' : 'Sell',
      orderType: request.type === 'MARKET' ? 'Market' : 'Limit',
      qty: request.quantity,
      // Bybit's idempotency key. Same id twice ⇒ the second call is rejected
      // rather than duplicating the order.
      orderLinkId: request.clientOrderId,
    };
    if (request.type === 'LIMIT') {
      body.price = request.price as string;
      body.timeInForce = 'GTC';
    }

    await this.signedPost('/v5/order/create', credentials, body);

    // Create returns only ids, so read back the full order for a consistent shape.
    const order = await this.fetchOrder(credentials, {
      symbol: request.symbol,
      clientOrderId: request.clientOrderId,
    });
    if (!order) {
      throw new ExchangeError(
        this.exchange,
        'Order was accepted but could not be read back',
        undefined,
        true,
      );
    }
    return order;
  }

  async cancelOrder(
    credentials: ExchangeCredentials,
    params: { symbol: string; clientOrderId: string },
  ): Promise<OrderResult> {
    await this.signedPost('/v5/order/cancel', credentials, {
      category: CATEGORY,
      symbol: params.symbol,
      orderLinkId: params.clientOrderId,
    });

    const order = await this.fetchOrder(credentials, params);
    if (!order) {
      throw new ExchangeError(
        this.exchange,
        'Order was cancelled but could not be read back',
      );
    }
    return order;
  }

  async fetchOrder(
    credentials: ExchangeCredentials,
    params: { symbol: string; clientOrderId: string },
  ): Promise<OrderResult | null> {
    // `realtime` covers open orders; closed ones fall through to history.
    for (const path of ['/v5/order/realtime', '/v5/order/history']) {
      const result = await this.signed<{ list: BybitOrder[] }>(
        'GET',
        path,
        credentials,
        new URLSearchParams({
          category: CATEGORY,
          symbol: params.symbol,
          orderLinkId: params.clientOrderId,
        }),
      );
      const order = result.list?.[0];
      if (order) return this.toOrderResult(order);
    }
    return null;
  }

  async fetchOpenOrders(
    credentials: ExchangeCredentials,
    symbol?: string,
  ): Promise<OrderResult[]> {
    const params = new URLSearchParams({ category: CATEGORY });
    if (symbol) params.set('symbol', symbol);
    else params.set('settleCoin', 'USDT');

    const result = await this.signed<{ list: BybitOrder[] }>(
      'GET',
      '/v5/order/realtime',
      credentials,
      params,
    );
    return (result.list ?? []).map((order) => this.toOrderResult(order));
  }

  // ── internals ──

  private base(isTestnet: boolean): string {
    return isTestnet ? TESTNET_BASE : LIVE_BASE;
  }

  private intervalMs(interval: string): number {
    const unit = interval.slice(-1);
    const amount = Number(interval.slice(0, -1)) || 1;
    const table: Record<string, number> = {
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
      w: 604_800_000,
      M: 2_592_000_000,
    };
    return amount * (table[unit] ?? 60_000);
  }

  private async public<T>(
    path: string,
    params: URLSearchParams,
    isTestnet: boolean,
  ): Promise<T> {
    await this.rateLimiter.consume(`${this.exchange}:public`, BUCKET);

    const response = await fetch(
      `${this.base(isTestnet)}${path}?${params.toString()}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    return this.parse<T>(response);
  }

  private async signed<T>(
    method: 'GET',
    path: string,
    credentials: ExchangeCredentials,
    params = new URLSearchParams(),
  ): Promise<T> {
    await this.rateLimiter.consume(
      `${this.exchange}:${credentials.apiKey}`,
      BUCKET,
    );

    const query = params.toString();
    const timestamp = Date.now().toString();
    const response = await fetch(
      `${this.base(credentials.isTestnet)}${path}${query ? `?${query}` : ''}`,
      {
        method,
        headers: this.authHeaders(credentials, timestamp, query),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    return this.parse<T>(response);
  }

  private async signedPost<T>(
    path: string,
    credentials: ExchangeCredentials,
    body: Record<string, string>,
  ): Promise<T> {
    await this.rateLimiter.consume(
      `${this.exchange}:${credentials.apiKey}`,
      BUCKET,
    );

    // The signature covers the exact bytes sent, so serialise once and reuse.
    const raw = JSON.stringify(body);
    const timestamp = Date.now().toString();

    const response = await fetch(`${this.base(credentials.isTestnet)}${path}`, {
      method: 'POST',
      headers: {
        ...this.authHeaders(credentials, timestamp, raw),
        'Content-Type': 'application/json',
      },
      body: raw,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return this.parse<T>(response);
  }

  private authHeaders(
    credentials: ExchangeCredentials,
    timestamp: string,
    payload: string,
  ): Record<string, string> {
    const signature = createHmac('sha256', credentials.apiSecret)
      .update(timestamp + credentials.apiKey + RECV_WINDOW + payload)
      .digest('hex');

    return {
      'X-BAPI-API-KEY': credentials.apiKey,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': RECV_WINDOW,
      'X-BAPI-SIGN': signature,
    };
  }

  private async parse<T>(response: Response): Promise<T> {
    const body = (await response
      .json()
      .catch(() => null)) as BybitEnvelope<T> | null;

    if (response.ok && body?.retCode === 0) return body.result;

    const code = body?.retCode ?? response.status;
    const message = body?.retMsg || `HTTP ${response.status}`;

    // 10006/10018 are rate limits; 10003/10004/10005 are key problems.
    if (response.status === 429 || code === 10006 || code === 10018) {
      throw new ExchangeRateLimitError(this.exchange, message, code);
    }
    if ([10003, 10004, 10005, 10010].includes(Number(code))) {
      throw new ExchangeAuthError(this.exchange, message, code);
    }
    throw new ExchangeError(
      this.exchange,
      message,
      code,
      response.status >= 500,
    );
  }

  private toOrderResult(order: BybitOrder): OrderResult {
    return {
      clientOrderId: order.orderLinkId,
      exchangeOrderId: order.orderId,
      symbol: order.symbol,
      side: order.side.toUpperCase() as OrderSide,
      type: order.orderType.toUpperCase() as OrderType,
      status: STATUS_MAP[order.orderStatus] ?? 'NEW',
      price: order.price || '0',
      quantity: order.qty || '0',
      filledQuantity: order.cumExecQty || '0',
      averagePrice: order.avgPrice || '0',
      createdAt: Number(order.createdTime) || Date.now(),
    };
  }
}
