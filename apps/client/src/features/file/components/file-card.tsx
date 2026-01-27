"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface FileCardProps {
  file: FileMetadata;
  index: number;
  onOpenFolder: (folder: FileMetadata) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
}

export function FileCard({
  file,
  index,
  onOpenFolder,
  onDelete,
  onShare,
}: FileCardProps) {
  const handleDownload = async () => {
    try {
      const res = await fileApi.download(file.id);
      if (res.url) {
        const response = await fetch(res.url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = file.name || "download";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card
        className="p-4 hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => file.is_folder && onOpenFolder(file)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            {file.is_folder ? (
              <Folder className="h-5 w-5 text-primary" />
            ) : (
              <File className="h-5 w-5 text-primary" />
            )}
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
