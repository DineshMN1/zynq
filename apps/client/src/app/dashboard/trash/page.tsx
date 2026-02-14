'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Trash2,
  MoreVertical,
  RotateCcw,
  XCircle,
  Loader2,
} from 'lucide-react';
import { fileApi, type FileMetadata } from '@/lib/api';
import { formatBytes } from '@/lib/auth';
import {
  getFileIcon,
  getIconColor,
  getIconBgColor,
} from '@/features/file/utils/file-icons';
import { motion } from 'framer-motion';
import { toast } from '@/hooks/use-toast';

export default function TrashPage() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  useEffect(() => {
    loadTrash();
  }, []);

  const loadTrash = async () => {
    try {
      setLoading(true);
      const response = await fileApi.trash({ page: 1, limit: 50 });
      setFiles(response.items);
    } catch (error) {
      console.error('Failed to load trash:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await fileApi.restore(id);
      loadTrash();
    } catch (error) {
      console.error('Failed to restore file:', error);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    setSelectedFileId(id);
    setDeleteDialogOpen(true);
  };

  const confirmPermanentDelete = async () => {
    if (!selectedFileId) return;
    try {
      await fileApi.permanentDelete(selectedFileId);
      setFiles(files.filter((f) => f.id !== selectedFileId)); // remove from UI instantly
      toast({
        title: 'File deleted',
        description: 'The file has been permanently deleted.',
      });
    } catch (error) {
      console.error('Failed to permanently delete file:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete file permanently.',
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedFileId(null);
    }
  };

  const handleEmptyTrash = () => {
    setEmptyTrashDialogOpen(true);
  };

  const confirmEmptyTrash = async () => {
    try {
      await fileApi.emptyTrash();
      setFiles([]); // clear UI
      toast({
        title: 'Trash emptied',
        description: 'All files have been permanently deleted.',
      });
    } catch (error) {
      console.error('Failed to empty trash:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to empty trash.',
      });
    } finally {
      setEmptyTrashDialogOpen(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Trash</h1>
          <p className="text-muted-foreground mt-1">
            Files will be permanently deleted after 30 days
          </p>
        </div>
        {files.length > 0 && (
          <Button variant="destructive" onClick={handleEmptyTrash}>
            Empty Trash
          </Button>
        )}
      </div>

      {/* Trash Files */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : files.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Trash2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Trash is empty</h3>
              <p className="text-sm text-muted-foreground">
                Deleted files will appear here
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {files.map((file, index) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card className="p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  {(() => {
                    const Icon = getFileIcon(
                      file.name,
                      file.mime_type || '',
                      file.is_folder,
                    );
                    const iconColor = getIconColor(
                      file.name,
                      file.mime_type || '',
                      file.is_folder,
                    );
                    const iconBg = getIconBgColor(
                      file.name,
                      file.mime_type || '',
                      file.is_folder,
                    );
                    return (
                      <div
                        className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center`}
                      >
                        <Icon className={`h-5 w-5 ${iconColor}`} />
                      </div>
                    );
                  })()}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleRestore(file.id)}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Restore
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handlePermanentDelete(file.id)}
                        className="text-destructive"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Delete Forever
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div>
                  <p className="font-medium truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {file.is_folder ? 'Folder' : formatBytes(Number(file.size))}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              file from the server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty Trash Confirmation Dialog */}
      <AlertDialog
        open={emptyTrashDialogOpen}
        onOpenChange={setEmptyTrashDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty trash?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to empty the trash? This will permanently
              delete all files and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmEmptyTrash}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Empty Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
