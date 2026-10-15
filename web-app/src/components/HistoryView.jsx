import React, { useState, useMemo } from 'react';
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
  X
} from '@phosphor-icons/react';
import { formatKip } from '../utils/formatters';

export default function HistoryView({
  transactions,
  onOpenReceipt,
  onCancelTransaction,
  onDeleteTransaction,
  onUpdateTransaction,
  onRefreshTransactions,
  isLoading,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'valid' | 'cancelled'
  const [editingTx, setEditingTx] = useState(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('cash');

  const validCount = transactions.filter((t) => t.status !== 'cancelled' && !t.isCancelled).length;
  const cancelledCount = transactions.filter((t) => t.status === 'cancelled' || t.isCancelled).length;

  const filteredTransactions = useMemo(() => {
    let list = transactions;

    if (statusFilter === 'valid') {
      list = list.filter((t) => t.status !== 'cancelled' && !t.isCancelled);
    } else if (statusFilter === 'cancelled') {
      list = list.filter((t) => t.status === 'cancelled' || t.isCancelled);
    }

    const q = searchTerm.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (tx) =>
        (tx.receiptNumber && tx.receiptNumber.toLowerCase().includes(q)) ||
        (tx.customerName && tx.customerName.toLowerCase().includes(q)) ||
        (tx.paymentMethod && tx.paymentMethod.toLowerCase().includes(q)) ||
        (tx.status && tx.status.toLowerCase().includes(q))
    );
  }, [transactions, searchTerm, statusFilter]);

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
      className="flex-1 w-full p-4 sm:p-6 overflow-y-auto font-sans min-h-0 pb-20 sm:pb-24 touch-pan-y"
      style={{
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        paddingBottom: 'max(5rem, calc(4rem + env(safe-area-inset-bottom, 0px)))',
      }}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 mb-5 gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ClockCounterClockwise size={24} className="text-teal-600" weight="fill" />
            <span>ປະຫວັດບິນຂາຍ ({transactions.length} ບິນ)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ຈັດການບິນຂາຍ: ເບິ່ງບິນ, ຍົກເລີກບິນ & ຄືນສະຕັອກສິນຄ້າອັດຕະໂນມັດ, ແກ້ໄຂຂໍ້ມູນ (ເຊື່ອມຕໍ່ Supabase)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh from Database button */}
          <button
            type="button"
            onClick={onRefreshTransactions}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            title="ໂຫຼດຂໍ້ມູນຄືນຈາກ Supabase"
          >
            <ArrowClockwise size={14} className={isLoading ? 'animate-spin' : ''} weight="bold" />
            <span>ໂຫຼດຄືນ</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {/* Quick Status Filter Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ທັງໝົດ ({transactions.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('valid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'valid'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ສຳເລັດ ({validCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('cancelled')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'cancelled'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              ຍົກເລີກແລ້ວ ({cancelledCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-72">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ຄົ້ນຫາເລກທີບິນ ຫຼື ຊື່ລູກຄ້າ..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium shrink-0">
            ພົບ <strong className="text-slate-800">{filteredTransactions.length}</strong> ບິນ
          </div>
        </div>
      </div>

      {/* 1. MOBILE VIEW (< 768px): Touch-Optimized Receipt Card List */}
      <div className="md:hidden flex flex-col gap-3 pb-24">
        {filteredTransactions.map((tx) => {
          const isCancelled = tx.status === 'cancelled' || tx.isCancelled;

          return (
            <div
              key={tx.id}
              className={`p-3.5 bg-white rounded-2xl border transition-all shadow-xs flex flex-col gap-3 ${
                isCancelled ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'
              }`}
            >
              {/* Top Row: Receipt #, Status Chip & Date */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-black font-mono text-sm ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {tx.receiptNumber}
                  </span>
                  {isCancelled && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300">
                      ຍົກເລີກແລ້ວ
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500 font-medium">
                    {new Date(tx.createdAt).toLocaleDateString('lo-LA')} {new Date(tx.createdAt).toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {isCancelled && tx.cancelledAt && (
                    <div className="text-[9.5px] text-rose-600 font-bold">
                      (ຍົກເລີກ: {new Date(tx.cancelledAt).toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })})
                    </div>
                  )}
                </div>
              </div>

              {/* Middle Row: Customer Name, Payment Method, Total */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[10.5px] text-slate-400 block font-medium">ລູກຄ້າ:</span>
                  <span className="text-xs font-bold text-slate-900">
                    {tx.customerName || 'ລູກຄ້າທົ່ວໄປ'}
                  </span>
                  <div className="mt-1">
                    {isCancelled ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                        <Prohibit size={11} weight="bold" />
                        <span>ຍົກເລີກບິນ</span>
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 ${
                          tx.paymentMethod === 'cash'
                            ? 'bg-teal-50 text-teal-800 border border-teal-200'
                            : tx.paymentMethod === 'debt'
                            ? (Number(tx.paidAmount || 0) === 0
                                ? 'bg-red-50 text-red-700 border border-red-300 font-black'
                                : 'bg-amber-50 text-amber-900 border border-amber-300 font-bold')
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {tx.paymentMethod === 'cash'
                          ? 'ເງິນສົດ'
                          : (tx.paymentMethod === 'qrTransfer' || tx.paymentMethod === 'onepay' || tx.paymentMethod === 'transfer')
                          ? 'QR ໂອນ'
                          : tx.paymentMethod === 'debt'
                          ? (Number(tx.paidAmount || 0) === 0
                              ? 'ຄ້າງຊຳລະ 100%'
                              : `ຄ້າງ ${formatKip(tx.debtAmount ?? Math.max(0, tx.grandTotal - (tx.paidAmount || 0)))}`)
                          : 'ໂອນເງິນ'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10.5px] text-slate-400 block font-medium">ຍອດເງິນ:</span>
                  {isCancelled ? (
                    <div>
                      <span className="line-through text-slate-400 text-xs font-mono font-bold">
                        {formatKip(tx.grandTotal)}
                      </span>
                      <span className="block text-[10.5px] text-rose-600 font-black font-mono">
                        (0 ₭)
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm font-black text-teal-700 font-mono">
                      {formatKip(tx.grandTotal)}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Row: Actions (Min 44px Touch Targets) */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onOpenReceipt(tx)}
                  className="flex-1 min-h-[44px] py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                >
                  <Printer size={16} weight="bold" />
                  <span>ເບິ່ງ / ພິມບິນ</span>
                </button>

                {isCancelled ? (
                  <span className="px-3 py-2 min-h-[44px] rounded-xl bg-rose-50 text-rose-500 border border-rose-200 text-xs font-black inline-flex items-center gap-1 select-none">
                    <Prohibit size={15} weight="bold" />
                    <span>ຍົກເລີກແລ້ວ</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCancelTransaction && onCancelTransaction(tx)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 text-xs font-black inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                  >
                    <Prohibit size={15} weight="bold" />
                    <span>ຍົກເລີກບິນ</span>
                  </button>
                )}

                {!isCancelled && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(tx)}
                    className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0"
                    title="ແກ້ໄຂ"
                  >
                    <PencilSimple size={18} weight="bold" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onDeleteTransaction && onDeleteTransaction(tx)}
                  className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0"
                  title="ລຶບ"
                >
                  <Trash size={18} weight="bold" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. TABLET & DESKTOP VIEW (>= 768px): Horizontal Scroll Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto overscroll-x-contain touch-pan-y mb-10">
        <table className="w-full min-w-[760px] text-left text-xs border-collapse">
          <thead>
            <tr className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200 text-slate-700 font-extrabold">
              <th className="py-3 px-4">ເລກທີບິນ</th>
              <th className="py-3 px-3">ວັນທີ & ເວລາ</th>
              <th className="py-3 px-3">ຊື່ລູກຄ້າ</th>
              <th className="py-3 px-3">ຮູບແບບຊຳລະ / ສະຖານະ</th>
              <th className="py-3 px-3 text-right">ຍອດຊຳລະ (₭)</th>
              <th className="py-3 px-4 text-center">ຈັດການບິນ (Actions)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTransactions.map((tx) => {
              const isCancelled = tx.status === 'cancelled' || tx.isCancelled;

              return (
                <tr
                  key={tx.id}
                  className={`transition-colors ${
                    isCancelled
                      ? 'bg-rose-50/30 hover:bg-rose-50/60 text-slate-500'
                      : 'hover:bg-slate-50/80 text-slate-900'
                  }`}
                >
                  <td className="py-3 px-4 font-black font-mono">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}>
                        {tx.receiptNumber}
                      </span>
                      {isCancelled && (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-rose-100 text-rose-700 border border-rose-300">
                          ຍົກເລີກແລ້ວ
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-medium">
                    <div>{new Date(tx.createdAt).toLocaleString('lo-LA')}</div>
                    {isCancelled && tx.cancelledAt && (
                      <div className="text-[10px] text-rose-600 font-bold">
                        (ຍົກເລີກ: {new Date(tx.cancelledAt).toLocaleTimeString('lo-LA')})
                      </div>
                    )}
                  </td>
                  <td className={`py-3 px-3 font-bold ${isCancelled ? 'text-slate-500' : 'text-slate-800'}`}>
                    {tx.customerName || 'ລູກຄ້າທົ່ວໄປ'}
                  </td>
                  <td className="py-3 px-3">
                    {isCancelled ? (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                        <Prohibit size={12} weight="bold" />
                        <span>ຍົກເລີກບິນ (Void)</span>
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold inline-flex items-center gap-1 ${
                          tx.paymentMethod === 'cash'
                            ? 'bg-teal-50 text-teal-800 border border-teal-200'
                            : tx.paymentMethod === 'debt'
                            ? (Number(tx.paidAmount || 0) === 0
                                ? 'bg-red-50 text-red-700 border border-red-300 font-black'
                                : 'bg-amber-50 text-amber-900 border border-amber-300 font-bold')
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {tx.paymentMethod === 'cash'
                          ? 'ເງິນສົດ'
                          : (tx.paymentMethod === 'qrTransfer' || tx.paymentMethod === 'onepay' || tx.paymentMethod === 'transfer')
                          ? 'QR ໂອນ'
                          : tx.paymentMethod === 'debt'
                          ? (Number(tx.paidAmount || 0) === 0
                              ? 'ຄ້າງຊຳລະ 100%'
                              : `ຄ້າງຊຳລະ (ຄ້າງ ${formatKip(tx.debtAmount ?? Math.max(0, tx.grandTotal - (tx.paidAmount || 0)))})`)
                          : 'ໂອນເງິນ'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-black font-mono">
                    {isCancelled ? (
                      <div>
                        <span className="line-through text-slate-400 text-xs">
                          {formatKip(tx.grandTotal)}
                        </span>
                        <span className="block text-[9.5px] text-rose-600 font-bold">
                          (ຫັກອອກ 0 ₭)
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-900 text-xs">
                        {formatKip(tx.grandTotal)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* View/Print Receipt */}
                      <button
                        type="button"
                        onClick={() => onOpenReceipt(tx)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                        title="ເບິ່ງ ແລະ ພິມໃບບິນ"
                      >
                        <Printer size={13} />
                        <span>ເບິ່ງບິນ</span>
                      </button>

                      {/* Cancel / Void Button */}
                      {isCancelled ? (
                        <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-500 border border-rose-200 text-[10.5px] font-black inline-flex items-center gap-1 select-none">
                          <Prohibit size={12} weight="bold" />
                          <span>ຍົກເລີກແລ້ວ</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onCancelTransaction && onCancelTransaction(tx)}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 hover:border-rose-600 text-[11px] font-black inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-2xs"
                          title="ຍົກເລີກບິນ & ຄືນສະຕັອກສິນຄ້າເຂົ້າສາງ"
                        >
                          <Prohibit size={13} weight="bold" />
                          <span>ຍົກເລີກບິນ</span>
                        </button>
                      )}

                      {/* Edit Transaction */}
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(tx)}
                          className="p-1 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-all cursor-pointer"
                          title="ແກ້ໄຂຂໍ້ມູນບິນ (Edit)"
                        >
                          <PencilSimple size={15} />
                        </button>
                      )}

                      {/* Delete Transaction Permanently */}
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction && onDeleteTransaction(tx)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                        title="ລຶບຖາວອນ (Delete)"
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

        {filteredTransactions.length === 0 && (
          <div className="py-24 text-center text-slate-400">
            <Receipt size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold">ຍັງບໍ່ມີປະຫວັດບິນຂາຍ</p>
          </div>
        )}
      </div>

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <PencilSimple size={18} className="text-teal-600" weight="bold" />
                <span>ແກ້ໄຂບິນ: {editingTx.receiptNumber}</span>
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
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editPaymentMethod === 'cash'
                        ? 'bg-teal-50 border-teal-500 text-teal-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    💵 ເງິນສົດ (Cash)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPaymentMethod('onepay')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editPaymentMethod !== 'cash'
                        ? 'bg-red-50 border-red-500 text-red-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    📱 QR ໂອນ (BCEL One)
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
                  <span>ບັນທຶກລົງ Supabase</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
