import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { StorageService } from './storage.service';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly userService: UserService,
  ) {}

  @Get('overview')
  async getOverview(@CurrentUser() user: User) {
    const systemStats = await this.storageService.getStorageStats();
    const currentUser = await this.userService.findById(user.id);

    const usedBytes = Number(currentUser?.storage_used ?? 0);
    const quotaBytes = Number(currentUser?.storage_limit ?? 0);
    const isUnlimited = quotaBytes === 0;

    return {
      system: {
        totalBytes: systemStats.totalBytes,
        usedBytes: systemStats.usedBytes,
        freeBytes: systemStats.freeBytes,
        usedPercentage:
          systemStats.totalBytes > 0
            ? Math.round((systemStats.usedBytes / systemStats.totalBytes) * 100)
            : 0,
      },
      user: {
        usedBytes,
        quotaBytes,
        freeBytes: isUnlimited
          ? systemStats.freeBytes
          : Math.max(0, quotaBytes - usedBytes),
        usedPercentage:
          isUnlimited || quotaBytes === 0
            ? 0
            : Math.round((usedBytes / quotaBytes) * 100),
        isUnlimited,
      },
    };
  }

  @Get('users')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async getAllUsersStorage() {
    const { items: users } = await this.userService.findAll(1, 1000);

    return users.map((user) => {
      const usedBytes = Number(user.storage_used ?? 0);
      const quotaBytes = Number(user.storage_limit ?? 0);
      const isUnlimited = quotaBytes === 0;

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        usedBytes,
        quotaBytes,
        usedPercentage:
          isUnlimited || quotaBytes === 0
            ? 0
            : Math.round((usedBytes / quotaBytes) * 100),
        isUnlimited,
      };
    });
  }

  @Get('users/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async getUserStorage(@Param('userId') userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      return { error: 'User not found' };
    }

    const usedBytes = Number(user.storage_used ?? 0);
    const quotaBytes = Number(user.storage_limit ?? 0);
    const isUnlimited = quotaBytes === 0;
    const actualUsedBytes =
      await this.storageService.getUserStorageSize(userId);

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      usedBytes,
      quotaBytes,
      usedPercentage:
        isUnlimited || quotaBytes === 0
          ? 0
          : Math.round((usedBytes / quotaBytes) * 100),
      isUnlimited,
      actualUsedBytes,
      freeBytes: isUnlimited ? 0 : Math.max(0, quotaBytes - usedBytes),
    };
  }

  @Patch('users/:userId/quota')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async updateUserQuota(
    @Param('userId') userId: string,
    @Body('storage_quota') storageQuota: number,
  ) {
    const user = await this.userService.updateStorageLimit(
      userId,
      storageQuota,
    );

    return {
      userId: user.id,
      name: user.name,
      quotaBytes: Number(user.storage_limit),
      usedBytes: Number(user.storage_used),
    };
  }
}
