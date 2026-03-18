import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';

export interface UploadProgress {
  id: string;
  fileName: string;
  progress: number;
  loadedBytes?: number;
  totalBytes?: number;
  etaSeconds?: number;
  speedBps?: number;
  status:
    | 'queued'
    | 'checking'
    | 'uploading'
    | 'paused'
    | 'completed'
    | 'error'
    | 'duplicate';
  cancel?: () => void;
  pause?: () => void;
  retry?: () => void;
}

interface UploadContextType {
  uploadQueue: UploadProgress[];
  addUpload: (fileName: string) => string;
  updateUpload: (
    id: string,
    updates: Partial<Omit<UploadProgress, 'id'>>,
  ) => void;
  removeUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => void;
  cancelAll: () => void;
  dismissCompleted: () => void;
}

const UploadContext = createContext<UploadContextType>({
  uploadQueue: [],
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

  const addUpload = useCallback((fileName: string): string => {
    const id = `upload-${++uploadIdCounter}`;
    setUploadQueue((prev) => [
      ...prev,
      { id, fileName, progress: 0, status: 'queued' },
    ]);
    return id;
  }, []);

  const updateUpload = useCallback(
    (id: string, updates: Partial<Omit<UploadProgress, 'id'>>) => {
      setUploadQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  const removeUpload = useCallback((id: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const cancelUpload = useCallback((id: string) => {
    setUploadQueue((prev) => {
      const item = prev.find((u) => u.id === id);
      item?.cancel?.();
      return prev.filter((u) => u.id !== id);
    });
  }, []);

  const pauseUpload = useCallback((id: string) => {
    setUploadQueue((prev) => {
      const item = prev.find((u) => u.id === id);
      if (item?.pause) {
        item.pause();
      }
      return prev;
    });
  }, []);

  const resumeUpload = useCallback((id: string) => {
    setUploadQueue((prev) => {
      const item = prev.find((u) => u.id === id);
      if (item?.retry) {
        // Fire and forget — retry callback updates status internally
        item.retry();
      }
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
      });
      return [];
    });
  }, []);

  const dismissCompleted = useCallback(() => {
    setUploadQueue((prev) =>
      prev.filter(
        (item) =>
          item.status !== 'completed' &&
          item.status !== 'error' &&
          item.status !== 'duplicate',
      ),
    );
  }, []);

  return (
    <UploadContext.Provider
      value={{
        uploadQueue,
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
