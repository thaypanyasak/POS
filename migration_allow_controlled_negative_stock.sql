-- ============================================================================
-- MIGRATION: BÁN ÂM KHO CÓ KIỂM SOÁT & TỰ ĐỘNG CẤN TRỪ (CONTROLLED NEGATIVE STOCK)
-- HỆ THỐNG POS & ERP MEIISHOP
-- ============================================================================
-- 1. Gỡ bỏ mọi ràng buộc kiểm tra số dương trên products (nếu có)
-- 2. Bổ sung cột allow_negative_stock BOOLEAN DEFAULT TRUE vào public.products
-- 3. Cập nhật RPC process_pos_checkout: Không chặn bán âm trừ khi allow_negative_stock = FALSE
-- 4. Đảm bảo RPC process_multi_product_grn tự động cấn trừ bù số âm một cách tự nhiên
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BƯỚC 1: CẬP NHẬT CẤU TRÚC BẢNG public.products
-- ----------------------------------------------------------------------------
-- Gỡ bỏ mọi check constraint liên quan đến current_stock_base_units >= 0 (nếu có)
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_current_stock_base_units_check;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS check_positive_stock;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS stock_non_negative;

-- Bổ sung cột cấu hình bán âm (mặc định TRUE: cho phép bán âm để phục vụ nhanh)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN DEFAULT TRUE;

-- Cập nhật dữ liệu cũ
UPDATE public.products 
SET allow_negative_stock = TRUE 
WHERE allow_negative_stock IS NULL;

