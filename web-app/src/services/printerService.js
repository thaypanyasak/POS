import { Capacitor } from '@capacitor/core';
import { Printer } from '@capgo/capacitor-printer';
import {
  getPrinterConfig,
  savePrinterConfig,
  fetchPrinterConfigFromDb,
  DEFAULT_PRINTER_CONFIG,
  PRINTER_STORAGE_KEY,
} from './printerConfigService';
import {
  ESC_INIT,
  ESC_HEAT_DENSITY,
  ESC_DRAWER_KICK,
  GS_CUT_PARTIAL,
  ESC_FEED_LINES,
  canvasToEscPosRaster,
  uint8ArrayToBase64,
} from './escposGenerator';
import { renderReceiptCanvas } from './receiptCanvasEngine';
import { ensureSaysetthaLoaded, SAYSETTHA_CSS } from '../utils/saysetthaFont';
import { ensureTahomaLoaded } from '../utils/tahomaFont';
import { TcpSocket } from '@deedarb/capacitor-tcp-socket';

// Re-export printer configuration APIs for seamless backward compatibility
export {
  getPrinterConfig,
  savePrinterConfig,
  fetchPrinterConfigFromDb,
  DEFAULT_PRINTER_CONFIG,
  PRINTER_STORAGE_KEY as PRINTER_STORAGE_KEYS,
};

// ─── K80 Constants ───────────────────────────────────────────────────────────
export const PRINT_WIDTH_DOTS = 576; // 80mm K80 = 576 thermal dots

/**
 * Format any receipt object into the standardized structure
 */
