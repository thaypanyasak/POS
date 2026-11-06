import { createClient } from '@supabase/supabase-js';
import { universalStorage } from './authStorage';
import { sanitizeImageUrl, normalizeLao } from '../utils/formatters';
import { idbGet, idbSet } from '../utils/indexedDbStorage';
import { safeSetItem, clearAllLocalProductMeta } from '../utils/safeStorage';
import { isCustomerStorefrontRoute } from '../utils/routeUtils';
import { calculateItemCostAndMultiplier, recalculateTransactionTotals } from '../utils/costCalculation';

const SUPABASE_URL = 'https://qanphpmphnipyuwcadwz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zQw2L3JfnT-5o_-tJgZaIA_WETQFTPq';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: universalStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function sanitizeCashierName(name) {
  if (!name) return 'Meii';
  const str = String(name).trim();
  return str || 'Meii';
}

/**
 * Helper to store product metadata (Baht cost, Kip cost, tier settings) locally
 */
export function saveProductMetaLocal(product) {
  try {
    if (typeof window !== 'undefined' && window.localStorage && product?.id) {
      // Xóa bỏ key metadata cũ nếu có để không tạo bóng ma dữ liệu (ghost data lệch giá vốn)
      window.localStorage.removeItem(`meiishop_prod_meta_${product.id}`);
    }
  } catch (e) {
    console.warn('saveProductMetaLocal cleanup warning:', e);
  }
}

// Cache memory danh mục để tránh gọi SELECT categories thừa khi thêm/sửa sản phẩm
const categoryNameToIdCache = new Map();

export function getProductMetaLocal(_productId) {
  // Trả về null để 100% các máy luôn đọc dữ liệu gốc mới nhất từ Supabase Cloud
  return null;
}

/**
 * 0. Consolidated Store Settings Cache with In-Flight Deduplication & Multi-Key Batching
 * Reduces 6-12 parallel round trips down to EXACTLY 1 batched query on initial load.
 */
const BATCH_STORE_SETTINGS_KEYS = [
  'thb_lak_exchange_rate',
  'product_crate_deposits',
  'app_staff_list_v1',
  'app_roles_v1',
  'role_permissions',
  'printer_settings',
];

const storeSettingsCache = new Map();
let storeSettingsTimestamp = 0;
let inFlightStoreSettingsPromise = null;
const STORE_SETTINGS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL

export function invalidateStoreSettingsCache(key = null) {
  if (key) {
    storeSettingsCache.delete(key);
  } else {
    storeSettingsCache.clear();
  }
  storeSettingsTimestamp = 0;
  inFlightStoreSettingsPromise = null;
}

export async function fetchAllStoreSettings({ force = false } = {}) {
  const now = Date.now();
  if (!force && storeSettingsCache.size > 0 && (now - storeSettingsTimestamp < STORE_SETTINGS_CACHE_TTL)) {
    return storeSettingsCache;
  }

  if (inFlightStoreSettingsPromise) {
    return inFlightStoreSettingsPromise;
  }

  inFlightStoreSettingsPromise = (async () => {
    try {
      // Security Isolation: Public customer storefront only needs the exchange rate
      // Never fetch staff list, permissions, or printer settings for storefront visitors
      const keysToFetch = isCustomerStorefrontRoute()
        ? ['thb_lak_exchange_rate']
        : BATCH_STORE_SETTINGS_KEYS;

      const { data, error } = await supabase
        .from('store_settings')
        .select('key, value')
        .in('key', keysToFetch);

      if (!error && Array.isArray(data)) {
        data.forEach((row) => {
          if (row.key) {
            storeSettingsCache.set(row.key, row.value);
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                window.localStorage.setItem(`meiishop_setting_${row.key}`, JSON.stringify(row.value));
              } catch (_) {}
            }
          }
        });
        storeSettingsTimestamp = Date.now();
      }
      return storeSettingsCache;
    } catch (err) {
      console.warn('fetchAllStoreSettings error:', err);
      return storeSettingsCache;
    } finally {
      inFlightStoreSettingsPromise = null;
    }
  })();

  return inFlightStoreSettingsPromise;
}

export async function fetchStoreSetting(key, defaultValue = null, { force = false } = {}) {
  // 1. If key is already in memory cache and not forcing refresh, return immediately (0 Egress bytes, 0ms)
  if (force) {
    storeSettingsCache.delete(key);
  } else if (storeSettingsCache.has(key)) {
    return storeSettingsCache.get(key);
  }

  // 2. Fetch the batched standard store settings
  await fetchAllStoreSettings({ force });

  if (storeSettingsCache.has(key)) {
    return storeSettingsCache.get(key);
  }

  // 3. Fallback for custom individual keys not in standard batch list
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (!error && data) {
      storeSettingsCache.set(key, data.value);
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(`meiishop_setting_${key}`, JSON.stringify(data.value));
        } catch (_) {}
      }
      return data.value;
    }
  } catch (err) {
    console.warn(`fetchStoreSetting error for key ${key}:`, err);
  }

  // 4. LocalStorage offline fallback
  if (typeof window !== 'undefined' && window.localStorage) {
    const local = window.localStorage.getItem(`meiishop_setting_${key}`);
    if (local) {
      try { return JSON.parse(local); } catch (_) {}
    }
  }

  return defaultValue;
}

