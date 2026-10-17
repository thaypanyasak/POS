import React, { useState } from 'react';
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
} from '@phosphor-icons/react';
import { formatKip, formatCompoundStock, formatDots, getEffectiveUnitPrice, PRICE_TIERS } from '../utils/formatters';
import PriceOverrideModal from './PriceOverrideModal';
import BarcodeScannerModal from './BarcodeScannerModal';
import QuotationPreviewModal from './inventory/QuotationPreviewModal';
import ExchangeRateBadge from './common/ExchangeRateBadge';
import queryClient from '../services/queryClient';

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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanToast, setScanToast] = useState(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);

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
      // Find matching unit or default to first unit
      let targetUnit = matched.units[0];
      const matchingUnit = matched.units.find(
        (u) => u.barcode && String(u.barcode).trim().toLowerCase() === cleanCode
      );
      if (matchingUnit) targetUnit = matchingUnit;

      addToCart(matched, targetUnit, 1);
      setScannerOpen(false);
      setSearchQuery('');
      setScanToast({
        type: 'success',
        message: `ເພີ່ມ "${matched.name}" (${targetUnit.unitName}) ເຂົ້າກະຕ່າແລ້ວ!`,
      });
      setTimeout(() => setScanToast(null), 3000);
    } else {
      setScanToast({
        type: 'error',
        message: `ບໍ່ພົບສິນຄ້າທີ່ມີບາໂຄດ: "${barcode}"`,
      });
      setTimeout(() => setScanToast(null), 4000);
    }
  };

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
  // ⚠️ ກຳລັງແກ້ໄຂບິນ: #[receipt_number] | ຮູບແບບຊຳລະເດີມ: [Badge Tiền mặt / Chuyển khoản / Nợ]
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
          <span className="text-xs select-none shrink-0">⚠️</span>
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
    <div className="flex-1 flex flex-col h-full min-h-0 bg-white">
      {/* 1. Sticky Amber Banner when editing an old transaction */}
      {renderEditingBanner()}

      {/* 2. Compact Cart Header: Title, Customer Name & Clear */}
      <div className={`p-2.5 px-3 border-b border-slate-200/80 bg-slate-50/80 flex flex-col gap-1.5 shrink-0 ${isDrawer ? 'pt-1.5' : ''}`}>
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
                onClick={() => setCustomerName(name === 'ທົ່ວໄປ' ? 'ລູກຄ້າທົ່ວໄປ' : name)}
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

        {/* Global Price Mode (Cách 2: Chọn nhanh mức giá cho toàn bộ đơn hàng POS) */}
        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-200/80">
          <div className="flex items-center gap-1 shrink-0">
            <SlidersHorizontal size={12} className="text-slate-500" />
            <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
              ຕາຕະລາງລາຄາ:
            </span>
          </div>

          <div className="inline-flex items-center bg-slate-200/90 p-0.5 rounded-lg border border-slate-300 gap-0.5">
            {[
              { id: 1, label: 'ລາຄາ 1', desc: 'ມາດຕະຖານ', activeClass: 'bg-teal-600 text-white shadow-2xs font-black' },
              { id: 2, label: 'ລາຄາ 2', desc: 'ລູກຄ້າປະຈຳ', activeClass: 'bg-sky-600 text-white shadow-2xs font-black' },
              { id: 3, label: 'ລາຄາ 3', desc: 'ຂາຍສົ່ງ/VIP', activeClass: 'bg-amber-600 text-white shadow-2xs font-black' },
            ].map((tier) => {
              const isSelected = (globalPriceTier || 1) === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setGlobalPriceTier && setGlobalPriceTier(tier.id)}
                  className={`h-6 px-2 rounded-md text-[10.5px] transition-all cursor-pointer flex items-center justify-center ${
                    isSelected
                      ? tier.activeClass
                      : 'text-slate-600 font-bold hover:text-slate-900 hover:bg-slate-300/60'
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

      {/* 3. High-Density Cart Item List (Thumbnail on left + 2 clean rows on right) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 overscroll-contain">
        {cart.map((item) => {
          const itemKey = `${item.product.id}_${item.unit.id}`;
          const currentTier = item.selectedPriceTier || 1;
          const tierPrice = getEffectiveUnitPrice(item.unit, currentTier);
          const originalPrice = tierPrice;
          const effectivePrice =
            item.customPrice !== undefined && item.customPrice !== null
              ? item.customPrice
              : tierPrice;
          const isOverridden =
            item.customPrice !== undefined &&
            item.customPrice !== null &&
            item.customPrice !== tierPrice;

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
              className={`p-2 rounded-xl border bg-white flex flex-col gap-1 transition-all shadow-2xs ${
                isPriceMenuOpen ? 'relative z-30 overflow-visible' : 'relative z-0'
              } ${
                isOverridden ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              {/* Product Thumbnail (Left) + 2 Rows (Right) */}
              <div className="flex items-center gap-2">
                {/* Product Thumbnail */}
                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200/80 flex items-center justify-center self-center">
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
                    <Package size={22} className="text-slate-300" weight="duotone" />
                  )}
                </div>

                {/* 2 Rows Container */}
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-1">
                  {/* Row 1: Product Name, Line Total, Trash Button */}
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-bold text-xs text-slate-900 truncate" title={item.product.name}>
                      {item.product.name}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-black text-xs sm:text-sm font-mono text-slate-900">
                        {formatKip(lineTotal)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id, item.unit.id)}
                        className="text-slate-300 hover:text-rose-500 p-0.5 cursor-pointer shrink-0 transition-colors"
                        title="ລຶບລາຍການ"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Unit Switcher (Enlarged) + Highlighted Editable Price + Stepper */}
                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    <div className="flex items-center gap-1 flex-wrap min-w-0">
                      {/* Unit Switcher if product has multiple units (Enlarged per user request) */}
                      {item.product?.units && item.product.units.length > 1 ? (
                        <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 gap-0.5 shrink-0">
                          {item.product.units.map((u) => {
                            const isSelected = (u.id && u.id === item.unit.id) || u.unitName === item.unit.unitName;
                            return (
                              <button
                                key={u.id || u.unitName}
                                type="button"
                                onClick={() => changeCartItemUnit && changeCartItemUnit(item.product.id, item.unit.id, u)}
                                className={`h-6 px-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-teal-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                }`}
                                title={`ປ່ຽນເປັນ ${u.unitName} (${formatDots(u.retailPrice)} ₭)`}
                              >
                                {u.unitName}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[10px] text-teal-800 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/60 shrink-0">
                          {item.unit.unitName}
                        </span>
                      )}

                      {/* Highlighted Price Override Button (Làm nổi bật số tiền sửa được) */}
                      <button
                        type="button"
                        onClick={() => setOverrideModalItem(item)}
                        className={`h-6 px-2 rounded-md font-bold font-mono text-xs flex items-center gap-1 transition-all cursor-pointer border shadow-2xs shrink-0 ${
                          isOverridden
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-400 ring-1 ring-amber-400/50'
                            : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-300 hover:border-teal-400'
                        }`}
                        title="ກົດເພື່ອປັບລາຄາພິເສດ (Edit Price)"
                      >
                        <span>@{formatDots(effectivePrice)}</span>
                        <PencilSimple
                          size={11}
                          weight="bold"
                          className={isOverridden ? 'text-amber-800' : 'text-teal-600'}
                        />
                        {isOverridden && (
                          <span className="text-[9px] font-black uppercase tracking-wider bg-amber-200/80 px-1 rounded text-amber-900 ml-0.5">
                            {item.overrideReason || 'ປັບ'}
                          </span>
                        )}
                      </button>

                      {/* Multi-Price Tier Selector Dropdown/Pill: [ ລາຄາ 1 ▾ ] */}
                      <div className={`relative shrink-0 ${isPriceMenuOpen ? 'z-40' : ''}`}>
                        <button
                          type="button"
                          onClick={() => setOpenPriceMenuKey(isPriceMenuOpen ? null : itemKey)}
                          className={`h-6 px-1.5 rounded-md text-[10.5px] font-black flex items-center gap-0.5 transition-all border cursor-pointer shadow-2xs ${
                            currentTier === 3
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 ring-1 ring-amber-400/40'
                              : currentTier === 2
                              ? 'bg-sky-100 hover:bg-sky-200 text-sky-900 border-sky-300 ring-1 ring-sky-400/40'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                          }`}
                          title={`ລະດັບລາຄາປະຈຸບັນ: ລາຄາ ${currentTier} (ກົດເພື່ອປ່ຽນ)`}
                        >
                          <span>{`ລາຄາ ${currentTier}`}</span>
                          <span className="text-[9px] opacity-70">▾</span>
                        </button>

                        {/* Floating Price Selector Dropdown Menu */}
                        {isPriceMenuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setOpenPriceMenuKey(null)}
                            />
                            <div className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-1 min-w-[260px] w-max max-w-[320px] flex flex-col gap-0.5 animate-in fade-in-50 zoom-in-95">
                              <div className="px-2.5 py-1.5 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                <span>ເລືອກລະດັບລາຄາ:</span>
                                <span className="text-teal-700 font-extrabold">{item.unit.unitName}</span>
                              </div>
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
                                    label: 'ລາຄາ 3 (ລາຄາສົ່ງ / VIP)',
                                    price: Number(item.unit.price_3 ?? item.unit.price3 ?? 0),
                                  },
                                ];
                                // Conditional rendering: show only configured tiers (> 0)
                                const availableTiers = tiers.filter((t) => t.price > 0);
                                const displayTiers = availableTiers.length > 0 ? availableTiers : [tiers[0]];

                                return displayTiers.map(({ tierNum, label, price }) => {
                                  const isSelected = currentTier === tierNum;
                                  return (
                                    <button
                                      key={tierNum}
                                      type="button"
                                      onClick={() => {
                                        changeCartItemPriceTier && changeCartItemPriceTier(item.product.id, item.unit.id, tierNum);
                                        setOpenPriceMenuKey(null);
                                      }}
                                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md hover:bg-slate-50 cursor-pointer text-xs transition-colors ${
                                        isSelected
                                          ? 'bg-teal-50 text-teal-900 font-bold'
                                          : 'text-slate-700 font-medium'
                                      }`}
                                    >
                                      <span className={`whitespace-nowrap font-medium ${isSelected ? 'text-teal-950 font-bold' : 'text-slate-700'}`}>
                                        {label}
                                      </span>
                                      <div className="font-bold text-slate-900 whitespace-nowrap flex items-center gap-1.5 font-mono shrink-0">
                                        <span>{formatDots(price)} ₭</span>
                                        {isSelected && (
                                          <Check size={14} weight="bold" className="text-teal-600 shrink-0" />
                                        )}
                                      </div>
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Stepper (- Qty +) */}
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          updateCartQuantity(item.product.id, item.unit.id, item.quantity - 1)
                        }
                        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition-all cursor-pointer font-bold"
                        title="ຫຼຸດຈຳນວນ"
                      >
                        <Minus size={11} weight="bold" />
                      </button>
                      <span className="w-6 text-center font-black text-xs font-mono text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateCartQuantity(item.product.id, item.unit.id, item.quantity + 1)
                        }
                        className="w-6 h-6 rounded-md flex items-center justify-center text-teal-800 hover:bg-white active:scale-95 transition-all cursor-pointer font-bold"
                        title="ເພີ່ມຈຳນວນ"
                      >
                        <Plus size={11} weight="bold" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Beer Crate Deposit / Missing Crate Option (Slim single line) */}
              {isCrateEligible && (
                <div className="bg-amber-50/70 px-2 py-0.5 rounded-md border border-amber-200/60 flex items-center justify-between gap-1 text-[10px] mt-0.5">
                  <label className="flex items-center gap-1 cursor-pointer select-none min-w-0">
                    <input
                      type="checkbox"
                      checked={Boolean(item.noEmptyCrates)}
                      onChange={(e) =>
                        toggleCartItemCrateDeposit &&
                        toggleCartItemCrateDeposit(item.product.id, item.unit.id, e.target.checked)
                      }
                      className="w-3 h-3 accent-amber-600 rounded cursor-pointer shrink-0"
                    />
                    <span className="font-bold text-amber-950 text-[10px] truncate">
                      ບໍ່ມີແກັດປ່ຽນ (+{formatDots(feePerCrate)} ₭)
                    </span>
                  </label>

                  {item.noEmptyCrates && (
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="flex items-center bg-white rounded border border-amber-300 p-0.2 shadow-2xs">
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
                          className="w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-amber-900 text-[9px] hover:bg-amber-100 disabled:opacity-30 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-3.5 text-center font-black text-[9.5px] font-mono text-amber-950">
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
                          className="w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-amber-900 text-[9px] hover:bg-amber-100 disabled:opacity-30 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-black text-amber-950 font-mono text-[9.5px]">
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

      {/* 4. Sleek Cart Footer: Large Total & Dual Action Buttons */}
      <div className="p-2.5 px-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2 shrink-0">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ຍອດເງິນລວມ (Total):</span>
          <span className="text-2xl font-black font-mono text-slate-900">
            {formatKip(cartSubtotal)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Nút phụ: ໃບບອກລາຄາ (Báo giá) */}
          <button
            type="button"
            onClick={() => setQuotationModalOpen(true)}
            disabled={cart.length === 0}
            className={`h-11 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border active:scale-98 ${
              cart.length > 0
                ? 'bg-white hover:bg-amber-50 text-amber-700 border-amber-300 shadow-2xs'
                : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
            }`}
            title="ພິມໃບບອກລາຄາ / ໃບສະເໜີລາຄາຊົ່ວຄາວ (ບໍ່ຕັດສະຕັອກ)"
          >
            <FileText size={16} weight="bold" />
            <span>ໃບບອກລາຄາ</span>
          </button>

          {/* Nút chính: ຊຳລະເງິນ (Thanh toán) */}
          <button
            type="button"
            onClick={() => {
              if (isDrawer) setMobileCartOpen(false);
              handleOpenCheckout();
            }}
            disabled={cart.length === 0}
            className={`h-11 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-98 cursor-pointer ${
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
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ ຫຼື ສະແກນບາໂຄດ..."
                className="w-full h-11 pl-9 pr-20 bg-slate-100/80 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white font-medium shadow-2xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-md cursor-pointer transition-colors"
                >
                  ລຶບ
                </button>
              )}
            </div>

            {/* Nút Quét mã vạch cao 44px */}
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="h-11 px-3.5 rounded-xl bg-teal-50 hover:bg-teal-600 text-teal-700 hover:text-white border border-teal-200 shadow-2xs flex items-center gap-1.5 font-bold text-xs sm:text-sm cursor-pointer transition-all active:scale-95 shrink-0"
              title="ເປີດກ້ອງສະແກນບາໂຄດ (Camera Barcode Scanner)"
            >
              <Barcode size={20} weight="bold" />
              <span className="hidden sm:inline">ສະແກນ</span>
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
              onClick={() => setMobileCartOpen(true)}
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
                  onClick={() => setActiveCategory(cat)}
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
                    {/* Ảnh bo góc 12px với chiều cao chuẩn compact */}
                    <div className="relative h-24 sm:h-28 w-full rounded-[10px] overflow-hidden bg-slate-100 mb-1.5 shrink-0">
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          e.currentTarget.src =
                            'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80';
                        }}
                      />
                      {p.category && (
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.2 rounded bg-slate-950/70 backdrop-blur-xs text-[9px] text-white font-medium">
                          {p.category}
                        </span>
                      )}
                    </div>

                    {/* Tên sản phẩm 2 dòng rõ ràng */}
                    <h3
                      className="font-bold text-xs text-slate-900 leading-snug line-clamp-2 min-h-[2rem]"
                      title={p.name}
                    >
                      {p.name}
                    </h3>

                    {/* Hiển thị tồn kho hiện tại */}
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                      <span className="truncate font-medium" title={formatCompoundStock(p)}>
                        ສະຕັອກ: <strong className="text-slate-800 font-mono font-bold">{formatCompoundStock(p)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openUnitSelector(p);
                        }}
                        className="text-teal-700 hover:text-teal-800 font-bold flex items-center gap-0.5 text-[10px] cursor-pointer shrink-0 ml-1"
                        title="ເລືອກຫົວໜ່ວຍອື່ນ"
                      >
                        <SlidersHorizontal size={11} weight="bold" />
                        <span>ຫົວໜ່ວຍ</span>
                      </button>
                    </div>
                  </div>

                  {/* Nút chọn cấp đơn vị (Thùng / Pack / Lẻ) gọn gàng, có giá tiền rõ ràng */}
                  <div className="p-1 bg-slate-50/90 border-t border-slate-100 flex items-center gap-1">
                    {p.units && p.units.length > 0 ? (
                      p.units.map((unit, idx) => {
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
                            className={`flex-1 py-1 px-0.5 rounded-lg text-center transition-all cursor-pointer active:scale-95 flex flex-col justify-center items-center shadow-2xs ${
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
                      })
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
                    className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer"
                    title="ປິດ"
                  >
                    ✕
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
