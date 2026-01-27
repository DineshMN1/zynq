import { Controller, Get, Param } from '@nestjs/common';
import { FileService } from '../../file/file.service';

@Controller('public')
export class PublicShareController {
  constructor(private fileService: FileService) {}

  @Get('share/:token')
  async getPublicShare(@Param('token') token: string) {
    return this.fileService.getPublicShare(token);
  }
}
