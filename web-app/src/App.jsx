import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  fetchProductsFromSupabase,
  saveProductToSupabase,
  deleteProductFromSupabase,
  fetchTransactionsFromSupabase,
  createSaleTransactionInSupabase,
  cancelTransactionInSupabase,
  deleteTransactionFromSupabase,
  updateTransactionInSupabase,
  uploadProductImageToSupabase,
  fetchCategoriesFromSupabase,
  createCategoryInSupabase,
  updateCategoryInSupabase,
  deleteCategoryInSupabase,
  supabase
} from './services/supabase';

// Modular Components
import Navbar from './components/Navbar';
import PosScreen from './components/PosScreen';
import DashboardView from './components/DashboardView';
import ProductsView from './components/ProductsView';
import HistoryView from './components/HistoryView';
import ReceiptModal from './components/ReceiptModal';
import CheckoutModal from './components/CheckoutModal';
import UnitSelectorModal from './components/UnitSelectorModal';
import ProductFormModal from './components/ProductFormModal';
import CategoryManagerModal from './components/CategoryManagerModal';
import ConfirmDialogModal from './components/ConfirmDialogModal';

import { formatDots, parseDots, formatCompoundStock } from './utils/formatters';

export default function App() {
  // Navigation Tabs: 'pos' | 'dashboard' | 'products' | 'history'
  const [activeMainTab, setActiveMainTab] = useState('pos');

  // Products Data (Supabase Live Sync with local cache, NO mock data)
  const [products, setProducts] = useState(() => {
    try {
      const saved = localStorage.getItem('meiishop_products_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const mockIds = new Set([
            'p_beerlao_gold',
            'p_coca_cola',
            'p_mama_tom_yum',
            'p_redbull_lao',
            'p_tigerhead_water',
            'p_lays_classic'
          ]);
          return parsed.filter((p) => !mockIds.has(p.id));
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached products:', e);
    }
    return [];
  });

  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [dbSavingMessage, setDbSavingMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Global POS configuration
  const [exchangeRate] = useState(720); // 1 ฿ = 720 ₭ (Only for cost calculation & product list)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Default collapsed: chỉ thấy icon
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ທັງໝົດ');

  // Cart & Customer Name
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('ລູກຄ້າທົ່ວໄປ');

  // Transactions History (Supabase Live Sync with cache)
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('meiishop_transactions_v7');
    return saved ? JSON.parse(saved) : [];
  });

  // Modals
  const [unitSelectorProduct, setUnitSelectorProduct] = useState(null);
  const [selectedUnitForModal, setSelectedUnitForModal] = useState(null);
  const [modalQuantity, setModalQuantity] = useState(1);

  const [productFormModalOpen, setProductFormModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);

  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'transfer' | 'debt'
  const [tenderedKip, setTenderedKip] = useState(0);
  const [debtPaidKip, setDebtPaidKip] = useState(0);
  const [debtNote, setDebtNote] = useState('');

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedReceiptForView, setSelectedReceiptForView] = useState(null);
  const [receiptPaperWidth, setReceiptPaperWidth] = useState(80); // 80mm vs 58mm

  // Dashboard Timeframe: 'daily' | 'weekly' | 'monthly' | 'all'
  const [dashboardTimeframe, setDashboardTimeframe] = useState('daily');

  const [rawCategories, setRawCategories] = useState([]);
  const [categoryManagerModalOpen, setCategoryManagerModalOpen] = useState(false);

  // Custom Alert & Confirm Dialog State
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'ຕົກລົງ',
    cancelText: 'ຍົກເລີກ',
    isConfirm: false,
    onConfirm: null,
  });

  const openAlert = (message, title = 'ແຈ້ງເຕືອນລະບົບ', type = 'info') => {
    setDialogState({
      isOpen: true,
      type,
      title,
      message,
      confirmText: 'ຕົກລົງ',
      cancelText: 'ຍົກເລີກ',
      isConfirm: false,
      onConfirm: null,
    });
  };

  const openConfirm = ({ title = 'ຢືນຢັນການດຳເນີນການ', message, type = 'warning', confirmText = 'ຢືນຢັນ', cancelText = 'ຍົກເລີກ', onConfirm }) => {
    setDialogState({
      isOpen: true,
      type,
      title,
      message,
      confirmText,
      cancelText,
      isConfirm: true,
      onConfirm,
    });
  };

  const [categoriesList, setCategoriesList] = useState(() => {
    try {
      const cached = localStorage.getItem('meiishop_categories_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // Product Form State (Simplified Purchase Cost & 3-Tier Switches)
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdCategoryId, setNewProdCategoryId] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdCostKip, setNewProdCostKip] = useState('180.000');
  const [newProdCostBaht, setNewProdCostBaht] = useState('250');
  const [newProdImageUrl, setNewProdImageUrl] = useState('https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80');
  const [imageFileToUpload, setImageFileToUpload] = useState(null);
  const [imageCompressionStats, setImageCompressionStats] = useState(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);

  // 3-Tier Switches & Tier-specific Barcodes
  const [enablePiece, setEnablePiece] = useState(true);
  const [pieceUnitName, setPieceUnitName] = useState('ອັນ');
  const [piecePrice, setPiecePrice] = useState('10.000');
  const [pieceBarcode, setPieceBarcode] = useState('');

  const [enablePack, setEnablePack] = useState(true);
  const [packUnitName, setPackUnitName] = useState('ແພັກ');
  const [packMultiplier, setPackMultiplier] = useState('6');
  const [packPrice, setPackPrice] = useState('55.000');
  const [packBarcode, setPackBarcode] = useState('');

  const [enableCarton, setEnableCarton] = useState(true);
  const [cartonUnitName, setCartonUnitName] = useState('ແກັດ');
  const [cartonMultiplier, setCartonMultiplier] = useState('24');
  const [cartonPrice, setCartonPrice] = useState('210.000');
  const [cartonBarcode, setCartonBarcode] = useState('');

  // Crate Deposit Setting (For Beer crates / glass bottles)
  const [hasCrateDeposit, setHasCrateDeposit] = useState(false);
  const [crateDepositFee, setCrateDepositFee] = useState('30.000');

  // Stock Tracking Toggle & Initial Stock
  const [trackStock, setTrackStock] = useState(true);
  const [stockCartons, setStockCartons] = useState('10');
  const [stockPacks, setStockPacks] = useState('2');
  const [stockPieces, setStockPieces] = useState('0');

  // Function to refresh both products and transactions directly from Supabase
  const handleRefreshAllFromSupabase = async () => {
    setIsRefreshing(true);
    try {
      const cloudProds = await fetchProductsFromSupabase();
      if (cloudProds) {
        // Exclude legacy mock items if any
        const mockIds = new Set([
          'p_beerlao_gold',
          'p_coca_cola',
          'p_mama_tom_yum',
          'p_redbull_lao',
          'p_tigerhead_water',
          'p_lays_classic'
        ]);
        const realProds = cloudProds.filter((p) => !mockIds.has(p.id));
        setProducts(realProds);
        setIsCloudSynced(true);
      } else {
        // If DB returned nothing or error, do not show any mock data
        setProducts([]);
        setIsCloudSynced(false);
      }

      const cloudTxs = await fetchTransactionsFromSupabase();
      if (cloudTxs) {
        setTransactions(cloudTxs);
      } else {
        setTransactions([]);
      }

      // Fetch categories strictly from Supabase 'categories' table
      try {
        const cloudCats = await fetchCategoriesFromSupabase();
        if (cloudCats && cloudCats.length > 0) {
          setRawCategories(cloudCats);
          const names = cloudCats.map((c) => c.name).filter(Boolean);
          setCategoriesList(names);
          localStorage.setItem('meiishop_categories_cache', JSON.stringify(names));
        } else if (realProds && realProds.length > 0) {
          // If table was empty, gather distinct categories from actual products
          const fromProds = Array.from(new Set(realProds.map((p) => p.category).filter(Boolean)));
          if (fromProds.length > 0) {
            setRawCategories(fromProds.map((name, i) => ({ id: `cat_${i}`, name })));
            setCategoriesList(fromProds);
            localStorage.setItem('meiishop_categories_cache', JSON.stringify(fromProds));
          }
        }
      } catch (catErr) {
        console.warn('Category fetch error:', catErr);
      }
    } catch (err) {
      console.warn('Supabase load error:', err);
      setIsCloudSynced(false);
      setProducts([]);
      setTransactions([]);
    } finally {
      setIsRefreshing(false);
      setIsLoadingProducts(false);
    }
  };

  // Initial Data Fetch from Supabase
  useEffect(() => {
    handleRefreshAllFromSupabase();
  }, []);

  // Save changes to localStorage as cache
  useEffect(() => {
    localStorage.setItem('meiishop_products_v5', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('meiishop_transactions_v7', JSON.stringify(transactions));
  }, [transactions]);

  // Dual Currency 2-Way Sync (Only inside product form)
  // Purchase Cost Handlers: THB (reference only) & LAK (store accounting) with dot formatting
  const handleBahtCostChange = (val) => {
    setNewProdCostBaht(formatDots(val));
  };

  const handleKipCostChange = (val) => {
    setNewProdCostKip(formatDots(val));
  };

  // Presets demonstrating flexible packaging combinations
  // Preset 1: Beer (Sold only by carton/crate - Tier 1 & 2 OFF, Tier 3 ON)
  const applyPresetBeer = () => {
    setEnablePiece(false);
    setEnablePack(false);
    setEnableCarton(true);
    setCartonUnitName('ລັງ');
    setCartonMultiplier('1');
    setCartonPrice('265.000');
    setNewProdCostBaht('250');
    setNewProdCostKip('180.000');
    setHasCrateDeposit(true);
    setCrateDepositFee('30.000');
    setTrackStock(true);
    setStockCartons('10');
    setStockPacks('0');
    setStockPieces('0');
  };

  // Preset 2: Soft drinks (3 Tiers all ON: piece, pack, carton)
  const applyPresetDrink3Tiers = () => {
    setEnablePiece(true);
    setPieceUnitName('ກະປ໋ອງ');
    setPiecePrice('10.000');
    setEnablePack(true);
    setPackUnitName('ແພັກ');
    setPackMultiplier('6'); // 6 pieces/pack
    setPackPrice('55.000');
    setEnableCarton(true);
    setCartonUnitName('ແກັດ');
    setCartonMultiplier('4'); // 4 packs/carton (24 cans total)
    setCartonPrice('210.000');
    setNewProdCostBaht('250');
    setNewProdCostKip('180.000');
    setHasCrateDeposit(false);
    setTrackStock(true);
    setStockCartons('10');
    setStockPacks('2');
    setStockPieces('0');
  };

  // Preset 3: Snacks (Sell by pack & box: Tier 1 OFF, Tier 2 & 3 ON, 6 packs/carton)
  const applyPresetSnack3Tiers = () => {
    setEnablePiece(false);
    setEnablePack(true);
    setPackUnitName('ແພັກ');
    setPackMultiplier('1');
    setPackPrice('35.000');
    setEnableCarton(true);
    setCartonUnitName('ແກັດ');
    setCartonMultiplier('6'); // 6 packs/carton
    setCartonPrice('200.000');
    setNewProdCostBaht('250');
    setNewProdCostKip('180.000');
    setHasCrateDeposit(false);
    setTrackStock(true);
    setStockCartons('10');
    setStockPacks('0');
    setStockPieces('0');
  };

  // Preset 4: Sugar/Seasoning (Buy sack, sell bag & sack: Tier 1 & 3 ON, Tier 2 OFF, 25 bags/sack)
  const applyPresetSugarSack = () => {
    setEnablePiece(true);
    setPieceUnitName('ຖົງ');
    setPiecePrice('15.000');
    setEnablePack(false);
    setEnableCarton(true);
    setCartonUnitName('ເປົາ');
    setCartonMultiplier('25'); // 25 bags/sack
    setCartonPrice('350.000');
    setNewProdCostBaht('87');
    setNewProdCostKip('62.640');
    setHasCrateDeposit(false);
    setTrackStock(true);
    setStockCartons('5');
    setStockPacks('0');
    setStockPieces('10');
  };

  // Preset 5: Retail piece only (Tier 1 ON, Tier 2 & 3 OFF)
  const applyPresetPieceOnly = () => {
    setEnablePiece(true);
    setPieceUnitName('ອັນ');
    setPiecePrice('25.000');
    setEnablePack(false);
    setEnableCarton(false);
    setNewProdCostBaht('25');
    setNewProdCostKip('18.000');
    setHasCrateDeposit(false);
    setTrackStock(true);
    setStockCartons('0');
    setStockPacks('0');
    setStockPieces('20');
  };

  // Open New Product Modal with clean reset
  const handleOpenNewProduct = () => {
    setProductToEdit(null);
    setNewProdName('');
    const defaultCat = categoriesList[0] || '';
    setNewProdCategory(defaultCat);
    const matchedRaw = rawCategories.find((c) => c.name === defaultCat);
    setNewProdCategoryId(matchedRaw?.id || '');
    setNewProdBarcode('');
    setCartonBarcode('');
    setPackBarcode('');
    setPieceBarcode('');
    setNewProdImageUrl('');
    setImageFileToUpload(null);
    setImageCompressionStats(null);
    setNewProdCostBaht('');
    setNewProdCostKip('');

    // Default to 3-tier beverage setup with reasonable defaults
    setEnableCarton(true);
    setCartonUnitName('ແກັດ');
    setCartonMultiplier('24');
    setCartonPrice('210.000');

    setEnablePack(true);
    setPackUnitName('ແພັກ');
    setPackMultiplier('6');
    setPackPrice('55.000');

    setEnablePiece(true);
    setPieceUnitName('ອັນ');
    setPiecePrice('10.000');

    setHasCrateDeposit(false);
    setCrateDepositFee('30.000');

    setTrackStock(true);
    setStockCartons('0');
    setStockPacks('0');
    setStockPieces('0');

    setProductFormModalOpen(true);
  };

  // Open Edit Product Modal with rigorous tier hydration and state reset
  const handleOpenEditProduct = (p) => {
    if (!p) return;

    // 1. Reset all form state first to prevent state leakage
    setProductToEdit(p);
    setNewProdName(p.name || '');
    const pCat = p.category || (p.categories?.name) || 'ເຄື່ອງດື່ມ';
    setNewProdCategory(pCat);
    const pCatId = p.categoryId || p.category_id || p.categories?.id || rawCategories.find((c) => c.name === pCat)?.id || '';
    setNewProdCategoryId(pCatId);
    setNewProdBarcode(p.barcode || '');
    setNewProdImageUrl(p.imageUrl || p.image_url || '');
    setImageFileToUpload(null);
    setImageCompressionStats(null);

    // Track Stock switch
    setTrackStock(p.trackStock !== false);

    // Purchase Cost: THB (reference only) & LAK
    setNewProdCostBaht(formatDots(p.costBaht ?? ''));
    setNewProdCostKip(formatDots(p.costKip ?? ''));

    // Crate Deposit setting
    setHasCrateDeposit(Boolean(p.hasCrateDeposit || p.category === 'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ' || p.name?.includes('ເບຍ')));
    setCrateDepositFee(formatDots(p.crateDepositFee || 30000));

    // 2. Identify distinct tier units strictly from p.units
    const units = p.units || [];
    const cartonU = units.find(
      (u) =>
        u.tier === 3 ||
        u.id?.endsWith('_carton') ||
        ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງໃຫຍ່', 'ຖັງ'].includes(u.unitName)
    );
    const packU = units.find(
      (u) =>
        (u.tier === 2 ||
          u.id?.endsWith('_pack') ||
          ['ແພັກ', 'ມັດ', 'ແຕະ', 'ໂหล', 'ຖົງກາງ'].includes(u.unitName)) &&
        (!cartonU || u.id !== cartonU.id)
    );
    const pieceU = units.find(
      (u) =>
        (u.tier === 1 ||
          u.id?.endsWith('_piece') ||
          ['ອັນ', 'ແກ້ວ', 'ຖົງ', 'ກະປ໋ອງ', 'ຕຸກ', 'ຊອງ', 'ກ່ອງນ້ອຍ'].includes(u.unitName)) &&
        (!cartonU || u.id !== cartonU.id) &&
        (!packU || u.id !== packU.id)
    );

    // 3. Resolve active state of the 3 switches
    // GROUND TRUTH RULE: If p.units is populated, active switch MUST match presence in p.units
    let isCartonActive = false;
    let isPackActive = false;
    let isPieceActive = false;

    if (units.length > 0) {
      isCartonActive = Boolean(cartonU);
      isPackActive = Boolean(packU);
      isPieceActive = Boolean(pieceU);
      // Safety: if none matched preset dictionary, assign first unit
      if (!isCartonActive && !isPackActive && !isPieceActive) {
        isPieceActive = true;
      }
    } else if (p.tierSettings) {
      isCartonActive = Boolean(p.tierSettings.enableCarton);
      isPackActive = Boolean(p.tierSettings.enablePack);
      isPieceActive = Boolean(p.tierSettings.enablePiece);
    } else {
      isPieceActive = true;
    }

    setEnableCarton(isCartonActive);
    setEnablePack(isPackActive);
    setEnablePiece(isPieceActive);

    // 4. Resolve Names & Prices
    const resolvedCartonName = cartonU?.unitName || p.tierSettings?.cartonUnitName || 'ແກັດ';
    let resolvedPackName = packU?.unitName || p.tierSettings?.packUnitName || 'ແພັກ';
    let resolvedPieceName = pieceU?.unitName || p.tierSettings?.pieceUnitName || (p.baseUnit || 'ອັນ');

    if (resolvedPackName === resolvedCartonName) resolvedPackName = 'ແພັກ';
    if (resolvedPieceName === resolvedCartonName || resolvedPieceName === resolvedPackName) resolvedPieceName = 'ອັນ';

    setCartonUnitName(resolvedCartonName);
    setPackUnitName(resolvedPackName);
    setPieceUnitName(resolvedPieceName);

    setCartonPrice(cartonU ? formatDots(cartonU.retailPrice) : (p.tierSettings?.cartonPrice || ''));
    setPackPrice(packU ? formatDots(packU.retailPrice) : (p.tierSettings?.packPrice || ''));
    setPiecePrice(pieceU ? formatDots(pieceU.retailPrice) : (p.tierSettings?.piecePrice || ''));

    // Resolve Tier Barcodes from units or fallback
    setCartonBarcode(cartonU?.barcode || '');
    setPackBarcode(packU?.barcode || '');
    setPieceBarcode(pieceU?.barcode || (!cartonU && !packU ? p.barcode || '' : ''));

    // 5. Multipliers Hydration
    // Carton multiplier (Packs per carton or Pieces per carton)
    if (isCartonActive && isPackActive && cartonU && packU && cartonU.multiplier > packU.multiplier) {
      setCartonMultiplier(formatDots(Math.round(cartonU.multiplier / packU.multiplier)));
    } else if (isCartonActive && cartonU && cartonU.multiplier > 1) {
      setCartonMultiplier(formatDots(cartonU.multiplier));
    } else if (p.tierSettings?.cartonMultiplier) {
      setCartonMultiplier(formatDots(p.tierSettings.cartonMultiplier));
    } else {
      setCartonMultiplier(isCartonActive && !isPackActive && !isPieceActive ? '1' : '8');
    }

    // Pack multiplier (Pieces per pack)
    if (isPackActive && isPieceActive && packU && pieceU && packU.multiplier > pieceU.multiplier) {
      setPackMultiplier(formatDots(Math.round(packU.multiplier / pieceU.multiplier)));
    } else if (isPackActive && packU && packU.multiplier > 1) {
      setPackMultiplier(formatDots(packU.multiplier));
    } else if (p.tierSettings?.packMultiplier) {
      setPackMultiplier(formatDots(p.tierSettings.packMultiplier));
    } else {
      setPackMultiplier('6');
    }

    // 6. Stock Breakdown Reconstruction strictly based on active tiers
    if (p.trackStock === false || p.currentStockBaseUnits === null || p.currentStockBaseUnits === undefined) {
      setStockCartons('0');
      setStockPacks('0');
      setStockPieces('0');
    } else {
      const totalBase = Math.max(0, Number(p.currentStockBaseUnits) || 0);

      if (isCartonActive && isPackActive && isPieceActive) {
        const cM = cartonU?.multiplier || ((packU?.multiplier || 6) * 4);
        const pM = packU?.multiplier || 6;
        setStockCartons(formatDots(Math.floor(totalBase / cM)));
        const rem = totalBase % cM;
        setStockPacks(formatDots(Math.floor(rem / pM)));
        setStockPieces(formatDots(rem % pM));
      } else if (isCartonActive && isPackActive && !isPieceActive) {
        // Pack IS base unit!
        const packsPerCarton = cartonU?.multiplier || (p.tierSettings?.cartonMultiplier || 8);
        setStockCartons(formatDots(Math.floor(totalBase / packsPerCarton)));
        setStockPacks(formatDots(totalBase % packsPerCarton));
        setStockPieces('0');
      } else if (isCartonActive && !isPackActive && isPieceActive) {
        // Piece is base unit!
        const piecesPerCarton = cartonU?.multiplier || (p.tierSettings?.cartonMultiplier || 25);
        setStockCartons(formatDots(Math.floor(totalBase / piecesPerCarton)));
        setStockPacks('0');
        setStockPieces(formatDots(totalBase % piecesPerCarton));
      } else if (!isCartonActive && isPackActive && isPieceActive) {
        // Piece is base unit!
        const piecesPerPack = packU?.multiplier || (p.tierSettings?.packMultiplier || 6);
        setStockCartons('0');
        setStockPacks(formatDots(Math.floor(totalBase / piecesPerPack)));
        setStockPieces(formatDots(totalBase % piecesPerPack));
      } else if (isCartonActive) {
        setStockCartons(formatDots(totalBase));
        setStockPacks('0');
        setStockPieces('0');
      } else if (isPackActive) {
        setStockCartons('0');
        setStockPacks(formatDots(totalBase));
        setStockPieces('0');
      } else {
        setStockCartons('0');
        setStockPacks('0');
        setStockPieces(formatDots(totalBase));
      }
    }

    setProductFormModalOpen(true);
  };

  const handleDeleteProduct = (productId, productName = 'ສິນຄ້ານີ້') => {
    openConfirm({
      title: 'ຢືນຢັນການລຶບສິນຄ້າ',
      message: `ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບສິນຄ້າ "${productName}" ອອກຈາກຖານຂໍ້ມູນ Supabase ແທ້ບໍ?`,
      type: 'danger',
      confirmText: 'ລຶບສິນຄ້າ',
      cancelText: 'ຍົກເລີກ',
      onConfirm: async () => {
        setIsSavingDb(true);
        setDbSavingMessage(`ກຳລັງລຶບສິນຄ້າ "${productName}" ອອກຈາກຖານຂໍ້ມູນ Supabase...`);

        try {
          const res = await deleteProductFromSupabase(productId);
          if (!res.success) {
            openAlert('ເກີດຂໍ້ຜິດພາດໃນການລຶບສິນຄ້າ: ' + (res.error || 'Unknown error'), 'ຂໍ້ຜິດພາດ', 'error');
            return;
          }

          setProducts(products.filter((p) => p.id !== productId));
          openAlert(`ລຶບສິນຄ້າ "${productName}" ອອກຈາກຖານຂໍ້ມູນ Supabase ສຳເລັດແລ້ວ!`, 'ສຳເລັດ', 'success');
        } catch (err) {
          console.error('Delete product error:', err);
          openAlert('ເກີດຂໍ້ຜິດພາດ: ' + err.message, 'ຂໍ້ຜິດພາດ', 'error');
        } finally {
          setIsSavingDb(false);
          setDbSavingMessage('');
        }
      },
    });
  };

  // Save product from modal
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      openAlert('ກະລຸນາປ້ອນຊື່ສິນຄ້າ', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    if (!enablePiece && !enablePack && !enableCarton) {
      openAlert('ກະລຸນາເປີດຢ່າງໜ້ອຍ 1 ລະດັບຫົວໜ່ວຍການຂາຍ (ອັນ, ແພັກ ຫຼື ແກັດ)', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    setIsSavingDb(true);
    setDbSavingMessage(`ກຳລັງບັນທຶກສິນຄ້າ "${newProdName}" ລົງຖານຂໍ້ມູນ Supabase...`);

    try {
      const prodId = productToEdit?.id || 'p_' + Date.now().toString(36);
      const costKip = parseDots(newProdCostKip);
      const costBaht = parseDots(newProdCostBaht);
      const isCartonActive = Boolean(enableCarton);
      const isPackActive = Boolean(enablePack);
      const isPieceActive = Boolean(enablePiece);

      const packsPerCarton = Math.max(1, parseDots(cartonMultiplier) || 1);
      const piecesPerPack = Math.max(1, parseDots(packMultiplier) || 1);

      let actualBaseUnitName = 'ອັນ';
      let tier1Multiplier = 1; // Carton multiplier
      let tier2Multiplier = 1; // Pack multiplier
      let tier3Multiplier = 1; // Piece multiplier
      let calculatedStock = 0;
      const units = [];

      // STRICT BASE UNIT & MULTIPLIERS RESOLUTION ACCORDING TO ACTIVE TIERS
      if (isPieceActive) {
        // CASE 1: Cấp 3 (Piece) BẬT -> Piece BẮT BUỘC là Base Unit (multiplier = 1)
        actualBaseUnitName = pieceUnitName.trim() || 'ອັນ';
        tier3Multiplier = 1;
        tier2Multiplier = isPackActive ? piecesPerPack : 1;
        tier1Multiplier = isCartonActive
          ? (isPackActive ? (packsPerCarton * tier2Multiplier) : packsPerCarton)
          : 1;

        if (isCartonActive) {
          units.push({
            id: `${prodId}_carton`,
            productId: prodId,
            tier: 3,
            unitName: cartonUnitName.trim() || 'ແກັດ',
            multiplier: tier1Multiplier,
            retailPrice: parseDots(cartonPrice),
            wholesalePrice: Math.round(parseDots(cartonPrice) * 0.95),
            barcode: cartonBarcode.trim() || null,
            isBaseUnit: false,
          });
        }

        if (isPackActive) {
          units.push({
            id: `${prodId}_pack`,
            productId: prodId,
            tier: 2,
            unitName: packUnitName.trim() || 'ແພັກ',
            multiplier: tier2Multiplier,
            retailPrice: parseDots(packPrice),
            wholesalePrice: Math.round(parseDots(packPrice) * 0.95),
            barcode: packBarcode.trim() || null,
            isBaseUnit: false,
          });
        }

        units.push({
          id: `${prodId}_piece`,
          productId: prodId,
          tier: 1,
          unitName: actualBaseUnitName,
          multiplier: 1,
          retailPrice: parseDots(piecePrice),
          wholesalePrice: Math.round(parseDots(piecePrice) * 0.95),
          barcode: pieceBarcode.trim() || null,
          isBaseUnit: true,
        });

        if (trackStock) {
          const cStock = isCartonActive ? (parseDots(stockCartons) || 0) : 0;
          const pStock = isPackActive ? (parseDots(stockPacks) || 0) : 0;
          const pcStock = parseDots(stockPieces) || 0;
          calculatedStock = (cStock * tier1Multiplier) + (pStock * tier2Multiplier) + pcStock;
        }

      } else if (isPackActive) {
        // CASE 2: Cấp 3 (Piece) TẮT, Cấp 2 (Pack) BẬT
        // -> Cấp 2 (Pack) BẮT BUỘC là Base Unit (multiplier = 1)!
        // TUYỆT ĐỐI KHÔNG để baseUnit là "ອັນ" và TUYỆT ĐỐI KHÔNG nhân thêm bất kỳ hệ số nào của Cấp 3!
        actualBaseUnitName = packUnitName.trim() || 'ແພັກ';
        tier3Multiplier = 0;
        tier2Multiplier = 1; // Bắt buộc = 1
        tier1Multiplier = isCartonActive ? packsPerCarton : 1; // Bắt buộc chỉ là packsPerCarton (ví dụ: 8)

        if (isCartonActive) {
          units.push({
            id: `${prodId}_carton`,
            productId: prodId,
            tier: 3,
            unitName: cartonUnitName.trim() || 'ແກັດ',
            multiplier: tier1Multiplier, // Chỉ là số pack trong thùng (ví dụ: 8)
            retailPrice: parseDots(cartonPrice),
            wholesalePrice: Math.round(parseDots(cartonPrice) * 0.95),
            barcode: cartonBarcode.trim() || null,
            isBaseUnit: false,
          });
        }

        units.push({
          id: `${prodId}_pack`,
          productId: prodId,
          tier: 2,
          unitName: actualBaseUnitName,
          multiplier: 1, // Bắt buộc = 1
          retailPrice: parseDots(packPrice),
          wholesalePrice: Math.round(parseDots(packPrice) * 0.95),
          barcode: packBarcode.trim() || null,
          isBaseUnit: true,
        });

        if (trackStock) {
          const cStock = isCartonActive ? (parseDots(stockCartons) || 0) : 0;
          const pStock = parseDots(stockPacks) || 0;
          // Ví dụ: 8 thùng * 8 packs/thùng + 0 = 64 packs
          calculatedStock = (cStock * tier1Multiplier) + pStock;
        }

      } else if (isCartonActive) {
        // CASE 3: Cấp 3 TẮT, Cấp 2 TẮT, Chỉ có Cấp 1 (Carton) BẬT -> Carton BẮT BUỘC là Base Unit (multiplier = 1)
        actualBaseUnitName = cartonUnitName.trim() || 'ລັງ';
        tier3Multiplier = 0;
        tier2Multiplier = 0;
        tier1Multiplier = 1; // Bắt buộc = 1

        units.push({
          id: `${prodId}_carton`,
          productId: prodId,
          tier: 3,
          unitName: actualBaseUnitName,
          multiplier: 1,
          retailPrice: parseDots(cartonPrice),
          wholesalePrice: Math.round(parseDots(cartonPrice) * 0.95),
          barcode: cartonBarcode.trim() || null,
          isBaseUnit: true,
        });

        if (trackStock) {
          calculatedStock = parseDots(stockCartons) || 0;
        }
      }

      // Cost per base unit for store accounting & profit
      let costPerBaseUnit = costKip;
      if (tier1Multiplier > 0) {
        costPerBaseUnit = Math.round(costKip / tier1Multiplier);
      }

      const totalStock = trackStock ? calculatedStock : 0;

      let finalImageUrl =
        newProdImageUrl ||
        productToEdit?.imageUrl ||
        'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80';

      // If user selected a new local image, upload the compressed blob to Supabase Storage
      if (imageFileToUpload) {
        setDbSavingMessage('ກຳລັງອັບໂຫຼດຮູບພາບທີ່ຖືກບີບອັດຂຶ້ນ Supabase Storage...');
        const ext = imageCompressionStats?.mimeType === 'image/webp' ? 'webp' : 'jpg';
        const uploadRes = await uploadProductImageToSupabase(imageFileToUpload, prodId, ext);
        if (uploadRes.success && uploadRes.publicUrl) {
          finalImageUrl = uploadRes.publicUrl;
        } else {
          console.warn('Image upload to Supabase storage failed, using fallback:', uploadRes.error);
        }
      }

      // Primary barcode precedence: Piece barcode -> Pack barcode -> Carton barcode -> general barcode -> generated
      const primaryBarcode =
        pieceBarcode.trim() ||
        packBarcode.trim() ||
        cartonBarcode.trim() ||
        newProdBarcode.trim() ||
        productToEdit?.barcode ||
        '885' + Math.floor(100000000 + Math.random() * 900000000);

      // Resolve categoryId from state or rawCategories match
      const resolvedCatId =
        newProdCategoryId ||
        rawCategories.find((c) => c.name === newProdCategory)?.id ||
        null;

      const updatedProduct = {
        id: prodId,
        name: newProdName.trim(),
        category: newProdCategory,
        categoryId: resolvedCatId,
        barcode: primaryBarcode,
        imageUrl: finalImageUrl,
        baseUnit: actualBaseUnitName,
        costPerBaseUnit,
        costBaht: costBaht,
        costKip: costKip,
        tier1_active: isCartonActive,
        tier2_active: isPackActive,
        tier3_active: isPieceActive,
        tierSettings: {
          enablePiece: isPieceActive,
          enablePack: isPackActive,
          enableCarton: isCartonActive,
          pieceUnitName: pieceUnitName.trim() || 'ອັນ',
          packUnitName: packUnitName.trim() || 'ແພັກ',
          cartonUnitName: cartonUnitName.trim() || 'ແກັດ',
          packMultiplier: isPieceActive ? piecesPerPack : 1,
          cartonMultiplier: packsPerCarton,
        },
        currentStockBaseUnits: totalStock,
        trackStock: Boolean(trackStock),
        hasCrateDeposit: Boolean(hasCrateDeposit),
        crateDepositFee: parseDots(crateDepositFee) || 30000,
        units,
      };

      // REAL SUPABASE DATABASE API CALL:
      const res = await saveProductToSupabase(updatedProduct);
      if (!res.success) {
        openAlert('ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກລົງຖານຂໍ້ມູນ Supabase: ' + (res.error || 'Unknown error'), 'ຂໍ້ຜິດພາດ', 'error');
        return;
      }

      if (productToEdit) {
        setProducts(products.map((p) => (p.id === prodId ? updatedProduct : p)));
      } else {
        setProducts([updatedProduct, ...products]);
      }

      setProductFormModalOpen(false);
      setProductToEdit(null);
      setImageFileToUpload(null);
      setImageCompressionStats(null);
      openAlert(`ບັນທຶກສິນຄ້າ "${newProdName}" ລົງຖານຂໍ້ມູນ Supabase ສຳເລັດແລ້ວ!`, 'ສຳເລັດ', 'success');
    } catch (err) {
      console.error('Save product error:', err);
      openAlert('ເກີດຂໍ້ຜິດພາດ: ' + err.message, 'ຂໍ້ຜິດພາດ', 'error');
    } finally {
      setIsSavingDb(false);
      setDbSavingMessage('');
    }
  };

  // Cart operations
  const addToCart = (product, unit, qty = 1) => {
    const existingIndex = cart.findIndex(
      (item) => item.product.id === product.id && item.unit.id === unit.id
    );

    if (existingIndex > -1) {
      const next = [...cart];
      next[existingIndex].quantity += qty;
      setCart(next);
    } else {
      setCart([
        ...cart,
        {
          product,
          unit,
          quantity: qty,
        },
      ]);
    }
  };

  const updateCartQuantity = (productId, unitId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(productId, unitId);
      return;
    }
    setCart(
      cart.map((item) => {
        if (item.product.id === productId && item.unit.id === unitId) {
          const newMissing = item.noEmptyCrates
            ? Math.max(1, Math.min(newQty, item.missingCratesCount || newQty))
            : item.missingCratesCount;
          return {
            ...item,
            quantity: newQty,
            missingCratesCount: newMissing,
          };
        }
        return item;
      })
    );
  };

  const toggleCartItemCrateDeposit = (productId, unitId, checked) => {
    setCart((prev) =>
      prev.map((it) => {
        if (it.product.id === productId && it.unit.id === unitId) {
          return {
            ...it,
            noEmptyCrates: checked,
            missingCratesCount: checked ? (it.missingCratesCount || it.quantity) : 0,
          };
        }
        return it;
      })
    );
  };

  const updateMissingCrates = (productId, unitId, newCount) => {
    setCart((prev) =>
      prev.map((it) => {
        if (it.product.id === productId && it.unit.id === unitId) {
          const clamped = Math.max(1, Math.min(it.quantity, Number(newCount) || 1));
          return {
            ...it,
            noEmptyCrates: true,
            missingCratesCount: clamped,
          };
        }
        return it;
      })
    );
  };

  const removeFromCart = (productId, unitId) => {
    setCart(cart.filter((item) => !(item.product.id === productId && item.unit.id === unitId)));
  };

  const changeCartItemUnit = (productId, oldUnitId, newUnit) => {
    if (!newUnit) return;
    setCart((prevCart) => {
      const oldIndex = prevCart.findIndex(
        (it) => it.product.id === productId && (it.unit.id === oldUnitId || it.unit.unitName === oldUnitId)
      );
      if (oldIndex === -1) return prevCart;

      const oldItem = prevCart[oldIndex];
      // Check if item with newUnit already exists in cart
      const existingIndex = prevCart.findIndex(
        (it, idx) => idx !== oldIndex && it.product.id === productId && (it.unit.id === newUnit.id || it.unit.unitName === newUnit.unitName)
      );

      if (existingIndex !== -1) {
        const merged = [...prevCart];
        merged[existingIndex] = {
          ...merged[existingIndex],
          quantity: merged[existingIndex].quantity + oldItem.quantity,
        };
        return merged.filter((_, idx) => idx !== oldIndex);
      }

      const updated = [...prevCart];
      updated[oldIndex] = {
        ...oldItem,
        unit: newUnit,
        customPrice: null,
        overrideReason: '',
        noEmptyCrates: false,
        missingCratesCount: 0,
      };
      return updated;
    });
  };

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price =
        item.customPrice !== undefined && item.customPrice !== null
          ? item.customPrice
          : item.unit.retailPrice;
      const baseLine = price * item.quantity;
      const feePerCrate = Number(item.product?.crateDepositFee) || 30000;
      const crateFee = item.noEmptyCrates
        ? (Number(item.missingCratesCount ?? item.quantity) || 0) * feePerCrate
        : 0;
      return sum + baseLine + crateFee;
    }, 0);
  }, [cart]);

  // Open Receipt Modal with Guaranteed Line Items
  const handleOpenReceipt = async (tx) => {
    let target = { ...tx };

    // Check local metadata cache for rich items with crate deposit breakdown
    try {
      const cached = localStorage.getItem(`meiishop_tx_meta_${target.id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          target.items = parsed;
        }
      }
    } catch (_) {}

    if (!target.items || target.items.length === 0) {
      if (target.sale_transaction_items && target.sale_transaction_items.length > 0) {
        target.items = target.sale_transaction_items.map((i) => ({
          product: { name: i.product_name, id: i.product_id },
          productName: i.product_name,
          unit: {
            unitName: i.unit_name,
            retailPrice: Number(i.unit_price) || 0,
            wholesalePrice: Number(i.unit_price) || 0,
          },
          unitName: i.unit_name,
          quantity: Number(i.quantity) || 1,
          lineTotal: Number(i.line_total) || ((Number(i.unit_price) || 0) * (Number(i.quantity) || 1)),
        }));
      } else {
        try {
          const { data: dbItems } = await supabase
            .from('sale_transaction_items')
            .select('*')
            .eq('transaction_id', target.id);
          if (dbItems && dbItems.length > 0) {
            target.items = dbItems.map((i) => ({
              product: { name: i.product_name, id: i.product_id },
              productName: i.product_name,
              unit: {
                unitName: i.unit_name,
                retailPrice: Number(i.unit_price) || 0,
                wholesalePrice: Number(i.unit_price) || 0,
              },
              unitName: i.unit_name,
              quantity: Number(i.quantity) || 1,
              lineTotal: Number(i.line_total) || ((Number(i.unit_price) || 0) * (Number(i.quantity) || 1)),
            }));
          }
        } catch (e) {
          console.warn('Could not query items for transaction:', e);
        }
      }
    }
    setSelectedReceiptForView(target);
    setReceiptModalOpen(true);
  };

  // Checkout Payment
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setTenderedKip(cartSubtotal);
    setDebtPaidKip(0);
    setDebtNote('');
    setCheckoutModalOpen(true);
  };

  const handleConfirmPayment = async () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });

    setIsSavingDb(true);
    setDbSavingMessage('ກຳລັງບັນທຶກບິນຂາຍ & ຕັດສະຕັອກໃນຖານຂໍ້ມູນ Supabase...');

    try {
      const txId = 'tx_' + Date.now().toString(36);
      const receiptNo = 'INV-' + Date.now().toString().slice(-6);
      const createdAt = new Date().toISOString();

      let totalCost = 0;
      cart.forEach((it) => {
        totalCost += (it.product.costPerBaseUnit || 0) * (it.unit.multiplier || 1) * it.quantity;
      });
      const grossProfit = cartSubtotal - totalCost;

      const receiptItems = cart.map((it) => {
        const originalPrice = it.unit.retailPrice;
        const effectivePrice =
          it.customPrice !== undefined && it.customPrice !== null
            ? it.customPrice
            : originalPrice;
        const feePerCrate = Number(it.product?.crateDepositFee) || 30000;
        const missingCount = it.noEmptyCrates ? (Number(it.missingCratesCount ?? it.quantity) || 0) : 0;
        const crateDepositTotal = missingCount * feePerCrate;
        const baseLine = effectivePrice * it.quantity;
        const lineTotal = baseLine + crateDepositTotal;

        return {
          ...it,
          customPrice: effectivePrice,
          noEmptyCrates: Boolean(it.noEmptyCrates),
          missingCratesCount: missingCount,
          crateDepositFee: feePerCrate,
          crateDepositTotal,
          lineTotal,
        };
      });

      const isDebt = paymentMethod === 'debt';
      const actualPaid = isDebt
        ? Math.min(cartSubtotal, Math.max(0, Number(debtPaidKip) || 0))
        : (paymentMethod === 'cash' ? tenderedKip : cartSubtotal);
      const remainingDebt = isDebt ? Math.max(0, cartSubtotal - actualPaid) : 0;
      const debtStatus = isDebt
        ? (actualPaid <= 0 ? 'unpaid' : (remainingDebt > 0 ? 'partial' : 'paid'))
        : 'paid';

      const receipt = {
        id: txId,
        receiptNumber: receiptNo,
        createdAt,
        date: new Date().toLocaleString('lo-LA'),
        cashierName: 'ໄມ້ຄຳ (Meii)',
        customerName: customerName.trim() || (isDebt ? 'ລູກຄ້າຄ້າງຊຳລະ' : 'ລູກຄ້າທົ່ວໄປ'),
        items: receiptItems,
        isWholesale: false,
        subtotal: cartSubtotal,
        discountTotal: 0,
        grandTotal: cartSubtotal,
        amountTendered: actualPaid,
        changeAmount: paymentMethod === 'cash' ? Math.max(0, tenderedKip - cartSubtotal) : 0,
        isDebt,
        paidAmount: actualPaid,
        debtAmount: remainingDebt,
        debtStatus,
        debtNote: debtNote.trim(),
        totalCost,
        grossProfit,
        paymentMethod: isDebt ? 'debt' : (paymentMethod === 'transfer' || paymentMethod === 'onepay' ? 'transfer' : 'cash'),
      };

      // Cache local tx metadata for rich offline/receipt re-rendering with crate deposit and debt info
      try {
        localStorage.setItem(`meiishop_tx_meta_${txId}`, JSON.stringify({
          items: receiptItems,
          receipt,
        }));
      } catch (_) {}

      // Prepare stock deductions for tracked products
      const stockDeductions = [];
      const updatedProducts = products.map((prod) => {
        const soldItems = cart.filter((it) => it.product.id === prod.id);
        if (soldItems.length === 0) return prod;

        if (prod.trackStock === false) {
          // Untracked stock: sales proceed smoothly without restricting or erroring
          return prod;
        }

        const totalBaseUnitsSold = soldItems.reduce((sum, it) => {
          return sum + (it.unit.multiplier || 1) * it.quantity;
        }, 0);

        const currentStock = prod.currentStockBaseUnits ?? 0;
        const newStock = currentStock - totalBaseUnitsSold;

        stockDeductions.push({
          productId: prod.id,
          newStock,
        });

        return {
          ...prod,
          currentStockBaseUnits: newStock,
        };
      });

      // REAL SUPABASE DATABASE API CALL:
      const res = await createSaleTransactionInSupabase(receipt, stockDeductions);
      if (!res.success) {
        openAlert('ແຈ້ງເຕືອນ: ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກລົງຖານຂໍ້ມູນ: ' + res.error, 'ຂໍ້ຜິດພາດ', 'error');
      }

      setProducts(updatedProducts);
      setTransactions([receipt, ...transactions]);
      setSelectedReceiptForView(receipt);
      setCheckoutModalOpen(false);
      setReceiptModalOpen(true);
      setCart([]);
    } catch (err) {
      console.error('Checkout payment error:', err);
      openAlert('ເກີດຂໍ້ຜິດພາດໃນການຊຳລະເງິນ: ' + err.message, 'ຂໍ້ຜິດພາດ', 'error');
    } finally {
      setIsSavingDb(false);
      setDbSavingMessage('');
    }
  };

  // Void / Cancel a Sale Transaction from Supabase and restore product stock (Without deleting record)
  const handleCancelTransaction = (tx) => {
    if (!tx) return;
    if (tx.status === 'cancelled' || tx.isCancelled) {
      openAlert(`ບິນ "${tx.receiptNumber}" ໄດ້ຖືກຍົກເລີກໄປກ່ອນໜ້ານີ້ແລ້ວ!`, 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    const confirmMsg =
      `ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການ "ຍົກເລີກບິນ" ເລກທີ: ${tx.receiptNumber}?\n\n` +
      `• ສະຕັອກສິນຄ້າທັງໝົດໃນບິນນີ້ຈະຖືກສົ່ງຄືນເຂົ້າສາງທັນທີ\n` +
      `• ຍອດຂາຍ ແລະ ກຳໄລຈະຖືກຫັກອອກຈາກ Dashboard ທັນທີ\n` +
      `• ໃບບິນຈະບໍ່ຖືກລຶບ ແຕ່ຈະປ່ຽນສະຖານະເປັນ "ຍົກເລີກແລ້ວ (Cancelled)" ເພື່ອກວດສອບຍ້ອນຫຼັງ`;

    openConfirm({
      title: 'ຢືນຢັນການຍົກເລີກບິນ',
      message: confirmMsg,
      type: 'warning',
      confirmText: 'ຍົກເລີກບິນນີ້',
      cancelText: 'ກັບຄືນ',
      onConfirm: async () => {
        setIsSavingDb(true);
        setDbSavingMessage(`ກຳລັງຍົກເລີກບິນ "${tx.receiptNumber}" & ຄືນສະຕັອກສິນຄ້າ...`);

        try {
          const itemsToRestore = (tx.items || tx.sale_transaction_items || []).map((it) => {
            const prodId = it.product?.id || it.productId || it.product_id;
            const mult = Number(it.unit?.multiplier || it.multiplier) || 1;
            const qty = Number(it.quantity) || 1;
            return {
              productId: prodId,
              unitsToRestore: mult * qty,
            };
          });

          // REAL SUPABASE DATABASE API CALL: Mark status as cancelled and restore product stock
          const res = await cancelTransactionInSupabase(
            tx.id,
            itemsToRestore,
            tx.originalPaymentMethod || tx.paymentMethod
          );
          if (!res.success) {
            openAlert('ແຈ້ງເຕືອນ: ເກີດຂໍ້ຜິດພາດໃນການຍົກເລີກບິນ: ' + (res.error || 'Unknown error'), 'ຂໍ້ຜິດພາດ', 'error');
            return;
          }

          const nowIso = new Date().toISOString();

          // 1. Mark transaction as cancelled in local state (DO NOT DELETE RECORD)
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === tx.id
                ? {
                    ...t,
                    status: 'cancelled',
                    isCancelled: true,
                    cancelledAt: nowIso,
                  }
                : t
            )
          );

          // If the receipt modal is currently displaying this receipt, update it to show cancelled watermark
          setSelectedReceiptForView((prev) =>
            prev && prev.id === tx.id
              ? {
                  ...prev,
                  status: 'cancelled',
                  isCancelled: true,
                  cancelledAt: nowIso,
                }
              : prev
          );

          // 2. Automatically restore product stock in local state
          const updatedProducts = products.map((p) => {
            const toRestore = itemsToRestore.filter((x) => x.productId === p.id);
            if (toRestore.length > 0 && p.trackStock !== false) {
              const restoredTotal = toRestore.reduce((sum, x) => sum + x.unitsToRestore, 0);
              return {
                ...p,
                currentStockBaseUnits: (p.currentStockBaseUnits || 0) + restoredTotal,
              };
            }
            return p;
          });
          setProducts(updatedProducts);

          openAlert(`ຍົກເລີກບິນ "${tx.receiptNumber}" ສຳເລັດແລ້ວ!\n\n• ສິນຄ້າທັງໝົດໄດ້ຖືກສົ່ງຄືນສະຕັອກຮຽບຮ້ອຍ\n• ຍອດຂາຍ ແລະ ກຳໄລຖືກຫັກອອກຈາກ Dashboard ແລ້ວ`, 'ສຳເລັດ', 'success');
        } catch (err) {
          console.error('Cancel transaction error:', err);
          openAlert('ເກີດຂໍ້ຜິດພາດໃນການຍົກເລີກບິນ: ' + err.message, 'ຂໍ້ຜິດພາດ', 'error');
        } finally {
          setIsSavingDb(false);
          setDbSavingMessage('');
        }
      },
    });
  };

  // Delete a Sale Transaction from Supabase and restore product stock (Permanently remove)
  const handleDeleteTransaction = (tx) => {
    openConfirm({
      title: 'ຢືນຢັນການລຶບບິນຖາວອນ',
      message: `ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບຖາວອນບິນ "${tx.receiptNumber}" ອອກຈາກຖານຂໍ້ມູນ Supabase ແທ້ບໍ?`,
      type: 'danger',
      confirmText: 'ລຶບຖາວອນ',
      cancelText: 'ຍົກເລີກ',
      onConfirm: async () => {
        setIsSavingDb(true);
        setDbSavingMessage(`ກຳລັງລຶບບິນ "${tx.receiptNumber}" & ຄືນສະຕັອກໃນ Supabase...`);

        try {
          const itemsToRestore = (tx.items || tx.sale_transaction_items || []).map((it) => ({
            productId: it.product?.id || it.product_id,
            unitsToRestore: (Number(it.unit?.multiplier || it.multiplier) || 1) * (Number(it.quantity) || 1),
          }));

          // REAL SUPABASE DATABASE API CALL:
          const res = await deleteTransactionFromSupabase(tx.id, itemsToRestore);
          if (!res.success) {
            openAlert('ເກີດຂໍ້ຜິດພາດໃນການລຶບບິນ: ' + (res.error || 'Unknown error'), 'ຂໍ້ຜິດພາດ', 'error');
            return;
          }

          setTransactions(transactions.filter((t) => t.id !== tx.id));

          if (tx.status !== 'cancelled' && !tx.isCancelled) {
            const updatedProducts = products.map((p) => {
              const toRestore = itemsToRestore.filter((x) => x.productId === p.id);
              if (toRestore.length > 0 && p.trackStock !== false) {
                const restoredTotal = toRestore.reduce((sum, x) => sum + x.unitsToRestore, 0);
                return {
                  ...p,
                  currentStockBaseUnits: (p.currentStockBaseUnits || 0) + restoredTotal,
                };
              }
              return p;
            });
            setProducts(updatedProducts);
          }

          openAlert(`ລຶບບິນ "${tx.receiptNumber}" ສຳເລັດແລ້ວ!`, 'ສຳເລັດ', 'success');
        } catch (err) {
          console.error('Delete transaction error:', err);
          openAlert('ເກີດຂໍ້ຜິດພາດ: ' + err.message, 'ຂໍ້ຜິດພາດ', 'error');
        } finally {
          setIsSavingDb(false);
          setDbSavingMessage('');
        }
      },
    });
  };

  // Edit/Update Transaction in Supabase
  const handleUpdateTransaction = async (txId, updates) => {
    setIsSavingDb(true);
    setDbSavingMessage('ກຳລັງອັບເດດຂໍ້ມູນບິນໃນ Supabase...');

    try {
      const res = await updateTransactionInSupabase(txId, updates);
      if (!res.success) {
        openAlert('ເກີດຂໍ້ຜິດພາດໃນການແກ້ໄຂບິນ: ' + (res.error || 'Unknown error'), 'ຂໍ້ຜິດພາດ', 'error');
        return false;
      }

      setTransactions(
        transactions.map((t) => {
          if (t.id === txId) {
            return {
              ...t,
              customerName: updates.customerName !== undefined ? updates.customerName : t.customerName,
              paymentMethod: updates.paymentMethod !== undefined ? updates.paymentMethod : t.paymentMethod,
            };
          }
          return t;
        })
      );
      openAlert('ແກ້ໄຂຂໍ້ມູນບິນສຳເລັດແລ້ວ!', 'ສຳເລັດ', 'success');
      return true;
    } catch (err) {
      console.error('Update transaction error:', err);
      openAlert('ເກີດຂໍ້ຜິດພາດ: ' + err.message, 'ຂໍ້ຜິດພາດ', 'error');
      return false;
    } finally {
      setIsSavingDb(false);
      setDbSavingMessage('');
    }
  };

  const openUnitSelector = (prod) => {
    setUnitSelectorProduct(prod);
    setSelectedUnitForModal(prod.units[0]);
    setModalQuantity(1);
  };

  const handleCreateCategory = async (name) => {
    if (!name || !name.trim()) return null;
    const clean = name.trim();
    const res = await createCategoryInSupabase(clean, rawCategories.length + 1);
    if (res.success && res.data) {
      const newCatObj = res.data;
      const updatedRaw = [...rawCategories, newCatObj];
      setRawCategories(updatedRaw);
      const updatedNames = updatedRaw.map((c) => c.name).filter(Boolean);
      setCategoriesList(updatedNames);
      localStorage.setItem('meiishop_categories_cache', JSON.stringify(updatedNames));
      return newCatObj;
    } else {
      openAlert('ເກີດຂໍ້ຜິດພາດໃນການເພີ່ມໝວດໝູ່: ' + (res.error || ''), 'ຂໍ້ຜິດພາດ', 'error');
      return null;
    }
  };

  const handleUpdateCategory = async (id, newName, oldName) => {
    const res = await updateCategoryInSupabase(id, newName, oldName);
    if (res.success) {
      // 1. Update rawCategories state
      const updatedRaw = rawCategories.map((c) => (c.id === id ? { ...c, name: newName } : c));
      setRawCategories(updatedRaw);

      // 2. Update categoriesList state
      const updatedNames = updatedRaw.map((c) => c.name).filter(Boolean);
      setCategoriesList(updatedNames);
      localStorage.setItem('meiishop_categories_cache', JSON.stringify(updatedNames));

      // 3. Immediately cascade to local products state so 100% of products refresh instantly
      setProducts((prev) =>
        prev.map((p) => {
          if (p.categoryId === id || p.category === oldName) {
            return {
              ...p,
              category: newName,
              categoryId: id,
              categories: { id, name: newName },
            };
          }
          return p;
        })
      );

      // If form was currently holding this category, update it
      if (newProdCategory === oldName) {
        setNewProdCategory(newName);
      }
      return res;
    } else {
      return res;
    }
  };

  const handleDeleteCategory = async (id, categoryName) => {
    const res = await deleteCategoryInSupabase(id, categoryName);
    if (res.success) {
      const updatedRaw = rawCategories.filter((c) => c.id !== id);
      setRawCategories(updatedRaw);
      const updatedNames = updatedRaw.map((c) => c.name).filter(Boolean);
      setCategoriesList(updatedNames);
      localStorage.setItem('meiishop_categories_cache', JSON.stringify(updatedNames));
      return res;
    } else {
      return res;
    }
  };

  // Strictly list categories from database: 'ທັງໝົດ' + categories loaded from Supabase!
  const categories = useMemo(() => {
    return ['ທັງໝົດ', ...categoriesList];
  }, [categoriesList]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = activeCategory === 'ທັງໝົດ' || p.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q)) ||
        p.units.some((u) => u.unitName.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [products, activeCategory, searchQuery]);

  // Dashboard Aggregations
  const dashboardData = useMemo(() => {
    const now = new Date();
    let cancelledCount = 0;
    let cancelledRevenue = 0;

    const filteredTxs = transactions.filter((tx) => {
      const txDate = new Date(tx.createdAt);
      let inTimeframe = true;
      if (dashboardTimeframe === 'daily') {
        inTimeframe =
          txDate.getDate() === now.getDate() &&
          txDate.getMonth() === now.getMonth() &&
          txDate.getFullYear() === now.getFullYear();
      } else if (dashboardTimeframe === 'weekly') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        inTimeframe = txDate >= sevenDaysAgo;
      } else if (dashboardTimeframe === 'monthly') {
        inTimeframe =
          txDate.getMonth() === now.getMonth() &&
          txDate.getFullYear() === now.getFullYear();
      }

      if (!inTimeframe) return false;

      // When a bill is voided / cancelled, deduct it from valid sales statistics
      if (tx.status === 'cancelled' || tx.isCancelled) {
        cancelledCount += 1;
        cancelledRevenue += Number(tx.grandTotal) || 0;
        return false;
      }

      return true;
    });

    const totalRevenue = filteredTxs.reduce((sum, t) => sum + (Number(t.grandTotal) || 0), 0);
    const totalCost = filteredTxs.reduce((sum, t) => sum + (Number(t.totalCost) || 0), 0);
    const grossProfit = filteredTxs.reduce((sum, t) => sum + (Number(t.grossProfit) || 0), 0);
    const margin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0';
    const txCount = filteredTxs.length;
    const avgTicket = txCount > 0 ? Math.round(totalRevenue / txCount) : 0;

    // 1:1 Payment Breakdown with POS Checkout (Cash, Transfer, Debt)
    // Rule: Total Revenue = Cash + Transfer + Debt (100% reconciled)
    const cashTotal = filteredTxs
      .filter((t) => t.paymentMethod === 'cash')
      .reduce((sum, t) => sum + (Number(t.grandTotal) || 0), 0);

    const transferTotal = filteredTxs
      .filter((t) => t.paymentMethod === 'transfer' || t.paymentMethod === 'onepay' || t.paymentMethod === 'qrTransfer')
      .reduce((sum, t) => sum + (Number(t.grandTotal) || 0), 0);

    const debtTxs = filteredTxs.filter((t) => t.paymentMethod === 'debt' || t.isDebt);
    const debtTotal = debtTxs.reduce((sum, t) => {
      // If paymentMethod is debt, count remaining debt or grandTotal
      const remaining = t.debtAmount !== undefined ? Number(t.debtAmount) : Number(t.grandTotal);
      return sum + (remaining || 0);
    }, 0);
    const debtCount = debtTxs.length;

    return {
      totalRevenue,
      totalCost,
      grossProfit,
      margin,
      txCount,
      avgTicket,
      cashTotal,
      transferTotal,
      debtTotal,
      debtCount,
      filteredTxs,
      cancelledCount,
      cancelledRevenue,
    };
  }, [transactions, dashboardTimeframe]);

  return (
    <div className="flex flex-col md:flex-row h-full h-dvh min-h-screen w-full min-w-full max-w-full bg-slate-100 text-slate-900 overflow-hidden font-sans">
      {/* 1. LEFT SIDEBAR NAVBAR (Bottom bar on Mobile, Icon sidebar on Tablet/Desktop) */}
      <Navbar
        activeMainTab={activeMainTab}
        setActiveMainTab={setActiveMainTab}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isCloudSynced={isCloudSynced}
        cartCount={cart.length}
        transactionsCount={transactions.length}
        exchangeRate={exchangeRate}
      />

      {/* 2. MAIN VIEW AREA */}
      <div className="flex-1 h-full h-dvh min-h-0 overflow-hidden flex flex-col min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:!pb-0">
        {activeMainTab === 'pos' && (
          <PosScreen
            categories={categories}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filteredProducts={filteredProducts}
            products={products}
            addToCart={addToCart}
            openUnitSelector={openUnitSelector}
            cart={cart}
            customerName={customerName}
            setCustomerName={setCustomerName}
            updateCartQuantity={updateCartQuantity}
            removeFromCart={removeFromCart}
            setCart={setCart}
            cartSubtotal={cartSubtotal}
            handleOpenCheckout={handleOpenCheckout}
            toggleCartItemCrateDeposit={toggleCartItemCrateDeposit}
            updateMissingCrates={updateMissingCrates}
            changeCartItemUnit={changeCartItemUnit}
          />
        )}

        {activeMainTab === 'dashboard' && (
          <DashboardView
            dashboardTimeframe={dashboardTimeframe}
            setDashboardTimeframe={setDashboardTimeframe}
            dashboardData={dashboardData}
            transactions={transactions}
            products={products}
            rawCategories={rawCategories}
          />
        )}

        {activeMainTab === 'products' && (
          <ProductsView
            products={products}
            exchangeRate={exchangeRate}
            onAddNewProduct={handleOpenNewProduct}
            onEditProduct={handleOpenEditProduct}
            onDeleteProduct={handleDeleteProduct}
            onRefreshProducts={handleRefreshAllFromSupabase}
            onOpenCategoryManager={() => setCategoryManagerModalOpen(true)}
            isLoading={isRefreshing}
          />
        )}

        {activeMainTab === 'history' && (
          <HistoryView
            transactions={transactions}
            onOpenReceipt={handleOpenReceipt}
            onCancelTransaction={handleCancelTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onRefreshTransactions={handleRefreshAllFromSupabase}
            isLoading={isRefreshing}
          />
        )}
      </div>

      {/* 3. MODALS */}
      <UnitSelectorModal
        product={unitSelectorProduct}
        onClose={() => setUnitSelectorProduct(null)}
        selectedUnit={selectedUnitForModal}
        setSelectedUnit={setSelectedUnitForModal}
        modalQuantity={modalQuantity}
        setModalQuantity={setModalQuantity}
        onAddToCart={addToCart}
      />

      <ProductFormModal
        isOpen={productFormModalOpen}
        onClose={() => setProductFormModalOpen(false)}
        productToEdit={productToEdit}
        existingProducts={products}
        newProdName={newProdName}
        setNewProdName={setNewProdName}
        newProdCategory={newProdCategory}
        setNewProdCategory={setNewProdCategory}
        categoriesList={categoriesList}
        rawCategories={rawCategories}
        onCreateCategory={handleCreateCategory}
        onOpenCategoryManager={() => setCategoryManagerModalOpen(true)}
        newProdBarcode={newProdBarcode}
        setNewProdBarcode={setNewProdBarcode}
        newProdImageUrl={newProdImageUrl}
        setNewProdImageUrl={setNewProdImageUrl}
        imageFileToUpload={imageFileToUpload}
        setImageFileToUpload={setImageFileToUpload}
        imageCompressionStats={imageCompressionStats}
        setImageCompressionStats={setImageCompressionStats}
        isCompressingImage={isCompressingImage}
        setIsCompressingImage={setIsCompressingImage}
        newProdCostKip={newProdCostKip}
        newProdCostBaht={newProdCostBaht}
        handleBahtCostChange={handleBahtCostChange}
        handleKipCostChange={handleKipCostChange}
        exchangeRate={exchangeRate}
        applyPresetBeer={applyPresetBeer}
        applyPresetDrink3Tiers={applyPresetDrink3Tiers}
        applyPresetSnack3Tiers={applyPresetSnack3Tiers}
        applyPresetSugarSack={applyPresetSugarSack}
        applyPresetPieceOnly={applyPresetPieceOnly}
        enablePiece={enablePiece}
        setEnablePiece={setEnablePiece}
        pieceUnitName={pieceUnitName}
        setPieceUnitName={setPieceUnitName}
        piecePrice={piecePrice}
        setPiecePrice={setPiecePrice}
        pieceBarcode={pieceBarcode}
        setPieceBarcode={setPieceBarcode}
        enablePack={enablePack}
        setEnablePack={setEnablePack}
        packUnitName={packUnitName}
        setPackUnitName={setPackUnitName}
        packMultiplier={packMultiplier}
        setPackMultiplier={setPackMultiplier}
        packPrice={packPrice}
        setPackPrice={setPackPrice}
        packBarcode={packBarcode}
        setPackBarcode={setPackBarcode}
        enableCarton={enableCarton}
        setEnableCarton={setEnableCarton}
        cartonUnitName={cartonUnitName}
        setCartonUnitName={setCartonUnitName}
        cartonMultiplier={cartonMultiplier}
        setCartonMultiplier={setCartonMultiplier}
        cartonPrice={cartonPrice}
        setCartonPrice={setCartonPrice}
        cartonBarcode={cartonBarcode}
        setCartonBarcode={setCartonBarcode}
        hasCrateDeposit={hasCrateDeposit}
        setHasCrateDeposit={setHasCrateDeposit}
        crateDepositFee={crateDepositFee}
        setCrateDepositFee={setCrateDepositFee}
        trackStock={trackStock}
        setTrackStock={setTrackStock}
        stockCartons={stockCartons}
        setStockCartons={setStockCartons}
        stockPacks={stockPacks}
        setStockPacks={setStockPacks}
        stockPieces={stockPieces}
        setStockPieces={setStockPieces}
        onSaveProduct={handleSaveProduct}
      />

      <CategoryManagerModal
        isOpen={categoryManagerModalOpen}
        onClose={() => setCategoryManagerModalOpen(false)}
        categories={rawCategories}
        onCreateCategory={handleCreateCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        products={products}
      />

      <CheckoutModal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        customerName={customerName}
        setCustomerName={setCustomerName}
        cartSubtotal={cartSubtotal}
        cart={cart}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        tenderedKip={tenderedKip}
        setTenderedKip={setTenderedKip}
        debtPaidKip={debtPaidKip}
        setDebtPaidKip={setDebtPaidKip}
        debtNote={debtNote}
        setDebtNote={setDebtNote}
        onConfirmPayment={handleConfirmPayment}
      />

      <ReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receipt={selectedReceiptForView}
        paperWidth={receiptPaperWidth}
        setPaperWidth={setReceiptPaperWidth}
        onCancelReceipt={handleCancelTransaction}
      />

      {/* Global Beautiful Alert & Confirmation Dialog */}
      <ConfirmDialogModal
        isOpen={dialogState.isOpen}
        onClose={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={dialogState.onConfirm}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        isConfirm={dialogState.isConfirm}
      />

      {/* 4. REAL DATABASE LOADING OVERLAY */}
      {isSavingDb && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white p-5 rounded-2xl shadow-2xl flex items-center gap-3.5 border border-slate-200">
            <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-bold text-slate-800 font-sans">
              {dbSavingMessage || 'ກຳລັງບັນທຶກລົງຖານຂໍ້ມູນ Supabase...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
