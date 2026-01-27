import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SettingService } from './setting.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingController {
  constructor(private settingService: SettingService) {}

  @Get()
  getUserSettings(@CurrentUser() user: User) {
    return this.settingService.getUserSettings(user.id);
  }

  @Put()
  updateSettings(
    @CurrentUser() user: User,
    @Body() updateDto: UpdateSettingsDto,
  ) {
    return this.settingService.updateUserSettings(user.id, updateDto);
  }
}
