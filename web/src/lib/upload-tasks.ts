/** Persistent upload task storage — survives page refresh, expires after 24 h */

export interface PersistedTask {
  id: string;
  fileName: string;
  sourceId?: string;
  sourceKind?: 'file' | 'directory';
  sourcePath?: string;
  fileId?: string;
  sessionId?: string;
  uploadUrl?: string;
  completeUrl?: string;
  chunkSize?: number;
  totalBytes?: number;
  uploadedBytes?: number;
  status: 'uploading' | 'paused' | 'error' | 'interrupted';
  progress: number;
  expiresAt: number;
}

const KEY = 'zynq:upload_tasks';
const TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

function readAll(): PersistedTask[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as PersistedTask[];
    const now = Date.now();
    const valid = all.filter((t) => t.expiresAt > now);
    if (valid.length !== all.length) writeAll(valid); // prune expired
    return valid;
  } catch {
    return [];
  }
}

function writeAll(tasks: PersistedTask[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks));
  } catch {
    // ignore quota errors
  }
}

export function persistTask(task: PersistedTask): void {
  const tasks = readAll();
  const idx = tasks.findIndex((t) => t.id === task.id);
  const expiresAt = task.expiresAt || Date.now() + TTL;
  const next = { ...task, expiresAt };
  if (idx >= 0) {
    tasks[idx] = next;
  } else {
    tasks.push(next);
  }
  writeAll(tasks);
}

export function removePersistedTask(id: string): void {
  writeAll(readAll().filter((t) => t.id !== id));
}

export function getPersistedTasks(): PersistedTask[] {
  return readAll();
}
