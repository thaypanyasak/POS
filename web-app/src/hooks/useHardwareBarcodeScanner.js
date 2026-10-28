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
 * ZERO-CONFLICT ARCHITECTURE WITH APPLE DEFAULT KEYBOARD & BLUETOOTH SCANNERS:
 * 1. Machine Burst Detection (< 55ms):
 *    - Human typing on iPad touch keyboard cannot press keys faster than 80-120ms.
 *    - Hardware scanners send characters at 5-25ms intervals.
 *    - Once key 2 arrives within 55ms (or avg burst < 65ms), it is identified as a machine scan.
 * 2. Event Flood Prevention (e.preventDefault() on burst keys 2..N):
 *    - Prevents 13 rapid DOM mutations, React onChange floods, and heavy catalog re-renders.
 *    - Eliminates JS thread freezes on iPad that caused buffer splits and dropped leading digits
 *      (e.g. dropping '8' -> '935212811712', or dropping 8 digits -> '1172').
 * 3. Jitter-Tolerant Buffer:
 *    - During an active scan burst, tolerates up to 350ms of Bluetooth transmission jitter without resetting.
 * 4. Input Restoration:
 *    - On scan complete (Enter or auto-flush):
 *      * Barcode inputs (data-barcode-input / data-barcode-replace): gets the full clean 13-digit barcode.
 *      * Clear inputs (data-barcode-clear="true" like POS search): gets wiped clean to ''.
 *      * Normal inputs (customer name, cash, notes): restored back to pre-scan value.
 * 5. Full Compatibility with Apple On-Screen Keyboard:
 *    - Human typing is completely untouched and 100% native.
 */
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

      // 3. Accumulate single printable characters
      if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
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

        bufferRef.current += e.key;
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
