import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  FileText,
  Calendar,
  FolderOpen,
  Upload,
  X,
  Copy,
  CheckCircle2
} from "lucide-react";
import { FileMetadata } from "@/lib/api";
import { formatFileSize, formatDate } from "@/lib/file-hash";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  duplicateFiles: FileMetadata[];
  onProceed: () => void;
  onCancel: () => void;
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  fileName,
  duplicateFiles,
  onProceed,
  onCancel,
}: DuplicateWarningDialogProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getFilePath = (file: FileMetadata): string => {
    // If storage_path is available, extract meaningful path
    if (file.storage_path) {
      const parts = file.storage_path.split('/');
      // Remove user ID prefix if present
      if (parts.length > 2) {
        return '/' + parts.slice(2).join('/');
      }
      return '/' + file.storage_path;
    }
    // Fallback to showing it's in the root or unknown location
    return file.parent_id ? '/...' : '/ (Root)';
  };

  const handleCopyPath = async (file: FileMetadata) => {
    const path = getFilePath(file);
    await navigator.clipboard.writeText(path);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 gap-0 overflow-hidden">
        {/* Header with gradient */}
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-b">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0 shadow-sm">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl">Duplicate File Detected</DialogTitle>
              <DialogDescription className="text-sm">
                A file with identical content already exists in your cloud storage
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* File being uploaded */}
          <div className="rounded-xl bg-muted/50 p-4 border border-border/50">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              File you're uploading
            </p>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-foreground">{fileName}</p>
                <p className="text-xs text-muted-foreground">New upload</p>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                New
              </Badge>
            </div>
          </div>

          {/* Existing files */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Existing {duplicateFiles.length === 1 ? 'file' : 'files'} with same content
            </p>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {duplicateFiles.map((file) => (
                <div
                  key={file.id}
                  className="rounded-xl border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="font-medium truncate text-foreground" title={file.name}>
                        {file.name}
                      </p>

                      {/* File location */}
                      <div className="flex items-center gap-2 group">
                        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground truncate flex-1" title={getFilePath(file)}>
                          Location: <span className="font-mono">{getFilePath(file)}</span>
                        </span>
                        <button
                          onClick={() => handleCopyPath(file)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                          title="Copy path"
                        >
                          {copiedId === file.id ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>
                      </div>

                      {/* File metadata */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(file.created_at)}</span>
                        </div>
                        <span className="text-muted-foreground/50">•</span>
                        <span>{formatFileSize(file.size)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info box */}
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-900/50">
            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">i</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  What would you like to do?
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-200/80">
                  You can upload a new copy of this file, or use the existing file to save storage space.
                  The existing file is located at the path shown above.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 bg-muted/30 border-t gap-3 sm:gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 sm:flex-none h-11"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={onProceed}
            className="flex-1 sm:flex-none h-11 bg-primary hover:bg-primary/90"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
