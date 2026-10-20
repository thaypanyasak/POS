import React, { useState, useMemo } from 'react';
import {
  Package,
  SquaresFour,
  Tag,
  CurrencyCircleDollar,
  MagnifyingGlass,
  X,
  CalendarBlank,
  ArrowClockwise,
  CaretUp,
  CaretDown,
  ArrowsDownUp,
  ChartPieSlice,
  Printer,
  Export,
  Minus
} from '@phosphor-icons/react';
import { formatKip, formatBaht, formatDots, normalizeLao } from '../../utils/formatters';

/**
 * Determine unit tier level:
 * Level 3: Carton / Thùng / ແກັດ / ລັງ
 * Level 2: Pack / Lốc / ແພັກ
 * Level 1: Retail Unit / Lẻ / ອັນ / ແກ້ວ / ປ໋ອງ / ຕຸກ
 */
function classifyUnitLevel(unitName = '', multiplier = 1, product = null) {
  const u = String(unitName || '').trim().toLowerCase();
  const m = Number(multiplier) || 1;

  // 1. Check if matches product's specific tier unit names if product object provided
  if (product) {
    if (product.cartonUnitName && u === String(product.cartonUnitName).trim().toLowerCase()) return 3;
    if (product.packUnitName && u === String(product.packUnitName).trim().toLowerCase()) return 2;
    if (product.pieceUnitName && u === String(product.pieceUnitName).trim().toLowerCase()) return 1;

    // Check units array if available
    if (Array.isArray(product.units) && product.units.length > 0) {
      const matchedUnit = product.units.find(
        (unit) => String(unit.unitName || '').trim().toLowerCase() === u
      );
      if (matchedUnit) {
        if (matchedUnit.tier === 3 || matchedUnit.id?.endsWith('_carton')) return 3;
        if (matchedUnit.tier === 2 || matchedUnit.id?.endsWith('_pack')) return 2;
        if (matchedUnit.tier === 1 || matchedUnit.id?.endsWith('_piece')) return 1;
      }
    }
  }

  // 2. Keyword matching for Lao, English, Vietnamese
  // Tier 3: Carton / Thùng / ແກັດ / ລັງ / ກະສອບ / ເປົາ
  if (/^(ແກັດ|ລັງ|ກະສອບ|ເປົາ|thùng|carton|box|crate|case)$/i.test(u) ||
      u.includes('ແກັດ') || u.includes('ລັງ') || u.includes('thùng') || u.includes('carton')) {
    return 3;
  }

  // Tier 2: Pack / Lốc / ແພັກ / ໂຫຼ
  if (/^(ແພັກ|ໂຫຼ|pack|lốc|loc|dozen|bundle)$/i.test(u) ||
      u.includes('ແພັກ') || u.includes('pack') || u.includes('lốc') || u.includes('ໂຫຼ')) {
    return 2;
  }

  // Tier 1: Retail / Lẻ / ອັນ / ແກ້ວ / ປ໋ອງ / ຕຸກ / ກ່ອງ / ຊອງ / ຫໍ່ / ຖົງ / ໜ່ວຍ
  if (/^(ອັນ|ແກ້ວ|ປ໋ອງ|ຕຸກ|ກ່ອງ|ຊອງ|ຫໍ່|ຖົງ|ໜ່ວຍ|piece|can|bottle|item|unit)$/i.test(u) ||
      u.includes('ອັນ') || u.includes('piece') || u.includes('ແກ້ວ') || u.includes('ປ໋ອງ') || u.includes('ຕຸກ')) {
    return 1;
  }

  // 3. Fallback by packaging multiplier
  if (m >= 12) return 3;
  if (m > 1) return 2;
  return 1;
}

