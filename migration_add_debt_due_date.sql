-- ============================================================================
-- MIGRATION: BỔ SUNG CỘT NGÀY HẸN TRẢ NỢ (DEBT DUE DATE)
-- ============================================================================
-- Chạy đoạn script này trong Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Thêm cột debt_due_date vào bảng sale_transactions (Kiểu DATE, cho phép NULL)
ALTER TABLE public.sale_transactions 
ADD COLUMN IF NOT EXISTS debt_due_date DATE DEFAULT NULL;

-- 2. Tạo Index để truy vấn nhanh danh sách các đơn ghi nợ theo hạn thanh toán
CREATE INDEX IF NOT EXISTS idx_sale_transactions_debt_due_date 
ON public.sale_transactions(debt_due_date) 
WHERE debt_due_date IS NOT NULL;

-- 3. Cập nhật comment giải thích
COMMENT ON COLUMN public.sale_transactions.debt_due_date IS 'Ngày hẹn trả nợ của khách hàng (YYYY-MM-DD)';

