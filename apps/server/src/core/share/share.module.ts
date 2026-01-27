import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Share } from './entities/share.entity';
import { PublicShareController } from './controllers/public-share.controller';
import { FileModule } from '../file/file.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Share]),
    forwardRef(() => FileModule),
  ],
  controllers: [PublicShareController],
  exports: [],
})
export class ShareModule {}
