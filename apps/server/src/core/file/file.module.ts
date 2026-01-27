import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileService } from './file.service';
import { FileController } from './controllers/file.controller';
import { File } from './entities/file.entity';
import { Share } from '../share/entities/share.entity';
import { StorageModule } from '../storage/storage.module';
import { UserModule } from '../user/user.module';
import { ShareModule } from '../share/share.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([File, Share]),
    StorageModule,
    forwardRef(() => UserModule),
    forwardRef(() => ShareModule),
  ],
  providers: [FileService],
  controllers: [FileController],
  exports: [FileService],
})
export class FileModule {}
