import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../encryption/encryption.service';
import { createReadStream } from 'fs';
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
 * Handles encrypted file storage via the Go storage service.
 * All encryption/decryption is performed in NestJS before/after HTTP calls —
 * the Go service only ever receives and returns opaque encrypted bytes.
 *
 * Env vars required:
 *   STORAGE_SERVICE_URL  — base URL of the Go service, e.g. http://storage-service:5000
 *   SERVICE_TOKEN        — shared secret for X-Service-Token authentication
 */
@Injectable()
export class StorageService {
  private readonly storageUrl: string;
  private readonly serviceToken: string;

  constructor(
    private configService: ConfigService,
    private encryptionService: EncryptionService,
  ) {
    this.storageUrl = (
      this.configService.get<string>('STORAGE_SERVICE_URL') ||
      'http://localhost:5000'
    ).replace(/\/+$/, '');

    this.serviceToken =
      this.configService.get<string>('STORAGE_SERVICE_TOKEN') ?? '';
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private authHeaders(): Record<string, string> {
    return this.serviceToken ? { 'X-Service-Token': this.serviceToken } : {};
  }

  /**
   * fetch() wrapper that aborts after `timeoutMs` milliseconds.
   * Converts AbortError into a plain Error with a descriptive message so callers
   * don't need to distinguish abort from network errors.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(
          `Storage service request timed out after ${timeoutMs}ms: ${url}`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Throws NotFoundException on 404, generic Error on other non-2xx responses.
   */
  private async assertOk(res: Response, notFoundMsg: string): Promise<void> {
    if (res.ok) return;
    if (res.status === 404) throw new NotFoundException(notFoundMsg);
    const body = await res.text().catch(() => '');
    throw new Error(`Storage service error ${res.status}: ${body}`);
  }

  // ── Upload ──────────────────────────────────────────────────────────────────

  /**
   * Encrypts data in memory and streams the result to the Go storage service.
   * Use for files already in a Buffer (small files / test paths).
   */
  async uploadFile(
    userId: string,
    fileId: string,
    data: Buffer,
  ): Promise<UploadResult> {
    const { dek, iv, encryptedDek, dekIv, algorithm } =
      this.encryptionService.createFileEncryption();

    const encryptedData = this.encryptionService.encryptBuffer(data, dek, iv);

    const res = await this.fetchWithTimeout(
      `${this.storageUrl}/v1/files`,
      {
        method: 'POST',
        headers: {
          ...this.authHeaders(),
          'X-Owner-ID': userId,
          'X-File-ID': fileId,
        },
        // Buffer is a Uint8Array subclass — valid BodyInit at runtime.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: encryptedData as any,
      },
      60_000,
    );

    await this.assertOk(res, 'Storage service rejected upload');

    return {
      storagePath: `${userId}/${fileId}.enc`,
      encryptedDek: Buffer.concat([dekIv, encryptedDek]),
      iv,
      algorithm,
      encryptedSize: encryptedData.length,
    };
  }

  /**
   * Encrypts a raw incoming stream and pipes it directly to Go storage.
   * No temp-file writes in NestJS — bytes flow: client → encrypt → Go.
   */
  async uploadRawStream(
    userId: string,
    fileId: string,
    rawStream: Readable,
  ): Promise<UploadResult> {
    const { dek, iv, encryptedDek, dekIv, algorithm } =
      this.encryptionService.createFileEncryption();

    const encryptStream = this.encryptionService.createEncryptStream(dek, iv);
    const encryptedNodeStream = rawStream.pipe(encryptStream);

    const webStream = Readable.toWeb(
      encryptedNodeStream,
    ) as ReadableStream<Uint8Array>;

    const res = await this.fetchWithTimeout(
      `${this.storageUrl}/v1/files`,
      {
        method: 'POST',
        headers: {
          ...this.authHeaders(),
          'X-Owner-ID': userId,
          'X-File-ID': fileId,
        },
        body: webStream,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ duplex: 'half' } as any),
      },
      3_600_000, // 1 hour for large file streaming uploads
    );

    await this.assertOk(res, 'Storage service rejected raw stream upload');

