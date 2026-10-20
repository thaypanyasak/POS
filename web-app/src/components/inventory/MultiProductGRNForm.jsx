import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  FloppyDisk,
  Package,
  Truck,
  Coins,
  Barcode,
  Camera,
  Plus,
  CheckCircle,
  WarningCircle,
  MagnifyingGlass,
  X,
  CurrencyCircleDollar,
  PencilSimple,
  Trash,
  HandCoins,
  Receipt,
  ArrowCounterClockwise,
  Link,
  LinkBreak,
  Lightning,
} from '@phosphor-icons/react';
import {
  formatKip,
  formatDots,
  parseDots,
  formatThb,
  parseThb,
  formatThbTyping,
  getProductHighestStockDisplay,
  normalizeLao,
} from '../../utils/formatters';
import BarcodeScannerModal from '../BarcodeScannerModal';
import { useHardwareBarcodeScanner } from '../../hooks/useHardwareBarcodeScanner';
import { playSuccessBeep, playErrorBeep } from '../../utils/audioFeedback';
import { updateExchangeRateInSupabase, fetchExchangeRate } from '../../services/supabase';
import queryClient from '../../services/queryClient';

/**
 * Editable Quantity Stepper with local state to allow deleting/backspacing to empty
 * and defaulting back to 1 onBlur if empty or <= 0.
 */
function GrnQuantityStepper({ quantity, onUpdateQuantity, onStepQuantity, size = 'sm' }) {
  const [localQty, setLocalQty] = useState(quantity != null && quantity !== '' ? String(quantity) : '1');

  // Sync external quantity changes (e.g. from step buttons or reset)
  useEffect(() => {
    if (quantity !== undefined && quantity !== null) {
      setLocalQty(quantity === '' ? '' : String(quantity));
    }
  }, [quantity]);

  const handleChange = (e) => {
    const val = e.target.value;
    // Allow empty string so user can clear and type directly
    if (val === '' || /^[0-9]+$/.test(val)) {
      setLocalQty(val);
      if (val !== '' && Number(val) > 0) {
        onUpdateQuantity?.(Number(val));
      }
    }
  };

  const handleBlur = () => {
    if (localQty === '' || Number(localQty) <= 0) {
      setLocalQty('1');
      onUpdateQuantity?.(1);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  if (size === 'lg') {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onStepQuantity?.(-1)}
          className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-lg active:scale-95 flex items-center justify-center cursor-pointer border border-slate-200 transition-colors"
        >
          -
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={localQty}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.target.select()}
          className="w-14 h-11 text-center bg-white border border-slate-200 rounded-xl text-base font-mono font-black text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 selection:bg-teal-500 selection:text-white"
        />
        <button
          type="button"
          onClick={() => onStepQuantity?.(1)}
          className="w-11 h-11 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 font-black text-lg active:scale-95 flex items-center justify-center cursor-pointer border border-teal-200 transition-colors"
        >
          +
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-0.5">
      <button
        type="button"
        onClick={() => onStepQuantity?.(-1)}
        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold active:scale-95 flex items-center justify-center cursor-pointer text-xs shrink-0 transition-colors"
      >
        -
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={localQty}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onFocus={(e) => e.target.select()}
        className="w-11 h-7 text-center bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 p-0 selection:bg-teal-500 selection:text-white"
      />
      <button
        type="button"
        onClick={() => onStepQuantity?.(1)}
        className="w-7 h-7 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold active:scale-95 flex items-center justify-center cursor-pointer text-xs shrink-0 transition-colors"
      >
        +
      </button>
    </div>
  );
}

/**
 * Enterprise Multi-Product Goods Receipt Note (GRN) Form
 * Responsive for Desktop (>= 1024px Data Table) and Mobile (< 1024px High-Density Cards)
 */
