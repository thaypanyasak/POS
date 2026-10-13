import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;
import 'package:screenshot/screenshot.dart';
import '../../domain/models/sale_transaction.dart';
import 'receipt_esc_pos_generator.dart';
import 'widgets/lao_thermal_receipt_view.dart';

/// Configuration for Network / Raw Socket Thermal ESC/POS Printer
class PrinterConfig {
  final String ipAddress;
  final int port;
  final int paperWidthDots; // 576 for 80mm, 384 for 58mm
  final bool openCashDrawerOnPrint;
  final bool autoCut;
  final bool isSimulationMode;

  const PrinterConfig({
    this.ipAddress = '192.168.1.200',
    this.port = 9100,
    this.paperWidthDots = 576,
    this.openCashDrawerOnPrint = true,
    this.autoCut = true,
    this.isSimulationMode = false,
  });

  PrinterConfig copyWith({
    String? ipAddress,
    int? port,
    int? paperWidthDots,
    bool? openCashDrawerOnPrint,
    bool? autoCut,
    bool? isSimulationMode,
  }) {
    return PrinterConfig(
      ipAddress: ipAddress ?? this.ipAddress,
      port: port ?? this.port,
      paperWidthDots: paperWidthDots ?? this.paperWidthDots,
      openCashDrawerOnPrint:
          openCashDrawerOnPrint ?? this.openCashDrawerOnPrint,
      autoCut: autoCut ?? this.autoCut,
      isSimulationMode: isSimulationMode ?? this.isSimulationMode,
    );
  }
}

/// Result of a print job
class PrintResult {
  final bool success;
  final String message;
  final Uint8List? rawBytes;
  final int? bytesTransmitted;

  const PrintResult({
    required this.success,
    required this.message,
    this.rawBytes,
    this.bytesTransmitted,
  });
}

/// Enterprise Lao Thermal Receipt Printer Service
///
/// Features:
/// 1. Off-screen Bitmap Rasterization (`screenshot` / `RepaintBoundary` + `image` package)
///    Renders Lao typography into crisp 1-bit monochrome raster images (`GS v 0`)
/// 2. Raw TCP Socket direct streaming (Port 9100, no iOS AirPrint dialogs)
/// 3. ESC/POS Cash drawer kick (`ESC p 0`) & Auto paper cut (`GS V 66 0`)
/// 4. Resilient network handling with simulation fallback for local development
class LaoReceiptPrinterService {
  final ScreenshotController _screenshotController = ScreenshotController();
  PrinterConfig _config;

  LaoReceiptPrinterService({PrinterConfig? config})
      : _config = config ?? const PrinterConfig();

  PrinterConfig get config => _config;

  void updateConfig(PrinterConfig newConfig) {
    _config = newConfig;
  }

  /// Prints a [SaleTransaction] silently to the thermal printer
  Future<PrintResult> printReceipt({
    required SaleTransaction transaction,
    BuildContext? context,
  }) async {
    try {
      // 1. Off-Screen Rasterization: Capture the Lao receipt widget into PNG bytes
      final receiptWidget = Material(
        color: Colors.white,
        child: LaoThermalReceiptView(
          transaction: transaction,
          receiptWidth: _config.paperWidthDots.toDouble(),
        ),
      );

      final Uint8List pngBytes = await _screenshotController.captureFromWidget(
        receiptWidget,
        delay: const Duration(milliseconds: 100),
        pixelRatio: 1.0,
      );

      // 2. Decode the rasterized PNG into image pixels
      final img.Image? decoded = img.decodeImage(pngBytes);
      if (decoded == null) {
        return const PrintResult(
          success: false,
          message: 'Failed to decode captured receipt image to bitmap pixels.',
        );
      }

      // Ensure width matches printer dots
      final img.Image resized = (decoded.width != _config.paperWidthDots)
          ? img.copyResize(decoded, width: _config.paperWidthDots)
          : decoded;

      // 3. Convert image pixels into 1-bit monochrome ESC/POS byte stream (GS v 0)
      final Uint8List escPosBytes = ReceiptEscPosGenerator.generateRasterBytes(
        image: resized,
        kickCashDrawer: _config.openCashDrawerOnPrint,
        cutPaper: _config.autoCut,
      );

      // 4. Transmit raw bytes directly via TCP Socket (Port 9100)
      if (_config.isSimulationMode) {
        return PrintResult(
          success: true,
          message:
              'Print simulated successfully (${escPosBytes.length} bytes generated).',
          rawBytes: escPosBytes,
          bytesTransmitted: escPosBytes.length,
        );
      }

      return await _sendRawBytesToSocket(escPosBytes);
    } catch (e) {
      // Fallback grace in case offline or testing
      return PrintResult(
        success: false,
        message: 'Printing error: ${e.toString()}',
      );
    }
  }

  /// Kicks the cash drawer via ESC/POS command directly without printing receipt
  Future<PrintResult> openCashDrawer() async {
    final bytes = ReceiptEscPosGenerator.openCashDrawerBytes;
    if (_config.isSimulationMode) {
      return const PrintResult(
        success: true,
        message: 'Cash drawer kick simulated.',
      );
    }
    return _sendRawBytesToSocket(bytes);
  }

  /// Sends raw byte payload over TCP Socket (Port 9100) with robust timeout
  Future<PrintResult> _sendRawBytesToSocket(Uint8List bytes) async {
    Socket? socket;
    try {
      socket = await Socket.connect(
        _config.ipAddress,
        _config.port,
        timeout: const Duration(seconds: 4),
      );

      socket.add(bytes);
      await socket.flush();
      await socket.close();

      return PrintResult(
        success: true,
        message: 'ໃບບິນພິມອອກແລ້ວ (Sent to ${_config.ipAddress}:${_config.port})',
        rawBytes: bytes,
        bytesTransmitted: bytes.length,
      );
    } on SocketException catch (e) {
      // If network printer is unreachable, return descriptive status
      return PrintResult(
        success: false,
        message:
            'ບໍ່ສາມາດເຊື່ອມຕໍ່ເຄື່ອງພິມ ${_config.ipAddress}:${_config.port} (${e.message})',
        rawBytes: bytes,
      );
    } catch (e) {
      return PrintResult(
        success: false,
        message: 'Printer socket error: $e',
        rawBytes: bytes,
      );
    } finally {
      try {
        socket?.destroy();
      } catch (_) {}
    }
  }
}
