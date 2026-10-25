/**
 * MeiiShop POS - Centralized Navigation & RBAC Schema
 * Single Source of Truth for Route Permissions and Sidebar Navigation
 */
import {
  Storefront,
  Warehouse,
  Package,
  Receipt,
  ChartBar,
  ChartPieSlice,
  Gear,
  UsersThree,
} from '@phosphor-icons/react';

export const USER_ROLES = {
  ADMIN: 'admin',
  CASHIER: 'cashier',
};

/**
 * Route definitions with Role-Based Access Control (RBAC)
 */
export const NAVIGATION_SCHEMA = [
  {
    id: 'pos',
    path: '#pos',
    label: 'ຂາຍໜ້າຮ້ານ (POS)',
    sub: 'Terminal ຂາຍເຄື່ອງ',
    shortLabel: 'ຂາຍໜ້າຮ້ານ',
    icon: Storefront,
    allowedRoles: [USER_ROLES.ADMIN, USER_ROLES.CASHIER],
    isDefault: true,
    badgeKey: 'cartCount',
  },
  {
    id: 'history',
    path: '#history',
    label: 'ປະຫວັດບິນ',
    sub: 'ລາຍການຂາຍ & ພິມໃບບິນ',
    shortLabel: 'ປະຫວັດ',
    icon: Receipt,
    allowedRoles: [USER_ROLES.ADMIN, USER_ROLES.CASHIER],
    badgeKey: 'transactionsCount',
  },
  {
    id: 'products',
    path: '#products',
    label: 'ລາຍການສິນຄ້າ',
    sub: 'ສິນຄ້າ, ລາຄາ & ສະຕັອກ',
    shortLabel: 'ສິນຄ້າ',
    icon: Package,
    allowedRoles: [USER_ROLES.ADMIN, USER_ROLES.CASHIER],
    badgeKey: 'outOfStockCount',
  },
  {
    id: 'purchases',
    path: '#purchases',
    label: 'ຮັບສິນຄ້າເຂົ້າ (GRN)',
    sub: 'ສາງ & ໜີ້ຜູ້ສະໜອງ',
    shortLabel: 'ຮັບເຂົ້າ',
    icon: Warehouse,
    allowedRoles: [USER_ROLES.ADMIN],
    adminOnly: true,
  },
  {
    id: 'dashboard',
    path: '#dashboard',
    label: 'ລາຍງານລວມ',
    sub: 'ຍອດຂາຍ & ກຳໄລສຸດທິ',
    shortLabel: 'ລາຍງານ',
    icon: ChartBar,
    allowedRoles: [USER_ROLES.ADMIN],
    adminOnly: true,
  },
  {
    id: 'sales-by-unit',
    path: '#sales-by-unit',
    label: 'ລາຍງານແຍກໜ່ວຍ',
    sub: 'ຍອດຂາຍ ລັງ / ແພັກ / ອັນ',
    shortLabel: 'ຍອດແຍກໜ່ວຍ',
    icon: ChartPieSlice,
    allowedRoles: [USER_ROLES.ADMIN],
    adminOnly: true,
  },
  {
    id: 'staff-management',
    path: '#staff-management',
    label: 'ພະນັກງານ (Staff)',
    sub: 'ບັນຊີ, PIN & ຕຳແໜ່ງ',
    shortLabel: 'ພະນັກງານ',
    icon: UsersThree,
    allowedRoles: [USER_ROLES.ADMIN],
    adminOnly: true,
  },
  {
    id: 'settings',
    path: '#settings',
    label: 'ຕັ້ງຄ່າລະບົບ',
    sub: 'ອັດຕາແລກປ່ຽນ & ເຄື່ອງພິມ',
    shortLabel: 'ຕັ້ງຄ່າ',
    icon: Gear,
    allowedRoles: [USER_ROLES.ADMIN],
    adminOnly: true,
  },
];

export const DEFAULT_ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: [
    'pos',
    'history',
    'products',
    'purchases',
    'dashboard',
    'sales-by-unit',
    'staff-management',
    'settings',
  ],
  [USER_ROLES.CASHIER]: [
    'pos',
    'history',
    'products',
  ],
};

/**
 * Filter routes accessible by given role & dynamic permissions
 * @param {string} role - 'admin' | 'cashier'
 * @param {Object} permissionsMap - { admin: [...], cashier: [...] }
 * @returns {Array} List of allowed navigation items
 */
export function getAccessibleRoutes(role = USER_ROLES.CASHIER, permissionsMap = null) {
  const currentRole = role || USER_ROLES.CASHIER;
  
  if (permissionsMap && Array.isArray(permissionsMap[currentRole])) {
    const allowedIds = permissionsMap[currentRole];
    return NAVIGATION_SCHEMA.filter((item) => allowedIds.includes(item.id));
  }

  if (DEFAULT_ROLE_PERMISSIONS[currentRole]) {
    return NAVIGATION_SCHEMA.filter((item) => DEFAULT_ROLE_PERMISSIONS[currentRole].includes(item.id));
  }

  return NAVIGATION_SCHEMA.filter((item) => item.allowedRoles.includes(currentRole));
}

/**
 * Check if a specific tab or path is allowed for the user's role
 * @param {string} routeIdOrPath - tab ID ('pos', 'dashboard') or hash path ('#dashboard')
 * @param {string} role - 'admin' | 'cashier'
 * @param {Object} permissionsMap - { admin: [...], cashier: [...] }
 * @returns {boolean}
 */
export function isRouteAllowed(routeIdOrPath, role = USER_ROLES.CASHIER, permissionsMap = null) {
  if (!routeIdOrPath) return true;
  
  // Normalize string: strip hash or leading slash
  const cleanId = String(routeIdOrPath).replace(/^#\/?/, '').replace(/^\//, '');
  const currentRole = role || USER_ROLES.CASHIER;

  // 1. Dynamic role permissions take highest precedence
  if (permissionsMap && Array.isArray(permissionsMap[currentRole])) {
    return permissionsMap[currentRole].includes(cleanId);
  }

  // 2. Default role permissions fallback
  if (DEFAULT_ROLE_PERMISSIONS[currentRole]) {
    return DEFAULT_ROLE_PERMISSIONS[currentRole].includes(cleanId);
  }
  
  const route = NAVIGATION_SCHEMA.find(
    (item) => item.id === cleanId || item.path.replace(/^#\/?/, '') === cleanId
  );
  
  // If route is not recognized in schema, default to admin-only for safety
  if (!route) {
    return currentRole === USER_ROLES.ADMIN;
  }
  
  return route.allowedRoles.includes(currentRole);
}

/**
 * Get route definition by ID
 */
export function getRouteById(routeId) {
  const cleanId = String(routeId).replace(/^#\/?/, '').replace(/^\//, '');
  return NAVIGATION_SCHEMA.find((item) => item.id === cleanId) || null;
}

export const DEFAULT_ROUTE = 'pos';

