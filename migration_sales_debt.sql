-- ============================================================================
-- MIGRATION: LỊCH SỬ ĐƠN HÀNG, QUẢN LÝ CÔNG NỢ KHÁCH HÀNG & THU NỢ
-- ============================================================================
-- 1. Bổ sung các cột công nợ vào bảng sale_transactions (giữ nguyên id là TEXT)
-- 2. Tạo bảng nhật ký thu nợ khách hàng (customer_debt_payments)
-- ============================================================================

-- 1. Bổ sung cột quản lý nợ vào bảng sale_transactions
ALTER TABLE public.sale_transactions 
ADD COLUMN IF NOT EXISTS paid_amount INT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_debt INT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PAID' CHECK (payment_status IN ('PAID', 'PARTIAL', 'DEBT'));

-- Cập nhật dữ liệu cũ nếu có: đơn nợ thì remaining_debt = grand_total - amount_tendered
UPDATE public.sale_transactions
SET remaining_debt = CASE 
    WHEN payment_method = 'debt' OR payment_method = 'DEBT' THEN GREATEST(0, grand_total - COALESCE(amount_tendered, 0))
    ELSE 0
END,
payment_status = CASE 
    WHEN (payment_method = 'debt' OR payment_method = 'DEBT') AND COALESCE(amount_tendered, 0) <= 0 THEN 'DEBT'
    WHEN (payment_method = 'debt' OR payment_method = 'DEBT') AND COALESCE(amount_tendered, 0) > 0 AND COALESCE(amount_tendered, 0) < grand_total THEN 'PARTIAL'
    ELSE 'PAID'
END
WHERE remaining_debt IS NULL OR remaining_debt = 0;

-- 2. Bảng lưu nhật ký thu nợ khách hàng (Customer Debt Recovery)
CREATE TABLE IF NOT EXISTS public.customer_debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT NOT NULL REFERENCES public.sale_transactions(id) ON DELETE CASCADE,
    payment_amount INT8 NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'TRANSFER')),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tạo Indexes tối ưu tốc độ truy vấn
CREATE INDEX IF NOT EXISTS idx_sale_transactions_payment_status ON public.sale_transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_sale_transactions_remaining_debt ON public.sale_transactions(remaining_debt);
CREATE INDEX IF NOT EXISTS idx_customer_debt_payments_txid ON public.customer_debt_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_customer_debt_payments_created_at ON public.customer_debt_payments(created_at DESC);

-- 4. Bật Row Level Security (RLS)
ALTER TABLE public.customer_debt_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for authenticated on customer_debt_payments" 
    ON public.customer_debt_payments FOR ALL USING (true) WITH CHECK (true);

-- 5. Bật Realtime Sync qua Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_debt_payments;
