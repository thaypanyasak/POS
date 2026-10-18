import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/localization/lao_currency_formatter.dart';
import '../../domain/models/product.dart';
import '../../domain/models/product_unit.dart';
import '../../features/pos/presentation/controllers/catalog_controller.dart';
import '../../features/pos/presentation/widgets/barcode_scanner_modal.dart';
import '../../models/supplier_model.dart';
import '../../providers/purchase_provider.dart';
import 'widgets/supplier_management_dialog.dart';

/// Formatter for Thai Baht (THB / ฿) with thousand dot separators
class ThbFormatter {
  static String format(num amount) {
    final isInt = amount == amount.roundToDouble();
    if (isInt) {
      return LaoCurrencyFormatter.formatDots(amount);
    }
    final parts = amount.toStringAsFixed(2).split('.');
    final intFormatted = LaoCurrencyFormatter.formatDots(int.parse(parts[0]));
    return '$intFormatted,${parts[1]}';
  }

  static double parse(String? input) {
    if (input == null || input.trim().isEmpty) return 0.0;
    final clean = input.replaceAll('.', '').replaceAll(',', '.').trim();
    return double.tryParse(clean) ?? 0.0;
  }
}

/// Redesigned Enterprise Multi-Product Goods Receipt Note (GRN - ໃບຮັບສິນຄ້າເຂົ້າສາງ)
/// Flat shadcn/Tailwind Design System with Slate-200 borders, 10-12px radiuses,
/// Dual-currency auto/manual calculation link, and responsive Desktop/Tablet/Mobile layout.
class PurchaseEntryScreen extends ConsumerStatefulWidget {
  const PurchaseEntryScreen({super.key});

  @override
  ConsumerState<PurchaseEntryScreen> createState() => _PurchaseEntryScreenState();
}

class _PurchaseEntryScreenState extends ConsumerState<PurchaseEntryScreen> {
  final _searchController = TextEditingController();
  final _rateController = TextEditingController();
  final _receiverController = TextEditingController(text: 'ໄມ້ຄຳ (Meii)');
  final _noteController = TextEditingController();
  final _partialPaidController = TextEditingController();
  final _shippingCostController = TextEditingController(text: '0');

  // Focus nodes
  final _searchFocusNode = FocusNode();

  // Hardware Barcode Scanner buffer & timer
  String _barcodeBuffer = '';
  Timer? _barcodeBufferTimer;

