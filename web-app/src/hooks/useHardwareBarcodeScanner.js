import { useEffect, useRef } from 'react';
import { playSuccessBeep } from '../utils/audioFeedback';
import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';

/**
 * Universal Hardware Barcode Scanner Listener Hook
 * 
 * Accurately detects physical barcode / QR scanners (USB, OTG, Bluetooth HID Keyboard, 2.4G Wireless)
 * across Desktop Browsers, Mobile PWA, iPad/iOS, and Android without requiring input focus or manual clicks.
 *
 * ZERO-CONFLICT ARCHITECTURE WITH APPLE DEFAULT KEYBOARD & MULTI-LANGUAGE LAYOUTS:
 * 1. Physical Scancode Normalization (Lao / Thai / Foreign Keyboard Immunity):
 *    - When the user leaves a Lao or Thai keyboard active, hardware scanners send keystrokes that
 *      iOS maps into Lao characters ('ຕ', 'ຈ', 'ໂ', 'ຸ', etc.) or Lao digits ('໑', '໒', '໓', etc.).
 *    - By reading `e.code` (e.g. 'Digit0'..'Digit9') and using a comprehensive Lao/Thai character map fallback,
 *      we normalize all barcode characters to standard Western digits '0'-'9' and ASCII.
 *    - Scans work 100% reliably EVEN IF THE CASHIER FORGOT TO SWITCH THE KEYBOARD OFF LAO!
 * 2. Machine Burst Detection (< 55ms):
 *    - Human typing on iPad touch keyboard cannot press keys faster than 80-120ms.
 *    - Hardware scanners send characters at 5-25ms intervals.
 *    - Once key 2 arrives within 55ms (or avg burst < 65ms), it is identified as a machine scan.
 * 3. Event Flood Prevention (e.preventDefault() on burst keys 2..N):
 *    - Prevents 13 rapid DOM mutations, React onChange floods, and heavy catalog re-renders.
 *    - Eliminates JS thread freezes on iPad that caused buffer splits and dropped leading digits.
 * 4. Jitter-Tolerant Buffer:
 *    - During an active scan burst, tolerates up to 350ms of Bluetooth transmission jitter without resetting.
 * 5. Input Restoration:
 *    - On scan complete (Enter or auto-flush):
 *      * Barcode inputs (data-barcode-input / data-barcode-replace): gets the full clean 13-digit barcode.
 *      * Clear inputs (data-barcode-clear="true" like POS search): gets wiped clean to ''.
 *      * Normal inputs (customer name, cash, notes): restored back to pre-scan value.
 * 6. Preserves First Responder:
 *    - Never calls native Keyboard.hide() or blur() that would drop WKWebView first responder.
 */

// Comprehensive fallback dictionary for Lao & Thai (Kedmanee) keyboard layouts (Digits, Symbols, and Full QWERTY letters A-Z)
const LAO_THAI_TO_ASCII_MAP = {
  // --- 1. Lao Typewriter Number Row ---
  'ຢ': '1', 'ຟ': '2', 'ໂ': '3', 'ຖ': '4', 'ຸ': '5',
  'ູ': '6', 'ຄ': '7', 'ຕ': '8', 'ຈ': '9', 'ຂ': '0',
  'ຊ': '-', 'ໍ': '=', 'ໆ': '`',
  'ຼ': '1', 'ຽ': '3', 'ພ': '4', 'ົ': '8', '໌': '9', 'ໜ': '0',

  // --- 2. Thai Kedmanee Number Row (Unshifted & Shifted) ---
  'ภ': '1', 'ถ': '2', 'ุ': '3', 'ึ': '4', 'ค': '5',
  'ต': '6', 'จ': '7', 'ข': '8', 'ช': '9', 'ๆ': '0',

  // --- 3. Lao Native Numerals ---
  '໐': '0', '໑': '1', '໒': '2', '໓': '3', '໔': '4',
  '໕': '5', '໖': '6', '໗': '7', '໘': '8', '໙': '9',

  // --- 4. Thai Native Numerals ---
  '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4',
  '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9',
  '฿': '6',

  // --- 5. Lao Letters (Q - P) ---
  'ົ': 'q', 'ໄ': 'w', 'ຳ': 'e', 'ພ': 'r', 'ະ': 't',
  'ິ': 'y', 'ີ': 'u', 'ຣ': 'i', 'ນ': 'o', 'ຍ': 'p',

  // --- 6. Thai Letters (Q - P) ---
  'ๆ': 'q', 'ไ': 'w', 'ำ': 'e', 'พ': 'r', 'ะ': 't',
  'ั': 'y', 'ี': 'u', 'ร': 'i', 'น': 'o', 'ย': 'p',
  'บ': '[', 'ล': ']', 'ฃ': '\\',

  // --- 7. Lao Letters (A - L) ---
  'ັ': 'a', 'ຫ': 's', 'ກ': 'd', 'ດ': 'f', 'ເ': 'g',
  '້': 'h', '່': 'j', 'າ': 'k', 'ສ': 'l', 'ວ': ';', 'ງ': "'",

  // --- 8. Thai Letters (A - L) ---
  'ฟ': 'a', 'ห': 's', 'ก': 'd', 'ด': 'f', 'เ': 'g',
  '้': 'h', '่': 'j', 'า': 'k', 'ส': 'l', 'ว': ';', 'ง': "'",

  // --- 9. Lao Letters (Z - M) ---
  'ຜ': 'z', 'ປ': 'x', 'ແ': 'c', 'ອ': 'v', 'ຶ': 'b',
  'ື': 'n', 'ທ': 'm', 'ມ': ',', 'ໃ': '.', 'ຝ': '/',

  // --- 10. Thai Letters (Z - M) ---
  'ผ': 'z', 'ป': 'x', 'แ': 'c', 'อ': 'v', 'ิ': 'b',
  'ื': 'n', 'ท': 'm', 'ม': ',', 'ใ': '.', 'ฝ': '/',
};

