/**
 * Pure Canvas 2D Receipt Drawing Engine — MeiiShop POS
 * ═══════════════════════════════════════════════════════
 * Standard: 80mm K80 (Physical Width: 576 dots / 72 bytes per line)
 *
 * Pixel-perfect reproduction of ReceiptModal.jsx preview:
 *  - Spacious bordered box for Grand Total (ຍອດຊຳລະສຸດທິ) with internal padding.
 *  - Dedicated handwriting signature space (75px) with dots exclusively under
 *    the two signer columns (no full-width line clash).
 *  - Medium (500) and Regular (400) weights for Lao body text to prevent
 *    thermal ink-bleeding and keep Lao vowel loops open and crystal clear.
 *  - Strict top-baseline positioning to eliminate barcode/number overlaps.
 */

// ─── 80mm K80 Physical Constants ──────────────────────────────────────────────
export const K80 = {
  CANVAS_WIDTH: 576,    // Physical print dots (72 bytes * 8)
  LEFT_MARGIN: 16,      // Left safe margin
  RIGHT_EDGE: 560,      // Right safe margin
  PRINTABLE_WIDTH: 544, // 560 - 16
  CENTER_X: 288,        // Symmetry center (576 / 2)

  // 4-Column Grid matching ReceiptModal.jsx
  COL_NAME_X: 16,       // Column 1: Item Name
  COL_NAME_MAX_W: 255,  // Max width 255px (wrap if longer)
  COL_QTY_X: 295,       // Column 2: Qty (centered at 295px)
  COL_PRICE_X: 415,     // Column 3: Unit Price (right-aligned at 415px)
  COL_TOTAL_X: 560,     // Column 4: Line Total (right-aligned at 560px)
};

// ─── Typography (Calibrated for Thermal Printers & Anti-Bleed) ────────────────
const FONTS = {
  STORE_NAME: 'bold 30px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  SLOGAN: '500 16px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  ADDRESS: '400 14.5px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  TEL: 'bold 16px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  TITLE: 'bold 20px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  META_LABEL: '400 15px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  META_VAL: '500 15.5px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  META_BOLD: 'bold 16px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  COL_HEADER: 'bold 16.5px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  ITEM_NAME: '500 18.5px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  ITEM_UNIT: '400 16px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  ITEM_NUM: '400 17px monospace',
  ITEM_TOTAL: 'bold 17.5px monospace',
  CRATE_LABEL: '500 15.5px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  CRATE_NUM: '400 15.5px monospace',
  SUBTOTAL_LABEL: '400 16.5px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  SUBTOTAL_NUM: '500 17.5px monospace',
  GRAND_LABEL: 'bold 23px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  GRAND_NUM: 'bold 26px monospace',
  TENDER_LABEL: '400 16px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  TENDER_NUM: '500 17px monospace',
  DEBT_LABEL: 'bold 19px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  DEBT_NUM: 'bold 21px monospace',
  QR_NAME: '500 14px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  QR_AMOUNT: 'bold 18px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  SIGN_LABEL: 'bold 16px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  SIGN_LINE: '16px monospace',
  BARCODE_NUM: 'bold 15.5px monospace',
  FOOTER_BOLD: 'bold 15.5px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  FOOTER: '400 13.5px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  VOID_TEXT: 'bold 20px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
};

