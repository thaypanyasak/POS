import React, { useState, useEffect, useMemo } from 'react';
import MonthPickerGroup from './MonthPickerGroup';
import DualBarComparisonChart from './DualBarComparisonChart';
import { fetchDualMonthTransactions } from '../../services/supabase';
import { formatKip, formatCompoundStock } from '../../utils/formatters';
import {
  TrendUp,
  TrendDown,
  Receipt,
  CurrencyCircleDollar,
  ChartPie,
  ClockAfternoon,
  Fire,
  CalendarBlank,
  CreditCard,
  CurrencyDollar,
  QrCode,
  ClockCountdown,
  Tag,
  ArrowsClockwise,
  Package,
} from '@phosphor-icons/react';

const CATEGORY_COLORS = [
  '#0F766E', // Teal
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#64748B', // Slate
];

/**
 * Reusable Dashboard Column for Month A and Month B:
 * 100% Identical UI architecture to standard Dashboard:
 * 1. 4 KPI Cards (ຍອດຂາຍລວມ, ຕົ້ນທຶນສິນຄ້າລວມ, ກຳໄລຕົວຈິງ, ຈຳນວນບິນທັງໝົດ)
 * 2. ຊ່ອງທາງການຊຳລະເງິນ (Payment Breakdown: Cash, Transfer, Credit)
 * 3. Hourly Sales Trend (07:00 - 22:00)
 * 4. ໂຄງສ້າງຍອດຂາຍຕາມໝວດໝູ່ (Sales by Category)
 * 5. 5 ສິນຄ້າຂາຍດີທີ່ສຸດ (Top 5 Best Sellers)
 */
