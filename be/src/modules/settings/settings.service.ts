import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserSettings } from 'generated/prisma';
import { PrismaService } from 'src/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticationService } from '../authentication/authentication.service';
import { RequestContext } from '../authentication/interfaces/authentication.interface';
import { ChangePasswordDto, UpdateSettingsDto } from './dto/settings.dto';
import { SymbolRule } from './settings.types';

const BCRYPT_ROUNDS = 12;
const MAX_SYMBOL_RULES = 200;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthenticationService,
  ) {}

  /**
   * Reads a user's settings, creating the default row on first access.
   *
   * Lazily rather than at registration: a settings row that only exists once the
   * user touches the page cannot drift out of sync with a schema that gains
   * columns later.
   */
  async get(userId: string): Promise<UserSettings> {
    const existing = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    // Two concurrent first-time requests would both try to create; the unique
    // index arbitrates and the loser reads what the winner wrote.
    try {
      return await this.prisma.userSettings.create({ data: { userId } });
    } catch {
      return this.prisma.userSettings.findUniqueOrThrow({ where: { userId } });
    }
  }

  async update(
    userId: string,
    dto: UpdateSettingsDto,
    context: RequestContext,
  ): Promise<UserSettings> {
    await this.get(userId);

    if (dto.symbolRules) {
      if (dto.symbolRules.length > MAX_SYMBOL_RULES) {
        throw new BadRequestException(
          `Tối đa ${MAX_SYMBOL_RULES} quy tắc theo cặp`,
        );
      }

      const seen = new Set<string>();
      for (const rule of dto.symbolRules) {
        if (seen.has(rule.symbol)) {
          throw new BadRequestException(`Trùng quy tắc cho ${rule.symbol}`);
        }
        seen.add(rule.symbol);

        // Bounds that cross would silently block every order on that pair.
        if (
          rule.minBuyPrice > 0 &&
          rule.maxBuyPrice > 0 &&
          rule.minBuyPrice > rule.maxBuyPrice
        ) {
          throw new BadRequestException(
            `${rule.symbol}: giá mua tối thiểu lớn hơn giá mua tối đa`,
          );
        }
        if (
          rule.minSellPrice > 0 &&
          rule.maxSellPrice > 0 &&
          rule.minSellPrice > rule.maxSellPrice
        ) {
          throw new BadRequestException(
            `${rule.symbol}: giá bán tối thiểu lớn hơn giá bán tối đa`,
          );
        }
      }
    }

    const updated = await this.prisma.userSettings.update({
      where: { userId },
      data: {
        ...dto,
        symbolRules: dto.symbolRules as unknown as object,
      },
    });

    this.audit.record({
      userId,
      action: 'settings.update',
      metadata: { fields: Object.keys(dto) },
      ...context,
    });

    return updated;
  }

  /** The rule that applies to a pair, or null when the user set none. */
  async symbolRule(userId: string, symbol: string): Promise<SymbolRule | null> {
    const settings = await this.get(userId);
    const rules = (settings.symbolRules as unknown as SymbolRule[]) ?? [];
    return (
      rules.find((rule) => rule.symbol === symbol && rule.enabled) ?? null
    );
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    context: RequestContext,
  ): Promise<{ success: true }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) {
      this.audit.record({
        userId,
        action: 'settings.change_password',
        success: false,
        ...context,
      });
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu cũ');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });

    // A password change is what you do when you suspect a compromise, so every
    // other session has to die with it.
    await this.auth.revokeAllForUser(userId);

    this.audit.record({
      userId,
      action: 'settings.change_password',
      ...context,
    });

    return { success: true };
  }

  /** Active sessions, so a user can see and cut off anything they don't recognise. */
  async sessions(userId: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    // Never the token or its hash — a session list is not a credential list.
    return tokens;
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    context: RequestContext,
  ): Promise<{ success: true }> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new BadRequestException('Phiên không tồn tại hoặc đã kết thúc');
    }

    this.audit.record({
      userId,
      action: 'settings.session_revoked',
      resourceId: sessionId,
      ...context,
    });
    return { success: true };
  }

  /** The user's own audit trail — what happened on their account and when. */
  activity(userId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      select: {
        id: true,
        action: true,
        resourceType: true,
        success: true,
        ip: true,
        metadata: true,
        createdAt: true,
      },
    });
  }
}
