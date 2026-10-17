/// Centralized Enterprise Currency Conversion Utilities (Accounting Compliant)
/// Strict validation: Never fall back to hardcoded rates (e.g. 690, 700, 720).
/// If rate <= 0 or amount <= 0, return 0.
class CurrencyHelper {
  /// Converts Lao Kip (LAK) to Thai Baht (THB)
  /// Standard Commercial Half-Up Rounding.
  /// Strictly returns 0 if rate <= 0 or lakAmount <= 0.
  static int convertLakToThb(num lakAmount, num exchangeRate) {
    if (lakAmount <= 0 || exchangeRate <= 0) return 0;
    return (lakAmount / exchangeRate).round();
  }

  /// Converts Thai Baht (THB) to Lao Kip (LAK)
  /// Lao Kip is atomic integer currency with zero decimal places.
  /// Strictly returns 0 if rate <= 0 or thbAmount <= 0.
  static int convertThbToLak(num thbAmount, num exchangeRate) {
    if (thbAmount <= 0 || exchangeRate <= 0) return 0;
    return (thbAmount * exchangeRate).round();
  }
}
