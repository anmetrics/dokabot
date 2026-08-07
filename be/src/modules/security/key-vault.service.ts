import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

/** Ciphertext bundle persisted alongside an exchange account. */
export type SealedSecret = {
  /** AES-256-GCM ciphertext of the payload, base64. */
  ciphertext: string;
  iv: string;
  authTag: string;
  /** Data-encryption key, itself encrypted under the master key. */
  wrappedDek: string;
  kmsKeyId: string;
};

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const DEK_BYTES = 32;

/**
 * Envelope encryption for exchange API credentials.
 *
 * Per-record data-encryption key (DEK) → payload is sealed with the DEK,
 * the DEK is sealed with a master key. Rotating the master key therefore only
 * requires re-wrapping DEKs, not re-encrypting every secret.
 *
 * The local implementation keeps the master key in the environment. In production
 * `wrapDek`/`unwrapDek` are the seams to swap for AWS KMS or Vault Transit — the
 * rest of the system never sees a raw key.
 */
@Injectable()
export class KeyVaultService {
  private readonly logger = new Logger(KeyVaultService.name);
  private readonly masterKey: Buffer;
  private readonly kmsKeyId: string;

  constructor(private readonly configService: ConfigService) {
    const raw = this.configService.get<string>('KEY_VAULT_MASTER_KEY');
    if (!raw) {
      throw new Error('KEY_VAULT_MASTER_KEY is not configured');
    }
    this.masterKey = Buffer.from(raw, 'base64');
    if (this.masterKey.length !== DEK_BYTES) {
      throw new Error('KEY_VAULT_MASTER_KEY must decode to exactly 32 bytes');
    }
    this.kmsKeyId =
      this.configService.get<string>('KEY_VAULT_KEY_ID') ?? 'local-master-v1';
  }

  /**
   * Seals a pair of related secrets (api key + secret) under one DEK so a single
   * unwrap serves both.
   */
  seal(payload: { apiKey: string; apiSecret: string }): SealedSecret & {
    apiKeyCiphertext: string;
    secretCiphertext: string;
  } {
    const dek = randomBytes(DEK_BYTES);
    const iv = randomBytes(IV_BYTES);

    const cipher = createCipheriv(ALGORITHM, dek, iv);
    const plaintext = Buffer.from(
      JSON.stringify({ apiKey: payload.apiKey, apiSecret: payload.apiSecret }),
      'utf8',
    );
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      // Both fields point at the same sealed blob; kept separate in the schema so a
      // future migration can split them without a data model change.
      ciphertext: ciphertext.toString('base64'),
      apiKeyCiphertext: ciphertext.toString('base64'),
      secretCiphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      wrappedDek: this.wrapDek(dek),
      kmsKeyId: this.kmsKeyId,
    };
  }

  open(sealed: SealedSecret): { apiKey: string; apiSecret: string } {
    const dek = this.unwrapDek(sealed.wrappedDek);
    const decipher = createDecipheriv(
      ALGORITHM,
      dek,
      Buffer.from(sealed.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(sealed.authTag, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
      decipher.final(),
    ]);

    return JSON.parse(plaintext.toString('utf8')) as {
      apiKey: string;
      apiSecret: string;
    };
  }

  /** Constant-time comparison helper for anything derived from a secret. */
  static safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  /** Swap this for `kms.encrypt({ KeyId, Plaintext: dek })` in production. */
  private wrapDek(dek: Buffer): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);
    const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, wrapped]).toString('base64');
  }

  /** Swap this for `kms.decrypt({ CiphertextBlob })` in production. */
  private unwrapDek(wrapped: string): Buffer {
    const raw = Buffer.from(wrapped, 'base64');
    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + 16);
    const payload = raw.subarray(IV_BYTES + 16);

    const decipher = createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(payload), decipher.final()]);
  }
}