// ─── Bilingual Dictionary ─────────────────────────────────────────────────────
const LABELS = {
  lo: {
    storeName: 'ຮ້ານ MeiiShop',
    storeSlogan: 'ຂາຍຍົກ - ຂາຍຍ່ອຍ ສິນຄ້າອຸປະໂພກ ບໍລິໂພກ',
    storeAddress: 'ຖະໜົນ ໄກສອນ ພົມວິຫານ, ບ້ານ ໂພນສະຫວ່າງ, ນະຄອນຫຼວງວຽງຈັນ',
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
    storeAddress: 'Đường Kaysone Phomvihane, Bản Phonsavang, TP. Vientiane',
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
 * Robust word-wrap supporting Lao, Vietnamese, English
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
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1;
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

  // 1. STORE HEADER
  drawCenter(L.storeName, y, FONTS.STORE_NAME);
  y += 38;

  drawCenter(L.storeSlogan, y, FONTS.SLOGAN);
  y += 24;

  drawCenter(L.storeAddress, y, FONTS.ADDRESS);
  y += 22;

  drawCenter(L.storeTel, y, FONTS.TEL);
  y += 26;

  // 2. RECEIPT TITLE BANNER (Solid lines enclosing title)
  drawSolidLine(y, 2);
  y += 8;
  drawCenter(L.receiptTitle, y, FONTS.TITLE);
  y += 28;
  drawSolidLine(y, 2);
  y += 12;

  // 3. VOID BANNER (IF CANCELLED)
  if (isCancelled) {
    if (isDraw) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(K80.LEFT_MARGIN, y, K80.PRINTABLE_WIDTH, 36);
      ctx.fillStyle = '#ffffff';
      drawCenter(L.voidTitle, y + 8, FONTS.VOID_TEXT);
      ctx.fillStyle = '#000000';
    }
    y += 46;
  }

  // 4. METADATA SECTION
  // Row 1: Cashier & Customer
  drawLeft(`${L.cashier} ${receipt.cashierName || 'Meii'}`, K80.LEFT_MARGIN, y, FONTS.META_VAL);
  const custName = (!receipt.customerName || receipt.customerName === 'ລູກຄ້າທົ່ວໄປ' || receipt.customerName === 'Khách lẻ / Khách vãng lai')
    ? L.defaultCustomer
    : receipt.customerName;
  drawRight(`${L.customer} ${custName}`, K80.RIGHT_EDGE, y, FONTS.META_BOLD);
  y += 24;

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
  drawRight(`${L.payment} ${payLabel}`, K80.RIGHT_EDGE, y, FONTS.META_BOLD);
  y += 26;

  // 5. COLUMN HEADERS (4 Columns)
  drawDashedLine(y);
  y += 8;
  drawLeft(L.colName, K80.COL_NAME_X, y, FONTS.COL_HEADER);
  if (isDraw) {
    ctx.font = FONTS.COL_HEADER;
    ctx.textAlign = 'center';
    ctx.fillText(L.colQty, K80.COL_QTY_X, y);
  }
  drawRight(L.colPrice, K80.COL_PRICE_X, y, FONTS.COL_HEADER);
  drawRight(L.colTotal, K80.COL_TOTAL_X, y, FONTS.COL_HEADER);
  y += 24;
  drawSolidLine(y, 1);
  y += 8;

  // 6. ITEM ROWS
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

    // First line of row
    drawLeft(nameLines[0], K80.COL_NAME_X, y, FONTS.ITEM_NAME);
    if (isDraw) {
      ctx.font = FONTS.ITEM_NUM;
      ctx.textAlign = 'center';
      ctx.fillText(`${qty}x`, K80.COL_QTY_X, y + 1);
    }
    drawRight(fmtNum(price), K80.COL_PRICE_X, y + 1, FONTS.ITEM_NUM);
    drawRight(fmtNum(lineTotal), K80.COL_TOTAL_X, y + 1, FONTS.ITEM_TOTAL);
    y += 24;

    // Subsequent wrapped lines if name is long
    for (let li = 1; li < nameLines.length; li++) {
      drawLeft(nameLines[li], K80.COL_NAME_X, y, FONTS.ITEM_NAME);
      y += 24;
    }

    // Crate deposit sub-row
    const hasMissingCrates = Boolean(
      it.noEmptyCrates || (Number(it.missingCratesCount) > 0) || (Number(it.crateDepositTotal) > 0)
    );
    if (hasMissingCrates) {
      const feePerCrate = Number(it.crateDepositFee || it.product?.crateDepositFee) || 30000;
      const missingCount = Number(it.missingCratesCount) || (hasMissingCrates ? qty : 0);
      const crateTotal = Number(it.crateDepositTotal) || (missingCount * feePerCrate);

      drawLeft(L.missingCrate, K80.COL_NAME_X + 12, y, FONTS.CRATE_LABEL);
      if (isDraw) {
        ctx.font = FONTS.CRATE_NUM;
        ctx.textAlign = 'center';
        ctx.fillText(`${missingCount}x`, K80.COL_QTY_X, y);
      }
      drawRight(fmtNum(feePerCrate), K80.COL_PRICE_X, y, FONTS.CRATE_NUM);
      drawRight(`+${fmtNum(crateTotal)}`, K80.COL_TOTAL_X, y, FONTS.CRATE_NUM);
      y += 22;
    }

    y += 4; // Padding between items
  }

  y += 4;
  drawDashedLine(y);
  y += 10;

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
  y += 24;

  // Crate deposit total
  if (totalCrateDeposit > 0) {
    drawLeft(L.crateDepositLabel, K80.LEFT_MARGIN, y, FONTS.SUBTOTAL_LABEL);
    drawRight(`+${fmtKip(totalCrateDeposit)}`, K80.RIGHT_EDGE, y, FONTS.SUBTOTAL_NUM);
    y += 24;
  }

  // Discount
  if (discount > 0) {
    drawLeft(L.discountLabel, K80.LEFT_MARGIN, y, FONTS.SUBTOTAL_LABEL);
    drawRight(`-${fmtKip(discount)}`, K80.RIGHT_EDGE, y, FONTS.SUBTOTAL_NUM);
    y += 24;
  }

  // ─── GRAND TOTAL WITH SPACIOUS TOP & BOTTOM PADDING ───
  // BorderTop & BorderBottom have generous internal breathing room (no more sticking to text)
  y += 10;
  drawSolidLine(y, 2.5); // Top border
  y += 14;               // Internal padding top

  drawLeft(L.grandTotalLabel, K80.LEFT_MARGIN, y, FONTS.GRAND_LABEL);
  drawRight(fmtKip(finalGrandTotal), K80.RIGHT_EDGE, y, FONTS.GRAND_NUM);
  y += 34;               // Font line height

  y += 10;               // Internal padding bottom
  drawSolidLine(y, 2.5); // Bottom border
  y += 16;               // Margin below bottom border

  // 8. PAYMENT DETAILS (Tendered / Change / Debt)
  if (isDebt) {
    drawLeft(L.paidLabel, K80.LEFT_MARGIN, y, FONTS.TENDER_LABEL);
    drawRight(fmtKip(receipt.paidAmount ?? receipt.amountTendered ?? 0), K80.RIGHT_EDGE, y, FONTS.TENDER_NUM);
    y += 24;

    const debtAmt = receipt.debtAmount ?? Math.max(0, receipt.grandTotal - (receipt.paidAmount ?? receipt.amountTendered ?? 0));
    drawLeft(L.debtBalanceLabel, K80.LEFT_MARGIN, y, FONTS.DEBT_LABEL);
    drawRight(fmtKip(debtAmt), K80.RIGHT_EDGE, y, FONTS.DEBT_NUM);
    y += 26;

    if (receipt.debtNote) {
      measureCtx.font = FONTS.ADDRESS;
      const noteLines = wrapText(measureCtx, `${L.debtNoteLabel} ${receipt.debtNote}`, K80.PRINTABLE_WIDTH);
      for (const line of noteLines) {
        drawLeft(line, K80.LEFT_MARGIN, y, FONTS.ADDRESS);
        y += 20;
      }
    }
  } else {
    drawLeft(L.tenderedLabel, K80.LEFT_MARGIN, y, FONTS.TENDER_LABEL);
    drawRight(fmtKip(receipt.amountTendered), K80.RIGHT_EDGE, y, FONTS.TENDER_NUM);
    y += 24;

    if (receipt.paymentMethod === 'cash') {
      drawLeft(L.changeLabel, K80.LEFT_MARGIN, y, FONTS.TENDER_LABEL);
      drawRight(fmtKip(receipt.changeAmount), K80.RIGHT_EDGE, y, FONTS.TENDER_NUM);
      y += 24;
    }
  }

  y += 12;

  // 9. QR CODE PAYMENT (If transfer payment or debt)
  const showQr = isTransfer || (isDebt && (receipt.debtAmount ?? receipt.grandTotal) > 0);
  if (showQr) {
    drawDashedLine(y);
    y += 14;

    const qrSize = 140;
    const qrX = K80.CENTER_X - qrSize / 2;

    if (qrImage && isDraw) {
      try {
        ctx.drawImage(qrImage, qrX, y, qrSize, qrSize);
      } catch (_) {}
    } else if (isDraw) {
      ctx.strokeRect(qrX, y, qrSize, qrSize);
      drawCenter('LAO QR PAYMENT', y + qrSize / 2 - 8, FONTS.META_BOLD);
    }
    y += qrSize + 10;

    // Account holder
    drawCenter('VILAIPHONE VANNALATH MS', y, FONTS.QR_NAME);
    y += 20;

    const qrAmount = (receipt.paymentMethod === 'debt' || receipt.isDebt)
      ? (receipt.debtAmount ?? receipt.grandTotal)
      : receipt.grandTotal;
    drawCenter(`${L.transferTotalLabel} ${fmtKip(qrAmount)}`, y, FONTS.QR_AMOUNT);
    y += 28;
  }

  // 10. SIGNATURES SECTION (Dedicated space, dots ONLY under the 2 columns)
  drawDashedLine(y);
  y += 18;

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

  // Generous 75px handwriting room for authentic signing
  y += 75;

  // Dots exclusively under each column (NO full-width line!)
  if (isDraw) {
    ctx.font = FONTS.SIGN_LINE;
    ctx.textAlign = 'center';
    ctx.fillText('........................', sigColLeftX, y);
    ctx.fillText('........................', sigColRightX, y);
  }
  y += 28; // Breathing space below dots

  // 11. BARCODE STRIP (Dashed divider cleanly separates barcode)
  drawDashedLine(y);
  y += 18;

  // Realistic thermal barcode stripes
  const barcodePattern = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 2, 1, 2, 4, 1, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 2, 1, 2, 4];
  const barcodeH = 34;
  const barcodeMultiplier = 2.0;
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
  y += barcodeH + 14; // Clean 14px gap below barcode bars!

  // Receipt Number centered (Never touches barcode bars)
  drawCenter(receipt.receiptNumber || 'MEII-POS', y, FONTS.BARCODE_NUM);
  y += 26; // Generous gap before footer text

  // 12. FOOTER (Thank you & Return policy)
  drawCenter(L.thankYou, y, FONTS.FOOTER_BOLD);
  y += 22;

  drawCenter(L.returnPolicy, y, FONTS.FOOTER);
  y += 24;

  // 13. Paper feed padding before cutter (40px)
  y += 36;

  return Math.ceil(y);
}

