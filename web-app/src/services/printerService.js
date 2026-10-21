import { Capacitor } from '@capacitor/core';
import { toCanvas } from 'html-to-image';
import { canvasToEscPosRaster, uint8ArrayToBase64, ESC_INIT, ESC_DRAWER_KICK } from './escposGenerator';
import { TcpSocket } from '@deedarb/capacitor-tcp-socket';

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
 * Helper to ensure TcpSocket is accessible
 */
function getTcpSocketPlugin() {
  return TcpSocket || null;
}

/**
 * Send raw binary byte array over TCP Socket directly to thermal printer
 * Enforces a strict JavaScript timeout (default 2.5s) to ensure UI never hangs if network/printer is unreachable
 */
export async function sendRawBytesViaTcp(ip, port, uint8Bytes, { timeoutSec = 2.5 } = {}) {
  const cleanIp = String(ip || '').trim();
  if (!cleanIp) {
    throw new Error('ຍັງບໍ່ໄດ້ກຳນົດ IP ເຄື່ອງພິມ (Printer IP is empty)');
  }

  const targetPort = parseInt(port, 10) || 9100;
  const timeoutMs = Math.max(1000, Math.min(3000, Math.round((timeoutSec || 2) * 1000)));
  const timeoutSecondsInt = Math.max(1, Math.round(timeoutMs / 1000));

  const socketPlugin = getTcpSocketPlugin();
  if (!socketPlugin) {
    throw new Error('Native TCP Socket plugin ບໍ່ພ້ອມໃຊ້ງານໃນອຸປະກອນນີ້ (Capacitor Native only)');
  }

  const base64Data = uint8ArrayToBase64(uint8Bytes);
  let client = null;

  // Strict Javascript timeout wrapper to prevent any native hanging
  const withTimeout = (promise, ms, errorMsg) => {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(errorMsg));
      }, ms);
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
      `ບໍ່ສາມາດເຊື່ອມຕໍ່ຫາເຄື່ອງພິມ ${cleanIp}:${targetPort} (ໝົດເວລາ ${timeoutMs / 1000}s). ກະລຸນາກວດສອບວ່າເຄື່ອງພິມເປີດຢູ່ ແລະ ຢູ່ Wi-Fi ດຽວກັນ.`
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
 * Render a high-resolution 576px Monochrome test receipt onto an HTML5 Canvas
 * Draws MeiiShop logo text, Lao typography, connection metrics, and alignment grid
 */
export function createTestReceiptCanvas(ip, port) {
  const canvas = document.createElement('canvas');
  canvas.width = 576; // Standard 80mm ESC/POS width
  canvas.height = 420;
  const ctx = canvas.getContext('2d');

  // Solid crisp white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // High-contrast black graphics & text
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';

  // Store Header
  ctx.font = 'bold 36px "Noto Sans Lao", Outfit, sans-serif';
  ctx.fillText('MEIISHOP POS', 288, 55);

  ctx.font = 'bold 24px "Noto Sans Lao", Outfit, sans-serif';
  ctx.fillText('ໃບທົດສອບເຄື່ອງພິມ (PRINTER TEST)', 288, 95);

  ctx.font = '18px "Noto Sans Lao", Outfit, sans-serif';
  ctx.fillText('EasyPrint ES-8803WA (TCP Socket 9100)', 288, 128);

  // Separator Line
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.moveTo(30, 145);
  ctx.lineTo(546, 145);
  ctx.stroke();

  // Test Details (Left / Right aligned)
  ctx.textAlign = 'left';
  ctx.font = '20px "Noto Sans Lao", Outfit, sans-serif';
  const now = new Date();
  const dateStr = now.toLocaleDateString('lo-LA') + ' ' + now.toLocaleTimeString();

  ctx.fillText(`ວັນທີ & ເວລາ: ${dateStr}`, 40, 185);
  ctx.fillText(`IP ເຄື່ອງພິມ: ${ip}:${port}`, 40, 220);
  ctx.fillText(`ລະບົບຕົວໜັງສື: Noto Sans Lao ພາສາລາວ 100%`, 40, 255);
  ctx.fillText(`ຄວາມກວ້າງເຈ້ຍ: 80mm (576 dots monochrome)`, 40, 290);
  ctx.fillText(`ສະຖານະ: ເຊື່ອມຕໍ່ສຳເລັດ • ພ້ອມໃຊ້ງານຂາຍ`, 40, 325);

  // Separator Line
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.moveTo(30, 345);
  ctx.lineTo(546, 345);
  ctx.stroke();

  // Footer
  ctx.textAlign = 'center';
  ctx.font = 'italic 18px "Noto Sans Lao", Outfit, sans-serif';
  ctx.fillText('ຂອບໃຈທີ່ເລືອກໃຊ້ລະບົບ MeiiShop Cloud POS', 288, 380);

  return canvas;
}

