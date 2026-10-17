import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../../domain/models/cart_item.dart';
import '../../../../domain/models/product.dart';
import '../../../../domain/models/product_unit.dart';
import '../../../../domain/models/sale_transaction.dart';

class CartState {
  final List<CartItem> items;
  final bool isWholesaleMode;
  final int globalPriceTier; // 1: standard (default), 2: regular customer, 3: wholesale/vip
  final PosCustomer customer;
  final List<List<CartItem>> heldOrders;
  final bool isEditingOldOrder;
  final SaleTransaction? originalTransaction;
  final String? originalTransactionId;
  final String? originalReceiptNumber;
  final String? originalPaymentMethod; // 'CASH', 'TRANSFER', 'DEBT'
  final String? originalPaymentStatus; // 'PAID', 'PARTIAL', 'DEBT'
  final String? originalCustomerName;
  final int originalAmountTendered;
  final int originalRemainingDebt;

  const CartState({
    this.items = const [],
    this.isWholesaleMode = false,
    this.globalPriceTier = 1,
    this.customer = PosCustomer.walkIn,
    this.heldOrders = const [],
    this.isEditingOldOrder = false,
    this.originalTransaction,
    this.originalTransactionId,
    this.originalReceiptNumber,
    this.originalPaymentMethod,
    this.originalPaymentStatus,
    this.originalCustomerName,
    this.originalAmountTendered = 0,
    this.originalRemainingDebt = 0,
  });

  /// Pure goods subtotal before crate deposit
  int get pureGoodsSubtotal =>
      items.fold<int>(0, (sum, item) => sum + item.lineGoodsTotal);

  /// Total crate deposit / missing crate fee across all items
  int get totalCrateDeposit =>
      items.fold<int>(0, (sum, item) => sum + item.crateFeeTotal);

  /// Catalog subtotal before discounts
  int get subtotal =>
      items.fold<int>(0, (sum, item) => sum + item.lineSubtotal);

  /// Total discount given across all items (from price overrides)
  int get discountTotal =>
      items.fold<int>(0, (sum, item) => sum + item.lineDiscountTotal);

  /// Net total amount to collect (Lao Kip)
  int get grandTotal =>
      items.fold<int>(0, (sum, item) => sum + item.lineTotal);

  /// Cost of goods sold for current ticket
  int get totalCostOfGoods =>
      items.fold<int>(0, (sum, item) => sum + item.lineTotalCost);

  /// Gross profit for current ticket: `grandTotal - totalCostOfGoods`
  int get grossProfit => grandTotal - totalCostOfGoods;

  /// Gross profit margin percentage
  double get profitMarginPercent {
    if (grandTotal == 0) return 0.0;
    return (grossProfit / grandTotal) * 100.0;
  }

  /// Total count of physical units in cart
  int get totalQuantity =>
      items.fold<int>(0, (sum, item) => sum + item.quantity);

  /// Total count of distinct line items in cart
  int get itemCount => items.length;

  /// Formatted grand total with Lao thousands separators
  String get formattedGrandTotal {
    final str = grandTotal.toString();
    final buffer = StringBuffer();
    for (int i = 0; i < str.length; i++) {
      if (i > 0 && (str.length - i) % 3 == 0) {
        buffer.write('.');
      }
      buffer.write(str[i]);
    }
    return buffer.toString();
  }

  /// Is cart empty
  bool get isEmpty => items.isEmpty;

