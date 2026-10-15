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
export const getCartonUnitInfo = (product, exchangeRate = 720) => {
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
  } else if (exchangeRate > 0 && cartonCostKip > 0) {
    cartonCostBaht = Math.round(cartonCostKip / exchangeRate);
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
 * Formats compound stock breakdown (e.g. "28 ແກັດ 7 ແພັກ (ລວມທັງໝົດ: 231 ແພັກ)" or "ບໍ່ນັບສາງ")
 */
export const formatCompoundStock = (product) => {
  if (!product) return 'ບໍ່ນັບສາງ';
  if (product.trackStock === false) {
    return 'ບໍ່ນັບສາງ';
  }

  if (product.currentStockBaseUnits === null || product.currentStockBaseUnits === undefined || isNaN(product.currentStockBaseUnits)) {
    return 'ບໍ່ນັບສາງ';
  }

  const total = Number(product.currentStockBaseUnits);
  if (total === 0) return 'ໝົດສາງ (0)';

  const isNeg = total < 0;
  const absTotal = Math.abs(total);

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
