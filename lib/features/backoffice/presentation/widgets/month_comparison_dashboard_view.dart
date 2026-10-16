import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../providers/month_comparison_provider.dart';
import 'dual_bar_comparison_chart.dart';

/// Month-Over-Month Dual Comparison Dashboard View (ສົມທຽບ 2 ເດືອນ)
/// Side-by-Side 50/50 Dual Column Layout:
/// - Left Column: Month A Full Dashboard Suite
/// - Right Column: Month B Full Dashboard Suite
class MonthComparisonDashboardView extends ConsumerWidget {
  const MonthComparisonDashboardView({super.key});

  Future<void> _selectMonth(BuildContext context, WidgetRef ref, bool isMonthA, DateTime current) async {
    final now = DateTime.now();
    final List<DateTime> months = [];
    for (int i = 0; i < 36; i++) {
      months.add(DateTime(now.year, now.month - i, 1));
    }

    final selected = await showDialog<DateTime>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: Text(
          isMonthA ? 'ເລືອກເດືອນ A (Baseline)' : 'ເລືອກເດືອນ B (Target)',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        children: months.map((m) {
          final label = DateFormat('MM/yyyy').format(m);
          final isCur = m.year == current.year && m.month == current.month;
          return SimpleDialogOption(
            onPressed: () => Navigator.pop(ctx, m),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
              decoration: BoxDecoration(
                color: isCur ? const Color(0xFFF0FDFA) : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontWeight: isCur ? FontWeight.w900 : FontWeight.w600,
                      color: isCur ? const Color(0xFF0F766E) : const Color(0xFF1E293B),
                    ),
                  ),
                  if (isCur)
                    const Icon(Icons.check_rounded, color: Color(0xFF0F766E), size: 18),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );

    if (selected != null) {
      if (isMonthA) {
        ref.read(monthComparisonProvider.notifier).setMonthA(selected);
      } else {
        ref.read(monthComparisonProvider.notifier).setMonthB(selected);
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(monthComparisonProvider);
    final notifier = ref.read(monthComparisonProvider.notifier);

    final monthALabel = 'ເດືອນ ${DateFormat('MM/yyyy').format(state.monthA)}';
    final monthBLabel = 'ເດືອນ ${DateFormat('MM/yyyy').format(state.monthB)}';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. Month Picker Group with Presets & Refresh
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x06000000),
                blurRadius: 4,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 12,
            runSpacing: 10,
            children: [
              // Month A & Month B Buttons
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  InkWell(
                    onTap: () => _selectMonth(context, ref, true, state.monthA),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF94A3B8)),
                      ),
                      child: Row(
                        children: [
                          const Text('ເດືອນ A: ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                          Text(monthALabel, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
                          const SizedBox(width: 4),
                          const Icon(Icons.arrow_drop_down, size: 16, color: Color(0xFF64748B)),
                        ],
                      ),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8),
                    child: Text('VS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF94A3B8))),
                  ),
                  InkWell(
                    onTap: () => _selectMonth(context, ref, false, state.monthB),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDFA),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF0F766E)),
                      ),
                      child: Row(
                        children: [
                          const Text('ເດືອນ B: ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0F766E))),
                          Text(monthBLabel, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF0F766E))),
                          const SizedBox(width: 4),
                          const Icon(Icons.arrow_drop_down, size: 16, color: Color(0xFF0F766E)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),

              // Presets (YoY, MoM) & Reload
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  OutlinedButton(
                    onPressed: notifier.applyPresetMoM,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('ເດືອນກ່ອນໜ້າ (MoM)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                  ),
                  const SizedBox(width: 6),
                  OutlinedButton(
                    onPressed: notifier.applyPresetYoY,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('ທຽບປີກ່ອນ (YoY)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: state.isLoading ? null : notifier.loadComparison,
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: state.isLoading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F766E)),
                            )
                          : const Icon(Icons.refresh_rounded, size: 18, color: Color(0xFF475569)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // 2. Summary Comparison Strip
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 12,
            runSpacing: 8,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: Color(0xFF0F766E),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'ສັງລວມການປຽບທຽບ: $monthALabel ທຽບກັບ $monthBLabel',
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                  ),
                ],
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildSummaryBadge('ຍອດຂາຍ', state.revenueGrowth),
                  const SizedBox(width: 8),
                  _buildSummaryBadge('ກຳໄລຕົວຈິງ', state.profitGrowth),
                  const SizedBox(width: 8),
                  _buildSummaryBadge('ຈຳນວນບິນ', state.countGrowth),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // 3. CORE REQUIREMENT: SIDE-BY-SIDE 50/50 DUAL COLUMN LAYOUT
        LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 850;

            final colA = _buildMonthDashboardColumn(
              context: context,
              ref: ref,
              title: 'ເດືອນ A',
              monthLabel: monthALabel,
              monthDate: state.monthA,
              isMonthA: true,
              revenue: state.revenueA,
              cost: state.revenueA - state.profitA,
              profit: state.profitA,
              count: state.countA,
              margin: state.marginA,
              cash: state.cashA,
              transfer: state.transferA,
              debt: state.debtA,
              hourlyList: state.hourlyList,
              categoryList: state.categoryList,
              totalCatRev: state.totalCatRevA,
              topSellers: state.topSellers,
            );

            final colB = _buildMonthDashboardColumn(
              context: context,
              ref: ref,
              title: 'ເດືອນ B',
              monthLabel: monthBLabel,
              monthDate: state.monthB,
              isMonthA: false,
              revenue: state.revenueB,
              cost: state.revenueB - state.profitB,
              profit: state.profitB,
              count: state.countB,
              margin: state.marginB,
              cash: state.cashB,
              transfer: state.transferB,
              debt: state.debtB,
              hourlyList: state.hourlyList,
              categoryList: state.categoryList,
              totalCatRev: state.totalCatRevB,
              topSellers: state.topSellers,
              growthRev: state.revenueGrowth,
              growthProfit: state.profitGrowth,
              growthCount: state.countGrowth,
              growthCash: state.cashGrowth,
              growthTransfer: state.transferGrowth,
              growthDebt: state.debtGrowth,
            );

            if (isWide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: colA),
                  const SizedBox(width: 16),
                  Expanded(child: colB),
                ],
              );
            } else {
              return Column(
                children: [
                  colA,
                  const SizedBox(height: 16),
                  colB,
                ],
              );
            }
          },
        ),

        const SizedBox(height: 16),

        // 4. Daily Dual-Bar Trend Chart (Days 1 to 31)
        DualBarComparisonChart(
          txsA: state.txsA,
          txsB: state.txsB,
          monthALabel: monthALabel,
          monthBLabel: monthBLabel,
        ),
      ],
    );
  }

  Widget _buildSummaryBadge(String label, double growth) {
    final isUp = growth >= 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('$label: ', style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
          Text(
            '${isUp ? '▲ +' : '▼ '}${growth.toStringAsFixed(1)}%',
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w900,
              fontFamily: 'monospace',
              color: isUp ? const Color(0xFF059669) : const Color(0xFFE11D48),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMonthDashboardColumn({
    required BuildContext context,
    required WidgetRef ref,
    required String title,
    required String monthLabel,
    required DateTime monthDate,
    required bool isMonthA,
    required int revenue,
    required int cost,
    required int profit,
    required int count,
    required double margin,
    required int cash,
    required int transfer,
    required int debt,
    required List<HourlyComparisonData> hourlyList,
    required List<CategoryComparisonData> categoryList,
    required int totalCatRev,
    required List<TopSellerComparisonData> topSellers,
    double? growthRev,
    double? growthProfit,
    double? growthCount,
    double? growthCash,
    double? growthTransfer,
    double? growthDebt,
  }) {
    final maxHourly = hourlyList.fold<int>(0, (prev, e) {
      final r = isMonthA ? e.revenueA : e.revenueB;
      return r > prev ? r : prev;
    });

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isMonthA ? const Color(0xFFF8FAFC) : const Color(0xFFF0FDFA).withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isMonthA ? const Color(0xFFE2E8F0) : const Color(0xFF99F6E4),
        ),
      ),
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
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: isMonthA ? const Color(0xFFE2E8F0) : const Color(0xFF0F766E),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      isMonthA ? 'A' : 'B',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: isMonthA ? const Color(0xFF334155) : Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$title: $monthLabel',
                        style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                      ),
                      Text(
                        isMonthA ? 'ເດືອນຖານ (Baseline)' : 'ເດືອນເປົ້າໝາຍ (Target)',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isMonthA ? const Color(0xFF64748B) : const Color(0xFF0F766E),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              InkWell(
                onTap: () => _selectMonth(context, ref, isMonthA, monthDate),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today_rounded, size: 12, color: Color(0xFF64748B)),
                      const SizedBox(width: 4),
                      Text(
                        DateFormat('MM/yy').format(monthDate),
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // 1. 4 KPI Cards (2x2 Grid)
          Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: _buildMetricCard(
                      title: 'ຍອດຂາຍລວມ',
                      val: LaoCurrencyFormatter.format(revenue),
                      icon: Icons.monetization_on_rounded,
                      color: const Color(0xFF0F766E),
                      growth: growthRev,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMetricCard(
                      title: 'ຕົ້ນທຶນສິນຄ້າລວມ',
                      val: LaoCurrencyFormatter.format(cost),
                      icon: Icons.account_balance_wallet_rounded,
                      color: const Color(0xFFD97706),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _buildMetricCard(
                      title: 'ກຳໄລຕົວຈິງ',
                      val: LaoCurrencyFormatter.format(profit),
                      icon: Icons.credit_card_rounded,
                      color: const Color(0xFF059669),
                      growth: growthProfit,
                      subtext: 'ກຳໄລ: ${margin.toStringAsFixed(1)}%',
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMetricCard(
                      title: 'ຈຳນວນບິນທັງໝົດ',
                      val: '$count ບິນ',
                      icon: Icons.receipt_long_rounded,
                      color: const Color(0xFF2563EB),
                      growth: growthCount,
                    ),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 12),

          // 2. Payment Breakdown (Cash, Transfer, Credit)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.payment_rounded, size: 14, color: Color(0xFF0F766E)),
                    SizedBox(width: 4),
                    Text(
                      'ຊ່ອງທາງການຊຳລະເງິນ',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _buildChannelBox('1. ເງິນສົດ (Cash)', cash, const Color(0xFF059669), growthCash),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: _buildChannelBox('2. ໂອນເງິນ', transfer, const Color(0xFF2563EB), growthTransfer),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: _buildChannelBox('3. ຕິດໜີ້ (Credit)', debt, const Color(0xFFD97706), growthDebt),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // 3. Hourly Sales Trend (07:00 - 22:00)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.access_time_rounded, size: 14, color: Color(0xFF0F766E)),
                        SizedBox(width: 4),
                        Text(
                          'ຍອດຂາຍຕາມຊ່ວງເວລາ (07:00 - 22:00)',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                        ),
                      ],
                    ),
                    Text(
                      'ສູງສຸດ: ${LaoCurrencyFormatter.format(maxHourly)}',
                      style: const TextStyle(fontSize: 9.5, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 90,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: hourlyList.map((h) {
                      final rev = isMonthA ? h.revenueA : h.revenueB;
                      final hPct = maxHourly > 0 ? (rev / maxHourly) : 0.0;
                      final clampedHeight = rev > 0 ? (hPct * 70).clamp(6.0, 70.0) : 3.0;

                      return Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 1),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Container(
                                height: clampedHeight,
                                decoration: BoxDecoration(
                                  color: rev > 0
                                      ? (isMonthA ? const Color(0xFF64748B) : const Color(0xFF0F766E))
                                      : const Color(0xFFF1F5F9),
                                  borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${h.hour}',
                                style: const TextStyle(fontSize: 8, color: Color(0xFF94A3B8)),
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // 4. Sales by Category
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.pie_chart_rounded, size: 14, color: Color(0xFF0F766E)),
                        SizedBox(width: 4),
                        Text(
                          'ໂຄງສ້າງຍອດຂາຍຕາມໝວດໝູ່ (Category)',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                        ),
                      ],
                    ),
                    Text(
                      '${categoryList.length} ໝວດ',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF0F766E)),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Horizontal Proportion Bar
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: SizedBox(
                    height: 10,
                    child: Row(
                      children: categoryList.map((cat) {
                        final pct = isMonthA ? cat.pctA : cat.pctB;
                        if (pct <= 0) return const SizedBox.shrink();
                        return Expanded(
                          flex: (pct * 10).round().clamp(1, 1000),
                          child: Container(color: cat.color),
                        );
                      }).toList(),
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // List Categories
                ...categoryList.take(5).map((cat) {
                  final rev = isMonthA ? cat.revA : cat.revB;
                  final pct = isMonthA ? cat.pctA : cat.pctB;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(width: 8, height: 8, decoration: BoxDecoration(color: cat.color, shape: BoxShape.circle)),
                            const SizedBox(width: 6),
                            Text(cat.name, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
                          ],
                        ),
                        Text(
                          '${LaoCurrencyFormatter.format(rev)} (${pct.toStringAsFixed(1)}%)',
                          style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, fontFamily: 'monospace', color: Color(0xFF0F172A)),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // 5. Top 5 Best Sellers
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.local_fire_department_rounded, size: 14, color: Color(0xFFD97706)),
                    SizedBox(width: 4),
                    Text(
                      '5 ສິນຄ້າຂາຍດີທີ່ສຸດ (Top 5 Sellers)',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ...topSellers.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final item = entry.value;
                  final qty = isMonthA ? item.qtyA : item.qtyB;
                  final rev = isMonthA ? item.revA : item.revB;

                  return Container(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    decoration: BoxDecoration(
                      border: Border(bottom: BorderSide(color: Colors.grey.shade100, width: 0.8)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 18,
                              height: 18,
                              decoration: BoxDecoration(
                                color: idx == 0 ? const Color(0xFFF59E0B) : const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                '${idx + 1}',
                                style: TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.bold,
                                  color: idx == 0 ? Colors.white : const Color(0xFF475569),
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              item.name,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                            ),
                          ],
                        ),
                        Text(
                          '$qty ${item.unitName} • ${LaoCurrencyFormatter.format(rev)}',
                          style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, fontFamily: 'monospace', color: Color(0xFF0F766E)),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String val,
    required IconData icon,
    required Color color,
    double? growth,
    String? subtext,
  }) {
    final isUp = (growth ?? 0) >= 0;

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Icon(icon, size: 14, color: color),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            val,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w900,
              fontFamily: 'monospace',
              color: color,
            ),
          ),
          if (growth != null) ...[
            const SizedBox(height: 3),
            Text(
              '${isUp ? '▲ +' : '▼ '}${growth.toStringAsFixed(1)}%',
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.bold,
                color: isUp ? const Color(0xFF059669) : const Color(0xFFE11D48),
              ),
            ),
          ] else if (subtext != null) ...[
            const SizedBox(height: 3),
            Text(subtext, style: const TextStyle(fontSize: 9.5, color: Color(0xFF64748B))),
          ],
        ],
      ),
    );
  }

  Widget _buildChannelBox(String label, int amount, Color color, double? growth) {
    final isUp = (growth ?? 0) >= 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: color),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (growth != null)
                Text(
                  '${isUp ? '+' : ''}${growth.toStringAsFixed(0)}%',
                  style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: isUp ? const Color(0xFF059669) : const Color(0xFFE11D48)),
                ),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            LaoCurrencyFormatter.format(amount),
            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, fontFamily: 'monospace', color: color),
          ),
        ],
      ),
    );
  }
}
