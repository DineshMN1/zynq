"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  Search,
  FolderPlus,
  X,
  ChevronDown,
  Trash2,
  File as FileIcon,
  Folder,
  Link as LinkIcon,
} from "lucide-react";
import { fileApi, type FileMetadata, ApiError } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { FileGrid } from "@/features/file/components/file-grid";
import { FileBreadcrumb } from "@/features/file/components/file-breadcrumb";
import { CreateFolderDialog } from "@/features/file/components/create-folder-dialog";
import { PublicLinkDialog } from "@/features/share/components/public-link-dialog";
import { DuplicateWarningDialog } from "@/features/file/components/duplicate-warning-dialog";
import { DropZoneOverlay } from "@/features/file/components/drop-zone-overlay";
import { calculateContentHash } from "@/lib/file-hash";

interface UploadProgress {
  id: string;
  fileName: string;
  progress: number;
  status: "queued" | "uploading" | "completed" | "error" | "checking" | "duplicate";
}

let uploadIdCounter = 0;

export default function FilesPage() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [pathStack, setPathStack] = useState<
    { id: string | null; name: string }[]
  >([{ id: null, name: "Home" }]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateFiles, setDuplicateFiles] = useState<FileMetadata[]>([]);
  const [pendingUpload, setPendingUpload] = useState<{
    file: File;
    hash: string;
  } | null>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedId = useRef<string | null>(null);

  // Drag & drop state
  const [isDragActive, setIsDragActive] = useState(false);
  const dragCounter = useRef(0);

  const currentFolderId = pathStack[pathStack.length - 1]?.id;

  // Upload queue helpers
  const addUploadProgress = (fileName: string): string => {
    const id = `upload-${++uploadIdCounter}`;
    setUploadQueue((prev) => [
      ...prev,
      { id, fileName, progress: 0, status: "queued" },
    ]);
    return id;
  };

  const updateUploadProgress = (
    progressId: string,
    updates: Partial<Omit<UploadProgress, "id">>
  ) => {
    setUploadQueue((prev) =>
      prev.map((p) => (p.id === progressId ? { ...p, ...updates } : p))
    );
  };

  const removeUploadProgress = (progressId: string) => {
    setUploadQueue((prev) => prev.filter((p) => p.id !== progressId));
  };

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

  // Clear selection on folder navigation or search change
  useEffect(() => {
    setSelectedIds(new Set());
    lastClickedId.current = null;
  }, [currentFolderId, search]);

  // Ctrl+A keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        // Only capture if not inside an input/textarea
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setSelectedIds(new Set(files.map((f) => f.id)));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [files]);

  // Multi-select functions
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastClickedId.current = id;
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    lastClickedId.current = null;
  };

  const selectAll = () => {
    setSelectedIds(new Set(files.map((f) => f.id)));
  };

  // Card click handler: supports Shift+click for range, Ctrl+click for toggle, plain click for folder open
  const handleCardClick = (id: string, e: React.MouseEvent) => {
    // Shift+click: range selection
    if (e.shiftKey && lastClickedId.current) {
      const lastIdx = files.findIndex((f) => f.id === lastClickedId.current);
      const curIdx = files.findIndex((f) => f.id === id);
      if (lastIdx !== -1 && curIdx !== -1) {
        const start = Math.min(lastIdx, curIdx);
        const end = Math.max(lastIdx, curIdx);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) {
            next.add(files[i].id);
          }
          return next;
        });
        return;
      }
    }

    // Ctrl/Cmd+click: toggle single item
    if (e.ctrlKey || e.metaKey) {
      toggleSelect(id);
      return;
    }

    // Plain click: if it's a folder, open it; otherwise toggle select
    const file = files.find((f) => f.id === id);
    if (file?.is_folder) {
      handleOpenFolder(file);
    } else {
      toggleSelect(id);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const count = ids.length;
    if (
      !confirm(
        `Are you sure you want to move ${count} ${count === 1 ? "item" : "items"} to Trash?`
      )
    )
      return;

    try {
      await fileApi.bulkDelete(ids);
      setFiles((prev) => prev.filter((f) => !selectedIds.has(f.id)));
      setSelectedIds(new Set());
      toast({
        title: "Items deleted",
        description: `${count} ${count === 1 ? "item" : "items"} moved to trash.`,
      });
    } catch (error) {
      console.error("Bulk delete failed:", error);
      toast({
        title: "Error deleting files",
        description: "Unable to move files to trash.",
        variant: "destructive",
      });
    }
  };

  const handleBulkShare = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    let successCount = 0;
    let lastLink: string | null = null;

    for (const id of ids) {
      try {
        const res = await fileApi.share(id, {
          permission: "read",
          isPublic: true,
        });
        if (res.publicLink) {
          successCount++;
          lastLink = res.publicLink;
        }
      } catch (err) {
        console.error(`Failed to share ${id}:`, err);
      }
    }

    if (successCount === 1 && lastLink) {
      setPublicLink(lastLink);
    } else if (successCount > 0) {
      toast({
        title: "Links created",
        description: `Public links generated for ${successCount} ${successCount === 1 ? "item" : "items"}.`,
      });
    } else {
      toast({
        title: "Share failed",
        description: "Could not generate public links.",
        variant: "destructive",
      });
    }

    setSelectedIds(new Set());
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to move this item to Trash?")) return;
    try {
      await fileApi.delete(id);
      setFiles(files.filter((f) => f.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast({
        title: "Item deleted",
        description: "Moved to trash successfully.",
      });
    } catch (error) {
      console.error("Failed to move item to trash:", error);
      toast({
        title: "Error deleting item",
        description: "Unable to move item to trash.",
        variant: "destructive",
      });
    }
  };

  const handleUploadFileClick = () => fileInputRef.current?.click();
  const handleUploadFolderClick = () => folderInputRef.current?.click();

  const uploadFileWithProgress = (
    url: string,
    file: File,
    contentType: string,
    progressId: string
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let uploadComplete = false;

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          updateUploadProgress(progressId, { progress: percent });
          if (percent === 100) {
            uploadComplete = true;
          }
        }
      });

      xhr.upload.addEventListener("load", () => {
        uploadComplete = true;
        updateUploadProgress(progressId, { progress: 100 });
      });

      xhr.addEventListener("readystatechange", () => {
        if (xhr.readyState === 4) {
          if (
            xhr.status === 200 ||
            xhr.status === 204 ||
            (uploadComplete && xhr.status === 0)
          ) {
            updateUploadProgress(progressId, {
              progress: 100,
              status: "completed",
            });
            resolve();
          } else if (uploadComplete) {
            updateUploadProgress(progressId, {
              progress: 100,
              status: "completed",
            });
            resolve();
          } else {
            updateUploadProgress(progressId, { status: "error" });
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.send(file);
    });
  };

  const proceedWithUploadForId = async (
    file: File,
    fileHash: string,
    skipDuplicateCheck: boolean,
    progressId: string,
    targetParentId?: string
  ) => {
    updateUploadProgress(progressId, { status: "uploading", progress: 0 });

    const parentId = targetParentId ?? currentFolderId ?? undefined;

    const created = await fileApi.create({
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      parentId,
      isFolder: false,
      fileHash: skipDuplicateCheck ? undefined : fileHash,
    });

    if (created.uploadUrl) {
      await uploadFileWithProgress(
        created.uploadUrl,
        file,
        file.type || "application/octet-stream",
        progressId
      );
    } else {
      updateUploadProgress(progressId, { progress: 100, status: "completed" });
    }
  };

  // Multi-file upload with hash-based duplicate detection
  const uploadMultipleFiles = async (
    fileEntries: { file: File; parentId?: string }[]
  ) => {
    if (fileEntries.length === 0) return;

    const progressIds = fileEntries.map((entry) =>
      addUploadProgress(entry.file.name)
    );

    let uploaded = 0;
    let duplicatesSkipped = 0;
    let errors = 0;

    for (let i = 0; i < fileEntries.length; i++) {
      const { file, parentId } = fileEntries[i];
      const progressId = progressIds[i];

      try {
        // Calculate hash for duplicate detection
        updateUploadProgress(progressId, { status: "checking" });
        const fileHash = await calculateContentHash(file);

        // Try upload with hash - server will reject duplicates with 409
        await proceedWithUploadForId(file, fileHash, false, progressId, parentId);
        uploaded++;
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 409) {
          // Duplicate detected - mark and skip
          duplicatesSkipped++;
          updateUploadProgress(progressId, {
            status: "duplicate",
            progress: 100,
            fileName: `${file.name} (duplicate)`,
          });
        } else {
          errors++;
          console.error(`Failed to upload ${file.name}:`, err);
          updateUploadProgress(progressId, { status: "error" });
        }
      }
    }

    await loadFiles();

    // Summary toast
    const parts: string[] = [];
    if (uploaded > 0) parts.push(`${uploaded} uploaded`);
    if (duplicatesSkipped > 0) parts.push(`${duplicatesSkipped} duplicates skipped`);
    if (errors > 0) parts.push(`${errors} failed`);

    toast({
      title: "Upload complete",
      description: parts.join(", ") + ".",
      variant: errors > 0 && uploaded === 0 ? "destructive" : undefined,
    });

    // Auto-clear completed/duplicate items after 3s
    setTimeout(() => {
      setUploadQueue((prev) =>
        prev.filter(
          (p) =>
            !progressIds.includes(p.id) ||
            (p.status !== "completed" && p.status !== "error" && p.status !== "duplicate")
        )
      );
    }, 3000);
  };

  // Handles single file upload (with duplicate dialog for single file)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    // Multi-file upload: use bulk path with hash detection
    if (fileList.length > 1) {
      const entries = Array.from(fileList).map((file) => ({
        file,
        parentId: currentFolderId || undefined,
      }));
      await uploadMultipleFiles(entries);
      e.target.value = "";
      return;
    }

    // Single file: show duplicate dialog if conflict
    const file = fileList[0];
    let fileHash = "";
    const progressId = addUploadProgress(file.name);

    try {
      updateUploadProgress(progressId, { status: "checking" });
      fileHash = await calculateContentHash(file);

      await proceedWithUploadForId(file, fileHash, false, progressId);
      await loadFiles();
      toast({
        title: "Upload successful",
        description: `${file.name} uploaded.`,
      });

      setTimeout(() => removeUploadProgress(progressId), 2000);
    } catch (err) {
      console.error("File upload error:", err);

      if (err instanceof ApiError && err.statusCode === 409) {
        const duplicates = err.details?.duplicates || [];
        if (duplicates.length > 0) {
          setDuplicateFiles(duplicates);
          setPendingUpload({ file, hash: fileHash });
          setShowDuplicateDialog(true);
          removeUploadProgress(progressId);
          e.target.value = "";
          return;
        }
      }

      const errorMessage =
        err instanceof ApiError ? err.message : "Unable to upload this file.";
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
      updateUploadProgress(progressId, { status: "error" });
      setTimeout(() => removeUploadProgress(progressId), 3000);
    } finally {
      e.target.value = "";
    }
  };

  const handleDuplicateProceed = async () => {
    setShowDuplicateDialog(false);
    if (pendingUpload) {
      const progressId = addUploadProgress(pendingUpload.file.name);
      try {
        await proceedWithUploadForId(
          pendingUpload.file,
          pendingUpload.hash,
          true,
          progressId
        );
        await loadFiles();
        toast({
          title: "Upload successful",
          description: `${pendingUpload.file.name} uploaded.`,
        });
        setTimeout(() => removeUploadProgress(progressId), 2000);
      } catch (err) {
        const errorMessage =
          err instanceof ApiError ? err.message : "Unable to upload this file.";
        toast({
          title: "Upload failed",
          description: errorMessage,
          variant: "destructive",
        });
        updateUploadProgress(progressId, { status: "error" });
        setTimeout(() => removeUploadProgress(progressId), 3000);
      } finally {
        setPendingUpload(null);
        setDuplicateFiles([]);
      }
    }
  };

  const handleDuplicateCancel = () => {
    setShowDuplicateDialog(false);
    setPendingUpload(null);
    setDuplicateFiles([]);
    toast({
      title: "Upload cancelled",
      description: "File upload was cancelled to avoid duplicates.",
    });
  };

  // Find existing folder by name in a parent, returns its ID or undefined
  const findExistingFolderId = async (
    name: string,
    parentId?: string
  ): Promise<string | undefined> => {
    try {
      const res = await fileApi.list({
        page: 1,
        limit: 50,
        search: name,
        parentId,
      });
      const match = res.items.find(
        (f) => f.is_folder && f.name === name
      );
      return match?.id;
    } catch {
      return undefined;
    }
  };

  const handleFolderChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const allFiles = Array.from(fileList);

    // Extract unique folder paths from webkitRelativePath, sorted by depth
    const folderPaths = new Set<string>();
    for (const file of allFiles) {
      const relPath = file.webkitRelativePath;
      if (!relPath) continue;
      const parts = relPath.split("/");
      for (let i = 1; i < parts.length; i++) {
        folderPaths.add(parts.slice(0, i).join("/"));
      }
    }

    const sortedFolders = Array.from(folderPaths).sort((a, b) => {
      const depthA = a.split("/").length;
      const depthB = b.split("/").length;
      return depthA - depthB;
    });

    // Create folders sequentially, check for existing duplicates first
    const folderIdMap = new Map<string, string>();
    const baseParentId = currentFolderId || undefined;

    for (const folderPath of sortedFolders) {
      const parts = folderPath.split("/");
      const name = parts[parts.length - 1];
      const parentPath =
        parts.length > 1 ? parts.slice(0, -1).join("/") : null;
      const parentId = parentPath
        ? folderIdMap.get(parentPath)
        : baseParentId;

      // Check if folder with same name already exists in parent
      const existingId = await findExistingFolderId(name, parentId);
      if (existingId) {
        folderIdMap.set(folderPath, existingId);
        continue;
      }

      try {
        const created = await fileApi.create({
          name,
          size: 0,
          mimeType: "inode/directory",
          parentId,
          isFolder: true,
        });
        folderIdMap.set(folderPath, created.id);
      } catch (err) {
        console.error(`Failed to create folder ${folderPath}:`, err);
        toast({
          title: "Folder creation failed",
          description: `Could not create folder "${name}".`,
          variant: "destructive",
        });
      }
    }

    // Map each file to its parent folder ID
    const fileEntries: { file: File; parentId?: string }[] = allFiles.map(
      (file) => {
        const relPath = file.webkitRelativePath;
        const parts = relPath.split("/");
        const parentPath =
          parts.length > 1 ? parts.slice(0, -1).join("/") : null;
        const parentId = parentPath
          ? folderIdMap.get(parentPath)
          : baseParentId;
        return { file, parentId };
      }
    );

    await uploadMultipleFiles(fileEntries);
    await loadFiles();
    e.target.value = "";
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;

    // Check for existing folder with same name
    const existingId = await findExistingFolderId(
      folderName.trim(),
      currentFolderId || undefined
    );
    if (existingId) {
      toast({
        title: "Folder already exists",
        description: `A folder named "${folderName.trim()}" already exists here.`,
        variant: "destructive",
      });
      return;
    }

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

  // Drag & drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragActive(false);

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    const fileEntries = Array.from(droppedFiles).map((file) => ({
      file,
      parentId: currentFolderId || undefined,
    }));

    uploadMultipleFiles(fileEntries);
  };

  const allSelected =
    files.length > 0 && files.every((f) => selectedIds.has(f.id));
  const someSelected = selectedIds.size > 0;

  return (
    <>
      <div
        className="p-6 space-y-6 relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <DropZoneOverlay isActive={isDragActive} />

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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleUploadFileClick}>
                  <FileIcon className="mr-2 h-4 w-4" />
                  Upload Files
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleUploadFolderClick}>
                  <Folder className="mr-2 h-4 w-4" />
                  Upload Folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
            />
            <input
              type="file"
              ref={folderInputRef}
              onChange={handleFolderChange}
              className="hidden"
              {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
            />
          </div>
        </div>

        {/* Upload Progress Queue */}
        {uploadQueue.length > 0 && (
          <div className="space-y-2">
            {uploadQueue.map((item) => (
              <div
                key={item.id}
                className="bg-card border rounded-lg p-3 shadow-sm"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium truncate max-w-[200px]">
                      {item.fileName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {item.status === "completed"
                        ? "Completed"
                        : item.status === "error"
                          ? "Failed"
                          : item.status === "checking"
                            ? "Checking..."
                            : item.status === "queued"
                              ? "Queued"
                              : item.status === "duplicate"
                                ? "Skipped"
                                : `${item.progress}%`}
                    </span>
                    <button
                      onClick={() => removeUploadProgress(item.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <Progress
                  value={item.progress}
                  className={`h-1.5 ${
                    item.status === "error"
                      ? "[&>div]:bg-destructive"
                      : item.status === "completed"
                        ? "[&>div]:bg-green-500"
                        : item.status === "duplicate"
                          ? "[&>div]:bg-yellow-500"
                          : ""
                  }`}
                />
              </div>
            ))}
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

        {/* Selection Toolbar */}
        {someSelected && (
          <div className="flex items-center gap-4 bg-muted/50 border rounded-lg px-4 py-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => {
                if (checked) {
                  selectAll();
                } else {
                  clearSelection();
                }
              }}
            />
            <span className="text-sm font-medium">
              {selectedIds.size}{" "}
              {selectedIds.size === 1 ? "item" : "items"} selected
            </span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkShare}
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              Share Selected
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected
            </Button>
          </div>
        )}

        {/* Files Grid */}
        <FileGrid
          files={files}
          loading={loading}
          onOpenFolder={handleOpenFolder}
          onDelete={handleDelete}
          onShare={handlePublicShare}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onCardClick={handleCardClick}
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

        <DuplicateWarningDialog
          open={showDuplicateDialog}
          onOpenChange={setShowDuplicateDialog}
          fileName={pendingUpload?.file.name || ""}
          duplicateFiles={duplicateFiles}
          onProceed={handleDuplicateProceed}
          onCancel={handleDuplicateCancel}
        />
      </div>

      <ToastContainer />
    </>
  );
}
