import { Capacitor } from '@capacitor/core';
import { toCanvas } from 'html-to-image';
import { canvasToEscPosRaster, uint8ArrayToBase64, ESC_INIT, ESC_DRAWER_KICK } from './escposGenerator';

/**
 * Storage keys for POS printer configuration
 */
export const PRINTER_STORAGE_KEYS = {
  IP: 'pos_printer_ip',
  PORT: 'pos_printer_port',
  PAPER_WIDTH: 'pos_paper_width',
  AUTO_CUT: 'pos_printer_auto_cut',
  DRAWER_KICK: 'pos_printer_drawer_kick',
};

/**
 * Default printer configurations
 */
export const DEFAULT_PRINTER_CONFIG = {
  ip: '192.168.1.200',
  port: 9100,
  paperWidth: 80, // 80mm or 58mm
  autoCut: true,
  drawerKick: true,
};

/**
 * Read current printer settings from localStorage
 */
export function getPrinterConfig() {
  if (typeof window === 'undefined') return DEFAULT_PRINTER_CONFIG;
  return {
    ip: localStorage.getItem(PRINTER_STORAGE_KEYS.IP) || DEFAULT_PRINTER_CONFIG.ip,
    port: parseInt(localStorage.getItem(PRINTER_STORAGE_KEYS.PORT), 10) || DEFAULT_PRINTER_CONFIG.port,
    paperWidth: parseInt(localStorage.getItem(PRINTER_STORAGE_KEYS.PAPER_WIDTH), 10) || DEFAULT_PRINTER_CONFIG.paperWidth,
    autoCut: localStorage.getItem(PRINTER_STORAGE_KEYS.AUTO_CUT) !== 'false',
    drawerKick: localStorage.getItem(PRINTER_STORAGE_KEYS.DRAWER_KICK) !== 'false',
  };
}

/**
 * Save printer settings to localStorage
 */
export function savePrinterConfig(newConfig) {
  if (typeof window === 'undefined') return;
  if (newConfig.ip !== undefined) localStorage.setItem(PRINTER_STORAGE_KEYS.IP, String(newConfig.ip).trim());
  if (newConfig.port !== undefined) localStorage.setItem(PRINTER_STORAGE_KEYS.PORT, String(newConfig.port));
  if (newConfig.paperWidth !== undefined) localStorage.setItem(PRINTER_STORAGE_KEYS.PAPER_WIDTH, String(newConfig.paperWidth));
  if (newConfig.autoCut !== undefined) localStorage.setItem(PRINTER_STORAGE_KEYS.AUTO_CUT, String(newConfig.autoCut));
  if (newConfig.drawerKick !== undefined) localStorage.setItem(PRINTER_STORAGE_KEYS.DRAWER_KICK, String(newConfig.drawerKick));
}

/**
 * Lazily load Capacitor TcpSocket plugin if available on Native platform
 */
async function getTcpSocketPlugin() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const mod = await import('@deedarb/capacitor-tcp-socket');
    return mod.TcpSocket || null;
  } catch (err) {
    console.warn('[printerService] Could not import @deedarb/capacitor-tcp-socket:', err);
    return null;
  }
}

/**
 * Send raw binary byte array over TCP Socket directly to thermal printer
 */
export async function sendRawBytesViaTcp(ip, port, uint8Bytes, { timeoutSec = 5 } = {}) {
  const TcpSocket = await getTcpSocketPlugin();
  if (!TcpSocket) {
    throw new Error('Native TCP Socket plugin is not available on this platform.');
  }

  const base64Data = uint8ArrayToBase64(uint8Bytes);
  let client = null;

  try {
    const connectRes = await TcpSocket.connect({
      ipAddress: ip,
      port: port || 9100,
      timeout: timeoutSec,
    });

    client = connectRes.client;
    if (client === undefined || client === null) {
      throw new Error(`Failed to obtain client handle for printer socket ${ip}:${port}`);
    }

    await TcpSocket.send({
      client,
      data: base64Data,
      timeout: timeoutSec,
    });

    return { success: true, message: `Sent ${uint8Bytes.length} bytes to ${ip}:${port}` };
  } catch (err) {
    console.error(`[printerService] Error sending to printer ${ip}:${port}:`, err);
    throw err;
  } finally {
    if (client !== null && client !== undefined) {
      try {
        await TcpSocket.disconnect({ client });
      } catch (_) {}
    }
  }
}

/**
 * Kick Cash Drawer directly via ESC/POS command
 */
