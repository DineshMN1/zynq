import {
  File,
  Folder,
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
  type LucideIcon,
} from "lucide-react";

export function getFileExtension(name: string): string {
  const parts = name.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return '';
}

export function getFileIcon(name: string, mimeType: string, isFolder: boolean): LucideIcon {
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

export function getIconColor(name: string, mimeType: string, isFolder: boolean): string {
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

export function getIconBgColor(name: string, mimeType: string, isFolder: boolean): string {
  if (isFolder) return "bg-amber-100 dark:bg-amber-900/30";

  const ext = getFileExtension(name);

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'heic', 'heif'].includes(ext) || mimeType.startsWith("image/"))
    return "bg-pink-100 dark:bg-pink-900/30";
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext) || mimeType.startsWith("video/"))
    return "bg-purple-100 dark:bg-purple-900/30";
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext) || mimeType.startsWith("audio/"))
    return "bg-green-100 dark:bg-green-900/30";
  if (ext === 'pdf' || mimeType.includes("pdf"))
    return "bg-red-100 dark:bg-red-900/30";
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext))
    return "bg-blue-100 dark:bg-blue-900/30";
  if (['ppt', 'pptx', 'odp'].includes(ext))
    return "bg-orange-100 dark:bg-orange-900/30";
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext) || mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return "bg-emerald-100 dark:bg-emerald-900/30";
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext) || mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar"))
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
