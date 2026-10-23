import { supabase } from './supabase';

export const PRINTER_STORAGE_KEY = 'pos_printer_settings';

export const DEFAULT_PRINTER_CONFIG = {
  id: 'default_printer',
  printer_ip: '',
  printer_port: 9100,
  paper_width: 72,
  auto_cut: true,
  drawer_kick: false,
  print_method: 'socket',
};

/**
 * Normalizes a raw config object and attaches backward-compatible getter aliases
 */
function normalizeConfig(raw) {
  const ip = String(raw?.printer_ip ?? raw?.ip ?? '').trim();
  const port = parseInt(raw?.printer_port ?? raw?.port, 10) || 9100;
  const paperWidth = parseInt(raw?.paper_width ?? raw?.paperWidth, 10) || 72;
  const autoCut = (raw?.auto_cut ?? raw?.autoCut) !== false;
  const drawerKick = Boolean(raw?.drawer_kick ?? raw?.drawerKick);
  const printMethod = raw?.print_method ?? raw?.printMethod ?? 'socket';

  return {
    id: raw?.id || 'default_printer',
    printer_ip: ip,
    printer_port: port,
    paper_width: paperWidth,
    auto_cut: autoCut,
    drawer_kick: drawerKick,
    print_method: printMethod,
    // Aliases for seamless compatibility
    get ip() { return this.printer_ip; },
    get port() { return this.printer_port; },
    get autoCut() { return this.auto_cut; },
    get drawerKick() { return this.drawer_kick; },
    get paperWidth() { return this.paper_width; },
    get printMethod() { return this.print_method; },
  };
}

/**
 * Fast synchronous read from localStorage cache (ensures zero print latency)
 */
export function getPrinterConfig() {
  if (typeof window === 'undefined') return normalizeConfig(DEFAULT_PRINTER_CONFIG);
  try {
    const cached = localStorage.getItem(PRINTER_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return normalizeConfig(parsed);
    }

    // Fallback: Check legacy separate keys if exist
    const legacyIp = localStorage.getItem('pos_printer_ip');
    const legacyPort = localStorage.getItem('pos_printer_port');
    if (legacyIp) {
      const legacyConfig = {
        printer_ip: legacyIp,
        printer_port: parseInt(legacyPort, 10) || 9100,
      };
      return normalizeConfig(legacyConfig);
    }
  } catch (err) {
    console.warn('[printerConfigService] Failed reading cached config:', err);
  }

  return normalizeConfig(DEFAULT_PRINTER_CONFIG);
}

/**
 * Fetch shared printer settings from Supabase database and update local cache
 */
export async function fetchPrinterConfigFromDb() {
  try {
    // 1. Primary: Query the dedicated printer_settings table
    const { data, error } = await supabase
      .from('printer_settings')
      .select('*')
      .eq('id', 'default_printer')
      .maybeSingle();

    if (!error && data) {
      const config = normalizeConfig(data);
      saveLocalCache(config);
      return config;
    }

    // 2. Fallback: Check store_settings table if printer_settings table is not yet created
    const { data: storeSetting, error: storeErr } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'printer_settings')
      .maybeSingle();

    if (!storeErr && storeSetting?.value) {
      const config = normalizeConfig(storeSetting.value);
      saveLocalCache(config);
      return config;
    }
  } catch (err) {
    console.warn('[printerConfigService] Supabase fetch error, using local cache:', err);
  }

  return getPrinterConfig();
}

/**
 * Save printer settings locally and upsert to Supabase for multi-device sync
 */
export async function savePrinterConfig(newConfig) {
  const current = getPrinterConfig();
  const merged = normalizeConfig({ ...current, ...newConfig });

  // 1. Immediately write to localStorage cache
  saveLocalCache(merged);

  // 2. Notify any local listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('printer-config-updated', { detail: merged }));
  }

  // 3. Sync to Supabase in the background
  try {
    const payload = {
      id: 'default_printer',
      printer_ip: merged.printer_ip,
      printer_port: merged.printer_port,
      paper_width: merged.paper_width,
      auto_cut: merged.auto_cut,
      drawer_kick: merged.drawer_kick,
      updated_at: new Date().toISOString(),
    };

    // Try upserting to printer_settings table
    const { error } = await supabase
      .from('printer_settings')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('[printerConfigService] printer_settings upsert error, attempting store_settings fallback:', error);
      // Fallback save to store_settings table
      await supabase
        .from('store_settings')
        .upsert(
          { key: 'printer_settings', value: payload, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
    }
  } catch (err) {
    console.warn('[printerConfigService] Failed to sync printer settings to Supabase:', err);
  }

  return merged;
}

/**
 * Helper to update localStorage and legacy keys
 */
function saveLocalCache(config) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      PRINTER_STORAGE_KEY,
      JSON.stringify({
        id: config.id,
        printer_ip: config.printer_ip,
        printer_port: config.printer_port,
        paper_width: config.paper_width,
        auto_cut: config.auto_cut,
        drawer_kick: config.drawer_kick,
      })
    );
    // Legacy keys for backward safety
    localStorage.setItem('pos_printer_ip', config.printer_ip);
    localStorage.setItem('pos_printer_port', String(config.printer_port));
  } catch (_) {}
}

export default {
  getPrinterConfig,
  fetchPrinterConfigFromDb,
  savePrinterConfig,
  DEFAULT_PRINTER_CONFIG,
  PRINTER_STORAGE_KEY,
};
