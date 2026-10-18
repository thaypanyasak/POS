import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/localization/lo.dart';
import '../../../../domain/models/product.dart';
import '../controllers/cart_controller.dart';
import '../controllers/catalog_controller.dart';
import '../controllers/printer_controller.dart';
import '../../../common/widgets/exchange_rate_chip.dart';
import 'barcode_scanner_modal.dart';
import 'product_card.dart';
import 'unit_selector_modal.dart';

/// Left 65% Dock: Category Tabs, Search & Barcode Scan Listener, High-density Product Grid
class CatalogDock extends ConsumerStatefulWidget {
  const CatalogDock({super.key});

  @override
  ConsumerState<CatalogDock> createState() => _CatalogDockState();
}

class _CatalogDockState extends ConsumerState<CatalogDock> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _openBarcodeScanner() {
    showDialog(
      context: context,
      builder: (ctx) => const BarcodeScannerModal(),
    );
  }

  void _handleBarcodeSubmission(String text) {
    final match = ref.read(catalogProvider.notifier).findProductByBarcode(text);
    if (match != null) {
      final product = match.product;
      final unit = match.unit;

      ref.read(cartProvider.notifier).addProduct(
            product,
            unit: unit,
            quantity: 1,
          );

      _searchController.clear();
      ref.read(catalogProvider.notifier).clearSearch();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('ຍິງບາໂຄດສຳເລັດ: ${product.name} (${unit.unitName})'),
          duration: const Duration(seconds: 1),
          backgroundColor: AppColors.primary,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('ບໍ່ພົບສິນຄ້າທີ່ມີບາໂຄດ: "$text"'),
          duration: const Duration(seconds: 2),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  void _openUnitSelector(Product product, bool isWholesale) {
    showDialog(
      context: context,
      builder: (ctx) => UnitSelectorModal(
        product: product,
        isWholesaleMode: isWholesale,
        onConfirm: (unit, quantity) {
          ref.read(cartProvider.notifier).addProduct(
                product,
                unit: unit,
                quantity: quantity,
              );
        },
      ),
    );
  }

  void _showPrinterSettingsDialog() {
    final printerState = ref.read(printerProvider);
    final ipController = TextEditingController(text: printerState.config.ipAddress);
    bool isSim = printerState.config.isSimulationMode;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return AlertDialog(
            title: const Text('ຕັ້ງຄ່າເຄື່ອງພິມ ESC/POS (Port 9100)'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: ipController,
                  decoration: const InputDecoration(
                    labelText: 'Printer IP Address',
                    hintText: '192.168.1.200',
                  ),
                ),
                const SizedBox(height: 16),
                SwitchListTile(
                  title: const Text('Simulation Mode (ທົດສອບໂດຍບໍ່ມີເຄື່ອງ)'),
                  value: isSim,
                  onChanged: (val) {
                    setModalState(() => isSim = val);
                  },
                ),
              ],
            ),
            actions: [
              AppButton(
                label: LaoStrings.cancel,
                variant: AppButtonVariant.ghost,
                height: 38,
                onPressed: () => Navigator.of(ctx).pop(),
              ),
              AppButton(
                label: LaoStrings.save,
                variant: AppButtonVariant.primary,
                height: 38,
                icon: PhosphorIconsBold.floppyDisk,
                onPressed: () {
                  ref.read(printerProvider.notifier).updatePrinterIp(ipController.text);
                  ref.read(printerProvider.notifier).toggleSimulation(isSim);
                  Navigator.of(ctx).pop();
                },
              ),
            ],
          );
        },
      ),
    );
  }

  void _showAddCategoryDialog() {
    final textController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Row(
            children: [
              PhosphorIcon(PhosphorIconsBold.tag, color: AppColors.primary),
              SizedBox(width: 8),
              Text('ເພີ່ມໝວດໝູ່ສິນຄ້າໃໝ່'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'ປ້ອນຊື່ໝວດໝູ່ສິນຄ້າໃໝ່ທີ່ຕ້ອງການເພີ່ມ:',
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: textController,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'ຊື່ໝວດໝູ່ (Category Name)',
                  hintText: 'e.g. ຢາສູບ, ໝາກໄມ້, ອາຫານແຊ່ແຂງ...',
                ),
                onSubmitted: (val) {
                  final catName = val.trim();
                  if (catName.isNotEmpty) {
                    ref.read(catalogProvider.notifier).addCategory(catName);
                    Navigator.of(ctx).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('ເພີ່ມໝວດໝູ່ "$catName" ສຳເລັດແລ້ວ!'),
                        backgroundColor: AppColors.primary,
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  }
                },
              ),
              const SizedBox(height: 14),
              const Text(
                'ຕົວຢ່າງໝວດໝູ່ແນະນຳ:',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: ['ຢາສູບ', 'ໝາກໄມ້/ຜັກ', 'ອາຫານແຊ່ແຂງ', 'ເຄື່ອງຄົວ', 'ເຄື່ອງໃຊ້ສ່ວນຕົວ'].map((cat) {
                  return ActionChip(
                    label: Text(cat, style: const TextStyle(fontSize: 11)),
                    backgroundColor: AppColors.surfaceSubtle,
                    onPressed: () {
                      textController.text = cat;
                    },
                  );
                }).toList(),
              ),
            ],
          ),
          actions: [
            AppButton(
              label: LaoStrings.cancel,
              variant: AppButtonVariant.ghost,
              height: 38,
              onPressed: () => Navigator.of(ctx).pop(),
            ),
            AppButton(
              label: 'ເພີ່ມໝວດໝູ່',
              variant: AppButtonVariant.primary,
              height: 38,
              icon: PhosphorIconsBold.plus,
              onPressed: () {
                final catName = textController.text.trim();
                if (catName.isNotEmpty) {
                  ref.read(catalogProvider.notifier).addCategory(catName);
                  Navigator.of(ctx).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('ເພີ່ມໝວດໝູ່ "$catName" ສຳເລັດແລ້ວ!'),
                      backgroundColor: AppColors.primary,
                      duration: const Duration(seconds: 2),
                    ),
                  );
                }
              },
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final catalogState = ref.watch(catalogProvider);
    final cartState = ref.watch(cartProvider);
    final screenSize = MediaQuery.of(context).size;
    final isCompactLandscape = screenSize.height < 500;

    return Container(
      color: AppColors.background,
      child: Column(
        children: [
          // Top Control Bar: Search input with Camera Barcode Scanner & Category Filters (Matching Web POS)
          LayoutBuilder(
            builder: (context, constraints) {
              final availableWidth = constraints.maxWidth;
              final isNarrow = availableWidth < 500;
              final inputHeight = isCompactLandscape ? 36.0 : (isNarrow ? 38.0 : 42.0);
              final chipsHeight = isCompactLandscape ? 30.0 : (isNarrow ? 32.0 : 36.0);

              return Container(
                padding: EdgeInsets.fromLTRB(
                  isNarrow ? 8 : (isCompactLandscape ? 10 : 14),
                  isCompactLandscape ? 5 : 8,
                  isNarrow ? 8 : (isCompactLandscape ? 10 : 14),
                  isCompactLandscape ? 5 : 8,
                ),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1.0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Top Search Row (with Camera Barcode Scanner INSIDE input, Sync Cloud, Printer Config)
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            height: inputHeight,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFCBD5E1), width: 1.0),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                const SizedBox(width: 14),
                                const PhosphorIcon(
                                  PhosphorIconsBold.magnifyingGlass,
                                  color: Color(0xFF64748B),
                                  size: 19,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: TextField(
                                    controller: _searchController,
                                    focusNode: _searchFocusNode,
                                    cursorColor: const Color(0xFF0F766E),
                                    style: TextStyle(
                                      fontSize: isNarrow ? 12.0 : 13.0,
                                      fontWeight: FontWeight.w600,
                                      color: const Color(0xFF0F172A),
                                    ),
                                    decoration: InputDecoration(
                                      isDense: true,
                                      border: InputBorder.none,
                                      focusedBorder: InputBorder.none,
                                      enabledBorder: InputBorder.none,
                                      errorBorder: InputBorder.none,
                                      disabledBorder: InputBorder.none,
                                      contentPadding: const EdgeInsets.only(left: 8, right: 8, top: 8, bottom: 8),
                                      hintText: isNarrow ? 'ຄົ້ນຫາສິນຄ້າ ຫຼື ບາໂຄດ...' : 'ຄົ້ນຫາຊື່ສິນຄ້າ ຫຼື ສະແກນບາໂຄດ...',
                                      hintStyle: TextStyle(
                                        fontSize: isNarrow ? 11.0 : 12.0,
                                        color: const Color(0xFF94A3B8),
                                      ),
                                    ),
                                    onChanged: (val) {
                                      ref.read(catalogProvider.notifier).setSearchQuery(val);
                                    },
                                    onSubmitted: _handleBarcodeSubmission,
                                  ),
                                ),
                                if (_searchController.text.isNotEmpty)
                                  IconButton(
                                    icon: const PhosphorIcon(PhosphorIconsBold.x, size: 14, color: Color(0xFF94A3B8)),
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
                                    onPressed: () {
                                      _searchController.clear();
                                      ref.read(catalogProvider.notifier).clearSearch();
                                    },
                                  ),

                                // Compact Camera Barcode Scanner Button INSIDE input on right edge
                                Padding(
                                  padding: const EdgeInsets.only(right: 5.0),
                                  child: InkWell(
                                    onTap: _openBarcodeScanner,
                                    borderRadius: BorderRadius.circular(7),
                                    child: Container(
                                      padding: EdgeInsets.symmetric(
                                        horizontal: isNarrow ? 7 : 9,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF0FDFA),
                                        borderRadius: BorderRadius.circular(7),
                                        border: Border.all(color: const Color(0xFF99F6E4), width: 1.0),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const PhosphorIcon(PhosphorIconsBold.barcode, size: 14, color: Color(0xFF0F766E)),
                                          if (!isNarrow) ...[
                                            const SizedBox(width: 4),
                                            const Text(
                                              'SCAN',
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w900,
                                                color: Color(0xFF0F766E),
                                                letterSpacing: 0.3,
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),

                        // Supabase Sync Button
                        IconButton(
                          onPressed: () async {
                            await ref.read(catalogProvider.notifier).fetchFromSupabase();
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('ອັບເດດລາຍການສິນຄ້າຈາກ Supabase Cloud ສຳເລັດ!'),
                                  backgroundColor: Color(0xFF0F766E),
                                  duration: Duration(seconds: 1),
                                ),
                              );
                            }
                          },
                          icon: const PhosphorIcon(PhosphorIconsBold.arrowsClockwise, color: Color(0xFF475569), size: 18),
                          tooltip: 'ດຶງຂໍ້ມູນສິນຄ້າຈາກ Supabase Cloud',
                          padding: EdgeInsets.all(isNarrow ? 6 : 8),
                          constraints: BoxConstraints(minWidth: isNarrow ? 34 : 38, minHeight: isNarrow ? 34 : 38),
                          style: IconButton.styleFrom(
                            backgroundColor: const Color(0xFFF8FAFC),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                              side: const BorderSide(color: Color(0xFFE2E8F0)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 4),

                        // Printer Settings Button
                        IconButton(
                          onPressed: _showPrinterSettingsDialog,
                          icon: const PhosphorIcon(PhosphorIconsBold.printer, color: Color(0xFF475569), size: 18),
                          tooltip: 'ຕັ້ງຄ່າເຄື່ອງພິມ',
                          padding: EdgeInsets.all(isNarrow ? 6 : 8),
                          constraints: BoxConstraints(minWidth: isNarrow ? 34 : 38, minHeight: isNarrow ? 34 : 38),
                          style: IconButton.styleFrom(
                            backgroundColor: const Color(0xFFF8FAFC),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                              side: const BorderSide(color: Color(0xFFE2E8F0)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),

                        // Point-in-Time Exchange Rate Badge
                        ExchangeRateChip(compact: isNarrow || isCompactLandscape),
                      ],
                    ),

                    SizedBox(height: isCompactLandscape ? 5 : 7),

                    // Category Chips Bar (Smooth horizontal sliding with BouncingScrollPhysics)
                    SizedBox(
                      height: chipsHeight,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(),
                        padding: const EdgeInsets.symmetric(horizontal: 1),
                        itemCount: catalogState.categories.length + 1,
                        itemBuilder: (context, index) {
                          // Add Category Button
                          if (index == catalogState.categories.length) {
                            return Padding(
                              padding: const EdgeInsets.only(right: 5.0),
                              child: InkWell(
                                onTap: _showAddCategoryDialog,
                                borderRadius: BorderRadius.circular(7),
                                child: Container(
                                  alignment: Alignment.center,
                                  padding: EdgeInsets.symmetric(
                                    horizontal: isNarrow ? 8 : 10,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF0FDFA),
                                    borderRadius: BorderRadius.circular(7),
                                    border: Border.all(color: const Color(0xFF99F6E4), width: 1.0),
                                  ),
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.center,
                                    children: [
                                      PhosphorIcon(PhosphorIconsBold.plus, size: 13, color: Color(0xFF0F766E)),
                                      SizedBox(width: 3),
                                      Text(
                                        'ເພີ່ມໝວດໝູ່',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF0F766E),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }

                          final category = catalogState.categories[index];
                          final isSelected = category == catalogState.selectedCategory;

                          return Padding(
                            padding: const EdgeInsets.only(right: 5.0),
                            child: InkWell(
                              onTap: () => ref.read(catalogProvider.notifier).selectCategory(category),
                              borderRadius: BorderRadius.circular(7),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 150),
                                alignment: Alignment.center,
                                padding: EdgeInsets.symmetric(
                                  horizontal: isNarrow ? 10 : 13,
                                ),
                                decoration: BoxDecoration(
                                  color: isSelected ? const Color(0xFF0F766E) : const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(7),
                                  border: Border.all(
                                    color: isSelected ? const Color(0xFF0F766E) : const Color(0xFFCBD5E1),
                                    width: 1.0,
                                  ),
                                  boxShadow: isSelected
                                      ? const [
                                          BoxShadow(
                                            color: Color(0x260F766E),
                                            offset: Offset(0, 1),
                                            blurRadius: 2,
                                          ),
                                        ]
                                      : null,
                                ),
                                child: Center(
                                  child: Text(
                                    category,
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: isNarrow ? 11.0 : 11.5,
                                      fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                      color: isSelected ? Colors.white : const Color(0xFF475569),
                                    ),
                                  ),
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
            },
          ),

          SizedBox(height: isCompactLandscape ? 4 : 6),

          // High-density Product Grid (Ultra-compact for iPad/Tablet Landscape)
          Expanded(
            child: catalogState.filteredProducts.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const PhosphorIcon(PhosphorIconsBold.package, size: 48, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        Text(
                          LaoStrings.productNotFound,
                          style: theme.textTheme.titleMedium?.copyWith(color: AppColors.textMuted),
                        ),
                        const SizedBox(height: 8),
                        TextButton.icon(
                          onPressed: () => ref.read(catalogProvider.notifier).fetchFromSupabase(),
                          icon: const PhosphorIcon(PhosphorIconsBold.arrowsClockwise, size: 16),
                          label: const Text('ກວດສອບຂໍ້ມູນຈາກ Supabase Cloud'),
                        ),
                      ],
                    ),
                  )
                : LayoutBuilder(
                    builder: (context, constraints) {
                      final width = constraints.maxWidth;
                      final int crossAxisCount;
                      final double childAspectRatio;

                      if (width > 950) {
                        crossAxisCount = 5;
                        childAspectRatio = isCompactLandscape ? 0.92 : 0.82;
                      } else if (width > 650) {
                        crossAxisCount = 4;
                        childAspectRatio = isCompactLandscape ? 0.90 : 0.80;
                      } else if (width > 360) {
                        crossAxisCount = 3;
                        childAspectRatio = isCompactLandscape ? 0.86 : 0.78;
                      } else {
                        crossAxisCount = 2;
                        childAspectRatio = isCompactLandscape ? 0.84 : 0.76;
                      }

                      return GridView.builder(
                        padding: EdgeInsets.fromLTRB(
                          isCompactLandscape ? 6 : 8,
                          2,
                          isCompactLandscape ? 6 : 8,
                          6,
                        ),
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: crossAxisCount,
                          childAspectRatio: childAspectRatio,
                          crossAxisSpacing: 5,
                          mainAxisSpacing: 5,
                        ),
                        itemCount: catalogState.filteredProducts.length,
                        itemBuilder: (context, index) {
                          final product = catalogState.filteredProducts[index];
                          return ProductCard(
                            product: product,
                            isWholesaleMode: cartState.isWholesaleMode,
                            onTap: () {
                              final success = ref.read(cartProvider.notifier).addProduct(
                                    product,
                                    unit: product.defaultBaseUnit,
                                    quantity: 1,
                                  );
                              if (!success) {
                                ScaffoldMessenger.of(context).hideCurrentSnackBar();
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('ສິນຄ້າໃນສາງບໍ່ພໍ! ຍັງເຫຼືອພຽງ ${product.stockBadgeText}'),
                                    backgroundColor: AppColors.error,
                                    duration: const Duration(seconds: 2),
                                  ),
                                );
                              }
                            },
                            onSelectUnit: (unit) {
                              final success = ref.read(cartProvider.notifier).addProduct(
                                    product,
                                    unit: unit,
                                    quantity: 1,
                                  );
                              if (!success) {
                                ScaffoldMessenger.of(context).hideCurrentSnackBar();
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('ສິນຄ້າໃນສາງບໍ່ພໍ! ຍັງເຫຼືອພຽງ ${product.stockBadgeText}'),
                                    backgroundColor: AppColors.error,
                                    duration: const Duration(seconds: 2),
                                  ),
                                );
                              }
                            },
                            onOpenUnitSelector: () {
                              _openUnitSelector(product, cartState.isWholesaleMode);
                            },
                          );
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
