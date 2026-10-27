-- ============================================================================
-- MeiiShop Cloud POS - Production Performance & Scale Optimization Indexes
-- Dành cho quy mô: 3.000+ sản phẩm, 200-300 hóa đơn/ngày (100.000+ bill/năm)
-- Hướng dẫn: Mở Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- và bấm RUN để kích hoạt. Lệnh này KHÔNG làm thay đổi cấu trúc bảng hay dữ liệu cũ.
-- ============================================================================

-- 1. Tối ưu khóa ngoại giữa Hóa đơn và Chi tiết món hàng (TRÁNH FULL TABLE SCAN)
-- Khi bảng sale_transaction_items lên tới 50.000 - 500.000 dòng, index này giúp
-- việc nạp chi tiết hóa đơn (receipt items) từ 2-3 giây giảm xuống dưới 10 mili-giây.
CREATE INDEX IF NOT EXISTS idx_sale_transaction_items_tx_id 
ON sale_transaction_items(transaction_id);

CREATE INDEX IF NOT EXISTS idx_sale_transaction_items_product_id 
ON sale_transaction_items(product_id);

-- 2. Tối ưu Lịch sử bán hàng và Báo cáo Doanh thu theo thời gian
-- Tăng tốc độ sắp xếp và truy vấn hóa đơn gần nhất cho quầy thu ngân.
CREATE INDEX IF NOT EXISTS idx_sale_transactions_created_at_desc 
ON sale_transactions(created_at DESC);

-- Composite index: Tối ưu lọc nhanh theo tab Tiền mặt (Cash), Chuyển khoản (Transfer), Nợ (Debt)
CREATE INDEX IF NOT EXISTS idx_sale_transactions_composite_method_date 
ON sale_transactions(payment_method, created_at DESC);

-- Composite index: Tối ưu lọc trạng thái nợ (DEBT, PARTIAL, PAID)
CREATE INDEX IF NOT EXISTS idx_sale_transactions_payment_status 
ON sale_transactions(payment_status, created_at DESC);

-- 3. Tối ưu tìm kiếm và nạp danh mục 3.000+ sản phẩm
CREATE INDEX IF NOT EXISTS idx_products_category 
ON products(category);

CREATE INDEX IF NOT EXISTS idx_products_updated_at_desc 
ON products(updated_at DESC);

-- Đảm bảo index mã vạch cho sản phẩm và các đơn vị con (Piece, Pack, Carton)
CREATE INDEX IF NOT EXISTS idx_products_barcode 
ON products(barcode);

CREATE INDEX IF NOT EXISTS idx_product_units_barcode 
ON product_units(barcode);

CREATE INDEX IF NOT EXISTS idx_product_units_product_id 
ON product_units(product_id);

-- 4. Tối ưu bảng thẻ kho / biến động kho nếu có
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory_movements') THEN
        CREATE INDEX IF NOT EXISTS idx_inv_movements_prod_date ON inventory_movements(product_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_inv_movements_tx_id ON inventory_movements(reference_id);
    END IF;
END $$;
