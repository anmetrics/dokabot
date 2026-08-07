import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

export type AuditEntry = {
  userId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  success?: boolean;
};

/**
 * Append-only trail for security- and money-relevant actions.
 *
 * Writes are fire-and-forget: an audit failure must never break the user action,
 * but it must be loud in the logs.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry): void {
    void this.prisma.auditLog
      .create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          resourceType: entry.resourceType ?? null,
          resourceId: entry.resourceId ?? null,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
          metadata: (entry.metadata ?? {}) as object,
          success: entry.success ?? true,
        },
      })
      .catch((error: Error) => {
        this.logger.error(
          `Failed to write audit log for "${entry.action}": ${error.message}`,
        );
      });
  }
}
