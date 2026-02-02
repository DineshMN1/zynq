import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileService } from '../file.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../user/entities/user.entity';
import { CreateFileDto } from '../dto/create-file.dto';
import { ShareFileDto } from '../../share/dto/share-file.dto';

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
      items,
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

  @Post('check-duplicate')
  async checkDuplicate(
    @CurrentUser() user: User,
    @Body() body: { fileHash: string },
  ) {
    return this.fileService.checkDuplicate(user.id, body.fileHash);
  }

  // ========================================
  // PARAMETERIZED ROUTES LAST
  // ========================================

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.fileService.findById(id, user.id);
  }

  @Get(':id/download')
  async getDownloadUrl(@CurrentUser() user: User, @Param('id') id: string) {
    const url = await this.fileService.getDownloadUrl(id, user.id);
    return { url };
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
