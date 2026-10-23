/**
 * ESC/POS Generator & High-Precision Monochrome Rasterizer for Thermal Printers
 * ══════════════════════════════════════════════════════════════════════════════
 * Standard: 80mm K80 (576 dots = 72 bytes/line)
 * Optimization:
 *   1. Hardware Thermal Heating Enhancement (ESC 7: 2500µs burn time, 500µs line interval)
 *   2. Reduced Motor Speed (ESC s 1, GS ( K fn 50: speed 1 for high precision & detail)
 *   3. Maximum Thermal Density (GS ( K fn 49: 130% density, DC2 # 31)
 *   4. High-Sensitivity Binary Thresholding (Captures full anti-aliased font contours)
 *   5. 8-Neighbor Morphological Micro-Hole Healing (Eliminates white specks & voids)
 *
 * Compatible with: EasyPrint ES-8803WA, Xprinter, Epson TM series, Star TSP
 */

// ─── ESC/POS Command Constants ───────────────────────────────────────────────
export const ESC_INIT = [0x1b, 0x40]; // ESC @ (Initialize printer)

// 1. ESC s n: Select printing speed (1 = lowest speed / highest thermal exposure / maximum detail)
export const ESC_SPEED_SLOW = [0x1b, 0x73, 0x01];

// 2. GS ( K fn 50: Select print speed (1 = slowest speed)
export const GS_SPEED_SLOW = [0x1d, 0x28, 0x4b, 0x02, 0x00, 0x32, 0x01];

// 3. GS ( K fn 49: Select print density (8 = 130% darkest density)
export const GS_DENSITY_MAX = [0x1d, 0x28, 0x4b, 0x02, 0x00, 0x31, 0x08];

// 4. DC2 # n: Thermal head density (0x1F = 31 = max saturation)
export const DC2_DENSITY_MAX = [0x12, 0x23, 0x1f];

// 5. ESC 7 n1 n2 n3: Set print heating parameters
// n1 = max heating dots: 20 (160 dots simultaneously, thick thermal coverage)
// n2 = heating time: 250 (2500 µs - extra long burn duration, making ink pitch-black)
// n3 = heating interval: 50 (500 µs pause between lines, physically slowing paper feed for sharp detail)
export const ESC_HEAT_DENSITY = [0x1b, 0x37, 20, 250, 50];

export const ESC_DRAWER_KICK = [0x1b, 0x70, 0x00, 0x19, 0xfa]; // ESC p 0 25 250 (Kick cash drawer)
export const GS_CUT_PARTIAL = [0x1d, 0x56, 0x42, 0x00]; // GS V 66 0 (Partial cut with feed)
export const ESC_FEED_LINES = (n = 3) => [0x1b, 0x64, n]; // ESC d n (Feed n lines)

// ─── K80 Constants ───────────────────────────────────────────────────────────
export const PRINT_WIDTH_DOTS = 576; // 80mm thermal paper = 576 dots
export const WIDTH_BYTES = 72;       // 576 / 8 = 72 bytes per line

/**
 * Convert Canvas to ESC/POS 1-bit Monochrome Raster (GS v 0)
 * Uses High-Sensitivity Contour Capture + 8-Neighbor Morphological Healing
 * to produce solid, pitch-black typography without any faded white dots or voids.
 *
 * @param {HTMLCanvasElement} sourceCanvas - Canvas rendered at 576px or higher
 * @param {Object} options
 * @param {boolean} [options.kickCashDrawer=true] - Send ESC p drawer kick command
 * @param {boolean} [options.cutPaper=true] - Send GS V partial cut command
 * @param {number} [options.luminanceThreshold=188] - Brightness cutoff (captures anti-aliasing pixels)
 * @param {boolean} [options.morphologicalHealing=true] - Heal micro-holes inside character loops
 * @param {number} [options.feedLines=4] - Lines to feed before cut
 * @returns {Uint8Array} Complete ESC/POS byte stream ready for TCP transmission
 */