-- ----------------------------------------------------------------------------
-- BƯỚC 2: CẬP NHẬT RPC: process_pos_checkout(payload JSONB)
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

    -- 2. Insert vào bảng sale_transactions (Upsert)
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
        total_cost_lak = EXCLUDED.total_cost_lak,
        total_cost_thb = EXCLUDED.total_cost_thb,
        gross_profit_lak = EXCLUDED.gross_profit_lak,
        gross_profit_thb = EXCLUDED.gross_profit_thb,
        status = 'COMPLETED';

    -- 3. Xử lý từng dòng sản phẩm bán (sale_transaction_items)
    v_items := payload->'items';
    IF v_items IS NOT NULL AND jsonb_typeof(v_items) = 'array' THEN
        -- Xóa các item cũ nếu có
        DELETE FROM public.sale_transaction_items WHERE transaction_id = v_tx_id;

        FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
        LOOP
            v_item_count := v_item_count + 1;
            v_prod_id := v_item->>'product_id';
            v_prod_name := COALESCE(v_item->>'product_name', 'ສິນຄ້າ');
            v_qty_sold := COALESCE((v_item->>'quantity')::INT8, 1);
            v_multiplier := COALESCE((v_item->>'multiplier')::INT4, 1);
            v_base_qty_sold := v_qty_sold * v_multiplier;

            -- Insert vào sale_transaction_items
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
                line_profit
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
                COALESCE((v_item->>'line_profit')::INT8, 0)
            );

            -- =================================================================
            -- KHÓA DÒNG & TRỪ TỒN KHO NGUYÊN TỬ (HỖ TRỢ BÁN ÂM KHO CÓ KIỂM SOÁT)
            -- =================================================================
            IF v_prod_id IS NOT NULL AND v_prod_id != '' AND v_prod_id NOT LIKE 'p_custom%' THEN
                -- Khóa dòng sản phẩm để ngăn race condition giữa các thu ngân
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
                    -- CHỈ CHẶN NẾU SẢN PHẨM BẬT track_stock VÀ CẤM BÁN ÂM (allow_negative_stock = FALSE)
                    IF NOT v_allow_negative_stock AND v_current_stock < v_base_qty_sold THEN
                        RAISE EXCEPTION 'ສິນຄ້າ % ບໍ່ພໍຂາຍໃນສາງ (Current stock: %)', v_prod_name, v_current_stock;
                    END IF;

                    -- Tính tồn kho sau khi xuất bán (cho phép giá trị âm bình thường)
                    v_balance_after := v_current_stock - v_base_qty_sold;

                    -- Cập nhật tồn kho mới vào bảng products
                    UPDATE public.products
                    SET current_stock_base_units = v_balance_after,
                        updated_at = NOW()
                    WHERE id = v_prod_id;

                    -- Ghi nhận dòng Thẻ kho (public.inventory_movements)
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

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'receipt_number', v_receipt_number,
        'item_count', v_item_count,
        'message', 'POS Checkout processed atomically with controlled negative stock and full inventory ledger'
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_pos_checkout(JSONB) TO anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- BƯỚC 3: CẬP NHẬT RPC: process_multi_product_grn(payload JSONB)
-- TỰ ĐỘNG CẤN TRỪ BÙ TỒN KHO ÂM KHI NHẬP HÀNG MỚI (AUTOMATIC RECONCILIATION)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_multi_product_grn(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_po_code TEXT;
    v_supplier_id UUID;
    v_receiver_name TEXT;
    v_total_lak INT8;
    v_total_thb NUMERIC(12, 2);
    v_payment_status TEXT;
    v_paid_amount_lak INT8;
    v_debt_amount_lak INT8;
    v_notes TEXT;
    v_items JSONB;
    v_item JSONB;
    v_prod_id TEXT;
    v_prod_name TEXT;
    v_base_units_added INT8;
    v_cost_per_base INT8;
    v_cost_lak INT8;
    v_cost_thb NUMERIC(12, 2);
    v_old_stock INT8;
    v_old_cost INT8;
    v_new_stock INT8;
    v_new_mac_cost INT8;
    v_total_base_units INT8 := 0;
    v_item_count INT := 0;
    v_unit_overrides JSONB;
    v_unit_key TEXT;
    v_unit_price BIGINT;
    v_first_prod_id TEXT := NULL;
    v_first_prod_name TEXT := 'ສິນຄ້າຮັບເຂົ້າ';
BEGIN
    -- 1. Trích xuất Header thông tin phiếu nhập
    v_po_code := payload->>'po_code';
    IF v_po_code IS NULL OR trim(v_po_code) = '' THEN
        RAISE EXCEPTION 'Mã phiếu nhập (po_code) không được để trống!';
    END IF;

    IF payload->>'supplier_id' IS NOT NULL AND trim(payload->>'supplier_id') != '' THEN
        v_supplier_id := (payload->>'supplier_id')::UUID;
    ELSE
        v_supplier_id := NULL;
    END IF;

    v_receiver_name := COALESCE(payload->>'receiver_name', 'ໄມ້ຄຳ (Meii)');
    v_total_lak := COALESCE((payload->>'total_lak')::INT8, 0);
    v_total_thb := COALESCE((payload->>'total_thb')::NUMERIC, 0.00);
    v_payment_status := COALESCE(payload->>'payment_status', 'PAID');
    v_paid_amount_lak := COALESCE((payload->>'paid_amount_lak')::INT8, 0);
    v_debt_amount_lak := COALESCE((payload->>'debt_amount_lak')::INT8, 0);
    v_notes := payload->>'notes';

    v_items := payload->'items';
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RAISE EXCEPTION 'Phiếu nhập kho phải có ít nhất 1 sản phẩm!';
    END IF;

    -- Lấy thông tin sản phẩm đầu tiên để tương thích ngược bảng purchase_orders
    v_first_prod_id := v_items->0->>'product_id';
    v_first_prod_name := COALESCE(v_items->0->>'product_name', 'ສິນຄ້າຮັບເຂົ້າ');
    IF jsonb_array_length(v_items) > 1 THEN
        v_first_prod_name := v_first_prod_name || ' (+' || (jsonb_array_length(v_items) - 1)::TEXT || ' ລາຍການ)';
    END IF;

    -- Tính tổng số lượng quy đổi base units của cả phiếu
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_total_base_units := v_total_base_units + COALESCE((v_item->>'base_units_added')::INT8, 0);
    END LOOP;

    -- BƯỚC 1: LƯU HEADER VÀO BẢNG purchase_orders
    INSERT INTO public.purchase_orders (
        id,
        supplier_id,
        product_id,
        product_name,
        imported_base_units,
        total_cost_lak,
        total_cost_thb,
        paid_amount,
        debt_amount,
        payment_status,
        received_by,
        note,
        created_at,
        updated_at
    ) VALUES (
        v_po_code,
        v_supplier_id,
        v_first_prod_id,
        v_first_prod_name,
        v_total_base_units,
        v_total_lak,
        v_total_thb,
        v_paid_amount_lak,
        v_debt_amount_lak,
        v_payment_status,
        v_receiver_name,
        v_notes,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        supplier_id = EXCLUDED.supplier_id,
        total_cost_lak = EXCLUDED.total_cost_lak,
        total_cost_thb = EXCLUDED.total_cost_thb,
        paid_amount = EXCLUDED.paid_amount,
        debt_amount = EXCLUDED.debt_amount,
        payment_status = EXCLUDED.payment_status,
        updated_at = NOW();

    -- Xóa các dòng purchase_order_items cũ nếu có
    DELETE FROM public.purchase_order_items WHERE purchase_order_id = v_po_code;

    -- BƯỚC 2: DUYỆT TỪNG MÓN ĐỂ INSERT ITEMS, CỘNG KHO (CẤN TRỪ ÂM KHO) & TÍNH MOVING AVERAGE COST
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_item_count := v_item_count + 1;
        v_prod_id := v_item->>'product_id';
        v_base_units_added := COALESCE((v_item->>'base_units_added')::INT8, 0);
        v_cost_per_base := COALESCE((v_item->>'cost_per_base_unit')::INT8, 0);
        v_cost_lak := COALESCE((v_item->>'cost_lak_entered')::INT8, 0);
        v_cost_thb := COALESCE((v_item->>'cost_thb_entered')::NUMERIC, 0.00);

        -- Insert vào purchase_order_items
        INSERT INTO public.purchase_order_items (
            purchase_order_id,
            product_id,
            product_name,
            unit_id,
            unit_name,
            tier_level,
            quantity,
            imported_base_units,
            cost_per_base_unit,
            cost_lak,
            cost_thb,
            line_total_lak,
            line_total_thb,
            created_at
        ) VALUES (
            v_po_code,
            v_prod_id,
            COALESCE(v_item->>'product_name', 'ສິນຄ້າ'),
            v_item->>'unit_id',
            v_item->>'unit_name',
            COALESCE((v_item->>'tier_level')::INT2, 1),
            COALESCE((v_item->>'quantity')::NUMERIC, 1),
            v_base_units_added,
            v_cost_per_base,
            v_cost_lak,
            v_cost_thb,
            COALESCE((v_item->>'line_total_lak')::INT8, (v_cost_lak * COALESCE((v_item->>'quantity')::NUMERIC, 1))::INT8),
            COALESCE((v_item->>'line_total_thb')::NUMERIC, (v_cost_thb * COALESCE((v_item->>'quantity')::NUMERIC, 1))),
            NOW()
        );

        -- BƯỚC 3: CẬP NHẬT PRODUCTS & CẤN TRỪ ÂM KHO TỰ NHIÊN
        SELECT 
            COALESCE(current_stock_base_units, 0),
            COALESCE(cost_per_base_unit, 0)
        INTO v_old_stock, v_old_cost
        FROM public.products
        WHERE id = v_prod_id
        FOR UPDATE;

        IF FOUND THEN
            -- Công thức cấn trừ chuẩn ERP: Tồn mới = Tồn cũ (âm hoặc dương) + Lượng nhập mới
            -- TUYỆT ĐỐI KHÔNG dùng GREATEST(0, ...) để hệ thống tự động bù trừ âm kho chính xác
            v_new_stock := v_old_stock + v_base_units_added;
            
            -- Tính giá vốn bình quân gia quyền di động (Moving Average Cost)
            IF v_old_stock > 0 AND v_cost_per_base > 0 THEN
                v_new_mac_cost := ROUND(((v_old_stock * v_old_cost) + (v_base_units_added * v_cost_per_base))::NUMERIC / v_new_stock);
            ELSE
                -- Khi tồn cũ <= 0 (đã bán âm kho), lượng nhập mới định hình giá vốn thực tế mới
                v_new_mac_cost := CASE WHEN v_cost_per_base > 0 THEN v_cost_per_base ELSE v_old_cost END;
            END IF;

            UPDATE public.products
            SET
                current_stock_base_units = v_new_stock,
                track_stock = true,
                cost_lak = CASE WHEN v_cost_lak > 0 THEN v_cost_lak ELSE cost_lak END,
                cost_thb = CASE WHEN v_cost_thb > 0 THEN v_cost_thb ELSE cost_thb END,
                cost_per_base_unit = v_new_mac_cost,
                updated_at = NOW()
            WHERE id = v_prod_id;

            -- Ghi Thẻ kho Thao tác Nhập kho (public.inventory_movements)
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
                COALESCE(v_item->>'product_name', 'ສິນຄ້າ'),
                'IN_PURCHASE',
                'PURCHASE_ORDER',
                v_po_code,
                v_base_units_added,
                v_old_stock,
                v_new_stock,
                v_cost_per_base,
                'ຮັບສິນຄ້າເຂົ້າສາງເລກທີ: ' || v_po_code,
                NOW(),
                v_receiver_name
            );
        END IF;

        -- BƯỚC 4: CẬP NHẬT GIÁ BÁN product_units NẾU CÓ OVERRIDES
        v_unit_overrides := v_item->'retail_price_overrides';
        IF v_unit_overrides IS NOT NULL AND jsonb_typeof(v_unit_overrides) = 'object' THEN
            FOR v_unit_key, v_unit_price IN 
                SELECT key, value::BIGINT FROM jsonb_each_text(v_unit_overrides)
            LOOP
                IF v_unit_price > 0 THEN
                    UPDATE public.product_units
                    SET retail_price = v_unit_price
                    WHERE id = v_unit_key;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    -- BƯỚC 5: TẠO BẢN GHI THANH TOÁN CÔNG NỢ NHÀ CUNG CẤP
    IF v_paid_amount_lak > 0 THEN
        INSERT INTO public.supplier_debt_payments (
            purchase_order_id,
            payment_amount,
            currency,
            payment_method,
            note,
            created_at
        ) VALUES (
            v_po_code,
            v_paid_amount_lak,
            'LAK',
            'CASH',
            'ຊຳລະເບື້ອງຕົ້ນຕອນຮັບສິນຄ້າ (Initial payment at GRN)',
            NOW()
        );
    END IF;

    IF v_payment_status = 'DEBT' AND v_paid_amount_lak = 0 THEN
        INSERT INTO public.supplier_debt_payments (
            purchase_order_id,
            payment_amount,
            currency,
            payment_method,
            note,
            created_at
        ) VALUES (
            v_po_code,
            0,
            'LAK',
            'CASH',
            'ບັນທຶກໜີ້ສິນ (Outstanding Debt recorded)',
            NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'po_code', v_po_code,
        'item_count', v_item_count,
        'total_base_units', v_total_base_units,
        'message', 'Multi-Product GRN processed successfully with ledger and automatic negative stock reconciliation'
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_multi_product_grn(JSONB) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
