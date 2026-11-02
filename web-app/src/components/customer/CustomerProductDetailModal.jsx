import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Phone,
  WhatsappLogo,
  Package,
  Tag,
  Info,
  ShoppingCart,
} from '@phosphor-icons/react';
import { formatKip, formatDots, getProductTierBreakdown, sanitizeImageUrl } from '../../utils/formatters';

export default function CustomerProductDetailModal({
  product,
  isOpen,
  onClose,
  onOpenUnitSelector,
  hotlineNumbers = ['020 56468780', '020 52228432'],
  whatsappNumber = '020 52228432',
}) {
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

  const tierBreakdown = getProductTierBreakdown(product);
  const cleanImageUrl = sanitizeImageUrl(product.imageUrl || product.image_url);

  const whatsappInternational = '8562052228432';
  const whatsappMessage = encodeURIComponent(
    `ສະບາຍດີ ຮ້ານ ສົມສັກ! ຂ້ອຍສົນໃຈສັ່ງຊື້ສິນຄ້າ: ${product.name}`
  );

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none font-sans animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
            <span className="text-xs font-black text-slate-700 tracking-tight uppercase">
              ລາຍລະອຽດສິນຄ້າ
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer transition-colors active:scale-95"
            title="ປິດ"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-5 space-y-4 no-scrollbar flex-1">
          {/* Product Image */}
          <div className="w-full aspect-video sm:aspect-[16/10] bg-slate-100 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-200/80 relative">
            {cleanImageUrl ? (
              <img
                src={cleanImageUrl}
                alt={product.name}
                className="w-full h-full object-contain p-2"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5">
                <Package size={48} weight="duotone" />
                <span className="text-xs">ຮູບພາບສິນຄ້າ</span>
              </div>
            )}

            {product.category && (
              <div className="absolute top-3 right-3">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900/80 backdrop-blur-xs text-white shadow-2xs">
                  {product.category}
                </span>
              </div>
            )}
          </div>

          {/* Names: Pure Lao only */}
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
              {product.name}
            </h2>
          </div>

          {/* Pricing Tiers Table: Ordered largest tier first */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/90 p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tag size={15} weight="bold" className="text-teal-600" />
                <span>ຕາຕະລາງລາຄາຂາຍ</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">ລາຄາກີບ (LAK)</span>
            </div>

            {tierBreakdown.length > 0 ? (
              <div className="space-y-2">
                {tierBreakdown.map((item, idx) => {
                  const isTopTier = idx === 0;

                  return (
                    <div
                      key={item.id || idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-teal-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isTopTier
                              ? 'bg-teal-600 text-white shadow-2xs'
                              : 'bg-teal-50 border border-teal-100 text-teal-700'
                          }`}
                        >
                          {item.unitName}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            ຂາຍເປັນ {item.unitName}
                          </div>
                          {item.nextUnitName ? (
                            <div className="text-[11px] text-teal-700 font-bold">
                              (1 {item.unitName} = {formatDots(item.ratioToNext)} {item.nextUnitName})
                              {item.multiplier > 1 && item.multiplier !== item.ratioToNext && (
                                <span className="text-slate-400 font-normal ml-1">
                                  = {formatDots(item.multiplier)} {product.baseUnit || 'ອັນ'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 font-medium">
                              (ຫົວໜ່ວຍຍ່ອຍພື້ນຖານ)
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-black text-teal-700 font-mono">
                          {formatKip(item.retailPrice)}
                        </div>
                        <div className="text-[10px] text-slate-400">ຕໍ່ {item.unitName}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-slate-500">
                ກຳລັງອັບເດດລາຄາ
              </div>
            )}
          </div>

          {/* Quick Notice */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
            <Info size={16} weight="bold" className="text-amber-600 shrink-0 mt-0.5" />
            <span>
              ລູກຄ້າຊື້ຍົກລັງ / ຍົກແພັກຈຳນວນຫຼາຍ ມີລາຄາພິເສດ! ກະລຸນາໂທສອບຖາມ ຫຼື ສົ່ງຂໍ້ຄວາມຫາຮ້ານໂດຍກົງ.
            </span>
          </div>
        </div>

        {/* Footer Actions: Add to Cart, WhatsApp & Direct Calls */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col gap-2 shrink-0">
          {/* Add to Cart button */}
          {onOpenUnitSelector && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenUnitSelector(product);
              }}
              className="w-full h-11 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <ShoppingCart size={18} weight="bold" />
              <span>ເລືອກຫົວໜ່ວຍ & ເພີ່ມໃສ່ກະຕ່າ</span>
            </button>
          )}

          {/* WhatsApp Direct Message */}
          <a
            href={`https://wa.me/${whatsappInternational}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <WhatsappLogo size={18} weight="fill" />
            <span>ສັ່ງຜ່ານ WhatsApp ({whatsappNumber})</span>
          </a>

          {/* Direct Phone Calls */}
          <div className="flex items-center gap-2">
            <a
              href={`tel:${hotlineNumbers[0].replace(/\s+/g, '')}`}
              className="flex-1 h-10 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all"
            >
              <Phone size={15} weight="bold" />
              <span>ໂທ {hotlineNumbers[0]}</span>
            </a>
            <a
              href={`tel:${hotlineNumbers[1].replace(/\s+/g, '')}`}
              className="flex-1 h-10 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all"
            >
              <Phone size={15} weight="bold" />
              <span>ໂທ {hotlineNumbers[1]}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
