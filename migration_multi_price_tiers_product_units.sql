-- ============================================================================
-- Migration: Đa bảng giá bán (Multi-Price Tiers: Giá 1, Giá 2, Giá 3)
-- Áp dụng cho bảng product_units trong Supabase PostgreSQL
-- ============================================================================

-- 1. Bổ sung các cột price_2 và price_3 vào bảng product_units nếu chưa tồn tại
ALTER TABLE product_units 
ADD COLUMN IF NOT EXISTS price_2 NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_3 NUMERIC DEFAULT 0;

-- 2. Thêm ghi chú tài liệu giải thích rõ ràng các cấp độ giá
COMMENT ON COLUMN product_units.retail_price IS 'ລາຄາ 1 (ມາດຕະຖານ) - Mức giá 1: ລູກຄ້າຂາຍຍ່ອຍ';
COMMENT ON COLUMN product_units.price_2 IS 'ລາຄາ 2 (ລູກຄ້າປະຈຳ) - Mức giá 2: ລູກຄ້າປະຈຳ';
COMMENT ON COLUMN product_units.price_3 IS 'ລາຄາ 3 (ລາຄາສົ່ງ) - Mức giá 3: ລາຄາສົ່ງ';

-- 3. Cập nhật các bản ghi hiện tại nếu price_2 hoặc price_3 đang NULL thì set về 0
UPDATE product_units 
SET price_2 = COALESCE(price_2, 0),
    price_3 = COALESCE(price_3, 0)
WHERE price_2 IS NULL OR price_3 IS NULL;
