import { parseAbi } from 'viem';

/** Only the events the listener cares about. */
export const SUBSCRIPTION_ABI = parseAbi([
  'event Subscribed(address indexed user, uint64 timestamp)',
  'event Unsubscribed(address indexed user, uint64 timestamp)',
  'event Charged(address indexed user, uint256 amount, uint32 indexed chargeCount, uint64 timestamp)',
  'event ChargeFailed(address indexed user, string reason, uint64 timestamp)',
]);

export const BSC_CHAIN_ID = 56;
export const BSC_TESTNET_CHAIN_ID = 97;

/**
 * BSC-USD, the USDT everyone actually holds on BSC.
 *
 * 18 decimals, not the 6 that USDT uses on Ethereum — assuming 6 here would
 * charge a millionth of the intended amount.
 */
export const BSC_USDT = {
  address: '0x55d398326f99059fF775485246999027B3197955',
  decimals: 18,
} as const;

export const PRO_PRICE_USD = 4;
export const PERIOD_DAYS = 30;

/**
 * Access continues this long after a period ends without payment.
 *
 * A failed pull is usually an empty wallet, not a cancellation, and cutting a
 * paying user off the same hour their balance dips is a good way to lose them.
 */
export const GRACE_DAYS = 3;

/**
 * Blocks to wait before a payment counts.
 *
 * BSC finalises fast but does reorg. Crediting at the head means occasionally
 * granting Pro for a transaction that gets rolled back.
 */
export const CONFIRMATIONS = 15;
