import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  fetchSuppliersFromSupabase,
  fetchPurchaseOrdersFromSupabase,
  updateExistingSaleTransactionInSupabase,
  fetchExchangeRate,
  updateExchangeRateInSupabase,
  fetchProductBundlesFromSupabase,
  saveProductBundleToSupabase,
  deleteProductBundleInSupabase,
  supabase
} from './services/supabase';
import queryClient from './services/queryClient';
import { Capacitor } from '@capacitor/core';
import { Storefront } from '@phosphor-icons/react';

// Modular Components
import Navbar from './components/Navbar';
import PosScreen from './components/PosScreen';
import DashboardView from './components/DashboardView';
import SalesByUnitReportView from './components/reports/SalesByUnitReportView';
import ProductsView from './components/ProductsView';
import HistoryView from './components/HistoryView';
import PurchasesView from './pages/inventory/purchases';
import SettingsView from './components/SettingsView';
import PurchaseEntryModal from './components/inventory/PurchaseEntryModal';
import SupplierManagementModal from './components/inventory/SupplierManagementModal';
import ReceiptModal from './components/ReceiptModal';
import CheckoutModal from './components/CheckoutModal';
import UnitSelectorModal from './components/UnitSelectorModal';
import ProductFormModal from './components/ProductFormModal';
import CategoryManagerModal from './components/CategoryManagerModal';
import ProductBundleModal from './components/ProductBundleModal';
import ConfirmDialogModal from './components/ConfirmDialogModal';
import StaffManagementView from './components/auth/StaffManagementView';
import CashierLockOverlay from './components/auth/CashierLockOverlay';
import RouteGuard from './components/auth/RouteGuard';
import LoginScreen from './components/auth/LoginScreen';
import AuthLoadingSplash from './components/auth/AuthLoadingSplash';
import { useAuth, useAuthRole } from './contexts/AuthContext';
import { useOrderRealtime } from './hooks/useOrderRealtime';

import { formatDots, parseDots, parseCurrencyInput, formatCompoundStock, getEffectiveUnitPrice, PRICE_TIERS, normalizeLao } from './utils/formatters';
import { useHardwareBarcodeScanner } from './hooks/useHardwareBarcodeScanner';
import {
  playSuccessBeep,
  playErrorBeep,
  playAddToCartBeep,
  playRemoveFromCartBeep,
  playQuantityStepBeep,
  playUnitChangeBeep,
  playPriceTierBeep,
  playActionClickBeep,
} from './utils/audioFeedback';

