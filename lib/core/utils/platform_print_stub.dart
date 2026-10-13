/// Platform print stub for non-web environments (mobile/desktop)
void triggerPlatformPrintReceipt(String base64DataUri, {int paperWidthMm = 80}) {
  // Handled via thermal printer socket on mobile/desktop
}

void triggerPlatformPrint() {
  // No-op on non-web platforms; ESC/POS network socket handles it
}
