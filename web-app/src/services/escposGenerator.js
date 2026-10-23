/**
 * ESC/POS Generator & High-Precision Monochrome Rasterizer for Thermal Printers
 * ══════════════════════════════════════════════════════════════════════════════
 * Standard: 80mm K80 (576 dots = 72 bytes/line)
 * Algorithm: Floyd-Steinberg Error Diffusion Dithering + BT.601 Grayscale Luminance
 * Compatible with: EasyPrint ES-8803WA, Xprinter, Epson TM series, Star TSP
 */

// ─── ESC/POS Command Constants ───────────────────────────────────────────────
export const ESC_INIT = [0x1b, 0x40]; // ESC @ (Initialize printer)
export const ESC_HEAT_DENSITY = [0x1b, 0x37, 0x07, 0xff, 0x0a]; // ESC 7 (Max thermal heating for pitch-black print)
export const ESC_DRAWER_KICK = [0x1b, 0x70, 0x00, 0x19, 0xfa]; // ESC p 0 25 250 (Kick cash drawer)
export const GS_CUT_PARTIAL = [0x1d, 0x56, 0x42, 0x00]; // GS V 66 0 (Partial cut with feed)
export const ESC_FEED_LINES = (n = 3) => [0x1b, 0x64, n]; // ESC d n (Feed n lines)

// ─── K80 Constants ───────────────────────────────────────────────────────────
export const PRINT_WIDTH_DOTS = 576; // 80mm thermal paper = 576 dots
export const WIDTH_BYTES = 72;       // 576 / 8 = 72 bytes per line

/**
 * Convert Canvas to ESC/POS 1-bit Monochrome Raster (GS v 0)
 * Uses Floyd-Steinberg Error Diffusion Dithering to preserve fine rounded loops,
 * tone marks, and smooth anti-aliased curves of Lao (Phetsarath OT) and Vietnamese.
 *
 * @param {HTMLCanvasElement} sourceCanvas - Canvas rendered at 576px or higher
 * @param {Object} options
 * @param {boolean} [options.kickCashDrawer=true] - Send ESC p drawer kick command
 * @param {boolean} [options.cutPaper=true] - Send GS V partial cut command
 * @param {number} [options.luminanceThreshold=145] - Brightness cutoff (default 145)
 * @param {boolean} [options.useDithering=true] - Floyd-Steinberg dithering flag
 * @param {number} [options.feedLines=4] - Lines to feed before cut
 * @returns {Uint8Array} Complete ESC/POS byte stream ready for TCP transmission
 */
