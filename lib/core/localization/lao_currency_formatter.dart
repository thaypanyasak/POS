import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

/// Lao Currency Formatter for Lao Kip (LAK / ₭)
///
/// Business Rules:
/// 1. NO DECIMALS: All values are whole numbers (integers).
/// 2. Dot Separator: Uses dots (`.`) as the thousands separator, e.g., `545.000 ₭`, `10.000 ₭`.
/// 3. Currency symbol: `₭` or `ກີບ`.
/// 4. Profit formatting:
///    - Gain (> 0): `+20.000 ₭` (Green)
///    - Loss (< 0): `-15.000 ₭` (Red, never `+-`)
///    - Break-even (== 0): `0 ₭` (Grey)
class LaoCurrencyFormatter {
  LaoCurrencyFormatter._();

  static final NumberFormat _dotNumberFormat = NumberFormat('#,###', 'de_DE');

  /// Symbol for Lao Kip
  static const String currencySymbol = '₭';
  static const String currencyWord = 'ກີບ';

  /// Standard Quick Cash increment presets in Lao Kip
  static const List<int> quickCashPresets = [
    10000,
    20000,
    50000,
    100000,
    500000,
  ];

  /// Standard Lao bank note denominations
  static const List<int> banknoteDenominations = [
    500000,
    100000,
    50000,
    20000,
    10000,
    5000,
    2000,
    1000,
    500,
  ];

  /// Formats an integer or num as dot-separated Lao Kip with symbol.
  /// Example: `545000` -> `545.000 ₭`
  /// Always truncates or rounds to whole integer; NEVER produces decimals.
  static String format(num amount, {bool includeSymbol = true, bool useWord = false}) {
    final int rounded = amount.round();
    final String formatted = _dotNumberFormat.format(rounded);
    if (!includeSymbol) {
      return formatted;
    }
    if (useWord) {
      return '$formatted $currencyWord';
    }
    return '$formatted $currencySymbol';
  }

  /// Formats an integer with a `+` prefix for quick cash buttons.
  /// Example: `50000` -> `+50.000 ₭`
  static String formatPreset(int presetAmount) {
    return '+${_dotNumberFormat.format(presetAmount)} $currencySymbol';
  }

  /// Formats profit/loss string with strict mathematical prefix:
  /// - Gain: `+20.000 ₭`
  /// - Loss: `-15.000 ₭`
  /// - Break-even: `0 ₭`
  static String formatProfit(int profit, {bool includeSymbol = true}) {
    if (profit > 0) {
      return '+${format(profit, includeSymbol: includeSymbol)}';
    } else if (profit < 0) {
      return '-${format(profit.abs(), includeSymbol: includeSymbol)}';
    }
    return format(0, includeSymbol: includeSymbol);
  }

  /// Parses a string into an integer Lao Kip amount.
  /// Strips currency symbols, spaces, commas, and dots.
  static int parse(String? input) {
    if (input == null || input.trim().isEmpty) {
      return 0;
    }
    final clean = input
        .replaceAll('₭', '')
        .replaceAll('ກີບ', '')
        .replaceAll('.', '')
        .replaceAll(',', '')
        .replaceAll(' ', '')
        .trim();
    if (clean.isEmpty) return 0;
    final asDouble = double.tryParse(clean);
    return asDouble?.round() ?? 0;
  }

  /// Calculates change: receivedAmount - totalDue.
  /// Returns 0 if receivedAmount < totalDue.
  static int calculateChange(int receivedAmount, int totalDue) {
    if (receivedAmount <= totalDue) return 0;
    return receivedAmount - totalDue;
  }

  /// Returns suggested quick cash total options based on totalDue.
  static List<int> getSuggestedTenders(int totalDue) {
    if (totalDue <= 0) return [0];
    final Set<int> suggestions = {totalDue};

    for (final note in banknoteDenominations) {
      if (note >= totalDue) {
        suggestions.add(note);
      } else {
        final remainder = totalDue % note;
        if (remainder != 0) {
          final roundedUp = totalDue + (note - remainder);
          suggestions.add(roundedUp);
        }
      }
    }

    final list = suggestions.toList()..sort();
    return list.take(6).toList();
  }

  /// Breakdown of change into optimal Lao banknotes
  static Map<int, int> breakdownChange(int changeAmount) {
    final Map<int, int> breakdown = {};
    int remaining = changeAmount;

    for (final note in banknoteDenominations) {
      if (remaining >= note) {
        final count = remaining ~/ note;
        breakdown[note] = count;
        remaining %= note;
      }
    }
    return breakdown;
  }
}

/// Dynamic Input Formatter that formats numbers with dot separators (`.`) as the user types
class LaoCurrencyInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    if (newValue.text.isEmpty) {
      return newValue;
    }

    // Strip everything except digits
    final digitsOnly = newValue.text.replaceAll(RegExp(r'[^\d]'), '');
    if (digitsOnly.isEmpty) {
      return const TextEditingValue(text: '');
    }

    final number = int.tryParse(digitsOnly) ?? 0;
    final formatted = LaoCurrencyFormatter.format(number, includeSymbol: false);

    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}
