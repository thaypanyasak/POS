import React from 'react';
import {
  Receipt,
  X,
  Printer,
  QrCode,
  Prohibit
} from '@phosphor-icons/react';
import { formatKip } from '../utils/formatters';

export default function ReceiptModal({
  isOpen,
  onClose,
  receipt,
  paperWidth,
  setPaperWidth,
  onCancelReceipt,
}) {
  if (!isOpen || !receipt) return null;

  const isCancelled = receipt.status === 'cancelled' || receipt.isCancelled;

  const receiptItems =
    receipt.items && receipt.items.length > 0
      ? receipt.items
      : (receipt.sale_transaction_items && receipt.sale_transaction_items.length > 0
          ? receipt.sale_transaction_items
          : []);

  const isTransferPayment = receipt.paymentMethod !== 'cash';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-100 rounded-3xl max-w-md w-full p-4 shadow-2xl flex flex-col gap-3 animate-in zoom-in-95 duration-200 max-h-[95vh] overflow-y-auto">
        {/* Top Toolbar: 80mm vs 58mm Paper Toggle & Close */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 bg-white p-2.5 rounded-2xl">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-teal-600" weight="bold" />
            <span className="text-xs font-bold text-slate-900">ໃບບິນ MeiiShop</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setPaperWidth(80)}
                className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                  paperWidth === 80 ? 'bg-teal-600 text-white' : 'text-slate-600'
                }`}
              >
                80mm
              </button>
              <button
                onClick={() => setPaperWidth(58)}
                className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                  paperWidth === 58 ? 'bg-teal-600 text-white' : 'text-slate-600'
                }`}
              >
                58mm
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Authentic Thermal Receipt Paper Container */}
        <div
          id="thermal-receipt-print-area"
          className={`bg-white mx-auto p-4 border border-slate-200 shadow-sm text-slate-900 ${
            paperWidth === 80 ? 'w-full max-w-[380px]' : 'w-full max-w-[280px]'
          }`}
        >
          {/* Store Logo Badge & Header */}
          <div className="text-center pb-3">
            <div className="inline-block bg-teal-700 text-white font-black text-sm px-3 py-1 rounded mb-1 tracking-wider">
              MeiiShop
            </div>
            <h2 className="text-base font-black text-slate-900 leading-tight">ຮ້ານ MeiiShop</h2>
            <p className="text-[10px] text-slate-600 font-bold">
              ຂາຍຍົກ - ຂາຍຍ່ອຍ ສິນຄ້າອຸປະໂພກ ບໍລິໂພກ
            </p>
            <p className="text-[9.5px] text-slate-500">
              ຖະໜົນ ໄກສອນ ພົມວິຫານ, ບ້ານ ໂພນສະຫວ່າງ, ນະຄອນຫຼວງວຽງຈັນ
            </p>
            <p className="text-[9.5px] text-slate-600 font-bold">
              ໂທ: 020 5555 9999 / 021 214 555
            </p>
          </div>

          {/* Receipt Title Banner */}
          <div className="py-1 border-y-2 border-slate-900 text-center font-black text-xs my-2">
            ໃບບິນຮັບເງິນ / RECEIPT
          </div>

          {/* Void / Cancelled Watermark Banner */}
          {isCancelled && (
            <div className="my-2 p-2 bg-rose-600 text-white font-black text-center rounded-lg shadow-xs border-2 border-rose-800 animate-in fade-in">
              <div className="flex items-center justify-center gap-1.5 text-xs tracking-wider uppercase">
                <Prohibit size={18} weight="bold" />
                <span>ໃບບິນນີ້ຖືກຍົກເລີກແລ້ວ (VOID)</span>
              </div>
              <p className="text-[9.5px] font-medium opacity-95 mt-0.5">
                {receipt.cancelledAt ? `ວັນທີຍົກເລີກ: ${new Date(receipt.cancelledAt).toLocaleString('lo-LA')}` : 'ບິນຖືກຍົກເລີກແລ້ວ'} • ສິນຄ້າຖືກສົ່ງຄືນເຂົ້າສາງແລ້ວ
              </p>
            </div>
          )}

          {/* Metadata Info - 2 Rows with 2 Items Per Row (No Receipt Number, since barcode is at bottom) */}
          <div className="flex flex-col gap-1 text-[10.5px] text-slate-700 pb-2">
            {isCancelled && (
              <div className="flex justify-between items-center bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[10px]">
                <span className="font-bold text-rose-800">ສະຖານະ:</span>
                <span className="font-black text-rose-700 uppercase">
                  🚫 ຍົກເລີກແລ້ວ (Cancelled)
                </span>
              </div>
            )}

            {/* Row 1: Cashier/Seller (Left) + Customer (Right) */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 truncate max-w-[48%]">
                <span className="text-slate-500">ຜູ້ຂາຍ:</span>
                <span className="font-medium text-slate-800 truncate">
                  {receipt.cashierName || 'Meii'}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1 truncate max-w-[50%]">
                <span className="text-slate-500">ລູກຄ້າ:</span>
                <span className="font-bold text-slate-900 truncate">
                  {receipt.customerName || 'ລູກຄ້າທົ່ວໄປ'}
                </span>
              </div>
            </div>

            {/* Row 2: Date & Time (Left) + Payment Method (Right) */}
            <div className="flex justify-between items-center pt-0.5">
              <div className="flex items-center gap-1 font-mono text-[10px] text-slate-700">
                <span className="font-sans text-slate-500">ວັນທີ:</span>
                <span>{new Date(receipt.createdAt).toLocaleString('lo-LA')}</span>
              </div>
              <div className="flex items-center gap-1 text-[10.5px]">
                <span className="text-slate-500">ຊຳລະ:</span>
                <span className={`font-bold ${receipt.paymentMethod === 'debt' ? 'text-amber-800' : 'text-teal-800'}`}>
                  {receipt.paymentMethod === 'cash'
                    ? 'ເງິນສົດ'
                    : (receipt.paymentMethod === 'transfer' || receipt.paymentMethod === 'qrTransfer' || receipt.paymentMethod === 'onepay')
                    ? 'QR ໂອນ'
                    : receipt.paymentMethod === 'debt'
                    ? (Number(receipt.paidAmount || 0) === 0 ? 'ຕິດໜີ້ 100%' : 'ຕິດໜີ້ (ບາງສ່ວນ)')
                    : 'ໂອນບັນຊີ'}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table Header - 4 Columns: Name (40%), Qty (15%), Price (20%), Total (25%) */}
          <div className="border-t border-dashed border-slate-300 pt-2 pb-1 flex items-center font-extrabold text-[10px] text-slate-800">
            <span className="w-[40%] text-left">ຊື່ລາຍການ</span>
            <span className="w-[15%] text-center">ຈຳນວນ</span>
            <span className="w-[20%] text-right">ລາຄາ</span>
            <span className="w-[25%] text-right">ລວມ (₭)</span>
          </div>
          <div className="border-b border-slate-400 mb-1.5"></div>

          {/* Item Rows - Single Line 4-Column Layout */}
          <div className="flex flex-col gap-1.5 pb-2.5 border-b border-dashed border-slate-300">
            {receiptItems.length > 0 ? (
              receiptItems.map((it, i) => {
                const prodName = it.product?.name || it.productName || it.product_name || 'ສິນຄ້າ';
                const unitName = it.unit?.unitName || it.unitName || it.unit_name || 'ອັນ';
                const price = Number(
                  it.customPrice ??
                  it.effectivePrice ??
                  it.effectiveUnitPrice ??
                  it.unitPrice ??
                  it.unit_price ??
                  (receipt.isWholesale
                    ? (it.unit?.wholesalePrice ?? it.unit?.retailPrice ?? 0)
                    : (it.unit?.retailPrice ?? 0))
                ) || 0;
                const qty = it.quantity || 1;
                const baseLineTotal = price * qty;
                const hasMissingCrates = Boolean(
                  it.noEmptyCrates || (Number(it.missingCratesCount) > 0) || (Number(it.crateDepositTotal) > 0)
                );
                const feePerCrate = Number(it.crateDepositFee || it.product?.crateDepositFee) || 30000;
                const missingCount = Number(it.missingCratesCount) || (hasMissingCrates ? qty : 0);
                const crateDepositTotal = Number(it.crateDepositTotal) || (hasMissingCrates ? missingCount * feePerCrate : 0);

                return (
                  <div key={i} className="flex flex-col text-[11px] leading-tight">
                    {/* Main Row: 4 Columns with Product Name allowed up to 2 lines */}
                    <div className="flex items-start text-slate-900">
                      <span className="w-[40%] font-bold text-left line-clamp-2 pr-1 break-words leading-tight" title={`${prodName} (${unitName})`}>
                        {prodName} <span className="font-medium text-slate-700">({unitName})</span>
                      </span>
                      <span className="w-[15%] text-center font-mono text-[10.5px] text-slate-800">
                        {qty}x
                      </span>
                      <span className="w-[20%] text-right font-mono text-[10.5px] text-slate-700">
                        {formatKip(price).replace(' ₭', '')}
                      </span>
                      <span className="w-[25%] text-right font-bold font-mono text-slate-950">
                        {formatKip(baseLineTotal).replace(' ₭', '')}
                      </span>
                    </div>

                    {/* Crate Deposit row for bottles/beers without empty crates to exchange (+30.000 ₭/crate) */}
                    {hasMissingCrates && missingCount > 0 && (
                      <div className="flex items-center text-[10px] text-amber-950 bg-amber-50/90 py-0.5 px-1 rounded mt-0.5 border border-amber-200">
                        <span className="w-[40%] font-bold text-left truncate text-amber-900" title="ບໍ່ມີລັງປ່ຽນ (ຄ່າມັດຈຳແກັດ)">
                          ↳ ບໍ່ມີລັງປ່ຽນ
                        </span>
                        <span className="w-[15%] text-center font-mono text-amber-900">
                          {missingCount}x
                        </span>
                        <span className="w-[20%] text-right font-mono text-amber-800">
                          {formatKip(feePerCrate).replace(' ₭', '')}
                        </span>
                        <span className="w-[25%] text-right font-black font-mono text-amber-950">
                          +{formatKip(crateDepositTotal).replace(' ₭', '')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-2 text-center text-slate-400 text-[10.5px] italic">
                (ກຳລັງໂຫຼດລາຍການສິນຄ້າ...)
              </div>
            )}
          </div>

          {/* Totals Summary */}
          {(() => {
            const totalCrateDeposit = receiptItems.reduce((sum, it) => {
              const fee = Number(it.crateDepositFee || it.product?.crateDepositFee) || 30000;
              const count = Number(it.missingCratesCount) || (it.noEmptyCrates ? it.quantity : 0);
              return sum + (Number(it.crateDepositTotal) || (it.noEmptyCrates ? count * fee : 0));
            }, 0);

            // True goods-only subtotal: sum of (unit_price * quantity), without crate fee
            const goodsSubtotalFromItems = receiptItems.reduce((sum, it) => {
              const price = Number(
                it.customPrice ??
                it.effectivePrice ??
                it.effectiveUnitPrice ??
                it.unitPrice ??
                it.unit_price ??
                (receipt.isWholesale
                  ? (it.unit?.wholesalePrice ?? it.unit?.retailPrice ?? 0)
                  : (it.unit?.retailPrice ?? 0))
              ) || 0;
              return sum + (price * (it.quantity || 1));
            }, 0);

            // If receipt.subtotal already included crate deposit, deduct it so goodsSubtotal is pure product cost (e.g. 780.000)
            const pureGoodsSubtotal = goodsSubtotalFromItems > 0
              ? goodsSubtotalFromItems
              : Math.max(0, (receipt.subtotal || 0) - totalCrateDeposit);

            const discount = Number(receipt.discountTotal) || 0;
            const finalGrandTotal = receipt.grandTotal
              ? Math.max(receipt.grandTotal, pureGoodsSubtotal + totalCrateDeposit - discount)
              : (pureGoodsSubtotal + totalCrateDeposit - discount);

            return (
              <div className="flex flex-col gap-1.5 py-2 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>ລວມເງິນສິນຄ້າ (Subtotal):</span>
                  <span className="font-mono">{formatKip(pureGoodsSubtotal)}</span>
                </div>
                {totalCrateDeposit > 0 && (
                  <div className="flex justify-between text-amber-900 font-bold bg-amber-50/80 px-1.5 py-0.5 rounded">
                    <span>ຄ່າມັດຈຳລັງ (Crate Deposit):</span>
                    <span className="font-mono font-black">+{formatKip(totalCrateDeposit)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>ສ່ວນຫຼຸດ (Discount):</span>
                    <span className="font-mono">-{formatKip(discount)}</span>
                  </div>
                )}
                <div className="border-b-2 border-slate-900 my-1"></div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="font-black text-sm text-slate-900">ຍອດຊຳລະສຸດທິ:</span>
                  <span className="font-black text-lg text-teal-800 font-mono tracking-tight">
                    {formatKip(finalGrandTotal)}
                  </span>
                </div>
                <div className="border-b-2 border-slate-900 my-1"></div>

                {(receipt.paymentMethod === 'debt' || receipt.isDebt) ? (
                  <div className="bg-amber-50/80 p-2 rounded-xl border border-amber-300 flex flex-col gap-1.5 my-1">
                    <div className="flex justify-between items-center text-slate-800">
                      <span className="font-bold text-[11px]">ຈ່າຍແລ້ວ / ຈ່າຍກ່ອນ (Paid):</span>
                      <span className="font-mono font-black text-emerald-800 text-xs">
                        {formatKip(receipt.paidAmount ?? receipt.amountTendered ?? 0)}
                      </span>
                    </div>
                    <div className="border-b border-dashed border-amber-300"></div>
                    <div className="flex justify-between items-center text-red-700 font-black">
                      <span className="text-xs">ຍອດຄ້າງຊຳລະ (Debt Balance):</span>
                      <span className="font-mono text-sm tracking-tight font-black">
                        {formatKip(receipt.debtAmount ?? Math.max(0, receipt.grandTotal - (receipt.paidAmount ?? receipt.amountTendered ?? 0)))}
                      </span>
                    </div>
                    {receipt.debtNote && (
                      <div className="text-[9.5px] text-amber-950 font-medium italic pt-1 border-t border-amber-200">
                        * ໝາຍເຫດ: {receipt.debtNote}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-700">
                      <span>ຮັບເງິນມາ (Tendered):</span>
                      <span className="font-bold font-mono text-slate-900">
                        {formatKip(receipt.amountTendered)}
                      </span>
                    </div>
                    {receipt.paymentMethod === 'cash' && (
                      <div className="flex justify-between text-slate-900 font-bold">
                        <span>ເງິນທອນ (Change):</span>
                        <span className="font-mono text-emerald-800 text-xs">
                          {formatKip(receipt.changeAmount)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* QR Code in receipt for transfer payments or unpaid debt - Frameless & Minimal */}
          {(isTransferPayment || (receipt.paymentMethod === 'debt' && (receipt.debtAmount ?? receipt.grandTotal) > 0)) && (
            <div className="my-2 py-1 text-center flex flex-col items-center">
              <img
                src="/qr.jpg"
                alt="Lao QR Payment"
                className="w-32 h-32 object-contain"
                onError={(e) => {
                  e.currentTarget.src =
                    'https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=LAO_QR_BCEL_POS_DEMO';
                }}
              />
              <span className="text-[11.5px] font-black text-slate-900 mt-1 font-mono">
                ຍອດໂອນ: {formatKip((receipt.paymentMethod === 'debt' || receipt.isDebt) ? (receipt.debtAmount ?? receipt.grandTotal) : receipt.grandTotal)}
              </span>
            </div>
          )}

          {/* Signatures Section (Customized for Debt vs Normal Cash) */}
          <div className="border-t border-dashed border-slate-300 pt-3 pb-2 grid grid-cols-2 text-[10px] text-slate-600 text-center">
            <div>
              <p className="font-bold text-slate-700">
                {(receipt.paymentMethod === 'debt' || receipt.isDebt) ? 'ລາຍເຊັນຜູ້ຄ້າງຊຳລະ (Debtor)' : 'ຜູ້ຮັບເຄື່ອງ (Customer)'}
              </p>
              <p className="mt-7 text-slate-400">................................</p>
            </div>
            <div>
              <p className="font-bold text-slate-700">
                {(receipt.paymentMethod === 'debt' || receipt.isDebt) ? 'ລາຍເຊັນຜູ້ຂາຍ (Seller)' : 'ພະນັກງານຂາຍ (Cashier)'}
              </p>
              <p className="mt-7 text-slate-400">................................</p>
            </div>
          </div>

          {/* Barcode Strip (Realistic seamless thermal printer barcode lines, no huge gaps) */}
          <div className="border-t border-dashed border-slate-300 pt-3 text-center">
            <div className="flex items-center justify-center h-8 my-1.5 overflow-hidden select-none">
              {[2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 2, 1, 2, 4, 1, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 2, 1, 2, 4].map((w, idx) => (
                <div
                  key={idx}
                  style={{ width: `${w * 1.5}px` }}
                  className={`h-full ${idx % 2 === 0 ? 'bg-slate-900' : 'bg-transparent'}`}
                />
              ))}
            </div>
            <span className="text-[10px] text-slate-600 font-mono tracking-widest block font-bold">
              {receipt.receiptNumber}
            </span>
            <p className="text-[10.5px] text-slate-700 mt-2 font-bold leading-tight">
              ຂໍຂອບໃຈລູກຄ້າທີ່ມາອຸດໜູນ! ໂອກາດໜ້າເຊີນໃໝ່ເດີ
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">
              ສິນຄ້າຊື້ແລ້ວ ບໍ່ຮັບປ່ຽນ ຫຼື ຄືນເງິນ • ກະລຸນາກວດສອບເງິນທອນ
            </p>
            
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2 pt-2">
          {/* Cancel/Void Bill Button */}
          {isCancelled ? (
            <div className="py-2.5 px-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 select-none">
              <Prohibit size={15} weight="bold" />
              <span>ບິນນີ້ຍົກເລີກແລ້ວ</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onCancelReceipt && onCancelReceipt(receipt)}
              className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
              title="ຍົກເລີກບິນນີ້ ແລະ ສົ່ງຄືນສະຕັອກສິນຄ້າເຂົ້າສາງ"
            >
              <Prohibit size={15} weight="bold" />
              <span>ຍົກເລີກບິນ</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
          >
            ປິດໜ້າຕ່າງ
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Printer size={16} />
            <span>ພິມໃບບິນ ({paperWidth}mm)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
