import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { fetchAnnual12MonthSales } from '../../services/supabase';
import { formatKip } from '../../utils/formatters';
import { ChartLineUp, CalendarBlank } from '@phosphor-icons/react';

const LAO_MONTHS = [
  'ມັງກອນ (1)',
  'ກຸມພາ (2)',
  'ມີນາ (3)',
  'ເມສາ (4)',
  'ພຶດສະພາ (5)',
  'ມິຖຸນາ (6)',
  'ກໍລະກົດ (7)',
  'ສິງຫາ (8)',
  'ກັນຍາ (9)',
  'ຕຸລາ (10)',
  'ພະຈິກ (11)',
  'ທັນວາ (12)',
];

/**
 * Annual12MonthSalesChart Component:
 * Smooth Area Line Chart displaying 12-month sales trend for the year (Jan - Dec)
 * with interactive tooltip showing revenue, cost, gross profit, and orders.
 */
export default function Annual12MonthSalesChart({
  initialYear = new Date().getFullYear(),
  fallbackTransactions = [],
}) {
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fallback calculation helper if remote fetch fails or is empty
  const computeLocalMonths = (year) => {
    const months = LAO_MONTHS.map((name, idx) => ({
      monthIndex: idx + 1,
      month: `${String(idx + 1).padStart(2, '0')}/${year}`,
      monthName: name,
      label: name,
      shortLabel: name,
      simpleMonth: String(idx + 1).padStart(2, '0'),
      revenue: 0,
      total_sales: 0,
      cost: 0,
      total_cost: 0,
      profit: 0,
      gross_profit: 0,
      count: 0,
    }));

    (fallbackTransactions || []).forEach((t) => {
      if (t.status === 'cancelled' || t.isCancelled) return;
      const d = new Date(t.createdAt);
      if (d.getFullYear() === year) {
        const mIdx = d.getMonth();
        if (mIdx >= 0 && mIdx < 12) {
          const rev = Number(t.grandTotal) || 0;
          const c = Number(t.totalCost) || 0;
          const p = Number(t.grossProfit) || 0;
          months[mIdx].revenue += rev;
          months[mIdx].total_sales += rev;
          months[mIdx].cost += c;
          months[mIdx].total_cost += c;
          months[mIdx].profit += p;
          months[mIdx].gross_profit += p;
          months[mIdx].count += 1;
        }
      }
    });

    return months;
  };

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await fetchAnnual12MonthSales(selectedYear);
        if (isMounted) {
          if (res && res.length > 0 && res.some((m) => m.revenue > 0)) {
            setData(res);
          } else {
            setData(computeLocalMonths(selectedYear));
          }
        }
      } catch (e) {
        console.warn('Annual12MonthSalesChart error:', e);
        if (isMounted) {
          setData(computeLocalMonths(selectedYear));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedYear, fallbackTransactions]);

  // Always ensure chartData has 12 items even if data is initially empty
  const chartData = useMemo(() => {
    if (data && data.length === 12) return data;
    return computeLocalMonths(selectedYear);
  }, [data, selectedYear]);

  // Calculate annual totals
  const annualTotals = useMemo(() => {
    return chartData.reduce(
      (acc, m) => {
        acc.revenue += m.revenue || 0;
        acc.cost += m.cost || 0;
        acc.profit += m.profit || 0;
        acc.count += m.count || 0;
        return acc;
      },
      { revenue: 0, cost: 0, profit: 0, count: 0 }
    );
  }, [chartData]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-sm text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 text-xs font-mono min-w-[220px]">
          <div className="font-sans font-bold text-teal-300 pb-1.5 mb-2 border-b border-slate-700/80 text-xs flex items-center justify-between">
            <span>{item.label}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-900/80 text-teal-200 border border-teal-700/60 font-sans">
              {item.count} ບິນ
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-sans">ຍອດຂາຍ:</span>
              <span className="font-black text-teal-300">{formatKip(item.revenue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-sans">ຕົ້ນທຶນ:</span>
              <span className="font-bold text-amber-300">{formatKip(item.cost)}</span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-slate-800">
              <span className="text-slate-400 font-sans">ກຳໄລຕົວຈິງ:</span>
              <span className="font-black text-emerald-400">{formatKip(item.profit)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs mb-6">
      {/* Header with Year Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <ChartLineUp size={20} weight="bold" />
            </div>
            <h4 className="text-base font-bold text-slate-800">
              ຍອດຂາຍລາຍເດືອນ 12 ເດືອນ (Annual 12-Month Sales Trend)
            </h4>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            ເສັ້ນກຣາຟໂຄ້ງ Smooth Area ສະແດງທ່າອ່ຽງລາຍຮັບຕະຫຼອດ 12 ເດືອນຂອງປີ {selectedYear}
          </p>
        </div>

        {/* Year Dropdown & Annual Summary Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <CalendarBlank size={14} className="text-slate-500" />
            <span className="text-slate-500 font-medium">ປີ:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
            </select>
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200/80 text-xs">
            <span className="text-teal-700 font-medium">ລວມປີ {selectedYear}:</span>
            <span className="font-bold text-teal-900 font-mono">
              {formatKip(annualTotals.revenue)}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Canvas with Guaranteed Explicit Height */}
      <div className="w-full min-h-[300px] h-[300px] pt-2" style={{ minHeight: '300px', width: '100%' }}>
        {isLoading && (!chartData || chartData.length === 0) ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
            ກຳລັງໂຫຼດຂໍ້ມູນ 12 ເດືອນ...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={290} minHeight={290} debounce={50}>
            <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D9488" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#14B8A6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis
                dataKey="monthIndex"
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
                tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                interval={0}
                tickFormatter={(mIdx) => {
                  if (isMobile) {
                    return `ດ${mIdx}`;
                  }
                  return LAO_MONTHS[mIdx - 1] || `ດ${mIdx}`;
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: '#94A3B8', fontFamily: 'monospace' }}
                tickFormatter={(val) => {
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                  if (val >= 1000) return `${Math.round(val / 1000)}k`;
                  return val;
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                height={28}
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingBottom: '4px' }}
                formatter={(value) => (value === 'revenue' ? 'ຍອດຂາຍ (Revenue)' : 'ກຳໄລຕົວຈິງ (Profit)')}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="revenue"
                stroke="#0F766E"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                dot={{ r: 3.5, fill: '#0F766E', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                activeDot={{ r: 6, fill: '#0F766E', strokeWidth: 2, stroke: '#FFFFFF' }}
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="profit"
                stroke="#10B981"
                strokeWidth={2}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill="url(#colorProfit)"
                dot={{ r: 3, fill: '#10B981', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                activeDot={{ r: 5, fill: '#10B981', strokeWidth: 2, stroke: '#FFFFFF' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
