/**
 * Cloudinary Configuration and Upload Utility
 * 
 * IMPORTANT: For security, use unsigned uploads with an upload preset.
 * Create an upload preset in Cloudinary Dashboard -> Settings -> Upload -> Upload presets
 * Set it to "Unsigned" mode.
 */

// Cloudinary Configuration - Hardcoded
const CLOUDINARY_CLOUD_NAME = 'dtfwkgpcc';
const CLOUDINARY_API_KEY = '417686139724895';
// Upload preset name - MUST be created in Cloudinary Dashboard as "Unsigned"
// Go to: Settings -> Upload -> Upload presets -> Add upload preset
// Set name to: "frontend-unsigned" and Signing mode to "Unsigned"
const CLOUDINARY_UPLOAD_PRESET = 'frontend-unsigned';

// Log configuration on load
console.log('🔧 Cloudinary Configuration:', {
  cloudName: CLOUDINARY_CLOUD_NAME,
  uploadPreset: CLOUDINARY_UPLOAD_PRESET,
  apiKey: CLOUDINARY_API_KEY.substring(0, 5) + '...',
});

/**
 * Which kind of asset Cloudinary should store this as.
 *
 * Documents must be `raw`. Everything that was not an image used to be sent as
 * `auto`, and Cloudinary reads a PDF as an *image* — it can render pages — so
 * PDFs were stored and delivered through the image pipeline and came back as
 * something a PDF reader would not open. `raw` hands the bytes back exactly as
 * they arrived.
 */
function resourceTypeFor(file: File): 'image' | 'video' | 'raw' {
  const type = String(file.type || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  return 'raw';
}

/**
 * The name the file keeps: "P&L Statement 2024.xlsx" -> "P-L-Statement-2024.xlsx".
 *
 * Cloudinary needs a URL-safe id, so punctuation becomes a hyphen; beyond that
 * the seller's own name survives, because the last segment of the URL is what
 * every screen shows.
 *
 * Two rules about the extension, and getting them the wrong way round is what
 * produced "…-4j8pq3.pdf.pdf":
 *  - a `raw` asset has no separate format, so its id carries the extension;
 *  - an `image` or `video` id must not, because Cloudinary appends the format
 *    when it builds the URL — and an id ending in ".png" then became ".png.png".
 *
 * There is no random suffix here any more. It was guarding against one upload
 * overwriting another of the same name; that guard now lives in the folder, so
 * it protects the file without being read out as part of its name.
 */
function buildPublicId(fileName: string, keepExtension: boolean): string | null {
  const name = String(fileName || '').trim();
  if (!name) return null;

  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot + 1).toLowerCase() : '';

  const safeBase = base
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  if (!safeBase) return null;

  return keepExtension && ext ? `${safeBase}.${ext}` : safeBase;
}

/**
 * A folder nobody will collide in.
 *
 * Cloudinary overwrites when two uploads share a public id, so uploading a
 * second "Agreement.pdf" would silently replace the first. Giving each upload
 * its own folder keeps the names clean and still makes that impossible.
 */
function uniqueFolder(folder?: string): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return folder ? `${folder}/${suffix}` : suffix;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

/**
 * Upload a file directly to Cloudinary
 * @param file - The file to upload
 * @param folder - Optional folder path in Cloudinary (e.g., 'listings/photos', 'attachments')
 * @returns Promise with upload result containing the URL
 */
export async function uploadToCloudinary(
  file: File,
  folder?: string
): Promise<UploadResult> {
  try {
    // Validate file
    if (!file) {
      return {
        success: false,
        error: 'No file provided',
      };
    }

    /*
     * A backstop, not the rule.
     *
     * Every caller already enforces its own limit and says so in its own words
     * — 20 MB for proof of funds, 10 MB for attachments, 100 MB for video. This
     * used to refuse anything over 10 MB regardless, so a 15 MB bank statement
     * passed the check the buyer was shown and was then turned away here by a
     * number nothing on screen had mentioned.
     */
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        success: false,
        error: `File size exceeds maximum limit of ${maxSize / 1024 / 1024}MB`,
      };
    }

    // Create FormData for Cloudinary upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    const resourceType = resourceTypeFor(file);

    // Every upload gets its own folder, so the file itself can keep the name
    // the seller gave it without one upload ever replacing another.
    formData.append('folder', uniqueFolder(folder));

    // Keep the seller's own file name in the URL. Without this Cloudinary
    // invents a random id and the listing page shows "fgg8rbrwmxlnp7w6pjyg.xlsx"
    // instead of "P&L 2024.xlsx".
    const publicId = buildPublicId(file.name, resourceType === 'raw');
    if (publicId) {
      formData.append('public_id', publicId);
    }

    // Upload to Cloudinary using the standard upload endpoint
    // Format: https://api.cloudinary.com/v1_1/{cloud_name}/{resource_type}/upload
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

    console.log('Uploading to Cloudinary:', {
      url: uploadUrl,
      preset: CLOUDINARY_UPLOAD_PRESET,
      folder,
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size,
    });

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || 'Upload failed' };
      }
      
      console.error('Cloudinary upload error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        preset: CLOUDINARY_UPLOAD_PRESET,
      });
      
      // Provide helpful error messages
      let errorMessage = errorData.message || `Upload failed with status ${response.status}`;
      if (response.status === 400) {
        // Most common 400 error is missing or invalid upload preset
        if (errorData.message?.toLowerCase().includes('preset') || errorData.message?.toLowerCase().includes('invalid')) {
          errorMessage = `Upload preset "${CLOUDINARY_UPLOAD_PRESET}" not found. Please create an unsigned upload preset named "${CLOUDINARY_UPLOAD_PRESET}" in Cloudinary Dashboard (Settings -> Upload -> Upload presets). Set Signing mode to "Unsigned".`;
        } else {
          errorMessage = `Upload failed: ${errorData.message || 'Invalid upload preset. Please create an unsigned upload preset named "' + CLOUDINARY_UPLOAD_PRESET + '" in Cloudinary Dashboard.'}`;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    const data = await response.json();

    return {
      success: true,
      url: data.secure_url || data.url,
      publicId: data.public_id,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Upload multiple files to Cloudinary
 * @param files - Array of files to upload
 * @param folder - Optional folder path in Cloudinary
 * @param onProgress - Optional progress callback
 * @returns Promise with array of upload results
 */
export async function uploadMultipleToCloudinary(
  files: File[],
  folder?: string,
  onProgress?: (uploaded: number, total: number) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  let uploaded = 0;

  for (const file of files) {
    const result = await uploadToCloudinary(file, folder);
    results.push(result);
    
    uploaded++;
    if (onProgress) {
      onProgress(uploaded, files.length);
    }

    // If one upload fails, you might want to handle it
    if (!result.success) {
      console.error(`Failed to upload ${file.name}:`, result.error);
    }
  }

  return results;
}

/**
 * Delete a file from Cloudinary (requires signed requests - would need backend endpoint)
 * This is a placeholder - implement via backend API for security
 */
export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  // This should be done via a backend endpoint for security
  // as it requires the API secret
  console.warn('deleteFromCloudinary should be called via backend API');
  return false;
}
