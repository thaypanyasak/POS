import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import 'controllers/cart_controller.dart';
import 'controllers/catalog_controller.dart';
import 'widgets/cart_dock.dart';
import 'widgets/catalog_dock.dart';

/// Complete iPad Landscape POS Screen Widget
/// - Orientation: Locked to Landscape
/// - 65% Catalog & Search Dock (Left)
/// - 35% Cart & Transaction Dock (Right)
/// - Integrated Hardware Barcode Scanner Listener
class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends ConsumerState<PosScreen> {
  final StringBuffer _barcodeBuffer = StringBuffer();
  DateTime _lastBarcodeKeystroke = DateTime.now();

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_handleHardwareKey);
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleHardwareKey);
    super.dispose();
  }

  /// Physical USB/BLE Barcode Scanner wedge listener
  bool _handleHardwareKey(KeyEvent event) {
    if (event is! KeyDownEvent) return false;

    final now = DateTime.now();
    // Hardware scanners typically transmit consecutive keystrokes within 20-50ms
    if (now.difference(_lastBarcodeKeystroke).inMilliseconds > 120) {
      _barcodeBuffer.clear();
    }
    _lastBarcodeKeystroke = now;

    if (event.logicalKey == LogicalKeyboardKey.enter) {
      final barcode = _barcodeBuffer.toString().trim();
      _barcodeBuffer.clear();
      if (barcode.isNotEmpty) {
        _onBarcodeScanned(barcode);
        return true;
      }
    } else if (event.character != null && event.character!.isNotEmpty) {
      _barcodeBuffer.write(event.character);
    }

    return false;
  }

  void _onBarcodeScanned(String barcode) {
    final match = ref.read(catalogProvider.notifier).findProductByBarcode(barcode);
    if (match != null) {
      ref.read(cartProvider.notifier).addProduct(
            match.product,
            unit: match.unit,
            quantity: 1,
          );
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'ຍິງບາໂຄດ: ${match.product.name} (${match.unit.unitName})',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          backgroundColor: AppColors.primary,
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final screenWidth = constraints.maxWidth;
            // On compact mobile landscape (width < 900): 62% catalog, 38% cart
            // On larger tablet landscape: 65% catalog, 35% cart
            final isCompactMobile = screenWidth < 900;
            final catalogFlex = isCompactMobile ? 62 : 65;
            final cartFlex = isCompactMobile ? 38 : 35;

            return Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  flex: catalogFlex,
                  child: const CatalogDock(),
                ),
                Expanded(
                  flex: cartFlex,
                  child: const CartDock(),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
