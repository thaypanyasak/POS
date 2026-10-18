import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../data/remote/supabase_sync_service.dart';
import '../../../../domain/models/sale_transaction.dart';

/// Annual 12-Month Sales Trend Chart (Smooth Area Line Chart)
/// Displays 12 months (Jan - Dec) with curved gradient fill and interactive touch tooltip.
class Annual12MonthSalesChart extends StatefulWidget {
  final int? initialYear;
  final List<SaleTransaction>? fallbackTransactions;

  const Annual12MonthSalesChart({
    super.key,
    this.initialYear,
    this.fallbackTransactions,
  });

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

  @override
  void didUpdateWidget(covariant Annual12MonthSalesChart oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.fallbackTransactions != widget.fallbackTransactions) {
      _loadData();
    }
  }

  List<Map<String, dynamic>> _computeLocalMonths(int year) {
    final laoMonthNames = [
      'ມັງກອນ (01)', 'ກຸມພາ (02)', 'ມີນາ (03)', 'ເມສາ (04)',
      'ພຶດສະພາ (05)', 'ມິຖຸນາ (06)', 'ກໍລະກົດ (07)', 'ສິງຫາ (08)',
      'ກັນຍາ (09)', 'ຕຸລາ (10)', 'ພະຈິກ (11)', 'ທັນວາ (12)',
    ];
    final list = laoMonthNames.asMap().entries.map((e) => {
      'monthIndex': e.key + 1,
      'month': '${(e.key + 1).toString().padLeft(2, '0')}/$year',
      'monthName': e.value,
      'label': e.value,
      'shortLabel': e.value,
      'simpleMonth': (e.key + 1).toString().padLeft(2, '0'),
      'revenue': 0,
      'total_sales': 0,
      'cost': 0,
      'total_cost': 0,
      'profit': 0,
      'gross_profit': 0,
      'count': 0,
    }).toList();

    final txs = widget.fallbackTransactions ?? [];
    for (final t in txs) {
      if (t.isCancelled || t.status == 'cancelled') continue;
      if (t.createdAt.year == year) {
        final mIdx = t.createdAt.month - 1;
        if (mIdx >= 0 && mIdx < 12) {
          list[mIdx]['revenue'] = (list[mIdx]['revenue'] as int) + t.grandTotal;
          list[mIdx]['total_sales'] = (list[mIdx]['total_sales'] as int) + t.grandTotal;
          list[mIdx]['cost'] = (list[mIdx]['cost'] as int) + t.totalCostOfGoods;
          list[mIdx]['total_cost'] = (list[mIdx]['total_cost'] as int) + t.totalCostOfGoods;
          list[mIdx]['profit'] = (list[mIdx]['profit'] as int) + t.grossProfit;
          list[mIdx]['gross_profit'] = (list[mIdx]['gross_profit'] as int) + t.grossProfit;
          list[mIdx]['count'] = (list[mIdx]['count'] as int) + 1;
        }
      }
    }
    return list;
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final res = await SupabaseSyncService.fetchAnnual12MonthSales(targetYear: _selectedYear);
      if (mounted) {
        final bool hasRemoteRev = res.any((m) => ((m['revenue'] as int?) ?? 0) > 0);
        setState(() {
          _months = hasRemoteRev ? res : _computeLocalMonths(_selectedYear);
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _months = _computeLocalMonths(_selectedYear);
          _isLoading = false;
        });
      }
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
                  PopupMenuButton<int>(
                    tooltip: 'ເລືອກປີ',
                    offset: const Offset(0, 36),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: const BorderSide(color: AppColors.border),
                    ),
                    color: AppColors.surface,
                    onSelected: (val) {
                      if (val != _selectedYear) {
                        setState(() => _selectedYear = val);
                        _loadData();
                      }
                    },
                    itemBuilder: (ctx) => [2026, 2025, 2024].map((y) {
                      return PopupMenuItem<int>(
                        value: y,
                        child: Text(y.toString(), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textMain)),
                      );
                    }).toList(),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceSubtle,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _selectedYear.toString(),
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textMain),
                          ),
                          const SizedBox(width: 4),
                          const PhosphorIcon(PhosphorIconsBold.caretDown, size: 12, color: AppColors.textMuted),
                        ],
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
                : const Row(
                    children: [
                      PhosphorIcon(PhosphorIconsBold.lightbulb, size: 14, color: AppColors.textMuted),
                      SizedBox(width: 6),
                      Text(
                        'ແຕະທີ່ຈຸດເສັ້ນກຣາຟເດືອນໃດໜຶ່ງ ເພື່ອເບິ່ງຍອດຂາຍ, ຕົ້ນທຶນ ແລະ ກຳໄລລວມ',
                        style: TextStyle(fontSize: 11.5, fontStyle: FontStyle.italic, color: AppColors.textMuted),
                      ),
                    ],
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
