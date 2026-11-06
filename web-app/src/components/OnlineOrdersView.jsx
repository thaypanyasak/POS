import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Clock,
  Phone,
  WhatsappLogo,
  MapPin,
  Buildings,
  Moped,
  Printer,
  CheckCircle,
  XCircle,
  Package,
  MagnifyingGlass,
  ArrowClockwise,
  Check,
  Copy,
  CurrencyCircleDollar,
  Eye,
  X,
  User,
  CaretRight,
} from '@phosphor-icons/react';
import { formatKip } from '../utils/formatters';
import { playSuccessBeep, playActionClickBeep, playErrorBeep, playRefreshBeep } from '../utils/audioFeedback';

export default function OnlineOrdersView({
  transactions = [],
  onUpdateOnlineStatus,
  onOpenReceipt,
  onRefresh,
  isLoading = false,
}) {
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED'
  const [searchQuery, setSearchQuery] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('ALL'); // 'ALL' | 'pickup' | 'delivery'
  const [copiedId, setCopiedId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState(null);
  const [isLocalRefreshing, setIsLocalRefreshing] = useState(false);

  const handleLocalRefresh = async () => {
    if (isLocalRefreshing) return;
    setIsLocalRefreshing(true);
    playRefreshBeep('history');
    try {
      await Promise.all([
        onRefresh?.(),
        new Promise((res) => setTimeout(res, 600)),
      ]);
      playSuccessBeep('history');
    } catch (err) {
      console.error('Online orders refresh error:', err);
    } finally {
      setIsLocalRefreshing(false);
    }
  };

  // Filter only online orders (Defensive multi-attribute detection)
  const onlineOrders = useMemo(() => {
    return (transactions || []).filter((tx) => {
      const src = tx.order_source || tx.orderSource;
      if (src === 'online') return true;
      const id = String(tx.id || '');
      if (id.startsWith('onl_') || id.startsWith('ONL_')) return true;
      const rc = String(tx.receipt_number || tx.receiptNumber || '');
      if (rc.startsWith('ONL-') || rc.startsWith('onl-')) return true;
      const cashier = String(tx.cashier_name || tx.cashierName || '');
      if (cashier.toLowerCase().includes('online')) return true;
      return false;
    });
  }, [transactions]);

  // Status counts for badge tabs
  const counts = useMemo(() => {
    const c = {
      ALL: onlineOrders.length,
      PENDING: 0,
      PREPARING: 0,
      READY: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    onlineOrders.forEach((o) => {
      const st = (o.online_status || o.onlineStatus || 'PENDING').toUpperCase();
      if (c[st] !== undefined) {
        c[st]++;
      }
    });
    return c;
  }, [onlineOrders]);

  // Filtered and searched orders
  const filteredOrders = useMemo(() => {
    let list = onlineOrders;

    if (activeTab !== 'ALL') {
      list = list.filter((o) => {
        const st = (o.online_status || o.onlineStatus || 'PENDING').toUpperCase();
        return st === activeTab;
      });
    }

    if (fulfillmentFilter !== 'ALL') {
      list = list.filter((o) => {
        const ful = o.fulfillment_type || o.fulfillmentType || 'pickup';
        return ful === fulfillmentFilter;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((o) => {
        const name = (o.customer_name || o.customerName || '').toLowerCase();
        const phone = (o.customer_phone || o.customerPhone || '').toLowerCase();
        const receipt = (o.receipt_number || o.receiptNumber || o.id || '').toLowerCase();
        const addr = (o.delivery_address || o.deliveryAddress || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || receipt.includes(q) || addr.includes(q);
      });
    }

    // Sort: newest first
    return [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [onlineOrders, activeTab, fulfillmentFilter, searchQuery]);

  const handleCopyReceipt = (text, id) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      playActionClickBeep();
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  };

  const handleStatusChange = async (order, newStatus) => {
    playActionClickBeep();
    setActionLoadingId(order.id);
    try {
      if (onUpdateOnlineStatus) {
        await onUpdateOnlineStatus(order, newStatus);
      }
      playSuccessBeep();
      if (selectedDetailOrder && selectedDetailOrder.id === order.id) {
        setSelectedDetailOrder((prev) => (prev ? { ...prev, online_status: newStatus } : null));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      playErrorBeep();
      alert('ເກີດຂໍ້ຜິດພາດໃນການອັບເດດສະຖານະ: ' + (err.message || 'ກະລຸນາລອງໃໝ່'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePrint = (order) => {
    playActionClickBeep();
    if (onOpenReceipt) {
      onOpenReceipt(order);
    }
  };

  const getStatusBadge = (status) => {
    const st = (status || 'PENDING').toUpperCase();
    switch (st) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>ລໍຖ້າຢືນຢັນ</span>
          </span>
        );
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-300 shadow-2xs whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>ກຳລັງຈັດເຄື່ອງ</span>
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>ພ້ອມສົ່ງ / ຮັບ</span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs whitespace-nowrap">
            <CheckCircle size={14} weight="fill" className="text-teal-600" />
            <span>ສຳເລັດແລ້ວ</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs whitespace-nowrap">
            <XCircle size={14} weight="fill" className="text-rose-600" />
            <span>ຍົກເລີກແລ້ວ</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* 1. TOP HEADER & METRIC SUMMARY */}
      <header className="bg-white border-b border-slate-200 px-3.5 sm:px-6 py-2.5 sm:py-3 shrink-0 shadow-2xs">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary-light text-primary border border-primary-border flex items-center justify-center font-bold shadow-2xs shrink-0">
              <ShoppingBag size={18} className="sm:w-5 sm:h-5" weight="fill" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base md:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2">
                <span className="truncate">ອໍເດີອອນລາຍ</span>
                <span className="hidden sm:inline text-xs font-semibold text-slate-500">(Online Orders)</span>
                {counts.PENDING > 0 && (
                  <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] sm:text-[11px] font-black animate-bounce shadow-xs shrink-0">
                    {counts.PENDING} ໃໝ່
                  </span>
                )}
              </h1>
              <p className="hidden sm:block text-[11.5px] sm:text-xs text-slate-500 truncate">
                ຈັດການອໍເດີຈາກເວັບໄຊ /menu • ມາຮັບເອງທີ່ຮ້ານ & ສົ່ງຮອດບ່ອນ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRefresh && (
              <button
                type="button"
                onClick={handleLocalRefresh}
                disabled={isLocalRefreshing}
                className={`group/ref h-8.5 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-90 active:rotate-12 shadow-2xs border border-slate-200 ${
                  isLocalRefreshing ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                title="ໂຫຼດຂໍ້ມູນໃໝ່ (Refresh Online Orders)"
              >
                <ArrowClockwise
                  size={15}
                  weight="bold"
                  className={`transition-transform duration-300 ${isLocalRefreshing ? 'animate-spin text-teal-600' : 'group-hover/ref:rotate-180'}`}
                />
                <span className="hidden sm:inline">ໂຫຼດໃໝ່</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Status KPI Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-slate-100">
          <div
            onClick={() => setActiveTab('PENDING')}
            className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'PENDING'
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/30 shadow-xs'
                : 'bg-white border-slate-200 hover:border-amber-200 shadow-2xs'
            }`}
          >
            <div className="text-[11px] font-bold text-amber-800 flex items-center justify-between">
              <span>ລໍຖ້າຢືນຢັນ</span>
              {counts.PENDING > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-900 font-mono mt-0.5">
              {counts.PENDING}
            </div>
          </div>

          <div
            onClick={() => setActiveTab('PREPARING')}
            className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'PREPARING'
                ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400/30 shadow-xs'
                : 'bg-white border-slate-200 hover:border-blue-200 shadow-2xs'
            }`}
          >
            <div className="text-[11px] font-bold text-blue-800">ກຳລັງຈັດເຄື່ອງ</div>
            <div className="text-xl sm:text-2xl font-black text-blue-900 font-mono mt-0.5">
              {counts.PREPARING}
            </div>
          </div>

          <div
            onClick={() => setActiveTab('READY')}
            className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'READY'
                ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/30 shadow-xs'
                : 'bg-white border-slate-200 hover:border-emerald-200 shadow-2xs'
            }`}
          >
            <div className="text-[11px] font-bold text-emerald-800">ພ້ອມສົ່ງ / ຮັບ</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-900 font-mono mt-0.5">
              {counts.READY}
            </div>
          </div>

          <div
            onClick={() => setActiveTab('COMPLETED')}
            className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'COMPLETED'
                ? 'bg-teal-50 border-teal-300 ring-2 ring-teal-400/30 shadow-xs'
                : 'bg-white border-slate-200 hover:border-teal-200 shadow-2xs'
            }`}
          >
            <div className="text-[11px] font-bold text-teal-800">ສຳເລັດແລ້ວ</div>
            <div className="text-xl sm:text-2xl font-black text-teal-900 font-mono mt-0.5">
              {counts.COMPLETED}
            </div>
          </div>
        </div>
      </header>

      {/* 2. FILTER & SEARCH TOOLBAR */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 shrink-0 shadow-2xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto py-0.5">
          {[
            { id: 'ALL', label: 'ທັງໝົດ', count: counts.ALL },
            { id: 'PENDING', label: 'ລໍຖ້າຢືນຢັນ', count: counts.PENDING },
            { id: 'PREPARING', label: 'ກຳລັງຈັດເຄື່ອງ', count: counts.PREPARING },
            { id: 'READY', label: 'ພ້ອມສົ່ງ/ຮັບ', count: counts.READY },
            { id: 'COMPLETED', label: 'ສຳເລັດ', count: counts.COMPLETED },
            { id: 'CANCELLED', label: 'ຍົກເລີກ', count: counts.CANCELLED },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  playActionClickBeep();
                  setActiveTab(tab.id);
                }}
                className={`h-8 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all active:scale-95 shrink-0 border ${
                  isActive
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs font-black'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive ? 'bg-teal-800 text-teal-100' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Fulfillment Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Fulfillment Filter Toggle */}
          <select
            value={fulfillmentFilter}
            onChange={(e) => {
              playActionClickBeep();
              setFulfillmentFilter(e.target.value);
            }}
            className="h-9 px-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:border-teal-600 shadow-2xs cursor-pointer"
          >
            <option value="ALL">ທຸກຮູບແບບ</option>
            <option value="pickup">ມາຮັບເອງ</option>
            <option value="delivery">ສົ່ງຮອດບ່ອນ</option>
          </select>

          {/* Search Box */}
          <div className="relative flex-1 md:w-64">
            <MagnifyingGlass
              size={15}
              weight="bold"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ຄົ້ນຫາຊື່, ເບີໂທ, ລະຫັດ..."
              className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white shadow-2xs font-medium transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 cursor-pointer"
              >
                <X size={12} weight="bold" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. MAIN CONTENT: TABLE (DESKTOP) & TOUCH CARDS (MOBILE xoay dọc) */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 no-scrollbar min-h-0">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center my-8 space-y-3 shadow-xs max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center">
              <ShoppingBag size={32} weight="duotone" />
            </div>
            <h3 className="text-base font-bold text-slate-800">ບໍ່ມີລາຍການອໍເດີອອນລາຍ</h3>
            <p className="text-xs text-slate-500">
              {searchQuery || activeTab !== 'ALL' || fulfillmentFilter !== 'ALL'
                ? 'ບໍ່ພົບອໍເດີທີ່ກົງກັບເງື່ອນໄຂການຄົ້ນຫາ.'
                : 'ຍັງບໍ່ມີອໍເດີໃໝ່ເຂົ້າມາຈາກເວັບໄຊ.'}
            </p>
            {(searchQuery || activeTab !== 'ALL' || fulfillmentFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ALL');
                  setFulfillmentFilter('ALL');
                  setSearchQuery('');
                }}
                className="mt-2 h-9 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold active:scale-95 transition-all shadow-2xs cursor-pointer"
              >
                ລ້າງຕົວກັ່ນຕອງທັງໝົດ
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ========================================================= */}
            {/* A. DESKTOP / TABLET VIEW (TABLE LIST) - hidden on mobile  */}
            {/* ========================================================= */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3 whitespace-nowrap">ລະຫັດອໍເດີ & ເວລາ</th>
                      <th className="py-2.5 px-3">ລູກຄ້າ</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">ເບີຕິດຕໍ່</th>
                      <th className="py-2.5 px-3">ຮູບແບບຮັບເຄື່ອງ</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">ຍອດລວມ</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">ການຊຳລະ</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">ສະຖານະ</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">ການຈັດການ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                    {filteredOrders.map((order) => {
                      const isPickup =
                        order.fulfillment_type === 'pickup' || order.fulfillmentType === 'pickup';
                      const items =
                        order.sale_transaction_items && order.sale_transaction_items.length > 0
                          ? order.sale_transaction_items
                          : order.items || [];
                      const status = (order.online_status || order.onlineStatus || 'PENDING').toUpperCase();
                      const isActionLoading = actionLoadingId === order.id;

                      // 1. Clean order display code (e.g. ONL-261102-6914 or ONL-ZRP8)
                      const rawReceipt = order.receiptNumber || order.receipt_number;
                      let cleanDisplayCode = rawReceipt;
                      if (!cleanDisplayCode || cleanDisplayCode.startsWith('onl_')) {
                        const parts = (order.id || '').split('_');
                        const suffix = parts.length > 2 ? parts[2].toUpperCase() : (order.id || '').slice(-6).toUpperCase();
                        cleanDisplayCode = `ONL-${suffix}`;
                      }

                      // 2. Format Date and Time properly
                      const rawDate = order.created_at || order.createdAt || order.date;
                      let formattedTime = '';
                      let formattedDate = '';
                      if (rawDate) {
                        const d = new Date(rawDate);
                        if (!isNaN(d.getTime())) {
                          formattedTime = d.toLocaleTimeString('lo-LA', {
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                          formattedDate = d.toLocaleDateString('lo-LA', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          });
                        }
                      }
                      if (!formattedTime || formattedTime === '--:--') {
                        const now = new Date();
                        formattedTime = now.toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' });
                        formattedDate = now.toLocaleDateString('lo-LA', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      }

                      const cleanPhone = (order.customer_phone || order.customerPhone || '').replace(
                        /\s+/g,
                        ''
                      );
                      const waCleanPhone = cleanPhone.startsWith('0')
                        ? `856${cleanPhone.slice(1)}`
                        : cleanPhone;

                      const custName = order.customer_name || order.customerName || 'ລູກຄ້າທົ່ວໄປ';

                      const readyWaMessage = encodeURIComponent(
                        `ສະບາຍດີ ທ່ານ ${custName}! ອໍເດີເລກທີ ${cleanDisplayCode} ຂອງຮ້ານ ສົມສັກ ໄດ້ຖືກຈັດກຽມຮຽບຮ້ອຍແລ້ວ! ${
                          isPickup
                            ? 'ທ່ານສາມາດແວ່ມາຮັບເຄື່ອງຢູ່ຮ້ານໄດ້ເລີຍ.'
                            : 'ກຳລັງມອບໃຫ້ຄົນສົ່ງເຄື່ອງຈັດສົ່ງຮອດບ່ອນ.'
                        }\nຂອບໃຈຫຼາຍໆ!`
                      );

                      const isTransfer = order.payment_method === 'transfer';
                      const grandTotal = Number(order.grand_total || order.grandTotal || order.total_lak || 0);

                      return (
                        <tr
                          key={order.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            status === 'PENDING' ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          {/* 1. Receipt Code & Time (Max 2 lines) */}
                          <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span className=" font-black text-slate-900 tracking-tight text-xs">
                                #{cleanDisplayCode}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyReceipt(cleanDisplayCode, order.id)}
                                className="p-0.5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                                title="ສຳເນົາລະຫັດອໍເດີ"
                              >
                                {copiedId === order.id ? (
                                  <Check size={12} weight="bold" className="text-teal-600" />
                                ) : (
                                  <Copy size={12} weight="bold" />
                                )}
                              </button>
                            </div>
                            <div className="text-[10.5px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                              <Clock size={11} className="text-slate-400 shrink-0" />
                              <span>{formattedTime} • {formattedDate}</span>
                            </div>
                          </td>

                          {/* 2. Customer Name (Max 2 lines) */}
                          <td className="py-2.5 px-3 align-middle">
                            <div className="font-bold text-slate-900 text-xs truncate max-w-[130px]" title={custName}>
                              {custName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              ລູກຄ້າອອນລາຍ
                            </div>
                          </td>

                          {/* 3. Phone & Contact Buttons (Max 2 lines) */}
                          <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                            {cleanPhone ? (
                              <div>
                                <div className="font-mono font-bold text-teal-800 text-xs">
                                  {cleanPhone}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <a
                                    href={`tel:${cleanPhone}`}
                                    className="px-1.5 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-bold border border-teal-200 inline-flex items-center gap-1 active:scale-95 shadow-2xs"
                                    title="ໂທຫາລູກຄ້າ"
                                  >
                                    <Phone size={10} weight="bold" />
                                    <span>ໂທ</span>
                                  </a>
                                  <a
                                    href={`https://wa.me/${waCleanPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200 inline-flex items-center gap-1 active:scale-95 shadow-2xs"
                                    title="WhatsApp"
                                  >
                                    <WhatsappLogo size={11} weight="fill" />
                                    <span>WA</span>
                                  </a>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">ບໍ່ມີເບີໂທ</span>
                            )}
                          </td>

                          {/* 4. Fulfillment (Max 2 lines) */}
                          <td className="py-2.5 px-3 align-middle max-w-[180px]">
                            {isPickup ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-bold border border-teal-200 text-[10.5px]">
                                  <Buildings size={12} weight="bold" />
                                  <span>ມາຮັບເອງ</span>
                                  {(order.pickup_time || order.pickupTime) && (
                                    <span className="text-teal-950 font-black">
                                      ({order.pickup_time || order.pickupTime})
                                    </span>
                                  )}
                                </span>
                                {(order.delivery_note || order.deliveryNote) && (
                                  <div className="text-[10.5px] text-slate-500 italic truncate mt-0.5" title={order.delivery_note || order.deliveryNote}>
                                    "{order.delivery_note || order.deliveryNote}"
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 font-bold border border-sky-200 text-[10.5px]">
                                  <Moped size={12} weight="bold" />
                                  <span>ສົ່ງຮອດບ່ອນ</span>
                                </span>
                                {(order.delivery_address || order.deliveryAddress) && (
                                  <div className="text-[10.5px] text-sky-950 font-medium truncate flex items-center gap-1 mt-0.5" title={order.delivery_address || order.deliveryAddress}>
                                    <MapPin size={11} weight="bold" className="text-sky-600 shrink-0" />
                                    <span className="truncate">{order.delivery_address || order.deliveryAddress}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* 5. Total (Max 2 lines) */}
                          <td className="py-2.5 px-3 align-middle text-right whitespace-nowrap">
                            <div className="font-mono font-black text-sm text-slate-900">
                              {formatKip(grandTotal)}
                            </div>
                            <div className="text-[10.5px] font-bold text-slate-500 mt-0.5">
                              {items.length} ລາຍການ
                            </div>
                          </td>

                          {/* 6. Payment (1 line) */}
                          <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${
                                isTransfer
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-teal-50 text-teal-800 border-teal-200'
                              }`}
                            >
                              <CurrencyCircleDollar size={12} weight="bold" />
                              <span>{isTransfer ? 'BCEL One' : 'ເງິນສົດ (COD)'}</span>
                            </span>
                          </td>

                          {/* 7. Status Badge (1 line) */}
                          <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap">
                            {getStatusBadge(status)}
                          </td>

                          {/* 8. Action Buttons */}
                          <td className="py-2.5 px-3 align-middle text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View detail button */}
                              <button
                                type="button"
                                onClick={() => setSelectedDetailOrder(order)}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer border border-slate-200 shadow-2xs"
                                title="ເບິ່ງລາຍລະອຽດອໍເດີ"
                              >
                                <Eye size={15} weight="bold" />
                              </button>

                              {/* Print K80 Slip */}
                              <button
                                type="button"
                                onClick={() => handlePrint(order)}
                                className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer shadow-2xs"
                                title="ພິມໃບບິນ K80"
                              >
                                <Printer size={15} weight="bold" />
                              </button>

                              {/* Workflow Actions */}
                              {status === 'PENDING' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isActionLoading}
                                    onClick={() => handleStatusChange(order, 'PREPARING')}
                                    className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1 transition-all active:scale-95 shadow-2xs cursor-pointer"
                                  >
                                    <Check size={13} weight="bold" />
                                    <span>ຮັບອໍເດີ</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isActionLoading}
                                    onClick={() => {
                                      if (window.confirm('ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການຍົກເລີກອໍເດີນີ້?')) {
                                        handleStatusChange(order, 'CANCELLED');
                                      }
                                    }}
                                    className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all active:scale-95 cursor-pointer"
                                    title="ຍົກເລີກ"
                                  >
                                    <XCircle size={15} weight="bold" />
                                  </button>
                                </>
                              )}

                              {status === 'PREPARING' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isActionLoading}
                                    onClick={() => handleStatusChange(order, 'READY')}
                                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1 transition-all active:scale-95 shadow-2xs cursor-pointer"
                                  >
                                    <Package size={13} weight="bold" />
                                    <span>ຈັດເຄື່ອງແລ້ວ</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isActionLoading}
                                    onClick={() => {
                                      if (window.confirm('ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການຍົກເລີກອໍເດີນີ້?')) {
                                        handleStatusChange(order, 'CANCELLED');
                                      }
                                    }}
                                    className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all active:scale-95 cursor-pointer"
                                    title="ຍົກເລີກ"
                                  >
                                    <XCircle size={15} weight="bold" />
                                  </button>
                                </>
                              )}

                              {status === 'READY' && (
                                <>
                                  {cleanPhone && (
                                    <a
                                      href={`https://wa.me/${waCleanPhone}?text=${readyWaMessage}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                                      title="ແຈ້ງ WhatsApp"
                                    >
                                      <WhatsappLogo size={14} weight="fill" />
                                      <span>ແຈ້ງ</span>
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    disabled={isActionLoading}
                                    onClick={() => handleStatusChange(order, 'COMPLETED')}
                                    className="px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black flex items-center gap-1 transition-all active:scale-95 shadow-2xs cursor-pointer"
                                  >
                                    <CheckCircle size={14} weight="fill" />
                                    <span>ສຳເລັດ</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ============================================================================== */}
            {/* B. MOBILE PORTRAIT VIEW (md:hidden) - Touch Cards specifically for Phone Portrait */}
            {/* Khi ở mobile xoay dọc: Tự động dùng Cards gọn gàng, nút bấm lớn, không vỡ layout */}
            {/* ============================================================================== */}
            <div className="md:hidden flex flex-col gap-3 pb-6">
              {filteredOrders.map((order) => {
                const isPickup =
                  order.fulfillment_type === 'pickup' || order.fulfillmentType === 'pickup';
                const items =
                  order.sale_transaction_items && order.sale_transaction_items.length > 0
                    ? order.sale_transaction_items
                    : order.items || [];
                const status = (order.online_status || order.onlineStatus || 'PENDING').toUpperCase();
                const isActionLoading = actionLoadingId === order.id;
                const formattedTime = order.created_at
                  ? new Date(order.created_at).toLocaleTimeString('lo-LA', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '--:--';
                const formattedDate = order.created_at
                  ? new Date(order.created_at).toLocaleDateString('lo-LA', {
                      day: '2-digit',
                      month: '2-digit',
                    })
                  : '';

                const cleanPhone = (order.customer_phone || order.customerPhone || '').replace(
                  /\s+/g,
                  ''
                );
                const waCleanPhone = cleanPhone.startsWith('0')
                  ? `856${cleanPhone.slice(1)}`
                  : cleanPhone;

                const readyWaMessage = encodeURIComponent(
                  `ສະບາຍດີ ທ່ານ ${order.customer_name || 'ລູກຄ້າ'}! ອໍເດີເລກທີ ${
                    order.receipt_number || order.id
                  } ຂອງຮ້ານ ສົມສັກ ໄດ້ຖືກຈັດກຽມຮຽບຮ້ອຍແລ້ວ! ${
                    isPickup
                      ? 'ທ່ານສາມາດແວ່ມາຮັບເຄື່ອງຢູ່ຮ້ານໄດ້ເລີຍເດີ.'
                      : 'ກຳລັງມອບໃຫ້ຄົນສົ່ງເຄື່ອງຈັດສົ່ງຮອດບ່ອນ.'
                  }\nຂອບໃຈຫຼາຍໆເດີ!`
                );

                const isTransfer = order.payment_method === 'transfer';
                const grandTotal = Number(order.grand_total || order.grandTotal || order.total_lak || 0);

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl border transition-all duration-200 shadow-2xs overflow-hidden ${
                      status === 'PENDING'
                        ? 'border-amber-300 ring-2 ring-amber-400/20'
                        : status === 'PREPARING'
                        ? 'border-blue-200'
                        : status === 'READY'
                        ? 'border-emerald-200'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Top Row: Code, Status & Time */}
                    <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-black text-sm text-slate-900 truncate">
                          #{order.receipt_number || order.id}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyReceipt(order.receipt_number || order.id, order.id)
                          }
                          className="p-1 rounded text-slate-400 hover:text-slate-700"
                        >
                          {copiedId === order.id ? (
                            <Check size={13} weight="bold" className="text-teal-600" />
                          ) : (
                            <Copy size={13} weight="bold" />
                          )}
                        </button>
                      </div>

                      <div className="shrink-0">{getStatusBadge(status)}</div>
                    </div>

                    {/* Middle: Customer + Delivery + Items */}
                    <div className="p-3 space-y-2.5">
                      {/* Customer Row */}
                      <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                            <User size={13} weight="bold" className="text-slate-400 shrink-0" />
                            <span>{order.customer_name || order.customerName || 'ລູກຄ້າທົ່ວໄປ'}</span>
                          </div>
                          {cleanPhone && (
                            <div className="text-xs font-mono font-bold text-teal-800 flex items-center gap-1 mt-0.5">
                              <Phone size={11} weight="bold" className="text-teal-600 shrink-0" />
                              <span>{order.customer_phone || order.customerPhone}</span>
                            </div>
                          )}
                        </div>

                        {cleanPhone && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={`tel:${cleanPhone}`}
                              className="w-8 h-8 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 flex items-center justify-center border border-teal-200 active:scale-95 shadow-2xs"
                              title="ໂທ"
                            >
                              <Phone size={14} weight="bold" />
                            </a>
                            <a
                              href={`https://wa.me/${waCleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 active:scale-95 shadow-2xs"
                              title="WhatsApp"
                            >
                              <WhatsappLogo size={15} weight="fill" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Fulfillment Row */}
                      <div>
                        {isPickup ? (
                          <div className="p-2 rounded-xl bg-teal-50/70 border border-teal-200/80 text-xs text-teal-950 flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 font-bold">
                              <Buildings size={15} weight="bold" className="text-teal-700" />
                              <span>ມາຮັບເອງທີ່ຮ້ານ</span>
                            </div>
                            {(order.pickup_time || order.pickupTime) && (
                              <span className="font-black text-teal-900 bg-white px-2 py-0.5 rounded-lg border border-teal-200 text-[11px]">
                                {order.pickup_time || order.pickupTime}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200/80 text-xs text-sky-950 space-y-1">
                            <div className="flex items-start gap-1 font-bold">
                              <MapPin size={14} weight="bold" className="text-sky-600 shrink-0 mt-0.5" />
                              <span>{order.delivery_address || order.deliveryAddress}</span>
                            </div>
                            {(order.delivery_note || order.deliveryNote) && (
                              <div className="text-[11px] text-sky-800 italic pl-4">
                                "{order.delivery_note || order.deliveryNote}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Items & Total Summary (Click to view full detail) */}
                      <div
                        onClick={() => setSelectedDetailOrder(order)}
                        className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 cursor-pointer hover:bg-slate-100/70 transition-all flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Package size={14} weight="bold" className="text-slate-600 shrink-0" />
                            <span>{items.length} ລາຍການສິນຄ້າ</span>
                            <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                              ກົດເບິ່ງ
                            </span>
                          </span>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            {isTransfer ? 'ໂອນ BCEL One' : 'ເງິນສົດ (COD)'}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-sm text-teal-800 block">
                            {formatKip(grandTotal)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formattedTime} • {formattedDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailOrder(order)}
                        className="h-9 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer border border-slate-200"
                        title="ເບິ່ງລາຍລະອຽດສິນຄ້າ"
                      >
                        <Eye size={15} weight="bold" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePrint(order)}
                        className="h-9 px-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                        title="ພິມໃບບິນ K80"
                      >
                        <Printer size={15} weight="bold" />
                        <span>ພິມ</span>
                      </button>

                      {status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => handleStatusChange(order, 'PREPARING')}
                            className="flex-1 h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-xs cursor-pointer"
                          >
                            <Check size={15} weight="bold" />
                            <span>ຮັບອໍເດີ</span>
                          </button>
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => {
                              if (window.confirm('ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການຍົກເລີກອໍເດີນີ້?')) {
                                handleStatusChange(order, 'CANCELLED');
                              }
                            }}
                            className="h-9 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold active:scale-95 cursor-pointer"
                          >
                            <XCircle size={15} weight="bold" />
                          </button>
                        </>
                      )}

                      {status === 'PREPARING' && (
                        <>
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => handleStatusChange(order, 'READY')}
                            className="flex-1 h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-xs cursor-pointer"
                          >
                            <Package size={15} weight="bold" />
                            <span>ຈັດເຄື່ອງແລ້ວ</span>
                          </button>
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => {
                              if (window.confirm('ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການຍົກເລີກອໍເດີນີ້?')) {
                                handleStatusChange(order, 'CANCELLED');
                              }
                            }}
                            className="h-9 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold active:scale-95 cursor-pointer"
                          >
                            <XCircle size={15} weight="bold" />
                          </button>
                        </>
                      )}

                      {status === 'READY' && (
                        <>
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/${waCleanPhone}?text=${readyWaMessage}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-9 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 active:scale-95 shadow-2xs"
                            >
                              <WhatsappLogo size={15} weight="fill" />
                              <span>ແຈ້ງ</span>
                            </a>
                          )}
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => handleStatusChange(order, 'COMPLETED')}
                            className="flex-1 h-9 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-xs cursor-pointer"
                          >
                            <CheckCircle size={15} weight="fill" />
                            <span>ສຳເລັດ</span>
                          </button>
                        </>
                      )}

                      {status === 'COMPLETED' && (
                        <div className="flex-1 text-right text-xs font-bold text-teal-700 flex items-center justify-end gap-1">
                          <CheckCircle size={15} weight="fill" />
                          <span>ສຳເລັດແລ້ວ</span>
                        </div>
                      )}

                      {status === 'CANCELLED' && (
                        <div className="flex-1 text-right text-xs font-bold text-rose-600 flex items-center justify-end gap-1">
                          <XCircle size={15} weight="fill" />
                          <span>ຍົກເລີກແລ້ວ</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* 4. MODAL DETAIL PREVIEW (KHI BẤM XEM CHI TIẾT ĐƠN) */}
      {selectedDetailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <ShoppingBag size={18} weight="fill" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 font-mono">
                    #{selectedDetailOrder.receipt_number || selectedDetailOrder.id}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {new Date(selectedDetailOrder.created_at || Date.now()).toLocaleString('lo-LA')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <X size={15} weight="bold" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto space-y-3.5 text-xs flex-1">
              {/* Status & Method */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-[10.5px] text-slate-400 block">ສະຖານະ:</span>
                  <div className="mt-0.5">{getStatusBadge(selectedDetailOrder.online_status || selectedDetailOrder.onlineStatus)}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10.5px] text-slate-400 block">ການຊຳລະ:</span>
                  <span className="font-bold text-slate-800">
                    {selectedDetailOrder.payment_method === 'transfer' ? 'ໂອນ BCEL One' : 'ເງິນສົດ (COD)'}
                  </span>
                </div>
              </div>

              {/* Customer & Contact */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase">ຂໍ້ມູນລູກຄ້າ</div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedDetailOrder.customer_name || selectedDetailOrder.customerName || 'ລູກຄ້າທົ່ວໄປ'}
                  </span>
                  {(selectedDetailOrder.customer_phone || selectedDetailOrder.customerPhone) && (
                    <a
                      href={`tel:${selectedDetailOrder.customer_phone || selectedDetailOrder.customerPhone}`}
                      className="text-teal-700 font-mono font-bold flex items-center gap-1 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200"
                    >
                      <Phone size={12} weight="bold" />
                      <span>{selectedDetailOrder.customer_phone || selectedDetailOrder.customerPhone}</span>
                    </a>
                  )}
                </div>

                {/* Address / Pickup */}
                {(selectedDetailOrder.fulfillment_type === 'pickup' || selectedDetailOrder.fulfillmentType === 'pickup') ? (
                  <div className="p-2 rounded-xl bg-teal-50/80 border border-teal-200 text-teal-900 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Buildings size={14} weight="bold" className="text-teal-700" />
                      <span>ມາຮັບເອງທີ່ຮ້ານ</span>
                    </div>
                    {(selectedDetailOrder.pickup_time || selectedDetailOrder.pickupTime) && (
                      <span className="font-black bg-white px-2 py-0.5 rounded-lg border border-teal-200 text-[11px]">
                        {selectedDetailOrder.pickup_time || selectedDetailOrder.pickupTime}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-sky-50/80 border border-sky-200 text-sky-950 space-y-1">
                    <div className="font-bold flex items-start gap-1">
                      <MapPin size={14} weight="bold" className="text-sky-600 shrink-0 mt-0.5" />
                      <span>{selectedDetailOrder.delivery_address || selectedDetailOrder.deliveryAddress}</span>
                    </div>
                  </div>
                )}

                {(selectedDetailOrder.delivery_note || selectedDetailOrder.deliveryNote) && (
                  <div className="text-[11px] text-slate-600 italic bg-white p-2 rounded-xl border border-slate-200">
                    ໝາຍເຫດ: "{selectedDetailOrder.delivery_note || selectedDetailOrder.deliveryNote}"
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase">ລາຍການສິນຄ້າ</div>
                <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                  {(selectedDetailOrder.sale_transaction_items || selectedDetailOrder.items || []).map((it, idx) => {
                    const pName = it.product_name || it.productName || it.name || 'ສິນຄ້າ';
                    const uName = it.unit_name || it.unitName || 'ອັນ';
                    const qty = Number(it.quantity) || 1;
                    const price = Number(it.unit_price || it.price || 0);
                    const lineTot = Number(it.line_total || it.lineTotal || (price * qty));
                    return (
                      <div key={idx} className="p-2.5 flex items-center justify-between bg-white">
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-slate-900">{pName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {formatKip(price)} × {qty} {uName}
                          </div>
                        </div>
                        <span className="font-mono font-black text-slate-900 shrink-0">
                          {formatKip(lineTot)}
                        </span>
                      </div>
                    );
                  })}
                  <div className="p-3 bg-slate-50 flex items-center justify-between font-bold">
                    <span>ຍອດລວມທັງໝົດ</span>
                    <span className="text-base font-black font-mono text-teal-800">
                      {formatKip(selectedDetailOrder.grand_total || selectedDetailOrder.grandTotal || selectedDetailOrder.total_lak || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const o = selectedDetailOrder;
                  setSelectedDetailOrder(null);
                  handlePrint(o);
                }}
                className="h-10 px-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Printer size={16} weight="bold" />
                <span>ພິມໃບບິນ K80</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDetailOrder(null)}
                className="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-2xs cursor-pointer"
              >
                ປິດໜ້າຕ່າງ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
