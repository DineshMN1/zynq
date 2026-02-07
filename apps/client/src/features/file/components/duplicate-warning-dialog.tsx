"use client";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, X, Upload } from "lucide-react";
import { formatBytes } from "@/lib/auth";
import type { FileMetadata } from "@/lib/api";

export interface DuplicateItem {
  file: File;
  hash: string;
  existingFile: FileMetadata;
  parentId?: string;
}

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateItem[];
  onUploadAnyway: () => void;
  onCancel: () => void;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  duplicates,
  onUploadAnyway,
  onCancel,
}: DuplicateWarningDialogProps) {
  if (duplicates.length === 0) return null;

  const single = duplicates.length === 1;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <AlertDialogTitle>
              {single ? "Duplicate File Detected" : `${duplicates.length} Duplicate Files Detected`}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {single
                  ? "A file with identical content already exists in your storage."
                  : "Files with identical content already exist in your storage."}
              </p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {duplicates.map((dup, i) => (
                  <div key={i} className="bg-muted p-3 rounded-md text-sm space-y-1">
                    <p className="font-medium truncate">{dup.file.name}</p>
                    <div className="text-muted-foreground space-y-0.5">
                      <p>
                        Matches: <span className="text-foreground">{dup.existingFile.name}</span>
                      </p>
                      <p>
                        Uploaded: {formatDate(dup.existingFile.created_at)}
                      </p>
                      <p>
                        Size: {formatBytes(dup.existingFile.size)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />
            {single ? "Cancel" : "Skip All"}
          </Button>
          <Button variant="default" onClick={onUploadAnyway}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Anyway
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
