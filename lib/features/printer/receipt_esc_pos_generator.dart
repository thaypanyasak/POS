import 'dart:typed_data';
import 'package:image/image.dart' as img;

/// ESC/POS Command Generator for Lao Typography Raster Printing
/// Translates rendered image bitmaps into 1-bit monochrome ESC/POS byte streams.
class ReceiptEscPosGenerator {
  ReceiptEscPosGenerator._();

  // ESC/POS Command Constants
  static const List<int> cmdInit = [0x1B, 0x40]; // ESC @ (Initialize printer)
  static const List<int> cmdDrawerKick = [0x1B, 0x70, 0x00, 0x19, 0xFA]; // ESC p 0 25 250 (Drawer kick pin 2)
  static const List<int> cmdCutPartial = [0x1D, 0x56, 0x42, 0x00]; // GS V 66 0 (Cut with feed)
  static const List<int> cmdFeed3Lines = [0x1B, 0x64, 0x03]; // ESC d 3 (Feed 3 lines)

  /// Converts a decoded [img.Image] into raw ESC/POS 1-bit monochrome raster commands (`GS v 0`).
  ///
  /// Standard 80mm thermal receipt printer resolution: 576 dots wide (72mm printable).
  /// Standard 58mm printer resolution: 384 dots wide (48mm printable).
  ///
  /// Protocol: `GS v 0 m xL xH yL yH d1...dk`
  /// - `m = 0` (Normal mode)
  /// - `xL, xH` = (width / 8) bytes
  /// - `yL, yH` = height in dots
  static Uint8List generateRasterBytes({
    required img.Image image,
    bool kickCashDrawer = true,
    bool cutPaper = true,
    int luminanceThreshold = 180, // Pixels darker than this become black dots
  }) {
    final BytesBuilder builder = BytesBuilder();

    // 1. Initialize printer
    builder.add(cmdInit);

    // 2. Open Cash Drawer if requested
    if (kickCashDrawer) {
      builder.add(cmdDrawerKick);
    }

    final int width = image.width;
    final int height = image.height;
    final int widthBytes = (width + 7) ~/ 8;

    // Split large receipt into chunks of max 512 lines to prevent printer buffer overflow
    const int maxChunkLines = 512;
    int currentY = 0;

    while (currentY < height) {
      final int chunkHeight = (currentY + maxChunkLines <= height)
          ? maxChunkLines
          : (height - currentY);

      // GS v 0 0 xL xH yL yH
      final int xL = widthBytes % 256;
      final int xH = widthBytes ~/ 256;
      final int yL = chunkHeight % 256;
      final int yH = chunkHeight ~/ 256;

      builder.add([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);

      // Generate monochrome 1-bit raster data for this chunk
      for (int y = currentY; y < currentY + chunkHeight; y++) {
        for (int byteX = 0; byteX < widthBytes; byteX++) {
          int byteVal = 0;
          for (int bit = 0; bit < 8; bit++) {
            final int pixelX = (byteX * 8) + bit;
            if (pixelX < width) {
              final img.Pixel pixel = image.getPixel(pixelX, y);
              // Calculate perceived luminance: 0.299*R + 0.587*G + 0.114*B
              final num lum = (0.299 * pixel.r) + (0.587 * pixel.g) + (0.114 * pixel.b);
              // If pixel is dark and not transparent, set bit to 1 (black printed dot)
              if (lum < luminanceThreshold && pixel.a > 50) {
                byteVal |= (1 << (7 - bit));
              }
            }
          }
          builder.addByte(byteVal);
        }
      }

      currentY += chunkHeight;
    }

    // 3. Feed lines before cut
    builder.add(cmdFeed3Lines);

    // 4. Cut paper
    if (cutPaper) {
      builder.add(cmdCutPartial);
    }

    return builder.toBytes();
  }

  /// Standalone Cash Drawer Kick byte sequence
  static Uint8List get openCashDrawerBytes => Uint8List.fromList(cmdDrawerKick);

  /// Standalone Cut Paper byte sequence
  static Uint8List get cutPaperBytes => Uint8List.fromList(cmdCutPartial);
}
