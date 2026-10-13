import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/localization/lao_currency_formatter.dart';
import '../../../core/localization/lo.dart';
import '../../../domain/models/sale_transaction.dart';
import '../../pos/presentation/controllers/transaction_controller.dart';
import '../../pos/presentation/widgets/meii_receipt_slip.dart';

enum HistoryDateFilter {
  all,
  today,
  thisWeek,
  thisMonth,
}

/// Dedicated Screen: Receipt & Sales History (ປະຫວັດໃບບິນ & ການຂາຍຍ້ອນຫຼັງ)
/// Features:
/// - Full persistence across app refreshes & restarts
/// - View all past sales transactions with receipts
/// - Live filter by date, payment method, customer, or receipt number
/// - Instant 1-click receipt preview & re-printing
/// - Full item breakdown for every historical ticket
class ReceiptHistoryScreen extends ConsumerStatefulWidget {
  const ReceiptHistoryScreen({super.key});

  @override
  ConsumerState<ReceiptHistoryScreen> createState() =>
      _ReceiptHistoryScreenState();
}

class _ReceiptHistoryScreenState extends ConsumerState<ReceiptHistoryScreen> {
  final TextEditingController _searchController = TextEditingController();
  HistoryDateFilter _dateFilter = HistoryDateFilter.all;
  PaymentMethod? _paymentFilter;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<SaleTransaction> _getFilteredTransactions(List<SaleTransaction> all) {
    final now = DateTime.now();

    return all.where((tx) {
      // 1. Date filter
      switch (_dateFilter) {
        case HistoryDateFilter.today:
          if (tx.createdAt.year != now.year ||
              tx.createdAt.month != now.month ||
              tx.createdAt.day != now.day) {
            return false;
          }
          break;
        case HistoryDateFilter.thisWeek:
          final weekAgo = now.subtract(const Duration(days: 7));
          if (tx.createdAt.isBefore(weekAgo)) return false;
          break;
        case HistoryDateFilter.thisMonth:
          if (tx.createdAt.year != now.year ||
              tx.createdAt.month != now.month) {
            return false;
          }
          break;
        case HistoryDateFilter.all:
          break;
      }

      // 2. Payment method filter
      if (_paymentFilter != null && tx.paymentMethod != _paymentFilter) {
        return false;
      }

      // 3. Search text (receipt # or customer name or cashier)
      final query = _searchController.text.trim().toLowerCase();
      if (query.isNotEmpty) {
        final rcMatch = tx.receiptNumber.toLowerCase().contains(query);
        final custMatch = tx.customer.name.toLowerCase().contains(query);
        final cashierMatch =
            tx.cashierName?.toLowerCase().contains(query) ?? false;
        if (!rcMatch && !custMatch && !cashierMatch) return false;
      }

      return true;
    }).toList();
  }

