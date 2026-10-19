import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../domain/models/product.dart';
import '../../domain/models/product_unit.dart';
import '../../models/purchase_order_model.dart';
import '../../models/supplier_model.dart';
import '../features/pos/presentation/controllers/catalog_controller.dart';

class PurchaseState {
  final List<SupplierModel> suppliers;
  final List<PurchaseOrderModel> purchaseOrders;
  final bool isLoading;
  final String? errorMessage;
  final String filterStatus; // 'ALL', 'PAID', 'PARTIAL', 'DEBT'

  const PurchaseState({
    this.suppliers = const [],
    this.purchaseOrders = const [],
    this.isLoading = false,
    this.errorMessage,
    this.filterStatus = 'ALL',
  });

  PurchaseState copyWith({
    List<SupplierModel>? suppliers,
    List<PurchaseOrderModel>? purchaseOrders,
    bool? isLoading,
    String? errorMessage,
    String? filterStatus,
  }) {
    return PurchaseState(
      suppliers: suppliers ?? this.suppliers,
      purchaseOrders: purchaseOrders ?? this.purchaseOrders,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      filterStatus: filterStatus ?? this.filterStatus,
    );
  }
}

class PurchaseProvider extends StateNotifier<PurchaseState> {
  final Ref ref;

  PurchaseProvider(this.ref) : super(const PurchaseState()) {
    loadAll();
  }

  SupabaseClient? get _client {
    try {
      return Supabase.instance.client;
    } catch (_) {
      return null;
    }
  }

