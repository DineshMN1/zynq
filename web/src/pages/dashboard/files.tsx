import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  Search,
  FolderPlus,
  ChevronDown,
  Trash2,
  File as FileIcon,
  Folder,
  HardDrive,
  X,
} from 'lucide-react';
import {
  fileApi,
  userApi,
  getApiBaseUrl,
  getAuthToken,
  type FileMetadata,
  type ShareableUser,
  ApiError,
} from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/toast-container';
import { FileGrid } from '@/features/file/components/file-grid';
import { FilePreviewDialog } from '@/features/file/components/file-preview-dialog';
import { FileBreadcrumb } from '@/features/file/components/file-breadcrumb';
import { CreateFolderDialog } from '@/features/file/components/create-folder-dialog';
import { PublicLinkDialog } from '@/features/share/components/public-link-dialog';
import {
  DuplicateWarningDialog,
  type DuplicateItem,
} from '@/features/file/components/duplicate-warning-dialog';
import { FolderUploadDialog } from '@/features/file/components/folder-upload-dialog';
import { DropZoneOverlay } from '@/features/file/components/drop-zone-overlay';
import { uploadManager } from '@/lib/upload-manager';
import { formatBytes } from '@/lib/auth';
import { emitStorageRefresh } from '@/lib/storage-events';
import { useUploadContext } from '@/context/UploadContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, getSafeMimeType } from '@/lib/utils';

// Maximum allowed upload size (15 GB)
const MAX_FILE_BYTES = 15 * 1024 * 1024 * 1024;

function getXhrErrorMessage(xhr: XMLHttpRequest): string {
  const status = xhr.status;
  const fallback =
    status === 413
      ? 'File is too large.'
      : status >= 500
        ? 'Server error during upload.'
        : 'Upload failed.';

  const raw = xhr.responseText?.trim();
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    // Ignore non-JSON payloads (e.g. proxy HTML pages)
  }

  return fallback;
}