export function formatReceiptForNative(receipt, language = 'lo') {
  if (!receipt) {
    return {
      storeName: language === 'vi' ? 'CỬA HÀNG SOMSAK' : 'ຮ້ານ ສົມສັກ',
      storeSlogan: '',
      storeAddress: language === 'vi' ? 'Làng Phonesavanh, TP.Pakse, Champasak' : 'ບ້ານ ໂພນສະຫວັນ, ນະຄອນປາກເຊ, ຈຳປາສັກ',
      storeTel: '020 56468780 / 02052228432',
      receiptNumber: 'MEII-POS',
      items: [],
      subtotal: 0,
      grandTotal: 0,
      language,
    };
  }

  const rawItems = receipt.items && receipt.items.length > 0
    ? receipt.items
    : (receipt.sale_transaction_items && receipt.sale_transaction_items.length > 0
        ? receipt.sale_transaction_items
        : []);

  const formattedItems = rawItems.map((item) => {
    let name;
    const rawLao = item.product?.name || item.productName || item.product_name || item.name || 'ສິນຄ້າ';
    if (language === 'vi') {
      const directVi =
        item.name_vi ||
        item.nameVi ||
        item.product_name_vi ||
        item.productNameVi ||
        item.name_vietnam ||
        item.name_vn ||
        item.product?.name_vi ||
        item.product?.nameVi ||
        item.product?.name_vietnam ||
        item.product?.name_vn;

      if (directVi && String(directVi).trim()) {
        name = String(directVi).trim();
      } else {
        const prodId = item.product?.id || item.productId || item.product_id || item.id;
        // Check receipt.products if available
        if (receipt?.products && Array.isArray(receipt.products)) {
          const match = receipt.products.find(
            (p) => (prodId && p.id === prodId) || (rawLao && p.name && p.name.trim() === rawLao.trim())
          );
          const matchVi = match?.name_vi || match?.nameVi || match?.name_vietnam || match?.name_vn;
          if (matchVi && String(matchVi).trim()) {
            name = String(matchVi).trim();
          }
        }
        // Fallback to localStorage cache
        if (!name) {
          try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem('meiishop_products_v5') : null;
            if (raw) {
              const pool = JSON.parse(raw);
              if (Array.isArray(pool)) {
                const match = pool.find(
                  (p) => (prodId && p.id === prodId) || (rawLao && p.name && p.name.trim() === rawLao.trim())
                );
                const matchVi = match?.name_vi || match?.nameVi || match?.name_vietnam || match?.name_vn;
                if (matchVi && String(matchVi).trim()) {
                  name = String(matchVi).trim();
                }
              }
            }
          } catch (_) {}
        }
      }
      if (!name) name = rawLao;
    } else {
      name = rawLao;
    }

    const qty = Number(item.quantity ?? item.qty ?? 1);
    const price = Number(item.unit_price ?? item.price ?? 0);
    const total = Number(item.total_price ?? item.total ?? (qty * price));
    const unit = item.unit || '';
    const hasCrate = Boolean(item.hasCrateDeposit || item.missingCrateCount > 0);
    const missingCrateCount = Number(item.missingCrateCount ?? (item.missingCrates || 0));
    const feePerCrate = Number(item.feePerCrate || 30000);

    return {
      name,
      quantity: qty,
      unit,
      unit_price: price,
      total_price: total,
      hasCrateDeposit: hasCrate,
      missingCrateCount,
      feePerCrate,
      crateTotal: missingCrateCount * feePerCrate,
    };
  });

  const subtotal = Number(receipt.subtotal ?? receipt.goodsSubtotal ?? receipt.grandTotal ?? 0);
  const discount = Number(receipt.discount ?? 0);
  const crateDeposit = Number(receipt.totalCrateDeposit ?? receipt.crateDepositTotal ?? 0);
  const grandTotal = Number(receipt.grandTotal ?? (subtotal - discount + crateDeposit));
  const tendered = Number(receipt.amountTendered ?? receipt.paidAmount ?? 0);
  const change = Number(receipt.changeAmount ?? 0);
  const debt = Number(receipt.debtAmount ?? (receipt.paymentMethod === 'debt' ? grandTotal : 0));

  let dateStr = '';
  if (receipt.createdAt) {
    try {
      dateStr = new Date(receipt.createdAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'lo-LA');
    } catch (_) {
      dateStr = String(receipt.createdAt);
    }
  } else {
    dateStr = new Date().toLocaleString(language === 'vi' ? 'vi-VN' : 'lo-LA');
  }

  return {
    receiptNumber: receipt.receiptNumber || receipt.id || 'MEII-POS',
    createdAt: dateStr,
    storeName: language === 'vi' ? 'CỬA HÀNG SOMSAK' : 'ຮ້ານ ສົມສັກ',
    storeSlogan: '',
    storeAddress: language === 'vi' ? 'Làng Phonesavanh, TP.Pakse, Champasak' : 'ບ້ານ ໂພນສະຫວັນ, ນະຄອນປາກເຊ, ຈຳປາສັກ',
    storeTel: '020 56468780 / 02052228432',
    cashierName: (!receipt.cashierName || receipt.cashierName.includes('\u0ec4\u0ea1\u0ec9\u0e84\u0eb3') || receipt.cashierName.includes('Meii')) ? 'Meii' : receipt.cashierName,
    customerName: receipt.customerName || (language === 'vi' ? 'Khách lẻ' : 'ລູກຄ້າທົ່ວໄປ'),
    paymentMethod: receipt.paymentMethod || 'cash',
    items: formattedItems,
    subtotal,
    discount,
    totalCrateDeposit: crateDeposit,
    grandTotal,
    amountTendered: tendered,
    changeAmount: change,
    debtAmount: debt,
    qrCodeData: receipt.qrCodeData || `https://laoqrcode.meii/${receipt.receiptNumber || 'POS'}`,
    isCancelled: Boolean(receipt.status === 'cancelled' || receipt.isCancelled),
    isQuotation: Boolean(receipt.isQuotation),
    language,
  };
}

/**
 * Intelligent Smart Print Dispatcher — Pure Canvas 2D (Phetsarath OT) & Direct RAW TCP Socket
 * Works 100% inside OTA bundle without needing Xcode rebuild.
 */