  Future<void> loadAll() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    await Future.wait([
      fetchSuppliers(),
      fetchPurchaseOrders(),
    ]);
    state = state.copyWith(isLoading: false);
  }

  void setFilterStatus(String status) {
    state = state.copyWith(filterStatus: status);
  }

  // ==========================================
  // 1. SUPPLIER CRUD OPERATIONS
  // ==========================================
  Future<void> fetchSuppliers() async {
    final client = _client;
    if (client == null) return;
    try {
      final res = await client
          .from('suppliers')
          .select('*')
          .order('name', ascending: true);
      final list = (res as List)
          .map((json) => SupplierModel.fromJson(json as Map<String, dynamic>))
          .toList();
      state = state.copyWith(suppliers: list);
    } catch (e) {
      state = state.copyWith(errorMessage: 'Error loading suppliers: $e');
    }
  }

  Future<SupplierModel?> createSupplier({
    required String name,
    String? phone,
    String? address,
    String? contactPerson,
    String? note,
  }) async {
    final client = _client;
    if (client == null) return null;
    try {
      final res = await client
          .from('suppliers')
          .insert({
            'name': name.trim(),
            if (phone != null && phone.isNotEmpty) 'phone': phone.trim(),
            if (address != null && address.isNotEmpty) 'address': address.trim(),
            if (contactPerson != null && contactPerson.isNotEmpty)
              'contact_person': contactPerson.trim(),
            if (note != null && note.isNotEmpty) 'note': note.trim(),
          })
          .select()
          .single();

      final created = SupplierModel.fromJson(res);
      state = state.copyWith(
        suppliers: [...state.suppliers, created],
      );
      return created;
    } catch (e) {
      state = state.copyWith(errorMessage: 'Error creating supplier: $e');
      return null;
    }
  }

  Future<bool> updateSupplier({
    required String id,
    required String name,
    String? phone,
    String? address,
    String? contactPerson,
    String? note,
  }) async {
    final client = _client;
    if (client == null) return false;
    try {
      await client.from('suppliers').update({
        'name': name.trim(),
        'phone': phone?.trim(),
        'address': address?.trim(),
        'contact_person': contactPerson?.trim(),
        'note': note?.trim(),
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', id);

      state = state.copyWith(
        suppliers: state.suppliers.map((s) {
          if (s.id == id) {
            return s.copyWith(
              name: name.trim(),
              phone: phone?.trim(),
              address: address?.trim(),
              contactPerson: contactPerson?.trim(),
              note: note?.trim(),
              updatedAt: DateTime.now(),
            );
          }
          return s;
        }).toList(),
      );
      return true;
    } catch (e) {
      state = state.copyWith(errorMessage: 'Error updating supplier: $e');
      return false;
    }
  }

  /// Safe deletion constraint: Checks if supplier has any purchase_orders
  Future<String?> deleteSupplierSafely(String supplierId) async {
    final client = _client;
    if (client == null) return 'No Supabase client';
    try {
      final poCheck = await client
          .from('purchase_orders')
          .select('id')
          .eq('supplier_id', supplierId)
          .limit(1);

      if (poCheck.isNotEmpty) {
        return 'ບໍ່ສາມາດລົບຜູ້ສະໜອງນີ້ໄດ້ ເນື່ອງຈາກມີປະຫວັດການສັ່ງຊື້ແລ້ວ';
      }

      await client.from('suppliers').delete().eq('id', supplierId);
      state = state.copyWith(
        suppliers: state.suppliers.where((s) => s.id != supplierId).toList(),
      );
      return null;
    } catch (e) {
      return 'Error deleting supplier: $e';
    }
  }

  // ==========================================
  // 2. PURCHASE ORDERS (GRN) OPERATIONS
  // ==========================================
  Future<void> fetchPurchaseOrders() async {
    final client = _client;
    if (client == null) return;
    try {
      final res = await client.from('purchase_orders').select('''
        *,
        suppliers (*),
        purchase_order_items (*),
        supplier_debt_payments (*)
      ''').order('created_at', ascending: false);

      final list = (res as List).map((json) {
        return PurchaseOrderModel.fromJson(json as Map<String, dynamic>);
      }).toList();

      state = state.copyWith(purchaseOrders: list);
    } catch (e) {
      state = state.copyWith(errorMessage: 'Error loading purchase orders: $e');
    }
  }

  /// Create GRN Purchase Order Transaction
  /// - Inserts into purchase_orders
  /// - Inserts into purchase_order_items
  /// - Multi-tier Stock Cascade to products.current_stock_base_units
  /// - Cost overrides: products.cost_per_base_unit, cost_thb, cost_lak
  /// - Retail Price overrides: product_units.retail_price
  Future<bool> createPurchaseOrder({
    required String? supplierId,
    required int totalCostLak,
    required double totalCostThb,
    required int totalCostVnd,
    required String primaryCurrency,
    required int paidAmount,
    required int debtAmount,
    required String paymentStatus,
    required String receivedBy,
    required String note,
    required List<PurchaseItemDraft> draftItems,
  }) async {
    final client = _client;
    if (client == null) return false;

    state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      // 1. Generate unique PO Code (PO-YYYYMMDD-XXXX)
      final now = DateTime.now();
      final dateStr = '${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}';
      final randomSuffix = (now.millisecondsSinceEpoch % 10000).toString().padLeft(4, '0');
      final poId = 'PO-$dateStr-$randomSuffix';

      // 1A. Try Atomic RPC process_multi_product_grn with ledger logging
      try {
        final Map<String, dynamic> rpcPayload = {
          'po_code': poId,
          'supplier_id': (supplierId != null && supplierId.isNotEmpty) ? supplierId : null,
          'receiver_name': receivedBy.trim().isNotEmpty ? receivedBy.trim() : 'ໄມ້ຄຳ (Meii)',
          'total_lak': totalCostLak,
          'total_thb': totalCostThb,
          'payment_status': paymentStatus,
          'paid_amount_lak': paidAmount,
          'debt_amount_lak': debtAmount,
          'notes': note.trim(),
          'items': draftItems.map((d) => {
            'product_id': d.product.id,
            'product_name': d.product.name,
            'quantity': 1,
            'base_units_added': d.importedBaseUnits,
            'cost_per_base_unit': d.costPerBaseUnit,
            'cost_lak_entered': d.costLak,
            'cost_thb_entered': d.costThb,
            'line_total_lak': d.costLak,
            'line_total_thb': d.costThb,
            'retail_price_overrides': d.retailPriceOverrides,
          }).toList(),
        };

        final rpcRes = await client.rpc(
          'process_multi_product_grn',
          params: {'payload': rpcPayload},
        );
        if (rpcRes != null && (rpcRes['success'] == true || rpcRes is Map)) {
          await fetchPurchaseOrders();
          await fetchSuppliers();
          state = state.copyWith(isLoading: false);
          return true;
        }
      } catch (rpcErr) {
        debugPrint('createPurchaseOrder RPC fallback: $rpcErr');
      }

      // 2. Insert purchase_order with single-product fields (Legacy fallback)
      final firstDraft = draftItems.isNotEmpty ? draftItems.first : null;

      final Map<String, dynamic> poPayload = {
        'id': poId,
        if (supplierId != null && supplierId.isNotEmpty) 'supplier_id': supplierId,
        if (firstDraft != null) ...{
          'product_id': firstDraft.product.id,
          'product_name': firstDraft.product.name,
          'imported_base_units': firstDraft.importedBaseUnits,
          'tier1_qty': firstDraft.tier1Qty,
          'tier2_qty': firstDraft.tier2Qty,
          'tier3_qty': firstDraft.tier3Qty,
          'cost_thb': firstDraft.costThb,
          'cost_lak': firstDraft.costLak,
          'cost_per_base_unit': firstDraft.costPerBaseUnit,
        },
        'total_cost_lak': totalCostLak,
        'total_cost_thb': totalCostThb,
        'total_cost_vnd': totalCostVnd,
        'paid_amount': paidAmount,
        'debt_amount': debtAmount,
        'payment_status': paymentStatus,
        'received_by': receivedBy.trim().isNotEmpty ? receivedBy.trim() : 'ໄມ້ຄຳ (Meii)',
        'note': note.trim(),
        'created_at': now.toIso8601String(),
        'updated_at': now.toIso8601String(),
      };

      try {
        await client.from('purchase_orders').insert(poPayload);
      } catch (err) {
        // Fallback for schema where single-product columns do not exist directly on purchase_orders
        final Map<String, dynamic> basePayload = {
          'id': poId,
          if (supplierId != null && supplierId.isNotEmpty) 'supplier_id': supplierId,
          'total_cost_lak': totalCostLak,
          'total_cost_thb': totalCostThb,
          'total_cost_vnd': totalCostVnd,
          'paid_amount': paidAmount,
          'debt_amount': debtAmount,
          'payment_status': paymentStatus,
          'received_by': receivedBy.trim().isNotEmpty ? receivedBy.trim() : 'ໄມ້ຄຳ (Meii)',
          'note': note.trim(),
          'created_at': now.toIso8601String(),
          'updated_at': now.toIso8601String(),
        };
        await client.from('purchase_orders').insert(basePayload);
      }

      // 3. Insert purchase_order_items & Cascade Stock & Cost & Price overrides
      final List<Map<String, dynamic>> itemsPayload = [];
      for (final draft in draftItems) {
        itemsPayload.add({
          'purchase_order_id': poId,
          'product_id': draft.product.id,
          'product_name': draft.product.name,
          'cost_per_base_unit': draft.costPerBaseUnit,
          'cost_thb': draft.costThb,
          'cost_lak': draft.costLak,
          'cost_vnd': draft.costVnd,
          'imported_base_units': draft.importedBaseUnits,
          'tier1_qty': draft.tier1Qty,
          'tier2_qty': draft.tier2Qty,
          'tier3_qty': draft.tier3Qty,
          'created_at': now.toIso8601String(),
        });

        // 3A. Update Product Stock and Cost in Supabase
        final currentStock = draft.product.currentStockBaseUnits;
        final newStock = currentStock + draft.importedBaseUnits;

        await client.from('products').update({
          'current_stock_base_units': newStock,
          'cost_per_base_unit': draft.costPerBaseUnit,
          'updated_at': now.toIso8601String(),
        }).eq('id', draft.product.id);

        // 3B. If retail prices were overridden, update product_units table
        for (final unitOverride in draft.retailPriceOverrides.entries) {
          final unitId = unitOverride.key;
          final newRetailPrice = unitOverride.value;
          await client.from('product_units').update({
            'retail_price': newRetailPrice,
          }).eq('id', unitId);
        }
      }

      if (itemsPayload.isNotEmpty) {
        await client.from('purchase_order_items').insert(itemsPayload);
      }

      // 4. If initial payment > 0, record in supplier_debt_payments
      if (paidAmount > 0) {
        await client.from('supplier_debt_payments').insert({
          'purchase_order_id': poId,
          'payment_amount': paidAmount,
          'currency': primaryCurrency,
          'payment_method': 'CASH',
          'note': 'ຊຳລະເບື້ອງຕົ້ນຕອນຮັບສິນຄ້າ (Initial payment at GRN)',
          'created_at': now.toIso8601String(),
        });
      }

      // 5. Refresh Catalog provider so POS and products screen see updated stock & prices
      await ref.read(catalogProvider.notifier).fetchFromSupabase();

      // 6. Refresh Purchase Orders
      await fetchPurchaseOrders();
      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'Failed to create PO: $e');
      return false;
    }
  }

  /// Add debt repayment to an existing purchase order
  Future<bool> addSupplierDebtPayment({
    required String purchaseOrderId,
    required int paymentAmount,
    String currency = 'LAK',
    String paymentMethod = 'CASH',
    String? note,
  }) async {
    final client = _client;
    if (client == null) return false;

    state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      final po = state.purchaseOrders.firstWhere((p) => p.id == purchaseOrderId);
      final newPaid = po.paidAmount + paymentAmount;
      final newDebt = (po.debtAmount - paymentAmount).clamp(0, double.infinity).toInt();
      final newStatus = newDebt == 0 ? 'PAID' : 'PARTIAL';

      // 1. Record debt payment log
      await client.from('supplier_debt_payments').insert({
        'purchase_order_id': purchaseOrderId,
        'payment_amount': paymentAmount,
        'currency': currency,
        'payment_method': paymentMethod,
        if (note != null && note.isNotEmpty) 'note': note.trim(),
        'created_at': DateTime.now().toIso8601String(),
      });

      // 2. Update purchase_orders record
      await client.from('purchase_orders').update({
        'paid_amount': newPaid,
        'debt_amount': newDebt,
        'payment_status': newStatus,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', purchaseOrderId);

      await fetchPurchaseOrders();
      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'Failed to record payment: $e');
      return false;
    }
  }

  /// Delete Purchase Order and optionally revert stock in products table
  Future<bool> deletePurchaseOrder(String purchaseOrderId) async {
    final client = _client;
    if (client == null) return false;

    state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      // 1. Fetch current PO to identify items
      final po = state.purchaseOrders.firstWhere((p) => p.id == purchaseOrderId);

      // 2. Revert inventory stock if needed
      for (final it in po.items) {
        if (it.productId.isNotEmpty && it.importedBaseUnits > 0) {
          try {
            final prodData = await client
                .from('products')
                .select('id, current_stock_base_units')
                .eq('id', it.productId)
                .maybeSingle();

            if (prodData != null) {
              final currentStock = (prodData['current_stock_base_units'] as num?)?.toInt() ?? 0;
              final addedUnits = it.importedBaseUnits;
              final newStock = (currentStock - addedUnits).clamp(0, double.infinity).toInt();
              await client
                  .from('products')
                  .update({
                    'current_stock_base_units': newStock,
                    'updated_at': DateTime.now().toIso8601String(),
                  })
                  .eq('id', it.productId);
            }
          } catch (e) {
            debugPrint('Error reverting stock for ${it.productId}: $e');
          }
        }
      }

      // 3. Delete related debt payments & items
      await client.from('supplier_debt_payments').delete().eq('purchase_order_id', purchaseOrderId);
      await client.from('purchase_order_items').delete().eq('purchase_order_id', purchaseOrderId);

      // 4. Delete the purchase order
      await client.from('purchase_orders').delete().eq('id', purchaseOrderId);

      // 5. Refresh Catalog and PO list
      await ref.read(catalogProvider.notifier).fetchFromSupabase();
      await fetchPurchaseOrders();

      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'Failed to delete PO: $e');
      return false;
    }
  }
}

