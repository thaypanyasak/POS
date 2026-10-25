-- ============================================================================
-- MIGRATION: NHÓM SẢN PHẨM ĐÓNG THÙNG MIX MÀU / MIX VỊ (MIXED CARTON BUNDLE)
-- HỆ THỐNG BÁN LẺ & ERP MEIISHOP POS
-- ============================================================================
-- 1. Tạo bảng định nghĩa nhóm thùng mix: public.product_bundles
-- 2. Tạo bảng quan hệ sản phẩm vị con: public.product_bundle_items
-- 3. Bổ sung cột bundle_components vào bảng sale_transaction_items
-- 4. Nâng cấp RPC nguyên tử: process_pos_checkout (Khóa dòng & Trừ kho từng vị con)
-- 5. Nâng cấp RPC nguyên tử: process_pos_void (Hoàn kho từng vị con khi hủy đơn)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BẢNG ĐỊNH NGHĨA NHÓM THÙNG MIX (public.product_bundles)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_bundles (
    id TEXT PRIMARY KEY DEFAULT ('bnd_' || substring(gen_random_uuid()::text from 1 for 12)),
    name TEXT NOT NULL,                                 -- Tên thùng tiếng Lào (vd: ນົມກ່ອງ ລວມລົດຊາດ ຍກລັງ 24 ກ່ອງ)
    name_vi TEXT,                                       -- Tên tiếng Việt (vd: Thùng sữa 24 hộp mix vị)
    package_qty INT4 NOT NULL DEFAULT 24,              -- Quy cách đóng thùng (vd: 24 lon / hộp)
    unit_name TEXT NOT NULL DEFAULT 'ແກັດ',            -- Đơn vị thùng (vd: ແກັດ, ລັງ, ຖັງ)
    base_unit_name TEXT NOT NULL DEFAULT 'ອັນ',        -- Đơn vị con cơ sở (vd: ກ່ອງ, ອັນ, ຕຸກ, ກະປ໋ອງ)
    price_lak INT8 NOT NULL DEFAULT 0,                 -- Giá bán 1 thùng nguyên bằng Kip
    price_thb NUMERIC(12, 2) DEFAULT 0.00,             -- Giá bán 1 thùng nguyên bằng Baht
    barcode TEXT,                                      -- Mã vạch đại diện của thùng (nếu có)
    image_url TEXT,                                    -- Ảnh đại diện thùng
    is_active BOOLEAN NOT NULL DEFAULT true,           -- Trạng thái kinh doanh
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index tra cứu bundle
CREATE INDEX IF NOT EXISTS idx_product_bundles_is_active ON public.product_bundles(is_active);
CREATE INDEX IF NOT EXISTS idx_product_bundles_barcode ON public.product_bundles(barcode);

-- Cấp quyền RLS
ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_bundles' AND policyname = 'Allow all actions on product_bundles') THEN
        CREATE POLICY "Allow all actions on product_bundles" ON public.product_bundles FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 2. BẢNG QUAN HỆ SẢN PHẨM VỊ CON THÀNH PHẦN (public.product_bundle_items)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_bundle_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id TEXT NOT NULL REFERENCES public.product_bundles(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sort_order INT4 NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bundle_id, product_id)
);

-- Index tra cứu bundle items
CREATE INDEX IF NOT EXISTS idx_product_bundle_items_bundle_id ON public.product_bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_product_bundle_items_product_id ON public.product_bundle_items(product_id);

-- Cấp quyền RLS
ALTER TABLE public.product_bundle_items ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_bundle_items' AND policyname = 'Allow all actions on product_bundle_items') THEN
        CREATE POLICY "Allow all actions on product_bundle_items" ON public.product_bundle_items FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 3. BỔ SUNG CỘT bundle_components VÀO sale_transaction_items
-- ----------------------------------------------------------------------------
ALTER TABLE public.sale_transaction_items
ADD COLUMN IF NOT EXISTS bundle_components JSONB;


