import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FileService } from '../file.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../user/entities/user.entity';
import { CreateFileDto } from '../dto/create-file.dto';
import { BulkDeleteFilesDto } from '../dto/bulk-delete-files.dto';
import { ShareFileDto } from '../../share/dto/share-file.dto';
import { File as FileEntity } from '../entities/file.entity';
import * as archiver from 'archiver';

/**
 * File management endpoints: CRUD, upload, download, share, trash.
 * All routes require JWT authentication. Files are encrypted at rest.
 */
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(private fileService: FileService) {}

  // ========================================
  // STATIC ROUTES FIRST (before :id params)
  // ========================================

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('parentId') parentId?: string,
  ) {
    const { items, total } = await this.fileService.findAll(
      user.id,
      parseInt(page) || 1,
      parseInt(limit) || 50,
      search,
      parentId,
    );

    return {
      items: items.map((file) => ({
        ...file,
        publicShareCount: file.publicShareCount ?? 0,
        privateShareCount: file.privateShareCount ?? 0,
      })),
      meta: {
        total,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
      },
    };
  }

  @Post()
  create(@CurrentUser() user: User, @Body() createFileDto: CreateFileDto) {
    return this.fileService.create(user.id, createFileDto);
  }

  @Get('trash')
  async getTrashed(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { items, total } = await this.fileService.getTrashedFiles(
      user.id,
      parseInt(page) || 1,
      parseInt(limit) || 50,
    );

    return {
      items,
      meta: {
        total,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
      },
    };
  }

  @Delete('trash/empty')
  @HttpCode(HttpStatus.NO_CONTENT)
  async emptyTrash(@CurrentUser() user: User) {
    await this.fileService.emptyTrash(user.id);
  }

  @Get('shared')
  getShared(@CurrentUser() user: User) {
    return this.fileService.getSharedWithMe(user.id);
  }

  @Get('public-shares')
  getPublicShares(@CurrentUser() user: User) {
    return this.fileService.getPublicSharesByUser(user.id);
  }

  @Delete('shares/:shareId')
  @HttpCode(HttpStatus.OK)
  async revokeShare(
    @CurrentUser() user: User,
    @Param('shareId') shareId: string,
  ) {
    await this.fileService.revokeShare(shareId, user.id);
    return { success: true };
  }

  @Delete('bulk')
  @HttpCode(HttpStatus.OK)
  async bulkDelete(@CurrentUser() user: User, @Body() dto: BulkDeleteFilesDto) {
    return this.fileService.bulkSoftDelete(dto.ids, user.id);
  }

  @Post('check-duplicate')
  async checkDuplicate(
    @CurrentUser() user: User,
    @Body() body: { fileHash: string; fileName?: string },
  ) {
    return this.fileService.checkDuplicate(
      user.id,
      body.fileHash,
      body.fileName,
    );
  }

  // ========================================
  // PARAMETERIZED ROUTES LAST
  // ========================================

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.fileService.findById(id, user.id);
  }

  @Put(':id/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFileContent(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return { error: 'No file provided' };
    }
    return this.fileService.uploadFileContent(id, user.id, file.buffer);
  }

  @Get(':id/download')
  async downloadFile(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.fileService.findById(id, user.id);
    if (file.is_folder) {
      return this.streamFolderZip(res, file, user.id);
    }
    const data = await this.fileService.downloadFile(id, user.id);

    res.set({
      'Content-Type': file.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Access-Control-Expose-Headers': 'Content-Disposition',
      'Content-Length': data.length,
    });

    res.send(data);
  }

  @Get('shares/:shareId/download')
  async downloadSharedFile(
    @CurrentUser() user: User,
    @Param('shareId') shareId: string,
    @Res() res: Response,
  ) {
    const file = await this.fileService.downloadSharedFile(shareId, user.id);
    if (file.is_folder) {
      return this.streamFolderZip(res, file, file.owner_id);
    }

    const data = await this.fileService.getDecryptedFileContent(file);
    res.set({
      'Content-Type': file.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Access-Control-Expose-Headers': 'Content-Disposition',
      'Content-Length': data.length,
    });

    res.send(data);
  }

  private async streamFolderZip(
    res: Response,
    folder: FileEntity,
    ownerId: string,
  ) {
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', () => {
      throw new InternalServerErrorException('Failed to create archive');
    });

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(folder.name)}.zip"; filename*=UTF-8''${encodeURIComponent(folder.name)}.zip`,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });

    archive.pipe(res);

    const entries = await this.fileService.getFolderEntries(
      ownerId,
      folder.id,
      folder.name,
    );

    for (const entry of entries) {
      const data = await this.fileService.getDecryptedFileContent(entry.file);
      archive.append(data, { name: entry.path });
    }

    await archive.finalize();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    await this.fileService.softDelete(id, user.id);
    return { success: true };
  }

  @Post(':id/restore')
  restore(@CurrentUser() user: User, @Param('id') id: string) {
    return this.fileService.restore(id, user.id);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  async permanentDelete(@CurrentUser() user: User, @Param('id') id: string) {
    await this.fileService.permanentDelete(id, user.id);
  }

  @Post(':id/share')
  share(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() shareDto: ShareFileDto,
  ) {
    return this.fileService.share(id, user.id, shareDto);
  }
}
