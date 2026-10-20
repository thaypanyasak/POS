import React from 'react';
import {
  CheckCircle,
  X,
  CurrencyCircleDollar,
  QrCode,
  Clock,
  Check,
  User,
  WarningCircle,
  Bank,
  Money,
  HandCoins,
  FloppyDisk,
} from '@phosphor-icons/react';
import { formatKip, formatDots, parseDots, getEffectiveUnitPrice } from '../utils/formatters';

export default function CheckoutModal({
  isOpen,
  onClose,
  customerName,
  setCustomerName,
  cartSubtotal,
  cart = [],
  paymentMethod,
  setPaymentMethod,
  tenderedKip,
  setTenderedKip,
  debtPaidKip = 0,
  setDebtPaidKip,
  debtNote = '',
  setDebtNote,
  editingOldTransaction = null,
  onConfirmPayment,
}) {
  if (!isOpen) return null;

  const remainingDebt = Math.max(0, cartSubtotal - (Number(debtPaidKip) || 0));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-3.5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
              {editingOldTransaction ? (
                <>
                  <WarningCircle size={20} className="text-amber-500" weight="fill" />
                  <span className="text-amber-900">
                    ແກ້ໄຂບິນ #{editingOldTransaction.receiptNumber || editingOldTransaction.originalReceiptNumber}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle size={20} className="text-teal-600" weight="fill" />
                  <span>ຊຳລະເງິນ (Checkout)</span>
                </>
              )}
            </h3>
            {editingOldTransaction ? (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[11px] text-slate-500 font-medium">ຮູບແບບຊຳລະເດີມ:</span>
                {(() => {
                  const m = (
                    editingOldTransaction.originalPaymentMethod ||
                    editingOldTransaction.paymentMethod ||
                    ''
                  ).toLowerCase();
                  if (m === 'debt') {
                    const remaining =
                      editingOldTransaction.originalRemainingDebt !== undefined
                        ? Number(editingOldTransaction.originalRemainingDebt)
                        : Number(editingOldTransaction.remainingDebt || 0);
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <HandCoins size={12} weight="bold" />
                        <span>ຕິດໜີ້ (ຄ້າງ: {formatDots(remaining)} ₭)</span>
                      </span>
                    );
                  }
                  if (m === 'transfer' || m === 'onepay') {
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <QrCode size={12} weight="bold" />
                        <span>ໂອນເງິນ (Transfer)</span>
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Money size={12} weight="bold" />
                      <span>ເງິນສົດ (Cash)</span>
                    </span>
                  );
                })()}
              </div>
            ) : (
              <p className="text-[11.5px] text-slate-500 mt-0.5">
                ເລືອກຮູບແບບການຊຳລະ: ເງິນສົດ, ໂອນ, ຫຼື ຄ້າງຊຳລະ
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Customer Name Editor Bar */}
        <div className="flex items-center justify-between text-xs text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <User size={15} className="text-slate-400 shrink-0" weight="bold" />
            <span className="text-slate-500 shrink-0 text-[11px] font-bold">ລູກຄ້າ:</span>
            <input
              type="text"
              value={customerName || ''}
              onChange={(e) => setCustomerName && setCustomerName(e.target.value)}
              placeholder="ຊື່ລູກຄ້າ ຫຼື ເບີໂທຕິດຕໍ່..."
              className="font-bold text-slate-900 bg-transparent hover:bg-white focus:bg-white border-b border-transparent hover:border-slate-300 focus:border-teal-500 focus:outline-none px-1.5 py-0.5 rounded text-xs flex-1 min-w-0"
            />
          </div>
          {paymentMethod === 'debt' && (!customerName || customerName.trim() === 'ລູກຄ້າທົ່ວໄປ') && (
            <span className="text-[10px] text-amber-800 bg-amber-100 font-bold px-2 py-0.5 rounded-full ml-1 shrink-0 animate-pulse border border-amber-300 flex items-center gap-1">
              <WarningCircle size={13} weight="fill" className="text-amber-600" />
              <span>ຄວນໃສ່ຊື່ລູກຄ້າ</span>
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {/* Order Summary & Grouped Items Breakdown (Beer crates + Missing crate deposit) */}
          {cart && cart.length > 0 && (
            <div className="bg-slate-50/90 rounded-2xl border border-slate-200 p-3 max-h-40 overflow-y-auto flex flex-col gap-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] font-black text-slate-500 border-b border-slate-200/80 pb-1">
                <span>ລາຍການສິນຄ້າ ({cart.length})</span>
                <span>ລວມ (₭)</span>
              </div>
              <div className="flex flex-col gap-1.5 pt-0.5">
                {cart.map((item, idx) => {
                  const prodName = item.product?.name || item.productName || 'ສິນຄ້າ';
                  const unitName = item.unit?.unitName || 'ອັນ';
                  const effectivePrice =
                    item.customPrice !== undefined && item.customPrice !== null
                      ? item.customPrice
                      : getEffectiveUnitPrice(item.unit, item.selectedPriceTier || 1);
                  const baseTotal = effectivePrice * item.quantity;
                  const feePerCrate = Number(item.product?.crateDepositFee) || 30000;
                  const missingCount = item.noEmptyCrates
                    ? Math.max(1, Math.min(item.quantity, Number(item.missingCratesCount) || item.quantity))
                    : 0;
                  const crateDepositTotal = missingCount * feePerCrate;

                  return (
                    <div
                      key={`${item.product?.id}_${item.unit?.id}_${idx}`}
                      className="flex flex-col text-xs border-b border-slate-100 last:border-none pb-1.5 last:pb-0"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-800 text-[11.5px] truncate pr-2">
                          {prodName} ({unitName})
                        </span>
                        <div className="text-right whitespace-nowrap">
                          <span className="text-[10.5px] text-slate-500 mr-2 font-mono">
                            {item.quantity} x {formatKip(effectivePrice).replace(' ₭', '')}
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatKip(baseTotal)}
                          </span>
                        </div>
                      </div>

                      {item.noEmptyCrates && missingCount > 0 && (
                        <div className="flex justify-between items-center text-amber-900 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-bold mt-1 border border-amber-200/80">
                          <span>* ບໍ່ມີແກັດປ່ຽນ: ({missingCount} ແກັດ)</span>
                          <div className="text-right whitespace-nowrap font-mono">
                            <span className="text-[9.5px] text-amber-700 mr-2 font-normal">
                              {missingCount} x {formatKip(feePerCrate).replace(' ₭', '')}
                            </span>
                            <span className="font-black text-amber-950">
                              +{formatKip(crateDepositTotal)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grand Total display (STRICTLY LAO KIP ONLY) */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
            <span className="text-xs text-slate-500 block mb-0.5">ຍອດເງິນທີ່ຕ້ອງຊຳລະ (Total Due)</span>
            <span className="text-2xl sm:text-3xl font-black text-teal-700 block tracking-tight font-mono">
              {formatKip(cartSubtotal)}
            </span>
          </div>

          {/* 3 PAYMENT CHOICES: Tiền mặt, Chuyển khoản, Nợ tiền */}
          <div className="grid grid-cols-3 gap-2">
            {/* 1. Cash */}
            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`py-2 px-1 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                paymentMethod === 'cash'
                  ? 'bg-teal-50 border-teal-500 text-teal-800 shadow-xs ring-1 ring-teal-500'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <CurrencyCircleDollar size={18} weight="bold" />
              <span>ເງິນສົດ (Cash)</span>
            </button>

            {/* 2. Transfer / QR */}
            <button
              type="button"
              onClick={() => setPaymentMethod('transfer')}
              className={`py-2 px-1 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                paymentMethod === 'transfer' || paymentMethod === 'onepay'
                  ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-xs ring-1 ring-blue-500'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <QrCode size={18} weight="bold" />
              <span>ໂອນເງິນ (Transfer)</span>
            </button>

            {/* 3. Debt / Credit */}
            <button
              type="button"
              onClick={() => {
                setPaymentMethod('debt');
                if (debtPaidKip === undefined || debtPaidKip === null) {
                  setDebtPaidKip(0);
                }
              }}
              className={`py-2 px-1 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                paymentMethod === 'debt'
                  ? 'bg-rose-50/40 border-rose-400 text-rose-800 shadow-xs ring-1 ring-rose-300'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Clock size={18} weight="bold" className={paymentMethod === 'debt' ? 'text-rose-500' : ''} />
              <span>ຄ້າງຊຳລະ (Debt/Credit)</span>
            </button>
          </div>

          {/* CHOICE 1: Cash Details */}
          {paymentMethod === 'cash' && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">ຈຳນວນເງິນທີ່ໄດ້ຮັບ (₭):</label>
                <span className="text-[11px] font-bold text-teal-700 font-mono">
                  {tenderedKip ? formatDots(tenderedKip) + ' ₭' : '0 ₭'}
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={tenderedKip ? formatDots(tenderedKip) : ''}
                  placeholder="0"
                  onChange={(e) => setTenderedKip(parseDots(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xl font-black text-slate-900 font-mono text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 pr-10 shadow-inner"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 font-mono pointer-events-none">
                  ₭
                </span>
              </div>

              {/* Fast Tender Chips */}
              <div className="grid grid-cols-4 gap-1.5 mt-1">
                {[cartSubtotal, 50000, 100000, 500000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTenderedKip(amt)}
                    className={`py-1.5 px-0.5 rounded-lg text-[10.5px] font-bold font-mono transition-all cursor-pointer border ${
                      tenderedKip === amt
                        ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    {formatDots(amt)} ₭
                  </button>
                ))}
              </div>

              {/* Change output */}
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200 mt-1">
                <span className="text-xs font-bold text-slate-700">ເງິນທອນ (Change):</span>
                <span className="text-lg font-black text-emerald-800 font-mono">
                  {formatKip(Math.max(0, tenderedKip - cartSubtotal))}
                </span>
              </div>
            </div>
          )}

          {/* CHOICE 2: Combined Transfer / Lao QR */}
          {(paymentMethod === 'transfer' || paymentMethod === 'onepay') && (
            <div className="p-3 bg-blue-50/40 rounded-2xl border border-blue-200 flex flex-col items-center gap-2 text-center">
              <div className="w-32 h-32 bg-white p-1.5 rounded-xl shadow-xs flex items-center justify-center border border-slate-200">
                <img
                  src="/qr.jpg"
                  alt="Lao QR / BCEL One"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src =
                      'https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=LAO_BCEL_POS_TRANSFER';
                  }}
                />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-black text-blue-900">
                  ສະແກນ QR ຜ່ານແອັບ BCEL One / Lao QR
                </span>
                <span className="text-xs font-bold text-slate-700 font-mono mt-0.5">
                  ຍອດໂອນ: <strong className="text-blue-700 text-sm">{formatKip(cartSubtotal)}</strong>
                </span>
                <span className="text-[10.5px] text-slate-500 font-medium mt-0.5">
                  010-12-000-12345678-001 • ຮ້ານ MeiiShop
                </span>
              </div>
            </div>
          )}

          {/* CHOICE 3: Debt / Credit Setup - Thiết kế tinh gọn, chữ và input vừa vặn, màu đỏ nhạt tao nhã */}
          {paymentMethod === 'debt' && (
            <div className="flex flex-col gap-2.5 bg-rose-50/20 rounded-2xl border border-rose-200/50 p-3 sm:p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-slate-800 flex items-center gap-1.5">
                  <WarningCircle size={15} className="text-rose-500" weight="bold" />
                  <span>ຕັ້ງຄ່າການຄ້າງຊຳລະ (Credit Sale)</span>
                </span>
                <span
                  className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md border ${
                    debtPaidKip <= 0
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {debtPaidKip <= 0 ? 'ຄ້າງຊຳລະ 100%' : 'ຈ່າຍກ່ອນບາງສ່ວນ'}
                </span>
              </div>

              {/* Amount paid now input with compact height & proportional font size */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-slate-600">
                    ຈຳນວນເງິນທີ່ຈ່າຍແລ້ວ / ຈ່າຍກ່ອນ (₭):
                  </label>
                  <span className={`text-[11px] font-mono font-bold ${debtPaidKip <= 0 ? 'text-rose-500' : 'text-emerald-700'}`}>
                    {debtPaidKip <= 0 ? 'ຍັງບໍ່ຈ່າຍ (0 ₭)' : formatDots(debtPaidKip) + ' ₭'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={debtPaidKip > 0 ? formatDots(debtPaidKip) : ''}
                    placeholder="0 (ຫຼື ກົດເລືອກດ້ານລຸ່ມ)"
                    onChange={(e) =>
                      setDebtPaidKip(Math.min(cartSubtotal, Math.max(0, parseDots(e.target.value))))
                    }
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 text-slate-900 rounded-lg text-sm font-bold font-mono text-center focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 pr-7 shadow-2xs placeholder:text-slate-400 placeholder:text-xs placeholder:font-sans"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono pointer-events-none">
                    ₭
                  </span>
                </div>
              </div>

              {/* Fast Debt Chips */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setDebtPaidKip(0)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    debtPaidKip === 0
                      ? 'bg-rose-500 text-white border-rose-500 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span>ຄ້າງຊຳລະ 100% (0 ₭)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDebtPaidKip(Math.round(cartSubtotal / 2))}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    debtPaidKip === Math.round(cartSubtotal / 2) && debtPaidKip > 0
                      ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span>ຈ່າຍກ່ອນ 50% ({formatDots(Math.round(cartSubtotal / 2))} ₭)</span>
                </button>
              </div>

              {/* Remaining Debt Highlight Box - Gọn gàng, chữ vừa vặn */}
              <div className="p-2.5 bg-white rounded-xl border border-rose-100 flex items-center justify-between shadow-2xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                    ຍອດຄ້າງຊຳລະ / ຄ້າງຊຳລະ (Debt Balance)
                  </span>
                  <span className="text-[10.5px] text-slate-500 font-mono">
                    {debtPaidKip > 0
                      ? `ເຕັມ ${formatDots(cartSubtotal)} ₭ - ຈ່າຍ ${formatDots(debtPaidKip)} ₭`
                      : 'ລູກຄ້າຄ້າງຊຳລະເຕັມຈຳນວນ 100%'}
                  </span>
                </div>
                <span className="text-base sm:text-lg font-black text-rose-600 font-mono tracking-tight">
                  {formatKip(remainingDebt)}
                </span>
              </div>

              {/* Debt Note */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  ໝາຍເຫດຄ້າງຊຳລະ / ວັນນັດຊຳລະ:
                </label>
                <input
                  type="text"
                  value={debtNote}
                  onChange={(e) => setDebtNote && setDebtNote(e.target.value)}
                  placeholder="ເຊັ່ນ: ນັດຈ່າຍທ້າຍເດືອນ, ອ້າຍສົມສັກ 020 5555 1234..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-rose-300 focus:ring-1 focus:ring-rose-200 focus:outline-none shadow-2xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all cursor-pointer"
          >
            ຍົກເລີກ
          </button>
          <button
            type="button"
            onClick={onConfirmPayment}
            className={`px-5 py-2.5 text-white font-extrabold text-xs rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer ${
              editingOldTransaction
                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
            }`}
          >
            {editingOldTransaction ? (
              <>
                <FloppyDisk size={16} weight="bold" />
                <span>ບັນທຶກການແກ້ໄຂ</span>
              </>
            ) : (
              <>
                <Check size={16} weight="bold" />
                <span>ຢືນຢັນ & ພິມໃບບິນ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
