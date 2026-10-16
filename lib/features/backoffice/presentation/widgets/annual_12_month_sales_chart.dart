import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../data/remote/supabase_sync_service.dart';

/// Annual 12-Month Sales Trend Chart (Smooth Area Line Chart)
/// Displays 12 months (Jan - Dec) with curved gradient fill and interactive touch tooltip.
class Annual12MonthSalesChart extends StatefulWidget {
  final int? initialYear;

  const Annual12MonthSalesChart({super.key, this.initialYear});

  @override
  State<Annual12MonthSalesChart> createState() => _Annual12MonthSalesChartState();
}

class _Annual12MonthSalesChartState extends State<Annual12MonthSalesChart> {
  late int _selectedYear;
  List<Map<String, dynamic>> _months = [];
  bool _isLoading = false;
  int? _touchedIndex;

  @override
  void initState() {
    super.initState();
    _selectedYear = widget.initialYear ?? DateTime.now().year;
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final res = await SupabaseSyncService.fetchAnnual12MonthSales(targetYear: _selectedYear);
      if (mounted) {
        setState(() {
          _months = res;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    int maxRev = 0;
    int totalAnnualRev = 0;
    for (final m in _months) {
      final r = (m['revenue'] as int?) ?? 0;
      totalAnnualRev += r;
      if (r > maxRev) maxRev = r;
    }
    if (maxRev == 0) maxRev = 100000;

    final spots = <FlSpot>[];
    for (int i = 0; i < _months.length; i++) {
      final rev = ((_months[i]['revenue'] as int?) ?? 0).toDouble();
      spots.add(FlSpot(i.toDouble(), rev));
    }

    final touchedMonth = _touchedIndex != null && _touchedIndex! >= 0 && _touchedIndex! < _months.length
        ? _months[_touchedIndex!]
        : null;

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
          // Header & Year Selector
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'ຍອດຂາຍລາຍເດືອນ 12 ເດືອນ (Annual 12-Month Sales Trend)',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'ເສັ້ນກຣາຟໂຄ້ງ Smooth Area ສະແດງທ່າອ່ຽງລາຍຮັບຕະຫຼອດ 12 ເດືອນ (ປີ $_selectedYear)',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                ],
              ),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFCBD5E1)),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<int>(
                        value: _selectedYear,
                        isDense: true,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                        items: [2026, 2025, 2024].map((y) {
                          return DropdownMenuItem(value: y, child: Text(y.toString()));
                        }).toList(),
                        onChanged: (val) {
                          if (val != null && val != _selectedYear) {
                            setState(() => _selectedYear = val);
                            _loadData();
                          }
                        },
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDFA),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFF99F6E4)),
                    ),
                    child: Text(
                      'ລວມ: ${LaoCurrencyFormatter.formatNumber(totalAnnualRev)} ₭',
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        fontFamily: 'monospace',
                        color: Color(0xFF0F766E),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Touched Month Detail Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: touchedMonth != null
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
                              touchedMonth['label']?.toString() ?? '',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 11,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Text('ຍອດຂາຍ: ', style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                          Text(
                            '${LaoCurrencyFormatter.formatNumber(touchedMonth['revenue'] as int? ?? 0)} ₭',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace',
                              color: Color(0xFF0F766E),
                            ),
                          ),
                          const Text('  |  ', style: TextStyle(color: Color(0xFFCBD5E1))),
                          const Text('ຕົ້ນທຶນ: ', style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                          Text(
                            '${LaoCurrencyFormatter.formatNumber(touchedMonth['cost'] as int? ?? 0)} ₭',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace',
                              color: Color(0xFFD97706),
                            ),
                          ),
                          const Text('  |  ', style: TextStyle(color: Color(0xFFCBD5E1))),
                          const Text('ກຳໄລ: ', style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                          Text(
                            '${LaoCurrencyFormatter.formatNumber(touchedMonth['profit'] as int? ?? 0)} ₭',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace',
                              color: Color(0xFF059669),
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE2E8F0),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '${touchedMonth['count']} ບິນ',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'monospace',
                            color: Color(0xFF334155),
                          ),
                        ),
                      ),
                    ],
                  )
                : const Text(
                    '💡 ແຕະທີ່ຈຸດເສັ້ນກຣາຟເດືອນໃດໜຶ່ງ ເພື່ອເບິ່ງຍອດຂາຍ, ຕົ້ນທຶນ ແລະ ກຳໄລລວມ',
                    style: TextStyle(fontSize: 11.5, fontStyle: FontStyle.italic, color: Color(0xFF94A3B8)),
                  ),
          ),
          const SizedBox(height: 16),

          // Smooth Area Line Chart
          SizedBox(
            height: 220,
            child: _isLoading
                ? const Center(
                    child: SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F766E)),
                    ),
                  )
                : LineChart(
                    LineChartData(
                      maxY: maxRev * 1.15,
                      minY: 0,
                      lineTouchData: LineTouchData(
                        enabled: true,
                        touchTooltipData: LineTouchTooltipData(
                          getTooltipColor: (_) => const Color(0xFF0F172A),
                          tooltipBorderRadius: BorderRadius.circular(8),
                          getTooltipItems: (touchedSpots) {
                            return touchedSpots.map((spot) {
                              final idx = spot.x.toInt();
                              if (idx < 0 || idx >= _months.length) return null;
                              final m = _months[idx];
                              return LineTooltipItem(
                                '${m['label']}\nຍອດຂາຍ: ${LaoCurrencyFormatter.formatNumber(m['revenue'] as int? ?? 0)} ₭\nຕົ້ນທຶນ: ${LaoCurrencyFormatter.formatNumber(m['cost'] as int? ?? 0)} ₭\nກຳໄລ: ${LaoCurrencyFormatter.formatNumber(m['profit'] as int? ?? 0)} ₭',
                                const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  fontFamily: 'monospace',
                                ),
                              );
                            }).toList();
                          },
                        ),
                        touchCallback: (event, response) {
                          if (response != null && response.lineBarSpots != null && response.lineBarSpots!.isNotEmpty) {
                            setState(() {
                              _touchedIndex = response.lineBarSpots!.first.x.toInt();
                            });
                          }
                        },
                      ),
                      gridData: FlGridData(
                        show: true,
                        drawVerticalLine: false,
                        horizontalInterval: maxRev > 0 ? maxRev / 4 : 25000,
                        getDrawingHorizontalLine: (value) => const FlLine(
                          color: Color(0xFFF1F5F9),
                          strokeWidth: 1,
                        ),
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
                              final idx = value.toInt();
                              if (idx < 0 || idx >= _months.length) return const SizedBox.shrink();
                              final label = _months[idx]['shortLabel']?.toString() ?? '';
                              final isSelected = idx == _touchedIndex;
                              return Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text(
                                  label,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: isSelected ? FontWeight.w900 : FontWeight.bold,
                                    color: isSelected ? const Color(0xFF0F766E) : const Color(0xFF64748B),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                      borderData: FlBorderData(show: false),
                      lineBarsData: [
                        LineChartBarData(
                          spots: spots,
                          isCurved: true,
                          curveSmoothness: 0.35,
                          color: const Color(0xFF0F766E),
                          barWidth: 3,
                          isStrokeCapRound: true,
                          dotData: FlDotData(
                            show: true,
                            getDotPainter: (spot, percent, barData, index) {
                              final isTouched = index == _touchedIndex;
                              return FlDotCirclePainter(
                                radius: isTouched ? 6 : 4,
                                color: const Color(0xFF0F766E),
                                strokeWidth: 2,
                                strokeColor: Colors.white,
                              );
                            },
                          ),
                          belowBarData: BarAreaData(
                            show: true,
                            gradient: const LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Color(0x330F766E),
                                Color(0x000F766E),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
