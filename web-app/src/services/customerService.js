import { supabase } from './supabase';
import { normalizeLao } from '../utils/formatters';

const STORAGE_KEY = 'meiishop_customers_v1';

export const DEFAULT_CUSTOMER = {
  id: 'default',
  name: 'ລູກຄ້າທົ່ວໄປ',
  phone: '',
  address: '',
  note: '',
  isDefault: true,
  createdAt: new Date().toISOString(),
};

/**
 * Fetch saved customer profiles from Supabase and fallback to localStorage
 */
export async function fetchSavedCustomers() {
  let localList = [];
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localList = parsed;
    }
  } catch (err) {
    console.debug('[customerService] Error reading localStorage:', err);
  }

  // Attempt to fetch from Supabase customers table if it exists
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });

    if (!error && Array.isArray(data)) {
      const remoteList = data.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        address: c.address || '',
        note: c.note || '',
        createdAt: c.created_at || c.createdAt,
      }));

      // Remote DB is the single source of truth
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteList));
      } catch (_) {}

      return remoteList;
    }
  } catch (_) {
    // Supabase table does not exist or network offline; safely fallback to localList
  }

  return localList;
}

/**
 * Save or update customer
 */
export async function saveCustomerRecord(customer) {
  if (!customer || !customer.name?.trim()) return null;

  const id = customer.id || `cust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record = {
    id,
    name: customer.name.trim(),
    phone: (customer.phone || '').trim(),
    address: (customer.address || '').trim(),
    note: (customer.note || '').trim(),
    updatedAt: new Date().toISOString(),
    createdAt: customer.createdAt || new Date().toISOString(),
  };

  // 1. Update localStorage
  try {
    const existing = await fetchSavedCustomers();
    const idx = existing.findIndex((c) => c.id === id || c.name.toLowerCase() === record.name.toLowerCase());
    let nextList;
    if (idx >= 0) {
      nextList = [...existing];
      nextList[idx] = { ...nextList[idx], ...record };
    } else {
      nextList = [record, ...existing];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
  } catch (err) {
    console.debug('[customerService] Error writing localStorage:', err);
  }

  // 2. Try Supabase upsert
  try {
    await supabase.from('customers').upsert({
      id: record.id,
      name: record.name,
      phone: record.phone || null,
      address: record.address || null,
      note: record.note || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (_) {}

  return record;
}

/**
 * Delete customer
 */
export async function deleteCustomerRecord(id) {
  if (!id) return;

  try {
    const existing = await fetchSavedCustomers();
    const nextList = existing.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
  } catch (err) {
    console.debug('[customerService] Error deleting from localStorage:', err);
  }

  try {
    await supabase.from('customers').delete().eq('id', id);
  } catch (_) {}
}

/**
 * Computes reactive customer analytics across all transactions for SAVED database customers only.
 * Only returns customers that exist in savedCustomers (from DB).
 * Links transactions primarily by customerId (foreign key), with robust fallback to customerName/phone.
 * Does NOT auto-create pseudo-customers from invoice customer names.
 */
export function buildCustomerDirectory(savedCustomers = [], transactions = []) {
  if (!Array.isArray(savedCustomers) || savedCustomers.length === 0) {
    return [];
  }

  const customerList = [];
  const customerMapById = new Map();
  const customerMapByName = new Map();
  const customerMapByPhone = new Map();

  // 1. Populate ONLY saved customer profiles from DB
  savedCustomers.forEach((c) => {
    if (!c || !c.name?.trim()) return;
    const entry = {
      ...c,
      phone: c.phone || '',
      address: c.address || '',
      note: c.note || '',
      totalOrders: 0,
      totalSpent: 0,
      currentDebt: 0,
      lastOrderDate: null,
      invoices: [],
    };

    customerList.push(entry);

    if (c.id) {
      customerMapById.set(String(c.id), entry);
    }
    const nameKey = c.name.trim().toLowerCase();
    customerMapByName.set(nameKey, entry);

    if (c.phone && c.phone.trim()) {
      customerMapByPhone.set(c.phone.trim(), entry);
    }
  });

  if (customerList.length === 0) return [];

  // 2. Process transactions reactively, accumulating stats ONLY for matching saved customers
  (transactions || []).forEach((tx) => {
    if (tx.status === 'cancelled' || tx.isCancelled) return;

    const txCustId = tx.customerId || tx.customer_id;
    const rawName = (tx.customerName || tx.customer_name || '').trim();
    const rawPhone = (tx.customerPhone || tx.customer_phone || '').trim();

    // Matching Priority:
    // 1. Match by ID (exact relational foreign key)
    // 2. Fallback to Customer Name
    // 3. Fallback to Phone number
    let entry = null;
    if (txCustId && customerMapById.has(String(txCustId))) {
      entry = customerMapById.get(String(txCustId));
    } else if (rawName && customerMapByName.has(rawName.toLowerCase())) {
      entry = customerMapByName.get(rawName.toLowerCase());
    } else if (rawPhone && customerMapByPhone.has(rawPhone)) {
      entry = customerMapByPhone.get(rawPhone);
    }

    // STRICT: If this customer is not in the saved DB list, DO NOT auto-create!
    if (!entry) return;

    if (!entry.phone && rawPhone) {
      entry.phone = rawPhone;
    }

    const total = Number(tx.grandTotal ?? tx.finalTotalKip ?? tx.totalLak ?? 0);
    const paid = Number(tx.paidAmount ?? tx.amountTendered ?? 0);
    const method = (tx.paymentMethod || '').toLowerCase();
    const status = (tx.paymentStatus || '').toUpperCase();

    let remainingDebt = Number(tx.remainingDebt ?? tx.debtAmount ?? 0);
    const isDebtOrder =
      status === 'DEBT' ||
      status === 'PARTIAL' ||
      remainingDebt > 0 ||
      method === 'debt' ||
      Boolean(tx.debtDueDate || tx.debt_due_date);

    if (isDebtOrder && remainingDebt <= 0 && paid < total) {
      remainingDebt = Math.max(0, total - paid);
    }

    entry.totalOrders += 1;
    entry.totalSpent += total;
    if (isDebtOrder && remainingDebt > 0) {
      entry.currentDebt += remainingDebt;
    }

    const txDate = tx.createdAt || tx.created_at;
    if (!entry.lastOrderDate || (txDate && new Date(txDate) > new Date(entry.lastOrderDate))) {
      entry.lastOrderDate = txDate;
    }

    entry.invoices.push({
      ...tx,
      computedRemainingDebt: remainingDebt,
      computedIsDebt: isDebtOrder && remainingDebt > 0,
      wasDebtOrder: isDebtOrder,
    });
  });

  // Sort each customer's invoices by latest first
  customerList.forEach((c) => {
    c.invoices.sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
  });

  // Sort customers: debtors first, then by total orders descending, then by name
  return customerList.sort((a, b) => {
    if (b.currentDebt !== a.currentDebt) {
      return b.currentDebt - a.currentDebt;
    }
    if (b.totalOrders !== a.totalOrders) {
      return b.totalOrders - a.totalOrders;
    }
    return (a.name || '').localeCompare(b.name || '');
  });
}

