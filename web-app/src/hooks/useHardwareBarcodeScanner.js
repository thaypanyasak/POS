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
 * HEURISTICS & STABILITY:
 * 1. Adaptive Keystroke Timing: Physical barcode scanners transmit characters at rapid speeds (< 35ms between keys).
 *    During React DOM renders, toast animations, or Web Audio playback, the single-threaded JS event loop
 *    can hiccup by 50ms-90ms. Using maxInterval: 180ms prevents partial-buffer wipes mid-scan (e.g. dropping '8' or '89').
 * 2. Average Speed Validation: Fast average interval (< 100ms/key) differentiates superhuman scanner bursts
 *    from human typing without false-clearing.
 * 3. Safe Auto-Flush: Auto-flush fallback timer waits at least 250ms of silence, ensuring it NEVER cuts off
 *    an in-flight 13-digit barcode sequence.
 * 4. Input Conflict Handling:
 *    - data-barcode-replace="true": Instantly replaces entire input with the full clean barcode (History, Products).
 *    - data-barcode-clear="true": Clears input back to empty upon scan (POS product search).
 *    - Default: Reverts accidentally dumped characters from normal inputs (notes, customer info).
 * 5. Rapid Consecutive Scans: 300ms debounce protects against double-Enter bounce while allowing cashiers
 *    to rapidly scan the same item for +1, +2, +3 quantity in POS.
 */
export function useHardwareBarcodeScanner({
  onScan,
  enabled = true,
  maxInterval = 180, // Generous threshold to tolerate browser rendering pauses without dropping leading digits
  maxAvgInterval = 100, // Average interval across burst distinguishing scanners from human typing
  minLength = 3,
  preventDefaultOnEnter = true,
  cleanActiveInput = true,
  feedback = true,
  duplicateInterval = 300, // Allows consecutive scans of the same item (e.g. +1 qty) after 300ms
}) {
  const onScanRef = useRef(onScan);
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const keyTimestampsRef = useRef([]);
  const lastScannedBarcodeRef = useRef({ code: '', time: 0 });
  const inputSnapshotRef = useRef({ element: null, originalValue: '' });
  const flushTimerRef = useRef(null);

  // Keep latest onScan callback without re-registering the global window listener
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    /**
     * Revert or update active input element when a hardware scanner types into it
     */
    const cleanActiveInputElement = (scannedCode) => {
      try {
        const activeEl = document.activeElement;
        if (!activeEl) return;

        const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';
        if (!isInput) return;

        // Skip cleaning if the input explicitly marks itself as a raw barcode receiver
        if (activeEl.getAttribute('data-barcode-preserve') === 'true') {
          return;
        }

        const currentValue = activeEl.value || '';
        let cleanedValue = currentValue;

        if (activeEl.getAttribute('data-barcode-clear') === 'true') {
          // Explicitly clear input on barcode scan (e.g. POS product search bar)
          cleanedValue = '';
        } else if (activeEl.getAttribute('data-barcode-replace') === 'true') {
          // Replace entire input value with the full scanned code (History & Products search bar)
          cleanedValue = scannedCode;
        } else if (currentValue === scannedCode) {
          cleanedValue = '';
        } else if (currentValue.endsWith(scannedCode)) {
          cleanedValue = currentValue.slice(0, -scannedCode.length);
        } else if (
          inputSnapshotRef.current.element === activeEl &&
          inputSnapshotRef.current.originalValue !== undefined
        ) {
          cleanedValue = inputSnapshotRef.current.originalValue;
        }

        if (cleanedValue !== currentValue || activeEl.getAttribute('data-barcode-replace') === 'true' || activeEl.getAttribute('data-barcode-clear') === 'true') {
          const proto =
            activeEl instanceof HTMLTextAreaElement
              ? window.HTMLTextAreaElement.prototype
              : window.HTMLInputElement.prototype;
          const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

          if (descriptor && descriptor.set) {
            descriptor.set.call(activeEl, cleanedValue);
          } else {
            activeEl.value = cleanedValue;
          }

          activeEl.dispatchEvent(new Event('input', { bubbles: true }));
          activeEl.dispatchEvent(new Event('change', { bubbles: true }));
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

      if (currentBuffer.length >= minLength) {
        // Prevent default and stop propagation so Enter does not submit forms or trigger clicks
        if (e && preventDefaultOnEnter) {
          e.preventDefault();
          e.stopPropagation();
        }

        const now = Date.now();
        // Debounce duplicate reads of the exact same code (e.g. hardware double-enter bounce)
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

        // Clean active input if barcode characters were typed into it
        if (cleanActiveInput) {
          cleanActiveInputElement(currentBuffer);
        }

        // Trigger sound & haptic feedback
        triggerFeedback();

        // Reset buffer and timestamps
        bufferRef.current = '';
        keyTimestampsRef.current = [];
        inputSnapshotRef.current = { element: null, originalValue: '' };

        // Dispatch scan callback
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
      // Ignore modifier keys completely so they don't corrupt timing or reset the buffer
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

        // Buffer was too short for a barcode -> normal human Enter/Tab key press
        bufferRef.current = '';
        keyTimestampsRef.current = [];
        inputSnapshotRef.current = { element: null, originalValue: '' };
        return;
      }

      // 2. Inter-keystroke Timing & Buffer Accumulation
      // If time since last key exceeds maxInterval (> 180ms), start a fresh scan burst.
      if (delta > maxInterval) {
        bufferRef.current = '';
        keyTimestampsRef.current = [];

        // Snapshot current active element state at start of potential burst
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
        bufferRef.current += e.key;
        keyTimestampsRef.current.push(now);

        // 4. Safe Auto-flush timer for scanners configured WITHOUT Enter/CR suffix
        // Resets on each key and only fires after 250ms of silence, NEVER mid-scan!
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        if (bufferRef.current.length >= minLength) {
          const flushDelay = Math.max(maxInterval + 70, 250);
          flushTimerRef.current = setTimeout(() => {
            // Verify average speed if multiple characters were collected
            const timestamps = keyTimestampsRef.current;
            if (timestamps.length >= 2) {
              const totalDuration = timestamps[timestamps.length - 1] - timestamps[0];
              const avgInterval = totalDuration / (timestamps.length - 1);
              // Only auto-flush without Enter if speed resembles a hardware burst or has substantial length
              if (avgInterval <= maxAvgInterval || bufferRef.current.length >= 6) {
                processBarcode(bufferRef.current, null);
                return;
              }
            }
            // Otherwise discard buffer
            bufferRef.current = '';
            keyTimestampsRef.current = [];
          }, flushDelay);
        }
      } else if (['Escape', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        // Human interactive navigation/editing keys immediately reset the buffer
        bufferRef.current = '';
        keyTimestampsRef.current = [];
      }
    };

    // Use capture phase to intercept the scanner burst before forms / buttons
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
