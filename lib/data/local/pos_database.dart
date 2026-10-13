import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../domain/models/sale_transaction.dart';

/// Universal Cross-Platform Offline-First Storage Service
/// Persists local transactions in browser localStorage & native storage.
class PosDatabase {
  PosDatabase._();
  static final PosDatabase instance = PosDatabase._();

  static const String _keyTransactions = 'meiishop_offline_transactions_v2';
  SharedPreferences? _prefs;

  Future<void> init() async {
    try {
      _prefs = await SharedPreferences.getInstance();
    } catch (_) {}
  }

  Future<SharedPreferences> _getPrefs() async {
    _prefs ??= await SharedPreferences.getInstance();
    return _prefs!;
  }

  /// Saves a sale transaction locally for instant zero-latency checkout
  Future<void> saveTransaction(SaleTransaction transaction) async {
    try {
      final prefs = await _getPrefs();
      final content = prefs.getString(_keyTransactions);
      final List<dynamic> list =
          content != null ? jsonDecode(content) as List<dynamic> : [];

      // Avoid duplicates
      list.removeWhere((item) => item is Map && item['id'] == transaction.id);

      // Prepend to show newest first
      list.insert(0, transaction.toJson());
      await prefs.setString(_keyTransactions, jsonEncode(list));
    } catch (_) {}
  }

  /// Retrieves all cached offline transactions
  Future<List<SaleTransaction>> getCachedTransactions() async {
    try {
      final prefs = await _getPrefs();
      final content = prefs.getString(_keyTransactions);
      if (content == null || content.isEmpty) return [];

      final List<dynamic> list = jsonDecode(content) as List<dynamic>;
      return list
          .whereType<Map<String, dynamic>>()
          .map((json) => SaleTransaction.fromJson(json))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Clears stored transactions (for reset)
  Future<void> clearTransactions() async {
    try {
      final prefs = await _getPrefs();
      await prefs.remove(_keyTransactions);
    } catch (_) {}
  }
}
