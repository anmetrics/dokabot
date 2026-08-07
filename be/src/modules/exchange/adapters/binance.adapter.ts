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

const LIVE_BASE = 'https://api.binance.com';
const TESTNET_BASE = 'https://testnet.binance.vision';
const TIMEOUT_MS = 10_000;

/**
 * Binance publishes a 6000 request-weight per minute budget per IP. 80/s with a
 * 1200 burst leaves headroom for the market-data path that shares the account.
 */
const BUCKET = { capacity: 1200, refillPerSecond: 80 };

type BinanceApiPermissions = {
  ipRestrict?: boolean;
  enableReading?: boolean;
  enableSpotAndMarginTrading?: boolean;
  enableFutures?: boolean;
  enableWithdrawals?: boolean;
  enableInternalTransfer?: boolean;
};

type BinanceOrder = {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  type: string;
  side: string;
  time?: number;
  transactTime?: number;
};

type BinanceFilter = {
  filterType: string;
  stepSize?: string;
  tickSize?: string;
  minQty?: string;
  minNotional?: string;
  notional?: string;
};

/**
 * Talks to Binance over plain REST rather than an SDK: this code runs against
 * user-supplied credentials, so the surface area is deliberately small and auditable.
 */
@Injectable()
export class BinanceAdapter implements IExchangeAdapter {
  readonly exchange = 'BINANCE' as const;

  constructor(private readonly rateLimiter: RateLimiterService) {}

  async verifyCredentials(
    credentials: ExchangeCredentials,
  ): Promise<VerificationResult> {
    try {
      const permissions = await this.signed<BinanceApiPermissions>(
        'GET',
        '/sapi/v1/account/apiRestrictions',
        credentials,
      );

      const raw = Object.entries(permissions)
        .filter(([, enabled]) => enabled === true)
        .map(([name]) => name);

      return {
        ok: true,
        permissions: {
          canRead: permissions.enableReading === true,
          canTrade:
            permissions.enableSpotAndMarginTrading === true ||
            permissions.enableFutures === true,
          canWithdraw:
            permissions.enableWithdrawals === true ||
            permissions.enableInternalTransfer === true,
          raw,
        },
      };
    } catch (error) {
      return { ok: false, reason: (error as Error).message };
    }
  }

  async fetchOHLCV(request: OhlcvRequest): Promise<Candle[]> {
    const params = new URLSearchParams({
      symbol: request.symbol,
      interval: request.interval,
      limit: String(request.limit ?? 500),
    });
    if (request.startTime) params.set('startTime', String(request.startTime));
    if (request.endTime) params.set('endTime', String(request.endTime));

    const rows = await this.public<unknown[][]>(
      '/api/v3/klines',
      params,
      false,
    );

    return rows.map((row) => ({
      openTime: Number(row[0]),
      open: String(row[1]),
      high: String(row[2]),
      low: String(row[3]),
      close: String(row[4]),
      volume: String(row[5]),
      closeTime: Number(row[6]),
    }));
  }

  async fetchSymbolInfo(symbol: string): Promise<SymbolInfo> {
    const info = await this.public<{
      symbols: {
        symbol: string;
        baseAsset: string;
        quoteAsset: string;
        filters: BinanceFilter[];
      }[];
    }>('/api/v3/exchangeInfo', new URLSearchParams({ symbol }), false);

    const entry = info.symbols?.[0];
    if (!entry) {
      throw new ExchangeError(this.exchange, `Unknown symbol ${symbol}`);
    }

    const filter = (type: string) =>
      entry.filters.find((f) => f.filterType === type);

    return {
      symbol: entry.symbol,
      base: entry.baseAsset,
      quote: entry.quoteAsset,
      stepSize: filter('LOT_SIZE')?.stepSize ?? '0',
      tickSize: filter('PRICE_FILTER')?.tickSize ?? '0',
      minQty: filter('LOT_SIZE')?.minQty ?? '0',
      minNotional:
        filter('NOTIONAL')?.minNotional ??
        filter('MIN_NOTIONAL')?.minNotional ??
        '0',
    };
  }

  async fetchBalances(credentials: ExchangeCredentials): Promise<Balance[]> {
    const account = await this.signed<{
      balances: { asset: string; free: string; locked: string }[];
    }>('GET', '/api/v3/account', credentials);

    return account.balances
      .filter((b) => Number(b.free) > 0 || Number(b.locked) > 0)
      .map((b) => ({ asset: b.asset, free: b.free, locked: b.locked }));
  }