/// Helper draft structure for items during purchase order creation
class PurchaseItemDraft {
  final Product product;
  final int tier1Qty; // Carton / Két
  final int tier2Qty; // Pack / Lốc
  final int tier3Qty; // Piece / Lon
  final int importedBaseUnits;
  final int costPerBaseUnit;
  final double costThb;
  final int costLak;
  final int costVnd;
  final Map<String, int> retailPriceOverrides; // unitId -> newPrice

  PurchaseItemDraft({
    required this.product,
    this.tier1Qty = 0,
    this.tier2Qty = 0,
    this.tier3Qty = 0,
    required this.importedBaseUnits,
    required this.costPerBaseUnit,
    this.costThb = 0.0,
    required this.costLak,
    this.costVnd = 0,
    this.retailPriceOverrides = const {},
  });
}

final purchaseProvider = StateNotifierProvider<PurchaseProvider, PurchaseState>((ref) {
  return PurchaseProvider(ref);
});

// ============================================================================
// MULTI-PRODUCT GRN STATE MANAGEMENT (RIVERPOD)
// ============================================================================

/// Represents an item in the Multi-Product GRN Cart
class GrnCartItem {
  final Product product;
  final String unitId;
  final String unitName;
  final int tierLevel;
  final int multiplier;
  final int quantity;
  final double costThb;
  final int costLak;
  final Map<String, int> retailPriceOverrides; // unitId -> override retail price

