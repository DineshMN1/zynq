import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileText, Calendar } from "lucide-react";
import { FileMetadata } from "@/lib/api";
import { formatFileSize, formatDate } from "@/lib/file-hash";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
            </div>
            <div>
              <DialogTitle>Duplicate Content Detected</DialogTitle>
              <DialogDescription className="mt-1">
                Files with identical content already exist in your library
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium mb-2">File you&apos;re uploading:</p>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-3">
              Existing {duplicateFiles.length === 1 ? 'file' : 'files'} with same content:
            </p>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {duplicateFiles.map((file) => (
                <div
                  key={file.id}
                  className="rounded-md border p-3 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {file.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground ml-6">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(file.created_at)}</span>
                    </div>
                    <span>{formatFileSize(file.size)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Note:</strong> Uploading will create another copy of this file.
              Consider using the existing file to save storage space.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel Upload
          </Button>
          <Button variant="default" onClick={onProceed}>
            Upload Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
