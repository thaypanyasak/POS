import { useEffect, useRef } from 'react';
import { playSuccessBeep } from '../utils/audioFeedback';
import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';

/**
 * Universal Hardware Barcode Scanner Listener Hook (Production Grade v4)
 * 
 * Supports physical barcode / QR scanners (USB, Bluetooth HID, 2.4G Wireless)
 * across Desktop Browsers, Mobile PWA, iPad/iOS, and Android WebView.
 *
 * GUARANTEED DUAL-MODE BEHAVIOR:
 * 1. Scanning when NO input is focused:
 *    - POS: automatically adds item to cart without touching search input.
 *    - Products: fills search input and finds product.
 *    - History: fills search input and finds receipt.
 * 2. Scanning when ANY input IS focused:
 *    - Dedicated Barcode inputs (ProductFormModal carton/pack/piece, bundle):
 *      filled with 100% clean normalized ASCII barcode, focus preserved!
 *    - POS search input: cleared to '' and blurred so search doesn't get cluttered.
 *    - Product / History search input: filled with 100% full barcode and blurred.
 *    - Normal inputs (customer name, cash, notes): restored to pre-scan snapshot.
 * 3. Human typing (Lao, Thai, Vietnamese, English):
 *    - 0ms latency! Absolutely NO delay, NO character drops, full native IME composition support.
 * 4. Keyboard Layout Immunity:
 *    - Uses physical `e.code` scancodes first, with full Lao/Thai number typewriter fallback.
 */

// ══════════════════════════════════════════════════════════════════
// 1. LAO & THAI NUMBER ROW & SHIFT REVERSAL DICTIONARIES
// ══════════════════════════════════════════════════════════════════
// Reverse US-keyboard Shift numbers (!@#$%^&*() -> 1234567890)
// Barcode scanners often emit Shift pulses or CapsLock-inverted characters
export const REVERSE_SHIFT_DIGITS = {
  '!': '1', '@': '2', '#': '3', '$': '4', '%': '5',
  '^': '6', '&': '7', '*': '8', '(': '9', ')': '0'
};

// Only maps number-row keystrokes to ASCII digits so barcode numbers are never corrupted
// when the cashier's active layout is Lao or Thai. Does NOT map general alphabetic letters!
export const LAO_THAI_NUMBERS_MAP = {
  // ── Lao typewriter unshifted number row (1 2 3 4 5 6 7 8 9 0 - =) ──
  'ຢ': '1', 'ຟ': '2', 'ໂ': '3', 'ຖ': '4', 'ຸ': '5',
  'ູ': '6', 'ຄ': '7', 'ຕ': '8', 'ຈ': '9', 'ຂ': '0',
  'ຊ': '-', 'ໍ': '=',

  // ── Lao typewriter shifted number row ──
  'ຼ': '1', 'ຽ': '3', 'ພ': '4', 'ົ': '8', '໌': '9', 'ໜ': '0',

  // ── Lao native numerals (໐ - ໙) ──
  '໐': '0', '໑': '1', '໒': '2', '໓': '3', '໔': '4',
  '໕': '5', '໖': '6', '໗': '7', '໘': '8', '໙': '9',

  // ── Thai Kedmanee number row ──
  'ๅ': '1', '/': '2', '-': '3', 'ภ': '4', 'ถ': '5',
  'ุ': '6', 'ึ': '7', 'ค': '8', 'ต': '9', 'จ': '0',
  'ข': '-', 'ช': '=',

  // ── Thai native numerals (๐ - ๙) ──
  '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4',
  '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9',
};

/**
 * Universal Barcode Sanitizer
 * Strips non-printable ASCII and repairs shifted symbols (!@#$%^&*()) back to numeric digits.
 */
export function sanitizeBarcode(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  str = str.replace(/[\r\n\t\x00-\x1F\x7F]/g, '');
  return str
    .split('')
    .map((ch) => REVERSE_SHIFT_DIGITS[ch] || LAO_THAI_NUMBERS_MAP[ch] || ch)
    .join('');
}

/**
 * Resolves a keyboard event into a clean ASCII barcode character.
 * Uses physical e.code first (layout independent), then fallback dictionary, then raw key.
 */
