-- ============================================================================
-- MODULE: QUẢN LÝ BÁO GIÁ / PHIẾU TẠM TÍNH (QUOTATIONS / PROFORMA RECEIPTS)
-- ============================================================================
-- Bảng này lưu vết lịch sử các phiếu báo giá đã tạo hoặc in ra cho khách hàng
-- TUYỆT ĐỐI ĐỘC LẬP VỚI sale_transactions - KHÔNG TRỪ KHO, KHÔNG TÍNH DOANH THU
-- ============================================================================

-- 1. Bảng Phiếu Báo giá (Quotations Header)
CREATE TABLE IF NOT EXISTS public.quotations (
    id TEXT PRIMARY KEY,                           -- Mã báo giá dạng: QT-YYYYMMDD-XXXX
    created_at TIMESTAMPTZ DEFAULT NOW(),
    customer_name TEXT DEFAULT 'ລູກຄ້າທົ່ວໄປ',
    cashier_name TEXT DEFAULT 'ໄມ້ຄຳ (Meii)',
    is_wholesale BOOLEAN DEFAULT FALSE,
    
    -- Tổng tiền báo giá
    subtotal BIGINT NOT NULL DEFAULT 0,
    total_crate_deposit BIGINT NOT NULL DEFAULT 0,
    grand_total BIGINT NOT NULL DEFAULT 0,
    
    -- Trạng thái phiếu báo giá:
    -- 'PENDING': Vừa tạo / Mới in cho khách
    -- 'CONVERTED': Khách quay lại chốt mua và đã chuyển thành đơn bán hàng (Sale Transaction)
    -- 'EXPIRED': Hết hạn (sau 3 ngày)
    -- 'CANCELLED': Đã hủy
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONVERTED', 'EXPIRED', 'CANCELLED')),
    
    valid_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 days'),
    converted_transaction_id TEXT,                 -- Liên kết tới sale_transactions nếu khách chốt mua
    note TEXT
);

-- 2. Bảng Chi tiết Hàng Báo giá (Quotation Items)
CREATE TABLE IF NOT EXISTS public.quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id TEXT NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    multiplier INT NOT NULL DEFAULT 1,
    quantity INT NOT NULL DEFAULT 1,
    unit_price BIGINT NOT NULL DEFAULT 0,
    line_total BIGINT NOT NULL DEFAULT 0,
    
    -- Thông tin cọc vỏ két (nếu có đối với bia/nước ngọt)
    has_empty_crates BOOLEAN DEFAULT FALSE,
    missing_crates_count INT DEFAULT 0,
    crate_deposit_fee BIGINT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tạo Indexes để tăng tốc truy vấn tìm kiếm
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON public.quotations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_name ON public.quotations(customer_name);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotation_items_qid ON public.quotation_items(quotation_id);

-- 4. Bật Row Level Security (RLS)
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write for quotations" 
    ON public.quotations FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read-write for quotation_items" 
    ON public.quotation_items FOR ALL USING (true) WITH CHECK (true);

-- 5. Bật Realtime Sync qua Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE public.quotations;
