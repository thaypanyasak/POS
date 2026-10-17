-- ============================================================================
-- MODULE: QUẢN LÝ NHẬP KHO NHIỀU SẢN PHẨM (MULTI-PRODUCT GRN)
-- POSTGRES RPC NGUYÊN TỬ: process_multi_product_grn(payload JSONB)
-- ============================================================================
-- Đảm bảo chuẩn giao dịch ACID 100%: 
-- 1. Insert/Update purchase_orders
-- 2. Insert purchase_order_items
-- 3. Atomic stock update (current_stock_base_units + base_units_added), track_stock = true, cost update
-- 4. Update retail_price_overrides on product_units
-- 5. Auto record supplier_debt_payments for DEBT / PARTIAL / initial payments
-- 6. EXCEPTION WHEN OTHERS THEN RAISE -> 100% Rollback on error
-- ============================================================================

-- 1. Đảm bảo bảng purchase_orders có đủ các cột cần thiết
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id TEXT PRIMARY KEY, -- Format: PO-YYYYMMDD-XXXX
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    product_id TEXT REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name TEXT,
    imported_base_units INT8 NOT NULL DEFAULT 0,
    tier1_qty INT4 DEFAULT 0,
    tier2_qty INT4 DEFAULT 0,
    tier3_qty INT4 DEFAULT 0,
    cost_thb NUMERIC(10, 2) DEFAULT 0.00,
    cost_lak INT8 DEFAULT 0,
    cost_per_base_unit INT8 DEFAULT 0,
    total_cost_lak INT8 DEFAULT 0,
    total_cost_thb NUMERIC(12, 2) DEFAULT 0.00,
    total_cost_vnd INT8 DEFAULT 0,
    paid_amount INT8 NOT NULL DEFAULT 0,
    debt_amount INT8 NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL CHECK (payment_status IN ('PAID', 'PARTIAL', 'DEBT')),
    received_by TEXT DEFAULT 'ໄມ້ຄຳ (Meii)',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Đảm bảo bảng purchase_order_items tồn tại và đầy đủ các cột
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id TEXT NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    unit_id TEXT,
    unit_name TEXT,
    tier_level INT4 DEFAULT 1,
    quantity NUMERIC(12, 2) DEFAULT 1,
    imported_base_units INT8 NOT NULL DEFAULT 0,
    cost_per_base_unit INT8 NOT NULL DEFAULT 0,
    cost_lak INT8 DEFAULT 0,
    cost_thb NUMERIC(12, 2) DEFAULT 0.00,
    cost_vnd INT8 DEFAULT 0,
    line_total_lak INT8 DEFAULT 0,
    line_total_thb NUMERIC(12, 2) DEFAULT 0.00,
    tier1_qty INT4 DEFAULT 0,
    tier2_qty INT4 DEFAULT 0,
    tier3_qty INT4 DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bổ sung cột cho purchase_order_items nếu đã tạo trước đó nhưng thiếu cột
ALTER TABLE public.purchase_order_items 
ADD COLUMN IF NOT EXISTS unit_id TEXT,
ADD COLUMN IF NOT EXISTS unit_name TEXT,
ADD COLUMN IF NOT EXISTS tier_level INT4 DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 2) DEFAULT 1,
ADD COLUMN IF NOT EXISTS line_total_lak INT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS line_total_thb NUMERIC(12, 2) DEFAULT 0.00;

