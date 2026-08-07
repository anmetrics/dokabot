/**
 * Rate limits, tunable per environment.
 *
 * Read at import time so route decorators pick them up.
 *
 * The defaults are the production numbers and are deliberately tight: a login
 * endpoint that allows a thousand guesses a minute is not protecting anything.
 * Raise them for a specific environment with the env vars below — never by
 * editing these constants, or every deployment inherits the loosened value.
 *
 *   THROTTLE_LOGIN_LIMIT=1000 yarn start:dev
 */
const num = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const THROTTLE = {
  /** Baseline for every route. */
  default: { ttl: num('THROTTLE_TTL_MS', 60_000), limit: num('THROTTLE_LIMIT', 120) },
  /** Credential endpoints are the ones worth brute-forcing. */
  login: { ttl: 60_000, limit: num('THROTTLE_LOGIN_LIMIT', 10) },
  register: { ttl: 60_000, limit: num('THROTTLE_REGISTER_LIMIT', 5) },
  refresh: { ttl: 60_000, limit: num('THROTTLE_REFRESH_LIMIT', 30) },
} as const;
