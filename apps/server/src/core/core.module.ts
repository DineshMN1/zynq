import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FileModule } from './file/file.module';
import { ShareModule } from './share/share.module';
import { InvitationModule } from './invitation/invitation.module';
import { StorageModule } from './storage/storage.module';
import { SettingModule } from './setting/setting.module';
import { EncryptionModule } from './encryption/encryption.module';
import { SystemModule } from './system/system.module';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    EncryptionModule,
    AuthModule,
    UserModule,
    FileModule,
    ShareModule,
    InvitationModule,
    StorageModule,
    SettingModule,
    SystemModule,
  ],
  providers: [RolesGuard],
  exports: [
    EncryptionModule,
    AuthModule,
    UserModule,
    FileModule,
    ShareModule,
    InvitationModule,
    StorageModule,
    SettingModule,
    SystemModule,
    RolesGuard,
  ],
})
export class CoreModule {}