/**
 * Test connection to printer IP & Port (sends ESC @ initialization ping or full test print slip)
 */
export async function testPrinterConnection(ip, port, { printSlip = true } = {}) {
  const config = getPrinterConfig();
  const targetIp = (ip || config.ip || '').trim();
  const targetPort = parseInt(port || config.port, 10) || 9100;

  if (!targetIp) {
    throw new Error('ກະລຸນາປ້ອນ IP ເຄື່ອງພິມກ່ອນທົດສອບ.');
  }

  if (printSlip) {
    // Render 576px canvas with Lao text and convert to 1-bit monochrome raster
    const testCanvas = createTestReceiptCanvas(targetIp, targetPort);
    const escPosBytes = canvasToEscPosRaster(testCanvas, {
      kickCashDrawer: config.drawerKick,
      cutPaper: config.autoCut,
      luminanceThreshold: 185,
    });
    return await sendRawBytesViaTcp(targetIp, targetPort, escPosBytes, { timeoutSec: 2.5 });
  }

  const initCmd = new Uint8Array(ESC_INIT);
  return await sendRawBytesViaTcp(targetIp, targetPort, initCmd, { timeoutSec: 2.5 });
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
        <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Noto+Sans+Lao:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        ${styles}
        <style id="compiled-app-styles">
          ${compiledCss}
        </style>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Noto+Sans+Lao:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap');

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
                const timer = setTimeout(r, 1000);
                img.onload = () => { clearTimeout(timer); r(); };
                img.onerror = () => { clearTimeout(timer); r(); };
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
 *    - Sends directly via TCP Socket to `IP:Port` (Port 9100) with strict 3.5s timeout
 *    - If printer cannot be found or connection fails, immediately stops spinner and throws error!
 *
 * 2. Web Browser (Safari, Chrome) or Fallback:
 *    - Prints only receipt DOM in isolated single-page thermal iframe
 *
 * @param {Object} options
 * @param {string} [options.elementId='thermal-receipt-print-area'] DOM element ID of the receipt
 * @param {Object} [options.receipt] Receipt data object
 * @param {number} [options.paperWidth=80] Thermal paper width (80 or 58)
 * @param {boolean} [options.allowFallback=false] Fallback on socket error
 * @returns {Promise<{success: boolean, mode: 'socket'|'browser', message: string}>}
 */
export async function printReceiptSmart({
  elementId = 'thermal-receipt-print-area',
  receipt = null,
  paperWidth = 80,
  allowFallback = false,
} = {}) {
  const isNative = Capacitor.isNativePlatform();
  const config = getPrinterConfig();
  const activePaperWidth = paperWidth || config.paperWidth || 80;

  // CASE 1: Native Capacitor App (Thermal ESC/POS via TCP Socket)
  if (isNative) {
    const rawIp = (config.ip || '').trim();
    if (!rawIp) {
      throw new Error('ຍັງບໍ່ໄດ້ກຳນົດ IP ເຄື່ອງພິມ. ກະລຸນາໄປທີ່ໜ້າ "ຕັ້ງຄ່າ (Settings)" ເພື່ອກຳນົດ IP ເຄື່ອງພິມ.');
    }

    const targetElement = document.getElementById(elementId);
    if (!targetElement) {
      throw new Error(`ບໍ່ພົບ DOM Element #${elementId} ເພື່ອສັ່ງພິມ.`);
    }

    // Standard printer widths in dots: 80mm = 576 dots, 58mm = 384 dots
    const targetWidth = activePaperWidth === 58 ? 384 : 576;

    // Ensure all web fonts ('Be Vietnam Pro', 'Noto Sans Lao') are 100% loaded before rasterizing
    try {
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise((r) => setTimeout(r, 600))
        ]);
      }
    } catch (_) {}

    let canvasTimer;
    const canvasTimeoutPromise = new Promise((_, reject) => {
      canvasTimer = setTimeout(() => {
        reject(new Error('ໝົດເວລາ Render ຮູບໃບບິນ (Canvas Timeout)'));
      }, 2500);
    });

    try {
      const canvasPromise = toCanvas(targetElement, {
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

      const canvas = await Promise.race([canvasPromise, canvasTimeoutPromise]).finally(() => {
        if (canvasTimer) clearTimeout(canvasTimer);
      });

      // Convert Canvas to ESC/POS Raster Bytes
      const escPosBytes = canvasToEscPosRaster(canvas, {
        kickCashDrawer: config.drawerKick,
        cutPaper: config.autoCut,
        luminanceThreshold: 185,
      });

      // Transmit directly to hardware thermal printer with strict 2.5s fail-fast timeout
      await sendRawBytesViaTcp(rawIp, config.port, escPosBytes, { timeoutSec: 2.5 });

      return {
        success: true,
        mode: 'socket',
        message: `ພິມໃບບິນສຳເລັດ! ສົ່ງຂໍ້ມູນໄປຍັງເຄື່ອງພິມ ${rawIp}:${config.port} ຮຽບຮ້ອຍແລ້ວ.`,
      };
    } catch (err) {
      console.error('[printerService] Direct native print failed:', err);

      if (allowFallback) {
        console.warn('[printerService] Falling back to isolated browser print');
        await printThermalElementDirect(elementId, activePaperWidth);
        return {
          success: true,
          mode: 'browser',
          message: `ບໍ່ສາມາດເຊື່ອມຕໍ່ ${rawIp}:${config.port}. ໄດ້ປ່ຽນໄປພິມຜ່ານລະບົບ Browser ແທນ. (${err.message})`,
          error: err.message,
        };
      }

      // DO NOT HANG: Throw clear error so UI stops spinner and displays error immediately!
      throw new Error(err.message || `ບໍ່ສາມາດເຊື່ອມຕໍ່ຫາເຄື່ອງພິມ (${rawIp}:${config.port || 9100}). ກະລຸນາກວດສອບວ່າເຄື່ອງພິມເປີດຢູ່ ແລະ ເຊື່ອມຕໍ່ເຄືອຂ່າຍ Wi-Fi ດຽວກັນ.`);
    }
  }

  // CASE 2: Web Browser (Safari, Chrome, etc.)
  await printThermalElementDirect(elementId, activePaperWidth);
  return {
    success: true,
    mode: 'browser',
    message: 'ເປີດໜ້າຕ່າງພິມຂອງລະບົບ (System Print Dialog) ສຳເລັດ.',
  };
}

export default {
  getPrinterConfig,
  savePrinterConfig,
  sendRawBytesViaTcp,
  testPrinterConnection,
  openCashDrawerDirect,
  printReceiptSmart,
  printThermalElementDirect,
  PRINTER_STORAGE_KEYS,
  DEFAULT_PRINTER_CONFIG,
};
