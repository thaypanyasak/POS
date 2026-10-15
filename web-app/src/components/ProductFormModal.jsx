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
  Gear
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
  handleBahtCostChange,
  handleKipCostChange,
  exchangeRate = 720,
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
      {/* 1. TOP FULLSCREEN HEADER */}
      <header className="bg-white border-b border-slate-200/90 px-6 py-3.5 flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            title="ກັບຄືນ"
          >
            <ArrowLeft size={18} weight="bold" />
          </button>
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <PlusCircle size={22} className="text-teal-600" weight="fill" />
              <span>{productToEdit ? 'ແກ້ໄຂສິນຄ້າ (Edit Product)' : 'ເພີ່ມສິນຄ້າໃໝ່ (Product Entry Form)'}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                Full Screen Mode
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              ຕົ້ນທຶນບາດ/ກີບ, ສະຕັອກສິນຄ້າ ແລະ Switch ເປີດ/ປິດ 3 ລະດັບຫົວໜ່ວຍ (ຍົກລັງ, ແພັກ, ຂາຍຍ່ອຍ)
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
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
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            ຍົກເລີກ
          </button>
          <button
            type="submit"
            form="product-entry-form"
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle size={16} weight="fill" />
            <span>ບັນທຶກສິນຄ້າ (Save Product)</span>
          </button>
        </div>
      </header>

      {/* 2. FULLSCREEN SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <form
          id="product-entry-form"
          onSubmit={onSaveProduct}
          className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* LEFT COLUMN: Basic Info, Simplified Purchase Cost, Stock (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* CARD 1: Basic Info */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Package size={18} className="text-teal-600" weight="bold" />
                <h3 className="text-xs font-black text-slate-800">
                  1. ຂໍ້ມູນພື້ນຖານສິນຄ້າ (Product Profile)
                </h3>
              </div>

              {/* Product Image Upload with High-Efficiency Client-Side Compression */}
              <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera size={16} className="text-teal-600" weight="bold" />
                    <span>ຮູບພາບສິນຄ້າ (Product Image)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="text-[11px] font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                  >
                    <LinkSimple size={13} />
                    <span>{showUrlInput ? 'ເຊື່ອງ URL' : 'ປ້ອນ URL ໂດຍກົງ'}</span>
                  </button>
                </div>

                <div className="flex items-start gap-3.5">
                  {/* Thumbnail Preview */}
                  <div className="relative w-20 h-20 rounded-xl border-2 border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-2xs group">
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
                        <ImageIcon size={24} />
                        <span className="text-[9px] font-medium mt-0.5">ບໍ່ມີຮູບ</span>
                      </div>
                    )}

                    {isCompressingImage && (
                      <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>

                  {/* Actions & Compression Stats */}
                  <div className="flex-1 flex flex-col justify-between min-h-[5rem] gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
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
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <UploadSimple size={14} weight="bold" />
                        <span>{displayImage ? 'ປ່ຽນຮູບພາບ (Upload)' : 'ເລືອກຮູບຈາກເຄື່ອງ (Upload)'}</span>
                      </button>

                      {displayImage && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                          title="ລຶບຮູບພາບ"
                        >
                          <Trash size={15} />
                        </button>
                      )}
                    </div>

                    {/* Compression Feedback Badges */}
                    {imageError ? (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-1.5 text-[11px] text-red-800 font-bold">
                        <span>⚠️ {imageError}</span>
                        <button
                          type="button"
                          onClick={() => setImageError('')}
                          className="text-red-500 hover:text-red-700 text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : imageCompressionStats ? (
                      <div className="bg-emerald-50 border border-emerald-200/80 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-[11px] text-emerald-900 font-bold">
                        <Lightning size={14} weight="fill" className="text-emerald-600 shrink-0" />
                        <span>
                          ບີບອັດແລ້ວ: <strong className="text-slate-600 line-through">{imageCompressionStats.originalSize}</strong> ➔ <strong className="text-emerald-700 font-black">{imageCompressionStats.compressedSize}</strong> (ປະຢັດ {imageCompressionStats.savedPercent}%)
                        </span>
                      </div>
                    ) : (
                      <p className="text-[10.5px] text-slate-500 leading-tight">
                        💡 ລະບົບຈະບີບອັດຮູບອັດຕະໂນມັດໃຫ້ເຫຼືອພຽງ ~15-30 KB ກ່ອນອັບໂຫຼດຂຶ້ນ Supabase ເພື່ອບໍ່ໃຫ້ພື້ນທີ່ເຕັມ.
                      </p>
                    )}
                  </div>
                </div>

                {/* Optional Web URL Input */}
                {showUrlInput && (
                  <div className="mt-1 pt-2 border-t border-slate-200 flex flex-col gap-1">
                    <label className="text-[10.5px] font-bold text-slate-600">
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
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-teal-600 font-mono"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ຊື່ສິນຄ້າ (Product Name) *
                </label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="e.g. ເຄື່ອງດື່ມ ຊາຂຽວ Oishi 500ml"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white font-bold transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    ໝວດໝູ່ (Category)
                  </label>
                  <div className="flex items-center gap-1.5">
                    {onOpenCategoryManager && (
                      <button
                        type="button"
                        onClick={onOpenCategoryManager}
                        className="text-[10px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg border border-slate-200 transition-all active:scale-95 shadow-2xs"
                        title="ຈັດການໝວດໝູ່ (Category Manager)"
                      >
                        <Gear size={12} weight="bold" />
                        <span>ຈັດການໝວດໝູ່</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCat(!isAddingNewCat)}
                      className="text-[10px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-lg border border-teal-200 transition-all active:scale-95 shadow-2xs"
                    >
                      <Plus size={11} weight="bold" />
                      <span>{isAddingNewCat ? 'ຍົກເລີກ' : '+ ໝວດໃໝ່'}</span>
                    </button>
                  </div>
                </div>

                {isAddingNewCat ? (
                  <div className="flex items-center gap-1.5 p-1 bg-teal-50/80 rounded-xl border border-teal-300 animate-in fade-in duration-150">
                    <input
                      type="text"
                      value={customCatInput}
                      onChange={(e) => setCustomCatInput(e.target.value)}
                      placeholder="ປ້ອນຊື່ໝວດໝູ່ໃໝ່..."
                      className="flex-1 px-3 py-2 bg-white border border-teal-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
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
                      className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95 shrink-0"
                    >
                      ເພີ່ມ
                    </button>
                  </div>
                ) : (
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white font-bold transition-all cursor-pointer"
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

            {/* CARD 2: SIMPLIFIED PURCHASE COST (Section 2) */}
            <div className="bg-white p-5 rounded-2xl border border-teal-200/80 shadow-xs bg-gradient-to-br from-teal-50/20 to-white flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-teal-100">
                <div className="flex items-center gap-2">
                  <CurrencyCircleDollar size={20} className="text-teal-600" weight="fill" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900">
                      2. ຕົ້ນທຶນຊື້ເຂົ້າ (Purchase Cost)
                    </h3>
                    <p className="text-[10.5px] text-slate-500 mt-0.5">
                      ປ້ອນຕົ້ນທຶນບາດ (ອ້າງອີງ) ແລະ ຕົ້ນທຶນກີບ (ບັນຊີຮ້ານ)
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 1. THB Purchase Cost (Personal reference/tracking only, does NOT alter sales or Kip math) */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-800">
                      ຕົ້ນທຶນບາດ (฿ THB)
                    </label>
                    <span className="text-[9.5px] text-slate-500 leading-tight block mb-2">
                      ສຳລັບບັນທຶກອ້າງອີງສ່ວນຕົວ
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newProdCostBaht}
                      onChange={(e) => handleBahtCostChange(e.target.value)}
                      placeholder="0"
                      className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-black text-slate-900 font-mono focus:outline-none focus:border-teal-600 focus:bg-white transition-colors"
                    />
                    <span className="absolute right-2.5 top-2 text-xs font-black text-slate-400 font-mono">฿</span>
                  </div>
                </div>

                {/* 2. LAK Purchase Cost (Main purchase cost for store accounting) */}
                <div className="p-3 bg-white rounded-xl border border-teal-200 shadow-2xs flex flex-col justify-between">
                  <div>
                    <label className="block text-[11px] font-extrabold text-teal-900">
                      ຕົ້ນທຶນກີບ (₭ LAK)
                    </label>
                    <span className="text-[9.5px] text-teal-600 leading-tight block mb-2">
                      ຕົ້ນທຶນຫຼັກບັນຊີຮ້ານ & ກຳໄລ
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newProdCostKip}
                      onChange={(e) => handleKipCostChange(e.target.value)}
                      placeholder="0"
                      className="w-full pl-3 pr-8 py-2 bg-teal-50/40 border border-teal-300 rounded-lg text-sm font-black text-teal-900 font-mono focus:outline-none focus:border-teal-600 focus:bg-white transition-colors"
                    />
                    <span className="absolute right-2.5 top-2 text-xs font-black text-teal-600 font-mono">₭</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: INVENTORY TRACKING & STARTING STOCK (Section 3) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col gap-3.5">
              {/* Upfront Switch: [ ] ຕິດຕາມສະຕັອກສິນຄ້າ (Track Physical Stock) */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Warehouse size={17} className="text-teal-600" weight="bold" />
                    <span>3. ຕິດຕາມສະຕັອກສິນຄ້າ (Track Stock)</span>
                  </h3>
                  <p className="text-[10.5px] text-slate-500 mt-0.5">
                    {trackStock
                      ? 'ເປີດນັບສະຕັອກຕົວຈິງ (ຕັດສະຕັອກອັດຕະໂນມັດເມື່ອຂາຍ)'
                      : 'ປິດນັບສາງ - ຂາຍໄດ້ຕະຫຼອດ ເຖິງແມ່ນສະຕັອກເປັນ 0 (ສະແດງ "ບໍ່ນັບສາງ")'}
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={trackStock}
                    onChange={(e) => setTrackStock(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>

              {/* Conditional Display: If Switch is OFF vs ON */}
              {trackStock ? (
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-bold text-slate-700">
                    ປ້ອນຈຳນວນສະຕັອກເລີ່ມຕົ້ນຕົວຈິງໃນສາງ:
                  </span>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Carton Stock */}
                    {enableCarton && (
                      <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/80">
                        <label className="text-[10px] font-bold text-amber-900 block mb-1 truncate" title={cartonUnitName || 'ແກັດ'}>
                          {cartonUnitName || 'ແກັດ'}:
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={stockCartons}
                          onChange={(e) => setStockCartons(formatDots(e.target.value))}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-black text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    )}

                    {/* Pack Stock */}
                    {enablePack && (
                      <div className="p-2.5 bg-sky-50/60 rounded-xl border border-sky-200/80">
                        <label className="text-[10px] font-bold text-sky-900 block mb-1 truncate" title={packUnitName || 'ແພັກ'}>
                          {packUnitName || 'ແພັກ'}:
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={stockPacks}
                          onChange={(e) => setStockPacks(formatDots(e.target.value))}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 bg-white border border-sky-300 rounded-lg text-xs font-mono font-black text-sky-950 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    )}

                    {/* Loose Piece Stock */}
                    {enablePiece && (
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="text-[10px] font-bold text-slate-700 block mb-1 truncate" title={pieceUnitName || 'ອັນ'}>
                          {pieceUnitName || 'ອັນຍ່ອຍ'}:
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={stockPieces}
                          onChange={(e) => setStockPieces(formatDots(e.target.value))}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-black text-slate-950 focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                      </div>
                    )}
                  </div>

                  {/* Summary preview */}
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/70 text-[10.5px] text-slate-600 flex items-center gap-1.5">
                    <Info size={14} className="text-teal-600 shrink-0" />
                    <span>
                      ສະຕັອກເລີ່ມຕົ້ນ:{' '}
                      <strong className="text-slate-900">
                        {enableCarton && `${stockCartons || 0} ${cartonUnitName || 'ແກັດ'} `}
                        {enablePack && `${stockPacks || 0} ${packUnitName || 'ແພັກ'} `}
                        {enablePiece && `${stockPieces || 0} ${pieceUnitName || 'ອັນ'}`}
                      </strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex items-start gap-2.5">
                  <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-slate-600 leading-relaxed">
                    <span className="font-bold text-slate-800 block mb-0.5">ໂໝດບໍ່ນັບສະຕັອກ (No Stock Count)</span>
                    ສິນຄ້ານີ້ບໍ່ໄດ້ເປີດຕິດຕາມສະຕັອກ. ພະນັກງານຂາຍສາມາດຂາຍໄດ້ຢ່າງຕໍ່ເນື່ອງໂດຍບໍ່ຈຳກັດຈຳນວນ ແລະ ໜ້າຂາຍ POS ຈະສະແດງ <strong>"ບໍ່ນັບສາງ"</strong>.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: 3-Tier Packaging Switches (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <Calculator size={18} className="text-teal-600" weight="bold" />
                    <span>4. ຕັ້ງຄ່າ 3 ລະດັບຫົວໜ່ວຍຂາຍ (Dynamic Sale Units)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ເປີດ/ປິດ ຫົວໜ່ວຍຂາຍຢ່າງອິດສະຫຼະ (ຫົວໜ່ວຍໃດປິດ ຈະບໍ່ສະແດງປຸ່ມໃນໜ້າ POS ຂອງພະນັກງານຂາຍ)
                  </p>
                </div>
              </div>

              {/* TIER 3: CARTON (Carton / Box / Sack - Top Tier) */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  enableCarton ? 'bg-white border-amber-200/90 shadow-2xs ring-1 ring-amber-500/10' : 'bg-slate-50/70 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-black text-xs">
                      1
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-800 block">
                        ລະດັບ 1: ຂາຍຍົກແກັດ / ລັງ / ເປົາ (Carton / Box / Sack)
                      </span>
                      <span className="text-[10px] text-slate-400">
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
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                {enableCarton && (
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
                    {/* Quick Suggestions Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400">ເລືອກໄວ:</span>
                      {['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງໃຫຍ່', 'ຖັງ'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCartonUnitName(s)}
                          className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition-all cursor-pointer ${
                            cartonUnitName === s
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-700 font-bold block mb-1">
                          ຊື່ຫົວໜ່ວຍຍົກລັງ:
                        </label>
                        <input
                          type="text"
                          value={cartonUnitName}
                          onChange={(e) => setCartonUnitName(e.target.value)}
                          placeholder="ແກັດ, ລັງ, ເປົາ..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
                        />
                      </div>

                      {/* Multiplier Label:
                          Always correctly displays: "ຈຳນວນ [ແພັກ] ຕໍ່ 1 [ແກັດ]" when Tier 2 is active */}
                      <div>
                        <label
                          className="text-[11px] text-slate-700 font-bold block mb-1 truncate"
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
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 font-mono focus:outline-none focus:border-teal-600 focus:bg-white disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-700 font-bold block mb-1">
                          ລາຄາຂາຍຍົກລັງ (₭):
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={cartonPrice}
                          onChange={(e) => setCartonPrice(formatDots(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 bg-white border border-teal-500 rounded-xl text-xs font-black text-teal-900 font-mono focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                      </div>
                    </div>

                    {/* Tier 1 Barcode Input with Camera Scanner */}
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200/90 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10.5px] font-bold text-amber-900 flex items-center gap-1.5">
                          <Barcode size={14} className="text-amber-700" />
                          <span>ບາໂຄດເທິງແກັດ/ລັງ (Carton Barcode)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleOpenScannerFor('carton')}
                          className="text-[10px] font-black text-amber-900 hover:text-amber-950 flex items-center gap-1 cursor-pointer bg-white hover:bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-300 transition-all active:scale-95 shadow-2xs"
                          title="ສະແກນບາໂຄດເທິງແກັດ"
                        >
                          <Camera size={12} weight="bold" />
                          <span>ສະແກນກ້ອງ</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={cartonBarcode}
                        onChange={(e) => setCartonBarcode && setCartonBarcode(e.target.value)}
                        placeholder="ຍິງບາໂຄດເທິງລັງ ຫຼື ກົດປຸ່ມສະແກນກ້ອງ"
                        className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      {checkBarcodeDuplicate(cartonBarcode) && (
                        <p className="text-[10px] text-amber-800 font-bold mt-1 flex items-center gap-1">
                          <WarningCircle size={12} weight="fill" className="text-amber-600 shrink-0" />
                          <span>⚠️ ບາໂຄດນີ້ມີໃນລະບົບແລ້ວ: "{checkBarcodeDuplicate(cartonBarcode)?.name}"</span>
                        </p>
                      )}
                    </div>

                    {/* Crate Deposit Setting */}
                    <div className="mt-2 pt-2.5 border-t border-amber-200/80 bg-amber-50/50 p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start gap-2.5">
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                          <input
                            type="checkbox"
                            checked={Boolean(hasCrateDeposit)}
                            onChange={(e) => setHasCrateDeposit && setHasCrateDeposit(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                        </label>
                        <div>
                          <span className="text-xs font-black text-amber-950 block">
                            ຄ່າມັດຈຳລັງ (Crate Deposit)
                          </span>
                          <span className="text-[10px] text-amber-800 leading-tight block mt-0.5">
                            ສຳລັບເບຍຍົກແກັດ: ເມື່ອລູກຄ້າບໍ່ມີແກັດເປົ່າມາປ່ຽນ ລະບົບຈະມີປຸ່ມໃຫ້ຕິກເພີ່ມຄ່າແກັດໃນກະຕ່າຂາຍ
                          </span>
                        </div>
                      </div>

                      {hasCrateDeposit && (
                        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 bg-white p-1.5 rounded-lg border border-amber-300 shadow-2xs">
                          <span className="text-[10.5px] font-bold text-amber-900">+ ຄ່າແກັດ:</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={crateDepositFee}
                            onChange={(e) => setCrateDepositFee && setCrateDepositFee(formatDots(e.target.value))}
                            placeholder="30.000"
                            className="w-20 px-2 py-1 bg-amber-50/40 border border-amber-300 rounded text-xs font-black text-amber-950 font-mono text-center focus:bg-white focus:outline-none"
                          />
                          <span className="text-[10.5px] font-black text-amber-900 font-mono">₭</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* TIER 2: PACK (Pack / Bundle - Middle Tier) */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  enablePack ? 'bg-white border-sky-200/90 shadow-2xs ring-1 ring-sky-500/10' : 'bg-slate-50/70 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-black text-xs">
                      2
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-800 block">
                        ລະດັບ 2: ຂາຍແພັກ (Pack / Bundle)
                      </span>
                      <span className="text-[10px] text-slate-400">
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
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                {enablePack && (
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
                    {/* Quick Suggestions Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400">ເລືອກໄວ:</span>
                      {['ແພັກ', 'ມັດ', 'ແຕະ', 'ໂหล', 'ຖົງກາງ'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setPackUnitName(s)}
                          className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition-all cursor-pointer ${
                            packUnitName === s
                              ? 'bg-sky-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-700 font-bold block mb-1">
                          ຊື່ຫົວໜ່ວຍແພັກ:
                        </label>
                        <input
                          type="text"
                          value={packUnitName}
                          onChange={(e) => setPackUnitName(e.target.value)}
                          placeholder="ແພັກ, ມັດ..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label
                          className="text-[11px] text-slate-700 font-bold block mb-1 truncate"
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
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 font-mono focus:outline-none focus:border-teal-600 focus:bg-white disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-700 font-bold block mb-1">
                          ລາຄາຂາຍແພັກ (₭):
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={packPrice}
                          onChange={(e) => setPackPrice(formatDots(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 bg-white border border-teal-500 rounded-xl text-xs font-black text-teal-900 font-mono focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                      </div>
                    </div>

                    {/* Tier 2 Barcode Input with Camera Scanner */}
                    <div className="p-2.5 bg-sky-50/70 border border-sky-200/90 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10.5px] font-bold text-sky-900 flex items-center gap-1.5">
                          <Barcode size={14} className="text-sky-700" />
                          <span>ບາໂຄດເທິງແພັກ (Pack Barcode)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleOpenScannerFor('pack')}
                          className="text-[10px] font-black text-sky-900 hover:text-sky-950 flex items-center gap-1 cursor-pointer bg-white hover:bg-sky-100 px-2 py-0.5 rounded-lg border border-sky-300 transition-all active:scale-95 shadow-2xs"
                          title="ສະແກນບາໂຄດເທິງແພັກ"
                        >
                          <Camera size={12} weight="bold" />
                          <span>ສະແກນກ້ອງ</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={packBarcode}
                        onChange={(e) => setPackBarcode && setPackBarcode(e.target.value)}
                        placeholder="ຍິງບາໂຄດເທິງແພັກ ຫຼື ກົດປຸ່ມສະແກນກ້ອງ"
                        className="w-full px-3 py-1.5 bg-white border border-sky-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      {checkBarcodeDuplicate(packBarcode) && (
                        <p className="text-[10px] text-amber-800 font-bold mt-1 flex items-center gap-1">
                          <WarningCircle size={12} weight="fill" className="text-amber-600 shrink-0" />
                          <span>⚠️ ບາໂຄດນີ້ມີໃນລະບົບແລ້ວ: "{checkBarcodeDuplicate(packBarcode)?.name}"</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* TIER 1: PIECE (Base / Smallest Unit - Bottom Tier) */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  enablePiece ? 'bg-white border-teal-200/90 shadow-2xs ring-1 ring-teal-500/10' : 'bg-slate-50/70 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-black text-xs">
                      3
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-800 block">
                        ລະດັບ 3: ຂາຍຍ່ອຍ (Base Unit / Piece)
                      </span>
                      <span className="text-[10px] text-slate-400">
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
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                {enablePiece && (
                  <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
                    {/* Quick Suggestions Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400">ເລືອກໄວ:</span>
                      {['ອັນ', 'ແກ້ວ', 'ຖົງ', 'ກະປ໋ອງ', 'ຕຸກ', 'ຊອງ', 'ກ່ອງ'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setPieceUnitName(s)}
                          className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition-all cursor-pointer ${
                            pieceUnitName === s
                              ? 'bg-teal-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-700 font-bold block mb-1">
                          ຊື່ຫົວໜ່ວຍຍ່ອຍ (Unit Name):
                        </label>
                        <input
                          type="text"
                          value={pieceUnitName}
                          onChange={(e) => setPieceUnitName(e.target.value)}
                          placeholder="ອັນ, ແກ້ວ, ຖົງ..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-700 font-bold block mb-1">
                          ລາຄາຂາຍຍ່ອຍ (₭ ກີບ):
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={piecePrice}
                          onChange={(e) => setPiecePrice(formatDots(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 bg-white border border-teal-500 rounded-xl text-xs font-black text-teal-900 font-mono focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                      </div>
                    </div>

                    {/* Tier 3 Barcode Input with Camera Scanner */}
                    <div className="p-2.5 bg-teal-50/70 border border-teal-200/90 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10.5px] font-bold text-teal-950 flex items-center gap-1.5">
                          <Barcode size={14} className="text-teal-700" />
                          <span>ບາໂຄດເທິງອັນ/ແກ້ວ/ຊອງ (Piece Barcode)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleOpenScannerFor('piece')}
                          className="text-[10px] font-black text-teal-900 hover:text-teal-950 flex items-center gap-1 cursor-pointer bg-white hover:bg-teal-100 px-2 py-0.5 rounded-lg border border-teal-300 transition-all active:scale-95 shadow-2xs"
                          title="ສະແກນບາໂຄດຂາຍຍ່ອຍ"
                        >
                          <Camera size={12} weight="bold" />
                          <span>ສະແກນກ້ອງ</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={pieceBarcode}
                        onChange={(e) => setPieceBarcode && setPieceBarcode(e.target.value)}
                        placeholder="ຍິງບາໂຄດເທິງຊອງ/ກະປ໋ອງ ຫຼື ກົດປຸ່ມສະແກນກ້ອງ"
                        className="w-full px-3 py-1.5 bg-white border border-teal-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                      {checkBarcodeDuplicate(pieceBarcode) && (
                        <p className="text-[10px] text-amber-800 font-bold mt-1 flex items-center gap-1">
                          <WarningCircle size={12} weight="fill" className="text-amber-600 shrink-0" />
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

      {/* 3. FULLSCREEN STICKY FOOTER */}
      <footer className="bg-white border-t border-slate-200/90 px-8 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
        <div className="text-xs text-slate-500 font-medium">
          {productToEdit ? `ກຳລັງແກ້ໄຂ: ${productToEdit.name}` : 'ກຳລັງເພີ່ມສິນຄ້າໃໝ່ລົງຖານຂໍ້ມູນ Supabase'}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            ຍົກເລີກ
          </button>
          <button
            type="submit"
            form="product-entry-form"
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle size={16} weight="fill" />
            <span>ບັນທຶກສິນຄ້າ (Save Product)</span>
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
