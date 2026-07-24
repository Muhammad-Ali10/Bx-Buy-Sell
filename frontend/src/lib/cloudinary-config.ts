/**
 * Cloudinary Configuration
 * Used for initializing Cloudinary instance for image display/transformation
 */

import { Cloudinary } from '@cloudinary/url-gen';

// Cloudinary instance for image display and transformation
export const cld = new Cloudinary({ 
  cloud: { 
    cloudName: 'dtfwkgpcc' 
  } 
});

// Export cloud name for use in other components
export const CLOUDINARY_CLOUD_NAME = 'dtfwkgpcc';

