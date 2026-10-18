import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../providers/exchange_rate_provider.dart';

/// Interactive Point-in-Time Exchange Rate Chip / Badge
/// Displays the live store exchange rate (1 ฿ = X ₭)
/// Allows store managers to tap and update the rate in Supabase store_settings.
class ExchangeRateChip extends ConsumerWidget {
  final bool compact;
  final VoidCallback? onRateUpdated;

  const ExchangeRateChip({
    super.key,
    this.compact = false,
    this.onRateUpdated,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rateState = ref.watch(exchangeRateProvider);
    final rateDisplay = rateState.rate.round().toString();

    return Tooltip(
      message: 'ອັດຕາແລກປ່ຽນ 1 ฿ = $rateDisplay ₭ (ແຕະເພື່ອປັບປຸງ)',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _showEditRateDialog(context, ref, rateState.rate),
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: compact ? 8 : 10,
              vertical: compact ? 4 : 6,
            ),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4), // emerald-50
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: const Color(0xFF86EFAC), // emerald-300
                width: 1.0,
              ),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x08059669),
                  blurRadius: 4,
                  offset: Offset(0, 1),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (rateState.isLoading)
                  const SizedBox(
                    width: 12,
                    height: 12,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Color(0xFF059669),
                    ),
                  )
                else
                  const PhosphorIcon(
                    PhosphorIconsBold.arrowsLeftRight,
                    size: 14,
                    color: Color(0xFF059669),
                  ),
                const SizedBox(width: 5),
                Text(
                  '1 ฿ = ',
                  style: TextStyle(
                    fontSize: compact ? 11 : 12,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF166534),
                  ),
                ),
                Text(
                  '$rateDisplay ₭',
                  style: TextStyle(
                    fontSize: compact ? 11.5 : 12.5,
                    fontWeight: FontWeight.w900,
                    fontFamily: 'monospace',
                    color: const Color(0xFF15803D),
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showEditRateDialog(BuildContext context, WidgetRef ref, double currentRate) {
    final controller = TextEditingController(text: currentRate.round().toString());
    bool isSaving = false;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            String? errorMsg;

            Future<void> handleSave() async {
              final clean = controller.text.replaceAll(',', '').trim();
              final val = double.tryParse(clean);
              if (val == null || val <= 0) {
                setDialogState(() {
                  errorMsg = 'ກະລຸນາປ້ອນອັດຕາແລກປ່ຽນທີ່ຖືກຕ້ອງ (> 0)';
                });
                return;
              }

              setDialogState(() {
                isSaving = true;
                errorMsg = null;
              });

              final success = await ref
                  .read(exchangeRateProvider.notifier)
                  .updateExchangeRate(val);

              if (context.mounted) {
                Navigator.of(ctx).pop();
                if (success) {
                  onRateUpdated?.call();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        'ອັບເດດອັດຕາແລກປ່ຽນເປັນ 1 ฿ = ${val.round()} ₭ ສຳເລັດ!',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      backgroundColor: const Color(0xFF0F766E),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('ເກີດຂໍ້ຜິດພາດໃນການອັບເດດອັດຕາແລກປ່ຽນ'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
              }
            }

            return Dialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
                side: const BorderSide(color: Color(0xFFF1F5F9)),
              ),
              clipBehavior: Clip.antiAlias,
              insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 380),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Header (Icon + Title + Close Button)
                      Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0FDFA), // teal-50
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFCCFBF1)), // teal-100
                            ),
                            child: const Center(
                              child: PhosphorIcon(
                                PhosphorIconsBold.currencyCircleDollar,
                                color: Color(0xFF0F766E), // teal-700
                                size: 20,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: const [
                                Text(
                                  'ປັບອັດຕາແລກປ່ຽນ (THB / LAK)',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF0F172A),
                                    letterSpacing: -0.2,
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'Store Settings • Point-in-time Snapshot',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: () => Navigator.of(ctx).pop(),
                            icon: const PhosphorIcon(PhosphorIconsBold.x, size: 18, color: Color(0xFF94A3B8)),
                            style: IconButton.styleFrom(
                              minimumSize: const Size(32, 32),
                              padding: EdgeInsets.zero,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            tooltip: 'ປິດ',
                          ),
                        ],
                      ),

                      const SizedBox(height: 14),

                      // Accounting Principle Notice Banner (yellow / amber rounded-xl)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFFBEB), // amber-50
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFFDE68A)), // amber-200
                        ),
                        child: RichText(
                          text: const TextSpan(
                            style: TextStyle(
                              fontSize: 11,
                              color: Color(0xFF78350F), // amber-900
                              height: 1.45,
                              fontFamily: 'NotoSansLao',
                            ),
                            children: [
                              TextSpan(text: '💡 '),
                              TextSpan(
                                text: 'ຫຼັກການບັນຊີ: ',
                                style: TextStyle(fontWeight: FontWeight.bold),
                              ),
                              TextSpan(
                                text: 'ການປ່ຽນອັດຕາແລກປ່ຽນມື້ນີ້ຈະຖືກບັນທຶກເຂົ້າໃນບິນໃໝ່. ບິນຂາຍໃນອະດີດຈະຮັກສາອັດຕາແລກປ່ຽນ Snapshot ຂອງມື້ຂາຍ, ບໍ່ມີການຄິດໄລ່ຄືນ.',
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 14),

                      // Input Label
                      const Text(
                        '1 ฿ (Baht) = ເທົ່າໃດກີບ?',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF334155),
                        ),
                      ),
                      const SizedBox(height: 6),

                      // Input Field with ₭ (LAK) suffix
                      Container(
                        height: 44,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: Row(
                          children: [
                            const SizedBox(width: 14),
                            Expanded(
                              child: TextField(
                                controller: controller,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                autofocus: true,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                  fontFamily: 'monospace',
                                  color: Color(0xFF0F172A),
                                  fontFeatures: [FontFeature.tabularFigures()],
                                ),
                                decoration: const InputDecoration(
                                  hintText: '0',
                                  border: InputBorder.none,
                                  isDense: true,
                                  contentPadding: EdgeInsets.zero,
                                ),
                                onSubmitted: (_) => handleSave(),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.only(right: 12),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: const [
                                  PhosphorIcon(
                                    PhosphorIconsBold.arrowsDownUp,
                                    size: 14,
                                    color: Color(0xFF64748B),
                                  ),
                                  SizedBox(width: 4),
                                  Text(
                                    '₭ (LAK)',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      if (errorMsg != null) ...[
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF1F2),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFFECDD3)),
                          ),
                          child: Text(
                            errorMsg!,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFE11D48),
                            ),
                          ),
                        ),
                      ],

                      const SizedBox(height: 18),

                      // Action Buttons (ຍົກເລີກ / ບັນທຶກ)
                      Row(
                        children: [
                          Expanded(
                            child: SizedBox(
                              height: 42,
                              child: TextButton(
                                onPressed: isSaving ? null : () => Navigator.of(ctx).pop(),
                                style: TextButton.styleFrom(
                                  backgroundColor: const Color(0xFFF1F5F9), // slate-100
                                  foregroundColor: const Color(0xFF334155), // slate-700
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                                child: const Text(
                                  'ຍົກເລີກ',
                                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: SizedBox(
                              height: 42,
                              child: ElevatedButton.icon(
                                onPressed: isSaving ? null : handleSave,
                                icon: isSaving
                                    ? const SizedBox(
                                        width: 14,
                                        height: 14,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      )
                                    : const PhosphorIcon(
                                        PhosphorIconsBold.check,
                                        size: 16,
                                        color: Colors.white,
                                      ),
                                label: const Text(
                                  'ບັນທຶກ',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF0D9488), // teal-600
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}
