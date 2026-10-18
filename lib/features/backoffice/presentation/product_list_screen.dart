import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/localization/lao_currency_formatter.dart';
import '../../../data/remote/supabase_sync_service.dart';
import '../../../domain/models/product.dart';
import '../../pos/presentation/controllers/catalog_controller.dart';
import '../../pos/presentation/widgets/barcode_scanner_modal.dart';
import 'widgets/category_management_modal.dart';
import 'widgets/product_entry_form_modal.dart';

/// Screen for Product & Inventory Management (ລາຍການສິນຄ້າ & ຕົ້ນທຶນບາດ)
/// Spec reference: SPEC_PRODUCT_LIST.md & ProductsView.jsx
class ProductListScreen extends ConsumerStatefulWidget {
  final VoidCallback? onOpenAddProduct;

  const ProductListScreen({super.key, this.onOpenAddProduct});

  @override
  ConsumerState<ProductListScreen> createState() => _ProductListScreenState();
}

class _ProductListScreenState extends ConsumerState<ProductListScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _selectedCategory = 'ທັງໝົດ';
  String? _scannedHighlightId;
  Timer? _highlightTimer;

  @override
  void dispose() {
    _searchController.dispose();
    _highlightTimer?.cancel();
    super.dispose();
  }

  void _triggerHighlight(Product product) {
    _highlightTimer?.cancel();
    setState(() {
      _scannedHighlightId = product.id;
    });

    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('ພົບສິນຄ້າ "${product.name}"'),
        backgroundColor: const Color(0xFF0F766E),
        duration: const Duration(seconds: 3),
      ),
    );

    _highlightTimer = Timer(const Duration(seconds: 6), () {
      if (mounted) {
        setState(() => _scannedHighlightId = null);
      }
    });
  }

  void _openBarcodeScanner() {
    showDialog(
      context: context,
      builder: (_) => BarcodeScannerModal(
        onScan: (scannedCode) {
          final clean = scannedCode.trim().toLowerCase();
          _searchController.text = scannedCode.trim();

          // Search matching product
          final allProds = ref.read(catalogProvider).allProducts;
          final match = allProds.where((p) {
            final barcodeMatch = p.barcode != null && p.barcode!.toLowerCase().contains(clean);
            final unitBarcodeMatch = p.units.any((u) => u.barcode != null && u.barcode!.toLowerCase().contains(clean));
            return barcodeMatch || unitBarcodeMatch;
          }).toList();

          if (match.isNotEmpty) {
            _triggerHighlight(match.first);
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('ບໍ່ພົບສິນຄ້າທີ່ມີບາໂຄດ: "$scannedCode"'),
                backgroundColor: const Color(0xFFDC2626),
              ),
            );
          }
        },
      ),
    );
  }

  void _openAddProductModal() {
    showDialog(
      context: context,
      useSafeArea: false,
      builder: (_) => ProductEntryFormModal(
        onSaved: () {
          ref.read(catalogProvider.notifier).fetchFromSupabase();
        },
      ),
    );
  }

  void _openEditProductModal(Product product) {
    showDialog(
      context: context,
      useSafeArea: false,
      builder: (_) => ProductEntryFormModal(
        productToEdit: product,
        onSaved: () {
          ref.read(catalogProvider.notifier).fetchFromSupabase();
        },
      ),
    );
  }

  void _openCategoryManagerModal() {
    showDialog(
      context: context,
      builder: (_) => const CategoryManagementModal(),
    );
  }

  void _confirmDeleteProduct(Product product) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: const [
            PhosphorIcon(PhosphorIconsBold.warningCircle, color: Color(0xFFDC2626), size: 24),
            SizedBox(width: 8),
            Text(
              'ຢືນຢັນການລຶບສິນຄ້າ',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
          ],
        ),
        content: Text(
          'ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບສິນຄ້າ "${product.name}" ອອກຈາກຖານຂໍ້ມູນ Supabase ແທ້ບໍ?',
          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        actions: [
          AppButton(
            variant: AppButtonVariant.outline,
            size: AppButtonSize.sm,
            label: 'ຍົກເລີກ',
            onPressed: () => Navigator.of(ctx).pop(),
          ),
          const SizedBox(width: 8),
          AppButton(
            variant: AppButtonVariant.danger,
            size: AppButtonSize.sm,
            label: 'ລຶບສິນຄ້າ',
            icon: PhosphorIconsBold.trash,
            onPressed: () async {
              Navigator.of(ctx).pop();
              final success = await SupabaseSyncService.deleteProduct(product.id);
              if (success) {
                ref.read(catalogProvider.notifier).fetchFromSupabase();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('ລຶບສິນຄ້າ "${product.name}" ສຳເລັດແລ້ວ!'),
                      backgroundColor: const Color(0xFF0F766E),
                    ),
                  );
                }
              } else {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('ບໍ່ສາມາດລຶບສິນຄ້າໄດ້'),
                      backgroundColor: Color(0xFFDC2626),
                    ),
                  );
                }
              }
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final catalogState = ref.watch(catalogProvider);
    final allProducts = catalogState.allProducts;
    final categories = catalogState.categories;
    final isLoading = catalogState.isLoading;

    final query = _searchController.text.trim().toLowerCase();

    // Filtering
    final filteredProducts = allProducts.where((p) {
      // Category filter
      if (_selectedCategory != 'ທັງໝົດ') {
        final matchesCat = p.category == _selectedCategory ||
            (p.categoryId != null &&
                catalogState.rawCategories.any((c) => c.id == p.categoryId && c.name == _selectedCategory));
        if (!matchesCat) return false;
      }

      // Universal search query: Name, Barcode, Tier Barcodes, Category
      if (query.isNotEmpty) {
        final nameMatch = p.name.toLowerCase().contains(query);
        final catMatch = p.category.toLowerCase().contains(query);
        final barcodeMatch = p.barcode != null && p.barcode!.toLowerCase().contains(query);
        final unitBarcodeMatch = p.units.any((u) => u.barcode != null && u.barcode!.toLowerCase().contains(query));

        if (!nameMatch && !catMatch && !barcodeMatch && !unitBarcodeMatch) {
          return false;
        }
      }

      return true;
    }).toList();

    final screenWidth = MediaQuery.of(context).size.width;
    final isDesktopOrTablet = screenWidth >= 768;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. TOP HEADER TOOLBAR (Responsive for Mobile vs Tablet/Desktop)
          LayoutBuilder(
            builder: (context, constraints) {
              final isMobile = constraints.maxWidth < 640;

              if (isMobile) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              color: const Color(0xFFCCFBF1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const PhosphorIcon(PhosphorIconsBold.archive, color: Color(0xFF0D9488), size: 18),
                          ),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Text(
                              'ລາຍການສິນຄ້າ & ຕົ້ນທຶນບາດ',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                          ),
                          IconButton(
                            onPressed: isLoading
                                ? null
                                : () {
                                    ref.read(catalogProvider.notifier).fetchFromSupabase();
                                  },
                            icon: isLoading
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0D9488)),
                                  )
                                : const PhosphorIcon(PhosphorIconsBold.arrowsClockwise, size: 16, color: Color(0xFF475569)),
                            style: IconButton.styleFrom(
                              backgroundColor: const Color(0xFFF1F5F9),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              padding: const EdgeInsets.all(8),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _openCategoryManagerModal,
                              icon: const PhosphorIcon(PhosphorIconsBold.folder, size: 15, color: Color(0xFF0F766E)),
                              label: const Text('ໝວດໝູ່', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFF334155),
                                backgroundColor: const Color(0xFFF1F5F9),
                                side: const BorderSide(color: Color(0xFFCBD5E1)),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                padding: const EdgeInsets.symmetric(vertical: 8),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            flex: 2,
                            child: AppButton(
                              variant: AppButtonVariant.primary,
                              size: AppButtonSize.sm,
                              label: 'ເພີ່ມສິນຄ້າໃໝ່',
                              icon: PhosphorIconsBold.plus,
                              onPressed: _openAddProductModal,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }

              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: const Color(0xFFCCFBF1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const PhosphorIcon(PhosphorIconsBold.archive, color: Color(0xFF0D9488), size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Text(
                            'ລາຍການສິນຄ້າ & ຕົ້ນທຶນບາດ',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0F172A),
                              letterSpacing: -0.3,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'ສະແດງລາຄາຕົ້ນທຶນບາດ ແລະ ກີບ ຍົກລັງ/ແກັດ (Carton), ພ້ອມຫົວໜ່ວຍຂາຍ ແລະ ສະຕັອກສິນຄ້າ',
                            style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Action Buttons: Category Manager, Reload, + Add Product
                    OutlinedButton.icon(
                      onPressed: _openCategoryManagerModal,
                      icon: const PhosphorIcon(PhosphorIconsBold.folder, size: 16, color: Color(0xFF0F766E)),
                      label: const Text('ໝວດໝູ່', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF334155),
                        backgroundColor: const Color(0xFFF1F5F9),
                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(width: 8),

                    IconButton(
                      onPressed: isLoading
                          ? null
                          : () {
                              ref.read(catalogProvider.notifier).fetchFromSupabase();
                            },
                      icon: isLoading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0D9488)),
                            )
                          : const PhosphorIcon(PhosphorIconsBold.arrowsClockwise, size: 18, color: Color(0xFF475569)),
                      style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFFF1F5F9),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.all(10),
                      ),
                      tooltip: 'ໂຫຼດຄືນ (Reload Supabase)',
                    ),
                    const SizedBox(width: 8),

                    // FIXED "+ ເພີ່ມສິນຄ້າໃໝ່" BUTTON
                    AppButton(
                      variant: AppButtonVariant.primary,
                      size: AppButtonSize.md,
                      icon: PhosphorIconsBold.plus,
                      label: 'ເພີ່ມສິນຄ້າໃໝ່',
                      onPressed: _openAddProductModal,
                    ),
                  ],
                ),
              );
            },
          ),

          // 2. SEARCH BAR & CATEGORY FILTER CHIPS
          Container(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Universal Search Bar with Barcode Camera Button inside
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        height: 44,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: Row(
                          children: [
                            const SizedBox(width: 12),
                            const PhosphorIcon(PhosphorIconsBold.magnifyingGlass, size: 20, color: Color(0xFF64748B)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                controller: _searchController,
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                decoration: const InputDecoration(
                                  hintText: 'ຄົ້ນຫາຊື່ສິນຄ້າ, ໝວດໝູ່ ຫຼື ສະແກນບາໂຄດ...',
                                  hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                  border: InputBorder.none,
                                  isDense: true,
                                ),
                                onChanged: (_) => setState(() {}),
                                onSubmitted: (code) {
                                  final clean = code.trim().toLowerCase();
                                  final match = allProducts.where((p) {
                                    return (p.barcode != null && p.barcode!.toLowerCase().contains(clean)) ||
                                        p.units.any((u) => u.barcode != null && u.barcode!.toLowerCase().contains(clean));
                                  }).toList();
                                  if (match.isNotEmpty) {
                                    _triggerHighlight(match.first);
                                  }
                                },
                              ),
                            ),
                            if (_searchController.text.isNotEmpty)
                              IconButton(
                                icon: const PhosphorIcon(PhosphorIconsBold.x, size: 16, color: Color(0xFF94A3B8)),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() {});
                                },
                              ),
                            // Barcode Camera Button
                            Container(
                              margin: const EdgeInsets.only(right: 6),
                              child: AppButton(
                                variant: AppButtonVariant.outline,
                                size: AppButtonSize.sm,
                                icon: PhosphorIconsBold.barcode,
                                label: 'ສະແກນ',
                                onPressed: _openBarcodeScanner,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Category Filter Chips + Category Manager button
                SizedBox(
                  height: 36,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      // "All" + Dynamic Category Chips
                      ...categories.map((catName) {
                        final isSelected = _selectedCategory == catName;
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: Text(
                              catName,
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                color: isSelected ? Colors.white : const Color(0xFF475569),
                              ),
                            ),
                            selected: isSelected,
                            selectedColor: const Color(0xFF0F766E),
                            backgroundColor: const Color(0xFFF1F5F9),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            side: BorderSide(
                              color: isSelected ? const Color(0xFF0F766E) : const Color(0xFFE2E8F0),
                            ),
                            onSelected: (val) {
                              if (val) {
                                setState(() => _selectedCategory = catName);
                              }
                            },
                          ),
                        );
                      }),

                      // Manage Categories Icon Button next to chips
                      Padding(
                        padding: const EdgeInsets.only(left: 4),
                        child: ActionChip(
                          avatar: const PhosphorIcon(PhosphorIconsBold.gear, size: 14, color: Color(0xFF475569)),
                          label: const Text(
                            'ຈັດການໝວດໝູ່',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
                          ),
                          backgroundColor: Colors.white,
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          onPressed: _openCategoryManagerModal,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Search result counter
          if (_searchController.text.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              color: const Color(0xFFF8FAFC),
              child: Row(
                children: [
                  Text(
                    'ພົບ ${filteredProducts.length} ລາຍການ',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: () {
                      _searchController.clear();
                      setState(() {});
                    },
                    child: const Text(
                      'ລຶບການຄົ້ນຫາ',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0D9488)),
                    ),
                  ),
                ],
              ),
            ),

          // 3. MAIN DATA DISPLAY (RESPONSIVE: DESKTOP TABLE VS MOBILE CARDS)
          Expanded(
            child: filteredProducts.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        PhosphorIcon(PhosphorIconsBold.package, size: 48, color: Color(0xFFCBD5E1)),
                        SizedBox(height: 12),
                        Text(
                          'ບໍ່ພົບລາຍການສິນຄ້າ',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  )
                : isDesktopOrTablet
                    ? _buildDesktopDataTable(filteredProducts)
                    : _buildMobileCardList(filteredProducts),
          ),
        ],
      ),
    );
  }

  // --- 7-COLUMN DATA TABLE FOR TABLET & DESKTOP ---
  Widget _buildDesktopDataTable(List<Product> products) {
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            offset: Offset(0, 1),
            blurRadius: 3,
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final tableWidth = constraints.maxWidth < 1200 ? 1200.0 : constraints.maxWidth;

          return SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: tableWidth,
              child: SingleChildScrollView(
                child: DataTable(
                  headingRowColor: WidgetStateProperty.all(const Color(0xFFF8FAFC)),
                  headingRowHeight: 48,
                  dataRowMinHeight: 64,
                  dataRowMaxHeight: 80,
                  horizontalMargin: 20,
                  columnSpacing: 24,
                  columns: const [
                    DataColumn(label: Text('ຮູບ & ຊື່ສິນຄ້າ', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF334155)))),
                    DataColumn(label: Text('ໝວດໝູ່', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF334155)))),
                    DataColumn(label: Text('ຕົ້ນທຶນບາດ (฿) & ກີບ (₭)', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF334155)))),
                    DataColumn(label: Text('ລະດັບຫົວໜ່ວຍຂາຍ', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF334155)))),
                    DataColumn(label: Text('ສາງຄົງເຫຼືອ (Stock)', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF334155)))),
                    DataColumn(label: SizedBox(width: 140, child: Text('ອັດຕາສ່ວນ (Ratio)', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF334155))))),
                    DataColumn(label: SizedBox(width: 90, child: Center(child: Text('ຈັດການ', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF334155)))))),
                  ],
              rows: products.map((p) {
                final isHighlighted = p.id == _scannedHighlightId;

                return DataRow(
                  color: WidgetStateProperty.resolveWith<Color?>((states) {
                    if (isHighlighted) return const Color(0xFFCCFBF1).withValues(alpha: 0.6);
                    if (states.contains(WidgetState.hovered)) return const Color(0xFFF8FAFC);
                    return null;
                  }),
                  cells: [
                    // Col 1: Image & Name & Barcode
                    DataCell(
                      Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.network(
                              p.imageUrl ?? 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
                              width: 44,
                              height: 44,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                width: 44,
                                height: 44,
                                color: const Color(0xFFF1F5F9),
                                child: const PhosphorIcon(PhosphorIconsBold.image, color: Color(0xFF94A3B8), size: 20),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 220),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  p.name,
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: Color(0xFF0F172A)),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 3),
                                if (p.units.any((u) => u.barcode != null && u.barcode!.isNotEmpty))
                                  Wrap(
                                    spacing: 4,
                                    children: p.units.where((u) => u.barcode != null && u.barcode!.isNotEmpty).map((u) {
                                      return Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF1F5F9),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          '${u.unitName}: ${u.barcode}',
                                          style: const TextStyle(fontSize: 9.5, fontFamily: 'monospace', fontWeight: FontWeight.bold, color: Color(0xFF475569)),
                                        ),
                                      );
                                    }).toList(),
                                  )
                                else
                                  Text(
                                    p.barcode ?? 'ບໍ່ມີບາໂຄດ',
                                    style: const TextStyle(fontSize: 10, fontFamily: 'monospace', color: Color(0xFF94A3B8)),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Col 2: Category Badge
                    DataCell(
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Text(
                          p.category,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF334155)),
                        ),
                      ),
                    ),

                    // Col 3: Cost Breakdown (THB & LAK)
                    DataCell(
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text('฿ ', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
                              Text(
                                p.costBaht > 0 ? '${LaoCurrencyFormatter.formatNumber(p.costBaht)} ฿' : '-',
                                style: const TextStyle(fontSize: 11.5, fontFamily: 'monospace', fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                              ),
                              Text(' / ${p.cName}', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text('₭ ', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
                              Text(
                                p.costKip > 0 ? '${LaoCurrencyFormatter.formatNumber(p.costKip)} ₭' : '-',
                                style: const TextStyle(fontSize: 11.5, fontFamily: 'monospace', fontWeight: FontWeight.w800, color: Color(0xFF334155)),
                              ),
                              Text(' / ${p.cName}', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Col 4: Active Sale Units & Prices
                    DataCell(
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 240),
                        child: Wrap(
                          spacing: 4,
                          runSpacing: 4,
                          children: p.units.where((u) => u.isActive).map((u) {
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0FDFA),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFFCCFBF1)),
                              ),
                              child: Text(
                                '${u.unitName}: ${LaoCurrencyFormatter.format(u.retailPrice)}',
                                style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF0F766E)),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    ),

                    // Col 5: Compound Stock (Unpack Formatter)
                    DataCell(
                      !p.trackStock
                          ? Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFFCBD5E1)),
                              ),
                              child: const Text(
                                'ບໍ່ນັບສາງ',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                              ),
                            )
                          : Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                if (p.currentStockBaseUnits < 0)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFFF1F2),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(color: const Color(0xFFFECDD3)),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const PhosphorIcon(PhosphorIconsBold.warningCircle, size: 12, color: Color(0xFFBE123C)),
                                        const SizedBox(width: 4),
                                        Text(
                                          'ໝົດສະຕັອກ (${p.negativeStockCompound})',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w800,
                                            color: Color(0xFFBE123C),
                                          ),
                                        ),
                                      ],
                                    ),
                                  )
                                else if (p.currentStockBaseUnits == 0)
                                  const Text(
                                    'ໝົດສະຕັອກ (0)',
                                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFFDC2626)),
                                  )
                                else
                                  Wrap(
                                    spacing: 4,
                                    children: [
                                      if (p.tier1Active && p.cartonCount > 0)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFFEF3C7),
                                            borderRadius: BorderRadius.circular(4),
                                            border: Border.all(color: const Color(0xFFFDE68A)),
                                          ),
                                          child: Text(
                                            '${p.cartonCount} ${p.cName}',
                                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF78350F)),
                                          ),
                                        ),
                                      if (p.tier2Active && p.packCount > 0)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFE0F2FE),
                                            borderRadius: BorderRadius.circular(4),
                                            border: Border.all(color: const Color(0xFFBAE6FD)),
                                          ),
                                          child: Text(
                                            '${p.packCount} ${p.pName}',
                                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0369A1)),
                                          ),
                                        ),
                                      if (p.tier3Active && p.pieceCount > 0)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFF1F5F9),
                                            borderRadius: BorderRadius.circular(4),
                                            border: Border.all(color: const Color(0xFFCBD5E1)),
                                          ),
                                          child: Text(
                                            '${p.pieceCount} ${p.pcName}',
                                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF334155)),
                                          ),
                                        ),
                                    ],
                                  ),
                                const SizedBox(height: 2),
                                Text(
                                  'ລວມທັງໝົດ: ${p.currentStockBaseUnits} ${p.baseUnit}',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: p.currentStockBaseUnits < 0 ? const Color(0xFFE11D48) : const Color(0xFF94A3B8),
                                    fontWeight: p.currentStockBaseUnits < 0 ? FontWeight.w700 : FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                    ),

                    // Col 6: Conversion Ratio
                    DataCell(
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (p.tier1Active && p.tier2Active)
                            Text(
                              '1 ${p.cName} = ${p.packsPerCarton} ${p.pName}',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
                            ),
                          if (p.tier2Active && p.tier3Active && p.piecesPerPack > 1)
                            Text(
                              '1 ${p.pName} = ${p.piecesPerPack} ${p.pcName}',
                              style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                            ),
                          if (!p.tier2Active && !p.tier3Active)
                            const Text('-', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                        ],
                      ),
                    ),

                    // Col 7: Actions (Edit & Delete)
                    DataCell(
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          IconButton(
                            icon: const PhosphorIcon(PhosphorIconsBold.pencilSimple, size: 16, color: Color(0xFF475569)),
                            onPressed: () => _openEditProductModal(p),
                            style: IconButton.styleFrom(
                              backgroundColor: const Color(0xFFF1F5F9),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              minimumSize: const Size(32, 32),
                              padding: EdgeInsets.zero,
                            ),
                            tooltip: 'ແກ້ໄຂ',
                          ),
                          const SizedBox(width: 6),
                          IconButton(
                            icon: const PhosphorIcon(PhosphorIconsBold.trash, size: 16, color: Color(0xFFDC2626)),
                            onPressed: () => _confirmDeleteProduct(p),
                            style: IconButton.styleFrom(
                              backgroundColor: const Color(0xFFFEF2F2),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              minimumSize: const Size(32, 32),
                              padding: EdgeInsets.zero,
                            ),
                            tooltip: 'ລຶບສິນຄ້າ',
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
);
}

  // --- MOBILE CARD LIST VIEW (< 768px) ---
  Widget _buildMobileCardList(List<Product> products) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
      itemCount: products.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final p = products[index];
        final isHighlighted = p.id == _scannedHighlightId;

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isHighlighted ? const Color(0xFF0D9488) : const Color(0xFFE2E8F0),
              width: isHighlighted ? 1.5 : 1,
            ),
            boxShadow: [
              BoxShadow(
                color: isHighlighted ? const Color(0x1A0D9488) : const Color(0x06000000),
                offset: const Offset(0, 1),
                blurRadius: 3,
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top Row: Image, Name, Category chip, Action buttons
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.network(
                      p.imageUrl ?? 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
                      width: 48,
                      height: 48,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        width: 48,
                        height: 48,
                        color: const Color(0xFFF1F5F9),
                        child: const PhosphorIcon(PhosphorIconsBold.image, color: Color(0xFF94A3B8), size: 22),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.name,
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A)),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                p.category,
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
                              ),
                            ),
                            const SizedBox(width: 6),
                            if (p.barcode != null && p.barcode!.isNotEmpty)
                              Flexible(
                                child: Text(
                                  p.barcode!,
                                  style: const TextStyle(fontSize: 10, fontFamily: 'monospace', color: Color(0xFF94A3B8)),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const PhosphorIcon(PhosphorIconsBold.pencilSimple, size: 18, color: Color(0xFF475569)),
                        onPressed: () => _openEditProductModal(p),
                        style: IconButton.styleFrom(
                          backgroundColor: const Color(0xFFF1F5F9),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          minimumSize: const Size(36, 36),
                          padding: EdgeInsets.zero,
                        ),
                      ),
                      const SizedBox(width: 4),
                      IconButton(
                        icon: const PhosphorIcon(PhosphorIconsBold.trash, size: 18, color: Color(0xFFDC2626)),
                        onPressed: () => _confirmDeleteProduct(p),
                        style: IconButton.styleFrom(
                          backgroundColor: const Color(0xFFFEF2F2),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          minimumSize: const Size(36, 36),
                          padding: EdgeInsets.zero,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Middle Row: Cost Breakdown & Ratio Box
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Text('ຕົ້ນທຶນ (${p.cName}): ', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                        Text(
                          p.costBaht > 0 ? '${LaoCurrencyFormatter.formatNumber(p.costBaht)} ฿' : '-',
                          style: const TextStyle(fontSize: 11.5, fontFamily: 'monospace', fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        ),
                        const Text(' / ', style: TextStyle(color: Color(0xFFCBD5E1))),
                        Text(
                          p.costKip > 0 ? '${LaoCurrencyFormatter.formatNumber(p.costKip)} ₭' : '-',
                          style: const TextStyle(fontSize: 11.5, fontFamily: 'monospace', fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                        ),
                      ],
                    ),
                    if (p.tier1Active && p.tier2Active)
                      Text(
                        '1 ${p.cName} = ${p.packsPerCarton} ${p.pName}',
                        style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 8),

              // Bottom Row: Sale Prices & Compound Stock
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Prices
                  Flexible(
                    child: Wrap(
                      spacing: 4,
                      children: p.units.where((u) => u.isActive).map((u) {
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDFA),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFCCFBF1)),
                          ),
                          child: Text(
                            '${u.unitName}: ${LaoCurrencyFormatter.format(u.retailPrice)}',
                            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF0F766E)),
                          ),
                        );
                      }).toList(),
                    ),
                  ),

                  // Stock
                  if (!p.trackStock)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('ບໍ່ນັບສາງ', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                    )
                  else if (p.currentStockBaseUnits < 0)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF1F2),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: const Color(0xFFFECDD3)),
                      ),
                      child: Text(
                        'ໝົດສະຕັອກ (${p.negativeStockCompound})',
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFFBE123C),
                        ),
                      ),
                    )
                  else if (p.currentStockBaseUnits == 0)
                    const Text('ໝົດສະຕັອກ (0)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFFDC2626)))
                  else
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (p.tier1Active && p.cartonCount > 0)
                          Container(
                            margin: const EdgeInsets.only(left: 3),
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              '${p.cartonCount} ${p.cName}',
                              style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF78350F)),
                            ),
                          ),
                        if (p.tier2Active && p.packCount > 0)
                          Container(
                            margin: const EdgeInsets.only(left: 3),
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE0F2FE),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              '${p.packCount} ${p.pName}',
                              style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF0369A1)),
                            ),
                          ),
                        if (p.tier3Active && p.pieceCount > 0)
                          Container(
                            margin: const EdgeInsets.only(left: 3),
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              '${p.pieceCount} ${p.pcName}',
                              style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF334155)),
                            ),
                          ),
                      ],
                    ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