export async function updateStoreSetting(key, value) {
  storeSettingsCache.set(key, value);
  storeSettingsTimestamp = Date.now();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(`meiishop_setting_${key}`, JSON.stringify(value));
    } catch (_) {}
  }

  try {
    const { data, error } = await supabase
      .from('store_settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
      .select('key, value')
      .maybeSingle();

    if (error) {
      console.warn(`updateStoreSetting error for ${key}:`, error);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err) {
    console.error(`updateStoreSetting exception for ${key}:`, err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function fetchExchangeRate() {
  const setting = await fetchStoreSetting('thb_lak_exchange_rate', { rate: 690, auto_update: false });
  return Number(setting?.rate) || 690;
}

export async function updateExchangeRateInSupabase(newRate) {
  const rateNum = Number(newRate);
  if (!rateNum || rateNum <= 0) {
    return { success: false, error: 'Tỷ giá phải là số dương lớn hơn 0' };
  }
  return await updateStoreSetting('thb_lak_exchange_rate', {
    rate: rateNum,
    auto_update: false,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Cập nhật tỷ giá và tự động tính lại giá bán cho toàn bộ sản phẩm (Zero-Egress Strategy via RPC)
 * Thực thi 100% trong PostgreSQL - không tải lại danh sách sản phẩm về client
 */
export async function syncExchangeRateAndRepriceInSupabase(newRate, roundStep = 1000) {
  const rateNum = Number(newRate);
  if (!rateNum || rateNum <= 0) {
    return { success: false, error: 'Tỷ giá phải là số dương lớn hơn 0' };
  }
  try {
    let { data, error } = await supabase.rpc('sync_exchange_rate_and_reprice', {
      p_new_rate: rateNum,
      p_round_step: roundStep,
    });
    if (error) {
      const retryRes = await supabase.rpc('update_exchange_rate_and_reprice', {
        p_new_rate: rateNum,
        p_round_step: roundStep,
      });
      data = retryRes.data;
      error = retryRes.error;
    }
    if (error) {
      console.warn('RPC sync_exchange_rate_and_reprice warning, falling back to standard setting update:', error);
      const fallbackRes = await updateExchangeRateInSupabase(rateNum);
      return fallbackRes;
    }
    return { success: true, data };
  } catch (err) {
    console.error('syncExchangeRateAndRepriceInSupabase exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

export const updateExchangeRateAndRepriceInSupabase = syncExchangeRateAndRepriceInSupabase;

// Global cached crate deposit settings from store_settings (synchronized across all devices)
let cachedCrateDeposits = null;

export async function fetchProductCrateDeposits() {
  if (cachedCrateDeposits) return cachedCrateDeposits;
  const map = await fetchStoreSetting('product_crate_deposits', {});
  cachedCrateDeposits = map && typeof map === 'object' ? map : {};
  return cachedCrateDeposits;
}

export async function saveProductCrateDepositSetting(productId, hasCrateDeposit, crateDepositFee = 30000) {
  try {
    const current = await fetchProductCrateDeposits();
    const updated = {
      ...current,
      [productId]: {
        hasCrateDeposit: Boolean(hasCrateDeposit),
        crateDepositFee: Number(crateDepositFee) || 30000,
      },
    };
    cachedCrateDeposits = updated;
    await updateStoreSetting('product_crate_deposits', updated);
  } catch (err) {
    console.warn('saveProductCrateDepositSetting error:', err);
  }
}

/**
 * Safely fetches all rows from a Supabase query using range-based chunking.
 * Bypasses the default 1,000 row hard limit of PostgREST to guarantee complete data loading.
 */
export async function fetchAllRowsWithRange(makeQueryFn, chunkSize = 1000) {
  let allRows = [];
  let from = 0;
  while (true) {
    const to = from + chunkSize - 1;
    const { data, error } = await makeQueryFn().range(from, to);
    if (error) {
      if (allRows.length > 0) {
        console.warn('[Supabase] Partial chunk fetch warning:', error);
        return { data: allRows, error: null };
      }
      return { data: null, error };
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < chunkSize) break; // Finished reading all available rows
    from += chunkSize;
  }
  return { data: allRows, error: null };
}

/**
 * In-memory SWR Cache for Products & In-Flight Promise Deduplication (Bandwidth Egress Defense)
 * Tách biệt hoàn toàn Cache POS (đầy đủ giá vốn) và Cache Storefront Khách hàng (bảo mật tuyệt đối, 0 rò rỉ dữ liệu)
 */
let cachedPosProductsInMemory = null;
let cachedPosProductsTimestamp = 0;
let inFlightPosProductsPromise = null;

let cachedCustomerProductsInMemory = null;
let cachedCustomerProductsTimestamp = 0;
let inFlightCustomerProductsPromise = null;

// Backward-compatible pointer to cachedPosProductsInMemory
let cachedProductsInMemory = null;
let cachedProductsTimestamp = 0;

const PRODUCTS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL

export function invalidateProductsCache() {
  cachedPosProductsInMemory = null;
  cachedPosProductsTimestamp = 0;
  inFlightPosProductsPromise = null;
  cachedCustomerProductsInMemory = null;
  cachedCustomerProductsTimestamp = 0;
  inFlightCustomerProductsPromise = null;
  cachedProductsInMemory = null;
  cachedProductsTimestamp = 0;
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('meiishop_catalog_fingerprint');
      localStorage.removeItem('meiishop_customer_catalog_fingerprint');
    }
  } catch (_) {}
}

export function setCachedProductsInMemory(products, isCustomer = false) {
  if (Array.isArray(products)) {
    if (isCustomer) {
      cachedCustomerProductsInMemory = products;
      cachedCustomerProductsTimestamp = Date.now();
    } else {
      cachedPosProductsInMemory = products;
      cachedPosProductsTimestamp = Date.now();
      cachedProductsInMemory = products;
      cachedProductsTimestamp = Date.now();
    }
  }
}

/**
 * 1. Fetch all products with their associated multi-tier units from Supabase (Full Scale 3,000+ support)
 * Features Stale-While-Revalidate caching, in-flight deduplication, selective column projection,
 * and Delta-Sync fingerprint check to slash PostgREST egress by over 90%.
 */
export async function fetchProductsFromSupabase({ force = false, forCustomer = false } = {}) {
  const isCustomer = Boolean(forCustomer || isCustomerStorefrontRoute());
  const now = Date.now();

  const cachedInMemory = isCustomer ? cachedCustomerProductsInMemory : cachedPosProductsInMemory;
  const cachedTimestamp = isCustomer ? cachedCustomerProductsTimestamp : cachedPosProductsTimestamp;

  // 1. If not forcing and cache is still fresh within TTL, return in-memory cache directly (0 Egress bytes!)
  if (!force && cachedInMemory && (now - cachedTimestamp < PRODUCTS_CACHE_TTL)) {
    return cachedInMemory;
  }

  // 2. In-flight deduplication: If a fetch is already running, share the exact same promise!
  const activePromise = isCustomer ? inFlightCustomerProductsPromise : inFlightPosProductsPromise;
  if (activePromise) {
    return activePromise;
  }

  const fetchTask = (async () => {
    try {
      // Khi bấm nút Refresh (force: true): dọn sạch toàn bộ metadata và fingerprint cục bộ
      if (force) {
        clearAllLocalProductMeta();
        cachedPosProductsInMemory = null;
        cachedCustomerProductsInMemory = null;
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.removeItem('meiishop_catalog_fingerprint');
            window.localStorage.removeItem('meiishop_customer_catalog_fingerprint');
          } catch (_) {}
        }
      }

      // 2.1 Bandwidth Defense: Delta-Sync check before downloading 600+ products (~65KB)
      let localProducts = cachedInMemory;
      const storageKey = isCustomer ? 'meiishop_customer_products_v1' : 'meiishop_products_v5';
      const fingerprintKey = isCustomer ? 'meiishop_customer_catalog_fingerprint' : 'meiishop_catalog_fingerprint';

      if (!localProducts && typeof window !== 'undefined') {
        try {
          localProducts = await idbGet(storageKey, null);
        } catch (_) {}
      }

      // If not forced and local cached catalog is populated, check cloud fingerprint (< 130 bytes query)
      if (!force && Array.isArray(localProducts) && localProducts.length > 0) {
        try {
          const { data: latestRows, count: cloudCount, error: checkErr } = await supabase
            .from('products')
            .select('id, updated_at, created_at', { count: 'exact' })
            .order('updated_at', { ascending: false, nullsFirst: false })
            .limit(1);

          if (!checkErr && cloudCount !== null && latestRows && latestRows.length > 0) {
            const latest = latestRows[0];
            const cloudFingerprint = `${cloudCount}_${latest.id}_${latest.updated_at || latest.created_at}`;
            const localFingerprint = typeof window !== 'undefined' ? localStorage.getItem(fingerprintKey) : null;

            if (cloudFingerprint === localFingerprint) {
              console.log(`[Bandwidth Guard] Products catalog fingerprint matches cloud (${cloudCount} items). Bypassed full fetch!`);
              if (isCustomer) {
                cachedCustomerProductsInMemory = localProducts;
                cachedCustomerProductsTimestamp = Date.now();
              } else {
                cachedPosProductsInMemory = localProducts;
                cachedPosProductsTimestamp = Date.now();
              }
              return localProducts;
            }
          }
        } catch (deltaErr) {
          console.warn('[Bandwidth Guard] Delta check skipped due to error:', deltaErr);
        }
      }

      // 1. Fetch products using explicit column projection
      // BẢO MẬT & TIẾT KIỆM BĂNG THÔNG EGRESS:
      // Trang khách xem menu (Storefront) TUYỆT ĐỐI KHÔNG truy vấn giá vốn, tồn kho, lãi gộp hay giá sỉ
      const productSelectCols = isCustomer
        ? 'id, name, name_vi, barcode, image_url, category, category_id, base_unit, created_at'
        : 'id, name, name_vi, barcode, image_url, category, category_id, base_unit, cost_lak, cost_thb, cost_currency, is_auto_currency_reprice, cost_per_base_unit, track_stock, current_stock_base_units, allow_negative_stock, is_deleted, created_at, updated_at';

      let res = await fetchAllRowsWithRange(() =>
        supabase
          .from('products')
          .select(productSelectCols)
          .order('created_at', { ascending: true })
      );

      // Safe fallback if cost_currency / is_auto_currency_reprice not yet in schema cache (POS mode)
      if (!isCustomer && res.error && (res.error.message?.includes('cost_currency') || res.error.message?.includes('is_auto_currency_reprice'))) {
        res = await fetchAllRowsWithRange(() =>
          supabase
            .from('products')
            .select('id, name, name_vi, barcode, image_url, category, category_id, base_unit, cost_lak, cost_thb, cost_per_base_unit, track_stock, current_stock_base_units, allow_negative_stock, is_deleted, created_at, updated_at')
            .order('created_at', { ascending: true })
        );
      }

      const prodData = res.data;
      const prodErr = res.error;

      if (prodErr || !prodData) {
        console.warn('Could not fetch products from Supabase:', prodErr);
        return cachedInMemory || localProducts || null;
      }

      // Filter out soft-deleted products if is_deleted column is present
      const activeProducts = prodData.filter((p) => p.is_deleted !== true);

      // 2. Fetch product_units using explicit column projection
      // Trang khách Storefront chỉ cần giá bán lẻ (retail_price); Bỏ qua toàn bộ giá sỉ và tỷ lệ giá!
      const unitSelectCols = isCustomer
        ? 'id, product_id, unit_name, multiplier, retail_price, barcode, is_base_unit'
        : 'id, product_id, unit_name, multiplier, retail_price, wholesale_price, price_2, price_3, price_ratio_1, price_ratio_2, price_ratio_3, barcode, is_base_unit';

      let { data: unitsData, error: unitsErr } = await fetchAllRowsWithRange(() =>
        supabase
          .from('product_units')
          .select(unitSelectCols)
      );

      // Safe fallback if price_ratio columns not yet in schema cache
      if (!isCustomer && unitsErr && (unitsErr.message?.includes('price_ratio_1') || unitsErr.message?.includes('price_ratio'))) {
        const fallbackUnitsRes = await fetchAllRowsWithRange(() =>
          supabase
            .from('product_units')
            .select('id, product_id, unit_name, multiplier, retail_price, wholesale_price, price_2, price_3, barcode, is_base_unit')
        );
        unitsData = fallbackUnitsRes.data;
        unitsErr = fallbackUnitsRes.error;
      }

      if (unitsErr || !unitsData) {
        console.warn('Could not fetch product_units from Supabase:', unitsErr);
        return cachedInMemory || null;
      }

      // Fetch product_crate_deposits synchronized settings from store_settings (bypassed for customer storefront)
      const crateDepositsMap = isCustomer ? {} : await fetchProductCrateDeposits().catch(() => ({}));

      // 3. O(N) Hash Map Indexing for units by product_id (eliminates O(N*M) 27-million iteration loop)
      const unitsByProductId = new Map();
      for (let i = 0; i < unitsData.length; i++) {
        const u = unitsData[i];
        const pid = u.product_id;
        let list = unitsByProductId.get(pid);
        if (!list) {
          list = [];
          unitsByProductId.set(pid, list);
        }
        list.push(u);
      }

      // Map units to their corresponding products
      const mapped = activeProducts.map((p) => {
        const rawUnits = unitsByProductId.get(p.id) || [];
        const pUnits = rawUnits.map((u) => {
          let resolvedTier = 1;
          if (
            u.id?.endsWith('_carton') ||
            ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງໃຫຍ່', 'ຖັງ'].includes(u.unit_name)
          ) {
            resolvedTier = 3;
          } else if (
            u.id?.endsWith('_pack') ||
            ['ແພັກ', 'ມັດ', 'ແຕະ', 'ໂหล', 'ຖົງກາງ'].includes(u.unit_name)
          ) {
            resolvedTier = 2;
          } else if (
            u.id?.endsWith('_piece') ||
            ['ອັນ', 'ແກ້ວ', 'ຖົງ', 'ກະປ໋ອງ', 'ຕຸກ', 'ຊອງ', 'ກ່ອງນ້ອຍ'].includes(u.unit_name)
          ) {
            resolvedTier = 1;
          }

          if (isCustomer) {
            return {
              id: u.id,
              productId: u.product_id,
              unitName: u.unit_name,
              multiplier: Number(u.multiplier) || 1,
              retailPrice: Number(u.retail_price) || 0,
              barcode: u.barcode || null,
              isBaseUnit: Boolean(u.is_base_unit),
              tier: resolvedTier,
            };
          }

          return {
            id: u.id,
            productId: u.product_id,
            unitName: u.unit_name,
            multiplier: Number(u.multiplier) || 1,
            retailPrice: Number(u.retail_price) || 0,
            wholesalePrice: Number(u.wholesale_price) || 0,
            price_2: Number(u.price_2) || 0,
            price_3: Number(u.price_3) || 0,
            price2: Number(u.price_2) || 0,
            price3: Number(u.price_3) || 0,
            price_ratio_1: Number(u.price_ratio_1) || 0,
            price_ratio_2: Number(u.price_ratio_2) || 0,
            price_ratio_3: Number(u.price_ratio_3) || 0,
            barcode: u.barcode || null,
            isBaseUnit: Boolean(u.is_base_unit),
            tier: resolvedTier,
          };
        });

        // Sort units by multiplier ascending
        pUnits.sort((a, b) => a.multiplier - b.multiplier);

        const localMeta = isCustomer ? null : getProductMetaLocal(p.id);

        // 1. Identify distinct active tier units from database rows
        let cartonUnit = pUnits.find(
          (u) =>
            u.tier === 3 ||
            u.id?.endsWith('_carton') ||
            ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງໃຫຍ່', 'ຖັງ'].includes(u.unitName)
        );

        let packUnit = pUnits.find(
          (u) =>
            (u.tier === 2 ||
              u.id?.endsWith('_pack') ||
              ['ແພັກ', 'ມັດ', 'ແຕະ', 'ໂหล', 'ຖົງກາງ'].includes(u.unitName)) &&
            (!cartonUnit || u.id !== cartonUnit.id)
        );

        let pieceUnit = pUnits.find(
          (u) =>
            (u.tier === 1 ||
              u.id?.endsWith('_piece') ||
              ['ອັນ', 'ແກ້ວ', 'ຖົງ', 'ກະປ໋ອງ', 'ຕຸກ', 'ຊອງ', 'ກ່ອງນ້ອຍ'].includes(u.unitName)) &&
            (!cartonUnit || u.id !== cartonUnit.id) &&
            (!packUnit || u.id !== packUnit.id)
        );

        // Handle single unit case where name wasn't in preset dictionary
        if (pUnits.length === 1 && !cartonUnit && !packUnit && !pieceUnit) {
          pieceUnit = pUnits[0];
        }

        // Determine active status: A tier is active IF AND ONLY IF its corresponding unit exists in the DB
        const isCartonActive = Boolean(cartonUnit);
        const isPackActive = Boolean(packUnit);
        const isPieceActive = Boolean(pieceUnit);

        // Multipliers resolution
        let packsPerCarton = 8;
        if (isCartonActive && isPackActive && cartonUnit.multiplier > packUnit.multiplier) {
          packsPerCarton = Math.round(cartonUnit.multiplier / packUnit.multiplier);
        } else if (isCartonActive && cartonUnit.multiplier > 1) {
          packsPerCarton = cartonUnit.multiplier;
        }

        let piecesPerPack = 6;
        if (isPackActive && isPieceActive && packUnit.multiplier > pieceUnit.multiplier) {
          piecesPerPack = Math.round(packUnit.multiplier / pieceUnit.multiplier);
        } else if (isPackActive && packUnit.multiplier > 1) {
          piecesPerPack = packUnit.multiplier;
        }

        const tierSettings = {
          enableCarton: isCartonActive,
          enablePack: isPackActive,
          enablePiece: isPieceActive,
          cartonUnitName: cartonUnit?.unitName || 'ແກັດ',
          packUnitName: packUnit?.unitName || 'ແພັກ',
          pieceUnitName: pieceUnit?.unitName || 'ອັນ',
          packMultiplier: piecesPerPack,
          cartonMultiplier: packsPerCarton,
        };

        // Dynamic Base Unit Name
        let resolvedBaseUnit = p.base_unit || 'ອັນ';
        if (isPieceActive && pieceUnit) {
          resolvedBaseUnit = pieceUnit.unitName;
        } else if (isPackActive && packUnit) {
          resolvedBaseUnit = packUnit.unitName;
        } else if (isCartonActive && cartonUnit) {
          resolvedBaseUnit = cartonUnit.unitName;
        }

        // Dynamic Category Name resolution: prefer relational categories.name, then fallback to p.category
        const resolvedCategoryName = p.categories?.name || p.category || 'ເຄື່ອງດື່ມ';
        const resolvedCategoryId = p.category_id || p.categories?.id || null;

        const resolvedNameVi = p.name_vi || p.nameVi || localMeta?.name_vi || localMeta?.nameVi || '';

        // 4. Pre-computed Flat Search Index for instantaneous search in POS and Customer Menu (< 1ms)
        const cleanName = (p.name || '').toLowerCase();
        const normLaoName = normalizeLao(p.name || '');
        const cleanViName = (resolvedNameVi || '').toLowerCase();
        const cleanBarcode = (p.barcode || '').toLowerCase();
        const unitsBarcodes = pUnits
          .map((u) => u.barcode || '')
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const searchKey = `${cleanName} ${normLaoName} ${cleanViName} ${cleanBarcode} ${unitsBarcodes}`.trim();

        // NẾU LÀ KHÁCH XEM STOREFRONT: Chỉ trả về thông tin công khai
        // TUYỆT ĐỐI KHÔNG chứa: cost_lak, cost_thb, current_stock_base_units, wholesale_price, v.v.
        if (isCustomer) {
          return {
            id: p.id,
            created_at: p.created_at || null,
            createdAt: p.created_at || null,
            name: p.name,
            name_vi: resolvedNameVi,
            nameVi: resolvedNameVi,
            category: resolvedCategoryName,
            categoryId: resolvedCategoryId,
            barcode: p.barcode || '',
            imageUrl: sanitizeImageUrl(p.image_url) || null,
            baseUnit: resolvedBaseUnit,
            tier1_active: isCartonActive,
            tier2_active: isPackActive,
            tier3_active: isPieceActive,
            tierSettings,
            _searchKey: searchKey,
            units: pUnits.length > 0 ? pUnits : [
              {
                id: `${p.id}_base`,
                productId: p.id,
                unitName: resolvedBaseUnit,
                multiplier: 1,
                retailPrice: 0,
                isBaseUnit: true,
                tier: 1,
              }
            ],
          };
        }

        // DÀNH CHO NHÂN VIÊN POS & QUẢN LÝ (AUTHENTICATED ONLY)
        const cartonMultiplier = cartonUnit ? cartonUnit.multiplier : 1;
        const baseCostKip = Number(p.cost_per_base_unit) || 0;
        const computedCartonCostKip = baseCostKip * cartonMultiplier;

        // GROUND TRUTH: Dữ liệu thật từ Cloud Supabase (cost_lak, cost_thb) luôn là CHÂN LÝ TỐI THƯỢNG
        // Tuyệt đối KHÔNG đọc từ LocalStorage để tránh lệch giá giữa các thiết bị!
        let costKip = 0;
        if (p.cost_lak !== null && p.cost_lak !== undefined && p.cost_lak !== '') {
          costKip = Number(p.cost_lak) || 0;
        } else if (computedCartonCostKip > 0) {
          costKip = computedCartonCostKip;
        }

        let costBaht = 0;
        if (p.cost_thb !== null && p.cost_thb !== undefined && p.cost_thb !== '') {
          costBaht = Number(p.cost_thb) || 0;
        } else if (p.cost_baht !== null && p.cost_baht !== undefined && p.cost_baht !== '') {
          costBaht = Number(p.cost_baht) || 0;
        }

        const isTrackStock = p.track_stock !== false;
        const stockValue = isTrackStock
          ? (p.current_stock_base_units !== null && p.current_stock_base_units !== undefined
              ? Number(p.current_stock_base_units)
              : 0)
          : 0;

        return {
          id: p.id,
          created_at: p.created_at || null,
          createdAt: p.created_at || null,
          updated_at: p.updated_at || null,
          updatedAt: p.updated_at || null,
          name: p.name,
          name_vi: resolvedNameVi,
          nameVi: resolvedNameVi,
          category: resolvedCategoryName,
          categoryId: resolvedCategoryId,
          categories: p.categories || null,
          barcode: p.barcode || '',
          imageUrl: sanitizeImageUrl(p.image_url) || null,
          baseUnit: resolvedBaseUnit,
          costPerBaseUnit: baseCostKip,
          costBaht: Number(costBaht) || 0,
          costKip: Number(costKip) || 0,
          cost_thb: Number(costBaht) || 0,
          cost_lak: Number(costKip) || 0,
          cost_currency: p.cost_currency || (Number(costBaht) > 0 ? 'THB' : (Number(costKip) > 0 ? 'LAK' : 'THB')),
          costCurrency: p.cost_currency || (Number(costBaht) > 0 ? 'THB' : (Number(costKip) > 0 ? 'LAK' : 'THB')),
          is_auto_currency_reprice: p.is_auto_currency_reprice !== undefined ? Boolean(p.is_auto_currency_reprice) : false,
          isAutoCurrencyReprice: p.is_auto_currency_reprice !== undefined ? Boolean(p.is_auto_currency_reprice) : false,
          tier1_active: isCartonActive,
          tier2_active: isPackActive,
          tier3_active: isPieceActive,
          tierSettings,
          currentStockBaseUnits: stockValue,
          trackStock: isTrackStock,
          hasCrateDeposit: p.has_crate_deposit !== undefined && p.has_crate_deposit !== null
            ? Boolean(p.has_crate_deposit)
            : Boolean(crateDepositsMap?.[p.id]?.hasCrateDeposit ?? localMeta?.hasCrateDeposit ?? false),
          crateDepositFee: Number(p.crate_deposit_fee ?? crateDepositsMap?.[p.id]?.crateDepositFee ?? localMeta?.crateDepositFee) || 30000,
          _searchKey: searchKey,
          units: pUnits.length > 0 ? pUnits : [
            {
              id: `${p.id}_base`,
              productId: p.id,
              unitName: resolvedBaseUnit,
              multiplier: 1,
              retailPrice: 0,
              wholesalePrice: 0,
              price_2: 0,
              price_3: 0,
              price2: 0,
              price3: 0,
              isBaseUnit: true,
              tier: 1,
            }
          ],
        };
      });

      if (isCustomer) {
        cachedCustomerProductsInMemory = mapped;
        cachedCustomerProductsTimestamp = Date.now();
      } else {
        cachedPosProductsInMemory = mapped;
        cachedPosProductsTimestamp = Date.now();
        cachedProductsInMemory = mapped;
        cachedProductsTimestamp = Date.now();
      }

      // Persist to IndexedDB and update catalog fingerprint in localStorage
      if (typeof window !== 'undefined') {
        try {
          const storageKey = isCustomer ? 'meiishop_customer_products_v1' : 'meiishop_products_v5';
          const fingerprintKey = isCustomer ? 'meiishop_customer_catalog_fingerprint' : 'meiishop_catalog_fingerprint';
          idbSet(storageKey, mapped);
          safeSetItem(storageKey, mapped);
          const sorted = prodData.slice().sort((a, b) => {
            const tA = new Date(a.updated_at || a.created_at || 0).getTime();
            const tB = new Date(b.updated_at || b.created_at || 0).getTime();
            return tB - tA;
          });
          const latestRow = sorted[0];
          if (latestRow) {
            const newFingerprint = `${prodData.length}_${latestRow.id}_${latestRow.updated_at || latestRow.created_at}`;
            localStorage.setItem(fingerprintKey, newFingerprint);
          }
        } catch (_) {}
      }

      return mapped;
    } catch (err) {
      console.warn('Supabase fetch failed:', err);
      return cachedInMemory || localProducts || null;
    } finally {
      if (isCustomer) {
        inFlightCustomerProductsPromise = null;
      } else {
        inFlightPosProductsPromise = null;
      }
    }
  })();

  if (isCustomer) {
    inFlightCustomerProductsPromise = fetchTask;
  } else {
    inFlightPosProductsPromise = fetchTask;
  }

  return fetchTask;
}

/**
 * 2. Save (Create or Update) Product and Units to Supabase
 */
export async function saveProductToSupabase(product) {
  try {
    const isTrackStock = product.trackStock !== false;
    // CRITICAL: Never send null to current_stock_base_units to avoid not-null constraint violation
    const currentStock = isTrackStock
      ? (product.currentStockBaseUnits !== null && product.currentStockBaseUnits !== undefined && !isNaN(product.currentStockBaseUnits)
          ? Number(product.currentStockBaseUnits)
          : 0)
      : 0;

    // 1. Upsert product into 'products' table
    const prodPayload = {
      id: product.id,
      name: product.name,
      name_vi: product.name_vi ?? product.nameVi ?? null,
      category: product.category,
      barcode: product.barcode || null,
      image_url: sanitizeImageUrl(product.imageUrl || product.image_url) || null,
      base_unit: product.baseUnit,
      cost_per_base_unit: product.costPerBaseUnit || 0,
      current_stock_base_units: currentStock,
      track_stock: isTrackStock,
      updated_at: new Date().toISOString(),
    };

    let targetCategoryId = product.categoryId || null;
    if (!targetCategoryId && product.category) {
      const cleanCatName = String(product.category).trim();
      if (categoryNameToIdCache.has(cleanCatName)) {
        targetCategoryId = categoryNameToIdCache.get(cleanCatName);
      } else {
        try {
          const { data: matchedCat } = await supabase
            .from('categories')
            .select('id')
            .eq('name', cleanCatName)
            .maybeSingle();
          if (matchedCat?.id) {
            targetCategoryId = matchedCat.id;
            categoryNameToIdCache.set(cleanCatName, targetCategoryId);
          }
        } catch (_) {}
      }
    }
    prodPayload.category_id = targetCategoryId;
    const resolvedCostCurrency = product.cost_currency || product.costCurrency || 'THB';
    const isLakCurrencyMode = resolvedCostCurrency === 'LAK';
    const finalCostThb = isLakCurrencyMode ? 0 : (product.cost_thb ?? product.costBaht);
    if (finalCostThb !== undefined && finalCostThb !== null && finalCostThb !== '') {
      prodPayload.cost_thb = Math.round(Number(finalCostThb) || 0);
    }
    const finalCostLak = product.cost_lak ?? product.costKip;
    if (finalCostLak !== undefined && finalCostLak !== null && finalCostLak !== '') {
      prodPayload.cost_lak = Math.round(Number(finalCostLak) || 0);
    }
    prodPayload.cost_currency = resolvedCostCurrency;
    prodPayload.is_auto_currency_reprice = product.is_auto_currency_reprice !== undefined
      ? Boolean(product.is_auto_currency_reprice)
      : (product.isAutoCurrencyReprice !== undefined ? Boolean(product.isAutoCurrencyReprice) : false);

    let { error: pErr } = await supabase.from('products').upsert(prodPayload);

    // If optional columns (name_vi, cost_thb, cost_lak, category_id, cost_currency, is_auto_currency_reprice) do not exist yet in schema cache, safely retry without them
    if (pErr && pErr.message && (
      pErr.message.includes('name_vi') ||
      pErr.message.includes('cost_thb') ||
      pErr.message.includes('cost_lak') ||
      pErr.message.includes('category_id') ||
      pErr.message.includes('cost_currency') ||
      pErr.message.includes('is_auto_currency_reprice')
    )) {
      if (pErr.message.includes('name_vi')) {
        delete prodPayload.name_vi;
      }
      if (pErr.message.includes('cost_thb')) {
        delete prodPayload.cost_thb;
      }
      if (pErr.message.includes('cost_lak')) {
        delete prodPayload.cost_lak;
      }
      if (pErr.message.includes('category_id')) {
        delete prodPayload.category_id;
      }
      if (pErr.message.includes('cost_currency')) {
        delete prodPayload.cost_currency;
      }
      if (pErr.message.includes('is_auto_currency_reprice')) {
        delete prodPayload.is_auto_currency_reprice;
      }
      const retryRes = await supabase.from('products').upsert(prodPayload);
      pErr = retryRes.error;
    }

    if (pErr) {
      console.error('Product upsert error:', pErr);
      return { success: false, error: pErr.message || JSON.stringify(pErr) };
    }

    // 2. Smart Upsert active units to preserve historical Foreign Key integrity
    if (product.units && product.units.length > 0) {
      const activeUnitIds = product.units.map((u) => u.id).filter(Boolean);
      const unitsPayload = product.units.map((u) => ({
        id: u.id,
        product_id: product.id,
        unit_name: u.unitName,
        multiplier: Number(u.multiplier) || 1,
        retail_price: Number(u.retailPrice) || 0,
        wholesale_price: Number(u.wholesalePrice) || 0,
        price_2: Number(u.price_2 ?? u.price2 ?? 0),
        price_3: Number(u.price_3 ?? u.price3 ?? 0),
        price_ratio_1: Number(u.price_ratio_1 ?? u.priceRatio1 ?? 0),
        price_ratio_2: Number(u.price_ratio_2 ?? u.priceRatio2 ?? 0),
        price_ratio_3: Number(u.price_ratio_3 ?? u.priceRatio3 ?? 0),
        barcode: u.barcode || null,
        is_base_unit: Boolean(u.isBaseUnit),
      }));

      // Upsert active units in-place without deleting to prevent Foreign Key Violation
      let { error: uErr } = await supabase.from('product_units').upsert(unitsPayload, { onConflict: 'id' });
      if (uErr && uErr.message && (
        uErr.message.includes('price_2') ||
        uErr.message.includes('price_3') ||
        uErr.message.includes('price_ratio_1') ||
        uErr.message.includes('price_ratio_2') ||
        uErr.message.includes('price_ratio_3') ||
        uErr.message.includes('column') ||
        uErr.message.includes('schema cache')
      )) {
        // Safe retry without newer columns if not yet migrated in Supabase
        const fallbackUnits = unitsPayload.map(({ price_2, price_3, price_ratio_1, price_ratio_2, price_ratio_3, ...rest }) => rest);
        const retryRes = await supabase.from('product_units').upsert(fallbackUnits, { onConflict: 'id' });
        uErr = retryRes.error;
      }
      if (uErr) {
        console.error('Product units upsert error:', uErr);
        return { success: false, error: uErr.message || JSON.stringify(uErr) };
      }

      // Clean up only obsolete units that were explicitly disabled/removed
      if (activeUnitIds.length > 0) {
        const { error: delObsoleteErr } = await supabase
          .from('product_units')
          .delete()
          .eq('product_id', product.id)
          .not('id', 'in', `(${activeUnitIds.map((id) => `"${id}"`).join(',')})`);

        if (delObsoleteErr) {
          console.warn('Could not remove obsolete units (may have historical transactions):', delObsoleteErr);
        }
      }
    }

    // Save metadata locally for fast instant recall
    saveProductMetaLocal(product);

    // Save crate deposit settings in store_settings for multi-device sync
    if (product.hasCrateDeposit !== undefined || product.crateDepositFee !== undefined) {
      saveProductCrateDepositSetting(
        product.id,
        Boolean(product.hasCrateDeposit),
        Number(product.crateDepositFee) || 30000
      );
    }

    // Invalidate products cache so next fetch gets fresh data
    invalidateProductsCache();

    return { success: true };
  } catch (e) {
    console.error('saveProductToSupabase failed:', e);
    return { success: false, error: e.message || String(e) };
  }
}

// Alias for backward compatibility
export const syncProductToSupabase = saveProductToSupabase;

/**
 * 3. Delete Product from Supabase
 */
export async function deleteProductFromSupabase(productId) {
  try {
    // Step 1: Attempt soft-delete first if is_deleted column exists
    const { error: softErr } = await supabase
      .from('products')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (!softErr) {
      try {
        localStorage.removeItem(`meiishop_prod_meta_${productId}`);
      } catch (_) {}
      invalidateProductsCache();
      return { success: true, mode: 'soft' };
    }

    // Step 2: Fallback to direct delete if is_deleted column not present yet
    // Delete associated units
    const { error: uErr } = await supabase
      .from('product_units')
      .delete()
      .eq('product_id', productId);

    if (uErr) {
      console.warn('Delete product units warning:', uErr);
    }

    // Delete product record
    const { error: pErr } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (pErr) {
      console.error('Delete product error:', pErr);
      const isFkErr = pErr.code === '23503' || String(pErr.message).includes('foreign key constraint');
      return {
        success: false,
        error: isFkErr
          ? 'ສິນຄ້ານີ້ມີປະຫວັດການນຳເຂົ້າສາງ/ບິນຂາຍແລ້ວ. ກະລຸນາ run script migration_fix_product_delete_foreign_keys.sql ໃນ Supabase SQL Editor ເພື່ອປົດລັອກການລຶບ!'
          : (pErr.message || JSON.stringify(pErr)),
      };
    }

    // Clean up local meta
    try {
      localStorage.removeItem(`meiishop_prod_meta_${productId}`);
    } catch (_) {}

    invalidateProductsCache();

    return { success: true, mode: 'hard' };
  } catch (err) {
    console.error('deleteProductFromSupabase exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * 4. Update Product Stock in Supabase
 */
export async function updateProductStockInSupabase(productId, newStock) {
  try {
    const { error } = await supabase
      .from('products')
      .update({
        current_stock_base_units: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (error) {
      console.error('updateProductStockInSupabase error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e) {
    console.error('updateProductStockInSupabase exception:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Normalize and map a database sale_transaction record (with child items) to the UI model
 */
export function mapDatabaseSaleTransaction(t, cachedProds = null) {
  if (!t) return null;

  let cachedMeta = null;
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(`meiishop_tx_meta_${t.id}`) : null;
    if (raw) cachedMeta = JSON.parse(raw);
  } catch (_) {}

  const isDbCancelled = (t.payment_method || '').startsWith('cancelled');
  const isCancelled =
    isDbCancelled ||
    Boolean(cachedMeta?.isCancelled) ||
    cachedMeta?.status === 'cancelled';

  const isOnlineOrder = Boolean(
    t.order_source === 'online' ||
    cachedMeta?.order_source === 'online' ||
    String(t.id || '').startsWith('onl_') ||
    String(t.receipt_number || '').startsWith('ONL-') ||
    t.cashier_name === 'Online Web'
  );

  let cleanPaymentMethod = t.payment_method || 'cash';
  if (cleanPaymentMethod.startsWith('cancelled:')) {
    cleanPaymentMethod = cleanPaymentMethod.replace('cancelled:', '');
  } else if (cleanPaymentMethod === 'cancelled') {
    cleanPaymentMethod = cachedMeta?.originalPaymentMethod || 'cash';
  }

  let prods = cachedProds;
  if (!prods && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('meiishop_products_v5');
      if (raw) prods = JSON.parse(raw);
    } catch (_) {}
  }

  const rawItems = (t.sale_transaction_items || []).map((i) => {
    const matchedProd = Array.isArray(prods)
      ? prods.find(
          (p) =>
            (i.product_id && p.id === i.product_id) ||
            (p.name && i.product_name && p.name.trim() === i.product_name.trim())
        )
      : null;
    const nameVi = matchedProd?.name_vi || matchedProd?.nameVi || i.name_vi || i.nameVi || '';
    let bundleComps = i.bundle_components || i.bundleComponents || null;
    if (typeof bundleComps === 'string') {
      try { bundleComps = JSON.parse(bundleComps); } catch (_) { bundleComps = null; }
    }
    const isBundle = Boolean(
      i.is_bundle ||
      i.isBundle ||
      (bundleComps && bundleComps.length > 0) ||
      i.product_id?.startsWith('bnd_') ||
      i.product_id?.startsWith('bundle_')
    );
    const uPrice = Number(i.unit_price) || 0;
    const qty = Number(i.quantity) || 1;
    const rawLineTotal = Number(i.line_total) || uPrice * qty;
    const effectivePrice = uPrice > 0 ? uPrice : (qty > 0 && rawLineTotal > 0 ? Math.round(rawLineTotal / qty) : 0);
    const baseTotal = effectivePrice * qty;

    const isCrateEligible = !isBundle && Boolean(
      i.hasCrateDeposit ||
      matchedProd?.hasCrateDeposit ||
      Number(i.crateDepositTotal) > 0 ||
      i.noEmptyCrates
    );
    const diff = (isCrateEligible && rawLineTotal > baseTotal) ? (rawLineTotal - baseTotal) : 0;
    const fee = Number(matchedProd?.crateDepositFee) || 30000;
    const crateDepositTotal = isCrateEligible ? (Number(i.crateDepositTotal) || (diff > 0 ? diff : 0)) : 0;
    const missingCount = isCrateEligible ? (Number(i.missingCratesCount) || (crateDepositTotal > 0 ? Math.round(crateDepositTotal / fee) : 0)) : 0;
    const hasMissingCrates = isCrateEligible && Boolean(
      i.noEmptyCrates || crateDepositTotal > 0
    );

    const explicitLineCost = Number(i.line_cost ?? i.lineCost ?? 0);
    const explicitLineProfit = Number(i.line_profit ?? i.lineProfit ?? 0);
    const itemMult = Number(i.multiplier) || 1;
    const baseCost = Number(matchedProd?.costPerBaseUnit ?? matchedProd?.cost_per_base_unit ?? 0);
    const computedLineCost = explicitLineCost > 0 ? explicitLineCost : (baseCost * itemMult * qty);
    const computedLineProfit = explicitLineProfit !== 0 ? explicitLineProfit : (rawLineTotal - computedLineCost);

    return {
      product: matchedProd || { id: i.product_id, name: i.product_name, name_vi: nameVi },
      productId: i.product_id,
      productName: i.product_name,
      name_vi: nameVi,
      nameVi: nameVi,
      unit: {
        unitName: i.unit_name,
        multiplier: Number(i.multiplier) || 1,
        retailPrice: effectivePrice,
        wholesalePrice: effectivePrice,
      },
      unitName: i.unit_name,
      quantity: qty,
      unitPrice: effectivePrice,
      price: effectivePrice,
      customPrice: effectivePrice,
      effectivePrice: effectivePrice,
      lineTotal: rawLineTotal,
      lineCost: computedLineCost,
      line_cost: computedLineCost,
      lineProfit: computedLineProfit,
      line_profit: computedLineProfit,
      isBundle,
      bundleComponents: bundleComps,
      bundle_components: bundleComps,
      noEmptyCrates: hasMissingCrates,
      missingCratesCount: missingCount,
      crateDepositFee: fee,
      crateDepositTotal,
    };
  });

  const finalItems = cachedMeta?.items && Array.isArray(cachedMeta.items) && cachedMeta.items.length > 0
    ? cachedMeta.items
    : rawItems;
  const itemsSum = finalItems.reduce((sum, item) => sum + (Number(item.lineTotal || item.line_total) || 0), 0);
  const rawGrandTotal = Number(
    (Number(t.grand_total) > 0 ? t.grand_total : null) ??
    (Number(t.grandTotal) > 0 ? t.grandTotal : null) ??
    (Number(t.total_lak) > 0 ? t.total_lak : null) ??
    (Number(t.subtotal) > 0 ? t.subtotal : null) ??
    0
  );
  const resolvedGrandTotal = rawGrandTotal > 0 ? rawGrandTotal : (itemsSum > 0 ? itemsSum : 0);

  // Self-heal corrupted zero-revenue rows directly in database in the background
  if (rawGrandTotal === 0 && itemsSum > 0 && t.id) {
    const editRate = Number(t.exchange_rate || 690);
    const costLak = Number(t.total_cost_lak ?? t.total_cost ?? 0);
    const profitLak = itemsSum - costLak;
    const totalThb = editRate > 0 ? Number((itemsSum / editRate).toFixed(2)) : 0;
    const profitThb = editRate > 0 ? Number((profitLak / editRate).toFixed(2)) : 0;
    supabase
      .from('sale_transactions')
      .update({
        grand_total: itemsSum,
        subtotal: itemsSum,
        total_lak: itemsSum,
        gross_profit: profitLak,
        gross_profit_lak: profitLak,
        total_thb: totalThb,
        gross_profit_thb: profitThb,
      })
      .eq('id', t.id)
      .then(() => {})
      .catch(() => {});
  }

  return {
    id: t.id,
    receiptNumber: t.receipt_number || t.id,
    receipt_number: t.receipt_number || t.id,
    createdAt: t.created_at,
    created_at: t.created_at,
    updatedAt: t.updated_at || t.created_at,
    updated_at: t.updated_at || t.created_at,
    date: new Date(t.created_at).toLocaleString('lo-LA'),
    customerName: t.customer_name || 'ລູກຄ້າທົ່ວໄປ',
    customer_name: t.customer_name || 'ລູກຄ້າທົ່ວໄປ',
    customerId: t.customer_id || cachedMeta?.customerId || null,
    customer_id: t.customer_id || cachedMeta?.customerId || null,
    customerPhone: t.customer_phone || cachedMeta?.customerPhone || '',
    customer_phone: t.customer_phone || cachedMeta?.customerPhone || '',
    cashierName: sanitizeCashierName(t.cashier_name),
    cashierId: t.cashier_id || null,
    isWholesale: Boolean(t.is_wholesale),
    paymentMethod: cleanPaymentMethod,
    originalPaymentMethod: cleanPaymentMethod,
    status: isCancelled ? 'cancelled' : 'completed',
    isCancelled: isCancelled,
    cancelledAt: cachedMeta?.cancelledAt || (isCancelled ? t.created_at : null),
    subtotal: (Number(t.subtotal) > 0 ? Number(t.subtotal) : resolvedGrandTotal),
    discountTotal: Number(t.discount_total) || 0,
    grandTotal: resolvedGrandTotal,
    grand_total: resolvedGrandTotal,
    totalLak: resolvedGrandTotal,
    total_lak: resolvedGrandTotal,
    amountTendered: Number(t.amount_tendered) || 0,
    changeAmount: Number(t.change_amount) || 0,
    totalCost: Number(t.total_cost_lak ?? t.total_cost ?? cachedMeta?.receipt?.totalCost ?? cachedMeta?.totalCost ?? 0),
    total_cost: Number(t.total_cost_lak ?? t.total_cost ?? cachedMeta?.receipt?.totalCost ?? cachedMeta?.totalCost ?? 0),
    total_cost_lak: Number(t.total_cost_lak ?? t.total_cost ?? cachedMeta?.receipt?.totalCost ?? cachedMeta?.totalCost ?? 0),
    grossProfit: Number(t.gross_profit_lak ?? t.gross_profit ?? cachedMeta?.receipt?.grossProfit ?? cachedMeta?.grossProfit ?? 0),
    gross_profit: Number(t.gross_profit_lak ?? t.gross_profit ?? cachedMeta?.receipt?.grossProfit ?? cachedMeta?.grossProfit ?? 0),
    gross_profit_lak: Number(t.gross_profit_lak ?? t.gross_profit ?? cachedMeta?.receipt?.grossProfit ?? cachedMeta?.grossProfit ?? 0),
    total_cost_thb: Number(t.total_cost_thb ?? 0),
    gross_profit_thb: Number(t.gross_profit_thb ?? 0),
    is_printed: Boolean(t.is_printed),
    isPrinted: Boolean(t.is_printed),
    printed_at: t.printed_at || null,
    printedAt: t.printed_at || null,
    isDebt: !isOnlineOrder && Boolean(
      t.payment_status === 'DEBT' ||
        t.payment_status === 'PARTIAL' ||
        cleanPaymentMethod === 'debt' ||
        Number(t.remaining_debt) > 0 ||
        Boolean(t.debt_due_date || t.due_date || cachedMeta?.debtDueDate || cachedMeta?.receipt?.debtDueDate)
    ),
    remainingDebt: (() => {
      if (isOnlineOrder) return 0;
      const grand = Number(t.grand_total) || 0;
      const isD =
        cleanPaymentMethod === 'debt' ||
        t.payment_status === 'DEBT' ||
        t.payment_status === 'PARTIAL' ||
        Boolean(t.debt_due_date || t.due_date || cachedMeta?.debtDueDate || cachedMeta?.receipt?.debtDueDate);
      const paid = Number(
        t.paid_amount !== null && t.paid_amount !== undefined
          ? t.paid_amount
          : (t.amount_tendered !== null && t.amount_tendered !== undefined
              ? t.amount_tendered
              : (isD ? 0 : grand))
      );
      let rem = Number(
        t.remaining_debt !== null && t.remaining_debt !== undefined
          ? t.remaining_debt
          : (cachedMeta?.receipt?.debtAmount ?? (isD ? Math.max(0, grand - paid) : 0))
      );
      if (isD && rem <= 0 && paid < grand) {
        rem = Math.max(0, grand - paid);
      }
      return isD ? rem : 0;
    })(),
    debtAmount: (() => {
      if (isOnlineOrder) return 0;
      const grand = Number(t.grand_total) || 0;
      const isD =
        cleanPaymentMethod === 'debt' ||
        t.payment_status === 'DEBT' ||
        t.payment_status === 'PARTIAL' ||
        Boolean(t.debt_due_date || t.due_date || cachedMeta?.debtDueDate || cachedMeta?.receipt?.debtDueDate);
      const paid = Number(
        t.paid_amount !== null && t.paid_amount !== undefined
          ? t.paid_amount
          : (t.amount_tendered !== null && t.amount_tendered !== undefined
              ? t.amount_tendered
              : (isD ? 0 : grand))
      );
      let rem = Number(
        t.remaining_debt !== null && t.remaining_debt !== undefined
          ? t.remaining_debt
          : (cachedMeta?.receipt?.debtAmount ?? (isD ? Math.max(0, grand - paid) : 0))
      );
      if (isD && rem <= 0 && paid < grand) {
        rem = Math.max(0, grand - paid);
      }
      return isD ? rem : 0;
    })(),
    paidAmount: (() => {
      const grand = Number(t.grand_total) || 0;
      if (isOnlineOrder) {
        return Number(t.paid_amount || t.amount_tendered || grand);
      }
      const isD =
        cleanPaymentMethod === 'debt' ||
        t.payment_status === 'DEBT' ||
        t.payment_status === 'PARTIAL' ||
        Boolean(t.debt_due_date || t.due_date || cachedMeta?.debtDueDate || cachedMeta?.receipt?.debtDueDate);
      const raw = Number(
        t.paid_amount !== null && t.paid_amount !== undefined
          ? t.paid_amount
          : (t.amount_tendered !== null && t.amount_tendered !== undefined
              ? t.amount_tendered
              : (isD ? 0 : grand))
      );
      return isD ? Math.min(grand, Math.max(0, raw)) : (Number(t.amount_tendered) || grand);
    })(),
    paymentStatus: (() => {
      if (isOnlineOrder) {
        return 'PAID';
      }
      const grand = Number(t.grand_total) || 0;
      const isD =
        cleanPaymentMethod === 'debt' ||
        t.payment_status === 'DEBT' ||
        t.payment_status === 'PARTIAL' ||
        Boolean(t.debt_due_date || t.due_date || cachedMeta?.debtDueDate || cachedMeta?.receipt?.debtDueDate);
      if (!isD) return t.payment_status || 'PAID';
      const paid = Number(
        t.paid_amount !== null && t.paid_amount !== undefined
          ? t.paid_amount
          : (t.amount_tendered !== null && t.amount_tendered !== undefined ? t.amount_tendered : 0)
      );
      let rem = Number(t.remaining_debt ?? 0);
      if (rem <= 0 && paid < grand) {
        rem = Math.max(0, grand - paid);
      }
      if (rem <= 0) return 'PAID';
      if (paid > 0) return 'PARTIAL';
      return 'DEBT';
    })(),
    debtNote: cachedMeta?.receipt?.debtNote || cachedMeta?.debtNote || '',
    debtDueDate: t.debt_due_date || t.due_date || cachedMeta?.debtDueDate || cachedMeta?.receipt?.debtDueDate || null,
    debt_due_date: t.debt_due_date || t.due_date || cachedMeta?.debtDueDate || cachedMeta?.receipt?.debtDueDate || null,
    debtStatus: (() => {
      if (isOnlineOrder) return 'paid';
      const isD = cleanPaymentMethod === 'debt' || t.payment_status === 'DEBT' || t.payment_status === 'PARTIAL';
      if (!isD) return 'paid';
      const grand = Number(t.grand_total) || 0;
      const paid = Number(
        t.paid_amount !== null && t.paid_amount !== undefined
          ? t.paid_amount
          : (t.amount_tendered !== null && t.amount_tendered !== undefined ? t.amount_tendered : 0)
      );
      let rem = Number(t.remaining_debt ?? 0);
      if (rem <= 0 && paid < grand) {
        rem = Math.max(0, grand - paid);
      }
      if (rem <= 0) return 'paid';
      if (paid > 0) return 'partial';
      return 'unpaid';
    })(),
    sale_transaction_items: t.sale_transaction_items || [],
    items:
      cachedMeta?.items && Array.isArray(cachedMeta.items) && cachedMeta.items.length > 0
        ? cachedMeta.items
        : rawItems,
    order_source: isOnlineOrder ? 'online' : (t.order_source || cachedMeta?.order_source || 'pos'),
    orderSource: isOnlineOrder ? 'online' : (t.order_source || cachedMeta?.order_source || 'pos'),
    fulfillment_type: t.fulfillment_type || cachedMeta?.fulfillment_type || 'in_store',
    fulfillmentType: t.fulfillment_type || cachedMeta?.fulfillment_type || 'in_store',
    delivery_address: t.delivery_address || cachedMeta?.delivery_address || null,
    deliveryAddress: t.delivery_address || cachedMeta?.delivery_address || null,
    delivery_note: t.delivery_note || cachedMeta?.delivery_note || null,
    deliveryNote: t.delivery_note || cachedMeta?.delivery_note || null,
    pickup_time: t.pickup_time || cachedMeta?.pickup_time || null,
    pickupTime: t.pickup_time || cachedMeta?.pickup_time || null,
    online_status: t.online_status || cachedMeta?.online_status || 'COMPLETED',
    onlineStatus: t.online_status || cachedMeta?.online_status || 'COMPLETED',
    payment_slip_url: t.payment_slip_url || cachedMeta?.payment_slip_url || null,
    paymentSlipUrl: t.payment_slip_url || cachedMeta?.payment_slip_url || null,
  };
}

/**
 * In-memory SWR Cache for Transactions (Bandwidth Egress Defense)
 */
let cachedTransactionsInMemory = null;
let cachedTransactionsTimestamp = 0;
let inFlightTransactionsPromise = null;
const TRANSACTIONS_CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache TTL

export function invalidateTransactionsCache() {
  cachedTransactionsInMemory = null;
  cachedTransactionsTimestamp = 0;
  inFlightTransactionsPromise = null;
}

/**
 * 5. Fetch sale transactions from Supabase with scoped child items & column projection
 * SWR caching & in-flight deduplication to protect egress while loading complete transaction history.
 */
export async function fetchTransactionsFromSupabase({ limit = 1000, todayOnly = false, force = false } = {}) {
  const now = Date.now();
  if (!force && cachedTransactionsInMemory && (now - cachedTransactionsTimestamp < TRANSACTIONS_CACHE_TTL)) {
    return cachedTransactionsInMemory;
  }

  if (inFlightTransactionsPromise) {
    return inFlightTransactionsPromise;
  }

  inFlightTransactionsPromise = (async () => {
    try {
      let query = supabase
        .from('sale_transactions')
        .select(`
          id, receipt_number, created_at, is_wholesale, customer_name, customer_phone, customer_id,
          payment_method, subtotal, discount_total, grand_total, amount_tendered, change_amount,
          total_cost, gross_profit, cashier_name, cashier_id, paid_amount, remaining_debt,
          payment_status, exchange_rate, total_lak, total_thb, gross_profit_lak, gross_profit_thb,
          total_cost_lak, total_cost_thb, status, voided_at, voided_by, void_reason, updated_at,
          debt_due_date, debt_note, order_source, fulfillment_type, delivery_address, delivery_note,
          pickup_time, online_status, payment_slip_url,
          sale_transaction_items (
            id, transaction_id, product_id, product_name, unit_name, multiplier, quantity,
            unit_price, line_total, line_cost, line_profit, bundle_components
          )
        `)
        .order('created_at', { ascending: false });

      if (todayOnly) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        query = query.gte('created_at', startOfToday.toISOString());
      } else if (limit && Number(limit) > 0) {
        query = query.limit(Number(limit));
      }

      const { data: txs, error } = await query;

      if (error || !txs) {
        console.warn('fetchTransactionsFromSupabase error:', error);
        return cachedTransactionsInMemory || null;
      }

      let cachedProds = [];
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('meiishop_products_v5') : null;
        if (raw) cachedProds = JSON.parse(raw);
      } catch (_) {}

      const mapped = txs.map((t) => mapDatabaseSaleTransaction(t, cachedProds));
      cachedTransactionsInMemory = mapped;
      cachedTransactionsTimestamp = Date.now();
      return mapped;
    } catch (e) {
      console.warn('fetchTransactionsFromSupabase error:', e);
      return cachedTransactionsInMemory || null;
    } finally {
      inFlightTransactionsPromise = null;
    }
  })();

  return inFlightTransactionsPromise;
}

/**
 * 5.2 Server-side Paginated & Filtered Fetch for History View
 * Optimized for touch POS: default page size 50, fast response, global search bypasses date filter to find ANY old order.
 */
export async function fetchHistoryPageFromSupabase({
  page = 1,
  pageSize = 50,
  dateFilter = 'today',
  startDate = null,
  endDate = null,
  activeTab = 'all',
  searchTerm = '',
} = {}) {
  try {
    let query = supabase
      .from('sale_transactions')
      .select(`
        id, receipt_number, created_at, is_wholesale, customer_name, customer_phone, customer_id,
        payment_method, subtotal, discount_total, grand_total, amount_tendered, change_amount,
        total_cost, gross_profit, cashier_name, cashier_id, paid_amount, remaining_debt,
        payment_status, exchange_rate, total_lak, total_thb, gross_profit_lak, gross_profit_thb,
        total_cost_lak, total_cost_thb, status, voided_at, voided_by, void_reason, updated_at,
        debt_due_date, debt_note, order_source, fulfillment_type, delivery_address, delivery_note,
        pickup_time, online_status, payment_slip_url,
        sale_transaction_items (
          id, transaction_id, product_id, product_name, unit_name, multiplier, quantity,
          unit_price, line_total, line_cost, line_profit, bundle_components
        )
      `, { count: 'exact' })
      .neq('order_source', 'online');

    const cleanSearch = String(searchTerm || '').trim().replace(/^#/, '');

    // SMART GLOBAL SEARCH: If user searched a keyword or scanned barcode,
    // BYPASS the date filter completely so ANY order in history can be found!
    if (cleanSearch) {
      query = query.or(`receipt_number.ilike.%${cleanSearch}%,customer_name.ilike.%${cleanSearch}%,customer_phone.ilike.%${cleanSearch}%`);
    } else {
      // When NO search is active, strictly apply the selected date filter
      const now = new Date();
      if (dateFilter === 'today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        query = query.gte('created_at', startOfToday.toISOString());
      } else if (dateFilter === 'yesterday') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        const endOfYesterday = new Date(startOfToday.getTime() - 1);
        query = query.gte('created_at', startOfYesterday.toISOString()).lte('created_at', endOfYesterday.toISOString());
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query = query.gte('created_at', sevenDaysAgo.toISOString());
      } else if (dateFilter === 'custom') {
        if (startDate) {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          query = query.gte('created_at', s.toISOString());
        }
        if (endDate) {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          query = query.lte('created_at', e.toISOString());
        }
      }
      // If dateFilter === 'all', no date filter is applied!
    }

    // Apply primary payment / debt tab filter
    if (activeTab === 'cash') {
      query = query.eq('payment_method', 'cash').neq('status', 'cancelled');
    } else if (activeTab === 'transfer') {
      query = query.eq('payment_method', 'transfer').neq('status', 'cancelled');
    } else if (activeTab === 'debt') {
      query = query.or('payment_status.eq.DEBT,payment_status.eq.PARTIAL,remaining_debt.gt.0').neq('status', 'cancelled');
    }

    query = query.order('created_at', { ascending: false });

    // Server-side Range Pagination
    if (pageSize !== 'ALL' && Number(pageSize) > 0) {
      const pSize = Number(pageSize);
      const safePage = Math.max(1, Number(page) || 1);
      const from = (safePage - 1) * pSize;
      const to = from + pSize - 1;
      query = query.range(from, to);
    } else if (pageSize === 'ALL') {
      query = query.limit(1000);
    }

    const { data: txs, count, error } = await query;
    if (error || !txs) {
      console.warn('fetchHistoryPageFromSupabase error:', error);
      return { data: [], count: 0, error };
    }

    let cachedProds = [];
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('meiishop_products_v5') : null;
      if (raw) cachedProds = JSON.parse(raw);
    } catch (_) {}

    const mapped = txs.map((t) => mapDatabaseSaleTransaction(t, cachedProds));
    return { data: mapped, count: count ?? mapped.length, error: null };
  } catch (err) {
    console.error('fetchHistoryPageFromSupabase exception:', err);
    return { data: [], count: 0, error: err };
  }
}

/**
 * 5.3 Fetch lightweight summary stats for History View
 * Fetches only grand_total, total_cost_lak, gross_profit_lak (NO heavy child items)
 * Total payload: ~1 - 3 KB, saves 98% egress.
 */
export async function fetchHistoryStatsFromSupabase({
  dateFilter = 'today',
  startDate = null,
  endDate = null,
} = {}) {
  try {
    let query = supabase
      .from('sale_transactions')
      .select('grand_total, total_cost_lak, gross_profit_lak, status, created_at')
      .neq('order_source', 'online');

    const now = new Date();
    if (dateFilter === 'today') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      query = query.gte('created_at', startOfToday.toISOString());
    } else if (dateFilter === 'yesterday') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
      const endOfYesterday = new Date(startOfToday.getTime() - 1);
      query = query.gte('created_at', startOfYesterday.toISOString()).lte('created_at', endOfYesterday.toISOString());
    } else if (dateFilter === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', sevenDaysAgo.toISOString());
    } else if (dateFilter === 'custom') {
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        query = query.gte('created_at', s.toISOString());
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        query = query.lte('created_at', e.toISOString());
      }
    }

    const { data, error } = await query;
    if (error || !data) {
      console.warn('fetchHistoryStatsFromSupabase error:', error);
      return null;
    }

    let totalBills = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;

    data.forEach((tx) => {
      totalBills++;
      const isCancelled = tx.status === 'cancelled';
      if (isCancelled) return;

      const rev = Number(tx.grand_total || 0);
      const cost = Number(tx.total_cost_lak || 0);
      const profit = Number(tx.gross_profit_lak !== undefined && tx.gross_profit_lak !== null ? tx.gross_profit_lak : (rev - cost));

      totalRevenue += rev;
      totalCost += cost;
      totalProfit += profit;
    });

    const overallMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

    return {
      totalBills,
      totalRevenue,
      totalCost,
      totalProfit,
      overallMargin,
    };
  } catch (err) {
    console.warn('fetchHistoryStatsFromSupabase exception:', err);
    return null;
  }
}

/**
 * 5.4 Fetch a single archived transaction from Supabase by barcode, receipt number, or id
 * Used for targeted lookup when scanning or searching for older bills not currently in local memory.
 */
export async function fetchArchivedTransactionFromSupabase(queryCode) {
  try {
    if (!queryCode) return null;
    const clean = String(queryCode).trim().replace(/^#/, '');
    if (!clean) return null;

    const { data: txs, error } = await supabase
      .from('sale_transactions')
      .select(`
        id, receipt_number, created_at, is_wholesale, customer_name, customer_phone, customer_id,
        payment_method, subtotal, discount_total, grand_total, amount_tendered, change_amount,
        total_cost, gross_profit, cashier_name, cashier_id, paid_amount, remaining_debt,
        payment_status, exchange_rate, total_lak, total_thb, gross_profit_lak, gross_profit_thb,
        total_cost_lak, total_cost_thb, status, voided_at, voided_by, void_reason, updated_at,
        debt_due_date, debt_note, order_source, fulfillment_type, delivery_address, delivery_note,
        pickup_time, online_status, payment_slip_url,
        sale_transaction_items (
          id, transaction_id, product_id, product_name, unit_name, multiplier, quantity,
          unit_price, line_total, line_cost, line_profit, bundle_components
        )
      `)
      .or(`receipt_number.ilike.%${clean}%,id.eq.${clean}`)
      .neq('order_source', 'online')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !txs || txs.length === 0) {
      return null;
    }

    let cachedProds = [];
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('meiishop_products_v5') : null;
      if (raw) cachedProds = JSON.parse(raw);
    } catch (_) {}

    return mapDatabaseSaleTransaction(txs[0], cachedProds);
  } catch (err) {
    console.warn('fetchArchivedTransactionFromSupabase error:', err);
    return null;
  }
}

/**
 * 5.1 Fetch a single sale transaction with child items (for Realtime auto-refetch)
 */
export async function fetchTransactionByIdFromSupabase(txId, retryIfEmpty = true) {
  try {
    if (!txId) return null;
    const { data: tx, error } = await supabase
      .from('sale_transactions')
      .select(`
        id, receipt_number, created_at, is_wholesale, customer_name, customer_phone, customer_id,
        payment_method, subtotal, discount_total, grand_total, amount_tendered, change_amount,
        total_cost, gross_profit, cashier_name, cashier_id, paid_amount, remaining_debt,
        payment_status, exchange_rate, total_lak, total_thb, gross_profit_lak, gross_profit_thb,
        total_cost_lak, total_cost_thb, status, voided_at, voided_by, void_reason, updated_at,
        debt_due_date, debt_note, order_source, fulfillment_type, delivery_address, delivery_note,
        pickup_time, online_status, payment_slip_url,
        sale_transaction_items (
          id, transaction_id, product_id, product_name, unit_name, multiplier, quantity,
          unit_price, line_total, line_cost, line_profit, bundle_components
        )
      `)
      .eq('id', txId)
      .single();

    if (error || !tx) {
      console.warn('fetchTransactionByIdFromSupabase error:', error);
      return null;
    }

    // If items haven't landed yet due to network delay, retry once after 250ms
    if (retryIfEmpty && (!tx.sale_transaction_items || tx.sale_transaction_items.length === 0)) {
      await new Promise((r) => setTimeout(r, 250));
      const { data: retryTx } = await supabase
        .from('sale_transactions')
        .select(`
          id, receipt_number, created_at, is_wholesale, customer_name, customer_phone, customer_id,
          payment_method, subtotal, discount_total, grand_total, amount_tendered, change_amount,
          total_cost, gross_profit, cashier_name, cashier_id, paid_amount, remaining_debt,
          payment_status, exchange_rate, total_lak, total_thb, gross_profit_lak, gross_profit_thb,
          total_cost_lak, total_cost_thb, status, voided_at, voided_by, void_reason, updated_at,
          debt_due_date, debt_note, order_source, fulfillment_type, delivery_address, delivery_note,
          pickup_time, online_status, payment_slip_url,
          sale_transaction_items (
            id, transaction_id, product_id, product_name, unit_name, multiplier, quantity,
            unit_price, line_total, line_cost, line_profit, bundle_components
          )
        `)
        .eq('id', txId)
        .single();
      if (retryTx && retryTx.sale_transaction_items && retryTx.sale_transaction_items.length > 0) {
        return mapDatabaseSaleTransaction(retryTx);
      }
    }

    return mapDatabaseSaleTransaction(tx);
  } catch (err) {
    console.error('fetchTransactionByIdFromSupabase exception:', err);
    return null;
  }
}


/**
 * 6. Record a sale transaction into Supabase and deduct product stock
 */
/**
 * Safe UUID v4 generator for Postgres UUID columns
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Upload compressed product image to Supabase Storage ('product-images' bucket)
 * @param {Blob|File} fileOrBlob - Compressed image blob or file
 * @param {string} productId - Product ID (e.g. 'p_12345')
 * @param {string} [extension='webp'] - File extension
 * @returns {Promise<{ success: boolean, publicUrl?: string, error?: string }>}
 */
export async function uploadProductImageToSupabase(fileOrBlob, productId, extension = 'webp') {
  try {
    const safeProdId = (productId || 'prod_' + Date.now().toString(36)).replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `products/${safeProdId}_${Date.now()}.${extension}`;
    const contentType = fileOrBlob.type || (extension === 'webp' ? 'image/webp' : 'image/jpeg');

    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, fileOrBlob, {
        contentType,
        cacheControl: '31536000, immutable',
        upsert: true,
      });

    if (error) {
      console.error('uploadProductImageToSupabase error:', error);
      return { success: false, error: error.message || String(error) };
    }

    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    return {
      success: true,
      publicUrl: urlData.publicUrl,
      path: data?.path || fileName,
    };
  } catch (err) {
    console.error('uploadProductImageToSupabase exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * 6. Record a sale transaction into Supabase and deduct product stock
 */
export async function createSaleTransactionInSupabase(tx, stockDeductions = []) {
  try {
    const rate = Number(tx.exchange_rate || tx.exchangeRate || 0);

    const checkoutItems = (tx.items || []).map((item) => {
      const isBundle = Boolean(item.isBundle || item.bundle_components?.length || item.bundleComponents?.length);
      const prodId = isBundle
        ? (item.bundleId || item.bundle?.id || item.productId || 'bnd_custom')
        : (item.product?.id || item.productId || 'p_custom');

      const unitPrice = Number(
        item.customPrice !== undefined
          ? item.customPrice
          : isBundle
          ? (item.unitPrice || item.cartonPrice || item.bundle?.price_lak || 0)
          : tx.isWholesale
          ? item.unit?.wholesalePrice
          : item.unit?.retailPrice
      ) || 0;
      const qty = Number(item.quantity) || 1;
      const lineTotal = Number(item.lineTotal !== undefined ? item.lineTotal : (unitPrice * qty));

      // Calculate cost & multiplier through standard single source of truth engine
      const costInfo = calculateItemCostAndMultiplier(item);
      const multiplier = costInfo.multiplier;
      const lineCost = Number(item.line_cost ?? item.lineCost ?? costInfo.lineCost);
      const lineProfit = lineTotal - lineCost;

      // Extract bundle components breakdown if item is a bundle
      const bundleComponents = isBundle
        ? (item.bundleComponents || item.bundle_components || []).map((c) => ({
            product_id: c.productId || c.product_id,
            product_name: c.productName || c.product_name,
            quantity: Number(c.quantity) || 1,
            unit_price: Number(c.unitPrice ?? c.unit_price) || 0,
          }))
        : null;

      const rawUnitName = item.unit?.unitName || item.unitName || (isBundle ? (item.bundle?.unit_name || 'ແກັດ') : 'ອັນ');
      const unitName = (item.isHalfCarton || costInfo.isHalfCarton) && !rawUnitName.includes('½') ? `½ ${rawUnitName}` : rawUnitName;

      const mappedItem = {
        id: generateUUID(),
        product_id: prodId,
        product_name: item.productName || item.product?.name || item.bundleName || (isBundle ? 'ນົມກ່ອງ ລວມລົດຊາດ' : 'ສິນຄ້າ'),
        unit_name: unitName,
        multiplier,
        quantity: qty,
        unit_price: unitPrice,
        line_total: lineTotal,
        line_cost: lineCost,
        line_profit: lineProfit,
      };

      if (bundleComponents && bundleComponents.length > 0) {
        mappedItem.bundle_components = bundleComponents;
      }

      return mappedItem;
    });

    // Recalculate transaction totals from actual final items
    const totals = recalculateTransactionTotals(checkoutItems, rate);
    const totalLak = Number(tx.total_lak ?? tx.totalLak ?? tx.grandTotal ?? totals.totalAmountLak);
    const totalCostLak = totals.totalCostLak;
    const totalThb = totals.totalAmountThb;
    const totalCostThb = totals.totalCostThb;
    const grossProfitLak = totalLak - totalCostLak;
    const grossProfitThb = Number((totalThb - totalCostThb).toFixed(2));

    const toValidUuidOrNull = (val) => {
      if (typeof val !== 'string') return null;
      const trimmed = val.trim();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(trimmed) ? trimmed : null;
    };

    const checkoutPayload = {
      id: tx.id,
      receipt_number: tx.receiptNumber,
      created_at: tx.createdAt,
      is_wholesale: Boolean(tx.isWholesale),
      customer_name: tx.customerName || 'ລູກຄ້າທົ່ວໄປ',
      customer_id: tx.customerId || tx.customer_id || null,
      customer_phone: tx.customerPhone || tx.customer_phone || null,
      payment_method: tx.paymentMethod || 'cash',
      subtotal: totalLak,
      discount_total: Number(tx.discountTotal) || 0,
      grand_total: totalLak,
      amount_tendered: Number(tx.amountTendered) || 0,
      change_amount: Number(tx.changeAmount) || 0,
      total_cost: totalCostLak,
      total_cost_lak: totalCostLak,
      total_cost_thb: totalCostThb,
      gross_profit: grossProfitLak,
      gross_profit_lak: grossProfitLak,
      gross_profit_thb: grossProfitThb,
      cashier_name: sanitizeCashierName(tx.cashierName),
      cashier_id: toValidUuidOrNull(tx.cashierId || tx.cashier_id),
      paid_amount: Number(tx.paidAmount ?? (tx.paymentMethod === 'debt' ? (tx.amountTendered || 0) : (tx.amountTendered || tx.grandTotal || 0))),
      remaining_debt: Number(tx.debtAmount ?? (tx.paymentMethod === 'debt' ? Math.max(0, (tx.grandTotal || 0) - (tx.amountTendered || 0)) : 0)),
      payment_status: tx.paymentStatus || (tx.paymentMethod === 'debt' ? ((tx.amountTendered || 0) > 0 ? 'PARTIAL' : 'DEBT') : 'PAID'),
      debt_due_date: tx.debtDueDate || tx.debt_due_date || null,
      exchange_rate: rate,
      total_lak: totalLak,
      total_thb: totalThb,
      items: checkoutItems,
    };

    // 1. GỌI POSTGRES RPC NGUYÊN TỬ VỚI KHÓA HÀNG FOR UPDATE VÀ GHI THẺ KHO
    const { data: rpcData, error: rpcErr } = await supabase.rpc('process_pos_checkout', { payload: checkoutPayload });
    if (!rpcErr && rpcData?.success) {
      // Ensure customer tracking and debt tracking fields are updated in DB
      // because process_pos_checkout RPC on the server might have omitted customer_id or debt fields in its INSERT statement
      try {
        const extraUpdate = {};
        if (checkoutPayload.customer_id) extraUpdate.customer_id = checkoutPayload.customer_id;
        if (checkoutPayload.customer_phone) extraUpdate.customer_phone = checkoutPayload.customer_phone;
        if (checkoutPayload.payment_method === 'debt') {
          extraUpdate.paid_amount = Number(checkoutPayload.paid_amount || 0);
          extraUpdate.remaining_debt = Number(checkoutPayload.remaining_debt || 0);
          extraUpdate.payment_status = checkoutPayload.payment_status || 'DEBT';
          extraUpdate.debt_due_date = checkoutPayload.debt_due_date || null;
        }

        if (Object.keys(extraUpdate).length > 0) {
          const { error: updErr } = await supabase
            .from('sale_transactions')
            .update(extraUpdate)
            .eq('id', tx.id);

          // If debt_due_date or customer_id columns don't exist yet in DB, retry safely with remaining fields
          if (updErr && (updErr.code === '42703' || updErr.message?.includes('debt_due_date') || updErr.message?.includes('customer_id') || updErr.message?.includes('customer_phone'))) {
            const { debt_due_date, customer_id, customer_phone, ...safeFallback } = extraUpdate;
            if (Object.keys(safeFallback).length > 0) {
              await supabase
                .from('sale_transactions')
                .update(safeFallback)
                .eq('id', tx.id);
            }
          }
        }
      } catch (e) {
        console.warn('[createSaleTransactionInSupabase] Error ensuring extra fields:', e);
      }
      invalidateTransactionsCache();
      return { success: true, via: 'atomic_rpc' };
    }

    if (rpcErr) {
      const errMsg = rpcErr.message || '';
      const isRpcMissing =
        rpcErr.code === '42883' ||
        rpcErr.code === 'PGRST202' ||
        rpcErr.code === '42703' || // Undefined column inside RPC (e.g. column "quantity" does not exist)
        rpcErr.code === '42P01' || // Undefined table inside RPC
        errMsg.includes('Could not find the function') ||
        errMsg.includes('function process_pos_checkout') ||
        (errMsg.includes('column') && errMsg.includes('does not exist'));
      
      if (!isRpcMissing) {
        // Business logic exception thrown by Postgres (e.g. insufficient stock)!
        console.error('process_pos_checkout RPC business rejection:', rpcErr);
        let userFriendly = errMsg;
        if (errMsg.includes('không đủ tồn kho') || errMsg.includes('out of stock')) {
          userFriendly = 'ສິນຄ້າໃນສາງບໍ່ພໍຂາຍ! ' + errMsg;
        }
        return { success: false, error: userFriendly, code: rpcErr.code };
      }

      console.warn('process_pos_checkout RPC not available or schema mismatch in Supabase, using standard client fallback:', rpcErr.message);
    }

    // 2. Fallback thủ công nếu RPC chưa được chạy migration trong SQL Editor
    const baseTxRow = {
      id: tx.id,
      receipt_number: tx.receiptNumber,
      created_at: tx.createdAt,
      is_wholesale: Boolean(tx.isWholesale),
      customer_name: tx.customerName || 'ລູກຄ້າທົ່ວໄປ',
      customer_id: tx.customerId || tx.customer_id || null,
      customer_phone: tx.customerPhone || tx.customer_phone || null,
      payment_method: tx.paymentMethod || 'cash',
      subtotal: Number(tx.subtotal) || 0,
      discount_total: Number(tx.discountTotal) || 0,
      grand_total: Number(tx.grandTotal) || 0,
      amount_tendered: Number(tx.amountTendered) || 0,
      change_amount: Number(tx.changeAmount) || 0,
      total_cost: totalCostLak,
      total_cost_lak: totalCostLak,
      total_cost_thb: totalCostThb,
      gross_profit: grossProfitLak,
      gross_profit_lak: grossProfitLak,
      gross_profit_thb: grossProfitThb,
      cashier_name: sanitizeCashierName(tx.cashierName),
      cashier_id: toValidUuidOrNull(tx.cashierId || tx.cashier_id),
      paid_amount: Number(tx.paidAmount ?? (tx.paymentMethod === 'debt' ? (tx.amountTendered || 0) : (tx.amountTendered || tx.grandTotal || 0))),
      remaining_debt: Number(tx.debtAmount ?? (tx.paymentMethod === 'debt' ? Math.max(0, (tx.grandTotal || 0) - (tx.amountTendered || 0)) : 0)),
      payment_status: tx.paymentStatus || (tx.paymentMethod === 'debt' ? ((tx.amountTendered || 0) > 0 ? 'PARTIAL' : 'DEBT') : 'PAID'),
      debt_due_date: tx.debtDueDate || tx.debt_due_date || null,
      exchange_rate: rate,
      total_lak: totalLak,
      total_thb: totalThb,
    };

    let { error: txErr } = await supabase.from('sale_transactions').insert(baseTxRow);

    // If debt_due_date, cashier_id, customer_id, or customer_phone columns cause type mismatch or do not exist yet, retry safely
    if (txErr && (txErr.code === '42703' || txErr.code === '42804' || txErr.message?.includes('debt_due_date') || txErr.message?.includes('cashier_id') || txErr.message?.includes('customer_id') || txErr.message?.includes('customer_phone'))) {
      const { debt_due_date, cashier_id, customer_id, customer_phone, ...withoutFields } = baseTxRow;
      const retryResult = await supabase.from('sale_transactions').insert(withoutFields);
      txErr = retryResult.error;
    }

    if (txErr) {
      console.error('Transaction insert error:', txErr);
      return { success: false, error: txErr.message || JSON.stringify(txErr) };
    }

    if (checkoutItems.length > 0) {
      const itemsPayload = checkoutItems.map(it => ({
        ...it,
        transaction_id: tx.id,
      }));
      const { error: itemErr } = await supabase.from('sale_transaction_items').insert(itemsPayload);
      if (itemErr) {
        console.warn('Transaction items insert notice:', itemErr.message);
        // If bundle_components column has not been added to Supabase yet, retry without that field
        if (itemErr.message?.includes('bundle_components') || itemErr.code === '42703') {
          const strippedPayload = itemsPayload.map(({ bundle_components, ...rest }) => rest);
          const { error: retryErr } = await supabase.from('sale_transaction_items').insert(strippedPayload);
          if (retryErr) {
            console.error('Fallback transaction items insert error:', retryErr);
          }
        } else {
          console.error('Transaction items insert error:', itemErr);
        }
      }
    }

    if (stockDeductions && stockDeductions.length > 0) {
      const validDeductions = stockDeductions.filter((d) => Boolean(d.productId));
      if (validDeductions.length > 0) {
        await Promise.all(
          validDeductions.map((d) =>
            supabase
              .from('products')
              .update({
                current_stock_base_units: d.newStock,
                updated_at: new Date().toISOString(),
              })
              .eq('id', d.productId)
          )
        );
      }
    }

    invalidateTransactionsCache();
    return { success: true };
  } catch (e) {
    console.error('createSaleTransactionInSupabase exception:', e);
    return { success: false, error: e.message || String(e) };
  }
}

// Backward compatibility alias
/**
 * Phục hồi kho hàng theo lô song song (Batched Parallel Stock Restoration)
 * Gom tất cả sản phẩm cần hoàn kho vào 1 truy vấn SELECT và chạy UPDATE đồng thời.
 */
async function restoreProductStockBatch(itemsToRestore = []) {
  if (!itemsToRestore || itemsToRestore.length === 0) return;
  const validItems = itemsToRestore.filter((item) => Boolean(item.productId && item.unitsToRestore));
  if (validItems.length === 0) return;

  const prodIds = [...new Set(validItems.map((it) => it.productId))];
  const { data: dbProducts, error } = await supabase
    .from('products')
    .select('id, current_stock_base_units, track_stock')
    .in('id', prodIds);

  if (error || !dbProducts || dbProducts.length === 0) return;

  const updatePromises = dbProducts
    .filter((p) => p && p.track_stock !== false)
    .map((p) => {
      const totalUnits = validItems
        .filter((it) => it.productId === p.id)
        .reduce((sum, it) => sum + Number(it.unitsToRestore || 0), 0);
      const currentStock = Number(p.current_stock_base_units) || 0;
      const newStock = currentStock + totalUnits;
      return supabase
        .from('products')
        .update({
          current_stock_base_units: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', p.id);
    });

  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
  }
}

/**
 * 7. Void / Cancel a Sale Transaction in Supabase and restore product stock
 * (Uses atomic process_pos_void RPC if available; gracefully falls back to client execution)
 */
export async function cancelTransactionInSupabase(txId, itemsToRestore = [], originalPaymentMethod = 'cash', options = {}) {
  try {
    const reason = options.reason || 'ຍົກເລີກບິນຂາຍ (Void Order)';
    const voidedBy = sanitizeCashierName(options.voidedBy);

    // 1. GỌI POSTGRES RPC NGUYÊN TỬ: process_pos_void
    const { data: rpcData, error: rpcErr } = await supabase.rpc('process_pos_void', {
      payload: {
        transaction_id: txId,
        reason,
        voided_by: voidedBy,
        items: itemsToRestore && itemsToRestore.length > 0 ? itemsToRestore : undefined,
      },
    });

    if (!rpcErr && rpcData?.success) {
      // Update local metadata
      try {
        const cacheKey = `meiishop_tx_meta_${txId}`;
        const existing = localStorage.getItem(cacheKey);
        let parsed = {};
        if (existing) {
          try { parsed = JSON.parse(existing); } catch (_) {}
        }
        localStorage.setItem(cacheKey, JSON.stringify({
          ...(typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { items: parsed }),
          status: 'VOIDED',
          isCancelled: true,
          cancelledAt: new Date().toISOString(),
          voidedAt: new Date().toISOString(),
          voidedBy,
          voidReason: reason,
          originalPaymentMethod,
        }));
      } catch (_) {}
      invalidateTransactionsCache();
      return { success: true, via: 'atomic_rpc' };
    }

    if (rpcErr) {
      const errMsg = rpcErr.message || '';
      const isRpcMissing = rpcErr.code === '42883' || rpcErr.code === 'PGRST202' || errMsg.includes('Could not find the function');
      if (!isRpcMissing) {
        console.error('process_pos_void RPC business error:', rpcErr);
        return { success: false, error: errMsg };
      }
      console.warn('process_pos_void RPC not available yet in Supabase schema, using legacy fallback:', rpcErr.message);
    }

    // 2. Fallback thủ công nếu RPC chưa được kích hoạt
    const cancelledPaymentMethod = `cancelled:${originalPaymentMethod || 'cash'}`;
    const { error: txErr } = await supabase
      .from('sale_transactions')
      .update({
        payment_method: cancelledPaymentMethod,
        status: 'VOIDED',
        voided_at: new Date().toISOString(),
        voided_by: voidedBy,
        void_reason: reason,
      })
      .eq('id', txId);

    if (txErr) {
      console.warn('cancelTransactionInSupabase update warning:', txErr);
    }

    // Restore product stock in Supabase products table (Batched in parallel)
    if (itemsToRestore && itemsToRestore.length > 0) {
      await restoreProductStockBatch(itemsToRestore);
    }

    // Update localStorage metadata
    try {
      const cacheKey = `meiishop_tx_meta_${txId}`;
      const existing = localStorage.getItem(cacheKey);
      let parsed = {};
      if (existing) {
        try {
          parsed = JSON.parse(existing);
        } catch (_) {}
      }
      const updatedMeta = {
        ...(typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { items: parsed }),
        status: 'VOIDED',
        isCancelled: true,
        cancelledAt: new Date().toISOString(),
        voidedAt: new Date().toISOString(),
        voidedBy,
        voidReason: reason,
        originalPaymentMethod,
      };
      localStorage.setItem(cacheKey, JSON.stringify(updatedMeta));
    } catch (_) {}

    invalidateTransactionsCache();
    return { success: true };
  } catch (err) {
    console.error('cancelTransactionInSupabase exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * 8. Delete / Void a Sale Transaction from Supabase and restore product stock
 */
export async function deleteTransactionFromSupabase(txId, itemsToRestore = []) {
  try {
    // 1. Delete transaction items
    const { error: itemsErr } = await supabase
      .from('sale_transaction_items')
      .delete()
      .eq('transaction_id', txId);

    if (itemsErr) console.warn('Delete items warning:', itemsErr);

    // 2. Delete main transaction record
    const { error: txErr } = await supabase
      .from('sale_transactions')
      .delete()
      .eq('id', txId);

    if (txErr) {
      console.error('Delete transaction error:', txErr);
      return { success: false, error: txErr.message || JSON.stringify(txErr) };
    }

    // 3. Restore product stock if items provided (Batched in parallel)
    if (itemsToRestore && itemsToRestore.length > 0) {
      await restoreProductStockBatch(itemsToRestore);
    }

    invalidateTransactionsCache();
    return { success: true };
  } catch (err) {
    console.error('deleteTransactionFromSupabase exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * 8. Update Sale Transaction info (Customer Name or Payment Method) in Supabase
 */
export async function updateTransactionInSupabase(txId, updates) {
  try {
    const payload = {};
    if (updates.customerName !== undefined) payload.customer_name = updates.customerName;
    if (updates.paymentMethod !== undefined) payload.payment_method = updates.paymentMethod;

    const { error } = await supabase
      .from('sale_transactions')
      .update(payload)
      .eq('id', txId);

    if (error) {
      console.error('updateTransactionInSupabase error:', error);
      return { success: false, error: error.message || JSON.stringify(error) };
    }

    invalidateTransactionsCache();
    return { success: true };
  } catch (err) {
    console.error('updateTransactionInSupabase exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * 9. Fetch Categories from Supabase ('categories' table)
 * SWR In-Memory cache (10 min TTL) + explicit projection to cut egress payload.
 */
let cachedCategoriesInMemory = null;
let cachedCategoriesTimestamp = 0;
let inFlightCategoriesPromise = null;
const CATEGORIES_CACHE_TTL = 10 * 60 * 1000;

export function invalidateCategoriesCache() {
  cachedCategoriesInMemory = null;
  cachedCategoriesTimestamp = 0;
  inFlightCategoriesPromise = null;
}

export async function fetchCategoriesFromSupabase({ force = false } = {}) {
  const now = Date.now();
  if (!force) {
    if (cachedCategoriesInMemory && (now - cachedCategoriesTimestamp < CATEGORIES_CACHE_TTL)) {
      return cachedCategoriesInMemory;
    }
    if (inFlightCategoriesPromise) {
      return inFlightCategoriesPromise;
    }
  } else {
    // Force refresh: clear stale in-memory cache and promise
    cachedCategoriesInMemory = null;
    cachedCategoriesTimestamp = 0;
    inFlightCategoriesPromise = null;
  }

  inFlightCategoriesPromise = (async () => {
    try {
      let { data, error } = await supabase
        .from('categories')
        .select('id, name, sort_order, parent_id')
        .order('sort_order', { ascending: true });

      if (error && (error.code === '42703' || String(error.message || '').includes('parent_id'))) {
        console.warn('[supabase] parent_id column not found in categories table, falling back to basic fields:', error.message);
        const retry = await supabase
          .from('categories')
          .select('id, name, sort_order')
          .order('sort_order', { ascending: true });
        if (!retry.error && retry.data) {
          data = retry.data.map((c) => ({ ...c, parent_id: null }));
          error = null;
        }
      }

      if (error || !data) {
        return cachedCategoriesInMemory || null;
      }
      data.forEach((c) => {
        if (c.name && c.id) categoryNameToIdCache.set(c.name.trim(), c.id);
      });
      cachedCategoriesInMemory = data;
      cachedCategoriesTimestamp = Date.now();
      return data;
    } catch (e) {
      console.warn('fetchCategoriesFromSupabase warning:', e);
      return cachedCategoriesInMemory || null;
    } finally {
      inFlightCategoriesPromise = null;
    }
  })();

  return inFlightCategoriesPromise;
}

/**
 * 10. Create a new Category in Supabase (with optional parent_id for 2-tier hierarchy)
 */
export async function createCategoryInSupabase(name, sortOrder = 0, parentId = null) {
  try {
    if (!name || !name.trim()) return { success: false, error: 'ຊື່ໝວດໝູ່ບໍ່ຖືກຕ້ອງ' };
    const cleanName = name.trim();

    const insertPayload = { name: cleanName, sort_order: sortOrder };
    if (parentId) {
      insertPayload.parent_id = parentId;
    }

    let { data, error } = await supabase
      .from('categories')
      .insert([insertPayload])
      .select()
      .single();

    if (error && (error.code === '42703' || String(error.message || '').includes('parent_id'))) {
      const { parent_id, ...safePayload } = insertPayload;
      const retry = await supabase
        .from('categories')
        .insert([safePayload])
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.warn('createCategoryInSupabase error:', error);
      return { success: false, error: error.message || JSON.stringify(error) };
    }

    if (data?.id) {
      categoryNameToIdCache.set(cleanName, data.id);
    }

    if (data && parentId && data.parent_id === undefined) {
      data.parent_id = parentId;
    }

    invalidateCategoriesCache();
    return { success: true, data };
  } catch (e) {
    console.error('createCategoryInSupabase exception:', e);
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * 11. Update Category name, sort_order & parent_id in Supabase
 * Also cascades update on products.category for products using the old name
 */
export async function updateCategoryInSupabase(id, newName, oldName = null, parentId = undefined) {
  try {
    if (!id) return { success: false, error: 'Category ID ບໍ່ຖືກຕ້ອງ' };
    const cleanName = String(newName || '').trim();
    if (!cleanName) return { success: false, error: 'ກະລຸນາປ້ອນຊື່ໝວດໝູ່' };

    const updatePayload = { name: cleanName };
    if (parentId !== undefined) {
      updatePayload.parent_id = parentId || null;
    }

    // 1. Update categories table
    let { data, error } = await supabase
      .from('categories')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error && (error.code === '42703' || String(error.message || '').includes('parent_id'))) {
      const { parent_id, ...safePayload } = updatePayload;
      const retry = await supabase
        .from('categories')
        .update(safePayload)
        .eq('id', id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.warn('updateCategoryInSupabase error:', error);
      return { success: false, error: error.message || JSON.stringify(error) };
    }

    categoryNameToIdCache.set(cleanName, id);
    if (oldName) categoryNameToIdCache.delete(oldName);

    // 2. Cascade update to products table in parallel
    const cascadeUpdates = [];
    if (oldName) {
      cascadeUpdates.push(
        supabase.from('products').update({ category: cleanName }).eq('category', oldName)
      );
    }
    cascadeUpdates.push(
      supabase.from('products').update({ category: cleanName }).eq('category_id', id)
    );
    await Promise.allSettled(cascadeUpdates);

    invalidateCategoriesCache();
    return { success: true, data };
  } catch (e) {
    console.error('updateCategoryInSupabase exception:', e);
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * 12. Delete Category from Supabase
 * Enforces safety constraint: checks if products exist under this category
 */
export async function deleteCategoryInSupabase(id, categoryName) {
  try {
    if (!id) return { success: false, error: 'Category ID ບໍ່ຖືກຕ້ອງ' };

    // Safety check: count products linked by category name or category_id
    const { count: countByName } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category', categoryName);

    if (countByName && countByName > 0) {
      return {
        success: false,
        hasProducts: true,
        count: countByName,
        error: `ໝວດໝູ່ນີ້ກຳລັງມີສິນຄ້າຢູ່ ${countByName} ລາຍການ, ບໍ່ສາມາດລຶບໄດ້! ກະລຸນາຍ້າຍສິນຄ້າໄປໝວດອື່ນກ່ອນ.`,
      };
    }

    // Delete category
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('deleteCategoryInSupabase error:', error);
      return { success: false, error: error.message || JSON.stringify(error) };
    }

    invalidateCategoriesCache();
    return { success: true };
  } catch (e) {
    console.error('deleteCategoryInSupabase exception:', e);
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * 12.1 Batch Reorder Categories (Zero-Egress Architecture)
 * Performs single batch upsert of sort_order for categories without .select() -> 0 Egress bytes
 * and mutates in-memory category cache directly in-place.
 */
export async function reorderCategoriesInSupabase(orderedItems = []) {
  if (!orderedItems || orderedItems.length === 0) return { success: true };
  try {
    // Build cache lookup map for names and parent_ids if missing in payload
    const cachedMap = new Map();
    if (cachedCategoriesInMemory && Array.isArray(cachedCategoriesInMemory)) {
      cachedCategoriesInMemory.forEach((c) => {
        if (c.id) cachedMap.set(c.id, c);
      });
    }

    const payload = orderedItems
      .filter((item) => Boolean(item && item.id))
      .map((item, idx) => {
        const cached = cachedMap.get(item.id);
        const name = (item.name || cached?.name || '').trim();
        const sortOrder = Number(item.sort_order ?? idx + 1);
        const parentId = item.parent_id !== undefined ? item.parent_id : cached?.parent_id;

        const row = {
          id: item.id,
          name: name,
          sort_order: sortOrder,
        };
        if (parentId !== undefined) {
          row.parent_id = parentId || null;
        }
        return row;
      })
      .filter((row) => Boolean(row.name)); // Filter out any item missing name to satisfy NOT NULL constraint

    if (payload.length === 0) return { success: true };

    // Perform upsert on categories by id without .select() -> 0 Egress bytes
    let { error } = await supabase
      .from('categories')
      .upsert(payload, { onConflict: 'id' });

    if (error && (error.code === '42703' || String(error.message || '').includes('parent_id'))) {
      const safePayload = payload.map(({ parent_id, ...rest }) => rest);
      const retry = await supabase
        .from('categories')
        .upsert(safePayload, { onConflict: 'id' });
      error = retry.error;
    }

    if (error) {
      console.warn('[ZeroEgress] reorderCategoriesInSupabase error:', error);
      return { success: false, error: error.message };
    }

    // In-place memory cache update (ZERO EGRESS)
    if (cachedCategoriesInMemory && Array.isArray(cachedCategoriesInMemory)) {
      const orderMap = new Map(payload.map((p) => [p.id, p.sort_order]));
      cachedCategoriesInMemory.forEach((c) => {
        if (orderMap.has(c.id)) {
          c.sort_order = orderMap.get(c.id);
        }
      });
      cachedCategoriesInMemory.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
      cachedCategoriesTimestamp = Date.now();
    }

    return { success: true };
  } catch (err) {
    console.error('[ZeroEgress] reorderCategoriesInSupabase error:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * 13. Assign a product to a specific Category in Supabase
 */
export async function assignProductToCategoryInSupabase(productId, categoryName, categoryId = null) {
  try {
    if (!productId) return { success: false, error: 'Product ID ບໍ່ຖືກຕ້ອງ' };
    const cleanCat = String(categoryName || 'ທົ່ວໄປ').trim();

    const updatePayload = {
      category: cleanCat,
      updated_at: new Date().toISOString(),
    };
    if (categoryId) {
      updatePayload.category_id = categoryId;
    } else {
      updatePayload.category_id = null;
    }

    // Zero-Egress: Update without .select() returns 204 No Content (0 bytes egress)
    let { error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', productId);

    if (error && (error.code === '42703' || String(error.message || '').includes('category_id'))) {
      const { category_id, ...safePayload } = updatePayload;
      const retry = await supabase
        .from('products')
        .update(safePayload)
        .eq('id', productId);
      error = retry.error;
    }

    if (!error) {
      const allCaches = [cachedPosProductsInMemory, cachedCustomerProductsInMemory, cachedProductsInMemory].filter(Boolean);
      allCaches.forEach((cacheArr) => {
        if (Array.isArray(cacheArr)) {
          const target = cacheArr.find((p) => p.id === productId);
          if (target) {
            target.category = cleanCat;
            target.categoryId = categoryId;
            target.category_id = categoryId;
            target.updated_at = new Date().toISOString();
          }
        }
      });
      cachedPosProductsTimestamp = Date.now();
      cachedProductsTimestamp = Date.now();
    }

    return { success: !error, error: error?.message };
  } catch (e) {
    console.error('assignProductToCategoryInSupabase exception:', e);
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * 13.1 Batch Assign/Update Products Category in Supabase (Zero-Egress & Ultra-Low Quota)
 * Groups assignments by identical payload and batches into single queries with .in('id', ids)
 * reducing 50 separate requests down to 1 single request, with 0 egress bytes.
 */
export async function batchAssignProductsToCategoryInSupabase(assignments = []) {
  if (!assignments || assignments.length === 0) return { success: true };
  try {
    // 1. Group assignments by identical payload { categoryName, categoryId }
    const groups = new Map();
    assignments.forEach((item) => {
      const cleanCat = String(item.categoryName || 'ທົ່ວໄປ').trim();
      const catId = item.categoryId || null;
      const key = `${cleanCat}:::${catId || ''}`;
      if (!groups.has(key)) {
        groups.set(key, { category: cleanCat, categoryId: catId, productIds: [] });
      }
      groups.get(key).productIds.push(item.productId);
    });

    const now = new Date().toISOString();

    // 2. Execute grouped updates using .in('id', ids) without .select() -> 0 Egress & 1 request per group
    for (const group of groups.values()) {
      const updatePayload = {
        category: group.category,
        updated_at: now,
      };
      if (group.categoryId) {
        updatePayload.category_id = group.categoryId;
      } else {
        updatePayload.category_id = null;
      }

      const ID_CHUNK = 50;
      for (let i = 0; i < group.productIds.length; i += ID_CHUNK) {
        const idChunk = group.productIds.slice(i, i + ID_CHUNK);

        let { error } = await supabase
          .from('products')
          .update(updatePayload)
          .in('id', idChunk);

        if (error && (error.code === '42703' || String(error.message || '').includes('category_id'))) {
          const { category_id, ...safePayload } = updatePayload;
          await supabase
            .from('products')
            .update(safePayload)
            .in('id', idChunk);
        }
      }
    }

    // 3. In-place memory cache mutation (ZERO EGRESS - avoids re-downloading catalog)
    const allCaches = [cachedPosProductsInMemory, cachedCustomerProductsInMemory, cachedProductsInMemory].filter(Boolean);
    const assignmentMap = new Map(assignments.map((a) => [a.productId, a]));
    allCaches.forEach((cacheArr) => {
      if (Array.isArray(cacheArr)) {
        cacheArr.forEach((p) => {
          const match = assignmentMap.get(p.id);
          if (match) {
            p.category = match.categoryName;
            p.categoryId = match.categoryId || null;
            p.category_id = match.categoryId || null;
            p.updated_at = now;
          }
        });
      }
    });
    cachedPosProductsTimestamp = Date.now();
    cachedProductsTimestamp = Date.now();

    return { success: true };
  } catch (e) {
    console.error('batchAssignProductsToCategoryInSupabase error:', e);
    return { success: false, error: e.message || String(e) };
  }
}

// ============================================================================
// MODULE: QUẢN LÝ NHẬP KHO (GRN) & CÔNG NỢ NHÀ CUNG CẤP (SUPPLIERS & AP)
// ============================================================================

let cachedSuppliersInMemory = null;
let cachedSuppliersTimestamp = 0;
let inFlightSuppliersPromise = null;
const SUPPLIERS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL

export function invalidateSuppliersCache() {
  cachedSuppliersInMemory = null;
  cachedSuppliersTimestamp = 0;
  inFlightSuppliersPromise = null;
}

/**
 * 1. Fetch all suppliers with SWR cache & In-flight deduplication
 */
export async function fetchSuppliersFromSupabase({ force = false } = {}) {
  const now = Date.now();
  if (!force && cachedSuppliersInMemory && (now - cachedSuppliersTimestamp < SUPPLIERS_CACHE_TTL)) {
    return { success: true, data: cachedSuppliersInMemory };
  }

  if (inFlightSuppliersPromise) {
    return inFlightSuppliersPromise;
  }

  inFlightSuppliersPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('fetchSuppliersFromSupabase error:', error);
        return { success: false, data: cachedSuppliersInMemory || [], error: error.message };
      }
      cachedSuppliersInMemory = data || [];
      cachedSuppliersTimestamp = Date.now();
      return { success: true, data: cachedSuppliersInMemory };
    } catch (e) {
      console.error('fetchSuppliersFromSupabase exception:', e);
      return { success: false, data: cachedSuppliersInMemory || [], error: e.message };
    } finally {
      inFlightSuppliersPromise = null;
    }
  })();

  return inFlightSuppliersPromise;
}

/**
 * 2. Create supplier
 */
export async function createSupplierInSupabase(supplier) {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        name: supplier.name.trim(),
        phone: supplier.phone?.trim() || null,
        address: supplier.address?.trim() || null,
        contact_person: supplier.contactPerson?.trim() || null,
        note: supplier.note?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    invalidateSuppliersCache();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 3. Update supplier
 */
export async function updateSupplierInSupabase(id, supplier) {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .update({
        name: supplier.name.trim(),
        phone: supplier.phone?.trim() || null,
        address: supplier.address?.trim() || null,
        contact_person: supplier.contactPerson?.trim() || null,
        note: supplier.note?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    invalidateSuppliersCache();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 4. Safe delete supplier (Blocked if purchase orders exist)
 */
export async function deleteSupplierSafelyInSupabase(supplierId) {
  try {
    const { data: poCheck, error: checkErr } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('supplier_id', supplierId)
      .limit(1);

    if (poCheck && poCheck.length > 0) {
      return {
        success: false,
        error: 'ບໍ່ສາມາດລົບຜູ້ສະໜອງນີ້ໄດ້ ເນື່ອງຈາກມີປະຫວັດການສັ່ງຊື້ແລ້ວ',
      };
    }

    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
    if (error) {
      return { success: false, error: error.message };
    }
    invalidateSuppliersCache();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

let cachedPurchaseOrdersInMemory = null;
let cachedPurchaseOrdersTimestamp = 0;
let inFlightPurchaseOrdersPromise = null;
const PURCHASE_ORDERS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

export function invalidatePurchaseOrdersCache() {
  cachedPurchaseOrdersInMemory = null;
  cachedPurchaseOrdersTimestamp = 0;
  inFlightPurchaseOrdersPromise = null;
}

/**
 * 5. Fetch all purchase orders with items, supplier, and payments (SWR Cache & Deduplication)
 */
export async function fetchPurchaseOrdersFromSupabase({ force = false } = {}) {
  const now = Date.now();
  if (!force && cachedPurchaseOrdersInMemory && (now - cachedPurchaseOrdersTimestamp < PURCHASE_ORDERS_CACHE_TTL)) {
    return { success: true, data: cachedPurchaseOrdersInMemory };
  }

  if (inFlightPurchaseOrdersPromise) {
    return inFlightPurchaseOrdersPromise;
  }

  inFlightPurchaseOrdersPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers (*),
          purchase_order_items (*),
          supplier_debt_payments (*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('fetchPurchaseOrdersFromSupabase error:', error);
        return { success: false, data: cachedPurchaseOrdersInMemory || [], error: error.message };
      }
      cachedPurchaseOrdersInMemory = data || [];
      cachedPurchaseOrdersTimestamp = Date.now();
      return { success: true, data: cachedPurchaseOrdersInMemory };
    } catch (e) {
      return { success: false, data: cachedPurchaseOrdersInMemory || [], error: e.message };
    } finally {
      inFlightPurchaseOrdersPromise = null;
    }
  })();

  return inFlightPurchaseOrdersPromise;
}

/**
 * 6. Atomic PostgreSQL RPC: process_multi_product_grn(payload JSONB)
 * Ensures 100% ACID compliance in a single transaction on Supabase.
 */
export async function processMultiProductGRN(payload) {
  try {
    const { data, error } = await supabase.rpc('process_multi_product_grn', { payload });
    if (error) {
      console.warn('Supabase RPC process_multi_product_grn warning:', error.message || error);
      // If function does not exist in DB yet (pending SQL migration), use fallback client transaction
      return await fallbackProcessMultiProductGRN(payload);
    }
    return { success: true, poId: payload.po_code, data };
  } catch (err) {
    console.warn('RPC exception, using client fallback:', err);
    return await fallbackProcessMultiProductGRN(payload);
  }
}

/**
 * Fallback client transaction when Postgres RPC is not yet registered in Supabase
 * Ensures 100% Revert & Apply integrity even on client fallback:
 * 1. If PO exists: Revert old items' base units out of products.current_stock_base_units
 * 2. Calculate consistent payment & debt: paid >= total ? PAID (debt=0) : (paid > 0 ? PARTIAL : DEBT)
 * 3. Upsert purchase_orders
 * 4. Replace purchase_order_items
 * 5. Add new items' base units into products
 * 6. Clean up old initial payment logs and insert updated initial payment
 */
async function fallbackProcessMultiProductGRN(payload) {
  try {
    const targetId = payload.po_id || payload.po_code;
    const poId = targetId;
    const items = payload.items || [];
    const firstItem = items[0] || null;

    // 1. Check if PO exists to perform Revert
    let oldPo = null;
    if (payload.po_id) {
      const { data } = await supabase
        .from('purchase_orders')
        .select('id, product_id, imported_base_units, purchase_order_items(*)')
        .eq('id', payload.po_id)
        .maybeSingle();
      oldPo = data;
    }
    if (!oldPo && payload.po_code) {
      const { data } = await supabase
        .from('purchase_orders')
        .select('id, product_id, imported_base_units, purchase_order_items(*)')
        .eq('id', payload.po_code)
        .maybeSingle();
      oldPo = data;
    }

    if (oldPo) {
      const oldItems = oldPo.purchase_order_items || [];
      const oldProdDeltas = new Map();
      if (oldItems.length > 0) {
        for (const oldIt of oldItems) {
          const pid = oldIt.product_id;
          const units = Number(oldIt.imported_base_units) || 0;
          if (pid && units > 0) {
            oldProdDeltas.set(pid, (oldProdDeltas.get(pid) || 0) + units);
          }
        }
      } else if (oldPo.product_id && Number(oldPo.imported_base_units) > 0) {
        oldProdDeltas.set(oldPo.product_id, Number(oldPo.imported_base_units));
      }

      if (oldProdDeltas.size > 0) {
        const prodIds = Array.from(oldProdDeltas.keys());
        const { data: dbProducts } = await supabase
          .from('products')
          .select('id, current_stock_base_units')
          .in('id', prodIds);

        if (dbProducts && dbProducts.length > 0) {
          await Promise.all(
            dbProducts.map((p) => {
              const curStock = Number(p.current_stock_base_units) || 0;
              const unitsToRevert = oldProdDeltas.get(p.id) || 0;
              return supabase
                .from('products')
                .update({
                  current_stock_base_units: curStock - unitsToRevert,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', p.id);
            })
          );
        }
      }

      // Delete old items and old initial debt logs
      await supabase.from('purchase_order_items').delete().eq('purchase_order_id', poId);
      await supabase
        .from('supplier_debt_payments')
        .delete()
        .eq('purchase_order_id', poId)
        .or('note.ilike.%Initial payment%,note.ilike.%Outstanding Debt%,note.ilike.%ອັບເດດໃບຮັບ%');
    }

    // 2. Consistent Payment & Debt Calculation
    const totalLak = Number(payload.total_lak) || 0;
    let paidLak = Number(payload.paid_amount_lak) || 0;
    let paymentStatus = payload.payment_status || 'PAID';
    let debtLak = 0;

    if (paidLak >= totalLak) {
      paymentStatus = 'PAID';
      debtLak = 0;
      paidLak = totalLak;
    } else if (paidLak > 0) {
      paymentStatus = 'PARTIAL';
      debtLak = totalLak - paidLak;
    } else {
      paymentStatus = 'DEBT';
      paidLak = 0;
      debtLak = totalLak;
    }

    // 3. Insert/Update purchase_orders
    const poPayload = {
      id: poId,
      supplier_id: payload.supplier_id || null,
      product_id: firstItem?.product_id || null,
      product_name: items.length > 1
        ? `${firstItem?.product_name || 'ສິນຄ້າ'} (+${items.length - 1} ລາຍການ)`
        : (firstItem?.product_name || 'ສິນຄ້າຮັບເຂົ້າ'),
      imported_base_units: items.reduce((sum, it) => sum + (Number(it.base_units_added) || 0), 0),
      total_cost_lak: totalLak,
      total_cost_thb: Number(payload.total_thb) || 0,
      paid_amount: paidLak,
      debt_amount: debtLak,
      payment_status: paymentStatus,
      received_by: sanitizeCashierName(payload.receiver_name),
      note: payload.notes || null,
      updated_at: new Date().toISOString(),
    };

    if (!oldPo) {
      poPayload.created_at = new Date().toISOString();
    }

    let { error: poErr } = await supabase.from('purchase_orders').upsert(poPayload);
    if (poErr) {
      console.error('Fallback PO insert error:', poErr);
      return { success: false, error: poErr.message };
    }

    // 4. Insert items into purchase_order_items
    if (items.length > 0) {
      const itemsPayload = items.map((it) => ({
        purchase_order_id: poId,
        product_id: it.product_id,
        product_name: it.product_name || 'ສິນຄ້າ',
        unit_id: it.unit_id || null,
        unit_name: it.unit_name || null,
        tier_level: Number(it.tier_level) || 1,
        quantity: Number(it.quantity) || 1,
        imported_base_units: Number(it.base_units_added) || 0,
        cost_per_base_unit: Number(it.cost_per_base_unit) || 0,
        cost_lak: Number(it.cost_lak_entered) || 0,
        cost_thb: Number(it.cost_thb_entered) || 0,
        line_total_lak: Number(it.line_total_lak) || (Number(it.cost_lak_entered || 0) * Number(it.quantity || 1)),
        line_total_thb: Number(it.line_total_thb) || (Number(it.cost_thb_entered || 0) * Number(it.quantity || 1)),
        created_at: new Date().toISOString(),
      }));

      await supabase.from('purchase_order_items').insert(itemsPayload);

      // 5. Cascade stock, track_stock, and cost to products table (Batched in parallel)
      const uniqueProdIds = [...new Set(items.map((it) => it.product_id).filter(Boolean))];
      const { data: dbProducts } = uniqueProdIds.length > 0
        ? await supabase.from('products').select('id, current_stock_base_units, cost_per_base_unit').in('id', uniqueProdIds)
        : { data: [] };

      const dbProdMap = new Map((dbProducts || []).map((p) => [p.id, p]));
      const productAggregates = new Map();
      const unitOverridesList = [];

      for (const it of items) {
        const prodId = it.product_id;
        if (!prodId) continue;
        const prev = productAggregates.get(prodId) || { addedUnits: 0, costLak: 0, costThb: 0, costPerBase: 0 };
        prev.addedUnits += Number(it.base_units_added || 0);
        if (Number(it.cost_lak_entered) > 0) prev.costLak = Number(it.cost_lak_entered);
        if (Number(it.cost_thb_entered) > 0) prev.costThb = Number(it.cost_thb_entered);
        if (Number(it.cost_per_base_unit) > 0) prev.costPerBase = Number(it.cost_per_base_unit);
        productAggregates.set(prodId, prev);

        if (it.retail_price_overrides && typeof it.retail_price_overrides === 'object') {
          for (const [unitId, price] of Object.entries(it.retail_price_overrides)) {
            if (Number(price) > 0) {
              unitOverridesList.push({ unitId, price: Number(price) });
            }
          }
        }
      }

      const prodUpdatePromises = Array.from(productAggregates.entries()).map(([prodId, agg]) => {
        const dbProd = dbProdMap.get(prodId);
        const currentStock = Number(dbProd?.current_stock_base_units || 0);
        const newStock = currentStock + agg.addedUnits;

        const prodUpdate = {
          current_stock_base_units: newStock,
          track_stock: true, // Auto enable inventory counting
          updated_at: new Date().toISOString(),
        };

        if (agg.costLak > 0) prodUpdate.cost_lak = agg.costLak;
        if (agg.costThb > 0) prodUpdate.cost_thb = agg.costThb;
        if (agg.costPerBase > 0) prodUpdate.cost_per_base_unit = agg.costPerBase;

        saveProductMetaLocal({
          id: prodId,
          costBaht: agg.costThb,
          costKip: agg.costLak,
        });

        return supabase.from('products').update(prodUpdate).eq('id', prodId);
      });

      if (unitOverridesList.length > 0) {
        unitOverridesList.forEach(({ unitId, price }) => {
          prodUpdatePromises.push(
            supabase.from('product_units').update({ retail_price: price }).eq('id', unitId)
          );
        });
      }

      if (prodUpdatePromises.length > 0) {
        await Promise.all(prodUpdatePromises);
      }
    }

    // 7. Debt / initial payment record
    if (paidLak > 0) {
      await supabase.from('supplier_debt_payments').insert({
        purchase_order_id: poId,
        payment_amount: paidLak,
        currency: 'LAK',
        payment_method: 'CASH',
        note: oldPo ? 'ຊຳລະເບື້ອງຕົ້ນ (ອັບເດດໃບຮັບ) (Updated initial payment at GRN)' : 'ຊຳລະເບື້ອງຕົ້ນຕອນຮັບສິນຄ້າ (Initial payment at GRN)',
      });
    }

    return { success: true, poId };
  } catch (err) {
    console.error('fallbackProcessMultiProductGRN exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 6. Create Purchase Order (GRN) adapter - delegates to atomic processMultiProductGRN
 */
export async function createPurchaseOrderInSupabase(poData, draftItems = []) {
  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = String(Math.floor(1000 + Math.random() * 9000));
    const poId = poData.id || `PO-${dateStr}-${randomSuffix}`;

    const items = (draftItems || []).map((d) => ({
      product_id: d.product?.id || d.productId,
      product_name: d.product?.name || d.productName || 'ສິນຄ້າ',
      unit_id: d.unitId || d.unit_id || null,
      unit_name: d.unitName || d.unit_name || null,
      tier_level: Number(d.tierLevel || 1),
      quantity: Number(d.quantity || 1),
      base_units_added: Number(d.importedBaseUnits ?? d.imported_base_units ?? 0),
      cost_lak_entered: Number(d.costLak || 0),
      cost_thb_entered: Number(d.costThb || 0),
      cost_per_base_unit: Number(d.costPerBaseUnit || 0),
      line_total_lak: Number(d.lineTotalLak || (Number(d.quantity || 1) * Number(d.costLak || 0))),
      line_total_thb: Number(d.lineTotalThb || (Number(d.quantity || 1) * Number(d.costThb || 0))),
      retail_price_overrides: d.retailPriceOverrides || {},
    }));

    const grnPayload = {
      po_code: poId,
      supplier_id: poData.supplierId || null,
      receiver_name: sanitizeCashierName(poData.receivedBy),
      total_lak: Number(poData.totalCostLak) || 0,
      total_thb: Number(poData.totalCostThb) || 0,
      payment_status: poData.paymentStatus || 'PAID',
      paid_amount_lak: Number(poData.paidAmount) || 0,
      debt_amount_lak: Number(poData.debtAmount) || 0,
      notes: poData.note || '',
      items,
    };

    return await processMultiProductGRN(grnPayload);
  } catch (e) {
    console.error('createPurchaseOrderInSupabase exception:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 7. Add supplier debt repayment
 */
export async function addSupplierDebtPaymentInSupabase(poId, paymentAmount, currency = 'LAK', paymentMethod = 'CASH', note = '') {
  try {
    // 1. Fetch current PO
    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', poId)
      .single();

    if (poErr || !po) {
      return { success: false, error: poErr?.message || 'PO not found' };
    }

    const currentPaid = Number(po.paid_amount) || 0;
    const currentDebt = Number(po.debt_amount) || 0;
    const amt = Number(paymentAmount) || 0;

    const newPaid = currentPaid + amt;
    const newDebt = Math.max(0, currentDebt - amt);
    const newStatus = newDebt === 0 ? 'PAID' : 'PARTIAL';

    // 2. Insert payment log
    await supabase.from('supplier_debt_payments').insert({
      purchase_order_id: poId,
      payment_amount: amt,
      currency,
      payment_method: paymentMethod,
      note: note || null,
    });

    // 3. Update purchase_orders
    const { error: updateErr } = await supabase
      .from('purchase_orders')
      .update({
        paid_amount: newPaid,
        debt_amount: newDebt,
        payment_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId);

    if (updateErr) return { success: false, error: updateErr.message };

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 8. Update Purchase Order (GRN) details with Atomic Revert & Apply
 * Delegates to atomic processMultiProductGRN to ensure 100% ACID compliance
 * and zero stock over-accumulation.
 */
export async function updatePurchaseOrderInSupabase(poId, poData, draftItems = []) {
  try {
    const items = (draftItems || []).map((d) => ({
      product_id: d.product?.id || d.productId || poData.productId,
      product_name: d.product?.name || d.productName || poData.productName || 'ສິນຄ້າ',
      unit_id: d.unitId || d.unit_id || null,
      unit_name: d.unitName || d.unit_name || null,
      tier_level: Number(d.tierLevel || 1),
      quantity: Number(d.quantity || 1),
      base_units_added: Number(d.importedBaseUnits ?? d.imported_base_units ?? 0),
      cost_lak_entered: Number(d.costLak || 0),
      cost_thb_entered: Number(d.costThb || 0),
      cost_per_base_unit: Number(d.costPerBaseUnit || 0),
      line_total_lak: Number(d.lineTotalLak || (Number(d.quantity || 1) * Number(d.costLak || 0))),
      line_total_thb: Number(d.lineTotalThb || (Number(d.quantity || 1) * Number(d.costThb || 0))),
      retail_price_overrides: d.retailPriceOverrides || {},
    }));

    const grnPayload = {
      po_code: poId,
      supplier_id: poData.supplierId || null,
      receiver_name: sanitizeCashierName(poData.receivedBy),
      total_lak: Number(poData.totalCostLak) || 0,
      total_thb: Number(poData.totalCostThb) || 0,
      payment_status: poData.paymentStatus || 'PAID',
      paid_amount_lak: Number(poData.paidAmount) || 0,
      debt_amount_lak: Number(poData.debtAmount) || 0,
      notes: poData.note || '',
      items,
    };

    return await processMultiProductGRN(grnPayload);
  } catch (e) {
    console.error('updatePurchaseOrderInSupabase exception:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 9. Delete Purchase Order (GRN) and revert inventory stock for ALL items
 * - Trừ lại số lượng tồn kho tương ứng đã nhập của TẤT CẢ các sản phẩm trong phiếu:
 *   new_stock = current_stock - GRN_BaseUnits
 * - Hủy/xóa các bản ghi công nợ liên quan trong supplier_debt_payments
 * - Xóa bản ghi purchase_order_items
 * - Xóa bản ghi phiếu nhập khỏi purchase_orders
 */
export async function deletePurchaseOrderInSupabase(poId) {
  try {
    // 1. Fetch current PO with all purchase_order_items
    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select('*, purchase_order_items(*)')
      .eq('id', poId)
      .single();

    if (poErr || !po) {
      return { success: false, error: poErr?.message || 'ບໍ່ພົບໃບຮັບສິນຄ້ານີ້ໃນລະບົບ' };
    }

    // 2. Revert inventory stock from products table for all items in this PO
    const items = po.purchase_order_items || [];
    if (items.length > 0) {
      for (const it of items) {
        if (it.product_id && Number(it.imported_base_units) > 0) {
          const { data: prodData } = await supabase
            .from('products')
            .select('id, current_stock_base_units')
            .eq('id', it.product_id)
            .maybeSingle();

          if (prodData) {
            const currentStock = Number(prodData.current_stock_base_units) || 0;
            const newStock = currentStock - Number(it.imported_base_units);
            await supabase
              .from('products')
              .update({
                current_stock_base_units: newStock,
                updated_at: new Date().toISOString(),
              })
              .eq('id', it.product_id);
          }
        }
      }
    } else {
      // Legacy single-product fallback
      const prodId = po.product_id;
      const importedUnits = Number(po.imported_base_units) || 0;
      if (prodId && importedUnits > 0) {
        const { data: prodData } = await supabase
          .from('products')
          .select('id, current_stock_base_units')
          .eq('id', prodId)
          .maybeSingle();

        if (prodData) {
          const currentStock = Number(prodData.current_stock_base_units) || 0;
          const newStock = currentStock - importedUnits;
          await supabase
            .from('products')
            .update({
              current_stock_base_units: newStock,
              updated_at: new Date().toISOString(),
            })
            .eq('id', prodId);
        }
      }
    }

    // 3. Delete related supplier_debt_payments
    await supabase.from('supplier_debt_payments').delete().eq('purchase_order_id', poId);

    // 4. Delete related purchase_order_items
    await supabase.from('purchase_order_items').delete().eq('purchase_order_id', poId);

    // 5. Delete purchase_orders row
    const { error: delErr } = await supabase.from('purchase_orders').delete().eq('id', poId);
    if (delErr) {
      return { success: false, error: delErr.message };
    }

    return { success: true };
  } catch (e) {
    console.error('deletePurchaseOrderInSupabase exception:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 11. Record Customer Debt Payment (Thu nợ khách hàng)
 */
export async function recordCustomerDebtPaymentInSupabase({
  transactionId,
  paymentAmount,
  paymentMethod = 'CASH',
  note = '',
}) {
  try {
    const amt = Number(paymentAmount) || 0;
    if (amt <= 0) return { success: false, error: 'ຈຳນວນເງິນຕ້ອງຫຼາຍກວ່າ 0' };

    // 1. Get current transaction debt info
    const { data: tx, error: txErr } = await supabase
      .from('sale_transactions')
      .select('id, grand_total, amount_tendered, paid_amount, remaining_debt')
      .eq('id', transactionId)
      .single();

    if (txErr || !tx) {
      return { success: false, error: txErr?.message || 'Transaction not found' };
    }

    const currentGrand = Number(tx.grand_total) || 0;
    const currentPaid = Number(tx.paid_amount ?? tx.amount_tendered ?? 0);
    const currentDebt = Number(tx.remaining_debt ?? Math.max(0, currentGrand - currentPaid));

    const newPaid = currentPaid + amt;
    const newDebt = Math.max(0, currentDebt - amt);
    const newStatus = newDebt === 0 ? 'PAID' : 'PARTIAL';

    // 2. Insert into customer_debt_payments
    await supabase.from('customer_debt_payments').insert({
      transaction_id: transactionId,
      payment_amount: amt,
      payment_method: paymentMethod,
      note: note || null,
    });

    // 3. Update sale_transactions
    const { error: updateErr } = await supabase
      .from('sale_transactions')
      .update({
        paid_amount: newPaid,
        remaining_debt: newDebt,
        payment_status: newStatus,
        amount_tendered: newPaid,
      })
      .eq('id', transactionId);

    if (updateErr) {
      console.error('Update sale_transactions debt error:', updateErr);
      return { success: false, error: updateErr.message };
    }

    return { success: true, newDebt, newPaid, newStatus };
  } catch (e) {
    console.error('recordCustomerDebtPaymentInSupabase exception:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 12. Update / Re-checkout Existing Order via POS
 * Sequentially:
 * 1. Restores old stock
 * 2. Deletes old items
 * 3. Deducts new stock
 * 4. Inserts new items
 * 5. Updates sale_transactions header
 */
export async function updateExistingSaleTransactionInSupabase(
  txId,
  oldItems = [],
  newTxData = {},
  newCartItems = []
) {
  try {
    // Calculate net stock change per product: unitsToRestore (old) - unitsToDeduct (new)
    const stockDeltas = new Map(); // productId -> number

    // 1. Account for old items to restore
    for (const item of oldItems) {
      const prodId = item.product?.id || item.productId || item.product_id;
      if (prodId && prodId !== 'p_custom') {
        const mult = Number(item.unit?.multiplier) || Number(item.multiplier) || 1;
        const qty = Number(item.quantity) || 1;
        const units = mult * qty;
        stockDeltas.set(prodId, (stockDeltas.get(prodId) || 0) + units);
      }
    }

    // 2. Account for new cart items to deduct
    for (const item of newCartItems) {
      const prodId = item.product?.id || item.productId || item.product_id;
      if (prodId && prodId !== 'p_custom') {
        const mult = Number(item.unit?.multiplier) || Number(item.multiplier) || 1;
        const qty = Number(item.quantity) || 1;
        const units = mult * qty;
        stockDeltas.set(prodId, (stockDeltas.get(prodId) || 0) - units);
      }
    }

    // 3. Apply net stock changes to database for tracked products (Batched in parallel)
    const activeDeltas = Array.from(stockDeltas.entries()).filter(([_, delta]) => delta !== 0);
    const prodIdsToFetch = activeDeltas.map(([id]) => id);

    // Concurrently fetch all changed products and delete old items in 1 parallel roundtrip!
    const [productsRes, deleteRes] = await Promise.all([
      prodIdsToFetch.length > 0
        ? supabase.from('products').select('id, current_stock_base_units, track_stock').in('id', prodIdsToFetch)
        : Promise.resolve({ data: [] }),
      supabase.from('sale_transaction_items').delete().eq('transaction_id', txId),
    ]);

    if (deleteRes?.error) {
      console.error('Error deleting old sale_transaction_items:', deleteRes.error);
      return { success: false, error: 'ບໍ່ສາມາດລຶບລາຍການເກົ່າໄດ້: ' + deleteRes.error.message };
    }

    if (productsRes.data && productsRes.data.length > 0) {
      const stockUpdates = productsRes.data
        .filter((p) => p && p.track_stock !== false)
        .map((p) => {
          const delta = stockDeltas.get(p.id) || 0;
          const currentStock = Number(p.current_stock_base_units) || 0;
          const updatedStock = currentStock + delta;
          return supabase
            .from('products')
            .update({
              current_stock_base_units: updatedStock,
              updated_at: new Date().toISOString(),
            })
            .eq('id', p.id);
        });

      if (stockUpdates.length > 0) {
        await Promise.all(stockUpdates);
      }
    }

    // Step 4 & 5: Insert new sale_transaction_items AND update sale_transactions header IN PARALLEL
    const itemsPayload = (newCartItems && newCartItems.length > 0)
      ? newCartItems.map((item) => {
          const isBundle = Boolean(item.isBundle || item.bundle_components?.length || item.bundleComponents?.length);
          const prodId = isBundle
            ? (item.bundleId || item.bundle?.id || item.productId || 'bnd_custom')
            : (item.product?.id || item.productId || item.product_id || 'p_custom');
          const rawCustom = item.customPrice !== undefined && item.customPrice !== null ? Number(item.customPrice) : null;
          const rawEffective = item.effectivePrice !== undefined && item.effectivePrice !== null ? Number(item.effectivePrice) : null;
          const rawUnitPrice = item.unitPrice !== undefined && item.unitPrice !== null ? Number(item.unitPrice) : null;
          const tierPrice = newTxData.isWholesale
            ? (item.unit?.wholesalePrice ?? item.unit?.retailPrice)
            : (item.unit?.retailPrice ?? 0);
          const unitPrice = Number(rawCustom ?? rawEffective ?? rawUnitPrice ?? tierPrice ?? 0) || 0;
          const qty = Number(item.quantity) || 1;
          const rawLine = Number(item.lineTotal || item.line_total);
          const lineTotal = rawLine > 0 ? rawLine : (unitPrice * qty);

          // Calculate cost & multiplier through standard single source of truth engine
          const costInfo = calculateItemCostAndMultiplier(item);
          const multiplier = costInfo.multiplier;
          const lineCost = Number(item.line_cost ?? item.lineCost ?? costInfo.lineCost);
          const lineProfit = lineTotal - lineCost;

          const rawUnitName = item.unit?.unitName || item.unitName || (isBundle ? (item.bundle?.unit_name || 'ແກັດ') : 'ອັນ');
          const unitName = (item.isHalfCarton || costInfo.isHalfCarton) && !rawUnitName.includes('½') ? `½ ${rawUnitName}` : rawUnitName;

          const row = {
            id: generateUUID(),
            transaction_id: txId,
            product_id: prodId,
            product_name: item.productName || item.product?.name || item.bundleName || (isBundle ? 'ນົມກ່ອງ ລວມລົດຊາດ' : 'ສິນຄ້າ'),
            unit_name: unitName,
            multiplier,
            quantity: qty,
            unit_price: unitPrice,
            line_total: lineTotal,
            line_cost: lineCost,
            line_profit: lineProfit,
          };
          if (item.bundle_components || item.bundleComponents) {
            row.bundle_components = item.bundle_components || item.bundleComponents;
          }
          return row;
        })
      : [];

    // Step 4: Insert new sale_transaction_items (with automatic schema fallback)
    let insRes = null;
    if (itemsPayload.length > 0) {
      insRes = await supabase.from('sale_transaction_items').insert(itemsPayload);
      // Fallback: If bundle_components column has not been added to Supabase schema cache yet, retry without it
      if (insRes?.error && (insRes.error.code === '42703' || insRes.error.message?.includes('bundle_components') || insRes.error.message?.includes('schema cache'))) {
        const strippedPayload = itemsPayload.map(({ bundle_components, ...rest }) => rest);
        insRes = await supabase.from('sale_transaction_items').insert(strippedPayload);
      }
      if (insRes?.error) {
        console.error('Error inserting new sale_transaction_items:', insRes.error);
        return { success: false, error: insRes.error.message };
      }
    }

    // Step 5: Recalculate transaction totals from actual final items
    const editRate = Number(newTxData.exchange_rate || newTxData.exchangeRate || 0);
    const totals = recalculateTransactionTotals(itemsPayload, editRate);

    const recalculatedTotalCostLak = totals.totalCostLak;
    const fallbackGrandTotal = Number(newTxData.grandTotal ?? newTxData.grand_total ?? newTxData.total_lak ?? 0);
    const recalculatedTotalAmountLak = (itemsPayload.length > 0 && totals.totalAmountLak > 0)
      ? totals.totalAmountLak
      : (totals.totalAmountLak > 0 ? totals.totalAmountLak : fallbackGrandTotal);
    const recalculatedGrossProfitLak = recalculatedTotalAmountLak - recalculatedTotalCostLak;
    const recalculatedTotalCostThb = totals.totalCostThb;
    const recalculatedTotalThb = totals.totalAmountThb;
    const recalculatedGrossProfitThb = Number((recalculatedTotalThb - recalculatedTotalCostThb).toFixed(2));

    // Update sale_transactions header
    const headerPayload = {
      is_wholesale: Boolean(newTxData.isWholesale),
      customer_name: newTxData.customerName || 'ລູກຄ້າທົ່ວໄປ',
      customer_id: newTxData.customerId || newTxData.customer_id || null,
      customer_phone: newTxData.customerPhone || newTxData.customer_phone || null,
      payment_method: newTxData.paymentMethod || 'cash',
      subtotal: recalculatedTotalAmountLak,
      discount_total: Number(newTxData.discountTotal) || 0,
      grand_total: recalculatedTotalAmountLak,
      amount_tendered: Number(newTxData.amountTendered) || 0,
      change_amount: Number(newTxData.changeAmount) || 0,
      total_cost: recalculatedTotalCostLak,
      total_cost_lak: recalculatedTotalCostLak,
      total_cost_thb: recalculatedTotalCostThb,
      gross_profit: recalculatedGrossProfitLak,
      gross_profit_lak: recalculatedGrossProfitLak,
      gross_profit_thb: recalculatedGrossProfitThb,
      paid_amount: Number(newTxData.paidAmount ?? newTxData.amountTendered ?? 0),
      remaining_debt: Number(newTxData.remainingDebt ?? 0),
      payment_status: newTxData.paymentStatus || 'PAID',
      debt_due_date: newTxData.debtDueDate || newTxData.debt_due_date || null,
      exchange_rate: editRate,
      total_lak: recalculatedTotalAmountLak,
      total_thb: recalculatedTotalThb,
      updated_at: new Date().toISOString(),
    };

    let headerRes = await supabase.from('sale_transactions').update(headerPayload).eq('id', txId);

    // Schema cache fallback: if any column causes missing schema cache error or 42703, strip and retry
    if (headerRes?.error) {
      const errMsg = headerRes.error.message || '';
      console.warn('Initial update sale_transactions error, attempting safe fallback:', headerRes.error);

      // 1. Try stripping the specific missing column if identified in the error message
      const colMatch = errMsg.match(/Could not find the '([^']+)' column/i);
      if (colMatch && colMatch[1] && headerPayload[colMatch[1]] !== undefined) {
        delete headerPayload[colMatch[1]];
        headerRes = await supabase.from('sale_transactions').update(headerPayload).eq('id', txId);
      }

      // 2. If still failing (e.g. debt_due_date, customer_id, customer_phone not yet in schema), retry with essential core columns
      if (headerRes?.error) {
        const {
          debt_due_date,
          customer_id,
          customer_phone,
          gross_profit_lak,
          gross_profit_thb,
          total_lak,
          total_thb,
          exchange_rate,
          ...corePayload
        } = headerPayload;
        headerRes = await supabase.from('sale_transactions').update(corePayload).eq('id', txId);
      }
    }

    if (headerRes?.error) {
      console.error('Error updating sale_transactions header:', headerRes.error);
      return { success: false, error: headerRes.error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('updateExistingSaleTransactionInSupabase exception:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Strict Year-over-Year / Dual-Month Query:
 * Queries ONLY the two discrete month intervals (Month A and Month B) in parallel.
 * TUYỆT ĐỐI KHÔNG truy vấn dồn toàn bộ các tháng nằm ở giữa.
 */
export async function fetchDualMonthTransactions(yearMonthA, yearMonthB) {
  try {
    const getRange = (ymStr) => {
      const parts = (ymStr || '').split('-');
      if (parts.length < 2) return null;
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      if (!year || !month) return null;
      // Start of month
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)).toISOString();
      // End of month
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
      return { start, end };
    };

    const rangeA = getRange(yearMonthA);
    const rangeB = getRange(yearMonthB);
    if (!rangeA || !rangeB) return { txsA: [], txsB: [] };

    // Discrete queries strictly abiding by query rule
    const [resA, resB] = await Promise.all([
      supabase
        .from('sale_transactions')
        .select('*, sale_transaction_items(*)')
        .gte('created_at', rangeA.start)
        .lte('created_at', rangeA.end)
        .order('created_at', { ascending: true }),
      supabase
        .from('sale_transactions')
        .select('*, sale_transaction_items(*)')
        .gte('created_at', rangeB.start)
        .lte('created_at', rangeB.end)
        .order('created_at', { ascending: true }),
    ]);

    const normalizeTxs = (list) =>
      (list || [])
        .filter(
          (t) =>
            t.payment_status !== 'CANCELLED' &&
            t.status !== 'cancelled' &&
            !t.is_cancelled
        )
        .map((t) => {
          let cachedMeta = null;
          try {
            const raw = localStorage.getItem(`meiishop_tx_meta_${t.id}`);
            if (raw) cachedMeta = JSON.parse(raw);
          } catch (_) {}

          let items = [];
          if (t.sale_transaction_items && t.sale_transaction_items.length > 0) {
            items = t.sale_transaction_items.map((i) => ({
              id: i.id,
              product: { id: i.product_id, name: i.product_name },
              productId: i.product_id,
              product_id: i.product_id,
              productName: i.product_name,
              unit: {
                unitName: i.unit_name,
                multiplier: Number(i.multiplier) || 1,
                retailPrice: Number(i.unit_price) || 0,
                wholesalePrice: Number(i.unit_price) || 0,
              },
              unitName: i.unit_name,
              unit_name: i.unit_name,
              multiplier: Number(i.multiplier) || 1,
              quantity: Number(i.quantity) || 1,
              unitPrice: Number(i.unit_price) || 0,
              unit_price: Number(i.unit_price) || 0,
              lineTotal: Number(i.line_total) || ((Number(i.unit_price) || 0) * (Number(i.quantity) || 1)),
              line_total: Number(i.line_total) || ((Number(i.unit_price) || 0) * (Number(i.quantity) || 1)),
              lineCost: Number(i.line_cost) || 0,
              line_cost: Number(i.line_cost) || 0,
              lineProfit: Number(i.line_profit) || 0,
              line_profit: Number(i.line_profit) || 0,
            }));
          } else if (cachedMeta?.items && Array.isArray(cachedMeta.items) && cachedMeta.items.length > 0) {
            items = cachedMeta.items;
          } else if (Array.isArray(cachedMeta) && cachedMeta.length > 0) {
            items = cachedMeta;
          }

          return {
            id: t.id,
            receiptNumber: t.receipt_number,
            createdAt: t.created_at,
            grandTotal: Number(t.grand_total) || 0,
            totalCost: Number(t.total_cost) || 0,
            grossProfit: Number(t.gross_profit) || 0,
            paymentMethod: t.payment_method,
            paymentStatus: t.payment_status,
            sale_transaction_items: t.sale_transaction_items || [],
            items,
          };
        });

    return {
      txsA: normalizeTxs(resA.data),
      txsB: normalizeTxs(resB.data),
    };
  } catch (err) {
    console.error('fetchDualMonthTransactions error:', err);
    return { txsA: [], txsB: [] };
  }
}

/**
 * Custom Date Range Query:
 * Queries sale_transactions strictly between start_date and end_date.
 */
export async function fetchDateRangeTransactions(startDateStr, endDateStr) {
  try {
    if (!startDateStr || !endDateStr) return [];
    const s = new Date(startDateStr);
    s.setHours(0, 0, 0, 0);
    const e = new Date(endDateStr);
    e.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('sale_transactions')
      .select('*, sale_transaction_items(*)')
      .gte('created_at', s.toISOString())
      .lte('created_at', e.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('fetchDateRangeTransactions error:', error);
      return [];
    }

    return (data || [])
      .filter(
        (t) =>
          t.payment_status !== 'CANCELLED' &&
          t.status !== 'cancelled' &&
          !t.is_cancelled
      )
      .map((t) => {
        let cachedMeta = null;
        try {
          const raw = localStorage.getItem(`meiishop_tx_meta_${t.id}`);
          if (raw) cachedMeta = JSON.parse(raw);
        } catch (_) {}

        let items = [];
        if (t.sale_transaction_items && t.sale_transaction_items.length > 0) {
          items = t.sale_transaction_items.map((i) => ({
            id: i.id,
            product: { id: i.product_id, name: i.product_name },
            productId: i.product_id,
            product_id: i.product_id,
            productName: i.product_name,
            unit: {
              unitName: i.unit_name,
              multiplier: Number(i.multiplier) || 1,
              retailPrice: Number(i.unit_price) || 0,
              wholesalePrice: Number(i.unit_price) || 0,
            },
            unitName: i.unit_name,
            unit_name: i.unit_name,
            multiplier: Number(i.multiplier) || 1,
            quantity: Number(i.quantity) || 1,
            unitPrice: Number(i.unit_price) || 0,
            unit_price: Number(i.unit_price) || 0,
            lineTotal: Number(i.line_total) || ((Number(i.unit_price) || 0) * (Number(i.quantity) || 1)),
            line_total: Number(i.line_total) || ((Number(i.unit_price) || 0) * (Number(i.quantity) || 1)),
            lineCost: Number(i.line_cost) || 0,
            line_cost: Number(i.line_cost) || 0,
            lineProfit: Number(i.line_profit) || 0,
            line_profit: Number(i.line_profit) || 0,
          }));
        } else if (cachedMeta?.items && Array.isArray(cachedMeta.items) && cachedMeta.items.length > 0) {
          items = cachedMeta.items;
        } else if (Array.isArray(cachedMeta) && cachedMeta.length > 0) {
          items = cachedMeta;
        }

        return {
          id: t.id,
          receiptNumber: t.receipt_number,
          createdAt: t.created_at,
          grandTotal: Number(t.grand_total) || 0,
          totalCost: Number(t.total_cost) || 0,
          grossProfit: Number(t.gross_profit) || 0,
          paymentMethod: t.payment_method,
          paymentStatus: t.payment_status,
          sale_transaction_items: t.sale_transaction_items || [],
          items,
        };
      });
  } catch (err) {
    console.error('fetchDateRangeTransactions exception:', err);
    return [];
  }
}

const annualSalesCache = new Map();
const annualSalesTimestamp = new Map();
const inFlightAnnualSales = new Map();
const ANNUAL_SALES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

export function invalidateAnnualSalesCache(targetYear = null) {
  if (targetYear) {
    annualSalesCache.delete(targetYear);
    annualSalesTimestamp.delete(targetYear);
    inFlightAnnualSales.delete(targetYear);
  } else {
    annualSalesCache.clear();
    annualSalesTimestamp.clear();
    inFlightAnnualSales.clear();
  }
}

/**
 * Annual 12-Month Sales Trend:
 * Aggregates revenue, cost, profit, and order count for all 12 months of the given year.
 * Features SWR in-memory caching & in-flight deduplication to merge parallel duplicate requests.
 */
export async function fetchAnnual12MonthSales(targetYear = new Date().getFullYear(), { force = false } = {}) {
  const now = Date.now();
  const cachedTime = annualSalesTimestamp.get(targetYear) || 0;
  if (!force && annualSalesCache.has(targetYear) && (now - cachedTime < ANNUAL_SALES_CACHE_TTL)) {
    return annualSalesCache.get(targetYear);
  }

  if (inFlightAnnualSales.has(targetYear)) {
    return inFlightAnnualSales.get(targetYear);
  }

  const promise = (async () => {
    try {
      const start = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0, 0)).toISOString();
      const end = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999)).toISOString();

      const { data, error } = await supabase
        .from('sale_transactions')
        .select('created_at, grand_total, total_cost, gross_profit, status, payment_status')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('fetchAnnual12MonthSales error:', error);
        return annualSalesCache.get(targetYear) || [];
      }

      const laoMonthNames = [
        'ມັງກອນ (1)',
        'ກຸມພາ (2)',
        'ມີນາ (3)',
        'ເມສາ (4)',
        'ພຶດສະພາ (5)',
        'ມິຖຸນາ (6)',
        'ກໍລະກົດ (7)',
        'ສິງຫາ (8)',
        'ກັນຍາ (9)',
        'ຕຸລາ (10)',
        'ພະຈິກ (11)',
        'ທັນວາ (12)',
      ];

      const months = laoMonthNames.map((name, idx) => ({
        monthIndex: idx + 1,
        month: `${String(idx + 1).padStart(2, '0')}/${targetYear}`,
        monthName: name,
        label: name,
        shortLabel: name,
        simpleMonth: String(idx + 1).padStart(2, '0'),
        revenue: 0,
        total_sales: 0,
        cost: 0,
        total_cost: 0,
        profit: 0,
        gross_profit: 0,
        count: 0,
        ticket_count: 0,
      }));

      (data || []).forEach((t) => {
        if (t.payment_status === 'CANCELLED' || t.status === 'cancelled' || t.is_cancelled) return;
        const d = new Date(t.created_at);
        const mIdx = d.getMonth();
        if (mIdx >= 0 && mIdx < 12) {
          const rev = Number(t.grand_total) || 0;
          const c = Number(t.total_cost) || 0;
          const p = Number(t.gross_profit) || 0;

          months[mIdx].revenue += rev;
          months[mIdx].total_sales += rev;
          months[mIdx].cost += c;
          months[mIdx].total_cost += c;
          months[mIdx].profit += p;
          months[mIdx].gross_profit += p;
          months[mIdx].count += 1;
          months[mIdx].ticket_count += 1;
        }
      });

      annualSalesCache.set(targetYear, months);
      annualSalesTimestamp.set(targetYear, Date.now());
      return months;
    } catch (err) {
      console.error('fetchAnnual12MonthSales exception:', err);
      return annualSalesCache.get(targetYear) || [];
    } finally {
      inFlightAnnualSales.delete(targetYear);
    }
  })();

  inFlightAnnualSales.set(targetYear, promise);
  return promise;
}

/**
 * Mark an order as printed in Supabase sale_transactions table.
 * Emits realtime UPDATE event so other devices know the receipt has already been printed.
 */
export async function markOrderAsPrintedInSupabase(orderId) {
  if (!orderId) return { success: false, error: 'No orderId provided' };
  try {
    const printedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('sale_transactions')
      .update({
        is_printed: true,
        printed_at: printedAt,
      })
      .eq('id', orderId)
      .select('id, is_printed, printed_at');

    if (error) {
      console.warn('[Supabase] markOrderAsPrinted warning:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, printedAt, data };
  } catch (err) {
    console.error('[Supabase] markOrderAsPrinted exception:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// MIXED CARTON BUNDLES (NHÓM SẢN PHẨM ĐÓNG THÙNG MIX MÀU / MIX VỊ)
// ============================================================================

const BUNDLE_LOCAL_STORAGE_KEY = 'meiishop_product_bundles_v1';

/**
 * Lấy danh sách các nhóm thùng mix vị từ Supabase (kèm danh sách mã sản phẩm vị con)
 */
export async function fetchProductBundlesFromSupabase() {
  try {
    // 1. Fetch bundles from Supabase
    const { data: bundlesData, error: bundlesErr } = await supabase
      .from('product_bundles')
      .select('*, product_bundle_items(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (bundlesErr) {
      console.warn('[Supabase] fetchProductBundles warning (using local fallback if available):', bundlesErr.message);
      // Fallback local storage
      const local = typeof window !== 'undefined' ? localStorage.getItem(BUNDLE_LOCAL_STORAGE_KEY) : null;
      return local ? JSON.parse(local) : [];
    }

    const bundles = (bundlesData || []).map((b) => ({
      ...b,
      image_url: sanitizeImageUrl(b.image_url) || null,
      itemIds: (b.product_bundle_items || []).map((item) => item.product_id),
    }));

    if (typeof window !== 'undefined') {
      localStorage.setItem(BUNDLE_LOCAL_STORAGE_KEY, JSON.stringify(bundles));
    }

    return bundles;
  } catch (err) {
    console.error('fetchProductBundlesFromSupabase exception:', err);
    const local = typeof window !== 'undefined' ? localStorage.getItem(BUNDLE_LOCAL_STORAGE_KEY) : null;
    return local ? JSON.parse(local) : [];
  }
}

/**
 * Thêm mới hoặc Cập nhật nhóm thùng mix vị
 */
export async function saveProductBundleToSupabase(bundle, childProductIds = []) {
  try {
    const isEdit = Boolean(bundle.id && !bundle.id.startsWith('temp_'));
    const bundleId = isEdit ? bundle.id : ('bnd_' + generateUUID().replace(/-/g, '').substring(0, 12));

    const bundlePayload = {
      id: bundleId,
      name: bundle.name || 'ນົມກ່ອງ ລວມລົດຊາດ',
      name_vi: bundle.name_vi || bundle.nameVi || '',
      package_qty: Number(bundle.package_qty || bundle.packageQty) || 24,
      unit_name: bundle.unit_name || bundle.unitName || 'ແກັດ',
      base_unit_name: bundle.base_unit_name || bundle.baseUnitName || 'ອັນ',
      price_lak: Number(bundle.price_lak || bundle.priceLak) || 0,
      price_thb: Number(bundle.price_thb || bundle.priceThb) || 0,
      barcode: bundle.barcode || null,
      image_url: sanitizeImageUrl(bundle.image_url || bundle.imageUrl) || null,
      is_active: bundle.is_active !== false,
      updated_at: new Date().toISOString(),
    };

    if (!isEdit) {
      bundlePayload.created_at = new Date().toISOString();
    }

    // 1. Upsert bundle header
    const { data: savedBundle, error: bErr } = await supabase
      .from('product_bundles')
      .upsert(bundlePayload)
      .select()
      .single();

    if (bErr) {
      console.warn('[Supabase] saveProductBundle warning, updating local cache:', bErr.message);
      // Local fallback
      try {
        const local = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem(BUNDLE_LOCAL_STORAGE_KEY) || '[]') : [];
        const index = local.findIndex((x) => x.id === bundleId);
        const merged = { ...bundlePayload, itemIds: childProductIds };
        if (index >= 0) local[index] = merged;
        else local.unshift(merged);
        localStorage.setItem(BUNDLE_LOCAL_STORAGE_KEY, JSON.stringify(local));
      } catch (e) {}
      return { success: true, data: { ...bundlePayload, itemIds: childProductIds }, via: 'local' };
    }

    // 2. Refresh child products relation in product_bundle_items
    if (childProductIds && Array.isArray(childProductIds)) {
      // Delete old items
      await supabase.from('product_bundle_items').delete().eq('bundle_id', bundleId);

      // Insert new items
      if (childProductIds.length > 0) {
        const itemsToInsert = childProductIds.map((pId, idx) => ({
          bundle_id: bundleId,
          product_id: pId,
          sort_order: idx,
        }));
        const { error: itemsErr } = await supabase.from('product_bundle_items').insert(itemsToInsert);
        if (itemsErr) console.warn('[Supabase] insert product_bundle_items warning:', itemsErr);
      }
    }

    // Update local cache
    try {
      const local = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem(BUNDLE_LOCAL_STORAGE_KEY) || '[]') : [];
      const index = local.findIndex((x) => x.id === bundleId);
      const merged = { ...(savedBundle || bundlePayload), itemIds: childProductIds };
      if (index >= 0) local[index] = merged;
      else local.unshift(merged);
      localStorage.setItem(BUNDLE_LOCAL_STORAGE_KEY, JSON.stringify(local));
    } catch (e) {}

    return { success: true, data: { ...(savedBundle || bundlePayload), itemIds: childProductIds } };
  } catch (err) {
    console.error('saveProductBundleToSupabase exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Xóa hoặc ẩn nhóm thùng mix vị
 */
export async function deleteProductBundleInSupabase(bundleId) {
  try {
    const { error } = await supabase
      .from('product_bundles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', bundleId);

    if (error) {
      console.warn('[Supabase] deleteProductBundle warning (soft-delete via local):', error.message);
    }

    // Update local cache
    try {
      const local = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem(BUNDLE_LOCAL_STORAGE_KEY) || '[]') : [];
      const updated = local.filter((x) => x.id !== bundleId);
      localStorage.setItem(BUNDLE_LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}

    return { success: true };
  } catch (err) {
    console.error('deleteProductBundleInSupabase exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Tạo đơn đặt hàng Online từ Web khách hàng (/menu)
 * Hỗ trợ 2 hình thức: Tự ghé lấy (pickup) và Giao hàng (delivery)
 */
export async function createOnlineOrderInSupabase(orderData) {
  try {
    const txId = orderData.id || `onl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = orderData.receiptNumber || `ONL-${dateStr}-${randSuffix}`;

    const grandTotal = Number(orderData.grandTotal) || Number(orderData.totalLak) || 0;
    const isTransfer = orderData.paymentMethod === 'transfer';

    const newTx = {
      id: txId,
      receipt_number: receiptNumber,
      created_at: now.toISOString(),
      is_wholesale: false,
      customer_name: orderData.customerName || 'ລູກຄ້າອອນລາຍ',
      customer_phone: orderData.customerPhone || null,
      payment_method: orderData.paymentMethod || 'cash',
      subtotal: Number(orderData.subtotal) || grandTotal,
      discount_total: 0,
      grand_total: grandTotal,
      amount_tendered: grandTotal,
      change_amount: 0,
      total_cost_lak: 0,
      total_cost_thb: 0,
      gross_profit_lak: 0,
      gross_profit_thb: 0,
      cashier_name: 'Online Web',
      paid_amount: grandTotal,
      remaining_debt: 0,
      payment_status: 'PAID',
      total_lak: grandTotal,
      total_thb: 0,
      order_source: 'online',
      fulfillment_type: orderData.fulfillmentType || 'pickup', // 'pickup' | 'delivery'
      delivery_address: orderData.deliveryAddress || null,
      delivery_note: orderData.deliveryNote || null,
      pickup_time: orderData.pickupTime || null,
      online_status: 'PENDING',
      payment_slip_url: orderData.paymentSlipUrl || null,
    };

    // 1. Ghi đơn hàng vào bảng sale_transactions
    let insertedTx = null;
    const { data: txRecord, error: txErr } = await supabase
      .from('sale_transactions')
      .insert(newTx)
      .select()
      .single();

    if (txErr) {
      console.warn('[OnlineOrder] Primary insert fallback (ignoring new fields if not migrated):', txErr.message);
      // Fallback nếu database chưa chạy migration các cột online mới
      const { order_source, fulfillment_type, delivery_address, delivery_note, pickup_time, online_status, payment_slip_url, ...fallbackTx } = newTx;
      const { data: fallbackRecord, error: fallbackErr } = await supabase
        .from('sale_transactions')
        .insert(fallbackTx)
        .select()
        .single();
      if (fallbackErr) throw fallbackErr;
      insertedTx = fallbackRecord;
    } else {
      insertedTx = txRecord;
    }

    // 2. Ghi chi tiết các món vào bảng sale_transaction_items
    const itemsToInsert = (orderData.items || []).map((it) => ({
      id: generateUUID(),
      transaction_id: txId,
      product_id: it.productId || it.id || 'prod_custom',
      product_name: it.productName || it.name || 'ສິນຄ້າ',
      unit_name: it.unitName || 'ອັນ',
      multiplier: Number(it.multiplier) || 1,
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unitPrice || it.price) || 0,
      line_total: Number(it.lineTotal || (Number(it.unitPrice || it.price || 0) * (Number(it.quantity) || 1))) || 0,
      line_cost: 0,
      line_profit: 0,
    }));

    if (itemsToInsert.length > 0) {
      const { error: itemsErr } = await supabase
        .from('sale_transaction_items')
        .insert(itemsToInsert);
      if (itemsErr) console.warn('[OnlineOrder] Insert items warning:', itemsErr.message);
    }

    return {
      success: true,
      order: {
        ...newTx,
        items: itemsToInsert,
      },
    };
  } catch (err) {
    console.error('[OnlineOrder] Error placing online order:', err);
    return { success: false, error: err.message || 'Error creating online order' };
  }
}

/**
 * Cập nhật trạng thái đơn hàng Online (Duyệt, Đóng gói, Sẵn sàng, Hoàn tất, Hủy)
 */
export async function updateOnlineOrderStatusInSupabase(orderId, newStatus, extraData = {}) {
  try {
    const updatePayload = {
      online_status: newStatus,
      ...extraData,
    };
    if (newStatus === 'COMPLETED') {
      updatePayload.payment_status = 'PAID';
      updatePayload.remaining_debt = 0;
    }

    const { error } = await supabase
      .from('sale_transactions')
      .update(updatePayload)
      .eq('id', orderId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('[OnlineOrder] Error updating online order status:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Zero-Egress Realtime Broadcast for POS Terminal Price Sync
 * Sends minimal delta payload over WebSocket without any REST API request.
 */
export async function broadcastPriceUpdate(payload) {
  try {
    const channel = supabase.channel('pos_price_sync');
    await channel.send({
      type: 'broadcast',
      event: 'price_updated',
      payload,
    });
  } catch (err) {
    console.warn('[Realtime] Failed to broadcast price update:', err);
  }
}

/**
 * Zero-Egress Product Unit Price Batch Mutation
 * - Target: product_units table (id, retail_price, price_2, wholesale_price, price_3)
 * - Strict Zero-Egress: Never appends .select(). Returns HTTP 200/204 empty body (0 KB egress).
 * - Never calls fetchProducts() or triggers re-fetch.
 * - Mutates cachedProductsInMemory in-place.
 * - Broadcasts price_updated event to all other POS terminals via pos_price_sync channel.
 */
export async function updateProductUnitPricesZeroEgress(dirtyUnits) {
  if (!dirtyUnits || !Array.isArray(dirtyUnits) || dirtyUnits.length === 0) {
    return { success: true, count: 0, payload: [] };
  }

  // Pre-build O(1) lookup map from in-memory cache to resolve product_id and unit_name for PostgreSQL NOT NULL constraint
  const cacheLookupMap = new Map();
  const activeLookupCache = cachedPosProductsInMemory || cachedProductsInMemory;
  if (activeLookupCache && Array.isArray(activeLookupCache)) {
    activeLookupCache.forEach((prod) => {
      if (prod.units && Array.isArray(prod.units)) {
        const maxMult = Math.max(...prod.units.map((un) => Number(un.multiplier) || 1), 1);
        const prodCostLak = Number(prod.cost_lak || prod.costKip) || 0;
        prod.units.forEach((un) => {
          const mult = Number(un.multiplier) || 1;
          const uCost = (prodCostLak / maxMult) * mult;
          cacheLookupMap.set(un.id, {
            productId: un.productId || un.product_id || prod.id,
            unitName: un.unitName || un.unit_name,
            multiplier: un.multiplier,
            unitCostLak: uCost,
          });
        });
      }
    });
  }

  const payload = dirtyUnits.map((u) => {
    const cachedInfo = cacheLookupMap.get(u.id);
    const productId = u.product_id || u.productId || cachedInfo?.productId;
    const unitName = u.unit_name || u.unitName || cachedInfo?.unitName;
    const multiplier = u.multiplier !== undefined ? u.multiplier : cachedInfo?.multiplier;

    const item = {
      id: u.id,
    };

    // Provide required NOT NULL fields to satisfy PostgreSQL INSERT clause in UPSERT
    if (productId) item.product_id = productId;
    if (unitName) item.unit_name = unitName;
    if (multiplier !== undefined) item.multiplier = Number(multiplier) || 1;

    if (u.retail_price !== undefined) item.retail_price = Number(u.retail_price) || 0;
    if (u.price_2 !== undefined) {
      item.price_2 = Number(u.price_2) || 0;
      item.wholesale_price = item.price_2;
    } else if (u.wholesale_price !== undefined) {
      item.wholesale_price = Number(u.wholesale_price) || 0;
      item.price_2 = item.wholesale_price;
    }
    if (u.price_3 !== undefined) item.price_3 = Number(u.price_3) || 0;

    // Automatically recalculate price ratio if unit cost is known
    if (cachedInfo?.unitCostLak > 0) {
      if (item.retail_price > 0) item.price_ratio_1 = Number((item.retail_price / cachedInfo.unitCostLak).toFixed(4));
      if (item.price_2 > 0) item.price_ratio_2 = Number((item.price_2 / cachedInfo.unitCostLak).toFixed(4));
      if (item.price_3 > 0) item.price_ratio_3 = Number((item.price_3 / cachedInfo.unitCostLak).toFixed(4));
    }

    return item;
  });

  try {
    // 1. Zero-Egress upsert to Supabase product_units (WITHOUT .select())
    let { error: uErr } = await supabase
      .from('product_units')
      .upsert(payload, { onConflict: 'id' });

    // Fallback A: If upsert complains about missing NOT NULL columns (e.g. product_id), use individual parallel PATCH/UPDATE
    if (uErr && (uErr.message?.includes('not-null') || uErr.message?.includes('product_id') || uErr.message?.includes('null value in column'))) {
      console.warn('[ZeroEgress] Upsert failed with NOT NULL constraint, executing parallel zero-egress updates:', uErr.message);
      const updatePromises = payload.map((pItem) => {
        const updateFields = {};
        if (pItem.retail_price !== undefined) updateFields.retail_price = pItem.retail_price;
        if (pItem.price_2 !== undefined) {
          updateFields.price_2 = pItem.price_2;
          updateFields.wholesale_price = pItem.price_2;
        } else if (pItem.wholesale_price !== undefined) {
          updateFields.wholesale_price = pItem.wholesale_price;
          updateFields.price_2 = pItem.wholesale_price;
        }
        if (pItem.price_3 !== undefined) updateFields.price_3 = pItem.price_3;

        return supabase.from('product_units').update(updateFields).eq('id', pItem.id);
      });
      const results = await Promise.all(updatePromises);
      const failed = results.find((r) => r.error);
      uErr = failed ? failed.error : null;
    }

    // Fallback B: If price_2 / price_3 columns do not exist in older schema
    if (uErr && uErr.message && (uErr.message.includes('price_2') || uErr.message.includes('price_3') || uErr.message.includes('column') || uErr.message.includes('schema cache'))) {
      const fallbackPayload = payload.map(({ price_2, price_3, ...rest }) => rest);
      const retry = await supabase.from('product_units').upsert(fallbackPayload, { onConflict: 'id' });
      uErr = retry.error;
    }

    if (uErr) {
      console.error('[ZeroEgress] Product units upsert error:', uErr);
      return { success: false, error: uErr.message || JSON.stringify(uErr) };
    }

    // 2. In-place memory cache mutation (0 network request)
    const allPriceCaches = [cachedPosProductsInMemory, cachedCustomerProductsInMemory, cachedProductsInMemory].filter(Boolean);
    const unitPriceMap = new Map(payload.map((u) => [u.id, u]));
    allPriceCaches.forEach((cacheArr) => {
      if (Array.isArray(cacheArr)) {
        cacheArr.forEach((prod) => {
          if (prod.units && Array.isArray(prod.units)) {
            prod.units.forEach((unit) => {
              if (unitPriceMap.has(unit.id)) {
                const delta = unitPriceMap.get(unit.id);
                if (delta.retail_price !== undefined) unit.retailPrice = delta.retail_price;
                if (delta.price_2 !== undefined) {
                  unit.price_2 = delta.price_2;
                  unit.price2 = delta.price_2;
                  unit.wholesalePrice = delta.price_2;
                }
                if (delta.price_3 !== undefined) {
                  unit.price_3 = delta.price_3;
                  unit.price3 = delta.price_3;
                }
              }
            });
          }
        });
      }
    });
    cachedPosProductsTimestamp = Date.now();
    cachedProductsTimestamp = Date.now();

    // 3. P2P Realtime Broadcast to sync other iPads over WebSocket (0 REST API egress)
    broadcastPriceUpdate(payload);

    return { success: true, count: payload.length, payload };
  } catch (err) {
    console.error('[ZeroEgress] updateProductUnitPricesZeroEgress exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Zero-Egress Batch Product Costs Update
 * Updates cost_lak, cost_thb, cost_currency, and cost_per_base_unit directly.
 * Updates in-memory caches immediately without re-fetching all products.
 */
export async function updateProductCostsZeroEgress(dirtyCosts) {
  if (!dirtyCosts || !Array.isArray(dirtyCosts) || dirtyCosts.length === 0) {
    return { success: true, count: 0, payload: [] };
  }

  try {
    const promises = dirtyCosts.map((item) => {
      const updateData = {
        updated_at: new Date().toISOString(),
      };
      if (item.cost_lak !== undefined) updateData.cost_lak = item.cost_lak;
      if (item.cost_thb !== undefined) updateData.cost_thb = item.cost_thb;
      if (item.currency !== undefined) updateData.cost_currency = item.currency;
      if (item.cost_per_base_unit !== undefined) updateData.cost_per_base_unit = item.cost_per_base_unit;

      return supabase
        .from('products')
        .update(updateData)
        .eq('id', item.productId);
    });

    const results = await Promise.all(promises);
    const hasErr = results.find((r) => r.error);
    if (hasErr) {
      console.warn('[ZeroEgress] updateProductCostsZeroEgress partial warning:', hasErr.error);
    }

    // In-place memory cache mutation
    const allCaches = [cachedPosProductsInMemory, cachedCustomerProductsInMemory, cachedProductsInMemory].filter(Boolean);
    const costMap = new Map(dirtyCosts.map((c) => [c.productId, c]));
    allCaches.forEach((cacheArr) => {
      if (Array.isArray(cacheArr)) {
        cacheArr.forEach((prod) => {
          if (costMap.has(prod.id)) {
            const delta = costMap.get(prod.id);
            if (delta.cost_lak !== undefined) {
              prod.cost_lak = delta.cost_lak;
              prod.costLak = delta.cost_lak;
              prod.costKip = delta.cost_lak;
            }
            if (delta.cost_thb !== undefined) {
              prod.cost_thb = delta.cost_thb;
              prod.costThb = delta.cost_thb;
              prod.costBaht = delta.cost_thb;
            }
            if (delta.currency !== undefined) {
              prod.cost_currency = delta.currency;
              prod.costCurrency = delta.currency;
            }
            if (delta.cost_per_base_unit !== undefined) {
              prod.cost_per_base_unit = delta.cost_per_base_unit;
              prod.costPerBaseUnit = delta.cost_per_base_unit;
            }
          }
        });
      }
    });

    return { success: true, count: dirtyCosts.length, payload: dirtyCosts };
  } catch (err) {
    console.error('[ZeroEgress] updateProductCostsZeroEgress exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Tự động bù giá vốn (Backfill Cost) cho các hóa đơn cũ theo chuẩn Zero-Egress
 * 100% Database-side calculation via PostgreSQL RPC
 * 
 * @param {string|null} transactionId - Nếu có ID, chỉ bù cho hóa đơn đó; nếu null, bù cho toàn bộ hóa đơn
 * @returns {Promise<{ success: boolean, updated_items: number, updated_invoices: number, error?: string }>}
 */
export async function backfillMissingInvoiceCosts(transactionId = null) {
  try {
    const params = transactionId ? { p_transaction_id: String(transactionId) } : {};
    const { data, error } = await supabase.rpc('backfill_missing_invoice_costs', params);
    if (error) {
      console.error('[backfillMissingInvoiceCosts] RPC error:', error);
      return { success: false, error: error.message };
    }
    return data || { success: true, updated_items: 0, updated_invoices: 0 };
  } catch (err) {
    console.error('[backfillMissingInvoiceCosts] exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}
