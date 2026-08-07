/**
 * Fail-fast validation of the process environment.
 *
 * A misconfigured secret is a security incident, not a runtime warning — the app
 * refuses to boot rather than falling back to a default.
 */
export type AppEnv = {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL_DAYS: number;
  /** 32-byte master key, base64. In production this is fronted by KMS/Vault. */
  KEY_VAULT_MASTER_KEY: string;
  KEY_VAULT_KEY_ID: string;
  CORS_ORIGINS: string[];
};

const WEAK_SECRETS = new Set(['secret', 'changeme', 'password', 'jwt_secret']);

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function validateEnv(): AppEnv {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as AppEnv['NODE_ENV'];
  const isProd = nodeEnv === 'production';

  const jwtSecret = required('JWT_SECRET');
  if (WEAK_SECRETS.has(jwtSecret.toLowerCase()) || jwtSecret.length < 32) {
    throw new Error(
      '[config] JWT_SECRET must be at least 32 random characters. ' +
        'Generate one with: openssl rand -base64 48',
    );
  }

  const masterKey = required('KEY_VAULT_MASTER_KEY');
  if (Buffer.from(masterKey, 'base64').length !== 32) {
    throw new Error(
      '[config] KEY_VAULT_MASTER_KEY must be exactly 32 bytes, base64-encoded. ' +
        'Generate one with: openssl rand -base64 32',
    );
  }

  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (isProd && corsOrigins.length === 0) {
    throw new Error(
      '[config] CORS_ORIGINS must list the allowed front-end origins in production.',
    );
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: Number(process.env.PORT ?? 3000),
    DATABASE_URL: required('DATABASE_URL'),
    JWT_SECRET: jwtSecret,
    JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '15m',
    JWT_REFRESH_TTL_DAYS: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30),
    KEY_VAULT_MASTER_KEY: masterKey,
    KEY_VAULT_KEY_ID: process.env.KEY_VAULT_KEY_ID ?? 'local-master-v1',
    CORS_ORIGINS: corsOrigins.length ? corsOrigins : ['http://localhost:3001'],
  };
}
