import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticationPayload } from './interfaces/authentication.interface';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(password: string) {
    if (password !== 'Aa111111') {
      throw new UnauthorizedException('Invalid password');
    }

    const payload: AuthenticationPayload = { adminId: 1 };
    const token = await this.jwtService.signAsync(payload);

    return {
      accessToken: token,
      expiresIn: this.configService.get('JWT_TOKEN_EXPIRES_IN'),
    };
  }
}
