import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Warehouse,
  Plus,
  PencilSimple,
  Trash,
  Package,
  ArrowClockwise,
  ArrowCounterClockwise,
  MagnifyingGlass,
  Barcode,
  CheckCircle,
  WarningCircle,
  Folders,
  XCircle,
  MagnifyingGlassPlus,
  CaretDown,
  CaretUp,
  Check,
  X,
  CaretLeft,
  CaretRight,
  FileArrowDown,
  CurrencyDollar,
  PencilLine,
  Tag,
  CheckSquare,
  ArrowsDownUp,
} from '@phosphor-icons/react';
import BulkPriceModal from './BulkPriceModal';
import { updateProductUnitPricesZeroEgress, updateProductCostsZeroEgress } from '../services/supabase';
import { exportProductsToExcel } from '../utils/excelExport';
import { formatKip, formatBaht, getCartonUnitInfo, formatStockDisplay, formatNegativeStockCompound, normalizeLao } from '../utils/formatters';
import BarcodeScannerModal from './BarcodeScannerModal';
import { useHardwareBarcodeScanner, sanitizeBarcode } from '../hooks/useHardwareBarcodeScanner';
import { playSuccessBeep, playErrorBeep, playActionClickBeep, playUnitChangeBeep, playRefreshBeep } from '../utils/audioFeedback';
import { ProductsListSkeleton } from './common/SkeletonLoaders';
import { useAuthRole } from '../contexts/AuthContext';

/**
 * Modern Pastel unit badge styling:
 * - Cấp 1: Thùng / Carton (ແກັດ) -> Tím Pastel: bg-purple-100/90 text-purple-700 border-purple-300/80
 * - Cấp 2: Pack / Gói (ແພັກ) -> Xanh Biển Pastel: bg-sky-100/90 text-sky-700 border-sky-300/80
 * - Cấp 3: Đơn vị lẻ / Cơ sở (ອັນ, ຕຸກ, ປ໋ອງ...) -> Xanh Ngọc Pastel: bg-emerald-100/90 text-emerald-800 border-emerald-300/80
 */
export function getUnitBadgeConfig(u, sortedUnits = []) {
  const name = (u.unitName || u.unit_name || '').toLowerCase();
  const uId = u.id || u.unitId;
  const isSorted = sortedUnits && sortedUnits.length > 0;
  const firstId = sortedUnits[0]?.id || sortedUnits[0]?.unitId;
  const lastId = sortedUnits[sortedUnits.length - 1]?.id || sortedUnits[sortedUnits.length - 1]?.unitId;
  const mult = Number(u.multiplier) || 1;

  // Single unit product is always base/tier 3
  if (sortedUnits && sortedUnits.length <= 1) {
    return {
      badge: 'bg-emerald-100/90 text-emerald-800 border-emerald-300/80',
      mult: 'text-emerald-700/80',
    };
  }

  // Cấp 1: Thùng / Carton / Bán buôn lớn nhất
  if (
    name.includes('ແກັດ') || name.includes('thùng') || name.includes('thung') || name.includes('carton') || name.includes('case') ||
    (isSorted && uId === firstId && mult > 1)
  ) {
    return {
      badge: 'bg-purple-100/90 text-purple-700 border-purple-300/80',
      mult: 'text-purple-600/80',
    };
  }

  // Cấp 3: Đơn vị cơ sở / Bán lẻ nhỏ nhất
  if (
    name.includes('ອັນ') || name.includes('ຕຸກ') || name.includes('ປ໋ອງ') || name.includes('ກິບ') || name.includes('lẻ') || name.includes('le') || name.includes('piece') ||
    (isSorted && uId === lastId) || mult === 1
  ) {
    return {
      badge: 'bg-emerald-100/90 text-emerald-800 border-emerald-300/80',
      mult: 'text-emerald-700/80',
    };
  }

  // Cấp 2: Pack / Gói / Đơn vị trung gian
  return {
    badge: 'bg-sky-100/90 text-sky-700 border-sky-300/80',
    mult: 'text-sky-600/80',
  };
}

export function getUnitBadgeStyle(u, sortedUnits = []) {
  return getUnitBadgeConfig(u, sortedUnits).badge;
}

/**
 * Calculate dynamic profit margin percentage badge (+15%, -2%, etc.)
 */
export function calculateProfitBadge(sellingPrice, unitCost) {
  const p = Number(sellingPrice) || 0;
  const c = Number(unitCost) || 0;
  if (p <= 0 || c <= 0) return null;
  const diff = p - c;
  const pct = Math.round((diff / c) * 100);
  if (pct > 0) {
    return {
      text: `+${pct}%`,
      className: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
    };
  } else if (pct < 0) {
    return {
      text: `${pct}%`,
      className: 'text-rose-700 bg-rose-50 border-rose-200/80',
    };
  }
  return {
    text: '0%',
    className: 'text-slate-600 bg-slate-100 border-slate-200/80',
  };
}

/**
 * Resolves the relative step multiplier for a unit compared to the direct child unit right below it.
 * E.g., Carton (144) with Pack (24) below it => 144 / 24 = 6 => displays "(x6)"
 * Pack (24) with Piece (1) below it => 24 / 1 = 24 => displays "(x24)"
 * Base unit (1) => displays "" (no parenthesis)
 */
export function getUnitStepMultiplier(unit, sortedUnits = [], product = null) {
  if (!unit || !sortedUnits || sortedUnits.length <= 1) return null;
  const idx = sortedUnits.findIndex((u) => u.id === unit.id);
  if (idx === -1 || idx >= sortedUnits.length - 1) {
    return null;
  }

  // Check explicit direct properties if available
  const explicitStep = Number(
    unit.units_per_carton ??
    unit.unitsPerCarton ??
    unit.pack_quantity ??
    unit.packQuantity ??
    unit.step_multiplier ??
    unit.stepMultiplier ??
    (idx === 0 && product?.tierSettings?.cartonMultiplier) ??
    (idx === 1 && sortedUnits.length > 2 && product?.tierSettings?.packMultiplier) ??
    0
  );
  if (explicitStep > 1) {
    return explicitStep;
  }

  const nextUnit = sortedUnits[idx + 1];
  const curMult = Number(unit.multiplier) || 1;
  const nextMult = Number(nextUnit.multiplier) || 1;
  if (nextMult <= 0) return null;
  const step = Math.round(curMult / nextMult);
  return step > 1 ? step : null;
}

/**
 * Shared helper to resolve unit tiers, cost conversions, and stock counts for both Mobile Card & Desktop Table
 */
export function getProductStockDetails(p, exchangeRate = 0) {
  const { cartonUnitName, cartonCostKip, cartonCostBaht } = getCartonUnitInfo(p, exchangeRate);

  const isUntracked = p.trackStock === false;

  const isPieceActive = p.tier3_active !== undefined
    ? Boolean(p.tier3_active)
    : (p.tierSettings?.enablePiece !== undefined ? Boolean(p.tierSettings.enablePiece) : Boolean(p.units?.some(u => u.tier === 1 || u.id?.endsWith('_piece'))));

  const isPackActive = p.tier2_active !== undefined
    ? Boolean(p.tier2_active)
    : (p.tierSettings?.enablePack !== undefined ? Boolean(p.tierSettings.enablePack) : Boolean(p.units?.some(u => u.tier === 2 || u.id?.endsWith('_pack'))));

  const isCartonActive = p.tier1_active !== undefined
    ? Boolean(p.tier1_active)
    : (p.tierSettings?.enableCarton !== undefined ? Boolean(p.tierSettings.enableCarton) : Boolean(p.units?.some(u => u.tier === 3 || u.id?.endsWith('_carton'))));

  const rawCartonUnit = p.units?.find(
    (u) =>
      u.tier === 3 ||
      u.id?.endsWith('_carton') ||
      ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງໃຫຍ່', 'ຖັງ'].includes(u.unitName)
  );
  const rawPackUnit = p.units?.find(
    (u) =>
      (u.tier === 2 ||
        u.id?.endsWith('_pack') ||
        ['ແພັກ', 'ມັດ', 'ແຕະ', 'ໂหล', 'ຖົງກາງ'].includes(u.unitName)) &&
      (!rawCartonUnit || u.id !== rawCartonUnit.id)
  );
  const rawPieceUnit = p.units?.find(
    (u) =>
      (u.tier === 1 ||
        u.id?.endsWith('_piece') ||
        ['ອັນ', 'ແກ້ວ', 'ຖົງ', 'ກະປ໋ອງ', 'ຕຸກ', 'ຊອງ', 'ກ່ອງນ້ອຍ'].includes(u.unitName)) &&
      (!rawCartonUnit || u.id !== rawCartonUnit.id) &&
      (!rawPackUnit || u.id !== rawPackUnit.id)
  );

  const cartonUnit = isCartonActive ? rawCartonUnit : null;
  const packUnit = isPackActive ? rawPackUnit : null;
  const pieceUnit = isPieceActive ? rawPieceUnit : null;

  let cName = cartonUnit?.unitName || p.tierSettings?.cartonUnitName || 'ແກັດ';
  let pName = packUnit?.unitName || p.tierSettings?.packUnitName || 'ແພັກ';
  let pcName =
    pieceUnit?.unitName ||
    p.tierSettings?.pieceUnitName ||
    (p.baseUnit && p.baseUnit !== pName && p.baseUnit !== cName ? p.baseUnit : 'ອັນ');

  if (pName === cName) pName = 'ແພັກ';
  if (pcName === cName || pcName === pName) pcName = 'ອັນ';

  let packsPerCarton = p.tierSettings?.cartonMultiplier;
  if (!packsPerCarton && cartonUnit && packUnit && cartonUnit.multiplier > packUnit.multiplier) {
    packsPerCarton = Math.round(cartonUnit.multiplier / packUnit.multiplier);
  } else if (!packsPerCarton && cartonUnit && cartonUnit.multiplier > 1) {
    packsPerCarton = cartonUnit.multiplier;
  } else if (!packsPerCarton) {
    packsPerCarton = 8;
  }

  let piecesPerPack = p.tierSettings?.packMultiplier;
  if (!piecesPerPack && packUnit && pieceUnit && packUnit.multiplier > pieceUnit.multiplier) {
    piecesPerPack = Math.round(packUnit.multiplier / pieceUnit.multiplier);
  } else if (!piecesPerPack && packUnit && packUnit.multiplier > 1) {
    piecesPerPack = packUnit.multiplier;
  } else if (!piecesPerPack) {
    piecesPerPack = (p.name?.includes('Lay') || p.name?.includes('ເຂົ້າໜົມ')) ? 4 : 6;
  }

  const rawStock = Number(p.currentStockBaseUnits ?? p.current_stock_base_units ?? 0);
  const isNegativeStock = !isUntracked && rawStock < 0;
  const isZeroStock = !isUntracked && rawStock === 0;

  // Active units sorted by multiplier descending (highest unit first, e.g. Tier 3 -> Tier 2 -> Tier 1)
  const sortedUnitsDesc = (p.units || [])
    .filter((u) => u && u.isActive !== false)
    .slice()
    .sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1));

  // Highest unit formatting for negative stock: "ຕິດລົບ -{số_lượng} {đơn_vị_cao_nhất}"
  const highestUnit = sortedUnitsDesc.length > 0 ? sortedUnitsDesc[0] : null;
  const highestUnitName = highestUnit?.unitName || cName || 'ແກັດ';
  const highestMult = Math.max(1, Number(highestUnit?.multiplier) || 1);
  const negativeHighestQty = Math.abs(rawStock) >= highestMult && highestMult > 1
    ? (Math.abs(rawStock) % highestMult === 0
        ? Math.abs(rawStock) / highestMult
        : (Math.abs(rawStock) / highestMult).toFixed(1).replace('.0', ''))
    : Math.abs(rawStock);

  const negativeStockText = `ຕິດລົບ -${negativeHighestQty} ${highestUnitName}`;

  const stockDisplayText = formatStockDisplay(p, null, pcName, { prefix: 'ໝົດສະຕັອກ' });
  const negativeCompound = formatNegativeStockCompound(p, null, pcName);

  const totalBase = rawStock;
  const absBase = Math.abs(rawStock);

  let cartonCount = 0;
  let packCount = 0;
  let pieceCount = 0;
  let totalPacksCount = '0';

  if (!isUntracked) {
    if (cartonUnit && packUnit && pieceUnit) {
      // 3 Tiers Active: Piece is base unit
      const piecesPerCarton = packsPerCarton * piecesPerPack;
      cartonCount = Math.floor(absBase / piecesPerCarton);
      const rem = absBase % piecesPerCarton;
      packCount = Math.floor(rem / piecesPerPack);
      pieceCount = rem % piecesPerPack;
      totalPacksCount = (absBase / piecesPerPack).toFixed(1).replace('.0', '');
    } else if (cartonUnit && packUnit && !pieceUnit) {
      // 2 Tiers Active (Tier 3 OFF): Pack IS the base unit
      cartonCount = Math.floor(absBase / packsPerCarton);
      packCount = absBase % packsPerCarton;
      pieceCount = 0;
      totalPacksCount = absBase.toString();
    } else if (cartonUnit && pieceUnit && !packUnit) {
      // 2 Tiers Active (Tier 2 OFF): Piece is base unit
      const piecesPerCarton = packsPerCarton || cartonUnit.multiplier || 25;
      cartonCount = Math.floor(absBase / piecesPerCarton);
      pieceCount = absBase % piecesPerCarton;
      packCount = 0;
      totalPacksCount = '0';
    } else if (packUnit && pieceUnit && !cartonUnit) {
      // 2 Tiers Active (Tier 1 OFF): Piece is base unit
      packCount = Math.floor(absBase / piecesPerPack);
      pieceCount = absBase % piecesPerPack;
      cartonCount = 0;
      totalPacksCount = (absBase / piecesPerPack).toFixed(1).replace('.0', '');
    } else if (cartonUnit) {
      cartonCount = absBase;
      packCount = 0;
      pieceCount = 0;
      totalPacksCount = '0';
    } else if (packUnit) {
      packCount = absBase;
      cartonCount = 0;
      pieceCount = 0;
      totalPacksCount = absBase.toString();
    } else {
      pieceCount = absBase;
      cartonCount = 0;
      packCount = 0;
      totalPacksCount = '0';
    }
  }

  // Lowest unit name for "ລວມທັງໝົດ"
  const lowestUnit = sortedUnitsDesc.length > 0 ? sortedUnitsDesc[sortedUnitsDesc.length - 1] : null;
  const lowestUnitName = lowestUnit?.unitName || p.baseUnit || pcName || 'ອັນ';

  return {
    cartonUnitName,
    cartonCostKip,
    cartonCostBaht,
    isUntracked,
    isNegativeStock,
    isZeroStock,
    rawStock,
    negativeStockText,
    sortedUnitsDesc,
    lowestUnitName,
    stockDisplayText,
    negativeCompound,
    cartonUnit,
    packUnit,
    pieceUnit,
    cName,
    pName,
    pcName,
    packsPerCarton,
    piecesPerPack,
    totalBase,
    cartonCount,
    packCount,
    pieceCount,
    totalPacksCount,
  };
}

