import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let configService: jest.Mocked<ConfigService>;

  const validMasterKey = Buffer.from(randomBytes(32)).toString('base64');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(validMasterKey),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    configService = module.get(ConfigService);

    // Manually initialize the service (reads master key)
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should throw if FILE_ENCRYPTION_MASTER_KEY is missing', () => {
      configService.get.mockReturnValue(undefined);

      expect(() => service.onModuleInit()).toThrow(
        'FILE_ENCRYPTION_MASTER_KEY environment variable is required',
      );
    });

    it('should throw if key is not 32 bytes', () => {
      const shortKey = Buffer.from(randomBytes(16)).toString('base64');
      configService.get.mockReturnValue(shortKey);

      expect(() => service.onModuleInit()).toThrow(
        'FILE_ENCRYPTION_MASTER_KEY must be exactly 32 bytes',
      );
    });

    it('should succeed with valid 32-byte base64 key', () => {
      configService.get.mockReturnValue(validMasterKey);

      expect(() => service.onModuleInit()).not.toThrow();
    });
  });

  describe('generateDek', () => {
    it('should return a 32-byte buffer', () => {
      const dek = service.generateDek();

      expect(Buffer.isBuffer(dek)).toBe(true);
      expect(dek.length).toBe(32);
    });
  });

  describe('generateIv', () => {
    it('should return a 12-byte buffer', () => {
      const iv = service.generateIv();

      expect(Buffer.isBuffer(iv)).toBe(true);
      expect(iv.length).toBe(12);
    });
  });

  describe('encryptDek / decryptDek', () => {
    it('should round-trip correctly', () => {
      const dek = service.generateDek();
      const { encryptedDek, dekIv } = service.encryptDek(dek);

      const decrypted = service.decryptDek(encryptedDek, dekIv);

      expect(decrypted).toEqual(dek);
    });

    it('should fail with tampered ciphertext', () => {
      const dek = service.generateDek();
      const { encryptedDek, dekIv } = service.encryptDek(dek);

      // Tamper with the encrypted data
      encryptedDek[0] ^= 0xff;

      expect(() => service.decryptDek(encryptedDek, dekIv)).toThrow();
    });
  });

  describe('createFileEncryption', () => {
    it('should return all required fields', () => {
      const result = service.createFileEncryption();

      expect(result).toHaveProperty('dek');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('encryptedDek');
      expect(result).toHaveProperty('dekIv');
      expect(result).toHaveProperty('algorithm');
      expect(Buffer.isBuffer(result.dek)).toBe(true);
      expect(result.dek.length).toBe(32);
      expect(Buffer.isBuffer(result.iv)).toBe(true);
      expect(result.iv.length).toBe(12);
      expect(result.algorithm).toBe('aes-256-gcm');
    });
  });

  describe('encryptBuffer / decryptBuffer', () => {
    it('should round-trip correctly', () => {
      const plaintext = Buffer.from('Hello, World! This is test data.');
      const dek = service.generateDek();
      const iv = service.generateIv();

      const encrypted = service.encryptBuffer(plaintext, dek, iv);
      const decrypted = service.decryptBuffer(encrypted, dek, iv);

      expect(decrypted).toEqual(plaintext);
    });

    it('should throw with tampered data', () => {
      const plaintext = Buffer.from('Sensitive data');
      const dek = service.generateDek();
      const iv = service.generateIv();

      const encrypted = service.encryptBuffer(plaintext, dek, iv);

      // Tamper with the encrypted data
      encrypted[0] ^= 0xff;

      expect(() => service.decryptBuffer(encrypted, dek, iv)).toThrow();
    });
  });
});
