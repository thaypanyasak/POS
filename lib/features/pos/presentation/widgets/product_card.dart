import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../core/utils/image_compress_service.dart';
import '../../../../domain/models/product.dart';
import '../../../../domain/models/product_unit.dart';

/// Minimal, Modern Product Card for POS Station
/// - Clean card design with subtle borders, smooth micro-shadows, and elegant typography
/// - Dynamic packaging action pills: [Sub-unit (ແກ້ວ/ແພັກ/ກະປ໋ອງ)] and [Carton (ແກັດ/ລັງ)]
/// - Automatic single full-width tier for Beer (e.g. [ລັງ 265.000 ₭])
/// - Lao currency formatted with dots e.g. `70.000 ₭`
/// - Dynamic compound stock indicator
class ProductCard extends StatelessWidget {
  final Product product;
  final bool isWholesaleMode;
  final VoidCallback onTap;
  final ValueChanged<ProductUnit> onSelectUnit;
  final VoidCallback onOpenUnitSelector;

  const ProductCard({
    super.key,
    required this.product,
    required this.isWholesaleMode,
    required this.onTap,
    required this.onSelectUnit,
    required this.onOpenUnitSelector,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isOutOfStock = product.trackStock && product.currentStockBaseUnits <= 0;

    // Retrieve dynamic sub-unit and carton unit
    final subUnit = product.subTierUnit;
    final cartonUnit = product.cartonTierUnit;
    final isSingleTier = product.units.length <= 1;
    final hasCarton = !isSingleTier && (cartonUnit.multiplier > 1 || cartonUnit.unitName.contains('ແກັດ') || cartonUnit.unitName.contains('ລັງ'));

    final subPrice = subUnit.priceForMode(isWholesale: isWholesaleMode);
    final cartonPrice = cartonUnit.priceForMode(isWholesale: isWholesaleMode);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        splashColor: AppColors.primaryLight.withValues(alpha: 0.3),
        child: Ink(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isOutOfStock
                  ? AppColors.error.withValues(alpha: 0.35)
                  : AppColors.border,
              width: 0.9,
            ),
            boxShadow: AppColors.cardShadow,
          ),
          child: Padding(
            padding: const EdgeInsets.all(9.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 1. Top Row: Category Pill & Stock Status with Dot
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceSubtle,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          product.category,
                          style: const TextStyle(
                            color: AppColors.textTertiary,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    _buildStockBadge(context),
                  ],
                ),

                const SizedBox(height: 7),

                // 2. Middle Row: Thumbnail (or fallback icon) + Product Name
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildProductImageOrFallback(),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          product.name,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            height: 1.25,
                            color: isOutOfStock
                                ? AppColors.textMuted
                                : AppColors.textPrimary,
                            letterSpacing: -0.2,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 7),

                // 3. Bottom Row: Minimal Unit Action Pills
                Row(
                  children: [
                    if (isSingleTier) ...[
                      // Single unit (e.g. Beer sold strictly by crate [ລັງ 265.000 ₭])
                      Expanded(
                        child: _buildUnitButton(
                          unit: subUnit,
                          label: subUnit.unitName,
                          price: subPrice,
                          isCarton: false,
                        ),
                      ),
                    ] else ...[
                      // Dynamic Sub-unit (e.g. ແພັກ / ແກ້ວ / ກະປ໋ອງ)
                      Expanded(
                        child: _buildUnitButton(
                          unit: subUnit,
                          label: subUnit.unitName,
                          price: subPrice,
                          isCarton: false,
                        ),
                      ),
                      if (hasCarton) ...[
                        const SizedBox(width: 5),
                        // Carton Unit (e.g. ແກັດ / ລັງ)
                        Expanded(
                          child: _buildUnitButton(
                            unit: cartonUnit,
                            label: cartonUnit.unitName,
                            price: cartonPrice,
                            isCarton: true,
                          ),
                        ),
                      ],
                    ],
                    const SizedBox(width: 5),
                    // Quick Tune / Custom Stepper Trigger
                    InkWell(
                      onTap: onOpenUnitSelector,
                      borderRadius: BorderRadius.circular(7),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceSubtle,
                          borderRadius: BorderRadius.circular(7),
                          border: Border.all(color: AppColors.border, width: 0.8),
                        ),
                        child: Icon(
                          Icons.tune_rounded,
                          size: 14,
                          color: isWholesaleMode ? AppColors.wholesale : AppColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProductImageOrFallback() {
    if (product.imageUrl != null && product.imageUrl!.isNotEmpty) {
      final isDataUri = ImageCompressService.isDataUri(product.imageUrl!);
      return Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: AppColors.surfaceSubtle,
          borderRadius: BorderRadius.circular(7),
          border: Border.all(color: AppColors.border, width: 0.8),
        ),
        clipBehavior: Clip.antiAlias,
        child: isDataUri
            ? Image.memory(
                ImageCompressService.bytesFromDataUri(product.imageUrl!) ?? Uint8List(0),
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _buildFallbackCategoryIcon(),
              )
            : Image.network(
                product.imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _buildFallbackCategoryIcon(),
              ),
      );
    }
    return _buildFallbackCategoryIcon();
  }

  Widget _buildFallbackCategoryIcon() {
    IconData icon = Icons.inventory_2_outlined;
    Color iconColor = AppColors.textSecondary;
    Color bgColor = AppColors.surfaceSubtle;

    if (product.category.contains('ເບຍ')) {
      icon = Icons.sports_bar_outlined;
      iconColor = AppColors.beer;
      bgColor = AppColors.beerLight;
    } else if (product.category.contains('ເຄື່ອງດື່ມ') || product.category.contains('ນ້ຳ')) {
      icon = Icons.local_drink_outlined;
      iconColor = AppColors.info;
      bgColor = AppColors.infoLight;
    } else if (product.category.contains('ເຂົ້າໜົມ')) {
      icon = Icons.cookie_outlined;
      iconColor = AppColors.wholesale;
      bgColor = AppColors.wholesaleLight;
    } else if (product.category.contains('ຢາສູບ')) {
      icon = Icons.smoking_rooms_outlined;
      iconColor = const Color(0xFF475569);
      bgColor = const Color(0xFFE2E8F0);
    }

    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(7),
        border: Border.all(color: AppColors.borderSubtle, width: 0.8),
      ),
      child: Center(
        child: Icon(icon, size: 18, color: iconColor),
      ),
    );
  }

