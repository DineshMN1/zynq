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
  FileJson,
  FileType,
  Presentation,
  Database,
  FileKey,
  FileX,
  FileCog,
  Box,
  Clapperboard,
  Music,
  ImageIcon,
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
 * Extracts the lowercase file extension from a filename or path.
 *
 * @param name - The filename or path to inspect (for example, "photo.jpg" or "archive.tar.gz")
 * @returns The extension after the last dot in lowercase (for example, "jpg" or "gz"), or an empty string if none.
 */
function getFileExtension(name: string): string {
  const parts = name.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return '';
}

/**
 * Selects an appropriate Lucide icon component for a file or folder.
 *
 * Prefers a mapping based on the file name extension, falls back to MIME-type checks,
 * and returns a generic file icon when no specific match is found.
 *
 * @param name - The file name (used to extract the extension)
 * @param mimeType - The file's MIME type (used as a fallback when extension is not decisive)
 * @param isFolder - Whether the item is a folder; folders always return the folder icon
 * @returns The icon component that best represents the file or folder type
 */
function getFileIcon(name: string, mimeType: string, isFolder: boolean) {
  if (isFolder) return Folder;

  const ext = getFileExtension(name);

  // Check by extension first for more accurate icons
  switch (ext) {
    // Images
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'ico':
    case 'tiff':
    case 'heic':
    case 'heif':
      return ImageIcon;

    // Videos
    case 'mp4':
    case 'avi':
    case 'mkv':
    case 'mov':
    case 'wmv':
    case 'flv':
    case 'webm':
    case 'm4v':
      return Clapperboard;

    // Audio
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'flac':
    case 'aac':
    case 'm4a':
    case 'wma':
      return Music;

    // Documents
    case 'pdf':
      return FileText;
    case 'doc':
    case 'docx':
    case 'odt':
    case 'rtf':
      return FileType;
    case 'ppt':
    case 'pptx':
    case 'odp':
      return Presentation;
    case 'xls':
    case 'xlsx':
    case 'ods':
    case 'csv':
      return FileSpreadsheet;
    case 'txt':
    case 'md':
    case 'markdown':
      return FileText;

    // Code
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'py':
    case 'java':
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
    case 'cs':
    case 'go':
    case 'rs':
    case 'rb':
    case 'php':
    case 'swift':
    case 'kt':
    case 'scala':
    case 'vue':
    case 'svelte':
      return FileCode;
    case 'html':
    case 'htm':
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return FileCode;
    case 'json':
      return FileJson;
    case 'xml':
    case 'yaml':
    case 'yml':
    case 'toml':
      return FileCog;

    // Archives
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
    case 'bz2':
    case 'xz':
      return FileArchive;

    // Database
    case 'sql':
    case 'db':
    case 'sqlite':
    case 'mdb':
      return Database;

    // 3D / Models
    case 'obj':
    case 'fbx':
    case 'stl':
    case 'gltf':
    case 'glb':
      return Box;

    // Security / Keys
    case 'pem':
    case 'key':
    case 'crt':
    case 'cer':
    case 'p12':
    case 'pfx':
      return FileKey;

    // Executables / Binaries
    case 'exe':
    case 'msi':
    case 'dmg':
    case 'app':
    case 'deb':
    case 'rpm':
    case 'apk':
    case 'ipa':
      return FileX;

    // Config files
    case 'env':
    case 'gitignore':
    case 'dockerignore':
    case 'editorconfig':
      return FileCog;

    default:
      break;
  }

  // Fallback to mime type
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
 * Determine Tailwind text color classes for a file or folder icon.
 *
 * Uses the file name extension and MIME type to choose an appropriate color.
 *
 * @param name - The file's name (used to derive the extension)
 * @param mimeType - The file's MIME type (used as a fallback when extension is inconclusive)
 * @param isFolder - Whether the item is a folder; folders receive a folder-specific color
 * @returns A string containing Tailwind text color classes (for example: "text-blue-500 dark:text-blue-400")
 */
function getIconColor(name: string, mimeType: string, isFolder: boolean) {
  if (isFolder) return "text-amber-500 dark:text-amber-400";

  const ext = getFileExtension(name);

  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'heic', 'heif'].includes(ext) ||
      mimeType.startsWith("image/"))
    return "text-pink-500 dark:text-pink-400";

  // Videos
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext) ||
      mimeType.startsWith("video/"))
    return "text-purple-500 dark:text-purple-400";

  // Audio
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext) ||
      mimeType.startsWith("audio/"))
    return "text-green-500 dark:text-green-400";

  // PDF
  if (ext === 'pdf' || mimeType.includes("pdf"))
    return "text-red-500 dark:text-red-400";

  // Documents
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext))
    return "text-blue-500 dark:text-blue-400";

  // Presentations
  if (['ppt', 'pptx', 'odp'].includes(ext))
    return "text-orange-500 dark:text-orange-400";

  // Spreadsheets
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext) ||
      mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return "text-emerald-500 dark:text-emerald-400";

  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext) ||
      mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar"))
    return "text-amber-600 dark:text-amber-500";

  // Code - JavaScript/TypeScript
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext))
    return "text-yellow-500 dark:text-yellow-400";

  // Code - Python
  if (ext === 'py')
    return "text-blue-400 dark:text-blue-300";

  // Code - Other
  if (['java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'vue', 'svelte'].includes(ext))
    return "text-cyan-500 dark:text-cyan-400";

  // Web
  if (['html', 'htm', 'css', 'scss', 'sass', 'less'].includes(ext))
    return "text-orange-400 dark:text-orange-300";

  // JSON
  if (ext === 'json')
    return "text-yellow-600 dark:text-yellow-500";

  // Config
  if (['xml', 'yaml', 'yml', 'toml', 'env', 'gitignore', 'dockerignore', 'editorconfig'].includes(ext))
    return "text-slate-500 dark:text-slate-400";

  // Database
  if (['sql', 'db', 'sqlite', 'mdb'].includes(ext))
    return "text-indigo-500 dark:text-indigo-400";

  // Security
  if (['pem', 'key', 'crt', 'cer', 'p12', 'pfx'].includes(ext))
    return "text-rose-500 dark:text-rose-400";

  // Executables
  if (['exe', 'msi', 'dmg', 'app', 'deb', 'rpm', 'apk', 'ipa'].includes(ext))
    return "text-gray-500 dark:text-gray-400";

  // Text
  if (['txt', 'md', 'markdown'].includes(ext))
    return "text-gray-600 dark:text-gray-400";

  return "text-blue-500 dark:text-blue-400";
}

/**
 * Selects a Tailwind background color class based on the file name, MIME type, or folder state.
 *
 * @param name - The file name (used to derive the extension)
 * @param mimeType - The file's MIME type (used as a fallback when extension is inconclusive)
 * @param isFolder - Whether the item is a folder; folders receive a distinct background
 * @returns A Tailwind background color string appropriate for the detected file type (for example: `bg-pink-100 dark:bg-pink-900/30`)
 */
function getIconBgColor(name: string, mimeType: string, isFolder: boolean) {
  if (isFolder) return "bg-amber-100 dark:bg-amber-900/30";

  const ext = getFileExtension(name);

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'heic', 'heif'].includes(ext) ||
      mimeType.startsWith("image/"))
    return "bg-pink-100 dark:bg-pink-900/30";

  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext) ||
      mimeType.startsWith("video/"))
    return "bg-purple-100 dark:bg-purple-900/30";

  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext) ||
      mimeType.startsWith("audio/"))
    return "bg-green-100 dark:bg-green-900/30";

  if (ext === 'pdf' || mimeType.includes("pdf"))
    return "bg-red-100 dark:bg-red-900/30";

  if (['doc', 'docx', 'odt', 'rtf'].includes(ext))
    return "bg-blue-100 dark:bg-blue-900/30";

  if (['ppt', 'pptx', 'odp'].includes(ext))
    return "bg-orange-100 dark:bg-orange-900/30";

  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext) ||
      mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return "bg-emerald-100 dark:bg-emerald-900/30";

  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext) ||
      mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar"))
    return "bg-amber-100 dark:bg-amber-900/30";

  if (['js', 'jsx', 'ts', 'tsx', 'json'].includes(ext))
    return "bg-yellow-100 dark:bg-yellow-900/30";

  if (['py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'vue', 'svelte', 'html', 'htm', 'css', 'scss', 'sass', 'less'].includes(ext))
    return "bg-cyan-100 dark:bg-cyan-900/30";

  if (['sql', 'db', 'sqlite', 'mdb'].includes(ext))
    return "bg-indigo-100 dark:bg-indigo-900/30";

  if (['pem', 'key', 'crt', 'cer', 'p12', 'pfx'].includes(ext))
    return "bg-rose-100 dark:bg-rose-900/30";

  return "bg-blue-100 dark:bg-blue-900/30";
}

/**
 * Renders an interactive card representing a file or folder, including type-specific iconography, name, size/badge, optional selection checkbox, and a contextual action menu.
 *
 * The card supports opening folders, downloading files, sharing (get public link), and moving items to trash. When a download fails, a destructive toast notification is shown.
 *
 * @returns A React element that displays the file/folder card with its actions and selection UI.
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
  const IconComponent = getFileIcon(file.name, file.mime_type, file.is_folder);
  const iconColor = getIconColor(file.name, file.mime_type, file.is_folder);
  const iconBgColor = getIconBgColor(file.name, file.mime_type, file.is_folder);

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