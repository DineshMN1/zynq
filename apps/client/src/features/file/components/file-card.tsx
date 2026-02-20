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
} from 'lucide-react';
import { type FileMetadata, fileApi } from '@/lib/api';
import { formatBytes } from '@/lib/auth';
import {
  getFileIcon,
  getIconColor,
  getIconBgColor,
} from '@/features/file/utils/file-icons';
import { toast } from '@/hooks/use-toast';
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
}: FileCardProps) {
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
  const iconBgColor = getIconBgColor(file.name, file.mime_type, file.is_folder);
  const isShared =
    (file.publicShareCount ?? 0) > 0 || (file.privateShareCount ?? 0) > 0;

  const handleClick = (e: React.MouseEvent) => {
    if (onCardClick) {
      onCardClick(file.id, e);
      return;
    }
    if (file.is_folder) onOpenFolder(file);
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col items-center px-2 py-3 rounded-lg cursor-pointer transition-colors duration-100 select-none',
        'hover:bg-muted/50',
        isSelected && 'bg-primary/5 ring-1 ring-primary/30',
      )}
      onClick={handleClick}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (file.is_folder) onOpenFolder(file);
        else if (onPreview) onPreview(file);
      }}
    >
      {/* Checkbox — top-left, appears on hover/selected */}
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

      {/* Kebab menu — top-right, appears on hover */}
      <div
        className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
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

      {/* Shared dot — top-right, hidden when kebab is visible */}
      {isShared && (
        <div className="absolute top-1.5 right-1.5 z-10 h-2 w-2 rounded-full bg-blue-400 group-hover:hidden" />
      )}

      {/* Large centered icon */}
      <div
        className={cn(
          'h-16 w-16 rounded-2xl flex items-center justify-center mb-2 transition-transform duration-150 group-hover:scale-105',
          iconBgColor,
        )}
      >
        <IconComponent className={cn('h-8 w-8', iconColor)} />
      </div>

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
    </div>
  );
}
