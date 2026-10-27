/**
 * indexedDbStorage.js
 * High-Capacity, Asynchronous Storage Utility for MeiiShop Cloud POS
 * 
 * Supports:
 * - 3,000+ Products (10MB+ JSON) without hitting the 5MB browser localStorage ceiling
 * - Large offline sales queues (200-300 bills pending sync)
 * - Seamless automatic fallback to localStorage if IndexedDB is unavailable
 * - Automatic transparent migration of legacy localStorage data
 */

import { safeGetJSON, safeSetItem } from './safeStorage.js';

const DB_NAME = 'meiishop_idb_v1';
const STORE_NAME = 'keyval_store';
const DB_VERSION = 1;

let dbPromise = null;

function getDb() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        req.onsuccess = (event) => {
          resolve(event.target.result);
        };

        req.onerror = (err) => {
          console.warn('[indexedDbStorage] open error, falling back to localStorage:', err);
          resolve(null);
        };
      } catch (e) {
        console.warn('[indexedDbStorage] exception initializing IndexedDB:', e);
        resolve(null);
      }
    });
  }

  return dbPromise;
}

/**
 * Asynchronously sets an item into IndexedDB.
 * Falls back to safeSetItem (localStorage) if IndexedDB fails or is unavailable.
 */
export async function idbSet(key, value) {
  try {
    const db = await getDb();
    if (!db) {
      safeSetItem(key, value);
      return true;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);

        req.onsuccess = () => resolve(true);
        req.onerror = (e) => {
          console.warn(`[indexedDbStorage] put error for "${key}":`, e);
          safeSetItem(key, value);
          resolve(false);
        };
      } catch (err) {
        console.warn(`[indexedDbStorage] tx error for "${key}":`, err);
        safeSetItem(key, value);
        resolve(false);
      }
    });
  } catch (err) {
    console.warn(`[indexedDbStorage] idbSet exception for "${key}":`, err);
    safeSetItem(key, value);
    return false;
  }
}

/**
 * Asynchronously gets an item from IndexedDB.
 * If not found in IndexedDB, checks localStorage (for backward compatibility)
 * and migrates it to IndexedDB.
 */
export async function idbGet(key, defaultValue = null) {
  try {
    const db = await getDb();
    if (!db) {
      return safeGetJSON(key, defaultValue);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          if (req.result !== undefined && req.result !== null) {
            resolve(req.result);
          } else {
            // Check legacy localStorage fallback
            const localVal = safeGetJSON(key, null);
            if (localVal !== null) {
              // Migrate to IndexedDB in the background
              idbSet(key, localVal);
              resolve(localVal);
            } else {
              resolve(defaultValue);
            }
          }
        };

        req.onerror = () => {
          resolve(safeGetJSON(key, defaultValue));
        };
      } catch (_) {
        resolve(safeGetJSON(key, defaultValue));
      }
    });
  } catch (_) {
    return safeGetJSON(key, defaultValue);
  }
}

/**
 * Removes an item from both IndexedDB and localStorage.
 */
export async function idbDelete(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      try { localStorage.removeItem(key); } catch (_) {}
    }

    const db = await getDb();
    if (!db) return true;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  } catch (_) {
    return false;
  }
}
