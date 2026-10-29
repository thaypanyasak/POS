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
} from '@phosphor-icons/react';
import { formatKip, normalizeLao, getSortedUnits, sanitizeImageUrl } from '../../utils/formatters';
import CustomerProductDetailModal from './CustomerProductDetailModal';

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

  // Load more items smoothly when approaching bottom
  const loadMoreProducts = useCallback(() => {
    if (processedProducts && visibleLimit < processedProducts.length) {
      setVisibleLimit((prev) => Math.min(prev + LOAD_MORE_STEP, processedProducts.length));
    }
  }, [processedProducts, visibleLimit]);

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
      className="fixed inset-0 w-full h-full h-dvh overflow-y-auto touch-scroll-container bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-teal-500/20 selection:text-teal-900 pb-12 z-10"
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
            {/* WhatsApp Direct Order Button */}
            <a
              href={defaultWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1 border border-emerald-200 shadow-2xs transition-all active:scale-95"
              title="ສັ່ງຜ່ານ WhatsApp"
            >
              <WhatsappLogo size={15} weight="fill" className="text-emerald-600" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>

            {/* Quick Hotline Call Button */}
            <a
              href={`tel:${hotlineNumbers[0].replace(/\s+/g, '')}`}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center gap-1.5 border border-teal-200/80 shadow-2xs transition-all active:scale-95"
              title="ໂທຫາຮ້ານ"
            >
              <Phone size={14} weight="bold" className="text-teal-600" />
              <span className="hidden md:inline font-mono">{hotlineNumbers[0]}</span>
              <span className="md:hidden">ໂທຮ້ານ</span>
            </a>

            {/* Refresh Button */}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors active:scale-95 shadow-2xs"
                title="ໂຫຼດຂໍ້ມູນໃໝ່"
              >
                <ArrowClockwise
                  size={16}
                  weight="bold"
                  className={isLoading ? 'animate-spin text-teal-600' : ''}
                />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO / STORE ANNOUNCEMENT BANNER (Solid Color, No Gradient, No Emojis, Pure Lao) */}
      <section className="max-w-6xl mx-auto w-full px-3 sm:px-6 pt-3 sm:pt-4 shrink-0">
        <div className="rounded-2xl sm:rounded-3xl bg-teal-900 text-white p-4 sm:p-6 shadow-sm border border-teal-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-teal-800 text-[11px] font-bold text-teal-100 border border-teal-700">
                <span>ເມນູສິນຄ້າ & ລາຄາຂາຍລ່າສຸດ</span>
              </div>
              <h2 className="text-base sm:text-2xl font-black tracking-tight leading-tight text-white">
                ຍິນດີຕ້ອນຮັບສູ່ ຮ້ານ ສົມສັກ
              </h2>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-teal-200/90 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin size={14} weight="bold" className="text-teal-300 shrink-0" />
                  <span>{storeAddress}</span>
                </span>
                <span className="hidden sm:inline text-teal-500">•</span>
                <span className="flex items-center gap-1">
                  <Clock size={14} weight="bold" className="text-teal-300 shrink-0" />
                  <span>ເປີດທຸກມື້ 07:00 - 21:00</span>
                </span>
              </div>
            </div>

            {/* Hotline & WhatsApp Actions: Both numbers clearly accessible */}
            <div className="flex items-center gap-2 pt-1 md:pt-0 flex-wrap">
              <a
                href={defaultWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
              >
                <WhatsappLogo size={16} weight="fill" />
                <span>WhatsApp: {whatsappNumber}</span>
              </a>
              <a
                href={`tel:${hotlineNumbers[0].replace(/\s+/g, '')}`}
                className="h-10 px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
              >
                <Phone size={15} weight="bold" />
                <span>{hotlineNumbers[0]}</span>
              </a>
              <a
                href={`tel:${hotlineNumbers[1].replace(/\s+/g, '')}`}
                className="h-10 px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
              >
                <Phone size={15} weight="bold" />
                <span>{hotlineNumbers[1]}</span>
              </a>
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
              className="w-full h-10 sm:h-11 pl-10 pr-9 bg-white border border-slate-200/90 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/10 shadow-2xs font-medium"
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
                  ? 'bg-teal-600 text-white shadow-2xs'
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
                  ? 'bg-teal-600 text-white shadow-2xs'
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
                    ? 'bg-teal-600 text-white shadow-xs font-black'
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
            ພົບ <span className="text-teal-700 font-black font-mono">{processedProducts.length}</span> ສິນຄ້າ
            {activeCategory !== 'ທັງໝົດ' && <span> ໃນໝວດ "{activeCategory}"</span>}
          </span>
          {(searchQuery || activeCategory !== 'ທັງໝົດ') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('ທັງໝົດ');
              }}
              className="text-teal-600 hover:underline cursor-pointer"
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
              className="mt-2 h-9 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              ເບິ່ງສິນຄ້າທັງໝົດ
            </button>
          </div>
        )}

        {/* GRID VIEW: 2 columns on Mobile, 3-4 columns on Tablet/Desktop */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {visibleProducts.map((p) => {
              const sortedUnits = getSortedUnits(p);
              const baseUnit = sortedUnits[sortedUnits.length - 1]; // smallest unit (e.g. piece)
              const cartonUnit = sortedUnits.find(
                (u) =>
                  u.tier === 3 ||
                  u.id?.endsWith('_carton') ||
                  ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງ'].includes(u.unitName)
              );
              const packUnit = sortedUnits.find(
                (u) => u.tier === 2 || u.id?.endsWith('_pack') || ['ແພັກ', 'ມັດ'].includes(u.unitName)
              );

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

                  {/* Pricing Breakdown Bottom Section */}
                  <div className="p-3 pt-2 border-t border-slate-100/90 bg-slate-50/50 space-y-1.5">
                    {/* Primary Retail Price */}
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">
                        {baseUnit ? baseUnit.unitName : 'ລາຄາ'}:
                      </span>
                      <span className="text-sm sm:text-base font-black text-teal-700 font-mono tracking-tight">
                        {baseUnit ? formatKip(baseUnit.retailPrice) : '---'}
                      </span>
                    </div>

                    {/* Secondary Units (Pack / Carton) if available */}
                    {(packUnit || cartonUnit) && (
                      <div className="space-y-0.5 pt-1 border-t border-slate-200/60 text-[10.5px]">
                        {packUnit && packUnit !== baseUnit && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="truncate">{packUnit.unitName} ({packUnit.multiplier}):</span>
                            <span className="font-mono font-bold text-slate-800">
                              {formatKip(packUnit.retailPrice)}
                            </span>
                          </div>
                        )}
                        {cartonUnit && cartonUnit !== baseUnit && cartonUnit !== packUnit && (
                          <div className="flex items-center justify-between text-slate-600 font-medium">
                            <span className="truncate">{cartonUnit.unitName} ({cartonUnit.multiplier}):</span>
                            <span className="font-mono font-bold text-slate-900">
                              {formatKip(cartonUnit.retailPrice)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW: Full width row items */
          <div className="space-y-2">
            {visibleProducts.map((p) => {
              const sortedUnits = getSortedUnits(p);
              const baseUnit = sortedUnits[sortedUnits.length - 1];
              const cartonUnit = sortedUnits.find(
                (u) =>
                  u.tier === 3 ||
                  u.id?.endsWith('_carton') ||
                  ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງ'].includes(u.unitName)
              );

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

                  <div className="text-right shrink-0">
                    <div className="text-sm sm:text-base font-black text-teal-700 font-mono">
                      {baseUnit ? formatKip(baseUnit.retailPrice) : '---'}
                    </div>
                    {baseUnit && (
                      <div className="text-[10px] text-slate-400">/ {baseUnit.unitName}</div>
                    )}
                    {cartonUnit && (
                      <div className="text-[10px] font-bold text-slate-600 font-mono mt-0.5">
                        {cartonUnit.unitName}: {formatKip(cartonUnit.retailPrice)}
                      </div>
                    )}
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
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
            <span>ສະແດງ {visibleProducts.length} ຈາກ {processedProducts.length} ລາຍການ</span>
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
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
                className="hover:text-teal-700 hover:underline flex items-center gap-1"
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

      {/* 6. PRODUCT DETAIL MODAL */}
      <CustomerProductDetailModal
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        hotlineNumbers={hotlineNumbers}
        whatsappNumber={whatsappNumber}
      />
    </div>
  );
}
