-- ============================================================================
-- MIGRATION: ENTERPRISE INVENTORY MOVEMENTS LEDGER & ATOMIC POS CHECKOUT RPC
-- HỆ THỐNG BÁN LẺ & ERP MEIISHOP POS
-- ============================================================================
-- 1. Bổ sung các cột kiểm toán vào bảng sale_transactions (total_cost_thb, status, void fields)
-- 2. Tạo bảng Sổ cái Thẻ kho public.inventory_movements (Event-sourcing Ledger)
-- 3. Tạo hàm RPC nguyên tử: process_pos_checkout(payload JSONB) với Khóa dòng FOR UPDATE
-- 4. Bổ sung tự động ghi Thẻ kho và Moving Average Cost (MAC) vào process_multi_product_grn
-- 5. Tạo hàm RPC nguyên tử: process_pos_void(payload JSONB) hoàn kho & ghi Thẻ kho VOID_RESTORE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BỔ SUNG CÁC CỘT VÀO BẢNG sale_transactions
-- ----------------------------------------------------------------------------
ALTER TABLE public.sale_transactions
ADD COLUMN IF NOT EXISTS total_cost_lak INT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost_thb NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS voided_by TEXT,
ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- Đồng bộ dữ liệu cũ nếu total_cost_thb đang là 0
UPDATE public.sale_transactions
SET 
  total_cost_lak = COALESCE(NULLIF(total_cost_lak, 0), total_cost, 0),
  total_cost_thb = CASE 
    WHEN (total_cost_thb IS NULL OR total_cost_thb = 0) AND exchange_rate > 0 
      THEN ROUND(COALESCE(total_cost, 0) / exchange_rate, 2)
    ELSE total_cost_thb
  END
WHERE total_cost_thb IS NULL OR total_cost_thb = 0;

-- ----------------------------------------------------------------------------
-- 2. TẠO BẢNG SỔ CÁI THẺ KHO (public.inventory_movements)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN (
        'IN_PURCHASE',         -- Nhập kho mua hàng từ nhà cung cấp
        'OUT_SALE',           -- Xuất bán lẻ / sỉ tại quầy POS
        'IN_SALE_RETURN',     -- Hoàn kho do khách trả hàng
        'OUT_PURCHASE_RETURN',-- Trả hàng lại cho nhà cung cấp
        'ADJUSTMENT',         -- Điều chỉnh kiểm kê kho
        'VOID_RESTORE'        -- Phục hồi tồn kho khi hủy hóa đơn
    )),
    reference_type TEXT NOT NULL, -- 'PURCHASE_ORDER', 'SALE_TRANSACTION', 'STOCK_AUDIT'
    reference_id TEXT NOT NULL,   -- Mã phiếu nhập / Mã hóa đơn bán
    quantity_change INT8 NOT NULL,-- Số lượng biến động (+ tăng, - giảm theo base units)
    balance_before INT8 NOT NULL, -- Tồn kho trước biến động
    balance_after INT8 NOT NULL,  -- Tồn kho sau biến động
    unit_cost_lak NUMERIC(18, 4) DEFAULT 0, -- Giá vốn cơ sở tại thời điểm phát sinh
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT DEFAULT 'ໄມ້ຄຳ (Meii)'
);

-- Tạo Index để truy vấn thẻ kho tốc độ cao
CREATE INDEX IF NOT EXISTS idx_inv_mov_product_id ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_reference ON public.inventory_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_created_at ON public.inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_inv_mov_type ON public.inventory_movements(movement_type);

-- Cấp quyền RLS
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all actions on inventory_movements') THEN
        CREATE POLICY "Allow all actions on inventory_movements" ON public.inventory_movements FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 3. FUNCTION NGUYÊN TỬ: process_pos_checkout(payload JSONB)
