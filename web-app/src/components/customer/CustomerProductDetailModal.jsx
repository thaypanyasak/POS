import React from 'react';
import {
  X,
  Phone,
  WhatsappLogo,
  Package,
  Tag,
  Info,
} from '@phosphor-icons/react';
import { formatKip, getSortedUnits, sanitizeImageUrl } from '../../utils/formatters';

export default function CustomerProductDetailModal({
  product,
  isOpen,
  onClose,
  hotlineNumbers = ['020 56468780', '020 52228432'],
}) {
  if (!isOpen || !product) return null;

  const sortedUnits = getSortedUnits(product);

  const cleanImageUrl = sanitizeImageUrl(product.imageUrl || product.image_url);
  const rawPhone = hotlineNumbers[0].replace(/\D/g, '');
  const internationalPhone = rawPhone.startsWith('020')
    ? '85620' + rawPhone.slice(3)
    : rawPhone.startsWith('20')
    ? '856' + rawPhone
    : rawPhone;

  const whatsappMessage = encodeURIComponent(
    `ສະບາຍດີ ຮ້ານ ສົມສັກ! ຂ້ອຍສົນໃຈສັ່ງຊື້ສິນຄ້າ: ${product.name} ${
      product.name_vi ? `(${product.name_vi})` : ''
    }`
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none font-sans animate-in fade-in duration-150">
      <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
            <span className="text-xs font-black text-slate-700 tracking-tight uppercase">
              ລາຍລະອຽດສິນຄ້າ (Chi tiết sản phẩm)
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer transition-colors active:scale-95"
            title="ປິດ (Đóng)"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-5 space-y-4 no-scrollbar">
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

          {/* Names */}
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
              {product.name}
            </h2>
            {(product.name_vi || product.nameVi) && (
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                {product.name_vi || product.nameVi}
              </p>
            )}
          </div>

          {/* Pricing Tiers Table */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/90 p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tag size={15} weight="bold" className="text-teal-600" />
                <span>ຕາຕະລາງລາຄາຂາຍ (Bảng giá theo quy cách)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">ລາຄາກີບ (LAK)</span>
            </div>

            {sortedUnits.length > 0 ? (
              <div className="space-y-2">
                {sortedUnits.map((u, idx) => {
                  const mult = Number(u.multiplier) || 1;
                  const price = Number(u.retailPrice) || 0;

                  return (
                    <div
                      key={u.id || idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-teal-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center font-bold text-xs text-teal-700 shrink-0">
                          {u.unitName}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            ຂາຍເປັນ {u.unitName}
                          </div>
                          {mult > 1 && (
                            <div className="text-[11px] text-slate-400">
                              (1 {u.unitName} = {mult} {product.baseUnit || 'ອັນ'})
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-black text-teal-700 font-mono">
                          {formatKip(price)}
                        </div>
                        <div className="text-[10px] text-slate-400">ຕໍ່ {u.unitName}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-slate-500">
                ກຳລັງອັບເດດລາຄາ (Đang cập nhật giá)
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

        {/* Footer Actions: WhatsApp & Direct Call */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-2">
          {/* WhatsApp Direct Message */}
          <a
            href={`https://wa.me/${internationalPhone}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <WhatsappLogo size={18} weight="fill" />
            <span>ສັ່ງຜ່ານ WhatsApp</span>
          </a>

          {/* Phone Call */}
          <a
            href={`tel:${hotlineNumbers[0].replace(/\s+/g, '')}`}
            className="flex-1 h-11 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Phone size={16} weight="bold" />
            <span>ໂທ {hotlineNumbers[0]}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
