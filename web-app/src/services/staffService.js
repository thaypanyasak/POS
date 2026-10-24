import { createClient } from '@supabase/supabase-js';
import { supabase, sanitizeCashierName, fetchStoreSetting, updateStoreSetting } from './supabase';

const SUPABASE_URL = 'https://qanphpmphnipyuwcadwz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zQw2L3JfnT-5o_-tJgZaIA_WETQFTPq';

export const STAFF_STORAGE_KEY = 'app_staff_list_v1';
export const EVENT_STAFF_CHANGED = 'meiishop:staff-updated';

/**
 * Fetch all staff profiles (Admin view)
 * Reads cloud store_settings with local cache
 */
export async function fetchStaffProfiles() {
  try {
    // 1. Check store_settings in Supabase cloud
    const cloudStaff = await fetchStoreSetting(STAFF_STORAGE_KEY, null);
    if (Array.isArray(cloudStaff)) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`meiishop_${STAFF_STORAGE_KEY}`, JSON.stringify(cloudStaff));
      }
      return { data: cloudStaff, error: null };
    }

    // 2. If store_settings not seeded yet, fetch from profiles table
    const { data: dbProfiles, error: dbErr } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!dbErr && Array.isArray(dbProfiles) && dbProfiles.length > 0) {
      await updateStoreSetting(STAFF_STORAGE_KEY, dbProfiles);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`meiishop_${STAFF_STORAGE_KEY}`, JSON.stringify(dbProfiles));
      }
      return { data: dbProfiles, error: null };
    }

    return { data: [], error: null };
  } catch (err) {
    console.error('[staffService] fetchStaffProfiles exception:', err);
    return { data: [], error: err.message };
  }
}

/**
 * Fetch active cashiers for quick shift switching and LoginScreen
 */