  const GrnCartItem({
    required this.product,
    required this.unitId,
    required this.unitName,
    required this.tierLevel,
    required this.multiplier,
    required this.quantity,
    required this.costThb,
    required this.costLak,
    this.retailPriceOverrides = const {},
  });

  int get baseUnitsAdded => quantity * multiplier;
  int get lineTotalLak => quantity * costLak;
  double get lineTotalThb => quantity * costThb;
  int get costPerBaseUnit =>
      baseUnitsAdded > 0 ? (lineTotalLak / baseUnitsAdded).round() : costLak;

  GrnCartItem copyWith({
    Product? product,
    String? unitId,
    String? unitName,
    int? tierLevel,
    int? multiplier,
    int? quantity,
    double? costThb,
    int? costLak,
    Map<String, int>? retailPriceOverrides,
  }) {
    return GrnCartItem(
      product: product ?? this.product,
      unitId: unitId ?? this.unitId,
      unitName: unitName ?? this.unitName,
      tierLevel: tierLevel ?? this.tierLevel,
      multiplier: multiplier ?? this.multiplier,
      quantity: quantity ?? this.quantity,
      costThb: costThb ?? this.costThb,
      costLak: costLak ?? this.costLak,
      retailPriceOverrides: retailPriceOverrides ?? this.retailPriceOverrides,
    );
  }
}

