import 'purchase_order_item_model.dart';
import 'supplier_model.dart';

class SupplierDebtPaymentModel {
  final String id;
  final String purchaseOrderId;
  final int paymentAmount;
  final String currency;
  final String paymentMethod; // CASH, TRANSFER
  final String? note;
  final DateTime createdAt;

  SupplierDebtPaymentModel({
    required this.id,
    required this.purchaseOrderId,
    required this.paymentAmount,
    this.currency = 'LAK',
    this.paymentMethod = 'CASH',
    this.note,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  factory SupplierDebtPaymentModel.fromJson(Map<String, dynamic> json) {
    return SupplierDebtPaymentModel(
      id: json['id']?.toString() ?? '',
      purchaseOrderId: json['purchase_order_id']?.toString() ?? '',
      paymentAmount: (json['payment_amount'] as num?)?.toInt() ?? 0,
      currency: json['currency']?.toString() ?? 'LAK',
      paymentMethod: json['payment_method']?.toString() ?? 'CASH',
      note: json['note']?.toString(),
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'purchase_order_id': purchaseOrderId,
      'payment_amount': paymentAmount,
      'currency': currency,
      'payment_method': paymentMethod,
      if (note != null) 'note': note,
      'created_at': createdAt.toIso8601String(),
    };
  }
}

class PurchaseOrderModel {
  final String id;
  final String? supplierId;
  final SupplierModel? supplier;
  final String? productId;
  final String? productName;
  final int importedBaseUnits;
  final int tier1Qty;
  final int tier2Qty;
  final int tier3Qty;
  final double costThb;
  final int costLak;
  final int costPerBaseUnit;
  final int totalCostLak;
  final double totalCostThb;
  final int totalCostVnd;
  final String primaryCurrency; // LAK, THB, VND
  final int paidAmount;
  final int debtAmount;
  final String paymentStatus; // PAID, PARTIAL, DEBT
  final String? receivedBy;
  final String? note;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<PurchaseOrderItemModel> items;
  final List<SupplierDebtPaymentModel> payments;

  PurchaseOrderModel({
    required this.id,
    this.supplierId,
    this.supplier,
    this.productId,
    this.productName,
    this.importedBaseUnits = 0,
    this.tier1Qty = 0,
    this.tier2Qty = 0,
    this.tier3Qty = 0,
    this.costThb = 0.0,
    this.costLak = 0,
    this.costPerBaseUnit = 0,
    this.totalCostLak = 0,
    this.totalCostThb = 0.0,
    this.totalCostVnd = 0,
    this.primaryCurrency = 'LAK',
    this.paidAmount = 0,
    this.debtAmount = 0,
    this.paymentStatus = 'PAID',
    this.receivedBy,
    this.note,
    DateTime? createdAt,
    DateTime? updatedAt,
    this.items = const [],
    this.payments = const [],
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  factory PurchaseOrderModel.fromJson(
    Map<String, dynamic> json, {
    SupplierModel? supplier,
    List<PurchaseOrderItemModel>? items,
    List<SupplierDebtPaymentModel>? payments,
  }) {
    SupplierModel? resolvedSupplier = supplier;
    if (resolvedSupplier == null && json['suppliers'] != null) {
      resolvedSupplier = SupplierModel.fromJson(json['suppliers'] as Map<String, dynamic>);
    }

    List<PurchaseOrderItemModel> resolvedItems = items ?? [];
    if (resolvedItems.isEmpty && json['purchase_order_items'] is List) {
      resolvedItems = (json['purchase_order_items'] as List)
          .map((i) => PurchaseOrderItemModel.fromJson(i as Map<String, dynamic>))
          .toList();
    }

    List<SupplierDebtPaymentModel> resolvedPayments = payments ?? [];
    if (resolvedPayments.isEmpty && json['supplier_debt_payments'] is List) {
      resolvedPayments = (json['supplier_debt_payments'] as List)
          .map((p) => SupplierDebtPaymentModel.fromJson(p as Map<String, dynamic>))
          .toList();
    }

    return PurchaseOrderModel(
      id: json['id']?.toString() ?? '',
      supplierId: json['supplier_id']?.toString(),
      supplier: resolvedSupplier,
      productId: json['product_id']?.toString(),
      productName: json['product_name']?.toString() ?? resolvedItems.firstOrNull?.productName,
      importedBaseUnits: (json['imported_base_units'] as num?)?.toInt() ?? (resolvedItems.firstOrNull?.importedBaseUnits ?? 0),
      tier1Qty: (json['tier1_qty'] as num?)?.toInt() ?? (resolvedItems.firstOrNull?.tier1Qty ?? 0),
      tier2Qty: (json['tier2_qty'] as num?)?.toInt() ?? (resolvedItems.firstOrNull?.tier2Qty ?? 0),
      tier3Qty: (json['tier3_qty'] as num?)?.toInt() ?? (resolvedItems.firstOrNull?.tier3Qty ?? 0),
      costThb: (json['cost_thb'] as num?)?.toDouble() ?? (resolvedItems.firstOrNull?.costThb ?? 0.0),
      costLak: (json['cost_lak'] as num?)?.toInt() ?? (resolvedItems.firstOrNull?.costLak ?? 0),
      costPerBaseUnit: (json['cost_per_base_unit'] as num?)?.toInt() ?? (resolvedItems.firstOrNull?.costPerBaseUnit ?? 0),
      totalCostLak: (json['total_cost_lak'] as num?)?.toInt() ?? 0,
      totalCostThb: (json['total_cost_thb'] as num?)?.toDouble() ?? 0.0,
      totalCostVnd: (json['total_cost_vnd'] as num?)?.toInt() ?? 0,
      primaryCurrency: json['primary_currency']?.toString() ?? 'LAK',
      paidAmount: (json['paid_amount'] as num?)?.toInt() ?? 0,
      debtAmount: (json['debt_amount'] as num?)?.toInt() ?? 0,
      paymentStatus: json['payment_status']?.toString() ?? 'PAID',
      receivedBy: json['received_by']?.toString(),
      note: json['note']?.toString(),
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      items: resolvedItems,
      payments: resolvedPayments,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      if (supplierId != null) 'supplier_id': supplierId,
      if (productId != null) 'product_id': productId,
      if (productName != null) 'product_name': productName,
      'imported_base_units': importedBaseUnits,
      'tier1_qty': tier1Qty,
      'tier2_qty': tier2Qty,
      'tier3_qty': tier3Qty,
      'cost_thb': costThb,
      'cost_lak': costLak,
      'cost_per_base_unit': costPerBaseUnit,
      'total_cost_lak': totalCostLak,
      'total_cost_thb': totalCostThb,
      'total_cost_vnd': totalCostVnd,
      'primary_currency': primaryCurrency,
      'paid_amount': paidAmount,
      'debt_amount': debtAmount,
      'payment_status': paymentStatus,
      if (receivedBy != null) 'received_by': receivedBy,
      if (note != null) 'note': note,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  PurchaseOrderModel copyWith({
    String? id,
    String? supplierId,
    SupplierModel? supplier,
    int? totalCostLak,
    double? totalCostThb,
    int? totalCostVnd,
    String? primaryCurrency,
    int? paidAmount,
    int? debtAmount,
    String? paymentStatus,
    String? receivedBy,
    String? note,
    DateTime? createdAt,
    DateTime? updatedAt,
    List<PurchaseOrderItemModel>? items,
    List<SupplierDebtPaymentModel>? payments,
  }) {
    return PurchaseOrderModel(
      id: id ?? this.id,
      supplierId: supplierId ?? this.supplierId,
      supplier: supplier ?? this.supplier,
      totalCostLak: totalCostLak ?? this.totalCostLak,
      totalCostThb: totalCostThb ?? this.totalCostThb,
      totalCostVnd: totalCostVnd ?? this.totalCostVnd,
      primaryCurrency: primaryCurrency ?? this.primaryCurrency,
      paidAmount: paidAmount ?? this.paidAmount,
      debtAmount: debtAmount ?? this.debtAmount,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      receivedBy: receivedBy ?? this.receivedBy,
      note: note ?? this.note,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      items: items ?? this.items,
      payments: payments ?? this.payments,
    );
  }
}
