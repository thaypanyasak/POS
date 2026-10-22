/**
 * Pure Canvas 2D Receipt Drawing Engine — MeiiShop POS
 * ═══════════════════════════════════════════════════════
 * Standard: 80mm K80 (Physical Width: 576 dots / 72 bytes per line)
 *
 * This engine generates a 1:1 pixel-accurate HTML5 Canvas:
 *   canvas.width = 576;
 *   canvas.height = calculatedTotalHeight;
 *
 * It completely eliminates DOM-capture scaling/clipping artifacts
 * and guarantees sharp, full-width thermal prints on iOS Capacitor.
 */

// ─── 80mm K80 Physical Constants ──────────────────────────────────────────────
export const K80 = {
  CANVAS_WIDTH: 576,    // Physical print dots (72 bytes * 8)
  LEFT_MARGIN: 16,      // Left safe margin
  RIGHT_EDGE: 560,      // Right safe margin (576 - 16)
  PRINTABLE_WIDTH: 544, // 560 - 16
  CENTER_X: 288,        // Symmetry center (576 / 2)

  // 4-Column Item Grid
  COL_NAME_X: 16,       // Column 1: Item Name (start at 16px)
  COL_NAME_MAX_W: 270,  // Max width 270px (wrap if longer)
  COL_QTY_X: 320,       // Column 2: Qty (centered at 320px)
  COL_PRICE_X: 430,     // Column 3: Unit Price (right-aligned at 430px)
  COL_TOTAL_X: 560,     // Column 4: Line Total (right-aligned at 560px)
};

// ─── Font Definitions (Lao & Vietnamese typography) ───────────────────────────
const FONTS = {
  STORE_NAME: 'bold 34px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  SLOGAN: 'bold 19px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  ADDRESS: '17px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  TEL: 'bold 19px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  TITLE: 'bold 26px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  META: '19px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  META_BOLD: 'bold 19px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  COL_HEADER: 'bold 19px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  ITEM_NAME: 'bold 21px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  ITEM_NUM: '20px monospace',
  CRATE_LABEL: 'bold 17px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  CRATE_NUM: '17px monospace',
  SUBTOTAL_LABEL: '19px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  SUBTOTAL_NUM: 'bold 20px monospace',
  GRAND_LABEL: 'bold 28px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  GRAND_NUM: 'bold 30px monospace',
  TENDER_LABEL: '19px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  TENDER_NUM: 'bold 20px monospace',
  DEBT_LABEL: 'bold 21px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  DEBT_NUM: 'bold 22px monospace',
  SIGN_LABEL: 'bold 17px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  SIGN_LINE: '17px monospace',
  BARCODE_NUM: 'bold 16px monospace',
  FOOTER_BOLD: 'bold 18px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  FOOTER: '16px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
  VOID_TEXT: 'bold 24px "Noto Sans Lao", "Be Vietnam Pro", Outfit, sans-serif',
};

