import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/localization/lao_currency_formatter.dart';
import '../../../domain/models/sale_transaction.dart';
import '../../pos/presentation/controllers/transaction_controller.dart';

enum DashboardTimeframe {
  daily,
  weekly,
  monthly,
  custom,
}

/// Module C: Financial & Profit Dashboard (ແຜງຄວບຄຸມ ລາຍຮັບ-ລາຍຈ່າຍ & ກຳໄລ)
/// Features:
/// - Timeframe tabs: ປະຈຳວັນ, ປະຈຳອາທິດ, ປະຈຳເດືອນ, Custom Date Range
/// - 5 Key KPI Metric Cards (Total Revenue, COGS, Gross Profit, Total Tickets, Payment Breakdown)
/// - Top Selling Items widget ranked by volume and margin contribution
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  DashboardTimeframe _selectedTimeframe = DashboardTimeframe.daily;
  DateTimeRange? _customDateRange;

  List<SaleTransaction> _filterTransactions(List<SaleTransaction> allTxs) {
    final now = DateTime.now();
    switch (_selectedTimeframe) {
      case DashboardTimeframe.daily:
        return allTxs.where((tx) {
          return tx.createdAt.year == now.year &&
              tx.createdAt.month == now.month &&
              tx.createdAt.day == now.day;
        }).toList();
      case DashboardTimeframe.weekly:
        final sevenDaysAgo = now.subtract(const Duration(days: 7));
        return allTxs.where((tx) => tx.createdAt.isAfter(sevenDaysAgo)).toList();
      case DashboardTimeframe.monthly:
        return allTxs.where((tx) {
          return tx.createdAt.year == now.year &&
              tx.createdAt.month == now.month;
        }).toList();
      case DashboardTimeframe.custom:
        if (_customDateRange == null) return allTxs;
        final start = _customDateRange!.start;
        final end = _customDateRange!.end.add(const Duration(days: 1));
        return allTxs.where((tx) {
          return tx.createdAt.isAfter(start) && tx.createdAt.isBefore(end);
        }).toList();
    }
  }

  Future<void> _pickCustomRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2025),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDateRange: _customDateRange ??
          DateTimeRange(
            start: DateTime.now().subtract(const Duration(days: 14)),
            end: DateTime.now(),
          ),
    );
    if (picked != null) {
      setState(() {
        _customDateRange = picked;
        _selectedTimeframe = DashboardTimeframe.custom;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final historyState = ref.watch(transactionHistoryProvider);
    final txs = _filterTransactions(historyState.transactions);

    // Metric aggregations
    int totalRevenue = 0;
    int totalCost = 0;
    int totalProfit = 0;
    int cashAmount = 0;
    int transferAmount = 0;
    int cashTickets = 0;
    int transferTickets = 0;

    // Top selling items map: productId -> (name, qty, revenue, profit)
    final Map<String, _TopProductAccumulator> topProducts = {};

    for (final tx in txs) {
      totalRevenue += tx.grandTotal;
      totalCost += tx.totalCostOfGoods;
      totalProfit += tx.grossProfit;

      if (tx.paymentMethod == PaymentMethod.cash) {
        cashAmount += tx.grandTotal;
        cashTickets++;
      } else {
        transferAmount += tx.grandTotal;
        transferTickets++;
      }

      for (final item in tx.items) {
        topProducts.update(
          item.product.id,
          (curr) => curr..add(item.quantity, item.lineTotal, item.lineProfit),
          ifAbsent: () => _TopProductAccumulator(
            id: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            revenue: item.lineTotal,
            profit: item.lineProfit,
          ),
        );
      }
    }

    final topList = topProducts.values.toList()
      ..sort((a, b) => b.quantity.compareTo(a.quantity));

    final profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0.0;
    final avgBasket = txs.isNotEmpty ? (totalRevenue / txs.length).round() : 0;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('ແຜງຄວບຄຸມການເງິນ & ກຳໄລ (Financial Dashboard)'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Timeframe Segmented Control
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  _buildTimeframeBtn(DashboardTimeframe.daily, 'ປະຈຳວັນ (Today)'),
                  _buildTimeframeBtn(DashboardTimeframe.weekly, 'ປະຈຳອາທິດ (Week)'),
                  _buildTimeframeBtn(DashboardTimeframe.monthly, 'ປະຈຳເດືອນ (Month)'),
                  _buildTimeframeBtn(
                    DashboardTimeframe.custom,
                    _customDateRange != null
                        ? '${DateFormat('dd/MM').format(_customDateRange!.start)} - ${DateFormat('dd/MM').format(_customDateRange!.end)}'
                        : 'ເລືອກວັນທີ...',
                    onTap: _pickCustomRange,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // 5 Key Metric KPI Cards
            LayoutBuilder(
              builder: (context, constraints) {
                return Wrap(
                  spacing: 16,
                  runSpacing: 16,
                  children: [
                    _buildKpiCard(
                      title: '1. ລວມຍອດຂາຍ (Total Revenue)',
                      value: LaoCurrencyFormatter.format(totalRevenue),
                      subtext: '${txs.length} ບິນຂາຍ • ສະເລ່ຍ/ບິນ: ${LaoCurrencyFormatter.format(avgBasket)}',
                      icon: Icons.payments,
                      accentColor: AppColors.primary,
                      width: (constraints.maxWidth - 32) / 3,
                    ),
                    _buildKpiCard(
                      title: '2. ຕົ້ນທຶນສິນຄ້າ (COGS)',
                      value: LaoCurrencyFormatter.format(totalCost),
                      subtext: 'ຕົ້ນທຶນສະສົມຕາມຫົວໜ່ວຍຫຼັກ',
                      icon: Icons.inventory_2,
                      accentColor: AppColors.textSecondary,
                      width: (constraints.maxWidth - 32) / 3,
                    ),
                    _buildKpiCard(
                      title: '3. ກຳໄລສຸດທິ (Gross Profit)',
                      value: '+${LaoCurrencyFormatter.format(totalProfit)}',
                      subtext: 'ອັດຕາກຳໄລ: ${profitMargin.toStringAsFixed(1)}%',
                      icon: Icons.trending_up,
                      accentColor: AppColors.primaryDark,
                      isHero: true,
                      width: (constraints.maxWidth - 32) / 3,
                    ),
                    _buildKpiCard(
                      title: '4. ຈຳນວນບິນ (Total Tickets)',
                      value: '${txs.length} ບິນ',
                      subtext: 'ຍອດຂາຍສົ່ງ: ${txs.where((t) => t.isWholesale).length} • ຂາຍຍ່ອຍ: ${txs.where((t) => !t.isWholesale).length}',
                      icon: Icons.receipt_long,
                      accentColor: AppColors.wholesale,
                      width: (constraints.maxWidth - 16) / 2,
                    ),
                    _buildKpiCard(
                      title: '5. ແຍກປະເພດຊຳລະ (Payment Split)',
                      value: 'ເງິນສົດ: ${LaoCurrencyFormatter.format(cashAmount)} ($cashTickets ບິນ)',
                      subtext: 'ເງິນໂອນ (QR): ${LaoCurrencyFormatter.format(transferAmount)} ($transferTickets ບິນ)',
                      icon: Icons.pie_chart,
                      accentColor: AppColors.info,
                      width: (constraints.maxWidth - 16) / 2,
                    ),
                  ],
                );
              },
            ),

            const SizedBox(height: 24),

            // Bottom Split: Top Selling Items (Left 50%) + Recent Transactions Log (Right 50%)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Selling Items Widget (ສິນຄ້າຂາຍດີສຸດ)
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: const [
                            Text(
                              'ສິນຄ້າຂາຍດີສຸດ (Top Selling Items)',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            Icon(Icons.leaderboard, size: 20, color: AppColors.primary),
                          ],
                        ),
                        const SizedBox(height: 16),
                        if (topList.isEmpty)
                          const Padding(
                            padding: EdgeInsets.all(24.0),
                            child: Center(
                              child: Text('ຍັງບໍ່ມີຂໍ້ມູນການຂາຍ', style: TextStyle(color: AppColors.textMuted)),
                            ),
                          )
                        else
                          ...topList.take(6).map((item) {
                            final maxQty = topList.first.quantity;
                            final ratio = maxQty > 0 ? item.quantity / maxQty : 0.0;

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          item.name,
                                          style: const TextStyle(fontWeight: FontWeight.w700),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      Text(
                                        '${item.quantity} ຊິ້ນ • +${LaoCurrencyFormatter.format(item.profit)}',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: LinearProgressIndicator(
                                      value: ratio,
                                      minHeight: 8,
                                      backgroundColor: AppColors.surfaceSubtle,
                                      valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                      ],
                    ),
                  ),
                ),

                const SizedBox(width: 20),

                // Recent Transactions Log
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: const [
                            Text(
                              'ລາຍການບິນຂາຍລ່າສຸດ (Recent Receipts)',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            Icon(Icons.history, size: 20, color: AppColors.textSecondary),
                          ],
                        ),
                        const SizedBox(height: 16),
                        if (txs.isEmpty)
                          const Padding(
                            padding: EdgeInsets.all(24.0),
                            child: Center(
                              child: Text('ຍັງບໍ່ມີບິນຂາຍ', style: TextStyle(color: AppColors.textMuted)),
                            ),
                          )
                        else
                          ListView.separated(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: txs.take(6).length,
                            separatorBuilder: (_, __) => const Divider(height: 1),
                            itemBuilder: (ctx, index) {
                              final tx = txs[index];
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: CircleAvatar(
                                  backgroundColor: tx.isWholesale ? AppColors.wholesaleLight : AppColors.primaryLight,
                                  child: Icon(
                                    tx.paymentMethod == PaymentMethod.cash ? Icons.money : Icons.qr_code,
                                    size: 18,
                                    color: tx.isWholesale ? AppColors.wholesaleDark : AppColors.primaryDark,
                                  ),
                                ),
                                title: Text(
                                  '${tx.receiptNumber} (${tx.customer.name})',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                                ),
                                subtitle: Text(
                                  '${DateFormat('HH:mm').format(tx.createdAt)} • ${tx.items.length} ລາຍການ',
                                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                ),
                                trailing: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      LaoCurrencyFormatter.format(tx.grandTotal),
                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                                    ),
                                    Text(
                                      'ກຳໄລ: +${LaoCurrencyFormatter.format(tx.grossProfit)}',
                                      style: const TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w600),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimeframeBtn(DashboardTimeframe timeframe, String label, {VoidCallback? onTap}) {
    final isSelected = _selectedTimeframe == timeframe;
    return Expanded(
      child: InkWell(
        onTap: () {
          if (onTap != null) {
            onTap();
          } else {
            setState(() => _selectedTimeframe = timeframe);
          }
        },
        borderRadius: BorderRadius.circular(8),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.surfaceDark : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            boxShadow: isSelected
                ? const [
                    BoxShadow(
                      color: Color(0x1F0F172A),
                      offset: Offset(0, 2),
                      blurRadius: 4,
                    ),
                  ]
                : null,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              color: isSelected ? Colors.white : AppColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required String subtext,
    required IconData icon,
    required Color accentColor,
    required double width,
    bool isHero = false,
  }) {
    return Container(
      width: width,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isHero ? AppColors.primaryLight.withValues(alpha: 0.4) : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isHero ? AppColors.primaryBorder : AppColors.border,
          width: isHero ? 1.2 : 0.9,
        ),
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
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
              ),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 18, color: accentColor),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.5,
              color: isHero ? AppColors.primaryDark : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtext,
            style: const TextStyle(fontSize: 11.5, color: AppColors.textTertiary),
          ),
        ],
      ),
    );
  }
}

class _TopProductAccumulator {
  final String id;
  final String name;
  int quantity;
  int revenue;
  int profit;

  _TopProductAccumulator({
    required this.id,
    required this.name,
    required this.quantity,
    required this.revenue,
    required this.profit,
  });

  void add(int q, int r, int p) {
    quantity += q;
    revenue += r;
    profit += p;
  }
}
