import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../data/remote/supabase_sync_service.dart';
import '../../../../domain/models/sale_transaction.dart';

/// Hourly Comparison Item (07:00 – 22:00)
class HourlyComparisonData {
  final int hour;
  final String label; // "07:00"
  final int revenueA;
  final int revenueB;
  final int txCountA;
  final int txCountB;

  const HourlyComparisonData({
    required this.hour,
    required this.label,
    required this.revenueA,
    required this.revenueB,
    this.txCountA = 0,
    this.txCountB = 0,
  });
}

/// Category Comparison Item
class CategoryComparisonData {
  final String name;
  final int revA;
  final int revB;
  final double pctA;
  final double pctB;
  final double growth;
  final Color color;

  const CategoryComparisonData({
    required this.name,
    required this.revA,
    required this.revB,
    required this.pctA,
    required this.pctB,
    required this.growth,
    required this.color,
  });
}

/// Top 5 Best Sellers Comparison Item
class TopSellerComparisonData {
  final String id;
  final String name;
  final String unitName;
  final int qtyA;
  final int revA;
  final int qtyB;
  final int revB;
  final double growth;

  const TopSellerComparisonData({
    required this.id,
    required this.name,
    required this.unitName,
    required this.qtyA,
    required this.revA,
    required this.qtyB,
    required this.revB,
    required this.growth,
  });
}

class MonthComparisonState {
  final DateTime monthA;
  final DateTime monthB;
  final bool isLoading;
  final List<SaleTransaction> txsA;
  final List<SaleTransaction> txsB;

  // Calculated Core KPI metrics
  final int revenueA;
  final int revenueB;
  final double revenueGrowth;

  final int profitA;
  final int profitB;
  final double profitGrowth;

  final int countA;
  final int countB;
  final double countGrowth;

  final double marginA;
  final double marginB;

  // 1.1 Payment Breakdown Comparison
  final int cashA;
  final int cashB;
  final double cashGrowth;

  final int transferA;
  final int transferB;
  final double transferGrowth;

  final int debtA;
  final int debtB;
  final double debtGrowth;

  // 1.2 Hourly Dual Trend (07:00 – 22:00)
  final List<HourlyComparisonData> hourlyList;
  final int maxHourlyRev;

  // 1.3 Sales by Category Comparison
  final List<CategoryComparisonData> categoryList;
  final int totalCatRevA;
  final int totalCatRevB;

  // 1.4 Top 5 Best Sellers Comparison
  final List<TopSellerComparisonData> topSellers;

  const MonthComparisonState({
    required this.monthA,
    required this.monthB,
    this.isLoading = false,
    this.txsA = const [],
    this.txsB = const [],
    this.revenueA = 0,
    this.revenueB = 0,
    this.revenueGrowth = 0.0,
    this.profitA = 0,
    this.profitB = 0,
    this.profitGrowth = 0.0,
    this.countA = 0,
    this.countB = 0,
    this.countGrowth = 0.0,
    this.marginA = 0.0,
    this.marginB = 0.0,
    this.cashA = 0,
    this.cashB = 0,
    this.cashGrowth = 0.0,
    this.transferA = 0,
    this.transferB = 0,
    this.transferGrowth = 0.0,
    this.debtA = 0,
    this.debtB = 0,
    this.debtGrowth = 0.0,
    this.hourlyList = const [],
    this.maxHourlyRev = 10000,
    this.categoryList = const [],
    this.totalCatRevA = 0,
    this.totalCatRevB = 0,
    this.topSellers = const [],
  });

