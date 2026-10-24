-- ==============================================================================
-- MEIISHOP POS: DYNAMIC ROLES & PERMISSIONS DATABASE MIGRATION
-- Chạy script này trong Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. GỠ BỎ RÀNG BUỘC CỐ ĐỊNH 2 ROLE TRONG BẢNG PROFILES
-- Giúp hệ thống có thể lưu bất kỳ Role mới nào (warehouse, accountant, supervisor...)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. ĐẢM BẢO BẢNG STORE_SETTINGS LƯU TRỮ CẤU HÌNH ROLE & PERMISSIONS TOÀN CỤC
CREATE TABLE IF NOT EXISTS public.store_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select store_settings" ON public.store_settings;
CREATE POLICY "Allow select store_settings"
  ON public.store_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow modify store_settings" ON public.store_settings;
CREATE POLICY "Allow modify store_settings"
  ON public.store_settings FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 3. KHỞI TẠO DỮ LIỆU MẶC ĐỊNH CHO ROLE & PERMISSIONS TRÊN DATABASE
INSERT INTO public.store_settings (key, value, updated_at)
VALUES 
  (
    'role_permissions',
    '{
      "admin": ["pos", "history", "products", "purchases", "dashboard", "sales-by-unit", "staff-management", "settings"],
      "cashier": ["pos", "history", "products"]
    }'::jsonb,
    now()
  ),
  (
    'app_roles_v1',
    '[
      {"id": "admin", "name": "ຜູ້ຈັດການ (Admin)", "description": "ມີສິດຄຸ້ມຄອງເຕັມທຸກໜ້າ ແລະ ຕັ້ງຄ່າລະບົບ", "isSystem": true, "badgeColor": "amber"},
      {"id": "cashier", "name": "ພະນັກງານຂາຍ (Cashier)", "description": "ຂາຍໜ້າຮ້ານ, ເບິ່ງສິນຄ້າ ແລະ ປະຫວັດການຂາຍ", "isSystem": true, "badgeColor": "teal"}
    ]'::jsonb,
    now()
  )
ON CONFLICT (key) DO NOTHING;
