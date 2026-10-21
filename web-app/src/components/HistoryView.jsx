import React, { useState, useMemo, useRef } from 'react';
import {
  ClockCounterClockwise,
  Printer,
  Receipt,
  Trash,
  PencilSimple,
  MagnifyingGlass,
  ArrowClockwise,
  CheckCircle,
  Prohibit,
  X,
  CalendarBlank,
  HandCoins,
  ArrowsClockwise,
  Money,
  QrCode,
  Warning,
  XCircle,
  Check
} from '@phosphor-icons/react';
import { formatKip, normalizeLao } from '../utils/formatters';
import CustomerDebtPaymentModal from './inventory/CustomerDebtPaymentModal';
import { playUnitChangeBeep, playActionClickBeep, playErrorBeep } from '../utils/audioFeedback';
import { HistoryListSkeleton } from './common/SkeletonLoaders';

export default function HistoryView({
  transactions = [],
  onOpenReceipt,
  onCancelTransaction,
  onDeleteTransaction,
  onUpdateTransaction,
  onRefreshTransactions,
  onEditOrderInPos,
  isLoading,
  onAlert,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);

  const handleClearSearch = () => {
    setSearchTerm('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };
  // 3 Primary Tabs: 'cash' | 'transfer' | 'debt' + 'all' | 'cancelled'
  const [activeTab, setActiveTab] = useState('all');
  
  // Date range filters: 'today' | 'yesterday' | '7days' | 'all' | 'custom'
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [editingTx, setEditingTx] = useState(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('cash');

  // Customer Debt Recovery Modal state
  const [debtModalTx, setDebtModalTx] = useState(null);

  // Tab count calculations
  const counts = useMemo(() => {
    let cash = 0;
    let transfer = 0;
    let debt = 0;
    let cancelled = 0;

    transactions.forEach((tx) => {
      const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
      if (isCancelled) {
        cancelled++;
        return;
      }

      const method = (tx.paymentMethod || '').toLowerCase();
      const status = (tx.paymentStatus || '').toUpperCase();
      const remainingDebt = Number(tx.remainingDebt ?? tx.debtAmount ?? 0);

      const isDebtOrder =
        status === 'DEBT' ||
        status === 'PARTIAL' ||
        remainingDebt > 0 ||
        method === 'debt';

      if (isDebtOrder) {
        debt++;
      } else if (
        method === 'cash' ||
        method === 'ເງິນສົດ'
      ) {
        cash++;
      } else if (
        method === 'transfer' ||
        method === 'qrtransfer' ||
        method === 'onepay' ||
        method === 'qr'
      ) {
        transfer++;
      }
    });

    return { cash, transfer, debt, cancelled, total: transactions.length };
  }, [transactions]);

  // Filtering pipeline: Tab Filter -> Date Filter -> Search Filter
  const filteredTransactions = useMemo(() => {
    let list = transactions;

    // 1. Primary Tab Filtering
    if (activeTab === 'cash') {
      list = list.filter((tx) => {
        const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
        if (isCancelled) return false;
        const method = (tx.paymentMethod || '').toLowerCase();
        const status = (tx.paymentStatus || '').toUpperCase();
        const debt = Number(tx.remainingDebt ?? tx.debtAmount ?? 0);
        const isDebt = status === 'DEBT' || status === 'PARTIAL' || debt > 0 || method === 'debt';
        return !isDebt && (method === 'cash' || method === 'ເງິນສົດ');
      });
    } else if (activeTab === 'transfer') {
      list = list.filter((tx) => {
        const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
        if (isCancelled) return false;
        const method = (tx.paymentMethod || '').toLowerCase();
        const status = (tx.paymentStatus || '').toUpperCase();
        const debt = Number(tx.remainingDebt ?? tx.debtAmount ?? 0);
        const isDebt = status === 'DEBT' || status === 'PARTIAL' || debt > 0 || method === 'debt';
        return (
          !isDebt &&
          (method === 'transfer' ||
            method === 'qrtransfer' ||
            method === 'onepay' ||
            method === 'qr')
        );
      });
    } else if (activeTab === 'debt') {
      list = list.filter((tx) => {
        const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
        if (isCancelled) return false;
        const method = (tx.paymentMethod || '').toLowerCase();
        const status = (tx.paymentStatus || '').toUpperCase();
        const debt = Number(tx.remainingDebt ?? tx.debtAmount ?? 0);
        return status === 'DEBT' || status === 'PARTIAL' || debt > 0 || method === 'debt';
      });
    } else if (activeTab === 'cancelled') {
      list = list.filter((tx) => tx.status === 'cancelled' || tx.isCancelled);
    }

    // 2. Date Range Filtering
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const endOfYesterday = new Date(startOfToday.getTime() - 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (dateFilter === 'today') {
      list = list.filter((tx) => new Date(tx.createdAt) >= startOfToday);
    } else if (dateFilter === 'yesterday') {
      list = list.filter((tx) => {
        const d = new Date(tx.createdAt);
        return d >= startOfYesterday && d <= endOfYesterday;
      });
    } else if (dateFilter === '7days') {
      list = list.filter((tx) => new Date(tx.createdAt) >= sevenDaysAgo);
    } else if (dateFilter === 'custom') {
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        list = list.filter((tx) => new Date(tx.createdAt) >= start);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        list = list.filter((tx) => new Date(tx.createdAt) <= end);
      }
    }

    // 3. Search query filter: Mã bill, tên khách hàng, hình thức thanh toán VÀ tên sản phẩm / barcode / đơn vị trong bill
    const q = normalizeLao(searchTerm);
    if (!q) return list;
    return list.filter((tx) => {
      // 3.1. Tìm theo thông tin chung của đơn hàng
      const matchBasic =
        normalizeLao(tx.receiptNumber).includes(q) ||
        normalizeLao(tx.customerName).includes(q) ||
        normalizeLao(tx.paymentMethod).includes(q) ||
        normalizeLao(tx.status).includes(q) ||
        normalizeLao(tx.debtNote).includes(q);

      if (matchBasic) return true;

      // 3.2. Tìm theo danh sách sản phẩm bên trong bill (items hoặc sale_transaction_items)
      const billItems = (tx.items && tx.items.length > 0)
        ? tx.items
        : (tx.sale_transaction_items || []);

      const matchItem = billItems.some((it) => {
        const prodName = normalizeLao(it.productName || it.product_name || it.product?.name || '');
        const barcode = normalizeLao(it.barcode || it.product?.barcode || '');
        const unitName = normalizeLao(it.unitName || it.unit_name || it.unit?.unitName || '');

        return (
          prodName.includes(q) ||
          barcode.includes(q) ||
          unitName.includes(q)
        );
      });

      return matchItem;
    });
  }, [transactions, activeTab, dateFilter, startDate, endDate, searchTerm]);

  // Simple Customer Name / Method edit modal
  const handleOpenEdit = (tx) => {
    setEditingTx(tx);
    setEditCustomerName(tx.customerName || 'ລູກຄ້າທົ່ວໄປ');
    setEditPaymentMethod(tx.paymentMethod || 'cash');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTx) return;
    if (onUpdateTransaction) {
      const ok = await onUpdateTransaction(editingTx.id, {
        customerName: editCustomerName.trim() || 'ລູກຄ້າທົ່ວໄປ',
        paymentMethod: editPaymentMethod,
      });
      if (ok) setEditingTx(null);
    }
  };

  return (
    <main
      className="flex-1 w-full p-4 sm:p-6 overflow-y-auto font-sans min-h-0 pb-24 touch-pan-y"
      style={{
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        paddingBottom: 'max(5.5rem, calc(4.5rem + env(safe-area-inset-bottom, 0px)))',
      }}
    >
      {/* Top Header Bar (Standardized matching GRN) */}
      <div className="bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3.5 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-3 sm:mb-4 flex items-center justify-between gap-2.5 sm:gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
            <ClockCounterClockwise size={20} className="sm:w-5 sm:h-5" weight="duotone" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="truncate">
                <span className="sm:hidden">ປະຫວັດບິນຂາຍ</span>
                <span className="hidden sm:inline">ປະຫວັດບິນຂາຍ & ໜີ້ສິນ</span>
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                {transactions.length} ບິນ
              </span>
            </h2>
            <p className="text-[11.5px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
              ລາຍການບິນຂາຍ • ແຍກໝວດຊຳລະ • ແກ້ໄຂບິນ POS • ຊຳລະໜີ້ລູກຄ້າ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefreshTransactions}
            disabled={isLoading}
            className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs"
            title="ໂຫຼດຂໍ້ມູນຄືນຈາກ Supabase"
          >
            <ArrowClockwise size={15} className={isLoading ? 'animate-spin' : ''} weight="bold" />
            <span className="hidden sm:inline">ຣີເຟຣຊ</span>
          </button>
        </div>
      </div>

      {/* 1. PRIMARY NAVIGATION: All + 3 Payment Categories (Cash, Transfer, Debt) + Cancelled */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3">
        {/* Tab 1: ທັງໝົດ */}
        <button
          type="button"
          onClick={() => {
            playUnitChangeBeep('history');
            setActiveTab('all');
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Receipt size={16} weight="bold" />
          <span>ທັງໝົດ</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {counts.total}
          </span>
        </button>

        {/* Tab 2: ເງິນສົດ */}
        <button
          type="button"
          onClick={() => {
            playUnitChangeBeep('history');
            setActiveTab('cash');
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
            activeTab === 'cash'
              ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Money size={16} weight="bold" />
          <span>ເງິນສົດ</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'cash' ? 'bg-teal-700 text-teal-100' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {counts.cash}
          </span>
        </button>

        {/* Tab 3: ເງິນໂອນ */}
        <button
          type="button"
          onClick={() => {
            playUnitChangeBeep('history');
            setActiveTab('transfer');
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
            activeTab === 'transfer'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <QrCode size={16} weight="bold" />
          <span>ເງິນໂອນ</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'transfer' ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {counts.transfer}
          </span>
        </button>

        {/* Tab 4: ຕິດໜີ້ */}
        <button
          type="button"
          onClick={() => {
            playUnitChangeBeep('history');
            setActiveTab('debt');
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
            activeTab === 'debt'
              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
              : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/70'
          }`}
        >
          <HandCoins size={16} weight="bold" />
          <span>ຕິດໜີ້</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
              activeTab === 'debt' ? 'bg-amber-700 text-amber-100' : 'bg-amber-200 text-amber-900'
            }`}
          >
            {counts.debt}
          </span>
        </button>

        {/* Tab 5: ຍົກເລີກແລ້ວ */}
        <button
          type="button"
          onClick={() => {
            playUnitChangeBeep('history');
            setActiveTab('cancelled');
          }}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
            activeTab === 'cancelled'
              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
              : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
          }`}
        >
          <span>ຍົກເລີກແລ້ວ ({counts.cancelled})</span>
        </button>
      </div>

      {/* 2. DATE FILTER TOOLBAR & SEARCH BAR */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs mb-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Date Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <CalendarBlank size={16} className="text-slate-400 shrink-0 ml-1 mr-0.5" />
          {/* First button: ທັງໝົດ (All) */}
          <button
            type="button"
            onClick={() => {
              playUnitChangeBeep('history');
              setDateFilter('all');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === 'all'
                ? 'bg-teal-50 text-teal-800 border border-teal-300 font-black'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
            }`}
          >
            ທັງໝົດ
          </button>
          <button
            type="button"
            onClick={() => {
              playUnitChangeBeep('history');
              setDateFilter('today');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === 'today'
                ? 'bg-teal-50 text-teal-800 border border-teal-300 font-black'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
            }`}
          >
            ມື້ນີ້ (Today)
          </button>
          <button
            type="button"
            onClick={() => {
              playUnitChangeBeep('history');
              setDateFilter('yesterday');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === 'yesterday'
                ? 'bg-teal-50 text-teal-800 border border-teal-300 font-black'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
            }`}
          >
            ມື້ວານ (Yesterday)
          </button>
          <button
            type="button"
            onClick={() => {
              playUnitChangeBeep('history');
              setDateFilter('7days');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === '7days'
                ? 'bg-teal-50 text-teal-800 border border-teal-300 font-black'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
            }`}
          >
            7 ມື້ຜ່ານມາ (7 Days)
          </button>
          <button
            type="button"
            onClick={() => {
              playUnitChangeBeep('history');
              setDateFilter('custom');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === 'custom'
                ? 'bg-teal-50 text-teal-800 border border-teal-300 font-black'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
            }`}
          >
            ເລືອກວັນທີ...
          </button>
        </div>

        {/* Custom Range Inputs (shown when dateFilter === 'custom' or on desktop) */}
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">ແຕ່:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-teal-500"
            />
            <span className="text-slate-400 font-medium">ຫາ:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-teal-500"
            />
          </div>
        )}

        {/* Search input & Result count */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <MagnifyingGlass
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ຄົ້ນຫາເລກບິນ, ລູກຄ້າ, ສິນຄ້າ..."
              className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full cursor-pointer transition-colors active:scale-90 flex items-center justify-center"
                title="ລຶບການຄົ້ນຫາ (Clear search)"
              >
                <XCircle size={16} weight="fill" />
              </button>
            )}
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap font-medium shrink-0">
            {filteredTransactions.length} ບິນ
          </span>
        </div>
      </div>

      {/* Skeleton Loading State */}
      {isLoading && transactions.length === 0 ? (
        <HistoryListSkeleton count={6} />
      ) : (
        <>
          {/* 3. MOBILE VIEW (< 768px): Touch-Optimized Cards */}
          <div className="md:hidden flex flex-col gap-3 pb-6">
            {filteredTransactions.map((tx) => {
          const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
          const total = Number(tx.grandTotal) || 0;
          const paid = Number(tx.paidAmount ?? tx.amountTendered ?? 0);
          const remainingDebt = Number(
            tx.remainingDebt ?? tx.debtAmount ?? Math.max(0, total - paid)
          );
          const method = (tx.paymentMethod || '').toLowerCase();
          const status = (tx.paymentStatus || '').toUpperCase();
          const isDebtItem =
            status === 'DEBT' ||
            status === 'PARTIAL' ||
            remainingDebt > 0 ||
            method === 'debt' ||
            (tx.debtPayments && tx.debtPayments.length > 0);
          const hasDebt = remainingDebt > 0 || status === 'DEBT' || status === 'PARTIAL';

          return (
            <div
              key={tx.id}
              className={`p-3.5 bg-white rounded-2xl border transition-all shadow-xs flex flex-col gap-3 ${
                isCancelled
                  ? 'border-rose-200 bg-rose-50/20'
                  : hasDebt
                  ? 'border-amber-300 bg-amber-50/15'
                  : 'border-slate-200'
              }`}
            >
              {/* Top Row: Receipt #, Status Chip & Date */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`font-black font-mono text-sm ${
                      isCancelled ? 'line-through text-slate-400' : 'text-slate-900'
                    }`}
                  >
                    #{tx.receiptNumber}
                  </span>
                  {isCancelled && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300">
                      ຍົກເລີກແລ້ວ
                    </span>
                  )}
                  {!isCancelled && hasDebt && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                      {remainingDebt >= total ? 'ຕິດໜີ້ 100%' : 'ຕິດໜີ້ບາງສ່ວນ'}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500 font-medium">
                    {new Date(tx.createdAt).toLocaleDateString('lo-LA')}{' '}
                    {new Date(tx.createdAt).toLocaleTimeString('lo-LA', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>

              {/* Middle Row: Customer Name, Method, Amounts */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">ລູກຄ້າ:</span>
                    <span className="text-xs font-bold text-slate-900">
                      {tx.customerName || 'ລູກຄ້າທົ່ວໄປ'}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-medium">ຮູບແບບ:</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 ${
                        tx.paymentMethod === 'cash' || tx.paymentMethod === 'ເງິນສົດ'
                          ? 'bg-teal-50 text-teal-800 border border-teal-200'
                          : isDebtItem
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {tx.paymentMethod === 'cash' || tx.paymentMethod === 'ເງິນສົດ' ? (
                        <>
                          <Money size={12} weight="bold" />
                          <span>ເງິນສົດ</span>
                        </>
                      ) : isDebtItem ? (
                        <>
                          <HandCoins size={12} weight="bold" />
                          <span>ຕິດໜີ້</span>
                        </>
                      ) : (
                        <>
                          <QrCode size={12} weight="bold" />
                          <span>ໂອນເງິນ</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Amounts Breakdown: Only show จ่ายแล้ว & หนี้ค้าง for Debt Items */}
                {isDebtItem ? (
                  <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-200/60 text-center">
                    <div>
                      <span className="text-[9.5px] text-slate-500 block uppercase">ຍອດລວມ</span>
                      <span className="text-xs font-mono font-black text-slate-900">
                        {formatKip(total)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9.5px] text-emerald-700 block uppercase">ຈ່າຍແລ້ວ</span>
                      <span className="text-xs font-mono font-bold text-emerald-700">
                        {formatKip(paid)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9.5px] text-rose-600 block uppercase">ໜີ້ຄ້າງ</span>
                      <span
                        className={`text-xs font-mono font-black ${
                          remainingDebt > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {remainingDebt > 0 ? formatKip(remainingDebt) : 'ຄົບແລ້ວ'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">ຍອດລວມ</span>
                    <span className="text-xs font-mono font-black text-slate-900">
                      {formatKip(total)}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Actions Row */}
              <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 flex-wrap">
                {/* View/Print Receipt */}
                <button
                  type="button"
                  onClick={() => {
                    playActionClickBeep('history');
                    onOpenReceipt(tx);
                  }}
                  className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  <Printer size={15} weight="bold" />
                  <span>ພິມບິນ</span>
                </button>

                {/* Edit Order via POS (Replace & Re-checkout) */}
                {!isCancelled && onEditOrderInPos && (
                  <button
                    type="button"
                    onClick={() => {
                      playActionClickBeep('history');
                      onEditOrderInPos(tx);
                    }}
                    className="py-2 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                    title="ແກ້ໄຂບິນຜ່ານໜ້າ POS"
                  >
                    <PencilSimple size={15} weight="bold" />
                    <span>ແກ້ໄຂບິນ</span>
                  </button>
                )}

                {/* Debt Collection Button */}
                {!isCancelled && hasDebt && (
                  <button
                    type="button"
                    onClick={() => {
                      playActionClickBeep('history');
                      setDebtModalTx(tx);
                    }}
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                  >
                    <HandCoins size={15} weight="bold" />
                    <span>ຊຳລະໜີ້</span>
                  </button>
                )}

                {/* Void / Cancel Button */}
                {!isCancelled ? (
                  <button
                    type="button"
                    onClick={() => {
                      playErrorBeep('history');
                      onCancelTransaction && onCancelTransaction(tx);
                    }}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer ml-auto"
                    title="ຍົກເລີກບິນ"
                  >
                    <Prohibit size={15} weight="bold" />
                  </button>
                ) : (
                  <span className="p-2 rounded-xl bg-rose-50 text-rose-400 text-xs inline-flex items-center gap-1 ml-auto">
                    <Prohibit size={15} weight="bold" />
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => onDeleteTransaction && onDeleteTransaction(tx)}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer"
                  title="ລຶບ"
                >
                  <Trash size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. TABLET & DESKTOP VIEW (>= 768px): Data Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto overscroll-x-contain touch-pan-y mb-10">
        <table className="w-full min-w-[840px] text-left text-xs border-collapse">
          <thead>
            <tr className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200 text-slate-700 font-extrabold">
              <th className="py-3 px-4">ເລກທີບິນ</th>
              <th className="py-3 px-3">ວັນທີ & ເວລາ</th>
              <th className="py-3 px-3">ຊື່ລູກຄ້າ</th>
              <th className="py-3 px-3">ຮູບແບບ / ສະຖານະ</th>
              <th className="py-3 px-3 text-right">ຍອດລວມ</th>
              <th className="py-3 px-3 text-right">ຈ່າຍແລ້ວ</th>
              <th className="py-3 px-3 text-right">ໜີ້ຄ້າງ</th>
              <th className="py-3 px-4 text-center">ຈັດການບິນ (Actions)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTransactions.map((tx) => {
              const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
              const total = Number(tx.grandTotal) || 0;
              const paid = Number(tx.paidAmount ?? tx.amountTendered ?? 0);
              const remainingDebt = Number(
                tx.remainingDebt ?? tx.debtAmount ?? Math.max(0, total - paid)
              );
              const method = (tx.paymentMethod || '').toLowerCase();
              const status = (tx.paymentStatus || '').toUpperCase();
              const isDebtItem =
                status === 'DEBT' ||
                status === 'PARTIAL' ||
                remainingDebt > 0 ||
                method === 'debt' ||
                (tx.debtPayments && tx.debtPayments.length > 0);
              const hasDebt = remainingDebt > 0 || status === 'DEBT' || status === 'PARTIAL';

              return (
                <tr
                  key={tx.id}
                  className={`transition-colors ${
                    isCancelled
                      ? 'bg-rose-50/30 hover:bg-rose-50/60 text-slate-500'
                      : hasDebt
                      ? 'bg-amber-50/20 hover:bg-amber-50/40 text-slate-900'
                      : 'hover:bg-slate-50/80 text-slate-900'
                  }`}
                >
                  {/* Receipt # */}
                  <td className="py-3 px-4 font-black font-mono">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}
                      >
                        #{tx.receiptNumber}
                      </span>
                      {isCancelled && (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-rose-100 text-rose-700 border border-rose-300">
                          ຍົກເລີກແລ້ວ
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Date & Time */}
                  <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">
                    <div>{new Date(tx.createdAt).toLocaleDateString('lo-LA')}</div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(tx.createdAt).toLocaleTimeString('lo-LA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>

                  {/* Customer Name */}
                  <td
                    className={`py-3 px-3 font-bold ${
                      isCancelled ? 'text-slate-500' : 'text-slate-800'
                    }`}
                  >
                    {tx.customerName || 'ລູກຄ້າທົ່ວໄປ'}
                  </td>

                  {/* Payment Method / Status - With Clean Icons */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    {isCancelled ? (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                        <Prohibit size={12} weight="bold" />
                        <span>ຍົກເລີກບິນ</span>
                      </span>
                    ) : isDebtItem ? (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                        <HandCoins size={12} weight="bold" />
                        <span>
                          {remainingDebt >= total ? 'ຕິດໜີ້ 100%' : remainingDebt > 0 ? 'ຕິດໜີ້ບາງສ່ວນ' : 'ຊຳລະຄົບແລ້ວ'}
                        </span>
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold inline-flex items-center gap-1 ${
                          tx.paymentMethod === 'cash' || tx.paymentMethod === 'ເງິນສົດ'
                            ? 'bg-teal-50 text-teal-800 border border-teal-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {tx.paymentMethod === 'cash' || tx.paymentMethod === 'ເງິນສົດ' ? (
                          <>
                            <Money size={12} weight="bold" />
                            <span>ເງິນສົດ</span>
                          </>
                        ) : (
                          <>
                            <QrCode size={12} weight="bold" />
                            <span>QR ໂອນ</span>
                          </>
                        )}
                      </span>
                    )}
                  </td>

                  {/* Grand Total */}
                  <td className="py-3 px-3 text-right font-black font-mono">
                    <span className={isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}>
                      {formatKip(total)}
                    </span>
                  </td>

                  {/* Paid Amount (ຈ່າຍແລ້ວ) - Only for debt items */}
                  <td className="py-3 px-3 text-right font-mono">
                    {isDebtItem ? (
                      <span className="font-bold text-emerald-700">{formatKip(paid)}</span>
                    ) : (
                      <span className="text-slate-300 font-bold select-none">-</span>
                    )}
                  </td>

                  {/* Remaining Debt (ໜີ້ຄ້າງ) - Only for debt items */}
                  <td className="py-3 px-3 text-right font-mono">
                    {isDebtItem ? (
                      remainingDebt > 0 ? (
                        <span className="font-black text-rose-600">{formatKip(remainingDebt)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check size={11} weight="bold" />
                          <span>ຄົບແລ້ວ</span>
                        </span>
                      )
                    ) : (
                      <span className="text-slate-300 font-bold select-none">-</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      {/* View Receipt */}
                      <button
                        type="button"
                        onClick={() => onOpenReceipt(tx)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                        title="ເບິ່ງ / ພິມບິນ"
                      >
                        <Printer size={13} />
                        <span>ພິມ</span>
                      </button>

                      {/* Edit Order via POS (Replace & Re-checkout pattern) */}
                      {!isCancelled && onEditOrderInPos && (
                        <button
                          type="button"
                          onClick={() => onEditOrderInPos(tx)}
                          className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                          title="ແກ້ໄຂບິນໂດຍນຳເຂົ້າໜ້າ POS"
                        >
                          <PencilSimple size={13} weight="bold" />
                          <span>ແກ້ໄຂບິນ</span>
                        </button>
                      )}

                      {/* Collect Debt Modal */}
                      {!isCancelled && hasDebt && (
                        <button
                          type="button"
                          onClick={() => setDebtModalTx(tx)}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black inline-flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                          title="ຊຳລະໜີ້ລູກຄ້າ"
                        >
                          <HandCoins size={13} weight="bold" />
                          <span>ຊຳລະໜີ້</span>
                        </button>
                      )}

                      {/* Void / Cancel */}
                      {!isCancelled ? (
                        <button
                          type="button"
                          onClick={() => onCancelTransaction && onCancelTransaction(tx)}
                          className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 text-[11px] font-bold inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                          title="ຍົກເລີກບິນ & ຄືນສະຕັອກ"
                        >
                          <Prohibit size={13} weight="bold" />
                          <span>ຍົກເລີກ</span>
                        </button>
                      ) : (
                        <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-400 text-[10px] font-bold inline-flex items-center gap-1">
                          ຍົກເລີກແລ້ວ
                        </span>
                      )}

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction && onDeleteTransaction(tx)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                        title="ລຶບຖາວອນ"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!isLoading && filteredTransactions.length === 0 && (
          <div className="py-20 text-center text-slate-400">
            <Receipt size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold">ບໍ່ພົບລາຍການບິນຕາມເງື່ອນໄຂທີ່ເລືອກ</p>
          </div>
        )}
      </div>

      {/* Mobile Empty State */}
      {!isLoading && filteredTransactions.length === 0 && (
        <div className="md:hidden py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 mb-6">
          <Receipt size={36} className="mx-auto mb-2 opacity-50" />
          <p className="text-xs font-bold">ບໍ່ພົບລາຍການບິນຕາມເງື່ອນໄຂທີ່ເລືອກ</p>
        </div>
      )}
    </>
  )}

      {/* Customer Debt Payment Modal */}
      {debtModalTx && (
        <CustomerDebtPaymentModal
          isOpen={Boolean(debtModalTx)}
          onClose={() => setDebtModalTx(null)}
          transaction={debtModalTx}
          onSuccess={() => {
            onRefreshTransactions?.();
            setDebtModalTx(null);
          }}
          onAlert={onAlert}
        />
      )}

      {/* Quick Customer Name / Payment Method Edit Modal (Fallback) */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <PencilSimple size={18} className="text-teal-600" weight="bold" />
                <span>ແກ້ໄຂຂໍ້ມູນບິນ: #{editingTx.receiptNumber}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ຊື່ລູກຄ້າ (Customer Name):
                </label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ຮູບແບບຊຳລະ (Payment Method):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      editPaymentMethod === 'cash'
                        ? 'bg-teal-50 border-teal-500 text-teal-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Money size={15} weight="bold" />
                    <span>ເງິນສົດ (Cash)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPaymentMethod('onepay')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      editPaymentMethod !== 'cash'
                        ? 'bg-blue-50 border-blue-500 text-blue-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <QrCode size={15} weight="bold" />
                    <span>QR ໂອນ (OnePay)</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex justify-between">
                <span>ຍອດຊຳລະທັງໝົດ:</span>
                <span className="font-black text-slate-900 font-mono">
                  {formatKip(editingTx.grandTotal)}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle size={15} weight="fill" />
                  <span>ບັນທຶກ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
