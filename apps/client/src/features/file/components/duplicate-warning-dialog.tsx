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
import type { FileMetadata } from "@/lib/api";

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  existingFile?: FileMetadata;
  onUploadAnyway: () => void;
  onCancel: () => void;
}

/**
 * Formats a byte count into a human-readable string with appropriate unit.
 *
 * @param bytes - The size in bytes to format.
 * @returns A string like "1.23 MB", using Bytes, KB, MB, or GB and displaying up to two decimal places; returns "0 Bytes" when `bytes` is 0.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Formats a date string into a locale-specific date with year, short month, and day.
 *
 * @param dateString - A string parseable by the JavaScript `Date` constructor
 * @returns The date formatted according to the current locale with `year: "numeric"`, `month: "short"`, and `day: "numeric"`
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Renders a confirmation dialog warning that a file with identical content already exists and offers actions to cancel or proceed with the upload.
 *
 * @param open - Whether the dialog is visible
 * @param onOpenChange - Callback invoked when the dialog open state changes
 * @param fileName - Name of the file being uploaded
 * @param existingFile - Optional metadata for the existing file with identical content
 * @param onUploadAnyway - Callback invoked when the user confirms uploading despite the duplicate
 * @param onCancel - Callback invoked when the user cancels the upload
 * @returns The React element for the duplicate-file warning dialog
 */
export function DuplicateWarningDialog({
  open,
  onOpenChange,
  fileName,
  existingFile,
  onUploadAnyway,
  onCancel,
}: DuplicateWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <AlertDialogTitle>Duplicate File Detected</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                A file with identical content already exists in your storage.
              </p>
              {existingFile && (
                <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                  <p>
                    <strong>Existing file:</strong> {existingFile.name}
                  </p>
                  <p>
                    <strong>Uploaded:</strong> {formatDate(existingFile.created_at)}
                  </p>
                  <p>
                    <strong>Size:</strong> {formatBytes(existingFile.size)}
                  </p>
                </div>
              )}
              <p className="text-sm">
                <strong>New file:</strong> {fileName}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancel Upload
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