import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsIn,
  Max,
  Matches,
} from 'class-validator';

// Allowed MIME types for file uploads
const ALLOWED_MIME_TYPES = [
  // Folders
  'inode/directory',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/rtf',
  // Text
  'text/plain',
  'text/csv',
  'text/html',
  'text/css',
  'text/javascript',
  'text/markdown',
  'text/xml',
  'text/x-python',
  'text/x-c',
  'text/x-java-source',
  'text/tab-separated-values',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/gzip',
  'application/x-tar',
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/flac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/midi',
  'audio/x-midi',
  // Video
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/mpeg',
  'video/3gpp',
  // Data
  'application/json',
  'application/xml',
  'application/x-yaml',
  // Fonts
  'font/woff',
  'font/woff2',
  'font/ttf',
  'font/otf',
  // Application (additional)
  'application/x-httpd-php',
  'application/sql',
  'application/x-sql',
  'application/typescript',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/epub+zip',
  'application/x-bzip2',
  'application/x-iso9660-image',
  'application/wasm',
  // Others
  'application/octet-stream', // Generic binary - for unknown types
] as const;

// Blocked file extensions (security risk)
const BLOCKED_EXTENSIONS_REGEX =
  /\.(exe|bat|cmd|sh|ps1|vbs|vbe|js|jse|wsf|wsh|msc|pif|scr|reg|dll|com|msi|jar|hta|cpl|inf|lnk)$/i;

export class CreateFileDto {
  @IsString()
  @Matches(/^[^<>:"/\\|?*\x00-\x1f]+$/, {
    message: 'File name contains invalid characters',
  })
  @Matches(/^(?!\.\.)/, {
    message: 'File name cannot start with ..',
  })
  name: string;

  @IsNumber()
  @Max(5368709120, { message: 'File size cannot exceed 5GB' }) // 5GB max
  size: number;

  @IsString()
  @IsIn(ALLOWED_MIME_TYPES, { message: 'File type not allowed' })
  mimeType: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isFolder?: boolean;

  @IsOptional()
  @IsString()
  storagePath?: string;

  @IsOptional()
  @IsString()
  fileHash?: string;
}

export { ALLOWED_MIME_TYPES, BLOCKED_EXTENSIONS_REGEX };
