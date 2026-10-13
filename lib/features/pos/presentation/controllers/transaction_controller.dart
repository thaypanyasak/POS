import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../data/local/pos_database.dart';
import '../../../../data/mock/mock_grocery_data.dart';
import '../../../../data/remote/supabase_sync_service.dart';
import '../../../../domain/models/sale_transaction.dart';
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
  }) async {
    state = state.copyWith(isProcessingCheckout: true);

    try {
      final cartState = _ref.read(cartProvider);
      final now = DateTime.now();
      final dateCode = DateFormat('yyyyMMdd').format(now);
      final seqNumber =
          (state.transactions.length + 1).toString().padLeft(4, '0');
      final receiptNumber = 'RC-$dateCode-$seqNumber';

      final changeAmount = paymentMethod == PaymentMethod.cash
          ? (amountTendered > cartState.grandTotal
              ? amountTendered - cartState.grandTotal
              : 0)
          : 0;

      final transaction = SaleTransaction(
        id: 'tx_${now.millisecondsSinceEpoch}',
        receiptNumber: receiptNumber,
        createdAt: now,
        items: List.from(cartState.items),
        isWholesale: cartState.isWholesaleMode,
        customer: cartState.customer,
        paymentMethod: paymentMethod,
        subtotal: cartState.subtotal,
        discountTotal: cartState.discountTotal,
        grandTotal: cartState.grandTotal,
        amountTendered: amountTendered,
        changeAmount: changeAmount,
        totalCostOfGoods: cartState.totalCostOfGoods,
        grossProfit: cartState.grossProfit,
      );

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

  /// Adds a new customer
  void addCustomer(PosCustomer customer) {
    state = state.copyWith(customers: [...state.customers, customer]);
  }
}

final transactionHistoryProvider = StateNotifierProvider<
    TransactionHistoryNotifier, TransactionHistoryState>((ref) {
  return TransactionHistoryNotifier(ref);
});
