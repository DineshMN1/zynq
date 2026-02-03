import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  CipherGCMTypes,
} from 'crypto';
import { Readable, Transform } from 'stream';

export interface EncryptionResult {
  encryptedDek: Buffer;
  iv: Buffer;
  algorithm: string;
}

export interface DecryptionParams {
  encryptedDek: Buffer;
  iv: Buffer;
  algorithm?: string;
}

@Injectable()
export class EncryptionService implements OnModuleInit {
  private masterKey: Buffer;
  private readonly ALGORITHM: CipherGCMTypes = 'aes-256-gcm';
  private readonly IV_LENGTH = 12; // 96 bits for GCM
  private readonly DEK_LENGTH = 32; // 256 bits
  private readonly AUTH_TAG_LENGTH = 16; // 128 bits

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const masterKeyBase64 = this.configService.get<string>(
      'FILE_ENCRYPTION_MASTER_KEY',
    );

    if (!masterKeyBase64) {
      throw new Error(
        'FILE_ENCRYPTION_MASTER_KEY environment variable is required',
      );
    }

    this.masterKey = Buffer.from(masterKeyBase64, 'base64');

    if (this.masterKey.length !== 32) {
      throw new Error(
        'FILE_ENCRYPTION_MASTER_KEY must be exactly 32 bytes (256 bits) when decoded from base64',
      );
    }
  }

  /**
   * Generate a new Data Encryption Key (DEK) for a file
   */
  generateDek(): Buffer {
    return randomBytes(this.DEK_LENGTH);
  }

  /**
   * Generate a new IV for encryption
   */
  generateIv(): Buffer {
    return randomBytes(this.IV_LENGTH);
  }

  /**
   * Encrypt a DEK using the master key (Key Encryption Key - KEK)
   */
  encryptDek(dek: Buffer): { encryptedDek: Buffer; dekIv: Buffer } {
    const dekIv = this.generateIv();
    const cipher = createCipheriv(this.ALGORITHM, this.masterKey, dekIv);

    const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Combine encrypted DEK with auth tag
    const encryptedDek = Buffer.concat([encrypted, authTag]);

    return { encryptedDek, dekIv };
  }

  /**
   * Decrypt a DEK using the master key
   */
  decryptDek(encryptedDek: Buffer, dekIv: Buffer): Buffer {
    // Split encrypted DEK and auth tag
    const encrypted = encryptedDek.subarray(
      0,
      encryptedDek.length - this.AUTH_TAG_LENGTH,
    );
    const authTag = encryptedDek.subarray(
      encryptedDek.length - this.AUTH_TAG_LENGTH,
    );

    const decipher = createDecipheriv(this.ALGORITHM, this.masterKey, dekIv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Create encryption parameters for a new file
   */
  createFileEncryption(): {
    dek: Buffer;
    iv: Buffer;
    encryptedDek: Buffer;
    dekIv: Buffer;
    algorithm: string;
  } {
    const dek = this.generateDek();
    const iv = this.generateIv();
    const { encryptedDek, dekIv } = this.encryptDek(dek);

    return {
      dek,
      iv,
      encryptedDek,
      dekIv,
      algorithm: this.ALGORITHM,
    };
  }

  /**
   * Create an encryption transform stream for file upload
   */
  createEncryptStream(dek: Buffer, iv: Buffer): Transform {
    const cipher = createCipheriv(this.ALGORITHM, dek, iv);
    let authTag: Buffer | null = null;

    const transform = new Transform({
      transform(chunk, encoding, callback) {
        try {
          const encrypted = cipher.update(chunk);
          callback(null, encrypted);
        } catch (error) {
          callback(error as Error);
        }
      },
      flush(callback) {
        try {
          const final = cipher.final();
          authTag = cipher.getAuthTag();
          // Append auth tag to the end of the stream
          this.push(final);
          this.push(authTag);
          callback();
        } catch (error) {
          callback(error as Error);
        }
      },
    });

    return transform;
  }

  /**
   * Create a decryption transform stream for file download
   */
  createDecryptStream(dek: Buffer, iv: Buffer): Transform {
    const decipher = createDecipheriv(this.ALGORITHM, dek, iv);
    const chunks: Buffer[] = [];

    // For GCM mode, we need to collect all data first to extract the auth tag
    const transform = new Transform({
      transform(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
      flush(callback) {
        try {
          const allData = Buffer.concat(chunks);
          // Last 16 bytes are the auth tag
          const encryptedData = allData.subarray(0, allData.length - 16);
          const authTag = allData.subarray(allData.length - 16);

          decipher.setAuthTag(authTag);
          const decrypted = Buffer.concat([
            decipher.update(encryptedData),
            decipher.final(),
          ]);
          this.push(decrypted);
          callback();
        } catch (error) {
          callback(error as Error);
        }
      },
    });

    return transform;
  }

  /**
   * Encrypt a buffer directly (for smaller files)
   */
  encryptBuffer(data: Buffer, dek: Buffer, iv: Buffer): Buffer {
    const cipher = createCipheriv(this.ALGORITHM, dek, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([encrypted, authTag]);
  }

  /**
   * Decrypt a buffer directly (for smaller files)
   */
  decryptBuffer(encryptedData: Buffer, dek: Buffer, iv: Buffer): Buffer {
    const data = encryptedData.subarray(
      0,
      encryptedData.length - this.AUTH_TAG_LENGTH,
    );
    const authTag = encryptedData.subarray(
      encryptedData.length - this.AUTH_TAG_LENGTH,
    );

    const decipher = createDecipheriv(this.ALGORITHM, dek, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(data), decipher.final()]);
  }
}
