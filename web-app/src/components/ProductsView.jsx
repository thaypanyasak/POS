import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Warehouse,
  Plus,
  PencilSimple,
  Trash,
  Package,
  ArrowClockwise,
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
} from '@phosphor-icons/react';
import { formatKip, formatBaht, getCartonUnitInfo, formatStockDisplay, formatNegativeStockCompound, normalizeLao } from '../utils/formatters';
import BarcodeScannerModal from './BarcodeScannerModal';
import { useHardwareBarcodeScanner } from '../hooks/useHardwareBarcodeScanner';
import { playSuccessBeep, playErrorBeep, playActionClickBeep, playUnitChangeBeep } from '../utils/audioFeedback';
import { ProductsListSkeleton } from './common/SkeletonLoaders';
import { useAuthRole } from '../contexts/AuthContext';

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

  const handleClearSearch = () => {
    setSearchTerm('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Extract categories and product counts
  const categoryOptions = useMemo(() => {
    const counts = {};
    (products || []).forEach((p) => {
      const cat = (p.category || 'ທົ່ວໄປ').trim();
      counts[cat] = (counts[cat] || 0) + 1;
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

  // Combined product filtering by category and search query
  const filteredProducts = useMemo(() => {
    let list = products || [];

    // 1. Category Filter
    if (selectedCategory && selectedCategory !== 'ALL') {
      list = list.filter((p) => (p.category || 'ທົ່ວໄປ').trim() === selectedCategory);
    }

    // 2. Search Query Filter
    const q = normalizeLao(searchTerm);
    if (!q) return list;
    return list.filter((p) => {
      return (
        (p.name && normalizeLao(p.name).includes(q)) ||
        (p.barcode && normalizeLao(p.barcode).includes(q)) ||
        (p.category && normalizeLao(p.category).includes(q)) ||
        (p.units &&
          p.units.some(
            (u) =>
              normalizeLao(u.unitName).includes(q) ||
              (u.barcode && normalizeLao(u.barcode).includes(q))
          ))
      );
    });
  }, [products, searchTerm, selectedCategory]);

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

  // Auto-reset currentPage to 1 when search query or category filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

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

  const paginatedProducts = useMemo(() => {
    if (pageSize === 'ALL' || !pageSize) {
      return filteredProducts;
    }
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

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
    const cleanCode = String(barcode).replace(/[\r\n\t\x00-\x1F\x7F]/g, '').trim();
    if (!cleanCode) return;

    setSearchTerm(cleanCode);

    // Direct DOM sync so input displays value immediately even without focus
    const inputEl = searchInputRef.current || document.getElementById('product-search-input');
    if (inputEl) {
      const proto = window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(inputEl, cleanCode);
      } else {
        inputEl.value = cleanCode;
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    setScannerOpen(false);

    const cleanLower = cleanCode.toLowerCase();
    const matched = products.find(
      (p) =>
        (p.barcode && String(p.barcode).trim().toLowerCase() === cleanLower) ||
        (p.units &&
          p.units.some(
            (u) => u.barcode && String(u.barcode).trim().toLowerCase() === cleanLower
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
      className="flex-1 w-full p-3 sm:p-5 md:p-6 overflow-y-auto font-sans min-h-0 pb-4 sm:pb-6 touch-pan-y"
      style={{
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* 1. Header Toolbar: Standardized responsive header matching GRN */}
      <div className="bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3.5 -mx-3 sm:-mx-5 md:-mx-6 -mt-3 sm:-mt-5 md:-mt-6 mb-3 sm:mb-4 flex items-center justify-between gap-2.5 sm:gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
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

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onOpenCategoryManager && (
            <button
              type="button"
              onClick={() => {
                playActionClickBeep('products');
                onOpenCategoryManager();
              }}
              className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs"
              title="ຈັດການໝວດໝູ່ສິນຄ້າ"
            >
              <Folders size={15} weight="bold" className="text-teal-700" />
              <span className="hidden sm:inline">ໝວດໝູ່</span>
            </button>
          )}

          {onOpenBundleManager && (
            <button
              type="button"
              onClick={() => {
                playActionClickBeep('products');
                onOpenBundleManager();
              }}
              className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-teal-50 hover:bg-teal-100/80 text-teal-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border border-teal-200/80 shadow-2xs"
              title="ຈັດການກຸ່ມສິນຄ້າລວມ (Mixed Carton Bundles)"
            >
              <Package size={15} weight="bold" className="text-teal-600" />
              <span className="hidden sm:inline">ກຸ່ມລວມ Mix</span>
            </button>
          )}

          {onRefreshProducts && (
            <button
              type="button"
              onClick={() => {
                playUnitChangeBeep('products');
                onRefreshProducts();
              }}
              disabled={isLoading}
              className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs"
              title="ໂຫຼດຂໍ້ມູນຄືນຈາກ Supabase"
            >
              <ArrowClockwise size={15} className={isLoading ? 'animate-spin' : ''} weight="bold" />
              <span className="hidden sm:inline">ຣີເຟຣຊ</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              playActionClickBeep('products');
              onAddNewProduct?.();
            }}
            className="px-3 sm:px-4 py-2 sm:py-2.5 h-9 sm:h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
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

      {/* 2. Search Bar, Category Dropdown & Barcode Scanner Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
          {/* Barcode & Text Search Input */}
          <div className="relative flex-1 min-w-0">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              id="product-search-input"
              type="text"
              data-barcode-replace="true"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ, ໝວດໝູ່ ຫຼື ສະແກນບາໂຄດ..."
              className="w-full pl-9 pr-32 py-2.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium shadow-2xs min-h-[44px] sm:min-h-0"
            />

            {/* Quick Clear 'X' Button */}
            {searchTerm.length > 0 && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-22 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer flex items-center justify-center active:scale-90"
                title="ລຶບການຄົ້ນຫາ (Clear search)"
              >
                <XCircle size={17} weight="fill" />
              </button>
            )}

            {/* Barcode / Camera Button inside Search Bar */}
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 sm:py-1 rounded-lg bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-700 transition-all cursor-pointer border border-teal-200 shadow-2xs flex items-center gap-1 active:scale-95"
              title="ເປີດກ້ອງສະແກນບາໂຄດສິນຄ້າ (Camera Barcode Scanner) • ຮອງຮັບເຄື່ອງຍິງບາໂຄດ USB/Bluetooth ອັດຕະໂນມັດ"
            >
              <Barcode size={15} weight="bold" />
              <span className="text-[10.5px] font-bold">ສະແກນ</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" title="Hardware Scanner Ready"></span>
            </button>
          </div>

          {/* Searchable Category Select Dropdown */}
          <div ref={categoryDropdownRef} className="relative w-full sm:w-64 shrink-0">
            <button
              type="button"
              onClick={() => {
                playActionClickBeep('products');
                setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
              }}
              className={`w-full px-3 py-2.5 sm:py-2 bg-white border rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs min-h-[44px] sm:min-h-0 ${
                isCategoryDropdownOpen
                  ? 'border-teal-600 ring-2 ring-teal-500/20 text-slate-900'
                  : selectedCategory !== 'ALL'
                  ? 'border-teal-500 bg-teal-50/40 text-teal-900 font-bold'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Folders
                  size={16}
                  weight={selectedCategory !== 'ALL' ? 'fill' : 'duotone'}
                  className={selectedCategory !== 'ALL' ? 'text-teal-600 shrink-0' : 'text-slate-400 shrink-0'}
                />
                <span className="truncate text-left font-medium">
                  {selectedCategory === 'ALL' ? 'ທຸກໝວດໝູ່ (All Categories)' : selectedCategory}
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
                  {/* Option: All Categories */}
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
                      ບໍ່ພົບໝວດໝູ່ "{categorySearchTerm}"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Summary Feedback */}
        {(searchTerm || selectedCategory !== 'ALL') && (
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <span className="text-xs text-slate-500 font-medium">
              ພົບ <strong className="text-slate-800">{filteredProducts.length}</strong> ສິນຄ້າ
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('ALL');
              }}
              className="text-xs font-bold text-teal-700 hover:underline cursor-pointer py-1 px-2"
            >
              ລຶບຕົວກັ່ນຕອງທັງໝົດ
            </button>
          </div>
        )}
      </div>

      {/* 3. Skeleton Loading State (While fetching data) */}
      {isLoading && products.length === 0 ? (
        <ProductsListSkeleton count={8} />
      ) : (
        <>
          {/* Scroll anchor for pagination scroll-to-top */}
          <div ref={tableTopRef} className="scroll-mt-3 sm:scroll-mt-4" />
          {/* 3. A: MOBILE VIEW (< 768px) - Touch-Optimized Card List */}
          <div className="md:hidden flex flex-col gap-3 pb-8">
            {paginatedProducts.map((p) => {
          const info = getProductStockDetails(p, exchangeRate);
          const isHighlighted = p.id === scannedHighlightId;

          return (
            <div
              key={p.id}
              className={`p-3.5 bg-white rounded-2xl border transition-all duration-300 shadow-xs flex flex-col gap-3 ${
                isHighlighted
                  ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-500 shadow-md'
                  : 'border-slate-200'
              }`}
            >
              {/* Top Row: Thumbnail, Name, Category chip, Action Buttons */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-3 min-w-0">
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
                      ) : p.barcode ? (
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
                  <span className="font-black text-slate-900">{formatBaht(info.cartonCostBaht)}</span>
                  <span className="text-slate-300">/</span>
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
      <div className="hidden md:block w-full rounded-2xl border border-slate-200 shadow-xs bg-white mb-3 overflow-hidden">
        <div className="w-full overflow-x-auto overscroll-x-contain touch-pan-y">
          <table className="w-full min-w-[980px] text-left text-xs border-separate border-spacing-0">
          <thead>
            <tr className="sticky top-0 z-10 text-slate-700 font-extrabold [&_th]:border-b [&_th]:border-slate-200 [&_th]:bg-slate-50">
              <th className="py-3.5 px-4 w-[24%] min-w-[200px]">ຮູບ & ຊື່ສິນຄ້າ</th>
              <th className="py-3.5 px-3 w-[13%] min-w-[110px]">ໝວດໝູ່</th>
              <th className="py-3.5 px-3 w-[15%] min-w-[110px]">ຕົ້ນທຶນບາດ (฿) & ກີບ (₭)</th>
              <th className="py-3.5 px-3 w-[24%] min-w-[220px]">ລະດັບຫົວໜ່ວຍຂາຍ</th>
              <th className="py-3.5 px-3 w-[15%] min-w-[130px]">ສາງຄົງເຫຼືອ (Stock)</th>
              <th className="py-3.5 pl-3 pr-6 sm:pr-8 w-[9%] min-w-[105px] text-center">ຈັດການ</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-b [&_td]:border-slate-100">
            {paginatedProducts.map((p) => {
              const info = getProductStockDetails(p, exchangeRate);
              const isHighlighted = p.id === scannedHighlightId;

              return (
                <tr
                  key={p.id}
                  className={`transition-colors duration-150 ${
                    isHighlighted
                      ? 'bg-teal-50 ring-2 ring-teal-500 shadow-sm'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
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
                      ) : (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {p.barcode || 'ບໍ່ມີບາໂຄດ'}
                        </div>
                      )}
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
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-[10px] font-bold text-slate-400 w-3">฿</span>
                        <span className="font-extrabold text-slate-900">
                          {formatBaht(info.cartonCostBaht).replace(' ฿', '')} ฿
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          / {info.cartonUnitName}
                        </span>
                      </div>
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
                    <div className="flex items-center justify-center gap-2">
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
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[130] px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-black animate-in fade-in slide-in-from-top-4 duration-200 border ${
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
    </main>
  );
}