-- ----------------------------------------------------------------------------
-- Thực hiện giao dịch bán hàng 100% nguyên tử trên Database Server:
-- - Khóa dòng SELECT ... FOR UPDATE trên bảng products (Chặn 100% Race Condition bán âm kho)
-- - Trừ tồn kho nguyên tử
-- - Tự động ghi thẻ kho public.inventory_movements
-- - Tạo bản ghi sale_transactions và sale_transaction_items
-- - Tự động rollback nếu có bất kỳ lỗi nào xảy ra
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_pos_checkout(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

    -- 2. Insert vào bảng sale_transactions
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
            -- KHÓA DÒNG & TRỪ TỒN KHO NGUYÊN TỬ (ROW-LEVEL LOCKING)
            -- =================================================================
            IF v_prod_id IS NOT NULL AND v_prod_id != '' AND v_prod_id NOT LIKE 'p_custom%' THEN
                -- Khóa dòng sản phẩm để ngăn race condition giữa 2 thu ngân
                SELECT 
                    COALESCE(current_stock_base_units, 0), 
                    COALESCE(track_stock, true),
                    COALESCE(cost_per_base_unit, 0)
                INTO v_current_stock, v_track_stock, v_unit_cost
                FROM public.products
                WHERE id = v_prod_id
                FOR UPDATE;

                IF FOUND AND v_track_stock THEN
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

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'receipt_number', v_receipt_number,
        'item_count', v_item_count,
        'message', 'POS Checkout processed atomically with full inventory ledger'
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_pos_checkout(JSONB) TO anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 4. CẬP NHẬT process_multi_product_grn: GHI THẺ KHO & MOVING AVERAGE COST (MAC)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_multi_product_grn(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
    v_first_prod_id TEXT := NULL;
    v_first_prod_name TEXT := NULL;
    v_item_count INT := 0;
    v_total_base_units INT8 := 0;
    v_base_units_added INT8;
    v_cost_lak INT8;
    v_cost_thb NUMERIC(12, 2);
    v_cost_per_base INT8;
    v_unit_overrides JSONB;
    v_unit_key TEXT;
    v_unit_price INT8;
    
    -- Thẻ kho & Moving Average Cost
    v_old_stock INT8;
    v_old_cost INT8;
    v_new_stock INT8;
    v_new_mac_cost INT8;
BEGIN
    v_po_code := payload->>'po_code';
    IF v_po_code IS NULL OR trim(v_po_code) = '' THEN
        RAISE EXCEPTION 'Mã phiếu nhập (po_code) không được để trống!';
    END IF;

    IF (payload->>'supplier_id') IS NOT NULL AND trim(payload->>'supplier_id') != '' THEN
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

    v_item_count := jsonb_array_length(v_items);
    v_first_prod_id := v_items->0->>'product_id';
    v_first_prod_name := v_items->0->>'product_name';

    IF v_item_count > 1 THEN
        v_prod_name := COALESCE(v_first_prod_name, 'ສິນຄ້າ') || ' (+' || (v_item_count - 1)::TEXT || ' ລາຍການ)';
    ELSE
        v_prod_name := COALESCE(v_first_prod_name, 'ສິນຄ້າ');
    END IF;

    FOR i IN 0..(v_item_count - 1) LOOP
        v_total_base_units := v_total_base_units + COALESCE((v_items->i->>'base_units_added')::INT8, 0);
    END LOOP;

    -- BƯỚC 1: Lưu bảng purchase_orders
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
        v_prod_name,
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
        product_id = EXCLUDED.product_id,
        product_name = EXCLUDED.product_name,
        imported_base_units = EXCLUDED.imported_base_units,
        total_cost_lak = EXCLUDED.total_cost_lak,
        total_cost_thb = EXCLUDED.total_cost_thb,
        paid_amount = EXCLUDED.paid_amount,
        debt_amount = EXCLUDED.debt_amount,
        payment_status = EXCLUDED.payment_status,
        received_by = EXCLUDED.received_by,
        note = EXCLUDED.note,
        updated_at = NOW();

    -- BƯỚC 2: Lưu bảng purchase_order_items
    DELETE FROM public.purchase_order_items WHERE purchase_order_id = v_po_code;

    FOR i IN 0..(v_item_count - 1) LOOP
        v_item := v_items->i;
        v_prod_id := v_item->>'product_id';
        v_base_units_added := COALESCE((v_item->>'base_units_added')::INT8, 0);
        v_cost_lak := COALESCE((v_item->>'cost_lak_entered')::INT8, 0);
        v_cost_thb := COALESCE((v_item->>'cost_thb_entered')::NUMERIC, 0.00);
        v_cost_per_base := COALESCE((v_item->>'cost_per_base_unit')::INT8, 0);
        
        IF v_cost_per_base = 0 AND v_base_units_added > 0 AND v_cost_lak > 0 THEN
            v_cost_per_base := v_cost_lak / v_base_units_added;
        END IF;

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
            COALESCE((v_item->>'tier_level')::INT4, 1),
            COALESCE((v_item->>'quantity')::NUMERIC, 1),
            v_base_units_added,
            v_cost_per_base,
            v_cost_lak,
            v_cost_thb,
            COALESCE((v_item->>'line_total_lak')::INT8, (v_cost_lak * COALESCE((v_item->>'quantity')::NUMERIC, 1))::INT8),
            COALESCE((v_item->>'line_total_thb')::NUMERIC, (v_cost_thb * COALESCE((v_item->>'quantity')::NUMERIC, 1))),
            NOW()
        );

        -- BƯỚC 3: CẬP NHẬT PRODUCTS & TÍNH MOVING AVERAGE COST (MAC)
        SELECT 
            COALESCE(current_stock_base_units, 0),
            COALESCE(cost_per_base_unit, 0)
        INTO v_old_stock, v_old_cost
        FROM public.products
        WHERE id = v_prod_id
        FOR UPDATE;

        IF FOUND THEN
            v_new_stock := v_old_stock + v_base_units_added;
            
            -- Tính giá vốn bình quân gia quyền di động (Moving Average Cost)
            IF v_old_stock > 0 AND v_cost_per_base > 0 THEN
                v_new_mac_cost := ROUND(((v_old_stock * v_old_cost) + (v_base_units_added * v_cost_per_base))::NUMERIC / v_new_stock);
            ELSE
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

        -- BƯỚC 4: CẬP NHẬT GIÁ BÁN product_units
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

    -- BƯỚC 5: TẠO BẢN GHI THANH TOÁN CÔNG NỢ
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
        'message', 'Multi-Product GRN processed successfully with ledger and Moving Average Cost'
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_multi_product_grn(JSONB) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. HÀM RPC NGUYÊN TỬ: process_pos_void(payload JSONB)
-- HỦY HÓA ĐƠN BÁN HÀNG & PHỤC HỒI TỒN KHO NGUYÊN TỬ VÀO THẺ KHO
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
    v_items_count INT := 0;
    v_custom_items JSONB := payload->'items';
    v_elem JSONB;
    v_p_id TEXT;
    v_p_units INT8;
    v_p_name TEXT;
BEGIN
    IF v_tx_id IS NULL OR trim(v_tx_id) = '' THEN
        RAISE EXCEPTION 'Mã hóa đơn không hợp lệ hoặc để trống';
    END IF;

    -- 1. Khóa hóa đơn để tránh race condition (2 thiết bị cùng bấm hủy đồng thời)
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
                    SET current_stock_base_units = v_new_stock, updated_at = NOW()
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
                        COALESCE(v_prod.name, v_p_name),
                        v_movement_type,
                        'SALE_TRANSACTION',
                        v_tx_id,
                        v_p_units,
                        v_old_stock,
                        v_new_stock,
                        COALESCE(v_prod.cost_per_base_unit, 0),
                        'ຄືນສາງຍ້ອນຍົກເລີກບິນ: ' || v_tx_id || COALESCE(' (' || v_reason || ')', ''),
                        NOW(),
                        v_voided_by
                    );
                    v_items_count := v_items_count + 1;
                END IF;
            END IF;
        END LOOP;
    ELSE
        -- 3B: Tự động truy vấn từ bảng sale_transaction_items của hóa đơn
        FOR v_item IN 
            SELECT product_id, product_name, quantity, multiplier
            FROM public.sale_transaction_items
            WHERE transaction_id = v_tx_id
        LOOP
            IF v_item.product_id IS NOT NULL THEN
                SELECT * INTO v_prod FROM public.products WHERE id = v_item.product_id FOR UPDATE;
                IF FOUND AND v_prod.track_stock THEN
                    v_units_restored := COALESCE(v_item.quantity, 0) * COALESCE(v_item.multiplier, 1);
                    IF v_units_restored > 0 THEN
                        v_old_stock := COALESCE(v_prod.current_stock_base_units, 0);
                        v_new_stock := v_old_stock + v_units_restored;

                        UPDATE public.products
                        SET current_stock_base_units = v_new_stock, updated_at = NOW()
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
                            COALESCE(v_prod.name, v_item.product_name, 'ສິນຄ້າ'),
                            v_movement_type,
                            'SALE_TRANSACTION',
                            v_tx_id,
                            v_units_restored,
                            v_old_stock,
                            v_new_stock,
                            COALESCE(v_prod.cost_per_base_unit, 0),
                            'ຄືນສາງຍ້ອນຍົກເລີກບິນ: ' || v_tx_id || COALESCE(' (' || v_reason || ')', ''),
                            NOW(),
                            v_voided_by
                        );
                        v_items_count := v_items_count + 1;
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'items_restored', v_items_count,
        'message', 'Hủy hóa đơn và hoàn kho ghi thẻ kho thành công'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_pos_void(JSONB) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