export async function openCashDrawerDirect() {
  if (Capacitor.isNativePlatform()) {
    const config = getPrinterConfig();
    if (config.ip) {
      const drawerCmd = new Uint8Array([...ESC_INIT, ...ESC_DRAWER_KICK]);
      return await sendRawBytesViaTcp(config.ip, config.port, drawerCmd, { timeoutSec: 3 });
    }
  }
  return { success: false, message: 'Cash drawer can only be kicked on Native platform with configured IP.' };
}

/**
 * Isolated Iframe Print for Thermal Receipts
 * Creates a dedicated hidden iframe containing ONLY the receipt HTML and fonts,
 * completely avoiding browser modal clipping, full-screen overflow, and multiple blank pages.
 */
export async function printThermalElementDirect(elementId = 'thermal-receipt-print-area', paperWidth = 80) {
  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) {
    window.print();
    return;
  }

  // Remove existing print iframe if any
  const oldIframe = document.getElementById('thermal-print-iframe');
  if (oldIframe) {
    oldIframe.remove();
  }

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

  // Clone source HTML
  const contentHtml = sourceEl.outerHTML;

  const is58 = Number(paperWidth) === 58;
  const targetWidthPx = is58 ? 280 : 380;
  const targetLabel = is58 ? '58mm' : '80mm';

  // Extract all compiled CSS rules from active document stylesheets (Tailwind utilities, flex, widths, etc.)
  let compiledCss = '';
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          for (const rule of Array.from(rules)) {
            compiledCss += rule.cssText + '\n';
          }
        }
      } catch (_) {
        // Cross-origin stylesheet access blocked
      }
    }
  } catch (_) {}

  // Collect active stylesheets from main document
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join('\n');

  const origin = window.location.origin;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="lo">
      <head>
        <meta charset="utf-8" />
        <base href="${origin}/" />
        <title>Receipt Print (${targetLabel})</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        ${styles}
        <style id="compiled-app-styles">
          ${compiledCss}
        </style>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap');

          @font-face {
            font-family: 'Noto Sans Lao';
            font-style: normal;
            font-weight: 400;
            font-display: swap;
            src: url('${origin}/fonts/NotoSansLao-Regular.ttf') format('truetype');
          }
          @font-face {
            font-family: 'Noto Sans Lao';
            font-style: normal;
            font-weight: 500;
            font-display: swap;
            src: url('${origin}/fonts/NotoSansLao-Medium.ttf') format('truetype');
          }
          @font-face {
            font-family: 'Noto Sans Lao';
            font-style: normal;
            font-weight: 600;
            font-display: swap;
            src: url('${origin}/fonts/NotoSansLao-SemiBold.ttf') format('truetype');
          }
          @font-face {
            font-family: 'Noto Sans Lao';
            font-style: normal;
            font-weight: 700;
            font-display: swap;
            src: url('${origin}/fonts/NotoSansLao-Bold.ttf') format('truetype');
          }

          @page {
            size: auto;
            margin: 0mm;
          }

          *, *::before, *::after {
            box-sizing: border-box !important;
            font-family: 'Noto Sans Lao', 'Outfit', sans-serif !important;
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Noto Sans Lao', 'Outfit', sans-serif !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          #thermal-receipt-print-area,
          #quotation-print-area {
            box-sizing: border-box !important;
            display: block !important;
            width: ${targetWidthPx}px !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 12px 14px !important;
            box-shadow: none !important;
            border: none !important;
            line-height: 1.4 !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: visible !important;
          }

          #thermal-receipt-print-area td,
          #thermal-receipt-print-area th,
          #thermal-receipt-print-area p,
          #thermal-receipt-print-area span,
          #thermal-receipt-print-area h2,
          #thermal-receipt-print-area div,
          #quotation-print-area td,
          #quotation-print-area th,
          #quotation-print-area p,
          #quotation-print-area span,
          #quotation-print-area h2,
          #quotation-print-area div {
            line-height: 1.4 !important;
            overflow: visible !important;
          }

          /* Ensure product rows and item names have balanced padding to prevent tone mark clipping without excessive gaps */
          .receipt-item-row,
          #thermal-receipt-print-area tr,
          #quotation-print-area tr {
            padding-top: 1.5px !important;
            padding-bottom: 1.5px !important;
            overflow: visible !important;
          }
          .product-name-row {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            overflow: visible !important;
          }

          #thermal-receipt-print-area > div,
          #quotation-print-area > div {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        </style>
      </head>
      <body class="font-sans antialiased">
        ${contentHtml}
      </body>
    </html>
  `);
  doc.close();

  // Wait for fonts and images to load completely before invoking print dialog
  return new Promise((resolve) => {
    const doPrint = async () => {
      try {
        if (doc.fonts) {
          await doc.fonts.ready;
        }
        if (document.fonts) {
          await document.fonts.ready;
        }

        const images = Array.from(doc.images || []);
        if (images.length > 0) {
          await Promise.all(
            images.map((img) => {
              if (img.complete) return Promise.resolve();
              return new Promise((r) => {
                img.onload = r;
                img.onerror = r;
              });
            })
          );
        }

        // Allow micro-tick for layout and font rendering
        await new Promise((r) => setTimeout(r, 200));

        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.warn('Iframe print error, falling back to window.print():', e);
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

/**
 * Intelligent Smart Print Dispatcher
 *
 * 1. Native Platform (Capacitor iOS/Android) + Configured Printer IP:
 *    - Captures DOM element `#thermal-receipt-print-area` as a high-density 1-bit monochrome canvas
 *    - Generates ESC/POS raster byte stream (`GS v 0`)
 *    - Sends directly via TCP Socket to `IP:Port` (Port 9100)
 *    - Kicks drawer and cuts paper automatically without showing OS print dialog!
 *
 * 2. Web Browser (Safari, Chrome) or Fallback:
 *    - Prints only receipt DOM in isolated single-page thermal iframe
 *
 * @param {Object} options
 * @param {string} [options.elementId='thermal-receipt-print-area'] DOM element ID of the receipt
 * @param {Object} [options.receipt] Receipt data object
 * @param {number} [options.paperWidth=80] Thermal paper width (80 or 58)
 * @param {boolean} [options.allowFallback=true] Fallback on socket error
 * @returns {Promise<{success: boolean, mode: 'socket'|'browser', message: string}>}
 */
