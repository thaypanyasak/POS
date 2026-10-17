import 'dart:async';
import 'dart:typed_data';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../domain/models/cart_item.dart';
import '../../domain/models/category_model.dart';
import '../../domain/models/product.dart';
import '../../domain/models/product_unit.dart';
import '../../domain/models/sale_transaction.dart';
import '../local/product_local_meta_service.dart';

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
        'exchange_rate': transaction.exchangeRate,
        'total_lak': transaction.totalLak,
        'total_thb': double.parse(transaction.totalThb.toStringAsFixed(2)),
        'gross_profit_lak': transaction.grossProfitLak,
        'gross_profit_thb': double.parse(transaction.grossProfitThb.toStringAsFixed(2)),
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
    // 0. Always persist metadata locally first (matching Web App saveProductMetaLocal)
    await ProductLocalMetaService.saveMeta(
      product.id,
      costBaht: product.costBaht,
      costKip: product.costKip,
    );

    if (!isConnected) {
      // ignore: avoid_print
      print('⚠️ SupabaseSyncService: Not connected, saved metadata locally.');
      return false;
    }
    try {
      final client = _client!;
      final currentStock = product.trackStock ? product.currentStockBaseUnits : 0;

      // Base payload matching Supabase 'products' table schema
      final prodPayload = <String, dynamic>{
        'id': product.id,
        'name': product.name,
        'category': product.category,
        'barcode': product.barcode,
        'image_url': product.imageUrl,
        'base_unit': product.baseUnit,
        'cost_per_base_unit': product.costPerBaseUnit,
        'current_stock_base_units': currentStock,
        'track_stock': product.trackStock,
        'updated_at': DateTime.now().toIso8601String(),
      };

      if (product.categoryId != null && product.categoryId!.isNotEmpty) {
        prodPayload['category_id'] = product.categoryId;
      }
      if (product.costBaht > 0) {
        prodPayload['cost_thb'] = product.costBaht;
      }
      if (product.costKip > 0) {
        prodPayload['cost_lak'] = product.costKip;
      }

      // 1. Upsert product with safe column fallback
      try {
        await client.from('products').upsert(prodPayload);
      } catch (e) {
        final err = e.toString().toLowerCase();
        bool modified = false;
        if (err.contains('cost_thb')) {
          prodPayload.remove('cost_thb');
          modified = true;
        }
        if (err.contains('cost_lak')) {
          prodPayload.remove('cost_lak');
          modified = true;
        }
        if (err.contains('category_id')) {
          prodPayload.remove('category_id');
          modified = true;
        }

        if (modified) {
          try {
            await client.from('products').upsert(prodPayload);
          } catch (_) {
            // Final fallback to core essential fields only
            prodPayload.remove('cost_thb');
            prodPayload.remove('cost_lak');
            prodPayload.remove('category_id');
            await client.from('products').upsert(prodPayload);
          }
        } else {
          // If other column issue, retry with core fields
          prodPayload.remove('cost_thb');
          prodPayload.remove('cost_lak');
          prodPayload.remove('category_id');
          await client.from('products').upsert(prodPayload);
        }
      }

      // 2. Delete existing units and re-insert fresh active units
      await client.from('product_units').delete().eq('product_id', product.id);

      final unitsData = product.units.map((u) {
        return {
          'id': u.id,
          'product_id': product.id,
          'unit_name': u.unitName,
          'multiplier': u.multiplier,
          'retail_price': u.retailPrice,
          'wholesale_price': u.wholesalePrice,
          'price_2': u.price2 ?? u.retailPrice,
          'price_3': u.price3 ?? u.retailPrice,
          'barcode': u.barcode,
          'is_base_unit': u.isBaseUnit,
        };
      }).toList();

      if (unitsData.isNotEmpty) {
        try {
          await client.from('product_units').insert(unitsData);
        } catch (_) {
          // Retry without price_2 / price_3 if migration pending
          final fallbackUnits = unitsData.map((map) {
            final copy = Map<String, dynamic>.from(map);
            copy.remove('price_2');
            copy.remove('price_3');
            return copy;
          }).toList();
          await client.from('product_units').insert(fallbackUnits);
        }
      }
      return true;
    } catch (e, stack) {
      // ignore: avoid_print
      print('❌ SupabaseSyncService.syncProduct error: $e\n$stack');
      return false;
    }
  }

  /// Deletes product from Supabase
  static Future<bool> deleteProduct(String productId) async {
    if (!isConnected) {
      // ignore: avoid_print
      print('⚠️ SupabaseSyncService: Not connected, cannot delete product $productId');
      return false;
    }
    try {
      await _client!.from('product_units').delete().eq('product_id', productId);
      await _client!.from('products').delete().eq('id', productId);
      return true;
    } catch (e, stack) {
      // ignore: avoid_print
      print('❌ SupabaseSyncService.deleteProduct error: $e\n$stack');
      return false;
    }
  }

  /// Fetches latest products from Supabase
  static Future<List<Product>?> fetchProducts() async {
    if (!isConnected) return null;
    try {
      try {
        final data = await _client!
            .from('products')
            .select('*, categories:category_id(id, name), product_units(*)')
            .order('created_at', ascending: false);
        return (data as List).map((json) => Product.fromJson(json)).toList();
      } catch (_) {
        // Fallback without relational categories join if schema is simple
        final fallbackData = await _client!
            .from('products')
            .select('*, product_units(*)')
            .order('name', ascending: true);
        return (fallbackData as List).map((json) => Product.fromJson(json)).toList();
      }
    } catch (_) {
      return null;
    }
  }

  /// Fetches Categories from Supabase ('categories' table) as simple strings
  static Future<List<String>?> fetchCategories() async {
    if (!isConnected) return null;
    try {
      final detailed = await fetchCategoriesDetailed();
      if (detailed != null && detailed.isNotEmpty) {
        return detailed.map((c) => c.name).toList();
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Fetches full CategoryModel objects from Supabase
  static Future<List<CategoryModel>?> fetchCategoriesDetailed() async {
    if (!isConnected) return null;
    try {
      final data = await _client!
          .from('categories')
          .select('id, name, sort_order')
          .order('sort_order', ascending: true);
      final list = (data as List)
          .map((row) => CategoryModel.fromJson(row as Map<String, dynamic>))
          .where((cat) => cat.name.isNotEmpty)
          .toList();
      return list;
    } catch (_) {
      return null;
    }
  }

  /// Creates a new category in Supabase ('categories' table)
  static Future<CategoryModel?> createCategoryDetailed(String name, {int sortOrder = 0}) async {
    if (!isConnected) return null;
    try {
      final clean = name.trim();
      if (clean.isEmpty) return null;
      final res = await _client!.from('categories').insert({
        'name': clean,
        'sort_order': sortOrder,
      }).select().single();
      return CategoryModel.fromJson(res);
    } catch (_) {
      return null;
    }
  }

  /// Alias for backward compatibility
  static Future<bool> createCategory(String name, {int sortOrder = 0}) async {
    final res = await createCategoryDetailed(name, sortOrder: sortOrder);
    return res != null;
  }

  /// Updates Category name & cascades to products in Supabase
  static Future<bool> updateCategory({
    required String id,
    required String newName,
    String? oldName,
  }) async {
    if (!isConnected) return false;
    try {
      final clean = newName.trim();
      if (clean.isEmpty) return false;

      // 1. Update categories table
      await _client!.from('categories').update({'name': clean}).eq('id', id);

      // 2. Cascade to products by oldName or category_id
      if (oldName != null && oldName.isNotEmpty) {
        await _client!.from('products').update({'category': clean}).eq('category', oldName);
      }
      try {
        await _client!.from('products').update({'category': clean}).eq('category_id', id);
      } catch (_) {}

      return true;
    } catch (_) {
      return false;
    }
  }

  /// Deletes a Category safely after checking product count
  static Future<String?> deleteCategorySafely({
    required String id,
    required String categoryName,
  }) async {
    if (!isConnected) return 'ບໍ່ສາມາດເຊື່ອມຕໍ່ລະບົບໄດ້';
    try {
      // 1. Safety check: count products linked by category name or category_id
      int count = 0;
      try {
        final countByName = await _client!
            .from('products')
            .count(CountOption.exact)
            .eq('category', categoryName);
        count += countByName;
      } catch (_) {}

      try {
        final countById = await _client!
            .from('products')
            .count(CountOption.exact)
            .eq('category_id', id);
        count = count > countById ? count : countById;
      } catch (_) {}

      if (count > 0) {
        return 'ໝວດໝູ່ນີ້ກຳລັງມີສິນຄ້າຢູ່ $count ລາຍການ, ບໍ່ສາມາດລຶບໄດ້! ກະລຸນາຍ້າຍສິນຄ້າໄປໝວດອື່ນກ່ອນ.';
      }

      // 2. Delete
      await _client!.from('categories').delete().eq('id', id);
      return null; // success
    } catch (e) {
      return 'ເກີດຂໍ້ຜິດພາດ: $e';
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

  /// Cancels / Voids a transaction in Supabase
  static Future<bool> cancelTransaction(String transactionId, String paymentMethod) async {
    if (!isConnected) return false;
    try {
      final client = _client!;
      final cancelledMethod = paymentMethod.startsWith('cancelled')
          ? paymentMethod
          : 'cancelled:$paymentMethod';

      await client
          .from('sale_transactions')
          .update({'payment_method': cancelledMethod})
          .eq('id', transactionId);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Deletes a transaction and its items permanently from Supabase
  static Future<bool> deleteTransaction(String transactionId) async {
    if (!isConnected) return false;
    try {
      final client = _client!;
      await client
          .from('sale_transaction_items')
          .delete()
          .eq('transaction_id', transactionId);
      await client
          .from('sale_transactions')
          .delete()
          .eq('id', transactionId);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Updates transaction details in Supabase (customer name, payment method)
  static Future<bool> updateTransaction(String transactionId, Map<String, dynamic> updates) async {
    if (!isConnected) return false;
    try {
      final client = _client!;
      await client
          .from('sale_transactions')
          .update(updates)
          .eq('id', transactionId);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Records a customer debt payment recovery into Supabase
  static Future<bool> recordCustomerDebtPayment({
    required String transactionId,
    required int paymentAmount,
    required String paymentMethod, // 'CASH' | 'TRANSFER'
    String? note,
  }) async {
    if (!isConnected) return false;
    try {
      final client = _client!;
      final txData = await client
          .from('sale_transactions')
          .select('id, grand_total, amount_tendered, paid_amount, remaining_debt')
          .eq('id', transactionId)
          .single();

      final grandTotal = (txData['grand_total'] as num?)?.toInt() ?? 0;
      final currentPaid = (txData['paid_amount'] as num?)?.toInt() ??
          (txData['amount_tendered'] as num?)?.toInt() ??
          0;
      final currentDebt = (txData['remaining_debt'] as num?)?.toInt() ??
          (grandTotal - currentPaid).clamp(0, grandTotal);

      final newPaid = currentPaid + paymentAmount;
      final newDebt = (currentDebt - paymentAmount).clamp(0, grandTotal);
      final newStatus = newDebt == 0 ? 'PAID' : 'PARTIAL';

      // 1. Insert into customer_debt_payments
      await client.from('customer_debt_payments').insert({
        'transaction_id': transactionId,
        'payment_amount': paymentAmount,
        'payment_method': paymentMethod,
        'note': note,
      });

      // 2. Update sale_transactions header
      await client.from('sale_transactions').update({
        'paid_amount': newPaid,
        'remaining_debt': newDebt,
        'payment_status': newStatus,
        'amount_tendered': newPaid,
      }).eq('id', transactionId);

      return true;
    } catch (_) {
      return false;
    }
  }

  /// Replace & Re-checkout pattern for existing transactions in Supabase
  static Future<bool> updateExistingSaleTransaction({
    required SaleTransaction oldTransaction,
    required SaleTransaction newTransaction,
  }) async {
    if (!isConnected) return false;
    try {
      final client = _client!;
      final txId = oldTransaction.id;

      // 1. Calculate net stock deltas per product: restore old units, deduct new units
      final Map<String, int> stockDeltas = {};

      for (final item in oldTransaction.items) {
        final prodId = item.product.id;
        final units = item.selectedUnit.multiplier * item.quantity;
        stockDeltas[prodId] = (stockDeltas[prodId] ?? 0) + units;
      }

      for (final item in newTransaction.items) {
        final prodId = item.product.id;
        final units = item.selectedUnit.multiplier * item.quantity;
        stockDeltas[prodId] = (stockDeltas[prodId] ?? 0) - units;
      }

      // 2. Apply stock changes to products in Supabase
      for (final entry in stockDeltas.entries) {
        if (entry.value != 0) {
          try {
            final pData = await client
                .from('products')
                .select('current_stock_base_units, track_stock')
                .eq('id', entry.key)
                .maybeSingle();

            if (pData != null && pData['track_stock'] != false) {
              final currentStock = (pData['current_stock_base_units'] as num?)?.toInt() ?? 0;
              final newStock = currentStock + entry.value;
              await client.from('products').update({
                'current_stock_base_units': newStock,
                'updated_at': DateTime.now().toIso8601String(),
              }).eq('id', entry.key);
            }
          } catch (_) {}
        }
      }

      // 3. Delete old items
      await client
          .from('sale_transaction_items')
          .delete()
          .eq('transaction_id', txId);

      // 4. Insert new items
      final itemsPayload = newTransaction.items.map((item) {
        return {
          'id': item.id,
          'transaction_id': txId,
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

      // 5. Update header record
      final isDebt = newTransaction.isDebt || newTransaction.paymentMethod == PaymentMethod.debt;
      final remaining = newTransaction.debtAmount;
      final paid = newTransaction.paidAmount;
      final pStatus = isDebt ? (remaining > 0 ? (paid > 0 ? 'PARTIAL' : 'DEBT') : 'PAID') : 'PAID';

      await client.from('sale_transactions').update({
        'is_wholesale': newTransaction.isWholesale,
        'customer_name': newTransaction.customer.name,
        'payment_method': newTransaction.paymentMethod.name,
        'subtotal': newTransaction.subtotal,
        'discount_total': newTransaction.discountTotal,
        'grand_total': newTransaction.grandTotal,
        'amount_tendered': newTransaction.amountTendered,
        'change_amount': newTransaction.changeAmount,
        'total_cost': newTransaction.totalCostOfGoods,
        'gross_profit': newTransaction.grossProfit,
        'paid_amount': paid,
        'remaining_debt': remaining,
        'payment_status': pStatus,
        'exchange_rate': newTransaction.exchangeRate,
        'total_lak': newTransaction.totalLak,
        'total_thb': double.parse(newTransaction.totalThb.toStringAsFixed(2)),
        'gross_profit_lak': newTransaction.grossProfitLak,
        'gross_profit_thb': double.parse(newTransaction.grossProfitThb.toStringAsFixed(2)),
      }).eq('id', txId);

      return true;
    } catch (_) {
      return false;
    }
  }

  /// Strict Year-over-Year / Dual-Month Query:
  /// Queries ONLY the two discrete month intervals in parallel.
  /// TUYỆT ĐỐI KHÔNG truy vấn dồn toàn bộ các tháng nằm ở giữa.
  static Future<Map<String, List<SaleTransaction>>> fetchDualMonthTransactions({
    required DateTime monthA,
    required DateTime monthB,
  }) async {
    if (!isConnected) return {'txsA': [], 'txsB': []};
    try {
      final client = _client!;

      // Discrete Range A (Month A)
      final startA = DateTime(monthA.year, monthA.month, 1).toUtc().toIso8601String();
      final endA = DateTime(monthA.year, monthA.month + 1, 0, 23, 59, 59, 999).toUtc().toIso8601String();

      // Discrete Range B (Month B)
      final startB = DateTime(monthB.year, monthB.month, 1).toUtc().toIso8601String();
      final endB = DateTime(monthB.year, monthB.month + 1, 0, 23, 59, 59, 999).toUtc().toIso8601String();

      final results = await Future.wait([
        client
            .from('sale_transactions')
            .select('*')
            .gte('created_at', startA)
            .lte('created_at', endA)
            .order('created_at', ascending: true),
        client
            .from('sale_transactions')
            .select('*')
            .gte('created_at', startB)
            .lte('created_at', endB)
            .order('created_at', ascending: true),
      ]);

      List<SaleTransaction> parseTxs(dynamic raw) {
        if (raw is! List) return [];
        return raw
            .map((r) => SaleTransaction.fromJson(r as Map<String, dynamic>))
            .where((tx) => !tx.isCancelled && tx.status != 'cancelled')
            .toList();
      }

      return {
        'txsA': parseTxs(results[0]),
        'txsB': parseTxs(results[1]),
      };
    } catch (_) {
      return {'txsA': [], 'txsB': []};
    }
  }

  /// Custom Date Range Query:
  /// Queries sale_transactions strictly between start and end date.
  static Future<List<SaleTransaction>> fetchDateRangeTransactions({
    required DateTime startDate,
    required DateTime endDate,
  }) async {
    if (!isConnected) return [];
    try {
      final client = _client!;
      final s = DateTime(startDate.year, startDate.month, startDate.day, 0, 0, 0).toUtc().toIso8601String();
      final e = DateTime(endDate.year, endDate.month, endDate.day, 23, 59, 59, 999).toUtc().toIso8601String();

      final List<Map<String, dynamic>> data = await client
          .from('sale_transactions')
          .select('*')
          .gte('created_at', s)
          .lte('created_at', e)
          .order('created_at', ascending: true);

      return data
          .map((r) => SaleTransaction.fromJson(r))
          .where((tx) => !tx.isCancelled && tx.status != 'cancelled')
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Annual 12-Month Sales Trend:
  /// Aggregates revenue, cost, profit, and order count for all 12 months of the given year.
  static Future<List<Map<String, dynamic>>> fetchAnnual12MonthSales({int? targetYear}) async {
    final year = targetYear ?? DateTime.now().year;
    final laoMonthNames = [
      'ມັງກອນ (01)', 'ກຸມພາ (02)', 'ມີນາ (03)', 'ເມສາ (04)',
      'ພຶດສະພາ (05)', 'ມິຖຸນາ (06)', 'ກໍລະກົດ (07)', 'ສິງຫາ (08)',
      'ກັນຍາ (09)', 'ຕຸລາ (10)', 'ພະຈິກ (11)', 'ທັນວາ (12)',
    ];
    final defaultMonths = laoMonthNames.asMap().entries.map((e) => {
      'monthIndex': e.key + 1,
      'month': '${(e.key + 1).toString().padLeft(2, '0')}/$year',
      'monthName': e.value,
      'label': e.value,
      'shortLabel': e.value,
      'simpleMonth': (e.key + 1).toString().padLeft(2, '0'),
      'revenue': 0,
      'total_sales': 0,
      'cost': 0,
      'total_cost': 0,
      'profit': 0,
      'gross_profit': 0,
      'count': 0,
      'ticket_count': 0,
    }).toList();

    if (!isConnected) return defaultMonths;
    try {
      final client = _client!;
      final start = DateTime.utc(year, 1, 1).toIso8601String();
      final end = DateTime.utc(year, 12, 31, 23, 59, 59, 999).toIso8601String();

      final List<Map<String, dynamic>> data = await client
          .from('sale_transactions')
          .select('created_at, grand_total, total_cost, gross_profit, status, payment_status, is_cancelled')
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', ascending: true);

      for (final r in data) {
        final pStatus = r['payment_status']?.toString();
        final status = r['status']?.toString();
        final isCanc = r['is_cancelled'] == true;
        if (pStatus == 'CANCELLED' || status == 'cancelled' || isCanc) continue;

        final rawDate = r['created_at']?.toString();
        if (rawDate == null) continue;
        final d = DateTime.tryParse(rawDate);
        if (d == null) continue;
        final mIdx = d.month - 1;
        if (mIdx >= 0 && mIdx < 12) {
          defaultMonths[mIdx]['revenue'] = (defaultMonths[mIdx]['revenue'] as int) + ((r['grand_total'] as num?)?.toInt() ?? 0);
          defaultMonths[mIdx]['cost'] = (defaultMonths[mIdx]['cost'] as int) + ((r['total_cost'] as num?)?.toInt() ?? 0);
          defaultMonths[mIdx]['profit'] = (defaultMonths[mIdx]['profit'] as int) + ((r['gross_profit'] as num?)?.toInt() ?? 0);
          defaultMonths[mIdx]['count'] = (defaultMonths[mIdx]['count'] as int) + 1;
        }
      }

      return defaultMonths;
    } catch (_) {
      return defaultMonths;
    }
  }
}
