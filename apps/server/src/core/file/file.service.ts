import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { File } from './entities/file.entity';
import { Share } from '../share/entities/share.entity';
import { StorageService } from '../storage/storage.service';
import { UserService } from '../user/user.service';
import { CreateFileDto, BLOCKED_EXTENSIONS_REGEX } from './dto/create-file.dto';
import { ShareFileDto } from '../share/dto/share-file.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class FileService {
  constructor(
    @InjectRepository(File)
    private filesRepository: Repository<File>,
    @InjectRepository(Share)
    private sharesRepository: Repository<Share>,
    private storageService: StorageService,
    private userService: UserService,
  ) {}

  async create(
    userId: string,
    createFileDto: CreateFileDto,
  ): Promise<File & { uploadUrl?: string }> {
    // Validate file extension for security
    if (
      !createFileDto.isFolder &&
      BLOCKED_EXTENSIONS_REGEX.test(createFileDto.name)
    ) {
      throw new BadRequestException(
        'File type not allowed for security reasons',
      );
    }

    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const used = Number(user.storage_used);
    const limit = Number(user.storage_limit);
    const size = Number(createFileDto.size);

    if (used + size > limit) {
      throw new BadRequestException('Storage limit exceeded');
    }

    let uploadUrl: string | undefined;
    let storagePath: string | undefined;

    if (!createFileDto.isFolder) {
      const presigned = await this.storageService.getPresignedUploadUrl(
        createFileDto.name,
        createFileDto.mimeType,
      );
      uploadUrl = presigned.uploadUrl;
      storagePath = presigned.storagePath;
    }

    const file = this.filesRepository.create({
      owner_id: userId,
      name: createFileDto.name,
      size: createFileDto.size,
      mime_type: createFileDto.mimeType,
      parent_id: createFileDto.parentId,
      is_folder: createFileDto.isFolder || false,
      storage_path: storagePath,
    });

    const savedFile = await this.filesRepository.save(file);

    if (!createFileDto.isFolder) {
      await this.userService.updateStorageUsed(userId, createFileDto.size);
    }

    return { ...savedFile, uploadUrl };
  }

  async findAll(
    userId: string,
    page = 1,
    limit = 50,
    search?: string,
    parentId?: string,
  ): Promise<{ items: File[]; total: number }> {
    const query = this.filesRepository
      .createQueryBuilder('file')
      .where('file.owner_id = :userId', { userId })
      .andWhere('file.deleted_at IS NULL');

    if (search) {
      query.andWhere('file.name ILIKE :search', { search: `%${search}%` });
    }

    if (parentId) {
      query.andWhere('file.parent_id = :parentId', { parentId });
    } else {
      query.andWhere('file.parent_id IS NULL');
    }

    const [items, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('file.is_folder', 'DESC')
      .addOrderBy('file.created_at', 'DESC')
      .getManyAndCount();

    return { items, total };
  }

  async findById(id: string, userId: string): Promise<File> {
    const file = await this.filesRepository.findOne({
      where: { id, owner_id: userId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const file = await this.findById(id, userId);
    file.deleted_at = new Date();
    await this.filesRepository.save(file);
  }

  async restore(id: string, userId: string): Promise<File> {
    const file = await this.filesRepository.findOne({
      where: { id, owner_id: userId, deleted_at: Not(IsNull()) },
    });

    if (!file) {
      throw new NotFoundException('File not found in trash');
    }

    file.deleted_at = null;
    return this.filesRepository.save(file);
  }

  async permanentDelete(id: string, userId: string): Promise<void> {
    const file = await this.filesRepository.findOne({
      where: { id, owner_id: userId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.storage_path) {
      await this.storageService.deleteObject(file.storage_path);
      await this.userService.updateStorageUsed(userId, -file.size);
    }

    await this.filesRepository.delete(id);
  }

  async share(
    fileId: string,
    userId: string,
    shareDto: ShareFileDto,
  ): Promise<Share & { publicLink?: string | null }> {
    const file = await this.findById(fileId, userId);

    const share = this.sharesRepository.create({
      file_id: file.id,
      grantee_user_id: shareDto.toUserId,
      grantee_email: shareDto.email,
      permission: shareDto.permission,
      created_by: userId,
      is_public: shareDto.isPublic || false,
      share_token: shareDto.isPublic
        ? randomBytes(16).toString('hex')
        : undefined,
    });

    const saved = await this.sharesRepository.save(share);

    return {
      ...saved,
      publicLink: shareDto.isPublic
        ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${saved.share_token}`
        : null,
    };
  }

  async getSharedWithMe(userId: string): Promise<Share[]> {
    return this.sharesRepository.find({
      where: { grantee_user_id: userId },
      relations: ['file', 'file.owner'],
    });
  }

  async getTrashedFiles(
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<{ items: File[]; total: number }> {
    const [items, total] = await this.filesRepository.findAndCount({
      where: { owner_id: userId, deleted_at: Not(IsNull()) },
      skip: (page - 1) * limit,
      take: limit,
      order: { deleted_at: 'DESC' },
    });

    return { items, total };
  }

  async getDownloadUrl(id: string, userId: string): Promise<string> {
    const file = await this.findById(id, userId);

    if (file.is_folder) {
      throw new BadRequestException('Cannot download a folder');
    }

    if (!file.storage_path) {
      throw new NotFoundException('File storage path not found');
    }

    return this.storageService.getPresignedDownloadUrl(file.storage_path);
  }

  async getFileByShareToken(token: string): Promise<File | null> {
    const share = await this.sharesRepository.findOne({
      where: { share_token: token, is_public: true },
      relations: ['file'],
    });
    return share?.file || null;
  }

  async getPublicShare(token: string) {
    const share = await this.sharesRepository.findOne({
      where: { share_token: token, is_public: true },
      relations: ['file', 'file.owner'],
    });

    if (!share) {
      throw new NotFoundException('Public share not found');
    }

    const file = share.file;
    const downloadUrl =
      !file.is_folder && file.storage_path
        ? await this.storageService.getPresignedDownloadUrl(file.storage_path)
        : null;

    return {
      name: file.name,
      size: file.size,
      mimeType: file.mime_type,
      owner: file.owner.name,
      createdAt: file.created_at,
      downloadUrl,
    };
  }

  async getPublicSharesByUser(userId: string): Promise<Share[]> {
    return this.sharesRepository.find({
      where: { created_by: userId, is_public: true },
      relations: ['file'],
    });
  }

  async revokeShare(shareId: string, userId: string): Promise<void> {
    const share = await this.sharesRepository.findOne({
      where: { id: shareId, created_by: userId },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    await this.sharesRepository.delete(shareId);
  }

  async emptyTrash(userId: string): Promise<void> {
    const trashedFiles = await this.filesRepository.find({
      where: { owner_id: userId, deleted_at: Not(IsNull()) },
    });

    for (const file of trashedFiles) {
      if (file.storage_path) {
        await this.storageService.deleteObject(file.storage_path);
        await this.userService.updateStorageUsed(userId, -file.size);
      }
      await this.filesRepository.delete(file.id);
    }
  }
}
