import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/localization/lao_currency_formatter.dart';
import '../../../core/localization/lo.dart';
import '../../../core/utils/image_compress_service.dart';
import '../../../domain/models/product.dart';
import '../../pos/presentation/controllers/catalog_controller.dart';
import 'product_form_screen.dart';

/// Module B: Fast Catalog & Stock Browser (ຄົ້ນຫາ ແລະ ກວດສອບສິນຄ້າດ່ວນ)
/// Features:
/// - Instant live filter by barcode, name, category
/// - Live compound stock display (e.g., 3 ແກັດ 5 ແພັກ)
/// - Quick restock inline buttons (+1 ແກັດ, +5 ແກັດ)
/// - Inline price adjustment popovers
class ProductListScreen extends ConsumerStatefulWidget {
  final VoidCallback? onOpenAddProduct;

  const ProductListScreen({super.key, this.onOpenAddProduct});

  @override
  ConsumerState<ProductListScreen> createState() => _ProductListScreenState();
}

enum StockStatusFilter {
  all,
  inStock,
  lowStock,
  outOfStock,
}

class _ProductListScreenState extends ConsumerState<ProductListScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _selectedCategory = 'ທັງໝົດ';
  StockStatusFilter _stockFilter = StockStatusFilter.all;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _showQuickRestockDialog(Product product) {
    final highestUnit = product.highestTierUnit;
    showDialog(
      context: context,
      builder: (ctx) {
        int cartonsToAdd = 1;
        return StatefulBuilder(
          builder: (context, setModalState) {
            final addedBaseUnits = cartonsToAdd * highestUnit.multiplier;
            final newTotalStock = product.currentStockBaseUnits + addedBaseUnits;

            return Dialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              backgroundColor: AppColors.surface,
              surfaceTintColor: Colors.transparent,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Padding(
                  padding: const EdgeInsets.all(22.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Header
                      Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: AppColors.primaryLight,
                              borderRadius: BorderRadius.circular(9),
                              border: Border.all(color: AppColors.primaryBorder, width: 0.9),
                            ),
                            child: const Icon(Icons.add_box_rounded, color: AppColors.primary, size: 20),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'ເພີ່ມສິນຄ້າເຂົ້າສາງ',
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                                ),
                                Text(
                                  product.name,
                                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: () => Navigator.of(ctx).pop(),
                            icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.textMuted),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Current stock card
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.backgroundAlt,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.borderSubtle, width: 0.9),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('ສາງປັດຈຸບັນ:', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                            Text(
                              product.compoundStockFormatted,
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      Text(
                        'ເພີ່ມຍົກ ${highestUnit.unitName} (1 ${highestUnit.unitName} = ${highestUnit.multiplier} ${product.baseUnit}):',
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 10),

                      // Stepper
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.borderSubtle, width: 0.9),
                          boxShadow: AppColors.cardShadow,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            IconButton(
                              onPressed: cartonsToAdd > 1
                                  ? () => setModalState(() => cartonsToAdd--)
                                  : null,
                              icon: const Icon(Icons.remove_circle_outline_rounded, size: 22),
                              color: AppColors.textSecondary,
                            ),
                            Text(
                              '$cartonsToAdd ${highestUnit.unitName}',
                              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                            ),
                            IconButton(
                              onPressed: () => setModalState(() => cartonsToAdd++),
                              icon: const Icon(Icons.add_circle_outline_rounded, size: 22),
                              color: AppColors.primary,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Quick pills
                      Wrap(
                        spacing: 8,
                        alignment: WrapAlignment.center,
                        children: [1, 5, 10, 20].map((count) {
                          final isSelected = cartonsToAdd == count;
                          return InkWell(
                            onTap: () => setModalState(() => cartonsToAdd = count),
                            borderRadius: BorderRadius.circular(8),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 140),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: isSelected ? AppColors.surfaceDark : AppColors.backgroundAlt,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: isSelected ? AppColors.surfaceDark : AppColors.borderSubtle,
                                  width: 0.9,
                                ),
                              ),
                              child: Text(
                                '+$count ${highestUnit.unitName}',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                                  color: isSelected ? Colors.white : AppColors.textPrimary,
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 16),

                      // New stock forecast
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFA7F3D0), width: 0.9),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('ສາງໃໝ່ຫຼັງເພີ່ມ:', style: TextStyle(fontSize: 12, color: Color(0xFF047857), fontWeight: FontWeight.w600)),
                            Text(
                              '$newTotalStock ${product.baseUnit}',
                              style: const TextStyle(color: Color(0xFF047857), fontWeight: FontWeight.w800, fontSize: 13.5),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Buttons
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          OutlinedButton(
                            onPressed: () => Navigator.of(ctx).pop(),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.textSecondary,
                              side: const BorderSide(color: AppColors.borderSubtle, width: 0.9),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            child: const Text(LaoStrings.cancel),
                          ),
                          const SizedBox(width: 10),
                          ElevatedButton(
                            onPressed: () {
                              ref.read(catalogProvider.notifier).quickRestock(product.id, addedBaseUnits);
                              Navigator.of(ctx).pop();
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('ເພີ່ມ $cartonsToAdd ${highestUnit.unitName} ເຂົ້າສາງສຳເລັດ!'),
                                  backgroundColor: AppColors.primary,
                                ),
                              );
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              elevation: 0,
                            ),
                            child: const Text('ຢືນຢັນການເພີ່ມ'),
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

  void _showQuickPriceDialog(Product product) {
    showDialog(
      context: context,
      builder: (ctx) {
        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          backgroundColor: AppColors.surface,
          surfaceTintColor: Colors.transparent,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Padding(
              padding: const EdgeInsets.all(22.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(9),
                          border: Border.all(color: AppColors.primaryBorder, width: 0.9),
                        ),
                        child: const Icon(Icons.price_change_rounded, color: AppColors.primary, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'ປັບລາຄາດ່ວນ',
                              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                            ),
                            Text(
                              product.name,
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: product.units.map((unit) {
                        final priceCtrl = TextEditingController(
                          text: LaoCurrencyFormatter.format(unit.retailPrice, includeSymbol: false),
                        );

                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12.0),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.backgroundAlt,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.borderSubtle, width: 0.9),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      unit.unitName,
                                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                                    ),
                                    if (unit.multiplier > 1) ...[
                                      const SizedBox(width: 6),
                                      Text(
                                        '(${unit.multiplier} ${product.baseUnit})',
                                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                      ),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 8),
                                TextField(
                                  controller: priceCtrl,
                                  keyboardType: TextInputType.number,
                                  inputFormatters: [LaoCurrencyInputFormatter()],
                                  style: const TextStyle(fontSize: 13),
                                  decoration: InputDecoration(
                                    isDense: true,
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                    labelText: 'ລາຄາຂາຍຕໍ່ 1 ${unit.unitName} (₭)',
                                    hintText: 'e.g. 70.000',
                                  ),
                                  onSubmitted: (val) {
                                    final parsed = LaoCurrencyFormatter.parse(val);
                                    ref.read(catalogProvider.notifier).quickAdjustPrice(
                                          product.id,
                                          unit.id,
                                          newRetailPrice: parsed,
                                          newWholesalePrice: parsed,
                                        );
                                  },
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: 8),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      ElevatedButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 10),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          elevation: 0,
                        ),
                        child: const Text('ສຳເລັດ'),
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
  }

  Widget _buildProductLeading(Product product) {
    final imageUrl = product.imageUrl;
    final isBeer = product.category.contains('ເບຍ') || product.category.contains('ເຫຼົ້າ');
    final isSnack = product.category.contains('ເຂົ້າໜົມ') || product.category.contains('ອາຫານ');

    if (imageUrl != null && imageUrl.isNotEmpty) {
      final isDataUri = ImageCompressService.isDataUri(imageUrl);
      return Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: AppColors.backgroundAlt,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.borderSubtle, width: 0.9),
          boxShadow: AppColors.cardShadow,
        ),
        clipBehavior: Clip.antiAlias,
        child: isDataUri
            ? Image.memory(
                ImageCompressService.bytesFromDataUri(imageUrl) ?? Uint8List(0),
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _buildFallbackTile(isBeer, isSnack),
              )
            : Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _buildFallbackTile(isBeer, isSnack),
              ),
      );
    }

    return _buildFallbackTile(isBeer, isSnack);
  }

  Widget _buildFallbackTile(bool isBeer, bool isSnack) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: AppColors.backgroundAlt,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.borderSubtle, width: 0.9),
      ),
      child: Center(
        child: Icon(
          isBeer
              ? Icons.sports_bar_outlined
              : (isSnack ? Icons.cookie_outlined : Icons.inventory_2_outlined),
          size: 19,
          color: isBeer ? const Color(0xFFB45309) : AppColors.textSecondary,
        ),
      ),
    );
  }

  Widget _buildHeaderCell(IconData icon, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.textMuted),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 12,
            color: AppColors.textSecondary,
            letterSpacing: 0.2,
          ),
        ),
      ],
    );
  }

  void _confirmDeleteProduct(Product product) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('ຢືນຢັນການລຶບສິນຄ້າ', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Text(
          'ທ່ານຕ້ອງການລຶບ "${product.name}" ອອກຈາກລະບົບ ແລະ Supabase ແທ້ບໍ່?',
          style: const TextStyle(height: 1.45),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text(LaoStrings.cancel),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () {
              ref.read(catalogProvider.notifier).deleteProduct(product.id);
              Navigator.of(ctx).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('ລຶບ "${product.name}" ສຳເລັດແລ້ວ!'),
                  backgroundColor: AppColors.error,
                ),
              );
            },
            child: const Text('ລຶບສິນຄ້າ'),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
    String? subtitle,
    double? fixedWidth,
  }) {
    final cardContent = Container(
      width: fixedWidth,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderSubtle, width: 0.9),
        boxShadow: AppColors.cardShadow,
      ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: color.withValues(alpha: 0.2), width: 0.8),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 1),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w500,
                        color: color,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      );

    return fixedWidth != null ? cardContent : Expanded(child: cardContent);
  }

  Widget _buildStockFilterChip(String label, StockStatusFilter filter, int count, Color color) {
    final isSelected = _stockFilter == filter;
    return InkWell(
      onTap: () => setState(() => _stockFilter = filter),
      borderRadius: BorderRadius.circular(8),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.surfaceDark : AppColors.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? AppColors.surfaceDark : AppColors.borderSubtle,
            width: 0.9,
          ),
          boxShadow: isSelected ? AppColors.cardShadow : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                color: isSelected ? Colors.white : AppColors.textSecondary,
              ),
            ),
            const SizedBox(width: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: isSelected ? Colors.white.withValues(alpha: 0.2) : AppColors.backgroundAlt,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: isSelected ? Colors.white : color,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final catalogState = ref.watch(catalogProvider);
    final all = catalogState.allProducts;

    // Calculate real-time inventory metrics
    final totalSkus = all.length;
    int totalInventoryValue = 0;
    int lowStockCount = 0;
    int outOfStockCount = 0;
    int inStockCount = 0;

    for (final p in all) {
      if (p.trackStock) {
        totalInventoryValue += (p.currentStockBaseUnits * p.costPerBaseUnit);
        if (p.currentStockBaseUnits <= 0) {
          outOfStockCount++;
        } else if (p.currentStockBaseUnits <= (p.highestTierUnit.multiplier * 2)) {
          lowStockCount++;
          inStockCount++;
        } else {
          inStockCount++;
        }
      } else {
        inStockCount++;
      }
    }

    final filtered = all.where((p) {
      final matchesCat = _selectedCategory == 'ທັງໝົດ' || p.category == _selectedCategory;
      if (!matchesCat) return false;

      // Stock status filter
      if (_stockFilter == StockStatusFilter.inStock) {
        if (p.trackStock && p.currentStockBaseUnits <= 0) return false;
      } else if (_stockFilter == StockStatusFilter.lowStock) {
        final isLow = p.trackStock &&
            p.currentStockBaseUnits > 0 &&
            p.currentStockBaseUnits <= (p.highestTierUnit.multiplier * 2);
        if (!isLow) return false;
      } else if (_stockFilter == StockStatusFilter.outOfStock) {
        if (!p.trackStock || p.currentStockBaseUnits > 0) return false;
      }

      final query = _searchController.text.trim().toLowerCase();
      if (query.isEmpty) return true;

      final nameMatch = p.name.toLowerCase().contains(query);
      final barcodeMatch = p.barcode?.toLowerCase().contains(query) ?? false;
      final unitBarcodeMatch =
          p.units.any((u) => u.barcode?.toLowerCase().contains(query) ?? false);
      return nameMatch || barcodeMatch || unitBarcodeMatch;
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: 18,
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: AppColors.primaryBorder, width: 0.9),
              ),
              child: const Icon(Icons.inventory_2_rounded, color: AppColors.primary, size: 19),
            ),
            const SizedBox(width: 10),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'ລະບົບສາງ & ລາຍການສິນຄ້າ',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: AppColors.textPrimary,
                  ),
                ),
                Text(
                  'Catalog & Inventory Management',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.backgroundAlt,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.borderSubtle, width: 0.9),
            ),
            child: IconButton(
              onPressed: () async {
                await ref.read(catalogProvider.notifier).fetchFromSupabase();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('ອັບເດດລາຍການສິນຄ້າຈາກ Supabase Cloud ສຳເລັດແລ້ວ!'),
                      backgroundColor: AppColors.primary,
                    ),
                  );
                }
              },
              icon: const Icon(Icons.sync_rounded, size: 18, color: AppColors.textSecondary),
              tooltip: 'ດຶງຂໍ້ມູນສິນຄ້າຈາກ Supabase Cloud',
            ),
          ),
          const SizedBox(width: 10),
          Padding(
            padding: const EdgeInsets.only(right: 18.0),
            child: ElevatedButton.icon(
              onPressed: () {
                if (widget.onOpenAddProduct != null) {
                  widget.onOpenAddProduct!();
                } else {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (ctx) => const ProductFormScreen(),
                    ),
                  );
                }
              },
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('ເພີ່ມສິນຄ້າໃໝ່'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // 1. KPI Metric Summary Header (Scrollable horizontally on compact mobile)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            color: AppColors.surface,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildKpiCard(
                    title: 'ສິນຄ້າທັງໝົດ (SKUs)',
                    value: '$totalSkus ລາຍການ',
                    icon: Icons.grid_view_rounded,
                    color: AppColors.primary,
                    subtitle: '${catalogState.categories.length} ໝວດໝູ່',
                    fixedWidth: 200,
                  ),
                  const SizedBox(width: 10),
                  _buildKpiCard(
                    title: 'ມູນຄ່າສາງລວມ (Inventory Value)',
                    value: LaoCurrencyFormatter.format(totalInventoryValue),
                    icon: Icons.account_balance_wallet_rounded,
                    color: const Color(0xFF047857),
                    subtitle: 'ອີງຕາມຕົ້ນທຶນຊື້',
                    fixedWidth: 220,
                  ),
                  const SizedBox(width: 10),
                  _buildKpiCard(
                    title: 'ໃກ້ໝົດສາງ (Low Stock)',
                    value: '$lowStockCount ລາຍການ',
                    icon: Icons.warning_amber_rounded,
                    color: const Color(0xFFD97706),
                    subtitle: 'ເຫຼືອຕ່ຳກວ່າ 2 ແກັດ',
                    fixedWidth: 190,
                  ),
                  const SizedBox(width: 10),
                  _buildKpiCard(
                    title: 'ໝົດສາງ (Out of Stock)',
                    value: '$outOfStockCount ລາຍການ',
                    icon: Icons.remove_circle_outline_rounded,
                    color: AppColors.error,
                    subtitle: 'ຕ້ອງການສັ່ງຊື້ດ່ວນ',
                    fixedWidth: 190,
                  ),
                ],
              ),
            ),
          ),

          const Divider(height: 1, color: AppColors.borderSubtle),

          // 2. Filter & Search Bar with Stock Status Pills (Scrollable horizontally)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            color: AppColors.surface,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  // Search Input
                  SizedBox(
                    width: 260,
                    height: 38,
                    child: TextField(
                      controller: _searchController,
                      style: const TextStyle(fontSize: 13),
                      decoration: InputDecoration(
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                        hintText: 'ຄົ້ນຫາຊື່ສິນຄ້າ, ບາໂຄດ...',
                        prefixIcon: const Icon(Icons.search_rounded, size: 18, color: AppColors.textMuted),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear_rounded, size: 16),
                                onPressed: () => setState(() => _searchController.clear()),
                              )
                            : null,
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  const SizedBox(width: 10),

                  // Category Dropdown
                  SizedBox(
                    width: 180,
                    height: 38,
                    child: DropdownButtonFormField<String>(
                      value: _selectedCategory,
                      isDense: true,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.surfaceDark,
                        fontWeight: FontWeight.w600,
                      ),
                      decoration: const InputDecoration(
                        contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        prefixIcon: Icon(Icons.filter_list_rounded, size: 16, color: AppColors.textMuted),
                      ),
                      items: catalogState.categories.map((cat) {
                        return DropdownMenuItem(
                          value: cat,
                          child: Text(cat, maxLines: 1, overflow: TextOverflow.ellipsis),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) setState(() => _selectedCategory = val);
                      },
                    ),
                  ),
                  const SizedBox(width: 10),

                  // Stock Status Pills
                  Row(
                    children: [
                      _buildStockFilterChip('ທັງໝົດ', StockStatusFilter.all, totalSkus, AppColors.primary),
                      const SizedBox(width: 6),
                      _buildStockFilterChip('ມີສິນຄ້າ', StockStatusFilter.inStock, inStockCount, const Color(0xFF047857)),
                      const SizedBox(width: 6),
                      _buildStockFilterChip('ໃກ້ໝົດ', StockStatusFilter.lowStock, lowStockCount, const Color(0xFFD97706)),
                      const SizedBox(width: 6),
                      _buildStockFilterChip('ໝົດສາງ', StockStatusFilter.outOfStock, outOfStockCount, AppColors.error),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const Divider(height: 1, color: AppColors.borderSubtle),

          // High-speed Full-width Modern Data Table
          Expanded(
            child: filtered.isEmpty
                ? const Center(
                    child: Text(
                      'ບໍ່ພົບສິນຄ້າທີ່ຄົ້ນຫາ',
                      style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                    ),
                  )
                : LayoutBuilder(
                    builder: (context, constraints) {
                      final tableWidth =
                          constraints.maxWidth < 1180 ? 1180.0 : constraints.maxWidth;
                      return SingleChildScrollView(
                        scrollDirection: Axis.vertical,
                        padding: const EdgeInsets.all(16),
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          padding: EdgeInsets.zero,
                          child: Container(
                            width: tableWidth - 32,
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.borderSubtle, width: 0.9),
                              boxShadow: AppColors.cardShadow,
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: DataTable(
                              columnSpacing: 22,
                              horizontalMargin: 20,
                              headingRowHeight: 48,
                              dataRowMinHeight: 64,
                              dataRowMaxHeight: 76,
                              headingRowColor: WidgetStateProperty.all(
                                AppColors.backgroundAlt,
                              ),
                              border: const TableBorder(
                                horizontalInside: BorderSide(
                                  color: AppColors.borderSubtle,
                                  width: 0.9,
                                ),
                              ),
                              columns: [
                                DataColumn(
                                  label: _buildHeaderCell(
                                    Icons.inventory_2_outlined,
                                    'ຊື່ສິນຄ້າ (Product Name)',
                                  ),
                                ),
                                DataColumn(
                                  label: _buildHeaderCell(
                                    Icons.category_outlined,
                                    'ໝວດໝູ່',
                                  ),
                                ),
                                DataColumn(
                                  label: _buildHeaderCell(
                                    Icons.layers_outlined,
                                    'ສາງປັດຈຸບັນ (Stock)',
                                  ),
                                ),
                                DataColumn(
                                  label: _buildHeaderCell(
                                    Icons.sell_outlined,
                                    'ລາຄາຂາຍ (Selling Price)',
                                  ),
                                ),
                                DataColumn(
                                  label: _buildHeaderCell(
                                    Icons.all_inbox_rounded,
                                    'ຕົ້ນທຶນຍົກແກັດ (Carton Cost)',
                                  ),
                                ),
                                DataColumn(
                                  label: _buildHeaderCell(
                                    Icons.payments_outlined,
                                    'ຕົ້ນທຶນຍ່ອຍ (Unit Cost)',
                                  ),
                                ),
                                DataColumn(
                                  label: _buildHeaderCell(
                                    Icons.tune_rounded,
                                    'ຈັດການດ່ວນ (Quick Actions)',
                                  ),
                                ),
                              ],
                              rows: filtered.map((product) {
                                final subUnit = product.subTierUnit;
                                final cartonUnit = product.cartonTierUnit;
                                final isSingleTier = product.units.length <= 1;

                                final bool hasCartonTier = cartonUnit.multiplier > 1 ||
                                    cartonUnit.unitName.contains('ແກັດ') ||
                                    cartonUnit.unitName.contains('ລັງ') ||
                                    product.category.contains('ເບຍ') ||
                                    product.category.contains('ເຫຼົ້າ');

                                final int cartonCost = cartonUnit.multiplier > 1
                                    ? cartonUnit.costForUnit(product.costPerBaseUnit)
                                    : product.costPerBaseUnit;

                                final int unitProfit =
                                    subUnit.retailPrice - product.costPerBaseUnit;

                                return DataRow(
                                  cells: [
                                    // 1. Product Name & Barcode
                                    DataCell(
                                      Padding(
                                        padding: const EdgeInsets.symmetric(vertical: 6),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            _buildProductLeading(product),
                                            const SizedBox(width: 10),
                                            ConstrainedBox(
                                              constraints: const BoxConstraints(maxWidth: 220),
                                              child: Column(
                                                mainAxisAlignment:
                                                    MainAxisAlignment.center,
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    product.name,
                                                    style: const TextStyle(
                                                      fontWeight: FontWeight.w700,
                                                      fontSize: 13.5,
                                                      color: AppColors.surfaceDark,
                                                      height: 1.3,
                                                    ),
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                  const SizedBox(height: 3),
                                                  if (product.barcode != null &&
                                                      product.barcode!.isNotEmpty)
                                                    Container(
                                                      padding: const EdgeInsets.symmetric(
                                                        horizontal: 6,
                                                        vertical: 1.5,
                                                      ),
                                                      decoration: BoxDecoration(
                                                        color: AppColors.backgroundAlt,
                                                        borderRadius:
                                                            BorderRadius.circular(4),
                                                        border: Border.all(
                                                          color: AppColors.borderSubtle,
                                                          width: 0.8,
                                                        ),
                                                      ),
                                                      child: Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: [
                                                          const Icon(
                                                            Icons.qr_code_2_rounded,
                                                            size: 11,
                                                            color: AppColors.textMuted,
                                                          ),
                                                          const SizedBox(width: 4),
                                                          Text(
                                                            product.barcode!,
                                                            style: const TextStyle(
                                                              fontSize: 10.5,
                                                              fontFamily: 'monospace',
                                                              fontWeight: FontWeight.w600,
                                                              color: AppColors.textSecondary,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    DataCell(
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 3.5,
                                        ),
                                        decoration: BoxDecoration(
                                          color: AppColors.backgroundAlt,
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: AppColors.borderSubtle, width: 0.8),
                                        ),
                                        child: Text(
                                          product.category,
                                          style: const TextStyle(
                                            fontSize: 11.5,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.textSecondary,
                                          ),
                                        ),
                                      ),
                                    ),
                                    DataCell(
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: product.currentStockBaseUnits <= 0
                                              ? AppColors.errorLight.withValues(alpha: 0.5)
                                              : const Color(0xFFECFDF5),
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(
                                            color: product.currentStockBaseUnits <= 0
                                                ? AppColors.error.withValues(alpha: 0.3)
                                                : const Color(0xFFA7F3D0),
                                            width: 0.8,
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Container(
                                              width: 6,
                                              height: 6,
                                              decoration: BoxDecoration(
                                                shape: BoxShape.circle,
                                                color: product.currentStockBaseUnits <= 0
                                                    ? AppColors.error
                                                    : const Color(0xFF059669),
                                              ),
                                            ),
                                            const SizedBox(width: 5),
                                            Text(
                                              product.compoundStockFormatted,
                                              style: TextStyle(
                                                fontWeight: FontWeight.w700,
                                                fontSize: 12,
                                                color: product.currentStockBaseUnits <= 0
                                                    ? AppColors.error
                                                    : const Color(0xFF047857),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    // 4. Selling Price
                                    DataCell(
                                      Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          if (isSingleTier) ...[
                                            Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Text(
                                                  '${subUnit.unitName}: ',
                                                  style: const TextStyle(
                                                    fontSize: 11.5,
                                                    color: AppColors.textSecondary,
                                                    fontWeight: FontWeight.w500,
                                                  ),
                                                ),
                                                Text(
                                                  LaoCurrencyFormatter.format(
                                                    subUnit.retailPrice,
                                                  ),
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    color: AppColors.surfaceDark,
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ] else ...[
                                            Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Text(
                                                  '${subUnit.unitName}: ',
                                                  style: const TextStyle(
                                                    fontSize: 11.5,
                                                    color: AppColors.textSecondary,
                                                    fontWeight: FontWeight.w500,
                                                  ),
                                                ),
                                                Text(
                                                  LaoCurrencyFormatter.format(
                                                    subUnit.retailPrice,
                                                  ),
                                                  style: const TextStyle(
                                                    fontSize: 12.5,
                                                    color: AppColors.surfaceDark,
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 2),
                                            Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Text(
                                                  '${cartonUnit.unitName}: ',
                                                  style: const TextStyle(
                                                    fontSize: 11,
                                                    color: Color(0xFFB45309),
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                ),
                                                Text(
                                                  LaoCurrencyFormatter.format(
                                                    cartonUnit.retailPrice,
                                                  ),
                                                  style: const TextStyle(
                                                    fontSize: 12,
                                                    color: Color(0xFFB45309),
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),

                                    // 5. Carton Cost (Giá nhập nguyên thùng)
                                    DataCell(
                                      Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          if (hasCartonTier) ...[
                                            Text(
                                              LaoCurrencyFormatter.format(cartonCost),
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w800,
                                                fontSize: 13.5,
                                                color: AppColors.surfaceDark,
                                                letterSpacing: -0.2,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Container(
                                              padding: const EdgeInsets.symmetric(
                                                horizontal: 5,
                                                vertical: 1,
                                              ),
                                              decoration: BoxDecoration(
                                                color: AppColors.backgroundAlt,
                                                borderRadius: BorderRadius.circular(4),
                                                border: Border.all(
                                                  color: AppColors.borderSubtle,
                                                  width: 0.8,
                                                ),
                                              ),
                                              child: Text(
                                                cartonUnit.multiplier > 1
                                                    ? 'ຍົກ${cartonUnit.unitName} (${cartonUnit.multiplier} ${subUnit.unitName})'
                                                    : 'ຍົກ${cartonUnit.unitName}',
                                                style: const TextStyle(
                                                  fontSize: 10.5,
                                                  fontWeight: FontWeight.w600,
                                                  color: AppColors.textSecondary,
                                                ),
                                              ),
                                            ),
                                          ] else ...[
                                            const Text(
                                              '-',
                                              style: TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w600,
                                                color: AppColors.textMuted,
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),

                                    // 6. Unit Cost (Giá nhập lẻ)
                                    DataCell(
                                      Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            LaoCurrencyFormatter.format(
                                              product.costPerBaseUnit,
                                            ),
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                              fontSize: 12.5,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Text(
                                                'ຕໍ່ 1 ${subUnit.unitName}',
                                                style: const TextStyle(
                                                  fontSize: 10.5,
                                                  color: AppColors.textSecondary,
                                                ),
                                              ),
                                              if (unitProfit > 0) ...[
                                                const SizedBox(width: 4),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(
                                                    horizontal: 4,
                                                    vertical: 1,
                                                  ),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFFECFDF5),
                                                    borderRadius:
                                                        BorderRadius.circular(4),
                                                  ),
                                                  child: Text(
                                                    '+${LaoCurrencyFormatter.format(unitProfit)}',
                                                    style: const TextStyle(
                                                      fontSize: 9.5,
                                                      fontWeight: FontWeight.w700,
                                                      color: Color(0xFF047857),
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                    DataCell(
                                      Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          // Quick Restock Button (+1 ແກັດ)
                                          OutlinedButton.icon(
                                            onPressed: () =>
                                                _showQuickRestockDialog(product),
                                            icon: const Icon(
                                              Icons.add_box_rounded,
                                              size: 14,
                                            ),
                                            label: Text('+${cartonUnit.unitName}'),
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor: AppColors.textSecondary,
                                              side: const BorderSide(color: AppColors.borderSubtle, width: 0.9),
                                              padding: const EdgeInsets.symmetric(
                                                horizontal: 8,
                                                vertical: 4,
                                              ),
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
                                            ),
                                          ),
                                          const SizedBox(width: 4),
                                          // Quick Price Edit Button
                                          IconButton(
                                            icon: const Icon(
                                              Icons.price_change_rounded,
                                              size: 19,
                                              color: AppColors.textSecondary,
                                            ),
                                            tooltip: 'ປັບລາຄາດ່ວນ',
                                            splashRadius: 18,
                                            onPressed: () =>
                                                _showQuickPriceDialog(product),
                                          ),
                                          // Full Edit Button
                                          IconButton(
                                            icon: const Icon(
                                              Icons.edit_rounded,
                                              size: 19,
                                              color: AppColors.primary,
                                            ),
                                            tooltip: 'ແກ້ໄຂສິນຄ້າເຕັມຮູບແບບ',
                                            splashRadius: 18,
                                            onPressed: () {
                                              Navigator.of(context).push(
                                                MaterialPageRoute(
                                                  builder: (ctx) =>
                                                      ProductFormScreen(
                                                    productToEdit: product,
                                                  ),
                                                ),
                                              );
                                            },
                                          ),
                                          // Delete Button
                                          IconButton(
                                            icon: const Icon(
                                              Icons.delete_outline_rounded,
                                              size: 19,
                                              color: AppColors.error,
                                            ),
                                            tooltip: 'ລຶບສິນຄ້າ',
                                            splashRadius: 18,
                                            onPressed: () =>
                                                _confirmDeleteProduct(product),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                );
                              }).toList(),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