  MonthComparisonState copyWith({
    DateTime? monthA,
    DateTime? monthB,
    bool? isLoading,
    List<SaleTransaction>? txsA,
    List<SaleTransaction>? txsB,
    int? revenueA,
    int? revenueB,
    double? revenueGrowth,
    int? profitA,
    int? profitB,
    double? profitGrowth,
    int? countA,
    int? countB,
    double? countGrowth,
    double? marginA,
    double? marginB,
    int? cashA,
    int? cashB,
    double? cashGrowth,
    int? transferA,
    int? transferB,
    double? transferGrowth,
    int? debtA,
    int? debtB,
    double? debtGrowth,
    List<HourlyComparisonData>? hourlyList,
    int? maxHourlyRev,
    List<CategoryComparisonData>? categoryList,
    int? totalCatRevA,
    int? totalCatRevB,
    List<TopSellerComparisonData>? topSellers,
  }) {
    return MonthComparisonState(
      monthA: monthA ?? this.monthA,
      monthB: monthB ?? this.monthB,
      isLoading: isLoading ?? this.isLoading,
      txsA: txsA ?? this.txsA,
      txsB: txsB ?? this.txsB,
      revenueA: revenueA ?? this.revenueA,
      revenueB: revenueB ?? this.revenueB,
      revenueGrowth: revenueGrowth ?? this.revenueGrowth,
      profitA: profitA ?? this.profitA,
      profitB: profitB ?? this.profitB,
      profitGrowth: profitGrowth ?? this.profitGrowth,
      countA: countA ?? this.countA,
      countB: countB ?? this.countB,
      countGrowth: countGrowth ?? this.countGrowth,
      marginA: marginA ?? this.marginA,
      marginB: marginB ?? this.marginB,
      cashA: cashA ?? this.cashA,
      cashB: cashB ?? this.cashB,
      cashGrowth: cashGrowth ?? this.cashGrowth,
      transferA: transferA ?? this.transferA,
      transferB: transferB ?? this.transferB,
      transferGrowth: transferGrowth ?? this.transferGrowth,
      debtA: debtA ?? this.debtA,
      debtB: debtB ?? this.debtB,
      debtGrowth: debtGrowth ?? this.debtGrowth,
      hourlyList: hourlyList ?? this.hourlyList,
      maxHourlyRev: maxHourlyRev ?? this.maxHourlyRev,
      categoryList: categoryList ?? this.categoryList,
      totalCatRevA: totalCatRevA ?? this.totalCatRevA,
      totalCatRevB: totalCatRevB ?? this.totalCatRevB,
      topSellers: topSellers ?? this.topSellers,
    );
  }
}

class MonthComparisonNotifier extends StateNotifier<MonthComparisonState> {
  MonthComparisonNotifier()
      : super(
          MonthComparisonState(
            monthA: DateTime(DateTime.now().year, DateTime.now().month - 1, 1),
            monthB: DateTime(DateTime.now().year, DateTime.now().month, 1),
          ),
        ) {
    loadComparison();
  }

  void setMonthA(DateTime date) {
    state = state.copyWith(monthA: date);
    loadComparison();
  }

  void setMonthB(DateTime date) {
    state = state.copyWith(monthB: date);
    loadComparison();
  }

  void applyPresetYoY() {
    final now = DateTime.now();
    state = state.copyWith(
      monthA: DateTime(now.year - 1, now.month, 1),
      monthB: DateTime(now.year, now.month, 1),
    );
    loadComparison();
  }

  void applyPresetMoM() {
    final now = DateTime.now();
    state = state.copyWith(
      monthA: DateTime(now.year, now.month - 1, 1),
      monthB: DateTime(now.year, now.month, 1),
    );
    loadComparison();
  }

  Future<void> loadComparison() async {
    state = state.copyWith(isLoading: true);

    try {
      // 1. Strict Query: ONLY Month A and Month B, NEVER intermediate months
      final result = await SupabaseSyncService.fetchDualMonthTransactions(
        monthA: state.monthA,
        monthB: state.monthB,
      );

      final listA = result['txsA'] ?? <SaleTransaction>[];
      final listB = result['txsB'] ?? <SaleTransaction>[];

      // 2. Perform metrics calculations
      final calculated = _calculateAllMetrics(listA, listB);

      state = state.copyWith(
        isLoading: false,
        txsA: listA,
        txsB: listB,
        revenueA: calculated.revenueA,
        revenueB: calculated.revenueB,
        revenueGrowth: calculated.revenueGrowth,
        profitA: calculated.profitA,
        profitB: calculated.profitB,
        profitGrowth: calculated.profitGrowth,
        countA: calculated.countA,
        countB: calculated.countB,
        countGrowth: calculated.countGrowth,
        marginA: calculated.marginA,
        marginB: calculated.marginB,
        cashA: calculated.cashA,
        cashB: calculated.cashB,
        cashGrowth: calculated.cashGrowth,
        transferA: calculated.transferA,
        transferB: calculated.transferB,
        transferGrowth: calculated.transferGrowth,
        debtA: calculated.debtA,
        debtB: calculated.debtB,
        debtGrowth: calculated.debtGrowth,
        hourlyList: calculated.hourlyList,
        maxHourlyRev: calculated.maxHourlyRev,
        categoryList: calculated.categoryList,
        totalCatRevA: calculated.totalCatRevA,
        totalCatRevB: calculated.totalCatRevB,
        topSellers: calculated.topSellers,
      );
    } catch (_) {
      state = state.copyWith(isLoading: false);
    }
  }

