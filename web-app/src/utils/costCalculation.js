/**
 * Core Cost & Profit Calculation Engine (Single Source of Truth)
 * Standardizes unit conversion rates, half-carton multipliers,
 * transaction item costs, and invoice profit metrics across MeiiShop.
 */

/**
 * Calculate accurate unit cost, line cost, and conversion multiplier for any sale item.
 * Prevents double-division bugs for half-cartons (ເຄິ່ງແກັດ).
 * 
 * Rules:
 * - 1 full carton: multiplier = full carton multiplier (e.g. 500 or 4).
 * - 1/2 carton: multiplier = full carton multiplier / 2 (e.g. 250 or 2).
 * - Sub-unit (pack/bottle): multiplier = sub-unit multiplier (e.g. 10 or 1).
 * 
 * @param {Object} item Cart item or transaction item
 * @returns {Object} { multiplier, unitCost, lineCost, hasCost, isHalfCarton }
 */
export function calculateItemCostAndMultiplier(item) {
  if (!item) {
    return { multiplier: 1, unitCost: 0, lineCost: 0, hasCost: false, isHalfCarton: false };
  }

  // 1. Bundle products (Mixed carton / Nuoc ngot mix vi)
  const isBundle = Boolean(
    item.isBundle ||
    item.is_bundle ||
    item.bundleComponents?.length ||
    item.bundle_components?.length ||
    (typeof item.productId === 'string' && (item.productId.startsWith('bnd_') || item.productId.startsWith('bundle_'))) ||
    (typeof item.product_id === 'string' && (item.product_id.startsWith('bnd_') || item.product_id.startsWith('bundle_')))
  );

  if (isBundle) {
    const components = item.bundleComponents || item.bundle_components || [];
    let bundleCost = 0;
    components.forEach((c) => {
      const compBaseCost = Number(
        c.product?.costPerBaseUnit ??
        c.product?.cost_per_base_unit ??
        c.costPerBaseUnit ??
        c.cost_per_base_unit ??
        0
      );
      const compQty = Number(c.quantity || c.qty) || 1;
      bundleCost += compBaseCost * compQty;
    });

    const qty = Number(item.quantity) || 1;
    const lineCost = Math.round(bundleCost * qty);
    return {
      multiplier: 1,
      unitCost: bundleCost,
      lineCost,
      hasCost: bundleCost > 0,
      isHalfCarton: false,
    };
  }

  // 2. Identify if item is Half-Carton
  const rawUnitName = String(item.unit?.unitName || item.unitName || item.unit_name || '');
  const isHalfCarton = Boolean(
    item.isHalfCarton ||
    rawUnitName.includes('½') ||
    rawUnitName.includes('1/2')
  );

  // 3. Resolve base cost per base unit
  const baseCost = Number(
    item.product?.costPerBaseUnit ??
    item.product?.cost_per_base_unit ??
    item.costPerBaseUnit ??
    item.cost_per_base_unit ??
    0
  );

  // Explicit carton cost if defined on the product (e.g. costLak = 3,170,000)
  const prodCartonCost = Number(
    item.product?.costLak ??
    item.product?.cost_lak ??
    item.product?.costKip ??
    item.costLak ??
    item.cost_lak ??
    0
  );

  // 4. Resolve clean multiplier without compounding division
  // If item.unit.multiplier is present, that is the definition multiplier of the original unit (e.g. 500 or 4)
  const rawUnitMultiplier = Number(item.unit?.multiplier);
  let effectiveMultiplier = 1;

  if (Number.isFinite(rawUnitMultiplier) && rawUnitMultiplier > 0) {
    // Definitive unit multiplier exists (from product definition)
    effectiveMultiplier = isHalfCarton
      ? (rawUnitMultiplier > 1 ? rawUnitMultiplier / 2 : 0.5)
      : rawUnitMultiplier;
  } else if (item.effectiveMultiplier !== undefined && item.effectiveMultiplier !== null) {
    // Pre-computed effective multiplier: DO NOT divide by 2 again!
    effectiveMultiplier = Number(item.effectiveMultiplier) || 1;
  } else if (item.multiplier !== undefined && item.multiplier !== null) {
    // Saved multiplier from DB: DO NOT divide by 2 again!
    effectiveMultiplier = Number(item.multiplier) || 1;
  } else {
    effectiveMultiplier = isHalfCarton ? 0.5 : 1;
  }

  // 5. Calculate Unit Cost
  let unitCost = 0;
  if (baseCost > 0) {
    unitCost = Math.round(baseCost * effectiveMultiplier);
  } else if (isHalfCarton && prodCartonCost > 0) {
    // Half carton cost is exactly 50% of full carton cost
    unitCost = Math.round(prodCartonCost / 2);
  } else if (prodCartonCost > 0 && effectiveMultiplier >= 1) {
    // Fallback if baseCost was 0 but carton cost was set
    const cartonUnit = item.product?.units?.find((u) => !u.isBaseUnit);
    const cartonMult = Number(cartonUnit?.multiplier) || 1;
    unitCost = Math.round((prodCartonCost / cartonMult) * effectiveMultiplier);
  }

  const qty = Number(item.quantity) || 1;
  const lineCost = Math.round(unitCost * qty);

  return {
    multiplier: effectiveMultiplier,
    unitCost,
    lineCost,
    hasCost: unitCost > 0,
    isHalfCarton,
  };
}

