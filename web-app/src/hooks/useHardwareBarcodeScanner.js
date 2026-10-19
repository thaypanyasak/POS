import { useEffect, useRef } from 'react';

/**
 * Universal Hardware Barcode Scanner Listener Hook
 * 
 * Accurately detects physical barcode scanners (USB, OTG, Bluetooth HID Keyboard)
 * across Desktop Browsers, Mobile PWA, Capacitor, and WebViews without requiring
 * input focus or mouse clicks.
 *
 * HEURISTICS:
 * 1. High Keystroke Speed: Hardware scanners transmit characters at lightning speed (< 50ms between keys).
 *    If delta > maxInterval (default 50ms), it's treated as normal human typing and buffer resets immediately.
 * 2. Terminator Detection: Barcode scanners send an 'Enter' key at the end of the sequence.
 * 3. Min Length: Sequence must be at least minLength characters (default: 3) to be considered a barcode.
 * 4. Input Conflict Handling: Does not disturb normal user typing in forms. If a scanner dumps characters
 *    into an active input, the hook automatically reverts the typed barcode numbers from the field.
 *
 * @param {Object} options
 * @param {Function} options.onScan - Callback invoked when a valid barcode is scanned: (barcode: string) => void
 * @param {boolean} [options.enabled=true] - Toggle the listener on/off
 * @param {number} [options.maxInterval=50] - Max allowed time (ms) between consecutive keystrokes (default: 50ms)
 * @param {number} [options.minLength=3] - Minimum length of valid barcode (default: 3)
 * @param {boolean} [options.preventDefaultOnEnter=true] - Prevent default Enter key behavior on barcode scan
 * @param {boolean} [options.cleanActiveInput=true] - Clean active input if barcode was typed into it
 */
export function useHardwareBarcodeScanner({
  onScan,
  enabled = true,
  maxInterval = 50,
  minLength = 3,
  preventDefaultOnEnter = true,
  cleanActiveInput = true,
}) {
  const onScanRef = useRef(onScan);
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const inputSnapshotRef = useRef({ element: null, originalValue: '' });

  // Keep latest onScan callback without re-registering the global window listener
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    /**
     * Safely revert barcode characters accidentally typed into an active input/textarea
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
          // Trigger React synthetic event update by calling native value setter
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

          // Clean active input if barcode characters were typed into it
          if (cleanActiveInput) {
            cleanActiveInputElement(currentBuffer);
          }

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
      // If time between keystrokes exceeds threshold (> 50ms), it's human typing.
      // Reset the buffer immediately.
      if (delta > maxInterval) {
        bufferRef.current = '';

        // Snapshot current active element state at start of a potential burst
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
      // Exclude modifier keys (Control, Alt, Meta, Shift, Tab, Arrows, etc.)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        bufferRef.current += e.key;
      }
    };

    // Use capture phase to intercept the scanner burst before forms / buttons
    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
    };
  }, [enabled, maxInterval, minLength, preventDefaultOnEnter, cleanActiveInput]);
}

export default useHardwareBarcodeScanner;
