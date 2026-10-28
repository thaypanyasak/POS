/**
 * High-Resolution Professional POS Receipt Engine — MeiiShop POS
 * ══════════════════════════════════════════════════════════════
 * Standard: 80mm K80 (Physical Width: 576 dots / 72 bytes per line)
 *
 * Refinements:
 *  1. Large, authoritative Header:
 *     - Store Name: 42px Bold
 *     - Slogan: 21px Medium
 *     - Address: 18.5px
 *     - Tel: 21px Bold
 *  2. Perfectly Centered Title Banner (ໃບບິນຮັບເງິນ / RECEIPT):
 *     - 28px Bold with symmetric 14px top & bottom internal padding.
 *  3. Prominent Metadata:
 *     - Cashier, Customer, Date, Payment Method scaled to 19px - 21px Bold.
 *  4. Product List (preserved per request):
 *     - 23px Medium with 20px - 21px prices.
 *  5. Large & Airy Signature Area:
 *     - 21px Bold labels, generous 100px handwriting room for authentic signing,
 *     - Dots exclusively under the two columns.
 *  6. Oversized High-Contrast Barcode:
 *     - 50px height with 2.2x multiplier for instantaneous laser scanning.
 *  7. Big, Legible Thank You & Return Policy:
 *     - 21px Bold thank you, 18px return policy.
 */

// ─── 80mm K80 Physical Constants ──────────────────────────────────────────────
export const K80 = {
  CANVAS_WIDTH: 576,    // Physical print dots (72 bytes * 8)
  LEFT_MARGIN: 2,       // Edge-to-edge left (0.25mm safe tolerance to use 100% width)
  RIGHT_EDGE: 574,      // Edge-to-edge right (576 - 2 = 574 dots)
  PRINTABLE_WIDTH: 572, // 574 - 2 = 572 (Full utilization of 576 dots)
  CENTER_X: 288,        // Symmetry center (576 / 2)

  // 4-Column Grid (Spread across full 576 dots)
  COL_NAME_X: 2,        // Column 1: Item Name (starts right at left edge)
  COL_NAME_MAX_W: 280,  // Max width 280px (wrap if longer)
  COL_QTY_X: 310,       // Column 2: Qty (centered at 310px)
  COL_PRICE_X: 435,     // Column 3: Unit Price (right-aligned at 435px)
  COL_TOTAL_X: 574,     // Column 4: Line Total (right-aligned at 574px)
};

import { ensureSaysetthaLoaded } from '../utils/saysetthaFont';
import { ensureTahomaLoaded } from '../utils/tahomaFont';
import { ensureSegoeUiLoaded } from '../utils/segoeUiFont';

// ─── Typography (High-Res POS Scale — Large & Bold for Maximum Thermal Clarity) ──
export function getFonts(lang = 'lo') {
  const isVi = lang === 'vi';
  // Vietnamese bills use Segoe UI (inlined Base64 with Semibold 600 weight) with Saysettha OT fallback for un-translated Lao product names;
  // Lao bills stay 100% untouched on Saysettha OT.
  const textFont = isVi
    ? '"Segoe UI", "Tahoma", "Saysettha OT", "Saysettha", -apple-system, BlinkMacSystemFont, Arial, sans-serif'
    : '"Saysettha OT", "Saysettha", sans-serif';
  const numFont = isVi
    ? '"Segoe UI", "Tahoma", "Outfit", "Saysettha OT", "Saysettha", -apple-system, sans-serif'
    : '"Outfit", "Saysettha OT", "Saysettha", "Segoe UI", -apple-system, sans-serif';

  return {
    STORE_NAME: `bold 44px ${textFont}`,
    SLOGAN: `bold 26px ${textFont}`,
    ADDRESS: isVi ? `600 23px ${textFont}` : `bold 23px ${textFont}`,
    TEL: `bold 26px ${textFont}`,
    TITLE: `bold 32px ${textFont}`,
    META_LABEL: isVi ? `600 23px ${textFont}` : `23px ${textFont}`,
    META_VAL: isVi ? `600 24px ${textFont}` : `24px ${textFont}`,
    META_BOLD: `bold 26px ${textFont}`,
    COL_HEADER: `bold 24px ${textFont}`,
    COL_HEADER_REGULAR: isVi ? `600 24px ${textFont}` : `24px ${textFont}`,
    ITEM_NAME: isVi ? `600 24px ${textFont}` : `24px ${textFont}`,
    ITEM_UNIT: isVi ? `600 21px ${textFont}` : `21px ${textFont}`,
    ITEM_NUM: isVi ? `600 22px ${numFont}` : `22px ${numFont}`,
    ITEM_SUB_TEXT: isVi ? `600 23px ${textFont}` : `23px ${textFont}`,
    ITEM_TOTAL: isVi ? `600 22px ${numFont}` : `500 22px ${numFont}`,
    CRATE_LABEL: isVi ? `600 21px ${textFont}` : `21px ${textFont}`,
    CRATE_NUM: `21px ${numFont}`,
    SUBTOTAL_LABEL: isVi ? `600 24px ${textFont}` : `bold 24px ${textFont}`,
    SUBTOTAL_NUM: isVi ? `600 24px ${numFont}` : `bold 25px ${numFont}`,
    GRAND_LABEL: `bold 32px ${textFont}`,
    GRAND_NUM: `bold 38px ${numFont}`,
    TENDER_LABEL: isVi ? `600 24px ${textFont}` : `bold 24px ${textFont}`,
    TENDER_NUM: isVi ? `600 24px ${numFont}` : `bold 25px ${numFont}`,
    DEBT_LABEL: isVi ? `600 26px ${textFont}` : `bold 28px ${textFont}`,
    DEBT_NUM: isVi ? `600 26px ${numFont}` : `bold 30px ${numFont}`,
    QR_NAME: `bold 24px ${textFont}`,
    QR_AMOUNT_LABEL: `bold 26px ${textFont}`,
    QR_AMOUNT_NUM: `bold 26px ${numFont}`,
    SIGN_LABEL: isVi ? `600 24px ${textFont}` : `bold 25px ${textFont}`,
    SIGN_LINE: 'bold 22px monospace',
    BARCODE_NUM: `bold 24px ${numFont}`,
    FOOTER_BOLD: isVi ? `600 24px ${textFont}` : `24px ${textFont}`,
    FOOTER: isVi ? `600 21px ${textFont}` : `21px ${textFont}`,
    VOID_TEXT: `bold 30px ${textFont}`,
  };
}

export const FONTS = getFonts('lo');

