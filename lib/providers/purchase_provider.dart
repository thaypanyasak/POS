import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../domain/models/product.dart';
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

      // 2. Insert purchase_order with single-product fields
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
