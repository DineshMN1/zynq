/**
 * File hash calculation utility for content duplication detection
 * Supports: .txt, .docx, .json, .xml, .pdf and other file types
 */

/**
 * Calculate SHA-256 hash of a file
 * Works with any file type by reading raw bytes
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
 * Calculate hash for text content
 * Useful for extracting text from documents before hashing
 */
export async function calculateTextHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract text content from supported document formats
 * For advanced parsing of .docx and .pdf, this is a basic implementation
 * Production apps should use libraries like mammoth.js for .docx or pdf.js for .pdf
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
 * Get MIME type from file extension
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
 * Calculate content hash with optional text extraction
 * For text-based files, normalizes content before hashing
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
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format date for display
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