-- ----------------------------------------------------------------------------
-- 4. FUNCTION NGUYÊN TỬ NÂNG CẤP: process_pos_checkout(payload JSONB)
-- ----------------------------------------------------------------------------
-- Hỗ trợ đầy đủ cả sản phẩm lẻ truyền thống VÀ Thùng mix vị:
-- - Nếu item có bundle_components: Khóa dòng FOR UPDATE và trừ tồn kho trực tiếp
--   từng mã sản phẩm vị con, ghi nhận Thẻ kho với chú thích tên thùng mix.
-- - Nếu item là sản phẩm thường: 100% logic cũ được thực thi không thay đổi.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_pos_checkout(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tx_id TEXT;
    v_receipt_number TEXT;
    v_created_at TIMESTAMPTZ;
    v_is_wholesale BOOLEAN;
    v_customer_name TEXT;
    v_payment_method TEXT;
    v_subtotal INT8;
    v_discount_total INT8;
    v_grand_total INT8;
    v_amount_tendered INT8;
    v_change_amount INT8;
    v_total_cost_lak INT8;
    v_total_cost_thb NUMERIC(12, 2);
    v_gross_profit_lak INT8;
    v_gross_profit_thb NUMERIC(12, 2);
    v_cashier_name TEXT;
    v_paid_amount INT8;
    v_remaining_debt INT8;
    v_payment_status TEXT;
    v_exchange_rate NUMERIC(12, 2);
    v_total_lak INT8;
    v_total_thb NUMERIC(12, 2);
    
    v_items JSONB;
    v_item JSONB;
    v_item_count INT := 0;
    v_prod_id TEXT;
    v_prod_name TEXT;
    v_qty_sold INT8;
    v_multiplier INT4;
    v_base_qty_sold INT8;
    v_current_stock INT8;
    v_track_stock BOOLEAN;
    v_allow_negative_stock BOOLEAN;
    v_unit_cost INT8;
    v_balance_after INT8;

    -- Biến phụ trợ cho Bundle components
    v_bundle_comps JSONB;
    v_comp_elem JSONB;
    v_comp_count INT := 0;
    v_comp_prod_id TEXT;
    v_comp_name TEXT;
    v_comp_qty INT8;
    v_comp_curr_stock INT8;
    v_comp_track_stock BOOLEAN;
    v_comp_allow_neg BOOLEAN;
    v_comp_cost INT8;
    v_comp_balance_after INT8;
BEGIN
    -- 1. Trích xuất Header thông tin thanh toán
    v_tx_id := payload->>'id';
    IF v_tx_id IS NULL OR trim(v_tx_id) = '' THEN
        RAISE EXCEPTION 'Mã giao dịch (id) không được để trống!';
    END IF;

    v_receipt_number := COALESCE(payload->>'receipt_number', payload->>'receiptNumber', 'REC-' || to_char(NOW(), 'YYYYMMDD-HH24MISS'));
    v_created_at := COALESCE((payload->>'created_at')::TIMESTAMPTZ, NOW());
    v_is_wholesale := COALESCE((payload->>'is_wholesale')::BOOLEAN, false);
    v_customer_name := COALESCE(payload->>'customer_name', payload->>'customerName', 'ລູກຄ້າທົ່ວໄປ');
    v_payment_method := COALESCE(payload->>'payment_method', payload->>'paymentMethod', 'cash');
    
    v_subtotal := COALESCE((payload->>'subtotal')::INT8, 0);
    v_discount_total := COALESCE((payload->>'discount_total')::INT8, 0);
    v_grand_total := COALESCE((payload->>'grand_total')::INT8, 0);
    v_amount_tendered := COALESCE((payload->>'amount_tendered')::INT8, 0);
    v_change_amount := COALESCE((payload->>'change_amount')::INT8, 0);
    
    v_total_cost_lak := COALESCE((payload->>'total_cost_lak')::INT8, (payload->>'total_cost')::INT8, 0);
    v_total_cost_thb := COALESCE((payload->>'total_cost_thb')::NUMERIC, 0.00);
    v_gross_profit_lak := COALESCE((payload->>'gross_profit_lak')::INT8, (payload->>'gross_profit')::INT8, 0);
    v_gross_profit_thb := COALESCE((payload->>'gross_profit_thb')::NUMERIC, 0.00);
    
    v_cashier_name := COALESCE(payload->>'cashier_name', 'ໄມ້ຄຳ (Meii)');
    v_paid_amount := COALESCE((payload->>'paid_amount')::INT8, v_grand_total);
    v_remaining_debt := COALESCE((payload->>'remaining_debt')::INT8, 0);
    v_payment_status := COALESCE(payload->>'payment_status', 'PAID');
    
    v_exchange_rate := COALESCE((payload->>'exchange_rate')::NUMERIC, 0.00);
    v_total_lak := COALESCE((payload->>'total_lak')::INT8, v_grand_total);
    v_total_thb := COALESCE((payload->>'total_thb')::NUMERIC, 0.00);

    -- 2. Upsert vào bảng sale_transactions
    INSERT INTO public.sale_transactions (
        id,
        receipt_number,
        created_at,
        is_wholesale,
        customer_name,
        payment_method,
        subtotal,
        discount_total,
        grand_total,
        amount_tendered,
        change_amount,
        total_cost,
        total_cost_lak,
        total_cost_thb,
        gross_profit,
        gross_profit_lak,
        gross_profit_thb,
        cashier_name,
        status,
        exchange_rate,
        total_lak,
        total_thb
    ) VALUES (
        v_tx_id,
        v_receipt_number,
        v_created_at,
        v_is_wholesale,
        v_customer_name,
        v_payment_method,
        v_subtotal,
        v_discount_total,
        v_grand_total,
        v_amount_tendered,
        v_change_amount,
        v_total_cost_lak,
        v_total_cost_lak,
        v_total_cost_thb,
        v_gross_profit_lak,
        v_gross_profit_lak,
        v_gross_profit_thb,
        v_cashier_name,
        'COMPLETED',
        v_exchange_rate,
        v_total_lak,
        v_total_thb
    )
    ON CONFLICT (id) DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        payment_method = EXCLUDED.payment_method,
        grand_total = EXCLUDED.grand_total,
        amount_tendered = EXCLUDED.amount_tendered,
        change_amount = EXCLUDED.change_amount,
        total_cost = EXCLUDED.total_cost,
        total_cost_lak = EXCLUDED.total_cost_lak,
        total_cost_thb = EXCLUDED.total_cost_thb,
        gross_profit = EXCLUDED.gross_profit,
        gross_profit_lak = EXCLUDED.gross_profit_lak,
        gross_profit_thb = EXCLUDED.gross_profit_thb,
        exchange_rate = EXCLUDED.exchange_rate,
        total_lak = EXCLUDED.total_lak,
        total_thb = EXCLUDED.total_thb;

    -- 3. Xử lý các dòng sản phẩm (sale_transaction_items) & Trừ kho nguyên tử
    v_items := payload->'items';
    IF v_items IS NOT NULL AND jsonb_array_length(v_items) > 0 THEN
        v_item_count := jsonb_array_length(v_items);
        
        -- Xóa các item cũ nếu đây là lệnh update/ghi đè
        DELETE FROM public.sale_transaction_items WHERE transaction_id = v_tx_id;

        FOR i IN 0..(v_item_count - 1) LOOP
            v_item := v_items->i;
            v_prod_id := COALESCE(v_item->>'product_id', v_item->>'productId');
            v_prod_name := COALESCE(v_item->>'product_name', v_item->>'productName', 'ສິນຄ້າ');
            v_qty_sold := COALESCE((v_item->>'quantity')::INT8, 1);
            v_multiplier := COALESCE((v_item->>'multiplier')::INT4, 1);
            v_base_qty_sold := v_qty_sold * v_multiplier;
            v_bundle_comps := v_item->'bundle_components';

            -- Insert vào sale_transaction_items (bao gồm bundle_components nếu có)
            INSERT INTO public.sale_transaction_items (
                id,
                transaction_id,
                product_id,
                product_name,
                unit_name,
                multiplier,
                quantity,
                unit_price,
                line_total,
                line_cost,
                line_profit,
                bundle_components
            ) VALUES (
                COALESCE(v_item->>'id', gen_random_uuid()::TEXT),
                v_tx_id,
                v_prod_id,
                v_prod_name,
                COALESCE(v_item->>'unit_name', v_item->>'unitName', 'ອັນ'),
                v_multiplier,
                v_qty_sold,
                COALESCE((v_item->>'unit_price')::INT8, 0),
                COALESCE((v_item->>'line_total')::INT8, 0),
                COALESCE((v_item->>'line_cost')::INT8, 0),
                COALESCE((v_item->>'line_profit')::INT8, 0),
                v_bundle_comps
            );

            -- =================================================================
            -- KHÓA DÒNG & TRỪ TỒN KHO NGUYÊN TỬ (ROW-LEVEL LOCKING)
            -- =================================================================
            
            -- TRƯỜNG HỢP A: SẢN PHẨM LÀ THÙNG MIX VỊ (Có mảng bundle_components)
            IF v_bundle_comps IS NOT NULL AND jsonb_typeof(v_bundle_comps) = 'array' AND jsonb_array_length(v_bundle_comps) > 0 THEN
                v_comp_count := jsonb_array_length(v_bundle_comps);
                FOR c IN 0..(v_comp_count - 1) LOOP
                    v_comp_elem := v_bundle_comps->c;
                    v_comp_prod_id := COALESCE(v_comp_elem->>'product_id', v_comp_elem->>'productId');
                    v_comp_qty := COALESCE((v_comp_elem->>'quantity')::INT8, 1);
                    v_comp_name := COALESCE(v_comp_elem->>'product_name', v_comp_elem->>'productName', 'ສິນຄ້າລວມ');

                    IF v_comp_prod_id IS NOT NULL AND v_comp_prod_id != '' AND v_comp_qty > 0 THEN
                        -- Khóa dòng sản phẩm con
                        SELECT 
                            COALESCE(current_stock_base_units, 0), 
                            COALESCE(track_stock, true),
                            COALESCE(cost_per_base_unit, 0),
                            COALESCE(allow_negative_stock, true)
                        INTO v_comp_curr_stock, v_comp_track_stock, v_comp_cost, v_comp_allow_neg
                        FROM public.products
                        WHERE id = v_comp_prod_id
                        FOR UPDATE;

                        IF FOUND AND v_comp_track_stock THEN
                            IF NOT v_comp_allow_neg AND v_comp_curr_stock < v_comp_qty THEN
                                RAISE EXCEPTION 'ລົດຊາດ % ບໍ່ພໍຂາຍໃນສາງ (Current stock: %, Cần: %)', v_comp_name, v_comp_curr_stock, v_comp_qty;
                            END IF;

                            v_comp_balance_after := v_comp_curr_stock - v_comp_qty;

                            UPDATE public.products
                            SET current_stock_base_units = v_comp_balance_after,
                                updated_at = NOW()
                            WHERE id = v_comp_prod_id;

                            -- Ghi nhận Thẻ kho cho sản phẩm con
                            INSERT INTO public.inventory_movements (
                                product_id,
                                product_name,
                                movement_type,
                                reference_type,
                                reference_id,
                                quantity_change,
                                balance_before,
                                balance_after,
                                unit_cost_lak,
                                note,
                                created_at,
                                created_by
                            ) VALUES (
                                v_comp_prod_id,
                                v_comp_name,
                                'OUT_SALE',
                                'SALE_TRANSACTION',
                                v_tx_id,
                                -v_comp_qty,
                                v_comp_curr_stock,
                                v_comp_balance_after,
                                v_comp_cost,
                                'ຂາຍຍົກລັງລວມ (' || v_prod_name || ') ບິນ: ' || v_receipt_number,
                                v_created_at,
                                v_cashier_name
                            );
                        END IF;
                    END IF;
                END LOOP;

            -- TRƯỜNG HỢP B: SẢN PHẨM LẺ THÔNG THƯỜNG (Giữ nguyên 100% logic cũ)
            ELSIF v_prod_id IS NOT NULL AND v_prod_id != '' AND v_prod_id NOT LIKE 'p_custom%' AND v_prod_id NOT LIKE 'bnd_%' THEN
                -- Khóa dòng sản phẩm để ngăn race condition giữa 2 thu ngân
                SELECT 
                    COALESCE(current_stock_base_units, 0), 
                    COALESCE(track_stock, true),
                    COALESCE(cost_per_base_unit, 0),
                    COALESCE(allow_negative_stock, true)
                INTO v_current_stock, v_track_stock, v_unit_cost, v_allow_negative_stock
                FROM public.products
                WHERE id = v_prod_id
                FOR UPDATE;

                IF FOUND AND v_track_stock THEN
                    -- Chỉ chặn nếu sản phẩm BẬT track_stock VÀ CẤM bán âm
                    IF NOT v_allow_negative_stock AND v_current_stock < v_base_qty_sold THEN
                        RAISE EXCEPTION 'ສິນຄ້າ % ບໍ່ພໍຂາຍໃນສາງ (Current stock: %)', v_prod_name, v_current_stock;
                    END IF;
                    v_balance_after := v_current_stock - v_base_qty_sold;

                    -- Cập nhật tồn kho mới
                    UPDATE public.products
                    SET current_stock_base_units = v_balance_after,
                        updated_at = NOW()
                    WHERE id = v_prod_id;

                    -- Ghi nhận Thẻ kho (public.inventory_movements)
                    INSERT INTO public.inventory_movements (
                        product_id,
                        product_name,
                        movement_type,
                        reference_type,
                        reference_id,
                        quantity_change,
                        balance_before,
                        balance_after,
                        unit_cost_lak,
                        note,
                        created_at,
                        created_by
                    ) VALUES (
                        v_prod_id,
                        v_prod_name,
                        'OUT_SALE',
                        'SALE_TRANSACTION',
                        v_tx_id,
                        -v_base_qty_sold,
                        v_current_stock,
                        v_balance_after,
                        v_unit_cost,
                        'ຂາຍໜ້າຮ້ານບິນ: ' || v_receipt_number,
                        v_created_at,
                        v_cashier_name
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 4. Trả về kết quả thành công
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'receipt_number', v_receipt_number,
        'grand_total', v_grand_total,
        'items_count', v_item_count,
        'message', 'POS checkout processed successfully with mixed carton and atomic row lock'
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_pos_checkout(JSONB) TO anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 5. FUNCTION NGUYÊN TỬ NÂNG CẤP: process_pos_void(payload JSONB)
-- ----------------------------------------------------------------------------
-- Tự động hoàn kho cho cả sản phẩm thường và từng vị con của thùng mix
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_pos_void(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tx_id TEXT := payload->>'transaction_id';
    v_voided_by TEXT := COALESCE(payload->>'voided_by', 'ໄມ້ຄຳ (Meii)');
    v_reason TEXT := COALESCE(payload->>'reason', 'ຍົກເລີກບິນຂາຍ (Void Order)');
    v_movement_type TEXT := COALESCE(payload->>'movement_type', 'VOID_RESTORE');
    v_tx RECORD;
    v_item RECORD;
    v_prod RECORD;
    v_units_restored INT8;
    v_old_stock INT8;
    v_new_stock INT8;
    v_custom_items JSONB := payload->'items';
    v_elem JSONB;
    v_p_id TEXT;
    v_p_units INT8;
    v_p_name TEXT;
    v_comp_elem JSONB;
    v_comp_pid TEXT;
    v_comp_qty INT8;
    v_comp_pname TEXT;
BEGIN
    IF v_tx_id IS NULL OR trim(v_tx_id) = '' THEN
        RAISE EXCEPTION 'Mã hóa đơn không hợp lệ hoặc để trống';
    END IF;

    -- 1. Khóa hóa đơn để tránh race condition
    SELECT * INTO v_tx
    FROM public.sale_transactions
    WHERE id = v_tx_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hóa đơn ID: %', v_tx_id;
    END IF;

    IF v_tx.status = 'VOIDED' THEN
        RAISE EXCEPTION 'Hóa đơn % đã ở trạng thái hủy (VOIDED) trước đó', v_tx_id;
    END IF;

    -- 2. Đổi trạng thái hóa đơn sang VOIDED
    UPDATE public.sale_transactions
    SET 
        status = 'VOIDED',
        voided_at = NOW(),
        voided_by = v_voided_by,
        void_reason = v_reason,
        payment_method = CASE 
            WHEN payment_method LIKE 'cancelled:%' THEN payment_method 
            ELSE 'cancelled:' || payment_method 
        END
    WHERE id = v_tx_id;

    -- 3. Phục hồi tồn kho sản phẩm và ghi Thẻ kho
    -- Ưu tiên 3A: Nếu payload truyền danh sách items cụ thể
    IF v_custom_items IS NOT NULL AND jsonb_typeof(v_custom_items) = 'array' AND jsonb_array_length(v_custom_items) > 0 THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_custom_items)
        LOOP
            v_p_id := v_elem->>'product_id';
            v_p_units := COALESCE((v_elem->>'units_to_restore')::BIGINT, (v_elem->>'unitsToRestore')::BIGINT, 0);
            v_p_name := COALESCE(v_elem->>'product_name', v_elem->>'productName', 'ສິນຄ້າ');

            IF v_p_id IS NOT NULL AND v_p_units > 0 THEN
                SELECT * INTO v_prod FROM public.products WHERE id = v_p_id FOR UPDATE;
                IF FOUND AND v_prod.track_stock THEN
                    v_old_stock := COALESCE(v_prod.current_stock_base_units, 0);
                    v_new_stock := v_old_stock + v_p_units;

                    UPDATE public.products
                    SET current_stock_base_units = v_new_stock,
                        updated_at = NOW()
                    WHERE id = v_p_id;

                    INSERT INTO public.inventory_movements (
                        product_id,
                        product_name,
                        movement_type,
                        reference_type,
                        reference_id,
                        quantity_change,
                        balance_before,
                        balance_after,
                        unit_cost_lak,
                        note,
                        created_at,
                        created_by
                    ) VALUES (
                        v_p_id,
                        v_p_name,
                        v_movement_type,
                        'SALE_TRANSACTION',
                        v_tx_id,
                        v_p_units,
                        v_old_stock,
                        v_new_stock,
                        COALESCE(v_prod.cost_per_base_unit, 0),
                        'ຄືນສິນຄ້າເຂົ້າສາງຈາກການຍົກເລີກບິນ: ' || v_tx.receipt_number || ' (ເຫດຜົນ: ' || v_reason || ')',
                        NOW(),
                        v_voided_by
                    );
                END IF;
            END IF;
        END LOOP;

    -- 3B: Tự động phục hồi từ bảng sale_transaction_items
    ELSE
        FOR v_item IN SELECT * FROM public.sale_transaction_items WHERE transaction_id = v_tx_id
        LOOP
            -- Nếu item có bundle_components: Hoàn kho cho từng vị con
            IF v_item.bundle_components IS NOT NULL AND jsonb_typeof(v_item.bundle_components) = 'array' AND jsonb_array_length(v_item.bundle_components) > 0 THEN
                FOR v_comp_elem IN SELECT * FROM jsonb_array_elements(v_item.bundle_components)
                LOOP
                    v_comp_pid := v_comp_elem->>'product_id';
                    v_comp_qty := COALESCE((v_comp_elem->>'quantity')::BIGINT, 1);
                    v_comp_pname := COALESCE(v_comp_elem->>'product_name', 'ສິນຄ້າລວມ');

                    IF v_comp_pid IS NOT NULL AND v_comp_qty > 0 THEN
                        SELECT * INTO v_prod FROM public.products WHERE id = v_comp_pid FOR UPDATE;
                        IF FOUND AND v_prod.track_stock THEN
                            v_old_stock := COALESCE(v_prod.current_stock_base_units, 0);
                            v_new_stock := v_old_stock + v_comp_qty;

                            UPDATE public.products
                            SET current_stock_base_units = v_new_stock,
                                updated_at = NOW()
                            WHERE id = v_comp_pid;

                            INSERT INTO public.inventory_movements (
                                product_id,
                                product_name,
                                movement_type,
                                reference_type,
                                reference_id,
                                quantity_change,
                                balance_before,
                                balance_after,
                                unit_cost_lak,
                                note,
                                created_at,
                                created_by
                            ) VALUES (
                                v_comp_pid,
                                v_comp_pname,
                                v_movement_type,
                                'SALE_TRANSACTION',
                                v_tx_id,
                                v_comp_qty,
                                v_old_stock,
                                v_new_stock,
                                COALESCE(v_prod.cost_per_base_unit, 0),
                                'ຄືນສິນຄ້າລວມ (' || v_item.product_name || ') ຈາກການຍົກເລີກບິນ: ' || v_tx.receipt_number,
                                NOW(),
                                v_voided_by
                            );
                        END IF;
                    END IF;
                END LOOP;
            
            -- Sản phẩm thông thường
            ELSIF v_item.product_id IS NOT NULL AND v_item.product_id NOT LIKE 'p_custom%' AND v_item.product_id NOT LIKE 'bnd_%' THEN
                v_units_restored := COALESCE(v_item.quantity, 0) * COALESCE(v_item.multiplier, 1);
                IF v_units_restored > 0 THEN
                    SELECT * INTO v_prod FROM public.products WHERE id = v_item.product_id FOR UPDATE;
                    IF FOUND AND v_prod.track_stock THEN
                        v_old_stock := COALESCE(v_prod.current_stock_base_units, 0);
                        v_new_stock := v_old_stock + v_units_restored;

                        UPDATE public.products
                        SET current_stock_base_units = v_new_stock,
                            updated_at = NOW()
                        WHERE id = v_item.product_id;

                        INSERT INTO public.inventory_movements (
                            product_id,
                            product_name,
                            movement_type,
                            reference_type,
                            reference_id,
                            quantity_change,
                            balance_before,
                            balance_after,
                            unit_cost_lak,
                            note,
                            created_at,
                            created_by
                        ) VALUES (
                            v_item.product_id,
                            v_item.product_name,
                            v_movement_type,
                            'SALE_TRANSACTION',
                            v_tx_id,
                            v_units_restored,
                            v_old_stock,
                            v_new_stock,
                            COALESCE(v_prod.cost_per_base_unit, 0),
                            'ຄືນສິນຄ້າເຂົ້າສາງຈາກການຍົກເລີກບິນ: ' || v_tx.receipt_number || ' (ເຫດຜົນ: ' || v_reason || ')',
                            NOW(),
                            v_voided_by
                        );
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'receipt_number', v_tx.receipt_number,
        'status', 'VOIDED',
        'message', 'Transaction voided successfully and mixed carton stock restored atomically'
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_pos_void(JSONB) TO anon, authenticated, service_role;
