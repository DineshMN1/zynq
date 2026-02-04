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
import { Folder, Upload, X } from "lucide-react";

interface FolderUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  fileCount: number;
  totalSize: string;
  destination: string;
  onUpload: () => void;
  onCancel: () => void;
}

export function FolderUploadDialog({
  open,
  onOpenChange,
  folderName,
  fileCount,
  totalSize,
  destination,
  onUpload,
  onCancel,
}: FolderUploadDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            <AlertDialogTitle>Upload Folder</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>You are about to upload a folder with the following details:</p>
              <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                <p>
                  <strong>Folder:</strong> {folderName}
                </p>
                <p>
                  <strong>Files:</strong> {fileCount} {fileCount === 1 ? "file" : "files"}
                </p>
                <p>
                  <strong>Total size:</strong> {totalSize}
                </p>
                <p>
                  <strong>Destination:</strong> {destination}
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button variant="default" onClick={onUpload}>
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
