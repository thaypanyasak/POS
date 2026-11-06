import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  PencilLine,
  CheckCircle,
  Percent,
  CurrencyDollar,
  ArrowRight,
  ArrowClockwise,
  SlidersHorizontal,
  Table,
  Package,
  Barcode
} from '@phosphor-icons/react';
import { formatKip, roundLakToStep, getCartonUnitInfo } from '../utils/formatters';
import { getUnitStepMultiplier, getUnitBadgeStyle, getUnitBadgeConfig } from './ProductsView';

export default function BulkPriceModal({
  isOpen,
  onClose,
  selectedProducts = [],
  onApplyBulkPrices,
  initialTab = 'manual',
  exchangeRate = 690,
}) {
  // Tabs: 'manual' (Mode 1: Tự do nhập giá từng sản phẩm) | 'formula' (Mode 2: Công thức +/- % hoặc Kíp)
  const [activeTab, setActiveTab] = useState('manual');

  // Luôn tự động active Tab 1 (manual: Tự nhập từng giá) mỗi khi mở Modal
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'manual');
      setManualEdits({});
      setManualCostEdits({});
    }
  }, [isOpen, initialTab]);

  // ===================== FORMULA STATE (MODE 2) =====================
  // Target: 'retail_price' | 'price_2' | 'price_3' | 'all'
  const [targetTier, setTargetTier] = useState('retail_price');

  // Adjustment type: 'percent_add' | 'percent_sub' | 'amount_add' | 'amount_sub'
  const [adjustType, setAdjustType] = useState('percent_add');

  // Adjustment numeric value (as raw number)
  const [adjustValue, setAdjustValue] = useState(10);
  const [adjustDisplayStr, setAdjustDisplayStr] = useState('10');

  // ===================== MANUAL EDITS STATE (MODE 1) =====================
  // Map of unitId -> { id, productId, product_id, unitName, multiplier, retail_price, price_2, price_3 }
  const [manualEdits, setManualEdits] = useState({});
  // Map of productId -> { productId, currency, cost_lak, cost_thb, cost_per_base_unit }
  const [manualCostEdits, setManualCostEdits] = useState({});

  const [isApplying, setIsApplying] = useState(false);

  // Group units by product and sort units descending by multiplier (Carton -> Pack -> Piece)
  const productsWithSortedUnits = useMemo(() => {
    return (selectedProducts || []).map((p) => {
      const pUnits = p.units && Array.isArray(p.units) && p.units.length > 0
        ? p.units
        : [
            {
              id: `${p.id}_base`,
              productId: p.id,
              product_id: p.id,
              unitName: p.baseUnit || 'ອັນ',
              unit_name: p.baseUnit || 'ອັນ',
              multiplier: 1,
              retailPrice: Number(p.cost_lak) || 0,
              retail_price: Number(p.cost_lak) || 0,
              price_2: 0,
              price_3: 0,
            }
          ];

      // Sort descending by multiplier: carton (e.g. x144) -> pack (x6) -> piece (x1)
      const sortedUnits = [...pUnits]
        .sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1))
        .map((u) => ({
          ...u,
          productId: p.id,
          product_id: p.id,
          productName: p.name,
          unitId: u.id,
          unitName: u.unitName || u.unit_name || 'ອັນ',
          multiplier: Number(u.multiplier) || 1,
          retail_price: Number(u.retailPrice ?? u.retail_price ?? 0),
          price_2: Number(u.price_2 ?? u.price2 ?? u.wholesalePrice ?? 0),
          price_3: Number(u.price_3 ?? u.price3 ?? 0),
        }));

      return {
        product: p,
        sortedUnits,
      };
    });
  }, [selectedProducts]);

  // Flattened list of all units for calculation and submission
  const allSelectedUnits = useMemo(() => {
    return productsWithSortedUnits.flatMap((item) => item.sortedUnits);
  }, [productsWithSortedUnits]);

  // Compute new price according to active formula
  const calculateNewPrice = (origPrice) => {
    const orig = Number(origPrice) || 0;
    const val = Number(adjustValue) || 0;
    let nextPrice = orig;

    switch (adjustType) {
      case 'percent_add':
        nextPrice = orig * (1 + val / 100);
        break;
      case 'percent_sub':
        nextPrice = Math.max(0, orig * (1 - val / 100));
        break;
      case 'amount_add':
        nextPrice = orig + val;
        break;
      case 'amount_sub':
        nextPrice = Math.max(0, orig - val);
        break;
      default:
        nextPrice = orig;
    }

    // Áp dụng quy tắc làm tròn bán lẻ chuẩn bước nhảy 1.000 ₭ (Lấy mốc 500 làm tròn chẵn nghìn)
    return roundLakToStep(nextPrice, 1000);
  };

  // Handle value change for Formula input with dot formatting
  const handleFormulaInputChange = (rawVal) => {
    const cleanDigits = rawVal.replace(/[^\d]/g, '');
    const num = Number(cleanDigits) || 0;
    setAdjustValue(num);

    if (adjustType.startsWith('percent')) {
      setAdjustDisplayStr(cleanDigits);
    } else {
      setAdjustDisplayStr(num > 0 ? num.toLocaleString('de-DE') : '');
    }
  };

  // Switch adjust type and reformat display value
  const handleSelectAdjustType = (type) => {
    setAdjustType(type);
    if (type.startsWith('percent')) {
      const def = adjustValue > 100 ? 10 : (adjustValue || 10);
      setAdjustValue(def);
      setAdjustDisplayStr(def.toString());
    } else {
      const def = adjustValue <= 100 ? 5000 : adjustValue;
      setAdjustValue(def);
      setAdjustDisplayStr(def.toLocaleString('de-DE'));
    }
  };

  // Preset button click in Formula mode
  const handleFormulaPreset = (valNum) => {
    setAdjustValue(valNum);
    if (adjustType.startsWith('percent')) {
      setAdjustDisplayStr(valNum.toString());
    } else {
      setAdjustDisplayStr(valNum.toLocaleString('de-DE'));
    }
  };

  // ===================== MANUAL TAB HANDLERS =====================
  const handleManualUnitChange = (unitItem, field, rawVal) => {
    const cleanDigits = rawVal.replace(/[^\d]/g, '');
    const val = Number(cleanDigits) || 0;
    const unitId = unitItem.unitId;

    setManualEdits((prev) => {
      const existing = prev[unitId] || {
        id: unitId,
        productId: unitItem.productId,
        product_id: unitItem.productId,
        unitName: unitItem.unitName,
        unit_name: unitItem.unitName,
        multiplier: unitItem.multiplier,
        retail_price: unitItem.retail_price,
        price_2: unitItem.price_2,
        price_3: unitItem.price_3,
      };

      const next = {
        ...existing,
        [field]: val,
      };

      const isChanged =
        next.retail_price !== unitItem.retail_price ||
        next.price_2 !== unitItem.price_2 ||
        next.price_3 !== unitItem.price_3;

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

  // Bidirectional cost input handler for Mode 1
  const handleManualCostChange = (product, field, rawVal) => {
    const val = Number(String(rawVal).replace(/[^\d]/g, '')) || 0;
    const prodId = product.id;
    const rate = Number(exchangeRate) || 690;
    const maxMult = Math.max(1, ...(product.units || []).map((u) => Number(u.multiplier) || 1));
    const { cartonCostKip, cartonCostBaht } = getCartonUnitInfo(product, rate);
    const origCostLak = cartonCostKip;
    const origCostThb = cartonCostBaht;

    const isBoughtInKip =
      (product.cost_currency || product.costCurrency) === 'LAK' &&
      Number(origCostLak || 0) > 0 &&
      Number(origCostThb || 0) === 0;

    const isLakCurrency = isBoughtInKip || (product.cost_currency || product.costCurrency) === 'LAK';

    setManualCostEdits((prev) => {
      const existing = prev[prodId];
      let curCostThb = existing?.cost_thb !== undefined ? existing.cost_thb : origCostThb;
      let curCostLak = existing?.cost_lak !== undefined ? existing.cost_lak : origCostLak;

      if (field === 'cost_thb') {
        curCostThb = val;
        // Tự động điền Kíp bằng tỷ giá Baht của hệ thống
        curCostLak = Math.round(val * rate);
      } else if (field === 'cost_lak') {
        // Gõ trực tiếp vào ô Kíp: Giữ nguyên số tiền người dùng nhập
        curCostLak = val;
        if (isBoughtInKip || isLakCurrency) {
          curCostThb = 0;
        }
      }

      const costPerBaseUnit = Math.round(curCostLak / maxMult);
      const isChanged = curCostLak !== origCostLak || (!isLakCurrency && curCostThb !== origCostThb);

      if (!isChanged) {
        const copy = { ...prev };
        delete copy[prodId];
        return copy;
      }

      return {
        ...prev,
        [prodId]: {
          productId: prodId,
          currency: isLakCurrency ? 'LAK' : 'THB',
          cost_lak: curCostLak,
          cost_thb: isLakCurrency ? 0 : curCostThb,
          cost_per_base_unit: costPerBaseUnit,
        },
      };
    });
  };

  const manualDirtyCount = Object.keys(manualEdits).length + Object.keys(manualCostEdits).length;

  // ===================== SUBMISSION =====================
  const handleApply = async () => {
    if (allSelectedUnits.length === 0 && Object.keys(manualCostEdits).length === 0) return;
    setIsApplying(true);

    try {
      const minimalDirtyPayload = [];
      const dirtyCostPayload = Object.values(manualCostEdits);

      if (activeTab === 'manual') {
        // Collect from manual edits (Mode 1)
        Object.values(manualEdits).forEach((item) => {
          minimalDirtyPayload.push({
            id: item.id,
            product_id: item.productId || item.product_id,
            unit_name: item.unitName || item.unit_name,
            multiplier: item.multiplier,
            retail_price: item.retail_price,
            price_2: item.price_2,
            wholesale_price: item.price_2,
            price_3: item.price_3,
          });
        });
      } else {
        // Compute from formula (Mode 2)
        allSelectedUnits.forEach((item) => {
          const delta = {
            id: item.unitId,
            product_id: item.productId,
            unit_name: item.unitName,
            multiplier: item.multiplier,
          };
          let isChanged = false;

          if (targetTier === 'all' || targetTier === 'retail_price') {
            const nextRetail = calculateNewPrice(item.retail_price);
            if (nextRetail !== item.retail_price) {
              delta.retail_price = nextRetail;
              isChanged = true;
            }
          }

          if (targetTier === 'all' || targetTier === 'price_2') {
            const nextPrice2 = calculateNewPrice(item.price_2);
            if (nextPrice2 !== item.price_2) {
              delta.price_2 = nextPrice2;
              delta.wholesale_price = nextPrice2;
              isChanged = true;
            }
          }

          if (targetTier === 'all' || targetTier === 'price_3') {
            const nextPrice3 = calculateNewPrice(item.price_3);
            if (nextPrice3 !== item.price_3) {
              delta.price_3 = nextPrice3;
              isChanged = true;
            }
          }

          if (isChanged) {
            minimalDirtyPayload.push(delta);
          }
        });
      }

      if (minimalDirtyPayload.length > 0 || dirtyCostPayload.length > 0) {
        await onApplyBulkPrices(minimalDirtyPayload, dirtyCostPayload);
      }
      onClose();
    } catch (err) {
      console.error('Failed to apply price update:', err);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none font-sans">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl sm:max-w-5xl w-full p-3.5 sm:p-5 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-2.5 sm:gap-3 border border-slate-200 h-[92vh] max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-light border border-primary-border flex items-center justify-center text-primary shrink-0">
              <PencilLine size={20} weight="bold" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                {selectedProducts.length === 1
                  ? `ແກ້ໄຂລາຄາ: ${selectedProducts[0].name}`
                  : `ແກ້ໄຂລາຄາສິນຄ້າພ້ອມກັນ (Bulk Price Editor)`}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                ກຳລັງເລືອກ: <span className="font-bold text-primary">{selectedProducts.length}</span> ສິນຄ້າ ({allSelectedUnits.length} ຫົວໜ່ວຍຂາຍ)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* 2 Mode Tabs Selector: Tab 1 = Manual Input, Tab 2 = Formula */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl sm:rounded-2xl shrink-0 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-1.5 sm:py-2 px-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[36px] ${
              activeTab === 'manual'
                ? 'bg-white text-primary shadow-xs border border-primary-border/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table size={15} weight="bold" className={activeTab === 'manual' ? 'text-primary' : ''} />
            <span>ໂໝດ 1: ປ້ອນລາຄາລະອຽດແຕ່ລະສິນຄ້າ</span>
            {manualDirtyCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-mono font-bold">
                {manualDirtyCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('formula')}
            className={`flex-1 py-1.5 sm:py-2 px-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[36px] ${
              activeTab === 'formula'
                ? 'bg-white text-primary shadow-xs border border-primary-border/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal size={15} weight="bold" className={activeTab === 'formula' ? 'text-primary' : ''} />
            <span>ໂໝດ 2: ປັບລາຄາຕາມສູດ (+/- % ຫຼື ກີບ)</span>
          </button>
        </div>

        {/* ===================== TAB 1: MANUAL ENTRY MODE (FULL HEIGHT & COMPACT IPAD) ===================== */}
        {activeTab === 'manual' && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 px-1 shrink-0">
              <span>ປ້ອນລາຄາໃໝ່ຕາມໃຈສຳລັບ 3 ລະດັບລາຄາ (ລາຄາ 1, 2, 3):</span>
              {manualDirtyCount > 0 && (
                <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  ແກ້ໄຂແລ້ວ {manualDirtyCount} ຫົວໜ່ວຍ
                </span>
              )}
            </div>

            {productsWithSortedUnits.map(({ product, sortedUnits }) => {
              const productImg = product.imageUrl || product.image_url || product.image;
              const rate = Number(exchangeRate) || 690;
              const { cartonUnitName, cartonCostKip, cartonCostBaht } = getCartonUnitInfo(product, rate);
              const costDirty = manualCostEdits[product.id];
              const curCostThb = costDirty?.cost_thb !== undefined ? costDirty.cost_thb : cartonCostBaht;
              const curCostLak = costDirty?.cost_lak !== undefined ? costDirty.cost_lak : cartonCostKip;

              const isBoughtInKip =
                (product.cost_currency || product.costCurrency) === 'LAK' &&
                Number(curCostLak || 0) > 0 &&
                Number(curCostThb || 0) === 0;

              const isCostThbDirty = costDirty?.cost_thb !== undefined && costDirty.cost_thb !== cartonCostBaht;
              const isCostLakDirty = costDirty?.cost_lak !== undefined && costDirty.cost_lak !== cartonCostKip;
              const isCostDirty = isCostThbDirty || isCostLakDirty;

              return (
                <div
                  key={product.id}
                  className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs transition-all shrink-0"
                >
                  {/* Product Card Header - Compact with Cost Inputs */}
                  <div className="bg-slate-50/90 border-b border-slate-200 px-3 py-1.5 sm:py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-t-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {productImg ? (
                        <img
                          src={productImg}
                          alt={product.name}
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover border border-slate-200/80 shrink-0 bg-white"
                          loading="lazy"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 ${
                          productImg ? 'hidden' : 'flex'
                        }`}
                      >
                        <Package size={20} weight="duotone" />
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm truncate max-w-[240px] sm:max-w-[340px]">
                          {product.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {product.barcode && product.barcode !== product.id && (
                            <span className="font-mono text-[11px] text-slate-400 flex items-center gap-0.5">
                              <Barcode size={12} weight="bold" />
                              {product.barcode}
                            </span>
                          )}
                          {product.category && (
                            <span className="text-[9.5px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/80">
                              {product.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Cost Inputs & Unit Badge */}
                    <div className="shrink-0 flex items-center flex-wrap gap-2 justify-between sm:justify-end">
                      {/* Cost Input Section (ຕົ້ນທຶນ B & K) */}
                      <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200/90 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">ຕົ້ນທຶນ:</span>
                        {!isBoughtInKip && (
                          <div className="relative w-20 sm:w-24">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={curCostThb > 0 ? Number(curCostThb).toLocaleString('de-DE') : ''}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleManualCostChange(product, 'cost_thb', e.target.value)}
                              placeholder="0"
                              className={`w-full h-7 px-2 pr-5 rounded-md border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                isCostThbDirty
                                  ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                              }`}
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                              ฿
                            </span>
                          </div>
                        )}
                        <div className="relative w-24 sm:w-28">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={curCostLak > 0 ? Number(curCostLak).toLocaleString('de-DE') : ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleManualCostChange(product, 'cost_lak', e.target.value)}
                            placeholder="0"
                            className={`w-full h-7 px-2 pr-5 rounded-md border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                              isCostLakDirty
                                ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                            }`}
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                            ₭
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">/{cartonUnitName}</span>
                        {isCostDirty && (
                          <button
                            type="button"
                            onClick={() => {
                              setManualCostEdits((prev) => {
                                const copy = { ...prev };
                                delete copy[product.id];
                                return copy;
                              });
                            }}
                            className="text-[10px] text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer ml-0.5"
                            title="ຄືນຄ່າຕົ້ນທຶນ"
                          >
                            ຄືນຄ່າ
                          </button>
                        )}
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary-light/70 text-primary border border-primary-border/80 shadow-2xs flex items-center gap-1">
                        <span className="font-extrabold">{sortedUnits.length}</span> ຫົວໜ່ວຍ
                      </span>
                    </div>
                  </div>

                  {/* Column Sub-Header for larger screens - Compact */}
                  <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 py-1 bg-slate-100/70 border-b border-slate-100 text-[10.5px] font-bold text-slate-500">
                    <div className="col-span-3">ຫົວໜ່ວຍ (Unit)</div>
                    <div className="col-span-3 text-center">ລາຄາ 1 (ມາດຕະຖານ)</div>
                    <div className="col-span-3 text-center">ລາຄາ 2 (ລູກຄ້າປະຈຳ)</div>
                    <div className="col-span-3 text-center">ລາຄາ 3 (VIP/ຂາຍສົ່ງ)</div>
                  </div>

                  {/* Units Body - Compact */}
                  <div className="divide-y divide-slate-100 bg-white">
                    {sortedUnits.map((uItem) => {
                      const dirty = manualEdits[uItem.unitId];
                      const curRetail = dirty?.retail_price !== undefined ? dirty.retail_price : uItem.retail_price;
                      const curPrice2 = dirty?.price_2 !== undefined ? dirty.price_2 : uItem.price_2;
                      const curPrice3 = dirty?.price_3 !== undefined ? dirty.price_3 : uItem.price_3;

                      const isRetailDirty = dirty?.retail_price !== undefined && dirty.retail_price !== uItem.retail_price;
                      const isPrice2Dirty = dirty?.price_2 !== undefined && dirty.price_2 !== uItem.price_2;
                      const isPrice3Dirty = dirty?.price_3 !== undefined && dirty.price_3 !== uItem.price_3;
                      const isAnyDirty = isRetailDirty || isPrice2Dirty || isPrice3Dirty;

                      return (
                        <div
                          key={uItem.unitId}
                          className="px-3 py-1.5 sm:py-2 transition-colors hover:bg-slate-50/50"
                        >
                          <div className="flex flex-col sm:grid sm:grid-cols-12 gap-1.5 sm:gap-2 items-stretch sm:items-center">
                            {/* Unit Badge and Name */}
                            <div className="sm:col-span-3 flex items-center justify-between sm:justify-start gap-1.5">
                              {(() => {
                                const bConfig = getUnitBadgeConfig(uItem, sortedUnits);
                                const sMult = getUnitStepMultiplier(uItem, sortedUnits);
                                return (
                                  <span
                                    className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 min-h-[26px] rounded-md text-xs min-w-[65px] text-center shrink-0 border font-medium shadow-2xs ${bConfig.badge}`}
                                  >
                                    <span>{uItem.unitName}</span>
                                    {sMult ? (
                                      <span className={`font-normal text-[10.5px] ${bConfig.mult}`}>
                                        (x{sMult})
                                      </span>
                                    ) : null}
                                  </span>
                                );
                              })()}

                              {isAnyDirty && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setManualEdits((prev) => {
                                      const copy = { ...prev };
                                      delete copy[uItem.unitId];
                                      return copy;
                                    });
                                  }}
                                  className="text-[10px] text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer"
                                  title="ຄືນຄ່າເດີມ"
                                >
                                  ຄືນຄ່າ
                                </button>
                              )}
                            </div>

                            {/* 3 Price Inputs */}
                            <div className="sm:col-span-9 grid grid-cols-3 gap-1.5 sm:gap-2">
                              {/* Price 1 */}
                              <div className="flex flex-col">
                                <span className="block sm:hidden text-[9px] font-bold text-slate-400 mb-0.5">ລາຄາ 1</span>
                                <div className="relative">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={curRetail > 0 ? Number(curRetail).toLocaleString('de-DE') : ''}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleManualUnitChange(uItem, 'retail_price', e.target.value)}
                                    placeholder="0"
                                    className={`w-full h-9 min-h-[36px] px-2.5 pr-6 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                      isRetailDirty
                                        ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                    }`}
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                                    ₭
                                  </span>
                                </div>
                              </div>

                              {/* Price 2 */}
                              <div className="flex flex-col">
                                <span className="block sm:hidden text-[9px] font-bold text-slate-400 mb-0.5">ລາຄາ 2</span>
                                <div className="relative">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={curPrice2 > 0 ? Number(curPrice2).toLocaleString('de-DE') : ''}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleManualUnitChange(uItem, 'price_2', e.target.value)}
                                    placeholder="0"
                                    className={`w-full h-9 min-h-[36px] px-2.5 pr-6 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                      isPrice2Dirty
                                        ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                    }`}
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                                    ₭
                                  </span>
                                </div>
                              </div>

                              {/* Price 3 */}
                              <div className="flex flex-col">
                                <span className="block sm:hidden text-[9px] font-bold text-slate-400 mb-0.5">ລາຄາ 3</span>
                                <div className="relative">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={curPrice3 > 0 ? Number(curPrice3).toLocaleString('de-DE') : ''}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleManualUnitChange(uItem, 'price_3', e.target.value)}
                                    placeholder="0"
                                    className={`w-full h-9 min-h-[36px] px-2.5 pr-6 rounded-lg border text-xs font-mono font-bold text-right transition-all focus:outline-none ${
                                      isPrice3Dirty
                                        ? 'bg-amber-50/60 border-amber-300 text-slate-900 font-bold focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50'
                                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                    }`}
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                                    ₭
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===================== TAB 2: FORMULA MODE (FULL HEIGHT & COMPACT IPAD) ===================== */}
        {activeTab === 'formula' && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 flex flex-col gap-3">
            {/* 1. Target Tier Selector */}
            <div className="flex flex-col gap-1 shrink-0">
              <label className="text-xs font-bold text-slate-700">
                1. ເລືອກລະດັບລາຄາທີ່ຕ້ອງການປັບ:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'retail_price', label: 'ລາຄາ 1 (ມາດຕະຖານ)' },
                  { id: 'price_2', label: 'ລາຄາ 2 (ລູກຄ້າປະຈຳ)' },
                  { id: 'price_3', label: 'ລາຄາ 3 (VIP/ຂາຍສົ່ງ)' },
                  { id: 'all', label: 'ທຸກລະດັບລາຄາ (1, 2, 3)' },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setTargetTier(tier.id)}
                    className={`py-2 px-2 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[38px] flex items-center justify-center text-center ${
                      targetTier === tier.id
                        ? 'bg-primary text-white border-primary shadow-2xs font-black'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Adjustment Formula Type & Value */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <label className="text-xs font-bold text-slate-700">
                2. ຮູບແບບການປັບ & ມູນຄ່າ:
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'percent_add', label: 'ເພີ່ມ + %', icon: <Percent size={13} weight="bold" /> },
                  { id: 'percent_sub', label: 'ຫຼຸດ - %', icon: <Percent size={13} weight="bold" /> },
                  { id: 'amount_add', label: 'ເພີ່ມ + ₭', icon: <CurrencyDollar size={13} weight="bold" /> },
                  { id: 'amount_sub', label: 'ຫຼຸດ - ₭', icon: <CurrencyDollar size={13} weight="bold" /> },
                ].map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => handleSelectAdjustType(op.id)}
                    className={`py-1.5 px-2 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[38px] flex items-center justify-center gap-1 ${
                      adjustType === op.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-black'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{op.label}</span>
                  </button>
                ))}
              </div>

              {/* Value input with dot thousand format */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 pt-0.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={adjustDisplayStr}
                    onChange={(e) => handleFormulaInputChange(e.target.value)}
                    className="w-full h-9 px-3 pr-7 rounded-xl border border-slate-300 font-mono text-sm font-black text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
                    placeholder={adjustType.startsWith('percent') ? '10' : '1.000'}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-slate-400 pointer-events-none">
                    {adjustType.startsWith('percent') ? '%' : '₭'}
                  </span>
                </div>

                {/* Quick Presets with thousand separator */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {(adjustType.startsWith('percent')
                    ? [5, 10, 15, 20]
                    : [1000, 2000, 5000, 10000]
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleFormulaPreset(preset)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer min-h-[34px] border ${
                        adjustValue === preset
                          ? 'bg-primary-light border-primary-border text-primary-deep font-black'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {adjustType.startsWith('percent') ? `${preset}%` : `${preset.toLocaleString('de-DE')} ₭`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Live Preview Grouped by Product Cards */}
            <div className="flex flex-col gap-1.5 pt-1 flex-1 min-h-0">
              <div className="flex items-center justify-between text-xs px-1 shrink-0">
                <span className="font-bold text-slate-700">
                  ຕົວຢ່າງຜົນໄດ້ຮັບກ່ອນ-ຫຼັງປັບ (Preview ຕົວຢ່າງ):
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {productsWithSortedUnits.length} ສິນຄ້າ ({allSelectedUnits.length} ຫົວໜ່ວຍ)
                </span>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto overscroll-contain pr-1 flex-1 min-h-0">
                {productsWithSortedUnits.map(({ product, sortedUnits }) => {
                  const productImg = product.imageUrl || product.image_url || product.image;

                  return (
                    <div
                      key={product.id}
                      className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs transition-all hover:border-slate-300 shrink-0"
                    >
                      {/* Product Card Header - Compact */}
                      <div className="bg-slate-50/90 border-b border-slate-200 px-3 py-1.5 sm:py-2 flex items-center justify-between gap-2.5 rounded-t-xl">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {productImg ? (
                            <img
                              src={productImg}
                              alt={product.name}
                              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover border border-slate-200/80 shrink-0 bg-white"
                              loading="lazy"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 ${
                              productImg ? 'hidden' : 'flex'
                            }`}
                          >
                            <Package size={20} weight="duotone" />
                          </div>

                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-800 text-xs sm:text-sm truncate max-w-[280px] sm:max-w-[420px]">
                              {product.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {product.barcode && product.barcode !== product.id && (
                                <span className="font-mono text-[11px] text-slate-400 flex items-center gap-0.5">
                                  <Barcode size={12} weight="bold" />
                                  {product.barcode}
                                </span>
                              )}
                              {product.category && (
                                <span className="text-[9.5px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/80">
                                  {product.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary-light/70 text-primary border border-primary-border/80 shadow-2xs flex items-center gap-1">
                            <span className="font-extrabold">{sortedUnits.length}</span> ຫົວໜ່ວຍ
                          </span>
                        </div>
                      </div>

                      {/* Units List inside Card - Compact */}
                      <div className="divide-y divide-slate-100 bg-white">
                        {sortedUnits.map((u) => {
                          if (targetTier === 'all') {
                            return (
                              <div key={u.unitId} className="px-3 py-2 hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-center justify-between mb-1.5">
                                  {(() => {
                                    const bConfig = getUnitBadgeConfig(u, sortedUnits);
                                    const sMult = getUnitStepMultiplier(u, sortedUnits);
                                    return (
                                      <span
                                        className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 min-h-[26px] rounded-md text-xs min-w-[65px] text-center shrink-0 border font-medium shadow-2xs ${bConfig.badge}`}
                                      >
                                        <span>{u.unitName}</span>
                                        {sMult ? (
                                          <span className={`font-normal text-[10.5px] ${bConfig.mult}`}>
                                            (x{sMult})
                                          </span>
                                        ) : null}
                                      </span>
                                    );
                                  })()}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 font-mono text-xs">
                                  {[
                                    { label: 'ລາຄາ 1 (ມາດຕະຖານ)', orig: u.retail_price },
                                    { label: 'ລາຄາ 2 (ລູກຄ້າປະຈຳ)', orig: u.price_2 },
                                    { label: 'ລາຄາ 3 (VIP/ຂາຍສົ່ງ)', orig: u.price_3 },
                                  ].map((tier, tIdx) => {
                                    const nextP = calculateNewPrice(tier.orig);
                                    const diffP = nextP - tier.orig;
                                    return (
                                      <div
                                        key={tIdx}
                                        className="bg-slate-50/80 rounded-lg p-2 border border-slate-200/70 flex flex-col gap-0.5"
                                      >
                                        <span className="text-[10px] font-sans font-bold text-slate-500">
                                          {tier.label}
                                        </span>
                                        <div className="flex items-center justify-between gap-1 pt-0.5">
                                          <span className="text-slate-400 line-through text-[11px]">
                                            {formatKip(tier.orig)}
                                          </span>
                                          <ArrowRight size={10} className="text-slate-300 shrink-0" />
                                          <span className="font-black text-primary text-xs">
                                            {formatKip(nextP)}
                                          </span>
                                        </div>
                                        <div className="text-right pt-0.5">
                                          <span
                                            className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold ${
                                              diffP > 0
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : diffP < 0
                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                : 'bg-slate-100 text-slate-500'
                                            }`}
                                          >
                                            {diffP > 0 ? `+${formatKip(diffP)}` : formatKip(diffP)}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }

                          // Single tier preview
                          let origVal = 0;
                          let targetLabel = '';
                          if (targetTier === 'retail_price') {
                            origVal = u.retail_price;
                            targetLabel = 'ລາຄາ 1';
                          } else if (targetTier === 'price_2') {
                            origVal = u.price_2;
                            targetLabel = 'ລາຄາ 2';
                          } else {
                            origVal = u.price_3;
                            targetLabel = 'ລາຄາ 3';
                          }

                          const calculated = calculateNewPrice(origVal);
                          const diff = calculated - origVal;

                          return (
                            <div
                              key={u.unitId}
                              className="px-3 py-1.5 sm:py-2 flex items-center justify-between gap-2.5 hover:bg-slate-50/50 transition-colors"
                            >
                              <div className="flex items-center gap-1.5">
                                {(() => {
                                  const bConfig = getUnitBadgeConfig(u, sortedUnits);
                                  const sMult = getUnitStepMultiplier(u, sortedUnits);
                                  return (
                                    <span
                                      className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 min-h-[26px] rounded-md text-xs min-w-[65px] text-center shrink-0 border font-medium shadow-2xs ${bConfig.badge}`}
                                    >
                                      <span>{u.unitName}</span>
                                      {sMult ? (
                                        <span className={`font-normal text-[10.5px] ${bConfig.mult}`}>
                                          (x{sMult})
                                        </span>
                                      ) : null}
                                    </span>
                                  );
                                })()}
                                <span className="text-[11px] text-slate-500 font-medium">
                                  ({targetLabel})
                                </span>
                              </div>

                              <div className="flex items-center gap-2 sm:gap-3 font-mono text-xs sm:text-sm">
                                <div className="text-slate-400 line-through text-right">
                                  {formatKip(origVal)}
                                </div>
                                <ArrowRight size={12} weight="bold" className="text-slate-300 shrink-0" />
                                <div className="font-black text-primary text-right">
                                  {formatKip(calculated)}
                                </div>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold shrink-0 ${
                                    diff > 0
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : diff < 0
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {diff > 0 ? `+${formatKip(diff)}` : formatKip(diff)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[40px]"
          >
            ຍົກເລີກ
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying || allSelectedUnits.length === 0 || (activeTab === 'manual' && manualDirtyCount === 0)}
            className="px-6 py-2 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white text-xs sm:text-sm font-black transition-all shadow-md shadow-primary/25 flex items-center gap-2 cursor-pointer min-h-[40px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isApplying ? (
              <ArrowClockwise size={16} className="animate-spin" />
            ) : (
              <CheckCircle size={16} weight="fill" />
            )}
            <span>
              {activeTab === 'manual'
                ? `ບັນທຶກລາຄາ (${manualDirtyCount} ຫົວໜ່ວຍ)`
                : `ນຳໃຊ້ສູດ (${allSelectedUnits.length} ຫົວໜ່ວຍ)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
