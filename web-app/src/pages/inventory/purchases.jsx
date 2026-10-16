import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Truck,
  Receipt,
  MagnifyingGlass,
  Eye,
  HandCoins,
  ArrowClockwise,
  ArrowLeft,
  FloppyDisk,
  Coins,
  Barcode,
  Camera,
  X,
  CaretDown,
  Funnel,
  CheckCircle,
  WarningCircle,
  CurrencyCircleDollar,
  PencilSimple,
} from '@phosphor-icons/react';
import {
  formatKip,
  formatDots,
  parseDots,
  formatThb,
  parseThb,
  formatThbTyping,
  formatCompoundStockUnits,
} from '../../utils/formatters';
import {
  createPurchaseOrderInSupabase,
  updatePurchaseOrderInSupabase,
  addSupplierDebtPaymentInSupabase,
} from '../../services/supabase';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';

export default function PurchasesView({
  purchaseOrders = [],
  suppliers = [],
  products = [],
  onOpenNewGRN,
  onOpenSupplierManager,
  onRefresh,
  isLoading,
  onAlert,
}) {
  // Navigation State: 'LIST' (GRN History Table) or 'ENTRY' (Fullscreen 3-Card Form)
  const [viewMode, setViewMode] = useState('LIST');

  // Filter & Search State in LIST Mode
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'PAID' | 'PARTIAL' | 'DEBT'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals in LIST Mode
  const [selectedPoForDetails, setSelectedPoForDetails] = useState(null);
  const [payingPo, setPayingPo] = useState(null);
  const [repayAmount, setRepayAmount] = useState('0');
  const [repayMethod, setRepayMethod] = useState('CASH');
  const [repayNote, setRepayNote] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // =========================================================================
  // FULLSCREEN FORM STATE (PART 2)
  // =========================================================================
  // Card 1: Supplier & Receiver
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [receivedBy, setReceivedBy] = useState('ໄມ້ຄຳ (Meii)');

  // Card 2: Product & Dynamic Multi-Tier Inputs
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Dynamic Map of Quantities by Unit ID { [unitId]: number }
  const [unitQuantities, setUnitQuantities] = useState({});
  const [costThb, setCostThb] = useState('0');
  const [costLak, setCostLak] = useState('0');
  const [retailPriceOverrides, setRetailPriceOverrides] = useState({});

  // Card 3: Total Costs (2 Currencies: LAK & THB, NO VND) & Debt Management
  const [totalCostLak, setTotalCostLak] = useState('0');
  const [totalCostThb, setTotalCostThb] = useState('0');

  const [paymentStatus, setPaymentStatus] = useState('PAID'); // 'PAID' | 'PARTIAL' | 'DEBT'
  const [paidAmount, setPaidAmount] = useState('0');
  const [debtAmount, setDebtAmount] = useState(0);
  const [note, setNote] = useState('');

  const [editingPoId, setEditingPoId] = useState(null);
  const [isSubmittingGRN, setIsSubmittingGRN] = useState(false);

  // =========================================================================
  // 1.1. TOP KPI METRICS (CALCULATED FROM ORDERS)
  // =========================================================================
  const kpiMetrics = useMemo(() => {
    let totalLak = 0;
    let totalThb = 0;
    let totalDebt = 0;

    purchaseOrders.forEach((po) => {
      totalLak += Number(po.total_cost_lak) || 0;
      totalThb += Number(po.total_cost_thb) || 0;
      totalDebt += Number(po.debt_amount) || 0;
    });

    return {
      totalLak,
      totalThb,
      totalDebt,
      totalOrders: purchaseOrders.length,
    };
  }, [purchaseOrders]);

  // Filtered Orders for the Table
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (filterStatus !== 'ALL' && po.payment_status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = (po.id || '').toLowerCase().includes(q);
        const matchSupplier = (po.suppliers?.name || '').toLowerCase().includes(q);
        const matchReceived = (po.received_by || '').toLowerCase().includes(q);
        const matchProduct = (po.product_name || '').toLowerCase().includes(q) ||
          (po.purchase_order_items || []).some((it) => (it.product_name || '').toLowerCase().includes(q));
        return matchId || matchSupplier || matchReceived || matchProduct;
      }
      return true;
    });
  }, [purchaseOrders, filterStatus, searchQuery]);

  // =========================================================================
  // 2.3. STATE & LIFECYCLE MANAGEMENT (CLEANUP & RESET)
  // =========================================================================
  const resetGRNForm = () => {
    setEditingPoId(null);
    setSelectedProductId('');
    setProductSearch('');
    setIsProductDropdownOpen(false);
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
    setIsSubmittingGRN(false);
  };

  const handleBackToList = () => {
    resetGRNForm();
    setViewMode('LIST');
  };

  const handleOpenCreateGRN = () => {
    resetGRNForm();
    if (suppliers.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(suppliers[0].id);
    }
    setViewMode('ENTRY');
  };

  const handleEditPo = (po) => {
    resetGRNForm();
    setEditingPoId(po.id);
    setSelectedSupplierId(po.supplier_id || (suppliers[0]?.id || ''));
    setReceivedBy(po.received_by || 'ໄມ້ຄຳ (Meii)');

    const targetProd = products.find(
      (p) => p.id === po.product_id || p.name === po.product_name
    ) || (po.purchase_order_items && po.purchase_order_items[0] && products.find((p) => p.id === po.purchase_order_items[0].product_id));

    if (targetProd) {
      setSelectedProductId(targetProd.id);
      const prodUnits = (targetProd.units || []).filter((u) => u.isActive !== false);
      const sorted = [...prodUnits].sort((a, b) => (b.multiplier || 1) - (a.multiplier || 1));

      const newQtys = {};
      if (sorted.length > 0) newQtys[sorted[0].id] = po.tier1_qty || (po.purchase_order_items?.[0]?.tier1_qty || 0);
      if (sorted.length > 1) newQtys[sorted[1].id] = po.tier2_qty || (po.purchase_order_items?.[0]?.tier2_qty || 0);
      if (sorted.length > 2) newQtys[sorted[2].id] = po.tier3_qty || (po.purchase_order_items?.[0]?.tier3_qty || 0);
      setUnitQuantities(newQtys);
    }

    setCostLak(formatDots(po.cost_lak || 0));
    setCostThb(formatThb(po.cost_thb || 0));
    setTotalCostLak(formatDots(po.total_cost_lak || 0));
    setTotalCostThb(formatThb(po.total_cost_thb || 0));
    setPaymentStatus(po.payment_status || 'PAID');
    setPaidAmount(formatDots(po.paid_amount || 0));
    setDebtAmount(Number(po.debt_amount) || 0);
    setNote(po.note || '');
    setViewMode('ENTRY');
  };

  // Re-sync selected product with fresh data when products change or re-opened
  useEffect(() => {
    if (viewMode === 'ENTRY' && selectedProductId) {
      const freshProd = products.find((p) => p.id === selectedProductId);
      if (freshProd) {
        setCostThb(freshProd.costBaht > 0 ? formatThb(freshProd.costBaht) : '0');
        setCostLak(freshProd.costKip > 0 ? formatDots(freshProd.costKip) : '0');

        const prodUnits = (freshProd.units || []).filter((u) => u.isActive !== false);
        setRetailPriceOverrides((prev) => {
          const updated = {};
          prodUnits.forEach((u) => {
            updated[u.id] = prev[u.id] !== undefined ? prev[u.id] : (u.retailPrice || 0);
          });
          return updated;
        });
      }
    }
  }, [products, viewMode, selectedProductId]);

  // Selected Product Reference & Sorting (Largest to Smallest Multiplier)
  const selectedProduct = products.find((p) => p.id === selectedProductId) || null;
  const activeUnits = (selectedProduct?.units || []).filter((u) => u.isActive !== false);
  const sortedUnits = [...activeUnits].sort((a, b) => (b.multiplier || 1) - (a.multiplier || 1));

  // Hydrate Product Data into Form When Product is Picked
  const handleSelectProduct = (prodId) => {
    setSelectedProductId(prodId);
    setIsProductDropdownOpen(false);
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

    // Pre-fill Cost without double multiplier
    setCostThb(prod.costBaht > 0 ? formatThb(prod.costBaht) : '0');
    setCostLak(prod.costKip > 0 ? formatDots(prod.costKip) : '0');

    // Pre-fill Retail Prices
    const initialRetail = {};
    sorted.forEach((u) => {
      initialRetail[u.id] = u.retailPrice || 0;
    });
    setRetailPriceOverrides(initialRetail);

    // Initial Totals
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

    // If typing in middle unit (index 1) and carton (index 0) exists, auto-rollover
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

  const handleStepQty = (unit, delta, index) => {
    const current = unitQuantities[unit.id] || 0;
    const nextVal = Math.max(0, current + delta);
    handleUnitQtyChange(unit, nextVal, index);
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
      // PARTIAL: default half paid
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
      onAlert?.(`ພົບສິນຄ້າ: ${matched.name}`, 'ສະແກນສຳເລັດ', 'success');
    } else {
      onAlert?.(`ບໍ່ພົບສິນຄ້າທີ່ມີ Barcode "${scannedCode}"`, 'ແຈ້ງເຕືອນ', 'warning');
    }
  };

  // Submit GRN Form
  const handleSubmitGRN = async (e) => {
    e.preventDefault();
    if (!selectedProductId || !selectedProduct) {
      onAlert?.('ກະລຸນາເລືອກສິນຄ້າທີ່ຕ້ອງການຮັບເຂົ້າສາງ!', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    if (importedBaseUnits <= 0) {
      onAlert?.('ກະລຸນາປ້ອນຈຳນວນຮັບເຂົ້າສາງ (> 0)!', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    setIsSubmittingGRN(true);
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

      let res;
      if (editingPoId) {
        res = await updatePurchaseOrderInSupabase(editingPoId, poData, [singleDraft]);
      } else {
        res = await createPurchaseOrderInSupabase(poData, [singleDraft]);
      }

      if (res.success) {
        onAlert?.(
          editingPoId
            ? `ອັບເດດໃບຮັບສິນຄ້າ "${selectedProduct.name}" ສຳເລັດແລ້ວ!`
            : `ບັນທຶກຮັບສິນຄ້າ "${selectedProduct.name}" ເຂົ້າສາງ & ອັບເດດລາຄາສຳເລັດແລ້ວ!`,
          'ສຳເລັດ',
          'success'
        );
        onRefresh?.();
        handleBackToList();
      } else {
        onAlert?.(res.error || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ', 'ຂໍ້ຜິດພາດ', 'error');
      }
    } finally {
      setIsSubmittingGRN(false);
    }
  };

  // Debt Payment Submission
  const handleConfirmDebtPayment = async (e) => {
    e.preventDefault();
    if (!payingPo) return;

    const amt = parseDots(repayAmount);
    if (amt <= 0) {
      onAlert?.('ກະລຸນາປ້ອນຈຳນວນເງິນທີ່ຕ້ອງການຈ່າຍ (> 0)', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await addSupplierDebtPaymentInSupabase(
        payingPo.id,
        amt,
        payingPo.primary_currency || 'LAK',
        repayMethod,
        repayNote
      );

      if (res.success) {
        onAlert?.('ບັນທຶກການຊຳລະໜີ້ສຳເລັດແລ້ວ!', 'ສຳເລັດ', 'success');
        setPayingPo(null);
        onRefresh?.();
      } else {
        onAlert?.(res.error || 'ເກີດຂໍ້ຜິດພາດ', 'ຂໍ້ຜິດພາດ', 'error');
      }
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Filter products for the searchable picker
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase().trim();
    return products.filter((p) => (
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    ));
  }, [products, productSearch]);

  // Helper to format quantity of an order in largest units
  const formatOrderQuantity = (po) => {
    // If order has single-product fields
    if (po.tier1_qty || po.tier2_qty || po.tier3_qty) {
      const parts = [];
      if (po.tier1_qty > 0) parts.push(`${po.tier1_qty} ແກັດ/ລັງ`);
      if (po.tier2_qty > 0) parts.push(`${po.tier2_qty} ແພັກ`);
      if (po.tier3_qty > 0) parts.push(`${po.tier3_qty} ອັນ`);
      if (parts.length > 0) return parts.join(' ');
    }
    // Check purchase_order_items
    if (po.purchase_order_items && po.purchase_order_items.length > 0) {
      const first = po.purchase_order_items[0];
      const parts = [];
      if (first.tier1_qty > 0) parts.push(`${first.tier1_qty} ແກັດ/ລັງ`);
      if (first.tier2_qty > 0) parts.push(`${first.tier2_qty} ແພັກ`);
      if (first.tier3_qty > 0) parts.push(`${first.tier3_qty} ອັນ`);
      if (parts.length > 0) {
        return po.purchase_order_items.length > 1
          ? `${parts.join(' ')} (+${po.purchase_order_items.length - 1} ລາຍການ)`
          : parts.join(' ');
      }
    }
    if (po.imported_base_units) {
      return `${po.imported_base_units} ຫົວໜ່ວຍ`;
    }
    return '1 ລາຍການ';
  };

  // Helper to get order's product name
  const getOrderProductName = (po) => {
    if (po.product_name) return po.product_name;
    if (po.purchase_order_items && po.purchase_order_items.length > 0) {
      return po.purchase_order_items[0].product_name || 'ສິນຄ້າຮັບເຂົ້າ';
    }
    return 'ສິນຄ້າຮັບເຂົ້າ';
  };

  // =========================================================================
  // RENDER: FULLSCREEN ENTRY FORM (PART 2)
  // =========================================================================
  if (viewMode === 'ENTRY') {
    const currentStock = selectedProduct ? (selectedProduct.currentStockBaseUnits || 0) : 0;
    const baseUnitName = selectedProduct ? (selectedProduct.baseUnit || 'ອັນ') : 'ອັນ';
    const newTotalStock = currentStock + importedBaseUnits;

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100 select-none font-sans">
        {/* ============================================================== */}
        {/* 2.1. STICKY TOP HEADER                                         */}
        {/* ============================================================== */}
        <header className="bg-white border-b border-slate-200/90 px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-xs z-20 sticky top-0">
          {/* Left: Back Button, Title & Badge */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={handleBackToList}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs border border-slate-200 shrink-0"
              title="ກັບຄືນໜ້າລາຍການ"
            >
              <ArrowLeft size={20} weight="bold" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 flex flex-wrap items-center gap-2 truncate">
                <span>ສ້າງໃບຮັບສິນຄ້າເຂົ້າສາງ (Goods Receipt Note - GRN)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                  Single-Product Entry
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 hidden sm:block truncate mt-0.5">
                ນຳເຂົ້າສິນຄ້າລາຍການດຽວ, ຕົ້ນທຶນບາດ-ກີບ, ສະຕັອກບວກເພີ່ມ & ຈັດການໜີ້ສິນຜູ້ສະໜອງ
              </p>
            </div>
          </div>

          {/* Right: Cancel & Primary Save Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleBackToList}
              className="px-4 py-2.5 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs"
            >
              ຍົກເລີກ
            </button>
            <button
              type="submit"
              form="grn-fullscreen-form"
              disabled={isSubmittingGRN}
              className="px-5 py-2.5 h-12 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl shadow-md shadow-teal-700/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <FloppyDisk size={18} weight="bold" />
              <span>{isSubmittingGRN ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກໃບຮັບສິນຄ້າເຂົ້າສາງ'}</span>
            </button>
          </div>
        </header>

        {/* ============================================================== */}
        {/* 2.2. SCROLLABLE BODY (3 CONTAINER CARDS)                        */}
        {/* ============================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <form
            id="grn-fullscreen-form"
            onSubmit={handleSubmitGRN}
            className="max-w-6xl mx-auto space-y-5 pb-10"
          >
            {/* ============================================================ */}
            {/* 📦 CARD 1: ຂໍ້ມູນຮ້ານສົ່ງ & ຜູ້ຮັບສິນຄ້າ (Supplier & Receiver Info) */}
            {/* ============================================================ */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
                  <Truck size={20} weight="duotone" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    ຂໍ້ມູນຮ້ານສົ່ງ & ຜູ້ຮັບສິນຄ້າ (Supplier & Receiver Info)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ລະບຸແຫຼ່ງນຳເຂົ້າ ແລະ ຊື່ພະນັກງານຜູ້ກວດຮັບເຄື່ອງຕົວຈິງ
                  </p>
                </div>
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs cursor-pointer"
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
            {/* 🏷️ CARD 2: ຂໍ້ມູນສິນຄ້າ, ຕົ້ນທຶນ & ຈຳນວນຮັບເຂົ້າ (Product & Cost) */}
            {/* ============================================================ */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
                    <Package size={20} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                       ຂໍ້ມູນສິນຄ້າ, ຕົ້ນທຶນ & ຈຳນວນຮັບເຂົ້າ (Product, Cost & Dynamic Stock Summing)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      ເລືອກສິນຄ້າ, ປັບຕົ້ນທຶນ ແລະ ປ້ອນຈຳນວນຮັບເຂົ້າຕາມລະດັບຫົວໜ່ວຍ
                    </p>
                  </div>
                </div>

                {/* Current Stock Badge */}
                {selectedProduct && (
                  <div className="px-3 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl text-xs font-bold font-mono shadow-2xs">
                    ສະຕັອກປະຈຸບັນ: {currentStock} {baseUnitName}
                  </div>
                )}
              </div>

              {/* 1. Product Selector with Search & Barcode Camera */}
              <div className="flex flex-col gap-2 relative">
                <label className="text-xs font-bold text-slate-800">
                  ເລືອກສິນຄ້າທີ່ຕ້ອງການຮັບເຂົ້າສາງ (Select Product) *
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="ພິມຊື່ສິນຄ້າ, ໝວດໝູ່ ຫຼື ຍິງບາໂຄດ..."
                      value={productSearch}
                      onFocus={() => setIsProductDropdownOpen(true)}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setIsProductDropdownOpen(true);
                      }}
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

                  {/* Open Barcode Scanner Modal Button */}
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs shrink-0"
                    title="ສະແກນບາໂຄດດ້ວຍກ້ອງ"
                  >
                    <Camera size={16} weight="bold" />
                    <span className="hidden sm:inline">ສະແກນບາໂຄດ</span>
                  </button>
                </div>

                {/* Dropdown Results list */}
                {isProductDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl z-30 divide-y divide-slate-100">
                    {filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        ບໍ່ພົບສິນຄ້າທີ່ກົງກັບ "{productSearch}"
                      </div>
                    ) : (
                      filteredProducts.map((p) => {
                        const isSelected = p.id === selectedProductId;
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              handleSelectProduct(p.id);
                              setProductSearch(p.name);
                            }}
                            className={`p-2.5 px-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-teal-50/80 text-teal-900 font-bold'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl}
                                  alt=""
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                  <Package size={16} />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs truncate font-bold">{p.name}</div>
                                <div className="text-[10.5px] text-slate-400 truncate">
                                  {p.category || 'ທົ່ວໄປ'} • Barcode: {p.barcode || '-'}
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0 font-mono text-xs">
                              <span className="text-slate-500 font-normal">
                                ສະຕັອກ: {p.currentStockBaseUnits || 0} {p.baseUnit || 'ອັນ'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Product Details Section (Shown when product is selected) */}
              {selectedProduct ? (
                <div className="flex flex-col gap-5 pt-2">
                  {/* Selected Product Card Banner */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedProduct.imageUrl ? (
                        <img
                          src={selectedProduct.imageUrl}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
                          <Package size={24} />
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-black text-slate-900">
                          {selectedProduct.name}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          ໝວດໝູ່: {selectedProduct.category || 'ທົ່ວໄປ'} • ຫົວໜ່ວຍຍ່ອຍ: {selectedProduct.baseUnit || 'ອັນ'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductId('');
                        setProductSearch('');
                      }}
                      className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                    >
                      ປ່ຽນສິນຄ້າ
                    </button>
                  </div>

                  {/* 2. Auto-fill original cost (THB & LAK per crate) */}
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-2">
                      ຕົ້ນທຶນຮັບເຂົ້າຕໍ່ຫົວໜ່ວຍໃຫຍ່ສຸດ (Cost per Crate / Highest Unit)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Cost THB */}
                      <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          ຕົ້ນທຶນ ฿ (THB) / ຍົກລັງ
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={costThb}
                            onChange={(e) => handleCostThbChange(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 shadow-2xs pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            ฿
                          </span>
                        </div>
                      </div>

                      {/* Cost LAK */}
                      <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          ຕົ້ນທຶນ ₭ (LAK) / ຍົກລັງ *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={costLak}
                            onChange={(e) => handleCostLakChange(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 shadow-2xs pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            ₭
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Dynamic Touch-Friendly Stock Boxes (Sorted Large to Small) */}
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-2">
                      ຊ່ອງປ້ອນຈຳນວນຮັບເຂົ້າສາງ (Dynamic Touch-Friendly Stock Boxes)
                    </label>
                    <div className={`grid gap-3 ${
                      sortedUnits.length === 1
                        ? 'grid-cols-1 max-w-xs'
                        : sortedUnits.length === 2
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-3'
                    }`}>
                      {sortedUnits.map((u, idx) => {
                        const qty = unitQuantities[u.id] || 0;
                        const isTopUnit = idx === 0;

                        return (
                          <div
                            key={u.id}
                            className={`p-3.5 rounded-xl border flex flex-col gap-2 shadow-2xs transition-all ${
                              isTopUnit
                                ? 'bg-teal-50/50 border-teal-200'
                                : 'bg-slate-50/70 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-800">
                                {u.unitName}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 font-bold">
                                {u.multiplier > 1 ? `x${u.multiplier} ${baseUnitName}` : `(1 ${baseUnitName})`}
                              </span>
                            </div>

                            {/* Stepper with height 50px */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStepQty(u, -1, idx)}
                                className="w-11 h-[50px] rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-black text-lg border border-slate-200 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={qty === 0 ? '0' : qty}
                                onChange={(e) => handleUnitQtyChange(u, e.target.value, idx)}
                                className="flex-1 h-[50px] bg-white border border-slate-200 rounded-lg text-center font-mono font-black text-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 shadow-2xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleStepQty(u, 1, idx)}
                                className="w-11 h-[50px] rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-black text-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary Badge */}
                    <div className="mt-3 p-3 rounded-xl bg-teal-50/80 border border-teal-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-bold text-teal-900">
                        <span>ຍອດບວກເພີ່ມເຂົ້າສາງ: </span>
                        <span className="font-mono text-teal-700 font-black">
                          +{formatCompoundStockUnits(importedBaseUnits, sortedUnits)} ({importedBaseUnits} {baseUnitName})
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-700">
                        <span>ລວມສະຕັອກໃໝ່ທັງໝົດ: </span>
                        <span className="font-mono text-slate-900 font-black">
                          {formatCompoundStockUnits(newTotalStock, sortedUnits)} ({newTotalStock} {baseUnitName})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Retail Price Overrides */}
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-2">
                      ກວດສອບ & ປັບລາຄາຂາຍຍ່ອຍ (Retail Price Overrides)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {sortedUnits.map((u) => (
                        <div
                          key={u.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">
                              ລາຄາຂາຍ {u.unitName}
                            </span>
                            <span className="text-[10.5px] text-slate-400 font-mono">
                              (ເດີມ: {formatDots(u.retailPrice)} ₭)
                            </span>
                          </div>
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
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right pr-7 focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-2xs"
                            />
                            <span className="absolute right-2.5 top-2 text-[11px] text-slate-400 font-bold">
                              ₭
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                  <Package size={36} className="mx-auto mb-2 text-slate-300" weight="duotone" />
                  ກະລຸນາເລືອກສິນຄ້າດ້ານເທິງເພື່ອເລີ່ມຕົ້ນປ້ອນຈຳນວນ ແລະ ລາຄາຮັບເຂົ້າສາງ.
                </div>
              )}
            </div>

            {/* ============================================================ */}
            {/* 💰 CARD 3: ຍອດລວມຕົ້ນທຶນຊື້ & ຈັດການໜີ້ສິນ (Total Cost & AP)    */}
            {/* ============================================================ */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col gap-5">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
                  <Coins size={20} weight="duotone" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    ຍອດລວມຕົ້ນທຶນຊື້ & ຈັດການໜີ້ສິນ (Total Cost & Accounts Payable)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ຄຳນວນຍອດຕົ້ນທຶນລວມ (LAK & THB, ລົບ VND ອອກແລ້ວ) ແລະ ຮູບແບບການຊຳລະ
                  </p>
                </div>
              </div>

              {/* 2 Columns: 50% / 50% for LAK & THB */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* LAK Total */}
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 shadow-2xs">
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
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xl font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 shadow-2xs"
                  />
                </div>

                {/* THB Total */}
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 shadow-2xs">
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
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xl font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 shadow-2xs"
                  />
                </div>
              </div>

              {/* Segmented Payment Buttons (Height 48px) */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
                <span className="text-xs font-bold text-slate-700 shrink-0">
                  ຮູບແບບການຊຳລະ:
                </span>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handlePaymentStatusClick('PAID')}
                    className={`flex-1 sm:flex-none px-5 h-12 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                      paymentStatus === 'PAID'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ຈ່າຍຄົບ (PAID)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePaymentStatusClick('DEBT')}
                    className={`flex-1 sm:flex-none px-5 h-12 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                      paymentStatus === 'DEBT'
                        ? 'bg-[#EF4444] text-white border-[#EF4444] shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ຕິດໜີ້ (DEBT)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePaymentStatusClick('PARTIAL')}
                    className={`flex-1 sm:flex-none px-5 h-12 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                      paymentStatus === 'PARTIAL'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ຈ່າຍບາງສ່ວນ (PARTIAL)
                  </button>
                </div>
              </div>

              {/* Dynamic Debt Calculation Area (Visible if PARTIAL or DEBT) */}
              {paymentStatus === 'PARTIAL' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      ຈຳນວນເງິນທີ່ຈ່າຍແລ້ວ (Paid Amount ₭)
                    </label>
                    <input
                      type="text"
                      value={paidAmount}
                      onChange={(e) => handlePaidAmountChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 shadow-2xs"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl border bg-rose-50/90 border-rose-200 text-rose-900 shadow-2xs">
                    <span className="text-[10px] font-bold block uppercase tracking-wider text-rose-600">
                      ຍອດໜີ້ຄ້າງຊຳລະ (DEBT BALANCE)
                    </span>
                    <span className="text-base font-mono font-black text-rose-700">
                      {formatDots(debtAmount)} ₭
                    </span>
                  </div>
                </div>
              )}

              {paymentStatus === 'DEBT' && (
                <div className="p-3.5 rounded-xl border bg-rose-50/90 border-rose-200 text-rose-900 shadow-2xs flex items-center justify-between">
                  <span className="text-xs font-bold">ຍອດໜີ້ຄ້າງຊຳລະຮ້ານສົ່ງ (100% DEBT):</span>
                  <span className="text-lg font-mono font-black text-rose-700">
                    {formatDots(debtAmount)} ₭
                  </span>
                </div>
              )}

              {/* Note Textarea */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  ໝາຍເຫດ (Note)
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="ເຊັ່ນ: ນຳເຂົ້າງວດຕົ້ນເດືອນ, ຈ່າຍແລ້ວເຄິ່ງໜຶ່ງ, ສິນຄ້າມາສົ່ງຮອດສາງຄົບຖ້ວນ..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs resize-none"
                />
              </div>
            </div>
          </form>
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

  // =========================================================================
  // RENDER: GRN LIST & HISTORY SCREEN (PART 1)
  // =========================================================================
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 select-none font-sans">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
            <Package size={20} className="sm:w-5 sm:h-5" weight="duotone" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="truncate">ຈັດການນຳເຂົ້າສິນຄ້າ & ໜີ້ສິນ (GRN)</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                {purchaseOrders.length}
              </span>
            </h2>
            <p className="text-[11.5px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
              ບັນທຶກຮັບສິນຄ້າເຂົ້າສາງ, ປັບຕົ້ນທຶນບາດ-ກີບ & ຕິດຕາມໜີ້ຄ້າງຊຳລະ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs disabled:opacity-50"
            title="ໂຫຼດຂໍ້ມູນໃໝ່"
          >
            <ArrowClockwise size={15} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">ຣີເຟຣຊ</span>
          </button>

          <button
            type="button"
            onClick={onOpenSupplierManager}
            className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs"
          >
            <Truck size={15} />
            <span className="hidden sm:inline">ຈັດການຜູ້ສະໜອງ ({suppliers.length})</span>
            <span className="sm:hidden">ຮ້ານສົ່ງ ({suppliers.length})</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateGRN}
            className="px-3 sm:px-4 py-2 sm:py-2.5 h-9 sm:h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={16} weight="bold" />
            <span>+ ຮັບເຂົ້າສາງ</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1.1. TOP KPI METRICS (COMPACT SINGLE-ROW ON MOBILE)           */}
      {/* ============================================================== */}
      <div className="px-3 sm:px-6 pt-2.5 sm:pt-3.5 pb-1 sm:pb-1.5 grid grid-cols-3 gap-1.5 sm:gap-3 shrink-0">
        {/* Card 1: Total Purchase Cost */}
        <div className="bg-white p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9.5px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate block">
              <span className="sm:hidden">ມູນຄ່າຮັບເຂົ້າ</span>
              <span className="hidden sm:inline">1. ມູນຄ່າຮັບເຂົ້າລວມ</span>
            </span>
            <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Coins size={12} className="sm:w-4 sm:h-4" weight="duotone" />
            </div>
          </div>
          <div className="mt-0.5 sm:mt-1 min-w-0">
            <div className="text-[12px] sm:text-base md:text-lg font-mono font-black text-slate-900 truncate">
              {formatKip(kpiMetrics.totalLak)}
            </div>
            <div className="text-[9.5px] sm:text-xs font-mono font-bold text-slate-400 truncate mt-0.5">
              {kpiMetrics.totalThb > 0 ? `${formatThb(kpiMetrics.totalThb)} ฿` : '0 ฿'}
            </div>
          </div>
        </div>

        {/* Card 2: Accounts Payable (Red Debt Amount) */}
        <div className="bg-white p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9.5px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate block">
              <span className="sm:hidden">ໜີ້ຜູ້ສະໜອງ</span>
              <span className="hidden sm:inline">2. ໜີ້ຄ້າງຊຳລະ</span>
            </span>
            <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <WarningCircle size={12} className="sm:w-4 sm:h-4" weight="duotone" />
            </div>
          </div>
          <div className="mt-0.5 sm:mt-1 min-w-0">
            <div className="text-[12px] sm:text-base md:text-lg font-mono font-black text-rose-600 truncate">
              {formatKip(kpiMetrics.totalDebt)}
            </div>
            <div className="text-[9.5px] sm:text-xs text-rose-500 font-bold truncate mt-0.5">
              {kpiMetrics.totalDebt > 0 ? 'ຍັງຕິດໜີ້' : 'ບໍ່ມີໜີ້'}
            </div>
          </div>
        </div>

        {/* Card 3: Total GRN Orders */}
        <div className="bg-white p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9.5px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate block">
              <span className="sm:hidden">ໃບຮັບທັງໝົດ</span>
              <span className="hidden sm:inline">3. ໃບຮັບທັງໝົດ</span>
            </span>
            <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Receipt size={12} className="sm:w-4 sm:h-4" weight="duotone" />
            </div>
          </div>
          <div className="mt-0.5 sm:mt-1 min-w-0">
            <div className="text-[12px] sm:text-base md:text-lg font-mono font-black text-slate-900 truncate">
              {kpiMetrics.totalOrders} <span className="text-[10px] sm:text-xs font-sans font-bold text-slate-500">ບິນ</span>
            </div>
            <div className="text-[9.5px] sm:text-xs text-slate-400 truncate mt-0.5">
              ຮັບເຂົ້າແລ້ວ
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1.2. ACTION BAR (KHUNG BACKGROUND TRẮNG BO GÓC GIỐNG LỊCH SỬ)   */}
      {/* ============================================================== */}
      <div className="px-3 sm:px-6 pb-2.5 sm:pb-3 shrink-0">
        <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-2.5">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'ALL', label: 'ທັງໝົດ', count: purchaseOrders.length },
              { id: 'PAID', label: 'ຈ່າຍຄົບ', count: purchaseOrders.filter((p) => p.payment_status === 'PAID').length },
              { id: 'DEBT', label: 'ຕິດໜີ້', count: purchaseOrders.filter((p) => p.payment_status === 'DEBT').length },
              { id: 'PARTIAL', label: 'ຈ່າຍບາງສ່ວນ', count: purchaseOrders.filter((p) => p.payment_status === 'PARTIAL').length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`h-8 sm:h-[34px] px-2.5 sm:px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border shrink-0 ${
                  filterStatus === tab.id
                    ? tab.id === 'ALL'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : tab.id === 'PAID'
                      ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                      : tab.id === 'DEBT'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200/80 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] sm:text-[10.5px] font-mono ${
                    filterStatus === tab.id
                      ? 'bg-white/20 text-white font-black'
                      : tab.id === 'DEBT' && tab.count > 0
                      ? 'bg-rose-100 text-rose-700 font-black'
                      : 'bg-slate-200/80 text-slate-600 font-bold'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* 36px Search Box */}
          <div className="relative w-full sm:w-64 md:w-72">
            <input
              type="text"
              placeholder="ຄົ້ນຫາລະຫັດ, ຮ້ານສົ່ງ, ສິນຄ້າ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 sm:h-[36px] pl-8 sm:pl-9 pr-7 sm:pr-8 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 shadow-2xs transition-all font-medium"
            />
            <MagnifyingGlass
              size={14}
              className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1.3. MODERN GRN DATA LIST (CARDS ON MOBILE, TABLE ON DESKTOP) */}
      {/* ============================================================== */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 pb-6">
        {filteredOrders.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-dashed border-slate-200">
            <Package size={44} className="text-slate-300 mb-2" weight="duotone" />
            <p className="text-xs font-bold text-slate-600">ບໍ່ພົບລາຍການຮັບສິນຄ້າເຂົ້າສາງ</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ກົດປຸ່ມ "+ ຮັບເຂົ້າສາງ" ເພື່ອສ້າງໃບຮັບເຂົ້າໃໝ່
            </p>
          </div>
        ) : (
          <>
            {/* MOBILE CARD LIST (< 1024px, block lg:hidden) */}
            <div className="block lg:hidden space-y-2.5">
              {filteredOrders.map((po) => {
                const dateFormatted = new Date(po.created_at).toLocaleString('lo-LA', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const debt = Number(po.debt_amount) || 0;
                const prodName = getOrderProductName(po);
                const qtyDisplay = formatOrderQuantity(po);

                return (
                  <div
                    key={po.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col gap-2.5"
                  >
                    {/* Row 1: Code + Date/time on Left; Payment status badge on Right */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 shrink-0">
                          {po.id}
                        </span>
                        <span className="text-[10.5px] sm:text-[11px] text-slate-400 truncate">
                          {dateFormatted}
                        </span>
                      </div>

                      <div className="shrink-0">
                        {po.payment_status === 'PAID' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                            <CheckCircle size={11} weight="bold" />
                            <span>ຈ່າຍຄົບ</span>
                          </span>
                        )}
                        {po.payment_status === 'PARTIAL' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <span>ຈ່າຍບາງສ່ວນ</span>
                          </span>
                        )}
                        {po.payment_status === 'DEBT' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                            <span>ຕິດໜີ້</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Supplier name + Product name & largest quantity */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold mb-0.5">
                          <Truck size={14} className="text-teal-600 shrink-0" />
                          <span className="truncate">{po.suppliers?.name || 'ບໍ່ລະບຸຜູ້ສະໜອງ'}</span>
                          {po.received_by && (
                            <span className="text-[10.5px] text-slate-400 shrink-0">
                              • ຜູ້ຮັບ: {po.received_by}
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {prodName}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-block px-2 py-0.5 bg-teal-50 text-teal-800 rounded-lg text-xs font-mono font-bold border border-teal-200/80">
                          {qtyDisplay}
                        </span>
                      </div>
                    </div>

                    {/* Row 3: Totals ₭ and ฿ on Left; Actions (Edit, Details, Pay debt) on Right */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-mono font-black text-slate-900">
                            {formatKip(po.total_cost_lak)}
                          </span>
                          {Number(po.total_cost_thb) > 0 && (
                            <span className="text-xs font-mono font-bold text-slate-400">
                              ({formatThb(po.total_cost_thb)} ฿)
                            </span>
                          )}
                        </div>
                        {debt > 0 && (
                          <div className="text-[11px] font-mono font-bold text-rose-600">
                            ໜີ້: {formatDots(debt)} ₭
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditPo(po)}
                          className="p-1.5 text-slate-600 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors border border-slate-200"
                          title="ແກ້ໄຂໃບຮັບສິນຄ້າ"
                        >
                          <PencilSimple size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedPoForDetails(po)}
                          className="p-1.5 text-slate-600 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors border border-slate-200"
                          title="ເບິ່ງລາຍລະອຽດ"
                        >
                          <Eye size={15} />
                        </button>

                        {debt > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPayingPo(po);
                              setRepayAmount(formatDots(debt));
                              setRepayMethod('CASH');
                              setRepayNote('');
                            }}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 border border-rose-200 shadow-2xs"
                            title="ຊຳລະໜີ້ຜູ້ສະໜອງ"
                          >
                            <HandCoins size={14} weight="bold" />
                            <span>ຊຳລະໜີ້</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP DATA TABLE (>= 1024px, hidden lg:block) */}
            <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <th className="py-3 px-4">ລະຫັດບິນ & ວັນທີ</th>
                      <th className="py-3 px-4">ຮ້ານສົ່ງ</th>
                      <th className="py-3 px-4">ສິນຄ້າ & ຈຳນວນ</th>
                      <th className="py-3 px-4 text-right">ມູນຄ່າຮັບເຂົ້າ ₭</th>
                      <th className="py-3 px-4 text-right">ມູນຄ່າຮັບເຂົ້າ ฿</th>
                      <th className="py-3 px-4 text-center">ສະຖານະຊຳລະ</th>
                      <th className="py-3 px-4 text-right">ໜີ້ຄ້າງຊຳລະ</th>
                      <th className="py-3 px-4 text-center">ຈັດການ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredOrders.map((po) => {
                      const dateFormatted = new Date(po.created_at).toLocaleString('lo-LA', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const debt = Number(po.debt_amount) || 0;
                      const prodName = getOrderProductName(po);
                      const qtyDisplay = formatOrderQuantity(po);

                      return (
                        <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* ລະຫັດບິນ & ວັນທີ */}
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-900">{po.id}</div>
                            <div className="text-[10.5px] text-slate-400">{dateFormatted}</div>
                          </td>

                          {/* ຮ້ານສົ່ງ */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800">
                              {po.suppliers?.name || 'ບໍ່ລະບຸຜູ້ສະໜອງ'}
                            </div>
                            {po.received_by && (
                              <div className="text-[10.5px] text-slate-400">
                                ຜູ້ຮັບ: {po.received_by}
                              </div>
                            )}
                          </td>

                          {/* ສິນຄ້າ & ຈຳນວນ */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 truncate max-w-xs" title={prodName}>
                              {prodName}
                            </div>
                            <div className="text-[10.5px] font-mono text-teal-700 font-bold">
                              {qtyDisplay}
                            </div>
                          </td>

                          {/* ມູນຄ່າຮັບເຂົ້າ ₭ */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {formatKip(po.total_cost_lak)}
                          </td>

                          {/* ມູນຄ່າຮັບເຂົ້າ ฿ */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-600">
                            {Number(po.total_cost_thb) > 0 ? `${formatThb(po.total_cost_thb)} ฿` : '-'}
                          </td>

                          {/* ສະຖານະຊຳລະ */}
                          <td className="py-3 px-4 text-center">
                            {po.payment_status === 'PAID' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                <CheckCircle size={12} weight="bold" />
                                <span>ຈ່າຍຄົບ</span>
                              </span>
                            )}
                            {po.payment_status === 'PARTIAL' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <span>ຈ່າຍບາງສ່ວນ</span>
                              </span>
                            )}
                            {po.payment_status === 'DEBT' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                                <span>ຕິດໜີ້</span>
                              </span>
                            )}
                          </td>

                          {/* ໜີ້ຄ້າງຊຳລະ */}
                          <td className="py-3 px-4 text-right font-mono font-bold">
                            {debt > 0 ? (
                              <span className="text-rose-600 font-black">
                                {formatDots(debt)} ₭
                              </span>
                            ) : (
                              <span className="text-teal-700">0 ₭</span>
                            )}
                          </td>

                          {/* ຈັດການ: ປຸ່ມແກ້ໄຂ, ເບິ່ງລາຍລະອຽດ & ປຸ່ມຊຳລະໜີ້ */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEditPo(po)}
                                className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors"
                                title="ແກ້ໄຂ"
                              >
                                <PencilSimple size={16} />
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedPoForDetails(po)}
                                className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors"
                                title="ເບິ່ງລາຍລະອຽດ"
                              >
                                <Eye size={17} />
                              </button>

                              {debt > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPayingPo(po);
                                    setRepayAmount(formatDots(debt));
                                    setRepayMethod('CASH');
                                    setRepayNote('');
                                  }}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 border border-rose-200 shadow-2xs"
                                  title="ຊຳລະໜີ້ຜູ້ສະໜອງ"
                                >
                                  <HandCoins size={14} weight="bold" />
                                  <span>ຊຳລະໜີ້</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: PO Details Viewer                                     */}
      {/* ============================================================== */}
      {selectedPoForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-4 max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  ໃບຮັບສິນຄ້າ: {selectedPoForDetails.id}
                </h3>
                <p className="text-xs text-slate-500">
                  {new Date(selectedPoForDetails.created_at).toLocaleString('lo-LA')} • ຜູ້ຮັບ: {selectedPoForDetails.received_by || '-'}
                </p>
              </div>
              <button
                onClick={() => setSelectedPoForDetails(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
              {/* Supplier Info */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">ແຫຼ່ງສະໜອງ</span>
                  <span className="font-bold text-xs text-slate-800">
                    {selectedPoForDetails.suppliers?.name || 'ບໍ່ລະບຸຜູ້ສະໜອງ'}
                  </span>
                  {selectedPoForDetails.suppliers?.phone && (
                    <span className="text-xs text-slate-500 font-mono ml-2">
                      ({selectedPoForDetails.suppliers.phone})
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase text-right">ສະຖານະ</span>
                  <span className="text-xs font-bold font-mono text-teal-700">
                    {selectedPoForDetails.payment_status}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <span className="text-xs font-bold text-slate-800 block mb-1.5">
                  ລາຍການສິນຄ້າຮັບເຂົ້າສາງ
                </span>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">ສິນຄ້າ</th>
                        <th className="py-2 px-3 text-center">ຈຳນວນຮັບເຂົ້າ</th>
                        <th className="py-2 px-3 text-right">ຕົ້ນທຶນ ₭</th>
                        <th className="py-2 px-3 text-right">ຕົ້ນທຶນ ฿</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPoForDetails.purchase_order_items && selectedPoForDetails.purchase_order_items.length > 0 ? (
                        selectedPoForDetails.purchase_order_items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-3 font-bold text-slate-800">
                              {it.product_name}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              {it.imported_base_units} ຫົວໜ່ວຍ
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {formatDots(it.cost_lak)} ₭
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {it.cost_thb > 0 ? `${formatThb(it.cost_thb)} ฿` : '-'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {selectedPoForDetails.product_name || 'ສິນຄ້າຮັບເຂົ້າ'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {formatOrderQuantity(selectedPoForDetails)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatKip(selectedPoForDetails.total_cost_lak)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {selectedPoForDetails.total_cost_thb > 0 ? `${formatThb(selectedPoForDetails.total_cost_thb)} ฿` : '-'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Note */}
              {selectedPoForDetails.note && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-600 block mb-0.5">ໝາຍເຫດ:</span>
                  <span className="text-slate-800">{selectedPoForDetails.note}</span>
                </div>
              )}
            </div>

            {/* Totals Summary Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500">ຕົ້ນທຶນລວມ:</span>
                <span className="text-sm font-mono font-black text-slate-900 ml-1.5">
                  {formatKip(selectedPoForDetails.total_cost_lak)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500">ໜີ້ຄ້າງ:</span>
                <span className={`text-sm font-mono font-black ml-1.5 ${
                  Number(selectedPoForDetails.debt_amount) > 0 ? 'text-rose-600' : 'text-teal-700'
                }`}>
                  {formatKip(selectedPoForDetails.debt_amount || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: Debt Repayment Modal                                  */}
      {/* ============================================================== */}
      {payingPo && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <HandCoins size={20} weight="bold" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  ຊຳລະໜີ້ສິນຜູ້ສະໜອງ: {payingPo.id}
                </h3>
              </div>
              <button
                onClick={() => setPayingPo(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmDebtPayment} className="flex flex-col gap-3.5">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex items-center justify-between">
                <span className="text-xs text-rose-700 font-bold">ຍອດໜີ້ຄ້າງຊຳລະ:</span>
                <span className="text-base font-mono font-black text-rose-700">
                  {formatDots(payingPo.debt_amount)} ₭
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ຈຳນວນເງິນທີ່ຈ່າຍເພີ່ມ (₭) *
                </label>
                <input
                  type="text"
                  required
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(formatDots(parseDots(e.target.value)))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-base font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ຊ່ອງທາງການຊຳລະ
                </label>
                <select
                  value={repayMethod}
                  onChange={(e) => setRepayMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
                >
                  <option value="CASH">ເງິນສົດ (Cash)</option>
                  <option value="TRANSFER">ໂອນເງິນ / QR (Transfer)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ໝາຍເຫດ (Note)
                </label>
                <input
                  type="text"
                  value={repayNote}
                  onChange={(e) => setRepayNote(e.target.value)}
                  placeholder="ເຊັ່ນ: ຈ່າຍຜ່ານ BCEL One, ງວດທີ 2..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayingPo(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {isSubmittingPayment ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກການຈ່າຍໜີ້'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