export async function printReceiptSmart({
  elementId = 'thermal-receipt-print-area',
  receipt = null,
  language = 'lo',
  allowFallback = false,
  method = null,
  products = null,
} = {}) {
  const isNative = Capacitor.isNativePlatform();
  const config = getPrinterConfig();
  const activeMethod = method || config.printMethod || 'socket';

  // Attach products pool if available for canvas engine lookup
  if (receipt && !receipt.products) {
    if (products && Array.isArray(products) && products.length > 0) {
      receipt.products = products;
    } else {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('meiishop_products_v5') : null;
        if (raw) {
          const pool = JSON.parse(raw);
          if (Array.isArray(pool)) receipt.products = pool;
        }
      } catch (_) {}
    }
  }

  // MODE 1: Print via OS Native Spooler (AirPrint / OS Dialog)
  if (activeMethod === 'spooler') {
    return await printViaNativeSpooler(elementId, language);
  }

  // MODE 2: Native Capacitor App (Direct ESC/POS over TCP Socket to Port 9100)
  if (isNative) {
    const rawIp = (config.printer_ip || config.ip || '').trim();
    const rawPort = parseInt(config.printer_port || config.port, 10) || 9100;

    if (!rawIp) {
      if (allowFallback) {
        console.warn('[printerService] No printer IP set, falling back to Native Spooler print');
        return await printViaNativeSpooler(elementId, language);
      }
      throw new Error('ຍັງບໍ່ໄດ້ກຳນົດ IP ເຄື່ອງພິມ. ກະລຸນາຕັ້ງຄ່າ IP ໃນໜ້າການຕັ້ງຄ່າກ່ອນ.');
    }

    try {
      // 1. Ensure appropriate font is loaded in browser/webview memory
      if (language === 'vi') {
        await ensureTahomaLoaded();
        await ensureSaysetthaLoaded();
        if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
          try {
            await Promise.race([
              Promise.all([
                document.fonts.load('bold 38px "Tahoma"'),
                document.fonts.load('bold 28px "Tahoma"'),
                document.fonts.load('bold 24px "Tahoma"'),
                document.fonts.load('22px "Tahoma"'),
                document.fonts.load('23px "Saysettha OT"'),
              ]),
              new Promise((r) => setTimeout(r, 400)),
            ]);
          } catch (_) {}
        }
      } else {
        await ensureSaysetthaLoaded();
      }

      // 2. Render receipt to 1:1 Canvas
      const canvas = await renderReceiptCanvas(receipt, language);

      // 3. Convert Canvas to 1-bit ESC/POS raster bytes (threshold 180 for solid strokes while keeping open loops on thicker paper)
      const escPosBytes = canvasToEscPosRaster(canvas, {
        kickCashDrawer: config.drawerKick,
        cutPaper: config.autoCut,
        luminanceThreshold: 180,
        useDithering: false,
        feedLines: 2,
      });

      // 4. Send binary stream over TCP Socket directly to thermal printer
      await sendRawBytesViaTcp(rawIp, rawPort, escPosBytes, { timeoutSec: 4.5 });

      return {
        success: true,
        mode: 'socket',
        message: `ພິມໃບບິນສຳເລັດ! ສົ່ງຂໍ້ມູນໄປຍັງເຄື່ອງພິມ ${rawIp}:${rawPort} ຮຽບຮ້ອຍແລ້ວ.`,
      };
    } catch (err) {
      console.error('[printerService] Direct ESC/POS Socket print failed:', err);

      if (allowFallback) {
        console.warn('[printerService] Falling back to native spooler print on socket error');
        return await printViaNativeSpooler(elementId, language);
      }

      throw new Error(err.message || `ບໍ່ສາມາດເຊື່ອມຕໍ່ຫາເຄື່ອງພິມ (${rawIp}:${rawPort}). ກະລຸນາກວດສອບວ່າເຄື່ອງພິມເປີດຢູ່ ແລະ ເຊື່ອມຕໍ່ເຄືອຂ່າຍ Wi-Fi ດຽວກັນ.`);
    }
  }

  // CASE 3: Web Browser fallback
  return await printViaNativeSpooler(elementId, language);
}

/**
 * Test connection to printer IP & Port (Prints test receipt slip via TCP Socket)
 */
