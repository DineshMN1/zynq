import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FileService } from './file.service';
import { File } from './entities/file.entity';
import { Share, SharePermission } from '../share/entities/share.entity';
import { StorageService } from '../storage/storage.service';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/entities/user.entity';

describe('FileService', () => {
  let service: FileService;
  let filesRepository: jest.Mocked<Repository<File>>;
  let sharesRepository: jest.Mocked<Repository<Share>>;
  let storageService: jest.Mocked<StorageService>;
  let userService: jest.Mocked<UserService>;

  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    role: UserRole.USER,
    storage_used: 1000,
    storage_limit: 10737418240,
  };

  const mockFile: Partial<File> = {
    id: 'file-123',
    owner_id: 'user-123',
    name: 'test.pdf',
    size: 1024,
    mime_type: 'application/pdf',
    is_folder: false,
    storage_path: 'uuid-test.pdf',
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        {
          provide: getRepositoryToken(File),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Share),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: StorageService,
          useValue: {
            getPresignedUploadUrl: jest.fn(),
            getPresignedDownloadUrl: jest.fn(),
            deleteObject: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            findById: jest.fn(),
            updateStorageUsed: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FileService>(FileService);
    filesRepository = module.get(getRepositoryToken(File));
    sharesRepository = module.get(getRepositoryToken(Share));
    storageService = module.get(StorageService);
    userService = module.get(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a file with presigned upload URL', async () => {
      userService.findById.mockResolvedValue(mockUser as any);
      storageService.getPresignedUploadUrl.mockResolvedValue({
        uploadUrl: 'https://s3.example.com/upload',
        storagePath: 'uuid-test.pdf',
      });
      filesRepository.create.mockReturnValue(mockFile as File);
      filesRepository.save.mockResolvedValue(mockFile as File);

      const result = await service.create('user-123', {
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      });

      expect(userService.findById).toHaveBeenCalledWith('user-123');
      expect(storageService.getPresignedUploadUrl).toHaveBeenCalledWith('test.pdf', 'application/pdf');
      expect(filesRepository.save).toHaveBeenCalled();
      expect(userService.updateStorageUsed).toHaveBeenCalledWith('user-123', 1024);
      expect(result.uploadUrl).toBe('https://s3.example.com/upload');
    });

    it('should throw NotFoundException if user not found', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(
        service.create('nonexistent', {
          name: 'test.pdf',
          size: 1024,
          mimeType: 'application/pdf',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if storage limit exceeded', async () => {
      userService.findById.mockResolvedValue({
        ...mockUser,
        storage_used: 10737418240,
        storage_limit: 10737418240,
      } as any);

      await expect(
        service.create('user-123', {
          name: 'test.pdf',
          size: 1024,
          mimeType: 'application/pdf',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for blocked file extension', async () => {
      userService.findById.mockResolvedValue(mockUser as any);

      await expect(
        service.create('user-123', {
          name: 'malware.exe',
          size: 1024,
          mimeType: 'application/octet-stream',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create folder without presigned URL', async () => {
      userService.findById.mockResolvedValue(mockUser as any);
      const folderFile = { ...mockFile, is_folder: true, storage_path: null };
      filesRepository.create.mockReturnValue(folderFile as File);
      filesRepository.save.mockResolvedValue(folderFile as File);

      const result = await service.create('user-123', {
        name: 'My Folder',
        size: 0,
        mimeType: 'application/x-directory',
        isFolder: true,
      });

      expect(storageService.getPresignedUploadUrl).not.toHaveBeenCalled();
      expect(userService.updateStorageUsed).not.toHaveBeenCalled();
      expect(result.uploadUrl).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated files', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockFile], 1]);

      const result = await service.findAll('user-123', 1, 50);

      expect(filesRepository.createQueryBuilder).toHaveBeenCalledWith('file');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('file.owner_id = :userId', {
        userId: 'user-123',
      });
      expect(result).toEqual({ items: [mockFile], total: 1 });
    });

    it('should filter by search term', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll('user-123', 1, 50, 'test');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('file.name ILIKE :search', {
        search: '%test%',
      });
    });

    it('should filter by parent folder', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll('user-123', 1, 50, undefined, 'folder-123');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('file.parent_id = :parentId', {
        parentId: 'folder-123',
      });
    });
  });

  describe('findById', () => {
    it('should return file if found', async () => {
      filesRepository.findOne.mockResolvedValue(mockFile as File);

      const result = await service.findById('file-123', 'user-123');

      expect(filesRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'file-123', owner_id: 'user-123' },
      });
      expect(result).toEqual(mockFile);
    });

    it('should throw NotFoundException if file not found', async () => {
      filesRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('softDelete', () => {
    it('should mark file as deleted', async () => {
      filesRepository.findOne.mockResolvedValue(mockFile as File);
      filesRepository.save.mockResolvedValue({ ...mockFile, deleted_at: new Date() } as File);

      await service.softDelete('file-123', 'user-123');

      expect(filesRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(Date) }),
      );
    });
  });

  describe('restore', () => {
    it('should restore deleted file', async () => {
      const deletedFile = { ...mockFile, deleted_at: new Date() };
      filesRepository.findOne.mockResolvedValue(deletedFile as File);
      filesRepository.save.mockResolvedValue({ ...mockFile, deleted_at: null } as File);

      const result = await service.restore('file-123', 'user-123');

      expect(result.deleted_at).toBeNull();
    });

    it('should throw NotFoundException if file not in trash', async () => {
      filesRepository.findOne.mockResolvedValue(null);

      await expect(service.restore('file-123', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('permanentDelete', () => {
    it('should permanently delete file and update storage', async () => {
      filesRepository.findOne.mockResolvedValue(mockFile as File);

      await service.permanentDelete('file-123', 'user-123');

      expect(storageService.deleteObject).toHaveBeenCalledWith('uuid-test.pdf');
      expect(userService.updateStorageUsed).toHaveBeenCalledWith('user-123', -1024);
      expect(filesRepository.delete).toHaveBeenCalledWith('file-123');
    });

    it('should throw NotFoundException if file not found', async () => {
      filesRepository.findOne.mockResolvedValue(null);

      await expect(service.permanentDelete('nonexistent', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDownloadUrl', () => {
    it('should return presigned download URL', async () => {
      filesRepository.findOne.mockResolvedValue(mockFile as File);
      storageService.getPresignedDownloadUrl.mockResolvedValue(
        'https://s3.example.com/download',
      );

      const result = await service.getDownloadUrl('file-123', 'user-123');

      expect(result).toBe('https://s3.example.com/download');
    });

    it('should throw BadRequestException for folders', async () => {
      filesRepository.findOne.mockResolvedValue({ ...mockFile, is_folder: true } as File);

      await expect(service.getDownloadUrl('folder-123', 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('share', () => {
    it('should create a public share with token', async () => {
      filesRepository.findOne.mockResolvedValue(mockFile as File);
      const mockShare = {
        id: 'share-123',
        file_id: 'file-123',
        is_public: true,
        share_token: 'abc123',
      };
      sharesRepository.create.mockReturnValue(mockShare as any);
      sharesRepository.save.mockResolvedValue(mockShare as any);

      const result = await service.share('file-123', 'user-123', {
        permission: SharePermission.READ,
        isPublic: true,
      });

      expect(result.is_public).toBe(true);
      expect(result.publicLink).toContain('/share/');
    });
  });

  describe('getTrashedFiles', () => {
    it('should return trashed files', async () => {
      const trashedFile = { ...mockFile, deleted_at: new Date() };
      filesRepository.findAndCount.mockResolvedValue([[trashedFile as File], 1]);

      const result = await service.getTrashedFiles('user-123', 1, 50);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('emptyTrash', () => {
    it('should delete all trashed files', async () => {
      const trashedFiles = [mockFile, { ...mockFile, id: 'file-456' }];
      filesRepository.find.mockResolvedValue(trashedFiles as File[]);

      await service.emptyTrash('user-123');

      expect(storageService.deleteObject).toHaveBeenCalledTimes(2);
      expect(userService.updateStorageUsed).toHaveBeenCalledTimes(2);
      expect(filesRepository.delete).toHaveBeenCalledTimes(2);
    });
  });
});
