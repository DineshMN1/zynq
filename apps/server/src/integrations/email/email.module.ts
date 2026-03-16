import { Module, forwardRef } from '@nestjs/common';
import { EmailService } from './email.service';
import { SmtpController } from './smtp.controller';
import { SettingModule } from '../../core/setting/setting.module';
import { UserModule } from '../../core/user/user.module';

@Module({
  imports: [forwardRef(() => SettingModule), UserModule],
  providers: [EmailService],
  controllers: [SmtpController],
  exports: [EmailService],
})
export class EmailModule {}
