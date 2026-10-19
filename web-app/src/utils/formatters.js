// Utility currency formatters (STRICTLY LAO KIP ONLY FOR BILLING)
export const formatKip = (val) => {
  const n = Math.round(Number(val) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₭';
};

export const formatBaht = (val) => {
  const n = Math.round(Number(val) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ฿';
};

/**
 * Calculates whole carton (nguyên thùng / ແກັດ / ລັງ) cost in Kip and Baht
 */
export const getCartonUnitInfo = (product, exchangeRate = 0) => {
  if (!product) return { cartonMultiplier: 1, cartonUnitName: 'ລັງ', cartonCostKip: 0, cartonCostBaht: 0 };
  
  const units = product.units || [];
  const cartonUnit =
    units.find(
      (u) =>
        u.tier === 3 ||
        u.id?.endsWith('_carton') ||
        u.unitName === 'ລັງ' ||
        u.unitName === 'ແກັດ' ||
        u.unitName === 'ເປົາ' ||
        u.unitName === 'ກະສອບ' ||
        u.unitName === 'ກ່ອງ'
    ) || units[units.length - 1];

  const cartonMultiplier = cartonUnit ? (cartonUnit.multiplier || 1) : 1;
  const cartonUnitName = cartonUnit ? cartonUnit.unitName : (product.baseUnit || 'ລັງ');
  
  let cartonCostKip = 0;
  let cartonCostBaht = 0;

  if (product.costKip !== undefined && product.costKip !== null && product.costKip !== '') {
    cartonCostKip = Number(product.costKip);
  } else {
    cartonCostKip = (Number(product.costPerBaseUnit) || 0) * cartonMultiplier;
  }

  if (product.costBaht !== undefined && product.costBaht !== null && product.costBaht !== '') {
    cartonCostBaht = Number(product.costBaht);
  } else if (product.cost_thb !== undefined && product.cost_thb !== null && product.cost_thb !== '') {
    cartonCostBaht = Number(product.cost_thb);
  } else {
    cartonCostBaht = 0;
  }

  return {
    cartonMultiplier,
    cartonUnitName,
    cartonCostKip,
    cartonCostBaht,
  };
};

/**
 * Strips non-digits and formats integers with Lao dot thousands separator (e.g. "240000" -> "240.000")
 */
export const formatDots = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const clean = String(val).replace(/\D/g, '');
  if (!clean) return '';
  const n = parseInt(clean, 10);
  if (isNaN(n)) return '';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/**
 * Parses dot-formatted string back to integer (e.g. "240.000" -> 240000)
 */
export const parseDots = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const clean = String(val).replace(/\D/g, '');
  return clean ? parseInt(clean, 10) : 0;
};

/**
 * Safe currency parser that strips thousands separators and symbols (e.g. "200.000 ₭" -> 200000)
 */
export const parseCurrencyInput = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const clean = String(val).replace(/\D/g, '');
  return clean ? parseInt(clean, 10) : 0;
};

/**
 * Resolves active units sorted by multiplier descending
 */
export const getSortedUnits = (product) => {
  if (!product) return [];
  if (Array.isArray(product.units) && product.units.length > 0) {
    const isPieceActive = product.tier3_active !== undefined
      ? Boolean(product.tier3_active)
      : (product.tierSettings?.enablePiece !== undefined ? Boolean(product.tierSettings.enablePiece) : true);
    const isPackActive = product.tier2_active !== undefined
      ? Boolean(product.tier2_active)
      : (product.tierSettings?.enablePack !== undefined ? Boolean(product.tierSettings.enablePack) : true);
    const isCartonActive = product.tier1_active !== undefined
      ? Boolean(product.tier1_active)
      : (product.tierSettings?.enableCarton !== undefined ? Boolean(product.tierSettings.enableCarton) : true);

    const filtered = product.units.filter((u) => {
      if (!u) return false;
      if (u.tier === 3 || u.id?.endsWith('_carton')) return isCartonActive;
      if (u.tier === 2 || u.id?.endsWith('_pack')) return isPackActive;
      if (u.tier === 1 || u.id?.endsWith('_piece')) return isPieceActive;
      return true;
    });

    return filtered.slice().sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1));
  }
  return [];
};

