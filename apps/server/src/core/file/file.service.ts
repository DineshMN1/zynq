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

// File types that support duplicate detection
const DOCUMENT_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'md',
  'csv',
];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
const DEDUP_EXTENSIONS = [...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS];

/**
 * Checks if a file type should have duplicate detection enabled.
 * Only Documents and Images are checked for duplicates.
 */
function shouldCheckDuplicates(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return DEDUP_EXTENSIONS.includes(ext);
}

/**
 * Manages file and folder CRUD operations, uploads, downloads, sharing, and trash.
 * Handles encryption, deduplication, and storage quota enforcement.
 */
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

  private resolveStorageTarget(
    file: Pick<File, 'owner_id' | 'id' | 'storage_path'>,
  ): {
    ownerId: string;
    fileId: string;
  } {
    if (file.storage_path) {
      const match = file.storage_path.match(/^([^/]+)\/(.+)\.enc$/);
      if (match) {
        return { ownerId: match[1], fileId: match[2] };
      }
    }
    return { ownerId: file.owner_id, fileId: file.id };
  }

  private async hasActiveStorageReferences(
    storagePath: string,
    excludeFileId: string,
  ): Promise<boolean> {
    const refs = await this.filesRepository.count({
      where: {
        id: Not(excludeFileId),
        is_folder: false,
        storage_path: storagePath,
        deleted_at: IsNull(),
      },
    });
    return refs > 0;
  }

  private async hasAnyStorageReferences(
    storagePath: string,
    excludeFileId: string,
  ): Promise<boolean> {
    const refs = await this.filesRepository.count({
      where: {
        id: Not(excludeFileId),
        is_folder: false,
        storage_path: storagePath,
      },
    });
    return refs > 0;
  }

  /**
   * Creates a file/folder record. For files, returns uploadUrl for content upload.
   * Validates extension, checks quota, and detects duplicates via SHA-256 hash.
   * @throws BadRequestException if extension blocked or quota exceeded
   * @throws ConflictException if duplicate content detected
   */
  async create(
    userId: string,
    createFileDto: CreateFileDto,
  ): Promise<File & { uploadUrl?: string }> {
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

    // Check quota (owner has unlimited, limit=0 means unlimited)
    if (user.role !== 'owner' && limit > 0 && used + size > limit) {
      throw new BadRequestException('Storage limit exceeded');
    }

    // Validate and check for duplicate content if hash is provided
    // Only check duplicates for Documents and Images (not Videos, Audio, Archives, Code, etc.)
    if (createFileDto.fileHash && !createFileDto.isFolder) {
      // Validate SHA-256 hash format (64 hex characters)
      if (!/^[a-f0-9]{64}$/i.test(createFileDto.fileHash)) {
        throw new BadRequestException(
          'Invalid file hash format. Expected SHA-256 (64 hex characters)',
        );
      }

      // Only check duplicates for document and image file types
      const checkDuplicates =
        shouldCheckDuplicates(createFileDto.name) &&
        !createFileDto.skipDuplicateCheck;

      if (checkDuplicates) {
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
    }

    // "Upload anyway" for duplicates: create new metadata that points to the
    // existing encrypted content, without uploading bytes again.
    if (
      createFileDto.fileHash &&
      !createFileDto.isFolder &&
      createFileDto.skipDuplicateCheck &&
      shouldCheckDuplicates(createFileDto.name)
    ) {
      const existing = await this.filesRepository.findOne({
        where: {
          owner_id: userId,
          file_hash: createFileDto.fileHash,
          deleted_at: IsNull(),
          is_folder: false,
          storage_path: Not(IsNull()),
          encrypted_dek: Not(IsNull()),
          encryption_iv: Not(IsNull()),
        },
        order: { created_at: 'DESC' },
      });

      if (existing) {
        const linkedFile = this.filesRepository.create({
          owner_id: userId,
          name: createFileDto.name,
          size: createFileDto.size,
          mime_type: createFileDto.mimeType,
          parent_id: createFileDto.parentId,
          is_folder: false,
          file_hash: createFileDto.fileHash,
          storage_path: existing.storage_path,
          encrypted_dek: existing.encrypted_dek,
          encryption_iv: existing.encryption_iv,
          encryption_algo: existing.encryption_algo,
        });

        const savedLinkedFile = await this.filesRepository.save(linkedFile);
        return {
          ...savedLinkedFile,
          uploadUrl: undefined,
        };
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

  /**
   * Uploads and encrypts file content from buffer.
   * Stores encrypted data and updates file with encryption metadata.
   * @throws BadRequestException if file is folder or already has content
   */
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

  /**
   * Lists user's files with pagination, search, and folder filtering.
   * Excludes soft-deleted files. Folders sorted first.
   */
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

    query
      .loadRelationCountAndMap('file.shareCount', 'file.shares')
      .loadRelationCountAndMap(
        'file.publicShareCount',
        'file.shares',
        'publicShares',
        (qb) => qb.andWhere('publicShares.is_public = true'),
      )
      .loadRelationCountAndMap(
        'file.privateShareCount',
        'file.shares',
        'privateShares',
        (qb) => qb.andWhere('privateShares.is_public = false'),
      )
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('file.is_folder', 'DESC')
      .addOrderBy('file.created_at', 'DESC');

    const [items, total] = await query.getManyAndCount();

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

  /** Moves file to trash (soft delete). File can be restored later. */
  async softDelete(id: string, userId: string): Promise<void> {
    const file = await this.findById(id, userId);
    file.deleted_at = new Date();
    await this.filesRepository.save(file);

    // Move file to trash in storage
    if (!file.is_folder && file.storage_path) {
      const hasActiveRefs = await this.hasActiveStorageReferences(
        file.storage_path,
        file.id,
      );
      if (!hasActiveRefs) {
        const target = this.resolveStorageTarget(file);
        await this.storageService.moveToTrash(target.ownerId, target.fileId);
      }
    }
  }

  /** Moves multiple files to trash in bulk. */
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
      await this.filesRepository.save(file);
      if (!file.is_folder && file.storage_path) {
        const hasActiveRefs = await this.hasActiveStorageReferences(
          file.storage_path,
          file.id,
        );
        if (!hasActiveRefs) {
          const target = this.resolveStorageTarget(file);
          await this.storageService.moveToTrash(target.ownerId, target.fileId);
        }
      }
    }

    return { deleted: files.length };
  }

  /** Restores file from trash. */
  async restore(id: string, userId: string): Promise<File> {
    const file = await this.filesRepository.findOne({
      where: { id, owner_id: userId, deleted_at: Not(IsNull()) },
    });

    if (!file) {
      throw new NotFoundException('File not found in trash');
    }

    if (!file.is_folder && file.storage_path) {
      const hasActiveRefs = await this.hasActiveStorageReferences(
        file.storage_path,
        file.id,
      );
      if (!hasActiveRefs) {
        const target = this.resolveStorageTarget(file);
        await this.storageService.restoreFromTrash(
          target.ownerId,
          target.fileId,
        );
      }
    }

    file.deleted_at = null;
    return this.filesRepository.save(file);
  }

  /** Permanently deletes file from storage and database. Updates user quota. */
  async permanentDelete(id: string, userId: string): Promise<void> {
    const file = await this.filesRepository.findOne({
      where: { id, owner_id: userId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Delete physical file and update storage
    if (!file.is_folder) {
      let shouldDecreaseStorage = false;

      if (file.storage_path) {
        const hasAnyRefs = await this.hasAnyStorageReferences(
          file.storage_path,
          file.id,
        );
        if (!hasAnyRefs) {
          const target = this.resolveStorageTarget(file);
          await this.storageService.deleteFile(target.ownerId, target.fileId);
          shouldDecreaseStorage = true;
        }
      } else {
        shouldDecreaseStorage = true;
      }

      if (shouldDecreaseStorage) {
        const fileSize = Number(file.size);
        if (fileSize > 0) {
          await this.userService.updateStorageUsed(userId, -fileSize);
        }
      }
    }

    await this.filesRepository.delete(id);
  }

  /**
   * Creates a share for a file. Can be user-to-user or public link.
   * Public shares generate a unique token for anonymous access.
   */
  async share(
    fileId: string,
    userId: string,
    shareDto: ShareFileDto,
  ): Promise<Share & { publicLink?: string | null }> {
    const file = await this.findById(fileId, userId);

    if (shareDto.toUserId && shareDto.toUserId === userId) {
      throw new BadRequestException('Cannot share with yourself');
    }

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

  async getSharedFile(shareId: string, userId: string): Promise<File> {
    const share = await this.sharesRepository.findOne({
      where: { id: shareId, grantee_user_id: userId },
      relations: ['file', 'file.owner'],
    });

    if (!share || !share.file) {
      throw new NotFoundException('Shared file not found');
    }

    return share.file;
  }

  async getFolderEntries(
    ownerId: string,
    folderId: string,
    basePath: string,
  ): Promise<Array<{ file: File; path: string }>> {
    const children = await this.filesRepository.find({
      where: {
        owner_id: ownerId,
        parent_id: folderId,
        deleted_at: IsNull(),
      },
    });

    const entries: Array<{ file: File; path: string }> = [];

    for (const child of children) {
      const childPath = `${basePath}/${child.name}`;
      if (child.is_folder) {
        entries.push(
          ...(await this.getFolderEntries(ownerId, child.id, childPath)),
        );
      } else {
        entries.push({ file: child, path: childPath });
      }
    }

    return entries;
  }

  async getDecryptedFileContent(file: File): Promise<Buffer> {
    if (!file.storage_path || !file.encrypted_dek || !file.encryption_iv) {
      throw new NotFoundException('File content not found');
    }

    return this.storageService.downloadFile(
      this.resolveStorageTarget(file).ownerId,
      this.resolveStorageTarget(file).fileId,
      file.encrypted_dek,
      file.encryption_iv,
    );
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

  /** Downloads and decrypts file content. Returns decrypted buffer. */
  async downloadFile(id: string, userId: string): Promise<Buffer> {
    const file = await this.findById(id, userId);

    if (file.is_folder) {
      throw new BadRequestException('Cannot download a folder');
    }

    if (!file.storage_path || !file.encrypted_dek || !file.encryption_iv) {
      throw new NotFoundException('File content not found');
    }

    return this.storageService.downloadFile(
      this.resolveStorageTarget(file).ownerId,
      this.resolveStorageTarget(file).fileId,
      file.encrypted_dek,
      file.encryption_iv,
    );
  }

  async downloadSharedFile(shareId: string, userId: string): Promise<File> {
    const file = await this.getSharedFile(shareId, userId);
    return file;
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
      this.resolveStorageTarget(file).ownerId,
      this.resolveStorageTarget(file).fileId,
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

  async getPrivateSharesByUser(userId: string): Promise<Share[]> {
    return this.sharesRepository.find({
      where: { created_by: userId, is_public: false },
      relations: ['file', 'grantee_user'],
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

  /** Permanently deletes all files in user's trash. Reclaims storage quota. */
  async emptyTrash(userId: string): Promise<void> {
    const trashedFiles = await this.filesRepository.find({
      where: { owner_id: userId, deleted_at: Not(IsNull()) },
    });

    let totalSizeFreed = 0;

    for (const file of trashedFiles) {
      let shouldDecreaseStorage = false;

      if (!file.is_folder && file.storage_path) {
        const hasAnyRefs = await this.hasAnyStorageReferences(
          file.storage_path,
          file.id,
        );
        if (!hasAnyRefs) {
          const target = this.resolveStorageTarget(file);
          await this.storageService.deleteFile(target.ownerId, target.fileId);
          shouldDecreaseStorage = true;
        }
      } else if (!file.is_folder) {
        shouldDecreaseStorage = true;
      }

      if (shouldDecreaseStorage) {
        const fileSize = Number(file.size);
        if (fileSize > 0) totalSizeFreed += fileSize;
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

  /**
   * Checks if a file with the given SHA-256 hash already exists for the user.
   * Only checks duplicates for document and image file types.
   * @param fileName - Required to determine if duplicate checking applies to this file type
   */
  async checkDuplicate(
    userId: string,
    fileHash: string,
    fileName?: string,
  ): Promise<{ isDuplicate: boolean; existingFile?: File }> {
    if (!fileHash) {
      return { isDuplicate: false };
    }

    // Only check duplicates for document and image file types
    if (fileName && !shouldCheckDuplicates(fileName)) {
      return { isDuplicate: false };
    }

    // Validate SHA-256 hash format
    if (!/^[a-f0-9]{64}$/i.test(fileHash)) {
      throw new BadRequestException(
        'Invalid file hash format. Expected SHA-256 (64 hex characters)',
      );
    }

    const existingFile = await this.filesRepository.findOne({
      where: {
        owner_id: userId,
        file_hash: fileHash,
        deleted_at: IsNull(),
      },
    });

    return {
      isDuplicate: !!existingFile,
      existingFile: existingFile || undefined,
    };
  }
}
