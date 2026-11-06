import React, { useMemo } from 'react';
import {
  X,
  ChartLineUp,
  Receipt,
  CalendarBlank,
  User,
  Tag,
  Warning,
  CheckCircle,
  Printer,
  Info,
  Warehouse,
  CurrencyCircleDollar,
  HandCoins,
  FileText
} from '@phosphor-icons/react';
import { formatKip, formatDateToDDMMYYYY, formatTime24h } from '../utils/formatters';
import { calculateItemCostAndMultiplier } from '../utils/costCalculation';

/**
 * Robust Transaction Profit & Cost Metrics Calculation
 * Computes product-by-product breakdown, cost of goods sold, profit, and margins.
 */
export function calculateTxProfitMetrics(tx, productsMap = null) {
  if (!tx) {
    return {
      grandTotal: 0,
      totalQuantity: 0,
      totalCost: 0,
      totalProfit: 0,
      overallMargin: '0',
      isProfit: false,
      isLoss: false,
      isBreakEven: true,
      hasCost: false,
      hasIncompleteCost: false,
      zeroCostCount: 0,
      zeroCostRevenue: 0,
      itemsBreakdown: [],
    };
  }

  const explicitGrandTotal = Number(tx.grandTotal ?? tx.grand_total ?? tx.total_lak ?? 0);
  const items = tx.items || tx.sale_transaction_items || [];
  
  let totalCostFromItems = 0;
  let itemsRevenueSum = 0;
  let zeroCostCount = 0;
  let zeroCostRevenue = 0;

  const itemsBreakdown = (Array.isArray(items) ? items : []).map((it, idx) => {
    const qty = Number(it.quantity) || 1;
    const uPrice = Number(
      it.unit_price !== undefined && it.unit_price !== null
        ? it.unit_price
        : it.effectivePrice !== undefined && it.effectivePrice !== null
        ? it.effectivePrice
        : it.customPrice !== undefined && it.customPrice !== null
        ? it.customPrice
        : it.unitPrice !== undefined && it.unitPrice !== null
        ? it.unitPrice
        : it.price !== undefined && it.price !== null
        ? it.price
        : it.unit?.retailPrice || 0
    );
    const lineTotal = Number(
      it.line_total !== undefined && it.line_total !== null && Number(it.line_total) > 0
        ? it.line_total
        : it.lineTotal !== undefined && it.lineTotal !== null && Number(it.lineTotal) > 0
        ? it.lineTotal
        : (uPrice * qty)
    );
    itemsRevenueSum += lineTotal;
    const effectiveUnitPrice = qty > 0 ? Math.round(lineTotal / qty) : uPrice;

    // Resolve matching product metadata for accurate cost
    const prodId = it.productId || it.product_id || it.product?.id;
    let matchedProd = null;
    if (productsMap && prodId) {
      matchedProd = productsMap instanceof Map ? productsMap.get(prodId) : productsMap[prodId];
    }
    if (!matchedProd && it.product && typeof it.product === 'object') {
      matchedProd = it.product;
    }

    // Determine cost per unit & line cost using single source of truth engine
    let lineCost = 0;
    let costPerUnit = 0;
    let hasCost = false;

    const explicitLineCost = Number(it.line_cost ?? it.lineCost ?? 0);
    if (explicitLineCost > 0) {
      lineCost = explicitLineCost;
      costPerUnit = Math.round(lineCost / qty);
      hasCost = true;
    } else {
      const itemWithProd = {
        ...it,
        product: matchedProd || it.product,
      };
      const costInfo = calculateItemCostAndMultiplier(itemWithProd);
      if (costInfo.hasCost) {
        lineCost = costInfo.lineCost;
        costPerUnit = costInfo.unitCost;
        hasCost = true;
      } else {
        lineCost = 0;
        costPerUnit = 0;
        hasCost = false;
      }
    }

    if (hasCost) {
      totalCostFromItems += lineCost;
    } else {
      zeroCostCount += 1;
      zeroCostRevenue += lineTotal;
    }

    const lineProfit = hasCost ? (lineTotal - lineCost) : 0;
    const profitMargin = hasCost && lineTotal > 0 ? ((lineProfit / lineTotal) * 100).toFixed(1) : '0';

    const rawUnitName = String(it.unitName || it.unit_name || it.unit?.unitName || (it.isBundle ? 'ແກັດ' : 'ອັນ'));
    const isHalfCarton = Boolean(it.isHalfCarton || rawUnitName.includes('½') || rawUnitName.includes('1/2'));
    const unitName = isHalfCarton && !rawUnitName.includes('½') ? `½ ${rawUnitName}` : rawUnitName;

    return {
      id: it.id || `item_${prodId || 'p'}_${idx}`,
      productName: it.productName || it.product_name || matchedProd?.name || 'ສິນຄ້າ',
      nameVi: it.nameVi || it.name_vi || matchedProd?.nameVi || matchedProd?.name_vi || '',
      unitName,
      quantity: qty,
      unitPrice: effectiveUnitPrice,
      lineTotal,
      costPerUnit,
      lineCost,
      lineProfit,
      profitMargin,
      hasCost,
      isZeroCost: !hasCost,
      isProfit: hasCost && lineProfit > 0,
      isLoss: hasCost && lineProfit < 0,
      isBundle: Boolean(it.isBundle || it.is_bundle),
    };
  });

  // Calculate final totals directly from displayed items (reduce) to guarantee 100% agreement
  const grandTotal = explicitGrandTotal > 0 ? explicitGrandTotal : itemsRevenueSum;
  const finalTotalCost = totalCostFromItems;
  const finalProfit = grandTotal - finalTotalCost;
  const overallMargin = grandTotal > 0 ? ((finalProfit / grandTotal) * 100).toFixed(1) : '0';
  const totalQuantity = itemsBreakdown.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

  return {
    grandTotal,
    totalQuantity,
    totalCost: finalTotalCost,
    totalProfit: finalProfit,
    overallMargin,
    isProfit: finalProfit > 0,
    isLoss: finalProfit < 0,
    isBreakEven: finalProfit === 0,
    hasCost: finalTotalCost > 0,
    hasIncompleteCost: zeroCostCount > 0,
    zeroCostCount,
    zeroCostRevenue,
    itemsBreakdown,
  };
}

