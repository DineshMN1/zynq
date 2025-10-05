import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // ✅ 1️⃣ Check Authorization header first
        (request: Request) => {
          const authHeader = request?.headers?.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.split(' ')[1];
          }
          return null;
        },
        // ✅ 2️⃣ Fallback to cookie (used by browser login)
        (request: Request) => request?.cookies?.jid || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    console.log('JWT PAYLOAD >>>', payload);

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      console.error('❌ User not found for payload.sub:', payload.sub);
      throw new UnauthorizedException();
    }

    console.log('✅ Authenticated user:', user.email);
    return user;
  }
}
