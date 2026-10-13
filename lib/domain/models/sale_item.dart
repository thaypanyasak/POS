/// Line item record for completed sale transaction
class SaleItem {
  final String id;
  final String transactionId;
  final String productId;
  final String productName;
  final String unitName;
  final int multiplier;
  final int qty;
  final int soldPrice; // Unit selling price at sale
  final int costAtSale; // Unit cost of goods at sale

  const SaleItem({
    required this.id,
    required this.transactionId,
    required this.productId,
    this.productName = '',
    required this.unitName,
    this.multiplier = 1,
    required this.qty,
    required this.soldPrice,
    required this.costAtSale,
  });

  int get lineTotal => soldPrice * qty;
  int get lineCost => costAtSale * qty;
  int get lineProfit => lineTotal - lineCost;

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'transaction_id': transactionId,
      'product_id': productId,
      'product_name': productName,
      'unit_name': unitName,
      'multiplier': multiplier,
      'qty': qty,
      'sold_price': soldPrice,
      'cost_at_sale': costAtSale,
      'line_total': lineTotal,
      'line_profit': lineProfit,
    };
  }

  factory SaleItem.fromJson(Map<String, dynamic> json) {
    return SaleItem(
      id: json['id'] as String,
      transactionId: json['transaction_id'] as String,
      productId: json['product_id'] as String,
      productName: json['product_name'] as String? ?? '',
      unitName: json['unit_name'] as String,
      multiplier: (json['multiplier'] as num?)?.toInt() ?? 1,
      qty: (json['qty'] as num).toInt(),
      soldPrice: (json['sold_price'] as num).toInt(),
      costAtSale: (json['cost_at_sale'] as num).toInt(),
    );
  }
}
