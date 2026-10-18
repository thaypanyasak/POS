import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/localization/lao_currency_formatter.dart';
import '../../domain/models/product.dart';
import '../../domain/models/product_unit.dart';
import '../../features/pos/presentation/controllers/catalog_controller.dart';
import '../../features/pos/presentation/widgets/barcode_scanner_modal.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_button.dart';
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

/// Touch-First Multi-Product Goods Receipt Note (GRN - ໃບຮັບສິນຄ້າເຂົ້າສາງ)
/// Optimized for Cashiers, Mobile & iPad POS with Hardware Barcode Scanner integration
class PurchaseEntryScreen extends ConsumerStatefulWidget {
  const PurchaseEntryScreen({super.key});

  @override
  ConsumerState<PurchaseEntryScreen> createState() => _PurchaseEntryScreenState();
}

class _PurchaseEntryScreenState extends ConsumerState<PurchaseEntryScreen> {
  final _searchController = TextEditingController();
  final _receiverController = TextEditingController(text: 'ໄມ້ຄຳ (Meii)');
  final _noteController = TextEditingController();
  final _partialPaidController = TextEditingController();

  // Hardware Barcode Scanner buffer & timer
  String _barcodeBuffer = '';
  Timer? _barcodeBufferTimer;

  bool _isSearchActive = false;

