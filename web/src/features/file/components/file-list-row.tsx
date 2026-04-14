import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Download,
  Trash2,
  Link as LinkIcon,
  UserPlus,
  Pencil,
  Eye,
  Share2,
} from 'lucide-react';
import { type FileMetadata, fileApi } from '@/lib/api';
import { formatBytes } from '@/lib/auth';
import { FileTypeIcon } from '@/features/file/components/file-type-icon';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FileListRowProps {
  file: FileMetadata;
  index: number;
  onOpenFolder: (folder: FileMetadata) => void;
  onDelete: (id: string) => void;
  onShareUser: (id: string) => void;
  onSharePublic: (id: string) => void;
  onRename?: (id: string) => void;
  onPreview?: (file: FileMetadata) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onCardClick?: (id: string, e: React.MouseEvent) => void;
  // drag-and-drop
  isDragging?: boolean;
  isDragTarget?: boolean;
  onDragStartFile?: () => void;
  onDragEndFile?: () => void;
  onDragEnterFolder?: () => void;
  onDragLeaveFolder?: () => void;
  onDropOnFolder?: (draggedId: string) => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function FileListRow({
  file,
  index: _index,
  onOpenFolder,
  onDelete,
  onShareUser,
  onSharePublic,
  onRename,
  onPreview,
  isSelected,
  onToggleSelect,
  onCardClick,
  isDragging = false,
  isDragTarget = false,
  onDragStartFile,
  onDragEndFile,
  onDragEnterFolder,
  onDragLeaveFolder,
  onDropOnFolder,
}: FileListRowProps) {
  const [dropSuccess, setDropSuccess] = useState(false);

  const handleDownload = () => {
    fileApi.download(file.id);
  };

  const actionBtnClass =
    'h-9 w-9 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground';
  const hasSelect = !!onToggleSelect;
  const isShared =
    (file.publicShareCount ?? 0) > 0 || (file.privateShareCount ?? 0) > 0;

  const handleRowClick = (e: React.MouseEvent) => {
    if (onCardClick) {
      onCardClick(file.id, e);
      return;
    }
    if (file.is_folder) onOpenFolder(file);
  };

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
        scale: isDragging ? 0.98 : isDragTarget ? 1.01 : 1,
        opacity: isDragging ? 0.35 : 1,
        backgroundColor: isDragTarget ? 'hsl(var(--primary) / 0.06)' : undefined,
      }}
      transition={{ duration: 0.15 }}
      className={cn(
        'group flex h-14 sm:h-12 cursor-pointer items-center gap-3 px-3 sm:px-5 py-0 transition-colors duration-100',
        'hover:bg-muted/40',
        isSelected && 'bg-primary/5 hover:bg-primary/8',
        isDragTarget && 'ring-1 ring-primary/40',
        dropSuccess && 'bg-green-500/10 ring-1 ring-green-500/40',
        isDragging && 'cursor-grabbing',
      )}
      onClick={handleRowClick}
    >
      {/* Checkbox — appears on hover or when selected */}
      <div
        className="w-5 shrink-0 flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          if (hasSelect) onToggleSelect!(file.id);
        }}
      >
        {hasSelect && (
          <Checkbox
            checked={isSelected}
            className={cn(
              'h-4 w-4 border-muted-foreground/40 transition-opacity',
              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
            tabIndex={-1}
          />
        )}
      </div>

      {/* Icon + Name */}
      <div className="flex-1 min-w-0 flex items-center gap-2.5">
        <FileTypeIcon name={file.name} mimeType={file.mime_type} isFolder={file.is_folder} size={24} className="shrink-0" />
        <span
          className="truncate text-sm"
          title={file.name}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (file.is_folder) onOpenFolder(file);
            else if (onPreview) onPreview(file);
          }}
        >
          {file.name}
        </span>
        {isShared && (
          <Share2 className="h-3.5 w-3.5 shrink-0 text-blue-400 opacity-70" />
        )}

        {/* Drop here label */}
        <AnimatePresence>
          {isDragTarget && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.15 }}
              className="ml-2 text-[10px] font-semibold text-primary shrink-0"
            >
              Drop here →
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Size */}
      <div className="hidden sm:block w-24 shrink-0 text-right text-xs text-muted-foreground lg:w-28">
        {formatBytes(Number(file.is_folder ? (file.folder_size || 0) : (file.size || 0)))}
      </div>

      {/* Modified */}
      <div className="hidden md:block w-32 shrink-0 text-right text-xs text-muted-foreground lg:w-36">
        {file.updated_at ? formatDate(file.updated_at) : '—'}
      </div>

      {/* Actions — always visible */}
      <div
        className="flex w-20 sm:w-28 shrink-0 items-center justify-end gap-0.5 sm:gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {!file.is_folder && onPreview && (
          <Button
            variant="ghost"
            size="icon"
            className={`hidden sm:flex ${actionBtnClass}`}
            onClick={() => onPreview(file)}
            title="Preview"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={actionBtnClass}
          onClick={() => onShareUser(file.id)}
          title="Share"
        >
          <UserPlus className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={actionBtnClass}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {!file.is_folder && onPreview && (
              <DropdownMenuItem
                onClick={() => onPreview(file)}
                className="gap-2 text-sm"
              >
                <Eye className="h-4 w-4" />
                Preview
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={handleDownload}
              className="gap-2 text-sm"
            >
              <Download className="h-4 w-4" />
              {file.is_folder ? 'Download as zip' : 'Download'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {onRename && (
              <DropdownMenuItem
                onClick={() => onRename(file.id)}
                className="gap-2 text-sm"
              >
                <Pencil className="h-4 w-4" />
                Rename
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => onShareUser(file.id)}
              className="gap-2 text-sm"
            >
              <UserPlus className="h-4 w-4" />
              Share with user
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSharePublic(file.id)}
              className="gap-2 text-sm"
            >
              <LinkIcon className="h-4 w-4" />
              Copy public link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(file.id)}
              className="gap-2 text-sm text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Move to Trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
    </div>
  );
}
