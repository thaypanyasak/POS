import React, { useState } from 'react';
import { X, Money, HandCoins, CheckCircle } from '@phosphor-icons/react';
import { formatKip, formatDots, parseDots } from '../../utils/formatters';
import { recordCustomerDebtPaymentInSupabase } from '../../services/supabase';

export default function CustomerDebtPaymentModal({
  isOpen,
  onClose,
  transaction,
  onSuccess,
  onAlert,
}) {
  if (!isOpen || !transaction) return null;

  const totalAmount = Number(transaction.grandTotal) || 0;
  const currentPaid = Number(transaction.paidAmount ?? (transaction.amountTendered || 0));
  const remainingDebt = Number(
    transaction.remainingDebt ??
      transaction.debtAmount ??
      Math.max(0, totalAmount - currentPaid)
  );

  const [paymentAmount, setPaymentAmount] = useState(formatDots(remainingDebt));
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // CASH | TRANSFER
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Action: Pay full remaining debt
  const handlePayFull = () => {
    setPaymentAmount(formatDots(remainingDebt));
  };

  // Quick Action: Pay half
  const handlePayHalf = () => {
    setPaymentAmount(formatDots(Math.round(remainingDebt / 2)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payNum = parseDots(paymentAmount);
    if (payNum <= 0) {
      onAlert?.('ກະລຸນາປ້ອນຈຳນວນເງິນທີ່ຕ້ອງການຊຳລະ (> 0)', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }
    if (payNum > remainingDebt) {
      onAlert?.('ຈຳນວນເງິນທີ່ຊຳລະບໍ່ສາມາດເກີນຍອດໜີ້ຄ້າງ!', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await recordCustomerDebtPaymentInSupabase({
        transactionId: transaction.id,
        paymentAmount: payNum,
        paymentMethod,
        note: note.trim(),
      });

      if (res.success) {
        onAlert?.(
          `ບັນທຶກການຊຳລະໜີ້ ${formatKip(payNum)} ສຳເລັດແລ້ວ!`,
          'ສຳເລັດ',
          'success'
        );
        onSuccess?.();
        onClose();
      } else {
        onAlert?.(res.error || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ', 'ຂໍ້ຜິດພາດ', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedEntered = parseDots(paymentAmount);
  const projectedDebt = Math.max(0, remainingDebt - parsedEntered);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-2xs">
              <HandCoins size={22} weight="duotone" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                ຊຳລະໜີ້ລູກຄ້າ (Customer Debt Recovery)
              </h3>
              <p className="text-xs text-slate-500">
                ບິນ: <strong className="text-slate-700">#{transaction.receiptNumber}</strong> • {transaction.customerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Debt Overview Summary Card */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
              ຍອດລວມບິນ
            </span>
            <span className="text-xs font-black text-slate-900 font-mono">
              {formatKip(totalAmount)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-emerald-700 font-bold block uppercase tracking-wider">
              ຈ່າຍແລ້ວ
            </span>
            <span className="text-xs font-black text-emerald-700 font-mono">
              {formatKip(currentPaid)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-rose-700 font-bold block uppercase tracking-wider">
              ຍອດໜີ້ຄ້າງ
            </span>
            <span className="text-xs font-black text-rose-600 font-mono">
              {formatKip(remainingDebt)}
            </span>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Quick Action Presets */}
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-700">
              ຈຳນວນເງິນທີ່ລູກຄ້າຈ່າຍ (₭) *
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePayHalf}
                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer"
              >
                ຈ່າຍເຄິ່ງໜຶ່ງ (50%)
              </button>
              <button
                type="button"
                onClick={handlePayFull}
                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
              >
                ຈ່າຍຄົບໝົດ (100%)
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(formatDots(parseDots(e.target.value)))}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-base font-mono font-black text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
            />
            <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-bold">₭</span>
          </div>

          {/* Projected Remaining Debt Badge */}
          <div className="px-3 py-2 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">ຍອດໜີ້ເຫຼືອຫຼັງຈາກຊຳລະ:</span>
            <strong className="font-mono text-rose-600 font-black">
              {formatKip(projectedDebt)}
            </strong>
          </div>

          {/* Payment Method (Cash vs Transfer) */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              ຮູບແບບການຊຳລະ
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'CASH'
                    ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Money size={16} />
                <span>ເງິນສົດ (CASH)</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('TRANSFER')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'TRANSFER'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>ໂອນເງິນ / QR (TRANSFER)</span>
              </button>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              ໝາຍເຫດ (Note)
            </label>
            <input
              type="text"
              placeholder="ເຊັ່ນ: ໂອນຜ່ານ BCEL One, ລູກຄ້າມາຈ່າຍຢູ່ຮ້ານ..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-2xs"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              ຍົກເລີກ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
            >
              <CheckCircle size={16} weight="bold" />
              <span>{isSubmitting ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກການຊຳລະ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
