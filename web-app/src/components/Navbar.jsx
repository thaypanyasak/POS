import React, { useState } from 'react';
import {
  Storefront,
  Warehouse,
  Package,
  ClockCounterClockwise,
  ChartBar,
  Gear,
  CaretLeft,
  CaretRight,
  SidebarSimple,
  CornersOut,
  CurrencyCircleDollar,
  CloudCheck,
  CloudSlash
} from '@phosphor-icons/react';

export default function Navbar({
  activeMainTab = 'pos',
  setActiveMainTab,
  isCloudSynced = false,
  cartCount = 0,
  transactionsCount = 0,
  outOfStockCount = 0,
  debtCount = 0,
  exchangeRate = 0,
  isCollapsed,
  setIsCollapsed,
}) {
  // Controlled or uncontrolled collapsed state
  const [localCollapsed, setLocalCollapsed] = useState(true);
  const collapsed = isCollapsed !== undefined ? isCollapsed : localCollapsed;

  const toggleCollapsed = () => {
    if (setIsCollapsed) {
      setIsCollapsed(!collapsed);
    } else {
      setLocalCollapsed(!collapsed);
    }
  };

  const navItems = [
    {
      id: 'pos',
      label: 'ຂາຍໜ້າຮ້ານ (POS)',
      sub: 'Terminal ຂາຍເຄື່ອງ',
      shortLabel: 'ຂາຍໜ້າຮ້ານ',
      icon: Storefront,
      badge: cartCount > 0 ? cartCount : null,
    },
    {
      id: 'purchases',
      label: 'ຮັບສິນຄ້າເຂົ້າ (GRN)',
      sub: 'ສາງ & ໜີ້ຜູ້ສະໜອງ',
      shortLabel: 'ຮັບເຂົ້າ',
      icon: Warehouse,
    },
    {
      id: 'products',
      label: 'ລາຍການສິນຄ້າ',
      sub: 'ຕົ້ນທຶນບາດ & ສະຕັອກ',
      shortLabel: 'ສິນຄ້າ',
      icon: Package,
      badge: outOfStockCount > 0 ? outOfStockCount : null,
    },
    {
      id: 'history',
      label: 'ປະຫວັດບິນ',
      sub: 'ລາຍການຂາຍສຳເລັດ',
      shortLabel: 'ປະຫວັດ',
      icon: ClockCounterClockwise,
      badge: debtCount > 0 ? debtCount : (transactionsCount > 0 ? transactionsCount : null),
    },
    {
      id: 'dashboard',
      label: 'ແຜງຄວບຄຸມ (Dashboard)',
      sub: 'ລາຍຮັບ & ກຳໄລ',
      shortLabel: 'ລາຍຮັບ',
      icon: ChartBar,
    },
    {
      id: 'settings',
      label: 'ຕັ້ງຄ່າລະບົບ',
      sub: 'ອັດຕາແລກປ່ຽນ & ຮ້ານ',
      shortLabel: 'ຕັ້ງຄ່າ',
      icon: Gear,
    },
  ];

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    } catch (e) {
      console.warn('Fullscreen toggle error:', e);
    }
  };

  return (
    <>
      {/* 1. TABLET & DESKTOP: Fixed Vertical Sidebar (>= 768px) */}
      <aside
        className={`hidden md:flex bg-white border-r border-slate-200 flex-col justify-between h-full min-h-0 shrink-0 z-30 select-none shadow-xs transition-all duration-200 ease-out overflow-y-auto no-scrollbar overscroll-contain ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Top Section: Brand Logo & Navigation Items */}
        <div>
          {/* Brand Header */}
          <div
            className={`border-b border-slate-200/80 flex items-center transition-all ${
              collapsed
                ? 'py-4 px-2 justify-center'
                : 'py-4 px-4 justify-between'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Brand Logo: Icon tròn màu Teal bo góc mềm mại */}
              <div
                className="w-10 h-10 rounded-2xl bg-teal-600 flex items-center justify-center text-white font-black text-xl shadow-xs ring-4 ring-teal-50 shrink-0 cursor-pointer"
                onClick={() => setActiveMainTab('pos')}
                title="MeiiShop POS"
              >
                M
              </div>

              {!collapsed && (
                <div className="overflow-hidden min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h1 className="font-extrabold text-base tracking-tight text-slate-900 truncate">
                      MeiiShop
                    </h1>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200/80 shrink-0">
                      POS
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate">
                    ລະບົບຂາຍໜ້າຮ້ານ
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Items List */}
          <nav className="p-2.5 space-y-1.5 mt-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMainTab === item.id;
              const hasBadge = item.badge !== null && item.badge !== undefined && item.badge > 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveMainTab(item.id)}
                  className={`relative flex items-center rounded-xl transition-all duration-150 cursor-pointer group ${
                    collapsed
                      ? 'w-12 h-12 mx-auto justify-center'
                      : 'w-full px-3 py-2.5 justify-between'
                  } ${
                    isActive
                      ? 'bg-teal-50 text-teal-700 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  {/* Active Indicator: Dải thanh chỉ thị màu Teal ở cạnh trái */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-teal-600 rounded-r-full" />
                  )}

                  {/* Left Icon + Text */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      size={22}
                      weight={isActive ? 'bold' : 'bold'}
                      className={`shrink-0 transition-colors ${
                        isActive
                          ? 'text-teal-700'
                          : 'text-slate-500 group-hover:text-slate-800'
                      }`}
                    />

                    {!collapsed && (
                      <div className="text-left min-w-0 overflow-hidden">
                        <div
                          className={`text-sm leading-tight truncate ${
                            isActive
                              ? 'font-bold text-teal-700'
                              : 'font-semibold text-slate-800 group-hover:text-slate-900'
                          }`}
                        >
                          {item.label}
                        </div>
                        <div
                          className={`text-[11px] leading-tight truncate mt-0.5 ${
                            isActive
                              ? 'text-teal-600/80 font-medium'
                              : 'text-slate-400 group-hover:text-slate-500'
                          }`}
                        >
                          {item.sub}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notification Badge: Hình tròn nhỏ màu đỏ son bg-rose-500 text-white font-mono text-xs */}
                  {hasBadge && (
                    <span
                      className={`font-mono font-bold bg-rose-500 text-white shadow-xs ${
                        collapsed
                          ? 'absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-xs flex items-center justify-center border-2 border-white'
                          : 'min-w-[20px] h-5 px-1.5 rounded-full text-xs flex items-center justify-center shrink-0'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Area: Controls, Rate, Sync & Collapse Button at the bottom */}
        <div className="p-2.5 border-t border-slate-200/90 flex flex-col gap-2 bg-slate-50/50">
          {!collapsed ? (
            <>
              {/* Currency Rate Widget */}
              <div className="flex items-center justify-between px-3 py-2 bg-white rounded-xl border border-slate-200/80 text-xs shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                  <CurrencyCircleDollar size={16} className="text-amber-500" weight="fill" />
                  <span className="text-[11px]">ອັດຕາຕົ້ນທຶນ:</span>
                </div>
                <span className="font-mono font-bold text-slate-800 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded-md">
                  1 ฿ = {exchangeRate} ₭
                </span>
              </div>

              {/* Sync Status Badge */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-white rounded-xl border border-slate-200/80 text-xs font-semibold">
                <div className="flex items-center gap-1.5 text-slate-600">
                  {isCloudSynced ? (
                    <CloudCheck size={16} className="text-teal-600" weight="fill" />
                  ) : (
                    <CloudSlash size={16} className="text-amber-600" weight="fill" />
                  )}
                  <span>{isCloudSynced ? 'Supabase Sync' : 'Offline Mode'}</span>
                </div>
                <div
                  className={`w-2 h-2 rounded-full ${
                    isCloudSynced ? 'bg-teal-500' : 'bg-amber-500'
                  }`}
                />
              </div>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-teal-700 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <CornersOut size={16} weight="bold" />
                  <span>ເຕັມຈໍ (Full Screen)</span>
                </div>
              </button>

              {/* Nút thu gọn Sidebar ở chân trang */}
              <button
                type="button"
                onClick={toggleCollapsed}
                className="w-full h-10 px-3 bg-white hover:bg-teal-50/60 border border-slate-200 hover:border-teal-300 text-slate-700 hover:text-teal-800 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs transition-all cursor-pointer"
                title="ຫຍໍ້ແຖບເມນູ (Collapse Sidebar)"
              >
                <div className="flex items-center gap-2">
                  <SidebarSimple size={18} weight="bold" className="text-slate-500" />
                  <span>ຫຍໍ້ແຖບເມນູ</span>
                </div>
                <CaretLeft size={16} weight="bold" className="text-slate-400" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              {/* Fullscreen Icon */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="w-12 h-10 mx-auto rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-teal-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                title="ເຕັມຈໍ (Full Screen)"
              >
                <CornersOut size={18} weight="bold" />
              </button>

              {/* Rate Icon */}
              <div
                className="flex flex-col items-center justify-center py-1 cursor-pointer"
                onClick={toggleCollapsed}
                title={`ອັດຕາຕົ້ນທຶນ: 1 ฿ = ${exchangeRate} ₭`}
              >
                <CurrencyCircleDollar size={20} className="text-amber-500" weight="fill" />
                <span className="text-[11px] font-mono font-bold text-slate-600 mt-0.5">
                  {exchangeRate}₭
                </span>
              </div>

              {/* Cloud Sync Dot */}
              <div
                className="flex items-center justify-center py-1"
                title={isCloudSynced ? 'Supabase Sync: Online' : 'Supabase: Offline'}
              >
                {isCloudSynced ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-teal-500 ring-4 ring-teal-50" />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-50" />
                )}
              </div>

              {/* Nút mở rộng Sidebar ở chân trang */}
              <button
                type="button"
                onClick={toggleCollapsed}
                className="w-12 h-10 mx-auto bg-white hover:bg-teal-50/60 border border-slate-200 hover:border-teal-300 text-slate-700 hover:text-teal-800 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                title="ຂະຫຍາຍແຖບເມນູ (Expand Sidebar)"
              >
                <SidebarSimple size={18} weight="bold" className="text-slate-600" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* 2. MOBILE: Touch-Optimized Bottom Navigation Bar (< 768px) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-center justify-around py-1.5 px-1 shadow-lg"
        style={{
          paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMainTab === item.id;
          const hasBadge = item.badge !== null && item.badge !== undefined && item.badge > 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveMainTab(item.id)}
              className={`flex-1 py-1 px-0.5 rounded-xl flex flex-col items-center justify-center transition-all relative min-h-[48px] active:scale-95 cursor-pointer ${
                isActive
                  ? 'text-teal-700'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <Icon size={22} weight={isActive ? 'bold' : 'bold'} />
                {hasBadge && (
                  <span className="absolute -top-1 -right-2 px-1 min-w-[18px] h-4 rounded-full text-[11px] font-bold font-mono bg-rose-500 text-white flex items-center justify-center border border-white shadow-2xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] mt-0.5 truncate leading-tight ${
                  isActive ? 'text-teal-800 font-extrabold' : 'text-slate-500 font-medium'
                }`}
              >
                {item.shortLabel}
              </span>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-0.5 shadow-2xs" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
