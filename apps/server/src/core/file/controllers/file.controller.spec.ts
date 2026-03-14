import { Test, TestingModule } from '@nestjs/testing';
import { FileController } from './file.controller';
import { FileService } from '../file.service';
import { UserRole } from '../../user/entities/user.entity';

describe('FileController', () => {
  let controller: FileController;
  let fileService: jest.Mocked<FileService>;

  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    password_hash: 'hashed_password',
    role: UserRole.USER,
    storage_used: 0,
    storage_limit: 10737418240,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockFile = {
    id: 'file-123',
    name: 'test.txt',
    mime_type: 'text/plain',
    size: 1024,
    is_folder: false,
    owner_id: 'user-123',
    parent_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockResponse = {
    set: jest.fn(),
    send: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileController],
      providers: [
        {
          provide: FileService,
          useValue: {
            findAll: jest.fn(),
            create: jest.fn(),
            getTrashedFiles: jest.fn(),
            emptyTrash: jest.fn(),
            getSharedWithMe: jest.fn(),
            getPublicSharesByUser: jest.fn(),
            getPrivateSharesByUser: jest.fn(),
            revokeShare: jest.fn(),
            bulkSoftDelete: jest.fn(),
            checkDuplicate: jest.fn(),
            findById: jest.fn(),
            uploadFileContent: jest.fn(),
            uploadFileContentStream: jest.fn(),
            uploadFileContentFromStream: jest.fn(),
            downloadFile: jest.fn(),
            softDelete: jest.fn(),
            restore: jest.fn(),
            permanentDelete: jest.fn(),
            share: jest.fn(),
            getDecryptedFileContent: jest.fn(),
            getFolderEntries: jest.fn(),
            downloadSharedFile: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FileController>(FileController);
    fileService = module.get(FileService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated files', async () => {
      const files = [
        { ...mockFile, publicShareCount: 0, privateShareCount: 0 },
      ];
      fileService.findAll.mockResolvedValue({ items: files as any, total: 1 });

      const result = await controller.findAll(
        mockUser as any,
        '1',
        '50',
        undefined,
        undefined,
      );

      expect(fileService.findAll).toHaveBeenCalledWith(
        'user-123',
        1,
        50,
        undefined,
        undefined,
      );
      expect(result.items).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 50 });
    });
  });

  describe('create', () => {
    it('should delegate to fileService.create', async () => {
      const createDto = { name: 'test.txt', is_folder: false };
      fileService.create.mockResolvedValue(mockFile as any);

      const result = await controller.create(mockUser as any, createDto as any);

      expect(fileService.create).toHaveBeenCalledWith('user-123', createDto);
      expect(result).toEqual(mockFile);
    });
  });

  describe('getTrashed', () => {
    it('should return paginated trashed files', async () => {
      fileService.getTrashedFiles.mockResolvedValue({
        items: [] as any,
        total: 0,
      });

      const result = await controller.getTrashed(mockUser as any, '1', '50');

      expect(fileService.getTrashedFiles).toHaveBeenCalledWith(
        'user-123',
        1,
        50,
      );
      expect(result.items).toHaveLength(0);
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 50 });
    });
  });

  describe('emptyTrash', () => {
    it('should delegate to fileService.emptyTrash', async () => {
      fileService.emptyTrash.mockResolvedValue(undefined);

      await controller.emptyTrash(mockUser as any);

      expect(fileService.emptyTrash).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getShared', () => {
    it('should return paginated { items, meta } from fileService.getSharedWithMe', async () => {
      const sharedFiles = [mockFile];
      fileService.getSharedWithMe.mockResolvedValue({
        items: sharedFiles,
        total: 1,
      } as any);

      const result = await controller.getShared(mockUser as any);

      expect(fileService.getSharedWithMe).toHaveBeenCalledWith(
        'user-123',
        1,
        50,
      );
      expect(result).toEqual({
        items: sharedFiles,
        meta: { total: 1, page: 1, limit: 50 },
      });
    });
  });

  describe('getPublicShares', () => {
    it('should delegate to fileService.getPublicSharesByUser', () => {
      fileService.getPublicSharesByUser.mockResolvedValue([]);

      controller.getPublicShares(mockUser as any);

      expect(fileService.getPublicSharesByUser).toHaveBeenCalledWith(
        'user-123',
      );
    });
  });

  describe('getPrivateShares', () => {
    it('should return paginated { items, meta } from fileService.getPrivateSharesByUser', async () => {
      const privateShares = [{ id: 'share-1' }];
      fileService.getPrivateSharesByUser.mockResolvedValue({
        items: privateShares,
        total: 1,
      } as any);

      const result = await controller.getPrivateShares(mockUser as any);

      expect(fileService.getPrivateSharesByUser).toHaveBeenCalledWith(
        'user-123',
        1,
        50,
      );
      expect(result).toEqual({
        items: privateShares,
        meta: { total: 1, page: 1, limit: 50 },
      });
    });
  });

  describe('revokeShare', () => {
    it('should delegate to fileService.revokeShare and return success', async () => {
      fileService.revokeShare.mockResolvedValue(undefined);

      const result = await controller.revokeShare(mockUser as any, 'share-123');

      expect(fileService.revokeShare).toHaveBeenCalledWith(
        'share-123',
        'user-123',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('bulkDelete', () => {
    it('should delegate to fileService.bulkSoftDelete', async () => {
      const dto = { ids: ['file-1', 'file-2'] };
      const deleteResult = { deleted: 2 };
      fileService.bulkSoftDelete.mockResolvedValue(deleteResult as any);

      const result = await controller.bulkDelete(mockUser as any, dto as any);

      expect(fileService.bulkSoftDelete).toHaveBeenCalledWith(
        ['file-1', 'file-2'],
        'user-123',
      );
      expect(result).toEqual(deleteResult);
    });
  });

  describe('checkDuplicate', () => {
    it('should delegate to fileService.checkDuplicate', async () => {
      const body = { fileHash: 'abc123', fileName: 'test.txt' };
      const duplicateResult = { isDuplicate: false };
      fileService.checkDuplicate.mockResolvedValue(duplicateResult as any);

      const result = await controller.checkDuplicate(mockUser as any, body);

      expect(fileService.checkDuplicate).toHaveBeenCalledWith(
        'user-123',
        'abc123',
        'test.txt',
      );
      expect(result).toEqual(duplicateResult);
    });
  });

  describe('findOne', () => {
    it('should delegate to fileService.findById', () => {
      fileService.findById.mockResolvedValue(mockFile as any);

      controller.findOne(mockUser as any, 'file-123');

      expect(fileService.findById).toHaveBeenCalledWith('file-123', 'user-123');
    });
  });

  describe('uploadFileContent', () => {
    it('should delegate to fileService.uploadFileContentFromStream', async () => {
      const mockReq = { pipe: jest.fn() } as any;
      fileService.uploadFileContentFromStream.mockResolvedValue(
        mockFile as any,
      );

      await controller.uploadFileContent(mockUser as any, 'file-123', mockReq);

      expect(fileService.uploadFileContentFromStream).toHaveBeenCalledWith(
        'file-123',
        'user-123',
        mockReq,
      );
    });
  });

  describe('downloadFile', () => {
    it('should set headers and send data for non-folder files', async () => {
      const fileData = Buffer.from('file content');
      fileService.findById.mockResolvedValue(mockFile as any);
      fileService.downloadFile.mockResolvedValue(fileData);

      await controller.downloadFile(mockUser as any, 'file-123', mockResponse);

      expect(fileService.findById).toHaveBeenCalledWith('file-123', 'user-123');
      expect(fileService.downloadFile).toHaveBeenCalledWith(
        'file-123',
        'user-123',
      );
      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'text/plain',
        }),
      );
      expect(mockResponse.send).toHaveBeenCalledWith(fileData);
    });
  });

  describe('delete', () => {
    it('should delegate to fileService.softDelete and return success', async () => {
      fileService.softDelete.mockResolvedValue(undefined);

      const result = await controller.delete(mockUser as any, 'file-123');

      expect(fileService.softDelete).toHaveBeenCalledWith(
        'file-123',
        'user-123',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('restore', () => {
    it('should delegate to fileService.restore', () => {
      fileService.restore.mockResolvedValue(mockFile as any);

      controller.restore(mockUser as any, 'file-123');

      expect(fileService.restore).toHaveBeenCalledWith('file-123', 'user-123');
    });
  });

  describe('permanentDelete', () => {
    it('should delegate to fileService.permanentDelete', async () => {
      fileService.permanentDelete.mockResolvedValue(undefined);

      await controller.permanentDelete(mockUser as any, 'file-123');

      expect(fileService.permanentDelete).toHaveBeenCalledWith(
        'file-123',
        'user-123',
      );
    });
  });

  describe('share', () => {
    const originalTrustProxy = process.env.TRUST_PROXY;
    const originalFrontendUrl = process.env.FRONTEND_URL;
    const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

    afterEach(() => {
      process.env.TRUST_PROXY = originalTrustProxy;
      process.env.FRONTEND_URL = originalFrontendUrl;
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    });

    it('should delegate to fileService.share', () => {
      delete process.env.FRONTEND_URL;
      delete process.env.ALLOWED_ORIGINS;
      const shareDto = { type: 'public' };
      const shareResult = { token: 'share-token' };
      fileService.share.mockResolvedValue(shareResult as any);
      const req = {
        headers: { host: '192.168.1.10:3000' },
        protocol: 'http',
      } as any;

      controller.share(mockUser as any, 'file-123', shareDto as any, req);

      expect(fileService.share).toHaveBeenCalledWith(
        'file-123',
        'user-123',
        shareDto,
        'http://192.168.1.10:3000',
      );
    });

    it('should prefer x-forwarded-host when present', () => {
      process.env.TRUST_PROXY = 'true';
      delete process.env.FRONTEND_URL;
      delete process.env.ALLOWED_ORIGINS;
      const shareDto = { type: 'public' };
      fileService.share.mockResolvedValue({ token: 'share-token' } as any);
      const req = {
        headers: {
          'x-forwarded-host': 'proxy.example:80',
          host: 'ignored:3000',
        },
        protocol: 'https',
      } as any;

      controller.share(mockUser as any, 'file-123', shareDto as any, req);

      expect(fileService.share).toHaveBeenCalledWith(
        'file-123',
        'user-123',
        shareDto,
        'https://proxy.example:80',
      );
    });

    it('should pass undefined origin when host headers are missing', () => {
      delete process.env.FRONTEND_URL;
      delete process.env.ALLOWED_ORIGINS;
      const shareDto = { type: 'public' };
      fileService.share.mockResolvedValue({ token: 'share-token' } as any);
      const req = {
        headers: {},
        protocol: 'https',
      } as any;

      controller.share(mockUser as any, 'file-123', shareDto as any, req);

      expect(fileService.share).toHaveBeenCalledWith(
        'file-123',
        'user-123',
        shareDto,
        undefined,
      );
    });
  });
});
