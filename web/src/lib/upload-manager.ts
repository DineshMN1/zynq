/**
 * High-performance upload manager
 * Decouples upload logic from UI rendering for maximum throughput
 */
import { getApiBaseUrl } from './api';

export interface UploadTask {
  id: string;
  file: File;
  parentId?: string;
  status:
    | 'pending'
    | 'hashing'
    | 'checking'
    | 'uploading'
    | 'completed'
    | 'error'
    | 'duplicate';
  progress: number;
  hash?: string;
  error?: string;
  skipDuplicateCheck?: boolean;
}

export interface UploadProgress {
  id: string;
  progress: number;
  status: UploadTask['status'];
}

type ProgressCallback = (updates: UploadProgress[]) => void;

// Text-based file extensions for content normalization
const TEXT_EXTENSIONS = new Set([
  'txt',
  'json',
  'xml',
  'csv',
  'html',
  'htm',
  'md',
  'css',
  'js',
  'ts',
]);

// Extensions that support duplicate detection
const DEDUP_EXTENSIONS = new Set([
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
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'bmp',
]);

class UploadManager {
  private worker: Worker | null = null;
  private pendingHashes = new Map<string, (hash: string) => void>();
  private hashRejects = new Map<string, (error: Error) => void>();
  private progressCallback: ProgressCallback | null = null;
  private pendingUpdates: UploadProgress[] = [];
  private updateScheduled = false;
  private concurrentUploads = 3; // Parallel uploads for bandwidth saturation

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof window === 'undefined') return;

    try {
      // Create worker from blob for Next.js compatibility
      const workerCode = `
        async function calculateSHA256(data) {
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        async function calculateTextHash(text) {
          const encoder = new TextEncoder();
          const data = encoder.encode(text);
          return calculateSHA256(data);
        }

        self.onmessage = async (event) => {
          const { id, type, data } = event.data;
          try {
            const hash = type === 'text'
              ? await calculateTextHash(data)
              : await calculateSHA256(data);
            self.postMessage({ id, hash });
          } catch (error) {
            self.postMessage({ id, error: error.message || 'Hash failed' });
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));

      this.worker.onmessage = (event) => {
        const { id, hash, error } = event.data;
        if (error) {
          this.hashRejects.get(id)?.(new Error(error));
        } else {
          this.pendingHashes.get(id)?.(hash);
        }
        this.pendingHashes.delete(id);
        this.hashRejects.delete(id);
      };
    } catch {
      // Worker creation failed, will fallback to main thread
      this.worker = null;
    }
  }

  setProgressCallback(callback: ProgressCallback | null) {
    this.progressCallback = callback;
  }

  private queueProgressUpdate(update: UploadProgress) {
    // Find and update existing entry or add new
    const existingIndex = this.pendingUpdates.findIndex(
      (u) => u.id === update.id,
    );
    if (existingIndex >= 0) {
      this.pendingUpdates[existingIndex] = update;
    } else {
      this.pendingUpdates.push(update);
    }

    // Batch updates using requestAnimationFrame for smooth UI
    if (!this.updateScheduled && this.progressCallback) {
      this.updateScheduled = true;
      requestAnimationFrame(() => {
        if (this.progressCallback && this.pendingUpdates.length > 0) {
          this.progressCallback([...this.pendingUpdates]);
          this.pendingUpdates = [];
        }
        this.updateScheduled = false;
      });
    }
  }

  private shouldCheckDuplicates(fileName: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return DEDUP_EXTENSIONS.has(ext);
  }

  private isTextFile(fileName: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return TEXT_EXTENSIONS.has(ext);
  }

  async calculateHash(file: File): Promise<string> {
    // Skip hashing for large files to prevent OOM in the browser.
    // Archives, videos, and ISO images are never checked for duplicates
    // anyway (see DEDUP_EXTENSIONS), so returning '' is always safe here.
    const MAX_HASH_BYTES = 200 * 1024 * 1024; // 200 MB
    if (file.size > MAX_HASH_BYTES) return '';

    const id = `hash-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Read file content
    const arrayBuffer = await file.arrayBuffer();

    // For text files, normalize content before hashing
    if (this.isTextFile(file.name)) {
      const text = new TextDecoder().decode(arrayBuffer);
      const normalized = text.trim().replace(/\r\n/g, '\n');

      if (this.worker) {
        return new Promise((resolve, reject) => {
          this.pendingHashes.set(id, resolve);
          this.hashRejects.set(id, reject);
          this.worker!.postMessage({ id, type: 'text', data: normalized });
        });
      }

      // Fallback: calculate on main thread
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Binary file hashing
    if (this.worker) {
      return new Promise((resolve, reject) => {
        this.pendingHashes.set(id, resolve);
        this.hashRejects.set(id, reject);
        this.worker!.postMessage({ id, type: 'file', data: arrayBuffer }, [
          arrayBuffer,
        ]);
      });
    }

    // Fallback: calculate on main thread
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async uploadWithXHR(
    url: string,
    file: File,
    onProgress: (percent: number) => void,
  ): Promise<void> {
    const apiBase = getApiBaseUrl();
    const fullUrl = url.startsWith('http')
      ? url
      : `${apiBase}${url.replace(/^\/api\/v1/, '')}`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Lightweight progress updates - throttled by browser
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      xhr.addEventListener('readystatechange', () => {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      const formData = new FormData();
      formData.append('file', file);

      xhr.open('PUT', fullUrl);
      const isSameOrigin =
        typeof window === 'undefined' ||
        new URL(fullUrl, window.location.href).origin ===
          window.location.origin;
      xhr.withCredentials = isSameOrigin;
      xhr.send(formData);
    });
  }

  /**
   * Process multiple files in parallel for maximum throughput
   */
  async processFilesParallel<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    concurrency: number = this.concurrentUploads,
  ): Promise<void> {
    const queue = [...items];
    const active: Promise<void>[] = [];

    while (queue.length > 0 || active.length > 0) {
      // Fill up to concurrency limit
      while (active.length < concurrency && queue.length > 0) {
        const item = queue.shift()!;
        const promise = processor(item).finally(() => {
          const index = active.indexOf(promise);
          if (index > -1) active.splice(index, 1);
        });
        active.push(promise);
      }

      // Wait for at least one to complete
      if (active.length > 0) {
        await Promise.race(active);
      }
    }
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
    this.pendingHashes.clear();
    this.hashRejects.clear();
  }
}

// Singleton instance
export const uploadManager = new UploadManager();
