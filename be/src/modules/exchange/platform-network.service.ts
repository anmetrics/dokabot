import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * The platform's own outbound identity on the network.
 *
 * Every exchange call leaves from a fixed set of egress IPs (NAT gateway /
 * static-IP worker pool). Users must allowlist exactly these on their API key,
 * so the list has to come from configuration — never hardcoded in the UI, where
 * an infrastructure change would silently lock every user's key out.
 */
@Injectable()
export class PlatformNetworkService {
  private readonly logger = new Logger(PlatformNetworkService.name);
  private readonly egressIps: string[];

  constructor(config: ConfigService) {
    this.egressIps = (config.get<string>('PLATFORM_EGRESS_IPS') ?? '')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);

    if (this.egressIps.length === 0) {
      this.logger.warn(
        'PLATFORM_EGRESS_IPS is not set. Users will be told IP allowlisting is ' +
          'unavailable instead of being shown an IP that would lock their key out.',
      );
    }
  }

  /** Empty when this deployment has no static egress — the UI must handle that. */
  list(): string[] {
    return [...this.egressIps];
  }

  get configured(): boolean {
    return this.egressIps.length > 0;
  }

  /** Ready-to-paste form; exchanges accept a comma-separated list. */
  asAllowlistString(): string {
    return this.egressIps.join(',');
  }
}
