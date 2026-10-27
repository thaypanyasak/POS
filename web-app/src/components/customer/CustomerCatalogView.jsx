import React, { useState, useMemo } from 'react';
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
  CheckCircle,
  WarningCircle,
  Tag,
  ArrowClockwise,
  Lock,
  Sparkle,
  ArrowsDownUp,
  Funnel,
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
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'price-asc' | 'price-desc' | 'name-asc'

  const hotlineNumbers = ['020 56468780', '020 52228432'];
  const storeAddress = 'ບ້ານ ໂພນສະຫວັນ, ນະຄອນປາກເຊ, ຈຳປາສັກ';

  const rawPhone = hotlineNumbers[0].replace(/\D/g, '');
  const internationalPhone = rawPhone.startsWith('020')
    ? '85620' + rawPhone.slice(3)
    : rawPhone.startsWith('20')
    ? '856' + rawPhone
    : rawPhone;

  const defaultWhatsappUrl = `https://wa.me/${internationalPhone}?text=${encodeURIComponent(
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

  // Filtered & Sorted products based on search, category, stock, and sorting criteria
  const processedProducts = useMemo(() => {
    const normQuery = normalizeLao(searchQuery.trim().toLowerCase());

    let list = (products || []).filter((p) => {
      // 1. Stock Filter
      if (onlyInStock) {
        const isOutOfStock =
          p.trackStock !== false &&
          Number(p.currentStockBaseUnits || p.stockPieces || 0) <= 0;
        if (isOutOfStock) return false;
      }

      // 2. Category Filter
      if (activeCategory !== 'ທັງໝົດ') {
        if (p.category !== activeCategory) {
          return false;
        }
      }

      // 3. Search Query Filter (bilingual Lao & Vietnamese + barcode)
      if (!normQuery) return true;

      const normName = normalizeLao((p.name || '').toLowerCase());
      const normNameVi = normalizeLao((p.name_vi || p.nameVi || '').toLowerCase());
      const barcode = (p.barcode || '').toLowerCase();
      const cat = normalizeLao((p.category || '').toLowerCase());

      return (
        normName.includes(normQuery) ||
        normNameVi.includes(normQuery) ||
        barcode.includes(normQuery) ||
        cat.includes(normQuery)
      );
    });

    // 4. Sort logic
    if (sortBy === 'price-asc' || sortBy === 'price-desc') {
      list = [...list].sort((a, b) => {
        const uA = getSortedUnits(a);
        const uB = getSortedUnits(b);
        const priceA = Number(uA[uA.length - 1]?.retailPrice || a.retailPrice || 0);
        const priceB = Number(uB[uB.length - 1]?.retailPrice || b.retailPrice || 0);
        return sortBy === 'price-asc' ? priceA - priceB : priceB - priceA;
      });
    } else if (sortBy === 'name-asc') {
      list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'lo'));
    }

    return list;
  }, [products, searchQuery, activeCategory, onlyInStock, sortBy]);

  return (
    <div
      className="fixed inset-0 w-full h-full h-dvh overflow-y-auto touch-scroll-container bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-teal-500/20 selection:text-teal-900 pb-12 z-10"
      style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
    >
      {/* 1. TOP NAVBAR (Glassmorphism & Fixed on Scroll) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2.5">
          {/* Brand Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-teal-700 via-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-xs shrink-0">
              <Package size={22} weight="duotone" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                  ຮ້ານ ສົມສັກ (MeiiShop)
                </h1>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Open Store" />
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                ສິນຄ້າຂາຍຍ່ອຍ ແລະ ຂາຍສົ່ງ • Bán lẻ & Bán sỉ
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
              title="ສັ່ງຜ່ານ WhatsApp (Chat qua WhatsApp)"
            >
              <WhatsappLogo size={15} weight="fill" className="text-emerald-600" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>

            {/* Quick Hotline Call Button */}
            <a
              href={`tel:${hotlineNumbers[0].replace(/\s+/g, '')}`}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center gap-1.5 border border-teal-200/80 shadow-2xs transition-all active:scale-95"
              title="ໂທຫາຮ້ານ (Gọi cho quán)"
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
                title="ໂຫຼດຂໍ້ມູນໃໝ່ (Làm mới)"
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

      {/* 2. HERO / STORE ANNOUNCEMENT BANNER */}
      <section className="max-w-6xl mx-auto w-full px-3 sm:px-6 pt-3 sm:pt-4">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 text-white p-4 sm:p-6 shadow-md border border-teal-600/50">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1 sm:space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-xs text-[10.5px] font-bold text-teal-100 border border-white/20">
                <Sparkle size={12} weight="fill" className="text-amber-300" />
                <span>ເມນູສິນຄ້າ & ລາຄາຂາຍລ່າສຸດ (Bảng giá cập nhật)</span>
              </div>
              <h2 className="text-base sm:text-2xl font-black tracking-tight leading-tight">
                ຍິນດີຕ້ອນຮັບສູ່ ຮ້ານ ສົມສັກ
              </h2>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-teal-100/90 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin size={14} weight="bold" className="text-teal-300" />
                  <span>{storeAddress}</span>
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="flex items-center gap-1">
                  <Clock size={14} weight="bold" className="text-teal-300" />
                  <span>ເປີດທຸກມື້ 07:00 - 21:00</span>
                </span>
              </div>
            </div>

            {/* Quick Hotline Calling / WhatsApp Pill */}
            <div className="flex items-center gap-2 pt-1 md:pt-0 flex-wrap">
              <a
                href={defaultWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
              >
                <WhatsappLogo size={16} weight="fill" />
                <span>WhatsApp</span>
              </a>
              <a
                href={`tel:${hotlineNumbers[0].replace(/\s+/g, '')}`}
                className="h-10 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm transition-transform active:scale-95"
              >
                <Phone size={16} weight="bold" />
                <span>ສັ່ງເຄື່ອງ: {hotlineNumbers[0]}</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 3. STICKY SEARCH & CATEGORY FILTER BAR */}
      <section className="sticky top-14 sm:top-16 z-30 bg-slate-50/95 backdrop-blur-md pt-3 pb-2.5 max-w-6xl mx-auto w-full px-3 sm:px-6 space-y-2 border-b border-slate-200/60">
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
              placeholder="ຄົ້ນຫາສິນຄ້າ (ຊື່ລາວ, ຫວຽດ, ບາໂຄດ)..."
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

        {/* Secondary Filter Bar: In-stock filter & Sort selector */}
        <div className="flex items-center justify-between gap-2 pt-0.5 text-xs">
          {/* In-Stock Toggle */}
          <button
            type="button"
            onClick={() => setOnlyInStock(!onlyInStock)}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              onlyInStock
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100'
            }`}
          >
            <CheckCircle
              size={13}
              weight={onlyInStock ? 'fill' : 'regular'}
              className={onlyInStock ? 'text-emerald-600' : 'text-slate-400'}
            />
            <span>ສະເພາະສິນຄ້າທີ່ມີ (Chỉ hiện còn hàng)</span>
          </button>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
            <ArrowsDownUp size={12} weight="bold" className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg h-7 px-2 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-teal-500 cursor-pointer shadow-2xs"
            >
              <option value="default">ມາດຕະຖານ (Mặc định)</option>
              <option value="price-asc">ລາຄາ: ຕ່ຳຫາສູງ (Giá tăng)</option>
              <option value="price-desc">ລາຄາ: ສູງຫາຕ່ຳ (Giá giảm)</option>
              <option value="name-asc">ຊື່: ກ-ຮ (Tên A-Z)</option>
            </select>
          </div>
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
          {(searchQuery || onlyInStock || activeCategory !== 'ທັງໝົດ') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('ທັງໝົດ');
                setOnlyInStock(false);
              }}
              className="text-teal-600 hover:underline cursor-pointer"
            >
              ລ້າງຕົວກັ່ນຕອງທັງໝົດ
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
              ບໍ່ພົບສິນຄ້າທີ່ຄົ້ນຫາ (Không tìm thấy sản phẩm)
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              ກະລຸນາກວດສອບຄຳຄົ້ນຫາ ຫຼື ເລືອກໝວດໝູ່ "ທັງໝົດ" ເພື່ອເບິ່ງສິນຄ້າທັງໝົດຂອງຮ້ານ.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('ທັງໝົດ');
                setOnlyInStock(false);
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
            {processedProducts.map((p) => {
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

              const isOutOfStock =
                p.trackStock !== false &&
                Number(p.currentStockBaseUnits || p.stockPieces || 0) <= 0;

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

                      {/* Stock Pill on photo */}
                      {isOutOfStock ? (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                          ສິນຄ້າໝົດ
                        </span>
                      ) : (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                          ມີສິນຄ້າ
                        </span>
                      )}

                      {p.category && (
                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-900/70 backdrop-blur-xs text-white shadow-2xs">
                          {p.category}
                        </span>
                      )}
                    </div>

                    {/* Titles */}
                    <div className="p-3 pb-1">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-tight group-hover:text-teal-700 transition-colors">
                        {p.name}
                      </h4>
                      {(p.name_vi || p.nameVi) && (
                        <p className="text-[10.5px] text-slate-400 font-medium truncate mt-0.5">
                          {p.name_vi || p.nameVi}
                        </p>
                      )}
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
            {processedProducts.map((p) => {
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
                      {(p.name_vi || p.nameVi) && (
                        <p className="text-[11px] text-slate-400 font-medium truncate">
                          {p.name_vi || p.nameVi}
                        </p>
                      )}
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
      </main>

      {/* 5. FOOTER */}
      <footer className="mt-8 border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500 space-y-3">
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center justify-center space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">ຮ້ານ ສົມສັກ (MeiiShop)</span>
            <span>•</span>
            <span>{storeAddress}</span>
          </div>

          <div className="flex items-center justify-center gap-3 text-slate-600 font-mono font-bold flex-wrap">
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
      />
    </div>
  );
}
