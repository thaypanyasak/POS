class PurchaseOrderItemModel {
  final String id;
  final String purchaseOrderId;
  final String productId;
  final String productName;
  final int costPerBaseUnit;
  final double costThb;
  final int costLak;
  final int costVnd;
  final int importedBaseUnits;
  final int tier1Qty;
  final int tier2Qty;
  final int tier3Qty;
  final String? unitId;
  final String? unitName;
  final int? tierLevel;
  final int? quantity;
  final DateTime createdAt;

  PurchaseOrderItemModel({
    required this.id,
    required this.purchaseOrderId,
    required this.productId,
    required this.productName,
    required this.costPerBaseUnit,
    this.costThb = 0.0,
    required this.costLak,
    this.costVnd = 0,
    required this.importedBaseUnits,
    this.tier1Qty = 0,
    this.tier2Qty = 0,
    this.tier3Qty = 0,
    this.unitId,
    this.unitName,
    this.tierLevel,
    this.quantity,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  factory PurchaseOrderItemModel.fromJson(Map<String, dynamic> json) {
    return PurchaseOrderItemModel(
      id: json['id']?.toString() ?? '',
      purchaseOrderId: json['purchase_order_id']?.toString() ?? '',
      productId: json['product_id']?.toString() ?? '',
      productName: json['product_name']?.toString() ?? '',
      costPerBaseUnit: (json['cost_per_base_unit'] as num?)?.toInt() ?? 0,
      costThb: (json['cost_thb'] as num?)?.toDouble() ?? 0.0,
      costLak: (json['cost_lak'] as num?)?.toInt() ?? 0,
      costVnd: (json['cost_vnd'] as num?)?.toInt() ?? 0,
      importedBaseUnits: (json['imported_base_units'] as num?)?.toInt() ?? (json['base_units_added'] as num?)?.toInt() ?? 0,
      tier1Qty: (json['tier1_qty'] as num?)?.toInt() ?? 0,
      tier2Qty: (json['tier2_qty'] as num?)?.toInt() ?? 0,
      tier3Qty: (json['tier3_qty'] as num?)?.toInt() ?? 0,
      unitId: json['unit_id']?.toString(),
      unitName: json['unit_name']?.toString(),
      tierLevel: (json['tier_level'] as num?)?.toInt(),
      quantity: (json['quantity'] as num?)?.toInt(),
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'purchase_order_id': purchaseOrderId,
      'product_id': productId,
      'product_name': productName,
      'cost_per_base_unit': costPerBaseUnit,
      'cost_thb': costThb,
      'cost_lak': costLak,
      'cost_vnd': costVnd,
      'imported_base_units': importedBaseUnits,
      'tier1_qty': tier1Qty,
      'tier2_qty': tier2Qty,
      'tier3_qty': tier3Qty,
      if (unitId != null) 'unit_id': unitId,
      if (unitName != null) 'unit_name': unitName,
      if (tierLevel != null) 'tier_level': tierLevel,
      if (quantity != null) 'quantity': quantity,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
