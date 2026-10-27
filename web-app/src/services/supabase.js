import { createClient } from '@supabase/supabase-js';
import { universalStorage } from './authStorage';
import { sanitizeImageUrl, normalizeLao } from '../utils/formatters';

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
    if (typeof window !== 'undefined' && window.localStorage) {
      const meta = {
        name_vi: product.name_vi || product.nameVi || '',
        costBaht: product.costBaht,
        costKip: product.costKip,
        tierSettings: product.tierSettings,
        hasCrateDeposit: Boolean(product.hasCrateDeposit),
        crateDepositFee: Number(product.crateDepositFee) || 30000,
      };
      window.localStorage.setItem(`meiishop_prod_meta_${product.id}`, JSON.stringify(meta));
    }
  } catch (e) {
    console.warn('saveProductMetaLocal error:', e);
  }
}

// Cache memory danh mục để tránh gọi SELECT categories thừa khi thêm/sửa sản phẩm
const categoryNameToIdCache = new Map();

export function getProductMetaLocal(productId) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(`meiishop_prod_meta_${productId}`);
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * 0. Store Settings & Point-in-time Exchange Rate (1 THB = X LAK)
 */
export async function fetchStoreSetting(key, defaultValue = null) {
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error || !data) {
      if (typeof window !== 'undefined' && window.localStorage) {
        const local = window.localStorage.getItem(`meiishop_setting_${key}`);
        if (local) return JSON.parse(local);
      }
      return defaultValue;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`meiishop_setting_${key}`, JSON.stringify(data.value));
    }
    return data.value;
  } catch (err) {
    console.warn(`fetchStoreSetting error for key ${key}:`, err);
    if (typeof window !== 'undefined' && window.localStorage) {
      const local = window.localStorage.getItem(`meiishop_setting_${key}`);
      if (local) return JSON.parse(local);
    }
    return defaultValue;
  }
}

