import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/localization/lao_currency_formatter.dart';
import '../../../core/utils/image_compress_service.dart';
import '../../../domain/models/product.dart';
import '../../../domain/models/sale_transaction.dart';
import '../../pos/presentation/controllers/catalog_controller.dart';
import '../../pos/presentation/controllers/transaction_controller.dart';
import '../../common/widgets/exchange_rate_chip.dart';
import 'widgets/annual_12_month_sales_chart.dart';
import 'widgets/month_comparison_dashboard_view.dart';

enum DashboardTimeframe { daily, weekly, monthly, all, custom, compare }

/// Financial & Profit Dashboard (ແຜງຄວບຄຸມລາຍຮັບ & ຕົ້ນທຶນ)
/// Rebuilt to 100% match web-app (DashboardView.jsx & SPEC_FINANCIAL_DASHBOARD.md)
/// 1. Top 4 Core Financial KPI Cards (Revenue, COGS, Gross Profit with Margin %, Avg Basket)
/// 2. Payment Reconciliation Breakdown (Cash, Transfer/OnePay QR, Debt/Credit)
/// 3. Hourly Sales Trend Chart (07:00 - 22:00) with peaks & tooltips
/// 4. Sales by Category Breakdown (Progress Bar & Cards)
/// 5. Top 5 Best Selling Products (Ranked, Images, Sales volume, Revenue, Profit)
/// 6. Low Stock Alert Widget (<= 15 base units)
/// 7. Recent Credit Customers (Unsettled debt list)
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  DashboardTimeframe _selectedTimeframe = DashboardTimeframe.daily;
  DateTime? _customStartDate;
  DateTime? _customEndDate;

  List<SaleTransaction> _filterTransactions(List<SaleTransaction> allTxs) {
    final now = DateTime.now();
    return allTxs.where((tx) {
      if (tx.isCancelled || tx.status == 'cancelled') return false;
      switch (_selectedTimeframe) {
        case DashboardTimeframe.daily:
          return tx.createdAt.year == now.year &&
              tx.createdAt.month == now.month &&
              tx.createdAt.day == now.day;
        case DashboardTimeframe.weekly:
          final sevenDaysAgo = now.subtract(const Duration(days: 7));
          return tx.createdAt.isAfter(sevenDaysAgo);
        case DashboardTimeframe.monthly:
          return tx.createdAt.year == now.year &&
              tx.createdAt.month == now.month;
        case DashboardTimeframe.all:
          return true;
        case DashboardTimeframe.custom:
          if (_customStartDate != null) {
            final s = DateTime(_customStartDate!.year, _customStartDate!.month,
                _customStartDate!.day, 0, 0, 0);
            if (tx.createdAt.isBefore(s)) return false;
          }
          if (_customEndDate != null) {
            final e = DateTime(_customEndDate!.year, _customEndDate!.month,
                _customEndDate!.day, 23, 59, 59);
            if (tx.createdAt.isAfter(e)) return false;
          }
          return true;
        case DashboardTimeframe.compare:
          return false;
      }
    }).toList();
  }

  Future<void> _pickCustomDateRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2023),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      initialDateRange: _customStartDate != null && _customEndDate != null
          ? DateTimeRange(start: _customStartDate!, end: _customEndDate!)
          : DateTimeRange(
              start: DateTime.now().subtract(const Duration(days: 7)),
              end: DateTime.now(),
            ),
      builder: (context, child) {
        return Theme(
          data: ThemeData.light().copyWith(
            primaryColor: const Color(0xFF0F766E),
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF0F766E),
              onPrimary: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedTimeframe = DashboardTimeframe.custom;
        _customStartDate = picked.start;
        _customEndDate = picked.end;
      });
    }
  }


  @override
  Widget build(BuildContext context) {
    final historyState = ref.watch(transactionHistoryProvider);
    final catalogState = ref.watch(catalogProvider);
    final products = catalogState.allProducts;
    final txs = _filterTransactions(historyState.transactions);

    // 1. Core KPIs Aggregations (Point-in-Time Snapshot)
    double totalRevenueLak = 0.0;
    double totalRevenueThb = 0.0;
    double totalCostLak = 0.0;
    double totalCostThb = 0.0;
    double totalProfitLak = 0.0;
    double totalProfitThb = 0.0;
    int cashTotal = 0;
    int transferTotal = 0;
    int debtTotal = 0;
    int debtCount = 0;

    for (final tx in txs) {
      final double rLak = tx.totalLak;
      final double rThb = tx.totalThb;
      final double cLak = tx.totalCostOfGoods.toDouble();
      final double cThb = tx.exchangeRate > 0 ? (cLak / tx.exchangeRate) : 0.0;
      final double pLak = tx.grossProfitLak;
      final double pThb = tx.grossProfitThb;

      totalRevenueLak += rLak;
      totalRevenueThb += rThb;
      totalCostLak += cLak;
      totalCostThb += cThb;
      totalProfitLak += pLak;
      totalProfitThb += pThb;

      if (tx.isDebt || tx.paymentMethod == PaymentMethod.debt) {
        debtTotal += (tx.debtAmount > 0 ? tx.debtAmount : tx.grandTotal);
        debtCount++;
      } else if (tx.paymentMethod == PaymentMethod.cash) {
        cashTotal += tx.grandTotal;
      } else {
        transferTotal += tx.grandTotal;
      }
    }

    final double margin = totalRevenueLak > 0 ? (totalProfitLak / totalRevenueLak) * 100 : 0.0;
    final int avgTicketLak = txs.isNotEmpty ? (totalRevenueLak / txs.length).round() : 0;
    final double avgTicketThb = txs.isNotEmpty ? (totalRevenueThb / txs.length) : 0.0;

    // 2. Hourly Sales Breakdown (07:00 - 22:00)
    final List<_HourlyBucket> hourlyBuckets = [];
    for (int h = 7; h <= 22; h++) {
      hourlyBuckets.add(_HourlyBucket(
        hour: h,
        label: '${h.toString().padLeft(2, '0')}:00',
        revenue: 0,
        txCount: 0,
      ));
    }

    for (final tx in txs) {
      final h = tx.createdAt.hour;
      final bucket = hourlyBuckets.firstWhere(
        (b) => b.hour == h,
        orElse: () => _HourlyBucket(hour: -1, label: '', revenue: 0, txCount: 0),
      );
      if (bucket.hour != -1) {
        bucket.revenue += tx.grandTotal;
        bucket.txCount += 1;
      }
    }

    int maxHourlyRev = 1;
    for (final b in hourlyBuckets) {
      if (b.revenue > maxHourlyRev) maxHourlyRev = b.revenue;
    }

    // 3. Category Breakdown (Matches Web logic 100%)
    final Map<String, _CategoryAccumulator> catMap = {};
    int totalCatRev = 0;

    for (final tx in txs) {
      for (final item in tx.items) {
        // Look up product in catalog by product.id
        final catalogProd = products.firstWhere(
          (p) => p.id == item.product.id,
          orElse: () => item.product,
        );

        // Web logic: prod?.category || it.product?.category || (it.productName?.includes('ເບຍ') ? 'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ' : 'ທົ່ວໄປ')
        String cat = catalogProd.category.trim();
        if (cat.isEmpty || cat == 'ທົ່ວໄປ') {
          final itemCat = item.product.category.trim();
          if (itemCat.isNotEmpty && itemCat != 'ທົ່ວໄປ') {
            cat = itemCat;
          } else if (catalogProd.name.contains('ເບຍ') || item.product.name.contains('ເບຍ')) {
            cat = 'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ';
          } else {
            cat = 'ທົ່ວໄປ';
          }
        }

        final lineTot = item.lineTotal;
        catMap.putIfAbsent(cat, () => _CategoryAccumulator(name: cat));
        catMap[cat]!.revenue += lineTot;
        catMap[cat]!.quantity += item.quantity;
        totalCatRev += lineTot;
      }
    }

    final catList = catMap.values.toList()..sort((a, b) => b.revenue.compareTo(a.revenue));

    // 4. Top 5 Best Selling Products
    final Map<String, _TopProductAccumulator> prodMap = {};
    for (final tx in txs) {
      for (final item in tx.items) {
        final pId = item.product.id;
        final catalogProd = products.firstWhere(
          (p) => p.id == pId,
          orElse: () => item.product,
        );
        final resolvedImg = catalogProd.imageUrl ?? item.product.imageUrl;

        prodMap.putIfAbsent(
          pId,
          () => _TopProductAccumulator(
            id: pId,
            name: catalogProd.name.isNotEmpty ? catalogProd.name : item.product.name,
            imageUrl: resolvedImg,
            product: catalogProd,
          ),
        );
        prodMap[pId]!.totalBaseUnits += item.totalBaseUnitsDeducted;
        prodMap[pId]!.revenue += item.lineTotal;
        prodMap[pId]!.profit += item.lineProfit;
        prodMap[pId]!.ordersCount += 1;
      }
    }

    final top5Products = prodMap.values.toList()
      ..sort((a, b) => b.revenue.compareTo(a.revenue));
    final top5 = top5Products.take(5).toList();

    // 5. Low Stock Alert Products (currentStockBaseUnits <= 15 and trackStock == true)
    final lowStockProducts = products.where((p) {
      if (!p.trackStock) return false;
      return p.currentStockBaseUnits <= 15;
    }).toList()
      ..sort((a, b) => a.currentStockBaseUnits.compareTo(b.currentStockBaseUnits));
    final lowStockList = lowStockProducts.take(4).toList();

    // 6. Recent Credit Customers
    final creditTxs = historyState.transactions
        .where((t) => t.isDebt || t.paymentMethod == PaymentMethod.debt || t.debtAmount > 0)
        .take(4)
        .toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC), // slate-50/60
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          physics: const BouncingScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Dashboard Header & Timeframe Chips
              _buildHeaderAndTimeframe(),

              const SizedBox(height: 14),

              if (_selectedTimeframe == DashboardTimeframe.custom) ...[
                _buildCustomDateFilterBanner(txs.length),
                const SizedBox(height: 14),
              ],

              if (_selectedTimeframe == DashboardTimeframe.compare) ...[
                const MonthComparisonDashboardView(),
              ] else ...[
                // 2. Top 4 Core KPI Cards (grid 4 on desktop, 2 on tablet/mobile)
                LayoutBuilder(
                  builder: (context, constraints) {
                    final isWide = constraints.maxWidth >= 780;
                    final cardWidth = isWide
                        ? (constraints.maxWidth - (3 * 10)) / 4
                        : (constraints.maxWidth - 10) / 2;

                    return Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        // KPI 1: Revenue
                        _buildKpiCard(
                          title: 'ຍອດຂາຍລວມ (Revenue)',
                          value: LaoCurrencyFormatter.format(totalRevenueLak.round()),
                          subValueThb: '≈ ${NumberFormat('#,##0').format(totalRevenueThb.round())} ฿',
                          subLeft: 'ຈຳນວນ:',
                          subRight: '${txs.length} ບິນສຳເລັດ',
                          icon: Icons.monetization_on_outlined,
                          iconColor: const Color(0xFF0F766E),
                          iconBg: const Color(0xFFF0FDFA),
                          valueColor: const Color(0xFF0F766E),
                          width: cardWidth,
                        ),

                        // KPI 2: COGS
                        _buildKpiCard(
                          title: 'ຕົ້ນທຶນສິນຄ້າລວມ (COGS)',
                          value: LaoCurrencyFormatter.format(totalCostLak.round()),
                          subValueThb: '≈ ${NumberFormat('#,##0').format(totalCostThb.round())} ฿',
                          subLeft: 'ຕົ້ນທຶນສິນຄ້າຂາຍອອກ',
                          subRight: 'ທຶນຈິງ',
                          icon: Icons.calendar_today_outlined,
                          iconColor: const Color(0xFFD97706),
                          iconBg: const Color(0xFFFFFBEB),
                          valueColor: const Color(0xFF1E293B),
                          width: cardWidth,
                        ),

                        // KPI 3: Gross Profit
                        _buildKpiCard(
                          title: 'ກຳໄລຂັ້ນຕົ້ນ (Gross Profit)',
                          value: LaoCurrencyFormatter.format(totalProfitLak.round()),
                          subValueThb: '≈ ${NumberFormat('#,##0').format(totalProfitThb.round())} ฿',
                          subLeft: 'ອັດຕາກຳໄລ:',
                          subRight: '${margin.toStringAsFixed(1)}%',
                          isMarginBadge: true,
                          icon: Icons.credit_card_outlined,
                          iconColor: const Color(0xFF059669),
                          iconBg: const Color(0xFFECFDF5),
                          valueColor: const Color(0xFF059669),
                          width: cardWidth,
                        ),

                        // KPI 4: Avg Basket
                        _buildKpiCard(
                          title: 'ຍອດສະເລ່ຍຕໍ່ບິນ (Avg Basket)',
                          value: LaoCurrencyFormatter.format(avgTicketLak),
                          subValueThb: '≈ ${NumberFormat('#,##0').format(avgTicketThb.round())} ฿',
                          subLeft: 'ສະເລ່ຍຕໍ່ 1 ລູກຄ້າ',
                          subRight: 'ບິນ/ລູກຄ້າ',
                          icon: Icons.bar_chart_rounded,
                          iconColor: const Color(0xFF7C3AED),
                          iconBg: const Color(0xFFF5F3FF),
                          valueColor: const Color(0xFF0F172A),
                          width: cardWidth,
                        ),
                      ],
                    );
                  },
                ),

                const SizedBox(height: 16),

                // 3. Payment Reconciled Breakdown Section
                _buildPaymentBreakdownSection(totalRevenueLak.round(), cashTotal, transferTotal, debtTotal, debtCount),

                const SizedBox(height: 16),

                // 4. Two-Column Analytics Layout (Left 65% : Right 35%)
                LayoutBuilder(
                  builder: (context, constraints) {
                    final isWide = constraints.maxWidth >= 900;
                    if (isWide) {
                      final leftWidth = (constraints.maxWidth - 16) * 0.63;
                      final rightWidth = (constraints.maxWidth - 16) * 0.37;
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: leftWidth,
                            child: Column(
                              children: [
                                _buildHourlyTrendWidget(hourlyBuckets, maxHourlyRev, txs.length),
                                const SizedBox(height: 14),
                                const Annual12MonthSalesChart(),
                                const SizedBox(height: 14),
                                _buildCategoryBreakdownWidget(catList, totalCatRev),
                              ],
                            ),
                          ),
                          const SizedBox(width: 16),
                          SizedBox(
                            width: rightWidth,
                            child: Column(
                              children: [
                                _buildTop5ProductsWidget(top5),
                                const SizedBox(height: 14),
                                _buildLowStockAlertWidget(lowStockList),
                                if (creditTxs.isNotEmpty) ...[
                                  const SizedBox(height: 14),
                                  _buildRecentCreditWidget(creditTxs),
                                ],
                              ],
                            ),
                          ),
                        ],
                      );
                    }

                    // Stack vertically on tablets / mobile phones
                    return Column(
                      children: [
                        _buildHourlyTrendWidget(hourlyBuckets, maxHourlyRev, txs.length),
                        const SizedBox(height: 14),
                        const Annual12MonthSalesChart(),
                        const SizedBox(height: 14),
                        _buildCategoryBreakdownWidget(catList, totalCatRev),
                        const SizedBox(height: 14),
                        _buildTop5ProductsWidget(top5),
                        const SizedBox(height: 14),
                        _buildLowStockAlertWidget(lowStockList),
                        if (creditTxs.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          _buildRecentCreditWidget(creditTxs),
                        ],
                      ],
                    );
                  },
                ),
              ],
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  // --- Header with Timeframe Segmented Chips ---
  Widget _buildHeaderAndTimeframe() {
    return Container(
      padding: const EdgeInsets.only(bottom: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0), width: 0.8)),
      ),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 12,
        runSpacing: 10,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFF0F766E), // teal-700
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.bar_chart_rounded, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 9),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'ແຜງຄວບຄຸມລາຍຮັບ & ຕົ້ນທຶນ (Financial Dashboard)',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F172A),
                      letterSpacing: -0.2,
                    ),
                  ),
                  SizedBox(height: 1),
                  Text(
                    'ສະຫຼຸບລາຍຮັບ, ຕົ້ນທຶນສິນຄ້າ, ຍອດເງິນສົດ/ໂອນ/ຕິດໜີ້ ແລະ ວິເຄາະທຸລະກິດ Real-time (ກີບ ₭)',
                    style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ],
          ),

          // Exchange Rate Badge & Timeframe Segmented Switcher
          Wrap(
            alignment: WrapAlignment.end,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 6,
            children: [
              const ExchangeRateChip(),
              Container(
                padding: const EdgeInsets.all(2.5),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildTimeframePill(DashboardTimeframe.daily, 'ມື້ນີ້ (Today)'),
                      _buildTimeframePill(DashboardTimeframe.weekly, '7 ມື້ຜ່ານມາ'),
                      _buildTimeframePill(DashboardTimeframe.monthly, 'ເດືອນນີ້'),
                      _buildTimeframePill(DashboardTimeframe.all, 'ທັງໝົດ'),
                      _buildTimeframePill(DashboardTimeframe.custom, 'ເລືອກວັນທີ'),
                      _buildTimeframePill(DashboardTimeframe.compare, 'ສົມທຽບ 2 ເດືອນ'),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTimeframePill(DashboardTimeframe timeframe, String label) {
    final isSelected = _selectedTimeframe == timeframe;
    return InkWell(
      onTap: () {
        setState(() {
          _selectedTimeframe = timeframe;
        });
        if (timeframe == DashboardTimeframe.custom &&
            (_customStartDate == null || _customEndDate == null)) {
          _pickCustomDateRange();
        }
      },
      borderRadius: BorderRadius.circular(7),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF0F766E) : Colors.transparent,
          borderRadius: BorderRadius.circular(7),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }

  // --- KPI Card Widget ---
  Widget _buildKpiCard({
    required String title,
    required String value,
    String? subValueThb,
    required String subLeft,
    required String subRight,
    required IconData icon,
    required Color iconColor,
    required Color iconBg,
    required Color valueColor,
    required double width,
    bool isMarginBadge = false,
  }) {
    return Container(
      width: width,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 3,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
              ),
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Icon(icon, size: 16, color: iconColor),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w900,
              color: valueColor,
              letterSpacing: -0.3,
            ),
          ),
          if (subValueThb != null && subValueThb.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              subValueThb,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: valueColor.withValues(alpha: 0.75),
                fontFamily: 'monospace',
              ),
            ),
          ],
          const SizedBox(height: 7),
          Container(
            padding: const EdgeInsets.only(top: 6),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  subLeft,
                  style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                ),
                if (isMarginBadge)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: const Color(0xFFA7F3D0)),
                    ),
                    child: Text(
                      subRight,
                      style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF047857)),
                    ),
                  )
                else
                  Text(
                    subRight,
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- Payment Breakdown Section (Cash, Transfer, Debt) ---
  Widget _buildPaymentBreakdownSection(int totalRev, int cash, int transfer, int debt, int debtCount) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.receipt_long_outlined, size: 16, color: Color(0xFF0F766E)),
                  SizedBox(width: 6),
                  Text(
                    'ຊ່ອງທາງການຊຳລະເງິນ (Payment Breakdown)',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDFA),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFF99F6E4)),
                ),
                child: Text(
                  'ກວດສອບຍອດ: ${LaoCurrencyFormatter.format(totalRev)} (100% ຄົບຖ້ວນ)',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF0F766E)),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          LayoutBuilder(
            builder: (context, constraints) {
              final isWide = constraints.maxWidth >= 700;
              final width = isWide ? (constraints.maxWidth - 20) / 3 : constraints.maxWidth;

              return Wrap(
                spacing: 10,
                runSpacing: 8,
                children: [
                  // 1. Cash Card
                  _buildPaymentCard(
                    title: '1. ເງິນສົດ (Cash)',
                    amount: cash,
                    subtitle: 'ເງິນສົດຕົວຈິງທີ່ໄດ້ຮັບ',
                    icon: Icons.payments_outlined,
                    iconBg: const Color(0xFF10B981),
                    cardBg: const Color(0xFFF0FDF4),
                    cardBorder: const Color(0xFFA7F3D0),
                    textColor: const Color(0xFF065F46),
                    width: width,
                  ),

                  // 2. Transfer Card
                  _buildPaymentCard(
                    title: '2. ໂອນເງິນ (Transfer / OnePay)',
                    amount: transfer,
                    subtitle: 'OnePay QR + ໂອນບັນຊີ',
                    icon: Icons.qr_code_2_rounded,
                    iconBg: const Color(0xFF2563EB),
                    cardBg: const Color(0xFFEFF6FF),
                    cardBorder: const Color(0xFFBFDBFE),
                    textColor: const Color(0xFF1E40AF),
                    width: width,
                  ),

                  // 3. Debt Card
                  _buildPaymentCard(
                    title: '3. ຍອດຂາຍຕິດໜີ້ (Credit)',
                    amount: debt,
                    subtitle: 'ລວມ $debtCount ບິນຕິດໜີ້',
                    icon: Icons.hourglass_bottom_rounded,
                    iconBg: const Color(0xFFF59E0B),
                    cardBg: const Color(0xFFFFFBEB),
                    cardBorder: const Color(0xFFFDE68A),
                    textColor: const Color(0xFF92400E),
                    width: width,
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentCard({
    required String title,
    required int amount,
    required String subtitle,
    required IconData icon,
    required Color iconBg,
    required Color cardBg,
    required Color cardBorder,
    required Color textColor,
    required double width,
  }) {
    return Container(
      width: width,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: cardBorder, width: 0.8),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                ),
                Text(
                  LaoCurrencyFormatter.format(amount),
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: textColor,
                    letterSpacing: -0.2,
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(fontSize: 9.5, color: textColor.withValues(alpha: 0.8), fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- Component 1: Hourly Sales Trend Bar Chart (07:00 - 22:00) ---
  Widget _buildHourlyTrendWidget(List<_HourlyBucket> buckets, int maxRev, int totalTxCount) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'ຍອດຂາຍຕາມຊ່ວງເວລາ (Hourly Sales Trend: 07:00 - 22:00)',
                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                  ),
                  SizedBox(height: 1),
                  Text(
                    'ວິເຄາະຊົ່ວໂມງທີ່ຂາຍດີທີ່ສຸດຂອງຮ້ານເພື່ອຈັດສັນພະນັກງານ ແລະ ກຽມສະຕັອກ',
                    style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '$totalTxCount ບິນ',
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Bar chart
          SizedBox(
            height: 120,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: buckets.map((b) {
                final ratio = b.revenue > 0 ? (b.revenue / maxRev) : 0.04;
                final isPeak = b.revenue > 0 && b.revenue == maxRev;

                return Expanded(
                  child: Tooltip(
                    message: '${b.label}\n${LaoCurrencyFormatter.format(b.revenue)}\n${b.txCount} ບິນ',
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 1.5),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Expanded(
                            child: Align(
                              alignment: Alignment.bottomCenter,
                              child: FractionallySizedBox(
                                heightFactor: ratio.clamp(0.06, 1.0),
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: isPeak
                                        ? const Color(0xFF0F766E)
                                        : (b.revenue > 0 ? const Color(0xFF14B8A6) : const Color(0xFFE2E8F0)),
                                    borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 4),

          // Axis labels (07:00, 10:00, 13:00, 16:00, 19:00, 22:00)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Text('07:00', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
              Text('10:00', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
              Text('13:00', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
              Text('16:00', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
              Text('19:00', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
              Text('22:00', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
            ],
          ),
        ],
      ),
    );
  }

  // --- Component 2: Sales by Category Breakdown ---
  Widget _buildCategoryBreakdownWidget(List<_CategoryAccumulator> catList, int totalCatRev) {
    final colors = [
      const Color(0xFF14B8A6), // teal
      const Color(0xFF10B981), // emerald
      const Color(0xFFF59E0B), // amber
      const Color(0xFF8B5CF6), // purple
      const Color(0xFFF43F5E), // rose
      const Color(0xFF3B82F6), // blue
    ];

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'ໂຄງສ້າງຍອດຂາຍຕາມໝວດໝູ່ (Sales by Category)',
                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                  ),
                  SizedBox(height: 1),
                  Text(
                    'ສັດສ່ວນລາຍຮັບຂອງແຕ່ລະກຸ່ມສິນຄ້າ (ເຄື່ອງດື່ມ, ເຂົ້າໜົມ, ເບຍ,...)',
                    style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDFA),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFF99F6E4)),
                ),
                child: Text(
                  '${catList.length} ໝວດໝູ່',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF0F766E)),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          if (catList.isEmpty)
            Container(
              padding: const EdgeInsets.all(20),
              alignment: Alignment.center,
              child: const Text('ຍັງບໍ່ມີຂໍ້ມູນຍອດຂາຍໃນຊ່ວງເວລານີ້', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
            )
          else ...[
            // Stacked Multi-color Bar
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: SizedBox(
                height: 10,
                child: Row(
                  children: catList.asMap().entries.map((entry) {
                    final idx = entry.key;
                    final cat = entry.value;
                    final flex = totalCatRev > 0 ? (cat.revenue * 1000 ~/ totalCatRev) : 0;
                    return Expanded(
                      flex: flex > 0 ? flex : 1,
                      child: Container(color: colors[idx % colors.length]),
                    );
                  }).toList(),
                ),
              ),
            ),

            const SizedBox(height: 10),

            // Category item cards grid
            LayoutBuilder(
              builder: (context, constraints) {
                final isWide = constraints.maxWidth >= 500;
                final width = isWide ? (constraints.maxWidth - 8) / 2 : constraints.maxWidth;

                return Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: catList.asMap().entries.map((entry) {
                    final idx = entry.key;
                    final cat = entry.value;
                    final pct = totalCatRev > 0 ? ((cat.revenue / totalCatRev) * 100).toStringAsFixed(1) : '0';
                    final color = colors[idx % colors.length];

                    return Container(
                      width: width,
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 10,
                                height: 10,
                                decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2.5)),
                              ),
                              const SizedBox(width: 6),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    cat.name,
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                                  ),
                                  Text(
                                    'ຂາຍໄດ້ ${cat.quantity} ລາຍການ',
                                    style: const TextStyle(fontSize: 9.5, color: Color(0xFF64748B)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                LaoCurrencyFormatter.format(cat.revenue),
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                              ),
                              Text(
                                '$pct%',
                                style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF0F766E)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  // --- Component 3: Top 5 Best Selling Products ---
  Widget _buildTop5ProductsWidget(List<_TopProductAccumulator> topList) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Row(
                children: [
                  Icon(Icons.local_fire_department_rounded, size: 16, color: Color(0xFFF59E0B)),
                  SizedBox(width: 4),
                  Text(
                    '5 ສິນຄ້າຂາຍດີທີ່ສຸດ (Top 5 Sellers)',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                  ),
                ],
              ),
              Text(
                'ມື້ນີ້/ຕາມຮອບ',
                style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold),
              ),
            ],
          ),

          const SizedBox(height: 10),

          if (topList.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16.0),
              child: Center(
                child: Text('ຍັງບໍ່ມີຂໍ້ມູນການຂາຍ', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              ),
            )
          else
            Column(
              children: topList.asMap().entries.map((entry) {
                final idx = entry.key;
                final item = entry.value;
                final rankColor = idx == 0
                    ? const Color(0xFFF59E0B)
                    : (idx == 1 ? const Color(0xFF94A3B8) : const Color(0xFFB45309));

                return Container(
                  margin: const EdgeInsets.only(bottom: 7),
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      // Rank Badge + Thumbnail
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: _buildProductThumbnail(item),
                          ),
                          Positioned(
                            top: -4,
                            left: -4,
                            child: Container(
                              width: 15,
                              height: 15,
                              decoration: BoxDecoration(
                                color: rankColor,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 1.2),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                '${idx + 1}',
                                style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: Colors.white),
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(width: 8),

                      // Name & compound sold quantity
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.name,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              'ຂາຍແລ້ວ: ${item.formattedSold}',
                              style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF0F766E)),
                            ),
                          ],
                        ),
                      ),

                      // Revenue and profit
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            LaoCurrencyFormatter.format(item.revenue),
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                          ),
                          Text(
                            '+${LaoCurrencyFormatter.format(item.profit)}',
                            style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }

  Widget _buildProductThumbnail(_TopProductAccumulator item) {
    final imgUrl = item.imageUrl;
    if (imgUrl != null && imgUrl.isNotEmpty) {
      final isDataUri = ImageCompressService.isDataUri(imgUrl);
      return isDataUri
          ? Image.memory(
              ImageCompressService.bytesFromDataUri(imgUrl) ?? Uint8List(0),
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const Center(
                child: Icon(Icons.inventory_2_outlined, size: 18, color: Color(0xFF94A3B8)),
              ),
            )
          : Image.network(
              imgUrl,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const Center(
                child: Icon(Icons.inventory_2_outlined, size: 18, color: Color(0xFF94A3B8)),
              ),
            );
    }
    return const Center(
      child: Icon(Icons.inventory_2_outlined, size: 18, color: Color(0xFF94A3B8)),
    );
  }

  // --- Component 4: Low Stock Alert Widget ---
  Widget _buildLowStockAlertWidget(List<Product> lowStockList) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFE11D48)),
                  SizedBox(width: 4),
                  Text(
                    'ສິນຄ້າໃກ້ໝົດສາງ (Low Stock Alert)',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF881337)),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFECDD3)),
                ),
                child: Text(
                  '${lowStockList.length} ລາຍການ',
                  style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFFBE123C)),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          if (lowStockList.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFBBF7D0)),
              ),
              alignment: Alignment.center,
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_rounded, size: 16, color: Color(0xFF16A34A)),
                  SizedBox(width: 6),
                  Text('ສິນຄ້າທຸກລາຍການຢູ່ໃນເກນປອດໄພ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF166534))),
                ],
              ),
            )
          else
            Column(
              children: lowStockList.map((p) {
                final isOutOfStock = p.currentStockBaseUnits <= 0;
                return Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF1F2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFFE4E6)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              p.name,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              'ໝວດ: ${p.category}',
                              style: const TextStyle(fontSize: 9.5, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: isOutOfStock ? const Color(0xFFE11D48) : Colors.white,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: const Color(0xFFFECDD3)),
                        ),
                        child: Text(
                          p.compoundStockFormatted,
                          style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w800,
                            color: isOutOfStock ? Colors.white : const Color(0xFFBE123C),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }

  // --- Component 5: Recent Credit Customers ---
  Widget _buildRecentCreditWidget(List<SaleTransaction> creditTxs) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.hourglass_bottom_rounded, size: 16, color: Color(0xFFD97706)),
                  SizedBox(width: 4),
                  Text(
                    'ລູກຄ້າຄ້າງຊຳລະ (Recent Credit)',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF78350F)),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: Text(
                  '${creditTxs.length} ບິນ',
                  style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFFB45309)),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          Column(
            children: creditTxs.map((tx) {
              return Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFEF3C7)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tx.customer.name,
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            'ບິນ: ${tx.receiptNumber}${tx.debtNote != null ? ' • ${tx.debtNote}' : ''}',
                            style: const TextStyle(fontSize: 9.5, color: Color(0xFF64748B)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          LaoCurrencyFormatter.format(tx.debtAmount > 0 ? tx.debtAmount : tx.grandTotal),
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF92400E)),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(3),
                          ),
                          child: const Text('ຕິດໜີ້', style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: Color(0xFF78350F))),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // --- Component 6: Custom Date Range Filter Banner ---
  Widget _buildCustomDateFilterBanner(int matchedCount) {
    final dateStr = (_customStartDate != null && _customEndDate != null)
        ? '${DateFormat('dd/MM/yyyy').format(_customStartDate!)}  ຫາ  ${DateFormat('dd/MM/yyyy').format(_customEndDate!)}'
        : 'ກົດເພື່ອເລືອກຊ່ວງວັນທີ';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFCBD5E1)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 12,
        runSpacing: 8,
        children: [
          InkWell(
            onTap: _pickCustomDateRange,
            borderRadius: BorderRadius.circular(10),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDFA),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF99F6E4)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.date_range_rounded,
                      size: 16, color: Color(0xFF0F766E)),
                  const SizedBox(width: 8),
                  Text(
                    dateStr,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F766E),
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Icon(Icons.edit_calendar_rounded,
                      size: 14, color: Color(0xFF0F766E)),
                ],
              ),
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'ພົບ $matchedCount ບິນໃນຊ່ວງເວລານີ້',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// Helpers for data aggregations
class _HourlyBucket {
  final int hour;
  final String label;
  int revenue;
  int txCount;

  _HourlyBucket({
    required this.hour,
    required this.label,
    required this.revenue,
    required this.txCount,
  });
}

class _CategoryAccumulator {
  final String name;
  int revenue = 0;
  int quantity = 0;

  _CategoryAccumulator({required this.name});
}

class _TopProductAccumulator {
  final String id;
  final String name;
  final String? imageUrl;
  final Product product;
  int totalBaseUnits = 0;
  int revenue = 0;
  int profit = 0;
  int ordersCount = 0;

  _TopProductAccumulator({
    required this.id,
    required this.name,
    this.imageUrl,
    required this.product,
  });

  String get formattedSold {
    final tempProd = product.copyWith(currentStockBaseUnits: totalBaseUnits);
    return tempProd.compoundStockFormatted;
  }
}
