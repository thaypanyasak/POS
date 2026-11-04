-- ============================================================================
-- Migration: Multi-Currency THB / LAK & Zero-Egress Auto-Repricing Architecture
-- MeiiShop POS - Supabase PostgreSQL
-- ============================================================================

-- 1. BỔ SUNG CÁC CỘT VÀO BẢNG PRODUCTS
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS cost_currency VARCHAR(10) NOT NULL DEFAULT 'THB',
ADD COLUMN IF NOT EXISTS cost_thb NUMERIC(14, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_lak NUMERIC(14, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_auto_currency_reprice BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.cost_currency IS 'Loại tiền nhập hàng: THB (Tiền Baht Thái) hoặc LAK (Tiền Kíp Lào)';
COMMENT ON COLUMN public.products.is_auto_currency_reprice IS 'Cờ tự động tính lại giá bán khi tỷ giá THB/LAK thay đổi';

-- 2. BỔ SUNG CÁC CỘT TỶ LỆ GIÁ BÁN TRÊN GIÁ VỐN VÀO BẢNG PRODUCT_UNITS
ALTER TABLE public.product_units
ADD COLUMN IF NOT EXISTS price_ratio_1 NUMERIC(10, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_ratio_2 NUMERIC(10, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_ratio_3 NUMERIC(10, 4) DEFAULT 0;

COMMENT ON COLUMN public.product_units.price_ratio_1 IS 'Tỷ lệ Giá 1 / Giá vốn đơn vị (price_1 / unit_cost_lak)';
COMMENT ON COLUMN public.product_units.price_ratio_2 IS 'Tỷ lệ Giá 2 / Giá vốn đơn vị (price_2 / unit_cost_lak)';
COMMENT ON COLUMN public.product_units.price_ratio_3 IS 'Tỷ lệ Giá 3 / Giá vốn đơn vị (price_3 / unit_cost_lak)';

-- 3. ĐẢM BẢO BẢNG STORE_SETTINGS VÀ TỶ GIÁ TỒN TẠI
CREATE TABLE IF NOT EXISTS public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Kích hoạt Row Level Security (RLS) và cấp policy đầy đủ
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'store_settings' AND policyname = 'Allow all actions on store_settings') THEN
        CREATE POLICY "Allow all actions on store_settings" ON public.store_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

INSERT INTO public.store_settings (key, value)
VALUES ('thb_lak_exchange_rate', '{"rate": 690, "auto_update": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. BACKFILL DỮ LIỆU CŨ CHO SẢN PHẨM & ĐƠN VỊ HIỆN TẠI
-- Set cost_currency = 'THB' cho sản phẩm có cost_thb > 0, ngược lại nếu chỉ có cost_lak thì set 'LAK'
-- is_auto_currency_reprice mặc định là FALSE để an toàn (chỉ bật khi người dùng chủ động chọn)
UPDATE public.products
SET cost_currency = CASE 
  WHEN COALESCE(cost_thb, 0) > 0 THEN 'THB'
  WHEN COALESCE(cost_lak, 0) > 0 THEN 'LAK'
  ELSE 'THB'
END,
is_auto_currency_reprice = COALESCE(is_auto_currency_reprice, false)
WHERE cost_currency IS NULL OR is_auto_currency_reprice IS NULL;

-- Backfill tỷ lệ price_ratio_1, price_ratio_2, price_ratio_3 cho các units hiện tại
DO $$
DECLARE
  v_rec RECORD;
  v_max_mult INT;
  v_unit_cost NUMERIC;
BEGIN
  FOR v_rec IN 
    SELECT u.id, u.product_id, u.multiplier, u.retail_price, u.price_2, u.price_3,
           COALESCE(p.cost_lak, 0) AS p_cost_lak
    FROM public.product_units u
    JOIN public.products p ON p.id = u.product_id
    WHERE COALESCE(u.price_ratio_1, 0) = 0 AND COALESCE(u.retail_price, 0) > 0
  LOOP
    SELECT COALESCE(MAX(multiplier), 1) INTO v_max_mult 
    FROM public.product_units 
    WHERE product_id = v_rec.product_id;
    
    v_unit_cost := (v_rec.p_cost_lak::numeric / GREATEST(v_max_mult, 1)) * v_rec.multiplier;
    
    IF v_unit_cost > 0 THEN
      UPDATE public.product_units
      SET 
        price_ratio_1 = ROUND((v_rec.retail_price::numeric / v_unit_cost), 4),
        price_ratio_2 = CASE WHEN COALESCE(v_rec.price_2, 0) > 0 THEN ROUND((v_rec.price_2::numeric / v_unit_cost), 4) ELSE 0 END,
        price_ratio_3 = CASE WHEN COALESCE(v_rec.price_3, 0) > 0 THEN ROUND((v_rec.price_3::numeric / v_unit_cost), 4) ELSE 0 END
      WHERE id = v_rec.id;
    END IF;
  END LOOP;
END $$;

-- 5. STORED PROCEDURE RPC: SYNC_EXCHANGE_RATE_AND_REPRICE
-- Thực hiện 100% việc tính lại giá và cập nhật hơn 1.000 sản phẩm bên trong PostgreSQL
-- Tiêu tốn < 1KB Egress (Zero-Egress Strategy)
CREATE OR REPLACE FUNCTION public.sync_exchange_rate_and_reprice(
  p_new_rate NUMERIC,
  p_round_step INT DEFAULT 500
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_products INT := 0;
  v_updated_units INT := 0;
BEGIN
  -- 1. Kiểm tra tham số đầu vào
  IF p_new_rate IS NULL OR p_new_rate <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tỷ giá mới phải lớn hơn 0');
  END IF;

  IF p_round_step IS NULL OR p_round_step <= 0 THEN
    p_round_step := 500;
  END IF;

  -- 2. Cập nhật tỷ giá mới vào bảng store_settings
  INSERT INTO public.store_settings (key, value, updated_at)
  VALUES (
    'thb_lak_exchange_rate',
    jsonb_build_object('rate', p_new_rate, 'auto_update', false, 'updated_at', now()),
    now()
  )
  ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('rate', p_new_rate, 'auto_update', false, 'updated_at', now()),
      updated_at = now();

  -- 3. Cập nhật giá vốn Kíp (cost_lak, cost_per_base_unit) cho sản phẩm nhập bằng THB & có bật auto-reprice
  WITH target_products AS (
    SELECT 
      p.id,
      p.cost_thb,
      COALESCE(
        (SELECT MAX(multiplier) FROM public.product_units u WHERE u.product_id = p.id),
        1
      ) AS max_mult
    FROM public.products p
    WHERE COALESCE(p.cost_currency, 'THB') = 'THB'
      AND COALESCE(p.is_auto_currency_reprice, false) = true
      AND COALESCE(p.cost_thb, 0) > 0
      AND COALESCE(p.is_deleted, false) = false
  ),
  updated_prods AS (
    UPDATE public.products p
    SET 
      -- Giá vốn giữ nguyên giá trị toán học chuẩn xác để báo cáo & tính lãi
      cost_lak = ROUND(tp.cost_thb * p_new_rate),
      cost_per_base_unit = ROUND((tp.cost_thb * p_new_rate) / GREATEST(tp.max_mult, 1)),
      updated_at = now()
    FROM target_products tp
    WHERE p.id = tp.id
    RETURNING p.id
  )
  SELECT count(*) INTO v_updated_products FROM updated_prods;

  -- 4. Cập nhật 3 mức giá bán (price_1, price_2, price_3) cho tất cả các đơn vị tính (product_units)
  WITH eligible_units AS (
    SELECT 
      u.id AS unit_id,
      p.id AS prod_id,
      -- Giá vốn đơn vị tính theo tỷ giá mới:
      ((p.cost_thb * p_new_rate) / GREATEST(pm.max_mult, 1)) * u.multiplier AS new_unit_cost_lak,
      -- Tỷ lệ giá bán: dùng ratio đã lưu, hoặc fallback tính từ giá hiện tại
      COALESCE(
        NULLIF(u.price_ratio_1, 0),
        CASE 
          WHEN u.retail_price > 0 AND p.cost_lak > 0 
          THEN ROUND(u.retail_price::numeric / NULLIF(((p.cost_lak) / GREATEST(pm.max_mult, 1)) * u.multiplier, 0), 4)
          ELSE 0 
        END
      ) AS eff_ratio_1,
      COALESCE(
        NULLIF(u.price_ratio_2, 0),
        CASE 
          WHEN u.price_2 > 0 AND p.cost_lak > 0 
          THEN ROUND(u.price_2::numeric / NULLIF(((p.cost_lak) / GREATEST(pm.max_mult, 1)) * u.multiplier, 0), 4)
          ELSE 0 
        END
      ) AS eff_ratio_2,
      COALESCE(
        NULLIF(u.price_ratio_3, 0),
        CASE 
          WHEN u.price_3 > 0 AND p.cost_lak > 0 
          THEN ROUND(u.price_3::numeric / NULLIF(((p.cost_lak) / GREATEST(pm.max_mult, 1)) * u.multiplier, 0), 4)
          ELSE 0 
        END
      ) AS eff_ratio_3
    FROM public.product_units u
    JOIN public.products p ON p.id = u.product_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(MAX(multiplier), 1) AS max_mult
      FROM public.product_units pu 
      WHERE pu.product_id = p.id
    ) pm
    WHERE COALESCE(p.cost_currency, 'THB') = 'THB'
      AND COALESCE(p.is_auto_currency_reprice, false) = true
      AND COALESCE(p.cost_thb, 0) > 0
      AND COALESCE(p.is_deleted, false) = false
  ),
  updated_u AS (
    UPDATE public.product_units u
    SET 
      retail_price = CASE 
        WHEN eu.eff_ratio_1 > 0 
        THEN ROUND((eu.new_unit_cost_lak * eu.eff_ratio_1) / p_round_step) * p_round_step
        ELSE u.retail_price 
      END,
      price_2 = CASE 
        WHEN eu.eff_ratio_2 > 0 
        THEN ROUND((eu.new_unit_cost_lak * eu.eff_ratio_2) / p_round_step) * p_round_step
        ELSE u.price_2 
      END,
      price_3 = CASE 
        WHEN eu.eff_ratio_3 > 0 
        THEN ROUND((eu.new_unit_cost_lak * eu.eff_ratio_3) / p_round_step) * p_round_step
        ELSE u.price_3 
      END,
      wholesale_price = CASE 
        WHEN eu.eff_ratio_3 > 0 
        THEN ROUND((eu.new_unit_cost_lak * eu.eff_ratio_3) / p_round_step) * p_round_step
        ELSE u.wholesale_price 
      END,
      price_ratio_1 = CASE WHEN eu.eff_ratio_1 > 0 THEN eu.eff_ratio_1 ELSE u.price_ratio_1 END,
      price_ratio_2 = CASE WHEN eu.eff_ratio_2 > 0 THEN eu.eff_ratio_2 ELSE u.price_ratio_2 END,
      price_ratio_3 = CASE WHEN eu.eff_ratio_3 > 0 THEN eu.eff_ratio_3 ELSE u.price_ratio_3 END
    FROM eligible_units eu
    WHERE u.id = eu.unit_id
    RETURNING u.id
  )
  SELECT count(*) INTO v_updated_units FROM updated_u;

  RETURN jsonb_build_object(
    'success', true,
    'new_rate', p_new_rate,
    'round_step', p_round_step,
    'updated_count', v_updated_products,
    'updated_products', v_updated_products,
    'updated_units', v_updated_units
  );
END;
$$;

-- Alias tương thích
CREATE OR REPLACE FUNCTION public.update_exchange_rate_and_reprice(
  p_new_rate NUMERIC,
  p_round_step INT DEFAULT 500
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.sync_exchange_rate_and_reprice(p_new_rate, p_round_step);
END;
$$;

-- Cấp quyền gọi Stored Procedure cho mọi vai trò (anon, authenticated, service_role)
GRANT EXECUTE ON FUNCTION public.sync_exchange_rate_and_reprice(NUMERIC, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_exchange_rate_and_reprice(NUMERIC, INT) TO anon, authenticated, service_role;

-- 6. TỐI ƯU HIỆU NĂNG & CPU CHO SUPABASE FREE TIER: PARTIAL INDEX
-- Giúp PostgreSQL quét và cập nhật 1.000+ sản phẩm trong vài mili-giây mà không tốn tài nguyên CPU
CREATE INDEX IF NOT EXISTS idx_products_auto_reprice 
ON public.products (cost_currency, is_auto_currency_reprice) 
WHERE is_auto_currency_reprice = true;

CREATE INDEX IF NOT EXISTS idx_product_units_product_id 
ON public.product_units (product_id);