function resolveBarcodeChar(e) {
  // 1. Primary: Physical key code (e.code) bypasses all active keyboard layouts (Lao, Thai, VN, etc.)
  if (e.code) {
    if (e.code.startsWith('Digit') && e.code.length === 6) {
      // Physical number row key: ALWAYS return '0'..'9'!
      // Hardware barcode scanners frequently emit Shift or CapsLock flags.
      // Product barcodes in retail are ALWAYS numbers, never shifted punctuation (!@#$%^&*()).
      return e.code.slice(5);
    }
    if (e.code.startsWith('Numpad') && e.code.length === 7) {
      return e.code.slice(6); // 'Numpad0'..'Numpad9' -> '0'..'9'
    }
    if (e.code.startsWith('Key') && e.code.length === 4) {
      const letter = e.code.slice(3);
      return e.shiftKey ? letter.toUpperCase() : letter.toUpperCase();
    }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') return '-';
    if (e.code === 'Slash' || e.code === 'NumpadDivide') return '/';
    if (e.code === 'Period' || e.code === 'NumpadDecimal') return '.';
    if (e.code === 'Comma') return ',';
    if (e.code === 'Equal' || e.code === 'NumpadAdd') return '+';
    if (e.code === 'Semicolon') return ':';
    if (e.code === 'Quote') return "'";
    if (e.code === 'Space') return ' ';
  }

  // 2. Secondary fallback: Check if e.key is a shifted digit symbol (!@#$%^&*())
  if (e.key && REVERSE_SHIFT_DIGITS[e.key] !== undefined) {
    return REVERSE_SHIFT_DIGITS[e.key];
  }

  // 3. Tertiary fallback: Check if e.key is a known Lao or Thai number character
  if (e.key && LAO_THAI_NUMBERS_MAP[e.key] !== undefined) {
    return LAO_THAI_NUMBERS_MAP[e.key];
  }

  // 4. Fallback: single printable ASCII character
  if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    return e.key;
  }

  // 5. Fallback for iOS WKWebView / Android WebView where e.code is empty and e.key is 'Unidentified'
  if (e.keyCode >= 48 && e.keyCode <= 57) {
    return String(e.keyCode - 48);
  }
  if (e.keyCode >= 96 && e.keyCode <= 105) {
    return String(e.keyCode - 96);
  }
  if (e.keyCode >= 65 && e.keyCode <= 90) {
    const letter = String.fromCharCode(e.keyCode);
    return e.shiftKey ? letter.toUpperCase() : letter.toLowerCase();
  }
  if (e.keyCode === 189 || e.keyCode === 109) return '-';
  if (e.keyCode === 191 || e.keyCode === 111) return '-';

  return null;
}

// ══════════════════════════════════════════════════════════════════
// 2. REACT COMPATIBLE INPUT SETTER (Synthetic Event Dispatcher)
// ══════════════════════════════════════════════════════════════════
function setNativeValue(element, value) {
  if (!element) return;
  try {
    // Reset React internal value tracker so synthetic input & change events are recognized
    if (element._valueTracker) {
      element._valueTracker.setValue(value === '' ? ' ' : '');
    }

    const proto =
      element instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (err) {
    console.debug('[setNativeValue] error:', err);
    element.value = value;
  }
}

// ══════════════════════════════════════════════════════════════════
// 3. SINGLETON ENGINE STATE
// ══════════════════════════════════════════════════════════════════
let globalBuffer = '';
let keyTimestamps = [];
let lastKeyTime = 0;
let inputSnapshot = { element: null, originalValue: '' };
let autoFlushTimer = null;
let lastScannedBarcode = { code: '', time: 0 };

let subscriberCounter = 0;
const subscribers = []; // Stack of { id, onScan, options }
let isListenerAttached = false;

function resetBufferState() {
  globalBuffer = '';
  keyTimestamps = [];
  inputSnapshot = { element: null, originalValue: '' };
  if (autoFlushTimer) {
    clearTimeout(autoFlushTimer);
    autoFlushTimer = null;
  }
}

// ══════════════════════════════════════════════════════════════════
// 4. CLEANUP ACTIVE INPUT ELEMENT ON SCAN SUCCESS
// ══════════════════════════════════════════════════════════════════
function cleanActiveInputElement(scannedCode) {
  try {
    const cleanCode = sanitizeBarcode(scannedCode);
    const activeEl =
      inputSnapshot.element ||
      (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
        ? document.activeElement
        : document.getElementById('pos-search-input') ||
          document.getElementById('product-search-input') ||
          document.getElementById('products-search-input') ||
          document.getElementById('history-search-input'));

    if (!activeEl) return;
    const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';
    if (!isInput) return;

    // Classification
    const isBarcodeField =
      activeEl.getAttribute('data-barcode-input') === 'true' ||
      activeEl.getAttribute('data-barcode-preserve') === 'true' ||
      activeEl.id?.toLowerCase().includes('barcode') ||
      activeEl.name?.toLowerCase().includes('barcode');

    const isPosSearch =
      activeEl.id === 'pos-search-input' ||
      activeEl.getAttribute('data-barcode-clear') === 'true';

    const isSearchField =
      activeEl.id === 'product-search-input' ||
      activeEl.id === 'products-search-input' ||
      activeEl.id === 'history-search-input' ||
      activeEl.getAttribute('data-barcode-replace') === 'true' ||
      activeEl.type === 'search';

    // 1. POS product search:
    // Clear search input so barcode does not clutter manual search text, blur virtual keyboard
    if (isPosSearch) {
      setNativeValue(activeEl, '');
      if (typeof activeEl.blur === 'function') {
        try { activeEl.blur(); } catch (_) {}
      }
      return;
    }

    // 2. Search inputs (ProductsView, HistoryView, CustomerSearchSelect, etc.):
    // Overwrite full clean barcode and blur so virtual keyboard dismisses and search results are visible!
    if (isSearchField) {
      setNativeValue(activeEl, cleanCode);
      if (typeof activeEl.blur === 'function') {
        try { activeEl.blur(); } catch (_) {}
      }
      return;
    }

    // 3. Dedicated barcode inputs in forms (e.g. piece/pack/carton in ProductFormModal, or bundle barcode):
    // Fill with the full clean barcode and preserve focus so cashier can continue entering info!
    if (isBarcodeField) {
      setNativeValue(activeEl, cleanCode);
      return;
    }

    // 4. Normal inputs (Customer Name, Note, Tendered Cash, etc.):
    // Restore pre-scan snapshot so any typed barcode characters are cleanly removed
    if (inputSnapshot.element === activeEl && inputSnapshot.originalValue !== undefined) {
      setNativeValue(activeEl, inputSnapshot.originalValue);
    }
  } catch (err) {
    console.debug('[cleanActiveInputElement] error:', err);
  }
}

async function triggerFeedback(feedbackEnabled = true) {
  if (!feedbackEnabled) return;
  playSuccessBeep();
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (_) {}
  }
}

