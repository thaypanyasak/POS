import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  CaretLeft,
  CaretRight,
  ArrowsDownUp,
  ChartPieSlice,
  Printer,
  Minus,
  FileArrowDown,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import { exportSalesByUnitToExcel } from '../../utils/excelExport';
import { formatKip, formatDots, normalizeLao } from '../../utils/formatters';
import { playUnitChangeBeep, playActionClickBeep } from '../../utils/audioFeedback';
import { SalesByUnitSkeleton } from '../common/SkeletonLoaders';

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

/**
 * Determine default unit names for a catalog product
 */
function getProductDefaultUnits(prod) {
  let cUnitName = prod?.cartonUnitName;
  let pUnitName = prod?.packUnitName;
  let rUnitName = prod?.pieceUnitName || prod?.baseUnit || 'ອັນ';

  if (Array.isArray(prod?.units)) {
    prod.units.forEach((u) => {
      const lvl = classifyUnitLevel(u.unitName, u.multiplier, prod);
      if (lvl === 3 && !cUnitName) cUnitName = u.unitName;
      if (lvl === 2 && !pUnitName) pUnitName = u.unitName;
      if (lvl === 1 && !rUnitName) rUnitName = u.unitName;
    });
  }
  return {
    cartonUnitName: cUnitName || 'ແກັດ',
    packUnitName: pUnitName || 'ແພັກ',
    retailUnitName: rUnitName || 'ອັນ',
  };
}

