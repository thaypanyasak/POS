import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../core/utils/image_compress_service.dart';
import '../../../../domain/models/product.dart';
import '../../../../domain/models/product_unit.dart';

/// Modern, Clean Product Card for POS Station (Styled exactly like Web App)
/// - Rounded card with subtle border & hover shadow
/// - Top image preview with Category pill badge in bottom-left corner
/// - Product Name in bold Lao typography
/// - Compound stock label on the left & Unit selector trigger on the right
/// - Bottom 1-Tap Unit Add Buttons:
///   * Bulk/Carton (ແກັດ/ລັງ): Dark teal background (teal-600) with white text
///   * Pack (ແພັກ): White card with sky-700 text & subtle border
///   * Piece/Base (ອັນ/ແກ້ວ): Clean white card with slate-900 text
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
    final isZeroStock =
        product.trackStock && product.currentStockBaseUnits == 0;
    final isNegativeStock =
        product.trackStock && product.currentStockBaseUnits < 0;

    // Retrieve dynamic units
    final displayUnits =
        product.units.isNotEmpty
            ? product.units
            : [
              ProductUnit(
                id: '${product.id}_base',
                productId: product.id,
                unitName: product.baseUnit,
                multiplier: 1,
                retailPrice: 0,
                wholesalePrice: 0,
                isBaseUnit: true,
              ),
            ];

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color:
              isNegativeStock
                  ? AppColors.danger.withValues(alpha: 0.35)
                  : isZeroStock
                  ? AppColors.warning.withValues(alpha: 0.35)
                  : AppColors.border,
          width: 1.0,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Top Card Area (Tap to open unit selector / quick add)
          Expanded(
            child: InkWell(
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.all(7.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Product Image with Category Pill Badge (Matching Web App)
                    Expanded(
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: _buildProductImageOrFallback(),
                          ),
                          // Category pill at bottom-left corner of image
                          Positioned(
                            bottom: 4,
                            left: 4,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 5,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xCC020617), // slate-950/80
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                product.category,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 8.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 5),

                    // Product Name (Bold, 1 line clamp)
                    Text(
                      product.name,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                        height: 1.15,
                        color: AppColors.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),

                    const SizedBox(height: 1),

                    // Stock info on left + Unit selector button on right (Duy nhất 1 vị trí chuẩn ERP - Font compact)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child:
                              !product.trackStock
                                  ? const Text(
                                    'ບໍ່ນັບສາງ',
                                    style: TextStyle(
                                      fontSize: 9.5,
                                      color: AppColors.textTertiary,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  )
                                  : isZeroStock
                                  ? Align(
                                    alignment: Alignment.centerLeft,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 4,
                                        vertical: 1,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.amber50,
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(
                                          color: AppColors.amber500.withValues(
                                            alpha: 0.5,
                                          ),
                                          width: 0.8,
                                        ),
                                      ),
                                      child: const Text(
                                        'ໝົດສາງ (0)',
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.amber700,
                                        ),
                                      ),
                                    ),
                                  )
                                  : isNegativeStock
                                  ? Align(
                                    alignment: Alignment.centerLeft,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 4,
                                        vertical: 1,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.rose50,
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(
                                          color: AppColors.rose500.withValues(
                                            alpha: 0.5,
                                          ),
                                          width: 0.8,
                                        ),
                                      ),
                                      child: Text(
                                        'ຕິດລົບ (${product.negativeStockCompound})',
                                        style: const TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w800,
                                          color: AppColors.rose700,
                                        ),
                                      ),
                                    ),
                                  )
                                  : RichText(
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    text: TextSpan(
                                      style: const TextStyle(
                                        fontSize: 9.5,
                                        color: Color(0xFF64748B),
                                        fontWeight: FontWeight.w500,
                                      ),
                                      children: [
                                        const TextSpan(text: 'ສະຕັອກ: '),
                                        TextSpan(
                                          text: product.stockBadgeText,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF1E293B),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                        ),
                        InkWell(
                          onTap: onOpenUnitSelector,
                          borderRadius: BorderRadius.circular(4),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 2,
                              vertical: 1,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const PhosphorIcon(
                                  PhosphorIconsBold.slidersHorizontal,
                                  size: 10,
                                  color: AppColors.primary,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  'ປັບຫົວໜ່ວຍ',
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primaryDark,
                                  ),
                                ),
                              ],
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

          // 2. Fast 1-Tap Unit Add Buttons Bar (Matching Web App)
          Container(
            padding: const EdgeInsets.all(5),
            decoration: const BoxDecoration(
              color: AppColors.surfaceSubtle,
              border: Border(
                top: BorderSide(color: AppColors.border, width: 0.8),
              ),
            ),
            child: Row(
              children: [
                for (int i = 0; i < displayUnits.length; i++) ...[
                  if (i > 0) const SizedBox(width: 4),
                  Expanded(
                    child: _buildUnitButton(
                      unit: displayUnits[i],
                      price: displayUnits[i].priceForMode(
                        isWholesale: isWholesaleMode,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductImageOrFallback() {
    if (product.imageUrl != null && product.imageUrl!.isNotEmpty) {
      final isDataUri = ImageCompressService.isDataUri(product.imageUrl!);
      return isDataUri
          ? Image.memory(
            ImageCompressService.bytesFromDataUri(product.imageUrl!) ??
                Uint8List(0),
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _buildFallbackCategoryIcon(),
          )
          : Image.network(
            product.imageUrl!,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _buildFallbackCategoryIcon(),
          );
    }
    return _buildFallbackCategoryIcon();
  }

  Widget _buildFallbackCategoryIcon() {
    PhosphorIconData icon = PhosphorIconsBold.package;
    Color iconColor = AppColors.textMuted;
    Color bgColor = const Color(0xFFF8FAFC);

    if (product.category.contains('ເບຍ')) {
      icon = PhosphorIconsBold.beerBottle;
      iconColor = AppColors.beer;
      bgColor = AppColors.beerLight;
    } else if (product.category.contains('ເຄື່ອງດື່ມ') ||
        product.category.contains('ນ້ຳ')) {
      icon = PhosphorIconsBold.brandy;
      iconColor = AppColors.info;
      bgColor = AppColors.infoLight;
    } else if (product.category.contains('ເຂົ້າໜົມ')) {
      icon = PhosphorIconsBold.cookie;
      iconColor = AppColors.warning;
      bgColor = AppColors.warningLight;
    } else if (product.category.contains('ຢາສູບ')) {
      icon = PhosphorIconsBold.fire;
      iconColor = const Color(0xFF475569);
      bgColor = const Color(0xFFE2E8F0);
    }

    return Container(
      color: bgColor,
      child: Center(child: PhosphorIcon(icon, size: 28, color: iconColor)),
    );
  }

  Widget _buildUnitButton({required ProductUnit unit, required int price}) {
    // Determine tier styling matching web PosScreen.jsx
    final isBulk =
        unit.multiplier >= 12 ||
        unit.unitName == 'ລັງ' ||
        unit.unitName == 'ແກັດ' ||
        unit.unitName == 'ເປົາ';

    final isMiddlePack = !isBulk && unit.multiplier > 1;

    final Color bgColor;
    final Color borderColor;
    final Color unitTextColor;
    final Color priceTextColor;

    if (isBulk) {
      bgColor = const Color(0xFF0D9488); // teal-600
      borderColor = const Color(0xFF0D9488);
      unitTextColor = const Color(0xFFCCFBF1); // teal-100
      priceTextColor = Colors.white;
    } else if (isMiddlePack) {
      bgColor = Colors.white;
      borderColor = const Color(0xFFE2E8F0);
      unitTextColor = const Color(0xFF0369A1); // sky-700
      priceTextColor = AppColors.textPrimary;
    } else {
      // Piece / Base unit
      bgColor = Colors.white;
      borderColor = const Color(0xFFE2E8F0);
      unitTextColor = AppColors.textSecondary;
      priceTextColor = AppColors.textPrimary;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => onSelectUnit(unit),
        borderRadius: BorderRadius.circular(6),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 3.5),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: borderColor, width: 0.9),
            boxShadow: const [
              BoxShadow(
                color: Color(0x06000000),
                blurRadius: 2,
                offset: Offset(0, 1),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                unit.unitName,
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  color: unitTextColor,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 1),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  LaoCurrencyFormatter.format(price, includeSymbol: false),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: priceTextColor,
                    fontFamily: 'monospace',
                    letterSpacing: -0.3,
                  ),
                  maxLines: 1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
