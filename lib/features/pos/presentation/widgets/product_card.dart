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
                padding: const EdgeInsets.fromLTRB(6.0, 6.0, 6.0, 2.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Product Image with AspectRatio 4/3 (Clean image without overlay badges)
                    Expanded(
                      child: Center(
                        child: AspectRatio(
                          aspectRatio: 4 / 3,
                          child: ClipRRect(
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(8), bottom: Radius.circular(4)),
                            child: _buildProductImageOrFallback(),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 4),

                    // Product Name (Font size 12px, weight 600, max 2 lines clamp)
                    SizedBox(
                      height: 32,
                      child: Text(
                        product.name,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          fontSize: 12.0,
                          height: 1.25,
                          color: AppColors.textPrimary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),

                    const SizedBox(height: 2),

                    // Stock info on left + Unit selector button on right (height 20px)
                    SizedBox(
                      height: 20,
                      child: Row(
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
                                      color: Color(0xFF94A3B8), // slate-400
                                      fontWeight: FontWeight.w500,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  )
                                  : isZeroStock
                                  ? Align(
                                    alignment: Alignment.centerLeft,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 5,
                                        vertical: 1.5,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFFFBEB), // amber-50
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(
                                          color: const Color(0xFFFDE68A), // amber-200
                                          width: 0.8,
                                        ),
                                      ),
                                      child: const Text(
                                        'ໝົດສາງ (0)',
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFFB45309), // amber-700
                                        ),
                                      ),
                                    ),
                                  )
                                  : isNegativeStock
                                  ? Align(
                                    alignment: Alignment.centerLeft,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 5,
                                        vertical: 1.5,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFEF2F2), // rose-50
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(
                                          color: const Color(0xFFFECDD3), // rose-200
                                          width: 0.8,
                                        ),
                                      ),
                                      child: Text(
                                        'ຕິດລົບ (-${product.negativeStockCompound})',
                                        style: const TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w800,
                                          color: Color(0xFFBE123C), // rose-700
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
                                        color: Color(0xFF64748B), // slate-500
                                        fontWeight: FontWeight.w500,
                                      ),
                                      children: [
                                        const TextSpan(text: 'ສະຕັອກ: '),
                                        TextSpan(
                                          text: product.stockDisplayText,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF334155),
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
                                  PhosphorIconsRegular.faders,
                                  size: 11,
                                  color: Color(0xFF0D9488),
                                ),
                                const SizedBox(width: 2),
                                const Text(
                                  'ປັບຫົວໜ່ວຍ',
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF0F766E),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

          // 2. Fast 1-Tap Unit Add Buttons Bar (Matching Web App, exactly 36px high)
          Container(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
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
          height: 34,
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 1.5),
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
          child: Center(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.center,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    unit.unitName,
                    style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      color: unitTextColor,
                      height: 1.1,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 1),
                  Text(
                    LaoCurrencyFormatter.format(price, includeSymbol: false),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: priceTextColor,
                      fontFamily: 'monospace',
                      fontFeatures: const [FontFeature.tabularFigures()],
                      letterSpacing: -0.3,
                      height: 1.1,
                    ),
                    maxLines: 1,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