/**
 * Resolves physical keystroke into clean ASCII barcode character regardless of active keyboard language
 */
function getNormalizedBarcodeChar(e) {
  // 1. Primary: Use physical key code (e.code) to bypass all active keyboard layouts (Lao, Thai, VN, etc.)
  if (e.code) {
    if (e.code.startsWith('Digit') && e.code.length === 6) {
      return e.code.slice(5); // 'Digit0'..'Digit9' -> '0'..'9'
    }
    if (e.code.startsWith('Numpad') && e.code.length === 7) {
      return e.code.slice(6); // 'Numpad0'..'Numpad9' -> '0'..'9'
    }
    if (e.code.startsWith('Key') && e.code.length === 4) {
      const letter = e.code.slice(3);
      return e.shiftKey ? letter.toUpperCase() : letter.toLowerCase();
    }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') return '-';
    if (e.code === 'Slash' || e.code === 'NumpadDivide') return '/';
    if (e.code === 'Period' || e.code === 'NumpadDecimal') return '.';
  }

  // 2. Secondary fallback: Check if e.key is a known Lao or Thai character in the full mapping
  if (e.key && LAO_THAI_TO_ASCII_MAP[e.key]) {
    const mapped = LAO_THAI_TO_ASCII_MAP[e.key];
    return e.shiftKey ? mapped.toUpperCase() : mapped;
  }

  // 3. Fallback: single printable character as-is
  if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    return e.key;
  }

  return null;
}