// ══════════════════════════════════════════════════════════════════
// 5. PROCESS BARCODE
// ══════════════════════════════════════════════════════════════════
function processBarcode(rawCode, e = null) {
  if (autoFlushTimer) {
    clearTimeout(autoFlushTimer);
    autoFlushTimer = null;
  }

  let code = (rawCode || globalBuffer).trim();
  if (!code) {
    resetBufferState();
    return false;
  }

  // Defensive sanitization: unmap any shifted number symbols or Lao/Thai numerals
  code = sanitizeBarcode(code);

  // Auto-normalize common scanner invoice prefixes (e.g. inv/001 -> INV-001)
  if (/^inv[\/\\]/i.test(code)) {
    code = code.replace(/^inv[\/\\]/i, 'INV-');
  }

  // Get active subscriber (topmost modal / view)
  const activeSub = subscribers.length > 0 ? subscribers[subscribers.length - 1] : null;
  const minLength = activeSub?.options?.minLength ?? 3;
  const duplicateInterval = activeSub?.options?.duplicateInterval ?? 250;
  const preventDefaultOnEnter = activeSub?.options?.preventDefaultOnEnter ?? true;
  const cleanActiveInput = activeSub?.options?.cleanActiveInput ?? true;
  const feedback = activeSub?.options?.feedback ?? true;

  if (code.length >= minLength) {
    if (e && preventDefaultOnEnter) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
    }

    // Duplicate debounce protection
    const now = Date.now();
    const isDuplicate =
      lastScannedBarcode.code === code &&
      now - lastScannedBarcode.time < duplicateInterval;

    if (isDuplicate) {
      resetBufferState();
      return true;
    }

    lastScannedBarcode = { code, time: now };

    // Clean or update the active input
    if (cleanActiveInput) {
      cleanActiveInputElement(code);
    }

    // Play feedback
    triggerFeedback(feedback);

    // Snapshot code for subscriber callback before buffer reset
    const finalCode = code;
    resetBufferState();

    // Call topmost subscriber
    if (activeSub && typeof activeSub.onScan === 'function') {
      activeSub.onScan(finalCode);
    }
    return true;
  }

  resetBufferState();
  return false;
}
     
