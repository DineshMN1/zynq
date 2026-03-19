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
} from 'lucide-react';
import { type FileMetadata, fileApi } from '@/lib/api';
import { formatBytes } from '@/lib/auth';
import { FileTypeIcon } from '@/features/file/components/file-type-icon';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FileCardProps {
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

export function FileCard({
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
}: FileCardProps) {
  const [dropSuccess, setDropSuccess] = useState(false);

  const handleDownload = () => {
    fileApi.download(file.id);
  };

  const hasSelect = !!onToggleSelect;
  const isShared =
    (file.publicShareCount ?? 0) > 0 || (file.privateShareCount ?? 0) > 0;

  const handleClick = (e: React.MouseEvent) => {
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
    // Only fire leave if we've actually left the element (not moved to a child)
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
        'group relative flex flex-col items-center px-2 py-3 rounded-lg cursor-pointer transition-colors duration-100 select-none',
        'hover:bg-muted/50',
        isSelected && 'bg-primary/5 ring-1 ring-primary/30',
        isDragTarget && 'bg-primary/8 ring-2 ring-primary/60 shadow-lg shadow-primary/20',
        dropSuccess && 'bg-green-500/10 ring-2 ring-green-500/50',
        isDragging && 'cursor-grabbing',
      )}
      onClick={handleClick}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (file.is_folder) onOpenFolder(file);
        else if (onPreview) onPreview(file);
      }}
    >
      {/* Drop target glow overlay */}
      <AnimatePresence>
        {isDragTarget && (
          <motion.div
            key="drop-glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-lg pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 80% 60% at 50% 50%, hsl(var(--primary) / 0.15) 0%, transparent 70%)',
            }}
          />
        )}
        {dropSuccess && (
          <motion.div
            key="drop-success"
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: 2.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full bg-green-500/20 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Checkbox */}
      {hasSelect && (
        <div
          className="absolute top-1.5 left-1.5 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect!(file.id);
          }}
        >
          <Checkbox
            checked={isSelected}
            className={cn(
              'h-4 w-4 border-muted-foreground/50 bg-background transition-opacity',
              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
            tabIndex={-1}
          />
        </div>
      )}

      {/* Kebab menu */}
      <div
        className="absolute top-1 right-1 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-background/80"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {!file.is_folder && onPreview && (
              <DropdownMenuItem onClick={() => onPreview(file)} className="gap-2 text-sm">
                <Eye className="h-4 w-4" />
                Preview
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleDownload} className="gap-2 text-sm">
              <Download className="h-4 w-4" />
              {file.is_folder ? 'Download as zip' : 'Download'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {onRename && (
              <DropdownMenuItem onClick={() => onRename(file.id)} className="gap-2 text-sm">
                <Pencil className="h-4 w-4" />
                Rename
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onShareUser(file.id)} className="gap-2 text-sm">
              <UserPlus className="h-4 w-4" />
              Share with user
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSharePublic(file.id)} className="gap-2 text-sm">
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

      {/* Shared dot indicator */}
      {isShared && (
        <div className="absolute top-2 right-8 z-10 h-2 w-2 rounded-full bg-blue-400" />
      )}

      {/* Icon — bounces when drag target */}
      <motion.div
        className="mb-2 transition-transform duration-150 group-hover:scale-105"
        animate={isDragTarget ? { y: [0, -4, 0, -4, 0] } : { y: 0 }}
        transition={isDragTarget ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      >
        <FileTypeIcon name={file.name} mimeType={file.mime_type} isFolder={file.is_folder} size={48} />
      </motion.div>

      {/* File name */}
      <p
        className="text-xs text-center leading-tight w-full truncate px-1 font-medium text-foreground/80"
        title={file.name}
      >
        {file.name}
      </p>

      {/* Sub-label */}
      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
        {file.is_folder
          ? file.size > 0
            ? formatBytes(Number(file.size))
            : 'Folder'
          : formatBytes(Number(file.size || 0))}
      </p>

      {/* Drop hint label */}
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
    </motion.div>
    </div>
  );
}
