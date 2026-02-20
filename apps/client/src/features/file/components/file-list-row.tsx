'use client';

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
import { getFileIcon, getIconColor } from '@/features/file/utils/file-icons';
import { toast } from '@/hooks/use-toast';
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
}: FileListRowProps) {
  const handleDownload = async () => {
    try {
      const { blob, fileName } = await fileApi.download(file.id);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || file.name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  const hasSelect = !!onToggleSelect;
  const IconComponent = getFileIcon(file.name, file.mime_type, file.is_folder);
  const iconColor = getIconColor(file.name, file.mime_type, file.is_folder);
  const isShared =
    (file.publicShareCount ?? 0) > 0 || (file.privateShareCount ?? 0) > 0;

  const handleRowClick = (e: React.MouseEvent) => {
    if (onCardClick) {
      onCardClick(file.id, e);
      return;
    }
    if (file.is_folder) onOpenFolder(file);
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-4 py-0 h-11 cursor-pointer transition-colors duration-100',
        'hover:bg-muted/40',
        isSelected && 'bg-primary/5 hover:bg-primary/8',
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
        <IconComponent className={cn('h-5 w-5 shrink-0', iconColor)} />
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
      </div>

      {/* Size */}
      <div className="hidden sm:block w-28 shrink-0 text-right text-xs text-muted-foreground">
        {formatBytes(Number(file.size || 0))}
      </div>

      {/* Modified */}
      <div className="hidden md:block w-36 shrink-0 text-right text-xs text-muted-foreground">
        {file.updated_at ? formatDate(file.updated_at) : '—'}
      </div>

      {/* Actions — visible on hover */}
      <div
        className="w-20 shrink-0 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {!file.is_folder && onPreview && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onPreview(file)}
            title="Preview"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onShareUser(file.id)}
          title="Share"
        >
          <UserPlus className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
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
    </div>
  );
}
