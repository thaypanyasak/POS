-- ============================================================================
-- MeiiShop POS - Supabase PostgreSQL Database Schema
-- ກະລຸນາກັອບປີ້ script ນີ້ໄປ run ທີ່ Supabase SQL Editor (https://supabase.com)
-- ============================================================================

-- 1. ຕາຕະລາງສິນຄ້າ (Products)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    barcode TEXT,
    image_url TEXT,
    base_unit TEXT NOT NULL,
    cost_per_base_unit BIGINT NOT NULL DEFAULT 0,
    current_stock_base_units BIGINT NOT NULL DEFAULT 0,
    track_stock BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ຕາຕະລາງຫົວໜ່ວຍບັນຈຸຫຼາຍລະດັບ (Product Multi-Tier Units: ແກັດ, ແພັກ, ອັນ)
CREATE TABLE IF NOT EXISTS product_units (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_name TEXT NOT NULL,
    multiplier INT NOT NULL DEFAULT 1,
    retail_price BIGINT NOT NULL DEFAULT 0,
    wholesale_price BIGINT NOT NULL DEFAULT 0,
    price_2 BIGINT NOT NULL DEFAULT 0,
    price_3 BIGINT NOT NULL DEFAULT 0,
    barcode TEXT,
    is_base_unit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ຕາຕະລາງບິນຂາຍ (Sale Transactions)
CREATE TABLE IF NOT EXISTS sale_transactions (
    id TEXT PRIMARY KEY,
    receipt_number TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_wholesale BOOLEAN DEFAULT FALSE,
    customer_name TEXT,
    payment_method TEXT,
    subtotal BIGINT NOT NULL DEFAULT 0,
    discount_total BIGINT NOT NULL DEFAULT 0,
    grand_total BIGINT NOT NULL DEFAULT 0,
    amount_tendered BIGINT NOT NULL DEFAULT 0,
    change_amount BIGINT NOT NULL DEFAULT 0,
    total_cost BIGINT NOT NULL DEFAULT 0,
    gross_profit BIGINT NOT NULL DEFAULT 0,
    cashier_name TEXT DEFAULT 'ໄມ້ຄຳ (Meii)'
);

-- 4. ຕາຕະລາງລາຍການສິນຄ້າໃນແຕ່ລະບິນ (Sale Transaction Items)
CREATE TABLE IF NOT EXISTS sale_transaction_items (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES sale_transactions(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    multiplier INT NOT NULL DEFAULT 1,
    quantity INT NOT NULL DEFAULT 1,
    unit_price BIGINT NOT NULL DEFAULT 0,
    line_total BIGINT NOT NULL DEFAULT 0,
    line_cost BIGINT NOT NULL DEFAULT 0,
    line_profit BIGINT NOT NULL DEFAULT 0
);

-- 5. ເປີດໃຊ້ງານ Supabase Realtime ສຳລັບການ Sync ຫຼາຍເຄື່ອງພ້ອມກັນ
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE sale_transactions;

-- 6. ສ້າງດັດສະນີ (Indexes) ເພື່ອໃຫ້ການຄົ້ນຫາບາໂຄດ ແລະ ລາຍການສິນຄ້າໄວຂຶ້ນ
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_product_units_barcode ON product_units(barcode);
CREATE INDEX IF NOT EXISTS idx_product_units_product_id ON product_units(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_transactions_created_at ON sale_transactions(created_at);

-- 7. ເປີດສິດ Row Level Security (RLS) ແບບອະນຸຍາດອ່ານ/ຂຽນຜ່ານ Anon Key
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write for products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for product_units" ON product_units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for sale_transactions" ON sale_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for sale_transaction_items" ON sale_transaction_items FOR ALL USING (true) WITH CHECK (true);

-- 8. ຕັ້ງຄ່າ Supabase Storage ສຳລັບຮູບພາບສິນຄ້າ (Product Images Bucket)
-- ສ້າງ Bucket ຊື່ 'product-images' ແບບ Public
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ນະໂຍບາຍອະນຸຍາດໃຫ້ອັບໂຫຼດ, ອ່ານ, ແກ້ໄຂ ແລະ ລຶບຮູບພາບສິນຄ້າຜ່ານ Anon Key
CREATE POLICY "Allow public select product-images" ON storage.objects
    FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Allow public insert product-images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Allow public update product-images" ON storage.objects
    FOR UPDATE USING (bucket_id = 'product-images');

CREATE POLICY "Allow public delete product-images" ON storage.objects
    FOR DELETE USING (bucket_id = 'product-images');

