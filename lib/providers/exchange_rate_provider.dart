import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// State of the THB/LAK Exchange Rate (Point-in-Time Snapshot system)
class ExchangeRateState {
  final double rate; // e.g. 690.0 LAK / 1 THB
  final bool isLoading;
  final String? errorMessage;

  const ExchangeRateState({
    this.rate = 690.0,
    this.isLoading = false,
    this.errorMessage,
  });

  ExchangeRateState copyWith({
    double? rate,
    bool? isLoading,
    String? errorMessage,
  }) {
    return ExchangeRateState(
      rate: rate ?? this.rate,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

/// Notifier managing real-time dynamic THB/LAK rate from store_settings
class ExchangeRateNotifier extends StateNotifier<ExchangeRateState> {
  static const String _prefKey = 'thb_lak_exchange_rate';
  static const double defaultRate = 690.0;

  ExchangeRateNotifier() : super(const ExchangeRateState(rate: defaultRate)) {
    loadRate();
  }

  SupabaseClient? get _client {
    try {
      return Supabase.instance.client;
    } catch (_) {
      return null;
    }
  }

  Future<void> loadRate() async {
    // 1. Immediately hydrate cached rate from local SharedPreferences
    try {
      final prefs = await SharedPreferences.getInstance();
      final localRate = prefs.getDouble(_prefKey);
      if (localRate != null && localRate > 0) {
        state = state.copyWith(rate: localRate);
      }
    } catch (_) {}

    // 2. Query Supabase store_settings for cloud-synced rate
    final client = _client;
    if (client == null) return;

    try {
      state = state.copyWith(isLoading: true, errorMessage: null);
      final res = await client
          .from('store_settings')
          .select('value')
          .eq('key', 'thb_lak_exchange_rate')
          .maybeSingle();

      if (res != null && res['value'] != null) {
        final val = res['value'];
        double remoteRate = defaultRate;
        if (val is Map && val['rate'] != null) {
          remoteRate = (val['rate'] as num).toDouble();
        } else if (val is num) {
          remoteRate = val.toDouble();
        }

        if (remoteRate > 0) {
          state = state.copyWith(rate: remoteRate, isLoading: false);
          final prefs = await SharedPreferences.getInstance();
          await prefs.setDouble(_prefKey, remoteRate);
          return;
        }
      }
      state = state.copyWith(isLoading: false);
    } catch (e) {
      debugPrint('ExchangeRateNotifier loadRate error: $e');
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }

  Future<bool> updateExchangeRate(double newRate) async {
    if (newRate <= 0) return false;

    state = state.copyWith(isLoading: true, errorMessage: null);

    // 1. Save to SharedPreferences immediately for zero-latency local availability
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setDouble(_prefKey, newRate);
    } catch (_) {}

    // 2. Upsert to Supabase store_settings
    final client = _client;
    if (client != null) {
      try {
        await client.from('store_settings').upsert({
          'key': 'thb_lak_exchange_rate',
          'value': {
            'rate': newRate,
            'auto_update': false,
            'updated_at': DateTime.now().toIso8601String(),
          },
          'updated_at': DateTime.now().toIso8601String(),
        }, onConflict: 'key');
      } catch (e) {
        debugPrint('Failed to save exchange rate to Supabase: $e');
        state = state.copyWith(
          rate: newRate,
          isLoading: false,
          errorMessage: 'ບັນທຶກ Offline ແລ້ວ (Supabase sync error: $e)',
        );
        return true;
      }
    }

    state = state.copyWith(rate: newRate, isLoading: false);
    return true;
  }
}

final exchangeRateProvider =
    StateNotifierProvider<ExchangeRateNotifier, ExchangeRateState>((ref) {
  return ExchangeRateNotifier();
});