export default function SalesByUnitReportView({
  transactions = [],
  products = [],
  exchangeRate = 690,
  onRefresh,
  isLoading = false,
  onAlert,
}) {
  // 1. View Mode Filter: 'all' (Tất cả - Mặc định) | 'sold' (Đã bán) | 'unsold' (Chưa được bán)
  const [viewMode, setViewMode] = useState('all');

  // 1.1 Timeframe States
  // 'today' | 'yesterday' | '7days' | 'month' | 'custom'
  const [timeframe, setTimeframe] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // 2. Sort State: 'revenue' | 'carton' | 'pack' | 'retail' | 'name'
  const [sortField, setSortField] = useState('revenue');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  // 2.1 Pagination States (identical to HistoryView & ProductsView)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20); // 20 | 50 | 100 | 200 | 'ALL'
  const mainScrollRef = useRef(null);
  const tableTopRef = useRef(null);

  const scrollToTableTop = () => {
    tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (mainScrollRef.current) {
      const targetTop = tableTopRef.current ? Math.max(0, tableTopRef.current.offsetTop - 16) : 0;
      mainScrollRef.current.scrollTo({ top: targetTop, behavior: 'smooth' });
    }
  };

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

  // 3.1 All-Time Sold Product IDs (Across all non-cancelled transactions, ignoring date filter)
  const allTimeSoldProductIds = useMemo(() => {
    const set = new Set();
    transactions.forEach((tx) => {
      const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
      if (isCancelled) return;
      const items = (tx.items && tx.items.length > 0)
        ? tx.items
        : (tx.sale_transaction_items || []);

      items.forEach((item) => {
        const prodId = item.productId || item.product?.id || item.product_id;
        if (prodId) set.add(prodId);
        if (item.bundle_components || item.bundleComponents) {
          (item.bundle_components || item.bundleComponents).forEach((c) => {
            const compId = c.productId || c.product?.id || c.product_id;
            if (compId) set.add(compId);
          });
        }
      });
    });
    return set;
  }, [transactions]);

  // 4. Date Range Filtering of Transactions (only for sold & all modes)
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
        case 'all':
          return true;
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
  const {
    allProductsList,
    soldProductsList,
    unsoldProductsList,
    totalCartons,
    totalPacks,
    totalRetail,
    totalRevenue,
    totalUnsoldStock,
  } = useMemo(() => {
    // Map of sales in filteredTransactions: productId -> aggregated sales
    const aggMap = new Map();

    let grandCartons = 0;
    let grandPacks = 0;
    let grandRetail = 0;
    let grandRevenue = 0;

    filteredTransactions.forEach((tx) => {
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

        const unitLevel = classifyUnitLevel(unitName, multiplier, prodInfo);
        const defaultUnits = getProductDefaultUnits(prodInfo);
        const cUnitName = prodInfo.cartonUnitName || (unitLevel === 3 ? unitName : defaultUnits.cartonUnitName);
        const pUnitName = prodInfo.packUnitName || (unitLevel === 2 ? unitName : defaultUnits.packUnitName);
        const rUnitName = prodInfo.pieceUnitName || (unitLevel === 1 ? unitName : defaultUnits.retailUnitName);

        const isTrackStock = prodInfo.trackStock !== false && prodInfo.track_stock !== false;

        if (!aggMap.has(prodId)) {
          aggMap.set(prodId, {
            id: prodId,
            name: rawName,
            name_vi: prodInfo.name_vi || prodInfo.nameVi || prodInfo.vietnameseName || '',
            barcode: rawBarcode,
            category: prodInfo.category || prodInfo.categoryName || prodInfo.category_name || 'ທົ່ວໄປ',
            imageUrl: rawImage,
            cartonUnitName: cUnitName,
            packUnitName: pUnitName,
            retailUnitName: rUnitName,
            cartonQty: 0,
            packQty: 0,
            retailQty: 0,
            totalBaseUnits: 0,
            revenue: 0,
            orderCount: 0,
            currentStock: Number(prodInfo.currentStockBaseUnits ?? prodInfo.current_stock_base_units ?? 0),
            trackStock: isTrackStock,
            baseUnit: prodInfo.baseUnit || 'ອັນ',
            hasEverSold: true,
          });
        }

        const entry = aggMap.get(prodId);
        entry.revenue += lineTotal;
        entry.orderCount += 1;
        entry.totalBaseUnits += qty * (multiplier > 0 ? multiplier : 1);
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

    // 1. Build all products list combining all products in catalog
    const fullMap = new Map(aggMap);

    // Merge in all catalog products that didn't have sales in this timeframe
    products.forEach((p) => {
      if (!p || !p.id) return;
      const defaultUnits = getProductDefaultUnits(p);
      const isEverSold = allTimeSoldProductIds.has(p.id);
      const isTrackStock = p.trackStock !== false && p.track_stock !== false;

      if (!fullMap.has(p.id)) {
        fullMap.set(p.id, {
          id: p.id,
          name: p.name || 'ສິນຄ້າບໍ່ມີຊື່',
          name_vi: p.name_vi || p.nameVi || p.vietnameseName || '',
          barcode: p.barcode || '',
          category: p.category || p.categoryName || 'ທົ່ວໄປ',
          imageUrl: p.imageUrl || p.image_url || '',
          cartonUnitName: defaultUnits.cartonUnitName,
          packUnitName: defaultUnits.packUnitName,
          retailUnitName: defaultUnits.retailUnitName,
          cartonQty: 0,
          packQty: 0,
          retailQty: 0,
          totalBaseUnits: 0,
          revenue: 0,
          orderCount: 0,
          currentStock: Number(p.currentStockBaseUnits ?? p.current_stock_base_units ?? 0),
          trackStock: isTrackStock,
          baseUnit: p.baseUnit || 'ອັນ',
          hasEverSold: isEverSold,
        });
      } else {
        const entry = fullMap.get(p.id);
        entry.currentStock = Number(p.currentStockBaseUnits ?? p.current_stock_base_units ?? 0);
        entry.trackStock = isTrackStock;
        entry.baseUnit = p.baseUnit || 'ອັນ';
        entry.hasEverSold = isEverSold;
      }
    });

    const allProductsList = Array.from(fullMap.values());

    // 2. Filter Sold Products in this timeframe
    const soldProductsList = allProductsList.filter(
      (p) => p.revenue > 0 || p.cartonQty > 0 || p.packQty > 0 || p.retailQty > 0
    );

    // 3. Filter Unsold Products all-time (KHÔNG filter theo ngày, hiển thị tất cả hàng chưa bán)
    let totalUnsoldStock = 0;
    const unsoldProductsList = [];
    products.forEach((p) => {
      if (!p || !p.id) return;
      if (!allTimeSoldProductIds.has(p.id)) {
        const defaultUnits = getProductDefaultUnits(p);
        const isTrackStock = p.trackStock !== false && p.track_stock !== false;
        const stock = Number(p.currentStockBaseUnits ?? p.current_stock_base_units ?? 0);
        if (isTrackStock) {
          totalUnsoldStock += stock;
        }
        unsoldProductsList.push({
          id: p.id,
          name: p.name || 'ສິນຄ້າບໍ່ມີຊື່',
          name_vi: p.name_vi || p.nameVi || p.vietnameseName || '',
          barcode: p.barcode || '',
          category: p.category || p.categoryName || 'ທົ່ວໄປ',
          imageUrl: p.imageUrl || p.image_url || '',
          cartonUnitName: defaultUnits.cartonUnitName,
          packUnitName: defaultUnits.packUnitName,
          retailUnitName: defaultUnits.retailUnitName,
          cartonQty: 0,
          packQty: 0,
          retailQty: 0,
          totalBaseUnits: 0,
          revenue: 0,
          orderCount: 0,
          currentStock: stock,
          trackStock: isTrackStock,
          baseUnit: p.baseUnit || 'ອັນ',
          hasEverSold: false,
        });
      }
    });

    return {
      allProductsList,
      soldProductsList,
      unsoldProductsList,
      totalCartons: grandCartons,
      totalPacks: grandPacks,
      totalRetail: grandRetail,
      totalRevenue: grandRevenue,
      totalUnsoldStock,
    };
  }, [filteredTransactions, productMap, products, allTimeSoldProductIds]);

  // Selected base list based on viewMode ('all' | 'sold' | 'unsold')
  const baseListByViewMode = useMemo(() => {
    switch (viewMode) {
      case 'sold':
        return soldProductsList;
      case 'unsold':
        return unsoldProductsList;
      case 'all':
      default:
        return allProductsList;
    }
  }, [viewMode, allProductsList, soldProductsList, unsoldProductsList]);

  // 6. Filter by Search Query & Sort
  const displayedProducts = useMemo(() => {
    let result = [...baseListByViewMode];

    const q = normalizeLao(searchTerm);
    if (q) {
      result = result.filter(
        (p) =>
          (p.name && normalizeLao(p.name).includes(q)) ||
          (p.barcode && normalizeLao(p.barcode).includes(q)) ||
          (p.category && normalizeLao(p.category).includes(q))
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
        if (viewMode === 'unsold') {
          return b.currentStock - a.currentStock || a.name.localeCompare(b.name, 'lo');
        }
        return b.revenue - a.revenue || a.name.localeCompare(b.name, 'lo');
      }

      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [baseListByViewMode, searchTerm, sortField, sortDirection, viewMode]);

  // 7. Pagination Logic (Seamless with HistoryView & ProductsView)
  const totalItems = displayedProducts.length;
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedProducts = useMemo(() => {
    if (pageSize === 'ALL') return displayedProducts;
    const start = (safeCurrentPage - 1) * pageSize;
    return displayedProducts.slice(start, start + pageSize);
  }, [displayedProducts, safeCurrentPage, pageSize]);

  // Reset pagination to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, timeframe, customStartDate, customEndDate, sortField, sortDirection, viewMode, pageSize]);

  // Smart page numbers algorithm (identical to HistoryView & ProductsView)
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    pages.push(1);
    if (safeCurrentPage > 3) {
      pages.push('...');
    }
    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(totalPages - 1, safeCurrentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (safeCurrentPage < totalPages - 2) {
      pages.push('...');
    }
    pages.push(totalPages);
    return pages;
  };

  const handlePageChange = (newPage) => {
    if (newPage === safeCurrentPage || newPage < 1 || newPage > totalPages) return;
    playUnitChangeBeep('sales_report');
    setCurrentPage(newPage);
    scrollToTableTop();
  };

  const handlePageSizeChange = (newSize) => {
    playUnitChangeBeep('sales_report');
    setPageSize(newSize);
    setCurrentPage(1);
    scrollToTableTop();
  };

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

  // Excel Export handler (.xlsx)
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const handleExportExcel = async () => {
    if (!displayedProducts || displayedProducts.length === 0) return;
    try {
      setIsExportingExcel(true);
      playActionClickBeep('reports');
      const tfMap = {
        today: 'ມື້ນີ້ (Today)',
        yesterday: 'ມື້ວານ (Yesterday)',
        '7days': '7 ມື້ຜ່ານມາ (Last 7 Days)',
        month: 'ເດືອນນີ້ (This Month)',
        all: 'ທັງໝົດ (All Time)',
        custom: `${customStartDate || '...'} ຫາ ${customEndDate || '...'}`,
      };
      const modeLabel =
        viewMode === 'unsold'
          ? 'ສິນຄ້າບໍ່ທັນຂາຍ (Unsold)'
          : viewMode === 'sold'
          ? 'ຂາຍແລ້ວ (Sold)'
          : 'ທັງໝົດ (All)';

      const periodLabel =
        viewMode === 'unsold'
          ? 'ສິນຄ້າບໍ່ທັນຂາຍ (All-Time Unsold)'
          : `${tfMap[timeframe] || timeframe} • ${modeLabel}`;

      const res = await exportSalesByUnitToExcel(displayedProducts, {
        timeframeLabel: periodLabel,
        totalTransactions: viewMode === 'unsold' ? 0 : filteredTransactions.length,
        totalRevenue: viewMode === 'unsold' ? 0 : totalRevenue,
      });
      if (res?.success && onAlert) {
        onAlert(`ສົ່ງອອກໄຟລ໌ ${res.fileName || 'Excel'} ສຳເລັດແລ້ວ!`, 'ສຳເລັດ', 'success');
      }
    } catch (err) {
      console.error('Export sales by unit error:', err);
      if (onAlert) {
        onAlert(`ເກີດຂໍ້ຜິດພາດໃນການສົ່ງອອກ Excel: ${err.message || 'ລອງໃໝ່ອີກຄັ້ງ'}`, 'ແຈ້ງເຕືອນ', 'error');
      }
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-50 font-sans overflow-hidden select-none">
      {/* 1. TOP HEADER & FILTER BAR */}
      <div className="bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3 shrink-0 shadow-2xs z-10">
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
                  {viewMode === 'unsold' ? 'ບໍ່ກັ່ນຕອງວັນທີ' : `${filteredTransactions.length} ບິນ`}
                </span>
              </h2>
              <p className="text-[11.5px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
                ສະຫຼຸບຍອດຂາຍຕາມຂັ້ນຫົວໜ່ວຍ: ແກັດ, ແພັກ, ອັນ ແລະ ລາຍຮັບແຍກແຕ່ລະສິນຄ້າ
              </p>
            </div>
          </div>

          {/* Right Actions: Export Excel, Print & Refresh Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Export Excel Button (.xlsx) */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel || displayedProducts.length === 0}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
              title="ສົ່ງອອກໄຟລ໌ Excel (.xlsx)"
            >
              <FileArrowDown size={15} weight="bold" />
              <span className="hidden md:inline">Export Excel</span>
              <span className="md:hidden">Excel</span>
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

        {/* 1.1 VIEW MODE TABS + SEARCH ROW */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* View Mode Segmented Control: ທັງໝົດ (All - Mặc định) | ຂາຍແລ້ວ (Sold) | ບໍ່ທັນຂາຍ (Unsold) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0 overflow-x-auto no-scrollbar">
            {/* Tab 1: ທັງໝົດ (All - Default) */}
            <button
              type="button"
              onClick={() => {
                playUnitChangeBeep('sales_report');
                setViewMode('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'all'
                  ? 'bg-white text-teal-800 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SquaresFour size={15} weight="bold" />
              <span>ທັງໝົດ</span>
              <span
                className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-mono ${
                  viewMode === 'all'
                    ? 'bg-teal-100 text-teal-800 font-black'
                    : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {allProductsList.length}
              </span>
            </button>

            {/* Tab 2: ຂາຍແລ້ວ (Sold) */}
            <button
              type="button"
              onClick={() => {
                playUnitChangeBeep('sales_report');
                setViewMode('sold');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'sold'
                  ? 'bg-white text-emerald-800 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag size={15} weight="bold" />
              <span>ຂາຍແລ້ວ</span>
              <span
                className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-mono ${
                  viewMode === 'sold'
                    ? 'bg-emerald-100 text-emerald-800 font-black'
                    : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {soldProductsList.length}
              </span>
            </button>

            {/* Tab 3: ບໍ່ທັນຂາຍ (Unsold - Không filter theo ngày) */}
            <button
              type="button"
              onClick={() => {
                playUnitChangeBeep('sales_report');
                setViewMode('unsold');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'unsold'
                  ? 'bg-white text-rose-800 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package size={15} weight="bold" />
              <span>ບໍ່ທັນຂາຍ</span>
              <span
                className={`text-[10.5px] px-1.5 py-0.2 rounded-full font-mono ${
                  viewMode === 'unsold'
                    ? 'bg-rose-100 text-rose-800 font-black'
                    : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {unsoldProductsList.length}
              </span>
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
              placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ / ບາໂຄດ / ໝວດໝູ່..."
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

        {/* 1.2 TIMEFRAME TOOLBAR (When NOT in 'unsold' mode) OR Unsold Alert Banner */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          {viewMode === 'unsold' ? (
            /* Special Unsold Info Banner (No date filter) */
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <ClockCounterClockwise size={15} weight="bold" className="shrink-0 text-amber-600" />
              <span>
                ໂໝດສິນຄ້າບໍ່ທັນຂາຍ: ສະແດງທຸກສິນຄ້າທີ່ບໍ່ເຄີຍມີຍອດຂາຍ (ສະແດງທັງໝົດ ບໍ່ກັ່ນຕອງຕາມວັນທີ)
              </span>
            </div>
          ) : (
            /* Timeframe Filter Segmented Control */
            <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl overflow-x-auto no-scrollbar shrink-0 border border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  playUnitChangeBeep('sales_report');
                  setTimeframe('all');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  timeframe === 'all'
                    ? 'bg-white text-teal-800 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ທັງໝົດ (All)
              </button>
              <button
                type="button"
                onClick={() => {
                  playUnitChangeBeep('sales_report');
                  setTimeframe('today');
                }}
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
                onClick={() => {
                  playUnitChangeBeep('sales_report');
                  setTimeframe('yesterday');
                }}
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
                onClick={() => {
                  playUnitChangeBeep('sales_report');
                  setTimeframe('7days');
                }}
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
                onClick={() => {
                  playUnitChangeBeep('sales_report');
                  setTimeframe('month');
                }}
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
                onClick={() => {
                  playUnitChangeBeep('sales_report');
                  setTimeframe('custom');
                }}
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
          )}
        </div>

        {/* 1.3 Custom Date Pickers Drawer (when 'custom' is active and NOT in 'unsold' mode) */}
        {viewMode !== 'unsold' && timeframe === 'custom' && (
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
      <div
        ref={mainScrollRef}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-6 min-h-0"
      >
        {/* 2.1 4 COMPACT STATS CARDS */}
        {viewMode === 'unsold' ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {/* Card 1: Unsold Products Count */}
            <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-black shrink-0">
                <Package size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] text-rose-600 font-bold uppercase tracking-wider truncate">
                  ສິນຄ້າບໍ່ທັນຂາຍ
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 font-mono truncate">
                  {formatDots(unsoldProductsList.length)}{' '}
                  <span className="text-xs font-bold font-sans text-slate-500">ລາຍການ</span>
                </div>
              </div>
            </div>

            {/* Card 2: Total Unsold Stock Units */}
            <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black shrink-0">
                <SquaresFour size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] text-amber-600 font-bold uppercase tracking-wider truncate">
                  ສະຕັອກຄົງເຫຼືອ
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 font-mono truncate">
                  {formatDots(totalUnsoldStock)}{' '}
                  <span className="text-xs font-bold font-sans text-slate-500">ໜ່ວຍ</span>
                </div>
              </div>
            </div>

            {/* Card 3: Status */}
            <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-black shrink-0">
                <ClockCounterClockwise size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-wider truncate">
                  ປະຫວັດການຂາຍ
                </div>
                <div className="text-sm sm:text-base font-extrabold text-slate-800 truncate">
                  ບໍ່ເຄີຍມີບິນ (0 ບິນ)
                </div>
              </div>
            </div>

            {/* Card 4: Revenue */}
            <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-black shrink-0">
                <CurrencyCircleDollar size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] text-teal-600 font-bold uppercase tracking-wider truncate">
                  ຍອດຂາຍ
                </div>
                <div className="text-base sm:text-lg font-black text-teal-900 font-mono truncate">
                  0 ₭
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {/* Card 1: Total Cartons */}
            <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black shrink-0">
                <Package size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] text-amber-600 font-bold uppercase tracking-wider truncate">
                  ຂາຍຕາມແກັດ
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 font-mono truncate">
                  {formatDots(totalCartons)}{' '}
                  <span className="text-xs font-bold font-sans text-slate-500">ແກັດ</span>
                </div>
              </div>
            </div>

            {/* Card 2: Total Packs */}
            <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-black shrink-0">
                <SquaresFour size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] text-sky-600 font-bold uppercase tracking-wider truncate">
                  ຂາຍຕາມແພັກ
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 font-mono truncate">
                  {formatDots(totalPacks)}{' '}
                  <span className="text-xs font-bold font-sans text-slate-500">ແພັກ</span>
                </div>
              </div>
            </div>

            {/* Card 3: Total Retail Units */}
            <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black shrink-0">
                <Tag size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] text-indigo-600 font-bold uppercase tracking-wider truncate">
                  ຂາຍຍ່ອຍ
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 font-mono truncate">
                  {formatDots(totalRetail)}{' '}
                  <span className="text-xs font-bold font-sans text-slate-500">ອັນ</span>
                </div>
              </div>
            </div>

            {/* Card 4: Total Revenue */}
            <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-black shrink-0">
                <CurrencyCircleDollar size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] text-teal-600 font-bold uppercase tracking-wider truncate">
                  ລວມຍອດຂາຍ
                </div>
                <div className="text-base sm:text-lg font-black text-teal-900 font-mono truncate">
                  {formatKip(totalRevenue)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor for pagination scroll-to-top (identical to ProductsView) */}
        <div ref={tableTopRef} className="scroll-mt-3 sm:scroll-mt-4" />

        {/* 2.2 SALES DETAILS TABLE & PAGINATION CONTAINER */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
          {/* Table Header Bar */}
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/60 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                ລາຍການສິນຄ້າ ({displayedProducts.length} ລາຍການ
                {pageSize !== 'ALL' && totalPages > 1 ? ` • ໜ້າ ${safeCurrentPage}/${totalPages}` : ''})
              </span>
              {viewMode === 'unsold' && (
                <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                  ສິນຄ້າບໍ່ທັນຂາຍ (0 ບິນ)
                </span>
              )}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-400 font-medium">
              <span className="hidden sm:inline">ຄລິກຫົວຂໍ້ຕາຕະລາງເພື່ອຈັດລຽງ</span>
              <span className="sm:hidden">
                ຈັດລຽງຕາມ
                {sortField === 'name'
                  ? 'ຊື່'
                  : sortField === 'carton'
                  ? 'ແກັດ'
                  : sortField === 'pack'
                  ? 'ແພັກ'
                  : sortField === 'retail'
                  ? 'ຍ່ອຍ'
                  : 'ຍອດຂາຍ'}
              </span>
            </div>
          </div>

          {/* Mobile Product Card List (md:hidden) */}
          <div className="block md:hidden">
            {isLoading && transactions.length === 0 ? (
              <div className="p-4 space-y-3">
                <SalesByUnitSkeleton count={4} />
              </div>
            ) : paginatedProducts.length === 0 ? (
              <div className="py-12 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <Package size={24} weight="duotone" />
                </div>
                <p className="text-xs font-bold text-slate-700">
                  {viewMode === 'unsold'
                    ? 'ບໍ່ພົບສິນຄ້າທີ່ບໍ່ທັນຂາຍ'
                    : 'ບໍ່ພົບລາຍການຂາຍໃນຊ່ວງເວລານີ້'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {searchTerm
                    ? `ບໍ່ພົບສິນຄ້າທີ່ກົງກັບ "${searchTerm}"`
                    : viewMode === 'unsold'
                    ? 'ດີຫຼາຍ! ສິນຄ້າທຸກລາຍການເຄີຍມີຍອດຂາຍແລ້ວ'
                    : 'ລອງປ່ຽນຊ່ວງວັນທີ ຫຼື ຂາຍສິນຄ້າໃນໜ້າ POS'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {paginatedProducts.map((p, idx) => {
                  const rowNum = (pageSize === 'ALL' ? 0 : (safeCurrentPage - 1) * pageSize) + idx + 1;
                  const hasCarton = p.cartonQty > 0;
                  const hasPack = p.packQty > 0;
                  const hasRetail = p.retailQty > 0;

                  return (
                    <div key={p.id} className="p-3 hover:bg-slate-50/70 transition-colors flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                            #{rowNum}
                          </span>
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-10 h-10 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 items-center justify-center text-slate-400 shrink-0"
                            style={{ display: p.imageUrl ? 'none' : 'flex' }}
                          >
                            <Package size={18} weight="bold" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-extrabold text-slate-900 text-xs leading-snug line-clamp-2">
                              {p.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-slate-400 font-mono flex-wrap">
                              {p.barcode && <span>{p.barcode}</span>}
                              {viewMode === 'unsold' ? (
                                p.trackStock ? (
                                  p.currentStock > 0 ? (
                                    <span className="text-amber-800 font-sans font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/70">
                                      ສະຕັອກ: {formatDots(p.currentStock)} {p.baseUnit}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-sans font-medium bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                      ໝົດສະຕັອກ (0 {p.baseUnit})
                                    </span>
                                  )
                                ) : null
                              ) : p.orderCount > 0 ? (
                                <span className="text-teal-700 font-sans font-semibold">
                                  {p.orderCount} ບິນ
                                </span>
                              ) : (
                                <span className="text-slate-400 font-sans">
                                  ຍັງບໍ່ມີຍອດຂາຍ
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-black text-teal-700 text-sm font-mono">
                            {formatKip(p.revenue)}
                          </div>
                          <div className="text-[10px] text-slate-400">ຍອດຂາຍລວມ</div>
                        </div>
                      </div>

                      {/* 3 Unit Breakdown Badges */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100/80">
                        <div
                          className={`p-1.5 rounded-xl border flex flex-col items-center justify-center text-center ${
                            hasCarton
                              ? 'bg-amber-50/80 border-amber-200/80 text-amber-900'
                              : 'bg-slate-50 border-slate-200/60 text-slate-400'
                          }`}
                        >
                          <span className="text-[9.5px] font-bold uppercase tracking-wider">ແກັດ</span>
                          <span className="text-xs font-mono font-black mt-0.5">
                            {hasCarton ? `${formatDots(p.cartonQty)} ${p.cartonUnitName}` : '-'}
                          </span>
                        </div>

                        <div
                          className={`p-1.5 rounded-xl border flex flex-col items-center justify-center text-center ${
                            hasPack
                              ? 'bg-sky-50/80 border-sky-200/80 text-sky-900'
                              : 'bg-slate-50 border-slate-200/60 text-slate-400'
                          }`}
                        >
                          <span className="text-[9.5px] font-bold uppercase tracking-wider">ແພັກ</span>
                          <span className="text-xs font-mono font-black mt-0.5">
                            {hasPack ? `${formatDots(p.packQty)} ${p.packUnitName}` : '-'}
                          </span>
                        </div>

                        <div
                          className={`p-1.5 rounded-xl border flex flex-col items-center justify-center text-center ${
                            hasRetail
                              ? 'bg-slate-100 border-slate-200/80 text-slate-900'
                              : 'bg-slate-50 border-slate-200/60 text-slate-400'
                          }`}
                        >
                          <span className="text-[9.5px] font-bold uppercase tracking-wider">ຍ່ອຍ</span>
                          <span className="text-xs font-mono font-black mt-0.5">
                            {hasRetail ? `${formatDots(p.retailQty)} ${p.retailUnitName}` : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Mobile Summary Row */}
                <div className="p-3 bg-slate-100/90 border-t-2 border-slate-200 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>ລວມທັງໝົດ ({displayedProducts.length} ລາຍການ):</span>
                    <span className="font-mono text-teal-800 font-black text-sm">
                      {viewMode === 'unsold' ? '0 ₭' : formatKip(totalRevenue)}
                    </span>
                  </div>
                  {viewMode !== 'unsold' && (
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10.5px] font-mono">
                      <span className="p-1 rounded-lg bg-amber-50 text-amber-900 font-bold border border-amber-200/60">
                        ແກັດ: {formatDots(totalCartons)}
                      </span>
                      <span className="p-1 rounded-lg bg-sky-50 text-sky-900 font-bold border border-sky-200/60">
                        ແພັກ: {formatDots(totalPacks)}
                      </span>
                      <span className="p-1 rounded-lg bg-slate-200/70 text-slate-900 font-bold border border-slate-300/60">
                        ຍ່ອຍ: {formatDots(totalRetail)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mobile-only pagination bar (< 768px) */}
            {displayedProducts.length > 0 && (
              <div className="md:hidden bg-slate-50/90 border-t border-slate-200 p-3 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 w-full justify-between">
                  <span className="text-xs text-slate-500 font-medium">ຈຳນວນຕໍ່ໜ້າ:</span>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    {[20, 50, 100, 'ALL'].map((size) => {
                      const isActive = pageSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => handlePageSizeChange(size)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isActive
                              ? 'bg-teal-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {size === 'ALL' ? 'ທັງໝົດ' : size}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {pageSize !== 'ALL' && totalPages > 1 && (
                  <div className="flex items-center justify-between w-full pt-1">
                    <button
                      type="button"
                      disabled={safeCurrentPage === 1}
                      onClick={() => handlePageChange(safeCurrentPage - 1)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 ${
                        safeCurrentPage === 1
                          ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                          : 'border-slate-200 text-slate-700 hover:bg-white active:scale-95 cursor-pointer'
                      }`}
                    >
                      <CaretLeft size={13} weight="bold" />
                      <span>ກ່ອນໜ້າ</span>
                    </button>

                    <span className="text-xs font-mono font-bold text-slate-700">
                      {safeCurrentPage} / {totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={safeCurrentPage === totalPages}
                      onClick={() => handlePageChange(safeCurrentPage + 1)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 ${
                        safeCurrentPage === totalPages
                          ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                          : 'border-slate-200 text-slate-700 hover:bg-white active:scale-95 cursor-pointer'
                      }`}
                    >
                      <span>ຕໍ່ໄປ</span>
                      <CaretRight size={13} weight="bold" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop/Tablet Table (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider select-none">
                  {/* Col 0: STT (ລ/ດ) */}
                  <th className="py-2.5 px-2 sm:px-3 w-12 text-center text-slate-500 font-bold">
                    ລ/ດ
                  </th>

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
                {isLoading && transactions.length === 0 ? (
                  <SalesByUnitSkeleton count={8} />
                ) : paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                        <Package size={24} weight="duotone" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">
                        {viewMode === 'unsold'
                          ? 'ບໍ່ພົບສິນຄ້າທີ່ບໍ່ທັນຂາຍ'
                          : 'ບໍ່ພົບລາຍການຂາຍໃນຊ່ວງເວລານີ້'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {searchTerm
                          ? `ບໍ່ພົບສິນຄ້າທີ່ກົງກັບ "${searchTerm}"`
                          : viewMode === 'unsold'
                          ? 'ດີຫຼາຍ! ສິນຄ້າທຸກລາຍການເຄີຍມີຍອດຂາຍແລ້ວ'
                          : 'ລອງປ່ຽນຊ່ວງວັນທີ ຫຼື ຂາຍສິນຄ້າໃນໜ້າ POS'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((p, idx) => {
                    const rowNum = (pageSize === 'ALL' ? 0 : (safeCurrentPage - 1) * pageSize) + idx + 1;
                    const hasCarton = p.cartonQty > 0;
                    const hasPack = p.packQty > 0;
                    const hasRetail = p.retailQty > 0;

                    return (
                      <tr
                        key={p.id}
                        className="h-[50px] hover:bg-slate-50/80 transition-colors text-xs"
                      >
                        {/* Col 0: STT (ລ/ດ) */}
                        <td className="py-1.5 px-2 sm:px-3 text-center font-mono text-xs font-semibold text-slate-400">
                          {rowNum}
                        </td>

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
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-mono flex-wrap">
                                {p.barcode && <span>{p.barcode}</span>}
                                {viewMode === 'unsold' ? (
                                  p.trackStock ? (
                                    p.currentStock > 0 ? (
                                      <span className="text-amber-800 font-sans font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/70">
                                        ສະຕັອກ: {formatDots(p.currentStock)} {p.baseUnit}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-sans font-medium bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                        ໝົດສະຕັອກ (0 {p.baseUnit})
                                      </span>
                                    )
                                  ) : null
                                ) : p.orderCount > 0 ? (
                                  <span className="text-teal-700 font-sans font-semibold">
                                    • {p.orderCount} ບິນ
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-sans">
                                    • ບໍ່ມີຍອດຂາຍ
                                  </span>
                                )}
                              </div>
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
                    <td colSpan={2} className="py-3 px-4">
                      <span>ລວມທັງໝົດ ({displayedProducts.length} ລາຍການ):</span>
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums text-amber-900 font-mono">
                      {viewMode === 'unsold' ? (
                        <span className="inline-flex items-center justify-center w-6 h-5 rounded-md bg-slate-200/60 text-slate-400">
                          <Minus size={11} weight="bold" />
                        </span>
                      ) : totalCartons > 0 ? (
                        `${formatDots(totalCartons)} ແກັດ`
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-5 rounded-md bg-slate-200/60 text-slate-400">
                          <Minus size={11} weight="bold" />
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums text-sky-900 font-mono">
                      {viewMode === 'unsold' ? (
                        <span className="inline-flex items-center justify-center w-6 h-5 rounded-md bg-slate-200/60 text-slate-400">
                          <Minus size={11} weight="bold" />
                        </span>
                      ) : totalPacks > 0 ? (
                        `${formatDots(totalPacks)} ແພັກ`
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-5 rounded-md bg-slate-200/60 text-slate-400">
                          <Minus size={11} weight="bold" />
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums text-slate-900 font-mono">
                      {viewMode === 'unsold' ? (
                        <span className="inline-flex items-center justify-center w-6 h-5 rounded-md bg-slate-200/60 text-slate-400">
                          <Minus size={11} weight="bold" />
                        </span>
                      ) : totalRetail > 0 ? (
                        `${formatDots(totalRetail)} ອັນ`
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-5 rounded-md bg-slate-200/60 text-slate-400">
                          <Minus size={11} weight="bold" />
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-mono text-teal-800 font-black text-sm">
                      {viewMode === 'unsold' ? '0 ₭' : formatKip(totalRevenue)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Attached Desktop Pagination Bar (Seamless with table, 0 gap - Identical to HistoryView) */}
          {displayedProducts.length > 0 && (
            <div className="hidden md:flex border-t border-slate-200 bg-slate-50/80 px-4 py-3 items-center justify-between gap-3">
              {/* Left: Page Size Selector (20 | 50 | 100 | 200 | ALL) */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">ຈຳນວນຕໍ່ໜ້າ:</span>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  {[20, 50, 100, 200, 'ALL'].map((size) => {
                    const isActive = pageSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handlePageSizeChange(size)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-teal-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                        }`}
                      >
                        {size === 'ALL' ? 'ທັງໝົດ' : size}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Middle: Summary Text */}
              <div className="text-xs text-slate-600 font-medium text-center whitespace-nowrap shrink-0 px-2">
                {pageSize === 'ALL' ? (
                  <span>
                    ທັງໝົດ{' '}
                    <strong className="text-slate-900 font-bold font-mono">
                      {displayedProducts.length}
                    </strong>{' '}
                    ລາຍການ
                  </span>
                ) : (
                  <span>
                    ສະແດງ{' '}
                    <strong className="text-slate-900 font-bold font-mono">
                      {Math.min((safeCurrentPage - 1) * pageSize + 1, displayedProducts.length)} -{' '}
                      {Math.min(safeCurrentPage * pageSize, displayedProducts.length)}
                    </strong>{' '}
                    ຈາກ{' '}
                    <strong className="text-slate-900 font-bold font-mono">
                      {displayedProducts.length}
                    </strong>{' '}
                    ລາຍການ
                  </span>
                )}
              </div>

              {/* Right: Page Navigation (Only shown when not ALL and totalPages > 1) */}
              {pageSize !== 'ALL' && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  {/* Previous Page */}
                  <button
                    type="button"
                    disabled={safeCurrentPage === 1}
                    onClick={() => handlePageChange(safeCurrentPage - 1)}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                      safeCurrentPage === 1
                        ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                        : 'border-slate-200 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 cursor-pointer active:scale-95'
                    }`}
                  >
                    <CaretLeft size={13} weight="bold" />
                    <span>ກ່ອນໜ້າ</span>
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((page, idx) => {
                      if (page === '...') {
                        return (
                          <span key={`dots-${idx}`} className="px-1 text-slate-400 font-bold text-xs">
                            ...
                          </span>
                        );
                      }
                      const isCurrent = safeCurrentPage === page;
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => handlePageChange(page)}
                          className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-teal-600 text-white shadow-2xs font-black'
                              : 'text-slate-700 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next Page */}
                  <button
                    type="button"
                    disabled={safeCurrentPage === totalPages}
                    onClick={() => handlePageChange(safeCurrentPage + 1)}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                      safeCurrentPage === totalPages
                        ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                        : 'border-slate-200 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 cursor-pointer active:scale-95'
                    }`}
                  >
                    <span>ຕໍ່ໄປ</span>
                    <CaretRight size={13} weight="bold" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
