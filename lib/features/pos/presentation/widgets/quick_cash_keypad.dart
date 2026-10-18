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
    final screenSize = MediaQuery.of(context).size;
    final isCompact = screenSize.height < 500;

    final btnHeight = isCompact ? 32.0 : 42.0;
    final btnFontSize = isCompact ? 11.5 : 12.5;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Tendered & Change display bar
        Container(
          padding: EdgeInsets.symmetric(
            horizontal: isCompact ? 12 : 16,
            vertical: isCompact ? 6 : 10,
          ),
          decoration: BoxDecoration(
            color: AppColors.surfaceSubtle,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.border, width: 0.9),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    LaoStrings.receivedAmount,
                    style: TextStyle(
                      fontSize: isCompact ? 10 : 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textTertiary,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    LaoCurrencyFormatter.format(currentTendered),
                    style: TextStyle(
                      fontSize: isCompact ? 15 : 17,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    LaoStrings.change,
                    style: TextStyle(
                      fontSize: isCompact ? 10 : 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textTertiary,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    LaoCurrencyFormatter.format(change),
                    style: TextStyle(
                      fontSize: isCompact ? 16 : 20,
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

        SizedBox(height: isCompact ? 6 : 10),

        // Presets Grid
        Wrap(
          spacing: isCompact ? 6 : 8,
          runSpacing: isCompact ? 6 : 8,
          children: [
            // Exact Tender Button ("ພໍດີ")
            SizedBox(
              height: btnHeight,
              child: Material(
                color: isExact ? AppColors.surfaceDark : AppColors.surface,
                borderRadius: BorderRadius.circular(7),
                child: InkWell(
                  onTap: onExactTender,
                  borderRadius: BorderRadius.circular(7),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(7),
                      border: Border.all(
                        color: isExact ? AppColors.surfaceDark : AppColors.border,
                        width: 0.9,
                      ),
                    ),
                    padding: EdgeInsets.symmetric(horizontal: isCompact ? 10 : 16),
                    alignment: Alignment.center,
                    child: Text(
                      LaoStrings.exactCash,
                      style: TextStyle(
                        fontSize: btnFontSize,
                        fontWeight: FontWeight.w700,
                        color: isExact ? Colors.white : AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),
              ),
            ),

            // Increments: +10,000, +20,000, +50,000, +100,000, +500,000
            ...LaoCurrencyFormatter.quickCashPresets.map((preset) {
              return SizedBox(
                height: btnHeight,
                child: OutlinedButton(
                  onPressed: () {
                    final next = (currentTendered == 0 ? totalDue : currentTendered) + preset;
                    onTenderChanged(next);
                  },
                  style: OutlinedButton.styleFrom(
                    backgroundColor: AppColors.surface,
                    foregroundColor: AppColors.textPrimary,
                    side: const BorderSide(color: AppColors.border, width: 0.9),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
                    padding: EdgeInsets.symmetric(horizontal: isCompact ? 8 : 12),
                  ),
                  child: Text(
                    LaoCurrencyFormatter.formatPreset(preset),
                    style: TextStyle(fontSize: btnFontSize, fontWeight: FontWeight.w700),
                  ),
                ),
              );
            }),
          ],
        ),
      ],
    );
  }
}