function getCurrentLocalDateTime(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function validatePublicShareInputs(
  password: string,
  expiresAt: string,
): {
  passwordError: string;
  expiresAtError: string;
} {
  const trimmedPassword = password.trim();
  const passwordError =
    trimmedPassword.length > 0 && trimmedPassword.length < 6
      ? 'Password must be at least 6 characters.'
      : '';

  let expiresAtError = '';
  if (expiresAt) {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const nowMinutePrecision = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      0,
      0,
    ).getTime();
    if (Number.isNaN(expiryDate.getTime())) {
      expiresAtError = 'Please enter a valid expiry date and time.';
    } else if (expiryDate.getTime() < nowMinutePrecision) {
      expiresAtError = 'Expiry must be in the future.';
    }
  }

  return { passwordError, expiresAtError };
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [pathStack, setPathStack] = useState<
    { id: string | null; name: string }[]
  >([{ id: null, name: 'Home' }]);

  // Restore path from history state or URL on client mount
  useEffect(() => {
    if (window.history.state?.pathStack) {
      setPathStack(window.history.state.pathStack);
    } else {
      const folderParam = new URLSearchParams(window.location.search).get(
        'folder',
      );
      if (folderParam) {
        setPathStack([
          { id: null, name: 'Home' },
          { id: folderParam, name: '...' },
        ]);
      }
    }
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ref used by handleUploadFolderClick to call .click() on Firefox fallback.
  const folderFallbackRef = useRef<HTMLInputElement>(null);

  // Callback ref: sets webkitdirectory AND stores in folderFallbackRef.
  const setFolderInputRef = useCallback((el: HTMLInputElement | null) => {
    (
      folderFallbackRef as React.MutableRefObject<HTMLInputElement | null>
    ).current = el;
    if (el) el.setAttribute('webkitdirectory', '');
  }, []);

  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [publicLinkFileName, setPublicLinkFileName] = useState<string | null>(
    null,
  );
  const { addUpload, updateUpload, removeUpload } = useUploadContext();
  const uploadSpeedRef = useRef<
    Map<string, { lastTs: number; lastLoaded: number; smoothedBps: number }>
  >(new Map());
  // Tracks when each upload XHR began so the first progress event can
  // compute an immediate speed estimate (loaded / elapsed) instead of 0.
  const uploadStartRef = useRef<Map<string, number>>(new Map());
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingDuplicates, setPendingDuplicates] = useState<DuplicateItem[]>(
    [],
  );

  // Large-file (5 GB) warning dialog
  const [showLargeFileWarning, setShowLargeFileWarning] = useState(false);
  const [pendingLargeFileUpload, setPendingLargeFileUpload] = useState<
    { file: File; parentId?: string }[]
  >([]);

  // Folder drop modal (in-app drag zone — avoids browser webkitdirectory popup)
  const [showFolderDropModal, setShowFolderDropModal] = useState(false);
  const [folderModalDragActive, setFolderModalDragActive] = useState(false);

  // Folder upload confirmation state
  const [showFolderUploadDialog, setShowFolderUploadDialog] = useState(false);
  const [pendingFolderUpload, setPendingFolderUpload] = useState<{
    files: File[];
    folderName: string;
    totalSize: number;
    fileCount: number;
  } | null>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedId = useRef<string | null>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    type: 'single' | 'bulk';
    id?: string;
  }>({ open: false, type: 'single' });

  // Share confirmation state
  const [shareConfirm, setShareConfirm] = useState<{
    open: boolean;
    file: FileMetadata | null;
  }>({ open: false, file: null });
  const [shareUserDialog, setShareUserDialog] = useState<{
    open: boolean;
    file: FileMetadata | null;
  }>({ open: false, file: null });
  const [shareUsers, setShareUsers] = useState<ShareableUser[]>([]);
  const [shareUsersLoading, setShareUsersLoading] = useState(false);
  const [selectedShareUserId, setSelectedShareUserId] = useState('');
  const [sharePermission, setSharePermission] = useState<'read' | 'write'>(
    'read',
  );
  const [publicSharePassword, setPublicSharePassword] = useState('');
  const [publicShareExpiresAt, setPublicShareExpiresAt] = useState('');
  const [publicSharePasswordError, setPublicSharePasswordError] = useState('');
  const [publicShareExpiresAtError, setPublicShareExpiresAtError] =
    useState('');

  // Drag & drop state
  const [isDragActive, setIsDragActive] = useState(false);
  const dragCounter = useRef(0);

  // Rename state
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean;
    fileId: string | null;
    currentName: string;
  }>({ open: false, fileId: null, currentName: '' });
  const [renameValue, setRenameValue] = useState('');

  // Preview state
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);

  const currentFolderId = pathStack[pathStack.length - 1]?.id;
  const skipHistoryPush = useRef(false);

  // Sync folder navigation with browser history
  useEffect(() => {
    if (skipHistoryPush.current) {
      skipHistoryPush.current = false;
      return;
    }
    const url = currentFolderId
      ? `/dashboard/files?folder=${currentFolderId}`
      : '/dashboard/files';
    // Only push if URL actually changed
    if (window.location.pathname + window.location.search !== url) {
      window.history.pushState({ pathStack }, '', url);
    }
  }, [currentFolderId, pathStack]);

  // Replace initial history entry with pathStack state
  useEffect(() => {
    const url = currentFolderId
      ? `/dashboard/files?folder=${currentFolderId}`
      : '/dashboard/files';
    window.history.replaceState({ pathStack }, '', url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (e.state?.pathStack) {
        skipHistoryPush.current = true;
        setPathStack(e.state.pathStack);
      } else {
        skipHistoryPush.current = true;
        setPathStack([{ id: null, name: 'Home' }]);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Upload helpers — addUpload/updateUpload/removeUpload come from UploadContext
  const removeUploadProgress = (progressId: string) => {
    uploadSpeedRef.current.delete(progressId);
    uploadStartRef.current.delete(progressId);
    removeUpload(progressId);
  };

  /**
   * Registers a retry callback on an upload item. The callback resets the item
   * to 'checking' and re-runs `fn`, re-registering itself on each failure so
   * the retry button stays available after multiple attempts.
   */
  const registerRetry = (progressId: string, fn: () => Promise<void>) => {
    const retryFn = async () => {
      updateUpload(progressId, { status: 'checking', progress: 0 });
      registerRetry(progressId, fn); // re-register before attempt
      try {
        await fn();
      } catch {
        updateUpload(progressId, { status: 'error' });
        registerRetry(progressId, fn); // re-register after failure
      }
    };
    updateUpload(progressId, { retry: retryFn });
  };

  /**
   * Splits file entries into three buckets:
   *  - rejected:  size > 5 GB (never uploaded)
   *  - atLimit:   size === 5 GB exactly (warn before uploading)
   *  - ok:        size < 5 GB (upload immediately)
   */
  const checkFileSizeLimits = (
    entries: { file: File; parentId?: string }[],
  ): {
    ok: { file: File; parentId?: string }[];
    atLimit: { file: File; parentId?: string }[];
    rejected: File[];
  } => {
    const ok: { file: File; parentId?: string }[] = [];
    const atLimit: { file: File; parentId?: string }[] = [];
    const rejected: File[] = [];
    for (const entry of entries) {
      if (entry.file.size > MAX_FILE_BYTES) {
        rejected.push(entry.file);
      } else if (entry.file.size === MAX_FILE_BYTES) {
        atLimit.push(entry);
      } else {
        ok.push(entry);
      }
    }
    return { ok, atLimit, rejected };
  };

  /** Called when the user confirms uploading the at-limit (5 GB) files. */
  const handleLargeFileWarningProceed = async () => {
    setShowLargeFileWarning(false);
    const items = pendingLargeFileUpload;
    setPendingLargeFileUpload([]);
    if (items.length === 0) return;
    // Pass directly to the hashing+upload phase, bypassing the size-limit check
    // (user already confirmed these are at the 5 GB limit).
    await uploadMultipleFilesCore(items);
  };

  const handleLargeFileWarningCancel = () => {
    setShowLargeFileWarning(false);
    setPendingLargeFileUpload([]);
    toast({
      title: 'Upload cancelled',
      description: 'Large file upload was cancelled.',
    });
  };

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fileApi.list({
        page: 1,
        limit: 50,
        search: search || undefined,
        parentId: currentFolderId || undefined,
      });
      setFiles(response.items);
      setTotal(response.meta.total);
    } catch (error) {
      console.error('Failed to load files:', error);
      toast({
        title: 'Error loading files',
        description: 'Something went wrong fetching your files.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [search, currentFolderId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Resolve folder name if we have a "..." placeholder (direct URL load)
  const resolvedRef = useRef(false);
  useEffect(() => {
    if (resolvedRef.current) return;
    const placeholder = pathStack.find((p) => p.name === '...' && p.id);
    if (!placeholder?.id) return;
    resolvedRef.current = true;
    const folderId = placeholder.id;
    fileApi
      .get(folderId)
      .then((folder) => {
        setPathStack((prev) =>
          prev.map((p) =>
            p.id === folderId ? { ...p, name: folder.name } : p,
          ),
        );
      })
      .catch(() => {
        setPathStack([{ id: null, name: 'Home' }]);
      });
  }, [pathStack]);

  // Clear selection on folder navigation or search change
  useEffect(() => {
    setSelectedIds(new Set());
    lastClickedId.current = null;
  }, [currentFolderId, search]);

  // Ctrl+A keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setSelectedIds(new Set(files.map((f) => f.id)));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [files]);

  // Multi-select functions
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastClickedId.current = id;
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    lastClickedId.current = null;
  };

  const selectAll = () => {
    setSelectedIds(new Set(files.map((f) => f.id)));
  };

  const handleCardClick = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedId.current) {
      const lastIdx = files.findIndex((f) => f.id === lastClickedId.current);
      const curIdx = files.findIndex((f) => f.id === id);
      if (lastIdx !== -1 && curIdx !== -1) {
        const start = Math.min(lastIdx, curIdx);
        const end = Math.max(lastIdx, curIdx);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) {
            next.add(files[i].id);
          }
          return next;
        });
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      toggleSelect(id);
      return;
    }

    const file = files.find((f) => f.id === id);
    if (file?.is_folder) {
      handleOpenFolder(file);
    }
    // Single click on a file does nothing — use checkbox or Ctrl+click to select
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirm({ open: true, type: 'bulk' });
  };

  const confirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const count = ids.length;
    setDeleteConfirm({ open: false, type: 'bulk' });

    try {
      await fileApi.bulkDelete(ids);
      setFiles((prev) => prev.filter((f) => !selectedIds.has(f.id)));
      setSelectedIds(new Set());
      toast({
        title: 'Items deleted',
        description: `${count} ${count === 1 ? 'item' : 'items'} moved to trash.`,
      });
    } catch (error) {
      console.error('Bulk delete failed:', error);
      toast({
        title: 'Error deleting files',
        description: 'Unable to move files to trash.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ open: true, type: 'single', id });
  };

  const confirmSingleDelete = async () => {
    const id = deleteConfirm.id;
    setDeleteConfirm({ open: false, type: 'single' });
    if (!id) return;

    try {
      await fileApi.delete(id);
      setFiles(files.filter((f) => f.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast({
        title: 'Item deleted',
        description: 'Moved to trash successfully.',
      });
    } catch (error) {
      console.error('Failed to move item to trash:', error);
      toast({
        title: 'Error deleting item',
        description: 'Unable to move item to trash.',
        variant: 'destructive',
      });
    }
  };

  const handleUploadFileClick = () => fileInputRef.current?.click();

  const handleFolderInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const allFiles = Array.from(fileList);
    const rootFolderName =
      allFiles[0]?.webkitRelativePath?.split('/')[0] || 'Uploaded Folder';
    const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);

    setPendingFolderUpload({
      files: allFiles,
      folderName: rootFolderName,
      totalSize,
      fileCount: allFiles.length,
    });
    setShowFolderUploadDialog(true);
    e.target.value = '';
  };

  /**
   * Opens a folder picker without triggering the browser's native
   * "Upload N files to this site?" security dialog.
   * Uses the File System Access API (showDirectoryPicker) in Chrome/Edge/Safari.
   * Falls back to the hidden <input webkitdirectory> for Firefox.
   */
  const handleUploadFolderClick = async () => {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      folderFallbackRef.current?.click();
      return;
    }

    try {
      type DirPickerWindow = Window & {
        showDirectoryPicker: (opts?: {
          mode?: string;
        }) => Promise<FileSystemDirectoryHandle>;
      };
      const dirHandle = await (window as DirPickerWindow).showDirectoryPicker({
        mode: 'read',
      });

      const allFilesWithPaths: { file: File; relativePath: string }[] = [];

      const traverse = async (
        handle: FileSystemDirectoryHandle,
        prefix: string,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const [name, entry] of (handle as any).entries()) {
          const fullPath = `${prefix}/${name}`;
          if ((entry as { kind: string }).kind === 'file') {
            const file = await (entry as FileSystemFileHandle).getFile();
            allFilesWithPaths.push({ file, relativePath: fullPath });
          } else if ((entry as { kind: string }).kind === 'directory') {
            await traverse(entry as FileSystemDirectoryHandle, fullPath);
          }
        }
      };

      await traverse(dirHandle, dirHandle.name);

      if (allFilesWithPaths.length === 0) {
        toast({
          title: 'Empty folder',
          description: 'The selected folder contains no files.',
        });
        return;
      }

      const totalSize = allFilesWithPaths.reduce(
        (sum, f) => sum + f.file.size,
        0,
      );

      setPendingFolderUpload({
        files: allFilesWithPaths.map(({ file, relativePath }) => {
          const newFile = new File([file], file.name, { type: file.type });
          Object.defineProperty(newFile, 'webkitRelativePath', {
            value: relativePath,
            writable: false,
          });
          return newFile;
        }),
        folderName: dirHandle.name,
        totalSize,
        fileCount: allFilesWithPaths.length,
      });
      setShowFolderUploadDialog(true);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      console.error('showDirectoryPicker error:', err);
    }
  };

  const handleFolderModalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFolderModalDragActive(false);

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.();
        if (entry && entry.isDirectory) entries.push(entry);
      }
    }

    if (entries.length === 0) {
      toast({
        title: 'Drop a folder',
        description: 'Please drop a folder, not individual files.',
        variant: 'destructive',
      });
      return;
    }

    setShowFolderDropModal(false);

    const allFilesWithPaths: { file: File; relativePath: string }[] = [];
    for (const entry of entries) {
      const filesFromEntry = await traverseEntry(entry);
      allFilesWithPaths.push(...filesFromEntry);
    }

    if (allFilesWithPaths.length === 0) {
      toast({
        title: 'Empty folder',
        description: 'The folder contains no files.',
        variant: 'destructive',
      });
      return;
    }

    const rootFolderName =
      entries.find((entry) => entry.isDirectory)?.name || 'Dropped Folder';
    const totalSize = allFilesWithPaths.reduce(
      (sum, f) => sum + f.file.size,
      0,
    );

    setPendingFolderUpload({
      files: allFilesWithPaths.map((f) => {
        const newFile = new File([f.file], f.file.name, { type: f.file.type });
        Object.defineProperty(newFile, 'webkitRelativePath', {
          value: f.relativePath,
          writable: false,
        });
        return newFile;
      }),
      folderName: rootFolderName,
      totalSize,
      fileCount: allFilesWithPaths.length,
    });
    setShowFolderUploadDialog(true);
  };

  const uploadFileWithProgress = (
    url: string,
    file: File,
    contentType: string,
    progressId: string,
  ): Promise<void> => {
    const apiBase = getApiBaseUrl();
    const fullUrl = url.startsWith('http')
      ? url
      : `${apiBase}${url.replace(/^\/api\/v1/, '')}`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      // Track why the XHR was aborted so handlers can distinguish pause vs cancel
      const flags = { abortReason: '' as '' | 'pause' | 'cancel' };
      let settled = false;

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          const now = performance.now();
          const current = uploadSpeedRef.current.get(progressId);
          const startTs = uploadStartRef.current.get(progressId) ?? now;
          const previousTs = current?.lastTs ?? startTs;
          const previousLoaded = current?.lastLoaded ?? 0;
          const elapsedSeconds = (now - previousTs) / 1000;
          const deltaBytes = event.loaded - previousLoaded;
          const instantBps =
            elapsedSeconds > 0 && deltaBytes > 0
              ? deltaBytes / elapsedSeconds
              : 0;
          const smoothedBps = current
            ? current.smoothedBps * 0.7 + instantBps * 0.3
            : instantBps;
          uploadSpeedRef.current.set(progressId, {
            lastTs: now,
            lastLoaded: event.loaded,
            smoothedBps,
          });

          const remainingBytes = Math.max(0, event.total - event.loaded);
          let etaSeconds =
            smoothedBps > 0
              ? Math.ceil(remainingBytes / smoothedBps)
              : undefined;
          if (
            percent >= 95 &&
            remainingBytes > 0 &&
            (!etaSeconds || etaSeconds < 3)
          ) {
            etaSeconds = 3;
          }

          updateUpload(progressId, {
            progress: percent,
            loadedBytes: event.loaded,
            totalBytes: event.total,
            etaSeconds,
            speedBps: Math.round(smoothedBps),
          });
        }
      });

      xhr.addEventListener('abort', () => {
        if (settled) return;
        if (flags.abortReason === 'pause') {
          settled = true;
          uploadSpeedRef.current.delete(progressId);
          uploadStartRef.current.delete(progressId);
          // Set paused status and register a resume callback
          const resumeFn = async () => {
            updateUpload(progressId, { status: 'uploading', progress: 0 });
            try {
              await uploadFileWithProgress(url, file, contentType, progressId);
            } catch {
              updateUpload(progressId, { status: 'error', retry: resumeFn });
            }
          };
          updateUpload(progressId, {
            status: 'paused',
            pause: undefined,
            cancel: undefined,
            retry: resumeFn,
          });
          resolve();
          return;
        }
        // Normal cancel — don't set error (item is removed from queue)
      });

      xhr.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        reject(new Error('Network error'));
      });

      xhr.addEventListener('readystatechange', () => {
        if (settled || xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          settled = true;
          updateUpload(progressId, {
            progress: 100,
            status: 'completed',
            etaSeconds: 0,
          });
          uploadSpeedRef.current.delete(progressId);
          uploadStartRef.current.delete(progressId);
          resolve();
        } else if (xhr.status > 0) {
          settled = true;
          updateUpload(progressId, { status: 'error' });
          uploadSpeedRef.current.delete(progressId);
          uploadStartRef.current.delete(progressId);
          reject(
            new ApiError(
              getXhrErrorMessage(xhr),
              xhr.status,
              'UPLOAD_FAILED',
              { responseText: xhr.responseText },
            ),
          );
        }
        // status 0 with no abortReason means cancel — item already removed
      });

      xhr.open('PUT', fullUrl);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
      const token = getAuthToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      // Register cancel and pause handlers
      updateUpload(progressId, {
        cancel: () => {
          flags.abortReason = 'cancel';
          xhr.abort();
        },
        pause: () => {
          flags.abortReason = 'pause';
          xhr.abort();
        },
      });
      uploadStartRef.current.set(progressId, performance.now());
      xhr.send(file);
    });
  };

  const proceedWithUploadForId = async (
    file: File,
    fileHash: string,
    skipDuplicateCheck: boolean,
    progressId: string,
    targetParentId?: string,
  ) => {
    updateUpload(progressId, { status: 'uploading', progress: 0 });

    const parentId = targetParentId ?? currentFolderId ?? undefined;

    const safeMime = getSafeMimeType(file);

    const created = await fileApi.create({
      name: file.name,
      size: file.size,
      mimeType: safeMime,
      parentId,
      isFolder: false,
      fileHash: fileHash || undefined,
      skipDuplicateCheck: skipDuplicateCheck || undefined,
    });

    // Optimistically insert the file into the grid immediately after the DB
    // record is created, so it appears during the upload rather than only
    // after the server responds (which can lag 5-30s for large files).
    const createdParent = created.parent_id ?? null;
    const currentFolder = currentFolderId ?? null;
    if (createdParent === currentFolder) {
      setFiles((prev) =>
        prev.some((f) => f.id === created.id) ? prev : [...prev, created],
      );
      setTotal((prev) => prev + 1);
    }

    if (created.uploadUrl) {
      await uploadFileWithProgress(
        created.uploadUrl,
        file,
        safeMime,
        progressId,
      );
    } else {
      updateUpload(progressId, { progress: 100, status: 'completed' });
    }
  };

  /** Core upload logic — no size-limit check. Called after user confirmation for at-limit files. */
  const uploadMultipleFilesCore = async (
    fileEntries: { file: File; parentId?: string }[],
  ) => {
    if (fileEntries.length === 0) return;

    // Phase 1: Hash all files and check for duplicates
    const duplicates: DuplicateItem[] = [];
    const readyToUpload: { file: File; hash: string; parentId?: string }[] = [];

    await uploadManager.processFilesParallel(
      fileEntries,
      async (entry) => {
        // Returns '' for files > 200 MB — archives and videos skip dedup
        const fileHash = await uploadManager.calculateHash(entry.file);
        if (!fileHash) {
          readyToUpload.push({
            file: entry.file,
            hash: '',
            parentId: entry.parentId,
          });
          return;
        }
        try {
          const { isDuplicate, existingFile, location } = await fileApi.checkDuplicate(
            fileHash,
            entry.file.name,
          );
          if (isDuplicate && existingFile) {
            duplicates.push({
              file: entry.file,
              hash: fileHash,
              existingFile,
              location,
              parentId: entry.parentId,
            });
          } else {
            readyToUpload.push({
              file: entry.file,
              hash: fileHash,
              parentId: entry.parentId,
            });
          }
        } catch {
          // checkDuplicate failed — treat as non-duplicate
          readyToUpload.push({
            file: entry.file,
            hash: fileHash,
            parentId: entry.parentId,
          });
        }
      },
      3,
    );

    // Phase 2: Upload non-duplicate files immediately
    if (readyToUpload.length > 0) {
      const progressIds = readyToUpload.map((entry) =>
        addUpload(entry.file.name),
      );
      const uploadTasks = readyToUpload.map((entry, i) => ({
        ...entry,
        progressId: progressIds[i],
      }));

      await uploadManager.processFilesParallel(
        uploadTasks,
        async ({ file, hash, parentId, progressId }) => {
          registerRetry(progressId, () =>
            proceedWithUploadForId(file, hash, true, progressId, parentId),
          );
          try {
            await proceedWithUploadForId(
              file,
              hash,
              true,
              progressId,
              parentId,
            );
          } catch {
            updateUpload(progressId, { status: 'error' });
          }
        },
        3,
      );

      await loadFiles();
      emitStorageRefresh();

      setTimeout(() => {
        progressIds.forEach((id) => removeUploadProgress(id));
      }, 2000);
    }

    // Phase 3: Show dialog for duplicates
    if (duplicates.length > 0) {
      setPendingDuplicates(duplicates);
      setShowDuplicateDialog(true);
    }
  };

  /** Size-checking wrapper around uploadMultipleFilesCore. */
  const uploadMultipleFiles = async (
    fileEntries: { file: File; parentId?: string }[],
  ) => {
    if (fileEntries.length === 0) return;
    const { ok, atLimit, rejected } = checkFileSizeLimits(fileEntries);
    if (rejected.length > 0) {
      toast({
        title: `${rejected.length} file${rejected.length > 1 ? 's' : ''} too large`,
        description: `Files exceeding 5 GB cannot be uploaded: ${rejected.map((f) => f.name).join(', ')}`,
        variant: 'destructive',
      });
    }
    if (atLimit.length > 0) {
      setPendingLargeFileUpload((prev) => [...prev, ...atLimit]);
      setShowLargeFileWarning(true);
    }
    if (ok.length > 0) await uploadMultipleFilesCore(ok);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    if (fileList.length > 1) {
      const entries = Array.from(fileList).map((file) => ({
        file,
        parentId: currentFolderId || undefined,
      }));
      await uploadMultipleFiles(entries);
      e.target.value = '';
      return;
    }

    const file = fileList[0];

    // Single-file size check
    if (file.size > MAX_FILE_BYTES) {
      toast({
        title: 'File too large',
        description: `${file.name} exceeds the 5 GB upload limit.`,
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }
    if (file.size === MAX_FILE_BYTES) {
      setPendingLargeFileUpload([
        { file, parentId: currentFolderId || undefined },
      ]);
      setShowLargeFileWarning(true);
      e.target.value = '';
      return;
    }

    const progressId = addUpload(file.name);

    try {
      updateUpload(progressId, { status: 'checking' });
      // Returns '' for files >200 MB — large archives/videos skip dedup
      const fileHash = await uploadManager.calculateHash(file);

      if (fileHash) {
        // Check for duplicates before uploading (only for documents and images)
        const { isDuplicate, existingFile, location } = await fileApi.checkDuplicate(
          fileHash,
          file.name,
        );

        if (isDuplicate && existingFile) {
          setPendingDuplicates([{ file, hash: fileHash, existingFile, location }]);
          setShowDuplicateDialog(true);
          removeUploadProgress(progressId);
          e.target.value = '';
          return;
        }
      }

      // No duplicate (or large file bypassed dedup), proceed with upload
      registerRetry(progressId, () =>
        proceedWithUploadForId(file, fileHash, false, progressId),
      );
      await proceedWithUploadForId(file, fileHash, false, progressId);
      await loadFiles();
      emitStorageRefresh();

      setTimeout(() => removeUploadProgress(progressId), 2000);
    } catch (err) {
      console.error('File upload error:', err);
      updateUpload(progressId, { status: 'error' });
      setTimeout(() => removeUploadProgress(progressId), 2000);
    } finally {
      e.target.value = '';
    }
  };

  const handleDuplicateProceed = async () => {
    setShowDuplicateDialog(false);
    const items = [...pendingDuplicates];
    setPendingDuplicates([]);

    if (items.length === 0) return;

    const progressIds = items.map((item) => addUpload(item.file.name));

    const tasks = items.map((item, i) => ({
      ...item,
      progressId: progressIds[i],
    }));

    await uploadManager.processFilesParallel(
      tasks,
      async ({ file, hash, parentId, progressId }) => {
        registerRetry(progressId, () =>
          proceedWithUploadForId(file, hash, true, progressId, parentId),
        );
        try {
          await proceedWithUploadForId(file, hash, true, progressId, parentId);
        } catch {
          updateUpload(progressId, { status: 'error' });
        }
      },
      3,
    );

    await loadFiles();
    emitStorageRefresh();

    setTimeout(() => {
      progressIds.forEach((id) => removeUploadProgress(id));
    }, 2000);
  };

  const handleDuplicateCancel = () => {
    setShowDuplicateDialog(false);
    setPendingDuplicates([]);
    toast({
      title: 'Upload cancelled',
      description: 'Duplicate files were skipped.',
    });
  };

  const findExistingFolderId = async (
    name: string,
    parentId?: string,
  ): Promise<string | undefined> => {
    try {
      const res = await fileApi.list({
        page: 1,
        limit: 50,
        search: name,
        parentId,
      });
      const match = res.items.find((f) => f.is_folder && f.name === name);
      return match?.id;
    } catch {
      return undefined;
    }
  };

  const handleFolderUploadProceed = async () => {
    setShowFolderUploadDialog(false);
    if (!pendingFolderUpload) return;

    const allFiles = pendingFolderUpload.files;

    const folderPaths = new Set<string>();
    for (const file of allFiles) {
      const relPath = file.webkitRelativePath;
      if (!relPath) continue;
      const parts = relPath.split('/');
      for (let i = 1; i < parts.length; i++) {
        folderPaths.add(parts.slice(0, i).join('/'));
      }
    }

    const sortedFolders = Array.from(folderPaths).sort((a, b) => {
      const depthA = a.split('/').length;
      const depthB = b.split('/').length;
      return depthA - depthB;
    });

    const folderIdMap = new Map<string, string>();
    const baseParentId = currentFolderId || undefined;

    for (const folderPath of sortedFolders) {
      const parts = folderPath.split('/');
      const name = parts[parts.length - 1];
      const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
      const parentId = parentPath ? folderIdMap.get(parentPath) : baseParentId;

      const existingId = await findExistingFolderId(name, parentId);
      if (existingId) {
        folderIdMap.set(folderPath, existingId);
        continue;
      }

      try {
        const created = await fileApi.create({
          name,
          size: 0,
          mimeType: 'inode/directory',
          parentId,
          isFolder: true,
        });
        folderIdMap.set(folderPath, created.id);
      } catch (err) {
        console.error(`Failed to create folder ${folderPath}:`, err);
        toast({
          title: 'Folder creation failed',
          description: `Could not create folder "${name}".`,
          variant: 'destructive',
        });
      }
    }

    const fileEntries: { file: File; parentId?: string }[] = allFiles.map(
      (file) => {
        const relPath = file.webkitRelativePath;
        const parts = relPath.split('/');
        const parentPath =
          parts.length > 1 ? parts.slice(0, -1).join('/') : null;
        const parentId = parentPath
          ? folderIdMap.get(parentPath)
          : baseParentId;
        return { file, parentId };
      },
    );

    await uploadMultipleFiles(fileEntries);
    await loadFiles();
    emitStorageRefresh();
    setPendingFolderUpload(null);
  };

  const handleFolderUploadCancel = () => {
    setShowFolderUploadDialog(false);
    setPendingFolderUpload(null);
    toast({
      title: 'Folder upload cancelled',
      description: 'Folder upload was cancelled.',
    });
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;

    const existingId = await findExistingFolderId(
      folderName.trim(),
      currentFolderId || undefined,
    );
    if (existingId) {
      toast({
        title: 'Folder already exists',
        description: `A folder named "${folderName.trim()}" already exists here.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await fileApi.create({
        name: folderName.trim(),
        size: 0,
        mimeType: 'inode/directory',
        parentId: currentFolderId || undefined,
        isFolder: true,
      });
      setFolderName('');
      setShowNewFolderDialog(false);
      await loadFiles();
      emitStorageRefresh();
      toast({
        title: 'Folder created',
        description: 'New folder added successfully.',
      });
    } catch (err) {
      console.error('Failed to create folder:', err);
      toast({
        title: 'Error creating folder',
        description: 'Unable to create a new folder.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFolder = (folder: FileMetadata) => {
    setPathStack([...pathStack, { id: folder.id, name: folder.name }]);
  };

  const handleGoBack = () => {
    if (pathStack.length > 1) setPathStack(pathStack.slice(0, -1));
  };

  const handleBreadcrumbClick = (index: number) => {
    setPathStack(pathStack.slice(0, index + 1));
  };

  const handlePublicShare = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (file) {
      setPublicSharePassword('');
      setPublicShareExpiresAt('');
      setPublicSharePasswordError('');
      setPublicShareExpiresAtError('');
      setShareConfirm({ open: true, file });
    }
  };

  const handlePublicSharePasswordChange = (value: string) => {
    setPublicSharePassword(value);
    const { passwordError, expiresAtError } = validatePublicShareInputs(
      value,
      publicShareExpiresAt,
    );
    setPublicSharePasswordError(passwordError);
    setPublicShareExpiresAtError(expiresAtError);
  };

  const handlePublicShareExpiresAtChange = (value: string) => {
    setPublicShareExpiresAt(value);
    const { passwordError, expiresAtError } = validatePublicShareInputs(
      publicSharePassword,
      value,
    );
    setPublicSharePasswordError(passwordError);
    setPublicShareExpiresAtError(expiresAtError);
  };

  const handleRenameOpen = (id: string) => {
    const file = files.find((f) => f.id === id);
    if (!file) return;
    setRenameValue(file.name);
    setRenameDialog({ open: true, fileId: id, currentName: file.name });
  };

  const submitRename = async () => {
    if (!renameDialog.fileId || !renameValue.trim()) return;
    try {
      const updated = await fileApi.rename(
        renameDialog.fileId,
        { name: renameValue.trim() },
      );
      setFiles((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setRenameDialog({ open: false, fileId: null, currentName: '' });
    } catch {
      toast({ title: 'Rename failed', variant: 'destructive' });
    }
  };

  const handleMove = async (fileId: string, targetFolderId: string) => {
    try {
      await fileApi.rename(fileId, { parentId: targetFolderId });
      toast({ title: 'Moved successfully' });
      void loadFiles();
    } catch {
      toast({ title: 'Failed to move file', variant: 'destructive' });
    }
  };

  const handlePreview = (file: FileMetadata) => {
    setPreviewFile(file);
  };

  const handleShareWithUser = async (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    setShareUserDialog({ open: true, file });
    setSelectedShareUserId('');
    setSharePermission('read');
    try {
      setShareUsersLoading(true);
      const users = await userApi.listShareable();
      setShareUsers(users);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast({
        title: 'Unable to load users',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setShareUsersLoading(false);
    }
  };

  const confirmShare = async () => {
    const fileId = shareConfirm.file?.id ?? null;
    const fileName = shareConfirm.file?.name || null;
    const { passwordError, expiresAtError } = validatePublicShareInputs(
      publicSharePassword,
      publicShareExpiresAt,
    );
    setPublicSharePasswordError(passwordError);
    setPublicShareExpiresAtError(expiresAtError);
    if (passwordError || expiresAtError) return;

    setShareConfirm({ open: false, file: null });
    if (!fileId) return;

    const expiresAtIso = publicShareExpiresAt
      ? new Date(publicShareExpiresAt).toISOString()
      : undefined;
    const password = publicSharePassword.trim() || undefined;

    try {
      const res = await fileApi.share(fileId, {
        permission: 'read',
        isPublic: true,
        expiresAt: expiresAtIso,
        password,
      });
      if (res.publicLink) {
        setPublicLink(res.publicLink);
        setPublicLinkFileName(fileName);
        loadFiles();
      } else {
        toast({
          title: 'Share failed',
          description: 'Public link could not be generated.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Share failed:', err);
      toast({
        title: 'Error creating link',
        description: 'Share link could not be created.',
        variant: 'destructive',
      });
    }
  };

  const confirmShareWithUser = async () => {
    const fileId = shareUserDialog.file?.id ?? null;
    if (!fileId) return;
    if (!selectedShareUserId) {
      toast({
        title: 'Select a user',
        description: 'Please choose a user to share with.',
        variant: 'warning',
      });
      return;
    }
    try {
      await fileApi.share(fileId, {
        toUserId: selectedShareUserId,
        permission: sharePermission,
      });
      setShareUserDialog({ open: false, file: null });
      toast({
        title: 'Shared',
        description: 'File shared with selected user.',
        variant: 'success',
      });
      loadFiles();
    } catch (error) {
      console.error('Failed to share with user:', error);
      toast({
        title: 'Share failed',
        description: 'Could not share with the selected user.',
        variant: 'destructive',
      });
    }
  };

  // Drag & drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Helper to read all entries from a directory
  const readDirectoryEntries = (
    dirReader: FileSystemDirectoryReader,
  ): Promise<FileSystemEntry[]> => {
    return new Promise((resolve, reject) => {
      const entries: FileSystemEntry[] = [];
      const readBatch = () => {
        dirReader.readEntries(
          (batch) => {
            if (batch.length === 0) {
              resolve(entries);
            } else {
              entries.push(...batch);
              readBatch();
            }
          },
          (err) => reject(err),
        );
      };
      readBatch();
    });
  };

  // Recursively traverse a FileSystemEntry and collect files with paths
  const traverseEntry = async (
    entry: FileSystemEntry,
    path: string = '',
  ): Promise<{ file: File; relativePath: string }[]> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      return new Promise((resolve, reject) => {
        fileEntry.file(
          (file) => resolve([{ file, relativePath: path + file.name }]),
          (err) => reject(err),
        );
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const dirReader = dirEntry.createReader();
      const entries = await readDirectoryEntries(dirReader);
      const results: { file: File; relativePath: string }[] = [];
      for (const childEntry of entries) {
        const childResults = await traverseEntry(
          childEntry,
          path + entry.name + '/',
        );
        results.push(...childResults);
      }
      return results;
    }
    return [];
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragActive(false);
    // Ignore internal card-to-folder drags (those are handled by FileCard's onDrop)
    if (!e.dataTransfer.types.includes('Files')) return;

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) {
      // Fallback to files if items not supported
      const droppedFiles = e.dataTransfer.files;
      if (!droppedFiles || droppedFiles.length === 0) return;

      const fileEntries = Array.from(droppedFiles).map((file) => ({
        file,
        parentId: currentFolderId || undefined,
      }));
      await uploadMultipleFiles(fileEntries);
      return;
    }

    // Check if any item is a directory using webkitGetAsEntry
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          entries.push(entry);
        }
      }
    }

    if (entries.length === 0) {
      // No entries, fallback to regular file handling
      const droppedFiles = e.dataTransfer.files;
      if (!droppedFiles || droppedFiles.length === 0) return;

      const fileEntries = Array.from(droppedFiles).map((file) => ({
        file,
        parentId: currentFolderId || undefined,
      }));
      await uploadMultipleFiles(fileEntries);
      return;
    }

    // Check if we have directories
    const hasDirectories = entries.some((entry) => entry.isDirectory);

    if (!hasDirectories) {
      // All files, no directories - simple upload
      const fileEntries: { file: File; parentId?: string }[] = [];
      for (const entry of entries) {
        if (entry.isFile) {
          const fileEntry = entry as FileSystemFileEntry;
          const file = await new Promise<File>((resolve, reject) => {
            fileEntry.file(resolve, reject);
          });
          fileEntries.push({ file, parentId: currentFolderId || undefined });
        }
      }
      await uploadMultipleFiles(fileEntries);
      return;
    }

    // We have directories - collect all files with their relative paths
    const allFilesWithPaths: { file: File; relativePath: string }[] = [];
    for (const entry of entries) {
      const filesFromEntry = await traverseEntry(entry);
      allFilesWithPaths.push(...filesFromEntry);
    }

    if (allFilesWithPaths.length === 0) {
      toast({
        title: 'Empty folder',
        description: 'The dropped folder contains no files.',
        variant: 'destructive',
      });
      return;
    }

    // Get root folder name from first entry
    const rootFolderName =
      entries.find((entry) => entry.isDirectory)?.name || 'Dropped Folder';
    const totalSize = allFilesWithPaths.reduce(
      (sum, f) => sum + f.file.size,
      0,
    );

    // Show folder upload confirmation dialog
    setPendingFolderUpload({
      files: allFilesWithPaths.map((f) => {
        // Create a new File with webkitRelativePath-like path
        const newFile = new File([f.file], f.file.name, { type: f.file.type });
        Object.defineProperty(newFile, 'webkitRelativePath', {
          value: f.relativePath,
          writable: false,
        });
        return newFile;
      }),
      folderName: rootFolderName,
      totalSize,
      fileCount: allFilesWithPaths.length,
    });
    setShowFolderUploadDialog(true);
  };

  const allSelected =
    files.length > 0 && files.every((f) => selectedIds.has(f.id));
  const someSelected = selectedIds.size > 0;

  const currentLocalDateTime = getCurrentLocalDateTime();
  const isPublicShareValid =
    !publicSharePasswordError && !publicShareExpiresAtError;

  return (
    <>
      <div
        className="p-4 sm:p-6 space-y-6 relative min-h-[calc(100vh-4rem)]"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <DropZoneOverlay isActive={isDragActive} />

        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                My Files
              </h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4" />
                  {total} {total === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setShowNewFolderDialog(true)}
                className="flex-1 sm:flex-none h-10"
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">New Folder</span>
                <span className="sm:hidden">Folder</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="flex-1 sm:flex-none h-10">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={handleUploadFileClick}
                    className="gap-2"
                  >
                    <FileIcon className="h-4 w-4" />
                    Upload Files
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleUploadFolderClick}
                    className="gap-2"
                  >
                    <Folder className="h-4 w-4" />
                    Upload Folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                multiple
              />
              <input
                id="folder-upload-input"
                type="file"
                ref={setFolderInputRef}
                onChange={handleFolderInputChange}
                className="hidden"
                multiple
                // @ts-expect-error — webkitdirectory is non-standard but widely supported
                webkitdirectory=""
              />
            </div>
          </div>

          {/* Breadcrumb */}
          <FileBreadcrumb
            pathStack={pathStack}
            onBreadcrumbClick={handleBreadcrumbClick}
            onGoBack={handleGoBack}
          />
        </div>

        {/* Search */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files and folders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-muted/30 border-muted-foreground/20 focus:bg-background transition-colors"
          />
        </div>

        {/* Selection Toolbar */}
        <AnimatePresence>
          {someSelected && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex items-center h-11 sm:h-10 px-3 rounded-lg bg-primary/5 border border-primary/20">
                <Checkbox
                  checked={allSelected}
                  className="h-4 w-4 border-muted-foreground/50 data-[state=checked]:border-primary"
                  onCheckedChange={(checked) => {
                    if (checked) selectAll();
                    else clearSelection();
                  }}
                />
                <span className="text-sm font-medium ml-3 whitespace-nowrap">
                  {selectedIds.size} selected
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearSelection}
                  className="h-9 w-9 sm:h-8 sm:w-8 ml-1"
                  title="Clear selection"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="ml-auto">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    className="h-9 sm:h-8 gap-1.5 px-3 sm:px-2.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="text-xs">Delete</span>
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Files Grid */}
        <motion.div
          animate={{ scale: isDragActive ? 0.97 : 1, opacity: isDragActive ? 0.4 : 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <FileGrid
            files={files}
            loading={loading}
            onOpenFolder={handleOpenFolder}
            onDelete={handleDelete}
            onShareUser={handleShareWithUser}
            onSharePublic={handlePublicShare}
            onRename={handleRenameOpen}
            onPreview={handlePreview}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onCardClick={handleCardClick}
            onMove={handleMove}
          />
        </motion.div>

        {/* Status Bar */}
        {!loading && files.length > 0 && (
          <div className="flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              {files.filter((f) => f.is_folder).length > 0 && (
                <span className="flex items-center gap-1">
                  <Folder className="h-3 w-3" />
                  {files.filter((f) => f.is_folder).length} folder
                  {files.filter((f) => f.is_folder).length !== 1 ? 's' : ''}
                </span>
              )}
              {files.filter((f) => !f.is_folder).length > 0 && (
                <span className="flex items-center gap-1">
                  <FileIcon className="h-3 w-3" />
                  {files.filter((f) => !f.is_folder).length} file
                  {files.filter((f) => !f.is_folder).length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <span>
              {formatBytes(
                files.reduce(
                  (sum, f) =>
                    sum +
                    (f.is_folder
                      ? Number(f.folder_size || 0)
                      : Number(f.size || 0)),
                  0,
                ),
              )}
            </span>
          </div>
        )}

        {/* Dialogs */}
        <CreateFolderDialog
          open={showNewFolderDialog}
          onOpenChange={setShowNewFolderDialog}
          folderName={folderName}
          onFolderNameChange={setFolderName}
          onCreateFolder={handleCreateFolder}
        />

        <PublicLinkDialog
          publicLink={publicLink}
          fileName={publicLinkFileName ?? undefined}
          onClose={() => {
            setPublicLink(null);
            setPublicLinkFileName(null);
          }}
        />

        <DuplicateWarningDialog
          open={showDuplicateDialog}
          onOpenChange={setShowDuplicateDialog}
          duplicates={pendingDuplicates}
          onUploadAnyway={handleDuplicateProceed}
          onCancel={handleDuplicateCancel}
        />

        {/* Large-file warning — fires when a file is at the 5 GB limit */}
        <AlertDialog
          open={showLargeFileWarning}
          onOpenChange={setShowLargeFileWarning}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Large File Warning</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingLargeFileUpload.length === 1
                  ? `"${pendingLargeFileUpload[0]?.file.name}" is exactly at the 5 GB upload limit.`
                  : `${pendingLargeFileUpload.length} files are exactly at the 5 GB upload limit.`}{' '}
                The upload may fail if your storage is low. Do you want to
                continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleLargeFileWarningCancel}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleLargeFileWarningProceed}>
                Upload Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <FolderUploadDialog
          open={showFolderUploadDialog}
          onOpenChange={setShowFolderUploadDialog}
          folderName={pendingFolderUpload?.folderName || ''}
          fileCount={pendingFolderUpload?.fileCount || 0}
          totalSize={formatBytes(pendingFolderUpload?.totalSize || 0)}
          destination={pathStack[pathStack.length - 1]?.name || 'Home'}
          onUpload={handleFolderUploadProceed}
          onCancel={handleFolderUploadCancel}
        />

        {/* Folder Drop Modal — in-app drag zone, no browser security popup */}
        <Dialog
          open={showFolderDropModal}
          onOpenChange={setShowFolderDropModal}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Folder</DialogTitle>
              <DialogDescription>
                Drag and drop your folder into the zone below.
              </DialogDescription>
            </DialogHeader>
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors duration-150 h-48 cursor-default',
                folderModalDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50',
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setFolderModalDragActive(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setFolderModalDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setFolderModalDragActive(false);
              }}
              onDrop={handleFolderModalDrop}
            >
              <Folder
                className={cn(
                  'h-10 w-10 transition-colors',
                  folderModalDragActive
                    ? 'text-primary'
                    : 'text-muted-foreground/50',
                )}
              />
              <p className="text-sm font-medium text-muted-foreground">
                {folderModalDragActive
                  ? 'Release to upload'
                  : 'Drop your folder here'}
              </p>
              <p className="text-xs text-muted-foreground/60">
                Folders and all subfolders are supported
              </p>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={deleteConfirm.open}
          onOpenChange={(open) =>
            setDeleteConfirm((prev) => ({ ...prev, open }))
          }
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteConfirm.type === 'bulk'
                  ? `${selectedIds.size} ${selectedIds.size === 1 ? 'item' : 'items'} will be moved to Trash. You can restore them later.`
                  : 'This item will be moved to Trash. You can restore it later.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={
                  deleteConfirm.type === 'bulk'
                    ? confirmBulkDelete
                    : confirmSingleDelete
                }
              >
                Move to Trash
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Share Confirmation Dialog */}
        <AlertDialog
          open={shareConfirm.open}
          onOpenChange={(open) =>
            setShareConfirm((prev) => ({ ...prev, open }))
          }
        >
          <AlertDialogContent className="w-[95vw] max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Create Public Link?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Anyone with the link will be able to view this{' '}
                    {shareConfirm.file?.is_folder ? 'folder' : 'file'}:
                  </p>
                  {shareConfirm.file && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border overflow-hidden">
                      <div className="shrink-0">
                        {shareConfirm.file.is_folder ? (
                          <Folder className="h-8 w-8 text-amber-500" />
                        ) : (
                          <FileIcon className="h-8 w-8 text-blue-500" />
                        )}
                      </div>
                      <div className="min-w-0 overflow-hidden">
                        <p
                          className="font-medium text-sm text-foreground break-all"
                          title={shareConfirm.file.name}
                        >
                          {shareConfirm.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground break-all">
                          {shareConfirm.file.is_folder
                            ? 'Folder'
                            : formatBytes(Number(shareConfirm.file.size || 0))}
                          {shareConfirm.file.mime_type &&
                            !shareConfirm.file.is_folder &&
                            ` · ${shareConfirm.file.mime_type}`}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-1">
                    <Label htmlFor="public-share-password">
                      Password (optional)
                    </Label>
                    <Input
                      id="public-share-password"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={publicSharePassword}
                      onChange={(e) =>
                        handlePublicSharePasswordChange(e.target.value)
                      }
                    />
                    {publicSharePasswordError ? (
                      <p className="text-xs text-destructive">
                        {publicSharePasswordError}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="public-share-expires-at">
                      Expiry (optional)
                    </Label>
                    <Input
                      id="public-share-expires-at"
                      type="datetime-local"
                      value={publicShareExpiresAt}
                      min={currentLocalDateTime}
                      onChange={(e) =>
                        handlePublicShareExpiresAtChange(e.target.value)
                      }
                    />
                    {publicShareExpiresAtError ? (
                      <p className="text-xs text-destructive">
                        {publicShareExpiresAtError}
                      </p>
                    ) : null}
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmShare}
                disabled={!isPublicShareValid}
              >
                Generate Link
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog
          open={shareUserDialog.open}
          onOpenChange={(open) =>
            setShareUserDialog((prev) => ({ ...prev, open }))
          }
        >
          <DialogContent className="w-[95vw] max-w-lg">
            <DialogHeader>
              <DialogTitle>Share with user</DialogTitle>
              <DialogDescription>
                Share this {shareUserDialog.file?.is_folder ? 'folder' : 'file'}{' '}
                with a team member.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {shareUserDialog.file && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border overflow-hidden">
                  <div className="shrink-0">
                    {shareUserDialog.file.is_folder ? (
                      <Folder className="h-8 w-8 text-amber-500" />
                    ) : (
                      <FileIcon className="h-8 w-8 text-blue-500" />
                    )}
                  </div>
                  <div className="min-w-0 overflow-hidden">
                    <p
                      className="font-medium text-sm text-foreground break-all"
                      title={shareUserDialog.file.name}
                    >
                      {shareUserDialog.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground break-all">
                      {shareUserDialog.file.is_folder
                        ? 'Folder'
                        : formatBytes(Number(shareUserDialog.file.size || 0))}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="share_user">User</Label>
                <Select
                  value={selectedShareUserId}
                  onValueChange={setSelectedShareUserId}
                >
                  <SelectTrigger id="share_user">
                    <SelectValue
                      placeholder={
                        shareUsersLoading ? 'Loading...' : 'Select user'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-w-[90vw]">
                    {shareUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        <span className="block max-w-[70vw] sm:max-w-[320px] truncate">
                          {u.name} ({u.email})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="share_permission">Permission</Label>
                <Select
                  value={sharePermission}
                  onValueChange={(v) =>
                    setSharePermission(v as 'read' | 'write')
                  }
                >
                  <SelectTrigger id="share_permission">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="write">Write</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShareUserDialog({ open: false, file: null })}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmShareWithUser}
                disabled={shareUsersLoading}
              >
                Share
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rename Dialog */}
      <Dialog
        open={renameDialog.open}
        onOpenChange={(open) => setRenameDialog((d) => ({ ...d, open }))}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
            <DialogDescription>
              Enter a new name for this item.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                renameValue.trim() &&
                renameDialog.fileId &&
                renameValue.trim() !== renameDialog.currentName
              )
                void submitRename();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setRenameDialog({ open: false, fileId: null, currentName: '' })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={() => void submitRename()}
              disabled={
                !renameValue.trim() || renameValue === renameDialog.currentName
              }
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Preview */}
      {previewFile && (
        <FilePreviewDialog
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}

      <ToastContainer />
    </>
  );
}
