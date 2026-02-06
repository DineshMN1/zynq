import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { AdminController } from './controllers/admin.controller';
import { SettingModule } from '../setting/setting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    forwardRef(() => SettingModule),
  ],
  providers: [UserService],
  controllers: [AdminController],
  exports: [UserService],
})
export class UserModule {}
