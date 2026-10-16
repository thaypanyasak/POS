import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../domain/models/sale_transaction.dart';

/// Interactive Dual-Bar Comparison Chart for Days 1 to 31
/// Displays two adjacent bars per day:
/// - Bar A: Muted Slate (Month A)
/// - Bar B: Deep Teal (Month B)
/// Interactive touch tooltip showing exact amounts and difference.
class DualBarComparisonChart extends StatefulWidget {
  final List<SaleTransaction> txsA;
  final List<SaleTransaction> txsB;
  final String monthALabel;
  final String monthBLabel;

  const DualBarComparisonChart({
    super.key,
    required this.txsA,
    required this.txsB,
    required this.monthALabel,
    required this.monthBLabel,
  });

  @override
  State<DualBarComparisonChart> createState() => _DualBarComparisonChartState();
}

class _DualBarComparisonChartState extends State<DualBarComparisonChart> {
  int? _touchedDay;

  @override
  Widget build(BuildContext context) {
    // 1. Group daily revenue for Days 1 to 31
    final Map<int, int> revA = {for (int i = 1; i <= 31; i++) i: 0};
    final Map<int, int> revB = {for (int i = 1; i <= 31; i++) i: 0};

    for (final tx in widget.txsA) {
      if (tx.isCancelled || tx.status == 'cancelled') continue;
      final day = tx.createdAt.day;
      if (day >= 1 && day <= 31) {
        revA[day] = (revA[day] ?? 0) + tx.grandTotal;
      }
    }

    for (final tx in widget.txsB) {
      if (tx.isCancelled || tx.status == 'cancelled') continue;
      final day = tx.createdAt.day;
      if (day >= 1 && day <= 31) {
        revB[day] = (revB[day] ?? 0) + tx.grandTotal;
      }
    }

    int maxVal = 0;
    for (int i = 1; i <= 31; i++) {
      if ((revA[i] ?? 0) > maxVal) maxVal = revA[i]!;
      if ((revB[i] ?? 0) > maxVal) maxVal = revB[i]!;
    }
    if (maxVal == 0) maxVal = 100000;

    // 2. Build 31 BarChartGroupData
    final barGroups = <BarChartGroupData>[];
    for (int day = 1; day <= 31; day++) {
      final valA = (revA[day] ?? 0).toDouble();
      final valB = (revB[day] ?? 0).toDouble();
      final isTouched = _touchedDay == day;

      barGroups.add(
        BarChartGroupData(
          x: day,
          barRods: [
            BarChartRodData(
              toY: valA,
              color: isTouched ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
              width: 7,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
            ),
            BarChartRodData(
              toY: valB,
              color: isTouched ? const Color(0xFF0F766E) : const Color(0xFF14B8A6),
              width: 7,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
            ),
          ],
          barsSpace: 2,
        ),
      );
    }

    final int selectedDayA = _touchedDay != null ? (revA[_touchedDay!] ?? 0) : 0;
    final int selectedDayB = _touchedDay != null ? (revB[_touchedDay!] ?? 0) : 0;
    final int diff = selectedDayB - selectedDayA;
    final bool isUp = diff >= 0;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header & Legend
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'ຍອດຂາຍລາຍວັນ (Daily Sales Trend)',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    'ກົດ ຫຼື ຊີ້ໃສ່ແທ່ງກຣາຟເພື່ອເບິ່ງລາຍລະອຽດຍອດຂາຍ (1 – 31)',
                    style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                ],
              ),
              // Legend
              Row(
                children: [
                  _buildLegendItem(const Color(0xFF94A3B8), widget.monthALabel),
                  const SizedBox(width: 14),
                  _buildLegendItem(const Color(0xFF0F766E), widget.monthBLabel),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Detail Tooltip Card (Selected / Touched Day)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: _touchedDay != null
                ? Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0F766E),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'ວັນທີ $_touchedDay',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 11,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            '${widget.monthALabel}: ',
                            style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                          ),
                          Text(
                            '${LaoCurrencyFormatter.formatNumber(selectedDayA)} ₭',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace',
                              color: Color(0xFF334155),
                            ),
                          ),
                          const Text('  |  ', style: TextStyle(color: Color(0xFFCBD5E1))),
                          Text(
                            '${widget.monthBLabel}: ',
                            style: const TextStyle(fontSize: 11.5, color: Color(0xFF0F766E)),
                          ),
                          Text(
                            '${LaoCurrencyFormatter.formatNumber(selectedDayB)} ₭',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace',
                              color: Color(0xFF0F766E),
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isUp ? const Color(0xFFECFDF5) : const Color(0xFFFFF1F2),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isUp ? const Color(0xFFA7F3D0) : const Color(0xFFFECDD3),
                          ),
                        ),
                        child: Text(
                          '${isUp ? '▲ +' : '▼ -'}${LaoCurrencyFormatter.formatNumber(diff.abs())} ₭',
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            fontFamily: 'monospace',
                            color: isUp ? const Color(0xFF059669) : const Color(0xFFE11D48),
                          ),
                        ),
                      ),
                    ],
                  )
                : const Text(
                    '💡 ແຕະທີ່ແທ່ງກຣາຟວັນທີໃດໜຶ່ງ ເພື່ອເບິ່ງຍອດຂາຍທຽບລະອຽດ ແລະ ຜົນຕ່າງ',
                    style: TextStyle(fontSize: 11.5, fontStyle: FontStyle.italic, color: Color(0xFF94A3B8)),
                  ),
          ),
          const SizedBox(height: 16),

          // Scrollable BarChart Container for Tablet / iPad POS
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: 820,
              height: 220,
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceBetween,
                  maxY: maxVal * 1.15,
                  minY: 0,
                  groupsSpace: 6,
                  barTouchData: BarTouchData(
                    enabled: true,
                    touchTooltipData: BarTouchTooltipData(
                      getTooltipColor: (_) => const Color(0xFF0F172A),
                      tooltipBorderRadius: BorderRadius.circular(8),
                      getTooltipItem: (group, groupIndex, rod, rodIndex) {
                        final day = group.x;
                        final a = revA[day] ?? 0;
                        final b = revB[day] ?? 0;
                        final d = b - a;
                        return BarTooltipItem(
                          'ວັນທີ $day\n${widget.monthALabel}: ${LaoCurrencyFormatter.formatNumber(a)} ₭\n${widget.monthBLabel}: ${LaoCurrencyFormatter.formatNumber(b)} ₭\nຜົນຕ່າງ: ${d >= 0 ? '+' : ''}${LaoCurrencyFormatter.formatNumber(d)} ₭',
                          const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            fontFamily: 'monospace',
                          ),
                        );
                      },
                    ),
                    touchCallback: (event, response) {
                      if (response != null && response.spot != null) {
                        setState(() {
                          _touchedDay = response.spot!.touchedBarGroup.x;
                        });
                      }
                    },
                  ),
                  titlesData: FlTitlesData(
                    show: true,
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 45,
                        getTitlesWidget: (value, meta) {
                          if (value == 0) return const SizedBox.shrink();
                          if (value >= 1000000) {
                            return Text(
                              '${(value / 1000000).toStringAsFixed(1)}M',
                              style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8), fontFamily: 'monospace'),
                            );
                          } else if (value >= 1000) {
                            return Text(
                              '${(value / 1000).round()}K',
                              style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8), fontFamily: 'monospace'),
                            );
                          }
                          return Text(
                            value.toInt().toString(),
                            style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8), fontFamily: 'monospace'),
                          );
                        },
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (value, meta) {
                          final day = value.toInt();
                          final isHighlight = day % 5 == 0 || day == 1 || day == 31;
                          final isSelected = day == _touchedDay;
                          return Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              day.toString(),
                              style: TextStyle(
                                fontSize: isSelected ? 11 : 9.5,
                                fontWeight: isSelected || isHighlight ? FontWeight.bold : FontWeight.normal,
                                color: isSelected
                                    ? const Color(0xFF0F766E)
                                    : isHighlight
                                        ? const Color(0xFF334155)
                                        : const Color(0xFF94A3B8),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  gridData: FlGridData(
                    show: true,
                    drawVerticalLine: false,
                    horizontalInterval: maxVal > 0 ? maxVal / 4 : 25000,
                    getDrawingHorizontalLine: (value) => const FlLine(
                      color: Color(0xFFF1F5F9),
                      strokeWidth: 1,
                    ),
                  ),
                  borderData: FlBorderData(show: false),
                  barGroups: barGroups,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: Color(0xFF475569),
          ),
        ),
      ],
    );
  }
}
