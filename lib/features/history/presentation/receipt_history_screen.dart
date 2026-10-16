import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'dart:math' as math;
import '../../../core/localization/lao_currency_formatter.dart';
import '../../../domain/models/sale_transaction.dart';
import '../../navigation/main_shell.dart';
import '../../pos/presentation/controllers/cart_controller.dart';
import '../../pos/presentation/controllers/catalog_controller.dart';
import '../../pos/presentation/controllers/transaction_controller.dart';
import '../../pos/presentation/widgets/meii_receipt_slip.dart';
import '../../../../views/history/widgets/customer_debt_payment_dialog.dart';

enum HistoryTab {
  cash, // ເງິນສົດ
  transfer, // ເງິນໂອນ / QR
  debt, // ຕິດໜີ້
  all, // ທັງໝົດ
  cancelled, // ຍົກເລີກແລ້ວ
}

enum HistoryDatePreset {
  today,
  yesterday,
  sevenDays,
  all,
  custom,
}

/// Upgraded Screen: Receipt & Sales History with 3 Tabs, Date Filters, Debt Recovery & POS Edit Mode
class ReceiptHistoryScreen extends ConsumerStatefulWidget {
  const ReceiptHistoryScreen({super.key});

  @override
  ConsumerState<ReceiptHistoryScreen> createState() =>
      _ReceiptHistoryScreenState();
}

class _ReceiptHistoryScreenState extends ConsumerState<ReceiptHistoryScreen> {
  final TextEditingController _searchController = TextEditingController();
  HistoryTab _selectedTab = HistoryTab.all;
  HistoryDatePreset _datePreset = HistoryDatePreset.all;

