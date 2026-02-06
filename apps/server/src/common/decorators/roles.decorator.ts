import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../core/user/entities/user.entity';

/**
 * Decorator that specifies required roles for a route.
 * Use with RolesGuard. Example: `@Roles(UserRole.ADMIN, UserRole.OWNER)`
 */
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
