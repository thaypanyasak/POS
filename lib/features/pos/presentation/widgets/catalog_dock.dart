import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/localization/lo.dart';
import '../../../../domain/models/product.dart';
import '../../../analytics/presentation/profit_summary_sheet.dart';
import '../../../history/presentation/receipt_history_screen.dart';
import '../controllers/cart_controller.dart';
import '../controllers/catalog_controller.dart';
import '../controllers/printer_controller.dart';
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

  void _handleBarcodeSubmission(String text) {
    final match = ref.read(catalogProvider.notifier).findProductByBarcode(text);
    if (match != null) {
      ref.read(cartProvider.notifier).addProduct(
            match.product,
            unit: match.unit,
            quantity: 1,
          );
      _searchController.clear();
      ref.read(catalogProvider.notifier).clearSearch();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('ຍິງບາໂຄດສຳເລັດ: ${match.product.name} (${match.unit.unitName})'),
          duration: const Duration(seconds: 1),
          backgroundColor: AppColors.primary,
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
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text(LaoStrings.cancel),
              ),
              ElevatedButton(
                onPressed: () {
                  ref.read(printerProvider.notifier).updatePrinterIp(ipController.text);
                  ref.read(printerProvider.notifier).toggleSimulation(isSim);
                  Navigator.of(ctx).pop();
                },
                child: const Text(LaoStrings.save),
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
              Icon(Icons.category_outlined, color: AppColors.primary),
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
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text(LaoStrings.cancel),
            ),
            ElevatedButton(
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
              child: const Text('ເພີ່ມໝວດໝູ່'),
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

    return Container(
      color: AppColors.background,
      child: Column(
        children: [
          // Station Top Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(bottom: BorderSide(color: AppColors.border, width: 0.9)),
            ),
            child: Row(
              children: [
                // Store Identity Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                  decoration: BoxDecoration(
                    gradient: AppColors.primaryGradient,
                    borderRadius: BorderRadius.circular(9),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x33059669),
                        offset: Offset(0, 2),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                  child: const Text(
                    'MeiiShop',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 15,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      LaoStrings.storeName,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        letterSpacing: -0.2,
                      ),
                    ),
                    Row(
                      children: [
                        Container(
                          width: 7,
                          height: 7,
                          decoration: const BoxDecoration(
                            color: Color(0xFF10B981),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '${LaoStrings.cashier}: ໄມ້ຄຳ • ${LaoStrings.onlineStatus}',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: AppColors.textTertiary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const Spacer(),

                // Refresh from Supabase button
                IconButton(
                  onPressed: () async {
                    await ref.read(catalogProvider.notifier).fetchFromSupabase();
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('ອັບເດດລາຍການສິນຄ້າຈາກ Supabase Cloud ສຳເລັດ!'),
                          backgroundColor: AppColors.primary,
                          duration: Duration(seconds: 1),
                        ),
                      );
                    }
                  },
                  icon: const Icon(Icons.sync_rounded, color: AppColors.textSecondary, size: 20),
                  tooltip: 'ດຶງຂໍ້ມູນສິນຄ້າຈາກ Supabase Cloud',
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.surfaceSubtle,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(width: 6),

                // Profit Report Quick Trigger
                OutlinedButton.icon(
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (ctx) => const ProfitSummarySheet(),
                    );
                  },
                  icon: const Icon(Icons.analytics_outlined, size: 17, color: AppColors.primary),
                  label: const Text(LaoStrings.profitReport),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: AppColors.surface,
                    side: const BorderSide(color: AppColors.border, width: 0.9),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
                  ),
                ),
                const SizedBox(width: 6),

                // Receipt History Quick Trigger
                OutlinedButton.icon(
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (ctx) => Dialog(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        clipBehavior: Clip.antiAlias,
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 1050, maxHeight: 720),
                          child: const ReceiptHistoryScreen(),
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Icons.receipt_long_outlined, size: 17, color: AppColors.textSecondary),
                  label: const Text('ປະຫວັດໃບບິນ'),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: AppColors.surface,
                    side: const BorderSide(color: AppColors.border, width: 0.9),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
                  ),
                ),
                const SizedBox(width: 6),

                // Printer settings button
                IconButton(
                  onPressed: _showPrinterSettingsDialog,
                  icon: const Icon(Icons.print_outlined, color: AppColors.textSecondary, size: 20),
                  tooltip: 'ຕັ້ງຄ່າເຄື່ອງພິມ',
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.surfaceSubtle,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ],
            ),
          ),

          // Search Bar & Barcode Scanner Row
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border, width: 0.9),
                      boxShadow: AppColors.cardShadow,
                    ),
                    child: TextField(
                      controller: _searchController,
                      focusNode: _searchFocusNode,
                      style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w500),
                      decoration: InputDecoration(
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        hintText: LaoStrings.searchHint,
                        hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                        prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textTertiary, size: 20),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, size: 16),
                                onPressed: () {
                                  _searchController.clear();
                                  ref.read(catalogProvider.notifier).clearSearch();
                                },
                              )
                            : Container(
                                margin: const EdgeInsets.all(8),
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceSubtle,
                                  borderRadius: BorderRadius.circular(5),
                                  border: Border.all(color: AppColors.borderSubtle),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.barcode_reader, size: 13, color: AppColors.textTertiary),
                                    SizedBox(width: 4),
                                    Text(
                                      'SCAN',
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.textTertiary,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                      ),
                      onChanged: (val) {
                        ref.read(catalogProvider.notifier).setSearchQuery(val);
                      },
                      onSubmitted: _handleBarcodeSubmission,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Horizontal Category Tabs
          SizedBox(
            height: 42,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: catalogState.categories.length + 1,
              itemBuilder: (context, index) {
                // Last item is the dynamic "+ ເພີ່ມໝວດໝູ່" tab button
                if (index == catalogState.categories.length) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 8.0),
                    child: InkWell(
                      onTap: _showAddCategoryDialog,
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.primaryBorder, width: 0.9),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.add, size: 15, color: AppColors.primaryDark),
                            SizedBox(width: 4),
                            Text(
                              'ເພີ່ມໝວດໝູ່',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.primaryDark,
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
                  padding: const EdgeInsets.only(right: 6.0),
                  child: InkWell(
                    onTap: () => ref.read(catalogProvider.notifier).selectCategory(category),
                    borderRadius: BorderRadius.circular(8),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.surfaceDark : AppColors.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isSelected ? AppColors.surfaceDark : AppColors.border,
                          width: 0.9,
                        ),
                        boxShadow: isSelected
                            ? const [
                                BoxShadow(
                                  color: Color(0x1F0F172A),
                                  offset: Offset(0, 2),
                                  blurRadius: 4,
                                ),
                              ]
                            : null,
                      ),
                      child: Text(
                        category,
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          color: isSelected ? Colors.white : AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 6),

          // High-density Product Grid (Ultra-compact for iPad/Tablet Landscape)
          Expanded(
            child: catalogState.filteredProducts.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.inventory_2_outlined, size: 48, color: AppColors.textMuted),
                        const SizedBox(height: 12),
                        Text(
                          LaoStrings.productNotFound,
                          style: theme.textTheme.titleMedium?.copyWith(color: AppColors.textMuted),
                        ),
                        const SizedBox(height: 8),
                        TextButton.icon(
                          onPressed: () => ref.read(catalogProvider.notifier).fetchFromSupabase(),
                          icon: const Icon(Icons.sync),
                          label: const Text('ກວດສອບຂໍ້ມູນຈາກ Supabase Cloud'),
                        ),
                      ],
                    ),
                  )
                : LayoutBuilder(
                    builder: (context, constraints) {
                      // High-density: 5 columns on wide tablet landscape, 4 on standard tablet, 3 on compact
                      final crossAxisCount = constraints.maxWidth > 950
                          ? 5
                          : (constraints.maxWidth > 650 ? 4 : 3);
                      return GridView.builder(
                        padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: crossAxisCount,
                          childAspectRatio: 1.25,
                          crossAxisSpacing: 8,
                          mainAxisSpacing: 8,
                        ),
                        itemCount: catalogState.filteredProducts.length,
                        itemBuilder: (context, index) {
                          final product = catalogState.filteredProducts[index];
                          return ProductCard(
                            product: product,
                            isWholesaleMode: cartState.isWholesaleMode,
                            onTap: () {
                              ref.read(cartProvider.notifier).addProduct(
                                    product,
                                    unit: product.defaultBaseUnit,
                                    quantity: 1,
                                  );
                            },
                            onSelectUnit: (unit) {
                              ref.read(cartProvider.notifier).addProduct(
                                    product,
                                    unit: unit,
                                    quantity: 1,
                                  );
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
