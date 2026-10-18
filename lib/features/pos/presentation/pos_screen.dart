import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../domain/models/sale_transaction.dart';
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

            // 1. TABLET / DESKTOP (Width >= 768px) -> Modern 59% / 41% Two-Column Split Layout
            if (isLandscapeTablet) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: const [
                  Expanded(
                    flex: 59, // 59% Catalog & Categories Dock
                    child: CatalogDock(),
                  ),
                  Expanded(
                    flex: 41, // 41% Cart & Checkout Dock
                    child: CartDock(),
                  ),
                ],
              );
            }

            // 2. MOBILE PORTRAIT / PHONE (< 768px) -> Full Catalog + Floating Bottom Cart Bar
            return Column(
              children: [
                if (cartState.isEditingOldOrder)
                  _buildMobileEditingBanner(context, cartState),
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
                            const PhosphorIcon(PhosphorIconsBold.shoppingCart, color: Colors.white, size: 22),
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
                              PhosphorIcon(PhosphorIconsBold.arrowRight, size: 14, color: Color(0xFF0F766E)),
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

  Widget _buildMobileEditingBanner(BuildContext context, CartState cartState) {
    final method = (cartState.originalPaymentMethod ??
            (cartState.originalTransaction?.isDebt == true
                ? 'DEBT'
                : (cartState.originalTransaction?.paymentMethod == PaymentMethod.qrTransfer
                    ? 'TRANSFER'
                    : 'CASH')))
        .toUpperCase();

    final isDebt = method == 'DEBT';
    final isTransfer = method == 'TRANSFER';
    final isCash = !isDebt && !isTransfer;

    final remainingDebt = cartState.originalRemainingDebt > 0
        ? cartState.originalRemainingDebt
        : (cartState.originalTransaction?.debtAmount ?? 0);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: const BoxDecoration(
        color: Color(0xFFF59E0B),
        border: Border(bottom: BorderSide(color: Color(0xFFD97706))),
      ),
      child: Row(
        children: [
          const PhosphorIcon(PhosphorIconsBold.warning, color: Colors.white, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const PhosphorIcon(PhosphorIconsBold.warning, color: Colors.white, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        'ກຳລັງແກ້ໄຂບິນ: #${cartState.originalReceiptNumber ?? ""} • ລູກຄ້າ: ${cartState.originalCustomerName ?? cartState.customer.name} • ຮູບແບບຊຳລະເດີມ: ',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  if (isCash)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF059669),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          PhosphorIcon(PhosphorIconsBold.money, size: 12, color: Colors.white),
                          SizedBox(width: 4),
                          Text(
                            'ເງິນສົດ (Cash)',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  if (isTransfer)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF2563EB),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          PhosphorIcon(PhosphorIconsBold.qrCode, size: 12, color: Colors.white),
                          SizedBox(width: 4),
                          Text(
                            'ໂອນເງິນ (Transfer)',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  if (isDebt)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE11D48),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const PhosphorIcon(PhosphorIconsBold.handCoins, size: 12, color: Colors.white),
                          const SizedBox(width: 4),
                          Text(
                            'ຕິດໜີ້ (ຄ້າງ: ${LaoCurrencyFormatter.formatDots(remainingDebt)} ₭)',
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 6),
          InkWell(
            onTap: () {
              ref.read(cartProvider.notifier).cancelEditingOrder();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('ຍົກເລີກການແກ້ໄຂບິນເກົ່າແລ້ວ'),
                  duration: Duration(seconds: 1),
                ),
              );
            },
            borderRadius: BorderRadius.circular(5),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFD97706),
                borderRadius: BorderRadius.circular(5),
              ),
              child: const Text(
                'ຍົກເລີກ',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
