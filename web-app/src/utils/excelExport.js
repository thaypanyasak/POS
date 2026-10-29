/**
 * Enterprise Styled Excel Export Engine — MeiiShop POS
 * ══════════════════════════════════════════════════════════════
 * Built with ExcelJS:
 *  - Strict Font: "Phetsarath OT" for 100% of cells
 *  - Executive Teal Headers (#0F766E) with crisp white text
 *  - Professional Currency Number Formatting (#,##0 for LAK, #,##0.00 for THB)
 *  - Clean borders, alternating zebra striping, aligned numbers
 *  - Auto column width fitting with safe padding
 *
 * Full Cross-Platform Support: Web, Desktop, iPad, iOS Safari, Android.
 */

import ExcelJS from 'exceljs';
import { formatCompoundStock } from './formatters.js';

export const EXCEL_FONT = 'Phetsarath OT';

export const COLORS = {
  TEAL_HEADER: 'FF0F766E',      // #0F766E Primary Brand Teal
  TEAL_HEADER_TEXT: 'FFFFFFFF', // #FFFFFF Pure White
  MINT_BG: 'FFF0FDFA',          // #F0FDFA Soft Mint
  ZEBRA_ROW: 'FFF8FAFC',        // #F8FAFC Subtle Slate 50
  BORDER_LIGHT: 'FFE2E8F0',     // #E2E8F0 Light Slate Border
  TEXT_MAIN: 'FF1E293B',        // #1E293B Slate 800
  TEXT_MUTED: 'FF64748B',       // #64748B Slate 500
  TOTAL_BG: 'FFCCFBF1',         // #CCFBF1 Highlight Mint
};

export const BORDER_THIN = {
  top: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
  left: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
  bottom: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
  right: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
};

export const BORDER_TOTAL = {
  top: { style: 'thin', color: { argb: COLORS.TEAL_HEADER } },
  left: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
  bottom: { style: 'double', color: { argb: COLORS.TEAL_HEADER } },
  right: { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } },
};

// ─── Format Date Helper ───────────────────────────────────────────────────────
export function formatExportDate(isoOrDate) {
  if (!isoOrDate) return '';
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return String(isoOrDate);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Auto-Fit Columns Helper (with Title Skip & Custom Widths) ───────────────
export function autoFitColumns(worksheet, optionsOrMinWidth = {}, maybeMaxWidth = 50) {
  let minWidth = 10;
  let maxWidth = 50;
  let colWidths = {};
  let startRow = 4;

  if (typeof optionsOrMinWidth === 'object' && optionsOrMinWidth !== null) {
    minWidth = optionsOrMinWidth.minWidth ?? 10;
    maxWidth = optionsOrMinWidth.maxWidth ?? 50;
    colWidths = optionsOrMinWidth.colWidths ?? {};
    startRow = optionsOrMinWidth.startRow ?? 4;
  } else if (typeof optionsOrMinWidth === 'number') {
    minWidth = optionsOrMinWidth;
    maxWidth = typeof maybeMaxWidth === 'number' ? maybeMaxWidth : 50;
  }

  worksheet.columns.forEach((column, colIdx) => {
    const colNum = colIdx + 1;
    // Explicit per-column override takes priority
    if (colWidths[colNum]) {
      column.width = colWidths[colNum];
      return;
    }

    let maxLen = 0;
    column.eachCell({ includeEmpty: false }, (cell) => {
      // NEVER inspect merged cells or rows before the table header (row 1-3 title block)
      if (cell.isMerged) return;
      if (cell.fullAddress && cell.fullAddress.row < startRow) return;

      const val = cell.value;
      if (val !== null && val !== undefined) {
        const str = typeof val === 'object' && val.text ? String(val.text) : String(val);
        // Exclude bottom total summary text that spans across cells
        if (str.includes('ລວມທັງໝົດ:')) return;
        maxLen = Math.max(maxLen, str.length);
      }
    });

    if (colNum === 1) {
      // First column is always STT / No / Rank: keep strictly slim and fit (width: 7)
      column.width = Math.max(6, Math.min(8, maxLen + 2));
    } else {
      column.width = Math.max(minWidth, Math.min(maxWidth, maxLen + 3));
    }
  });
}

// ─── Apply Top Title Block ────────────────────────────────────────────────────
function applyTitleBlock(worksheet, { title, subtitle, period, date, columnsCount = 10 }) {
  // Row 1: App Title
  const r1 = worksheet.addRow([title]);
  r1.height = 30;
  r1.getCell(1).font = { name: EXCEL_FONT, size: 14, bold: true, color: { argb: COLORS.TEAL_HEADER } };
  r1.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.mergeCells(1, 1, 1, columnsCount);

  // Row 2: Subtitle & Metadata
  const metaParts = [];
  if (subtitle) metaParts.push(subtitle);
  if (period) metaParts.push(`ໄລຍະເວລາ: ${period}`);
  if (date) metaParts.push(`ວັນທີອອກລາຍງານ: ${date}`);
  const r2 = worksheet.addRow([metaParts.join('   |   ')]);
  r2.height = 20;
  r2.getCell(1).font = { name: EXCEL_FONT, size: 9.5, italic: true, color: { argb: COLORS.TEXT_MUTED } };
  r2.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.mergeCells(2, 1, 2, columnsCount);

  // Row 3: Blank Spacer
  worksheet.addRow([]);
}

// ─── Apply Standard Table Header ──────────────────────────────────────────────
function applyHeaderRow(worksheet, columns) {
  const row = worksheet.addRow(columns.map((c) => c.header));
  row.height = 28;
  row.eachCell((cell, colNum) => {
    const colDef = columns[colNum - 1] || {};
    cell.font = { name: EXCEL_FONT, size: 10.5, bold: true, color: { argb: COLORS.TEAL_HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TEAL_HEADER } };
    cell.alignment = { vertical: 'middle', horizontal: colDef.align || 'center', wrapText: true };
    cell.border = BORDER_THIN;
  });
  return row;
}

// ─── Apply Standard Data Row ──────────────────────────────────────────────────
function styleDataRow(row, columns, isEven = false) {
  row.height = 22;
  row.eachCell({ includeEmpty: true }, (cell, colNum) => {
    const colDef = columns[colNum - 1] || {};
    cell.font = { name: EXCEL_FONT, size: 10, color: { argb: COLORS.TEXT_MAIN } };
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: 'middle', horizontal: colDef.align || 'left' };

    if (colDef.numFmt) {
      cell.numFmt = colDef.numFmt;
    }

    if (isEven) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.ZEBRA_ROW } };
    }
  });
}

