import React, { useState, useEffect } from 'react';
import {
  X,
  PencilSimple,
  CheckCircle,
  ArrowCounterClockwise,
  Backspace,
  Tag,
  Check
} from '@phosphor-icons/react';
import { formatKip, getEffectiveUnitPrice } from '../utils/formatters';

export default function PriceOverrideModal({
  isOpen,
  onClose,
  cartItem,
  onApplyOverride,
  onResetOverride,
}) {
  const [priceString, setPriceString] = useState('0');
  const [selectedReason, setSelectedReason] = useState('ລູກຄ້າປະຈຳ');

  const commonReasons = [
    'ລູກຄ້າປະຈຳ',
    'ຊື້ຫຼາຍ/ຍົກແພັກ',
    'ສິນຄ້າໃກ້ໝົດອາຍຸ',
    'ເຈົ້າຂອງຮ້ານຫຼຸດໃຫ້',
    'ປັບລາຄາພິເສດ',
  ];

  // Resolve item naming and standard price
  const isBundle = Boolean(cartItem?.isBundle);
  const itemName = isBundle ? cartItem?.bundleName : cartItem?.product?.name;
  const unitName = isBundle
    ? (cartItem?.unitName || 'ແກັດ')
    : (cartItem?.unit?.unitName || '');

  // Calculate available price tiers
  const tier1Price = Number(cartItem?.unit?.retailPrice ?? cartItem?.unit?.retail_price ?? 0);
  const tier2Price = Number(cartItem?.unit?.price_2 ?? cartItem?.unit?.price2 ?? cartItem?.unit?.wholesalePrice ?? 0);
  const tier3Price = Number(cartItem?.unit?.price_3 ?? cartItem?.unit?.price3 ?? 0);

  const originalPrice = isBundle
    ? (cartItem?.cartonCount ? (cartItem.cartonCount * (cartItem.cartonPrice || 0)) + (cartItem.loosePriceTotal || 0) : (cartItem?.unitPrice || 0))
    : (cartItem?.unit ? getEffectiveUnitPrice(cartItem.unit, cartItem.selectedPriceTier || 1) : 0);

  useEffect(() => {
    if (cartItem) {
      const currentPrice =
        cartItem.customPrice !== undefined && cartItem.customPrice !== null
          ? cartItem.customPrice
          : (cartItem.custom_price !== undefined && cartItem.custom_price !== null
            ? cartItem.custom_price
            : originalPrice);
      setPriceString(currentPrice.toString());
      setSelectedReason(cartItem.overrideReason || 'ລູກຄ້າປະຈຳ');
    }
  }, [cartItem, isOpen, originalPrice]);

  if (!isOpen || !cartItem) return null;

  const newPrice = Math.max(0, parseInt(priceString, 10) || 0);
  const discount = originalPrice - newPrice;
  const isOverridden =
    (cartItem.customPrice !== undefined && cartItem.customPrice !== null && cartItem.customPrice !== originalPrice) ||
    (cartItem.custom_price !== undefined && cartItem.custom_price !== null && cartItem.custom_price !== originalPrice);

  // Keypad presses
  const handleKeyPress = (val) => {
    if (priceString === '0') {
      setPriceString(val);
    } else {
      if (priceString.length < 10) {
        setPriceString(priceString + val);
      }
    }
  };

  const handleBackspace = () => {
    if (priceString.length <= 1) {
      setPriceString('0');
    } else {
      setPriceString(priceString.slice(0, -1));
    }
  };

  const handleClear = () => {
    setPriceString('0');
  };

  const handleQuickAdjust = (delta) => {
    const cur = parseInt(priceString, 10) || 0;
    const next = Math.max(0, cur + delta);
    setPriceString(next.toString());
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const prodId = isBundle ? cartItem.id : cartItem.product.id;
    const unitId = isBundle ? null : cartItem.unit.id;
    onApplyOverride(prodId, unitId, newPrice, selectedReason);
    onClose();
  };

  const handleReset = () => {
    const prodId = isBundle ? cartItem.id : cartItem.product.id;
    const unitId = isBundle ? null : cartItem.unit.id;
    onResetOverride(prodId, unitId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 select-none font-sans">
      <div className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-3.5 border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
              <PencilSimple size={20} weight="bold" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900 leading-tight">
                ປັບລາຄາພິເສດສະເພາະບິນ (One-off Override)
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[240px]">
                {itemName} {unitName ? `(${unitName})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Quick Price Tier Buttons (Tapping directly switches price) */}
        {!isBundle && (tier1Price > 0 || tier2Price > 0 || tier3Price > 0) && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {tier1Price > 0 && (
              <button
                type="button"
                onClick={() => setPriceString(tier1Price.toString())}
                className={`flex-1 py-1.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center min-h-[44px] justify-center ${
                  newPrice === tier1Price
                    ? 'bg-primary-light text-primary border-primary-border shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className="text-[10px] text-slate-400 font-sans">ລາຄາ 1 (ມາດຕະຖານ)</span>
                <span className="font-mono font-black">{formatKip(tier1Price)}</span>
              </button>
            )}
            {tier2Price > 0 && (
              <button
                type="button"
                onClick={() => setPriceString(tier2Price.toString())}
                className={`flex-1 py-1.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center min-h-[44px] justify-center ${
                  newPrice === tier2Price
                    ? 'bg-primary-light text-primary border-primary-border shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className="text-[10px] text-slate-400 font-sans">ລາຄາ 2 (ລູກຄ້າປະຈຳ)</span>
                <span className="font-mono font-black">{formatKip(tier2Price)}</span>
              </button>
            )}
            {tier3Price > 0 && (
              <button
                type="button"
                onClick={() => setPriceString(tier3Price.toString())}
                className={`flex-1 py-1.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center min-h-[44px] justify-center ${
                  newPrice === tier3Price
                    ? 'bg-primary-light text-primary border-primary-border shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className="text-[10px] text-slate-400 font-sans">ລາຄາ 3 (VIP/ຂາຍສົ່ງ)</span>
                <span className="font-mono font-black">{formatKip(tier3Price)}</span>
              </button>
            )}
          </div>
        )}

        {/* Price Comparison Card */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              ລາຄາເດີມ:
            </span>
            <span className="text-xs font-bold text-slate-400 line-through font-mono">
              {formatKip(originalPrice)}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              ສ່ວນຫຼຸດ / ຕ່າງ:
            </span>
            <span
              className={`text-xs font-black px-2 py-0.5 rounded-md font-mono mt-0.5 ${
                discount > 0
                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                  : discount < 0
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-slate-200/60 text-slate-500'
              }`}
            >
              {discount > 0
                ? `-${formatKip(discount)}`
                : discount < 0
                ? `+${formatKip(-discount)}`
                : '0 ₭'}
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">
              ລາຄາໃໝ່ (Custom):
            </span>
            <span className="text-xl font-black text-teal-700 font-mono tracking-tight">
              {formatKip(newPrice)}
            </span>
          </div>
        </div>

        {/* Reason Chips */}
        <div>
          <span className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
            <Tag size={12} weight="bold" />
            <span>ເຫດຜົນການປັບລາຄາ:</span>
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {commonReasons.map((reason) => {
              const isSelected = selectedReason === reason;
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReason(reason)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {reason}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Adjust Buttons (+/- 1.000, 5.000) */}
        <div className="grid grid-cols-4 gap-1.5">
          {[-5000, -1000, 1000, 5000].map((delta) => (
            <button
              key={delta}
              type="button"
              onClick={() => handleQuickAdjust(delta)}
              className="min-h-[38px] py-1 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-xl text-xs font-bold text-slate-700 font-mono transition-all cursor-pointer"
            >
              {delta > 0 ? `+${formatKip(delta)}` : formatKip(delta)}
            </button>
          ))}
        </div>

        {/* Tactile Touch Numpad (Min 44x44px for iPad touch standard) */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="h-12 min-h-[48px] bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 rounded-xl font-mono text-xl font-black text-slate-800 shadow-2xs transition-all cursor-pointer flex items-center justify-center"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-12 min-h-[48px] bg-rose-50 hover:bg-rose-100 active:scale-95 border border-rose-200 rounded-xl font-bold text-xs text-rose-600 transition-all cursor-pointer flex items-center justify-center"
          >
            C (ລຶບ)
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-12 min-h-[48px] bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 rounded-xl font-mono text-xl font-black text-slate-800 shadow-2xs transition-all cursor-pointer flex items-center justify-center"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 min-h-[48px] bg-slate-100 hover:bg-slate-200 active:scale-95 border border-slate-200 rounded-xl flex items-center justify-center text-slate-700 transition-all cursor-pointer"
          >
            <Backspace size={20} weight="bold" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          {isOverridden ? (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer min-h-[44px]"
            >
              <ArrowCounterClockwise size={15} weight="bold" />
              <span>ຣີເຊັດລາຄາເດີມ</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all cursor-pointer min-h-[44px]"
            >
              ຍົກເລີກ
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <CheckCircle size={18} weight="fill" />
            <span>ຕົກລົງ (ນຳໃຊ້ລາຄານີ້)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
