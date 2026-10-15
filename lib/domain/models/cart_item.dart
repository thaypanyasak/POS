import 'product.dart';
import 'product_unit.dart';

/// Cart line item representing a chosen product, packaging unit, price structure,
/// and specialized crate deposit / missing empty crate logic.
class CartItem {
  final String id;
  final Product product;
  final ProductUnit selectedUnit;
  final int quantity;
  final bool isWholesaleMode;
  final int? customPrice; // On-the-fly override price per unit
  final String? overrideReason; // e.g., "ລູກຄ້າປະຈຳ"
  final bool noEmptyCrates; // Checkbox for missing empty crate (ບໍ່ມີແກັດປ່ຽນ)
  final int? missingCratesCount; // Count of crates customer doesn't have to return

  const CartItem({
    required this.id,
    required this.product,
    required this.selectedUnit,
    this.quantity = 1,
    this.isWholesaleMode = false,
    this.customPrice,
    this.overrideReason,
    this.noEmptyCrates = false,
    this.missingCratesCount,
  });

  /// Specialized Crate Deposit / Missing Crate Fee Eligibility Check
  bool get isCrateEligible {
    return product.hasCrateDeposit ||
        ((product.category.contains('ເບຍ') || product.name.contains('ເບຍ')) &&
            (selectedUnit.unitName == 'ແກັດ' ||
                selectedUnit.unitName == 'ລັງ' ||
                selectedUnit.multiplier >= 12));
  }

  /// Deposit fee per crate (default 30.000 Kip)
  int get feePerCrate {
    return product.crateDepositFee > 0 ? product.crateDepositFee : 30000;
  }

  /// Effective number of missing crates (clamped between 1 and quantity)
  int get effectiveMissingCratesCount {
    if (!noEmptyCrates) return 0;
    final count = missingCratesCount ?? quantity;
    return count.clamp(1, quantity);
  }

  /// Total crate deposit surcharge for this line
  int get crateFeeTotal {
    return noEmptyCrates ? effectiveMissingCratesCount * feePerCrate : 0;
  }

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

  /// Pure line goods total before crate deposit and discount
  int get lineGoodsSubtotal {
    return originalUnitPrice * quantity;
  }

  /// Pure line goods total after discount (without crate deposit)
  int get lineGoodsTotal {
    return effectiveUnitPrice * quantity;
  }

  /// Line catalog total before discount (including crate deposit)
  int get lineSubtotal {
    return lineGoodsSubtotal + crateFeeTotal;
  }

  /// Line discount total
  int get lineDiscountTotal {
    return (discountPerUnit > 0 ? discountPerUnit : 0) * quantity;
  }

  /// Total amount charged for this line: (effectiveUnitPrice * quantity) + crateFeeTotal
  int get lineTotal {
    return lineGoodsTotal + crateFeeTotal;
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

  /// Total gross profit for this line item (crate fee is passed through/not counted as pure COGS)
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
    bool? noEmptyCrates,
    int? missingCratesCount,
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
      noEmptyCrates: noEmptyCrates ?? this.noEmptyCrates,
      missingCratesCount: missingCratesCount ?? this.missingCratesCount,
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
      'no_empty_crates': noEmptyCrates,
      'missing_crates_count': missingCratesCount,
      'fee_per_crate': feePerCrate,
      'crate_fee_total': crateFeeTotal,
      'original_unit_price': originalUnitPrice,
      'effective_unit_price': effectiveUnitPrice,
      'line_goods_total': lineGoodsTotal,
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
      noEmptyCrates: json['no_empty_crates'] as bool? ??
          json['noEmptyCrates'] as bool? ??
          false,
      missingCratesCount: (json['missing_crates_count'] as num?)?.toInt() ??
          (json['missingCratesCount'] as num?)?.toInt(),
    );
  }
}
