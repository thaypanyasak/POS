import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Local metadata cache for product costs (Baht & Kip)
/// Matches web-app saveProductMetaLocal / getProductMetaLocal behavior
class ProductLocalMetaService {
  static final Map<String, Map<String, int>> _memoryCache = {};
  static bool _isInitialized = false;

  /// Loads cached product meta from SharedPreferences into fast memory cache
  static Future<void> init() async {
    if (_isInitialized) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys = prefs.getKeys().where((k) => k.startsWith('meiishop_prod_meta_'));
      for (final key in keys) {
        final prodId = key.replaceFirst('meiishop_prod_meta_', '');
        final raw = prefs.getString(key);
        if (raw != null && raw.isNotEmpty) {
          try {
            final Map<String, dynamic> decoded = jsonDecode(raw);
            _memoryCache[prodId] = {
              if (decoded['costBaht'] != null) 'costBaht': (decoded['costBaht'] as num).toInt(),
              if (decoded['costKip'] != null) 'costKip': (decoded['costKip'] as num).toInt(),
            };
          } catch (_) {}
        }
      }
      _isInitialized = true;
    } catch (_) {}
  }

  /// Synchronously gets cached metadata for a product
  static Map<String, int>? getMeta(String productId) {
    return _memoryCache[productId];
  }

  /// Saves product metadata (Baht & Kip cost) to memory cache & SharedPreferences
  static Future<void> saveMeta(
    String productId, {
    int? costBaht,
    int? costKip,
  }) async {
    if (productId.isEmpty) return;
    final current = _memoryCache[productId] ?? {};
    if (costBaht != null && costBaht > 0) current['costBaht'] = costBaht;
    if (costKip != null && costKip > 0) current['costKip'] = costKip;
    _memoryCache[productId] = current;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('meiishop_prod_meta_$productId', jsonEncode(current));
    } catch (_) {}
  }
}
