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
    const search = (window.location.search || '').toLowerCase();

    // BẢO VỆ CHÍNH XÁC: '#customers' là tab Quản lý khách hàng của Admin/POS (ຈັດການລູກຄ້າ)
    // Tuyệt đối không được nhầm với menu khách hàng
    if (
      hash === '#customers' ||
      hash.startsWith('#customers/') ||
      hash.startsWith('#customers?') ||
      path === '/customers' ||
      path.startsWith('/customers/')
    ) {
      return false;
    }

    return (
      hash === '#menu' ||
      hash.startsWith('#menu/') ||
      hash.startsWith('#menu?') ||
      hash === '#catalog' ||
      hash.startsWith('#catalog/') ||
      hash.startsWith('#catalog?') ||
      hash === '#customer-catalog' ||
      hash === '#customer-menu' ||
      path === '/menu' ||
      path.startsWith('/menu/') ||
      path === '/catalog' ||
      path.startsWith('/catalog/') ||
      search.includes('mode=customer') ||
      search.includes('view=customer') ||
      search.includes('view=menu')
    );
  } catch (_) {
    return false;
  }
}

