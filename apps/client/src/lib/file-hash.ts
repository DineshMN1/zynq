/**
 * File hash calculation utility for content duplication detection
 * Supports: .txt, .docx, .json, .xml, .pdf and other file types
 */

/**
 * Compute the SHA-256 hash of a file's raw bytes and return it as a hexadecimal string.
 *
 * @returns The SHA-256 digest encoded as a lowercase hexadecimal `string`.
 * @throws If reading the file or computing the hash fails.
 */
export async function calculateFileHash(file: File): Promise<string> {
  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Calculate SHA-256 hash using Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  } catch (error) {
    console.error('Error calculating file hash:', error);
    throw new Error('Failed to calculate file hash');
  }
}

/**
 * Compute the SHA-256 hash of the provided text and return it as a hexadecimal string.
 *
 * @param text - Input text to hash (encoded as UTF-8)
 * @returns The SHA-256 digest of `text` represented as a lowercase hexadecimal string
 */
export async function calculateTextHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extracts textual content from supported file formats.
 *
 * For text-based MIME types (e.g., text/plain, application/json, application/xml, text/csv, text/html)
 * the file's text is returned. For binary or unsupported formats (for example PDFs or DOCX) this
 * function returns `null`.
 *
 * @param file - The file to extract text from
 * @returns The extracted text as a `string` when available, `null` when extraction is not supported
 */
export async function extractTextContent(file: File): Promise<string | null> {
  const fileType = file.type || getFileTypeFromExtension(file.name);

  // For simple text-based formats, read directly
  if (
    fileType === 'text/plain' ||
    fileType === 'application/json' ||
    fileType === 'application/xml' ||
    fileType === 'text/xml' ||
    fileType === 'text/csv' ||
    fileType === 'text/html'
  ) {
    return await file.text();
  }

  // For binary formats like .docx and .pdf, we'll use the raw file hash
  // In production, you'd want to use proper parsers to extract text
  return null;
}

/**
 * Determines the MIME type for a filename based on its extension.
 *
 * @param filename - The filename or path whose extension will be used to infer the MIME type
 * @returns The corresponding MIME type for the file extension, or `application/octet-stream` if unknown
 */
function getFileTypeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    'txt': 'text/plain',
    'json': 'application/json',
    'xml': 'application/xml',
    'csv': 'text/csv',
    'html': 'text/html',
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Compute a content hash for a file, preferring normalized text when available.
 *
 * Attempts to extract text from the provided file; if text is available it is normalized
 * (trimmed and line endings standardized) and hashed, otherwise the raw file bytes are hashed.
 *
 * @param file - The file whose content will be hashed; text extraction is attempted for text-based formats
 * @returns The SHA-256 hex digest representing the file's content (normalized text when applicable)
 */
export async function calculateContentHash(file: File): Promise<string> {
  // Try to extract text content for supported formats
  const textContent = await extractTextContent(file);

  if (textContent !== null) {
    // Normalize text: trim whitespace, normalize line endings
    const normalized = textContent.trim().replace(/\r\n/g, '\n');
    return calculateTextHash(normalized);
  }

  // For binary files or unsupported formats, hash the raw file
  return calculateFileHash(file);
}

/**
 * Convert a byte count into a human-readable file size string.
 *
 * @param bytes - The number of bytes to format (0 or greater)
 * @returns The formatted size using units `Bytes`, `KB`, `MB`, or `GB`, rounded to two decimal places
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format a Date or ISO date string into a human-readable en-US timestamp.
 *
 * @param date - The input date as a Date object or a date string parseable by Date
 * @returns A formatted date/time string like "Feb 5, 2026, 02:34 PM" (en-US, short month, numeric year/day, two-digit hour and minute)
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}