import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { EncryptionService } from '../encryption/encryption.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('StorageService', () => {
  let service: StorageService;
  let encryptionService: jest.Mocked<EncryptionService>;
  let testDir: string;

  const mockEncryption = {
    dek: Buffer.alloc(32, 'dek'),
    iv: Buffer.alloc(12, 'iv'),
    encryptedDek: Buffer.alloc(48, 'encDek'),
    dekIv: Buffer.alloc(12, 'dekIv'),
    algorithm: 'AES-256-GCM',
  };

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = path.join(os.tmpdir(), `storage-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'FILE_STORAGE_PATH') return testDir;
              return null;
            }),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            createFileEncryption: jest.fn().mockReturnValue(mockEncryption),
            encryptBuffer: jest.fn((data) =>
              Buffer.concat([data, Buffer.from('encrypted')]),
            ),
            decryptBuffer: jest.fn((data) => data.subarray(0, -9)), // Remove 'encrypted' suffix
            decryptDek: jest.fn().mockReturnValue(mockEncryption.dek),
            createEncryptStream: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    encryptionService = module.get(EncryptionService);

    // Initialize the service (creates base directory)
    await service.onModuleInit();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should upload and encrypt a file', async () => {
      const userId = 'user-123';
      const fileId = 'file-456';
      const data = Buffer.from('test file content');

      const result = await service.uploadFile(userId, fileId, data);

      expect(result.storagePath).toBe(`${userId}/${fileId}.enc`);
      expect(result.algorithm).toBe('AES-256-GCM');
      expect(result.iv).toEqual(mockEncryption.iv);
      expect(encryptionService.createFileEncryption).toHaveBeenCalled();
      expect(encryptionService.encryptBuffer).toHaveBeenCalledWith(
        data,
        mockEncryption.dek,
        mockEncryption.iv,
      );

      // Verify file was written
      const filePath = path.join(testDir, userId, `${fileId}.enc`);
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should create user directory if it does not exist', async () => {
      const userId = 'new-user';
      const fileId = 'file-789';
      const data = Buffer.from('test');

      await service.uploadFile(userId, fileId, data);

      const userDir = path.join(testDir, userId);
      const dirExists = await fs
        .access(userDir)
        .then(() => true)
        .catch(() => false);
      expect(dirExists).toBe(true);
    });
  });

  describe('downloadFile', () => {
    it('should download and decrypt a file', async () => {
      const userId = 'user-123';
      const fileId = 'file-456';
      const originalData = Buffer.from('test file content');

      // First upload a file
      const uploadResult = await service.uploadFile(
        userId,
        fileId,
        originalData,
      );

      // Then download it
      const downloaded = await service.downloadFile(
        userId,
        fileId,
        uploadResult.encryptedDek,
        uploadResult.iv,
      );

      expect(encryptionService.decryptDek).toHaveBeenCalled();
      expect(encryptionService.decryptBuffer).toHaveBeenCalled();
      expect(downloaded).toBeDefined();
    });

    it('should throw NotFoundException if file does not exist', async () => {
      const userId = 'user-123';
      const fileId = 'nonexistent';
      const encryptedDek = Buffer.concat([
        mockEncryption.dekIv,
        mockEncryption.encryptedDek,
      ]);

      await expect(
        service.downloadFile(userId, fileId, encryptedDek, mockEncryption.iv),
      ).rejects.toThrow('File not found on storage');
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      const userId = 'user-123';
      const fileId = 'file-to-delete';
      const data = Buffer.from('test');

      await service.uploadFile(userId, fileId, data);

      const filePath = path.join(testDir, userId, `${fileId}.enc`);
      let fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      await service.deleteFile(userId, fileId);

      fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(false);
    });

    it('should not throw if file does not exist', async () => {
      await expect(
        service.deleteFile('user-123', 'nonexistent'),
      ).resolves.not.toThrow();
    });
  });

  describe('moveToTrash', () => {
    it('should move file to trash directory', async () => {
      const userId = 'user-123';
      const fileId = 'file-to-trash';
      const data = Buffer.from('test');

      await service.uploadFile(userId, fileId, data);

      await service.moveToTrash(userId, fileId);

      const originalPath = path.join(testDir, userId, `${fileId}.enc`);
      const trashPath = path.join(testDir, userId, '.trash', `${fileId}.enc`);

      const originalExists = await fs
        .access(originalPath)
        .then(() => true)
        .catch(() => false);
      const trashExists = await fs
        .access(trashPath)
        .then(() => true)
        .catch(() => false);

      expect(originalExists).toBe(false);
      expect(trashExists).toBe(true);
    });
  });

  describe('restoreFromTrash', () => {
    it('should restore file from trash directory', async () => {
      const userId = 'user-123';
      const fileId = 'file-to-restore';
      const data = Buffer.from('test');

      await service.uploadFile(userId, fileId, data);
      await service.moveToTrash(userId, fileId);
      await service.restoreFromTrash(userId, fileId);

      const originalPath = path.join(testDir, userId, `${fileId}.enc`);
      const trashPath = path.join(testDir, userId, '.trash', `${fileId}.enc`);

      const originalExists = await fs
        .access(originalPath)
        .then(() => true)
        .catch(() => false);
      const trashExists = await fs
        .access(trashPath)
        .then(() => true)
        .catch(() => false);

      expect(originalExists).toBe(true);
      expect(trashExists).toBe(false);
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      const userId = 'user-123';
      const fileId = 'existing-file';
      const data = Buffer.from('test');

      await service.uploadFile(userId, fileId, data);

      const exists = await service.fileExists(userId, fileId);
      expect(exists).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      const exists = await service.fileExists('user-123', 'nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('getStorageStats', () => {
    it('should return storage statistics', async () => {
      const stats = await service.getStorageStats();

      expect(stats).toHaveProperty('totalBytes');
      expect(stats).toHaveProperty('usedBytes');
      expect(stats).toHaveProperty('freeBytes');
      expect(typeof stats.totalBytes).toBe('number');
      expect(typeof stats.usedBytes).toBe('number');
      expect(typeof stats.freeBytes).toBe('number');
    });
  });

  describe('getUserStorageSize', () => {
    it('should return total size of user directory', async () => {
      const userId = 'user-with-files';

      // Upload some files
      await service.uploadFile(userId, 'file1', Buffer.from('content1'));
      await service.uploadFile(userId, 'file2', Buffer.from('content2 longer'));

      const size = await service.getUserStorageSize(userId);
      expect(size).toBeGreaterThan(0);
    });

    it('should return 0 for non-existent user', async () => {
      const size = await service.getUserStorageSize('nonexistent-user');
      expect(size).toBe(0);
    });
  });
});
