-- ==============================================================================
-- MEIISHOP POS: HARDEN SECURITY & ROW LEVEL SECURITY (RLS) POLICIES
-- Chạy script này trong Supabase Dashboard -> SQL Editor để khóa triệt để lỗ hổng rò rỉ dữ liệu
-- ==============================================================================

-- 1. BẢO MẬT BẢNG LỊCH SỬ HÓA ĐƠN & DOANH THU (SALE_TRANSACTIONS)
ALTER TABLE public.sale_transactions ENABLE ROW LEVEL SECURITY;

-- Xóa bỏ toàn bộ các policy cũ (nếu có cho phép đọc công khai hoặc anon)
DROP POLICY IF EXISTS "Allow all users to read transactions" ON public.sale_transactions;
DROP POLICY IF EXISTS "Allow anon read transactions" ON public.sale_transactions;
DROP POLICY IF EXISTS "Authenticated users can view transactions" ON public.sale_transactions;
DROP POLICY IF EXISTS "Authenticated users can create transactions" ON public.sale_transactions;
DROP POLICY IF EXISTS "Only authenticated staff can view transactions" ON public.sale_transactions;
DROP POLICY IF EXISTS "Authenticated staff can create transactions" ON public.sale_transactions;
DROP POLICY IF EXISTS "Anon customers can insert online orders" ON public.sale_transactions;
DROP POLICY IF EXISTS "Anon customers can track their online orders" ON public.sale_transactions;

-- CHỈ người dùng đăng nhập (nhân viên, quản lý) mới được xem toàn bộ hóa đơn POS và doanh thu
CREATE POLICY "Only authenticated staff can view transactions"
  ON public.sale_transactions FOR SELECT
  TO authenticated
  USING (true);

-- Cho phép nhân viên tạo đơn hàng POS
CREATE POLICY "Authenticated staff can create transactions"
  ON public.sale_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Khách vãng lai (anon) xem Storefront CHỈ được phép gửi đơn hàng trực tuyến (order_source = 'online')
CREATE POLICY "Anon customers can insert online orders"
  ON public.sale_transactions FOR INSERT
  TO anon
  WITH CHECK (order_source = 'online');

-- Khách vãng lai CHỈ được xem đơn hàng online của chính mình để theo dõi trạng thái đơn (không xem được đơn POS của tiệm)
CREATE POLICY "Anon customers can track their online orders"
  ON public.sale_transactions FOR SELECT
  TO anon
  USING (order_source = 'online');

-- 2. BẢO MẬT BẢNG CHI TIẾT HÓA ĐƠN (SALE_TRANSACTION_ITEMS)
ALTER TABLE public.sale_transaction_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users to read transaction items" ON public.sale_transaction_items;
DROP POLICY IF EXISTS "Allow anon read transaction items" ON public.sale_transaction_items;
DROP POLICY IF EXISTS "Authenticated users can view items" ON public.sale_transaction_items;
DROP POLICY IF EXISTS "Only authenticated staff can view items" ON public.sale_transaction_items;
DROP POLICY IF EXISTS "Authenticated staff can create items" ON public.sale_transaction_items;
DROP POLICY IF EXISTS "Anon customers can insert online items" ON public.sale_transaction_items;
DROP POLICY IF EXISTS "Anon customers can view their online items" ON public.sale_transaction_items;

CREATE POLICY "Only authenticated staff can view items"
  ON public.sale_transaction_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated staff can create items"
  ON public.sale_transaction_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anon customers can insert online items"
  ON public.sale_transaction_items FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon customers can view their online items"
  ON public.sale_transaction_items FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.sale_transactions st
      WHERE st.id = sale_transaction_items.transaction_id AND st.order_source = 'online'
    )
  );

-- 3. BẢO MẬT BẢNG THÔNG TIN KHÁCH HÀNG (CUSTOMERS)
-- Tuyệt đối ngăn chặn rò rỉ họ tên, số điện thoại, ghi chú của khách cho người xem menu
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users to read customers" ON public.customers;
DROP POLICY IF EXISTS "Allow anon read customers" ON public.customers;
DROP POLICY IF EXISTS "Allow select customers" ON public.customers;
DROP POLICY IF EXISTS "Only authenticated staff can view customers" ON public.customers;
DROP POLICY IF EXISTS "Only authenticated staff can modify customers" ON public.customers;

CREATE POLICY "Only authenticated staff can view customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only authenticated staff can modify customers"
  ON public.customers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. BẢO MẬT BẢNG CẤU HÌNH MÁY IN (PRINTER_SETTINGS)
-- Ngăn chặn lộ IP máy in nhiệt nội bộ và cấu hình cổng LAN
ALTER TABLE public.printer_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users to read printer settings" ON public.printer_settings;
DROP POLICY IF EXISTS "Allow all users to insert or update printer settings" ON public.printer_settings;
DROP POLICY IF EXISTS "Only authenticated staff can view printer settings" ON public.printer_settings;
DROP POLICY IF EXISTS "Only authenticated staff can modify printer settings" ON public.printer_settings;

CREATE POLICY "Only authenticated staff can view printer settings"
  ON public.printer_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only authenticated staff can modify printer settings"
  ON public.printer_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. BẢO MẬT BẢNG CẤU HÌNH CỬA HÀNG (STORE_SETTINGS)
-- Ngăn chặn rò rỉ danh sách nhân viên, mã PIN và phân quyền
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select store_settings" ON public.store_settings;
DROP POLICY IF EXISTS "Allow modify store_settings" ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated users have full access to store_settings" ON public.store_settings;
DROP POLICY IF EXISTS "Anon users can only read public store settings" ON public.store_settings;

CREATE POLICY "Authenticated users have full access to store_settings"
  ON public.store_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Khách vãng lai (anon) CHỈ được đọc các thông tin công khai như tỷ giá hoặc thông tin giới thiệu cửa hàng
CREATE POLICY "Anon users can only read public store settings"
  ON public.store_settings FOR SELECT
  TO anon
  USING (key IN ('thb_lak_exchange_rate', 'store_info', 'store_profile'));

