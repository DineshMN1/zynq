import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserService } from '../../core/user/user.service';
import { UserRole } from '../../core/user/entities/user.entity';

/**
 * Guard that checks if user has required role(s).
 * Use with @Roles() decorator. Requires JwtAuthGuard to run first.
 *
 * Always fetches the current role from the database rather than trusting the
 * JWT payload. This prevents role-drift: a user whose role was downgraded in
 * the DB is denied immediately even if their JWT has not expired yet.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const freshUser = await this.userService.findById(user.id);
    if (!freshUser) return false;

    return requiredRoles.some((role) => freshUser.role === role);
  }
}
