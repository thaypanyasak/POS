import React, { useState } from 'react';
import {
  Storefront,
  ChartBar,
  Warehouse,
  ClockCounterClockwise,
  CloudCheck,
  CloudSlash,
  CaretLeft,
  CaretRight,
  CurrencyCircleDollar,
  SidebarSimple,
  CornersOut
} from '@phosphor-icons/react';

export default function Navbar({
  activeMainTab,
  setActiveMainTab,
  isCloudSynced,
  cartCount,
  transactionsCount,
  exchangeRate,
  isCollapsed,
  setIsCollapsed,
}) {
  // If isCollapsed is not controlled from parent, support local default true
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
      badgeColor: 'bg-teal-600 text-white',
    },
    {
      id: 'dashboard',
      label: 'ແຜງຄວບຄຸມ',
      sub: 'ລາຍຮັບ & ກຳໄລ',
      shortLabel: 'ລາຍຮັບ',
      icon: ChartBar,
    },
    {
      id: 'products',
      label: 'ລາຍການສິນຄ້າ',
      sub: 'ຕົ້ນທຶນບາດ & ສະຕັອກ',
      shortLabel: 'ສິນຄ້າ',
      icon: Warehouse,
    },
    {
      id: 'history',
      label: 'ປະຫວັດບິນ',
      sub: 'ລາຍການຂາຍສຳເລັດ',
      shortLabel: 'ປະຫວັດ',
      icon: ClockCounterClockwise,
      badge: transactionsCount > 0 ? transactionsCount : null,
      badgeColor: 'bg-slate-200 text-slate-700',
    },
    {
      id: 'purchases',
      label: 'ຮັບສິນຄ້າເຂົ້າ (GRN)',
      sub: 'ສາງ & ໜີ້ຜູ້ສະໜອງ',
      shortLabel: 'ຮັບເຂົ້າ',
      icon: Warehouse,
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
      {/* 1. TABLET & DESKTOP: Compact Vertical Icon Sidebar (>= 768px) */}
      <aside
        className={`hidden md:flex bg-white border-r border-slate-200/90 flex-col justify-between h-full min-h-0 shrink-0 z-30 select-none shadow-xs transition-all duration-200 ease-in-out overflow-y-auto no-scrollbar overscroll-contain ${
          collapsed ? 'w-16 md:w-20' : 'w-60 md:w-64'
        }`}
      >
        {/* Top Brand Header & Toggle */}
        <div>
          <div
            className={`p-2 sm:p-2.5 border-b border-slate-100 flex items-center ${
              collapsed ? 'flex-col gap-1.5 justify-center' : 'justify-between'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white font-black text-xl shadow-md shadow-teal-600/30 shrink-0 mx-auto">
                M
              </div>
              {!collapsed && (
                <div className="overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <h1 className="font-extrabold text-base tracking-tight text-slate-900 truncate">
                      MeiiShop
                    </h1>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                      POS
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 font-medium truncate">
                    ລະບົບຂາຍໜ້າຮ້ານ
                  </p>
                </div>
              )}
            </div>

            {/* Toggle Expand / Collapse Button */}
            <button
              type="button"
              onClick={toggleCollapsed}
              className={`w-7 h-7 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer ${
                collapsed ? 'mt-1' : ''
              }`}
              title={collapsed ? 'ຂະຫຍາຍເມນູ (Expand)' : 'ຫຍໍ້ເມນູ (Collapse)'}
            >
              {collapsed ? (
                <CaretRight size={16} weight="bold" />
              ) : (
                <CaretLeft size={16} weight="bold" />
              )}
            </button>
          </div>

          {/* Sync Status Badge */}
          <div className="px-2 pt-2.5">
            {!collapsed ? (
              <div
                className={`flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs font-bold ${
                  isCloudSynced
                    ? 'bg-sky-50/80 text-sky-800 border-sky-200'
                    : 'bg-amber-50/80 text-amber-800 border-amber-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isCloudSynced ? (
                    <CloudCheck size={16} className="text-sky-600" weight="fill" />
                  ) : (
                    <CloudSlash size={16} className="text-amber-600" weight="fill" />
                  )}
                  <span>{isCloudSynced ? 'Supabase Sync' : 'Offline'}</span>
                </div>
                <div
                  className={`w-2 h-2 rounded-full ${
                    isCloudSynced ? 'bg-sky-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
              </div>
            ) : (
              <div
                className="flex items-center justify-center py-1"
                title={isCloudSynced ? 'Supabase Sync: Online' : 'Supabase: Offline'}
              >
                {isCloudSynced ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-xs ring-4 ring-sky-100 animate-pulse" />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100" />
                )}
              </div>
            )}
          </div>

          {/* Nav Links */}
          <nav className="p-2 flex flex-col gap-1.5 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMainTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveMainTab(item.id)}
                  className={`flex items-center rounded-2xl transition-all duration-150 cursor-pointer relative group ${
                    collapsed
                      ? 'w-11 h-11 mx-auto justify-center'
                      : 'w-full px-3 py-2.5 justify-between'
                  } ${
                    isActive
                      ? 'bg-teal-700 text-white font-black shadow-sm shadow-teal-700/20'
                      : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-900 font-medium'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={20} weight={isActive ? 'bold' : 'regular'} />
                    {!collapsed && (
                      <div>
                        <div className="text-xs leading-none font-bold">
                          {item.label}
                        </div>
                        <div
                          className={`text-[10px] mt-0.5 ${
                            isActive ? 'text-teal-100 font-medium' : 'text-slate-400'
                          }`}
                        >
                          {item.sub}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Badge Count */}
                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`font-black font-mono ${
                        collapsed
                          ? 'absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] bg-teal-700 text-white border-2 border-white'
                          : `px-2 py-0.5 rounded-full text-[10px] ${
                              isActive ? 'bg-white/20 text-white' : item.badgeColor
                            }`
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

        {/* Bottom Area: Fullscreen, Rate & Info */}
        <div className="p-2 border-t border-slate-100 flex flex-col gap-2 bg-slate-50/50">
          {!collapsed ? (
            <>
              {/* Exchange Rate Card */}
              <div className="flex items-center justify-between px-3 py-2 bg-white rounded-xl border border-slate-200/80 text-xs shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                  <CurrencyCircleDollar size={16} className="text-amber-500" weight="fill" />
                  <span className="text-[11px]">ອັດຕາຕົ້ນທຶນ:</span>
                </div>
                <span className="font-mono font-bold text-slate-800 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded-md">
                  1 ฿ = {exchangeRate} ₭
                </span>
              </div>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="w-full py-1.5 px-2 bg-white hover:bg-teal-50 border border-slate-200 text-slate-700 hover:text-teal-800 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <CornersOut size={14} weight="bold" />
                <span>ເຕັມຈໍ (Full Screen)</span>
              </button>

              {/* Footer Shop Info */}
              <div className="text-[10px] text-slate-400 text-center font-medium">
                MeiiShop POS • ວຽງຈັນ
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="w-10 h-10 rounded-xl text-slate-500 hover:text-teal-700 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
                title="ເຕັມຈໍ (Full Screen)"
              >
                <CornersOut size={18} weight="bold" />
              </button>
              <div
                className="flex flex-col items-center justify-center py-1 text-slate-500 cursor-pointer"
                onClick={toggleCollapsed}
                title={`ອັດຕາຕົ້ນທຶນ: 1 ฿ = ${exchangeRate} ₭`}
              >
                <CurrencyCircleDollar size={18} className="text-amber-500" weight="fill" />
                <span className="text-[9px] font-mono font-bold text-slate-600 mt-0.5">
                  {exchangeRate}₭
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* 2. MOBILE: Sleek Bottom Navigation Bar (< 768px) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-center justify-around py-1.5 px-2 shadow-lg"
        style={{
          paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMainTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveMainTab(item.id)}
              className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center justify-center transition-all relative min-h-[46px] active:scale-95 cursor-pointer ${
                isActive
                  ? 'text-teal-700'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <Icon size={21} weight={isActive ? 'fill' : 'bold'} />
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-teal-600 text-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-0.5 truncate leading-tight ${
                  isActive ? 'text-teal-800 font-extrabold' : 'text-slate-500 font-medium'
                }`}
              >
                {item.shortLabel}
              </span>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-0.5 shadow-xs" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
