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
  LEFT_MARGIN: 16,      // Left safe margin
  RIGHT_EDGE: 560,      // Right safe margin
  PRINTABLE_WIDTH: 544, // 560 - 16
  CENTER_X: 288,        // Symmetry center (576 / 2)

  // 4-Column Grid
  COL_NAME_X: 16,       // Column 1: Item Name (runs 16px to 276px, max 260px)
  COL_NAME_MAX_W: 260,  // Max width 260px (wrap if longer)
  COL_QTY_X: 305,       // Column 2: Qty (55px width, centered at 305px)
  COL_PRICE_X: 425,     // Column 3: Unit Price (110px width, right-aligned at 425px)
  COL_TOTAL_X: 560,     // Column 4: Line Total (115px width, right-aligned at 560px)
};

// ─── Typography (High-Res POS Scale) ──────────────────────────────────────────
const FONTS = {
  STORE_NAME: '800 42px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  SLOGAN: '700 21px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  ADDRESS: '700 18.5px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  TEL: '800 21px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  TITLE: 'bold 28px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  META_LABEL: '500 19px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  META_VAL: '600 19.5px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  META_BOLD: 'bold 21px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  COL_HEADER: '800 20px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  ITEM_NAME: '600 21px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',      // font-semibold (600)
  ITEM_UNIT: '500 18px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  ITEM_NUM: '700 19px "Outfit", "Segoe UI", -apple-system, sans-serif',             // font-bold (700)
  ITEM_TOTAL: '800 20.5px "Outfit", "Segoe UI", -apple-system, sans-serif',          // font-extrabold (800)
  CRATE_LABEL: '600 17px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  CRATE_NUM: '700 16.5px "Outfit", "Segoe UI", -apple-system, sans-serif',
  SUBTOTAL_LABEL: '500 19px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  SUBTOTAL_NUM: '700 20px "Outfit", "Segoe UI", -apple-system, sans-serif',
  GRAND_LABEL: '900 28px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',    // font-black (900)
  GRAND_NUM: '900 32px "Outfit", "Segoe UI", -apple-system, sans-serif',             // font-black (900) >= 24px
  TENDER_LABEL: '500 19px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  TENDER_NUM: '700 20px "Outfit", "Segoe UI", -apple-system, sans-serif',
  DEBT_LABEL: '800 22px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  DEBT_NUM: '800 22px "Outfit", "Segoe UI", -apple-system, sans-serif',
  QR_NAME: '600 16px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  QR_AMOUNT: '800 21px "Outfit", "Segoe UI", -apple-system, sans-serif',
  SIGN_LABEL: 'bold 21px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  SIGN_LINE: 'bold 20px monospace',
  BARCODE_NUM: 'bold 20px "Outfit", monospace',
  FOOTER_BOLD: 'bold 21px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  FOOTER: '600 18px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  VOID_TEXT: 'bold 24px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
};