  static MonthComparisonState _calculateAllMetrics(
    List<SaleTransaction> listA,
    List<SaleTransaction> listB,
  ) {
    // Helper to calculate totals
    Map<String, dynamic> calcTotals(List<SaleTransaction> txs) {
      int rev = 0;
      int cost = 0;
      int prof = 0;
      int cash = 0;
      int tr = 0;
      int debt = 0;

      for (final t in txs) {
        if (t.isCancelled || t.status == 'cancelled') continue;
        rev += t.grandTotal;
        cost += t.totalCostOfGoods;
        prof += t.grossProfit;

        if (t.isDebt || t.paymentMethod == PaymentMethod.debt) {
          debt += (t.debtAmount > 0 ? t.debtAmount : t.grandTotal);
        } else if (t.paymentMethod == PaymentMethod.cash) {
          cash += t.grandTotal;
        } else {
          tr += t.grandTotal;
        }
      }

      final margin = rev > 0 ? (prof / rev) * 100 : 0.0;
      return {
        'rev': rev,
        'cost': cost,
        'prof': prof,
        'cash': cash,
        'tr': tr,
        'debt': debt,
        'count': txs.where((t) => !t.isCancelled && t.status != 'cancelled').length,
        'margin': margin,
      };
    }

    final a = calcTotals(listA);
    final b = calcTotals(listB);

    double growth(num valA, num valB) {
      if (valA == 0) return valB > 0 ? 100.0 : 0.0;
      return ((valB - valA) / valA.abs()) * 100.0;
    }

    // 1.2 Hourly Trend Calculation (07:00 – 22:00)
    final hourlyMapA = <int, int>{for (int h = 7; h <= 22; h++) h: 0};
    final hourlyCountA = <int, int>{for (int h = 7; h <= 22; h++) h: 0};
    final hourlyMapB = <int, int>{for (int h = 7; h <= 22; h++) h: 0};
    final hourlyCountB = <int, int>{for (int h = 7; h <= 22; h++) h: 0};

    for (final t in listA) {
      if (t.isCancelled || t.status == 'cancelled') continue;
      final h = t.createdAt.hour;
      if (h >= 7 && h <= 22) {
        hourlyMapA[h] = (hourlyMapA[h] ?? 0) + t.grandTotal;
        hourlyCountA[h] = (hourlyCountA[h] ?? 0) + 1;
      }
    }

    for (final t in listB) {
      if (t.isCancelled || t.status == 'cancelled') continue;
      final h = t.createdAt.hour;
      if (h >= 7 && h <= 22) {
        hourlyMapB[h] = (hourlyMapB[h] ?? 0) + t.grandTotal;
        hourlyCountB[h] = (hourlyCountB[h] ?? 0) + 1;
      }
    }

    int maxHourRev = 10000;
    final hourlyList = <HourlyComparisonData>[];
    for (int h = 7; h <= 22; h++) {
      final revA = hourlyMapA[h] ?? 0;
      final revB = hourlyMapB[h] ?? 0;
      if (revA > maxHourRev) maxHourRev = revA;
      if (revB > maxHourRev) maxHourRev = revB;
      hourlyList.add(HourlyComparisonData(
        hour: h,
        label: '${h.toString().padLeft(2, '0')}:00',
        revenueA: revA,
        revenueB: revB,
        txCountA: hourlyCountA[h] ?? 0,
        txCountB: hourlyCountB[h] ?? 0,
      ));
    }

    // 1.3 Category Breakdown Calculation
    final catMapA = <String, int>{};
    final catMapB = <String, int>{};
    int totalCatRevA = 0;
    int totalCatRevB = 0;

    void processCategories(List<SaleTransaction> txs, Map<String, int> catMap, void Function(int) addTotal) {
      for (final t in txs) {
        if (t.isCancelled || t.status == 'cancelled') continue;
        for (final item in t.items) {
          String cat = item.product.category.trim();
          if (cat.isEmpty || cat == 'ທົ່ວໄປ') {
            if (item.product.name.contains('ເບຍ')) {
              cat = 'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ';
            } else {
              cat = 'ທົ່ວໄປ';
            }
          }
          final lineTot = item.lineTotal;
          catMap[cat] = (catMap[cat] ?? 0) + lineTot;
          addTotal(lineTot);
        }
      }
    }

    processCategories(listA, catMapA, (tot) => totalCatRevA += tot);
    processCategories(listB, catMapB, (tot) => totalCatRevB += tot);

    const colorTokens = [
      Color(0xFF0F766E), // Teal
      Color(0xFF10B981), // Emerald
      Color(0xFFF59E0B), // Amber
      Color(0xFF6366F1), // Indigo
      Color(0xFFEC4899), // Pink
      Color(0xFF3B82F6), // Blue
      Color(0xFF8B5CF6), // Purple
      Color(0xFF64748B), // Slate
    ];

    final allCatNames = {...catMapA.keys, ...catMapB.keys}.toList();
    final categoryList = allCatNames.asMap().entries.map((entry) {
      final idx = entry.key;
      final name = entry.value;
      final revA = catMapA[name] ?? 0;
      final revB = catMapB[name] ?? 0;
      final pctA = totalCatRevA > 0 ? (revA / totalCatRevA) * 100 : 0.0;
      final pctB = totalCatRevB > 0 ? (revB / totalCatRevB) * 100 : 0.0;
      final catGrowth = growth(revA, revB);

      return CategoryComparisonData(
        name: name,
        revA: revA,
        revB: revB,
        pctA: pctA,
        pctB: pctB,
        growth: catGrowth,
        color: colorTokens[idx % colorTokens.length],
      );
    }).toList()
      ..sort((a, b) => b.revB.compareTo(a.revB));

    // 1.4 Top 5 Best Sellers Calculation
    final prodMapA = <String, Map<String, dynamic>>{};
    final prodMapB = <String, Map<String, dynamic>>{};

    void processProducts(List<SaleTransaction> txs, Map<String, Map<String, dynamic>> prodMap) {
      for (final t in txs) {
        if (t.isCancelled || t.status == 'cancelled') continue;
        for (final item in t.items) {
          final pId = item.product.id;
          final pName = item.product.name;
          final unitName = item.selectedUnit.unitName;
          final qty = item.quantity;
          final lineTot = item.lineTotal;

          if (!prodMap.containsKey(pId)) {
            prodMap[pId] = {
              'id': pId,
              'name': pName,
              'unitName': unitName,
              'qty': 0,
              'rev': 0,
            };
          }
          prodMap[pId]!['qty'] = (prodMap[pId]!['qty'] as int) + qty;
          prodMap[pId]!['rev'] = (prodMap[pId]!['rev'] as int) + lineTot;
        }
      }
    }

    processProducts(listA, prodMapA);
    processProducts(listB, prodMapB);

    final allProdIds = {...prodMapA.keys, ...prodMapB.keys}.toList();
    final topSellers = allProdIds.map((id) {
      final aItem = prodMapA[id];
      final bItem = prodMapB[id];
      final name = bItem?['name']?.toString() ?? aItem?['name']?.toString() ?? 'ສິນຄ້າ';
      final unitName = bItem?['unitName']?.toString() ?? aItem?['unitName']?.toString() ?? 'ອັນ';
      final qtyA = (aItem?['qty'] as int?) ?? 0;
      final revA = (aItem?['rev'] as int?) ?? 0;
      final qtyB = (bItem?['qty'] as int?) ?? 0;
      final revB = (bItem?['rev'] as int?) ?? 0;
      final prodGrowth = growth(revA, revB);

      return TopSellerComparisonData(
        id: id,
        name: name,
        unitName: unitName,
        qtyA: qtyA,
        revA: revA,
        qtyB: qtyB,
        revB: revB,
        growth: prodGrowth,
      );
    }).toList()
      ..sort((a, b) => b.revB.compareTo(a.revB));

    final top5 = topSellers.take(5).toList();

    return MonthComparisonState(
      monthA: DateTime.now(),
      monthB: DateTime.now(),
      revenueA: a['rev'] as int,
      revenueB: b['rev'] as int,
      revenueGrowth: growth(a['rev'] as int, b['rev'] as int),
      profitA: a['prof'] as int,
      profitB: b['prof'] as int,
      profitGrowth: growth(a['prof'] as int, b['prof'] as int),
      countA: a['count'] as int,
      countB: b['count'] as int,
      countGrowth: growth(a['count'] as int, b['count'] as int),
      marginA: a['margin'] as double,
      marginB: b['margin'] as double,
      cashA: a['cash'] as int,
      cashB: b['cash'] as int,
      cashGrowth: growth(a['cash'] as int, b['cash'] as int),
      transferA: a['tr'] as int,
      transferB: b['tr'] as int,
      transferGrowth: growth(a['tr'] as int, b['tr'] as int),
      debtA: a['debt'] as int,
      debtB: b['debt'] as int,
      debtGrowth: growth(a['debt'] as int, b['debt'] as int),
      hourlyList: hourlyList,
      maxHourlyRev: maxHourRev,
      categoryList: categoryList,
      totalCatRevA: totalCatRevA,
      totalCatRevB: totalCatRevB,
      topSellers: top5,
    );
  }
}

final monthComparisonProvider =
    StateNotifierProvider<MonthComparisonNotifier, MonthComparisonState>((ref) {
  return MonthComparisonNotifier();
});