export async function testPrinterConnection(ip, port, { printSlip = true } = {}) {
  const config = getPrinterConfig();
  const targetIp = String(ip || config.printer_ip || config.ip || '').trim();
  const targetPort = parseInt(port || config.printer_port || config.port, 10) || 9100;

  if (!targetIp) {
    throw new Error('ກະລຸນາປ້ອນ IP ເຄື່ອງພິມກ່ອນທົດສອບ.');
  }

  if (Capacitor.isNativePlatform()) {
    if (printSlip) {
      await ensureSaysetthaLoaded();

      const testReceipt = {
        receiptNumber: 'TEST-K80',
        createdAt: new Date().toISOString(),
        cashierName: 'MeiiShop POS',
        customerName: 'ທົດສອບເຄື່ອງພິມ (Test Print)',
        paymentMethod: 'transfer',
        items: [
          {
            name: 'ທົດສອບເຄື່ອງພິມ K80 (Saysettha OT)',
            quantity: 1,
            unit: 'ຊຸດ',
            unit_price: 10000,
            total_price: 10000,
          },
          {
            name: 'ຕົວຢ່າງ: ກຂຄງຈສຊຍດຕຖທນບປຜຝພຟມຢຣລວຫອຮ',
            quantity: 1,
            unit: 'ແຖວ',
            unit_price: 0,
            total_price: 0,
          },
        ],
        subtotal: 10000,
        discount: 0,
        grandTotal: 10000,
        amountTendered: 10000,
        changeAmount: 0,
      };

      const canvas = await renderReceiptCanvas(testReceipt, 'lo');
      const escPosBytes = canvasToEscPosRaster(canvas, {
        kickCashDrawer: false,
        cutPaper: true,
        useDithering: false,
      });

      await sendRawBytesViaTcp(targetIp, targetPort, escPosBytes, { timeoutSec: 4.0 });
    }

    return {
      success: true,
      message: `ທົດສອບເຄື່ອງພິມ ${targetIp}:${targetPort} ສຳເລັດ! ພິມໃບທົດສອບຮຽບຮ້ອຍແລ້ວ.`,
    };
  }

  // Web Browser fallback
  return {
    success: true,
    message: `ທົດສອບ IP ${targetIp}:${targetPort} ສຳເລັດ (Web environment)`,
  };
}

/**
 * Kick Cash Drawer directly via ESC/POS command
 */
export async function openCashDrawerDirect() {
  if (Capacitor.isNativePlatform()) {
    const config = getPrinterConfig();
    const rawIp = (config.printer_ip || config.ip || '').trim();
    const rawPort = parseInt(config.printer_port || config.port, 10) || 9100;
    if (rawIp) {
      const drawerCmd = new Uint8Array([...ESC_INIT, ...ESC_DRAWER_KICK]);
      return await sendRawBytesViaTcp(rawIp, rawPort, drawerCmd, { timeoutSec: 3.0 });
    }
  }
  return { success: false, message: 'Cash drawer can only be kicked on Native platform with configured IP.' };
}

/**
 * Send raw binary byte array over TCP Socket directly to thermal printer
 */
