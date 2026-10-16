import React, { useState, useMemo } from 'react';
import { formatKip } from '../../utils/formatters';
import { ChartLineUp, CalendarBlank } from '@phosphor-icons/react';

/**
 * DynamicDailyRevenueChart Component:
 * Auto-scaling daily revenue bar chart for custom date ranges.
 * Automatically aggregates transactions by date and scales X-axis according to the chosen range.
 */
export default function DynamicDailyRevenueChart({ transactions = [], startDate, endDate }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const chartData = useMemo(() => {
    if (!startDate || !endDate) {
      // Fallback: group by date from existing transactions
      const map = {};
      transactions.forEach((tx) => {
        const dStr = new Date(tx.createdAt).toISOString().split('T')[0];
        if (!map[dStr]) map[dStr] = { dateStr: dStr, revenue: 0, count: 0, profit: 0 };
        map[dStr].revenue += Number(tx.grandTotal) || 0;
        map[dStr].profit += Number(tx.grossProfit) || 0;
        map[dStr].count += 1;
      });
      const items = Object.values(map).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
      const maxRev = Math.max(...items.map((i) => i.revenue), 100000);
      return { items, maxRev };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const items = [];

    // Generate every day in range
    const cur = new Date(start);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dStr = `${y}-${m}-${d}`;

      items.push({
        dateStr: dStr,
        label: `${d}/${m}`,
        revenue: 0,
        profit: 0,
        count: 0,
      });

      cur.setDate(cur.getDate() + 1);
    }

    // Populate with transactions
    transactions.forEach((tx) => {
      const txDStr = new Date(tx.createdAt).toISOString().split('T')[0];
      const match = items.find((i) => i.dateStr === txDStr);
      if (match) {
        match.revenue += Number(tx.grandTotal) || 0;
        match.profit += Number(tx.grossProfit) || 0;
        match.count += 1;
      }
    });

    const maxRev = Math.max(...items.map((i) => i.revenue), 100000);
    return { items, maxRev };
  }, [transactions, startDate, endDate]);

  const activeItem = hoveredIdx !== null ? chartData.items[hoveredIdx] : null;

  if (chartData.items.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ChartLineUp size={20} className="text-teal-700 font-bold" weight="bold" />
          <h4 className="text-base font-bold text-slate-800">
            ຍອດຂາຍລາຍວັນ (Daily Sales Trend)
          </h4>
        </div>
        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
          <CalendarBlank size={14} className="text-teal-600" />
          <span>ຈຳນວນມື້ທັງໝົດ: <strong className="text-slate-800">{chartData.items.length}</strong> ມື້</span>
        </div>
      </div>

      {/* Hover info banner */}
      <div className="min-h-[44px] mb-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
        {activeItem ? (
          <>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">ວັນທີ {activeItem.dateStr}:</span>
              <span className="font-bold text-teal-800">{formatKip(activeItem.revenue)}</span>
              <span className="text-slate-400">|</span>
              <span className="text-emerald-700 font-medium">ກຳໄລຕົວຈິງ: {formatKip(activeItem.profit)}</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 font-bold font-mono">
              {activeItem.count} ບິນ
            </span>
          </>
        ) : (
          <span className="text-slate-400 italic">
            💡 ກົດ ຫຼື ຊີ້ໃສ່ແທ່ງກຣາຟເພື່ອເບິ່ງລາຍລະອຽດຍອດຂາຍ & ກຳໄລຂອງມື້ນັ້ນ
          </span>
        )}
      </div>

      {/* SVG Daily Chart */}
      <div className="w-full overflow-x-auto pb-1">
        <div
          style={{ minWidth: `${Math.max(chartData.items.length * 28, 600)}px` }}
          className="h-56 relative flex items-end pt-4 pb-6 px-2"
        >
          {/* Background grid */}
          <div className="absolute inset-x-0 top-4 bottom-6 flex flex-col justify-between pointer-events-none opacity-20">
            <div className="border-b border-slate-400 w-full"></div>
            <div className="border-b border-slate-400 w-full"></div>
            <div className="border-b border-slate-400 w-full"></div>
          </div>

          {/* Bars */}
          <div className="w-full h-full flex items-end justify-between gap-1 z-10">
            {chartData.items.map((item, idx) => {
              const heightPct = Math.max((item.revenue / chartData.maxRev) * 100, item.revenue > 0 ? 4 : 0);
              const isHovered = hoveredIdx === idx;

              return (
                <div
                  key={item.dateStr}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`flex-1 h-full flex flex-col items-center justify-end cursor-pointer group transition p-0.5 rounded-lg ${
                    isHovered ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full max-w-[16px] rounded-t-sm transition-all duration-200 ${
                      isHovered
                        ? 'bg-teal-600 shadow-md ring-2 ring-teal-400'
                        : 'bg-teal-700/80 hover:bg-teal-700'
                    }`}
                  ></div>
                  <span
                    className={`text-[9px] font-mono mt-1.5 transition ${
                      isHovered ? 'text-teal-700 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {item.label}
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
