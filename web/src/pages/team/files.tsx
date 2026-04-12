import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Upload,
  Search,
  FolderPlus,
  ChevronDown,
  MoreHorizontal,
  Download,
  Pencil,
  Trash2,
  File as FileIcon,
  Folder,
  Image,
  FileText,
  Video,
  Music,
  Code2,
  Loader2,
} from 'lucide-react';
import { spaceApi, type FileMetadata, type Space, getApiBaseUrl, ApiError } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/toast-container';
import { FilePreviewDialog } from '@/features/file/components/file-preview-dialog';
import { FileTypeIcon } from '@/features/file/components/file-type-icon';
import { DropZoneOverlay } from '@/features/file/components/drop-zone-overlay';
import { FileBreadcrumb } from '@/features/file/components/file-breadcrumb';
import { formatBytes } from '@/lib/auth';
import { getInitials } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { useUploadContext } from '@/context/UploadContext';

const CATEGORY_MAP: Record<string, string> = {
  photos: 'photos',
  docs: 'docs',
  videos: 'videos',
  audio: 'audio',
  code: 'code',
  others: 'others',
};

const CATEGORY_LABELS: Record<string, string> = {
  files: 'All Files',
  photos: 'Photos',
  docs: 'Documents',
  videos: 'Videos',
  audio: 'Audio',
  code: 'Code',
  others: 'Others',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  files: FileIcon,
  photos: Image,
  docs: FileText,
  videos: Video,
  audio: Music,
  code: Code2,
  others: FileIcon,
};

const MAX_FILE_BYTES = 15 * 1024 * 1024 * 1024;

function getSafeMimeType(file: File): string {
  const type = file.type;
  if (!type) return 'application/octet-stream';
  const known = ['image/', 'video/', 'audio/', 'text/', 'application/', 'font/'];
  if (known.some((p) => type.startsWith(p))) return type;
  return 'application/octet-stream';
}

