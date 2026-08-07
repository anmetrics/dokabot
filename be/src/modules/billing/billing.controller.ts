import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthenticationGuard } from '../authentication/guards/authentication.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../authentication/interfaces/authentication.interface';
import {
  BSC_CHAIN_ID,
  BSC_USDT,
  GRACE_DAYS,
  PERIOD_DAYS,
  PRO_PRICE_USD,
} from './billing.constants';
import { WalletChallengeDto, WalletVerifyDto } from './dto/billing.dto';
import { SubscriptionService } from './subscription.service';
import { WalletService } from './wallet.service';

@Controller('billing')
@UseGuards(AuthenticationGuard)
export class BillingController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly wallets: WalletService,
    private readonly config: ConfigService,
  ) {}

  /** Everything the checkout screen needs to build the two wallet transactions. */
  @Get('plan')
  plan() {
    return {
      tiers: [
        {
          tier: 'FREE',
          priceUsd: 0,
          features: [
            'Tối đa 2 bot',
            'Paper trading không giới hạn',
            'Chiến lược có sẵn',
          ],
        },
        {
          tier: 'PRO',
          priceUsd: PRO_PRICE_USD,
          features: [
            'Bot không giới hạn',
            'Giao dịch tiền thật',
            'Rule builder tự thiết kế',
            'Đầu tư tự động',
            'Quy tắc giá theo cặp',
          ],
        },
      ],
      periodDays: PERIOD_DAYS,
      graceDays: GRACE_DAYS,
      chainId: Number(this.config.get('BILLING_CHAIN_ID') ?? BSC_CHAIN_ID),
      token: {
        address: this.config.get('BILLING_TOKEN_ADDRESS') ?? BSC_USDT.address,
        decimals: Number(
          this.config.get('BILLING_TOKEN_DECIMALS') ?? BSC_USDT.decimals,
        ),
        symbol: 'USDT',
      },
      contractAddress: this.config.get('BILLING_CONTRACT_ADDRESS') ?? null,
    };
  }

  @Get()
  async status(@CurrentUser() user: AuthenticatedUser) {
    const subscription = await this.subscriptions.get(user.id);
    return {
      ...subscription,
      // Computed rather than read from `status`, so a subscription that lapsed
      // while no job ran is still reported as inactive.
      isPro: this.subscriptions.isProActive(subscription),
    };
  }

  @Get('payments')
  payments(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.payments(user.id);
  }

  @Get('wallets')
  wallets_(@CurrentUser() user: AuthenticatedUser) {
    return this.wallets.list(user.id);
  }

  @Post('wallets/challenge')
  challenge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WalletChallengeDto,
  ) {
    return this.wallets.challenge(user.id, dto.address, dto.chainId);
  }

  @Post('wallets/verify')
  async verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WalletVerifyDto,
    @Req() request: Request,
  ) {
    const result = await this.wallets.verify(
      user.id,
      dto.address,
      dto.signature,
      { ip: request.ip, userAgent: request.get('user-agent') ?? undefined },
    );
    // The paying wallet is the one just proven, so bind it now rather than
    // waiting for the first on-chain event.
    await this.subscriptions.attachWallet(user.id, result.address);
    return result;
  }

  @Delete('wallets/:address')
  unlink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('address') address: string,
  ) {
    return this.wallets.unlink(user.id, address);
  }
}
