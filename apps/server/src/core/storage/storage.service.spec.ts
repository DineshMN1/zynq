import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { StorageService } from './storage.service';
import { EncryptionService } from '../encryption/encryption.service';
import { Readable } from 'stream';

// ── fetch mock ────────────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

function okResponse(body?: Buffer | object): Response {
  const isBuffer = Buffer.isBuffer(body);
  return {
    ok: true,
    status: 200,
    arrayBuffer: () =>
      Promise.resolve(
        isBuffer
          ? body.buffer.slice(
              body.byteOffset,
              body.byteOffset + body.byteLength,
            )
          : new ArrayBuffer(0),
      ),
    json: () => Promise.resolve(isBuffer ? {} : (body ?? {})),
    text: () => Promise.resolve(''),
  } as unknown as Response;
}

function errorResponse(status: number, body = 'error'): Response {
  return {
    ok: false,
    status,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

// ── fixtures ──────────────────────────────────────────────────────────────────

const mockEncryption = {
  dek: Buffer.alloc(32, 'dek'),
  iv: Buffer.alloc(12, 'iv'),
  encryptedDek: Buffer.alloc(48, 'encDek'),
  dekIv: Buffer.alloc(12, 'dekIv'),
  algorithm: 'AES-256-GCM',
};

const ENCRYPTED_CONTENT = Buffer.concat([
  Buffer.from('encrypted'),
  Buffer.alloc(16, 'tag'),
]);

// ── tests ─────────────────────────────────────────────────────────────────────

describe('StorageService', () => {
  let service: StorageService;
  let encryptionService: jest.Mocked<EncryptionService>;

  beforeEach(async () => {
    mockFetch.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STORAGE_SERVICE_URL') return 'http://storage:5000';
              if (key === 'STORAGE_SERVICE_TOKEN') return 'test-token';
              return null;
            }),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            createFileEncryption: jest.fn().mockReturnValue(mockEncryption),
            encryptBuffer: jest.fn().mockReturnValue(ENCRYPTED_CONTENT),
            decryptBuffer: jest.fn().mockReturnValue(Buffer.from('decrypted')),
            decryptDek: jest.fn().mockReturnValue(mockEncryption.dek),
            createEncryptStream: jest
              .fn()
              .mockReturnValue(new Readable({ read() {} })),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    encryptionService = module.get(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── uploadFile ──────────────────────────────────────────────────────────────

  describe('uploadFile', () => {
    it('encrypts data and POSTs to Go service', async () => {
      mockFetch.mockResolvedValue(okResponse());

      const result = await service.uploadFile(
        'user-1',
        'file-1',
        Buffer.from('hello'),
      );

      expect(encryptionService.createFileEncryption).toHaveBeenCalled();
      expect(encryptionService.encryptBuffer).toHaveBeenCalled();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://storage:5000/v1/files',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Service-Token': 'test-token',
            'X-Owner-ID': 'user-1',
            'X-File-ID': 'file-1',
          }),
        }),
      );

      expect(result.storagePath).toBe('user-1/file-1.enc');
      expect(result.algorithm).toBe('AES-256-GCM');
      expect(result.iv).toEqual(mockEncryption.iv);
    });

    it('throws on non-2xx response from Go service', async () => {
      mockFetch.mockResolvedValue(errorResponse(500, 'disk full'));

      await expect(
        service.uploadFile('user-1', 'file-1', Buffer.from('data')),
      ).rejects.toThrow('Storage service error 500');
    });
  });

  // ── downloadFile ────────────────────────────────────────────────────────────

  describe('downloadFile', () => {
    it('GETs encrypted bytes from Go and decrypts them', async () => {
      mockFetch.mockResolvedValue(okResponse(ENCRYPTED_CONTENT));

      const combinedDek = Buffer.concat([
        mockEncryption.dekIv,
        mockEncryption.encryptedDek,
      ]);
      const result = await service.downloadFile(
        'user-1',
        'file-1',
        combinedDek,
        mockEncryption.iv,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://storage:5000/v1/files/user-1/file-1',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Service-Token': 'test-token' }),
        }),
      );
      expect(encryptionService.decryptDek).toHaveBeenCalled();
      expect(encryptionService.decryptBuffer).toHaveBeenCalled();
      expect(result).toEqual(Buffer.from('decrypted'));
    });

    it('throws NotFoundException on 404', async () => {
      mockFetch.mockResolvedValue(errorResponse(404));

      await expect(
        service.downloadFile(
          'user-1',
          'missing',
          Buffer.alloc(60),
          Buffer.alloc(12),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws generic error on 500', async () => {
      mockFetch.mockResolvedValue(errorResponse(500, 'storage error'));

      await expect(
        service.downloadFile(
          'user-1',
          'file-1',
          Buffer.alloc(60),
          Buffer.alloc(12),
        ),
      ).rejects.toThrow('Storage service error 500');
    });
  });

  // ── deleteFile ──────────────────────────────────────────────────────────────

  describe('deleteFile', () => {
    it('sends DELETE to Go service', async () => {
      mockFetch.mockResolvedValue(okResponse());

      await service.deleteFile('user-1', 'file-1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://storage:5000/v1/files/user-1/file-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('does not throw on 404 (already gone)', async () => {
      mockFetch.mockResolvedValue(errorResponse(404));

      await expect(
        service.deleteFile('user-1', 'file-1'),
      ).resolves.not.toThrow();
    });

    it('throws on 500', async () => {
      mockFetch.mockResolvedValue(errorResponse(500));

      await expect(service.deleteFile('user-1', 'file-1')).rejects.toThrow(
        'Storage delete failed 500',
      );
    });
  });

  // ── moveToTrash ─────────────────────────────────────────────────────────────

  describe('moveToTrash', () => {
    it('POSTs to /trash endpoint', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 204 } as Response);

      await service.moveToTrash('user-1', 'file-1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://storage:5000/v1/files/user-1/file-1/trash',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws on Go error', async () => {
      mockFetch.mockResolvedValue(errorResponse(500));

      await expect(service.moveToTrash('user-1', 'file-1')).rejects.toThrow(
        'Storage moveToTrash failed 500',
      );
    });
  });

  // ── restoreFromTrash ────────────────────────────────────────────────────────

  describe('restoreFromTrash', () => {
    it('POSTs to /restore endpoint', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 204 } as Response);

      await service.restoreFromTrash('user-1', 'file-1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://storage:5000/v1/files/user-1/file-1/restore',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws NotFoundException when file not in trash', async () => {
      mockFetch.mockResolvedValue(errorResponse(404));

      await expect(
        service.restoreFromTrash('user-1', 'file-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws on 500', async () => {
      mockFetch.mockResolvedValue(errorResponse(500));

      await expect(
        service.restoreFromTrash('user-1', 'file-1'),
      ).rejects.toThrow('Storage restoreFromTrash failed 500');
    });
  });

  // ── getStorageStats ─────────────────────────────────────────────────────────

  describe('getStorageStats', () => {
    it('returns stats from Go service', async () => {
      mockFetch.mockResolvedValue(
        okResponse({ total_bytes: 1000, used_bytes: 400, free_bytes: 600 }),
      );

      const stats = await service.getStorageStats();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://storage:5000/v1/stats',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Service-Token': 'test-token' }),
        }),
      );
      expect(stats).toEqual({
        totalBytes: 1000,
        usedBytes: 400,
        freeBytes: 600,
      });
    });

    it('returns zeros when Go service is unreachable', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const stats = await service.getStorageStats();

      expect(stats).toEqual({ totalBytes: 0, usedBytes: 0, freeBytes: 0 });
    });

    it('returns zeros on non-2xx response', async () => {
      mockFetch.mockResolvedValue(errorResponse(503));

      const stats = await service.getStorageStats();

      expect(stats).toEqual({ totalBytes: 0, usedBytes: 0, freeBytes: 0 });
    });
  });
});
