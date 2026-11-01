import React, { useState, useMemo } from 'react';
import {
  X,
  User,
  Phone,
  Receipt,
  CurrencyCircleDollar,
  WarningCircle,
  CheckCircle,
  CalendarBlank,
  CreditCard,
  Eye,
  HandCoins,
} from '@phosphor-icons/react';
import { formatKip, getDueDateStatus } from '../utils/formatters';
import { playActionClickBeep } from '../utils/audioFeedback';

export default function CustomerDetailModal({
  isOpen,
  onClose,
  customer,
  onViewReceipt,
  onPayDebt,
}) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'debt'

  if (!isOpen || !customer) return null;

  const invoices = customer.invoices || [];
  const debtInvoices = invoices.filter((tx) => tx.computedIsDebt || (tx.computedRemainingDebt > 0));

  const displayedInvoices = activeTab === 'debt' ? debtInvoices : invoices;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs text-lg font-black">
              {customer.name?.charAt(0) || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-slate-800">
                  {customer.name}
                </h3>
                {customer.isDefault && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                    ມາດຕະຖານ
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                {customer.phone && (
                  <span className="flex items-center gap-1 font-mono text-slate-700 font-bold">
                    <Phone size={13} className="text-slate-400" />
                    <span>{customer.phone}</span>
                  </span>
                )}
                {customer.address && (
                  <span className="truncate max-w-[220px]">
                    {customer.address}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* 3 Summary KPI Cards */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
          {/* Card 1: Total Orders */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Receipt size={14} className="text-teal-600" />
              <span>ຈຳນວນບິນ</span>
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 font-mono">
              {customer.totalOrders} <span className="text-xs font-normal text-slate-500">ບິນ</span>
            </div>
          </div>

          {/* Card 2: Total Spent */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
              <CurrencyCircleDollar size={14} className="text-emerald-600" />
              <span>ຍອດຊື້ລວມ</span>
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-700 font-mono">
              {formatKip(customer.totalSpent)} <span className="text-xs font-normal text-slate-500">₭</span>
            </div>
          </div>

          {/* Card 3: Current Debt */}
          <div className={`p-3 rounded-xl border shadow-2xs ${
            customer.currentDebt > 0 ? 'bg-rose-50/80 border-rose-200 text-rose-800' : 'bg-white border-slate-200 text-slate-700'
          }`}>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-1">
              {customer.currentDebt > 0 ? (
                <WarningCircle size={14} className="text-rose-600" weight="bold" />
              ) : (
                <CheckCircle size={14} className="text-emerald-600" weight="bold" />
              )}
              <span className={customer.currentDebt > 0 ? 'text-rose-700 font-black' : 'text-slate-500'}>
                ໜີ້ຄ້າງຊຳລະ
              </span>
            </div>
            <div className={`text-base sm:text-lg font-black font-mono ${customer.currentDebt > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
              {formatKip(customer.currentDebt)} <span className="text-xs font-normal opacity-70">₭</span>
            </div>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="px-4 pt-3 pb-2 bg-white flex items-center justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                playActionClickBeep();
                setActiveTab('all');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ບິນທັງໝົດ ({invoices.length})
            </button>
            <button
              type="button"
              onClick={() => {
                playActionClickBeep();
                setActiveTab('debt');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'debt'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : debtInvoices.length > 0
                  ? 'text-rose-600 hover:text-rose-700'
                  : 'text-slate-400'
              }`}
            >
              <span>ບິນຕິດໜີ້</span>
              {debtInvoices.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeTab === 'debt' ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {debtInvoices.length}
                </span>
              )}
            </button>
          </div>

          <span className="text-xs text-slate-400 font-medium">
            ສະແດງ {displayedInvoices.length} ລາຍການ
          </span>
        </div>

        {/* Invoices List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-0 bg-slate-50/50">
          {displayedInvoices.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Receipt size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-bold text-slate-600">
                {activeTab === 'debt' ? 'ລູກຄ້ານີ້ບໍ່ມີໜີ້ຄ້າງຊຳລະ' : 'ຍັງບໍ່ມີປະຫວັດການສັ່ງຊື້'}
              </p>
            </div>
          ) : (
            displayedInvoices.map((tx) => {
              const txId = tx.receiptNumber || tx.id;
              const grandTotal = Number(tx.grandTotal ?? tx.finalTotalKip ?? tx.totalLak ?? 0);
              const paid = Number(tx.paidAmount ?? tx.amountTendered ?? 0);
              const debt = Number(tx.computedRemainingDebt ?? 0);
              const hasDebt = debt > 0;
              const dueInfo = tx.debtDueDate || tx.debt_due_date ? getDueDateStatus(tx.debtDueDate || tx.debt_due_date) : null;

              return (
                <div
                  key={tx.id}
                  className={`p-3.5 rounded-2xl bg-white border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
                    hasDebt ? 'border-amber-200 ring-1 ring-amber-100' : 'border-slate-200'
                  }`}
                >
                  {/* Left: Info */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs sm:text-sm text-slate-900">
                        {txId}
                      </span>
                      {hasDebt ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                          {paid > 0 ? 'ຕິດໜີ້ບາງສ່ວນ' : 'ຕິດໜີ້ 100%'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                          <CheckCircle size={11} weight="bold" />
                          <span>ຈ່າຍຄົບແລ້ວ</span>
                        </span>
                      )}

                      {/* Due date chip */}
                      {dueInfo && hasDebt && (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] ${dueInfo.badgeClass}`}
                          title={`ກຳນົດຊຳລະ: ${dueInfo.formattedDate}`}
                        >
                          <CalendarBlank size={12} weight="bold" />
                          <span>ກຳນົດ: {dueInfo.label}</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>{new Date(tx.createdAt || tx.created_at).toLocaleString('lo-LA')}</span>
                      <span>•</span>
                      <span className="font-medium text-slate-600">
                        ຮູບແບບ: {tx.paymentMethod === 'debt' ? 'ຕິດໜີ້' : tx.paymentMethod === 'transfer' ? 'ໂອນເງິນ' : 'ເງິນສົດ'}
                      </span>
                    </div>

                    {tx.debtNote && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded-md border border-amber-200/80 inline-block">
                        ໝາຍເຫດ: {tx.debtNote}
                      </div>
                    )}
                  </div>

                  {/* Right: Amounts & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-right">
                      <div className="text-xs text-slate-400 font-medium">ຍອດລວມ:</div>
                      <div className="text-sm font-black text-slate-900 font-mono">
                        {formatKip(grandTotal)} ₭
                      </div>
                      {hasDebt ? (
                        <div className="text-[11px] font-bold text-rose-600 font-mono flex items-center justify-end gap-1.5 mt-0.5">
                          {paid > 0 && (
                            <span className="text-emerald-600 text-[10.5px]">
                              ຈ່າຍ: {formatKip(paid)} ₭
                            </span>
                          )}
                          <span>ຄ້າງ: {formatKip(debt)} ₭</span>
                        </div>
                      ) : (
                        <div className="text-[10px] font-bold text-emerald-600 mt-0.5">
                          ຈ່າຍຄົບແລ້ວ
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasDebt && onPayDebt && (
                        <button
                          type="button"
                          onClick={() => {
                            playActionClickBeep();
                            onPayDebt(tx);
                          }}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shadow-xs cursor-pointer"
                          title="ຊຳລະໜີ້"
                        >
                          <HandCoins size={14} weight="bold" />
                          <span>ຊຳລະໜີ້</span>
                        </button>
                      )}

                      {onViewReceipt && (
                        <button
                          type="button"
                          onClick={() => {
                            playActionClickBeep();
                            onViewReceipt(tx);
                          }}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                          title="ເບິ່ງໃບບິນ"
                        >
                          <Eye size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            ປິດໜ້າຕ່າງ
          </button>
        </div>
      </div>
    </div>
  );
}