export async function printReceiptSmart({
  elementId = 'thermal-receipt-print-area',
  receipt = null,
  paperWidth = 80,
  allowFallback = true,
} = {}) {
  const isNative = Capacitor.isNativePlatform();
  const config = getPrinterConfig();
  const activePaperWidth = paperWidth || config.paperWidth || 80;

  // CASE 1: Native Capacitor App with valid Printer IP configured
  if (isNative && config.ip) {
    try {
      const targetElement = document.getElementById(elementId);
      if (!targetElement) {
        throw new Error(`Receipt DOM element #${elementId} not found for rasterization.`);
      }

      // Standard printer widths in dots: 80mm = 576 dots, 58mm = 384 dots
      const targetWidth = config.paperWidth === 58 ? 384 : 576;

      // Render DOM element to high-contrast monochrome canvas
      const canvas = await toCanvas(targetElement, {
        width: targetWidth,
        pixelRatio: 1,
        backgroundColor: '#ffffff',
        style: {
          margin: '0',
          padding: '16px',
          width: `${targetWidth}px`,
          maxWidth: `${targetWidth}px`,
        },
      });

      // Convert Canvas to ESC/POS Raster Bytes
      const escPosBytes = canvasToEscPosRaster(canvas, {
        kickCashDrawer: config.drawerKick,
        cutPaper: config.autoCut,
        luminanceThreshold: 185,
      });

      // Transmit directly to hardware thermal printer
      await sendRawBytesViaTcp(config.ip, config.port, escPosBytes, { timeoutSec: 6 });

      return {
        success: true,
        mode: 'socket',
        message: `ພິມສຳເລັດ! ສົ່ງຂໍ້ມູນໄປຍັງເຄື່ອງພິມ ${config.ip}:${config.port} ແລ້ວ.`,
      };
    } catch (err) {
      console.error('[printerService] Direct native print failed:', err);

      if (allowFallback) {
        console.warn('[printerService] Falling back to isolated browser print');
        await printThermalElementDirect(elementId, activePaperWidth);
        return {
          success: true,
          mode: 'browser',
          message: `ບໍ່ສາມາດເຊື່ອມຕໍ່ ${config.ip}:${config.port}. ໄດ້ປ່ຽນໄປພິມຜ່ານລະບົບ Browser ແທນ. (${err.message})`,
          error: err.message,
        };
      } else {
        throw err;
      }
    }
  }

  // CASE 2: Web Browser (Safari, Chrome, etc.) or no IP configured
  await printThermalElementDirect(elementId, activePaperWidth);
  return {
    success: true,
    mode: 'browser',
    message: 'ເປີດໜ້າຕ່າງພິມຂອງລະບົບ (System Print Dialog).',
  };
}

export default {
  getPrinterConfig,
  savePrinterConfig,
  sendRawBytesViaTcp,
  openCashDrawerDirect,
  printReceiptSmart,
  printThermalElementDirect,
  PRINTER_STORAGE_KEYS,
  DEFAULT_PRINTER_CONFIG,
};
