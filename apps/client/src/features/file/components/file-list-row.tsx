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
  MoreVertical,
  Download,
  Trash2,
  Link as LinkIcon,
  UserPlus,
  Globe,
  Lock,
  Pencil,
  Eye,
} from 'lucide-react';
import { type FileMetadata, fileApi } from '@/lib/api';
import { formatBytes } from '@/lib/auth';
import { getFileIcon, getIconColor } from '@/features/file/utils/file-icons';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export function FileListRow({
  file,
  index,
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
    } catch (err) {
      console.error('Download failed:', err);
      toast({
        title: 'Error downloading',
        description: 'Unable to download file.',
        variant: 'destructive',
      });
    }
  };

  const hasSelect = !!onToggleSelect;
  const IconComponent = getFileIcon(file.name, file.mime_type, file.is_folder);
  const iconColor = getIconColor(file.name, file.mime_type, file.is_folder);

  const handleRowClick = (e: React.MouseEvent) => {
    if (onCardClick) {
      onCardClick(file.id, e);
      return;
    }
    if (file.is_folder) {
      onOpenFolder(file);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      className={cn(
        'group flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 cursor-pointer transition-colors',
        'hover:bg-muted/50',
        isSelected && 'bg-primary/5 hover:bg-primary/10',
      )}
      onClick={handleRowClick}
    >
      {/* Checkbox — always visible in list view */}
      {hasSelect && (
        <div
          className="w-8 shrink-0 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(file.id);
          }}
        >
          <Checkbox
            checked={isSelected}
            className="h-4.5 w-4.5 border-muted-foreground/50 data-[state=checked]:border-primary"
            tabIndex={-1}
          />
        </div>
      )}
      {!hasSelect && <div className="w-8 shrink-0" />}

      {/* Name with icon */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <IconComponent className={cn('h-5 w-5 shrink-0', iconColor)} />
        <span className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </span>
      </div>

      {/* Shared */}
      <div className="hidden sm:flex w-28 shrink-0 items-center justify-center gap-1">
        {(file.publicShareCount ?? 0) > 0 && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-5 font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-0 gap-1"
          >
            <Globe className="h-3 w-3" />
            Shared
          </Badge>
        )}
        {(file.privateShareCount ?? 0) > 0 && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-5 font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-0 gap-1"
          >
            <Lock className="h-3 w-3" />
            Shared
          </Badge>
        )}
      </div>

      {/* Size */}
      <div className="hidden sm:block w-24 shrink-0 text-right text-sm text-muted-foreground">
        {file.is_folder ? '—' : formatBytes(Number(file.size || 0))}
      </div>

      {/* Modified */}
      <div className="hidden md:block w-32 shrink-0 text-right text-sm text-muted-foreground">
        {file.updated_at ? formatDate(file.updated_at) : '—'}
      </div>

      {/* Actions — always visible like Nextcloud */}
      <div className="w-16 shrink-0 flex items-center justify-end gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onShareUser(file.id);
          }}
          title="Share"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {!file.is_folder && onPreview && (
              <DropdownMenuItem
                onClick={() => onPreview(file)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />
              {file.is_folder ? 'Download folder (zip)' : 'Download'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            {onRename && (
              <DropdownMenuItem
                onClick={() => onRename(file.id)}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                Rename
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={() => onShareUser(file.id)}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Share
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => onSharePublic(file.id)}
              className="gap-2"
            >
              <LinkIcon className="h-4 w-4" />
              Get Public Link
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => onDelete(file.id)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Move to Trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}
