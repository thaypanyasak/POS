import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../core/utils/image_compress_service.dart';
import '../../../../domain/models/cart_item.dart';
import '../../../../domain/models/product_unit.dart';

/// Modern Redesigned Cart Line Item Tile for POS Dock (Styled matching Web App)
/// Card: Slate-200 1px border, 12px rounded corner
/// Row 1 (Top):
///   - Left: Thumbnail (44x44px rounded 8px) + Product Name bold + (ຂາຍຕິດລົບ) badge
///   - Right: Line Subtotal in bold tabular mono `${formattedLineTotal} ₭` + Trash icon
/// Row 2 (Bottom):
///   - Left: Segmented Unit Switcher (pills in Slate-100 capsule) + Split Price Button `[ 🏷️ 95.000 | ▾ ]`
///   - Right: Stepper [- QTY +] positioned at bottom-right corner
class CartLineItemTile extends StatelessWidget {
  final CartItem item;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onRemove;
  final ValueChanged<ProductUnit> onSwitchUnit;
  final ValueChanged<int>? onSelectPriceTier;
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
    this.onSelectPriceTier,
    required this.onPriceOverride,
    required this.onResetPriceOverride,
    this.onSetQuantity,
    this.onToggleCrateDeposit,
    this.onUpdateMissingCrates,
  });

  @override
  Widget build(BuildContext context) {
    final trackStock = item.product.trackStock;
    final isNegativeStock =
        trackStock &&
        (item.totalBaseUnitsDeducted > item.product.currentStockBaseUnits ||
            item.product.currentStockBaseUnits <= 0);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 5, vertical: 2.0),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color:
              item.isPriceOverridden
                  ? const Color(0xFFFCD34D) // amber-300
                  : const Color(0xFFE2E8F0), // slate-200
          width: item.isPriceOverridden ? 1.2 : 1.0,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 2,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // ==========================================
          // MAIN ROW: Thumbnail (Left) + 2 Rows Column (Right)
          // ==========================================
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // 1. CỘT TRÁI: Hình ảnh sản phẩm thu nhỏ bo góc (36x36px siêu gọn)
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: const Color(0xFFE2E8F0),
                    width: 0.8,
                  ),
                ),
                clipBehavior: Clip.antiAlias,
                child: _buildThumbnail(),
              ),

              const SizedBox(width: 8),

              // 2. CỘT PHẢI (Expanded): Chứa 2 Hàng (Row 1 trên, Row 2 dưới)
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // --- HÀNG 1 (DÒNG TRÊN): Tên SP & Badge âm kho vs Nút chọn giá ---
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Bên trái: Tên sản phẩm + Badge (ຂາຍຕິດລົບ)
                        Expanded(
                          child: Row(
                            children: [
                              Flexible(
                                child: Text(
                                  item.product.name,
                                  style: const TextStyle(
                                    fontSize: 12.0,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF0F172A), // slate-900
                                    letterSpacing: -0.2,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (isNegativeStock) ...[
                                const SizedBox(width: 4),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 4,
                                    vertical: 1,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFF1F2), // rose-50
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(
                                      color: const Color(0xFFFECDD3),
                                      width: 0.8,
                                    ), // rose-200
                                  ),
                                  child: const Text(
                                    '(ຂາຍຕິດລົບ)',
                                    style: TextStyle(
                                      fontSize: 9.0,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFFE11D48), // rose-600
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),

                        const SizedBox(width: 6),

                        // Bên phải: NÚT CHỌN GIÁ DUY NHẤT [ 🏷️ {đơn_giá} ₭ ▾ ] + Icon Thùng rác
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            _SplitPriceButton(
                              item: item,
                              onSelectPriceTier: onSelectPriceTier,
                              onPriceOverride: onPriceOverride,
                              onResetPriceOverride: onResetPriceOverride,
                            ),
                          ],
                        ),
                      ],
                    ),

                    const SizedBox(height: 4),

                    // --- HÀNG 2 (DÒNG DƯỚI - NẰM NGANG BÊN CẠNH ẢNH, KHÔNG NẰM DƯỚI ẢNH): ---
                    // Bên trái: Bộ chọn Đơn vị tính Segmented Switch (hoặc Badge nhỏ gọn)
                    // Bên phải: Cụm nút tăng giảm số lượng [- 1 +] và nút thùng rác xóa món
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _buildUnitSelector(),
                        const SizedBox(width: 4),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _buildStepper(context),
                            const SizedBox(width: 3),
                            InkWell(
                              onTap: onRemove,
                              borderRadius: BorderRadius.circular(4),
                              child: const Padding(
                                padding: EdgeInsets.all(3.0),
                                child: PhosphorIcon(
                                  PhosphorIconsRegular.trash,
                                  size: 14,
                                  color: Color(0xFF94A3B8), // slate-400
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Optional Crate Deposit Section if applicable (Full-width, directly under Main Row, Compact)
          if (item.isCrateEligible) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFFEFCE8), // Yellow-50
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: const Color(0xFFFEF08A), // Yellow-200
                  width: 0.8,
                ),
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
                              if (onToggleCrateDeposit != null &&
                                  val != null) {
                                onToggleCrateDeposit!(val);
                              }
                            },
                            activeColor: const Color(0xFFD97706),
                            materialTapTargetSize:
                                MaterialTapTargetSize.shrinkWrap,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'ບໍ່ມີແກັດປ່ຽນ (+${LaoCurrencyFormatter.formatDots(item.feePerCrate)} ₭)',
                          style: const TextStyle(
                            fontSize: 12.0,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF854D0E), // Yellow-800
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
                          height: 22,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(
                              color: const Color(0xFFFCD34D),
                              width: 0.8,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              InkWell(
                                onTap:
                                    item.effectiveMissingCratesCount <= 1
                                        ? null
                                        : () => onUpdateMissingCrates?.call(
                                          item.effectiveMissingCratesCount -
                                              1,
                                        ),
                                borderRadius: const BorderRadius.horizontal(
                                  left: Radius.circular(3),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                  ),
                                  child: Text(
                                    '-',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color:
                                          item.effectiveMissingCratesCount <=
                                                  1
                                              ? const Color(0xFFD1D5DB)
                                              : const Color(0xFF78350F),
                                    ),
                                  ),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 5,
                                ),
                                child: Text(
                                  '${item.effectiveMissingCratesCount}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w900,
                                    fontFamily: 'monospace',
                                    color: Color(0xFF78350F),
                                  ),
                                ),
                              ),
                              InkWell(
                                onTap:
                                    item.effectiveMissingCratesCount >=
                                            item.quantity
                                        ? null
                                        : () => onUpdateMissingCrates?.call(
                                          item.effectiveMissingCratesCount +
                                              1,
                                        ),
                                borderRadius: const BorderRadius.horizontal(
                                  right: Radius.circular(3),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                  ),
                                  child: Text(
                                    '+',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color:
                                          item.effectiveMissingCratesCount >=
                                                  item.quantity
                                              ? const Color(0xFFD1D5DB)
                                              : const Color(0xFF78350F),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '+${LaoCurrencyFormatter.formatDots(item.crateFeeTotal)} ₭',
                          style: const TextStyle(
                            fontSize: 11.0,
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
          ],
        ],
      ),
    );
  }

  /// Segmented Switch Unit Selector (Capsule slider in Slate-100)
  Widget _buildUnitSelector() {
    final units = item.product.units;
    if (units.length <= 1) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9), // slate-100
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8), // slate-200
        ),
        child: Text(
          item.selectedUnit.unitName,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0D9488), // Teal-600
          ),
        ),
      );
    }

    return Container(
      height: 26,
      padding: const EdgeInsets.all(2.0),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9), // slate-100
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children:
            units.map((u) {
              final isSelected =
                  u.id == item.selectedUnit.id ||
                  u.unitName == item.selectedUnit.unitName;
              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: isSelected ? null : () => onSwitchUnit(u),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  height: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color:
                        isSelected
                            ? const Color(0xFF0D9488) // Teal-600
                            : Colors.transparent,
                    borderRadius: BorderRadius.circular(6),
                    boxShadow:
                        isSelected
                            ? const [
                              BoxShadow(
                                color: Color(0x260D9488),
                                blurRadius: 3,
                                offset: Offset(0, 1),
                              ),
                            ]
                            : null,
                  ),
                  child: Text(
                    u.unitName,
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight:
                          isSelected ? FontWeight.w800 : FontWeight.w600,
                      color:
                          isSelected ? Colors.white : const Color(0xFF475569),
                    ),
                  ),
                ),
              );
            }).toList(),
      ),
    );
  }

  /// Flat Stepper [- 1 +] with Slate-100 background, 8px rounded
  Widget _buildStepper(BuildContext context) {
    return Container(
      height: 24,
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9), // slate-100
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Minus
          InkWell(
            onTap: onDecrement,
            borderRadius: const BorderRadius.horizontal(
              left: Radius.circular(7),
            ),
            child: const SizedBox(
              width: 22,
              height: 24,
              child: Center(
                child: PhosphorIcon(
                  PhosphorIconsBold.minus,
                  size: 10,
                  color: Color(0xFF475569),
                ),
              ),
            ),
          ),

          // Qty Text (Tapping opens simple numeric change)
          InkWell(
            onTap:
                onSetQuantity != null
                    ? () => _showQuantityDialog(context)
                    : null,
            child: Container(
              constraints: const BoxConstraints(minWidth: 20),
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Text(
                '${item.quantity}',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  fontFamily: 'monospace',
                  fontFeatures: [FontFeature.tabularFigures()],
                  color: Color(0xFF0F172A),
                ),
              ),
            ),
          ),

          // Plus
          InkWell(
            onTap: onIncrement,
            borderRadius: const BorderRadius.horizontal(
              right: Radius.circular(7),
            ),
            child: const SizedBox(
              width: 22,
              height: 24,
              child: Center(
                child: PhosphorIcon(
                  PhosphorIconsBold.plus,
                  size: 10,
                  color: Color(0xFF0D9488),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildThumbnail() {
    if (item.product.imageUrl != null && item.product.imageUrl!.isNotEmpty) {
      final isDataUri = ImageCompressService.isDataUri(item.product.imageUrl!);
      return isDataUri
          ? Image.memory(
            ImageCompressService.bytesFromDataUri(item.product.imageUrl!) ??
                Uint8List(0),
            fit: BoxFit.cover,
            errorBuilder:
                (_, __, ___) => const Center(
                  child: PhosphorIcon(
                    PhosphorIconsBold.package,
                    size: 18,
                    color: AppColors.textMuted,
                  ),
                ),
          )
          : Image.network(
            item.product.imageUrl!,
            fit: BoxFit.cover,
            errorBuilder:
                (_, __, ___) => const Center(
                  child: PhosphorIcon(
                    PhosphorIconsBold.package,
                    size: 18,
                    color: AppColors.textMuted,
                  ),
                ),
          );
    }
    return const Center(
      child: PhosphorIcon(
        PhosphorIconsBold.package,
        size: 18,
        color: AppColors.textMuted,
      ),
    );
  }

  void _showQuantityDialog(BuildContext context) {
    final controller = TextEditingController(text: '${item.quantity}');
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          title: Text(
            'ປ່ຽນຈຳນວນ: ${item.product.name}',
            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold),
          ),
          content: TextField(
            controller: controller,
            keyboardType: TextInputType.number,
            autofocus: true,
            decoration: InputDecoration(
              labelText: 'ຈຳນວນ',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('ຍົກເລີກ'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0D9488),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: () {
                final qty = int.tryParse(controller.text) ?? 1;
                if (onSetQuantity != null) onSetQuantity!(qty);
                Navigator.of(ctx).pop();
              },
              child: const Text('ຕົກລົງ'),
            ),
          ],
        );
      },
    );
  }
}