/// State of the Multi-Product GRN Cart
class GrnCartState {
  final List<GrnCartItem> items;
  final String? supplierId;
  final String receiverName;
  final String poCode;
  final int exchangeRate; // default 720 Kip / 1 Baht
  final String paymentStatus; // 'PAID', 'DEBT', 'PARTIAL'
  final int paidAmountLak;
  final String note;
  final bool isSubmitting;
  final String? errorMessage;

  const GrnCartState({
    this.items = const [],
    this.supplierId,
    this.receiverName = 'ໄມ້ຄຳ (Meii)',
    this.poCode = '',
    this.exchangeRate = 720,
    this.paymentStatus = 'PAID',
    this.paidAmountLak = 0,
    this.note = '',
    this.isSubmitting = false,
    this.errorMessage,
  });

  int get totalLak => items.fold(0, (sum, it) => sum + it.lineTotalLak);
  double get totalThb => items.fold(0.0, (sum, it) => sum + it.lineTotalThb);

  int get debtAmountLak {
    if (paymentStatus == 'PAID') return 0;
    if (paymentStatus == 'DEBT') return totalLak;
    return (totalLak - paidAmountLak).clamp(0, totalLak);
  }

  GrnCartState copyWith({
    List<GrnCartItem>? items,
    String? supplierId,
    String? receiverName,
    String? poCode,
    int? exchangeRate,
    String? paymentStatus,
    int? paidAmountLak,
    String? note,
    bool? isSubmitting,
    String? errorMessage,
  }) {
    return GrnCartState(
      items: items ?? this.items,
      supplierId: supplierId ?? this.supplierId,
      receiverName: receiverName ?? this.receiverName,
      poCode: poCode ?? this.poCode,
      exchangeRate: exchangeRate ?? this.exchangeRate,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      paidAmountLak: paidAmountLak ?? this.paidAmountLak,
      note: note ?? this.note,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: errorMessage,
    );
  }
}

/// Notifier managing Multi-Product GRN Cart operations & atomic Supabase RPC execution
class GrnCartNotifier extends StateNotifier<GrnCartState> {
  final Ref ref;

  GrnCartNotifier(this.ref) : super(GrnCartState(poCode: _generatePoCode()));

  static String _generatePoCode() {
    final now = DateTime.now();
    final y = now.year.toString().substring(2);
    final m = now.month.toString().padLeft(2, '0');
    final d = now.day.toString().padLeft(2, '0');
    final r = (now.millisecondsSinceEpoch % 10000).toString().padLeft(4, '0');
    return 'PO-$y$m$d-$r';
  }

  void reset({String? defaultReceiver}) {
    state = GrnCartState(
      poCode: _generatePoCode(),
      receiverName: defaultReceiver ?? 'ໄມ້ຄຳ (Meii)',
      exchangeRate: state.exchangeRate,
    );
  }

  void setSupplier(String? id) => state = state.copyWith(supplierId: id);
  void setReceiver(String name) => state = state.copyWith(receiverName: name);
  void setExchangeRate(int rate) => state = state.copyWith(exchangeRate: rate);

  void setPaymentStatus(String s) {
    int newPaid = state.paidAmountLak;
    if (s == 'PAID') newPaid = state.totalLak;
    if (s == 'DEBT') newPaid = 0;
    state = state.copyWith(paymentStatus: s, paidAmountLak: newPaid);
  }

  void setPaidAmount(int amt) => state = state.copyWith(paidAmountLak: amt);
  void setNote(String n) => state = state.copyWith(note: n);

  void addItem(Product product, {ProductUnit? selectedUnit}) {
    final unit = selectedUnit ??
        (product.units.isNotEmpty ? product.units.first : null);
    final unitId = unit?.id ?? 'base_${product.id}';
    final unitName = unit?.unitName ?? product.baseUnit;
    final multiplier = unit?.multiplier ?? 1;
    final tierLevel = unit?.tier ?? 1;

    // Determine initial unit purchase costs
    int costLak = product.costKip > 0
        ? product.costKip
        : (product.costPerBaseUnit * multiplier);
    double costThb = product.costBaht > 0
        ? product.costBaht.toDouble()
        : (costLak > 0 && state.exchangeRate > 0 ? (costLak / state.exchangeRate) : 0.0);

    // If already in cart with same product and unit
    final existingIndex = state.items.indexWhere(
      (it) => it.product.id == product.id && it.unitId == unitId,
    );

    if (existingIndex >= 0) {
      final current = state.items[existingIndex];
      final updatedList = List<GrnCartItem>.from(state.items);
      updatedList[existingIndex] = current.copyWith(quantity: current.quantity + 1);
      state = state.copyWith(items: updatedList);
    } else {
      final newItem = GrnCartItem(
        product: product,
        unitId: unitId,
        unitName: unitName,
        tierLevel: tierLevel,
        multiplier: multiplier,
        quantity: 1,
        costThb: costThb,
        costLak: costLak,
      );
      state = state.copyWith(items: [...state.items, newItem]);
    }

    if (state.paymentStatus == 'PAID') {
      state = state.copyWith(paidAmountLak: state.totalLak);
    }
  }

