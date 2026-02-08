import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { UserService } from '../user.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private userService: UserService) {}

  @Get('shareable')
  async getShareableUsers(
    @CurrentUser() currentUser: User,
    @Query('q') q?: string,
  ) {
    const { items } = await this.userService.findAll(1, 1000);
    const query = (q || '').trim().toLowerCase();

    return items
      .filter((user) => user.id !== currentUser.id)
      .filter((user) => {
        if (!query) return true;
        return (
          user.name?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query)
        );
      })
      .map((user) => {
        const { password_hash: _, ...safeUser } = user as any;
        return {
          id: safeUser.id,
          name: safeUser.name,
          email: safeUser.email,
          role: safeUser.role,
        };
      });
  }
}
