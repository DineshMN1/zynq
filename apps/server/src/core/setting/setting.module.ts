import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingService } from './setting.service';
import { SettingController } from './setting.controller';
import { Setting } from './entities/setting.entity';
import { AdminStorageController } from './controllers/admin-storage.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Setting]),
    forwardRef(() => UserModule),
  ],
  providers: [SettingService],
  controllers: [SettingController, AdminStorageController],
  exports: [SettingService],
})
export class SettingModule {}
