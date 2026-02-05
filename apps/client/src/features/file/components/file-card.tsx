"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Download,
  Trash2,
  File,
  Folder,
  Link as LinkIcon,
  Image,
  FileText,
  FileCode,
  FileArchive,
  FileAudio,
  FileVideo,
  FileSpreadsheet,
} from "lucide-react";
import { type FileMetadata, fileApi } from "@/lib/api";
import { formatBytes } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FileCardProps {
  file: FileMetadata;
  index: number;
  onOpenFolder: (folder: FileMetadata) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onCardClick?: (id: string, e: React.MouseEvent) => void;
}

/**
 * Selects the appropriate icon component for a file or folder based on its MIME type and folder status.
 *
 * @param mimeType - The file's MIME type string (e.g., "image/png", "application/pdf")
 * @param isFolder - When `true`, a folder icon is always returned regardless of `mimeType`
 * @returns The icon component corresponding to the file type (e.g., folder, image, video, audio, archive, spreadsheet, code, text, or a generic file icon)
 */
function getFileIcon(mimeType: string, isFolder: boolean) {
  if (isFolder) return Folder;

  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar") || mimeType.includes("gz"))
    return FileArchive;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return FileSpreadsheet;
  if (
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("json") ||
    mimeType.includes("html") ||
    mimeType.includes("css") ||
    mimeType.includes("xml")
  )
    return FileCode;
  if (mimeType.includes("text") || mimeType.includes("document") || mimeType.includes("word"))
    return FileText;

  return File;
}

/**
 * Selects a Tailwind CSS text color class for a file icon based on MIME type and folder status.
 *
 * @param mimeType - The file's MIME type used to determine the color.
 * @param isFolder - Whether the item is a folder; folders use an amber color scheme.
 * @returns The CSS text color classes for light and dark themes (e.g., `"text-pink-500 dark:text-pink-400"`).
 */
function getIconColor(mimeType: string, isFolder: boolean) {
  if (isFolder) return "text-amber-500 dark:text-amber-400";

  if (mimeType.startsWith("image/")) return "text-pink-500 dark:text-pink-400";
  if (mimeType.startsWith("video/")) return "text-purple-500 dark:text-purple-400";
  if (mimeType.startsWith("audio/")) return "text-green-500 dark:text-green-400";
  if (mimeType.includes("pdf")) return "text-red-500 dark:text-red-400";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar"))
    return "text-orange-500 dark:text-orange-400";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return "text-emerald-500 dark:text-emerald-400";
  if (mimeType.includes("javascript") || mimeType.includes("typescript") || mimeType.includes("json"))
    return "text-yellow-500 dark:text-yellow-400";

  return "text-blue-500 dark:text-blue-400";
}

/**
 * Selects the background color CSS classes for a file icon based on MIME type or folder status.
 *
 * @param mimeType - The file's MIME type (for example, "image/png" or "application/pdf")
 * @param isFolder - Whether the item represents a folder
 * @returns The Tailwind CSS class string to use as the icon background (includes dark-mode variant)
 */
function getIconBgColor(mimeType: string, isFolder: boolean) {
  if (isFolder) return "bg-amber-100 dark:bg-amber-900/30";

  if (mimeType.startsWith("image/")) return "bg-pink-100 dark:bg-pink-900/30";
  if (mimeType.startsWith("video/")) return "bg-purple-100 dark:bg-purple-900/30";
  if (mimeType.startsWith("audio/")) return "bg-green-100 dark:bg-green-900/30";
  if (mimeType.includes("pdf")) return "bg-red-100 dark:bg-red-900/30";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar"))
    return "bg-orange-100 dark:bg-orange-900/30";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return "bg-emerald-100 dark:bg-emerald-900/30";
  if (mimeType.includes("javascript") || mimeType.includes("typescript") || mimeType.includes("json"))
    return "bg-yellow-100 dark:bg-yellow-900/30";

  return "bg-blue-100 dark:bg-blue-900/30";
}

/**
 * Renders a file or folder card with icon, metadata, selection support, and an actions menu.
 *
 * The card displays an icon (derived from the file's mime type or folder state), file name, size,
 * and a Folder badge for folders. Actions available in the menu include download (files only),
 * get public link, and move to trash. If `onToggleSelect` is provided a selection checkbox is shown;
 * `onCardClick` takes precedence for clicks on the card, otherwise clicking a folder invokes `onOpenFolder`.
 *
 * @param file - File metadata to render (name, id, mime_type, size, is_folder, etc.).
 * @param index - Zero-based index used to stagger entrance animation.
 * @param onOpenFolder - Called when a folder card is opened.
 * @param onDelete - Called to request deleting (moving to trash) the file or folder; receives the item id.
 * @param onShare - Called to request a public link for the file; receives the item id.
 * @param isSelected - If true, the card is rendered in a selected state.
 * @param onToggleSelect - If provided, enables the selection checkbox and is called with the item id when toggled.
 * @param onCardClick - Optional custom click handler for the card; receives the item id and mouse event. If provided it is called instead of the default folder-opening behavior.
 * @returns A JSX element representing the interactive file or folder card.
 */
export function FileCard({
  file,
  index,
  onOpenFolder,
  onDelete,
  onShare,
  isSelected,
  onToggleSelect,
  onCardClick,
}: FileCardProps) {
  const handleDownload = async () => {
    try {
      const { blob, fileName } = await fileApi.download(file.id);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || file.name || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
      toast({
        title: "Error downloading",
        description: "Unable to download file.",
        variant: "destructive",
      });
    }
  };

  const hasSelect = !!onToggleSelect;
  const IconComponent = getFileIcon(file.mime_type, file.is_folder);
  const iconColor = getIconColor(file.mime_type, file.is_folder);
  const iconBgColor = getIconBgColor(file.mime_type, file.is_folder);

  const handleCardClick = (e: React.MouseEvent) => {
    if (onCardClick) {
      onCardClick(file.id, e);
      return;
    }
    if (file.is_folder) {
      onOpenFolder(file);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
    >
      <Card
        className={cn(
          "group relative p-4 transition-all duration-200 cursor-pointer",
          "hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5",
          "active:translate-y-0 active:shadow-sm",
          isSelected && "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20"
        )}
        onClick={handleCardClick}
      >
        {/* Selection checkbox overlay */}
        {hasSelect && (
          <div
            className={cn(
              "absolute top-3 left-3 z-10 transition-opacity duration-200",
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(file.id);
            }}
          >
            <div className="bg-background/80 backdrop-blur-sm rounded-md p-0.5">
              <Checkbox
                checked={isSelected}
                className="h-5 w-5 border-2"
                tabIndex={-1}
              />
            </div>
          </div>
        )}

        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center transition-transform duration-200",
              "group-hover:scale-105",
              iconBgColor
            )}>
              <IconComponent className={cn("h-6 w-6", iconColor)} />
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 transition-opacity duration-200",
                  "opacity-0 group-hover:opacity-100 focus:opacity-100"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {!file.is_folder && (
                <>
                  <DropdownMenuItem onClick={handleDownload} className="gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuItem onClick={() => onShare(file.id)} className="gap-2">
                <LinkIcon className="h-4 w-4" />
                Get Public Link
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => onDelete(file.id)}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Move to Trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-1.5">
          <p
            className="font-medium truncate text-sm leading-tight"
            title={file.name}
          >
            {file.name}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {formatBytes(file.size)}
            </p>
            {file.is_folder && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5 font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-0"
              >
                Folder
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}