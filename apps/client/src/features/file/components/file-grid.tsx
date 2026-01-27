"use client";

import { Card } from "@/components/ui/card";
import { File as FileIcon, Loader2 } from "lucide-react";
import { type FileMetadata } from "@/lib/api";
import { FileCard } from "./file-card";

interface FileGridProps {
  files: FileMetadata[];
  loading: boolean;
  onOpenFolder: (folder: FileMetadata) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
}

export function FileGrid({
  files,
  loading,
  onOpenFolder,
  onDelete,
  onShare,
}: FileGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <FileIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">No files here</h3>
            <p className="text-sm text-muted-foreground">
              This folder is empty
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {files.map((file, index) => (
        <FileCard
          key={file.id}
          file={file}
          index={index}
          onOpenFolder={onOpenFolder}
          onDelete={onDelete}
          onShare={onShare}
        />
      ))}
    </div>
  );
}