  void _showTransactionDetails(BuildContext context, SaleTransaction tx) {
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm:ss');

    showDialog(
      context: context,
      builder: (ctx) {
        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          backgroundColor: AppColors.surface,
          surfaceTintColor: Colors.transparent,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 540, maxHeight: 660),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Modern Dialog Header
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 18, 16, 14),
                  child: Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.primaryBorder, width: 0.9),
                        ),
                        child: const Icon(Icons.receipt_long_rounded, color: AppColors.primary, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'ລາຍລະອຽດບິນ: ${tx.receiptNumber}',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            Text(
                              dateFormat.format(tx.createdAt),
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        icon: const Icon(Icons.close_rounded, size: 20, color: AppColors.textMuted),
                        splashRadius: 18,
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: AppColors.borderSubtle),

                // Dialog Body
                Flexible(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Meta Info Box
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.backgroundAlt,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.borderSubtle, width: 0.9),
                          ),
                          child: Column(
                            children: [
                              _buildDetailRow('ເລກທີບິນ:', tx.receiptNumber, isBold: true),
                              _buildDetailRow('ວັນທີ & ເວລາ:', dateFormat.format(tx.createdAt)),
                              _buildDetailRow('ລູກຄ້າ:', tx.customer.name),
                              _buildDetailRow(
                                'ຮູບແບບ:',
                                tx.isWholesale ? 'ຂາຍສົ່ງ (Wholesale)' : 'ຂາຍຍ່ອຍ (Retail)',
                              ),
                              _buildDetailRow(
                                'ຊ່ອງທາງຊຳລະ:',
                                tx.paymentMethod == PaymentMethod.cash
                                    ? 'ເງິນສົດ (Cash)'
                                    : 'QR ໂອນ (BCEL One)',
                              ),
                              _buildDetailRow(
                                'ພະນັກງານຂາຍ:',
                                tx.cashierName ?? 'ໄມ້ຄຳ (Meii)',
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 16),
                        const Text(
                          'ລາຍການສິນຄ້າໃນບິນ:',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 8),

                        // Line Items
                        if (tx.items.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 8),
                            child: Text('ບໍ່ມີລາຍການສິນຄ້າຍ່ອຍ', style: TextStyle(color: AppColors.textMuted)),
                          )
                        else
                          ...tx.items.map((item) {
                            return Container(
                              margin: const EdgeInsets.only(bottom: 6),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppColors.borderSubtle, width: 0.9),
                                boxShadow: AppColors.cardShadow,
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          item.product.name,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 12.5,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '${item.quantity} ${item.selectedUnit.unitName} @ ${LaoCurrencyFormatter.format(item.effectiveUnitPrice)}',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: AppColors.textSecondary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    LaoCurrencyFormatter.format(item.lineTotal),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13.5,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),

                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.backgroundAlt,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.borderSubtle, width: 0.9),
                          ),
                          child: Column(
                            children: [
                              _buildDetailRow(
                                'ຍອດລວມທັງໝົດ:',
                                LaoCurrencyFormatter.format(tx.grandTotal),
                                isBold: true,
                                color: AppColors.primary,
                              ),
                              _buildDetailRow(
                                'ຕົ້ນທຶນສິນຄ້າ:',
                                LaoCurrencyFormatter.format(tx.totalCostOfGoods),
                              ),
                              _buildDetailRow(
                                'ກຳໄລລວມ:',
                                '+${LaoCurrencyFormatter.format(tx.grossProfit)}',
                                color: const Color(0xFF047857),
                                isBold: true,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const Divider(height: 1, color: AppColors.borderSubtle),

                // Action Buttons
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      OutlinedButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textSecondary,
                          side: const BorderSide(color: AppColors.borderSubtle, width: 0.9),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: const Text(LaoStrings.cancel),
                      ),
                      const SizedBox(width: 10),
                      ElevatedButton.icon(
                        onPressed: () {
                          Navigator.of(ctx).pop();
                          showMeiiReceiptDialog(context, tx);
                        },
                        icon: const Icon(Icons.print_rounded, size: 16),
                        label: const Text('ພິມໃບບິນຄືນ (Reprint)'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          elevation: 0,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDetailRow(String label, String value,
      {bool isBold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
              color: color ?? const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final historyState = ref.watch(transactionHistoryProvider);
    final allTxs = historyState.transactions;
    final filteredTxs = _getFilteredTransactions(allTxs);

    // Aggregate summary
    int totalRev = 0;
    int totalProfit = 0;
    int totalCash = 0;
    int totalQr = 0;
    for (final t in filteredTxs) {
      totalRev += t.grandTotal;
      totalProfit += t.grossProfit;
      if (t.paymentMethod == PaymentMethod.cash) {
        totalCash += t.grandTotal;
      } else {
        totalQr += t.grandTotal;
      }
    }

    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: 18,
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: AppColors.primaryBorder, width: 0.9),
              ),
              child: const Icon(Icons.receipt_long_rounded, color: AppColors.primary, size: 19),
            ),
            const SizedBox(width: 10),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'ປະຫວັດໃບບິນ & ການຂາຍ',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: AppColors.textPrimary,
                  ),
                ),
                Text(
                  'Receipt & Transaction History',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.backgroundAlt,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.borderSubtle, width: 0.9),
            ),
            child: IconButton(
              onPressed: () async {
                await ref
                    .read(transactionHistoryProvider.notifier)
                    .loadTransactions();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('ອັບເດດປະຫວັດໃບບິນລ່າສຸດສຳເລັດ!'),
                      backgroundColor: AppColors.primary,
                      duration: Duration(seconds: 1),
                    ),
                  );
                }
              },
              icon: const Icon(Icons.sync_rounded, size: 18, color: AppColors.textSecondary),
              tooltip: 'ດຶງຂໍ້ມູນບິນລ່າສຸດຈາກ Cloud/Database',
            ),
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: Column(
        children: [
          // 1. KPI Top Metric Cards (Horizontal scrollable for mobile landscape)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            color: AppColors.surface,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildKpiCard(
                    title: 'ຍອດຂາຍລວມ (Revenue)',
                    value: LaoCurrencyFormatter.format(totalRev),
                    icon: Icons.payments_rounded,
                    color: AppColors.primary,
                    subtitle: '${filteredTxs.length} ໃບບິນ',
                    fixedWidth: 210,
                  ),
                  const SizedBox(width: 10),
                  _buildKpiCard(
                    title: 'ກຳໄລລວມ (Gross Profit)',
                    value: '+${LaoCurrencyFormatter.format(totalProfit)}',
                    icon: Icons.trending_up_rounded,
                    color: const Color(0xFF047857),
                    subtitle: totalRev > 0 ? '${((totalProfit / totalRev) * 100).round()}% Margin' : '0%',
                    fixedWidth: 210,
                  ),
                  const SizedBox(width: 10),
                  _buildKpiCard(
                    title: 'ເງິນສົດ (Cash Sales)',
                    value: LaoCurrencyFormatter.format(totalCash),
                    icon: Icons.account_balance_wallet_rounded,
                    color: const Color(0xFF2563EB),
                    subtitle: 'ຊຳລະເງິນສົດ',
                    fixedWidth: 190,
                  ),
                  const SizedBox(width: 10),
                  _buildKpiCard(
                    title: 'QR ໂອນ (BCEL One)',
                    value: LaoCurrencyFormatter.format(totalQr),
                    icon: Icons.qr_code_scanner_rounded,
                    color: AppColors.wholesaleDark,
                    subtitle: 'ສະແກນ Lao QR',
                    fixedWidth: 190,
                  ),
                ],
              ),
            ),
          ),

          const Divider(height: 1, color: AppColors.borderSubtle),

          // 2. Filter Bar (Horizontal scrollable for mobile landscape)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            color: AppColors.surface,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  // Search Input
                  SizedBox(
                    width: 260,
                    height: 38,
                    child: TextField(
                      controller: _searchController,
                      style: const TextStyle(fontSize: 13),
                      decoration: InputDecoration(
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                        hintText: 'ຄົ້ນຫາ ເລກທີບິນ (RC-...), ຊື່...',
                        prefixIcon: const Icon(Icons.search_rounded, size: 18, color: AppColors.textMuted),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear_rounded, size: 16),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() {});
                                },
                              )
                            : null,
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),

                  const SizedBox(width: 10),

                  // Date Timeframe Pills Container
                  Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: AppColors.backgroundAlt,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.borderSubtle, width: 0.9),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildTimeframeChip('ທັງໝົດ', HistoryDateFilter.all),
                        const SizedBox(width: 3),
                        _buildTimeframeChip('ມື້ນີ້', HistoryDateFilter.today),
                        const SizedBox(width: 3),
                        _buildTimeframeChip('ອາທິດນີ້', HistoryDateFilter.thisWeek),
                        const SizedBox(width: 3),
                        _buildTimeframeChip('ເດືອນນີ້', HistoryDateFilter.thisMonth),
                      ],
                    ),
                  ),

                  const SizedBox(width: 10),

                  // Payment Method Selector
                  Container(
                    height: 38,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.borderSubtle, width: 0.9),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<PaymentMethod?>(
                        value: _paymentFilter,
                        hint: const Text(
                          'ທຸກຮູບແບບຊຳລະ',
                          style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                        ),
                        items: const [
                          DropdownMenuItem(
                            value: null,
                            child: Text('ທຸກຮູບແບບຊຳລະ',
                                style: TextStyle(fontSize: 12.5, color: AppColors.textPrimary)),
                          ),
                          DropdownMenuItem(
                            value: PaymentMethod.cash,
                            child: Text('ເງິນສົດ (Cash)',
                                style: TextStyle(fontSize: 12.5, color: AppColors.textPrimary)),
                          ),
                          DropdownMenuItem(
                            value: PaymentMethod.qrTransfer,
                            child: Text('QR ໂອນ (BCEL)',
                                style: TextStyle(fontSize: 12.5, color: AppColors.textPrimary)),
                          ),
                        ],
                        onChanged: (val) {
                          setState(() => _paymentFilter = val);
                        },
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          const Divider(height: 1, color: AppColors.borderSubtle),

          // 3. Full-width Data Table of Receipts
          Expanded(
            child: filteredTxs.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.receipt_long_outlined,
                          size: 54,
                          color: AppColors.textMuted,
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'ບໍ່ພົບປະຫວັດໃບບິນທີ່ກົງກັບເງື່ອນໄຂ',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'ເມື່ອມີການຂາຍຜ່ານໜ້າ POS ໃບບິນຈະຖືກບັນທຶກໄວ້ທີ່ນີ້ທັງໝົດ',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  )
                : LayoutBuilder(
                    builder: (context, constraints) {
                      final tableWidth = constraints.maxWidth < 980
                          ? 980.0
                          : constraints.maxWidth;
                      return SingleChildScrollView(
                        scrollDirection: Axis.vertical,
                        padding: const EdgeInsets.all(16),
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          padding: EdgeInsets.zero,
                          child: Container(
                            width: tableWidth - 32,
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.borderSubtle, width: 0.9),
                              boxShadow: AppColors.cardShadow,
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: DataTable(
                              columnSpacing: 18,
                              horizontalMargin: 18,
                              headingRowHeight: 46,
                              dataRowMinHeight: 52,
                              dataRowMaxHeight: 58,
                              headingRowColor: WidgetStateProperty.all(
                                AppColors.backgroundAlt,
                              ),
                              border: const TableBorder(
                                horizontalInside: BorderSide(
                                  color: AppColors.borderSubtle,
                                  width: 0.9,
                                ),
                              ),
                              columns: const [
                                DataColumn(
                                  label: Text(
                                    'ເລກທີບິນ (Receipt No)',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12.5,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ),
                                DataColumn(
                                  label: Text(
                                    'ວັນທີ & ເວລາ',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12.5,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ),
                                DataColumn(
                                  label: Text(
                                    'ລູກຄ້າ (Customer)',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12.5,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ),
                                DataColumn(
                                  label: Text(
                                    'ຮູບແບບຊຳລະ',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12.5,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ),
                                DataColumn(
                                  label: Text(
                                    'ຈຳນວນສິນຄ້າ',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12.5,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ),
                                DataColumn(
                                  label: Text(
                                    'ຍອດລວມ (Total)',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12.5,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ),
                                DataColumn(
                                  label: Text(
                                    'ກຳໄລ (Profit)',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12.5,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ),
                                DataColumn(
                                  label: Text(
                                    'ຈັດການບິນ (Actions)',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12.5,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ),
                              ],
                              rows: filteredTxs.map((tx) {
                                return DataRow(
                                  cells: [
                                    // Receipt No
                                    DataCell(
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                                        decoration: BoxDecoration(
                                          color: AppColors.backgroundAlt,
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: AppColors.borderSubtle, width: 0.8),
                                        ),
                                        child: Text(
                                          tx.receiptNumber,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 12,
                                            fontFamily: 'monospace',
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                      ),
                                    ),
                                    // Date
                                    DataCell(
                                      Text(
                                        dateFormat.format(tx.createdAt),
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    ),
                                    // Customer
                                    DataCell(
                                      Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 3.5,
                                            ),
                                            decoration: BoxDecoration(
                                              color: AppColors.backgroundAlt,
                                              borderRadius: BorderRadius.circular(6),
                                              border: Border.all(color: AppColors.borderSubtle, width: 0.8),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                const Icon(Icons.person_outline_rounded, size: 13, color: AppColors.textSecondary),
                                                const SizedBox(width: 4),
                                                Text(
                                                  tx.customer.name,
                                                  style: const TextStyle(
                                                    fontSize: 11.5,
                                                    fontWeight: FontWeight.w600,
                                                    color: AppColors.textPrimary,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          if (tx.isWholesale) ...[
                                            const SizedBox(width: 4),
                                            Container(
                                              padding: const EdgeInsets.symmetric(
                                                horizontal: 6,
                                                vertical: 2.5,
                                              ),
                                              decoration: BoxDecoration(
                                                color: AppColors.wholesaleLight,
                                                borderRadius: BorderRadius.circular(4),
                                                border: Border.all(
                                                  color: AppColors.wholesale.withValues(alpha: 0.3),
                                                  width: 0.8,
                                                ),
                                              ),
                                              child: const Text(
                                                'ສົ່ງ',
                                                style: TextStyle(
                                                  fontSize: 9.5,
                                                  fontWeight: FontWeight.bold,
                                                  color: AppColors.wholesaleDark,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                    // Payment
                                    DataCell(
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                                        decoration: BoxDecoration(
                                          color: tx.paymentMethod == PaymentMethod.cash
                                              ? AppColors.primaryLight.withValues(alpha: 0.5)
                                              : AppColors.wholesaleLight.withValues(alpha: 0.5),
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(
                                            color: tx.paymentMethod == PaymentMethod.cash
                                                ? AppColors.primaryBorder
                                                : AppColors.wholesale.withValues(alpha: 0.3),
                                            width: 0.8,
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(
                                              tx.paymentMethod == PaymentMethod.cash
                                                  ? Icons.payments_rounded
                                                  : Icons.qr_code_2_rounded,
                                              size: 13,
                                              color: tx.paymentMethod == PaymentMethod.cash
                                                  ? AppColors.primary
                                                  : AppColors.wholesaleDark,
                                            ),
                                            const SizedBox(width: 4),
                                            Text(
                                              tx.paymentMethod == PaymentMethod.cash ? 'ເງິນສົດ' : 'QR ໂອນ',
                                              style: TextStyle(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.w700,
                                                color: tx.paymentMethod == PaymentMethod.cash
                                                    ? AppColors.primaryDark
                                                    : AppColors.wholesaleDark,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    // Items count
                                    DataCell(
                                      Text(
                                        '${tx.items.length} ລາຍການ (${tx.totalPiecesSold} ຊິ້ນ)',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    ),
                                    // Grand Total
                                    DataCell(
                                      Text(
                                        LaoCurrencyFormatter.format(tx.grandTotal),
                                        style: const TextStyle(
                                          fontSize: 13.5,
                                          fontWeight: FontWeight.w800,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                    ),
                                    // Profit
                                    DataCell(
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFECFDF5),
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: const Color(0xFFA7F3D0), width: 0.8),
                                        ),
                                        child: Text(
                                          '+${LaoCurrencyFormatter.format(tx.grossProfit)}',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF047857),
                                          ),
                                        ),
                                      ),
                                    ),
                                    // Actions
                                    DataCell(
                                      Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          // Details Modal
                                          OutlinedButton.icon(
                                            onPressed: () => _showTransactionDetails(context, tx),
                                            icon: const Icon(
                                              Icons.remove_red_eye_rounded,
                                              size: 14,
                                            ),
                                            label: const Text('ເບິ່ງບິນ'),
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor: AppColors.textSecondary,
                                              side: const BorderSide(color: AppColors.borderSubtle, width: 0.9),
                                              padding: const EdgeInsets.symmetric(
                                                horizontal: 9,
                                                vertical: 4,
                                              ),
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          // Re-print button
                                          ElevatedButton.icon(
                                            onPressed: () => showMeiiReceiptDialog(context, tx),
                                            icon: const Icon(Icons.print_rounded, size: 14),
                                            label: const Text('ພິມບິນ'),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: AppColors.surfaceDark,
                                              foregroundColor: Colors.white,
                                              padding: const EdgeInsets.symmetric(
                                                horizontal: 10,
                                                vertical: 4,
                                              ),
                                              elevation: 0,
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
                                            ),
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
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeframeChip(String label, HistoryDateFilter filter) {
    final isSelected = _dateFilter == filter;
    return InkWell(
      onTap: () => setState(() => _dateFilter = filter),
      borderRadius: BorderRadius.circular(7),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.surfaceDark : Colors.transparent,
          borderRadius: BorderRadius.circular(7),
          boxShadow: isSelected ? AppColors.cardShadow : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
            color: isSelected ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
    String? subtitle,
    double? fixedWidth,
  }) {
    final cardContent = Container(
      width: fixedWidth,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderSubtle, width: 0.9),
        boxShadow: AppColors.cardShadow,
      ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: color.withValues(alpha: 0.2), width: 0.8),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 1),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w500,
                        color: color,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      );

    return fixedWidth != null ? cardContent : Expanded(child: cardContent);
  }
}
