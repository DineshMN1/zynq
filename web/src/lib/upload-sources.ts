/** IndexedDB-backed upload source store for resumable uploads after refresh. */

export type UploadSourceKind = 'file' | 'directory';

export interface StoredUploadSource {
  id: string;
  kind: UploadSourceKind;
  name: string;
  relativePath?: string;
  handle: FileSystemHandle;
  createdAt: number;
  expiresAt: number;
}

const DB_NAME = 'zynq:upload_sources';
const DB_VERSION = 1;
const STORE = 'sources';
const TTL = 24 * 60 * 60 * 1000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveUploadSource(source: StoredUploadSource): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      ...source,
      expiresAt: source.expiresAt || Date.now() + TTL,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }).catch(() => {});
  } finally {
    db.close();
  }
}

export async function getUploadSource(id: string): Promise<StoredUploadSource | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      const result = await requestToPromise(req);
      if (!result) return null;
      if (result.expiresAt && result.expiresAt <= Date.now()) {
        await deleteUploadSource(id);
        return null;
      }
      return result as StoredUploadSource;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function deleteUploadSource(id: string): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }).catch(() => {});
    } finally {
      db.close();
    }
  } catch {
    // ignore
  }
}

async function ensureReadPermission(handle: FileSystemHandle): Promise<boolean> {
  const anyHandle = handle as FileSystemHandle & {
    queryPermission?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  };
  if (!anyHandle.queryPermission || !anyHandle.requestPermission) return true;
  const current = await anyHandle.queryPermission({ mode: 'read' });
  if (current === 'granted') return true;
  const next = await anyHandle.requestPermission({ mode: 'read' });
  return next === 'granted';
}

export async function resolveStoredUploadFile(source: StoredUploadSource): Promise<File> {
  if (!(await ensureReadPermission(source.handle))) {
    throw new Error('Permission denied for upload source');
  }

  if (source.kind === 'file') {
    return (source.handle as FileSystemFileHandle).getFile();
  }

  const root = source.handle as FileSystemDirectoryHandle;
  const relative = source.relativePath || source.name;
  const parts = relative.split('/').filter(Boolean);
  const rootName = root.name;
  const pathParts = parts[0] === rootName ? parts.slice(1) : parts;
  if (pathParts.length === 0) {
    throw new Error('Invalid upload source path');
  }

  let dir: FileSystemDirectoryHandle = root;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const next = await dir.getDirectoryHandle(pathParts[i]);
    dir = next;
  }
  const fileHandle = await dir.getFileHandle(pathParts[pathParts.length - 1]);
  return fileHandle.getFile();
}