function MonthDashboardColumn({
  title,
  monthLabel,
  rawMonthStr,
  setMonthStr,
  isMonthA,
  summary,
  hourlyData,
  categoryData,
  topSellers,
  comparisonSummary = null,
}) {
  const calcGrowth = (valA, valB) => {
    if (valA === 0) return valB > 0 ? 100 : 0;
    return ((valB - valA) / Math.abs(valA)) * 100;
  };

  const renderGrowthBadge = (valA, valB, isMargin = false) => {
    if (isMonthA || !comparisonSummary) return null;
    if (isMargin) {
      const diff = valB - valA;
      const isUp = diff >= 0;
      return (
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-0.5 ${
            isUp
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {isUp ? '+' : ''}{diff.toFixed(1)}% pts
        </span>
      );
    }

    const growth = calcGrowth(valA, valB);
    const isUp = growth >= 0;
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-0.5 ${
          isUp
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}
      >
        {isUp ? <TrendUp size={11} weight="bold" /> : <TrendDown size={11} weight="bold" />}
        <span>{isUp ? '+' : ''}{growth.toFixed(1)}%</span>
      </span>
    );
  };

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl p-4 sm:p-5 border transition-all ${
        isMonthA
          ? 'bg-slate-50/70 border-slate-200/90'
          : 'bg-teal-50/20 border-teal-200/90 shadow-xs'
      }`}
    >
      {/* COLUMN HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
              isMonthA
                ? 'bg-slate-200 text-slate-700'
                : 'bg-teal-600 text-white shadow-xs'
            }`}
          >
            {isMonthA ? 'A' : 'B'}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900">
                {title}: <span className={isMonthA ? 'text-slate-700' : 'text-teal-800'}>{monthLabel}</span>
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isMonthA
                    ? 'bg-slate-200/80 text-slate-700'
                    : 'bg-teal-100 text-teal-800 border border-teal-200'
                }`}
              >
                {isMonthA ? 'ເດືອນຖານ (Baseline)' : 'ເດືອນເປົ້າໝາຍ (Target)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              ລວມ {summary.txCount} ບິນຂາຍ • ຍອດຂາຍ {formatKip(summary.revenue)}
            </p>
          </div>
        </div>

        {/* Month Selector Mini Picker */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <input
            type="month"
            value={rawMonthStr}
            onChange={(e) => setMonthStr && setMonthStr(e.target.value)}
            className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border bg-white focus:outline-none focus:ring-2 cursor-pointer shadow-2xs ${
              isMonthA
                ? 'border-slate-300 text-slate-800 focus:ring-slate-300'
                : 'border-teal-300 text-teal-900 focus:ring-teal-400'
            }`}
          />
        </div>
      </div>

      {/* 1. TOP 4 MAIN KPI CARDS (2x2 Grid) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* KPI 1: Revenue */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">ຍອດຂາຍລວມ</span>
            <span className="w-6 h-6 bg-teal-50 text-teal-700 rounded-lg flex items-center justify-center border border-teal-100">
              <CurrencyCircleDollar size={15} weight="bold" />
            </span>
          </div>
          <div>
            <span className="text-lg sm:text-xl font-black text-teal-700 font-mono tracking-tight block">
              {formatKip(summary.revenue)}
            </span>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100 text-[10px]">
              <span className="text-slate-500 font-medium">{summary.txCount} ບິນ</span>
              {!isMonthA && renderGrowthBadge(comparisonSummary?.revenueA || 0, summary.revenue)}
            </div>
          </div>
        </div>

        {/* KPI 2: Total Cost */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">ຕົ້ນທຶນສິນຄ້າລວມ</span>
            <span className="w-6 h-6 bg-amber-50 text-amber-700 rounded-lg flex items-center justify-center border border-amber-100">
              <CalendarBlank size={15} weight="bold" />
            </span>
          </div>
          <div>
            <span className="text-lg sm:text-xl font-black text-slate-800 font-mono tracking-tight block">
              {formatKip(summary.cost)}
            </span>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100 text-[10px]">
              <span className="text-amber-700 font-medium">ຕົ້ນທຶນຈິງ</span>
              {!isMonthA && renderGrowthBadge(comparisonSummary?.costA || 0, summary.cost)}
            </div>
          </div>
        </div>

        {/* KPI 3: Gross Profit */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">ກຳໄລຕົວຈິງ</span>
            <span className="w-6 h-6 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center border border-emerald-100">
              <CreditCard size={15} weight="bold" />
            </span>
          </div>
          <div>
            <span className="text-lg sm:text-xl font-black text-emerald-700 font-mono tracking-tight block">
              {formatKip(summary.profit)}
            </span>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100 text-[10px]">
              <span className="text-emerald-700 font-extrabold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                {summary.margin.toFixed(1)}%
              </span>
              {!isMonthA && renderGrowthBadge(comparisonSummary?.profitA || 0, summary.profit)}
            </div>
          </div>
        </div>

        {/* KPI 4: Tickets */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">ຈຳນວນບິນທັງໝົດ</span>
            <span className="w-6 h-6 bg-purple-50 text-purple-700 rounded-lg flex items-center justify-center border border-purple-100">
              <Receipt size={15} weight="bold" />
            </span>
          </div>
          <div>
            <span className="text-lg sm:text-xl font-black text-slate-900 font-mono tracking-tight block">
              {summary.txCount} ບິນ
            </span>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100 text-[10px]">
              <span className="text-slate-500 font-medium">
                ສະເລ່ຍ: {summary.txCount > 0 ? formatKip(Math.round(summary.revenue / summary.txCount)) : '0 ₭'}
              </span>
              {!isMonthA && renderGrowthBadge(comparisonSummary?.countA || 0, summary.txCount)}
            </div>
          </div>
        </div>
      </div>

      {/* 2. PAYMENT BREAKDOWN (Cash, Transfer, Credit) */}
      <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Receipt size={14} className="text-teal-600" />
            <span>ຊ່ອງທາງການຊຳລະເງິນ</span>
          </span>
          <span className="text-[10.5px] font-mono font-bold text-slate-500">
            {formatKip(summary.revenue)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Cash */}
          <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200/80">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
              <span className="flex items-center gap-1 text-emerald-800">
                <CurrencyDollar size={14} weight="bold" className="text-emerald-600" />
                <span>1. ເງິນສົດ (Cash)</span>
              </span>
              {!isMonthA && renderGrowthBadge(comparisonSummary?.cashA || 0, summary.cash)}
            </div>
            <span className="text-xs sm:text-sm font-black text-emerald-800 font-mono block">
              {formatKip(summary.cash)}
            </span>
          </div>

          {/* Transfer */}
          <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-200/80">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
              <span className="flex items-center gap-1 text-blue-800">
                <QrCode size={14} weight="bold" className="text-blue-600" />
                <span>2. ໂອນເງິນ</span>
              </span>
              {!isMonthA && renderGrowthBadge(comparisonSummary?.transferA || 0, summary.transfer)}
            </div>
            <span className="text-xs sm:text-sm font-black text-blue-900 font-mono block">
              {formatKip(summary.transfer)}
            </span>
          </div>

          {/* Credit */}
          <div className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-200/80">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
              <span className="flex items-center gap-1 text-amber-800">
                <ClockCountdown size={14} weight="bold" className="text-amber-600" />
                <span>3. ຕິດໜີ້ (Credit)</span>
              </span>
              {!isMonthA && renderGrowthBadge(comparisonSummary?.debtA || 0, summary.debt)}
            </div>
            <span className="text-xs sm:text-sm font-black text-amber-900 font-mono block">
              {formatKip(summary.debt)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. HOURLY SALES TREND (07:00 - 22:00) */}
      <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <ClockAfternoon size={16} className="text-teal-600" weight="bold" />
            <h4 className="text-xs font-black text-slate-900">
              ຍອດຂາຍຕາມຊ່ວງເວລາ (07:00 - 22:00)
            </h4>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            ສູງສຸດ: {formatKip(hourlyData.maxRev)}
          </span>
        </div>

        {/* Bar Chart Container */}
        <div className="pt-2 pb-1">
          <div className="h-28 flex items-end gap-1 justify-between border-b border-slate-200 pb-1 px-1">
            {hourlyData.hours.map((item) => {
              const heightPercent =
                item.revenue > 0
                  ? Math.max(10, Math.round((item.revenue / hourlyData.maxRev) * 100))
                  : 4;
              const isTopPeak = item.revenue > 0 && item.revenue === hourlyData.maxRev;

              return (
                <div
                  key={item.hour}
                  className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1.5 hidden group-hover:flex flex-col items-center z-30 pointer-events-none animate-in fade-in zoom-in-95">
                    <div className="bg-slate-900 text-white text-[10px] rounded-lg px-2 py-1 shadow-xl whitespace-nowrap text-center">
                      <p className="font-black text-teal-300">{item.label}</p>
                      <p className="font-extrabold font-mono">{formatKip(item.revenue)}</p>
                      <p className="text-slate-300 text-[9px]">{item.txCount} ບິນ</p>
                    </div>
                    <div className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-0.5"></div>
                  </div>

                  {/* Bar Fill */}
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      isTopPeak
                        ? isMonthA
                          ? 'bg-slate-600 shadow-xs'
                          : 'bg-gradient-to-t from-teal-600 to-emerald-400 shadow-xs'
                        : item.revenue > 0
                        ? isMonthA
                          ? 'bg-slate-400/80 group-hover:bg-slate-500'
                          : 'bg-teal-500/80 group-hover:bg-teal-600'
                        : 'bg-slate-100'
                    }`}
                  ></div>
                </div>
              );
            })}
          </div>

          {/* X-Axis Labels */}
          <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mt-1 px-1">
            <span>07:00</span>
            <span>10:00</span>
            <span>13:00</span>
            <span>16:00</span>
            <span>19:00</span>
            <span>22:00</span>
          </div>
        </div>
      </div>

      {/* 4. SALES BY CATEGORY */}
      <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <ChartPie size={16} className="text-teal-600" weight="bold" />
            <h4 className="text-xs font-black text-slate-900">
              ໂຄງສ້າງຍອດຂາຍຕາມໝວດໝູ່ (Sales by Category)
            </h4>
          </div>
          <span className="text-[10.5px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
            {categoryData.list.length} ໝວດໝູ່
          </span>
        </div>

        {categoryData.list.length === 0 ? (
          <div className="py-4 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <Tag size={20} className="mx-auto text-slate-300 mb-1" />
            <p className="text-[11px] font-bold">ບໍ່ມີຂໍ້ມູນຍອດຂາຍໃນເດືອນນີ້</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Proportion Bar */}
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              {categoryData.list.map((cat, idx) => (
                <div
                  key={idx}
                  style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                  className="transition-all duration-300 hover:opacity-90"
                  title={`${cat.name}: ${cat.percentage}% (${formatKip(cat.revenue)})`}
                />
              ))}
            </div>

            {/* Category Mini Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
              {categoryData.list.slice(0, 6).map((cat, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-slate-50/80 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      style={{ backgroundColor: cat.color }}
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                    ></span>
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-slate-800 truncate block">
                        {cat.name}
                      </span>
                      <span className="text-[9.5px] text-slate-400 block">
                        ຂາຍໄດ້ {cat.quantity} ລາຍການ
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-mono font-black text-slate-900 block">
                      {formatKip(cat.revenue)}
                    </span>
                    <span className="text-[9px] font-bold text-teal-700 bg-teal-50 px-1 py-0.2 rounded border border-teal-100">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. TOP 5 BEST SELLERS */}
      <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Fire size={16} className="text-amber-500" weight="fill" />
            <h4 className="text-xs font-black text-slate-900">
              5 ສິນຄ້າຂາຍດີທີ່ສຸດ (Top 5 Sellers)
            </h4>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">ລຽງຕາມຍອດຂາຍ</span>
        </div>

        {topSellers.length === 0 ? (
          <div className="py-4 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <Package size={20} className="mx-auto text-slate-300 mb-1" />
            <p className="text-[11px] font-bold">ບໍ່ມີລາຍການຂາຍໃນເດືອນນີ້</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {topSellers.map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-2 rounded-xl border border-slate-200/90 hover:border-teal-300 bg-slate-50/60 hover:bg-white flex items-center justify-between gap-2 transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-8 h-8 rounded-lg object-cover border border-slate-200 bg-white"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&q=80';
                      }}
                    />
                    <span
                      className={`absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full text-[8.5px] font-black flex items-center justify-center text-white ${
                        idx === 0
                          ? 'bg-amber-500 ring-1 ring-amber-200'
                          : idx === 1
                          ? 'bg-slate-400'
                          : idx === 2
                          ? 'bg-amber-700'
                          : 'bg-slate-300 text-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-[11.5px] font-black text-slate-800 truncate" title={item.name}>
                      {item.name}
                    </h5>
                    <span className="text-[10px] text-teal-700 font-bold block">
                      ຂາຍແລ້ວ: {item.formattedSold || `${item.qty} ${item.unit}`}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-black text-slate-900 block">
                    {formatKip(item.revenue)}
                  </span>
                  {item.profit > 0 && (
                    <span className="text-[9.5px] text-emerald-700 font-bold block">
                      +{formatKip(item.profit)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MonthComparisonView({
  fallbackTransactions = [],
  products = [],
}) {
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // Month A: Baseline (e.g. 2025-04 or previous month)
  // Month B: Target (e.g. 2026-04 or current month)
  const [monthA, setMonthA] = useState(prevMonthStr);
  const [monthB, setMonthB] = useState(currentMonthStr);

  const [txsA, setTxsA] = useState([]);
  const [txsB, setTxsB] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load transactions strictly for Month A and Month B from Supabase
  const loadComparisonData = async () => {
    setIsLoading(true);
    try {
      const filterLocal = (ymStr) => {
        const parts = (ymStr || '').split('-');
        if (parts.length < 2) return [];
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        return fallbackTransactions.filter((t) => {
          if (t.status === 'cancelled' || t.isCancelled) return false;
          const d = new Date(t.createdAt);
          return d.getFullYear() === y && d.getMonth() + 1 === m;
        });
      };

      const enrichWithFallbackItems = (list, localList) => {
        return (list || []).map((tx) => {
          if (tx.items && tx.items.length > 0) return tx;
          const match = localList.find((ft) => ft.id === tx.id || ft.receiptNumber === tx.receiptNumber);
          if (match && (match.items?.length > 0 || match.sale_transaction_items?.length > 0)) {
            return {
              ...tx,
              items: match.items || match.sale_transaction_items || [],
              sale_transaction_items: match.sale_transaction_items || match.items || [],
            };
          }
          return tx;
        });
      };

      const localA = filterLocal(monthA);
      const localB = filterLocal(monthB);

      const res = await fetchDualMonthTransactions(monthA, monthB);
      if (res) {
        const listA = res.txsA && res.txsA.length > 0 ? res.txsA : localA;
        const listB = res.txsB && res.txsB.length > 0 ? res.txsB : localB;
        setTxsA(enrichWithFallbackItems(listA, localA));
        setTxsB(enrichWithFallbackItems(listB, localB));
      } else {
        setTxsA(localA);
        setTxsB(localB);
      }
    } catch (err) {
      console.warn('loadComparisonData error:', err);
      const filterLocal = (ymStr) => {
        const parts = (ymStr || '').split('-');
        if (parts.length < 2) return [];
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        return fallbackTransactions.filter((t) => {
          if (t.status === 'cancelled' || t.isCancelled) return false;
          const d = new Date(t.createdAt);
          return d.getFullYear() === y && d.getMonth() + 1 === m;
        });
      };
      setTxsA(filterLocal(monthA));
      setTxsB(filterLocal(monthB));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComparisonData();
  }, [monthA, monthB, fallbackTransactions.length]);

  // Helper to compute deep-dive analytics for any single month
  const computeMonthAnalytics = (txList) => {
    let revenue = 0;
    let cost = 0;
    let profit = 0;
    let cash = 0;
    let transfer = 0;
    let debt = 0;

    txList.forEach((t) => {
      const rev = Number(t.grandTotal) || 0;
      const c = Number(t.totalCost) || 0;
      const p = Number(t.grossProfit) || 0;
      revenue += rev;
      cost += c;
      profit += p;

      const m = (t.paymentMethod || '').toLowerCase();
      if (t.isDebt || m === 'debt') {
        debt += rev;
      } else if (m === 'cash' || m === 'ເງິນສົດ') {
        cash += rev;
      } else {
        transfer += rev;
      }
    });

    const summary = {
      revenue,
      cost,
      profit,
      cash,
      transfer,
      debt,
      txCount: txList.length,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    };

    // Hourly Breakdown (07:00 - 22:00)
    const hours = [];
    for (let h = 7; h <= 22; h++) {
      hours.push({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        revenue: 0,
        txCount: 0,
      });
    }

    txList.forEach((t) => {
      const h = new Date(t.createdAt).getHours();
      const match = hours.find((item) => item.hour === h);
      if (match) {
        match.revenue += Number(t.grandTotal) || 0;
        match.txCount += 1;
      }
    });

    let maxRev = 0;
    hours.forEach((h) => {
      if (h.revenue > maxRev) maxRev = h.revenue;
    });
    if (maxRev === 0) maxRev = 10000;
    const hourlyData = { hours, maxRev };

    // 4. Category Breakdown
    const catMap = {};
    let totalCatRev = 0;

    txList.forEach((tx) => {
      const items = tx.items || tx.sale_transaction_items || [];
      items.forEach((it) => {
        const prodId = it.product?.id || it.productId || it.product_id;
        const prodName = it.productName || it.product?.name || '';
        const prod = products.find(
          (p) =>
            (prodId && p.id === prodId) ||
            (prodName && p.name && p.name.trim().toLowerCase() === prodName.trim().toLowerCase())
        );
        const cat =
          prod?.category ||
          it.product?.category ||
          (prodName.includes('ເບຍ') ? 'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ' : 'ທົ່ວໄປ');

        const lineTot =
          Number(it.lineTotal ?? it.line_total) ||
          ((Number(it.unitPrice ?? it.unit_price ?? it.unit?.retailPrice ?? 0)) * (Number(it.quantity) || 1));
        const qty = Number(it.quantity) || 1;

        if (!catMap[cat]) catMap[cat] = { name: cat, revenue: 0, quantity: 0 };
        catMap[cat].revenue += lineTot;
        catMap[cat].quantity += qty;
        totalCatRev += lineTot;
      });
    });

    const categoryList = Object.values(catMap)
      .map((cat, idx) => ({
        ...cat,
        percentage: totalCatRev > 0 ? Number(((cat.revenue / totalCatRev) * 100).toFixed(1)) : 0,
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const categoryData = { list: categoryList, totalRev: totalCatRev };

    // 5. Top 5 Best Sellers
    const itemsMap = {};
    txList.forEach((tx) => {
      const items = tx.items || tx.sale_transaction_items || [];
      items.forEach((it) => {
        const prodId = it.product?.id || it.productId || it.product_id;
        const prodName = it.productName || it.product?.name || '';
        const prod = products.find(
          (p) =>
            (prodId && p.id === prodId) ||
            (prodName && p.name && p.name.trim().toLowerCase() === prodName.trim().toLowerCase())
        );
        const id = prod?.id || prodId || prodName || ('item_' + Math.random());
        const name = prodName || prod?.name || 'ສິນຄ້າ';
        const qty = Number(it.quantity) || 1;
        const mult = Number(it.unit?.multiplier || it.multiplier || prod?.units?.find(u => u.unitName === (it.unitName || it.unit_name))?.multiplier) || 1;
        const baseUnitsSold = qty * mult;
        const lineTot =
          Number(it.lineTotal ?? it.line_total) ||
          ((Number(it.unitPrice ?? it.unit_price ?? it.unit?.retailPrice ?? 0)) * qty);
        const lineCost = Number(it.lineCost ?? it.line_cost) || 0;
        const lineProfit = it.lineProfit !== undefined
          ? Number(it.lineProfit)
          : it.line_profit !== undefined
          ? Number(it.line_profit)
          : Math.max(0, lineTot - lineCost);
        const unit = it.unitName || it.unit?.unitName || it.unit_name || prod?.baseUnit || 'ອັນ';

        if (!itemsMap[id]) {
          itemsMap[id] = {
            id,
            name,
            imageUrl: prod?.imageUrl || prod?.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&q=80',
            productObj: prod,
            qty: 0,
            totalBaseUnits: 0,
            revenue: 0,
            profit: 0,
            unit,
          };
        }
        itemsMap[id].qty += qty;
        itemsMap[id].totalBaseUnits += baseUnitsSold;
        itemsMap[id].revenue += lineTot;
        itemsMap[id].profit += lineProfit;
      });
    });

    const topSellers = Object.values(itemsMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((item) => {
        let formattedSold = `${item.qty} ${item.unit}`;
        if (item.productObj) {
          try {
            const tempProd = {
              ...item.productObj,
              currentStockBaseUnits: item.totalBaseUnits,
              trackStock: true,
            };
            formattedSold = formatCompoundStock(tempProd).replace(/ \(ລວມທັງໝົດ:.*\)/, '');
          } catch (_) {}
        }
        return {
          ...item,
          formattedSold,
        };
      });

    return { summary, hourlyData, categoryData, topSellers };
  };

  const analyticsA = useMemo(() => computeMonthAnalytics(txsA), [txsA, products]);
  const analyticsB = useMemo(() => computeMonthAnalytics(txsB), [txsB, products]);

  const comparisonSummary = useMemo(() => {
    return {
      revenueA: analyticsA.summary.revenue,
      costA: analyticsA.summary.cost,
      profitA: analyticsA.summary.profit,
      countA: analyticsA.summary.txCount,
      cashA: analyticsA.summary.cash,
      transferA: analyticsA.summary.transfer,
      debtA: analyticsA.summary.debt,
      marginA: analyticsA.summary.margin,
    };
  }, [analyticsA]);

  const formatLaoMonth = (ymStr) => {
    if (!ymStr) return '-';
    const [y, m] = ymStr.split('-');
    return `${m}/${y}`;
  };

  const labelA = `ເດືອນ ${formatLaoMonth(monthA)}`;
  const labelB = `ເດືອນ ${formatLaoMonth(monthB)}`;

  const calcGrowth = (valA, valB) => {
    if (valA === 0) return valB > 0 ? 100 : 0;
    return ((valB - valA) / Math.abs(valA)) * 100;
  };

  const revGrowth = calcGrowth(analyticsA.summary.revenue, analyticsB.summary.revenue);
  const profitGrowth = calcGrowth(analyticsA.summary.profit, analyticsB.summary.profit);
  const ticketGrowth = calcGrowth(analyticsA.summary.txCount, analyticsB.summary.txCount);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Month Picker Group */}
      <MonthPickerGroup
        monthA={monthA}
        setMonthA={setMonthA}
        monthB={monthB}
        setMonthB={setMonthB}
        isLoading={isLoading}
        onRefresh={loadComparisonData}
      />

      {/* 2. Overall Summary Comparison Strip */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse"></span>
          <span className="text-xs font-bold text-slate-800">
            ສັງລວມການປຽບທຽບ: <span className="text-slate-500">{labelA}</span> ທຽບກັບ <span className="text-teal-800 font-extrabold">{labelB}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Revenue Growth */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium">ຍອດຂາຍ:</span>
            <span
              className={`font-mono font-black flex items-center gap-0.5 ${
                revGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {revGrowth >= 0 ? '▲ +' : '▼ '}{revGrowth.toFixed(1)}%
            </span>
          </div>

          {/* Profit Growth */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium">ກຳໄລຕົວຈິງ:</span>
            <span
              className={`font-mono font-black flex items-center gap-0.5 ${
                profitGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {profitGrowth >= 0 ? '▲ +' : '▼ '}{profitGrowth.toFixed(1)}%
            </span>
          </div>

          {/* Tickets Growth */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium">ຈຳນວນບິນ:</span>
            <span
              className={`font-mono font-black flex items-center gap-0.5 ${
                ticketGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {ticketGrowth >= 0 ? '▲ +' : '▼ '}{ticketGrowth.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* 3. CORE REQUIREMENT: SIDE-BY-SIDE 50/50 DUAL COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* COLUMN LEFT: MONTH A (50%) */}
        <MonthDashboardColumn
          title="ເດືອນ A"
          monthLabel={labelA}
          rawMonthStr={monthA}
          setMonthStr={setMonthA}
          isMonthA={true}
          summary={analyticsA.summary}
          hourlyData={analyticsA.hourlyData}
          categoryData={analyticsA.categoryData}
          topSellers={analyticsA.topSellers}
        />

        {/* COLUMN RIGHT: MONTH B (50%) */}
        <MonthDashboardColumn
          title="ເດືອນ B"
          monthLabel={labelB}
          rawMonthStr={monthB}
          setMonthStr={setMonthB}
          isMonthA={false}
          summary={analyticsB.summary}
          hourlyData={analyticsB.hourlyData}
          categoryData={analyticsB.categoryData}
          topSellers={analyticsB.topSellers}
          comparisonSummary={comparisonSummary}
        />
      </div>

      {/* 4. Full-width Daily Sales Trend (Days 1 to 31) */}
      <DualBarComparisonChart
        txsA={txsA}
        txsB={txsB}
        monthALabel={labelA}
        monthBLabel={labelB}
      />
    </div>
  );
}
