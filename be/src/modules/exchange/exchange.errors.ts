/**
 * Errors an adapter raises, classified by what the caller should do about them.
 *
 * `retryable` is the difference between "try again in a moment" and "this order
 * will never work" — the execution path must not retry a rejected order forever.
 */
export class ExchangeError extends Error {
  constructor(
    readonly exchange: string,
    message: string,
    readonly code?: string | number,
    readonly retryable = false,
  ) {
    super(`[${exchange}] ${message}`);
    this.name = 'ExchangeError';
  }
}

export class ExchangeAuthError extends ExchangeError {
  constructor(exchange: string, message: string, code?: string | number) {
    super(exchange, message, code, false);
    this.name = 'ExchangeAuthError';
  }
}

export class ExchangeRateLimitError extends ExchangeError {
  constructor(exchange: string, message: string, code?: string | number) {
    super(exchange, message, code, true);
    this.name = 'ExchangeRateLimitError';
  }
}
