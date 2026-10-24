import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Universal Persistent Storage Adapter for Supabase & POS Session
 * 
 * - Native iOS/Android (Capacitor): Uses @capacitor/preferences (backed by NSUserDefaults / SharedPreferences)
 *   which is 100% immune to WebKit / Safari localStorage purges or OS memory cleaning.
 * - Desktop Web Browser: Uses standard window.localStorage.
 */
export const universalStorage = {
  async getItem(key) {
    if (Capacitor.isNativePlatform()) {
      try {
        const { value } = await Preferences.get({ key });
        if (value !== null && value !== undefined) return value;
      } catch (err) {
        console.warn('[authStorage] Preferences.get error, falling back to localStorage:', err);
      }
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  },

  async setItem(key, value) {
    if (Capacitor.isNativePlatform()) {
      try {
        await Preferences.set({ key, value });
      } catch (err) {
        console.warn('[authStorage] Preferences.set error:', err);
      }
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch (err) {
        console.warn('[authStorage] localStorage.setItem error:', err);
      }
    }
  },

  async removeItem(key) {
    if (Capacitor.isNativePlatform()) {
      try {
        await Preferences.remove({ key });
      } catch (err) {
        console.warn('[authStorage] Preferences.remove error:', err);
      }
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch (err) {
        console.warn('[authStorage] localStorage.removeItem error:', err);
      }
    }
  },
};

const CASHIER_STORAGE_KEY = 'meiishop_active_cashier_v1';
const LOCK_STORAGE_KEY = 'meiishop_pos_locked_v1';

/**
 * Get the active cashier currently on duty
 */
export async function getActiveCashierLocal() {
  try {
    const raw = await universalStorage.getItem(CASHIER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Save the active cashier on duty
 */
export async function saveActiveCashierLocal(cashier) {
  try {
    if (!cashier) {
      await universalStorage.removeItem(CASHIER_STORAGE_KEY);
    } else {
      await universalStorage.setItem(CASHIER_STORAGE_KEY, JSON.stringify(cashier));
    }
  } catch (e) {
    console.warn('[authStorage] saveActiveCashierLocal error:', e);
  }
}

/**
 * Check if the POS screen is currently locked
 */
export async function getPosLockStatusLocal() {
  try {
    const raw = await universalStorage.getItem(LOCK_STORAGE_KEY);
    return raw === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Save POS lock state
 */
export async function savePosLockStatusLocal(isLocked) {
  try {
    await universalStorage.setItem(LOCK_STORAGE_KEY, isLocked ? 'true' : 'false');
  } catch (e) {
    console.warn('[authStorage] savePosLockStatusLocal error:', e);
  }
}