  DateTime? _customStartDate;
  DateTime? _customEndDate;
  bool _isRefreshing = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<SaleTransaction> _filterTransactions(List<SaleTransaction> transactions) {
    var list = transactions;

    // 1. Tab Filter
    switch (_selectedTab) {
      case HistoryTab.cash:
        list = list.where((t) {
          final isCanc = t.isCancelled || t.status == 'cancelled';
          if (isCanc) return false;
          final isDebt = t.isDebt ||
              t.paymentMethod == PaymentMethod.debt ||
              t.debtAmount > 0 ||
              t.debtStatus == 'unpaid' ||
              t.debtStatus == 'partial';
          return !isDebt && t.paymentMethod == PaymentMethod.cash;
        }).toList();
        break;
      case HistoryTab.transfer:
        list = list.where((t) {
          final isCanc = t.isCancelled || t.status == 'cancelled';
          if (isCanc) return false;
          final isDebt = t.isDebt ||
              t.paymentMethod == PaymentMethod.debt ||
              t.debtAmount > 0 ||
              t.debtStatus == 'unpaid' ||
              t.debtStatus == 'partial';
          return !isDebt && t.paymentMethod == PaymentMethod.qrTransfer;
        }).toList();
        break;
      case HistoryTab.debt:
        list = list.where((t) {
          final isCanc = t.isCancelled || t.status == 'cancelled';
          if (isCanc) return false;
          return t.isDebt ||
              t.paymentMethod == PaymentMethod.debt ||
              t.debtAmount > 0 ||
              t.debtStatus == 'unpaid' ||
              t.debtStatus == 'partial';
        }).toList();
        break;
      case HistoryTab.cancelled:
        list = list.where((t) => t.isCancelled || t.status == 'cancelled').toList();
        break;
      case HistoryTab.all:
        break;
    }

    // 2. Date Preset Filter
    final now = DateTime.now();
    final startOfToday = DateTime(now.year, now.month, now.day);
    final startOfYesterday = startOfToday.subtract(const Duration(days: 1));
    final endOfYesterday = startOfToday.subtract(const Duration(milliseconds: 1));
    final sevenDaysAgo = now.subtract(const Duration(days: 7));

    switch (_datePreset) {
      case HistoryDatePreset.today:
        list = list.where((t) => t.createdAt.isAfter(startOfToday)).toList();
        break;
      case HistoryDatePreset.yesterday:
        list = list
            .where((t) =>
                t.createdAt.isAfter(startOfYesterday) &&
                t.createdAt.isBefore(endOfYesterday))
            .toList();
        break;
      case HistoryDatePreset.sevenDays:
        list = list.where((t) => t.createdAt.isAfter(sevenDaysAgo)).toList();
        break;
      case HistoryDatePreset.custom:
        if (_customStartDate != null) {
          final s = DateTime(_customStartDate!.year, _customStartDate!.month,
              _customStartDate!.day, 0, 0, 0);
          list = list.where((t) => t.createdAt.isAfter(s)).toList();
        }
        if (_customEndDate != null) {
          final e = DateTime(_customEndDate!.year, _customEndDate!.month,
              _customEndDate!.day, 23, 59, 59);
          list = list.where((t) => t.createdAt.isBefore(e)).toList();
        }
        break;
      case HistoryDatePreset.all:
        break;
    }

    // 3. Search Query Filter
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

  /// Re-checkout pattern: Load transaction items into POS Cart and navigate to POS
  void _handleEditOrderInPos(SaleTransaction tx) {
    if (tx.isCancelled || tx.status == 'cancelled') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('ບໍ່ສາມາດແກ້ໄຂບິນທີ່ຖືກຍົກເລີກແລ້ວ!'),
          backgroundColor: Color(0xFFE11D48),
        ),
      );
      return;
    }

    final catalogProducts = ref.read(catalogProvider).allProducts;
    ref.read(cartProvider.notifier).editExistingOrder(tx, catalogProducts);

    // Switch navigation tab to POS
    ref.read(mainWorkflowProvider.notifier).state = MainWorkflow.pos;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'ໂຫຼດບິນ #${tx.receiptNumber} ເຂົ້າສູ່ໜ້າ POS ແລ້ວ. ປັບປຸງລາຍການແລ້ວກົດບັນທຶກ!',
        ),
        backgroundColor: const Color(0xFFD97706),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  /// Customer debt recovery modal dialog
  Future<void> _handleCollectDebt(SaleTransaction tx) async {
    final updated = await CustomerDebtPaymentDialog.show(context, tx);
    if (updated == true) {
      await _handleRefresh();
    }
  }

  void _handleCancelTransaction(SaleTransaction tx) {
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: const [
              Icon(Icons.block_rounded, color: Color(0xFFE11D48), size: 22),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'ຢືນຢັນການຍົກເລີກບິນ?',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ບິນ: #${tx.receiptNumber} (${LaoCurrencyFormatter.format(tx.grandTotal)})',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF334155),
                ),
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
                  style: TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFFBE123C),
                    height: 1.4,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'ເຫດຜົນການຍົກເລີກ (ຖ້າມີ):',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF475569),
                ),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: reasonController,
                decoration: InputDecoration(
                  hintText: 'ເຊັ່ນ: ລູກຄ້າປ່ຽນໃຈ, ພິມບິນຜິດ...',
                  hintStyle: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF94A3B8),
                  ),
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text(
                'ກັບຄືນ',
                style: TextStyle(
                  color: Color(0xFF64748B),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE11D48),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                elevation: 0,
              ),
              onPressed: () async {
                Navigator.of(ctx).pop();
                final ok = await ref
                    .read(transactionHistoryProvider.notifier)
                    .cancelTransaction(
                      tx,
                      voidReason: reasonController.text.trim(),
                    );
                if (mounted && ok) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        'ຍົກເລີກບິນ "${tx.receiptNumber}" ແລະ ສົ່ງຄືນສະຕັອກສຳເລັດແລ້ວ!',
                      ),
                      backgroundColor: const Color(0xFF0F766E),
                    ),
                  );
                }
              },
              child: const Text(
                'ຢືນຢັນຍົກເລີກບິນ',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
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
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: const [
              Icon(Icons.delete_forever_rounded,
                  color: Color(0xFFDC2626), size: 22),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'ຢືນຢັນການລຶບບິນຖາວອນ',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
            ],
          ),
          content: Text(
            'ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບຖາວອນບິນ "${tx.receiptNumber}" ອອກຈາກຖານຂໍ້ມູນ Supabase ແທ້ບໍ? ການກະທຳນີ້ບໍ່ສາມາດຍົກເລີກໄດ້.',
            style: const TextStyle(
              fontSize: 12.5,
              color: Color(0xFF475569),
              height: 1.4,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text(
                'ຍົກເລີກ',
                style: TextStyle(
                  color: Color(0xFF64748B),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
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
                      content:
                          Text('ລຶບບິນ "${tx.receiptNumber}" ສຳເລັດແລ້ວ!'),
                      backgroundColor: const Color(0xFF0F766E),
                    ),
                  );
                }
              },
              child: const Text(
                'ລຶບຖາວອນ',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        );
      },
    );
  }

  Future<void> _pickCustomDateRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2023),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      initialDateRange: _customStartDate != null && _customEndDate != null
          ? DateTimeRange(start: _customStartDate!, end: _customEndDate!)
          : DateTimeRange(
              start: DateTime.now().subtract(const Duration(days: 7)),
              end: DateTime.now(),
            ),
      builder: (context, child) {
        return Theme(
          data: ThemeData.light().copyWith(
            primaryColor: const Color(0xFF0F766E),
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF0F766E),
              onPrimary: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _datePreset = HistoryDatePreset.custom;
        _customStartDate = picked.start;
        _customEndDate = picked.end;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final historyState = ref.watch(transactionHistoryProvider);
    final allTxs = historyState.transactions;

    // Counts for tabs
    int cashCount = 0;
    int transferCount = 0;
    int debtCount = 0;
    int cancelledCount = 0;

    for (final tx in allTxs) {
      final isCanc = tx.isCancelled || tx.status == 'cancelled';
      if (isCanc) {
        cancelledCount++;
        continue;
      }

      final isDebt = tx.isDebt ||
          tx.paymentMethod == PaymentMethod.debt ||
          tx.debtAmount > 0 ||
          tx.debtStatus == 'unpaid' ||
          tx.debtStatus == 'partial';

      if (isDebt) {
        debtCount++;
      } else if (tx.paymentMethod == PaymentMethod.cash) {
        cashCount++;
      } else if (tx.paymentMethod == PaymentMethod.qrTransfer) {
        transferCount++;
      }
    }

    final filteredTxs = _filterTransactions(allTxs);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          physics: const BouncingScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Top Header
              _buildHeader(allTxs.length),

              const SizedBox(height: 12),

              // 2. PRIMARY 3 TABS (Cash, Transfer, Debt) + All & Cancelled
              _buildPrimaryTabs(
                allCount: allTxs.length,
                cashCount: cashCount,
                transferCount: transferCount,
                debtCount: debtCount,
                cancelledCount: cancelledCount,
              ),

              const SizedBox(height: 10),

              // 3. DATE FILTER TOOLBAR & SEARCH FIELD
              _buildDateAndSearchRow(filteredTxs.length),

              const SizedBox(height: 14),

              // 4. Content: Mobile List (< 768px) & Desktop Table (>= 768px)
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
    return Container(
      padding: const EdgeInsets.only(bottom: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: const Color(0xFFCCFBF1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.history_rounded,
                    color: Color(0xFF0F766E), size: 20),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'ປະຫວັດບິນຂາຍ & ຄຸ້ມຄອງໜີ້ ($totalCount ບິນ)',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const Text(
                    'ແຍກ 3 ໝວດ: ເງິນສົດ, ເງິນໂອນ, ຕິດໜີ້ • ແກ້ໄຂບິນຜ່ານ POS • ຊຳລະໜີ້',
                    style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ],
          ),
          ElevatedButton.icon(
            onPressed: _isRefreshing ? null : _handleRefresh,
            icon: _isRefreshing
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Color(0xFF475569),
                    ),
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
  }

  // 3 Primary Tabs: Cash, Transfer, Debt + All & Cancelled
  Widget _buildPrimaryTabs({
    required int allCount,
    required int cashCount,
    required int transferCount,
    required int debtCount,
    required int cancelledCount,
  }) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: [
          // Tab 1: ເງິນສົດ
          _buildTabPill(
            label: 'ເງິນສົດ (Cash)',
            icon: Icons.payments_rounded,
            count: cashCount,
            tab: HistoryTab.cash,
            selectedColor: const Color(0xFF0F766E),
          ),
          const SizedBox(width: 8),

          // Tab 2: ເງິນໂອນ
          _buildTabPill(
            label: 'ເງິນໂອນ (Transfer)',
            icon: Icons.qr_code_rounded,
            count: transferCount,
            tab: HistoryTab.transfer,
            selectedColor: const Color(0xFF2563EB),
          ),
          const SizedBox(width: 8),

          // Tab 3: ຕິດໜີ້
          _buildTabPill(
            label: 'ຕິດໜີ້ (Customer Debt)',
            icon: Icons.handshake_rounded,
            count: debtCount,
            tab: HistoryTab.debt,
            selectedColor: const Color(0xFFD97706),
            isAlert: true,
          ),
          const SizedBox(width: 8),

          // Tab 4: ທັງໝົດ
          _buildTabPill(
            label: 'ທັງໝົດ',
            icon: Icons.receipt_long_rounded,
            count: allCount,
            tab: HistoryTab.all,
            selectedColor: const Color(0xFF334155),
          ),
          const SizedBox(width: 8),

          // Tab 5: ຍົກເລີກແລ້ວ
          _buildTabPill(
            label: 'ຍົກເລີກແລ້ວ',
            icon: Icons.block_rounded,
            count: cancelledCount,
            tab: HistoryTab.cancelled,
            selectedColor: const Color(0xFFBE123C),
            isDanger: true,
          ),
        ],
      ),
    );
  }

  Widget _buildTabPill({
    required String label,
    required IconData icon,
    required int count,
    required HistoryTab tab,
    required Color selectedColor,
    bool isAlert = false,
    bool isDanger = false,
  }) {
    final isSelected = _selectedTab == tab;

    return InkWell(
      onTap: () => setState(() => _selectedTab = tab),
      borderRadius: BorderRadius.circular(12),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? selectedColor
              : (isAlert
                  ? const Color(0xFFFEF3C7).withValues(alpha: 0.5)
                  : Colors.white),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected
                ? selectedColor
                : (isAlert
                    ? const Color(0xFFFDE68A)
                    : const Color(0xFFCBD5E1)),
            width: isSelected ? 1.5 : 1.0,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: selectedColor.withValues(alpha: 0.3),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 15,
              color: isSelected
                  ? Colors.white
                  : (isAlert
                      ? const Color(0xFFB45309)
                      : (isDanger
                          ? const Color(0xFFBE123C)
                          : const Color(0xFF475569))),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                color: isSelected
                    ? Colors.white
                    : (isAlert
                        ? const Color(0xFFB45309)
                        : (isDanger
                            ? const Color(0xFFBE123C)
                            : const Color(0xFF334155))),
              ),
            ),
            const SizedBox(width: 6),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: isSelected
                    ? Colors.white.withValues(alpha: 0.25)
                    : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  fontFamily: 'monospace',
                  color: isSelected ? Colors.white : const Color(0xFF475569),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Date Filter & Search Row
  Widget _buildDateAndSearchRow(int resultCount) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                const Icon(Icons.calendar_today_rounded,
                    size: 14, color: Color(0xFF94A3B8)),
                const SizedBox(width: 6),
                _buildDateChip('ມື້ນີ້', HistoryDatePreset.today),
                _buildDateChip('ມື້ວານ', HistoryDatePreset.yesterday),
                _buildDateChip('7 ມື້ຜ່ານມາ', HistoryDatePreset.sevenDays),
                _buildDateChip('ທັງໝົດ', HistoryDatePreset.all),
                InkWell(
                  onTap: _pickCustomDateRange,
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 5),
                    decoration: BoxDecoration(
                      color: _datePreset == HistoryDatePreset.custom
                          ? const Color(0xFFF0FDFA)
                          : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: _datePreset == HistoryDatePreset.custom
                            ? const Color(0xFF0F766E)
                            : const Color(0xFFE2E8F0),
                      ),
                    ),
                    child: Row(
                      children: [
                        Text(
                          _datePreset == HistoryDatePreset.custom &&
                                  _customStartDate != null &&
                                  _customEndDate != null
                              ? '${DateFormat('dd/MM').format(_customStartDate!)} - ${DateFormat('dd/MM').format(_customEndDate!)}'
                              : 'ເລືອກວັນທີ...',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _datePreset == HistoryDatePreset.custom
                                ? const Color(0xFF0F766E)
                                : const Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.edit_calendar_rounded,
                            size: 13, color: Color(0xFF0F766E)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Search Field
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 36,
                  child: TextField(
                    controller: _searchController,
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF0F172A)),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search_rounded,
                          size: 16, color: Color(0xFF94A3B8)),
                      hintText: 'ຄົ້ນຫາເລກບິນ, ຊື່ລູກຄ້າ...',
                      hintStyle: const TextStyle(
                          fontSize: 11.5, color: Color(0xFF94A3B8)),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: EdgeInsets.zero,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(9),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'ພົບ $resultCount ບິນ',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDateChip(String label, HistoryDatePreset preset) {
    final isSelected = _datePreset == preset;

    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: InkWell(
        onTap: () => setState(() => _datePreset = preset),
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF0F766E) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isSelected
                  ? const Color(0xFF0F766E)
                  : const Color(0xFFE2E8F0),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
              color: isSelected ? Colors.white : const Color(0xFF475569),
            ),
          ),
        ),
      ),
    );
  }

  // --- Mobile Card List (< 768px) ---

  Widget _buildMobileCardList(List<SaleTransaction> txs) {
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    return Column(
      children: txs.map((tx) {
        final isCancelled = tx.isCancelled || tx.status == 'cancelled';
        final grandTotal = tx.grandTotal;
        final paid = tx.paidAmount > 0 ? tx.paidAmount : tx.amountTendered;
        final remainingDebt = tx.debtAmount > 0
            ? tx.debtAmount
            : (grandTotal - paid).clamp(0, grandTotal);
        final hasDebt = remainingDebt > 0 ||
            tx.isDebt ||
            tx.paymentMethod == PaymentMethod.debt;

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isCancelled
                ? const Color(0xFFFFF1F2).withValues(alpha: 0.3)
                : (hasDebt ? const Color(0xFFFFFBEB).withValues(alpha: 0.4) : Colors.white),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isCancelled
                  ? const Color(0xFFFECDD3)
                  : (hasDebt
                      ? const Color(0xFFFDE68A)
                      : const Color(0xFFE2E8F0)),
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x06000000),
                blurRadius: 4,
                offset: Offset(0, 2),
              ),
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
                        '#${tx.receiptNumber}',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          fontFamily: 'monospace',
                          decoration:
                              isCancelled ? TextDecoration.lineThrough : null,
                          color: isCancelled
                              ? const Color(0xFF94A3B8)
                              : const Color(0xFF0F172A),
                        ),
                      ),
                      if (isCancelled) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(5),
                            border: Border.all(color: const Color(0xFFFCA5A5)),
                          ),
                          child: const Text(
                            'ຍົກເລີກແລ້ວ',
                            style: TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFFB91C1C),
                            ),
                          ),
                        ),
                      ] else if (hasDebt) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(5),
                            border: Border.all(color: const Color(0xFFFDE68A)),
                          ),
                          child: Text(
                            remainingDebt >= grandTotal ? 'ຕິດໜີ້ 100%' : 'ຕິດໜີ້ບາງສ່ວນ',
                            style: const TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFFB45309),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  Text(
                    dateFormat.format(tx.createdAt),
                    style: const TextStyle(
                      fontSize: 10.5,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Middle Box: Customer, amounts breakdown
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('ລູກຄ້າ:',
                                style: TextStyle(
                                    fontSize: 10, color: Color(0xFF94A3B8))),
                            Text(
                              tx.customer.name,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                          ],
                        ),
                        _buildPaymentBadge(tx),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Divider(height: 1, color: Color(0xFFE2E8F0)),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('ຍອດລວມ',
                                style: TextStyle(
                                    fontSize: 9.5, color: Color(0xFF64748B))),
                            Text(
                              LaoCurrencyFormatter.format(grandTotal),
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                fontFamily: 'monospace',
                                color: Color(0xFF0F172A),
                              ),
                            ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            const Text('ຈ່າຍແລ້ວ',
                                style: TextStyle(
                                    fontSize: 9.5, color: Color(0xFF059669))),
                            Text(
                              LaoCurrencyFormatter.format(paid),
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                fontFamily: 'monospace',
                                color: Color(0xFF059669),
                              ),
                            ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text('ໜີ້ຄ້າງ',
                                style: TextStyle(
                                    fontSize: 9.5, color: Color(0xFFDC2626))),
                            Text(
                              LaoCurrencyFormatter.format(remainingDebt),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                fontFamily: 'monospace',
                                color: remainingDebt > 0
                                    ? const Color(0xFFDC2626)
                                    : const Color(0xFF94A3B8),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),

              // Bottom Actions Row
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  // View / Print Receipt Button
                  ElevatedButton.icon(
                    onPressed: () => showMeiiReceiptDialog(context, tx),
                    icon: const Icon(Icons.print_outlined, size: 14),
                    label: const Text('ພິມບິນ',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFF1F5F9),
                      foregroundColor: const Color(0xFF1E293B),
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 8),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                  ),

                  // Edit Order in POS Button
                  if (!isCancelled)
                    ElevatedButton.icon(
                      onPressed: () => _handleEditOrderInPos(tx),
                      icon: const Icon(Icons.edit_note_rounded, size: 15),
                      label: const Text('ແກ້ໄຂບິນ',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFEF3C7),
                        foregroundColor: const Color(0xFFB45309),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 8),
                        side: const BorderSide(color: Color(0xFFFDE68A)),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),

                  // Collect Debt Button
                  if (!isCancelled && hasDebt)
                    ElevatedButton.icon(
                      onPressed: () => _handleCollectDebt(tx),
                      icon: const Icon(Icons.handshake_rounded, size: 14),
                      label: const Text('ຊຳລະໜີ້',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0F766E),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 8),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),

                  // Void Button
                  if (!isCancelled)
                    IconButton(
                      onPressed: () => _handleCancelTransaction(tx),
                      icon: const Icon(Icons.block_rounded,
                          size: 16, color: Color(0xFFBE123C)),
                      style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFFFFF1F2),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                      tooltip: 'ຍົກເລີກບິນ',
                    ),

                  // Delete Button
                  IconButton(
                    onPressed: () => _handleDeleteTransaction(tx),
                    icon: const Icon(Icons.delete_outline_rounded,
                        size: 16, color: Color(0xFFDC2626)),
                    style: IconButton.styleFrom(
                      backgroundColor: const Color(0xFFFEF2F2),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                    tooltip: 'ລຶບຖາວອນ',
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

  Widget _buildDesktopTable(List<SaleTransaction> txs, double containerWidth) {
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');
    final tableWidth = math.max(containerWidth, 980.0);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
              color: Color(0x06000000), blurRadius: 6, offset: Offset(0, 2)),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SizedBox(
            width: tableWidth,
            child: Table(
              columnWidths: const {
                0: FlexColumnWidth(1.2), // ເລກທີບິນ
                1: FlexColumnWidth(1.3), // ວັນທີ & ເວລາ
                2: FlexColumnWidth(1.3), // ຊື່ລູກຄ້າ
                3: FlexColumnWidth(1.4), // ຮູບແບບ / ສະຖານະ
                4: FlexColumnWidth(1.2), // ຍອດລວມ (₭)
                5: FlexColumnWidth(1.2), // ຈ່າຍແລ້ວ (₭)
                6: FlexColumnWidth(1.1), // ໜີ້ຄ້າງ (₭)
                7: FlexColumnWidth(2.1), // ຈັດການບິນ (Actions)
              },
              defaultVerticalAlignment: TableCellVerticalAlignment.middle,
              children: [
                // Header TableRow
                TableRow(
                  decoration: const BoxDecoration(
                    color: Color(0xFFF8FAFC),
                    border: Border(
                      bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1),
                    ),
                  ),
                  children: [
                    _buildTableHeaderCell('ເລກທີບິນ', align: TextAlign.left),
                    _buildTableHeaderCell('ວັນທີ & ເວລາ', align: TextAlign.left),
                    _buildTableHeaderCell('ຊື່ລູກຄ້າ', align: TextAlign.left),
                    _buildTableHeaderCell('ຮູບແບບ / ສະຖານະ', align: TextAlign.left),
                    _buildTableHeaderCell('ຍອດລວມ (₭)', align: TextAlign.right),
                    _buildTableHeaderCell('ຈ່າຍແລ້ວ (₭)', align: TextAlign.right),
                    _buildTableHeaderCell('ໜີ້ຄ້າງ (₭)', align: TextAlign.right),
                    _buildTableHeaderCell('ຈັດການບິນ (Actions)', align: TextAlign.center),
                  ],
                ),

                // Data TableRows
                ...txs.map((tx) {
                  final isCancelled = tx.isCancelled || tx.status == 'cancelled';
                  final grandTotal = tx.grandTotal;
                  final paid = tx.paidAmount > 0 ? tx.paidAmount : tx.amountTendered;
                  final remainingDebt = tx.debtAmount > 0
                      ? tx.debtAmount
                      : (grandTotal - paid).clamp(0, grandTotal);
                  final hasDebt = remainingDebt > 0 ||
                      tx.isDebt ||
                      tx.paymentMethod == PaymentMethod.debt;

                  Color rowBg = Colors.white;
                  if (isCancelled) {
                    rowBg = const Color(0xFFFFF1F2).withValues(alpha: 0.35);
                  } else if (hasDebt) {
                    rowBg = const Color(0xFFFFFBEB).withValues(alpha: 0.45);
                  }

                  return TableRow(
                    decoration: BoxDecoration(
                      color: rowBg,
                      border: const Border(
                        bottom: BorderSide(color: Color(0xFFF1F5F9), width: 1),
                      ),
                    ),
                    children: [
                      // 1. Receipt #
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 12),
                        child: Text(
                          '#${tx.receiptNumber}',
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w900,
                            fontSize: 12.5,
                            decoration:
                                isCancelled ? TextDecoration.lineThrough : null,
                            color: isCancelled
                                ? const Color(0xFF94A3B8)
                                : const Color(0xFF0F172A),
                          ),
                        ),
                      ),

                      // 2. Date
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 12),
                        child: Text(
                          dateFormat.format(tx.createdAt),
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ),

                      // 3. Customer
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 12),
                        child: Text(
                          tx.customer.name,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                            color: isCancelled
                                ? const Color(0xFF94A3B8)
                                : const Color(0xFF0F172A),
                          ),
                        ),
                      ),

                      // 4. Payment Method / Status Badge
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 12),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: _buildPaymentBadge(tx),
                        ),
                      ),

                      // 5. Grand Total
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 12),
                        child: Text(
                          LaoCurrencyFormatter.format(grandTotal),
                          textAlign: TextAlign.right,
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w900,
                            fontSize: 12.5,
                            decoration:
                                isCancelled ? TextDecoration.lineThrough : null,
                            color: isCancelled
                                ? const Color(0xFF94A3B8)
                                : const Color(0xFF0F172A),
                          ),
                        ),
                      ),

                      // 6. Paid Amount
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 12),
                        child: Text(
                          LaoCurrencyFormatter.format(paid),
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                            color: Color(0xFF059669),
                          ),
                        ),
                      ),

                      // 7. Remaining Debt
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 12),
                        child: Text(
                          LaoCurrencyFormatter.format(remainingDebt),
                          textAlign: TextAlign.right,
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w900,
                            fontSize: 12.5,
                            color: remainingDebt > 0
                                ? const Color(0xFFDC2626)
                                : const Color(0xFF94A3B8),
                          ),
                        ),
                      ),

                      // 8. Actions
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 8),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Print
                            IconButton(
                              onPressed: () =>
                                  showMeiiReceiptDialog(context, tx),
                              icon: const Icon(Icons.print_outlined,
                                  size: 17, color: Color(0xFF334155)),
                              tooltip: 'ເບິ່ງ / ພິມບິນ',
                            ),

                            // Edit Order in POS
                            if (!isCancelled)
                              IconButton(
                                onPressed: () => _handleEditOrderInPos(tx),
                                icon: const Icon(Icons.edit_note_rounded,
                                    size: 18, color: Color(0xFFB45309)),
                                tooltip: 'ແກ້ໄຂບິນຜ່ານ POS',
                              ),

                            // Collect Debt
                            if (!isCancelled && hasDebt)
                              ElevatedButton.icon(
                                onPressed: () => _handleCollectDebt(tx),
                                icon: const Icon(Icons.handshake_rounded,
                                    size: 13),
                                label: const Text('ຊຳລະໜີ້',
                                    style: TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.bold)),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF0F766E),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 4),
                                  shape: RoundedRectangleBorder(
                                      borderRadius:
                                          BorderRadius.circular(6)),
                                ),
                              ),

                            // Void
                            if (!isCancelled)
                              IconButton(
                                onPressed: () =>
                                    _handleCancelTransaction(tx),
                                icon: const Icon(Icons.block_rounded,
                                    size: 16, color: Color(0xFFBE123C)),
                                tooltip: 'ຍົກເລີກບິນ',
                              ),

                            // Delete
                            IconButton(
                              onPressed: () => _handleDeleteTransaction(tx),
                              icon: const Icon(Icons.delete_outline_rounded,
                                  size: 16, color: Color(0xFFDC2626)),
                              tooltip: 'ລຶບຖາວອນ',
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
      ),
    );
  }

  Widget _buildTableHeaderCell(String title,
      {TextAlign align = TextAlign.left}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      child: Text(
        title,
        textAlign: align,
        style: const TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w800,
          color: Color(0xFF334155),
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
              'ຍົກເລີກແລ້ວ',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: Color(0xFFBE123C),
              ),
            ),
          ],
        ),
      );
    }

    final grandTotal = tx.grandTotal;
    final paid = tx.paidAmount > 0 ? tx.paidAmount : tx.amountTendered;
    final remainingDebt = tx.debtAmount > 0
        ? tx.debtAmount
        : (grandTotal - paid).clamp(0, grandTotal);
    final isDebt = remainingDebt > 0 ||
        tx.isDebt ||
        tx.paymentMethod == PaymentMethod.debt;

    if (isDebt) {
      final isFullDebt = remainingDebt >= grandTotal;
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFBEB),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFFDE68A)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.handshake_rounded,
                size: 11, color: Color(0xFFB45309)),
            const SizedBox(width: 3),
            Text(
              isFullDebt
                  ? 'ຕິດໜີ້ 100%'
                  : 'ຕິດໜີ້ (${LaoCurrencyFormatter.format(remainingDebt)})',
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: Color(0xFFB45309),
              ),
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
          '💵 ເງິນສົດ',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: Color(0xFF065F46),
          ),
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
        '📱 QR ໂອນ',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          color: Color(0xFF1E40AF),
        ),
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
      child: const Column(
        children: [
          Icon(Icons.receipt_long_outlined, size: 48, color: Color(0xFF94A3B8)),
          SizedBox(height: 10),
          Text(
            'ບໍ່ພົບລາຍການບິນຕາມເງື່ອນໄຂທີ່ເລືອກ',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: Color(0xFF64748B),
            ),
          ),
          SizedBox(height: 3),
          Text(
            'ກະລຸນາປ່ຽນໝວດ ຫຼື ຊ່ວງວັນທີເພື່ອຄົ້ນຫາໃໝ່',
            style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
          ),
        ],
      ),
    );
  }
}
