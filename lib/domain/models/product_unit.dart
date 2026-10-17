/// Product Unit representing multi-tier packaging
/// (e.g., 1 ແກັດ = 6 ແພັກ = 24 ກະປ໋ອງ)
class ProductUnit {
  final String id;
  final String productId;
  final String unitName; // e.g. "ແກັດ", "ແພັກ", "ກະປ໋ອງ", "ອັນ"
  final int multiplier; // conversion rate to base unit (e.g. 24, 6, 1)
  final int retailPrice; // retail selling price in Lao Kip (₭) [Tier 1: ມາດຕະຖານ]
  final int wholesalePrice; // wholesale selling price in Lao Kip (₭)
  final int? price2; // Tier 2: ລູກຄ້າປະຈຳ (Regular customer)
  final int? price3; // Tier 3: ລາຄາສົ່ງ / VIP (Wholesale / VIP)
  final String? barcode;
  final bool isBaseUnit;
  final int? tier; // 1: piece, 2: pack, 3: carton
  final bool isActive;

  const ProductUnit({
    required this.id,
    required this.productId,
    required this.unitName,
    required this.multiplier,
    required this.retailPrice,
    required this.wholesalePrice,
    this.price2,
    this.price3,
    this.barcode,
    this.isBaseUnit = false,
    this.tier,
    this.isActive = true,
  });

  /// Returns the effective price given price tier (1: Standard, 2: Regular, 3: Wholesale/VIP)
  int priceForTier(int tier) {
    if (tier == 2) {
      return (price2 != null && price2! > 0) ? price2! : retailPrice;
    }
    if (tier == 3) {
      return (price3 != null && price3! > 0) ? price3! : retailPrice;
    }
    return retailPrice;
  }

  /// Returns the effective price given wholesale mode flag
  int priceForMode({required bool isWholesale}) {
    if (isWholesale) {
      return (price3 != null && price3! > 0) ? price3! : wholesalePrice;
    }
    return retailPrice;
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
    int? price2,
    int? price3,
    String? barcode,
    bool? isBaseUnit,
    int? tier,
    bool? isActive,
  }) {
    return ProductUnit(
      id: id ?? this.id,
      productId: productId ?? this.productId,
      unitName: unitName ?? this.unitName,
      multiplier: multiplier ?? this.multiplier,
      retailPrice: retailPrice ?? this.retailPrice,
      wholesalePrice: wholesalePrice ?? this.wholesalePrice,
      price2: price2 ?? this.price2,
      price3: price3 ?? this.price3,
      barcode: barcode ?? this.barcode,
      isBaseUnit: isBaseUnit ?? this.isBaseUnit,
      tier: tier ?? this.tier,
      isActive: isActive ?? this.isActive,
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
      'price_2': price2 ?? retailPrice,
      'price_3': price3 ?? retailPrice,
      'barcode': barcode,
      'is_base_unit': isBaseUnit,
      'tier': tier,
      'is_active': isActive,
    };
  }

  factory ProductUnit.fromJson(Map<String, dynamic> json) {
    final rPrice = (json['retail_price'] as num?)?.toInt() ?? 0;
    return ProductUnit(
      id: json['id']?.toString() ?? '',
      productId: json['product_id']?.toString() ?? '',
      unitName: json['unit_name']?.toString() ?? 'ອັນ',
      multiplier: (json['multiplier'] as num?)?.toInt() ?? 1,
      retailPrice: rPrice,
      wholesalePrice: (json['wholesale_price'] as num?)?.toInt() ?? rPrice,
      price2: (json['price_2'] as num?)?.toInt() ?? (json['price2'] as num?)?.toInt() ?? rPrice,
      price3: (json['price_3'] as num?)?.toInt() ?? (json['price3'] as num?)?.toInt() ?? rPrice,
      barcode: json['barcode']?.toString(),
      isBaseUnit: json['is_base_unit'] as bool? ?? false,
      tier: (json['tier'] as num?)?.toInt(),
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}
