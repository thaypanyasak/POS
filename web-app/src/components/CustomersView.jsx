import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Plus,
  MagnifyingGlass,
  X,
  FileArrowDown,
  ArrowClockwise,
  Phone,
  Receipt,
  WarningCircle,
  CheckCircle,
  PencilSimple,
  Trash,
  Eye,
  HandCoins,
  MapPin,
  CalendarBlank,
} from '@phosphor-icons/react';
import { formatKip, normalizeLao } from '../utils/formatters';
import { playActionClickBeep, playSuccessBeep } from '../utils/audioFeedback';
import CustomerFormModal from './CustomerFormModal';
import CustomerDetailModal from './CustomerDetailModal';
import CustomerDebtPaymentModal from './inventory/CustomerDebtPaymentModal';
import ReceiptModal from './ReceiptModal';
import {
  fetchSavedCustomers,
  saveCustomerRecord,
  deleteCustomerRecord,
  buildCustomerDirectory,
} from '../services/customerService';

export default function CustomersView({
  transactions = [],
  products = [],
  onUpdateTransaction = null,
  onAlert = null,
}) {
  const [savedCustomers, setSavedCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDebt, setFilterDebt] = useState('all'); // 'all' | 'debt' | 'nodebt'

  // Modal States
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState(null);
  const [debtPaymentTx, setDebtPaymentTx] = useState(null);
  const [viewReceiptTx, setViewReceiptTx] = useState(null);

  // Load saved customers
  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSavedCustomers();
      setSavedCustomers(data);
    } catch (err) {
      console.debug('[CustomersView] load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Reactive Customer Directory: auto-computes stats from both saved customers and all transactions
  const customerDirectory = useMemo(() => {
    return buildCustomerDirectory(savedCustomers, transactions);
  }, [savedCustomers, transactions]);

  // Keep selected customer detail in sync with reactive directory
  const currentDetailCustomer = useMemo(() => {
    if (!selectedCustomerForDetail) return null;
    return customerDirectory.find((c) => (c.id && c.id === selectedCustomerForDetail.id) || (c.name.toLowerCase() === selectedCustomerForDetail.name.toLowerCase())) || selectedCustomerForDetail;
  }, [customerDirectory, selectedCustomerForDetail]);

  // Overall KPI Statistics
  const stats = useMemo(() => {
    let totalCust = 0;
    let debtorsCount = 0;
    let totalDebtLak = 0;
    let totalSpentLak = 0;

    customerDirectory.forEach((c) => {
      if (c.isDefault) return;
      totalCust++;
      totalSpentLak += Number(c.totalSpent || 0);
      if (Number(c.currentDebt || 0) > 0) {
        debtorsCount++;
        totalDebtLak += Number(c.currentDebt);
      }
    });

    return {
      totalCustomers: totalCust,
      debtorsCount,
      totalDebtLak,
      totalSpentLak,
    };
  }, [customerDirectory]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const normQ = normalizeLao(q);

    return customerDirectory.filter((c) => {
      // Debt filter
      if (filterDebt === 'debt' && Number(c.currentDebt || 0) <= 0) return false;
      if (filterDebt === 'nodebt' && Number(c.currentDebt || 0) > 0) return false;

      // Search filter
      if (!q) return true;
      const nameMatch = c.name?.toLowerCase().includes(q) || normalizeLao(c.name || '').includes(normQ);
      const phoneMatch = c.phone && c.phone.includes(q);
      const noteMatch = c.note && c.note.toLowerCase().includes(q);
      return nameMatch || phoneMatch || noteMatch;
    });
  }, [customerDirectory, searchTerm, filterDebt]);

  // Handle Save Customer
  const handleSaveCustomer = async (custData) => {
    try {
      const saved = await saveCustomerRecord(custData);
      await loadCustomers();
      if (onAlert) {
        onAlert(`ບັນທຶກຂໍ້ມູນລູກຄ້າ "${custData.name}" ສຳເລັດ!`, 'ສຳເລັດ', 'success');
      }
      return saved;
    } catch (err) {
      console.error('Save customer error:', err);
      if (onAlert) {
        onAlert(`ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ: ${err.message || 'ຜິດພາດ'}`, 'ຂໍ້ຜິດພາດ', 'error');
      }
      throw err;
    }
  };

  // Handle Delete Customer
  const handleDeleteCustomer = async (id) => {
    try {
      await deleteCustomerRecord(id);
      await loadCustomers();
      if (onAlert) {
        onAlert('ລຶບຂໍ້ມູນລູກຄ້າສຳເລັດ!', 'ສຳເລັດ', 'success');
      }
    } catch (err) {
      console.error('Delete customer error:', err);
      if (onAlert) {
        onAlert(`ເກີດຂໍ້ຜິດພາດໃນການລຶບ: ${err.message || 'ຜິດພາດ'}`, 'ຂໍ້ຜິດພາດ', 'error');
      }
    }
  };

  // Export to CSV / Excel
  const handleExportExcel = () => {
    playActionClickBeep();
    try {
      const headers = ['ລ/ດ', 'ຊື່ລູກຄ້າ', 'ເບີໂທ', 'ຈຳນວນບິນ', 'ຍອດຊື້ລວມ (K)', 'ໜີ້ຄ້າງຊຳລະ (K)', 'ທີ່ຢູ່', 'ໝາຍເຫດ'];
      const rows = filteredCustomers.map((c, idx) => [
        idx + 1,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.phone || '').replace(/"/g, '""')}"`,
        c.totalOrders || 0,
        c.totalSpent || 0,
        c.currentDebt || 0,
        `"${(c.address || '').replace(/"/g, '""')}"`,
        `"${(c.note || '').replace(/"/g, '""')}"`,
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `MeiiShop_Customers_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  return (
    <main
      className="flex-1 w-full max-w-full p-3 sm:p-5 md:p-6 overflow-y-auto overflow-x-hidden font-sans min-h-0 pb-4 sm:pb-6 touch-pan-y"
      style={{
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        overscrollBehaviorX: 'none',
      }}
    >
      {/* 1. Header Toolbar */}
      <div className="bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3.5 -mx-3 sm:-mx-5 md:-mx-6 -mt-3 sm:-mt-5 md:-mt-6 mb-3 sm:mb-4 flex items-center justify-between gap-2.5 sm:gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
            <Users size={20} className="sm:w-5 sm:h-5" weight="duotone" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="truncate">ຈັດການລູກຄ້າ (Customers)</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                {stats.totalCustomers}
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={loadCustomers}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            title="ໂຫຼດຂໍ້ມູນຄືນໃໝ່"
          >
            <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200/80 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="ສົ່ງອອກ Excel (CSV)"
          >
            <FileArrowDown size={16} weight="bold" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playActionClickBeep();
              setEditingCustomer(null);
              setIsFormModalOpen(true);
            }}
            className="h-8 sm:h-9 px-3 sm:px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold transition-all shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={16} weight="bold" />
            <span>+ ເພີ່ມລູກຄ້າ</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mb-3 sm:mb-4">
        {/* Card 1: Total Customers */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <Users size={22} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              ລູກຄ້າທັງໝົດ
            </div>
            <div className="text-base sm:text-xl font-black text-slate-900 font-mono">
              {stats.totalCustomers} <span className="text-xs font-normal text-slate-500">ຄົນ</span>
            </div>
          </div>
        </div>

        {/* Card 2: Debtors */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <WarningCircle size={22} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              ລູກຄ້າມີໜີ້ຄ້າງ
            </div>
            <div className="text-base sm:text-xl font-black text-amber-800 font-mono">
              {stats.debtorsCount} <span className="text-xs font-normal text-slate-500">ຄົນ</span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Outstanding Debt */}
        <div className="p-3 sm:p-4 rounded-2xl bg-rose-50/70 border border-rose-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <WarningCircle size={22} weight="bold" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-black text-rose-700 uppercase tracking-wider">
              ຍອດໜີ້ຄ້າງລວມ
            </div>
            <div className="text-base sm:text-xl font-black text-rose-700 font-mono truncate">
              {formatKip(stats.totalDebtLak)} <span className="text-xs font-normal">₭</span>
            </div>
          </div>
        </div>

        {/* Card 4: Total Lifetime Revenue */}
        <div className="p-3 sm:p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <Receipt size={22} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              ຍອດຊື້ລວມທັງໝົດ
            </div>
            <div className="text-base sm:text-xl font-black text-emerald-800 font-mono truncate">
              {formatKip(stats.totalSpentLak)} <span className="text-xs font-normal">₭</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="p-2 sm:p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs mb-3 sm:mb-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ຄົ້ນຫາຊື່ລູກຄ້າ, ເບີໂທ..."
            className="w-full h-10 pl-9 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-200 transition-all shadow-2xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-300 transition-colors cursor-pointer"
            >
              <X size={12} weight="bold" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => {
              playActionClickBeep();
              setFilterDebt('all');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterDebt === 'all'
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            ທັງໝົດ ({customerDirectory.length})
          </button>
          <button
            type="button"
            onClick={() => {
              playActionClickBeep();
              setFilterDebt('debt');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filterDebt === 'debt'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80'
            }`}
          >
            <WarningCircle size={13} weight="bold" />
            <span>ຄ້າງຊຳລະ ({stats.debtorsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playActionClickBeep();
              setFilterDebt('nodebt');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filterDebt === 'nodebt'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80'
            }`}
          >
            <CheckCircle size={13} weight="bold" />
            <span>ບໍ່ມີໜີ້</span>
          </button>
        </div>
      </div>

      {/* 4. Customer Data List: Table (Desktop) / Cards (Mobile) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* DESKTOP TABLE (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-2 sm:px-3 w-12 text-center text-slate-500 font-bold">ລ/ດ</th>
                <th className="py-3 px-4">ຊື່ລູກຄ້າ</th>
                <th className="py-3 px-4">ເບີໂທລະສັບ</th>
                <th className="py-3 px-4 text-center">ຈຳນວນບິນ</th>
                <th className="py-3 px-4 text-right">ຍອດຊື້ລວມ</th>
                <th className="py-3 px-4 text-right">ໜີ້ຄ້າງຊຳລະ</th>
                <th className="py-3 px-4 text-center">ບິນຫຼ້າສຸດ</th>
                <th className="py-3 px-4 text-right">ຈັດການ (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
              {isLoading ? (
                // 1. SKELETON TABLE ROWS (Khi đang tải dữ liệu từ Supabase)
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`cust-skel-${i}`} className="animate-pulse">
                    <td className="py-3.5 px-2 sm:px-3 text-center">
                      <div className="h-3 bg-slate-200 rounded w-5 mx-auto" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-200 shrink-0" />
                        <div className="space-y-1.5 flex-1 max-w-[140px]">
                          <div className="h-3.5 bg-slate-200 rounded w-full" />
                          <div className="h-2.5 bg-slate-100 rounded w-2/3" />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3 bg-slate-200 rounded w-24" />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="h-4 bg-slate-200 rounded-full w-12 mx-auto" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-3.5 bg-slate-200 rounded w-20 ml-auto" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-4 bg-slate-200 rounded-full w-16 ml-auto" />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="h-3 bg-slate-200 rounded w-16 mx-auto" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-7 h-7 bg-slate-200 rounded-lg" />
                        <div className="w-7 h-7 bg-slate-200 rounded-lg" />
                        <div className="w-7 h-7 bg-slate-200 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredCustomers.length === 0 ? (
                // 2. EMPTY STATE (Chỉ hiển thị khi đã load xong và thực sự không có dòng nào)
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                        <Users size={28} weight="duotone" />
                      </div>
                      <div className="text-sm font-bold text-slate-700">
                        {searchTerm || filterDebt !== 'all' ? 'ບໍ່ພົບລູກຄ້າທີ່ຄົ້ນຫາ' : 'ຍັງບໍ່ມີຂໍ້ມູນລູກຄ້າໃນຖານຂໍ້ມູນ'}
                      </div>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {searchTerm || filterDebt !== 'all'
                          ? 'ລອງປ່ຽນຄຳຄົ້ນຫາ ຫຼື ລ້າງຕົວກັ່ນຕອງ'
                          : 'ກົດປຸ່ມ "+ ເພີ່ມລູກຄ້າໃໝ່" ເພື່ອສ້າງຂໍ້ມູນລູກຄ້າຄົນທຳອິດ'}
                      </p>
                      {!searchTerm && filterDebt === 'all' && (
                        <button
                          type="button"
                          onClick={() => {
                            playActionClickBeep();
                            setEditingCustomer(null);
                            setIsFormModalOpen(true);
                          }}
                          className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Plus size={14} weight="bold" />
                          <span>+ ເພີ່ມລູກຄ້າໃໝ່</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, idx) => {
                  const hasDebt = Number(c.currentDebt || 0) > 0;
                  return (
                    <tr key={c.id || c.name} className="hover:bg-slate-50/80 transition-colors">
                      {/* STT */}
                      <td className="py-3 px-2 sm:px-3 text-center font-mono text-xs font-semibold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            c.isDefault ? 'bg-slate-100 text-slate-600' : hasDebt ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-700'
                          }`}>
                            {c.name.charAt(0) || 'C'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{c.name}</span>
                              {c.isDefault && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-200 text-slate-600">
                                  ມາດຕະຖານ
                                </span>
                              )}
                            </div>
                            {c.address && (
                              <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                                {c.address}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4  font-bold text-slate-700">
                        {c.phone || <span className="text-slate-300 font-normal">-</span>}
                      </td>

                      {/* Total Orders */}
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold ">
                          {c.totalOrders}
                        </span>
                      </td>

                      {/* Total Spent */}
                      <td className="py-3 px-4 text-right  font-bold text-emerald-800">
                        {formatKip(c.totalSpent)} ₭
                      </td>

                      {/* Remaining Debt */}
                      <td className="py-3 px-4 text-right">
                        {hasDebt ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                            {formatKip(c.currentDebt)} ₭
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold text-[11px] flex items-center justify-end gap-1">
                            <CheckCircle size={13} weight="bold" />
                            <span>ຈ່າຍຄົບ</span>
                          </span>
                        )}
                      </td>

                      {/* Last Order Date */}
                      <td className="py-3 px-4 text-center text-slate-400 text-[11px]">
                        {c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('lo-LA') : '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              playActionClickBeep();
                              setSelectedCustomerForDetail(c);
                            }}
                            className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors cursor-pointer"
                            title="ເບິ່ງລາຍລະອຽດ & ໃບບິນ"
                          >
                            <Eye size={16} weight="bold" />
                          </button>

                          {!c.isDefault && (
                            <button
                              type="button"
                              onClick={() => {
                                playActionClickBeep();
                                setEditingCustomer(c);
                                setIsFormModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                              title="ແກ້ໄຂ"
                            >
                              <PencilSimple size={15} />
                            </button>
                          )}

                          {!c.isDefault && (
                            <button
                              type="button"
                              onClick={() => {
                                playActionClickBeep();
                                if (confirm(`ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບລູກຄ້າ "${c.name}"?`)) {
                                  handleDeleteCustomer(c.id);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                              title="ລຶບ"
                            >
                              <Trash size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS (< 768px) */}
        <div className="md:hidden divide-y divide-slate-100">
          {isLoading ? (
            // 1. SKELETON MOBILE CARDS (Khi đang tải dữ liệu)
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`cust-mob-skel-${i}`} className="p-3.5 space-y-2.5 animate-pulse">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-200 shrink-0" />
                      <div className="space-y-1">
                        <div className="h-3.5 bg-slate-200 rounded w-28" />
                        <div className="h-2.5 bg-slate-100 rounded w-20" />
                      </div>
                    </div>
                    <div className="h-4 bg-slate-200 rounded-full w-16" />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="h-3 bg-slate-200 rounded w-24" />
                    <div className="flex gap-1.5">
                      <div className="w-7 h-7 bg-slate-200 rounded-lg" />
                      <div className="w-7 h-7 bg-slate-200 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCustomers.length === 0 ? (
            // 2. EMPTY STATE
            <div className="py-14 px-4 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <Users size={24} weight="duotone" />
              </div>
              <div className="text-xs font-bold text-slate-700">
                {searchTerm || filterDebt !== 'all' ? 'ບໍ່ພົບລູກຄ້າທີ່ຄົ້ນຫາ' : 'ຍັງບໍ່ມີຂໍ້ມູນລູກຄ້າໃນຖານຂໍ້ມູນ'}
              </div>
              <p className="text-[11px] text-slate-400 max-w-xs">
                {searchTerm || filterDebt !== 'all'
                  ? 'ລອງປ່ຽນຄຳຄົ້ນຫາ ຫຼື ລ້າງຕົວກັ່ນຕອງ'
                  : 'ກົດປຸ່ມ "+ ເພີ່ມລູກຄ້າໃໝ່" ເພື່ອສ້າງຂໍ້ມູນລູກຄ້າ'}
              </p>
              {!searchTerm && filterDebt === 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    playActionClickBeep();
                    setEditingCustomer(null);
                    setIsFormModalOpen(true);
                  }}
                  className="mt-2 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={13} weight="bold" />
                  <span>+ ເພີ່ມລູກຄ້າໃໝ່</span>
                </button>
              )}
            </div>
          ) : (
            filteredCustomers.map((c, idx) => {
              const hasDebt = Number(c.currentDebt || 0) > 0;
              return (
                <div key={c.id || c.name} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                        #{idx + 1}
                      </span>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        c.isDefault ? 'bg-slate-100 text-slate-600' : hasDebt ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-700'
                      }`}>
                        {c.name.charAt(0) || 'C'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {c.name}
                        </div>
                        {c.phone && (
                          <div className="text-[11px] font-mono text-slate-500 font-bold flex items-center gap-1">
                            <Phone size={10} />
                            <span>{c.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {hasDebt ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 font-mono shrink-0">
                        ຄ້າງ {formatKip(c.currentDebt)} ₭
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5 shrink-0">
                        <CheckCircle size={10} weight="bold" />
                        <span>ຈ່າຍຄົບ</span>
                      </span>
                    )}
                  </div>

                  {/* Summary Line */}
                  <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <Receipt size={13} className="text-slate-400" />
                      <span>{c.totalOrders} ບິນ</span>
                      <span>•</span>
                      <span className="font-mono font-bold text-emerald-800">
                        {formatKip(c.totalSpent)} ₭
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          playActionClickBeep();
                          setSelectedCustomerForDetail(c);
                        }}
                        className="px-2 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={13} weight="bold" />
                        <span>ເບິ່ງບິນ</span>
                      </button>

                      {!c.isDefault && (
                        <button
                          type="button"
                          onClick={() => {
                            playActionClickBeep();
                            setEditingCustomer(c);
                            setIsFormModalOpen(true);
                          }}
                          className="p-1 rounded-lg bg-slate-100 text-slate-600"
                        >
                          <PencilSimple size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal 1: Customer Form Modal (Add / Edit) */}
      <CustomerFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingCustomer(null);
        }}
        customer={editingCustomer}
        onSave={handleSaveCustomer}
        onDelete={handleDeleteCustomer}
      />

      {/* Modal 2: Customer Detail Modal (Invoice history, debt list, quick payment) */}
      <CustomerDetailModal
        isOpen={Boolean(currentDetailCustomer)}
        onClose={() => setSelectedCustomerForDetail(null)}
        customer={currentDetailCustomer}
        onViewReceipt={(tx) => setViewReceiptTx(tx)}
        onPayDebt={(tx) => setDebtPaymentTx(tx)}
      />

      {/* Modal 3: Quick Customer Debt Payment Modal */}
      {debtPaymentTx && (
        <CustomerDebtPaymentModal
          isOpen={Boolean(debtPaymentTx)}
          onClose={() => setDebtPaymentTx(null)}
          transaction={debtPaymentTx}
          onPaymentSuccess={(updatedTx) => {
            if (onUpdateTransaction) {
              onUpdateTransaction(updatedTx);
            }
            setDebtPaymentTx(null);
            if (onAlert) {
              onAlert(
                `ຊຳລະໜີ້ສຳເລັດສຳລັບບິນ #${updatedTx.receiptNumber || updatedTx.id}!`,
                'ສຳເລັດ',
                'success'
              );
            }
          }}
        />
      )}

      {/* Modal 4: Full Receipt Modal */}
      {viewReceiptTx && (
        <ReceiptModal
          isOpen={Boolean(viewReceiptTx)}
          onClose={() => setViewReceiptTx(null)}
          receipt={viewReceiptTx}
          products={products}
          onAlert={onAlert}
        />
      )}
    </main>
  );
}

