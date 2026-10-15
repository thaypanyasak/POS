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
  CornersOut
} from '@phosphor-icons/react';
import { formatKip, formatCompoundStock, formatDots } from '../utils/formatters';
import PriceOverrideModal from './PriceOverrideModal';
import BarcodeScannerModal from './BarcodeScannerModal';

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
}) {
  // Modal for editing line item price (familiar customer / price override)
  const [overrideModalItem, setOverrideModalItem] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanToast, setScanToast] = useState(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

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

  // Reusable Cart Renderer for both Desktop Dock & Mobile Slide-Over Drawer
  // Checkout button is NOT fixed; it scrolls naturally up and down, perfectly optimized for mobile landscape!
  const renderCartContent = (isDrawer = false) => (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto overscroll-contain bg-white">
      {/* Cart Top Section: Customer Name Input & Quick Chips */}
      <div className={`p-2.5 sm:p-3 border-b border-slate-200/80 bg-slate-50 flex flex-col gap-1.5 shrink-0 ${isDrawer ? 'pt-1.5' : ''}`}>
        {!isDrawer && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShoppingCart size={17} className="text-teal-700" weight="bold" />
              <span className="font-extrabold text-xs text-slate-900">ກະຕ່າສິນຄ້າ</span>
              <span className="px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded text-[9.5px] font-bold">
                {cart.length} ລາຍການ
              </span>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-red-500 hover:text-red-700 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash size={12} />
                <span>ລ້າງ</span>
              </button>
            )}
          </div>
        )}

        {/* Customer Name Input */}
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
              className="w-full pl-7 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-bold"
            />
          </div>
          {/* Quick chips */}
          <div className="flex items-center gap-1 text-[10px] overflow-x-auto no-scrollbar shrink-0">
            {['ທົ່ວໄປ', 'VIP'].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setCustomerName(name === 'ທົ່ວໄປ' ? 'ລູກຄ້າທົ່ວໄປ' : name)}
                className={`px-1.5 py-1 rounded text-[10px] border shrink-0 transition-all cursor-pointer ${
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
      </div>

      {/* Cart Item List (Scrolls together in one fluid scroll container) */}
      <div className="p-2 sm:p-2.5 flex flex-col gap-2 shrink-0">
        {cart.map((item) => {
          const originalPrice = item.unit.retailPrice;
          const effectivePrice =
            item.customPrice !== undefined && item.customPrice !== null
              ? item.customPrice
              : originalPrice;
          const isOverridden =
            item.customPrice !== undefined &&
            item.customPrice !== null &&
            item.customPrice !== originalPrice;

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

          return (
            <div
              key={`${item.product.id}_${item.unit.id}`}
              className={`p-2 rounded-xl border bg-white flex flex-col gap-1.5 transition-all shadow-2xs ${
                isOverridden ? 'border-amber-300 bg-amber-50/25' : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {/* Product Thumbnail */}
                <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
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
                    <span className="text-sm select-none">📦</span>
                  )}
                </div>

                {/* Name & Unit switcher & Stepper */}
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-extrabold text-[11px] text-slate-900 leading-tight truncate">
                      {item.product.name}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.product.id, item.unit.id)}
                      className="text-slate-300 hover:text-red-500 p-0.5 cursor-pointer shrink-0 -mr-1 transition-colors"
                      title="ລຶບລາຍການ"
                    >
                      <Trash size={12} />
                    </button>
                  </div>

                  {/* Unit Switcher */}
                  {item.product?.units && item.product.units.length > 1 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {item.product.units.map((u) => {
                        const isSelected = (u.id && u.id === item.unit.id) || u.unitName === item.unit.unitName;
                        return (
                          <button
                            key={u.id || u.unitName}
                            type="button"
                            onClick={() => changeCartItemUnit && changeCartItemUnit(item.product.id, item.unit.id, u)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-teal-700 text-white shadow-2xs ring-1 ring-teal-800'
                                : 'bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-900 border border-slate-200/80'
                            }`}
                            title={`ປ່ຽນເປັນ ${u.unitName} (${formatDots(u.retailPrice)} ₭)`}
                          >
                            {u.unitName}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Price edit & Stepper & Total */}
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setOverrideModalItem(item)}
                        className="flex items-center gap-0.5 group text-left hover:bg-teal-50 px-1 py-0.5 -ml-1 rounded transition-colors cursor-pointer"
                        title="ກົດເພື່ອປັບລາຄາພິເສດ"
                      >
                        <span className="text-[10px] text-teal-800 font-bold font-mono">
                          {item.unit.unitName} @ {formatKip(effectivePrice).replace(' ₭', '')}
                        </span>
                        <PencilSimple
                          size={10}
                          className="text-slate-400 group-hover:text-teal-700"
                        />
                      </button>

                      {isOverridden && (
                        <span className="px-1 py-0.1 rounded text-[8.5px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                          {item.overrideReason || 'ພິເສດ'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <div className="flex items-center bg-slate-100 rounded-md p-0.5 border border-slate-200/70">
                        <button
                          onClick={() =>
                            updateCartQuantity(item.product.id, item.unit.id, item.quantity - 1)
                          }
                          className="w-4.5 h-4.5 rounded flex items-center justify-center text-slate-600 hover:bg-white active:scale-95 transition-all cursor-pointer"
                        >
                          <Minus size={9} weight="bold" />
                        </button>
                        <span className="w-4 text-center font-black text-[10.5px] text-slate-900 font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateCartQuantity(item.product.id, item.unit.id, item.quantity + 1)
                          }
                          className="w-4.5 h-4.5 rounded flex items-center justify-center text-slate-600 hover:bg-white active:scale-95 transition-all cursor-pointer"
                        >
                          <Plus size={9} weight="bold" />
                        </button>
                      </div>

                      <span className="font-black text-[11px] text-slate-900 font-mono min-w-14 text-right">
                        {formatKip(lineTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Beer Crate Deposit / Missing Crate Option */}
              {isCrateEligible && (
                <div className="bg-amber-50/80 px-2 py-1 rounded-lg border border-amber-200/80 flex items-center justify-between gap-1 text-[10px]">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none min-w-0">
                    <input
                      type="checkbox"
                      checked={Boolean(item.noEmptyCrates)}
                      onChange={(e) =>
                        toggleCartItemCrateDeposit &&
                        toggleCartItemCrateDeposit(item.product.id, item.unit.id, e.target.checked)
                      }
                      className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer shrink-0"
                    />
                    <span className="font-bold text-amber-950 text-[9.5px] truncate">
                      ບໍ່ມີແກັດປ່ຽນ (+{formatDots(feePerCrate)} ₭)
                    </span>
                  </label>

                  {item.noEmptyCrates && (
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="flex items-center bg-white rounded border border-amber-300 p-0.5 shadow-2xs">
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
                        <span className="w-3.5 text-center font-black text-[10px] font-mono text-amber-950">
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
                      <span className="font-black text-amber-950 font-mono text-[10px]">
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
          <div className="py-6 sm:py-8 flex flex-col items-center justify-center text-center text-slate-400">
            <ShoppingCart size={32} className="mx-auto mb-1 opacity-40" />
            <p className="text-xs font-bold text-slate-600">ກະຕ່າຍັງວ່າງເປົ່າ</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              ກົດປຸ່ມຫົວໜ່ວຍດ້ານຊ້າຍເພື່ອເລີ່ມຂາຍ
            </p>
          </div>
        )}
      </div>

      {/* 3. Cart Summary & Checkout Button (Not fixed! Scrolls up & down naturally with generous bottom padding!) */}
      <div
        className="p-2.5 sm:p-3 border-t border-slate-200 bg-slate-50 flex flex-col gap-2 mt-auto shrink-0 pb-16 sm:pb-20"
        style={{
          paddingBottom: 'max(2.5rem, calc(env(safe-area-inset-bottom, 0px) + 2rem))',
        }}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700">ຍອດເງິນລວມ (Total):</span>
          <span className="font-black text-sm sm:text-base text-teal-700 font-mono">
            {formatKip(cartSubtotal)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isDrawer) setMobileCartOpen(false);
            handleOpenCheckout();
          }}
          disabled={cart.length === 0}
          className={`w-full py-2.5 sm:py-3 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 min-h-[44px] cursor-pointer ${
            cart.length > 0
              ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/30'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span>ຄິດໄລ່ເງິນ / ເຊັກບິນ (Checkout)</span>
          <span className="font-mono">{formatKip(cartSubtotal)}</span>
        </button>
      </div>
    </div>
  );

  return (
    <main className="flex-1 flex overflow-hidden w-full h-full min-h-0 font-sans relative">
      {/* =========================================================================
          LEFT DOCK: PRODUCTS CATALOG (FLEX-1 FULL REMAINING WIDTH)
      ========================================================================= */}
      <section className="flex-1 min-w-0 border-r border-slate-200/80 bg-slate-50 flex flex-col h-full min-h-0 overflow-hidden">
        {/* Top Control Bar: Search, Category chips, Scanner */}
        <div className="p-2.5 sm:p-3 bg-white border-b border-slate-200/80 flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ ຫຼື ສະແກນບາໂຄດ..."
                className="w-full pl-9 pr-24 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white font-medium shadow-2xs"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {/* Fullscreen Button */}
                <button
                  type="button"
                  onClick={() => {
                    try {
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen?.().catch(() => {});
                      } else {
                        document.exitFullscreen?.().catch(() => {});
                      }
                    } catch (e) {}
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all cursor-pointer border border-slate-200 shadow-2xs flex items-center active:scale-95"
                  title="ເຕັມຈໍ (Full Screen)"
                >
                  <CornersOut size={14} weight="bold" />
                </button>

                {/* Camera Scanner Button */}
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="px-2 py-1 rounded-lg bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-700 transition-all cursor-pointer border border-teal-200 shadow-2xs flex items-center gap-1 active:scale-95"
                  title="ເປີດກ້ອງສະແກນບາໂຄດ (Camera Barcode Scanner)"
                >
                  <Barcode size={15} weight="bold" />
                </button>

                {/* Mobile Cart Trigger Button */}
                <button
                  type="button"
                  onClick={() => setMobileCartOpen(true)}
                  className="md:hidden relative p-1.5 rounded-lg bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-700 transition-all cursor-pointer border border-teal-200 shadow-2xs flex items-center active:scale-95"
                  title="ເປີດກະຕ່າ"
                >
                  <ShoppingCart size={15} weight="bold" />
                  {cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-teal-600 text-white text-[9px] font-black leading-none">
                      {cart.reduce((s, i) => s + (i.quantity || 1), 0)}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-2.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                ລຶບ
              </button>
            )}
          </div>

          {/* Category Chips Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid: Mobile 2 columns, Tablet 3-4 columns, Desktop 5 columns */}
        <div className="flex-1 min-h-0 p-2 sm:p-3 overflow-y-auto overscroll-contain pb-24 sm:pb-28">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 w-full">
            {filteredProducts.map((p) => {
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl border border-slate-200/90 hover:border-teal-500/50 hover:shadow-sm transition-all duration-150 flex flex-col justify-between overflow-hidden group"
                >
                  {/* Top card area */}
                  <div
                    onClick={() => openUnitSelector(p)}
                    className="p-2 cursor-pointer"
                  >
                    <div className="relative h-20 sm:h-24 w-full rounded-lg overflow-hidden bg-slate-100 mb-1.5">
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
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.2 rounded bg-slate-950/70 backdrop-blur-xs text-[9px] text-white font-medium">
                        {p.category}
                      </span>
                    </div>

                    <h3
                      className="font-extrabold text-[11px] sm:text-xs text-slate-900 leading-tight line-clamp-1"
                      title={p.name}
                    >
                      {p.name}
                    </h3>

                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                      <span className="truncate max-w-[110px] sm:max-w-[130px] font-medium" title={formatCompoundStock(p)}>
                        ສະຕັອກ: <strong className="text-slate-800">{formatCompoundStock(p)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openUnitSelector(p);
                        }}
                        className="text-teal-700 hover:text-teal-800 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <SlidersHorizontal size={11} weight="bold" />
                        <span>ຫົວໜ່ວຍ</span>
                      </button>
                    </div>
                  </div>

                  {/* Fast 1-Tap Unit Add Buttons */}
                  <div className="p-1.5 bg-slate-50 border-t border-slate-100 flex items-center gap-1">
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
                            onClick={() => addToCart(p, unit, 1)}
                            className={`flex-1 py-1.5 px-0.5 rounded-md text-center transition-all shadow-2xs active:scale-95 cursor-pointer ${
                              isBulk
                                ? 'bg-teal-600 hover:bg-teal-700 border border-teal-600 text-white'
                                : isMiddlePack
                                ? 'bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-900'
                                : 'bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-400 text-slate-900'
                            }`}
                            title={`ຂາຍ 1 ${unit.unitName}`}
                          >
                            <span
                              className={`text-[9px] font-bold block truncate ${
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
                              className={`text-[10px] sm:text-[10.5px] font-black block font-mono ${
                                isBulk ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {formatKip(unit.retailPrice).replace(' ₭', '')}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-slate-400 py-1 text-center w-full">ບໍ່ມີຫົວໜ່ວຍ</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="py-20 text-center text-slate-400">
              <Package size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold">
                {searchQuery || activeCategory !== 'ທັງໝົດ'
                  ? 'ບໍ່ພົບສິນຄ້າທີ່ຄົ້ນຫາ'
                  : 'ຍັງບໍ່ມີສິນຄ້າໃນລະບົບ (ບໍ່ມີຂໍ້ມູນ)'}
              </p>
            </div>
          )}
        </div>

        {/* Mobile Floating Cart Summary Bar (< 768px) */}
        <div className="md:hidden bg-white border-t border-slate-200 p-2 sm:p-2.5 shadow-lg flex items-center justify-between gap-2 shrink-0 z-20">
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer active:scale-98 transition-transform"
          >
            <div className="relative p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
              <ShoppingCart size={18} weight="bold" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-teal-600 text-white text-[9.5px] font-black leading-none shadow-xs">
                  {cart.reduce((s, i) => s + (i.quantity || 1), 0)}
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-slate-500 font-bold truncate">
                {customerName || 'ລູກຄ້າທົ່ວໄປ'} • {cart.length} ລາຍການ
              </span>
              <span className="text-xs sm:text-sm font-black text-teal-700 font-mono leading-tight">
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
            className={`px-3.5 py-2.5 rounded-xl font-black text-xs shadow-sm flex items-center gap-1 shrink-0 active:scale-95 transition-all cursor-pointer ${
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
          RIGHT DOCK: CART & CHECKOUT (SCROLLABLE DOCK ON TABLET & DESKTOP >= 768px)
      ========================================================================= */}
      <aside className="hidden md:flex md:w-[300px] lg:w-[340px] xl:w-[380px] bg-white flex-col h-full min-h-0 overflow-y-auto overscroll-contain shadow-xs border-l border-slate-200/80 shrink-0">
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
          <div className="relative z-10 bg-white rounded-t-3xl max-h-[88dvh] h-[88dvh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
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
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded text-[11px] font-black">
                    {cart.length} ລາຍການ
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 cursor-pointer py-1 px-2 rounded-lg hover:bg-red-50"
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
    </main>
  );
}
