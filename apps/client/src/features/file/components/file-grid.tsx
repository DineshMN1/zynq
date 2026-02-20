'use client';

import { Button } from '@/components/ui/button';
import { Upload, Loader2, LayoutGrid, List } from 'lucide-react';
import { type FileMetadata } from '@/lib/api';
import { FileCard } from './file-card';
import { FileListRow } from './file-list-row';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface FileGridProps {
  files: FileMetadata[];
  loading: boolean;
  onOpenFolder: (folder: FileMetadata) => void;
  onDelete: (id: string) => void;
  onShareUser: (id: string) => void;
  onSharePublic: (id: string) => void;
  onRename?: (id: string) => void;
  onPreview?: (file: FileMetadata) => void;
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
  onShareUser,
  onSharePublic,
  onRename,
  onPreview,
  selectedIds,
  onToggleSelect,
  onCardClick,
}: FileGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  useEffect(() => {
    const saved = localStorage.getItem('zynq-view-mode') as ViewMode;
    if (saved === 'grid' || saved === 'list') setViewMode(saved);
  }, []);

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('zynq-view-mode', mode);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading files…</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center justify-center py-24 gap-4"
      >
        <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
          <Upload className="h-7 w-7 text-muted-foreground/60" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">
            No files here yet
          </p>
          <p className="text-xs text-muted-foreground">
            Upload files or drag and drop into this folder
          </p>
        </div>
      </motion.div>
    );
  }

  // Folders first, then files
  const sorted = [
    ...files.filter((f) => f.is_folder),
    ...files.filter((f) => !f.is_folder),
  ];

  return (
    <div className="space-y-2">
      {/* View toggle */}
      <div className="flex items-center justify-end gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            viewMode === 'list' && 'bg-muted text-foreground',
          )}
          onClick={() => handleViewChange('list')}
          title="List view"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            viewMode === 'grid' && 'bg-muted text-foreground',
          )}
          onClick={() => handleViewChange('grid')}
          title="Grid view"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {/* Nextcloud-style list — full-width table */}
            <div className="rounded-lg border bg-card overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20 text-xs font-medium text-muted-foreground select-none">
                <div className="w-5 shrink-0" />
                <div className="flex-1 min-w-0">Name</div>
                <div className="hidden sm:block w-28 shrink-0 text-right">
                  Size
                </div>
                <div className="hidden md:block w-36 shrink-0 text-right">
                  Modified
                </div>
                <div className="w-20 shrink-0" />
              </div>

              <div className="divide-y divide-border/50">
                {sorted.map((file, index) => (
                  <FileListRow
                    key={file.id}
                    file={file}
                    index={index}
                    onOpenFolder={onOpenFolder}
                    onDelete={onDelete}
                    onShareUser={onShareUser}
                    onSharePublic={onSharePublic}
                    onRename={onRename}
                    onPreview={onPreview}
                    isSelected={selectedIds?.has(file.id)}
                    onToggleSelect={onToggleSelect}
                    onCardClick={onCardClick}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-1"
          >
            {sorted.map((file, index) => (
              <FileCard
                key={file.id}
                file={file}
                index={index}
                onOpenFolder={onOpenFolder}
                onDelete={onDelete}
                onShareUser={onShareUser}
                onSharePublic={onSharePublic}
                onRename={onRename}
                onPreview={onPreview}
                isSelected={selectedIds?.has(file.id)}
                onToggleSelect={onToggleSelect}
                onCardClick={onCardClick}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
