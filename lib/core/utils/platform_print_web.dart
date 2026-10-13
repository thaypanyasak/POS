import 'dart:js_interop';

@JS('printReceiptImage')
external void _printReceiptImage(JSString base64DataUri, JSNumber paperWidthMm);

@JS('window.print')
external void _windowPrint();

/// Triggers isolated receipt printing using hidden iframe on Flutter Web (prints ONLY the receipt slip)
void triggerPlatformPrintReceipt(String base64DataUri, {int paperWidthMm = 80}) {
  try {
    _printReceiptImage(base64DataUri.toJS, paperWidthMm.toJS);
  } catch (_) {
    _windowPrint();
  }
}

/// Fallback full page print
void triggerPlatformPrint() {
  try {
    _windowPrint();
  } catch (_) {}
}
