-- ============================================================================
-- MIGRATION: GỠ BỎ RÀNG BUỘC KHÓA NGOẠI CHẶN XÓA SẢN PHẨM & BẢO LƯU LỊCH SỬ
-- MEIISHOP POS - SUPABASE POSTGRESQL
-- ============================================================================
-- Mục đích:
-- 1. Cho phép xóa sản phẩm bình thường mà không bị lỗi:
--    "violates foreign key constraint inventory_movements_product_id_fkey"
-- 2. Bảo toàn 100% dữ liệu lịch sử trong Thẻ kho (inventory_movements),
--    Phiếu nhập kho (purchase_orders, purchase_order_items), và Hóa đơn bán lẻ
--    (sale_transactions, sale_transaction_items) - các bảng này vẫn lưu đầy đủ
--    tên sản phẩm, đơn vị, giá vốn, số lượng dù sản phẩm đã bị xóa khỏi danh mục bán.
-- 3. Bổ sung cột is_deleted vào bảng products để hỗ trợ cả cơ chế Soft Delete.
-- ============================================================================

-- Bước 1: Gỡ bỏ ràng buộc khóa ngoại chặn xóa (ON DELETE RESTRICT) trên bảng inventory_movements
ALTER TABLE public.inventory_movements 
DROP CONSTRAINT IF EXISTS inventory_movements_product_id_fkey;

-- Bước 2: Gỡ bỏ ràng buộc khóa ngoại chặn xóa trên bảng purchase_orders
ALTER TABLE public.purchase_orders 
DROP CONSTRAINT IF EXISTS purchase_orders_product_id_fkey;

-- Bước 3: Gỡ bỏ ràng buộc khóa ngoại chặn xóa trên bảng purchase_order_items (nếu có)
ALTER TABLE public.purchase_order_items 
DROP CONSTRAINT IF EXISTS purchase_order_items_product_id_fkey;

-- Bước 4: Thêm cột is_deleted vào bảng products (nếu chưa có)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_products_is_deleted ON public.products(is_deleted);

-- Bước 5: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
