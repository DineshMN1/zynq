import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FileModule } from './file/file.module';
import { ShareModule } from './share/share.module';
import { InvitationModule } from './invitation/invitation.module';
import { StorageModule } from './storage/storage.module';
import { SettingModule } from './setting/setting.module';
import { EncryptionModule } from './encryption/encryption.module';

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
  ],
  exports: [
    EncryptionModule,
    AuthModule,
    UserModule,
    FileModule,
    ShareModule,
    InvitationModule,
    StorageModule,
    SettingModule,
  ],
})
export class CoreModule {}
