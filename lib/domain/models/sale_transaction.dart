import 'cart_item.dart';
import 'sale_item.dart';

/// Payment Tender Methods
enum PaymentMethod {
  cash, // ເງິນສົດ
  qrTransfer, // ເງິນໂອນ (BCEL One / Lao QR)
  debt, // ຄ້າງຊຳລະ (Debt/Credit)
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
  final bool isDebt;
  final int paidAmount;
  final int debtAmount;
  final String debtStatus; // 'unpaid', 'partial', 'paid'
  final String? debtNote;
  final String status; // 'completed' | 'cancelled' | 'voided'
  final bool isCancelled;
  final DateTime? cancelledAt;
  final String? voidReason;
  final String? voidedBy;

  // Point-in-Time Exchange Rate Snapshot Fields
  final double exchangeRate;
  final double? totalLakValue;
  final double? totalThbValue;
  final double? totalCostLakValue;
  final double? totalCostThbValue;
  final double? grossProfitLakValue;
  final double? grossProfitThbValue;

  double get totalLak => totalLakValue ?? grandTotal.toDouble();
  double get totalThb => totalThbValue ?? (exchangeRate > 0 ? totalLak / exchangeRate : 0.0);
  double get totalCostLak => totalCostLakValue ?? totalCostOfGoods.toDouble();
  double get totalCostThb => totalCostThbValue ?? (exchangeRate > 0 ? totalCostLak / exchangeRate : 0.0);
  double get grossProfitLak => grossProfitLakValue ?? grossProfit.toDouble();
  double get grossProfitThb => grossProfitThbValue ?? (totalThb - totalCostThb);

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
    this.isDebt = false,
    this.paidAmount = 0,
    this.debtAmount = 0,
    this.debtStatus = 'paid',
    this.debtNote,
    this.status = 'completed',
    this.isCancelled = false,
    this.cancelledAt,
    this.voidReason,
    this.voidedBy,
    this.exchangeRate = 690.0,
    this.totalLakValue,
    this.totalThbValue,
    this.totalCostLakValue,
    this.totalCostThbValue,
    this.grossProfitLakValue,
    this.grossProfitThbValue,
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
    bool? isDebt,
    int? paidAmount,
    int? debtAmount,
    String? debtStatus,
    String? debtNote,
    String? status,
    bool? isCancelled,
    DateTime? cancelledAt,
    String? voidReason,
    String? voidedBy,
    double? exchangeRate,
    double? totalLakValue,
    double? totalThbValue,
    double? totalCostLakValue,
    double? totalCostThbValue,
    double? grossProfitLakValue,
    double? grossProfitThbValue,
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
      isDebt: isDebt ?? this.isDebt,
      paidAmount: paidAmount ?? this.paidAmount,
      debtAmount: debtAmount ?? this.debtAmount,
      debtStatus: debtStatus ?? this.debtStatus,
      debtNote: debtNote ?? this.debtNote,
      status: status ?? this.status,
      isCancelled: isCancelled ?? this.isCancelled,
      cancelledAt: cancelledAt ?? this.cancelledAt,
      voidReason: voidReason ?? this.voidReason,
      voidedBy: voidedBy ?? this.voidedBy,
      exchangeRate: exchangeRate ?? this.exchangeRate,
      totalLakValue: totalLakValue ?? this.totalLakValue,
      totalThbValue: totalThbValue ?? this.totalThbValue,
      totalCostLakValue: totalCostLakValue ?? this.totalCostLakValue,
      totalCostThbValue: totalCostThbValue ?? this.totalCostThbValue,
      grossProfitLakValue: grossProfitLakValue ?? this.grossProfitLakValue,
      grossProfitThbValue: grossProfitThbValue ?? this.grossProfitThbValue,
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
      'total_cost': totalCostOfGoods,
      'total_cost_of_goods': totalCostOfGoods,
      'gross_profit': grossProfit,
      'is_synced': isSynced,
      'cashier_name': cashierName,
      'is_debt': isDebt,
      'paid_amount': paidAmount,
      'debt_amount': debtAmount,
      'debt_status': debtStatus,
      'debt_note': debtNote,
      'status': status,
      'is_cancelled': isCancelled,
      'cancelled_at': cancelledAt?.toIso8601String(),
      'voided_at': cancelledAt?.toIso8601String(),
      'void_reason': voidReason,
      'voided_by': voidedBy,
      'exchange_rate': exchangeRate,
      'total_lak': totalLak,
      'total_thb': double.parse(totalThb.toStringAsFixed(2)),
      'total_cost_lak': totalCostLak,
      'total_cost_thb': double.parse(totalCostThb.toStringAsFixed(2)),
      'gross_profit_lak': grossProfitLak,
      'gross_profit_thb': double.parse(grossProfitThb.toStringAsFixed(2)),
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
    final isMethodCancelled = methodStr != null && methodStr.startsWith('cancelled');
    String cleanMethodStr = methodStr ?? 'cash';
    if (cleanMethodStr.startsWith('cancelled:')) {
      cleanMethodStr = cleanMethodStr.replaceFirst('cancelled:', '');
    } else if (cleanMethodStr == 'cancelled') {
      cleanMethodStr = 'cash';
    }

