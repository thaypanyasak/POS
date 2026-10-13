import 'cart_item.dart';
import 'sale_item.dart';

/// Payment Tender Methods
enum PaymentMethod {
  cash, // ເງິນສົດ
  qrTransfer, // ເງິນໂອນ (BCEL One / Lao QR)
}

/// Customer Category
enum CustomerType {
  general, // ລູກຄ້າທົ່ວໄປ
  regular, // ລູກຄ້າປະຈຳ
}

/// Customer Info Representation
class PosCustomer {
  final String id;
  final String name; // e.g. "ແມ່ຄ້າ ວຽງທອງ"
  final String? phone;
  final CustomerType type;
  final String? note;

  const PosCustomer({
    required this.id,
    required this.name,
    this.phone,
    this.type = CustomerType.general,
    this.note,
  });

  static const PosCustomer walkIn = PosCustomer(
    id: 'walk_in',
    name: 'ລູກຄ້າທົ່ວໄປ',
    type: CustomerType.general,
  );

  PosCustomer copyWith({
    String? id,
    String? name,
    String? phone,
    CustomerType? type,
    String? note,
  }) {
    return PosCustomer(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      type: type ?? this.type,
      note: note ?? this.note,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'type': type.name,
      'note': note,
    };
  }

  factory PosCustomer.fromJson(Map<String, dynamic> json) {
    return PosCustomer(
      id: json['id'] as String,
      name: json['name'] as String,
      phone: json['phone'] as String?,
      type: CustomerType.values.firstWhere(
        (e) => e.name == json['type'],
        orElse: () => CustomerType.general,
      ),
      note: json['note'] as String?,
    );
  }
}

/// Sale Transaction Record
class SaleTransaction {
  final String id;
  final String receiptNumber; // e.g. "RC-20261013-0001"
  final DateTime createdAt;
  final List<CartItem> items;
  final bool isWholesale;
  final PosCustomer customer;
  final PaymentMethod paymentMethod;
  final int subtotal; // sum of original prices
  final int discountTotal; // sum of price overrides/discounts
  final int grandTotal; // amount to pay (in Lao Kip)
  final int amountTendered; // cash received or QR transferred
  final int changeAmount; // change given
  final int totalCostOfGoods; // cost of items sold
  final int grossProfit; // grandTotal - totalCostOfGoods
  final bool isSynced; // Drift -> Supabase sync flag
  final String? cashierName;

  const SaleTransaction({
    required this.id,
    required this.receiptNumber,
    required this.createdAt,
    required this.items,
    required this.isWholesale,
    required this.customer,
    required this.paymentMethod,
    required this.subtotal,
    required this.discountTotal,
    required this.grandTotal,
    required this.amountTendered,
    required this.changeAmount,
    required this.totalCostOfGoods,
    required this.grossProfit,
    this.isSynced = false,
    this.cashierName = 'Meii',
  });

  /// Total count of physical units sold
  int get totalPiecesSold {
    return items.fold<int>(0, (sum, item) => sum + item.quantity);
  }

  /// Total base units deducted across all items
  int get totalBaseUnitsDeducted {
    return items.fold<int>(0, (sum, item) => sum + item.totalBaseUnitsDeducted);
  }

  /// Aliases for schema compliance
  String get orderNumber => receiptNumber;
  int get totalRevenue => grandTotal;
  int get totalCost => totalCostOfGoods;
  int get totalProfit => grossProfit;
  String get cashierId => cashierName ?? 'cashier_01';

  /// Converts cart items into SaleItem records
  List<SaleItem> get saleItems =>
      items
          .map(
            (i) => SaleItem(
              id: i.id,
              transactionId: id,
              productId: i.product.id,
              productName: i.product.name,
              unitName: i.selectedUnit.unitName,
              multiplier: i.selectedUnit.multiplier,
              qty: i.quantity,
              soldPrice: i.effectiveUnitPrice,
              costAtSale: i.unitCost,
            ),
          )
          .toList();

  /// Gross profit margin percentage
  double get profitMarginPercent {
    if (grandTotal == 0) return 0.0;
    return (grossProfit / grandTotal) * 100.0;
  }

