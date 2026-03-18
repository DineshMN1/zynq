import { FileIcon, defaultStyles } from 'react-file-icon';
import { Folder } from 'lucide-react';
import { getFileExtension } from '@/features/file/utils/file-icons';

/**
 * Color palette for file type categories.
 * Each entry maps to react-file-icon's color/labelColor props.
 */
const TYPE_COLORS: Record<string, { color: string; labelColor: string }> = {
  image:       { color: '#E91E63', labelColor: '#C2185B' },
  video:       { color: '#9C27B0', labelColor: '#7B1FA2' },
  audio:       { color: '#4CAF50', labelColor: '#388E3C' },
  pdf:         { color: '#F44336', labelColor: '#D32F2F' },
  document:    { color: '#2196F3', labelColor: '#1976D2' },
  presentation:{ color: '#FF9800', labelColor: '#F57C00' },
  spreadsheet: { color: '#4CAF50', labelColor: '#2E7D32' },
  archive:     { color: '#795548', labelColor: '#5D4037' },
  code:        { color: '#607D8B', labelColor: '#455A64' },
  config:      { color: '#78909C', labelColor: '#546E7A' },
  database:    { color: '#5C6BC0', labelColor: '#3949AB' },
  font:        { color: '#EC407A', labelColor: '#C2185B' },
  key:         { color: '#EF5350', labelColor: '#C62828' },
  executable:  { color: '#90A4AE', labelColor: '#607D8B' },
  '3d':        { color: '#26A69A', labelColor: '#00897B' },
  default:     { color: '#90A4AE', labelColor: '#607D8B' },
};

const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff','heic','heif','avif','raw']);
const VIDEO_EXTS = new Set(['mp4','avi','mkv','mov','wmv','flv','webm','m4v','3gp','mpg','mpeg','ts']);
const AUDIO_EXTS = new Set(['mp3','wav','ogg','flac','aac','m4a','wma','opus','aiff']);
const DOC_EXTS = new Set(['doc','docx','odt','rtf','pages']);
const SLIDE_EXTS = new Set(['ppt','pptx','odp','key']);
const SHEET_EXTS = new Set(['xls','xlsx','ods','csv','numbers']);
const ARCHIVE_EXTS = new Set(['zip','rar','7z','tar','gz','bz2','xz','zst','lz','cab','iso','dmg']);
const CODE_EXTS = new Set(['js','jsx','ts','tsx','py','java','c','cpp','h','hpp','cs','go','rs','rb','php','swift','kt','scala','vue','svelte','dart','lua','r','pl','sh','bash','zsh','fish','ps1','bat','cmd']);
const WEB_EXTS = new Set(['html','htm','css','scss','sass','less','xml','xsl']);
const CONFIG_EXTS = new Set(['json','yaml','yml','toml','ini','cfg','conf','env','gitignore','dockerignore','editorconfig','eslintrc','prettierrc','babelrc']);
const DB_EXTS = new Set(['sql','db','sqlite','sqlite3','mdb','accdb']);
const KEY_EXTS = new Set(['pem','key','crt','cer','p12','pfx','pub','gpg','asc']);
const EXE_EXTS = new Set(['exe','msi','app','deb','rpm','apk','ipa','snap','flatpak','appimage']);
const FONT_EXTS = new Set(['ttf','otf','woff','woff2','eot']);
const THREE_D_EXTS = new Set(['obj','fbx','stl','gltf','glb','3ds','blend','dae']);

function getCategory(ext: string): string {
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown' || ext === 'txt') return 'document';
  if (DOC_EXTS.has(ext)) return 'document';
  if (SLIDE_EXTS.has(ext)) return 'presentation';
  if (SHEET_EXTS.has(ext)) return 'spreadsheet';
  if (ARCHIVE_EXTS.has(ext)) return 'archive';
  if (CODE_EXTS.has(ext) || WEB_EXTS.has(ext)) return 'code';
  if (CONFIG_EXTS.has(ext)) return 'config';
  if (DB_EXTS.has(ext)) return 'database';
  if (KEY_EXTS.has(ext)) return 'key';
  if (EXE_EXTS.has(ext)) return 'executable';
  if (FONT_EXTS.has(ext)) return 'font';
  if (THREE_D_EXTS.has(ext)) return '3d';
  return 'default';
}

/** Folder color palette */
const FOLDER_COLORS: Record<string, string> = {
  light: '#FBC02D',
  dark: '#F9A825',
};

interface FileTypeIconProps {
  name: string;
  mimeType?: string;
  isFolder: boolean;
  /** Icon size in px (default 40) */
  size?: number;
  className?: string;
}

export function FileTypeIcon({
  name,
  isFolder,
  size = 40,
  className,
}: FileTypeIconProps) {
  if (isFolder) {
    return (
      <div className={className} style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Folder
          fill={FOLDER_COLORS.light}
          stroke={FOLDER_COLORS.dark}
          strokeWidth={1.5}
          style={{ width: size * 0.85, height: size * 0.85 }}
        />
      </div>
    );
  }

  const ext = getFileExtension(name);
  const category = getCategory(ext);
  const colors = TYPE_COLORS[category] ?? TYPE_COLORS.default;

  // Use react-file-icon's built-in styles if available, override with our colors
  const builtIn = (defaultStyles as Record<string, object>)[ext];

  return (
    <div className={className} style={{ width: size, height: size }}>
      <FileIcon
        extension={ext || '?'}
        {...builtIn}
        {...colors}
        glyphColor="white"
        labelTextColor="white"
        fold
        radius={4}
      />
    </div>
  );
}
