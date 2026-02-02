/**
 * Computes SHA-256 hash of a file using Web Crypto API
 * @param file - File to hash
 * @returns Promise<string> - Hex-encoded SHA-256 hash
 */
export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