  Widget _buildUnitButton({
    required ProductUnit unit,
    required String label,
    required int price,
    required bool isCarton,
  }) {
    final activeColor = isCarton
        ? AppColors.wholesale
        : (isWholesaleMode ? AppColors.wholesale : AppColors.primary);
    final activeBg = isCarton
        ? AppColors.wholesaleLight.withValues(alpha: 0.5)
        : (isWholesaleMode
            ? AppColors.wholesaleLight.withValues(alpha: 0.5)
            : AppColors.primaryLight.withValues(alpha: 0.6));
    final activeDark = isCarton
        ? AppColors.wholesaleDark
        : (isWholesaleMode ? AppColors.wholesaleDark : AppColors.primaryDark);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => onSelectUnit(unit),
        borderRadius: BorderRadius.circular(7),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 4),
          decoration: BoxDecoration(
            color: activeBg,
            borderRadius: BorderRadius.circular(7),
            border: Border.all(
              color: activeColor.withValues(alpha: 0.4),
              width: 0.8,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: activeDark,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                LaoCurrencyFormatter.format(price),
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w900,
                  color: activeDark,
                  letterSpacing: -0.2,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStockBadge(BuildContext context) {
    if (!product.trackStock) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: AppColors.infoLight,
          borderRadius: BorderRadius.circular(5),
          border: Border.all(color: AppColors.infoBorder, width: 0.7),
        ),
        child: const Text(
          'ບໍ່ນັບສາງ',
          style: TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w600,
            color: AppColors.info,
          ),
        ),
      );
    }

    if (product.currentStockBaseUnits <= 0) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: AppColors.errorLight,
          borderRadius: BorderRadius.circular(5),
          border: Border.all(color: AppColors.errorBorder, width: 0.7),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 5,
              height: 5,
              decoration: const BoxDecoration(
                color: AppColors.error,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 4),
            const Text(
              'ໝົດສາງ',
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w700,
                color: AppColors.error,
              ),
            ),
          ],
        ),
      );
    }

    final isLowStock = product.currentStockBaseUnits <= (product.highestTierUnit.multiplier * 2);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: isLowStock ? AppColors.warningLight : AppColors.surfaceSubtle,
        borderRadius: BorderRadius.circular(5),
        border: Border.all(
          color: isLowStock ? AppColors.wholesaleBorder : AppColors.border,
          width: 0.7,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(
              color: isLowStock ? AppColors.warning : const Color(0xFF10B981),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            product.stockBadgeText,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w600,
              color: isLowStock ? AppColors.warning : AppColors.textSecondary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
