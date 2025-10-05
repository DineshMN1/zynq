"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Trash2,
  MoreVertical,
  RotateCcw,
  XCircle,
  Loader2,
  File,
  Folder,
} from "lucide-react";
import { fileApi, type FileMetadata } from "@/lib/api";
import { formatBytes } from "@/lib/auth";
import { motion } from "framer-motion";

export default function TrashPage() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrash();
  }, []);

  const loadTrash = async () => {
    try {
      setLoading(true);
      const response = await fileApi.trash({ page: 1, limit: 50 });
      setFiles(response.items);
    } catch (error) {
      console.error("Failed to load trash:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await fileApi.restore(id);
      loadTrash();
    } catch (error) {
      console.error("Failed to restore file:", error);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm("Permanently delete this file?")) return;
    try {
      await fileApi.permanentDelete(id);
      setFiles(files.filter((f) => f.id !== id)); // remove from UI instantly
    } catch (error) {
      console.error("Failed to permanently delete file:", error);
      alert("Error deleting file permanently");
    }
  };

  const handleEmptyTrash = async () => {
    if (
      !confirm(
        "Are you sure you want to empty the trash? This cannot be undone."
      )
    )
      return;
    try {
      await fileApi.emptyTrash();
      setFiles([]); // clear UI
    } catch (error) {
      console.error("Failed to empty trash:", error);
      alert("Error emptying trash");
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
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    {file.is_folder ? (
                      <Folder className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <File className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
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
                    {formatBytes(file.size)}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