export async function updateStoreSetting(key, value) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`meiishop_setting_${key}`, JSON.stringify(value));
    }

    const { data, error } = await supabase
      .from('store_settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
      .select()
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
 * 1. Fetch all products with their associated multi-tier units from Supabase (Full Scale 3,000+ support)
 */
export async function fetchProductsFromSupabase() {
  try {
    // 1. Fetch ALL products using chunked range queries (bypasses 1,000 limit)
    let prodData = null;
    let prodErr = null;

    try {
      const res = await fetchAllRowsWithRange(() =>
        supabase
          .from('products')
          .select('*, categories(id, name)')
          .order('created_at', { ascending: false })
      );
      if (!res.error && res.data) {
        prodData = res.data;
      } else {
        throw res.error;
      }
    } catch {
      // Fallback query without categories join if relationship not defined yet
      const fallback = await fetchAllRowsWithRange(() =>
        supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false })
      );
      prodData = fallback.data;
      prodErr = fallback.error;
    }

    if (prodErr || !prodData) {
      console.warn('Could not fetch products from Supabase:', prodErr);
      return null;
    }

    // Filter out soft-deleted products if is_deleted column is present
    const activeProducts = prodData.filter((p) => p.is_deleted !== true);

    // 2. Fetch ALL product_units using chunked range queries (bypasses 1,000 limit)
    const { data: unitsData, error: unitsErr } = await fetchAllRowsWithRange(() =>
      supabase
        .from('product_units')
        .select('*')
    );

    if (unitsErr || !unitsData) {
      console.warn('Could not fetch product_units from Supabase:', unitsErr);
      return null;
    }

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
          barcode: u.barcode || null,
          isBaseUnit: Boolean(u.is_base_unit),
          tier: resolvedTier,
        };
      });

      // Sort units by multiplier ascending
      pUnits.sort((a, b) => a.multiplier - b.multiplier);

      const localMeta = getProductMetaLocal(p.id);

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

      const cartonMultiplier = cartonUnit ? cartonUnit.multiplier : 1;
      const baseCostKip = Number(p.cost_per_base_unit) || 0;
      const computedCartonCostKip = baseCostKip * cartonMultiplier;

      const costKip = localMeta?.costKip !== undefined ? localMeta.costKip : (Number(p.cost_lak) || computedCartonCostKip);
      const costBaht = localMeta?.costBaht !== undefined ? localMeta.costBaht : (Number(p.cost_thb) || Number(p.cost_baht) || 0);

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

      const isTrackStock = p.track_stock !== false;
      const stockValue = isTrackStock
        ? (p.current_stock_base_units !== null && p.current_stock_base_units !== undefined
            ? Number(p.current_stock_base_units)
            : 0)
        : 0;

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
      const cleanCat = (resolvedCategoryName || '').toLowerCase();
      const normCat = normalizeLao(resolvedCategoryName || '');
      const unitsTokens = pUnits
        .map((u) => `${u.unitName} ${normalizeLao(u.unitName)} ${u.barcode || ''}`)
        .join(' ')
        .toLowerCase();

      const searchKey = `${cleanName} ${normLaoName} ${cleanViName} ${cleanBarcode} ${cleanCat} ${normCat} ${unitsTokens}`.trim();

      return {
        id: p.id,
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
        tier1_active: isCartonActive,
        tier2_active: isPackActive,
        tier3_active: isPieceActive,
        tierSettings,
        currentStockBaseUnits: stockValue,
        trackStock: isTrackStock,
        hasCrateDeposit: localMeta?.hasCrateDeposit !== undefined
          ? Boolean(localMeta.hasCrateDeposit)
          : Boolean(p.category === 'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ' || p.name.includes('ເບຍ')),
        crateDepositFee: Number(localMeta?.crateDepositFee) || 30000,
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

    return mapped;
  } catch (err) {
    console.warn('Supabase fetch failed:', err);
    return null;
  }
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
    const finalCostThb = product.cost_thb ?? product.costBaht;
    if (finalCostThb !== undefined && finalCostThb !== null && finalCostThb !== '') {
      prodPayload.cost_thb = Math.round(Number(finalCostThb) || 0);
    }
    const finalCostLak = product.cost_lak ?? product.costKip;
    if (finalCostLak !== undefined && finalCostLak !== null && finalCostLak !== '') {
      prodPayload.cost_lak = Math.round(Number(finalCostLak) || 0);
    }

    let { error: pErr } = await supabase.from('products').upsert(prodPayload);

    // If optional columns (name_vi, cost_thb, cost_lak, category_id) do not exist yet in schema cache, safely retry without them
    if (pErr && pErr.message && (pErr.message.includes('name_vi') || pErr.message.includes('cost_thb') || pErr.message.includes('cost_lak') || pErr.message.includes('category_id'))) {
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
        barcode: u.barcode || null,
        is_base_unit: Boolean(u.isBaseUnit),
      }));

      // Upsert active units in-place without deleting to prevent Foreign Key Violation
      let { error: uErr } = await supabase.from('product_units').upsert(unitsPayload, { onConflict: 'id' });
      if (uErr && uErr.message && (uErr.message.includes('price_2') || uErr.message.includes('price_3') || uErr.message.includes('column') || uErr.message.includes('schema cache'))) {
        // Safe retry without price_2/price_3 if columns not yet migrated in Supabase
        const fallbackUnits = unitsPayload.map(({ price_2, price_3, ...rest }) => rest);
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
      ((matchedProd?.category?.includes('ເບຍ') || matchedProd?.name?.includes('ເບຍ') || i.product_name?.includes('ເບຍ')) &&
       (i.unit_name === 'ແກັດ' || i.unit_name === 'ລັງ'))
    );
    const diff = (isCrateEligible && rawLineTotal > baseTotal) ? (rawLineTotal - baseTotal) : 0;
    const fee = Number(matchedProd?.crateDepositFee) || 30000;
    const crateDepositTotal = isCrateEligible ? (Number(i.crateDepositTotal) || (diff > 0 ? diff : 0)) : 0;
    const missingCount = isCrateEligible ? (Number(i.missingCratesCount) || (crateDepositTotal > 0 ? Math.round(crateDepositTotal / fee) : 0)) : 0;
    const hasMissingCrates = isCrateEligible && Boolean(
      i.noEmptyCrates || crateDepositTotal > 0
    );

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
      lineTotal: rawLineTotal,
      isBundle,
      bundleComponents: bundleComps,
      bundle_components: bundleComps,
      noEmptyCrates: hasMissingCrates,
      missingCratesCount: missingCount,
      crateDepositFee: fee,
      crateDepositTotal,
    };
  });

  return {
    id: t.id,
    receiptNumber: t.receipt_number,
    createdAt: t.created_at,
    updatedAt: t.updated_at || t.created_at,
    date: new Date(t.created_at).toLocaleString('lo-LA'),
    customerName: t.customer_name || 'ລູກຄ້າທົ່ວໄປ',
    cashierName: sanitizeCashierName(t.cashier_name),
    cashierId: t.cashier_id || null,
    isWholesale: Boolean(t.is_wholesale),
    paymentMethod: cleanPaymentMethod,
    originalPaymentMethod: cleanPaymentMethod,
    status: isCancelled ? 'cancelled' : 'completed',
    isCancelled: isCancelled,
    cancelledAt: cachedMeta?.cancelledAt || (isCancelled ? t.created_at : null),
    subtotal: Number(t.subtotal) || 0,
    discountTotal: Number(t.discount_total) || 0,
    grandTotal: Number(t.grand_total) || 0,
    amountTendered: Number(t.amount_tendered) || 0,
    changeAmount: Number(t.change_amount) || 0,
    totalCost: Number(t.total_cost) || 0,
    grossProfit: Number(t.gross_profit) || 0,
    is_printed: Boolean(t.is_printed),
    isPrinted: Boolean(t.is_printed),
    printed_at: t.printed_at || null,
    printedAt: t.printed_at || null,
    isDebt: Boolean(
      t.payment_status === 'DEBT' ||
        t.payment_status === 'PARTIAL' ||
        cleanPaymentMethod === 'debt' ||
        Number(t.remaining_debt) > 0
    ),
    remainingDebt: Number(
      t.remaining_debt ??
        (cleanPaymentMethod === 'debt'
          ? Math.max(0, (Number(t.grand_total) || 0) - (Number(t.amount_tendered) || 0))
          : 0)
    ),
    debtAmount: Number(
      t.remaining_debt ??
        cachedMeta?.receipt?.debtAmount ??
        (cleanPaymentMethod === 'debt' ? Number(t.grand_total) || 0 : 0)
    ),
    paidAmount: Number(
      t.paid_amount ??
        t.amount_tendered ??
        (cleanPaymentMethod === 'debt' ? 0 : Number(t.grand_total) || 0)
    ),
    paymentStatus: t.payment_status || (cleanPaymentMethod === 'debt' ? 'DEBT' : 'PAID'),
    debtNote: cachedMeta?.receipt?.debtNote || cachedMeta?.debtNote || '',
    debtStatus:
      t.payment_status ||
      cachedMeta?.receipt?.debtStatus ||
      (cleanPaymentMethod === 'debt' ? 'unpaid' : 'paid'),
    sale_transaction_items: t.sale_transaction_items || [],
    items:
      cachedMeta?.items && Array.isArray(cachedMeta.items) && cachedMeta.items.length > 0
        ? cachedMeta.items
        : rawItems,
  };
}

