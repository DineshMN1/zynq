import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';

// Polyfill File.arrayBuffer() for jsdom (not natively supported)
if (!File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function () {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const buf = reader.result as ArrayBuffer;
        // Return a real ArrayBuffer (jsdom FileReader may return a different internal type)
        const copy = new ArrayBuffer(buf.byteLength);
        new Uint8Array(copy).set(new Uint8Array(buf));
        resolve(copy);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(this);
    });
  };
}

// Polyfill crypto.subtle.digest for jsdom using Node.js crypto
if (globalThis.crypto?.subtle) {
  globalThis.crypto.subtle.digest = async (
    algo: AlgorithmIdentifier,
    data: BufferSource,
  ) => {
    const algoName = typeof algo === 'string' ? algo : algo.name;
    const nodeName = algoName.replace('-', '').toLowerCase(); // 'SHA-256' -> 'sha256'
    const hash = createHash(nodeName);
    hash.update(Buffer.from(data instanceof ArrayBuffer ? data : data.buffer));
    const result = hash.digest();
    return result.buffer.slice(
      result.byteOffset,
      result.byteOffset + result.byteLength,
    );
  };
}

// We need to test the UploadManager class. Since the module exports a singleton,
// we'll re-import for each test to get fresh instances where needed.
// For some tests we can use the singleton directly.

// Mock Worker before importing the module
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
  onerror = null;
  onmessageerror = null;
}

// Track the most recently created worker
let lastCreatedWorker: MockWorker | null = null;

// Mock URL.createObjectURL
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();

// Store the original values
const origWorker = globalThis.Worker;
const origCreateObjectURL = URL.createObjectURL;
const origRevokeObjectURL = URL.revokeObjectURL;
const origRAF = globalThis.requestAnimationFrame;

// Mock requestAnimationFrame
const mockRAF = vi.fn((cb: FrameRequestCallback) => {
  cb(0);
  return 0;
});