// ─── Public API: Render Full Receipt Canvas ───────────────────────────────────
export async function renderReceiptCanvas(receipt, lang = 'lo') {
  if (!receipt) throw new Error('Receipt data is missing');

  // Pre-load QR code if transfer payment or debt
  let qrImg = null;
  const isDebt = receipt.paymentMethod === 'debt' || receipt.isDebt;
  const isTransfer = receipt.paymentMethod !== 'cash';
  if (isTransfer || (isDebt && (receipt.debtAmount ?? receipt.grandTotal) > 0)) {
    qrImg = await preloadImage('/qr.jpg', 600);
  }

  // Pass 1: Measure exact height with zero discrepancy
  const exactHeight = layoutReceipt(null, receipt, lang, qrImg);

  // Pass 2: Allocate 576px canvas
  const canvas = document.createElement('canvas');
  canvas.width = K80.CANVAS_WIDTH;  // EXACTLY 576 dots
  canvas.height = exactHeight;

  const ctx = canvas.getContext('2d');

  // Pure white crisp background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, K80.CANVAS_WIDTH, exactHeight);

  // High-contrast rendering
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  // Execute actual drawing
  layoutReceipt(ctx, receipt, lang, qrImg);

  return canvas;
}

export default { renderReceiptCanvas, K80 };
