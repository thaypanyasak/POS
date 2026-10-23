import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
import { printReceiptSmart, printViaNativeSpooler, getPrinterConfig } from '../services/printerService';
import { generateBarcode128 } from '../services/receiptCanvasEngine';
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
  products = [],
}) {
  // K80 80mm hardcoded — no 58mm support
  const paperWidth = 80;
  if (!isOpen || !receipt) return null;

  const isQuotation = Boolean(receipt.isQuotation);
  const isCancelled = !isQuotation && (receipt.status === 'cancelled' || receipt.isCancelled);

  const receiptItems =
    receipt.items && receipt.items.length > 0
      ? receipt.items
      : (receipt.sale_transaction_items && receipt.sale_transaction_items.length > 0
          ? receipt.sale_transaction_items
          : []);
  const pm = String(receipt.paymentMethod || receipt.payment_method || 'cash').toLowerCase();
  const isDebt = pm === 'debt' || Boolean(receipt.isDebt);
  const isCash = pm === 'cash';
  const isTransferPayment = !isQuotation && (pm === 'transfer' || pm === 'onepay' || pm === 'qrtransfer' || pm === 'qr' || (!isCash && !isDebt));

  // Bilingual Receipt Language: 'lo' (default) | 'vi'
  const [receiptLanguage, setReceiptLanguage] = useState('lo');

  // Print Method: 'spooler' (AirPrint / OS Spooler - Nét Vector) | 'socket' (In nhanh qua TCP Socket)
  const [printMethod, setPrintMethod] = useState(() => {
    return getPrinterConfig().printMethod || 'spooler';
  });

  const [isPrinting, setIsPrinting] = useState(false);
  const [printFeedback, setPrintFeedback] = useState(null);

  const handleSelectPrintMethod = (method) => {
    setPrintMethod(method);
    try {
      localStorage.setItem('pos_print_method', method);
    } catch (_) {}
  };

  // Comprehensive Bilingual Receipt Dictionary (Lao / Vietnamese)
  const LABELS = {
    lo: {
      storeName: 'ຮ້ານ ສົມສັກ',
      storeSlogan: '',
      storeAddress: 'ບ້ານ ໂພນສະຫວັນ, ນະຄອນປາກເຊ, ຈຳປາສັກ',
      storeTel: '020 56468780 / 02052228432',
      receiptTitle: 'ໃບບິນຮັບເງິນ / RECEIPT',
      voidTitle: 'ໃບບິນນີ້ຖືກຍົກເລີກແລ້ວ (VOID)',
      voidDesc: 'ສິນຄ້າຖືກສົ່ງຄືນເຂົ້າສາງແລ້ວ',
      status: 'ສະຖານະ:',
      cancelled: 'ຍົກເລີກແລ້ວ (Cancelled)',
      cashier: 'ຜູ້ຂາຍ :',
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
      signDebtor: 'ລາຍເຊັນຜູ້ຄ້າງຊຳລະ',
      signCustomer: 'ຜູ້ຮັບເຄື່ອງ',
      signSeller: 'ລາຍເຊັນຜູ້ຂາຍ',
      signCashier: 'ພະນັກງານຂາຍ',
      thankYou: [
        'ຂໍຂອບໃຈລູກຄ້າທີ່ມາອຸດໜູນຮ້ານເຮົາ',
        'ຫວັງວ່າຈະໄດ້ຕ້ອນຮັບທ່ານອີກຄັ້ງໃນໂອກາດໜ້າ',
      ],
      returnPolicy: [
        'ກະລຸນາກວດສອບສິນຄ້າໃຫ້ຄົບຖ້ວນ ກ່ອນອອກຈາກຮ້ານ',
        'ສິນຄ້າສາມາດປ່ຽນ ຫຼື ຄືນໄດ້ພາຍໃນ 7 ວັນ ຕາມເງື່ອນໄຂຂອງຮ້ານ',
      ],
      loadingItems: '(ກຳລັງໂຫຼດລາຍການສິນຄ້າ...)',
      defaultItemName: 'ສິນຄ້າ',
      defaultUnitName: 'ອັນ',
      quotationTitle: 'ໃບບອກລາຄາ / QUOTATION',
      quotationWarning: '*** ໃບນີ້ບໍ່ແມ່ນໃບບິນຮັບເງິນ / NOT A RECEIPT ***',
      quotationNotice: 'ໃບສະເໜີລາຄາຊົ່ວຄາວ',
      quotationTerms: [
        '• ໃບສະເໜີລາຄານີ້ມີກຳນົດ 3 ວັນ ນັບຈາກວັນທີອອກໃບ.',
        '• ລາຄານີ້ອາດມີການປ່ຽນແປງຕາມສະພາບຕະຫຼາດຕົວຈິງ.',
        '• ຂໍຂອບໃຈລູກຄ້າທີ່ໃຫ້ຄວາມສົນໃຈສິນຄ້າຮ້ານເຮົາ!',
      ],
      signQuotationCustomer: 'ລູກຄ້າ (Customer)',
      signQuotationStaff: 'ພະນັກງານອອກໃບ (Staff)',
      btnCancel: 'ຍົກເລີກບິນ',
      btnCancelled: 'ບິນນີ້ຍົກເລີກແລ້ວ',
      btnClose: 'ປິດໜ້າຕ່າງ',
      btnPrint: 'ພິມໃບບິນ',
      btnPrintQuotation: 'ພິມໃບບອກລາຄາ',
      btnPrintProgress: 'ກຳລັງພິມ...',
    },
    vi: {
      storeName: 'CỬA HÀNG SOMSAK',
      storeSlogan: '',
      storeAddress: 'Làng Phonesavanh, TP.Pakse, Champasak',
      storeTel: '020 56468780 / 02052228432',
      receiptTitle: 'HÓA ĐƠN BÁN HÀNG',
      voidTitle: 'HÓA ĐƠN NÀY ĐÃ HỦY ',
      voidDesc: 'Hàng hóa đã được hoàn lại vào kho',
      status: 'Trạng thái:',
      cancelled: 'ĐÃ HỦY',
      cashier: 'Thu ngân :',
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
      signDebtor: 'Chữ ký người nợ',
      signCustomer: 'Người nhận hàng',
      signSeller: 'Người bán hàng',
      signCashier: 'Nhân viên thu ngân',
      thankYou: [
        'Cảm ơn quý khách đã ủng hộ cửa hàng chúng tôi',
        'Rất mong được đón tiếp quý khách lần sau',
      ],
      returnPolicy: [
        'Vui lòng kiểm tra kỹ hàng hóa trước khi rời cửa hàng',
        'Hàng có thể đổi hoặc trả trong vòng 7 ngày theo quy định',
      ],
      loadingItems: '(Đang tải danh sách hàng...)',
      defaultItemName: 'Sản phẩm',
      defaultUnitName: 'Cái',
      quotationTitle: 'BẢNG BÁO GIÁ / QUOTATION',
      quotationWarning: '*** ĐÂY LÀ BÁO GIÁ - KHÔNG PHẢI HÓA ĐƠN ***',
      quotationNotice: 'Báo giá tạm tính',
      quotationTerms: [
        '• Báo giá có hiệu lực trong vòng 3 ngày kể từ ngày lập.',
        '• Giá có thể thay đổi theo biến động thực tế của thị trường.',
        '• Cảm ơn quý khách đã quan tâm đến cửa hàng chúng tôi!',
      ],
      signQuotationCustomer: 'Khách hàng (Customer)',
      signQuotationStaff: 'Nhân viên báo giá (Staff)',
      btnCancel: 'Hủy hóa đơn',
      btnCancelled: 'Hóa đơn đã hủy',
      btnClose: 'Đóng cửa sổ',
      btnPrint: 'In hóa đơn',
      btnPrintQuotation: 'In bảng báo giá',
      btnPrintProgress: 'Đang in...',
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

  // Ultra-robust product name resolution for bilingual receipt
  const resolveItemName = (it, lang) => {
    const rawLao = it.product?.name || it.productName || it.product_name || it.name || L.defaultItemName;
    if (lang !== 'vi') return rawLao;

    // 1. Check direct fields on item and item.product
    const directVi =
      it.name_vi ||
      it.nameVi ||
      it.product_name_vi ||
      it.productNameVi ||
      it.name_vietnam ||
      it.name_vn ||
      it.product?.name_vi ||
      it.product?.nameVi ||
      it.product?.name_vietnam ||
      it.product?.name_vn;

    if (directVi && String(directVi).trim()) {
      return String(directVi).trim();
    }

    // 2. Look up in products prop by ID or Lao name
    const prodId = it.product?.id || it.productId || it.product_id || it.id;
    if (products && Array.isArray(products) && products.length > 0) {
      const match = products.find(
        (p) => (prodId && p.id === prodId) || (rawLao && p.name && p.name.trim() === rawLao.trim())
      );
      const matchVi = match?.name_vi || match?.nameVi || match?.name_vietnam || match?.name_vn;
      if (matchVi && String(matchVi).trim()) {
        return String(matchVi).trim();
      }
    }

    // 3. Fallback: Look up in localStorage products cache
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('meiishop_products_v5') : null;
      if (saved) {
        const pool = JSON.parse(saved);
        if (Array.isArray(pool)) {
          const match = pool.find(
            (p) => (prodId && p.id === prodId) || (rawLao && p.name && p.name.trim() === rawLao.trim())
          );
          const matchVi = match?.name_vi || match?.nameVi || match?.name_vietnam || match?.name_vn;
          if (matchVi && String(matchVi).trim()) {
            return String(matchVi).trim();
          }
        }
      }
    } catch (_) {}

    return rawLao;
  };

  const handlePrint = async (overrideMethod = null) => {
    if (isPrinting) return;
    setIsPrinting(true);
    setPrintFeedback(null);

    const activeMethod = overrideMethod || printMethod;

    try {
      let res;
      if (activeMethod === 'spooler') {
        // Native Print Spooler (AirPrint / OS Dialog) — Vector-sharp typography
        res = await printViaNativeSpooler('thermal-receipt-print-area', receiptLanguage);
      } else {
        // Socket Print (Port 9100) — Direct ESC/POS with timeout protection
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error('ໝົດເວລາເຊື່ອມຕໍ່ຫາເຄື່ອງພິມ (Timeout 8s). ກະລຸນາກວດສອບວ່າເຄື່ອງພິມເປີດຢູ່ ແລະ ຢູ່ Wi-Fi ດຽວກັນ.')
              ),
            8000
          )
        );

        const printPromise = printReceiptSmart({
          elementId: 'thermal-receipt-print-area',
          receipt: {
            ...receipt,
            products: (products && products.length > 0) ? products : receipt.products,
          },
          language: receiptLanguage,
          allowFallback: false,
          method: 'socket',
          products: (products && products.length > 0) ? products : receipt.products,
        });

        res = await Promise.race([printPromise, timeoutPromise]);
      }

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

  const modalContent = (
    <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 print:static print:inset-auto print:p-0 print:bg-transparent print:backdrop-blur-none print:block">
      <div className="bg-slate-100 rounded-3xl max-w-[390px] w-full p-2.5 sm:p-3 shadow-2xl flex flex-col max-h-[85dvh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200 relative print:static print:max-h-none print:h-auto print:overflow-visible print:p-0 print:shadow-none print:border-none print:bg-white print:w-full print:max-w-none">
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

        {/* Top Toolbar: Language Selector & Close — Exact match with design reference */}
        <div className="flex items-center justify-between gap-1.5 pb-2 bg-white p-2 rounded-2xl no-print shrink-0 shadow-2xs">
          {/* Left: Language Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => {
                playUnitChangeBeep('receipt');
                setReceiptLanguage('lo');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                receiptLanguage === 'lo'
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="ພາສາລາວ"
            >
              <span>LA ພາສາລາວ</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playUnitChangeBeep('receipt');
                setReceiptLanguage('vi');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                receiptLanguage === 'vi'
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tiếng Việt"
            >
              <span>VN Tiếng Việt</span>
            </button>
          </div>

          {/* Right: Close button */}
          <button
            type="button"
            onClick={() => {
              playModalCloseBeep('receipt');
              onClose();
            }}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Receipt Area — Smooth scrolling on mobile without hiding buttons */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 pr-0.5 rounded-2xl">
          {/* Authentic Thermal Receipt Paper Container — Uses Noto Sans Lao for Preview */}
          <div
            id="thermal-receipt-print-area"
          style={{
            fontFamily: receiptLanguage === 'vi'
              ? "'Be Vietnam Pro', 'Noto Sans Lao', sans-serif"
              : "'Noto Sans Lao', 'Outfit', sans-serif",
          }}
          className={`bg-white mx-auto px-4 pt-4 pb-2 border border-slate-200 shadow-sm text-slate-900 print:p-0 print:border-none print:shadow-none print:overflow-visible print:max-h-none print:h-auto paper-80mm w-full max-w-full rounded-2xl ${
            receiptLanguage === 'vi' ? 'font-vietnam' : 'font-lao'
          }`}
        >
          {/* Store Header */}
          <div className="text-center pb-2">
            <h2 className="text-lg font-black text-slate-950 leading-normal tracking-wide pt-0.5">{L.storeName}</h2>
            {L.storeSlogan && (
              <p className="text-xs text-slate-700 font-bold leading-normal mt-0.5">
                {L.storeSlogan}
              </p>
            )}
            <p className="text-xs text-slate-700 font-medium leading-normal">
              {L.storeAddress}
            </p>
            <p className="text-xs text-slate-900 font-bold leading-normal">
              {L.storeTel}
            </p>
          </div>

          {/* Receipt Title Banner (Spacious Padding between borders) */}
          <div className="py-3.5 my-2 border-y-2 border-slate-900 text-center font-black text-sm flex items-center justify-center leading-none uppercase">
            {isQuotation ? L.quotationTitle : L.receiptTitle}
          </div>

          {/* Quotation Warning Banner */}
          {isQuotation && (
            <div className="my-1.5 py-1 px-2 bg-amber-50 text-amber-900 border border-amber-300 rounded text-center text-[10px] font-black uppercase tracking-wide">
              {L.quotationWarning}
            </div>
          )}

          {/* Void / Cancelled Watermark Banner */}
          {isCancelled && (
            <div className="my-2 p-2 bg-rose-600 text-white font-black text-center rounded-lg shadow-xs border-2 border-rose-800 animate-in fade-in">
              <div className="flex items-center justify-center gap-1.5 text-xs tracking-wider uppercase">
                <Prohibit size={18} weight="bold" />
                <span>{L.voidTitle}</span>
              </div>
              <p className="text-[10px] font-medium opacity-95 mt-0.5 leading-normal">
                {receipt.cancelledAt ? `${L.date} ${new Date(receipt.cancelledAt).toLocaleString(receiptLanguage === 'vi' ? 'vi-VN' : 'lo-LA')}` : ''} • {L.voidDesc}
              </p>
            </div>
          )}

          {/* Metadata Info */}
          <div className="flex flex-col gap-1.5 text-xs text-slate-800 pb-2 leading-normal">
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
                <span className="text-slate-500 font-normal">{L.cashier}</span>
                <span className="font-medium text-slate-800 truncate">
                  {(!receipt.cashierName || receipt.cashierName.includes('\u0ec4\u0ea1\u0ec9\u0e84\u0eb3') || receipt.cashierName.includes('Meii')) ? 'Meii' : receipt.cashierName}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1 truncate max-w-[50%] pt-0.5">
                <span className="text-slate-500 font-normal">{L.customer}</span>
                <span className="font-medium text-slate-800 truncate">
                  {(!receipt.customerName || receipt.customerName === 'ລູກຄ້າທົ່ວໄປ' || receipt.customerName === 'Khách lẻ / Khách vãng lai')
                    ? L.defaultCustomer
                    : receipt.customerName}
                </span>
              </div>
            </div>

            {/* Row 2: Date & Time (Left) + Payment Method (Right) */}
            <div className="flex justify-between items-center pt-0.5">
              <div className="flex items-center gap-1 font-mono text-[10px] text-slate-700 pt-0.5">
                <span className="font-sans text-slate-500 font-normal">{L.date}</span>
                <span>{new Date(receipt.createdAt).toLocaleString(receiptLanguage === 'vi' ? 'vi-VN' : 'lo-LA')}</span>
              </div>
              {!isQuotation && (
                <div className="flex items-center gap-1 text-[10.5px] pt-0.5">
                  <span className="text-slate-500 font-normal">{L.payment}</span>
                  <span className="font-bold text-teal-700">
                    {receipt.paymentMethod === 'cash'
                      ? L.payCash
                      : (receipt.paymentMethod === 'transfer' || receipt.paymentMethod === 'qrTransfer' || receipt.paymentMethod === 'onepay')
                      ? L.payQr
                      : receipt.paymentMethod === 'debt'
                      ? (Number(receipt.paidAmount || 0) === 0 ? L.payDebtFull : L.payDebtPartial)
                      : L.payTransfer}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Items Divider (Clean non-bordered visual) */}
          <div className="border-t border-dashed border-slate-300 my-2"></div>

          {/* Item Rows - Modern 2-Line Layout (Item Name on line 1, indented Qty x Price & Total on line 2) */}
          <div className="flex flex-col gap-3.5 pb-2">
            {receiptItems.length > 0 ? (
              receiptItems.map((it, i) => {
                // Name resolution: In Vietnamese mode, prioritize name_vi / nameVi with multi-source lookup, fallback to Lao name
                const prodName = resolveItemName(it, receiptLanguage);

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
                const feePerCrate = Number(it.crateDepositFee || it.product?.crateDepositFee) || 30000;
                const rawLineTotal = Number(it.lineTotal || it.line_total) || 0;
                const diffTotal = (rawLineTotal > baseLineTotal) ? (rawLineTotal - baseLineTotal) : 0;
                const explicitCrateTotal = Number(it.crateDepositTotal) || (it.noEmptyCrates ? ((Number(it.missingCratesCount) || qty) * feePerCrate) : 0);
                const crateDepositTotal = explicitCrateTotal > 0 ? explicitCrateTotal : diffTotal;
                const missingCount = Number(it.missingCratesCount) || (crateDepositTotal > 0 ? Math.round(crateDepositTotal / feePerCrate) : (it.noEmptyCrates ? qty : 0));
                const hasMissingCrates = Boolean(
                  crateDepositTotal > 0 || it.noEmptyCrates || (Number(it.missingCratesCount) > 0)
                );

                return (
                  <div key={i} className="receipt-item-row flex flex-col text-xs leading-[1.2]">
                    {/* Line 1: Number + Full Product Name + (Unit) */}
                    <div className="font-bold text-slate-900 text-left break-words">
                      {i + 1}. {prodName} <span className="font-medium text-slate-600 text-[11px]">({unitName})</span>
                    </div>

                    {/* Line 2: Qty x Unit Price (indented ~12px / 3 characters) on Left, Line Total on Right */}
                    <div className="flex justify-between items-center pl-3 pt-0.5 text-slate-800">
                      <span className="font-sans font-normal text-slate-700 text-[11px]">
                        {qty} x {formatKip(price).replace(' ₭', '')}
                      </span>
                      <span className="font-sans font-bold text-slate-950 text-xs tracking-tight">
                        {formatKip(baseLineTotal).replace(' ₭', '')}
                      </span>
                    </div>

                    {/* Crate Deposit row for bottles/beers without empty crates to exchange (+30.000 ₭/crate) */}
                    {hasMissingCrates && missingCount > 0 && (
                      <div className="flex justify-between items-center pl-3 text-[10px] text-amber-900 pt-0.5">
                        <span className="font-medium">
                          {L.missingCrate}: {missingCount} x {formatKip(feePerCrate).replace(' ₭', '')}
                        </span>
                        <span className="font-bold">
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
          <div className="border-b border-dashed border-slate-300 mb-1.5"></div>

          {/* Totals Summary */}
          {(() => {
            const calculatedTotal = receiptItems.reduce((sum, it) => {
              const rawLTotal = Number(it.lineTotal || it.line_total);
              if (rawLTotal > 0) return sum + rawLTotal;
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
              const qty = Number(it.quantity) || 1;
              const fee = Number(it.crateDepositFee || it.product?.crateDepositFee) || 30000;
              const explicit = Number(it.crateDepositTotal) || (it.noEmptyCrates ? ((Number(it.missingCratesCount) || qty) * fee) : 0);
              return sum + (price * qty) + explicit;
            }, 0);

            const subtotal = Number(receipt.subtotal) || calculatedTotal;
            const discount = Number(receipt.discountTotal || receipt.discount) || 0;
            const finalGrandTotal = Number(receipt.grandTotal) || (subtotal - discount);

            const paidAmt = Number(receipt.paidAmount) || Number(receipt.amountTendered || receipt.amount_tendered) || 0;
            const debtAmt = (receipt.debtAmount !== undefined && receipt.debtAmount !== null && Number(receipt.debtAmount) > 0)
              ? Number(receipt.debtAmount)
              : (receipt.remainingDebt !== undefined && receipt.remainingDebt !== null && Number(receipt.remainingDebt) > 0)
              ? Number(receipt.remainingDebt)
              : Math.max(0, finalGrandTotal - paidAmt);

            return (
              <div className="flex flex-col gap-1.5 py-2 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>{L.subtotalLabel}</span>
                  <span className="font-sans font-medium tracking-tight">{formatKip(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>{L.discountLabel}</span>
                    <span className="font-sans font-medium tracking-tight">-{formatKip(discount)}</span>
                  </div>
                )}
                <div className="border-b-2 border-slate-900 my-1.5"></div>
                <div className="flex justify-between items-center py-2.5 my-0.5">
                  <span className="font-extrabold text-base text-slate-950 leading-none">{L.grandTotalLabel}</span>
                  <span className="font-extrabold text-xl text-teal-700 font-mono tracking-tight leading-none">
                    {formatKip(finalGrandTotal)}
                  </span>
                </div>
                <div className="border-b-2 border-slate-900 my-1.5"></div>

                {(receipt.paymentMethod === 'debt' || receipt.isDebt) ? (
                  <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-300 flex flex-col gap-2.5 my-1.5 leading-normal">
                    <div className="flex justify-between items-center text-slate-800">
                      <span className="font-bold text-[11px] pt-0.5">{L.paidLabel}</span>
                      <span className="font-mono font-black text-emerald-800 text-xs pt-0.5">
                        {formatKip(paidAmt)}
                      </span>
                    </div>
                    <div className="border-b border-dashed border-amber-300"></div>
                    <div className="flex justify-between items-center text-red-700 font-black">
                      <span className="text-xs pt-0.5">{L.debtBalanceLabel}</span>
                      <span className="font-mono text-sm tracking-tight font-black pt-0.5">
                        {formatKip(debtAmt)}
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
                    <div className="flex justify-between text-slate-700 leading-normal text-xs py-0.5">
                      <span className="pt-0.5">{L.tenderedLabel}</span>
                      <span className="font-bold font-mono text-slate-900 pt-0.5">
                        {formatKip(receipt.amountTendered)}
                      </span>
                    </div>
                    {receipt.paymentMethod === 'cash' && (
                      <div className="flex justify-between text-slate-900 font-bold leading-normal text-xs py-0.5">
                        <span className="pt-0.5">{L.changeLabel}</span>
                        <span className="font-mono text-emerald-600 font-bold text-xs pt-0.5">
                          {formatKip(receipt.changeAmount)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* QR Code in receipt for transfer payments or unpaid debt - Large & Scannable */}
          {!isQuotation && (isTransferPayment || (receipt.paymentMethod === 'debt' && (receipt.debtAmount ?? receipt.grandTotal) > 0)) && (
            <div className="my-2 py-1 text-center flex flex-col items-center leading-normal">
              <div className="w-44 h-44 sm:w-52 sm:h-52 bg-white p-2 rounded-xl border border-slate-300 shadow-xs flex items-center justify-center">
                <img
                  src="/qr.jpg"
                  alt="Lao QR Payment"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src =
                      'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=LAO_QR_BCEL_POS_DEMO';
                  }}
                />
              </div>
              <span className="text-[12px] font-bold text-slate-800 mt-1">
                ທ່ານ ສົມສັກ ( ນ. ຄຳຈູ່ ດັ່ງຈະເລີນ ຂາຍເບຍ)
              </span>
            </div>
          )}

          {/* Signatures Section (Hidden for Quotation per user request) */}
          {!isQuotation && (
            <div className="border-t border-dashed border-slate-300 pt-3 pb-3 grid grid-cols-2 text-[10px] text-slate-700 text-center leading-normal">
              <div className="flex flex-col items-center">
                <p className="font-bold text-slate-800 leading-normal pt-0.5">
                  {(receipt.paymentMethod === 'debt' || receipt.isDebt) ? L.signDebtor : L.signCustomer}
                </p>
                {/* Generous space for hand signature */}
                <div className="h-14"></div>
                <div className="w-32 sm:w-36 border-b-2 border-dotted border-slate-400"></div>
              </div>
              <div className="flex flex-col items-center">
                <p className="font-bold text-slate-800 leading-normal pt-0.5">
                  {(receipt.paymentMethod === 'debt' || receipt.isDebt) ? L.signSeller : L.signCashier}
                </p>
                {/* Generous space for hand signature */}
                <div className="h-14"></div>
                <div className="w-32 sm:w-36 border-b-2 border-dotted border-slate-400"></div>
              </div>
            </div>
          )}

          {/* Barcode & Footer Strip */}
          {(() => {
            const bc = generateBarcode128(receipt.receiptNumber || 'MEII-POS');
            return (
              <div className="border-t border-dashed border-slate-300 pt-3 text-center leading-normal">
                {/* Standard Code 128 Barcode with uniform equal height */}
                <div className="flex items-center justify-center h-14 my-1 select-none overflow-hidden">
                  {bc.bits.split('').map((bit, idx) => (
                    <div
                      key={idx}
                      className={`w-[1.8px] sm:w-[2px] h-14 ${bit === '1' ? 'bg-black' : 'bg-transparent'}`}
                    />
                  ))}
                </div>
                <span className="text-[12px] text-slate-900 font-mono tracking-widest block font-black pt-1">
                  {receipt.receiptNumber || 'MEII-POS'}
                </span>
                <div className="mt-5 space-y-1">
                  {(Array.isArray(L.thankYou) ? L.thankYou : [L.thankYou]).map((tLine, idx) => (
                    <p key={`ty-${idx}`} className="text-xs text-slate-900 font-bold leading-normal pt-0.5">
                      {tLine}
                    </p>
                  ))}
                  <div className="pt-1 space-y-0.5">
                    {(Array.isArray(isQuotation ? L.quotationTerms : L.returnPolicy)
                      ? (isQuotation ? L.quotationTerms : L.returnPolicy)
                      : [isQuotation ? L.quotationTerms : L.returnPolicy]
                    ).map((pLine, idx) => (
                      <p key={`pol-${idx}`} className="text-[11px] text-slate-700 font-medium leading-normal">
                        {pLine}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
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

        {/* Action Buttons Toolbar — Pinned at bottom on mobile, always visible above bottomTab */}
        <div className="flex items-center gap-2 pt-2.5 pb-[max(0.4rem,env(safe-area-inset-bottom,0.4rem))] mt-auto border-t border-slate-200/60 shrink-0 bg-slate-100 no-print">
          {/* Cancel/Void Bill Button (Hidden for Quotation) */}
          {!isQuotation && (
            isCancelled ? (
              <div className="py-2.5 px-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 select-none shrink-0">
                <Prohibit size={15} weight="bold" />
                <span>{L.btnCancelled}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onCancelReceipt && onCancelReceipt(receipt)}
                className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 shadow-2xs shrink-0"
                title={receiptLanguage === 'vi' ? 'Hủy hóa đơn này' : 'ຍົກເລີກບິນນີ້'}
              >
                <Prohibit size={15} weight="bold" />
                <span>{L.btnCancel}</span>
              </button>
            )
          )}

          {/* Close Window Button */}
          <button
            type="button"
            onClick={() => {
              playModalCloseBeep('receipt');
              onClose();
            }}
            className="py-2.5 px-3.5 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
          >
            {L.btnClose}
          </button>

          {/* Primary Print Button (ພິມໃບບິນ) */}
          <button
            type="button"
            onClick={() => {
              playModalConfirmBeep('receipt');
              handlePrint();
            }}
            disabled={isPrinting}
            className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer truncate"
          >
            {isPrinting ? (
              <CircleNotch size={16} className="animate-spin text-teal-400 shrink-0" />
            ) : (
              <Printer size={16} weight="bold" className="shrink-0" />
            )}
            <span className="truncate">{isPrinting ? L.btnPrintProgress : (isQuotation ? L.btnPrintQuotation : L.btnPrint)}</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