  bool addByBarcode(String barcode, List<Product> catalog) {
    if (barcode.trim().isEmpty) return false;
    final code = barcode.trim().toLowerCase();

    for (final p in catalog) {
      if (p.barcode != null && p.barcode!.toLowerCase() == code) {
        addItem(p);
        return true;
      }
      for (final u in p.units) {
        if (u.barcode != null && u.barcode!.toLowerCase() == code) {
          addItem(p, selectedUnit: u);
          return true;
        }
      }
    }
    return false;
  }

  void updateItemQuantity(int index, int qty) {
    if (index < 0 || index >= state.items.length) return;
    final clamped = qty < 1 ? 1 : qty;
    final updatedList = List<GrnCartItem>.from(state.items);
    updatedList[index] = updatedList[index].copyWith(quantity: clamped);
    state = state.copyWith(items: updatedList);
    if (state.paymentStatus == 'PAID') {
      state = state.copyWith(paidAmountLak: state.totalLak);
    }
  }

  void stepItemQuantity(int index, int delta) {
    if (index < 0 || index >= state.items.length) return;
    updateItemQuantity(index, state.items[index].quantity + delta);
  }

  void updateItemUnit(int index, ProductUnit unit) {
    if (index < 0 || index >= state.items.length) return;
    final current = state.items[index];
    final costLak = current.product.costPerBaseUnit * unit.multiplier;
    final costThb = state.exchangeRate > 0 ? (costLak / state.exchangeRate) : 0.0;

    final updated = current.copyWith(
      unitId: unit.id,
      unitName: unit.unitName,
      multiplier: unit.multiplier,
      tierLevel: unit.tier ?? 1,
      costLak: costLak,
      costThb: costThb,
    );
    final updatedList = List<GrnCartItem>.from(state.items);
    updatedList[index] = updated;
    state = state.copyWith(items: updatedList);
    if (state.paymentStatus == 'PAID') {
      state = state.copyWith(paidAmountLak: state.totalLak);
    }
  }

  void updateItemCostThb(int index, double thb) {
    if (index < 0 || index >= state.items.length) return;
    final current = state.items[index];
    final lak = (thb * state.exchangeRate).round();
    final updatedList = List<GrnCartItem>.from(state.items);
    updatedList[index] = current.copyWith(costThb: thb, costLak: lak);
    state = state.copyWith(items: updatedList);
    if (state.paymentStatus == 'PAID') {
      state = state.copyWith(paidAmountLak: state.totalLak);
    }
  }

  void updateItemCostLak(int index, int lak) {
    if (index < 0 || index >= state.items.length) return;
    final current = state.items[index];
    // Rule: modifying LAK should not overwrite THB
    final updatedList = List<GrnCartItem>.from(state.items);
    updatedList[index] = current.copyWith(costLak: lak);
    state = state.copyWith(items: updatedList);
    if (state.paymentStatus == 'PAID') {
      state = state.copyWith(paidAmountLak: state.totalLak);
    }
  }

  void updateRetailOverride(int index, String unitId, int newPrice) {
    if (index < 0 || index >= state.items.length) return;
    final current = state.items[index];
    final overrides = Map<String, int>.from(current.retailPriceOverrides);
    overrides[unitId] = newPrice;
    final updatedList = List<GrnCartItem>.from(state.items);
    updatedList[index] = current.copyWith(retailPriceOverrides: overrides);
    state = state.copyWith(items: updatedList);
  }

  void removeItem(int index) {
    if (index < 0 || index >= state.items.length) return;
    final updatedList = List<GrnCartItem>.from(state.items)..removeAt(index);
    state = state.copyWith(items: updatedList);
    if (state.paymentStatus == 'PAID') {
      state = state.copyWith(paidAmountLak: state.totalLak);
    }
  }

