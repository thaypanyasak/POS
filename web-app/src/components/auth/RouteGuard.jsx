import React from 'react';
import { ShieldWarning, ArrowLeft, LockKey } from '@phosphor-icons/react';
import { useAuthRole } from '../../contexts/AuthContext';
import { USER_ROLES } from '../../config/navigationSchema';

/**
 * RouteGuard Component (Defense-in-Depth Layer 2)
 * Wraps sensitive views to prevent unauthorized rendering even if URL or state is manipulated.
 */
export default function RouteGuard({
  children,
  routeId,
  requiredRoles = [USER_ROLES.ADMIN],
  fallbackRoute = 'pos',
  onRedirect,
}) {
  const { role, isAdmin, canAccessRoute } = useAuthRole();

  const isAuthorized = routeId
    ? canAccessRoute(routeId)
    : (requiredRoles.includes(role) || isAdmin);

  if (isAuthorized) {
    return <>{children}</>;
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-8 min-h-[500px]">
      <div className="max-w-md w-full bg-white rounded-3xl border border-rose-200/80 shadow-xl p-6 sm:p-8 text-center animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-inner">
          <ShieldWarning size={36} weight="fill" className="text-rose-600" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black uppercase tracking-wider mb-2">
          <LockKey size={13} weight="bold" />
          <span>ຈຳກັດສິດການເຂົ້າເຖິງ • Access Denied</span>
        </div>

        <h3 className="text-lg font-black text-slate-900 tracking-tight mt-1 mb-2">
          ສະຫງວນສິດສະເພາະຜູ້ຈັດການ (Admin Only)
        </h3>

        <p className="text-xs text-slate-500 leading-relaxed mb-6">
          ບັນຊີປະຈຸບັນຂອງທ່ານແມ່ນ <strong className="text-slate-800">ພະນັກງານຂາຍ (Cashier)</strong>. 
          ທ່ານບໍ່ມີສິດເຂົ້າເຖິງລາຍງານ, ຂໍ້ມູນຕົ້ນທຶນ ຫຼື ການຕັ້ງຄ່າລະບົບນີ້.
        </p>

        <button
          type="button"
          onClick={() => {
            if (onRedirect) {
              onRedirect(fallbackRoute);
            } else if (typeof window !== 'undefined') {
              window.location.hash = '#' + fallbackRoute;
            }
          }}
          className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer shadow-md"
        >
          <ArrowLeft size={16} weight="bold" />
          <span>ກັບຄືນໜ້າຂາຍ (Back to POS)</span>
        </button>
      </div>
    </div>
  );
}
