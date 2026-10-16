import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/localization/lao_currency_formatter.dart';
import '../../domain/models/product.dart';
import '../../domain/models/product_unit.dart';
import '../../features/pos/presentation/controllers/catalog_controller.dart';
import '../../features/pos/presentation/widgets/barcode_scanner_modal.dart';
import '../../providers/purchase_provider.dart';
import 'widgets/supplier_management_dialog.dart';

/// Formatter for Thai Baht (THB / ฿) with thousand dot separators (e.g. 1.600.000)
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

  static String formatTyping(String input) {
    if (input.isEmpty) return '';
    String clean = input.replaceAll(RegExp(r'[^0-9.,]'), '');
    List<String> parts;
    if (clean.contains(',')) {
      parts = clean.split(',');
    } else if (clean.contains('.') && clean.indexOf('.') == clean.length - 1) {
      parts = [clean.substring(0, clean.length - 1), ''];
    } else {
      parts = [clean.replaceAll('.', '')];
    }

    final intRaw = parts[0].replaceAll(RegExp(r'\D'), '');
    if (intRaw.isEmpty && parts.length == 1) return '';
    final intFormatted =
        intRaw.isNotEmpty
            ? LaoCurrencyFormatter.formatNumber(int.tryParse(intRaw) ?? 0)
            : '0';

    if (parts.length > 1) {
      final decRaw = parts[1].replaceAll(RegExp(r'\D'), '');
      final decTrunc = decRaw.length > 2 ? decRaw.substring(0, 2) : decRaw;
      return '$intFormatted,$decTrunc';
    }
    return intFormatted;
  }
}

/// Fullscreen View for Goods Receipt Note (GRN - ໃບຮັບສິນຄ້າເຂົ້າສາງ)
/// Standardized with Product Entry Form Screen (Scaffold + 3 Container Cards)
class PurchaseEntryScreen extends ConsumerStatefulWidget {
  const PurchaseEntryScreen({super.key});

  @override
  ConsumerState<PurchaseEntryScreen> createState() =>
      _PurchaseEntryScreenState();
}

class _PurchaseEntryScreenState extends ConsumerState<PurchaseEntryScreen> {
  final _formKey = GlobalKey<FormState>();

  // Card 1: Supplier & Receiver Info
  String? _selectedSupplierId;
  final _receivedByController = TextEditingController(text: 'ໄມ້ຄຳ (Meii)');

  // Card 2: Product & Multi-Tier Inputs
  Product? _selectedProduct;
  final _searchProductController = TextEditingController();
  final Map<String, TextEditingController> _unitQtyControllers = {};
  final _costThbController = TextEditingController(text: '0');
  final _costLakController = TextEditingController(text: '0');
  final Map<String, TextEditingController> _retailPriceControllers = {};

  // Card 3: Total Costs (2 Currencies: LAK & THB) & Debt Management
  final _totalCostLakController = TextEditingController(text: '0');
  final _totalCostThbController = TextEditingController(text: '0');

