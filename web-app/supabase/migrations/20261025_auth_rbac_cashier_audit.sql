-- ==============================================================================
-- MEIISHOP POS: AUTHENTICATION, RBAC & CASHIER AUDIT TRAIL MIGRATION
-- Run this script in the Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. TẠO BẢNG HỒ SƠ NGƯỜI DÙNG (PROFILES) LIÊN KẾT 1-1 VỚI AUTH.USERS
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT NOT NULL DEFAULT 'Staff Member',
  role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin', 'cashier')),
  pin_code VARCHAR(6) NOT NULL DEFAULT '1234',
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Bật Row Level Security (RLS) cho bảng profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. CẬP NHẬT BẢNG ĐƠN HÀNG (SALE_TRANSACTIONS / ORDERS)
-- Bổ sung trường cashier_id (UUID tham chiếu profiles) và cashier_name (TEXT lưu tên tĩnh)
ALTER TABLE public.sale_transactions 
  ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.sale_transactions 
  ADD COLUMN IF NOT EXISTS cashier_name TEXT DEFAULT 'Meii';

-- Tạo Index tăng tốc tìm kiếm và đối soát theo người bán
CREATE INDEX IF NOT EXISTS idx_sale_transactions_cashier_id ON public.sale_transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sale_transactions_cashier_name ON public.sale_transactions(cashier_name);

-- 2B. TỰ ĐỘNG XÁC NHẬN EMAIL TỨC THÌ (KHÔNG CẦN EMAIL CONFIRMATION)
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Chỉ cập nhật email_confirmed_at (cột confirmed_at là generated column tự động sinh)
  NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_new_user();

-- Kích hoạt ngay lập tức cho toàn bộ các tài khoản đang bị kẹt chưa xác nhận email
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- 3. TRIGGER TỰ ĐỘNG ĐỒNG BỘ KHI TẠO USER TRONG AUTH.USERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, pin_code, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin'),
    COALESCE(NEW.raw_user_meta_data->>'pin_code', '1234'),
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3B. ĐỒNG BỘ TOÀN BỘ USER ĐÃ TẠO TRONG AUTH.USERS SANG PROFILES (BACKFILL)
INSERT INTO public.profiles (id, email, full_name, role, pin_code, is_active, created_at, updated_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  COALESCE(raw_user_meta_data->>'role', 'admin'),
  COALESCE(raw_user_meta_data->>'pin_code', '1234'),
  true,
  created_at,
  now()
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  updated_at = now();

-- 4. HÀM HELPER KIỂM TRA ROLE ADMIN CỦA CURRENT USER
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

-- 5. THIẾT LẬP ROW LEVEL SECURITY (RLS) POLICIES CHẶT CHẼ

-- Policy cho bảng PROFILES:
-- Cho phép đọc danh sách nhân viên để phục vụ Terminal POS & Quản lý
DROP POLICY IF EXISTS "Authenticated users can view active profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow read profiles" ON public.profiles;
CREATE POLICY "Allow read profiles"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- Chỉ Admin hoặc chính chủ mới có thể cập nhật profile
DROP POLICY IF EXISTS "Admin or self can update profile" ON public.profiles;
CREATE POLICY "Admin or self can update profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Chỉ Admin mới được quyền Insert profile thủ công
DROP POLICY IF EXISTS "Only admin can insert profiles" ON public.profiles;
CREATE POLICY "Only admin can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Chỉ Admin mới có quyền Xóa profile
DROP POLICY IF EXISTS "Only admin can delete profiles" ON public.profiles;
CREATE POLICY "Only admin can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Policy cho bảng SALE_TRANSACTIONS:
ALTER TABLE public.sale_transactions ENABLE ROW LEVEL SECURITY;

-- Cả Cashier và Admin đều được phép Đọc và Tạo đơn hàng bán
DROP POLICY IF EXISTS "Authenticated users can view transactions" ON public.sale_transactions;
CREATE POLICY "Authenticated users can view transactions"
  ON public.sale_transactions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create transactions" ON public.sale_transactions;
CREATE POLICY "Authenticated users can create transactions"
  ON public.sale_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Chỉ ADMIN mới có quyền Cập nhật hoặc XÓA đơn hàng
DROP POLICY IF EXISTS "Only admin can update transactions" ON public.sale_transactions;
CREATE POLICY "Only admin can update transactions"
  ON public.sale_transactions FOR UPDATE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Only admin can delete transactions" ON public.sale_transactions;
CREATE POLICY "Only admin can delete transactions"
  ON public.sale_transactions FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Policy cho bảng PRODUCTS:
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

-- Chỉ Admin mới được quyền Thêm, Sửa, Xóa sản phẩm và giá vốn
DROP POLICY IF EXISTS "Only admin can modify products" ON public.products;
CREATE POLICY "Only admin can modify products"
  ON public.products FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. RPC HELPER: XÁC THỰC MÃ PIN CHUYỂN CA AN TOÀN
CREATE OR REPLACE FUNCTION public.verify_staff_pin(p_staff_id UUID, p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT id, full_name, role, pin_code, is_active
  INTO v_profile
  FROM public.profiles
  WHERE id = p_staff_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Staff member not found');
  END IF;

  IF NOT v_profile.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Staff account is deactivated');
  END IF;

  IF v_profile.pin_code = p_pin THEN
    RETURN jsonb_build_object(
      'success', true,
      'staff', jsonb_build_object(
        'id', v_profile.id,
        'full_name', v_profile.full_name,
        'role', v_profile.role
      )
    );
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid PIN code');
  END IF;
END;
$$;

-- 7. BẢO MẬT BẢNG TỶ GIÁ (EXCHANGE_RATES) & NHẬP HÀNG (PURCHASE_ORDERS)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exchange_rates') THEN
    ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Authenticated can read exchange_rates" ON public.exchange_rates;
    CREATE POLICY "Authenticated can read exchange_rates" ON public.exchange_rates FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "Only admin can modify exchange_rates" ON public.exchange_rates;
    CREATE POLICY "Only admin can modify exchange_rates" ON public.exchange_rates FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_orders') THEN
    ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Only admin can manage purchase_orders" ON public.purchase_orders;
    CREATE POLICY "Only admin can manage purchase_orders" ON public.purchase_orders FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

