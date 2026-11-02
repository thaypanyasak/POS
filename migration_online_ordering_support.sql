-- ============================================================================
-- MeiiShop Cloud POS - Online Ordering & Delivery Support Migration
-- Thêm các trường hỗ trợ Đặt hàng Online (Tự ghé lấy & Giao ship tận nơi)
-- Chạy lệnh này trong Supabase SQL Editor. Hoàn toàn an toàn, không mất dữ liệu cũ.
-- ============================================================================

ALTER TABLE public.sale_transactions 
ADD COLUMN IF NOT EXISTS order_source TEXT DEFAULT 'pos',
ADD COLUMN IF NOT EXISTS fulfillment_type TEXT DEFAULT 'in_store',
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_note TEXT,
ADD COLUMN IF NOT EXISTS pickup_time TEXT,
ADD COLUMN IF NOT EXISTS online_status TEXT DEFAULT 'COMPLETED',
ADD COLUMN IF NOT EXISTS payment_slip_url TEXT;

-- Index giúp truy vấn lọc đơn online siêu tốc
CREATE INDEX IF NOT EXISTS idx_sale_transactions_online_orders 
ON public.sale_transactions (order_source, online_status, created_at DESC);

