import React, { useState, useEffect } from 'react';
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
} from '@phosphor-icons/react';
import {
  formatKip,
  formatDots,
  parseDots,
  formatThb,
  parseThb,
  formatThbTyping,
  formatCompoundStockUnits,
  normalizeLao,
} from '../../utils/formatters';
import { createPurchaseOrderInSupabase } from '../../services/supabase';
import { queryClient } from '../../services/queryClient';
import BarcodeScannerModal from '../BarcodeScannerModal';
import { useHardwareBarcodeScanner } from '../../hooks/useHardwareBarcodeScanner';
import { playSuccessBeep, playErrorBeep } from '../../utils/audioFeedback';

export default function PurchaseEntryModal({
  isOpen,
  onClose,
  products = [],
  suppliers = [],
  onOpenSupplierManager,
  onSuccess,
  onAlert,
}) {
  // Box 1: Supplier & Receiver
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [receivedBy, setReceivedBy] = useState('ໄມ້ຄຳ (Meii)');

  // Box 2: Selected Product & Multi-Tier Inputs
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  // Dynamic Map of Quantities by Unit ID { [unitId]: number }
  const [unitQuantities, setUnitQuantities] = useState({});
  const [costThb, setCostThb] = useState('0');
  const [costLak, setCostLak] = useState('0');
  const [retailPriceOverrides, setRetailPriceOverrides] = useState({});

  // Box 3: Total Costs (2 Currencies: LAK & THB) & Accounts Payable
  const [totalCostLak, setTotalCostLak] = useState('0');
  const [totalCostThb, setTotalCostThb] = useState('0');

  const [paymentStatus, setPaymentStatus] = useState('PAID'); // 'PAID', 'PARTIAL', 'DEBT'
  const [paidAmount, setPaidAmount] = useState('0');
  const [debtAmount, setDebtAmount] = useState(0);
  const [note, setNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State Reset / Cleanup
  const resetGRNFormState = () => {
    setSelectedProductId('');
    setProductSearch('');
    setUnitQuantities({});
    setCostThb('0');
    setCostLak('0');
    setRetailPriceOverrides({});
    setTotalCostLak('0');
    setTotalCostThb('0');
    setPaymentStatus('PAID');
    setPaidAmount('0');
    setDebtAmount(0);
    setNote('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetGRNFormState();
    onClose?.();
  };

  // Requirement A: Cleanup on Unmount / When Dialog is Closed
  useEffect(() => {
    if (!isOpen) {
      resetGRNFormState();
    }
    return () => {
      resetGRNFormState();
    };
  }, [isOpen]);

  // Requirement B: Fresh Data Re-fetch & Re-sync
  // When products array changes (e.g. user edited product details elsewhere and returned),
  // re-sync the selected product's costs, stock & retail prices to the latest 100% fresh data.
  useEffect(() => {
    if (isOpen && selectedProductId) {
      const latestProduct = products.find((p) => p.id === selectedProductId);
      if (latestProduct) {
        setCostThb(latestProduct.costBaht > 0 ? formatThb(latestProduct.costBaht) : '0');
        setCostLak(latestProduct.costKip > 0 ? formatDots(latestProduct.costKip) : '0');

        const prodUnits = (latestProduct.units || []).filter((u) => u.isActive !== false);
        setRetailPriceOverrides((prev) => {
          const updated = {};
          prodUnits.forEach((u) => {
            updated[u.id] = prev[u.id] !== undefined ? prev[u.id] : (u.retailPrice || 0);
          });
          return updated;
        });

        setUnitQuantities((prev) => {
          const updated = {};
          prodUnits.forEach((u) => {
            updated[u.id] = prev[u.id] || 0;
          });
          return updated;
        });
      } else {
        // Product no longer exists in updated products list
        resetGRNFormState();
      }
    }
  }, [isOpen, selectedProductId, products]);

  // Initialize Default Supplier
  useEffect(() => {
    if (isOpen) {
      if (suppliers.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(suppliers[0].id);
      }
    }
  }, [isOpen, suppliers, selectedSupplierId]);

  // Selected Product Reference & Fixed Hierarchy Sorting (Largest to Smallest Multiplier)
  const selectedProduct = products.find((p) => p.id === selectedProductId) || null;
  const activeUnits = (selectedProduct?.units || []).filter((u) => u.isActive !== false);
  const sortedUnits = [...activeUnits].sort((a, b) => (b.multiplier || 1) - (a.multiplier || 1));

  // Hydrate Product Data into Form When Product is Picked
  const handleSelectProduct = (prodId) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    // Reset Quantities (Default to 0 per spec - DO NOT PRE-FILL CURRENT STOCK)
    const prodUnits = (prod.units || []).filter((u) => u.isActive !== false);
    const sorted = [...prodUnits].sort((a, b) => (b.multiplier || 1) - (a.multiplier || 1));
    const initialQty = {};
    sorted.forEach((u) => {
      initialQty[u.id] = 0;
    });
    setUnitQuantities(initialQty);

    // Pre-fill Cost as is (no multiplier modification) with THB formatting
    setCostThb(prod.costBaht > 0 ? formatThb(prod.costBaht) : '0');
    setCostLak(prod.costKip > 0 ? formatDots(prod.costKip) : '0');

    // Pre-fill Retail Prices
    const initialRetail = {};
    sorted.forEach((u) => {
      initialRetail[u.id] = u.retailPrice || 0;
    });
    setRetailPriceOverrides(initialRetail);

    // Initial Total Calculation
    setTotalCostLak('0');
    setTotalCostThb('0');
    setPaidAmount('0');
    setDebtAmount(0);
  };

  // Calculate Imported Base Units
  const importedBaseUnits = sortedUnits.reduce((sum, u) => {
    const q = unitQuantities[u.id] || 0;
    return sum + q * (u.multiplier || 1);
  }, 0);

  // Auto Recalculate Totals
  const recalcTotals = (currentQuantities, cLakStr, cThbStr, pStatus) => {
    const bUnits = sortedUnits.reduce((sum, u) => {
      const q = currentQuantities[u.id] || 0;
      return sum + q * (u.multiplier || 1);
    }, 0);

    const m = (sortedUnits[0]?.multiplier && sortedUnits[0].multiplier > 0) ? sortedUnits[0].multiplier : 1;
    const cLakNum = parseDots(cLakStr);
    const cThbNum = parseThb(cThbStr);

    const calcLak = Math.round((cLakNum / m) * bUnits);
    const calcThb = (cThbNum / m) * bUnits;

    setTotalCostLak(formatDots(calcLak));
    setTotalCostThb(formatThb(calcThb));

    if (pStatus === 'PAID') {
      setPaidAmount(formatDots(calcLak));
      setDebtAmount(0);
    } else if (pStatus === 'DEBT') {
      setPaidAmount('0');
      setDebtAmount(calcLak);
    } else {
      const currentPaid = parseDots(paidAmount);
      setDebtAmount(Math.max(0, calcLak - currentPaid));
    }
  };

  // Normalization Rule: Pack count exceeds carton ratio -> auto roll over into cartons
  const handleUnitQtyChange = (unit, val, index) => {
    let count = Math.max(0, parseInt(val, 10) || 0);
    const next = { ...unitQuantities };

    // If typing in C2 and C1 exists, and C2 exceeds ratio -> auto rollover into C1
    if (index === 1 && sortedUnits.length >= 2) {
      const c1 = sortedUnits[0];
      const ratio = Math.round((c1.multiplier || 1) / (unit.multiplier || 1));
      if (ratio > 1 && count >= ratio) {
        const extraC1 = Math.floor(count / ratio);
        const remC2 = count % ratio;
        next[c1.id] = (next[c1.id] || 0) + extraC1;
        next[unit.id] = remC2;
        setUnitQuantities(next);
        recalcTotals(next, costLak, costThb, paymentStatus);
        return;
      }
    }

    next[unit.id] = count;
    setUnitQuantities(next);
    recalcTotals(next, costLak, costThb, paymentStatus);
  };

  const handleCostLakChange = (val) => {
    const raw = parseDots(val);
    const formatted = formatDots(raw);
    setCostLak(formatted);
    recalcTotals(unitQuantities, formatted, costThb, paymentStatus);
  };

  const handleCostThbChange = (val) => {
    const formatted = formatThbTyping(val);
    setCostThb(formatted);
    recalcTotals(unitQuantities, costLak, formatted, paymentStatus);
  };

  const handlePaymentStatusClick = (status) => {
    setPaymentStatus(status);
    const totalLak = parseDots(totalCostLak);
    if (status === 'PAID') {
      setPaidAmount(formatDots(totalLak));
      setDebtAmount(0);
    } else if (status === 'DEBT') {
      setPaidAmount('0');
      setDebtAmount(totalLak);
    } else {
      // PARTIAL
      const half = Math.round(totalLak / 2);
      setPaidAmount(formatDots(half));
      setDebtAmount(totalLak - half);
    }
  };

  const handlePaidAmountChange = (val) => {
    const paidNum = parseDots(val);
    setPaidAmount(formatDots(paidNum));
    const totalLak = parseDots(totalCostLak);
    setDebtAmount(Math.max(0, totalLak - paidNum));
  };

  // Barcode scanned callback
  const handleBarcodeScanned = (scannedCode) => {
    setScannerOpen(false);
    if (!scannedCode) return;
    const trimmed = scannedCode.trim().toLowerCase();
    const matched = products.find((p) => {
      if (p.barcode && p.barcode.toLowerCase() === trimmed) return true;
      if (p.units && p.units.some((u) => u.barcode && u.barcode.toLowerCase() === trimmed)) return true;
      return false;
    });

    if (matched) {
      handleSelectProduct(matched.id);
      playSuccessBeep();
      onAlert?.(`ພົບສິນຄ້າ: ${matched.name}`, 'ສະແກນສຳເລັດ', 'success');
    } else {
      playErrorBeep();
      onAlert?.(`ບໍ່ພົບສິນຄ້າທີ່ມີ Barcode "${scannedCode}"`, 'ແຈ້ງເຕືອນ', 'warning');
    }
  };

  // Hardware barcode scanner support inside single purchase entry modal
  useHardwareBarcodeScanner({
    onScan: handleBarcodeScanned,
    enabled: isOpen,
    maxInterval: 50,
    minLength: 3,
    preventDefaultOnEnter: true,
    cleanActiveInput: true,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId || !selectedProduct) {
      onAlert?.('ກະລຸນາເລືອກສິນຄ້າທີ່ຕ້ອງການຮັບເຂົ້າສາງ!', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    if (importedBaseUnits <= 0) {
      onAlert?.('ກະລຸນາປ້ອນຈຳນວນຮັບເຂົ້າສາງ (> 0)!', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const m = (sortedUnits[0]?.multiplier && sortedUnits[0].multiplier > 0) ? sortedUnits[0].multiplier : 1;
      const cLakNum = parseDots(costLak);
      const costPerBaseUnit = Math.round(cLakNum / m);

      const tier1Qty = sortedUnits.length > 0 ? (unitQuantities[sortedUnits[0].id] || 0) : 0;
      const tier2Qty = sortedUnits.length > 1 ? (unitQuantities[sortedUnits[1].id] || 0) : 0;
      const tier3Qty = sortedUnits.length > 2 ? (unitQuantities[sortedUnits[2].id] || 0) : 0;

      const singleDraft = {
        product: selectedProduct,
        tier1Qty,
        tier2Qty,
        tier3Qty,
        importedBaseUnits,
        costPerBaseUnit,
        costThb: parseThb(costThb),
        costLak: cLakNum,
        costVnd: 0,
        retailPriceOverrides,
      };

      const poData = {
        supplierId: selectedSupplierId || null,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        importedBaseUnits,
        tier1Qty,
        tier2Qty,
        tier3Qty,
        costThb: parseThb(costThb),
        costLak: cLakNum,
        costPerBaseUnit,
        totalCostLak: parseDots(totalCostLak),
        totalCostThb: parseThb(totalCostThb),
        totalCostVnd: 0,
        paidAmount: parseDots(paidAmount),
        debtAmount,
        paymentStatus,
        receivedBy: receivedBy.trim() || 'ໄມ້ຄຳ (Meii)',
        note,
      };

      const res = await createPurchaseOrderInSupabase(poData, [singleDraft]);
      if (res.success) {
        const prodName = selectedProduct?.name || 'ສິນຄ້າ';
        handleClose();
        onAlert?.(
          `ບັນທຶກຮັບສິນຄ້າ "${prodName}" ເຂົ້າສາງ & ອັບເດດລາຄາສຳເລັດແລ້ວ!`,
          'ສຳເລັດ',
          'success'
        );
        // Cache Invalidation per enterprise requirement:
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['products'] }),
          queryClient.invalidateQueries({ queryKey: ['purchase_orders'] }),
          queryClient.invalidateQueries({ queryKey: ['inventory_movements'] }),
          queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        ]);
        await onSuccess?.();
      } else {
        onAlert?.(res.error || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ', 'ຂໍ້ຜິດພາດ', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Filter products for the searchable picker
  const filteredProducts = products.filter((p) => {
    const q = normalizeLao(productSearch);
    if (!q) return true;
    return (
      normalizeLao(p.name).includes(q) ||
      normalizeLao(p.category).includes(q) ||
      normalizeLao(p.barcode).includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-150 select-none font-sans">
      {/* ============================================================== */}
      {/* 1. FULLSCREEN TOP HEADER                                       */}
      {/* ============================================================== */}
      <header className="bg-white border-b border-slate-200/90 px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-xs z-10">
        {/* Left Side: Back Button, Title, Badge & Subtitle */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={handleClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="ກັບຄືນ"
          >
            <ArrowLeft size={18} weight="bold" />
          </button>
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex flex-wrap items-center gap-2">
              <span>ສ້າງໃບຮັບສິນຄ້າເຂົ້າສາງ (Goods Receipt Note - GRN)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                Single-Product Entry
              </span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1">
              ນຳເຂົ້າສິນຄ້າລາຍການດຽວ, ຕົ້ນທຶນບາດ-ກີບ, ສະຕັອກບວກເພີ່ມ & ຈັດການໜີ້ສິນຜູ້ສະໜອງ
            </p>
          </div>
        </div>

        {/* Right Side: Secondary Cancel Button & Primary Save Button */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 sm:px-4 py-2 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs"
          >
            ຍົກເລີກ
          </button>
          <button
            type="submit"
            form="grn-fullscreen-form"
            disabled={isSubmitting}
            className="px-4 sm:px-5 py-2.5 bg-[#0D9488] hover:bg-[#0f766e] text-white font-black text-xs rounded-lg shadow-md shadow-teal-700/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <FloppyDisk size={16} weight="bold" />
            <span>{isSubmitting ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກໃບຮັບສິນຄ້າເຂົ້າສາງ'}</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. FULLSCREEN SCROLLABLE BODY (3 CONTAINER CARDS)               */}
      {/* ============================================================== */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        <form
          id="grn-fullscreen-form"
          onSubmit={handleSubmit}
          className="max-w-6xl mx-auto space-y-6"
        >
          {/* ============================================================ */}
          {/* CARD 1: ຂໍ້ມູນແຫຼ່ງສະໜອງ & ຜູ້ຮັບສິນຄ້າ (Supplier & Receiver Info) */}
          {/* ============================================================ */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700">
                <Truck size={18} weight="duotone" />
              </div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                CARD 1: ຂໍ້ມູນແຫຼ່ງສະໜອງ & ຜູ້ຮັບສິນຄ້າ (Supplier & Receiver Info)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Supplier Selector with + ຈັດການຮ້ານສົ່ງ */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    ຮ້ານສົ່ງ / ແຫຼ່ງນຳເຂົ້າ (Supplier) *
                  </label>
                  <button
                    type="button"
                    onClick={onOpenSupplierManager}
                    className="text-[11px] text-teal-700 hover:text-teal-800 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} weight="bold" />
                    <span>+ ຈັດການຮ້ານສົ່ງ</span>
                  </button>
                </div>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs"
                >
                  <option value="">-- ເລືອກຮ້ານສົ່ງ / ແຫຼ່ງນຳເຂົ້າ --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(ໂທ: ${s.phone})` : ''} {s.contact_person ? `• ${s.contact_person}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Right Column: Received by User */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1.5">
                  ຜູ້ຮັບສິນຄ້າເຂົ້າສາງ (Received by)
                </label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="ໄມ້ຄຳ (Meii)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* CARD 2: ຂໍ້ມູນສິນຄ້າ, ຕົ້ນທຶນ & ຈຳນວນຮັບເຂົ້າ (Product, Cost & Stock Summing) */}
          {/* ============================================================ */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700">
                  <Package size={18} weight="duotone" />
                </div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  CARD 2: ຂໍ້ມູນສິນຄ້າ, ຕົ້ນທຶນ & ຈຳນວນຮັບເຂົ້າ (Product, Cost & Stock Summing)
                </h3>
              </div>

              {/* Current Stock Badge */}
              {selectedProduct && (
                <div className="px-3 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-lg text-xs font-bold font-mono">
                  ສະຕັອກປະຈຸບັນ: {selectedProduct.currentStockBaseUnits || 0} {selectedProduct.baseUnit || 'ອັນ'}
                </div>
              )}
            </div>

            {/* Product Selector with Camera Scan & Filter */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>ເລືອກສິນຄ້າທີ່ຕ້ອງການຮັບເຂົ້າສາງ (Select Product) *</span>
                <span className="text-[11px] font-normal text-slate-500">
                  ຄົ້ນຫາຊື່ສິນຄ້າ, ໝວດໝູ່ ຫຼື ສະແກນ Barcode
                </span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                {/* Search Text Filter */}
                <div className="md:col-span-4 relative">
                  <MagnifyingGlass size={15} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="ພິມຊື່ ຫຼື ບາໂຄ້ດເພື່ອຄົ້ນຫາ..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-2xs"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Product Select Dropdown */}
                <div className="md:col-span-7">
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleSelectProduct(e.target.value)}
                    className="w-full px-3 py-2 bg-teal-50/50 hover:bg-teal-50 border border-teal-200 rounded-xl text-xs font-bold text-teal-950 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer shadow-2xs"
                  >
                    <option value="">-- ກົດເພື່ອເລືອກສິນຄ້າ ({filteredProducts.length} ລາຍການ) --</option>
                    {filteredProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category || 'ທົ່ວໄປ'}) {p.barcode ? `• Barcode: ${p.barcode}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Barcode Camera Scanner Button */}
                <div className="md:col-span-1">
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="w-full h-full min-h-[36px] bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 border border-slate-200 hover:border-teal-300 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                    title="ສະແກນ Barcode ດ້ວຍກ້ອງ"
                  >
                    <Camera size={18} weight="bold" />
                  </button>
                </div>
              </div>
            </div>

            {selectedProduct ? (
              <div className="flex flex-col gap-5 pt-2">
                {/* 1. Stock Input Boxes (Only active units, always start at 0, live summing) */}
                <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-800">
                      ຈຳນວນຮັບເຂົ້າສາງ (ປ້ອນຈຳນວນທີ່ນຳເຂົ້າໃໝ່ - ບໍ່ນັບສະຕັອກເກົ່າ):
                    </span>
                    <span className="text-[10.5px] text-slate-500 italic">
                      * ຖ້າປ້ອນແພັກເກີນອັດຕາສ່ວນ ລະບົບຈະປັບເປັນລັງອັດຕະໂນມັດ
                    </span>
                  </div>

                  <div className={`grid gap-3 ${
                    sortedUnits.length === 1
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : sortedUnits.length === 2
                      ? 'grid-cols-1 sm:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-4'
                  }`}>
                    {sortedUnits.map((u, idx) => {
                      const isBase = u.isBaseUnit || u.multiplier === 1 || idx === sortedUnits.length - 1;
                      return (
                        <div
                          key={u.id}
                          className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-800">
                              {u.unitName} (C{idx + 1})
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {isBase ? 'Base' : `1x${u.multiplier}`}
                            </span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={unitQuantities[u.id] ?? 0}
                            onChange={(e) => handleUnitQtyChange(u, e.target.value, idx)}
                            className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-base font-mono font-black text-center text-slate-900 focus:bg-white focus:border-teal-500 focus:outline-none"
                          />
                        </div>
                      );
                    })}

                    {/* Live Summing Box (Compound format based on highest unit) */}
                    <div className="bg-teal-50 border border-teal-200 p-3 rounded-xl flex flex-col justify-center items-center shadow-2xs text-center">
                      <span className="text-[10.5px] text-teal-800 font-bold uppercase tracking-wider">
                        ຍອດບວກເພີ່ມເຂົ້າສາງ
                      </span>
                      <span className="text-base font-black text-teal-700 font-mono mt-0.5">
                        +{formatCompoundStockUnits(importedBaseUnits, sortedUnits)}
                      </span>
                      <span className="text-[10.5px] text-teal-600 font-medium mt-0.5">
                        ລວມສະຕັອກໃໝ່ທັງໝົດ: {formatCompoundStockUnits((selectedProduct.currentStockBaseUnits || 0) + importedBaseUnits, sortedUnits)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Cost Breakdown (THB & LAK) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      ຕົ້ນທຶນ ฿ (THB) / ຍົກລັງ
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={costThb}
                        onChange={(e) => handleCostThbChange(e.target.value)}
                        placeholder="250"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 pr-8 shadow-2xs"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">฿</span>
                    </div>
                  </div>

                  <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      ຕົ້ນທຶນ ₭ (LAK) / ຍົກລັງ *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={costLak}
                        onChange={(e) => handleCostLakChange(e.target.value)}
                        placeholder="280.000"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 pr-8 shadow-2xs"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">₭</span>
                    </div>
                  </div>
                </div>

                {/* 3. Retail Price Overrides */}
                {sortedUnits.length > 0 && (
                  <div className="border-t border-slate-100 pt-3 flex flex-col gap-2.5">
                    <span className="text-xs font-black text-slate-800">
                      ກວດສອບ & ປັບລາຄາຂາຍຍ່ອຍ (Retail Price Overrides):
                    </span>
                    <div className={`grid gap-3 ${
                      sortedUnits.length === 1
                        ? 'grid-cols-1'
                        : sortedUnits.length === 2
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-3'
                    }`}>
                      {sortedUnits.map((u, idx) => (
                        <div
                          key={u.id}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-1 shadow-2xs"
                        >
                          <span className="text-xs font-bold text-slate-700">
                            ລາຄາຂາຍ: {u.unitName} (C{idx + 1})
                          </span>
                          <div className="relative">
                            <input
                              type="text"
                              value={formatDots(retailPriceOverrides[u.id] ?? u.retailPrice ?? 0)}
                              onChange={(e) => {
                                const p = parseDots(e.target.value);
                                setRetailPriceOverrides((prev) => ({
                                  ...prev,
                                  [u.id]: p,
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right pr-7 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
                            <span className="absolute right-2.5 top-2 text-[11px] text-slate-400 font-bold">₭</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                ກະລຸນາເລືອກສິນຄ້າດ້ານເທິງເພື່ອເລີ່ມຕົ້ນປ້ອນຈຳນວນ ແລະ ລາຄາຮັບເຂົ້າສາງ.
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* CARD 3: ຍອດລວມຕົ້ນທຶນຊື້ & ຈັດການໜີ້ສິນ (Total Cost & AP)    */}
          {/* ============================================================ */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col gap-5">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700">
                <Coins size={18} weight="duotone" />
              </div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                CARD 3: ຍອດລວມຕົ້ນທຶນຊື້ & ຈັດການໜີ້ສິນ (Total Cost & Accounts Payable)
              </h3>
            </div>

            {/* 2 Independent Currency Inputs Row (Grid 2 cols: 50% - 50%) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50/80 p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-teal-300 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-teal-100 text-teal-800 font-black text-[11px] flex items-center justify-center">₭</span>
                    <span>ຍອດລວມ ₭ (LAK)</span>
                  </label>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    ເງິນກີບລາວ
                  </span>
                </div>
                <input
                  type="text"
                  value={totalCostLak}
                  onChange={(e) => {
                    const v = formatDots(parseDots(e.target.value));
                    setTotalCostLak(v);
                    if (paymentStatus === 'PAID') {
                      setPaidAmount(v);
                      setDebtAmount(0);
                    } else if (paymentStatus === 'DEBT') {
                      setDebtAmount(parseDots(v));
                    } else {
                      setDebtAmount(Math.max(0, parseDots(v) - parseDots(paidAmount)));
                    }
                  }}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-base sm:text-lg font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 shadow-2xs transition-all"
                />
              </div>

              <div className="bg-slate-50/80 p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-amber-300 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 font-black text-[11px] flex items-center justify-center">฿</span>
                    <span>ຍອດລວມ ฿ (THB)</span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    ເງິນບາດໄທ
                  </span>
                </div>
                <input
                  type="text"
                  value={totalCostThb}
                  onChange={(e) => setTotalCostThb(formatThbTyping(e.target.value))}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-base sm:text-lg font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 shadow-2xs transition-all"
                />
              </div>
            </div>

            {/* Segmented Payment Buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
              <span className="text-xs font-bold text-slate-700">ຮູບແບບການຊຳລະ:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePaymentStatusClick('PAID')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                    paymentStatus === 'PAID'
                      ? 'bg-[#0D9488] text-white border-[#0D9488] shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  ຈ່າຍຄົບ (PAID)
                </button>
                <button
                  type="button"
                  onClick={() => handlePaymentStatusClick('DEBT')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                    paymentStatus === 'DEBT'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  ຕິດໜີ້ (DEBT)
                </button>
                <button
                  type="button"
                  onClick={() => handlePaymentStatusClick('PARTIAL')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                    paymentStatus === 'PARTIAL'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  ຈ່າຍບາງສ່ວນ (PARTIAL)
                </button>
              </div>
            </div>

            {/* Dynamic Debt Calculation Area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  ຈຳນວນເງິນທີ່ຈ່າຍແລ້ວ (Paid Amount ₭)
                </label>
                <input
                  type="text"
                  disabled={paymentStatus !== 'PARTIAL'}
                  value={paidAmount}
                  onChange={(e) => handlePaidAmountChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-center text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 shadow-2xs"
                />
              </div>

              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between shadow-2xs transition-all ${
                  debtAmount > 0
                    ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                    : 'bg-teal-50/80 border-teal-200 text-teal-900'
                }`}
              >
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider block">
                    ຍອດໜີ້ຄ້າງຊຳລະ (DEBT BALANCE)
                  </span>
                  <span className="text-xs font-mono font-bold">
                    {debtAmount > 0 ? 'ຍັງຄ້າງຈ່າຍຜູ້ສະໜອງ' : 'ຊຳລະຄົບຖ້ວນ 100% (PAID)'}
                  </span>
                </div>
                <span
                  className={`text-lg font-black font-mono ${
                    debtAmount > 0 ? 'text-rose-600' : 'text-teal-700'
                  }`}
                >
                  {formatDots(debtAmount)} ₭
                </span>
              </div>
            </div>

            {/* Note Textarea */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                ໝາຍເຫດ (Note)
              </label>
              <textarea
                rows={3}
                placeholder="ຕົວຢ່າງ: ຄ່າສິນຄ້າຄ້າງຈ່າຍ, ນັດຊຳລະວັນທີ..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all shadow-2xs"
              />
            </div>
          </div>
        </form>
      </div>

      {/* Barcode Scanner Modal for camera scan */}
      {scannerOpen && (
        <BarcodeScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={handleBarcodeScanned}
        />
      )}
    </div>
  );
}