// ─── Bilingual Dictionary ─────────────────────────────────────────────────────
const LABELS = {
  lo: {
    storeName: 'ຮ້ານ ສົມສັກ',
    storeSlogan: '',
    storeAddress: 'ບ້ານ ໂພນສະຫວັນ, ນະຄອນປາກເຊ, ຈຳປາສັກ',
    storeTel: '020 56468780 / 02052228432',
    receiptTitle: 'ໃບບິນຮັບເງິນ / RECEIPT',
    voidTitle: 'ໃບບິນນີ້ຖືກຍົກເລີກແລ້ວ (VOID)',
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
    defaultItemName: 'ສິນຄ້າ',
    defaultUnitName: 'ອັນ',
  },
  vi: {
    storeName: 'CỬA HÀNG SOMSAK',
    storeSlogan: '',
    storeAddress: 'Làng Phonesavanh, TP.Pakse, Champasak',
    storeTel: '020 56468780 / 02052228432',
    receiptTitle: 'HÓA ĐƠN BÁN HÀNG',
    voidTitle: 'HÓA ĐƠN ĐÃ HỦY (VOID)',
    cashier: 'Thu ngân :',
    customer: 'Khách hàng:',
    defaultCustomer: 'Khách lẻ',
    date: 'Ngày in:',
    payment: 'Thanh toán:',
    payCash: 'Tiền mặt',
    payQr: 'QR',
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
    defaultItemName: 'Sản phẩm',
    defaultUnitName: 'Cái',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtKip(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('de-DE') + ' ₭';
}

function fmtNum(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('de-DE');
}

/**
 * Word-wrap supporting Lao script, Vietnamese, English
 */
function wrapText(ctx, text, maxWidth) {
  if (!text) return [''];
  if (ctx.measureText(text).width <= maxWidth) return [text];

  const words = String(text).split(/(\s+)/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
        currentLine = '';
      }
      if (ctx.measureText(word).width > maxWidth) {
        for (const char of word) {
          if (ctx.measureText(currentLine + char).width <= maxWidth) {
            currentLine += char;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = char;
          }
        }
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines.length > 0 ? lines : [''];
}

function translateUnit(unitStr, lang, isHalf = false) {
  if (!unitStr) return lang === 'vi' ? 'Cái' : 'ອັນ';
  const clean = String(unitStr).trim().toLowerCase();
  const hasHalfPrefix = clean.startsWith('½') || clean.startsWith('1/2') || isHalf;
  const baseClean = clean.replace(/^(½|1\/2)\s*/, '');

  if (lang === 'vi') {
    let viBase = baseClean;
    if (['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'carton', 'box'].includes(baseClean)) viBase = 'Thùng';
    else if (['ແພັກ', 'ມັດ', 'pack', 'bundle'].includes(baseClean)) viBase = 'Lốc';
    else if (['ອັນ', 'cái', 'piece', 'unit'].includes(baseClean)) viBase = 'Cái';
    else if (['ແກ້ວ', 'chai', 'bottle'].includes(baseClean)) viBase = 'Chai';
    else if (['ປ໋ອງ', 'ກະປ໋ອງ', 'can'].includes(baseClean)) viBase = 'Lon';
    else if (['ຕຸກ'].includes(baseClean)) viBase = 'Chai';
    else if (['ຊອງ', 'ຖົງ'].includes(baseClean)) viBase = 'Gói';
    return hasHalfPrefix ? `½ ${viBase}` : viBase;
  }

  if (hasHalfPrefix && !unitStr.startsWith('½')) return `½ ${unitStr}`;
  return unitStr;
}

function preloadImage(src, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; resolve(null); }
    }, timeoutMs);
    img.onload = () => {
      if (!done) { done = true; clearTimeout(timer); resolve(img); }
    };
    img.onerror = () => {
      if (!done) { done = true; clearTimeout(timer); resolve(null); }
    };
    img.src = src;
  });
}

// Global cached QR image for instant receipts without re-fetching
let cachedQrImage = null;
let qrImageLoadingPromise = null;

export async function loadShopQrImage() {
  if (cachedQrImage && cachedQrImage.complete && cachedQrImage.naturalWidth > 0) {
    return cachedQrImage;
  }
  if (qrImageLoadingPromise) {
    return qrImageLoadingPromise;
  }
  qrImageLoadingPromise = (async () => {
    const paths = ['/qr.jpg', 'qr.jpg', './qr.jpg'];
    for (const p of paths) {
      try {
        const img = await preloadImage(p, 3000);
        if (img && img.naturalWidth > 0) {
          cachedQrImage = img;
          return img;
        }
      } catch (_) {}
    }
    return null;
  })();
  const result = await qrImageLoadingPromise;
  qrImageLoadingPromise = null;
  return result;
}

// ─── Standard Code 128-B Barcode Generator (GS1 / ISO/IEC 15417) ──────────────
// Encodes full alphanumeric invoice ID (e.g. INV-853773) with uniform bar height
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112', // 100-106 (104=Start B, 106=Stop)
];

export function generateBarcode128(text) {
  const str = String(text || 'MEII-POS').trim();
  let checkSum = 104; // Start B code
  const codes = [104];

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 32; // Map ASCII 32..126
    const validCode = (code >= 0 && code <= 95) ? code : 0;
    codes.push(validCode);
    checkSum += validCode * (i + 1);
  }

  codes.push(checkSum % 103);
  codes.push(106); // Stop symbol

  let bits = '';
  for (const c of codes) {
    const pattern = CODE128_PATTERNS[c] || CODE128_PATTERNS[0];
    for (let p = 0; p < pattern.length; p++) {
      const count = Number(pattern[p]);
      const bit = (p % 2 === 0) ? '1' : '0';
      bits += bit.repeat(count);
    }
  }

  return { text: str, bits, totalModules: bits.length };
}

export function generateUpca(rawCode) {
  return generateBarcode128(rawCode);
}

// ─── Drawing / Measuring Routine (Strict Top Baseline) ────────────────────────
let _cachedProductsRaw = null;
let _cachedProductsPool = null;

function getCachedProductsPool() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const saved = localStorage.getItem('meiishop_products_v5');
    if (!saved) return [];
    if (saved === _cachedProductsRaw && _cachedProductsPool) {
      return _cachedProductsPool;
    }
    _cachedProductsRaw = saved;
    _cachedProductsPool = JSON.parse(saved);
    return Array.isArray(_cachedProductsPool) ? _cachedProductsPool : [];
  } catch (_) {
    return [];
  }
}