/**
 * Returns raw negative compound string (e.g. "-2 ແກັດ" or "-2 ແກັດ 1 ອັນ" or "-6 ອັນ")
 */
export const formatNegativeStockCompound = (stockOrProduct, productUnits = null, baseUnitName = 'ອັນ') => {
  let stock = 0;
  let units = productUnits;
  let baseUnit = baseUnitName;

  if (typeof stockOrProduct === 'object' && stockOrProduct !== null) {
    stock = Number(stockOrProduct.currentStockBaseUnits ?? stockOrProduct.current_stock_base_units ?? 0);
    units = units || getSortedUnits(stockOrProduct);
    baseUnit = stockOrProduct.baseUnit || stockOrProduct.base_unit || baseUnit;
  } else {
    stock = Number(stockOrProduct || 0);
  }

  if (stock >= 0) return '';

  let sorted = [];
  if (Array.isArray(units) && units.length > 0) {
    sorted = units
      .filter((u) => u && u.unitName)
      .slice()
      .sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1));
  }

  let remaining = Math.abs(stock);
  const parts = [];

  if (sorted.length > 0) {
    for (let i = 0; i < sorted.length; i++) {
      const u = sorted[i];
      const m = Math.max(1, Number(u.multiplier) || 1);
      if (i < sorted.length - 1) {
        if (m > 1) {
          const count = Math.floor(remaining / m);
          if (count > 0) {
            parts.push(`${count} ${u.unitName}`);
            remaining %= m;
          }
        }
      } else {
        if (remaining > 0 || parts.length === 0) {
          parts.push(`${remaining} ${u.unitName}`);
        }
      }
    }
  } else {
    parts.push(`${remaining} ${baseUnit}`);
  }

  return `-${parts.join(' ')}`;
};

/**
 * ERP Smart Stock Formatting Helper
 * - stock > 0: Compound breakdown (e.g. "71 ແກັດ 1 ແພັກ")
 * - stock === 0: "ໝົດສະຕັອກ (0)"
 * - stock < 0: Negative compound breakdown inside parentheses with prefix:
 *   e.g. "ໝົດສະຕັອກ (-2 ແກັດ)" or "ຕິດລົບ (-2 ແກັດ)"
 */
export const formatStockDisplay = (
  stockOrProduct,
  productUnits = null,
  baseUnitName = 'ອັນ',
  { prefix = 'ໝົດສະຕັອກ' } = {}
) => {
  let stock = 0;
  let units = productUnits;
  let baseUnit = baseUnitName;

  if (typeof stockOrProduct === 'object' && stockOrProduct !== null) {
    const p = stockOrProduct;
    if (p.trackStock === false || p.track_stock === false) {
      return 'ບໍ່ນັບສາງ';
    }
    stock = Number(p.currentStockBaseUnits ?? p.current_stock_base_units ?? 0);
    units = units || getSortedUnits(p);
    baseUnit = p.baseUnit || p.base_unit || baseUnit;
  } else {
    stock = Number(stockOrProduct || 0);
  }

  if (stock === 0) {
    return `${prefix} (0)`;
  }

  if (stock < 0) {
    const negCompound = formatNegativeStockCompound(stock, units, baseUnit);
    return `${prefix} (${negCompound})`;
  }

  // Positive stock breakdown
  let sorted = [];
  if (Array.isArray(units) && units.length > 0) {
    sorted = units
      .filter((u) => u && u.unitName)
      .slice()
      .sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1));
  }

  let remaining = stock;
  const parts = [];

  if (sorted.length > 0) {
    for (let i = 0; i < sorted.length; i++) {
      const u = sorted[i];
      const m = Math.max(1, Number(u.multiplier) || 1);
      if (i < sorted.length - 1) {
        if (m > 1) {
          const count = Math.floor(remaining / m);
          if (count > 0) {
            parts.push(`${count} ${u.unitName}`);
            remaining %= m;
          }
        }
      } else {
        if (remaining > 0 || parts.length === 0) {
          parts.push(`${remaining} ${u.unitName}`);
        }
      }
    }
  } else {
    parts.push(`${remaining} ${baseUnit}`);
  }

  return parts.join(' ');
};