export function useHardwareBarcodeScanner({
  onScan,
  enabled = true,
  maxInterval = 180,
  maxAvgInterval = 85,
  minLength = 3,
  preventDefaultOnEnter = true,
  cleanActiveInput = true,
  feedback = true,
  duplicateInterval = 300,
}) {
  const onScanRef = useRef(onScan);
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const keyTimestampsRef = useRef([]);
  const isMachineBurstRef = useRef(false);
  const lastScannedBarcodeRef = useRef({ code: '', time: 0 });
  const inputSnapshotRef = useRef({ element: null, originalValue: '' });
  const flushTimerRef = useRef(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const cleanActiveInputElement = (scannedCode) => {
      try {
        const activeEl = document.activeElement;
        if (!activeEl) return;

        const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';
        if (!isInput) return;

        const isBarcodeReceiver =
          activeEl.getAttribute('data-barcode-preserve') === 'true' ||
          activeEl.getAttribute('data-barcode-input') === 'true' ||
          activeEl.id?.toLowerCase().includes('barcode') ||
          activeEl.name?.toLowerCase().includes('barcode');

        const setValue = (val) => {
          const proto =
            activeEl instanceof HTMLTextAreaElement
              ? window.HTMLTextAreaElement.prototype
              : window.HTMLInputElement.prototype;
          const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

          if (descriptor && descriptor.set) {
            descriptor.set.call(activeEl, val);
          } else {
            activeEl.value = val;
          }

          activeEl.dispatchEvent(new Event('input', { bubbles: true }));
          activeEl.dispatchEvent(new Event('change', { bubbles: true }));
        };

        if (isBarcodeReceiver) {
          if (activeEl.value !== scannedCode) {
            setValue(scannedCode);
          }
          return;
        }

        if (activeEl.getAttribute('data-barcode-clear') === 'true') {
          setValue('');
          return;
        }

        if (activeEl.getAttribute('data-barcode-replace') === 'true') {
          setValue(scannedCode);
          return;
        }

        // Normal inputs (e.g. customer name, debt note, tendered money):
        // Restore pre-scan snapshot so accidental burst characters (like key 1) are removed
        if (
          inputSnapshotRef.current.element === activeEl &&
          inputSnapshotRef.current.originalValue !== undefined
        ) {
          setValue(inputSnapshotRef.current.originalValue);
        } else {
          const currentValue = activeEl.value || '';
          if (currentValue === scannedCode) {
            setValue('');
          } else if (currentValue.endsWith(scannedCode)) {
            setValue(currentValue.slice(0, -scannedCode.length));
          }
        }
      } catch (err) {
        console.debug('[useHardwareBarcodeScanner] Error cleaning active input:', err);
      }
    };

    const triggerFeedback = async () => {
      if (!feedback) return;
      playSuccessBeep();
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.notification({ type: NotificationType.Success });
        } catch (_) {}
      }
    };

    const processBarcode = (rawCode, e = null) => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      const currentBuffer = (rawCode || bufferRef.current).trim();
      isMachineBurstRef.current = false;

      if (currentBuffer.length >= minLength) {
        if (e && preventDefaultOnEnter) {
          e.preventDefault();
          e.stopPropagation();
        }

        const now = Date.now();
        const isDuplicate =
          lastScannedBarcodeRef.current.code === currentBuffer &&
          now - lastScannedBarcodeRef.current.time < duplicateInterval;

        if (isDuplicate) {
          bufferRef.current = '';
          keyTimestampsRef.current = [];
          inputSnapshotRef.current = { element: null, originalValue: '' };
          return true;
        }

        lastScannedBarcodeRef.current = { code: currentBuffer, time: now };

        if (cleanActiveInput) {
          cleanActiveInputElement(currentBuffer);
        }

        triggerFeedback();

        bufferRef.current = '';
        keyTimestampsRef.current = [];
        inputSnapshotRef.current = { element: null, originalValue: '' };

        if (typeof onScanRef.current === 'function') {
          onScanRef.current(currentBuffer);
        }
        return true;
      }

      bufferRef.current = '';
      keyTimestampsRef.current = [];
      inputSnapshotRef.current = { element: null, originalValue: '' };
      return false;
    };

    const handleGlobalKeyDown = (e) => {
      // Ignore modifier keys completely
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) {
        return;
      }

      const now = Date.now();
      const delta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // 1. Universal Terminator Detection (Enter, NumpadEnter, Tab, KeyCodes 13/9)
      const isTerminator =
        e.key === 'Enter' ||
        e.code === 'Enter' ||
        e.code === 'NumpadEnter' ||
        e.keyCode === 13 ||
        e.which === 13 ||
        e.key === 'Tab' ||
        e.keyCode === 9;

      if (isTerminator) {
        if (bufferRef.current.length >= minLength) {
          const handled = processBarcode(bufferRef.current, e);
          if (handled) return;
        }

        bufferRef.current = '';
        keyTimestampsRef.current = [];
        isMachineBurstRef.current = false;
        inputSnapshotRef.current = { element: null, originalValue: '' };
        return;
      }

      // 2. Burst Gap / Reset Detection:
      // If we are NOT in an active machine burst and delta > maxInterval: start a fresh buffer.
      // If we ARE in an active machine burst, allow generous jitter (up to 320ms) before declaring burst dead.
      const resetThreshold = isMachineBurstRef.current ? Math.max(maxInterval + 140, 320) : maxInterval;

      if (delta > resetThreshold) {
        bufferRef.current = '';
        keyTimestampsRef.current = [];
        isMachineBurstRef.current = false;

        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
          inputSnapshotRef.current = {
            element: activeEl,
            originalValue: activeEl.value || '',
          };
        } else {
          inputSnapshotRef.current = { element: null, originalValue: '' };
        }
      }

      // 3. Accumulate single printable characters with Lao / Thai scancode normalization
      const char = getNormalizedBarcodeChar(e);

      if (char) {
        // Burst detection:
        // Key 2 or later arriving at machine speed (delta <= 55ms)
        if (bufferRef.current.length >= 1 && delta <= 55) {
          isMachineBurstRef.current = true;
        }

        // If machine burst is active:
        // PREVENT DEFAULT so keys 2..N do not flood into the active input element!
        // This keeps the JS thread 100% free and prevents React re-rendering thrash on iPad.
        if (isMachineBurstRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }

        bufferRef.current += char;
        keyTimestampsRef.current.push(now);

        // 4. Safe Auto-flush timer for scanners configured without Enter suffix
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }

        if (bufferRef.current.length >= minLength) {
          const flushDelay = Math.max(maxInterval + 80, 260);
          flushTimerRef.current = setTimeout(() => {
            const timestamps = keyTimestampsRef.current;
            if (timestamps.length >= 2) {
              const totalDuration = timestamps[timestamps.length - 1] - timestamps[0];
              const avgInterval = totalDuration / (timestamps.length - 1);
              if (avgInterval <= maxAvgInterval || bufferRef.current.length >= 6) {
                processBarcode(bufferRef.current, null);
                return;
              }
            }
            bufferRef.current = '';
            keyTimestampsRef.current = [];
            isMachineBurstRef.current = false;
          }, flushDelay);
        }
      } else if (['Escape', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        bufferRef.current = '';
        keyTimestampsRef.current = [];
        isMachineBurstRef.current = false;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });

    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
    };
  }, [enabled, maxInterval, maxAvgInterval, minLength, preventDefaultOnEnter, cleanActiveInput, feedback, duplicateInterval]);
}

export default useHardwareBarcodeScanner;
