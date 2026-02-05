import { Module, forwardRef } from '@nestjs/common';
import { EmailService } from './email.service';
import { SmtpController } from './smtp.controller';
import { SettingModule } from '../../core/setting/setting.module';

@Module({
  imports: [forwardRef(() => SettingModule)],
  providers: [EmailService],
  controllers: [SmtpController],
  exports: [EmailService],
})
export class EmailModule {}
