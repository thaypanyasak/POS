import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../core/localization/lo.dart';

/// Quick Cash Keypad & Preset Increment Buttons
class QuickCashKeypad extends StatelessWidget {
  final int totalDue;
  final int currentTendered;
  final ValueChanged<int> onTenderChanged;
  final VoidCallback onExactTender;

  const QuickCashKeypad({
    super.key,
    required this.totalDue,
    required this.currentTendered,
    required this.onTenderChanged,
    required this.onExactTender,
  });

  @override
  Widget build(BuildContext context) {
    final change = LaoCurrencyFormatter.calculateChange(currentTendered, totalDue);
    final isExact = currentTendered == totalDue;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Presets Grid
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            // Exact Tender Button ("ພໍດີ")
            SizedBox(
              height: 42,
              child: ElevatedButton(
                onPressed: onExactTender,
                style: ElevatedButton.styleFrom(
                  backgroundColor: isExact ? AppColors.surfaceDark : AppColors.surface,
                  foregroundColor: isExact ? Colors.white : AppColors.textPrimary,
                  elevation: isExact ? 2 : 0,
                  side: BorderSide(
                    color: isExact ? AppColors.surfaceDark : AppColors.border,
                    width: 0.9,
                  ),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                ),
                child: const Text(
                  LaoStrings.exactCash,
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
              ),
            ),

            // Increments: +10,000, +20,000, +50,000, +100,000, +500,000
            ...LaoCurrencyFormatter.quickCashPresets.map((preset) {
              return SizedBox(
                height: 42,
                child: OutlinedButton(
                  onPressed: () {
                    final next = (currentTendered == 0 ? totalDue : currentTendered) + preset;
                    onTenderChanged(next);
                  },
                  style: OutlinedButton.styleFrom(
                    backgroundColor: AppColors.surface,
                    foregroundColor: AppColors.textPrimary,
                    side: const BorderSide(color: AppColors.border, width: 0.9),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  child: Text(
                    LaoCurrencyFormatter.formatPreset(preset),
                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                  ),
                ),
              );
            }),
          ],
        ),

        const SizedBox(height: 12),

        // Tendered & Change display bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.surfaceSubtle,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.border, width: 0.9),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    LaoStrings.receivedAmount,
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textTertiary),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    LaoCurrencyFormatter.format(currentTendered),
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    LaoStrings.change,
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textTertiary),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    LaoCurrencyFormatter.format(change),
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.3,
                      color: change > 0 ? AppColors.primary : AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