    if (cleanMethodStr == PaymentMethod.qrTransfer.name ||
        cleanMethodStr == 'qrTransfer' ||
        cleanMethodStr == 'qr' ||
        cleanMethodStr == 'transfer' ||
        cleanMethodStr == 'onepay') {
      method = PaymentMethod.qrTransfer;
    } else if (cleanMethodStr == PaymentMethod.debt.name ||
        cleanMethodStr == 'debt' ||
        cleanMethodStr == 'credit') {
      method = PaymentMethod.debt;
    }

    final isDebt = json['is_debt'] as bool? ?? (method == PaymentMethod.debt);
    final rawStatus = json['status'] as String? ?? (isMethodCancelled ? 'cancelled' : 'completed');
    final isCancelled = json['is_cancelled'] as bool? ??
        (rawStatus == 'cancelled' || rawStatus == 'voided' || rawStatus == 'VOIDED' || isMethodCancelled);

    final rate = (json['exchange_rate'] as num?)?.toDouble() ?? 690.0;
    final grandTot = (json['grand_total'] as num?)?.toInt() ?? 0;
    final tLak = (json['total_lak'] as num?)?.toDouble() ?? grandTot.toDouble();
    final tThb = (json['total_thb'] as num?)?.toDouble() ?? (rate > 0 ? (tLak / rate) : 0.0);
    
    final costGoods = (json['total_cost_of_goods'] as num?)?.toInt() ??
        (json['total_cost'] as num?)?.toInt() ??
        (json['total_cost_lak'] as num?)?.toInt() ??
        0;
    final cLak = (json['total_cost_lak'] as num?)?.toDouble() ?? costGoods.toDouble();
    final cThb = (json['total_cost_thb'] as num?)?.toDouble() ?? (rate > 0 ? (cLak / rate) : 0.0);

    final gProfit = (json['gross_profit'] as num?)?.toInt() ?? (grandTot - costGoods);
    final pLak = (json['gross_profit_lak'] as num?)?.toDouble() ?? gProfit.toDouble();
    final pThb = (json['gross_profit_thb'] as num?)?.toDouble() ?? (tThb - cThb);

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
      grandTotal: grandTot,
      amountTendered: (json['amount_tendered'] as num?)?.toInt() ?? 0,
      changeAmount: (json['change_amount'] as num?)?.toInt() ?? 0,
      totalCostOfGoods: costGoods,
      grossProfit: gProfit,
      isSynced: json['is_synced'] as bool? ?? false,
      cashierName: json['cashier_name'] as String? ?? 'ໄມ້ຄຳ (Meii)',
      isDebt: isDebt,
      paidAmount: (json['paid_amount'] as num?)?.toInt() ?? 0,
      debtAmount: (json['debt_amount'] as num?)?.toInt() ?? 0,
      debtStatus: json['debt_status'] as String? ?? 'paid',
      debtNote: json['debt_note'] as String?,
      status: isCancelled ? 'cancelled' : rawStatus,
      isCancelled: isCancelled,
      cancelledAt: json['cancelled_at'] != null
          ? DateTime.tryParse(json['cancelled_at'] as String)
          : (json['voided_at'] != null ? DateTime.tryParse(json['voided_at'] as String) : null),
      voidReason: json['void_reason'] as String?,
      voidedBy: json['voided_by'] as String?,
      exchangeRate: rate,
      totalLakValue: tLak,
      totalThbValue: tThb,
      totalCostLakValue: cLak,
      totalCostThbValue: cThb,
      grossProfitLakValue: pLak,
      grossProfitThbValue: pThb,
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
  final double totalRevenueLak;
  final double totalRevenueThb;
  final double totalCostLak;
  final double totalCostThb;
  final double totalProfitLak;
  final double totalProfitThb;

  const ProfitSummary({
    required this.totalRevenue,
    required this.totalCostOfGoods,
    required this.totalGrossProfit,
    required this.totalDiscounts,
    required this.transactionCount,
    required this.totalItemsSold,
    this.totalRevenueLak = 0.0,
    this.totalRevenueThb = 0.0,
    this.totalCostLak = 0.0,
    this.totalCostThb = 0.0,
    this.totalProfitLak = 0.0,
    this.totalProfitThb = 0.0,
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
    double revLak = 0.0;
    double revThb = 0.0;
    double cLak = 0.0;
    double cThb = 0.0;
    double pLak = 0.0;
    double pThb = 0.0;

    for (final tx in txs) {
      if (tx.isCancelled || tx.status == 'cancelled' || tx.status == 'voided') {
        continue;
      }
      revenue += tx.grandTotal;
      cost += tx.totalCostOfGoods;
      profit += tx.grossProfit;
      discount += tx.discountTotal;
      items += tx.totalPiecesSold;

      revLak += tx.totalLak;
      revThb += tx.totalThb;
      final double costItemLak = tx.totalCostOfGoods.toDouble();
      cLak += costItemLak;
      cThb += tx.exchangeRate > 0 ? (costItemLak / tx.exchangeRate) : 0.0;
      pLak += tx.grossProfitLak;
      pThb += tx.grossProfitThb;
    }

    return ProfitSummary(
      totalRevenue: revenue,
      totalCostOfGoods: cost,
      totalGrossProfit: profit,
      totalDiscounts: discount,
      transactionCount: txs.length,
      totalItemsSold: items,
      totalRevenueLak: revLak,
      totalRevenueThb: revThb,
      totalCostLak: cLak,
      totalCostThb: cThb,
      totalProfitLak: pLak,
      totalProfitThb: pThb,
    );
  }
}
