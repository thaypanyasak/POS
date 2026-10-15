import React, { useState, useEffect } from 'react';
import {
  X,
  PencilSimple,
  CheckCircle,
  ArrowCounterClockwise,
  Backspace,
  Tag
} from '@phosphor-icons/react';
import { formatKip } from '../utils/formatters';

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
  ];

  useEffect(() => {
    if (cartItem) {
      const currentPrice =
        cartItem.customPrice !== undefined && cartItem.customPrice !== null
          ? cartItem.customPrice
          : (cartItem.unit?.retailPrice || 0);
      setPriceString(currentPrice.toString());
      setSelectedReason(cartItem.overrideReason || 'ລູກຄ້າປະຈຳ');
    }
  }, [cartItem, isOpen]);

  if (!isOpen || !cartItem) return null;

  const originalPrice = cartItem.unit?.retailPrice || 0;
  const newPrice = Math.max(0, parseInt(priceString, 10) || 0);
  const discount = originalPrice - newPrice;
  const isOverridden =
    cartItem.customPrice !== undefined &&
    cartItem.customPrice !== null &&
    cartItem.customPrice !== originalPrice;

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
    e.preventDefault();
    onApplyOverride(cartItem.product.id, cartItem.unit.id, newPrice, selectedReason);
    onClose();
  };

  const handleReset = () => {
    onResetOverride(cartItem.product.id, cartItem.unit.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4 border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <PencilSimple size={20} weight="bold" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                ປັບລາຄາພິເສດ (Override Price)
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[240px]">
                {cartItem.product.name} ({cartItem.unit.unitName})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Price Comparison Card (Exact match with Flutter PriceOverrideDialog) */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
          {/* Original Price */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400">
              ລາຄາເດີມ:
            </span>
            <span className="text-xs font-bold text-slate-400 line-through font-mono">
              {formatKip(originalPrice)}
            </span>
          </div>

          {/* Discount amount */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400">
              ສ່ວນຫຼຸດ:
            </span>
            <span
              className={`text-xs font-black px-2 py-0.5 rounded-md font-mono mt-0.5 ${
                discount > 0
                  ? 'bg-red-50 text-red-600 border border-red-200'
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

          {/* New Custom Price */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-teal-800">
              ລາຄາໃໝ່ (Custom):
            </span>
            <span className="text-xl font-black text-slate-900 font-mono tracking-tight text-teal-700">
              {formatKip(newPrice)}
            </span>
          </div>
        </div>

        {/* Reason Chips (Familiar Customer, Bulk, etc.) */}
        <div>
          <span className="text-[11px] font-bold text-slate-600 block mb-1.5 flex items-center gap-1">
            <Tag size={12} weight="bold" />
            <span>ເຫດຜົນການປັບລາຄາ (Reason):</span>
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {commonReasons.map((reason) => {
              const isSelected = selectedReason === reason;
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReason(reason)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
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

        {/* Quick Adjust Buttons */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => handleQuickAdjust(-5000)}
            className="py-1 px-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700 font-mono"
          >
            -5,000
          </button>
          <button
            type="button"
            onClick={() => handleQuickAdjust(-1000)}
            className="py-1 px-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700 font-mono"
          >
            -1,000
          </button>
          <button
            type="button"
            onClick={() => handleQuickAdjust(1000)}
            className="py-1 px-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700 font-mono"
          >
            +1,000
          </button>
          <button
            type="button"
            onClick={() => handleQuickAdjust(5000)}
            className="py-1 px-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700 font-mono"
          >
            +5,000
          </button>
        </div>

        {/* Tactile Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="h-11 bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 rounded-xl font-mono text-base font-black text-slate-800 shadow-2xs transition-all"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-11 bg-red-50 hover:bg-red-100 active:scale-95 border border-red-200 rounded-xl font-bold text-xs text-red-600 transition-all"
          >
            C (ລຶບ)
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-11 bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 rounded-xl font-mono text-base font-black text-slate-800 shadow-2xs transition-all"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-11 bg-slate-100 hover:bg-slate-200 active:scale-95 border border-slate-200 rounded-xl flex items-center justify-center text-slate-700 transition-all"
          >
            <Backspace size={18} weight="bold" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          {isOverridden ? (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
            >
              <ArrowCounterClockwise size={14} weight="bold" />
              <span>ຣີເຊັດລາຄາເດີມ</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
            >
              ຍົກເລີກ
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <CheckCircle size={16} weight="fill" />
            <span>ຕົກລົງ (ນຳໃຊ້ລາຄາ)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
