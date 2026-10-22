import React, { useState } from 'react';
import {
  Receipt,
  X,
  Printer,
  QrCode,
  Prohibit,
  CircleNotch,
  CheckCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import { formatKip } from '../utils/formatters';
import { printReceiptSmart, getPrinterConfig } from '../services/printerService';
import { Capacitor } from '@capacitor/core';
import {
  playSuccessBeep,
  playErrorBeep,
  playModalCloseBeep,
  playModalConfirmBeep,
  playUnitChangeBeep,
} from '../utils/audioFeedback';

export default function ReceiptModal({
  isOpen,
  onClose,
  receipt,
  onCancelReceipt,
  onAlert,
}) {
  // K80 80mm hardcoded — no 58mm support
  const paperWidth = 80;
  if (!isOpen || !receipt) return null;

  const isCancelled = receipt.status === 'cancelled' || receipt.isCancelled;

  const receiptItems =
    receipt.items && receipt.items.length > 0
      ? receipt.items
      : (receipt.sale_transaction_items && receipt.sale_transaction_items.length > 0
          ? receipt.sale_transaction_items
          : []);

  const isTransferPayment = receipt.paymentMethod !== 'cash';

  // Bilingual Receipt Language: 'lo' (default) | 'vi'
  const [receiptLanguage, setReceiptLanguage] = useState('lo');

  const [isPrinting, setIsPrinting] = useState(false);
  const [printFeedback, setPrintFeedback] = useState(null);

  // Comprehensive Bilingual Receipt Dictionary (Lao / Vietnamese)
  const LABELS = {
    lo: {
      storeName: 'ຮ້ານ MeiiShop',
      storeSlogan: 'ຂາຍຍົກ - ຂາຍຍ່ອຍ ສິນຄ້າອຸປະໂພກ ບໍລິໂພກ',
      storeAddress: 'ຖະໜົນ ໄກສອນ ພົມວິຫານ, ບ້ານ ໂພນສະຫວ່າງ, ນະຄອນຫຼວງວຽງຈັນ',
      storeTel: 'ໂທ: 020 5555 9999 / 021 214 555',
      receiptTitle: 'ໃບບິນຮັບເງິນ / RECEIPT',
      voidTitle: 'ໃບບິນນີ້ຖືກຍົກເລີກແລ້ວ (VOID)',
      voidDesc: 'ສິນຄ້າຖືກສົ່ງຄືນເຂົ້າສາງແລ້ວ',
      status: 'ສະຖານະ:',
      cancelled: 'ຍົກເລີກແລ້ວ (Cancelled)',
      cashier: 'ຜູ້ຂາຍ:',
      customer: 'ລູກຄ້າ:',
      defaultCustomer: 'ລູກຄ້າທົ່ວໄປ',
      date: 'ວັນທີ:',
      payment: 'ຊຳລະ:',
      payCash: 'ເງິນສົດ',
      payQr: 'QR ໂອນ',
      payDebtFull: 'ຕິດໜີ້ 100%',
      payDebtPartial: 'ຕິດໜີ້ (ບາງສ່ວນ)',
      payTransfer: 'ໂອນບັນຊີ',
      colName: 'ຊື່ລາຍການ',
      colQty: 'ຈຳນວນ',
      colPrice: 'ລາຄາ',
      colTotal: 'ລວມ (₭)',
      missingCrate: '↳ ບໍ່ມີລັງປ່ຽນ',
      crateDepositLabel: 'ຄ່າມັດຈຳລັງ (Crate Deposit):',
      subtotalLabel: 'ລວມເງິນສິນຄ້າ (Subtotal):',
      discountLabel: 'ສ່ວນຫຼຸດ (Discount):',
      grandTotalLabel: 'ຍອດຊຳລະສຸດທິ:',
      paidLabel: 'ຈ່າຍແລ້ວ / ຈ່າຍກ່ອນ (Paid):',
      debtBalanceLabel: 'ຍອດຄ້າງຊຳລະ (Debt Balance):',
      debtNoteLabel: '* ໝາຍເຫດ:',
      tenderedLabel: 'ຮັບເງິນມາ (Tendered):',
      changeLabel: 'ເງິນທອນ (Change):',
      transferTotalLabel: 'ຍອດໂອນ:',
      signDebtor: 'ລາຍເຊັນຜູ້ຄ້າງຊຳລະ (Debtor)',
      signCustomer: 'ຜູ້ຮັບເຄື່ອງ (Customer)',
      signSeller: 'ລາຍເຊັນຜູ້ຂາຍ (Seller)',
      signCashier: 'ພະນັກງານຂາຍ (Cashier)',
      thankYou: 'ຂໍຂອບໃຈລູກຄ້າທີ່ມາອຸດໜູນ! ໂອກາດໜ້າເຊີນໃໝ່ເດີ',
      returnPolicy: 'ສິນຄ້າຊື້ແລ້ວ ບໍ່ຮັບປ່ຽນ ຫຼື ຄືນເງິນ • ກະລຸນາກວດສອບເງິນທອນ',
      loadingItems: '(ກຳລັງໂຫຼດລາຍການສິນຄ້າ...)',
      defaultItemName: 'ສິນຄ້າ',
      defaultUnitName: 'ອັນ',
      btnCancel: 'ຍົກເລີກບິນ',
      btnCancelled: 'ບິນນີ້ຍົກເລີກແລ້ວ',
      btnClose: 'ປິດໜ້າຕ່າງ',
      btnPrint: 'ພິມໃບບິນ (80mm)',
      btnPrintProgress: 'ກຳລັງກວດສອບ & ພິມ...',
    },
    vi: {
      storeName: 'CỬA HÀNG MEIISHOP',
      storeSlogan: 'Bán buôn - Bán lẻ Hàng tiêu dùng',
      storeAddress: 'Đường Kaysone Phomvihane, Bản Phonsavang, TP. Vientiane',
      storeTel: 'ĐT: 020 5555 9999 / 021 214 555',
      receiptTitle: 'HÓA ĐƠN BÁN HÀNG',
      voidTitle: 'HÓA ĐƠN NÀY ĐÃ HỦY ',
      voidDesc: 'Hàng hóa đã được hoàn lại vào kho',
      status: 'Trạng thái:',
      cancelled: 'ĐÃ HỦY',
      cashier: 'Thu ngân:',
      customer: 'Khách hàng:',
      defaultCustomer: 'Khách lẻ',
      date: 'Ngày in:',
      payment: 'Thanh toán:',
      payCash: 'Tiền mặt',
      payQr: 'Chuyển khoản QR',
      payDebtFull: 'Ghi nợ 100%',
      payDebtPartial: 'Ghi nợ (Một phần)',
      payTransfer: 'Chuyển khoản',
      colName: 'Tên món',
      colQty: 'SL',
      colPrice: 'Đơn giá',
      colTotal: 'Thành tiền (₭)',
      missingCrate: '↳ Thiếu két vỏ',
      crateDepositLabel: 'Cọc vỏ/két (Crate Deposit):',
      subtotalLabel: 'Tiền hàng (Subtotal):',
      discountLabel: 'Giảm giá (Discount):',
      grandTotalLabel: 'TỔNG THANH TOÁN:',
      paidLabel: 'Đã thanh toán (Paid):',
      debtBalanceLabel: 'Còn nợ (Debt Balance):',
      debtNoteLabel: '* Ghi chú nợ:',
      tenderedLabel: 'Tiền khách đưa (Tendered):',
      changeLabel: 'Tiền thừa thối lại (Change):',
      transferTotalLabel: 'Số tiền chuyển khoản:',
      signDebtor: 'Chữ ký người nợ (Debtor)',
      signCustomer: 'Người nhận hàng (Customer)',
      signSeller: 'Người bán hàng (Seller)',
      signCashier: 'Nhân viên thu ngân (Cashier)',
      thankYou: 'ຂໍຂອບໃຈລູກຄ້າທີ່ມາອຸດໜູນ! ໂອກາດໜ້າເຊີນໃໝ່ເດີ',
      returnPolicy: 'ສິນຄ້າຊື້ແລ້ວ ບໍ່ຮັບປ່ຽນ ຫຼື ຄືນເງິນ • ກະລຸນາກວດສອບເງິນທອນ',
      loadingItems: '(Đang tải danh sách hàng...)',
      defaultItemName: 'Sản phẩm',
      defaultUnitName: 'Cái',
      btnCancel: 'Hủy hóa đơn',
      btnCancelled: 'Hóa đơn đã hủy',
      btnClose: 'Đóng cửa sổ',
      btnPrint: 'In hóa đơn (80mm)',
      btnPrintProgress: 'Đang chuẩn bị & in...',
    },
  };

  // Unit translation mapping for Vietnamese mode
  const translateUnit = (unitStr, lang, isHalf = false) => {
    if (!unitStr) return lang === 'vi' ? 'Cái' : 'ອັນ';
    const clean = String(unitStr).trim().toLowerCase();
    const hasHalfPrefix = clean.startsWith('½') || clean.startsWith('1/2') || isHalf;
    const baseClean = clean.replace(/^(½|1\/2)\s*/, '');

    if (lang === 'vi') {
      let viBase = baseClean;
      if (['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'carton', 'box'].includes(baseClean)) {
        viBase = 'Thùng';
      } else if (['ແພັກ', 'ມັດ', 'pack', 'bundle'].includes(baseClean)) {
        viBase = 'Lốc';
      } else if (['ອັນ', 'cái', 'piece', 'unit'].includes(baseClean)) {
        viBase = 'Cái';
      } else if (['ແກ້ວ', 'chai', 'bottle'].includes(baseClean)) {
        viBase = 'Chai';
      } else if (['ປ໋ອງ', 'ກະປ໋ອງ', 'can'].includes(baseClean)) {
        viBase = 'Lon';
      } else if (['ຕຸກ'].includes(baseClean)) {
        viBase = 'Chai';
      } else if (['ຊອງ', 'ຖົງ'].includes(baseClean)) {
        viBase = 'Gói';
      }
      return hasHalfPrefix ? `½ ${viBase}` : viBase;
    }

    // Lao mode
    if (hasHalfPrefix && !unitStr.startsWith('½')) {
      return `½ ${unitStr}`;
    }
    return unitStr;
  };

  const L = LABELS[receiptLanguage] || LABELS.lo;

  const handlePrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    setPrintFeedback(null);

    // Top-level safety timeout (max 4.5 seconds for complete render + print)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error('ໝົດເວລາເຊື່ອມຕໍ່ຫາເຄື່ອງພິມ (Timeout). ກະລຸນາກວດສອບວ່າເຄື່ອງພິມເປີດຢູ່ ແລະ ຢູ່ Wi-Fi ດຽວກັນ.')
          ),
        4500
      )
    );

    try {
      const printPromise = printReceiptSmart({
        elementId: 'thermal-receipt-print-area',
        receipt,
        language: receiptLanguage,
        allowFallback: !Capacitor.isNativePlatform(),
      });

      const res = await Promise.race([printPromise, timeoutPromise]);

      if (res && res.success) {
        setPrintFeedback({
          type: 'success',
          message: res.message || 'ພິມໃບບິນສຳເລັດແລ້ວ!',
        });
        playSuccessBeep();
        setTimeout(() => setPrintFeedback(null), 4000);
      } else {
        throw new Error(res?.message || 'ບໍ່ສາມາດເຊື່ອມຕໍ່ຫາເຄື່ອງພິມໄດ້.');
      }
    } catch (err) {
      console.error('Print error:', err);
      const errMsg = err?.message || 'ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ເຄື່ອງພິມ.';
      setPrintFeedback({
        type: 'error',
        message: errMsg,
      });
      playErrorBeep();
      setTimeout(() => setPrintFeedback(null), 6000);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 print:static print:inset-auto print:p-0 print:bg-transparent print:backdrop-blur-none print:block">
      <div className="bg-slate-100 rounded-3xl max-w-md w-full p-4 shadow-2xl flex flex-col gap-3 animate-in zoom-in-95 duration-200 max-h-[95vh] overflow-y-auto relative print:static print:max-h-none print:h-auto print:overflow-visible print:p-0 print:shadow-none print:border-none print:bg-white print:w-full print:max-w-none">
        {/* Print Feedback Toast inside modal */}
        {printFeedback && (
          <div
            className={`absolute top-16 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xl border animate-in fade-in slide-in-from-top-2 duration-150 flex items-center gap-1.5 no-print ${
              printFeedback.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-rose-600 text-white border-rose-500'
            }`}
          >
            <span>{printFeedback.message}</span>
          </div>
        )}

        {/* Top Toolbar: Language Selector (Lao / Vietnamese) & Close — 80mm K80 hardcoded */}
        <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-slate-200 bg-white p-2.5 rounded-2xl no-print">
          {/* Left: Language Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => {
                playUnitChangeBeep('receipt');
                setReceiptLanguage('lo');
              }}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                receiptLanguage === 'lo'
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="ພິມໃບບິນພາສາລາວ (Mặc định)"
            >
              <span>🇱🇦 ພາສາລາວ</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playUnitChangeBeep('receipt');
                setReceiptLanguage('vi');
              }}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                receiptLanguage === 'vi'
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="In hóa đơn Tiếng Việt"
            >
              <span>🇻🇳 Tiếng Việt</span>
            </button>
          </div>

          {/* Right: 80mm K80 badge & Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2 py-1 bg-teal-600 text-white rounded text-[10.5px] font-bold shadow-2xs select-none">K80 (576 dots)</span>
            <button
              type="button"
              onClick={() => {
                playModalCloseBeep('receipt');
                onClose();
              }}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Authentic Thermal Receipt Paper Container */}
        <div
          id="thermal-receipt-print-area"
          style={{
            fontFamily: receiptLanguage === 'vi' ? "'Be Vietnam Pro', 'Noto Sans Lao', sans-serif" : "'Noto Sans Lao', Outfit, sans-serif",
          }}
          className={`bg-white mx-auto p-4 border border-slate-200 shadow-sm text-slate-900 print:p-0 print:border-none print:shadow-none print:overflow-visible print:max-h-none print:h-auto paper-80mm w-full max-w-[380px] ${
            receiptLanguage === 'vi' ? 'font-vietnam' : 'font-lao'
          }`}
        >
          {/* Store Header */}
          <div className="text-center pb-2">
            <h2 className="text-base font-black text-slate-950 leading-normal tracking-wide pt-0.5">{L.storeName}</h2>
            <p className="text-[11px] text-slate-700 font-bold leading-normal mt-0.5">
              {L.storeSlogan}
            </p>
            <p className="text-[10.5px] text-slate-600 leading-normal">
              {L.storeAddress}
            </p>
            <p className="text-[11px] text-slate-700 font-bold leading-normal">
              {L.storeTel}
            </p>
          </div>

          {/* Receipt Title Banner */}
          <div className="py-0.5 border-y-2 border-slate-900 text-center font-black text-xs my-1 leading-normal uppercase">
            {L.receiptTitle}
          </div>

          {/* Void / Cancelled Watermark Banner */}
          {isCancelled && (
            <div className="my-2 p-2 bg-rose-600 text-white font-black text-center rounded-lg shadow-xs border-2 border-rose-800 animate-in fade-in">
              <div className="flex items-center justify-center gap-1.5 text-xs tracking-wider uppercase">
                <Prohibit size={18} weight="bold" />
                <span>{L.voidTitle}</span>
              </div>
              <p className="text-[9.5px] font-medium opacity-95 mt-0.5 leading-normal">
                {receipt.cancelledAt ? `${L.date} ${new Date(receipt.cancelledAt).toLocaleString(receiptLanguage === 'vi' ? 'vi-VN' : 'lo-LA')}` : ''} • {L.voidDesc}
              </p>
            </div>
          )}

          {/* Metadata Info */}
          <div className="flex flex-col gap-1 text-[10.5px] text-slate-700 pb-2 leading-normal">
            {isCancelled && (
              <div className="flex justify-between items-center bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[10px]">
                <span className="font-bold text-rose-800">{L.status}</span>
                <span className="font-black text-rose-700 uppercase flex items-center gap-1">
                  <Prohibit size={13} weight="bold" />
                  <span>{L.cancelled}</span>
                </span>
              </div>
            )}

            {/* Row 1: Cashier/Seller (Left) + Customer (Right) */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 truncate max-w-[48%] pt-0.5">
                <span className="text-slate-500">{L.cashier}</span>
                <span className="font-medium text-slate-800 truncate">
                  {receipt.cashierName || 'Meii'}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1 truncate max-w-[50%] pt-0.5">
                <span className="text-slate-500">{L.customer}</span>
                <span className="font-bold text-slate-900 truncate">
                  {(!receipt.customerName || receipt.customerName === 'ລູກຄ້າທົ່ວໄປ' || receipt.customerName === 'Khách lẻ / Khách vãng lai')
                    ? L.defaultCustomer
                    : receipt.customerName}
                </span>
              </div>
            </div>

            {/* Row 2: Date & Time (Left) + Payment Method (Right) */}
            <div className="flex justify-between items-center pt-0.5">
              <div className="flex items-center gap-1 font-mono text-[10px] text-slate-700 pt-0.5">
                <span className="font-sans text-slate-500">{L.date}</span>
                <span>{new Date(receipt.createdAt).toLocaleString(receiptLanguage === 'vi' ? 'vi-VN' : 'lo-LA')}</span>
              </div>
              <div className="flex items-center gap-1 text-[10.5px] pt-0.5">
                <span className="text-slate-500">{L.payment}</span>
                <span className={`font-bold ${receipt.paymentMethod === 'debt' ? 'text-amber-800' : 'text-teal-800'}`}>
                  {receipt.paymentMethod === 'cash'
                    ? L.payCash
                    : (receipt.paymentMethod === 'transfer' || receipt.paymentMethod === 'qrTransfer' || receipt.paymentMethod === 'onepay')
                    ? L.payQr
                    : receipt.paymentMethod === 'debt'
                    ? (Number(receipt.paidAmount || 0) === 0 ? L.payDebtFull : L.payDebtPartial)
                    : L.payTransfer}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table Header - 4 Columns: Name (40%), Qty (15%), Price (20%), Total (25%) */}
          <div className="border-t border-dashed border-slate-300 pt-2 pb-1 flex items-center font-extrabold text-[10px] text-slate-800 leading-normal">
            <span className="w-[40%] flex-1 text-left pt-0.5">{L.colName}</span>
            <span className="w-[15%] shrink-0 text-center pt-0.5">{L.colQty}</span>
            <span className="w-[20%] shrink-0 text-right pt-0.5">{L.colPrice}</span>
            <span className="w-[25%] shrink-0 text-right pt-0.5">{L.colTotal}</span>
          </div>
          <div className="border-b border-slate-400 mb-1.5"></div>

          {/* Item Rows - Single Line 4-Column Layout */}
          <div className="flex flex-col gap-1 pb-2 border-b border-dashed border-slate-300">
            {receiptItems.length > 0 ? (
              receiptItems.map((it, i) => {
                // Name resolution: In Vietnamese mode, prioritize name_vi / nameVi, fallback to Lao name
                const rawNameVi = it.product?.name_vi || it.product?.nameVi || it.name_vi || it.nameVi;
                const rawNameLao = it.product?.name || it.productName || it.product_name || L.defaultItemName;
                const prodName = (receiptLanguage === 'vi' && rawNameVi && String(rawNameVi).trim())
                  ? String(rawNameVi).trim()
                  : rawNameLao;

                const rawUnitName = it.unit?.unitName || it.unitName || it.unit_name || L.defaultUnitName;
                const unitName = translateUnit(rawUnitName, receiptLanguage, Boolean(it.isHalfCarton));
                const price = Number(
                  it.customPrice ??
                  it.effectivePrice ??
                  it.effectiveUnitPrice ??
                  it.unitPrice ??
                  it.unit_price ??
                  (receipt.isWholesale
                    ? (it.unit?.wholesalePrice ?? it.unit?.retailPrice ?? 0)
                    : (it.unit?.retailPrice ?? 0))
                ) || 0;
                const qty = it.quantity || 1;
                const baseLineTotal = price * qty;
                const hasMissingCrates = Boolean(
                  it.noEmptyCrates || (Number(it.missingCratesCount) > 0) || (Number(it.crateDepositTotal) > 0)
                );
                const feePerCrate = Number(it.crateDepositFee || it.product?.crateDepositFee) || 30000;
                const missingCount = Number(it.missingCratesCount) || (hasMissingCrates ? qty : 0);
                const crateDepositTotal = Number(it.crateDepositTotal) || (hasMissingCrates ? missingCount * feePerCrate : 0);

                return (
                  <div key={i} className="receipt-item-row flex flex-col text-[11px] leading-normal py-0.5">
                    {/* Main Row: 4 Columns with Product Name allowed up to 2 lines */}
                    <div className="product-name-row flex items-start text-slate-900 overflow-visible">
                      <span className="w-[40%] flex-1 font-bold text-left pr-1 break-words leading-normal overflow-visible" title={`${prodName} (${unitName})`}>
                        {prodName} <span className="font-medium text-slate-700">({unitName})</span>
                      </span>
                      <span className="w-[15%] shrink-0 text-center font-mono text-[10.5px] text-slate-800">
                        {qty}x
                      </span>
                      <span className="w-[20%] shrink-0 text-right font-mono text-[10.5px] text-slate-700">
                        {formatKip(price).replace(' ₭', '')}
                      </span>
                      <span className="w-[25%] shrink-0 text-right font-bold font-mono text-slate-950">
                        {formatKip(baseLineTotal).replace(' ₭', '')}
                      </span>
                    </div>

                    {/* Crate Deposit row for bottles/beers without empty crates to exchange (+30.000 ₭/crate) */}
                    {hasMissingCrates && missingCount > 0 && (
                      <div className="flex items-center text-[10px] text-amber-950 bg-amber-50/90 py-0.5 px-1 rounded mt-0.5 border border-amber-200 leading-normal">
                        <span className="w-[40%] font-bold text-left truncate text-amber-900" title={L.missingCrate}>
                          {L.missingCrate}
                        </span>
                        <span className="w-[15%] text-center font-mono text-amber-900">
                          {missingCount}x
                        </span>
                        <span className="w-[20%] text-right font-mono text-amber-800">
                          {formatKip(feePerCrate).replace(' ₭', '')}
                        </span>
                        <span className="w-[25%] text-right font-black font-mono text-amber-950">
                          +{formatKip(crateDepositTotal).replace(' ₭', '')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-2 text-center text-slate-400 text-[10.5px] italic">
                {L.loadingItems}
              </div>
            )}
          </div>

          {/* Totals Summary */}
          {(() => {
            const totalCrateDeposit = receiptItems.reduce((sum, it) => {
              const fee = Number(it.crateDepositFee || it.product?.crateDepositFee) || 30000;
              const count = Number(it.missingCratesCount) || (it.noEmptyCrates ? it.quantity : 0);
              return sum + (Number(it.crateDepositTotal) || (it.noEmptyCrates ? count * fee : 0));
            }, 0);

            // True goods-only subtotal: sum of (unit_price * quantity), without crate fee
            const goodsSubtotalFromItems = receiptItems.reduce((sum, it) => {
              const price = Number(
                it.customPrice ??
                it.effectivePrice ??
                it.effectiveUnitPrice ??
                it.unitPrice ??
                it.unit_price ??
                (receipt.isWholesale
                  ? (it.unit?.wholesalePrice ?? it.unit?.retailPrice ?? 0)
                  : (it.unit?.retailPrice ?? 0))
              ) || 0;
              return sum + (price * (it.quantity || 1));
            }, 0);

            // If receipt.subtotal already included crate deposit, deduct it so goodsSubtotal is pure product cost (e.g. 780.000)
            const pureGoodsSubtotal = goodsSubtotalFromItems > 0
              ? goodsSubtotalFromItems
              : Math.max(0, (receipt.subtotal || 0) - totalCrateDeposit);

            const discount = Number(receipt.discountTotal) || 0;
            const finalGrandTotal = receipt.grandTotal
              ? Math.max(receipt.grandTotal, pureGoodsSubtotal + totalCrateDeposit - discount)
              : (pureGoodsSubtotal + totalCrateDeposit - discount);

            return (
              <div className="flex flex-col gap-1.5 py-2 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>{L.subtotalLabel}</span>
                  <span className="font-mono">{formatKip(pureGoodsSubtotal)}</span>
                </div>
                {totalCrateDeposit > 0 && (
                  <div className="flex justify-between text-amber-900 font-bold bg-amber-50/80 px-1.5 py-0.5 rounded">
                    <span>{L.crateDepositLabel}</span>
                    <span className="font-mono font-black">+{formatKip(totalCrateDeposit)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>{L.discountLabel}</span>
                    <span className="font-mono">-{formatKip(discount)}</span>
                  </div>
                )}
                <div className="border-b-2 border-slate-900 my-1"></div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="font-black text-sm text-slate-900 leading-normal pt-0.5">{L.grandTotalLabel}</span>
                  <span className="font-black text-lg text-teal-800 font-mono tracking-tight pt-0.5">
                    {formatKip(finalGrandTotal)}
                  </span>
                </div>
                <div className="border-b-2 border-slate-900 my-1"></div>

                {(receipt.paymentMethod === 'debt' || receipt.isDebt) ? (
                  <div className="bg-amber-50/80 p-2 rounded-xl border border-amber-300 flex flex-col gap-1.5 my-1 leading-normal">
                    <div className="flex justify-between items-center text-slate-800">
                      <span className="font-bold text-[11px] pt-0.5">{L.paidLabel}</span>
                      <span className="font-mono font-black text-emerald-800 text-xs pt-0.5">
                        {formatKip(receipt.paidAmount ?? receipt.amountTendered ?? 0)}
                      </span>
                    </div>
                    <div className="border-b border-dashed border-amber-300"></div>
                    <div className="flex justify-between items-center text-red-700 font-black">
                      <span className="text-xs pt-0.5">{L.debtBalanceLabel}</span>
                      <span className="font-mono text-sm tracking-tight font-black pt-0.5">
                        {formatKip(receipt.debtAmount ?? Math.max(0, receipt.grandTotal - (receipt.paidAmount ?? receipt.amountTendered ?? 0)))}
                      </span>
                    </div>
                    {receipt.debtNote && (
                      <div className="text-[9.5px] text-amber-950 font-medium italic pt-1 border-t border-amber-200 leading-normal">
                        {L.debtNoteLabel} {receipt.debtNote}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-700 leading-normal">
                      <span className="pt-0.5">{L.tenderedLabel}</span>
                      <span className="font-bold font-mono text-slate-900 pt-0.5">
                        {formatKip(receipt.amountTendered)}
                      </span>
                    </div>
                    {receipt.paymentMethod === 'cash' && (
                      <div className="flex justify-between text-slate-900 font-bold leading-normal">
                        <span className="pt-0.5">{L.changeLabel}</span>
                        <span className="font-mono text-emerald-800 text-xs pt-0.5">
                          {formatKip(receipt.changeAmount)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* QR Code in receipt for transfer payments or unpaid debt - Frameless & Minimal */}
          {(isTransferPayment || (receipt.paymentMethod === 'debt' && (receipt.debtAmount ?? receipt.grandTotal) > 0)) && (
            <div className="my-1.5 py-0.5 text-center flex flex-col items-center leading-normal">
              <img
                src="/qr.jpg"
                alt="Lao QR Payment"
                className="w-24 h-24 object-contain"
                onError={(e) => {
                  e.currentTarget.src =
                    'https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=LAO_QR_BCEL_POS_DEMO';
                }}
              />
              <span className="text-[11px] font-black text-slate-900 mt-0.5 font-mono pt-0.5">
                {L.transferTotalLabel} {formatKip((receipt.paymentMethod === 'debt' || receipt.isDebt) ? (receipt.debtAmount ?? receipt.grandTotal) : receipt.grandTotal)}
              </span>
            </div>
          )}

          {/* Signatures Section (Customized for Debt vs Normal Cash) */}
          <div className="border-t border-dashed border-slate-300 pt-2 pb-2 grid grid-cols-2 text-[9.5px] text-slate-600 text-center leading-normal">
            <div className="flex flex-col items-center">
              <p className="font-bold text-slate-700 leading-normal pt-0.5">
                {(receipt.paymentMethod === 'debt' || receipt.isDebt) ? L.signDebtor : L.signCustomer}
              </p>
              {/* Generous space for hand signature */}
              <div className="h-14"></div>
              <p className="text-slate-400">................................</p>
            </div>
            <div className="flex flex-col items-center">
              <p className="font-bold text-slate-700 leading-normal pt-0.5">
                {(receipt.paymentMethod === 'debt' || receipt.isDebt) ? L.signSeller : L.signCashier}
              </p>
              {/* Generous space for hand signature */}
              <div className="h-14"></div>
              <p className="text-slate-400">................................</p>
            </div>
          </div>

          {/* Barcode Strip (Realistic seamless thermal printer barcode lines, no huge gaps) */}
          <div className="border-t border-dashed border-slate-300 pt-2 text-center leading-normal">
            <div className="flex items-center justify-center h-6 my-1 overflow-hidden select-none">
              {[2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 2, 1, 2, 4, 1, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 2, 1, 2, 4].map((w, idx) => (
                <div
                  key={idx}
                  style={{ width: `${w * 1.5}px` }}
                  className={`h-full ${idx % 2 === 0 ? 'bg-slate-900' : 'bg-transparent'}`}
                />
              ))}
            </div>
            <span className="text-[9.5px] text-slate-600 font-mono tracking-widest block font-bold pt-0.5">
              {receipt.receiptNumber}
            </span>
            <p className="text-[10px] text-slate-700 mt-1 font-bold leading-normal pt-0.5 font-lao">
              {L.thankYou}
            </p>
            <p className="text-[9px] text-slate-500 mt-0.5 leading-normal font-lao">
              {L.returnPolicy}
            </p>
          </div>
        </div>

        {/* Print Feedback Banner directly above buttons */}
        {printFeedback && (
          <div
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border shadow-xs animate-in fade-in duration-150 flex items-center justify-center gap-2 no-print text-center ${
              printFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {printFeedback.type === 'success' ? (
              <CheckCircle size={17} weight="fill" className="text-emerald-600 shrink-0" />
            ) : (
              <WarningCircle size={17} weight="fill" className="text-rose-600 shrink-0" />
            )}
            <span className="leading-snug">{printFeedback.message}</span>
          </div>
        )}

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2 pt-1 no-print">
          {/* Cancel/Void Bill Button */}
          {isCancelled ? (
            <div className="py-2.5 px-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 select-none">
              <Prohibit size={15} weight="bold" />
              <span>{L.btnCancelled}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onCancelReceipt && onCancelReceipt(receipt)}
              className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
              title="ຍົກເລີກບິນນີ້ ແລະ ສົ່ງຄືນສະຕັອກສິນຄ້າເຂົ້າສາງ"
            >
              <Prohibit size={15} weight="bold" />
              <span>{L.btnCancel}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              playModalCloseBeep('receipt');
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
          >
            {L.btnClose}
          </button>
          <button
            type="button"
            onClick={() => {
              playModalConfirmBeep('receipt');
              handlePrint();
            }}
            disabled={isPrinting}
            className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            {isPrinting ? (
              <CircleNotch size={16} className="animate-spin text-teal-400" />
            ) : (
              <Printer size={16} />
            )}
            <span>{isPrinting ? L.btnPrintProgress : L.btnPrint}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
