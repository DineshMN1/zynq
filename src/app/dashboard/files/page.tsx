"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  Upload,
  Search,
  FolderPlus,
  MoreVertical,
  Download,
  Trash2,
  File,
  Folder,
  Loader2,
  Link as LinkIcon,
  ChevronRight,
  Home,
  ArrowLeft,
  Copy,
} from "lucide-react";

import { fileApi, type FileMetadata } from "@/lib/api";
import { formatBytes } from "@/lib/auth";

/* ---------------- TOAST SYSTEM INLINE ---------------- */
import * as React from "react";

type ToastVariant = "default" | "destructive";
interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}
const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 3000;

let toastCount = 0;
let memoryState: ToastProps[] = [];
const listeners: Array<(toasts: ToastProps[]) => void> = [];

function useToastInternal() {
  const [toasts, setToasts] = React.useState<ToastProps[]>(memoryState);
  React.useEffect(() => {
    listeners.push(setToasts);
    return () => {
      const index = listeners.indexOf(setToasts);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);
  return { toasts };
}

function showToast(toast: Omit<ToastProps, "id">) {
  const id = (++toastCount).toString();
  const newToast = { id, ...toast };
  memoryState = [newToast, ...memoryState].slice(0, TOAST_LIMIT);
  listeners.forEach((listener) => listener(memoryState));
  setTimeout(() => dismissToast(id), TOAST_REMOVE_DELAY);
}

function dismissToast(id: string) {
  memoryState = memoryState.filter((t) => t.id !== id);
  listeners.forEach((listener) => listener(memoryState));
}

function ToastContainer() {
  const { toasts } = useToastInternal();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-md shadow-md px-4 py-3 border text-sm ${
            t.variant === "destructive"
              ? "bg-red-600 text-white border-red-700"
              : "bg-background border-muted"
          }`}
        >
          {t.title && <div className="font-semibold">{t.title}</div>}
          {t.description && (
            <div className="text-xs opacity-80">{t.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- FILES PAGE START ---------------- */

export default function FilesPage() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pathStack, setPathStack] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "Home" },
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [publicLink, setPublicLink] = useState<string | null>(null);

  const currentFolderId = pathStack[pathStack.length - 1]?.id;

  useEffect(() => {
    loadFiles();
  }, [page, search, currentFolderId]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const response = await fileApi.list({
        page,
        limit: 50,
        search: search || undefined,
        parentId: currentFolderId || undefined,
      });
      setFiles(response.items);
      setTotal(response.meta.total);
    } catch (error) {
      console.error("Failed to load files:", error);
      showToast({
        title: "Error loading files",
        description: "Something went wrong fetching your files.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to move this file to Trash?")) return;
    try {
      await fileApi.delete(id);
      setFiles(files.filter((f) => f.id !== id));
      showToast({ title: "File deleted", description: "Moved to trash successfully." });
    } catch (error) {
      console.error("Failed to move file to trash:", error);
      showToast({
        title: "Error deleting file",
        description: "Unable to move file to trash.",
        variant: "destructive",
      });
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const created = await fileApi.create({
        name: file.name,
        size: file.size,
        mimeType: file.type,
        parentId: currentFolderId || undefined,
        isFolder: false,
      });

      if (created.uploadUrl) {
        await fetch(created.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
      }

      await loadFiles();
      showToast({ title: "Upload successful", description: `${file.name} uploaded.` });
    } catch (err) {
      console.error("File upload failed:", err);
      showToast({
        title: "Upload failed",
        description: "Unable to upload this file.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
      showToast({
        title: "Folder created",
        description: "New folder added successfully.",
      });
    } catch (err) {
      console.error("Failed to create folder:", err);
      showToast({
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
        showToast({
          title: "Share failed",
          description: "Public link could not be generated.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Share failed:", err);
      showToast({
        title: "Error creating link in http",
        description: "Not a Secure link could not be created.",
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
            <Button variant="outline" onClick={() => setShowNewFolderDialog(true)}>
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

        {/* Breadcrumb */}
        <div className="flex items-center text-sm text-muted-foreground gap-1">
          {pathStack.map((folder, i) => (
            <span key={i} className="flex items-center">
              <button
                onClick={() => handleBreadcrumbClick(i)}
                className="hover:text-primary transition-colors"
              >
                {i === 0 ? <Home className="inline h-4 w-4 mr-1" /> : folder.name}
              </button>
              {i < pathStack.length - 1 && (
                <ChevronRight className="h-4 w-4 mx-1 opacity-60" />
              )}
            </span>
          ))}
        </div>

        {pathStack.length > 1 && (
          <Button variant="ghost" size="sm" onClick={handleGoBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        )}

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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : files.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <File className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No files here</h3>
                <p className="text-sm text-muted-foreground">This folder is empty</p>
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
                <Card
                  className="p-4 hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => file.is_folder && handleOpenFolder(file)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      {file.is_folder ? (
                        <Folder className="h-5 w-5 text-primary" />
                      ) : (
                        <File className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!file.is_folder && (
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                const res = await fileApi.download(file.id);
                                if (res.url) {
                                  const response = await fetch(res.url);
                                  const blob = await response.blob();
                                  const blobUrl =
                                    window.URL.createObjectURL(blob);

                                  const a = document.createElement("a");
                                  a.href = blobUrl;
                                  a.download = file.name || "download";
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  window.URL.revokeObjectURL(blobUrl);
                                } else {
                                  showToast({
                                    title: "Download failed",
                                    description: "File URL not available.",
                                    variant: "destructive",
                                  });
                                }
                              } catch (err) {
                                console.error("Download failed:", err);
                                showToast({
                                  title: "Error downloading",
                                  description: "Unable to download file.",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem
                          onClick={() => handlePublicShare(file.id)}
                        >
                          <LinkIcon className="mr-2 h-4 w-4" />
                          Get Public Link
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => handleDelete(file.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div>
                    <p className="font-medium truncate" title={file.name}>
                      {file.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                      </p>
                      {file.is_folder && (
                        <Badge variant="secondary" className="text-xs">
                          Folder
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* --- Create Folder Dialog --- */}
        <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>
                Enter a name for your new folder.
              </DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowNewFolderDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateFolder}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- Public Link Dialog --- */}
        <Dialog open={!!publicLink} onOpenChange={() => setPublicLink(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Public Share Link</DialogTitle>
              <DialogDescription>
                Copy and share this link with others.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-md">
              <Input value={publicLink || ""} readOnly className="text-sm" />
              <Button
                size="icon"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(publicLink || "");
                  showToast({ title: "Copied to clipboard!" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Toast Renderer */}
      <ToastContainer />
    </>
  );
}
