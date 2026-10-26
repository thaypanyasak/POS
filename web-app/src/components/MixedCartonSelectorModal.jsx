import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Package,
  Plus,
  Minus,
  Lightning,
  ArrowCounterClockwise,
  CheckCircle,
  WarningCircle,
  Sparkle,
  ShoppingCart,
  Check,
  Tag,
  Trash,
  PencilSimple,
} from '@phosphor-icons/react';
import { formatKip, formatBaht, formatDots } from '../utils/formatters';
import { playActionClickBeep, playSuccessBeep, playUnitChangeBeep, playRemoveFromCartBeep } from '../utils/audioFeedback';
import BundleCollage from './common/BundleCollage';

export default function MixedCartonSelectorModal({
  isOpen,
  onClose,
  bundle,
  products = [],
  exchangeRate = 0,
  onAddToCart,
  editingCartItem = null,
  onUpdateCartItem = null,
  onRemoveFromCart = null,
}) {
  // Map of { productId: quantity }
  const [flavorQuantities, setFlavorQuantities] = useState({});
  const [activeFlavorId, setActiveFlavorId] = useState(null);

  // Filter child flavor products
  const childProducts = useMemo(() => {
    if (!bundle) return [];
    const itemIds = bundle.itemIds || (bundle.product_bundle_items || []).map((it) => it.product_id) || [];
    return (products || []).filter((p) => itemIds.includes(p.id));
  }, [bundle, products]);

  // Reset or initialize when modal opens or bundle changes
  useEffect(() => {
    if (!isOpen) return;
    const initial = {};
    childProducts.forEach((p) => {
      initial[p.id] = 0;
    });

    // If editing existing item from cart, populate with existing quantities
    if (editingCartItem && Array.isArray(editingCartItem.bundleComponents)) {
      editingCartItem.bundleComponents.forEach((c) => {
        const pId = c.productId || c.product_id;
        if (pId) {
          initial[pId] = Number(c.quantity) || 0;
        }
      });
    }

    setFlavorQuantities(initial);
    if (childProducts.length > 0) {
      const activeChild = childProducts.find((p) => (initial[p.id] || 0) > 0) || childProducts[0];
      setActiveFlavorId(activeChild.id);
    }
  }, [isOpen, bundle, childProducts, editingCartItem]);

  // Derive Level 1 carton specification directly from child products (ensures always up-to-date with Level 1 retailPrice)
  const resolvedCartonPrice = useMemo(() => {
    if (childProducts && childProducts.length > 0) {
      for (const p of childProducts) {
        const units = Array.isArray(p.units) ? p.units : [];
        const cartonUnit =
          units.find(
            (u) =>
              u.tier === 3 ||
              u.id?.endsWith('_carton') ||
              ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງໃຫຍ່', 'ຖັງ'].includes(u.unitName)
          ) || [...units].sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1))[0];
        
        const price = Number(cartonUnit?.retailPrice ?? cartonUnit?.price_1 ?? cartonUnit?.price1 ?? p.cartonPrice ?? 0);
        if (price > 0) return price;
      }
    }
    return Number(bundle?.price_lak) || 0;
  }, [childProducts, bundle]);

  if (!isOpen || !bundle) return null;

  const packageQty = Number(bundle.package_qty) || 24;
  const cartonPrice = resolvedCartonPrice;
  const unitName = bundle.unit_name || 'ແກັດ';
  const baseUnitName = bundle.base_unit_name || 'ອັນ';

  // Total quantity picked across all flavors
  const totalPicked = Object.values(flavorQuantities).reduce((sum, q) => sum + (Number(q) || 0), 0);
  const cartonCount = Math.floor(totalPicked / packageQty);
  const looseCount = totalPicked % packageQty;
  const remainingToCarton = looseCount === 0 ? 0 : packageQty - looseCount;

  // Calculate pricing:
  // Carton portion gets the wholesale carton price
  const cartonTotalLak = cartonCount * cartonPrice;

  // Loose portion: each loose unit gets its standard retail piece price
  let looseTotalLak = 0;
  // If there are loose units, price the first looseCount units picked at their base retail price
  if (looseCount > 0) {
    let accountedLoose = 0;
    for (const p of childProducts) {
      const q = flavorQuantities[p.id] || 0;
      if (q > 0) {
        // Find piece/base unit retail price
        const pieceUnit =
          (p.units || []).find((u) => u.isBaseUnit || Number(u.multiplier) === 1 || u.tier === 1) ||
          (p.units || [])[0];
        const piecePrice = Number(pieceUnit?.retailPrice ?? p.retailPrice ?? 0);
        
        const loosePortion = Math.min(q, looseCount - accountedLoose);
        looseTotalLak += loosePortion * piecePrice;
        accountedLoose += loosePortion;
        if (accountedLoose >= looseCount) break;
      }
    }
  }

  const grandTotalLak = cartonTotalLak + looseTotalLak;
  const grandTotalThb = exchangeRate > 0 ? Number((grandTotalLak / exchangeRate).toFixed(2)) : 0;

  // Progress percentage (capped at 100% per current carton milestone)
  const currentProgressPercent = totalPicked === 0
    ? 0
    : looseCount === 0
    ? 100
    : Math.min(100, Math.round((looseCount / packageQty) * 100));

  // Update a single flavor quantity
  const handleSetQty = (prodId, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setFlavorQuantities((prev) => ({
      ...prev,
      [prodId]: num,
    }));
    setActiveFlavorId(prodId);
  };

  const handleDelta = (prodId, delta) => {
    playActionClickBeep();
    setFlavorQuantities((prev) => {
      const curr = prev[prodId] || 0;
      const next = Math.max(0, curr + delta);
      return {
        ...prev,
        [prodId]: next,
      };
    });
    setActiveFlavorId(prodId);
  };

  // Quick Action 1: Chia đều (Even Distribution)
  const handleDistributeEvenly = () => {
    if (childProducts.length === 0) return;
    playUnitChangeBeep();
    const count = childProducts.length;
    const basePerItem = Math.floor(packageQty / count);
    const remainder = packageQty % count;

    const next = {};
    childProducts.forEach((p, idx) => {
      next[p.id] = basePerItem + (idx < remainder ? 1 : 0);
    });
    setFlavorQuantities(next);
  };

  // Quick Action 2: Điền nốt (Fill the remaining needed to complete carton)
  const handleFillRemainder = (targetProdId) => {
    const targetId = targetProdId || activeFlavorId || childProducts[0]?.id;
    if (!targetId) return;
    playUnitChangeBeep();
    
    // If exact carton, add another full carton
    const needed = remainingToCarton > 0 ? remainingToCarton : packageQty;
    setFlavorQuantities((prev) => ({
      ...prev,
      [targetId]: (prev[targetId] || 0) + needed,
    }));
  };

  // Quick Action 3: Reset
  const handleReset = () => {
    playActionClickBeep();
    const next = {};
    childProducts.forEach((p) => {
      next[p.id] = 0;
    });
    setFlavorQuantities(next);
  };

  // Confirm Add to Cart
  const handleConfirmAddToCart = () => {
    if (totalPicked === 0) return;
    playSuccessBeep();

    const selectedComponents = childProducts
      .map((p) => {
        const qty = flavorQuantities[p.id] || 0;
        if (qty <= 0) return null;
        const pieceUnit = (p.units || []).find((u) => u.multiplier === 1 || u.tier === 1) || (p.units || [])[0];
        const piecePrice = Number(pieceUnit?.retailPrice ?? p.retailPrice ?? 0);
        return {
          productId: p.id,
          product_id: p.id,
          productName: p.name,
          product_name: p.name,
          name_vi: p.name_vi || p.nameVi || '',
          nameVi: p.name_vi || p.nameVi || '',
          quantity: qty,
          unitPrice: piecePrice,
          unit_price: piecePrice,
          product: p,
        };
      })
      .filter(Boolean);

    const bundleChildImages = childProducts.map((p) => p.imageUrl || p.image_url).filter(Boolean);
    const isEditing = Boolean(editingCartItem);

    const isOnlyLoose = cartonCount === 0 && looseCount > 0;
    const isExactCarton = cartonCount > 0 && looseCount === 0;

    const resolvedUnitName = isOnlyLoose ? baseUnitName : unitName;
    const resolvedQty = isOnlyLoose ? looseCount : (isExactCarton ? cartonCount : 1);
    const resolvedUnitPrice = resolvedQty > 0 ? Math.round(grandTotalLak / resolvedQty) : grandTotalLak;

    const bundleItem = {
      id: isEditing ? editingCartItem.id : `bundle_${bundle.id}_${Date.now()}`,
      isBundle: true,
      bundleId: bundle.id,
      bundleName: bundle.name,
      bundleNameVi: bundle.name_vi,
      packageQty,
      unitName: resolvedUnitName,
      baseUnitName,
      cartonQty: cartonCount,
      looseQty: looseCount,
      cartonPrice,
      loosePriceTotal: looseTotalLak,
      unitPrice: resolvedUnitPrice,
      price: resolvedUnitPrice,
      unit: {
        unitName: resolvedUnitName,
        retailPrice: resolvedUnitPrice,
        wholesalePrice: resolvedUnitPrice,
      },
      lineTotal: grandTotalLak,
      quantity: resolvedQty,
      bundleComponents: selectedComponents,
      bundle_components: selectedComponents,
      bundleChildImages,
      customPrice: null,
      overrideReason: '',
      hasCrateDeposit: false,
      noEmptyCrates: false,
      missingCratesCount: 0,
      crateDepositTotal: 0,
    };

    if (isEditing && onUpdateCartItem) {
      onUpdateCartItem(editingCartItem.id, bundleItem);
    } else {
      onAddToCart?.(bundleItem);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-black border border-teal-100 shadow-2xs overflow-hidden shrink-0">
              {childProducts.some((p) => p.imageUrl || p.image_url) ? (
                <BundleCollage
                  images={childProducts.map((p) => p.imageUrl || p.image_url).filter(Boolean)}
                  className="w-full h-full"
                  fallbackIconSize={20}
                />
              ) : (
                <Package size={22} weight="duotone" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  {bundle.name}
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                  {packageQty} {baseUnitName}/{unitName}
                </span>
                {editingCartItem && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                    <PencilSimple size={11} weight="bold" />
                    <span>ແກ້ໄຂ</span>
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>ລາຄາຂາຍຍົກລັງ: <b className="text-teal-700 font-mono font-extrabold">{formatKip(cartonPrice)}</b></span>
                {exchangeRate > 0 && (
                  <span className="text-slate-400 font-mono">
                    (≈ {formatBaht(cartonPrice / exchangeRate)})
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* Dynamic Progress Bar & Capacity Status */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 font-black text-slate-800">
              <span>ເລືອກແລ້ວທັງໝົດ:</span>
              <span className="text-sm font-mono text-teal-700 font-black">
                {totalPicked} / {packageQty} {baseUnitName}
              </span>
            </div>

            {/* Status Chip */}
            <div className="text-xs font-bold">
              {totalPicked === 0 ? (
                <span className="text-slate-400">ກະລຸນາເລືອກລົດຊາດດ້ານລຸ່ມ</span>
              ) : remainingToCarton === 0 ? (
                <span className="text-emerald-700 flex items-center gap-1 font-extrabold">
                  <CheckCircle size={15} weight="fill" className="text-emerald-600" />
                  ຄົບ {cartonCount} {unitName} ພໍດີ (ໄດ້ລາຄາຍົກລັງ)
                </span>
              ) : cartonCount >= 1 ? (
                <span className="text-sky-700 font-extrabold">
                  {cartonCount} {unitName} + {looseCount} {baseUnitName} ຍ່ອຍ
                </span>
              ) : (
                <span className="text-amber-700 font-extrabold">
                  ຂາດອີກ {remainingToCarton} {baseUnitName} ເພື່ອຄົບ 1 {unitName}
                </span>
              )}
            </div>
          </div>

          {/* Progress bar line */}
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                remainingToCarton === 0 && totalPicked > 0
                  ? 'bg-emerald-500'
                  : cartonCount >= 1
                  ? 'bg-sky-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${currentProgressPercent}%` }}
            />
          </div>

          {/* Quick Action Shortcuts Bar */}
          <div className="flex items-center justify-between gap-2 mt-2.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDistributeEvenly}
                className="px-2.5 py-1 bg-white hover:bg-teal-50 text-teal-700 rounded-lg text-xs font-extrabold border border-teal-200 transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                title="ປັນຈຳນວນເທົ່າກັນໃຫ້ທຸກລົດຊາດ"
              >
                <Lightning size={13} weight="fill" />
                <span>ປັນສະເໝີກັນ</span>
              </button>

              <button
                type="button"
                onClick={() => handleFillRemainder(activeFlavorId)}
                className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 rounded-lg text-xs font-extrabold border border-emerald-200 transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                title="ຕື່ມຈຳນວນທີ່ຍັງຂາດໃສ່ລົດຊາດທີ່ກຳລັງເລືອກ"
              >
                <Check size={13} weight="bold" />
                <span>ຕື່ມສ່ວນທີ່ເຫຼືອ (+{remainingToCarton > 0 ? remainingToCarton : packageQty})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <ArrowCounterClockwise size={13} />
              <span>ຣີເຊັດ</span>
            </button>
          </div>
        </div>

        {/* Flavors Grid List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0 space-y-2">
          {childProducts.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              ກຸ່ມນີ້ຍັງບໍ່ມີລົດຊາດໃດໆ. ກະລຸນາເຂົ້າໄປທີ່ "ຈັດການກຸ່ມລວມ" ເພື່ອເລືອກລົດຊາດ!
            </div>
          ) : (
            childProducts.map((p) => {
              const qty = flavorQuantities[p.id] || 0;
              const isSelected = qty > 0;
              const isActive = activeFlavorId === p.id;
              const rawStock = Number(p.currentStockBaseUnits ?? p.current_stock_base_units ?? 0);
              const isLowStock = p.trackStock !== false && rawStock <= 0;
              const pieceUnit = (p.units || []).find((u) => u.multiplier === 1 || u.tier === 1) || (p.units || [])[0];
              const piecePrice = Number(pieceUnit?.retailPrice ?? p.retailPrice ?? 0);

              return (
                <div
                  key={p.id}
                  onClick={() => setActiveFlavorId(p.id)}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-teal-50/60 border-teal-500 shadow-2xs'
                      : isActive
                      ? 'bg-slate-50 border-slate-300'
                      : 'bg-white border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  {/* Left: Image & Name */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-400 overflow-hidden shrink-0">
                      {p.imageUrl || p.image_url ? (
                        <img src={p.imageUrl || p.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package size={20} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                        {p.name}
                      </div>
                      {p.name_vi && (
                        <div className="text-[11px] text-slate-400 truncate">
                          {p.name_vi}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[10.5px] mt-0.5">
                        <span className="text-slate-500">
                          ລາຄາປີກ: {formatKip(piecePrice)} ₭/{baseUnitName}
                        </span>
                        <span>•</span>
                        <span className={`font-mono font-bold ${isLowStock ? 'text-rose-600' : 'text-slate-600'}`}>
                          ສະຕັອກ: {rawStock}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Stepper controls [- 0 +] */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={qty <= 0}
                      onClick={() => handleDelta(p.id, -1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                    >
                      <Minus size={14} weight="bold" />
                    </button>

                    <input
                      type="number"
                      min="0"
                      value={qty}
                      onChange={(e) => handleSetQty(p.id, e.target.value)}
                      className="w-12 h-8 text-center bg-white border border-slate-200 rounded-lg font-mono font-black text-sm text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    />

                    <button
                      type="button"
                      onClick={() => handleDelta(p.id, 1)}
                      className="w-8 h-8 rounded-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs"
                    >
                      <Plus size={14} weight="bold" />
                    </button>

                    {/* Quick +6 / +12 mini button */}
                    <button
                      type="button"
                      onClick={() => handleDelta(p.id, 6)}
                      className="px-2 h-8 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-black border border-teal-200 transition-all cursor-pointer active:scale-95 hidden sm:flex items-center justify-center"
                      title="ເພີ່ມ +6 ອັນ"
                    >
                      +6
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Live Pricing Preview & Add to Cart */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          
          {/* Price Breakdown */}
          <div className="w-full sm:w-auto text-left">
            <div className="text-[11px] text-slate-500 flex items-center gap-2">
              {cartonCount > 0 && (
                <span>{cartonCount} {unitName} ({formatKip(cartonTotalLak)})</span>
              )}
              {cartonCount > 0 && looseCount > 0 && <span>+</span>}
              {looseCount > 0 && (
                <span>{looseCount} {baseUnitName} ຍ່ອຍ ({formatKip(looseTotalLak)})</span>
              )}
              {totalPicked === 0 && (
                <span>ຍັງບໍ່ໄດ້ເລືອກຈຳນວນ</span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-mono font-black text-teal-800">
                {formatKip(grandTotalLak)}
              </span>
              {exchangeRate > 0 && (
                <span className="text-xs font-mono font-bold text-slate-400">
                  (≈ {formatBaht(grandTotalThb)})
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {editingCartItem && onRemoveFromCart && (
              <button
                type="button"
                onClick={() => {
                  playRemoveFromCartBeep();
                  onRemoveFromCart(editingCartItem.id, null);
                  onClose();
                }}
                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                title="ລຶບລາຍການນີ້ອອກຈາກກະຕ່າ"
              >
                <Trash size={15} />
                <span className="hidden sm:inline">ລຶບອອກ</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer"
            >
              ຍົກເລີກ
            </button>

            <button
              type="button"
              disabled={totalPicked === 0}
              onClick={handleConfirmAddToCart}
              className={`flex-1 sm:flex-initial px-6 py-2.5 text-white rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                editingCartItem
                  ? 'bg-amber-600 hover:bg-amber-700 disabled:opacity-40'
                  : 'bg-teal-600 hover:bg-teal-700 disabled:opacity-40'
              }`}
            >
              {editingCartItem ? (
                <>
                  <Check size={16} weight="bold" />
                  <span>ອັບເດດລາຍການ ({totalPicked} {baseUnitName})</span>
                </>
              ) : (
                <>
                  <ShoppingCart size={16} weight="bold" />
                  <span>+ ເພີ່ມໃສ່ກະຕ່າ ({totalPicked} {baseUnitName})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