export default function MultiProductGRNForm({
  editingPoId,
  poCode,
  setPoCode,
  suppliers = [],
  products = [],
  selectedSupplierId,
  setSelectedSupplierId,
  receivedBy,
  setReceivedBy,
  note,
  setNote,
  currentExchangeRate = 690,
  setCurrentExchangeRate,
  grnCartItems = [],
  setGrnCartItems,
  paymentStatus,
  setPaymentStatus,
  paidAmount,
  setPaidAmount,
  totalCostLakNumber = 0,
  totalCostThbNumber = 0,
  debtAmountNumber = 0,
  isSubmittingGRN = false,
  onBackToList,
  onAddToCart,
  onUpdateItemQuantity,
  onStepItemQuantity,
  onUpdateItemUnit,
  onUpdateItemCostThb,
  onUpdateItemCostLak,
  onToggleItemCostMode,
  onToggleAllItemsCostMode,
  onToggleItemRetail,
  onUpdateItemRetailPrice,
  onRemoveItem,
  onSubmitGRN,
  onOpenSupplierManager,
  onAlert,
}) {
  const [productSearch, setProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isEditingExchangeRate, setIsEditingExchangeRate] = useState(false);
  const [tempRate, setTempRate] = useState(String(currentExchangeRate || 690));

  // Auto-sync exchange rate from Supabase store_settings & queryClient
  useEffect(() => {
    let mounted = true;
    fetchExchangeRate().then((rate) => {
      if (mounted && rate && rate > 0) {
        setCurrentExchangeRate?.(rate);
        setTempRate(String(rate));
      }
    });

    const unsubscribe = queryClient.subscribe(['exchange_rate'], async () => {
      const rate = await fetchExchangeRate();
      if (mounted && rate && rate > 0) {
        setCurrentExchangeRate?.(rate);
        setTempRate(String(rate));
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [setCurrentExchangeRate]);

  // Keep tempRate in sync with currentExchangeRate prop
  useEffect(() => {
    if (currentExchangeRate && currentExchangeRate > 0) {
      setTempRate(String(currentExchangeRate));
    }
  }, [currentExchangeRate]);

  // =========================================================================
  // DUAL-MODE TOTAL COST & PAYMENT LOGIC (CARD 4)
  // =========================================================================
  // 1. Auto bottom-up sum calculation from cart items
  const autoTotalLak = useMemo(() => {
    return grnCartItems.reduce((sum, it) => {
      const q = Number(it.quantity) || 0;
      const c = parseDots(it.costLak);
      return sum + q * c;
    }, 0);
  }, [grnCartItems]);

  const autoTotalThb = useMemo(() => {
    return grnCartItems.reduce((sum, it) => {
      const q = Number(it.quantity) || 0;
      const c = parseDots(it.costThb);
      return sum + q * c;
    }, 0);
  }, [grnCartItems]);

  // 2. Dual Mode & Manual Overrides for Step 4
  const [totalCostMode, setTotalCostMode] = useState('auto'); // 'auto' | 'manual'
  const [isManualMode, setIsManualMode] = useState(false);
  const [isManualTotalLak, setIsManualTotalLak] = useState(false);
  const [manualTotalLakInput, setManualTotalLakInput] = useState('');
  const [isManualTotalThb, setIsManualTotalThb] = useState(false);
  const [manualTotalThbInput, setManualTotalThbInput] = useState('');

  // Effective Total LAK (Manual override takes priority if active)
  const effectiveTotalLak = useMemo(() => {
    if (isManualMode && isManualTotalLak) {
      return parseDots(manualTotalLakInput) || 0;
    }
    return autoTotalLak;
  }, [isManualMode, isManualTotalLak, manualTotalLakInput, autoTotalLak]);

  // Effective Total THB
  const effectiveTotalThb = useMemo(() => {
    if (isManualMode) {
      if (isManualTotalThb) {
        return parseDots(manualTotalThbInput) || 0;
      }
      return autoTotalThb;
    }
    // Auto Mode:
    const rate = Number(currentExchangeRate) || 0;
    return rate > 0 ? Math.round(effectiveTotalLak / rate) : 0;
  }, [isManualMode, isManualTotalThb, manualTotalThbInput, autoTotalThb, currentExchangeRate, effectiveTotalLak]);

  // 3. Payment Status & Advance Paid Amount
  const [localPaymentStatus, setLocalPaymentStatus] = useState(paymentStatus || 'PAID');
  const [advancePaidInput, setAdvancePaidInput] = useState(paidAmount ? String(paidAmount) : '0');

  // Sync with prop if parent changes
  useEffect(() => {
    if (paymentStatus) setLocalPaymentStatus(paymentStatus);
  }, [paymentStatus]);

  // Auto-sync advancePaidInput when effectiveTotalLak or localPaymentStatus changes
  useEffect(() => {
    if (localPaymentStatus === 'PAID') {
      setAdvancePaidInput(formatDots(effectiveTotalLak));
      setPaidAmount?.(formatDots(effectiveTotalLak));
    } else if (localPaymentStatus === 'DEBT') {
      setAdvancePaidInput('0');
      setPaidAmount?.('0');
    }
  }, [effectiveTotalLak, localPaymentStatus, setPaidAmount]);

  // Effective Paid Amount LAK
  const effectivePaidAmountLak = useMemo(() => {
    if (localPaymentStatus === 'PAID') return effectiveTotalLak;
    if (localPaymentStatus === 'DEBT') return 0;
    return Math.min(effectiveTotalLak, parseDots(advancePaidInput));
  }, [localPaymentStatus, effectiveTotalLak, advancePaidInput]);

  // Effective Debt Amount LAK
  const effectiveDebtAmountLak = useMemo(() => {
    if (localPaymentStatus === 'PAID') return 0;
    if (localPaymentStatus === 'DEBT') return effectiveTotalLak;
    return Math.max(0, effectiveTotalLak - effectivePaidAmountLak);
  }, [localPaymentStatus, effectiveTotalLak, effectivePaidAmountLak]);

  // Reset manual override whenever editingPoId changes
  useEffect(() => {
    setIsManualMode(false);
    setIsManualTotalLak(false);
    setManualTotalLakInput('');
    setIsManualTotalThb(false);
    setManualTotalThbInput('');
    setTotalCostMode('auto');
  }, [editingPoId]);

  // Handlers for Total Cost & Payment
  const handleManualTotalLakChange = (val) => {
    const cleanDigits = String(val ?? '').replace(/\D/g, '');
    const num = cleanDigits ? parseInt(cleanDigits, 10) : 0;
    const formatted = cleanDigits ? formatDots(cleanDigits) : (val === '0' ? '0' : '');

    setIsManualMode(true);
    setIsManualTotalLak(true);
    setManualTotalLakInput(formatted);

    // In Auto linked calculation: total_thb automatically follows: Math.round(total_lak / rate)
    const rate = Number(currentExchangeRate) || 0;
    const thb = rate > 0 ? Math.round(num / rate) : 0;
    setIsManualTotalThb(false);
    setManualTotalThbInput(thb > 0 ? formatDots(thb) : '');

    if (localPaymentStatus === 'PAID') {
      setAdvancePaidInput(formatted || '0');
    }
  };

  const handleManualTotalThbChange = (val) => {
    const cleanDigits = String(val ?? '').replace(/\D/g, '');
    const num = cleanDigits ? parseInt(cleanDigits, 10) : 0;
    const formatted = cleanDigits ? formatDots(cleanDigits) : (val === '0' ? '0' : '');

    setIsManualMode(true);
    setIsManualTotalThb(true);
    setManualTotalThbInput(formatted);

    // In Auto linked calculation: total_lak automatically follows: Math.round(total_thb * rate)
    const rate = Number(currentExchangeRate) || 0;
    const lak = rate > 0 ? Math.round(num * rate) : 0;
    setIsManualTotalLak(true);
    setManualTotalLakInput(lak > 0 ? formatDots(lak) : '');
    if (localPaymentStatus === 'PAID') {
      setAdvancePaidInput(formatDots(lak));
    }
  };

  const handleToggleTotalCostMode = () => {
    if (isManualMode) {
      // Switching from Manual -> Auto: complete reset of all manual states & border colors
      setIsManualMode(false);
      setIsManualTotalLak(false);
      setManualTotalLakInput('');
      setIsManualTotalThb(false);
      setManualTotalThbInput('');
      setTotalCostMode('auto');
      if (localPaymentStatus === 'PAID') {
        setAdvancePaidInput(formatDots(autoTotalLak));
      }
    } else {
      // Switching from Auto -> Manual
      setIsManualMode(true);
      setTotalCostMode('manual');
      setIsManualTotalLak(true);
      setManualTotalLakInput(formatDots(autoTotalLak));
      setIsManualTotalThb(true);
      setManualTotalThbInput(formatDots(autoTotalThb));
    }
  };

  const handleSaveGRN = () => {
    if (grnCartItems.length === 0) {
      onAlert?.('ກະລຸນາເລືອກຢ່າງໜ້ອຍ 1 ສິນຄ້າເພື່ອຮັບເຂົ້າສາງ!', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    const payload = {
      total_lak: effectiveTotalLak,
      total_thb: effectiveTotalThb,
      payment_status: localPaymentStatus,
      paid_amount_lak: effectivePaidAmountLak,
      debt_amount_lak: effectiveDebtAmountLak,
    };

    onSubmitGRN?.(payload);
  };

  // Search filtering
  const filteredProducts = useMemo(() => {
    const q = normalizeLao(productSearch);
    if (!q) return products.slice(0, 30);
    return products
      .filter(
        (p) =>
          normalizeLao(p.name).includes(q) ||
          normalizeLao(p.category).includes(q) ||
          normalizeLao(p.barcode).includes(q) ||
          (p.units && p.units.some((u) => u.barcode && normalizeLao(u.barcode) === q))
      )
      .slice(0, 30);
  }, [products, productSearch]);

  function trimmedQ(q) {
    return q.trim();
  }

  // Hardware Scanner / Enter key trigger
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = productSearch.trim().toLowerCase();
      if (!trimmed) return;

      // 1. Exact barcode search
      const exactMatch = products.find((p) => {
        if (p.barcode && p.barcode.toLowerCase() === trimmed) return true;
        if (p.units && p.units.some((u) => u.barcode && u.barcode.toLowerCase() === trimmed)) return true;
        return false;
      });

      if (exactMatch) {
        const matchedUnit = exactMatch.units?.find((u) => u.barcode && u.barcode.toLowerCase() === trimmed);
        onAddToCart(exactMatch, matchedUnit || null);
        setProductSearch('');
        setIsProductDropdownOpen(false);
        onAlert?.(`ເພີ່ມ "${exactMatch.name}" ເຂົ້າໃບຮັບສິນຄ້າແລ້ວ!`, 'ສຳເລັດ', 'success');
        return;
      }

      // 2. First search match
      if (filteredProducts.length > 0) {
        onAddToCart(filteredProducts[0]);
        setProductSearch('');
        setIsProductDropdownOpen(false);
        onAlert?.(`ເພີ່ມ "${filteredProducts[0].name}" ເຂົ້າໃບຮັບສິນຄ້າແລ້ວ!`, 'ສຳເລັດ', 'success');
      } else {
        onAlert?.(`ບໍ່ພົບສິນຄ້າ "${productSearch}"`, 'ແຈ້ງເຕືອນ', 'warning');
      }
    }
  };

  const handleBarcodeScanned = (code) => {
    setScannerOpen(false);
    if (!code) return;
    const trimmed = code.trim().toLowerCase();
    const matched = products.find((p) => {
      if (p.barcode && p.barcode.toLowerCase() === trimmed) return true;
      if (p.units && p.units.some((u) => u.barcode && u.barcode.toLowerCase() === trimmed)) return true;
      return false;
    });

    if (matched) {
      const matchedUnit = matched.units?.find((u) => u.barcode && u.barcode.toLowerCase() === trimmed);
      onAddToCart(matched, matchedUnit || null);
      playSuccessBeep();
      onAlert?.(`ເພີ່ມ "${matched.name}" ເຂົ້າໃບຮັບສິນຄ້າແລ້ວ!`, 'ສະແກນສຳເລັດ', 'success');
    } else {
      playErrorBeep();
      onAlert?.(`ບໍ່ພົບສິນຄ້າທີ່ມີ Barcode "${code}"`, 'ແຈ້ງເຕືອນ', 'warning');
    }
  };

  // Hardware barcode scanner support inside GRN Goods Receipt Form
  useHardwareBarcodeScanner({
    onScan: handleBarcodeScanned,
    enabled: true,
    maxInterval: 50,
    minLength: 3,
    preventDefaultOnEnter: true,
    cleanActiveInput: true,
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100 select-none font-sans">
      {/* ============================================================== */}
      {/* 1. TOP STICKY HEADER                                           */}
      {/* ============================================================== */}
      <header className="bg-white border-b border-slate-200/90 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shrink-0 shadow-xs z-20 sticky top-0">
        {/* Left: Back Button & Title */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onBackToList}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs border border-slate-200 shrink-0"
            title="ກັບຄືນໜ້າລາຍການ"
          >
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" weight="bold" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex flex-wrap items-center gap-1.5 sm:gap-2 truncate">
              <span>{editingPoId ? 'ແກ້ໄຂໃບຮັບສິນຄ້າ' : 'ສ້າງໃບຮັບສິນຄ້າເຂົ້າສາງ'}</span>
              <span className="text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                #{poCode || 'GRN-AUTO'}
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 hidden sm:block truncate mt-0.5">
              Multi-Product Goods Receipt Note • ຕັດສະຕັອກ & ບັນທຶກຕົ້ນທຶນແບບ nguyên tử ACID
            </p>
          </div>
        </div>

        {/* Right: Exchange Rate Reference & Header Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Quick Exchange Rate Reference Button & Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setTempRate(String(currentExchangeRate));
                setIsEditingExchangeRate((prev) => !prev);
              }}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-[11px] sm:text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="ຄລິກເພື່ອປ່ຽນອັດຕາແລກປ່ຽນ"
            >
              <CurrencyCircleDollar size={16} weight="duotone" className="text-amber-600" />
              <span>1 ฿ = {formatDots(currentExchangeRate)} ₭</span>
            </button>

            {isEditingExchangeRate && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-50 flex flex-col gap-2">
                <span className="text-[11px] font-bold text-slate-700">ປັບອັດຕາແລກປ່ຽນຕົ້ນທຶນ:</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-slate-500">1 ฿ =</span>
                  <input
                    type="number"
                    value={tempRate}
                    onChange={(e) => setTempRate(e.target.value)}
                    className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <span className="text-xs font-mono text-slate-500">₭</span>
                </div>
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingExchangeRate(false)}
                    className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    ຍົກເລີກ
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const val = parseInt(tempRate, 10) || currentExchangeRate || 0;
                      setCurrentExchangeRate?.(val);
                      setIsEditingExchangeRate(false);
                      try {
                        await updateExchangeRateInSupabase(val);
                        await queryClient.invalidateQueries({ queryKey: ['exchange_rate'] });
                        await queryClient.invalidateQueries({ queryKey: ['store_settings'] });
                      } catch (_) {}
                      onAlert?.(`ອັບເດດອັດຕາແລກປ່ຽນ: 1 ฿ = ${formatDots(val)} ₭`, 'ສຳເລັດ', 'info');
                    }}
                    className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold shadow-2xs cursor-pointer"
                  >
                    ຕົກລົງ
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onBackToList}
            className="px-3 sm:px-4 py-2 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs hidden xs:block"
          >
            ຍົກເລີກ
          </button>

          <button
            type="button"
            onClick={handleSaveGRN}
            disabled={isSubmittingGRN || grnCartItems.length === 0}
            className="px-3.5 sm:px-5 py-2 sm:py-2.5 h-10 sm:h-12 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl shadow-md shadow-teal-700/20 active:scale-95 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer disabled:opacity-50"
          >
            <FloppyDisk size={18} weight="bold" />
            <span>{isSubmittingGRN ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກໃບຮັບສິນຄ້າ'}</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. SCROLLABLE BODY                                             */}
      {/* ============================================================== */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 pb-12">
        <div className="max-w-6xl mx-auto space-y-3.5 sm:space-y-4">
          {/* ============================================================ */}
          {/* 📦 CARD 1: ຂໍ້ມູນຮ້ານສົ່ງ & ຜູ້ຮັບສິນຄ້າ (Header Info)             */}
          {/* ============================================================ */}
          <div className="bg-white p-3.5 sm:p-4 md:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col gap-2.5 sm:gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
                  <Truck size={18} weight="duotone" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    1. ຂໍ້ມູນຮ້ານສົ່ງ & ຜູ້ກວດຮັບສິນຄ້າ (Supplier & Receiver Info)
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenSupplierManager}
                className="text-[11px] text-teal-700 hover:text-teal-800 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} weight="bold" />
                <span>+ ຈັດການຮ້ານສົ່ງ</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
              {/* 1. PO Code Input (First Input) */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  ລະຫັດໃບຮັບສິນຄ້າ (PO Code)
                </label>
                <input
                  type="text"
                  value={poCode || ''}
                  onChange={(e) => setPoCode?.(e.target.value)}
                  placeholder="PO-YYYYMMDD-XXXX"
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs"
                />
              </div>

              {/* 2. Supplier Dropdown */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  ຮ້ານສົ່ງ / ແຫຼ່ງນຳເຂົ້າ (Supplier)
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs cursor-pointer"
                >
                  <option value="">-- ເລືອກຮ້ານສົ່ງ / ແຫຼ່ງນຳເຂົ້າ --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(ໂທ: ${s.phone})` : ''} {s.contact_person ? `• ${s.contact_person}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Receiver Name */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  ຜູ້ຮັບສິນຄ້າເຂົ້າສາງ (Receiver)
                </label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="ໄມ້ຄຳ (Meii)"
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 🔍 CARD 2: ຄົ້ນຫາ & ສະແກນສິນຄ້າ (Catalog Picker & Scanner)       */}
          {/* ============================================================ */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col gap-2.5 relative">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
                  <Barcode size={18} weight="duotone" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    2. ຄົ້ນຫາ & ສະແກນສິນຄ້າເຂົ້າລາຍການ (Item Catalog & Scanner)
                  </h3>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                ຮອງຮັບເຄື່ອງຍິງບາໂຄດ USB/Bluetooth (ກົດ Enter ເພື່ອເພີ່ມ)
              </span>
            </div>

            {/* Search Input Bar + Barcode Scanner Modal Button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="ພິມຊື່ສິນຄ້າ, ໝວດໝູ່ ຫຼື ຍິງບາໂຄດ (ກົດ Enter ເພື່ອເພີ່ມ)..."
                  value={productSearch}
                  onFocus={() => setIsProductDropdownOpen(true)}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setIsProductDropdownOpen(true);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs"
                />
                <MagnifyingGlass
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearch('');
                      setIsProductDropdownOpen(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="px-3 sm:px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs shrink-0"
                title="ເປີດກ້ອງສະແກນບາໂຄດ"
              >
                <Camera size={16} weight="duotone" className="text-teal-700" />
                <span className="hidden sm:inline">ສະແກນກ້ອງ</span>
              </button>
            </div>

            {/* Suggestions Dropdown */}
            {isProductDropdownOpen && filteredProducts.length > 0 && (
              <div className="absolute left-4 right-4 top-full mt-1 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl z-40 divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const prodUnits = (p.units || []).filter((u) => u.isActive !== false);
                  const sorted = [...prodUnits].sort((a, b) => (b.multiplier || 1) - (a.multiplier || 1));
                  const largestUnit = sorted[0];

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onAddToCart(p);
                        setProductSearch('');
                        setIsProductDropdownOpen(false);
                      }}
                      className="px-4 py-2.5 hover:bg-teal-50/70 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        {p.imageUrl || p.image_url ? (
                          <img
                            src={p.imageUrl || p.image_url}
                            alt={p.name}
                            className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <Package size={16} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 block truncate">
                            {p.name}
                          </span>
                          <span className="text-[11px] text-slate-400 block truncate">
                            ໝວດ: {p.category || 'ທົ່ວໄປ'} {p.barcode ? `• Barcode: ${p.barcode}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10.5px] font-mono font-bold">
                          ສະຕັອກ: {p.currentStockBaseUnits || 0} {p.baseUnit}
                        </span>
                        {largestUnit && (
                          <span className="text-[11px] font-mono font-bold text-teal-700">
                            + ເພີ່ມ ({largestUnit.unitName})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* 📋 CARD 3: ລາຍການສິນຄ້າຮັບເຂົ້າສາງ (Multi-Product Cart Items)   */}
          {/* ============================================================ */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            {/* Header Badge */}
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  3. ລາຍການສິນຄ້າຮັບເຂົ້າສາງ (Items in GRN Cart)
                </span>
                <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full text-[10.5px] font-mono font-bold">
                  {grnCartItems.length} ລາຍການ
                </span>
              </div>

              <div className="flex items-center gap-2">
                {grnCartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allManual = grnCartItems.every((it) => it.isManualMode);
                      onToggleAllItemsCostMode?.(!allManual);
                    }}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer shadow-2xs ${
                      grnCartItems.every((it) => it.isManualMode)
                        ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                        : 'bg-teal-50 border-teal-300 text-teal-800 hover:bg-teal-100'
                    }`}
                    title="ປ່ຽນໂໝດປ້ອນຕົ້ນທຶນສຳລັບທຸກລາຍການໃນກະຕ່າ"
                  >
                    {grnCartItems.every((it) => it.isManualMode) ? (
                      <>
                        <LinkBreak size={12} weight="bold" />
                        <span>ແຍກປ້ອນເອງ</span>
                      </>
                    ) : (
                      <>
                        <Link size={12} weight="bold" />
                        <span>ໄລ່ອັດຕະໂນມັດ</span>
                      </>
                    )}
                  </button>
                )}

                {grnCartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setGrnCartItems([])}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                  >
                    ລຶບທັງໝົດ
                  </button>
                )}
              </div>
            </div>

            {/* Empty State */}
            {grnCartItems.length === 0 ? (
              <div className="py-14 px-4 flex flex-col items-center justify-center text-center">
                <Package size={48} weight="duotone" className="text-slate-300 mb-2" />
                <p className="text-xs sm:text-sm font-bold text-slate-700">
                  ຍັງບໍ່ມີສິນຄ້າໃນລາຍການຮັບເຂົ້າສາງ
                </p>
                <p className="text-[11.5px] text-slate-400 mt-1 max-w-sm">
                  ກະລຸນາຄົ້ນຫາຊື່ສິນຄ້າ ຫຼື ຍິງບາໂຄດດ້ານເທິງເພື່ອເພີ່ມສິນຄ້າເຂົ້າໃບຮັບນີ້
                </p>
              </div>
            ) : (
              <>
                {/* ======================================================== */}
                {/* DESKTOP DATA TABLE (>= 1024px, hidden lg:block)          */}
                {/* ======================================================== */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left border-collapse text-xs table-fixed">
                    <colgroup>
                      <col className="w-[195px]" />
                      <col className="w-[115px]" />
                      <col className="w-[105px]" />
                      <col className="w-[105px]" />
                      <col className="w-[145px]" />
                      <col className="w-[135px]" />
                      <col className="w-[60px]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <th className="py-3 px-3 w-[195px]">ຮູບ & ຊື່ສິນຄ້າ</th>
                        <th className="py-3 px-2 w-[115px]">ຫົວໜ່ວຍນຳເຂົ້າ</th>
                        <th className="py-3 px-1 text-center w-[105px]">ຈຳນວນ</th>
                        <th className="py-3 px-1.5 text-right w-[105px]">ຕົ້ນທຶນ ฿</th>
                        <th className="py-3 px-1.5 text-right w-[145px]">ຕົ້ນທຶນ ₭</th>
                        <th className="py-3 px-3 text-right w-[135px]">ລວມເງິນ ₭</th>
                        <th className="py-3 px-1 text-center w-[60px]">ຈັດການ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {grnCartItems.map((item, idx) => {
                        const prodUnits = (item.product.units || []).filter((u) => u.isActive !== false);
                        const sorted = [...prodUnits].sort((a, b) => (b.multiplier || 1) - (a.multiplier || 1));
                        const lineTotalLak = (Number(item.quantity) || 0) * parseDots(item.costLak);
                        const lineTotalThb = (Number(item.quantity) || 0) * parseThb(item.costThb);

                        return (
                          <React.Fragment key={`${item.product.id}-${item.unitId}-${idx}`}>
                            <tr className="hover:bg-slate-50/80 transition-colors">
                              {/* Product Info */}
                              <td className="py-3 px-3 w-[195px]">
                                <div className="flex items-center gap-2.5">
                                  {item.product.imageUrl || item.product.image_url ? (
                                    <img
                                      src={item.product.imageUrl || item.product.image_url}
                                      alt={item.product.name}
                                      className="w-9 h-9 rounded-[6px] object-cover border border-slate-200 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-[6px] bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                      <Package size={18} />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div
                                      className="font-semibold text-slate-800 text-[13px] leading-snug line-clamp-2 break-words"
                                      title={item.product.name}
                                    >
                                      {item.product.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                      <span>ສະຕັອກ: {getProductHighestStockDisplay(item.product)}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Unit Selector */}
                              <td className="py-3 px-2 w-[115px]">
                                <select
                                  value={item.unitId}
                                  onChange={(e) => onUpdateItemUnit(idx, e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                                >
                                  {sorted.length > 0 ? (
                                    sorted.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.unitName}
                                      </option>
                                    ))
                                  ) : (
                                    <option value="base">{item.product.baseUnit || 'ອັນ'}</option>
                                  )}
                                </select>
                              </td>

                              {/* Quantity Stepper */}
                              <td className="py-3 px-1 text-center w-[105px]">
                                <GrnQuantityStepper
                                  quantity={item.quantity}
                                  onUpdateQuantity={(newQty) => onUpdateItemQuantity(idx, newQty)}
                                  onStepQuantity={(delta) => onStepItemQuantity(idx, delta)}
                                />
                              </td>

                              {/* Cost THB */}
                              <td className="py-3 px-1.5 w-[105px]">
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={item.costThb}
                                    onChange={(e) => onUpdateItemCostThb(idx, e.target.value)}
                                    className={`w-full pr-5 pl-2 py-1.5 text-right bg-white border rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 ${
                                      item.isManualMode
                                        ? 'border-amber-300 focus:ring-amber-500'
                                        : 'border-slate-200 focus:ring-teal-500'
                                    }`}
                                    placeholder="0"
                                  />
                                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">
                                    ฿
                                  </span>
                                </div>
                              </td>

                              {/* Cost LAK + Mode Switch */}
                              <td className="py-3 px-1.5 w-[145px]">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onToggleItemCostMode?.(idx)}
                                    className={`w-5 h-7 rounded text-[11px] flex items-center justify-center shrink-0 border cursor-pointer transition-all active:scale-95 ${
                                      item.isManualMode
                                        ? 'bg-amber-100 border-amber-300 text-amber-800'
                                        : 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100'
                                    }`}
                                    title={
                                      item.isManualMode
                                        ? 'ໂໝດແຍກປ້ອນເອງ: ຄລິກເພື່ອປ່ຽນເປັນໄລ່ອັດຕະໂນມັດ'
                                        : 'ໂໝດໄລ່ອັດຕະໂນມັດ: ຄລິກເພື່ອແຍກປ້ອນເອງ'
                                    }
                                  >
                                    {item.isManualMode ? (
                                      <LinkBreak size={11} weight="bold" />
                                    ) : (
                                      <Link size={11} weight="bold" />
                                    )}
                                  </button>
                                  <div className="relative flex-1 min-w-0">
                                    <input
                                      type="text"
                                      value={item.costLak}
                                      onChange={(e) => onUpdateItemCostLak(idx, e.target.value)}
                                      className={`w-full pr-5 pl-2 py-1.5 text-right bg-white border rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 ${
                                        item.isManualMode
                                          ? 'border-amber-300 focus:ring-amber-500'
                                          : 'border-slate-200 focus:ring-teal-500'
                                      }`}
                                      placeholder="0"
                                    />
                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">
                                      ₭
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Line Total */}
                              <td className="py-3 px-3 text-right w-[135px]">
                                <div className="font-mono font-bold text-slate-900 text-[13px] tabular-nums truncate">
                                  {formatKip(lineTotalLak)}
                                </div>
                                {lineTotalThb > 0 && (
                                  <div className="text-[11px] font-mono font-medium text-slate-500 tabular-nums truncate">
                                    {formatThb(lineTotalThb)} ฿
                                  </div>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-1 text-center w-[60px]">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onToggleItemRetail(idx)}
                                    className={`p-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                                      item.isRetailOpen
                                        ? 'bg-teal-50 border-teal-300 text-teal-700'
                                        : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'
                                    }`}
                                    title="ປັບລາຄາຂາຍ"
                                  >
                                    <PencilSimple size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onRemoveItem(idx)}
                                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 cursor-pointer transition-all active:scale-95"
                                    title="ລຶບລາຍການ"
                                  >
                                    <Trash size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Accordion Row for Retail Price Overrides */}
                            {item.isRetailOpen && (
                              <tr className="bg-teal-50/40">
                                <td colSpan={7} className="px-5 py-3 border-b border-teal-100">
                                  <div className="flex flex-col gap-2">
                                    <span className="text-[11px] font-bold text-teal-900 flex items-center gap-1">
                                      <PencilSimple size={13} weight="bold" />
                                      <span>ປັບລາຄາຂາຍໜ້າຮ້ານສຳລັບ "{item.product.name}":</span>
                                    </span>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                      {sorted.map((u) => {
                                        const currentRetail = item.retailPriceOverrides[u.id] ?? (u.retailPrice || 0);
                                        return (
                                          <div key={u.id} className="bg-white p-2.5 rounded-xl border border-teal-200/80 shadow-2xs">
                                            <span className="text-[10.5px] font-bold text-slate-600 block mb-1">
                                              {u.unitName} ({u.multiplier} {item.product.baseUnit}):
                                            </span>
                                            <div className="relative">
                                              <input
                                                type="text"
                                                value={formatDots(currentRetail)}
                                                onChange={(e) => onUpdateItemRetailPrice(idx, u.id, e.target.value)}
                                                className="w-full pr-5 pl-2 py-1 text-xs font-mono font-bold border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                              />
                                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                                                ₭
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ======================================================== */}
                {/* MOBILE HIGH-DENSITY CARD ROWS (< 1024px, block lg:hidden) */}
                {/* ======================================================== */}
                <div className="block lg:hidden p-3 space-y-2.5">
                  {grnCartItems.map((item, idx) => {
                    const prodUnits = (item.product.units || []).filter((u) => u.isActive !== false);
                    const sorted = [...prodUnits].sort((a, b) => (b.multiplier || 1) - (a.multiplier || 1));
                    const lineTotalLak = (Number(item.quantity) || 0) * parseDots(item.costLak);
                    const lineTotalThb = (Number(item.quantity) || 0) * parseThb(item.costThb);

                    return (
                      <div
                        key={`${item.product.id}-${item.unitId}-${idx}`}
                        className="rounded-2xl border border-slate-200/80 p-3 mb-2.5 shadow-sm bg-white flex flex-col gap-2.5"
                      >
                        {/* Row 1: Bold Product Name + Delete button */}
                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                          <div className="min-w-0 flex items-center gap-2">
                            {item.product.imageUrl || item.product.image_url ? (
                              <img
                                src={item.product.imageUrl || item.product.image_url}
                                alt={item.product.name}
                                className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                <Package size={14} />
                              </div>
                            )}
                            <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                              {item.product.name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              (ສະຕັອກ: {getProductHighestStockDisplay(item.product)})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(idx)}
                            className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-all active:scale-95 shrink-0"
                            title="ລຶບລາຍການ"
                          >
                            <X size={15} weight="bold" />
                          </button>
                        </div>

                        {/* Row 2: Unit Dropdown + Large Touch Stepper Buttons [-] [Qty] [+] */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <select
                              value={item.unitId}
                              onChange={(e) => onUpdateItemUnit(idx, e.target.value)}
                              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                            >
                              {sorted.length > 0 ? (
                                sorted.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.unitName}
                                  </option>
                                ))
                              ) : (
                                <option value="base">{item.product.baseUnit || 'ອັນ'}</option>
                              )}
                            </select>
                          </div>

                          {/* Touch Quantity Stepper (>= 44x44px) */}
                          <GrnQuantityStepper
                            size="lg"
                            quantity={item.quantity}
                            onUpdateQuantity={(newQty) => onUpdateItemQuantity(idx, newQty)}
                            onStepQuantity={(delta) => onStepItemQuantity(idx, delta)}
                          />
                        </div>

                        {/* Row 3: Cost THB & Cost LAK with Dual Mode Toggle */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-bold text-slate-500">
                              ຕົ້ນທຶນຮັບເຂົ້າ
                            </span>
                            <button
                              type="button"
                              onClick={() => onToggleItemCostMode?.(idx)}
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                                item.isManualMode
                                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                                  : 'bg-teal-50 border-teal-200 text-teal-700'
                              }`}
                            >
                              {item.isManualMode ? (
                                <>
                                  <LinkBreak size={11} weight="bold" />
                                  <span>ແຍກປ້ອນ</span>
                                </>
                              ) : (
                                <>
                                  <Link size={11} weight="bold" />
                                  <span>ອັດຕະໂນມັດ</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                              <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                                ຕົ້ນທຶນ ฿
                              </label>
                              <input
                                type="text"
                                value={item.costThb}
                                onChange={(e) => onUpdateItemCostThb(idx, e.target.value)}
                                className={`w-full pr-5 pl-2.5 py-1.5 bg-slate-50 border rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white ${
                                  item.isManualMode ? 'border-amber-300' : 'border-slate-200'
                                }`}
                                placeholder="0"
                              />
                              <span className="absolute right-2 bottom-2 text-xs text-slate-400 font-bold">
                                ฿
                              </span>
                            </div>

                            <div className="relative">
                              <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                                ຕົ້ນທຶນ ₭
                              </label>
                              <input
                                type="text"
                                value={item.costLak}
                                onChange={(e) => onUpdateItemCostLak(idx, e.target.value)}
                                className={`w-full pr-5 pl-2.5 py-1.5 bg-slate-50 border rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white ${
                                  item.isManualMode ? 'border-amber-300' : 'border-slate-200'
                                }`}
                                placeholder="0"
                              />
                              <span className="absolute right-2 bottom-2 text-xs text-slate-400 font-bold">
                                ₭
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Row 4: Line Total + Retail Price Accordion Toggle */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                          <div>
                            <span className="text-[11px] text-slate-500 font-medium">ລວມ: </span>
                            <span className="font-mono font-black text-teal-700 text-sm">
                              {formatKip(lineTotalLak)}
                            </span>
                            {lineTotalThb > 0 && (
                              <span className="text-[10.5px] font-mono font-bold text-slate-400 ml-1">
                                ({formatThb(lineTotalThb)} ฿)
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => onToggleItemRetail(idx)}
                            className="text-[11px] font-bold text-teal-700 hover:text-teal-800 bg-teal-50 px-2 py-1 rounded-lg border border-teal-200 flex items-center gap-1 active:scale-95"
                          >
                            <PencilSimple size={13} weight="bold" />
                            <span>{item.isRetailOpen ? 'ປິດລາຄາ' : 'ປັບລາຄາຂາຍ'}</span>
                          </button>
                        </div>

                        {/* Row 5: Accordion Content for Retail Price Overrides */}
                        {item.isRetailOpen && (
                          <div className="bg-teal-50/50 p-2.5 rounded-xl border border-teal-200/80 space-y-2 mt-1">
                            <span className="text-[10.5px] font-bold text-teal-900 block">
                              ປັບລາຄາຂາຍໜ້າຮ້ານ ({item.product.name}):
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              {sorted.map((u) => {
                                const currentRetail = item.retailPriceOverrides[u.id] ?? (u.retailPrice || 0);
                                return (
                                  <div key={u.id} className="bg-white p-2 rounded-lg border border-teal-200">
                                    <span className="text-[10px] font-bold text-slate-600 block mb-0.5 truncate">
                                      {u.unitName} ({u.multiplier} {item.product.baseUnit})
                                    </span>
                                    <input
                                      type="text"
                                      value={formatDots(currentRetail)}
                                      onChange={(e) => onUpdateItemRetailPrice(idx, u.id, e.target.value)}
                                      className="w-full px-2 py-1 text-xs font-mono font-bold border border-slate-200 rounded-md text-slate-900 focus:outline-none"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ============================================================ */}
          {/* CARD 4: ຍອດລວມຕົ້ນທຶນ & ການຊຳລະເງິນ (TOTAL COST & PAYMENT) */}
          {/* ============================================================ */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col gap-3">
            {/* Header with Single Dual Mode Toggle Button */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                  <Coins size={18} weight="duotone" />
                </div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider truncate">
                  4. ຍອດລວມຕົ້ນທຶນ & ການຊຳລະເງິນ (Total Cost & Payment)
                </h3>
              </div>

              {/* Single Switch Button: [ Link ໄລ່ອັດຕະໂນມັດ / LinkBreak ແກ້ໄຂແຍກ ] */}
              <button
                type="button"
                onClick={handleToggleTotalCostMode}
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 shadow-2xs ${
                  !isManualMode
                    ? 'bg-teal-50 border-teal-300 text-teal-800 hover:bg-teal-100'
                    : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                }`}
                title={!isManualMode ? 'ໂໝດໄລ່ອັດຕະໂນມັດ: ຄລິກເພື່ອປ່ຽນເປັນໂໝດແກ້ໄຂແຍກ' : 'ໂໝດແກ້ໄຂແຍກ: ຄລິກເພື່ອປ່ຽນກັບຄືນໂໝດໄລ່ອັດຕະໂນມັດ'}
              >
                {!isManualMode ? (
                  <>
                    <Link size={15} weight="bold" />
                    <span>ໄລ່ອັດຕະໂນມັດ</span>
                  </>
                ) : (
                  <>
                    <LinkBreak size={15} weight="bold" />
                    <span>ແກ້ໄຂແຍກ</span>
                  </>
                )}
              </button>
            </div>

            {/* A. Dual-Mode Total Cost Section: 2 columns in single row on sm+, stacked on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Column 1: Total LAK */}
              <div
                className={`p-2.5 sm:p-3 rounded-xl border transition-all ${
                  isManualMode
                    ? 'bg-amber-50/20 border-amber-400 ring-1 ring-amber-400/20'
                    : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 truncate">
                    <span>ຍອດລວມ K (LAK)</span>
                    {isManualMode ? (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                        <PencilSimple size={11} weight="bold" />
                        <span>ປັບແກ້ໄຂເອງ</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-100/70 border border-teal-200 px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                        <Lightning size={11} weight="fill" />
                        <span>ໄລ່ອັດຕະໂນມັດ (Auto)</span>
                      </span>
                    )}
                  </label>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={isManualMode && isManualTotalLak ? manualTotalLakInput : (autoTotalLak > 0 ? formatDots(autoTotalLak) : '0')}
                    onChange={(e) => handleManualTotalLakChange(e.target.value)}
                    className={`w-full h-10 sm:h-11 pl-3 pr-8 bg-white rounded-xl text-base sm:text-lg font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 tabular-nums shadow-2xs border ${
                      isManualMode ? 'border-amber-400' : 'border-slate-300'
                    }`}
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs">
                    ₭
                  </span>
                </div>

                {isManualMode && (effectiveTotalLak - autoTotalLak !== 0) && (
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between font-mono">
                    <span>ລວມສິນຄ້າ: {formatDots(autoTotalLak)} ₭</span>
                    <span className="font-bold text-amber-700">
                      {effectiveTotalLak - autoTotalLak >= 0 ? '+' : ''}
                      {formatDots(effectiveTotalLak - autoTotalLak)} ₭
                    </span>
                  </div>
                )}
              </div>

              {/* Column 2: Total THB */}
              <div
                className={`p-2.5 sm:p-3 rounded-xl border transition-all ${
                  isManualMode
                    ? 'bg-amber-50/20 border-amber-400 ring-1 ring-amber-400/20'
                    : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 truncate">
                    <span>ຍອດລວມ ฿ (THB)</span>
                    {isManualMode ? (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                        <PencilSimple size={11} weight="bold" />
                        <span>ປັບແກ້ໄຂເອງ</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-100/70 border border-teal-200 px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                        <Lightning size={11} weight="fill" />
                        <span>ໄລ່ອັດຕະໂນມັດ (Auto)</span>
                      </span>
                    )}
                  </label>
                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                    1 ฿ = {formatDots(currentExchangeRate)} ₭
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={
                      isManualMode && isManualTotalThb
                        ? manualTotalThbInput
                        : (effectiveTotalThb > 0 ? formatDots(effectiveTotalThb) : '0')
                    }
                    onChange={(e) => handleManualTotalThbChange(e.target.value)}
                    className={`w-full h-10 sm:h-11 pl-3 pr-8 bg-white rounded-xl text-base sm:text-lg font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 tabular-nums shadow-2xs border ${
                      isManualMode ? 'border-amber-400' : 'border-slate-300'
                    }`}
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs">
                    ฿
                  </span>
                </div>

                {isManualMode && (effectiveTotalThb - autoTotalThb !== 0) && (
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between font-mono">
                    <span>ລວມສິນຄ້າ: {formatDots(autoTotalThb)} ฿</span>
                    <span className="font-bold text-amber-700">
                      {effectiveTotalThb - autoTotalThb >= 0 ? '+' : ''}
                      {formatDots(effectiveTotalThb - autoTotalThb)} ฿
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* B. Segmented Control / Tabs for Payment Status */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 block">
                ຮູບແບບການຊຳລະເງິນ & ໜີ້ສິນ (Payment Status):
              </label>

              {/* Segmented Tab Bar */}
              <div className="flex items-center p-1 bg-slate-100/90 border border-slate-200/80 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setLocalPaymentStatus('PAID')}
                  className={`flex-1 h-9 sm:h-10 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 ${
                    localPaymentStatus === 'PAID'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <CheckCircle size={15} weight="bold" />
                  <span>ຈ່າຍຄົບ (PAID)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLocalPaymentStatus('DEBT')}
                  className={`flex-1 h-9 sm:h-10 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 ${
                    localPaymentStatus === 'DEBT'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <WarningCircle size={15} weight="bold" />
                  <span>ຕິດໜີ້ (DEBT)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLocalPaymentStatus('PARTIAL');
                    if (parseDots(advancePaidInput) === 0) {
                      setAdvancePaidInput(formatDots(Math.round(effectiveTotalLak / 2)));
                    }
                  }}
                  className={`flex-1 h-9 sm:h-10 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 ${
                    localPaymentStatus === 'PARTIAL'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <HandCoins size={15} weight="bold" />
                  <span>ຈ່າຍບາງສ່ວນ (PARTIAL)</span>
                </button>
              </div>

              {/* If PARTIAL: Compact Dropdown for Advance Paid & Remaining Debt */}
              {localPaymentStatus === 'PARTIAL' && (
                <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                  <div>
                    <label className="text-[11px] font-bold text-amber-900 block mb-1">
                      ຈຳນວນເງິນຈ່າຍກ່ອນ (Advance Paid):
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={advancePaidInput}
                        onChange={(e) => setAdvancePaidInput(formatDots(parseDots(e.target.value)))}
                        className="w-full h-9 pl-3 pr-8 bg-white border border-amber-300 rounded-lg text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                        placeholder="0"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs">
                        ₭
                      </span>
                    </div>
                  </div>

                  <div className="p-2 bg-white/90 border border-amber-200 rounded-lg flex items-center justify-between sm:flex-col sm:items-start sm:justify-center">
                    <span className="text-[10.5px] font-bold text-slate-500">
                      ຍອດໜີ້ຄ້າງຊຳລະ (Remaining Debt):
                    </span>
                    <span className="text-sm sm:text-base font-mono font-black text-rose-600">
                      {formatKip(effectiveDebtAmountLak)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* C. Reconciliation Summary Bar & Prominent Submit Button */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-bold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px]">ຍອດລວມ:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm sm:text-base">
                    {formatKip(effectiveTotalLak)}
                  </span>
                </div>
                <span className="text-slate-300">•</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px]">ຊຳລະແລ້ວ:</span>
                  <span className="font-mono font-bold text-teal-700 text-sm sm:text-base">
                    {formatKip(effectivePaidAmountLak)}
                  </span>
                </div>
                {effectiveDebtAmountLak > 0 && (
                  <>
                    <span className="text-slate-300">•</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-rose-400 text-[11px]">ຍອດຄ້າງ:</span>
                      <span className="font-mono font-black text-rose-600 text-sm sm:text-base">
                        {formatKip(effectiveDebtAmountLak)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={handleSaveGRN}
                disabled={isSubmittingGRN || grnCartItems.length === 0}
                className="w-full sm:w-auto h-11 px-6 sm:px-8 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs sm:text-sm rounded-xl shadow-md shadow-teal-700/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <FloppyDisk size={18} weight="bold" />
                <span>{isSubmittingGRN ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກໃບຮັບສິນຄ້າ (Save GRN)'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal Component */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
        title="ສະແກນບາໂຄດສິນຄ້າຮັບເຂົ້າສາງ"
      />
    </div>
  );
}
