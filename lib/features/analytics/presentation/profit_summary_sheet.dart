import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/localization/lao_currency_formatter.dart';
import '../../../core/localization/lo.dart';
import '../../../domain/models/sale_transaction.dart';
import '../../pos/presentation/controllers/transaction_controller.dart';
import '../../pos/presentation/widgets/meii_receipt_slip.dart';

/// Financial Analytics & Profit Reporting Modal
class ProfitSummarySheet extends ConsumerStatefulWidget {
  const ProfitSummarySheet({super.key});

  @override
  ConsumerState<ProfitSummarySheet> createState() => _ProfitSummarySheetState();
}

class _ProfitSummarySheetState extends ConsumerState<ProfitSummarySheet>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final historyState = ref.watch(transactionHistoryProvider);

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 780, maxHeight: 680),
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const PhosphorIcon(
                          PhosphorIconsBold.chartLineUp,
                          color: AppColors.primary,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            LaoStrings.profitReport,
                            style: theme.textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            'ຕິດຕາມລາຍຮັບ, ຕົ້ນທຶນ ແລະ ກຳໄລຂັ້ນຕົ້ນ',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const PhosphorIcon(PhosphorIconsBold.x, color: AppColors.textMuted, size: 20),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Period Segmented Tabs
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: AppColors.backgroundAlt,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.borderSubtle, width: 0.9),
                ),
                child: TabBar(
                  controller: _tabController,
                  labelColor: Colors.white,
                  unselectedLabelColor: AppColors.textSecondary,
                  indicatorSize: TabBarIndicatorSize.tab,
                  indicator: BoxDecoration(
                    color: AppColors.surfaceDark,
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: AppColors.cardShadow,
                  ),
                  dividerColor: Colors.transparent,
                  labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  tabs: const [
                    Tab(text: LaoStrings.dailyProfit),
                    Tab(text: LaoStrings.weeklyProfit),
                    Tab(text: LaoStrings.monthlyProfit),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Tab Views
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildMetricsView(historyState.dailySummary, historyState.transactions),
                    _buildMetricsView(historyState.weeklySummary, historyState.transactions),
                    _buildMetricsView(historyState.monthlySummary, historyState.transactions),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMetricsView(ProfitSummary summary, List<SaleTransaction> transactions) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 4 Key Metrics Cards
          Row(
            children: [
              Expanded(
                child: _buildMetricCard(
                  title: LaoStrings.totalRevenue,
                  value: LaoCurrencyFormatter.format(summary.totalRevenue),
                  subValueThb: '≈ ${LaoCurrencyFormatter.formatDots(summary.totalRevenueThb.round())} ฿',
                  icon: PhosphorIconsBold.money,
                  color: AppColors.info,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMetricCard(
                  title: LaoStrings.totalCost,
                  value: LaoCurrencyFormatter.format(summary.totalCostOfGoods),
                  subValueThb: '≈ ${LaoCurrencyFormatter.formatDots(summary.totalCostThb.round())} ฿',
                  icon: PhosphorIconsBold.package,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMetricCard(
                  title: LaoStrings.grossProfit,
                  value: '+${LaoCurrencyFormatter.format(summary.totalGrossProfit)}',
                  subValueThb: '≈ +${LaoCurrencyFormatter.formatDots(summary.totalProfitThb.round())} ฿',
                  icon: PhosphorIconsBold.trendUp,
                  color: AppColors.primary,
                  isBold: true,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMetricCard(
                  title: LaoStrings.profitMargin,
                  value: '${summary.profitMarginPercent.toStringAsFixed(1)}%',
                  icon: PhosphorIconsBold.percent,
                  color: AppColors.wholesale,
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Secondary Info Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.surfaceSubtle,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildSubStat(LaoStrings.totalOrders, '${summary.transactionCount} ບິນ'),
                _buildSubStat(LaoStrings.totalQuantity, '${summary.totalItemsSold} ຊິ້ນ'),
                _buildSubStat(LaoStrings.discount, LaoCurrencyFormatter.format(summary.totalDiscounts)),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Recent Sales Log
          Text(
            'ລາຍການບິນຂາຍລ່າສຸດ:',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),

          if (transactions.isEmpty)
            Container(
              padding: const EdgeInsets.all(32),
              alignment: Alignment.center,
              child: const Text(
                'ຍັງບໍ່ມີຂໍ້ມູນການຂາຍໃນຊ່ວງເວລານີ້',
                style: TextStyle(color: AppColors.textMuted),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: transactions.take(6).length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final tx = transactions[index];
                final timeStr = DateFormat('HH:mm').format(tx.createdAt);
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  onTap: () => showMeiiReceiptDialog(context, tx),
                  leading: CircleAvatar(
                    backgroundColor: tx.isWholesale
                        ? AppColors.wholesaleLight
                        : AppColors.primaryLight,
                    child: Text(
                      tx.isWholesale ? 'ສ' : 'ຍ',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: tx.isWholesale
                            ? AppColors.wholesaleDark
                            : AppColors.primaryDark,
                      ),
                    ),
                  ),
                  title: Text(
                    '${tx.receiptNumber} • ${tx.customer.name}',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  subtitle: Text(
                    '$timeStr • ${tx.items.length} ລາຍການ • ${tx.paymentMethod == PaymentMethod.cash ? LaoStrings.cash : LaoStrings.transfer}',
                    style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                  ),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        LaoCurrencyFormatter.format(tx.grandTotal),
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                      ),
                      Text(
                        'ກຳໄລ: +${LaoCurrencyFormatter.format(tx.grossProfit)}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    String? subValueThb,
    required IconData icon,
    required Color color,
    bool isBold = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderSubtle, width: 0.9),
        boxShadow: AppColors.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: PhosphorIcon(icon, size: 14, color: color),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
              fontSize: 15.5,
              fontWeight: isBold ? FontWeight.w800 : FontWeight.w700,
              color: color == AppColors.textSecondary ? AppColors.textPrimary : color,
            ),
          ),
          if (subValueThb != null && subValueThb.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              subValueThb,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: (color == AppColors.textSecondary ? AppColors.textPrimary : color).withValues(alpha: 0.75),
                fontFamily: 'monospace',
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSubStat(String label, String value) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textSecondary)),
        const SizedBox(height: 3),
        Text(
          value,
          style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
        ),
      ],
    );
  }
}
