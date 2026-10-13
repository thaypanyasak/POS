import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../data/mock/mock_grocery_data.dart';
import '../../../../data/remote/supabase_sync_service.dart';
import '../../../../domain/models/product.dart';
import '../../../../domain/models/product_unit.dart';
import '../../../../domain/models/sale_transaction.dart';

class BarcodeMatchResult {
  final Product product;
  final ProductUnit unit;

  const BarcodeMatchResult({required this.product, required this.unit});
}

class CatalogState {
  final List<Product> allProducts;
  final String selectedCategory;
  final String searchQuery;
  final List<String> categories;
  final bool isLoading;

  const CatalogState({
    required this.allProducts,
    required this.selectedCategory,
    required this.searchQuery,
    required this.categories,
    this.isLoading = false,
  });

  /// Filtered product catalog according to selected category and search input
  List<Product> get filteredProducts {
    return allProducts.where((product) {
      final matchesCategory =
          selectedCategory == 'ທັງໝົດ' || product.category == selectedCategory;
      if (!matchesCategory) return false;

      if (searchQuery.trim().isEmpty) return true;

      final query = searchQuery.trim().toLowerCase();
      final matchesName = product.name.toLowerCase().contains(query);
      final matchesCategoryName = product.category.toLowerCase().contains(query);
      final matchesBarcode = product.units.any(
        (u) => u.barcode != null && u.barcode!.toLowerCase().contains(query),
      );

      return matchesName || matchesCategoryName || matchesBarcode;
    }).toList();
  }

