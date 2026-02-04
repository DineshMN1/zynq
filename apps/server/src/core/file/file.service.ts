import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, In } from 'typeorm';
import { File } from './entities/file.entity';
import { Share } from '../share/entities/share.entity';
import { StorageService } from '../storage/storage.service';
import { UserService } from '../user/user.service';
import { CreateFileDto, BLOCKED_EXTENSIONS_REGEX } from './dto/create-file.dto';
import { ShareFileDto } from '../share/dto/share-file.dto';
import { randomBytes } from 'crypto';
import { Readable } from 'stream';

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

    // Check quota (owner has unlimited storage)
    if (user.role !== 'owner' && used + size > limit) {
      throw new BadRequestException('Storage limit exceeded');
    }

    // Check for duplicate content if hash is provided and not a folder
    if (createFileDto.fileHash && !createFileDto.isFolder) {
      const duplicates = await this.findDuplicatesByHash(
        userId,
        createFileDto.fileHash,
      );

      if (duplicates.length > 0) {
        throw new ConflictException({
          message: 'Duplicate content detected',
          duplicates: duplicates.map((file) => ({
            id: file.id,
            name: file.name,
            size: file.size,
            mime_type: file.mime_type,
            created_at: file.created_at,
            parent_id: file.parent_id,
            storage_path: file.storage_path,
          })),
        });
      }
    }

    // Create file record first
    const file = this.filesRepository.create({
      owner_id: userId,
      name: createFileDto.name,
      size: createFileDto.size,
      mime_type: createFileDto.mimeType,
      parent_id: createFileDto.parentId,
      is_folder: createFileDto.isFolder || false,
      file_hash: createFileDto.fileHash,
    });

    const savedFile = await this.filesRepository.save(file);

    if (!createFileDto.isFolder) {
      await this.userService.updateStorageUsed(userId, createFileDto.size);
    }

    // For non-folders, return with upload endpoint info
    // The actual upload happens via a separate endpoint
    return {
      ...savedFile,
      uploadUrl: createFileDto.isFolder
        ? undefined
        : `/api/v1/files/${savedFile.id}/upload`,
    };
  }

  async uploadFileContent(
    fileId: string,
    userId: string,
    data: Buffer,
  ): Promise<File> {
    const file = await this.findById(fileId, userId);

    if (file.is_folder) {
      throw new BadRequestException('Cannot upload content to a folder');
    }

    if (file.encrypted_dek) {
      throw new BadRequestException('File already has content uploaded');
    }

    // Upload and encrypt the file
    const result = await this.storageService.uploadFile(userId, fileId, data);

    // Update file with encryption metadata
    file.storage_path = result.storagePath;
    file.encrypted_dek = result.encryptedDek;
    file.encryption_iv = result.iv;
    file.encryption_algo = result.algorithm;

    return this.filesRepository.save(file);
  }

  async uploadFileStream(
    fileId: string,
    userId: string,
    stream: Readable,
  ): Promise<File> {
    const file = await this.findById(fileId, userId);

    if (file.is_folder) {
      throw new BadRequestException('Cannot upload content to a folder');
    }

    if (file.encrypted_dek) {
      throw new BadRequestException('File already has content uploaded');
    }

    // Upload and encrypt the file
    const result = await this.storageService.uploadFileStream(
      userId,
      fileId,
      stream,
    );

    // Update file with encryption metadata
    file.storage_path = result.storagePath;
    file.encrypted_dek = result.encryptedDek;
    file.encryption_iv = result.iv;
    file.encryption_algo = result.algorithm;

    return this.filesRepository.save(file);
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

    // Move file to trash in storage
    if (!file.is_folder && file.storage_path) {
      await this.storageService.moveToTrash(userId, id);
    }
  }

  async bulkSoftDelete(
    ids: string[],
    userId: string,
  ): Promise<{ deleted: number }> {
    const files = await this.filesRepository.find({
      where: {
        id: In(ids),
        owner_id: userId,
        deleted_at: IsNull(),
      },
    });

    if (files.length === 0) {
      return { deleted: 0 };
    }

    const now = new Date();
    for (const file of files) {
      file.deleted_at = now;
      if (!file.is_folder && file.storage_path) {
        await this.storageService.moveToTrash(userId, file.id);
      }
    }
    await this.filesRepository.save(files);

    return { deleted: files.length };
  }

  async restore(id: string, userId: string): Promise<File> {
    const file = await this.filesRepository.findOne({
      where: { id, owner_id: userId, deleted_at: Not(IsNull()) },
    });

    if (!file) {
      throw new NotFoundException('File not found in trash');
    }

    file.deleted_at = null;

    // Restore file from trash in storage
    if (!file.is_folder && file.storage_path) {
      await this.storageService.restoreFromTrash(userId, id);
    }

    return this.filesRepository.save(file);
  }

  async permanentDelete(id: string, userId: string): Promise<void> {
    const file = await this.filesRepository.findOne({
      where: { id, owner_id: userId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Delete physical file and update storage
    if (!file.is_folder) {
      if (file.storage_path) {
        await this.storageService.deleteFile(userId, id);
      }
      // Always update storage for non-folders (size is bigint, convert to number)
      const fileSize = Number(file.size);
      if (fileSize > 0) {
        await this.userService.updateStorageUsed(userId, -fileSize);
      }
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

  async downloadFile(id: string, userId: string): Promise<Buffer> {
    const file = await this.findById(id, userId);

    if (file.is_folder) {
      throw new BadRequestException('Cannot download a folder');
    }

    if (!file.storage_path || !file.encrypted_dek || !file.encryption_iv) {
      throw new NotFoundException('File content not found');
    }

    return this.storageService.downloadFile(
      userId,
      id,
      file.encrypted_dek,
      file.encryption_iv,
    );
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

    return {
      id: file.id,
      name: file.name,
      size: file.size,
      mimeType: file.mime_type,
      owner: file.owner.name,
      ownerId: file.owner_id,
      createdAt: file.created_at,
      isFolder: file.is_folder,
      hasContent: !!(file.encrypted_dek && file.encryption_iv),
    };
  }

  async downloadPublicFile(
    token: string,
  ): Promise<{ data: Buffer; file: File }> {
    const share = await this.sharesRepository.findOne({
      where: { share_token: token, is_public: true },
      relations: ['file'],
    });

    if (!share) {
      throw new NotFoundException('Public share not found');
    }

    const file = share.file;

    if (file.is_folder) {
      throw new BadRequestException('Cannot download a folder');
    }

    if (!file.storage_path || !file.encrypted_dek || !file.encryption_iv) {
      throw new NotFoundException('File content not found');
    }

    const data = await this.storageService.downloadFile(
      file.owner_id,
      file.id,
      file.encrypted_dek,
      file.encryption_iv,
    );

    return { data, file };
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

    let totalSizeFreed = 0;

    for (const file of trashedFiles) {
      // Delete physical file if it exists
      if (!file.is_folder && file.storage_path) {
        await this.storageService.deleteFile(userId, file.id);
      }

      // Track size for non-folders (convert bigint to number)
      if (!file.is_folder) {
        const fileSize = Number(file.size);
        if (fileSize > 0) {
          totalSizeFreed += fileSize;
        }
      }

      await this.filesRepository.delete(file.id);
    }

    // Update storage usage in one call for efficiency
    if (totalSizeFreed > 0) {
      await this.userService.updateStorageUsed(userId, -totalSizeFreed);
    }
  }

  async findDuplicatesByHash(
    userId: string,
    fileHash: string,
  ): Promise<File[]> {
    return this.filesRepository.find({
      where: {
        owner_id: userId,
        file_hash: fileHash,
        deleted_at: IsNull(),
        is_folder: false,
      },
      order: { created_at: 'DESC' },
      take: 10,
    });
  }

  async checkDuplicate(
    userId: string,
    fileHash: string,
  ): Promise<{ isDuplicate: boolean; files: File[] }> {
    const duplicates = await this.findDuplicatesByHash(userId, fileHash);
    return {
      isDuplicate: duplicates.length > 0,
      files: duplicates,
    };
  }
}
