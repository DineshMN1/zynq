import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that validates JWT token from cookie or Authorization header.
 * Attach to routes requiring authentication.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
