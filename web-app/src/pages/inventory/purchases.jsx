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
  Trash,
} from '@phosphor-icons/react';
import {
  formatKip,
  formatDots,
  parseDots,
  formatThb,
  parseThb,
  formatThbTyping,
  formatCompoundStockUnits,
  getSortedUnits,
  formatStockDisplay,
} from '../../utils/formatters';
import {
  processMultiProductGRN,
  createPurchaseOrderInSupabase,
  updatePurchaseOrderInSupabase,
  deletePurchaseOrderInSupabase,
  addSupplierDebtPaymentInSupabase,
  fetchExchangeRate,
} from '../../services/supabase';
import { queryClient } from '../../services/queryClient';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';
import MultiProductGRNForm from '../../components/inventory/MultiProductGRNForm';

export default function PurchasesView({
  purchaseOrders = [],
  suppliers = [],
  products = [],
  onOpenNewGRN,
  onOpenSupplierManager,
  onRefresh,
  isLoading,
  onAlert,
  exchangeRate = 0,
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
  const [poToDelete, setPoToDelete] = useState(null);
  const [isDeletingPo, setIsDeletingPo] = useState(false);

  // =========================================================================
  // FULLSCREEN FORM STATE (MULTI-PRODUCT GRN)
  // =========================================================================
  // 1. Header Information
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [receivedBy, setReceivedBy] = useState('ໄມ້ຄຳ (Meii)');
  const [poCode, setPoCode] = useState('');
  const [note, setNote] = useState('');
  const [currentExchangeRate, setCurrentExchangeRate] = useState(exchangeRate || 0);
  const [isEditingExchangeRate, setIsEditingExchangeRate] = useState(false);
  const [tempExchangeRate, setTempExchangeRate] = useState(String(exchangeRate || 0));

  // Sync prop changes for exchange rate
  useEffect(() => {
    if (exchangeRate && exchangeRate > 0) {
      setCurrentExchangeRate(exchangeRate);
      setTempExchangeRate(String(exchangeRate));
    }
  }, [exchangeRate]);

  // Real-time synchronization from store_settings & queryClient
  useEffect(() => {
    let mounted = true;
    fetchExchangeRate().then((rate) => {
      if (mounted && rate && rate > 0) {
        setCurrentExchangeRate(rate);
        setTempExchangeRate(String(rate));
      }
    });

    const unsubscribe = queryClient.subscribe(['exchange_rate'], async () => {
      const rate = await fetchExchangeRate();
      if (mounted && rate && rate > 0) {
        setCurrentExchangeRate(rate);
        setTempExchangeRate(String(rate));
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // 2. Multi-Product Cart Items Array
  // Item: { product, unitId, unitName, multiplier, tierLevel, quantity, costThb, costLak, retailPriceOverrides, isRetailOpen }
  const [grnCartItems, setGrnCartItems] = useState([]);

  // 3. Catalog Picker & Scanner
  const [productSearch, setProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // 4. Payment & Debt Management
  const [paymentStatus, setPaymentStatus] = useState('PAID'); // 'PAID' | 'PARTIAL' | 'DEBT'
  const [paidAmount, setPaidAmount] = useState('0');
  const [editingPoId, setEditingPoId] = useState(null);
  const [isSubmittingGRN, setIsSubmittingGRN] = useState(false);

  // Bottom-up realtime sum calculation
  const totalCostLakNumber = useMemo(() => {
    return grnCartItems.reduce((sum, it) => {
      const q = Number(it.quantity) || 0;
      const c = parseDots(it.costLak);
      return sum + q * c;
    }, 0);
  }, [grnCartItems]);

  const totalCostThbNumber = useMemo(() => {
    return grnCartItems.reduce((sum, it) => {
      const q = Number(it.quantity) || 0;
      const c = parseThb(it.costThb);
      return sum + q * c;
    }, 0);
  }, [grnCartItems]);

  // Auto-sync paidAmount when total or status changes
  useEffect(() => {
    if (paymentStatus === 'PAID') {
      setPaidAmount(formatDots(totalCostLakNumber));
    } else if (paymentStatus === 'DEBT') {
      setPaidAmount('0');
    }
  }, [totalCostLakNumber, paymentStatus]);

  const debtAmountNumber = useMemo(() => {
    if (paymentStatus === 'PAID') return 0;
    if (paymentStatus === 'DEBT') return totalCostLakNumber;
    return Math.max(0, totalCostLakNumber - parseDots(paidAmount));
  }, [paymentStatus, totalCostLakNumber, paidAmount]);

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

  // Filter products for the searchable picker
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 30);
    const q = productSearch.toLowerCase().trim();
    return products.filter((p) => (
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      (p.units && p.units.some((u) => u.barcode && u.barcode.toLowerCase().includes(q)))
    )).slice(0, 30);
  }, [products, productSearch]);

  // =========================================================================
  // 2.3. STATE & LIFECYCLE MANAGEMENT (CLEANUP & RESET)
  // =========================================================================
  const resetGRNForm = () => {
    setEditingPoId(null);
    setGrnCartItems([]);
    setPoCode('');
    setProductSearch('');
    setIsProductDropdownOpen(false);
    setPaymentStatus('PAID');
    setPaidAmount('0');
    setNote('');
    setIsSubmittingGRN(false);
  };

  const handleBackToList = () => {
    resetGRNForm();
    setViewMode('LIST');
  };

  const generatePoCode = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = String(Math.floor(1000 + Math.random() * 9000));
    return `PO-${dateStr}-${randomSuffix}`;
  };

  const handleOpenCreateGRN = () => {
    resetGRNForm();
    setPoCode(generatePoCode());
    if (suppliers.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(suppliers[0].id);
    }
    setViewMode('ENTRY');
  };

  const handleEditPo = (po) => {
    resetGRNForm();
    setEditingPoId(po.id);
    setPoCode(po.id);
    setSelectedSupplierId(po.supplier_id || (suppliers[0]?.id || ''));
    setReceivedBy(po.received_by || 'ໄມ້ຄຳ (Meii)');
    setPaymentStatus(po.payment_status || 'PAID');
    setPaidAmount(formatDots(po.paid_amount || 0));
    setNote(po.note || '');

    if (po.purchase_order_items && po.purchase_order_items.length > 0) {
      const loadedItems = po.purchase_order_items.map((it) => {
        const prod = products.find((p) => p.id === it.product_id) || {
          id: it.product_id,
          name: it.product_name,
          baseUnit: it.unit_name || 'ອັນ',
          units: [],
        };
        const activeUnits = (prod.units || []).filter((u) => u.isActive !== false);
        const sorted = [...activeUnits].sort((a, b) => (b.multiplier || 1) - (a.multiplier || 1));
        const matchedUnit = activeUnits.find((u) => u.id === it.unit_id) ||
          activeUnits.find((u) => u.unitName === it.unit_name) ||
          sorted[0] ||
          { id: it.unit_id || 'base', unitName: it.unit_name || prod.baseUnit || 'ອັນ', multiplier: 1 };
        const tierIdx = sorted.findIndex((u) => u.id === matchedUnit.id);

        const initialRetail = {};
        activeUnits.forEach((u) => {
          initialRetail[u.id] = u.retailPrice || 0;
        });

        return {
          product: prod,
          unitId: matchedUnit.id,
          unitName: matchedUnit.unitName,
          multiplier: matchedUnit.multiplier || 1,
          tierLevel: tierIdx >= 0 ? tierIdx + 1 : 1,
          quantity: Number(it.quantity) || 1,
          costThb: formatThb(it.cost_thb || 0),
          costLak: formatDots(it.cost_lak || 0),
          retailPriceOverrides: initialRetail,
          isRetailOpen: false,
        };
      });
      setGrnCartItems(loadedItems);
    } else {
      const targetProd = products.find(
        (p) => p.id === po.product_id || p.name === po.product_name
      );
      if (targetProd) {
        const activeUnits = (targetProd.units || []).filter((u) => u.isActive !== false);
        const sorted = [...activeUnits].sort((a, b) => (b.multiplier || 1) - (a.multiplier || 1));
        const firstUnit = sorted[0] || { id: 'base', unitName: targetProd.baseUnit || 'ອັນ', multiplier: 1 };
        const qty = po.tier1_qty || (po.imported_base_units ? Math.floor(po.imported_base_units / (firstUnit.multiplier || 1)) : 1);

        const initialRetail = {};
        activeUnits.forEach((u) => {
          initialRetail[u.id] = u.retailPrice || 0;
        });

        setGrnCartItems([
          {
            product: targetProd,
            unitId: firstUnit.id,
            unitName: firstUnit.unitName,
            multiplier: firstUnit.multiplier || 1,
            tierLevel: 1,
            quantity: Math.max(1, qty),
            costThb: formatThb(po.cost_thb || 0),
            costLak: formatDots(po.cost_lak || 0),
            retailPriceOverrides: initialRetail,
            isRetailOpen: false,
          },
        ]);
      }
    }
    setViewMode('ENTRY');
  };

  // Add product to Cart (or increment if matching productId and unitId)
  const handleAddToCart = (product, unitToSelect = null) => {
    if (!product) return;
    const prodUnits = (product.units || []).filter((u) => u.isActive !== false);
    const sorted = [...prodUnits].sort((a, b) => (b.multiplier || 1) - (a.multiplier || 1));
    const unit = unitToSelect || sorted[0] || { id: 'base', unitName: product.baseUnit || 'ອັນ', multiplier: 1 };
    const tierIdx = sorted.findIndex((u) => u.id === unit.id);

    setGrnCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.product.id === product.id && it.unitId === unit.id
      );

      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: (Number(next[existingIdx].quantity) || 0) + 1,
        };
        return next;
      }

      let initCostThb = product.costBaht > 0 ? product.costBaht : 0;
      let initCostLak = product.costKip > 0 ? product.costKip : 0;
      if (initCostThb > 0 && initCostLak === 0) {
        initCostLak = Math.round(initCostThb * currentExchangeRate);
      } else if (initCostLak > 0 && initCostThb === 0) {
        initCostThb = Math.round(initCostLak / currentExchangeRate);
      }

      const initialRetail = {};
      sorted.forEach((u) => {
        initialRetail[u.id] = u.retailPrice || 0;
      });

      return [
        ...prev,
        {
          product,
          unitId: unit.id,
          unitName: unit.unitName,
          multiplier: unit.multiplier || 1,
          tierLevel: tierIdx >= 0 ? tierIdx + 1 : 1,
          quantity: 1,
          costThb: formatThb(initCostThb),
          costLak: formatDots(initCostLak),
          retailPriceOverrides: initialRetail,
          isRetailOpen: false,
        },
      ];
    });

    setProductSearch('');
    setIsProductDropdownOpen(false);
  };

  const handleUpdateItemQuantity = (index, val) => {
    if (val === '' || val === null || val === undefined) {
      setGrnCartItems((prev) => {
        const next = [...prev];
        if (next[index]) next[index] = { ...next[index], quantity: '' };
        return next;
      });
      return;
    }
    const num = typeof val === 'number' ? val : parseInt(val, 10);
    const q = isNaN(num) || num <= 0 ? 1 : num;
    setGrnCartItems((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], quantity: q };
      return next;
    });
  };

  const handleStepItemQuantity = (index, delta) => {
    setGrnCartItems((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      const current = Number(next[index].quantity) || 1;
      const newQty = Math.max(1, current + delta);
      next[index] = { ...next[index], quantity: newQty };
      return next;
    });
  };

  const handleUpdateItemUnit = (index, newUnitId) => {
    setGrnCartItems((prev) => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;
      const prodUnits = (item.product.units || []).filter((u) => u.isActive !== false);
      const sorted = [...prodUnits].sort((a, b) => (b.multiplier || 1) - (a.multiplier || 1));
      const newUnit = sorted.find((u) => u.id === newUnitId) || { id: newUnitId, unitName: item.product.baseUnit || 'ອັນ', multiplier: 1 };
      const tierIdx = sorted.findIndex((u) => u.id === newUnit.id);

      next[index] = {
        ...item,
        unitId: newUnit.id,
        unitName: newUnit.unitName,
        multiplier: newUnit.multiplier || 1,
        tierLevel: tierIdx >= 0 ? tierIdx + 1 : 1,
      };
      return next;
    });
  };

  const handleUpdateItemCostThb = (index, thbVal) => {
    const cleanDigits = String(thbVal ?? '').replace(/\D/g, '');
    const numThb = cleanDigits ? parseInt(cleanDigits, 10) : 0;
    const formatted = cleanDigits ? formatDots(cleanDigits) : (thbVal === '0' ? '0' : '');
    const rate = Number(currentExchangeRate) || 0;
    const autoLak = rate > 0 ? Math.round(numThb * rate) : 0;

    setGrnCartItems((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      const isManual = Boolean(next[index].isManualMode);
      next[index] = {
        ...next[index],
        costThb: formatted,
        // In manual mode, do not touch costLak! In auto mode, compute costLak
        costLak: isManual ? next[index].costLak : (numThb > 0 ? formatDots(autoLak) : (cleanDigits === '' ? '' : '0')),
      };
      return next;
    });
  };

  const handleUpdateItemCostLak = (index, lakVal) => {
    const cleanDigits = String(lakVal ?? '').replace(/\D/g, '');
    const numLak = cleanDigits ? parseInt(cleanDigits, 10) : 0;
    const formatted = cleanDigits ? formatDots(cleanDigits) : (lakVal === '0' ? '0' : '');
    const rate = Number(currentExchangeRate) || 0;
    const autoThb = rate > 0 ? Math.round(numLak / rate) : 0;

    setGrnCartItems((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      const isManual = Boolean(next[index].isManualMode);
      next[index] = {
        ...next[index],
        costLak: formatted,
        // In manual mode, do not touch costThb! In auto mode, compute costThb
        costThb: isManual ? next[index].costThb : (numLak > 0 ? formatDots(autoThb) : (cleanDigits === '' ? '' : '0')),
      };
      return next;
    });
  };

  const handleToggleItemCostMode = (index) => {
    setGrnCartItems((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = {
        ...next[index],
        isManualMode: !next[index].isManualMode,
      };
      return next;
    });
  };

  const handleToggleAllItemsCostMode = (targetMode) => {
    setGrnCartItems((prev) => {
      return prev.map((item) => ({
        ...item,
        isManualMode: targetMode !== undefined ? targetMode : !item.isManualMode,
      }));
    });
  };

  const handleToggleItemRetail = (index) => {
    setGrnCartItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], isRetailOpen: !next[index].isRetailOpen };
      }
      return next;
    });
  };

  const handleUpdateItemRetailPrice = (index, unitId, priceVal) => {
    const priceNum = parseDots(priceVal);
    setGrnCartItems((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = {
        ...next[index],
        retailPriceOverrides: {
          ...next[index].retailPriceOverrides,
          [unitId]: priceNum,
        },
      };
      return next;
    });
  };

  const handleRemoveItem = (index) => {
    setGrnCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePaymentStatusClick = (status) => {
    setPaymentStatus(status);
    if (status === 'PAID') {
      setPaidAmount(formatDots(totalCostLakNumber));
    } else if (status === 'DEBT') {
      setPaidAmount('0');
    } else {
      const half = Math.round(totalCostLakNumber / 2);
      setPaidAmount(formatDots(half));
    }
  };

  const handlePaidAmountChange = (val) => {
    const num = parseDots(val);
    setPaidAmount(formatDots(num));
  };

  // Hardware Scanner & Search Keydown (Enter key)
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = productSearch.trim().toLowerCase();
      if (!trimmed) return;

      // Exact barcode search first
      const exactMatch = products.find((p) => {
        if (p.barcode && p.barcode.toLowerCase() === trimmed) return true;
        if (p.units && p.units.some((u) => u.barcode && u.barcode.toLowerCase() === trimmed)) return true;
        return false;
      });

      if (exactMatch) {
        const matchedUnit = exactMatch.units?.find((u) => u.barcode && u.barcode.toLowerCase() === trimmed);
        handleAddToCart(exactMatch, matchedUnit || null);
        onAlert?.(`ເພີ່ມ "${exactMatch.name}" ເຂົ້າລາຍການຮັບສິນຄ້າແລ້ວ!`, 'ສຳເລັດ', 'success');
        return;
      }

      // If partial search returned products, add first one
      if (filteredProducts.length > 0) {
        handleAddToCart(filteredProducts[0]);
        onAlert?.(`ເພີ່ມ "${filteredProducts[0].name}" ເຂົ້າລາຍການຮັບສິນຄ້າແລ້ວ!`, 'ສຳເລັດ', 'success');
      } else {
        onAlert?.(`ບໍ່ພົບສິນຄ້າ "${productSearch}"`, 'ແຈ້ງເຕືອນ', 'warning');
      }
    }
  };

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
      const matchedUnit = matched.units?.find((u) => u.barcode && u.barcode.toLowerCase() === trimmed);
      handleAddToCart(matched, matchedUnit || null);
      onAlert?.(`ເພີ່ມ "${matched.name}" ເຂົ້າລາຍການຮັບສິນຄ້າແລ້ວ!`, 'ສະແກນສຳເລັດ', 'success');
    } else {
      onAlert?.(`ບໍ່ພົບສິນຄ້າທີ່ມີ Barcode "${scannedCode}"`, 'ແຈ້ງເຕືອນ', 'warning');
    }
  };

  // Cache sync helper
  const syncAllCaches = async () => {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['purchase_orders'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory_movements'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
      ]);
    } catch (err) {
      console.warn('React query cache invalidation warning:', err);
    }
  };

  // Submit GRN Form (Multi-Product Atomic Transaction)
  const handleSubmitGRN = async (payloadOverrides) => {
    if (payloadOverrides && payloadOverrides.preventDefault) {
      payloadOverrides.preventDefault();
      payloadOverrides = null;
    }

    if (grnCartItems.length === 0) {
      onAlert?.('ກະລຸນາເລືອກຢ່າງໜ້ອຍ 1 ສິນຄ້າເພື່ອຮັບເຂົ້າສາງ!', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    setIsSubmittingGRN(true);
    try {
      const items = grnCartItems.map((it) => {
        const qty = Number(it.quantity) || 1;
        const mult = Number(it.multiplier) || 1;
        const costLak = parseDots(it.costLak);
        const costThb = parseThb(it.costThb);
        const baseUnitsAdded = Math.round(qty * mult);
        const costPerBaseUnit = baseUnitsAdded > 0 ? Math.round((costLak * qty) / baseUnitsAdded) : costLak;

        return {
          product_id: it.product.id,
          product_name: it.product.name,
          unit_id: it.unitId,
          unit_name: it.unitName,
          tier_level: it.tierLevel || 1,
          quantity: qty,
          base_units_added: baseUnitsAdded,
          cost_lak_entered: costLak,
          cost_thb_entered: costThb,
          cost_per_base_unit: costPerBaseUnit,
          line_total_lak: Math.round(costLak * qty),
          line_total_thb: Number((costThb * qty).toFixed(2)),
          retail_price_overrides: it.retailPriceOverrides || {},
        };
      });

      const effectivePoCode = poCode || generatePoCode();
      const finalTotalLak = payloadOverrides?.total_lak !== undefined ? payloadOverrides.total_lak : totalCostLakNumber;
      const finalTotalThb = payloadOverrides?.total_thb !== undefined ? payloadOverrides.total_thb : totalCostThbNumber;
      const finalPaymentStatus = payloadOverrides?.payment_status || paymentStatus;
      const finalPaidAmount = payloadOverrides?.paid_amount_lak !== undefined
        ? payloadOverrides.paid_amount_lak
        : (finalPaymentStatus === 'DEBT' ? 0 : parseDots(paidAmount));
      const finalDebtAmount = payloadOverrides?.debt_amount_lak !== undefined
        ? payloadOverrides.debt_amount_lak
        : debtAmountNumber;

      const grnPayload = {
        po_id: editingPoId || null,
        po_code: effectivePoCode,
        supplier_id: selectedSupplierId || null,
        receiver_name: receivedBy.trim() || 'ໄມ້ຄຳ (Meii)',
        total_lak: finalTotalLak,
        total_thb: finalTotalThb,
        payment_status: finalPaymentStatus,
        paid_amount_lak: finalPaidAmount,
        debt_amount_lak: finalDebtAmount,
        notes: note.trim(),
        items,
      };

      const res = await processMultiProductGRN(grnPayload);

      if (res.success) {
        handleBackToList();
        onAlert?.(
          editingPoId
            ? `ອັບເດດໃບຮັບສິນຄ້າ ${effectivePoCode} (${items.length} ລາຍການ) ສຳເລັດ!`
            : `ບັນທຶກຮັບສິນຄ້າ ${items.length} ລາຍການເຂົ້າສາງສຳເລັດແລ້ວ!`,
          'ສຳເລັດ',
          'success'
        );
        await syncAllCaches();
        await onRefresh?.();
      } else {
        onAlert?.(res.error || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ', 'ຂໍ້ຜິດພາດ', 'error');
      }
    } finally {
      setIsSubmittingGRN(false);
    }
  };

  // Delete GRN Confirmation Submission (VẤN ĐỀ 4: Xóa phiếu nhập & hoàn kho)
  const handleConfirmDeletePo = async () => {
    if (!poToDelete) return;

    setIsDeletingPo(true);
    try {
      const res = await deletePurchaseOrderInSupabase(poToDelete.id);
      if (res.success) {
        const delName = getOrderProductName(poToDelete);
        // Đóng modal xác nhận xóa ngay lập tức
        setPoToDelete(null);

        onAlert?.(
          `ລຶບໃບຮັບສິນຄ້າ "${delName}" ແລະ ຫັກລົບສະຕັອກຄືນສຳເລັດແລ້ວ!`,
          'ສຳເລັດ',
          'success'
        );
        await syncAllCaches();
        await onRefresh?.();
      } else {
        onAlert?.(res.error || 'ເກີດຂໍ້ຜິດພາດໃນການລຶບໃບຮັບສິນຄ້າ', 'ຂໍ້ຜິດພາດ', 'error');
      }
    } finally {
      setIsDeletingPo(false);
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
        await syncAllCaches();
        await onRefresh?.();
      } else {
        onAlert?.(res.error || 'ເກີດຂໍ້ຜິດພາດ', 'ຂໍ້ຜິດພາດ', 'error');
      }
    } finally {
      setIsSubmittingPayment(false);
    }
  };


  // Helper to format an individual item's quantity in its highest/original unit
  const formatGrnItemQuantity = (item) => {
    if (!item) return '-';
    // 1. If explicit input unit_name and quantity exist
    if (item.unit_name && (item.quantity !== undefined && item.quantity !== null && Number(item.quantity) > 0)) {
      const q = Number(item.quantity);
      const u = String(item.unit_name).trim();
      return `${q} ${u}`;
    }

    const prod = products.find((p) => p.id === item.product_id || (item.product_name && p.name === item.product_name));
    const sorted = prod ? getSortedUnits(prod) : [];
    const cName = sorted[0]?.unitName || 'ແກັດ';
    const pName = sorted[1]?.unitName || 'ແພັກ';
    const pcName = prod?.baseUnit || prod?.base_unit || 'ອັນ';

    // 2. If tier1/tier2/tier3 quantities exist
    if (item.tier1_qty > 0 || item.tier2_qty > 0 || item.tier3_qty > 0) {
      const parts = [];
      if (item.tier1_qty > 0) parts.push(`${item.tier1_qty} ${cName}`);
      if (item.tier2_qty > 0) parts.push(`${item.tier2_qty} ${pName}`);
      if (item.tier3_qty > 0) parts.push(`${item.tier3_qty} ${pcName}`);
      if (parts.length > 0) return parts.join(' ');
    }

    // 3. Decompose from catalog product multi-tier ratios if base units exist
    const baseUnits = Number(item.imported_base_units ?? item.base_units_added ?? 0);
    if (baseUnits > 0) {
      if (prod && sorted.length > 0) {
        const topUnit = sorted[0];
        const mult = Math.max(1, Number(topUnit.multiplier) || 1);
        if (mult > 1 && baseUnits >= mult && baseUnits % mult === 0) {
          return `${baseUnits / mult} ${topUnit.unitName}`;
        }
        const decomp = formatStockDisplay(baseUnits, sorted, prod.baseUnit || prod.base_unit || 'ອັນ');
        if (decomp) return decomp;
      }
      return `${baseUnits} ${prod?.baseUnit || prod?.base_unit || 'ອັນ'}`;
    }

    return '-';
  };

  // Helper to format quantity of an order in largest units
  const formatOrderQuantity = (po) => {
    const prod = products.find((p) => p.id === po.product_id || (po.product_name && p.name === po.product_name));
    const sorted = prod ? getSortedUnits(prod) : [];
    const cName = sorted[0]?.unitName || 'ແກັດ';
    const pName = sorted[1]?.unitName || 'ແພັກ';
    const pcName = prod?.baseUnit || prod?.base_unit || 'ອັນ';

    // 1. If order has single-product fields
    if (po.tier1_qty || po.tier2_qty || po.tier3_qty) {
      const parts = [];
      if (po.tier1_qty > 0) parts.push(`${po.tier1_qty} ${cName}`);
      if (po.tier2_qty > 0) parts.push(`${po.tier2_qty} ${pName}`);
      if (po.tier3_qty > 0) parts.push(`${po.tier3_qty} ${pcName}`);
      if (parts.length > 0) return parts.join(' ');
    }

    // 2. Check purchase_order_items
    if (po.purchase_order_items && po.purchase_order_items.length > 0) {
      const first = po.purchase_order_items[0];
      const firstStr = formatGrnItemQuantity(first);
      if (po.purchase_order_items.length > 1) {
        return `${firstStr} (+${po.purchase_order_items.length - 1} ລາຍການ)`;
      }
      return firstStr;
    }

    // 3. Single-product order fallback with imported_base_units
    if (po.imported_base_units) {
      if (prod && sorted.length > 0) {
        const topUnit = sorted[0];
        const mult = Math.max(1, Number(topUnit.multiplier) || 1);
        if (mult > 1 && po.imported_base_units >= mult && po.imported_base_units % mult === 0) {
          return `${po.imported_base_units / mult} ${topUnit.unitName}`;
        }
        const decomp = formatStockDisplay(po.imported_base_units, sorted, prod.baseUnit || prod.base_unit || 'ອັນ');
        if (decomp) return decomp;
      }
      return `${po.imported_base_units} ${prod?.baseUnit || prod?.base_unit || 'ອັນ'}`;
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
  // RENDER: FULLSCREEN ENTRY FORM (PART 2 - MULTI-PRODUCT GRN)
  // =========================================================================
  if (viewMode === 'ENTRY') {
    return (
      <MultiProductGRNForm
        editingPoId={editingPoId}
        poCode={poCode}
        setPoCode={setPoCode}
        suppliers={suppliers}
        products={products}
        selectedSupplierId={selectedSupplierId}
        setSelectedSupplierId={setSelectedSupplierId}
        receivedBy={receivedBy}
        setReceivedBy={setReceivedBy}
        note={note}
        setNote={setNote}
        currentExchangeRate={currentExchangeRate}
        setCurrentExchangeRate={setCurrentExchangeRate}
        grnCartItems={grnCartItems}
        setGrnCartItems={setGrnCartItems}
        paymentStatus={paymentStatus}
        setPaymentStatus={setPaymentStatus}
        paidAmount={paidAmount}
        setPaidAmount={setPaidAmount}
        totalCostLakNumber={totalCostLakNumber}
        totalCostThbNumber={totalCostThbNumber}
        debtAmountNumber={debtAmountNumber}
        isSubmittingGRN={isSubmittingGRN}
        onBackToList={handleBackToList}
        onAddToCart={handleAddToCart}
        onUpdateItemQuantity={handleUpdateItemQuantity}
        onStepItemQuantity={handleStepItemQuantity}
        onUpdateItemUnit={handleUpdateItemUnit}
        onUpdateItemCostThb={handleUpdateItemCostThb}
        onUpdateItemCostLak={handleUpdateItemCostLak}
        onToggleItemCostMode={handleToggleItemCostMode}
        onToggleAllItemsCostMode={handleToggleAllItemsCostMode}
        onToggleItemRetail={handleToggleItemRetail}
        onUpdateItemRetailPrice={handleUpdateItemRetailPrice}
        onRemoveItem={handleRemoveItem}
        onSubmitGRN={handleSubmitGRN}
        onOpenSupplierManager={onOpenSupplierManager}
        onAlert={onAlert}
      />
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
                          onClick={() => setPoToDelete(po)}
                          className="p-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer transition-colors border border-rose-200"
                          title="ລຶບໃບຮັບສິນຄ້າ"
                        >
                          <Trash size={15} />
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
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 text-xs">
                      <th className="py-3.5 px-4 font-bold">ລະຫັດບິນ & ວັນທີ</th>
                      <th className="py-3.5 px-4 font-bold">ຮ້ານສົ່ງ</th>
                      <th className="py-3.5 px-4 font-bold">ສິນຄ້າ & ຈຳນວນ</th>
                      <th className="py-3.5 px-4 text-right font-bold">ມູນຄ່າຮັບເຂົ້າ ₭</th>
                      <th className="py-3.5 px-4 text-right font-bold">ມູນຄ່າຮັບເຂົ້າ ฿</th>
                      <th className="py-3.5 px-4 text-center font-bold">ສະຖານະຊຳລະ</th>
                      <th className="py-3.5 px-4 text-right font-bold">ໜີ້ຄ້າງຊຳລະ</th>
                      <th className="py-3.5 px-4 text-center font-bold">ຈັດການ</th>
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
                          <td className="py-2.5 px-4">
                            <div className="font-mono font-bold text-slate-900 text-[12.5px]">{po.id}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{dateFormatted}</div>
                          </td>

                          {/* ຮ້ານສົ່ງ */}
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-800 text-[12.5px]">
                              {po.suppliers?.name || 'ບໍ່ລະບຸຜູ້ສະໜອງ'}
                            </div>
                            {po.received_by && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                ຜູ້ຮັບ: {po.received_by}
                              </div>
                            )}
                          </td>

                          {/* ສິນຄ້າ & ຈຳນວນ */}
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900 truncate max-w-xs text-[12.5px]" title={prodName}>
                              {prodName}
                            </div>
                            <div className="text-[11px] font-mono text-teal-700 font-bold mt-0.5">
                              {qtyDisplay}
                            </div>
                          </td>

                          {/* ມູນຄ່າຮັບເຂົ້າ ₭ */}
                          <td className="py-3 px-4 text-right font-bold text-slate-900 text-[13.5px]">
                            {formatKip(po.total_cost_lak)}
                          </td>

                          {/* ມູນຄ່າຮັບເຂົ້າ ฿ */}
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-600 text-[13px]">
                            {Number(po.total_cost_thb) > 0 ? `${formatThb(po.total_cost_thb)} ฿` : '-'}
                          </td>

                          {/* ສະຖານະຊຳລະ */}
                          <td className="py-3 px-4 text-center">
                            {po.payment_status === 'PAID' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                <CheckCircle size={13} weight="bold" />
                                <span>ຈ່າຍຄົບ</span>
                              </span>
                            )}
                            {po.payment_status === 'PARTIAL' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <span>ຈ່າຍບາງສ່ວນ</span>
                              </span>
                            )}
                            {po.payment_status === 'DEBT' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                                <span>ຕິດໜີ້</span>
                              </span>
                            )}
                          </td>

                          {/* ໜີ້ຄ້າງຊຳລະ */}
                          <td className="py-3 px-4 text-right font-mono text-[13.5px]">
                            {debt > 0 ? (
                              <span className="text-rose-600 font-extrabold">
                                {formatDots(debt)} ₭
                              </span>
                            ) : (
                              <span className="text-teal-700 font-semibold text-[13px]">0 ₭</span>
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
                                <PencilSimple size={17} />
                              </button>

                              <button
                                type="button"
                                onClick={() => setPoToDelete(po)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                title="ລຶບໃບຮັບສິນຄ້າ"
                              >
                                <Trash size={17} />
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedPoForDetails(po)}
                                className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors"
                                title="ເບິ່ງລາຍລະອຽດ"
                              >
                                <Eye size={18} />
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
                                  <HandCoins size={15} weight="bold" />
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
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-teal-700">
                              {formatGrnItemQuantity(it)}
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

      {/* ============================================================== */}
      {/* MODAL 3: Confirm Delete GRN Modal & Stock Reversion            */}
      {/* ============================================================== */}
      {poToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Trash size={20} weight="bold" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  ຢືນຢັນການລຶບໃບຮັບສິນຄ້າ
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPoToDelete(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Warning Box */}
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5">
              <WarningCircle size={20} className="text-rose-600 shrink-0 mt-0.5" weight="fill" />
              <div className="text-xs text-rose-900 font-semibold leading-relaxed">
                ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບໃບຮັບສິນຄ້ານີ້? ລະບົບຈະຫັກລົບສະຕັອກທີ່ເຄີຍນຳເຂົ້າອອກຈາກສາງອັດຕະໂນມັດ.
              </div>
            </div>

            {/* Details Summary */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/90 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">ລະຫັດບິນ:</span>
                <span className="font-bold text-slate-900">{poToDelete.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">ສິນຄ້າ:</span>
                <span className="font-bold text-slate-900 truncate max-w-[200px]">
                  {getOrderProductName(poToDelete)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">ຈຳນວນຫັກລົບ:</span>
                <span className="font-bold text-rose-600">
                  - {formatOrderQuantity(poToDelete)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/80">
                <span className="text-slate-500 font-sans">ມູນຄ່າລວມ:</span>
                <span className="font-bold text-slate-900">
                  {formatKip(poToDelete.total_cost_lak)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPoToDelete(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                disabled={isDeletingPo}
                onClick={handleConfirmDeletePo}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black cursor-pointer disabled:opacity-50 shadow-xs flex items-center gap-1.5"
              >
                <Trash size={15} weight="bold" />
                <span>{isDeletingPo ? 'ກຳລັງລຶບ...' : 'ຢືນຢັນລຶບ & ຫັກສະຕັອກ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