function resolveCanvasItemName(it, lang, receipt, defaultItemName = 'ສິນຄ້າ') {
  const rawLao = it.product?.name || it.productName || it.product_name || it.name || defaultItemName;
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

  // 2. Look up in receipt.products if attached
  const prodId = it.product?.id || it.productId || it.product_id || it.id;
  if (receipt?.products && Array.isArray(receipt.products)) {
    const match = receipt.products.find(
      (p) => (prodId && p.id === prodId) || (rawLao && p.name && p.name.trim() === rawLao.trim())
    );
    const matchVi = match?.name_vi || match?.nameVi || match?.name_vietnam || match?.name_vn;
    if (matchVi && String(matchVi).trim()) {
      return String(matchVi).trim();
    }
  }

  // 3. Fallback: Look up in cached products pool (parsed once into RAM, eliminates repeated 3.5MB JSON parsing)
  try {
    const pool = getCachedProductsPool();
    if (Array.isArray(pool) && pool.length > 0) {
      const match = pool.find(
        (p) => (prodId && p.id === prodId) || (rawLao && p.name && p.name.trim() === rawLao.trim())
      );
      const matchVi = match?.name_vi || match?.nameVi || match?.name_vietnam || match?.name_vn;
      if (matchVi && String(matchVi).trim()) {
        return String(matchVi).trim();
      }
    }
  } catch (_) {}

  return rawLao;
}

