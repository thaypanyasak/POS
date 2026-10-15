import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/localization/lao_currency_formatter.dart';
import '../../../domain/models/sale_transaction.dart';
import '../../pos/presentation/controllers/transaction_controller.dart';
import '../../pos/presentation/widgets/meii_receipt_slip.dart';

enum ReceiptStatusFilter {
  all,
  valid,
  cancelled,
}

/// Dedicated Screen: Receipt & Sales History (ປະຫວັດໃບບິນ & ການຂາຍຍ້ອນຫຼັງ)
/// Aligned 100% with Web-App (`HistoryView.jsx`) and SPEC_SALES_HISTORY.md
class ReceiptHistoryScreen extends ConsumerStatefulWidget {
  const ReceiptHistoryScreen({super.key});

  @override
  ConsumerState<ReceiptHistoryScreen> createState() =>
      _ReceiptHistoryScreenState();
}

class _ReceiptHistoryScreenState extends ConsumerState<ReceiptHistoryScreen> {
  final TextEditingController _searchController = TextEditingController();
  ReceiptStatusFilter _statusFilter = ReceiptStatusFilter.all;
  bool _isRefreshing = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<SaleTransaction> _filterTransactions(List<SaleTransaction> transactions) {
    var list = transactions;

    if (_statusFilter == ReceiptStatusFilter.valid) {
      list = list.where((t) => !t.isCancelled && t.status != 'cancelled').toList();
    } else if (_statusFilter == ReceiptStatusFilter.cancelled) {
      list = list.where((t) => t.isCancelled || t.status == 'cancelled').toList();
    }

    final q = _searchController.text.trim().toLowerCase();
    if (q.isEmpty) return list;

    return list.where((tx) {
      final rcMatch = tx.receiptNumber.toLowerCase().contains(q);
      final custMatch = tx.customer.name.toLowerCase().contains(q);
      final methodMatch = tx.paymentMethod.name.toLowerCase().contains(q);
      final debtNoteMatch = tx.debtNote?.toLowerCase().contains(q) ?? false;
      return rcMatch || custMatch || methodMatch || debtNoteMatch;
    }).toList();
  }

  // --- Actions ---

