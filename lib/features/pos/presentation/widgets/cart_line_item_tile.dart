import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../domain/models/cart_item.dart';
import '../../../../domain/models/product_unit.dart';
import 'price_override_dialog.dart';

/// Ultra-Minimal Compact Line Item Tile for POS Cart Dock
/// - 2 sleek rows instead of 3 bulky rows
/// - Over 50% more compact vertical profile
/// - Minimalist aesthetic with subtle borders and smooth tactile buttons
class CartLineItemTile extends StatelessWidget {
  final CartItem item;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onRemove;
  final ValueChanged<ProductUnit> onSwitchUnit;
  final Function(int newPrice, String reason) onPriceOverride;
  final VoidCallback onResetPriceOverride;

  const CartLineItemTile({
    super.key,
    required this.item,
    required this.onIncrement,
    required this.onDecrement,
    required this.onRemove,
    required this.onSwitchUnit,
    required this.onPriceOverride,
    required this.onResetPriceOverride,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: item.isPriceOverridden
              ? AppColors.wholesale.withValues(alpha: 0.6)
              : AppColors.border,
          width: item.isPriceOverridden ? 1.2 : 0.9,
        ),
        boxShadow: AppColors.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Row 1: Product Name & Line Total
          Row(
            children: [
              Expanded(
                child: Text(
                  item.product.name,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                LaoCurrencyFormatter.format(item.lineTotal),
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: item.isWholesaleMode
                      ? AppColors.wholesaleDark
                      : AppColors.primaryDark,
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),

          const SizedBox(height: 6),

          // Row 2: Unit Switcher + Unit Price (Left) & Stepper + Delete (Right)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Left: Unit Dropdown Pill + Price Override Pill
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Unit Dropdown Pill
                  Container(
                    height: 25,
                    padding: const EdgeInsets.symmetric(horizontal: 7),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceSubtle,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppColors.border, width: 0.8),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: item.selectedUnit.id,
                        isDense: true,
                        icon: const Icon(Icons.arrow_drop_down, size: 15),
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                        items: item.product.units.map((unit) {
                          return DropdownMenuItem<String>(
                            value: unit.id,
                            child: Text(unit.unitName),
                          );
                        }).toList(),
                        onChanged: (unitId) {
                          if (unitId != null) {
                            final found = item.product.units
                                .firstWhere((u) => u.id == unitId);
                            onSwitchUnit(found);
                          }
                        },
                      ),
                    ),
                  ),

                  const SizedBox(width: 5),

                  // Unit Price Tag with Price Override Dialog trigger
                  InkWell(
                    onTap: () {
                      showDialog(
                        context: context,
                        builder: (ctx) => PriceOverrideDialog(
                          item: item,
                          onApplyOverride: onPriceOverride,
                          onResetOverride: onResetPriceOverride,
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(6),
                    child: Container(
                      height: 25,
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: item.isPriceOverridden
                            ? AppColors.wholesaleLight
                            : AppColors.surfaceSubtle,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: item.isPriceOverridden
                              ? AppColors.wholesale
                              : AppColors.borderSubtle,
                          width: 0.8,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '@ ${LaoCurrencyFormatter.format(item.effectiveUnitPrice)}',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: item.isPriceOverridden
                                  ? AppColors.wholesaleDark
                                  : AppColors.textSecondary,
                            ),
                          ),
                          if (item.isPriceOverridden) ...[
                            const SizedBox(width: 3),
                            const Icon(
                              Icons.edit_rounded,
                              size: 11,
                              color: AppColors.wholesaleDark,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),

              // Right: Stepper [- QTY +] and Delete Button
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Tactile Minimal Stepper
                  Container(
                    height: 26,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceSubtle,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppColors.border, width: 0.8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        InkWell(
                          onTap: onDecrement,
                          borderRadius: const BorderRadius.horizontal(left: Radius.circular(6)),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 6),
                            child: Icon(Icons.remove, size: 13, color: AppColors.textSecondary),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          child: Text(
                            '${item.quantity}',
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        InkWell(
                          onTap: onIncrement,
                          borderRadius: const BorderRadius.horizontal(right: Radius.circular(6)),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 6),
                            child: Icon(Icons.add, size: 13, color: AppColors.primary),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(width: 6),

                  // Remove [x] button
                  InkWell(
                    onTap: onRemove,
                    borderRadius: BorderRadius.circular(6),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceSubtle,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Icon(Icons.close_rounded, size: 14, color: AppColors.textTertiary),
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
