import React, { useState } from 'react';
import {
  Package,
  Plus,
  Truck,
  Receipt,
  CurrencyCircleDollar,
  MagnifyingGlass,
  CheckCircle,
  Clock,
  WarningCircle,
  Eye,
  HandCoins,
  ArrowClockwise,
  X,
} from '@phosphor-icons/react';
import { formatKip, formatDots, parseDots, formatThb } from '../../utils/formatters';
import { addSupplierDebtPaymentInSupabase } from '../../services/supabase';

export default function PurchasesView({
  purchaseOrders = [],
  suppliers = [],
  products = [],
  onOpenNewGRN,
  onOpenSupplierManager,
  onRefresh,
  isLoading,
  onAlert,
}) {
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL', 'PAID', 'PARTIAL', 'DEBT'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPoForDetails, setSelectedPoForDetails] = useState(null);
  const [payingPo, setPayingPo] = useState(null);
  const [repayAmount, setRepayAmount] = useState('0');
  const [repayMethod, setRepayMethod] = useState('CASH');
  const [repayNote, setRepayNote] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Filtered list
  const filteredOrders = purchaseOrders.filter((po) => {
    if (filterStatus !== 'ALL' && po.payment_status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = (po.id || '').toLowerCase().includes(q);
      const matchSupplier = (po.suppliers?.name || '').toLowerCase().includes(q);
      const matchReceived = (po.received_by || '').toLowerCase().includes(q);
      return matchId || matchSupplier || matchReceived;
    }
    return true;
  });

  const handleOpenRepayModal = (po) => {
    setPayingPo(po);
    setRepayAmount(formatDots(po.debt_amount || 0));
    setRepayMethod('CASH');
    setRepayNote('');
  };

  const handleConfirmDebtPayment = async (e) => {
    e.preventDefault();
    if (!payingPo) return;

    const amt = parseDots(repayAmount);
    if (amt <= 0) {
      onAlert?.('ກະລຸນາປ້ອນຈຳນວນເງິນທີ່ຕ້ອງການຈ່າຍ (> 0)', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await addSupplierDebtPaymentInSupabase(
        payingPo.id,
        amt,
        payingPo.primary_currency || 'LAK',
        repayMethod,
        repayNote
      );

      if (res.success) {
        onAlert?.('ບັນທຶກການຊຳລະໜີ້ສຳເລັດແລ້ວ!', 'ສຳເລັດ', 'success');
        setPayingPo(null);
        onRefresh?.();
      } else {
        onAlert?.(res.error || 'ເກີດຂໍ້ຜິດພາດ', 'ຂໍ້ຜິດພາດ', 'error');
      }
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
              <Package size={20} weight="duotone" />
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              ຈັດການນຳເຂົ້າສິນຄ້າ & ໜີ້ສິນຜູ້ສະໜອງ (GRN & AP)
            </h2>
          </div>
          <p className="text-[11.5px] text-slate-500 mt-0.5">
            ບັນທຶກຮັບສິນຄ້າເຂົ້າສາງ, ປັບຕົ້ນທຶນບາດ-ກີບ ແລະ ຕິດຕາມໜີ້ຄ້າງຊຳລະຜູ້ສະໜອງ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            title="ໂຫຼດຂໍ້ມູນໃໝ່"
          >
            <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">ຣີເຟຣຊ</span>
          </button>

          <button
            type="button"
            onClick={onOpenSupplierManager}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200"
          >
            <Truck size={16} />
            <span>ຈັດການຜູ້ສະໜອງ ({suppliers.length})</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewGRN}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold shadow-sm shadow-teal-600/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={16} weight="bold" />
            <span>ຮັບສິນຄ້າເຂົ້າສາງ (+)</span>
          </button>
        </div>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'ALL', label: 'ທັງໝົດ', count: purchaseOrders.length },
            { id: 'PAID', label: 'ຈ່າຍຄົບ (PAID)', count: purchaseOrders.filter((p) => p.payment_status === 'PAID').length },
            { id: 'PARTIAL', label: 'ຈ່າຍບາງສ່ວນ (PARTIAL)', count: purchaseOrders.filter((p) => p.payment_status === 'PARTIAL').length },
            { id: 'DEBT', label: 'ຕິດໜີ້ (DEBT)', count: purchaseOrders.filter((p) => p.payment_status === 'DEBT').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterStatus === tab.id
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="ຄົ້ນຫາເລກທີບິນ, ຜູ້ສະໜອງ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-teal-500 shadow-2xs"
          />
          <MagnifyingGlass
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
      </div>

      {/* Data Table Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filteredOrders.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-dashed border-slate-200">
            <Package size={40} className="text-slate-300 mb-2" weight="duotone" />
            <p className="text-xs font-bold text-slate-500">ບໍ່ພົບລາຍການຮັບສິນຄ້າເຂົ້າສາງ</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ກົດປຸ່ມ "ຮັບສິນຄ້າເຂົ້າສາງ (+)" ເພື່ອສ້າງໃບຮັບເຂົ້າໃໝ່
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-4">ເລກທີໃບຮັບ / ວັນທີ</th>
                    <th className="py-2.5 px-4">ແຫຼ່ງສະໜອງສິນຄ້າ</th>
                    <th className="py-2.5 px-4 text-center">ຈຳນວນລາຍການ</th>
                    <th className="py-2.5 px-4 text-right">ຕົ້ນທຶນລວມ ₭ (LAK)</th>
                    <th className="py-2.5 px-4 text-right">ຕົ້ນທຶນລວມ ฿ (THB)</th>
                    <th className="py-2.5 px-4 text-center">ສະຖານະຊຳລະ</th>
                    <th className="py-2.5 px-4 text-right">ໜີ້ຄ້າງຊຳລະ</th>
                    <th className="py-2.5 px-4 text-center">ຈັດການ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredOrders.map((po) => {
                    const dateFormatted = new Date(po.created_at).toLocaleString('lo-LA');
                    const itemsCount = po.purchase_order_items?.length || 0;
                    const debt = Number(po.debt_amount) || 0;

                    return (
                      <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          <div>{po.id}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{dateFormatted}</div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-800">
                            {po.suppliers?.name || 'ບໍ່ລະບຸຜູ້ສະໜອງ'}
                          </span>
                          {po.received_by && (
                            <div className="text-[10.5px] text-slate-500">
                              ຜູ້ຮັບ: {po.received_by}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center font-bold">
                          {itemsCount} ລາຍການ
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatKip(po.total_cost_lak)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                          {Number(po.total_cost_thb) > 0 ? `${formatThb(po.total_cost_thb)} ฿` : '-'}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {po.payment_status === 'PAID' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ຈ່າຍຄົບແລ້ວ
                            </span>
                          )}
                          {po.payment_status === 'PARTIAL' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              ຈ່າຍບາງສ່ວນ
                            </span>
                          )}
                          {po.payment_status === 'DEBT' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              ຕິດໜີ້ 100%
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {debt > 0 ? (
                            <span className="text-rose-600">
                              {formatDots(debt)} {po.primary_currency || 'LAK'}
                            </span>
                          ) : (
                            <span className="text-emerald-700">0 ₭</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedPoForDetails(po)}
                              className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors"
                              title="ເບິ່ງລາຍລະອຽດ"
                            >
                              <Eye size={16} />
                            </button>
                            {debt > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenRepayModal(po)}
                                className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 border border-teal-200"
                                title="ຊຳລະໜີ້ເພີ່ມ"
                              >
                                <HandCoins size={14} />
                                <span>ຈ່າຍໜີ້</span>
                              </button>
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
        )}
      </div>

      {/* MODAL 1: PO Details Viewer */}
      {selectedPoForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-3.5 max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  ໃບຮັບສິນຄ້າ: {selectedPoForDetails.id}
                </h3>
                <p className="text-xs text-slate-500">
                  {new Date(selectedPoForDetails.created_at).toLocaleString('lo-LA')} • ຜູ້ຮັບ: {selectedPoForDetails.received_by || '-'}
                </p>
              </div>
              <button
                onClick={() => setSelectedPoForDetails(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
              {/* Supplier info card */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">ແຫຼ່ງສະໜອງ</span>
                  <span className="font-bold text-xs text-slate-800">
                    {selectedPoForDetails.suppliers?.name || 'ບໍ່ລະບຸຜູ້ສະໜອງ'}
                  </span>
                  {selectedPoForDetails.suppliers?.phone && (
                    <span className="text-xs text-slate-500 font-mono ml-2">
                      ({selectedPoForDetails.suppliers.phone})
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase text-right">ສະຖານະ</span>
                  <span className="text-xs font-bold text-slate-700 font-mono">
                    {selectedPoForDetails.payment_status}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <span className="text-xs font-bold text-slate-800 block mb-1.5">
                  ລາຍການສິນຄ້າຮັບເຂົ້າສາງ
                </span>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">ສິນຄ້າ</th>
                        <th className="py-2 px-3 text-center">ຈຳນວນຮັບ</th>
                        <th className="py-2 px-3 text-right">ຕົ້ນທຶນ ₭</th>
                        <th className="py-2 px-3 text-right">ຕົ້ນທຶນ ฿</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedPoForDetails.purchase_order_items || []).map((it) => (
                        <tr key={it.id}>
                          <td className="py-2 px-3 font-bold text-slate-900">{it.product_name}</td>
                          <td className="py-2 px-3 text-center font-mono">
                            {it.imported_base_units} Base Units
                            <div className="text-[10px] text-slate-400">
                              ({it.tier1_qty} ລັງ, {it.tier2_qty} ແພັກ, {it.tier3_qty} ອັນ)
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                            {formatDots(it.cost_lak)} ₭
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            {Number(it.cost_thb) > 0 ? `${formatThb(it.cost_thb)} ฿` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Debt payment history */}
              {selectedPoForDetails.supplier_debt_payments &&
                selectedPoForDetails.supplier_debt_payments.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-800 block mb-1.5">
                      ປະຫວັດການຊຳລະເງິນ (Payment Logs)
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {selectedPoForDetails.supplier_debt_payments.map((p) => (
                        <div
                          key={p.id}
                          className="p-2 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-emerald-900">
                              {new Date(p.created_at).toLocaleString('lo-LA')}
                            </span>
                            <span className="text-emerald-700 ml-2">({p.payment_method})</span>
                            {p.note && <div className="text-[10.5px] text-emerald-600 italic">* {p.note}</div>}
                          </div>
                          <span className="font-mono font-black text-emerald-800">
                            +{formatDots(p.payment_amount)} {p.currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Modal Footer Summary */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700">
                  ຕົ້ນທຶນລວມ: {formatKip(selectedPoForDetails.total_cost_lak)}
                  {Number(selectedPoForDetails.total_cost_thb) > 0 && ` • ${formatThb(selectedPoForDetails.total_cost_thb)} ฿`}
                </span>
                <span className="text-xs font-bold text-rose-600 ml-3">
                  ຄ້າງຊຳລະ: {formatDots(selectedPoForDetails.debt_amount)} {selectedPoForDetails.primary_currency}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPoForDetails(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                ປິດ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Debt Repayment Modal */}
      {payingPo && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                <HandCoins size={20} className="text-teal-600" />
                <span>ຊຳລະໜີ້ສິນຜູ້ສະໜອງ: {payingPo.id}</span>
              </h3>
              <button onClick={() => setPayingPo(null)} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDebtPayment} className="flex flex-col gap-3">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">ໜີ້ຄ້າງຊຳລະປັດຈຸບັນ</span>
                  <span className="text-xs text-slate-600">
                    {payingPo.suppliers?.name || 'ບໍ່ລະບຸຜູ້ສະໜອງ'}
                  </span>
                </div>
                <span className="text-base font-black text-rose-600 font-mono">
                  {formatDots(payingPo.debt_amount)} {payingPo.primary_currency || 'LAK'}
                </span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  ຈຳນວນເງິນທີ່ຈ່າຍເພີ່ມ ({payingPo.primary_currency || 'LAK'}) *
                </label>
                <input
                  type="text"
                  required
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(formatDots(parseDots(e.target.value)))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base font-black font-mono text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  ຮູບແບບການຊຳລະ
                </label>
                <select
                  value={repayMethod}
                  onChange={(e) => setRepayMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none"
                >
                  <option value="CASH">ເງິນສົດ (Cash)</option>
                  <option value="TRANSFER">ໂອນເງິນ / QR (Transfer)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  ໝາຍເຫດ (Note)
                </label>
                <input
                  type="text"
                  placeholder="ເຊັ່ນ: ໂອນຜ່ານ BCEL One, ຈ່າຍງວດ 2..."
                  value={repayNote}
                  onChange={(e) => setRepayNote(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayingPo(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer active:scale-95 transition-all"
                >
                  {isSubmittingPayment ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກການຊຳລະໜີ້'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
