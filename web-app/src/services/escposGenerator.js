/**
 * ESC/POS Generator & Monochrome Rasterizer for Thermal Printers
 * ═══════════════════════════════════════════════════════════════
 * Standard: 80mm K80 (Physical Width: 576 dots = 72 bytes/line)
 * Protocol: GS v 0 (Raster Bit Image)
 *
 * Super-Sampling Engine:
 *  - Supports 2X Super-Sampled Canvases (1152px):
 *    Employs 2x2 Sub-pixel Box Area Downsampling with Adaptive Stroke Recovery.
 *    Captures micro-curves of Lao & Vietnamese vowels without pixelation (vỡ hạt)
 *    and prevents thin diagonal strokes from dropping (đứt nét).
 *  - Native 1:1 fallback for standard 576px buffers.
 *
 * Compatible with: EasyPrint ES-8803WA, Xprinter, Epson TM-series, Star TSP
 */

// ─── ESC/POS Command Constants ───────────────────────────────────────────────
export const ESC_INIT = [0x1b, 0x40]; // ESC @ (Initialize printer)
export const ESC_DRAWER_KICK = [0x1b, 0x70, 0x00, 0x19, 0xfa]; // ESC p 0 25 250 (Kick cash drawer)
export const GS_CUT_PARTIAL = [0x1d, 0x56, 0x42, 0x00]; // GS V 66 0 (Partial cut with feed)
export const ESC_FEED_LINES = (n = 3) => [0x1b, 0x64, n]; // ESC d n (Feed n lines)

// ─── K80 Thermal Constants ───────────────────────────────────────────────────
const PRINT_WIDTH_DOTS = 576; // 80mm thermal paper = 576 physical dots
const WIDTH_BYTES = 72;       // 576 / 8 = 72 bytes per scanline

/**
 * Convert Canvas to ESC/POS 1-bit Monochrome Raster (GS v 0)
 *
 * When sourceCanvas has width === 1152 (2x Super-sampled):
 *   Uses 2x2 Sub-pixel Box Downsampler with Sub-pixel Stroke Recovery.
 *   Each 576-dot thermal line is computed from a 2-line scan in the 1152px buffer.
 *
 * When sourceCanvas has width === 576:
 *   Uses 1:1 pixel sampling with calibrated luminance threshold.
 *
 * @param {HTMLCanvasElement} sourceCanvas Input canvas (576px or 1152px)
 * @param {Object} options
 * @param {boolean} [options.kickCashDrawer=true] Send cash drawer kick command
 * @param {boolean} [options.cutPaper=true] Send paper cut command
 * @param {number} [options.luminanceThreshold=148] Luminance threshold (0-255)
 * @returns {Uint8Array} Complete ESC/POS byte stream ready for TCP transmission
 */
