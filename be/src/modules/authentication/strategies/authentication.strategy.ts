import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticationPayload } from '../interfaces/authentication.interface';

@Injectable()
export class AuthenticationStrategy extends PassportStrategy(
  Strategy,
  'authentication',
) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async validate({ adminId }: AuthenticationPayload) {
    if (adminId) {
      return {
        adminId,
      };
    }
    throw new UnauthorizedException('Invalid payload');
  }
}
