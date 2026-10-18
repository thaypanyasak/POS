import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../core/localization/lao_currency_formatter.dart';
import '../../core/utils/stock_format_helper.dart';
import '../../core/widgets/app_button.dart';
import '../../domain/models/product.dart';
import '../../features/pos/presentation/controllers/catalog_controller.dart';
import '../../models/purchase_order_item_model.dart';
import '../../models/purchase_order_model.dart';
import '../../providers/purchase_provider.dart';
import 'widgets/supplier_management_dialog.dart';
import 'purchase_entry_screen.dart';

/// Redesigned Enterprise GRN History Screen (Module 2)
/// 100% synchronized with Web (PurchasesView.jsx):
/// - 3 Top Stat KPI Cards (Total Cost, Supplier Debt, Total GRN Orders)
/// - Modern Filter & Search Bar with Pill Tabs
/// - ERP Data Table (Desktop/Tablet >= 1024px) & High-density Cards (< 1024px)
/// - Actions: Edit, Delete (with stock revert), View details, Pay debt
class PurchaseListScreen extends ConsumerStatefulWidget {
  const PurchaseListScreen({super.key});

  @override
  ConsumerState<PurchaseListScreen> createState() => _PurchaseListScreenState();
}

class _PurchaseListScreenState extends ConsumerState<PurchaseListScreen> {
  final _dateFormat = DateFormat('dd/MM/yyyy, hh:mm a');
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _showDebtPaymentDialog(PurchaseOrderModel po) {
    final amountController = TextEditingController(
      text: LaoCurrencyFormatter.formatDots(po.debtAmount),
    );
    final noteController = TextEditingController();
    String paymentMethod = 'CASH';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Row(
              children: [
                const PhosphorIcon(PhosphorIconsBold.creditCard, color: Color(0xFF0D9488), size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'ຊຳລະໜີ້ສິນ: ${po.id}',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF1F2),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFECDD3)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('ຍອດໜີ້ຄ້າງຊຳລະ:', style: TextStyle(color: Color(0xFFBE123C), fontWeight: FontWeight.bold, fontSize: 12)),
                        Text(
                          '${LaoCurrencyFormatter.formatDots(po.debtAmount)} ${po.primaryCurrency}',
                          style: const TextStyle(
                            color: Color(0xFFBE123C),
                            fontWeight: FontWeight.w900,
                            fontSize: 15,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Amount to pay
                  TextFormField(
                    controller: amountController,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontFeatures: [FontFeature.tabularFigures()]),
                    decoration: InputDecoration(
                      labelText: 'ຈຳນວນເງິນທີ່ຈ່າຍເພີ່ມ (${po.primaryCurrency}) *',
                      labelStyle: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF0D9488), width: 1.5)),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Payment method PopupMenu
                  PopupMenuButton<String>(
                    tooltip: 'ເລືອກຊ່ອງທາງການຊຳລະ',
                    offset: const Offset(0, 46),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFE2E8F0))),
                    color: Colors.white,
                    onSelected: (val) {
                      setDialogState(() => paymentMethod = val);
                    },
                    itemBuilder: (ctx) => const [
                      PopupMenuItem(value: 'CASH', child: Text('ເງິນສົດ (Cash)')),
                      PopupMenuItem(value: 'TRANSFER', child: Text('ໂອນເງິນ / QR (Transfer)')),
                    ],
                    child: Container(
                      height: 44,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(paymentMethod == 'CASH' ? 'ເງິນສົດ (Cash)' : 'ໂອນເງິນ / QR (Transfer)',
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF0F172A))),
                          const PhosphorIcon(PhosphorIconsBold.caretDown, size: 14, color: Color(0xFF64748B)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Note
                  TextFormField(
                    controller: noteController,
                    decoration: InputDecoration(
                      labelText: 'ໝາຍເຫດ (ທາງເລືອກ)',
                      labelStyle: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      isDense: true,
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('ຍົກເລີກ', style: TextStyle(color: Color(0xFF64748B))),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0D9488),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('ບັນທຶກການຊຳລະ'),
                onPressed: () async {
                  final amount = LaoCurrencyFormatter.parseClean(amountController.text);
                  if (amount <= 0) return;

                  final navigator = Navigator.of(ctx);
                  final messenger = ScaffoldMessenger.of(context);

                  final ok = await ref.read(purchaseProvider.notifier).addSupplierDebtPayment(
                        purchaseOrderId: po.id,
                        paymentAmount: amount,
                        currency: po.primaryCurrency,
                        paymentMethod: paymentMethod,
                        note: noteController.text,
                      );
                  if (ok && mounted) {
                    navigator.pop();
                    messenger.showSnackBar(
                      const SnackBar(
                        content: Text('ບັນທຶກການຊຳລະໜີ້ສຳເລັດແລ້ວ!'),
                        backgroundColor: Color(0xFF0D9488),
                      ),
                    );
                  }
                },
              ),
            ],
          );
        },
      ),
    );
  }

  void _confirmDeletePo(PurchaseOrderModel po) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            PhosphorIcon(PhosphorIconsBold.warningCircle, color: Color(0xFFEF4444), size: 22),
            SizedBox(width: 8),
            Text('ຢືນຢັນການລຶບໃບຮັບ?', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
          ],
        ),
        content: Text(
          'ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບໃບຮັບສິນຄ້າ "${po.id}"?\nລະບົບຈະຫັກລົບສະຕັອກຄືນໂດຍອັດຕະໂນມັດ.',
          style: const TextStyle(fontSize: 13, color: Color(0xFF475569), height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('ຍົກເລີກ', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              final ok = await ref.read(purchaseProvider.notifier).deletePurchaseOrder(po.id);
              if (ok && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('ລຶບໃບຮັບສິນຄ້າ ${po.id} ແລະ ຫັກລົບສະຕັອກຄືນສຳເລັດແລ້ວ!'),
                    backgroundColor: const Color(0xFF0D9488),
                  ),
                );
              }
            },
            child: const Text('ລຶບໃບຮັບ'),
          ),
        ],
      ),
    );
  }

  void _showPoDetailsModal(PurchaseOrderModel po) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 680, maxHeight: 600),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('ໃບຮັບສິນຄ້າ: ${po.id}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        Text('ວັນທີ: ${_dateFormat.format(po.createdAt)} • ຜູ້ຮັບ: ${po.receivedBy ?? "-"}',
                            style: const TextStyle(color: Colors.grey, fontSize: 11)),
                      ],
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(ctx),
                      icon: const PhosphorIcon(PhosphorIconsBold.x, size: 20, color: Color(0xFF0F172A)),
                    ),
                  ],
                ),
                const Divider(color: Color(0xFFE2E8F0)),
                Expanded(
                  child: ListView(
                    children: [
                      // Supplier info
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            const PhosphorIcon(PhosphorIconsBold.truck, color: Color(0xFF0D9488), size: 22),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    po.supplier?.name ?? 'ບໍ່ໄດ້ລະບຸຜູ້ສະໜອງ',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                                  ),
                                  if (po.supplier?.phone != null)
                                    Text('ໂທ: ${po.supplier!.phone}', style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                                ],
                              ),
                            ),
                            _buildPaymentBadge(po.paymentStatus),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Items list
                      const Text('ລາຍການສິນຄ້າຮັບເຂົ້າ:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A))),
                      const SizedBox(height: 8),
                      ...po.items.map((it) {
                        final itemQtyStr = _formatGrnItemQuantity(it, ref.read(catalogProvider).allProducts);
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          margin: const EdgeInsets.only(bottom: 6),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(it.productName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF0F172A))),
                                    Text('ຈຳນວນ: $itemQtyStr (ຕົ້ນທຶນ: ${LaoCurrencyFormatter.formatDots(it.costLak)} ₭ / ${it.costThb.toStringAsFixed(1)} ฿)',
                                        style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                                  ],
                                ),
                              ),
                              Text(
                                '${LaoCurrencyFormatter.formatDots(it.costLak * (it.importedBaseUnits > 0 ? it.importedBaseUnits : 1))} ₭',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, fontFeatures: [FontFeature.tabularFigures()]),
                              ),
                            ],
                          ),
                        );
                      }),
                      const SizedBox(height: 14),

                      // Payment history logs
                      if (po.payments.isNotEmpty) ...[
                        const Text('ປະຫວັດການຊຳລະເງິນ:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A))),
                        const SizedBox(height: 8),
                        ...po.payments.map((p) {
                          return Container(
                            padding: const EdgeInsets.all(8),
                            margin: const EdgeInsets.only(bottom: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0FDF4),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFFBBF7D0)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('${_dateFormat.format(p.createdAt)} (${p.paymentMethod})',
                                    style: const TextStyle(fontSize: 11, color: Color(0xFF15803D))),
                                Text('+${LaoCurrencyFormatter.formatDots(p.paymentAmount)} ${p.currency}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF15803D), fontSize: 12, fontFeatures: [FontFeature.tabularFigures()])),
                              ],
                            ),
                          );
                        }),
                      ],
                    ],
                  ),
                ),
                const Divider(color: Color(0xFFE2E8F0)),

                // Totals footer
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('ຍອດລວມ: ${LaoCurrencyFormatter.formatDots(po.totalCostLak)} ₭ (ຫຼື ${po.totalCostThb.toStringAsFixed(1)} ฿)',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF0F172A))),
                        Text('ຈ່າຍແລ້ວ: ${LaoCurrencyFormatter.formatDots(po.paidAmount)} ${po.primaryCurrency} • ຍັງເຫຼືອ: ${LaoCurrencyFormatter.formatDots(po.debtAmount)} ${po.primaryCurrency}',
                            style: TextStyle(
                              color: po.debtAmount > 0 ? const Color(0xFFBE123C) : const Color(0xFF15803D),
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            )),
                      ],
                    ),
                    if (po.debtAmount > 0)
                      AppButton(
                        label: 'ຈ່າຍໜີ້ເພີ່ມ',
                        icon: PhosphorIconsBold.creditCard,
                        size: AppButtonSize.sm,
                        onPressed: () {
                          Navigator.pop(ctx);
                          _showDebtPaymentDialog(po);
                        },
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPaymentBadge(String status) {
    Color bg;
    Color border;
    Color text;
    String label;
    Widget? icon;

    switch (status) {
      case 'PAID':
        bg = const Color(0xFFF0FDF4); // emerald-50
        border = const Color(0xFFA7F3D0); // emerald-200
        text = const Color(0xFF047857); // emerald-700
        label = 'ຈ່າຍຄົບ';
        icon = const PhosphorIcon(PhosphorIconsBold.check, size: 10, color: Color(0xFF047857));
        break;
      case 'PARTIAL':
        bg = const Color(0xFFFFFBEB); // amber-50
        border = const Color(0xFFFDE68A); // amber-200
        text = const Color(0xFFB45309); // amber-700
        label = 'ຈ່າຍບາງສ່ວນ';
        break;
      case 'DEBT':
      default:
        bg = const Color(0xFFFFF1F2); // rose-50
        border = const Color(0xFFFECDD3); // rose-200
        text = const Color(0xFFBE123C); // rose-700
        label = 'ຕິດໜີ້';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: border, width: 0.9),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            icon,
            const SizedBox(width: 3),
          ],
          Text(label, style: TextStyle(color: text, fontWeight: FontWeight.bold, fontSize: 10.5)),
        ],
      ),
    );
  }

  String _getOrderProductName(PurchaseOrderModel po) {
    if (po.productName != null && po.productName!.isNotEmpty) {
      return po.productName!;
    }
    if (po.items.isNotEmpty) {
      final firstName = po.items.first.productName;
      if (po.items.length > 1) {
        return '$firstName (+${po.items.length - 1} ລາຍການ)';
      }
      return firstName;
    }
    return 'ສິນຄ້າຮັບເຂົ້າ';
  }

  String _formatGrnItemQuantity(PurchaseOrderItemModel item, List<Product> catalog) {
    // 1. If explicit input unit_name and quantity exist
    if (item.unitName != null &&
        item.unitName!.trim().isNotEmpty &&
        item.quantity != null &&
        item.quantity! > 0) {
      final unitStr = item.unitName!.trim();
      return '${item.quantity} $unitStr';
    }

    Product? product;
    if (item.productId.isNotEmpty) {
      try {
        product = catalog.firstWhere((p) => p.id == item.productId);
      } catch (_) {}
    }

    // 2. If tier1/tier2/tier3 counts are recorded
    if (item.tier1Qty > 0 || item.tier2Qty > 0 || item.tier3Qty > 0) {
      final parts = <String>[];
      final cName = product?.cName ?? 'ແກັດ';
      final pName = product?.pName ?? 'ແພັກ';
      final pcName = product?.pcName ?? 'ອັນ';
      if (item.tier1Qty > 0) parts.add('${item.tier1Qty} $cName');
      if (item.tier2Qty > 0) parts.add('${item.tier2Qty} $pName');
      if (item.tier3Qty > 0) parts.add('${item.tier3Qty} $pcName');
      if (parts.isNotEmpty) return parts.join(' ');
    }

    // 3. Decompose from catalog product multi-tier ratios if base units exist
    final baseUnits = item.importedBaseUnits;
    if (baseUnits > 0) {
      if (product != null && product.units.isNotEmpty) {
        final decomp = StockFormatHelper.formatStockDisplay(
          baseUnits,
          product.units,
          baseUnitName: product.baseUnit,
          trackStock: true,
        );
        if (decomp.isNotEmpty) return decomp;
      }
      return '$baseUnits ${product?.baseUnit ?? 'ອັນ'}';
    }

    return '-';
  }

  String _getOrderQuantityDisplay(PurchaseOrderModel po, List<Product> catalog) {
    Product? product;
    if (po.productId != null && po.productId!.isNotEmpty) {
      try {
        product = catalog.firstWhere((p) => p.id == po.productId);
      } catch (_) {}
    }

    // 1. Single-product order with tier fields
    if (po.tier1Qty > 0 || po.tier2Qty > 0 || po.tier3Qty > 0) {
      final parts = <String>[];
      final cName = product?.cName ?? 'ແກັດ';
      final pName = product?.pName ?? 'ແພັກ';
      final pcName = product?.pcName ?? 'ອັນ';
      if (po.tier1Qty > 0) parts.add('${po.tier1Qty} $cName');
      if (po.tier2Qty > 0) parts.add('${po.tier2Qty} $pName');
      if (po.tier3Qty > 0) parts.add('${po.tier3Qty} $pcName');
      if (parts.isNotEmpty) return parts.join(' ');
    }

    // 2. Items list
    if (po.items.isNotEmpty) {
      final firstItem = po.items.first;
      final firstDisplay = _formatGrnItemQuantity(firstItem, catalog);
      if (po.items.length > 1) {
        return '$firstDisplay (+${po.items.length - 1} ລາຍການ)';
      }
      return firstDisplay;
    }

    // 3. Single product fallback with importedBaseUnits
    if (po.importedBaseUnits > 0) {
      if (product != null && product.units.isNotEmpty) {
        final decomp = StockFormatHelper.formatStockDisplay(
          po.importedBaseUnits,
          product.units,
          baseUnitName: product.baseUnit,
          trackStock: true,
        );
        if (decomp.isNotEmpty) return decomp;
      }
      return '${po.importedBaseUnits} ${product?.baseUnit ?? 'ອັນ'}';
    }

    return '-';
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(purchaseProvider);
    final allOrders = state.purchaseOrders;

    // Filter by status and search query
    final pos = allOrders.where((p) {
      if (state.filterStatus != 'ALL' && p.paymentStatus != state.filterStatus) {
        return false;
      }
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchId = p.id.toLowerCase().contains(q);
        final matchSupplier = (p.supplier?.name ?? '').toLowerCase().contains(q);
        final matchReceiver = (p.receivedBy ?? '').toLowerCase().contains(q);
        final matchProduct = (p.productName ?? '').toLowerCase().contains(q) ||
            p.items.any((it) => it.productName.toLowerCase().contains(q));
        return matchId || matchSupplier || matchReceiver || matchProduct;
      }
      return true;
    }).toList();

    // Top KPI metrics
    final totalLak = allOrders.fold<int>(0, (sum, p) => sum + p.totalCostLak);
    final totalThb = allOrders.fold<double>(0.0, (sum, p) => sum + p.totalCostThb);
    final totalDebt = allOrders.fold<int>(0, (sum, p) => sum + p.debtAmount);
    final totalCount = allOrders.length;

    final screenWidth = MediaQuery.of(context).size.width;
    final isDesktop = screenWidth >= 1024;
    final catalog = ref.watch(catalogProvider).allProducts;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. TOP HEADER TOOLBAR
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: const Color(0xFFCCFBF1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const PhosphorIcon(PhosphorIconsBold.package, color: Color(0xFF0D9488), size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          const Text(
                            'ຈັດການນຳເຂົ້າສິນຄ້າ & ໜີ້ສິນ (GRN)',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0F172A),
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Text(
                              '$totalCount',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'ບັນທຶກຮັບສິນຄ້າເຂົ້າສາງ, ປັບຕົ້ນທຶນບາດ-ກີບ & ຕິດຕາມໜີ້ຄ້າງຊຳລະ',
                        style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),

                // Refresh button
                IconButton(
                  onPressed: state.isLoading
                      ? null
                      : () {
                          ref.read(purchaseProvider.notifier).loadAll();
                        },
                  icon: state.isLoading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0D9488)),
                        )
                      : const PhosphorIcon(PhosphorIconsBold.arrowsClockwise, size: 18, color: Color(0xFF475569)),
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFFF1F5F9),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.all(10),
                  ),
                  tooltip: 'ໂຫຼດຂໍ້ມູນໃໝ່',
                ),
                const SizedBox(width: 8),

                // Supplier Manager button
                OutlinedButton.icon(
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (_) => const SupplierManagementDialog(),
                    ).then((_) => ref.read(purchaseProvider.notifier).fetchSuppliers());
                  },
                  icon: const PhosphorIcon(PhosphorIconsBold.truck, size: 16, color: Color(0xFF0F766E)),
                  label: Text('ຮ້ານສົ່ງ (${state.suppliers.length})', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF334155),
                    backgroundColor: const Color(0xFFF1F5F9),
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
                const SizedBox(width: 8),

                // + Create GRN button
                AppButton(
                  variant: AppButtonVariant.primary,
                  size: AppButtonSize.md,
                  icon: PhosphorIconsBold.plus,
                  label: 'ຮັບເຂົ້າສາງ',
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const PurchaseEntryScreen(),
                      ),
                    ).then((_) => ref.read(purchaseProvider.notifier).loadAll());
                  },
                ),
              ],
            ),
          ),

          // 2. TOP 3 STAT KPI CARDS (COMPACT ERP: 76px - 84px)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
            child: Row(
              children: [
                // Card 1: Total Purchase Cost
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: const [
                        BoxShadow(color: Color(0x05000000), blurRadius: 4, offset: Offset(0, 1)),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Text(
                                'ມູນຄ່າຮັບເຂົ້າລວມ',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                '${LaoCurrencyFormatter.formatDots(totalLak)} ₭',
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0F172A),
                                  fontFeatures: [FontFeature.tabularFigures()],
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 1),
                              Text(
                                totalThb > 0 ? '${totalThb.toStringAsFixed(1)} ฿' : '0 ฿',
                                style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold, fontFeatures: [FontFeature.tabularFigures()]),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: const Color(0xFFCCFBF1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const PhosphorIcon(PhosphorIconsBold.coins, size: 20, color: Color(0xFF0D9488)),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),

                // Card 2: Accounts Payable / Debt
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: const [
                        BoxShadow(color: Color(0x05000000), blurRadius: 4, offset: Offset(0, 1)),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Text(
                                'ໜີ້ຄ້າງຊຳລະ',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                '${LaoCurrencyFormatter.formatDots(totalDebt)} ₭',
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFFE11D48),
                                  fontFeatures: [FontFeature.tabularFigures()],
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 1),
                              Text(
                                totalDebt > 0 ? 'ຍັງຕິດໜີ້' : 'ບໍ່ມີໜີ້',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: totalDebt > 0 ? const Color(0xFFE11D48) : const Color(0xFF0D9488),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF1F2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const PhosphorIcon(PhosphorIconsBold.warningCircle, size: 20, color: Color(0xFFE11D48)),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),

                // Card 3: Total Orders
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: const [
                        BoxShadow(color: Color(0x05000000), blurRadius: 4, offset: Offset(0, 1)),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Text(
                                'ໃບຮັບທັງໝົດ',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                              ),
                              const SizedBox(height: 3),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.baseline,
                                textBaseline: TextBaseline.alphabetic,
                                children: [
                                  Text(
                                    '$totalCount',
                                    style: const TextStyle(
                                      fontSize: 20,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF0F172A),
                                      fontFeatures: [FontFeature.tabularFigures()],
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  const Text('ບິນ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                                ],
                              ),
                              const SizedBox(height: 1),
                              const Text(
                                'ຮັບເຂົ້າແລ້ວ',
                                style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const PhosphorIcon(PhosphorIconsBold.receipt, size: 20, color: Color(0xFF475569)),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 3. FILTER TABS & SEARCH BAR
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                // Pill tabs
                Expanded(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterPillTab('ທັງໝົດ', 'ALL', allOrders.length, state.filterStatus),
                        const SizedBox(width: 6),
                        _buildFilterPillTab('ຈ່າຍຄົບ', 'PAID', allOrders.where((p) => p.paymentStatus == 'PAID').length, state.filterStatus),
                        const SizedBox(width: 6),
                        _buildFilterPillTab('ຕິດໜີ້', 'DEBT', allOrders.where((p) => p.paymentStatus == 'DEBT').length, state.filterStatus),
                        const SizedBox(width: 6),
                        _buildFilterPillTab('ຈ່າຍບາງສ່ວນ', 'PARTIAL', allOrders.where((p) => p.paymentStatus == 'PARTIAL').length, state.filterStatus),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),

                // Search box (36px)
                SizedBox(
                  width: 240,
                  height: 36,
                  child: TextField(
                    controller: _searchController,
                    onChanged: (val) {
                      setState(() {
                        _searchQuery = val.trim();
                      });
                    },
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                    decoration: InputDecoration(
                      hintText: 'ຄົ້ນຫາລະຫັດ, ຮ້ານສົ່ງ...',
                      hintStyle: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                      prefixIcon: const PhosphorIcon(PhosphorIconsRegular.magnifyingGlass, size: 15, color: Color(0xFF94A3B8)),
                      prefixIconConstraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const PhosphorIcon(PhosphorIconsBold.x, size: 12, color: Color(0xFF94A3B8)),
                              onPressed: () {
                                _searchController.clear();
                                setState(() => _searchQuery = '');
                              },
                            )
                          : null,
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF0D9488))),
                      isDense: true,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 4. MAIN DATA DISPLAY (TABLE FOR DESKTOP >= 1024px, CARDS FOR MOBILE < 1024px)
          Expanded(
            child: state.isLoading
                ? const Center(child: CircularProgressIndicator())
                : pos.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            PhosphorIcon(PhosphorIconsBold.package, size: 44, color: Color(0xFFCBD5E1)),
                            SizedBox(height: 10),
                            Text('ບໍ່ພົບລາຍການຮັບສິນຄ້າເຂົ້າສາງ', style: TextStyle(color: Color(0xFF64748B), fontSize: 13, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      )
                    : isDesktop
                        ? _buildDesktopDataTable(pos, catalog)
                        : _buildMobileCardsList(pos, catalog),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterPillTab(String label, String value, int count, String currentFilter) {
    final isSelected = currentFilter == value;
    Color activeBg = const Color(0xFF0F172A);
    if (value == 'PAID') activeBg = const Color(0xFF0D9488);
    if (value == 'DEBT') activeBg = const Color(0xFFE11D48);
    if (value == 'PARTIAL') activeBg = const Color(0xFFD97706);

    return InkWell(
      onTap: () {
        ref.read(purchaseProvider.notifier).setFilterStatus(value);
      },
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: isSelected ? activeBg : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? activeBg : const Color(0xFFE2E8F0),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? Colors.white : const Color(0xFF475569),
              ),
            ),
            const SizedBox(width: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: isSelected ? Colors.white.withValues(alpha: 0.25) : const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  fontFeatures: const [FontFeature.tabularFigures()],
                  color: isSelected ? Colors.white : const Color(0xFF475569),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- DESKTOP 8-COLUMN DATA TABLE (MATCHING RECEIPT HISTORY & PRODUCT LIST DESIGN) ---
  Widget _buildDesktopDataTable(List<PurchaseOrderModel> orders, List<Product> catalog) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 6, 16, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final tableWidth = constraints.maxWidth < 1050 ? 1050.0 : constraints.maxWidth;

          return SingleChildScrollView(
            scrollDirection: Axis.vertical,
            physics: const AlwaysScrollableScrollPhysics(),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SizedBox(
                width: tableWidth,
                child: Table(
                  columnWidths: const {
                    0: FlexColumnWidth(1.2), // ລະຫັດບິນ & ວັນທີ
                    1: FlexColumnWidth(1.3), // ຮ້ານສົ່ງ
                    2: FlexColumnWidth(1.4), // ສິນຄ້າ & ຈຳນວນ
                    3: FlexColumnWidth(1.2), // ມູນຄ່າຮັບເຂົ້າ ₭
                    4: FlexColumnWidth(1.0), // ມູນຄ່າຮັບເຂົ້າ ฿
                    5: FlexColumnWidth(1.1), // ສະຖານະຊຳລະ
                    6: FlexColumnWidth(1.1), // ໜີ້ຄ້າງຊຳລະ
                    7: FixedColumnWidth(130), // ຈັດການ (Actions)
                  },
                  defaultVerticalAlignment: TableCellVerticalAlignment.middle,
                  children: [
                    // Header Row
                    TableRow(
                      decoration: const BoxDecoration(
                        color: Color(0xFFF8FAFC),
                        border: Border(
                          bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1),
                        ),
                      ),
                      children: const [
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                          child: Text('ລະຫັດບິນ & ວັນທີ', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5, color: Color(0xFF64748B))),
                        ),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 10, vertical: 11),
                          child: Text('ຮ້ານສົ່ງ', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5, color: Color(0xFF64748B))),
                        ),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 10, vertical: 11),
                          child: Text('ສິນຄ້າ & ຈຳນວນ', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5, color: Color(0xFF64748B))),
                        ),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 10, vertical: 11),
                          child: Align(
                            alignment: Alignment.centerRight,
                            child: Text('ມູນຄ່າຮັບເຂົ້າ ₭', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5, color: Color(0xFF64748B))),
                          ),
                        ),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 10, vertical: 11),
                          child: Align(
                            alignment: Alignment.centerRight,
                            child: Text('ມູນຄ່າຮັບເຂົ້າ ฿', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5, color: Color(0xFF64748B))),
                          ),
                        ),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 10, vertical: 11),
                          child: Center(
                            child: Text('ສະຖານະຊຳລະ', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5, color: Color(0xFF64748B))),
                          ),
                        ),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 10, vertical: 11),
                          child: Align(
                            alignment: Alignment.centerRight,
                            child: Text('ໜີ້ຄ້າງຊຳລະ', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5, color: Color(0xFF64748B))),
                          ),
                        ),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 8, vertical: 11),
                          child: Center(
                            child: Text('ຈັດການ', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5, color: Color(0xFF64748B))),
                          ),
                        ),
                      ],
                    ),

                    // Data Rows
                    ...orders.map((po) {
                      final prodName = _getOrderProductName(po);
                      final qtyDisplay = _getOrderQuantityDisplay(po, catalog);

                      return TableRow(
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          border: Border(
                            bottom: BorderSide(color: Color(0xFFF1F5F9), width: 1),
                          ),
                        ),
                        children: [
                          // Col 1: PO Code & Date
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  po.id,
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: Color(0xFF0F172A), fontFeatures: [FontFeature.tabularFigures()]),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  _dateFormat.format(po.createdAt),
                                  style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8), fontFeatures: [FontFeature.tabularFigures()]),
                                ),
                              ],
                            ),
                          ),

                          // Col 2: Supplier & Receiver
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  po.supplier?.name ?? 'ບໍ່ລະບຸຜູ້ສະໜອງ',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Color(0xFF1E293B)),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (po.receivedBy != null && po.receivedBy!.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    'ຜູ້ຮັບ: ${po.receivedBy}',
                                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
                                  ),
                                ],
                              ],
                            ),
                          ),

                          // Col 3: Product name & Quantity
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  prodName,
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Color(0xFF0F172A)),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  qtyDisplay,
                                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF0D9488), fontFeatures: [FontFeature.tabularFigures()]),
                                ),
                              ],
                            ),
                          ),

                          // Col 4: Total Cost LAK
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                            child: Align(
                              alignment: Alignment.centerRight,
                              child: Text(
                                '${LaoCurrencyFormatter.formatDots(po.totalCostLak)} ₭',
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, fontFeatures: [FontFeature.tabularFigures()], color: Color(0xFF0F172A)),
                              ),
                            ),
                          ),

                          // Col 5: Total Cost THB
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                            child: Align(
                              alignment: Alignment.centerRight,
                              child: Text(
                                po.totalCostThb > 0 ? '${po.totalCostThb.toStringAsFixed(1)} ฿' : '-',
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11.5, fontFeatures: [FontFeature.tabularFigures()], color: Color(0xFF475569)),
                              ),
                            ),
                          ),

                          // Col 6: Payment Status Badge
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                            child: Center(child: _buildPaymentBadge(po.paymentStatus)),
                          ),

                          // Col 7: Remaining Debt
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                            child: Align(
                              alignment: Alignment.centerRight,
                              child: Text(
                                po.debtAmount > 0 ? '${LaoCurrencyFormatter.formatDots(po.debtAmount)} ₭' : '0 ₭',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12,
                                  fontFeatures: const [FontFeature.tabularFigures()],
                                  color: po.debtAmount > 0 ? const Color(0xFFE11D48) : const Color(0xFF0D9488),
                                ),
                              ),
                            ),
                          ),

                          // Col 8: Actions (Edit, Delete, Details, Pay) - 28x28px compact buttons
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(
                                  width: 28,
                                  height: 28,
                                  child: IconButton(
                                    icon: const PhosphorIcon(PhosphorIconsRegular.pencilSimple, size: 15, color: Color(0xFF475569)),
                                    onPressed: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(builder: (_) => const PurchaseEntryScreen()),
                                      );
                                    },
                                    tooltip: 'ແກ້ໄຂ',
                                    style: IconButton.styleFrom(
                                      backgroundColor: Colors.white,
                                      side: const BorderSide(color: Color(0xFFE2E8F0)),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                      padding: EdgeInsets.zero,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                SizedBox(
                                  width: 28,
                                  height: 28,
                                  child: IconButton(
                                    icon: const PhosphorIcon(PhosphorIconsRegular.trash, size: 15, color: Color(0xFFEF4444)),
                                    onPressed: () => _confirmDeletePo(po),
                                    tooltip: 'ລຶບໃບຮັບ',
                                    style: IconButton.styleFrom(
                                      backgroundColor: const Color(0xFFFEF2F2),
                                      side: const BorderSide(color: Color(0xFFFECDD3)),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                      padding: EdgeInsets.zero,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                SizedBox(
                                  width: 28,
                                  height: 28,
                                  child: IconButton(
                                    icon: const PhosphorIcon(PhosphorIconsRegular.eye, size: 15, color: Color(0xFF0D9488)),
                                    onPressed: () => _showPoDetailsModal(po),
                                    tooltip: 'ເບິ່ງລາຍລະອຽກ',
                                    style: IconButton.styleFrom(
                                      backgroundColor: const Color(0xFFF0FDFA),
                                      side: const BorderSide(color: Color(0xFFCCFBF1)),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                      padding: EdgeInsets.zero,
                                    ),
                                  ),
                                ),
                                if (po.debtAmount > 0)
                                  Padding(
                                    padding: const EdgeInsets.only(left: 4),
                                    child: InkWell(
                                      onTap: () => _showDebtPaymentDialog(po),
                                      borderRadius: BorderRadius.circular(6),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFFF1F2),
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: const Color(0xFFFECDD3)),
                                        ),
                                        child: const Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            PhosphorIcon(PhosphorIconsBold.creditCard, size: 11, color: Color(0xFFBE123C)),
                                            SizedBox(width: 3),
                                            Text('ຊຳລະ', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFBE123C))),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      );
                    }),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // --- MOBILE CARDS LIST ---
  Widget _buildMobileCardsList(List<PurchaseOrderModel> orders, List<Product> catalog) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
      itemCount: orders.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (ctx, i) {
        final po = orders[i];
        final prodName = _getOrderProductName(po);
        final qtyDisplay = _getOrderQuantityDisplay(po, catalog);

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: const [
              BoxShadow(color: Color(0x05000000), blurRadius: 4, offset: Offset(0, 1)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Row 1: Code + Date on Left, Status Badge on Right
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Text(
                          po.id,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, fontFeatures: [FontFeature.tabularFigures()], color: Color(0xFF0F172A)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _dateFormat.format(po.createdAt),
                        style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                  _buildPaymentBadge(po.paymentStatus),
                ],
              ),
              const SizedBox(height: 8),

              // Row 2: Supplier name + Product Name & Qty
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const PhosphorIcon(PhosphorIconsRegular.truck, size: 13, color: Color(0xFF0D9488)),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                po.supplier?.name ?? 'ບໍ່ລະບຸຜູ້ສະໜອງ',
                                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          prodName,
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A)),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFCCFBF1),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFF99F6E4)),
                    ),
                    child: Text(
                      qtyDisplay,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0F766E)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Divider(height: 1, color: Color(0xFFF1F5F9)),
              const SizedBox(height: 8),

              // Row 3: Totals & Actions
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            '${LaoCurrencyFormatter.formatDots(po.totalCostLak)} ₭',
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF0F172A), fontFeatures: [FontFeature.tabularFigures()]),
                          ),
                          if (po.totalCostThb > 0) ...[
                            const SizedBox(width: 6),
                            Text(
                              '(${po.totalCostThb.toStringAsFixed(1)} ฿)',
                              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontFeatures: [FontFeature.tabularFigures()]),
                            ),
                          ],
                        ],
                      ),
                      if (po.debtAmount > 0)
                        Text(
                          'ໜີ້: ${LaoCurrencyFormatter.formatDots(po.debtAmount)} ₭',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFE11D48)),
                        ),
                    ],
                  ),
                  Row(
                    children: [
                      IconButton(
                        icon: const PhosphorIcon(PhosphorIconsRegular.trash, size: 16, color: Color(0xFFEF4444)),
                        onPressed: () => _confirmDeletePo(po),
                        tooltip: 'ລຶບ',
                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        padding: EdgeInsets.zero,
                      ),
                      IconButton(
                        icon: const PhosphorIcon(PhosphorIconsRegular.eye, size: 16, color: Color(0xFF0D9488)),
                        onPressed: () => _showPoDetailsModal(po),
                        tooltip: 'ເບິ່ງ',
                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        padding: EdgeInsets.zero,
                      ),
                      if (po.debtAmount > 0) ...[
                        const SizedBox(width: 4),
                        InkWell(
                          onTap: () => _showDebtPaymentDialog(po),
                          borderRadius: BorderRadius.circular(6),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFF1F2),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFFFECDD3)),
                            ),
                            child: const Row(
                              children: [
                                PhosphorIcon(PhosphorIconsBold.creditCard, size: 12, color: Color(0xFFBE123C)),
                                SizedBox(width: 4),
                                Text('ຊຳລະ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFBE123C))),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
