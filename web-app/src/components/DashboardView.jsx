import React, { useMemo, useState } from 'react';
import {
  ChartBar,
  CalendarBlank,
  CreditCard,
  Bank,
  QrCode,
  CurrencyCircleDollar,
  Prohibit,
  ClockAfternoon,
  ChartPie,
  Fire,
  WarningOctagon,
  ClockCountdown,
  ArrowUpRight,
  Receipt,
  Tag,
  Package,
  CaretRight,
  CheckCircle,
  CurrencyDollar,
  ArrowRight,
  TrendUp,
  TrendDown,
  ArrowsLeftRight,
} from '@phosphor-icons/react';
import { formatKip, formatBaht, formatCompoundStock } from '../utils/formatters';
import MonthComparisonView from './dashboard/MonthComparisonView';
import DynamicDailyRevenueChart from './dashboard/DynamicDailyRevenueChart';
import Annual12MonthSalesChart from './dashboard/Annual12MonthSalesChart';

export default function DashboardView({
  dashboardTimeframe,
  setDashboardTimeframe,
  dashboardData,
  transactions = [],
  products = [],
  rawCategories = [],
  exchangeRate = 720,
}) {
  // Custom Date Range State
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // 2-Month Comparison State (defaults to current month and previous month)
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const [compareMonthA, setCompareMonthA] = useState(currentMonthStr);
  const [compareMonthB, setCompareMonthB] = useState(prevMonthStr);

  // Safe reference to active transactions in timeframe
  const currentTxs = useMemo(() => {
    if (dashboardData.filteredTxs && Array.isArray(dashboardData.filteredTxs) && dashboardTimeframe !== 'custom' && dashboardTimeframe !== 'compare') {
      return dashboardData.filteredTxs;
    }
    const now = new Date();
    return transactions.filter((tx) => {
      if (tx.status === 'cancelled' || tx.isCancelled) return false;
      const txDate = new Date(tx.createdAt);
      if (dashboardTimeframe === 'daily') {
        return (
          txDate.getDate() === now.getDate() &&
          txDate.getMonth() === now.getMonth() &&
          txDate.getFullYear() === now.getFullYear()
        );
      } else if (dashboardTimeframe === 'weekly') {
        return txDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dashboardTimeframe === 'monthly') {
        return (
          txDate.getMonth() === now.getMonth() &&
          txDate.getFullYear() === now.getFullYear()
        );
      } else if (dashboardTimeframe === 'custom') {
        if (customStartDate) {
          const s = new Date(customStartDate);
          s.setHours(0, 0, 0, 0);
          if (txDate < s) return false;
        }
        if (customEndDate) {
          const e = new Date(customEndDate);
          e.setHours(23, 59, 59, 999);
          if (txDate > e) return false;
        }
        return true;
      }
      return true;
    });
  }, [dashboardData.filteredTxs, transactions, dashboardTimeframe, customStartDate, customEndDate]);

  // Month-Over-Month Comparison Analytics
  const comparisonStats = useMemo(() => {
    const parseMonthTxs = (yearMonthStr) => {
      const parts = (yearMonthStr || '').split('-');
      if (parts.length < 2) return [];
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      return transactions.filter((t) => {
        if (t.status === 'cancelled' || t.isCancelled) return false;
        const d = new Date(t.createdAt);
        return d.getFullYear() === y && d.getMonth() + 1 === m;
      });
    };

    const txsA = parseMonthTxs(compareMonthA);
    const txsB = parseMonthTxs(compareMonthB);

    const calcMetrics = (list) => {
      let revenue = 0;
      let cost = 0;
      let profit = 0;
      let cash = 0;
      let transfer = 0;
      let debt = 0;

      list.forEach((t) => {
        const rev = Number(t.grandTotal) || 0;
        const c = Number(t.totalCost) || 0;
        const p = Number(t.grossProfit) || 0;
        revenue += rev;
        cost += c;
        profit += p;

        const m = (t.paymentMethod || '').toLowerCase();
        if (t.isDebt || m === 'debt') {
          debt += rev;
        } else if (m === 'cash' || m === 'ເງິນສົດ') {
          cash += rev;
        } else {
          transfer += rev;
        }
      });

      return {
        revenue,
        cost,
        profit,
        cash,
        transfer,
        debt,
        count: list.length,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      };
    };

    const metricsA = calcMetrics(txsA);
    const metricsB = calcMetrics(txsB);

    const calcDiffPercent = (valA, valB) => {
      if (valB === 0) return valA > 0 ? 100 : 0;
      return ((valA - valB) / Math.abs(valB)) * 100;
    };

    return {
      metricsA,
      metricsB,
      revenueDiff: calcDiffPercent(metricsA.revenue, metricsB.revenue),
      profitDiff: calcDiffPercent(metricsA.profit, metricsB.profit),
      countDiff: calcDiffPercent(metricsA.count, metricsB.count),
    };
  }, [transactions, compareMonthA, compareMonthB]);

  // 1. Hourly Sales Breakdown (07:00 - 22:00)
  const hourlyData = useMemo(() => {
    const hours = [];
    for (let h = 7; h <= 22; h++) {
      hours.push({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        revenue: 0,
        txCount: 0,
      });
    }

    currentTxs.forEach((tx) => {
      const d = new Date(tx.createdAt);
      const h = d.getHours();
      const bucket = hours.find((item) => item.hour === h);
      if (bucket) {
        bucket.revenue += Number(tx.grandTotal) || 0;
        bucket.txCount += 1;
      }
    });

    const maxRev = Math.max(...hours.map((h) => h.revenue), 1);
    return { hours, maxRev };
  }, [currentTxs]);

  // 2. Sales by Category Breakdown
  const categoryBreakdown = useMemo(() => {
    const map = {};
    let totalCatRev = 0;

    currentTxs.forEach((tx) => {
      const items = tx.items || tx.sale_transaction_items || [];
      items.forEach((it) => {
        const prod = products.find(
          (p) => p.id === (it.product?.id || it.productId || it.product_id)
        );
        const catName =
          prod?.category ||
          it.product?.category ||
          (it.productName?.includes('ເບຍ') ? 'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ' : 'ທົ່ວໄປ');

        const lineTot = Number(it.lineTotal || it.line_total) || 0;
        if (!map[catName]) {
          map[catName] = { name: catName, revenue: 0, quantity: 0 };
        }
        map[catName].revenue += lineTot;
        map[catName].quantity += Number(it.quantity) || 1;
        totalCatRev += lineTot;
      });
    });

    // Color tokens for top categories
    const colorPalette = [
      'bg-teal-500 text-teal-700 border-teal-200',
      'bg-emerald-500 text-emerald-700 border-emerald-200',
      'bg-amber-500 text-amber-700 border-amber-200',
      'bg-purple-500 text-purple-700 border-purple-200',
      'bg-rose-500 text-rose-700 border-rose-200',
      'bg-blue-500 text-blue-700 border-blue-200',
    ];

    const list = Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .map((cat, idx) => ({
        ...cat,
        colorClass: colorPalette[idx % colorPalette.length],
        percentage: totalCatRev > 0 ? ((cat.revenue / totalCatRev) * 100).toFixed(1) : 0,
      }));

    return { list, totalCatRev };
  }, [currentTxs, products]);

  // 3. Top 5 Best Selling Products Today / In Timeframe
  const topProducts = useMemo(() => {
    const prodMap = {};

    currentTxs.forEach((tx) => {
      const items = tx.items || tx.sale_transaction_items || [];
      items.forEach((it) => {
        const pId = it.product?.id || it.productId || it.product_id || it.productName;
        const lineTot = Number(it.lineTotal || it.line_total) || 0;
        const lineCost = Number(it.lineCost || it.line_cost) || 0;
        const lineProfit = it.lineProfit !== undefined ? Number(it.lineProfit) : Math.max(0, lineTot - lineCost);
        const qty = Number(it.quantity) || 1;
        const mult = Number(it.unit?.multiplier || it.multiplier) || 1;
        const baseUnitsSold = qty * mult;

        if (!prodMap[pId]) {
          const productObj = products.find((p) => p.id === pId);
          prodMap[pId] = {
            id: pId,
            name: it.productName || it.product?.name || productObj?.name || 'ສິນຄ້າ',
            imageUrl: productObj?.imageUrl || productObj?.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&q=80',
            productObj,
            totalBaseUnits: 0,
            revenue: 0,
            profit: 0,
            ordersCount: 0,
          };
        }
        prodMap[pId].totalBaseUnits += baseUnitsSold;
        prodMap[pId].revenue += lineTot;
        prodMap[pId].profit += lineProfit;
        prodMap[pId].ordersCount += 1;
      });
    });

    return Object.values(prodMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((item) => {
        // Format sold units into human readable compound string (e.g. 8 ແກັດ 2 ແພັກ)
        let formattedSold = `${item.totalBaseUnits} ອັນ`;
        if (item.productObj) {
          const tempProd = {
            ...item.productObj,
            currentStockBaseUnits: item.totalBaseUnits,
            trackStock: true,
          };
          formattedSold = formatCompoundStock(tempProd).replace(/ \(ລວມທັງໝົດ:.*\)/, '');
        }
        return {
          ...item,
          formattedSold,
        };
      });
  }, [currentTxs, products]);

  // 4. Low Stock Alert Products (Stock <= 15 or <= 1 carton)
  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (p.trackStock === false) return false;
        const stock = Number(p.currentStockBaseUnits);
        if (isNaN(stock)) return false;
        // Threshold: 15 base units or less than 1 carton multiplier
        const cartonMult = p.units?.find((u) => u.tier === 3 || u.id?.endsWith('_carton'))?.multiplier || 20;
        return stock <= Math.max(15, cartonMult);
      })
      .sort((a, b) => Number(a.currentStockBaseUnits || 0) - Number(b.currentStockBaseUnits || 0))
      .slice(0, 4);
  }, [products]);

  // 5. Recent Credit / Debt Customers (Unsettled debts)
  const recentCreditTxs = useMemo(() => {
    return transactions
      .filter((t) => {
        if (t.status === 'cancelled' || t.isCancelled) return false;
        return t.paymentMethod === 'debt' || t.isDebt || Number(t.debtAmount) > 0;
      })
      .slice(0, 4);
  }, [transactions]);

  return (
    <main
      className="flex-1 w-full p-3 sm:p-4 lg:p-5 overflow-y-auto font-sans min-h-0 pb-20 touch-pan-y bg-slate-50/60"
      style={{
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        paddingBottom: 'max(4.5rem, calc(3.5rem + env(safe-area-inset-bottom, 0px)))',
      }}
    >
      {/* 1. Dashboard Header & Timeframe Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-3.5 border-b border-slate-200/80 mb-3 sm:mb-4 gap-2.5 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
            <ChartBar size={20} className="sm:w-5 sm:h-5" weight="duotone" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="truncate">ແຜງຄວບຄຸມລາຍຮັບ & ຕົ້ນທຶນ</span>
            </h2>
            <p className="text-[11.5px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
              ສະຫຼຸບລາຍຮັບ, ຕົ້ນທຶນສິນຄ້າ, ຍອດເງິນສົດ/ໂອນ/ຕິດໜີ້ ແລະ ວິເຄາະທຸລະກິດ Real-time
            </p>
          </div>
        </div>

        {/* Timeframe Chips */}
        <div className="flex items-center bg-white p-0.5 sm:p-1 rounded-xl border border-slate-200/90 shadow-2xs overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'daily', label: 'ມື້ນີ້' },
            { id: 'weekly', label: '7 ມື້' },
            { id: 'monthly', label: 'ເດືອນນີ້' },
            { id: 'all', label: 'ທັງໝົດ' },
            { id: 'custom', label: 'ວັນທີ' },
            { id: 'compare', label: 'ສົມທຽບ 2 ເດືອນ' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setDashboardTimeframe(item.id)}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                dashboardTimeframe === item.id
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Range Filter Inputs & Dynamic Chart */}
      {dashboardTimeframe === 'custom' && (
        <div className="mb-6 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <CalendarBlank size={18} className="text-teal-600 font-bold" />
                <span className="font-bold text-slate-700">ແຕ່ວັນທີ (Từ ngày):</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-700">ຫາວັນທີ (Đến ngày):</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
            <span className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-lg">
              ພົບ <strong>{currentTxs.length}</strong> ບິນຂາຍ
            </span>
          </div>

          {/* Dynamic Daily Revenue Chart auto-scaling across selected days */}
          <DynamicDailyRevenueChart
            transactions={currentTxs}
            startDate={customStartDate}
            endDate={customEndDate}
          />
        </div>
      )}

      {/* 2-Month Year-over-Year Dual Period Comparison View */}
      {dashboardTimeframe === 'compare' ? (
        <MonthComparisonView fallbackTransactions={transactions} products={products} />
      ) : (
        <>
          {/* 2. TOP 4 MAIN KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* KPI 1: Revenue */}
        <div className="p-3 sm:p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-teal-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold">ຍອດຂາຍລວມ (Revenue)</span>
            <span className="w-7 h-7 bg-teal-50 text-teal-700 rounded-lg flex items-center justify-center border border-teal-100">
              <CurrencyCircleDollar size={16} weight="bold" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-teal-700 tracking-tight block">
              {formatKip(dashboardData.totalRevenue)}
            </span>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold mt-1 pt-1 border-t border-slate-100">
              <span>ຈຳນວນ:</span>
              <span className="text-slate-800 font-extrabold">{dashboardData.txCount} ບິນສຳເລັດ</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Cost (COGS) */}
        <div className="p-3 sm:p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold">ຕົ້ນທຶນສິນຄ້າລວມ (COGS)</span>
            <span className="w-7 h-7 bg-amber-50 text-amber-700 rounded-lg flex items-center justify-center border border-amber-100">
              <CalendarBlank size={16} weight="bold" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight block">
              {formatKip(dashboardData.totalCost)}
            </span>
            <div className="flex items-center justify-between text-[10px] text-amber-700 font-bold mt-1 pt-1 border-t border-slate-100">
              <span>ຕົ້ນທຶນສິນຄ້າຂາຍອອກ</span>
              <span className="font-extrabold">ທຶນຈິງ</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Gross Profit */}
        <div className="p-3 sm:p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold">ກຳໄລຂັ້ນຕົ້ນ (Gross Profit)</span>
            <span className="w-7 h-7 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center border border-emerald-100">
              <CreditCard size={16} weight="bold" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight block">
              {formatKip(dashboardData.grossProfit)}
            </span>
            <div className="flex items-center justify-between text-[10px] text-emerald-700 font-bold mt-1 pt-1 border-t border-slate-100">
              <span>ອັດຕາກຳໄລ:</span>
              <span className="font-extrabold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                {dashboardData.margin}%
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Average Ticket */}
        <div className="p-3 sm:p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold">ຍອດສະເລ່ຍຕໍ່ບິນ (Avg Basket)</span>
            <span className="w-7 h-7 bg-purple-50 text-purple-700 rounded-lg flex items-center justify-center border border-purple-100">
              <ChartBar size={16} weight="bold" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight block">
              {formatKip(dashboardData.avgTicket)}
            </span>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold mt-1 pt-1 border-t border-slate-100">
              <span>ສະເລ່ຍຕໍ່ 1 ລູກຄ້າ</span>
              <span className="text-slate-800 font-extrabold">ບິນ/ລູກຄ້າ</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PART 1: RECONCILED PAYMENT CARDS (1:1 with POS Checkout) */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 px-0.5">
          <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Receipt size={14} className="text-teal-600" />
            <span>ຊ່ອງທາງການຊຳລະເງິນ (Payment Breakdown)</span>
          </span>
          <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
            ກວດສອບຍອດ: {formatKip(dashboardData.totalRevenue)} (100% ຄົບຖ້ວນ)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1: Cash (ເງິນສົດ) */}
          <div className="p-3 sm:p-3.5 bg-gradient-to-br from-white to-emerald-50/40 rounded-xl border border-emerald-200/80 shadow-2xs flex items-center justify-between hover:shadow-xs transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <CurrencyDollar size={20} weight="bold" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-bold block">1. ເງິນສົດ (Cash)</span>
                <span className="text-lg sm:text-xl font-black text-emerald-800 block tracking-tight">
                  {formatKip(dashboardData.cashTotal || 0)}
                </span>
                <span className="text-[10px] text-emerald-700 font-medium block">
                  ເງິນສົດຕົວຈິງທີ່ໄດ້ຮັບ
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Transfer (ໂອນເງິນ / QR / Bank) */}
          <div className="p-3 sm:p-3.5 bg-gradient-to-br from-white to-blue-50/40 rounded-xl border border-blue-200/80 shadow-2xs flex items-center justify-between hover:shadow-xs transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <QrCode size={20} weight="bold" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-bold block">2. ໂອນເງິນ (Transfer / OnePay)</span>
                <span className="text-lg sm:text-xl font-black text-blue-900 block tracking-tight">
                  {formatKip(dashboardData.transferTotal || 0)}
                </span>
                <span className="text-[10px] text-blue-700 font-medium block">
                  OnePay QR + ໂອນບັນຊີ
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Debt / Credit (ຂາຍຕິດໜີ້ / ຄ້າງຊຳລະ) */}
          <div className="p-3 sm:p-3.5 bg-gradient-to-br from-white to-amber-50/50 rounded-xl border border-amber-200/80 shadow-2xs flex items-center justify-between hover:shadow-xs transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <ClockCountdown size={20} weight="bold" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-bold block">3. ຍອດຂາຍຕິດໜີ້ (Credit)</span>
                <span className="text-lg sm:text-xl font-black text-amber-900 block tracking-tight">
                  {formatKip(dashboardData.debtTotal || 0)}
                </span>
                <span className="text-[10px] text-amber-700 font-bold block">
                  ລວມ {dashboardData.debtCount || 0} ບິນຕິດໜີ້
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. PART 2: TWO-COLUMN DEEP-DIVE ANALYTICS SECTION (65% Left - 35% Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ==========================================
            LEFT COLUMN (65% => lg:col-span-8)
           ========================================== */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* COMPONENT 1: Hourly Sales Trend Chart (07:00 - 22:00) */}
          <div className="bg-white rounded-2xl p-4 sm:p-4.5 border border-slate-200 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <ClockAfternoon size={18} className="text-teal-600" weight="bold" />
                  <span>ຍອດຂາຍຕາມຊ່ວງເວລາ (Hourly Sales Trend: 07:00 - 22:00)</span>
                </h3>
                <p className="text-[10.5px] text-slate-500 mt-0.5">
                  ວິເຄາະຊົ່ວໂມງທີ່ຂາຍດີທີ່ສຸດຂອງຮ້ານເພື່ອຈັດສັນພະນັກງານ ແລະ ກຽມສະຕັອກ
                </p>
              </div>
              <span className="text-[10.5px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-lg self-start sm:self-auto">
                {currentTxs.length} ບິນ
              </span>
            </div>

            {/* Bar Chart Container */}
            <div className="pt-2 pb-1">
              <div className="h-36 flex items-end gap-1.5 sm:gap-2 justify-between border-b border-slate-200 pb-1 px-1">
                {hourlyData.hours.map((item) => {
                  const heightPercent =
                    item.revenue > 0
                      ? Math.max(12, Math.round((item.revenue / hourlyData.maxRev) * 100))
                      : 4;
                  const isTopPeak = item.revenue > 0 && item.revenue === hourlyData.maxRev;

                  return (
                    <div
                      key={item.hour}
                      className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full mb-1.5 hidden group-hover:flex flex-col items-center z-30 pointer-events-none animate-in fade-in zoom-in-95">
                        <div className="bg-slate-900 text-white text-[10px] rounded-lg px-2 py-1 shadow-xl whitespace-nowrap text-center">
                          <p className="font-black text-teal-300">{item.label}</p>
                          <p className="font-extrabold">{formatKip(item.revenue)}</p>
                          <p className="text-slate-300 text-[9px]">{item.txCount} ບິນ</p>
                        </div>
                        <div className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-0.5"></div>
                      </div>

                      {/* Bar Fill */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          isTopPeak
                            ? 'bg-gradient-to-t from-teal-600 to-emerald-400 shadow-xs'
                            : item.revenue > 0
                            ? 'bg-teal-500/80 group-hover:bg-teal-600'
                            : 'bg-slate-100'
                        }`}
                      ></div>
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Labels */}
              <div className="flex items-center justify-between text-[9.5px] sm:text-[10px] font-bold text-slate-400 mt-1 px-1">
                <span>07:00</span>
                <span>10:00</span>
                <span>13:00</span>
                <span>16:00</span>
                <span>19:00</span>
                <span>22:00</span>
              </div>
            </div>
          </div>

          {/* COMPONENT: Annual 12-Month Sales Trend (Smooth Area Line Chart) */}
          <Annual12MonthSalesChart fallbackTransactions={transactions} />

          {/* COMPONENT 2: Sales by Category Breakdown */}
          <div className="bg-white rounded-2xl p-4 sm:p-4.5 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <ChartPie size={18} className="text-teal-600" weight="bold" />
                  <span>ໂຄງສ້າງຍອດຂາຍຕາມໝວດໝູ່ (Sales by Category)</span>
                </h3>
                <p className="text-[10.5px] text-slate-500 mt-0.5">
                  ສັດສ່ວນລາຍຮັບຂອງແຕ່ລະກຸ່ມສິນຄ້າ (ເຄື່ອງດື່ມ, ເຂົ້າໜົມ, ເບຍ,...)
                </p>
              </div>
              <span className="text-[10.5px] font-black text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200">
                {categoryBreakdown.list.length} ໝວດໝູ່
              </span>
            </div>

            {categoryBreakdown.list.length === 0 ? (
              <div className="py-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Tag size={24} className="mx-auto text-slate-300 mb-1" />
                <p className="text-xs font-bold text-slate-600">ຍັງບໍ່ມີຂໍ້ມູນຍອດຂາຍໃນຊ່ວງເວລານີ້</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {/* Horizontal Stacked Progress Bar */}
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                  {categoryBreakdown.list.map((cat, idx) => (
                    <div
                      key={idx}
                      style={{ width: `${cat.percentage}%` }}
                      className={`${cat.colorClass.split(' ')[0]} transition-all duration-500`}
                      title={`${cat.name}: ${cat.percentage}%`}
                    />
                  ))}
                </div>

                {/* Category List Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {categoryBreakdown.list.map((cat, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-3 h-3 rounded-md ${cat.colorClass.split(' ')[0]} shrink-0`}
                        ></span>
                        <div className="min-w-0">
                          <span className="text-xs font-black text-slate-800 block truncate">
                            {cat.name}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            ຂາຍໄດ້ {cat.quantity} ລາຍການ
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-slate-900 block">
                          {formatKip(cat.revenue)}
                        </span>
                        <span className="text-[9.5px] font-extrabold text-teal-700 bg-teal-50 px-1 py-0.2 rounded border border-teal-200">
                          {cat.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ==========================================
            RIGHT COLUMN (35% => lg:col-span-4)
           ========================================== */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* COMPONENT 3: Top 5 Best Selling Products */}
          <div className="bg-white rounded-2xl p-4 sm:p-4.5 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Fire size={16} className="text-amber-500" weight="fill" />
                <span>5 ສິນຄ້າຂາຍດີທີ່ສຸດ (Top 5 Sellers)</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-400">ມື້ນີ້/ຕາມຮອບ</span>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Package size={20} className="mx-auto text-slate-300 mb-1" />
                <p className="text-[11px] font-bold text-slate-500">ຍັງບໍ່ມີຂໍ້ມູນການຂາຍ</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {topProducts.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-2 rounded-xl border border-slate-200/90 hover:border-teal-300 bg-slate-50/50 hover:bg-white flex items-center justify-between gap-2.5 transition-all"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-8 h-8 rounded-lg object-cover border border-slate-200 bg-white"
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&q=80';
                          }}
                        />
                        <span
                          className={`absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full text-[8.5px] font-black flex items-center justify-center text-white ${
                            idx === 0
                              ? 'bg-amber-500 ring-1 ring-amber-200'
                              : idx === 1
                              ? 'bg-slate-400'
                              : idx === 2
                              ? 'bg-amber-700'
                              : 'bg-slate-300 text-slate-700'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-800 truncate" title={item.name}>
                          {item.name}
                        </h4>
                        <span className="text-[10px] text-teal-700 font-extrabold block">
                          ຂາຍແລ້ວ: {item.formattedSold}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-slate-900 block">
                        {formatKip(item.revenue)}
                      </span>
                      <span className="text-[9.5px] text-emerald-700 font-bold block">
                        +{formatKip(item.profit)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COMPONENT 4: Low Stock Alert Widget (Cảnh báo tồn kho an toàn) */}
          <div className="bg-white rounded-2xl p-4 sm:p-4.5 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs sm:text-sm font-black text-rose-950 flex items-center gap-1.5">
                <WarningOctagon size={16} className="text-rose-600" weight="fill" />
                <span>ສິນຄ້າໃກ້ໝົດສາງ (Low Stock Alert)</span>
              </h3>
              <span className="text-[9.5px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                {lowStockProducts.length} ລາຍການ
              </span>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="py-3 text-center text-slate-400 bg-emerald-50/50 rounded-xl border border-emerald-200">
                <CheckCircle size={20} className="mx-auto text-emerald-600 mb-0.5" weight="fill" />
                <p className="text-[11px] font-bold text-emerald-800">ສິນຄ້າທຸກລາຍການຢູ່ໃນເກນປອດໄພ</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {lowStockProducts.map((p) => {
                  const stock = Number(p.currentStockBaseUnits || 0);
                  const isOutOfStock = stock <= 0;
                  return (
                    <div
                      key={p.id}
                      className="p-2 bg-rose-50/50 rounded-xl border border-rose-100 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-800 block truncate">
                          {p.name}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          ໝວດ: {p.category || 'ທົ່ວໄປ'}
                        </span>
                      </div>
                      <span
                        className={`text-[10.5px] font-black px-1.5 py-0.5 rounded border shrink-0 ${
                          isOutOfStock
                            ? 'bg-rose-600 text-white border-rose-700'
                            : 'bg-white text-rose-700 border-rose-200'
                        }`}
                      >
                        {formatCompoundStock(p)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* COMPONENT 6: Recent Credit Customers (Khách nợ gần đây) */}
          {recentCreditTxs.length > 0 && (
            <div className="bg-white rounded-2xl p-4 sm:p-4.5 border border-amber-200/80 shadow-2xs">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs sm:text-sm font-black text-amber-950 flex items-center gap-1.5">
                  <ClockCountdown size={16} className="text-amber-600" weight="bold" />
                  <span>ລູກຄ້າຄ້າງຊຳລະ (Recent Credit)</span>
                </h3>
                <span className="text-[9.5px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  {recentCreditTxs.length} ບິນ
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {recentCreditTxs.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-2 bg-amber-50/40 rounded-xl border border-amber-200/70 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-black text-slate-900 block truncate">
                        {tx.customerName || 'ລູກຄ້າຄ້າງຊຳລະ'}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        ບິນ: {tx.receiptNumber} {tx.debtNote ? `• ${tx.debtNote}` : ''}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-amber-800 block">
                        {formatKip(tx.debtAmount || tx.grandTotal)}
                      </span>
                      <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100/70 px-1 py-0.2 rounded">
                        ຕິດໜີ້
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </>
    )}
  </main>
  );
}
