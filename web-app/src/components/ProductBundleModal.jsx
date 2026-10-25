import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Plus,
  Trash,
  Check,
  WarningCircle,
  Package,
  MagnifyingGlass,
  CheckCircle,
  SlidersHorizontal,
  ArrowRight,
  Barcode,
  Info,
  Tag,
  Funnel,
  CheckSquare,
  Square,
} from '@phosphor-icons/react';
import { formatKip, formatBaht, normalizeLao } from '../utils/formatters';
import { playActionClickBeep, playSuccessBeep, playErrorBeep } from '../utils/audioFeedback';

/**
 * Helper to safely extract carton specification & wholesale price from a product record
 */
function getProductCartonSpec(p, exchangeRate = 0) {
  if (!p) return null;

  const units = Array.isArray(p.units) ? p.units : [];

  // Find carton-tier unit (tier 3, or _carton ID, or bulk unit names, or highest multiplier)
  const cartonUnit =
    units.find(
      (u) =>
        u.tier === 3 ||
        u.id?.endsWith('_carton') ||
        ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງໃຫຍ່', 'ຖັງ'].includes(u.unitName)
    ) ||
    [...units].sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1))[0];

  // Find piece-tier unit / base unit (isBaseUnit, tier 1, multiplier === 1, or base names)
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

  // Price determination: Cấp 1 (Carton / To nhất) lấy giá bán lẻ tiêu chuẩn (retailPrice / Giá 1)
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

