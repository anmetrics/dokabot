/**
 * Rate limits, tunable per environment.
 *
 * Read at import time so route decorators pick them up. Production keeps the
 * defaults; the e2e suite raises them so the limiter does not decide the result
 * of tests that are about something else.
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
