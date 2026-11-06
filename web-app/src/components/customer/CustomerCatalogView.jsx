import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  MagnifyingGlass,
  XCircle,
  Phone,
  WhatsappLogo,
  MapPin,
  Clock,
  SquaresFour,
  ListDashes,
  Package,
  ArrowClockwise,
  ShoppingCart,
  Plus,
  ArrowRight,
  CheckCircle,
  Check,
  X,
} from '@phosphor-icons/react';
import { formatKip, normalizeLao, getSortedUnits, getProductTierBreakdown, sanitizeImageUrl } from '../../utils/formatters';
import { supabase, createOnlineOrderInSupabase } from '../../services/supabase';
import { playSuccessBeep } from '../../utils/audioFeedback';
import CustomerProductDetailModal from './CustomerProductDetailModal';
import CustomerUnitSelectorModal from './CustomerUnitSelectorModal';
import CustomerCartCheckoutModal from './CustomerCartCheckoutModal';
import CustomerOrderSuccessModal from './CustomerOrderSuccessModal';
import CustomerOrderTrackingModal from './CustomerOrderTrackingModal';

export default function CustomerCatalogView({
  products = [],
  categories = [],
  bundles = [],
  isLoading = false,
  onRefresh,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ທັງໝົດ');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectorProduct, setSelectorProduct] = useState(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [dismissedOrderIds, setDismissedOrderIds] = useState(() => new Set());

  // Customer recent orders persisted in localStorage for live tracking
  const [recentOrders, setRecentOrders] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('meiishop_customer_recent_orders_v1');
        if (saved) return JSON.parse(saved);
      }
    } catch (_) {}
    return [];
  });

  // Sync order status updates from modal or realtime
  const handleOrderStatusUpdate = useCallback((orderId, newStatus) => {
    setRecentOrders((prev) => {
      const updated = (prev || []).map((o) =>
        o.id === orderId ? { ...o, online_status: newStatus, onlineStatus: newStatus } : o
      );
      try {
        localStorage.setItem('meiishop_customer_recent_orders_v1', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
    setTrackingOrder((prev) =>
      prev && prev.id === orderId ? { ...prev, online_status: newStatus, onlineStatus: newStatus } : prev
    );
  }, []);

  // Find latest active/in-flight order (Pending, Preparing, Ready)
  const activeOrder = useMemo(() => {
    return (recentOrders || []).find((o) => {
      const st = (o.online_status || o.onlineStatus || 'PENDING').toUpperCase();
      return st === 'PENDING' || st === 'PREPARING' || st === 'READY';
    });
  }, [recentOrders]);

  // Order to display on floating tracking bar: Latest active in-flight order, or recently completed (if not dismissed)
  const bannerOrder = useMemo(() => {
    if (!recentOrders || recentOrders.length === 0) return null;
    const latest = recentOrders[0];
    if (dismissedOrderIds.has(latest.id)) return null;
    return latest;
  }, [recentOrders, dismissedOrderIds]);

  // Background Realtime listener for active in-flight order (instant update on /menu without opening modal)
  useEffect(() => {
    if (!activeOrder?.id) return;
    let isMounted = true;
    const channel = supabase
      .channel(`catalog_live_order_${activeOrder.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sale_transactions',
          filter: `id=eq.${activeOrder.id}`,
        },
        (payload) => {
          if (!isMounted) return;
          const newSt = (payload.new?.online_status || 'PENDING').toUpperCase();
          playSuccessBeep();
          handleOrderStatusUpdate(activeOrder.id, newSt);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [activeOrder?.id, handleOrderStatusUpdate]);

  // Cart state persisted in localStorage
  const CART_STORAGE_KEY = 'meiishop_customer_cart_v1';
  const [cart, setCart] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      }
    } catch (_) {}
    return [];
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      }
    } catch (_) {}
  }, [cart]);

  const totalCartQuantity = useMemo(() => {
    return cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  }, [cart]);

  const cartGrandTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (Number(item.price || item.unitPrice) || 0) * (Number(item.quantity) || 1), 0);
  }, [cart]);

  const handleAddToCart = ({ product, unit, quantity }) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.productId === product.id && it.unitName === unit.unitName
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + quantity,
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          productId: product.id,
          productName: product.name,
          name: product.name,
          imageUrl: product.imageUrl || product.image_url,
          unitName: unit.unitName,
          multiplier: unit.multiplier,
          unitPrice: unit.retailPrice,
          price: unit.retailPrice,
          quantity: quantity,
          label: unit.label,
        },
      ];
    });
  };

  const handleUpdateQuantity = (index, newQty) => {
    setCart((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: newQty };
      return updated;
    });
  };

  const handleRemoveItem = (index) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleSubmitOnlineOrder = async (orderData) => {
    setIsSubmittingOrder(true);
    try {
      const res = await createOnlineOrderInSupabase({
        ...orderData,
        items: cart,
        grandTotal: cartGrandTotal,
      });

      if (!res || !res.success || !res.order) {
        throw new Error(res?.error || 'ບໍ່ສາມາດບັນທຶກອໍເດີໄດ້');
      }

      const createdOrder = res.order;

      // Save to recent orders for live status tracking
      try {
        const stored = JSON.parse(localStorage.getItem('meiishop_customer_recent_orders_v1') || '[]');
        const updated = [createdOrder, ...stored.filter((o) => o.id !== createdOrder.id)].slice(0, 8);
        localStorage.setItem('meiishop_customer_recent_orders_v1', JSON.stringify(updated));
        setRecentOrders(updated);
      } catch (_) {}

      setCart([]);
      try {
        localStorage.removeItem(CART_STORAGE_KEY);
      } catch (_) {}
      setIsCheckoutOpen(false);
      setSuccessOrder(createdOrder);
    } catch (err) {
      console.error('Failed to submit online order:', err);
      alert('ຂໍອະໄພ, ລະບົບບໍ່ສາມາດສົ່ງອໍເດີໄດ້ໃນຂະນະນີ້: ' + (err.message || 'ກະລຸນາລອງໃໝ່'));
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const hotlineNumbers = ['020 56468780', '020 52228432'];
  const whatsappNumber = '020 52228432';
  const whatsappInternational = '8562052228432';
  const storeAddress = 'ບ້ານ ໂພນສະຫວັນ, ນະຄອນປາກເຊ, ຈຳປາສັກ';

  const defaultWhatsappUrl = `https://wa.me/${whatsappInternational}?text=${encodeURIComponent(
    'ສະບາຍດີ ຮ້ານ ສົມສັກ! ຂ້ອຍຕ້ອງການສອບຖາມ ຫຼື ສັ່ງເຄື່ອງ...'
  )}`;

  // Resolved Category List for customers (starts with 'ທັງໝົດ')
  const resolvedCategories = useMemo(() => {
    const list = ['ທັງໝົດ'];
    (categories || []).forEach((c) => {
      const name = typeof c === 'string' ? c : c?.name;
      if (name && name !== 'ທັງໝົດ' && !list.includes(name)) {
        list.push(name);
      }
    });
    return list;
  }, [categories]);

  // Filtered products: displays all products (no stock filtering), only category & search query
  const processedProducts = useMemo(() => {
    const raw = searchQuery ? searchQuery.trim().toLowerCase() : '';
    const normQuery = raw ? normalizeLao(raw) : '';

    if (!normQuery && activeCategory === 'ທັງໝົດ') {
      return products || [];
    }

    return (products || []).filter((p) => {
      // 1. Category Filter
      if (activeCategory !== 'ທັງໝົດ') {
        if (p.category !== activeCategory) {
          return false;
        }
      }

      // 2. Search Query Filter (Lao name + barcode + precomputed index)
      if (!normQuery) return true;

      // Ultra-fast path: Pre-computed search index (< 1ms)
      if (p._searchKey) {
        return p._searchKey.includes(normQuery);
      }

      const normName = normalizeLao((p.name || '').toLowerCase());
      const barcode = (p.barcode || '').toLowerCase();
      const cat = normalizeLao((p.category || '').toLowerCase());

      return (
        normName.includes(normQuery) ||
        barcode.includes(normQuery) ||
        cat.includes(normQuery)
      );
    });
  }, [products, searchQuery, activeCategory]);

  // Batch / Lazy Load Infinite Scroll (Identical to POS Screen for 3,000+ items)
  const INITIAL_BATCH_SIZE = 48;
  const LOAD_MORE_STEP = 36;
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_BATCH_SIZE);
  const scrollContainerRef = useRef(null);
  const sentinelRef = useRef(null);

  // Reset pagination limit & scroll to top when search query or category filter changes
  useEffect(() => {
    setVisibleLimit(INITIAL_BATCH_SIZE);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeCategory, searchQuery]);

  const visibleProducts = useMemo(() => {
    if (!processedProducts) return [];
    if (processedProducts.length <= INITIAL_BATCH_SIZE) return processedProducts;
    return processedProducts.slice(0, visibleLimit);
  }, [processedProducts, visibleLimit]);

  const processedProductsRef = useRef(processedProducts);
  processedProductsRef.current = processedProducts;

  // Load more items smoothly when approaching bottom without recreating observer
  const loadMoreProducts = useCallback(() => {
    setVisibleLimit((prev) => {
      const maxLen = processedProductsRef.current?.length || 0;
      if (prev < maxLen) {
        return Math.min(prev + LOAD_MORE_STEP, maxLen);
      }
      return prev;
    });
  }, []);

  // Dual-trigger: IntersectionObserver on sentinel element (400px before bottom) + scroll listener
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreProducts();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '400px 0px',
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreProducts]);

  const handleContainerScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 400) {
      loadMoreProducts();
    }
  };

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleContainerScroll}
      className={`fixed inset-0 w-full h-full h-dvh overflow-y-auto overscroll-contain bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-blue-500/20 selection:text-blue-900 z-10 ${
        cart.length > 0 ? 'pb-24 md:pb-12' : 'pb-12'
      }`}
      style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
    >
      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs shrink-0">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2.5">
          {/* Brand Info with logo.svg */}
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo.svg"
              alt="MeiiShop Logo"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-xs shrink-0 object-contain"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                  ຮ້ານ ສົມສັກ (MeiiShop)
                </h1>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Open Store" />
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                ສິນຄ້າຂາຍຍ່ອຍ ແລະ ຂາຍສົ່ງ
              </p>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Header Cart Pill (When cart has items) */}
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(true)}
                className="bg-primary hover:bg-primary-hover text-white font-bold px-3 sm:px-4 py-2 rounded-xl shadow-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95 shrink-0 text-xs sm:text-sm"
                title="ເບິ່ງກະຕ່າສິນຄ້າ"
              >
                <div className="relative">
                  <ShoppingCart size={17} weight="fill" />
                  <span className="absolute -top-1.5 -right-2 px-1 min-w-[15px] h-3.5 rounded-full bg-rose-500 text-[9px] font-black flex items-center justify-center">
                    {totalCartQuantity}
                  </span>
                </div>
                <span className="hidden sm:inline font-mono font-black ml-1">
                  {formatKip(cartGrandTotal)}
                </span>
              </button>
            )}

            {/* My Orders Button (If customer has placed recent orders) */}
            {recentOrders.length > 0 && (
              <button
                type="button"
                onClick={() => setTrackingOrder(activeOrder || recentOrders[0])}
                className="h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border border-slate-200/80 text-slate-600 hover:text-primary hover:bg-slate-50 text-xs font-medium flex items-center gap-1 transition-all active:scale-95 cursor-pointer relative"
                title="ຕິດຕາມອໍເດີຂອງຂ້ອຍ"
              >
                <Package size={15} weight="bold" className="text-primary" />
                <span className="hidden sm:inline">ອໍເດີຂອງຂ້ອຍ</span>
                {activeOrder && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute -top-0.5 -right-0.5" />
                )}
              </button>
            )}

            {/* WhatsApp Direct Order Button */}
            <a
              href={defaultWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border border-slate-200/80 text-slate-600 hover:text-emerald-600 hover:bg-slate-50 text-xs font-medium flex items-center gap-1 transition-all active:scale-95"
              title="ສັ່ງຜ່ານ WhatsApp"
            >
              <WhatsappLogo size={15} weight="fill" className="text-emerald-500" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>

            {/* Quick Hotline Call Button */}
            <a
              href={`tel:${hotlineNumbers[0].replace(/\s+/g, '')}`}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl border border-slate-200/80 text-slate-600 hover:text-primary hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
              title="ໂທຫາຮ້ານ"
            >
              <Phone size={14} weight="bold" className="text-primary" />
              <span className="hidden md:inline font-mono">{hotlineNumbers[0]}</span>
              <span className="md:hidden">ໂທຮ້ານ</span>
            </a>

            {/* Refresh Button */}
            {onRefresh && (
              <button
                type="button"
                onClick={() => onRefresh(true)}
                disabled={isLoading}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-slate-200/80 text-slate-500 hover:text-primary hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors active:scale-95 shadow-2xs"
                title="ໂຫຼດຂໍ້ມູນໃໝ່"
              >
                <ArrowClockwise
                  size={16}
                  weight="bold"
                  className={isLoading ? 'animate-spin text-primary' : ''}
                />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO / STORE ANNOUNCEMENT BANNER */}
      <section className="max-w-6xl mx-auto w-full px-3 sm:px-6 pt-3 sm:pt-4 shrink-0">
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-[11px] font-bold text-blue-100 mb-2">
                <span>ເມນູສິນຄ້າ & ລາຄາຂາຍລ່າສຸດ</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white">
                ຍິນດີຕ້ອນຮັບສູ່ ຮ້ານ ສົມສັກ
              </h2>
              <div className="text-blue-100 text-sm flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5">
                  <MapPin size={15} weight="bold" className="text-blue-200 shrink-0" />
                  <span>{storeAddress}</span>
                </span>
                <span className="hidden sm:inline text-blue-300">•</span>
                <span className="flex items-center gap-1.5">
                  <Clock size={15} weight="bold" className="text-blue-200 shrink-0" />
                  <span>ເປີດທຸກມື້ 07:00 - 21:00</span>
                </span>
              </div>
            </div>

            {/* Frosted Glass Pill Cluster */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <a
                href={defaultWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/15 backdrop-blur-sm border border-white/20 text-white hover:bg-white hover:text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 shadow-xs"
                title="WhatsApp"
              >
                <WhatsappLogo size={15} weight="fill" />
                <span>WhatsApp</span>
              </a>
              {hotlineNumbers.map((phone) => (
                <a
                  key={phone}
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  className="bg-white/15 backdrop-blur-sm border border-white/20 text-white hover:bg-white hover:text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 shadow-xs font-mono"
                  title={`ໂທ ${phone}`}
                >
                  <Phone size={14} weight="bold" />
                  <span>{phone}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. STICKY SEARCH & CATEGORY FILTER BAR */}
      <section className="sticky top-14 sm:top-16 z-30 bg-slate-50/95 backdrop-blur-md pt-3 pb-2.5 max-w-6xl mx-auto w-full px-3 sm:px-6 space-y-2 border-b border-slate-200/60 shrink-0">
        {/* Search Bar & View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={17}
              weight="bold"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ຄົ້ນຫາສິນຄ້າ ຫຼື ບາໂຄດ..."
              className="w-full h-10 sm:h-11 pl-10 pr-9 bg-white border border-slate-200/90 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 shadow-2xs font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title="ລຶບຄຳຄົ້ນຫາ"
              >
                <XCircle size={17} weight="fill" />
              </button>
            )}
          </div>

          {/* View Mode Toggle (Grid vs List) */}
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-0.5 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="ເບິ່ງແບບຕາໜ່າງ (Grid)"
            >
              <SquaresFour size={18} weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="ເບິ່ງແບບລາຍການ (List)"
            >
              <ListDashes size={18} weight="bold" />
            </button>
          </div>
        </div>

        {/* Horizontal Category Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {resolvedCategories.map((catName) => {
            const isSelected = activeCategory === catName;
            return (
              <button
                key={catName}
                type="button"
                onClick={() => setActiveCategory(catName)}
                className={`h-8 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 shrink-0 ${
                  isSelected
                    ? 'bg-primary text-white shadow-xs font-black'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/90 shadow-2xs'
                }`}
              >
                {catName}
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. MAIN PRODUCT LIST / GRID */}
      <main className="max-w-6xl mx-auto w-full px-3 sm:px-6 py-4 flex-1">
        {/* Results Counter */}
        <div className="flex items-center justify-between mb-3 text-xs text-slate-500 font-bold">
          <span>
            ພົບ <span className="text-primary font-black font-mono">{processedProducts.length}</span> ສິນຄ້າ
            {activeCategory !== 'ທັງໝົດ' && <span> ໃນໝວດ "{activeCategory}"</span>}
          </span>
          {(searchQuery || activeCategory !== 'ທັງໝົດ') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('ທັງໝົດ');
              }}
              className="text-primary hover:underline cursor-pointer"
            >
              ລ້າງຕົວກັ່ນຕອງ
            </button>
          )}
        </div>

        {/* Empty State */}
        {processedProducts.length === 0 && !isLoading && (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center flex flex-col items-center justify-center my-6 space-y-3 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Package size={32} weight="duotone" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              ບໍ່ພົບສິນຄ້າທີ່ຄົ້ນຫາ
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              ກະລຸນາກວດສອບຄຳຄົ້ນຫາ ຫຼື ເລືອກໝວດໝູ່ "ທັງໝົດ" ເພື່ອເບິ່ງສິນຄ້າທັງໝົດຂອງຮ້ານ.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('ທັງໝົດ');
              }}
              className="mt-2 h-9 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              ເບິ່ງສິນຄ້າທັງໝົດ
            </button>
          </div>
        )}

        {/* GRID VIEW: 2 columns on Mobile, 3-4 columns on Tablet/Desktop */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {visibleProducts.map((p) => {
              const tierBreakdown = getProductTierBreakdown(p);
              const cleanImageUrl = sanitizeImageUrl(p.imageUrl || p.image_url);

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 hover:border-teal-400/80 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer group active:scale-98"
                >
                  <div>
                    {/* Product Photo */}
                    <div className="w-full aspect-square bg-slate-50 border-b border-slate-100 relative overflow-hidden flex items-center justify-center">
                      {cleanImageUrl ? (
                        <img
                          src={cleanImageUrl}
                          alt={p.name}
                          className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="text-slate-300">
                          <Package size={44} weight="duotone" />
                        </div>
                      )}

                      {p.category && (
                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-900/70 backdrop-blur-xs text-white shadow-2xs">
                          {p.category}
                        </span>
                      )}
                    </div>

                    {/* Titles: Pure Lao only */}
                    <div className="p-3 pb-1">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-tight group-hover:text-teal-700 transition-colors">
                        {p.name}
                      </h4>
                    </div>
                  </div>

                  {/* Pricing Breakdown Bottom Section: Largest tier on top, descending order */}
                  <div className="p-3 pt-2 border-t border-slate-100/90 bg-slate-50/50 space-y-1.5">
                    {/* Primary Largest Unit Price (Top row) */}
                    {tierBreakdown.length > 0 && (
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-[10px] sm:text-[11px] text-slate-700 font-bold uppercase truncate" title={tierBreakdown[0].label}>
                          {tierBreakdown[0].label}
                        </span>
                        <span className="text-sm sm:text-base font-black text-teal-700 font-mono tracking-tight shrink-0">
                          {formatKip(tierBreakdown[0].retailPrice)}
                        </span>
                      </div>
                    )}

                    {/* Secondary Smaller Units in Descending Order */}
                    {tierBreakdown.length > 1 && (
                      <div className="space-y-0.5 pt-1 border-t border-slate-200/60 text-[10.5px]">
                        {tierBreakdown.slice(1).map((item, subIdx) => (
                          <div
                            key={item.id || subIdx}
                            className="flex items-center justify-between text-slate-600 font-medium"
                          >
                            <span className="truncate" title={item.label}>
                              {item.label}
                            </span>
                            <span className="font-mono font-bold text-slate-800 shrink-0">
                              {formatKip(item.retailPrice)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quick Add To Cart / Select Unit */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedProduct(null);
                        setSelectorProduct(p);
                      }}
                      className="w-full mt-1.5 h-8 rounded-xl bg-teal-50 hover:bg-teal-600 text-teal-700 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-teal-200/90 hover:border-teal-600 transition-all active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <Plus size={14} weight="bold" />
                      <span>ເລືອກຊື້</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW: Full width row items */
          <div className="space-y-2">
            {visibleProducts.map((p) => {
              const tierBreakdown = getProductTierBreakdown(p);
              const cleanImageUrl = sanitizeImageUrl(p.imageUrl || p.image_url);

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-teal-400 p-3 flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs transition-all cursor-pointer group active:scale-99"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                      {cleanImageUrl ? (
                        <img
                          src={cleanImageUrl}
                          alt={p.name}
                          className="w-full h-full object-contain p-1"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Package size={24} weight="duotone" className="text-slate-300" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate group-hover:text-teal-700 transition-colors">
                        {p.name}
                      </h4>
                      {p.category && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[9.5px] font-bold bg-slate-100 text-slate-600">
                          {p.category}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <div className="text-sm sm:text-base font-black text-teal-700 font-mono">
                        {tierBreakdown.length > 0 ? formatKip(tierBreakdown[0].retailPrice) : '---'}
                      </div>
                      {tierBreakdown.length > 0 && (
                        <div className="text-[10px] text-slate-500 font-bold">
                          {tierBreakdown[0].label.replace(/:$/, '')}
                        </div>
                      )}
                      {tierBreakdown.length > 1 && (
                        <div className="text-[10px] font-medium text-slate-600 font-mono mt-0.5 space-y-0.5">
                          {tierBreakdown.slice(1).map((item, subIdx) => (
                            <div key={item.id || subIdx}>
                              {item.label} {formatKip(item.retailPrice)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedProduct(null);
                        setSelectorProduct(p);
                      }}
                      className="h-9 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer shrink-0"
                      title="ເລືອກຫົວໜ່ວຍ & ເພີ່ມໃສ່ກະຕ່າ"
                    >
                      <Plus size={14} weight="bold" />
                      <span className="hidden sm:inline">ເລືອກຊື້</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sentinel & smooth auto-loader indicator at bottom (Infinite Scroll) */}
        {visibleLimit < processedProducts.length && (
          <div
            ref={sentinelRef}
            className="py-6 flex items-center justify-center text-xs font-bold text-slate-400 gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span>ສະແດງ {visibleProducts.length} ຈາກ {processedProducts.length} ລາຍການ</span>
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </div>
        )}
      </main>

      {/* 5. FOOTER */}
      <footer className="mt-8 border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500 space-y-3 shrink-0">
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center justify-center space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">ຮ້ານ ສົມສັກ (MeiiShop)</span>
            <span>•</span>
            <span>{storeAddress}</span>
          </div>

          <div className="flex items-center justify-center gap-3 text-slate-600 font-mono font-bold flex-wrap">
            <a
              href={defaultWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-700 hover:underline flex items-center gap-1 font-sans"
            >
              <WhatsappLogo size={14} weight="fill" className="text-emerald-600" />
              <span>WhatsApp: {whatsappNumber}</span>
            </a>
            {hotlineNumbers.map((phone) => (
              <a
                key={phone}
                href={`tel:${phone.replace(/\s+/g, '')}`}
                className="hover:text-primary hover:underline flex items-center gap-1"
              >
                <Phone size={13} weight="bold" />
                <span>{phone}</span>
              </a>
            ))}
          </div>

          <p className="text-[11px] text-slate-400">
            ລະບົບບັນຊີ & ສາງສິນຄ້າອອນລາຍ MeiiShop Cloud
          </p>
        </div>
      </footer>

      {/* 6. FLOATING CART BOTTOM BAR (Mobile only, hidden on tablet/desktop) */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-3 left-3 right-3 z-40 animate-in slide-in-from-bottom-4 duration-200 select-none">
          <div
            onClick={() => setIsCheckoutOpen(true)}
            className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between gap-3 cursor-pointer active:scale-98"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-xs shrink-0">
                <ShoppingCart size={20} weight="fill" />
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center border-2 border-slate-900">
                  {totalCartQuantity}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-blue-200 font-bold truncate">
                  {cart.length} ລາຍການໃນກະຕ່າ
                </div>
                <div className="text-base font-black font-mono text-white tracking-tight">
                  {formatKip(cartGrandTotal)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs shrink-0 shadow-xs transition-colors">
              <span>ສັ່ງຊື້ສິນຄ້າ</span>
              <ArrowRight size={15} weight="bold" />
            </div>
          </div>
        </div>
      )}

      {/* 6.5. ACTIVE / RECENT ORDER LIVE TRACKING BAR (Floating Pill) */}
      {bannerOrder && (
        <div
          onClick={() => setTrackingOrder(bannerOrder)}
          className={`fixed left-3 right-3 sm:left-auto sm:right-6 sm:w-92 z-40 text-white p-3 rounded-2xl shadow-xl flex items-center justify-between gap-2.5 cursor-pointer transition-all border backdrop-blur-md active:scale-98 ${
            cart.length > 0 ? 'bottom-20 sm:bottom-22' : 'bottom-3 sm:bottom-5'
          } ${
            (bannerOrder.online_status || bannerOrder.onlineStatus) === 'COMPLETED'
              ? 'bg-emerald-950/95 border-emerald-500/50 hover:bg-emerald-900/95 shadow-emerald-950/40'
              : (bannerOrder.online_status || bannerOrder.onlineStatus) === 'READY'
              ? 'bg-blue-950/95 border-blue-500/50 hover:bg-blue-900/95 shadow-blue-950/40'
              : (bannerOrder.online_status || bannerOrder.onlineStatus) === 'PREPARING'
              ? 'bg-indigo-950/95 border-indigo-500/50 hover:bg-indigo-900/95 shadow-indigo-950/40'
              : 'bg-slate-900/95 border-slate-700 hover:bg-slate-800 shadow-slate-950/40'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {(bannerOrder.online_status || bannerOrder.onlineStatus) === 'COMPLETED' ? (
              <CheckCircle size={22} weight="fill" className="text-emerald-400 shrink-0" />
            ) : (bannerOrder.online_status || bannerOrder.onlineStatus) === 'READY' ? (
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping shrink-0" />
            ) : (bannerOrder.online_status || bannerOrder.onlineStatus) === 'PREPARING' ? (
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
            )}
            <div className="min-w-0 text-xs">
              <div className="font-mono font-black truncate">
                <span className={
                  (bannerOrder.online_status || bannerOrder.onlineStatus) === 'COMPLETED'
                    ? 'text-emerald-300'
                    : 'text-amber-300'
                }>
                  #{bannerOrder.receiptNumber || bannerOrder.receipt_number || bannerOrder.id}
                </span>
              </div>
              <div className="text-[11px] text-slate-200 font-bold truncate">
                {(bannerOrder.online_status || bannerOrder.onlineStatus) === 'COMPLETED'
                  ? 'ອໍເດີສຳເລັດຮຽບຮ້ອຍແລ້ວ!'
                  : (bannerOrder.online_status || bannerOrder.onlineStatus) === 'READY'
                  ? 'ສິນຄ້າພ້ອມຮັບ / ສົ່ງແລ້ວ!'
                  : (bannerOrder.online_status || bannerOrder.onlineStatus) === 'PREPARING'
                  ? 'ຮ້ານກຳລັງຈັດເຄື່ອງ...'
                  : 'ລໍຖ້າຮ້ານກວດສອບ...'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[11px] font-black px-2.5 py-1 rounded-xl shadow-2xs ${
              (bannerOrder.online_status || bannerOrder.onlineStatus) === 'COMPLETED'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-primary text-white'
            }`}>
              {(bannerOrder.online_status || bannerOrder.onlineStatus) === 'COMPLETED' ? 'ເບິ່ງບິນ' : 'ຕິດຕາມ'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDismissedOrderIds((prev) => new Set([...prev, bannerOrder.id]));
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="ປິດ"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        </div>
      )}

      {/* 7. MODALS */}
      {/* Unit & Quantity Selector Modal */}
      <CustomerUnitSelectorModal
        product={selectorProduct}
        isOpen={Boolean(selectorProduct)}
        onClose={() => setSelectorProduct(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Cart & Checkout Drawer Modal */}
      <CustomerCartCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onSubmitOrder={handleSubmitOnlineOrder}
        isSubmitting={isSubmittingOrder}
        hotlineNumbers={hotlineNumbers}
      />

      {/* Order Placement Success Modal */}
      <CustomerOrderSuccessModal
        isOpen={Boolean(successOrder)}
        order={successOrder}
        onClose={() => setSuccessOrder(null)}
        onOpenTracking={(ord) => {
          setSuccessOrder(null);
          setTrackingOrder(ord);
        }}
        whatsappInternational={whatsappInternational}
        whatsappNumber={whatsappNumber}
        hotlineNumbers={hotlineNumbers}
      />

      {/* Live Order Tracking Modal */}
      <CustomerOrderTrackingModal
        isOpen={Boolean(trackingOrder)}
        order={trackingOrder}
        onClose={() => setTrackingOrder(null)}
        onStatusUpdate={handleOrderStatusUpdate}
        hotlineNumbers={hotlineNumbers}
        whatsappInternational={whatsappInternational}
      />

      {/* Product Detail Modal */}
      <CustomerProductDetailModal
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onOpenUnitSelector={(p) => setSelectorProduct(p)}
        hotlineNumbers={hotlineNumbers}
        whatsappNumber={whatsappNumber}
      />
    </div>
  );
}