export function canvasToEscPosRaster(sourceCanvas, {
  kickCashDrawer = true,
  cutPaper = true,
  luminanceThreshold = 148,
} = {}) {
  let canvas = sourceCanvas;

  // If canvas is neither 576 nor 1152, scale to 1152 with high-quality smoothing
  if (sourceCanvas.width !== 576 && sourceCanvas.width !== 1152) {
    const scale = 1152 / sourceCanvas.width;
    const scaledHeight = Math.round(sourceCanvas.height * scale);
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = 1152;
    scaledCanvas.height = scaledHeight;
    const sCtx = scaledCanvas.getContext('2d');
    sCtx.imageSmoothingEnabled = true;
    sCtx.imageSmoothingQuality = 'high';
    sCtx.fillStyle = '#ffffff';
    sCtx.fillRect(0, 0, 1152, scaledHeight);
    sCtx.drawImage(sourceCanvas, 0, 0, 1152, scaledHeight);
    canvas = scaledCanvas;
  }

  const isSuperSampled = canvas.width === 1152;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const srcWidth = canvas.width;
  const srcHeight = canvas.height;
  const imgData = ctx.getImageData(0, 0, srcWidth, srcHeight);
  const pixels = imgData.data;

  // Physical target dots
  const targetDotsH = isSuperSampled ? Math.floor(srcHeight / 2) : srcHeight;

  const bytes = [];

  // ESC @ Initialize printer
  bytes.push(...ESC_INIT);

  // Cash Drawer Kick (before print)
  if (kickCashDrawer) {
    bytes.push(...ESC_DRAWER_KICK);
  }

  // Convert to 1-bit bitmap, chunked GS v 0 (Max 256 physical scanlines per chunk)
  const MAX_CHUNK_LINES = 256;
  let currentDotY = 0;

  while (currentDotY < targetDotsH) {
    const chunkHeight = Math.min(MAX_CHUNK_LINES, targetDotsH - currentDotY);

    // GS v 0 header: 0x1D 0x76 0x30 0x00 xL xH yL yH
    const xL = WIDTH_BYTES & 0xff;        // 72
    const xH = (WIDTH_BYTES >> 8) & 0xff; // 0
    const yL = chunkHeight & 0xff;
    const yH = (chunkHeight >> 8) & 0xff;

    bytes.push(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH);

    // Rasterize scanlines
    for (let dotY = currentDotY; dotY < currentDotY + chunkHeight; dotY++) {
      if (isSuperSampled) {
        // ─── 2x2 Sub-pixel Box Area Downsampler ───
        const row0 = dotY * 2;
        const row1 = row0 + 1;

        for (let byteX = 0; byteX < WIDTH_BYTES; byteX++) {
          let byteVal = 0;
          for (let bit = 0; bit < 8; bit++) {
            const dotX = byteX * 8 + bit; // 0..575
            const px0 = dotX * 2;         // 0..1150
            const px1 = px0 + 1;          // 1..1151

            const idx00 = (row0 * srcWidth + px0) * 4;
            const idx01 = (row0 * srcWidth + px1) * 4;
            const idx10 = (row1 * srcWidth + px0) * 4;
            const idx11 = (row1 * srcWidth + px1) * 4;

            // Extract luminance with alpha consideration
            const a00 = pixels[idx00 + 3];
            const l00 = a00 < 30 ? 255 : (pixels[idx00] * 0.299 + pixels[idx00 + 1] * 0.587 + pixels[idx00 + 2] * 0.114);

            const a01 = pixels[idx01 + 3];
            const l01 = a01 < 30 ? 255 : (pixels[idx01] * 0.299 + pixels[idx01 + 1] * 0.587 + pixels[idx01 + 2] * 0.114);

            const a10 = pixels[idx10 + 3];
            const l10 = a10 < 30 ? 255 : (pixels[idx10] * 0.299 + pixels[idx10 + 1] * 0.587 + pixels[idx10 + 2] * 0.114);

            const a11 = pixels[idx11 + 3];
            const l11 = a11 < 30 ? 255 : (pixels[idx11] * 0.299 + pixels[idx11 + 1] * 0.587 + pixels[idx11 + 2] * 0.114);

            // 1. Average luminance across 2x2 sub-pixel window
            const lAvg = (l00 + l01 + l10 + l11) * 0.25;

            // 2. Minimum luminance (detects fine strokes crossing the sub-pixel window)
            const lMin = Math.min(l00, l01, l10, l11);

            // 3. Count of dark sub-pixels
            let darkCount = 0;
            if (l00 < 165) darkCount++;
            if (l01 < 165) darkCount++;
            if (l10 < 165) darkCount++;
            if (l11 < 165) darkCount++;

            // Adaptive Sub-Pixel Stroke Preservation:
            // - Average luminance is dark (< 175)
            // - OR at least 2 subpixels are covered (>= 50% dot coverage)
            // - OR a prominent stroke passes through (< 95) with at least 1 subpixel covered
            const isBlack = (lAvg < 175) || (darkCount >= 2) || (lMin < 95 && darkCount >= 1);

            if (isBlack) {
              byteVal |= (0x80 >> bit);
            }
          }
          bytes.push(byteVal);
        }
      } else {
        // ─── 1:1 Pixel Sampling Fallback (for 576px canvas) ───
        for (let byteX = 0; byteX < WIDTH_BYTES; byteX++) {
          let byteVal = 0;
          for (let bit = 0; bit < 8; bit++) {
            const pixelX = byteX * 8 + bit;
            if (pixelX < srcWidth) {
              const idx = (dotY * srcWidth + pixelX) * 4;
              const r = pixels[idx];
              const g = pixels[idx + 1];
              const b = pixels[idx + 2];
              const a = pixels[idx + 3];

              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              if (a > 64 && lum < luminanceThreshold) {
                byteVal |= (0x80 >> bit);
              }
            }
          }
          bytes.push(byteVal);
        }
      }
    }

    currentDotY += chunkHeight;
  }

  // Feed 3 lines to clear thermal print head
  bytes.push(...ESC_FEED_LINES(3));

  // Partial paper cut
  if (cutPaper) {
    bytes.push(...GS_CUT_PARTIAL);
  }

  return new Uint8Array(bytes);
}

/**
 * Fallback Text-only ESC/POS builder (for standard ASCII / Latin / numbers)
 */
export function buildTextEscPosReceipt(receipt, { kickCashDrawer = true, cutPaper = true } = {}) {
  const bytes = [];
  bytes.push(...ESC_INIT);
  if (kickCashDrawer) bytes.push(...ESC_DRAWER_KICK);

  bytes.push(0x1b, 0x61, 0x01); // Center align
  const encoder = new TextEncoder();
  bytes.push(...encoder.encode('MEIISHOP POS\n'));
  bytes.push(...encoder.encode('RECEIPT\n\n'));

  bytes.push(0x1b, 0x61, 0x00); // Left align
  const dateStr = receipt?.createdAt ? new Date(receipt.createdAt).toLocaleString() : new Date().toLocaleString();
  bytes.push(...encoder.encode(`Date: ${dateStr}\n`));
  bytes.push(...encoder.encode(`Customer: ${receipt?.customerName || 'General'}\n`));
  bytes.push(...encoder.encode('--------------------------------\n'));

  bytes.push(...ESC_FEED_LINES(4));
  if (cutPaper) bytes.push(...GS_CUT_PARTIAL);

  return new Uint8Array(bytes);
}

/**
 * Convert Uint8Array to Base64 string for Capacitor plugin transfer
 */
export function uint8ArrayToBase64(uint8) {
  let binary = '';
  const len = uint8.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = uint8.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

export default {
  canvasToEscPosRaster,
  buildTextEscPosReceipt,
  uint8ArrayToBase64,
  ESC_INIT,
  ESC_DRAWER_KICK,
  GS_CUT_PARTIAL,
  ESC_FEED_LINES,
};