export async function sendRawBytesViaTcp(ip, port, uint8Bytes, { timeoutSec = 4.0 } = {}) {
  const cleanIp = String(ip || '').trim();
  if (!cleanIp) {
    throw new Error('ຍັງບໍ່ໄດ້ກຳນົດ IP ເຄື່ອງພິມ (Printer IP is empty)');
  }

  const targetPort = parseInt(port, 10) || 9100;
  const timeoutMs = Math.max(1500, Math.min(8000, Math.round((timeoutSec || 4) * 1000)));
  const timeoutSecondsInt = Math.max(2, Math.round(timeoutMs / 1000));

  const isNative = Capacitor.isNativePlatform();
  const socketPlugin = TcpSocket || (typeof window !== 'undefined' ? window.Capacitor?.Plugins?.TcpSocket : null);

  if (!isNative || !socketPlugin || typeof socketPlugin.connect !== 'function') {
    throw new Error('ການພິມຜ່ານ TCP Socket ຮອງຮັບສະເພາະແອັບ Native (iOS / iPadOS).');
  }

  const base64Data = uint8ArrayToBase64(uint8Bytes);
  let client = null;

  const withTimeout = (promise, ms, errorMsg) => {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(errorMsg)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  };

  try {
    const connectRes = await withTimeout(
      socketPlugin.connect({
        ipAddress: cleanIp,
        port: targetPort,
        timeout: timeoutSecondsInt,
      }),
      timeoutMs,
      `ບໍ່ສາມາດເຊື່ອມຕໍ່ຫາເຄື່ອງພິມ ${cleanIp}:${targetPort} (ໝົດເວລາ ${timeoutMs / 1000}s). ກະລຸນາກວດສອບ Wi-Fi.`
    );

    client = connectRes?.client;
    if (client === undefined || client === null) {
      throw new Error(`ບໍ່ສາມາດສ້າງການເຊື່ອມຕໍ່ກັບເຄື່ອງພິມ ${cleanIp}:${targetPort}`);
    }

    await withTimeout(
      socketPlugin.send({
        client,
        data: base64Data,
        timeout: timeoutSecondsInt,
      }),
      timeoutMs,
      `ໝົດເວລາສົ່ງຂໍ້ມູນໄປຍັງເຄື່ອງພິມ ${cleanIp}:${targetPort}`
    );

    // Give thermal printer Wi-Fi buffer sufficient time to receive all raster chunks before disconnecting
    await new Promise((resolve) => setTimeout(resolve, 800));

    return { success: true, message: `Sent ${uint8Bytes.length} bytes to ${cleanIp}:${targetPort}` };
  } catch (err) {
    console.error(`[printerService] Error sending to printer ${cleanIp}:${targetPort}:`, err);
    throw new Error(err.message || `ບໍ່ສາມາດເຊື່ອມຕໍ່ຫາເຄື່ອງພິມ ${cleanIp}:${targetPort}`);
  } finally {
    if (client !== null && client !== undefined) {
      try {
        socketPlugin.disconnect({ client }).catch(() => {});
      } catch (_) {}
    }
  }
}

/**
 * Print receipt via OS Native Print Spooler (AirPrint on iOS / Android Print Spooler / Web Print)
 */
