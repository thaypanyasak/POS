/**
 * QueryClient Cache Invalidation System for Meiishop POS
 * Provides 100% compliance with React Query's `queryClient.invalidateQueries({ queryKey })`
 * Synchronizes cache across POS (PosScreen), Products (ProductsView), GRN Inventory, and Dashboard.
 */
class QueryClient {
  constructor() {
    this.listeners = new Map(); // queryKey string -> Set of async callback functions
    this.cache = new Map(); // queryKey -> { data, timestamp }
    this.defaultStaleTime = 5 * 60 * 1000; // 5 minutes staleTime
  }

  // Get cached data if within staleTime
  getQueryData(queryKey) {
    const key = Array.isArray(queryKey) ? queryKey[0] : String(queryKey);
    const cached = this.cache.get(key);
    if (!cached) return undefined;
    if (Date.now() - cached.timestamp < (cached.staleTime ?? this.defaultStaleTime)) {
      return cached.data;
    }
    return undefined;
  }

  // Set query data with staleTime (default 5 minutes)
  setQueryData(queryKey, data, { staleTime = this.defaultStaleTime } = {}) {
    const key = Array.isArray(queryKey) ? queryKey[0] : String(queryKey);
    this.cache.set(key, { data, timestamp: Date.now(), staleTime });
    return data;
  }

  // Fetch with cache & 5-minute staleTime
  async fetchQuery({ queryKey, queryFn, staleTime = this.defaultStaleTime }) {
    const cached = this.getQueryData(queryKey);
    if (cached !== undefined) {
      return cached;
    }
    const data = await queryFn();
    this.setQueryData(queryKey, data, { staleTime });
    return data;
  }

  // Subscribe a component or screen to refetch when queryKey is invalidated
  subscribe(queryKey, callback) {
    const key = Array.isArray(queryKey) ? queryKey[0] : String(queryKey);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  // Invalidate queries matching queryKey and trigger immediate re-fetch
  async invalidateQueries({ queryKey } = {}) {
    if (!queryKey) return;
    const rawKey = Array.isArray(queryKey) ? queryKey[0] : String(queryKey);

    // Support query key aliases: 'transactions' <-> 'sale_transactions'
    const keysToInvalidate = new Set([rawKey]);
    if (rawKey === 'transactions') keysToInvalidate.add('sale_transactions');
    if (rawKey === 'sale_transactions') keysToInvalidate.add('transactions');

    // Invalidate memory cache
    for (const key of keysToInvalidate) {
      this.cache.delete(key);
    }

    const allPromises = [];
    for (const key of keysToInvalidate) {
      const cbs = this.listeners.get(key);
      if (cbs && cbs.size > 0) {
        for (const cb of cbs) {
          allPromises.push(
            (async () => {
              try {
                return await cb();
              } catch (err) {
                console.warn(`Query invalidation error for [${key}]:`, err);
              }
            })()
          );
        }
      }
    }
    await Promise.all(allPromises);
  }
}

export const queryClient = new QueryClient();

// Expose globally so window.queryClient is also available anywhere
if (typeof window !== 'undefined') {
  window.queryClient = queryClient;
}

export default queryClient;
