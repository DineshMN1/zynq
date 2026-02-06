import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { UserModule } from '../user/user.module';
import { SettingModule } from '../setting/setting.module';

@Module({
  imports: [UserModule, SettingModule],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
