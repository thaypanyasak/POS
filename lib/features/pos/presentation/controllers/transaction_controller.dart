import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../data/local/pos_database.dart';
import '../../../../data/mock/mock_grocery_data.dart';
import '../../../../data/remote/supabase_sync_service.dart';
import '../../../../domain/models/sale_transaction.dart';
import '../../../../providers/exchange_rate_provider.dart';
import 'cart_controller.dart';
import 'catalog_controller.dart';

class TransactionHistoryState {
  final List<SaleTransaction> transactions;
  final List<PosCustomer> customers;
  final bool isProcessingCheckout;

  const TransactionHistoryState({
    this.transactions = const [],
    this.customers = const [],
    this.isProcessingCheckout = false,
  });

  /// Calculate Daily Profit Summary (Today)
  ProfitSummary get dailySummary {
    final now = DateTime.now();
    final todayTxs = transactions.where((tx) {
      return tx.createdAt.year == now.year &&
          tx.createdAt.month == now.month &&
          tx.createdAt.day == now.day;
    }).toList();
    return ProfitSummary.fromTransactions(todayTxs);
  }

  /// Calculate Weekly Profit Summary (Past 7 days)
  ProfitSummary get weeklySummary {
    final now = DateTime.now();
    final sevenDaysAgo = now.subtract(const Duration(days: 7));
    final weeklyTxs = transactions.where((tx) {
      return tx.createdAt.isAfter(sevenDaysAgo);
    }).toList();
    return ProfitSummary.fromTransactions(weeklyTxs);
  }

  /// Calculate Monthly Profit Summary (Current month)
  ProfitSummary get monthlySummary {
    final now = DateTime.now();
    final monthlyTxs = transactions.where((tx) {
      return tx.createdAt.year == now.year &&
          tx.createdAt.month == now.month;
    }).toList();
    return ProfitSummary.fromTransactions(monthlyTxs);
  }

  TransactionHistoryState copyWith({
    List<SaleTransaction>? transactions,
    List<PosCustomer>? customers,
    bool? isProcessingCheckout,
  }) {
    return TransactionHistoryState(
      transactions: transactions ?? this.transactions,
      customers: customers ?? this.customers,
      isProcessingCheckout:
          isProcessingCheckout ?? this.isProcessingCheckout,
    );
  }
}