export default function SalesByUnitReportView({
  transactions = [],
  products = [],
  exchangeRate = 690,
  onRefresh,
  isLoading = false,
}) {
  // 1. Filter States
  // 'today' | 'yesterday' | '7days' | 'month' | 'custom'
  const [timeframe, setTimeframe] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // 2. Sort State: 'revenue' | 'carton' | 'pack' | 'retail' | 'name'
  const [sortField, setSortField] = useState('revenue');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // 3. Products Quick Lookup Map
  const productMap = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      if (p.id) map.set(p.id, p);
    });
    return map;
  }, [products]);

  // 4. Date Range Filtering of Transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const endOfYesterday = new Date(startOfToday.getTime() - 1);

    const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    return transactions.filter((tx) => {
      // Exclude voided or cancelled orders
      const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
      if (isCancelled) return false;

      const txDate = new Date(tx.createdAt || tx.date);
      if (isNaN(txDate.getTime())) return false;

      switch (timeframe) {
        case 'today':
          return txDate >= startOfToday && txDate <= endOfToday;
        case 'yesterday':
          return txDate >= startOfYesterday && txDate <= endOfYesterday;
        case '7days':
          return txDate >= sevenDaysAgo && txDate <= endOfToday;
        case 'month':
          return txDate >= startOfMonth && txDate <= endOfToday;
        case 'custom': {
          if (customStartDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            if (txDate < start) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            if (txDate > end) return false;
          }
          return true;
        }
        default:
          return true;
      }
    });
  }, [transactions, timeframe, customStartDate, customEndDate]);

  // 5. Aggregate Sales by Product & Unit Breakdown
  const { productSalesList, totalCartons, totalPacks, totalRetail, totalRevenue } = useMemo(() => {
    // Map productId -> aggregated stats
    const aggMap = new Map();

    let grandCartons = 0;
    let grandPacks = 0;
    let grandRetail = 0;
    let grandRevenue = 0;

    filteredTransactions.forEach((tx) => {
      // Gather all items from either items or sale_transaction_items
      const items = (tx.items && tx.items.length > 0)
        ? tx.items
        : (tx.sale_transaction_items || []);

      items.forEach((item) => {
        const prodId = item.productId || item.product?.id || item.product_id || `prod_${item.productName || item.product_name || 'unknown'}`;
        const prodInfo = productMap.get(prodId) || item.product || {};

        const rawName = prodInfo.name || item.productName || item.product_name || 'ສິນຄ້າບໍ່ມີຊື່';
        const rawBarcode = prodInfo.barcode || item.product?.barcode || item.barcode || '';
        const rawImage = prodInfo.imageUrl || prodInfo.image_url || item.product?.imageUrl || '';

        const unitName = (item.unitName || item.unit_name || item.unit?.unitName || '').trim();
        const multiplier = Number(item.multiplier ?? item.unit?.multiplier ?? 1);
        const qty = Number(item.quantity) || 1;
        const lineTotal = Number(item.lineTotal ?? item.line_total ?? (Number(item.unitPrice ?? item.unit_price ?? 0) * qty)) || 0;

        // Classify unit level (1, 2, or 3)
        const unitLevel = classifyUnitLevel(unitName, multiplier, prodInfo);

        // Unit labels determination for this product
        const cUnitName = prodInfo.cartonUnitName || (unitLevel === 3 ? unitName : 'ແກັດ');
        const pUnitName = prodInfo.packUnitName || (unitLevel === 2 ? unitName : 'ແພັກ');
        const rUnitName = prodInfo.pieceUnitName || (unitLevel === 1 ? unitName : 'ອັນ');

        if (!aggMap.has(prodId)) {
          aggMap.set(prodId, {
            id: prodId,
            name: rawName,
            barcode: rawBarcode,
            imageUrl: rawImage,
            cartonUnitName: cUnitName,
            packUnitName: pUnitName,
            retailUnitName: rUnitName,
            cartonQty: 0,
            packQty: 0,
            retailQty: 0,
            revenue: 0,
            orderCount: 0,
          });
        }

        const entry = aggMap.get(prodId);
        entry.revenue += lineTotal;
        entry.orderCount += 1;
        grandRevenue += lineTotal;

        if (unitLevel === 3) {
          entry.cartonQty += qty;
          grandCartons += qty;
          if (unitName && !prodInfo.cartonUnitName) entry.cartonUnitName = unitName;
        } else if (unitLevel === 2) {
          entry.packQty += qty;
          grandPacks += qty;
          if (unitName && !prodInfo.packUnitName) entry.packUnitName = unitName;
        } else {
          entry.retailQty += qty;
          grandRetail += qty;
          if (unitName && !prodInfo.pieceUnitName) entry.retailUnitName = unitName;
        }
      });
    });

    const list = Array.from(aggMap.values());

    return {
      productSalesList: list,
      totalCartons: grandCartons,
      totalPacks: grandPacks,
      totalRetail: grandRetail,
      totalRevenue: grandRevenue,
    };
  }, [filteredTransactions, productMap]);

  // 6. Filter by Search Query & Sort
  const displayedProducts = useMemo(() => {
    let result = productSalesList;

    const q = normalizeLao(searchTerm);
    if (q) {
      result = result.filter(
        (p) =>
          (p.name && normalizeLao(p.name).includes(q)) ||
          (p.barcode && normalizeLao(p.barcode).includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      switch (sortField) {
        case 'name':
          return sortDirection === 'asc'
            ? a.name.localeCompare(b.name, 'lo')
            : b.name.localeCompare(a.name, 'lo');
        case 'carton':
          valA = a.cartonQty;
          valB = b.cartonQty;
          break;
        case 'pack':
          valA = a.packQty;
          valB = b.packQty;
          break;
        case 'retail':
          valA = a.retailQty;
          valB = b.retailQty;
          break;
        case 'revenue':
        default:
          valA = a.revenue;
          valB = b.revenue;
          break;
      }

      if (valA === valB) {
        return b.revenue - a.revenue;
      }

      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [productSalesList, searchTerm, sortField, sortDirection]);

  // Calculate THB equivalent if exchange rate available
  const bahtEquivalent = exchangeRate > 0 ? Math.round(totalRevenue / exchangeRate) : 0;

  // Render sort icon on table headers
  const renderSortIndicator = (field) => {
    if (sortField !== field) {
      return <ArrowsDownUp size={13} className="text-slate-300 group-hover:text-slate-500 transition-colors" />;
    }
    return sortDirection === 'asc' ? (
      <CaretUp size={14} weight="bold" className="text-teal-600" />
    ) : (
      <CaretDown size={14} weight="bold" className="text-teal-600" />
    );
  };

  // CSV Export handler
  const handleExportCSV = () => {
    if (!displayedProducts.length) return;
    const headers = ['ລຳດັບ', 'ຊື່ສິນຄ້າ', 'ບາໂຄດ', 'ຂາຍແກັດ', 'ຂາຍແພັກ', 'ຂາຍຍ່ອຍ', 'ຍອດຂາຍລວມ(ກີບ)'];
    const rows = displayedProducts.map((p, idx) => [
      idx + 1,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.barcode || ''}"`,
      p.cartonQty > 0 ? `${p.cartonQty} ${p.cartonUnitName}` : '0',
      p.packQty > 0 ? `${p.packQty} ${p.packUnitName}` : '0',
      p.retailQty > 0 ? `${p.retailQty} ${p.retailUnitName}` : '0',
      p.revenue
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sales_by_unit_${timeframe}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-50 font-sans overflow-hidden select-none">
      {/* 1. TOP HEADER & FILTER BAR */}
      <div className="bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3.5 shrink-0 shadow-2xs z-10">
        <div className="flex items-center justify-between gap-2.5 sm:gap-3">
          {/* Title & Description */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0 border border-teal-100">
              <ChartPieSlice size={20} className="sm:w-5 sm:h-5" weight="duotone" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="truncate">
                  <span className="sm:hidden">ລາຍງານຂາຍຕາມຫົວໜ່ວຍ</span>
                  <span className="hidden sm:inline">ລາຍງານຂາຍຕາມຫົວໜ່ວຍ (Sales by Unit)</span>
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                  {filteredTransactions.length} ບິນ
                </span>
              </h2>
              <p className="text-[11.5px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
                ສະຫຼຸບຍອດຂາຍຕາມຂັ້ນຫົວໜ່ວຍ: ແກັດ, ແພັກ, ອັນ ແລະ ລາຍຮັບແຍກແຕ່ລະສິນຄ້າ
              </p>
            </div>
          </div>

          {/* Right Actions: Export CSV, Print & Refresh Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={displayedProducts.length === 0}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-teal-700 text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
              title="ສົ່ງອອກໄຟລ໌ Excel / CSV"
            >
              <Export size={15} weight="bold" />
              <span className="hidden md:inline">Excel/CSV</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={displayedProducts.length === 0}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-teal-700 text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
              title="ພິມລາຍງານ"
            >
              <Printer size={15} weight="bold" />
              <span className="hidden md:inline">ພິມ</span>
            </button>

            {/* Refresh Button */}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-teal-700 text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                title="ໂຫຼດຂໍ້ມູນໃໝ່"
              >
                <ArrowClockwise size={15} weight="bold" className={isLoading ? 'animate-spin text-teal-600' : ''} />
                <span className="hidden sm:inline">ຣີເຟຣຊ</span>
              </button>
            )}
          </div>
        </div>

        {/* 1.1 FILTER TOOLBAR (Timeframe Pills + Search Bar) */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Timeframe Filter Segmented Control */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl overflow-x-auto no-scrollbar shrink-0 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setTimeframe('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                timeframe === 'today'
                  ? 'bg-white text-teal-800 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ມື້ນີ້ (Today)
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('yesterday')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                timeframe === 'yesterday'
                  ? 'bg-white text-teal-800 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ມື້ວານ (Yesterday)
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('7days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                timeframe === '7days'
                  ? 'bg-white text-teal-800 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 ມື້ຜ່ານມາ (7 Days)
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                timeframe === 'month'
                  ? 'bg-white text-teal-800 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ເດືອນນີ້ (This Month)
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer inline-flex items-center gap-1 ${
                timeframe === 'custom'
                  ? 'bg-white text-teal-800 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarBlank size={14} weight="bold" />
              <span>ກຳນົດເອງ</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 md:max-w-xs">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              weight="bold"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ / ບາໂຄດ..."
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
        </div>

        {/* 1.2 Custom Date Pickers Drawer (when 'custom' is active) */}
        {timeframe === 'custom' && (
          <div className="mt-2.5 p-2.5 bg-teal-50/50 border border-teal-100 rounded-xl flex flex-wrap items-center gap-3 text-xs animate-in fade-in duration-150">
            <span className="font-bold text-teal-900">ເລືອກຊ່ວງວັນທີ:</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">ແຕ່ວັນທີ:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">ຫາວັນທີ:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-mono text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-teal-700 hover:text-teal-900 font-bold ml-auto text-xs cursor-pointer"
              >
                ລ້າງວັນທີ
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. MAIN SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        {/* 2.1 4 COMPACT STATS CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Total Cartons */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 truncate">
                ຂາຍຕາມແກັດ (Cartons)
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center shrink-0">
                <Package size={18} weight="bold" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight font-mono">
                {formatDots(totalCartons)}{' '}
                <span className="text-xs font-bold text-slate-500 font-sans">ແກັດ</span>
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                ຫົວໜ່ວຍຍົກລັງ / ແກັດໃຫຍ່
              </div>
            </div>
          </div>

          {/* Card 2: Total Packs */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 truncate">
                ຂາຍຕາມແພັກ (Packs)
              </span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 border border-sky-200/70 flex items-center justify-center shrink-0">
                <SquaresFour size={18} weight="bold" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight font-mono">
                {formatDots(totalPacks)}{' '}
                <span className="text-xs font-bold text-slate-500 font-sans">ແພັກ</span>
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                ຫົວໜ່ວຍຂາຍກາງ / ແພັກ
              </div>
            </div>
          </div>

          {/* Card 3: Total Retail Units */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 truncate">
                ຂາຍຍ່ອຍ (Retail Units)
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/70 flex items-center justify-center shrink-0">
                <Tag size={18} weight="bold" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight font-mono">
                {formatDots(totalRetail)}{' '}
                <span className="text-xs font-bold text-slate-500 font-sans">ອັນ</span>
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                ຫົວໜ່ວຍຍ່ອຍສຸດ / ປ໋ອງ / ແກ້ວ
              </div>
            </div>
          </div>

          {/* Card 4: Total Revenue */}
          <div className="bg-white border border-teal-200/90 rounded-2xl p-3.5 shadow-2xs ring-2 ring-teal-50/50 hover:border-teal-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-800 truncate">
                ລວມຍອດຂາຍ (Total Revenue)
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0">
                <CurrencyCircleDollar size={18} weight="fill" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl md:text-2xl font-black text-teal-700 tracking-tight font-mono">
                {formatKip(totalRevenue)}
              </div>
              {bahtEquivalent > 0 && (
                <div className="text-[11px] font-bold text-amber-600 mt-0.5 font-mono">
                  ≈ {formatBaht(bahtEquivalent)}{' '}
                  <span className="text-[10px] text-slate-400 font-sans font-normal">(1฿ = {exchangeRate}₭)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2.2 SALES DETAILS COMPACT TABLE */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
          {/* Table Header Bar */}
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                ລາຍການສິນຄ້າ ({displayedProducts.length} ລາຍການ)
              </span>
            </div>
            <div className="text-xs text-slate-400 font-medium">
              ຄລິກຫົວຂໍ້ຕາຕະລາງເພື່ອຈັດລຽງ
            </div>
          </div>

          {/* Table Body */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider select-none">
                  {/* Col 1: Product Name & Image */}
                  <th
                    onClick={() => handleSort('name')}
                    className="py-2.5 px-4 cursor-pointer hover:bg-slate-100/70 transition-colors group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>ສິນຄ້າ (Product)</span>
                      {renderSortIndicator('name')}
                    </div>
                  </th>

                  {/* Col 2: Carton Qty */}
                  <th
                    onClick={() => handleSort('carton')}
                    className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-100/70 transition-colors group"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>ຂາຍແກັດ (Carton)</span>
                      {renderSortIndicator('carton')}
                    </div>
                  </th>

                  {/* Col 3: Pack Qty */}
                  <th
                    onClick={() => handleSort('pack')}
                    className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-100/70 transition-colors group"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>ຂາຍແພັກ (Pack)</span>
                      {renderSortIndicator('pack')}
                    </div>
                  </th>

                  {/* Col 4: Retail Qty */}
                  <th
                    onClick={() => handleSort('retail')}
                    className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-100/70 transition-colors group"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>ຂາຍຍ່ອຍ (Retail)</span>
                      {renderSortIndicator('retail')}
                    </div>
                  </th>

                  {/* Col 5: Total Revenue */}
                  <th
                    onClick={() => handleSort('revenue')}
                    className="py-2.5 px-4 text-right cursor-pointer hover:bg-slate-100/70 transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>ຍອດຂາຍລວມ (Total Revenue)</span>
                      {renderSortIndicator('revenue')}
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F5F9]">
                {displayedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                        <Package size={24} weight="duotone" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">
                        ບໍ່ພົບລາຍການຂາຍໃນຊ່ວງເວລານີ້
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {searchTerm
                          ? `ບໍ່ພົບສິນຄ້າທີ່ກົງກັບ "${searchTerm}"`
                          : 'ລອງປ່ຽນຊ່ວງວັນທີ ຫຼື ຂາຍສິນຄ້າໃນໜ້າ POS'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  displayedProducts.map((p) => {
                    const hasCarton = p.cartonQty > 0;
                    const hasPack = p.packQty > 0;
                    const hasRetail = p.retailQty > 0;

                    return (
                      <tr
                        key={p.id}
                        className="h-[50px] hover:bg-slate-50/80 transition-colors text-xs"
                      >
                        {/* Col 1: Product Thumbnail & Name */}
                        <td className="py-1.5 px-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Product Thumbnail (36x36px rounded 6px) */}
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-9 h-9 rounded-[6px] object-cover bg-slate-100 border border-slate-200/80 shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div
                              className="w-9 h-9 rounded-[6px] bg-slate-100 border border-slate-200/80 items-center justify-center text-slate-400 shrink-0"
                              style={{ display: p.imageUrl ? 'none' : 'flex' }}
                            >
                              <Package size={18} weight="bold" />
                            </div>

                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 text-xs md:text-sm truncate max-w-[200px] md:max-w-xs leading-snug">
                                {p.name}
                              </div>
                              {p.barcode ? (
                                <div className="text-[10px] font-mono text-slate-400 truncate leading-none mt-0.5">
                                  {p.barcode}
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400 leading-none mt-0.5">
                                  {p.orderCount} ຄັ້ງທີ່ຂາຍ
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Col 2: Carton Qty (Centered) */}
                        <td className="py-1.5 px-3 text-center tabular-nums whitespace-nowrap">
                          {hasCarton ? (
                            <span className="font-bold text-slate-900 bg-amber-50/70 border border-amber-200/60 px-2 py-0.5 rounded-md text-xs font-mono inline-block">
                              {formatDots(p.cartonQty)}{' '}
                              <span className="font-sans text-[11px] text-amber-900 font-semibold">
                                {p.cartonUnitName}
                              </span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center justify-center w-6 h-5 rounded-md bg-slate-100/80 border border-slate-200/70 text-slate-400 select-none shadow-2xs"
                              title="ຍັງບໍ່ມີຍອດຂາຍ (0)"
                            >
                              <Minus size={11} weight="bold" />
                            </span>
                          )}
                        </td>

                        {/* Col 3: Pack Qty (Centered) */}
                        <td className="py-1.5 px-3 text-center tabular-nums whitespace-nowrap">
                          {hasPack ? (
                            <span className="font-bold text-slate-900 bg-sky-50/70 border border-sky-200/60 px-2 py-0.5 rounded-md text-xs font-mono inline-block">
                              {formatDots(p.packQty)}{' '}
                              <span className="font-sans text-[11px] text-sky-900 font-semibold">
                                {p.packUnitName}
                              </span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center justify-center w-6 h-5 rounded-md bg-slate-100/80 border border-slate-200/70 text-slate-400 select-none shadow-2xs"
                              title="ຍັງບໍ່ມີຍອດຂາຍ (0)"
                            >
                              <Minus size={11} weight="bold" />
                            </span>
                          )}
                        </td>

                        {/* Col 4: Retail Qty (Centered) */}
                        <td className="py-1.5 px-3 text-center tabular-nums whitespace-nowrap">
                          {hasRetail ? (
                            <span className="font-bold text-slate-900 bg-slate-100 border border-slate-200/70 px-2 py-0.5 rounded-md text-xs font-mono inline-block">
                              {formatDots(p.retailQty)}{' '}
                              <span className="font-sans text-[11px] text-slate-700 font-semibold">
                                {p.retailUnitName}
                              </span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center justify-center w-6 h-5 rounded-md bg-slate-100/80 border border-slate-200/70 text-slate-400 select-none shadow-2xs"
                              title="ຍັງບໍ່ມີຍອດຂາຍ (0)"
                            >
                              <Minus size={11} weight="bold" />
                            </span>
                          )}
                        </td>

                        {/* Col 5: Total Revenue */}
                        <td className="py-1.5 px-4 text-right tabular-nums whitespace-nowrap">
                          <span className="font-black text-teal-700 text-xs md:text-sm font-mono">
                            {formatKip(p.revenue)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Footer Summary Row */}
              {displayedProducts.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100/80 border-t-2 border-slate-200 font-extrabold text-xs text-slate-800">
                    <td className="py-3 px-4">
                      <span>ລວມທັງໝົດ ({displayedProducts.length} ລາຍການ):</span>
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums text-amber-900 font-mono">
                      {totalCartons > 0 ? (
                        `${formatDots(totalCartons)} ແກັດ`
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-5 rounded-md bg-slate-200/60 text-slate-400">
                          <Minus size={11} weight="bold" />
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums text-sky-900 font-mono">
                      {totalPacks > 0 ? (
                        `${formatDots(totalPacks)} ແພັກ`
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-5 rounded-md bg-slate-200/60 text-slate-400">
                          <Minus size={11} weight="bold" />
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums text-slate-900 font-mono">
                      {totalRetail > 0 ? (
                        `${formatDots(totalRetail)} ອັນ`
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-5 rounded-md bg-slate-200/60 text-slate-400">
                          <Minus size={11} weight="bold" />
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-mono text-teal-800 font-black text-sm">
                      {formatKip(totalRevenue)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
