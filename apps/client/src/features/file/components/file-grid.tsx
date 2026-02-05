"use client";

import { Card } from "@/components/ui/card";
import { File as FileIcon, Folder, Upload, Loader2 } from "lucide-react";
import { type FileMetadata } from "@/lib/api";
import { FileCard } from "./file-card";
import { motion } from "framer-motion";

interface FileGridProps {
  files: FileMetadata[];
  loading: boolean;
  onOpenFolder: (folder: FileMetadata) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onCardClick?: (id: string, e: React.MouseEvent) => void;
}

/**
 * Render a responsive grid of folders and files and handle loading and empty states.
 *
 * Renders a loading indicator when `loading` is true, an animated empty state when `files` is empty, and otherwise displays folders first and regular files in separate sections. Selection state and interaction callbacks provided via props are forwarded to each file card.
 *
 * @param files - Array of file metadata to display; items with `is_folder` are shown in the folders section.
 * @param loading - Whether to show the loading indicator instead of the grid.
 * @param onOpenFolder - Callback invoked with a folder `FileMetadata` when a folder card is opened.
 * @param onDelete - Callback invoked with a file id to delete that item.
 * @param onShare - Callback invoked with a file id to share that item.
 * @param selectedIds - Optional set of selected file ids; used to mark cards as selected.
 * @param onToggleSelect - Optional callback invoked with a file id to toggle its selection state.
 * @param onCardClick - Optional callback invoked with a file id and the click event when a card is clicked.
 * @returns A React element containing the file grid UI.
 */
export function FileGrid({
  files,
  loading,
  onOpenFolder,
  onDelete,
  onShare,
  selectedIds,
  onToggleSelect,
  onCardClick,
}: FileGridProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Loading your files...</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="p-12 text-center border-dashed border-2 bg-muted/20">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Folder className="h-10 w-10 text-primary/60" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-lg bg-muted flex items-center justify-center border-2 border-background">
                <Upload className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg text-foreground">No files here yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Start by uploading files or creating a new folder. You can also drag and drop files here.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center text-xs text-muted-foreground">
              <span className="px-3 py-1.5 rounded-full bg-muted">Drag & drop files</span>
              <span className="px-3 py-1.5 rounded-full bg-muted">Upload button above</span>
              <span className="px-3 py-1.5 rounded-full bg-muted">Ctrl+V to paste</span>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }

  // Separate folders and files for better organization
  const folders = files.filter((f) => f.is_folder);
  const regularFiles = files.filter((f) => !f.is_folder);

  return (
    <div className="space-y-6">
      {/* Folders section */}
      {folders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Folders ({folders.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {folders.map((file, index) => (
              <FileCard
                key={file.id}
                file={file}
                index={index}
                onOpenFolder={onOpenFolder}
                onDelete={onDelete}
                onShare={onShare}
                isSelected={selectedIds?.has(file.id)}
                onToggleSelect={onToggleSelect}
                onCardClick={onCardClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Files section */}
      {regularFiles.length > 0 && (
        <div className="space-y-3">
          {folders.length > 0 && (
            <div className="flex items-center gap-2">
              <FileIcon className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">
                Files ({regularFiles.length})
              </h3>
            </div>
          )}
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {regularFiles.map((file, index) => (
              <FileCard
                key={file.id}
                file={file}
                index={folders.length + index}
                onOpenFolder={onOpenFolder}
                onDelete={onDelete}
                onShare={onShare}
                isSelected={selectedIds?.has(file.id)}
                onToggleSelect={onToggleSelect}
                onCardClick={onCardClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}