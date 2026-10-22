/**
 * ESC/POS Generator & Monochrome Rasterizer for Thermal Printers
 * ═══════════════════════════════════════════════════════════════
 * HARDCODED: 80mm K80 Standard (576 dots = 72 bytes/line)
 * Protocol: GS v 0 (Raster Bit Image)
 * Luminance: BT.601 (0.299R + 0.587G + 0.114B)
 *
 * Compatible with: EasyPrint ES-8803WA, Xprinter, Epson TM-series, Star TSP
 */

// ─── ESC/POS Command Constants ───────────────────────────────────────────────
export const ESC_INIT = [0x1b, 0x40]; // ESC @ (Initialize printer)
export const ESC_DRAWER_KICK = [0x1b, 0x70, 0x00, 0x19, 0xfa]; // ESC p 0 25 250 (Kick cash drawer)
export const GS_CUT_PARTIAL = [0x1d, 0x56, 0x42, 0x00]; // GS V 66 0 (Partial cut with feed)
export const ESC_FEED_LINES = (n = 3) => [0x1b, 0x64, n]; // ESC d n (Feed n lines)

// ─── Hardcoded K80 Constants ─────────────────────────────────────────────────
const PRINT_WIDTH_DOTS = 576;    // 80mm thermal paper = 576 dots
const WIDTH_BYTES = 72;          // 576 / 8 = 72 bytes per line

/**
 * Convert Canvas to ESC/POS 1-bit Monochrome Raster (GS v 0)
 *
 * CRITICAL: The input canvas MUST be exactly 576px wide.
 * If sourceCanvas.width !== 576, it will be scaled to 576px using
 * nearest-neighbor interpolation (no anti-aliasing) to preserve sharp text edges.
 *
 * Algorithm:
 *   1. Ensure canvas is exactly 576px wide
 *   2. Extract pixel data via getImageData
 *   3. For each pixel row, pack 8 pixels into 1 byte (MSB = leftmost pixel)
 *   4. Pixel is BLACK (bit=1) if: alpha > 128 AND luminance < threshold
 *   5. Split into chunks of max 256 lines to avoid printer buffer overflow
 *   6. Each chunk gets its own GS v 0 header
 *
 * @param {HTMLCanvasElement} sourceCanvas - Canvas rendered at 576px width
 * @param {Object} options
 * @param {boolean} [options.kickCashDrawer=true] - Send ESC p drawer kick command
 * @param {boolean} [options.cutPaper=true] - Send GS V partial cut command
 * @param {number} [options.luminanceThreshold=160] - Brightness cutoff (0-255). Lower = darker threshold.
 * @returns {Uint8Array} Complete ESC/POS byte stream ready for TCP transmission
 */
export function canvasToEscPosRaster(sourceCanvas, {
  kickCashDrawer = true,
  cutPaper = true,
  luminanceThreshold = 160,
} = {}) {
  // ─── Step 1: Ensure exact 576px width ───────────────────────────────
  let canvas = sourceCanvas;
  if (sourceCanvas.width !== PRINT_WIDTH_DOTS) {
    const scale = PRINT_WIDTH_DOTS / sourceCanvas.width;
    const scaledHeight = Math.round(sourceCanvas.height * scale);
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = PRINT_WIDTH_DOTS;
    scaledCanvas.height = scaledHeight;
    const sCtx = scaledCanvas.getContext('2d');
    // Nearest-neighbor: preserves crisp text edges for thermal printing
    sCtx.imageSmoothingEnabled = false;
    sCtx.fillStyle = '#ffffff';
    sCtx.fillRect(0, 0, PRINT_WIDTH_DOTS, scaledHeight);
    sCtx.drawImage(sourceCanvas, 0, 0, PRINT_WIDTH_DOTS, scaledHeight);
    canvas = scaledCanvas;
  }

  // ─── Step 2: Extract raw RGBA pixel data ────────────────────────────
  const ctx = canvas.getContext('2d');
  const width = canvas.width;   // Always 576
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  const bytes = [];

  // ─── Step 3: ESC @ Initialize printer ───────────────────────────────
  bytes.push(...ESC_INIT);

  // ─── Step 4: Cash Drawer Kick (before print) ────────────────────────
  if (kickCashDrawer) {
    bytes.push(...ESC_DRAWER_KICK);
  }

  // ─── Step 5: Convert to 1-bit bitmap, chunked GS v 0 ───────────────
  // Max 256 lines per chunk to prevent printer buffer overflow
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

    // Rasterize each scanline
    for (let y = currentY; y < currentY + chunkHeight; y++) {
      for (let byteX = 0; byteX < WIDTH_BYTES; byteX++) {
        let byteVal = 0;
        for (let bit = 0; bit < 8; bit++) {
          const pixelX = byteX * 8 + bit;
          if (pixelX < width) {
            const idx = (y * width + pixelX) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const a = pixels[idx + 3];

            // BT.601 luminance: 0.299R + 0.587G + 0.114B
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            // Pixel is BLACK (thermal burn) if:
            //   - Visible (alpha > 128) AND dark enough (lum < threshold)
            if (a > 128 && lum < luminanceThreshold) {
              byteVal |= (0x80 >> bit); // MSB = leftmost pixel
            }
          }
        }
        bytes.push(byteVal);
      }
    }

    currentY += chunkHeight;
  }

  // ─── Step 6: Feed paper past cutter & cut ───────────────────────────
  bytes.push(...ESC_FEED_LINES(3)); // Feed 3 lines to clear print head

  if (cutPaper) {
    bytes.push(...GS_CUT_PARTIAL); // GS V 66 0 (Partial cut)
  }

  return new Uint8Array(bytes);
}

/**
 * Fallback Text-only ESC/POS builder (for standard ASCII / Latin / numbers)
 * Only used when canvas rendering is unavailable
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
