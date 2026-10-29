import React, { useState, useMemo, useEffect } from 'react';
import {
  MagnifyingGlassPlus,
  Folders,
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
} from '@phosphor-icons/react';
import { formatCompoundStock, formatKip } from '../utils/formatters';
import { playActionClickBeep, playSuccessBeep, playUnitChangeBeep } from '../utils/audioFeedback';
import { useHardwareBarcodeScanner } from '../hooks/useHardwareBarcodeScanner';

/**
 * Modal to view all products belonging to a specific category
 */
function CategoryProductsDetailModal({ category, products = [], isOpen, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [previewProduct, setPreviewProduct] = useState(null);

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
    enabled: isOpen,
    maxInterval: 180,
    duplicateInterval: 300,
    minLength: 3,
    preventDefaultOnEnter: true,
    cleanActiveInput: true,
  });

  if (!isOpen || !category) return null;

  const categoryName = (category.name || '').trim();
  const categoryId = category.id;

  const categoryProducts = (products || []).filter((p) => {
    const pCat = (p.category || 'ທົ່ວໄປ').trim();
    return pCat.toLowerCase() === categoryName.toLowerCase() || p.categoryId === categoryId;
  });

  const filtered = categoryProducts.filter((p) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    const nameMatch = (p.name || '').toLowerCase().includes(q);
    const viMatch = (p.name_vi || p.nameVi || '').toLowerCase().includes(q);
    const barcodeMatch = (p.barcode || '').toLowerCase().includes(q);
    const unitsBarcodeMatch = (p.units || []).some((u) => (u.barcode || '').toLowerCase().includes(q));
    return nameMatch || viMatch || barcodeMatch || unitsBarcodeMatch;
  });

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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-teal-700 to-emerald-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Folders size={22} weight="duotone" className="text-teal-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg leading-tight truncate">
                  ໝວດໝູ່: {category.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white shrink-0">
                  {totalItems} ສິນຄ້າ
                </span>
              </div>
              <p className="text-xs text-teal-100/80 truncate mt-0.5">
                ມູນຄ່າສະຕັອກລວມໃນໝວດ: {formatKip(totalStockVal)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="ປິດ (Close)"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* Search inside category & barcode scan indicator */}
        <div className="p-2.5 sm:p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={18}
              weight="bold"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ຄົ້ນຫາຊື່ ຫຼື ຍິງບາໂຄດສະແກນໄດ້ທັນທີ..."
              className="w-full pl-10 pr-9 py-2 bg-white rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all"
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
          <span className="text-xs text-slate-500 font-bold shrink-0 text-right sm:text-left">
            ສະແດງ {filtered.length} / {totalItems} ລາຍການ
          </span>
        </div>

        {/* Products Table List: Removed cost & barcode columns, Added image thumbnail */}
        <div className="flex-1 overflow-y-auto min-h-0 p-2.5 sm:p-5">
          {filtered.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Package size={42} weight="light" className="opacity-50" />
              <p className="text-xs font-medium">
                {searchTerm ? 'ບໍ່ພົບສິນຄ້າທີ່ມີຊື່ ຫຼື ບາໂຄດນີ້ໃນໝວດ' : 'ບໍ່ພົບສິນຄ້າໃນໝວດນີ້'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-2 w-10 text-center hidden sm:table-cell">ລ/ດ</th>
                    <th className="py-2.5 px-2 w-12 text-center">ຮູບ</th>
                    <th className="py-2.5 px-3">ຊື່ສິນຄ້າ</th>
                    <th className="py-2.5 px-3 text-right">ລາຄາຂາຍ</th>
                    <th className="py-2.5 px-2 text-center">ສະຕັອກ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((prod, idx) => {
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
                      <tr key={prod.id || idx} className="hover:bg-slate-50/80 transition-colors">
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
                              className="relative group/thumb cursor-zoom-in shrink-0 rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-teal-500 w-10 h-10 mx-auto block shadow-2xs"
                              title="ກົດເພື່ອເບິ່ງຮູບຂະໜາດໃຫຍ່ (Click to zoom image)"
                            >
                              <img
                                src={prod.imageUrl || prod.image_url}
                                alt={prod.name}
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
                        <td className="py-2.5 px-3 min-w-[200px]">
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
                        <td className="py-2.5 px-3 text-right font-mono">
                          {cartonUnit && Number(cartonUnit.retailPrice) > 0 ? (
                            <div className="font-bold text-teal-700 text-xs">
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
                        <td className="py-2.5 px-3 text-center font-medium text-slate-700">
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            ປິດ
          </button>
        </div>
            {/* Product Image Zoom / Lightbox Modal Popup with high z-index overlaying modal */}
      {previewProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
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
  onRefresh,
  isLoading = false,
  onAlert,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [selectedDetailCat, setSelectedDetailCat] = useState(null);
  const [catToDelete, setCatToDelete] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map category products counts & stock value
  const categoryStats = useMemo(() => {
    const stats = {};
    (categories || []).forEach((c) => {
      stats[c.id || c.name] = {
        count: 0,
        stockValue: 0,
        trackedUnits: 0,
      };
    });

    (products || []).forEach((p) => {
      const pCat = (p.category || 'ທົ່ວໄປ').trim().toLowerCase();
      const matched = (categories || []).find(
        (c) => (c.name || '').trim().toLowerCase() === pCat || c.id === p.categoryId
      );

      const key = matched ? matched.id || matched.name : p.category;
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
      const key = c.id || c.name;
      const count = categoryStats[key]?.count || 0;
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

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return (categories || []).filter((c) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.trim().toLowerCase();
      return (c.name || '').toLowerCase().includes(q);
    });
  }, [categories, searchTerm]);

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
      const res = await onCreateCategory(clean);
      if (res) {
        setNewCatName('');
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
    if (clean === editingCat.name) {
      setEditingCat(null);
      return;
    }

    setIsSubmitting(true);
    try {
      playActionClickBeep('category');
      const res = await onUpdateCategory(editingCat.id, clean, editingCat.name);
      if (res?.success !== false) {
        setEditingCat(null);
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
    const key = cat.id || cat.name;
    const count = categoryStats[key]?.count || 0;

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
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 min-h-0 pb-28 sm:pb-6">
        
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

        {filteredCategories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Folders size={48} weight="light" className="opacity-50 text-teal-600" />
            <p className="text-sm font-bold text-slate-700">ບໍ່ພົບໝວດໝູ່ສິນຄ້າ</p>
            <p className="text-xs text-slate-400 text-center max-w-sm">
              {searchTerm ? 'ບໍ່ມີໝວດໝູ່ທີ່ກົງກັບຄຳຄົ້ນຫາ' : 'ຍັງບໍ່ມີໝວດໝູ່ໃນລະບົບ, ກົດປຸ່ມດ້ານເທິງເພື່ອເພີ່ມໝວດໝູ່ໃໝ່'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Mobile Categories Card List (< sm) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {filteredCategories.map((cat, idx) => {
                const key = cat.id || cat.name;
                const stats = categoryStats[key] || { count: 0, stockValue: 0 };

                return (
                  <div key={cat.id || idx} className="p-3.5 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
                        <Tag size={16} weight="bold" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-slate-900 text-sm truncate">
                          {cat.name}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            playActionClickBeep('category');
                            setSelectedDetailCat(cat);
                          }}
                          className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-full font-bold text-[11px] transition-colors cursor-pointer border border-teal-200/80"
                        >
                          <Package size={12} weight="bold" />
                          <span>{stats.count} ລາຍການ</span>
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          playActionClickBeep('category');
                          setSelectedDetailCat(cat);
                        }}
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/60"
                        title="ເບິ່ງລາຍການສິນຄ້າ"
                      >
                        <Eye size={15} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playActionClickBeep('category');
                          setEditingCat(cat);
                          setEditingName(cat.name);
                        }}
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/60"
                        title="ແກ້ໄຂຊື່ໝວດໝູ່"
                      >
                        <PencilSimple size={15} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playActionClickBeep('category');
                          setCatToDelete(cat);
                        }}
                        className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer border border-rose-200"
                        title="ລຶບໝວດໝູ່"
                      >
                        <Trash size={15} weight="bold" />
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
                    <th className="py-3 px-3.5 w-14 text-center">ລ/ດ</th>
                    <th className="py-3 px-4">ຊື່ໝວດໝູ່ (Category Name)</th>
                    <th className="py-3 px-4 text-center">ຈຳນວນສິນຄ້າ (Total Products)</th>
                    <th className="py-3 px-4 text-center w-36">ຈັດການ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCategories.map((cat, idx) => {
                    const key = cat.id || cat.name;
                    const stats = categoryStats[key] || { count: 0, stockValue: 0 };

                    return (
                      <tr key={cat.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                              <Tag size={15} weight="bold" />
                            </div>
                            <span className="font-extrabold text-slate-900 text-[13px]">
                              {cat.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
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
                        <td className="py-3 px-4 text-center">
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

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => {
                                playActionClickBeep('category');
                                setEditingCat(cat);
                                setEditingName(cat.name);
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
            <div className="px-5 py-4 bg-teal-600 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <Plus size={18} weight="bold" />
                <span>ເພີ່ມໝວດໝູ່ໃໝ່</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-teal-200 hover:text-white cursor-pointer"
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 focus:bg-white transition-all"
                />
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
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer shadow-xs"
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
            <div className="px-5 py-4 bg-teal-600 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <PencilSimple size={18} weight="bold" />
                <span>ແກ້ໄຂຊື່ໝວດໝູ່</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingCat(null)}
                className="text-teal-200 hover:text-white cursor-pointer"
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 focus:bg-white transition-all"
                />
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
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer shadow-xs"
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
        />
      )}
    </div>
  );
}
