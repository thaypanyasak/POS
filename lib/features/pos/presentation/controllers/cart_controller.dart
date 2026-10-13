import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../../domain/models/cart_item.dart';
import '../../../../domain/models/product.dart';
import '../../../../domain/models/product_unit.dart';
import '../../../../domain/models/sale_transaction.dart';

class CartState {
  final List<CartItem> items;
  final bool isWholesaleMode;
  final PosCustomer customer;
  final List<List<CartItem>> heldOrders;

  const CartState({
    this.items = const [],
    this.isWholesaleMode = false,
    this.customer = PosCustomer.walkIn,
    this.heldOrders = const [],
  });

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

  /// Is cart empty
  bool get isEmpty => items.isEmpty;

  CartState copyWith({
    List<CartItem>? items,
    bool? isWholesaleMode,
    PosCustomer? customer,
    List<List<CartItem>>? heldOrders,
  }) {
    return CartState(
      items: items ?? this.items,
      isWholesaleMode: isWholesaleMode ?? this.isWholesaleMode,
      customer: customer ?? this.customer,
      heldOrders: heldOrders ?? this.heldOrders,
    );
  }
}

class CartNotifier extends StateNotifier<CartState> {
  static const _uuid = Uuid();

  CartNotifier() : super(const CartState());

  /// Adds a product to the cart. If the product and unit match an existing line item,
  /// increments quantity; otherwise adds a new line item.
  void addProduct(Product product, {ProductUnit? unit, int quantity = 1}) {
    final selectedUnit = unit ?? product.defaultBaseUnit;
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
      );
      state = state.copyWith(items: [...state.items, newItem]);
    }
  }

  /// Updates quantity of a specific cart item
  void updateQuantity(String cartItemId, int newQuantity) {
    if (newQuantity <= 0) {
      removeItem(cartItemId);
      return;
    }

    final newItems = state.items.map((item) {
      if (item.id == cartItemId) {
        return item.copyWith(quantity: newQuantity);
      }
      return item;
    }).toList();

    state = state.copyWith(items: newItems);
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
      customer: PosCustomer.walkIn,
    );
  }
}

final cartProvider =
    StateNotifierProvider<CartNotifier, CartState>((ref) => CartNotifier());