export function canvasToEscPosRaster(sourceCanvas, {
  kickCashDrawer = true,
  cutPaper = true,
  luminanceThreshold = 145,
  useDithering = true,
  feedLines = 4,
} = {}) {
  if (!sourceCanvas) {
    throw new Error('Canvas element is required for ESC/POS rasterization');
  }

  // ─── Step 1: Ensure exact 576px width ───────────────────────────────
  let canvas = sourceCanvas;
  if (sourceCanvas.width !== PRINT_WIDTH_DOTS) {
    const scale = PRINT_WIDTH_DOTS / sourceCanvas.width;
    const scaledHeight = Math.max(1, Math.round(sourceCanvas.height * scale));
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = PRINT_WIDTH_DOTS;
    scaledCanvas.height = scaledHeight;
    const sCtx = scaledCanvas.getContext('2d');
    sCtx.imageSmoothingEnabled = true;
    sCtx.imageSmoothingQuality = 'high';
    sCtx.fillStyle = '#ffffff';
    sCtx.fillRect(0, 0, PRINT_WIDTH_DOTS, scaledHeight);
    sCtx.drawImage(sourceCanvas, 0, 0, PRINT_WIDTH_DOTS, scaledHeight);
    canvas = scaledCanvas;
  }

  // ─── Step 2: Extract raw RGBA pixel data ────────────────────────────
  const width = canvas.width; // 576
  const height = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  // ─── Step 3: Convert to Grayscale Float32Array ───────────────────────
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const alpha = pixels[idx + 3];
    if (alpha < 128) {
      gray[i] = 255.0; // Transparent background is treated as white
    } else {
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      // ITU-R BT.601 standard luminance calculation
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }

  // ─── Step 4: Floyd-Steinberg Dithering to Binary Array ───────────────
  // 1 = Black dot (burn thermal element), 0 = White (no burn)
  const binary = new Uint8Array(width * height);

  if (useDithering) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const oldVal = gray[idx];
        const newVal = oldVal < luminanceThreshold ? 0.0 : 255.0;
        binary[idx] = newVal === 0.0 ? 1 : 0;
        const err = oldVal - newVal;

        // Distribute error to neighboring pixels
        // (x+1, y)   += err * 7/16
        // (x-1, y+1) += err * 3/16
        // (x,   y+1) += err * 5/16
        // (x+1, y+1) += err * 1/16
        if (x + 1 < width) {
          gray[idx + 1] += (err * 7) / 16;
        }
        if (y + 1 < height) {
          if (x > 0) {
            gray[(y + 1) * width + (x - 1)] += (err * 3) / 16;
          }
          gray[(y + 1) * width + x] += (err * 5) / 16;
          if (x + 1 < width) {
            gray[(y + 1) * width + (x + 1)] += (err * 1) / 16;
          }
        }
      }
    }
  } else {
    for (let i = 0; i < width * height; i++) {
      binary[i] = gray[i] < luminanceThreshold ? 1 : 0;
    }
  }

  // ─── Step 5: Assemble ESC/POS Commands ──────────────────────────────
  const bytes = [];

  // ESC @: Initialize printer
  bytes.push(...ESC_INIT);

  // ESC 7: Set thermal heating parameters for high contrast & dark black dots
  bytes.push(...ESC_HEAT_DENSITY);

  // ESC p: Kick cash drawer if enabled
  if (kickCashDrawer) {
    bytes.push(...ESC_DRAWER_KICK);
  }

  // ─── Step 6: Chunked GS v 0 Raster Bit Image ────────────────────────
  // Max 256 lines per chunk to avoid printer buffer overflow
  const MAX_CHUNK_LINES = 256;
  let currentY = 0;

  while (currentY < height) {
    const chunkHeight = Math.min(MAX_CHUNK_LINES, height - currentY);

    // GS v 0 header: 0x1D 0x76 0x30 0x00 xL xH yL yH
    const xL = WIDTH_BYTES & 0xff;        // 72
    const xH = (WIDTH_BYTES >> 8) & 0xff; // 0
    const yL = chunkHeight & 0xff;
    const yH = (chunkHeight >> 8) & 0xff;

    bytes.push(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH);

    for (let y = currentY; y < currentY + chunkHeight; y++) {
      for (let byteX = 0; byteX < WIDTH_BYTES; byteX++) {
        let byteVal = 0;
        for (let bit = 0; bit < 8; bit++) {
          const pixelX = byteX * 8 + bit;
          if (pixelX < width) {
            if (binary[y * width + pixelX] === 1) {
              byteVal |= (0x80 >> bit); // MSB = leftmost pixel
            }
          }
        }
        bytes.push(byteVal);
      }
    }

    currentY += chunkHeight;
  }

  // ─── Step 7: Feed paper past cutter & cut ───────────────────────────
  bytes.push(...ESC_FEED_LINES(feedLines));

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

  // Set alignment center (ESC a 1)
  bytes.push(0x1b, 0x61, 0x01);
  const encoder = new TextEncoder();
  bytes.push(...encoder.encode('MEIISHOP POS\n'));
  bytes.push(...encoder.encode('RECEIPT\n\n'));

  // Left align (ESC a 0)
  bytes.push(0x1b, 0x61, 0x00);
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
 * Processes in 8KB chunks to avoid call stack size limits
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