  CartState copyWith({
    List<CartItem>? items,
    bool? isWholesaleMode,
    int? globalPriceTier,
    PosCustomer? customer,
    List<List<CartItem>>? heldOrders,
    bool? isEditingOldOrder,
    SaleTransaction? originalTransaction,
    String? originalTransactionId,
    String? originalReceiptNumber,
    String? originalPaymentMethod,
    String? originalPaymentStatus,
    String? originalCustomerName,
    int? originalAmountTendered,
    int? originalRemainingDebt,
    bool clearEditingTransaction = false,
  }) {
    return CartState(
      items: items ?? this.items,
      isWholesaleMode: isWholesaleMode ?? this.isWholesaleMode,
      globalPriceTier: globalPriceTier ?? this.globalPriceTier,
      customer: customer ?? this.customer,
      heldOrders: heldOrders ?? this.heldOrders,
      isEditingOldOrder: clearEditingTransaction ? false : (isEditingOldOrder ?? this.isEditingOldOrder),
      originalTransaction: clearEditingTransaction ? null : (originalTransaction ?? this.originalTransaction),
      originalTransactionId: clearEditingTransaction ? null : (originalTransactionId ?? originalTransaction?.id ?? this.originalTransactionId),
      originalReceiptNumber: clearEditingTransaction ? null : (originalReceiptNumber ?? originalTransaction?.receiptNumber ?? this.originalReceiptNumber),
      originalPaymentMethod: clearEditingTransaction ? null : (originalPaymentMethod ?? this.originalPaymentMethod),
      originalPaymentStatus: clearEditingTransaction ? null : (originalPaymentStatus ?? this.originalPaymentStatus),
      originalCustomerName: clearEditingTransaction ? null : (originalCustomerName ?? this.originalCustomerName),
      originalAmountTendered: clearEditingTransaction ? 0 : (originalAmountTendered ?? this.originalAmountTendered),
      originalRemainingDebt: clearEditingTransaction ? 0 : (originalRemainingDebt ?? this.originalRemainingDebt),
    );
  }
}

class CartNotifier extends StateNotifier<CartState> {
  static const _uuid = Uuid();

  CartNotifier() : super(const CartState());

  /// Adds a product to the cart with strict stock validation for tracked items
  bool addProduct(Product product, {ProductUnit? unit, int quantity = 1}) {
    final selectedUnit = unit ?? product.defaultBaseUnit;
    final multiplier = selectedUnit.multiplier > 0 ? selectedUnit.multiplier : 1;

    // Check inventory constraint if trackStock == true
    if (product.trackStock) {
      final currentBaseInCart = state.items
          .where((it) => it.product.id == product.id)
          .fold<int>(0, (sum, it) => sum + (it.selectedUnit.multiplier * it.quantity));
      final requestedBase = currentBaseInCart + (multiplier * quantity);

      if (requestedBase > product.currentStockBaseUnits) {
        return false; // Exceeds available stock
      }
    }

    final existingIndex = state.items.indexWhere(
      (item) =>
          item.product.id == product.id &&
          item.selectedUnit.id == selectedUnit.id,
    );

    if (existingIndex >= 0) {
      final existing = state.items[existingIndex];
      final updated = existing.copyWith(
        quantity: existing.quantity + quantity,
      );
      final newItems = List<CartItem>.from(state.items);
      newItems[existingIndex] = updated;
      state = state.copyWith(items: newItems);
    } else {
      final newItem = CartItem(
        id: _uuid.v4(),
        product: product,
        selectedUnit: selectedUnit,
        quantity: quantity,
        isWholesaleMode: state.isWholesaleMode,
        selectedPriceTier: state.globalPriceTier,
      );
      state = state.copyWith(items: [...state.items, newItem]);
    }
    return true;
  }

  /// Updates quantity of a specific cart item with stock check
  bool updateQuantity(String cartItemId, int newQuantity) {
    if (newQuantity <= 0) {
      removeItem(cartItemId);
      return true;
    }

    final itemIndex = state.items.indexWhere((it) => it.id == cartItemId);
    if (itemIndex < 0) return false;

    final targetItem = state.items[itemIndex];
    final product = targetItem.product;

    if (product.trackStock) {
      final otherBaseInCart = state.items
          .where((it) => it.product.id == product.id && it.id != cartItemId)
          .fold<int>(0, (sum, it) => sum + (it.selectedUnit.multiplier * it.quantity));
      final targetMultiplier = targetItem.selectedUnit.multiplier > 0
          ? targetItem.selectedUnit.multiplier
          : 1;
      final requestedTotalBase = otherBaseInCart + (targetMultiplier * newQuantity);

      if (requestedTotalBase > product.currentStockBaseUnits) {
        return false;
      }
    }

    final newItems = state.items.map((item) {
      if (item.id == cartItemId) {
        return item.copyWith(quantity: newQuantity);
      }
      return item;
    }).toList();

    state = state.copyWith(items: newItems);
    return true;
  }

