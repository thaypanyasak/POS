import { useEffect, useRef } from 'react';
import { playSuccessBeep } from '../utils/audioFeedback';
import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';

/**
 * Universal Hardware Barcode Scanner Listener Hook
 * 
 * Accurately detects physical barcode scanners (USB, OTG, Bluetooth HID Keyboard, 2.4G Wireless)
 * across Desktop Browsers, Mobile PWA, iPad/iOS, and Android without requiring input focus or clicks.
 *
 * HEURISTICS:
 * 1. High Keystroke Speed: Scanners burst characters at superhuman speeds (< 30ms between keys).
 *    If delta > maxInterval (default 35ms), it's treated as normal human typing and buffer resets immediately.
 * 2. Terminator Detection: Barcode scanners finish their burst with an 'Enter' key.
 * 3. Min Length: Sequence must be at least minLength characters (default: 3).
 * 4. Input Conflict Handling: If a scanner types into an active input field, automatically reverts the
 *    typed numbers from that input to prevent polluting forms.
 * 5. Audio & Haptic Feedback: Triggers POS beep and haptic feedback immediately upon recognition.
 * 6. Debounce Protection: Prevents duplicate reads of the exact same barcode within 800ms.
 */
export function useHardwareBarcodeScanner({
  onScan,
  enabled = true,
  maxInterval = 30, // Strict threshold distinguishing scanner burst (<30ms between keys) from human typing
  minLength = 3,
  preventDefaultOnEnter = true,
  cleanActiveInput = true,
  feedback = true,
}) {
  const onScanRef = useRef(onScan);
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const lastScannedBarcodeRef = useRef({ code: '', time: 0 });
  const inputSnapshotRef = useRef({ element: null, originalValue: '' });

  // Keep latest onScan callback without re-registering the global window listener
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    /**
     * Revert barcode characters accidentally dumped into an active input element
     */
    const cleanActiveInputElement = (scannedCode) => {
      try {
        const activeEl = document.activeElement;
        if (!activeEl) return;

        const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';
        if (!isInput) return;

        // Skip cleaning if the input explicitly marks itself as a barcode receiver
        if (activeEl.getAttribute('data-barcode-preserve') === 'true') {
          return;
        }

        const currentValue = activeEl.value || '';
        let cleanedValue = currentValue;

        if (currentValue === scannedCode) {
          cleanedValue = '';
        } else if (currentValue.endsWith(scannedCode)) {
          cleanedValue = currentValue.slice(0, -scannedCode.length);
        } else if (
          inputSnapshotRef.current.element === activeEl &&
          inputSnapshotRef.current.originalValue !== undefined
        ) {
          cleanedValue = inputSnapshotRef.current.originalValue;
        }

        if (cleanedValue !== currentValue) {
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

    const handleGlobalKeyDown = (e) => {
      const now = Date.now();
      const delta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // 1. Check for scanner terminator (Enter key)
      if (e.key === 'Enter') {
        const currentBuffer = bufferRef.current.trim();

        // Valid Hardware Barcode detected!
        if (currentBuffer.length >= minLength) {
          if (preventDefaultOnEnter) {
            e.preventDefault();
            e.stopPropagation();
          }

          // Debounce duplicate reads of the exact same code within 800ms
          const isDuplicate =
            lastScannedBarcodeRef.current.code === currentBuffer &&
            now - lastScannedBarcodeRef.current.time < 800;

          if (isDuplicate) {
            bufferRef.current = '';
            inputSnapshotRef.current = { element: null, originalValue: '' };
            return;
          }

          lastScannedBarcodeRef.current = { code: currentBuffer, time: now };

          // Clean active input if barcode characters were typed into it
          if (cleanActiveInput) {
            cleanActiveInputElement(currentBuffer);
          }

          // Trigger sound & haptic feedback
          triggerFeedback();

          // Reset buffer
          bufferRef.current = '';
          inputSnapshotRef.current = { element: null, originalValue: '' };

          // Dispatch scan callback
          if (typeof onScanRef.current === 'function') {
            onScanRef.current(currentBuffer);
          }
          return;
        }

        // Normal human Enter key press -> reset buffer without interfering
        bufferRef.current = '';
        inputSnapshotRef.current = { element: null, originalValue: '' };
        return;
      }

      // 2. Inter-keystroke Speed Heuristic:
      // If time between keystrokes exceeds threshold (> 35ms), it's human typing.
      if (delta > maxInterval) {
        bufferRef.current = '';

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

      // 3. Accumulate printable characters only
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        bufferRef.current += e.key;
      }
    };

    // Use capture phase to intercept the scanner burst before forms / buttons
    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
    };
  }, [enabled, maxInterval, minLength, preventDefaultOnEnter, cleanActiveInput, feedback]);
}

export default useHardwareBarcodeScanner;
