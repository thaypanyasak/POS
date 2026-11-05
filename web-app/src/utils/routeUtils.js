/**
 * Route Utility - Detects whether current view is the public customer storefront.
 * Used to isolate Admin / POS services (printers, transactions, customer records)
 * from public customer menu visitors.
 */
export function isCustomerStorefrontRoute() {
  if (typeof window === 'undefined') return false;
  try {
    const hash = (window.location.hash || '').toLowerCase();
    const path = (window.location.pathname || '').toLowerCase();
    return (
      hash === '#menu' ||
      hash.startsWith('#menu') ||
      hash === '#catalog' ||
      hash.startsWith('#catalog') ||
      hash === '#customer-catalog' ||
      hash === '#customer-menu' ||
      path === '/menu' ||
      path.startsWith('/menu/') ||
      path === '/catalog' ||
      path.startsWith('/catalog/')
    );
  } catch (_) {
    return false;
  }
}