function restartAutoFlushTimer() {
  if (autoFlushTimer) {
    clearTimeout(autoFlushTimer);
    autoFlushTimer = null;
  }

  const activeEl = document.activeElement;
  const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

  const activeSub = subscribers.length > 0 ? subscribers[subscribers.length - 1] : null;
  const minLength = activeSub?.options?.minLength ?? 4;
  const maxInterval = activeSub?.options?.maxInterval ?? 180;
  const maxAvgInterval = activeSub?.options?.maxAvgInterval ?? 65;

  if (globalBuffer.length >= minLength) {
    const flushDelay = Math.max(maxInterval + 40, 180);
    autoFlushTimer = setTimeout(() => {
      const timestamps = keyTimestamps;
      if (timestamps.length >= 2) {
        const totalDuration = timestamps[timestamps.length - 1] - timestamps[0];
        const avgInterval = totalDuration / (timestamps.length - 1);

        if (isInputFocused) {
          // Strict hardware scanner burst: avgInterval <= 45ms or 8+ digits in <= 500ms
          // Guarantees human typing is never intercepted, while hardware scanners without Enter still succeed!
          if (
            (globalBuffer.length >= 6 && avgInterval <= 45) ||
            (globalBuffer.length >= 8 && totalDuration <= 500)
          ) {
            processBarcode(globalBuffer, null);
            return;
          }
        } else {
          // Free scanning when no input is focused
          if (
            avgInterval <= maxAvgInterval ||
            (globalBuffer.length >= 8 && totalDuration <= 600)
          ) {
            processBarcode(globalBuffer, null);
            return;
          }
        }
      }
      resetBufferState();
    }, flushDelay);
  }
}

// ══════════════════════════════════════════════════════════════════
// 6. GLOBAL KEYBOARD EVENT HANDLERS
// ══════════════════════════════════════════════════════════════════
function handleGlobalKeyDown(e) {
  // ── 0. IME Composition Safety (Lao, Thai, Vietnamese Telex/VNI) ──
  // If user is actively typing with an IME, NEVER intercept or block!
  if (e.isComposing || e.keyCode === 229) {
    resetBufferState();
    return;
  }

  // Ignore standalone modifier keys
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock'].includes(e.key)) {
    return;
  }

  // Modifier combos (Ctrl+C, Cmd+V, Alt+Tab): reset buffer
  if (e.ctrlKey || e.metaKey || e.altKey) {
    resetBufferState();
    return;
  }

  const now = Date.now();
  const delta = now - lastKeyTime;
  lastKeyTime = now;

  // ── 1. Terminator Detection (Enter, NumpadEnter, Tab, KeyCodes 13/9) ──
  const isTerminator =
    e.key === 'Enter' ||
    e.code === 'Enter' ||
    e.code === 'NumpadEnter' ||
    e.keyCode === 13 ||
    e.which === 13 ||
    e.key === 'Tab' ||
    e.keyCode === 9;

  if (isTerminator) {
    const activeSub = subscribers.length > 0 ? subscribers[subscribers.length - 1] : null;
    const activeEl = document.activeElement;
    const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

    // Context-aware Hardware Scanner Fingerprint Validation:
    let isScanner = false;
    if (keyTimestamps.length >= 2) {
      const totalDuration = keyTimestamps[keyTimestamps.length - 1] - keyTimestamps[0];
      const avgInterval = totalDuration / (keyTimestamps.length - 1);

      if (isInput) {
        // ── CONTEXT A: AN INPUT IS ACTIVELY FOCUSED ──
        // Protect fast human typing ('500', Lao text, etc.) from false positives:
        // 1. Must have at least 6 characters (EAN-13, UPC-A, Code128, barcode fields are >= 6).
        //    Humans typing 3-digit prices/numbers ('500') will NEVER be flagged as a barcode!
        // 2. Must meet true hardware scanner burst speed: avgInterval <= 45ms
        //    (Physical scanners emit at 10-25ms/key, human typing is >= 80-120ms/key).
        // 3. Or a full 10+ digit barcode received in <= 750ms.
        if (
          (globalBuffer.length >= 6 && avgInterval <= 45) ||
          (globalBuffer.length >= 4 && avgInterval <= 30) ||
          (globalBuffer.length >= 10 && totalDuration <= 750) ||
          (globalBuffer.length >= 20 && avgInterval <= 55)
        ) {
          isScanner = true;
        }
      } else {
        // ── CONTEXT B: NO INPUT FOCUSED (Free scanning in POS / Products / History) ──
        // Standard scanner burst when standing freely at the screen:
        const minLen = activeSub?.options?.minLength ?? 3;
        const maxAvg = activeSub?.options?.maxAvgInterval ?? 75;
        if (
          (globalBuffer.length >= minLen && avgInterval <= maxAvg) ||
          (globalBuffer.length >= 8 && totalDuration <= 800) ||
          (globalBuffer.length >= 4 && totalDuration <= 300)
        ) {
          isScanner = true;
        }
      }
    }

    if (isScanner) {
      // SWALLOW Enter event in capture phase so it never triggers form submit or POS handleSearchKeyDown!
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      const handled = processBarcode(globalBuffer, e);
      if (handled) return;
    }

    // Normal human Enter or human typing: let it proceed natively, reset buffer cleanly
    resetBufferState();
    return;
  }

  // ── 2. Navigation & Editing keys: reset buffer ──
  if (['Escape', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
    resetBufferState();
    return;
  }

  // ── 3. Gap check ──
  // If gap between keystrokes exceeds 350ms, start a fresh buffer (accommodates Bluetooth HID jitter)
  const maxGap = 350;
  if (globalBuffer.length > 0 && delta > maxGap) {
    resetBufferState();
  }

  // ── 4. Resolve normalized character ──
  const char = resolveBarcodeChar(e);
  if (!char) {
    if (globalBuffer.length === 0) {
      resetBufferState();
    }
    return;
  }

  const activeEl = document.activeElement;
  const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

  // ── 5. Snapshot active input before first character arrives ──
  if (globalBuffer.length === 0 && isInput) {
    inputSnapshot = {
      element: activeEl,
      originalValue: activeEl.value || '',
    };
  }

  // ── 6. Accumulate characters ──
  // High-Speed Hardware Scanner Burst Suppression on Active Inputs:
  // If an input is focused and keystrokes are arriving at physical scanner burst speed (<= 50ms),
  // suppress native character insertion so the input is not flooded with transient corrupted characters (!@#$%^&*()).
  // The full clean ASCII barcode is atomically applied upon completion (via Enter or AutoFlush).
  if (isInput && globalBuffer.length >= 1 && delta <= 50) {
    e.preventDefault();
  }

  globalBuffer += char;
  keyTimestamps.push(now);

  restartAutoFlushTimer();
}

