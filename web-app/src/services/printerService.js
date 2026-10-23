import { Capacitor } from '@capacitor/core';
import { Printer } from '@capgo/capacitor-printer';
import { ThermalPrinter } from '../plugins/thermalPrinter';
import {
  getPrinterConfig,
  savePrinterConfig,
  fetchPrinterConfigFromDb,
  DEFAULT_PRINTER_CONFIG,
  PRINTER_STORAGE_KEY,
} from './printerConfigService';
import { ESC_INIT, ESC_DRAWER_KICK, uint8ArrayToBase64 } from './escposGenerator';
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
const PRINT_WIDTH_DOTS = 576; // 80mm K80 = 576 thermal dots

/**
 * Format any receipt object into the standardized JSON structure for ThermalPrinterPlugin
 */
export function formatReceiptForNative(receipt, language = 'lo') {
  if (!receipt) {
    return {
      storeName: 'ຮ້ານ MeiiShop',
      storeSlogan: language === 'vi' ? 'Bán buôn - Bán lẻ Hàng tiêu dùng' : 'ຂາຍຍົກ - ຂາຍຍ່ອຍ ສິນຄ້າອຸປະໂພກ ບໍລິໂພກ',
      storeAddress: 'ບ້ານ ໂພນສະຫວັນ, ນະຄອນປາກເຊ, ຈຳປາສັກ',
      storeTel: 'ໂທ: 020 5555 9999 / 021 214 555',
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
    const name = language === 'vi'
      ? (item.name_vi || item.nameVi || item.name || item.product_name_vi || item.productName || item.product_name || 'Sản phẩm')
      : (item.name || item.productName || item.product_name || item.name_vi || 'ສິນຄ້າ');

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
    storeName: 'ຮ້ານ MeiiShop',
    storeSlogan: language === 'vi' ? 'Bán buôn - Bán lẻ Hàng tiêu dùng' : 'ຂາຍຍົກ - ຂາຍຍ່ອຍ ສິນຄ້າອຸປະໂພກ ບໍລິໂພກ',
    storeAddress: 'ບ້ານ ໂພນສະຫວັນ, ນະຄອນປາກເຊ, ຈຳປາສັກ',
    storeTel: 'ໂທ: 020 5555 9999 / 021 214 555',
    cashierName: receipt.cashierName || 'Meii',
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
    language,
  };
}

/**
 * Intelligent Smart Print Dispatcher — Native CoreGraphics & ESC/POS Raw Socket
 */
export async function printReceiptSmart({
  elementId = 'thermal-receipt-print-area',
  receipt = null,
  language = 'lo',
  allowFallback = true,
  method = null,
} = {}) {
  const isNative = Capacitor.isNativePlatform();
  const config = getPrinterConfig();
  const activeMethod = method || config.printMethod;

  // MODE 1: Print via OS Native Spooler (AirPrint / OS Dialog)
  if (activeMethod === 'spooler') {
    return await printViaNativeSpooler(elementId);
  }

  // MODE 2: Native Capacitor App (Apple CoreGraphics 100% Vector Typography + RAW TCP Socket)
  if (isNative) {
    const rawIp = (config.printer_ip || config.ip || '').trim();
    const rawPort = parseInt(config.printer_port || config.port, 10) || 9100;

    if (!rawIp) {
      if (allowFallback) {
        console.warn('[printerService] No printer IP set, falling back to Native Spooler print');
        return await printViaNativeSpooler(elementId);
      }
      throw new Error('ຍັງບໍ່ໄດ້ກຳນົດ IP ເຄື່ອງພິມ. ກະລຸນາຕັ້ງຄ່າ IP ໃນໜ້າການຕັ້ງຄ່າກ່ອນ.');
    }

    try {
      // 1. Format structured data
      const receiptPayload = formatReceiptForNative(receipt, language);

      // 2. Execute Apple CoreGraphics & NWConnection Socket Native Plugin
      const res = await ThermalPrinter.printReceipt({
        ip: rawIp,
        port: rawPort,
        data: receiptPayload,
      });

      return {
        success: true,
        mode: 'socket',
        message: res?.message || `ພິມໃບບິນສຳເລັດ! ສົ່ງຂໍ້ມູນໄປຍັງເຄື່ອງພິມ ${rawIp}:${rawPort} ຮຽບຮ້ອຍແລ້ວ.`,
      };
    } catch (err) {
      console.error('[printerService] Native CoreGraphics ESC/POS print failed:', err);

      if (allowFallback) {
        console.warn('[printerService] Falling back to native spooler print on socket error');
        return await printViaNativeSpooler(elementId);
      }

      throw new Error(err.message || `ບໍ່ສາມາດເຊື່ອມຕໍ່ຫາເຄື່ອງພິມ (${rawIp}:${rawPort}). ກະລຸນາກວດສອບວ່າເຄື່ອງພິມເປີດຢູ່ ແລະ ເຊື່ອມຕໍ່ເຄືອຂ່າຍ Wi-Fi ດຽວກັນ.`);
    }
  }

  // CASE 3: Web Browser fallback
  return await printViaNativeSpooler(elementId);
}

/**
 * Test connection to printer IP & Port (Calls native CoreGraphics test print)
 */
export async function testPrinterConnection(ip, port, { printSlip = true } = {}) {
  const config = getPrinterConfig();
  const targetIp = String(ip || config.printer_ip || config.ip || '').trim();
  const targetPort = parseInt(port || config.printer_port || config.port, 10) || 9100;

  if (!targetIp) {
    throw new Error('ກະລຸນາປ້ອນ IP ເຄື່ອງພິມກ່ອນທົດສອບ.');
  }

  if (Capacitor.isNativePlatform()) {
    return await ThermalPrinter.testPrint({ ip: targetIp, port: targetPort });
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
      return await sendRawBytesViaTcp(rawIp, rawPort, drawerCmd, { timeoutSec: 2.5 });
    }
  }
  return { success: false, message: 'Cash drawer can only be kicked on Native platform with configured IP.' };
}