function layoutReceipt(ctx, receipt, lang = 'lo', qrImage = null, pageInfo = null, customProducts = null) {
  const L = LABELS[lang] || LABELS.lo;
  const FONTS = getFonts(lang);
  const allItems = receipt.items?.length > 0 ? receipt.items
    : (receipt.sale_transaction_items?.length > 0 ? receipt.sale_transaction_items : []);
  const isMultiPage = Boolean(pageInfo && Number(pageInfo.totalPages) > 1);
  const items = isMultiPage ? allItems.slice(pageInfo.startIndex, pageInfo.endIndex) : allItems;
  const startItemIndex = isMultiPage ? Number(pageInfo.startIndex || 0) : 0;
  const isLastPage = !isMultiPage || Number(pageInfo.currentPage) === Number(pageInfo.totalPages);
  const isQuotation = Boolean(receipt.isQuotation);
  const isCancelled = !isQuotation && (receipt.status === 'cancelled' || receipt.isCancelled);
  const pm = String(receipt.paymentMethod || receipt.payment_method || 'cash').toLowerCase();
  const isDebt = !isQuotation && (pm === 'debt' || Boolean(receipt.isDebt));
  const isCash = !isQuotation && (pm === 'cash');
  const isTransfer = !isQuotation && (pm === 'transfer' || pm === 'onepay' || pm === 'qrtransfer' || pm === 'qr' || (!isCash && !isDebt));

  const isDraw = Boolean(ctx);
  if (isDraw) {
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000000';
  }

  const measureCtx = ctx || (typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null);
  if (measureCtx) {
    measureCtx.textBaseline = 'top';
  }

  const drawCenter = (text, y, font) => {
    if (isDraw) {
      ctx.fillStyle = '#000000';
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.fillText(text, K80.CENTER_X, y);
    }
  };

  const drawLeft = (text, x, y, font) => {
    if (isDraw) {
      ctx.fillStyle = '#000000';
      ctx.font = font;
      ctx.textAlign = 'left';
      ctx.fillText(text, x, y);
    }
  };

  const drawRight = (text, x, y, font) => {
    if (isDraw) {
      ctx.fillStyle = '#000000';
      ctx.font = font;
      ctx.textAlign = 'right';
      ctx.fillText(text, x, y);
    }
  };

  const drawDashedLine = (y) => {
    if (isDraw) {
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#000000';
      ctx.moveTo(0, y);
      ctx.lineTo(K80.CANVAS_WIDTH, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  const drawSolidLine = (y, width = 1.5) => {
    if (isDraw) {
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.lineWidth = width;
      ctx.strokeStyle = '#000000';
      ctx.moveTo(0, y);
      ctx.lineTo(K80.CANVAS_WIDTH, y);
      ctx.stroke();
    }
  };

  let y = 16; // Top margin

  // 1. STORE HEADER (Prominent, Large, Authoritative)
  if (L.storeName) {
    if (measureCtx) measureCtx.font = FONTS.STORE_NAME;
    const storeLines = measureCtx ? wrapText(measureCtx, L.storeName, K80.PRINTABLE_WIDTH) : [L.storeName];
    for (const sLine of storeLines) {
      drawCenter(sLine, y, FONTS.STORE_NAME);
      y += 52;
    }
    y += 2;
  }

  if (L.storeSlogan) {
    drawCenter(L.storeSlogan, y, FONTS.SLOGAN);
    y += 34;
  }

  if (L.storeAddress) {
    if (measureCtx) measureCtx.font = FONTS.ADDRESS;
    const addrLines = measureCtx ? wrapText(measureCtx, L.storeAddress, K80.PRINTABLE_WIDTH) : [L.storeAddress];
    for (const aLine of addrLines) {
      drawCenter(aLine, y, FONTS.ADDRESS);
      y += 30;
    }
    y += 4;
  }

  if (L.storeTel) {
    drawCenter(L.storeTel, y, FONTS.TEL);
    y += 38;
  }

  // 2. RECEIPT TITLE BANNER (Generous padding, dead center between borders)
  y += 6;
  const bannerTopY = y;
  drawSolidLine(bannerTopY, 2.5);

  const bannerHeight = 72; // Spacious banner height for 32px font
  const bannerMidY = bannerTopY + (bannerHeight / 2); // Exact middle

  let titleText = isQuotation ? L.quotationTitle : L.receiptTitle;
  if (isMultiPage) {
    titleText += lang === 'vi'
      ? ` (Trang ${pageInfo.currentPage}/${pageInfo.totalPages})`
      : ` (ໜ້າ ${pageInfo.currentPage}/${pageInfo.totalPages})`;
  }

  if (isDraw) {
    ctx.textBaseline = 'middle';
    ctx.font = FONTS.TITLE;
    ctx.textAlign = 'center';
    // Shift up 2.5px optically so the base characters sit dead center between borders
    ctx.fillText(titleText, K80.CENTER_X, bannerMidY - 2.5);
    ctx.textBaseline = 'top'; // Reset baseline
  }

  const bannerBottomY = bannerTopY + bannerHeight;
  drawSolidLine(bannerBottomY, 2.5);
  y = bannerBottomY + 14;

  if (isQuotation) {
    drawCenter(L.quotationWarning, y, FONTS.FOOTER_BOLD);
    y += 34;
  } else {
    y += 10;
  }

  // 3. VOID BANNER (IF CANCELLED)
  if (isCancelled) {
    if (isDraw) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(K80.LEFT_MARGIN, y, K80.PRINTABLE_WIDTH, 44);
      ctx.fillStyle = '#ffffff';
      drawCenter(L.voidTitle, y + 10, FONTS.VOID_TEXT);
      ctx.fillStyle = '#000000';
    }
    y += 54;
  }

  // 4. METADATA SECTION (Clear, Bolder, High-Contrast Typography)
  // Row 1: Cashier & Customer
  const rawCashier = receipt.cashierName || receipt.cashier_name || '';
  const cashierDisp = (!rawCashier || rawCashier.includes('\u0ec4\u0ea1\u0ec9\u0e84\u0eb3') || rawCashier.toLowerCase() === 'meii') ? 'Meii' : rawCashier;
  drawLeft(`${L.cashier} ${cashierDisp}`, K80.LEFT_MARGIN, y, FONTS.META_VAL);
  const custName = (!receipt.customerName || receipt.customerName === 'ລູກຄ້າທົ່ວໄປ' || receipt.customerName === 'Khách lẻ / Khách vãng lai')
    ? L.defaultCustomer
    : receipt.customerName;
  drawRight(`${L.customer} ${custName}`, K80.RIGHT_EDGE, y, FONTS.META_VAL);
  y += 34;

  // Row 2: Date & Payment Method (Payment omitted for Quotation)
  const dateStr = receipt.createdAt
    ? new Date(receipt.createdAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'lo-LA')
    : new Date().toLocaleString();
  drawLeft(`${L.date} ${dateStr}`, K80.LEFT_MARGIN, y, FONTS.META_LABEL);

  if (!isQuotation) {
    let payLabel = L.payCash;
    if (receipt.paymentMethod === 'cash') payLabel = L.payCash;
    else if (['transfer', 'qrTransfer', 'onepay'].includes(receipt.paymentMethod)) payLabel = L.payQr;
    else if (receipt.paymentMethod === 'debt') {
      payLabel = Number(receipt.paidAmount || 0) === 0 ? L.payDebtFull : L.payDebtPartial;
    } else payLabel = L.payTransfer;
    drawRight(`${L.payment} ${payLabel}`, K80.RIGHT_EDGE, y, FONTS.META_VAL);
  }
  y += 36;

  // 5. COLUMN HEADERS (4 Columns)
  // 5. ITEMS SECTION (Modern 2-Line Non-Bordered Layout: Name on line 1, Qty x Price & Total on line 2)
  drawDashedLine(y);
  y += 14;

  if (measureCtx) {
    measureCtx.textBaseline = 'top';
  }

  const indentX = K80.LEFT_MARGIN + 16; // Indented ~16px (2-3 characters)

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const prodName = resolveCanvasItemName(it, lang, receipt, L.defaultItemName);

    // Mixed carton bundle flavor breakdown if applicable (matches Image 2 style)
    let bundleComponents = it.bundle_components || it.bundleComponents;
    if (typeof bundleComponents === 'string') {
      try { bundleComponents = JSON.parse(bundleComponents); } catch (_) { bundleComponents = []; }
    }
    if (!Array.isArray(bundleComponents)) {
      bundleComponents = [];
    }

    const isBundleItem = Boolean(it.isBundle || it.is_bundle || it.bundleId || bundleComponents.length > 0);

    // Count total child pieces/packs
    const totalComponentPieces = bundleComponents.reduce((sum, c) => sum + (Number(c.quantity || c.qty) || 0), 0);

    // Detect packageQty and pack unit
    let packageQty = Number(it.packageQty || it.package_qty) || 0;
    let detectedBaseUnit = it.baseUnitName || '';

    if (isBundleItem) {
      let prodsPool = Array.isArray(customProducts) && customProducts.length > 0
        ? customProducts
        : (Array.isArray(receipt?.products) ? receipt.products : []);
      if (prodsPool.length === 0) {
        try {
          const saved = typeof window !== 'undefined' ? localStorage.getItem('meiishop_products_v5') : null;
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) prodsPool = parsed;
          }
        } catch (_) {}
      }
      if (prodsPool.length > 0 && bundleComponents.length > 0) {
        for (const comp of bundleComponents) {
          const cId = comp.productId || comp.product_id;
          const cName = comp.productName || comp.product_name || comp.name;
          const matched = prodsPool.find(
            (p) => (cId && p.id === cId) || (cName && p.name && p.name.trim() === cName.trim())
          );
          if (matched) {
            const uList = Array.isArray(matched.units) ? matched.units : [];
            if (!packageQty) {
              const cartonU = uList.find(
                (u) => u.tier === 3 || u.id?.endsWith('_carton') || ['ແກັດ', 'ລັງ'].includes(u.unitName)
              );
              if (cartonU?.multiplier && Number(cartonU.multiplier) > 1) {
                packageQty = Number(cartonU.multiplier);
              }
            }
            if (!detectedBaseUnit) {
              const packU = uList.find(
                (u) => u.tier === 2 || u.id?.endsWith('_pack') || ['ແພັກ', 'pack'].includes(u.unitName)
              );
              if (packU?.unitName) {
                detectedBaseUnit = packU.unitName;
              } else {
                const baseU = uList.find((u) => u.isBaseUnit || Number(u.multiplier) === 1);
                if (baseU?.unitName) detectedBaseUnit = baseU.unitName;
              }
            }
          }
          if (packageQty && detectedBaseUnit) break;
        }
      }

      if (!packageQty || !detectedBaseUnit) {
        try {
          const cachedBundles = JSON.parse(localStorage.getItem('meiishop_bundles_cache') || '[]');
          const foundB = cachedBundles.find(
            (b) => (it.bundleId && b.id === it.bundleId) ||
                   (it.productId && b.id === it.productId) ||
                   (it.productName && b.name && b.name.trim() === it.productName.trim())
          );
          if (foundB) {
            if (!packageQty) packageQty = Number(foundB.package_qty) || 0;
            if (!detectedBaseUnit) detectedBaseUnit = foundB.base_unit_name || '';
          }
        } catch (_) {}
      }
    }

    if (!packageQty) packageQty = 12;
    if (!detectedBaseUnit) detectedBaseUnit = 'ແພັກ';

    const explicitCartonQty = it.cartonQty !== undefined && it.cartonQty !== null ? Number(it.cartonQty) : null;
    const explicitLooseQty = it.looseQty !== undefined && it.looseQty !== null ? Number(it.looseQty) : null;

    const isOnlyLooseBundle = isBundleItem && (
      (explicitCartonQty === 0 && explicitLooseQty > 0) ||
      (totalComponentPieces > 0 && (
        (explicitCartonQty === 0) ||
        (explicitCartonQty === null && totalComponentPieces < packageQty) ||
        (Number(it.quantity) === 1 && totalComponentPieces > 1 && totalComponentPieces < packageQty)
      ))
    );

    const rawUnit = isOnlyLooseBundle
      ? (detectedBaseUnit || 'ແພັກ')
      : (it.unit?.unitName || it.unitName || it.unit_name || L.defaultUnitName);
    const unitName = translateUnit(rawUnit, lang, Boolean(it.isHalfCarton));
    const globalItemNum = startItemIndex + i + 1;

    // Detect half-carton item to optimize display (remove (½...) from line 1 and put "ເຄິ່ງແກັດ" on line 2)
    const isHalfCartonItem = Boolean(
      it.isHalfCarton ||
      (rawUnit && (rawUnit.includes('½') || rawUnit.includes('1/2'))) ||
      (unitName && (unitName.includes('½') || unitName.includes('1/2'))) ||
      (it.unitName && (it.unitName.includes('½') || it.unitName.includes('1/2')))
    );

    const cleanProdName = prodName.replace(/\s*\((½|1\/2)[^)]*\)/gi, '').trim();
    const fullName = isHalfCartonItem
      ? `${globalItemNum}. ${cleanProdName}`
      : `${globalItemNum}. ${prodName} (${unitName})`;

    let qty = it.quantity || 1;
    if (isOnlyLooseBundle) {
      if (totalComponentPieces > 0) {
        qty = totalComponentPieces;
      } else if (explicitLooseQty > 0) {
        qty = explicitLooseQty;
      }
    }

    const rawLineTotal = Number(it.lineTotal || it.line_total) || 0;
    const rawPrice = Number(
      it.customPrice ??
      it.effectivePrice ??
      it.effectiveUnitPrice ??
      it.unitPrice ??
      it.unit_price ??
      it.price ??
      (receipt.isWholesale
        ? (it.unit?.wholesalePrice ?? it.unit?.retailPrice ?? 0)
        : (it.unit?.retailPrice ?? 0))
    ) || 0;

    const price = isOnlyLooseBundle
      ? (rawLineTotal > 0 && qty > 0 ? Math.round(rawLineTotal / qty) : (rawPrice > 0 ? rawPrice : 0))
      : (rawPrice > 0 && rawPrice * qty === rawLineTotal
          ? rawPrice
          : (rawLineTotal > 0 && qty > 0 ? Math.round(rawLineTotal / qty) : rawPrice));
    const lineTotal = rawLineTotal > 0 ? rawLineTotal : price * qty;

    // Line 1: Number + Full Product Name (across full printable width)
    measureCtx.font = FONTS.ITEM_NAME;
    const nameLines = wrapText(measureCtx, fullName, K80.PRINTABLE_WIDTH);
    for (const nLine of nameLines) {
      drawLeft(nLine, K80.LEFT_MARGIN, y, FONTS.ITEM_NAME);
      y += 28; // Compact line-height (1.2)
    }

    // Line 2: Indented "Qty x Price" (or "ເຄິ່ງແກັດ" for half-cartons) on Left, "Line Total" on Right
    const halfLabel = lang === 'vi' ? 'Nửa thùng' : 'ເຄິ່ງແກັດ';
    const qtyPriceStr = isHalfCartonItem
      ? `${Number(qty) > 1 ? `${qty} ` : ''}${halfLabel}`
      : `${qty} x ${fmtNum(price)}`;
    const totalStr = fmtNum(lineTotal);
    const line2Font = isHalfCartonItem ? FONTS.ITEM_SUB_TEXT : FONTS.ITEM_NUM;
    drawLeft(qtyPriceStr, indentX, y, line2Font);
    drawRight(totalStr, K80.RIGHT_EDGE, y, FONTS.ITEM_TOTAL);
    y += 28;

    // Mixed carton bundle flavor breakdown if applicable (matches Image 2 style)
    if (Array.isArray(bundleComponents) && bundleComponents.length > 0) {
      for (const comp of bundleComponents) {
        const rawCompName = comp.productName || comp.product_name || comp.name || '';
        const compName = (lang === 'vi' && (comp.name_vi || comp.nameVi)) ? (comp.name_vi || comp.nameVi) : rawCompName;
        const compQty = comp.quantity || comp.qty || 1;
        if (compQty > 0) {
          const compPrefix = `- ${compName}`;
          const compQtyStr = `x${compQty}`;
          measureCtx.font = FONTS.CRATE_LABEL;
          const rightColWidth = 55;
          const maxNameWidth = K80.PRINTABLE_WIDTH - (indentX + 10 - K80.LEFT_MARGIN) - rightColWidth;
          const compLines = wrapText(measureCtx, compPrefix, maxNameWidth);
          for (let cIdx = 0; cIdx < compLines.length; cIdx++) {
            drawLeft(compLines[cIdx], indentX + 10, y, FONTS.CRATE_LABEL);
            if (cIdx === 0) {
              drawRight(compQtyStr, K80.RIGHT_EDGE, y, FONTS.ITEM_NUM);
            }
            y += 24;
          }
        }
      }
    }

    // Strict Crate Deposit Eligibility: Bundles and non-crate products are NEVER eligible for crate deposits
    const isCrateEligible = !isBundleItem && Boolean(
      it.hasCrateDeposit ||
      it.product?.hasCrateDeposit ||
      ((it.product?.category?.includes('ເບຍ') || it.product?.name?.includes('ເບຍ') || it.productName?.includes('ເບຍ')) &&
       (it.unit?.unitName === 'ແກັດ' || it.unit?.unitName === 'ລັງ' || it.unitName === 'ແກັດ' || it.unitName === 'ລັງ'))
    );

    const feePerCrate = Number(it.crateDepositFee || it.product?.crateDepositFee) || 30000;
    const diffTotal = (isCrateEligible && rawLineTotal > lineTotal) ? (rawLineTotal - lineTotal) : 0;
    const explicitCrateTotal = isCrateEligible ? (Number(it.crateDepositTotal) || (it.noEmptyCrates ? ((Number(it.missingCratesCount) || qty) * feePerCrate) : 0)) : 0;
    const crateTotal = isCrateEligible ? (explicitCrateTotal > 0 ? explicitCrateTotal : diffTotal) : 0;
    const missingCount = isCrateEligible ? (Number(it.missingCratesCount) || (crateTotal > 0 ? Math.round(crateTotal / feePerCrate) : (it.noEmptyCrates ? qty : 0))) : 0;
    const hasMissingCrates = isCrateEligible && Boolean(
      crateTotal > 0 || it.noEmptyCrates || (Number(it.missingCratesCount) > 0)
    );

    if (hasMissingCrates && missingCount > 0) {
      const crateStr = `${L.missingCrate}: ${missingCount} x ${fmtNum(feePerCrate)}`;
      drawLeft(crateStr, indentX, y, FONTS.CRATE_LABEL);
      drawRight(`+${fmtNum(crateTotal)}`, K80.RIGHT_EDGE, y, FONTS.CRATE_NUM);
      y += 26;
    }

    y += 20; // Clear, comfortable separation between distinct product items
  }

  y += 4;
  drawDashedLine(y);
  y += 14;

  // Intermediate Page Footer: continuation notice only (omits totals, barcode & signatures)
  if (isMultiPage && !isLastPage) {
    const contText = lang === 'vi'
      ? `--- (Còn tiếp sang trang ${Number(pageInfo.currentPage) + 1}/${pageInfo.totalPages}) ---`
      : `--- (ຍັງມີຕໍ່ໜ້າ ${Number(pageInfo.currentPage) + 1}/${pageInfo.totalPages}) ---`;
    drawCenter(contText, y, FONTS.FOOTER_BOLD);
    y += 36;

    return Math.ceil(y);
  }

  // 7. TOTALS SECTION (Drawn on final page or single-page receipts)
  if (isMultiPage) {
    const finalNotice = lang === 'vi'
      ? `(Hóa đơn gồm ${pageInfo.totalPages} trang - Tổng ${allItems.length} món)`
      : `(ໃບບິນທັງໝົດ ${pageInfo.totalPages} ໜ້າ - ລວມ ${allItems.length} ລາຍການ)`;
    y += 14; // Separation from items above
    drawCenter(finalNotice, y, FONTS.META_BOLD);
    y += 44; // Ample spacing so it never sticks to Subtotal
  }

  const calculatedTotal = allItems.reduce((sum, it) => {
    const rawLTotal = Number(it.lineTotal || it.line_total);
    const rawPrice = Number(
      it.customPrice ??
      it.effectivePrice ??
      it.effectiveUnitPrice ??
      it.unitPrice ??
      it.unit_price ??
      it.price ??
      (receipt.isWholesale
        ? (it.unit?.wholesalePrice ?? it.unit?.retailPrice ?? 0)
        : (it.unit?.retailPrice ?? 0))
    ) || 0;
    const qty = Number(it.quantity) || 1;
    const price = rawPrice > 0 ? rawPrice : (rawLTotal > 0 && qty > 0 ? Math.round(rawLTotal / qty) : 0);
    const isBundleItem = Boolean(it.isBundle || it.is_bundle || it.bundleId || it.bundle_components || it.bundleComponents);
    const isCrateEligible = !isBundleItem && Boolean(
      it.hasCrateDeposit ||
      it.product?.hasCrateDeposit ||
      ((it.product?.category?.includes('ເບຍ') || it.product?.name?.includes('ເບຍ') || it.productName?.includes('ເບຍ')) &&
       (it.unit?.unitName === 'ແກັດ' || it.unit?.unitName === 'ລັງ' || it.unitName === 'ແກັດ' || it.unitName === 'ລັງ'))
    );
    const fee = Number(it.crateDepositFee || it.product?.crateDepositFee) || 30000;
    const explicit = isCrateEligible ? (Number(it.crateDepositTotal) || (it.noEmptyCrates ? ((Number(it.missingCratesCount) || qty) * fee) : 0)) : 0;
    return sum + (price * qty) + explicit;
  }, 0);

  const subtotal = Number(receipt.subtotal) || calculatedTotal;
  const discount = Number(receipt.discountTotal || receipt.discount) || 0;
  const finalGrandTotal = Number(receipt.grandTotal) || (subtotal - discount);

  // Subtotal (includes crate deposit as requested)
  drawLeft(L.subtotalLabel, K80.LEFT_MARGIN, y, FONTS.SUBTOTAL_LABEL);
  drawRight(fmtKip(subtotal), K80.RIGHT_EDGE, y, FONTS.SUBTOTAL_NUM);
  y += 34;

  // Discount
  if (discount > 0) {
    drawLeft(L.discountLabel, K80.LEFT_MARGIN, y, FONTS.SUBTOTAL_LABEL);
    drawRight(`-${fmtKip(discount)}`, K80.RIGHT_EDGE, y, FONTS.SUBTOTAL_NUM);
    y += 34;
  }

  // ─── GRAND TOTAL WITH GENEROUS SPACIOUS PADDING & SYMMETRIC MIDDLE ALIGNMENT ───
  y += 14;
  const grandBorderTopY = y;
  drawSolidLine(grandBorderTopY, 2.5); // Top border

  const grandHeight = 84; // Spacious height for 34px - 38px font
  const grandMidY = grandBorderTopY + (grandHeight / 2); // Exact middle

  if (isDraw) {
    ctx.textBaseline = 'middle';
    ctx.font = FONTS.GRAND_LABEL;
    ctx.textAlign = 'left';
    // Align Lao grand total label at middle line (-1px optical lift for Lao body alignment)
    ctx.fillText(L.grandTotalLabel, K80.LEFT_MARGIN, grandMidY - 1);

    ctx.font = FONTS.GRAND_NUM;
    ctx.textAlign = 'right';
    ctx.fillText(fmtKip(finalGrandTotal), K80.RIGHT_EDGE, grandMidY);

    ctx.textBaseline = 'top'; // Reset baseline
  }

  const grandBorderBottomY = grandBorderTopY + grandHeight;
  drawSolidLine(grandBorderBottomY, 2.5); // Bottom border
  y = grandBorderBottomY + 24;           // Margin below bottom border

  // 8. PAYMENT DETAILS (Tendered / Change / Debt - Omitted for Quotation)
  if (!isQuotation) {
    if (isDebt) {
      const paidAmt = Number(receipt.paidAmount) || Number(receipt.amountTendered || receipt.amount_tendered) || 0;
      drawLeft(L.paidLabel, K80.LEFT_MARGIN, y, FONTS.TENDER_LABEL);
      drawRight(fmtKip(paidAmt), K80.RIGHT_EDGE, y, FONTS.TENDER_NUM);
      y += 38; // Increased from 28 to 38 for comfortable, clear separation!

      const debtAmt = (receipt.debtAmount !== undefined && receipt.debtAmount !== null && Number(receipt.debtAmount) > 0)
        ? Number(receipt.debtAmount)
        : (receipt.remainingDebt !== undefined && receipt.remainingDebt !== null && Number(receipt.remainingDebt) > 0)
        ? Number(receipt.remainingDebt)
        : Math.max(0, finalGrandTotal - paidAmt);
      drawLeft(L.debtBalanceLabel, K80.LEFT_MARGIN, y, FONTS.DEBT_LABEL);
      drawRight(fmtKip(debtAmt), K80.RIGHT_EDGE, y, FONTS.DEBT_NUM);
      y += 40; // Increased from 30 to 40 for spacious height of 28px/30px font!

      if (receipt.debtNote) {
        measureCtx.font = FONTS.ADDRESS;
        const noteLines = wrapText(measureCtx, `${L.debtNoteLabel} ${receipt.debtNote}`, K80.PRINTABLE_WIDTH);
        for (const line of noteLines) {
          drawLeft(line, K80.LEFT_MARGIN, y, FONTS.ADDRESS);
          y += 24;
        }
      }
    } else {
      drawLeft(L.tenderedLabel, K80.LEFT_MARGIN, y, FONTS.TENDER_LABEL);
      drawRight(fmtKip(receipt.amountTendered), K80.RIGHT_EDGE, y, FONTS.TENDER_NUM);
      y += 34;

      if (receipt.paymentMethod === 'cash') {
        drawLeft(L.changeLabel, K80.LEFT_MARGIN, y, FONTS.TENDER_LABEL);
        drawRight(fmtKip(receipt.changeAmount), K80.RIGHT_EDGE, y, FONTS.TENDER_NUM);
        y += 34;
      }
    }
    y += 14;
  }

  // 9. QR CODE PAYMENT (If transfer payment or debt - Omitted for Quotation)
  const showQr = !isQuotation && (isTransfer || (isDebt && (receipt.debtAmount ?? receipt.grandTotal) > 0));
  if (showQr) {
    drawDashedLine(y);
    y += 18;

    // Generous 260px size (~33mm wide) for instant mobile camera recognition
    const qrSize = 260;
    const qrX = Math.round(K80.CENTER_X - qrSize / 2);

    if (qrImage && isDraw) {
      try {
        // Pure white quiet zone box around QR code
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(qrX - 12, y - 8, qrSize + 24, qrSize + 16);
        // Disable smoothing so QR module edges stay crisp and don't blur into gray bleed
        const prevSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(qrImage, qrX, y, qrSize, qrSize);
        ctx.imageSmoothingEnabled = prevSmoothing;
      } catch (_) {}
      ctx.fillStyle = '#000000'; // Explicitly restore solid black after QR white box
    } else if (isDraw) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qrX, y, qrSize, qrSize);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(qrX, y, qrSize, qrSize);
      ctx.fillStyle = '#000000'; // Explicitly restore solid black after QR white box
      drawCenter('LAO QR PAYMENT', y + qrSize / 2 - 8, FONTS.META_BOLD);
    }
    y += qrSize + 16;

    // Account holder name under QR Code
    drawCenter('ທ່ານ ສົມສັກ ( ນ. ຄຳຈູ່ ດັ່ງຈະເລີນ ຂາຍເບຍ)', y, FONTS.QR_NAME);
    y += 36;
  }

  // 10. SIGNATURES SECTION (Only for real sales / debts; omitted for quotation per user request)
  if (!isQuotation) {
    drawDashedLine(y);
    y += 20;

    const sigColLeftX = K80.LEFT_MARGIN + K80.PRINTABLE_WIDTH * 0.25;  // ~152px
    const sigColRightX = K80.LEFT_MARGIN + K80.PRINTABLE_WIDTH * 0.75; // ~424px

    const leftSignLabel = isDebt ? L.signDebtor : L.signCustomer;
    const rightSignLabel = isDebt ? L.signSeller : L.signCashier;

    if (isDraw) {
      ctx.fillStyle = '#000000'; // Explicitly ensure black color for signature text
      ctx.font = FONTS.SIGN_LABEL;
      ctx.textAlign = 'center';
      ctx.fillText(leftSignLabel, sigColLeftX, y);
      ctx.fillText(rightSignLabel, sigColRightX, y);
    }

    // Generous 150px space for hand signature (increased from 100px for comfortable signing height)
    y += 150;

    // Dotted lines strictly under each respective column (compact width 110px so the two signers are clearly separated)
    const drawSignDottedLine = (centerX, width = 110, lineY) => {
      if (isDraw) {
        ctx.beginPath();
        ctx.setLineDash([3, 4]); // 3px dot, 4px space
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#000000';
        ctx.moveTo(centerX - width / 2, lineY);
        ctx.lineTo(centerX + width / 2, lineY);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash
      }
    };

    drawSignDottedLine(sigColLeftX, 110, y);
    drawSignDottedLine(sigColRightX, 110, y);
    y += 36; // Breathing room below signature dots before barcode
  }

  // 11. BARCODE STRIP (Standard Code 128-B: Equal bar height, encodes exact bill code)
  drawDashedLine(y);
  y += 22;

  const barcodeData = generateBarcode128(receipt.receiptNumber || 'MEII-POS');
  const moduleW = 2; // Crisp 2px module width (4 physical px on 2X canvas)
  const barcodeTotalW = barcodeData.totalModules * moduleW;
  const startX = Math.round(K80.CENTER_X - barcodeTotalW / 2);
  const barcodeH = 80; // Uniform equal height across all bars

  if (isDraw) {
    // Pure white quiet zone
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(startX - 20, y - 4, barcodeTotalW + 40, barcodeH + 8);

    // Draw barcode bars with crisp equal height
    ctx.fillStyle = '#000000';
    for (let i = 0; i < barcodeData.totalModules; i++) {
      if (barcodeData.bits[i] === '1') {
        const bx = startX + i * moduleW;
        ctx.fillRect(bx, y, moduleW, barcodeH);
      }
    }
  }

  y += barcodeH + 16; // Clean gap below uniform barcode bars

  // Receipt Number (24px bold monospace, clear separation - EXACT bill code)
  drawCenter(receipt.receiptNumber || 'MEII-POS', y, FONTS.BARCODE_NUM);
  y += 54; // Spacious gap between barcode bill code & thank you (User: dính nhau quá cách xa nhau một chút)

  // 12. FOOTER (Multi-line Thank You & Inspection / Return Policy)
  const thankYouLines = Array.isArray(L.thankYou) ? L.thankYou : [L.thankYou];
  for (const tLine of thankYouLines) {
    if (tLine) {
      drawCenter(tLine, y, FONTS.FOOTER_BOLD);
      y += 34;
    }
  }
  y += 4;

  const policyLines = isQuotation
    ? (Array.isArray(L.quotationTerms) ? L.quotationTerms : [L.quotationTerms])
    : (Array.isArray(L.returnPolicy) ? L.returnPolicy : [L.returnPolicy]);
  for (const pLine of policyLines) {
    if (pLine) {
      drawCenter(pLine, y, FONTS.FOOTER);
      y += 30;
    }
  }
  // User: phần dưới từ chữ ສິນຄ້າສາມາດປ່ຽນ ຫຼື .... tới cuối trang nó dư khoảng trống nhiều quá bỏ khoảng trống đó đi để tiết kiệm giấy
  y += 6; // Minimal padding at bottom of receipt to eliminate blank wasted paper

  return Math.ceil(y);
}

