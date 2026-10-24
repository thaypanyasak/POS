import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import {
  fetchActiveCashiers,
  verifyCashierPin,
  findCashierByPin,
  onStaffListChange,
} from '../services/staffService';
import {
  getActiveCashierLocal,
  saveActiveCashierLocal,
  getPosLockStatusLocal,
  savePosLockStatusLocal,
} from '../services/authStorage';
import { playSuccessBeep, playErrorBeep } from '../utils/audioFeedback';
import { isRouteAllowed, USER_ROLES, DEFAULT_ROLE_PERMISSIONS } from '../config/navigationSchema';
import {
  getRolePermissions,
  saveRolePermissions,
  onPermissionsChange,
  resetRolePermissionsToDefault,
  getAppRoles,
  addCustomRole,
  deleteCustomRole,
  onRolesChange,
  DEFAULT_ROLES,
} from '../services/permissionService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeCashier, setActiveCashierState] = useState(null);
  const [isLocked, setIsLockedState] = useState(false);
  const [activeCashiersList, setActiveCashiersList] = useState([]);
  const [rolesList, setRolesList] = useState(DEFAULT_ROLES);
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_ROLE_PERMISSIONS);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch user profile from Supabase profiles table
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[AuthContext] Profile fetch notice:', error.message);
      }

      if (data) {
        setProfile(data);
        return data;
      }

      setProfile(null);
      return null;
    } catch (e) {
      console.warn('[AuthContext] fetchProfile exception:', e);
      return null;
    }
  }, []);

  // 2. Refresh active cashiers list
  const refreshStaffList = useCallback(async () => {
    const { data } = await fetchActiveCashiers();
    if (data && data.length > 0) {
      setActiveCashiersList(data);
    }
  }, []);

  // 3. Initialize Auth & Session persistence
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        setIsLoading(true);

        // Check lock status
        const locked = await getPosLockStatusLocal();
        if (isMounted) setIsLockedState(locked);

        // Check active cashier
        const savedCashier = await getActiveCashierLocal();
        if (isMounted && savedCashier) {
          setActiveCashierState(savedCashier);
        }

        // Get initial Supabase session
        const { data: { session: initSession } } = await supabase.auth.getSession();
        if (isMounted) {
          setSession(initSession);
          setUser(initSession?.user || null);
          if (initSession?.user) {
            const prof = await fetchProfile(initSession.user.id);
            if (!savedCashier && prof) {
              const defaultCashier = {
                id: prof.id,
                full_name: prof.full_name,
                role: prof.role,
              };
              setActiveCashierState(defaultCashier);
              await saveActiveCashierLocal(defaultCashier);
            }
          }
        }

        await refreshStaffList();

        // Fetch dynamic roles & permissions from cloud/local storage
        const [loadedRoles, perms] = await Promise.all([
          getAppRoles(),
          getRolePermissions(),
        ]);

        if (isMounted) {
          if (loadedRoles) setRolesList(loadedRoles);
          if (perms) setRolePermissions(perms);
        }
      } catch (err) {
        console.error('[AuthContext] initAuth error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initAuth();

    // Listen to permission changes broadcast
    const unbindPerms = onPermissionsChange((newPerms) => {
      if (isMounted && newPerms) {
        setRolePermissions(newPerms);
      }
    });

    // Listen to staff list broadcast
    const unbindStaff = onStaffListChange((newStaffList) => {
      if (isMounted && Array.isArray(newStaffList)) {
        setActiveCashiersList(newStaffList.filter((s) => s.is_active !== false));
      }
    });

    // Listen to roles list broadcast
    const unbindRoles = onRolesChange((newRoles) => {
      if (isMounted && newRoles) {
        setRolesList(newRoles);
      }
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user || null);

      if (event === 'SIGNED_IN' && newSession?.user) {
        const prof = await fetchProfile(newSession.user.id);
        const cashier = {
          id: prof?.id || newSession.user.id,
          full_name: prof?.full_name || newSession.user.user_metadata?.full_name || newSession.user.email?.split('@')[0] || 'Admin',
          role: prof?.role || newSession.user.user_metadata?.role || 'admin',
        };
        setActiveCashierState(cashier);
        await saveActiveCashierLocal(cashier);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
      unbindPerms?.();
      unbindRoles?.();
      unbindStaff?.();
    };
  }, [fetchProfile, refreshStaffList]);

  // Login handler
  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        playErrorBeep();
        return { success: false, error: error.message };
      }

      localStorage.removeItem('meiishop_pos_logged_out');
      playSuccessBeep();
      return { success: true, user: data.user };
    } catch (err) {
      playErrorBeep();
      return { success: false, error: err.message };
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      localStorage.setItem('meiishop_pos_logged_out', 'true');
      await supabase.auth.signOut();
      await saveActiveCashierLocal(null);
      await savePosLockStatusLocal(false);
      setSession(null);
      setUser(null);
      setProfile(null);
      setActiveCashierState(null);
      setIsLockedState(false);
      playSuccessBeep();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Lock POS screen
  const lockPos = async () => {
    setIsLockedState(true);
    await savePosLockStatusLocal(true);
  };

  // Unlock POS without PIN (Close lock screen)
  const unlockPos = async () => {
    setIsLockedState(false);
    await savePosLockStatusLocal(false);
  };

  // Unlock POS with PIN
  const unlockWithPin = async (inputPin) => {
    // 1. Try active cashier's PIN
    if (activeCashier?.id) {
      const res = await verifyCashierPin(activeCashier.id, inputPin);
      if (res.success) {
        localStorage.removeItem('meiishop_pos_logged_out');
        setIsLockedState(false);
        await savePosLockStatusLocal(false);
        playSuccessBeep();
        return { success: true };
      }
    }

    // 2. Try any active staff PIN (if someone else wants to take over)
    const resAny = await findCashierByPin(inputPin);
    if (resAny.success && resAny.staff) {
      localStorage.removeItem('meiishop_pos_logged_out');
      setActiveCashierState(resAny.staff);
      await saveActiveCashierLocal(resAny.staff);
      setIsLockedState(false);
      await savePosLockStatusLocal(false);
      playSuccessBeep();
      return { success: true, switchedTo: resAny.staff };
    }

    playErrorBeep();
    return { success: false, error: 'ລະຫັດ PIN ບໍ່ຖືກຕ້ອງ!' };
  };

  // Quick switch cashier by selecting staff and entering PIN
  const switchCashier = async (staffId, inputPin) => {
    const res = await verifyCashierPin(staffId, inputPin);
    if (res.success && res.staff) {
      localStorage.removeItem('meiishop_pos_logged_out');
      setActiveCashierState(res.staff);
      await saveActiveCashierLocal(res.staff);
      setIsLockedState(false);
      await savePosLockStatusLocal(false);
      playSuccessBeep();
      return { success: true, staff: res.staff };
    }
    playErrorBeep();
    return { success: false, error: res.error || 'ລະຫັດ PIN ບໍ່ຖືກຕ້ອງ!' };
  };

  // Quick switch cashier directly by 4-digit PIN alone
  const quickSwitchByPin = async (inputPin) => {
    const res = await findCashierByPin(inputPin);
    if (res.success && res.staff) {
      setActiveCashierState(res.staff);
      await saveActiveCashierLocal(res.staff);
      setIsLockedState(false);
      await savePosLockStatusLocal(false);
      playSuccessBeep();
      return { success: true, staff: res.staff };
    }
    playErrorBeep();
    return { success: false, error: res.error || 'ລະຫັດ PIN ບໍ່ຖືກຕ້ອງ!' };
  };

  // Role calculation: active cashier role takes precedence when on duty
  const role = useMemo(() => {
    return activeCashier?.role || profile?.role || 'admin';
  }, [activeCashier, profile]);

  const isAdmin = role === 'admin';
  const isCashier = role === 'cashier';

  // Update dynamic permissions for roles
  const updateRolePermissions = async (newPerms) => {
    const res = await saveRolePermissions(newPerms);
    if (res.success) {
      setRolePermissions(newPerms);
    }
    return res;
  };

  const resetPermissions = async () => {
    const res = await resetRolePermissionsToDefault();
    if (res.success) {
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
    }
    return res;
  };

  const value = {
    session,
    user,
    profile,
    role,
    isAdmin,
    isCashier,
    activeCashier,
    isLocked,
    activeCashiersList,
    rolesList,
    rolePermissions,
    isLoading,
    login,
    logout,
    lockPos,
    unlockPos,
    unlockWithPin,
    switchCashier,
    quickSwitchByPin,
    refreshStaffList,
    updateRolePermissions,
    resetPermissions,
    createCustomRole: addCustomRole,
    deleteCustomRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * RBAC Hook to protect UI actions and tabs
 */
export function useAuthRole() {
  const { role, isAdmin, isCashier, activeCashier, rolePermissions, rolesList } = useAuth();

  const canAccessRoute = useCallback(
    (tabIdOrPath) => {
      return isRouteAllowed(tabIdOrPath, role, rolePermissions);
    },
    [role, rolePermissions]
  );

  // Module-level RBAC: Access to the module grants access to its actions (matching other modules)
  const canManageProducts = true;
  const canDeleteProduct = true;
  const canManagePurchases = true;
  const canViewReports = true;
  const canManageStaff = true;
  const canManageSettings = true;
  const canDeleteOrders = isAdmin;

  return {
    role,
    isAdmin,
    isCashier,
    activeCashier,
    rolesList,
    rolePermissions,
    canAccessRoute,
    canManageProducts,
    canDeleteProduct,
    canManagePurchases,
    canViewReports,
    canManageStaff,
    canManageSettings,
    canDeleteOrders,
    canEditCost: canManageProducts,
  };
}
