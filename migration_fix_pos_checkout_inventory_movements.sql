-- ==============================================================================
-- Migration: Fix process_pos_checkout RPC and inventory_movements schema mismatch
-- Error resolved: column "quantity" of relation "inventory_movements" does not exist
--
-- 1. Adds compatibility columns (quantity, stock_before, stock_after, notes) to
--    public.inventory_movements to prevent any future column name mismatch.
-- 2. Ensures debt and cashier tracking columns exist on public.sale_transactions.
-- 3. Ensures bundle_components, line_cost, line_profit exist on public.sale_transaction_items.
-- 4. Replaces process_pos_checkout RPC with a 100% atomic, enterprise-grade version
--    that populates both canonical (quantity_change, balance_before, balance_after, note)
--    and compatibility (quantity, stock_before, stock_after, notes) fields.
-- 5. Handles mixed-flavor carton bundles and regular tracked products with Row-Level Locking.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BẢO ĐẢM BẢNG inventory_movements CÓ CẢ CỘT CHUẨN VÀ CỘT TƯƠNG THÍCH
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT,
    product_name TEXT,
    movement_type TEXT,
    reference_type TEXT,
    reference_id TEXT,
    quantity_change INT8,
    balance_before INT8,
    balance_after INT8,
    unit_cost_lak NUMERIC(18, 4) DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT DEFAULT 'ໄມ້ຄຳ (Meii)'
);

