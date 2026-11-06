import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  MagnifyingGlassPlus,
  Folders,
  Folder,
  Plus,
  MagnifyingGlass,
  X,
  PencilSimple,
  Trash,
  Eye,
  Package,
  Barcode,
  ArrowClockwise,
  Check,
  Tag,
  CurrencyCircleDollar,
  WarningCircle,
  Archive,
  ChartBar,
  CaretDown,
  CaretRight,
  FolderPlus,
  DotsSixVertical,
} from '@phosphor-icons/react';
import { formatCompoundStock, formatKip, normalizeLao } from '../utils/formatters';
import { playActionClickBeep, playSuccessBeep, playUnitChangeBeep } from '../utils/audioFeedback';
import { useHardwareBarcodeScanner } from '../hooks/useHardwareBarcodeScanner';

/**
 * Modal to view all products belonging to a specific category
 * Supports adding existing products into category, removing products, or creating new product
 */
function CategoryProductsDetailModal({
  category,
  products = [],
  isOpen,
  onClose,
  onAssignProduct,
  onRemoveProduct,
  onBatchAssignProducts,
  onBatchRemoveProducts,
  onOpenCreateProduct,
  onAlert,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [previewProduct, setPreviewProduct] = useState(null);
  const [isAssignPickerOpen, setIsAssignPickerOpen] = useState(false);
  const [assignSearchTerm, setAssignSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Multi-select for items already in category (for batch removal)
  const [selectedDetailIds, setSelectedDetailIds] = useState(new Set());
  // Optimistic tracking of locally removed product IDs for instantaneous UI removal
  const [removedProductIds, setRemovedProductIds] = useState(() => new Set());

  useEffect(() => {
    setRemovedProductIds(new Set());
  }, [category?.id, isOpen]);

  // Multi-select and infinite scroll pagination for candidate picker
  const [selectedCandidateIds, setSelectedCandidateIds] = useState(new Set());
  const CANDIDATE_INITIAL_LIMIT = 50;
  const CANDIDATE_STEP = 50;
  const [candidateLimit, setCandidateLimit] = useState(CANDIDATE_INITIAL_LIMIT);

  // Reset candidate selection & search term ONLY when picker modal opens
  useEffect(() => {
    if (isAssignPickerOpen) {
      setCandidateLimit(CANDIDATE_INITIAL_LIMIT);
      setSelectedCandidateIds(new Set());
      setAssignSearchTerm('');
    }
  }, [isAssignPickerOpen]);

  // Reset scroll pagination when search query changes (PRESERVES all selected candidates across searches!)
  useEffect(() => {
    setCandidateLimit(CANDIDATE_INITIAL_LIMIT);
  }, [assignSearchTerm]);

  // Close image preview on ESC key
  useEffect(() => {
    if (!previewProduct) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setPreviewProduct(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewProduct]);

  // Hardware Scanner support inside detail modal (scan without focusing search input)
  useHardwareBarcodeScanner({
    onScan: (scannedCode) => {
      if (!isOpen || !scannedCode) return;
      const code = String(scannedCode).trim();
      setSearchTerm(code);
      playSuccessBeep('barcode');
    },
    enabled: isOpen && !isAssignPickerOpen,
    maxInterval: 180,
    duplicateInterval: 300,
    minLength: 3,
    preventDefaultOnEnter: true,
    cleanActiveInput: true,
  });

  if (!isOpen || !category) return null;

  const categoryName = (category.name || '').trim();
  const categoryId = category.id;
  const normCategoryName = normalizeLao(categoryName);
  const targetNameLower = categoryName.toLowerCase();

  const categoryProducts = useMemo(() => {
    return (products || []).filter((p) => {
      // 0. Skip optimistically removed items immediately
      if (removedProductIds.has(p.id)) return false;

      // 1. Direct Category ID match
      const pCatId = p.categoryId || p.category_id || p.categories?.id;
      if (categoryId && pCatId && String(pCatId) === String(categoryId)) {
        return true;
      }

      // 2. Comma-separated category string match (with Lao normalization)
      const pCatString = (p.category || p.categories?.name || 'ທົ່ວໄປ').trim();
      const catNamesInProd = pCatString
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      return catNamesInProd.some((cn) => {
        if (cn.toLowerCase() === targetNameLower) return true;
        if (normCategoryName && normalizeLao(cn) === normCategoryName) return true;
        return false;
      });
    });
  }, [products, categoryName, categoryId, normCategoryName, targetNameLower, removedProductIds]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return categoryProducts;
    const q = searchTerm.trim().toLowerCase();
    const qNorm = normalizeLao(searchTerm.trim());
    return categoryProducts.filter((p) => {
      const nameMatch = (p.name || '').toLowerCase().includes(q) || (qNorm && normalizeLao(p.name || '').includes(qNorm));
      const viMatch = (p.name_vi || p.nameVi || '').toLowerCase().includes(q) || (qNorm && normalizeLao(p.name_vi || p.nameVi || '').includes(qNorm));
      const barcodeMatch = (p.barcode || '').toLowerCase().includes(q);
      const unitsBarcodeMatch = (p.units || []).some((u) => (u.barcode || '').toLowerCase().includes(q));
      return nameMatch || viMatch || barcodeMatch || unitsBarcodeMatch;
    });
  }, [categoryProducts, searchTerm]);

  // Calculate category summary stats
  const totalItems = categoryProducts.length;
  let totalStockVal = 0;
  categoryProducts.forEach((p) => {
    if (p.trackStock !== false) {
      const cost = Number(p.costPerBaseUnit || p.cost || 0);
      const stock = Number(p.currentStockBaseUnits || 0);
      totalStockVal += cost * stock;
    }
  });

  // Candidate products to add into this category (from other categories)
  const candidateProducts = useMemo(() => {
    const q = assignSearchTerm.trim();
    const qNorm = q ? normalizeLao(q) : '';

    return (products || []).filter((p) => {
      const pCatId = p.categoryId || p.category_id || p.categories?.id;
      const isMatchId = Boolean(categoryId && pCatId && String(pCatId) === String(categoryId));

      const pCatString = (p.category || p.categories?.name || 'ທົ່ວໄປ').trim();
      const catNamesInProd = pCatString
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const isMatchName = catNamesInProd.some((cn) => {
        if (cn.toLowerCase() === targetNameLower) return true;
        if (normCategoryName && normalizeLao(cn) === normCategoryName) return true;
        return false;
      });

      if (isMatchId || isMatchName) return false; // already in this category

      if (!q) return true;
      return (
        normalizeLao(p.name || '').includes(qNorm) ||
        normalizeLao(p.name_vi || p.nameVi || '').includes(qNorm) ||
        (p.barcode || '').toLowerCase().includes(q.toLowerCase())
      );
    });
  }, [products, categoryName, categoryId, normCategoryName, targetNameLower, assignSearchTerm]);

  // Infinite scroll slice for candidate products
  const visibleCandidateProducts = useMemo(() => {
    return candidateProducts.slice(0, candidateLimit);
  }, [candidateProducts, candidateLimit]);

  const handleCandidateScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 300) {
      setCandidateLimit((prev) => Math.min(prev + CANDIDATE_STEP, candidateProducts.length));
    }
  };

  // Candidate selection helpers
  const toggleCandidate = (id) => {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllCandidatesSelected =
    candidateProducts.length > 0 &&
    candidateProducts.every((p) => selectedCandidateIds.has(p.id));

  const toggleSelectAllCandidates = () => {
    if (isAllCandidatesSelected) {
      // Uncheck only the currently filtered candidates, preserving selections from other searches
      setSelectedCandidateIds((prev) => {
        const next = new Set(prev);
        candidateProducts.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      // Add all currently filtered candidates to selected set
      setSelectedCandidateIds((prev) => {
        const next = new Set(prev);
        candidateProducts.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  // Batch Assign Handler (Single-click multi-product addition)
  const handleBatchAssign = async () => {
    if (isProcessing || selectedCandidateIds.size === 0) return;
    setIsProcessing(true);
    try {
      playActionClickBeep('category');
      const selectedProds = (products || []).filter((p) => selectedCandidateIds.has(p.id));
      const assignments = selectedProds.map((prod) => {
        const currentCats = (prod.category || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const isAlready = currentCats.some(
          (c) => c.toLowerCase() === targetNameLower || (normCategoryName && normalizeLao(c) === normCategoryName)
        );
        const nextCats = isAlready
          ? currentCats
          : [...currentCats.filter((c) => c !== 'ທົ່ວໄປ'), category.name];
        return {
          productId: prod.id,
          categoryName: nextCats.join(', ') || category.name,
          categoryId: category.id || null,
        };
      });

      const res = onBatchAssignProducts
        ? await onBatchAssignProducts(assignments)
        : await Promise.all(assignments.map((a) => onAssignProduct(a.productId, a.categoryName, a.categoryId)));

      if (res?.success !== false) {
        playSuccessBeep('category');
        onAlert?.(`ເພີ່ມ ${assignments.length} ສິນຄ້າເຂົ້າໝວດ "${category.name}" ສຳເລັດແລ້ວ!`, 'ສຳເລັດ', 'success');
        setIsAssignPickerOpen(false);
        setSelectedCandidateIds(new Set());
      } else {
        onAlert?.(res?.error || 'ເກີດຂໍ້ຜິດພາດໃນການເພີ່ມສິນຄ້າ', 'ຜິດພາດ', 'error');
      }
    } catch (err) {
      onAlert?.(err.message || 'ເກີດຂໍ້ຜິດພາດ', 'ຜິດພາດ', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Detail item multi-select helpers (for batch removal)
  const isAllDetailSelected = filtered.length > 0 && filtered.every((p) => selectedDetailIds.has(p.id));

  const toggleSelectDetail = (id) => {
    setSelectedDetailIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllDetail = () => {
    if (isAllDetailSelected) {
      setSelectedDetailIds(new Set());
    } else {
      setSelectedDetailIds(new Set(filtered.map((p) => p.id)));
    }
  };

  // Batch Remove Handler
  const handleBatchRemove = async () => {
    if (isProcessing || selectedDetailIds.size === 0) return;
    setIsProcessing(true);
    try {
      playActionClickBeep('category');
      const selectedProds = (products || []).filter((p) => selectedDetailIds.has(p.id));
      const removals = selectedProds.map((prod) => {
        const currentCats = (prod.category || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const remainingCats = currentCats.filter(
          (c) => c.toLowerCase() !== targetNameLower && (!normCategoryName || normalizeLao(c) !== normCategoryName)
        );
        return {
          productId: prod.id,
          categoryName: remainingCats.length > 0 ? remainingCats.join(', ') : 'ທົ່ວໄປ',
          categoryId: null,
        };
      });

      const res = onBatchRemoveProducts
        ? await onBatchRemoveProducts(removals)
        : await Promise.all(removals.map((r) => onRemoveProduct(r.productId, r.categoryName)));

      if (res?.success !== false) {
        playSuccessBeep('category');
        setRemovedProductIds((prev) => {
          const next = new Set(prev);
          removals.forEach((r) => next.add(r.productId));
          return next;
        });
        onAlert?.(`ຍ້າຍ ${removals.length} ສິນຄ້າອອກຈາກໝວດ "${category.name}" ສຳເລັດແລ້ວ!`, 'ສຳເລັດ', 'success');
        setSelectedDetailIds(new Set());
      } else {
        onAlert?.(res?.error || 'ເກີດຂໍ້ຜິດພາດໃນການຍ້າຍສິນຄ້າ', 'ຜິດພາດ', 'error');
      }
    } catch (err) {
      onAlert?.(err.message || 'ເກີດຂໍ້ຜິດພາດ', 'ຜິດພາດ', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemove = async (prod) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      playActionClickBeep('category');
      const currentCats = (prod.category || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const remainingCats = currentCats.filter(
        (c) => c.toLowerCase() !== targetNameLower && (!normCategoryName || normalizeLao(c) !== normCategoryName)
      );
      const nextCategoryStr = remainingCats.length > 0 ? remainingCats.join(', ') : 'ທົ່ວໄປ';

      const res = await onRemoveProduct?.(prod.id, nextCategoryStr);
      if (res?.success !== false) {
        setRemovedProductIds((prev) => new Set([...prev, prod.id]));
        setSelectedDetailIds((prev) => {
          const next = new Set(prev);
          next.delete(prod.id);
          return next;
        });
        onAlert?.(`ຍ້າຍ "${prod.name}" ອອກຈາກໝວດສຳເລັດແລ້ວ!`, 'ສຳເລັດ', 'success');
      } else {
        onAlert?.(res?.error || 'ບໍ່ສາມາດຍ້າຍສິນຄ້າອອກຈາກໝວດໄດ້', 'ຜິດພາດ', 'error');
      }
    } catch (err) {
      onAlert?.(err.message || 'ເກີດຂໍ້ຜິດພາດ', 'ຜິດພາດ', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 md:p-6 animate-in fade-in duration-200"
      style={{
        paddingTop: 'max(2.75rem, calc(2.25rem + env(safe-area-inset-top, 0px)))',
        paddingBottom: 'max(4rem, calc(3.5rem + env(safe-area-inset-bottom, 0px)))',
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 w-full sm:w-[94vw] md:w-[92vw] lg:max-w-5xl h-full max-h-full sm:max-h-[86vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Royal Blue to Blue Gradient */}
        <div className="px-3.5 sm:px-5 py-3 sm:py-4 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Folders size={20} weight="duotone" className="text-blue-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base md:text-lg leading-tight truncate">
                  ໝວດໝູ່: {category.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-white/20 text-white shrink-0">
                  {totalItems} ສິນຄ້າ
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-blue-100/90 truncate mt-0.5">
                ມູນຄ່າສະຕັອກລວມໃນໝວດ: {formatKip(totalStockVal)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
            title="ປິດ (Close)"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Search inside category & barcode scan indicator + Action buttons */}
        <div className="p-2.5 sm:p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-2.5 shrink-0">
          <div className="relative flex-1 min-w-0">
            <MagnifyingGlass
              size={17}
              weight="bold"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ຄົ້ນຫາຊື່ ຫຼື ຍິງບາໂຄດສະແກນໄດ້ທັນທີ..."
              className="w-full pl-9 pr-9 py-2 bg-white rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={15} weight="bold" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                playActionClickBeep('category');
                setIsAssignPickerOpen(true);
              }}
              className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer flex-1 sm:flex-initial"
              title="ເລືອກສິນຄ້າຈາກໝວດອື່ນມາໃສ່ໝວດນີ້"
            >
              <Plus size={14} weight="bold" />
              <span>ເພີ່ມສິນຄ້າເຂົ້າໝວດ</span>
            </button>

            <span className="text-xs text-slate-500 font-bold ml-1 shrink-0">
              ({filtered.length} / {totalItems})
            </span>
          </div>
        </div>

        {/* Batch Remove Bar (Hiện lên khi người dùng chọn ít nhất 1 sản phẩm) */}
        {selectedDetailIds.size > 0 && (
          <div className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-rose-50 border-b border-rose-200 flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-150 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-xs font-bold text-rose-900">
                ເລືອກແລ້ວ <strong className="font-extrabold text-rose-700 font-mono text-sm">{selectedDetailIds.size}</strong> ສິນຄ້າ
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedDetailIds(new Set())}
                className="px-2.5 py-1 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer transition-colors"
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                onClick={handleBatchRemove}
                disabled={isProcessing}
                className="h-8 px-3 sm:px-3.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash size={14} weight="bold" />
                <span>ຍ້າຍອອກຈາກໝວດ ({selectedDetailIds.size})</span>
              </button>
            </div>
          </div>
        )}

        {/* Products Table List */}
        <div className="flex-1 overflow-y-auto min-h-0 p-2 sm:p-4">
          {filtered.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Package size={42} weight="light" className="opacity-50" />
              <p className="text-xs font-medium text-center px-4">
                {searchTerm ? 'ບໍ່ພົບສິນຄ້າທີ່ມີຊື່ ຫຼື ບາໂຄດນີ້ໃນໝວດ' : 'ຍັງບໍ່ມີສິນຄ້າໃນໝວດນີ້, ກົດປຸ່ມ "+ ເພີ່ມສິນຄ້າເຂົ້າໝວດ" ດ້ານເທິງ'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllDetailSelected}
                        onChange={toggleSelectAllDetail}
                        className="w-4 h-4 rounded text-blue-600 accent-blue-600 cursor-pointer"
                        title={isAllDetailSelected ? 'ຍົກເລີກການເລືອກທັງໝົດ' : 'ເລືອກທັງໝົດ'}
                      />
                    </th>
                    <th className="py-2.5 px-2 w-10 text-center hidden sm:table-cell">ລ/ດ</th>
                    <th className="py-2.5 px-2 w-12 text-center">ຮູບ</th>
                    <th className="py-2.5 px-3">ຊື່ສິນຄ້າ</th>
                    <th className="py-2.5 px-3 text-right">ລາຄາຂາຍ</th>
                    <th className="py-2.5 px-2 text-center">ສະຕັອກ</th>
                    <th className="py-2.5 px-2 text-center w-24">ຍ້າຍອອກ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((prod, idx) => {
                    const isChecked = selectedDetailIds.has(prod.id);
                    const baseUnit = (prod.units || []).find((u) => u.tier === 1 || Number(u.multiplier) === 1) || prod.units?.[0] || {};
                    const cartonUnit = (prod.units || []).find((u) => u.tier === 3 || Number(u.multiplier) > 1) || null;
                    const stock = Number(prod.currentStockBaseUnits || 0);
                    const isTracked = prod.trackStock !== false;

                    let stockText = 'ບໍ່ນັບສາງ';
                    if (isTracked) {
                      if (stock <= 0) stockText = 'ໝົດສາງ (0)';
                      else stockText = formatCompoundStock(prod).replace(/ (ລວມທັງໝົດ:.*)/, '');
                    }

                    return (
                      <tr
                        key={prod.id || idx}
                        className={`transition-colors ${
                          isChecked ? 'bg-rose-50/70' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Checkbox column */}
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectDetail(prod.id)}
                            className="w-4 h-4 rounded text-blue-600 accent-blue-600 cursor-pointer"
                          />
                        </td>

                        <td className="py-2.5 px-2 text-center font-bold text-slate-400 hidden sm:table-cell">
                          {idx + 1}
                        </td>

                        {/* Image Thumbnail with Click-to-Zoom */}
                        <td className="py-2.5 px-2 text-center">
                          {prod.imageUrl || prod.image_url ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playActionClickBeep('category');
                                setPreviewProduct(prod);
                              }}
                              className="relative group/thumb cursor-zoom-in shrink-0 rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 w-10 h-10 mx-auto block shadow-2xs"
                              title="ກົດເພື່ອເບິ່ງຮູບຂະໜາດໃຫຍ່ (Click to zoom image)"
                            >
                              <img
                                src={prod.imageUrl || prod.image_url}
                                alt={prod.name}
                                loading="lazy"
                                decoding="async"
                                className="w-10 h-10 rounded-xl object-cover bg-slate-100 border border-slate-200 transition-transform duration-200 group-hover/thumb:scale-108"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/25 transition-colors flex items-center justify-center">
                                <MagnifyingGlassPlus
                                  size={15}
                                  className="text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity drop-shadow"
                                />
                              </div>
                            </button>
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-400 overflow-hidden mx-auto shrink-0 shadow-2xs">
                              <Package size={20} weight="duotone" />
                            </div>
                          )}
                        </td>

                        {/* Product Name & Subtext */}
                        <td className="py-2.5 px-3 min-w-[140px] sm:min-w-[200px]">
                          <div className="font-bold text-slate-900 leading-snug text-xs sm:text-sm">
                            {prod.name}
                          </div>
                          {(prod.name_vi || prod.nameVi) && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {prod.name_vi || prod.nameVi}
                            </div>
                          )}
                        </td>

                        {/* Retail Selling Prices */}
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                          {cartonUnit && Number(cartonUnit.retailPrice) > 0 ? (
                            <div className="font-bold text-emerald-800 text-xs">
                              {Number(cartonUnit.retailPrice).toLocaleString()} ₭/{cartonUnit.unitName || 'ແກັດ'}
                            </div>
                          ) : null}
                          {baseUnit && Number(baseUnit.retailPrice) > 0 ? (
                            <div className="text-[11px] text-slate-600">
                              {Number(baseUnit.retailPrice).toLocaleString()} ₭/{baseUnit.unitName || 'ອັນ'}
                            </div>
                          ) : null}
                        </td>

                        {/* Stock */}
                        <td className="py-2.5 px-3 text-center font-medium text-slate-700 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              !isTracked
                                ? 'bg-slate-100 text-slate-600'
                                : stock <= 0
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {stockText}
                          </span>
                        </td>

                        {/* Action: Remove from Category */}
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleRemove(prod)}
                            disabled={isProcessing}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer border border-rose-200/80 active:scale-95 disabled:opacity-50"
                            title="ຍ້າຍສິນຄ້ານີ້ອອກຈາກໝວດ (ປ່ຽນໄປເປັນ 'ທົ່ວໄປ')"
                          >
                            <X size={12} weight="bold" />
                            <span>ຍ້າຍອອກ</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            ລວມທັງໝົດ: <span className="font-bold text-slate-800">{totalItems}</span> ສິນຄ້າ
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            ປິດ
          </button>
        </div>

      {/* Modal chọn sản phẩm để gán vào danh mục (Multi-Select & Infinite Scroll xem hết 668+ sản phẩm giống POS) */}
      {isAssignPickerOpen && (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 md:p-6 animate-in fade-in duration-200"
          style={{
            paddingTop: 'max(2.75rem, calc(2.25rem + env(safe-area-inset-top, 0px)))',
            paddingBottom: 'max(4rem, calc(3.5rem + env(safe-area-inset-bottom, 0px)))',
          }}
          onClick={() => setIsAssignPickerOpen(false)}
        >
          <div
            className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 w-full sm:w-[94vw] md:w-[90vw] lg:max-w-3xl h-full max-h-full sm:max-h-[84vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Royal Blue to Blue Gradient (Xanh dương - Xanh dương theo theme hệ thống) */}
            <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 text-white flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <Plus size={18} weight="bold" className="text-blue-200" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-sm sm:text-base leading-tight truncate">
                    ເລືອກສິນຄ້າຍ້າຍເຂົ້າໝວດ: {category.name}
                  </h4>
                  <p className="text-[11px] text-blue-100/90 truncate">
                    ເລືອກຫຼາຍສິນຄ້າພ້ອມກັນ ແລ້ວກົດປຸ່ມ "+ ເພີ່ມເຂົ້າໝວດ" ດ້ານລຸ່ມ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignPickerOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {/* Search Filter */}
            <div className="p-2.5 sm:p-3 bg-slate-50 border-b border-slate-200 shrink-0">
              <div className="relative">
                <MagnifyingGlass
                  size={16}
                  weight="bold"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={assignSearchTerm}
                  onChange={(e) => setAssignSearchTerm(e.target.value)}
                  placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ, ຊື່ພາສາຫວຽດ ຫຼື ບາໂຄດ..."
                  className="w-full pl-9 pr-9 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                {assignSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setAssignSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} weight="bold" />
                  </button>
                )}
              </div>
            </div>

            {/* Selection Toolbar Bar */}
            <div className="px-3 sm:px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllCandidates}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <input
                    type="checkbox"
                    checked={isAllCandidatesSelected}
                    onChange={() => {}}
                    className="w-3.5 h-3.5 rounded text-blue-600 accent-blue-600 cursor-pointer pointer-events-none"
                  />
                  <span>
                    {isAllCandidatesSelected ? 'ຍົກເລີກເລືອກທັງໝົດ' : `ເລືອກທັງໝົດ (${candidateProducts.length})`}
                  </span>
                </button>

                {selectedCandidateIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCandidateIds(new Set())}
                    className="px-2 py-1 text-slate-500 hover:text-rose-600 text-xs font-bold cursor-pointer transition-colors"
                  >
                    ລຶບການເລືອກ
                  </button>
                )}
              </div>

              <div className="text-xs font-bold text-slate-600">
                ເລືອກແລ້ວ: <span className="font-black text-blue-700 font-mono text-sm">{selectedCandidateIds.size}</span> ລາຍການ
              </div>
            </div>

            {/* Candidate Products List with Infinite Scroll */}
            <div
              onScroll={handleCandidateScroll}
              className="flex-1 overflow-y-auto min-h-0 p-2 sm:p-3 divide-y divide-slate-100"
            >
              {candidateProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-bold">
                  {assignSearchTerm ? 'ບໍ່ພົບສິນຄ້າທີ່ກົງກັບຄຳຄົ້ນຫາ' : 'ບໍ່ມີສິນຄ້າອື່ນໃຫ້ເລືອກ (ສິນຄ້າທັງໝົດຢູ່ໃນໝວດນີ້ແລ້ວ)'}
                </div>
              ) : (
                <>
                  {visibleCandidateProducts.map((prod) => {
                    const isCandidateChecked = selectedCandidateIds.has(prod.id);
                    return (
                      <div
                        key={prod.id}
                        onClick={() => toggleCandidate(prod.id)}
                        className={`py-2.5 px-2.5 my-0.5 flex items-center justify-between gap-2.5 sm:gap-3 rounded-xl transition-all cursor-pointer select-none border ${
                          isCandidateChecked
                            ? 'bg-blue-50/80 border-blue-300 text-blue-950 shadow-2xs'
                            : 'hover:bg-slate-50 border-transparent text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isCandidateChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-blue-600 accent-blue-600 cursor-pointer pointer-events-none shrink-0"
                          />
                          {prod.imageUrl || prod.image_url ? (
                            <img
                              src={prod.imageUrl || prod.image_url}
                              alt={prod.name}
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <Package size={16} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs truncate leading-snug">{prod.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/80 truncate">
                                ໝວດປັດຈຸບັນ: {prod.category || 'ທົ່ວໄປ'}
                              </span>
                              {(prod.name_vi || prod.nameVi) && (
                                <span className="text-[10px] text-slate-400 truncate">
                                  • {prod.name_vi || prod.nameVi}
                                </span>
                              )}
                              {prod.barcode && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  #{prod.barcode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {isCandidateChecked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-extrabold shadow-2xs">
                              <Check size={12} weight="bold" />
                              <span>ເລືອກແລ້ວ</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-bold">
                              ກົດເພື່ອເລືອກ
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {visibleCandidateProducts.length < candidateProducts.length && (
                    <div className="py-3 text-center text-xs font-bold text-slate-400">
                      ສະແດງ {visibleCandidateProducts.length} ຈາກ {candidateProducts.length} ສິນຄ້າ (ເລື່ອນລົງເພື່ອເບິ່ງເພີ່ມ...)
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <span className="text-xs text-slate-600 font-bold truncate">
                  ພົບເຫັນ {candidateProducts.length} ສິນຄ້າຈາກໝວດອື່ນ
                </span>
                <span className="text-xs font-bold text-blue-700 sm:hidden">
                  ເລືອກ: {selectedCandidateIds.size}
                </span>
              </div>
              <div className="flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAssignPickerOpen(false)}
                  className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors flex-1 sm:flex-initial text-center"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="button"
                  onClick={handleBatchAssign}
                  disabled={isProcessing || selectedCandidateIds.size === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none flex-1 sm:flex-initial"
                >
                  <Plus size={14} weight="bold" />
                  <span>
                    {isProcessing ? 'ກຳລັງເພີ່ມ...' : `+ ເພີ່ມເຂົ້າໝວດ (${selectedCandidateIds.size})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Product Image Zoom / Lightbox Modal Popup with high z-index overlaying modal */}
      {previewProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[95] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          style={{
            paddingTop: 'max(2.75rem, calc(2.25rem + env(safe-area-inset-top, 0px)))',
            paddingBottom: 'max(4rem, calc(3.5rem + env(safe-area-inset-bottom, 0px)))',
          }}
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
                    {previewProduct.category || category.name || 'ທົ່ວໄປ'}
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
                src={previewProduct.imageUrl || previewProduct.image_url}
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
                onClick={() => setPreviewProduct(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                ປິດໜ້າຕ່າງ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
}

/**
 * Main Categories Management View
 */
export default function CategoriesView({
  categories = [],
  products = [],
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
  onAssignProduct,
  onRemoveProduct,
  onBatchAssignProducts,
  onBatchRemoveProducts,
  onOpenCreateProduct,
  onRefresh,
  isLoading = false,
  onAlert,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatParentId, setNewCatParentId] = useState('');
  const [editingCat, setEditingCat] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingParentId, setEditingParentId] = useState('');
  const [selectedDetailCat, setSelectedDetailCat] = useState(null);
  const [catToDelete, setCatToDelete] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Expanded parents state: Default empty Set (Khi vào trang danh mục lần đầu mặc định không mở rộng danh mục con)
  const [expandedParents, setExpandedParents] = useState(new Set());

  const toggleCollapse = (parentId, e) => {
    e?.stopPropagation();
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const handleOpenAddChild = (parentCat) => {
    playActionClickBeep('category');
    setNewCatParentId(parentCat.id);
    setNewCatName('');
    setIsAddModalOpen(true);
  };

  const rootCategories = useMemo(() => {
    return (categories || []).filter((c) => !c.parent_id);
  }, [categories]);

  // Reordering root categories state & handlers (Drag-and-Drop)
  const [draggedRootId, setDraggedRootId] = useState(null);
  const [dragOverRootId, setDragOverRootId] = useState(null);
  const [isReordering, setIsReordering] = useState(false);
  const draggedRootIdRef = useRef(null);
  const dragOverRootIdRef = useRef(null);
  const tableContainerRef = useRef(null);
  const ghostContainerRef = useRef(null);
  const touchStartYRef = useRef(0);

  const applyNewRootOrder = async (newRoots) => {
    if (isReordering || !onReorderCategories) return;
    setIsReordering(true);
    try {
      const childCategories = (categories || []).filter((c) => Boolean(c.parent_id));
      const updatedRoots = newRoots.map((r, idx) => ({
        ...r,
        sort_order: idx + 1,
      }));
      const fullReordered = [...updatedRoots, ...childCategories];
      const res = await onReorderCategories(fullReordered, updatedRoots);
      if (res?.success !== false) {
        playSuccessBeep('category');
      } else {
        onAlert?.(res?.error || 'ເກີດຂໍ້ຜິດພາດໃນການປ່ຽນລຳດັບ', 'ຜິດພາດ', 'error');
      }
    } catch (err) {
      onAlert?.(err.message || 'ເກີດຂໍ້ຜິດພາດ', 'ຜິດພາດ', 'error');
    } finally {
      setIsReordering(false);
    }
  };

  const handleDropReorder = async (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId || searchTerm.trim() || isReordering) return;
    const fromIndex = rootCategories.findIndex((c) => c.id === sourceId);
    const toIndex = rootCategories.findIndex((c) => c.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    playActionClickBeep('category');

    const newRoots = [...rootCategories];
    const [movedItem] = newRoots.splice(fromIndex, 1);
    newRoots.splice(toIndex, 0, movedItem);

    await applyNewRootOrder(newRoots);
  };

  // HTML5 Desktop Drag & Drop Handlers - Ultra-smooth & boundary restricted
  const handleDragStart = (rootId, e) => {
    if (searchTerm.trim() || isReordering) {
      e.preventDefault();
      return;
    }
    draggedRootIdRef.current = rootId;
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', rootId);
    } catch (_) {}
    // Render clean snapshot before dimming dragged row to avoid ghost image glitch
    requestAnimationFrame(() => {
      setDraggedRootId(rootId);
    });
  };

  const handleDragOver = (rootId, e) => {
    if (searchTerm.trim() || isReordering) return;
    const currentDragged = draggedRootIdRef.current;
    if (!currentDragged || currentDragged === rootId) return;

    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = 'move';
    } catch (_) {}

    // Throttle: only update state if target row actually changed to eliminate jitter
    if (dragOverRootIdRef.current !== rootId) {
      dragOverRootIdRef.current = rootId;
      setDragOverRootId(rootId);
    }
  };

  const handleContainerDragOver = (e) => {
    if (!draggedRootIdRef.current) return;
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = 'move';
    } catch (_) {}
  };

  const handleContainerDragLeave = (e) => {
    if (!tableContainerRef.current) return;
    // Boundary lock: when pointer exits table container boundary, cancel hover indicator
    if (!tableContainerRef.current.contains(e.relatedTarget)) {
      if (dragOverRootIdRef.current !== null) {
        dragOverRootIdRef.current = null;
        setDragOverRootId(null);
      }
    }
  };

  const handleDrop = (targetId, e) => {
    e.preventDefault();
    const sourceId = draggedRootIdRef.current;
    if (sourceId && targetId && sourceId !== targetId) {
      handleDropReorder(sourceId, targetId);
    }
    draggedRootIdRef.current = null;
    dragOverRootIdRef.current = null;
    setDraggedRootId(null);
    setDragOverRootId(null);
  };

  const cleanupGhost = () => {
    if (ghostContainerRef.current) {
      ghostContainerRef.current.remove();
      ghostContainerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupGhost();
    };
  }, []);

  const handleDragEnd = () => {
    cleanupGhost();
    draggedRootIdRef.current = null;
    dragOverRootIdRef.current = null;
    setDraggedRootId(null);
    setDragOverRootId(null);
  };

  // Full-Row Touch Drag Support for iPad / Capacitor App (Zero-delay, GPU-accelerated 120fps)
  const handleTouchStart = (cat, index, e) => {
    if (searchTerm.trim() || isReordering) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    e.stopPropagation();

    const sourceId = cat.id;
    draggedRootIdRef.current = sourceId;
    touchStartYRef.current = touch.clientY;

    const rowEl = document.querySelector(`[data-root-category-id="${sourceId}"]`);
    if (!rowEl) return;

    const rect = rowEl.getBoundingClientRect();
    cleanupGhost();

    // Create the floating full-width row ghost
    const ghost = document.createElement('div');
    ghost.style.position = 'fixed';
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '99999';
    ghost.style.opacity = '0.85';
    ghost.style.boxShadow = '0 20px 40px -8px rgba(37, 99, 235, 0.45), 0 0 0 2px #2563eb';
    ghost.style.borderRadius = '12px';
    ghost.style.overflow = 'hidden';
    ghost.style.backgroundColor = '#ffffff';
    ghost.style.willChange = 'transform';

    const clone = rowEl.cloneNode(true);
    clone.style.opacity = '1';
    clone.style.backgroundColor = '#ffffff';

    if (rowEl.tagName.toLowerCase() === 'tr') {
      const origCells = rowEl.querySelectorAll('td');
      const cloneCells = clone.querySelectorAll('td');
      origCells.forEach((cell, i) => {
        if (cloneCells[i]) {
          const w = cell.getBoundingClientRect().width;
          cloneCells[i].style.width = `${w}px`;
          cloneCells[i].style.minWidth = `${w}px`;
          cloneCells[i].style.maxWidth = `${w}px`;
        }
      });

      const table = document.createElement('table');
      table.style.width = `${rect.width}px`;
      table.style.height = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.textAlign = 'left';
      table.style.fontSize = '12px';
      table.style.tableLayout = 'fixed';
      const tbody = document.createElement('tbody');
      tbody.appendChild(clone);
      table.appendChild(tbody);
      ghost.appendChild(table);
    } else {
      ghost.appendChild(clone);
    }

    document.body.appendChild(ghost);
    ghostContainerRef.current = ghost;

    setDraggedRootId(sourceId);
  };

  const handleTouchMove = (e) => {
    if (!draggedRootIdRef.current) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    if (e.cancelable) e.preventDefault();

    const clientY = touch.clientY;
    const deltaY = clientY - touchStartYRef.current;

    // 1. Move the full-width row ghost directly on GPU compositor thread (120fps native performance)
    if (ghostContainerRef.current) {
      ghostContainerRef.current.style.transform = `translate3d(0, ${deltaY}px, 0)`;
    }

    // 2. Resilient vertical hit-testing across all rendered root rows (impervious to left/right finger wavering)
    const rootRows = document.querySelectorAll('[data-root-category-id]');
    let targetId = null;

    for (const row of rootRows) {
      const rect = row.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        targetId = row.getAttribute('data-root-category-id');
        break;
      }
    }

    // Clear hover if dragged way outside of the vertical table boundary
    if (tableContainerRef.current) {
      const tableRect = tableContainerRef.current.getBoundingClientRect();
      if (clientY < tableRect.top - 80 || clientY > tableRect.bottom + 80) {
        targetId = null;
      }
    }

    if (targetId && targetId !== draggedRootIdRef.current) {
      if (dragOverRootIdRef.current !== targetId) {
        dragOverRootIdRef.current = targetId;
        setDragOverRootId(targetId);
      }
    } else {
      if (dragOverRootIdRef.current !== null) {
        dragOverRootIdRef.current = null;
        setDragOverRootId(null);
      }
    }
  };

  const handleTouchEnd = () => {
    cleanupGhost();
    const sourceId = draggedRootIdRef.current;
    const targetId = dragOverRootIdRef.current;
    if (sourceId && targetId && sourceId !== targetId) {
      handleDropReorder(sourceId, targetId);
    }
    draggedRootIdRef.current = null;
    dragOverRootIdRef.current = null;
    setDraggedRootId(null);
    setDragOverRootId(null);
  };

  const handleTouchCancel = () => {
    cleanupGhost();
    draggedRootIdRef.current = null;
    dragOverRootIdRef.current = null;
    setDraggedRootId(null);
    setDragOverRootId(null);
  };

  // Map category products counts & stock value
  const categoryStats = useMemo(() => {
    const stats = {};

    (categories || []).forEach((c) => {
      const entry = {
        count: 0,
        stockValue: 0,
        trackedUnits: 0,
      };
      if (c.id) stats[c.id] = entry;
      if (c.name) {
        stats[c.name] = entry;
        stats[c.name.trim()] = entry;
        const norm = normalizeLao(c.name);
        if (norm) stats[norm] = entry;
      }
    });

    (products || []).forEach((p) => {
      const pCatString = (p.category || p.categories?.name || 'ທົ່ວໄປ').trim();
      const catNamesInProd = pCatString
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const normProdCats = catNamesInProd.map((s) => normalizeLao(s));
      const pCatId = p.categoryId || p.category_id || p.categories?.id;

      // Find all categories in system matching this product
      const matchedCats = (categories || []).filter((c) => {
        const cNorm = normalizeLao(c.name);
        const matchesName =
          catNamesInProd.some((cn) => cn.toLowerCase() === (c.name || '').trim().toLowerCase()) ||
          (cNorm && normProdCats.includes(cNorm));
        const matchesId = Boolean(pCatId && c.id && String(c.id) === String(pCatId));
        return matchesName || matchesId;
      });

      if (matchedCats.length === 0) {
        const key = p.category || 'ທົ່ວໄປ';
        if (!stats[key]) {
          stats[key] = { count: 0, stockValue: 0, trackedUnits: 0 };
        }
        stats[key].count += 1;
        if (p.trackStock !== false) {
          const cost = Number(p.costPerBaseUnit || p.cost || 0);
          const stock = Number(p.currentStockBaseUnits || 0);
          stats[key].stockValue += cost * stock;
          stats[key].trackedUnits += stock;
        }
      } else {
        const credited = new Set();
        matchedCats.forEach((c) => {
          const targetEntry =
            (c.id && stats[c.id]) ||
            (c.name && stats[c.name]) ||
            (c.name && stats[normalizeLao(c.name)]);
          if (targetEntry && !credited.has(targetEntry)) {
            credited.add(targetEntry);
            targetEntry.count += 1;
            if (p.trackStock !== false) {
              const cost = Number(p.costPerBaseUnit || p.cost || 0);
              const stock = Number(p.currentStockBaseUnits || 0);
              targetEntry.stockValue += cost * stock;
              targetEntry.trackedUnits += stock;
            }
          }
        });
      }
    });

    return stats;
  }, [categories, products]);

  // High-level Category KPI Stats
  const categoryKPI = useMemo(() => {
    const totalCats = (categories || []).length;
    let categorizedProductsCount = 0;
    let topCategory = null;
    let maxCount = -1;
    let emptyCatsCount = 0;

    (categories || []).forEach((c) => {
      const entry =
        (c.id && categoryStats[c.id]) ||
        (c.name && categoryStats[c.name]) ||
        (c.name && categoryStats[normalizeLao(c.name)]);
      const count = entry?.count || 0;
      categorizedProductsCount += count;
      if (count > maxCount) {
        maxCount = count;
        topCategory = { name: c.name, count };
      }
      if (count === 0) {
        emptyCatsCount += 1;
      }
    });

    return {
      totalCats,
      categorizedProductsCount,
      topCategoryName: topCategory && maxCount > 0 ? topCategory.name : '-',
      topCategoryCount: maxCount > 0 ? maxCount : 0,
      emptyCatsCount,
    };
  }, [categories, categoryStats]);

  // Tree Hierarchical Items in in-order depth (Root -> Children indented directly beneath it)
  const categoryTreeItems = useMemo(() => {
    const cleanQ = searchTerm.trim().toLowerCase();

    // 1. Find all root categories
    const roots = (categories || []).filter((c) => !c.parent_id);

    const items = [];
    roots.forEach((root) => {
      const children = (categories || []).filter((c) => c.parent_id === root.id);

      const rootMatches = !cleanQ || (root.name || '').toLowerCase().includes(cleanQ);
      const matchingChildren = children.filter((ch) => !cleanQ || (ch.name || '').toLowerCase().includes(cleanQ));

      if (cleanQ && !rootMatches && matchingChildren.length === 0) {
        return; // neither root nor children match search
      }

      const visibleChildren = cleanQ ? (rootMatches ? children : matchingChildren) : children;
      // Auto-collapse while dragging (desktop or iPad); restore previously expanded parents upon drop
      const isExpanded = !draggedRootId && expandedParents.has(root.id);
      const isCollapsed = !isExpanded;

      // Add Parent Root
      items.push({
        ...root,
        isRoot: true,
        hasChildren: children.length > 0,
        childCount: children.length,
        isCollapsed,
      });

      // Add Children immediately under this Parent
      if (isExpanded) {
        visibleChildren.forEach((child) => {
          items.push({
            ...child,
            isRoot: false,
            parentName: root.name,
            parentId: root.id,
          });
        });
      }
    });

    // Also include any orphaned child categories whose parent was not found in roots
    const rootIds = new Set(roots.map((r) => r.id));
    (categories || []).forEach((c) => {
      if (c.parent_id && !rootIds.has(c.parent_id)) {
        if (!cleanQ || (c.name || '').toLowerCase().includes(cleanQ)) {
          items.push({
            ...c,
            isRoot: false,
            parentName: 'ບໍ່ມີໝວດຫຼັກ',
            parentId: c.parent_id,
          });
        }
      }
    });

    return items;
  }, [categories, searchTerm, expandedParents, draggedRootId]);

  // Handle Add Category
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const clean = newCatName.trim();

    if (categories.some((c) => (c.name || '').toLowerCase() === clean.toLowerCase())) {
      onAlert?.(`ໝວດໝູ່ "${clean}" ມີໃນລະບົບແລ້ວ!`, 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      playActionClickBeep('category');
      const res = await onCreateCategory(clean, newCatParentId || null);
      if (res) {
        setNewCatName('');
        setNewCatParentId('');
        setIsAddModalOpen(false);
        onAlert?.(`ເພີ່ມໝວດໝູ່ "${clean}" ສຳເລັດແລ້ວ!`, 'ສຳເລັດ', 'success');
      }
    } catch (err) {
      onAlert?.(err.message || 'ເກີດຂໍ້ຜິດພາດ', 'ຜິດພາດ', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Category
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingCat || !editingName.trim()) return;
    const clean = editingName.trim();
    const parentChanged = (editingParentId || null) !== (editingCat.parent_id || null);
    if (clean === editingCat.name && !parentChanged) {
      setEditingCat(null);
      return;
    }

    setIsSubmitting(true);
    try {
      playActionClickBeep('category');
      const res = await onUpdateCategory(editingCat.id, clean, editingCat.name, editingParentId || null);
      if (res?.success !== false) {
        setEditingCat(null);
        setEditingParentId('');
        onAlert?.(`ແກ້ໄຂໝວດໝູ່ເປັນ "${clean}" ສຳເລັດແລ້ວ!`, 'ສຳເລັດ', 'success');
      } else {
        onAlert?.(res?.error || 'ບໍ່ສາມາດແກ້ໄຂໝວດໝູ່ໄດ້', 'ຜິດພາດ', 'error');
      }
    } catch (err) {
      onAlert?.(err.message || 'ເກີດຂໍ້ຜິດພາດ', 'ຜິດພາດ', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Category
  const confirmDelete = async () => {
    if (!catToDelete) return;
    const cat = catToDelete;
    const entry =
      (cat.id && categoryStats[cat.id]) ||
      (cat.name && categoryStats[cat.name]) ||
      (cat.name && categoryStats[normalizeLao(cat.name)]);
    const count = entry?.count || 0;

    if (count > 0) {
      onAlert?.(
        `ໝວດໝູ່ນີ້ກຳລັງມີສິນຄ້າຢູ່ ${count} ລາຍການ, ບໍ່ສາມາດລຶບໄດ້! ກະລຸນາຍ້າຍສິນຄ້າໄປໝວດອື່ນກ່ອນ.`,
        'ແຈ້ງເຕືອນ',
        'warning'
      );
      setCatToDelete(null);
      return;
    }

    setIsSubmitting(true);
    try {
      playActionClickBeep('category');
      const res = await onDeleteCategory(cat.id, cat.name);
      if (res?.success !== false) {
        setCatToDelete(null);
        onAlert?.(`ລຶບໝວດໝູ່ "${cat.name}" ສຳເລັດແລ້ວ!`, 'ສຳເລັດ', 'success');
      } else {
        onAlert?.(res?.error || 'ບໍ່ສາມາດລຶບໝວດໝູ່ໄດ້', 'ຜິດພາດ', 'error');
      }
    } catch (err) {
      onAlert?.(err.message || 'ເກີດຂໍ້ຜິດພາດ', 'ຜິດພາດ', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden font-sans">
      {/* 1. Header Toolbar: Standardized responsive header matching Products & History */}
      <div className="bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3.5 shrink-0 shadow-2xs z-10">
        <div className="flex items-center justify-between gap-2.5 sm:gap-3">
          {/* Title & Stats */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0 border border-teal-100">
              <Folders size={20} className="sm:w-5 sm:h-5" weight="duotone" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="truncate">
                  <span className="sm:hidden">ໝວດໝູ່ສິນຄ້າ</span>
                  <span className="hidden sm:inline">ໝວດໝູ່ສິນຄ້າ (Categories)</span>
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                  {categories.length}
                </span>
              </h2>
              <p className="text-[11.5px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
                ຄຸ້ມຄອງໝວດໝູ່, ກວດສອບຈຳນວນສິນຄ້າ ແລະ ລາຍການສິນຄ້າໃນແຕ່ລະໝວດ
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onRefresh && (
              <button
                type="button"
                onClick={() => {
                  playUnitChangeBeep('category');
                  onRefresh();
                }}
                disabled={isLoading}
                className="p-2 sm:px-3 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs"
                title="ໂຫຼດຂໍ້ມູນຄືນ"
              >
                <ArrowClockwise size={15} weight="bold" className={isLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">ຣີເຟຣຊ</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                playActionClickBeep('category');
                setNewCatName('');
                setIsAddModalOpen(true);
              }}
              className="px-3 sm:px-3.5 py-2 sm:py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Plus size={16} weight="bold" />
              <span className="hidden sm:inline">+ ເພີ່ມໝວດໝູ່ໃໝ່</span>
              <span className="sm:hidden">ເພີ່ມ</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Area: Top KPI Stats + Table */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 min-h-0 pb-6">
        
        {/* Top KPI Metrics for Categories */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 shrink-0">
          {/* Card 1: Total Categories */}
          <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-black shrink-0">
              <Folders size={20} weight="duotone" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] text-teal-700 font-bold uppercase tracking-wider truncate">ໝວດໝູ່ທັງໝົດ</div>
              <div className="text-base sm:text-lg font-black text-slate-900 font-mono truncate">{categoryKPI.totalCats}</div>
            </div>
          </div>

          {/* Card 2: Categorized Products */}
          <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black shrink-0">
              <Package size={20} weight="duotone" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-wider truncate">ສິນຄ້າໃນໝວດ</div>
              <div className="text-base sm:text-lg font-black text-slate-900 font-mono truncate">{categoryKPI.categorizedProductsCount}</div>
            </div>
          </div>

          {/* Card 3: Top Category */}
          <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black shrink-0">
              <Tag size={20} weight="duotone" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] text-amber-600 font-bold uppercase tracking-wider truncate">ໝວດສິນຄ້າຫຼາຍສຸດ</div>
              <div className="text-xs font-black text-slate-900 truncate" title={`${categoryKPI.topCategoryName} (${categoryKPI.topCategoryCount} ລາຍການ)`}>
                {categoryKPI.topCategoryName}
              </div>
              {categoryKPI.topCategoryCount > 0 && (
                <div className="text-[10px] sm:text-[10.5px] font-mono font-bold text-amber-700">
                  {categoryKPI.topCategoryCount} ລາຍການ
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Empty Categories */}
          <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-black shrink-0">
              <Archive size={20} weight="duotone" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-wider truncate">ໝວດໝູ່ທີ່ວ່າງເປົ່າ</div>
              <div className="text-base sm:text-lg font-black text-slate-700 font-mono truncate">{categoryKPI.emptyCatsCount}</div>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar below Stats */}
        <div className="mb-4">
          <div className="relative">
            <MagnifyingGlass
              size={18}
              weight="bold"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ຄົ້ນຫາຊື່ໝວດໝູ່..."
              className="w-full pl-10 pr-9 py-2.5 bg-white rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 shadow-2xs transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={15} weight="bold" />
              </button>
            )}
          </div>
        </div>

        {categoryTreeItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Folders size={48} weight="light" className="opacity-50 text-teal-600" />
            <p className="text-sm font-bold text-slate-700">ບໍ່ພົບໝວດໝູ່ສິນຄ້າ</p>
            <p className="text-xs text-slate-400 text-center max-w-sm">
              {searchTerm ? 'ບໍ່ມີໝວດໝູ່ທີ່ກົງກັບຄຳຄົ້ນຫາ' : 'ຍັງບໍ່ມີໝວດໝູ່ໃນລະບົບ, ກົດປຸ່ມດ້ານເທິງເພື່ອເພີ່ມໝວດໝູ່ໃໝ່'}
            </p>
          </div>
        ) : (
          <div
            ref={tableContainerRef}
            onDragOver={handleContainerDragOver}
            onDragLeave={handleContainerDragLeave}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden"
          >
            {/* Mobile Categories Card List (< sm) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {categoryTreeItems.map((cat, idx) => {
                const stats =
                  (cat.id && categoryStats[cat.id]) ||
                  (cat.name && categoryStats[cat.name]) ||
                  (cat.name && categoryStats[normalizeLao(cat.name)]) ||
                  { count: 0, stockValue: 0 };
                const isRoot = cat.isRoot !== false;

                if (isRoot) {
                  const rootIndex = rootCategories.findIndex((r) => r.id === cat.id);
                  const isFirstRoot = rootIndex === 0;
                  const isLastRoot = rootIndex === rootCategories.length - 1;
                  const isBeingDragged = draggedRootId === cat.id;
                  const isDragOver = dragOverRootId === cat.id;

                  return (
                    <div
                      key={cat.id || idx}
                      data-root-category-id={cat.id}
                      draggable={!searchTerm.trim() && !isReordering}
                      onDragStart={(e) => handleDragStart(cat.id, e)}
                      onDragOver={(e) => handleDragOver(cat.id, e)}
                      onDrop={(e) => handleDrop(cat.id, e)}
                      onDragEnd={handleDragEnd}
                      className={`p-3.5 transition-all duration-150 select-none relative ${
                        isBeingDragged
                          ? 'opacity-30 bg-slate-100'
                          : isDragOver
                          ? 'bg-blue-50/90 shadow-[inset_0_4px_0_0_#2563eb,0_0_16px_rgba(37,99,235,0.35)]'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Glowing blue top border when dragging over */}
                      {isDragOver && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600 shadow-[0_0_10px_2px_#2563eb] pointer-events-none z-10 rounded-t-xl" />
                      )}

                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {/* Grip handle and sequence number for root category */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div
                              onTouchStart={(e) => handleTouchStart(cat, rootIndex !== -1 ? rootIndex : idx, e)}
                              onTouchMove={handleTouchMove}
                              onTouchEnd={handleTouchEnd}
                              onTouchCancel={handleTouchCancel}
                              style={{ touchAction: 'none' }}
                              className={`touch-none flex items-center gap-1 p-1 rounded-md text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors select-none ${
                                searchTerm.trim() ? 'opacity-30 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
                              }`}
                              title={searchTerm.trim() ? 'ລຶບຄຳຄົ້ນຫາເພື່ອປັບປ່ຽນລຳດັບ' : 'ກົດຄ້າງແລ້ວລາກເພື່ອປັບປ່ຽນລຳດັບ'}
                            >
                              <DotsSixVertical size={18} weight="bold" />
                              <span className="text-xs font-mono font-bold text-slate-600 min-w-[16px] text-center select-none">
                                {rootIndex !== -1 ? rootIndex + 1 : idx + 1}
                              </span>
                            </div>
                          </div>

                          {cat.hasChildren && (
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => toggleCollapse(cat.id, e)}
                              className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 cursor-pointer"
                              title={cat.isCollapsed ? 'ຂະຫຍາຍ' : 'ຫຍໍ້'}
                            >
                              {cat.isCollapsed ? <CaretRight size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
                            </button>
                          )}
                          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
                            <Folders size={17} weight="duotone" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-900 text-sm truncate">
                                {cat.name}
                              </span>
                              {cat.childCount > 0 ? (
                                <span className="px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                                  ໝວດຫຼັກ ({cat.childCount} ໝວດຍ່ອຍ)
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                                  ໝວດຫຼັກ
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              playActionClickBeep('category');
                              setSelectedDetailCat(cat);
                            }}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/60"
                            title="ເບິ່ງລາຍການສິນຄ້າ"
                          >
                            <Eye size={14} weight="bold" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              playActionClickBeep('category');
                              setEditingCat(cat);
                              setEditingName(cat.name);
                              setEditingParentId(cat.parent_id || '');
                            }}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/60"
                            title="ແກ້ໄຂຊື່ໝວດໝູ່"
                          >
                            <PencilSimple size={14} weight="bold" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              playActionClickBeep('category');
                              setCatToDelete(cat);
                            }}
                            className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer border border-rose-200"
                            title="ລຶບໝວດໝູ່"
                          >
                            <Trash size={14} weight="bold" />
                          </button>
                        </div>
                      </div>

                      {/* Secondary row in mobile: product count badge and + ໝວດຍ່ອຍ button */}
                      <div className="mt-2.5 flex items-center justify-between gap-2 pl-1" onMouseDown={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            playActionClickBeep('category');
                            setSelectedDetailCat(cat);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-full font-bold text-[11px] transition-colors cursor-pointer border border-teal-200/80"
                        >
                          <Package size={12} weight="bold" />
                          <span>{stats.count} ລາຍການ</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenAddChild(cat)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold transition-all border border-teal-200 cursor-pointer active:scale-95 shadow-2xs"
                          title={`ເພີ່ມໝວດຍ່ອຍລົງໃນ "${cat.name}"`}
                        >
                          <FolderPlus size={13} weight="bold" />
                          <span>+ ໝວດຍ່ອຍ</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                // Child Category in mobile (indented directly under its parent)
                return (
                  <div key={cat.id || idx} className="p-3 pl-8 bg-amber-50/20 hover:bg-amber-50/40 border-l-2 border-amber-300 transition-colors flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-amber-600 font-bold text-sm shrink-0">↳</span>
                      <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/70">
                        <Folder size={15} weight="duotone" />
                      </div>
                      <span className="font-bold text-slate-800 text-xs truncate">
                        {cat.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          playActionClickBeep('category');
                          setSelectedDetailCat(cat);
                        }}
                        className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-full font-bold text-[10px] transition-colors cursor-pointer border border-teal-200"
                        title="ເບິ່ງລາຍການສິນຄ້າ"
                      >
                        {stats.count}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playActionClickBeep('category');
                          setEditingCat(cat);
                          setEditingName(cat.name);
                          setEditingParentId(cat.parent_id || '');
                        }}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/60"
                        title="ແກ້ໄຂໝວດຍ່ອຍ"
                      >
                        <PencilSimple size={14} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playActionClickBeep('category');
                          setCatToDelete(cat);
                        }}
                        className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer border border-rose-200"
                        title="ລຶບໝວດຍ່ອຍ"
                      >
                        <Trash size={14} weight="bold" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-3 px-3 w-20 text-center">ລຳດັບ</th>
                    <th className="py-3 px-4">ຊື່ໝວດໝູ່ (Category Name)</th>
                    <th className="py-3 px-4 text-center w-36">ຈຳນວນສິນຄ້າ</th>
                    <th className="py-3 px-3 text-center w-32">ເພີ່ມໝວດຍ່ອຍ</th>
                    <th className="py-3 px-4 text-center w-32">ຈັດການ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categoryTreeItems.map((cat, idx) => {
                    const stats =
                      (cat.id && categoryStats[cat.id]) ||
                      (cat.name && categoryStats[cat.name]) ||
                      (cat.name && categoryStats[normalizeLao(cat.name)]) ||
                      { count: 0, stockValue: 0 };
                    const isRoot = cat.isRoot !== false;

                    if (isRoot) {
                      const rootIndex = rootCategories.findIndex((r) => r.id === cat.id);
                      const isFirstRoot = rootIndex === 0;
                      const isLastRoot = rootIndex === rootCategories.length - 1;
                      const isBeingDragged = draggedRootId === cat.id;
                      const isDragOver = dragOverRootId === cat.id;

                      return (
                        <tr
                          key={cat.id || idx}
                          data-root-category-id={cat.id}
                          draggable={!searchTerm.trim() && !isReordering}
                          onDragStart={(e) => handleDragStart(cat.id, e)}
                          onDragOver={(e) => handleDragOver(cat.id, e)}
                          onDrop={(e) => handleDrop(cat.id, e)}
                          onDragEnd={handleDragEnd}
                          className={`transition-colors duration-150 select-none ${
                            isBeingDragged
                              ? 'opacity-30 bg-slate-100'
                              : isDragOver
                              ? 'bg-blue-50/70'
                              : 'hover:bg-slate-50/80 bg-white'
                          }`}
                        >
                          {/* Sequence Number & Drag Handle ONLY */}
                          <td className={`py-2.5 px-3 text-center font-bold text-slate-500 transition-all duration-150 ${
                            isDragOver ? 'shadow-[inset_0_4px_0_0_#2563eb,inset_0_8px_12px_-4px_rgba(37,99,235,0.35)] bg-blue-50/90' : ''
                          }`}>
                            <div
                              onTouchStart={(e) => handleTouchStart(cat, rootIndex !== -1 ? rootIndex : idx, e)}
                              onTouchMove={handleTouchMove}
                              onTouchEnd={handleTouchEnd}
                              onTouchCancel={handleTouchCancel}
                              style={{ touchAction: 'none' }}
                              className={`touch-none flex items-center justify-center gap-1.5 p-1 rounded-lg transition-colors select-none ${
                                searchTerm.trim() ? 'opacity-30 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:bg-blue-50 hover:text-blue-700'
                              }`}
                              title={searchTerm.trim() ? 'ລຶບຄຳຄົ້ນຫາເພື່ອປັບປ່ຽນລຳດັບ' : 'ກົດຄ້າງແລ້ວລາກເພື່ອປັບປ່ຽນລຳດັບ'}
                            >
                              <DotsSixVertical size={18} weight="bold" />
                              <span className="text-xs font-mono font-black text-slate-700 min-w-[18px] text-center select-none">
                                {rootIndex !== -1 ? rootIndex + 1 : idx + 1}
                              </span>
                            </div>
                          </td>
                          <td className={`py-3 px-4 transition-all duration-150 ${
                            isDragOver ? 'shadow-[inset_0_4px_0_0_#2563eb,inset_0_8px_12px_-4px_rgba(37,99,235,0.35)] bg-blue-50/90' : ''
                          }`}>
                            <div className="flex items-center gap-2">
                              {/* Tree collapse/expand toggle icon placed in Category column right before Folder */}
                              {cat.hasChildren ? (
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => toggleCollapse(cat.id, e)}
                                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                                  title={cat.isCollapsed ? 'ຂະຫຍາຍ' : 'ຫຍໍ້'}
                                >
                                  {cat.isCollapsed ? <CaretRight size={13} weight="bold" /> : <CaretDown size={13} weight="bold" />}
                                </button>
                              ) : (
                                <span className="w-6 shrink-0" />
                              )}

                              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
                                <Folders size={17} weight="duotone" />
                              </div>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-extrabold text-slate-900 text-[13px] truncate">
                                  {cat.name}
                                </span>
                                {cat.childCount > 0 ? (
                                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200/90 shrink-0">
                                    ໝວດຫຼັກ ({cat.childCount} ໝວດຍ່ອຍ)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200/90 shrink-0">
                                    ໝວດຫຼັກ
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={`py-3 px-4 text-center transition-all duration-150 ${
                            isDragOver ? 'shadow-[inset_0_4px_0_0_#2563eb,inset_0_8px_12px_-4px_rgba(37,99,235,0.35)] bg-blue-50/90' : ''
                          }`}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={() => {
                                playActionClickBeep('category');
                                setSelectedDetailCat(cat);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-full font-bold text-xs transition-colors cursor-pointer border border-teal-200/80"
                              title="ກົດເພື່ອເບິ່ງລາຍການສິນຄ້າໃນໝວດນີ້"
                            >
                              <Package size={14} weight="bold" />
                              <span>{stats.count} ລາຍການ</span>
                            </button>
                          </td>
                          <td className={`py-3 px-3 text-center transition-all duration-150 ${
                            isDragOver ? 'shadow-[inset_0_4px_0_0_#2563eb,inset_0_8px_12px_-4px_rgba(37,99,235,0.35)] bg-blue-50/90' : ''
                          }`}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={() => handleOpenAddChild(cat)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold transition-all border border-teal-200 cursor-pointer active:scale-95 shadow-2xs"
                              title={`ເພີ່ມໝວດຍ່ອຍລົງໃນ "${cat.name}"`}
                            >
                              <FolderPlus size={14} weight="bold" />
                              <span>+ ໝວດຍ່ອຍ</span>
                            </button>
                          </td>
                          <td className={`py-3 px-4 text-center transition-all duration-150 ${
                            isDragOver ? 'shadow-[inset_0_4px_0_0_#2563eb,inset_0_8px_12px_-4px_rgba(37,99,235,0.35)] bg-blue-50/90' : ''
                          }`}>
                            <div className="flex items-center justify-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
                              {/* View Detail Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  playActionClickBeep('category');
                                  setSelectedDetailCat(cat);
                                }}
                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 flex items-center justify-center transition-colors cursor-pointer"
                                title="ເບິ່ງລາຍການສິນຄ້າ"
                              >
                                <Eye size={16} weight="bold" />
                              </button>

                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  playActionClickBeep('category');
                                  setEditingCat(cat);
                                  setEditingName(cat.name);
                                  setEditingParentId(cat.parent_id || '');
                                }}
                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 flex items-center justify-center transition-colors cursor-pointer"
                                title="ແກ້ໄຂຊື່ໝວດໝູ່"
                              >
                                <PencilSimple size={16} weight="bold" />
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  playActionClickBeep('category');
                                  setCatToDelete(cat);
                                }}
                                className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                                title="ລຶບໝວດໝູ່"
                              >
                                <Trash size={16} weight="bold" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // Child Category row in Desktop Table (rendered directly under its parent category)
                    return (
                      <tr key={cat.id || idx} className="hover:bg-amber-50/30 bg-slate-50/50 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-300">
                          <span className="text-slate-300">-</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2 pl-7 sm:pl-8">
                            <span className="text-amber-600 font-bold text-sm shrink-0">↳</span>
                            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/80">
                              <Folder size={15} weight="duotone" />
                            </div>
                            <span className="font-bold text-slate-800 text-[13px] truncate">
                              {cat.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              playActionClickBeep('category');
                              setSelectedDetailCat(cat);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-full font-bold text-xs transition-colors cursor-pointer border border-teal-200/80"
                            title="ກົດເພື່ອເບິ່ງລາຍການສິນຄ້າໃນໝວດຍ່ອຍນີ້"
                          >
                            <Package size={13} weight="bold" />
                            <span>{stats.count} ລາຍການ</span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-300 font-mono text-xs">
                          -
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* View Detail Button */}
                            <button
                              type="button"
                              onClick={() => {
                                playActionClickBeep('category');
                                setSelectedDetailCat(cat);
                              }}
                              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 flex items-center justify-center transition-colors cursor-pointer"
                              title="ເບິ່ງລາຍການສິນຄ້າ"
                            >
                              <Eye size={16} weight="bold" />
                            </button>

                            {/* Edit Sub-category Button */}
                            <button
                              type="button"
                              onClick={() => {
                                playActionClickBeep('category');
                                setEditingCat(cat);
                                setEditingName(cat.name);
                                setEditingParentId(cat.parent_id || '');
                              }}
                              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 flex items-center justify-center transition-colors cursor-pointer"
                              title="ແກ້ໄຂໝວດຍ່ອຍ"
                            >
                              <PencilSimple size={16} weight="bold" />
                            </button>

                            {/* Delete Sub-category Button */}
                            <button
                              type="button"
                              onClick={() => {
                                playActionClickBeep('category');
                                setCatToDelete(cat);
                              }}
                              className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                              title="ລຶບໝວດຍ່ອຍ"
                            >
                              <Trash size={16} weight="bold" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <Plus size={18} weight="bold" />
                <span>ເພີ່ມໝວດໝູ່ໃໝ່</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-blue-200 hover:text-white cursor-pointer"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ຊື່ໝວດໝູ່ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="ຕົວຢ່າງ: ເຄື່ອງດື່ມ, ເຂົ້າໜົມ, ຢາສູບ..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ໝວດຫຼັກ (Parent Category) <span className="text-slate-400 font-normal">(ເລືອກຖ້າເປັນໝວດຍ່ອຍ)</span>
                </label>
                <select
                  value={newCatParentId}
                  onChange={(e) => setNewCatParentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="">-- ເປັນໝວດໝູ່ຫຼັກ (Root Category) --</option>
                  {rootCategories.map((rc) => (
                    <option key={rc.id} value={rc.id}>
                      ໝວດຫຼັກ: {rc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newCatName.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingCat && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <PencilSimple size={18} weight="bold" />
                <span>ແກ້ໄຂຊື່ໝວດໝູ່</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingCat(null)}
                className="text-blue-200 hover:text-white cursor-pointer"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ຊື່ໝວດໝູ່ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ໝວດຫຼັກ (Parent Category)
                </label>
                <select
                  value={editingParentId}
                  onChange={(e) => setEditingParentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="">-- ເປັນໝວດໝູ່ຫຼັກ (Root Category) --</option>
                  {rootCategories
                    .filter((rc) => rc.id !== editingCat?.id)
                    .map((rc) => (
                      <option key={rc.id} value={rc.id}>
                        ໝວດຫຼັກ: {rc.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCat(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !editingName.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? 'ກຳລັງອັບເດດ...' : 'ອັບເດດ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {catToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden p-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <WarningCircle size={24} weight="fill" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">ຢືນຢັນການລຶບໝວດໝູ່</h4>
                <p className="text-xs text-slate-500">ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບ?</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
              ໝວດໝູ່ທີ່ຈະລຶບ: <span className="font-bold text-rose-600">"{catToDelete.name}"</span>
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCatToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isSubmitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting ? 'ກຳລັງລຶບ...' : 'ຢືນຢັນລຶບ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Products Detail Modal */}
      {selectedDetailCat && (
        <CategoryProductsDetailModal
          category={selectedDetailCat}
          products={products}
          isOpen={Boolean(selectedDetailCat)}
          onClose={() => setSelectedDetailCat(null)}
          onAssignProduct={onAssignProduct}
          onRemoveProduct={onRemoveProduct}
          onBatchAssignProducts={onBatchAssignProducts}
          onBatchRemoveProducts={onBatchRemoveProducts}
          onOpenCreateProduct={onOpenCreateProduct}
          onAlert={onAlert}
        />
      )}
    </div>
  );
}
