import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { File } from './entities/file.entity';
import { Share } from '../share/entities/share.entity';
import { StorageService } from '../storage/storage.service';
import { UserService } from '../user/user.service';
import { CreateFileDto, BLOCKED_EXTENSIONS_REGEX } from './dto/create-file.dto';
import { ShareFileDto } from '../share/dto/share-file.dto';
import { UpdatePublicShareDto } from '../share/dto/update-public-share.dto';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

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
    private configService: ConfigService,
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

  private getPublicBaseUrl(requestOrigin?: string): string {
    return (
      requestOrigin ||
      this.configService.get('FRONTEND_URL') ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');
  }

  private async assertPublicShareAccess(
    share: Pick<Share, 'expires_at' | 'password'>,
    providedPassword?: string,
  ): Promise<void> {
    if (share.expires_at && share.expires_at < new Date()) {
      throw new NotFoundException('Public share not found');
    }

    if (share.password) {
      if (!providedPassword) {
        throw new ForbiddenException('Share password required');
      }
      const isValidPassword = await bcrypt.compare(
        providedPassword,
        share.password,
      );
      if (!isValidPassword) {
        throw new ForbiddenException('Invalid share password');
      }
    }
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
   * Uploads and encrypts file content by streaming from a temp file path.
   * Never loads the full file into memory — safe for multi-gigabyte files.
   * @throws BadRequestException if file is folder or already has content
   */
  async uploadFileContentStream(
    fileId: string,
    userId: string,
    sourcePath: string,
  ): Promise<File> {
    const file = await this.findById(fileId, userId);

    if (file.is_folder) {
      throw new BadRequestException('Cannot upload content to a folder');
    }

    if (file.encrypted_dek) {
      throw new BadRequestException('File already has content uploaded');
    }

    const result = await this.storageService.uploadFileStream(
      userId,
      fileId,
      sourcePath,
    );

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
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('file.is_folder', 'DESC')
      .addOrderBy('file.created_at', 'DESC');

    const [items, total] = await query.getManyAndCount();

    if (items.length === 0) return { items, total };

    const fileIds = items.map((f) => f.id);

    // Single aggregated query for all share counts across the page —
    // replaces 3 separate loadRelationCountAndMap round-trips.
    const shareCounts: {
      fileId: string;
      total: string;
      public: string;
      private: string;
    }[] = await this.sharesRepository
      .createQueryBuilder('s')
      .select('s.file_id', 'fileId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(`COUNT(*) FILTER (WHERE s.is_public = true)`, 'public')
      .addSelect(`COUNT(*) FILTER (WHERE s.is_public = false)`, 'private')
      .where('s.file_id IN (:...ids)', { ids: fileIds })
      .groupBy('s.file_id')
      .getRawMany();

    const shareMap = new Map(
      shareCounts.map((r) => [
        r.fileId,
        {
          shareCount: Number(r.total),
          publicShareCount: Number(r.public),
          privateShareCount: Number(r.private),
        },
      ]),
    );

    // Folder sizes — one aggregate query (unchanged).
    const folderIds = items.filter((f) => f.is_folder).map((f) => f.id);
    const sizeMap = new Map<string, number>();
    if (folderIds.length > 0) {
      const folderSizes: { folderId: string; totalSize: string }[] =
        await this.filesRepository
          .createQueryBuilder('child')
          .select('child.parent_id', 'folderId')
          .addSelect('COALESCE(SUM(child.size), 0)', 'totalSize')
          .where('child.parent_id IN (:...ids)', { ids: folderIds })
          .andWhere('child.is_folder = false')
          .andWhere('child.deleted_at IS NULL')
          .groupBy('child.parent_id')
          .getRawMany();

      for (const r of folderSizes) {
        sizeMap.set(r.folderId, Number(r.totalSize));
      }
    }

    for (const item of items) {
      const counts = shareMap.get(item.id) ?? {
        shareCount: 0,
        publicShareCount: 0,
        privateShareCount: 0,
      };
      item.shareCount = counts.shareCount;
      item.publicShareCount = counts.publicShareCount;
      item.privateShareCount = counts.privateShareCount;
      if (item.is_folder) {
        item.size = sizeMap.get(item.id) ?? 0;
      }
    }

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

  /** Renames a file or folder. */
  async rename(id: string, userId: string, name: string): Promise<File> {
    if (!name || !name.trim()) {
      throw new BadRequestException('Name cannot be empty');
    }
    if (BLOCKED_EXTENSIONS_REGEX.test(name.trim())) {
      throw new BadRequestException(
        'File type not allowed for security reasons',
      );
    }
    const file = await this.findById(id, userId);
    file.name = name.trim();
    return this.filesRepository.save(file);
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

    // Single UPDATE for all metadata rows.
    await this.filesRepository.update(
      { id: In(files.map((f) => f.id)) },
      { deleted_at: now },
    );

    // Move physical files that have no other active metadata references.
    for (const file of files) {
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
    requestOrigin?: string,
  ): Promise<Share & { publicLink?: string | null }> {
    const file = await this.findById(fileId, userId);

    if (shareDto.toUserId && shareDto.toUserId === userId) {
      throw new BadRequestException('Cannot share with yourself');
    }

    const publicBaseUrl = this.getPublicBaseUrl(requestOrigin);

    if (shareDto.isPublic) {
      const existingPublicShare = await this.sharesRepository.findOne({
        where: {
          file_id: file.id,
          created_by: userId,
          is_public: true,
        },
      });

      if (existingPublicShare) {
        if (shareDto.password) {
          existingPublicShare.password = await bcrypt.hash(
            shareDto.password,
            12,
          );
        }
        if (shareDto.expiresAt) {
          existingPublicShare.expires_at = new Date(shareDto.expiresAt);
        }
        if (!existingPublicShare.share_token) {
          existingPublicShare.share_token = randomBytes(16).toString('hex');
        }
        await this.sharesRepository.save(existingPublicShare);

        return {
          ...existingPublicShare,
          publicLink: `${publicBaseUrl}/share/${existingPublicShare.share_token}`,
        };
      }
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
      expires_at: shareDto.expiresAt ? new Date(shareDto.expiresAt) : undefined,
      password:
        shareDto.isPublic && shareDto.password
          ? await bcrypt.hash(shareDto.password, 12)
          : undefined,
    });

    const saved = await this.sharesRepository.save(share);

    return {
      ...saved,
      publicLink: shareDto.isPublic
        ? `${publicBaseUrl}/share/${saved.share_token}`
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

  /**
   * Returns all file entries under a folder, iterating breadth-first.
   * Avoids unbounded call-stack growth for deeply nested folder trees.
   */
  async getFolderEntries(
    ownerId: string,
    folderId: string,
    basePath: string,
  ): Promise<Array<{ file: File; path: string }>> {
    const entries: Array<{ file: File; path: string }> = [];
    const queue: Array<{ id: string; path: string }> = [
      { id: folderId, path: basePath },
    ];

    while (queue.length > 0) {
      const { id: currentId, path: currentPath } = queue.shift()!;

      const children = await this.filesRepository.find({
        where: {
          owner_id: ownerId,
          parent_id: currentId,
          deleted_at: IsNull(),
        },
      });

      for (const child of children) {
        const childPath = `${currentPath}/${child.name}`;
        if (child.is_folder) {
          queue.push({ id: child.id, path: childPath });
        } else {
          entries.push({ file: child, path: childPath });
        }
      }
    }

    return entries;
  }

  async getDecryptedFileContent(file: File): Promise<Buffer> {
    if (!file.storage_path || !file.encrypted_dek || !file.encryption_iv) {
      throw new NotFoundException('File content not found');
    }

    const { ownerId, fileId } = this.resolveStorageTarget(file);
    return this.storageService.downloadFile(
      ownerId,
      fileId,
      file.encrypted_dek,
      file.encryption_iv,
    );
  }

  async getSharedWithMe(
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<{ items: Share[]; total: number }> {
    const [items, total] = await this.sharesRepository.findAndCount({
      where: { grantee_user_id: userId },
      relations: ['file', 'file.owner'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { items, total };
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
    if (!share) return null;

    try {
      await this.assertPublicShareAccess(share, undefined);
      return share.file;
    } catch {
      return null;
    }
  }

  async getPublicShare(token: string, password?: string) {
    const share = await this.sharesRepository.findOne({
      where: { share_token: token, is_public: true },
      relations: ['file', 'file.owner'],
    });

    if (!share) {
      throw new NotFoundException('Public share not found');
    }
    await this.assertPublicShareAccess(share, password);

    const file = share.file;

    return {
      id: file.id,
      name: file.name,
      size: file.size,
      mimeType: file.mime_type,
      owner: file.owner.name,
      createdAt: file.created_at,
      isFolder: file.is_folder,
      hasContent: !!(file.encrypted_dek && file.encryption_iv),
    };
  }

  async downloadPublicFile(
    token: string,
    password?: string,
  ): Promise<{ data: Buffer; file: File }> {
    const share = await this.sharesRepository.findOne({
      where: { share_token: token, is_public: true },
      relations: ['file'],
    });

    if (!share) {
      throw new NotFoundException('Public share not found');
    }
    await this.assertPublicShareAccess(share, password);

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

  async getPublicSharesByUser(
    userId: string,
  ): Promise<Array<Share & { hasPassword: boolean }>> {
    const shares = await this.sharesRepository.find({
      where: { created_by: userId, is_public: true },
      relations: ['file'],
    });
    return shares.map((share) => {
      const { password, ...rest } = share;
      return {
        ...rest,
        hasPassword: Boolean(password),
      };
    });
  }

  async getPrivateSharesByUser(
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<{ items: Share[]; total: number }> {
    const [items, total] = await this.sharesRepository.findAndCount({
      where: { created_by: userId, is_public: false },
      relations: ['file', 'grantee_user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { items, total };
  }

  async updatePublicShareSettings(
    shareId: string,
    userId: string,
    updateDto: UpdatePublicShareDto,
    requestOrigin?: string,
  ): Promise<Share & { publicLink: string }> {
    const share = await this.sharesRepository.findOne({
      where: { id: shareId, created_by: userId, is_public: true },
    });

    if (!share) {
      throw new NotFoundException('Public share not found');
    }

    if (updateDto.clearPassword) {
      share.password = null;
    } else if (updateDto.password) {
      share.password = await bcrypt.hash(updateDto.password, 12);
    }

    if (updateDto.clearExpiry) {
      share.expires_at = null;
    } else if (updateDto.expiresAt) {
      share.expires_at = new Date(updateDto.expiresAt);
    }

    if (!share.share_token) {
      share.share_token = randomBytes(16).toString('hex');
    }

    const saved = await this.sharesRepository.save(share);
    const publicBaseUrl = this.getPublicBaseUrl(requestOrigin);

    return {
      ...saved,
      publicLink: `${publicBaseUrl}/share/${saved.share_token}`,
    };
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

    if (trashedFiles.length === 0) return;

    let totalSizeFreed = 0;

    for (const file of trashedFiles) {
      if (!file.is_folder && file.storage_path) {
        const hasAnyRefs = await this.hasAnyStorageReferences(
          file.storage_path,
          file.id,
        );
        if (!hasAnyRefs) {
          const target = this.resolveStorageTarget(file);
          await this.storageService.deleteFile(target.ownerId, target.fileId);
          const fileSize = Number(file.size);
          if (fileSize > 0) totalSizeFreed += fileSize;
        }
      } else if (!file.is_folder) {
        const fileSize = Number(file.size);
        if (fileSize > 0) totalSizeFreed += fileSize;
      }
    }

    // Single DELETE for all metadata rows.
    await this.filesRepository.delete({
      owner_id: userId,
      deleted_at: Not(IsNull()),
    });

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
