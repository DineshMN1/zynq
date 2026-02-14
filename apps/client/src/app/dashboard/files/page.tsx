'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
  type FileMetadata,
  type ShareableUser,
  ApiError,
} from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/toast-container';
import { FileGrid } from '@/features/file/components/file-grid';
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
import { motion, AnimatePresence } from 'framer-motion';

interface UploadProgress {
  id: string;
  fileName: string;
  progress: number;
  status:
    | 'queued'
    | 'uploading'
    | 'completed'
    | 'error'
    | 'checking'
    | 'duplicate';
}

let uploadIdCounter = 0;

const KNOWN_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'text/',
  'application/',
  'font/',
  'model/',
  'chemical/',
  'x-conference/',
  'message/',
  'multipart/',
  'inode/',
];

function getSafeMimeType(file: File): string {
  const type = file.type;
  if (!type) return 'application/octet-stream';
  if (KNOWN_MIME_PREFIXES.some((prefix) => type.startsWith(prefix)))
    return type;
  return 'application/octet-stream';
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
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingDuplicates, setPendingDuplicates] = useState<DuplicateItem[]>(
    [],
  );

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
  const [shareTypeDialog, setShareTypeDialog] = useState<{
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

  // Drag & drop state
  const [isDragActive, setIsDragActive] = useState(false);
  const dragCounter = useRef(0);

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

  // Upload queue helpers
  const addUploadProgress = (fileName: string): string => {
    const id = `upload-${++uploadIdCounter}`;
    setUploadQueue((prev) => [
      ...prev,
      { id, fileName, progress: 0, status: 'queued' },
    ]);
    return id;
  };

  const updateUploadProgress = (
    progressId: string,
    updates: Partial<Omit<UploadProgress, 'id'>>,
  ) => {
    setUploadQueue((prev) =>
      prev.map((p) => (p.id === progressId ? { ...p, ...updates } : p)),
    );
  };

  const removeUploadProgress = (progressId: string) => {
    setUploadQueue((prev) => prev.filter((p) => p.id !== progressId));
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
    } else {
      toggleSelect(id);
    }
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
  const handleUploadFolderClick = () => folderInputRef.current?.click();

  const uploadFileWithProgress = (
    url: string,
    file: File,
    _contentType: string,
    progressId: string,
  ): Promise<void> => {
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    const fullUrl = url.startsWith('http')
      ? url
      : `${apiBase}${url.replace(/^\/api\/v1/, '')}`;
    const token = localStorage.getItem('token');

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          updateUploadProgress(progressId, { progress: percent });
        }
      });

      xhr.addEventListener('readystatechange', () => {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            updateUploadProgress(progressId, {
              progress: 100,
              status: 'completed',
            });
            resolve();
          } else {
            updateUploadProgress(progressId, { status: 'error' });
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      const formData = new FormData();
      formData.append('file', file);

      xhr.open('PUT', fullUrl);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  };

  const proceedWithUploadForId = async (
    file: File,
    fileHash: string,
    skipDuplicateCheck: boolean,
    progressId: string,
    targetParentId?: string,
  ) => {
    updateUploadProgress(progressId, { status: 'uploading', progress: 0 });

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

    if (created.uploadUrl) {
      await uploadFileWithProgress(
        created.uploadUrl,
        file,
        safeMime,
        progressId,
      );
    } else {
      updateUploadProgress(progressId, { progress: 100, status: 'completed' });
    }
  };

  const uploadMultipleFiles = async (
    fileEntries: { file: File; parentId?: string }[],
  ) => {
    if (fileEntries.length === 0) return;

    // Phase 1: Hash all files and check for duplicates
    const duplicates: DuplicateItem[] = [];
    const readyToUpload: { file: File; hash: string; parentId?: string }[] = [];

    await uploadManager.processFilesParallel(
      fileEntries,
      async (entry) => {
        const fileHash = await uploadManager.calculateHash(entry.file);
        try {
          const { isDuplicate, existingFile } = await fileApi.checkDuplicate(
            fileHash,
            entry.file.name,
          );
          if (isDuplicate && existingFile) {
            duplicates.push({
              file: entry.file,
              hash: fileHash,
              existingFile,
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
        addUploadProgress(entry.file.name),
      );
      let uploaded = 0;
      let errors = 0;

      const uploadTasks = readyToUpload.map((entry, i) => ({
        ...entry,
        progressId: progressIds[i],
      }));

      await uploadManager.processFilesParallel(
        uploadTasks,
        async ({ file, hash, parentId, progressId }) => {
          try {
            await proceedWithUploadForId(
              file,
              hash,
              true,
              progressId,
              parentId,
            );
            uploaded++;
          } catch {
            errors++;
            updateUploadProgress(progressId, { status: 'error' });
          }
        },
        3,
      );

      await loadFiles();
      emitStorageRefresh();

      if (uploaded > 0 || errors > 0) {
        const parts: string[] = [];
        if (uploaded > 0) parts.push(`${uploaded} uploaded`);
        if (errors > 0) parts.push(`${errors} failed`);
        toast({
          title: 'Upload complete',
          description: parts.join(', ') + '.',
          variant: errors > 0 && uploaded === 0 ? 'destructive' : undefined,
        });
      }

      setTimeout(() => {
        setUploadQueue((prev) =>
          prev.filter(
            (p) =>
              !progressIds.includes(p.id) ||
              (p.status !== 'completed' && p.status !== 'error'),
          ),
        );
      }, 3000);
    }

    // Phase 3: Show dialog for duplicates
    if (duplicates.length > 0) {
      setPendingDuplicates(duplicates);
      setShowDuplicateDialog(true);
    }
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
    const progressId = addUploadProgress(file.name);

    try {
      updateUploadProgress(progressId, { status: 'checking' });
      // Use web worker for hash calculation (non-blocking)
      const fileHash = await uploadManager.calculateHash(file);

      // Check for duplicates before uploading (only for documents and images)
      const { isDuplicate, existingFile } = await fileApi.checkDuplicate(
        fileHash,
        file.name,
      );

      if (isDuplicate && existingFile) {
        setPendingDuplicates([{ file, hash: fileHash, existingFile }]);
        setShowDuplicateDialog(true);
        removeUploadProgress(progressId);
        e.target.value = '';
        return;
      }

      // No duplicate, proceed with upload
      await proceedWithUploadForId(file, fileHash, false, progressId);
      await loadFiles();
      emitStorageRefresh();
      toast({
        title: 'Upload successful',
        description: `${file.name} uploaded.`,
      });

      setTimeout(() => removeUploadProgress(progressId), 2000);
    } catch (err) {
      console.error('File upload error:', err);
      const errorMessage =
        err instanceof ApiError ? err.message : 'Unable to upload this file.';
      toast({
        title: 'Upload failed',
        description: errorMessage,
        variant: 'destructive',
      });
      updateUploadProgress(progressId, { status: 'error' });
      setTimeout(() => removeUploadProgress(progressId), 3000);
    } finally {
      e.target.value = '';
    }
  };

  const handleDuplicateProceed = async () => {
    setShowDuplicateDialog(false);
    const items = [...pendingDuplicates];
    setPendingDuplicates([]);

    if (items.length === 0) return;

    const progressIds = items.map((item) => addUploadProgress(item.file.name));
    let uploaded = 0;
    let errors = 0;

    const tasks = items.map((item, i) => ({
      ...item,
      progressId: progressIds[i],
    }));

    await uploadManager.processFilesParallel(
      tasks,
      async ({ file, hash, parentId, progressId }) => {
        try {
          await proceedWithUploadForId(file, hash, true, progressId, parentId);
          uploaded++;
        } catch (err) {
          errors++;
          const errorMessage =
            err instanceof ApiError
              ? err.message
              : 'Unable to upload this file.';
          console.error(`Failed to upload ${file.name}:`, errorMessage);
          updateUploadProgress(progressId, { status: 'error' });
        }
      },
      3,
    );

    await loadFiles();
    emitStorageRefresh();

    const count = items.length;
    toast({
      title: uploaded === count ? 'Upload successful' : 'Upload complete',
      description:
        uploaded === count
          ? `${uploaded} file${uploaded > 1 ? 's' : ''} uploaded.`
          : `${uploaded} uploaded, ${errors} failed.`,
      variant: errors > 0 && uploaded === 0 ? 'destructive' : undefined,
    });

    setTimeout(() => {
      setUploadQueue((prev) =>
        prev.filter(
          (p) =>
            !progressIds.includes(p.id) ||
            (p.status !== 'completed' && p.status !== 'error'),
        ),
      );
    }, 3000);
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

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const allFiles = Array.from(fileList);

    // Extract folder name from the first file's relative path
    const firstPath = allFiles[0]?.webkitRelativePath || '';
    const rootFolderName = firstPath.split('/')[0] || 'Unknown Folder';

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
    if (file) setShareConfirm({ open: true, file });
  };

  const handleShareType = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    setShareTypeDialog({ open: true, file });
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
    setShareConfirm({ open: false, file: null });
    if (!fileId) return;

    try {
      const res = await fileApi.share(fileId, {
        permission: 'read',
        isPublic: true,
      });
      if (res.publicLink) {
        setPublicLink(res.publicLink);
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
      entries.find((e) => e.isDirectory)?.name || 'Dropped Folder';
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

  // Aggregate upload progress for the inline indicator
  const activeUploads = uploadQueue.filter(
    (u) =>
      u.status === 'uploading' ||
      u.status === 'checking' ||
      u.status === 'queued',
  );
  const isUploading = activeUploads.length > 0;
  const aggregateProgress =
    activeUploads.length > 0
      ? Math.round(
          activeUploads.reduce((sum, u) => sum + u.progress, 0) /
            activeUploads.length,
        )
      : 100;

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
                type="file"
                ref={folderInputRef}
                onChange={handleFolderChange}
                className="hidden"
                {...({
                  webkitdirectory: '',
                  directory: '',
                } as React.InputHTMLAttributes<HTMLInputElement>)}
              />
            </div>
          </div>

          {/* Breadcrumb */}
          <FileBreadcrumb
            pathStack={pathStack}
            onBreadcrumbClick={handleBreadcrumbClick}
            onGoBack={handleGoBack}
          />

          {/* Inline upload indicator — thin progress line */}
          <AnimatePresence>
            {isUploading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <Upload className="h-3 w-3 text-muted-foreground animate-pulse" />
                <span className="text-xs text-muted-foreground">
                  Uploading
                  {activeUploads.length > 1
                    ? ` ${activeUploads.length} files`
                    : ''}
                  …
                </span>
                <Progress
                  value={aggregateProgress}
                  className="h-[2px] flex-1 max-w-[160px]"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
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
              <div className="flex items-center h-10 px-3 rounded-lg bg-primary/5 border border-primary/20">
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
                  className="h-8 w-8 ml-1"
                  title="Clear selection"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="ml-auto">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    className="h-8 gap-1.5 px-2.5"
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
        <FileGrid
          files={files}
          loading={loading}
          onOpenFolder={handleOpenFolder}
          onDelete={handleDelete}
          onShareUser={handleShareType}
          onSharePublic={handlePublicShare}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onCardClick={handleCardClick}
        />

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
                files
                  .filter((f) => !f.is_folder)
                  .reduce((sum, f) => sum + Number(f.size || 0), 0),
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
          onClose={() => setPublicLink(null)}
        />

        <DuplicateWarningDialog
          open={showDuplicateDialog}
          onOpenChange={setShowDuplicateDialog}
          duplicates={pendingDuplicates}
          onUploadAnyway={handleDuplicateProceed}
          onCancel={handleDuplicateCancel}
        />

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
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create Public Link?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Anyone with the link will be able to view this{' '}
                    {shareConfirm.file?.is_folder ? 'folder' : 'file'}:
                  </p>
                  {shareConfirm.file && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border overflow-hidden">
                      <div className="shrink-0">
                        {shareConfirm.file.is_folder ? (
                          <Folder className="h-8 w-8 text-amber-500" />
                        ) : (
                          <FileIcon className="h-8 w-8 text-blue-500" />
                        )}
                      </div>
                      <div className="min-w-0 overflow-hidden">
                        <p
                          className="font-medium text-sm text-foreground truncate"
                          title={shareConfirm.file.name}
                        >
                          {shareConfirm.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
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
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmShare}>
                Generate Link
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Share Type Dialog */}
        <Dialog
          open={shareTypeDialog.open}
          onOpenChange={(open) =>
            setShareTypeDialog((prev) => ({ ...prev, open }))
          }
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share</DialogTitle>
              <DialogDescription>
                Choose how you want to share this{' '}
                {shareTypeDialog.file?.is_folder ? 'folder' : 'file'}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <Button
                onClick={() => {
                  const fileId = shareTypeDialog.file?.id;
                  setShareTypeDialog({ open: false, file: null });
                  if (fileId) handleShareWithUser(fileId);
                }}
              >
                Share with user
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const fileId = shareTypeDialog.file?.id;
                  setShareTypeDialog({ open: false, file: null });
                  if (fileId) handlePublicShare(fileId);
                }}
              >
                Create public link
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={shareUserDialog.open}
          onOpenChange={(open) =>
            setShareUserDialog((prev) => ({ ...prev, open }))
          }
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share with user</DialogTitle>
              <DialogDescription>
                Share this {shareUserDialog.file?.is_folder ? 'folder' : 'file'}{' '}
                with a team member.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {shareUserDialog.file && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border overflow-hidden">
                  <div className="shrink-0">
                    {shareUserDialog.file.is_folder ? (
                      <Folder className="h-8 w-8 text-amber-500" />
                    ) : (
                      <FileIcon className="h-8 w-8 text-blue-500" />
                    )}
                  </div>
                  <div className="min-w-0 overflow-hidden">
                    <p
                      className="font-medium text-sm text-foreground truncate"
                      title={shareUserDialog.file.name}
                    >
                      {shareUserDialog.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
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
                  <SelectContent>
                    {shareUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.email})
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

      <ToastContainer />
    </>
  );
}
