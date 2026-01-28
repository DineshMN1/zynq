import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned-url'),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid'),
}));

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

describe('StorageService', () => {
  let service: StorageService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                S3_BUCKET: 'test-bucket',
                S3_ENDPOINT: 'http://localhost:9000',
                S3_REGION: 'us-east-1',
                S3_ACCESS_KEY_ID: 'minioadmin',
                S3_SECRET_ACCESS_KEY: 'minioadmin',
                S3_FORCE_PATH_STYLE: 'true',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPresignedUploadUrl', () => {
    it('should generate presigned upload URL with UUID prefix', async () => {
      const result = await service.getPresignedUploadUrl('test.pdf', 'application/pdf');

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-uuid-test.pdf',
        ContentType: 'application/pdf',
      });
      expect(getSignedUrl).toHaveBeenCalled();
      expect(result).toEqual({
        uploadUrl: 'https://s3.example.com/presigned-url',
        storagePath: 'test-uuid-test.pdf',
      });
    });

    it('should handle different file types', async () => {
      await service.getPresignedUploadUrl('image.png', 'image/png');

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-uuid-image.png',
        ContentType: 'image/png',
      });
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('should generate presigned download URL', async () => {
      const result = await service.getPresignedDownloadUrl('test-uuid-test.pdf');

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-uuid-test.pdf',
      });
      expect(getSignedUrl).toHaveBeenCalled();
      expect(result).toBe('https://s3.example.com/presigned-url');
    });
  });

  describe('deleteObject', () => {
    it('should delete object from S3', async () => {
      await service.deleteObject('test-uuid-test.pdf');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-uuid-test.pdf',
      });
    });
  });
});