-- 3. Đảm bảo bảng supplier_debt_payments
CREATE TABLE IF NOT EXISTS public.supplier_debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id TEXT NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    payment_amount INT8 NOT NULL,
    currency TEXT NOT NULL DEFAULT 'LAK',
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'TRANSFER')),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Cấp quyền RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_debt_payments ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all actions on purchase_order_items') THEN
        CREATE POLICY "Allow all actions on purchase_order_items" ON public.purchase_order_items FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 5. ĐẶC TẢ FUNCTION NGUYÊN TỬ: process_multi_product_grn(payload JSONB)
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
BEGIN
    -- Trích xuất thông tin Header từ payload
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

    -- Đặt tên tổng hợp cho phiếu (đảm bảo tương thích ngược các màn hình cũ)
    IF v_item_count > 1 THEN
        v_prod_name := COALESCE(v_first_prod_name, 'ສິນຄ້າ') || ' (+' || (v_item_count - 1)::TEXT || ' ລາຍການ)';
    ELSE
        v_prod_name := COALESCE(v_first_prod_name, 'ສິນຄ້າ');
    END IF;

    -- Tính tổng base units của toàn bộ các sản phẩm
    FOR i IN 0..(v_item_count - 1) LOOP
        v_total_base_units := v_total_base_units + COALESCE((v_items->i->>'base_units_added')::INT8, 0);
    END LOOP;

    -- =========================================================================
    -- BƯỚC 1: INSERT HOẶC UPDATE VÀO BẢNG purchase_orders
    -- =========================================================================
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

    -- =========================================================================
    -- BƯỚC 2: INSERT HÀNG LOẠT VÀO purchase_order_items
    -- =========================================================================
    DELETE FROM public.purchase_order_items WHERE purchase_order_id = v_po_code;

    FOR i IN 0..(v_item_count - 1) LOOP
        v_item := v_items->i;
        v_prod_id := v_item->>'product_id';
        v_base_units_added := COALESCE((v_item->>'base_units_added')::INT8, 0);
        v_cost_lak := COALESCE((v_item->>'cost_lak_entered')::INT8, 0);
        v_cost_thb := COALESCE((v_item->>'cost_thb_entered')::NUMERIC, 0.00);
        v_cost_per_base := COALESCE((v_item->>'cost_per_base_unit')::INT8, 0);
        
        -- Tính cost_per_base_unit nếu chưa có
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

        -- =====================================================================
        -- BƯỚC 3: CẬP NHẬT PRODUCTS
        -- =====================================================================
        -- 1. Tồn kho: current_stock_base_units = COALESCE(...) + item.base_units_added
        -- 2. Tự động bật theo dõi kho: track_stock = true
        -- 3. Cập nhật giá vốn tham chiếu mới: cost_lak, cost_thb, cost_per_base_unit
        UPDATE public.products
        SET
            current_stock_base_units = COALESCE(current_stock_base_units, 0) + v_base_units_added,
            track_stock = true,
            cost_lak = CASE WHEN v_cost_lak > 0 THEN v_cost_lak ELSE cost_lak END,
            cost_thb = CASE WHEN v_cost_thb > 0 THEN v_cost_thb ELSE cost_thb END,
            cost_per_base_unit = CASE WHEN v_cost_per_base > 0 THEN v_cost_per_base ELSE cost_per_base_unit END,
            updated_at = NOW()
        WHERE id = v_prod_id;

        -- =====================================================================
        -- BƯỚC 4: CẬP NHẬT BẢNG product_units NẾU CÓ retail_price_overrides
        -- =====================================================================
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

    -- =========================================================================
    -- BƯỚC 5: TỰ ĐỘNG TẠO BẢN GHI CÔNG NỢ / THANH TOÁN (supplier_debt_payments)
    -- =========================================================================
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

    -- Hoàn tất thành công, trả về JSONB
    RETURN jsonb_build_object(
        'success', true,
        'po_code', v_po_code,
        'item_count', v_item_count,
        'total_base_units', v_total_base_units,
        'message', 'Multi-Product GRN processed successfully with full ACID atomicity'
    );

EXCEPTION WHEN OTHERS THEN
    -- Tự động Rollback 100% nếu có bất kỳ lỗi nào xảy ra
    RAISE;
END;
$$;

-- Cấp quyền gọi Function cho Supabase anon / authenticated / service_role
GRANT EXECUTE ON FUNCTION public.process_multi_product_grn(JSONB) TO anon, authenticated, service_role;

-- Reload schema cache PostgREST
NOTIFY pgrst, 'reload schema';
