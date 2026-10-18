import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
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
    double tempRate = currentRate;
    bool isSaving = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            void setRateValue(double r) {
              setDialogState(() {
                tempRate = r;
                controller.text = r.round().toString();
              });
            }

            return AlertDialog(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
              contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 0),
              actionsPadding: const EdgeInsets.all(16),
              title: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFA7F3D0)),
                    ),
                    child: const PhosphorIcon(
                      PhosphorIconsBold.arrowsLeftRight,
                      color: Color(0xFF059669),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ປັບປຸງອັດຕາແລກປ່ຽນ (THB/LAK)',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Exchange Rate Setting & Snapshot',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 10),

                    // Current Rate Display Box
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'ອັດຕາແລກປ່ຽນປັດຈຸບັນ:',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF64748B),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            '1 ฿ = ${LaoCurrencyFormatter.formatDots(currentRate.round())} ₭',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              fontFamily: 'monospace',
                              color: Color(0xFF0F766E),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 14),

                    // Input Field
                    const Text(
                      'ກຳນົດອັດຕາແລກປ່ຽນໃໝ່ (1 THB = ? LAK):',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: controller,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      autofocus: true,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        fontFamily: 'monospace',
                        color: Color(0xFF0F172A),
                      ),
                      decoration: InputDecoration(
                        prefixIcon: const Padding(padding: EdgeInsets.only(left: 8, right: 4), child: PhosphorIcon(PhosphorIconsBold.pencilSimple, color: Color(0xFF0F766E), size: 18)),
                        suffixText: 'ກີບ (LAK)',
                        suffixStyle: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF64748B),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: Color(0xFF0F766E), width: 2),
                        ),
                      ),
                      onChanged: (val) {
                        final parsed = double.tryParse(val.replaceAll(',', '').trim());
                        if (parsed != null && parsed > 0) {
                          tempRate = parsed;
                        }
                      },
                    ),

                    const SizedBox(height: 10),

                    // Quick Step Buttons & Presets
                    Row(
                      children: [
                        OutlinedButton(
                          onPressed: () {
                            final current = double.tryParse(controller.text) ?? tempRate;
                            if (current > 5) setRateValue(current - 5);
                          },
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            minimumSize: const Size(40, 32),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
                          ),
                          child: const Text('-5 ₭', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                        const SizedBox(width: 6),
                        OutlinedButton(
                          onPressed: () {
                            final current = double.tryParse(controller.text) ?? tempRate;
                            setRateValue(current + 5);
                          },
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            minimumSize: const Size(40, 32),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
                          ),
                          child: const Text('+5 ₭', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [680.0, 685.0, 690.0, 695.0, 700.0].map((preset) {
                                return Padding(
                                  padding: const EdgeInsets.only(right: 4.0),
                                  child: ActionChip(
                                    label: Text(
                                      '${preset.round()}',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: (tempRate.round() == preset.round())
                                            ? Colors.white
                                            : const Color(0xFF334155),
                                      ),
                                    ),
                                    backgroundColor: (tempRate.round() == preset.round())
                                        ? const Color(0xFF0F766E)
                                        : const Color(0xFFF1F5F9),
                                    padding: EdgeInsets.zero,
                                    visualDensity: VisualDensity.compact,
                                    onPressed: () => setRateValue(preset),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 14),

                    // Accounting Rule Notice Banner (Point-in-Time Snapshot)
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF), // blue-50
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFBFDBFE)),
                      ),
                      child: const Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          PhosphorIcon(PhosphorIconsBold.info, size: 16, color: Color(0xFF2563EB)),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'ຫຼັກການບັນຊີ Snapshot: ການປ່ຽນອັດຕາແລກປ່ຽນມື້ນີ້ ຈະມີຜົນຕໍ່ບິນໃໝ່ນັບແຕ່ເວລານີ້. ບິນໃນອະດີດຈະຮັກສາອັດຕາແລກປ່ຽນ Snapshot ຂອງຕົນໄວ້ຢ່າງຖາວອນ ໂດຍບໍ່ຖືກຄຳນວນຄືນ.',
                              style: TextStyle(
                                fontSize: 10.5,
                                color: Color(0xFF1E40AF),
                                height: 1.35,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                AppButton(
                  label: 'ຍົກເລີກ',
                  variant: AppButtonVariant.ghost,
                  height: 38,
                  onPressed: isSaving ? null : () => Navigator.of(ctx).pop(),
                ),
                AppButton(
                  label: 'ບັນທຶກ (Save)',
                  variant: AppButtonVariant.primary,
                  height: 38,
                  icon: PhosphorIconsBold.floppyDisk,
                  isLoading: isSaving,
                  onPressed: isSaving
                      ? null
                      : () async {
                          final val = double.tryParse(controller.text.replaceAll(',', '').trim());
                          if (val == null || val <= 0) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('ກະລຸນາປ້ອນອັດຕາແລກປ່ຽນທີ່ຖືກຕ້ອງ (> 0)'),
                                backgroundColor: AppColors.error,
                              ),
                            );
                            return;
                          }

                          setDialogState(() => isSaving = true);

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
                                  backgroundColor: const Color(0xFF059669),
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
                        },
                ),
              ],
            );
          },
        );
      },
    );
  }
}