class TransactionHistoryNotifier
    extends StateNotifier<TransactionHistoryState> {
  final Ref _ref;

  TransactionHistoryNotifier(this._ref)
      : super(
          TransactionHistoryState(
            customers: MockGroceryData.initialCustomers,
          ),
        ) {
    loadTransactions();
  }

  /// Loads cached transactions from local storage and syncs from Supabase
  Future<void> loadTransactions() async {
    // 1. Immediately load cached transactions from local SharedPreferences
    final cached = await PosDatabase.instance.getCachedTransactions();
    if (cached.isNotEmpty) {
      state = state.copyWith(transactions: cached);
    }

    // 2. Fetch from Supabase Cloud if connected
    if (SupabaseSyncService.isConnected) {
      final cloudTxs = await SupabaseSyncService.fetchTransactions();
      if (cloudTxs != null && cloudTxs.isNotEmpty) {
        final existingIds = cloudTxs.map((t) => t.id).toSet();
        final localOnly = cached.where((t) => !existingIds.contains(t.id));
        final merged = [...localOnly, ...cloudTxs];
        merged.sort((a, b) => b.createdAt.compareTo(a.createdAt));

        state = state.copyWith(transactions: merged);

        for (final tx in cloudTxs) {
          await PosDatabase.instance.saveTransaction(tx);
        }
      }
    }
  }

  /// Executes checkout, records transaction, and updates inventory stock
  Future<SaleTransaction> processCheckout({
    required PaymentMethod paymentMethod,
    required int amountTendered,
    int? paidAmount,
    int? debtAmount,
    String? debtStatus,
    String? debtNote,
    String? customerNameOverride,
  }) async {
    state = state.copyWith(isProcessingCheckout: true);

    try {
      final cartState = _ref.read(cartProvider);
      final isEditing = cartState.isEditingOldOrder && cartState.originalTransaction != null;
      final oldTx = isEditing ? cartState.originalTransaction! : null;
      final now = DateTime.now();

      final dateCode = DateFormat('yyyyMMdd').format(now);
      final seqNumber =
          (state.transactions.length + 1).toString().padLeft(4, '0');
      final receiptNumber = oldTx?.receiptNumber ?? 'RC-$dateCode-$seqNumber';
      final txId = oldTx?.id ?? 'tx_${now.millisecondsSinceEpoch}';
      final createdAt = oldTx?.createdAt ?? now;

      final isDebt = paymentMethod == PaymentMethod.debt;
      final effectivePaid = isDebt
          ? (paidAmount ?? 0)
          : (paymentMethod == PaymentMethod.cash ? amountTendered : cartState.grandTotal);
      final effectiveDebtAmount = isDebt
          ? (debtAmount ?? (cartState.grandTotal - effectivePaid))
          : 0;
      final effectiveDebtStatus = isDebt
          ? (debtStatus ?? (effectivePaid <= 0 ? 'unpaid' : (effectiveDebtAmount > 0 ? 'partial' : 'paid')))
          : 'paid';

      final changeAmount = paymentMethod == PaymentMethod.cash
          ? (amountTendered > cartState.grandTotal
              ? amountTendered - cartState.grandTotal
              : 0)
          : 0;

      PosCustomer customer = cartState.customer;
      if (customerNameOverride != null && customerNameOverride.trim().isNotEmpty) {
        customer = customer.copyWith(name: customerNameOverride.trim());
      } else if (isDebt && (customer.name.trim().isEmpty || customer.name == 'ລູກຄ້າທົ່ວໄປ')) {
        customer = customer.copyWith(name: 'ລູກຄ້າຄ້າງຊຳລະ');
      }

      final currentRate = _ref.read(exchangeRateProvider).rate;
      final rateToUse = (isEditing && oldTx != null && oldTx.exchangeRate > 0)
          ? oldTx.exchangeRate
          : currentRate;
      final totalLak = cartState.grandTotal.toDouble();
      final totalThb = rateToUse > 0 ? (totalLak / rateToUse) : 0.0;
      final profitLak = cartState.grossProfit.toDouble();
      final profitThb = rateToUse > 0 ? (profitLak / rateToUse) : 0.0;

      final transaction = SaleTransaction(
        id: txId,
        receiptNumber: receiptNumber,
        createdAt: createdAt,
        items: List.from(cartState.items),
        isWholesale: cartState.isWholesaleMode,
        customer: customer,
        paymentMethod: paymentMethod,
        subtotal: cartState.pureGoodsSubtotal,
        discountTotal: cartState.discountTotal,
        grandTotal: cartState.grandTotal,
        amountTendered: effectivePaid,
        changeAmount: changeAmount,
        totalCostOfGoods: cartState.totalCostOfGoods,
        grossProfit: cartState.grossProfit,
        isDebt: isDebt,
        paidAmount: effectivePaid,
        debtAmount: effectiveDebtAmount,
        debtStatus: effectiveDebtStatus,
        debtNote: debtNote?.trim(),
        exchangeRate: rateToUse,
        totalLakValue: totalLak,
        totalThbValue: totalThb,
        grossProfitLakValue: profitLak,
        grossProfitThbValue: profitThb,
      );

      if (isEditing && oldTx != null) {
        // Sequential Re-checkout pattern:
        // 1. Restore old stock in local catalog, then deduct new items
        _ref.read(catalogProvider.notifier).restoreStockFromTransaction(oldTx);
        _ref.read(catalogProvider.notifier).deductStockFromTransaction(transaction);

        // 2. Save locally
        await PosDatabase.instance.saveTransaction(transaction);

        // 3. Update Supabase
        await SupabaseSyncService.updateExistingSaleTransaction(
          oldTransaction: oldTx,
          newTransaction: transaction,
        );

        // 4. Update in state
        final updatedList = state.transactions
            .map((t) => t.id == txId ? transaction : t)
            .toList();
        state = state.copyWith(
          transactions: updatedList,
          isProcessingCheckout: false,
        );

        // 5. Clear cart
        _ref.read(cartProvider.notifier).clearCart();

        return transaction;
      }

      // Normal Checkout:
      // 1. Deduct stock from local catalog
      _ref
          .read(catalogProvider.notifier)
          .deductStockFromTransaction(transaction);

      // 2. Save locally for zero-latency offline persistence
      await PosDatabase.instance.saveTransaction(transaction);

      // 3. Sync to Supabase cloud in background
      SupabaseSyncService.syncTransaction(transaction);

      // 4. Record transaction in history
      state = state.copyWith(
        transactions: [transaction, ...state.transactions],
        isProcessingCheckout: false,
      );

      // 5. Clear the cart for next customer
      _ref.read(cartProvider.notifier).clearCart();

      return transaction;
    } finally {
      state = state.copyWith(isProcessingCheckout: false);
    }
  }

  /// Cancels / Voids a transaction, marks status as cancelled, and restores stock
  Future<bool> cancelTransaction(SaleTransaction tx, {String? voidReason}) async {
    final now = DateTime.now();
    final updatedTx = tx.copyWith(
      status: 'cancelled',
      isCancelled: true,
      cancelledAt: now,
      voidReason: voidReason,
    );

    // 1. Restore product stock in local catalog and Supabase
    _ref.read(catalogProvider.notifier).restoreStockFromTransaction(tx);

    // 2. Update locally
    await PosDatabase.instance.saveTransaction(updatedTx);

    // 3. Update Supabase
    await SupabaseSyncService.cancelTransaction(
      tx.id,
      tx.paymentMethod.name,
      voidReason: voidReason,
      voidedBy: tx.cashierName,
    );

    // 4. Update state
    final updatedList = state.transactions.map((t) => t.id == tx.id ? updatedTx : t).toList();
    state = state.copyWith(transactions: updatedList);
    return true;
  }

  /// Deletes a transaction permanently and restores stock if it was not cancelled yet
  Future<bool> deleteTransaction(SaleTransaction tx) async {
    // 1. If it was not cancelled yet, restore stock
    if (!tx.isCancelled && tx.status != 'cancelled') {
      _ref.read(catalogProvider.notifier).restoreStockFromTransaction(tx);
    }

    // 2. Delete locally
    await PosDatabase.instance.deleteTransaction(tx.id);

    // 3. Delete in Supabase
    await SupabaseSyncService.deleteTransaction(tx.id);

    // 4. Update state
    final updatedList = state.transactions.where((t) => t.id != tx.id).toList();
    state = state.copyWith(transactions: updatedList);
    return true;
  }

  /// Updates transaction details (customer name, payment method)
  Future<bool> updateTransaction(
    String txId, {
    String? customerName,
    PaymentMethod? paymentMethod,
  }) async {
    final txIndex = state.transactions.indexWhere((t) => t.id == txId);
    if (txIndex < 0) return false;

    final existing = state.transactions[txIndex];
    final updated = existing.copyWith(
      customer: customerName != null ? existing.customer.copyWith(name: customerName) : null,
      paymentMethod: paymentMethod ?? existing.paymentMethod,
    );

    // 1. Save locally
    await PosDatabase.instance.saveTransaction(updated);

    // 2. Push update to Supabase
    final Map<String, dynamic> updates = {};
    if (customerName != null) updates['customer_name'] = customerName;
    if (paymentMethod != null) updates['payment_method'] = paymentMethod.name;
    await SupabaseSyncService.updateTransaction(txId, updates);

    // 3. Update state
    final updatedList = List<SaleTransaction>.from(state.transactions);
    updatedList[txIndex] = updated;
    state = state.copyWith(transactions: updatedList);
    return true;
  }

  /// Adds a new customer
  void addCustomer(PosCustomer customer) {
    state = state.copyWith(customers: [...state.customers, customer]);
  }
}

final transactionHistoryProvider = StateNotifierProvider<
    TransactionHistoryNotifier, TransactionHistoryState>((ref) {
  return TransactionHistoryNotifier(ref);
});
