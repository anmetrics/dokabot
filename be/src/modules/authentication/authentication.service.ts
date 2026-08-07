import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { UserStatus } from 'generated/prisma';
import { PrismaService } from 'src/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AuthenticationPayload,
  RequestContext,
} from './interfaces/authentication.interface';

const BCRYPT_ROUNDS = 12;
/** Burned on failed logins so response time does not reveal whether an email exists. */
const DUMMY_HASH = '$2b$12$0000000000000000000000000000000000000000000000000000';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async register(
    email: string,
    password: string,
    context: RequestContext,
  ): Promise<TokenPair> {
    const normalized = email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email: normalized },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email: normalized,
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      },
    });

    this.audit.record({
      userId: user.id,
      action: 'auth.register',
      ...context,
    });

    return this.issueTokens(user.id, user.email, user.role, context);
  }

  async login(
    email: string,
    password: string,
    context: RequestContext,
  ): Promise<TokenPair> {
    const normalized = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
    });

    const matches = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    );

    if (!user || !matches || user.status !== UserStatus.ACTIVE) {
      this.audit.record({
        userId: user?.id ?? null,
        action: 'auth.login',
        success: false,
        metadata: { email: normalized },
        ...context,
      });
      // Deliberately identical for unknown email, wrong password and suspended
      // account — enumeration of registered addresses is not free.
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.audit.record({ userId: user.id, action: 'auth.login', ...context });

    return this.issueTokens(user.id, user.email, user.role, context);
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a fresh pair issued.
   * Re-use of an already-revoked token means the token leaked, so every session for
   * that user is killed.
   */
  async refresh(
    refreshToken: string,
    context: RequestContext,
  ): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt || stored.expiresAt < new Date()) {
      await this.revokeAllForUser(stored.userId);
      this.audit.record({
        userId: stored.userId,
        action: 'auth.refresh.reuse_detected',
        success: false,
        ...context,
      });
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    if (stored.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(
      stored.user.id,
      stored.user.email,
      stored.user.role,
      context,
    );
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: AuthenticationPayload['role'],
    context: RequestContext,
  ): Promise<TokenPair> {
    const payload: AuthenticationPayload = { sub: userId, email, role };
    const accessToken = await this.jwtService.signAsync(payload);

    // Opaque, high-entropy and only ever stored hashed — a database leak does not
    // hand an attacker usable sessions.
    const refreshToken = randomBytes(48).toString('base64url');
    const ttlDays = Number(
      this.configService.get('JWT_REFRESH_TTL_DAYS') ?? 30,
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get('JWT_ACCESS_TTL') ?? '15m',
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
