import React, { useRef } from 'react';
import {
  X,
  Printer,
  FileText,
  WarningCircle,
  ShareNetwork,
} from '@phosphor-icons/react';
import { formatKip, formatDots, getEffectiveUnitPrice } from '../../utils/formatters';

export default function QuotationPreviewModal({
  isOpen,
  onClose,
  cart = [],
  cartSubtotal = 0,
  customerName = 'ລູກຄ້າທົ່ວໄປ',
  cashierName = 'ໄມ້ຄຳ (Meii)',
  onAlert,
}) {
  const printRef = useRef(null);

  if (!isOpen) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('lo-LA');
  const timeStr = now.toLocaleTimeString('lo-LA');
  const quotationNumber = `QT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-4)}`;

  // Total crate deposits if applicable
  const totalCrateDeposit = cart.reduce((sum, it) => {
    const fee = Number(it.product?.crateDepositFee) || 30000;
    const count = Number(it.missingCratesCount) || (it.noEmptyCrates ? it.quantity : 0);
    return sum + (it.noEmptyCrates ? count * fee : 0);
  }, 0);

  const goodsSubtotal = cartSubtotal - totalCrateDeposit;

  // Window browser print
  const handleBrowserPrint = () => {
    window.print();
  };

  // Raw ESC/POS thermal printer simulation / Web Serial or Network raw print trigger
  const handleRawEscPosPrint = () => {
    onAlert?.('ສົ່ງຄຳສັ່ງພິມໃບບອກລາຄາ (Quotation ESC/POS) ໄປຍັງເຄື່ອງພິມແລ້ວ!', 'ສຳເລັດ', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-3.5 max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 no-print">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
              <FileText size={20} weight="duotone" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                <span>ໃບບອກລາຄາ / QUOTATION</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                  ໃບຊົ່ວຄາວ
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                ກວດສອບລາຍການສິນຄ້າ ແລະ ລາຄາກ່ອນພິມ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        

        {/* Printable Thermal Receipt Container (Styled strictly for 80mm / 58mm POS thermal slips) */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div
            ref={printRef}
            id="quotation-print-area"
            className="bg-white border border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs font-sans text-slate-900 max-w-[360px] mx-auto text-xs leading-normal select-none"
            style={{
              fontFamily: '"Noto Sans Lao", system-ui, -apple-system, sans-serif',
            }}
          >
            {/* Store Branding */}
            <div className="text-center pb-2 border-b-2 border-slate-900">
              <h2 className="text-lg font-black tracking-tight uppercase">ຮ້ານ Meiishop</h2>
              <div className="text-xs font-black tracking-wider uppercase mt-0.5 text-slate-800">
                ໃບບອກລາຄາ / QUOTATION
              </div>
              <div className="text-[10.5px] font-extrabold text-red-600 bg-red-50 py-0.5 px-2 rounded-md border border-red-200 inline-block mt-1">
                *** ໃບນີ້ບໍ່ແມ່ນໃບບິນຮັບເງິນ / NOT A RECEIPT ***
              </div>
            </div>

            {/* Slip Meta */}
            <div className="py-2.5 flex flex-col gap-1 text-[11px] border-b border-dashed border-slate-300 font-medium text-slate-700">
              <div className="flex justify-between">
                <span>ເລກທີໃບສະເໜີ:</span>
                <span className="font-mono font-bold text-slate-950">{quotationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>ວັນທີ & ເວລາ:</span>
                <span className="font-mono">{dateStr} {timeStr}</span>
              </div>
              <div className="flex justify-between">
                <span>ພະນັກງານ:</span>
                <span className="font-bold text-slate-900">{cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>ລູກຄ້າ:</span>
                <span className="font-bold text-slate-900">{customerName || 'ລູກຄ້າທົ່ວໄປ'}</span>
              </div>
            </div>

            {/* Table Header */}
            <div className="pt-2 pb-1 border-b border-slate-400 flex items-center text-[10.5px] font-black text-slate-800">
              <span className="w-[44%] text-left">ຊື່ລາຍການ</span>
              <span className="w-[14%] text-center">ຈຳນວນ</span>
              <span className="w-[20%] text-right">ລາຄາ</span>
              <span className="w-[22%] text-right">ລວມ (₭)</span>
            </div>

            {/* Line items */}
            <div className="py-1.5 flex flex-col gap-1.5 border-b border-dashed border-slate-300">
              {cart.map((it, idx) => {
                const prodName = it.product?.name || 'ສິນຄ້າ';
                const unitName = it.unit?.unitName || 'ອັນ';
                const effectivePrice =
                  it.customPrice !== undefined && it.customPrice !== null
                    ? it.customPrice
                    : getEffectiveUnitPrice(it.unit, it.selectedPriceTier || 1);
                const baseTotal = effectivePrice * it.quantity;

                const hasMissingCrates = Boolean(it.noEmptyCrates);
                const feePerCrate = Number(it.product?.crateDepositFee) || 30000;
                const missingCount = Number(it.missingCratesCount) || (hasMissingCrates ? it.quantity : 0);
                const crateFeeTotal = hasMissingCrates ? missingCount * feePerCrate : 0;

                return (
                  <div key={idx} className="flex flex-col text-[11px] leading-tight">
                    <div className="flex items-start text-slate-900">
                      <span className="w-[44%] font-bold text-left line-clamp-2 pr-1 break-words">
                        {prodName} <span className="font-normal text-slate-600">({unitName})</span>
                      </span>
                      <span className="w-[14%] text-center font-mono text-[10px] text-slate-700">
                        {it.quantity}x
                      </span>
                      <span className="w-[20%] text-right font-mono text-[10.5px]">
                        {formatDots(effectivePrice)}
                      </span>
                      <span className="w-[22%] text-right font-mono font-bold text-slate-950">
                        {formatDots(baseTotal)}
                      </span>
                    </div>

                    {/* Beer Crate line if applicable */}
                    {hasMissingCrates && missingCount > 0 && (
                      <div className="flex items-center text-[9.5px] text-amber-900 bg-amber-50/80 py-0.5 px-1 rounded mt-0.5 border border-amber-200">
                        <span className="w-[44%] font-medium text-left truncate">↳ ບໍ່ມີລັງປ່ຽນ</span>
                        <span className="w-[14%] text-center font-mono">{missingCount}x</span>
                        <span className="w-[20%] text-right font-mono">{formatDots(feePerCrate)}</span>
                        <span className="w-[22%] text-right font-mono font-bold">+{formatDots(crateFeeTotal)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Totals Summary */}
            <div className="py-2 flex flex-col gap-1 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>ລວມເງິນສິນຄ້າ (Subtotal):</span>
                <span className="font-mono font-bold text-slate-900">{formatKip(goodsSubtotal)}</span>
              </div>
              {totalCrateDeposit > 0 && (
                <div className="flex justify-between text-amber-900">
                  <span>ຄ່າມັດຈຳລັງເບຍ:</span>
                  <span className="font-mono font-bold">+{formatKip(totalCrateDeposit)}</span>
                </div>
              )}
              <div className="border-b-2 border-slate-900 my-1"></div>
              <div className="flex justify-between items-center py-0.5">
                <span className="font-black text-xs uppercase tracking-tight text-slate-900">
                  ຍອດລວມທັງໝົດ (Total Amount):
                </span>
                <span className="font-black text-base text-teal-800 font-mono tracking-tight">
                  {formatKip(cartSubtotal)}
                </span>
              </div>
              <div className="border-b-2 border-slate-900 my-1"></div>
            </div>

            {/* Terms & Conditions Notice */}
            <div className="py-2 text-[10px] text-slate-600 border-b border-dashed border-slate-300 flex flex-col gap-1 leading-normal italic">
              <p>• ໃບສະເໜີລາຄານີ້ມີກຳນົດ 3 ວັນ ນັບຈາກວັນທີອອກໃບ.</p>
              <p>• ລາຄານີ້ອາດມີການປ່ຽນແປງຕາມສະພາບຕະຫຼາດຕົວຈິງ.</p>
              <p>• ຂໍຂອບໃຈລູກຄ້າທີ່ໃຫ້ຄວາມສົນໃຈສິນຄ້າຮ້ານເຮົາ!</p>
            </div>

            {/* Signatures */}
            <div className="pt-3 pb-1 grid grid-cols-2 text-[9.5px] text-slate-600 text-center">
              <div>
                <p className="font-bold text-slate-800">ລູກຄ້າ (Customer)</p>
                <p className="mt-6 text-slate-400">........................</p>
              </div>
              <div>
                <p className="font-bold text-slate-800">ພະນັກງານອອກໃບ (Staff)</p>
                <p className="mt-6 text-slate-400">........................</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between no-print">
          <div className="text-[11.5px] text-slate-500 font-medium">
            ຈຳນວນ {cart.length} ລາຍການ • ຍອດລວມ: <strong className="text-teal-700">{formatKip(cartSubtotal)}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              ປິດ
            </button>
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Printer size={16} weight="bold" />
              <span>ພິມໃບບອກລາຄາ (Print)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
