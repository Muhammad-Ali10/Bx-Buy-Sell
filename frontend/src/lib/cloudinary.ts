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

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
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
    
    // Add folder if specified
    if (folder) {
      formData.append('folder', folder);
    }

    // Determine resource type based on file type
    // For images: use 'image', for PDFs and other files: use 'raw' or 'auto' (auto detects)
    const isImage = file.type.startsWith('image/');
    const resourceType = isImage ? 'image' : 'auto'; // 'auto' automatically detects file type

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
