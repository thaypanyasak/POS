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
  CurrencyCircleDollar,
  CloudCheck,
  CloudSlash,
  Users,
  UserSwitch,
  Lock,
  ShieldCheck,
  SignOut,
  SignIn,
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
  exchangeRate = 0,
  isCollapsed,
  setIsCollapsed,
}) {
  const { activeCashier, lockPos, logout, session, user } = useAuth();
  const { canAccessRoute, isAdmin } = useAuthRole();
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

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
          <nav className="p-2.5 space-y-1.5 mt-1">
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
                    <div className="relative inline-flex items-center justify-center shrink-0">
                      <Icon
                        size={22}
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
                      <div className="text-left min-w-0 overflow-hidden">
                        <div
                          className={`text-xs truncate ${
                            isActive ? 'text-teal-800 font-black' : 'text-slate-800'
                          }`}
                        >
                          {item.label}
                        </div>
                        <div className="text-[10.5px] text-slate-400 font-normal truncate mt-0.5">
                          {item.sub}
                        </div>
                      </div>
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
        <div className="p-2.5 border-t border-slate-200/90 flex flex-col gap-2 bg-slate-50/50">
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

                <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSwitchModalOpen(true)}
                    className="py-1 px-1 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95"
                    title="ປ່ຽນກະຂາຍເຄື່ອງ (Switch Shift)"
                  >
                    <UserSwitch size={12} weight="bold" />
                    <span>ປ່ຽນກະ</span>
                  </button>
                  <button
                    type="button"
                    onClick={lockPos}
                    className="py-1 px-1 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95"
                    title="ລັອກໜ້າຈໍ POS (Lock Screen)"
                  >
                    <Lock size={12} weight="bold" />
                    <span>ລັອກ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLogoutConfirmOpen(true)}
                    className="py-1 px-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95 border border-rose-200"
                    title="ອອກຈາກລະບົບ (Logout)"
                  >
                    <SignOut size={12} weight="bold" />
                    <span>ອອກ</span>
                  </button>
                </div>
              </div>

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

              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(true)}
                className="w-10 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs border border-rose-200"
                title="ອອກຈາກລະບົບ (Logout)"
              >
                <SignOut size={13} weight="bold" />
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
              className={`flex-1 py-1 px-0.5 rounded-xl flex flex-col items-center justify-center transition-all relative min-h-[48px] active:scale-95 cursor-pointer ${
                isActive
                  ? 'text-teal-700'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative inline-flex items-center justify-center">
                <Icon size={22} weight={isActive ? 'bold' : 'bold'} />
                {hasBadge && (
                  <span className="absolute -top-2.5 -right-3.5 translate-x-1 -translate-y-0.5 z-10 flex items-center justify-center pointer-events-none">
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

        {/* Mobile Cashier Quick Shift / Lock button */}
        <button
          type="button"
          onClick={() => setIsSwitchModalOpen(true)}
          className="flex-1 py-1 px-0.5 rounded-xl flex flex-col items-center justify-center transition-all text-slate-500 hover:text-teal-700 min-h-[48px] active:scale-95 cursor-pointer"
          title={`ຜູ້ຂາຍ: ${cashierDisplayName} • ປ່ຽນກະ`}
        >
          <div className="w-5 h-5 rounded-full bg-teal-600 text-white font-black text-[10px] flex items-center justify-center shadow-2xs">
            {cashierInitial}
          </div>
          <span className="text-[10px] mt-0.5 truncate leading-tight font-bold text-teal-800">
            {cashierDisplayName.split(' ')[0]}
          </span>
        </button>
      </nav>

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