  /// Increments quantity by 1
  void incrementQuantity(String cartItemId) {
    final item = state.items.firstWhere((i) => i.id == cartItemId);
    updateQuantity(cartItemId, item.quantity + 1);
  }

  /// Decrements quantity by 1
  void decrementQuantity(String cartItemId) {
    final item = state.items.firstWhere((i) => i.id == cartItemId);
    updateQuantity(cartItemId, item.quantity - 1);
  }

  /// Removes a line item from the cart
  void removeItem(String cartItemId) {
    final newItems =
        state.items.where((item) => item.id != cartItemId).toList();
    state = state.copyWith(items: newItems);
  }

  /// Switches the packaging unit for an existing line item (e.g. from ແພັກ to ແກັດ)
  void switchUnit(String cartItemId, ProductUnit newUnit) {
    final newItems = state.items.map((item) {
      if (item.id == cartItemId) {
        return item.copyWith(
          selectedUnit: newUnit,
          clearOverride: true, // Reset custom price when unit changes
        );
      }
      return item;
    }).toList();

    state = state.copyWith(items: newItems);
  }

  /// Applies on-the-fly custom price override (e.g. for regular customers)
  void applyPriceOverride(
    String cartItemId,
    int customPrice, {
    String? reason,
  }) {
    final newItems = state.items.map((item) {
      if (item.id == cartItemId) {
        return item.copyWith(
          customPrice: customPrice,
          overrideReason: reason ?? 'ລູກຄ້າປະຈຳ',
        );
      }
      return item;
    }).toList();

    state = state.copyWith(items: newItems);
  }

  /// Clears custom price override for an item
  void resetPriceOverride(String cartItemId) {
    final newItems = state.items.map((item) {
      if (item.id == cartItemId) {
        return item.copyWith(clearOverride: true);
      }
      return item;
    }).toList();

    state = state.copyWith(items: newItems);
  }

  /// Sets price tier (1: standard, 2: regular, 3: wholesale/vip) for a specific item
  void selectPriceTier(String cartItemId, int tier) {
    final newItems = state.items.map((item) {
      if (item.id == cartItemId) {
        return item.copyWith(
          selectedPriceTier: tier,
          clearOverride: true,
        );
      }
      return item;
    }).toList();

    state = state.copyWith(items: newItems);
  }

  /// Sets global price tier (1, 2, or 3) and applies it to all items in cart
  void setGlobalPriceTier(int tier) {
    final newItems = state.items.map((item) {
      return item.copyWith(
        selectedPriceTier: tier,
        clearOverride: true,
      );
    }).toList();

    state = state.copyWith(
      globalPriceTier: tier,
      items: newItems,
    );
  }

  /// Toggles missing crate deposit fee (ບໍ່ມີແກັດປ່ຽນ) for an item
  void toggleCrateDeposit(String cartItemId, bool noEmptyCrates) {
    final newItems = state.items.map((item) {
      if (item.id == cartItemId) {
        return item.copyWith(
          noEmptyCrates: noEmptyCrates,
          missingCratesCount: noEmptyCrates ? (item.missingCratesCount ?? item.quantity) : 0,
        );
      }
      return item;
    }).toList();

    state = state.copyWith(items: newItems);
  }

  /// Updates count of missing crates for an item
  void updateMissingCrates(String cartItemId, int missingCount) {
    final newItems = state.items.map((item) {
      if (item.id == cartItemId) {
        final clamped = missingCount.clamp(1, item.quantity);
        return item.copyWith(
          noEmptyCrates: true,
          missingCratesCount: clamped,
        );
      }
      return item;
    }).toList();

    state = state.copyWith(items: newItems);
  }

  /// Toggles wholesale / retail mode for the transaction
  void toggleWholesaleMode(bool isWholesale) {
    final newItems = state.items.map((item) {
      return item.copyWith(isWholesaleMode: isWholesale);
    }).toList();

    state = state.copyWith(
      isWholesaleMode: isWholesale,
      items: newItems,
    );
  }