export default function App() {
  const { activeCashier, user, isLoading } = useAuth();
  const { canAccessRoute } = useAuthRole();

  // Navigation Tabs: 'pos' | 'dashboard' | 'products' | 'history' | 'purchases' | 'sales-by-unit' | 'settings' | 'staff-management'
  const [activeMainTab, setActiveMainTab] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash;
        if (hash.includes('sales-by-unit')) {
          return 'sales-by-unit';
        }
      }
    } catch (_) {}
    return 'pos';
  });

  const handleTabChange = (tabId) => {
    if (!canAccessRoute(tabId)) {
      openAlert('ທ່ານບໍ່ມີສິດເຂົ້າເຖິງໜ້ານີ້ (Admin Only / ສະຫງວນສິດສະເພາະຜູ້ຈັດການ)', 'ຈຳກັດສິດ', 'warning');
      return;
    }
    setActiveMainTab(tabId);
  };

  // Enforce route protection when active cashier role changes
  useEffect(() => {
    if (!canAccessRoute(activeMainTab)) {
      setActiveMainTab('pos');
    }
  }, [activeMainTab, canAccessRoute]);

  // Keep activeMainTabRef in sync
  const activeMainTabRef = useRef(activeMainTab);
  useEffect(() => {
    activeMainTabRef.current = activeMainTab;
  }, [activeMainTab]);

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
  const [exchangeRate, setExchangeRate] = useState(() => {
    try {
      const local = localStorage.getItem('meiishop_setting_thb_lak_exchange_rate');
      if (local) {
        const parsed = JSON.parse(local);
        return Number(parsed.rate) || 690;
      }
    } catch (_) {}
    return 690;
  }); // Default 1 ฿ = 690 ₭ (Dynamic Point-in-Time Snapshot)

  // Listen & synchronize exchange rate from store_settings
  useEffect(() => {
    let mounted = true;
    fetchExchangeRate().then((rate) => {
      if (mounted && rate && rate > 0) {
        setExchangeRate(rate);
      }
    });

    const unsubscribe = queryClient.subscribe(['exchange_rate'], async () => {
      const rate = await fetchExchangeRate();
      if (mounted && rate && rate > 0) {
        setExchangeRate(rate);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Default collapsed: chỉ thấy icon
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ທັງໝົດ');

  // Cart & Multi-Order Management (Space cho chọn Order, đổi khách hàng 1, 2...)
  const [posOrders, setPosOrders] = useState(() => {
    try {
      const saved = localStorage.getItem('meiishop_pos_active_orders_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [
      { id: 'order_1', label: 'Order 1', cart: [], customerName: 'ລູກຄ້າທົ່ວໄປ', priceTier: 1, createdAt: Date.now() },
    ];
  });
  const [activeOrderId, setActiveOrderId] = useState(() => {
    try {
      const savedId = localStorage.getItem('meiishop_pos_active_order_id_v1');
      if (savedId) return savedId;
    } catch (_) {}
    return 'order_1';
  });

  const [cart, setCart] = useState(() => {
    try {
      const savedOrders = localStorage.getItem('meiishop_pos_active_orders_v1');
      const savedId = localStorage.getItem('meiishop_pos_active_order_id_v1') || 'order_1';
      if (savedOrders) {
        const parsed = JSON.parse(savedOrders);
        const active = parsed.find((o) => o.id === savedId) || parsed[0];
        if (active && Array.isArray(active.cart)) return active.cart;
      }
    } catch (_) {}
    return [];
  });

  const [customerName, setCustomerName] = useState(() => {
    try {
      const savedOrders = localStorage.getItem('meiishop_pos_active_orders_v1');
      const savedId = localStorage.getItem('meiishop_pos_active_order_id_v1') || 'order_1';
      if (savedOrders) {
        const parsed = JSON.parse(savedOrders);
        const active = parsed.find((o) => o.id === savedId) || parsed[0];
        if (active?.customerName) return active.customerName;
      }
    } catch (_) {}
    return 'ລູກຄ້າທົ່ວໄປ';
  });

  const [globalPriceTier, setGlobalPriceTier] = useState(() => {
    try {
      const savedOrders = localStorage.getItem('meiishop_pos_active_orders_v1');
      const savedId = localStorage.getItem('meiishop_pos_active_order_id_v1') || 'order_1';
      if (savedOrders) {
        const parsed = JSON.parse(savedOrders);
        const active = parsed.find((o) => o.id === savedId) || parsed[0];
        if (active?.priceTier) return active.priceTier;
      }
    } catch (_) {}
    return 1;
  }); // 1: standard (default), 2: regular customer, 3: wholesale/vip

  // Synchronize current cart/customer/tier changes back to active order in posOrders & localStorage
  useEffect(() => {
    setPosOrders((prevOrders) => {
      const existing = prevOrders.find((o) => o.id === activeOrderId);
      const isDefaultCust = !customerName || customerName.trim() === '' || customerName.trim() === 'ລູກຄ້າທົ່ວໄປ';
      const orderIndex = prevOrders.findIndex((o) => o.id === activeOrderId);
      const defaultLabel = existing?.defaultLabel || (existing?.label?.startsWith('Order ') ? existing.label : `Order ${orderIndex >= 0 ? orderIndex + 1 : 1}`);
      const newLabel = isDefaultCust ? defaultLabel : customerName.trim();

      if (
        existing &&
        existing.cart === cart &&
        existing.customerName === customerName &&
        existing.priceTier === globalPriceTier &&
        existing.label === newLabel
      ) {
        return prevOrders;
      }
      const updated = prevOrders.map((o) => {
        if (o.id === activeOrderId) {
          return {
            ...o,
            label: newLabel,
            defaultLabel: o.defaultLabel || defaultLabel,
            cart,
            customerName,
            priceTier: globalPriceTier,
          };
        }
        return o;
      });
      try {
        localStorage.setItem('meiishop_pos_active_orders_v1', JSON.stringify(updated));
        localStorage.setItem('meiishop_pos_active_order_id_v1', activeOrderId);
      } catch (_) {}
      return updated;
    });
  }, [cart, customerName, globalPriceTier, activeOrderId]);

  // Switch to another order tab
  const handleSelectOrderTab = (targetOrderId) => {
    if (targetOrderId === activeOrderId) return;
    const targetOrder = posOrders.find((o) => o.id === targetOrderId);
    if (!targetOrder) return;

    // First save current active order data
    const updatedOrders = posOrders.map((o) => {
      if (o.id === activeOrderId) {
        return {
          ...o,
          cart,
          customerName,
          priceTier: globalPriceTier,
        };
      }
      return o;
    });

    setPosOrders(updatedOrders);
    setActiveOrderId(targetOrderId);
    setCart(targetOrder.cart || []);
    setCustomerName(targetOrder.customerName || 'ລູກຄ້າທົ່ວໄປ');
    setGlobalPriceTier(targetOrder.priceTier || 1);
    try {
      localStorage.setItem('meiishop_pos_active_orders_v1', JSON.stringify(updatedOrders));
      localStorage.setItem('meiishop_pos_active_order_id_v1', targetOrderId);
    } catch (_) {}
    playActionClickBeep();
  };

  // Add a new order tab
  const handleAddNewOrderTab = () => {
    // Generate next Order label
    const orderNumbers = posOrders
      .map((o) => {
        const text = o.defaultLabel || o.label || '';
        const m = text.match(/\d+/);
        return m ? parseInt(m[0], 10) : 0;
      })
      .filter((n) => n > 0);
    const nextNum = (orderNumbers.length > 0 ? Math.max(...orderNumbers) : posOrders.length) + 1;
    const newId = 'order_' + Date.now();
    const defaultLabel = `Order ${nextNum}`;
    const newOrder = {
      id: newId,
      label: defaultLabel,
      defaultLabel: defaultLabel,
      cart: [],
      customerName: 'ລູກຄ້າທົ່ວໄປ',
      priceTier: 1,
      createdAt: Date.now(),
    };

    // Save current active order before switching
    const updatedOrders = [
      ...posOrders.map((o) => (o.id === activeOrderId ? { ...o, cart, customerName, priceTier: globalPriceTier } : o)),
      newOrder,
    ];

    setPosOrders(updatedOrders);
    setActiveOrderId(newId);
    setCart([]);
    setCustomerName('ລູກຄ້າທົ່ວໄປ');
    setGlobalPriceTier(1);

    try {
      localStorage.setItem('meiishop_pos_active_orders_v1', JSON.stringify(updatedOrders));
      localStorage.setItem('meiishop_pos_active_order_id_v1', newId);
    } catch (_) {}
    playSuccessBeep('pos');
  };

  // Close / Delete an order tab
  const handleCloseOrderTab = (targetOrderId, e) => {
    if (e) e.stopPropagation();
    if (posOrders.length <= 1) {
      // Just clear current order instead of deleting only tab
      setCart([]);
      setCustomerName('ລູກຄ້າທົ່ວໄປ');
      setGlobalPriceTier(1);
      return;
    }

    const remainingOrders = posOrders.filter((o) => o.id !== targetOrderId);
    let nextActive = remainingOrders[0];
    if (targetOrderId === activeOrderId) {
      const closingIdx = posOrders.findIndex((o) => o.id === targetOrderId);
      nextActive = remainingOrders[Math.max(0, closingIdx - 1)] || remainingOrders[0];
    } else {
      nextActive = remainingOrders.find((o) => o.id === activeOrderId) || remainingOrders[0];
    }

    setPosOrders(remainingOrders);
    setActiveOrderId(nextActive.id);
    setCart(nextActive.cart || []);
    setCustomerName(nextActive.customerName || 'ລູກຄ້າທົ່ວໄປ');
    setGlobalPriceTier(nextActive.priceTier || 1);

    try {
      localStorage.setItem('meiishop_pos_active_orders_v1', JSON.stringify(remainingOrders));
      localStorage.setItem('meiishop_pos_active_order_id_v1', nextActive.id);
    } catch (_) {}
    playUnitChangeBeep();
  };

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
  const [editingOldTransaction, setEditingOldTransaction] = useState(null); // Re-checkout old order mode

  // Dashboard Timeframe: 'daily' | 'weekly' | 'monthly' | 'all'
  const [dashboardTimeframe, setDashboardTimeframe] = useState('daily');

  const [rawCategories, setRawCategories] = useState([]);
  const [categoryManagerModalOpen, setCategoryManagerModalOpen] = useState(false);
  const [bundles, setBundles] = useState(() => {
    try {
      const local = localStorage.getItem('meiishop_product_bundles_v1');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });
  const [bundleModalOpen, setBundleModalOpen] = useState(false);
  // Local Echo Suppression & Realtime Synchronization for Orders
  const localEchoIdsRef = useRef(new Set());
  const [unreadOrderIds, setUnreadOrderIds] = useState(() => new Set());
  const [updatedOrderIds, setUpdatedOrderIds] = useState(() => new Set());

  const handleRealtimeNewOrder = useCallback((newTx) => {
    setTransactions((prev) => {
      const exists = prev.some((t) => t.id === newTx.id);
      if (exists) return prev;
      return [newTx, ...prev];
    });

    // Mark as unread so user sees new order badge until printed or marked all read
    setUnreadOrderIds((prev) => new Set([...prev, newTx.id]));
    setUpdatedOrderIds((prev) => {
      if (!prev.has(newTx.id)) return prev;
      const next = new Set(prev);
      next.delete(newTx.id);
      return next;
    });
  }, []);

  const handleRealtimeUpdateOrder = useCallback((updatedTx) => {
    setTransactions((prev) => {
      const exists = prev.some((t) => t.id === updatedTx.id);
      if (!exists) {
        return [updatedTx, ...prev];
      }
      return prev.map((t) => (t.id === updatedTx.id ? updatedTx : t));
    });

    // When an order is edited, keep it in unread (for sidebar badge) and mark as updated (for amber highlight)
    setUnreadOrderIds((prev) => new Set([...prev, updatedTx.id]));
    setUpdatedOrderIds((prev) => new Set([...prev, updatedTx.id]));
  }, []);

  const handleMarkOrderAsRead = useCallback((orderId) => {
    if (!orderId) return;
    setUnreadOrderIds((prev) => {
      if (!prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
    setUpdatedOrderIds((prev) => {
      if (!prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  }, []);

  const handleMarkAllOrdersAsRead = useCallback(() => {
    setUnreadOrderIds(new Set());
    setUpdatedOrderIds(new Set());
  }, []);

  const handleRealtimeDeleteOrder = useCallback((deletedId) => {
    setTransactions((prev) => prev.filter((t) => t.id !== deletedId));
    setUnreadOrderIds((prev) => {
      if (!prev.has(deletedId)) return prev;
      const next = new Set(prev);
      next.delete(deletedId);
      return next;
    });
    setUpdatedOrderIds((prev) => {
      if (!prev.has(deletedId)) return prev;
      const next = new Set(prev);
      next.delete(deletedId);
      return next;
    });
  }, []);

  const { realtimeHighlights, triggerHighlight } = useOrderRealtime({
    enabled: true,
    onNewOrder: handleRealtimeNewOrder,
    onUpdateOrder: handleRealtimeUpdateOrder,
    onDeleteOrder: handleRealtimeDeleteOrder,
    localEchoIdsRef,
  });

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

  // Layer 2 Security: Real-time Two-Way URL Hash Sync & Direct Route Guard
  useEffect(() => {
    const handleHashChange = () => {
      if (typeof window === 'undefined') return;
      const raw = window.location.hash.replace(/^#\/?/, '').trim();
      if (!raw) return;

      if (canAccessRoute(raw)) {
        setActiveMainTab(raw);
      } else {
        // Enforce strict Route Guard: Revert hash to #pos and trigger Security Warning
        window.location.hash = '#pos';
        setActiveMainTab('pos');
        openAlert(
          'ທ່ານບໍ່ມີສິດເຂົ້າເຖິງໜ້ານີ້ (Admin Only / ສະຫງວນສິດສະເພາະຜູ້ຈັດການ)',
          'ຈຳກັດສິດການເຂົ້າເຖິງ (Access Denied)',
          'warning'
        );
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [canAccessRoute]);

  // Keep URL hash updated with activeMainTab state
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash !== `#${activeMainTab}`) {
      window.location.hash = `#${activeMainTab}`;
    }
  }, [activeMainTab]);

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
  const [newProdNameVi, setNewProdNameVi] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdCategoryId, setNewProdCategoryId] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdCostKip, setNewProdCostKip] = useState('');
  const [newProdCostBaht, setNewProdCostBaht] = useState('');
  const [newProdImageUrl, setNewProdImageUrl] = useState('');
  const [imageFileToUpload, setImageFileToUpload] = useState(null);
  const [imageCompressionStats, setImageCompressionStats] = useState(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);

  // 3-Tier Switches & Multi-Price Tiers (Price 1, 2, 3) & Tier-specific Barcodes
  const [enablePiece, setEnablePiece] = useState(true);
  const [pieceUnitName, setPieceUnitName] = useState('ອັນ');
  const [piecePrice, setPiecePrice] = useState('');
  const [piecePrice2, setPiecePrice2] = useState('');
  const [piecePrice3, setPiecePrice3] = useState('');
  const [pieceBarcode, setPieceBarcode] = useState('');

  const [enablePack, setEnablePack] = useState(true);
  const [packUnitName, setPackUnitName] = useState('ແພັກ');
  const [packMultiplier, setPackMultiplier] = useState('6');
  const [packPrice, setPackPrice] = useState('');
  const [packPrice2, setPackPrice2] = useState('');
  const [packPrice3, setPackPrice3] = useState('');
  const [packBarcode, setPackBarcode] = useState('');

  const [enableCarton, setEnableCarton] = useState(true);
  const [cartonUnitName, setCartonUnitName] = useState('ແກັດ');
  const [cartonMultiplier, setCartonMultiplier] = useState('24');
  const [cartonPrice, setCartonPrice] = useState('');
  const [cartonPrice2, setCartonPrice2] = useState('');
  const [cartonPrice3, setCartonPrice3] = useState('');
  const [cartonBarcode, setCartonBarcode] = useState('');

  // Crate Deposit Setting (For Beer crates / glass bottles)
  const [hasCrateDeposit, setHasCrateDeposit] = useState(false);
  const [crateDepositFee, setCrateDepositFee] = useState('30.000');

  // Stock Tracking Toggle & Initial Stock
  const [trackStock, setTrackStock] = useState(true);
  const [stockCartons, setStockCartons] = useState('0');
  const [stockPacks, setStockPacks] = useState('0');
  const [stockPieces, setStockPieces] = useState('0');

  // GRN Suppliers & Purchase Orders
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseEntryModalOpen, setPurchaseEntryModalOpen] = useState(false);
  const [supplierManagerModalOpen, setSupplierManagerModalOpen] = useState(false);

  // Function to refresh all data directly from Supabase
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

      // Fetch suppliers & purchase orders
      try {
        const supRes = await fetchSuppliersFromSupabase();
        if (supRes.success) setSuppliers(supRes.data);

        const poRes = await fetchPurchaseOrdersFromSupabase();
        if (poRes.success) setPurchaseOrders(poRes.data);
      } catch (poErr) {
        console.warn('Suppliers/PO fetch error:', poErr);
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
        console.warn('Categories fetch error:', catErr);
      }

      // Fetch mixed carton bundles
      try {
        const cloudBundles = await fetchProductBundlesFromSupabase();
        if (cloudBundles) {
          const resolved = cloudBundles.map((b) => {
            const bItemIds = b.itemIds || (b.product_bundle_items || []).map((it) => it.product_id) || [];
            const childs = (products || []).filter((p) => bItemIds.includes(p.id));
            if (childs.length > 0) {
              for (const p of childs) {
                const units = Array.isArray(p.units) ? p.units : [];
                const cartonUnit =
                  units.find(
                    (u) =>
                      u.tier === 3 ||
                      u.id?.endsWith('_carton') ||
                      ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງໃຫຍ່', 'ຖັງ'].includes(u.unitName)
                  ) || [...units].sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1))[0];
                const price = Number(cartonUnit?.retailPrice ?? cartonUnit?.price_1 ?? cartonUnit?.price1 ?? p.cartonPrice ?? 0);
                if (price > 0) {
                  return { ...b, price_lak: price };
                }
              }
            }
            return b;
          });
          setBundles(resolved);
        }
      } catch (bErr) {
        console.warn('Bundles fetch error:', bErr);
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

  const handleSaveBundle = async (bundleData, childProductIds) => {
    setIsSavingDb(true);
    setDbSavingMessage('ກຳລັງບັນທຶກກຸ່ມສິນຄ້າລວມ...');
    try {
      const res = await saveProductBundleToSupabase(bundleData, childProductIds);
      if (res.success) {
        const updated = await fetchProductBundlesFromSupabase();
        setBundles(updated || []);
        queryClient.invalidateQueries({ queryKey: ['bundles'] });
      }
      return res;
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setIsSavingDb(false);
      setDbSavingMessage('');
    }
  };

  const handleDeleteBundle = async (bundleId) => {
    setIsSavingDb(true);
    setDbSavingMessage('ກຳລັງລຶບກຸ່ມສິນຄ້າລວມ...');
    try {
      const res = await deleteProductBundleInSupabase(bundleId);
      if (res.success) {
        const updated = await fetchProductBundlesFromSupabase();
        setBundles(updated || []);
        queryClient.invalidateQueries({ queryKey: ['bundles'] });
      }
      return res;
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setIsSavingDb(false);
      setDbSavingMessage('');
    }
  };

  // Initial Data Fetch from Supabase
  useEffect(() => {
    handleRefreshAllFromSupabase();
  }, []);

  // Subscribe to React Query Cache Invalidation
  useEffect(() => {
    const unsubProducts = queryClient.subscribe('products', () => {
      handleRefreshAllFromSupabase();
    });
    const unsubPOs = queryClient.subscribe('purchase_orders', () => {
      handleRefreshAllFromSupabase();
    });
    const unsubTx = queryClient.subscribe('transactions', () => {
      handleRefreshAllFromSupabase();
    });
    const unsubSuppliers = queryClient.subscribe('suppliers', () => {
      handleRefreshAllFromSupabase();
    });
    const unsubDashboard = queryClient.subscribe('dashboard', () => {
      handleRefreshAllFromSupabase();
    });

    return () => {
      unsubProducts();
      unsubPOs();
      unsubTx();
      unsubSuppliers();
      unsubDashboard();
    };
  }, []);

  // Save changes to localStorage as cache
  useEffect(() => {
    localStorage.setItem('meiishop_products_v5', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('meiishop_transactions_v7', JSON.stringify(transactions));
  }, [transactions]);

  // Dual Currency 2-Way Reactive Sync for Product Form (Card 2)
  // State Machine tracking the source of last modification ('THB' | 'LAK' | null) to prevent infinite loops
  const [lastModifiedCostField, setLastModifiedCostField] = useState(null);

  // Direction 1: User types Baht (THB) -> auto-computes Kip (LAK) = Math.round(costThb * rate) (unless mode === 'manual')
  const handleBahtCostChange = (val, mode = 'auto') => {
    setLastModifiedCostField('THB');
    const cleanDigits = String(val ?? '').replace(/\D/g, '');
    if (!cleanDigits) {
      setNewProdCostBaht('');
      if (mode !== 'manual') setNewProdCostKip('');
      return;
    }

    const costThb = parseInt(cleanDigits, 10);
    if (isNaN(costThb) || costThb === 0) {
      setNewProdCostBaht(cleanDigits === '0' ? '0' : '');
      if (mode !== 'manual') setNewProdCostKip(cleanDigits === '0' ? '0' : '');
      return;
    }

    setNewProdCostBaht(formatDots(costThb));

    // In manual independent mode, DO NOT touch Kip!
    if (mode === 'manual') return;

    const activeRate = Number(exchangeRate) || 0;
    if (activeRate > 0) {
      // Lao Kip is atomic integer, zero decimal places
      const costLak = Math.round(costThb * activeRate);
      setNewProdCostKip(formatDots(costLak));
    }
  };

  // Direction 2: User types Kip (LAK) -> auto-computes Baht (THB) = Math.round(costLak / rate) (unless mode === 'manual')
  // Standard Commercial Half-Up Rounding (e.g. 200.000 / 690 = 289.855... -> 290 ฿; 289.4 -> 289 ฿)
  const handleKipCostChange = (val, mode = 'auto') => {
    setLastModifiedCostField('LAK');
    const cleanDigits = String(val ?? '').replace(/\D/g, '');
    if (!cleanDigits) {
      setNewProdCostKip('');
      if (mode !== 'manual') setNewProdCostBaht('');
      return;
    }

    const costLak = parseInt(cleanDigits, 10);
    if (isNaN(costLak) || costLak === 0) {
      setNewProdCostKip(cleanDigits === '0' ? '0' : '');
      if (mode !== 'manual') setNewProdCostBaht(cleanDigits === '0' ? '0' : '');
      return;
    }

    setNewProdCostKip(formatDots(costLak));

    // In manual independent mode, DO NOT touch Baht!
    if (mode === 'manual') return;

    const activeRate = Number(exchangeRate) || 0;
    if (activeRate > 0) {
      // Eliminates all decimals; standard commercial integer rounding
      const costThb = Math.round(costLak / activeRate);
      setNewProdCostBaht(formatDots(costThb));
    }
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
    const rate = Number(exchangeRate) || 0;
    const thb = 250;
    const lak = rate > 0 ? Math.round(thb * rate) : 0;
    setNewProdCostBaht(formatDots(thb));
    setNewProdCostKip(lak > 0 ? formatDots(lak) : '');
    setLastModifiedCostField(null);
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
    const rate = Number(exchangeRate) || 0;
    const thb = 250;
    const lak = rate > 0 ? Math.round(thb * rate) : 0;
    setNewProdCostBaht(formatDots(thb));
    setNewProdCostKip(lak > 0 ? formatDots(lak) : '');
    setLastModifiedCostField(null);
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
    const rate = Number(exchangeRate) || 0;
    const thb = 250;
    const lak = rate > 0 ? Math.round(thb * rate) : 0;
    setNewProdCostBaht(formatDots(thb));
    setNewProdCostKip(lak > 0 ? formatDots(lak) : '');
    setLastModifiedCostField(null);
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
    const rate = Number(exchangeRate) || 0;
    const thb = 87;
    const lak = rate > 0 ? Math.round(thb * rate) : 0;
    setNewProdCostBaht(formatDots(thb));
    setNewProdCostKip(lak > 0 ? formatDots(lak) : '');
    setLastModifiedCostField(null);
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
    const rate = Number(exchangeRate) || 0;
    const thb = 25;
    const lak = rate > 0 ? Math.round(thb * rate) : 0;
    setNewProdCostBaht(formatDots(thb));
    setNewProdCostKip(lak > 0 ? formatDots(lak) : '');
    setLastModifiedCostField(null);
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
    setNewProdNameVi('');
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
    setLastModifiedCostField(null);

    // Default to 3-tier beverage setup with reasonable defaults
    setEnableCarton(true);
    setCartonUnitName('ແກັດ');
    setCartonMultiplier('24');
    setCartonPrice('');
    setCartonPrice2('');
    setCartonPrice3('');

    setEnablePack(true);
    setPackUnitName('ແພັກ');
    setPackMultiplier('6');
    setPackPrice('');
    setPackPrice2('');
    setPackPrice3('');

    setEnablePiece(true);
    setPieceUnitName('ອັນ');
    setPiecePrice('');
    setPiecePrice2('');
    setPiecePrice3('');

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
    setNewProdNameVi(p.name_vi || p.nameVi || '');
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
    const pKip = parseCurrencyInput(p.costKip ?? p.cost_lak ?? '');
    const pBaht = parseCurrencyInput(p.costBaht ?? p.cost_thb ?? '');
    const rate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 690;

    if (pKip > 0 && pBaht === 0) {
      setNewProdCostKip(formatDots(pKip));
      setNewProdCostBaht(formatDots(Math.round(pKip / rate)));
    } else if (pBaht > 0 && pKip === 0) {
      setNewProdCostBaht(formatDots(pBaht));
      setNewProdCostKip(formatDots(Math.round(pBaht * rate)));
    } else {
      setNewProdCostBaht(formatDots(p.costBaht ?? p.cost_thb ?? ''));
      setNewProdCostKip(formatDots(p.costKip ?? p.cost_lak ?? ''));
    }
    setLastModifiedCostField(null);

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
    setCartonPrice2(cartonU && Number(cartonU.price_2 || cartonU.price2) > 0 ? formatDots(cartonU.price_2 || cartonU.price2) : (p.tierSettings?.cartonPrice2 || ''));
    setCartonPrice3(cartonU && Number(cartonU.price_3 || cartonU.price3) > 0 ? formatDots(cartonU.price_3 || cartonU.price3) : (p.tierSettings?.cartonPrice3 || ''));

    setPackPrice(packU ? formatDots(packU.retailPrice) : (p.tierSettings?.packPrice || ''));
    setPackPrice2(packU && Number(packU.price_2 || packU.price2) > 0 ? formatDots(packU.price_2 || packU.price2) : (p.tierSettings?.packPrice2 || ''));
    setPackPrice3(packU && Number(packU.price_3 || packU.price3) > 0 ? formatDots(packU.price_3 || packU.price3) : (p.tierSettings?.packPrice3 || ''));

    setPiecePrice(pieceU ? formatDots(pieceU.retailPrice) : (p.tierSettings?.piecePrice || ''));
    setPiecePrice2(pieceU && Number(pieceU.price_2 || pieceU.price2) > 0 ? formatDots(pieceU.price_2 || pieceU.price2) : (p.tierSettings?.piecePrice2 || ''));
    setPiecePrice3(pieceU && Number(pieceU.price_3 || pieceU.price3) > 0 ? formatDots(pieceU.price_3 || pieceU.price3) : (p.tierSettings?.piecePrice3 || ''));

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
          await queryClient.invalidateQueries({ queryKey: ['products'] });
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

      // Multi-Price Tiers: Price 1 (Mandatory), Price 2 & 3 (Optional: strictly 0 if empty, NEVER auto-copy Price 1)
      const cP1 = parseDots(cartonPrice);
      const cP2 = parseDots(cartonPrice2) > 0 ? parseDots(cartonPrice2) : 0;
      const cP3 = parseDots(cartonPrice3) > 0 ? parseDots(cartonPrice3) : 0;

      const pP1 = parseDots(packPrice);
      const pP2 = parseDots(packPrice2) > 0 ? parseDots(packPrice2) : 0;
      const pP3 = parseDots(packPrice3) > 0 ? parseDots(packPrice3) : 0;

      const pcP1 = parseDots(piecePrice);
      const pcP2 = parseDots(piecePrice2) > 0 ? parseDots(piecePrice2) : 0;
      const pcP3 = parseDots(piecePrice3) > 0 ? parseDots(piecePrice3) : 0;

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
            retailPrice: cP1,
            wholesalePrice: cP3 > 0 ? cP3 : Math.round(cP1 * 0.95),
            price_2: cP2,
            price_3: cP3,
            price2: cP2,
            price3: cP3,
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
            retailPrice: pP1,
            wholesalePrice: pP3 > 0 ? pP3 : Math.round(pP1 * 0.95),
            price_2: pP2,
            price_3: pP3,
            price2: pP2,
            price3: pP3,
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
          retailPrice: pcP1,
          wholesalePrice: pcP3 > 0 ? pcP3 : Math.round(pcP1 * 0.95),
          price_2: pcP2,
          price_3: pcP3,
          price2: pcP2,
          price3: pcP3,
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
            retailPrice: cP1,
            wholesalePrice: cP3 > 0 ? cP3 : Math.round(cP1 * 0.95),
            price_2: cP2,
            price_3: cP3,
            price2: cP2,
            price3: cP3,
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
          retailPrice: pP1,
          wholesalePrice: pP3 > 0 ? pP3 : Math.round(pP1 * 0.95),
          price_2: pP2,
          price_3: pP3,
          price2: pP2,
          price3: pP3,
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
          retailPrice: cP1,
          wholesalePrice: cP3 > 0 ? cP3 : Math.round(cP1 * 0.95),
          price_2: cP2,
          price_3: cP3,
          price2: cP2,
          price3: cP3,
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

      let finalImageUrl = null;
      if (typeof newProdImageUrl === 'string') {
        finalImageUrl = newProdImageUrl.trim() || null;
      } else if (productToEdit) {
        finalImageUrl = productToEdit.imageUrl || productToEdit.image_url || null;
      }

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

      // Resolve categoryId strictly matching current newProdCategory name first
      const matchedCat = rawCategories.find((c) => c.name === newProdCategory);
      const resolvedCatId =
        matchedCat?.id ||
        (newProdCategory === productToEdit?.category ? (newProdCategoryId || productToEdit?.categoryId) : null) ||
        null;

      const updatedProduct = {
        id: prodId,
        name: newProdName.trim(),
        name_vi: newProdNameVi.trim() || null,
        nameVi: newProdNameVi.trim() || null,
        category: newProdCategory,
        categoryId: resolvedCatId,
        categories: resolvedCatId ? { id: resolvedCatId, name: newProdCategory } : null,
        barcode: primaryBarcode,
        imageUrl: finalImageUrl,
        baseUnit: actualBaseUnitName,
        costPerBaseUnit: Math.round(Number(costPerBaseUnit) || 0),
        costBaht: Math.round(Number(costBaht) || 0),
        costKip: Math.round(Number(costKip) || 0),
        cost_thb: Math.round(Number(costBaht) || 0),
        cost_lak: Math.round(Number(costKip) || 0),
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
          cartonPrice,
          cartonPrice2,
          cartonPrice3,
          packPrice,
          packPrice2,
          packPrice3,
          piecePrice,
          piecePrice2,
          piecePrice3,
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
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      playSuccessBeep('products');
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
  const addToCart = (product, unit, qty = 1, options = {}) => {
    // Mixed Carton Bundle support
    if (product?.isBundle) {
      setCart([...cart, product]);
      if (!options?.silent) {
        playAddToCartBeep();
      }
      return;
    }

    const isCrateEligible =
      Boolean(product?.hasCrateDeposit) ||
      Boolean(
        (product?.category?.includes('ເບຍ') || product?.name?.includes('ເບຍ')) &&
          (unit?.unitName === 'ແກັດ' || unit?.unitName === 'ລັງ' || (unit?.multiplier && unit.multiplier >= 12))
      );
    const feePerCrate = Number(product?.crateDepositFee) || 30000;

    const existingIndex = cart.findIndex(
      (item) => !item.isBundle && item.product?.id === product.id && item.unit?.id === unit?.id
    );

    if (existingIndex > -1) {
      const next = [...cart];
      const updatedQty = next[existingIndex].quantity + qty;
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: updatedQty,
        missingCratesCount: next[existingIndex].noEmptyCrates
          ? (Number(next[existingIndex].missingCratesCount) || 0) + qty
          : next[existingIndex].missingCratesCount,
      };
      setCart(next);
    } else {
      setCart([
        ...cart,
        {
          product,
          productId: product.id,
          productName: product.name,
          name_vi: product.name_vi || product.nameVi || '',
          nameVi: product.name_vi || product.nameVi || '',
          unit,
          quantity: qty,
          selectedPriceTier: 1, // Default 100% is always Price 1 (Giá 1 - Chuẩn)
          customPrice: null,
          noEmptyCrates: false, // Do not auto-select crate deposit
          missingCratesCount: 0,
          crateDepositFee: feePerCrate,
        },
      ]);
    }

    // Play rich, satisfying chime when added manually (unless muted by scanner)
    if (!options?.silent) {
      playAddToCartBeep();
    }
  };

  // Global Hardware Barcode Scanner Fallback (Triggered on any screen, e.g. Dashboard or History)
  useHardwareBarcodeScanner({
    onScan: (barcode) => {
      const cleanCode = String(barcode).trim().toLowerCase();
      const matched = products.find(
        (p) =>
          (p.barcode && String(p.barcode).trim().toLowerCase() === cleanCode) ||
          (p.units && p.units.some((u) => u.barcode && String(u.barcode).trim().toLowerCase() === cleanCode))
      );

      if (matched) {
        let targetUnit = matched.units?.[0];
        const matchingUnit = matched.units?.find(
          (u) => u.barcode && String(u.barcode).trim().toLowerCase() === cleanCode
        );
        if (matchingUnit) {
          targetUnit = matchingUnit;
        } else if (matched.units && matched.units.length > 0) {
          targetUnit = matched.units.find((u) => u.tier === 1) || matched.units[0];
        } else {
          targetUnit = {
            id: `${matched.id}_default`,
            unitName: matched.baseUnit || 'ອັນ',
            multiplier: 1,
            retailPrice: matched.price || matched.retailPrice || 0,
          };
        }

        addToCart(matched, targetUnit, 1, { silent: true });
        playSuccessBeep();
        setActiveMainTab('pos');
      } else {
        playErrorBeep();
        openAlert(`ບໍ່ພົບສິນຄ້າທີ່ມີບາໂຄດ: "${barcode}"`, 'ບໍ່ພົບສິນຄ້າ', 'warning');
      }
    },
    enabled:
      activeMainTab !== 'pos' &&
      activeMainTab !== 'products' &&
      activeMainTab !== 'history' &&
      !productFormModalOpen &&
      !checkoutModalOpen &&
      !receiptModalOpen,
    maxInterval: 50,
    minLength: 3,
    preventDefaultOnEnter: true,
    cleanActiveInput: true,
  });

  const changeCartItemPriceTier = (productId, unitId, newTier) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (!item.isBundle && item.product?.id === productId && item.unit?.id === unitId) {
          return {
            ...item,
            selectedPriceTier: newTier,
            customPrice: null, // Clear manual override when cashier selects a standard tier
            overrideReason: '',
          };
        }
        return item;
      })
    );
    playPriceTierBeep();
  };

  const setGlobalCartPriceTier = (newTier) => {
    setGlobalPriceTier(newTier);
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.isBundle) {
          const baseCartonPrice = Number(item.cartonPrice || item.unitPrice || 0);
          const cartonCount = Number(item.cartonQty ?? 0);
          const looseTotal = Number(item.loosePriceTotal || 0);
          const newLineTotal = (baseCartonPrice * cartonCount) + looseTotal;
          return {
            ...item,
            selectedPriceTier: newTier,
            customPrice: null,
            overrideReason: '',
            lineTotal: newLineTotal,
          };
        }
        return {
          ...item,
          selectedPriceTier: newTier,
          customPrice: null,
          overrideReason: '',
        };
      })
    );
  };

  const updateCartQuantity = (productId, unitId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(productId, unitId);
      return;
    }
    const currentItem = cart.find((item) => !item.isBundle && item.product?.id === productId && item.unit?.id === unitId);
    const delta = currentItem ? newQty - currentItem.quantity : 1;

    setCart(
      cart.map((item) => {
        if (!item.isBundle && item.product?.id === productId && item.unit?.id === unitId) {
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
    // Subtle, gentle tick sound for quantity stepping
    playQuantityStepBeep(delta);
  };

  const toggleCartItemCrateDeposit = (productId, unitId, checked) => {
    setCart((prev) =>
      prev.map((it) => {
        if (!it.isBundle && it.product?.id === productId && it.unit?.id === unitId) {
          return {
            ...it,
            noEmptyCrates: checked,
            missingCratesCount: checked ? (it.missingCratesCount || it.quantity) : 0,
          };
        }
        return it;
      })
    );
    playUnitChangeBeep();
  };

  const updateMissingCrates = (productId, unitId, newCount) => {
    setCart((prev) =>
      prev.map((it) => {
        if (!it.isBundle && it.product?.id === productId && it.unit?.id === unitId) {
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
    playQuantityStepBeep(1);
  };

  const removeFromCart = (productId, unitId) => {
    setCart(
      cart.filter((item) => {
        if (item.isBundle && (item.id === productId || item.bundleId === productId)) return false;
        return !(item.product?.id === productId && item.unit?.id === unitId);
      })
    );
    // Bold, distinctive descending tone for item removal
    playRemoveFromCartBeep();
  };

  const changeCartItemUnit = (productId, oldUnitId, newUnit) => {
    if (!newUnit) return;
    setCart((prevCart) => {
      const oldIndex = prevCart.findIndex(
        (it) => it.product?.id === productId && (it.unit?.id === oldUnitId || it.unit?.unitName === oldUnitId)
      );
      if (oldIndex === -1) return prevCart;

      const oldItem = prevCart[oldIndex];
      // Check if item with newUnit already exists in cart
      const existingIndex = prevCart.findIndex(
        (it, idx) => idx !== oldIndex && it.product?.id === productId && (it.unit?.id === newUnit.id || it.unit?.unitName === newUnit.unitName)
      );

      if (existingIndex !== -1) {
        const merged = [...prevCart];
        merged[existingIndex] = {
          ...merged[existingIndex],
          quantity: merged[existingIndex].quantity + oldItem.quantity,
        };
        return merged.filter((_, idx) => idx !== oldIndex);
      }

      const isNewUnitEligible =
        Boolean(oldItem.product?.hasCrateDeposit) ||
        Boolean(
          (oldItem.product?.category?.includes('ເບຍ') || oldItem.product?.name?.includes('ເບຍ')) &&
            (newUnit?.unitName === 'ແກັດ' || newUnit?.unitName === 'ລັງ' || (newUnit?.multiplier && newUnit.multiplier >= 12))
        );
      const fee = Number(oldItem.product?.crateDepositFee) || 30000;

      const updated = [...prevCart];
      updated[oldIndex] = {
        ...oldItem,
        unit: newUnit,
        isHalfCarton: false, // Reset half carton when switching to another unit
        selectedPriceTier: oldItem.selectedPriceTier || 1,
        customPrice: null,
        overrideReason: '',
        noEmptyCrates: isNewUnitEligible ? Boolean(oldItem.noEmptyCrates) : false,
        missingCratesCount: isNewUnitEligible && oldItem.noEmptyCrates ? (oldItem.missingCratesCount || oldItem.quantity) : 0,
        crateDepositFee: fee,
      };
      return updated;
    });

    // Gentle, pleasant bubble tone for switching between carton/pack/piece
    playUnitChangeBeep();
  };

  /**
   * Toggle or set Half-Carton (½ ແກັດ / Nửa thùng) mode for a cart item
   */
  const toggleCartItemHalfCarton = (productId, unitId, isHalf) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product?.id === productId && (item.unit?.id === unitId || item.unit?.unitName === unitId)) {
          return {
            ...item,
            isHalfCarton: isHalf !== undefined ? Boolean(isHalf) : !item.isHalfCarton,
            customPrice: null, // Reset manual price override to let half carton auto calculate
          };
        }
        return item;
      })
    );
    playUnitChangeBeep();
  };

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      // Mixed Carton Bundle uses precalculated lineTotal
      if (item.isBundle) {
        if (item.customPrice !== undefined && item.customPrice !== null) {
          return sum + Number(item.customPrice);
        }
        return sum + (Number(item.lineTotal) || 0);
      }
      const tierPrice = getEffectiveUnitPrice(item.unit, item.selectedPriceTier || 1);
      const standardPrice = item.isHalfCarton ? Math.round(tierPrice / 2) : tierPrice;
      const price =
        item.customPrice !== undefined && item.customPrice !== null
          ? item.customPrice
          : standardPrice;
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

    // Check local metadata cache for rich items with crate deposit breakdown and debt details
    try {
      const cached = localStorage.getItem(`meiishop_tx_meta_${target.id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.receipt) {
          target = {
            ...target,
            ...parsed.receipt,
            items: parsed.items || parsed.receipt.items || target.items,
          };
        } else if (Array.isArray(parsed) && parsed.length > 0) {
          target.items = parsed;
        } else if (parsed?.items && Array.isArray(parsed.items)) {
          target.items = parsed.items;
        }
      }
    } catch (_) {}

    if (!target.items || target.items.length === 0) {
      if (target.sale_transaction_items && target.sale_transaction_items.length > 0) {
        target.items = target.sale_transaction_items.map((i) => {
          const matchedProd = products.find(
            (p) => (i.product_id && p.id === i.product_id) || (p.name && i.product_name && p.name.trim() === i.product_name.trim())
          );
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
          const rawLineTotal = Number(i.line_total) || (uPrice * qty);
          const effectivePrice = uPrice > 0 ? uPrice : (qty > 0 && rawLineTotal > 0 ? Math.round(rawLineTotal / qty) : 0);
          const baseTotal = effectivePrice * qty;

          let bundleQty = qty;
          let bundleUnitName = i.unit_name || 'ແພັກ';
          let bundlePrice = effectivePrice;

          if (isBundle && Array.isArray(bundleComps) && bundleComps.length > 0) {
            const totalPieces = bundleComps.reduce((sum, c) => sum + (Number(c.quantity || c.qty) || 0), 0);
            const foundB = (bundles || []).find((b) => b.id === i.product_id);
            const pkgLimit = Number(foundB?.package_qty) || 12;
            const packUnit = foundB?.base_unit_name || 'ແພັກ';

            if (totalPieces > 0 && totalPieces < pkgLimit) {
              bundleQty = totalPieces;
              bundleUnitName = packUnit;
              bundlePrice = rawLineTotal > 0 && bundleQty > 0 ? Math.round(rawLineTotal / bundleQty) : effectivePrice;
            }
          }

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
          const hasMissingCrates = isCrateEligible && Boolean(i.noEmptyCrates || crateDepositTotal > 0);

          return {
            product: matchedProd || { name: i.product_name, id: i.product_id, name_vi: '' },
            productId: i.product_id,
            productName: i.product_name,
            name_vi: matchedProd?.name_vi || matchedProd?.nameVi || i.name_vi || '',
            nameVi: matchedProd?.name_vi || matchedProd?.nameVi || i.nameVi || '',
            unit: {
              unitName: bundleUnitName,
              retailPrice: bundlePrice,
              wholesalePrice: bundlePrice,
            },
            unitName: bundleUnitName,
            quantity: bundleQty,
            cartonQty: isBundle && bundleQty < 12 ? 0 : null,
            looseQty: isBundle && bundleQty < 12 ? bundleQty : null,
            baseUnitName: bundleUnitName,
            unitPrice: bundlePrice,
            price: bundlePrice,
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
      } else {
        try {
          const { data: dbItems } = await supabase
            .from('sale_transaction_items')
            .select('*')
            .eq('transaction_id', target.id);
          if (dbItems && dbItems.length > 0) {
            target.items = dbItems.map((i) => {
              const matchedProd = products.find(
                (p) => (i.product_id && p.id === i.product_id) || (p.name && i.product_name && p.name.trim() === i.product_name.trim())
              );
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
              const rawLineTotal = Number(i.line_total) || (uPrice * qty);
              const effectivePrice = uPrice > 0 ? uPrice : (qty > 0 && rawLineTotal > 0 ? Math.round(rawLineTotal / qty) : 0);
              const baseTotal = effectivePrice * qty;

              let bundleQty = qty;
              let bundleUnitName = i.unit_name || 'ແພັກ';
              let bundlePrice = effectivePrice;

              if (isBundle && Array.isArray(bundleComps) && bundleComps.length > 0) {
                const totalPieces = bundleComps.reduce((sum, c) => sum + (Number(c.quantity || c.qty) || 0), 0);
                const foundB = (bundles || []).find((b) => b.id === i.product_id);
                const pkgLimit = Number(foundB?.package_qty) || 12;
                const packUnit = foundB?.base_unit_name || 'ແພັກ';

                if (totalPieces > 0 && totalPieces < pkgLimit) {
                  bundleQty = totalPieces;
                  bundleUnitName = packUnit;
                  bundlePrice = rawLineTotal > 0 && bundleQty > 0 ? Math.round(rawLineTotal / bundleQty) : effectivePrice;
                }
              }

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
              const hasMissingCrates = isCrateEligible && Boolean(i.noEmptyCrates || crateDepositTotal > 0);

              return {
                product: matchedProd || { name: i.product_name, id: i.product_id, name_vi: '' },
                productId: i.product_id,
                productName: i.product_name,
                name_vi: matchedProd?.name_vi || matchedProd?.nameVi || i.name_vi || '',
                nameVi: matchedProd?.name_vi || matchedProd?.nameVi || i.nameVi || '',
                unit: {
                  unitName: bundleUnitName,
                  retailPrice: bundlePrice,
                  wholesalePrice: bundlePrice,
                },
                unitName: bundleUnitName,
                quantity: bundleQty,
                cartonQty: isBundle && bundleQty < 12 ? 0 : null,
                looseQty: isBundle && bundleQty < 12 ? bundleQty : null,
                baseUnitName: bundleUnitName,
                unitPrice: bundlePrice,
                price: bundlePrice,
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
          }
        } catch (e) {
          console.warn('Could not query items for transaction:', e);
        }
      }
    }
    if (products && products.length > 0) {
      target.products = products;
    }
    setSelectedReceiptForView(target);
    setReceiptModalOpen(true);
  };

  // Checkout Payment
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    if (editingOldTransaction) {
      const origMethod = (editingOldTransaction.originalPaymentMethod || editingOldTransaction.paymentMethod || '').toUpperCase();
      if (origMethod === 'DEBT' || editingOldTransaction.isDebt) {
        setPaymentMethod('debt');
        const origPaid = Number(editingOldTransaction.originalAmountTendered ?? editingOldTransaction.paidAmount ?? 0);
        setDebtPaidKip(Math.min(cartSubtotal, origPaid));
      } else if (origMethod === 'TRANSFER') {
        setPaymentMethod('transfer');
        setTenderedKip(cartSubtotal);
      } else {
        setPaymentMethod('cash');
        const oldTendered = Number(editingOldTransaction.originalAmountTendered ?? editingOldTransaction.amountTendered ?? 0);
        setTenderedKip(oldTendered >= cartSubtotal ? oldTendered : cartSubtotal);
      }
      setDebtNote(editingOldTransaction.debtNote || editingOldTransaction.debt_note || '');
    } else {
      setPaymentMethod('cash');
      setTenderedKip(cartSubtotal);
      setDebtPaidKip(0);
      setDebtNote('');
    }
    setCheckoutModalOpen(true);
  };

  const handleConfirmPayment = async () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });

    setIsSavingDb(true);
    setDbSavingMessage(
      editingOldTransaction
        ? `ກຳລັງບັນທຶກການແກ້ໄຂບິນ #${editingOldTransaction.receiptNumber}...`
        : 'ກຳລັງບັນທຶກບິນຂາຍ & ຕັດສະຕັອກໃນຖານຂໍ້ມູນ Supabase...'
    );

    try {
      const txId = editingOldTransaction ? editingOldTransaction.id : ('tx_' + Date.now().toString(36));
      const receiptNo = editingOldTransaction ? editingOldTransaction.receiptNumber : ('INV-' + Date.now().toString().slice(-6));
      const createdAt = editingOldTransaction ? editingOldTransaction.createdAt : new Date().toISOString();

      let totalCost = 0;
      cart.forEach((it) => {
        if (it.isBundle) {
          (it.bundleComponents || []).forEach((c) => {
            const compCost = Number(c.product?.costPerBaseUnit ?? c.costPerBaseUnit ?? 0);
            totalCost += compCost * (Number(c.quantity) || 1);
          });
        } else {
          const fullMult = Number(it.unit?.multiplier || 1);
          const effectiveMult = it.isHalfCarton ? fullMult / 2 : fullMult;
          totalCost += (it.product?.costPerBaseUnit || 0) * effectiveMult * it.quantity;
        }
      });
      const grossProfit = cartSubtotal - totalCost;

      const receiptItems = cart.map((it) => {
        if (it.isBundle) {
          const childPieces = (it.bundleComponents || []).reduce((sum, c) => sum + (Number(c.quantity || c.qty) || 0), 0);
          const pkgLimit = Number(it.packageQty) || 12;
          const isOnlyLoose = (Number(it.cartonQty ?? 0) === 0 && Number(it.looseQty ?? 0) > 0) ||
            (childPieces > 0 && childPieces < pkgLimit);
          const isExactCarton = Number(it.cartonQty ?? 0) > 0 && Number(it.looseQty ?? 0) === 0;
          const bundleLineTotal = Number(it.lineTotal ?? it.subtotal ?? (it.cartonTotalLak || 0) + (it.looseTotalLak || 0));
          
          const bundleUnitName = isOnlyLoose
            ? (it.baseUnitName || 'ແພັກ')
            : (it.unitName || 'ແກັດ');
            
          const bundleQty = isOnlyLoose
            ? (Number(it.looseQty) || childPieces || 1)
            : (isExactCarton ? Number(it.cartonQty) : (Number(it.quantity) || 1));
            
          const calculatedUnitPrice = bundleQty > 0 ? Math.round(bundleLineTotal / bundleQty) : bundleLineTotal;
          const effectivePrice =
            it.customPrice !== undefined && it.customPrice !== null
              ? Math.round(Number(it.customPrice) / (bundleQty > 0 ? bundleQty : 1))
              : (Number(it.unitPrice) > 0 && (!isOnlyLoose || Number(it.unitPrice) * bundleQty === bundleLineTotal)
                  ? Number(it.unitPrice)
                  : calculatedUnitPrice);

          return {
            ...it,
            productId: it.bundleId || it.id,
            productName: it.bundleName || 'ນົມກ່ອງ ລວມລົດຊາດ',
            name_vi: it.bundleNameVi || '',
            nameVi: it.bundleNameVi || '',
            unit: {
              unitName: bundleUnitName,
              retailPrice: effectivePrice,
              wholesalePrice: effectivePrice,
            },
            unitName: bundleUnitName,
            unitPrice: effectivePrice,
            price: effectivePrice,
            customPrice: it.customPrice,
            lineTotal: bundleLineTotal,
            quantity: bundleQty,
            isBundle: true,
            bundleComponents: it.bundleComponents || [],
            bundle_components: it.bundleComponents || [],
            noEmptyCrates: false,
            missingCratesCount: 0,
            crateDepositTotal: 0,
          };
        }

        const tierPrice = getEffectiveUnitPrice(it.unit, it.selectedPriceTier || 1);
        const standardPrice = it.isHalfCarton ? Math.round(tierPrice / 2) : tierPrice;
        const effectivePrice =
          it.customPrice !== undefined && it.customPrice !== null
            ? it.customPrice
            : standardPrice;
        const feePerCrate = Number(it.product?.crateDepositFee) || 30000;
        const missingCount = it.noEmptyCrates ? (Number(it.missingCratesCount ?? it.quantity) || 0) : 0;
        const crateDepositTotal = missingCount * feePerCrate;
        const baseLine = effectivePrice * it.quantity;
        const lineTotal = baseLine + crateDepositTotal;

        const fullMult = Number(it.unit.multiplier || 1);
        const effectiveMultiplier = it.isHalfCarton ? fullMult / 2 : fullMult;

        return {
          ...it,
          productId: it.product?.id || it.productId,
          productName: it.product?.name || it.productName,
          name_vi: it.product?.name_vi || it.product?.nameVi || it.name_vi || it.nameVi || '',
          nameVi: it.product?.name_vi || it.product?.nameVi || it.name_vi || it.nameVi || '',
          customPrice: effectivePrice,
          unitPrice: effectivePrice,
          effectiveMultiplier,
          isHalfCarton: Boolean(it.isHalfCarton),
          selectedPriceTier: it.selectedPriceTier || 1,
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

      // Point-in-Time Exchange Rate Snapshot calculations (IAS 21 Presentation Standard)
      const currentRate = Number(exchangeRate) || 0;
      const totalLak = Number(cartSubtotal) || 0;
      const totalCostLak = Number(totalCost) || 0;
      const grossProfitLak = Number(grossProfit) || 0;
      const totalThb = currentRate > 0 ? Number((totalLak / currentRate).toFixed(2)) : 0;
      const totalCostThb = currentRate > 0 ? Number((totalCostLak / currentRate).toFixed(2)) : 0;
      const grossProfitThb = Number((totalThb - totalCostThb).toFixed(2));

      const receipt = {
        id: txId,
        receiptNumber: receiptNo,
        createdAt,
        date: new Date(createdAt).toLocaleString('lo-LA'),
        cashierName: activeCashier?.full_name || 'Meii',
        cashierId: activeCashier?.id || null,
        cashier_name: activeCashier?.full_name || 'Meii',
        cashier_id: activeCashier?.id || null,
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
        totalCost: totalCostLak,
        totalCostLak,
        totalCostThb,
        grossProfit: grossProfitLak,
        paymentMethod: isDebt ? 'debt' : (paymentMethod === 'transfer' || paymentMethod === 'onepay' ? 'transfer' : 'cash'),
        paymentStatus: isDebt ? (remainingDebt > 0 ? (actualPaid > 0 ? 'PARTIAL' : 'DEBT') : 'PAID') : 'PAID',
        remainingDebt,
        // Point-in-time Snapshot properties
        exchange_rate: currentRate,
        exchangeRate: currentRate,
        total_lak: totalLak,
        totalLak,
        total_cost_lak: totalCostLak,
        total_cost_thb: totalCostThb,
        total_thb: totalThb,
        totalThb,
        gross_profit_lak: grossProfitLak,
        grossProfitLak,
        gross_profit_thb: grossProfitThb,
        grossProfitThb,
        products, // Point-in-time reference for bilingual product name lookups
      };

      // Cache local tx metadata for rich offline/receipt re-rendering with crate deposit and debt info
      try {
        localStorage.setItem(`meiishop_tx_meta_${txId}`, JSON.stringify({
          items: receiptItems,
          receipt,
        }));
      } catch (_) {}

      if (editingOldTransaction) {
        // Track local echo to avoid redundant notification
        localEchoIdsRef.current.add(editingOldTransaction.id);

        // Sequential Safe Replacement Pattern:
        // 1. Restore old stock 2. Delete old items 3. Deduct new stock 4. Insert new items 5. Update header
        const res = await updateExistingSaleTransactionInSupabase(
          editingOldTransaction.id,
          editingOldTransaction.items || editingOldTransaction.sale_transaction_items || [],
          receipt,
          cart
        );

        if (!res.success) {
          openAlert('ແຈ້ງເຕືອນ: ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກການແກ້ໄຂ: ' + res.error, 'ຂໍ້ຜິດພາດ', 'error');
        } else {
          openAlert(`ບັນທຶກການແກ້ໄຂບິນ #${receiptNo} ສຳເລັດແລ້ວ!`, 'ສຳເລັດ', 'success');
          // Đánh dấu đơn này là đơn đã chỉnh sửa (vừa hiện badge ở sidebar, vừa giữ nhãn & highlight amber bền vững)
          setUnreadOrderIds((prev) => new Set([...prev, editingOldTransaction.id]));
          setUpdatedOrderIds((prev) => new Set([...prev, editingOldTransaction.id]));
          triggerHighlight?.(editingOldTransaction.id, 'updated');
        }

        setEditingOldTransaction(null);
        await handleRefreshAllFromSupabase();
      } else {
        // Prepare stock deductions for tracked products
        const stockDeductions = [];
        const updatedProducts = products.map((prod) => {
          const soldItems = cart.filter((it) => !it.isBundle && it.product?.id === prod.id);

          // Calculate bundle component deductions
          let bundleSoldQty = 0;
          cart.filter((it) => it.isBundle && it.bundleComponents).forEach((bundle) => {
            (bundle.bundleComponents || []).forEach((comp) => {
              if (comp.productId === prod.id || comp.product?.id === prod.id) {
                bundleSoldQty += Number(comp.quantity) || 0;
              }
            });
          });

          if (soldItems.length === 0 && bundleSoldQty === 0) return prod;

          if (prod.trackStock === false) {
            return prod;
          }

          const regularBaseSold = soldItems.reduce((sum, it) => {
            const mult = Number(it.unit?.multiplier || 1);
            const effMult = it.isHalfCarton ? mult / 2 : mult;
            return sum + effMult * it.quantity;
          }, 0);

          const totalBaseUnitsSold = regularBaseSold + bundleSoldQty;

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
        localEchoIdsRef.current.add(receipt.id);
        const res = await createSaleTransactionInSupabase(receipt, stockDeductions);
        if (!res.success) {
          openAlert('ແຈ້ງເຕືອນ: ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກລົງຖານຂໍ້ມູນ:\n' + res.error, 'ຂໍ້ຜິດພາດ', 'error');
          return;
        }

        setProducts(updatedProducts);
        setTransactions([receipt, ...transactions]);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['products'] }),
          queryClient.invalidateQueries({ queryKey: ['transactions'] }),
          queryClient.invalidateQueries({ queryKey: ['sale_transactions'] }),
          queryClient.invalidateQueries({ queryKey: ['inventory_movements'] }),
          queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        ]);
      }

      setSelectedReceiptForView(receipt);
      setCheckoutModalOpen(false);
      setReceiptModalOpen(true);

      // Auto-cleanup finished order in Multi-Order Tab system
      if (posOrders.length > 1) {
        // If multiple orders open, remove this finished order and switch to the next active one
        const remainingOrders = posOrders.filter((o) => o.id !== activeOrderId);
        const nextOrder = remainingOrders[0];
        setPosOrders(remainingOrders);
        setActiveOrderId(nextOrder.id);
        setCart(nextOrder.cart || []);
        setCustomerName(nextOrder.customerName || 'ລູກຄ້າທົ່ວໄປ');
        setGlobalPriceTier(nextOrder.priceTier || 1);
        try {
          localStorage.setItem('meiishop_pos_active_orders_v1', JSON.stringify(remainingOrders));
          localStorage.setItem('meiishop_pos_active_order_id_v1', nextOrder.id);
        } catch (_) {}
      } else {
        // Only 1 order open, reset it cleanly
        setCart([]);
        setCustomerName('ລູກຄ້າທົ່ວໄປ');
        setGlobalPriceTier(1);
        const resetOrders = [
          { id: activeOrderId, label: posOrders[0]?.label || 'Order 1', cart: [], customerName: 'ລູກຄ້າທົ່ວໄປ', priceTier: 1, createdAt: Date.now() }
        ];
        setPosOrders(resetOrders);
        try {
          localStorage.setItem('meiishop_pos_active_orders_v1', JSON.stringify(resetOrders));
          localStorage.setItem('meiishop_pos_active_order_id_v1', activeOrderId);
        } catch (_) {}
      }
    } catch (err) {
      console.error('Checkout payment error:', err);
      openAlert('ເກີດຂໍ້ຜິດພາດໃນການຊຳລະເງິນ: ' + err.message, 'ຂໍ້ຜິດພາດ', 'error');
    } finally {
      setIsSavingDb(false);
      setDbSavingMessage('');
    }
  };

  // Re-checkout Pattern: Load existing order items into POS Cart
  const handleEditOrderInPos = (tx) => {
    if (!tx) return;
    if (tx.status === 'cancelled' || tx.isCancelled) {
      openAlert('ບໍ່ສາມາດແກ້ໄຂບິນທີ່ຖືກຍົກເລີກແລ້ວ!', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    const rawItems = tx.items || tx.sale_transaction_items || [];
    const loadedCart = rawItems.map((it) => {
      const prodId = it.product?.id || it.productId || it.product_id;
      const foundProd = products.find((p) => p.id === prodId) || {
        id: prodId,
        name: it.productName || it.product_name || 'ສິນຄ້າ',
        costPerBaseUnit: 0,
        currentStockBaseUnits: 0,
        trackStock: false,
        units: [],
      };

      const unitName = it.unit?.unitName || it.unitName || it.unit_name || 'ອັນ';
      const multiplier = Number(it.unit?.multiplier || it.multiplier) || 1;
      const unitPrice = Number(it.unit?.retailPrice || it.unit_price) || 0;

      const matchedUnit = foundProd.units?.find((u) => u.unitName === unitName) || {
        id: `u_${unitName}`,
        unitName,
        multiplier,
        retailPrice: unitPrice,
        wholesalePrice: unitPrice,
      };

      const qty = Number(it.quantity) || 1;
      const rawLineTotal = Number(it.lineTotal || it.line_total) || (unitPrice * qty);
      const baseTotal = unitPrice * qty;
      const diff = rawLineTotal > baseTotal ? (rawLineTotal - baseTotal) : 0;
      const fee = Number(foundProd.crateDepositFee || it.crateDepositFee) || 30000;
      const crateDepositTotal = Number(it.crateDepositTotal) || (diff > 0 ? diff : 0);
      const missingCount = Number(it.missingCratesCount) || (crateDepositTotal > 0 ? Math.round(crateDepositTotal / fee) : 0);
      const hasMissingCrates = Boolean(it.noEmptyCrates || crateDepositTotal > 0 || (foundProd.hasCrateDeposit && diff > 0));

      return {
        product: foundProd,
        unit: matchedUnit,
        quantity: qty,
        customPrice: unitPrice,
        noEmptyCrates: hasMissingCrates,
        missingCratesCount: missingCount,
        crateDepositFee: fee,
        crateDepositTotal,
        lineTotal: rawLineTotal,
      };
    });

    const rawMethod = (tx.paymentMethod || tx.payment_method || '').toUpperCase();
    const isDebt = Boolean(tx.isDebt || tx.is_debt || rawMethod === 'DEBT');
    const pMethod = isDebt
      ? 'DEBT'
      : (rawMethod === 'TRANSFER' || rawMethod === 'ONEPAY' || rawMethod === 'QR' ? 'TRANSFER' : 'CASH');

    const debtAmt = Number(tx.debtAmount ?? tx.debt_amount ?? tx.remainingDebt ?? tx.remaining_debt ?? 0);
    const paidAmt = Number(tx.paidAmount ?? tx.paid_amount ?? tx.amountTendered ?? tx.amount_tendered ?? 0);
    const pStatus = isDebt
      ? (debtAmt > 0 ? (paidAmt > 0 ? 'PARTIAL' : 'DEBT') : 'PAID')
      : 'PAID';
    const custName = tx.customerName || tx.customer_name || 'ລູກຄ້າທົ່ວໄປ';
    const receiptNum = tx.receiptNumber || tx.receipt_number || 'INV';
    const note = tx.debtNote || tx.debt_note || '';

    const enrichedTx = {
      ...tx,
      id: tx.id,
      receiptNumber: receiptNum,
      originalTransactionId: tx.id,
      originalReceiptNumber: receiptNum,
      originalPaymentMethod: pMethod,
      originalPaymentStatus: pStatus,
      originalCustomerName: custName,
      originalAmountTendered: paidAmt,
      originalRemainingDebt: debtAmt,
      debtNote: note,
    };

    setCart(loadedCart);
    setCustomerName(custName);
    setEditingOldTransaction(enrichedTx);

    if (pMethod === 'DEBT') {
      setPaymentMethod('debt');
      setDebtPaidKip(paidAmt);
    } else if (pMethod === 'TRANSFER') {
      setPaymentMethod('transfer');
      setTenderedKip(tx.grandTotal || tx.subtotal || 0);
    } else {
      setPaymentMethod('cash');
      setTenderedKip(paidAmt || tx.grandTotal || 0);
    }
    setDebtNote(note);

    setActiveMainTab('pos');
    openAlert(
      `ໂຫຼດບິນ #${receiptNum} ເຂົ້າສູ່ໜ້າ POS ແລ້ວ. ປັບປຸງລາຍການແລ້ວກົດບັນທຶກ!`,
      'ແກ້ໄຂບິນ',
      'info'
    );
  };

  const handleCancelEditingOrder = () => {
    setEditingOldTransaction(null);
    setCart([]);
    setCustomerName('ລູກຄ້າທົ່ວໄປ');
    openAlert('ຍົກເລີກການແກ້ໄຂບິນເກົ່າແລ້ວ', 'ແຈ້ງເຕືອນ', 'info');
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
            const fullMult = Number(it.effectiveMultiplier || it.unit?.multiplier || it.multiplier) || 1;
            const effMult = it.isHalfCarton ? fullMult / 2 : fullMult;
            const qty = Number(it.quantity) || 1;
            return {
              productId: prodId,
              unitsToRestore: effMult * qty,
            };
          });

          // REAL SUPABASE DATABASE API CALL: Mark status as cancelled and restore product stock
          const res = await cancelTransactionInSupabase(
            tx.id,
            itemsToRestore,
            tx.originalPaymentMethod || tx.paymentMethod,
            { reason: 'ຍົກເລີກບິນຂາຍ (Void Order)', voidedBy: 'Meii' }
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
                    voidedAt: nowIso,
                    voidedBy: 'Meii',
                    voidReason: 'ຍົກເລີກບິນຂາຍ (Void Order)',
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
                  voidedAt: nowIso,
                  voidedBy: 'Meii',
                  voidReason: 'ຍົກເລີກບິນຂາຍ (Void Order)',
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
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['products'] }),
            queryClient.invalidateQueries({ queryKey: ['transactions'] }),
            queryClient.invalidateQueries({ queryKey: ['sale_transactions'] }),
            queryClient.invalidateQueries({ queryKey: ['inventory_movements'] }),
            queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
          ]);

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
          const itemsToRestore = (tx.items || tx.sale_transaction_items || []).map((it) => {
            const fullMult = Number(it.effectiveMultiplier || it.unit?.multiplier || it.multiplier) || 1;
            const effMult = it.isHalfCarton ? fullMult / 2 : fullMult;
            return {
              productId: it.product?.id || it.product_id,
              unitsToRestore: effMult * (Number(it.quantity) || 1),
            };
          });

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

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['products'] }),
            queryClient.invalidateQueries({ queryKey: ['transactions'] }),
            queryClient.invalidateQueries({ queryKey: ['sale_transactions'] }),
            queryClient.invalidateQueries({ queryKey: ['inventory_movements'] }),
            queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
          ]);

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

  // Strictly list categories from database: 'ທັງໝົດ' + optional 'ລວມ' + categories loaded from Supabase!
  const categories = useMemo(() => {
    const list = ['ທັງໝົດ'];
    if (bundles && bundles.length > 0) {
      list.push('ລວມ');
    }
    return [...list, ...categoriesList];
  }, [categoriesList, bundles]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'ລວມ') {
      return []; // Bundles are rendered directly in PosScreen
    }
    const q = normalizeLao(searchQuery);
    return products.filter((p) => {
      const matchesCat = activeCategory === 'ທັງໝົດ' || p.category === activeCategory;
      const matchesSearch =
        !q ||
        normalizeLao(p.name).includes(q) ||
        (p.barcode && normalizeLao(p.barcode).includes(q)) ||
        p.units.some((u) => normalizeLao(u.unitName).includes(q) || (u.barcode && normalizeLao(u.barcode).includes(q)));
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

    // Point-in-time Snapshot Aggregations (IAS 21 Presentation Standard)
    const totalRevenueLak = filteredTxs.reduce((sum, order) => sum + Number(order.total_lak ?? order.grandTotal ?? 0), 0);
    const totalCostLak = filteredTxs.reduce((sum, order) => sum + Number(order.total_cost_lak ?? order.total_cost ?? order.totalCost ?? 0), 0);
    const totalProfitLak = filteredTxs.reduce((sum, order) => sum + Number(order.gross_profit_lak ?? order.grossProfit ?? 0), 0);

    const fallbackRate = (Number(exchangeRate) > 0 ? Number(exchangeRate) : 690);

    const totalRevenueThb = filteredTxs.reduce((sum, order) => {
      const explicitThb = Number(order.total_thb ?? order.totalThb ?? 0);
      if (explicitThb > 0) return sum + explicitThb;
      const rate = Number(order.exchange_rate || order.exchangeRate) || fallbackRate;
      return sum + (rate > 0 ? Number(((order.total_lak ?? order.grandTotal ?? 0) / rate).toFixed(2)) : 0);
    }, 0);

    const totalCostThb = filteredTxs.reduce((sum, order) => {
      const explicitCostThb = Number(order.total_cost_thb ?? order.totalCostThb ?? 0);
      if (explicitCostThb > 0) return sum + explicitCostThb;
      const rate = Number(order.exchange_rate || order.exchangeRate) || fallbackRate;
      const costLak = Number(order.total_cost_lak ?? order.total_cost ?? order.totalCost ?? 0);
      return sum + (rate > 0 ? Number((costLak / rate).toFixed(2)) : 0);
    }, 0);

    const totalProfitThb = Number((totalRevenueThb - totalCostThb).toFixed(2));

    const totalRevenue = totalRevenueLak;
    const totalCost = totalCostLak;
    const grossProfit = totalProfitLak;
    const margin = totalRevenueLak > 0 ? ((totalProfitLak / totalRevenueLak) * 100).toFixed(1) : '0';
    const txCount = filteredTxs.length;
    const avgTicket = txCount > 0 ? Math.round(totalRevenueLak / txCount) : 0;

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
      totalRevenueLak,
      totalRevenueThb,
      totalCost,
      totalCostLak,
      totalCostThb,
      grossProfit,
      totalProfitLak,
      totalProfitThb,
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

  const outOfStockCount = useMemo(() => {
    return products.filter(
      (p) =>
        p.trackStock !== false &&
        (Number(p.stockPieces) || 0) <= 0 &&
        (!p.stockPacks || (Number(p.stockPacks) || 0) <= 0) &&
        (!p.stockCartons || (Number(p.stockCartons) || 0) <= 0)
    ).length;
  }, [products]);

  const totalDebtTransactionsCount = useMemo(() => {
    return transactions.filter(
      (t) => (t.paymentMethod === 'debt' || t.isDebt) && t.status !== 'cancelled' && !t.isCancelled
    ).length;
  }, [transactions]);

  const isNativeApp = Capacitor.isNativePlatform();

  // While validating session on startup, show high-end loading splash screen
  if (isLoading) {
    return <AuthLoadingSplash />;
  }

  // If not logged in / logged out, show LoginScreen (do not stay in POS)
  if (!activeCashier && !user) {
    return <LoginScreen />;
  }

  return (
    <div 
      className={`flex flex-col md:flex-row h-full h-dvh min-h-screen w-full min-w-full max-w-full bg-slate-100 text-slate-900 overflow-hidden font-sans ${
        isNativeApp ? 'native-safe-area-shell' : ''
      }`}
    >
      {/* 1. LEFT SIDEBAR NAVBAR (Bottom bar on Mobile, Icon sidebar on Tablet/Desktop) */}
      <Navbar
        activeMainTab={activeMainTab}
        setActiveMainTab={handleTabChange}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isCloudSynced={isCloudSynced}
        cartCount={cart.length}
        unreadOrdersCount={unreadOrderIds.size}
        exchangeRate={exchangeRate}
      />

      {/* 2. MAIN VIEW AREA */}
      <div className={`flex-1 h-full h-dvh min-h-0 overflow-hidden flex flex-col min-w-0 ${
        activeMainTab === 'pos'
          ? 'pb-0 md:!pb-0'
          : 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:!pb-0'
      } touch-scroll-container`}>
        {activeMainTab === 'pos' && (
          <PosScreen
            categories={categories}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filteredProducts={filteredProducts}
            products={products}
            bundles={bundles}
            isLoading={isLoadingProducts || isRefreshing}
            onRefreshProducts={handleRefreshAllFromSupabase}
            addToCart={addToCart}
            openUnitSelector={openUnitSelector}
            cart={cart}
            exchangeRate={exchangeRate}
            setExchangeRate={setExchangeRate}
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
            toggleCartItemHalfCarton={toggleCartItemHalfCarton}
            globalPriceTier={globalPriceTier}
            setGlobalPriceTier={setGlobalCartPriceTier}
            changeCartItemPriceTier={changeCartItemPriceTier}
            editingOldTransaction={editingOldTransaction}
            onCancelEditOrder={handleCancelEditingOrder}
            posOrders={posOrders}
            activeOrderId={activeOrderId}
            onSelectOrderTab={handleSelectOrderTab}
            onAddNewOrderTab={handleAddNewOrderTab}
            onCloseOrderTab={handleCloseOrderTab}
          />
        )}

        {activeMainTab === 'dashboard' && (
          <RouteGuard routeId="dashboard" onRedirect={handleTabChange}>
            <DashboardView
              dashboardTimeframe={dashboardTimeframe}
              setDashboardTimeframe={setDashboardTimeframe}
              dashboardData={dashboardData}
              transactions={transactions}
              products={products}
              rawCategories={rawCategories}
              exchangeRate={exchangeRate}
              isLoading={isLoadingProducts || isRefreshing}
            />
          </RouteGuard>
        )}

        {activeMainTab === 'products' && (
          <RouteGuard routeId="products" onRedirect={handleTabChange}>
            <ProductsView
              products={products}
              exchangeRate={exchangeRate}
              onAddNewProduct={handleOpenNewProduct}
              onEditProduct={handleOpenEditProduct}
              onDeleteProduct={handleDeleteProduct}
              onRefreshProducts={handleRefreshAllFromSupabase}
              onOpenCategoryManager={() => setCategoryManagerModalOpen(true)}
              onOpenBundleManager={() => setBundleModalOpen(true)}
              isLoading={isLoadingProducts || isRefreshing}
            />
          </RouteGuard>
        )}

        {activeMainTab === 'history' && (
          <RouteGuard routeId="history" onRedirect={handleTabChange}>
            <HistoryView
              transactions={transactions}
              realtimeHighlights={realtimeHighlights}
              unreadOrderIds={unreadOrderIds}
              updatedOrderIds={updatedOrderIds}
              onMarkOrderAsRead={handleMarkOrderAsRead}
              onMarkAllOrdersAsRead={handleMarkAllOrdersAsRead}
              onOpenReceipt={handleOpenReceipt}
              onCancelTransaction={handleCancelTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onRefreshTransactions={handleRefreshAllFromSupabase}
              onEditOrderInPos={handleEditOrderInPos}
              isLoading={isLoadingProducts || isRefreshing}
              onAlert={openAlert}
            />
          </RouteGuard>
        )}

        {activeMainTab === 'purchases' && (
          <RouteGuard routeId="purchases" onRedirect={handleTabChange}>
            <PurchasesView
              purchaseOrders={purchaseOrders}
              suppliers={suppliers}
              products={products}
              exchangeRate={exchangeRate}
              onOpenNewGRN={() => {
                handleRefreshAllFromSupabase();
                setPurchaseEntryModalOpen(true);
              }}
              onOpenSupplierManager={() => setSupplierManagerModalOpen(true)}
              onRefresh={handleRefreshAllFromSupabase}
              isLoading={isLoadingProducts || isRefreshing}
              onAlert={openAlert}
            />
          </RouteGuard>
        )}

        {activeMainTab === 'sales-by-unit' && (
          <RouteGuard routeId="sales-by-unit" onRedirect={handleTabChange}>
            <SalesByUnitReportView
              transactions={transactions}
              products={products}
              exchangeRate={exchangeRate}
              onRefresh={handleRefreshAllFromSupabase}
              isLoading={isLoadingProducts || isRefreshing}
            />
          </RouteGuard>
        )}

        {activeMainTab === 'settings' && (
          <RouteGuard routeId="settings" onRedirect={handleTabChange}>
            <SettingsView
              exchangeRate={exchangeRate}
              setExchangeRate={setExchangeRate}
              isCloudSynced={isCloudSynced}
              onAlert={openAlert}
              productsCount={products.length}
              transactionsCount={transactions.length}
              outOfStockCount={outOfStockCount}
              debtCount={totalDebtTransactionsCount}
              receiptPaperWidth={receiptPaperWidth}
              setReceiptPaperWidth={setReceiptPaperWidth}
              onOpenCategoryManager={() => setCategoryManagerModalOpen(true)}
              onOpenSupplierManager={() => setSupplierManagerModalOpen(true)}
              onAddNewProduct={handleOpenNewProduct}
              onRefreshAll={handleRefreshAllFromSupabase}
              isLoading={isRefreshing}
            />
          </RouteGuard>
        )}

        {activeMainTab === 'staff-management' && (
          <RouteGuard routeId="staff-management" onRedirect={handleTabChange}>
            <StaffManagementView onAlert={openAlert} />
          </RouteGuard>
        )}
      </div>

      {/* 3. MODALS */}
      <PurchaseEntryModal
        isOpen={purchaseEntryModalOpen}
        onClose={() => setPurchaseEntryModalOpen(false)}
        products={products}
        suppliers={suppliers}
        exchangeRate={exchangeRate}
        onOpenSupplierManager={() => setSupplierManagerModalOpen(true)}
        onSuccess={handleRefreshAllFromSupabase}
        onAlert={openAlert}
      />

      <SupplierManagementModal
        isOpen={supplierManagerModalOpen}
        onClose={() => setSupplierManagerModalOpen(false)}
        suppliers={suppliers}
        onRefreshSuppliers={handleRefreshAllFromSupabase}
        onAlert={openAlert}
      />
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
        newProdNameVi={newProdNameVi}
        setNewProdNameVi={setNewProdNameVi}
        newProdCategory={newProdCategory}
        setNewProdCategory={setNewProdCategory}
        newProdCategoryId={newProdCategoryId}
        setNewProdCategoryId={setNewProdCategoryId}
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
        setNewProdCostKip={setNewProdCostKip}
        setNewProdCostBaht={setNewProdCostBaht}
        handleBahtCostChange={handleBahtCostChange}
        handleKipCostChange={handleKipCostChange}
        lastModifiedCostField={lastModifiedCostField}
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
        piecePrice2={piecePrice2}
        setPiecePrice2={setPiecePrice2}
        piecePrice3={piecePrice3}
        setPiecePrice3={setPiecePrice3}
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
        packPrice2={packPrice2}
        setPackPrice2={setPackPrice2}
        packPrice3={packPrice3}
        setPackPrice3={setPackPrice3}
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
        cartonPrice2={cartonPrice2}
        setCartonPrice2={setCartonPrice2}
        cartonPrice3={cartonPrice3}
        setCartonPrice3={setCartonPrice3}
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

      <ProductBundleModal
        isOpen={bundleModalOpen}
        onClose={() => setBundleModalOpen(false)}
        products={products}
        bundles={bundles}
        exchangeRate={exchangeRate}
        onSaveBundle={handleSaveBundle}
        onDeleteBundle={handleDeleteBundle}
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
        editingOldTransaction={editingOldTransaction}
        onConfirmPayment={handleConfirmPayment}
      />

      <ReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receipt={selectedReceiptForView}
        onCancelReceipt={handleCancelTransaction}
        onAlert={openAlert}
        products={products}
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

      {/* 5. TACTILE NUMPAD CASHIER PIN LOCK OVERLAY */}
      <CashierLockOverlay />
    </div>
  );
}
