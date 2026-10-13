import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../core/localization/lo.dart';
import '../../../../domain/models/product.dart';
import '../../../../domain/models/product_unit.dart';

/// Modal to select packaging unit and quantity before adding to cart
class UnitSelectorModal extends StatefulWidget {
  final Product product;
  final bool isWholesaleMode;
  final Function(ProductUnit unit, int quantity) onConfirm;

  const UnitSelectorModal({
    super.key,
    required this.product,
    required this.isWholesaleMode,
    required this.onConfirm,
  });

  @override
  State<UnitSelectorModal> createState() => _UnitSelectorModalState();
}

class _UnitSelectorModalState extends State<UnitSelectorModal> {
  late ProductUnit _selectedUnit;
  int _quantity = 1;

  @override
  void initState() {
    super.initState();
    _selectedUnit = widget.product.defaultBaseUnit;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final unitPrice = _selectedUnit.priceForMode(isWholesale: widget.isWholesaleMode);
    final totalAmount = unitPrice * _quantity;
    final totalCost = _selectedUnit.costForUnit(widget.product.costPerBaseUnit) * _quantity;
    final totalProfit = totalAmount - totalCost;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 540),
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.product.name,
                          style: theme.textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'ສາງຄົງເຫຼືອ: ${widget.product.compoundStockFormatted}',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close, color: AppColors.textMuted),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Unit Selector Options Grid
              Text(
                'ເລືອກຫົວໜ່ວຍບັນຈຸ:',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 10),

              Column(
                children: widget.product.units.map((unit) {
                  final isSelected = unit.id == _selectedUnit.id;
                  final price = unit.priceForMode(isWholesale: widget.isWholesaleMode);
                  final unitCost = unit.costForUnit(widget.product.costPerBaseUnit);
                  final unitProfit = price - unitCost;

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8.0),
                    child: InkWell(
                      onTap: () => setState(() => _selectedUnit = unit),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? (widget.isWholesaleMode
                                  ? AppColors.wholesaleLight.withValues(alpha: 0.5)
                                  : AppColors.primaryLight.withValues(alpha: 0.5))
                              : AppColors.surfaceSubtle,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isSelected
                                ? (widget.isWholesaleMode
                                    ? AppColors.wholesale
                                    : AppColors.primary)
                                : AppColors.border,
                            width: isSelected ? 2.0 : 1.0,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              isSelected
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_off,
                              color: isSelected
                                  ? (widget.isWholesaleMode
                                      ? AppColors.wholesale
                                      : AppColors.primary)
                                  : AppColors.textMuted,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        unit.unitName,
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                      if (unit.multiplier > 1) ...[
                                        const SizedBox(width: 6),
                                        Text(
                                          '(1 ${unit.unitName} = ${unit.multiplier} ${widget.product.baseUnit})',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: AppColors.textSecondary,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Row(
                                    children: [
                                      Text(
                                        'ຕົ້ນທຶນ: ${LaoCurrencyFormatter.format(unitCost)} • ',
                                        style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                      ),
                                      Text(
                                        unitProfit > 0
                                            ? 'ກຳໄລ: +${LaoCurrencyFormatter.format(unitProfit)}'
                                            : (unitProfit < 0
                                                ? 'ຂາດທຶນ: -${LaoCurrencyFormatter.format(unitProfit.abs())}'
                                                : 'ເທົ່າທຶນ: 0 ₭'),
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: unitProfit > 0
                                              ? AppColors.primaryDark
                                              : (unitProfit < 0 ? AppColors.error : AppColors.textMuted),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              LaoCurrencyFormatter.format(price),
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                                color: widget.isWholesaleMode
                                    ? AppColors.wholesaleDark
                                    : AppColors.primaryDark,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),

              const SizedBox(height: 16),

              // Quantity Stepper
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    LaoStrings.quantity,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          onPressed: _quantity > 1
                              ? () => setState(() => _quantity--)
                              : null,
                          icon: const Icon(Icons.remove),
                          iconSize: 20,
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text(
                            '$_quantity',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: () => setState(() => _quantity++),
                          icon: const Icon(Icons.add),
                          iconSize: 20,
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),
              const Divider(color: AppColors.border, height: 1),
              const SizedBox(height: 16),

              // Total & Profit preview
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'ຍອດລວມ:',
                        style: theme.textTheme.bodySmall,
                      ),
                      Text(
                        LaoCurrencyFormatter.format(totalAmount),
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: widget.isWholesaleMode
                              ? AppColors.wholesale
                              : AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'ກຳໄລຄາດຄະເນ:',
                        style: theme.textTheme.bodySmall,
                      ),
                      Text(
                        totalProfit > 0
                            ? '+${LaoCurrencyFormatter.format(totalProfit)}'
                            : (totalProfit < 0
                                ? '-${LaoCurrencyFormatter.format(totalProfit.abs())}'
                                : '0 ₭'),
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: totalProfit > 0
                              ? AppColors.primaryDark
                              : (totalProfit < 0 ? AppColors.error : AppColors.textMuted),
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Confirm Button
              ElevatedButton(
                onPressed: () {
                  widget.onConfirm(_selectedUnit, _quantity);
                  Navigator.of(context).pop();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: widget.isWholesaleMode
                      ? AppColors.wholesale
                      : AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: Text(
                  'ເພີ່ມເຂົ້າກະຕ່າ ($_quantity ${_selectedUnit.unitName})',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
