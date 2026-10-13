/// Product Unit representing multi-tier packaging
/// (e.g., 1 ແກັດ = 6 ແພັກ = 24 ກະປ໋ອງ)
class ProductUnit {
  final String id;
  final String productId;
  final String unitName; // e.g. "ແກັດ", "ແພັກ", "ກະປ໋ອງ", "ອັນ"
  final int multiplier; // conversion rate to base unit (e.g. 24, 6, 1)
  final int retailPrice; // retail selling price in Lao Kip (₭)
  final int wholesalePrice; // wholesale selling price in Lao Kip (₭)
  final String? barcode;
  final bool isBaseUnit;

  const ProductUnit({
    required this.id,
    required this.productId,
    required this.unitName,
    required this.multiplier,
    required this.retailPrice,
    required this.wholesalePrice,
    this.barcode,
    this.isBaseUnit = false,
  });

  /// Returns the effective price given wholesale mode flag
  int priceForMode({required bool isWholesale}) {
    return isWholesale ? wholesalePrice : retailPrice;
  }

  /// Calculates cost for this packaging unit based on cost per base unit
  int costForUnit(int costPerBaseUnit) {
    return costPerBaseUnit * multiplier;
  }

  /// Calculates theoretical gross profit per unit sold
  int unitGrossProfit({
    required int costPerBaseUnit,
    required bool isWholesale,
    int? overridePrice,
  }) {
    final effectivePrice = overridePrice ?? priceForMode(isWholesale: isWholesale);
    return effectivePrice - costForUnit(costPerBaseUnit);
  }

  ProductUnit copyWith({
    String? id,
    String? productId,
    String? unitName,
    int? multiplier,
    int? retailPrice,
    int? wholesalePrice,
    String? barcode,
    bool? isBaseUnit,
  }) {
    return ProductUnit(
      id: id ?? this.id,
      productId: productId ?? this.productId,
      unitName: unitName ?? this.unitName,
      multiplier: multiplier ?? this.multiplier,
      retailPrice: retailPrice ?? this.retailPrice,
      wholesalePrice: wholesalePrice ?? this.wholesalePrice,
      barcode: barcode ?? this.barcode,
      isBaseUnit: isBaseUnit ?? this.isBaseUnit,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'product_id': productId,
      'unit_name': unitName,
      'multiplier': multiplier,
      'retail_price': retailPrice,
      'wholesale_price': wholesalePrice,
      'barcode': barcode,
      'is_base_unit': isBaseUnit,
    };
  }

  factory ProductUnit.fromJson(Map<String, dynamic> json) {
    return ProductUnit(
      id: json['id'] as String,
      productId: json['product_id'] as String,
      unitName: json['unit_name'] as String,
      multiplier: (json['multiplier'] as num).toInt(),
      retailPrice: (json['retail_price'] as num).toInt(),
      wholesalePrice: (json['wholesale_price'] as num).toInt(),
      barcode: json['barcode'] as String?,
      isBaseUnit: json['is_base_unit'] as bool? ?? false,
    );
  }
}