  /// Sets the active customer
  void setCustomer(PosCustomer customer) {
    // If selecting regular customer, suggest wholesale pricing automatically
    final shouldBeWholesale = customer.type == CustomerType.regular
        ? true
        : state.isWholesaleMode;

    final newItems = state.items.map((item) {
      return item.copyWith(isWholesaleMode: shouldBeWholesale);
    }).toList();

    state = state.copyWith(
      customer: customer,
      isWholesaleMode: shouldBeWholesale,
      items: newItems,
    );
  }

  /// Sets or updates the customer name directly from manual input
  void setCustomerName(String name) {
    final trimmed = name.trim();
    final updatedName = trimmed.isEmpty ? 'ລູກຄ້າທົ່ວໄປ' : trimmed;
    state = state.copyWith(
      customer: state.customer.copyWith(name: updatedName),
    );
  }

  /// Holds current cart ticket and starts a new one
  void holdCurrentOrder() {
    if (state.items.isEmpty) return;
    final held = [...state.heldOrders, state.items];
    state = state.copyWith(
      items: [],
      customer: PosCustomer.walkIn,
      heldOrders: held,
    );
  }

  /// Recalls the last held order
  void recallLastOrder() {
    if (state.heldOrders.isEmpty) return;
    final heldList = List<List<CartItem>>.from(state.heldOrders);
    final restoredItems = heldList.removeLast();
    state = state.copyWith(
      items: restoredItems,
      heldOrders: heldList,
    );
  }

  /// Completely clears the cart
  void clearCart() {
    state = state.copyWith(
      items: [],
      globalPriceTier: 1,
      customer: PosCustomer.walkIn,
      clearEditingTransaction: true,
    );
  }

  /// Loads an existing completed/debt order into the POS cart for editing
  void editExistingOrder(SaleTransaction tx, List<Product> catalogProducts) {
    final List<CartItem> loadedItems = [];

    for (final item in tx.items) {
      final product = catalogProducts.firstWhere(
        (p) => p.id == item.product.id,
        orElse: () => item.product,
      );

      final unit = product.units.firstWhere(
        (u) => u.unitName == item.selectedUnit.unitName,
        orElse: () => item.selectedUnit,
      );

      loadedItems.add(
        CartItem(
          id: item.id.isNotEmpty ? item.id : 'item_${_uuid.v4()}',
          product: product,
          selectedUnit: unit,
          quantity: item.quantity,
          customPrice: item.customPrice,
          isWholesaleMode: tx.isWholesale,
          noEmptyCrates: item.noEmptyCrates,
          missingCratesCount: item.missingCratesCount,
        ),
      );
    }

    final String pMethod = (tx.isDebt || tx.paymentMethod == PaymentMethod.debt)
        ? 'DEBT'
        : (tx.paymentMethod == PaymentMethod.qrTransfer ? 'TRANSFER' : 'CASH');

    final String pStatus = pMethod == 'DEBT'
        ? (tx.debtAmount > 0
            ? (tx.paidAmount > 0 ? 'PARTIAL' : 'DEBT')
            : 'PAID')
        : 'PAID';

    final int pTendered = tx.isDebt ? tx.paidAmount : tx.amountTendered;
    final int pDebt = tx.debtAmount;

    state = state.copyWith(
      items: loadedItems,
      customer: tx.customer,
      isWholesaleMode: tx.isWholesale,
      isEditingOldOrder: true,
      originalTransaction: tx,
      originalTransactionId: tx.id,
      originalReceiptNumber: tx.receiptNumber,
      originalPaymentMethod: pMethod,
      originalPaymentStatus: pStatus,
      originalCustomerName: tx.customer.name,
      originalAmountTendered: pTendered,
      originalRemainingDebt: pDebt,
    );
  }

  /// Cancels editing mode and restores fresh cart
  void cancelEditingOrder() {
    state = state.copyWith(
      items: const [],
      customer: PosCustomer.walkIn,
      isWholesaleMode: false,
      clearEditingTransaction: true,
    );
  }
}

final cartProvider =
    StateNotifierProvider<CartNotifier, CartState>((ref) => CartNotifier());
