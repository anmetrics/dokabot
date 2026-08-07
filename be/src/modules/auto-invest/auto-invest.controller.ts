import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticationGuard } from '../authentication/guards/authentication.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../authentication/interfaces/authentication.interface';
import { AutoInvestService } from './auto-invest.service';
import { EnableAutoInvestDto } from './dto/auto-invest.dto';

@Controller('auto-invest')
@UseGuards(AuthenticationGuard)
export class AutoInvestController {
  constructor(private readonly service: AutoInvestService) {}

  @Get('presets')
  presets() {
    return this.service.presets();
  }

  @Get()
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.service.status(user.id);
  }

  @Post('enable')
  enable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnableAutoInvestDto,
    @Req() request: Request,
  ) {
    return this.service.enable(user.id, dto, this.context(request));
  }

  @Post('disable')
  disable(@CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    return this.service.disable(user.id, this.context(request));
  }

  private context(request: Request) {
    return {
      ip: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    };
  }
}