  async placeOrder(
    credentials: ExchangeCredentials,
    request: PlaceOrderRequest,
  ): Promise<OrderResult> {
    const params = new URLSearchParams({
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      quantity: request.quantity,
      newClientOrderId: request.clientOrderId,
      newOrderRespType: 'RESULT',
    });

    if (request.type === 'LIMIT') {
      if (!request.price) {
        throw new ExchangeError(
          this.exchange,
          'A LIMIT order requires a price',
        );
      }
      params.set('price', request.price);
      params.set('timeInForce', 'GTC');
    }

    const order = await this.signed<BinanceOrder>(
      'POST',
      '/api/v3/order',
      credentials,
      params,
    );
    return this.toOrderResult(order);
  }

  async cancelOrder(
    credentials: ExchangeCredentials,
    params: { symbol: string; clientOrderId: string },
  ): Promise<OrderResult> {
    const order = await this.signed<BinanceOrder>(
      'DELETE',
      '/api/v3/order',
      credentials,
      new URLSearchParams({
        symbol: params.symbol,
        origClientOrderId: params.clientOrderId,
      }),
    );
    return this.toOrderResult(order);
  }

  async fetchOrder(
    credentials: ExchangeCredentials,
    params: { symbol: string; clientOrderId: string },
  ): Promise<OrderResult | null> {
    try {
      const order = await this.signed<BinanceOrder>(
        'GET',
        '/api/v3/order',
        credentials,
        new URLSearchParams({
          symbol: params.symbol,
          origClientOrderId: params.clientOrderId,
        }),
      );
      return this.toOrderResult(order);
    } catch (error) {
      // -2013 is "order does not exist", which is a legitimate answer for the
      // reconciler asking whether a submission ever landed.
      if (error instanceof ExchangeError && error.code === -2013) return null;
      throw error;
    }
  }

  async fetchOpenOrders(
    credentials: ExchangeCredentials,
    symbol?: string,
  ): Promise<OrderResult[]> {
    const params = new URLSearchParams();
    if (symbol) params.set('symbol', symbol);

    const orders = await this.signed<BinanceOrder[]>(
      'GET',
      '/api/v3/openOrders',
      credentials,
      params,
    );
    return orders.map((order) => this.toOrderResult(order));
  }

  // ── internals ──

  private base(isTestnet: boolean): string {
    return isTestnet ? TESTNET_BASE : LIVE_BASE;
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
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    credentials: ExchangeCredentials,
    params = new URLSearchParams(),
  ): Promise<T> {
    await this.rateLimiter.consume(
      `${this.exchange}:${credentials.apiKey}`,
      BUCKET,
    );

    params.set('timestamp', String(Date.now()));
    params.set('recvWindow', '5000');

    const query = params.toString();
    const signature = createHmac('sha256', credentials.apiSecret)
      .update(query)
      .digest('hex');

    const url = `${this.base(credentials.isTestnet)}${path}?${query}&signature=${signature}`;
    const response = await fetch(url, {
      method,
      headers: { 'X-MBX-APIKEY': credentials.apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    return this.parse<T>(response);
  }

  private async parse<T>(response: Response): Promise<T> {
    const body: unknown = await response.json().catch(() => null);

    if (response.ok) return body as T;

    const code = (body as { code?: number })?.code;
    const message =
      (body as { msg?: string })?.msg ?? `HTTP ${response.status}`;

    if (response.status === 429 || response.status === 418) {
      throw new ExchangeRateLimitError(this.exchange, message, code);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ExchangeAuthError(this.exchange, message, code);
    }
    // 5xx is the exchange having a bad day; the caller may retry.
    throw new ExchangeError(
      this.exchange,
      message,
      code,
      response.status >= 500,
    );
  }

  private toOrderResult(order: BinanceOrder): OrderResult {
    const executed = order.executedQty ?? '0';
    const quoteFilled = order.cummulativeQuoteQty ?? '0';
    const averagePrice =
      Number(executed) > 0
        ? String(Number(quoteFilled) / Number(executed))
        : '0';

    return {
      clientOrderId: order.clientOrderId,
      exchangeOrderId: String(order.orderId),
      symbol: order.symbol,
      side: order.side as OrderSide,
      type: order.type as OrderType,
      status: order.status as OrderStatus,
      price: order.price ?? '0',
      quantity: order.origQty ?? '0',
      filledQuantity: executed,
      averagePrice,
      createdAt: order.time ?? order.transactTime ?? Date.now(),
    };
  }
}
