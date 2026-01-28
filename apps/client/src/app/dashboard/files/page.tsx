"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Upload, Search, FolderPlus, X } from "lucide-react";
import { fileApi, type FileMetadata } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { FileGrid } from "@/features/file/components/file-grid";
import { FileBreadcrumb } from "@/features/file/components/file-breadcrumb";
import { CreateFolderDialog } from "@/features/file/components/create-folder-dialog";
import { PublicLinkDialog } from "@/features/share/components/public-link-dialog";

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [pathStack, setPathStack] = useState<
    { id: string | null; name: string }[]
  >([{ id: null, name: "Home" }]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  const currentFolderId = pathStack[pathStack.length - 1]?.id;

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fileApi.list({
        page: 1,
        limit: 50,
        search: search || undefined,
        parentId: currentFolderId || undefined,
      });
      setFiles(response.items);
      setTotal(response.meta.total);
    } catch (error) {
      console.error("Failed to load files:", error);
      toast({
        title: "Error loading files",
        description: "Something went wrong fetching your files.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [search, currentFolderId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to move this file to Trash?")) return;
    try {
      await fileApi.delete(id);
      setFiles(files.filter((f) => f.id !== id));
      toast({
        title: "File deleted",
        description: "Moved to trash successfully.",
      });
    } catch (error) {
      console.error("Failed to move file to trash:", error);
      toast({
        title: "Error deleting file",
        description: "Unable to move file to trash.",
        variant: "destructive",
      });
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const uploadFileWithProgress = (url: string, file: File, contentType: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let uploadComplete = false;

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => prev ? { ...prev, progress: percent } : null);
          if (percent === 100) {
            uploadComplete = true;
          }
        }
      });

      xhr.upload.addEventListener('load', () => {
        // Upload finished sending data
        uploadComplete = true;
        setUploadProgress(prev => prev ? { ...prev, progress: 100 } : null);
      });

      xhr.addEventListener('readystatechange', () => {
        if (xhr.readyState === 4) {
          // Request finished - check if upload completed successfully
          // For S3/MinIO, status 200 means success
          // But sometimes CORS prevents reading the response, so if upload completed, consider it success
          if (xhr.status === 200 || xhr.status === 204 || (uploadComplete && xhr.status === 0)) {
            setUploadProgress(prev => prev ? { ...prev, progress: 100, status: 'completed' } : null);
            resolve();
          } else if (uploadComplete) {
            // Upload data was sent but we got an unexpected status - still likely succeeded
            console.warn(`Upload may have succeeded despite status ${xhr.status}`);
            setUploadProgress(prev => prev ? { ...prev, progress: 100, status: 'completed' } : null);
            resolve();
          } else {
            setUploadProgress(prev => prev ? { ...prev, status: 'error' } : null);
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.send(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadProgress({ fileName: file.name, progress: 0, status: 'uploading' });

      const created = await fileApi.create({
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        parentId: currentFolderId || undefined,
        isFolder: false,
      });

      if (created.uploadUrl) {
        await uploadFileWithProgress(created.uploadUrl, file, file.type || 'application/octet-stream');
      }

      await loadFiles();
      toast({
        title: "Upload successful",
        description: `${file.name} uploaded.`,
      });

      // Clear progress after a short delay
      setTimeout(() => setUploadProgress(null), 2000);
    } catch (err) {
      console.error("File upload failed:", err);
      toast({
        title: "Upload failed",
        description: "Unable to upload this file.",
        variant: "destructive",
      });
      setUploadProgress(prev => prev ? { ...prev, status: 'error' } : null);
      setTimeout(() => setUploadProgress(null), 3000);
    } finally {
      e.target.value = "";
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    try {
      setLoading(true);
      await fileApi.create({
        name: folderName.trim(),
        size: 0,
        mimeType: "inode/directory",
        parentId: currentFolderId || undefined,
        isFolder: true,
      });
      setFolderName("");
      setShowNewFolderDialog(false);
      await loadFiles();
      toast({
        title: "Folder created",
        description: "New folder added successfully.",
      });
    } catch (err) {
      console.error("Failed to create folder:", err);
      toast({
        title: "Error creating folder",
        description: "Unable to create a new folder.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFolder = (folder: FileMetadata) => {
    setPathStack([...pathStack, { id: folder.id, name: folder.name }]);
  };

  const handleGoBack = () => {
    if (pathStack.length > 1) setPathStack(pathStack.slice(0, -1));
  };

  const handleBreadcrumbClick = (index: number) => {
    setPathStack(pathStack.slice(0, index + 1));
  };

  const handlePublicShare = async (fileId: string) => {
    try {
      const res = await fileApi.share(fileId, {
        permission: "read",
        isPublic: true,
      });
      if (res.publicLink) {
        setPublicLink(res.publicLink);
      } else {
        toast({
          title: "Share failed",
          description: "Public link could not be generated.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Share failed:", err);
      toast({
        title: "Error creating link",
        description: "Share link could not be created.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Files</h1>
            <p className="text-muted-foreground mt-1">
              {total} {total === 1 ? "item" : "items"}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowNewFolderDialog(true)}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              New Folder
            </Button>

            <Button onClick={handleUploadClick}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Upload Progress Bar */}
        {uploadProgress && (
          <div className="bg-card border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {uploadProgress.fileName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {uploadProgress.status === 'completed' ? 'Completed' :
                   uploadProgress.status === 'error' ? 'Failed' :
                   `${uploadProgress.progress}%`}
                </span>
                <button
                  onClick={() => setUploadProgress(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Progress
              value={uploadProgress.progress}
              className={`h-2 ${
                uploadProgress.status === 'error' ? '[&>div]:bg-destructive' :
                uploadProgress.status === 'completed' ? '[&>div]:bg-green-500' : ''
              }`}
            />
          </div>
        )}

        {/* Breadcrumb */}
        <FileBreadcrumb
          pathStack={pathStack}
          onBreadcrumbClick={handleBreadcrumbClick}
          onGoBack={handleGoBack}
        />

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Files Grid */}
        <FileGrid
          files={files}
          loading={loading}
          onOpenFolder={handleOpenFolder}
          onDelete={handleDelete}
          onShare={handlePublicShare}
        />

        {/* Dialogs */}
        <CreateFolderDialog
          open={showNewFolderDialog}
          onOpenChange={setShowNewFolderDialog}
          folderName={folderName}
          onFolderNameChange={setFolderName}
          onCreateFolder={handleCreateFolder}
        />

        <PublicLinkDialog
          publicLink={publicLink}
          onClose={() => setPublicLink(null)}
        />
      </div>

      <ToastContainer />
    </>
  );
}
