import React, { useState, useMemo } from 'react';
import { formatKip } from '../../utils/formatters';
import { TrendUp, TrendDown, ChartBar, Lightbulb } from '@phosphor-icons/react';

/**
 * DualBarComparisonChart Component:
 * Renders daily side-by-side comparison bars for Days 1 to 31.
 * Bar A: Muted Slate / Soft Indigo (#94A3B8 / #818CF8) for Month A.
 * Bar B: Deep Teal / Emerald (#0F766E / #14B8A6) for Month B.
 * Interactive hover tooltip with absolute difference & growth percentage.
 */
export default function DualBarComparisonChart({
  txsA = [],
  txsB = [],
  monthALabel = 'ເດືອນ A',
  monthBLabel = 'ເດືອນ B',
}) {
  const [hoveredDay, setHoveredDay] = useState(null);

  // Group revenues by day of month (1 to 31)
  const chartData = useMemo(() => {
    const days = [];
    for (let d = 1; d <= 31; d++) {
      days.push({
        day: d,
        revenueA: 0,
        revenueB: 0,
        costA: 0,
        costB: 0,
        profitA: 0,
        profitB: 0,
        countA: 0,
        countB: 0,
      });
    }

    txsA.forEach((tx) => {
      const date = new Date(tx.createdAt);
      const dayNum = date.getDate();
      if (dayNum >= 1 && dayNum <= 31) {
        const item = days[dayNum - 1];
        item.revenueA += Number(tx.grandTotal) || 0;
        item.costA += Number(tx.totalCost) || 0;
        item.profitA += Number(tx.grossProfit) || 0;
        item.countA += 1;
      }
    });

    txsB.forEach((tx) => {
      const date = new Date(tx.createdAt);
      const dayNum = date.getDate();
      if (dayNum >= 1 && dayNum <= 31) {
        const item = days[dayNum - 1];
        item.revenueB += Number(tx.grandTotal) || 0;
        item.costB += Number(tx.totalCost) || 0;
        item.profitB += Number(tx.grossProfit) || 0;
        item.countB += 1;
      }
    });

    let maxRev = 0;
    days.forEach((d) => {
      if (d.revenueA > maxRev) maxRev = d.revenueA;
      if (d.revenueB > maxRev) maxRev = d.revenueB;
    });
    if (maxRev === 0) maxRev = 100000;

    return { days, maxRev };
  }, [txsA, txsB]);

  const activeItem = hoveredDay
    ? chartData.days.find((d) => d.day === hoveredDay)
    : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs mb-8">
      {/* Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <ChartBar size={20} className="text-teal-700 font-bold" weight="bold" />
            <h4 className="text-base font-bold text-slate-800">
              ຍອດຂາຍລາຍວັນ (Daily Sales Trend)
            </h4>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            ປຽບທຽບຍອດຂາຍແຕ່ລະວັນລະຫວ່າງ 2 ເດືອນ (ກົດ ຫຼື ຊີ້ໃສ່ແທ່ງກຣາຟເພື່ອເບິ່ງລາຍລະອຽດຍອດຂາຍ)
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-sm bg-slate-400"></span>
            <span className="text-slate-600">{monthALabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-sm bg-teal-600"></span>
            <span className="text-teal-800 font-bold">{monthBLabel}</span>
          </div>
        </div>
      </div>

      {/* Interactive Tooltip Card Header (When Hovered) */}
      <div className="min-h-[56px] mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between flex-wrap gap-3">
        {activeItem ? (
          <>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-teal-600 text-white font-bold text-xs shadow-xs">
                ວັນທີ {activeItem.day}
              </span>
              <div className="text-xs text-slate-600">
                <span className="font-medium text-slate-500">{monthALabel}: </span>
                <span className="font-bold text-slate-700">{formatKip(activeItem.revenueA)}</span>
                <span className="mx-2 text-slate-300">|</span>
                <span className="font-medium text-teal-700">{monthBLabel}: </span>
                <span className="font-bold text-teal-800">{formatKip(activeItem.revenueB)}</span>
              </div>
            </div>

            {/* Delta calculation */}
            {(() => {
              const diff = activeItem.revenueB - activeItem.revenueA;
              const isUp = diff >= 0;
              const pct =
                activeItem.revenueA > 0
                  ? Math.abs((diff / activeItem.revenueA) * 100).toFixed(1)
                  : activeItem.revenueB > 0
                  ? '100'
                  : '0';

              return (
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="text-slate-500">ສ່ວນຕ່າງ (Difference):</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${
                      isUp
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {isUp ? <TrendUp size={14} weight="bold" /> : <TrendDown size={14} weight="bold" />}
                    <span>
                      {isUp ? '+' : '-'}
                      {formatKip(Math.abs(diff))} ({isUp ? '+' : '-'}{pct}%)
                    </span>
                  </span>
                </div>
              );
            })()}
          </>
        ) : (
          <div className="text-xs text-slate-400 italic flex items-center gap-1.5">
            <Lightbulb size={15} weight="duotone" className="text-amber-500 shrink-0" />
            <span>ກົດ ຫຼື ຊີ້ໃສ່ແທ່ງກຣາຟເພື່ອເບິ່ງລາຍລະອຽດຍອດຂາຍ</span>
          </div>
        )}
      </div>

      {/* SVG Dual-Bar Chart Canvas */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="min-w-[800px] h-64 relative flex items-end pt-6 pb-6 px-2">
          {/* Grid lines */}
          <div className="absolute inset-x-0 top-6 bottom-6 flex flex-col justify-between pointer-events-none opacity-20">
            <div className="border-b border-slate-400 w-full"></div>
            <div className="border-b border-slate-400 w-full"></div>
            <div className="border-b border-slate-400 w-full"></div>
            <div className="border-b border-slate-400 w-full"></div>
          </div>

          {/* Bar Groups: 31 Days */}
          <div className="w-full h-full flex items-end justify-between gap-1 z-10">
            {chartData.days.map((item) => {
              const heightPctA = Math.max((item.revenueA / chartData.maxRev) * 100, item.revenueA > 0 ? 3 : 0);
              const heightPctB = Math.max((item.revenueB / chartData.maxRev) * 100, item.revenueB > 0 ? 3 : 0);
              const isHovered = hoveredDay === item.day;

              return (
                <div
                  key={item.day}
                  onMouseEnter={() => setHoveredDay(item.day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  className={`flex-1 h-full flex flex-col items-center justify-end cursor-pointer group transition-all duration-150 rounded-lg p-0.5 ${
                    isHovered ? 'bg-slate-100 ring-2 ring-teal-500/30' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* The Two Adjacent Bars */}
                  <div className="w-full h-full flex items-end justify-center gap-0.5">
                    {/* Bar A: Month A */}
                    <div
                      style={{ height: `${heightPctA}%` }}
                      className={`w-1/2 max-w-[10px] rounded-t-sm transition-all duration-300 ${
                        isHovered ? 'bg-slate-500 shadow-sm' : 'bg-slate-400/80 hover:bg-slate-500'
                      }`}
                      title={`${monthALabel}: ${formatKip(item.revenueA)}`}
                    ></div>

                    {/* Bar B: Month B */}
                    <div
                      style={{ height: `${heightPctB}%` }}
                      className={`w-1/2 max-w-[10px] rounded-t-sm transition-all duration-300 ${
                        isHovered ? 'bg-teal-700 shadow-md ring-1 ring-teal-400' : 'bg-teal-600 hover:bg-teal-700'
                      }`}
                      title={`${monthBLabel}: ${formatKip(item.revenueB)}`}
                    ></div>
                  </div>

                  {/* Day Label on X-Axis */}
                  <span
                    className={`text-[10px] font-semibold mt-2 transition ${
                      isHovered
                        ? 'text-teal-700 font-extrabold scale-110'
                        : item.day % 5 === 0 || item.day === 1 || item.day === 31
                        ? 'text-slate-600 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {item.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
