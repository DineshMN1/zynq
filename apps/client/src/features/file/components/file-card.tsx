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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Download,
  Trash2,
  File,
  Folder,
  Link as LinkIcon,
} from "lucide-react";
import { type FileMetadata, fileApi } from "@/lib/api";
import { formatBytes } from "@/lib/auth";
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
      const res = await fileApi.download(file.id);
      if (res.url) {
        const response = await fetch(res.url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = file.name || "download";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } else {
        toast({
          title: "Download failed",
          description: "File URL not available.",
          variant: "destructive",
        });
      }
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
  const IconComponent = file.is_folder ? Folder : File;

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
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card
        className={cn(
          "p-4 hover:border-primary/50 transition-colors cursor-pointer",
          isSelected && "border-primary bg-primary/5"
        )}
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {hasSelect && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(file.id);
                }}
                className="flex items-center"
              >
                <Checkbox
                  checked={isSelected}
                  className="h-4 w-4"
                  tabIndex={-1}
                />
              </div>
            )}
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <IconComponent className="h-5 w-5 text-primary" />
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!file.is_folder && (
                <DropdownMenuItem onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={() => onShare(file.id)}>
                <LinkIcon className="mr-2 h-4 w-4" />
                Get Public Link
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onDelete(file.id)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          <p className="font-medium truncate" title={file.name}>
            {file.name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">
              {formatBytes(file.size)}
            </p>
            {file.is_folder && (
              <Badge variant="secondary" className="text-xs">
                Folder
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
