import 'product_unit.dart';

/// Product domain entity for Lao Grocery POS & Backoffice
/// Encapsulates multi-tier units, cost, untracked/negative stock rules,
/// barcode, and compound stock display logic.
class Product {
  final String id;
  final String name; // Lao product name (e.g. ເບຍລາວ ຂວດໃຫຍ່ 640ml)
  final String category; // e.g. ເຄື່ອງດື່ມ, ເບຍ/ເຫຼົ້າ, ເຂົ້າໜົມ
  final String? barcode;
  final String? imageUrl;
  final String baseUnit; // Smallest stock keeping unit (e.g. "ແກ້ວ", "ກະປ໋ອງ", "ແພັກ", "ອັນ")
  final int costPerBaseUnit; // Wholesale cost per base unit in Lao Kip (₭)
  final int currentStockBaseUnits; // Inventory count in base unit
  final bool trackStock; // If false, allow continuous checkout even into negative stock
  final List<ProductUnit> units; // Multi-tier unit packaging options

  const Product({
    required this.id,
    required this.name,
    required this.category,
    this.barcode,
    this.imageUrl,
    required this.baseUnit,
    required this.costPerBaseUnit,
    required this.currentStockBaseUnits,
    this.trackStock = true,
    required this.units,
  });

  /// Alias for stock quantity in base units
  int get stockQuantity => currentStockBaseUnits;

  /// Base unit representation
  ProductUnit get defaultBaseUnit {
    return units.firstWhere(
      (u) => u.multiplier == 1 || u.isBaseUnit,
      orElse: () => units.isNotEmpty
          ? units.reduce((a, b) => a.multiplier < b.multiplier ? a : b)
          : ProductUnit(
              id: '${id}_base',
              productId: id,
              unitName: baseUnit,
              multiplier: 1,
              retailPrice: 0,
              wholesalePrice: 0,
              isBaseUnit: true,
            ),
    );
  }

  /// Highest multiplier unit (e.g., ແກັດ / Carton)
  ProductUnit get highestTierUnit {
    if (units.isEmpty) return defaultBaseUnit;
    return units.reduce((a, b) => a.multiplier > b.multiplier ? a : b);
  }

  /// Sub-tier (smallest unit sold individually, e.g. "ແກ້ວ", "ແພັກ", "ກະປ໋ອງ")
  ProductUnit get subTierUnit {
    return units.firstWhere(
      (u) => u.multiplier == 1 || u.isBaseUnit,
      orElse: () => defaultBaseUnit,
    );
  }

  /// Large tier (Carton / Box / "ແກັດ")
  ProductUnit get cartonTierUnit {
    return units.firstWhere(
      (u) => u.multiplier > 1 || u.unitName.contains('ແກັດ'),
      orElse: () => highestTierUnit,
    );
  }

  /// Compound Stock Display Formatter
  ///
  /// Displays remaining base units as `X ແກັດ Y [baseUnit]` dynamically using `~/` and `%`.
  /// Handles untracked stock (`ບໍ່ນັບສາງ`) and negative stock.
  String get compoundStockFormatted {
    if (!trackStock) {
      return 'ບໍ່ນັບສາງ';
    }

    if (currentStockBaseUnits < 0) {
      return 'ຕິດລົບ: $currentStockBaseUnits $baseUnit';
    }

    if (currentStockBaseUnits == 0) {
      return 'ໝົດສາງ (0 $baseUnit)';
    }

    // Find carton unit (multiplier > 1 or unitName contains ແກັດ)
    final cartonUnits = units.where((u) => u.multiplier > 1).toList();
    if (cartonUnits.isEmpty) {
      return '$currentStockBaseUnits $baseUnit';
    }

    final cartonUnit = cartonUnits.reduce((a, b) => a.multiplier > b.multiplier ? a : b);
    final cartons = currentStockBaseUnits ~/ cartonUnit.multiplier;
    final loose = currentStockBaseUnits % cartonUnit.multiplier;

    if (cartons > 0 && loose > 0) {
      return '$cartons ແກັດ $loose $baseUnit';
    } else if (cartons > 0) {
      return '$cartons ແກັດ';
    } else {
      return '$loose $baseUnit';
    }
  }

  /// Formats compound stock to Boxes and Packs (alias method)
  String formatStockToBoxesAndPacks() => compoundStockFormatted;

  /// Short summary for compact cards (e.g. `12 ແກັດ 4 ແພັກ`)
  String get stockBadgeText {
    if (!trackStock) return 'ບໍ່ນັບສາງ';
    if (currentStockBaseUnits <= 0) return 'ໝົດສາງ';
    return compoundStockFormatted;
  }

  /// Check if a specific unit quantity can be fulfilled
  bool canFulfill(ProductUnit unit, int quantity) {
    if (!trackStock) return true;
    final requiredBase = unit.multiplier * quantity;
    return currentStockBaseUnits >= requiredBase;
  }

  Product copyWith({
    String? id,
    String? name,
    String? category,
    String? barcode,
    String? imageUrl,
    String? baseUnit,
    int? costPerBaseUnit,
    int? currentStockBaseUnits,
    bool? trackStock,
    List<ProductUnit>? units,
  }) {
    return Product(
      id: id ?? this.id,
      name: name ?? this.name,
      category: category ?? this.category,
      barcode: barcode ?? this.barcode,
      imageUrl: imageUrl ?? this.imageUrl,
      baseUnit: baseUnit ?? this.baseUnit,
      costPerBaseUnit: costPerBaseUnit ?? this.costPerBaseUnit,
      currentStockBaseUnits:
          currentStockBaseUnits ?? this.currentStockBaseUnits,
      trackStock: trackStock ?? this.trackStock,
      units: units ?? this.units,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'category': category,
      'barcode': barcode,
      'image_url': imageUrl,
      'base_unit': baseUnit,
      'cost_per_base_unit': costPerBaseUnit,
      'current_stock_base_units': currentStockBaseUnits,
      'track_stock': trackStock,
      'units': units.map((u) => u.toJson()).toList(),
    };
  }

  factory Product.fromJson(Map<String, dynamic> json) {
    final rawUnits = json['units'] ?? json['product_units'];
    final unitsList = (rawUnits as List<dynamic>?)
            ?.map((u) => ProductUnit.fromJson(u as Map<String, dynamic>))
            .toList() ??
        [];
    return Product(
      id: json['id'] as String,
      name: json['name'] as String,
      category: json['category'] as String,
      barcode: json['barcode'] as String?,
      imageUrl: json['image_url'] as String?,
      baseUnit: json['base_unit'] as String? ?? 'ແພັກ',
      costPerBaseUnit: (json['cost_per_base_unit'] as num?)?.toInt() ?? 0,
      currentStockBaseUnits:
          (json['current_stock_base_units'] as num?)?.toInt() ?? 0,
      trackStock: json['track_stock'] as bool? ?? true,
      units: unitsList,
    );
  }
}