    return {
      storagePath: `${userId}/${fileId}.enc`,
      encryptedDek: Buffer.concat([dekIv, encryptedDek]),
      iv,
      algorithm,
      encryptedSize: -1,
    };
  }

  /**
   * Encrypts a file by streaming from a path on disk directly to Go.
   * Never loads the full file into memory — safe for multi-gigabyte files.
   */
  async uploadFileStream(
    userId: string,
    fileId: string,
    sourcePath: string,
  ): Promise<UploadResult> {
    const { dek, iv, encryptedDek, dekIv, algorithm } =
      this.encryptionService.createFileEncryption();

    const readStream = createReadStream(sourcePath);
    const encryptStream = this.encryptionService.createEncryptStream(dek, iv);
    const encryptedNodeStream = readStream.pipe(encryptStream);

    // Convert Node.js Readable → Web ReadableStream for fetch body.
    const webStream = Readable.toWeb(
      encryptedNodeStream,
    ) as ReadableStream<Uint8Array>;

    const res = await this.fetchWithTimeout(
      `${this.storageUrl}/v1/files`,
      {
        method: 'POST',
        headers: {
          ...this.authHeaders(),
          'X-Owner-ID': userId,
          'X-File-ID': fileId,
        },
        body: webStream,
        // Required by Node's undici fetch for streaming request bodies.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ duplex: 'half' } as any),
      },
      300_000, // 5 min for large file streaming uploads
    );

    await this.assertOk(res, 'Storage service rejected stream upload');

    // We don't know the encrypted size without buffering — use -1 as sentinel.
    // Callers of uploadFileStream do not use encryptedSize.
    return {
      storagePath: `${userId}/${fileId}.enc`,
      encryptedDek: Buffer.concat([dekIv, encryptedDek]),
      iv,
      algorithm,
      encryptedSize: -1,
    };
  }

  // ── Download ────────────────────────────────────────────────────────────────

  /**
   * Downloads encrypted bytes from Go and decrypts them.
   * Checks the .trash location automatically on 404 (mirrors old behaviour).
   */
  async downloadFile(
    userId: string,
    fileId: string,
    encryptedDek: Buffer,
    iv: Buffer,
  ): Promise<Buffer> {
    const encryptedData = await this.fetchEncryptedFile(userId, fileId);
    return this.decryptFileBuffer(encryptedData, encryptedDek, iv);
  }

  /**
   * Downloads and decrypts a file, returning a Readable stream.
   * AES-256-GCM requires the auth tag at the end, so the full ciphertext is
   * buffered before decryption — streaming decryption is not possible with GCM.
   */
  async downloadFileStream(
    userId: string,
    fileId: string,
    encryptedDek: Buffer,
    iv: Buffer,
  ): Promise<Readable> {
    const decrypted = await this.downloadFile(userId, fileId, encryptedDek, iv);
    return Readable.from(decrypted);
  }

  private async fetchEncryptedFile(
    userId: string,
    fileId: string,
  ): Promise<Buffer> {
    const res = await this.fetchWithTimeout(
      `${this.storageUrl}/v1/files/${userId}/${fileId}`,
      { headers: this.authHeaders() },
      120_000,
    );

    if (res.ok) {
      return Buffer.from(await res.arrayBuffer());
    }
    if (res.status === 404) {
      throw new NotFoundException('File not found on storage');
    }
    const body = await res.text().catch(() => '');
    throw new Error(`Storage service error ${res.status}: ${body}`);
  }

  private decryptFileBuffer(
    encryptedData: Buffer,
    encryptedDek: Buffer,
    iv: Buffer,
  ): Buffer {
    const dekIv = encryptedDek.subarray(0, 12);
    const actualEncryptedDek = encryptedDek.subarray(12);
    const dek = this.encryptionService.decryptDek(actualEncryptedDek, dekIv);
    return this.encryptionService.decryptBuffer(encryptedData, dek, iv);
  }

  // ── Delete / trash ──────────────────────────────────────────────────────────

  /** Permanently deletes a file from the Go storage service. */
  async deleteFile(userId: string, fileId: string): Promise<void> {
    const res = await this.fetchWithTimeout(
      `${this.storageUrl}/v1/files/${userId}/${fileId}`,
      { method: 'DELETE', headers: this.authHeaders() },
      30_000,
    );
    // 404 is fine — file already gone.
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => '');
      throw new Error(`Storage delete failed ${res.status}: ${body}`);
    }
  }

  /** Moves a file to the owner's .trash directory in the Go storage service. */
  async moveToTrash(userId: string, fileId: string): Promise<void> {
    const res = await this.fetchWithTimeout(
      `${this.storageUrl}/v1/files/${userId}/${fileId}/trash`,
      { method: 'POST', headers: this.authHeaders() },
      30_000,
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Storage moveToTrash failed ${res.status}: ${body}`);
    }
  }

  /** Restores a file from the .trash directory in the Go storage service. */
  async restoreFromTrash(userId: string, fileId: string): Promise<void> {
    const res = await this.fetchWithTimeout(
      `${this.storageUrl}/v1/files/${userId}/${fileId}/restore`,
      { method: 'POST', headers: this.authHeaders() },
      30_000,
    );
    if (res.status === 404) {
      throw new NotFoundException('File not found in trash');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Storage restoreFromTrash failed ${res.status}: ${body}`);
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  /** Returns disk-space statistics from the Go storage service. */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const res = await this.fetchWithTimeout(
        `${this.storageUrl}/v1/stats`,
        { headers: this.authHeaders() },
        10_000,
      );
      if (!res.ok) return { totalBytes: 0, usedBytes: 0, freeBytes: 0 };
      const data = (await res.json()) as {
        total_bytes: number;
        used_bytes: number;
        free_bytes: number;
      };
      return {
        totalBytes: data.total_bytes ?? 0,
        usedBytes: data.used_bytes ?? 0,
        freeBytes: data.free_bytes ?? 0,
      };
    } catch {
      return { totalBytes: 0, usedBytes: 0, freeBytes: 0 };
    }
  }
}
