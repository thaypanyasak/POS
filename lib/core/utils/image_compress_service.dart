import 'dart:convert';
import 'dart:typed_data';
import 'package:image/image.dart' as img;

/// Ultra-lightweight image compression service
/// Keeps image file sizes minimal (~15 KB - 35 KB) to save Supabase free tier storage quota.
class ImageCompressService {
  ImageCompressService._();

  /// Compresses raw image bytes to a max dimension of 400x400 with aggressive JPEG optimization (< 40 KB)
  static Uint8List compressImage(
    Uint8List rawBytes, {
    int maxDimension = 400,
    int initialQuality = 75,
  }) {
    try {
      final decoded = img.decodeImage(rawBytes);
      if (decoded == null) return rawBytes;

      img.Image processed = decoded;

      // Downscale if either dimension exceeds maxDimension
      if (decoded.width > maxDimension || decoded.height > maxDimension) {
        if (decoded.width >= decoded.height) {
          processed = img.copyResize(
            decoded,
            width: maxDimension,
            interpolation: img.Interpolation.linear,
          );
        } else {
          processed = img.copyResize(
            decoded,
            height: maxDimension,
            interpolation: img.Interpolation.linear,
          );
        }
      }

      // First pass encode
      var compressedBytes = img.encodeJpg(processed, quality: initialQuality);

      // If still larger than 40 KB, run second pass with higher compression
      if (compressedBytes.length > 40 * 1024) {
        compressedBytes = img.encodeJpg(processed, quality: 60);
      }
      if (compressedBytes.length > 35 * 1024) {
        compressedBytes = img.encodeJpg(processed, quality: 48);
      }

      return Uint8List.fromList(compressedBytes);
    } catch (_) {
      return rawBytes;
    }
  }

  /// Converts bytes to a base64 Data URI
  static String toDataUri(Uint8List bytes) {
    return 'data:image/jpeg;base64,${base64Encode(bytes)}';
  }

  /// Checks if URL is a data URI
  static bool isDataUri(String? url) {
    return url != null && url.startsWith('data:image/');
  }

  /// Extracts Uint8List bytes from a Data URI
  static Uint8List? bytesFromDataUri(String dataUri) {
    try {
      final commaIndex = dataUri.indexOf(',');
      if (commaIndex == -1) return null;
      final base64String = dataUri.substring(commaIndex + 1);
      return base64Decode(base64String);
    } catch (_) {
      return null;
    }
  }

  /// Helper to format byte size to human-readable string (e.g. "28.4 KB")
  static String formatByteSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    final kb = bytes / 1024;
    if (kb < 1024) return '${kb.toStringAsFixed(1)} KB';
    final mb = kb / 1024;
    return '${mb.toStringAsFixed(2)} MB';
  }
}
