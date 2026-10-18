import '../../domain/models/product_unit.dart';

/// ERP Smart Stock Formatting Helper
/// Accurately decomposes and formats stock counts across multi-tier packaging units
/// for both positive, zero, and negative (controlled oversold) inventory.
class StockFormatHelper {
  StockFormatHelper._();

  /// Decomposes negative base units from largest unit to smallest unit
  /// e.g. -288 -> "-2 ແກັດ"
  /// -294 -> "-2 ແກັດ 1 ແພັກ"
  /// -6 -> "-6 ອັນ"
  static String formatNegativeCompound(
    int stockBaseUnits,
    List<ProductUnit> units, {
    String baseUnitName = 'ອັນ',
  }) {
    if (stockBaseUnits >= 0) return '';

    final sortedUnits = units
        .where((u) => u.isActive && u.unitName.trim().isNotEmpty)
        .toList()
      ..sort((a, b) => b.multiplier.compareTo(a.multiplier));

    final baseName = baseUnitName.trim().isNotEmpty ? baseUnitName.trim() : 'ອັນ';
    if (!sortedUnits.any((u) => u.multiplier == 1)) {
      sortedUnits.add(ProductUnit(
        id: 'base_unit_auto',
        productId: '',
        unitName: baseName,
        multiplier: 1,
        retailPrice: 0,
        wholesalePrice: 0,
        isBaseUnit: true,
      ));
    }

    int remaining = stockBaseUnits.abs();
    final List<String> parts = [];

    for (int i = 0; i < sortedUnits.length; i++) {
      final u = sortedUnits[i];
      final m = u.multiplier > 0 ? u.multiplier : 1;
      if (i < sortedUnits.length - 1) {
        if (m > 1) {
          final count = remaining ~/ m;
          if (count > 0) {
            parts.add('$count ${u.unitName}');
            remaining %= m;
          }
        }
      } else {
        if (remaining > 0 || parts.isEmpty) {
          parts.add('$remaining ${u.unitName}');
        }
      }
    }

    return '-${parts.join(' ')}';
  }

  /// Full stock display string:
  /// - stock > 0: positive compound breakdown (e.g. "71 ແກັດ 1 ແພັກ")
  /// - stock == 0: "ໝົດສະຕັອກ (0)"
  /// - stock < 0: formatted negative string inside parentheses:
  ///   e.g. "ໝົດສະຕັອກ (-2 ແກັດ)" or "ຕິດລົບ (-2 ແກັດ)"
  static String formatStockDisplay(
    int stockBaseUnits,
    List<ProductUnit> units, {
    String baseUnitName = 'ອັນ',
    String prefix = 'ໝົດສະຕັອກ',
    bool trackStock = true,
  }) {
    if (!trackStock) return 'ບໍ່ນັບສາງ';
    if (stockBaseUnits == 0) return '$prefix (0)';

    if (stockBaseUnits < 0) {
      final negCompound = formatNegativeCompound(
        stockBaseUnits,
        units,
        baseUnitName: baseUnitName,
      );
      return '$prefix ($negCompound)';
    }

    final sortedUnits = units
        .where((u) => u.isActive && u.unitName.trim().isNotEmpty)
        .toList()
      ..sort((a, b) => b.multiplier.compareTo(a.multiplier));

    final baseName = baseUnitName.trim().isNotEmpty ? baseUnitName.trim() : 'ອັນ';
    if (!sortedUnits.any((u) => u.multiplier == 1)) {
      sortedUnits.add(ProductUnit(
        id: 'base_unit_auto',
        productId: '',
        unitName: baseName,
        multiplier: 1,
        retailPrice: 0,
        wholesalePrice: 0,
        isBaseUnit: true,
      ));
    }

    int remaining = stockBaseUnits;
    final List<String> parts = [];

    for (int i = 0; i < sortedUnits.length; i++) {
      final u = sortedUnits[i];
      final m = u.multiplier > 0 ? u.multiplier : 1;
      if (i < sortedUnits.length - 1) {
        if (m > 1) {
          final count = remaining ~/ m;
          if (count > 0) {
            parts.add('$count ${u.unitName}');
            remaining %= m;
          }
        }
      } else {
        if (remaining > 0 || parts.isEmpty) {
          parts.add('$remaining ${u.unitName}');
        }
      }
    }

    return parts.join(' ');
  }
}
