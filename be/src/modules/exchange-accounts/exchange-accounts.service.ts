import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Exchange, ExchangeAccountStatus } from 'generated/prisma';
import { PrismaService } from 'src/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExchangeRegistry } from '../exchange/exchange.registry';
import { KeyPermissions } from '../exchange/exchange.types';
import { KeyVaultService } from '../security/key-vault.service';
import { RequestContext } from '../authentication/interfaces/authentication.interface';
import {
  CreateExchangeAccountDto,
  UpdateExchangeAccountDto,
} from './dto/exchange-account.dto';

/** Safe projection — never contains key material. */
export type ExchangeAccountView = {
  id: string;
  exchange: Exchange;
  label: string;
  apiKeyMasked: string;
  isTestnet: boolean;
  permissions: KeyPermissions | null;
  status: ExchangeAccountStatus;
  lastVerifiedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
};

const MAX_ACCOUNTS_PER_USER = 20;
/** Decrypted credentials are cached briefly so a busy bot is not a decrypt storm. */
const CREDENTIAL_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class ExchangeAccountsService {
  private readonly logger = new Logger(ExchangeAccountsService.name);
  private readonly credentialCache = new Map<
    string,
    { value: { apiKey: string; apiSecret: string }; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: KeyVaultService,
    private readonly registry: ExchangeRegistry,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string): Promise<ExchangeAccountView[]> {
    const accounts = await this.prisma.exchangeAccount.findMany({
      where: { userId, status: { not: ExchangeAccountStatus.REVOKED } },
      orderBy: { createdAt: 'desc' },
    });
    return accounts.map((account) => this.toView(account));
  }

  async create(
    userId: string,
    dto: CreateExchangeAccountDto,
    context: RequestContext,
  ): Promise<ExchangeAccountView> {
    const count = await this.prisma.exchangeAccount.count({
      where: { userId, status: { not: ExchangeAccountStatus.REVOKED } },
    });
    if (count >= MAX_ACCOUNTS_PER_USER) {
      throw new BadRequestException(
        `You can connect at most ${MAX_ACCOUNTS_PER_USER} exchange accounts`,
      );
    }

    const duplicate = await this.prisma.exchangeAccount.findFirst({
      where: { userId, exchange: dto.exchange, label: dto.label },
    });
    if (duplicate) {
      throw new ConflictException(
        'You already have an account with this label on this exchange',
      );
    }

    const adapter = this.registry.get(dto.exchange);
    const verification = await adapter.verifyCredentials({
      apiKey: dto.apiKey,
      apiSecret: dto.apiSecret,
      isTestnet: dto.isTestnet ?? false,
    });

    if (!verification.ok) {
      this.audit.record({
        userId,
        action: 'exchange_account.create',
        success: false,
        metadata: { exchange: dto.exchange, reason: verification.reason },
        ...context,
      });
      throw new UnprocessableEntityException(
        `Could not verify these credentials. ${verification.reason}`,
      );
    }

    // Hard rule: the platform is non-custodial. A key that can move funds off the
    // exchange turns a bug or a breach into a total loss, so it is never stored.
    if (verification.permissions.canWithdraw) {
      this.audit.record({
        userId,
        action: 'exchange_account.create',
        success: false,
        metadata: { exchange: dto.exchange, reason: 'withdraw_permission' },
        ...context,
      });
      throw new UnprocessableEntityException(
        'This API key has withdrawal permission enabled. For your own safety we do ' +
          'not accept it — recreate the key on the exchange with trading permission only.',
      );
    }

    if (!verification.permissions.canTrade) {
      throw new UnprocessableEntityException(
        'This API key cannot place orders. Enable spot and/or futures trading on the exchange.',
      );
    }

    const sealed = this.vault.seal({
      apiKey: dto.apiKey,
      apiSecret: dto.apiSecret,
    });

    const account = await this.prisma.exchangeAccount.create({
      data: {
        userId,
        exchange: dto.exchange,
        label: dto.label,
        apiKeyCiphertext: sealed.apiKeyCiphertext,
        apiKeyLast4: dto.apiKey.slice(-4),
        secretCiphertext: sealed.secretCiphertext,
        iv: sealed.iv,
        authTag: sealed.authTag,
        wrappedDek: sealed.wrappedDek,
        kmsKeyId: sealed.kmsKeyId,
        isTestnet: dto.isTestnet ?? false,
        permissions: verification.permissions as unknown as object,
        canWithdraw: false,
        status: ExchangeAccountStatus.ACTIVE,
        lastVerifiedAt: new Date(),
      },
    });

    this.audit.record({
      userId,
      action: 'exchange_account.create',
      resourceType: 'exchange_account',
      resourceId: account.id,
      metadata: { exchange: dto.exchange, isTestnet: account.isTestnet },
      ...context,
    });

    return this.toView(account);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateExchangeAccountDto,
  ): Promise<ExchangeAccountView> {
    await this.mustOwn(userId, id);
    const account = await this.prisma.exchangeAccount.update({
      where: { id },
      data: { label: dto.label },
    });
    return this.toView(account);
  }

  /** Re-checks the stored credentials against the exchange. */
  async verify(userId: string, id: string): Promise<ExchangeAccountView> {
    const account = await this.mustOwn(userId, id);
    const credentials = this.openCredentials(account);

    const verification = await this.registry
      .get(account.exchange)
      .verifyCredentials({ ...credentials, isTestnet: account.isTestnet });

    const updated = await this.prisma.exchangeAccount.update({
      where: { id },
      data: verification.ok
        ? {
            status: verification.permissions.canWithdraw
              ? ExchangeAccountStatus.INVALID
              : ExchangeAccountStatus.ACTIVE,
            permissions: verification.permissions as unknown as object,
            canWithdraw: verification.permissions.canWithdraw,
            lastVerifiedAt: new Date(),
            lastError: verification.permissions.canWithdraw
              ? 'Withdrawal permission was enabled on this key. Trading is disabled until you remove it.'
              : null,
          }
        : {
            status: ExchangeAccountStatus.INVALID,
            lastVerifiedAt: new Date(),
            lastError: verification.reason,
          },
    });

    return this.toView(updated);
  }

  async revoke(
    userId: string,
    id: string,
    context: RequestContext,
  ): Promise<{ success: true }> {
    await this.mustOwn(userId, id);

    // Soft-revoke keeps the audit trail intact; the ciphertext is wiped so the
    // credentials are unrecoverable even from a database backup taken later.
    await this.prisma.exchangeAccount.update({
      where: { id },
      data: {
        status: ExchangeAccountStatus.REVOKED,
        apiKeyCiphertext: '',
        secretCiphertext: '',
        wrappedDek: '',
        iv: '',
        authTag: '',
      },
    });

    this.credentialCache.delete(id);

    this.audit.record({
      userId,
      action: 'exchange_account.revoke',
      resourceType: 'exchange_account',
      resourceId: id,
      ...context,
    });

    return { success: true };
  }

  /**
   * Decrypts credentials for use by the execution path.
   *
   * Callers must never log, return or persist the result.
   */
  async getCredentials(
    userId: string,
    id: string,
  ): Promise<{ apiKey: string; apiSecret: string; isTestnet: boolean }> {
    const account = await this.mustOwn(userId, id);
    if (account.status !== ExchangeAccountStatus.ACTIVE) {
      throw new BadRequestException('This exchange account is not active');
    }
    return { ...this.openCredentials(account), isTestnet: account.isTestnet };
  }

  private openCredentials(account: {
    id: string;
    secretCiphertext: string;
    iv: string;
    authTag: string;
    wrappedDek: string;
    kmsKeyId: string;
  }): { apiKey: string; apiSecret: string } {
    const cached = this.credentialCache.get(account.id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const value = this.vault.open({
      ciphertext: account.secretCiphertext,
      iv: account.iv,
      authTag: account.authTag,
      wrappedDek: account.wrappedDek,
      kmsKeyId: account.kmsKeyId,
    });

    this.credentialCache.set(account.id, {
      value,
      expiresAt: Date.now() + CREDENTIAL_CACHE_TTL_MS,
    });
    return value;
  }

  private async mustOwn(userId: string, id: string) {
    const account = await this.prisma.exchangeAccount.findFirst({
      where: { id, userId },
    });
    if (!account) {
      // Same response for "does not exist" and "belongs to someone else".
      throw new NotFoundException('Exchange account not found');
    }
    return account;
  }

  private toView(account: {
    id: string;
    exchange: Exchange;
    label: string;
    apiKeyLast4: string;
    isTestnet: boolean;
    permissions: unknown;
    status: ExchangeAccountStatus;
    lastVerifiedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
  }): ExchangeAccountView {
    return {
      id: account.id,
      exchange: account.exchange,
      label: account.label,
      apiKeyMasked: `••••••••${account.apiKeyLast4}`,
      isTestnet: account.isTestnet,
      permissions: (account.permissions as KeyPermissions | null) ?? null,
      status: account.status,
      lastVerifiedAt: account.lastVerifiedAt,
      lastError: account.lastError,
      createdAt: account.createdAt,
    };
  }
}