export function canvasToEscPosRaster(sourceCanvas, {
  kickCashDrawer = true,
  cutPaper = true,
  luminanceThreshold = 188,
  morphologicalHealing = true,
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

  // ─── Step 3: High-Sensitivity Binary Thresholding ───────────────────
  // Text anti-aliasing produces pixels with luminance between 140 and 200.
  // By using threshold 188, we capture all anti-aliased edges as solid black,
  // completely eliminating white/faded gaps inside Lao letter loops and tone marks.
  const binaryGrid = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = (rowOffset + x) * 4;
      const alpha = pixels[idx + 3];
      if (alpha > 50) {
        // ITU-R BT.601 luminance calculation
        const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
        if (lum < luminanceThreshold) {
          binaryGrid[rowOffset + x] = 1; // Black thermal dot
        }
      }
    }
  }

  // ─── Step 4: 8-Neighbor Morphological Micro-Hole Healing ────────────
  // Fills microscopic voids inside character loops and tone mark stems.
  const finalGrid = new Uint8Array(width * height);
  if (morphologicalHealing) {
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      const prevRow = y > 0 ? (y - 1) * width : rowOffset;
      const nextRow = y < height - 1 ? (y + 1) * width : rowOffset;

      for (let x = 0; x < width; x++) {
        if (binaryGrid[rowOffset + x] === 1) {
          finalGrid[rowOffset + x] = 1;
          continue;
        }

        // Check horizontal & vertical sandwich
        const left = x > 0 ? binaryGrid[rowOffset + x - 1] : 0;
        const right = x < width - 1 ? binaryGrid[rowOffset + x + 1] : 0;
        const top = binaryGrid[prevRow + x];
        const bottom = binaryGrid[nextRow + x];

        if ((left === 1 && right === 1) || (top === 1 && bottom === 1)) {
          finalGrid[rowOffset + x] = 1;
          continue;
        }

        // Check diagonal sandwich for curved Lao glyphs
        const topLeft = x > 0 ? binaryGrid[prevRow + x - 1] : 0;
        const bottomRight = x < width - 1 ? binaryGrid[nextRow + x + 1] : 0;
        const topRight = x < width - 1 ? binaryGrid[prevRow + x + 1] : 0;
        const bottomLeft = x > 0 ? binaryGrid[nextRow + x - 1] : 0;

        if ((topLeft === 1 && bottomRight === 1) || (topRight === 1 && bottomLeft === 1)) {
          finalGrid[rowOffset + x] = 1;
        }
      }
    }
  } else {
    finalGrid.set(binaryGrid);
  }

  // ─── Step 5: Assemble ESC/POS Commands ──────────────────────────────
  const bytes = [];

  // ESC @: Initialize printer
  bytes.push(...ESC_INIT);

  // Apply speed reduction commands (allows heating head longer exposure per dot)
  bytes.push(...ESC_SPEED_SLOW);
  bytes.push(...GS_SPEED_SLOW);

  // Apply maximum thermal density commands (deep pitch-black saturation)
  bytes.push(...GS_DENSITY_MAX);
  bytes.push(...DC2_DENSITY_MAX);

  // ESC 7: Set physical heating parameters (2500µs heating duration, 500µs line delay)
  bytes.push(...ESC_HEAT_DENSITY);

  // ESC p: Kick cash drawer if enabled
  if (kickCashDrawer) {
    bytes.push(...ESC_DRAWER_KICK);
  }

  // ─── Step 6: Chunked GS v 0 Raster Bit Image ────────────────────────
  // Chunks of 128 lines provide smooth, steady motor movement without jitter
  const MAX_CHUNK_LINES = 128;
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
      const rowOffset = y * width;
      for (let byteX = 0; byteX < WIDTH_BYTES; byteX++) {
        let byteVal = 0;
        const basePixelX = byteX * 8;
        for (let bit = 0; bit < 8; bit++) {
          const pixelX = basePixelX + bit;
          if (pixelX < width && finalGrid[rowOffset + pixelX] === 1) {
            byteVal |= (0x80 >> bit); // MSB = leftmost pixel
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
