import { fetchStoreSetting, updateStoreSetting } from './supabase';
import { DEFAULT_ROLE_PERMISSIONS, USER_ROLES } from '../config/navigationSchema';

const PERMISSIONS_STORAGE_KEY = 'role_permissions';
const ROLES_STORAGE_KEY = 'app_roles_v1';

const EVENT_PERMISSIONS_CHANGED = 'meiishop:permissions-updated';
const EVENT_ROLES_CHANGED = 'meiishop:roles-updated';

/**
 * Standard System Roles
 */
export const DEFAULT_ROLES = [
  {
    id: 'admin',
    name: 'ຜູ້ຈັດການ (Admin)',
    description: 'ມີສິດຄຸ້ມຄອງເຕັມທຸກໜ້າ ແລະ ຕັ້ງຄ່າລະບົບ',
    isSystem: true,
    badgeColor: 'amber',
  },
  {
    id: 'cashier',
    name: 'ພະນັກງານຂາຍ (Cashier)',
    description: 'ຂາຍໜ້າຮ້ານ, ເບິ່ງສິນຄ້າ ແລະ ປະຫວັດການຂາຍ',
    isSystem: true,
    badgeColor: 'teal',
  },
];

/**
 * Fetch all available roles (System Roles + Custom Created Roles)
 * @returns {Promise<Array>} List of role objects
 */
export async function getAppRoles() {
  try {
    const roles = await fetchStoreSetting(ROLES_STORAGE_KEY, DEFAULT_ROLES);

    if (Array.isArray(roles) && roles.length > 0) {
      // Ensure system roles (admin, cashier) are always present
      const hasAdmin = roles.some((r) => r.id === 'admin');
      const hasCashier = roles.some((r) => r.id === 'cashier');
      
      const merged = [...roles];
      if (!hasAdmin) merged.unshift(DEFAULT_ROLES[0]);
      if (!hasCashier) merged.splice(1, 0, DEFAULT_ROLES[1]);
      return merged;
    }

    return DEFAULT_ROLES;
  } catch (err) {
    console.warn('[permissionService] getAppRoles exception, using default:', err);
    return DEFAULT_ROLES;
  }
}

/**
 * Save updated roles list to Cloud & Local Storage
 * @param {Array} rolesList
 */
