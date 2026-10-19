/**
 * ESC/POS Generator & Monochrome Rasterizer for Thermal Printers
 * Supports standard retail thermal printers (EasyPrint ES-8803WA, Xprinter, Epson, etc.)
 * Compatible with 80mm (576 dots) and 58mm (384 dots) widths.
 */

// ESC/POS Commands
export const ESC_INIT = [0x1b, 0x40]; // ESC @ (Initialize printer)
export const ESC_DRAWER_KICK = [0x1b, 0x70, 0x00, 0x19, 0xfa]; // ESC p 0 25 250 (Kick cash drawer)
export const GS_CUT_PARTIAL = [0x1d, 0x56, 0x42, 0x00]; // GS V 66 0 (Partial cut with feed)
export const ESC_FEED_LINES = (n = 3) => [0x1b, 0x64, n]; // ESC d n (Feed n lines)

/**
 * Convert Canvas image data to ESC/POS Monochrome 1-bit raster command (`GS v 0`)
 * Luminance calculation: 0.299*R + 0.587*G + 0.114*B < threshold => 1 (black dot)
 */
export function canvasToEscPosRaster(canvas, { kickCashDrawer = true, cutPaper = true, luminanceThreshold = 180 } = {}) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  const widthBytes = Math.ceil(width / 8);
  const bytes = [];

  // 1. Initialize printer
  bytes.push(...ESC_INIT);

  // 2. Open Cash Drawer if requested
  if (kickCashDrawer) {
    bytes.push(...ESC_DRAWER_KICK);
  }

  // Split large receipts into chunks (max 512 lines) to avoid printer buffer overflow
  const maxChunkLines = 512;
  let currentY = 0;

  while (currentY < height) {
    const chunkHeight = Math.min(maxChunkLines, height - currentY);

    const xL = widthBytes % 256;
    const xH = Math.floor(widthBytes / 256);
    const yL = chunkHeight % 256;
    const yH = Math.floor(chunkHeight / 256);

    // GS v 0 0 xL xH yL yH
    bytes.push(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH);

    for (let y = currentY; y < currentY + chunkHeight; y++) {
      for (let byteX = 0; byteX < widthBytes; byteX++) {
        let byteVal = 0;
        for (let bit = 0; bit < 8; bit++) {
          const pixelX = byteX * 8 + bit;
          if (pixelX < width) {
            const idx = (y * width + pixelX) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const a = pixels[idx + 3];

            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum < luminanceThreshold && a > 50) {
              byteVal |= 1 << (7 - bit);
            }
          }
        }
        bytes.push(byteVal);
      }
    }

    currentY += chunkHeight;
  }

  // 3. Feed 4 lines so bill clears the print head cutter
  bytes.push(...ESC_FEED_LINES(4));

  // 4. Cut paper
  if (cutPaper) {
    bytes.push(...GS_CUT_PARTIAL);
  }

  return new Uint8Array(bytes);
}

/**
 * Fallback Text-only ESC/POS builder (for standard ASCII / Latin / numbers)
 */
export function buildTextEscPosReceipt(receipt, { paperWidth = 80, kickCashDrawer = true, cutPaper = true } = {}) {
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
 */
export function uint8ArrayToBase64(uint8) {
  let binary = '';
  const len = uint8.byteLength;
  const chunkSize = 8192; // Process in chunks to avoid call stack limits
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = uint8.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}
