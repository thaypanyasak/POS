import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../data/remote/supabase_sync_service.dart';
import '../../../../domain/models/category_model.dart';
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
  final List<CategoryModel> rawCategories;
  final bool isLoading;

  const CatalogState({
    required this.allProducts,
    required this.selectedCategory,
    required this.searchQuery,
    required this.categories,
    this.rawCategories = const [],
    this.isLoading = false,
  });

  /// Filtered product catalog according to selected category and search input
  List<Product> get filteredProducts {
    return allProducts.where((product) {
      final matchesCategory = selectedCategory == 'ທັງໝົດ' ||
          product.category == selectedCategory ||
          product.categoryId == selectedCategory;
      if (!matchesCategory) return false;

      if (searchQuery.trim().isEmpty) return true;

      final query = searchQuery.trim().toLowerCase();
      final matchesName = product.name.toLowerCase().contains(query);
      final matchesCategoryName = product.category.toLowerCase().contains(query);
      final matchesBarcode = (product.barcode != null &&
              product.barcode!.toLowerCase().contains(query)) ||
          product.units.any(
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
    List<CategoryModel>? rawCategories,
    bool? isLoading,
  }) {
    return CatalogState(
      allProducts: allProducts ?? this.allProducts,
      selectedCategory: selectedCategory ?? this.selectedCategory,
      searchQuery: searchQuery ?? this.searchQuery,
      categories: categories ?? this.categories,
      rawCategories: rawCategories ?? this.rawCategories,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

class CatalogNotifier extends StateNotifier<CatalogState> {
  CatalogNotifier()
      : super(
          const CatalogState(
            allProducts: [],
            selectedCategory: 'ທັງໝົດ',
            searchQuery: '',
            categories: ['ທັງໝົດ'],
            rawCategories: [],
          ),
        ) {
    // Automatically load products and categories from Supabase on startup
    fetchFromSupabase();
  }

  /// Extracts categories list from DB categories or distinct products without hardcoding
  static List<String> _buildCategoriesList({
    List<CategoryModel>? rawCategories,
    List<Product>? products,
    List<String>? currentCategories,
  }) {
    final Set<String> distinct = {'ທັງໝົດ'};

    if (rawCategories != null && rawCategories.isNotEmpty) {
      for (final cat in rawCategories) {
        final clean = cat.name.trim();
        if (clean.isNotEmpty && clean != 'ທັງໝົດ') {
          distinct.add(clean);
        }
      }
    }

    if (products != null && products.isNotEmpty) {
      for (final p in products) {
        final clean = p.category.trim();
        if (clean.isNotEmpty && clean != 'ທັງໝົດ') {
          distinct.add(clean);
        }
      }
    }

    if (currentCategories != null) {
      for (final c in currentCategories) {
        final clean = c.trim();
        if (clean.isNotEmpty && clean != 'ທັງໝົດ') {
          distinct.add(clean);
        }
      }
    }

    return distinct.toList();
  }

  /// Fetches products and categories dynamically from Supabase Cloud Database
  Future<void> fetchFromSupabase() async {
    state = state.copyWith(isLoading: true);
    try {
      final results = await Future.wait([
        SupabaseSyncService.fetchProducts(),
        SupabaseSyncService.fetchCategoriesDetailed(),
      ]);

      final remoteProducts = results[0] as List<Product>?;
      final rawCats = results[1] as List<CategoryModel>? ?? [];

      final prods = remoteProducts ?? state.allProducts;
      final categoriesList = _buildCategoriesList(
        rawCategories: rawCats,
        products: prods,
        currentCategories: state.categories,
      );

      state = state.copyWith(
        allProducts: prods,
        rawCategories: rawCats,
        categories: categoriesList,
        isLoading: false,
      );
    } catch (_) {
      state = state.copyWith(isLoading: false);
    }
  }

  /// Creates a new category and cascades to state
  Future<CategoryModel?> createCategory(String name) async {
    final clean = name.trim();
    if (clean.isEmpty) return null;

    final created = await SupabaseSyncService.createCategoryDetailed(
      clean,
      sortOrder: state.rawCategories.length + 1,
    );

    if (created != null) {
      final updatedRaw = [...state.rawCategories, created];
      final updatedNames = _buildCategoriesList(
        rawCategories: updatedRaw,
        products: state.allProducts,
      );
      state = state.copyWith(
        rawCategories: updatedRaw,
        categories: updatedNames,
      );
      return created;
    }
    return null;
  }

  /// Updates Category name & cascades to state & products
  Future<bool> updateCategory(String id, String newName, String? oldName) async {
    final clean = newName.trim();
    if (clean.isEmpty) return false;

    final success = await SupabaseSyncService.updateCategory(
      id: id,
      newName: clean,
      oldName: oldName,
    );

    if (success) {
      // 1. Update rawCategories
      final updatedRaw = state.rawCategories
          .map((c) => c.id == id ? c.copyWith(name: clean) : c)
          .toList();

      // 2. Cascade directly to allProducts in memory so UI reflects immediately
      final updatedProducts = state.allProducts.map((p) {
        if (p.categoryId == id || p.category == oldName) {
          return p.copyWith(
            category: clean,
            categoryId: id,
          );
        }
        return p;
      }).toList();

      // 3. Update category chips
      final updatedNames = _buildCategoriesList(
        rawCategories: updatedRaw,
        products: updatedProducts,
      );

      String currentSelected = state.selectedCategory;
      if (currentSelected == oldName) {
        currentSelected = clean;
      }

      state = state.copyWith(
        rawCategories: updatedRaw,
        allProducts: updatedProducts,
        categories: updatedNames,
        selectedCategory: currentSelected,
      );
      return true;
    }
    return false;
  }

  /// Deletes category safely
  Future<String?> deleteCategory(String id, String categoryName) async {
    final err = await SupabaseSyncService.deleteCategorySafely(
      id: id,
      categoryName: categoryName,
    );

    if (err == null) {
      final updatedRaw = state.rawCategories.where((c) => c.id != id).toList();
      final updatedNames = _buildCategoriesList(
        rawCategories: updatedRaw,
        products: state.allProducts,
      );
      String currentSelected = state.selectedCategory;
      if (currentSelected == categoryName) {
        currentSelected = 'ທັງໝົດ';
      }
      state = state.copyWith(
        rawCategories: updatedRaw,
        categories: updatedNames,
        selectedCategory: currentSelected,
      );
      return null;
    }
    return err;
  }

  /// Dynamically adds a new category tab and selects it, saving to Supabase
  void addCategory(String newCategory) {
    createCategory(newCategory);
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
  /// Matches both product-level barcode and packaging unit-level barcode,
  /// trimmed and case-insensitive (matching web app behavior).
  BarcodeMatchResult? findProductByBarcode(String barcode) {
    final cleanBarcode = barcode.trim().toLowerCase();
    if (cleanBarcode.isEmpty) return null;

    for (final product in state.allProducts) {
      // 1. Check if matches any unit's barcode
      for (final unit in product.units) {
        if (unit.barcode != null && unit.barcode!.trim().toLowerCase() == cleanBarcode) {
          return BarcodeMatchResult(product: product, unit: unit);
        }
      }

      // 2. Check if matches product-level barcode
      if (product.barcode != null && product.barcode!.trim().toLowerCase() == cleanBarcode) {
        return BarcodeMatchResult(
          product: product,
          unit: product.units.isNotEmpty ? product.defaultBaseUnit : product.units.first,
        );
      }
    }
    return null;
  }

  /// Adds or updates a product in the catalog and syncs to Supabase
  Future<bool> upsertProduct(Product product) async {
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
      categories: _buildCategoriesList(
        rawCategories: state.rawCategories,
        products: updated,
        currentCategories: state.categories,
      ),
    );

    // Push to Supabase Cloud and re-fetch to ensure sync consistency
    final ok = await SupabaseSyncService.syncProduct(product);
    if (ok) {
      // Re-fetch to ensure relationships and IDs match remote source
      await fetchFromSupabase();
    }
    return ok;
  }

  /// Deletes a product from the catalog and Supabase
  Future<bool> deleteProduct(String productId) async {
    final updated = state.allProducts.where((p) => p.id != productId).toList();
    state = state.copyWith(
      allProducts: updated,
      categories: _buildCategoriesList(
        rawCategories: state.rawCategories,
        products: updated,
        currentCategories: state.categories,
      ),
    );

    // Delete from Supabase Cloud
    final ok = await SupabaseSyncService.deleteProduct(productId);
    if (ok) {
      await fetchFromSupabase();
    }
    return ok;
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

  /// Inline price adjustment for a specific unit
  void updateUnitPrice(String productId, String unitId, int newRetailPrice) {
    Product? updatedProduct;
    final updated = state.allProducts.map((p) {
      if (p.id == productId) {
        final updatedUnits = p.units.map((u) {
          if (u.id == unitId) {
            return u.copyWith(retailPrice: newRetailPrice);
          }
          return u;
        }).toList();

        final pUpdated = p.copyWith(units: updatedUnits);
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

  /// Syncs product to state and Supabase (alias for upsertProduct)
  Future<bool> syncProduct(Product product) => upsertProduct(product);

  /// Deducts stock based on sold transaction items
  void deductStockFromTransaction(SaleTransaction transaction) {
    final Map<String, int> qtyToDeduct = {};
    for (final item in transaction.items) {
      final baseUnits = item.quantity * item.selectedUnit.multiplier;
      qtyToDeduct[item.product.id] = (qtyToDeduct[item.product.id] ?? 0) + baseUnits;
    }

    final updated = state.allProducts.map((p) {
      if (qtyToDeduct.containsKey(p.id) && p.trackStock) {
        final deduct = qtyToDeduct[p.id]!;
        final newStock = p.currentStockBaseUnits - deduct;
        final updatedP = p.copyWith(currentStockBaseUnits: newStock >= 0 ? newStock : 0);
        SupabaseSyncService.syncProduct(updatedP);
        return updatedP;
      }
      return p;
    }).toList();

    state = state.copyWith(allProducts: updated);
  }

  /// Restores stock when transaction is cancelled or deleted
  void restoreStockFromTransaction(SaleTransaction transaction) {
    final Map<String, int> qtyToRestore = {};
    for (final item in transaction.items) {
      final baseUnits = item.quantity * item.selectedUnit.multiplier;
      qtyToRestore[item.product.id] = (qtyToRestore[item.product.id] ?? 0) + baseUnits;
    }

    final updated = state.allProducts.map((p) {
      if (qtyToRestore.containsKey(p.id) && p.trackStock) {
        final restore = qtyToRestore[p.id]!;
        final newStock = p.currentStockBaseUnits + restore;
        final updatedP = p.copyWith(currentStockBaseUnits: newStock);
        SupabaseSyncService.syncProduct(updatedP);
        return updatedP;
      }
      return p;
    }).toList();

    state = state.copyWith(allProducts: updated);
  }
}

/// Global provider for catalog state
final catalogProvider =
    StateNotifierProvider<CatalogNotifier, CatalogState>((ref) {
  return CatalogNotifier();
});
