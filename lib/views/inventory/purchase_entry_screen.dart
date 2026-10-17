import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.currency_exchange, color: Colors.teal),
            SizedBox(width: 8),
            Text('ປັບອັດຕາແລກປ່ຽນ', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '1 ฿ (Baht) = ? ₭ (Kip)',
              style: TextStyle(fontSize: 13, color: Colors.black54),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: rateCtrl,
              keyboardType: TextInputType.number,
              autofocus: true,
              decoration: InputDecoration(
                filled: true,
                fillColor: Colors.grey.shade100,
                suffixText: '₭',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('ຍົກເລີກ'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.teal),
            onPressed: () {
              final newRate = int.tryParse(rateCtrl.text.replaceAll(RegExp(r'\D'), '')) ?? 720;
              if (newRate > 0) {
                ref.read(grnCartProvider.notifier).setExchangeRate(newRate);
              }
              Navigator.pop(ctx);
            },
            child: const Text('ຕົກລົງ'),
          ),
        ],
      ),
    );
  }

  void _confirmClearCart() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ລ້າງລາຍການຮັບສິນຄ້າ?'),
        content: const Text('ທ່ານຕ້ອງການລຶບສິນຄ້າທັງໝົດອອກຈາກໃບຮັບສິນຄ້ານີ້ແທ້ບໍ?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('ຍົກເລີກ'),
          ),
          TextButton(
            onPressed: () {
              ref.read(grnCartProvider.notifier).reset();
              Navigator.pop(ctx);
            },
            child: const Text('ລຶບທັງໝົດ', style: TextStyle(color: Colors.red)),
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
              color: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A)),
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
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.teal.shade50,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: Colors.teal.shade200),
                              ),
                              child: Text(
                                '${cartState.items.length} ລາຍການ',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.teal.shade800,
                                ),
                              ),
                            ),
                          ],
                        ),
                        Text(
                          '${cartState.poCode} • ${cartState.receiverName}',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                  // Exchange rate chip
                  ActionChip(
                    avatar: const Icon(Icons.currency_exchange, size: 14, color: Colors.teal),
                    label: Text(
                      '1฿ = ${LaoCurrencyFormatter.formatDots(cartState.exchangeRate)}₭',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.teal),
                    ),
                    backgroundColor: Colors.teal.shade50,
                    side: BorderSide(color: Colors.teal.shade200),
                    onPressed: _showExchangeRateDialog,
                  ),
                  const SizedBox(width: 4),
                  // Camera Scanner button
                  IconButton(
                    icon: const Icon(Icons.qr_code_scanner, color: Colors.teal),
                    tooltip: 'ສະແກນກ້ອງ',
                    onPressed: _openCameraScanner,
                  ),
                  // Clear cart button
                  if (cartState.items.isNotEmpty)
                    IconButton(
                      icon: const Icon(Icons.delete_sweep_outlined, color: Colors.redAccent),
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
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [BoxShadow(color: Color(0x05000000), blurRadius: 4, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: cartState.supplierId,
                  isDense: true,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: 'ຮ້ານສົ່ງ (Supplier)',
                    labelStyle: const TextStyle(fontSize: 12),
                    prefixIcon: const Icon(Icons.storefront_outlined, size: 18, color: Colors.teal),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  hint: const Text('ເລືອກຮ້ານສົ່ງ...', style: TextStyle(fontSize: 12)),
                  items: [
                    const DropdownMenuItem<String>(
                      value: null,
                      child: Text('— ບໍ່ລະບຸຮ້ານສົ່ງ —', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    ),
                    ...suppliers.map((s) => DropdownMenuItem<String>(
                          value: s.id,
                          child: Text(s.name, style: const TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis),
                        )),
                  ],
                  onChanged: (val) {
                    ref.read(grnCartProvider.notifier).setSupplier(val);
                  },
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filledTonal(
                icon: const Icon(Icons.add, size: 20),
                tooltip: 'ເພີ່ມຮ້ານສົ່ງໃໝ່',
                style: IconButton.styleFrom(
                  backgroundColor: Colors.teal.shade50,
                  foregroundColor: Colors.teal.shade800,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
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
                  style: const TextStyle(fontSize: 12),
                  decoration: InputDecoration(
                    labelText: 'ຜູ້ຮັບສິນຄ້າ (Receiver)',
                    labelStyle: const TextStyle(fontSize: 11),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
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
                  style: const TextStyle(fontSize: 12),
                  decoration: InputDecoration(
                    labelText: 'ໝາຍເຫດ (Notes)',
                    labelStyle: const TextStyle(fontSize: 11),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
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
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFCBD5E1)),
            boxShadow: const [BoxShadow(color: Color(0x05000000), blurRadius: 4, offset: Offset(0, 2))],
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
              hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
              prefixIcon: const Icon(Icons.search, color: Colors.teal),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () {
                        setState(() {
                          _searchController.clear();
                          _isSearchActive = false;
                        });
                      },
                    )
                  : IconButton(
                      icon: const Icon(Icons.barcode_reader, color: Colors.teal),
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
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFCBD5E1)),
              boxShadow: const [BoxShadow(color: Color(0x10000000), blurRadius: 10, offset: Offset(0, 4))],
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
                  leading: CircleAvatar(
                    backgroundColor: Colors.teal.shade50,
                    child: Text(
                      p.name.isNotEmpty ? p.name.substring(0, 1) : '?',
                      style: TextStyle(color: Colors.teal.shade800, fontWeight: FontWeight.bold),
                    ),
                  ),
                  title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  subtitle: Text(
                    '${p.category} • ຫຼັກ: ${p.baseUnit} • ຕົ້ນທຶນ: ${LaoCurrencyFormatter.formatDots(p.costPerBaseUnit)} ₭',
                    style: const TextStyle(fontSize: 11, color: Colors.black54),
                  ),
                  trailing: const Icon(Icons.add_circle, color: Colors.teal),
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
              decoration: BoxDecoration(
                color: Colors.teal.shade50,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.inventory_2_outlined, size: 54, color: Colors.teal.shade700),
            ),
            const SizedBox(height: 16),
            const Text(
              'ຍັງບໍ່ມີລາຍການສິນຄ້າໃນໃບຮັບ',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 6),
            const Text(
              'ຄົ້ນຫາຊື່ສິນຄ້າ ຫຼື ໃຊ້ເຄື່ອງສະແກນ Barcode\nເພື່ອເພີ່ມສິນຄ້າເຂົ້າໃບຮັບສິນຄ້າ',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.4),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              icon: const Icon(Icons.qr_code_scanner, size: 18),
              label: const Text('ເປີດກ້ອງສະແກນ Barcode'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.teal,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
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

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      color: Colors.white,
      child: Padding(
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
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              item.product.category,
                              style: TextStyle(fontSize: 10, color: Colors.grey.shade700),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'ຂັ້ນ: ${item.unitName} (×${item.multiplier})',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                // 48x48 Touch-Friendly Delete Button
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.redAccent, size: 20),
                  tooltip: 'ລຶບສິນຄ້າ',
                  style: IconButton.styleFrom(
                    minimumSize: const Size(48, 48),
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
                // Packaging Unit Dropdown
                if (units.isNotEmpty)
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: item.unitId,
                      isDense: true,
                      decoration: InputDecoration(
                        labelText: 'ຫົວໜ່ວຍຮັບເຂົ້າ',
                        labelStyle: const TextStyle(fontSize: 11),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      items: units.map((u) {
                        return DropdownMenuItem<String>(
                          value: u.id,
                          child: Text('${u.unitName} (×${u.multiplier})', style: const TextStyle(fontSize: 12)),
                        );
                      }).toList(),
                      onChanged: (newUnitId) {
                        final matched = units.firstWhere((u) => u.id == newUnitId);
                        ref.read(grnCartProvider.notifier).updateItemUnit(index, matched);
                      },
                    ),
                  )
                else
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(item.unitName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ),

                const SizedBox(width: 12),

                // Touch Steppers (>= 48x48 dp)
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: Row(
                    children: [
                      // Minus Button
                      IconButton(
                        icon: const Icon(Icons.remove, size: 18),
                        style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
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
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                      ),
                      // Plus Button
                      IconButton(
                        icon: const Icon(Icons.add, size: 18),
                        style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
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
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    decoration: InputDecoration(
                      labelText: 'ຕົ້ນທຶນ ฿',
                      labelStyle: const TextStyle(fontSize: 11),
                      suffixText: '฿',
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
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
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    decoration: InputDecoration(
                      labelText: 'ຕົ້ນທຶນ ₭',
                      labelStyle: const TextStyle(fontSize: 11),
                      suffixText: '₭',
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
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
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
                Text(
                  '${LaoCurrencyFormatter.formatDots(item.lineTotalLak)} ₭',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F766E),
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
                    Icon(Icons.edit_note, size: 16, color: Colors.teal),
                    SizedBox(width: 4),
                    Text(
                      'ປັບລາຄາຂາຍ (Chỉnh giá bán lẻ)',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.teal),
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
                            style: const TextStyle(fontSize: 11),
                          ),
                        ),
                        Expanded(
                          flex: 2,
                          child: TextFormField(
                            initialValue: LaoCurrencyFormatter.formatDots(overridePrice),
                            keyboardType: TextInputType.number,
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                            decoration: InputDecoration(
                              suffixText: '₭',
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
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

          // Primary Save GRN Button (Height 50dp, Teal, High-Contrast)
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              icon: cartState.isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined, size: 20),
              label: Text(
                cartState.isSubmitting
                    ? 'ກຳລັງບັນທຶກ...'
                    : 'ບັນທຶກໃບຮັບສິນຄ້າ (${cartState.items.length})',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E), // Teal 700
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 1,
              ),
              onPressed: cartState.isSubmitting || cartState.items.isEmpty
                  ? null
                  : () async {
                      final success = await ref.read(grnCartProvider.notifier).submitGRN();
                      if (success && mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('ບັນທຶກໃບຮັບສິນຄ້າເຂົ້າສາງສຳເລັດແລ້ວ!'),
                            backgroundColor: Color(0xFF0F766E),
                            duration: Duration(seconds: 2),
                          ),
                        );
                        Navigator.of(context).pop();
                      } else if (!success && mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(cartState.errorMessage ?? 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ'),
                            backgroundColor: Colors.red.shade700,
                          ),
                        );
                      }
                    },
            ),
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
