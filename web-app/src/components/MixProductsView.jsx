import React, { useState, useMemo, useEffect } from 'react';
import {
  Intersect,
  Plus,
  MagnifyingGlass,
  X,
  PencilSimple,
  Trash,
  ArrowLeft,
  Check,
  CheckCircle,
  Package,
  Barcode,
  Tag,
  WarningCircle,
  Funnel,
  CheckSquare,
  Square,
  Sparkle,
  SlidersHorizontal,
} from '@phosphor-icons/react';
import { formatKip, formatBaht, normalizeLao } from '../utils/formatters';
import { playActionClickBeep, playSuccessBeep, playErrorBeep } from '../utils/audioFeedback';
import { useHardwareBarcodeScanner } from '../hooks/useHardwareBarcodeScanner';

/**
 * Helper to safely extract carton specification & prices from a product
 */
function getProductCartonSpec(p, exchangeRate = 0) {
  if (!p) return null;
  const units = Array.isArray(p.units) ? p.units : [];

  const cartonUnit =
    units.find(
      (u) =>
        u.tier === 3 ||
        u.id?.endsWith('_carton') ||
        ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງໃຫຍ່', 'ຖັງ'].includes(u.unitName)
    ) ||
    [...units].sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1))[0];

  const pieceUnit =
    units.find(
      (u) =>
        u.isBaseUnit ||
        Number(u.multiplier) === 1 ||
        u.tier === 1 ||
        u.id?.endsWith('_piece') ||
        u.id?.endsWith('_pack') ||
        ['ອັນ', 'ແກ້ວ', 'ຖົງ', 'ກະປ໋ອງ', 'ຕຸກ', 'ຊອງ', 'ກ່ອງນ້ອຍ', 'ກ່ອງ', 'ແພັກ'].includes(u.unitName)
    ) || units[0];

  const packageQty = Number(
    cartonUnit?.multiplier ||
    p.cartonMultiplier ||
    p.package_qty ||
    24
  );

  const unitName = (
    cartonUnit?.unitName ||
    p.cartonUnitName ||
    p.unit_name ||
    'ແກັດ'
  ).trim();

  const baseUnitName = (
    pieceUnit?.unitName ||
    p.pieceUnitName ||
    p.base_unit_name ||
    'ອັນ'
  ).trim();

  const rawLak = Number(
    cartonUnit?.retailPrice ??
    cartonUnit?.price_1 ??
    cartonUnit?.price1 ??
    cartonUnit?.wholesalePrice ??
    p.cartonPrice ??
    0
  );

  const priceLak = rawLak > 0 ? rawLak : (Number(p.retailPrice || 0) * (packageQty > 0 ? packageQty : 24));

  let priceThb = Number(
    cartonUnit?.retailPriceBaht ??
    cartonUnit?.price_1_baht ??
    cartonUnit?.wholesalePriceBaht ??
    p.cartonPriceBaht ??
    0
  );
  if (priceThb <= 0 && exchangeRate > 0 && priceLak > 0) {
    priceThb = Number((priceLak / exchangeRate).toFixed(2));
  }

  const piecePrice = Number(
    pieceUnit?.retailPrice ??
    pieceUnit?.price_1 ??
    pieceUnit?.price1 ??
    pieceUnit?.wholesalePrice ??
    p.retailPrice ??
    0
  );

  return {
    productId: p.id,
    productName: p.name,
    packageQty: packageQty > 1 ? packageQty : 24,
    unitName: unitName || 'ແກັດ',
    baseUnitName: baseUnitName || 'ອັນ',
    priceLak,
    priceThb,
    piecePrice,
    cartonUnit,
    pieceUnit,
  };
}