/// All-in-One Split Price Button [ 🏷️ 95.000 | ▾ ]
/// Opens a right-anchored popup menu (260px - 280px) with Quick Tiers + Custom Numeric Input
class _SplitPriceButton extends StatelessWidget {
  final CartItem item;
  final ValueChanged<int>? onSelectPriceTier;
  final Function(int newPrice, String reason) onPriceOverride;
  final VoidCallback onResetPriceOverride;

  const _SplitPriceButton({
    required this.item,
    required this.onSelectPriceTier,
    required this.onPriceOverride,
    required this.onResetPriceOverride,
  });

  void _showAllInOnePricePopover(BuildContext context) {
    final RenderBox button = context.findRenderObject()! as RenderBox;
    final RenderBox overlay =
        Overlay.of(context).context.findRenderObject()! as RenderBox;

    final buttonRect = Rect.fromPoints(
      button.localToGlobal(Offset.zero, ancestor: overlay),
      button.localToGlobal(
        button.size.bottomRight(Offset.zero),
        ancestor: overlay,
      ),
    );

    const double popoverWidth = 270.0;
    double left = buttonRect.right - popoverWidth;
    if (left < 8.0) left = 8.0;
    final double top = buttonRect.bottom + 4.0;

    showDialog(
      context: context,
      barrierColor: Colors.transparent,
      builder: (ctx) {
        return Stack(
          children: [
            // Dismiss background tap
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.translucent,
                onTap: () => Navigator.of(ctx).pop(),
                child: const SizedBox.expand(),
              ),
            ),
            // Floating Popover anchored right-0
            Positioned(
              left: left,
              top: top,
              child: Material(
                elevation: 8,
                shadowColor: const Color(0x260F172A),
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  width: popoverWidth,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: const Color(0xFFE2E8F0),
                      width: 1.0,
                    ),
                  ),
                  child: _PricePopoverContent(
                    item: item,
                    onSelectPriceTier: (tier) {
                      onSelectPriceTier?.call(tier);
                      Navigator.of(ctx).pop();
                    },
                    onApplyOverride: (price, reason) {
                      onPriceOverride(price, reason);
                      Navigator.of(ctx).pop();
                    },
                    onResetOverride: () {
                      onResetPriceOverride();
                      Navigator.of(ctx).pop();
                    },
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isOverridden = item.isPriceOverridden;

    final Color bgColor =
        isOverridden ? const Color(0xFFFEF3C7) : const Color(0xFFF0FDFA);
    final Color borderColor =
        isOverridden ? const Color(0xFFFCD34D) : const Color(0xFF99F6E4);
    final Color textColor =
        isOverridden ? const Color(0xFF92400E) : const Color(0xFF115E59);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _showAllInOnePricePopover(context),
        borderRadius: BorderRadius.circular(8),
        child: Ink(
          height: 26,
          padding: const EdgeInsets.symmetric(horizontal: 7),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: borderColor, width: 1.0),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              PhosphorIcon(
                PhosphorIconsRegular.tag,
                size: 13,
                color: textColor,
              ),
              const SizedBox(width: 4),
              Text(
                '${LaoCurrencyFormatter.formatDots(item.effectiveUnitPrice)} ₭',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  fontFamily: 'monospace',
                  fontFeatures: const [FontFeature.tabularFigures()],
                  color: textColor,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(width: 3),
              PhosphorIcon(
                PhosphorIconsRegular.caretDown,
                size: 11,
                color: textColor,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Content inside the All-in-One Price Popover
class _PricePopoverContent extends StatefulWidget {
  final CartItem item;
  final ValueChanged<int> onSelectPriceTier;
  final Function(int newPrice, String reason) onApplyOverride;
  final VoidCallback onResetOverride;

  const _PricePopoverContent({
    required this.item,
    required this.onSelectPriceTier,
    required this.onApplyOverride,
    required this.onResetOverride,
  });

  @override
  State<_PricePopoverContent> createState() => _PricePopoverContentState();
}

class _PricePopoverContentState extends State<_PricePopoverContent> {
  late TextEditingController _customPriceController;

  @override
  void initState() {
    super.initState();
    // Do NOT auto focus, populate with current unit price formatted with thousand dots
    final initialPrice = widget.item.effectiveUnitPrice;
    _customPriceController = TextEditingController(
      text:
          initialPrice > 0 ? LaoCurrencyFormatter.formatDots(initialPrice) : '',
    );
  }

  @override
  void dispose() {
    _customPriceController.dispose();
    super.dispose();
  }

  void _submitCustomPrice() {
    final parsed = LaoCurrencyFormatter.parseClean(_customPriceController.text);
    if (parsed > 0) {
      widget.onApplyOverride(parsed, 'ປັບລາຄາພິເສດ');
    }
  }

  @override
  Widget build(BuildContext context) {
    final unit = widget.item.selectedUnit;
    final p1 = unit.retailPrice;
    final p2 = unit.price2 ?? 0;
    final p3 = unit.price3 ?? 0;
    final currentTier = widget.item.selectedPriceTier;

    return Padding(
      padding: const EdgeInsets.all(10.0),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ເລືອກລະດັບລາຄາ',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF64748B),
                ),
              ),
              Text(
                unit.unitName,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0D9488),
                ),
              ),
            ],
          ),

          const SizedBox(height: 6),

          // Section 1: Quick select Price 1, Price 2, Price 3
          _buildTierOption(
            tier: 1,
            title: 'ລາຄາ 1 (ມາດຕະຖານ)',
            price: p1,
            isSelected: currentTier == 1 && !widget.item.isPriceOverridden,
          ),
          if (p2 > 0) ...[
            const SizedBox(height: 3),
            _buildTierOption(
              tier: 2,
              title: 'ລາຄາ 2 (ລູກຄ້າປະຈຳ)',
              price: p2,
              isSelected: currentTier == 2 && !widget.item.isPriceOverridden,
            ),
          ],
          if (p3 > 0) ...[
            const SizedBox(height: 3),
            _buildTierOption(
              tier: 3,
              title: 'ລາຄາ 3 (VIP / ສົ່ງ)',
              price: p3,
              isSelected: currentTier == 3 && !widget.item.isPriceOverridden,
            ),
          ],

          // Section 2: 1px divider
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Divider(height: 1, color: Color(0xFFE2E8F0)),
          ),

          // Section 3: Custom numeric input + OK button (NO autofocus, numpad on tap)
          const Text(
            'ປ້ອນລາຄາຕາມໃຈ (ກີບ):',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 5),

          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 34,
                  child: TextField(
                    controller: _customPriceController,
                    keyboardType: TextInputType.number,
                    autofocus: false, // Strict Rule: No auto focus
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LaoCurrencyInputFormatter(),
                    ],
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      fontFamily: 'monospace',
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 0,
                      ),
                      hintText: 'ປ້ອນລາຄາ...',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(
                          color: Color(0xFF0D9488),
                          width: 1.5,
                        ),
                      ),
                    ),
                    onSubmitted: (_) => _submitCustomPrice(),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              SizedBox(
                height: 34,
                child: ElevatedButton(
                  onPressed: _submitCustomPrice,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0D9488), // bg-teal-600
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text(
                    'OK',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),

          if (widget.item.isPriceOverridden) ...[
            const SizedBox(height: 6),
            InkWell(
              onTap: widget.onResetOverride,
              child: const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 2.0),
                  child: Text(
                    'ຣີເຊັດກັບລາຄາເດີມ',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFFE11D48),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTierOption({
    required int tier,
    required String title,
    required int price,
    required bool isSelected,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => widget.onSelectPriceTier(tier),
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFF0FDFA) : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border:
                isSelected
                    ? Border.all(color: const Color(0xFF99F6E4), width: 1.0)
                    : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                  color:
                      isSelected
                          ? const Color(0xFF0F766E)
                          : const Color(0xFF334155),
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${LaoCurrencyFormatter.formatDots(price)} ₭',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      fontFamily: 'monospace',
                      fontFeatures: const [FontFeature.tabularFigures()],
                      color:
                          isSelected
                              ? const Color(0xFF0F766E)
                              : const Color(0xFF0F172A),
                    ),
                  ),
                  if (isSelected) ...[
                    const SizedBox(width: 4),
                    const PhosphorIcon(
                      PhosphorIconsBold.check,
                      size: 13,
                      color: Color(0xFF0D9488),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
