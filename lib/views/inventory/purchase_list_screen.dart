import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/utils/lao_currency_formatter.dart';
import '../../models/purchase_order_model.dart';
import '../../providers/purchase_provider.dart';
import 'widgets/supplier_management_dialog.dart';
import 'purchase_entry_screen.dart';

class PurchaseListScreen extends ConsumerStatefulWidget {
  const PurchaseListScreen({super.key});

  @override
  ConsumerState<PurchaseListScreen> createState() => _PurchaseListScreenState();
}

class _PurchaseListScreenState extends ConsumerState<PurchaseListScreen> {
  final _dateFormat = DateFormat('dd/MM/yyyy HH:mm');

  void _showDebtPaymentDialog(PurchaseOrderModel po) {
    final amountController = TextEditingController(
      text: LaoCurrencyFormatter.formatNumber(po.debtAmount),
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
                const Icon(Icons.payment_rounded, color: Color(0xFF0F766E)),
                const SizedBox(width: 8),
                Text('ຊຳລະໜີ້ສິນ: ${po.id}', style: const TextStyle(fontSize: 16)),
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
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('ຍອດໜີ້ຄ້າງຊຳລະ:', style: TextStyle(color: Color(0xFF991B1B), fontWeight: FontWeight.bold)),
                        Text(
                          '${LaoCurrencyFormatter.formatNumber(po.debtAmount)} ${po.primaryCurrency}',
                          style: const TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w900, fontSize: 16),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Amount to pay
                  TextFormField(
                    controller: amountController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'ຈຳນວນເງິນທີ່ຈ່າຍເພີ່ມ (${po.primaryCurrency}) *',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Payment method
                  DropdownButtonFormField<String>(
                    value: paymentMethod,
                    decoration: InputDecoration(
                      labelText: 'ຊ່ອງທາງການຊຳລະ',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      isDense: true,
                    ),
                    items: const [
                      DropdownMenuItem(value: 'CASH', child: Text('ເງິນສົດ (Cash)')),
                      DropdownMenuItem(value: 'TRANSFER', child: Text('ໂອນເງິນ / QR (Transfer)')),
                    ],
                    onChanged: (val) {
                      if (val != null) setDialogState(() => paymentMethod = val);
                    },
                  ),
                  const SizedBox(height: 12),

                  // Note
                  TextFormField(
                    controller: noteController,
                    decoration: InputDecoration(
                      labelText: 'ໝາຍເຫດ (Note)',
                      hintText: 'ເຊັ່ນ: ຈ່າຍຄ່າເຄື່ອງງວດ 2 ຜ່ານ BCEL...',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      isDense: true,
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('ຍົກເລີກ'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F766E),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
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
                        backgroundColor: Color(0xFF0F766E),
                      ),
                    );
                  }
                },
                child: const Text('ບັນທຶກການຈ່າຍ', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          );
        },
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
                    IconButton(onPressed: () => Navigator.pop(ctx), icon: const Icon(Icons.close)),
                  ],
                ),
                const Divider(),
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
                            const Icon(Icons.local_shipping_outlined, color: Color(0xFF0F766E)),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    po.supplier?.name ?? 'ບໍ່ໄດ້ລະບຸຜູ້ສະໜອງ',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                  if (po.supplier?.phone != null)
                                    Text('ໂທ: ${po.supplier!.phone}', style: const TextStyle(color: Colors.grey, fontSize: 11)),
                                ],
                              ),
                            ),
                            _buildPaymentBadge(po.paymentStatus),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Items list
                      const Text('ລາຍການສິນຄ້າຮັບເຂົ້າ:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      const SizedBox(height: 8),
                      ...po.items.map((it) {
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
                                    Text(it.productName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                    Text(
                                      'ຮັບເຂົ້າ: ${it.importedBaseUnits} Base Units (${it.tier1Qty} ລັງ, ${it.tier2Qty} ແພັກ, ${it.tier3Qty} ອັນ)',
                                      style: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
                                    ),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text('${LaoCurrencyFormatter.formatNumber(it.costLak)} ₭',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                  if (it.costThb > 0)
                                    Text('${it.costThb.toStringAsFixed(1)} ฿', style: const TextStyle(color: Colors.grey, fontSize: 11)),
                                ],
                              ),
                            ],
                          ),
                        );
                      }),
                      const SizedBox(height: 14),

                      // Payment history logs
                      if (po.payments.isNotEmpty) ...[
                        const Text('ປະຫວັດການຊຳລະເງິນ:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
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
                                    style: const TextStyle(fontSize: 11, color: Color(0xFF166534))),
                                Text('+${LaoCurrencyFormatter.formatNumber(p.paymentAmount)} ${p.currency}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF15803D), fontSize: 12)),
                              ],
                            ),
                          );
                        }),
                      ],
                    ],
                  ),
                ),
                const Divider(),

                // Totals footer
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('ຍອດລວມ: ${LaoCurrencyFormatter.formatNumber(po.totalCostLak)} ₭ (ຫຼື ${po.totalCostThb.toStringAsFixed(1)} ฿)',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                        Text('ຈ່າຍແລ້ວ: ${LaoCurrencyFormatter.formatNumber(po.paidAmount)} ${po.primaryCurrency} • ຍັງເຫຼືອ: ${LaoCurrencyFormatter.formatNumber(po.debtAmount)} ${po.primaryCurrency}',
                            style: TextStyle(
                              color: po.debtAmount > 0 ? Colors.red : Colors.green[800],
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            )),
                      ],
                    ),
                    if (po.debtAmount > 0)
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0F766E),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: () {
                          Navigator.pop(ctx);
                          _showDebtPaymentDialog(po);
                        },
                        icon: const Icon(Icons.payment, size: 16, color: Colors.white),
                        label: const Text('ຈ່າຍໜີ້ເພີ່ມ', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
    Color text;
    String label;

    switch (status) {
      case 'PAID':
        bg = const Color(0xFFDCFCE7);
        text = const Color(0xFF15803D);
        label = 'ຈ່າຍຄົບແລ້ວ (PAID)';
        break;
      case 'PARTIAL':
        bg = const Color(0xFFFEF3C7);
        text = const Color(0xFFB45309);
        label = 'ຈ່າຍບາງສ່ວນ (PARTIAL)';
        break;
      case 'DEBT':
      default:
        bg = const Color(0xFFFEE2E2);
        text = const Color(0xFFB91C1C);
        label = 'ຕິດໜີ້ (DEBT)';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label, style: TextStyle(color: text, fontWeight: FontWeight.bold, fontSize: 11)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(purchaseProvider);
    final pos = state.purchaseOrders.where((p) {
      if (state.filterStatus == 'ALL') return true;
      return p.paymentStatus == state.filterStatus;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Top Bar
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ປະຫວັດການຮັບສິນຄ້າເຂົ້າສາງ (Goods Receipt Notes)',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'ຕິດຕາມສິນຄ້າຮັບເຂົ້າສາງ, ຕົ້ນທຶນບາດ-ກີບ & ຈັດການໜີ້ສິນຜູ້ສະໜອງ (AP)',
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
                Row(
                  children: [
                    // Supplier manager button
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                      onPressed: () {
                        showDialog(
                          context: context,
                          builder: (_) => const SupplierManagementDialog(),
                        );
                      },
                      icon: const Icon(Icons.local_shipping_rounded, size: 18, color: Color(0xFF0F766E)),
                      label: const Text('ຈັດການຜູ້ສະໜອງ', style: TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(width: 10),

                    // New GRN button
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0F766E),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const PurchaseEntryScreen(),
                          ),
                        );
                      },
                      icon: const Icon(Icons.add_rounded, size: 20, color: Colors.white),
                      label: const Text('ຮັບສິນຄ້າເຂົ້າ (+)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Status Filter Tabs
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterChip('ທັງໝົດ', 'ALL', state.purchaseOrders.length, state.filterStatus),
                  const SizedBox(width: 8),
                  _buildFilterChip('ຈ່າຍຄົບ (PAID)', 'PAID', state.purchaseOrders.where((p) => p.paymentStatus == 'PAID').length, state.filterStatus),
                  const SizedBox(width: 8),
                  _buildFilterChip('ຈ່າຍບາງສ່ວນ (PARTIAL)', 'PARTIAL', state.purchaseOrders.where((p) => p.paymentStatus == 'PARTIAL').length, state.filterStatus),
                  const SizedBox(width: 8),
                  _buildFilterChip('ຕິດໜີ້ (DEBT)', 'DEBT', state.purchaseOrders.where((p) => p.paymentStatus == 'DEBT').length, state.filterStatus),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Orders Table / List
            Expanded(
              child: state.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : pos.isEmpty
                      ? Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: const Center(
                            child: Text(
                              'ບໍ່ພົບລາຍການຮັບສິນຄ້າເຂົ້າສາງ',
                              style: TextStyle(color: Colors.grey, fontSize: 13),
                            ),
                          ),
                        )
                      : Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: ListView.separated(
                            padding: const EdgeInsets.all(12),
                            itemCount: pos.length,
                            separatorBuilder: (_, __) => const Divider(height: 16),
                            itemBuilder: (ctx, i) {
                              final p = pos[i];
                              return InkWell(
                                onTap: () => _showPoDetailsModal(p),
                                borderRadius: BorderRadius.circular(10),
                                child: Padding(
                                  padding: const EdgeInsets.all(8.0),
                                  child: Row(
                                    children: [
                                      // Icon & PO code
                                      Container(
                                        width: 44,
                                        height: 44,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF0FDFA),
                                          borderRadius: BorderRadius.circular(10),
                                          border: Border.all(color: const Color(0xFFCCFBF1)),
                                        ),
                                        child: const Icon(Icons.receipt_long_rounded, color: Color(0xFF0F766E)),
                                      ),
                                      const SizedBox(width: 14),

                                      // PO ID & Date & Supplier
                                      Expanded(
                                        flex: 3,
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(p.id, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                            const SizedBox(height: 2),
                                            Text(
                                              '${_dateFormat.format(p.createdAt)} • ${p.supplier?.name ?? "ບໍ່ລະບຸຜູ້ສະໜອງ"}',
                                              style: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
                                            ),
                                          ],
                                        ),
                                      ),

                                      // Items summary / Single product name
                                      Expanded(
                                        flex: 2,
                                        child: Text(
                                          p.productName != null && p.productName!.isNotEmpty
                                              ? p.productName!
                                              : (p.items.isNotEmpty ? p.items.first.productName : '${p.items.length} ລາຍການ'),
                                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Color(0xFF334155)),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),

                                      // Total Cost
                                      Expanded(
                                        flex: 3,
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            Text(
                                              '${LaoCurrencyFormatter.formatNumber(p.totalCostLak)} ₭',
                                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A)),
                                            ),
                                            if (p.totalCostThb > 0)
                                              Text(
                                                '${p.totalCostThb.toStringAsFixed(1)} ฿',
                                                style: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
                                              ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 14),

                                      // Debt & Status Badge
                                      Expanded(
                                        flex: 3,
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            _buildPaymentBadge(p.paymentStatus),
                                            if (p.debtAmount > 0) ...[
                                              const SizedBox(height: 2),
                                              Text(
                                                'ຄ້າງ: ${LaoCurrencyFormatter.formatNumber(p.debtAmount)} ${p.primaryCurrency}',
                                                style: const TextStyle(
                                                  color: Color(0xFFDC2626),
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 10),

                                      // Action button
                                      if (p.debtAmount > 0)
                                        IconButton(
                                          icon: const Icon(Icons.payment_rounded, color: Color(0xFF0F766E)),
                                          onPressed: () => _showDebtPaymentDialog(p),
                                          tooltip: 'ຊຳລະໜີ້ສິນ',
                                        )
                                      else
                                        const Icon(Icons.chevron_right_rounded, color: Colors.grey),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String value, int count, String currentFilter) {
    final isSelected = currentFilter == value;
    return ChoiceChip(
      label: Text('$label ($count)'),
      selected: isSelected,
      selectedColor: const Color(0xFF0F766E),
      backgroundColor: Colors.white,
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : const Color(0xFF475569),
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        fontSize: 12,
      ),
      onSelected: (_) {
        ref.read(purchaseProvider.notifier).setFilterStatus(value);
      },
    );
  }
}
