import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { verifyMessage } from 'viem';
import { PrismaService } from 'src/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequestContext } from '../authentication/interfaces/authentication.interface';
import { BSC_CHAIN_ID } from './billing.constants';

/** Nonces older than this are rejected, so a captured message cannot be replayed later. */
const NONCE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Issues the message the user must sign.
   *
   * The nonce is what stops a replay: without it, any signature the user ever
   * produced for this app could be reused by someone else to claim their wallet.
   */
  async challenge(
    userId: string,
    address: string,
    chainId = BSC_CHAIN_ID,
  ): Promise<{ message: string; nonce: string }> {
    const normalised = this.normalise(address);

    const owner = await this.prisma.walletLink.findUnique({
      where: { address: normalised },
    });
    if (owner && owner.userId !== userId) {
      throw new BadRequestException(
        'Ví này đã được liên kết với một tài khoản khác',
      );
    }

    const nonce = randomBytes(16).toString('hex');

    await this.prisma.walletLink.upsert({
      where: { address: normalised },
      create: { userId, address: normalised, chainId, nonce },
      // A new challenge invalidates the previous one.
      update: { nonce, verifiedAt: null, chainId },
    });

    return { message: this.messageFor(normalised, nonce), nonce };
  }

  /**
   * Verifies the signature and marks the wallet as owned by this user.
   *
   * Proving ownership matters because the subscription is keyed by wallet: without
   * it, anyone could claim a paying wallet and inherit its subscription.
   */
  async verify(
    userId: string,
    address: string,
    signature: string,
    context: RequestContext,
  ): Promise<{ address: string; verifiedAt: Date }> {
    const normalised = this.normalise(address);

    const link = await this.prisma.walletLink.findUnique({
      where: { address: normalised },
    });
    if (!link || link.userId !== userId) {
      throw new BadRequestException('Chưa có yêu cầu xác minh cho ví này');
    }
    if (Date.now() - link.createdAt.getTime() > NONCE_TTL_MS && !link.verifiedAt) {
      throw new BadRequestException('Yêu cầu đã hết hạn, vui lòng thử lại');
    }

    const valid = await verifyMessage({
      address: normalised as `0x${string}`,
      message: this.messageFor(normalised, link.nonce),
      signature: signature as `0x${string}`,
    }).catch(() => false);

    if (!valid) {
      this.audit.record({
        userId,
        action: 'wallet.verify',
        success: false,
        metadata: { address: normalised },
        ...context,
      });
      throw new BadRequestException('Chữ ký không hợp lệ');
    }

    const updated = await this.prisma.walletLink.update({
      where: { address: normalised },
      // Rotate the nonce so this exact signature cannot be presented twice.
      data: { verifiedAt: new Date(), nonce: randomBytes(16).toString('hex') },
    });

    this.audit.record({
      userId,
      action: 'wallet.verify',
      metadata: { address: normalised },
      ...context,
    });

    return { address: updated.address, verifiedAt: updated.verifiedAt! };
  }

  list(userId: string) {
    return this.prisma.walletLink.findMany({
      where: { userId },
      select: { address: true, chainId: true, verifiedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async unlink(userId: string, address: string): Promise<{ success: true }> {
    const normalised = this.normalise(address);
    const result = await this.prisma.walletLink.deleteMany({
      where: { address: normalised, userId },
    });
    if (result.count === 0) {
      throw new BadRequestException('Ví không tồn tại');
    }
    return { success: true };
  }

  /** The verified owner of an address, or null. Used by the payment listener. */
  async ownerOf(address: string): Promise<string | null> {
    const link = await this.prisma.walletLink.findUnique({
      where: { address: this.normalise(address) },
    });
    return link?.verifiedAt ? link.userId : null;
  }

  private messageFor(address: string, nonce: string): string {
    // Human-readable on purpose: a wallet shows this text verbatim, and a user
    // should be able to tell what they are signing.
    return [
      'DokaBot — xác minh quyền sở hữu ví',
      '',
      `Địa chỉ: ${address}`,
      `Mã xác minh: ${nonce}`,
      '',
      'Ký tin nhắn này không tiêu tốn gas và không cho phép chuyển tiền.',
    ].join('\n');
  }

  private normalise(address: string): string {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new BadRequestException('Địa chỉ ví không hợp lệ');
    }
    return address.toLowerCase();
  }
}
