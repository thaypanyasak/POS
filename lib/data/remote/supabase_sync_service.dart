import 'dart:async';
import 'dart:typed_data';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../domain/models/cart_item.dart';
import '../../domain/models/product.dart';
import '../../domain/models/product_unit.dart';
import '../../domain/models/sale_transaction.dart';

/// Cloud Sync & Realtime Service via Supabase
/// Enables zero-latency local operation with resilient background cloud synchronization.
class SupabaseSyncService {
  static SupabaseClient? _client;
  static bool _isInitialized = false;

  /// Initializes Supabase credentials
  static Future<void> initialize({
    required String supabaseUrl,
    required String supabaseAnonKey,
  }) async {
    try {
      await Supabase.initialize(
        url: supabaseUrl,
        // ignore: deprecated_member_use
        anonKey: supabaseAnonKey,
      );
      _client = Supabase.instance.client;
      _isInitialized = true;
    } catch (_) {
      // In offline or local demo mode, service remains uninitialized without failing the app
      _isInitialized = false;
    }
  }

  static bool get isConnected => _isInitialized && _client != null;

  /// Uploads a completed sale transaction to Supabase
  static Future<bool> syncTransaction(SaleTransaction transaction) async {
    if (!isConnected) return false;

    try {
      final client = _client!;
      // 1. Insert header
      await client.from('sale_transactions').insert({
        'id': transaction.id,
        'receipt_number': transaction.receiptNumber,
        'created_at': transaction.createdAt.toIso8601String(),
        'is_wholesale': transaction.isWholesale,
        'customer_name': transaction.customer.name,
        'payment_method': transaction.paymentMethod.name,
        'subtotal': transaction.subtotal,
        'discount_total': transaction.discountTotal,
        'grand_total': transaction.grandTotal,
        'amount_tendered': transaction.amountTendered,
        'change_amount': transaction.changeAmount,
        'total_cost': transaction.totalCostOfGoods,
        'gross_profit': transaction.grossProfit,
      });

      // 2. Insert line items
      final itemsPayload = transaction.items.map((item) {
        return {
          'id': item.id,
          'transaction_id': transaction.id,
          'product_id': item.product.id,
          'product_name': item.product.name,
          'unit_name': item.selectedUnit.unitName,
          'multiplier': item.selectedUnit.multiplier,
          'quantity': item.quantity,
          'unit_price': item.effectiveUnitPrice,
          'line_total': item.lineTotal,
          'line_cost': item.lineTotalCost,
          'line_profit': item.lineProfit,
        };
      }).toList();

      await client.from('sale_transaction_items').insert(itemsPayload);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Listens to realtime inventory changes broadcasted across multiple POS terminals
  static Stream<Map<String, dynamic>>? subscribeToStockUpdates() {
    if (!isConnected) return null;
    return _client!
        .from('products')
        .stream(primaryKey: ['id'])
        .map((records) => records.isNotEmpty ? records.first : {});
  }

  /// Uploads compressed image bytes to Supabase Storage 'product-images' bucket
  /// and returns the public URL.
  static Future<String?> uploadProductImage({
    required String productId,
    required Uint8List imageBytes,
  }) async {
    if (!isConnected) return null;
    try {
      final fileName = '${productId}_${DateTime.now().millisecondsSinceEpoch}.jpg';
      final path = 'products/$fileName';

      await _client!.storage.from('product-images').uploadBinary(
            path,
            imageBytes,
            fileOptions: const FileOptions(
              contentType: 'image/jpeg',
              upsert: true,
            ),
          );

      return _client!.storage.from('product-images').getPublicUrl(path);
    } catch (_) {
      return null;
    }
  }

  /// Syncs an added or edited product and its units to Supabase
  static Future<bool> syncProduct(Product product) async {
    if (!isConnected) return false;
    try {
      final client = _client!;
      // 1. Upsert product
      await client.from('products').upsert({
        'id': product.id,
        'name': product.name,
        'category': product.category,
        'barcode': product.barcode,
        'image_url': product.imageUrl,
        'base_unit': product.baseUnit,
        'cost_per_base_unit': product.costPerBaseUnit,
        'current_stock_base_units': product.currentStockBaseUnits,
        'track_stock': product.trackStock,
      });

      // 2. Delete existing units and re-insert
      await client.from('product_units').delete().eq('product_id', product.id);
      final unitsData = product.units.map((u) {
        return {
          'id': u.id,
          'product_id': product.id,
          'unit_name': u.unitName,
          'multiplier': u.multiplier,
          'retail_price': u.retailPrice,
          'wholesale_price': u.wholesalePrice,
          'barcode': u.barcode,
          'is_base_unit': u.isBaseUnit,
        };
      }).toList();

      if (unitsData.isNotEmpty) {
        await client.from('product_units').insert(unitsData);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Deletes product from Supabase
  static Future<bool> deleteProduct(String productId) async {
    if (!isConnected) return false;
    try {
      await _client!.from('products').delete().eq('id', productId);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Fetches latest products from Supabase
  static Future<List<Product>?> fetchProducts() async {
    if (!isConnected) return null;
    try {
      final data =
          await _client!.from('products').select('*, product_units(*)');
      return (data as List).map((json) => Product.fromJson(json)).toList();
    } catch (_) {
      return null;
    }
  }

  /// Fetches latest transactions and items from Supabase Cloud
  static Future<List<SaleTransaction>?> fetchTransactions() async {
    if (!isConnected) return null;
    try {
      final client = _client!;
      final List<dynamic> data = await client
          .from('sale_transactions')
          .select('*, sale_transaction_items(*)')
          .order('created_at', ascending: false);

      return data.map((txJson) {
        final txMap = Map<String, dynamic>.from(txJson as Map);
        final rawItems = txMap['sale_transaction_items'];
        List<CartItem> parsedItems = [];
        if (rawItems is List) {
          for (final itemJson in rawItems) {
            final iMap = Map<String, dynamic>.from(itemJson as Map);
            parsedItems.add(
              CartItem(
                id: iMap['id'] as String? ??
                    'item_${DateTime.now().millisecondsSinceEpoch}',
                product: Product(
                  id: iMap['product_id'] as String? ?? 'p_temp',
                  name: iMap['product_name'] as String? ?? '',
                  category: 'ທົ່ວໄປ',
                  baseUnit: iMap['unit_name'] as String? ?? 'ອັນ',
                  costPerBaseUnit: 0,
                  currentStockBaseUnits: 0,
                  units: const [],
                ),
                selectedUnit: ProductUnit(
                  id: 'u_${iMap['id']}',
                  productId: iMap['product_id'] as String? ?? 'p_temp',
                  unitName: iMap['unit_name'] as String? ?? 'ອັນ',
                  multiplier: (iMap['multiplier'] as num?)?.toInt() ?? 1,
                  retailPrice: (iMap['unit_price'] as num?)?.toInt() ?? 0,
                  wholesalePrice: (iMap['unit_price'] as num?)?.toInt() ?? 0,
                ),
                quantity: (iMap['quantity'] as num?)?.toInt() ?? 1,
                isWholesaleMode: txMap['is_wholesale'] as bool? ?? false,
              ),
            );
          }
        }
        txMap['items'] = parsedItems.map((i) => i.toJson()).toList();
        return SaleTransaction.fromJson(txMap);
      }).toList();
    } catch (_) {
      return null;
    }
  }
}
