import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../controllers/cart_controller.dart';
import '../controllers/catalog_controller.dart';

/// Camera / Barcode Scanner Modal for POS (Live Camera on iOS/iPadOS, Android & Web)
class BarcodeScannerModal extends ConsumerStatefulWidget {
  final ValueChanged<String>? onScan;

  const BarcodeScannerModal({super.key, this.onScan});

  @override
  ConsumerState<BarcodeScannerModal> createState() => _BarcodeScannerModalState();
}

class _BarcodeScannerModalState extends ConsumerState<BarcodeScannerModal>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  final TextEditingController _inputController = TextEditingController();
  late final MobileScannerController _scannerController;
  String? _errorMsg;
  bool _isProcessing = false;
  bool _isTorchOn = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _scannerController = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      torchEnabled: false,
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    _inputController.dispose();
    _scannerController.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_isProcessing) return;
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final rawValue = barcodes.first.rawValue;
    if (rawValue != null && rawValue.trim().isNotEmpty) {
      _processBarcode(rawValue.trim());
    }
  }

  void _processBarcode(String rawCode) {
    final code = rawCode.trim();
    if (code.isEmpty || _isProcessing) return;
    _isProcessing = true;

    if (widget.onScan != null) {
      Navigator.of(context).pop(code);
      widget.onScan!(code);
      return;
    }

    final match = ref.read(catalogProvider.notifier).findProductByBarcode(code);
    if (match != null) {
      final product = match.product;
      final unit = match.unit;

      ref.read(cartProvider.notifier).addProduct(
            product,
            unit: unit,
            quantity: 1,
          );

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'ເພີ່ມ "${match.product.name}" (${match.unit.unitName}) ເຂົ້າກະຕ່າແລ້ວ!',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            backgroundColor: const Color(0xFF0F766E),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } else {
      setState(() {
        _errorMsg = 'ບໍ່ພົບສິນຄ້າທີ່ມີບາໂຄດ: "$code"';
        _isProcessing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final catalogState = ref.watch(catalogProvider);
    // Find products that have barcodes for quick test pills
    final productsWithBarcode = catalogState.allProducts
        .where((p) => (p.barcode != null && p.barcode!.isNotEmpty) ||
            p.units.any((u) => u.barcode != null && u.barcode!.isNotEmpty))
        .take(6)
        .toList();

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: const [
                      PhosphorIcon(PhosphorIconsBold.scan, color: Color(0xFF0F766E), size: 22),
                      SizedBox(width: 8),
                      Text(
                        'ສະແກນບາໂຄດ (Camera Scanner)',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Torch toggle button
                      IconButton(
                        onPressed: () {
                          _scannerController.toggleTorch();
                          setState(() {
                            _isTorchOn = !_isTorchOn;
                          });
                        },
                        icon: PhosphorIcon(
                          _isTorchOn ? PhosphorIconsBold.lightning : PhosphorIconsBold.lightningSlash,
                          size: 19,
                          color: _isTorchOn ? const Color(0xFFEAB308) : const Color(0xFF64748B),
                        ),
                        tooltip: 'ໄຟສາຍ (Torch)',
                        visualDensity: VisualDensity.compact,
                      ),
                      // Camera switch button
                      IconButton(
                        onPressed: () => _scannerController.switchCamera(),
                        icon: const PhosphorIcon(PhosphorIconsBold.cameraRotate, size: 19, color: Color(0xFF64748B)),
                        tooltip: 'ສະຫຼັບກ້ອງ',
                        visualDensity: VisualDensity.compact,
                      ),
                      const SizedBox(width: 4),
                      InkWell(
                        onTap: () => Navigator.of(context).pop(),
                        borderRadius: BorderRadius.circular(20),
                        child: const Padding(
                          padding: EdgeInsets.all(4.0),
                          child: PhosphorIcon(PhosphorIconsBold.x, size: 18, color: Color(0xFF94A3B8)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 14),

              // Live Camera Viewfinder Container
              Container(
                height: 210,
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF1E293B)),
                ),
                clipBehavior: Clip.antiAlias,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Real Mobile Scanner Preview
                    Positioned.fill(
                      child: MobileScanner(
                        controller: _scannerController,
                        onDetect: _onDetect,
                        errorBuilder: (context, error) {
                          return Center(
                            child: Padding(
                              padding: const EdgeInsets.all(16.0),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const PhosphorIcon(PhosphorIconsBold.videoCameraSlash, color: Colors.white54, size: 36),
                                  const SizedBox(height: 8),
                                  Text(
                                    'ບໍ່ສາມາດເປີດກ້ອງໄດ້: ${error.errorCode.name}',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(color: Colors.white70, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),

                    // Targeting Framing Box
                    Container(
                      width: 170,
                      height: 110,
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFF14B8A6), width: 2.2),
                        borderRadius: BorderRadius.circular(12),
                        color: Colors.black.withValues(alpha: 0.05),
                      ),
                    ),

                    // Animated Scanning Laser Line
                    AnimatedBuilder(
                      animation: _animController,
                      builder: (context, child) {
                        return Positioned(
                          top: 45 + (_animController.value * 110),
                          child: Container(
                            width: 180,
                            height: 2.5,
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Colors.transparent,
                                  Color(0xFF2DD4BF),
                                  Color(0xFF14B8A6),
                                  Colors.transparent,
                                ],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Color(0xFF2DD4BF),
                                  blurRadius: 8,
                                  spreadRadius: 1.5,
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),

                    // Subtitle overlay in viewfinder
                    Positioned(
                      bottom: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.65),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            PhosphorIcon(PhosphorIconsBold.camera, size: 13, color: Colors.white70),
                            SizedBox(width: 4),
                            Text(
                              'ສ່ອງກ້ອງໃສ່ບາໂຄດສິນຄ້າເພື່ອສະແກນ',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              // Input Barcode directly
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                ),
                child: TextField(
                  controller: _inputController,
                  autofocus: true,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: InputBorder.none,
                    hintText: 'ປ້ອນບາໂຄດດ້ວຍຕົນເອງ...',
                    hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                    prefixIcon: const PhosphorIcon(PhosphorIconsBold.barcode, size: 18, color: Color(0xFF64748B)),
                    suffixIcon: IconButton(
                      icon: const PhosphorIcon(PhosphorIconsBold.arrowRight, size: 18, color: Color(0xFF0F766E)),
                      onPressed: () => _processBarcode(_inputController.text),
                    ),
                  ),
                  onSubmitted: _processBarcode,
                ),
              ),

              if (_errorMsg != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFECDD3)),
                  ),
                  child: Row(
                    children: [
                      const PhosphorIcon(PhosphorIconsBold.warningCircle, size: 14, color: Color(0xFFE11D48)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          _errorMsg!,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFBE123C)),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // Quick Barcode Demo Testing Chips
              if (productsWithBarcode.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text(
                  'ທົດສອບສະແກນດ່ວນ:',
                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 5),
                Wrap(
                  spacing: 5,
                  runSpacing: 4,
                  children: productsWithBarcode.map((p) {
                    final code = p.barcode ?? p.units.first.barcode ?? '';
                    return InkWell(
                      onTap: () {
                        _inputController.text = code;
                        _processBarcode(code);
                      },
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Text(
                          '${p.name} ($code)',
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