export default function MixProductsView({
  bundles = [],
  products = [],
  exchangeRate = 0,
  onSaveBundle,
  onDeleteBundle,
  onAlert,
}) {
  // 'list' | 'form'
  const [viewMode, setViewMode] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [bundleToDelete, setBundleToDelete] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [editingBundleId, setEditingBundleId] = useState(null); // 'new' or bundle.id
  const [name, setName] = useState('');
  const [nameVi, setNameVi] = useState('');
  const [barcode, setBarcode] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);

  // Flavors Selection Filters
  const [flavorSearchTerm, setFlavorSearchTerm] = useState('');
  const [flavorCategoryFilter, setFlavorCategoryFilter] = useState('ALL');
  const [flavorStatusFilter, setFlavorStatusFilter] = useState('ALL'); // 'ALL' | 'SELECTED' | 'UNSELECTED'

  // Validation Feedback Banner: { type: 'success' | 'error', message: string }
  const [feedback, setFeedback] = useState(null);

  const showToast = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Extract categories for filter
  const productCategories = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => {
      if (p.category) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Open Create Form
  const handleOpenCreateForm = () => {
    playActionClickBeep('mix');
    setEditingBundleId('new');
    setName('');
    setNameVi('');
    setBarcode('');
    setSelectedProductIds([]);
    setFlavorSearchTerm('');
    setFlavorCategoryFilter('ALL');
    setFlavorStatusFilter('ALL');
    setFeedback(null);
    setViewMode('form');
  };

  // Open Edit Form
  const handleOpenEditForm = (b) => {
    playActionClickBeep('mix');
    setEditingBundleId(b.id);
    setName(b.name || '');
    setNameVi(b.name_vi || '');
    setBarcode(b.barcode || '');
    const ids = b.itemIds || (b.product_bundle_items || []).map((it) => it.product_id) || [];
    setSelectedProductIds(ids);
    setFlavorSearchTerm('');
    setFlavorCategoryFilter('ALL');
    setFlavorStatusFilter('ALL');
    setFeedback(null);
    setViewMode('form');
  };

  // Hardware Scanner support in form mode
  useHardwareBarcodeScanner({
    onScan: (scannedCode) => {
      if (viewMode !== 'form') return;
      if (!scannedCode) return;
      setBarcode(String(scannedCode).trim());
      playSuccessBeep();
    },
    enabled: viewMode === 'form',
    maxInterval: 180,
    duplicateInterval: 300,
    minLength: 3,
    preventDefaultOnEnter: true,
    cleanActiveInput: true,
  });

  // Inherited specification from first selected product
  const inheritedSpec = useMemo(() => {
    if (selectedProductIds.length === 0) return null;
    const firstProd = (products || []).find((p) => p.id === selectedProductIds[0]);
    if (!firstProd) return null;
    return getProductCartonSpec(firstProd, exchangeRate);
  }, [selectedProductIds, products, exchangeRate]);

  const activeExistingBundle = useMemo(() => {
    if (!editingBundleId || editingBundleId === 'new') return null;
    return bundles.find((x) => x.id === editingBundleId) || null;
  }, [editingBundleId, bundles]);

  const activePackageQty = inheritedSpec?.packageQty || activeExistingBundle?.package_qty || 24;
  const activeUnitName = inheritedSpec?.unitName || activeExistingBundle?.unit_name || 'ແກັດ';
  const activeBaseUnitName = inheritedSpec?.baseUnitName || activeExistingBundle?.base_unit_name || 'ອັນ';
  const activePriceLak = inheritedSpec?.priceLak !== undefined ? inheritedSpec.priceLak : (Number(activeExistingBundle?.price_lak) || 0);
  const activePriceThb = inheritedSpec?.priceThb !== undefined ? inheritedSpec.priceThb : (Number(activeExistingBundle?.price_thb) || 0);

  // Candidate products list for form selection
  const candidateProducts = useMemo(() => {
    return (products || []).filter((p) => {
      const isSelected = selectedProductIds.includes(p.id);
      if (flavorStatusFilter === 'SELECTED' && !isSelected) return false;
      if (flavorStatusFilter === 'UNSELECTED' && isSelected) return false;

      if (flavorCategoryFilter !== 'ALL' && (p.category || 'ທົ່ວໄປ').trim() !== flavorCategoryFilter) {
        return false;
      }

      if (flavorSearchTerm.trim()) {
        const q = normalizeLao(flavorSearchTerm.trim());
        const matchName = normalizeLao(p.name || '').includes(q);
        const matchVi = normalizeLao(p.name_vi || p.nameVi || '').includes(q);
        const matchBarcode = (p.barcode || '').toLowerCase().includes(q.toLowerCase());
        if (!matchName && !matchVi && !matchBarcode) return false;
      }

      return true;
    });
  }, [products, selectedProductIds, flavorStatusFilter, flavorCategoryFilter, flavorSearchTerm]);

  // Toggle child product selection with STRICT VALIDATION
  const toggleSelectProduct = (prod) => {
    playActionClickBeep('mix');
    const prodId = prod.id;
    if (selectedProductIds.includes(prodId)) {
      setSelectedProductIds((prev) => prev.filter((id) => id !== prodId));
      return;
    }

    // Strict Validation: If there is already at least 1 selected product, validate packageQty, carton price, and pack price
    if (selectedProductIds.length > 0 && inheritedSpec) {
      const candidateSpec = getProductCartonSpec(prod, exchangeRate);
      if (!candidateSpec) {
        showToast('error', `ສິນຄ້າ "${prod.name}" ບໍ່ມີຂໍ້ມູນລາຄາ ຫຼື ຫົວໜ່ວຍຍົກລັງ!`);
        playErrorBeep('mix');
        return;
      }

      // 1. Validate packageQty (Số lượng pack trong 1 thùng phải khớp hoàn toàn)
      if (candidateSpec.packageQty !== inheritedSpec.packageQty) {
        showToast(
          'error',
          `ສິນຄ້າ "${prod.name}" ມີຂະໜາດ ${candidateSpec.packageQty} ${candidateSpec.baseUnitName}/${candidateSpec.unitName}, ບໍ່ກົງກັບກຸ່ມ (${inheritedSpec.packageQty} ${inheritedSpec.baseUnitName}/${inheritedSpec.unitName})!`
        );
        playErrorBeep('mix');
        return;
      }

      // 2. Validate carton price (Giá 1 thùng phải bằng nhau)
      if (candidateSpec.priceLak !== inheritedSpec.priceLak) {
        showToast(
          'error',
          `ສິນຄ້າ "${prod.name}" ລາຄາຍົກລັງແມ່ນ ${formatKip(candidateSpec.priceLak)}, ບໍ່ກົງກັບກຸ່ມ (${formatKip(inheritedSpec.priceLak)})! ທຸກລົດຊາດໃນກຸ່ມຕ້ອງມີລາຄາຍົກລັງເທົ່າກັນ.`
        );
        playErrorBeep('mix');
        return;
      }

      // 3. Validate piece/pack unit price (Giá bán từng pack/lẻ phải bằng nhau)
      if (candidateSpec.piecePrice !== inheritedSpec.piecePrice) {
        showToast(
          'error',
          `ສິນຄ້າ "${prod.name}" ລາຄາ ${candidateSpec.baseUnitName} ແມ່ນ ${formatKip(candidateSpec.piecePrice)}, ບໍ່ກົງກັບກຸ່ມ (${formatKip(inheritedSpec.piecePrice)})! ທຸກລົດຊາດໃນກຸ່ມຕ້ອງມີລາຄາຕໍ່ ${candidateSpec.baseUnitName} ເທົ່າກັນ.`
        );
        playErrorBeep('mix');
        return;
      }
    }

    // Auto-fill bundle name if empty when picking first product
    if (selectedProductIds.length === 0 && !name.trim()) {
      const spec = getProductCartonSpec(prod, exchangeRate);
      setName(`${prod.name} (ລວມລົດຊາດ ${spec?.packageQty || 24} ${spec?.baseUnitName || 'ອັນ'})`);
      if (prod.name_vi || prod.nameVi) {
        setNameVi(`${prod.name_vi || prod.nameVi} (Mix vị ${spec?.packageQty || 24} ${spec?.baseUnitName || 'hộp'})`);
      }
    }

    setSelectedProductIds((prev) => [...prev, prodId]);
  };

  // Select all filtered products with validation filter
  const handleSelectAllFiltered = () => {
    playActionClickBeep('mix');
    const unselected = candidateProducts.filter((p) => !selectedProductIds.includes(p.id));
    if (unselected.length === 0) return;

    let targetQty = inheritedSpec?.packageQty;
    let targetPriceLak = inheritedSpec?.priceLak;
    let targetPiecePrice = inheritedSpec?.piecePrice;
    if (!targetQty && unselected.length > 0) {
      const firstSpec = getProductCartonSpec(unselected[0], exchangeRate);
      targetQty = firstSpec?.packageQty || 24;
      targetPriceLak = firstSpec?.priceLak || 0;
      targetPiecePrice = firstSpec?.piecePrice || 0;
    }

    const validIds = [];
    const invalidNames = [];

    for (const p of unselected) {
      const spec = getProductCartonSpec(p, exchangeRate);
      if (
        spec &&
        spec.packageQty === targetQty &&
        spec.priceLak === targetPriceLak &&
        spec.piecePrice === targetPiecePrice
      ) {
        validIds.push(p.id);
      } else {
        invalidNames.push(p.name);
      }
    }

    if (invalidNames.length > 0) {
      showToast(
        'error',
        `ມີ ${invalidNames.length} ສິນຄ້າຂະໜາດ ຫຼື ລາຄາບໍ່ກົງກັນ, ເລືອກສະເພາະສິນຄ້າທີ່ກົງກັນ (${validIds.length} ລາຍການ)`
      );
      playErrorBeep('mix');
    } else {
      showToast('success', `ເລືອກເພີ່ມ ${validIds.length} ລາຍການສຳເລັດ!`);
    }

    setSelectedProductIds((prev) => Array.from(new Set([...prev, ...validIds])));
  };

  // Deselect all filtered products
  const handleDeselectAllFiltered = () => {
    playActionClickBeep('mix');
    const filteredIdsSet = new Set(candidateProducts.map((p) => p.id));
    setSelectedProductIds((prev) => prev.filter((id) => !filteredIdsSet.has(id)));
  };

  // Generate random barcode
  const handleGenerateRandomBarcode = () => {
    playActionClickBeep('mix');
    const prefix = 'MIX';
    const rand = Math.floor(10000000 + Math.random() * 90000000);
    setBarcode(`${prefix}${rand}`);
  };

  // Handle Form Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      onAlert?.('ກະລຸນາປ້ອນຊື່ສິນຄ້າ Mix!', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }
    if (selectedProductIds.length === 0) {
      onAlert?.('ກະລຸນາເລືອກຢ່າງໜ້ອຍ 1 ສິນຄ້າ ຫຼື ລົດຊາດທີ່ຢູ່ໃນກຸ່ມ Mix!', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const bundleData = {
        id: editingBundleId === 'new' ? undefined : editingBundleId,
        name: name.trim(),
        name_vi: nameVi.trim(),
        barcode: barcode.trim(),
        unit_name: activeUnitName,
        base_unit_name: activeBaseUnitName,
        package_qty: activePackageQty,
        price_lak: activePriceLak,
        price_thb: activePriceThb,
      };

      const res = await onSaveBundle(bundleData, selectedProductIds);
      if (res?.success !== false) {
        onAlert?.(
          editingBundleId === 'new'
            ? `ສ້າງສິນຄ້າ Mix "${name.trim()}" ສຳເລັດແລ້ວ!`
            : `ອັບເດດສິນຄ້າ Mix "${name.trim()}" ສຳເລັດແລ້ວ!`,
          'ສຳເລັດ',
          'success'
        );
        setViewMode('list');
      } else {
        onAlert?.(res?.error || 'ບໍ່ສາມາດບັນທຶກສິນຄ້າ Mix ໄດ້', 'ຜິດພາດ', 'error');
      }
    } catch (err) {
      onAlert?.(err.message || 'ເກີດຂໍ້ຜິດພາດ', 'ຜິດພາດ', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Bundle
  const confirmDeleteBundle = async () => {
    if (!bundleToDelete) return;
    setIsSubmitting(true);
    try {
      const res = await onDeleteBundle(bundleToDelete.id);
      if (res?.success !== false) {
        onAlert?.(`ລຶບສິນຄ້າ Mix "${bundleToDelete.name}" ສຳເລັດແລ້ວ!`, 'ສຳເລັດ', 'success');
        setBundleToDelete(null);
      } else {
        onAlert?.(res?.error || 'ບໍ່ສາມາດລຶບໄດ້', 'ຜິດພາດ', 'error');
      }
    } catch (err) {
      onAlert?.(err.message || 'ເກີດຂໍ້ຜິດພາດ', 'ຜິດພາດ', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered bundles for table list
  const filteredBundles = useMemo(() => {
    return (bundles || []).filter((b) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.trim().toLowerCase();
      const matchName = (b.name || '').toLowerCase().includes(q);
      const matchVi = (b.name_vi || '').toLowerCase().includes(q);
      const matchBarcode = (b.barcode || '').toLowerCase().includes(q);
      return matchName || matchVi || matchBarcode;
    });
  }, [bundles, searchTerm]);

  // High-level Mix Bundles KPI Metrics (MUST be before any early return to satisfy React Rules of Hooks)
  const mixKPI = useMemo(() => {
    const totalBundles = (bundles || []).length;
    let totalFlavorsLinked = 0;
    const uniqueProductIds = new Set();
    let topBundle = null;
    let maxFlavors = -1;

    (bundles || []).forEach((b) => {
      const items = b.itemIds || (b.product_bundle_items || []).map((it) => it.product_id || it.productId) || [];
      totalFlavorsLinked += items.length;
      items.forEach((id) => {
        if (id) uniqueProductIds.add(id);
      });
      if (items.length > maxFlavors) {
        maxFlavors = items.length;
        topBundle = { name: b.name, count: items.length };
      }
    });

    const avgFlavors = totalBundles > 0 ? (totalFlavorsLinked / totalBundles).toFixed(1) : '0';

    return {
      totalBundles,
      uniqueProductsCount: uniqueProductIds.size,
      topBundleName: topBundle && maxFlavors > 0 ? topBundle.name : '-',
      topBundleCount: maxFlavors > 0 ? maxFlavors : 0,
      avgFlavors,
    };
  }, [bundles]);

  // ════════════════════════════════════════════════════════════════════════════
  // 1. FORM MODE (FULL PAGE COMFORTABLE CREATION & EDITING)
  // ════════════════════════════════════════════════════════════════════════════
  if (viewMode === 'form') {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden font-sans">
        {/* Header Toolbar: Standardized responsive header matching Products & History */}
        <div className="bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3.5 shrink-0 shadow-2xs z-10 flex items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                playActionClickBeep('mix');
                setViewMode('list');
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="ກັບຄືນລາຍການ"
            >
              <ArrowLeft size={18} weight="bold" />
            </button>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="truncate">
                  {editingBundleId === 'new' ? 'ສ້າງສິນຄ້າ Mix ໃໝ່' : `ແກ້ໄຂ: ${name || 'ສິນຄ້າ Mix'}`}
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                  ຂາຍຍົກລັງແບບລວມລົດ
                </span>
              </h2>
              <p className="text-[11.5px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
                ກຳນົດຊື່, ບາໂຄດ ແລະ ເລືອກລົດຊາດ/ສິນຄ້າທີ່ຈະລວມຢູ່ໃນກຸ່ມນີ້
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              ຍົກເລີກ
            </button>
            <button
              type="button"
              onClick={handleFormSubmit}
              disabled={isSubmitting || !name.trim() || selectedProductIds.length === 0}
              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <Check size={16} weight="bold" />
              <span className="hidden sm:inline">{isSubmitting ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກສິນຄ້າ Mix'}</span>
              <span className="sm:hidden">{isSubmitting ? 'ກຳລັງ...' : 'ບັນທຶກ'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 min-h-0 pb-6">
          {/* Card 1: Basic Information */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Tag size={16} weight="bold" className="text-teal-600" />
              <span>ຂໍ້ມູນພື້ນຖານສິນຄ້າ Mix</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ຊື່ສິນຄ້າ Mix (ພາສາລາວ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ຕົວຢ່າງ: ເບຍລາວ 330ml ລວມລົດຊາດ (Mix)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ຊື່ສິນຄ້າ (ພາສາຫວຽດ / ທາງເລືອກ)
                </label>
                <input
                  type="text"
                  value={nameVi}
                  onChange={(e) => setNameVi(e.target.value)}
                  placeholder="Ví dụ: Bia Lào 330ml Thùng Mix vị"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ບາໂຄດສິນຄ້າ Mix (Barcode)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="ສະແກນ ຫຼື ສ້າງບາໂຄດໃໝ່"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateRandomBarcode}
                    className="px-2.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                    title="ສຸ່ມບາໂຄດໃໝ່"
                  >
                    <Sparkle size={15} weight="bold" />
                  </button>
                </div>
              </div>
            </div>

            {/* Inherited Carton Spec & Price Highlight */}
            <div className="mt-4 p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                  <Package size={18} weight="bold" />
                </div>
                <div>
                  <div className="text-xs font-bold text-teal-900">
                    ຂະໜາດບັນຈຸ: <span className="font-mono font-extrabold">{activePackageQty} {activeBaseUnitName}</span> / 1 {activeUnitName}
                  </div>
                  <div className="text-[11px] text-teal-700">
                    (ສືບທອດຂະໜາດ & ລາຄາຂາຍຍົກລັງອັດຕະໂນມັດຈາກລົດຊາດທຳອິດທີ່ເລືອກ)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div>
                  <div className="text-[10px] text-teal-700 font-bold uppercase">ລາຄາຂາຍກີບ (LAK)</div>
                  <div className="text-sm font-black font-mono text-teal-900">{formatKip(activePriceLak)}</div>
                </div>
                {activePriceThb > 0 && (
                  <div className="pl-3 border-l border-teal-200">
                    <div className="text-[10px] text-teal-700 font-bold uppercase">ລາຄາບາດ (THB)</div>
                    <div className="text-sm font-black font-mono text-teal-900">{formatBaht(activePriceThb)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Candidate Products Selector Table (List Table as originally requested!) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            
            {/* Toolbar Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-white">
              <div>
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <SlidersHorizontal size={16} weight="bold" className="text-teal-600" />
                  <span>ເລືອກລົດຊາດ / ສິນຄ້າທີ່ຢູ່ໃນກຸ່ມ Mix ນີ້</span>
                </h2>
                <p className="text-[11.5px] text-slate-500 mt-0.5">
                  ເລືອກຢ່າງໜ້ອຍ 1 ລາຍການ. ທຸກສິນຄ້າທີ່ເລືອກຕ້ອງມີຂະໜາດລັງ ແລະ ລາຄາຍົກລັງເທົ່າກັນ.
                </p>
              </div>

              {/* Selection Summary Counter Badge */}
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full text-xs font-extrabold">
                  ເລືອກແລ້ວ: {selectedProductIds.length} ລາຍການ
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                >
                  ເລືອກທັງໝົດທີ່ກັ່ນຕອງ
                </button>
                {selectedProductIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      playActionClickBeep('mix');
                      setSelectedProductIds([]);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    ລ້າງການເລືອກ
                  </button>
                )}
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="p-3 sm:px-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setFlavorStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                    flavorStatusFilter === 'ALL'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  ທັງໝົດ ({(products || []).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFlavorStatusFilter('SELECTED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    flavorStatusFilter === 'SELECTED'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-white hover:bg-teal-50 text-teal-800 border border-teal-200'
                  }`}
                >
                  <CheckCircle size={14} weight="fill" />
                  <span>ເລືອກແລ້ວ ({selectedProductIds.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFlavorStatusFilter('UNSELECTED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                    flavorStatusFilter === 'UNSELECTED'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  ຍັງບໍ່ເລືອກ ({(products || []).length - selectedProductIds.length})
                </button>
              </div>

              {/* Category Filter & Search Box */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={flavorCategoryFilter}
                    onChange={(e) => setFlavorCategoryFilter(e.target.value)}
                    className="pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="ALL">ທຸກໝວດໝູ່ ({products.length})</option>
                    {productCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <Funnel size={13} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                </div>

                <div className="relative">
                  <MagnifyingGlass
                    size={14}
                    className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={flavorSearchTerm}
                    onChange={(e) => setFlavorSearchTerm(e.target.value)}
                    placeholder="ຄົ້ນຫາຊື່ / ບາໂຄດ..."
                    className="pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500 w-44 sm:w-60"
                  />
                  {flavorSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setFlavorSearchTerm('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={12} weight="bold" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Validation Feedback Warning Banner (matching media_1793304569333_3c90d386.png) */}
            {feedback && (
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-center animate-in fade-in duration-200">
                <div
                  className={`px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold border transition-all shadow-sm ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle size={16} weight="fill" className="text-emerald-600 shrink-0" />
                  ) : (
                    <WarningCircle size={16} weight="fill" className="text-rose-600 shrink-0" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              </div>
            )}

            {/* Candidate Products List Table (Exact requested list table matching screenshot!) */}
            <div className="overflow-x-auto min-h-[350px] max-h-[550px] overflow-y-auto">
              {candidateProducts.length === 0 ? (
                <div className="py-20 text-center text-slate-400 text-xs">
                  <Package size={44} weight="duotone" className="mx-auto mb-2 text-slate-300" />
                  ບໍ່ພົບສິນຄ້າທີ່ກົງກັບເງື່ອນໄຂຄົ້ນຫາ
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-[10.5px] sm:text-[11px] font-black text-slate-600 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 select-none">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">ເລືອກ</th>
                      <th className="py-2.5 px-2 w-14">ຮູບ</th>
                      <th className="py-2.5 px-3">ຊື່ສິນຄ້າ / ລະຫັດບາໂຄດ</th>
                      <th className="py-2.5 px-3 w-32 hidden md:table-cell">ຂະໜາດລັງ</th>
                      <th className="py-2.5 px-2 w-20 text-center">ສະຕັອກ</th>
                      <th className="py-2.5 px-3 w-36 text-right">ລາຄາຂາຍຍົກລັງ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {candidateProducts.map((p) => {
                      const isChecked = selectedProductIds.includes(p.id);
                      const rawStock = Number(p.currentStockBaseUnits ?? p.current_stock_base_units ?? 0);
                      const isLowStock = p.trackStock !== false && rawStock <= 0;
                      const spec = getProductCartonSpec(p, exchangeRate);

                      return (
                        <tr
                          key={p.id}
                          onClick={() => toggleSelectProduct(p)}
                          className={`cursor-pointer transition-colors select-none ${
                            isChecked
                              ? 'bg-teal-50/70 border-l-4 border-l-teal-600 hover:bg-teal-50'
                              : 'hover:bg-slate-50 border-l-4 border-l-transparent text-slate-700'
                          }`}
                        >
                          {/* 1. Checkbox column */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center">
                              {isChecked ? (
                                <div className="w-5 h-5 rounded-md bg-teal-600 text-white flex items-center justify-center shadow-2xs">
                                  <Check size={14} weight="bold" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-md border-2 border-slate-300 bg-white" />
                              )}
                            </div>
                          </td>

                          {/* 2. Image Thumbnail */}
                          <td className="py-2.5 px-2">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-400 overflow-hidden shrink-0">
                              {p.imageUrl || p.image_url ? (
                                <img
                                  src={p.imageUrl || p.image_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <Package size={20} weight="duotone" />
                              )}
                            </div>
                          </td>

                          {/* 3. Product Name & Subtext / Barcode */}
                          <td className="py-2.5 px-3">
                            <div
                              className={`text-xs sm:text-sm leading-snug ${
                                isChecked ? 'font-black text-teal-950' : 'font-bold text-slate-900'
                              }`}
                            >
                              {p.name}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-500">
                              {p.name_vi && <span>{p.name_vi}</span>}
                              {p.barcode && (
                                <span className="font-mono text-[10.5px] text-slate-400 flex items-center gap-0.5">
                                  <Barcode size={12} />
                                  <span>{p.barcode}</span>
                                </span>
                              )}
                              {/* Mobile packaging pill when md:table-cell is hidden */}
                              {spec && (
                                <span className="inline-flex md:hidden px-1.5 py-0.2 rounded text-[9.5px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200">
                                  {spec.packageQty} {spec.baseUnitName}/{spec.unitName}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 4. Carton Packaging Ratio (Tablet & Desktop) */}
                          <td className="py-2.5 px-3 hidden md:table-cell">
                            {spec ? (
                              <span className="px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 font-extrabold text-xs border border-teal-200">
                                {spec.packageQty} {spec.baseUnitName}/{spec.unitName}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>

                          {/* 5. Stock Indicator */}
                          <td className="py-2.5 px-2 text-center">
                            {isLowStock ? (
                              <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                                ໝົດ (0)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-black text-xs">
                                {rawStock}
                              </span>
                            )}
                          </td>

                          {/* 6. Wholesale Carton Price & Pack Price */}
                          <td className="py-2.5 px-3 text-right">
                            {spec ? (
                              <div>
                                <span className="font-mono font-black text-xs sm:text-sm text-teal-800">
                                  {formatKip(spec.priceLak)}
                                </span>
                                {spec.piecePrice > 0 && (
                                  <div className="text-[10px] text-slate-400 font-mono font-semibold">
                                    {formatKip(spec.piecePrice)}/{spec.baseUnitName}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="font-mono font-black text-xs sm:text-sm text-slate-800">
                                {formatKip(p.retailPrice)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. LIST TABLE MODE (DEFAULT)
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden font-sans">
      {/* 1. Header Toolbar: Standardized responsive header matching Products & History */}
      <div className="bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3.5 shrink-0 shadow-2xs z-10">
        <div className="flex items-center justify-between gap-2.5 sm:gap-3">
          {/* Title & Stats */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 shrink-0 border border-amber-200/60">
              <Intersect size={20} className="sm:w-5 sm:h-5" weight="duotone" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="truncate">
                  <span className="sm:hidden">ສິນຄ້າລວມ Mix</span>
                  <span className="hidden sm:inline">ສິນຄ້າລວມ (Mix & Bundles)</span>
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                  {bundles.length}
                </span>
              </h2>
              <p className="text-[11.5px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
                ສິນຄ້າຂາຍຍົກລັງແບບລວມລົດຊາດ (Mix Flavors) ໃຫ້ລູກຄ້າເລືອກຄົບຈຳນວນແລ້ວຕັດສະຕັອກຕາມລົດຊາດຕົວຈິງ
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenCreateForm}
              className="px-3 sm:px-3.5 py-2 sm:py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Plus size={16} weight="bold" />
              <span className="hidden sm:inline">+ ສ້າງສິນຄ້າ Mix ໃໝ່</span>
              <span className="sm:hidden">ສ້າງ Mix</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Table Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 min-h-0 pb-6">
        {/* Top KPI Metrics for Mix Products */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 shrink-0">
          {/* Card 1: Total Bundles */}
          <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black shrink-0">
              <Intersect size={20} weight="duotone" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] text-amber-700 font-bold uppercase tracking-wider truncate">ກຸ່ມລວມທັງໝົດ</div>
              <div className="text-base sm:text-lg font-black text-slate-900 font-mono truncate">{mixKPI.totalBundles}</div>
            </div>
          </div>

          {/* Card 2: Component Products / Flavors */}
          <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-black shrink-0">
              <Package size={20} weight="duotone" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] text-teal-600 font-bold uppercase tracking-wider truncate">ລົດຊາດ/ສິນຄ້າໃນກຸ່ມ</div>
              <div className="text-base sm:text-lg font-black text-teal-900 font-mono truncate">{mixKPI.uniqueProductsCount}</div>
            </div>
          </div>

          {/* Card 3: Top Bundle */}
          <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black shrink-0">
              <Tag size={20} weight="duotone" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] text-indigo-600 font-bold uppercase tracking-wider truncate">ກຸ່ມລົດຊາດຫຼາຍສຸດ</div>
              <div className="text-xs font-black text-slate-900 truncate" title={`${mixKPI.topBundleName} (${mixKPI.topBundleCount} ລົດຊາດ)`}>
                {mixKPI.topBundleName}
              </div>
              {mixKPI.topBundleCount > 0 && (
                <div className="text-[10px] sm:text-[10.5px] font-mono font-bold text-indigo-700">
                  {mixKPI.topBundleCount} ລົດຊາດ
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Average Flavors per Bundle */}
          <div className="p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black shrink-0">
              <SlidersHorizontal size={20} weight="duotone" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-wider truncate">ສະເລ່ຍລົດຊາດ/ກຸ່ມ</div>
              <div className="text-base sm:text-lg font-black text-slate-900 font-mono truncate">{mixKPI.avgFlavors}</div>
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
              placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ Mix ຫຼື ບາໂຄດ..."
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

        {filteredBundles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Intersect size={48} weight="light" className="opacity-50 text-amber-600" />
            <p className="text-sm font-bold text-slate-700">ບໍ່ພົບສິນຄ້າ Mix</p>
            <p className="text-xs text-slate-400 text-center max-w-sm">
              {searchTerm
                ? 'ບໍ່ມີສິນຄ້າ Mix ທີ່ກົງກັບຄຳຄົ້ນຫາ'
                : 'ຍັງບໍ່ມີສິນຄ້າ Mix, ກົດປຸ່ມດ້ານເທິງເພື່ອສ້າງກຸ່ມສິນຄ້າ Mix ໃໝ່'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Mobile Cards List (< md) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredBundles.map((bundle, idx) => {
                const items = bundle.product_bundle_items || bundle.items || [];
                const itemsCount = bundle.itemIds ? bundle.itemIds.length : items.length;
                const childProductNames = (bundle.itemIds || items.map((it) => it.product_id || it.productId))
                  .map((id) => (products || []).find((p) => p.id === id)?.name)
                  .filter(Boolean);

                return (
                  <div key={bundle.id || idx} className="p-3.5 hover:bg-slate-50/70 transition-colors flex flex-col gap-2.5">
                    {/* Top Row: Name, Barcode & Price */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-slate-900 text-sm leading-snug">
                          {bundle.name}
                        </div>
                        {bundle.name_vi && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {bundle.name_vi}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {bundle.barcode ? (
                            <span className="px-2 py-0.5 bg-slate-100 rounded-md font-mono text-[10.5px] text-slate-700 border border-slate-200/80">
                              {bundle.barcode}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10.5px] bg-slate-100 text-slate-700 border border-slate-200/80">
                            <Package size={12} className="text-slate-500" />
                            <span>{bundle.package_qty || 24} {bundle.base_unit_name || 'ອັນ'} / {bundle.unit_name || 'ແກັດ'}</span>
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-sm text-slate-900">
                          {Number(bundle.price_lak || 0).toLocaleString()} ₭
                        </div>
                        {bundle.price_thb > 0 && (
                          <div className="text-[10.5px] text-slate-400 font-mono">
                            {Number(bundle.price_thb).toFixed(2)} ฿
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle: Flavors in bundle */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Package size={13} weight="bold" className="text-slate-500" />
                          <span>ລົດຊາດໃນກຸ່ມ ({itemsCount} ລົດຊາດ)</span>
                        </span>
                      </div>
                      {childProductNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {childProductNames.map((name, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-700 shadow-2xs"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">ຍັງບໍ່ມີລົດຊາດໃນກຸ່ມ</p>
                      )}
                    </div>

                    {/* Bottom Row: Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenEditForm(bundle)}
                        className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200 shadow-2xs"
                      >
                        <PencilSimple size={14} weight="bold" />
                        <span>ແກ້ໄຂ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playActionClickBeep('mix');
                          setBundleToDelete(bundle);
                        }}
                        className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-rose-200"
                      >
                        <Trash size={14} weight="bold" />
                        <span>ລຶບ</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-3 px-3.5 w-14 text-center">ລ/ດ</th>
                    <th className="py-3 px-4">ຊື່ສິນຄ້າ Mix</th>
                    <th className="py-3 px-4 text-center">ບາໂຄດ</th>
                    <th className="py-3 px-4 text-center">ຂະໜາດບັນຈຸ</th>
                    <th className="py-3 px-4 text-right">ລາຄາຂາຍ</th>
                    <th className="py-3 px-4 text-center">ລົດຊາດໃນກຸ່ມ</th>
                    <th className="py-3 px-4 text-center w-28">ຈັດການ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBundles.map((bundle, idx) => {
                    const items = bundle.product_bundle_items || bundle.items || [];
                    const itemsCount = bundle.itemIds ? bundle.itemIds.length : items.length;

                    // Get child products preview
                    const childProductNames = (bundle.itemIds || items.map((it) => it.product_id || it.productId))
                      .map((id) => (products || []).find((p) => p.id === id)?.name)
                      .filter(Boolean);

                    return (
                      <tr key={bundle.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 min-w-[220px]">
                          <div className="font-extrabold text-slate-900 text-[13px] leading-snug">
                            {bundle.name}
                          </div>
                          {bundle.name_vi && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {bundle.name_vi}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[11.5px] text-slate-600">
                          {bundle.barcode ? (
                            <span className="px-2 py-0.5 bg-slate-100 rounded-md">
                              {bundle.barcode}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {bundle.package_qty || 24} {bundle.base_unit_name || 'ອັນ'} / {bundle.unit_name || 'ແກັດ'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-teal-800">
                          <div>{Number(bundle.price_lak || 0).toLocaleString()} ₭</div>
                          {bundle.price_thb > 0 && (
                            <div className="text-[10.5px] text-slate-400 font-normal">
                              {Number(bundle.price_thb).toFixed(2)} ฿
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-full font-bold text-xs" title={childProductNames.join(', ')}>
                            <Package size={13} weight="bold" />
                            <span>{itemsCount} ລົດຊາດ</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditForm(bundle)}
                              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 flex items-center justify-center transition-colors cursor-pointer"
                              title="ແກ້ໄຂສິນຄ້າ Mix"
                            >
                              <PencilSimple size={16} weight="bold" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                playActionClickBeep('mix');
                                setBundleToDelete(bundle);
                              }}
                              className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                              title="ລຶບສິນຄ້າ Mix"
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

      {/* Delete Confirmation Modal */}
      {bundleToDelete && (
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
                <h4 className="font-extrabold text-sm text-slate-900">ຢືນຢັນການລຶບສິນຄ້າ Mix</h4>
                <p className="text-xs text-slate-500">ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບ?</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
              ສິນຄ້າທີ່ຈະລຶບ: <span className="font-bold text-rose-600">"{bundleToDelete.name}"</span>
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBundleToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                onClick={confirmDeleteBundle}
                disabled={isSubmitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting ? 'ກຳລັງລຶບ...' : 'ຢືນຢັນລຶບ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
