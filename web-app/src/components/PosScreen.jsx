import React, { useState, useEffect, useRef } from 'react';
import {
  MagnifyingGlass,
  Plus,
  Minus,
  Trash,
  User,
  SlidersHorizontal,
  Package,
  ShoppingCart,
  PencilSimple,
  Barcode,
  CheckCircle,
  WarningCircle,
  CornersOut,
  FileText,
  Money,
  QrCode,
  HandCoins,
  Check,
  Tag,
  CaretDown,
  XCircle,
  X,
} from '@phosphor-icons/react';
import { formatKip, formatCompoundStock, formatStockDisplay, formatNegativeStockCompound, formatDots, getEffectiveUnitPrice, PRICE_TIERS } from '../utils/formatters';
import PriceOverrideModal from './PriceOverrideModal';
import BarcodeScannerModal from './BarcodeScannerModal';
import QuotationPreviewModal from './inventory/QuotationPreviewModal';
import ExchangeRateBadge from './common/ExchangeRateBadge';
import queryClient from '../services/queryClient';
import { useHardwareBarcodeScanner } from '../hooks/useHardwareBarcodeScanner';
import {
  playSuccessBeep,
  playErrorBeep,
  playPriceTierBeep,
  playActionClickBeep,
  playUnitChangeBeep,
} from '../utils/audioFeedback';

/**
 * Interactive Cart Quantity Stepper:
 * - Allows typing directly (e.g. 50 items)
 * - Auto-selects all text on focus for instant overwrite (type '50' without needing backspace)
 * - Allows deleting/clearing to empty string without removing the item or resetting to 1 while typing
 * - Safely restores to 1 onBlur if left empty or <= 0
 * - Wider width (w-10 sm:w-11) to comfortably display 2-3 digits
 */