  @override
  void initState() {
    super.initState();
    // Hardware Barcode Listener for USB / Bluetooth wireless scanners
    HardwareKeyboard.instance.addHandler(_handleKeyEvent);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(catalogProvider.notifier).fetchFromSupabase();
      ref.read(purchaseProvider.notifier).fetchSuppliers();
      ref.read(grnCartProvider.notifier).reset();
    });
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleKeyEvent);
    _barcodeBufferTimer?.cancel();
    _searchController.dispose();
    _receiverController.dispose();
    _noteController.dispose();
    _partialPaidController.dispose();
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
          backgroundColor: Colors.teal.shade700,
          duration: const Duration(seconds: 2),
        ),
      );
    } else {
      HapticFeedback.vibrate();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('ບໍ່ພົບສິນຄ້າທີ່ມີ Barcode: "$barcode"'),
          backgroundColor: Colors.deepOrange.shade600,
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

  void _showExchangeRateDialog() {
    final cartState = ref.read(grnCartProvider);
    final rateCtrl = TextEditingController(text: cartState.exchangeRate.toString());

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            PhosphorIcon(PhosphorIconsBold.arrowsLeftRight, color: AppColors.primary, size: 20),
            SizedBox(width: 8),
            Text('ປັບອັດຕາແລກປ່ຽນ', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textMain)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '1 ฿ (Baht) = ? ₭ (Kip)',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: rateCtrl,
              keyboardType: TextInputType.number,
              autofocus: true,
              style: const TextStyle(fontWeight: FontWeight.bold, fontFeatures: [FontFeature.tabularFigures()]),
              decoration: InputDecoration(
                filled: true,
                fillColor: AppColors.surfaceSubtle,
                suffixText: '₭',
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
              ),
            ),
          ],
        ),
        actions: [
          AppButton(
            label: 'ຍົກເລີກ',
            variant: AppButtonVariant.ghost,
            onPressed: () => Navigator.pop(ctx),
          ),
          AppButton(
            label: 'ຕົກລົງ',
            variant: AppButtonVariant.primary,
            icon: PhosphorIconsBold.check,
            onPressed: () {
              final newRate = int.tryParse(rateCtrl.text.replaceAll(RegExp(r'\D'), '')) ?? 720;
              if (newRate > 0) {
                ref.read(grnCartProvider.notifier).setExchangeRate(newRate);
              }
              Navigator.pop(ctx);
            },
          ),
        ],
      ),
    );
  }

  void _confirmClearCart() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            PhosphorIcon(PhosphorIconsBold.trash, color: AppColors.danger, size: 20),
            SizedBox(width: 8),
            Text('ລ້າງລາຍການຮັບສິນຄ້າ?', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textMain)),
          ],
        ),
        content: const Text(
          'ທ່ານຕ້ອງການລຶບສິນຄ້າທັງໝົດອອກຈາກໃບຮັບສິນຄ້ານີ້ແທ້ບໍ?',
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        actions: [
          AppButton(
            label: 'ຍົກເລີກ',
            variant: AppButtonVariant.ghost,
            onPressed: () => Navigator.pop(ctx),
          ),
          AppButton(
            label: 'ລຶບທັງໝົດ',
            variant: AppButtonVariant.danger,
            icon: PhosphorIconsBold.trash,
            onPressed: () {
              ref.read(grnCartProvider.notifier).reset();
              Navigator.pop(ctx);
            },
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
        child: Column(
          children: [
            // ================================================================
            // 1. TOP APP BAR (Compact, Modern, Status-rich)
            // ================================================================
            Container(
              color: AppColors.surface,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const PhosphorIcon(PhosphorIconsBold.arrowLeft, color: AppColors.textMain, size: 20),
                    onPressed: () => Navigator.of(context).pop(),
                    tooltip: 'ກັບຄືນ',
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Text(
                              'ຮັບສິນຄ້າເຂົ້າສາງ',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textMain,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.primaryLight,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: AppColors.primaryBorder),
                              ),
                              child: Text(
                                '${cartState.items.length} ລາຍການ',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primaryDark,
                                ),
                              ),
                            ),
                          ],
                        ),
                        Text(
                          '${cartState.poCode} • ${cartState.receiverName}',
                          style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  // Exchange rate chip
                  InkWell(
                    onTap: _showExchangeRateDialog,
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.primaryBorder),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const PhosphorIcon(PhosphorIconsBold.arrowsLeftRight, size: 14, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Text(
                            '1฿ = ${LaoCurrencyFormatter.formatDots(cartState.exchangeRate)}₭',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primaryDark),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  // Camera Scanner button
                  IconButton(
                    icon: const PhosphorIcon(PhosphorIconsBold.barcode, color: AppColors.primary, size: 20),
                    tooltip: 'ສະແກນກ້ອງ',
                    onPressed: _openCameraScanner,
                  ),
                  // Clear cart button
                  if (cartState.items.isNotEmpty)
                    IconButton(
                      icon: const PhosphorIcon(PhosphorIconsBold.trash, color: AppColors.danger, size: 20),
                      tooltip: 'ລ້າງລາຍການ',
                      onPressed: _confirmClearCart,
                    ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),

            // ================================================================
            // 2. SCROLLABLE CONTENT BODY (HEADER CARDS + SEARCH + CART ITEMS)
            // ================================================================
            Expanded(
              child: CustomScrollView(
                slivers: [
                  // 2.1. General Info Card (Supplier & Note)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
                      child: _buildGeneralInfoCard(purchaseState.suppliers, cartState),
                    ),
                  ),

                  // 2.2. Product Search & Catalog Picker Card
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      child: _buildProductSearchSection(catalogState.allProducts),
                    ),
                  ),

                  // 2.3. Cart Items List or Empty Placeholder
                  if (cartState.items.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: _buildEmptyCartPlaceholder(),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(12, 6, 12, 100),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            final item = cartState.items[index];
                            return _buildCartItemCard(item, index, cartState.exchangeRate);
                          },
                          childCount: cartState.items.length,
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // ================================================================
            // 3. STICKY BOTTOM CHECKOUT & SUMMARY BAR
            // ================================================================
            _buildStickyBottomBar(cartState),
          ],
        ),
      ),
    );
  }

  // ==========================================================================
  // WIDGET BUILDERS: SECTIONS & CARDS
  // ==========================================================================

  Widget _buildGeneralInfoCard(List<SupplierModel> suppliers, GrnCartState cartState) {
    final selectedSupplier = suppliers.any((s) => s.id == cartState.supplierId)
        ? suppliers.firstWhere((s) => s.id == cartState.supplierId)
        : null;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: AppStyles.card,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: PopupMenuButton<String?>(
                  tooltip: 'ເລືອກຮ້ານສົ່ງ',
                  offset: const Offset(0, 48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: AppColors.border),
                  ),
                  color: AppColors.surface,
                  onSelected: (val) {
                    ref.read(grnCartProvider.notifier).setSupplier(val);
                  },
                  itemBuilder: (ctx) => [
                    const PopupMenuItem<String?>(
                      value: null,
                      child: Text('— ບໍ່ລະບຸຮ້ານສົ່ງ —', style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
                    ),
                    ...suppliers.map((s) => PopupMenuItem<String?>(
                          value: s.id,
                          child: Row(
                            children: [
                              const PhosphorIcon(PhosphorIconsBold.storefront, size: 16, color: AppColors.primary),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(s.name, style: const TextStyle(fontSize: 13, color: AppColors.textMain), overflow: TextOverflow.ellipsis),
                              ),
                            ],
                          ),
                        )),
                  ],
                  child: Container(
                    height: 44,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceSubtle,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        const PhosphorIcon(PhosphorIconsBold.storefront, size: 16, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            selectedSupplier?.name ?? 'ເລືອກຮ້ານສົ່ງ (Supplier)...',
                            style: TextStyle(
                              fontSize: 12,
                              color: selectedSupplier != null ? AppColors.textMain : AppColors.textMuted,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const PhosphorIcon(PhosphorIconsBold.caretDown, size: 14, color: AppColors.textMuted),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const PhosphorIcon(PhosphorIconsBold.plus, size: 18),
                tooltip: 'ເພີ່ມຮ້ານສົ່ງໃໝ່',
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.primaryLight,
                  foregroundColor: AppColors.primaryDark,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: const BorderSide(color: AppColors.primaryBorder),
                  ),
                  minimumSize: const Size(44, 44),
                ),
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (ctx) => const SupplierManagementDialog(),
                  ).then((_) {
                    ref.read(purchaseProvider.notifier).fetchSuppliers();
                  });
                },
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _receiverController,
                  style: const TextStyle(fontSize: 12, color: AppColors.textMain),
                  decoration: InputDecoration(
                    labelText: 'ຜູ້ຮັບສິນຄ້າ (Receiver)',
                    labelStyle: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.surfaceSubtle,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
                  ),
                  onChanged: (val) {
                    ref.read(grnCartProvider.notifier).setReceiver(val);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _noteController,
                  style: const TextStyle(fontSize: 12, color: AppColors.textMain),
                  decoration: InputDecoration(
                    labelText: 'ໝາຍເຫດ (Notes)',
                    labelStyle: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.surfaceSubtle,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
                  ),
                  onChanged: (val) {
                    ref.read(grnCartProvider.notifier).setNote(val);
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

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
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
            boxShadow: AppStyles.softShadow,
          ),
          child: TextField(
            controller: _searchController,
            onChanged: (val) {
              setState(() {
                _isSearchActive = val.trim().isNotEmpty;
              });
            },
            decoration: InputDecoration(
              hintText: 'ຄົ້ນຫາຊື່ສິນຄ້າ ຫຼື Barcode...',
              hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
              prefixIcon: const PhosphorIcon(PhosphorIconsBold.magnifyingGlass, color: AppColors.primary, size: 18),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const PhosphorIcon(PhosphorIconsBold.xCircle, size: 18, color: AppColors.textMuted),
                      onPressed: () {
                        setState(() {
                          _searchController.clear();
                          _isSearchActive = false;
                        });
                      },
                    )
                  : IconButton(
                      icon: const PhosphorIcon(PhosphorIconsBold.barcode, color: AppColors.primary, size: 20),
                      onPressed: _openCameraScanner,
                    ),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
          ),
        ),

        // Live Search Results Dropdown List
        if (_isSearchActive && filtered.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
              boxShadow: AppStyles.softShadow,
            ),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: filtered.length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.borderSubtle),
              itemBuilder: (ctx, i) {
                final p = filtered[i];
                return ListTile(
                  dense: true,
                  leading: CircleAvatar(
                    backgroundColor: AppColors.primaryLight,
                    child: Text(
                      p.name.isNotEmpty ? p.name.substring(0, 1) : '?',
                      style: const TextStyle(color: AppColors.primaryDark, fontWeight: FontWeight.bold),
                    ),
                  ),
                  title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textMain)),
                  subtitle: Text(
                    '${p.category} • ຫຼັກ: ${p.baseUnit} • ຕົ້ນທຶນ: ${LaoCurrencyFormatter.formatDots(p.costPerBaseUnit)} ₭',
                    style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                  ),
                  trailing: const PhosphorIcon(PhosphorIconsBold.plusCircle, color: AppColors.primary, size: 22),
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

  Widget _buildEmptyCartPlaceholder() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: AppColors.primaryLight,
                shape: BoxShape.circle,
              ),
              child: const PhosphorIcon(PhosphorIconsBold.package, size: 54, color: AppColors.primary),
            ),
            const SizedBox(height: 16),
            const Text(
              'ຍັງບໍ່ມີລາຍການສິນຄ້າໃນໃບຮັບ',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textMain),
            ),
            const SizedBox(height: 6),
            const Text(
              'ຄົ້ນຫາຊື່ສິນຄ້າ ຫຼື ໃຊ້ເຄື່ອງສະແກນ Barcode\nເພື່ອເພີ່ມສິນຄ້າເຂົ້າໃບຮັບສິນຄ້າ',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 20),
            AppButton(
              label: 'ເປີດກ້ອງສະແກນ Barcode',
              icon: PhosphorIconsBold.barcode,
              size: AppButtonSize.md,
              onPressed: _openCameraScanner,
            ),
          ],
        ),
      ),
    );
  }

  // ==========================================================================
  // HIGH-DENSITY TOUCH CARD FOR EACH GRN ITEM
  // ==========================================================================

  Widget _buildCartItemCard(GrnCartItem item, int index, int exchangeRate) {
    final units = List<ProductUnit>.from(item.product.units.where((u) => u.isActive));
    units.sort((a, b) => b.multiplier.compareTo(a.multiplier));

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: AppStyles.card,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row 1: Product Name, Category Badge & Delete Button
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.product.name,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textMain,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceSubtle,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            item.product.category,
                            style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'ຂັ້ນ: ${item.unitName} (×${item.multiplier})',
                          style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // 48x48 Touch-Friendly Delete Button
              IconButton(
                icon: const PhosphorIcon(PhosphorIconsBold.trash, color: AppColors.danger, size: 18),
                tooltip: 'ລຶບສິນຄ້າ',
                style: IconButton.styleFrom(
                  minimumSize: const Size(44, 44),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () {
                  ref.read(grnCartProvider.notifier).removeItem(index);
                },
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Row 2: Packaging Unit Selector & Large Touch Steppers
          Row(
            children: [
              // Packaging Unit Popup Menu
              if (units.isNotEmpty)
                Expanded(
                  child: PopupMenuButton<String>(
                    tooltip: 'ເລືອກຫົວໜ່ວຍ',
                    offset: const Offset(0, 46),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: const BorderSide(color: AppColors.border),
                    ),
                    color: AppColors.surface,
                    onSelected: (newUnitId) {
                      final matched = units.firstWhere((u) => u.id == newUnitId);
                      ref.read(grnCartProvider.notifier).updateItemUnit(index, matched);
                    },
                    itemBuilder: (ctx) => units.map((u) {
                      return PopupMenuItem<String>(
                        value: u.id,
                        child: Row(
                          children: [
                            const PhosphorIcon(PhosphorIconsBold.package, size: 16, color: AppColors.primary),
                            const SizedBox(width: 8),
                            Text('${u.unitName} (×${u.multiplier})', style: const TextStyle(fontSize: 13, color: AppColors.textMain)),
                          ],
                        ),
                      );
                    }).toList(),
                    child: Container(
                      height: 44,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text('${item.unitName} (×${item.multiplier})', style: const TextStyle(fontSize: 12, color: AppColors.textMain)),
                          ),
                          const PhosphorIcon(PhosphorIconsBold.caretDown, size: 14, color: AppColors.textMuted),
                        ],
                      ),
                    ),
                  ),
                )
              else
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceSubtle,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(item.unitName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textMain)),
                  ),
                ),

              const SizedBox(width: 12),

              // Touch Steppers (>= 48x48 dp)
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surfaceSubtle,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    // Minus Button
                    IconButton(
                      icon: const PhosphorIcon(PhosphorIconsBold.minus, size: 16, color: AppColors.textMain),
                      style: IconButton.styleFrom(minimumSize: const Size(44, 44)),
                      onPressed: () {
                        ref.read(grnCartProvider.notifier).stepItemQuantity(index, -1);
                      },
                    ),
                    // Editable Qty Input
                    SizedBox(
                      width: 44,
                      child: Text(
                        '${item.quantity}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textMain,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                    // Plus Button
                    IconButton(
                      icon: const PhosphorIcon(PhosphorIconsBold.plus, size: 16, color: AppColors.textMain),
                      style: IconButton.styleFrom(minimumSize: const Size(44, 44)),
                      onPressed: () {
                        ref.read(grnCartProvider.notifier).stepItemQuantity(index, 1);
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Row 3: Dual Currency Costs (THB & LAK)
          Row(
            children: [
              // Cost THB Input
              Expanded(
                child: TextFormField(
                  initialValue: item.costThb > 0 ? ThbFormatter.format(item.costThb) : '0',
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, fontFeatures: [FontFeature.tabularFigures()]),
                  decoration: InputDecoration(
                    labelText: 'ຕົ້ນທຶນ ฿',
                    labelStyle: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    suffixText: '฿',
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
                  ),
                  onChanged: (val) {
                    final thb = ThbFormatter.parse(val);
                    ref.read(grnCartProvider.notifier).updateItemCostThb(index, thb);
                  },
                ),
              ),
              const SizedBox(width: 8),
              // Cost LAK Input (Direct edit won't overwrite THB)
              Expanded(
                child: TextFormField(
                  initialValue: LaoCurrencyFormatter.formatDots(item.costLak),
                  keyboardType: TextInputType.number,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, fontFeatures: [FontFeature.tabularFigures()]),
                  decoration: InputDecoration(
                    labelText: 'ຕົ້ນທຶນ ₭',
                    labelStyle: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    suffixText: '₭',
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
                  ),
                  onChanged: (val) {
                    final lak = LaoCurrencyFormatter.parseClean(val);
                    ref.read(grnCartProvider.notifier).updateItemCostLak(index, lak);
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Row 4: Line Total & Expandable Retail Overrides
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'ລວມ: ${item.quantity} × ${LaoCurrencyFormatter.formatDots(item.costLak)} ₭',
                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
              Text(
                '${LaoCurrencyFormatter.formatDots(item.lineTotalLak)} ₭',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: AppColors.primaryHover,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),

          // Collapsible Section: Retail Price Override
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: EdgeInsets.zero,
              childrenPadding: const EdgeInsets.only(top: 4, bottom: 4),
              title: const Row(
                children: [
                  PhosphorIcon(PhosphorIconsBold.notePencil, size: 16, color: AppColors.primary),
                  SizedBox(width: 4),
                  Text(
                    'ປັບລາຄາຂາຍ (Chỉnh giá bán lẻ)',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                ],
              ),
              children: units.map((u) {
                final overridePrice = item.retailPriceOverrides[u.id] ?? u.retailPrice;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: Text(
                          'ລາຄາ ${u.unitName} (ປົກກະຕິ: ${LaoCurrencyFormatter.formatDots(u.retailPrice)} ₭)',
                          style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                        ),
                      ),
                      Expanded(
                        flex: 2,
                        child: TextFormField(
                          initialValue: LaoCurrencyFormatter.formatDots(overridePrice),
                          keyboardType: TextInputType.number,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, fontFeatures: [FontFeature.tabularFigures()]),
                          decoration: InputDecoration(
                            suffixText: '₭',
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.border)),
                            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.border)),
                            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
                          ),
                          onChanged: (val) {
                            final newP = LaoCurrencyFormatter.parseClean(val);
                            ref.read(grnCartProvider.notifier).updateRetailOverride(index, u.id, newP);
                          },
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

  // ==========================================================================
  // STICKY BOTTOM BAR: REALTIME SUM, PAYMENT TABS, SAVE GRN BUTTON
  // ==========================================================================

  Widget _buildStickyBottomBar(GrnCartState cartState) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFCBD5E1))),
        boxShadow: [BoxShadow(color: Color(0x10000000), blurRadius: 12, offset: Offset(0, -3))],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Total Summary Numbers
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('ຍອດລວມທັງໝົດ (Total LAK):', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  Text(
                    '${LaoCurrencyFormatter.formatDots(cartState.totalLak)} ₭',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F172A),
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('ຍອດບາດ (THB):', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  Text(
                    '≈ ${ThbFormatter.format(cartState.totalThb)} ฿',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F766E),
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),

          // 3 Payment Status Tabs (PAID / DEBT / PARTIAL)
          Row(
            children: [
              Expanded(
                child: _buildPaymentStatusTab(
                  label: 'ຈ່າຍຄົບ',
                  sub: 'PAID',
                  status: 'PAID',
                  activeColor: const Color(0xFF059669),
                  cartState: cartState,
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: _buildPaymentStatusTab(
                  label: 'ຕິດໜີ້',
                  sub: 'DEBT',
                  status: 'DEBT',
                  activeColor: Colors.amber.shade800,
                  cartState: cartState,
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: _buildPaymentStatusTab(
                  label: 'ຈ່າຍບາງສ່ວນ',
                  sub: 'PARTIAL',
                  status: 'PARTIAL',
                  activeColor: Colors.blue.shade700,
                  cartState: cartState,
                ),
              ),
            ],
          ),

          // Advance payment & Debt amount if PARTIAL
          if (cartState.paymentStatus == 'PARTIAL') ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _partialPaidController,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    decoration: InputDecoration(
                      labelText: 'ຈ່າຍກ່ອນ (LAK)',
                      labelStyle: const TextStyle(fontSize: 11),
                      suffixText: '₭',
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onChanged: (val) {
                      final p = LaoCurrencyFormatter.parseClean(val);
                      ref.read(grnCartProvider.notifier).setPaidAmount(p);
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text('ຍັງຄ້າງໜີ້ (Debt):', style: TextStyle(fontSize: 10, color: Colors.black54)),
                      Text(
                        '${LaoCurrencyFormatter.formatDots(cartState.debtAmountLak)} ₭',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Colors.amber.shade900,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 10),

          AppButton(
            label: cartState.isSubmitting
                ? 'ກຳລັງບັນທຶກ...'
                : 'ບັນທຶກໃບຮັບສິນຄ້າ (${cartState.items.length})',
            icon: PhosphorIconsBold.floppyDisk,
            isLoading: cartState.isSubmitting,
            size: AppButtonSize.lg,
            onPressed: cartState.isSubmitting || cartState.items.isEmpty
                ? null
                : () async {
                    final success = await ref.read(grnCartProvider.notifier).submitGRN();
                    if (success && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('ບັນທຶກໃບຮັບສິນຄ້າເຂົ້າສາງສຳເລັດແລ້ວ!'),
                          backgroundColor: AppColors.primary,
                          duration: Duration(seconds: 2),
                        ),
                      );
                      Navigator.of(context).pop();
                    } else if (!success && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(cartState.errorMessage ?? 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ'),
                          backgroundColor: AppColors.danger,
                        ),
                      );
                    }
                  },
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentStatusTab({
    required String label,
    required String sub,
    required String status,
    required Color activeColor,
    required GrnCartState cartState,
  }) {
    final isSelected = cartState.paymentStatus == status;
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: () {
        ref.read(grnCartProvider.notifier).setPaymentStatus(status);
        if (status == 'PARTIAL') {
          _partialPaidController.text = LaoCurrencyFormatter.formatDots(cartState.paidAmountLak);
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? activeColor.withValues(alpha: 0.12) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? activeColor : const Color(0xFFE2E8F0),
            width: isSelected ? 1.8 : 1,
          ),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: isSelected ? activeColor : const Color(0xFF475569),
              ),
            ),
            Text(
              sub,
              style: TextStyle(
                fontSize: 9,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected ? activeColor : const Color(0xFF94A3B8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
