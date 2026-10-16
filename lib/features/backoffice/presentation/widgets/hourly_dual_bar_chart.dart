import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../providers/month_comparison_provider.dart';

/// Hourly Sales Trend (07:00 – 22:00) Dual Bars Chart
/// Compares average / total sales per hour between Month A (Slate) and Month B (Teal).
class HourlyDualBarChart extends StatefulWidget {
  final List<HourlyComparisonData> hourlyList;
  final int maxHourlyRev;
  final String monthALabel;
  final String monthBLabel;

  const HourlyDualBarChart({
    super.key,
    required this.hourlyList,
    required this.maxHourlyRev,
    required this.monthALabel,
    required this.monthBLabel,
  });

  @override
  State<HourlyDualBarChart> createState() => _HourlyDualBarChartState();
}

class _HourlyDualBarChartState extends State<HourlyDualBarChart> {
  int? _touchedHour;

  @override
  Widget build(BuildContext context) {
    final barGroups = <BarChartGroupData>[];
    for (int i = 0; i < widget.hourlyList.length; i++) {
      final item = widget.hourlyList[i];
      final isTouched = _touchedHour == item.hour;

      barGroups.add(
        BarChartGroupData(
          x: item.hour,
          barRods: [
            // Rod A: Month A (Slate)
            BarChartRodData(
              toY: item.revenueA.toDouble(),
              color: isTouched ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
              width: 8,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
            ),
            // Rod B: Month B (Teal)
            BarChartRodData(
              toY: item.revenueB.toDouble(),
              color: isTouched ? const Color(0xFF0F766E) : const Color(0xFF14B8A6),
              width: 8,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
            ),
          ],
          barsSpace: 3,
        ),
      );
    }

    final touchedItem = _touchedHour != null
        ? widget.hourlyList.firstWhere(
            (it) => it.hour == _touchedHour,
            orElse: () => HourlyComparisonData(hour: -1, label: '', revenueA: 0, revenueB: 0),
          )
        : null;

    final diff = touchedItem != null ? touchedItem.revenueB - touchedItem.revenueA : 0;
    final isUp = diff >= 0;

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
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDFA),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFCCFBF1)),
                    ),
                    child: const Icon(Icons.access_time_filled_rounded,
                        color: Color(0xFF0F766E), size: 18),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        '1.2. ຍອດຂາຍຕາມຊ່ວງເວລາ (Hourly Sales Trend 07:00 – 22:00 Dual Bars)',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        'ປຽບທຽບຍອດຂາຍແຕ່ລະຊົ່ວໂມງລະຫວ່າງ 2 ເດືອນ ເພື່ອວິເຄາະ Peak Hours',
                        style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ],
              ),
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

          // Detail Card on touch
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: touchedItem != null && touchedItem.hour != -1
                ? Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0F766E),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              touchedItem.label,
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
                            '${LaoCurrencyFormatter.formatNumber(touchedItem.revenueA)} ₭',
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
                            style: const TextStyle(fontSize: 11.5, color: Color(0xFF0F766E), fontWeight: FontWeight.bold),
                          ),
                          Text(
                            '${LaoCurrencyFormatter.formatNumber(touchedItem.revenueB)} ₭',
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
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
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
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            fontFamily: 'monospace',
                            color: isUp ? const Color(0xFF059669) : const Color(0xFFE11D48),
                          ),
                        ),
                      ),
                    ],
                  )
                : const Text(
                    '💡 ແຕະທີ່ເສົາກຣາຟຊົ່ວໂມງໃດໜຶ່ງ ເພື່ອເບິ່ງຍອດຂາຍທຽບ ແລະ ຜົນຕ່າງ',
                    style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Color(0xFF94A3B8)),
                  ),
          ),

          const SizedBox(height: 14),

          // Scrollable Chart for Tablet / Mobile
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: 720,
              height: 190,
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceBetween,
                  maxY: widget.maxHourlyRev * 1.15,
                  minY: 0,
                  groupsSpace: 12,
                  barTouchData: BarTouchData(
                    enabled: true,
                    touchTooltipData: BarTouchTooltipData(
                      getTooltipColor: (_) => const Color(0xFF0F172A),
                      tooltipBorderRadius: BorderRadius.circular(8),
                      getTooltipItem: (group, groupIndex, rod, rodIndex) {
                        final hour = group.x;
                        final it = widget.hourlyList.firstWhere(
                          (item) => item.hour == hour,
                          orElse: () => HourlyComparisonData(hour: hour, label: '$hour:00', revenueA: 0, revenueB: 0),
                        );
                        final d = it.revenueB - it.revenueA;
                        return BarTooltipItem(
                          '${it.label}\n${widget.monthALabel}: ${LaoCurrencyFormatter.formatNumber(it.revenueA)} ₭\n${widget.monthBLabel}: ${LaoCurrencyFormatter.formatNumber(it.revenueB)} ₭\nຜົນຕ່າງ: ${d >= 0 ? '+' : ''}${LaoCurrencyFormatter.formatNumber(d)} ₭',
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
                          _touchedHour = response.spot!.touchedBarGroup.x;
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
                        reservedSize: 42,
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
                          final hour = value.toInt();
                          final isSelected = hour == _touchedHour;
                          return Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              '${hour.toString().padLeft(2, '0')}:00',
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
                                color: isSelected ? const Color(0xFF0F766E) : const Color(0xFF64748B),
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
                    horizontalInterval: widget.maxHourlyRev > 0 ? widget.maxHourlyRev / 4 : 25000,
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