-- Thêm các cột tương thích và chuẩn hóa nếu bảng đã tồn tại từ trước
ALTER TABLE public.inventory_movements 
ADD COLUMN IF NOT EXISTS product_id TEXT,
ADD COLUMN IF NOT EXISTS product_name TEXT,
ADD COLUMN IF NOT EXISTS movement_type TEXT,
ADD COLUMN IF NOT EXISTS reference_type TEXT,
ADD COLUMN IF NOT EXISTS reference_id TEXT,
ADD COLUMN IF NOT EXISTS quantity_change INT8,
ADD COLUMN IF NOT EXISTS balance_before INT8,
ADD COLUMN IF NOT EXISTS balance_after INT8,
ADD COLUMN IF NOT EXISTS unit_cost_lak NUMERIC(18, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS note TEXT,
ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'ໄມ້ຄຳ (Meii)',
ADD COLUMN IF NOT EXISTS quantity INT8,
ADD COLUMN IF NOT EXISTS stock_before INT8,
ADD COLUMN IF NOT EXISTS stock_after INT8,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Gỡ bỏ ràng buộc foreign key chặn xóa sản phẩm nếu có
DO $$ 
BEGIN
    ALTER TABLE public.inventory_movements 
    DROP CONSTRAINT IF EXISTS inventory_movements_product_id_fkey;
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

-- Nới lỏng CHECK constraint trên movement_type để chấp nhận cả 'OUT_SALE' và 'sale'
DO $$
BEGIN
    ALTER TABLE public.inventory_movements 
    DROP CONSTRAINT IF EXISTS inventory_movements_movement_type_check;
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

-- Bật RLS
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all actions on inventory_movements') THEN
        CREATE POLICY "Allow all actions on inventory_movements" ON public.inventory_movements FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. BẢO ĐẢM BẢNG sale_transactions CÓ ĐẦY ĐỦ CÁC CỘT CÔNG NỢ & THU NGÂN
-- ------------------------------------------------------------------------------
ALTER TABLE public.sale_transactions 
ADD COLUMN IF NOT EXISTS cashier_id UUID,
ADD COLUMN IF NOT EXISTS cashier_name TEXT DEFAULT 'ໄມ້ຄຳ (Meii)',
ADD COLUMN IF NOT EXISTS customer_id TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS paid_amount INT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_debt INT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PAID',
ADD COLUMN IF NOT EXISTS debt_due_date DATE DEFAULT NULL;

-- ------------------------------------------------------------------------------
-- 2B. BẢO ĐẢM BẢNG sale_transaction_items CÓ CÁC CỘT CHI PHÍ & BUNDLE
-- ------------------------------------------------------------------------------
ALTER TABLE public.sale_transaction_items 
ADD COLUMN IF NOT EXISTS bundle_components JSONB,
ADD COLUMN IF NOT EXISTS line_cost INT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS line_profit INT8 DEFAULT 0;

-- ------------------------------------------------------------------------------
-- 3. CẬP NHẬT FUNCTION NGUYÊN TỬ: process_pos_checkout
-- ------------------------------------------------------------------------------
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
    v_customer_id TEXT;
    v_customer_phone TEXT;
    v_payment_method TEXT;
    v_subtotal INT8;
    v_discount_total INT8;
    v_grand_total INT8;
    v_amount_tendered INT8;
    v_change_amount INT8;
    v_total_cost_lak INT8;
    v_total_cost_thb NUMERIC;
    v_gross_profit_lak INT8;
    v_gross_profit_thb NUMERIC;
    v_cashier_name TEXT;
    v_cashier_id UUID;
    v_paid_amount INT8;
    v_remaining_debt INT8;
    v_payment_status TEXT;
    v_debt_due_date DATE;
    v_exchange_rate NUMERIC;
    v_total_lak INT8;
    v_total_thb NUMERIC;
    
    v_items JSONB;
    v_item JSONB;
    v_item_count INT := 0;
    v_prod_id TEXT;
    v_prod_name TEXT;
    v_qty NUMERIC;
    v_multiplier NUMERIC;
    v_units_to_deduct INT8;
    v_current_stock INT8;
    v_new_stock INT8;
    v_track_stock BOOLEAN;
    v_allow_neg BOOLEAN;
    v_unit_cost INT8;
    
    -- Xử lý bundle thùng mix vị
    v_bundle_comps JSONB;
    v_comp_elem JSONB;
    v_comp_count INT := 0;
    v_comp_prod_id TEXT;
    v_comp_name TEXT;
    v_comp_qty INT8;
    v_comp_curr_stock INT8;
    v_comp_new_stock INT8;
    v_comp_track_stock BOOLEAN;
    v_comp_allow_neg BOOLEAN;
    v_comp_cost INT8;
BEGIN
    -- 1. Trích xuất thông tin Header giao dịch
    v_tx_id := COALESCE(payload->>'id', 'tx_' || floor(extract(epoch from now()) * 1000)::text);
    v_receipt_number := COALESCE(payload->>'receipt_number', payload->>'receiptNumber', 'INV-' || to_char(now(), 'YYMMDDHH24MISS'));
    v_created_at := COALESCE((payload->>'created_at')::TIMESTAMPTZ, now());
    v_is_wholesale := COALESCE((payload->>'is_wholesale')::BOOLEAN, false);
    v_customer_name := COALESCE(payload->>'customer_name', payload->>'customerName', 'ລູກຄ້າທົ່ວໄປ');
    v_customer_id := payload->>'customer_id';
    v_customer_phone := payload->>'customer_phone';
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
    
    -- Parse cashier_id UUID an toàn (Nếu không phải chuẩn UUID thì lưu NULL)
    IF (payload->>'cashier_id') IS NOT NULL 
       AND (payload->>'cashier_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_cashier_id := (payload->>'cashier_id')::UUID;
    ELSE
        v_cashier_id := NULL;
    END IF;
    
    -- Xử lý công nợ
    IF LOWER(v_payment_method) = 'debt' THEN
        v_paid_amount := COALESCE((payload->>'paid_amount')::INT8, v_amount_tendered);
        v_remaining_debt := COALESCE((payload->>'remaining_debt')::INT8, GREATEST(0, v_grand_total - v_paid_amount));
        IF v_remaining_debt <= 0 THEN
            v_payment_status := 'PAID';
        ELSIF v_paid_amount > 0 THEN
            v_payment_status := 'PARTIAL';
        ELSE
            v_payment_status := 'DEBT';
        END IF;
    ELSE
        v_paid_amount := COALESCE((payload->>'paid_amount')::INT8, v_grand_total);
        v_remaining_debt := 0;
        v_payment_status := 'PAID';
    END IF;

    IF (payload->>'debt_due_date') IS NOT NULL AND length(trim(payload->>'debt_due_date')) >= 10 THEN
        v_debt_due_date := (payload->>'debt_due_date')::DATE;
    ELSE
        v_debt_due_date := NULL;
    END IF;
    
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
        customer_id,
        customer_phone,
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
        cashier_id,
        paid_amount,
        remaining_debt,
        payment_status,
        debt_due_date,
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
        v_customer_id,
        v_customer_phone,
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
        v_cashier_id,
        v_paid_amount,
        v_remaining_debt,
        v_payment_status,
        v_debt_due_date,
        'COMPLETED',
        v_exchange_rate,
        v_total_lak,
        v_total_thb
    )
    ON CONFLICT (id) DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        customer_id = EXCLUDED.customer_id,
        customer_phone = EXCLUDED.customer_phone,
        cashier_name = EXCLUDED.cashier_name,
        cashier_id = EXCLUDED.cashier_id,
        payment_method = EXCLUDED.payment_method,
        grand_total = EXCLUDED.grand_total,
        paid_amount = EXCLUDED.paid_amount,
        remaining_debt = EXCLUDED.remaining_debt,
        payment_status = EXCLUDED.payment_status,
        debt_due_date = EXCLUDED.debt_due_date,
        total_cost_lak = EXCLUDED.total_cost_lak,
        total_cost_thb = EXCLUDED.total_cost_thb,
        gross_profit_lak = EXCLUDED.gross_profit_lak,
        gross_profit_thb = EXCLUDED.gross_profit_thb;

    -- 3. Xử lý từng dòng sản phẩm (sale_transaction_items) & Trừ kho nguyên tử
    v_items := payload->'items';
    IF v_items IS NOT NULL AND jsonb_typeof(v_items) = 'array' AND jsonb_array_length(v_items) > 0 THEN
        v_item_count := jsonb_array_length(v_items);
        FOR i IN 0..(v_item_count - 1) LOOP
            v_item := v_items->i;
            v_prod_id := COALESCE(v_item->>'product_id', v_item->>'productId');
            v_prod_name := COALESCE(v_item->>'product_name', v_item->>'productName', 'ສິນຄ້າ');
            v_qty := COALESCE((v_item->>'quantity')::NUMERIC, 1);
            v_multiplier := COALESCE((v_item->>'multiplier')::NUMERIC, 1);
            v_bundle_comps := COALESCE(v_item->'bundle_components', v_item->'bundleComponents');
            
            -- Ghi dòng chi tiết hóa đơn (sale_transaction_items)
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
                v_qty,
                COALESCE((v_item->>'unit_price')::NUMERIC, 0),
                COALESCE((v_item->>'line_total')::NUMERIC, 0),
                COALESCE((v_item->>'line_cost')::NUMERIC, 0),
                COALESCE((v_item->>'line_profit')::NUMERIC, 0),
                v_bundle_comps
            ) ON CONFLICT (id) DO NOTHING;

            -- -----------------------------------------------------------------
            -- KHÓA DÒNG & TRỪ TỒN KHO NGUYÊN TỬ (ROW-LEVEL LOCKING FOR UPDATE)
            -- -----------------------------------------------------------------
            
            -- TRƯỜNG HỢP A: THÙNG MIX VỊ (Có mảng bundle_components)
            IF v_bundle_comps IS NOT NULL AND jsonb_typeof(v_bundle_comps) = 'array' AND jsonb_array_length(v_bundle_comps) > 0 THEN
                v_comp_count := jsonb_array_length(v_bundle_comps);
                FOR c IN 0..(v_comp_count - 1) LOOP
                    v_comp_elem := v_bundle_comps->c;
                    v_comp_prod_id := COALESCE(v_comp_elem->>'product_id', v_comp_elem->>'productId');
                    v_comp_qty := COALESCE((v_comp_elem->>'quantity')::INT8, 1);
                    v_comp_name := COALESCE(v_comp_elem->>'product_name', v_comp_elem->>'productName', 'ສິນຄ້າລວມ');

                    IF v_comp_prod_id IS NOT NULL AND v_comp_prod_id <> '' AND v_comp_qty > 0 THEN
                        SELECT 
                            COALESCE(current_stock_base_units, 0), 
                            COALESCE(track_stock, true),
                            COALESCE(cost_per_base_unit, 0)::INT8,
                            COALESCE(allow_negative_stock, true)
                        INTO v_comp_curr_stock, v_comp_track_stock, v_comp_cost, v_comp_allow_neg
                        FROM public.products
                        WHERE id = v_comp_prod_id
                        FOR UPDATE;

                        IF FOUND AND (v_comp_track_stock IS TRUE OR v_comp_track_stock IS NULL) THEN
                            v_comp_new_stock := v_comp_curr_stock - v_comp_qty;

                            UPDATE public.products
                            SET current_stock_base_units = v_comp_new_stock,
                                updated_at = now()
                            WHERE id = v_comp_prod_id;

                            -- Ghi nhận Thẻ kho (Điền cả cột chuẩn quantity_change và cột tương thích quantity)
                            INSERT INTO public.inventory_movements (
                                product_id,
                                product_name,
                                movement_type,
                                reference_type,
                                reference_id,
                                quantity_change,
                                quantity,
                                balance_before,
                                stock_before,
                                balance_after,
                                stock_after,
                                unit_cost_lak,
                                note,
                                notes,
                                created_at,
                                created_by
                            ) VALUES (
                                v_comp_prod_id,
                                v_comp_name,
                                'OUT_SALE',
                                'SALE_TRANSACTION',
                                v_tx_id,
                                -v_comp_qty,
                                -v_comp_qty,
                                v_comp_curr_stock,
                                v_comp_curr_stock,
                                v_comp_new_stock,
                                v_comp_new_stock,
                                COALESCE(v_comp_cost, 0),
                                'Xuất bán thùng mix vị (' || v_prod_name || ') bill: ' || v_receipt_number,
                                'Xuất bán thùng mix vị (' || v_prod_name || ') bill: ' || v_receipt_number,
                                v_created_at,
                                v_cashier_name
                            );
                        END IF;
                    END IF;
                END LOOP;

            -- TRƯỜNG HỢP B: SẢN PHẨM THƯỜNG
            ELSIF v_prod_id IS NOT NULL AND v_prod_id <> '' AND v_prod_id NOT LIKE 'p_custom%' AND v_prod_id NOT LIKE 'bnd_%' THEN
                SELECT 
                    COALESCE(current_stock_base_units, 0), 
                    COALESCE(track_stock, true),
                    COALESCE(cost_per_base_unit, 0)::INT8,
                    COALESCE(allow_negative_stock, true),
                    COALESCE(name, v_prod_name, 'ສິນຄ້າ')
                INTO v_current_stock, v_track_stock, v_unit_cost, v_allow_neg, v_prod_name
                FROM public.products
                WHERE id = v_prod_id
                FOR UPDATE;

                IF FOUND AND (v_track_stock IS TRUE OR v_track_stock IS NULL) THEN
                    v_units_to_deduct := (v_qty * v_multiplier)::INT8;
                    v_new_stock := v_current_stock - v_units_to_deduct;

                    UPDATE public.products
                    SET current_stock_base_units = v_new_stock,
                        updated_at = now()
                    WHERE id = v_prod_id;

                    -- Ghi nhận Thẻ kho (Điền cả cột chuẩn quantity_change và cột tương thích quantity)
                    INSERT INTO public.inventory_movements (
                        product_id,
                        product_name,
                        movement_type,
                        reference_type,
                        reference_id,
                        quantity_change,
                        quantity,
                        balance_before,
                        stock_before,
                        balance_after,
                        stock_after,
                        unit_cost_lak,
                        note,
                        notes,
                        created_at,
                        created_by
                    ) VALUES (
                        v_prod_id,
                        COALESCE(v_prod_name, v_item->>'product_name', v_item->>'productName', 'ສິນຄ້າ'),
                        'OUT_SALE',
                        'SALE_TRANSACTION',
                        v_tx_id,
                        -v_units_to_deduct,
                        -v_units_to_deduct,
                        v_current_stock,
                        v_current_stock,
                        v_new_stock,
                        v_new_stock,
                        COALESCE(v_unit_cost, 0),
                        'Xuất bán đơn hàng POS: ' || v_receipt_number,
                        'Xuất bán đơn hàng POS: ' || v_receipt_number,
                        v_created_at,
                        v_cashier_name
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 4. Trả về kết quả thành công cho Client
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'receipt_number', v_receipt_number,
        'remaining_debt', v_remaining_debt,
        'paid_amount', v_paid_amount,
        'payment_status', v_payment_status
    );
END;
$$;

-- Cấp quyền thực thi RPC cho mọi vai trò trong Supabase
GRANT EXECUTE ON FUNCTION public.process_pos_checkout(JSONB) TO anon, authenticated, service_role;
