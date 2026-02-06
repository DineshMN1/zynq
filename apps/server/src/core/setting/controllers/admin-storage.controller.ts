import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../user/entities/user.entity';
import { SettingService } from '../setting.service';
import { UserService } from '../../user/user.service';
import {
  UpdateStorageSettingsDto,
  BulkUpdateStorageLimitDto,
} from '../dto/storage-settings.dto';

const DEFAULT_STORAGE_LIMIT = 10 * 1024 * 1024 * 1024; // 10GB in bytes

@Controller('admin/settings/storage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class AdminStorageController {
  constructor(
    private readonly settingService: SettingService,
    private readonly userService: UserService,
  ) {}

  @Get()
  async getStorageSettings() {
    const defaultLimit = await this.settingService.getGlobalSetting(
      'storage.default_limit',
    );
    const maxLimit = await this.settingService.getGlobalSetting(
      'storage.max_limit',
    );

    return {
      default_storage_limit: defaultLimit ?? DEFAULT_STORAGE_LIMIT,
      max_storage_limit: maxLimit ?? 0, // 0 means no cap
    };
  }

  @Put()
  async updateStorageSettings(@Body() dto: UpdateStorageSettingsDto) {
    const updates: Record<string, any> = {};

    if (dto.default_storage_limit !== undefined) {
      updates['storage.default_limit'] = dto.default_storage_limit;
    }

    if (dto.max_storage_limit !== undefined) {
      updates['storage.max_limit'] = dto.max_storage_limit;
    }

    // Validate that default doesn't exceed max (if max is set)
    if (updates['storage.default_limit'] && updates['storage.max_limit']) {
      if (
        updates['storage.max_limit'] > 0 &&
        updates['storage.default_limit'] > updates['storage.max_limit']
      ) {
        throw new BadRequestException(
          'Default storage limit cannot exceed maximum storage limit',
        );
      }
    }

    await this.settingService.updateGlobalSettings(updates);

    return this.getStorageSettings();
  }

  @Post('bulk-update')
  async bulkUpdateStorageLimits(@Body() dto: BulkUpdateStorageLimitDto) {
    // Get the limit to apply
    let limitToApply = dto.storage_limit;

    if (limitToApply === undefined) {
      // Use default from settings
      const defaultLimit = await this.settingService.getGlobalSetting(
        'storage.default_limit',
      );
      limitToApply = defaultLimit ?? DEFAULT_STORAGE_LIMIT;
    }

    // Validate against max limit if set
    const maxLimit = await this.settingService.getGlobalSetting(
      'storage.max_limit',
    );
    if (maxLimit && maxLimit > 0 && limitToApply > maxLimit) {
      throw new BadRequestException(
        `Storage limit cannot exceed maximum limit of ${maxLimit} bytes`,
      );
    }

    // Get all users and update their storage limits
    const { items: users } = await this.userService.findAll(1, 10000);
    let updatedCount = 0;

    for (const user of users) {
      await this.userService.updateStorageLimit(user.id, limitToApply);
      updatedCount++;
    }

    return {
      success: true,
      updatedCount,
      appliedLimit: limitToApply,
    };
  }
}