/**
 * Formats compound stock breakdown (e.g. "28 ແກັດ 7 ແພັກ (ລວມທັງໝົດ: 231 ແພັກ)" or "ບໍ່ນັບສາງ")
 */
export const formatCompoundStock = (product) => {
  if (!product) return 'ບໍ່ນັບສາງ';
  if (product.trackStock === false || product.track_stock === false) {
    return 'ບໍ່ນັບສາງ';
  }

  const rawStock = product.currentStockBaseUnits ?? product.current_stock_base_units;
  if (rawStock === null || rawStock === undefined || isNaN(rawStock)) {
    return 'ບໍ່ນັບສາງ';
  }

  const total = Number(rawStock);
  const isNeg = total < 0;
  if (total === 0) return 'ໝົດສາງ (0)';
  if (isNeg) {
    const negCompound = formatNegativeStockCompound(product);
    return `ຕິດລົບ (${negCompound})`;
  }

  const absTotal = total;

  const isPieceActive = product.tier3_active !== undefined
    ? Boolean(product.tier3_active)
    : (product.tierSettings?.enablePiece !== undefined ? Boolean(product.tierSettings.enablePiece) : Boolean(product.units?.some(u => u.tier === 1 || u.id?.endsWith('_piece'))));

  const isPackActive = product.tier2_active !== undefined
    ? Boolean(product.tier2_active)
    : (product.tierSettings?.enablePack !== undefined ? Boolean(product.tierSettings.enablePack) : Boolean(product.units?.some(u => u.tier === 2 || u.id?.endsWith('_pack'))));

  const isCartonActive = product.tier1_active !== undefined
    ? Boolean(product.tier1_active)
    : (product.tierSettings?.enableCarton !== undefined ? Boolean(product.tierSettings.enableCarton) : Boolean(product.units?.some(u => u.tier === 3 || u.id?.endsWith('_carton'))));

  const units = product.units || [];
  const rawCartonUnit = units.find(
    (u) =>
      u.tier === 3 ||
      u.id?.endsWith('_carton') ||
      ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງໃຫຍ່', 'ຖັງ'].includes(u.unitName)
  );
  const rawPackUnit = units.find(
    (u) =>
      (u.tier === 2 ||
        u.id?.endsWith('_pack') ||
        ['ແພັກ', 'ມັດ', 'ແຕະ', 'ໂหล', 'ຖົງກາງ'].includes(u.unitName)) &&
      (!rawCartonUnit || u.id !== rawCartonUnit.id)
  );
  const rawPieceUnit = units.find(
    (u) =>
      (u.tier === 1 ||
        u.id?.endsWith('_piece') ||
        ['ອັນ', 'ແກ້ວ', 'ຖົງ', 'ກະປ໋ອງ', 'ຕຸກ', 'ຊອງ', 'ກ່ອງນ້ອຍ'].includes(u.unitName)) &&
      (!rawCartonUnit || u.id !== rawCartonUnit.id) &&
      (!rawPackUnit || u.id !== rawPackUnit.id)
  );

  const cartonUnit = isCartonActive ? rawCartonUnit : null;
  const packUnit = isPackActive ? rawPackUnit : null;
  const pieceUnit = isPieceActive ? rawPieceUnit : null;

  const parts = [];

  // Case 1: All 3 tiers are active (Carton + Pack + Piece)
  if (cartonUnit && packUnit && pieceUnit && cartonUnit.multiplier > packUnit.multiplier) {
    const piecesPerPack = packUnit.multiplier || 1;
    const piecesPerCarton = cartonUnit.multiplier || (piecesPerPack * 6);
    const cartons = Math.floor(absTotal / piecesPerCarton);
    const rem = absTotal % piecesPerCarton;
    const packs = Math.floor(rem / piecesPerPack);
    const pieces = rem % piecesPerPack;

    if (cartons > 0) parts.push(`${cartons} ${cartonUnit.unitName}`);
    if (packs > 0) parts.push(`${packs} ${packUnit.unitName}`);
    if (pieces > 0) parts.push(`${pieces} ${pieceUnit.unitName}`);
  }
  // Case 2: Carton & Pack are active, Piece is INACTIVE (Pack IS the base unit)
  else if (cartonUnit && packUnit && !pieceUnit) {
    const packsPerCarton = cartonUnit.multiplier || 8;
    const cartons = Math.floor(absTotal / packsPerCarton);
    const packs = absTotal % packsPerCarton;

    if (cartons > 0) parts.push(`${cartons} ${cartonUnit.unitName}`);
    if (packs > 0) parts.push(`${packs} ${packUnit.unitName}`);

    // If there are cartons, append total packs summary
    if (cartons > 0) {
      const summaryStr = parts.length > 0 ? parts.join(' ') : `0 ${packUnit.unitName}`;
      const fullStr = `${summaryStr} (ລວມທັງໝົດ: ${absTotal} ${packUnit.unitName})`;
      return isNeg ? `-${fullStr}` : fullStr;
    }
  }
  // Case 3: Carton & Piece are active, Pack is INACTIVE (Piece is base unit)
  else if (cartonUnit && pieceUnit && !packUnit) {
    const piecesPerCarton = cartonUnit.multiplier || 25;
    const cartons = Math.floor(absTotal / piecesPerCarton);
    const pieces = absTotal % piecesPerCarton;

    if (cartons > 0) parts.push(`${cartons} ${cartonUnit.unitName}`);
    if (pieces > 0) parts.push(`${pieces} ${pieceUnit.unitName}`);
  }
  // Case 4: Pack & Piece are active, Carton is INACTIVE (Piece is base unit)
  else if (packUnit && pieceUnit && !cartonUnit) {
    const piecesPerPack = packUnit.multiplier || 6;
    const packs = Math.floor(absTotal / piecesPerPack);
    const pieces = absTotal % piecesPerPack;

    if (packs > 0) parts.push(`${packs} ${packUnit.unitName}`);
    if (pieces > 0) parts.push(`${pieces} ${pieceUnit.unitName}`);
  }
  // Case 5: Single active tier (e.g. Beer carton-only, or single piece)
  else {
    const mainUnit = cartonUnit || packUnit || pieceUnit || units[0];
    const unitName = mainUnit ? mainUnit.unitName : (product.baseUnit || 'ອັນ');
    parts.push(`${absTotal} ${unitName}`);
  }

  const result = parts.length > 0 ? parts.join(' ') : `0 ${product.baseUnit || 'ອັນ'}`;
  return isNeg ? `-${result}` : result;
};