  bool _isSearchActive = false;
  bool _isCostLinked = true; // Auto recalculates Kip from Baht when true
  int _shippingCostLak = 0;

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_handleKeyEvent);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(catalogProvider.notifier).fetchFromSupabase();
      ref.read(purchaseProvider.notifier).fetchSuppliers();
      ref.read(grnCartProvider.notifier).reset();
      final rate = ref.read(grnCartProvider).exchangeRate;
      _rateController.text = rate > 0 ? '$rate' : '720';
    });
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleKeyEvent);
    _barcodeBufferTimer?.cancel();
    _searchController.dispose();
    _rateController.dispose();
    _receiverController.dispose();
    _noteController.dispose();
    _partialPaidController.dispose();
    _shippingCostController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  /// Handles hardware key events from physical USB/Bluetooth handheld barcode scanners
  bool _handleKeyEvent(KeyEvent event) {
    if (event is KeyDownEvent) {
      if (event.logicalKey == LogicalKeyboardKey.enter) {
        if (_barcodeBuffer.isNotEmpty) {
          final code = _barcodeBuffer.trim();
          _barcodeBuffer = '';
          _onBarcodeScanned(code);
          return true;
        }
      } else {
        final char = event.character;
        if (char != null && char.isNotEmpty) {
          _barcodeBuffer += char;
          _barcodeBufferTimer?.cancel();
          _barcodeBufferTimer = Timer(const Duration(milliseconds: 150), () {
            _barcodeBuffer = '';
          });
        }
      }
    }
    return false;
  }

  void _onBarcodeScanned(String barcode) {
    if (barcode.trim().isEmpty) return;
    final catalog = ref.read(catalogProvider).allProducts;
    final added = ref.read(grnCartProvider.notifier).addByBarcode(barcode, catalog);

    if (added) {
      HapticFeedback.mediumImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('ສະແກນ Barcode: "$barcode" ສຳເລັດ!'),
          backgroundColor: const Color(0xFF0D9488),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    } else {
      HapticFeedback.vibrate();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('ບໍ່ພົບສິນຄ້າທີ່ມີ Barcode: "$barcode"'),
          backgroundColor: const Color(0xFFE11D48),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  void _openCameraScanner() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => BarcodeScannerModal(
        onScan: (scanned) {
          _onBarcodeScanned(scanned);
        },
      ),
    );
  }

  void _confirmClearCart() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        title: const Row(
          children: [
            PhosphorIcon(PhosphorIconsBold.trash, color: Color(0xFFEF4444), size: 20),
            SizedBox(width: 8),
            Text(
              'ລ້າງລາຍການຮັບສິນຄ້າ?',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
            ),
          ],
        ),
        content: const Text(
          'ທ່ານຕ້ອງການລຶບສິນຄ້າທັງໝົດອອກຈາກໃບຮັບສິນຄ້ານີ້ແທ້ບໍ?',
          style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFF64748B),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            child: const Text('ຍົກເລີກ'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () {
              ref.read(grnCartProvider.notifier).reset();
              Navigator.pop(ctx);
            },
            child: const Text('ລຶບທັງໝົດ'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cartState = ref.watch(grnCartProvider);
    final purchaseState = ref.watch(purchaseProvider);
    final catalogState = ref.watch(catalogProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isLandscapeOrTablet = constraints.maxWidth >= 768;

            return Column(
              children: [
                // 1. TOP APP BAR (Flat, Compact, modern border-b Slate-200)
                _buildTopAppBar(cartState),

                // 2. MAIN BODY (Responsive Split Column or Single Scrollable List)
                Expanded(
                  child: isLandscapeOrTablet
                      ? _buildTabletLandscapeLayout(purchaseState.suppliers, cartState, catalogState.allProducts)
                      : _buildMobilePortraitLayout(purchaseState.suppliers, cartState, catalogState.allProducts),
                ),

                // 3. STICKY FOOTER ON MOBILE PORTRAIT ONLY
                if (!isLandscapeOrTablet) _buildStickyBottomBar(cartState),
              ],
            );
          },
        ),
      ),
    );
  }

  // ==========================================================================
  // TOP APP BAR
  // ==========================================================================
  Widget _buildTopAppBar(GrnCartState cartState) {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
      ),
      child: Row(
        children: [
          // Back button
          InkWell(
            onTap: () => Navigator.of(context).pop(),
            borderRadius: BorderRadius.circular(8),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Center(
                child: PhosphorIcon(PhosphorIconsBold.arrowLeft, color: Color(0xFF0F172A), size: 18),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Title & Status Badge
          Expanded(
            child: Row(
              children: [
                const Text(
                  'ຮັບສິນຄ້າເຂົ້າສາງ',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDFA),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFCCFBF1)),
                  ),
                  child: Text(
                    cartState.poCode.isNotEmpty ? cartState.poCode : 'PO-NEW',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F766E),
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Text(
                    '${cartState.items.length} ລາຍການ',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF475569),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Barcode scanner trigger
          InkWell(
            onTap: _openCameraScanner,
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  PhosphorIcon(PhosphorIconsBold.barcode, size: 16, color: Color(0xFF0D9488)),
                  SizedBox(width: 5),
                  Text(
                    'ສະແກນ',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0D9488)),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Clear cart button
          if (cartState.items.isNotEmpty)
            InkWell(
              onTap: _confirmClearCart,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFEE2E2)),
                ),
                child: const Center(
                  child: PhosphorIcon(PhosphorIconsBold.trash, color: Color(0xFFEF4444), size: 16),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ==========================================================================
  // TABLET / DESKTOP TWO-COLUMN LAYOUT
  // ==========================================================================
  Widget _buildTabletLandscapeLayout(
    List<SupplierModel> suppliers,
    GrnCartState cartState,
    List<Product> catalog,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left Column: Header controls, Search, and Cart list
        Expanded(
          flex: 62,
          child: CustomScrollView(
            slivers: [
              // Header Controls (Supplier, Exchange rate, Link toggle)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 12, 10),
                  child: _buildHeaderPanel(suppliers, cartState),
                ),
              ),
              // Search & Barcode
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 12, 12),
                  child: _buildProductSearchSection(catalog),
                ),
              ),
              // Items list or empty state
              if (cartState.items.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _buildEmptyCartPlaceholder(),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 12, 32),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final item = cartState.items[index];
                        return _buildProductLineItemCard(item, index, cartState.exchangeRate);
                      },
                      childCount: cartState.items.length,
                    ),
                  ),
                ),
            ],
          ),
        ),

        // Vertical divider
        const VerticalDivider(width: 1, thickness: 1, color: Color(0xFFE2E8F0)),

        // Right Column: Summary & Checkout Panel
        Expanded(
          flex: 38,
          child: Container(
            color: Colors.white,
            padding: const EdgeInsets.all(20),
            child: SingleChildScrollView(
              child: _buildSummaryAndPaymentPanel(cartState, isTabletColumn: true),
            ),
          ),
        ),
      ],
    );
  }

  // ==========================================================================
  // MOBILE PORTRAIT SINGLE SCROLLABLE LAYOUT
  // ==========================================================================
  Widget _buildMobilePortraitLayout(
    List<SupplierModel> suppliers,
    GrnCartState cartState,
    List<Product> catalog,
  ) {
    return CustomScrollView(
      slivers: [
        // Header Controls
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: _buildHeaderPanel(suppliers, cartState),
          ),
        ),
        // Search & Barcode
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
            child: _buildProductSearchSection(catalog),
          ),
        ),
        // Cart list or empty state
        if (cartState.items.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: _buildEmptyCartPlaceholder(),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 100),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final item = cartState.items[index];
                  return _buildProductLineItemCard(item, index, cartState.exchangeRate);
                },
                childCount: cartState.items.length,
              ),
            ),
          ),
      ],
    );
  }

  // ==========================================================================
  // 1. HEADER PANEL: SUPPLIER, EXCHANGE RATE (40px tabular), LINK/BREAK TOGGLE
  // ==========================================================================
  Widget _buildHeaderPanel(List<SupplierModel> suppliers, GrnCartState cartState) {
    final selectedSupplier = suppliers.any((s) => s.id == cartState.supplierId)
        ? suppliers.firstWhere((s) => s.id == cartState.supplierId)
        : null;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x05000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row 1: 3-column header (PO Code, Supplier, Receiver)
          Row(
            children: [
              // 1. PO Code (Auto-generated, read-only font mono)
              Container(
                height: 42,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const PhosphorIcon(PhosphorIconsBold.hash, size: 14, color: Color(0xFF64748B)),
                    const SizedBox(width: 4),
                    Text(
                      cartState.poCode.isNotEmpty ? cartState.poCode : 'PO-NEW',
                      style: const TextStyle(
                        fontSize: 12,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 8),

              // 2. Supplier Dropdown + "+ Thêm" Button
              Expanded(
                flex: 5,
                child: Row(
                  children: [
                    Expanded(
                      child: PopupMenuButton<String?>(
                        tooltip: 'ເລືອກຮ້ານສົ່ງ (Supplier)',
                        offset: const Offset(0, 46),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                          side: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        color: Colors.white,
                        elevation: 4,
                        onSelected: (val) {
                          ref.read(grnCartProvider.notifier).setSupplier(val);
                        },
                        itemBuilder: (ctx) => [
                          const PopupMenuItem<String?>(
                            value: null,
                            height: 40,
                            child: Text('— ບໍ່ລະບຸຮ້ານສົ່ງ —', style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
                          ),
                          ...suppliers.map((s) => PopupMenuItem<String?>(
                                value: s.id,
                                height: 44,
                                child: Row(
                                  children: [
                                    const PhosphorIcon(PhosphorIconsBold.storefront, size: 16, color: Color(0xFF0D9488)),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Text(
                                            s.name,
                                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          if (s.phone != null && s.phone!.isNotEmpty)
                                            Text(
                                              s.phone!,
                                              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                            ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              )),
                        ],
                        child: Container(
                          height: 42,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Row(
                            children: [
                              const PhosphorIcon(PhosphorIconsBold.storefront, size: 16, color: Color(0xFF0D9488)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  selectedSupplier?.name ?? 'ເລືອກຮ້ານສົ່ງ (Supplier)...',
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: selectedSupplier != null ? FontWeight.w600 : FontWeight.w400,
                                    color: selectedSupplier != null ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const PhosphorIcon(PhosphorIconsBold.caretDown, size: 14, color: Color(0xFF64748B)),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    InkWell(
                      onTap: () {
                        showDialog(
                          context: context,
                          builder: (ctx) => const SupplierManagementDialog(),
                        ).then((_) {
                          ref.read(purchaseProvider.notifier).fetchSuppliers();
                        });
                      },
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        height: 42,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDFA),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFCCFBF1)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            PhosphorIcon(PhosphorIconsBold.plus, size: 14, color: Color(0xFF0D9488)),
                            SizedBox(width: 4),
                            Text(
                              'ຮ້ານສົ່ງ',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0D9488)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 8),

              // 3. Receiver Input
              Expanded(
                flex: 4,
                child: Container(
                  height: 42,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: TextField(
                    controller: _receiverController,
                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                    decoration: const InputDecoration(
                      prefixIcon: PhosphorIcon(PhosphorIconsRegular.user, size: 15, color: Color(0xFF64748B)),
                      prefixIconConstraints: BoxConstraints(minWidth: 32, minHeight: 32),
                      hintText: 'ຜູ້ຮັບສິນຄ້າ',
                      hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 11),
                      isDense: true,
                    ),
                    onChanged: (val) {
                      ref.read(grnCartProvider.notifier).setReceiver(val);
                    },
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Row 2: Exchange Rate Input (40px) & Auto/Manual Link Toggle Switch
          Row(
            children: [
              // Exchange Rate Input (฿ to ₭)
              Expanded(
                flex: 55,
                child: Container(
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      const Padding(
                        padding: EdgeInsets.only(left: 10, right: 6),
                        child: Text(
                          '1฿ =',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0D9488),
                          ),
                        ),
                      ),
                      Expanded(
                        child: TextField(
                          controller: _rateController,
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.left,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(vertical: 10),
                            suffixText: '₭ ',
                            suffixStyle: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF64748B),
                            ),
                          ),
                          onChanged: (val) {
                            final clean = int.tryParse(val.replaceAll(RegExp(r'\D'), '')) ?? 0;
                            if (clean > 0) {
                              ref.read(grnCartProvider.notifier).setExchangeRate(clean);
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(width: 8),

              // Auto/Manual Calculation Toggle Switch (Flat Pill)
              Expanded(
                flex: 45,
                child: InkWell(
                  onTap: () {
                    setState(() {
                      _isCostLinked = !_isCostLinked;
                    });
                  },
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    height: 40,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      color: _isCostLinked ? const Color(0xFFF0FDF4) : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: _isCostLinked ? const Color(0xFFBBF7D0) : const Color(0xFFE2E8F0),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        PhosphorIcon(
                          _isCostLinked ? PhosphorIconsBold.link : PhosphorIconsBold.linkBreak,
                          size: 15,
                          color: _isCostLinked ? const Color(0xFF16A34A) : const Color(0xFF94A3B8),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _isCostLinked ? 'Auto (฿×Rate)' : 'Manual (ແຍກ)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: _isCostLinked ? const Color(0xFF15803D) : const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),

          // Row 3: Notes (full width)
          Container(
            height: 38,
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: TextField(
              controller: _noteController,
              style: const TextStyle(fontSize: 12, color: Color(0xFF0F172A)),
              decoration: const InputDecoration(
                prefixIcon: PhosphorIcon(PhosphorIconsRegular.note, size: 14, color: Color(0xFF64748B)),
                prefixIconConstraints: BoxConstraints(minWidth: 32, minHeight: 32),
                hintText: 'ໝາຍເຫດ (Notes)...',
                hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(vertical: 9),
                isDense: true,
              ),
              onChanged: (val) {
                ref.read(grnCartProvider.notifier).setNote(val);
              },
            ),
          ),
        ],
      ),
    );
  }

  // ==========================================================================
  // 2. PRODUCT SEARCH & ADD TO GRN SECTION
  // ==========================================================================
  Widget _buildProductSearchSection(List<Product> catalog) {
    final query = _searchController.text.trim().toLowerCase();
    final filtered = query.isEmpty
        ? []
        : catalog
            .where((p) =>
                p.name.toLowerCase().contains(query) ||
                (p.barcode != null && p.barcode!.toLowerCase().contains(query)) ||
                p.category.toLowerCase().contains(query))
            .take(6)
            .toList();

    return Column(
      children: [
        Container(
          height: 44,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x05000000),
                blurRadius: 4,
                offset: Offset(0, 1),
              ),
            ],
          ),
          child: TextField(
            controller: _searchController,
            focusNode: _searchFocusNode,
            onChanged: (val) {
              setState(() {
                _isSearchActive = val.trim().isNotEmpty;
              });
            },
            style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
            decoration: InputDecoration(
              hintText: 'ຄົ້ນຫາຊື່ສິນຄ້າ, Barcode ຫຼື ໝວດໝູ່...',
              hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
              prefixIcon: const PhosphorIcon(PhosphorIconsBold.magnifyingGlass, color: Color(0xFF0D9488), size: 18),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const PhosphorIcon(PhosphorIconsBold.xCircle, size: 18, color: Color(0xFF94A3B8)),
                      onPressed: () {
                        setState(() {
                          _searchController.clear();
                          _isSearchActive = false;
                        });
                      },
                    )
                  : IconButton(
                      icon: const PhosphorIcon(PhosphorIconsBold.barcode, color: Color(0xFF0D9488), size: 20),
                      onPressed: _openCameraScanner,
                    ),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            ),
          ),
        ),

        // Live Search Results Dropdown List
        if (_isSearchActive && filtered.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0A000000),
                  blurRadius: 10,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: filtered.length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
              itemBuilder: (ctx, i) {
                final p = filtered[i];
                return ListTile(
                  dense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                  leading: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDFA),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFCCFBF1)),
                    ),
                    child: Center(
                      child: Text(
                        p.name.isNotEmpty ? p.name.substring(0, 1) : '?',
                        style: const TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  title: Text(
                    p.name,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF0F172A)),
                  ),
                  subtitle: Text(
                    '${p.category} • ຫຼັກ: ${p.baseUnit} • ຕົ້ນທຶນ: ${LaoCurrencyFormatter.formatDots(p.costPerBaseUnit)} ₭',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                  trailing: const PhosphorIcon(PhosphorIconsBold.plusCircle, color: Color(0xFF0D9488), size: 22),
                  onTap: () {
                    ref.read(grnCartProvider.notifier).addItem(p);
                    HapticFeedback.lightImpact();
                    setState(() {
                      _searchController.clear();
                      _isSearchActive = false;
                    });
                  },
                );
              },
            ),
          ),
      ],
    );
  }

  // ==========================================================================
  // 3. PRODUCT LINE ITEM CARD (FLAT SHADCN STYLE, 12px RADIUS, 1px SLATE-200)
  // ==========================================================================
  Widget _buildProductLineItemCard(GrnCartItem item, int index, int exchangeRate) {
    final units = List<ProductUnit>.from(item.product.units.where((u) => u.isActive));
    units.sort((a, b) => b.multiplier.compareTo(a.multiplier));

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x05000000),
            blurRadius: 3,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // DÒNG 1: Tên sản phẩm + Category + Dropdown chọn đơn vị phẳng + Nút xóa dòng
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Product initials or mini avatar
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Center(
                  child: PhosphorIcon(PhosphorIconsRegular.package, size: 16, color: Color(0xFF64748B)),
                ),
              ),
              const SizedBox(width: 8),
              // Name and category
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.product.name,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      '${item.product.category} • ຫຼັກ: ${item.product.baseUnit}',
                      style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),

              // Dropdown chọn đơn vị nhập (Thùng/Lốc/Cái) phẳng nhỏ gọn
              if (units.isNotEmpty)
                PopupMenuButton<String>(
                  tooltip: 'ເລືອກຫົວໜ່ວຍ',
                  offset: const Offset(0, 36),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                  color: Colors.white,
                  elevation: 3,
                  onSelected: (newUnitId) {
                    final matched = units.firstWhere((u) => u.id == newUnitId);
                    ref.read(grnCartProvider.notifier).updateItemUnit(index, matched);
                  },
                  itemBuilder: (ctx) => units.map((u) {
                    return PopupMenuItem<String>(
                      value: u.id,
                      height: 38,
                      child: Row(
                        children: [
                          const PhosphorIcon(PhosphorIconsBold.package, size: 14, color: Color(0xFF0D9488)),
                          const SizedBox(width: 6),
                          Text('${u.unitName} (×${u.multiplier})', style: const TextStyle(fontSize: 12, color: Color(0xFF0F172A))),
                        ],
                      ),
                    );
                  }).toList(),
                  child: Container(
                    height: 30,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${item.unitName} (×${item.multiplier})',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(width: 4),
                        const PhosphorIcon(PhosphorIconsBold.caretDown, size: 12, color: Color(0xFF64748B)),
                      ],
                    ),
                  ),
                )
              else
                Container(
                  height: 30,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    item.unitName,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
                  ),
                ),

              const SizedBox(width: 8),

              // Nút xóa dòng nhập dùng PhosphorIconsRegular.x màu xám nhạt, hover/touch đổi màu đỏ
              _buildDeleteButton(() {
                ref.read(grnCartProvider.notifier).removeItem(index);
              }),
            ],
          ),

          const SizedBox(height: 10),

          // DÒNG 2: Ô nhập số lượng (Input bo góc 8px) + Ô nhập đơn giá Baht (฿) + Text hiển thị tự động quy đổi ra Kíp (₭) trên CÙNG 1 HÀNG NGANG
          Row(
            children: [
              // 1. Ô nhập số lượng (Input bo góc 8px kèm nút tăng giảm siêu gọn)
              Container(
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    InkWell(
                      onTap: () {
                        ref.read(grnCartProvider.notifier).stepItemQuantity(index, -1);
                      },
                      borderRadius: const BorderRadius.horizontal(left: Radius.circular(8)),
                      child: const SizedBox(
                        width: 28,
                        height: 36,
                        child: Center(
                          child: PhosphorIcon(PhosphorIconsBold.minus, size: 12, color: Color(0xFF64748B)),
                        ),
                      ),
                    ),
                    Container(
                      width: 38,
                      height: 36,
                      alignment: Alignment.center,
                      child: Text(
                        '${item.quantity}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A),
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: () {
                        ref.read(grnCartProvider.notifier).stepItemQuantity(index, 1);
                      },
                      borderRadius: const BorderRadius.horizontal(right: Radius.circular(8)),
                      child: const SizedBox(
                        width: 28,
                        height: 36,
                        child: Center(
                          child: PhosphorIcon(PhosphorIconsBold.plus, size: 12, color: Color(0xFF64748B)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 8),

              // 2. Ô nhập đơn giá Baht (฿) bo góc 8px
              Expanded(
                flex: 48,
                child: Container(
                  height: 36,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      const Padding(
                        padding: EdgeInsets.only(left: 8, right: 2),
                        child: Text(
                          '฿',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0D9488),
                          ),
                        ),
                      ),
                      Expanded(
                        child: TextFormField(
                          key: ValueKey('thb_${item.product.id}_${item.unitId}'),
                          initialValue: item.costThb > 0 ? ThbFormatter.format(item.costThb) : '0',
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                          ),
                          onChanged: (val) {
                            final thb = ThbFormatter.parse(val);
                            if (_isCostLinked) {
                              ref.read(grnCartProvider.notifier).updateItemCostThb(index, thb);
                            } else {
                              // When unlinked, only update THB without recalculating LAK
                              final current = ref.read(grnCartProvider).items[index];
                              final updatedList = List<GrnCartItem>.from(ref.read(grnCartProvider).items);
                              updatedList[index] = current.copyWith(costThb: thb);
                              ref.read(grnCartProvider.notifier).updateItemCostThb(index, thb);
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(width: 8),

              // 3. Text / Input hiển thị tự động quy đổi ra Kíp (₭)
              Expanded(
                flex: 52,
                child: Container(
                  height: 36,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: _isCostLinked ? const Color(0xFFF1F5F9) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: _isCostLinked ? const Color(0xFFE2E8F0) : const Color(0xFFCBD5E1),
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: _isCostLinked
                            ? Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  '≈ ${LaoCurrencyFormatter.formatDots(item.costLak)}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF334155),
                                    fontFeatures: [FontFeature.tabularFigures()],
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              )
                            : TextFormField(
                                key: ValueKey('lak_${item.product.id}_${item.unitId}'),
                                initialValue: LaoCurrencyFormatter.formatDots(item.costLak),
                                keyboardType: TextInputType.number,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0F172A),
                                  fontFeatures: [FontFeature.tabularFigures()],
                                ),
                                decoration: const InputDecoration(
                                  border: InputBorder.none,
                                  isDense: true,
                                  contentPadding: EdgeInsets.symmetric(vertical: 8),
                                ),
                                onChanged: (val) {
                                  final lak = LaoCurrencyFormatter.parseClean(val);
                                  ref.read(grnCartProvider.notifier).updateItemCostLak(index, lak);
                                },
                              ),
                      ),
                      const Text(
                        '₭',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),

          // DÒNG 3: Tổng tiền dòng (Line Total) & Accordion điều chỉnh giá bán lẻ nếu cần
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'ລວມ: ${item.quantity} × ${LaoCurrencyFormatter.formatDots(item.costLak)} ₭',
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
              Text(
                '${LaoCurrencyFormatter.formatDots(item.lineTotalLak)} ₭',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0F766E),
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),

          // Retail price override expandable section
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: EdgeInsets.zero,
              childrenPadding: const EdgeInsets.only(top: 4, bottom: 2),
              title: const Row(
                children: [
                  PhosphorIcon(PhosphorIconsRegular.pencilSimple, size: 14, color: Color(0xFF0D9488)),
                  SizedBox(width: 4),
                  Text(
                    'ປັບລາຄາຂາຍໜ້າຮ້ານ (Override Retail)',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF0D9488)),
                  ),
                ],
              ),
              children: units.map((u) {
                final overridePrice = item.retailPriceOverrides[u.id] ?? u.retailPrice;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: Text(
                          '${u.unitName} (ປົກກະຕິ: ${LaoCurrencyFormatter.formatDots(u.retailPrice)} ₭)',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                        ),
                      ),
                      Expanded(
                        flex: 2,
                        child: Container(
                          height: 30,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: TextFormField(
                            initialValue: LaoCurrencyFormatter.formatDots(overridePrice),
                            keyboardType: TextInputType.number,
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, fontFeatures: [FontFeature.tabularFigures()]),
                            decoration: const InputDecoration(
                              suffixText: '₭',
                              isDense: true,
                              contentPadding: EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                              border: InputBorder.none,
                            ),
                            onChanged: (val) {
                              final newP = LaoCurrencyFormatter.parseClean(val);
                              ref.read(grnCartProvider.notifier).updateRetailOverride(index, u.id, newP);
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  /// Nút xóa dòng nhập dùng PhosphorIconsRegular.x màu xám nhạt, hover/touch đổi màu đỏ
  Widget _buildDeleteButton(VoidCallback onPressed) {
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Center(
          child: PhosphorIcon(
            PhosphorIconsRegular.x,
            size: 15,
            color: Color(0xFF94A3B8),
          ),
        ),
      ),
    );
  }

  // ==========================================================================
  // EMPTY STATE PLACEHOLDER
  // ==========================================================================
  Widget _buildEmptyCartPlaceholder() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDFA),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFCCFBF1)),
              ),
              child: const PhosphorIcon(PhosphorIconsBold.package, size: 48, color: Color(0xFF0D9488)),
            ),
            const SizedBox(height: 16),
            const Text(
              'ຍັງບໍ່ມີລາຍການສິນຄ້າໃນໃບຮັບ',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 6),
            const Text(
              'ຄົ້ນຫາຊື່ສິນຄ້າ, ຍິງ Barcode ດ້ວຍເຄື່ອງສະແກນ\nຫຼື ກົດປຸ່ມສະແກນກ້ອງເພື່ອເລີ່ມເພີ່ມສິນຄ້າ',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
            ),
            const SizedBox(height: 18),
            // Nút "Thêm sản phẩm vào phiếu" viền đứt đoạn hoặc phẳng phụ Slate-100 chữ Teal
            InkWell(
              onTap: _openCameraScanner,
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFF0D9488), style: BorderStyle.solid),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    PhosphorIcon(PhosphorIconsBold.plus, size: 16, color: Color(0xFF0D9488)),
                    SizedBox(width: 8),
                    Text(
                      'ສະແກນ Barcode ເພີ່ມສິນຄ້າ',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0D9488)),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ==========================================================================
  // 4. FOOTER & SUMMARY PANEL (TABLET RIGHT COLUMN OR MOBILE BOTTOM SHEET)
  // ==========================================================================
  Widget _buildSummaryAndPaymentPanel(GrnCartState cartState, {required bool isTabletColumn}) {
    final grandTotalLak = cartState.totalLak + _shippingCostLak;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (isTabletColumn) ...[
          const Row(
            children: [
              PhosphorIcon(PhosphorIconsBold.receipt, color: Color(0xFF0D9488), size: 18),
              SizedBox(width: 8),
              Text(
                'ສະຫຼຸບຍອດ & ຊຳລະເງິນ',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
              ),
            ],
          ),
          const SizedBox(height: 16),
        ],

        // 1. Tổng tiền hàng bằng THB và LAK (hiển thị đối chiếu song song)
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('ມູນຄ່າສິນຄ້າ (THB):', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  Text(
                    '${ThbFormatter.format(cartState.totalThb)} ฿',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F766E),
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('ມູນຄ່າສິນຄ້າ (LAK):', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  Text(
                    '${LaoCurrencyFormatter.formatDots(cartState.totalLak)} ₭',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 10),

        // 2. Ô nhập phụ phí vận chuyển (Shipping / Surcharge) nếu có
        Container(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              const PhosphorIcon(PhosphorIconsRegular.truck, size: 16, color: Color(0xFF64748B)),
              const SizedBox(width: 8),
              const Text('ຄ່າຂົນສົ່ງ:', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _shippingCostController,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(vertical: 10),
                    suffixText: ' ₭',
                    suffixStyle: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                  onChanged: (val) {
                    setState(() {
                      _shippingCostLak = LaoCurrencyFormatter.parseClean(val);
                    });
                  },
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // 3. Tổng giá trị phiếu nhập in to, sắc nét dạng số tabular
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            const Text(
              'ຍອດລວມທັງໝົດ:',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
            ),
            Text(
              '${LaoCurrencyFormatter.formatDots(grandTotalLak)} ₭',
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: Color(0xFF0F172A),
                letterSpacing: -0.5,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),

        const SizedBox(height: 14),

        // 4. Payment Status 3-Segment Selector
        Row(
          children: [
            Expanded(
              child: _buildPaymentTab(
                label: 'ຈ່າຍຄົບ',
                sub: 'PAID',
                status: 'PAID',
                activeColor: const Color(0xFF0D9488),
                cartState: cartState,
              ),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: _buildPaymentTab(
                label: 'ຕິດໜີ້',
                sub: 'DEBT',
                status: 'DEBT',
                activeColor: const Color(0xFFD97706),
                cartState: cartState,
              ),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: _buildPaymentTab(
                label: 'ຈ່າຍບາງສ່ວນ',
                sub: 'PARTIAL',
                status: 'PARTIAL',
                activeColor: const Color(0xFF2563EB),
                cartState: cartState,
              ),
            ),
          ],
        ),

        // If PARTIAL, show advance payment input
        if (cartState.paymentStatus == 'PARTIAL') ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFBFDBFE)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _partialPaidController,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    decoration: InputDecoration(
                      labelText: 'ຈ່າຍກ່ອນ (LAK)',
                      labelStyle: const TextStyle(fontSize: 11, color: Color(0xFF2563EB)),
                      suffixText: '₭',
                      isDense: true,
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFBFDBFE))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFBFDBFE))),
                    ),
                    onChanged: (val) {
                      final p = LaoCurrencyFormatter.parseClean(val);
                      ref.read(grnCartProvider.notifier).setPaidAmount(p);
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('ຍັງຄ້າງໜີ້ (Debt):', style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                    Text(
                      '${LaoCurrencyFormatter.formatDots(cartState.debtAmountLak)} ₭',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFFB45309),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: 16),

        // 5. Nút "Lưu & Nhập kho" màu Teal-600 phẳng, icon PhosphorIconsBold.arrowDownLeft
        SizedBox(
          width: double.infinity,
          height: 46,
          child: ElevatedButton(
            onPressed: cartState.isSubmitting || cartState.items.isEmpty
                ? null
                : () async {
                    final success = await ref.read(grnCartProvider.notifier).submitGRN();
                    if (success && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('ບັນທຶກໃບຮັບສິນຄ້າເຂົ້າສາງສຳເລັດແລ້ວ!'),
                          backgroundColor: Color(0xFF0D9488),
                          behavior: SnackBarBehavior.floating,
                          duration: Duration(seconds: 2),
                        ),
                      );
                      Navigator.of(context).pop();
                    } else if (!success && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(cartState.errorMessage ?? 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ'),
                          backgroundColor: const Color(0xFFEF4444),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    }
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0D9488), // Teal-600
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              disabledBackgroundColor: const Color(0xFF94A3B8),
            ),
            child: cartState.isSubmitting
                ? const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                      SizedBox(width: 8),
                      Text('ກຳລັງບັນທຶກ...', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    ],
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const PhosphorIcon(PhosphorIconsBold.arrowDownLeft, size: 18, color: Colors.white),
                      const SizedBox(width: 8),
                      Text(
                        'ບັນທຶກ & ຮັບສິນຄ້າ (${cartState.items.length})',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  // ==========================================================================
  // STICKY BOTTOM BAR FOR MOBILE PORTRAIT
  // ==========================================================================
  Widget _buildStickyBottomBar(GrnCartState cartState) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        boxShadow: [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 10,
            offset: Offset(0, -3),
          ),
        ],
      ),
      child: _buildSummaryAndPaymentPanel(cartState, isTabletColumn: false),
    );
  }

  // Segment Tab for Payment Status
  Widget _buildPaymentTab({
    required String label,
    required String sub,
    required String status,
    required Color activeColor,
    required GrnCartState cartState,
  }) {
    final isSelected = cartState.paymentStatus == status;
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: () {
        ref.read(grnCartProvider.notifier).setPaymentStatus(status);
        if (status == 'PARTIAL') {
          _partialPaidController.text = LaoCurrencyFormatter.formatDots(cartState.paidAmountLak);
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? activeColor.withValues(alpha: 0.1) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? activeColor : const Color(0xFFE2E8F0),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: isSelected ? activeColor : const Color(0xFF475569),
              ),
            ),
            Text(
              sub,
              style: TextStyle(
                fontSize: 9,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? activeColor : const Color(0xFF94A3B8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
