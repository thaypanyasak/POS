/**
 * safeStorage.js
 * Robust, Quota-Safe LocalStorage Utility for MeiiShop POS
 * Prevents QuotaExceededError crashes when continuous transactions occur
 */

export function cleanupLegacyStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const keysToRemove = [];
    const txMetaKeys = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      // Legacy version cleanup
      if (
        k.startsWith('meiishop_transactions_v') && k !== 'meiishop_transactions_v7'
      ) {
        keysToRemove.push(k);
      } else if (
        k.startsWith('meiishop_products_v') && k !== 'meiishop_products_v5'
      ) {
        keysToRemove.push(k);
      } else if (k.startsWith('meiishop_tx_meta_')) {
        txMetaKeys.push(k);
      }
    }

    // Remove legacy version keys
    keysToRemove.forEach((k) => {
      try { localStorage.removeItem(k); } catch (_) {}
    });

    // Prune tx_meta keys: Keep only the 5 most recent
    if (txMetaKeys.length > 5) {
      // Sort in reverse order (newest keys have larger timestamps)
      txMetaKeys.sort().reverse();
      const staleMetaKeys = txMetaKeys.slice(5);
      staleMetaKeys.forEach((k) => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
    }
  } catch (e) {
    console.warn('[safeStorage] Error during legacy cleanup:', e);
  }
}

/**
 * Safely sets an item in localStorage with automatic quota management and error suppression.
 * NEVER throws QuotaExceededError to caller.
 */
export function safeSetItem(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  const strVal = typeof value === 'string' ? value : JSON.stringify(value);

  try {
    localStorage.setItem(key, strVal);
    return true;
  } catch (err) {
    console.warn(`[safeStorage] Storage quota issue on key "${key}", executing emergency cleanup...`, err);

    // 1. Run aggressive storage cleanup
    cleanupLegacyStorage();

    // 2. If saving transactions, aggressively prune to latest 15 items
    if (key === 'meiishop_transactions_v7') {
      try {
        const parsed = JSON.parse(strVal);
        if (Array.isArray(parsed)) {
          const minimalList = parsed.slice(0, 15).map((t) => {
            // Strip any heavy embedded catalog references
            const { products: _discard, ...leanTx } = t;
            return leanTx;
          });
          localStorage.setItem(key, JSON.stringify(minimalList));
          return true;
        }
      } catch (_) {}
    }

    // 3. Try setting again after cleanup
    try {
      localStorage.setItem(key, strVal);
      return true;
    } catch (secondErr) {
      console.warn(`[safeStorage] Unable to save key "${key}" even after cleanup. Skipping cache to prevent crash.`, secondErr);
      return false;
    }
  }
}

/**
 * Safely gets an item from localStorage with JSON parse option and error suppression.
 */
export function safeGetItem(key, defaultValue = null) {
  if (typeof window === 'undefined' || !window.localStorage) return defaultValue;

  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw;
  } catch (err) {
    console.warn(`[safeStorage] Failed to read key "${key}":`, err);
    return defaultValue;
  }
}

/**
 * Safely gets and parses JSON from localStorage.
 */
export function safeGetJSON(key, defaultValue = null) {
  const raw = safeGetItem(key, null);
  if (!raw) return defaultValue;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return defaultValue;
  }
}