export async function fetchActiveCashiers() {
  try {
    const { data: allStaff, error } = await fetchStaffProfiles();
    if (error || !Array.isArray(allStaff)) {
      return { data: [], error: error || null };
    }
    const activeStaff = allStaff.filter((s) => s.is_active !== false);
    return { data: activeStaff, error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

/**
 * Verify staff 4-digit PIN for quick cashier switch or screen unlock
 */
export async function verifyCashierPin(staffId, inputPin) {
  try {
    const cleanPin = String(inputPin).trim();
    if (!cleanPin) return { success: false, error: 'ກະລຸນາປ້ອນລະຫັດ PIN' };

    const { data: allStaff } = await fetchStaffProfiles();
    const staff = allStaff?.find((s) => s.id === staffId);

    if (!staff) {
      return { success: false, error: 'ບໍ່ພົບຂໍ້ມູນພະນັກງານ' };
    }

    if (staff.is_active === false) {
      return { success: false, error: 'ບັນຊີພະນັກງານນີ້ຖືກປິດການນຳໃຊ້ແລ້ວ' };
    }

    if (String(staff.pin_code).trim() === cleanPin) {
      return {
        success: true,
        staff: {
          id: staff.id,
          full_name: staff.full_name,
          role: staff.role,
        },
      };
    }

    return { success: false, error: 'ລະຫັດ PIN 4 ຕົວເລກບໍ່ຖືກຕ້ອງ!' };
  } catch (err) {
    console.error('[staffService] verifyCashierPin error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Quick switch cashier by PIN alone (searches among all active staff)
 */
export async function findCashierByPin(inputPin) {
  try {
    const cleanPin = String(inputPin).trim();
    if (!cleanPin) return { success: false, error: 'ກະລຸນາປ້ອນລະຫັດ PIN' };

    const { data: allStaff } = await fetchStaffProfiles();
    const match = allStaff?.find((s) => s.is_active !== false && String(s.pin_code).trim() === cleanPin);

    if (match) {
      return {
        success: true,
        staff: {
          id: match.id,
          full_name: match.full_name,
          role: match.role,
        },
      };
    }

    return { success: false, error: 'ລະຫັດ PIN ບໍ່ຖືກຕ້ອງ!' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Create a new staff account (Admin only)
 */
export async function adminCreateStaff({ email, password, fullName, role = 'cashier', pinCode = '1234' }) {
  try {
    if (!fullName || !fullName.trim()) {
      return { success: false, error: 'ກະລຸນາປ້ອນຊື່ພະນັກງານ' };
    }

    const cleanPin = String(pinCode).trim().slice(0, 6) || '1234';
    const cleanName = fullName.trim();
    const cleanEmail = email?.trim() || `staff_${Date.now()}@meiishop.la`;
    const newId = `staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newStaff = {
      id: newId,
      email: cleanEmail,
      full_name: cleanName,
      role: role || 'cashier',
      pin_code: cleanPin,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Update Cloud store_settings
    const { data: currentList } = await fetchStaffProfiles();
    const updatedList = [newStaff, ...(Array.isArray(currentList) ? currentList : [])];

    const saveRes = await updateStoreSetting(STAFF_STORAGE_KEY, updatedList);
    if (!saveRes.success) {
      return { success: false, error: saveRes.error || 'ບໍ່ສາມາດບັນທຶກຂໍ້ມູນພະນັກງານໄດ້' };
    }

    // 2. Broadcast change event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_STAFF_CHANGED, { detail: updatedList }));
    }

    // 3. Optional: Background Supabase Auth signup if password provided
    if (password && password.trim()) {
      try {
        const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        tempClient.auth.signUp({
          email: cleanEmail,
          password: password.trim(),
          options: { data: { full_name: cleanName, role, pin_code: cleanPin } },
        }).catch(() => {});
      } catch (_) {}
    }

    return { success: true, staff: newStaff };
  } catch (err) {
    console.error('[staffService] adminCreateStaff exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update staff details (Name, Role, PIN, Active status)
 */
export async function adminUpdateStaff(staffId, updatePayload) {
  try {
    const { data: currentList } = await fetchStaffProfiles();
    if (!Array.isArray(currentList)) {
      return { success: false, error: 'ບໍ່ພົບລາຍຊື່ພະນັກງານ' };
    }

    let updatedStaff = null;
    const nextList = currentList.map((st) => {
      if (st.id === staffId) {
        updatedStaff = {
          ...st,
          full_name:
            updatePayload.fullName !== undefined
              ? updatePayload.fullName.trim()
              : updatePayload.full_name !== undefined
              ? updatePayload.full_name.trim()
              : st.full_name,
          role: updatePayload.role !== undefined ? updatePayload.role : st.role,
          pin_code:
            updatePayload.pinCode !== undefined
              ? String(updatePayload.pinCode).trim().slice(0, 6)
              : updatePayload.pin_code !== undefined
              ? String(updatePayload.pin_code).trim().slice(0, 6)
              : st.pin_code,
          is_active:
            updatePayload.isActive !== undefined
              ? Boolean(updatePayload.isActive)
              : updatePayload.is_active !== undefined
              ? Boolean(updatePayload.is_active)
              : st.is_active,
          email:
            updatePayload.email !== undefined
              ? updatePayload.email.trim()
              : st.email,
          updated_at: new Date().toISOString(),
        };
        return updatedStaff;
      }
      return st;
    });

    if (!updatedStaff) {
      return { success: false, error: 'ບໍ່ພົບພະນັກງານທີ່ຕ້ອງການແກ້ໄຂ' };
    }

    // 1. Save to Cloud store_settings
    const saveRes = await updateStoreSetting(STAFF_STORAGE_KEY, nextList);
    if (!saveRes.success) {
      return { success: false, error: saveRes.error || 'ບໍ່ສາມາດອັບເດດຂໍ້ມູນພະນັກງານໄດ້' };
    }

    // 2. Broadcast change event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_STAFF_CHANGED, { detail: nextList }));
    }

    // 3. Optional: Background update in profiles table if possible
    try {
      supabase
        .from('profiles')
        .update({
          full_name: updatedStaff.full_name,
          role: updatedStaff.role,
          pin_code: updatedStaff.pin_code,
          is_active: updatedStaff.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', staffId)
        .catch(() => {});
    } catch (_) {}

    return { success: true, staff: updatedStaff };
  } catch (err) {
    console.error('[staffService] adminUpdateStaff exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Toggle staff active status (Active / Disabled)
 */
export async function adminToggleStaffActive(staffId, isActive) {
  return await adminUpdateStaff(staffId, { isActive: Boolean(isActive) });
}

/**
 * Permanently delete staff account (Hard delete)
 */
export async function adminDeleteStaff(staffId) {
  try {
    const { data: currentList } = await fetchStaffProfiles();
    if (!Array.isArray(currentList)) {
      return { success: false, error: 'ບໍ່ພົບລາຍຊື່ພະນັກງານ' };
    }

    const nextList = currentList.filter((st) => st.id !== staffId);

    // 1. Save updated list without this staff to Cloud store_settings
    const saveRes = await updateStoreSetting(STAFF_STORAGE_KEY, nextList);
    if (!saveRes.success) {
      return { success: false, error: saveRes.error || 'ບໍ່ສາມາດລຶບບັນຊີພະນັກງານໄດ້' };
    }

    // 2. Broadcast change event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_STAFF_CHANGED, { detail: nextList }));
    }

    // 3. Optional: Background delete in profiles table
    try {
      supabase.from('profiles').delete().eq('id', staffId).catch(() => {});
    } catch (_) {}

    return { success: true };
  } catch (err) {
    console.error('[staffService] adminDeleteStaff exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Listen to realtime staff updates
 */
export function onStaffListChange(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => {
    if (event.detail) callback(event.detail);
  };
  window.addEventListener(EVENT_STAFF_CHANGED, handler);
  return () => window.removeEventListener(EVENT_STAFF_CHANGED, handler);
}
