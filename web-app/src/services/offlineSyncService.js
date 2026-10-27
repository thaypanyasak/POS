import { safeGetJSON, safeSetItem } from '../utils/safeStorage.js';

export const OFFLINE_QUEUE_KEY = 'meiishop_offline_queue_v1';

let isSyncingInProgress = false;

/**
 * Returns current array of pending offline transactions
 */
export function getOfflineQueue() {
  const queue = safeGetJSON(OFFLINE_QUEUE_KEY, []);
  return Array.isArray(queue) ? queue : [];
}

/**
 * Adds a transaction to the offline queue
 */
export function addToOfflineQueue({ id, receipt, stockDeductions }) {
  if (!id || !receipt) return false;

  const queue = getOfflineQueue();
  // Prevent duplicate insertion
  if (queue.some((item) => item.id === id)) {
    return true;
  }

  const payload = {
    id,
    receipt,
    stockDeductions: stockDeductions || [],
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };

  const updatedQueue = [...queue, payload];
  safeSetItem(OFFLINE_QUEUE_KEY, updatedQueue);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('meiishop_offline_queue_changed', {
        detail: { count: updatedQueue.length, queue: updatedQueue },
      })
    );
  }

  return true;
}

/**
 * Removes a transaction from the offline queue
 */
export function removeFromOfflineQueue(txId) {
  if (!txId) return;

  const queue = getOfflineQueue();
  const updatedQueue = queue.filter((item) => item.id !== txId);
  safeSetItem(OFFLINE_QUEUE_KEY, updatedQueue);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('meiishop_offline_queue_changed', {
        detail: { count: updatedQueue.length, queue: updatedQueue },
      })
    );
  }
}

/**
 * Clears the offline queue
 */
export function clearOfflineQueue() {
  safeSetItem(OFFLINE_QUEUE_KEY, []);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('meiishop_offline_queue_changed', {
        detail: { count: 0, queue: [] },
      })
    );
  }
}

/**
 * Checks if device is currently online
 */
export function isDeviceOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

/**
 * Synchronizes all pending offline transactions to Supabase Cloud
 */
export async function syncOfflineQueue(createSaleTransactionInSupabase) {
  if (isSyncingInProgress) {
    return { success: false, inProgress: true, syncedCount: 0 };
  }

  if (!isDeviceOnline()) {
    return { success: false, isOffline: true, syncedCount: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { success: true, syncedCount: 0, remainingCount: 0 };
  }

  isSyncingInProgress = true;
  let syncedCount = 0;
  const successfullySyncedIds = [];

  try {
    for (const item of queue) {
      if (!isDeviceOnline()) {
        break;
      }

      try {
        // Strip the local isOfflinePending marker before sending to Supabase
        const { isOfflinePending: _discard, ...cleanReceipt } = item.receipt;

        const res = await createSaleTransactionInSupabase(
          cleanReceipt,
          item.stockDeductions || []
        );

        // If success or duplicate key (23505 = already inserted before connection drop)
        if (
          res.success ||
          (res.code === '23505' || (res.error && res.error.includes('duplicate key')))
        ) {
          syncedCount++;
          successfullySyncedIds.push(item.id);
          removeFromOfflineQueue(item.id);
        } else {
          console.warn('[offlineSyncService] Failed to sync order:', item.id, res.error);
          // If error is network-related, abort loop to retry later
          if (
            !isDeviceOnline() ||
            res.error?.includes('Failed to fetch') ||
            res.error?.includes('NetworkError')
          ) {
            break;
          }
        }
      } catch (itemErr) {
        console.warn('[offlineSyncService] Exception syncing order:', item.id, itemErr);
        if (!isDeviceOnline()) break;
      }
    }
  } finally {
    isSyncingInProgress = false;
  }

  const remaining = getOfflineQueue();

  if (typeof window !== 'undefined' && syncedCount > 0) {
    window.dispatchEvent(
      new CustomEvent('meiishop_offline_synced', {
        detail: {
          syncedCount,
          syncedIds: successfullySyncedIds,
          remainingCount: remaining.length,
        },
      })
    );
  }

  return {
    success: remaining.length === 0,
    syncedCount,
    remainingCount: remaining.length,
    syncedIds: successfullySyncedIds,
  };
}