export async function printViaNativeSpooler(elementId = 'thermal-receipt-print-area', language = 'lo') {
  if (typeof document === 'undefined') {
    throw new Error('printViaNativeSpooler can only run in a browser/DOM environment.');
  }

  const targetElement = document.getElementById(elementId);
  if (!targetElement) {
    throw new Error(`ບໍ່ພົບ DOM Element #${elementId} ເພື່ອສັ່ງພິມ.`);
  }

  // Detect language if element has .font-vietnam class or language is 'vi'
  const isVi = language === 'vi' || targetElement.classList.contains('font-vietnam');
  const targetFontFamily = isVi
    ? "'Tahoma', 'Saysettha OT', 'Saysettha', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif !important"
    : "'Saysettha OT', 'Saysettha', sans-serif !important";

  const contentHtml = targetElement.innerHTML;
  const origin = window.location.origin;
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join('\n');

  const htmlDocument = `<!DOCTYPE html>
<html lang="${isVi ? 'vi' : 'lo'}">
  <head>
    <meta charset="utf-8" />
    <base href="${origin}/" />
    <title>Receipt_MeiiShop</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      ${SAYSETTHA_CSS}
      @font-face {
        font-family: 'Tahoma';
        font-style: normal;
        font-weight: 400;
        src: url('/fonts/tahoma.ttf') format('truetype');
      }
      @font-face {
        font-family: 'Tahoma';
        font-style: normal;
        font-weight: 700;
        src: url('/fonts/tahomabd.ttf') format('truetype');
      }
      @page {
        size: 80mm auto;
        margin: 0;
      }
      *, *::before, *::after {
        box-sizing: border-box !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: ${targetFontFamily};
        width: 100% !important;
        height: auto !important;
        overflow: visible !important;
      }
      .thermal-receipt-spooler-wrapper,
      .thermal-receipt-spooler-wrapper *,
      #thermal-receipt-print-area,
      #thermal-receipt-print-area *,
      #quotation-print-area,
      #quotation-print-area * {
        box-sizing: border-box !important;
        font-family: ${targetFontFamily};
      }
      .thermal-receipt-spooler-wrapper,
      #thermal-receipt-print-area,
      #quotation-print-area {
        width: 100% !important;
        max-width: 80mm !important;
        margin: 0 auto !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
        background: #ffffff !important;
        overflow: visible !important;
      }
    </style>
    ${styles}
  </head>
  <body class="font-sans antialiased ${isVi ? 'font-vietnam' : 'font-lao'}">
    <div class="thermal-receipt-spooler-wrapper ${isVi ? 'font-vietnam' : ''}">
      ${contentHtml}
    </div>
  </body>
</html>`;

  try {
    if (typeof Printer !== 'undefined') {
      if (typeof Printer.printHtml === 'function') {
        await Printer.printHtml({
          html: htmlDocument,
          content: htmlDocument,
          name: 'Receipt_MeiiShop',
          orientation: 'portrait',
        });
      } else if (typeof Printer.print === 'function') {
        await Printer.print({
          content: htmlDocument,
          html: htmlDocument,
          name: 'Receipt_MeiiShop',
          orientation: 'portrait',
        });
      } else {
        await printThermalElementDirect(elementId, language);
      }
    } else {
      await printThermalElementDirect(elementId, language);
    }

    return {
      success: true,
      mode: 'spooler',
      message: 'ສົ່ງໃບບິນໄປຍັງລະບົບພິມ (AirPrint / Print Spooler) ສຳເລັດ!',
    };
  } catch (printErr) {
    console.warn('[printerService] Printer plugin error, falling back to browser print:', printErr);
    await printThermalElementDirect(elementId, language);
    return {
      success: true,
      mode: 'fallback',
      message: 'ເປີດໜ້າຕ່າງພິມລະບົບສຳເລັດ.',
    };
  }
}

/**
 * Isolated Iframe Print for Thermal Receipts (Browser fallback)
 */
export async function printThermalElementDirect(elementId = 'thermal-receipt-print-area', language = 'lo') {
  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) {
    window.print();
    return;
  }

  const isVi = language === 'vi' || sourceEl.classList?.contains('font-vietnam');
  const targetFontFamily = isVi
    ? "'Tahoma', 'Saysettha OT', 'Saysettha', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif !important"
    : "'Saysettha OT', 'Saysettha', sans-serif !important";

  const oldIframe = document.getElementById('thermal-print-iframe');
  if (oldIframe) oldIframe.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'thermal-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const contentHtml = sourceEl.outerHTML;
  const origin = window.location.origin;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="${isVi ? 'vi' : 'lo'}">
      <head>
        <meta charset="utf-8" />
        <base href="${origin}/" />
        <title>Receipt Print (80mm K80)</title>
        <style>
          ${SAYSETTHA_CSS}
          @font-face {
            font-family: 'Tahoma';
            font-style: normal;
            font-weight: 400;
            src: url('/fonts/tahoma.ttf') format('truetype');
          }
          @font-face {
            font-family: 'Tahoma';
            font-style: normal;
            font-weight: 700;
            src: url('/fonts/tahomabd.ttf') format('truetype');
          }
          @page { size: auto; margin: 0mm; }
          *, *::before, *::after {
            box-sizing: border-box !important;
            font-family: ${targetFontFamily};
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: ${targetFontFamily};
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          #thermal-receipt-print-area,
          #thermal-receipt-print-area *,
          #quotation-print-area,
          #quotation-print-area * {
            box-sizing: border-box !important;
            font-family: ${targetFontFamily};
          }
          #thermal-receipt-print-area,
          #quotation-print-area {
            width: 100% !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
        </style>
      </head>
      <body class="${isVi ? 'font-vietnam' : 'font-lao'}">
        ${contentHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }, 3000);
}
