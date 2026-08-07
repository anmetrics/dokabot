import { Exchange } from 'generated/prisma';

/**
 * Everything a user needs to create a *safe* API key on a given exchange.
 *
 * Hosted trading platforms all ship this: the key the user pastes in must be
 * trade-only and locked to the platform's egress IPs, and the exchange UI hides
 * both settings behind different labels. Keeping the copy here — next to the
 * adapter that will actually use the key — means adding an exchange brings its
 * onboarding text with it instead of leaving the front end to guess.
 */
export type ExchangeOnboarding = {
  id: Exchange;
  name: string;
  /** Where the user creates the key. */
  createKeyUrl: string;
  /** Exchange docs for the IP allowlist, linked next to the IP list. */
  ipWhitelistUrl: string;
  /** Label the exchange itself uses for the allowlist, so the user can find it. */
  ipWhitelistLabel: string;
  /** Permissions the key MUST have for bots to work. */
  requiredPermissions: string[];
  /** Permissions that cause the key to be rejected on save. */
  forbiddenPermissions: string[];
  /** Exchange-specific gotchas, shown as a checklist. */
  notes: string[];
};

export const EXCHANGE_ONBOARDING: Record<Exchange, ExchangeOnboarding> = {
  BINANCE: {
    id: 'BINANCE',
    name: 'Binance',
    createKeyUrl: 'https://www.binance.com/en/my/settings/api-management',
    ipWhitelistUrl:
      'https://www.binance.com/en/support/faq/how-to-create-api-keys-on-binance-360002502072',
    ipWhitelistLabel: 'Restrict access to trusted IPs only',
    requiredPermissions: ['Enable Reading', 'Enable Spot & Margin Trading'],
    forbiddenPermissions: ['Enable Withdrawals'],
    notes: [
      'Chọn "Restrict access to trusted IPs only" và dán các IP bên dưới — Binance chỉ cho tối đa 30 IP.',
      'Key KHÔNG giới hạn IP sẽ tự hết hạn sau 90 ngày và bot sẽ ngừng chạy.',
      'Nếu chạy futures, bật thêm "Enable Futures" trên chính key này.',
    ],
  },
  BYBIT: {
    id: 'BYBIT',
    name: 'Bybit',
    createKeyUrl: 'https://www.bybit.com/app/user/api-management',
    ipWhitelistUrl:
      'https://www.bybit.com/en/help-center/article/How-to-create-your-API-key',
    ipWhitelistLabel: 'Only IPs in the whitelist can access the API',
    requiredPermissions: ['Read-Write', 'Contract/Spot Trade'],
    forbiddenPermissions: ['Withdraw', 'Transfer', 'Subaccount Transfer'],
    notes: [
      'Chọn "API Transaction" (không phải "Read-Only") rồi thêm IP vào whitelist.',
      'Key không có IP whitelist chỉ sống 90 ngày; key có whitelist thì không hết hạn.',
      'Không bật Withdraw/Transfer — hệ thống sẽ từ chối key ngay khi lưu.',
    ],
  },
};

/**
 * Exchange error signatures that mean "this request came from an IP the key does
 * not trust". Worth detecting separately: the fix is a one-line allowlist edit,
 * but the raw message ("Invalid API-key, IP, or permissions for action") sends
 * users hunting for a permissions problem that isn't there.
 */
const IP_RESTRICTION_SIGNATURES = [
  '-2015',
  '10010',
  'unmatched ip',
  'invalid api-key, ip',
  'ip not allowed',
  'ip mismatch',
  'not in the ip whitelist',
];

export function looksLikeIpRestriction(reason: string): boolean {
  const normalised = reason.toLowerCase();
  return IP_RESTRICTION_SIGNATURES.some((sig) => normalised.includes(sig));
}
