import 'product.dart';
import 'product_unit.dart';

/// Cart line item representing a chosen product, packaging unit, and price structure
class CartItem {
  final String id;
  final Product product;
  final ProductUnit selectedUnit;
  final int quantity;
  final bool isWholesaleMode;
  final int? customPrice; // On-the-fly override price per unit
  final String? overrideReason; // e.g., "ລູກຄ້າປະຈຳ"

  const CartItem({
    required this.id,
    required this.product,
    required this.selectedUnit,
    this.quantity = 1,
    this.isWholesaleMode = false,
    this.customPrice,
    this.overrideReason,
  });

  /// Catalog price before any custom override
  int get originalUnitPrice {
    return selectedUnit.priceForMode(isWholesale: isWholesaleMode);
  }

  /// Final selling price per unit (after optional override)
  int get effectiveUnitPrice {
    return customPrice ?? originalUnitPrice;
  }

  /// Has this line item had a price override applied?
  bool get isPriceOverridden => customPrice != null && customPrice != originalUnitPrice;

  /// Discount amount per unit (positive if discounted, negative if marked up)
  int get discountPerUnit {
    return originalUnitPrice - effectiveUnitPrice;
  }

  /// Line catalog total before discount
  int get lineSubtotal {
    return originalUnitPrice * quantity;
  }

  /// Line discount total
  int get lineDiscountTotal {
    return (discountPerUnit > 0 ? discountPerUnit : 0) * quantity;
  }

  /// Total amount charged for this line
  int get lineTotal {
    return effectiveUnitPrice * quantity;
  }

  /// Cost of goods for this unit: `cost_per_base_unit * multiplier`
  int get unitCost {
    return product.costPerBaseUnit * selectedUnit.multiplier;
  }

  /// Total cost of goods for this line: `unitCost * quantity`
  int get lineTotalCost {
    return unitCost * quantity;
  }

  /// Profit per unit sold:
  /// Formula: `profit = sold_price - (cost_per_base_unit * multiplier)`
  int get unitProfit {
    return effectiveUnitPrice - unitCost;
  }

  /// Total gross profit for this line item
  int get lineProfit {
    return lineTotal - lineTotalCost;
  }

  /// Profit margin percentage: `(lineProfit / lineTotal) * 100`
  double get profitMarginPercent {
    if (lineTotal == 0) return 0.0;
    return (lineProfit / lineTotal) * 100.0;
  }

  /// Total base units that will be deducted from inventory
  int get totalBaseUnitsDeducted {
    return selectedUnit.multiplier * quantity;
  }

  CartItem copyWith({
    String? id,
    Product? product,
    ProductUnit? selectedUnit,
    int? quantity,
    bool? isWholesaleMode,
    int? customPrice,
    String? overrideReason,
    bool clearOverride = false,
  }) {
    return CartItem(
      id: id ?? this.id,
      product: product ?? this.product,
      selectedUnit: selectedUnit ?? this.selectedUnit,
      quantity: quantity ?? this.quantity,
      isWholesaleMode: isWholesaleMode ?? this.isWholesaleMode,
      customPrice: clearOverride ? null : (customPrice ?? this.customPrice),
      overrideReason:
          clearOverride ? null : (overrideReason ?? this.overrideReason),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'product': product.toJson(),
      'selected_unit': selectedUnit.toJson(),
      'quantity': quantity,
      'is_wholesale_mode': isWholesaleMode,
      'custom_price': customPrice,
      'override_reason': overrideReason,
      'original_unit_price': originalUnitPrice,
      'effective_unit_price': effectiveUnitPrice,
      'line_total': lineTotal,
      'line_profit': lineProfit,
      'base_units_deducted': totalBaseUnitsDeducted,
    };
  }

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      id: json['id'] as String,
      product: Product.fromJson(json['product'] as Map<String, dynamic>),
      selectedUnit:
          ProductUnit.fromJson(json['selected_unit'] as Map<String, dynamic>),
      quantity: (json['quantity'] as num).toInt(),
      isWholesaleMode: json['is_wholesale_mode'] as bool? ?? false,
      customPrice: (json['custom_price'] as num?)?.toInt(),
      overrideReason: json['override_reason'] as String?,
    );
  }
}
