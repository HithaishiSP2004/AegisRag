import crypto from 'crypto';

/**
 * Normalizes text to ensure semantically identical content produces identical hashes:
 * - Trims leading and trailing whitespace
 * - Collapses repeated spaces, tabs, and carriage returns to a single space
 * - Normalizes line endings to \n and collapses repeated newlines to \n
 * - Converts the text to lowercase
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
    .toLowerCase();
}

/**
 * Computes the SHA-256 hash of a string.
 */
export function computeSHA256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}
