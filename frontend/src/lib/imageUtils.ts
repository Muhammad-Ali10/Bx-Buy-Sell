const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/**
 * Turns stored image_path values into a browser-loadable URL.
 * External URLs (Cloudinary, etc.) are returned as-is.
 * Server-uploaded paths like /uploads/foo.png are prefixed with the API base URL.
 */
export function resolveImageUrl(path?: string | null): string {
  if (!path) return '';

  const trimmed = path.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }

  const base = API_BASE_URL.replace(/\/$/, '');
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${normalizedPath}`;
}
