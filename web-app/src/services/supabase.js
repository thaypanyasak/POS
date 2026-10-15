import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qanphpmphnipyuwcadwz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zQw2L3JfnT-5o_-tJgZaIA_WETQFTPq';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Helper to store product metadata (Baht cost, Kip cost, tier settings) locally
 */
export function saveProductMetaLocal(product) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const meta = {
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
 * 1. Fetch all products with their associated multi-tier units from Supabase
 */
export async function fetchProductsFromSupabase() {
  try {
    // Attempt relational join on categories if foreign key exists, otherwise fallback to select *
    let prodData = null;
    let prodErr = null;

    try {
      const res = await supabase
        .from('products')
        .select('*, categories(id, name)')
        .order('created_at', { ascending: false });
      if (!res.error && res.data) {
        prodData = res.data;
      } else {
        throw res.error;
      }
    } catch {
      // Fallback query without categories join if relationship not defined yet
      const fallback = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      prodData = fallback.data;
      prodErr = fallback.error;
    }

    if (prodErr || !prodData) {
      console.warn('Could not fetch products from Supabase:', prodErr);
      return null;
    }

    const { data: unitsData, error: unitsErr } = await supabase
      .from('product_units')
      .select('*');

    if (unitsErr || !unitsData) {
      console.warn('Could not fetch product_units from Supabase:', unitsErr);
      return null;
    }

    // Map units to their corresponding products
    const mapped = prodData.map((p) => {
      const pUnits = unitsData
        .filter((u) => u.product_id === p.id)
        .map((u) => {
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

      const costKip = localMeta?.costKip !== undefined ? localMeta.costKip : computedCartonCostKip;
      const costBaht = localMeta?.costBaht !== undefined ? localMeta.costBaht : Math.round(costKip / 720);

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

      return {
        id: p.id,
        name: p.name,
        category: resolvedCategoryName,
        categoryId: resolvedCategoryId,
        categories: p.categories || null,
        barcode: p.barcode || '',
        imageUrl: p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
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
        units: pUnits.length > 0 ? pUnits : [
          {
            id: `${p.id}_base`,
            productId: p.id,
            unitName: resolvedBaseUnit,
            multiplier: 1,
            retailPrice: 0,
            wholesalePrice: 0,
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
      category: product.category,
      barcode: product.barcode || null,
      image_url: product.imageUrl || null,
      base_unit: product.baseUnit,
      cost_per_base_unit: product.costPerBaseUnit || 0,
      current_stock_base_units: currentStock,
      track_stock: isTrackStock,
      updated_at: new Date().toISOString(),
    };

    if (product.categoryId) {
      prodPayload.category_id = product.categoryId;
    }

    let { error: pErr } = await supabase.from('products').upsert(prodPayload);

    // If category_id column doesn't exist in Supabase yet, retry without category_id
    if (pErr && pErr.message && pErr.message.includes('category_id')) {
      delete prodPayload.category_id;
      const retryRes = await supabase.from('products').upsert(prodPayload);
      pErr = retryRes.error;
    }

    if (pErr) {
      console.error('Product upsert error:', pErr);
      return { success: false, error: pErr.message || JSON.stringify(pErr) };
    }

    // 2. Clean up old units for this product in 'product_units'
    const { error: delUnitsErr } = await supabase
      .from('product_units')
      .delete()
      .eq('product_id', product.id);

    if (delUnitsErr) {
      console.warn('Could not clear old units:', delUnitsErr);
    }

    // 3. Insert fresh active units
    if (product.units && product.units.length > 0) {
      const unitsPayload = product.units.map((u) => ({
        id: u.id,
        product_id: product.id,
        unit_name: u.unitName,
        multiplier: Number(u.multiplier) || 1,
        retail_price: Number(u.retailPrice) || 0,
        wholesale_price: Number(u.wholesalePrice) || 0,
        barcode: u.barcode || null,
        is_base_unit: Boolean(u.isBaseUnit),
      }));

      const { error: uErr } = await supabase.from('product_units').insert(unitsPayload);
      if (uErr) {
        console.error('Product units insert error:', uErr);
        return { success: false, error: uErr.message || JSON.stringify(uErr) };
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
    // 1. Delete associated units
    const { error: uErr } = await supabase
      .from('product_units')
      .delete()
      .eq('product_id', productId);

    if (uErr) {
      console.warn('Delete product units warning:', uErr);
    }

    // 2. Delete product record
    const { error: pErr } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (pErr) {
      console.error('Delete product error:', pErr);
      return { success: false, error: pErr.message || JSON.stringify(pErr) };
    }

    // Clean up local meta
    try {
      localStorage.removeItem(`meiishop_prod_meta_${productId}`);
    } catch (_) {}

    return { success: true };
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
 * 5. Fetch all sale transactions from Supabase with line items
 */
export async function fetchTransactionsFromSupabase() {
  try {
    const { data: txs, error } = await supabase
      .from('sale_transactions')
      .select('*, sale_transaction_items(*)')
      .order('created_at', { ascending: false });

    if (error || !txs) {
      console.warn('fetchTransactionsFromSupabase error:', error);
      return null;
    }

    // Map database fields to application model
    const mapped = txs.map((t) => {
      let cachedMeta = null;
      try {
        const raw = localStorage.getItem(`meiishop_tx_meta_${t.id}`);
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

      return {
        id: t.id,
        receiptNumber: t.receipt_number,
        createdAt: t.created_at,
        date: new Date(t.created_at).toLocaleString('lo-LA'),
        customerName: t.customer_name || 'ລູກຄ້າທົ່ວໄປ',
        cashierName: t.cashier_name || 'ໄມ້ຄຳ (Meii)',
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
        isDebt: Boolean(cachedMeta?.receipt?.isDebt || cachedMeta?.isDebt || cleanPaymentMethod === 'debt'),
        debtAmount: Number(cachedMeta?.receipt?.debtAmount ?? cachedMeta?.debtAmount ?? (cleanPaymentMethod === 'debt' ? (Number(t.grand_total) || 0) : 0)),
        paidAmount: Number(cachedMeta?.receipt?.paidAmount ?? cachedMeta?.paidAmount ?? (cleanPaymentMethod === 'debt' ? 0 : Number(t.amount_tendered || t.grand_total) || 0)),
        debtNote: cachedMeta?.receipt?.debtNote || cachedMeta?.debtNote || '',
        debtStatus: cachedMeta?.receipt?.debtStatus || cachedMeta?.debtStatus || (cleanPaymentMethod === 'debt' ? 'unpaid' : 'paid'),
        sale_transaction_items: t.sale_transaction_items || [],
        items: (() => {
          if (cachedMeta?.items && Array.isArray(cachedMeta.items) && cachedMeta.items.length > 0) {
            return cachedMeta.items;
          }
          if (Array.isArray(cachedMeta) && cachedMeta.length > 0) {
            return cachedMeta;
          }

          return (t.sale_transaction_items || []).map((i) => ({
            product: { id: i.product_id, name: i.product_name },
            productName: i.product_name,
            unit: {
              unitName: i.unit_name,
              multiplier: Number(i.multiplier) || 1,
              retailPrice: Number(i.unit_price) || 0,
              wholesalePrice: Number(i.unit_price) || 0,
            },
            unitName: i.unit_name,
            quantity: Number(i.quantity) || 1,
            lineTotal: Number(i.line_total) || ((Number(i.unit_price) || 0) * (Number(i.quantity) || 1)),
          }));
        })(),
      };
    });

    return mapped;
  } catch (e) {
    console.warn('fetchTransactionsFromSupabase error:', e);
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
    // 1. Insert into sale_transactions
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
      total_cost: Number(tx.totalCost) || 0,
      gross_profit: Number(tx.grossProfit) || 0,
      cashier_name: tx.cashierName || 'ໄມ້ຄຳ (Meii)',
    });

    if (txErr) {
      console.error('Transaction insert error:', txErr);
      return { success: false, error: txErr.message || JSON.stringify(txErr) };
    }

    // 2. Insert into sale_transaction_items (Requires valid UUID for 'id' and non-null 'product_id')
    if (tx.items && tx.items.length > 0) {
      const itemsPayload = tx.items.map((item) => {
        const prodId = item.product?.id || item.productId || 'p_custom';
        const unitPrice = Number(
          item.customPrice !== undefined
            ? item.customPrice
            : tx.isWholesale
            ? item.unit?.wholesalePrice
            : item.unit?.retailPrice
        ) || 0;
        const qty = Number(item.quantity) || 1;
        const lineTotal = Number(item.lineTotal || (unitPrice * qty));
        const multiplier = Number(item.unit?.multiplier) || 1;
        const baseCost = Number(item.product?.costPerBaseUnit) || 0;
        const lineCost = baseCost * multiplier * qty;
        const lineProfit = lineTotal - lineCost;

        return {
          id: generateUUID(),
          transaction_id: tx.id,
          product_id: prodId,
          product_name: item.productName || item.product?.name || 'ສິນຄ້າ',
          unit_name: item.unit?.unitName || item.unitName || 'ອັນ',
          multiplier,
          quantity: qty,
          unit_price: unitPrice,
          line_total: lineTotal,
          line_cost: lineCost,
          line_profit: lineProfit,
        };
      });

      const { error: itemErr } = await supabase.from('sale_transaction_items').insert(itemsPayload);
      if (itemErr) {
        console.error('Transaction items insert error:', itemErr);
        // Note: we still continue to stock deduction, but log clearly
      }
    }

    // 3. Deduct stock in Supabase products table
    if (stockDeductions && stockDeductions.length > 0) {
      for (const d of stockDeductions) {
        if (d.productId) {
          const { error: sErr } = await supabase
            .from('products')
            .update({
              current_stock_base_units: d.newStock,
              updated_at: new Date().toISOString(),
            })
            .eq('id', d.productId);

          if (sErr) console.warn('Stock update warning for', d.productId, sErr);
        }
      }
    }

    return { success: true };
  } catch (e) {
    console.error('createSaleTransactionInSupabase exception:', e);
    return { success: false, error: e.message || String(e) };
  }
}

// Backward compatibility alias
export const syncSaleTransactionToSupabase = createSaleTransactionInSupabase;

/**
 * 7. Void / Cancel a Sale Transaction in Supabase and restore product stock
 * (Does NOT delete the record; marks status as cancelled and restores stock for tracked products)
 */
export async function cancelTransactionInSupabase(txId, itemsToRestore = [], originalPaymentMethod = 'cash') {
  try {
    // 1. Mark status as cancelled in Supabase sale_transactions table
    const cancelledPaymentMethod = `cancelled:${originalPaymentMethod || 'cash'}`;
    const { error: txErr } = await supabase
      .from('sale_transactions')
      .update({
        payment_method: cancelledPaymentMethod,
      })
      .eq('id', txId);

    if (txErr) {
      console.warn('cancelTransactionInSupabase update warning:', txErr);
    }

    // 2. Restore product stock in Supabase products table
    if (itemsToRestore && itemsToRestore.length > 0) {
      for (const item of itemsToRestore) {
        if (item.productId && item.unitsToRestore) {
          const { data: p } = await supabase
            .from('products')
            .select('current_stock_base_units, track_stock')
            .eq('id', item.productId)
            .single();

          if (p && p.track_stock !== false) {
            const currentStock = Number(p.current_stock_base_units) || 0;
            const newStock = currentStock + Number(item.unitsToRestore);
            await supabase
              .from('products')
              .update({
                current_stock_base_units: newStock,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.productId);
          }
        }
      }
    }

    // 3. Update localStorage metadata
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
        status: 'cancelled',
        isCancelled: true,
        cancelledAt: new Date().toISOString(),
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

    // 3. Restore product stock if items provided
    if (itemsToRestore && itemsToRestore.length > 0) {
      for (const item of itemsToRestore) {
        if (item.productId && item.unitsToRestore) {
          const { data: p } = await supabase
            .from('products')
            .select('current_stock_base_units, track_stock')
            .eq('id', item.productId)
            .single();

          if (p && p.track_stock !== false) {
            const currentStock = Number(p.current_stock_base_units) || 0;
            const newStock = currentStock + Number(item.unitsToRestore);
            await supabase
              .from('products')
              .update({
                current_stock_base_units: newStock,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.productId);
          }
        }
      }
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

    // 2. Cascade update to products table (supports both category_id if present and category text)
    if (oldName) {
      await supabase
        .from('products')
        .update({ category: cleanName })
        .eq('category', oldName);
    }

    // Attempt category_id update gracefully if column exists
    try {
      await supabase
        .from('products')
        .update({ category: cleanName })
        .eq('category_id', id);
    } catch {
      // ignore if category_id column doesn't exist yet
    }

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