/**
 * Formats a number to Thai Baht with thousand dots (e.g. 1600000 -> "1.600.000", 250 -> "250", 1600000.5 -> "1.600.000,50")
 */
export const formatThb = (val) => {
  if (val === null || val === undefined || val === '') return '0';
  const num = Number(val);
  if (isNaN(num)) return '0';
  const isInt = num % 1 === 0;
  if (isInt) {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  const parts = num.toFixed(2).split('.');
  const intFormatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFormatted},${parts[1]}`;
};

/**
 * Parses THB formatted string back to float (e.g. "1.600.000" -> 1600000, "1.600.000,50" -> 1600000.5)
 */
export const parseThb = (val) => {
  if (!val && val !== 0) return 0;
  const clean = String(val).replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};

/**
 * Auto-formats THB input while user is typing
 * Handles:
 * 250 -> "250"
 * 1600000 -> "1.600.000"
 * 1600000,50 or 1600000.50 -> "1.600.000,50"
 */
export const formatThbTyping = (inputStr) => {
  if (!inputStr && inputStr !== 0) return '';
  let str = String(inputStr).trim();
  if (str === '') return '';

  let clean = str.replace(/[^0-9.,]/g, '');

  let parts;
  if (clean.includes(',')) {
    parts = clean.split(',');
  } else if ((clean.match(/\./g) || []).length === 1 && clean.indexOf('.') === clean.length - 1) {
    parts = [clean.slice(0, -1), ''];
  } else {
    parts = [clean.replace(/\./g, '')];
  }

  const intRaw = parts[0].replace(/\D/g, '');
  if (!intRaw && parts.length === 1) return '';
  const intFormatted = intRaw ? intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '0';

  if (parts.length > 1) {
    const decRaw = parts[1].replace(/\D/g, '').slice(0, 2);
    return `${intFormatted},${decRaw}`;
  }
  return intFormatted;
};

/**
 * Formats base units into compound text according to highest active unit (e.g. "+10 ແກັດ 2 ແພັກ")
 */
export const formatCompoundStockUnits = (totalBaseUnits, sortedUnits = []) => {
  if (!sortedUnits || sortedUnits.length === 0) return `${totalBaseUnits}`;
  if (sortedUnits.length === 1) return `${totalBaseUnits} ${sortedUnits[0].unitName}`;
  if (totalBaseUnits === 0) return `0 ${sortedUnits[0].unitName}`;

  const isNeg = totalBaseUnits < 0;
  let remaining = Math.abs(totalBaseUnits);
  const parts = [];

  for (let i = 0; i < sortedUnits.length; i++) {
    const u = sortedUnits[i];
    const m = u.multiplier || 1;
    if (i < sortedUnits.length - 1) {
      if (m > 1) {
        const count = Math.floor(remaining / m);
        if (count > 0) {
          parts.push(`${count} ${u.unitName}`);
          remaining %= m;
        }
      }
    } else {
      if (remaining > 0 || parts.length === 0) {
        parts.push(`${remaining} ${u.unitName}`);
      }
    }
  }

  const text = parts.join(' ');
  return isNeg ? `-${text}` : text;
};

/**
 * Resolves the unit price according to selected price tier:
 * Tier 1: Standard retail price (retailPrice) - Default on POS
 * Tier 2: Regular customer price (price_2), fallbacks to Tier 1 if 0/empty
 * Tier 3: Wholesale / VIP price (price_3), fallbacks to Tier 1 if 0/empty
 */
export const getEffectiveUnitPrice = (unit, tier = 1) => {
  if (!unit) return 0;
  const p1 = Number(unit.retailPrice ?? unit.retail_price ?? unit.price ?? 0);
  if (tier === 2) {
    const p2 = Number(unit.price_2 ?? unit.price2 ?? 0);
    return p2 > 0 ? p2 : p1;
  }
  if (tier === 3) {
    const p3 = Number(unit.price_3 ?? unit.price3 ?? 0);
    return p3 > 0 ? p3 : p1;
  }
  return p1;
};

/**
 * Price tier configurations for POS selection
 */
export const PRICE_TIERS = [
  { tier: 1, label: 'ລາຄາ 1', desc: 'ມາດຕະຖານ', shortDesc: 'ມາດຕະຖານ' },
  { tier: 2, label: 'ລາຄາ 2', desc: 'ລູກຄ້າປະຈຳ', shortDesc: 'ລູກຄ້າປະຈຳ' },
  { tier: 3, label: 'ລາຄາ 3', desc: 'ລາຄາສົ່ງ / VIP', shortDesc: 'ຂາຍສົ່ງ/VIP' },
];

/**
 * Formats stock simplified to the highest available packaging unit (e.g. "0 ຕັບ", "2 ແກັດ", "5 ອັນ")
 * Omits breakdown formula like "| 1 ຕັບ = 60 ອັນ"
 */
export const getProductHighestStockDisplay = (product) => {
  if (!product) return '0';
  if (product.trackStock === false || product.track_stock === false) {
    return 'ບໍ່ນັບສາງ';
  }

  const rawStock = Number(product.currentStockBaseUnits ?? product.current_stock_base_units ?? 0);
  const prodUnits = (product.units || []).filter((u) => u && u.isActive !== false);
  const sorted = [...prodUnits].sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1));

  if (sorted.length > 0) {
    const topUnit = sorted[0];
    const mult = Math.max(1, Number(topUnit.multiplier) || 1);
    const unitName = topUnit.unitName || product.baseUnit || 'ອັນ';

    if (mult > 1) {
      const count = Math.floor(rawStock / mult);
      const rem = rawStock % mult;
      if (rem > 0) {
        return count > 0
          ? `${count} ${unitName} ${rem} ${product.baseUnit || 'ອັນ'}`
          : `${rem} ${product.baseUnit || 'ອັນ'}`;
      }
      return `${count} ${unitName}`;
    }
    return `${rawStock} ${unitName}`;
  }

  return `${rawStock} ${product.baseUnit || 'ອັນ'}`;
};