describe('UploadManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastCreatedWorker = null;

    // Setup Worker mock
    globalThis.Worker = vi.fn().mockImplementation(() => {
      lastCreatedWorker = new MockWorker();
      return lastCreatedWorker;
    }) as unknown as typeof Worker;

    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;
    globalThis.requestAnimationFrame = mockRAF;
  });

  afterEach(() => {
    globalThis.Worker = origWorker;
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    globalThis.requestAnimationFrame = origRAF;
    vi.restoreAllMocks();
  });

  // Helper to get a fresh UploadManager instance
  async function createManager() {
    // Clear module cache and re-import to get a fresh UploadManager constructor
    vi.resetModules();
    const mod = await import('@/lib/upload-manager');
    return mod;
  }

  describe('hash calculation', () => {
    it('produces consistent SHA-256 hash via main-thread fallback', async () => {
      // Make Worker constructor throw to force main-thread fallback
      globalThis.Worker = vi.fn().mockImplementation(() => {
        throw new Error('Worker not supported');
      }) as unknown as typeof Worker;

      const mod = await createManager();
      const manager = mod.uploadManager;

      const content = 'hello world';
      const file = new File([content], 'test.pdf', { type: 'application/pdf' });

      const hash = await manager.calculateHash(file);

      // SHA-256 of "hello world" as a binary file
      expect(hash).toMatch(/^[a-f0-9]{64}$/);

      // Should produce the same hash for the same content
      const file2 = new File([content], 'test2.pdf', {
        type: 'application/pdf',
      });
      const hash2 = await manager.calculateHash(file2);
      expect(hash2).toBe(hash);

      manager.destroy();
    });

    it('delegates to worker when available', async () => {
      const mod = await createManager();
      const manager = mod.uploadManager;

      const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });

      // Start the hash (will wait on worker)
      const hashPromise = manager.calculateHash(file);

      // Wait for arrayBuffer() to resolve and postMessage to be called
      await vi.waitFor(() => {
        expect(lastCreatedWorker?.postMessage).toHaveBeenCalled();
      });

      // Simulate worker responding
      const sentMsg = (
        lastCreatedWorker!.postMessage as ReturnType<typeof vi.fn>
      ).mock.calls[0][0];
      lastCreatedWorker!.onmessage!(
        new MessageEvent('message', {
          data: { id: sentMsg.id, hash: 'abc123def456'.padEnd(64, '0') },
        }),
      );

      const hash = await hashPromise;
      expect(hash).toBe('abc123def456'.padEnd(64, '0'));

      manager.destroy();
    });
  });

  describe('text file normalization', () => {
    it('normalizes line endings and trims whitespace for text files', async () => {
      // Force main-thread fallback to inspect the actual hash
      globalThis.Worker = vi.fn().mockImplementation(() => {
        throw new Error('Worker not supported');
      }) as unknown as typeof Worker;

      const mod = await createManager();
      const manager = mod.uploadManager;

      // Two files with different line endings and trailing whitespace
      const file1 = new File(['hello\r\nworld\r\n  '], 'test.txt', {
        type: 'text/plain',
      });
      const file2 = new File(['  hello\nworld'], 'test2.txt', {
        type: 'text/plain',
      });

      // The normalization trims and replaces \r\n with \n
      // file1 normalizes to: "hello\nworld" (trimmed trailing spaces + converted \r\n)
      // file2 normalizes to: "hello\nworld" (trimmed leading spaces)
      const hash1 = await manager.calculateHash(file1);
      const hash2 = await manager.calculateHash(file2);

      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
      expect(hash2).toMatch(/^[a-f0-9]{64}$/);
      expect(hash1).toBe(hash2);

      manager.destroy();
    });

    it('does NOT normalize binary files', async () => {
      globalThis.Worker = vi.fn().mockImplementation(() => {
        throw new Error('Worker not supported');
      }) as unknown as typeof Worker;

      const mod = await createManager();
      const manager = mod.uploadManager;

      // Same content but different extensions - pdf is not text-normalized
      const txtFile = new File(['hello\r\nworld  '], 'test.txt');
      const pdfFile = new File(['hello\r\nworld  '], 'test.pdf');

      const txtHash = await manager.calculateHash(txtFile);
      const pdfHash = await manager.calculateHash(pdfFile);

      // Hashes should differ since text file gets normalized but pdf does not
      expect(txtHash).not.toBe(pdfHash);

      manager.destroy();
    });
  });

  describe('processFilesParallel', () => {
    it('processes all items', async () => {
      const mod = await createManager();
      const manager = mod.uploadManager;

      const processed: number[] = [];
      const items = [1, 2, 3, 4, 5];

      await manager.processFilesParallel(items, async (item) => {
        processed.push(item);
      });

      expect(processed).toEqual([1, 2, 3, 4, 5]);
      manager.destroy();
    });

    it('respects concurrency limit', async () => {
      const mod = await createManager();
      const manager = mod.uploadManager;

      let maxConcurrent = 0;
      let currentConcurrent = 0;
      const resolvers: (() => void)[] = [];
      const items = [1, 2, 3, 4, 5, 6];

      const promise = manager.processFilesParallel(
        items,
        async () => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
          await new Promise<void>((resolve) => {
            resolvers.push(resolve);
          });
          currentConcurrent--;
        },
        2, // concurrency limit of 2
      );

      // Wait for the first batch to start
      await vi.waitFor(() => {
        expect(resolvers.length).toBeGreaterThanOrEqual(2);
      });

      // At this point, max 2 should be running
      expect(maxConcurrent).toBe(2);

      // Resolve all pending items one by one
      while (resolvers.length > 0) {
        resolvers.shift()!();
        await new Promise((r) => setTimeout(r, 0));
      }

      await promise;
      expect(maxConcurrent).toBe(2);
      manager.destroy();
    });

    it('handles empty items array', async () => {
      const mod = await createManager();
      const manager = mod.uploadManager;

      const processor = vi.fn();
      await manager.processFilesParallel([], processor);

      expect(processor).not.toHaveBeenCalled();
      manager.destroy();
    });
  });

  describe('worker fallback', () => {
    it('falls back to main thread when Worker creation fails', async () => {
      globalThis.Worker = vi.fn().mockImplementation(() => {
        throw new Error('Worker not available');
      }) as unknown as typeof Worker;

      const mod = await createManager();
      const manager = mod.uploadManager;

      // Should still be able to calculate hashes via main thread
      const file = new File(['test content'], 'file.pdf');
      const hash = await manager.calculateHash(file);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      manager.destroy();
    });
  });

  describe('destroy()', () => {
    it('terminates worker and clears pending maps', async () => {
      const mod = await createManager();
      const manager = mod.uploadManager;

      // The worker should have been created in the constructor
      const worker = lastCreatedWorker;
      expect(worker).not.toBeNull();

      manager.destroy();

      expect(worker!.terminate).toHaveBeenCalled();
    });

    it('handles destroy when no worker exists', async () => {
      globalThis.Worker = vi.fn().mockImplementation(() => {
        throw new Error('no workers');
      }) as unknown as typeof Worker;

      const mod = await createManager();
      const manager = mod.uploadManager;

      // Should not throw
      expect(() => manager.destroy()).not.toThrow();
    });
  });

  describe('progress callback', () => {
    it('batches progress updates via requestAnimationFrame', async () => {
      const mod = await createManager();
      const manager = mod.uploadManager;

      const callback = vi.fn();
      manager.setProgressCallback(callback);

      // Access the private method via type casting for testing
      const mgr = manager as unknown as {
        queueProgressUpdate: (update: {
          id: string;
          progress: number;
          status: string;
        }) => void;
      };

      mgr.queueProgressUpdate({
        id: 'upload-1',
        progress: 50,
        status: 'uploading',
      });

      // requestAnimationFrame was mocked to call immediately
      expect(mockRAF).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith([
        { id: 'upload-1', progress: 50, status: 'uploading' },
      ]);

      manager.destroy();
    });

    it('setProgressCallback(null) disables callbacks', async () => {
      const mod = await createManager();
      const manager = mod.uploadManager;

      const callback = vi.fn();
      manager.setProgressCallback(callback);
      manager.setProgressCallback(null);

      const mgr = manager as unknown as {
        queueProgressUpdate: (update: {
          id: string;
          progress: number;
          status: string;
        }) => void;
      };
      mgr.queueProgressUpdate({
        id: 'upload-1',
        progress: 50,
        status: 'uploading',
      });

      // RAF should not be called since callback is null
      expect(callback).not.toHaveBeenCalled();

      manager.destroy();
    });
  });

  describe('uploadWithXHR', () => {
    let origXHR: typeof XMLHttpRequest;
    let mockOpen: ReturnType<typeof vi.fn>;
    let mockSend: ReturnType<typeof vi.fn>;
    let mockSetRequestHeader: ReturnType<typeof vi.fn>;
    let mockUploadAddEventListener: ReturnType<typeof vi.fn>;
    let mockAddEventListener: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      origXHR = globalThis.XMLHttpRequest;
      mockOpen = vi.fn();
      mockSend = vi.fn();
      mockSetRequestHeader = vi.fn();
      mockUploadAddEventListener = vi.fn();
      mockAddEventListener = vi.fn();

      globalThis.XMLHttpRequest = vi.fn().mockImplementation(() => ({
        open: mockOpen,
        send: mockSend,
        setRequestHeader: mockSetRequestHeader,
        upload: { addEventListener: mockUploadAddEventListener },
        addEventListener: mockAddEventListener,
        readyState: 4,
        status: 200,
      })) as unknown as typeof XMLHttpRequest;
    });

    afterEach(() => {
      globalThis.XMLHttpRequest = origXHR;
    });

    it('sends FormData via XHR PUT with auth header', async () => {
      const mod = await createManager();
      const manager = mod.uploadManager;

      const file = new File(['data'], 'test.txt');
      const progressFn = vi.fn();

      const uploadPromise = manager.uploadWithXHR(
        '/files/123/upload',
        file,
        'my-token',
        progressFn,
      );

      // Simulate readystatechange with status 200
      const readyStateHandler = mockAddEventListener.mock.calls.find(
        (c: string[]) => c[0] === 'readystatechange',
      )?.[1];
      if (readyStateHandler) readyStateHandler();

      await uploadPromise;

      expect(mockOpen).toHaveBeenCalledWith(
        'PUT',
        expect.stringContaining('/files/123/upload'),
      );
      expect(mockSetRequestHeader).toHaveBeenCalledWith(
        'Authorization',
        'Bearer my-token',
      );
      expect(mockSend).toHaveBeenCalled();
      manager.destroy();
    });

    it('does not set Authorization header when token is null', async () => {
      const mod = await createManager();
      const manager = mod.uploadManager;

      const file = new File(['data'], 'test.txt');

      const uploadPromise = manager.uploadWithXHR(
        '/files/123/upload',
        file,
        null,
        vi.fn(),
      );

      const readyStateHandler = mockAddEventListener.mock.calls.find(
        (c: string[]) => c[0] === 'readystatechange',
      )?.[1];
      if (readyStateHandler) readyStateHandler();

      await uploadPromise;

      expect(mockSetRequestHeader).not.toHaveBeenCalled();
      manager.destroy();
    });
  });
});
