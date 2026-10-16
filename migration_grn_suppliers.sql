-- ============================================================================
-- MODULE: QUẢN LÝ NHẬP KHO (GRN) & CÔNG NỢ NHÀ CUNG CẤP (ACCOUNTS PAYABLE)
-- ============================================================================
-- Thiết kế chuẩn: Nhập 1 lần 1 sản phẩm (Single-Product GRN Form)
-- Hỗ trợ 3 loại tiền độc lập (LAK, THB, VND) - Bỏ hoàn toàn Dropdown chọn loại tiền chính
-- ============================================================================

-- 1. Bảng Nhà cung cấp / Nguồn hàng nhập
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    contact_person TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng Phiếu Nhập Kho (Purchase Orders) - Nhập 1 lần 1 sản phẩm
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id TEXT PRIMARY KEY, -- Format: PO-YYYYMMDD-XXXX
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    
    -- Số lượng nhập quy đổi ra base units để cộng dồn kho
    imported_base_units INT8 NOT NULL,
    tier1_qty INT4 DEFAULT 0,
    tier2_qty INT4 DEFAULT 0,
    tier3_qty INT4 DEFAULT 0,

    -- Giá vốn ghi nhận của đợt này
    cost_thb NUMERIC(10, 2) DEFAULT 0.00,
    cost_lak INT8 DEFAULT 0,
    cost_per_base_unit INT8 NOT NULL,

    -- Tổng giá tiền nhập đợt này (hỗ trợ nhập cả 3 loại tiền độc lập)
    total_cost_lak INT8 DEFAULT 0,
    total_cost_thb NUMERIC(12, 2) DEFAULT 0.00,
    total_cost_vnd INT8 DEFAULT 0,

    -- Quản lý thanh toán & công nợ
    paid_amount INT8 NOT NULL DEFAULT 0,
    debt_amount INT8 NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL CHECK (payment_status IN ('PAID', 'PARTIAL', 'DEBT')),
    
    received_by TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng Nhật ký Trả nợ Nhà cung cấp
CREATE TABLE IF NOT EXISTS public.supplier_debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id TEXT NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    payment_amount INT8 NOT NULL,
    currency TEXT NOT NULL DEFAULT 'LAK',
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'TRANSFER')),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bật RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_debt_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for authenticated on suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for authenticated on purchase_orders" ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for authenticated on supplier_debt_payments" ON public.supplier_debt_payments FOR ALL USING (true) WITH CHECK (true);

-- Index tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_product_id ON public.purchase_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON public.purchase_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_debt_payments_poid ON public.supplier_debt_payments(purchase_order_id);

-- Realtime sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders;
