"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { getFileIcon, getIconColor, getIconBgColor } from "@/features/file/utils/file-icons";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FileCardProps {
  file: FileMetadata;
  index: number;
  onOpenFolder: (folder: FileMetadata) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onCardClick?: (id: string, e: React.MouseEvent) => void;
}

export function FileCard({
  file,
  index,
  onOpenFolder,
  onDelete,
  onShare,
  isSelected,
  onToggleSelect,
  onCardClick,
}: FileCardProps) {
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
  const iconBgColor = getIconBgColor(file.name, file.mime_type, file.is_folder);

  const handleCardClick = (e: React.MouseEvent) => {
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
    >
      <Card
        className={cn(
          "group relative p-4 transition-all duration-200 cursor-pointer",
          "hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5",
          "active:translate-y-0 active:shadow-sm",
          isSelected && "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20"
        )}
        onClick={handleCardClick}
      >
        {/* Selection checkbox overlay */}
        {hasSelect && (
          <div
            className={cn(
              "absolute top-3 left-3 z-10 transition-opacity duration-200",
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(file.id);
            }}
          >
            <div className="bg-background/80 backdrop-blur-sm rounded-md p-0.5">
              <Checkbox
                checked={isSelected}
                className="h-5 w-5 border-2"
                tabIndex={-1}
              />
            </div>
          </div>
        )}

        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center transition-transform duration-200",
              "group-hover:scale-105",
              iconBgColor
            )}>
              <IconComponent className={cn("h-6 w-6", iconColor)} />
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 transition-opacity duration-200",
                  "opacity-0 group-hover:opacity-100 focus:opacity-100"
                )}
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

        <div className="space-y-1.5">
          <p
            className="font-medium truncate text-sm leading-tight"
            title={file.name}
          >
            {file.name}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {formatBytes(Number(file.size || 0))}
            </p>
            {file.is_folder && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5 font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-0"
              >
                Folder
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
