import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { FileService } from '../../file/file.service';

@Controller('public')
export class PublicShareController {
  constructor(private fileService: FileService) {}

  @Get('share/:token')
  async getPublicShare(@Param('token') token: string) {
    return this.fileService.getPublicShare(token);
  }

  @Get('share/:token/download')
  async downloadPublicFile(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const { data, file } = await this.fileService.downloadPublicFile(token);

    res.set({
      'Content-Type': file.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Access-Control-Expose-Headers': 'Content-Disposition',
      'Content-Length': data.length,
    });

    res.send(data);
  }
}