  SaleTransaction copyWith({
    String? id,
    String? receiptNumber,
    DateTime? createdAt,
    List<CartItem>? items,
    bool? isWholesale,
    PosCustomer? customer,
    PaymentMethod? paymentMethod,
    int? subtotal,
    int? discountTotal,
    int? grandTotal,
    int? amountTendered,
    int? changeAmount,
    int? totalCostOfGoods,
    int? grossProfit,
    bool? isSynced,
    String? cashierName,
  }) {
    return SaleTransaction(
      id: id ?? this.id,
      receiptNumber: receiptNumber ?? this.receiptNumber,
      createdAt: createdAt ?? this.createdAt,
      items: items ?? this.items,
      isWholesale: isWholesale ?? this.isWholesale,
      customer: customer ?? this.customer,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      subtotal: subtotal ?? this.subtotal,
      discountTotal: discountTotal ?? this.discountTotal,
      grandTotal: grandTotal ?? this.grandTotal,
      amountTendered: amountTendered ?? this.amountTendered,
      changeAmount: changeAmount ?? this.changeAmount,
      totalCostOfGoods: totalCostOfGoods ?? this.totalCostOfGoods,
      grossProfit: grossProfit ?? this.grossProfit,
      isSynced: isSynced ?? this.isSynced,
      cashierName: cashierName ?? this.cashierName,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'receipt_number': receiptNumber,
      'created_at': createdAt.toIso8601String(),
      'items': items.map((i) => i.toJson()).toList(),
      'is_wholesale': isWholesale,
      'customer': customer.toJson(),
      'payment_method': paymentMethod.name,
      'subtotal': subtotal,
      'discount_total': discountTotal,
      'grand_total': grandTotal,
      'amount_tendered': amountTendered,
      'change_amount': changeAmount,
      'total_cost_of_goods': totalCostOfGoods,
      'gross_profit': grossProfit,
      'is_synced': isSynced,
      'cashier_name': cashierName,
    };
  }

  factory SaleTransaction.fromJson(Map<String, dynamic> json) {
    var rawItems = json['items'];
    List<CartItem> parsedItems = [];
    if (rawItems is List) {
      parsedItems = rawItems
          .whereType<Map<String, dynamic>>()
          .map((i) => CartItem.fromJson(i))
          .toList();
    }

    PosCustomer parsedCustomer = PosCustomer.walkIn;
    if (json['customer'] is Map<String, dynamic>) {
      parsedCustomer =
          PosCustomer.fromJson(json['customer'] as Map<String, dynamic>);
    } else if (json['customer_name'] != null) {
      parsedCustomer = PosCustomer(
        id: 'cust_${json['id']}',
        name: json['customer_name'] as String,
      );
    }

    PaymentMethod method = PaymentMethod.cash;
    final methodStr = json['payment_method'] as String?;
    if (methodStr == PaymentMethod.qrTransfer.name ||
        methodStr == 'qrTransfer' ||
        methodStr == 'qr') {
      method = PaymentMethod.qrTransfer;
    }

    return SaleTransaction(
      id: json['id'] as String,
      receiptNumber: json['receipt_number'] as String? ?? 'RC-${json['id']}',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      items: parsedItems,
      isWholesale: json['is_wholesale'] as bool? ?? false,
      customer: parsedCustomer,
      paymentMethod: method,
      subtotal: (json['subtotal'] as num?)?.toInt() ?? 0,
      discountTotal: (json['discount_total'] as num?)?.toInt() ?? 0,
      grandTotal: (json['grand_total'] as num?)?.toInt() ?? 0,
      amountTendered: (json['amount_tendered'] as num?)?.toInt() ?? 0,
      changeAmount: (json['change_amount'] as num?)?.toInt() ?? 0,
      totalCostOfGoods: (json['total_cost_of_goods'] as num?)?.toInt() ??
          (json['total_cost'] as num?)?.toInt() ??
          0,
      grossProfit: (json['gross_profit'] as num?)?.toInt() ?? 0,
      isSynced: json['is_synced'] as bool? ?? false,
      cashierName: json['cashier_name'] as String? ?? 'ໄມ້ຄຳ (Meii)',
    );
  }
}

/// Aggregated Financial Metrics for Reporting
class ProfitSummary {
  final int totalRevenue; // Grand total revenue
  final int totalCostOfGoods; // Total COGS
  final int totalGrossProfit; // Total gross profit
  final int totalDiscounts; // Total discounts given
  final int transactionCount; // Number of sales receipts
  final int totalItemsSold; // Total item units

  const ProfitSummary({
    required this.totalRevenue,
    required this.totalCostOfGoods,
    required this.totalGrossProfit,
    required this.totalDiscounts,
    required this.transactionCount,
    required this.totalItemsSold,
  });

  double get profitMarginPercent {
    if (totalRevenue == 0) return 0.0;
    return (totalGrossProfit / totalRevenue) * 100.0;
  }

  static ProfitSummary fromTransactions(List<SaleTransaction> txs) {
    int revenue = 0;
    int cost = 0;
    int profit = 0;
    int discount = 0;
    int items = 0;

    for (final tx in txs) {
      revenue += tx.grandTotal;
      cost += tx.totalCostOfGoods;
      profit += tx.grossProfit;
      discount += tx.discountTotal;
      items += tx.totalPiecesSold;
    }

    return ProfitSummary(
      totalRevenue: revenue,
      totalCostOfGoods: cost,
      totalGrossProfit: profit,
      totalDiscounts: discount,
      transactionCount: txs.length,
      totalItemsSold: items,
    );
  }
}