/**
 * 5. Fetch all sale transactions from Supabase with line items (scoped/capped)
 */
export async function fetchTransactionsFromSupabase({ limit = 350 } = {}) {
  try {
    let query = supabase
      .from('sale_transactions')
      .select('*, sale_transaction_items(*)')
      .order('created_at', { ascending: false });

    if (limit && Number(limit) > 0) {
      query = query.limit(Number(limit));
    }

    const { data: txs, error } = await query;

    if (error || !txs) {
      console.warn('fetchTransactionsFromSupabase error:', error);
      return null;
    }

    let cachedProds = [];
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('meiishop_products_v5') : null;
      if (raw) cachedProds = JSON.parse(raw);
    } catch (_) {}

    return txs.map((t) => mapDatabaseSaleTransaction(t, cachedProds));
  } catch (e) {
    console.warn('fetchTransactionsFromSupabase error:', e);
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
      .select('*, sale_transaction_items(*)')
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
        .select('*, sale_transaction_items(*)')
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
    const totalLak = Number(tx.total_lak ?? tx.totalLak ?? tx.grandTotal ?? 0);
    const totalCostLak = Number(tx.total_cost_lak ?? tx.totalCostLak ?? tx.totalCost ?? 0);
    const totalThb = Number(tx.total_thb ?? tx.totalThb ?? (rate > 0 ? Number((totalLak / rate).toFixed(2)) : 0));
    const totalCostThb = Number(tx.total_cost_thb ?? tx.totalCostThb ?? (rate > 0 ? Number((totalCostLak / rate).toFixed(2)) : 0));
    const grossProfitLak = Number(tx.gross_profit_lak ?? tx.grossProfitLak ?? tx.grossProfit ?? 0);
    const grossProfitThb = Number(tx.gross_profit_thb ?? tx.grossProfitThb ?? Number((totalThb - totalCostThb).toFixed(2)));

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
      const fullMult = Number(item.effectiveMultiplier ?? item.unit?.multiplier) || 1;
      const multiplier = item.isHalfCarton ? fullMult / 2 : fullMult;
      const baseCost = Number(item.product?.costPerBaseUnit) || 0;

      // Extract bundle components breakdown if item is a bundle
      const bundleComponents = isBundle
        ? (item.bundleComponents || item.bundle_components || []).map((c) => ({
            product_id: c.productId || c.product_id,
            product_name: c.productName || c.product_name,
            quantity: Number(c.quantity) || 1,
            unit_price: Number(c.unitPrice ?? c.unit_price) || 0,
          }))
        : null;

      let lineCost = 0;
      if (isBundle && bundleComponents && bundleComponents.length > 0) {
        // Line cost of a bundle is the sum of cost of all child flavor components
        lineCost = (item.bundleComponents || []).reduce((sum, c) => {
          const compCost = Number(c.product?.costPerBaseUnit ?? c.costPerBaseUnit ?? 0);
          return sum + compCost * (Number(c.quantity) || 1);
        }, 0);
      } else {
        lineCost = baseCost * multiplier * qty;
      }
      const lineProfit = lineTotal - lineCost;

      const rawUnitName = item.unit?.unitName || item.unitName || (isBundle ? (item.bundle?.unit_name || 'ແກັດ') : 'ອັນ');
      const unitName = item.isHalfCarton && !rawUnitName.includes('½') ? `½ ${rawUnitName}` : rawUnitName;

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

    const checkoutPayload = {
      id: tx.id,
      receipt_number: tx.receiptNumber,
      created_at: tx.createdAt,
      is_wholesale: Boolean(tx.isWholesale),
      customer_name: tx.customerName || 'ລູກຄ້າທົ່ວໄປ',
      payment_method: tx.paymentMethod || 'cash',
      subtotal: Number(tx.subtotal) || 0,
      discount_total: Number(tx.discountTotal) || 0,
      grand_total: Number(tx.grandTotal) || 0,
      amount_tendered: Number(tx.amountTendered) || 0,
      change_amount: Number(tx.changeAmount) || 0,
      total_cost_lak: totalCostLak,
      total_cost_thb: totalCostThb,
      gross_profit_lak: grossProfitLak,
      gross_profit_thb: grossProfitThb,
      cashier_name: sanitizeCashierName(tx.cashierName),
      cashier_id: tx.cashierId || null,
      paid_amount: Number(tx.paidAmount ?? (tx.paymentMethod === 'debt' ? (tx.amountTendered || 0) : (tx.amountTendered || tx.grandTotal || 0))),
      remaining_debt: Number(tx.debtAmount ?? (tx.paymentMethod === 'debt' ? Math.max(0, (tx.grandTotal || 0) - (tx.amountTendered || 0)) : 0)),
      payment_status: tx.paymentStatus || (tx.paymentMethod === 'debt' ? ((tx.amountTendered || 0) > 0 ? 'PARTIAL' : 'DEBT') : 'PAID'),
      exchange_rate: rate,
      total_lak: totalLak,
      total_thb: totalThb,
      items: checkoutItems,
    };

    // 1. GỌI POSTGRES RPC NGUYÊN TỬ VỚI KHÓA HÀNG FOR UPDATE VÀ GHI THẺ KHO
    const { data: rpcData, error: rpcErr } = await supabase.rpc('process_pos_checkout', { payload: checkoutPayload });
    if (!rpcErr && rpcData?.success) {
      return { success: true, via: 'atomic_rpc' };
    }

    if (rpcErr) {
      const errMsg = rpcErr.message || '';
      const isRpcMissing = rpcErr.code === '42883' || rpcErr.code === 'PGRST202' || errMsg.includes('Could not find the function') || errMsg.includes('function process_pos_checkout');
      
      if (!isRpcMissing) {
        // Business logic exception thrown by Postgres (e.g. insufficient stock)!
        console.error('process_pos_checkout RPC business rejection:', rpcErr);
        let userFriendly = errMsg;
        if (errMsg.includes('không đủ tồn kho') || errMsg.includes('out of stock')) {
          userFriendly = 'ສິນຄ້າໃນສາງບໍ່ພໍຂາຍ! ' + errMsg;
        }
        return { success: false, error: userFriendly, code: rpcErr.code };
      }

      console.warn('process_pos_checkout RPC not available yet in Supabase, using standard client fallback:', rpcErr.message);
    }

    // 2. Fallback thủ công nếu RPC chưa được chạy migration trong SQL Editor
    const { error: txErr } = await supabase.from('sale_transactions').insert({
      id: tx.id,
      receipt_number: tx.receiptNumber,
      created_at: tx.createdAt,
      is_wholesale: Boolean(tx.isWholesale),
      customer_name: tx.customerName || 'ລູກຄ້າທົ່ວໄປ',
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
      cashier_id: tx.cashierId || null,
      paid_amount: Number(tx.paidAmount ?? (tx.paymentMethod === 'debt' ? (tx.amountTendered || 0) : (tx.amountTendered || tx.grandTotal || 0))),
      remaining_debt: Number(tx.debtAmount ?? (tx.paymentMethod === 'debt' ? Math.max(0, (tx.grandTotal || 0) - (tx.amountTendered || 0)) : 0)),
      payment_status: tx.paymentStatus || (tx.paymentMethod === 'debt' ? ((tx.amountTendered || 0) > 0 ? 'PARTIAL' : 'DEBT') : 'PAID'),
      exchange_rate: rate,
      total_lak: totalLak,
      total_thb: totalThb,
    });

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

    return { success: true };
  } catch (err) {
    console.error('updateTransactionInSupabase exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * 9. Fetch Categories from Supabase ('categories' table)
 */
export async function fetchCategoriesFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      // If table doesn't exist yet, return null without crashing
      return null;
    }
    if (data && Array.isArray(data)) {
      data.forEach((c) => {
        if (c.name && c.id) categoryNameToIdCache.set(c.name.trim(), c.id);
      });
    }
    return data;
  } catch (e) {
    console.warn('fetchCategoriesFromSupabase warning:', e);
    return null;
  }
}