export default function TeamFilesPage() {
  const { pathname } = useLocation();

  const segment = pathname.split('/').filter(Boolean).pop() ?? 'files';
  const category = CATEGORY_MAP[segment] ?? undefined;
  const pageTitle = CATEGORY_LABELS[segment] ?? 'All Files';
  const PageIcon = CATEGORY_ICONS[segment] ?? FileIcon;
  const isAllFiles = !category;

  const [space, setSpace] = useState<Space | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragCounter = useRef(0);

  // Folder navigation (All Files view only)
  const [pathStack, setPathStack] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'Team' },
  ]);

  // Dialogs
  const [renameFile, setRenameFile] = useState<FileMetadata | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteFile, setDeleteFile] = useState<FileMetadata | null>(null);
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const { addUpload, updateUpload } = useUploadContext();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const limit = 48;

  const canWrite = space?.my_role === 'contributor' || space?.my_role === 'admin';
  const currentFolderId = isAllFiles ? pathStack[pathStack.length - 1]?.id : null;

  // Load space
  useEffect(() => {
    spaceApi.list()
      .then((spaces) => {
        if (spaces.length > 0) {
          setSpace(spaces[0]);
          setSpaceId(spaces[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const loadFiles = useCallback(async () => {
    if (!spaceId) return;
    setLoading(true);
    try {
      const res = await spaceApi.getFiles(spaceId, {
        page,
        limit,
        search,
        category,
        parentId: isAllFiles ? (currentFolderId ?? undefined) : undefined,
      });
      setFiles(res.items ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch {
      toast({ title: 'Failed to load files', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [spaceId, page, search, category, currentFolderId, isAllFiles]);

  useEffect(() => { void loadFiles(); }, [loadFiles]);
  useEffect(() => { setPage(1); }, [category, currentFolderId]);
  useEffect(() => { setPathStack([{ id: null, name: 'Team' }]); }, [category]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  // ── Drag & drop ──────────────────────────────────────────────────────────
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragActive(false);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragActive(false);
    // Ignore internal card-to-folder drags (those are handled by FileCard's onDrop)
    if (!e.dataTransfer.types.includes('Files')) return;
    if (!canWrite) return;

    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => f.size > 0);
    if (droppedFiles.length > 0) void uploadFiles(droppedFiles);
  };

  // ── Upload ───────────────────────────────────────────────────────────────
  const uploadFiles = async (picked: File[]) => {
    if (!spaceId) return;

    const oversized = picked.filter((f) => f.size > MAX_FILE_BYTES);
    if (oversized.length > 0) {
      toast({
        title: 'File too large',
        description: `${oversized[0].name} exceeds the 15 GB limit`,
        variant: 'destructive',
      });
      return;
    }

    for (const file of picked) {
      const progressId = addUpload(file.name);
      try {
        updateUpload(progressId, { status: 'uploading', progress: 0 });

        const created = await spaceApi.createFile(spaceId, {
          name: file.name,
          mimeType: getSafeMimeType(file),
          size: file.size,
          parentId: currentFolderId ?? undefined,
        });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', `${getApiBaseUrl()}/spaces/${spaceId}/files/${created.id}/upload`);
          xhr.withCredentials = true;
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const pct = Math.round((ev.loaded / ev.total) * 100);
              updateUpload(progressId, { progress: pct });
            }
          };
          xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.statusText));
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.send(file);
        });

        updateUpload(progressId, { progress: 100, status: 'completed' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        updateUpload(progressId, { status: 'error' });
        toast({ title: `Failed to upload ${file.name}`, description: msg, variant: 'destructive' });
      }
    }

    await loadFiles();
  };

  // ── Folder upload (flatten) ──────────────────────────────────────────────
  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    e.target.value = '';
    if (!fileList || fileList.length === 0) return;
    // For team space: flatten folder upload — just upload all files
    void uploadFiles(Array.from(fileList));
  };

  // ── Create folder ────────────────────────────────────────────────────────
  const handleCreateFolder = async () => {
    if (!spaceId || !folderName.trim()) return;
    setCreatingFolder(true);
    try {
      await spaceApi.createFile(spaceId, {
        name: folderName.trim(),
        isFolder: true,
        parentId: currentFolderId ?? undefined,
      });
      setFolderName('');
      setShowNewFolder(false);
      toast({ title: 'Folder created' });
      void loadFiles();
    } catch (err) {
      toast({
        title: 'Failed to create folder',
        description: err instanceof ApiError ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setCreatingFolder(false);
    }
  };

  // ── Drag-and-drop state ──────────────────────────────────────────────────
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  // ── Move (drag-and-drop) ─────────────────────────────────────────────────
  const handleMove = async (fileId: string, targetFolderId: string) => {
    if (!spaceId) return;
    try {
      await spaceApi.renameFile(spaceId, fileId, { parentId: targetFolderId });
      toast({ title: 'Moved successfully' });
      void loadFiles();
    } catch {
      toast({ title: 'Failed to move file', variant: 'destructive' });
    }
  };

  // ── Rename ───────────────────────────────────────────────────────────────
  const handleRename = async () => {
    if (!spaceId || !renameFile || !renameName.trim()) return;
    try {
      await spaceApi.renameFile(spaceId, renameFile.id, { name: renameName.trim() });
      toast({ title: 'Renamed' });
      setRenameFile(null);
      void loadFiles();
    } catch (err) {
      toast({
        title: 'Rename failed',
        description: err instanceof ApiError ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!spaceId || !deleteFile) return;
    try {
      await spaceApi.deleteFile(spaceId, deleteFile.id);
      toast({ title: 'Deleted' });
      setDeleteFile(null);
      void loadFiles();
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof ApiError ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  // ── Download ─────────────────────────────────────────────────────────────
  const handleDownload = (file: FileMetadata) => {
    if (!spaceId) return;
    const a = document.createElement('a');
    a.href = spaceApi.downloadFile(spaceId, file.id);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Folder navigation (All Files only) ──────────────────────────────────
  const handleOpenFolder = (folder: FileMetadata) => {
    setPathStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };
  const handleBreadcrumbClick = (index: number) => {
    setPathStack((prev) => prev.slice(0, index + 1));
  };
  const handleGoBack = () => {
    setPathStack((prev) => prev.length > 1 ? prev.slice(0, -1) : prev);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div
      className="flex flex-col h-full relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ToastContainer />
      <DropZoneOverlay isActive={isDragActive} />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <PageIcon className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-[15px] font-semibold">{pageTitle}</h1>
          {total > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {total}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search…"
                className="pl-8 h-8 w-44 text-sm"
              />
            </div>
          </form>

          {canWrite && (
            <>
              {/* New Folder — only in All Files view */}
              {isAllFiles && (
                <Button variant="outline" size="sm" className="h-8" onClick={() => setShowNewFolder(true)}>
                  <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                  New Folder
                </Button>
              )}

              {/* Upload dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-8">
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Upload
                    <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2">
                    <FileIcon className="h-3.5 w-3.5" />
                    Upload Files
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => folderInputRef.current?.click()} className="gap-2">
                    <Folder className="h-3.5 w-3.5" />
                    Upload Folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <input ref={fileInputRef} type="file" multiple className="hidden"
                onChange={(e) => { void uploadFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
              <input ref={folderInputRef} type="file" multiple className="hidden"
                // @ts-expect-error webkitdirectory is non-standard
                webkitdirectory=""
                onChange={handleFolderInputChange} />
            </>
          )}
        </div>
      </div>

      {/* Breadcrumb for All Files folder navigation */}
      {isAllFiles && pathStack.length > 1 && (
        <div className="px-6 py-2 border-b border-border shrink-0">
          <FileBreadcrumb
            pathStack={pathStack}
            onBreadcrumbClick={handleBreadcrumbClick}
            onGoBack={handleGoBack}
          />
        </div>
      )}

      {/* File grid */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <PageIcon className="h-10 w-10 opacity-20" />
            <p className="text-sm">
              {search ? 'No files match your search' : `No ${pageTitle.toLowerCase()} yet`}
            </p>
            {canWrite && !search && (
              <div className="flex gap-2 mt-1">
                {isAllFiles && (
                  <Button variant="outline" size="sm" onClick={() => setShowNewFolder(true)}>
                    <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                    New Folder
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload Files
                </Button>
              </div>
            )}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
            animate={{ scale: isDragActive ? 0.97 : 1, opacity: isDragActive ? 0.4 : 1 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {files.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                spaceId={spaceId!}
                canWrite={canWrite}
                onOpen={() => file.is_folder ? handleOpenFolder(file) : setPreviewFile(file)}
                onDownload={() => handleDownload(file)}
                onRename={() => { setRenameFile(file); setRenameName(file.name); }}
                onDelete={() => setDeleteFile(file)}
                isDragging={draggingId === file.id}
                isDragTarget={dragTargetId === file.id && file.is_folder && draggingId !== file.id}
                onDragStartFile={() => { draggingIdRef.current = file.id; setDraggingId(file.id); }}
                onDragEndFile={() => { draggingIdRef.current = null; setDraggingId(null); setDragTargetId(null); }}
                onDragEnterFolder={() => { if (draggingIdRef.current && draggingIdRef.current !== file.id && file.is_folder) setDragTargetId(file.id); }}
                onDragLeaveFolder={() => setDragTargetId(null)}
                onDropOnFolder={(draggedId) => { draggingIdRef.current = null; setDraggingId(null); setDragTargetId(null); void handleMove(draggedId, file.id); }}
              />
            ))}
          </motion.div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </div>

      {/* New Folder dialog */}
      <Dialog open={showNewFolder} onOpenChange={(o) => { if (!o) { setShowNewFolder(false); setFolderName(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New Folder</DialogTitle></DialogHeader>
          <Input
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleCreateFolder()}
            placeholder="Folder name"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewFolder(false); setFolderName(''); }}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateFolder()} disabled={!folderName.trim() || creatingFolder}>
              {creatingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameFile} onOpenChange={(o) => !o && setRenameFile(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFile(null)}>Cancel</Button>
            <Button onClick={() => void handleRename()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteFile} onOpenChange={(o) => !o && setDeleteFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteFile?.name}</strong> will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview */}
      {previewFile && spaceId && (
        <FilePreviewDialog
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          downloadUrl={spaceApi.downloadFile(spaceId, previewFile.id)}
        />
      )}
    </div>
  );
}

// ── FileCard ──────────────────────────────────────────────────────────────────

interface FileCardProps {
  file: FileMetadata & { owner?: { id: string; name: string; email: string } };
  spaceId: string;
  canWrite: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
  // drag-and-drop
  isDragging?: boolean;
  isDragTarget?: boolean;
  onDragStartFile?: () => void;
  onDragEndFile?: () => void;
  onDragEnterFolder?: () => void;
  onDragLeaveFolder?: () => void;
  onDropOnFolder?: (draggedId: string) => void;
}

function FileCard({
  file,
  spaceId,
  canWrite,
  onOpen,
  onDownload,
  onRename,
  onDelete,
  isDragging = false,
  isDragTarget = false,
  onDragStartFile,
  onDragEndFile,
  onDragEnterFolder,
  onDragLeaveFolder,
  onDropOnFolder,
}: FileCardProps) {
  const isImage = !file.is_folder && file.mime_type?.startsWith('image/');
  const thumbnailUrl = isImage ? spaceApi.downloadFile(spaceId, file.id) : null;
  const [dropSuccess, setDropSuccess] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', file.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStartFile?.();
  };

  const handleDragEnd = () => {
    onDragEndFile?.();
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!file.is_folder) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!file.is_folder) return;
    e.preventDefault();
    e.stopPropagation();
    onDragEnterFolder?.();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!file.is_folder) return;
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      onDragLeaveFolder?.();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!file.is_folder) return;
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== file.id) {
      setDropSuccess(true);
      setTimeout(() => setDropSuccess(false), 700);
      onDropOnFolder?.(draggedId);
    }
    onDragLeaveFolder?.();
  };

  return (
    <div
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
    <motion.div
      animate={{
        scale: isDragging ? 0.92 : isDragTarget ? 1.06 : dropSuccess ? 1.08 : 1,
        opacity: isDragging ? 0.35 : 1,
        filter: isDragging ? 'blur(1px)' : 'blur(0px)',
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={cn(
        'group relative flex flex-col rounded-lg border border-border bg-card',
        'hover:bg-accent/50 transition-colors cursor-pointer overflow-hidden',
        isDragTarget && 'ring-2 ring-primary/60 shadow-lg shadow-primary/20',
        dropSuccess && 'ring-2 ring-green-500/50',
        isDragging && 'cursor-grabbing',
      )}
    >
      {/* Drop glow overlay */}
      <AnimatePresence>
        {isDragTarget && (
          <motion.div
            key="drop-glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              background: 'radial-gradient(ellipse 80% 60% at 50% 50%, hsl(var(--primary) / 0.15) 0%, transparent 70%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Thumbnail */}
      <motion.div
        className="flex items-center justify-center h-24 bg-muted/40 relative z-10 overflow-hidden"
        onClick={onOpen}
        animate={isDragTarget ? { y: [0, -4, 0, -4, 0] } : { y: 0 }}
        transition={isDragTarget ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={file.name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fall back to icon if image fails to load
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
            }}
          />
        ) : null}
        <div className={cn('items-center justify-center w-full h-full', thumbnailUrl ? 'hidden' : 'flex')}>
          <FileTypeIcon name={file.name} isFolder={file.is_folder} className="h-10 w-10 opacity-70" />
        </div>
      </motion.div>

      {/* Info */}
      <div className="px-2.5 py-2 flex flex-col gap-0.5 min-w-0 relative z-10">
        <p className="text-[12.5px] font-medium truncate leading-tight" title={file.name} onClick={onOpen}>
          {file.name}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] text-muted-foreground">
            {file.is_folder ? formatBytes(file.folder_size || 0) : formatBytes(file.size)}
          </span>
          {file.owner && (
            <Avatar className="h-4 w-4 shrink-0">
              <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                {getInitials(file.owner.name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        <AnimatePresence>
          {isDragTarget && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="text-[9px] font-semibold text-primary mt-0.5"
            >
              Drop here
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Actions menu */}
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="h-6 w-6 rounded-md shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onOpen}>
              {file.is_folder ? <Folder className="mr-2 h-3.5 w-3.5" /> : <FileIcon className="mr-2 h-3.5 w-3.5" />}
              {file.is_folder ? 'Open' : 'Preview'}
            </DropdownMenuItem>
            {!file.is_folder && (
              <DropdownMenuItem onClick={onDownload}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Download
              </DropdownMenuItem>
            )}
            {canWrite && (
              <>
                <DropdownMenuItem onClick={onRename}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
    </div>
  );
}