export default function ProductsView({
  products,
  exchangeRate,
  onAddNewProduct,
  onEditProduct,
  onDeleteProduct,
  onRefreshProducts,
  onOpenCategoryManager,
  onOpenBundleManager,
  isLoading,
  onUpdateProductUnitPrices,
  onUpdateProductCosts,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [previewProduct, setPreviewProduct] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedHighlightId, setScannedHighlightId] = useState(null);
  const [scanToast, setScanToast] = useState(null);
  const searchInputRef = useRef(null);
  const categoryDropdownRef = useRef(null);

  // Thứ tự sắp xếp mặc định: Mới nhất ở trên đầu bảng ('newest_first')
  const [productSortOrder, setProductSortOrder] = useState('newest_first');

  // Price & Cost Editing & Multi-select State (Zero-Egress Strategy)
  const [isPriceEditMode, setIsPriceEditMode] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [dirtyUnits, setDirtyUnits] = useState({});
  const [dirtyCosts, setDirtyCosts] = useState({});
  const [isSavingPrices, setIsSavingPrices] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkModalTargetProduct, setBulkModalTargetProduct] = useState(null);
  const [bulkModalInitialTab, setBulkModalInitialTab] = useState('manual');
  const [priceToast, setPriceToast] = useState(null);
  const [isLocalRefreshing, setIsLocalRefreshing] = useState(false);

  const handleLocalRefresh = async () => {
    if (isLocalRefreshing) return;
    setIsLocalRefreshing(true);
    playRefreshBeep('products');
    try {
      await Promise.all([
        onRefreshProducts?.(),
        new Promise((res) => setTimeout(res, 600)),
      ]);
      playSuccessBeep('products');
    } catch (err) {
      console.error('Products refresh error:', err);
    } finally {
      setIsLocalRefreshing(false);
    }
  };

  // Local search state with debounce to prevent re-rendering catalog during high-speed scanner bursts
  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const searchDebounceRef = useRef(null);

  // Sync with external searchTerm changes (e.g. cleared or scanned)
  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setLocalSearch(val);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      setSearchTerm(val);
      setCurrentPage(1);
    }, 120);
  };

  const handleClearSearch = () => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    setLocalSearch('');
    setSearchTerm('');
    setScannedHighlightId(null);
    setScanToast(null);
    setCurrentPage(1);
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      try {
        searchInputRef.current.focus();
      } catch (_) {}
    }
  };

  // Extract categories and product counts
  const categoryOptions = useMemo(() => {
    const counts = {};
    (products || []).forEach((p) => {
      const pCats = (p.category || 'ທົ່ວໄປ')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      pCats.forEach((cat) => {
        counts[cat] = (counts[cat] || 0) + 1;
      });
    });
    const sortedCategories = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    return {
      totalCount: (products || []).length,
      list: sortedCategories.map((name) => ({
        name,
        count: counts[name],
      })),
    };
  }, [products]);

  // Filter categories inside dropdown search
  const filteredCategoryOptions = useMemo(() => {
    if (!categorySearchTerm.trim()) return categoryOptions.list;
    const q = normalizeLao(categorySearchTerm.trim());
    return categoryOptions.list.filter((cat) => normalizeLao(cat.name).includes(q));
  }, [categoryOptions.list, categorySearchTerm]);

  // Combined product filtering by category, search query, and chronological sorting
  const filteredProducts = useMemo(() => {
    let list = products || [];

    // 1. Category Filter (supports comma-separated multi-categories)
    if (selectedCategory && selectedCategory !== 'ALL') {
      const targetCatLower = selectedCategory.trim().toLowerCase();
      list = list.filter((p) => {
        const pCats = (p.category || 'ທົ່ວໄປ')
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        return pCats.includes(targetCatLower);
      });
    }

    // 2. Search Query Filter - chỉ tìm kiếm theo tên sản phẩm (và mã vạch khi quét barcode)
    const q = normalizeLao(searchTerm);
    if (q) {
      list = list.filter((p) => {
        const matchesName =
          (p.name && normalizeLao(p.name).includes(q)) ||
          (p.name_vi && normalizeLao(p.name_vi).includes(q)) ||
          (p.nameVi && normalizeLao(p.nameVi).includes(q));
        const matchesBarcode =
          (p.barcode && normalizeLao(p.barcode).includes(q)) ||
          (p.units &&
            p.units.some((u) => u.barcode && normalizeLao(u.barcode).includes(q)));
        return matchesName || matchesBarcode;
      });
    }

    // 3. Sắp xếp danh sách sản phẩm ProductsView:
    // Mặc định: productSortOrder === 'newest_first' -> Sản phẩm MỚI NHẤT ở trên đầu bảng!
    const originalIndexMap = new Map();
    (products || []).forEach((p, idx) => {
      originalIndexMap.set(p.id, idx);
    });

    const getChronologicalScore = (p) => {
      const rawDate = p.created_at || p.createdAt;
      if (rawDate) {
        const t = new Date(rawDate).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      // Fallback: Mảng products gốc từ Supabase query theo created_at ascending (index 0 là cũ nhất, index N-1 là mới nhất)
      const idx = originalIndexMap.get(p.id) ?? 0;
      return idx;
    };

    const sorted = list.slice();
    if (productSortOrder === 'oldest_first') {
      // Cũ nhất ở trên đầu
      sorted.sort((a, b) => getChronologicalScore(a) - getChronologicalScore(b));
    } else {
      // Mặc định: Mới nhất ở trên đầu bảng (Newest first)
      sorted.sort((a, b) => getChronologicalScore(b) - getChronologicalScore(a));
    }

    return sorted;
  }, [products, searchTerm, selectedCategory, productSortOrder]);

  // Configurable Pagination States (Default 50, with 20 | 50 | 100 | 200 | ALL options)
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const tableTopRef = useRef(null);

  const scrollToTableTop = () => {
    tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePageChange = (newPage) => {
    if (newPage === currentPage || newPage < 1 || newPage > totalPages) return;
    playActionClickBeep('products');
    setCurrentPage(newPage);
    scrollToTableTop();
  };

  const handlePageSizeChange = (newSize) => {
    playActionClickBeep('products');
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // Auto-reset currentPage to 1 when search query, category filter or sort order changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, productSortOrder]);

  const totalPages = useMemo(() => {
    if (pageSize === 'ALL' || !pageSize) return 1;
    return Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  }, [filteredProducts.length, pageSize]);

  // Protect currentPage within bounds when items count changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Export filtered products to Excel (.xlsx)
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const handleExportExcel = async () => {
    if (!filteredProducts || filteredProducts.length === 0) return;
    try {
      setIsExportingExcel(true);
      playActionClickBeep('products');
      await exportProductsToExcel(filteredProducts, {
        category: selectedCategory,
        searchQuery: searchTerm,
      });
    } catch (err) {
      console.error('Export products error:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const paginatedProducts = useMemo(() => {
    if (pageSize === 'ALL' || !pageSize) {
      return filteredProducts;
    }
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Number of dirty items currently modified in Mode 2
  const dirtyCount = Object.keys(dirtyUnits).length + Object.keys(dirtyCosts).length;

  // Selected products for Modal (handles either bulk selection or single quick price edit)
  const selectedProductsForModal = useMemo(() => {
    if (bulkModalTargetProduct) {
      return [bulkModalTargetProduct];
    }
    if (selectedProductIds.size === 0) return [];
    return (products || []).filter((p) => selectedProductIds.has(p.id));
  }, [bulkModalTargetProduct, selectedProductIds, products]);

  const handleOpenQuickProductPrice = (p) => {
    playActionClickBeep('products');
    setBulkModalTargetProduct(p);
    setBulkModalInitialTab('manual');
    setIsBulkModalOpen(true);
  };

  const handleOpenBulkPriceModal = () => {
    playActionClickBeep('products');
    setBulkModalTargetProduct(null);
    setBulkModalInitialTab('manual');
    setIsBulkModalOpen(true);
  };

  const handleCloseBulkPriceModal = () => {
    setIsBulkModalOpen(false);
    setBulkModalTargetProduct(null);
  };

  const isAllSelected = paginatedProducts.length > 0 && paginatedProducts.every((p) => selectedProductIds.has(p.id));

  const toggleSelectProduct = (id) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (isAllSelected) {
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        paginatedProducts.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        paginatedProducts.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const handleSelectAllCategory = () => {
    if (selectedCategory === 'ALL') {
      setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
    } else {
      const catProds = (products || []).filter((p) => {
        const pCats = (p.category || 'ທົ່ວໄປ')
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        return pCats.includes(selectedCategory.trim().toLowerCase());
      });
      setSelectedProductIds(new Set(catProds.map((p) => p.id)));
    }
  };

  // Inline value change for Mode 2
  const handleUnitValueChange = (unit, field, rawVal) => {
    const val = Number(String(rawVal).replace(/[^\d]/g, '')) || 0;
    const unitId = unit.id;

    setDirtyUnits((prev) => {
      const origRetail = Number(unit.retailPrice ?? unit.retail_price ?? 0);
      const origPrice2 = Number(unit.price_2 ?? unit.price2 ?? unit.wholesalePrice ?? 0);
      const origPrice3 = Number(unit.price_3 ?? unit.price3 ?? 0);

      const existing = prev[unitId] || {
        id: unitId,
        productId: unit.productId || unit.product_id,
        product_id: unit.productId || unit.product_id,
        unitName: unit.unitName || unit.unit_name,
        unit_name: unit.unitName || unit.unit_name,
        multiplier: unit.multiplier,
        retail_price: origRetail,
        price_2: origPrice2,
        price_3: origPrice3,
      };

      const next = {
        ...existing,
        [field]: val,
      };

      const isChanged =
        next.retail_price !== origRetail ||
        next.price_2 !== origPrice2 ||
        next.price_3 !== origPrice3;

      if (!isChanged) {
        const copy = { ...prev };
        delete copy[unitId];
        return copy;
      }

      return {
        ...prev,
        [unitId]: next,
      };
    });
  };

  // Inline cost value change for Mode 2 (supports both Baht and Kip inputs with live exchange conversion)
  const handleProductCostChange = (product, field, rawVal) => {
    const val = Number(String(rawVal).replace(/[^\d]/g, '')) || 0;
    const prodId = product.id;
    const rate = Number(exchangeRate) || 690;
    const maxMult = Math.max(1, ...(product.units || []).map((u) => Number(u.multiplier) || 1));

    const isLakOnly =
      (product.cost_currency || product.costCurrency) === 'LAK' ||
      (Number(product.costBaht ?? product.cost_thb ?? 0) === 0 && Number(product.costKip ?? product.cost_lak ?? product.costPerBaseUnit ?? 0) > 0);

    const origCostLak = Number(product.costLak ?? product.cost_lak ?? product.costKip ?? (Number(product.costPerBaseUnit || 0) * maxMult) ?? 0);
    const origCostThb = Number(product.costBaht ?? product.cost_thb ?? 0);

    setDirtyCosts((prev) => {
      const existing = prev[prodId];
      let curCostThb = existing?.cost_thb !== undefined ? existing.cost_thb : origCostThb;
      let curCostLak = existing?.cost_lak !== undefined ? existing.cost_lak : origCostLak;

      if (field === 'cost_thb') {
        curCostThb = val;
        // Tự động tính toán và điền giá trị theo công thức cost_lak = Math.round(cost_thb * current_exchange_rate)
        curCostLak = Math.round(val * rate);
      } else if (field === 'cost_lak') {
        // Gõ trực tiếp vào ô Kíp: Giữ nguyên số tiền người dùng nhập
        curCostLak = val;
        if (isLakOnly) {
          curCostThb = 0;
        }
      }

      const costPerBaseUnit = Math.round(curCostLak / maxMult);
      const isChanged = curCostLak !== origCostLak || (!isLakOnly && curCostThb !== origCostThb);

      if (!isChanged) {
        const copy = { ...prev };
        delete copy[prodId];
        return copy;
      }

      return {
        ...prev,
        [prodId]: {
          productId: prodId,
          currency: isLakOnly ? 'LAK' : 'THB',
          cost_lak: curCostLak,
          cost_thb: curCostThb,
          cost_per_base_unit: costPerBaseUnit,
        },
      };
    });
  };

  // Quick reset prices and costs for a single product in Mode 2
  const handleResetProductPrices = (product) => {
    if (!product) return;
    playActionClickBeep('products');
    setDirtyUnits((prev) => {
      const next = { ...prev };
      if (product.units) {
        product.units.forEach((u) => {
          delete next[u.id];
        });
      }
      return next;
    });
    setDirtyCosts((prev) => {
      const next = { ...prev };
      delete next[product.id];
      return next;
    });
  };

  // Save Inline Edits for Mode 2
  const handleSaveInlinePrices = async () => {
    const dirtyList = Object.values(dirtyUnits);
    const dirtyCostList = Object.values(dirtyCosts);
    if (dirtyList.length === 0 && dirtyCostList.length === 0) return;
    setIsSavingPrices(true);
    try {
      const promises = [];
      if (dirtyList.length > 0) {
        promises.push(updateProductUnitPricesZeroEgress(dirtyList));
      }
      if (dirtyCostList.length > 0) {
        promises.push(updateProductCostsZeroEgress(dirtyCostList));
      }

      const results = await Promise.all(promises);
      const allSuccess = results.every((r) => r.success);

      if (allSuccess) {
        if (onUpdateProductUnitPrices && dirtyList.length > 0) {
          const unitPayload = results[0]?.payload || dirtyList;
          onUpdateProductUnitPrices(unitPayload);
        }
        if (onUpdateProductCosts && dirtyCostList.length > 0) {
          onUpdateProductCosts(dirtyCostList);
        }
        playSuccessBeep('products');
        setDirtyUnits({});
        setDirtyCosts({});
        const totalItemsCount = dirtyList.length + dirtyCostList.length;
        setPriceToast({
          type: 'success',
          message: `ບັນທຶກການແກ້ໄຂສຳເລັດແລ້ວ ${totalItemsCount} ລາຍການ`,
        });
        setTimeout(() => setPriceToast(null), 3500);
      } else {
        playErrorBeep('products');
        alert('ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ: ' + (results.find((r) => !r.success)?.error || ''));
      }
    } catch (err) {
      console.error('Save inline prices error:', err);
    } finally {
      setIsSavingPrices(false);
    }
  };

  // Apply Bulk Adjustment for Mode 1 & Mode 2
  const handleApplyBulkPrices = async (dirtyPayload, dirtyCostsPayload = []) => {
    if ((!dirtyPayload || dirtyPayload.length === 0) && (!dirtyCostsPayload || dirtyCostsPayload.length === 0)) return;
    setIsSavingPrices(true);
    try {
      const promises = [];
      const dirtyUnitList = dirtyPayload && Array.isArray(dirtyPayload) ? dirtyPayload : [];
      const dirtyCostList = dirtyCostsPayload && Array.isArray(dirtyCostsPayload) ? dirtyCostsPayload : [];

      if (dirtyUnitList.length > 0) {
        promises.push(updateProductUnitPricesZeroEgress(dirtyUnitList));
      }
      if (dirtyCostList.length > 0) {
        promises.push(updateProductCostsZeroEgress(dirtyCostList));
      }

      const results = await Promise.all(promises);
      const allSuccess = results.every((r) => r.success);

      if (allSuccess) {
        if (onUpdateProductUnitPrices && dirtyUnitList.length > 0) {
          onUpdateProductUnitPrices(dirtyUnitList);
        }
        if (onUpdateProductCosts && dirtyCostList.length > 0) {
          onUpdateProductCosts(dirtyCostList);
        }
        playSuccessBeep('products');
        setSelectedProductIds(new Set());
        const totalItemsCount = dirtyUnitList.length + dirtyCostList.length;
        setPriceToast({
          type: 'success',
          message: `ປັບລາຄາ ແລະ ຕົ້ນທຶນສຳເລັດ ${totalItemsCount} ລາຍການ`,
        });
        setTimeout(() => setPriceToast(null), 3500);
      } else {
        playErrorBeep('products');
        alert('ເກີດຂໍ້ຜິດພາດໃນການປັບລາຄາ ຫຼື ຕົ້ນທຶນ');
      }
    } catch (err) {
      console.error('Bulk apply price error:', err);
    } finally {
      setIsSavingPrices(false);
    }
  };

  // Smart page numbers pagination algorithm
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    pages.push(1);
    if (currentPage > 3) {
      pages.push('...');
    }
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) {
      pages.push('...');
    }
    pages.push(totalPages);
    return pages;
  };

  const productStats = useMemo(() => {
    let inStock = 0;
    let lowOrOutStock = 0;
    const categoriesSet = new Set();

    (products || []).forEach((p) => {
      const stock = Number(p.stock) || 0;
      if (stock > 5) {
        inStock++;
      } else {
        lowOrOutStock++;
      }
      if (p.category && typeof p.category === 'string') {
        categoriesSet.add(p.category.trim());
      }
    });

    return {
      total: (products || []).length,
      inStock,
      lowOrOutStock,
      categoriesCount: categoriesSet.size || 0,
    };
  }, [products]);

  const handleScanBarcode = (barcode) => {
    if (!barcode) return;
    const cleanCode = sanitizeBarcode(barcode).trim();
    if (!cleanCode) return;

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    setLocalSearch(cleanCode);
    setSearchTerm(cleanCode);
    setCurrentPage(1);
    setScannerOpen(false);

    if (searchInputRef.current && typeof searchInputRef.current.blur === 'function') {
      try {
        searchInputRef.current.blur();
      } catch (_) {}
    }

    const cleanLower = cleanCode.toLowerCase();
    const matched = (products || []).find(
      (p) =>
        (p.barcode && sanitizeBarcode(p.barcode).trim().toLowerCase() === cleanLower) ||
        (p.units &&
          p.units.some(
            (u) => u.barcode && sanitizeBarcode(u.barcode).trim().toLowerCase() === cleanLower
          ))
    );

    if (matched) {
      playSuccessBeep();
      setScannedHighlightId(matched.id);
      setScanToast({
        type: 'success',
        message: `ພົບສິນຄ້າ "${matched.name}" (${cleanCode})`,
      });
      setTimeout(() => setScanToast(null), 3000);
      setTimeout(() => setScannedHighlightId(null), 6000);

      setTimeout(() => {
        const el = document.getElementById(`product-card-${matched.id}`) || document.getElementById(`product-row-${matched.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    } else {
      playErrorBeep();
      setScanToast({
        type: 'error',
        message: `ບໍ່ພົບສິນຄ້າທີ່ມີບາໂຄດ: "${cleanCode}"`,
      });
      setTimeout(() => setScanToast(null), 3500);
    }
  };

  // Global Hardware Barcode Scanner Listener (USB / OTG / Bluetooth HID Keyboard)
  useHardwareBarcodeScanner({
    onScan: handleScanBarcode,
    enabled: true,
    maxInterval: 180,
    maxAvgInterval: 85,
    minLength: 3,
    preventDefaultOnEnter: true,
    cleanActiveInput: true,
    duplicateInterval: 250,
  });

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      const q = (localSearch || searchTerm || '').trim();
      if (!q) {
        if (searchInputRef.current) {
          try {
            searchInputRef.current.blur();
          } catch (_) {}
        }
        return;
      }

      e.preventDefault();

      // Check if user manually typed an exact barcode
      const cleanLower = sanitizeBarcode(q).toLowerCase();
      const matched = (products || []).find(
        (p) =>
          (p.barcode && sanitizeBarcode(p.barcode).trim().toLowerCase() === cleanLower) ||
          (p.units &&
            p.units.some(
              (u) => u.barcode && sanitizeBarcode(u.barcode).trim().toLowerCase() === cleanLower
            ))
      );

      if (matched) {
        // Exact barcode match: highlight & scroll to product
        handleScanBarcode(cleanLower);
      } else {
        // Normal text/name search: filter list, blur keyboard, do NOT fire barcode error toast
        setSearchTerm(q);
        setCurrentPage(1);
        if (searchInputRef.current) {
          try {
            searchInputRef.current.blur();
          } catch (_) {}
        }
      }
    }
  };

  // Auto-close category dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    }
    if (isCategoryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isCategoryDropdownOpen]);

  // Handle ESC key to close image preview modal or category dropdown
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (previewProduct) setPreviewProduct(null);
        if (isCategoryDropdownOpen) setIsCategoryDropdownOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewProduct, isCategoryDropdownOpen]);

  return (
    <main
      className="flex-1 w-full max-w-full px-3 sm:px-5 md:px-6 pt-0 overflow-y-auto overflow-x-hidden font-sans min-h-0 pb-4 sm:pb-6 touch-pan-y"
      style={{
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        overscrollBehaviorX: 'none',
      }}
    >
      {/* 1. Header Toolbar: Standardized responsive header matching GRN */}
      <div className="bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3.5 -mx-3 sm:-mx-5 md:-mx-6 mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0 shadow-2xs">
        {/* Row 1 on mobile: Title, Icon & Count */}
        <div className="flex items-center justify-between w-full sm:w-auto min-w-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary-light flex items-center justify-center text-primary shrink-0">
              <Warehouse size={20} className="sm:w-5 sm:h-5" weight="duotone" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="truncate">
                  <span className="sm:hidden">ລາຍການສິນຄ້າ</span>
                  <span className="hidden sm:inline">ລາຍການສິນຄ້າ & ຕົ້ນທຶນບາດ</span>
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                  {products.length}
                </span>
              </h2>
              <p className="text-[11.5px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
                ສະແດງລາຄາຕົ້ນທຶນບາດ ແລະ ກີບ ຍົກລັງ/ແກັດ (Carton), ພ້ອມຫົວໜ່ວຍຂາຍ ແລະ ສະຕັອກສິນຄ້າ
              </p>
            </div>
          </div>
        </div>

        {/* Row 2 on mobile, Right side on sm+: Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onRefreshProducts && (
            <button
              type="button"
              onClick={handleLocalRefresh}
              disabled={isLocalRefreshing}
              className={`group/ref p-2 sm:px-3 sm:py-2.5 h-9 sm:h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-90 active:rotate-12 flex items-center justify-center gap-1.5 border border-slate-200 shadow-2xs shrink-0 ${
                isLocalRefreshing ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              title="ໂຫຼດຂໍ້ມູນຄືນຈາກ Supabase (Refresh Data)"
            >
              <ArrowClockwise
                size={16}
                weight="bold"
                className={`transition-transform duration-300 ${isLocalRefreshing ? 'animate-spin text-teal-600' : 'group-hover/ref:rotate-180'}`}
              />
              <span className="hidden sm:inline">ຣີເຟຣຊ</span>
            </button>
          )}

          {/* Export to Excel (Export theo filter: all / category / search) */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel || filteredProducts.length === 0}
            className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 h-9 sm:h-10 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title={`ດາວໂຫຼດ Excel (${filteredProducts.length} ສິນຄ້າ)`}
          >
            <FileArrowDown size={16} weight="bold" />
            <span className="hidden sm:inline">Export Excel</span>
            <span className="sm:hidden">Excel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playActionClickBeep('products');
              onAddNewProduct?.();
            }}
            className="px-3 sm:px-4 py-2 sm:py-2.5 h-9 sm:h-10 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
          >
            <Plus size={16} weight="bold" />
            <span>+ ເພີ່ມສິນຄ້າໃໝ່</span>
          </button>
        </div>
      </div>

      {/* 1.1 Top KPI Metrics (Matching Staff Management & GRN style) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 shrink-0">
        {/* Card 1: Total Products */}
        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black shrink-0">
            <Package size={20} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider truncate">ສິນຄ້າທັງໝົດ</div>
            <div className="text-lg font-black text-slate-900 font-mono truncate">{productStats.total}</div>
          </div>
        </div>

        {/* Card 2: In Stock */}
        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-black shrink-0">
            <CheckCircle size={20} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-teal-600 font-bold uppercase tracking-wider truncate">ພ້ອມຂາຍ (In Stock)</div>
            <div className="text-lg font-black text-teal-900 font-mono truncate">{productStats.inStock}</div>
          </div>
        </div>

        {/* Card 3: Low or Out of Stock */}
        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-black shrink-0">
            <WarningCircle size={20} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-rose-600 font-bold uppercase tracking-wider truncate">ໃກ້ໝົດ / ໝົດສະຕັອກ</div>
            <div className="text-lg font-black text-rose-900 font-mono truncate">{productStats.lowOrOutStock}</div>
          </div>
        </div>

        {/* Card 4: Categories */}
        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black shrink-0">
            <Folders size={20} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-amber-600 font-bold uppercase tracking-wider truncate">ໝວດໝູ່ (Categories)</div>
            <div className="text-lg font-black text-amber-900 font-mono truncate">{productStats.categoriesCount}</div>
          </div>
        </div>
      </div>

      {/* 2. Unified Sticky Toolbar: Responsive 2-row on Mobile, 1-row on Desktop */}
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md py-2 -mx-3 sm:-mx-5 md:-mx-6 px-3 sm:px-5 md:px-6 border-b border-slate-200 shadow-2xs mb-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full">
          {/* HÀNG 1: Ô TÌM KIẾM VÀ NÚT QUÉT MÃ VẠCH (SEARCH & SCAN) */}
          <div className="flex items-center gap-2 flex-1 w-full min-w-0">
            <div className="relative flex-1 min-w-0">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                id="product-search-input"
                type="text"
                data-barcode-input="true"
                data-barcode-replace="true"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                autoComplete="off"
                value={localSearch}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ, ໝວດໝູ່ ຫຼື ສະແກນ..."
                className="w-full pl-9 pr-9 md:pr-10 h-10 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium shadow-2xs"
              />
              {localSearch.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white rounded-md flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-95 transition-all"
                  title="ລຶບການຄົ້ນຫາ (Clear)"
                >
                  <X size={14} weight="bold" />
                </button>
              )}
            </div>

            {/* Nút Quét mã vạch: Mobile icon vuông w-10 h-10, Desktop có thêm chữ ສະແກນ */}
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="w-10 h-10 md:w-auto md:px-3.5 md:h-10 rounded-xl bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-700 transition-all cursor-pointer border border-teal-200 shadow-2xs flex items-center justify-center gap-1.5 active:scale-95 shrink-0 p-0 md:py-2"
              title="ເປີດກ້ອງສະແກນບາໂຄດສິນຄ້າ (Camera Barcode Scanner)"
            >
              <Barcode size={18} weight="bold" />
              <span className="hidden md:inline text-xs font-bold">ສະແກນ</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse hidden md:inline" />
            </button>
          </div>

          {/* HÀNG 2: CÁC NÚT LỌC VÀ CHỨC NĂNG (TÁCH XUỐNG HÀNG THỨ 2 TRÊN MOBILE) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 w-full md:w-auto">
            {/* Dropdown Danh mục (ທຸກໝວດໝູ່) */}
            <div ref={categoryDropdownRef} className="relative flex-1 md:w-48 lg:w-56 min-w-0 shrink-0">
              <button
                type="button"
                onClick={() => {
                  playActionClickBeep('products');
                  setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                }}
                className={`w-full px-2.5 h-10 bg-white border rounded-xl text-xs flex items-center justify-between gap-1.5 transition-all cursor-pointer shadow-2xs ${
                  isCategoryDropdownOpen
                    ? 'border-teal-600 ring-2 ring-teal-500/20 text-slate-900'
                    : selectedCategory !== 'ALL'
                    ? 'border-teal-500 bg-teal-50/40 text-teal-900 font-bold'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Folders
                    size={15}
                    weight={selectedCategory !== 'ALL' ? 'fill' : 'duotone'}
                    className={selectedCategory !== 'ALL' ? 'text-teal-600 shrink-0' : 'text-slate-400 shrink-0'}
                  />
                  <span className="truncate text-left font-medium">
                    {selectedCategory === 'ALL' ? 'ທຸກໝວດໝູ່' : selectedCategory}
                  </span>
                  {selectedCategory !== 'ALL' && (
                    <span className="px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold shrink-0">
                      {categoryOptions.list.find((c) => c.name === selectedCategory)?.count || 0}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 text-slate-400">
                  {selectedCategory !== 'ALL' && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCategory('ALL');
                        setCategorySearchTerm('');
                      }}
                      className="p-0.5 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                      title="ລ້າງໝວດໝູ່ (Reset)"
                    >
                      <X size={13} weight="bold" />
                    </span>
                  )}
                  {isCategoryDropdownOpen ? (
                    <CaretUp size={14} weight="bold" className="text-teal-600" />
                  ) : (
                    <CaretDown size={14} weight="bold" />
                  )}
                </div>
              </button>

              {/* Dropdown Popover */}
              {isCategoryDropdownOpen && (
                <div className="absolute left-0 right-0 sm:right-auto sm:w-72 top-full mt-1.5 z-50 bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col">
                  {/* Search inside Dropdown */}
                  <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                    <div className="relative">
                      <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        value={categorySearchTerm}
                        onChange={(e) => setCategorySearchTerm(e.target.value)}
                        placeholder="ຄົ້ນຫາຊື່ໝວດໝູ່..."
                        className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium shadow-2xs"
                      />
                      {categorySearchTerm && (
                        <button
                          type="button"
                          onClick={() => setCategorySearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={12} weight="bold" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Categories Options List */}
                  <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
                    {!categorySearchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('ALL');
                          setIsCategoryDropdownOpen(false);
                          setCategorySearchTerm('');
                        }}
                        className={`w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          selectedCategory === 'ALL'
                            ? 'bg-teal-50 text-teal-800 font-black'
                            : 'text-slate-700 hover:bg-slate-100 font-medium'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          {selectedCategory === 'ALL' && <Check size={14} weight="bold" className="text-teal-600" />}
                          <span>ທຸກໝວດໝູ່ (All Categories)</span>
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                          {categoryOptions.totalCount}
                        </span>
                      </button>
                    )}

                    {filteredCategoryOptions.length > 0 ? (
                      filteredCategoryOptions.map((cat) => {
                        const isSelected = selectedCategory === cat.name;
                        return (
                          <button
                            key={cat.name}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(cat.name);
                              setIsCategoryDropdownOpen(false);
                              setCategorySearchTerm('');
                            }}
                            className={`w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-teal-50 text-teal-800 font-black'
                                : 'text-slate-700 hover:bg-slate-100 font-medium'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              {isSelected && <Check size={14} weight="bold" className="text-teal-600 shrink-0" />}
                              <span className="truncate">{cat.name}</span>
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold shrink-0">
                              {cat.count}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="py-4 text-center text-xs text-slate-400 font-medium">
                        ບໍ່ພົບໝວດໝູ່ "${categorySearchTerm}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Nút Chọn nhiều (Checkbox toggle) */}
            {!isPriceEditMode && (
              <button
                type="button"
                onClick={() => {
                  if (isSelectionMode) {
                    setSelectedProductIds(new Set());
                  }
                  setIsSelectionMode(!isSelectionMode);
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                  isSelectionMode
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 ring-2 ring-emerald-300 border border-emerald-600'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200'
                }`}
                title={isSelectionMode ? `ປິດໂໝດເລືອກຫຼາຍ (ກຳລັງເລືອກ ${selectedProductIds.size})` : 'ເລືອກຫຼາຍລາຍການ (Multi-select)'}
              >
                <CheckSquare size={18} weight={isSelectionMode ? 'fill' : 'bold'} />
              </button>
            )}

            {/* Nút Sửa giá nhóm khi chọn nhiều */}
            {!isPriceEditMode && isSelectionMode && selectedProductIds.size > 0 && (
              <button
                type="button"
                onClick={handleOpenBulkPriceModal}
                className="px-2.5 h-10 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 shadow-md shadow-primary/20 active:scale-95 bg-primary hover:bg-primary-hover text-white animate-in zoom-in-95 duration-150"
                title={`ແກ້ໄຂລາຄາພ້ອມກັນ ${selectedProductIds.size} ສິນຄ້າ`}
              >
                <PencilLine size={15} weight="bold" />
                <span className="whitespace-nowrap">ແກ້ໄຂ ({selectedProductIds.size})</span>
              </button>
            )}

            {/* Nút Sửa nhanh (ແກ້ໄຂດ່ວນ) */}
            <button
              type="button"
              onClick={() => {
                if (isPriceEditMode && dirtyCount > 0) {
                  if (!window.confirm('ທ່ານມີການແກ້ໄຂລາຄາທີ່ຍັງບໍ່ທັນບັນທຶກ, ຕ້ອງການອອກແທ້ບໍ່?')) return;
                  setDirtyUnits({});
                  setDirtyCosts({});
                }
                const nextMode = !isPriceEditMode;
                setIsPriceEditMode(nextMode);
                if (nextMode) {
                  setIsSelectionMode(false);
                  setSelectedProductIds(new Set());
                }
              }}
              className={`h-10 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-2xs active:scale-95 ${
                isPriceEditMode
                  ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300 shadow-amber-500/20 shadow-md'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
              }`}
              title="ເປີດ/ປິດ ໂໝດແກ້ໄຂລາຄາສິນຄ້າດ່ວນ"
            >
              <CurrencyDollar size={16} weight="bold" />
              <span className="whitespace-nowrap">{isPriceEditMode ? 'ປິດແກ້ໄຂ' : 'ແກ້ໄຂດ່ວນ'}</span>
              {dirtyCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping ml-0.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Skeleton Loading State (While fetching data) */}
      {isLoading && products.length === 0 ? (
        <ProductsListSkeleton count={8} />
      ) : (
        <>
          {/* Scroll anchor for pagination scroll-to-top */}
          <div ref={tableTopRef} className="scroll-mt-3 sm:scroll-mt-4" />
          {/* 3. A: MOBILE VIEW (< 768px) - Touch-Optimized Card List */}
          <div className="md:hidden flex items-center justify-between pb-1.5 px-1">
            <span className="text-xs font-bold text-slate-500">
              ລາຍການສິນຄ້າ ({filteredProducts.length})
            </span>
            <button
              type="button"
              onClick={() => {
                playUnitChangeBeep('products');
                setProductSortOrder((prev) => (prev === 'newest_first' ? 'oldest_first' : 'newest_first'));
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer active:scale-95 transition-all ${
                productSortOrder === 'newest_first'
                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
              title="ກົດເພື່ອສະຫຼັບລະຫວ່າງ ໃໝ່ສຸດ / ເກົ່າສຸດ"
            >
              <ArrowsDownUp size={12} weight="bold" />
              <span>{productSortOrder === 'newest_first' ? 'ໃໝ່ສຸດ' : 'ເກົ່າສຸດ'}</span>
            </button>
          </div>
          <div className={`md:hidden flex flex-col gap-3 ${isPriceEditMode ? 'pb-32' : 'pb-8'}`}>
            {paginatedProducts.map((p) => {
              const info = getProductStockDetails(p, exchangeRate);
              const isHighlighted = p.id === scannedHighlightId;
              const isSelected = selectedProductIds.has(p.id);
              const units = p.units && p.units.length > 0
                ? [...p.units].sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1))
                : [
                    {
                      id: `${p.id}_base`,
                      productId: p.id,
                      unitName: p.baseUnit || 'ອັນ',
                      retailPrice: 0,
                      price_2: 0,
                      price_3: 0,
                    }
                  ];

              const isLakCurrency =
                (p.cost_currency || p.costCurrency) === 'LAK' ||
                (Number(p.costBaht ?? p.cost_thb ?? 0) === 0 && Number(p.costKip ?? p.cost_lak ?? p.costPerBaseUnit ?? 0) > 0);

              const maxMult = Math.max(1, ...(units || []).map((un) => Number(un.multiplier) || 1));
              const origCostLak = Number(p.costLak ?? p.cost_lak ?? p.costKip ?? (Number(p.costPerBaseUnit || 0) * maxMult) ?? 0);
              const origCostThb = Number(p.costBaht ?? p.cost_thb ?? 0);

              const curCostLak = dirtyCosts[p.id]?.cost_lak !== undefined ? dirtyCosts[p.id].cost_lak : origCostLak;
              const curCostThb = dirtyCosts[p.id]?.cost_thb !== undefined ? dirtyCosts[p.id].cost_thb : origCostThb;

              const isCostDirty = dirtyCosts[p.id] !== undefined;
              const isProductDirty = units.some((u) => Boolean(dirtyUnits[u.id])) || isCostDirty;

              const effectiveCostPerBaseUnit = dirtyCosts[p.id]?.cost_per_base_unit !== undefined
                ? dirtyCosts[p.id].cost_per_base_unit
                : (Number(p.costPerBaseUnit ?? p.cost_per_base_unit ?? 0) || (curCostLak > 0 ? Math.round(curCostLak / maxMult) : 0));

              if (isPriceEditMode) {
                return (
                  <div
                    key={p.id}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200 transition-all duration-300 shadow-xs flex flex-col gap-3"
                  >
                    {/* Product Header in Edit Mode with Thumbnail & Reset */}
                    <div className="flex items-start justify-between gap-2.5 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {p.imageUrl ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playActionClickBeep('products');
                              setPreviewProduct(p);
                            }}
                            className="relative group/thumb cursor-zoom-in shrink-0 rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-teal-500"
                            title="ກົດເພື່ອເບິ່ງຮູບຂະໜາດໃຫຍ່"
                          >
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              loading="lazy"
                              decoding="async"
                              className="w-12 h-12 rounded-xl object-cover bg-slate-100 border border-slate-200"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </button>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-slate-400">
                            <Package size={22} weight="duotone" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
                            {p.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                              {p.category || 'ທົ່ວໄປ'}
                            </span>
                            {p.barcode && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {p.barcode}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action: Reset Product Prices if dirty */}
                      {isProductDirty && (
                        <button
                          type="button"
                          onClick={() => handleResetProductPrices(p)}
                          className="p-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 transition-all cursor-pointer shrink-0 shadow-2xs active:scale-95"
                          title="ຣີເຊັດລາຄາສິນຄ້ານີ້ກັບຄືນຄ່າເດີມ"
                        >
                          <ArrowCounterClockwise size={16} weight="bold" />
                        </button>
                      )}
                    </div>

                    {/* Cost Info & Input in Mobile Edit Mode (Both Baht & Kip inputs for THB, single Kip for LAK) */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col gap-1.5 text-xs">
                      <span className="text-slate-500 font-bold font-sans">
                        ຕົ້ນທຶນ ({info.cartonUnitName}):
                      </span>

                      {isLakCurrency ? (
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={curCostLak > 0 ? Number(curCostLak).toLocaleString('de-DE') : ''}
                            onChange={(e) => handleProductCostChange(p, 'cost_lak', e.target.value)}
                            placeholder="0 ₭"
                            className={`w-full h-8 px-2.5 pr-6 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                              isCostDirty
                                ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                            }`}
                            title={`${info.cartonUnitName} - ຕົ້ນທຶນ (LAK)`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                            ₭
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={curCostThb > 0 ? Number(curCostThb).toLocaleString('de-DE') : ''}
                              onChange={(e) => handleProductCostChange(p, 'cost_thb', e.target.value)}
                              placeholder="0 ฿"
                              className={`w-full h-8 px-2.5 pr-6 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                isCostDirty
                                  ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                              }`}
                              title={`${info.cartonUnitName} - ຕົ້ນທຶນ (THB)`}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                              ฿
                            </span>
                          </div>

                          <div className="relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={curCostLak > 0 ? Number(curCostLak).toLocaleString('de-DE') : ''}
                              onChange={(e) => handleProductCostChange(p, 'cost_lak', e.target.value)}
                              placeholder="0 ₭"
                              className={`w-full h-8 px-2.5 pr-6 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                isCostDirty
                                  ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                              }`}
                              title={`${info.cartonUnitName} - ຕົ້ນທຶນ (LAK)`}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                              ₭
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Units Price Inputs in Mobile */}
                    <div className="flex flex-col gap-2">
                      {units.map((u) => {
                        const dirty = dirtyUnits[u.id];
                        const origRetail = Number(u.retailPrice ?? u.retail_price ?? 0);
                        const origPrice2 = Number(u.price_2 ?? u.price2 ?? u.wholesalePrice ?? 0);
                        const origPrice3 = Number(u.price_3 ?? u.price3 ?? 0);

                        const curRetail = dirty?.retail_price !== undefined ? dirty.retail_price : origRetail;
                        const curPrice2 = dirty?.price_2 !== undefined ? dirty.price_2 : origPrice2;
                        const curPrice3 = dirty?.price_3 !== undefined ? dirty.price_3 : origPrice3;

                        const isRetailDirty = dirty?.retail_price !== undefined && dirty.retail_price !== origRetail;
                        const isPrice2Dirty = dirty?.price_2 !== undefined && dirty.price_2 !== origPrice2;
                        const isPrice3Dirty = dirty?.price_3 !== undefined && dirty.price_3 !== origPrice3;
                        const isAnyDirty = isRetailDirty || isPrice2Dirty || isPrice3Dirty;

                        const unitCost = Math.round(effectiveCostPerBaseUnit * (Number(u.multiplier) || 1));
                        
                        const stepMult = getUnitStepMultiplier(u, units, p);

                        return (
                          <div
                            key={u.id}
                            className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${
                              isAnyDirty ? 'bg-amber-50/50 border-amber-300' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              {(() => {
                                const bConfig = getUnitBadgeConfig(u, units);
                                return (
                                  <span
                                    className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 min-h-[26px] rounded-md text-xs min-w-[68px] text-center border font-medium shadow-2xs ${bConfig.badge}`}
                                  >
                                    <span>{u.unitName}</span>
                                    {stepMult ? (
                                      <span className={`font-normal text-[10.5px] ${bConfig.mult}`}>(x{stepMult})</span>
                                    ) : null}
                                  </span>
                                );
                              })()}
                              {isAnyDirty && (
                                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                                  ແກ້ໄຂແລ້ວ
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-3 gap-1.5">
                              {/* Price 1 */}
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[9.5px] font-bold text-slate-500">ລາຄາ 1</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={curRetail > 0 ? Number(curRetail).toLocaleString('de-DE') : ''}
                                  onChange={(e) => handleUnitValueChange(u, 'retail_price', e.target.value)}
                                  placeholder="0"
                                  className={`w-full h-9 px-2 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                    isRetailDirty
                                      ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                  }`}
                                />
                              </div>

                              {/* Price 2 */}
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[9.5px] font-bold text-slate-500">ລາຄາ 2</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={curPrice2 > 0 ? Number(curPrice2).toLocaleString('de-DE') : ''}
                                  onChange={(e) => handleUnitValueChange(u, 'price_2', e.target.value)}
                                  placeholder="0"
                                  className={`w-full h-9 px-2 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                    isPrice2Dirty
                                      ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                  }`}
                                />
                              </div>

                              {/* Price 3 */}
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[9.5px] font-bold text-slate-500">ລາຄາ 3</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={curPrice3 > 0 ? Number(curPrice3).toLocaleString('de-DE') : ''}
                                  onChange={(e) => handleUnitValueChange(u, 'price_3', e.target.value)}
                                  placeholder="0"
                                  className={`w-full h-9 px-2 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                    isPrice3Dirty
                                      ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                  }`}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={p.id}
                  className={`p-3.5 bg-white rounded-2xl border transition-all duration-300 shadow-xs flex flex-col gap-3 ${
                    isHighlighted
                      ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-500 shadow-md'
                      : isSelected
                      ? 'border-indigo-400 bg-indigo-50/20'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Top Row: Checkbox, Thumbnail, Name, Category chip, Action Buttons */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isSelectionMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectProduct(p.id)}
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer shrink-0"
                        />
                      )}
                      {p.imageUrl ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playActionClickBeep('products');
                            setPreviewProduct(p);
                          }}
                          className="relative group/thumb cursor-zoom-in shrink-0 rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-teal-500"
                          title="ກົດເພື່ອເບິ່ງຮູບຂະໜາດໃຫຍ່ (Click to zoom image)"
                        >
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            loading="lazy"
                            decoding="async"
                            className="w-12 h-12 rounded-xl object-cover bg-slate-100 border border-slate-200 transition-transform duration-200 group-hover/thumb:scale-108"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/25 transition-colors flex items-center justify-center">
                            <MagnifyingGlassPlus size={16} className="text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity drop-shadow" />
                          </div>
                        </button>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-slate-400">
                          <Package size={22} weight="duotone" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-slate-900 text-sm leading-snug line-clamp-2">
                          {p.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10.5px] font-bold">
                            {p.category}
                          </span>
                          {p.units && p.units.some((u) => u.barcode) ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {p.units
                                .filter((u) => u.barcode)
                                .map((u) => (
                                  <span
                                    key={u.id}
                                    className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold"
                                    title={`${u.unitName}: ${u.barcode}`}
                                  >
                                    {u.unitName}: {u.barcode}
                                  </span>
                                ))}
                            </div>
                          ) : p.barcode && p.barcode !== p.id ? (
                            <span className="text-[10.5px] text-slate-400 font-mono truncate max-w-[120px]">
                              {p.barcode}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Min 44px Touch Targets */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenQuickProductPrice(p)}
                        className="w-10 h-10 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs"
                        title="ແກ້ໄຂລາຄາດ່ວນ (Quick Price Edit)"
                      >
                        <CurrencyDollar size={18} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playActionClickBeep('products');
                          onEditProduct(p);
                        }}
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                        title="ແກ້ໄຂ"
                      >
                        <PencilSimple size={18} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playErrorBeep('products');
                          onDeleteProduct(p.id, p.name);
                        }}
                        className="w-10 h-10 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                        title="ລຶບ"
                      >
                        <Trash size={18} weight="bold" />
                      </button>
                    </div>
                  </div>

              {/* Middle Row: Cost Breakdown (THB & LAK) & Packaging Ratio */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px] font-sans">ຕົ້ນທຶນ ({info.cartonUnitName}):</span>
                  {!isLakCurrency && (
                    <>
                      <span className="font-black text-slate-900">{formatBaht(info.cartonCostBaht)}</span>
                      <span className="text-slate-300">/</span>
                    </>
                  )}
                  <span className="font-black text-slate-800">{formatKip(info.cartonCostKip)}</span>
                </div>
                {info.cartonUnit && info.packUnit && (
                  <span className="text-[10px] text-slate-500 font-sans font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    1 {info.cName} = {info.packsPerCarton} {info.pName}
                  </span>
                )}
              </div>

              {/* Bottom Row: Selling Units & Stock Badge */}
              <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                {/* Selling Units Badges: Reversed order (highest to lowest) */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-bold shrink-0">ລາຄາ:</span>
                  {info.sortedUnitsDesc.map((u) => (
                    <span
                      key={u.id}
                      className="px-2 py-0.5 rounded-lg bg-teal-50 text-[11px] font-extrabold text-teal-800 border border-teal-200"
                    >
                      {u.unitName}: {formatKip(u.retailPrice)}
                    </span>
                  ))}
                </div>

                {/* Stock Badge with Clear Highlight */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold">ສາງຄົງເຫຼືອ:</span>
                  {info.isUntracked ? (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 font-bold text-[11px] border border-slate-200">
                      ບໍ່ນັບສາງ
                    </span>
                  ) : info.isNegativeStock ? (
                    <span className="text-rose-600 font-bold text-xs">
                      {info.negativeStockText}
                    </span>
                  ) : info.isZeroStock ? (
                    <span className="text-rose-600 font-semibold text-xs">
                      ໝົດສະຕັອກ (0)
                    </span>
                  ) : (
                    <div className="flex flex-col gap-0.5 items-end">
                      <div className="flex items-center gap-1.5 flex-wrap font-bold">
                        {info.cartonUnit && info.cartonCount > 0 && (
                          <span className="bg-amber-100 text-amber-950 px-2 py-0.5 rounded-md border border-amber-300 text-xs font-black">
                            {info.cartonCount} {info.cName}
                          </span>
                        )}
                        {info.packUnit && info.packCount > 0 && (
                          <span className="bg-sky-100 text-sky-950 px-2 py-0.5 rounded-md border border-sky-300 text-xs font-black">
                            {info.packCount} {info.pName}
                          </span>
                        )}
                        {info.pieceCount > 0 && (
                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200 text-xs font-black">
                            {info.pieceCount} {info.pcName}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        ລວມທັງໝົດ: {info.rawStock} {info.lowestUnitName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile-only pagination bar (< 768px) */}
      {filteredProducts.length > 0 && (
        <div className="md:hidden bg-white rounded-2xl border border-slate-200 p-3 mb-3 flex flex-col items-center gap-3 shadow-2xs">
          {/* Top: Page Size Selector (20 | 50 | 100 | 200 | All) */}
          <div className="flex items-center gap-2 w-full justify-between">
            <span className="text-xs text-slate-500 font-medium">
              ຈຳນວນຕໍ່ໜ້າ:
            </span>
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

          {/* Middle: Summary Text (Compact for iPad & Mobile) */}
          <div className="text-xs text-slate-600 font-medium text-center whitespace-nowrap shrink-0 px-1">
            {pageSize === 'ALL' ? (
              <span>
                ທັງໝົດ <strong className="text-slate-900 font-bold font-mono">{filteredProducts.length}</strong>
              </span>
            ) : (
              <span>
                <strong className="text-slate-900 font-bold font-mono">{Math.min((currentPage - 1) * pageSize + 1, filteredProducts.length)} - {Math.min(currentPage * pageSize, filteredProducts.length)}</strong>{' '}
                ຈາກ{' '}
                <strong className="text-slate-900 font-bold font-mono">{filteredProducts.length}</strong>
              </span>
            )}
          </div>

          {/* Bottom: Page Navigation (Only shown when not ALL) */}
          {pageSize !== 'ALL' && totalPages > 1 && (
            <div className="flex items-center gap-1 w-full justify-center">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                  currentPage === 1
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                    : 'border-slate-200 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 cursor-pointer active:scale-95'
                }`}
              >
                <CaretLeft size={13} weight="bold" />
                <span>ກ່ອນໜ້າ</span>
              </button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, idx) => {
                  if (page === '...') {
                    return (
                      <span key={`dots-${idx}`} className="px-1 text-slate-400 font-bold text-xs">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = currentPage === page;
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

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                  currentPage === totalPages
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

      {/* 3. B: TABLET & DESKTOP VIEW (>= 768px) - Responsive Horizontal Scroll Table */}
      <div className={`hidden md:block w-full rounded-2xl border border-slate-200 shadow-xs bg-white mb-3 overflow-hidden ${isPriceEditMode ? 'pb-24' : ''}`}>
        <div className="w-full overflow-x-auto overscroll-x-contain touch-pan-y">
          <table className="w-full min-w-[980px] text-left text-xs border-separate border-spacing-0">
          <thead>
            <tr className="sticky top-0 z-10 text-slate-700 font-extrabold [&_th]:border-b [&_th]:border-slate-200 [&_th]:bg-slate-50">
              {!isPriceEditMode && isSelectionMode && (
                <th className="py-3.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAllFiltered}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                    title="ເລືອກທັງໝົດໃນໜ້ານີ້"
                  />
                </th>
              )}
              {isPriceEditMode ? (
                <>
                  <th
                    className="py-3.5 px-4 w-[28%] min-w-[240px] cursor-pointer select-none hover:bg-slate-100/90 transition-colors group"
                    onClick={() => {
                      playUnitChangeBeep('products');
                      setProductSortOrder((prev) => (prev === 'newest_first' ? 'oldest_first' : 'newest_first'));
                    }}
                    title={
                      productSortOrder === 'newest_first'
                        ? 'ກຳລັງສະແດງ: ສິນຄ້າໃໝ່ສຸດຂຶ້ນເທິງ (ຄລິກເພື່ອປ່ຽນເປັນ ເກົ່າສຸດຂຶ້ນເທິງ)'
                        : 'ກຳລັງສະແດງ: ສິນຄ້າເກົ່າສຸດຂຶ້ນເທິງ (ຄລິກເພື່ອປ່ຽນເປັນ ໃໝ່ສຸດຂຶ້ນເທິງ)'
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="group-hover:text-teal-700 transition-colors">ຮູບ & ຂໍ້ມູນສິນຄ້າ</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition-all ${
                          productSortOrder === 'newest_first'
                            ? 'text-teal-700 bg-teal-100/80 border border-teal-200'
                            : 'text-amber-800 bg-amber-100/80 border border-amber-200'
                        }`}
                      >
                        <ArrowsDownUp size={12} weight="bold" />
                        <span>{productSortOrder === 'newest_first' ? 'ໃໝ່ສຸດ' : 'ເກົ່າສຸດ'}</span>
                      </span>
                    </div>
                  </th>
                  <th className="py-3.5 px-3 w-[15%] min-w-[120px]">ຕົ້ນທຶນບາດ (฿) & ກີບ (₭)</th>
                  <th className="py-3.5 px-3 w-[45%] min-w-[420px]">
                    <div className="flex items-center gap-2">
                      <span className="w-[70px] shrink-0 text-center font-bold">ຫົວໜ່ວຍ</span>
                      <div className="grid grid-cols-3 gap-2 flex-1 text-center font-bold">
                        <span>ລາຄາ 1 (ມາດຕະຖານ)</span>
                        <span>ລາຄາ 2 (ລູກຄ້າປະຈຳ)</span>
                        <span>ລາຄາ 3 (VIP/ຂາຍສົ່ງ)</span>
                      </div>
                    </div>
                  </th>
                  <th className="py-3.5 px-3 w-[12%] min-w-[110px]">ສາງຄົງເຫຼືອ (Stock)</th>
                  <th className="py-3.5 pl-2 pr-4 w-[5%] min-w-[50px] text-center">ຣີເຊັດ</th>
                </>
              ) : (
                <>
                  <th
                    className="py-3.5 px-4 w-[24%] min-w-[200px] cursor-pointer select-none hover:bg-slate-100/90 transition-colors group"
                    onClick={() => {
                      playUnitChangeBeep('products');
                      setProductSortOrder((prev) => (prev === 'newest_first' ? 'oldest_first' : 'newest_first'));
                    }}
                    title={
                      productSortOrder === 'newest_first'
                        ? 'ກຳລັງສະແດງ: ສິນຄ້າໃໝ່ສຸດຂຶ້ນເທິງ (ຄລິກເພື່ອປ່ຽນເປັນ ເກົ່າສຸດຂຶ້ນເທິງ)'
                        : 'ກຳລັງສະແດງ: ສິນຄ້າເກົ່າສຸດຂຶ້ນເທິງ (ຄລິກເພື່ອປ່ຽນເປັນ ໃໝ່ສຸດຂຶ້ນເທິງ)'
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="group-hover:text-teal-700 transition-colors">ຮູບ & ຊື່ສິນຄ້າ</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition-all ${
                          productSortOrder === 'newest_first'
                            ? 'text-teal-700 bg-teal-100/80 border border-teal-200'
                            : 'text-amber-800 bg-amber-100/80 border border-amber-200'
                        }`}
                      >
                        <ArrowsDownUp size={12} weight="bold" />
                        <span>{productSortOrder === 'newest_first' ? 'ໃໝ່ສຸດ' : 'ເກົ່າສຸດ'}</span>
                      </span>
                    </div>
                  </th>
                  <th className="py-3.5 px-3 w-[13%] min-w-[110px]">ໝວດໝູ່</th>
                  <th className="py-3.5 px-3 w-[15%] min-w-[110px]">ຕົ້ນທຶນບາດ (฿) & ກີບ (₭)</th>
                  <th className="py-3.5 px-3 w-[24%] min-w-[220px]">ລະດັບຫົວໜ່ວຍຂາຍ</th>
                  <th className="py-3.5 px-3 w-[15%] min-w-[130px]">ສາງຄົງເຫຼືອ (Stock)</th>
                  <th className="py-3.5 pl-3 pr-6 sm:pr-8 w-[9%] min-w-[105px] text-center">ຈັດການ</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="[&_td]:border-b [&_td]:border-slate-100">
            {paginatedProducts.map((p) => {
              const info = getProductStockDetails(p, exchangeRate);
              const isHighlighted = p.id === scannedHighlightId;
              const isSelected = selectedProductIds.has(p.id);
              const units = p.units && p.units.length > 0
                ? [...p.units].sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1))
                : [
                    {
                      id: `${p.id}_base`,
                      productId: p.id,
                      unitName: p.baseUnit || 'ອັນ',
                      multiplier: 1,
                      retailPrice: 0,
                      price_2: 0,
                      price_3: 0,
                    }
                  ];

              const isLakCurrency =
                (p.cost_currency || p.costCurrency) === 'LAK' ||
                (Number(p.costBaht ?? p.cost_thb ?? 0) === 0 && Number(p.costKip ?? p.cost_lak ?? p.costPerBaseUnit ?? 0) > 0);

              const maxMult = Math.max(1, ...(units || []).map((un) => Number(un.multiplier) || 1));
              const origCostLak = Number(p.costLak ?? p.cost_lak ?? p.costKip ?? (Number(p.costPerBaseUnit || 0) * maxMult) ?? 0);
              const origCostThb = Number(p.costBaht ?? p.cost_thb ?? 0);

              const curCostLak = dirtyCosts[p.id]?.cost_lak !== undefined ? dirtyCosts[p.id].cost_lak : origCostLak;
              const curCostThb = dirtyCosts[p.id]?.cost_thb !== undefined ? dirtyCosts[p.id].cost_thb : origCostThb;

              const isCostDirty = dirtyCosts[p.id] !== undefined;
              const isProductDirty = units.some((u) => Boolean(dirtyUnits[u.id])) || isCostDirty;

              const effectiveCostPerBaseUnit = dirtyCosts[p.id]?.cost_per_base_unit !== undefined
                ? dirtyCosts[p.id].cost_per_base_unit
                : (Number(p.costPerBaseUnit ?? p.cost_per_base_unit ?? 0) || (curCostLak > 0 ? Math.round(curCostLak / maxMult) : 0));

              if (isPriceEditMode) {
                return (
                  <tr
                    key={`${p.id}_edit`}
                    className="transition-colors duration-150 hover:bg-slate-50/90 bg-white border-b-[2.5px] border-slate-300/90 [&>td]:border-b-[2.5px] [&>td]:border-slate-300/90"
                  >
                    {/* CỘT 1: HÌNH ẢNH & THÔNG TIN SẢN PHẨM (GIỮ NGUYÊN BẢN GỐC) */}
                    <td className="py-3 px-4 align-top">
                      <div className="flex items-start gap-3">
                        {p.imageUrl ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playActionClickBeep('products');
                              setPreviewProduct(p);
                            }}
                            className="relative group/thumb cursor-zoom-in shrink-0 rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-teal-500"
                            title="ກົດເພື່ອເບິ່ງຮູບຂະໜາດໃຫຍ່ (Click to zoom image)"
                          >
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              loading="lazy"
                              decoding="async"
                              className="w-12 h-12 rounded-xl object-cover bg-slate-100 border border-slate-200 transition-transform duration-200 group-hover/thumb:scale-108"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/25 transition-colors flex items-center justify-center">
                              <MagnifyingGlassPlus size={15} className="text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity drop-shadow" />
                            </div>
                          </button>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-slate-400">
                            <Package size={22} weight="duotone" />
                          </div>
                        )}

                        <div className="min-w-0">
                          {/* Tên sản phẩm in đậm dòng trên (font-bold text-slate-800 text-sm) */}
                          <div className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
                            {p.name}
                          </div>

                          {/* Mã Barcode dòng dưới chữ xám nhỏ (text-xs text-slate-400) - chỉ hiển thị khi có barcode thực sự */}
                          {p.barcode && String(p.barcode).trim() && p.barcode !== p.id ? (
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {p.barcode}
                            </div>
                          ) : null}

                          {/* Badge Danh mục sản phẩm */}
                          <div className="mt-1">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10.5px] font-bold">
                              {p.category || 'ທົ່ວໄປ'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* CỘT 2: GIÁ VỐN (ຕົ້ນທຶນ: Bath ฿ / Kip ₭) */}
                    <td className="py-3 px-3 align-top">
                      <div className="flex flex-col gap-1.5 text-xs">
                        <span className="text-[10px] font-bold text-slate-400">
                          ຕົ້ນທຶນ ({info.cartonUnitName}):
                        </span>

                        {isLakCurrency ? (
                          /* CHỈ 1 Ô INPUT KÍP CHO SẢN PHẨM TIỀN KÍP */
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={curCostLak > 0 ? Number(curCostLak).toLocaleString('de-DE') : ''}
                              onChange={(e) => handleProductCostChange(p, 'cost_lak', e.target.value)}
                              placeholder="0 ₭"
                              className={`w-full h-9 px-2.5 pr-6 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                isCostDirty
                                  ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                              }`}
                              title={`${info.cartonUnitName} - ຕົ້ນທຶນ (LAK)`}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                              ₭
                            </span>
                          </div>
                        ) : (
                          /* ĐỦ 2 Ô INPUT: BAHT VÀ KÍP CHO SẢN PHẨM TIỀN BAHT */
                          <div className="flex flex-col gap-1.5">
                            {/* Input 1: Giá vốn Baht */}
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={curCostThb > 0 ? Number(curCostThb).toLocaleString('de-DE') : ''}
                                onChange={(e) => handleProductCostChange(p, 'cost_thb', e.target.value)}
                                placeholder="0 ฿"
                                className={`w-full h-8 px-2.5 pr-6 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                  isCostDirty
                                    ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                }`}
                                title={`${info.cartonUnitName} - ຕົ້ນທຶນ (THB)`}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                                ฿
                              </span>
                            </div>

                            {/* Input 2: Giá vốn Kíp */}
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={curCostLak > 0 ? Number(curCostLak).toLocaleString('de-DE') : ''}
                                onChange={(e) => handleProductCostChange(p, 'cost_lak', e.target.value)}
                                placeholder="0 ₭"
                                className={`w-full h-8 px-2.5 pr-6 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                  isCostDirty
                                    ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                }`}
                                title={`${info.cartonUnitName} - ຕົ້ນທຶນ (LAK)`}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                                ₭
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* CỘT 3: CÁC ĐƠN VỊ VÀ 3 MỨC GIÁ BÁN (GOM NHÓM RÕ RÀNG TRONG 1 Ô TD) */}
                    <td className="py-2 px-3 align-top">
                      <div className="flex flex-col">
                        {units.map((u) => {
                          const dirty = dirtyUnits[u.id];
                          const origRetail = Number(u.retailPrice ?? u.retail_price ?? 0);
                          const origPrice2 = Number(u.price_2 ?? u.price2 ?? u.wholesalePrice ?? 0);
                          const origPrice3 = Number(u.price_3 ?? u.price3 ?? 0);

                          const curRetail = dirty?.retail_price !== undefined ? dirty.retail_price : origRetail;
                          const curPrice2 = dirty?.price_2 !== undefined ? dirty.price_2 : origPrice2;
                          const curPrice3 = dirty?.price_3 !== undefined ? dirty.price_3 : origPrice3;

                          const isRetailDirty = dirty?.retail_price !== undefined && dirty.retail_price !== origRetail;
                          const isPrice2Dirty = dirty?.price_2 !== undefined && dirty.price_2 !== origPrice2;
                          const isPrice3Dirty = dirty?.price_3 !== undefined && dirty.price_3 !== origPrice3;

                          const unitCost = Math.round(effectiveCostPerBaseUnit * (Number(u.multiplier) || 1));
                          
                          const stepMult = getUnitStepMultiplier(u, units, p);

                          return (
                            <div
                              key={u.id}
                              className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-b-0"
                            >
                              {/* Badge tên đơn vị Pastel phân cấp rõ ràng */}
                              {(() => {
                                const bConfig = getUnitBadgeConfig(u, units);
                                return (
                                  <span
                                    className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 min-h-[28px] rounded-md text-xs min-w-[72px] text-center shrink-0 mt-0.5 border font-medium shadow-2xs ${bConfig.badge}`}
                                    title={`${u.unitName} (multiplier: ${u.multiplier})`}
                                  >
                                    <span>{u.unitName}</span>
                                    {stepMult ? (
                                      <span className={`font-normal text-[11px] ${bConfig.mult}`}>(x{stepMult})</span>
                                    ) : null}
                                  </span>
                                );
                              })()}

                              {/* 3 Ô INPUT TƯƠNG ỨNG VỚI 3 MỨC GIÁ CỦA ĐƠN VỊ ĐÓ */}
                              <div className="grid grid-cols-3 gap-2 flex-1">
                                {/* Ô Giá 1 (Giá lẻ / Tiêu chuẩn - ລາຄາ 1) */}
                                <div className="flex flex-col gap-0.5">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={curRetail > 0 ? Number(curRetail).toLocaleString('de-DE') : ''}
                                      onChange={(e) => handleUnitValueChange(u, 'retail_price', e.target.value)}
                                      placeholder="0 ₭"
                                      className={`w-full h-8 px-2 pr-5 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                        isRetailDirty
                                          ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                          : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                      }`}
                                      title={`${u.unitName} - ລາຄາ 1 (ມາດຕະຖານ)`}
                                    />
                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none">
                                      ₭
                                    </span>
                                  </div>

                                </div>

                                {/* Ô Giá 2 (Khách sỉ / Quen - ລາຄາ 2) */}
                                <div className="flex flex-col gap-0.5">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={curPrice2 > 0 ? Number(curPrice2).toLocaleString('de-DE') : ''}
                                      onChange={(e) => handleUnitValueChange(u, 'price_2', e.target.value)}
                                      placeholder="0 ₭"
                                      className={`w-full h-8 px-2 pr-5 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                        isPrice2Dirty
                                          ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                          : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                      }`}
                                      title={`${u.unitName} - ລາຄາ 2 (ລູກຄ້າປະຈຳ)`}
                                    />
                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none">
                                      ₭
                                    </span>
                                  </div>

                                </div>

                                {/* Ô Giá 3 (VIP / Đại lý - ລາຄາ 3) */}
                                <div className="flex flex-col gap-0.5">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={curPrice3 > 0 ? Number(curPrice3).toLocaleString('de-DE') : ''}
                                      onChange={(e) => handleUnitValueChange(u, 'price_3', e.target.value)}
                                      placeholder="0 ₭"
                                      className={`w-full h-8 px-2 pr-5 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                        isPrice3Dirty
                                          ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                          : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                      }`}
                                      title={`${u.unitName} - ລາຄາ 3 (VIP/ຂາຍສົ່ງ)`}
                                    />
                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none">
                                      ₭
                                    </span>
                                  </div>

                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    {/* CỘT 4: TỒN KHO THEO ĐƠN VỊ */}
                    <td className="py-3 px-3 align-top">
                      {info.isUntracked ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 font-bold text-[11px] border border-slate-200">
                          ບໍ່ນັບສາງ
                        </span>
                      ) : info.isNegativeStock ? (
                        <span className="text-rose-600 font-bold text-xs inline-block">
                          {info.negativeStockText}
                        </span>
                      ) : info.isZeroStock ? (
                        <span className="text-rose-600 font-semibold text-xs inline-block">
                          ໝົດສະຕັອກ (0)
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap font-bold">
                            {info.cartonUnit && info.cartonCount > 0 && (
                              <span className="bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded-md border border-amber-200 text-[11px]">
                                {info.cartonCount} {info.cName}
                              </span>
                            )}
                            {info.packUnit && info.packCount > 0 && (
                              <span className="bg-sky-50 text-sky-900 px-1.5 py-0.5 rounded-md border border-sky-200 text-[11px]">
                                {info.packCount} {info.pName}
                              </span>
                            )}
                            {info.pieceCount > 0 && (
                              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md border border-slate-200 text-[11px]">
                                {info.pieceCount} {info.pcName}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            ລວມ: {info.rawStock} {info.lowestUnitName}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* CỘT 5: THAO TÁC / RESET */}
                    <td className="py-3 pl-2 pr-4 align-middle text-center">
                      {isProductDirty ? (
                        <button
                          type="button"
                          onClick={() => handleResetProductPrices(p)}
                          className="p-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 transition-all cursor-pointer shadow-2xs active:scale-95"
                          title="ຣີເຊັດລາຄາສິນຄ້ານີ້ກັບຄືນຄ່າເດີມ"
                        >
                          <ArrowCounterClockwise size={16} weight="bold" />
                        </button>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={p.id}
                  className={`transition-colors duration-150 border-b border-slate-100 [&>td]:border-b [&>td]:border-slate-100 ${
                    isHighlighted
                      ? 'bg-teal-50 ring-2 ring-teal-500 shadow-sm'
                      : isSelected
                      ? 'bg-indigo-50/30'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* Selection Checkbox */}
                  {isSelectionMode && (
                    <td className="py-3 px-3 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectProduct(p.id)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                    </td>
                  )}
                  {/* Image & Name */}
                  <td className="py-3 px-4 flex items-center gap-3">
                    {p.imageUrl ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playActionClickBeep('products');
                          setPreviewProduct(p);
                        }}
                        className="relative group/thumb cursor-zoom-in shrink-0 rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-teal-500"
                        title="ກົດເພື່ອເບິ່ງຮູບຂະໜາດໃຫຍ່ (Click to zoom image)"
                      >
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          className="w-11 h-11 rounded-xl object-cover bg-slate-100 border border-slate-200 transition-transform duration-200 group-hover/thumb:scale-108"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/25 transition-colors flex items-center justify-center">
                          <MagnifyingGlassPlus size={15} className="text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity drop-shadow" />
                        </div>
                      </button>
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-slate-400">
                        <Package size={20} weight="duotone" />
                      </div>
                    )}
                    <div>
                      <div className="font-extrabold text-slate-900 text-xs">
                        {p.name}
                      </div>
                      {p.units && p.units.some((u) => u.barcode) ? (
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {p.units
                            .filter((u) => u.barcode)
                            .map((u) => (
                              <span
                                key={u.id}
                                className="text-[9.5px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold"
                                title={`${u.unitName}: ${u.barcode}`}
                              >
                                {u.unitName}: {u.barcode}
                              </span>
                            ))}
                        </div>
                      ) : p.barcode && String(p.barcode).trim() && p.barcode !== p.id ? (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {p.barcode}
                        </div>
                      ) : null}
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                      {p.category}
                    </span>
                  </td>

                  {/* Cost breakdown */}
                  <td className="py-3 px-3">
                    <div className="flex flex-col gap-0.5 text-xs">
                      {!isLakCurrency && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-[10px] font-bold text-slate-400 w-3">฿</span>
                          <span className="font-extrabold text-slate-900">
                            {formatBaht(info.cartonCostBaht).replace(' ฿', '')} ฿
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans">
                            / {info.cartonUnitName}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-[10px] font-bold text-slate-400 w-3">₭</span>
                        <span className="font-extrabold text-slate-800">
                          {formatKip(info.cartonCostKip).replace(' ₭', '')} ₭
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          / {info.cartonUnitName}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Units Chips: Reversed order (Highest to lowest unit) */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {info.sortedUnitsDesc.map((u) => (
                        <span
                          key={u.id}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-[10.5px] font-bold text-slate-700 border border-slate-200"
                        >
                          {u.unitName}: {formatKip(u.retailPrice)}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Stock Column */}
                  <td className="py-3 px-3">
                    {info.isUntracked ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 font-bold text-[11px] border border-slate-200">
                        ບໍ່ນັບສາງ
                      </span>
                    ) : info.isNegativeStock ? (
                      <span className="text-rose-600 font-bold text-xs inline-block">
                        {info.negativeStockText}
                      </span>
                    ) : info.isZeroStock ? (
                      <span className="text-rose-600 font-semibold text-xs inline-block">
                        ໝົດສະຕັອກ (0)
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap font-bold">
                          {info.cartonUnit && info.cartonCount > 0 && (
                            <span className="bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded-md border border-amber-200 text-[11px]">
                              {info.cartonCount} {info.cName}
                            </span>
                          )}
                          {info.packUnit && info.packCount > 0 && (
                            <span className="bg-sky-50 text-sky-900 px-1.5 py-0.5 rounded-md border border-sky-200 text-[11px]">
                              {info.packCount} {info.pName}
                            </span>
                          )}
                          {info.pieceCount > 0 && (
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md border border-slate-200 text-[11px]">
                              {info.pieceCount} {info.pcName}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          ລວມທັງໝົດ: {info.rawStock} {info.lowestUnitName}
                        </span>
                      </div>
                    )}
                  </td>


                  {/* Action Column */}
                  <td className="py-3 pl-3 pr-6 sm:pr-8 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenQuickProductPrice(p)}
                        className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs transition-colors cursor-pointer shadow-2xs"
                        title="ແກ້ໄຂລາຄາດ່ວນ (Quick Price Edit)"
                      >
                        <CurrencyDollar size={15} weight="bold" />
                      </button>
                      <button
                        onClick={() => {
                          playActionClickBeep('products');
                          onEditProduct(p);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors cursor-pointer"
                        title="ແກ້ໄຂ"
                      >
                        <PencilSimple size={15} />
                      </button>
                      <button
                        onClick={() => {
                          playErrorBeep('products');
                          onDeleteProduct(p.id, p.name);
                        }}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs transition-colors cursor-pointer"
                        title="ລຶບ"
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {/* Attached Desktop Pagination Bar (Seamless with table, 0 gap) */}
        {filteredProducts.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Left: Page Size Selector (20 | 50 | 100 | 200 | All) */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
              <span className="text-xs text-slate-500 font-medium">
                ຈຳນວນຕໍ່ໜ້າ:
              </span>
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

            {/* Middle: Summary Text (Compact for iPad & Responsive) */}
            <div className="text-xs text-slate-600 font-medium text-center whitespace-nowrap shrink-0 px-2">
              {pageSize === 'ALL' ? (
                <span>
                  ທັງໝົດ <strong className="text-slate-900 font-bold font-mono">{filteredProducts.length}</strong>
                </span>
              ) : (
                <span>
                  <strong className="text-slate-900 font-bold font-mono">{Math.min((currentPage - 1) * pageSize + 1, filteredProducts.length)} - {Math.min(currentPage * pageSize, filteredProducts.length)}</strong>{' '}
                  ຈາກ{' '}
                  <strong className="text-slate-900 font-bold font-mono">{filteredProducts.length}</strong>
                </span>
              )}
            </div>

            {/* Right: Page Navigation (Only shown when not ALL) */}
            {pageSize !== 'ALL' && totalPages > 1 && (
              <div className="flex items-center gap-1 w-full md:w-auto justify-center md:justify-end">
                {/* Previous Page */}
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                    currentPage === 1
                      ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                      : 'border-slate-200 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 cursor-pointer active:scale-95'
                  }`}
                >
                  <CaretLeft size={13} weight="bold" />
                  <span className="hidden sm:inline">ກ່ອນໜ້າ</span>
                </button>

                {/* Number buttons with smart truncation */}
                <div className="flex items-center gap-1">
                  {getPageNumbers().map((page, idx) => {
                    if (page === '...') {
                      return (
                        <span key={`dots-${idx}`} className="px-1 text-slate-400 font-bold text-xs">
                          ...
                        </span>
                      );
                    }
                    const isCurrent = currentPage === page;
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
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                    currentPage === totalPages
                      ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                      : 'border-slate-200 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 cursor-pointer active:scale-95'
                  }`}
                >
                  <span className="hidden sm:inline">ຕໍ່ໄປ</span>
                  <CaretRight size={13} weight="bold" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )}

      {/* Empty State */}
      {!isLoading && filteredProducts.length === 0 && (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 mt-2">
          <Package size={40} className="mb-2 opacity-50" />
          <p className="text-xs font-bold text-slate-600">
            {searchTerm ? `ບໍ່ພົບສິນຄ້າທີ່ກົງກັບ "${searchTerm}"` : 'ຍັງບໍ່ມີສິນຄ້າໃນລະບົບ (ບໍ່ມີຂໍ້ມູນ)'}
          </p>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="mt-2 text-xs font-bold text-teal-700 hover:underline cursor-pointer"
            >
              ລ້າງການຄົ້ນຫາ
            </button>
          )}
        </div>
      )}

      {/* Toast Feedback for Barcode Scanning */}
      {scanToast && (
        <div
          className={`fixed top-[max(3.5rem,calc(env(safe-area-inset-top,0px)+0.75rem))] left-1/2 -translate-x-1/2 z-[130] px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-black animate-in fade-in slide-in-from-top-4 duration-200 border ${
            scanToast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {scanToast.type === 'success' ? (
            <CheckCircle size={18} weight="fill" />
          ) : (
            <WarningCircle size={18} weight="fill" />
          )}
          <span>{scanToast.message}</span>
        </div>
      )}

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanBarcode}
        onScan={handleScanBarcode}
        title="ສະແກນບາໂຄດຄົ້ນຫາສິນຄ້າ (Product Scanner)"
        description="ສ່ອງກ້ອງຫຼັງໃສ່ບາໂຄດສິນຄ້າເພື່ອກວດສອບ ແລະ ແກ້ໄຂຂໍ້ມູນທັນທີ"
      />

      {/* Product Image Zoom / Lightbox Modal Popup */}
      {previewProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setPreviewProduct(null)}
        >
          <div
            className="relative max-w-xl w-full bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Name, Category, Barcode & Close Button */}
            <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/90">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  {previewProduct.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 text-[10.5px] font-bold border border-teal-500/30">
                    {previewProduct.category || 'ທົ່ວໄປ'}
                  </span>
                  {previewProduct.barcode && (
                    <span className="text-[10.5px] text-slate-400 font-mono font-bold">
                      #{previewProduct.barcode}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="ປິດ (Close - ESC)"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {/* Big High-Res Image Display */}
            <div className="p-3 sm:p-5 bg-slate-950 flex items-center justify-center max-h-[70vh] sm:max-h-[75vh] overflow-hidden">
              <img
                src={previewProduct.imageUrl}
                alt={previewProduct.name}
                className="max-h-[62vh] w-auto max-w-full object-contain rounded-2xl shadow-xl border border-white/5"
              />
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-3 sm:p-3.5 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                ກົດ <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">ESC</kbd> ຫຼື ກົດພື້ນຫຼັງເພື່ອປິດ
              </div>

              <button
                type="button"
                onClick={() => {
                  const p = previewProduct;
                  setPreviewProduct(null);
                  onEditProduct?.(p);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <PencilSimple size={15} weight="bold" />
                <span>ແກ້ໄຂສິນຄ້າ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Sticky Bottom Action Bar (Overlays mobile bottomTab with z-[70]) */}
      {isPriceEditMode && (
        <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white/98 backdrop-blur-md border-t-2 border-amber-400 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] px-3 py-2.5 sm:px-6 sm:py-3.5 flex items-center justify-between animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
              <Tag size={18} weight="fill" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5 sm:gap-2">
                <span className="truncate">ແກ້ໄຂດ່ວນ</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-bold shrink-0 ${
                    dirtyCount > 0 ? 'bg-amber-500 text-white shadow-2xs' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {dirtyCount} ລາຍການ
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                ບັນທຶກລົງ Supabase ໂດຍກົງ ແລະ ຊິງຄ໌ທຸກ iPad ອັດຕະໂນມັດ 
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Nút Thoát khỏi chế độ Sửa hàng loạt */}
            <button
              type="button"
              onClick={() => {
                if (dirtyCount > 0) {
                  if (!window.confirm('ທ່ານມີການແກ້ໄຂລາຄາທີ່ຍັງບໍ່ທັນບັນທຶກ, ຕ້ອງການອອກແທ້ບໍ່?')) return;
                  setDirtyUnits({});
                  setDirtyCosts({});
                }
                setIsPriceEditMode(false);
              }}
              className="px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 min-h-[40px] sm:min-h-[44px] active:scale-95 shadow-2xs"
              title="ອອກຈາກໂໝດແກ້ໄຂດ່ວນ (Exit Edit Mode)"
            >
              <X size={15} weight="bold" />
              <span>ອອກ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDirtyUnits({});
                setDirtyCosts({});
              }}
              disabled={dirtyCount === 0 || isSavingPrices}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[40px] sm:min-h-[44px]"
            >
              ຍົກເລີກ {dirtyCount > 0 ? `(${dirtyCount})` : ''}
            </button>

            <button
              type="button"
              onClick={handleSaveInlinePrices}
              disabled={dirtyCount === 0 || isSavingPrices}
              className="px-3.5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs sm:text-sm font-black transition-all shadow-md shadow-amber-600/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 sm:gap-2 min-h-[40px] sm:min-h-[44px]"
            >
              {isSavingPrices ? (
                <ArrowClockwise size={16} className="animate-spin" />
              ) : (
                <CheckCircle size={16} weight="fill" />
              )}
              <span>ບັນທຶກ {dirtyCount > 0 ? `(${dirtyCount})` : ''}</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode 3: Bulk Price Adjustment Modal */}
      <BulkPriceModal
        isOpen={isBulkModalOpen}
        onClose={handleCloseBulkPriceModal}
        selectedProducts={selectedProductsForModal}
        initialTab={bulkModalInitialTab}
        exchangeRate={exchangeRate}
        onApplyBulkPrices={handleApplyBulkPrices}
      />

      {/* Toast Feedback for Price Updates */}
      {priceToast && (
        <div className="fixed top-[max(3.5rem,calc(env(safe-area-inset-top,0px)+0.75rem))] left-1/2 -translate-x-1/2 z-[140] px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-black animate-in fade-in slide-in-from-top-4 duration-200 border bg-emerald-600 text-white border-emerald-500">
          <CheckCircle size={18} weight="fill" />
          <span>{priceToast.message}</span>
        </div>
      )}
    </main>
  );
}
