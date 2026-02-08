'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  File as FileIcon,
  Folder,
  Upload,
  Loader2,
  LayoutGrid,
  List,
} from 'lucide-react';
import { type FileMetadata } from '@/lib/api';
import { FileCard } from './file-card';
import { FileListRow } from './file-list-row';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

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

type ViewMode = 'grid' | 'list';

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
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Load view preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('zynq-view-mode') as ViewMode;
    if (saved === 'grid' || saved === 'list') {
      setViewMode(saved);
    }
  }, []);

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('zynq-view-mode', mode);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">
          Loading your files...
        </p>
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
              <h3 className="font-semibold text-lg text-foreground">
                No files here yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Start by uploading files or creating a new folder. You can also
                drag and drop files here.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center text-xs text-muted-foreground">
              <span className="px-3 py-1.5 rounded-full bg-muted">
                Drag & drop files
              </span>
              <span className="px-3 py-1.5 rounded-full bg-muted">
                Upload button above
              </span>
              <span className="px-3 py-1.5 rounded-full bg-muted">
                Ctrl+V to paste
              </span>
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
    <div className="space-y-4">
      {/* View Toggle - Nextcloud style */}
      <div className="flex items-center justify-end gap-1">
        <Button
          variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => handleViewChange('grid')}
          title="Grid view"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === 'list' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => handleViewChange('list')}
          title="List view"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
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
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* List View - Nextcloud style */}
            <Card className="overflow-hidden">
              {/* Table Header */}
              <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
                <div className="w-8 shrink-0" /> {/* Checkbox column */}
                <div className="flex-1 min-w-0">Name</div>
                <div className="hidden sm:block w-20 shrink-0" />{' '}
                {/* Shared column */}
                <div className="hidden sm:block w-24 shrink-0 text-right">
                  Size
                </div>
                <div className="hidden md:block w-32 shrink-0 text-right">
                  Modified
                </div>
                <div className="w-16 shrink-0" /> {/* Actions column */}
              </div>

              {/* Table Body */}
              <div className="divide-y">
                {/* Folders first */}
                {folders.map((file, index) => (
                  <FileListRow
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
                {/* Then files */}
                {regularFiles.map((file, index) => (
                  <FileListRow
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
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
