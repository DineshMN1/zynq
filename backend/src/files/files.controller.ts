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
  Req,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CreateFileDto } from './dto/create-file.dto';
import { ShareFileDto } from './dto/share-file.dto';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('parentId') parentId?: string,
  ) {
    const { items, total } = await this.filesService.findAll(
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
    return this.filesService.create(user.id, createFileDto);
  }

  @Get('shared')
  getShared(@CurrentUser() user: User) {
    return this.filesService.getSharedWithMe(user.id);
  }

  // KEEP THIS — the correct Trash endpoint
  @Get('trash')
  async getTrashed(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { items, total } = await this.filesService.getTrashedFiles(
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

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.filesService.findById(id, user.id);
  }

  @Get(':id/download')
  async getDownloadUrl(@CurrentUser() user: User, @Param('id') id: string) {
    const url = await this.filesService.getDownloadUrl(id, user.id);
    return { url };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    await this.filesService.softDelete(id, user.id);
    return { success: true };
  }

  @Post(':id/restore')
  restore(@CurrentUser() user: User, @Param('id') id: string) {
    return this.filesService.restore(id, user.id);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  async permanentDelete(@CurrentUser() user: User, @Param('id') id: string) {
    await this.filesService.permanentDelete(id, user.id);
  }

  @Post(':id/share')
  share(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() shareDto: ShareFileDto,
  ) {
    return this.filesService.share(id, user.id, shareDto);
  }

  // ✅ PUBLIC SHARE ROUTE (no auth)
@Get('public/:token')
async getPublicShare(@Param('token') token: string) {
  return this.filesService.getPublicShare(token);
}


@Get('public-shares')
getPublicShares(@CurrentUser() user: User) {
  return this.filesService.getPublicSharesByUser(user.id);
}

@Delete('trash/empty')
@HttpCode(HttpStatus.NO_CONTENT)
async emptyTrash(@CurrentUser() user: User) {
  await this.filesService.emptyTrash(user.id);
}


}
