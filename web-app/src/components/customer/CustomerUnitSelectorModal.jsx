import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Minus, ShoppingCart, Package } from '@phosphor-icons/react';
import { formatKip, getProductTierBreakdown, sanitizeImageUrl } from '../../utils/formatters';
import { playAddToCartBeep, playQuantityStepBeep } from '../../utils/audioFeedback';

export default function CustomerUnitSelectorModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
}) {
  const [selectedUnitIdx, setSelectedUnitIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Reset selected unit index and quantity whenever modal is opened or product changes
  useEffect(() => {
    if (isOpen) {
      setSelectedUnitIdx(0);
      setQuantity(1);
    }
  }, [isOpen, product?.id]);

  // Lock background body scroll while modal is active
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const allTiers = getProductTierBreakdown(product);
  const tierBreakdown = allTiers.filter((t) => Number(t.retailPrice) > 0);
  const activeTiers = tierBreakdown.length > 0 ? tierBreakdown : allTiers;

  const activeItem = activeTiers[selectedUnitIdx] || activeTiers[0] || {
    unitName: product.baseUnit || 'ອັນ',
    label: `${product.baseUnit || 'ອັນ'}:`,
    retailPrice: Number(product.retailPrice || product.price || 0),
    multiplier: 1,
  };

  const cleanImageUrl = sanitizeImageUrl(product.imageUrl || product.image_url);

  const handleStepQty = (delta) => {
    playQuantityStepBeep();
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  const handleConfirm = () => {
    playAddToCartBeep();
    if (onAddToCart) {
      onAddToCart({
        product,
        unit: {
          unitName: activeItem.unitName,
          multiplier: activeItem.multiplier,
          retailPrice: activeItem.retailPrice,
          label: activeItem.label,
        },
        quantity,
      });
    }
    setQuantity(1);
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none font-sans animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white max-w-sm w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-xs font-black text-slate-700 tracking-tight uppercase">
              ເລືອກຫົວໜ່ວຍ & ຈຳນວນ
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer transition-colors active:scale-95"
          >
            <X size={15} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto no-scrollbar">
          {/* Product Info Preview */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0">
              {cleanImageUrl ? (
                <img
                  src={cleanImageUrl}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Package size={28} className="text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2">
                {product.name}
              </h3>
              <p className="text-[11px] text-blue-700 font-bold font-mono mt-0.5">
                {formatKip(activeItem.retailPrice)} / {activeItem.unitName}
              </p>
            </div>
          </div>

          {/* Unit Selector Options */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase">
              ຫົວໜ່ວຍການຂາຍ (Đơn vị tính):
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {activeTiers.map((item, idx) => {
                const isSelected = selectedUnitIdx === idx;
                return (
                  <button
                    key={item.id || idx}
                    type="button"
                    onClick={() => setSelectedUnitIdx(idx)}
                    className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition-all active:scale-98 ${
                      isSelected
                        ? 'bg-blue-50/80 border-primary shadow-xs ring-2 ring-primary/20'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                          isSelected
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.unitName}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {item.label}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-black text-blue-700 font-mono">
                        {formatKip(item.retailPrice)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity Stepper */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase">
              ຈຳນວນ (Số lượng):
            </label>
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-1.5">
              <button
                type="button"
                onClick={() => handleStepQty(-1)}
                className="w-10 h-10 rounded-xl bg-white hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors active:scale-95"
              >
                <Minus size={15} weight="bold" />
              </button>

              <div className="text-center font-mono font-black text-base text-slate-900">
                {quantity} <span className="text-xs font-sans text-slate-500 font-bold">{activeItem.unitName}</span>
              </div>

              <button
                type="button"
                onClick={() => handleStepQty(1)}
                className="w-10 h-10 rounded-xl bg-white hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors active:scale-95"
              >
                <Plus size={15} weight="bold" />
              </button>
            </div>
          </div>

          {/* Total Preview */}
          <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white p-3 rounded-2xl flex items-center justify-between shadow-xs">
            <span className="text-xs text-blue-100 font-medium">ລວມເງິນ :</span>
            <span className="text-base font-black font-mono text-amber-300">
              {formatKip(activeItem.retailPrice * quantity)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full h-11 rounded-2xl bg-primary hover:bg-primary-hover active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <ShoppingCart size={17} weight="bold" />
            <span>ເພີ່ມໃສ່ກະຕ່າ ({quantity} {activeItem.unitName})</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}

