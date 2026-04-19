import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import {
  persistTask,
  removePersistedTask,
  getPersistedTasks,
} from '@/lib/upload-tasks';
import { fileApi } from '@/lib/api';
import { deleteUploadSource } from '@/lib/upload-sources';

export interface UploadProgress {
  id: string;
  fileName: string;
  fileId?: string;
  sessionId?: string;
  uploadUrl?: string;
  completeUrl?: string;
  chunkSize?: number;
  totalBytes?: number;
  uploadedBytes?: number;
  expiresAt?: number;
  sourceId?: string;
  sourceKind?: 'file' | 'directory';
  sourcePath?: string;
  progress: number;
  loadedBytes?: number;
  etaSeconds?: number;
  speedBps?: number;
  status:
    | 'queued'
    | 'checking'
    | 'uploading'
    | 'paused'
    | 'completed'
    | 'error'
    | 'duplicate'
    | 'interrupted'; // restored after page reload / network cut
  cancel?: () => void;
  pause?: () => void;
  retry?: (file?: File) => void | Promise<void>;
}

interface UploadContextType {
  uploadQueue: UploadProgress[];
  isPopupOpen: boolean;
  openPopup: () => void;
  closePopup: () => void;
  addUpload: (fileName: string) => string;
  updateUpload: (id: string, updates: Partial<Omit<UploadProgress, 'id'>>) => void;
  removeUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => void;
  cancelAll: () => void;
  dismissCompleted: () => void;
}

const UploadContext = createContext<UploadContextType>({
  uploadQueue: [],
  isPopupOpen: false,
  openPopup: () => {},
  closePopup: () => {},
  addUpload: () => '',
  updateUpload: () => {},
  removeUpload: () => {},
  cancelUpload: () => {},
  pauseUpload: () => {},
  resumeUpload: () => {},
  cancelAll: () => {},
  dismissCompleted: () => {},
});

let uploadIdCounter = 0;

export const UploadProvider = ({ children }: { children: ReactNode }) => {
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  // On mount: restore interrupted tasks from localStorage
  useEffect(() => {
    const persisted = getPersistedTasks();
    if (persisted.length === 0) return;
    const restored: UploadProgress[] = persisted.map((t) => ({
      id: t.id,
      fileName: t.fileName,
      progress: t.progress,
      fileId: t.fileId,
      sessionId: t.sessionId,
      uploadUrl: t.uploadUrl,
      completeUrl: t.completeUrl,
      chunkSize: t.chunkSize,
      totalBytes: t.totalBytes,
      uploadedBytes: t.uploadedBytes,
      expiresAt: t.expiresAt,
      sourceId: t.sourceId,
      sourceKind: t.sourceKind,
      sourcePath: t.sourcePath,
      // uploading/paused tasks became interrupted after reload
      status: 'interrupted' as const,
    }));
    setUploadQueue(restored);
    setIsPopupOpen(true);
  }, []);

  const addUpload = useCallback((fileName: string): string => {
    const id = `upload-${++uploadIdCounter}`;
    setUploadQueue((prev) => [
      ...prev,
      { id, fileName, progress: 0, status: 'queued' },
    ]);
    persistTask({
      id,
      fileName,
      status: 'uploading',
      progress: 0,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      sourceId: undefined,
      sourceKind: undefined,
      sourcePath: undefined,
    });
    setIsPopupOpen(true);
    return id;
  }, []);

  const updateUpload = useCallback(
    (id: string, updates: Partial<Omit<UploadProgress, 'id'>>) => {
      setUploadQueue((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const next = { ...item, ...updates };
          // Persist only actionable statuses; remove when done
          if (next.status === 'completed' || next.status === 'duplicate') {
            removePersistedTask(id);
            if (next.sourceId) void deleteUploadSource(next.sourceId);
          } else if (
            next.status === 'uploading' ||
            next.status === 'paused' ||
            next.status === 'error' ||
            next.status === 'interrupted'
          ) {
            persistTask({
              id: next.id,
              fileName: next.fileName,
              status: next.status,
              progress: next.progress ?? 0,
              expiresAt: next.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000,
              fileId: next.fileId,
              sessionId: next.sessionId,
              uploadUrl: next.uploadUrl,
              completeUrl: next.completeUrl,
              chunkSize: next.chunkSize,
              totalBytes: next.totalBytes,
              uploadedBytes: next.uploadedBytes,
              sourceId: next.sourceId,
              sourceKind: next.sourceKind,
              sourcePath: next.sourcePath,
            });
          }
          return next;
        }),
      );
    },
    [],
  );

  const removeUpload = useCallback((id: string) => {
    setUploadQueue((prev) => {
      const item = prev.find((u) => u.id === id);
      removePersistedTask(id);
      if (item?.sourceId) void deleteUploadSource(item.sourceId);
      return prev.filter((u) => u.id !== id);
    });
  }, []);

  const cancelUpload = useCallback((id: string) => {
    removePersistedTask(id);
    setUploadQueue((prev) => {
      const item = prev.find((u) => u.id === id);
      item?.cancel?.();
      if (item?.fileId && item?.sessionId) {
        void fileApi.abortUploadSession(item.fileId, item.sessionId).catch(() => {});
      }
      if (item?.sourceId) void deleteUploadSource(item.sourceId);
      return prev.filter((u) => u.id !== id);
    });
  }, []);

  const pauseUpload = useCallback((id: string) => {
    setUploadQueue((prev) => {
      const item = prev.find((u) => u.id === id);
      if (item?.pause) item.pause();
      return prev;
    });
  }, []);

  const resumeUpload = useCallback((id: string) => {
    setUploadQueue((prev) => {
      const item = prev.find((u) => u.id === id);
      if (item?.retry) void Promise.resolve(item.retry()).catch(() => {});
      return prev;
    });
  }, []);

  const cancelAll = useCallback(() => {
    setUploadQueue((prev) => {
      prev.forEach((item) => {
        if (
          item.status === 'uploading' ||
          item.status === 'queued' ||
          item.status === 'checking' ||
          item.status === 'paused'
        ) {
          item.cancel?.();
        }
        removePersistedTask(item.id);
        if (item.sourceId) void deleteUploadSource(item.sourceId);
      });
      return [];
    });
  }, []);

  // Only removes completed/duplicate — errors, paused, interrupted stay visible
  const dismissCompleted = useCallback(() => {
    setUploadQueue((prev) =>
      prev.filter(
        (item) =>
          item.status !== 'completed' && item.status !== 'duplicate',
      ),
    );
  }, []);

  const openPopup = useCallback(() => setIsPopupOpen(true), []);
  const closePopup = useCallback(() => setIsPopupOpen(false), []);

  return (
    <UploadContext.Provider
      value={{
        uploadQueue,
        isPopupOpen,
        openPopup,
        closePopup,
        addUpload,
        updateUpload,
        removeUpload,
        cancelUpload,
        pauseUpload,
        resumeUpload,
        cancelAll,
        dismissCompleted,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
};

export const useUploadContext = () => useContext(UploadContext);