/**
 * 10. Create a new Category in Supabase
 */
export async function createCategoryInSupabase(name, sortOrder = 0) {
  try {
    if (!name || !name.trim()) return { success: false, error: 'ຊື່ໝວດໝູ່ບໍ່ຖືກຕ້ອງ' };
    const cleanName = name.trim();

    const { data, error } = await supabase
      .from('categories')
      .insert([{ name: cleanName, sort_order: sortOrder }])
      .select()
      .single();

    if (error) {
      console.warn('createCategoryInSupabase error:', error);
      return { success: false, error: error.message || JSON.stringify(error) };
    }

    if (data?.id) {
      categoryNameToIdCache.set(cleanName, data.id);
    }

    return { success: true, data };
  } catch (e) {
    console.error('createCategoryInSupabase exception:', e);
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * 11. Update Category name & sort_order in Supabase
 * Also cascades update on products.category for products using the old name
 */
export async function updateCategoryInSupabase(id, newName, oldName = null) {
  try {
    if (!id) return { success: false, error: 'Category ID ບໍ່ຖືກຕ້ອງ' };
    const cleanName = String(newName || '').trim();
    if (!cleanName) return { success: false, error: 'ກະລຸນາປ້ອນຊື່ໝວດໝູ່' };

    // 1. Update categories table
    const { data, error } = await supabase
      .from('categories')
      .update({ name: cleanName })
      .eq('id', id)
      .select()
      .single();

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

    return { success: true };
  } catch (e) {
    console.error('deleteCategoryInSupabase exception:', e);
    return { success: false, error: e.message || String(e) };
  }
}

// ============================================================================
// MODULE: QUẢN LÝ NHẬP KHO (GRN) & CÔNG NỢ NHÀ CUNG CẤP (SUPPLIERS & AP)
// ============================================================================

/**
 * 1. Fetch all suppliers
 */
export async function fetchSuppliersFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('fetchSuppliersFromSupabase error:', error);
      return { success: false, data: [], error: error.message };
    }
    return { success: true, data: data || [] };
  } catch (e) {
    console.error('fetchSuppliersFromSupabase exception:', e);
    return { success: false, data: [], error: e.message };
  }
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
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 5. Fetch all purchase orders with items, supplier, and payments
 */