// ─── Bilingual Dictionary ─────────────────────────────────────────────────────
const LABELS = {
  lo: {
    storeName: 'ຮ້ານ MeiiShop',
    storeSlogan: 'ຂາຍຍົກ - ຂາຍຍ່ອຍ ສິນຄ້າອຸປະໂພກ ບໍລິໂພກ',
    storeAddress: 'ຖະໜົນ ໄກສອນ ພົມວິຫານ, ບ້ານ ໂພນສະຫວ່າງ',
    storeAddressCity: 'ນະຄອນຫຼວງວຽງຈັນ',
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
    colQty: 'SL',
    colPrice: 'ລາຄາ',
    colTotal: 'ລວມ (₭)',
    missingCrate: '↳ ບໍ່ມີລັງປ່ຽນ',
    crateDepositLabel: 'ຄ່າມັດຈຳລັງ (Crate):',
    subtotalLabel: 'ລວມເງິນສິນຄ້າ (Subtotal):',
    discountLabel: 'ສ່ວນຫຼຸດ (Discount):',
    grandTotalLabel: 'ຍອດຊຳລະສຸດທິ:',
    paidLabel: 'ຈ່າຍແລ້ວ / ຈ່າຍກ່ອນ (Paid):',
    debtBalanceLabel: 'ຍອດຄ້າງຊຳລະ (Debt):',
    debtNoteLabel: '* ໝາຍເຫດ:',
    tenderedLabel: 'ຮັບເງິນມາ (Tendered):',
    changeLabel: 'ເງິນທອນ (Change):',
    transferTotalLabel: 'ຍອດໂອນ:',
    signDebtor: 'ຜູ້ຄ້າງຊຳລະ (Debtor)',
    signCustomer: 'ຜູ້ຮັບເຄື່ອງ (Customer)',
    signSeller: 'ຜູ້ຂາຍ (Seller)',
    signCashier: 'ພະນັກງານ (Cashier)',
    thankYou: 'ຂໍຂອບໃຈລູກຄ້າທີ່ມາອຸດໜູນ!',
    thankYou2: 'ໂອກາດໜ້າເຊີນໃໝ່ເດີ',
    returnPolicy: 'ສິນຄ້າຊື້ແລ້ວ ບໍ່ຮັບປ່ຽນ ຫຼື ຄືນເງິນ',
    defaultItemName: 'ສິນຄ້າ',
    defaultUnitName: 'ອັນ',
  },
  vi: {
    storeName: 'CỬA HÀNG MEIISHOP',
    storeSlogan: 'Bán buôn - Bán lẻ Hàng tiêu dùng',
    storeAddress: 'Đường Kaysone Phomvihane, Bản Phonsavang',
    storeAddressCity: 'TP. Vientiane',
    storeTel: 'ĐT: 020 5555 9999 / 021 214 555',
    receiptTitle: 'HÓA ĐƠN BÁN HÀNG',
    voidTitle: 'HÓA ĐƠN ĐÃ HỦY (VOID)',
    cashier: 'Thu ngân:',
    customer: 'Khách hàng:',
    defaultCustomer: 'Khách lẻ',
    date: 'Ngày:',
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
    crateDepositLabel: 'Cọc vỏ/két (Crate):',
    subtotalLabel: 'Tiền hàng (Subtotal):',
    discountLabel: 'Giảm giá (Discount):',
    grandTotalLabel: 'TỔNG THANH TOÁN:',
    paidLabel: 'Đã thanh toán (Paid):',
    debtBalanceLabel: 'Còn nợ (Debt):',
    debtNoteLabel: '* Ghi chú nợ:',
    tenderedLabel: 'Tiền khách đưa:',
    changeLabel: 'Tiền thừa thối lại:',
    transferTotalLabel: 'Số tiền CK:',
    signDebtor: 'Người nợ (Debtor)',
    signCustomer: 'Người nhận (Customer)',
    signSeller: 'Người bán (Seller)',
    signCashier: 'Thu ngân (Cashier)',
    thankYou: 'ຂໍຂອບໃຈລູກຄ້າທີ່ມາອຸດໜູນ!',
    thankYou2: 'Cảm ơn quý khách & Hẹn gặp lại!',
    returnPolicy: 'Hàng mua rồi miễn đổi hoặc trả lại tiền',
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
 * Robust word-wrap supporting Lao (no spaces), Vietnamese, English
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
      // If a single token without spaces is longer than maxWidth, break character-by-character
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

/**
 * Load image asynchronously with short timeout
 */
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

// ─── Drawing / Measuring Routine ──────────────────────────────────────────────
/**
 * Executes receipt layout.
 * When ctx is provided, actually renders pixels.
 * Returns the final Y position (used for 100% exact auto-height calculation).
 */
function layoutReceipt(ctx, receipt, lang, qrImage = null) {
  const L = LABELS[lang] || LABELS.lo;
  const items = receipt.items?.length > 0 ? receipt.items
    : (receipt.sale_transaction_items?.length > 0 ? receipt.sale_transaction_items : []);
  const isCancelled = receipt.status === 'cancelled' || receipt.isCancelled;
  const isDebt = receipt.paymentMethod === 'debt' || receipt.isDebt;
  const isTransfer = receipt.paymentMethod !== 'cash';

  const isDraw = Boolean(ctx);

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
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#000000';
      ctx.moveTo(K80.LEFT_MARGIN, y);
      ctx.lineTo(K80.RIGHT_EDGE, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  const drawSolidLine = (y, width = 2) => {
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

  let y = 16; // Top padding

  // 1. STORE HEADER
  y += 38;
  drawCenter(L.storeName, y, FONTS.STORE_NAME);
  y += 28;
  drawCenter(L.storeSlogan, y, FONTS.SLOGAN);
  y += 24;
  drawCenter(L.storeAddress, y, FONTS.ADDRESS);
  y += 22;
  drawCenter(L.storeAddressCity, y, FONTS.ADDRESS);
  y += 26;
  drawCenter(L.storeTel, y, FONTS.TEL);
  y += 14;

  // 2. RECEIPT TITLE BANNER
  drawSolidLine(y, 2.5);
  y += 30;
  drawCenter(L.receiptTitle, y, FONTS.TITLE);
  y += 10;
  drawSolidLine(y, 2.5);
  y += 12;

  // 3. VOID BANNER (IF CANCELLED)
  if (isCancelled) {
    if (isDraw) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(K80.LEFT_MARGIN, y, K80.PRINTABLE_WIDTH, 40);
      ctx.fillStyle = '#ffffff';
      drawCenter(L.voidTitle, y + 28, FONTS.VOID_TEXT);
      ctx.fillStyle = '#000000';
    }
    y += 50;
  }

  // 4. METADATA SECTION
  // Row 1: Cashier (Left) & Customer (Right)
  y += 24;
  drawLeft(`${L.cashier} ${receipt.cashierName || 'Meii'}`, K80.LEFT_MARGIN, y, FONTS.META);
  const custName = (!receipt.customerName || receipt.customerName === 'ລູກຄ້າທົ່ວໄປ' || receipt.customerName === 'Khách lẻ / Khách vãng lai')
    ? L.defaultCustomer
    : receipt.customerName;
  drawRight(`${L.customer} ${custName}`, K80.RIGHT_EDGE, y, FONTS.META_BOLD);

  // Row 2: Date (Left) & Payment Method (Right)
  y += 26;
  const dateStr = receipt.createdAt
    ? new Date(receipt.createdAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'lo-LA')
    : new Date().toLocaleString();
  drawLeft(`${L.date} ${dateStr}`, K80.LEFT_MARGIN, y, FONTS.META);

  let payLabel = L.payCash;
  if (receipt.paymentMethod === 'cash') payLabel = L.payCash;
  else if (['transfer', 'qrTransfer', 'onepay'].includes(receipt.paymentMethod)) payLabel = L.payQr;
  else if (receipt.paymentMethod === 'debt') {
    payLabel = Number(receipt.paidAmount || 0) === 0 ? L.payDebtFull : L.payDebtPartial;
  } else payLabel = L.payTransfer;
  drawRight(`${L.payment} ${payLabel}`, K80.RIGHT_EDGE, y, FONTS.META_BOLD);

  y += 16;

  // 5. COLUMN HEADERS (4 Columns: Name, Qty, Price, Total)
  drawDashedLine(y);
  y += 24;
  drawLeft(L.colName, K80.COL_NAME_X, y, FONTS.COL_HEADER);
  if (isDraw) {
    ctx.font = FONTS.COL_HEADER;
    ctx.textAlign = 'center';
    ctx.fillText(L.colQty, K80.COL_QTY_X, y);
  }
  drawRight(L.colPrice, K80.COL_PRICE_X, y, FONTS.COL_HEADER);
  drawRight(L.colTotal, K80.COL_TOTAL_X, y, FONTS.COL_HEADER);
  y += 8;
  drawSolidLine(y, 1.5);
  y += 8;

  // 6. ITEM ROWS
  // Pre-configure dummy ctx if measuring
  const measureCtx = ctx || document.createElement('canvas').getContext('2d');

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

    // Row first line: Item name line 0 + Qty + Price + LineTotal
    y += 24;
    drawLeft(nameLines[0], K80.COL_NAME_X, y, FONTS.ITEM_NAME);
    if (isDraw) {
      ctx.font = FONTS.ITEM_NUM;
      ctx.textAlign = 'center';
      ctx.fillText(`${qty}`, K80.COL_QTY_X, y);
    }
    drawRight(fmtNum(price), K80.COL_PRICE_X, y, FONTS.ITEM_NUM);
    drawRight(fmtNum(lineTotal), K80.COL_TOTAL_X, y, FONTS.ITEM_NUM);

    // Additional wrapped name lines
    for (let li = 1; li < nameLines.length; li++) {
      y += 26;
      drawLeft(nameLines[li], K80.COL_NAME_X, y, FONTS.ITEM_NAME);
    }

    // Crate deposit sub-row if applicable
    const hasMissingCrates = Boolean(
      it.noEmptyCrates || (Number(it.missingCratesCount) > 0) || (Number(it.crateDepositTotal) > 0)
    );
    if (hasMissingCrates) {
      const feePerCrate = Number(it.crateDepositFee || it.product?.crateDepositFee) || 30000;
      const missingCount = Number(it.missingCratesCount) || (hasMissingCrates ? qty : 0);
      const crateTotal = Number(it.crateDepositTotal) || (missingCount * feePerCrate);

      y += 22;
      drawLeft(L.missingCrate, K80.COL_NAME_X + 12, y, FONTS.CRATE_LABEL);
      if (isDraw) {
        ctx.font = FONTS.CRATE_NUM;
        ctx.textAlign = 'center';
        ctx.fillText(`${missingCount}`, K80.COL_QTY_X, y);
      }
      drawRight(fmtNum(feePerCrate), K80.COL_PRICE_X, y, FONTS.CRATE_NUM);
      drawRight(`+${fmtNum(crateTotal)}`, K80.COL_TOTAL_X, y, FONTS.CRATE_NUM);
    }

    y += 6; // Item spacing
  }

  y += 6;
  drawDashedLine(y);
  y += 8;

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
  y += 24;
  drawLeft(L.subtotalLabel, K80.LEFT_MARGIN, y, FONTS.SUBTOTAL_LABEL);
  drawRight(fmtKip(pureGoodsSubtotal), K80.RIGHT_EDGE, y, FONTS.SUBTOTAL_NUM);

  // Crate deposit total
  if (totalCrateDeposit > 0) {
    y += 26;
    drawLeft(L.crateDepositLabel, K80.LEFT_MARGIN, y, FONTS.SUBTOTAL_LABEL);
    drawRight(`+${fmtKip(totalCrateDeposit)}`, K80.RIGHT_EDGE, y, FONTS.SUBTOTAL_NUM);
  }

  // Discount
  if (discount > 0) {
    y += 26;
    drawLeft(L.discountLabel, K80.LEFT_MARGIN, y, FONTS.SUBTOTAL_LABEL);
    drawRight(`-${fmtKip(discount)}`, K80.RIGHT_EDGE, y, FONTS.SUBTOTAL_NUM);
  }

  // GRAND TOTAL (Heavy divider & large font)
  y += 12;
  drawSolidLine(y, 3);
  y += 38;
  drawLeft(L.grandTotalLabel, K80.LEFT_MARGIN, y, FONTS.GRAND_LABEL);
  drawRight(fmtKip(finalGrandTotal), K80.RIGHT_EDGE, y, FONTS.GRAND_NUM);
  y += 10;
  drawSolidLine(y, 3);
  y += 14;

  // 8. PAYMENT DETAILS (Tendered / Change / Debt)
  if (isDebt) {
    y += 26;
    drawLeft(L.paidLabel, K80.LEFT_MARGIN, y, FONTS.TENDER_LABEL);
    drawRight(fmtKip(receipt.paidAmount ?? receipt.amountTendered ?? 0), K80.RIGHT_EDGE, y, FONTS.TENDER_NUM);

    y += 28;
    const debtAmt = receipt.debtAmount ?? Math.max(0, receipt.grandTotal - (receipt.paidAmount ?? receipt.amountTendered ?? 0));
    drawLeft(L.debtBalanceLabel, K80.LEFT_MARGIN, y, FONTS.DEBT_LABEL);
    drawRight(fmtKip(debtAmt), K80.RIGHT_EDGE, y, FONTS.DEBT_NUM);

    if (receipt.debtNote) {
      y += 24;
      measureCtx.font = FONTS.ADDRESS;
      const noteLines = wrapText(measureCtx, `${L.debtNoteLabel} ${receipt.debtNote}`, K80.PRINTABLE_WIDTH);
      for (const line of noteLines) {
        drawLeft(line, K80.LEFT_MARGIN, y, FONTS.ADDRESS);
        y += 20;
      }
    }
  } else {
    y += 26;
    drawLeft(L.tenderedLabel, K80.LEFT_MARGIN, y, FONTS.TENDER_LABEL);
    drawRight(fmtKip(receipt.amountTendered), K80.RIGHT_EDGE, y, FONTS.TENDER_NUM);

    if (receipt.paymentMethod === 'cash') {
      y += 26;
      drawLeft(L.changeLabel, K80.LEFT_MARGIN, y, FONTS.TENDER_LABEL);
      drawRight(fmtKip(receipt.changeAmount), K80.RIGHT_EDGE, y, FONTS.TENDER_NUM);
    }
  }

  y += 14;

  // 9. QR CODE PAYMENT (If transfer payment or unpaid debt)
  const showQr = isTransfer || (isDebt && (receipt.debtAmount ?? receipt.grandTotal) > 0);
  if (showQr) {
    drawDashedLine(y);
    y += 12;

    const qrSize = 150;
    const qrX = K80.CENTER_X - qrSize / 2;

    if (qrImage && isDraw) {
      try {
        ctx.drawImage(qrImage, qrX, y, qrSize, qrSize);
      } catch (_) {}
    } else if (isDraw) {
      // Clean fallback QR placeholder border
      ctx.strokeRect(qrX, y, qrSize, qrSize);
      drawCenter('LAO QR PAYMENT', y + qrSize / 2, FONTS.META_BOLD);
    }
    y += qrSize + 16;

    const qrAmount = (receipt.paymentMethod === 'debt' || receipt.isDebt)
      ? (receipt.debtAmount ?? receipt.grandTotal)
      : receipt.grandTotal;
    drawCenter(`${L.transferTotalLabel} ${fmtKip(qrAmount)}`, y, FONTS.META_BOLD);
    y += 14;
  }

  // 10. SIGNATURES SECTION (Debtor/Customer & Cashier)
  drawDashedLine(y);
  y += 26;

  const sigColLeftX = K80.LEFT_MARGIN + K80.PRINTABLE_WIDTH * 0.25;  // ~152px
  const sigColRightX = K80.LEFT_MARGIN + K80.PRINTABLE_WIDTH * 0.75; // ~424px

  if (isDraw) {
    ctx.font = FONTS.SIGN_LABEL;
    ctx.textAlign = 'center';
    ctx.fillText(isDebt ? L.signDebtor : L.signCustomer, sigColLeftX, y);
    ctx.fillText(isDebt ? L.signSeller : L.signCashier, sigColRightX, y);
  }

  y += 55; // Hand signature spacing

  if (isDraw) {
    ctx.font = FONTS.SIGN_LINE;
    ctx.textAlign = 'center';
    ctx.fillText('...........................', sigColLeftX, y);
    ctx.fillText('...........................', sigColRightX, y);
  }

  y += 16;

  // 11. BARCODE STRIP & FOOTER
  drawDashedLine(y);
  y += 14;

  // Realistic thermal barcode pattern centered at X=288
  const barcodePattern = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 2, 1, 2, 4, 1, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 2, 1, 2, 4];
  const barcodeH = 32;
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

  y += barcodeH + 10;
  drawCenter(receipt.receiptNumber || 'MEII-POS', y, FONTS.BARCODE_NUM);
  y += 24;
  drawCenter(L.thankYou, y, FONTS.FOOTER_BOLD);
  y += 22;
  drawCenter(L.thankYou2, y, FONTS.FOOTER);
  y += 22;
  drawCenter(L.returnPolicy, y, FONTS.FOOTER);

  // 12. Paper feed cushion before cutter (40px)
  y += 40;

  return Math.ceil(y);
}

// ─── Public API: Render Full Receipt Canvas ───────────────────────────────────
/**
 * Asynchronously renders a 576px K80 thermal receipt onto an HTMLCanvasElement.
 *
 * Algorithm:
 *  1. Preloads QR code if applicable
 *  2. Dry-run pass: computes EXACT total pixel height based on content
 *  3. Allocates canvas with canvas.width = 576 and canvas.height = exactHeight
 *  4. Draw pass: renders high-contrast monochrome pixels
 *
 * @param {Object} receipt Receipt object
 * @param {string} [lang='lo'] 'lo' (Lao) or 'vi' (Vietnamese)
 * @returns {Promise<HTMLCanvasElement>} 576px canvas ready for ESC/POS rasterization
 */
export async function renderReceiptCanvas(receipt, lang = 'lo') {
  if (!receipt) throw new Error('Receipt data is missing');

  // Pre-load QR code if transfer payment
  let qrImg = null;
  const isDebt = receipt.paymentMethod === 'debt' || receipt.isDebt;
  const isTransfer = receipt.paymentMethod !== 'cash';
  if (isTransfer || (isDebt && (receipt.debtAmount ?? receipt.grandTotal) > 0)) {
    qrImg = await preloadImage('/qr.jpg', 600);
  }

  // Pass 1: Measure EXACT height (no drawing)
  const exactHeight = layoutReceipt(null, receipt, lang, qrImg);

  // Pass 2: Allocate canvas with exact 576px buffer
  const canvas = document.createElement('canvas');
  canvas.width = K80.CANVAS_WIDTH;  // EXACTLY 576
  canvas.height = exactHeight;

  const ctx = canvas.getContext('2d');

  // Solid white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, K80.CANVAS_WIDTH, exactHeight);

  // High-contrast black graphics & text
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'alphabetic';

  // Execute actual drawing
  layoutReceipt(ctx, receipt, lang, qrImg);

  return canvas;
}

export default { renderReceiptCanvas, K80 };