export async function saveAppRoles(rolesList) {
  try {
    if (!Array.isArray(rolesList)) {
      return { success: false, error: 'Invalid roles array' };
    }

    const res = await updateStoreSetting(ROLES_STORAGE_KEY, rolesList);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(EVENT_ROLES_CHANGED, { detail: rolesList })
      );
    }

    return res;
  } catch (err) {
    console.error('[permissionService] saveAppRoles exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get current role permissions for all roles (Offline-first with Supabase cloud sync)
 * @returns {Promise<Object>} Map of roleId -> string[]
 */
export async function getRolePermissions() {
  try {
    const permissions = await fetchStoreSetting(
      PERMISSIONS_STORAGE_KEY,
      DEFAULT_ROLE_PERMISSIONS
    );

    if (permissions && typeof permissions === 'object') {
      // Ensure admin & cashier defaults are present
      return {
        ...DEFAULT_ROLE_PERMISSIONS,
        ...permissions,
        [USER_ROLES.ADMIN]: permissions[USER_ROLES.ADMIN] || DEFAULT_ROLE_PERMISSIONS[USER_ROLES.ADMIN],
        [USER_ROLES.CASHIER]: permissions[USER_ROLES.CASHIER] || DEFAULT_ROLE_PERMISSIONS[USER_ROLES.CASHIER],
      };
    }

    return DEFAULT_ROLE_PERMISSIONS;
  } catch (err) {
    console.warn('[permissionService] getRolePermissions exception, using default:', err);
    return DEFAULT_ROLE_PERMISSIONS;
  }
}

/**
 * Save updated role permissions to Cloud & Local Storage
 * @param {Object} newPermissions - Map of roleId -> string[]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function saveRolePermissions(newPermissions) {
  try {
    if (!newPermissions || typeof newPermissions !== 'object') {
      return { success: false, error: 'Invalid permissions payload' };
    }

    // Safeguard: Ensure Admin always has access to POS & Staff Management to prevent lockout
    const adminPerms = new Set(newPermissions[USER_ROLES.ADMIN] || []);
    adminPerms.add('pos');
    adminPerms.add('staff-management');

    const sanitized = {
      ...newPermissions,
      [USER_ROLES.ADMIN]: Array.from(adminPerms),
      [USER_ROLES.CASHIER]: Array.isArray(newPermissions[USER_ROLES.CASHIER])
        ? newPermissions[USER_ROLES.CASHIER]
        : DEFAULT_ROLE_PERMISSIONS[USER_ROLES.CASHIER],
    };

    const res = await updateStoreSetting(PERMISSIONS_STORAGE_KEY, sanitized);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(EVENT_PERMISSIONS_CHANGED, { detail: sanitized })
      );
    }

    return res;
  } catch (err) {
    console.error('[permissionService] saveRolePermissions exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Create a new custom role with custom permissions
 * @param {Object} param0 { id, name, description, permissions }
 */
export async function addCustomRole({ id, name, description = '', permissions = ['pos'] }) {
  try {
    const cleanId = String(id || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_');

    if (!cleanId) {
      return { success: false, error: 'ລະຫັດບົດບາດ (Role ID) ບໍ່ຖືກຕ້ອງ' };
    }
    if (!name?.trim()) {
      return { success: false, error: 'ກະລຸນາປ້ອນຊື່ບົດບາດ (Role Name)' };
    }

    const currentRoles = await getAppRoles();
    if (currentRoles.some((r) => r.id === cleanId)) {
      return { success: false, error: `ບົດບາດລະຫັດ "${cleanId}" ມີຢູ່ແລ້ວໃນລະບົບ!` };
    }

    const newRoleObj = {
      id: cleanId,
      name: name.trim(),
      description: description.trim(),
      isSystem: false,
      badgeColor: 'sky',
      createdAt: new Date().toISOString(),
    };

    const updatedRoles = [...currentRoles, newRoleObj];
    await saveAppRoles(updatedRoles);

    // Save permissions for this new role
    const currentPerms = await getRolePermissions();
    const updatedPerms = {
      ...currentPerms,
      [cleanId]: Array.isArray(permissions) ? permissions : ['pos'],
    };
    await saveRolePermissions(updatedPerms);

    return { success: true, role: newRoleObj };
  } catch (err) {
    console.error('[permissionService] addCustomRole error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a custom role (Cannot delete system roles: admin, cashier)
 */
export async function deleteCustomRole(roleId) {
  try {
    if (roleId === 'admin' || roleId === 'cashier') {
      return { success: false, error: 'ບໍ່ສາມາດລຶບບົດບາດລະບົບ (Admin, Cashier) ໄດ້' };
    }

    const currentRoles = await getAppRoles();
    const filteredRoles = currentRoles.filter((r) => r.id !== roleId);
    await saveAppRoles(filteredRoles);

    const currentPerms = await getRolePermissions();
    const updatedPerms = { ...currentPerms };
    delete updatedPerms[roleId];
    await saveRolePermissions(updatedPerms);

    return { success: true };
  } catch (err) {
    console.error('[permissionService] deleteCustomRole error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Reset permissions back to factory defaults
 */
export async function resetRolePermissionsToDefault() {
  return await saveRolePermissions(DEFAULT_ROLE_PERMISSIONS);
}

/**
 * Subscribe to permission changes in real-time
 */
export function onPermissionsChange(callback) {
  if (typeof window === 'undefined') return () => {};

  const handler = (event) => {
    if (event?.detail) {
      callback(event.detail);
    }
  };

  window.addEventListener(EVENT_PERMISSIONS_CHANGED, handler);
  return () => window.removeEventListener(EVENT_PERMISSIONS_CHANGED, handler);
}

/**
 * Subscribe to role list changes in real-time
 */
export function onRolesChange(callback) {
  if (typeof window === 'undefined') return () => {};

  const handler = (event) => {
    if (event?.detail) {
      callback(event.detail);
    }
  };

  window.addEventListener(EVENT_ROLES_CHANGED, handler);
  return () => window.removeEventListener(EVENT_ROLES_CHANGED, handler);
}
