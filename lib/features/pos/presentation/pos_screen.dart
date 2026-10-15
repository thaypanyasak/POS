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

  void _openMobileCartDrawer() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          height: MediaQuery.of(ctx).size.height * 0.88,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            boxShadow: [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 20,
                offset: Offset(0, -4),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              // Pull Handle Indicator
              Container(
                margin: const EdgeInsets.only(top: 10, bottom: 6),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const Expanded(child: CartDock()),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final cartState = ref.watch(cartProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final screenWidth = constraints.maxWidth;
            final isLandscapeTablet = screenWidth >= 768;

            // 1. TABLET / DESKTOP (Width >= 768px) -> Split Screen View
            if (isLandscapeTablet) {
              final cartWidth = screenWidth >= 1280
                  ? 380.0
                  : (screenWidth >= 1024 ? 350.0 : 330.0);

              return Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Expanded(
                    child: CatalogDock(),
                  ),
                  SizedBox(
                    width: cartWidth,
                    child: const CartDock(),
                  ),
                ],
              );
            }

            // 2. MOBILE PORTRAIT / PHONE (< 768px) -> Full Catalog + Floating Bottom Cart Bar
            return Column(
              children: [
                const Expanded(
                  child: CatalogDock(),
                ),

                // Floating Cart Summary Bar (Section 2.1.B in SPEC_RESPONSIVE_ORIENTATION.md)
                InkWell(
                  onTap: _openMobileCartDrawer,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: const BoxDecoration(
                      color: Color(0xFF0F766E),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                      boxShadow: [
                        BoxShadow(
                          color: Color(0x260F766E),
                          offset: Offset(0, -3),
                          blurRadius: 8,
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        // Cart Icon Badge
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            const Icon(Icons.shopping_cart_rounded, color: Colors.white, size: 22),
                            if (cartState.itemCount > 0)
                              Positioned(
                                top: -6,
                                right: -8,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFE11D48),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: Colors.white, width: 1.5),
                                  ),
                                  child: Text(
                                    '${cartState.itemCount}',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(width: 14),

                        // Customer & Subtotal
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                cartState.customer.name.isNotEmpty
                                    ? cartState.customer.name
                                    : 'ລູກຄ້າທົ່ວໄປ',
                                style: const TextStyle(
                                  color: Color(0xFFCCFBF1),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                '${cartState.formattedGrandTotal} ₭',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w900,
                                  fontFamily: 'monospace',
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Action Button
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            children: const [
                              Text(
                                'ເບິ່ງກະຕ່າ',
                                style: TextStyle(
                                  color: Color(0xFF0F766E),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              SizedBox(width: 4),
                              Icon(Icons.arrow_forward_rounded, size: 14, color: Color(0xFF0F766E)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
