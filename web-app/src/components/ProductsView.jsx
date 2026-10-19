import React, { useState, useMemo } from 'react';
import {
  Warehouse,
  Plus,
  PencilSimple,
  Trash,
  Package,
  ArrowClockwise,
  MagnifyingGlass,
  Barcode,
  CheckCircle,
  WarningCircle,
  Folders
} from '@phosphor-icons/react';
import { formatKip, formatBaht, getCartonUnitInfo, formatStockDisplay, formatNegativeStockCompound } from '../utils/formatters';
import BarcodeScannerModal from './BarcodeScannerModal';
import { useHardwareBarcodeScanner } from '../hooks/useHardwareBarcodeScanner';
import { playSuccessBeep, playErrorBeep } from '../utils/audioFeedback';

/**
 * Shared helper to resolve unit tiers, cost conversions, and stock counts for both Mobile Card & Desktop Table
 */
export function getProductStockDetails(p, exchangeRate = 0) {
  const { cartonUnitName, cartonCostKip, cartonCostBaht } = getCartonUnitInfo(p, exchangeRate);

  const isUntracked = p.trackStock === false;

  const isPieceActive = p.tier3_active !== undefined
    ? Boolean(p.tier3_active)
    : (p.tierSettings?.enablePiece !== undefined ? Boolean(p.tierSettings.enablePiece) : Boolean(p.units?.some(u => u.tier === 1 || u.id?.endsWith('_piece'))));

  const isPackActive = p.tier2_active !== undefined
    ? Boolean(p.tier2_active)
    : (p.tierSettings?.enablePack !== undefined ? Boolean(p.tierSettings.enablePack) : Boolean(p.units?.some(u => u.tier === 2 || u.id?.endsWith('_pack'))));

  const isCartonActive = p.tier1_active !== undefined
    ? Boolean(p.tier1_active)
    : (p.tierSettings?.enableCarton !== undefined ? Boolean(p.tierSettings.enableCarton) : Boolean(p.units?.some(u => u.tier === 3 || u.id?.endsWith('_carton'))));

  const rawCartonUnit = p.units?.find(
    (u) =>
      u.tier === 3 ||
      u.id?.endsWith('_carton') ||
      ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງໃຫຍ່', 'ຖັງ'].includes(u.unitName)
  );
  const rawPackUnit = p.units?.find(
    (u) =>
      (u.tier === 2 ||
        u.id?.endsWith('_pack') ||
        ['ແພັກ', 'ມັດ', 'ແຕະ', 'ໂหล', 'ຖົງກາງ'].includes(u.unitName)) &&
      (!rawCartonUnit || u.id !== rawCartonUnit.id)
  );
  const rawPieceUnit = p.units?.find(
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

  let cName = cartonUnit?.unitName || p.tierSettings?.cartonUnitName || 'ແກັດ';
  let pName = packUnit?.unitName || p.tierSettings?.packUnitName || 'ແພັກ';
  let pcName =
    pieceUnit?.unitName ||
    p.tierSettings?.pieceUnitName ||
    (p.baseUnit && p.baseUnit !== pName && p.baseUnit !== cName ? p.baseUnit : 'ອັນ');

  if (pName === cName) pName = 'ແພັກ';
  if (pcName === cName || pcName === pName) pcName = 'ອັນ';

  let packsPerCarton = p.tierSettings?.cartonMultiplier;
  if (!packsPerCarton && cartonUnit && packUnit && cartonUnit.multiplier > packUnit.multiplier) {
    packsPerCarton = Math.round(cartonUnit.multiplier / packUnit.multiplier);
  } else if (!packsPerCarton && cartonUnit && cartonUnit.multiplier > 1) {
    packsPerCarton = cartonUnit.multiplier;
  } else if (!packsPerCarton) {
    packsPerCarton = 8;
  }

  let piecesPerPack = p.tierSettings?.packMultiplier;
  if (!piecesPerPack && packUnit && pieceUnit && packUnit.multiplier > pieceUnit.multiplier) {
    piecesPerPack = Math.round(packUnit.multiplier / pieceUnit.multiplier);
  } else if (!piecesPerPack && packUnit && packUnit.multiplier > 1) {
    piecesPerPack = packUnit.multiplier;
  } else if (!piecesPerPack) {
    piecesPerPack = (p.name?.includes('Lay') || p.name?.includes('ເຂົ້າໜົມ')) ? 4 : 6;
  }

  const rawStock = Number(p.currentStockBaseUnits ?? p.current_stock_base_units ?? 0);
  const isNegativeStock = !isUntracked && rawStock < 0;
  const isZeroStock = !isUntracked && rawStock === 0;

  const stockDisplayText = formatStockDisplay(p, null, pcName, { prefix: 'ໝົດສະຕັອກ' });
  const negativeCompound = formatNegativeStockCompound(p, null, pcName);

  const totalBase = rawStock;
  const absBase = Math.abs(rawStock);

  let cartonCount = 0;
  let packCount = 0;
  let pieceCount = 0;
  let totalPacksCount = '0';

  if (!isUntracked) {
    if (cartonUnit && packUnit && pieceUnit) {
      // 3 Tiers Active: Piece is base unit
      const piecesPerCarton = packsPerCarton * piecesPerPack;
      cartonCount = Math.floor(absBase / piecesPerCarton);
      const rem = absBase % piecesPerCarton;
      packCount = Math.floor(rem / piecesPerPack);
      pieceCount = rem % piecesPerPack;
      totalPacksCount = (absBase / piecesPerPack).toFixed(1).replace('.0', '');
    } else if (cartonUnit && packUnit && !pieceUnit) {
      // 2 Tiers Active (Tier 3 OFF): Pack IS the base unit
      cartonCount = Math.floor(absBase / packsPerCarton);
      packCount = absBase % packsPerCarton;
      pieceCount = 0;
      totalPacksCount = absBase.toString();
    } else if (cartonUnit && pieceUnit && !packUnit) {
      // 2 Tiers Active (Tier 2 OFF): Piece is base unit
      const piecesPerCarton = packsPerCarton || cartonUnit.multiplier || 25;
      cartonCount = Math.floor(absBase / piecesPerCarton);
      pieceCount = absBase % piecesPerCarton;
      packCount = 0;
      totalPacksCount = '0';
    } else if (packUnit && pieceUnit && !cartonUnit) {
      // 2 Tiers Active (Tier 1 OFF): Piece is base unit
      packCount = Math.floor(absBase / piecesPerPack);
      pieceCount = absBase % piecesPerPack;
      cartonCount = 0;
      totalPacksCount = (absBase / piecesPerPack).toFixed(1).replace('.0', '');
    } else if (cartonUnit) {
      cartonCount = absBase;
      packCount = 0;
      pieceCount = 0;
      totalPacksCount = '0';
    } else if (packUnit) {
      packCount = absBase;
      cartonCount = 0;
      pieceCount = 0;
      totalPacksCount = absBase.toString();
    } else {
      pieceCount = absBase;
      cartonCount = 0;
      packCount = 0;
      totalPacksCount = '0';
    }
  }

  return {
    cartonUnitName,
    cartonCostKip,
    cartonCostBaht,
    isUntracked,
    isNegativeStock,
    isZeroStock,
    rawStock,
    stockDisplayText,
    negativeCompound,
    cartonUnit,
    packUnit,
    pieceUnit,
    cName,
    pName,
    pcName,
    packsPerCarton,
    piecesPerPack,
    totalBase,
    cartonCount,
    packCount,
    pieceCount,
    totalPacksCount,
  };
}

export default function ProductsView({
  products,
  exchangeRate,
  onAddNewProduct,
  onEditProduct,
  onDeleteProduct,
  onRefreshProducts,
  onOpenCategoryManager,
  isLoading,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedHighlightId, setScannedHighlightId] = useState(null);
  const [scanToast, setScanToast] = useState(null);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => {
      return (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.barcode && String(p.barcode).toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.units &&
          p.units.some(
            (u) =>
              u.unitName.toLowerCase().includes(q) ||
              (u.barcode && String(u.barcode).toLowerCase().includes(q))
          ))
      );
    });
  }, [products, searchTerm]);

  const handleScanBarcode = (barcode) => {
    if (!barcode) return;
    const cleanCode = String(barcode).trim();
    setSearchTerm(cleanCode);
    setScannerOpen(false);

    const matched = products.find(
      (p) =>
        (p.barcode && String(p.barcode).trim().toLowerCase() === cleanCode.toLowerCase()) ||
        (p.units &&
          p.units.some(
            (u) => u.barcode && String(u.barcode).trim().toLowerCase() === cleanCode.toLowerCase()
          ))
    );

    if (matched) {
      playSuccessBeep();
      setScannedHighlightId(matched.id);
      setScanToast({
        type: 'success',
        message: `ພົບສິນຄ້າ "${matched.name}" (${cleanCode})`,
      });
      setTimeout(() => setScanToast(null), 3000);
      setTimeout(() => setScannedHighlightId(null), 6000);
    } else {
      playErrorBeep();
      setScanToast({
        type: 'error',
        message: `ບໍ່ພົບສິນຄ້າທີ່ມີບາໂຄດ: "${cleanCode}"`,
      });
      setTimeout(() => setScanToast(null), 3500);
    }
  };

  // Global Hardware Barcode Scanner Listener for Catalog Screen
  // Auto-populates search filter and focuses on the matched product immediately
  useHardwareBarcodeScanner({
    onScan: handleScanBarcode,
    enabled: true,
    maxInterval: 50,
    minLength: 3,
    preventDefaultOnEnter: true,
    cleanActiveInput: false,
  });

  return (
    <main
      className="flex-1 w-full p-3 sm:p-5 md:p-6 overflow-y-auto font-sans min-h-0 pb-20 sm:pb-24 touch-pan-y"
      style={{
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        paddingBottom: 'max(5rem, calc(4rem + env(safe-area-inset-bottom, 0px)))',
      }}
    >
      {/* 1. Header Toolbar: Responsive Flex with Mobile Wrapping */}
      <div className="flex items-center justify-between pb-3 sm:pb-3.5 border-b border-slate-200/80 mb-3 sm:mb-4 gap-2.5 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
            <Warehouse size={20} className="sm:w-5 sm:h-5" weight="duotone" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="truncate">ລາຍການສິນຄ້າ & ຕົ້ນທຶນບາດ</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                {products.length}
              </span>
            </h2>
            <p className="text-[11.5px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
              ສະແດງລາຄາຕົ້ນທຶນບາດ ແລະ ກີບ ຍົກລັງ/ແກັດ (Carton), ພ້ອມຫົວໜ່ວຍຂາຍ ແລະ ສະຕັອກສິນຄ້າ
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onOpenCategoryManager && (
            <button
              type="button"
              onClick={onOpenCategoryManager}
              className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs"
              title="ຈັດການໝວດໝູ່ສິນຄ້າ"
            >
              <Folders size={15} weight="bold" className="text-teal-700" />
              <span className="hidden sm:inline">ໝວດໝູ່</span>
            </button>
          )}

          {onRefreshProducts && (
            <button
              type="button"
              onClick={onRefreshProducts}
              disabled={isLoading}
              className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs"
              title="ໂຫຼດຂໍ້ມູນຄືນຈາກ Supabase"
            >
              <ArrowClockwise size={15} className={isLoading ? 'animate-spin' : ''} weight="bold" />
              <span className="hidden sm:inline">ໂຫຼດຄືນ</span>
            </button>
          )}

          <button
            type="button"
            onClick={onAddNewProduct}
            className="px-3 sm:px-4 py-2 sm:py-2.5 h-9 sm:h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={16} weight="bold" />
            <span>+ ເພີ່ມສິນຄ້າໃໝ່</span>
          </button>
        </div>
      </div>

      {/* 2. Search Bar & Barcode Scanner Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        <div className="relative w-full sm:w-96">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ, ໝວດໝູ່ ຫຼື ສະແກນບາໂຄດ..."
            className="w-full pl-9 pr-24 py-2.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium shadow-2xs min-h-[44px] sm:min-h-0"
          />
          {/* Barcode / Camera Button inside Search Bar */}
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 sm:py-1 rounded-lg bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-700 transition-all cursor-pointer border border-teal-200 shadow-2xs flex items-center gap-1 active:scale-95"
            title="ເປີດກ້ອງສະແກນບາໂຄດສິນຄ້າ (Camera Barcode Scanner) • ຮອງຮັບເຄື່ອງຍິງບາໂຄດ USB/Bluetooth ອັດຕະໂນມັດ"
          >
            <Barcode size={15} weight="bold" />
            <span className="text-[10.5px] font-bold">ສະແກນ</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" title="Hardware Scanner Ready"></span>
          </button>
        </div>

        {searchTerm && (
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <span className="text-xs text-slate-500 font-medium">
              ພົບ <strong className="text-slate-800">{filteredProducts.length}</strong> ລາຍການ
            </span>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-xs font-bold text-teal-700 hover:underline cursor-pointer py-1 px-2"
            >
              ລຶບການຄົ້ນຫາ
            </button>
          </div>
        )}
      </div>

      {/* 3. A: MOBILE VIEW (< 768px) - Touch-Optimized Card List */}
      <div className="md:hidden flex flex-col gap-3 pb-24">
        {filteredProducts.map((p) => {
          const info = getProductStockDetails(p, exchangeRate);
          const isHighlighted = p.id === scannedHighlightId;

          return (
            <div
              key={p.id}
              className={`p-3.5 bg-white rounded-2xl border transition-all duration-300 shadow-xs flex flex-col gap-3 ${
                isHighlighted
                  ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-500 shadow-md'
                  : 'border-slate-200'
              }`}
            >
              {/* Top Row: Thumbnail, Name, Category chip, Action Buttons */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-12 h-12 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0"
                    onError={(e) => {
                      e.currentTarget.src =
                        'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80';
                    }}
                  />
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-slate-900 text-sm leading-snug line-clamp-2">
                      {p.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10.5px] font-bold">
                        {p.category}
                      </span>
                      {p.units && p.units.some((u) => u.barcode) ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          {p.units
                            .filter((u) => u.barcode)
                            .map((u) => (
                              <span
                                key={u.id}
                                className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold"
                                title={`${u.unitName}: ${u.barcode}`}
                              >
                                {u.unitName}: {u.barcode}
                              </span>
                            ))}
                        </div>
                      ) : p.barcode ? (
                        <span className="text-[10.5px] text-slate-400 font-mono truncate max-w-[120px]">
                          {p.barcode}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Action Buttons: Min 44px Touch Targets */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEditProduct(p)}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                    title="ແກ້ໄຂ"
                  >
                    <PencilSimple size={18} weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteProduct(p.id, p.name)}
                    className="w-10 h-10 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                    title="ລຶບ"
                  >
                    <Trash size={18} weight="bold" />
                  </button>
                </div>
              </div>

              {/* Middle Row: Cost Breakdown (THB & LAK) & Packaging Ratio */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px] font-sans">ຕົ້ນທຶນ ({info.cartonUnitName}):</span>
                  <span className="font-black text-slate-900">{formatBaht(info.cartonCostBaht)}</span>
                  <span className="text-slate-300">/</span>
                  <span className="font-black text-slate-800">{formatKip(info.cartonCostKip)}</span>
                </div>
                {info.cartonUnit && info.packUnit && (
                  <span className="text-[10px] text-slate-500 font-sans font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    1 {info.cName} = {info.packsPerCarton} {info.pName}
                  </span>
                )}
              </div>

              {/* Bottom Row: Selling Units & Stock Badge */}
              <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                {/* Selling Units Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-bold shrink-0">ລາຄາ:</span>
                  {p.units.map((u) => (
                    <span
                      key={u.id}
                      className="px-2 py-0.5 rounded-lg bg-teal-50 text-[11px] font-extrabold text-teal-800 border border-teal-200"
                    >
                      {u.unitName}: {formatKip(u.retailPrice)}
                    </span>
                  ))}
                </div>

                {/* Stock Badge with Clear Highlight */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold">ສາງຄົງເຫຼືອ:</span>
                  {info.isUntracked ? (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 font-bold text-[11px] border border-slate-200">
                      ບໍ່ນັບສາງ
                    </span>
                  ) : info.isNegativeStock ? (
                    <div className="flex flex-col gap-0.5 items-end">
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 font-bold px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1">
                        {info.stockDisplayText}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        ລວມທັງໝົດ: {info.rawStock} {info.pcName}
                      </span>
                    </div>
                  ) : info.isZeroStock ? (
                    <div className="flex flex-col gap-0.5 items-end">
                      <span className="text-red-500 font-black text-xs">
                        ໝົດສະຕັອກ (0)
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        ລວມທັງໝົດ: 0 {info.pcName}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5 items-end">
                      <div className="flex items-center gap-1.5 flex-wrap font-bold">
                        {info.cartonUnit && info.cartonCount > 0 && (
                          <span className="bg-amber-100 text-amber-950 px-2 py-0.5 rounded-md border border-amber-300 text-xs font-black">
                            {info.cartonCount} {info.cName}
                          </span>
                        )}
                        {info.packUnit && info.packCount > 0 && (
                          <span className="bg-sky-100 text-sky-950 px-2 py-0.5 rounded-md border border-sky-300 text-xs font-black">
                            {info.packCount} {info.pName}
                          </span>
                        )}
                        {info.pieceCount > 0 && (
                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200 text-xs font-black">
                            {info.pieceCount} {info.pcName}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        ລວມທັງໝົດ: {info.rawStock} {info.pcName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. B: TABLET & DESKTOP VIEW (>= 768px) - Responsive Horizontal Scroll Table */}
      <div className="hidden md:block w-full overflow-x-auto rounded-2xl border border-slate-200 shadow-xs overscroll-x-contain touch-pan-y bg-white mb-10">
        <table className="w-full min-w-[950px] text-left text-xs border-collapse">
          <thead>
            <tr className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200 text-slate-700 font-extrabold">
              <th className="py-3.5 px-4">ຮູບ & ຊື່ສິນຄ້າ</th>
              <th className="py-3.5 px-3">ໝວດໝູ່</th>
              <th className="py-3.5 px-3">ຕົ້ນທຶນບາດ (฿) & ກີບ (₭)</th>
              <th className="py-3.5 px-3">ລະດັບຫົວໜ່ວຍຂາຍ</th>
              <th className="py-3.5 px-3">ສາງຄົງເຫຼືອ (Stock)</th>
              <th className="py-3.5 px-3">ອັດຕາສ່ວນ (Ratio)</th>
              <th className="py-3.5 px-4 text-center">ຈັດການ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProducts.map((p) => {
              const info = getProductStockDetails(p, exchangeRate);
              const isHighlighted = p.id === scannedHighlightId;

              return (
                <tr
                  key={p.id}
                  className={`transition-all duration-300 ${
                    isHighlighted
                      ? 'bg-teal-50 ring-2 ring-teal-500 shadow-sm'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* Image & Name */}
                  <td className="py-3 px-4 flex items-center gap-3">
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-11 h-11 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0"
                      onError={(e) => {
                        e.currentTarget.src =
                          'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80';
                      }}
                    />
                    <div>
                      <div className="font-extrabold text-slate-900 text-xs">
                        {p.name}
                      </div>
                      {p.units && p.units.some((u) => u.barcode) ? (
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {p.units
                            .filter((u) => u.barcode)
                            .map((u) => (
                              <span
                                key={u.id}
                                className="text-[9.5px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold"
                                title={`${u.unitName}: ${u.barcode}`}
                              >
                                {u.unitName}: {u.barcode}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {p.barcode || 'ບໍ່ມີບາໂຄດ'}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                      {p.category}
                    </span>
                  </td>

                  {/* Cost breakdown */}
                  <td className="py-3 px-3">
                    <div className="flex flex-col gap-0.5 text-xs">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-[10px] font-bold text-slate-400 w-3">฿</span>
                        <span className="font-extrabold text-slate-900">
                          {formatBaht(info.cartonCostBaht).replace(' ฿', '')} ฿
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          / {info.cartonUnitName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-[10px] font-bold text-slate-400 w-3">₭</span>
                        <span className="font-extrabold text-slate-800">
                          {formatKip(info.cartonCostKip).replace(' ₭', '')} ₭
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          / {info.cartonUnitName}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Units Chips */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {p.units.map((u) => (
                        <span
                          key={u.id}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-[10.5px] font-bold text-slate-700 border border-slate-200"
                        >
                          {u.unitName}: {formatKip(u.retailPrice)}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Stock Column */}
                  <td className="py-3 px-3">
                    {info.isUntracked ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 font-bold text-[11px] border border-slate-200">
                        ບໍ່ນັບສາງ
                      </span>
                    ) : info.isNegativeStock ? (
                      <div className="flex flex-col gap-1 text-xs">
                        <div>
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 font-bold px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1">
                            {info.stockDisplayText}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          ລວມທັງໝົດ: {info.rawStock} {info.pcName}
                        </span>
                      </div>
                    ) : info.isZeroStock ? (
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="text-red-500 font-bold text-[11px]">
                          ໝົດສະຕັອກ (0)
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          ລວມທັງໝົດ: 0 {info.pcName}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap font-bold">
                          {info.cartonUnit && info.cartonCount > 0 && (
                            <span className="bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded-md border border-amber-200 text-[11px]">
                              {info.cartonCount} {info.cName}
                            </span>
                          )}
                          {info.packUnit && info.packCount > 0 && (
                            <span className="bg-sky-50 text-sky-900 px-1.5 py-0.5 rounded-md border border-sky-200 text-[11px]">
                              {info.packCount} {info.pName}
                            </span>
                          )}
                          {info.pieceCount > 0 && (
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md border border-slate-200 text-[11px]">
                              {info.pieceCount} {info.pcName}
                            </span>
                          )}
                        </div>
                        {info.packUnit && info.totalPacksCount && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            ລວມທັງໝົດ: {info.totalPacksCount} {info.pName}
                          </span>
                        )}
                        {!info.packUnit && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            ລວມທັງໝົດ: {info.rawStock} {info.pcName}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Ratio Column */}
                  <td className="py-3 px-3">
                    {info.cartonUnit && info.packUnit && (
                      <span className="text-slate-600 font-medium text-[11px] block">
                        1 {info.cName} = {info.packsPerCarton} {info.pName}
                      </span>
                    )}
                    {info.packUnit && info.pieceUnit && info.piecesPerPack > 1 && (
                      <span className="text-slate-500 text-[10px] block mt-0.5">
                        1 {info.pName} = {info.piecesPerPack} {info.pcName}
                      </span>
                    )}
                    {!info.packUnit && !info.pieceUnit && (
                      <span className="text-slate-400 text-[10px]">-</span>
                    )}
                  </td>

                  {/* Action Column */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onEditProduct(p)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors cursor-pointer"
                        title="ແກ້ໄຂ"
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteProduct(p.id, p.name)}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs transition-colors cursor-pointer"
                        title="ລຶບ"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 mt-2">
          <Package size={40} className="mb-2 opacity-50" />
          <p className="text-xs font-bold text-slate-600">
            {searchTerm ? `ບໍ່ພົບສິນຄ້າທີ່ກົງກັບ "${searchTerm}"` : 'ຍັງບໍ່ມີສິນຄ້າໃນລະບົບ (ບໍ່ມີຂໍ້ມູນ)'}
          </p>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="mt-2 text-xs font-bold text-teal-700 hover:underline cursor-pointer"
            >
              ລ້າງການຄົ້ນຫາ
            </button>
          )}
        </div>
      )}

      {/* Toast Feedback for Barcode Scanning */}
      {scanToast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[130] px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-black animate-in fade-in slide-in-from-top-4 duration-200 border ${
            scanToast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {scanToast.type === 'success' ? (
            <CheckCircle size={18} weight="fill" />
          ) : (
            <WarningCircle size={18} weight="fill" />
          )}
          <span>{scanToast.message}</span>
        </div>
      )}

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanBarcode}
        title="ສະແກນບາໂຄດຄົ້ນຫາສິນຄ້າ (Product Scanner)"
        description="ສ່ອງກ້ອງຫຼັງໃສ່ບາໂຄດສິນຄ້າເພື່ອກວດສອບ ແລະ ແກ້ໄຂຂໍ້ມູນທັນທີ"
      />
    </main>
  );
}
