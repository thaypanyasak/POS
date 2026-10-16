import 'package:flutter/material.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../providers/month_comparison_provider.dart';

/// Sales by Category Comparison Widget
/// Displays 2 Proportion Bars:
/// - Row 1: Month A Category proportions
/// - Row 2: Month B Category proportions
/// Detailed list below with Month A vs Month B revenue and growth badge (▲ +XX%).
class CategoryComparisonWidget extends StatelessWidget {
  final List<CategoryComparisonData> categoryList;
  final int totalCatRevA;
  final int totalCatRevB;
  final String monthALabel;
  final String monthBLabel;

  const CategoryComparisonWidget({
    super.key,
    required this.categoryList,
    required this.totalCatRevA,
    required this.totalCatRevB,
    required this.monthALabel,
    required this.monthBLabel,
  });

  @override
  Widget build(BuildContext context) {
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
                      color: const Color(0xFFF0FDFA),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFCCFBF1)),
                    ),
                    child: const Icon(Icons.pie_chart_rounded,
                        color: Color(0xFF0F766E), size: 18),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        '1.3. ໂຄງສ້າງຍອດຂາຍຕາມໝວດໝູ່ (Sales by Category Comparison)',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        'ສັດສ່ວນລາຍຮັບ ແລະ ອັດຕາເຕີບໂຕຂອງແຕ່ລະກຸ່ມສິນຄ້າທັງ 2 ເດືອນ',
                        style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDFA),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFF99F6E4)),
                ),
                child: Text(
                  '${categoryList.length} ໝວດໝູ່',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F766E),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // 2 Multi-color Proportion Bars
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Row 1: Month A Proportion
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Color(0xFF94A3B8),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'ແຖວທີ 1: ສັດສ່ວນໝວດໝູ່ $monthALabel',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF475569),
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '${LaoCurrencyFormatter.formatNumber(totalCatRevA)} ₭',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        fontFamily: 'monospace',
                        color: Color(0xFF475569),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                _buildStackedBar(categoryList, isMonthA: true),

                const SizedBox(height: 12),

                // Row 2: Month B Proportion
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
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
                          'ແຖວທີ 2: ສັດສ່ວນໝວດໝູ່ $monthBLabel',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F766E),
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '${LaoCurrencyFormatter.formatNumber(totalCatRevB)} ₭',
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w900,
                        fontFamily: 'monospace',
                        color: Color(0xFF0F766E),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                _buildStackedBar(categoryList, isMonthA: false),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Detailed Category List with Growth Badges
          if (categoryList.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Center(
                child: Text('ຍັງບໍ່ມີຂໍ້ມູນໝວດໝູ່', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: categoryList.length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
              itemBuilder: (context, idx) {
                final cat = categoryList[idx];
                final isUp = cat.growth >= 0;

                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Category Dot & Name
                      Row(
                        children: [
                          Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                              color: cat.color,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            cat.name,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                        ],
                      ),

                      // Values for A vs B and Growth badge
                      Row(
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                monthALabel,
                                style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8)),
                              ),
                              Text(
                                '${LaoCurrencyFormatter.formatNumber(cat.revA)} ₭',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  fontFamily: 'monospace',
                                  color: Color(0xFF475569),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 14),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                monthBLabel,
                                style: const TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF0F766E),
                                ),
                              ),
                              Text(
                                '${LaoCurrencyFormatter.formatNumber(cat.revB)} ₭',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w900,
                                  fontFamily: 'monospace',
                                  color: Color(0xFF0F766E),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 12),
                          Container(
                            width: 76,
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                            decoration: BoxDecoration(
                              color: isUp ? const Color(0xFFECFDF5) : const Color(0xFFFFF1F2),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: isUp ? const Color(0xFFA7F3D0) : const Color(0xFFFECDD3),
                              ),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '${isUp ? '▲ +' : '▼ '}${cat.growth.toStringAsFixed(1)}%',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w900,
                                fontFamily: 'monospace',
                                color: isUp ? const Color(0xFF059669) : const Color(0xFFE11D48),
                              ),
                            ),
                          ),
                        ],
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

  Widget _buildStackedBar(List<CategoryComparisonData> list, {required bool isMonthA}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: Container(
        height: 12,
        color: const Color(0xFFE2E8F0),
        child: Row(
          children: list.map((cat) {
            final pct = isMonthA ? cat.pctA : cat.pctB;
            if (pct <= 0) return const SizedBox.shrink();
            final flex = (pct * 10).round();
            return Expanded(
              flex: flex > 0 ? flex : 1,
              child: Container(
                color: isMonthA ? cat.color.withValues(alpha: 0.75) : cat.color,
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}
