import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [ConfigModule, UserModule],
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService],
})
export class SystemModule {}
