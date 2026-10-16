import React from 'react';
import { CalendarBlank, ArrowsLeftRight, ClockCounterClockwise } from '@phosphor-icons/react';

/**
 * MonthPickerGroup Component:
 * Allows user to choose Month A (Baseline) and Month B (Target) independently,
 * with quick shortcuts for MoM (Month-over-Month) and YoY (Year-over-Year).
 */
export default function MonthPickerGroup({
  monthA,
  setMonthA,
  monthB,
  setMonthB,
  isLoading = false,
  onRefresh,
}) {
  const handleApplyPreset = (type) => {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth() + 1;
    const curStr = `${curYear}-${String(curMonth).padStart(2, '0')}`;

    if (type === 'yoy') {
      // Month B: Current Month (e.g. 2026-04)
      // Month A: Same Month Last Year (e.g. 2025-04)
      const prevYearStr = `${curYear - 1}-${String(curMonth).padStart(2, '0')}`;
      setMonthB(curStr);
      setMonthA(prevYearStr);
    } else if (type === 'mom') {
      // Month B: Current Month
      // Month A: Previous Month
      const pDate = new Date(curYear, today.getMonth() - 1, 1);
      const prevMonthStr = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
      setMonthB(curStr);
      setMonthA(prevMonthStr);
    }
  };

  const formatLaoMonthLabel = (ymStr) => {
    if (!ymStr) return '-';
    const [y, m] = ymStr.split('-');
    return `ເດືອນ ${m}/${y}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title & Description */}
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <ArrowsLeftRight size={18} weight="bold" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              ປຽບທຽບລາຍເດືອນ (Year-over-Year Dual-Period Comparison)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ເລືອກ 2 ເດືອນອິດສະຫຼະເພື່ອສົມທຽບຍອດຂາຍ, ຕົ້ນທຶນ ແລະ ກຳໄລ (ດຶງຂໍ້ມູນສະເພາະ 2 ເດືອນນີ້ເທົ່ານັ້ນ)
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleApplyPreset('yoy')}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition"
          >
            ທຽບປີກ່ອນ (YoY: 2025 vs 2026)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('mom')}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition"
          >
            ທຽບເດືອນກ່ອນໜ້າ (MoM)
          </button>
        </div>
      </div>

      {/* Date Pickers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
        {/* Month A (Baseline Period) */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              ເດືອນຖານ A (Baseline): <span className="text-slate-800">{formatLaoMonthLabel(monthA)}</span>
            </span>
            <span className="text-[11px] text-slate-400 font-medium">ສີເທົາ/ມ່ວງອ່ອນ</span>
          </div>
          <div className="relative">
            <input
              type="month"
              value={monthA}
              onChange={(e) => setMonthA(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
          </div>
        </div>

        {/* Month B (Comparison Period) */}
        <div className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-teal-800 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
              ເດືອນທຽບ B (Target): <span className="text-teal-900">{formatLaoMonthLabel(monthB)}</span>
            </span>
            <span className="text-[11px] text-teal-600 font-medium">ສີຂຽວເຂັ້ມ (Teal)</span>
          </div>
          <div className="relative">
            <input
              type="month"
              value={monthB}
              onChange={(e) => setMonthB(e.target.value)}
              className="w-full bg-white border border-teal-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