export default function InvoiceProfitDetailModal({
  isOpen,
  onClose,
  transaction,
  products = [],
  onPrintReceipt,
}) {
  const productsMap = useMemo(() => {
    const map = new Map();
    (products || []).forEach((p) => {
      if (p.id) map.set(p.id, p);
      if (p.barcode) map.set(p.barcode, p);
    });
    return map;
  }, [products]);

  const metrics = useMemo(() => {
    return calculateTxProfitMetrics(transaction, productsMap);
  }, [transaction, productsMap]);

  if (!isOpen || !transaction) return null;

  const isCancelled = transaction.status === 'cancelled' || transaction.isCancelled;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. MODAL HEADER */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-emerald-50/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs border ${
              metrics.isLoss
                ? 'bg-rose-50 text-rose-600 border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              <ChartLineUp size={22} weight="bold" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  ລາຍລະອຽດຕົ້ນທຶນ & ກຳໄລບິນ
                </h2>
                <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                  #{transaction.receiptNumber || transaction.id}
                </span>
                {isCancelled && (
                  <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200">
                    ບິນຍົກເລີກແລ້ວ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <CalendarBlank size={12} weight="bold" />
                  <span>{formatDateToDDMMYYYY(transaction.createdAt || transaction.created_at)}</span>
                  <span>{formatTime24h(transaction.createdAt || transaction.created_at)}</span>
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <User size={12} weight="bold" />
                  <span>ຜູ້ຂາຍ: <strong>{transaction.cashierName || transaction.cashier_name || 'Meii'}</strong></span>
                </span>
                <span>•</span>
                <span>ລູກຄ້າ: <strong>{transaction.customerName || 'ລູກຄ້າທົ່ວໄປ'}</strong></span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            title="ປິດ"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* 2. BODY SCROLLABLE */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Top 3 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* KPI 1: Doanh thu bán ra (Grand Total) */}
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
                <span className="flex items-center gap-1">
                  <Receipt size={14} weight="bold" className="text-blue-600" />
                  <span>1. ຍອດຂາຍລວມ (Revenue)</span>
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 tracking-tight">
                {formatKip(metrics.grandTotal)}
              </div>
              <p className="text-[10.5px] text-slate-500 font-medium mt-1">
                ຍອດເງິນຂາຍຕົວຈິງຕາມບິນ
              </p>
            </div>

            {/* KPI 2: Tổng giá nhập (Total Cost) */}
            <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-amber-800 text-xs font-bold mb-1">
                <span className="flex items-center gap-1">
                  <Warehouse size={14} weight="bold" className="text-amber-600" />
                  <span>2. ຕົ້ນທຶນສິນຄ້າລວມ (Cost)</span>
                </span>
                {metrics.hasIncompleteCost && (
                  <span className="text-[9.5px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold border border-amber-300">
                    ບາງລາຍການຍັງບໍ່ມີທຶນ
                  </span>
                )}
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 tracking-tight">
                {formatKip(metrics.totalCost)}
              </div>
              <p className="text-[10.5px] text-amber-700/90 font-medium mt-1">
                ຕົ້ນທຶນສິນຄ້າທັງໝົດໃນບິນນີ້
              </p>
            </div>

            {/* KPI 3: Lợi nhuận gộp (Gross Profit) */}
            <div className={`p-3.5 rounded-xl border shadow-2xs transition-all ${
              metrics.isLoss
                ? 'bg-rose-50/80 border-rose-300'
                : 'bg-emerald-50/70 border-emerald-300'
            }`}>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className={`flex items-center gap-1 ${metrics.isLoss ? 'text-rose-800' : 'text-emerald-800'}`}>
                  <ChartLineUp size={14} weight="bold" />
                  <span>3. ກຳໄລຂັ້ນຕົ້ນ (Profit)</span>
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  metrics.isLoss
                    ? 'bg-rose-100 text-rose-700 border-rose-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}>
                  {metrics.isLoss ? 'ຂາດທຶນ' : 'ອັດຕາກຳໄລ'}: {metrics.overallMargin}%
                </span>
              </div>
              <div className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                metrics.isLoss ? 'text-rose-600' : 'text-emerald-700'
              }`}>
                {metrics.isProfit ? '+' : ''}{formatKip(metrics.totalProfit)}
              </div>
              {metrics.zeroCostCount > 0 ? (
                <div className="mt-1">
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300 inline-block">
                    * ຍັງບໍ່ຫັກທຶນ {metrics.zeroCostCount} ລາຍການ
                  </span>
                </div>
              ) : (
                <p className={`text-[10.5px] font-bold mt-1 ${
                  metrics.isLoss ? 'text-rose-600' : 'text-emerald-700'
                }`}>
                  {metrics.isLoss
                    ? 'ບິນນີ້ຂາດທຶນ! ກະລຸນາກວດສອບລາຄາຂາຍ'
                    : 'ກຳໄລຕົວຈິງຫຼັງຫັກຕົ້ນທຶນສິນຄ້າ'}
                </p>
              )}
            </div>
          </div>

          {/* Alert if any items have no cost price */}
          {metrics.hasIncompleteCost && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <Info size={16} weight="bold" className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>ແຈ້ງເຕືອນ:</strong> ມີ {metrics.zeroCostCount} ລາຍການໃນບິນນີ້ຍັງບໍ່ມີລາຄາທຶນ (ມູນຄ່າຍອດຂາຍ {formatKip(metrics.zeroCostRevenue)} ₭). 
                ກຳໄລຂ້າງເທິງຍັງບໍ່ໄດ້ຫັກຕົ້ນທຶນຂອງສິນຄ້າດັ່ງກ່າວ (ກຳໄລຕົວຈິງຈະປັບຫຼຸດລົງເມື່ອອັບເດດລາຄາທຶນຄົບຖ້ວນ).
              </div>
            </div>
          )}

          {/* 3. PRODUCT BREAKDOWN TABLE */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Tag size={15} weight="bold" className="text-slate-500" />
                <span>ລາຍການສິນຄ້າໃນບິນ ({metrics.itemsBreakdown.length} ລາຍການ)</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                ຄຳນວນລະອຽດຕໍ່ແຕ່ລະລາຍການ
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-[620px]">
                <thead>
                  <tr className="bg-slate-50/70 text-slate-600 font-extrabold [&_th]:border-b [&_th]:border-slate-200">
                    <th className="py-2.5 px-3 w-10 text-center text-slate-400 font-mono">ລ/ດ</th>
                    <th className="py-2.5 px-3">ສິນຄ້າ & ຫົວໜ່ວຍ</th>
                    <th className="py-2.5 px-3 text-center">ຈຳນວນ</th>
                    <th className="py-2.5 px-3 text-right">ລາຄາຂາຍ (ລວມ)</th>
                    <th className="py-2.5 px-3 text-right">ຕົ້ນທຶນ (ລວມ)</th>
                    <th className="py-2.5 px-3 text-right">ກຳໄລ</th>
                  </tr>
                </thead>
                <tbody className="[&_td]:border-b [&_td]:border-slate-100">
                  {metrics.itemsBreakdown.map((item, idx) => {
                    const rowKey = item.id ? `${item.id}_${idx}` : `row_${idx}_${item.unitName}`;
                    return (
                      <tr key={rowKey} className="hover:bg-slate-50/60 transition-colors">
                        {/* 0. STT */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                          {idx + 1}
                        </td>

                        {/* 1. Tên sản phẩm & Đơn vị */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                            <span>{item.productName}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.unitName}
                            </span>
                            {item.isBundle && (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                                ຊຸດ/ແພັກ
                              </span>
                            )}
                          </div>
                          {item.nameVi && (
                            <div className="text-[11px] text-slate-400 mt-0.5">{item.nameVi}</div>
                          )}
                        </td>

                        {/* 2. Số lượng */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                          {item.quantity}
                        </td>

                        {/* 3. Giá bán & Thành tiền bán */}
                        <td className="py-3 px-3 text-right font-mono">
                          <div className="font-black text-slate-900">
                            {formatKip(item.lineTotal)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            @{formatKip(item.unitPrice)}
                          </div>
                        </td>

                        {/* 4. Giá nhập & Thành tiền vốn */}
                        <td className="py-3 px-3 text-right font-mono">
                          {item.hasCost ? (
                            <>
                              <div className="font-bold text-amber-800">
                                {formatKip(item.lineCost)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                @{formatKip(item.costPerUnit)}
                              </div>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              ຍັງບໍ່ມີທຶນ
                            </span>
                          )}
                        </td>

                        {/* 5. Tiền lãi & Tỷ lệ lãi */}
                        <td className="py-3 px-3 text-right font-mono">
                          {!item.hasCost ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80">
                                ລໍຖ້າຕົ້ນທຶນ
                              </span>
                              <span className="text-[9.5px] text-slate-400 mt-0.5">
                                --
                              </span>
                            </div>
                          ) : item.isLoss ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="font-black text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                {formatKip(item.lineProfit)}
                              </span>
                              <span className="text-[9.5px] font-bold text-rose-500 mt-0.5">
                                ຂາດທຶນ {item.profitMargin}%
                              </span>
                            </div>
                          ) : item.isProfit ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="font-black text-emerald-700">
                                +{formatKip(item.lineProfit)}
                              </span>
                              <span className="text-[9.5px] font-bold text-emerald-600 mt-0.5">
                                +{item.profitMargin}%
                              </span>
                            </div>
                          ) : (
                            <span className="font-bold text-slate-400">0 ₭</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/90 font-black text-slate-900 border-t-2 border-slate-200 font-mono">
                    <td colSpan={2} className="py-3 px-4 text-left font-sans font-black text-xs text-slate-700">
                      ຍອດລວມທັງໝົດ (Total):
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-black text-xs text-slate-900">
                      {metrics.totalQuantity}
                    </td>
                    <td className="py-3 px-3 text-right text-xs font-black text-slate-900">
                      {formatKip(metrics.grandTotal)}
                    </td>
                    <td className="py-3 px-3 text-right text-xs font-black text-amber-800">
                      {formatKip(metrics.totalCost)}
                    </td>
                    <td className={`py-3 px-3 text-right text-xs font-black ${metrics.isLoss ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {metrics.isProfit ? '+' : ''}{formatKip(metrics.totalProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* 4. MODAL FOOTER */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            ອັດຕາກຳໄລລວມຂອງບິນ: <strong className={metrics.isLoss ? 'text-rose-600' : 'text-emerald-700'}>{metrics.overallMargin}%</strong>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onPrintReceipt && (
              <button
                type="button"
                onClick={() => {
                  onPrintReceipt(transaction);
                }}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
              >
                <Printer size={15} weight="bold" />
                <span>ພິມບິນຄືນ</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              ປິດ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