/**
 * Recalculate transaction financial totals from its final items array.
 * Ensures 100% mathematical consistency across total_amount, total_cost, and gross_profit.
 * 
 * @param {Array} items Array of items in transaction
 * @param {number} exchangeRate Exchange rate Kip/Baht
 * @returns {Object}
 */
export function recalculateTransactionTotals(items = [], exchangeRate = 0) {
  const safeItems = Array.isArray(items) ? items : [];
  const rate = Number(exchangeRate) || 0;

  let totalAmountLak = 0;
  let totalCostLak = 0;
  let zeroCostCount = 0;
  let zeroCostRevenue = 0;
  let totalQuantity = 0;

  safeItems.forEach((it) => {
    const qty = Number(it.quantity) || 1;
    totalQuantity += qty;

    const uPrice = Number(
      it.unit_price !== undefined && it.unit_price !== null
        ? it.unit_price
        : it.effectivePrice !== undefined && it.effectivePrice !== null
        ? it.effectivePrice
        : it.customPrice !== undefined && it.customPrice !== null
        ? it.customPrice
        : it.unitPrice !== undefined && it.unitPrice !== null
        ? it.unitPrice
        : it.price !== undefined && it.price !== null
        ? it.price
        : it.unit?.retailPrice || 0
    );
    const lineTotal = Number(
      it.line_total !== undefined && it.line_total !== null && Number(it.line_total) > 0
        ? it.line_total
        : it.lineTotal !== undefined && it.lineTotal !== null && Number(it.lineTotal) > 0
        ? it.lineTotal
        : (uPrice * qty)
    );
    totalAmountLak += lineTotal;

    const explicitLineCost = Number(it.line_cost ?? it.lineCost ?? 0);
    let lineCost = 0;

    if (explicitLineCost > 0) {
      lineCost = explicitLineCost;
    } else {
      const costInfo = calculateItemCostAndMultiplier(it);
      lineCost = costInfo.lineCost;
    }

    if (lineCost > 0) {
      totalCostLak += lineCost;
    } else {
      zeroCostCount += 1;
      zeroCostRevenue += lineTotal;
    }
  });

  const grossProfitLak = totalAmountLak - totalCostLak;
  const totalAmountThb = rate > 0 ? Number((totalAmountLak / rate).toFixed(2)) : 0;
  const totalCostThb = rate > 0 ? Number((totalCostLak / rate).toFixed(2)) : 0;
  const grossProfitThb = Number((totalAmountThb - totalCostThb).toFixed(2));
  const overallMargin = totalAmountLak > 0 ? ((grossProfitLak / totalAmountLak) * 100).toFixed(1) : '0';

  return {
    totalQuantity,
    totalAmountLak,
    totalCostLak,
    grossProfitLak,
    totalAmountThb,
    totalCostThb,
    grossProfitThb,
    overallMargin,
    zeroCostCount,
    zeroCostRevenue,
    hasIncompleteCost: zeroCostCount > 0,
    hasAnyCost: totalCostLak > 0,
  };
}