export default function ProductBundleModal({
  isOpen,
  onClose,
  products = [],
  bundles = [],
  exchangeRate = 0,
  onSaveBundle,
  onDeleteBundle,
}) {
  const [selectedBundleId, setSelectedBundleId] = useState(null); // 'new' | bundle.id | null
  const [name, setName] = useState('');
  const [nameVi, setNameVi] = useState('');
  const [barcode, setBarcode] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  
  const [flavorSearchTerm, setFlavorSearchTerm] = useState('');
  const [flavorCategoryFilter, setFlavorCategoryFilter] = useState('ALL');
  const [flavorStatusFilter, setFlavorStatusFilter] = useState('ALL'); // 'ALL' | 'SELECTED' | 'UNSELECTED'

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type, message }
  const [bundleToDelete, setBundleToDelete] = useState(null);

  // Categories list of available products
  const productCategories = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => {
      if (p.category) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Load bundle into form when selectedBundleId changes
  useEffect(() => {
    if (!isOpen) return;
    if (selectedBundleId === 'new') {
      setName('');
      setNameVi('');
      setBarcode('');
      setSelectedProductIds([]);
    } else if (selectedBundleId) {
      const b = bundles.find((x) => x.id === selectedBundleId);
      if (b) {
        setName(b.name || '');
        setNameVi(b.name_vi || '');
        setBarcode(b.barcode || '');
        setSelectedProductIds(b.itemIds || (b.product_bundle_items || []).map((it) => it.product_id) || []);
      }
    } else if (bundles.length > 0) {
      setSelectedBundleId(bundles[0].id);
    } else {
      setSelectedBundleId('new');
    }
  }, [selectedBundleId, isOpen, bundles]);

  // Active currently selected bundle object (if editing)
  const activeExistingBundle = useMemo(() => {
    if (!selectedBundleId || selectedBundleId === 'new') return null;
    return bundles.find((x) => x.id === selectedBundleId) || null;
  }, [selectedBundleId, bundles]);

  // Derive inherited specification from the first selected product
  const inheritedSpec = useMemo(() => {
    if (selectedProductIds.length === 0) return null;
    const firstProd = (products || []).find((p) => p.id === selectedProductIds[0]);
    if (!firstProd) return null;
    return getProductCartonSpec(firstProd, exchangeRate);
  }, [selectedProductIds, products, exchangeRate]);

  // Final active spec (inherited from products or fallback to existing bundle metadata)
  const activePackageQty = inheritedSpec?.packageQty || activeExistingBundle?.package_qty || 24;
  const activeUnitName = inheritedSpec?.unitName || activeExistingBundle?.unit_name || 'ແກັດ';
  const activeBaseUnitName = inheritedSpec?.baseUnitName || activeExistingBundle?.base_unit_name || 'ອັນ';
  const activePriceLak = inheritedSpec?.priceLak !== undefined ? inheritedSpec.priceLak : (Number(activeExistingBundle?.price_lak) || 0);
  const activePriceThb = inheritedSpec?.priceThb !== undefined ? inheritedSpec.priceThb : (Number(activeExistingBundle?.price_thb) || 0);

  // Filter products for flavor selection
  const filteredProducts = useMemo(() => {
    return (products || []).filter((p) => {
      // 1. Status Filter
      const isSelected = selectedProductIds.includes(p.id);
      if (flavorStatusFilter === 'SELECTED' && !isSelected) return false;
      if (flavorStatusFilter === 'UNSELECTED' && isSelected) return false;

      // 2. Category Filter
      if (flavorCategoryFilter !== 'ALL' && p.category !== flavorCategoryFilter) return false;

      // 3. Search Filter
      if (!flavorSearchTerm.trim()) return true;
      const q = normalizeLao(flavorSearchTerm.trim());
      const nameMatch = normalizeLao(p.name || '').includes(q);
      const viMatch = normalizeLao(p.name_vi || p.nameVi || '').includes(q);
      const barcodeMatch = (p.barcode || '').toLowerCase().includes(q.toLowerCase());
      const unitsBarcodeMatch = (p.units || []).some((u) => (u.barcode || '').toLowerCase().includes(q.toLowerCase()));
      return nameMatch || viMatch || barcodeMatch || unitsBarcodeMatch;
    });
  }, [products, flavorStatusFilter, flavorCategoryFilter, flavorSearchTerm, selectedProductIds]);

  if (!isOpen) return null;

  const showToast = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const toggleSelectProduct = (prod) => {
    playActionClickBeep();
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
        playErrorBeep();
        return;
      }

      // 1. Validate packageQty (Số lượng pack trong 1 thùng phải khớp hoàn toàn)
      if (candidateSpec.packageQty !== inheritedSpec.packageQty) {
        showToast(
          'error',
          `ສິນຄ້າ "${prod.name}" ມີຂະໜາດ ${candidateSpec.packageQty} ${candidateSpec.baseUnitName}/${candidateSpec.unitName}, ບໍ່ກົງກັບກຸ່ມ (${inheritedSpec.packageQty} ${inheritedSpec.baseUnitName}/${inheritedSpec.unitName})!`
        );
        playErrorBeep();
        return;
      }

      // 2. Validate carton price (Giá 1 thùng phải bằng nhau)
      if (candidateSpec.priceLak !== inheritedSpec.priceLak) {
        showToast(
          'error',
          `ສິນຄ້າ "${prod.name}" ລາຄາຍົກລັງແມ່ນ ${formatDots(candidateSpec.priceLak)} ₭, ບໍ່ກົງກັບກຸ່ມ (${formatDots(inheritedSpec.priceLak)} ₭)! ທຸກລົດຊາດໃນກຸ່ມຕ້ອງມີລາຄາຍົກລັງເທົ່າກັນ.`
        );
        playErrorBeep();
        return;
      }

      // 3. Validate piece/pack unit price (Giá bán từng pack/lẻ phải bằng nhau)
      if (candidateSpec.piecePrice !== inheritedSpec.piecePrice) {
        showToast(
          'error',
          `ສິນຄ້າ "${prod.name}" ລາຄາ ${candidateSpec.baseUnitName} ແມ່ນ ${formatDots(candidateSpec.piecePrice)} ₭, ບໍ່ກົງກັບກຸ່ມ (${formatDots(inheritedSpec.piecePrice)} ₭)! ທຸກລົດຊາດໃນກຸ່ມຕ້ອງມີລາຄາຕໍ່ ${candidateSpec.baseUnitName} ເທົ່າກັນ.`
        );
        playErrorBeep();
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

  const handleSelectAllVisible = () => {
    playActionClickBeep();
    const unselected = filteredProducts.filter((p) => !selectedProductIds.includes(p.id));
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
      showToast('error', `ມີ ${invalidNames.length} ສິນຄ້າຂະໜາດ ຫຼື ລາຄາບໍ່ກົງກັນ, ເລືອກສະເພາະສິນຄ້າທີ່ກົງກັນ (${validIds.length} ລາຍການ)`);
    } else {
      showToast('success', `ເລືອກເພີ່ມ ${validIds.length} ລາຍການສຳເລັດ!`);
    }

    setSelectedProductIds((prev) => [...prev, ...validIds]);
  };

  const handleClearAllSelected = () => {
    playActionClickBeep();
    setSelectedProductIds([]);
    showToast('info', 'ຍົກເລີກການເລືອກທັງໝົດແລ້ວ');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('error', 'ກະລຸນາປ້ອນຊື່ກຸ່ມສິນຄ້າລວມ!');
      playErrorBeep();
      return;
    }
    if (selectedProductIds.length === 0) {
      showToast('error', 'ກະລຸນາເລືອກຢ່າງໜ້ອຍ 1 ລົດຊາດ/ສີ ສິນຄ້າເພື່ອປະກອບເຂົ້າກຸ່ມ!');
      playErrorBeep();
      return;
    }

    setIsSubmitting(true);
    try {
      const bundleData = {
        id: selectedBundleId === 'new' ? undefined : selectedBundleId,
        name: name.trim(),
        name_vi: nameVi.trim(),
        package_qty: Number(activePackageQty),
        unit_name: activeUnitName.trim() || 'ແກັດ',
        base_unit_name: activeBaseUnitName.trim() || 'ອັນ',
        price_lak: Number(activePriceLak),
        price_thb: Number(activePriceThb),
        barcode: barcode.trim() || null,
        is_active: true,
      };

      const res = await onSaveBundle?.(bundleData, selectedProductIds);
      if (res?.success !== false) {
        showToast('success', 'ບັນທຶກກຸ່ມສິນຄ້າລວມສຳເລັດແລ້ວ!');
        playSuccessBeep();
        if (selectedBundleId === 'new' && res?.data?.id) {
          setSelectedBundleId(res.data.id);
        }
      } else {
        showToast('error', res?.error || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ');
        playErrorBeep();
      }
    } catch (err) {
      showToast('error', err.message || 'ເກີດຂໍ້ຜິດພາດ');
      playErrorBeep();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!bundleToDelete) return;
    setIsSubmitting(true);
    try {
      const res = await onDeleteBundle?.(bundleToDelete.id);
      if (res?.success !== false) {
        showToast('success', `ລຶບກຸ່ມ "${bundleToDelete.name}" ສຳເລັດແລ້ວ!`);
        playSuccessBeep();
        setBundleToDelete(null);
        setSelectedBundleId('new');
      } else {
        showToast('error', res?.error || 'ບໍ່ສາມາດລຶບກຸ່ມສິນຄ້າໄດ້');
        playErrorBeep();
      }
    } catch (err) {
      showToast('error', err.message || 'ເກີດຂໍ້ຜິດພາດ');
      playErrorBeep();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden animate-in fade-in duration-150">
      
      {/* 1. Full-Screen Top Header Bar */}
      <header className="h-14 sm:h-16 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-black border border-teal-200 shadow-2xs">
            <Package size={22} weight="duotone" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                ຈັດການກຸ່ມສິນຄ້າລວມ (Mixed Carton Bundles)
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 flex items-center gap-1">
                <Tag size={11} weight="bold" />
                <span>ຍົກລັງ Mix</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              ສ້າງກຸ່ມສິນຄ້າຂາຍຍົກລັງປົນລົດຊາດ — ລະບົບສືບທອດຂະໜາດ ແລະ ລາຄາຈາກສິນຄ້າ con ອັດຕະໂນມັດ 100%
            </p>
          </div>
        </div>

        {/* Feedback Alert Toast (inline inside header bar) */}
        {feedback && (
          <div
            className={`px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold border transition-all ${
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
        )}

        <button
          type="button"
          onClick={onClose}
          className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title="ປິດໜ້າຈໍ"
        >
          <X size={22} weight="bold" />
        </button>
      </header>

      {/* 2. Main Full-Screen Body Container: Sidebar + Full Workspace */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden bg-slate-100">
        
        {/* Left Column: Bundles Sidebar */}
        <aside className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-0 shadow-2xs">
          <div className="p-3 sm:p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Package size={15} weight="bold" className="text-teal-600" />
              <span>ລາຍການກຸ່ມ ({bundles.length})</span>
            </span>
            <button
              type="button"
              onClick={() => {
                playActionClickBeep();
                setSelectedBundleId('new');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                selectedBundleId === 'new'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-white hover:bg-teal-50 text-teal-700 border border-teal-200'
              }`}
            >
              <Plus size={14} weight="bold" />
              <span>ສ້າງກຸ່ມໃໝ່</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {bundles.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Package size={36} weight="duotone" className="mx-auto mb-2 text-slate-300" />
                ຍັງບໍ່ມີກຸ່ມສິນຄ້າລວມ<br />ກະລຸນາກົດ <b>ສ້າງກຸ່ມໃໝ່</b>
              </div>
            ) : (
              bundles.map((b) => {
                const isSelected = selectedBundleId === b.id;
                const compCount = (b.itemIds || b.product_bundle_items || []).length;
                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      playActionClickBeep();
                      setSelectedBundleId(b.id);
                    }}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-teal-50/60 border-teal-500 shadow-sm ring-1 ring-teal-500/40'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="font-extrabold text-xs sm:text-sm text-slate-900 leading-tight">
                        {b.name}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBundleToDelete(b);
                        }}
                        className="text-slate-300 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                        title="ລຶບກຸ່ມນີ້"
                      >
                        <Trash size={15} />
                      </button>
                    </div>

                    {b.name_vi && (
                      <div className="text-xs text-slate-500 mt-1 truncate">
                        {b.name_vi}
                      </div>
                    )}

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="font-extrabold text-teal-700 font-mono text-sm">
                        {formatKip(b.price_lak)} ₭
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-xs">
                        {b.package_qty} {b.base_unit_name || 'ອັນ'}/{b.unit_name || 'ແກັດ'}
                      </span>
                    </div>

                    <div className="mt-1 text-[11px] text-slate-400">
                      {compCount} ລົດຊາດ/ສີ ພ້ອມຂາຍ
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Column: Full Workspace Form & Maximum Height Table */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 bg-slate-100 overflow-hidden">
          
          {/* Top Form Configuration Strip */}
          <div className="bg-white p-3.5 sm:p-4 border-b border-slate-200 shrink-0 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal size={15} className="text-teal-600" />
                <span>{selectedBundleId === 'new' ? 'ສ້າງກຸ່ມສິນຄ້າລວມໃໝ່' : 'ແກ້ໄຂຂໍ້ມູນກຸ່ມ'}</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {selectedBundleId === 'new' ? 'ID: ຈະສ້າງອັດຕະໂນມັດ' : `ID: ${selectedBundleId}`}
              </span>
            </div>

            {/* Inputs: Lao Name, Vietnamese Name, Barcode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              <div>
                <label className="block text-[11px] sm:text-xs font-extrabold text-slate-700 mb-0.5 sm:mb-1">
                  ຊື່ກຸ່ມສິນຄ້າລວມ (ພາສາລາວ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ຕົວຢ່າງ: ນົມກ່ອງ ລວມລົດຊາດ (24 ກ່ອງ)"
                  className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-extrabold text-slate-700 mb-0.5 sm:mb-1">
                  ຊື່ພາສາຫວຽດ (Tên tiếng Việt)
                </label>
                <input
                  type="text"
                  value={nameVi}
                  onChange={(e) => setNameVi(e.target.value)}
                  placeholder="Ví dụ: Thùng sữa tươi mix vị 24 hộp"
                  className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-teal-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-extrabold text-slate-700 mb-0.5 sm:mb-1 flex items-center gap-1.5">
                  <Barcode size={14} className="text-teal-600" />
                  <span>ບາຣ໌ໂຄດລັງ (Barcode vỏ thùng)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="ຍິງບາຣ໌ໂຄດທີ່ຕິດຢູ່ນອກລັງ..."
                    className="w-full pl-8 sm:pl-9 pr-2.5 sm:pr-3 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-teal-500 transition-all"
                  />
                  <Barcode size={16} className="absolute left-2.5 top-2 sm:top-2.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Auto-Inherited Specification Badge (only shown once products are picked) */}
            {selectedProductIds.length > 0 && (
              <div className="p-2 sm:p-2.5 bg-teal-50/70 rounded-xl border border-teal-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle size={15} weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] sm:text-[10.5px] font-black text-teal-900 uppercase tracking-wide flex items-center gap-1.5 flex-wrap">
                      <span>ຂໍ້ມູນສືບທອດອັດຕະໂນມັດຈາກ:</span>
                      <span className="font-extrabold text-teal-800 bg-white px-1.5 py-0.5 rounded border border-teal-200 truncate max-w-[200px] sm:max-w-xs">
                        {inheritedSpec?.productName || 'ສິນຄ້າຕົວຢ່າງ'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 text-xs text-slate-800">
                      <span className="font-bold">
                        ຂະໜາດ: <b className="text-teal-900 font-mono font-black">{activePackageQty}</b> {activeBaseUnitName}/{activeUnitName}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="font-bold">
                        ລາຄາຍົກລັງ: <b className="text-teal-800 font-mono font-black">{formatKip(activePriceLak)}</b>
                        {activePriceThb > 0 && (
                          <span className="text-slate-500 text-[11px] ml-1 font-mono">
                            ({formatBaht(activePriceThb)})
                          </span>
                        )}
                      </span>
                      {inheritedSpec?.piecePrice > 0 && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="font-bold text-slate-600">
                            ລາຄາ/{activeBaseUnitName}: <b className="text-slate-800 font-mono">{formatKip(inheritedSpec.piecePrice)}</b>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-extrabold text-teal-800 bg-white px-2 py-0.5 rounded-lg border border-teal-200 shrink-0 self-start sm:self-auto">
                  <ArrowRight size={11} weight="bold" />
                  <span>ຫັກສະຕັອກ 1:{activePackageQty}</span>
                </div>
              </div>
            )}
          </div>

          {/* Product Items Picker: Full Workspace Table Container */}
          <div className="flex-1 flex flex-col min-h-0 p-3 sm:p-4 overflow-hidden">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs flex-1 flex flex-col min-h-0 overflow-hidden">
              
              {/* Product Picker Filter & Action Toolbar */}
              <div className="p-3 sm:p-3.5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 bg-slate-50/70">
                
                {/* Status Tabs: All | Selected | Unselected */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
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

                  <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

                  {/* Bulk Select / Deselect actions */}
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 cursor-pointer whitespace-nowrap"
                    title="ເລືອກທຸກສິນຄ້າທີ່ກຳລັງສະແດງ"
                  >
                    ເລືອກທັງໝົດ
                  </button>

                  {selectedProductIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllSelected}
                      className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold border border-rose-200 cursor-pointer whitespace-nowrap"
                      title="ຍົກເລີກການເລືອກທຸກລາຍການ"
                    >
                      ລ້າງການເລືອກ
                    </button>
                  )}
                </div>

                {/* Filter & Search Inputs */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select
                      value={flavorCategoryFilter}
                      onChange={(e) => setFlavorCategoryFilter(e.target.value)}
                      className="pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-teal-500"
                    >
                      <option value="ALL">ທຸກໝວດໝູ່</option>
                      {productCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <Funnel size={13} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                  </div>

                  <div className="relative">
                    <MagnifyingGlass size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={flavorSearchTerm}
                      onChange={(e) => setFlavorSearchTerm(e.target.value)}
                      placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ / Barcode..."
                      className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500 w-44 sm:w-60"
                    />
                  </div>
                </div>
              </div>

              {/* Data Table: Highly Readable, Well-Spaced Rows with Sticky Header - Optimized for iPhone & iPad */}
              <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
                {filteredProducts.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 text-xs">
                    <Package size={44} weight="duotone" className="mx-auto mb-2 text-slate-300" />
                    ບໍ່ພົບສິນຄ້າທີ່ກົງກັບເງື່ອນໄຂຄົ້ນຫາ
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-[10.5px] sm:text-[11px] font-black text-slate-600 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 select-none">
                      <tr>
                        <th className="py-2 px-2 sm:px-3 w-10 sm:w-12 text-center">ເລືອກ</th>
                        <th className="py-2 px-1 sm:px-2 w-11 sm:w-14">ຮູບ</th>
                        <th className="py-2 px-2 sm:px-3">ຊື່ສິນຄ້າ / ລົດຊາດ</th>
                        <th className="py-2 px-2 sm:px-3 w-28 sm:w-32 hidden md:table-cell">ຂະໜາດລັງ</th>
                        <th className="py-2 px-1 sm:px-2 w-16 sm:w-20 text-center">ສະຕັອກ</th>
                        <th className="py-2 px-2 sm:px-3 w-28 sm:w-36 text-right">ລາຄາຂາຍຍົກລັງ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredProducts.map((p) => {
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
                            {/* Checkbox column */}
                            <td className="py-2.5 px-2 sm:px-3 text-center">
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

                            {/* Image Thumbnail */}
                            <td className="py-2.5 px-1 sm:px-2">
                              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-400 overflow-hidden shrink-0">
                                {p.imageUrl || p.image_url ? (
                                  <img src={p.imageUrl || p.image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Package size={20} weight="duotone" />
                                )}
                              </div>
                            </td>

                            {/* Product Name & Subtext */}
                            <td className="py-2.5 px-2 sm:px-3">
                              <div className={`text-xs sm:text-sm leading-snug ${isChecked ? 'font-black text-teal-950' : 'font-bold text-slate-900'}`}>
                                {p.name}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-500">
                                {p.name_vi && (
                                  <span>{p.name_vi}</span>
                                )}
                                {p.barcode && (
                                  <span className="font-mono text-[10.5px] text-slate-400 flex items-center gap-0.5">
                                    <Barcode size={12} />
                                    <span>{p.barcode}</span>
                                  </span>
                                )}
                                {/* Mobile-only Packaging badge when md:table-cell is hidden */}
                                {spec && (
                                  <span className="inline-flex md:hidden px-1.5 py-0.2 rounded text-[9.5px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200">
                                    {spec.packageQty} {spec.baseUnitName}/{spec.unitName}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Carton Packaging Ratio (Tablet & Desktop) */}
                            <td className="py-2.5 px-2 sm:px-3 hidden md:table-cell">
                              {spec ? (
                                <span className="px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 font-extrabold text-xs border border-teal-200">
                                  {spec.packageQty} {spec.baseUnitName}/{spec.unitName}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </td>

                            {/* Stock Indicator */}
                            <td className="py-2.5 px-1 sm:px-2 text-center">
                              {isLowStock ? (
                                <span className="px-1.5 sm:px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                                  ໝົດ (0)
                                </span>
                              ) : (
                                <span className="px-1.5 sm:px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-black text-[11px] sm:text-xs">
                                  {rawStock}
                                </span>
                              )}
                            </td>

                            {/* Wholesale Price */}
                            <td className="py-2.5 px-2 sm:px-3 text-right">
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

          {/* 3. Bottom Footer Bar */}
          <footer className="h-12 sm:h-14 px-3 sm:px-6 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 shadow-xs z-20">
            <div className="text-[11px] sm:text-xs text-slate-600 flex items-center gap-1.5 min-w-0 pr-2">
              {selectedProductIds.length > 0 ? (
                <>
                  <CheckCircle size={15} weight="fill" className="text-teal-600 shrink-0" />
                  <span className="truncate">
                    ພ້ອມຂາຍ: <b>{activePackageQty} {activeBaseUnitName}</b>/<b>{activeUnitName}</b> = <b className="text-teal-700 font-mono">{formatKip(activePriceLak)}</b> ({selectedProductIds.length} ລົດຊາດ)
                  </span>
                </>
              ) : (
                <>
                  <WarningCircle size={15} weight="bold" className="text-amber-500 shrink-0" />
                  <span className="text-amber-700 font-bold truncate">
                    ກະລຸນາເລືອກລົດຊາດເພື່ອເປີດໃຊ້ກຸ່ມ
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <X size={14} weight="bold" />
                <span className="hidden xs:inline">ຍົກເລີກ</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting || selectedProductIds.length === 0}
                className="px-4 sm:px-6 py-1.5 sm:py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check size={15} weight="bold" />
                <span>{isSubmitting ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກກຸ່ມ'}</span>
              </button>
            </div>
          </footer>
        </form>
      </div>

      {/* Delete Confirmation Modal Dialog */}
      {bundleToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-5 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash size={24} weight="bold" />
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">
              ຢືນຢັນລຶບກຸ່ມສິນຄ້າລວມ?
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບກຸ່ມ "<b>{bundleToDelete.name}</b>"?
              <br />(ສິນຄ້າແຕ່ລະລົດຊາດໃນລະບົບຈະບໍ່ຖືກລຶບ).
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setBundleToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-xs cursor-pointer"
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
