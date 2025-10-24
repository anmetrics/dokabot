import { Body, Controller, Post } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';

@Controller('auth')
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

  @Post('login')
  login(@Body('password') password: string) {
    return this.authService.login(password);
  }
}
