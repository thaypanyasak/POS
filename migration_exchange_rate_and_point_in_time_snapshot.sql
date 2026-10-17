-- ============================================================================
-- MODULE: TỶ GIÁ THỜI GIAN THỰC & HẠCH TOÁN POINT-IN-TIME EXCHANGE RATE SNAPSHOT
-- ============================================================================
-- 1. Bảng cấu hình store_settings: lưu trữ tỷ giá THB/LAK (mặc định 690)
-- 2. Cập nhật bảng sale_transactions (và orders nếu có):
--    - exchange_rate: NUMERIC NOT NULL DEFAULT 690
--    - total_lak: NUMERIC NOT NULL
--    - total_thb: NUMERIC NOT NULL = total_lak / exchange_rate
--    - gross_profit_lak: NUMERIC NOT NULL
--    - gross_profit_thb: NUMERIC NOT NULL = gross_profit_lak / exchange_rate
-- 3. Hạch toán bất biến: Thay đổi tỷ giá hôm nay không ảnh hưởng lịch sử
-- ============================================================================

-- 1. TẠO BẢNG CẤU HÌNH STORE_SETTINGS
CREATE TABLE IF NOT EXISTS public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Khởi tạo tỷ giá ban đầu: 1 THB = 690 LAK
INSERT INTO public.store_settings (key, value)
VALUES ('thb_lak_exchange_rate', '{"rate": 690, "auto_update": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Cấp quyền Row Level Security (RLS)
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all actions on store_settings') THEN
        CREATE POLICY "Allow all actions on store_settings" ON public.store_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 2. BỔ SUNG CỘT VÀO BẢNG SALE_TRANSACTIONS
ALTER TABLE public.sale_transactions
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC NOT NULL DEFAULT 690,
ADD COLUMN IF NOT EXISTS total_lak NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_thb NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS gross_profit_lak NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS gross_profit_thb NUMERIC DEFAULT 0;

-- 3. BACKFILL DỮ LIỆU CŨ (Nếu các cột mới đang NULL hoặc 0)
UPDATE public.sale_transactions
SET 
  total_lak = COALESCE(NULLIF(total_lak, 0), grand_total, 0),
  total_thb = CASE 
    WHEN total_thb IS NULL OR total_thb = 0 THEN ROUND(COALESCE(grand_total, 0) / COALESCE(NULLIF(exchange_rate, 0), 690), 2)
    ELSE total_thb 
  END,
  gross_profit_lak = COALESCE(NULLIF(gross_profit_lak, 0), gross_profit, 0),
  gross_profit_thb = CASE 
    WHEN gross_profit_thb IS NULL OR gross_profit_thb = 0 THEN ROUND(COALESCE(gross_profit, 0) / COALESCE(NULLIF(exchange_rate, 0), 690), 2)
    ELSE gross_profit_thb 
  END
WHERE total_lak IS NULL OR total_lak = 0 OR total_thb IS NULL OR total_thb = 0;

-- 4. BỔ SUNG CỘT VÀO BẢNG ORDERS (NẾU TỒN TẠI)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
    ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC NOT NULL DEFAULT 690,
    ADD COLUMN IF NOT EXISTS total_lak NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_thb NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gross_profit_lak NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gross_profit_thb NUMERIC DEFAULT 0;

    UPDATE public.orders
    SET 
      total_lak = COALESCE(NULLIF(total_lak, 0), grand_total, 0),
      total_thb = CASE 
        WHEN total_thb IS NULL OR total_thb = 0 THEN ROUND(COALESCE(grand_total, 0) / COALESCE(NULLIF(exchange_rate, 0), 690), 2)
        ELSE total_thb 
      END,
      gross_profit_lak = COALESCE(NULLIF(gross_profit_lak, 0), gross_profit, 0),
      gross_profit_thb = CASE 
        WHEN gross_profit_thb IS NULL OR gross_profit_thb = 0 THEN ROUND(COALESCE(gross_profit, 0) / COALESCE(NULLIF(exchange_rate, 0), 690), 2)
        ELSE gross_profit_thb 
      END
    WHERE total_lak IS NULL OR total_lak = 0 OR total_thb IS NULL OR total_thb = 0;
  END IF;
END $$;
