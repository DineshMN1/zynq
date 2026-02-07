"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Download,
  Trash2,
  Link as LinkIcon,
} from "lucide-react";
import { type FileMetadata, fileApi } from "@/lib/api";
import { formatBytes } from "@/lib/auth";
import { getFileIcon, getIconColor } from "@/features/file/utils/file-icons";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface FileListRowProps {
  file: FileMetadata;
  index: number;
  onOpenFolder: (folder: FileMetadata) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
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
  onShare,
  isSelected,
  onToggleSelect,
  onCardClick,
}: FileListRowProps) {
  const handleDownload = async () => {
    try {
      const { blob, fileName } = await fileApi.download(file.id);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || file.name || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
      toast({
        title: "Error downloading",
        description: "Unable to download file.",
        variant: "destructive",
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
        "group flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors",
        "hover:bg-muted/50",
        isSelected && "bg-primary/5"
      )}
      onClick={handleRowClick}
    >
      {/* Checkbox */}
      {hasSelect && (
        <div
          className="w-8 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(file.id);
          }}
        >
          <Checkbox
            checked={isSelected}
            className="h-4 w-4"
            tabIndex={-1}
          />
        </div>
      )}
      {!hasSelect && <div className="w-8" />}

      {/* Name with icon */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <IconComponent className={cn("h-5 w-5 shrink-0", iconColor)} />
        <span className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </span>
      </div>

      {/* Size */}
      <div className="hidden sm:block w-24 text-right text-sm text-muted-foreground">
        {file.is_folder ? "—" : formatBytes(file.size)}
      </div>

      {/* Modified */}
      <div className="hidden md:block w-32 text-right text-sm text-muted-foreground">
        {file.updated_at ? formatDate(file.updated_at) : "—"}
      </div>

      {/* Actions */}
      <div className="w-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {!file.is_folder && (
              <>
                <DropdownMenuItem onClick={handleDownload} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem onClick={() => onShare(file.id)} className="gap-2">
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
