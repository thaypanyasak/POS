import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import {
  CheckCircle,
  WhatsappLogo,
  Phone,
  Buildings,
  Moped,
  Copy,
  Check,
  Package,
  X,
} from '@phosphor-icons/react';
import { formatKip } from '../../utils/formatters';
import { playSuccessBeep } from '../../utils/audioFeedback';

export default function CustomerOrderSuccessModal({
  isOpen,
  onClose,
  onOpenTracking,
  order,
  whatsappInternational = '8562052228432',
  whatsappNumber = '020 52228432',
  hotlineNumbers = ['020 56468780', '020 52228432'],
}) {
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    if (isOpen) {
      playSuccessBeep();
      try {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (_) {}
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  // Normalize order object (in case it was passed inside a response wrapper)
  const actualOrder = order.order || order;

  const isPickup =
    actualOrder.fulfillment_type === 'pickup' ||
    actualOrder.fulfillmentType === 'pickup';

  // Construct WhatsApp text message
  const itemsText = (actualOrder.items || [])
    .map(
      (it, idx) =>
        `  ${idx + 1}. ${it.product_name || it.productName || it.name} (${
          it.quantity
        } ${it.unit_name || it.unitName}) - ${formatKip(
          (it.unit_price || it.price) * it.quantity
        )}`
    )
    .join('\n');

  const waMessage = `ສະບາຍດີ ຮ້ານ ສົມສັກ! ຂ້ອຍໄດ້ສັ່ງຊື້ສິນຄ້າຜ່ານເວັບໄຊ:
📋 ລະຫັດອໍເດີ: ${
    actualOrder.receipt_number || actualOrder.receiptNumber || actualOrder.id
  }
👤 ຊື່ລູກຄ້າ: ${actualOrder.customer_name || actualOrder.customerName}
📞 ເບີໂທ: ${actualOrder.customer_phone || actualOrder.customerPhone}
${
  isPickup
    ? `🏢 ຮູບແບບ: ມາຮັບເອງທີ່ຮ້ານ (ເວລາ: ${
        actualOrder.pickup_time || actualOrder.pickupTime || '15 ນາທີ'
      })`
    : `🛵 ຮູບແບບ: ສົ່ງຮອດບ່ອນ\n📍 ທີ່ຢູ່: ${
        actualOrder.delivery_address || actualOrder.deliveryAddress
      }`
}
${
  actualOrder.delivery_note || actualOrder.deliveryNote
    ? `📝 ໝາຍເຫດ: ${actualOrder.delivery_note || actualOrder.deliveryNote}`
    : ''
}
📦 ລາຍການສິນຄ້າ:
${itemsText}
💰 ຍອດລວມ: ${formatKip(actualOrder.grand_total || actualOrder.grandTotal)}
💳 ວິທີຊຳລະ: ${
    actualOrder.payment_method === 'transfer'
      ? 'ໂອນເງິນ BCEL One'
      : 'ເງິນສົດ (COD)'
  }

ກະລຸນາກວດສອບ ແລະ ຢືນຢັນອໍເດີໃຫ້ແດ່ເດີ້, ຂອບໃຈຫຼາຍໆ!`;

  const waUrl = `https://wa.me/${whatsappInternational}?text=${encodeURIComponent(
    waMessage
  )}`;

  const handleCopyCode = () => {
    const code =
      actualOrder.receipt_number || actualOrder.receiptNumber || actualOrder.id;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none font-sans animate-in fade-in duration-200"
    >
      <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-6 text-center bg-gradient-to-b from-emerald-50 to-white border-b border-slate-100 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs mb-3 ring-8 ring-emerald-50">
            <CheckCircle size={36} weight="fill" />
          </div>

          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            ສັ່ງຊື້ສຳເລັດແລ້ວ!
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ຂອບໃຈທີ່ເລືອກຊື້ສິນຄ້າກັບ ຮ້ານ ສົມສັກ (MeiiShop)
          </p>

          {/* Receipt Number Badge */}
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-800">
            <span>ລະຫັດອໍເດີ: <strong className="text-teal-700">{actualOrder.receipt_number || actualOrder.receiptNumber || actualOrder.id}</strong></span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="text-slate-500 hover:text-slate-800 cursor-pointer"
              title="Copy"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* Order Details Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto no-scrollbar text-xs">
          {/* Fulfillment Info Box */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                {isPickup ? (
                  <>
                    <Buildings size={15} weight="bold" className="text-teal-600" />
                    <span>ມາຮັບເອງທີ່ຮ້ານ</span>
                  </>
                ) : (
                  <>
                    <Moped size={15} weight="bold" className="text-emerald-600" />
                    <span>ສົ່ງຮອດບ່ອນ</span>
                  </>
                )}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {isPickup ? `ເວລາ: ${actualOrder.pickup_time || actualOrder.pickupTime || '15 ນາທີ'}` : 'ຄ່າສົ່ງຕາມຕົວຈິງ'}
              </span>
            </div>

            <div className="text-[11px] text-slate-600">
              <div>• ຜູ້ສັ່ງ: <strong className="text-slate-900">{actualOrder.customer_name || actualOrder.customerName}</strong> ({actualOrder.customer_phone || actualOrder.customerPhone})</div>
              {!isPickup && (
                <div className="mt-0.5">• ທີ່ຢູ່: {actualOrder.delivery_address || actualOrder.deliveryAddress}</div>
              )}
            </div>
          </div>

          {/* Items Summary */}
          <div className="border border-slate-200 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-700 text-[11px]">
              <span>ລາຍການສິນຄ້າ ({actualOrder.items?.length || 0})</span>
              <span>ຍອດລວມ</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto text-[11px]">
              {(actualOrder.items || []).map((it, idx) => (
                <div key={idx} className="py-1.5 flex items-center justify-between text-slate-700">
                  <div className="truncate pr-2">
                    {it.product_name || it.productName || it.name}
                    <span className="text-slate-400 font-mono ml-1">x{it.quantity} {it.unit_name || it.unitName}</span>
                  </div>
                  <div className="font-mono font-bold text-slate-900 shrink-0">
                    {formatKip((it.unit_price || it.price) * it.quantity)}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-black">
              <span className="text-slate-700">ຍອດຊຳລະທັງໝົດ:</span>
              <span className="text-sm font-mono text-teal-700">
                {formatKip(actualOrder.grand_total || actualOrder.grandTotal || 0)}
              </span>
            </div>
          </div>

          {/* Quick Notice */}
          <p className="text-[10.5px] text-slate-400 text-center leading-relaxed">
            ຮ້ານໄດ້ຮັບຂໍ້ມູນອໍເດີແລ້ວ ແລະ ກຳລັງກຽມເຄື່ອງໃຫ້ທ່ານ. ເພື່ອໃຫ້ຮ້ານກວດສອບໄວຂຶ້ນ, ທ່ານສາມາດກົດປຸ່ມ WhatsApp ດ້ານລຸ່ມເພື່ອສົ່ງລາຍລະອຽດ.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-2 shrink-0">
          {/* Live Order Tracking Button */}
          {onOpenTracking && (
            <button
              type="button"
              onClick={() => onOpenTracking(actualOrder)}
              className="w-full h-11 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Package size={17} weight="bold" className="text-teal-400" />
              <span>ຕິດຕາມສະຖານະອໍເດີ (Theo dõi đơn hàng)</span>
            </button>
          )}

          {/* WhatsApp Direct Confirmation Button */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-11 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <WhatsappLogo size={18} weight="fill" />
            <span>ສົ່ງລາຍລະອຽດຜ່ານ WhatsApp ໃຫ້ຮ້ານ</span>
          </a>

          {/* Close / Continue shopping button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
          >
            ເລືອກຊື້ສິນຄ້າຕໍ່
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