  CatalogState copyWith({
    List<Product>? allProducts,
    String? selectedCategory,
    String? searchQuery,
    List<String>? categories,
    bool? isLoading,
  }) {
    return CatalogState(
      allProducts: allProducts ?? this.allProducts,
      selectedCategory: selectedCategory ?? this.selectedCategory,
      searchQuery: searchQuery ?? this.searchQuery,
      categories: categories ?? this.categories,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

class CatalogNotifier extends StateNotifier<CatalogState> {
  CatalogNotifier()
      : super(
          CatalogState(
            allProducts: MockGroceryData.initialProducts,
            selectedCategory: 'ທັງໝົດ',
            searchQuery: '',
            categories: _extractCategories(MockGroceryData.initialProducts),
          ),
        ) {
    // Automatically load products from Supabase on startup
    fetchFromSupabase();
  }

  static const List<String> defaultCategories = [
    'ທັງໝົດ',
    'ເຄື່ອງດື່ມ',
    'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ',
    'ເຂົ້າໜົມ/ອາຫານຫວ່າງ',
    'ເຄື່ອງປຸງ/ອາຫານແຫ້ງ',
    'ເຂົ້າສານ/ອາຫານຫຼັກ',
    'ເຄື່ອງໃຊ້ທົ່ວໄປ',
    'ນົມ/ເຄື່ອງເຢັນ',
    'ຢາສູບ',
  ];

  static List<String> _extractCategories(List<Product> products, {List<String>? baseList}) {
    final Set<String> cats = Set.from(baseList ?? defaultCategories);
    for (final p in products) {
      if (p.category.trim().isNotEmpty) {
        cats.add(p.category.trim());
      }
    }
    return cats.toList();
  }

  /// Fetches products from Supabase Cloud Database
  Future<void> fetchFromSupabase() async {
    state = state.copyWith(isLoading: true);
    final remoteProducts = await SupabaseSyncService.fetchProducts();
    if (remoteProducts != null) {
      state = state.copyWith(
        allProducts: remoteProducts,
        categories: _extractCategories(remoteProducts, baseList: state.categories),
        isLoading: false,
      );
    } else {
      state = state.copyWith(isLoading: false);
    }
  }

  /// Dynamically adds a new category tab and selects it
  void addCategory(String newCategory) {
    final clean = newCategory.trim();
    if (clean.isEmpty) return;

    if (!state.categories.contains(clean)) {
      final updated = [...state.categories, clean];
      state = state.copyWith(
        categories: updated,
        selectedCategory: clean,
      );
    } else {
      state = state.copyWith(selectedCategory: clean);
    }
  }

  /// Sets active category tab
  void selectCategory(String category) {
    state = state.copyWith(selectedCategory: category);
  }

  /// Updates search text query
  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query);
  }

  /// Clears active search
  void clearSearch() {
    state = state.copyWith(searchQuery: '');
  }

  /// Scans or searches for a barcode.
  /// If a match is found on any product packaging tier, returns the product and exact unit.
  BarcodeMatchResult? findProductByBarcode(String barcode) {
    final cleanBarcode = barcode.trim();
    if (cleanBarcode.isEmpty) return null;

    for (final product in state.allProducts) {
      for (final unit in product.units) {
        if (unit.barcode == cleanBarcode) {
          return BarcodeMatchResult(product: product, unit: unit);
        }
      }
    }
    return null;
  }

  /// Adds or updates a product in the catalog and syncs to Supabase
  void upsertProduct(Product product) {
    final index = state.allProducts.indexWhere((p) => p.id == product.id);
    List<Product> updated;
    if (index >= 0) {
      updated = List.from(state.allProducts);
      updated[index] = product;
    } else {
      updated = [product, ...state.allProducts];
    }
    state = state.copyWith(
      allProducts: updated,
      categories: _extractCategories(updated),
    );

    // Asynchronously push to Supabase Cloud
    SupabaseSyncService.syncProduct(product);
  }

  /// Deletes a product from the catalog and Supabase
  void deleteProduct(String productId) {
    final updated = state.allProducts.where((p) => p.id != productId).toList();
    state = state.copyWith(
      allProducts: updated,
      categories: _extractCategories(updated),
    );

    // Asynchronously delete from Supabase Cloud
    SupabaseSyncService.deleteProduct(productId);
  }

  /// Quick restock: increases stock by added base units
  void quickRestock(String productId, int addedBaseUnits) {
    Product? updatedProduct;
    final updated = state.allProducts.map((p) {
      if (p.id == productId) {
        final pUpdated = p.copyWith(
          currentStockBaseUnits: p.currentStockBaseUnits + addedBaseUnits,
        );
        updatedProduct = pUpdated;
        return pUpdated;
      }
      return p;
    }).toList();
    state = state.copyWith(allProducts: updated);

    if (updatedProduct != null) {
      SupabaseSyncService.syncProduct(updatedProduct!);
    }
  }

  /// Quick stock update: sets physical stock quantity directly
  void updateStock(String productId, int newBaseUnits) {
    Product? updatedProduct;
    final updated = state.allProducts.map((p) {
      if (p.id == productId) {
        final pUpdated = p.copyWith(currentStockBaseUnits: newBaseUnits);
        updatedProduct = pUpdated;
        return pUpdated;
      }
      return p;
    }).toList();
    state = state.copyWith(allProducts: updated);

    if (updatedProduct != null) {
      SupabaseSyncService.syncProduct(updatedProduct!);
    }
  }

  /// Quick price adjustment for a specific unit tier
  void quickAdjustPrice(
    String productId,
    String unitId, {
    int? newRetailPrice,
    int? newWholesalePrice,
  }) {
    Product? updatedProduct;
    final updated = state.allProducts.map((p) {
      if (p.id == productId) {
        final newUnits = p.units.map((u) {
          if (u.id == unitId) {
            return u.copyWith(
              retailPrice: newRetailPrice ?? u.retailPrice,
              wholesalePrice: newWholesalePrice ?? u.wholesalePrice,
            );
          }
          return u;
        }).toList();
        final pUpdated = p.copyWith(units: newUnits);
        updatedProduct = pUpdated;
        return pUpdated;
      }
      return p;
    }).toList();
    state = state.copyWith(allProducts: updated);

    if (updatedProduct != null) {
      SupabaseSyncService.syncProduct(updatedProduct!);
    }
  }

  /// Deducts stock based on completed sale transaction
  void deductStockFromTransaction(SaleTransaction transaction) {
    final Map<String, int> deductions = {};
    for (final item in transaction.items) {
      deductions.update(
        item.product.id,
        (current) => current + item.totalBaseUnitsDeducted,
        ifAbsent: () => item.totalBaseUnitsDeducted,
      );
    }

    final updatedProducts = state.allProducts.map((p) {
      if (deductions.containsKey(p.id)) {
        final deductedUnits = deductions[p.id]!;
        final pUpdated = p.copyWith(
          currentStockBaseUnits: p.currentStockBaseUnits - deductedUnits,
        );
        SupabaseSyncService.syncProduct(pUpdated);
        return pUpdated;
      }
      return p;
    }).toList();

    state = state.copyWith(allProducts: updatedProducts);
  }
}

final catalogProvider =
    StateNotifierProvider<CatalogNotifier, CatalogState>((ref) {
  return CatalogNotifier();
});