function CartQuantityStepper({ quantity, onUpdateQuantity, onStepQuantity }) {
  const [localQty, setLocalQty] = useState(
    quantity !== undefined && quantity !== null && quantity !== '' ? String(quantity) : '1'
  );

  // Sync external quantity changes (e.g. step button clicks or cart reset)
  useEffect(() => {
    if (quantity !== undefined && quantity !== null) {
      setLocalQty(quantity === '' ? '' : String(quantity));
    }
  }, [quantity]);

  const handleChange = (e) => {
    const val = e.target.value;
    // Allow empty string so user can clear and type directly without item being deleted
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

  const handleFocus = (e) => {
    e.target.select();
  };

  return (
    <div className="h-6.5 rounded-md border border-slate-200 bg-slate-50 flex items-center p-0.5 shrink-0 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/30 transition-all">
      <button
        type="button"
        onClick={() => onStepQuantity?.(-1)}
        className="w-4 h-5.5 rounded flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all cursor-pointer font-bold shrink-0"
        title="ຫຼຸດຈຳນວນ"
      >
        <Minus size={10} weight="bold" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={localQty}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        className="w-7 sm:w-11 h-5 text-center font-black text-xs font-mono text-slate-900 tabular-nums bg-transparent border-0 focus:outline-none p-0 selection:bg-teal-500 selection:text-white"
        title="ກົດເພື່ອພິມຈຳນວນທີ່ຕ້ອງການ"
      />
      <button
        type="button"
        onClick={() => onStepQuantity?.(1)}
        className="w-4 h-5.5 rounded flex items-center justify-center text-teal-800 hover:bg-white active:scale-95 transition-all cursor-pointer font-bold shrink-0"
        title="ເພີ່ມຈຳນວນ"
      >
        <Plus size={10} weight="bold" />
      </button>
    </div>
  );
}

export default function PosScreen({
  categories,
  activeCategory,
  setActiveCategory,
  searchQuery,
  setSearchQuery,
  filteredProducts,
  products = [],
  addToCart,
  openUnitSelector,
  cart,
  customerName,
  setCustomerName,
  updateCartQuantity,
  removeFromCart,
  setCart,
  cartSubtotal,
  handleOpenCheckout,
  toggleCartItemCrateDeposit,
  updateMissingCrates,
  changeCartItemUnit,
  toggleCartItemHalfCarton,
  globalPriceTier = 1,
  setGlobalPriceTier,
  changeCartItemPriceTier,
  editingOldTransaction = null,
  onCancelEditOrder,
  exchangeRate = 0,
  setExchangeRate,
}) {
  // Modal for editing line item price (familiar customer / price override)
  const [overrideModalItem, setOverrideModalItem] = useState(null);
  const [openPriceMenuKey, setOpenPriceMenuKey] = useState(null);
  const [openHalfCartonMenuKey, setOpenHalfCartonMenuKey] = useState(null);
  const [customPriceInput, setCustomPriceInput] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanToast, setScanToast] = useState(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);
  const searchInputRef = useRef(null);

  const handleClearSearch = () => {
    if (setSearchQuery) {
      setSearchQuery('');
    }
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleScanBarcode = (barcode) => {
    if (!barcode) return;
    const cleanCode = String(barcode).trim().toLowerCase();

    // Check all products
    const productPool = products && products.length > 0 ? products : filteredProducts;
    const matched = productPool.find(
      (p) =>
        (p.barcode && String(p.barcode).trim().toLowerCase() === cleanCode) ||
        (p.units && p.units.some((u) => u.barcode && String(u.barcode).trim().toLowerCase() === cleanCode))
    );

    if (matched) {
      // Find matching unit or default to piece / first unit
      let targetUnit = matched.units?.[0];
      const matchingUnit = matched.units?.find(
        (u) => u.barcode && String(u.barcode).trim().toLowerCase() === cleanCode
      );
      if (matchingUnit) {
        targetUnit = matchingUnit;
      } else if (matched.units && matched.units.length > 0) {
        targetUnit = matched.units.find((u) => u.tier === 1) || matched.units[0];
      } else {
        targetUnit = {
          id: `${matched.id}_default`,
          unitName: matched.baseUnit || 'ອັນ',
          multiplier: 1,
          retailPrice: matched.price || matched.retailPrice || 0,
        };
      }

      // Automatically add product or increment +1 in cart (barcode scan uses playSuccessBeep)
      addToCart(matched, targetUnit, 1, { silent: true });
      playSuccessBeep();
      setScannerOpen(false);
      setSearchQuery('');
      setScanToast({
        type: 'success',
        message: `ເພີ່ມ "${matched.name}" (${targetUnit.unitName}) +1 ເຂົ້າກະຕ່າແລ້ວ!`,
      });
      setTimeout(() => setScanToast(null), 3000);
    } else {
      playErrorBeep();
      setScanToast({
        type: 'error',
        message: `ບໍ່ພົບສິນຄ້າທີ່ມີບາໂຄດ: "${barcode}"`,
      });
      setTimeout(() => setScanToast(null), 4000);
    }
  };

  // Global Hardware Barcode Scanner Listener (USB / OTG / Bluetooth HID Keyboard)
  // Auto-detects rapid keystrokes (< 50ms) ending in Enter without requiring focus
  useHardwareBarcodeScanner({
    onScan: handleScanBarcode,
    enabled: true,
    maxInterval: 50,
    minLength: 3,
    preventDefaultOnEnter: true,
    cleanActiveInput: true,
  });

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      handleScanBarcode(searchQuery);
    }
  };

  const handleApplyPriceOverride = (productId, unitId, newPrice, reason) => {
    setCart(
      cart.map((item) => {
        if (item.product.id === productId && item.unit.id === unitId) {
          return {
            ...item,
            customPrice: newPrice,
            overrideReason: reason || 'ລູກຄ້າປະຈຳ',
          };
        }
        return item;
      })
    );
  };

  const handleResetPriceOverride = (productId, unitId) => {
    setCart(
      cart.map((item) => {
        if (item.product.id === productId && item.unit.id === unitId) {
          const { customPrice, overrideReason, ...rest } = item;
          return rest;
        }
        return item;
      })
    );
  };

  // Reusable Edit Order Banner per DESIGN.md:
  // ກຳລັງແກ້ໄຂບິນ: #[receipt_number] | ຮູບແບບຊຳລະເດີມ: [Badge Tiền mặt / Chuyển khoản / Nợ]
  const renderEditingBanner = () => {
    if (!editingOldTransaction) return null;

    const rawMethod = (
      editingOldTransaction.originalPaymentMethod ||
      editingOldTransaction.paymentMethod ||
      editingOldTransaction.payment_method ||
      ''
    ).toUpperCase();
    const isDebt =
      rawMethod === 'DEBT' ||
      Boolean(editingOldTransaction.isDebt || editingOldTransaction.is_debt);
    const isTransfer =
      rawMethod === 'TRANSFER' ||
      rawMethod === 'ONEPAY' ||
      rawMethod === 'QR';
    const isCash = !isDebt && !isTransfer;

    const custName =
      editingOldTransaction.originalCustomerName ||
      editingOldTransaction.customerName ||
      editingOldTransaction.customer_name ||
      'ລູກຄ້າທົ່ວໄປ';

    const remainingDebt = Number(
      editingOldTransaction.originalRemainingDebt ??
      editingOldTransaction.debtAmount ??
      editingOldTransaction.debt_amount ??
      editingOldTransaction.remainingDebt ??
      editingOldTransaction.remaining_debt ??
      0
    );

    return (
      <div className="bg-amber-500 text-white p-2 px-3 flex items-center justify-between gap-2 shadow-xs shrink-0 sticky top-0 z-20 border-b border-amber-600">
        <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto whitespace-nowrap scrollbar-none text-[11px] font-bold">
          <WarningCircle size={15} weight="fill" className="text-white shrink-0" />
          <span>ກຳລັງແກ້ໄຂບິນ: #{editingOldTransaction.receiptNumber || editingOldTransaction.originalReceiptNumber}</span>
          <span className="text-amber-200">|</span>
          <span className="text-amber-100">ຮູບແບບຊຳລະເດີມ:</span>
          {isCash && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shadow-2xs">
              <Money size={12} weight="bold" />
              <span>ເງິນສົດ (Cash)</span>
            </span>
          )}
          {isTransfer && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold shadow-2xs">
              <QrCode size={12} weight="bold" />
              <span>ໂອນເງິນ (Transfer)</span>
            </span>
          )}
          {isDebt && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-bold shadow-2xs font-mono"
              style={{ backgroundColor: '#EF4444' }}
            >
              <HandCoins size={12} weight="bold" />
              <span>ຕິດໜີ້ ({formatDots(remainingDebt)} ₭)</span>
            </span>
          )}
          {custName && custName !== 'ລູກຄ້າທົ່ວໄປ' && (
            <>
              <span className="text-amber-200">|</span>
              <span className="text-amber-100 font-medium">ລູກຄ້າ: {custName}</span>
            </>
          )}
        </div>
        {onCancelEditOrder && (
          <button
            type="button"
            onClick={onCancelEditOrder}
            className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shrink-0 cursor-pointer transition-all shadow-2xs"
          >
            ຍົກເລີກ
          </button>
        )}
      </div>
    );
  };

  // Reusable High-Density Compact Cart for Desktop (35%) & Mobile Drawer
  const renderCartContent = (isDrawer = false) => (
    <div className="flex flex-col h-full max-h-full min-h-0 overflow-hidden bg-white">
      {/* 1. Sticky Amber Banner when editing an old transaction */}
      {renderEditingBanner()}

      {/* 2. Compact Cart Header: Title, Customer Name & Clear */}
      <div className={`p-2 sm:p-3 border-b border-slate-100 flex flex-col gap-1.5 shrink-0 bg-slate-50/80 ${isDrawer ? 'pt-1.5' : ''}`}>
        {!isDrawer && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShoppingCart size={16} className="text-teal-700" weight="bold" />
              <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">ກະຕ່າສິນຄ້າ</span>
              <span className="px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded-full text-[10px] font-bold font-mono">
                {cart.length} ລາຍການ
              </span>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-slate-400 hover:text-rose-600 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer transition-colors"
                title="ລ້າງສິນຄ້າທັງໝົດໃນກະຕ່າ"
              >
                <Trash size={13} />
                <span>ລ້າງ</span>
              </button>
            )}
          </div>
        )}

        {/* Customer Name Input & Quick Chips */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <User
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="ຊື່ລູກຄ້າ / Customer..."
              className="w-full h-8 pl-7 pr-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-bold shadow-2xs"
            />
          </div>
          {/* Quick chips */}
          <div className="flex items-center gap-1 shrink-0">
            {['ທົ່ວໄປ', 'VIP'].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  playUnitChangeBeep();
                  setCustomerName(name === 'ທົ່ວໄປ' ? 'ລູກຄ້າທົ່ວໄປ' : name);
                }}
                className={`px-2 py-1 rounded-md text-[10.5px] font-bold border transition-all cursor-pointer ${
                  customerName === name || (name === 'ທົ່ວໄປ' && customerName === 'ລູກຄ້າທົ່ວໄປ')
                    ? 'bg-teal-50 border-teal-400 text-teal-800 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Global Price Mode (Chọn nhanh mức giá ລາຄາ 1-2-3 cho toàn bộ giỏ hàng ngay dưới tên khách) */}
        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/90">
          <div className="flex items-center gap-1 shrink-0">
            <SlidersHorizontal size={13} className="text-slate-500" />
            <span className="text-[11px] font-extrabold text-slate-700 tracking-tight">
              ລະດັບລາຄາ:
            </span>
          </div>

          <div className="inline-flex items-center bg-slate-200/90 p-0.5 rounded-lg border border-slate-300 gap-1">
            {[
              { id: 1, label: 'ລາຄາ 1', desc: 'ມາດຕະຖານ', activeClass: 'bg-teal-600 text-white shadow-xs font-black ring-1 ring-teal-700/20' },
              { id: 2, label: 'ລາຄາ 2', desc: 'ລູກຄ້າປະຈຳ', activeClass: 'bg-sky-600 text-white shadow-xs font-black ring-1 ring-sky-700/20' },
              { id: 3, label: 'ລາຄາ 3', desc: 'ຂາຍສົ່ງ/VIP', activeClass: 'bg-amber-600 text-white shadow-xs font-black ring-1 ring-amber-700/20' },
            ].map((tier) => {
              const isSelected = (globalPriceTier || 1) === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => {
                    playUnitChangeBeep();
                    if (setGlobalPriceTier) {
                      setGlobalPriceTier(tier.id);
                    }
                  }}
                  className={`h-6 px-2.5 rounded-md text-[11px] transition-all cursor-pointer flex items-center justify-center select-none active:scale-95 ${
                    isSelected
                      ? tier.activeClass
                      : 'text-slate-600 font-bold hover:text-slate-900 hover:bg-slate-300/70'
                  }`}
                  title={`ນຳໃຊ້ ${tier.label} (${tier.desc}) ໃຫ້ທຸກລາຍການໃນກະຕ່າ`}
                >
                  <span>{tier.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. High-Density Cart Item List (BẮT BUỘC flex-1 VÀ overflow-y-auto để cuộn độc lập) */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-2 min-h-0">
        {cart.map((item) => {
          const itemKey = `${item.product.id}_${item.unit.id}`;
          const currentTier = item.selectedPriceTier || 1;
          const tierPrice = getEffectiveUnitPrice(item.unit, currentTier);
          const standardPrice = item.isHalfCarton ? Math.round(tierPrice / 2) : tierPrice;
          const effectivePrice =
            item.customPrice !== undefined && item.customPrice !== null
              ? item.customPrice
              : standardPrice;
          const isOverridden =
            item.customPrice !== undefined &&
            item.customPrice !== null &&
            item.customPrice !== standardPrice;

          // Specialized Crate Deposit / Missing Crate Fee Logic
          const isCrateEligible =
            Boolean(item.product?.hasCrateDeposit) ||
            Boolean(
              (item.product?.category === 'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ' ||
                item.product?.name?.includes('ເບຍ')) &&
                (item.unit?.unitName === 'ແກັດ' ||
                  item.unit?.unitName === 'ລັງ' ||
                  (item.unit?.multiplier && item.unit.multiplier >= 12))
            );
          const feePerCrate = Number(item.product?.crateDepositFee) || 30000;
          const missingCount = item.noEmptyCrates
            ? Math.max(1, Math.min(item.quantity, Number(item.missingCratesCount) || item.quantity))
            : 0;
          const crateFeeTotal = item.noEmptyCrates ? missingCount * feePerCrate : 0;
          const lineTotal = effectivePrice * item.quantity + crateFeeTotal;

          const imgUrl = item.product?.imageUrl || item.product?.image_url;

          const isPriceMenuOpen = openPriceMenuKey === itemKey;

          return (
            <div
              key={`${item.product.id}_${item.unit.id}`}
              className={`p-1.5 px-2 rounded-lg border bg-white flex flex-col gap-1 transition-all shadow-2xs ${
                isPriceMenuOpen ? 'relative z-30 overflow-visible' : 'relative z-0'
              } ${
                isOverridden ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              {/* Product Thumbnail (Left) + 2 Rows (Right) */}
              <div className="flex items-center gap-2">
                {/* Product Thumbnail (36px x 36px siêu gọn) */}
                <div className="w-9 h-9 rounded-md bg-slate-100 overflow-hidden shrink-0 border border-slate-200/80 flex items-center justify-center self-center">
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Package size={18} className="text-slate-300" weight="duotone" />
                  )}
                </div>

                {/* 2 Rows Container */}
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-0.5">
                  {/* Row 1: Product Name (Left) vs Single Price Button + Trash Button (Right) */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-semibold text-xs text-slate-900 truncate" title={item.product.name}>
                        {item.product.name}
                      </span>
                      {(() => {
                        const trackStock = item.product?.trackStock !== false;
                        if (!trackStock) return null;
                        const currStock = Number(item.product?.currentStockBaseUnits ?? item.product?.current_stock_base_units ?? 0);
                        const multiplier = Number(item.unit?.multiplier) || 1;
                        const lineBaseQty = multiplier * (Number(item.quantity) || 1);
                        if (currStock < lineBaseQty || currStock <= 0) {
                          return (
                            <span
                              className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0"
                              title="ຂາຍເກີນຈຳນວນສະຕັອກທີ່ມີ (ຂາຍຕິດລົບ)"
                            >
                              (ຂາຍຕິດລົບ)
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* Bên phải: NƠI ĐẶT NÚT CHỌN GIÁ DUY NHẤT dạng [ {đơn_giá} ₭ ▾ ] + Icon Thùng rác */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* NÚT CHỌN GIÁ DUY NHẤT */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            if (isPriceMenuOpen) {
                              setOpenPriceMenuKey(null);
                            } else {
                              setOpenPriceMenuKey(itemKey);
                              setCustomPriceInput(effectivePrice > 0 ? formatDots(effectivePrice) : '');
                            }
                          }}
                          className={`h-6 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-md px-2 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs ${
                            isOverridden ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-400/40' : ''
                          }`}
                          title="ກົດເພື່ອເລືອກລະດັບລາຄາ ຫຼື ປັບລາຄາພິເສດ"
                        >
                          <Tag size={11} weight="bold" className={isOverridden ? 'text-amber-800' : 'text-teal-700'} />
                          <span className="font-mono tabular-nums">{formatDots(effectivePrice)} ₭</span>
                          <CaretDown size={10} weight="bold" className="opacity-70" />
                        </button>

                        {/* MENU DROPDOWN POPOVER ALL-IN-ONE (bắt buộc neo theo mép phải right-0) */}
                        {isPriceMenuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setOpenPriceMenuKey(null)}
                            />
                            <div className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-lg border border-slate-200 p-2 min-w-[260px] max-w-[280px] w-[270px] flex flex-col gap-1 animate-in fade-in-50 zoom-in-95">
                              {/* Header */}
                              <div className="px-1 py-0.5 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                <span>ເລືອກລະດັບລາຄາ:</span>
                                <span className="text-teal-700 font-extrabold">{item.unit.unitName}</span>
                              </div>

                              {/* Khu vực 1: Chọn nhanh mức giá cấu hình sẵn */}
                              {(() => {
                                const tiers = [
                                  {
                                    tierNum: 1,
                                    label: 'ລາຄາ 1 (ມາດຕະຖານ)',
                                    price: Number(item.unit.retailPrice ?? item.unit.retail_price ?? item.unit.price ?? 0),
                                  },
                                  {
                                    tierNum: 2,
                                    label: 'ລາຄາ 2 (ລູກຄ້າປະຈຳ)',
                                    price: Number(item.unit.price_2 ?? item.unit.price2 ?? 0),
                                  },
                                  {
                                    tierNum: 3,
                                    label: 'ລາຄາ 3 (VIP/ຂາຍສົ່ງ)',
                                    price: Number(item.unit.price_3 ?? item.unit.price3 ?? 0),
                                  },
                                ];
                                const availableTiers = tiers.filter((t) => t.price > 0);
                                const displayTiers = availableTiers.length > 0 ? availableTiers : [tiers[0]];

                                return (
                                  <div className="flex flex-col gap-0.5">
                                    {displayTiers.map(({ tierNum, label, price }) => {
                                      const isSelected = currentTier === tierNum && !isOverridden;
                                      return (
                                        <button
                                          key={tierNum}
                                          type="button"
                                          onClick={() => {
                                            playPriceTierBeep();
                                            if (isOverridden) {
                                              handleResetPriceOverride(item.product.id, item.unit.id);
                                            }
                                            if (changeCartItemPriceTier) {
                                              changeCartItemPriceTier(item.product.id, item.unit.id, tierNum);
                                            }
                                            setOpenPriceMenuKey(null);
                                          }}
                                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-50 cursor-pointer text-xs transition-colors ${
                                            isSelected
                                              ? 'bg-teal-50 text-teal-900 font-bold'
                                              : 'text-slate-700 font-medium'
                                          }`}
                                        >
                                          <span className={`whitespace-nowrap ${isSelected ? 'text-teal-950 font-bold' : 'text-slate-700'}`}>
                                            {label}
                                          </span>
                                          <div className="font-bold text-slate-900 whitespace-nowrap flex items-center gap-1.5 font-mono tabular-nums shrink-0">
                                            <span>{formatDots(price)} ₭</span>
                                            {isSelected && (
                                              <Check size={14} weight="bold" className="text-teal-600 shrink-0" />
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              })()}

                              {/* Khu vực 2: Phân cách mảnh */}
                              <div className="border-t border-slate-100 my-1.5" />

                              {/* Khu vực 3: Nhập giá tùy chỉnh (Custom Override Price) */}
                              <div className="flex flex-col gap-1 px-1">
                                <span className="text-[10.5px] font-bold text-slate-500">
                                  ປ້ອນລາຄາຕາມໃຈ (Custom Price):
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={customPriceInput}
                                    onChange={(e) => {
                                      const cleanVal = e.target.value.replace(/\D/g, '');
                                      if (!cleanVal) {
                                        setCustomPriceInput('');
                                      } else {
                                        setCustomPriceInput(Number(cleanVal).toLocaleString('de-DE'));
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const cleanVal = String(customPriceInput).replace(/\D/g, '');
                                        const parsed = parseInt(cleanVal, 10);
                                        if (parsed > 0) {
                                          playPriceTierBeep();
                                          handleApplyPriceOverride(item.product.id, item.unit.id, parsed, 'ປັບລາຄາພິເສດ');
                                          setOpenPriceMenuKey(null);
                                        }
                                      }
                                    }}
                                    placeholder="ປ້ອນລາຄາ..."
                                    className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-mono font-bold tabular-nums focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cleanVal = String(customPriceInput).replace(/\D/g, '');
                                      const parsed = parseInt(cleanVal, 10);
                                      if (parsed > 0) {
                                        playPriceTierBeep();
                                        handleApplyPriceOverride(item.product.id, item.unit.id, parsed, 'ປັບລາຄາພິເສດ');
                                        setOpenPriceMenuKey(null);
                                      }
                                    }}
                                    className="h-8 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                                  >
                                    OK
                                  </button>
                                </div>
                                {isOverridden && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      playPriceTierBeep();
                                      handleResetPriceOverride(item.product.id, item.unit.id);
                                      setOpenPriceMenuKey(null);
                                    }}
                                    className="text-[10px] text-rose-600 hover:text-rose-700 font-bold text-center mt-1 py-0.5 cursor-pointer"
                                  >
                                    ຣີເຊັດກັບລາຄາເດີມ
                                  </button>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: HÀNG DƯỚI - GỌN GÀNG, KHÔNG CÒN NÚT GIÁ */}
                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    {/* Bên trái: CHỈ CÒN DUY NHẤT bộ chuyển đổi Đơn vị tính dạng Segmented Switch */}
                    <div className="flex items-center min-w-0">
                      {item.product?.units && item.product.units.length > 1 ? (
                        <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200/80 gap-0.5 shrink-0">
                          {(() => {
                            // Sắp xếp giảm dần: Đơn vị to nhất (Thùng) ở bên Trái -> Đơn vị tiếp theo (Pack) ở Giữa -> Đơn vị nhỏ nhất (Lẻ) ở bên Phải
                            const sortedCartUnits = [...item.product.units].sort((a, b) => {
                              const multA = Number(a.multiplier) || (a.tier === 3 ? 100 : a.tier === 2 ? 10 : 1);
                              const multB = Number(b.multiplier) || (b.tier === 3 ? 100 : b.tier === 2 ? 10 : 1);
                              return multB - multA;
                            });

                            return sortedCartUnits.map((u) => {
                            const isSelected = (u.id && u.id === item.unit.id) || u.unitName === item.unit.unitName;
                            const isCartonUnit =
                              u.tier === 3 ||
                              u.id?.endsWith('_carton') ||
                              ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'carton', 'box'].includes(String(u.unitName).trim().toLowerCase()) ||
                              (Number(u.multiplier) >= 12 && Number(u.multiplier) === Math.max(...(item.product.units || []).map(x => Number(x.multiplier) || 1)));

                            const isHalfCartonActive = isSelected && isCartonUnit && Boolean(item.isHalfCarton);
                            const isHalfMenuOpen = openHalfCartonMenuKey === `${itemKey}_${u.id || u.unitName}`;

                            const displayLabel = isSelected && isCartonUnit && isHalfCartonActive
                              ? '½ ' + u.unitName
                              : u.unitName;

                            return (
                              <div key={u.id || u.unitName} className="relative inline-flex items-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isSelected && isCartonUnit) {
                                      // If already selected, toggle the dropdown popover for 1 carton vs 1/2 carton
                                      setOpenHalfCartonMenuKey(isHalfMenuOpen ? null : `${itemKey}_${u.id || u.unitName}`);
                                    } else {
                                      // Switch to this unit normally
                                      setOpenHalfCartonMenuKey(null);
                                      if (changeCartItemUnit) {
                                        changeCartItemUnit(item.product.id, item.unit.id, u);
                                      }
                                    }
                                  }}
                                  className={`h-6 px-2 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                    isSelected
                                      ? (isHalfCartonActive
                                          ? 'bg-amber-600 text-white shadow-2xs'
                                          : 'bg-teal-600 text-white shadow-2xs')
                                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                  }`}
                                  title={
                                    isCartonUnit && isSelected
                                      ? 'ກົດອີກຄັ້ງເພື່ອເລືອກ 1 ແກັດ ຫຼື ½ ແກັດ (ເຄິ່ງແກັດ)'
                                      : `ປ່ຽນເປັນ ${u.unitName} (${formatDots(u.retailPrice)} ₭)`
                                  }
                                >
                                  <span>{displayLabel}</span>
                                  {isCartonUnit && isSelected && (
                                    <CaretDown size={9} weight="bold" className={`opacity-80 transition-transform ${isHalfMenuOpen ? 'rotate-180' : ''}`} />
                                  )}
                                </button>

                                {/* Dropdown Menu/Popover for Carton (1 ແກັດ vs ½ ແກັດ) */}
                                {isHalfMenuOpen && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      onClick={() => setOpenHalfCartonMenuKey(null)}
                                    />
                                    <div className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-1 min-w-[160px] flex flex-col gap-0.5 animate-in fade-in zoom-in-95">
                                      <div className="px-2 py-1 text-[9.5px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                        ຂະໜາດແກັດ / Quy cách:
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (toggleCartItemHalfCarton) {
                                            toggleCartItemHalfCarton(item.product.id, item.unit.id, false);
                                          }
                                          setOpenHalfCartonMenuKey(null);
                                        }}
                                        className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                          !isHalfCartonActive
                                            ? 'bg-teal-50 text-teal-900 font-bold'
                                            : 'text-slate-700 hover:bg-slate-50 font-medium'
                                        }`}
                                      >
                                        <span>1 {u.unitName} (ເຕັມ)</span>
                                        {!isHalfCartonActive && <Check size={13} weight="bold" className="text-teal-600" />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (toggleCartItemHalfCarton) {
                                            toggleCartItemHalfCarton(item.product.id, item.unit.id, true);
                                          }
                                          setOpenHalfCartonMenuKey(null);
                                        }}
                                        className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                          isHalfCartonActive
                                            ? 'bg-amber-50 text-amber-900 font-bold'
                                            : 'text-slate-700 hover:bg-slate-50 font-medium'
                                        }`}
                                      >
                                        <span>½ {u.unitName} (ເຄິ່ງ)</span>
                                        {isHalfCartonActive && <Check size={13} weight="bold" className="text-amber-600" />}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          });
                        })()}
                        </div>
                      ) : (
                        <div className="relative inline-flex items-center">
                          {(() => {
                            const u = item.unit;
                            const isCartonUnit =
                              u.tier === 3 ||
                              u.id?.endsWith('_carton') ||
                              ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'carton', 'box'].includes(String(u.unitName).trim().toLowerCase()) ||
                              Number(u.multiplier) >= 12;

                            const isHalfCartonActive = Boolean(item.isHalfCarton);
                            const isHalfMenuOpen = openHalfCartonMenuKey === `${itemKey}_single`;

                            const displayLabel = isCartonUnit && isHalfCartonActive
                              ? '½ ' + u.unitName
                              : u.unitName;

                            if (!isCartonUnit) {
                              return (
                                <span className="text-[11px] text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60 shrink-0">
                                  {u.unitName}
                                </span>
                              );
                            }

                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setOpenHalfCartonMenuKey(isHalfMenuOpen ? null : `${itemKey}_single`)}
                                  className={`h-6 px-2 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                    isHalfCartonActive
                                      ? 'bg-amber-600 text-white shadow-2xs'
                                      : 'bg-teal-600 text-white shadow-2xs'
                                  }`}
                                  title="ກົດເພື່ອເລືອກ 1 ແກັດ ຫຼື ½ ແກັດ (ເຄິ່ງແກັດ)"
                                >
                                  <span>{displayLabel}</span>
                                  <CaretDown size={9} weight="bold" className={`opacity-80 transition-transform ${isHalfMenuOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isHalfMenuOpen && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      onClick={() => setOpenHalfCartonMenuKey(null)}
                                    />
                                    <div className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-1 min-w-[160px] flex flex-col gap-0.5 animate-in fade-in zoom-in-95">
                                      <div className="px-2 py-1 text-[9.5px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                        ຂະໜາດແກັດ / Quy cách:
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (toggleCartItemHalfCarton) {
                                            toggleCartItemHalfCarton(item.product.id, item.unit.id, false);
                                          }
                                          setOpenHalfCartonMenuKey(null);
                                        }}
                                        className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                          !isHalfCartonActive
                                            ? 'bg-teal-50 text-teal-900 font-bold'
                                            : 'text-slate-700 hover:bg-slate-50 font-medium'
                                        }`}
                                      >
                                        <span>1 {u.unitName} (ເຕັມ)</span>
                                        {!isHalfCartonActive && <Check size={13} weight="bold" className="text-teal-600" />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (toggleCartItemHalfCarton) {
                                            toggleCartItemHalfCarton(item.product.id, item.unit.id, true);
                                          }
                                          setOpenHalfCartonMenuKey(null);
                                        }}
                                        className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                          isHalfCartonActive
                                            ? 'bg-amber-50 text-amber-900 font-bold'
                                            : 'text-slate-700 hover:bg-slate-50 font-medium'
                                        }`}
                                      >
                                        <span>½ {u.unitName} (ເຄິ່ງ)</span>
                                        {isHalfCartonActive && <Check size={13} weight="bold" className="text-amber-600" />}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Bên phải: Bộ nút tăng giảm số lượng [- 1 +] và nút thùng rác xóa món */}
                    <div className="flex items-center gap-1 shrink-0">
                      <CartQuantityStepper
                        quantity={item.quantity}
                        onUpdateQuantity={(newQty) =>
                          updateCartQuantity(item.product.id, item.unit.id, newQty)
                        }
                        onStepQuantity={(delta) =>
                          updateCartQuantity(item.product.id, item.unit.id, item.quantity + delta)
                        }
                      />

                      {/* Icon Thùng rác xóa món */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id, item.unit.id)}
                        className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-1 cursor-pointer shrink-0 transition-colors rounded"
                        title="ລຶບລາຍການ"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Beer Crate Deposit / Missing Crate Option (Slim & Compact) */}
              {isCrateEligible && (
                <div className="bg-amber-50/70 px-2.5 py-1 rounded-md border border-amber-200/80 flex items-center justify-between gap-1 mt-0.5">
                  <label className="flex items-center cursor-pointer select-none min-w-0">
                    <input
                      type="checkbox"
                      checked={Boolean(item.noEmptyCrates)}
                      onChange={(e) =>
                        toggleCartItemCrateDeposit &&
                        toggleCartItemCrateDeposit(item.product.id, item.unit.id, e.target.checked)
                      }
                      className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer shrink-0 accent-teal-600"
                    />
                    <span className="text-[11px] font-semibold text-amber-900 ml-1.5 truncate">
                      ບໍ່ມີແກັດປ່ຽນ (+{formatDots(feePerCrate)} ₭)
                    </span>
                  </label>

                  {item.noEmptyCrates && (
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="border border-amber-300 bg-white rounded flex items-center h-6 shadow-2xs">
                        <button
                          type="button"
                          onClick={() =>
                            updateMissingCrates &&
                            updateMissingCrates(
                              item.product.id,
                              item.unit.id,
                              (item.missingCratesCount || item.quantity) - 1
                            )
                          }
                          disabled={(item.missingCratesCount || item.quantity) <= 1}
                          className="w-5 h-5 flex items-center justify-center text-slate-700 hover:bg-amber-100 rounded cursor-pointer font-bold disabled:opacity-30 disabled:cursor-not-allowed text-[10px]"
                        >
                          -
                        </button>
                        <span className="px-1.5 font-mono font-bold text-[11px] text-slate-800">
                          {missingCount}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateMissingCrates &&
                            updateMissingCrates(
                              item.product.id,
                              item.unit.id,
                              (item.missingCratesCount || item.quantity) + 1
                            )
                          }
                          disabled={(item.missingCratesCount || item.quantity) >= item.quantity}
                          className="w-5 h-5 flex items-center justify-center text-slate-700 hover:bg-amber-100 rounded cursor-pointer font-bold disabled:opacity-30 disabled:cursor-not-allowed text-[10px]"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-[11px] font-bold font-mono tabular-nums text-amber-900 ml-0.5">
                        +{formatDots(crateFeeTotal)} ₭
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {cart.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
            <ShoppingCart size={36} className="mx-auto mb-1.5 opacity-40" />
            <p className="text-xs font-bold text-slate-600">ກະຕ່າຍັງວ່າງເປົ່າ</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ກົດປຸ່ມຫົວໜ່ວຍດ້ານຊ້າຍເພື່ອເລີ່ມຂາຍ
            </p>
          </div>
        )}
      </div>

      {/* 4. Footer Tổng tiền & Nút hành động: BẮT BUỘC shrink-0 dính sát đáy, không bao giờ bị che trên iPad Safari */}
      <div 
        className="shrink-0 p-2 sm:p-3 border-t border-slate-200 bg-slate-50/95 backdrop-blur-sm shadow-sm sticky bottom-0 z-20"
        style={{
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))'
        }}
      >
        {/* Hàng tổng tiền: Thu nhỏ font chữ, hiển thị trên 1 hàng ngang duy nhất */}
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            ຍອດລວມ (TOTAL):
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-bold text-slate-900 font-mono tracking-tight tabular-nums">
              {formatDots(cartSubtotal)}
            </span>
            <span className="text-sm font-bold text-slate-700">₭</span>
          </div>
        </div>

        {/* Hàng các nút hành động (Báo giá, Thanh toán): Chiều cao nút 36px - 40px gọn gàng */}
        <div className="grid grid-cols-2 gap-2">
          {/* Nút báo giá / Treo đơn */}
          <button
            type="button"
            onClick={() => {
              playActionClickBeep();
              setQuotationModalOpen(true);
            }}
            disabled={cart.length === 0}
            className={`h-9 sm:h-10 px-2 rounded-lg border text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer active:scale-98 ${
              cart.length > 0
                ? 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs'
                : 'border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
            title="ພິມໃບບອກລາຄາ / ໃບສະເໜີລາຄາຊົ່ວຄາວ (ບໍ່ຕັດສະຕັອກ)"
          >
            <FileText size={16} weight="bold" />
            <span>ໃບບອກລາຄາ</span>
          </button>

          {/* Nút Thanh toán Checkout */}
          <button
            type="button"
            onClick={() => {
              playActionClickBeep();
              if (isDrawer) setMobileCartOpen(false);
              handleOpenCheckout();
            }}
            disabled={cart.length === 0}
            className={`h-9 sm:h-10 px-3 rounded-lg text-xs sm:text-sm font-bold shadow-sm flex items-center justify-center gap-1.5 transition-colors active:scale-98 cursor-pointer ${
              cart.length > 0
                ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/25'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>{editingOldTransaction ? 'ບັນທຶກການແກ້ໄຂ' : 'ຊຳລະເງິນ'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <main className="flex-1 flex overflow-hidden w-full h-full min-h-0 font-sans relative bg-slate-100">
      {/* =========================================================================
          LEFT COLUMN (65% on Tablet & Desktop >= 768px):
          Danh mục & Lưới sản phẩm (Product Grid - High Density)
      ========================================================================= */}
      <section className="flex-1 md:flex-none md:w-[65%] min-w-0 border-r border-slate-200/80 bg-slate-50 flex flex-col h-full min-h-0 overflow-hidden">
        {/* Mobile Editing Order Banner (< 768px) */}
        <div className="md:hidden">
          {renderEditingBanner()}
        </div>

        {/* Top Control Bar: Search & Category tabs */}
        <div className="p-2.5 bg-white border-b border-slate-200/80 flex flex-col gap-2 shrink-0">
          {/* Thanh tìm kiếm nhanh kết hợp nút Quét mã vạch cao 44px, nhạy, dễ bấm */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 h-11">
              <MagnifyingGlass
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ ຫຼື ສະແກນບາໂຄດ..."
                className="w-full h-11 pl-9 pr-10 bg-slate-100/80 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white font-medium shadow-2xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full cursor-pointer transition-colors active:scale-90 flex items-center justify-center"
                  title="ລຶບການຄົ້ນຫາ (Clear search)"
                >
                  <XCircle size={18} weight="fill" />
                </button>
              )}
            </div>

            {/* Nút Quét mã vạch cao 44px */}
            <button
              type="button"
              onClick={() => {
                playActionClickBeep();
                setScannerOpen(true);
              }}
              className="h-11 px-3.5 rounded-xl bg-teal-50 hover:bg-teal-600 text-teal-700 hover:text-white border border-teal-200 shadow-2xs flex items-center gap-1.5 font-bold text-xs sm:text-sm cursor-pointer transition-all active:scale-95 shrink-0"
              title="ເປີດກ້ອງສະແກນບາໂຄດ (Camera Barcode Scanner) • ຮອງຮັບເຄື່ອງຍິງບາໂຄດ USB/Bluetooth ອັດຕະໂນມັດ"
            >
              <Barcode size={20} weight="bold" />
              <span className="hidden sm:inline">ສະແກນ</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" title="Hardware Scanner Ready"></span>
            </button>

            {/* Pill Badge hiển thị & điều chỉnh tỷ giá THB/LAK (Point-in-Time Snapshot) */}
            <ExchangeRateBadge
              exchangeRate={exchangeRate}
              onRateUpdated={setExchangeRate}
              queryClient={queryClient}
            />

            {/* Mobile Cart Trigger Button (< 768px) */}
            <button
              type="button"
              onClick={() => {
                playActionClickBeep();
                setMobileCartOpen(true);
              }}
              className="md:hidden relative h-11 px-3 rounded-xl bg-teal-600 text-white shadow-xs flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
              title="ເປີດກະຕ່າ"
            >
              <ShoppingCart size={18} weight="bold" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold font-mono border-2 border-white shadow-2xs">
                  {cart.reduce((s, i) => s + (i.quantity || 1), 0)}
                </span>
              )}
            </button>
          </div>

          {/* Thanh phân loại danh mục (Tabs) dạng pill cuộn ngang mượt mà */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    playUnitChangeBeep();
                    setActiveCategory(cat);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lưới sản phẩm (High-Density Grid: 2-3 cols mobile, 4-5-6 cols desktop) */}
        <div className="flex-1 min-h-0 p-2.5 overflow-y-auto overscroll-contain pb-24 sm:pb-12">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-2.5 w-full">
            {filteredProducts.map((p) => {
              const rawStock = p.currentStockBaseUnits ?? p.current_stock_base_units;
              const hasTrackStock = p.trackStock !== false;
              const stockVal = hasTrackStock && rawStock !== null && rawStock !== undefined && !isNaN(rawStock) ? Number(rawStock) : null;
              const isZeroStock = hasTrackStock && stockVal === 0;
              const isNegativeStock = hasTrackStock && stockVal !== null && stockVal < 0;

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl border border-slate-200/90 hover:border-teal-400 hover:shadow-xs transition-all duration-150 flex flex-col justify-between overflow-hidden group"
                >
                  {/* Top card area */}
                  <div
                    onClick={() => openUnitSelector(p)}
                    className="p-2 cursor-pointer flex-1 flex flex-col"
                  >
                    {/* Ảnh bo góc 12px với chiều cao thoáng hơn */}
                    <div className="relative h-28 sm:h-36 w-full rounded-[10px] overflow-hidden bg-slate-100 mb-1.5 shrink-0 flex items-center justify-center">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                          <Package size={36} weight="duotone" />
                          <span className="text-[10px] text-slate-400 mt-1">ບໍ່ມີຮູບ</span>
                        </div>
                      )}
                      {p.category && (
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.2 rounded bg-slate-950/70 backdrop-blur-xs text-[9px] text-white font-medium">
                          {p.category}
                        </span>
                      )}
                    </div>

                    {/* Tên sản phẩm gọn gàng */}
                    <h3
                      className="font-bold text-xs text-slate-900 leading-snug line-clamp-1"
                      title={p.name}
                    >
                      {p.name}
                    </h3>

                    {/* Hiển thị tồn kho hiện tại (Chuẩn phụ đề text-[11px] font-medium, mt-0.5 mb-1) */}
                    <div className="flex items-center mt-0.5 mb-1 pt-1 border-t border-slate-100 text-[11px] leading-tight">
                      {!hasTrackStock ? (
                        <span className="text-slate-400 font-medium text-[11px]">ບໍ່ນັບສາງ</span>
                      ) : isZeroStock ? (
                        <span className="text-amber-600 font-medium text-[11px]" title="ສິນຄ້າໝົດສາງ (ຂາຍຕໍ່ໄດ້)">
                          ໝົດສາງ (0)
                        </span>
                      ) : isNegativeStock ? (
                        <span className="text-rose-600 font-medium text-[11px] truncate" title={`ສະຕັອກ : ${stockVal}`}>
                          ສະຕັອກ : {stockVal}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium text-[11px] truncate" title={`ສະຕັອກ : ${formatStockDisplay(p, null, p.baseUnit || 'ອັນ')}`}>
                          ສະຕັອກ : <span className="text-slate-600 font-medium">{formatStockDisplay(p, null, p.baseUnit || 'ອັນ')}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Nút chọn cấp đơn vị (Thùng bên Trái -> Pack ở Giữa -> Lẻ bên Phải) cố định hàng ngang */}
                  <div className="p-1 bg-slate-50/90 border-t border-slate-100 flex flex-row items-center w-full gap-1">
                    {p.units && p.units.length > 0 ? (
                      (() => {
                        // Sắp xếp giảm dần: Cấp to nhất (Thùng / multiplier lớn nhất) ở bên trái -> Cấp nhỏ nhất ở bên phải
                        const sortedUnits = [...p.units].sort((a, b) => {
                          const multA = Number(a.multiplier) || (a.tier === 3 ? 100 : a.tier === 2 ? 10 : 1);
                          const multB = Number(b.multiplier) || (b.tier === 3 ? 100 : b.tier === 2 ? 10 : 1);
                          return multB - multA;
                        });

                        return sortedUnits.map((unit, idx) => {
                          const isBulk =
                            unit.tier === 3 ||
                            unit.id?.endsWith('_carton') ||
                            (!unit.tier && (unit.multiplier >= 12 || unit.unitName === 'ລັງ' || unit.unitName === 'ແກັດ' || unit.unitName === 'ເປົາ'));
                          const isMiddlePack =
                            unit.tier === 2 ||
                            unit.id?.endsWith('_pack') ||
                            (!unit.tier && unit.multiplier > 1 && !isBulk);

                          return (
                            <button
                              key={unit.id || idx}
                              type="button"
                              onClick={() => addToCart(p, unit, 1)}
                              className={`flex-1 min-w-0 py-1 px-0.5 rounded-lg text-center transition-all cursor-pointer active:scale-95 flex flex-col justify-center items-center shadow-2xs ${
                                isBulk
                                  ? 'bg-teal-600 hover:bg-teal-700 text-white'
                                  : isMiddlePack
                                  ? 'bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-900'
                                  : 'bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-400 text-slate-900'
                              }`}
                              title={`ຂາຍ 1 ${unit.unitName}`}
                            >
                              <span
                                className={`text-[9.5px] font-bold block truncate max-w-full ${
                                  isBulk
                                    ? 'text-teal-100'
                                    : isMiddlePack
                                    ? 'text-sky-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                {unit.unitName}
                              </span>
                              <span
                                className={`text-[10.5px] font-black block font-mono leading-tight mt-0.2 ${
                                  isBulk ? 'text-white' : 'text-slate-900'
                                }`}
                              >
                                {formatKip(unit.retailPrice).replace(' ₭', '')}
                              </span>
                            </button>
                          );
                        });
                      })()
                    ) : (
                      <span className="text-[11px] text-slate-400 py-1 text-center w-full">ບໍ່ມີຫົວໜ່ວຍ</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="py-16 text-center text-slate-400">
              <Package size={40} className="mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-xs font-bold text-slate-600">
                {searchQuery || activeCategory !== 'ທັງໝົດ'
                  ? 'ບໍ່ພົບສິນຄ້າທີ່ຄົ້ນຫາ'
                  : 'ຍັງບໍ່ມີສິນຄ້າໃນລະບົບ (ບໍ່ມີຂໍ້ມູນ)'}
              </p>
            </div>
          )}
        </div>

        {/* Mobile Floating Cart Summary Bar (< 768px) */}
        <div className="md:hidden bg-white border-t border-slate-200 p-2 shadow-lg flex items-center justify-between gap-2 shrink-0 z-20">
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer active:scale-98 transition-transform"
          >
            <div className="relative p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
              <ShoppingCart size={18} weight="bold" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-teal-600 text-white text-[9px] font-bold font-mono leading-none shadow-xs">
                  {cart.reduce((s, i) => s + (i.quantity || 1), 0)}
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-slate-500 font-bold truncate">
                {customerName || 'ລູກຄ້າທົ່ວໄປ'} • {cart.length} ລາຍການ
              </span>
              <span className="text-xs font-black text-teal-700 font-mono leading-tight">
                {formatKip(cartSubtotal)}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (cart.length > 0) {
                setMobileCartOpen(true);
              }
            }}
            disabled={cart.length === 0}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1 shrink-0 active:scale-95 transition-all cursor-pointer ${
              cart.length > 0
                ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/30'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>ເບິ່ງກະຕ່າ & ເຊັກບິນ</span>
            <span className="text-teal-200 font-bold">→</span>
          </button>
        </div>
      </section>

      {/* =========================================================================
          RIGHT COLUMN (35% on Tablet & Desktop >= 768px):
          Giỏ hàng cố định (Sticky Cart)
      ========================================================================= */}
      <aside className="hidden md:flex md:flex-none md:w-[35%] bg-white flex-col h-full min-h-0 overflow-hidden shadow-xs border-l border-slate-200/80 shrink-0">
        {renderCartContent(false)}
      </aside>

      {/* =========================================================================
          MOBILE SLIDE-OVER / BOTTOM SHEET CART DRAWER (< 768px)
      ========================================================================= */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileCartOpen(false)}
          />
          {/* Drawer Container */}
          <div className="relative z-10 bg-white rounded-t-3xl max-h-[90dvh] h-[90dvh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Drawer Top Handle & Title */}
            <div className="pt-2 px-4 pb-2 border-b border-slate-100 flex flex-col gap-1.5 shrink-0 bg-slate-50">
              <div
                className="w-10 h-1 bg-slate-300 rounded-full mx-auto cursor-pointer"
                onClick={() => setMobileCartOpen(false)}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} className="text-teal-700" weight="bold" />
                  <span className="font-extrabold text-sm text-slate-900">ກະຕ່າສິນຄ້າ</span>
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full text-xs font-bold font-mono">
                    {cart.length} ລາຍການ
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer py-1 px-2 rounded-lg hover:bg-rose-50"
                    >
                      <Trash size={14} />
                      <span>ລ້າງ</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMobileCartOpen(false)}
                    className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center cursor-pointer"
                    title="ປິດ"
                  >
                    <X size={15} weight="bold" />
                  </button>
                </div>
              </div>
            </div>

            {/* Cart Body inside Drawer */}
            {renderCartContent(true)}
          </div>
        </div>
      )}

      {/* Mobile-Style Price Override Modal */}
      <PriceOverrideModal
        isOpen={!!overrideModalItem}
        onClose={() => setOverrideModalItem(null)}
        cartItem={overrideModalItem}
        onApplyOverride={handleApplyPriceOverride}
        onResetOverride={handleResetPriceOverride}
      />

      {/* Toast Feedback for Barcode Scanning */}
      {scanToast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[130] px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-black animate-in fade-in slide-in-from-top-4 duration-200 border ${
            scanToast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {scanToast.type === 'success' ? (
            <CheckCircle size={18} weight="fill" />
          ) : (
            <WarningCircle size={18} weight="fill" />
          )}
          <span>{scanToast.message}</span>
        </div>
      )}

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanBarcode}
        title="ສະແກນບາໂຄດຂາຍໜ້າຮ້ານ (POS Scanner)"
        description="ສ່ອງກ້ອງຫຼັງໃສ່ບາໂຄດສິນຄ້າເພື່ອເພີ່ມເຂົ້າກະຕ່າອັດຕະໂນມັດ"
      />

      {/* Quotation / Proforma Preview Modal */}
      <QuotationPreviewModal
        isOpen={quotationModalOpen}
        onClose={() => setQuotationModalOpen(false)}
        cart={cart}
        cartSubtotal={cartSubtotal}
        customerName={customerName}
      />
    </main>
  );
}