/**
 * Send raw binary byte array over TCP Socket directly to thermal printer
 */
export async function sendRawBytesViaTcp(ip, port, uint8Bytes, { timeoutSec = 2.5 } = {}) {
  const cleanIp = String(ip || '').trim();
  if (!cleanIp) {
    throw new Error('ຍັງບໍ່ໄດ້ກຳນົດ IP ເຄື່ອງພິມ (Printer IP is empty)');
  }

  const targetPort = parseInt(port, 10) || 9100;
  const timeoutMs = Math.max(1000, Math.min(3000, Math.round((timeoutSec || 2) * 1000)));
  const timeoutSecondsInt = Math.max(1, Math.round(timeoutMs / 1000));

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
export async function printViaNativeSpooler(elementId = 'thermal-receipt-print-area') {
  if (typeof document === 'undefined') {
    throw new Error('printViaNativeSpooler can only run in a browser/DOM environment.');
  }

  const targetElement = document.getElementById(elementId);
  if (!targetElement) {
    throw new Error(`ບໍ່ພົບ DOM Element #${elementId} ເພື່ອສັ່ງພິມ.`);
  }

  const contentHtml = targetElement.innerHTML;
  const origin = window.location.origin;
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join('\n');

  const htmlDocument = `<!DOCTYPE html>
<html lang="lo">
  <head>
    <meta charset="utf-8" />
    <base href="${origin}/" />
    <title>Receipt_MeiiShop</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Noto+Sans+Lao:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=Phetsarath:wght@400;700&display=swap" rel="stylesheet">
    ${styles}
    <style>
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
        width: 100% !important;
        height: auto !important;
        overflow: visible !important;
      }
      .thermal-receipt-spooler-wrapper,
      #thermal-receipt-print-area,
      #quotation-print-area {
        width: 72mm !important;
        max-width: 72mm !important;
        min-width: 72mm !important;
        margin: 0 auto !important;
        padding: 0 4px !important;
        box-sizing: border-box !important;
        box-shadow: none !important;
        border: none !important;
        background: #ffffff !important;
        overflow: visible !important;
      }
    </style>
  </head>
  <body class="font-sans antialiased">
    <div class="thermal-receipt-spooler-wrapper">
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
        await printThermalElementDirect(elementId);
      }
    } else {
      await printThermalElementDirect(elementId);
    }

    return {
      success: true,
      mode: 'spooler',
      message: 'ສົ່ງໃບບິນໄປຍັງລະບົບພິມ (AirPrint / Print Spooler) ສຳເລັດ!',
    };
  } catch (printErr) {
    console.warn('[printerService] Printer plugin error, falling back to browser print:', printErr);
    await printThermalElementDirect(elementId);
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
export async function printThermalElementDirect(elementId = 'thermal-receipt-print-area') {
  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) {
    window.print();
    return;
  }

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
    <html lang="lo">
      <head>
        <meta charset="utf-8" />
        <base href="${origin}/" />
        <title>Receipt Print (80mm K80)</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Noto+Sans+Lao:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=Phetsarath:wght@400;700&display=swap" rel="stylesheet">
        <style>
          @page { size: auto; margin: 0mm; }
          *, *::before, *::after { box-sizing: border-box !important; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
          }
          #thermal-receipt-print-area, #quotation-print-area {
            display: block !important;
            width: 380px !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 12px 14px !important;
          }
        </style>
      </head>
      <body class="font-sans antialiased">
        ${contentHtml}
      </body>
    </html>
  `);
  doc.close();

  return new Promise((resolve) => {
    const doPrint = async () => {
      try {
        if (doc.fonts) await doc.fonts.ready;
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        window.print();
      } finally {
        resolve();
      }
    };
    if (iframe.contentWindow) {
      setTimeout(doPrint, 100);
    } else {
      iframe.onload = doPrint;
    }
  });
}

export default {
  getPrinterConfig,
  savePrinterConfig,
  fetchPrinterConfigFromDb,
  sendRawBytesViaTcp,
  testPrinterConnection,
  openCashDrawerDirect,
  printReceiptSmart,
  printViaNativeSpooler,
  printThermalElementDirect,
  formatReceiptForNative,
  DEFAULT_PRINTER_CONFIG,
};