  String _paymentStatus = 'PAID'; // 'PAID', 'PARTIAL', 'DEBT'
  final _paidAmountController = TextEditingController(text: '0');
  int _debtAmount = 0;
  final _noteController = TextEditingController();

  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    // Requirement A/B: Re-fetch fresh products and suppliers from Supabase when entering GRN Form
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(catalogProvider.notifier).fetchFromSupabase();
      ref.read(purchaseProvider.notifier).fetchSuppliers();
    });
  }

  /// Form Reset / Cleanup on Unmount / Cancel
  void _resetForm() {
    _selectedProduct = null;
    for (final c in _unitQtyControllers.values) {
      c.dispose();
    }
    _unitQtyControllers.clear();
    for (final c in _retailPriceControllers.values) {
      c.dispose();
    }
    _retailPriceControllers.clear();
    _costThbController.text = '0';
    _costLakController.text = '0';
    _totalCostLakController.text = '0';
    _totalCostThbController.text = '0';
    _paidAmountController.text = '0';
    _debtAmount = 0;
    _noteController.clear();
    _searchProductController.clear();
  }


  @override
  void dispose() {
    _resetForm();
    _receivedByController.dispose();
    _searchProductController.dispose();
    _costThbController.dispose();
    _costLakController.dispose();
    _totalCostLakController.dispose();
    _totalCostThbController.dispose();
    _paidAmountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  // Fixed Hierarchy Sorting: Largest multiplier to smallest (descending)
  List<ProductUnit> get _sortedUnits {
    if (_selectedProduct == null) return [];
    final active = _selectedProduct!.units.where((u) => u.isActive).toList();
    active.sort((a, b) => b.multiplier.compareTo(a.multiplier));
    return active;
  }

  // Compound stock representation based on highest active unit (e.g. "+10 ແກັດ 2 ແພັກ")
  String _formatCompoundStock(int totalBaseUnits, List<ProductUnit> units) {
    if (units.isEmpty) return '$totalBaseUnits';
    if (units.length == 1) return '$totalBaseUnits ${units.first.unitName}';
    if (totalBaseUnits == 0) return '0 ${units.first.unitName}';

    final isNeg = totalBaseUnits < 0;
    int remaining = totalBaseUnits.abs();
    final List<String> parts = [];

    for (int i = 0; i < units.length; i++) {
      final u = units[i];
      final m = u.multiplier > 0 ? u.multiplier : 1;
      if (i < units.length - 1) {
        if (m > 1) {
          final count = remaining ~/ m;
          if (count > 0) {
            parts.add('$count ${u.unitName}');
            remaining %= m;
          }
        }
      } else {
        if (remaining > 0 || parts.isEmpty) {
          parts.add('$remaining ${u.unitName}');
        }
      }
    }

    final text = parts.join(' ');
    return isNeg ? '-$text' : text;
  }

  void _onProductSelected(Product product) {
    setState(() {
      _selectedProduct = product;

      // Clean controllers for clean slate hydration (never prefill old stock)
      for (final c in _unitQtyControllers.values) {
        c.dispose();
      }
      _unitQtyControllers.clear();

      for (final u in _sortedUnits) {
        _unitQtyControllers[u.id] = TextEditingController(text: '0');
      }

      _costThbController.text =
          product.costBaht > 0 ? ThbFormatter.format(product.costBaht) : '0';
      _costLakController.text =
          product.costKip > 0
              ? LaoCurrencyFormatter.formatNumber(product.costKip)
              : '0';

      for (final c in _retailPriceControllers.values) {
        c.dispose();
      }
      _retailPriceControllers.clear();

      for (final u in _sortedUnits) {
        _retailPriceControllers[u.id] = TextEditingController(
          text: LaoCurrencyFormatter.formatNumber(u.retailPrice),
        );
      }
    });

    _recalcTotals();
  }

  // Normalization logic: If pack qty exceeds carton ratio, roll over to cartons
  void _onUnitQtyChanged(ProductUnit unit, int index, String val) {
    final qty = int.tryParse(val) ?? 0;
    if (index == 1 && _sortedUnits.length >= 2) {
      final c1 = _sortedUnits[0];
      final m1 = c1.multiplier > 0 ? c1.multiplier : 1;
      final m2 = unit.multiplier > 0 ? unit.multiplier : 1;
      final ratio = (m1 / m2).round();
      if (ratio > 1 && qty >= ratio) {
        final addC1 = qty ~/ ratio;
        final remC2 = qty % ratio;
        final c1Ctrl = _unitQtyControllers[c1.id];
        final currentC1 = int.tryParse(c1Ctrl?.text ?? '0') ?? 0;
        if (c1Ctrl != null) {
          c1Ctrl.text = (currentC1 + addC1).toString();
        }
        final c2Ctrl = _unitQtyControllers[unit.id];
        if (c2Ctrl != null) {
          c2Ctrl.text = remC2.toString();
        }
        _recalcTotals();
        return;
      }
    }
    _recalcTotals();
  }

  int _calculateImportedBaseUnits() {
    if (_selectedProduct == null) return 0;
    int total = 0;
    for (final u in _sortedUnits) {
      final ctrl = _unitQtyControllers[u.id];
      final q = int.tryParse(ctrl?.text ?? '0') ?? 0;
      final m = u.multiplier > 0 ? u.multiplier : 1;
      total += q * m;
    }
    return total;
  }

  void _recalcTotals() {
    final bUnits = _calculateImportedBaseUnits();
    final c1 = _sortedUnits.isNotEmpty ? _sortedUnits.first : null;
    final m = (c1 != null && c1.multiplier > 0) ? c1.multiplier : 1;
    final costLakNum = LaoCurrencyFormatter.parseClean(_costLakController.text);
    final costThbNum = ThbFormatter.parse(_costThbController.text);

    final calcLak = ((costLakNum / m) * bUnits).round();
    final calcThb = (costThbNum / m) * bUnits;

    _totalCostLakController.text = LaoCurrencyFormatter.formatNumber(calcLak);
    _totalCostThbController.text = ThbFormatter.format(calcThb);

    _updateDebt();
  }

  void _updateDebt() {
    final totalLak = LaoCurrencyFormatter.parseClean(
      _totalCostLakController.text,
    );

    if (_paymentStatus == 'PAID') {
      _paidAmountController.text = LaoCurrencyFormatter.formatNumber(totalLak);
      _debtAmount = 0;
    } else if (_paymentStatus == 'DEBT') {
      _paidAmountController.text = '0';
      _debtAmount = totalLak;
    } else {
      // PARTIAL
      final paid = LaoCurrencyFormatter.parseClean(_paidAmountController.text);
      _debtAmount = (totalLak - paid).clamp(0, totalLak);
    }

    setState(() {});
  }

  void _onPaymentStatusSelected(String status) {
    setState(() => _paymentStatus = status);
    final totalLak = LaoCurrencyFormatter.parseClean(
      _totalCostLakController.text,
    );

    if (status == 'PAID') {
      _paidAmountController.text = LaoCurrencyFormatter.formatNumber(totalLak);
      _debtAmount = 0;
    } else if (status == 'DEBT') {
      _paidAmountController.text = '0';
      _debtAmount = totalLak;
    } else {
      final half = (totalLak / 2).round();
      _paidAmountController.text = LaoCurrencyFormatter.formatNumber(half);
      _debtAmount = totalLak - half;
    }
    setState(() {});
  }

  void _handleBarcodeScanned(String barcode) {
    final allProducts = ref.read(catalogProvider).allProducts;
    final trimmed = barcode.trim().toLowerCase();
    final matched =
        allProducts.where((p) {
          if (p.barcode != null && p.barcode!.toLowerCase() == trimmed) {
            return true;
          }
          if (p.units.any(
            (u) => u.barcode != null && u.barcode!.toLowerCase() == trimmed,
          )) {
            return true;
          }
          return false;
        }).firstOrNull;

    if (matched != null) {
      _onProductSelected(matched);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('ພົບສິນຄ້າ: ${matched.name}'),
          backgroundColor: const Color(0xFF0F766E),
          duration: const Duration(seconds: 2),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('ບໍ່ພົບສິນຄ້າທີ່ມີ Barcode: $barcode'),
          backgroundColor: const Color(0xFFDC2626),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _submitGRN() async {
    if (_selectedProduct == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('ກະລຸນາເລືອກສິນຄ້າທີ່ຕ້ອງການຮັບເຂົ້າສາງ!'),
          backgroundColor: Color(0xFFDC2626),
        ),
      );
      return;
    }

    final baseUnits = _calculateImportedBaseUnits();
    if (baseUnits <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'ສິນຄ້າ "${_selectedProduct!.name}" ຍັງບໍ່ໄດ້ໃສ່ຈຳນວນຮັບເຂົ້າ (> 0)!',
          ),
          backgroundColor: const Color(0xFFDC2626),
        ),
      );
      return;
    }

    final totalLak = LaoCurrencyFormatter.parseClean(
      _totalCostLakController.text,
    );
    final totalThb = ThbFormatter.parse(_totalCostThbController.text);
    final paid = LaoCurrencyFormatter.parseClean(_paidAmountController.text);
    final c1 = _sortedUnits.isNotEmpty ? _sortedUnits.first : null;
    final m = (c1 != null && c1.multiplier > 0) ? c1.multiplier : 1;
    final costLakNum = LaoCurrencyFormatter.parseClean(_costLakController.text);
    final costThbNum = ThbFormatter.parse(_costThbController.text);
    final costPerBase = (costLakNum / m).round();

    final Map<String, int> retailOverrides = {};
    for (final e in _retailPriceControllers.entries) {
      retailOverrides[e.key] = LaoCurrencyFormatter.parseClean(e.value.text);
    }

    final q1 =
        _sortedUnits.isNotEmpty
            ? (int.tryParse(
                  _unitQtyControllers[_sortedUnits[0].id]?.text ?? '0',
                ) ??
                0)
            : 0;
    final q2 =
        _sortedUnits.length > 1
            ? (int.tryParse(
                  _unitQtyControllers[_sortedUnits[1].id]?.text ?? '0',
                ) ??
                0)
            : 0;
    final q3 =
        _sortedUnits.length > 2
            ? (int.tryParse(
                  _unitQtyControllers[_sortedUnits[2].id]?.text ?? '0',
                ) ??
                0)
            : 0;

    final draft = PurchaseItemDraft(
      product: _selectedProduct!,
      tier1Qty: q1,
      tier2Qty: q2,
      tier3Qty: q3,
      importedBaseUnits: baseUnits,
      costPerBaseUnit: costPerBase,
      costThb: costThbNum,
      costLak: costLakNum,
      costVnd: 0,
      retailPriceOverrides: retailOverrides,
    );

    setState(() => _isSubmitting = true);
    final success = await ref
        .read(purchaseProvider.notifier)
        .createPurchaseOrder(
          supplierId: _selectedSupplierId,
          totalCostLak: totalLak,
          totalCostThb: totalThb,
          totalCostVnd: 0,
          primaryCurrency: 'LAK',
          paidAmount: paid,
          debtAmount: _debtAmount,
          paymentStatus: _paymentStatus,
          receivedBy: _receivedByController.text,
          note: _noteController.text,
          draftItems: [draft],
        );
    setState(() => _isSubmitting = false);

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'ບັນທຶກຮັບສິນຄ້າ "${_selectedProduct!.name}" ເຂົ້າສາງສຳເລັດແລ້ວ!',
          ),
          backgroundColor: const Color(0xFF0F766E),
        ),
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final purchaseState = ref.watch(purchaseProvider);
    final suppliers = purchaseState.suppliers;
    final catalogState = ref.watch(catalogProvider);
    final allProducts = catalogState.allProducts;

    // Default select first supplier if unselected
    if (_selectedSupplierId == null && suppliers.isNotEmpty) {
      _selectedSupplierId = suppliers.first.id;
    }

    final importedUnits = _calculateImportedBaseUnits();
    final filterQuery = _searchProductController.text.trim().toLowerCase();
    final filteredProducts =
        allProducts.where((p) {
          if (filterQuery.isEmpty) return true;
          return p.name.toLowerCase().contains(filterQuery) ||
              p.category.toLowerCase().contains(filterQuery) ||
              (p.barcode != null &&
                  p.barcode!.toLowerCase().contains(filterQuery));
        }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      // ==============================================================
      // 1. FULLSCREEN TOP HEADER (FLAT APPBAR)
      // ==============================================================
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(64),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: SafeArea(
            child: Row(
              children: [
                // Back Button
                IconButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(
                    Icons.arrow_back_rounded,
                    color: Color(0xFF334155),
                    size: 20,
                  ),
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFFF1F5F9),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  tooltip: 'ກັບຄືນ',
                ),
                const SizedBox(width: 12),

                // Main Title & Subtitle
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.inventory_2_rounded,
                            color: Color(0xFF0D9488),
                            size: 20,
                          ),
                          const SizedBox(width: 6),
                          const Flexible(
                            child: Text(
                              'ສ້າງໃບຮັບສິນຄ້າເຂົ້າສາງ (Goods Receipt Note - GRN)',
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 15,
                                color: Color(0xFF0F172A),
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFCCFBF1),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: const Color(0xFF99F6E4),
                              ),
                            ),
                            child: const Text(
                              'Single-Product Entry',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F766E),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'ນຳເຂົ້າສິນຄ້າລາຍການດຽວ, ຕົ້ນທຶນບາດ-ກີບ, ສະຕັອກບວກເພີ່ມ & ຈັດການໜີ້ສິນຜູ້ສະໜອງ',
                        style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFF64748B),
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),

                // Right Actions: Cancel & Save Buttons
                TextButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                    ),
                  ),
                  child: const Text(
                    'ຍົກເລີກ',
                    style: TextStyle(
                      color: Color(0xFF475569),
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _isSubmitting ? null : _submitGRN,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0D9488),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                    elevation: 1,
                  ),
                  child:
                      _isSubmitting
                          ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                          : Row(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              Icon(Icons.save_rounded, size: 16),
                              SizedBox(width: 6),
                              Text(
                                '💾 ບັນທຶກໃບຮັບສິນຄ້າເຂົ້າສາງ',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                ),
              ],
            ),
          ),
        ),
      ),

      // ==============================================================
      // 2. FULLSCREEN SCROLLABLE CONTENT (3 MAIN CARDS)
      // ==============================================================
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1000),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // ==========================================================
                    // 📦 CARD 1: ຂໍ້ມູນແຫຼ່ງສະໜອງ & ຜູ້ຮັບສິນຄ້າ (Supplier & Receiver Info)
                    // ==========================================================
                    _buildContainerCard(
                      icon: Icons.local_shipping_rounded,
                      title:
                          '📦 CARD 1: ຂໍ້ມູນແຫຼ່ງສະໜອງ & ຜູ້ຮັບສິນຄ້າ (Supplier & Receiver Info)',
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final isWide = constraints.maxWidth >= 600;
                          return Flex(
                            direction: isWide ? Axis.horizontal : Axis.vertical,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Column 1: Supplier Selector + Manage Button
                              Expanded(
                                flex: isWide ? 1 : 0,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        const Text(
                                          'ຮ້ານສົ່ງ / ແຫຼ່ງນຳເຂົ້າ (Supplier) *',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF1E293B),
                                          ),
                                        ),
                                        InkWell(
                                          onTap: () {
                                            showDialog(
                                              context: context,
                                              builder:
                                                  (_) =>
                                                      const SupplierManagementDialog(),
                                            );
                                          },
                                          child: const Padding(
                                            padding: EdgeInsets.symmetric(
                                              horizontal: 4,
                                              vertical: 2,
                                            ),
                                            child: Text(
                                              '+ ຈັດການຮ້ານສົ່ງ',
                                              style: TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                                color: Color(0xFF0D9488),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    DropdownButtonFormField<String>(
                                      value: _selectedSupplierId,
                                      isExpanded: true,
                                      decoration: InputDecoration(
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 10,
                                            ),
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                          borderSide: const BorderSide(
                                            color: Color(0xFFCBD5E1),
                                          ),
                                        ),
                                        filled: true,
                                        fillColor: const Color(0xFFF8FAFC),
                                      ),
                                      items:
                                          suppliers.map((s) {
                                            return DropdownMenuItem<String>(
                                              value: s.id,
                                              child: Text(
                                                '${s.name} ${s.phone != null ? "(ໂທ: ${s.phone})" : ""}',
                                                style: const TextStyle(
                                                  fontSize: 12,
                                                ),
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            );
                                          }).toList(),
                                      onChanged: (val) {
                                        setState(
                                          () => _selectedSupplierId = val,
                                        );
                                      },
                                    ),
                                  ],
                                ),
                              ),

                              if (isWide)
                                const SizedBox(width: 16)
                              else
                                const SizedBox(height: 12),

                              // Column 2: Received by User
                              Expanded(
                                flex: isWide ? 1 : 0,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'ຜູ້ຮັບສິນຄ້າເຂົ້າສາງ (Received by)',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF1E293B),
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    TextFormField(
                                      controller: _receivedByController,
                                      style: const TextStyle(fontSize: 12),
                                      decoration: InputDecoration(
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 10,
                                            ),
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                          borderSide: const BorderSide(
                                            color: Color(0xFFCBD5E1),
                                          ),
                                        ),
                                        filled: true,
                                        fillColor: const Color(0xFFF8FAFC),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 16),

                    // ==========================================================
                    // 🏷️ CARD 2: ຂໍ້ມູນສິນຄ້າ, ຕົ້ນທຶນ & ຈຳນວນຮັບເຂົ້າ (Product, Cost & Stock Summing)
                    // ==========================================================
                    _buildContainerCard(
                      icon: Icons.inventory_2_rounded,
                      title:
                          '🏷️ CARD 2: ຂໍ້ມູນສິນຄ້າ, ຕົ້ນທຶນ & ຈຳນວນຮັບເຂົ້າ (Product, Cost & Stock Summing)',
                      badge:
                          _selectedProduct != null
                              ? Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFCCFBF1),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(
                                    color: const Color(0xFF99F6E4),
                                  ),
                                ),
                                child: Text(
                                  'ສະຕັອກປະຈຸບັນ: ${_selectedProduct!.currentStockBaseUnits} ${_selectedProduct!.baseUnit}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF0F766E),
                                  ),
                                ),
                              )
                              : null,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Product Search & Dropdown Picker
                          Row(
                            children: [
                              // Product Picker
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'ເລືອກສິນຄ້າທີ່ຕ້ອງການຮັບເຂົ້າສາງ (Select Product) *',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF1E293B),
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    DropdownButtonFormField<Product>(
                                      value: _selectedProduct,
                                      isExpanded: true,
                                      decoration: InputDecoration(
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 10,
                                            ),
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                          borderSide: const BorderSide(
                                            color: Color(0xFF99F6E4),
                                          ),
                                        ),
                                        filled: true,
                                        fillColor: const Color(0xFFF0FDFA),
                                        hintText: '-- ກົດເພື່ອເລືອກສິນຄ້າ --',
                                      ),
                                      items:
                                          filteredProducts.map((p) {
                                            return DropdownMenuItem<Product>(
                                              value: p,
                                              child: Text(
                                                '${p.name} (${p.category}) ${p.barcode != null ? "• ${p.barcode}" : ""}',
                                                style: const TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF134E4A),
                                                ),
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            );
                                          }).toList(),
                                      onChanged: (p) {
                                        if (p != null) _onProductSelected(p);
                                      },
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),

                              // Barcode Scan Button
                              Padding(
                                padding: const EdgeInsets.only(top: 22),
                                child: IconButton.filledTonal(
                                  onPressed: () {
                                    showModalBottomSheet(
                                      context: context,
                                      isScrollControlled: true,
                                      backgroundColor: Colors.transparent,
                                      builder:
                                          (_) => BarcodeScannerModal(
                                            onScan: _handleBarcodeScanned,
                                          ),
                                    );
                                  },
                                  icon: const Icon(
                                    Icons.qr_code_scanner_rounded,
                                  ),
                                  style: IconButton.styleFrom(
                                    backgroundColor: const Color(0xFFE2E8F0),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                  ),
                                  tooltip: 'ສະແກນ Barcode',
                                ),
                              ),
                            ],
                          ),

                          if (_selectedProduct != null) ...[
                            const SizedBox(height: 16),

                            // Dynamic Multi-Tier Stock Inputs Box
                            Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: const Color(0xFFE2E8F0),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: const [
                                      Text(
                                        'ຈຳນວນຮັບເຂົ້າສາງ (ປ້ອນຈຳນວນທີ່ນຳເຂົ້າໃໝ່ - ບໍ່ນັບສະຕັອກເກົ່າ):',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF0F172A),
                                        ),
                                      ),
                                      Text(
                                        '* ຖ້າປ້ອນແພັກເກີນອັດຕາສ່ວນ ລະບົບຈະປັບເປັນລັງອັດຕະໂນມັດ',
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontStyle: FontStyle.italic,
                                          color: Color(0xFF64748B),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),

                                  LayoutBuilder(
                                    builder: (context, constraints) {
                                      final isSmall =
                                          constraints.maxWidth < 650;
                                      return Wrap(
                                        spacing: 10,
                                        runSpacing: 10,
                                        children: [
                                          for (int i = 0; i < _sortedUnits.length; i++) ...[
                                            Builder(
                                              builder: (context) {
                                                final u = _sortedUnits[i];
                                                final isBase = u.isBaseUnit || u.multiplier == 1 || i == _sortedUnits.length - 1;
                                                return _buildStockInputItem(
                                                  width: isSmall ? 140 : 180,
                                                  label: '${u.unitName} (C${i + 1})',
                                                  sublabel: isBase ? 'Base' : '1x${u.multiplier}',
                                                  controller: _unitQtyControllers[u.id] ?? TextEditingController(text: '0'),
                                                  onChanged: (v) => _onUnitQtyChanged(u, i, v),
                                                );
                                              },
                                            ),
                                          ],

                                          // Live Summing Box (Compound display)
                                          Container(
                                            width: isSmall ? 290 : 260,
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 14,
                                              vertical: 10,
                                            ),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFF0FDFA),
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                              border: Border.all(
                                                color: const Color(0xFF99F6E4),
                                              ),
                                            ),
                                            child: Column(
                                              mainAxisAlignment:
                                                  MainAxisAlignment.center,
                                              children: [
                                                const Text(
                                                  'ຍອດບວກເພີ່ມເຂົ້າສາງ',
                                                  style: TextStyle(
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.bold,
                                                    color: Color(0xFF0F766E),
                                                  ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  '+${_formatCompoundStock(importedUnits, _sortedUnits)}',
                                                  style: const TextStyle(
                                                    fontSize: 16,
                                                    fontWeight: FontWeight.w900,
                                                    color: Color(0xFF0D9488),
                                                    fontFamily: 'monospace',
                                                  ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  'ລວມສະຕັອກໃໝ່ທັງໝົດ: ${_formatCompoundStock(_selectedProduct!.currentStockBaseUnits + importedUnits, _sortedUnits)}',
                                                  style: const TextStyle(
                                                    fontSize: 11,
                                                    color: Color(0xFF14B8A6),
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      );
                                    },
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),

                            // Cost Breakdown (THB & LAK)
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'ຕົ້ນທຶນ ฿ (THB) / ຍົກລັງ',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF1E293B),
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      TextFormField(
                                        controller: _costThbController,
                                        keyboardType: TextInputType.text,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          fontFamily: 'monospace',
                                        ),
                                        decoration: InputDecoration(
                                          contentPadding:
                                              const EdgeInsets.symmetric(
                                                horizontal: 12,
                                                vertical: 10,
                                              ),
                                          suffixText: '฿',
                                          suffixStyle: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                          ),
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(
                                              10,
                                            ),
                                            borderSide: const BorderSide(
                                              color: Color(0xFFCBD5E1),
                                            ),
                                          ),
                                          filled: true,
                                          fillColor: Colors.white,
                                        ),
                                        onChanged: (v) {
                                          final formatted = ThbFormatter.formatTyping(v);
                                          _costThbController.value = TextEditingValue(
                                            text: formatted,
                                            selection: TextSelection.collapsed(offset: formatted.length),
                                          );
                                          _recalcTotals();
                                        },
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'ຕົ້ນທຶນ ₭ (LAK) / ຍົກລັງ *',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF1E293B),
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      TextFormField(
                                        controller: _costLakController,
                                        keyboardType: TextInputType.number,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          fontFamily: 'monospace',
                                        ),
                                        decoration: InputDecoration(
                                          contentPadding:
                                              const EdgeInsets.symmetric(
                                                horizontal: 12,
                                                vertical: 10,
                                              ),
                                          suffixText: '₭',
                                          suffixStyle: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                          ),
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(
                                              10,
                                            ),
                                            borderSide: const BorderSide(
                                              color: Color(0xFFCBD5E1),
                                            ),
                                          ),
                                          filled: true,
                                          fillColor: Colors.white,
                                        ),
                                        onChanged: (v) {
                                          final parsed =
                                              LaoCurrencyFormatter.parseClean(
                                                v,
                                              );
                                          _costLakController
                                              .value = TextEditingValue(
                                            text:
                                                LaoCurrencyFormatter.formatNumber(
                                                  parsed,
                                                ),
                                            selection: TextSelection.collapsed(
                                              offset:
                                                  LaoCurrencyFormatter.formatNumber(
                                                    parsed,
                                                  ).length,
                                            ),
                                          );
                                          _recalcTotals();
                                        },
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),

                            // Retail Price Overrides
                            if (_sortedUnits.isNotEmpty) ...[
                              const Divider(color: Color(0xFFE2E8F0)),
                              const SizedBox(height: 6),
                              const Text(
                                'ກວດສອບ & ປັບລາຄາຂາຍຍ່ອຍ (Retail Price Overrides):',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 12,
                                runSpacing: 10,
                                children: [
                                  for (int i = 0; i < _sortedUnits.length; i++) ...[
                                    Builder(
                                      builder: (context) {
                                        final u = _sortedUnits[i];
                                        final ctrl = _retailPriceControllers[u.id];
                                        return Container(
                                          width: 220,
                                          padding: const EdgeInsets.all(10),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFF8FAFC),
                                            borderRadius: BorderRadius.circular(
                                              10,
                                            ),
                                            border: Border.all(
                                              color: const Color(0xFFE2E8F0),
                                            ),
                                          ),
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                'ລາຄາຂາຍ: ${u.unitName} (C${i + 1})',
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF334155),
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              TextFormField(
                                                controller: ctrl,
                                                keyboardType:
                                                    TextInputType.number,
                                                textAlign: TextAlign.right,
                                                style: const TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.bold,
                                                  fontFamily: 'monospace',
                                                ),
                                                decoration: InputDecoration(
                                                  contentPadding:
                                                      const EdgeInsets.symmetric(
                                                        horizontal: 8,
                                                        vertical: 8,
                                                      ),
                                                  suffixText: ' ₭',
                                                  suffixStyle: const TextStyle(
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                  isDense: true,
                                                  border: OutlineInputBorder(
                                                    borderRadius:
                                                        BorderRadius.circular(8),
                                                    borderSide: const BorderSide(
                                                      color: Color(0xFFCBD5E1),
                                                    ),
                                                  ),
                                                  filled: true,
                                                  fillColor: Colors.white,
                                                ),
                                                onChanged: (val) {
                                                  if (ctrl == null) return;
                                                  final parsed =
                                                      LaoCurrencyFormatter.parseClean(
                                                        val,
                                                      );
                                                  ctrl.value = TextEditingValue(
                                                    text:
                                                        LaoCurrencyFormatter.formatNumber(
                                                          parsed,
                                                        ),
                                                    selection:
                                                        TextSelection.collapsed(
                                                          offset:
                                                              LaoCurrencyFormatter.formatNumber(
                                                                parsed,
                                                              ).length,
                                                        ),
                                                  );
                                                },
                                              ),
                                            ],
                                          ),
                                        );
                                      },
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ] else ...[
                            const SizedBox(height: 24),
                            Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: const Color(0xFFE2E8F0),
                                  style: BorderStyle.solid,
                                ),
                              ),
                              child: const Center(
                                child: Text(
                                  'ກະລຸນາເລືອກສິນຄ້າດ້ານເທິງເພື່ອເລີ່ມຕົ້ນປ້ອນຈຳນວນ ແລະ ລາຄາຮັບເຂົ້າສາງ.',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF94A3B8),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // ==========================================================
                    // 💰 CARD 3: ຍອດລວມຕົ້ນທຶນຊື້ & ຈັດການໜີ້ສິນ (Total Cost & AP)
                    // ==========================================================
                    _buildContainerCard(
                      icon: Icons.payments_rounded,
                      title:
                          '💰 CARD 3: ຍອດລວມຕົ້ນທຶນຊື້ & ຈັດການໜີ້ສິນ (Total Cost & Accounts Payable)',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // 2 Independent Currency Inputs Row (Grid 2 cols: 50% - 50%)
                          LayoutBuilder(
                            builder: (context, constraints) {
                              final isWide = constraints.maxWidth >= 600;
                              final lakBox = _buildCurrencyTotalBox(
                                label: 'ຍອດລວມ ₭ (LAK)',
                                currencySymbol: '₭',
                                currencyBadge: 'ເງິນກີບລາວ',
                                controller: _totalCostLakController,
                                isKip: true,
                                primaryColor: const Color(0xFF0D9488),
                                onChanged: (v) {
                                  final parsed =
                                      LaoCurrencyFormatter.parseClean(v);
                                  _totalCostLakController
                                      .value = TextEditingValue(
                                    text: LaoCurrencyFormatter.formatNumber(
                                      parsed,
                                    ),
                                    selection: TextSelection.collapsed(
                                      offset:
                                          LaoCurrencyFormatter.formatNumber(
                                            parsed,
                                          ).length,
                                    ),
                                  );
                                  _updateDebt();
                                },
                              );
                              final thbBox = _buildCurrencyTotalBox(
                                label: 'ຍອດລວມ ฿ (THB)',
                                currencySymbol: '฿',
                                currencyBadge: 'ເງິນບາດໄທ',
                                controller: _totalCostThbController,
                                isKip: false,
                                primaryColor: const Color(0xFFD97706),
                              );

                              if (isWide) {
                                return Row(
                                  children: [
                                    Expanded(child: lakBox),
                                    const SizedBox(width: 14),
                                    Expanded(child: thbBox),
                                  ],
                                );
                              } else {
                                return Column(
                                  children: [
                                    lakBox,
                                    const SizedBox(height: 12),
                                    thbBox,
                                  ],
                                );
                              }
                            },
                          ),
                          const SizedBox(height: 16),

                          // Segmented Payment Buttons
                          Row(
                            children: [
                              const Text(
                                'ຮູບແບບການຊຳລະ: ',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1E293B),
                                ),
                              ),
                              const SizedBox(width: 8),
                              _buildPaymentStatusChip(
                                label: 'ຈ່າຍຄົບ (PAID)',
                                status: 'PAID',
                                activeColor: const Color(0xFF0D9488),
                              ),
                              const SizedBox(width: 8),
                              _buildPaymentStatusChip(
                                label: 'ຕິດໜີ້ (DEBT)',
                                status: 'DEBT',
                                activeColor: const Color(0xFFDC2626),
                              ),
                              const SizedBox(width: 8),
                              _buildPaymentStatusChip(
                                label: 'ຈ່າຍບາງສ່ວນ (PARTIAL)',
                                status: 'PARTIAL',
                                activeColor: const Color(0xFF2563EB),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // Dynamic Debt Calculation Row
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'ຈຳນວນເງິນທີ່ຈ່າຍແລ້ວ (Paid Amount ₭)',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF475569),
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    TextFormField(
                                      controller: _paidAmountController,
                                      enabled: _paymentStatus == 'PARTIAL',
                                      keyboardType: TextInputType.number,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        fontFamily: 'monospace',
                                      ),
                                      decoration: InputDecoration(
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 10,
                                            ),
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                          borderSide: const BorderSide(
                                            color: Color(0xFFCBD5E1),
                                          ),
                                        ),
                                        filled: true,
                                        fillColor:
                                            _paymentStatus == 'PARTIAL'
                                                ? Colors.white
                                                : const Color(0xFFF1F5F9),
                                      ),
                                      onChanged: (v) {
                                        final parsed =
                                            LaoCurrencyFormatter.parseClean(v);
                                        _paidAmountController
                                            .value = TextEditingValue(
                                          text:
                                              LaoCurrencyFormatter.formatNumber(
                                                parsed,
                                              ),
                                          selection: TextSelection.collapsed(
                                            offset:
                                                LaoCurrencyFormatter.formatNumber(
                                                  parsed,
                                                ).length,
                                          ),
                                        );
                                        _updateDebt();
                                      },
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 16),

                              // Debt Balance Card
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 12,
                                  ),
                                  decoration: BoxDecoration(
                                    color:
                                        _debtAmount > 0
                                            ? const Color(0xFFFEF2F2)
                                            : const Color(0xFFF0FDFA),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color:
                                          _debtAmount > 0
                                              ? const Color(0xFFFECACA)
                                              : const Color(0xFF99F6E4),
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'ຍອດໜີ້ຄ້າງຊຳລະ (DEBT BALANCE)',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.w900,
                                              color:
                                                  _debtAmount > 0
                                                      ? const Color(0xFF991B1B)
                                                      : const Color(0xFF0F766E),
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            _debtAmount > 0
                                                ? 'ຍັງຄ້າງຈ່າຍຜູ້ສະໜອງ'
                                                : 'ຊຳລະຄົບຖ້ວນ 100% (PAID)',
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: Color(0xFF475569),
                                            ),
                                          ),
                                        ],
                                      ),
                                      Text(
                                        '${LaoCurrencyFormatter.formatNumber(_debtAmount)} ₭',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w900,
                                          color:
                                              _debtAmount > 0
                                                  ? const Color(0xFFDC2626)
                                                  : const Color(0xFF0D9488),
                                          fontFamily: 'monospace',
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // Note Textarea
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'ໝາຍເຫດ (Note)',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF475569),
                                ),
                              ),
                              const SizedBox(height: 6),
                              TextFormField(
                                controller: _noteController,
                                maxLines: 3,
                                style: const TextStyle(fontSize: 12),
                                decoration: InputDecoration(
                                  hintText:
                                      'ຕົວຢ່າງ: ຄ່າສິນຄ້າຄ້າງຈ່າຍ, ນັດຊຳລະວັນທີ...',
                                  hintStyle: const TextStyle(
                                    fontSize: 11,
                                    color: Color(0xFF94A3B8),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 10,
                                  ),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: const BorderSide(
                                      color: Color(0xFFCBD5E1),
                                    ),
                                  ),
                                  filled: true,
                                  fillColor: const Color(0xFFF8FAFC),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- REUSABLE UI BUILDER HELPERS ---

  Widget _buildContainerCard({
    required IconData icon,
    required String title,
    Widget? badge,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFCCFBF1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(icon, size: 16, color: const Color(0xFF0F766E)),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 12,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
              if (badge != null) badge,
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  Widget _buildStockInputItem({
    required double width,
    required String label,
    required String sublabel,
    required TextEditingController controller,
    required ValueChanged<String> onChanged,
  }) {
    return Container(
      width: width,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0F172A),
                ),
              ),
              Text(
                sublabel,
                style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          TextFormField(
            controller: controller,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w900,
              fontFamily: 'monospace',
            ),
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 8,
                vertical: 8,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
              ),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
            ),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _buildCurrencyTotalBox({
    required String label,
    required String currencySymbol,
    required String currencyBadge,
    required TextEditingController controller,
    required bool isKip,
    required Color primaryColor,
    ValueChanged<String>? onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      color: primaryColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      currencySymbol,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: primaryColor,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF334155),
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: primaryColor.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: primaryColor.withValues(alpha: 0.25),
                  ),
                ),
                child: Text(
                  currencyBadge,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: primaryColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: controller,
            keyboardType:
                isKip
                    ? TextInputType.number
                    : const TextInputType.numberWithOptions(decimal: true),
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              fontFamily: 'monospace',
              color: Color(0xFF0F172A),
            ),
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 10,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: primaryColor, width: 1.5),
              ),
              filled: true,
              fillColor: Colors.white,
            ),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentStatusChip({
    required String label,
    required String status,
    required Color activeColor,
  }) {
    final isSelected = _paymentStatus == status;
    return InkWell(
      onTap: () => _onPaymentStatusSelected(status),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? activeColor : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? activeColor : const Color(0xFFCBD5E1),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: isSelected ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }
}
