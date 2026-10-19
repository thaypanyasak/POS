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
 * Intelligent Smart Print Dispatcher
 *
 * 1. Native Platform (Capacitor iOS/Android) + Configured Printer IP:
 *    - Captures DOM element `#thermal-receipt-print-area` as a high-density 1-bit monochrome canvas
 *    - Generates ESC/POS raster byte stream (`GS v 0`)
 *    - Sends directly via TCP Socket to `IP:Port` (Port 9100)
 *    - Kicks drawer and cuts paper automatically without showing OS print dialog!
 *
 * 2. Web Browser (Safari, Chrome) or Fallback:
 *    - Calls standard `window.print()` using CSS `@media print`
 *
 * @param {Object} options
 * @param {string} [options.elementId='thermal-receipt-print-area'] DOM element ID of the receipt
 * @param {Object} [options.receipt] Receipt data object
 * @param {boolean} [options.allowFallback=true] Fallback to window.print() on socket error
 * @returns {Promise<{success: boolean, mode: 'socket'|'browser', message: string}>}
 */
export async function printReceiptSmart({
  elementId = 'thermal-receipt-print-area',
  receipt = null,
  allowFallback = true,
} = {}) {
  const isNative = Capacitor.isNativePlatform();
  const config = getPrinterConfig();

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
        console.warn('[printerService] Falling back to window.print()');
        window.print();
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
  window.print();
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
  PRINTER_STORAGE_KEYS,
  DEFAULT_PRINTER_CONFIG,
};