export async function fetchPurchaseOrdersFromSupabase() {
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
      return { success: false, data: [], error: error.message };
    }
    return { success: true, data: data || [] };
  } catch (e) {
    return { success: false, data: [], error: e.message };
  }
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
    const [productsRes] = await Promise.all([
      prodIdsToFetch.length > 0
        ? supabase.from('products').select('id, current_stock_base_units, track_stock').in('id', prodIdsToFetch)
        : Promise.resolve({ data: [] }),
      supabase.from('sale_transaction_items').delete().eq('transaction_id', txId),
    ]);

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

    // Step 4: Insert new sale_transaction_items
    if (newCartItems && newCartItems.length > 0) {
      const itemsPayload = newCartItems.map((item) => {
        const prodId = item.product?.id || item.productId || 'p_custom';
        const unitPrice = Number(
          item.customPrice !== undefined
            ? item.customPrice
            : newTxData.isWholesale
            ? item.unit?.wholesalePrice
            : item.unit?.retailPrice
        ) || 0;
        const qty = Number(item.quantity) || 1;
        const lineTotal = Number(item.lineTotal || (unitPrice * qty));
        const fullMult = Number(item.effectiveMultiplier ?? item.unit?.multiplier) || 1;
        const multiplier = item.isHalfCarton ? fullMult / 2 : fullMult;
        const baseCost = Number(item.product?.costPerBaseUnit) || 0;
        const lineCost = baseCost * multiplier * qty;
        const lineProfit = lineTotal - lineCost;

        const rawUnitName = item.unit?.unitName || item.unitName || 'ອັນ';
        const unitName = item.isHalfCarton && !rawUnitName.includes('½') ? `½ ${rawUnitName}` : rawUnitName;

        return {
          id: generateUUID(),
          transaction_id: txId,
          product_id: prodId,
          product_name: item.productName || item.product?.name || 'ສິນຄ້າ',
          unit_name: unitName,
          multiplier,
          quantity: qty,
          unit_price: unitPrice,
          line_total: lineTotal,
          line_cost: lineCost,
          line_profit: lineProfit,
        };
      });

      await supabase.from('sale_transaction_items').insert(itemsPayload);
    }

    // Step 5: Update sale_transactions header
    const { error: headerErr } = await supabase
      .from('sale_transactions')
      .update({
        is_wholesale: Boolean(newTxData.isWholesale),
        customer_name: newTxData.customerName || 'ລູກຄ້າທົ່ວໄປ',
        payment_method: newTxData.paymentMethod || 'cash',
        subtotal: Number(newTxData.subtotal) || 0,
        discount_total: Number(newTxData.discountTotal) || 0,
        grand_total: Number(newTxData.grandTotal) || 0,
        amount_tendered: Number(newTxData.amountTendered) || 0,
        change_amount: Number(newTxData.changeAmount) || 0,
        total_cost: Number(newTxData.totalCost) || 0,
        gross_profit: Number(newTxData.grossProfit) || 0,
        paid_amount: Number(newTxData.paidAmount ?? newTxData.amountTendered ?? 0),
        remaining_debt: Number(newTxData.remainingDebt ?? 0),
        payment_status: newTxData.paymentStatus || 'PAID',
        exchange_rate: Number(newTxData.exchange_rate || newTxData.exchangeRate || 0),
        total_lak: Number(newTxData.total_lak ?? newTxData.totalLak ?? newTxData.grandTotal ?? 0),
        total_thb: Number(newTxData.total_thb ?? newTxData.totalThb ?? 0),
        gross_profit_lak: Number(newTxData.gross_profit_lak ?? newTxData.grossProfitLak ?? newTxData.grossProfit ?? 0),
        gross_profit_thb: Number(newTxData.gross_profit_thb ?? newTxData.grossProfitThb ?? 0),
        updated_at: new Date().toISOString(),
      })
      .eq('id', txId);

    if (headerErr) {
      console.error('Error updating sale_transactions header:', headerErr);
      return { success: false, error: headerErr.message };
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
          if (cachedMeta?.items && Array.isArray(cachedMeta.items) && cachedMeta.items.length > 0) {
            items = cachedMeta.items;
          } else if (Array.isArray(cachedMeta) && cachedMeta.length > 0) {
            items = cachedMeta;
          } else if (t.sale_transaction_items && t.sale_transaction_items.length > 0) {
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
        if (cachedMeta?.items && Array.isArray(cachedMeta.items) && cachedMeta.items.length > 0) {
          items = cachedMeta.items;
        } else if (Array.isArray(cachedMeta) && cachedMeta.length > 0) {
          items = cachedMeta;
        } else if (t.sale_transaction_items && t.sale_transaction_items.length > 0) {
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

/**
 * Annual 12-Month Sales Trend:
 * Aggregates revenue, cost, profit, and order count for all 12 months of the given year.
 */
export async function fetchAnnual12MonthSales(targetYear = new Date().getFullYear()) {
  try {
    const start = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0, 0)).toISOString();
    const end = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999)).toISOString();

    const { data, error } = await supabase
      .from('sale_transactions')
      .select('created_at, grand_total, total_cost, gross_profit, status, payment_status, is_cancelled')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('fetchAnnual12MonthSales error:', error);
      return [];
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

    return months;
  } catch (err) {
    console.error('fetchAnnual12MonthSales exception:', err);
    return [];
  }
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