  Future<void> _handleRefresh() async {
    setState(() => _isRefreshing = true);
    try {
      await ref.read(transactionHistoryProvider.notifier).loadTransactions();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('ໂຫຼດຂໍ້ມູນຄືນຈາກ Supabase ສຳເລັດແລ້ວ!'),
            backgroundColor: Color(0xFF0F766E),
            duration: Duration(seconds: 1),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isRefreshing = false);
    }
  }

  void _handleCancelTransaction(SaleTransaction tx) {
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: const [
              Icon(Icons.block_rounded, color: Color(0xFFE11D48), size: 22),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'ຢືນຢັນການຍົກເລີກບິນ?',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ບິນ: ${tx.receiptNumber} (${LaoCurrencyFormatter.format(tx.grandTotal)})',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFFECDD3)),
                ),
                child: const Text(
                  '⚠️ ລະບົບຈະຫັກຍອດຂາຍອອກຈາກລາຍຮັບ ແລະ ດຶງສະຕັອກສິນຄ້າທັງໝົດໃນບິນນີ້ກັບຄືນສາງອັດຕະໂນມັດ.',
                  style: TextStyle(fontSize: 11.5, color: Color(0xFFBE123C), height: 1.4),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'ເຫດຜົນການຍົກເລີກ (ຖ້າມີ):',
                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: reasonController,
                style: const TextStyle(fontSize: 12.5),
                decoration: InputDecoration(
                  hintText: 'ເຊັ່ນ: ລູກຄ້າປ່ຽນໃຈ, ພິມຈຳນວນຜິດ...',
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('ຍົກເລີກ', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE11D48),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
              onPressed: () async {
                Navigator.of(ctx).pop();
                final ok = await ref
                    .read(transactionHistoryProvider.notifier)
                    .cancelTransaction(tx, voidReason: reasonController.text.trim());
                if (mounted && ok) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('ຍົກເລີກບິນ "${tx.receiptNumber}" ແລະ ສົ່ງຄືນສະຕັອກສຳເລັດແລ້ວ!'),
                      backgroundColor: const Color(0xFF0F766E),
                    ),
                  );
                }
              },
              child: const Text('ຢືນຢັນຍົກເລີກບິນ', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  void _handleDeleteTransaction(SaleTransaction tx) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: const [
              Icon(Icons.delete_forever_rounded, color: Color(0xFFDC2626), size: 22),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'ຢືນຢັນການລຶບບິນຖາວອນ',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                ),
              ),
            ],
          ),
          content: Text(
            'ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບຖາວອນບິນ "${tx.receiptNumber}" ອອກຈາກຖານຂໍ້ມູນ Supabase ແທ້ບໍ? ການກະທຳນີ້ບໍ່ສາມາດຍົກເລີກໄດ້.',
            style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569), height: 1.4),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('ຍົກເລີກ', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
              onPressed: () async {
                Navigator.of(ctx).pop();
                final ok = await ref
                    .read(transactionHistoryProvider.notifier)
                    .deleteTransaction(tx);
                if (mounted && ok) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('ລຶບບິນ "${tx.receiptNumber}" ສຳເລັດແລ້ວ!'),
                      backgroundColor: const Color(0xFF0F766E),
                    ),
                  );
                }
              },
              child: const Text('ລຶບຖາວອນ', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  void _handleEditTransaction(SaleTransaction tx) {
    final nameController = TextEditingController(text: tx.customer.name);
    PaymentMethod selectedMethod = tx.paymentMethod;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Row(
                children: [
                  const Icon(Icons.edit_note_rounded, color: Color(0xFF0F766E), size: 22),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'ແກ້ໄຂບິນ: ${tx.receiptNumber}',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    ),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'ຊື່ລູກຄ້າ (Customer Name):',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: nameController,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'ຮູບແບບຊຳລະ (Payment Method):',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () => setModalState(() => selectedMethod = PaymentMethod.cash),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: selectedMethod == PaymentMethod.cash
                                  ? const Color(0xFFF0FDFA)
                                  : const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: selectedMethod == PaymentMethod.cash
                                    ? const Color(0xFF14B8A6)
                                    : const Color(0xFFE2E8F0),
                              ),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '💵 ເງິນສົດ',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: selectedMethod == PaymentMethod.cash
                                    ? const Color(0xFF0F766E)
                                    : const Color(0xFF64748B),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: InkWell(
                          onTap: () => setModalState(() => selectedMethod = PaymentMethod.qrTransfer),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: selectedMethod == PaymentMethod.qrTransfer
                                  ? const Color(0xFFEFF6FF)
                                  : const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: selectedMethod == PaymentMethod.qrTransfer
                                    ? const Color(0xFF3B82F6)
                                    : const Color(0xFFE2E8F0),
                              ),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '📱 QR ໂອນ',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: selectedMethod == PaymentMethod.qrTransfer
                                    ? const Color(0xFF1D4ED8)
                                    : const Color(0xFF64748B),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('ຍອດຊຳລະທັງໝົດ:', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                        Text(
                          LaoCurrencyFormatter.format(tx.grandTotal),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('ຍົກເລີກ', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    elevation: 0,
                  ),
                  onPressed: () async {
                    final messenger = ScaffoldMessenger.of(context);
                    Navigator.of(ctx).pop();
                    final ok = await ref.read(transactionHistoryProvider.notifier).updateTransaction(
                          tx.id,
                          customerName: nameController.text.trim(),
                          paymentMethod: selectedMethod,
                        );
                    if (ok) {
                      messenger.showSnackBar(
                        const SnackBar(
                          content: Text('ແກ້ໄຂຂໍ້ມູນບິນສຳເລັດແລ້ວ!'),
                          backgroundColor: Color(0xFF0F766E),
                        ),
                      );
                    }
                  },
                  child: const Text('ບັນທຶກລົງ Supabase', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }



  @override
  Widget build(BuildContext context) {
    final historyState = ref.watch(transactionHistoryProvider);
    final allTxs = historyState.transactions;

    final validCount = allTxs.where((t) => !t.isCancelled && t.status != 'cancelled').length;
    final cancelledCount = allTxs.where((t) => t.isCancelled || t.status == 'cancelled').length;
    final filteredTxs = _filterTransactions(allTxs);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC), // slate-50
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          physics: const BouncingScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Top Header (Matches Web HistoryView)
              _buildHeader(allTxs.length),

              const SizedBox(height: 14),

              // 2. Filter Bar (Chips & Search Field)
              _buildFilterAndSearchRow(allTxs.length, validCount, cancelledCount, filteredTxs.length),

              const SizedBox(height: 14),

              // 3. Transactions Content: Mobile List (< 768px) & Desktop Table (>= 768px)
              LayoutBuilder(
                builder: (context, constraints) {
                  final isDesktop = constraints.maxWidth >= 768;
                  if (filteredTxs.isEmpty) {
                    return _buildEmptyState();
                  }
                  return isDesktop
                      ? _buildDesktopTable(filteredTxs, constraints.maxWidth)
                      : _buildMobileCardList(filteredTxs);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --- Sub-widgets ---

  Widget _buildHeader(int totalCount) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isMobile = constraints.maxWidth < 640;

        return Container(
          padding: const EdgeInsets.only(bottom: 12),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.history_rounded, size: 20, color: Color(0xFF0F766E)),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            'ປະຫວັດບິນຂາຍ ($totalCount ບິນ)',
                            style: TextStyle(
                              fontSize: isMobile ? 15 : 18,
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFF0F172A),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'ຈັດການບິນຂາຍ: ເບິ່ງບິນ, ຍົກເລີກບິນ & ຄືນສະຕັອກສິນຄ້າອັດຕະໂນມັດ',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              ElevatedButton.icon(
                onPressed: _isRefreshing ? null : _handleRefresh,
                icon: _isRefreshing
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF475569)),
                      )
                    : const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('ໂຫຼດຄືນ'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF1F5F9),
                  foregroundColor: const Color(0xFF334155),
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildFilterAndSearchRow(int allCount, int validCount, int cancelledCount, int resultCount) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isNarrow = constraints.maxWidth < 680;

        return Wrap(
          spacing: 12,
          runSpacing: 10,
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            // Status Tabs Container
            Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildStatusChip('ທັງໝົດ ($allCount)', ReceiptStatusFilter.all),
                  _buildStatusChip('ສຳເລັດ ($validCount)', ReceiptStatusFilter.valid),
                  _buildStatusChip(
                    'ຍົກເລີກແລ້ວ ($cancelledCount)',
                    ReceiptStatusFilter.cancelled,
                    isDanger: true,
                  ),
                ],
              ),
            ),

            // Search Bar & Count
            SizedBox(
              width: isNarrow ? constraints.maxWidth : 340,
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 38,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: TextField(
                        controller: _searchController,
                        style: const TextStyle(fontSize: 12),
                        decoration: InputDecoration(
                          hintText: 'ຄົ້ນຫາເລກທີບິນ ຫຼື ຊື່ລູກຄ້າ...',
                          hintStyle: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                          prefixIcon: const Icon(Icons.search_rounded, size: 17, color: Color(0xFF94A3B8)),
                          suffixIcon: _searchController.text.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.clear_rounded, size: 15),
                                  onPressed: () {
                                    _searchController.clear();
                                    setState(() {});
                                  },
                                )
                              : null,
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: 9),
                        ),
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'ພົບ $resultCount ບິນ',
                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildStatusChip(String label, ReceiptStatusFilter filter, {bool isDanger = false}) {
    final isSelected = _statusFilter == filter;
    final activeColor = isDanger ? const Color(0xFFBE123C) : const Color(0xFF0F766E);
    final activeBg = isDanger ? const Color(0xFFFFF1F2) : Colors.white;

    return InkWell(
      onTap: () => setState(() => _statusFilter = filter),
      borderRadius: BorderRadius.circular(9),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? activeBg : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
          boxShadow: isSelected
              ? [const BoxShadow(color: Colors.black12, blurRadius: 3, offset: Offset(0, 1))]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? activeColor : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  // --- Mobile Card View (< 768px) ---

  Widget _buildMobileCardList(List<SaleTransaction> txs) {
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    return Column(
      children: txs.map((tx) {
        final isCancelled = tx.isCancelled || tx.status == 'cancelled';

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isCancelled ? const Color(0xFFFFF1F2).withValues(alpha: 0.3) : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isCancelled ? const Color(0xFFFECDD3) : const Color(0xFFE2E8F0),
            ),
            boxShadow: const [
              BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 2)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top Row: Receipt #, status, date
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Text(
                        tx.receiptNumber,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          fontFamily: 'monospace',
                          decoration: isCancelled ? TextDecoration.lineThrough : null,
                          color: isCancelled ? const Color(0xFF94A3B8) : const Color(0xFF0F172A),
                        ),
                      ),
                      if (isCancelled) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(5),
                            border: Border.all(color: const Color(0xFFFCA5A5)),
                          ),
                          child: const Text(
                            'ຍົກເລີກແລ້ວ',
                            style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFFB91C1C)),
                          ),
                        ),
                      ],
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(dateFormat.format(tx.createdAt), style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
                      if (isCancelled && tx.cancelledAt != null)
                        Text(
                          '(ຍົກເລີກ: ${DateFormat('HH:mm').format(tx.cancelledAt!)})',
                          style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFFE11D48)),
                        ),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 8),

              // Middle Box: Customer, Payment Method, Total
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('ລູກຄ້າ:', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                        Text(
                          tx.customer.name,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(height: 3),
                        _buildPaymentBadge(tx),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text('ຍອດເງິນ:', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                        if (isCancelled) ...[
                          Text(
                            LaoCurrencyFormatter.format(tx.grandTotal),
                            style: const TextStyle(
                              fontSize: 11,
                              fontFamily: 'monospace',
                              decoration: TextDecoration.lineThrough,
                              color: Color(0xFF94A3B8),
                            ),
                          ),
                          const Text(
                            '(0 ₭)',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFFE11D48)),
                          ),
                        ] else
                          Text(
                            LaoCurrencyFormatter.format(tx.grandTotal),
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              fontFamily: 'monospace',
                              color: Color(0xFF0F766E),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 8),

              // Bottom Actions Row (Min 44px Touch Targets)
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 40,
                      child: ElevatedButton.icon(
                        onPressed: () => showMeiiReceiptDialog(context, tx),
                        icon: const Icon(Icons.print_outlined, size: 15),
                        label: const Text('ເບິ່ງ / ພິມບິນ', style: TextStyle(fontSize: 11.5)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFF1F5F9),
                          foregroundColor: const Color(0xFF1E293B),
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),

                  if (isCancelled)
                    Container(
                      height: 40,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF1F2),
                        borderRadius: BorderRadius.circular(9),
                        border: Border.all(color: const Color(0xFFFECDD3)),
                      ),
                      alignment: Alignment.center,
                      child: const Row(
                        children: [
                          Icon(Icons.block_rounded, size: 14, color: Color(0xFFE11D48)),
                          SizedBox(width: 4),
                          Text('ຍົກເລີກແລ້ວ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFBE123C))),
                        ],
                      ),
                    )
                  else
                    SizedBox(
                      height: 40,
                      child: ElevatedButton.icon(
                        onPressed: () => _handleCancelTransaction(tx),
                        icon: const Icon(Icons.block_rounded, size: 14),
                        label: const Text('ຍົກເລີກບິນ', style: TextStyle(fontSize: 11.5)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFFFF1F2),
                          foregroundColor: const Color(0xFFBE123C),
                          elevation: 0,
                          side: const BorderSide(color: Color(0xFFFECDD3)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                        ),
                      ),
                    ),

                  const SizedBox(width: 6),

                  if (!isCancelled)
                    SizedBox(
                      width: 40,
                      height: 40,
                      child: IconButton(
                        onPressed: () => _handleEditTransaction(tx),
                        icon: const Icon(Icons.edit_outlined, size: 17, color: Color(0xFF0F766E)),
                        style: IconButton.styleFrom(
                          backgroundColor: const Color(0xFFF0FDFA),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                        ),
                        tooltip: 'ແກ້ໄຂ',
                      ),
                    ),

                  const SizedBox(width: 4),

                  SizedBox(
                    width: 40,
                    height: 40,
                    child: IconButton(
                      onPressed: () => _handleDeleteTransaction(tx),
                      icon: const Icon(Icons.delete_outline_rounded, size: 17, color: Color(0xFFDC2626)),
                      style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFFFEF2F2),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                      ),
                      tooltip: 'ລຶບຖາວອນ',
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  // --- Desktop Table View (>= 768px) ---

  Widget _buildDesktopTable(List<SaleTransaction> txs, double availableWidth) {
    final dateFormat = DateFormat('dd/MM/yyyy, HH:mm:ss');
    final tableWidth = availableWidth > 840 ? availableWidth : 840.0;

    return Container(
      width: availableWidth,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(color: Color(0x04000000), blurRadius: 6, offset: Offset(0, 2)),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SizedBox(
          width: tableWidth,
          child: DataTable(
            horizontalMargin: 20,
            columnSpacing: 24,
            headingRowHeight: 44,
            dataRowMinHeight: 52,
            dataRowMaxHeight: 60,
            headingRowColor: WidgetStateProperty.all(const Color(0xFFF8FAFC)),
            columns: const [
              DataColumn(label: Text('ເລກທີບິນ', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF334155)))),
              DataColumn(label: Text('ວັນທີ & ເວລາ', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF334155)))),
              DataColumn(label: Text('ຊື່ລູກຄ້າ', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF334155)))),
              DataColumn(label: Text('ຮູບແບບຊຳລະ / ສະຖານະ', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF334155)))),
              DataColumn(label: Text('ຍອດຊຳລະ (₭)', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF334155))), numeric: true),
              DataColumn(label: Center(child: Text('ຈັດການບິນ (Actions)', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF334155))))),
            ],
            rows: txs.map((tx) {
              final isCancelled = tx.isCancelled || tx.status == 'cancelled';

              return DataRow(
                color: WidgetStateProperty.resolveWith((states) {
                  if (isCancelled) return const Color(0xFFFFF1F2).withValues(alpha: 0.25);
                  return Colors.transparent;
                }),
                cells: [
                  // 1. Receipt No
                  DataCell(
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          tx.receiptNumber,
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                            decoration: isCancelled ? TextDecoration.lineThrough : null,
                            color: isCancelled ? const Color(0xFF94A3B8) : const Color(0xFF0F172A),
                          ),
                        ),
                        if (isCancelled) ...[
                          const SizedBox(width: 5),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEE2E2),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: const Color(0xFFFCA5A5)),
                            ),
                            child: const Text('ຍົກເລີກແລ້ວ', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Color(0xFFB91C1C))),
                          ),
                        ],
                      ],
                    ),
                  ),

                  // 2. Date & Time
                  DataCell(
                    Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(dateFormat.format(tx.createdAt), style: const TextStyle(fontSize: 11.5, color: Color(0xFF475569))),
                        if (isCancelled && tx.cancelledAt != null)
                          Text(
                            '(ຍົກເລີກ: ${DateFormat('HH:mm:ss').format(tx.cancelledAt!)})',
                            style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFFE11D48)),
                          ),
                      ],
                    ),
                  ),

                  // 3. Customer Name
                  DataCell(
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          tx.customer.name,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isCancelled ? const Color(0xFF64748B) : const Color(0xFF0F172A),
                          ),
                        ),
                        if (tx.isWholesale) ...[
                          const SizedBox(width: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: const Color(0xFFFDE68A)),
                            ),
                            child: const Text('ສົ່ງ', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF92400E))),
                          ),
                        ],
                      ],
                    ),
                  ),

                  // 4. Payment method badge
                  DataCell(_buildPaymentBadge(tx)),

                  // 5. Total Due
                  DataCell(
                    Align(
                      alignment: Alignment.centerRight,
                      child: isCancelled
                          ? Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  LaoCurrencyFormatter.format(tx.grandTotal),
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontFamily: 'monospace',
                                    decoration: TextDecoration.lineThrough,
                                    color: Color(0xFF94A3B8),
                                  ),
                                ),
                                const Text(
                                  '(ຫັກອອກ 0 ₭)',
                                  style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFFE11D48)),
                                ),
                              ],
                            )
                          : Text(
                              LaoCurrencyFormatter.format(tx.grandTotal),
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w900,
                                fontFamily: 'monospace',
                                color: Color(0xFF0F172A),
                              ),
                            ),
                    ),
                  ),

                  // 6. Actions
                  DataCell(
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // View / Print receipt
                        OutlinedButton.icon(
                          onPressed: () => showMeiiReceiptDialog(context, tx),
                          icon: const Icon(Icons.print_outlined, size: 14),
                          label: const Text('ເບິ່ງບິນ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF1E293B),
                            backgroundColor: const Color(0xFFF8FAFC),
                            side: const BorderSide(color: Color(0xFFE2E8F0)),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
                          ),
                        ),
                        const SizedBox(width: 6),

                        // Cancel / Void
                        if (isCancelled)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFF1F2),
                              borderRadius: BorderRadius.circular(7),
                              border: Border.all(color: const Color(0xFFFECDD3)),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.block_rounded, size: 12, color: Color(0xFFE11D48)),
                                SizedBox(width: 4),
                                Text('ຍົກເລີກແລ້ວ', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: Color(0xFFBE123C))),
                              ],
                            ),
                          )
                        else
                          ElevatedButton.icon(
                            onPressed: () => _handleCancelTransaction(tx),
                            icon: const Icon(Icons.block_rounded, size: 13),
                            label: const Text('ຍົກເລີກບິນ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFFFF1F2),
                              foregroundColor: const Color(0xFFBE123C),
                              elevation: 0,
                              side: const BorderSide(color: Color(0xFFFECDD3)),
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
                            ),
                          ),

                        const SizedBox(width: 6),

                        // Edit
                        if (!isCancelled)
                          IconButton(
                            onPressed: () => _handleEditTransaction(tx),
                            icon: const Icon(Icons.edit_outlined, size: 16, color: Color(0xFF0F766E)),
                            tooltip: 'ແກ້ໄຂຂໍ້ມູນບິນ',
                            splashRadius: 16,
                          ),

                        // Delete
                        IconButton(
                          onPressed: () => _handleDeleteTransaction(tx),
                          icon: const Icon(Icons.delete_outline_rounded, size: 16, color: Color(0xFFDC2626)),
                          tooltip: 'ລຶບຖາວອນ',
                          splashRadius: 16,
                        ),
                      ],
                    ),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
      ),
    );
  }

  Widget _buildPaymentBadge(SaleTransaction tx) {
    final isCancelled = tx.isCancelled || tx.status == 'cancelled';

    if (isCancelled) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF1F2),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFFECDD3)),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.block_rounded, size: 11, color: Color(0xFFE11D48)),
            SizedBox(width: 3),
            Text(
              'ຍົກເລີກບິນ (Void)',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFBE123C)),
              maxLines: 1,
            ),
          ],
        ),
      );
    }

    if (tx.paymentMethod == PaymentMethod.cash) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFA7F3D0)),
        ),
        child: const Text(
          'ເງິນສົດ',
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF065F46)),
          maxLines: 1,
        ),
      );
    }

    if (tx.isDebt || tx.paymentMethod == PaymentMethod.debt) {
      final isFullDebt = tx.paidAmount == 0;
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
        decoration: BoxDecoration(
          color: isFullDebt ? const Color(0xFFFFF1F2) : const Color(0xFFFFFBEB),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isFullDebt ? const Color(0xFFFECDD3) : const Color(0xFFFDE68A)),
        ),
        child: Text(
          isFullDebt ? 'ຄ້າງຊຳລະ 100%' : 'ຄ້າງຊຳລະ (${LaoCurrencyFormatter.format(tx.debtAmount)})',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: isFullDebt ? const Color(0xFFB91C1C) : const Color(0xFF92400E),
          ),
          maxLines: 1,
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: const Text(
        'QR ໂອນ',
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF1E40AF)),
        maxLines: 1,
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.all(40),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: const [
          Icon(Icons.receipt_long_outlined, size: 48, color: Color(0xFF94A3B8)),
          SizedBox(height: 10),
          Text(
            'ຍັງບໍ່ມີປະຫວັດບິນຂາຍ',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
          ),
          SizedBox(height: 3),
          Text(
            'ເມື່ອມີການຂາຍຜ່ານໜ້າ POS ໃບບິນຈະຖືກສະແດງທີ່ນີ້',
            style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
          ),
        ],
      ),
    );
  }
}
