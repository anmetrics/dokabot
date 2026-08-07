import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticationGuard } from '../authentication/guards/authentication.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../authentication/interfaces/authentication.interface';
import { ExchangeAccountsService } from './exchange-accounts.service';
import {
  CreateExchangeAccountDto,
  UpdateExchangeAccountDto,
} from './dto/exchange-account.dto';
import { ExchangeRegistry } from '../exchange/exchange.registry';
import { EXCHANGE_ONBOARDING } from '../exchange/exchange.onboarding';
import { PlatformNetworkService } from '../exchange/platform-network.service';

@Controller('exchange-accounts')
@UseGuards(AuthenticationGuard)
export class ExchangeAccountsController {
  constructor(
    private readonly service: ExchangeAccountsService,
    private readonly registry: ExchangeRegistry,
    private readonly network: PlatformNetworkService,
  ) {}

  /**
   * Everything the "add API key" screen needs before the user touches the
   * exchange: which exchanges are live, the permissions their key must and must
   * not have, and the egress IPs to paste into the exchange's allowlist.
   */
  @Get('supported')
  supported() {
    const exchanges = this.registry
      .supported()
      .map((id) => EXCHANGE_ONBOARDING[id]);

    return {
      exchanges,
      egressIps: this.network.list(),
      egressIpsConfigured: this.network.configured,
    };
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExchangeAccountDto,
    @Req() request: Request,
  ) {
    return this.service.create(user.id, dto, this.context(request));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateExchangeAccountDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Post(':id/verify')
  verify(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.verify(user.id, id);
  }

  @Delete(':id')
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.service.revoke(user.id, id, this.context(request));
  }

  private context(request: Request) {
    return {
      ip: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    };
  }
}