// ─── Bilingual Dictionary ─────────────────────────────────────────────────────
const LABELS = {
  lo: {
    storeName: 'ຮ້ານ MeiiShop',
    storeSlogan: 'ຂາຍຍົກ - ຂາຍຍ່ອຍ ສິນຄ້າອຸປະໂພກ ບໍລິໂພກ',
    storeAddress: 'ບ້ານ ໂພນສະຫວັນ, ນະຄອນປາກເຊ, ຈຳປາສັກ',
    storeTel: 'ໂທ: 020 5555 9999 / 021 214 555',
    receiptTitle: 'ໃບບິນຮັບເງິນ / RECEIPT',
    voidTitle: 'ໃບບິນນີ້ຖືກຍົກເລີກແລ້ວ (VOID)',
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
    defaultItemName: 'ສິນຄ້າ',
    defaultUnitName: 'ອັນ',
  },
  vi: {
    storeName: 'CỬA HÀNG MEIISHOP',
    storeSlogan: 'Bán buôn - Bán lẻ Hàng tiêu dùng',
    storeAddress: 'Làng Phonesavanh, TP.Pakse, Champasak',
    storeTel: 'ĐT: 020 5555 9999 / 021 214 555',
    receiptTitle: 'HÓA ĐƠN BÁN HÀNG',
    voidTitle: 'HÓA ĐƠN ĐÃ HỦY (VOID)',
    cashier: 'Thu ngân:',
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
    signDebtor: 'Chữ ký người nợ (Debtor)',
    signCustomer: 'Người nhận hàng (Customer)',
    signSeller: 'Người bán hàng (Seller)',
    signCashier: 'Nhân viên thu ngân (Cashier)',
    thankYou: 'ຂໍຂອບໃຈລູກຄ້າທີ່ມາອຸດໜູນ! ໂອກາດໜ້າເຊີນໃໝ່ເດີ',
    returnPolicy: 'Hàng mua rồi miễn đổi hoặc trả lại tiền • Vui lòng kiểm tra tiền thừa',
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

function preloadImage(src, timeoutMs = 800) {
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

// ─── Drawing / Measuring Routine (Strict Top Baseline) ────────────────────────
function layoutReceipt(ctx, receipt, lang, qrImage = null) {
  const L = LABELS[lang] || LABELS.lo;
  const items = receipt.items?.length > 0 ? receipt.items
    : (receipt.sale_transaction_items?.length > 0 ? receipt.sale_transaction_items : []);
  const isCancelled = receipt.status === 'cancelled' || receipt.isCancelled;
  const isDebt = receipt.paymentMethod === 'debt' || receipt.isDebt;
  const isTransfer = receipt.paymentMethod !== 'cash';

  const isDraw = Boolean(ctx);
  if (isDraw) {
    ctx.textBaseline = 'top';
  }

  const drawCenter = (text, y, font) => {
    if (isDraw) {
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.fillText(text, K80.CENTER_X, y);
    }
  };

  const drawLeft = (text, x, y, font) => {
    if (isDraw) {
      ctx.font = font;
      ctx.textAlign = 'left';
      ctx.fillText(text, x, y);
    }
  };

  const drawRight = (text, x, y, font) => {
    if (isDraw) {
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
      ctx.moveTo(K80.LEFT_MARGIN, y);
      ctx.lineTo(K80.RIGHT_EDGE, y);
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
      ctx.moveTo(K80.LEFT_MARGIN, y);
      ctx.lineTo(K80.RIGHT_EDGE, y);
      ctx.stroke();
    }
  };

  let y = 16; // Top margin

  // 1. STORE HEADER (Prominent, Large, Authoritative)
  drawCenter(L.storeName, y, FONTS.STORE_NAME);
  y += 50; // Increased spacing for 42px font

  drawCenter(L.storeSlogan, y, FONTS.SLOGAN);
  y += 30; // Increased spacing for 21px font

  drawCenter(L.storeAddress, y, FONTS.ADDRESS);
  y += 28; // Increased spacing for 18.5px font

  drawCenter(L.storeTel, y, FONTS.TEL);
  y += 34; // Increased spacing for 21px bold font

  // 2. RECEIPT TITLE BANNER (Generous padding, dead center between borders)
  y += 6;
  const bannerTopY = y;
  drawSolidLine(bannerTopY, 2.5);

  const bannerHeight = 64; // Spacious banner height: generous distance from text to borders
  const bannerMidY = bannerTopY + (bannerHeight / 2); // Exact middle

  if (isDraw) {
    ctx.textBaseline = 'middle';
    ctx.font = FONTS.TITLE;
    ctx.textAlign = 'center';
    // Shift up 2.5px optically so the base characters of ໃບບິນ sit dead center between borders
    ctx.fillText(L.receiptTitle, K80.CENTER_X, bannerMidY - 2.5);
    ctx.textBaseline = 'top'; // Reset baseline
  }

  const bannerBottomY = bannerTopY + bannerHeight;
  drawSolidLine(bannerBottomY, 2.5);
  y = bannerBottomY + 22; // Space below banner

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

  // 4. METADATA SECTION (19px - 20px scaled typography - normal weight, no excessive bold)
  // Row 1: Cashier & Customer
  drawLeft(`${L.cashier} ${receipt.cashierName || 'Meii'}`, K80.LEFT_MARGIN, y, FONTS.META_VAL);
  const custName = (!receipt.customerName || receipt.customerName === 'ລູກຄ້າທົ່ວໄປ' || receipt.customerName === 'Khách lẻ / Khách vãng lai')
    ? L.defaultCustomer
    : receipt.customerName;
  drawRight(`${L.customer} ${custName}`, K80.RIGHT_EDGE, y, FONTS.META_VAL);
  y += 30;

  // Row 2: Date & Payment Method
  const dateStr = receipt.createdAt
    ? new Date(receipt.createdAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'lo-LA')
    : new Date().toLocaleString();
  drawLeft(`${L.date} ${dateStr}`, K80.LEFT_MARGIN, y, FONTS.META_LABEL);

  let payLabel = L.payCash;
  if (receipt.paymentMethod === 'cash') payLabel = L.payCash;
  else if (['transfer', 'qrTransfer', 'onepay'].includes(receipt.paymentMethod)) payLabel = L.payQr;
  else if (receipt.paymentMethod === 'debt') {
    payLabel = Number(receipt.paidAmount || 0) === 0 ? L.payDebtFull : L.payDebtPartial;
  } else payLabel = L.payTransfer;
  drawRight(`${L.payment} ${payLabel}`, K80.RIGHT_EDGE, y, FONTS.META_VAL);
  y += 32;

  // 5. COLUMN HEADERS (4 Columns)
  drawDashedLine(y);
  y += 10;
  drawLeft(L.colName, K80.COL_NAME_X, y, FONTS.COL_HEADER);
  if (isDraw) {
    ctx.font = FONTS.COL_HEADER;
    ctx.textAlign = 'center';
    ctx.fillText(L.colQty, K80.COL_QTY_X, y);
  }
  drawRight(L.colPrice, K80.COL_PRICE_X, y, FONTS.COL_HEADER);
  drawRight(L.colTotal, K80.COL_TOTAL_X, y, FONTS.COL_HEADER);
  y += 30;
  drawSolidLine(y, 1.2);
  y += 12;

  // 6. ITEM ROWS (Preserved 23px font scale as requested)
  const measureCtx = ctx || document.createElement('canvas').getContext('2d');
  measureCtx.textBaseline = 'top';

  for (const it of items) {
    const rawNameVi = it.product?.name_vi || it.product?.nameVi || it.name_vi || it.nameVi;
    const rawNameLao = it.product?.name || it.productName || it.product_name || L.defaultItemName;
    const prodName = (lang === 'vi' && rawNameVi && String(rawNameVi).trim())
      ? String(rawNameVi).trim()
      : rawNameLao;

    const rawUnit = it.unit?.unitName || it.unitName || it.unit_name || L.defaultUnitName;
    const unitName = translateUnit(rawUnit, lang, Boolean(it.isHalfCarton));
    const fullName = `${prodName} (${unitName})`;

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
    const lineTotal = price * qty;

    measureCtx.font = FONTS.ITEM_NAME;
    const nameLines = wrapText(measureCtx, fullName, K80.COL_NAME_MAX_W);

    // First line of row: Name, Qty, Unit Price, Line Total (line-height 1.45 spacing)
    drawLeft(nameLines[0], K80.COL_NAME_X, y, FONTS.ITEM_NAME);
    if (isDraw) {
      ctx.font = FONTS.ITEM_NUM;
      ctx.textAlign = 'center';
      ctx.fillText(`${qty}x`, K80.COL_QTY_X, y + 2);
    }
    drawRight(fmtNum(price), K80.COL_PRICE_X, y + 2, FONTS.ITEM_NUM);
    drawRight(fmtNum(lineTotal), K80.COL_TOTAL_X, y + 2, FONTS.ITEM_TOTAL);
    y += 32; // Line height 1.45 for Lao vowel space

    // Additional wrapped name lines (line-height 1.45 spacing)
    for (let li = 1; li < nameLines.length; li++) {
      drawLeft(nameLines[li], K80.COL_NAME_X, y, FONTS.ITEM_NAME);
      y += 30;
    }

    // Crate deposit sub-row if applicable
    const hasMissingCrates = Boolean(
      it.noEmptyCrates || (Number(it.missingCratesCount) > 0) || (Number(it.crateDepositTotal) > 0)
    );
    if (hasMissingCrates) {
      const feePerCrate = Number(it.crateDepositFee || it.product?.crateDepositFee) || 30000;
      const missingCount = Number(it.missingCratesCount) || (hasMissingCrates ? qty : 0);
      const crateTotal = Number(it.crateDepositTotal) || (missingCount * feePerCrate);

      drawLeft(L.missingCrate, K80.COL_NAME_X + 14, y, FONTS.CRATE_LABEL);
      if (isDraw) {
        ctx.font = FONTS.CRATE_NUM;
        ctx.textAlign = 'center';
        ctx.fillText(`${missingCount}x`, K80.COL_QTY_X, y);
      }
      drawRight(fmtNum(feePerCrate), K80.COL_PRICE_X, y, FONTS.CRATE_NUM);
      drawRight(`+${fmtNum(crateTotal)}`, K80.COL_TOTAL_X, y, FONTS.CRATE_NUM);
      y += 24;
    }

    y += 4; // Padding between items
  }

  y += 6;
  drawDashedLine(y);
  y += 12;

  // 7. TOTALS SECTION
  const totalCrateDeposit = items.reduce((sum, it) => {
    const fee = Number(it.crateDepositFee || it.product?.crateDepositFee) || 30000;
    const count = Number(it.missingCratesCount) || (it.noEmptyCrates ? it.quantity : 0);
    return sum + (Number(it.crateDepositTotal) || (it.noEmptyCrates ? count * fee : 0));
  }, 0);

  const goodsSubtotal = items.reduce((sum, it) => {
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

  const pureGoodsSubtotal = goodsSubtotal > 0 ? goodsSubtotal : Math.max(0, (receipt.subtotal || 0) - totalCrateDeposit);
  const discount = Number(receipt.discountTotal) || 0;
  const finalGrandTotal = receipt.grandTotal
    ? Math.max(receipt.grandTotal, pureGoodsSubtotal + totalCrateDeposit - discount)
    : (pureGoodsSubtotal + totalCrateDeposit - discount);

  // Subtotal
  drawLeft(L.subtotalLabel, K80.LEFT_MARGIN, y, FONTS.SUBTOTAL_LABEL);
  drawRight(fmtKip(pureGoodsSubtotal), K80.RIGHT_EDGE, y, FONTS.SUBTOTAL_NUM);
  y += 28;

  // Crate deposit total
  if (totalCrateDeposit > 0) {
    drawLeft(L.crateDepositLabel, K80.LEFT_MARGIN, y, FONTS.SUBTOTAL_LABEL);
    drawRight(`+${fmtKip(totalCrateDeposit)}`, K80.RIGHT_EDGE, y, FONTS.SUBTOTAL_NUM);
    y += 28;
  }

  // Discount
  if (discount > 0) {
    drawLeft(L.discountLabel, K80.LEFT_MARGIN, y, FONTS.SUBTOTAL_LABEL);
    drawRight(`-${fmtKip(discount)}`, K80.RIGHT_EDGE, y, FONTS.SUBTOTAL_NUM);
    y += 28;
  }

  // ─── GRAND TOTAL WITH GENEROUS SPACIOUS PADDING & SYMMETRIC MIDDLE ALIGNMENT ───
  y += 12;
  const grandBorderTopY = y;
  drawSolidLine(grandBorderTopY, 2.5); // Top border

  const grandHeight = 74; // Spacious height: generous distance from text & numbers to borders
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
  y = grandBorderBottomY + 22;           // Margin below bottom border

  // 8. PAYMENT DETAILS (Tendered / Change / Debt)
  if (isDebt) {
    drawLeft(L.paidLabel, K80.LEFT_MARGIN, y, FONTS.TENDER_LABEL);
    drawRight(fmtKip(receipt.paidAmount ?? receipt.amountTendered ?? 0), K80.RIGHT_EDGE, y, FONTS.TENDER_NUM);
    y += 28;

    const debtAmt = receipt.debtAmount ?? Math.max(0, receipt.grandTotal - (receipt.paidAmount ?? receipt.amountTendered ?? 0));
    drawLeft(L.debtBalanceLabel, K80.LEFT_MARGIN, y, FONTS.DEBT_LABEL);
    drawRight(fmtKip(debtAmt), K80.RIGHT_EDGE, y, FONTS.DEBT_NUM);
    y += 30;

    if (receipt.debtNote) {
      measureCtx.font = FONTS.ADDRESS;
      const noteLines = wrapText(measureCtx, `${L.debtNoteLabel} ${receipt.debtNote}`, K80.PRINTABLE_WIDTH);
      for (const line of noteLines) {
        drawLeft(line, K80.LEFT_MARGIN, y, FONTS.ADDRESS);
        y += 22;
      }
    }
  } else {
    drawLeft(L.tenderedLabel, K80.LEFT_MARGIN, y, FONTS.TENDER_LABEL);
    drawRight(fmtKip(receipt.amountTendered), K80.RIGHT_EDGE, y, FONTS.TENDER_NUM);
    y += 28;

    if (receipt.paymentMethod === 'cash') {
      drawLeft(L.changeLabel, K80.LEFT_MARGIN, y, FONTS.TENDER_LABEL);
      drawRight(fmtKip(receipt.changeAmount), K80.RIGHT_EDGE, y, FONTS.TENDER_NUM);
      y += 28;
    }
  }

  y += 14;

  // 9. QR CODE PAYMENT (If transfer payment or debt)
  const showQr = isTransfer || (isDebt && (receipt.debtAmount ?? receipt.grandTotal) > 0);
  if (showQr) {
    drawDashedLine(y);
    y += 16;

    const qrSize = 155;
    const qrX = K80.CENTER_X - qrSize / 2;

    if (qrImage && isDraw) {
      try {
        ctx.drawImage(qrImage, qrX, y, qrSize, qrSize);
      } catch (_) {}
    } else if (isDraw) {
      ctx.strokeRect(qrX, y, qrSize, qrSize);
      drawCenter('LAO QR PAYMENT', y + qrSize / 2 - 8, FONTS.META_BOLD);
    }
    y += qrSize + 12;

    // Account holder
    drawCenter('VILAIPHONE VANNALATH MS', y, FONTS.QR_NAME);
    y += 24;

    const qrAmount = (receipt.paymentMethod === 'debt' || receipt.isDebt)
      ? (receipt.debtAmount ?? receipt.grandTotal)
      : receipt.grandTotal;
    drawCenter(`${L.transferTotalLabel} ${fmtKip(qrAmount)}`, y, FONTS.QR_AMOUNT);
    y += 32;
  }

  // 10. SIGNATURES SECTION (21px Bold labels, generous 100px space, dots ONLY under columns)
  drawDashedLine(y);
  y += 20;

  const sigColLeftX = K80.LEFT_MARGIN + K80.PRINTABLE_WIDTH * 0.25;  // ~152px
  const sigColRightX = K80.LEFT_MARGIN + K80.PRINTABLE_WIDTH * 0.75; // ~424px

  const leftSignLabel = isDebt ? L.signDebtor : L.signCustomer;
  const rightSignLabel = isDebt ? L.signSeller : L.signCashier;

  if (isDraw) {
    ctx.font = FONTS.SIGN_LABEL;
    ctx.textAlign = 'center';
    ctx.fillText(leftSignLabel, sigColLeftX, y);
    ctx.fillText(rightSignLabel, sigColRightX, y);
  }

  // Generous 100px space for hand signature (per user request)
  y += 100;

  // Dotted lines strictly under each respective column (140px wide, leaving ~132px gap in center)
  const drawSignDottedLine = (centerX, width = 140, lineY) => {
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

  drawSignDottedLine(sigColLeftX, 140, y);
  drawSignDottedLine(sigColRightX, 140, y);
  y += 36; // Breathing room below signature dots before barcode

  // 11. BARCODE STRIP (Oversized 50px height, 2.2x width for instantaneous laser scan)
  drawDashedLine(y);
  y += 20;

  const barcodePattern = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 2, 1, 2, 4, 1, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 2, 1, 2, 4];
  const barcodeH = 50; // Increased from 36 to 50 for big, prominent barcode
  const barcodeMultiplier = 2.2; // Bolder lines
  const totalBarW = barcodePattern.reduce((s, w) => s + w * barcodeMultiplier, 0);
  let barX = K80.CENTER_X - totalBarW / 2;

  if (isDraw) {
    for (let i = 0; i < barcodePattern.length; i++) {
      const bw = barcodePattern[i] * barcodeMultiplier;
      if (i % 2 === 0) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(barX, y, bw, barcodeH);
      }
      barX += bw;
    }
  }
  y += barcodeH + 18; // 18px clean gap below barcode bars!

  // Receipt Number (20px bold monospace, clear separation)
  drawCenter(receipt.receiptNumber || 'MEII-POS', y, FONTS.BARCODE_NUM);
  y += 30; // 30px clean gap before footer text

  // 12. FOOTER (21px Bold Thank you, 18px Return Policy)
  drawCenter(L.thankYou, y, FONTS.FOOTER_BOLD);
  y += 28;

  drawCenter(L.returnPolicy, y, FONTS.FOOTER);
  y += 30;

  // 13. Paper feed padding before cutter (44px)
  y += 44;

  return Math.ceil(y);
}

// ─── Public API: Render Full Receipt Canvas ───────────────────────────────────
export async function renderReceiptCanvas(receipt, lang = 'lo') {
  if (!receipt) throw new Error('Receipt data is missing');

  // Pre-load fonts to guarantee genuine vector Noto Sans Lao glyphs
  try {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
      await Promise.race([
        Promise.all([
          document.fonts.load('bold 42px "Noto Sans Lao"'),
          document.fonts.load('bold 28px "Noto Sans Lao"'),
          document.fonts.load('500 23px "Noto Sans Lao"'),
          document.fonts.load('bold 21px "Noto Sans Lao"'),
        ]),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    }
  } catch (_) {}

  // Pre-load QR code if transfer payment or debt
  let qrImg = null;
  const isDebt = receipt.paymentMethod === 'debt' || receipt.isDebt;
  const isTransfer = receipt.paymentMethod !== 'cash';
  if (isTransfer || (isDebt && (receipt.debtAmount ?? receipt.grandTotal) > 0)) {
    qrImg = await preloadImage('/qr.jpg', 600);
  }

  // Pass 1: Measure exact height with zero discrepancy
  const exactHeight = layoutReceipt(null, receipt, lang, qrImg);

  // Pass 2: Allocate 2X Super-Sampled 1152px canvas (Double Pixel Density)
  const SCALE = 2;
  const canvas = document.createElement('canvas');
  canvas.width = K80.CANVAS_WIDTH * SCALE;   // 576 * 2 = 1152px
  canvas.height = exactHeight * SCALE;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Pure white crisp background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Maximum sub-pixel geometric precision
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Scale 2x: All layout coordinates remain in standard 576-based logical units
  ctx.scale(SCALE, SCALE);

  // High-contrast rendering
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  // Execute actual drawing at double vector density
  layoutReceipt(ctx, receipt, lang, qrImg);

  return canvas;
}

export default { renderReceiptCanvas, K80 };
