import { createHash } from 'crypto';

/** Both Binance (newClientOrderId) and Bybit (orderLinkId) cap this at 36 chars. */
const MAX_LENGTH = 36;
const PREFIX = 'dk';

/**
 * Derives the exchange-facing idempotency key from the *intent*, not from a random
 * value: the same (owner, intent) always produces the same id.
 *
 * That is what makes a retry after a timeout safe — the exchange rejects the
 * duplicate instead of opening a second position.
 */
export function deriveClientOrderId(
  ownerId: string,
  intentKey: string,
): string {
  // Length-prefixed so no pair of inputs can be re-split into a different pair:
  // ("a", "b:c") and ("a:b", "c") must not hash to the same order id.
  const digest = createHash('sha256')
    .update(`${ownerId.length}:${ownerId}:${intentKey}`)
    .digest('hex');
  return `${PREFIX}${digest}`.slice(0, MAX_LENGTH);
}