  /// Atomic Postgres RPC GRN Submission with automatic cache invalidation
  Future<bool> submitGRN() async {
    if (state.items.isEmpty) {
      state = state.copyWith(errorMessage: 'ກະລຸນາເລືອກຢ່າງໜ້ອຍ 1 ສິນຄ້າ');
      return false;
    }

    state = state.copyWith(isSubmitting: true, errorMessage: null);

    SupabaseClient? client;
    try {
      client = Supabase.instance.client;
    } catch (_) {}

    if (client == null) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: 'Supabase client not initialized',
      );
      return false;
    }

    final itemsPayload = state.items.map((it) {
      return {
        'product_id': it.product.id,
        'product_name': it.product.name,
        'unit_id': it.unitId,
        'unit_name': it.unitName,
        'tier_level': it.tierLevel,
        'quantity': it.quantity,
        'base_units_added': it.baseUnitsAdded,
        'cost_lak_entered': it.costLak,
        'cost_thb_entered': it.costThb,
        'cost_per_base_unit': it.costPerBaseUnit,
        'line_total_lak': it.lineTotalLak,
        'line_total_thb': it.lineTotalThb,
        'retail_price_overrides': it.retailPriceOverrides,
      };
    }).toList();

    final payload = {
      'po_code': state.poCode,
      'supplier_id': state.supplierId,
      'receiver_name': state.receiverName.trim().isNotEmpty
          ? state.receiverName.trim()
          : 'ໄມ້ຄຳ (Meii)',
      'total_lak': state.totalLak,
      'total_thb': state.totalThb,
      'payment_status': state.paymentStatus,
      'paid_amount_lak':
          state.paymentStatus == 'DEBT' ? 0 : state.paidAmountLak,
      'debt_amount_lak': state.debtAmountLak,
      'notes': state.note.trim(),
      'items': itemsPayload,
    };

    try {
      // 1. Try atomic PostgreSQL RPC first
      try {
        final rpcRes = await client.rpc(
          'process_multi_product_grn',
          params: {'payload': payload},
        );
        debugPrint('GRN RPC Success: $rpcRes');
      } catch (rpcErr) {
        debugPrint('RPC process_multi_product_grn fallback due to: $rpcErr');
        // Fallback: Client-side sequential execution
        await _fallbackClientExecution(client, payload);
      }

      // 2. Refetch and synchronize local and Riverpod caches
      await Future.wait([
        ref.read(catalogProvider.notifier).fetchFromSupabase(),
        ref.read(purchaseProvider.notifier).fetchPurchaseOrders(),
        ref.read(purchaseProvider.notifier).fetchSuppliers(),
      ]);

      reset();
      state = state.copyWith(isSubmitting: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: 'Failed to save GRN: $e',
      );
      return false;
    }
  }

  Future<void> _fallbackClientExecution(
    SupabaseClient client,
    Map<String, dynamic> payload,
  ) async {
    final now = DateTime.now().toIso8601String();
    final poId = payload['po_code'] as String;
    final items = payload['items'] as List<dynamic>;

    // Step 0: Check if PO already exists to revert old inventory
    final oldPoRes = await client
        .from('purchase_orders')
        .select('id, product_id, imported_base_units, purchase_order_items(*)')
        .eq('id', poId)
        .maybeSingle();

    if (oldPoRes != null) {
      final oldItems = (oldPoRes['purchase_order_items'] as List<dynamic>?) ?? [];
      if (oldItems.isNotEmpty) {
        for (final oldIt in oldItems) {
          final pid = oldIt['product_id'] as String?;
          final units = (oldIt['imported_base_units'] as num?)?.toInt() ?? 0;
          if (pid != null && units > 0) {
            try {
              final prodRes = await client
                  .from('products')
                  .select('current_stock_base_units')
                  .eq('id', pid)
                  .maybeSingle();
              if (prodRes != null) {
                final curStock = (prodRes['current_stock_base_units'] as num?)?.toInt() ?? 0;
                await client.from('products').update({
                  'current_stock_base_units': curStock - units,
                  'updated_at': now,
                }).eq('id', pid);
              }
            } catch (e) {
              debugPrint('Fallback revert error for $pid: $e');
            }
          }
        }
      } else if (oldPoRes['product_id'] != null) {
        final pid = oldPoRes['product_id'] as String;
        final units = (oldPoRes['imported_base_units'] as num?)?.toInt() ?? 0;
        if (units > 0) {
          try {
            final prodRes = await client
                .from('products')
                .select('current_stock_base_units')
                .eq('id', pid)
                .maybeSingle();
            if (prodRes != null) {
              final curStock = (prodRes['current_stock_base_units'] as num?)?.toInt() ?? 0;
              await client.from('products').update({
                'current_stock_base_units': curStock - units,
                'updated_at': now,
              }).eq('id', pid);
            }
          } catch (_) {}
        }
      }

      // Delete old items and old initial debt logs
      await client.from('purchase_order_items').delete().eq('purchase_order_id', poId);
      await client
          .from('supplier_debt_payments')
          .delete()
          .eq('purchase_order_id', poId);
    }

    // Consistent Payment & Debt Calculation
    final totalLak = (payload['total_lak'] as num).toInt();
    int paidLak = (payload['paid_amount_lak'] as num?)?.toInt() ?? 0;
    String paymentStatus = (payload['payment_status'] as String?) ?? 'PAID';
    int debtLak = 0;

    if (paidLak >= totalLak) {
      paymentStatus = 'PAID';
      debtLak = 0;
      paidLak = totalLak;
    } else if (paidLak > 0) {
      paymentStatus = 'PARTIAL';
      debtLak = totalLak - paidLak;
    } else {
      paymentStatus = 'DEBT';
      paidLak = 0;
      debtLak = totalLak;
    }

    // Step 1: Upsert purchase_orders
    await client.from('purchase_orders').upsert({
      'id': poId,
      if (payload['supplier_id'] != null) 'supplier_id': payload['supplier_id'],
      'total_cost_lak': totalLak,
      'total_cost_thb': payload['total_thb'],
      'paid_amount': paidLak,
      'debt_amount': debtLak,
      'payment_status': paymentStatus,
      'received_by': payload['receiver_name'],
      'note': payload['notes'],
      'updated_at': now,
    });

    // Step 2 & 3: Insert items and update products
    for (final rawItem in items) {
      final it = rawItem as Map<String, dynamic>;
      final productId = it['product_id'] as String;
      final baseUnitsAdded = (it['base_units_added'] as num).toInt();
      final costLak = (it['cost_lak_entered'] as num).toInt();
      final costThb = (it['cost_thb_entered'] as num).toDouble();
      final costPerBaseUnit = (it['cost_per_base_unit'] as num).toInt();

      try {
        await client.from('purchase_order_items').insert({
          'purchase_order_id': poId,
          'product_id': productId,
          'product_name': it['product_name'],
          'unit_id': it['unit_id'],
          'unit_name': it['unit_name'],
          'tier_level': it['tier_level'],
          'quantity': it['quantity'],
          'base_units_added': baseUnitsAdded,
          'cost_per_base_unit': costPerBaseUnit,
          'cost_lak': costLak,
          'cost_thb': costThb,
          'line_total_lak': it['line_total_lak'],
          'line_total_thb': it['line_total_thb'],
          'created_at': now,
        });
      } catch (itemErr) {
        debugPrint('Item insert fallback note: $itemErr');
      }

      try {
        final prodRes = await client
            .from('products')
            .select('current_stock_base_units')
            .eq('id', productId)
            .maybeSingle();

        final currentStock =
            (prodRes?['current_stock_base_units'] as num?)?.toInt() ?? 0;
        final newStock = currentStock + baseUnitsAdded;

        await client.from('products').update({
          'current_stock_base_units': newStock,
          'track_stock': true,
          'cost_per_base_unit': costPerBaseUnit,
          'cost_kip': costLak,
          'cost_baht': costThb.round(),
          'updated_at': now,
        }).eq('id', productId);
      } catch (prodErr) {
        debugPrint('Product update error: $prodErr');
      }

      final overrides = it['retail_price_overrides'] as Map<dynamic, dynamic>?;
      if (overrides != null && overrides.isNotEmpty) {
        for (final entry in overrides.entries) {
          try {
            await client.from('product_units').update({
              'retail_price': entry.value,
            }).eq('id', entry.key);
          } catch (_) {}
        }
      }
    }

    // Step 4: Debt payment if applicable
    if (paidLak > 0) {
      try {
        await client.from('supplier_debt_payments').insert({
          'purchase_order_id': poId,
          'payment_amount': paidLak,
          'currency': 'LAK',
          'payment_method': 'CASH',
          'note': oldPoRes != null
              ? 'ຊຳລະເບື້ອງຕົ້ນ (ອັບເດດໃບຮັບ) (Updated initial payment at GRN)'
              : 'ຊຳລະເບື້ອງຕົ້ນຕອນຮັບສິນຄ້າ (Initial payment at GRN)',
          'created_at': now,
        });
      } catch (_) {}
    } else if (debtLak > 0) {
      try {
        await client.from('supplier_debt_payments').insert({
          'purchase_order_id': poId,
          'payment_amount': 0,
          'currency': 'LAK',
          'payment_method': 'DEBT_RECORD',
          'note': 'ບັນທຶກຍອດໜີ້ຄ້າງຊຳລະເລີ່ມຕົ້ນ (Initial debt record)',
          'created_at': now,
        });
      } catch (_) {}
    }
  }
}

final grnCartProvider =
    StateNotifierProvider<GrnCartNotifier, GrnCartState>((ref) {
  return GrnCartNotifier(ref);
});