// ─── Public API: Render Full Receipt Canvas ───────────────────────────────────
export async function renderReceiptCanvas(receipt, lang = 'lo', options = {}) {
  if (!receipt) throw new Error('Receipt data is missing');
  let pageInfo = options?.pageInfo || null;

  // Auto-derive pageInfo if caller passed { itemsPerPage, page }
  if (!pageInfo && options?.itemsPerPage > 0) {
    const allItems = receipt.items?.length > 0 ? receipt.items : (receipt.sale_transaction_items || []);
    const totalCount = allItems.length;
    const itemsPerPage = Number(options.itemsPerPage);
    const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
    const p = Math.max(1, Math.min(Number(options.page) || 1, totalPages));
    const start = (p - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, totalCount);
    pageInfo = {
      currentPage: p,
      totalPages,
      startIndex: start,
      endIndex: end,
      isFirstPage: p === 1,
      isLastPage: p === totalPages,
    };
  }

  const customProducts = options?.products || receipt?.products || null;

  // Pre-load fonts based on selected language
  if (lang === 'vi') {
    try {
      await ensureSegoeUiLoaded();
      await ensureTahomaLoaded();
      await ensureSaysetthaLoaded();
      if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
        await Promise.race([
          Promise.all([
            document.fonts.load('bold 44px "Segoe UI"'),
            document.fonts.load('bold 38px "Segoe UI"'),
            document.fonts.load('bold 32px "Segoe UI"'),
            document.fonts.load('bold 30px "Segoe UI"'),
            document.fonts.load('bold 28px "Segoe UI"'),
            document.fonts.load('bold 26px "Segoe UI"'),
            document.fonts.load('bold 25px "Segoe UI"'),
            document.fonts.load('bold 24px "Segoe UI"'),
            document.fonts.load('bold 23px "Segoe UI"'),
            document.fonts.load('600 26px "Segoe UI"'),
            document.fonts.load('600 24px "Segoe UI"'),
            document.fonts.load('600 23px "Segoe UI"'),
            document.fonts.load('600 22px "Segoe UI"'),
            document.fonts.load('600 21px "Segoe UI"'),
            document.fonts.load('500 22px "Segoe UI"'),
            document.fonts.load('24px "Segoe UI"'),
            document.fonts.load('23px "Segoe UI"'),
            document.fonts.load('22px "Segoe UI"'),
            document.fonts.load('21px "Segoe UI"'),
            document.fonts.load('bold 44px "Tahoma"'),
            document.fonts.load('bold 32px "Tahoma"'),
            document.fonts.load('24px "Tahoma"'),
            document.fonts.load('24px "Saysettha OT"'),
            document.fonts.load('22px "Saysettha OT"'),
          ]),
          new Promise((resolve) => setTimeout(resolve, 500)),
        ]);
      }
    } catch (_) {}
  } else {
    // Pre-load embedded Saysettha OT fonts exclusively
    try {
      await ensureSaysetthaLoaded();
      if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
        await Promise.race([
          Promise.all([
            document.fonts.load('bold 44px "Saysettha OT"'),
            document.fonts.load('bold 34px "Saysettha OT"'),
            document.fonts.load('bold 32px "Saysettha OT"'),
            document.fonts.load('bold 30px "Saysettha OT"'),
            document.fonts.load('bold 28px "Saysettha OT"'),
            document.fonts.load('bold 26px "Saysettha OT"'),
            document.fonts.load('bold 25px "Saysettha OT"'),
            document.fonts.load('bold 24px "Saysettha OT"'),
            document.fonts.load('bold 23px "Saysettha OT"'),
            document.fonts.load('bold 22px "Saysettha OT"'),
            document.fonts.load('24px "Saysettha OT"'),
            document.fonts.load('22px "Saysettha OT"'),
            document.fonts.load('bold 44px "Saysettha"'),
            document.fonts.load('bold 32px "Saysettha"'),
            document.fonts.load('bold 26px "Saysettha"'),
            document.fonts.load('bold 25px "Saysettha"'),
            document.fonts.load('bold 24px "Saysettha"'),
            document.fonts.load('bold 22px "Saysettha"'),
            document.fonts.load('24px "Saysettha"'),
          ]),
          new Promise((resolve) => setTimeout(resolve, 500)),
        ]);
      }
    } catch (_) {}
  }

  // Pre-load QR code if transfer payment or debt
  let qrImg = null;
  const pm = String(receipt.paymentMethod || receipt.payment_method || 'cash').toLowerCase();
  const isDebt = pm === 'debt' || Boolean(receipt.isDebt);
  const isCash = pm === 'cash';
  const isTransfer = pm === 'transfer' || pm === 'onepay' || pm === 'qrtransfer' || pm === 'qr' || (!isCash && !isDebt);
  const showQr = !receipt.isQuotation && (isTransfer || (isDebt && (Number(receipt.debtAmount ?? receipt.grandTotal) > 0)));
  if (showQr) {
    qrImg = await loadShopQrImage();
  }

  // Pass 1: Measure exact height with zero discrepancy
  const exactHeight = layoutReceipt(null, receipt, lang, qrImg, pageInfo, customProducts);

  // Pass 2: Direct 1:1 Pixel Mapping on 576-dot Thermal Printhead
  // Rendering at exact 576px width eliminates 2X downsampling blur
  // and bilinear interpolation gray fringing that eroded thin Lao character loops.
  const canvas = document.createElement('canvas');
  canvas.width = K80.CANVAS_WIDTH; // Exact 576 dots
  canvas.height = exactHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Pure white crisp background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // High-contrast rendering
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  // Execute actual drawing directly on 1:1 thermal grid
  layoutReceipt(ctx, receipt, lang, qrImg, pageInfo, customProducts);

  // If exporting as an image file (e.g. for saving to iPhone Photos or downloading):
  // Wrap the 576-dot receipt with generous white paper margins (32px left/right, 36px top/bottom)
  // so the receipt never touches the outer image border or frame!
  // Physical thermal printing (options.forImageExport: false / undefined) stays 100% untouched at exact 576 dots!
  if (options?.forImageExport) {
    const padX = Number(options?.paddingX ?? 32);
    const padY = Number(options?.paddingY ?? 36);
    const framedCanvas = document.createElement('canvas');
    framedCanvas.width = canvas.width + (padX * 2);
    framedCanvas.height = canvas.height + (padY * 2);

    const fCtx = framedCanvas.getContext('2d');
    fCtx.fillStyle = '#ffffff';
    fCtx.fillRect(0, 0, framedCanvas.width, framedCanvas.height);
    fCtx.drawImage(canvas, padX, padY);
    return framedCanvas;
  }

  return canvas;
}

export default { renderReceiptCanvas, K80 };
