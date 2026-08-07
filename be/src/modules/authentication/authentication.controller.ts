import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from 'src/common/throttle.config';
import type { Request } from 'express';
import { AuthenticationService } from './authentication.service';
import {
  LoginDto,
  RefreshDto,
  RegisterDto,
} from './dto/authentication.dto';
import { AuthenticationGuard } from './guards/authentication.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthenticatedUser } from './interfaces/authentication.interface';

@Controller('auth')
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

  @Post('register')
  @Throttle({ default: THROTTLE.register })
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(
      dto.email,
      dto.password,
      this.context(request),
    );
  }

  @Post('login')
  @Throttle({ default: THROTTLE.login })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(
      dto.email,
      dto.password,
      this.context(request),
    );
  }

  @Post('refresh')
  @Throttle({ default: THROTTLE.refresh })
  refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.authService.refresh(dto.refreshToken, this.context(request));
  }

  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(AuthenticationGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  private context(request: Request) {
    return {
      ip: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    };
  }
}
