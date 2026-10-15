/**
 * High-efficiency client-side image compression utility for MeiiShop POS
 * Reduces images (e.g., 5MB phone photos) down to ~15KB - 40KB WebP/JPEG
 * to prevent filling up Supabase Storage while maintaining crisp display quality.
 */

export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Compresses an image file in the browser using HTML5 Canvas.
 * @param {File|Blob} file - The raw input file from input[type=file]
 * @param {Object} options - Compression options
 * @param {number} [options.maxWidth=600] - Maximum width in pixels
 * @param {number} [options.maxHeight=600] - Maximum height in pixels
 * @param {number} [options.quality=0.75] - Compression quality (0.1 to 1.0)
 * @param {string} [options.mimeType='image/webp'] - Target format ('image/webp' or 'image/jpeg')
 * @returns {Promise<{ blob: Blob, dataUrl: string, originalSize: number, compressedSize: number, savedPercent: number, fileName: string }>}
 */
export async function compressProductImage(file, options = {}) {
  const {
    maxWidth = 600,
    maxHeight = 600,
    quality = 0.75,
    mimeType = 'image/webp',
  } = options;

  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('ໄຟລ໌ທີ່ເລືອກບໍ່ແມ່ນຮູບພາບ (File is not an image)'));
    }

    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = (err) => reject(err);
      img.onload = () => {
        // Calculate new dimensions preserving aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        // Draw onto canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        // Smooth scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // White background in case of transparent PNG converted to WebP/JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // Check if WebP is supported by browser canvas
        let targetMime = mimeType;
        const testDataUrl = canvas.toDataURL('image/webp');
        if (!testDataUrl.startsWith('data:image/webp')) {
          targetMime = 'image/jpeg';
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('ການບີບອັດຮູບພາບຜິດພາດ (Canvas toBlob failed)'));
            }

            const dataUrl = canvas.toDataURL(targetMime, quality);
            const originalSize = file.size;
            const compressedSize = blob.size;
            const savedPercent = Math.max(
              0,
              Math.round(((originalSize - compressedSize) / originalSize) * 100)
            );

            // Generate clean extension
            const ext = targetMime === 'image/webp' ? 'webp' : 'jpg';
            const baseName = (file.name || 'product')
              .replace(/\.[^/.]+$/, '')
              .replace(/[^a-zA-Z0-9_-]/g, '_');
            const compressedFileName = `${baseName}_min.${ext}`;

            resolve({
              blob,
              dataUrl,
              originalSize,
              compressedSize,
              savedPercent,
              fileName: compressedFileName,
              mimeType: targetMime,
              width,
              height,
            });
          },
          targetMime,
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
