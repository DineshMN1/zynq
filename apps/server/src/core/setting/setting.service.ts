import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(Setting)
    private settingsRepository: Repository<Setting>,
  ) {}

  async getUserSettings(userId: string): Promise<Record<string, any>> {
    const settings = await this.settingsRepository.find({
      where: { user_id: userId },
    });

    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
  }

  async updateUserSettings(
    userId: string,
    updateDto: UpdateSettingsDto,
  ): Promise<Record<string, any>> {
    for (const [key, value] of Object.entries(updateDto)) {
      let setting = await this.settingsRepository.findOne({
        where: { user_id: userId, key },
      });

      if (setting) {
        setting.value = value;
      } else {
        setting = this.settingsRepository.create({
          user_id: userId,
          key,
          value,
        });
      }

      await this.settingsRepository.save(setting);
    }

    return this.getUserSettings(userId);
  }

  async getGlobalSettings(): Promise<Record<string, any>> {
    const settings = await this.settingsRepository.find({
      where: { user_id: null },
    });

    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
  }
}
