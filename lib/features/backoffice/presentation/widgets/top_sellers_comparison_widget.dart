import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../providers/month_comparison_provider.dart';

/// Top 5 Best Sellers Comparison Widget
/// Compares sales volume and revenue for Top 5 items between Month A and Month B
/// with trend arrows (▲ / ▼).
class TopSellersComparisonWidget extends StatelessWidget {
  final List<TopSellerComparisonData> topSellers;
  final String monthALabel;
  final String monthBLabel;

  const TopSellersComparisonWidget({
    super.key,
    required this.topSellers,
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
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const PhosphorIcon(PhosphorIconsBold.fire,
                        color: Color(0xFFF59E0B), size: 18),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        '1.4. ສິນຄ້າຂາຍດີທີ່ສຸດ (Top 5 Best Sellers Comparison)',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        'ປຽບທຽບຍອດຂາຍ ແລະ ຈຳນວນລະຫວ່າງ 2 ເດືອນ ພ້ອມລູກສອນທ່າອ່ຽງ',
                        style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ],
              ),
              Text(
                '$monthALabel vs $monthBLabel',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF64748B),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          if (topSellers.isEmpty)
            const Padding(
              padding: EdgeInsets.all(20),
              child: Center(
                child: Text('ຍັງບໍ່ມີຂໍ້ມູນການຂາຍ', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: topSellers.length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
              itemBuilder: (context, idx) {
                final item = topSellers[idx];
                final isUp = item.growth >= 0;

                final rankBg = idx == 0
                    ? const Color(0xFFF59E0B)
                    : (idx == 1 ? const Color(0xFF64748B) : const Color(0xFFB45309));

                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Rank + Name
                      Row(
                        children: [
                          Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              color: rankBg,
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '${idx + 1}',
                              style: const TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          SizedBox(
                            width: 170,
                            child: Text(
                              item.name,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF1E293B),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),

                      // Month A (Qty + Rev)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '$monthALabel: ${item.qtyA} ${item.unitName}',
                            style: const TextStyle(fontSize: 9.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                          ),
                          Text(
                            '${LaoCurrencyFormatter.formatNumber(item.revA)} ₭',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              fontFamily: 'monospace',
                              color: Color(0xFF475569),
                            ),
                          ),
                        ],
                      ),

                      // Month B (Qty + Rev)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '$monthBLabel: ${item.qtyB} ${item.unitName}',
                            style: const TextStyle(fontSize: 9.5, color: Color(0xFF0F766E), fontWeight: FontWeight.w800),
                          ),
                          Text(
                            '${LaoCurrencyFormatter.formatNumber(item.revB)} ₭',
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w900,
                              fontFamily: 'monospace',
                              color: Color(0xFF0F766E),
                            ),
                          ),
                        ],
                      ),

                      // Trend Badge
                      Container(
                        width: 82,
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3.5),
                        decoration: BoxDecoration(
                          color: isUp ? const Color(0xFFECFDF5) : const Color(0xFFFFF1F2),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isUp ? const Color(0xFFA7F3D0) : const Color(0xFFFECDD3),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            PhosphorIcon(
                              isUp ? PhosphorIconsBold.arrowUp : PhosphorIconsBold.arrowDown,
                              size: 11,
                              color: isUp ? const Color(0xFF059669) : const Color(0xFFE11D48),
                            ),
                            const SizedBox(width: 2),
                            Text(
                              '${item.growth.abs().toStringAsFixed(1)}%',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w900,
                                fontFamily: 'monospace',
                                color: isUp ? const Color(0xFF059669) : const Color(0xFFE11D48),
                              ),
                            ),
                          ],
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
}
