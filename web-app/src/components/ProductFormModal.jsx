import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  PlusCircle,
  CheckCircle,
  CurrencyCircleDollar,
  ArrowLeft,
  Package,
  Sparkle,
  Calculator,
  Barcode,
  Warehouse,
  Info,
  Camera,
  UploadSimple,
  Trash,
  Lightning,
  Image as ImageIcon,
  LinkSimple,
  WarningCircle,
  Plus,
  Gear,
  Coins,
  Link,
  LinkBreak,
} from '@phosphor-icons/react';
import { formatDots } from '../utils/formatters';
import { compressProductImage, formatFileSize } from '../utils/imageCompressor';
import BarcodeScannerModal from './BarcodeScannerModal';

export default function ProductFormModal({
  isOpen,
  onClose,
  productToEdit,
  existingProducts = [],
  newProdName,
  setNewProdName,
  newProdCategory,
  setNewProdCategory,
  categoriesList = [],
  rawCategories = [],
  onCreateCategory,
  onOpenCategoryManager,
  newProdBarcode,
  setNewProdBarcode,
  newProdImageUrl,
  setNewProdImageUrl,
  imageFileToUpload,
  setImageFileToUpload,
  imageCompressionStats,
  setImageCompressionStats,
  isCompressingImage,
  setIsCompressingImage,
  newProdCostKip,
  newProdCostBaht,
  setNewProdCostKip,
  setNewProdCostBaht,
  handleBahtCostChange,
  handleKipCostChange,
  lastModifiedCostField,
  exchangeRate = 0,
  // Presets
  applyPresetBeer,
  applyPresetDrink3Tiers,
  applyPresetSnack3Tiers,
  applyPresetSugarSack,
  applyPresetPieceOnly,
  // 3-Tier Switches
  enablePiece,
  setEnablePiece,
  pieceUnitName,
  setPieceUnitName,
  piecePrice,
  setPiecePrice,
  piecePrice2 = '',
  setPiecePrice2,
  piecePrice3 = '',
  setPiecePrice3,
  pieceBarcode = '',
  setPieceBarcode,
  enablePack,
  setEnablePack,
  packUnitName,
  setPackUnitName,
  packMultiplier,
  setPackMultiplier,
  packPrice,
  setPackPrice,
  packPrice2 = '',
  setPackPrice2,
  packPrice3 = '',
  setPackPrice3,
  packBarcode = '',
  setPackBarcode,
  enableCarton,
  setEnableCarton,
  cartonUnitName,
  setCartonUnitName,
  cartonMultiplier,
  setCartonMultiplier,
  cartonPrice,
  setCartonPrice,
  cartonPrice2 = '',
  setCartonPrice2,
  cartonPrice3 = '',
  setCartonPrice3,
  cartonBarcode = '',
  setCartonBarcode,
  // Crate Deposit Setting
  hasCrateDeposit,
  setHasCrateDeposit,
  crateDepositFee,
  setCrateDepositFee,
  // Stock Tracking & Initial Stock
  trackStock,
  setTrackStock,
  stockCartons,
  setStockCartons,
  stockPacks,
  setStockPacks,
  stockPieces,
  setStockPieces,
  onSaveProduct,
}) {
  const fileInputRef = useRef(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState('general'); // 'carton' | 'pack' | 'piece' | 'general'
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [customCatInput, setCustomCatInput] = useState('');
  const [imageError, setImageError] = useState('');

  // Cleanly reset transient local modal states when opened or switching product
  useEffect(() => {
    setShowUrlInput(false);
    setScannerOpen(false);
    setScannerTarget('general');
    setIsAddingNewCat(false);
    setCustomCatInput('');
  }, [productToEdit?.id, isOpen]);

  // Default to first category from database when creating new product
  useEffect(() => {
    if (isOpen && !productToEdit && !newProdCategory && categoriesList && categoriesList.length > 0) {
      setNewProdCategory(categoriesList[0]);
    }
  }, [isOpen, productToEdit, newProdCategory, categoriesList, setNewProdCategory]);

  const handleAddNewCategoryInline = async () => {
    if (!customCatInput.trim()) return;
    const clean = customCatInput.trim();
    if (onCreateCategory) {
      await onCreateCategory(clean);
    }
    setNewProdCategory(clean);
    setCustomCatInput('');
    setIsAddingNewCat(false);
  };

  // Dual Mode Currency Input (Auto Linked vs Manual Independent)
  const [costSyncMode, setCostSyncMode] = useState('auto'); // 'auto' | 'manual'

  // 2-Way Reactive Currency Handlers with Infinite Loop Prevention
  const onBahtChange = (val) => {
    if (costSyncMode === 'manual') {
      const cleanDigits = String(val ?? '').replace(/\D/g, '');
      setNewProdCostBaht?.(cleanDigits ? formatDots(cleanDigits) : (val === '0' ? '0' : ''));
      handleBahtCostChange?.(val, 'manual');
      return;
    }
    // Auto Linked Mode
    if (handleBahtCostChange) {
      handleBahtCostChange(val, 'auto');
      return;
    }
    const cleanDigits = String(val ?? '').replace(/\D/g, '');
    if (!cleanDigits) {
      setNewProdCostBaht?.('');
      setNewProdCostKip?.('');
      return;
    }
    const costThb = parseInt(cleanDigits, 10);
    if (isNaN(costThb) || costThb === 0) {
      setNewProdCostBaht?.(cleanDigits === '0' ? '0' : '');
      setNewProdCostKip?.(cleanDigits === '0' ? '0' : '');
      return;
    }
    const rate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 0;
    const costLak = rate > 0 ? Math.round(costThb * rate) : 0;
    setNewProdCostBaht?.(formatDots(costThb));
    if (rate > 0) {
      setNewProdCostKip?.(formatDots(costLak));
    }
  };

  const onKipChange = (val) => {
    if (costSyncMode === 'manual') {
      const cleanDigits = String(val ?? '').replace(/\D/g, '');
      setNewProdCostKip?.(cleanDigits ? formatDots(cleanDigits) : (val === '0' ? '0' : ''));
      handleKipCostChange?.(val, 'manual');
      return;
    }
    // Auto Linked Mode
    if (handleKipCostChange) {
      handleKipCostChange(val, 'auto');
      return;
    }
    const cleanDigits = String(val ?? '').replace(/\D/g, '');
    if (!cleanDigits) {
      setNewProdCostKip?.('');
      setNewProdCostBaht?.('');
      return;
    }
    const costLak = parseInt(cleanDigits, 10);
    if (isNaN(costLak) || costLak === 0) {
      setNewProdCostKip?.(cleanDigits === '0' ? '0' : '');
      setNewProdCostBaht?.(cleanDigits === '0' ? '0' : '');
      return;
    }
    const rate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 0;
    setNewProdCostKip?.(formatDots(costLak));
    if (rate > 0) {
      const costThb = Math.round(costLak / rate);
      setNewProdCostBaht?.(formatDots(costThb));
    }
  };

  // Helper to check if a barcode already exists on another product in DB
  const checkBarcodeDuplicate = (barcodeToCheck) => {
    if (!barcodeToCheck || !String(barcodeToCheck).trim() || !existingProducts || existingProducts.length === 0) return null;
    const clean = String(barcodeToCheck).trim().toLowerCase();
    return existingProducts.find(
      (p) =>
        p.id !== productToEdit?.id &&
        ((p.barcode && String(p.barcode).trim().toLowerCase() === clean) ||
          (p.units && p.units.some((u) => u.barcode && String(u.barcode).trim().toLowerCase() === clean)))
    );
  };

  const handleOpenScannerFor = (target) => {
    setScannerTarget(target);
    setScannerOpen(true);
  };

  const handleScanBarcodeSuccess = (scannedCode) => {
    if (!scannedCode) return;
    const clean = String(scannedCode).trim();
    if (scannerTarget === 'carton' && setCartonBarcode) {
      setCartonBarcode(clean);
    } else if (scannerTarget === 'pack' && setPackBarcode) {
      setPackBarcode(clean);
    } else if (scannerTarget === 'piece' && setPieceBarcode) {
      setPieceBarcode(clean);
    } else if (setNewProdBarcode) {
      setNewProdBarcode(clean);
    }
    setScannerOpen(false);
  };

  if (!isOpen) return null;

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (setIsCompressingImage) setIsCompressingImage(true);
      // Auto compress: max 600x600, quality 0.75, webp
      const compressed = await compressProductImage(file, {
        maxWidth: 600,
        maxHeight: 600,
        quality: 0.75,
        mimeType: 'image/webp',
      });

      if (setImageFileToUpload) setImageFileToUpload(compressed.blob);
      if (setNewProdImageUrl) setNewProdImageUrl(compressed.dataUrl);
      if (setImageCompressionStats) {
        setImageCompressionStats({
          originalSize: formatFileSize(compressed.originalSize),
          compressedSize: formatFileSize(compressed.compressedSize),
          savedPercent: compressed.savedPercent,
          mimeType: compressed.mimeType,
          fileName: compressed.fileName,
        });
      }
    } catch (err) {
      console.error('Image compression failed:', err);
      setImageError('ເກີດຂໍ້ຜິດພາດໃນການບີບອັດຮູບ: ' + (err.message || 'File error'));
    } finally {
      if (setIsCompressingImage) setIsCompressingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    if (setImageFileToUpload) setImageFileToUpload(null);
    if (setImageCompressionStats) setImageCompressionStats(null);
    if (setNewProdImageUrl) setNewProdImageUrl('');
  };

  const displayImage =
    newProdImageUrl !== undefined && newProdImageUrl !== ''
      ? newProdImageUrl
      : productToEdit?.imageUrl || productToEdit?.image_url || '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-150 select-none font-sans">
      {/* 1. TOP FULLSCREEN HEADER (Compact Touch POS: strictly h-14 / 56px on mobile) */}
      <header className="bg-white border-b border-slate-200/90 px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
            title="ກັບຄືນ"
          >
            <ArrowLeft size={17} weight="bold" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm xs:text-base font-bold text-slate-900 inline-flex items-center gap-1.5 truncate">
              <PlusCircle size={18} className="text-teal-600 shrink-0 hidden xs:inline-block" weight="fill" />
              <span className="truncate">
                {productToEdit ? 'ແກ້ໄຂສິນຄ້າ' : 'ເພີ່ມສິນຄ້າໃໝ່'}
              </span>
              <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                Full Screen
              </span>
              <span className="inline-block sm:hidden w-2 h-2 rounded-full bg-teal-500 shrink-0" title="Full Screen Mode"></span>
            </h2>
            <p className="hidden lg:block text-xs text-slate-500 line-clamp-1">
              ຕົ້ນທຶນບາດ/ກີບ, ສະຕັອກສິນຄ້າ ແລະ Switch ເປີດ/ປິດ 3 ລະດັບຫົວໜ່ວຍ (ຍົກລັງ, ແພັກ, ຂາຍຍ່ອຍ)
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Quick Presets */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 px-2 flex items-center gap-1">
              <Sparkle size={13} weight="fill" className="text-amber-500" />
              <span>ແມ່ແບບ:</span>
            </span>
            <button
              type="button"
              onClick={applyPresetBeer}
              className="px-2 py-1 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-700 hover:text-amber-900 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="ເບຍ: ຂາຍສະເພາະຍົກລັງ (Tier 1 & 2 ປິດ, Tier 3 ເປີດ)"
            >
              🍺 ເບຍ (ຍົກລັງ)
            </button>
            <button
              type="button"
              onClick={applyPresetDrink3Tiers}
              className="px-2 py-1 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-slate-700 hover:text-teal-900 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="ເຄື່ອງດື່ມ: 3 ລະດັບ (ກະປ໋ອງ, ແພັກ, ແກັດ)"
            >
              🥫 ເຄື່ອງດື່ມ (3 ລະດັບ)
            </button>
            <button
              type="button"
              onClick={applyPresetSnack3Tiers}
              className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-900 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="ເຂົ້າໜົມ: ຂາຍແພັກ & ແກັດ (Tier 1 ປິດ, Tier 2 & 3 ເປີດ 6 ແພັກ/ແກັດ)"
            >
              🍬 ເຂົ້າໜົມ (ແພັກ+ແກັດ)
            </button>
            <button
              type="button"
              onClick={applyPresetSugarSack}
              className="px-2 py-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="ນ້ຳຕານ/ແປ້ງນົວ: ຂາຍຖົງ & ເປົາ (Tier 2 ປິດ, Tier 1 & 3 ເປີດ 25 ຖົງ/ເປົາ)"
            >
              🧂 ນ້ຳຕານ (ຖົງ+ເປົາ)
            </button>
            <button
              type="button"
              onClick={applyPresetPieceOnly}
              className="px-2 py-1 bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-slate-700 hover:text-purple-900 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="ຂາຍຍ່ອຍ: ຂາຍສະເພາະອັນຍ່ອຍ"
            >
              🏷️ ຂາຍຍ່ອຍ (ອັນ)
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            ຍົກເລີກ
          </button>
          <button
            type="submit"
            form="product-entry-form"
            className="h-9 px-3 sm:px-5 py-1.5 sm:py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-xs rounded-lg sm:rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <CheckCircle size={15} weight="fill" />
            <span>ບັນທຶກ<span className="hidden xs:inline">ສິນຄ້າ</span></span>
          </button>
        </div>
      </header>

      {/* 2. FULLSCREEN SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-5 md:p-6 lg:p-8 overscroll-contain">
        <form
          id="product-entry-form"
          onSubmit={onSaveProduct}
          className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 lg:gap-6"
        >
          {/* LEFT COLUMN: Basic Info, Simplified Purchase Cost, Stock (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-3 sm:gap-4">
            {/* CARD 1: Basic Info (Compact) */}
            <div className="bg-white p-3 sm:p-4.5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col gap-2.5 sm:gap-3">
              <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
                <Package size={16} className="text-teal-600 shrink-0" weight="bold" />
                <h3 className="text-xs font-black text-slate-800">
                  1. ຂໍ້ມູນພື້ນຖານສິນຄ້າ (Product Profile)
                </h3>
              </div>

              {/* Product Image Upload: High-Efficiency Client-Side Compression & Horizontal Touch Layout */}
              <div className="p-2.5 sm:p-3 bg-slate-50/90 rounded-xl border border-slate-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] sm:text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera size={14} className="text-teal-600" weight="bold" />
                    <span>ຮູບພາບ (Product Image)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="text-[10px] sm:text-[11px] font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                  >
                    <LinkSimple size={12} />
                    <span>{showUrlInput ? 'ເຊື່ອງ URL' : 'ປ້ອນ URL'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Thumbnail Preview: w-14 h-14 (56px) on mobile */}
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-2xs group">
                    {displayImage ? (
                      <img
                        src={displayImage}
                        alt="Product Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src =
                            'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80';
                        }}
                      />
                    ) : (
                      <div className="text-slate-300 flex flex-col items-center justify-center p-1 text-center">
                        <ImageIcon size={20} />
                        <span className="text-[8px] font-medium mt-0.5">ບໍ່ມີຮູບ</span>
                      </div>
                    )}

                    {isCompressingImage && (
                      <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>

                  {/* Actions & Compression Stats - Side-by-side horizontal alignment */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isCompressingImage}
                        className="h-8 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        <UploadSimple size={13} weight="bold" />
                        <span>{displayImage ? 'ປ່ຽນຮູບ (Upload)' : 'ເລືອກຮູບ (Upload)'}</span>
                      </button>

                      {displayImage && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0"
                          title="ລຶບຮູບພາບ"
                        >
                          <Trash size={14} />
                        </button>
                      )}
                    </div>

                    {/* Compression Feedback Badges */}
                    {imageError ? (
                      <div className="text-[10px] text-red-700 font-bold truncate">
                        ⚠️ {imageError}
                      </div>
                    ) : imageCompressionStats ? (
                      <div className="text-[10px] text-emerald-800 font-bold flex items-center gap-1 truncate">
                        <Lightning size={12} weight="fill" className="text-emerald-600 shrink-0" />
                        <span>ບີບອັດ: {imageCompressionStats.compressedSize} (-{imageCompressionStats.savedPercent}%)</span>
                      </div>
                    ) : (
                      <p className="text-[9.5px] text-slate-400 leading-tight hidden xs:block">
                        💡 ບີບອັດອັດຕະໂນມັດ ~15-30 KB ປະຢັດພື້ນທີ່
                      </p>
                    )}
                  </div>
                </div>

                {/* Optional Web URL Input */}
                {showUrlInput && (
                  <div className="mt-0.5 pt-1.5 border-t border-slate-200 flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-600">
                      ຫຼື ປ້ອນລິ້ງຮູບພາບ (Image Web URL):
                    </label>
                    <input
                      type="url"
                      value={displayImage}
                      onChange={(e) => {
                        if (setNewProdImageUrl) setNewProdImageUrl(e.target.value);
                        if (setImageFileToUpload) setImageFileToUpload(null);
                        if (setImageCompressionStats) setImageCompressionStats(null);
                      }}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full h-8 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-teal-600 font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Product Name Input */}
              <div>
                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">
                  ຊື່ສິນຄ້າ (Product Name) *
                </label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="e.g. ເຄື່ອງດື່ມ ຊາຂຽວ Oishi 500ml"
                  className="w-full h-9 sm:h-10 px-3 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white font-bold transition-all"
                />
              </div>

              {/* Category Dropdown & Inline Manager */}
              <div>
                <div className="flex items-center justify-between mb-1 gap-1">
                  <label className="text-[11px] sm:text-xs font-bold text-slate-700 shrink-0">
                    ໝວດໝູ່ (Category)
                  </label>
                  <div className="flex items-center gap-1 shrink-0">
                    {onOpenCategoryManager && (
                      <button
                        type="button"
                        onClick={onOpenCategoryManager}
                        className="text-[9.5px] sm:text-[10px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded-md border border-slate-200 transition-all active:scale-95 shadow-2xs"
                        title="ຈັດການໝວດໝູ່ (Category Manager)"
                      >
                        <Gear size={11} weight="bold" />
                        <span>ຈັດການໝວດ</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCat(!isAddingNewCat)}
                      className="text-[9.5px] sm:text-[10px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-0.5 cursor-pointer bg-teal-50 hover:bg-teal-100 px-1.5 py-0.5 rounded-md border border-teal-200 transition-all active:scale-95 shadow-2xs"
                    >
                      <Plus size={10} weight="bold" />
                      <span>{isAddingNewCat ? 'ຍົກເລີກ' : '+ ໝວດໃໝ່'}</span>
                    </button>
                  </div>
                </div>

                {isAddingNewCat ? (
                  <div className="flex items-center gap-1.5 p-1 bg-teal-50/80 rounded-lg sm:rounded-xl border border-teal-300 animate-in fade-in duration-150">
                    <input
                      type="text"
                      value={customCatInput}
                      onChange={(e) => setCustomCatInput(e.target.value)}
                      placeholder="ປ້ອນຊື່ໝວດໝູ່ໃໝ່..."
                      className="flex-1 h-8 px-2.5 py-1 bg-white border border-teal-300 rounded-md text-xs font-bold text-slate-900 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewCategoryInline();
                        }
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddNewCategoryInline}
                      className="h-8 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-bold cursor-pointer transition-all active:scale-95 shrink-0"
                    >
                      ເພີ່ມ
                    </button>
                  </div>
                ) : (
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full h-9 sm:h-10 px-3 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white font-bold transition-all cursor-pointer"
                  >
                    {categoriesList.length === 0 ? (
                      <option value="">(ບໍ່ມີໝວດໝູ່ໃນຖານຂໍ້ມູນ)</option>
                    ) : (
                      categoriesList.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))
                    )}
                    {newProdCategory && !categoriesList.includes(newProdCategory) && (
                      <option value={newProdCategory}>{newProdCategory}</option>
                    )}
                  </select>
                )}
              </div>
            </div>

            {/* CARD 2: ຕົ້ນທຶນຮັບເຂົ້າ (Purchase Cost) - 2-Way Reactive Currency Sync */}
            <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-teal-200/80 shadow-2xs bg-gradient-to-br from-teal-50/20 to-white flex flex-col gap-2 sm:gap-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-teal-100">
                <div className="flex items-center gap-1.5">
                  <CurrencyCircleDollar size={17} className="text-teal-600 shrink-0" weight="fill" />
                  <h3 className="text-xs font-black text-slate-900">
                    2. ຕົ້ນທຶນຮັບເຂົ້າ (Purchase Cost)
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-teal-800 bg-teal-100/70 border border-teal-300/60 px-2 py-0.5 rounded-full font-mono font-bold tabular-nums">
                    1 ฿ = {exchangeRate > 0 ? formatDots(exchangeRate) : '-'} ₭
                  </span>
                  {/* Dual Mode Switch Toggle: [ Link ອັດຕະໂນມັດ / LinkBreak ປ້ອນເອງ ] */}
                  <button
                    type="button"
                    onClick={() => setCostSyncMode((prev) => (prev === 'auto' ? 'manual' : 'auto'))}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                      costSyncMode === 'auto'
                        ? 'bg-teal-50 border-teal-300 text-teal-800 hover:bg-teal-100'
                        : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                    }`}
                    title={costSyncMode === 'auto' ? 'ໂໝດໄລ່ອັດຕະໂນມັດ: ຄລິກເພື່ອປ່ຽນເປັນໂໝດແຍກປ້ອນເອງ' : 'ໂໝດແຍກປ້ອນເອງ: ຄລິກເພື່ອປ່ຽນເປັນໂໝດໄລ່ອັດຕະໂນມັດ'}
                  >
                    {costSyncMode === 'auto' ? (
                      <>
                        <Link size={12} weight="bold" />
                        <span>ອັດຕະໂນມັດ</span>
                      </>
                    ) : (
                      <>
                        <LinkBreak size={12} weight="bold" />
                        <span>ປ້ອນເອງ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                {/* 1. THB Purchase Cost */}
                <div className="p-2 sm:p-2.5 bg-white rounded-lg sm:rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/20 transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10.5px] sm:text-[11px] font-extrabold text-slate-800 truncate">
                      ຕົ້ນທຶນບາດ (฿ THB)
                    </label>
                    <span className="text-[9px] text-slate-400 font-medium hidden xs:inline">ອ້າງອີງ</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newProdCostBaht}
                      onChange={(e) => onBahtChange(e.target.value)}
                      placeholder="0"
                      className="w-full h-8 sm:h-9 pl-2.5 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-md sm:rounded-lg text-xs sm:text-sm font-black text-slate-900 font-mono tabular-nums focus:outline-none focus:border-teal-600 focus:bg-white transition-colors"
                    />
                    <span className="absolute right-2 top-1.5 sm:top-2 text-xs font-black text-slate-400 font-mono">฿</span>
                  </div>
                </div>

                {/* 2. LAK Purchase Cost */}
                <div className="p-2 sm:p-2.5 bg-white rounded-lg sm:rounded-xl border border-teal-200 shadow-2xs flex flex-col justify-between focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/20 transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10.5px] sm:text-[11px] font-extrabold text-teal-900 truncate">
                      ຕົ້ນທຶນກີບ (₭ LAK) *
                    </label>
                    <span className="text-[9px] text-teal-700 font-bold bg-teal-100/80 px-1.5 py-0.2 rounded hidden xs:inline">ຫຼັກບັນຊີ</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newProdCostKip}
                      onChange={(e) => onKipChange(e.target.value)}
                      placeholder="0"
                      className="w-full h-8 sm:h-9 pl-2.5 pr-7 py-1 bg-teal-50/40 border border-teal-300 rounded-md sm:rounded-lg text-xs sm:text-sm font-black text-teal-900 font-mono tabular-nums focus:outline-none focus:border-teal-600 focus:bg-white transition-colors"
                    />
                    <span className="absolute right-2 top-1.5 sm:top-2 text-xs font-black text-teal-600 font-mono">₭</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: INVENTORY TRACKING & STARTING STOCK (Compact Section 3) */}
            <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col gap-2 sm:gap-2.5">
              {/* Upfront Switch: Track Physical Stock */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Warehouse size={16} className="text-teal-600 shrink-0" weight="bold" />
                  <span>3. ຕິດຕາມສະຕັອກ (Track Stock)</span>
                </h3>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={trackStock}
                    onChange={(e) => setTrackStock(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>

              {/* Conditional Display: If Switch is OFF vs ON */}
              {trackStock ? (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-600">
                    ຈຳນວນສະຕັອກເລີ່ມຕົ້ນຕົວຈິງໃນສາງ:
                  </span>

                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    {/* Carton Stock */}
                    {enableCarton && (
                      <div className="p-2 bg-amber-50/60 rounded-lg sm:rounded-xl border border-amber-200/80">
                        <label className="text-[9.5px] sm:text-[10px] font-bold text-amber-900 block mb-0.5 truncate" title={cartonUnitName || 'ແກັດ'}>
                          {cartonUnitName || 'ແກັດ'}:
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={stockCartons}
                          onChange={(e) => setStockCartons(formatDots(e.target.value))}
                          placeholder="0"
                          className="w-full h-8 sm:h-8.5 px-2 py-1 bg-white border border-amber-300 rounded-md text-xs font-mono font-black text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    )}

                    {/* Pack Stock */}
                    {enablePack && (
                      <div className="p-2 bg-sky-50/60 rounded-lg sm:rounded-xl border border-sky-200/80">
                        <label className="text-[9.5px] sm:text-[10px] font-bold text-sky-900 block mb-0.5 truncate" title={packUnitName || 'ແພັກ'}>
                          {packUnitName || 'ແພັກ'}:
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={stockPacks}
                          onChange={(e) => setStockPacks(formatDots(e.target.value))}
                          placeholder="0"
                          className="w-full h-8 sm:h-8.5 px-2 py-1 bg-white border border-sky-300 rounded-md text-xs font-mono font-black text-sky-950 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    )}

                    {/* Loose Piece Stock */}
                    {enablePiece && (
                      <div className="p-2 bg-slate-50 rounded-lg sm:rounded-xl border border-slate-200">
                        <label className="text-[9.5px] sm:text-[10px] font-bold text-slate-700 block mb-0.5 truncate" title={pieceUnitName || 'ອັນ'}>
                          {pieceUnitName || 'ອັນຍ່ອຍ'}:
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={stockPieces}
                          onChange={(e) => setStockPieces(formatDots(e.target.value))}
                          placeholder="0"
                          className="w-full h-8 sm:h-8.5 px-2 py-1 bg-white border border-slate-300 rounded-md text-xs font-mono font-black text-slate-950 focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                      </div>
                    )}
                  </div>

                  {/* Summary preview */}
                  <div className="p-1.5 sm:p-2 bg-slate-50 rounded-lg border border-slate-200/70 text-[10px] text-slate-600 flex items-center gap-1.5">
                    <Info size={13} className="text-teal-600 shrink-0" />
                    <span className="truncate">
                      ສະຕັອກ:{' '}
                      <strong className="text-slate-900">
                        {enableCarton && `${stockCartons || 0} ${cartonUnitName || 'ແກັດ'} `}
                        {enablePack && `${stockPacks || 0} ${packUnitName || 'ແພັກ'} `}
                        {enablePiece && `${stockPieces || 0} ${pieceUnitName || 'ອັນ'}`}
                      </strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2 sm:p-2.5 bg-slate-50 border border-dashed border-slate-300 rounded-lg flex items-start gap-2">
                  <Info size={15} className="text-slate-400 shrink-0 mt-0.5" />
                  <div className="text-[10.5px] text-slate-600 leading-snug">
                    <span className="font-bold text-slate-800">ໂໝດບໍ່ນັບສະຕັອກ:</span> ຂາຍໄດ້ຕໍ່ເນື່ອງ ບໍ່ຈຳກັດຈຳນວນ (POS ສະແດງ "ບໍ່ນັບສາງ").
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: 3-Tier Packaging Switches (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-3 sm:gap-4">
            <div className="bg-white p-3 sm:p-4.5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col gap-2.5 sm:gap-3">
              <div className="flex items-center justify-between pb-2 sm:pb-2.5 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Calculator size={16} className="text-teal-600" weight="bold" />
                    <span>4. ຕັ້ງຄ່າ 3 ລະດັບຫົວໜ່ວຍຂາຍ (Dynamic Sale Units)</span>
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 hidden xs:block">
                    ເປີດ/ປິດ ຫົວໜ່ວຍຂາຍຢ່າງອິດສະຫຼະ (ຫົວໜ່ວຍໃດປິດ ຈະບໍ່ສະແດງປຸ່ມໃນໜ້າ POS)
                  </p>
                </div>
              </div>

              {/* TIER 3: CARTON (Carton / Box / Sack - Top Tier) */}
              <div
                className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all ${
                  enableCarton ? 'bg-white border-amber-200/90 shadow-2xs ring-1 ring-amber-500/10' : 'bg-slate-50/70 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center font-black text-[11px]">
                      1
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-800 block">
                        ລະດັບ 1: ຂາຍຍົກແກັດ / ລັງ / ເປົາ (Carton)
                      </span>
                      <span className="text-[9.5px] text-slate-400 hidden xs:block">
                        ຕົວຢ່າງ: ແກັດ, ລັງ, ເປົາ/ກະສອບ, ກ່ອງໃຫຍ່...
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={enableCarton}
                      onChange={(e) => setEnableCarton(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                {enableCarton && (
                  <div className="flex flex-col gap-2 pt-1.5 border-t border-slate-100">
                    {/* Quick Suggestions Chips */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[9.5px] font-bold text-slate-400">ເລືອກໄວ:</span>
                      {['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງໃຫຍ່', 'ຖັງ'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCartonUnitName(s)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            cartonUnitName === s
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10.5px] text-slate-700 font-bold block mb-0.5">
                          ຊື່ຫົວໜ່ວຍຍົກລັງ:
                        </label>
                        <input
                          type="text"
                          value={cartonUnitName}
                          onChange={(e) => setCartonUnitName(e.target.value)}
                          placeholder="ແກັດ, ລັງ, ເປົາ..."
                          className="w-full h-8.5 sm:h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
                        />
                      </div>

                      {/* Multiplier Label */}
                      <div>
                        <label
                          className="text-[10.5px] text-slate-700 font-bold block mb-0.5 truncate"
                          title={
                            enablePack
                              ? `ຈຳນວນ ${packUnitName && packUnitName !== cartonUnitName ? packUnitName : 'ແພັກ'} ຕໍ່ 1 ${cartonUnitName || 'ແກັດ'}`
                              : enablePiece
                              ? `ຈຳນວນ ${pieceUnitName && pieceUnitName !== cartonUnitName ? pieceUnitName : 'ອັນ'} ຕໍ່ 1 ${cartonUnitName || 'ແກັດ'}`
                              : `ຈຳນວນຕໍ່ 1 ${cartonUnitName || 'ລັງ'}`
                          }
                        >
                          {enablePack
                            ? `ຈຳນວນ ${packUnitName && packUnitName !== cartonUnitName ? packUnitName : 'ແພັກ'} ຕໍ່ 1 ${cartonUnitName || 'ແກັດ'}:`
                            : enablePiece
                            ? `ຈຳນວນ ${pieceUnitName && pieceUnitName !== cartonUnitName ? pieceUnitName : 'ອັນ'} ຕໍ່ 1 ${cartonUnitName || 'ແກັດ'}:`
                            : `ຈຳນວນຕໍ່ 1 ${cartonUnitName || 'ລັງ'}:`}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={cartonMultiplier}
                          onChange={(e) => setCartonMultiplier(formatDots(e.target.value))}
                          disabled={!enablePiece && !enablePack}
                          placeholder="8"
                          className="w-full h-8.5 sm:h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-900 font-mono focus:outline-none focus:border-teal-600 focus:bg-white disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* 3 Price Tiers Grid (ລາຄາ 1, ລາຄາ 2, ລາຄາ 3) */}
                    <div className="bg-amber-50/50 p-2 sm:p-2.5 rounded-lg border border-amber-200/80">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10.5px] font-black text-amber-950 flex items-center gap-1.5">
                          <Coins size={14} weight="duotone" className="text-amber-700" />
                          <span>ຕາຕະລາງ 3 ລະດັບລາຄາຂາຍຍົກລັງ (Multi-Price Tiers):</span>
                        </span>
                        <span className="text-[9px] text-amber-800/80 hidden xs:inline">
                          (ລາຄາ 2 & 3 ບໍ່ບັງຄັບ)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                        {/* Price 1: Standard (Mandatory / Default POS) */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-800 flex items-center justify-between mb-0.5">
                            <span className="truncate">ລາຄາ 1 (ມາດຕະຖານ) <span className="text-rose-500">*</span></span>
                            <span className="text-[8.5px] font-extrabold text-teal-700 bg-teal-100/90 px-1 rounded shrink-0">ຫຼັກ POS</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={cartonPrice}
                            onChange={(e) => setCartonPrice(formatDots(e.target.value))}
                            placeholder="0"
                            className="w-full h-8.5 sm:h-9 px-2.5 bg-white border border-teal-500 rounded-lg text-xs font-black text-teal-900 font-mono focus:outline-none focus:ring-1 focus:ring-teal-600"
                          />
                        </div>

                        {/* Price 2: Regular Customer */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 flex items-center justify-between mb-0.5">
                            <span className="truncate">ລາຄາ 2 (ລູກຄ້າປະຈຳ)</span>
                            <span className="text-[8.5px] text-sky-700 bg-sky-100/80 px-1 rounded shrink-0">ຂາປະຈຳ</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={cartonPrice2}
                            onChange={(e) => setCartonPrice2(formatDots(e.target.value))}
                            placeholder="(ບໍ່ກຳນົດ)"
                            className="w-full h-8.5 sm:h-9 px-2.5 bg-white border border-slate-300 focus:border-sky-500 rounded-lg text-xs font-bold text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </div>

                        {/* Price 3: Wholesale / VIP */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 flex items-center justify-between mb-0.5">
                            <span className="truncate">ລາຄາ 3 (ລາຄາສົ່ງ/VIP)</span>
                            <span className="text-[8.5px] text-amber-800 bg-amber-100 px-1 rounded font-bold shrink-0">VIP/ສົ່ງ</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={cartonPrice3}
                            onChange={(e) => setCartonPrice3(formatDots(e.target.value))}
                            placeholder="(ບໍ່ກຳນົດ)"
                            className="w-full h-8.5 sm:h-9 px-2.5 bg-white border border-slate-300 focus:border-amber-500 rounded-lg text-xs font-bold text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tier 1 Barcode Input with Camera Scanner */}
                    <div className="p-2 sm:p-2.5 bg-amber-50/70 border border-amber-200/90 rounded-lg sm:rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] sm:text-[10.5px] font-bold text-amber-900 flex items-center gap-1.5">
                          <Barcode size={13} className="text-amber-700" />
                          <span>ບາໂຄດເທິງແກັດ/ລັງ (Carton Barcode)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleOpenScannerFor('carton')}
                          className="text-[9.5px] font-black text-amber-900 hover:text-amber-950 flex items-center gap-1 cursor-pointer bg-white hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-300 transition-all active:scale-95 shadow-2xs"
                          title="ສະແກນບາໂຄດເທິງແກັດ"
                        >
                          <Camera size={11} weight="bold" />
                          <span>ສະແກນກ້ອງ</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={cartonBarcode}
                        onChange={(e) => setCartonBarcode && setCartonBarcode(e.target.value)}
                        placeholder="ຍິງບາໂຄດເທິງລັງ ຫຼື ກົດປຸ່ມສະແກນກ້ອງ"
                        className="w-full h-8 sm:h-8.5 px-2.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      {checkBarcodeDuplicate(cartonBarcode) && (
                        <p className="text-[9.5px] text-amber-800 font-bold mt-1 flex items-center gap-1">
                          <WarningCircle size={11} weight="fill" className="text-amber-600 shrink-0" />
                          <span>⚠️ ບາໂຄດນີ້ມີໃນລະບົບແລ້ວ: "{checkBarcodeDuplicate(cartonBarcode)?.name}"</span>
                        </p>
                      )}
                    </div>

                    {/* Crate Deposit Setting */}
                    <div className="mt-1 pt-1.5 border-t border-amber-200/80 bg-amber-50/50 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-start gap-2">
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                          <input
                            type="checkbox"
                            checked={Boolean(hasCrateDeposit)}
                            onChange={(e) => setHasCrateDeposit && setHasCrateDeposit(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-600"></div>
                        </label>
                        <div>
                          <span className="text-[11px] sm:text-xs font-black text-amber-950 block">
                            ຄ່າມັດຈຳລັງ (Crate Deposit)
                          </span>
                          <span className="text-[9.5px] text-amber-800 leading-tight block">
                            ສຳລັບເບຍຍົກແກັດ: ເມື່ອລູກຄ້າບໍ່ມີແກັດເປົ່າມາປ່ຽນ
                          </span>
                        </div>
                      </div>

                      {hasCrateDeposit && (
                        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 bg-white p-1 rounded-md border border-amber-300 shadow-2xs">
                          <span className="text-[10px] font-bold text-amber-900">+ ຄ່າແກັດ:</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={crateDepositFee}
                            onChange={(e) => setCrateDepositFee && setCrateDepositFee(formatDots(e.target.value))}
                            placeholder="30.000"
                            className="w-18 h-7 px-1.5 bg-amber-50/40 border border-amber-300 rounded text-xs font-black text-amber-950 font-mono text-center focus:bg-white focus:outline-none"
                          />
                          <span className="text-[10px] font-black text-amber-900 font-mono">₭</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* TIER 2: PACK (Pack / Bundle - Middle Tier) */}
              <div
                className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all ${
                  enablePack ? 'bg-white border-sky-200/90 shadow-2xs ring-1 ring-sky-500/10' : 'bg-slate-50/70 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-sky-100 text-sky-800 flex items-center justify-center font-black text-[11px]">
                      2
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-800 block">
                        ລະດັບ 2: ຂາຍແພັກ (Pack / Bundle)
                      </span>
                      <span className="text-[9.5px] text-slate-400 hidden xs:block">
                        ຕົວຢ່າງ: ແພັກ, ມັດ, ແຕະ, ໂหล...
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={enablePack}
                      onChange={(e) => setEnablePack(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                {enablePack && (
                  <div className="flex flex-col gap-2 pt-1.5 border-t border-slate-100">
                    {/* Quick Suggestions Chips */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[9.5px] font-bold text-slate-400">ເລືອກໄວ:</span>
                      {['ແພັກ', 'ມັດ', 'ແຕະ', 'ໂหล', 'ຖົງກາງ'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setPackUnitName(s)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            packUnitName === s
                              ? 'bg-sky-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10.5px] text-slate-700 font-bold block mb-0.5">
                          ຊື່ຫົວໜ່ວຍແພັກ:
                        </label>
                        <input
                          type="text"
                          value={packUnitName}
                          onChange={(e) => setPackUnitName(e.target.value)}
                          placeholder="ແພັກ, ມັດ..."
                          className="w-full h-8.5 sm:h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label
                          className="text-[10.5px] text-slate-700 font-bold block mb-0.5 truncate"
                          title={
                            enablePiece
                              ? `ຈຳນວນ ${pieceUnitName && pieceUnitName !== packUnitName ? pieceUnitName : 'ອັນ'} ຕໍ່ 1 ${packUnitName || 'ແພັກ'}`
                              : `ຫົວໜ່ວຍຫຼັກ (Base Unit)`
                          }
                        >
                          {enablePiece
                            ? `ຈຳນວນ ${pieceUnitName && pieceUnitName !== packUnitName ? pieceUnitName : 'ອັນ'} ຕໍ່ 1 ${packUnitName || 'ແພັກ'}:`
                            : `ຫົວໜ່ວຍຫຼັກ (Base Unit):`}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={enablePiece ? packMultiplier : '1'}
                          onChange={(e) => setPackMultiplier(formatDots(e.target.value))}
                          disabled={!enablePiece}
                          placeholder="4"
                          className="w-full h-8.5 sm:h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-900 font-mono focus:outline-none focus:border-teal-600 focus:bg-white disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* 3 Price Tiers Grid (ລາຄາ 1, ລາຄາ 2, ລາຄາ 3) */}
                    <div className="bg-sky-50/50 p-2 sm:p-2.5 rounded-lg border border-sky-200/80">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10.5px] font-black text-sky-950 flex items-center gap-1.5">
                          <Coins size={14} weight="duotone" className="text-sky-700" />
                          <span>ຕາຕະລາງ 3 ລະດັບລາຄາຂາຍແພັກ (Multi-Price Tiers):</span>
                        </span>
                        <span className="text-[9px] text-sky-800/80 hidden xs:inline">
                          (ລາຄາ 2 & 3 ບໍ່ບັງຄັບ)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                        {/* Price 1: Standard */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-800 flex items-center justify-between mb-0.5">
                            <span className="truncate">ລາຄາ 1 (ມາດຕະຖານ) <span className="text-rose-500">*</span></span>
                            <span className="text-[8.5px] font-extrabold text-teal-700 bg-teal-100/90 px-1 rounded shrink-0">ຫຼັກ POS</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={packPrice}
                            onChange={(e) => setPackPrice(formatDots(e.target.value))}
                            placeholder="0"
                            className="w-full h-8.5 sm:h-9 px-2.5 bg-white border border-teal-500 rounded-lg text-xs font-black text-teal-900 font-mono focus:outline-none focus:ring-1 focus:ring-teal-600"
                          />
                        </div>

                        {/* Price 2: Regular Customer */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 flex items-center justify-between mb-0.5">
                            <span className="truncate">ລາຄາ 2 (ລູກຄ້າປະຈຳ)</span>
                            <span className="text-[8.5px] text-sky-700 bg-sky-100/80 px-1 rounded shrink-0">ຂາປະຈຳ</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={packPrice2}
                            onChange={(e) => setPackPrice2(formatDots(e.target.value))}
                            placeholder="(ບໍ່ກຳນົດ)"
                            className="w-full h-8.5 sm:h-9 px-2.5 bg-white border border-slate-300 focus:border-sky-500 rounded-lg text-xs font-bold text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </div>

                        {/* Price 3: Wholesale / VIP */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 flex items-center justify-between mb-0.5">
                            <span className="truncate">ລາຄາ 3 (ລາຄາສົ່ງ/VIP)</span>
                            <span className="text-[8.5px] text-amber-800 bg-amber-100 px-1 rounded font-bold shrink-0">VIP/ສົ່ງ</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={packPrice3}
                            onChange={(e) => setPackPrice3(formatDots(e.target.value))}
                            placeholder="(ບໍ່ກຳນົດ)"
                            className="w-full h-8.5 sm:h-9 px-2.5 bg-white border border-slate-300 focus:border-amber-500 rounded-lg text-xs font-bold text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tier 2 Barcode Input with Camera Scanner */}
                    <div className="p-2 sm:p-2.5 bg-sky-50/70 border border-sky-200/90 rounded-lg sm:rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] sm:text-[10.5px] font-bold text-sky-900 flex items-center gap-1.5">
                          <Barcode size={13} className="text-sky-700" />
                          <span>ບາໂຄດເທິງແພັກ (Pack Barcode)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleOpenScannerFor('pack')}
                          className="text-[9.5px] font-black text-sky-900 hover:text-sky-950 flex items-center gap-1 cursor-pointer bg-white hover:bg-sky-100 px-2 py-0.5 rounded border border-sky-300 transition-all active:scale-95 shadow-2xs"
                          title="ສະແກນບາໂຄດເທິງແພັກ"
                        >
                          <Camera size={11} weight="bold" />
                          <span>ສະແກນກ້ອງ</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={packBarcode}
                        onChange={(e) => setPackBarcode && setPackBarcode(e.target.value)}
                        placeholder="ຍິງບາໂຄດເທິງແພັກ ຫຼື ກົດປຸ່ມສະແກນກ້ອງ"
                        className="w-full h-8 sm:h-8.5 px-2.5 bg-white border border-sky-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      {checkBarcodeDuplicate(packBarcode) && (
                        <p className="text-[9.5px] text-amber-800 font-bold mt-1 flex items-center gap-1">
                          <WarningCircle size={11} weight="fill" className="text-amber-600 shrink-0" />
                          <span>⚠️ ບາໂຄດນີ້ມີໃນລະບົບແລ້ວ: "{checkBarcodeDuplicate(packBarcode)?.name}"</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* TIER 1: PIECE (Base / Smallest Unit - Bottom Tier) */}
              <div
                className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all ${
                  enablePiece ? 'bg-white border-teal-200/90 shadow-2xs ring-1 ring-teal-500/10' : 'bg-slate-50/70 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-teal-100 text-teal-800 flex items-center justify-center font-black text-[11px]">
                      3
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-800 block">
                        ລະດັບ 3: ຂາຍຍ່ອຍ (Base Unit / Piece)
                      </span>
                      <span className="text-[9.5px] text-slate-400 hidden xs:block">
                        ຫົວໜ່ວຍຍ່ອຍສຸດ ເຊັ່ນ: ອັນ, ແກ້ວ, ຖົງ, ກະປ໋ອງ, ຕຸກ, ຊອງ...
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={enablePiece}
                      onChange={(e) => setEnablePiece(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                {enablePiece && (
                  <div className="flex flex-col gap-2 pt-1.5 border-t border-slate-100">
                    {/* Quick Suggestions Chips */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[9.5px] font-bold text-slate-400">ເລືອກໄວ:</span>
                      {['ອັນ', 'ແກ້ວ', 'ຖົງ', 'ກະປ໋ອງ', 'ຕຸກ', 'ຊອງ', 'ກ່ອງ'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setPieceUnitName(s)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            pieceUnitName === s
                              ? 'bg-teal-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="text-[10.5px] text-slate-700 font-bold block mb-0.5">
                        ຊື່ຫົວໜ່ວຍຍ່ອຍ (Unit Name):
                      </label>
                      <input
                        type="text"
                        value={pieceUnitName}
                        onChange={(e) => setPieceUnitName(e.target.value)}
                        placeholder="ອັນ, ແກ້ວ, ຖົງ..."
                        className="w-full h-8.5 sm:h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
                      />
                    </div>

                    {/* 3 Price Tiers Grid (ລາຄາ 1, ລາຄາ 2, ລາຄາ 3) */}
                    <div className="bg-teal-50/50 p-2 sm:p-2.5 rounded-lg border border-teal-200/80">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10.5px] font-black text-teal-950 flex items-center gap-1.5">
                          <Coins size={14} weight="duotone" className="text-teal-700" />
                          <span>ຕາຕະລາງ 3 ລະດັບລາຄາຂາຍຍ່ອຍ (Multi-Price Tiers):</span>
                        </span>
                        <span className="text-[9px] text-teal-800/80 hidden xs:inline">
                          (ລາຄາ 2 & 3 ບໍ່ບັງຄັບ)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                        {/* Price 1: Standard */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-800 flex items-center justify-between mb-0.5">
                            <span className="truncate">ລາຄາ 1 (ມາດຕະຖານ) <span className="text-rose-500">*</span></span>
                            <span className="text-[8.5px] font-extrabold text-teal-700 bg-teal-100/90 px-1 rounded shrink-0">ຫຼັກ POS</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={piecePrice}
                            onChange={(e) => setPiecePrice(formatDots(e.target.value))}
                            placeholder="0"
                            className="w-full h-8.5 sm:h-9 px-2.5 bg-white border border-teal-500 rounded-lg text-xs font-black text-teal-900 font-mono focus:outline-none focus:ring-1 focus:ring-teal-600"
                          />
                        </div>

                        {/* Price 2: Regular Customer */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 flex items-center justify-between mb-0.5">
                            <span className="truncate">ລາຄາ 2 (ລູກຄ້າປະຈຳ)</span>
                            <span className="text-[8.5px] text-sky-700 bg-sky-100/80 px-1 rounded shrink-0">ຂາປະຈຳ</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={piecePrice2}
                            onChange={(e) => setPiecePrice2(formatDots(e.target.value))}
                            placeholder="(ບໍ່ກຳນົດ)"
                            className="w-full h-8.5 sm:h-9 px-2.5 bg-white border border-slate-300 focus:border-sky-500 rounded-lg text-xs font-bold text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </div>

                        {/* Price 3: Wholesale / VIP */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 flex items-center justify-between mb-0.5">
                            <span className="truncate">ລາຄາ 3 (ລາຄາສົ່ງ/VIP)</span>
                            <span className="text-[8.5px] text-amber-800 bg-amber-100 px-1 rounded font-bold shrink-0">VIP/ສົ່ງ</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={piecePrice3}
                            onChange={(e) => setPiecePrice3(formatDots(e.target.value))}
                            placeholder="(ບໍ່ກຳນົດ)"
                            className="w-full h-8.5 sm:h-9 px-2.5 bg-white border border-slate-300 focus:border-amber-500 rounded-lg text-xs font-bold text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tier 3 Barcode Input with Camera Scanner */}
                    <div className="p-2 sm:p-2.5 bg-teal-50/70 border border-teal-200/90 rounded-lg sm:rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] sm:text-[10.5px] font-bold text-teal-950 flex items-center gap-1.5">
                          <Barcode size={13} className="text-teal-700" />
                          <span>ບາໂຄດເທິງອັນ/ແກ້ວ/ຊອງ (Piece Barcode)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleOpenScannerFor('piece')}
                          className="text-[9.5px] font-black text-teal-900 hover:text-teal-950 flex items-center gap-1 cursor-pointer bg-white hover:bg-teal-100 px-2 py-0.5 rounded border border-teal-300 transition-all active:scale-95 shadow-2xs"
                          title="ສະແກນບາໂຄດຂາຍຍ່ອຍ"
                        >
                          <Camera size={11} weight="bold" />
                          <span>ສະແກນກ້ອງ</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={pieceBarcode}
                        onChange={(e) => setPieceBarcode && setPieceBarcode(e.target.value)}
                        placeholder="ຍິງບາໂຄດເທິງຊອງ/ກະປ໋ອງ ຫຼື ກົດປຸ່ມສະແກນກ້ອງ"
                        className="w-full h-8 sm:h-8.5 px-2.5 bg-white border border-teal-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                      {checkBarcodeDuplicate(pieceBarcode) && (
                        <p className="text-[9.5px] text-amber-800 font-bold mt-1 flex items-center gap-1">
                          <WarningCircle size={11} weight="fill" className="text-amber-600 shrink-0" />
                          <span>⚠️ ບາໂຄດນີ້ມີໃນລະບົບແລ້ວ: "{checkBarcodeDuplicate(pieceBarcode)?.name}"</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* 3. FULLSCREEN STICKY FOOTER (Strictly h-14 / 56px on mobile) */}
      <footer className="bg-white border-t border-slate-200/90 px-3 sm:px-6 md:px-8 h-14 flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="text-[11px] sm:text-xs text-slate-500 font-medium truncate max-w-[180px] xs:max-w-[240px] sm:max-w-none">
          {productToEdit ? `ແກ້ໄຂ: ${productToEdit.name}` : 'ເພີ່ມສິນຄ້າໃໝ່ລົງລະບົບ'}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
          >
            ຍົກເລີກ
          </button>
          <button
            type="submit"
            form="product-entry-form"
            className="h-9 sm:h-9.5 px-3.5 sm:px-5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-lg sm:rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <CheckCircle size={15} weight="fill" />
            <span>ບັນທຶກສິນຄ້າ<span className="hidden sm:inline"> (Save Product)</span></span>
          </button>
        </div>
      </footer>

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanBarcodeSuccess}
        title={
          scannerTarget === 'carton'
            ? `ສະແກນບາໂຄດເທິງແກັດ (${cartonUnitName || 'ແກັດ'})`
            : scannerTarget === 'pack'
            ? `ສະແກນບາໂຄດເທິງແພັກ (${packUnitName || 'ແພັກ'})`
            : scannerTarget === 'piece'
            ? `ສະແກນບາໂຄດເທິງອັນຍ່ອຍ (${pieceUnitName || 'ອັນ'})`
            : 'ສະແກນບາໂຄດສິນຄ້າ (Product Barcode)'
        }
        description="ສ່ອງກ້ອງຫຼັງໃສ່ບາໂຄດສິນຄ້າເພື່ອປ້ອນເລກບາໂຄດອັດຕະໂນມັດ"
      />
    </div>
  );
}
