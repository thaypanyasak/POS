import React, { useState } from 'react';
import { ArrowsClockwise, Check, X, CurrencyCircleDollar, Lightbulb, CircleNotch } from '@phosphor-icons/react';
import { updateExchangeRateInSupabase } from '../../services/supabase';

export default function ExchangeRateBadge({
  exchangeRate = 0,
  onRateUpdated,
  queryClient,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRate, setTempRate] = useState(String(exchangeRate));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleOpen = () => {
    setTempRate(String(exchangeRate));
    setErrorMsg('');
    setIsOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const cleanNum = Number(String(tempRate).replace(/\D/g, ''));
    if (!cleanNum || cleanNum <= 0) {
      setErrorMsg('ກະລຸນາປ້ອນອັດຕາແລກປ່ຽນທີ່ຖືກຕ້ອງ (> 0)');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    try {
      const res = await updateExchangeRateInSupabase(cleanNum);
      if (res.success) {
        if (onRateUpdated) onRateUpdated(cleanNum);
        if (queryClient) {
          await queryClient.invalidateQueries({ queryKey: ['exchange_rate'] });
          await queryClient.invalidateQueries({ queryKey: ['store_settings'] });
        }
        setIsOpen(false);
      } else {
        setErrorMsg(res.error || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ');
      }
    } catch (err) {
      setErrorMsg(err.message || 'ເກີດຂໍ້ຜິດພາດ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Pill Badge */}
      <button
        type="button"
        onClick={handleOpen}
        className={`h-11 px-3 sm:px-3.5 rounded-xl bg-teal-50 hover:bg-teal-100/80 text-teal-800 border border-teal-200/90 shadow-2xs flex items-center gap-1.5 font-mono text-xs sm:text-sm font-black cursor-pointer transition-all active:scale-95 shrink-0 ${className}`}
        title="ກົດເພື່ອປັບອັດຕາແລກປ່ຽນ (Point-in-Time Snapshot)"
      >
        <ArrowsClockwise size={16} weight="bold" className="text-teal-700 animate-spin-hover" />
        <span className="tabular-nums">1 ฿ = {Number(exchangeRate).toLocaleString()} ₭</span>
      </button>

      {/* Popover / Modal for Rate Update */}
      {isOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-3.5 border border-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <CurrencyCircleDollar size={20} weight="bold" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    ປັບອັດຕາແລກປ່ຽນ (THB / LAK)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Store Settings • Point-in-time Snapshot
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {/* Note about Accounting Principle */}
            <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/70 text-[11px] text-amber-900 leading-relaxed font-medium flex items-start gap-1.5">
              <Lightbulb size={16} weight="duotone" className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>ຫຼັກການບັນຊີ:</strong> ການປ່ຽນອັດຕາແລກປ່ຽນມື້ນີ້ຈະຖືກບັນທຶກເຂົ້າໃນບິນໃໝ່. ບິນຂາຍໃນອະດີດຈະຮັກສາອັດຕາແລກປ່ຽນ Snapshot ຂອງມື້ຂາຍ, ບໍ່ມີການຄິດໄລ່ຄືນ.
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  1 ฿ (Baht) = ເທົ່າໃດກີບ?
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={tempRate}
                    onChange={(e) => setTempRate(e.target.value)}
                    autoFocus
                    placeholder="0"
                    className="w-full h-11 px-3.5 pr-12 rounded-xl bg-slate-50 border border-slate-300 focus:border-teal-600 focus:bg-white text-base font-mono font-black text-slate-900 tracking-tight focus:outline-none transition-all"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">
                    ₭ (LAK)
                  </span>
                </div>
              </div>

              {errorMsg && (
                <p className="text-[11px] font-bold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                  {errorMsg}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <CircleNotch size={16} weight="bold" className="animate-spin text-white" />
                  ) : (
                    <>
                      <Check size={16} weight="bold" />
                      <span>ບັນທຶກ</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