// ─── Download Workbook (Native iOS Share Sheet or Web Download) ───────────────
export async function downloadWorkbook(workbook, baseFilename) {
  const cleanName = baseFilename.replace(/[\\/:*?"<>|]/g, '_');
  const fullFileName = cleanName.endsWith('.xlsx') ? cleanName : `${cleanName}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });

  // Mobile Web Share API check
  try {
    const file = new File([blob], fullFileName, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: fullFileName,
      });
      return { success: true, fileName: fullFileName, method: 'share' };
    }
  } catch (err) {
    console.warn('[ExcelExport] Share sheet dismissed, using download:', err);
  }

  // Desktop / Web Download
  if (typeof window !== 'undefined' && window.document) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fullFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { success: true, fileName: fullFileName, method: 'download' };
  }

  return { success: false, fileName: fullFileName };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. EXPORT SẢN PHẨM (PRODUCTS CATALOG)
// ══════════════════════════════════════════════════════════════════════════════
export async function exportProductsToExcel(filteredProducts, { category = 'ALL', searchQuery = '' } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MeiiShop POS';
  wb.lastModifiedBy = 'MeiiShop POS';
  wb.created = new Date();

  const ws = wb.addWorksheet('ລາຍການສິນຄ້າ', { views: [{ showGridLines: true }] });

  const catText = category && category !== 'ALL' ? `ໝວດໝູ່: ${category}` : 'ທັງໝົດໝວດໝູ່';
  const searchText = searchQuery ? `ຄົ້ນຫາ: "${searchQuery}"` : '';

  applyTitleBlock(ws, {
    title: 'MEIISHOP POS — ບັນຊີລາຍການສິນຄ້າໃນສາງ (PRODUCTS CATALOG)',
    subtitle: `${catText}${searchText ? `   |   ${searchText}` : ''}`,
    date: formatExportDate(new Date()),
    columnsCount: 11,
  });

  const columns = [
    { header: 'ລ/ດ (No)', key: 'no', align: 'center', width: 7 },
    { header: 'ບາໂຄດ (Barcode)', key: 'barcode', align: 'center', width: 16 },
    { header: 'ຊື່ສິນຄ້າ (Lao Name)', key: 'name', align: 'left', width: 28 },
    { header: 'ຊື່ພາສາຫວຽດ (Vietnamese Name)', key: 'name_vi', align: 'left', width: 20 },
    { header: 'ໝວດໝູ່ (Category)', key: 'category', align: 'center', width: 16 },
    { header: 'ຕົ້ນທຶນ (Cost)', key: 'cost', align: 'right', width: 18 },
    { header: 'ຂະໜາດບັນຈຸ (Packaging)', key: 'packaging', align: 'center', width: 18 },
    { header: 'ລາຄາຂາຍແກັດ (Carton Price)', key: 'cartonPrice', align: 'right', width: 24 },
    { header: 'ລາຄາຂາຍຍ່ອຍ (Retail Price)', key: 'retailPrice', align: 'right', width: 24 },
    { header: 'ສະຕັອກຄົງເຫຼືອ (Current Stock)', key: 'stock', align: 'center', width: 22 },
    { header: 'ມູນຄ່າສະຕັອກ (Stock Value ₭)', key: 'stockValue', align: 'right', numFmt: '#,##0', width: 18 },
  ];

  applyHeaderRow(ws, columns);

  let sumStockUnits = 0;
  let sumStockValue = 0;

  (filteredProducts || []).forEach((p, idx) => {
    // 1. Base / Piece Unit
    const baseUnit = (p.units || []).find((u) => u.tier === 1 || Number(u.multiplier) === 1) || p.units?.[0] || {};
    const baseName = baseUnit.unitName || p.baseUnit || 'ອັນ';

    // 2. Carton Unit
    const cartonUnit = (p.units || []).find(
      (u) =>
        u.tier === 3 ||
        u.id?.endsWith('_carton') ||
        ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງໃຫຍ່', 'ຖັງ'].includes(u.unitName) ||
        Number(u.multiplier) > 1
    ) || null;
    const cartonName = cartonUnit?.unitName || 'ແກັດ';
    const cartonMult = Number(cartonUnit?.multiplier || 0);

    // 3. Cost
    const cost = Number(p.costPerBaseUnit || p.cost || 0);
    const costDisplay = cost > 0 ? `${cost.toLocaleString()} ₭ / ${baseName}` : '0 ₭';

    // 4. Packaging
    const packagingDisplay = cartonUnit && cartonMult > 1
      ? `${cartonMult} ${baseName} / ${cartonName}`
      : `1 ${baseName}`;

    // 5. Carton Selling Price
    let cartonPriceDisplay = '-';
    if (cartonUnit) {
      const cRetail = Number(cartonUnit.retailPrice || 0);
      const cWholesale = Number(cartonUnit.wholesalePrice || 0);
      if (cWholesale > 0 && cWholesale !== cRetail) {
        cartonPriceDisplay = `${cRetail.toLocaleString()} / ${cartonName} (ສີ່: ${cWholesale.toLocaleString()})`;
      } else if (cRetail > 0) {
        cartonPriceDisplay = `${cRetail.toLocaleString()} / ${cartonName}`;
      } else {
        cartonPriceDisplay = `0 / ${cartonName}`;
      }
    }

    // 6. Retail Selling Price
    const pRetail = Number(baseUnit.retailPrice || 0);
    const pWholesale = Number(baseUnit.wholesalePrice || 0);
    let retailPriceDisplay = '';
    if (pWholesale > 0 && pWholesale !== pRetail) {
      retailPriceDisplay = `${pRetail.toLocaleString()} / ${baseName} (ສີ່: ${pWholesale.toLocaleString()})`;
    } else if (pRetail > 0) {
      retailPriceDisplay = `${pRetail.toLocaleString()} / ${baseName}`;
    } else {
      retailPriceDisplay = `0 / ${baseName}`;
    }

    // 7. Stock & Stock Value
    const isTracked = p.trackStock !== false;
    const stock = Number(p.currentStockBaseUnits ?? 0);
    const stockVal = isTracked ? cost * stock : 0;

    if (isTracked) {
      sumStockUnits += stock;
      sumStockValue += stockVal;
    }

    let stockDisplay = 'ບໍ່ນັບສາງ';
    if (isTracked) {
      if (stock <= 0) {
        stockDisplay = 'ໝົດສາງ (0)';
      } else {
        try {
          stockDisplay = formatCompoundStock(p).replace(/ \(ລວມທັງໝົດ:.*\)/, '');
        } catch {
          stockDisplay = `${stock} ${baseName}`;
        }
      }
    }

    const rowData = [
      idx + 1,
      p.barcode || '',
      p.name || '',
      p.name_vi || p.nameVi || '',
      p.category || 'ທົ່ວໄປ',
      costDisplay,
      packagingDisplay,
      cartonPriceDisplay,
      retailPriceDisplay,
      stockDisplay,
      stockVal,
    ];

    const row = ws.addRow(rowData);
    styleDataRow(row, columns, idx % 2 === 1);
  });

  // Summary Row at Bottom
  const totRow = ws.addRow([
    'ລວມທັງໝົດ:',
    `${filteredProducts.length} ລາຍການສິນຄ້າ`,
    '', '', '', '', '', '', '', '',
    sumStockValue,
  ]);
  totRow.height = 25;
  totRow.eachCell((cell, colNum) => {
    cell.font = { name: EXCEL_FONT, size: 10.5, bold: true, color: { argb: COLORS.TEAL_HEADER } };
    cell.border = BORDER_TOTAL;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.MINT_BG } };
    if (colNum === 11) {
      cell.numFmt = '#,##0';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  });

  autoFitColumns(ws, {
    startRow: 4,
    colWidths: {
      1: 7,   // ລ/ດ (No)
      2: 16,  // ບາໂຄດ (Barcode)
      3: 28,  // ຊື່ສິນຄ້າ (Lao Name)
      4: 20,  // ຊື່ພາສາຫວຽດ (Vietnamese Name)
      5: 16,  // ໝວດໝູ່ (Category)
      6: 18,  // ຕົ້ນທຶນ (Cost)
      7: 18,  // ຂະໜາດບັນຈຸ (Packaging)
      8: 24,  // ລາຄາຂາຍແກັດ (Carton Price)
      9: 24,  // ລາຄາຂາຍຍ່ອຍ (Retail Price)
      10: 22, // ສະຕັອກຄົງເຫຼືອ (Current Stock)
      11: 18, // ມູນຄ່າສະຕັອກ (Stock Value ₭)
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const catTag = category && category !== 'ALL' ? `_${String(category).replace(/[\s/\\:*?"<>|]/g, '_')}` : '';
  const searchTag = searchQuery ? `_ຄົ້ນຫາ_${String(searchQuery).replace(/[\s/\\:*?"<>|]/g, '_')}` : '';
  const filename = `ລາຍການສິນຄ້າ${catTag}${searchTag}_${today}`;

  return await downloadWorkbook(wb, filename);
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. EXPORT LỊCH SỬ HÓA ĐƠN (SALES TRANSACTIONS & DEBT HISTORY)
// ══════════════════════════════════════════════════════════════════════════════
export async function exportTransactionsToExcel(
  filteredTransactions,
  { timeframeLabel = 'ທັງໝົດ', tabLabel = 'ທັງໝົດ', searchQuery = '' } = {}
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MeiiShop POS';
  wb.created = new Date();

  // ── Sheet 1: Detailed Invoices ──────────────────────────────────────────────
  const ws1 = wb.addWorksheet('ລາຍການໃບບິນ', { views: [{ showGridLines: true }] });

  applyTitleBlock(ws1, {
    title: 'MEIISHOP POS — ປະຫວັດບິນຂາຍ & ໜີ້ສິນ (SALES TRANSACTIONS)',
    subtitle: `ໝວດການຊຳລະ: ${tabLabel}${searchQuery ? `   |   ຄົ້ນຫາ: "${searchQuery}"` : ''}`,
    period: timeframeLabel,
    date: formatExportDate(new Date()),
    columnsCount: 17,
  });

  const columns = [
    { header: 'ລ/ດ (No)', key: 'no', align: 'center' },
    { header: 'ເລກທີໃບບິນ (Bill No)', key: 'billNo', align: 'center' },
    { header: 'ວັນທີ & ເວລາ (Date & Time)', key: 'datetime', align: 'center' },
    { header: 'ລູກຄ້າ (Customer)', key: 'customer', align: 'left' },
    { header: 'ເບີໂທ (Phone)', key: 'phone', align: 'center' },
    { header: 'ລາຍການສິນຄ້າໃນບິນ (Purchased Items)', key: 'items', align: 'left' },
    { header: 'ຈຳນວນລາຍການ (Count)', key: 'itemCount', align: 'right', numFmt: '#,##0' },
    { header: 'ຍອດລວມສິນຄ້າ (Subtotal ₭)', key: 'subtotal', align: 'right', numFmt: '#,##0' },
    { header: 'ສ່ວນຫຼຸດ (Discount ₭)', key: 'discount', align: 'right', numFmt: '#,##0' },
    { header: 'ຄ່າມັດຈຳລັງ (Crate Deposit ₭)', key: 'crateDeposit', align: 'right', numFmt: '#,##0' },
    { header: 'ຍອດຊຳລະສຸດທິ (Grand Total ₭)', key: 'grandTotal', align: 'right', numFmt: '#,##0' },
    { header: 'ຮູບແບບການຊຳລະ (Method)', key: 'method', align: 'center' },
    { header: 'ຈ່າຍແລ້ວ (Paid ₭)', key: 'paid', align: 'right', numFmt: '#,##0' },
    { header: 'ຍອດຄ້າງຊຳລະ (Debt Balance ₭)', key: 'debt', align: 'right', numFmt: '#,##0' },
    { header: 'ສະຖານະ (Status)', key: 'status', align: 'center' },
    { header: 'ຜູ້ຂາຍ (Cashier)', key: 'cashier', align: 'center' },
    { header: 'ໝາຍເຫດ (Note)', key: 'note', align: 'left' },
  ];

  applyHeaderRow(ws1, columns);

  let sumGrand = 0;
  let sumPaid = 0;
  let sumDebt = 0;

  (filteredTransactions || []).forEach((tx, idx) => {
    const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
    const grand = Number(tx.grandTotal ?? tx.total_lak ?? 0);
    const paid = isCancelled ? 0 : Number(tx.paidAmount ?? (tx.paymentMethod === 'debt' ? 0 : grand));
    const debt = isCancelled ? 0 : Number(tx.remainingDebt ?? tx.debtAmount ?? (tx.paymentMethod === 'debt' ? grand : 0));

    if (!isCancelled) {
      sumGrand += grand;
      sumPaid += paid;
      sumDebt += debt;
    }

    const items = tx.items || tx.sale_transaction_items || [];
    const itemsSummary = items
      .map((it) => {
        const name = it.productName || it.product?.name || 'ສິນຄ້າ';
        const uName = it.unitName || it.unit?.unitName || '';
        const qty = it.quantity || 1;
        return `${name}${uName ? ` (${uName})` : ''} x${qty}`;
      })
      .join('; ');

    const pm = (tx.paymentMethod || '').toLowerCase();
    const pmLabel =
      pm === 'debt' || tx.isDebt
        ? 'ຕິດໜີ້ (Debt)'
        : pm === 'transfer' || pm === 'qr' || pm === 'onepay'
        ? 'ໂອນເງິນ'
        : 'ເງິນສົດ';

    const statusLabel = isCancelled ? 'ຍົກເລີກແລ້ວ' : 'ສຳເລັດ';

    const rowData = [
      idx + 1,
      tx.receiptNumber || tx.receipt_number || `#${tx.id?.slice(0, 8)}`,
      formatExportDate(tx.createdAt || tx.created_at),
      tx.customerName || 'ລູກຄ້າທົ່ວໄປ',
      tx.customerPhone || '',
      itemsSummary,
      items.length,
      Number(tx.subtotalLak ?? tx.subtotal ?? grand),
      Number(tx.discountLak ?? tx.discount ?? 0),
      Number(tx.crateDepositTotal ?? tx.crate_deposit_total ?? 0),
      grand,
      pmLabel,
      paid,
      debt,
      statusLabel,
      tx.cashierName || tx.cashier || 'Meii',
      tx.debtNote || tx.notes || '',
    ];

    const row = ws1.addRow(rowData);
    styleDataRow(row, columns, idx % 2 === 1);
  });

  // Summary Row at Bottom
  const totRow = ws1.addRow([
    'ລວມທັງໝົດ:',
    `${filteredTransactions.length} ໃບບິນ`,
    '', '', '', '', '',
    '', '', '',
    sumGrand,
    '',
    sumPaid,
    sumDebt,
    '', '', '',
  ]);
  totRow.height = 25;
  totRow.eachCell((cell, colNum) => {
    cell.font = { name: EXCEL_FONT, size: 10.5, bold: true, color: { argb: COLORS.TEAL_HEADER } };
    cell.border = BORDER_TOTAL;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.MINT_BG } };
    if (colNum === 11 || colNum === 13 || colNum === 14) {
      cell.numFmt = '#,##0';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  });

  autoFitColumns(ws1);

  // ── Sheet 2: Executive Summary ──────────────────────────────────────────────
  const ws2 = wb.addWorksheet('ສະຫຼຸບຍອດ', { views: [{ showGridLines: true }] });

  applyTitleBlock(ws2, {
    title: 'MEIISHOP POS — ບົດສະຫຼຸບຍອດຂາຍ & ໜີ້ສິນ (SUMMARY)',
    subtitle: `ໝວດການຊຳລະ: ${tabLabel}`,
    period: timeframeLabel,
    date: formatExportDate(new Date()),
    columnsCount: 3,
  });

  const kpiColumns = [
    { header: 'ຕົວຊີ້ວັດຫຼັກ (KPIs)', key: 'kpi', align: 'left' },
    { header: 'ມູນຄ່າ (Value ₭)', key: 'val', align: 'right', numFmt: '#,##0' },
    { header: 'ໝາຍເຫດ', key: 'note', align: 'center' },
  ];
  applyHeaderRow(ws2, kpiColumns);

  const kpis = [
    ['ຈຳນວນບິນທັງໝົດ (Total Invoices)', filteredTransactions.length, 'ບິນ'],
    ['ຍອດຂາຍລວມສຸດທິ (Total Grand Total)', sumGrand, 'ກີບ (₭)'],
    ['ຈ່າຍແລ້ວຕົວຈິງ (Total Paid)', sumPaid, 'ກີບ (₭)'],
    ['ຍອດຄ້າງຊຳລະ / ໜີ້ສິນ (Outstanding Debt)', sumDebt, 'ກີບ (₭)'],
  ];

  kpis.forEach((k, idx) => {
    const row = ws2.addRow(k);
    styleDataRow(row, kpiColumns, idx % 2 === 1);
  });

  autoFitColumns(ws2, 20, 50);

  const today = new Date().toISOString().slice(0, 10);
  const cleanLabel = (str) => (str ? String(str).replace(/\s*\(.*?\)/g, '').replace(/[\s/\\:*?"<>|]/g, '_') : '');
  const tabClean = tabLabel && tabLabel !== 'ທັງໝົດ' ? `_${cleanLabel(tabLabel)}` : '';
  const tfClean = timeframeLabel && timeframeLabel !== 'ທັງໝົດ' ? `_${cleanLabel(timeframeLabel)}` : '';
  const searchTag = searchQuery ? `_ຄົ້ນຫາ_${String(searchQuery).replace(/[\s/\\:*?"<>|]/g, '_')}` : '';
  const filename = `ປະຫວັດໃບບິນ${tabClean}${tfClean}${searchTag}_${today}`;

  return await downloadWorkbook(wb, filename);
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. EXPORT QUẢN LÝ NHẬP HÀNG (PURCHASE ORDERS / GRN)
// ══════════════════════════════════════════════════════════════════════════════
export async function exportPurchasesToExcel(
  filteredOrders,
  { statusLabel = 'ທັງໝົດ', searchQuery = '' } = {}
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MeiiShop POS';
  wb.created = new Date();

  const ws = wb.addWorksheet('ໃບຮັບສິນຄ້າ', { views: [{ showGridLines: true }] });

  applyTitleBlock(ws, {
    title: 'MEIISHOP POS — ບັນຊີການນຳເຂົ້າສິນຄ້າ & ໜີ້ສິນຜູ້ສະໜອງ (GOODS RECEIVED)',
    subtitle: `ສະຖານະ: ${statusLabel}${searchQuery ? `   |   ຄົ້ນຫາ: "${searchQuery}"` : ''}`,
    date: formatExportDate(new Date()),
    columnsCount: 12,
  });

  const columns = [
    { header: 'ລ/ດ (No)', key: 'no', align: 'center' },
    { header: 'ລະຫັດໃບຮັບ (PO Code)', key: 'poCode', align: 'center' },
    { header: 'ວັນທີຮັບສິນຄ້າ (Date)', key: 'date', align: 'center' },
    { header: 'ຜູ້ສະໜອງ (Supplier)', key: 'supplier', align: 'left' },
    { header: 'ລາຍການສິນຄ້ານຳເຂົ້າ (Items)', key: 'items', align: 'left' },
    { header: 'ຈຳນວນລາຍການ (Count)', key: 'count', align: 'right', numFmt: '#,##0' },
    { header: 'ມູນຄ່າລວມ (Total Cost ₭)', key: 'totalCost', align: 'right', numFmt: '#,##0' },
    { header: 'ຈ່າຍແລ້ວ (Paid ₭)', key: 'paid', align: 'right', numFmt: '#,##0' },
    { header: 'ຍອດໜີ້ຄ້າງຈ່າຍ (Debt ₭)', key: 'debt', align: 'right', numFmt: '#,##0' },
    { header: 'ສະຖານະຊຳລະ (Status)', key: 'status', align: 'center' },
    { header: 'ຜູ້ຮັບສິນຄ້າ (Received By)', key: 'receivedBy', align: 'center' },
    { header: 'ໝາຍເຫດ (Note)', key: 'note', align: 'left' },
  ];

  applyHeaderRow(ws, columns);

  let sumCost = 0;
  let sumPaid = 0;
  let sumDebt = 0;

  (filteredOrders || []).forEach((po, idx) => {
    const totalCost = Number(po.total_cost || 0);
    const paid = Number(po.paid_amount || 0);
    const debt = Number(po.debt_amount ?? (totalCost - paid));

    sumCost += totalCost;
    sumPaid += paid;
    sumDebt += debt;

    const items = po.purchase_order_items || [];
    const itemsSummary = items
      .map((it) => `${it.product_name || 'ສິນຄ້າ'} (${it.unit_name || 'ອັນ'}) x${it.quantity_units || it.quantity || 1}`)
      .join('; ');

    const statusText =
      po.payment_status === 'PAID'
        ? 'ຈ່າຍຄົບ (PAID)'
        : po.payment_status === 'DEBT'
        ? 'ຕິດໜີ້ (DEBT)'
        : 'ຈ່າຍບາງສ່ວນ (PARTIAL)';

    const rowData = [
      idx + 1,
      po.id ? String(po.id).slice(0, 12).toUpperCase() : '',
      formatExportDate(po.created_at || po.received_at),
      po.suppliers?.name || 'ຜູ້ສະໜອງທົ່ວໄປ',
      itemsSummary,
      items.length,
      totalCost,
      paid,
      debt,
      statusText,
      po.received_by || 'Meii',
      po.notes || '',
    ];

    const row = ws.addRow(rowData);
    styleDataRow(row, columns, idx % 2 === 1);
  });

  // Summary Row at Bottom
  const totRow = ws.addRow([
    'ລວມທັງໝົດ:',
    `${filteredOrders.length} ໃບຮັບ`,
    '', '', '', '',
    sumCost,
    sumPaid,
    sumDebt,
    '', '', '',
  ]);
  totRow.height = 25;
  totRow.eachCell((cell, colNum) => {
    cell.font = { name: EXCEL_FONT, size: 10.5, bold: true, color: { argb: COLORS.TEAL_HEADER } };
    cell.border = BORDER_TOTAL;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.MINT_BG } };
    if (colNum === 7 || colNum === 8 || colNum === 9) {
      cell.numFmt = '#,##0';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  });

  autoFitColumns(ws);

  const today = new Date().toISOString().slice(0, 10);
  const statusTag = statusLabel && statusLabel !== 'ທັງໝົດ' ? `_${String(statusLabel).replace(/\s*\(.*?\)/g, '').replace(/[\s/\\:*?"<>|]/g, '_')}` : '';
  const searchTag = searchQuery ? `_ຄົ້ນຫາ_${String(searchQuery).replace(/[\s/\\:*?"<>|]/g, '_')}` : '';
  const filename = `ລາຍການນຳເຂົ້າສິນຄ້າ${statusTag}${searchTag}_${today}`;

  return await downloadWorkbook(wb, filename);
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. EXPORT BÁO CÁO BÁN THEO ĐƠN VỊ (SALES BY UNIT REPORT)
// ══════════════════════════════════════════════════════════════════════════════
export async function exportSalesByUnitToExcel(
  displayedProducts,
  { timeframeLabel = 'ມື້ນີ້', totalTransactions = 0, totalRevenue = 0 } = {}
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MeiiShop POS';
  wb.created = new Date();

  const ws = wb.addWorksheet('ຂາຍຕາມຫົວໜ່ວຍ', { views: [{ showGridLines: true }] });

  applyTitleBlock(ws, {
    title: 'MEIISHOP POS — ລາຍງານຍອດຂາຍຕາມຂັ້ນຫົວໜ່ວຍ (SALES BY UNIT)',
    subtitle: `ຈຳນວນບິນທີ່ຂາຍ: ${totalTransactions} ບິນ`,
    period: timeframeLabel,
    date: formatExportDate(new Date()),
    columnsCount: 11,
  });

  const columns = [
    { header: 'ລ/ດ (No)', key: 'no', align: 'center' },
    { header: 'ຊື່ສິນຄ້າ (Product Name)', key: 'name', align: 'left' },
    { header: 'ຊື່ພາສາຫວຽດ (Vietnamese Name)', key: 'name_vi', align: 'left' },
    { header: 'ບາໂຄດ (Barcode)', key: 'barcode', align: 'center' },
    { header: 'ໝວດໝູ່ (Category)', key: 'category', align: 'center' },
    { header: 'ຂາຍແກັດ/ລັງ (Cartons Sold)', key: 'cartonQty', align: 'right' },
    { header: 'ຂາຍແພັກ (Packs Sold)', key: 'packQty', align: 'right' },
    { header: 'ຂາຍຍ່ອຍ (Pieces Sold)', key: 'retailQty', align: 'right' },
    { header: 'ລວມໜ່ວຍຍ່ອຍ (Base Units)', key: 'totalBase', align: 'right', numFmt: '#,##0' },
    { header: 'ຍອດຂາຍລວມ (Revenue ₭)', key: 'revenue', align: 'right', numFmt: '#,##0' },
    { header: 'ສ່ວນແບ່ງ (%)', key: 'share', align: 'right', numFmt: '0.0%' },
  ];

  applyHeaderRow(ws, columns);

  let sumRevenue = 0;
  let sumBaseUnits = 0;

  (displayedProducts || []).forEach((p, idx) => {
    const rev = Number(p.revenue || 0);
    const baseUnits = Number(p.totalBaseUnits || 0);
    sumRevenue += rev;
    sumBaseUnits += baseUnits;

    const cartonStr = p.cartonQty > 0 ? `${p.cartonQty} ${p.cartonUnitName || 'ແກັດ'}` : '0';
    const packStr = p.packQty > 0 ? `${p.packQty} ${p.packUnitName || 'ແພັກ'}` : '0';
    const retailStr = p.retailQty > 0 ? `${p.retailQty} ${p.retailUnitName || 'ອັນ'}` : '0';
    const shareRatio = totalRevenue > 0 ? rev / totalRevenue : 0;

    const rowData = [
      idx + 1,
      p.name || '',
      p.name_vi || p.nameVi || '',
      p.barcode || '',
      p.category || 'ທົ່ວໄປ',
      cartonStr,
      packStr,
      retailStr,
      baseUnits,
      rev,
      shareRatio,
    ];

    const row = ws.addRow(rowData);
    styleDataRow(row, columns, idx % 2 === 1);
  });

  // Summary Row at Bottom
  const totRow = ws.addRow([
    'ລວມທັງໝົດ:',
    `${displayedProducts.length} ສິນຄ້າ`,
    '', '', '', '', '', '',
    sumBaseUnits,
    sumRevenue,
    1.0,
  ]);
  totRow.height = 25;
  totRow.eachCell((cell, colNum) => {
    cell.font = { name: EXCEL_FONT, size: 10.5, bold: true, color: { argb: COLORS.TEAL_HEADER } };
    cell.border = BORDER_TOTAL;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.MINT_BG } };
    if (colNum === 9 || colNum === 10) {
      cell.numFmt = '#,##0';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (colNum === 11) {
      cell.numFmt = '0.0%';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  });

  autoFitColumns(ws);

  const today = new Date().toISOString().slice(0, 10);
  const cleanLabel = (str) => (str ? String(str).replace(/\s*\(.*?\)/g, '').replace(/[\s/\\:*?"<>|]/g, '_') : '');
  const tfTag = timeframeLabel ? `_${cleanLabel(timeframeLabel)}` : '';
  const filename = `ລາຍງານຂາຍຕາມຫົວໜ່ວຍ${tfTag}_${today}`;

  return await downloadWorkbook(wb, filename);
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. EXPORT DASHBOARD (BEST PRACTICE EXECUTIVE REPORT)
// ══════════════════════════════════════════════════════════════════════════════
export async function exportDashboardToExcel({
  timeframeLabel = 'ມື້ນີ້',
  exchangeRate = 683,
  snapshotMetrics = {},
  hourlyData = [],
  categoryBreakdown = [],
  topProducts = [],
  currentTxs = [],
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MeiiShop POS';
  wb.created = new Date();

  const rate = Number(exchangeRate) || 683;

  // ── Sheet 1: Executive Financial Summary & Breakdowns ─────────────────────────
  const ws1 = wb.addWorksheet('ສະຫຼຸບລາຍຮັບ-ຕົ້ນທຶນ', { views: [{ showGridLines: true }] });

  applyTitleBlock(ws1, {
    title: 'MEIISHOP CLOUD POS — ບົດລາຍງານແຜງຄວບຄຸມລາຍຮັບ & ຕົ້ນທຶນ (EXECUTIVE DASHBOARD)',
    subtitle: `ອັດຕາແລກປ່ຽນອ້າງອີງ: 1 THB = ${rate.toLocaleString()} LAK`,
    period: timeframeLabel,
    date: formatExportDate(new Date()),
    columnsCount: 4,
  });

  // Section 1 Header: CORE FINANCIAL KPIS
  const sec1 = ws1.addRow(['1. ຕົວຊີ້ວັດການເງິນຫຼັກ (CORE FINANCIAL KPIS)', '', '', '']);
  sec1.height = 24;
  sec1.getCell(1).font = { name: EXCEL_FONT, size: 11, bold: true, color: { argb: COLORS.TEAL_HEADER } };
  sec1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.MINT_BG } };
  ws1.mergeCells(sec1.number, 1, sec1.number, 4);

  const kpiCols = [
    { header: 'ຕົວຊີ້ວັດ (Financial Metric)', key: 'metric', align: 'left' },
    { header: 'ມູນຄ່າກີບ (LAK ₭)', key: 'lak', align: 'right', numFmt: '#,##0' },
    { header: 'ມູນຄ່າບາດ (THB ฿)', key: 'thb', align: 'right', numFmt: '#,##0.00' },
  ];
  applyHeaderRow(ws1, kpiCols);

  const kpiData = [
    ['ຍອດຂາຍລວມ (Total Revenue)', snapshotMetrics.totalRevenueLak || 0, snapshotMetrics.totalRevenueThb || 0],
    ['ຕົ້ນທຶນສິນຄ້າ (Cost of Goods Sold - COGS)', snapshotMetrics.totalCostLak || 0, snapshotMetrics.totalCostThb || 0],
    ['ກຳໄລຂັ້ນຕົ້ນ (Gross Profit)', snapshotMetrics.totalProfitLak || 0, snapshotMetrics.totalProfitThb || 0],
    ['ອັດຕາກຳໄລຂັ້ນຕົ້ນ (Gross Margin %)', Number(snapshotMetrics.margin || 0) / 100, ''],
    ['ຈຳນວນບິນຂາຍທັງໝົດ (Total Invoices)', `${(snapshotMetrics.txCount || 0).toLocaleString()} ບິນ`, ''],
    ['ມູນຄ່າສະເລ່ຍຕໍ່ບິນ (Average Ticket Size)', snapshotMetrics.avgTicketLak || 0, snapshotMetrics.avgTicketThb || 0],
  ];

  kpiData.forEach((k, idx) => {
    const row = ws1.addRow(k);
    styleDataRow(row, kpiCols, idx % 2 === 1);
    // Special format for Margin row
    if (idx === 3) {
      row.getCell(2).numFmt = '0.0%';
    }
  });

  ws1.addRow([]); // Blank spacer

  // Section 2: PAYMENT METHOD BREAKDOWN
  const sec2 = ws1.addRow(['2. ຍອດຂາຍຕາມຮູບແບບການຊຳລະ (PAYMENT METHOD BREAKDOWN)', '', '', '']);
  sec2.height = 24;
  sec2.getCell(1).font = { name: EXCEL_FONT, size: 11, bold: true, color: { argb: COLORS.TEAL_HEADER } };
  sec2.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.MINT_BG } };
  ws1.mergeCells(sec2.number, 1, sec2.number, 4);

  const pmCols = [
    { header: 'ຮູບແບບການຊຳລະ (Payment Method)', key: 'method', align: 'left' },
    { header: 'ຍອດເງິນ (LAK ₭)', key: 'amount', align: 'right', numFmt: '#,##0' },
    { header: 'ອັດຕາສ່ວນ (%)', key: 'share', align: 'right', numFmt: '0.0%' },
  ];
  applyHeaderRow(ws1, pmCols);

  let cashTotal = 0;
  let transferTotal = 0;
  let debtTotal = 0;
  (currentTxs || []).forEach((t) => {
    const rev = Number(t.grandTotal ?? t.total_lak ?? 0);
    const m = (t.paymentMethod || '').toLowerCase();
    if (t.isDebt || m === 'debt') debtTotal += rev;
    else if (m === 'cash' || m === 'ເງິນສົດ') cashTotal += rev;
    else transferTotal += rev;
  });
  const totalRev = (snapshotMetrics.totalRevenueLak || cashTotal + transferTotal + debtTotal) || 1;

  const pmData = [
    ['ເງິນສົດ (Cash)', cashTotal, cashTotal / totalRev],
    ['ໂອນເງິນ / QR (Transfer / QR)', transferTotal, transferTotal / totalRev],
    ['ຕິດໜີ້ (Debt / Credit)', debtTotal, debtTotal / totalRev],
  ];

  pmData.forEach((pm, idx) => {
    const row = ws1.addRow(pm);
    styleDataRow(row, pmCols, idx % 2 === 1);
  });

  ws1.addRow([]); // Blank spacer

  // Section 3: SALES BY CATEGORY
  const sec3 = ws1.addRow(['3. ຍອດຂາຍຕາມໝວດໝູ່ສິນຄ້າ (SALES BY CATEGORY)', '', '', '']);
  sec3.height = 24;
  sec3.getCell(1).font = { name: EXCEL_FONT, size: 11, bold: true, color: { argb: COLORS.TEAL_HEADER } };
  sec3.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.MINT_BG } };
  ws1.mergeCells(sec3.number, 1, sec3.number, 4);

  const catCols = [
    { header: 'ໝວດໝູ່ (Category)', key: 'cat', align: 'left' },
    { header: 'ຈຳນວນຂາຍ (Qty)', key: 'qty', align: 'right', numFmt: '#,##0' },
    { header: 'ຍອດຂາຍ (LAK ₭)', key: 'rev', align: 'right', numFmt: '#,##0' },
    { header: 'ສ່ວນແບ່ງ (%)', key: 'share', align: 'right', numFmt: '0.0%' },
  ];
  applyHeaderRow(ws1, catCols);

  (categoryBreakdown || []).forEach((cat, idx) => {
    const row = ws1.addRow([
      cat.name,
      cat.quantity,
      cat.revenue,
      Number(cat.percentage || 0) / 100,
    ]);
    styleDataRow(row, catCols, idx % 2 === 1);
  });

  ws1.addRow([]); // Blank spacer

  // Section 4: HOURLY SALES BREAKDOWN
  const sec4 = ws1.addRow(['4. ຍອດຂາຍຕາມຊ່ວງໂມງ (HOURLY SALES BREAKDOWN)', '', '', '']);
  sec4.height = 24;
  sec4.getCell(1).font = { name: EXCEL_FONT, size: 11, bold: true, color: { argb: COLORS.TEAL_HEADER } };
  sec4.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.MINT_BG } };
  ws1.mergeCells(sec4.number, 1, sec4.number, 4);

  const hourlyCols = [
    { header: 'ຊ່ວງໂມງ (Time)', key: 'time', align: 'center' },
    { header: 'ຈຳນວນບິນ (Invoices)', key: 'count', align: 'right', numFmt: '#,##0' },
    { header: 'ຍອດຂາຍ (LAK ₭)', key: 'rev', align: 'right', numFmt: '#,##0' },
  ];
  applyHeaderRow(ws1, hourlyCols);

  (hourlyData || []).forEach((h, idx) => {
    const row = ws1.addRow([h.label, h.txCount, h.revenue]);
    styleDataRow(row, hourlyCols, idx % 2 === 1);
  });

  autoFitColumns(ws1, 16, 50);

  // ── Sheet 2: Top Best Sellers ────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('ສິນຄ້າຂາຍດີ', { views: [{ showGridLines: true }] });

  applyTitleBlock(ws2, {
    title: 'MEIISHOP POS — TOP ສິນຄ້າຂາຍດີທີ່ສຸດ (BEST SELLERS)',
    period: timeframeLabel,
    date: formatExportDate(new Date()),
    columnsCount: 7,
  });

  const topCols = [
    { header: 'ອັນດັບ (Rank)', key: 'rank', align: 'center' },
    { header: 'ຊື່ສິນຄ້າ (Product Name)', key: 'name', align: 'left' },
    { header: 'ຈຳນວນຂາຍ (Units Sold)', key: 'units', align: 'right' },
    { header: 'ຈຳນວນບິນທີ່ສັ່ງ (Orders Count)', key: 'orders', align: 'right', numFmt: '#,##0' },
    { header: 'ຍອດຂາຍລວມ (Total Revenue ₭)', key: 'rev', align: 'right', numFmt: '#,##0' },
    { header: 'ກຳໄລລວມ (Total Profit ₭)', key: 'profit', align: 'right', numFmt: '#,##0' },
    { header: 'ອັດຕາກຳໄລ (%)', key: 'margin', align: 'right', numFmt: '0.0%' },
  ];
  applyHeaderRow(ws2, topCols);

  (topProducts || []).forEach((tp, idx) => {
    const rev = Number(tp.revenue || 0);
    const profit = Number(tp.profit || 0);
    const marginRatio = rev > 0 ? profit / rev : 0;

    const rowData = [
      idx + 1,
      tp.name || 'ສິນຄ້າ',
      tp.formattedSold || `${tp.totalBaseUnits} ອັນ`,
      tp.ordersCount || 0,
      rev,
      profit,
      marginRatio,
    ];

    const row = ws2.addRow(rowData);
    styleDataRow(row, topCols, idx % 2 === 1);
  });

  autoFitColumns(ws2, 14, 50);

  // ── Sheet 3: Transactions Log in Timeframe ────────────────────────────────────
  const ws3 = wb.addWorksheet('ລາຍການບິນໃນຊ່ວງເວລາ', { views: [{ showGridLines: true }] });

  applyTitleBlock(ws3, {
    title: 'MEIISHOP POS — ລາຍການບິນຂາຍໃນຊ່ວງເວລາ (INVOICES LOG)',
    period: timeframeLabel,
    date: formatExportDate(new Date()),
    columnsCount: 9,
  });

  const txCols = [
    { header: 'ລ/ດ (No)', key: 'no', align: 'center' },
    { header: 'ເລກທີໃບບິນ (Bill No)', key: 'billNo', align: 'center' },
    { header: 'ວັນທີ & ເວລາ (Date & Time)', key: 'datetime', align: 'center' },
    { header: 'ລູກຄ້າ (Customer)', key: 'customer', align: 'left' },
    { header: 'ຮູບແບບຊຳລະ (Method)', key: 'method', align: 'center' },
    { header: 'ຍອດຂາຍລວມ (Revenue ₭)', key: 'rev', align: 'right', numFmt: '#,##0' },
    { header: 'ຕົ້ນທຶນ (Cost ₭)', key: 'cost', align: 'right', numFmt: '#,##0' },
    { header: 'ກຳໄລ (Profit ₭)', key: 'profit', align: 'right', numFmt: '#,##0' },
    { header: 'ສະຖານະ (Status)', key: 'status', align: 'center' },
  ];
  applyHeaderRow(ws3, txCols);

  let sumTxRev = 0;
  let sumTxCost = 0;
  let sumTxProfit = 0;

  (currentTxs || []).forEach((tx, idx) => {
    const rev = Number(tx.grandTotal ?? tx.total_lak ?? 0);
    const cost = Number(tx.total_cost_lak ?? tx.total_cost ?? tx.totalCost ?? 0);
    const profit = Number(tx.gross_profit_lak ?? tx.grossProfit ?? (rev - cost));

    sumTxRev += rev;
    sumTxCost += cost;
    sumTxProfit += profit;

    const pm = (tx.paymentMethod || '').toLowerCase();
    const pmLabel =
      pm === 'debt' || tx.isDebt
        ? 'ຕິດໜີ້ (Debt)'
        : pm === 'transfer' || pm === 'qr' || pm === 'onepay'
        ? 'ໂອນເງິນ'
        : 'ເງິນສົດ';

    const rowData = [
      idx + 1,
      tx.receiptNumber || tx.receipt_number || `#${tx.id?.slice(0, 8)}`,
      formatExportDate(tx.createdAt || tx.created_at),
      tx.customerName || 'ລູກຄ້າທົ່ວໄປ',
      pmLabel,
      rev,
      cost,
      profit,
      tx.status === 'cancelled' || tx.isCancelled ? 'ຍົກເລີກແລ້ວ' : 'ສຳເລັດ',
    ];

    const row = ws3.addRow(rowData);
    styleDataRow(row, txCols, idx % 2 === 1);
  });

  // Total summary row
  const totTxRow = ws3.addRow([
    'ລວມທັງໝົດ:',
    `${currentTxs.length} ໃບບິນ`,
    '', '', '',
    sumTxRev,
    sumTxCost,
    sumTxProfit,
    '',
  ]);
  totTxRow.height = 25;
  totTxRow.eachCell((cell, colNum) => {
    cell.font = { name: EXCEL_FONT, size: 10.5, bold: true, color: { argb: COLORS.TEAL_HEADER } };
    cell.border = BORDER_TOTAL;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.MINT_BG } };
    if (colNum === 6 || colNum === 7 || colNum === 8) {
      cell.numFmt = '#,##0';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  });

  autoFitColumns(ws3);

  const today = new Date().toISOString().slice(0, 10);
  const cleanLabel = (str) => (str ? String(str).replace(/\s*\(.*?\)/g, '').replace(/[\s/\\:*?"<>|]/g, '_') : '');
  const tfClean = timeframeLabel ? `_${cleanLabel(timeframeLabel)}` : '';
  const filename = `ແຜງຄວບຄຸມ_ລາຍຮັບ_ຕົ້ນທຶນ${tfClean}_${today}`;

  return await downloadWorkbook(wb, filename);
}

export default {
  exportProductsToExcel,
  exportTransactionsToExcel,
  exportPurchasesToExcel,
  exportSalesByUnitToExcel,
  exportDashboardToExcel,
};
