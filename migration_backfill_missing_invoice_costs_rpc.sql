-- ============================================================================
-- Migration: backfill_missing_invoice_costs RPC (Zero-Egress Database-Side)
-- Tự động bù giá vốn (Backfill Cost) cho các hóa đơn cũ
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ============================================================================

-- 1. Đảm bảo các cột chi phí và lợi nhuận đầy đủ trên các bảng
ALTER TABLE public.sale_transaction_items 
ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost NUMERIC DEFAULT 0;

ALTER TABLE public.sale_transactions
ADD COLUMN IF NOT EXISTS total_profit NUMERIC DEFAULT 0;

-- 2. Tạo function PostgreSQL xử lý 100% tại Database
CREATE OR REPLACE FUNCTION public.backfill_missing_invoice_costs(
    p_transaction_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_prod RECORD;
    v_calc_cost NUMERIC := 0;
    v_line_cost NUMERIC := 0;
    v_line_profit NUMERIC := 0;
    v_is_half_carton BOOLEAN := FALSE;
    v_carton_multiplier NUMERIC := 24;
    v_unit_mult NUMERIC := 1;
    v_bundle_unit_cost NUMERIC := 0;
    v_comp RECORD;
    v_updated_items_count INT := 0;
    v_updated_invoices_count INT := 0;
    v_affected_tx_ids TEXT[] := ARRAY[]::TEXT[];
    v_tx_id TEXT;
    v_sum_cost NUMERIC := 0;
BEGIN
    -- 1. Lặp qua các dòng sản phẩm chi tiết bị thiếu giá vốn
    -- Điều kiện thiếu vốn: line_cost = 0 OR line_cost IS NULL OR cost_price = 0 OR cost_price IS NULL
    FOR v_item IN
        SELECT 
            ti.id,
            ti.transaction_id,
            ti.product_id,
            ti.unit_name,
            COALESCE(ti.multiplier, 1) AS multiplier,
            COALESCE(ti.quantity, 1) AS quantity,
            COALESCE(ti.line_total, 0) AS line_total,
            COALESCE(ti.line_cost, 0) AS line_cost,
            COALESCE(ti.cost_price, 0) AS cost_price,
            ti.bundle_components
        FROM public.sale_transaction_items ti
        WHERE (p_transaction_id IS NULL OR ti.transaction_id = p_transaction_id)
          AND (COALESCE(ti.line_cost, 0) = 0 OR COALESCE(ti.cost_price, 0) = 0)
    LOOP
        -- Nếu dòng đã có line_cost hợp lệ (> 0) nhưng chỉ thiếu cost_price do cột mới thêm:
        IF v_item.line_cost > 0 AND v_item.cost_price = 0 THEN
            UPDATE public.sale_transaction_items
            SET 
                cost_price = ROUND(v_item.line_cost / GREATEST(v_item.quantity, 1)),
                total_cost = v_item.line_cost
            WHERE id = v_item.id;
            CONTINUE;
        END IF;

        v_calc_cost := 0;

        -- KIỂM TRA 1: HÀNG COMBO / BUNDLE (Nước ngọt mix vị, bia mix...)
        IF v_item.bundle_components IS NOT NULL AND jsonb_typeof(v_item.bundle_components) = 'array' AND jsonb_array_length(v_item.bundle_components) > 0 THEN
            v_bundle_unit_cost := 0;
            FOR v_comp IN 
                SELECT 
                    COALESCE(elem->>'product_id', elem->>'productId') AS comp_prod_id,
                    COALESCE((elem->>'quantity')::numeric, (elem->>'qty')::numeric, 1) AS comp_qty
                FROM jsonb_array_elements(v_item.bundle_components) AS elem
            LOOP
                SELECT COALESCE(cost_per_base_unit, 0)
                INTO v_calc_cost
                FROM public.products
                WHERE id = v_comp.comp_prod_id;

                v_bundle_unit_cost := v_bundle_unit_cost + (v_comp.comp_qty * COALESCE(v_calc_cost, 0));
            END LOOP;
            v_calc_cost := v_bundle_unit_cost;

        -- KIỂM TRA 2: BUNDLE THEO ID TRONG BẢNG product_bundles
        ELSIF v_item.product_id LIKE 'bnd_%' OR v_item.product_id LIKE 'bundle_%' THEN
            SELECT COALESCE(SUM(COALESCE(p.cost_per_base_unit, 0) * (pb.package_qty / GREATEST((SELECT count(*) FROM public.product_bundle_items WHERE bundle_id = pb.id), 1))), 0)
            INTO v_calc_cost
            FROM public.product_bundles pb
            JOIN public.product_bundle_items pbi ON pbi.bundle_id = pb.id
            JOIN public.products p ON p.id = pbi.product_id
            WHERE pb.id = v_item.product_id;

        -- KIỂM TRA 3: SẢN PHẨM THƯỜNG TRONG BẢNG products
        ELSIF v_item.product_id IS NOT NULL AND v_item.product_id <> '' AND v_item.product_id <> 'p_custom' THEN
            SELECT 
                p.id,
                COALESCE(p.cost_per_base_unit, 0) AS cost_per_base_unit,
                COALESCE(p.cost_lak, 0) AS cost_lak,
                COALESCE(p.cost_thb, 0) AS cost_thb
            INTO v_prod
            FROM public.products p
            WHERE p.id = v_item.product_id;

            IF FOUND AND (v_prod.cost_per_base_unit > 0 OR v_prod.cost_lak > 0) THEN
                -- Phát hiện nếu bán Nửa thùng (ເຄິ່ງແກັດ / 1/2 / ½)
                v_is_half_carton := (
                    v_item.unit_name ILIKE '%½%' 
                    OR v_item.unit_name ILIKE '%1/2%' 
                    OR v_item.unit_name ILIKE '%ເຄິ່ງ%'
                );

                -- Tra cứu hệ số quy đổi thùng carton cao nhất của sản phẩm
                SELECT COALESCE(multiplier, 24)
                INTO v_carton_multiplier
                FROM public.product_units
                WHERE product_id = v_item.product_id 
                  AND (unit_name ILIKE '%ແກັດ%' OR unit_name ILIKE '%ລັງ%' OR multiplier > 1)
                ORDER BY multiplier DESC
                LIMIT 1;

                IF v_carton_multiplier IS NULL OR v_carton_multiplier <= 0 THEN
                    v_carton_multiplier := 24;
                END IF;

                IF v_is_half_carton THEN
                    -- Bán nửa thùng: vốn bằng chính xác 50% vốn thùng nguyên
                    IF v_prod.cost_lak > 0 THEN
                        v_calc_cost := ROUND(v_prod.cost_lak::numeric / 2.0);
                    ELSIF v_prod.cost_per_base_unit > 0 THEN
                        v_calc_cost := ROUND(v_prod.cost_per_base_unit::numeric * (v_carton_multiplier::numeric / 2.0));
                    END IF;
                ELSE
                    -- Tra cứu hệ số quy đổi theo đúng tên đơn vị bán (Carton, Pack, Unit...)
                    SELECT multiplier
                    INTO v_unit_mult
                    FROM public.product_units
                    WHERE product_id = v_item.product_id 
                      AND TRIM(unit_name) = TRIM(v_item.unit_name)
                    LIMIT 1;

                    IF v_unit_mult IS NULL OR v_unit_mult <= 0 THEN
                        v_unit_mult := COALESCE(NULLIF(v_item.multiplier, 0), 1);
                    END IF;

                    -- Tính vốn theo cost_per_base_unit hoặc cost_lak
                    IF v_prod.cost_per_base_unit > 0 THEN
                        v_calc_cost := ROUND(v_prod.cost_per_base_unit::numeric * v_unit_mult::numeric);
                    ELSIF v_prod.cost_lak > 0 THEN
                        IF v_item.unit_name ILIKE '%ແກັດ%' OR v_item.unit_name ILIKE '%ລັງ%' THEN
                            v_calc_cost := v_prod.cost_lak;
                        ELSE
                            v_calc_cost := ROUND((v_prod.cost_lak::numeric / v_carton_multiplier::numeric) * v_unit_mult::numeric);
                        END IF;
                    END IF;
                END IF;
            END IF;
        END IF;

        -- Nếu tính được giá vốn hợp lệ (> 0), tiến hành cập nhật dòng chi tiết
        IF v_calc_cost > 0 THEN
            v_line_cost := v_calc_cost * v_item.quantity;
            v_line_profit := v_item.line_total - v_line_cost;

            UPDATE public.sale_transaction_items
            SET 
                cost_price = v_calc_cost,
                total_cost = v_line_cost,
                line_cost = v_line_cost,
                line_profit = v_line_profit
            WHERE id = v_item.id;

            v_updated_items_count := v_updated_items_count + 1;

            IF NOT (v_item.transaction_id = ANY(v_affected_tx_ids)) THEN
                v_affected_tx_ids := array_append(v_affected_tx_ids, v_item.transaction_id);
            END IF;
        END IF;
    END LOOP;

    -- 2. Cập nhật lại tổng hóa đơn sale_transactions cho tất cả các đơn bị ảnh hưởng
    IF array_length(v_affected_tx_ids, 1) > 0 THEN
        FOREACH v_tx_id IN ARRAY v_affected_tx_ids
        LOOP
            -- Tính lại tổng vốn từ các dòng chi tiết
            SELECT COALESCE(SUM(COALESCE(line_cost, total_cost, 0)), 0)
            INTO v_sum_cost
            FROM public.sale_transaction_items
            WHERE transaction_id = v_tx_id;

            UPDATE public.sale_transactions
            SET
                total_cost = v_sum_cost,
                total_cost_lak = v_sum_cost,
                total_cost_thb = CASE 
                    WHEN COALESCE(exchange_rate, 0) > 0 THEN ROUND((v_sum_cost / exchange_rate)::numeric, 2) 
                    ELSE total_cost_thb 
                END,
                gross_profit = COALESCE(grand_total, total_lak, subtotal, 0) - v_sum_cost,
                gross_profit_lak = COALESCE(grand_total, total_lak, subtotal, 0) - v_sum_cost,
                gross_profit_thb = CASE 
                    WHEN COALESCE(exchange_rate, 0) > 0 THEN ROUND(((COALESCE(grand_total, total_lak, subtotal, 0) - v_sum_cost) / exchange_rate)::numeric, 2) 
                    ELSE gross_profit_thb 
                END,
                total_profit = COALESCE(grand_total, total_lak, subtotal, 0) - v_sum_cost
            WHERE id = v_tx_id;

            v_updated_invoices_count := v_updated_invoices_count + 1;
        END LOOP;
    END IF;

    -- 3. Trả về kết quả JSON gọn gàng (< 1 KB Egress)
    RETURN jsonb_build_object(
        'success', true,
        'updated_items', v_updated_items_count,
        'updated_invoices', v_updated_invoices_count
    );
END;
$$;

-- Phân quyền thực thi cho các role trong Supabase
GRANT EXECUTE ON FUNCTION public.backfill_missing_invoice_costs(TEXT) TO authenticated, service_role, anon;
