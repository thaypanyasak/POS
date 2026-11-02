import React, { useState } from 'react';
import {
  Storefront,
  Warehouse,
  Package,
  Receipt,
  ChartBar,
  ChartPieSlice,
  Gear,
  CaretLeft,
  CaretRight,
  SidebarSimple,
  CornersOut,
  CloudCheck,
  CloudSlash,
  Users,
  UserSwitch,
  Lock,
  ShieldCheck,
  SignIn,
  SignOut,
  Folders,
  Intersect,
  SquaresFour,
  X,
} from '@phosphor-icons/react';
import { playUnitChangeBeep } from '../utils/audioFeedback';
import { useAuth, useAuthRole } from '../contexts/AuthContext';
import CashierSwitchModal from './auth/CashierSwitchModal';
import LoginModal from './auth/LoginModal';
import ConfirmDialogModal from './ConfirmDialogModal';
import { NAVIGATION_SCHEMA } from '../config/navigationSchema';

export default function Navbar({
  activeMainTab = 'pos',
  setActiveMainTab,
  isCloudSynced = false,
  cartCount = 0,
  unreadOrdersCount = 0,
  onlineOrdersCount = 0,
  exchangeRate = 0,
  offlineQueueCount = 0,
  isCollapsed,
  setIsCollapsed,
}) {
  const { activeCashier, lockPos, logout, session, user } = useAuth();
  const { canAccessRoute, isAdmin } = useAuthRole();
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

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

  const allNavItems = NAVIGATION_SCHEMA.map((item) => {
    let badge = null;
    if (item.badgeKey === 'cartCount' && cartCount > 0) {
      badge = cartCount;
    } else if (item.badgeKey === 'onlineOrdersCount') {
      badge = onlineOrdersCount > 0 ? onlineOrdersCount : null;
    } else if (item.id === 'history' || item.badgeKey === 'transactionsCount') {
      // ONLY show unread/new orders count, NEVER the total count of all orders
      badge = unreadOrdersCount > 0 ? unreadOrdersCount : null;
    }
    return {
      ...item,
      badge,
    };
  });

  // RBAC: Filter navigation items based on current active cashier role
  const visibleNavItems = allNavItems.filter((item) => canAccessRoute(item.id));

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

  const cashierInitial = activeCashier?.full_name?.charAt(0) || 'U';
  const cashierDisplayName = activeCashier?.full_name || 'Staff';
  const isCashierAdmin = activeCashier?.role === 'admin';

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
                : 'py-3.5 px-4 justify-between'
            }`}
          >
            {collapsed ? (
              <div
                className="w-10 h-10 flex items-center justify-center shrink-0 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                onClick={() => setActiveMainTab('pos')}
                title="MeiiShop POS"
              >
                <img
                  src="/logo.svg"
                  alt="MeiiShop POS"
                  className="w-10 h-10 object-contain drop-shadow-xs"
                />
              </div>
            ) : (
              <div
                className="flex items-center cursor-pointer transition-transform active:scale-98"
                onClick={() => setActiveMainTab('pos')}
                title="MeiiShop POS & Retail System"
              >
                <img
                  src="/logo-text.svg"
                  alt="MeiiShop POS & Retail System"
                  className="h-11 sm:h-12 w-auto max-w-[215px] object-contain drop-shadow-xs"
                />
              </div>
            )}
          </div>

          {/* Navigation Items List */}
          <nav className="p-1.5 space-y-0.5 mt-0.5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMainTab === item.id;
              const hasBadge = item.badge !== null && item.badge !== undefined && item.badge > 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    playUnitChangeBeep('sidebar');
                    setActiveMainTab(item.id);
                  }}
                  className={`relative flex items-center rounded-xl transition-all duration-150 cursor-pointer group ${
                    collapsed
                      ? 'w-12 h-12 mx-auto justify-center'
                      : 'w-full px-3 py-2 justify-between'
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
                    <div className="relative inline-flex items-center justify-center shrink-0">
                      <Icon size={20}
                        weight="bold"
                        className={`shrink-0 transition-colors ${
                          isActive
                            ? 'text-teal-700'
                            : 'text-slate-500 group-hover:text-slate-800'
                        }`}
                      />

                      {/* Collapsed Badge: Anchored with breathing room clearing icon strokes */}
                      {collapsed && hasBadge && (
                        <span className="absolute -top-2.5 -right-3.5 translate-x-1 -translate-y-0.3 z-10 flex items-center justify-center pointer-events-none">
                          {item.id === 'history' && (
                            <span
                              className="absolute inset-0 rounded-full bg-red-600 opacity-50 animate-ping"
                              style={{ animationDuration: '3s' }}
                            />
                          )}
                          <span
                            className={`relative flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full text-[10px] font-black font-sans tabular-nums leading-none text-white ring-2 ring-white ${
                              item.id === 'history'
                                ? 'bg-gradient-to-tr from-red-700 via-red-600 to-red-500 shadow-[0_2px_8px_rgba(220,38,38,0.45)]'
                                : 'bg-gradient-to-tr from-teal-600 to-emerald-500 shadow-[0_2px_8px_rgba(13,148,136,0.35)]'
                            }`}
                          >
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        </span>
                      )}
                    </div>

                    {!collapsed && (
                      <span
                        className={`text-[13px] truncate ${
                          isActive ? 'text-teal-800 font-bold' : 'text-slate-700 font-medium group-hover:text-slate-900'
                        }`}
                      >
                        {item.label}
                      </span>
                    )}
                  </div>

                  {/* Expanded Badge: Sleek capsule pill with slow pulse dot */}
                  {!collapsed && hasBadge && (
                    <div
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-black font-sans tabular-nums tracking-tight text-white shrink-0 shadow-xs ${
                        item.id === 'history'
                          ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-[0_2px_8px_rgba(220,38,38,0.35)]'
                          : 'bg-gradient-to-r from-teal-600 to-emerald-500 shadow-[0_2px_8px_rgba(13,148,136,0.3)]'
                      }`}
                    >
                      {item.id === 'history' && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"
                          style={{ animationDuration: '2.5s' }}
                        />
                      )}
                      <span>{item.badge > 99 ? '99+' : item.badge}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Area: Controls, Active Cashier Card, Rate, Sync & Collapse Button */}
        <div className="p-2 border-t border-slate-200/90 flex flex-col gap-1.5 bg-slate-50/50">
          {!collapsed ? (
            <>
              {/* Active Cashier Shift Card */}
              <div className="p-2.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 shadow-xs text-white ${
                        isCashierAdmin
                          ? 'bg-gradient-to-tr from-amber-600 to-amber-500'
                          : 'bg-gradient-to-tr from-teal-600 to-emerald-500'
                      }`}
                    >
                      {cashierInitial}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 truncate">
                        {cashierDisplayName}
                      </div>
                      <div className="text-[10px] text-teal-700 font-bold font-mono">
                        {isCashierAdmin ? 'ຜູ້ຈັດການ (Admin)' : 'ພະນັກງານຂາຍ'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSwitchModalOpen(true)}
                    className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 text-[10.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95"
                    title="ປ່ຽນກະຂາຍເຄື່ອງ (Switch Shift)"
                  >
                    <UserSwitch size={12} weight="bold" />
                    <span>ປ່ຽນກະ</span>
                  </button>
                  <button
                    type="button"
                    onClick={lockPos}
                    className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 text-[10.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95"
                    title="ລັອກໜ້າຈໍ POS (Lock Screen)"
                  >
                    <Lock size={12} weight="bold" />
                    <span>ລັອກ</span>
                  </button>
                </div>
              </div>

              {/* Cloud / Offline Sync Status Widget */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-white rounded-xl border border-slate-200/80 text-xs shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                  {isCloudSynced && offlineQueueCount === 0 ? (
                    <CloudCheck size={16} className="text-emerald-500" weight="bold" />
                  ) : (
                    <CloudSlash size={16} className="text-amber-500" weight="bold" />
                  )}
                  <span className="text-[11px]">ສະຖານະ:</span>
                </div>
                {offlineQueueCount > 0 ? (
                  <span className="font-bold text-[10.5px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>ລໍຖ້າ {offlineQueueCount} ບິນ</span>
                  </span>
                ) : isCloudSynced ? (
                  <span className="font-bold text-[10.5px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
                    ອອນລາຍ
                  </span>
                ) : (
                  <span className="font-bold text-[10.5px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200">
                    ອອບລາຍ
                  </span>
                )}
              </div>

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
              {/* Cashier Shift Avatar in collapsed mode */}
              <button
                type="button"
                onClick={() => setIsSwitchModalOpen(true)}
                className="w-10 h-10 rounded-xl bg-teal-600 text-white font-black text-xs flex items-center justify-center relative shadow-xs cursor-pointer active:scale-95 transition-transform"
                title={`ຜູ້ຂາຍ: ${cashierDisplayName} • ກົດເພື່ອປ່ຽນກະ`}
              >
                <span>{cashierInitial}</span>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-[8px] text-teal-400">
                  <UserSwitch size={9} weight="bold" />
                </span>
              </button>

              {/* Cloud Sync Status Icon in collapsed mode */}
              <div
                className="flex flex-col items-center justify-center py-1 cursor-pointer"
                onClick={toggleCollapsed}
                title={offlineQueueCount > 0 ? `ລໍຖ້າຊິ້ງ ${offlineQueueCount} ບິນ` : (isCloudSynced ? 'ເຊື່ອມຕໍ່ Cloud ແລ້ວ' : 'ໂໝດອອບລາຍ')}
              >
                {offlineQueueCount > 0 ? (
                  <div className="relative">
                    <CloudSlash size={20} className="text-amber-500" weight="bold" />
                    <span className="absolute -top-1 -right-2 px-1 rounded-full bg-amber-500 text-white text-[8px] font-black">
                      {offlineQueueCount}
                    </span>
                  </div>
                ) : isCloudSynced ? (
                  <CloudCheck size={20} className="text-emerald-500" weight="bold" />
                ) : (
                  <CloudSlash size={20} className="text-rose-500" weight="bold" />
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

      {/* 2. MOBILE: 5-Button Bottom Navigation Bar with Bottom Sheet */}
      {(() => {
        const primaryMobileIds = ['pos', 'history', 'products', 'purchases'];
        const primaryMobileNavItems = primaryMobileIds
          .map((id) => visibleNavItems.find((item) => item.id === id))
          .filter(Boolean);

        const moreNavItems = visibleNavItems.filter((item) => !primaryMobileIds.includes(item.id));
        const isMoreActive = !primaryMobileIds.includes(activeMainTab);
        const moreHasBadge = moreNavItems.some(
          (item) => item.badge !== null && item.badge !== undefined && item.badge > 0
        );

        return (
          <>
            <nav
              className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/98 backdrop-blur-md border-t border-slate-200 flex items-stretch justify-around px-1 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] select-none"
              style={{
                paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom, 0px))',
              }}
            >
              {/* Buttons 1-4: Primary Tabs (POS, History, Products, Purchases) */}
              {primaryMobileNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeMainTab === item.id;
                const hasBadge = item.badge !== null && item.badge !== undefined && item.badge > 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      playUnitChangeBeep('sidebar');
                      setIsMoreMenuOpen(false);
                      setActiveMainTab(item.id);
                    }}
                    className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 gap-0.5 transition-all relative cursor-pointer active:scale-95 select-none ${
                      isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {/* Top Neon Line Indicator */}
                    <div
                      className={`h-[3px] w-8 sm:w-10 rounded-full transition-all duration-200 ${
                        isActive
                          ? 'bg-emerald-600 shadow-[0_1px_8px_rgba(5,150,105,0.6)]'
                          : 'bg-transparent'
                      }`}
                    />

                    {/* Icon with potential badge */}
                    <div className="relative inline-flex items-center justify-center mt-0.5">
                      <Icon size={22} weight={isActive ? 'bold' : 'regular'} />
                      {hasBadge && (
                        <span className="absolute -top-1.5 -right-2.5 z-10 flex items-center justify-center pointer-events-none">
                          {item.id === 'history' && (
                            <span
                              className="absolute inset-0 rounded-full bg-red-600 opacity-50 animate-ping"
                              style={{ animationDuration: '3s' }}
                            />
                          )}
                          <span
                            className={`relative flex items-center justify-center h-[16px] min-w-[16px] px-1 rounded-full text-[9px] font-black font-sans tabular-nums leading-none text-white ring-2 ring-white ${
                              item.id === 'history'
                                ? 'bg-gradient-to-tr from-red-700 via-red-600 to-red-500 shadow-xs'
                                : 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-xs'
                            }`}
                          >
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Short Label */}
                    <span
                      className={`text-[10px] sm:text-[10.5px] truncate max-w-full leading-tight font-sans tracking-tight ${
                        isActive ? 'text-emerald-700 font-extrabold' : 'text-slate-500 font-medium'
                      }`}
                    >
                      {item.shortLabel}
                    </span>
                  </button>
                );
              })}

              {/* Button 5: ເພີ່ມເຕີມ (More Menu Trigger) with Green Dot Notification & Top Neon Line when active */}
              <button
                type="button"
                onClick={() => {
                  playUnitChangeBeep('sidebar');
                  setIsMoreMenuOpen(!isMoreMenuOpen);
                }}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 gap-0.5 transition-all relative cursor-pointer active:scale-95 select-none ${
                  isMoreActive || isMoreMenuOpen
                    ? 'text-emerald-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {/* Top Neon Line Indicator */}
                <div
                  className={`h-[3px] w-8 sm:w-10 rounded-full transition-all duration-200 ${
                    isMoreActive || isMoreMenuOpen
                      ? 'bg-emerald-600 shadow-[0_1px_8px_rgba(5,150,105,0.6)]'
                      : 'bg-transparent'
                  }`}
                />

                {/* Icon with Green Dot Badge */}
                <div className="relative inline-flex items-center justify-center mt-0.5">
                  <SquaresFour size={22} weight={isMoreActive || isMoreMenuOpen ? 'bold' : 'regular'} />
                  {moreHasBadge && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
                  )}
                </div>

                {/* Short Label */}
                <span
                  className={`text-[10px] sm:text-[10.5px] truncate max-w-full leading-tight font-sans tracking-tight ${
                    isMoreActive || isMoreMenuOpen ? 'text-emerald-700 font-extrabold' : 'text-slate-500 font-medium'
                  }`}
                >
                  ເພີ່ມເຕີມ
                </span>
              </button>
            </nav>

            {/* 30-40% Height Bottom Sheet for More Menu */}
            {isMoreMenuOpen && (
              <div
                className="md:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex flex-col justify-end animate-in fade-in duration-150"
                onClick={() => setIsMoreMenuOpen(false)}
              >
                <div
                  className="bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 w-full max-h-[45vh] min-h-[30vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 pb-safe"
                  style={{
                    paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Drag Handle Indicator */}
                  <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

                  {/* Sheet Header */}
                  <div className="px-4 py-2 flex items-center justify-between border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2">
                      <SquaresFour size={18} weight="bold" className="text-teal-600" />
                      <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                        ເມນູເພີ່ມເຕີມ (More Menu)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMoreMenuOpen(false)}
                      className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X size={15} weight="bold" />
                    </button>
                  </div>

                  {/* Grid of Remaining Navigation Items */}
                  <div className="flex-1 overflow-y-auto p-3.5 grid grid-cols-3 gap-2 min-h-0">
                    {moreNavItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeMainTab === item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            playUnitChangeBeep('sidebar');
                            setActiveMainTab(item.id);
                            setIsMoreMenuOpen(false);
                          }}
                          className={`p-2 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all text-center border cursor-pointer active:scale-95 ${
                            isActive
                              ? 'bg-teal-50 border-teal-300 text-teal-800 shadow-2xs font-bold'
                              : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200/80 text-slate-700 font-medium'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isActive ? 'bg-teal-600 text-white shadow-2xs' : 'bg-white text-slate-600 shadow-2xs'
                            }`}
                          >
                            <Icon size={18} weight="bold" />
                          </div>
                          <span className="text-[11px] leading-tight truncate max-w-full font-bold">
                            {item.shortLabel || item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Shift, Lock & Logout Footer */}
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-teal-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                        {cashierInitial}
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 truncate">
                        {cashierDisplayName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          setIsSwitchModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 text-[10.5px] font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                      >
                        ປ່ຽນກະ
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          lockPos();
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 text-[10.5px] font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                      >
                        ລັອກ
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          setIsLogoutConfirmOpen(true);
                        }}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 text-[10.5px] font-bold rounded-lg border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                        title="ອອກຈາກລະບົບ (Logout)"
                      >
                        <SignOut size={13} weight="bold" />
                        <span>ອອກ</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Cashier Shift Switch Modal */}
      <CashierSwitchModal
        isOpen={isSwitchModalOpen}
        onClose={() => setIsSwitchModalOpen(false)}
        onOpenLogin={() => {
          setIsSwitchModalOpen(false);
          setIsLoginModalOpen(true);
        }}
      />

      {/* Supabase Cloud Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {/* Logout Confirmation Dialog */}
      <ConfirmDialogModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={async () => {
          setIsLogoutConfirmOpen(false);
          await logout();
        }}
        type="danger"
        title="ອອກຈາກລະບົບ (Logout)"
        message="ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການອອກຈາກລະບົບ? ລະບົບຈະກັບຄືນສູ່ໜ້າຈໍ Login."
        confirmText="ອອກຈາກລະບົບ"
        cancelText="ຍົກເລີກ"
        isConfirm={true}
      />
    </>
  );
}
