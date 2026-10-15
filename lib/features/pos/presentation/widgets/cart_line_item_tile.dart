import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../core/utils/image_compress_service.dart';
import '../../../../domain/models/cart_item.dart';
import '../../../../domain/models/product_unit.dart';
import 'price_override_dialog.dart';

/// Ultra-Clean Line Item Tile for POS Cart Dock (Styled exactly like Web App)
/// - Product Thumbnail (36x36 rounded-lg) on the left
/// - Product Name + Red Trash button on top
/// - Dynamic Unit Switcher Pills (selected: teal-700, unselected: slate-100)
/// - Inline price tag with edit pencil (@ 70.000)
/// - Tactile Stepper [- QTY +] and total amount in mono font
class CartLineItemTile extends StatelessWidget {
  final CartItem item;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onRemove;
  final ValueChanged<ProductUnit> onSwitchUnit;
  final Function(int newPrice, String reason) onPriceOverride;
  final VoidCallback onResetPriceOverride;
  final ValueChanged<int>? onSetQuantity;
  final ValueChanged<bool>? onToggleCrateDeposit;
  final ValueChanged<int>? onUpdateMissingCrates;

  const CartLineItemTile({
    super.key,
    required this.item,
    required this.onIncrement,
    required this.onDecrement,
    required this.onRemove,
    required this.onSwitchUnit,
    required this.onPriceOverride,
    required this.onResetPriceOverride,
    this.onSetQuantity,
    this.onToggleCrateDeposit,
    this.onUpdateMissingCrates,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final availableWidth = constraints.maxWidth;
        final isNarrow = availableWidth < 290;
        final thumbSize = isNarrow ? 44.0 : 48.0;

        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
          padding: EdgeInsets.all(isNarrow ? 6 : 8),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: item.isPriceOverridden
                  ? const Color(0xFFFCD34D) // amber-300
                  : const Color(0xFFE2E8F0), // slate-200
              width: item.isPriceOverridden ? 1.2 : 0.8,
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x06000000),
                blurRadius: 3,
                offset: Offset(0, 1),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              // MAIN BODY: Left Thumbnail + Right (Row 1: Title & Trash, Row 2: Controls & Total)
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // 1. Hình ảnh sản phẩm nằm bên trái
                  Container(
                    width: thumbSize,
                    height: thumbSize,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(7),
                      border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: _buildThumbnail(),
                  ),

                  const SizedBox(width: 8),

                  // 2. Nội dung 2 hàng
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Hàng 1 (Row 1): Tên sản phẩm + Thùng rác xóa món
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Expanded(
                              child: Text(
                                item.product.name,
                                style: TextStyle(
                                  fontSize: isNarrow ? 11.5 : 12.0,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                  letterSpacing: -0.2,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 4),
                            InkWell(
                              onTap: onRemove,
                              borderRadius: BorderRadius.circular(4),
                              child: const Padding(
                                padding: EdgeInsets.all(2.0),
                                child: Icon(
                                  Icons.delete_outline_rounded,
                                  size: 16,
                                  color: AppColors.textTertiary,
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 5),

                        // Hàng 2 (Row 2): [Đơn vị ▾] + [Đơn giá ✎] + [- 1 +] + [Thành tiền]
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            // Nút chọn đơn vị dạng Dropdown Pill [ ແພັກ ▾ ]
                            if (item.product.units.length > 1)
                              PopupMenuButton<ProductUnit>(
                                initialValue: item.selectedUnit,
                                tooltip: 'ປ່ຽນຫົວໜ່ວຍ',
                                onSelected: onSwitchUnit,
                                color: Colors.white,
                                elevation: 3,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  side: const BorderSide(color: Color(0xFFE2E8F0)),
                                ),
                                itemBuilder: (context) => item.product.units.map((u) {
                                  final isSelected = u.id == item.selectedUnit.id;
                                  return PopupMenuItem<ProductUnit>(
                                    value: u,
                                    height: 34,
                                    child: Row(
                                      children: [
                                        Text(
                                          u.unitName,
                                          style: TextStyle(
                                            fontSize: 11.5,
                                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                                            color: isSelected ? const Color(0xFF0F766E) : AppColors.textPrimary,
                                          ),
                                        ),
                                        const Spacer(),
                                        Text(
                                          LaoCurrencyFormatter.format(u.priceForMode(isWholesale: item.isWholesaleMode)),
                                          style: TextStyle(
                                            fontSize: 10.5,
                                            color: isSelected ? const Color(0xFF0F766E) : AppColors.textSecondary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                }).toList(),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF0FDFA), // teal-50
                                    borderRadius: BorderRadius.circular(5),
                                    border: Border.all(color: const Color(0xFF99F6E4), width: 0.8), // teal-200
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        item.selectedUnit.unitName,
                                        style: TextStyle(
                                          fontSize: isNarrow ? 8.5 : 9.0,
                                          fontWeight: FontWeight.w700,
                                          color: const Color(0xFF0F766E), // teal-700
                                        ),
                                      ),
                                      const SizedBox(width: 1),
                                      const Icon(
                                        Icons.arrow_drop_down_rounded,
                                        size: 13,
                                        color: Color(0xFF0F766E),
                                      ),
                                    ],
                                  ),
                                ),
                              )
                            else
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9), // slate-100
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  item.selectedUnit.unitName,
                                  style: TextStyle(
                                    fontSize: isNarrow ? 8.5 : 9.0,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ),

                            const SizedBox(width: 3),

                            // Đơn giá kèm icon cây bút
                            Expanded(
                              child: InkWell(
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
                                borderRadius: BorderRadius.circular(4),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 1),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Flexible(
                                        child: Text(
                                          '@${LaoCurrencyFormatter.formatDots(item.effectiveUnitPrice)}',
                                          style: TextStyle(
                                            fontSize: isNarrow ? 9.5 : 10.0,
                                            fontWeight: FontWeight.w700,
                                            color: item.isPriceOverridden
                                                ? const Color(0xFFB45309) // amber-700
                                                : const Color(0xFF0F766E), // teal-700
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      const SizedBox(width: 1),
                                      Icon(
                                        Icons.edit_rounded,
                                        size: 8.5,
                                        color: item.isPriceOverridden
                                            ? const Color(0xFFB45309)
                                            : const Color(0xFF94A3B8),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),

                            const SizedBox(width: 4),

                            // Bộ tăng giảm số lượng mini - 1 +
                            Container(
                              height: 22,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9), // slate-100
                                borderRadius: BorderRadius.circular(5),
                                border: Border.all(color: const Color(0xFFE2E8F0), width: 0.7),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  InkWell(
                                    onTap: onDecrement,
                                    borderRadius: const BorderRadius.horizontal(left: Radius.circular(4)),
                                    child: const SizedBox(
                                      width: 19,
                                      height: 22,
                                      child: Icon(Icons.remove, size: 10, color: AppColors.textSecondary),
                                    ),
                                  ),
                                  InkWell(
                                    onTap: () {
                                      if (onSetQuantity != null) {
                                        _showQuantityNumpad(context);
                                      }
                                    },
                                    child: Container(
                                      constraints: const BoxConstraints(minWidth: 16),
                                      alignment: Alignment.center,
                                      padding: const EdgeInsets.symmetric(horizontal: 1),
                                      child: Text(
                                        '${item.quantity}',
                                        style: TextStyle(
                                          fontSize: isNarrow ? 10 : 10.5,
                                          fontWeight: FontWeight.w800,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                    ),
                                  ),
                                  InkWell(
                                    onTap: onIncrement,
                                    borderRadius: const BorderRadius.horizontal(right: Radius.circular(4)),
                                    child: const SizedBox(
                                      width: 19,
                                      height: 22,
                                      child: Icon(Icons.add, size: 10, color: Color(0xFF0F766E)),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            const SizedBox(width: 5),

                            // Thành tiền in đậm nổi bật ở góc phải
                            Text(
                              LaoCurrencyFormatter.format(item.lineTotal),
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                fontSize: isNarrow ? 10.5 : 11.5,
                                fontWeight: FontWeight.w900,
                                color: item.isWholesaleMode
                                    ? AppColors.wholesaleDark
                                    : const Color(0xFF0F172A), // slate-900
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),

          // 4. Hàng phụ Cọc Két (Crate Deposit): Thụt lề và chỉ hiển thị bên dưới khi sản phẩm có cọc vỏ kết
          if (item.isCrateEligible) ...[
            const SizedBox(height: 6),
            Padding(
              padding: const EdgeInsets.only(left: 61), // Thụt lề bằng đúng chiều rộng thumbnail (52 + 9)
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3.5),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB), // amber-50
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFFFDE68A), width: 0.8), // amber-200
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    InkWell(
                      onTap: () {
                        if (onToggleCrateDeposit != null) {
                          onToggleCrateDeposit!(!item.noEmptyCrates);
                        }
                      },
                      borderRadius: BorderRadius.circular(4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            width: 16,
                            height: 16,
                            child: Checkbox(
                              value: item.noEmptyCrates,
                              onChanged: (val) {
                                if (onToggleCrateDeposit != null && val != null) {
                                  onToggleCrateDeposit!(val);
                                }
                              },
                              activeColor: const Color(0xFFD97706), // amber-600
                              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'ບໍ່ມີແກັດປ່ຽນ (+${LaoCurrencyFormatter.format(item.feePerCrate, includeSymbol: false)} ₭)',
                            style: const TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF78350F), // amber-950
                            ),
                          ),
                        ],
                      ),
                    ),

                    if (item.noEmptyCrates)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            height: 20,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: const Color(0xFFFCD34D), width: 0.8), // amber-300
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                InkWell(
                                  onTap: item.effectiveMissingCratesCount <= 1
                                      ? null
                                      : () {
                                          if (onUpdateMissingCrates != null) {
                                            onUpdateMissingCrates!(item.effectiveMissingCratesCount - 1);
                                          }
                                        },
                                  borderRadius: const BorderRadius.horizontal(left: Radius.circular(3)),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 5),
                                    child: Text(
                                      '-',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: item.effectiveMissingCratesCount <= 1
                                            ? const Color(0xFFD1D5DB)
                                            : const Color(0xFF78350F),
                                      ),
                                    ),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 4),
                                  child: Text(
                                    '${item.effectiveMissingCratesCount}',
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                      fontFamily: 'monospace',
                                      color: Color(0xFF78350F),
                                    ),
                                  ),
                                ),
                                InkWell(
                                  onTap: item.effectiveMissingCratesCount >= item.quantity
                                      ? null
                                      : () {
                                          if (onUpdateMissingCrates != null) {
                                            onUpdateMissingCrates!(item.effectiveMissingCratesCount + 1);
                                          }
                                        },
                                  borderRadius: const BorderRadius.horizontal(right: Radius.circular(3)),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 5),
                                    child: Text(
                                      '+',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: item.effectiveMissingCratesCount >= item.quantity
                                            ? const Color(0xFFD1D5DB)
                                            : const Color(0xFF78350F),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            '+${LaoCurrencyFormatter.format(item.crateFeeTotal, includeSymbol: false)} ₭',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              fontFamily: 'monospace',
                              color: Color(0xFF78350F),
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  },
);
}

  Widget _buildThumbnail() {
    if (item.product.imageUrl != null && item.product.imageUrl!.isNotEmpty) {
      final isDataUri = ImageCompressService.isDataUri(item.product.imageUrl!);
      return isDataUri
          ? Image.memory(
              ImageCompressService.bytesFromDataUri(item.product.imageUrl!) ?? Uint8List(0),
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const Center(
                child: Icon(Icons.inventory_2_outlined, size: 18, color: AppColors.textTertiary),
              ),
            )
          : Image.network(
              item.product.imageUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const Center(
                child: Icon(Icons.inventory_2_outlined, size: 18, color: AppColors.textTertiary),
              ),
            );
    }
    return const Center(
      child: Icon(Icons.inventory_2_outlined, size: 18, color: AppColors.textTertiary),
    );
  }

  void _showQuantityNumpad(BuildContext context) {
    int enteredQty = item.quantity;
    final controller = TextEditingController(text: enteredQty.toString());

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            void appendDigit(String digit) {
              setDialogState(() {
                if (controller.text == '0' || controller.text.isEmpty) {
                  controller.text = digit;
                } else {
                  controller.text += digit;
                }
              });
            }

            void backspace() {
              setDialogState(() {
                if (controller.text.isNotEmpty) {
                  controller.text = controller.text.substring(0, controller.text.length - 1);
                }
              });
            }

            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Row(
                children: [
                  const Icon(Icons.pin_rounded, color: AppColors.primary, size: 22),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'ປ່ຽນຈຳນວນ: ${item.product.name}',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              content: SizedBox(
                width: 280,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceSubtle,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border),
                      ),
                      alignment: Alignment.centerRight,
                      child: Text(
                        controller.text.isEmpty ? '0' : controller.text,
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                          color: AppColors.primaryDark,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    // 3x4 Numpad Grid
                    GridView.count(
                      crossAxisCount: 3,
                      shrinkWrap: true,
                      crossAxisSpacing: 6,
                      mainAxisSpacing: 6,
                      childAspectRatio: 1.5,
                      children: [
                        for (var i = 1; i <= 9; i++)
                          ElevatedButton(
                            onPressed: () => appendDigit(i.toString()),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.surface,
                              foregroundColor: AppColors.textPrimary,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                                side: const BorderSide(color: AppColors.border, width: 0.8),
                              ),
                            ),
                            child: Text('$i', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                          ),
                        ElevatedButton(
                          onPressed: () => setDialogState(() => controller.clear()),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.errorLight,
                            foregroundColor: AppColors.error,
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: const Text('C', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        ),
                        ElevatedButton(
                          onPressed: () => appendDigit('0'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.surface,
                            foregroundColor: AppColors.textPrimary,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                              side: const BorderSide(color: AppColors.border, width: 0.8),
                            ),
                          ),
                          child: const Text('0', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        ),
                        ElevatedButton(
                          onPressed: backspace,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.surfaceSubtle,
                            foregroundColor: AppColors.textSecondary,
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: const Icon(Icons.backspace_outlined, size: 18),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('ຍົກເລີກ'),
                ),
                ElevatedButton(
                  onPressed: () {
                    final qty = int.tryParse(controller.text) ?? 1;
                    if (onSetQuantity != null) {
                      onSetQuantity!(qty);
                    }
                    Navigator.of(ctx).pop();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('ຕົກລົງ'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
