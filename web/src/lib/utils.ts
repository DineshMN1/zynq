import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const KNOWN_MIME_PREFIXES = [
  'image/', 'video/', 'audio/', 'text/', 'application/',
  'font/', 'model/', 'chemical/', 'x-conference/', 'message/',
  'multipart/', 'inode/',
];

export function getSafeMimeType(file: File): string {
  const type = file.type;
  if (!type) return 'application/octet-stream';
  if (KNOWN_MIME_PREFIXES.some((p) => type.startsWith(p))) return type;
  return 'application/octet-stream';
}
