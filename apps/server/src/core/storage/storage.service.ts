import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../encryption/encryption.service';
import { createWriteStream, promises as fs, statfsSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

export interface UploadResult {
  storagePath: string;
  encryptedDek: Buffer;
  iv: Buffer;
  algorithm: string;
  encryptedSize: number;
}

export interface StorageStats {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

/**
 * Handles encrypted file storage on local filesystem.
 * Files are encrypted with AES-256-GCM using per-file DEKs wrapped by master key.
 * Supports upload/download, trash management, and storage statistics.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private basePath: string;

  constructor(
    private configService: ConfigService,
    private encryptionService: EncryptionService,
  ) {
    this.basePath =
      this.configService.get('FILE_STORAGE_PATH') || '/data/files';
  }

  async onModuleInit() {
    // Ensure base storage directory exists
    await fs.mkdir(this.basePath, { recursive: true });
  }

  /**
   * Get the user's storage directory path
   */
  private getUserDir(userId: string): string {
    return join(this.basePath, userId);
  }

  /**
   * Get the user's trash directory path
   */
  private getUserTrashDir(userId: string): string {
    return join(this.basePath, userId, '.trash');
  }

  /**
   * Get the full file path for a file
   */
  private getFilePath(userId: string, fileId: string): string {
    return join(this.getUserDir(userId), `${fileId}.enc`);
  }

  /**
   * Get the full file path for a trashed file
   */
  private getTrashFilePath(userId: string, fileId: string): string {
    return join(this.getUserTrashDir(userId), `${fileId}.enc`);
  }

  /**
   * Ensure user directories exist
   */
  async ensureUserDirectories(userId: string): Promise<void> {
    await fs.mkdir(this.getUserDir(userId), { recursive: true });
    await fs.mkdir(this.getUserTrashDir(userId), { recursive: true });
  }

  /**
   * Upload and encrypt a file from a buffer
   */
  async uploadFile(
    userId: string,
    fileId: string,
    data: Buffer,
  ): Promise<UploadResult> {
    await this.ensureUserDirectories(userId);

    const { dek, iv, encryptedDek, dekIv, algorithm } =
      this.encryptionService.createFileEncryption();

    // Encrypt the file data
    const encryptedData = this.encryptionService.encryptBuffer(data, dek, iv);

    // Write encrypted file to disk
    const filePath = this.getFilePath(userId, fileId);
    await fs.writeFile(filePath, encryptedData);

    // Store the DEK IV with the encrypted DEK for later decryption
    const combinedEncryptedDek = Buffer.concat([dekIv, encryptedDek]);

    return {
      storagePath: `${userId}/${fileId}.enc`,
      encryptedDek: combinedEncryptedDek,
      iv,
      algorithm,
      encryptedSize: encryptedData.length,
    };
  }

  /**
   * Upload and encrypt a file from a stream
   */
  async uploadFileStream(
    userId: string,
    fileId: string,
    stream: Readable,
  ): Promise<UploadResult> {
    await this.ensureUserDirectories(userId);

    const { dek, iv, encryptedDek, dekIv, algorithm } =
      this.encryptionService.createFileEncryption();

    const filePath = this.getFilePath(userId, fileId);
    const writeStream = createWriteStream(filePath);
    const encryptStream = this.encryptionService.createEncryptStream(dek, iv);

    await pipeline(stream, encryptStream, writeStream);

    // Get the encrypted file size
    const stats = await fs.stat(filePath);

    // Store the DEK IV with the encrypted DEK
    const combinedEncryptedDek = Buffer.concat([dekIv, encryptedDek]);

    return {
      storagePath: `${userId}/${fileId}.enc`,
      encryptedDek: combinedEncryptedDek,
      iv,
      algorithm,
      encryptedSize: stats.size,
    };
  }

  /**
   * Download and decrypt a file, returning a buffer
   */
  async downloadFile(
    userId: string,
    fileId: string,
    encryptedDek: Buffer,
    iv: Buffer,
  ): Promise<Buffer> {
    const filePath = this.getFilePath(userId, fileId);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      // Try trash location
      const trashPath = this.getTrashFilePath(userId, fileId);
      try {
        await fs.access(trashPath);
        return this.downloadFromPath(trashPath, encryptedDek, iv);
      } catch {
        throw new NotFoundException('File not found on storage');
      }
    }

    return this.downloadFromPath(filePath, encryptedDek, iv);
  }

  private async downloadFromPath(
    filePath: string,
    encryptedDek: Buffer,
    iv: Buffer,
  ): Promise<Buffer> {
    // Extract DEK IV from the combined encrypted DEK
    const dekIv = encryptedDek.subarray(0, 12);
    const actualEncryptedDek = encryptedDek.subarray(12);

    // Decrypt the DEK
    const dek = this.encryptionService.decryptDek(actualEncryptedDek, dekIv);

    // Read and decrypt the file
    const encryptedData = await fs.readFile(filePath);
    return this.encryptionService.decryptBuffer(encryptedData, dek, iv);
  }

  /**
   * Download and decrypt a file as a stream
   */
  async downloadFileStream(
    userId: string,
    fileId: string,
    encryptedDek: Buffer,
    iv: Buffer,
  ): Promise<Readable> {
    // For now, we'll read the entire file and decrypt it
    // A more memory-efficient streaming approach would require
    // a custom chunked encryption format
    const decrypted = await this.downloadFile(userId, fileId, encryptedDek, iv);
    return Readable.from(decrypted);
  }

  /**
   * Delete a file permanently
   */
  async deleteFile(userId: string, fileId: string): Promise<void> {
    const filePath = this.getFilePath(userId, fileId);
    const trashPath = this.getTrashFilePath(userId, fileId);

    try {
      await fs.unlink(filePath);
    } catch {
      // Try trash location
      try {
        await fs.unlink(trashPath);
      } catch {
        // File doesn't exist, that's ok
      }
    }
  }

  /**
   * Move a file to trash
   */
  async moveToTrash(userId: string, fileId: string): Promise<void> {
    await this.ensureUserDirectories(userId);
    const filePath = this.getFilePath(userId, fileId);
    const trashPath = this.getTrashFilePath(userId, fileId);

    try {
      await fs.rename(filePath, trashPath);
    } catch {
      // File might already be in trash or not exist
    }
  }

  /**
   * Restore a file from trash
   */
  async restoreFromTrash(userId: string, fileId: string): Promise<void> {
    await this.ensureUserDirectories(userId);
    const filePath = this.getFilePath(userId, fileId);
    const trashPath = this.getTrashFilePath(userId, fileId);

    await fs.rename(trashPath, filePath);
  }

  /**
   * Check if a file exists
   */
  async fileExists(userId: string, fileId: string): Promise<boolean> {
    const filePath = this.getFilePath(userId, fileId);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage statistics for the entire system
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      // Use Node.js built-in statfsSync for cross-platform disk stats
      const stats = statfsSync(this.basePath);

      // Use frsize (fragment size) if available, otherwise fall back to bsize
      // On macOS and some Linux systems, frsize gives more accurate results
      const blockSize = (stats as any).frsize || stats.bsize;

      // Convert to BigInt for accurate calculation with large disks
      // then back to number for the response
      const totalBytes = Number(BigInt(stats.blocks) * BigInt(blockSize));
      const freeBytes = Number(BigInt(stats.bavail) * BigInt(blockSize));
      const usedBytes = totalBytes - freeBytes;

      return {
        totalBytes,
        usedBytes,
        freeBytes,
      };
    } catch {
      // If statfs fails, return zeros
      return {
        totalBytes: 0,
        usedBytes: 0,
        freeBytes: 0,
      };
    }
  }

  /**
   * Get the size of a user's storage directory
   */
  async getUserStorageSize(userId: string): Promise<number> {
    const userDir = this.getUserDir(userId);
    try {
      return await this.getDirectorySize(userDir);
    } catch {
      return 0;
    }
  }

  /**
   * Calculate the total size of a directory recursively
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(fullPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return totalSize;
  }
}