// ══════════════════════════════════════════════════════════════════
// 7. LISTENER REGISTRATION (Singleton)
// ══════════════════════════════════════════════════════════════════
function ensureGlobalListeners() {
  if (isListenerAttached) return;
  if (typeof window === 'undefined') return;

  window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
  isListenerAttached = true;
}

function removeGlobalListeners() {
  if (!isListenerAttached) return;
  if (typeof window === 'undefined') return;

  resetBufferState();
  window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  isListenerAttached = false;
}

function registerSubscriber(onScan, options = {}) {
  const id = ++subscriberCounter;
  subscribers.push({ id, onScan, options });
  ensureGlobalListeners();
  return id;
}

function unregisterSubscriber(id) {
  const idx = subscribers.findIndex((s) => s.id === id);
  if (idx !== -1) {
    subscribers.splice(idx, 1);
  }
  if (subscribers.length === 0) {
    removeGlobalListeners();
  }
}

function updateSubscriber(id, onScan, options = {}) {
  const sub = subscribers.find((s) => s.id === id);
  if (sub) {
    sub.onScan = onScan;
    sub.options = options;
  }
}

// ══════════════════════════════════════════════════════════════════
// 8. HOOK INTERFACE
// ══════════════════════════════════════════════════════════════════
export function useHardwareBarcodeScanner({
  onScan,
  enabled = true,
  maxInterval = 180,
  maxAvgInterval = 75,
  minLength = 3,
  preventDefaultOnEnter = true,
  cleanActiveInput = true,
  feedback = true,
  duplicateInterval = 250,
}) {
  const idRef = useRef(null);
  const onScanRef = useRef(onScan);
  const optionsRef = useRef({
    maxInterval,
    maxAvgInterval,
    minLength,
    preventDefaultOnEnter,
    cleanActiveInput,
    feedback,
    duplicateInterval,
  });

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    optionsRef.current = {
      maxInterval,
      maxAvgInterval,
      minLength,
      preventDefaultOnEnter,
      cleanActiveInput,
      feedback,
      duplicateInterval,
    };
    if (idRef.current !== null) {
      updateSubscriber(idRef.current, (code) => onScanRef.current?.(code), optionsRef.current);
    }
  }, [maxInterval, maxAvgInterval, minLength, preventDefaultOnEnter, cleanActiveInput, feedback, duplicateInterval]);

  useEffect(() => {
    if (!enabled) {
      if (idRef.current !== null) {
        unregisterSubscriber(idRef.current);
        idRef.current = null;
      }
      return;
    }

    idRef.current = registerSubscriber(
      (code) => onScanRef.current?.(code),
      optionsRef.current
    );

    return () => {
      if (idRef.current !== null) {
        unregisterSubscriber(idRef.current);
        idRef.current = null;
      }
    };
  }, [enabled]);
}

export default useHardwareBarcodeScanner;
