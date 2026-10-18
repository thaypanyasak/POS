import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/localization/lao_currency_formatter.dart';

/// Payment Breakdown Comparison (Cash, Transfer, Credit/Debt)
/// Side-by-side comparison between Month A and Month B with % growth badges.
class PaymentBreakdownComparisonWidget extends StatelessWidget {
  final int cashA;
  final int cashB;
  final double cashGrowth;

  final int transferA;
  final int transferB;
  final double transferGrowth;

  final int debtA;
  final int debtB;
  final double debtGrowth;

  final String monthALabel;
  final String monthBLabel;

  const PaymentBreakdownComparisonWidget({
    super.key,
    required this.cashA,
    required this.cashB,
    required this.cashGrowth,
    required this.transferA,
    required this.transferB,
    required this.transferGrowth,
    required this.debtA,
    required this.debtB,
    required this.debtGrowth,
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
                    child: const PhosphorIcon(PhosphorIconsBold.creditCard,
                        color: Color(0xFF0F766E), size: 18),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        '1.1. ຊ່ອງທາງການຊຳລະເງິນ (Payment Breakdown Comparison)',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        'ປຽບທຽບຍອດເງິນສົດ, ເງິນໂອນ ແລະ ຍອດຂາຍຕິດໜີ້ລະຫວ່າງ 2 ເດືອນ',
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

          // 3 Side-by-side / Wrapped Cards
          LayoutBuilder(
            builder: (context, constraints) {
              final isWide = constraints.maxWidth >= 700;
              final width = isWide ? (constraints.maxWidth - 20) / 3 : constraints.maxWidth;

              return Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  // Cash Card
                  _buildPaymentCard(
                    title: '1. ເງິນສົດ (Cash)',
                    amountA: cashA,
                    amountB: cashB,
                    growth: cashGrowth,
                    icon: PhosphorIconsBold.money,
                    iconColor: const Color(0xFF10B981),
                    iconBg: const Color(0xFFECFDF5),
                    titleColor: const Color(0xFF065F46),
                    width: width,
                  ),

                  // Transfer Card
                  _buildPaymentCard(
                    title: '2. ໂອນເງິນ (Transfer / OnePay)',
                    amountA: transferA,
                    amountB: transferB,
                    growth: transferGrowth,
                    icon: PhosphorIconsBold.qrCode,
                    iconColor: const Color(0xFF2563EB),
                    iconBg: const Color(0xFFEFF6FF),
                    titleColor: const Color(0xFF1E40AF),
                    width: width,
                  ),

                  // Debt Card
                  _buildPaymentCard(
                    title: '3. ຍອດຂາຍຕິດໜີ້ (Credit)',
                    amountA: debtA,
                    amountB: debtB,
                    growth: debtGrowth,
                    icon: PhosphorIconsBold.hourglass,
                    iconColor: const Color(0xFFD97706),
                    iconBg: const Color(0xFFFFFBEB),
                    titleColor: const Color(0xFF92400E),
                    width: width,
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentCard({
    required String title,
    required int amountA,
    required int amountB,
    required double growth,
    required IconData icon,
    required Color iconColor,
    required Color iconBg,
    required Color titleColor,
    required double width,
  }) {
    final isUp = growth >= 0;

    return Container(
      width: width,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Row: Title + Icon + Growth Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: iconBg,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: PhosphorIcon(icon, size: 16, color: iconColor),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: titleColor,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isUp ? const Color(0xFFECFDF5) : const Color(0xFFFFF1F2),
                  borderRadius: BorderRadius.circular(5),
                  border: Border.all(
                    color: isUp ? const Color(0xFFA7F3D0) : const Color(0xFFFECDD3),
                  ),
                ),
                child: Text(
                  '${isUp ? '▲ +' : '▼ '}${growth.toStringAsFixed(1)}%',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    fontFamily: 'monospace',
                    color: isUp ? const Color(0xFF059669) : const Color(0xFFE11D48),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Values Comparison
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    monthALabel,
                    style: const TextStyle(fontSize: 9.5, color: Color(0xFF64748B)),
                  ),
                  Text(
                    '${LaoCurrencyFormatter.formatNumber(amountA)} ₭',
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      fontFamily: 'monospace',
                      color: Color(0xFF475569),
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    monthBLabel,
                    style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF0F766E)),
                  ),
                  Text(
                    '${LaoCurrencyFormatter.formatNumber(amountB)} ₭',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      fontFamily: 'monospace',
                      color: Color(0xFF0F766E),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
