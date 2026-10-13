import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../core/localization/lo.dart';
import '../../../../domain/models/cart_item.dart';

/// Tactile Numeric Keypad Modal for On-The-Fly Price Override
class PriceOverrideDialog extends StatefulWidget {
  final CartItem item;
  final Function(int newPrice, String reason) onApplyOverride;
  final VoidCallback onResetOverride;

  const PriceOverrideDialog({
    super.key,
    required this.item,
    required this.onApplyOverride,
    required this.onResetOverride,
  });

  @override
  State<PriceOverrideDialog> createState() => _PriceOverrideDialogState();
}

class _PriceOverrideDialogState extends State<PriceOverrideDialog> {
  late String _currentPriceString;
  String _selectedReason = 'ລູກຄ້າປະຈຳ';

  final List<String> _commonReasons = [
    'ລູກຄ້າປະຈຳ',
    'ຊື້ຫຼາຍ/ຍົກແພັກ',
    'ສິນຄ້າໃກ້ໝົດອາຍຸ',
    'ເຈົ້າຂອງຮ້ານຫຼຸດໃຫ້',
  ];

  @override
  void initState() {
    super.initState();
    _currentPriceString = widget.item.effectiveUnitPrice.toString();
  }

  void _onKeyPress(String val) {
    setState(() {
      if (_currentPriceString == '0') {
        _currentPriceString = val;
      } else {
        _currentPriceString += val;
      }
    });
  }

  void _onBackspace() {
    setState(() {
      if (_currentPriceString.length <= 1) {
        _currentPriceString = '0';
      } else {
        _currentPriceString =
            _currentPriceString.substring(0, _currentPriceString.length - 1);
      }
    });
  }

  void _onClear() {
    setState(() {
      _currentPriceString = '0';
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final int newPrice = int.tryParse(_currentPriceString) ?? 0;
    final int originalPrice = widget.item.originalUnitPrice;
    final int discount = originalPrice - newPrice;

    return Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.borderSubtle, width: 0.9),
      ),
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 6,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: AppColors.backgroundAlt,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.borderSubtle, width: 0.9),
                    ),
                    child: const Icon(
                      Icons.edit_note_rounded,
                      size: 20,
                      color: AppColors.surfaceDark,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          LaoStrings.overridePrice,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: AppColors.surfaceDark,
                          ),
                        ),
                        Text(
                          '${widget.item.product.name} (${widget.item.selectedUnit.unitName})',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded, size: 20, color: AppColors.textMuted),
                    splashRadius: 20,
                  ),
                ],
              ),

              const SizedBox(height: 18),

              // Price Comparison Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.backgroundAlt,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.borderSubtle, width: 0.9),
                  boxShadow: AppColors.cardShadow,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          LaoStrings.originalPrice,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: AppColors.textMuted,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          LaoCurrencyFormatter.format(originalPrice),
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.lineThrough,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          LaoStrings.discountAmount,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: discount > 0 ? AppColors.error : AppColors.textMuted,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: discount > 0
                                ? AppColors.error.withValues(alpha: 0.1)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            discount > 0
                                ? '-${LaoCurrencyFormatter.format(discount)}'
                                : '0 ₭',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: discount > 0 ? AppColors.error : AppColors.textMuted,
                            ),
                          ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          LaoStrings.customPrice,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: AppColors.surfaceDark,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          LaoCurrencyFormatter.format(newPrice),
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: AppColors.surfaceDark,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Reason Chips
              Text(
                'ເຫດຜົນການປັບລາຄາ:',
                style: theme.textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                  letterSpacing: 0.3,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _commonReasons.map((reason) {
                  final isSelected = reason == _selectedReason;
                  return InkWell(
                    onTap: () => setState(() => _selectedReason = reason),
                    borderRadius: BorderRadius.circular(8),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.surfaceDark : AppColors.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isSelected ? AppColors.surfaceDark : AppColors.borderSubtle,
                          width: 0.9,
                        ),
                        boxShadow: isSelected ? AppColors.cardShadow : null,
                      ),
                      child: Text(
                        reason,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          color: isSelected ? Colors.white : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),

              const SizedBox(height: 18),

              // Tactile Numeric Keypad
              _buildKeypad(),

              const SizedBox(height: 18),

              // Action Buttons
              Row(
                children: [
                  if (widget.item.isPriceOverridden) ...[
                    OutlinedButton(
                      onPressed: () {
                        widget.onResetOverride();
                        Navigator.of(context).pop();
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textSecondary,
                        side: const BorderSide(color: AppColors.borderSubtle, width: 0.9),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('ລາຄາເດີມ', style: TextStyle(fontWeight: FontWeight.w600)),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        widget.onApplyOverride(newPrice, _selectedReason);
                        Navigator.of(context).pop();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.surfaceDark,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: Text(
                        'ນຳໃຊ້ລາຄາ: ${LaoCurrencyFormatter.format(newPrice)}',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
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
  }

  Widget _buildKeypad() {
    return Column(
      children: [
        _buildKeyRow(['1', '2', '3']),
        const SizedBox(height: 8),
        _buildKeyRow(['4', '5', '6']),
        const SizedBox(height: 8),
        _buildKeyRow(['7', '8', '9']),
        const SizedBox(height: 8),
        _buildKeyRow(['C', '0', '000', 'DEL']),
      ],
    );
  }

  Widget _buildKeyRow(List<String> keys) {
    return Row(
      children: keys.map((key) {
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4.0),
            child: SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: () {
                  if (key == 'DEL') {
                    _onBackspace();
                  } else if (key == 'C') {
                    _onClear();
                  } else {
                    _onKeyPress(key);
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: key == 'DEL' || key == 'C'
                      ? AppColors.surfaceSubtle
                      : AppColors.surface,
                  foregroundColor: key == 'DEL' || key == 'C'
                      ? AppColors.error
                      : AppColors.textPrimary,
                  elevation: 0,
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: key == 'DEL'
                    ? const Icon(Icons.backspace_outlined, size: 20)
                    : Text(
                        key,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
