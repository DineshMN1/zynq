"use client";

import { Button } from "@/components/ui/button";
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
import { motion } from "framer-motion";

interface FileListRowProps {
  file: FileMetadata;
  index: number;
  onOpenFolder: (folder: FileMetadata) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onCardClick?: (id: string, e: React.MouseEvent) => void;
}

// Get file extension from name
function getFileExtension(name: string): string {
  const parts = name.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return '';
}

// Get appropriate icon based on file extension and mime type
function getFileIcon(name: string, mimeType: string, isFolder: boolean) {
  if (isFolder) return Folder;

  const ext = getFileExtension(name);

  switch (ext) {
    case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'svg': case 'bmp': case 'ico': case 'tiff': case 'heic': case 'heif':
      return ImageIcon;
    case 'mp4': case 'avi': case 'mkv': case 'mov': case 'wmv': case 'flv': case 'webm': case 'm4v':
      return Clapperboard;
    case 'mp3': case 'wav': case 'ogg': case 'flac': case 'aac': case 'm4a': case 'wma':
      return Music;
    case 'pdf':
      return FileText;
    case 'doc': case 'docx': case 'odt': case 'rtf':
      return FileType;
    case 'ppt': case 'pptx': case 'odp':
      return Presentation;
    case 'xls': case 'xlsx': case 'ods': case 'csv':
      return FileSpreadsheet;
    case 'txt': case 'md': case 'markdown':
      return FileText;
    case 'js': case 'jsx': case 'ts': case 'tsx': case 'py': case 'java': case 'c': case 'cpp': case 'h': case 'hpp': case 'cs': case 'go': case 'rs': case 'rb': case 'php': case 'swift': case 'kt': case 'scala': case 'vue': case 'svelte':
      return FileCode;
    case 'html': case 'htm': case 'css': case 'scss': case 'sass': case 'less':
      return FileCode;
    case 'json':
      return FileJson;
    case 'xml': case 'yaml': case 'yml': case 'toml':
      return FileCog;
    case 'zip': case 'rar': case '7z': case 'tar': case 'gz': case 'bz2': case 'xz':
      return FileArchive;
    case 'sql': case 'db': case 'sqlite': case 'mdb':
      return Database;
    case 'obj': case 'fbx': case 'stl': case 'gltf': case 'glb':
      return Box;
    case 'pem': case 'key': case 'crt': case 'cer': case 'p12': case 'pfx':
      return FileKey;
    case 'exe': case 'msi': case 'dmg': case 'app': case 'deb': case 'rpm': case 'apk': case 'ipa':
      return FileX;
    case 'env': case 'gitignore': case 'dockerignore': case 'editorconfig':
      return FileCog;
    default:
      break;
  }

  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar") || mimeType.includes("gz"))
    return FileArchive;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return FileSpreadsheet;
  if (mimeType.includes("javascript") || mimeType.includes("typescript") || mimeType.includes("json") || mimeType.includes("html") || mimeType.includes("css") || mimeType.includes("xml"))
    return FileCode;
  if (mimeType.includes("text") || mimeType.includes("document") || mimeType.includes("word"))
    return FileText;

  return File;
}

// Get icon color based on file type
function getIconColor(name: string, mimeType: string, isFolder: boolean) {
  if (isFolder) return "text-amber-500 dark:text-amber-400";

  const ext = getFileExtension(name);

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'heic', 'heif'].includes(ext) || mimeType.startsWith("image/"))
    return "text-pink-500 dark:text-pink-400";
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext) || mimeType.startsWith("video/"))
    return "text-purple-500 dark:text-purple-400";
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext) || mimeType.startsWith("audio/"))
    return "text-green-500 dark:text-green-400";
  if (ext === 'pdf' || mimeType.includes("pdf"))
    return "text-red-500 dark:text-red-400";
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext))
    return "text-blue-500 dark:text-blue-400";
  if (['ppt', 'pptx', 'odp'].includes(ext))
    return "text-orange-500 dark:text-orange-400";
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext) || mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return "text-emerald-500 dark:text-emerald-400";
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext) || mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar"))
    return "text-amber-600 dark:text-amber-500";
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext))
    return "text-yellow-500 dark:text-yellow-400";
  if (ext === 'py')
    return "text-blue-400 dark:text-blue-300";
  if (['java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'vue', 'svelte'].includes(ext))
    return "text-cyan-500 dark:text-cyan-400";
  if (['html', 'htm', 'css', 'scss', 'sass', 'less'].includes(ext))
    return "text-orange-400 dark:text-orange-300";
  if (ext === 'json')
    return "text-yellow-600 dark:text-yellow-500";
  if (['xml', 'yaml', 'yml', 'toml', 'env', 'gitignore', 'dockerignore', 'editorconfig'].includes(ext))
    return "text-slate-500 dark:text-slate-400";
  if (['sql', 'db', 'sqlite', 'mdb'].includes(ext))
    return "text-indigo-500 dark:text-indigo-400";
  if (['pem', 'key', 'crt', 'cer', 'p12', 'pfx'].includes(ext))
    return "text-rose-500 dark:text-rose-400";
  if (['exe', 'msi', 'dmg', 'app', 'deb', 'rpm', 'apk', 'ipa'].includes(ext))
    return "text-gray-500 dark:text-gray-400";
  if (['txt', 'md', 'markdown'].includes(ext))
    return "text-gray-600 dark:text-gray-400";

  return "text-blue-500 dark:text-blue-400";
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export function FileListRow({
  file,
  index,
  onOpenFolder,
  onDelete,
  onShare,
  isSelected,
  onToggleSelect,
  onCardClick,
}: FileListRowProps) {
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

  const handleRowClick = (e: React.MouseEvent) => {
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      className={cn(
        "flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors",
        "hover:bg-muted/50",
        isSelected && "bg-primary/5"
      )}
      onClick={handleRowClick}
    >
      {/* Checkbox */}
      {hasSelect && (
        <div
          className="w-8 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(file.id);
          }}
        >
          <Checkbox
            checked={isSelected}
            className="h-4 w-4"
            tabIndex={-1}
          />
        </div>
      )}
      {!hasSelect && <div className="w-8" />}

      {/* Name with icon */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <IconComponent className={cn("h-5 w-5 shrink-0", iconColor)} />
        <span className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </span>
      </div>

      {/* Size */}
      <div className="hidden sm:block w-24 text-right text-sm text-muted-foreground">
        {file.is_folder ? "—" : formatBytes(file.size)}
      </div>

      {/* Modified */}
      <div className="hidden md:block w-32 text-right text-sm text-muted-foreground">
        {file.updated_at ? formatDate(file.updated_at) : "—"}
      </div>

      {/* Actions */}
      <div className="w-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
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
    </motion.div>
  );
}
