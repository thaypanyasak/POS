-- ==============================================================================
-- Migration: Fix process_pos_checkout RPC and Backfill Debt Transactions
-- 1. Ensure columns paid_amount, remaining_debt, payment_status, debt_due_date exist on sale_transactions
-- 2. Backfill existing debt transactions that had remaining_debt = 0 erroneously
-- 3. Update process_pos_checkout RPC with strict UUID casting for cashier_id
-- ==============================================================================

-- 1. Ensure columns exist
ALTER TABLE public.sale_transactions 
ADD COLUMN IF NOT EXISTS cashier_id UUID,
ADD COLUMN IF NOT EXISTS paid_amount INT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_debt INT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PAID',
ADD COLUMN IF NOT EXISTS debt_due_date DATE DEFAULT NULL;

-- 2. Backfill existing debt transactions that have remaining_debt = 0 or NULL
UPDATE public.sale_transactions
SET 
    remaining_debt = CASE 
        WHEN COALESCE(paid_amount, amount_tendered, 0) >= grand_total THEN 0
        ELSE grand_total - COALESCE(paid_amount, amount_tendered, 0)
    END,
    paid_amount = COALESCE(paid_amount, amount_tendered, 0),
    payment_status = CASE 
        WHEN COALESCE(paid_amount, amount_tendered, 0) >= grand_total THEN 'PAID'
        WHEN COALESCE(paid_amount, amount_tendered, 0) > 0 THEN 'PARTIAL'
        ELSE 'DEBT'
    END
WHERE 
    LOWER(payment_method) = 'debt'
    AND (remaining_debt IS NULL OR remaining_debt = 0)
    AND grand_total > 0
    AND COALESCE(paid_amount, amount_tendered, 0) < grand_total;

-- 3. Create or replace process_pos_checkout function with full debt fields support & strict UUID cashier_id
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
    v_total_cost_thb NUMERIC;
    v_gross_profit_lak INT8;
    v_gross_profit_thb NUMERIC;
    v_cashier_name TEXT;
    v_cashier_id UUID; -- STRICTLY UUID matching sale_transactions.cashier_id
    v_paid_amount INT8;
    v_remaining_debt INT8;
    v_payment_status TEXT;
    v_debt_due_date DATE;
    v_exchange_rate NUMERIC;
    v_total_lak INT8;
    v_total_thb NUMERIC;
    v_items JSONB;
    v_item RECORD;
    v_prod_id TEXT;
    v_qty NUMERIC;
    v_multiplier NUMERIC;
    v_units_to_deduct NUMERIC;
    v_track_stock BOOLEAN;
    v_allow_neg BOOLEAN;
    v_current_stock NUMERIC;
    v_new_stock NUMERIC;
    v_movement_id TEXT;
BEGIN
    v_tx_id := COALESCE(payload->>'id', 'tx_' || floor(extract(epoch from now()) * 1000)::text);
    v_receipt_number := COALESCE(payload->>'receipt_number', 'INV-' || to_char(now(), 'YYMMDDHH24MISS'));
    v_created_at := COALESCE((payload->>'created_at')::TIMESTAMPTZ, now());
    v_is_wholesale := COALESCE((payload->>'is_wholesale')::BOOLEAN, false);
    v_customer_name := COALESCE(payload->>'customer_name', 'ລູກຄ້າທົ່ວໄປ');
    v_payment_method := COALESCE(payload->>'payment_method', 'cash');
    
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
    
    -- Safe UUID parsing for cashier_id: if not a valid UUID format, store NULL
    IF (payload->>'cashier_id') IS NOT NULL 
       AND (payload->>'cashier_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_cashier_id := (payload->>'cashier_id')::UUID;
    ELSE
        v_cashier_id := NULL;
    END IF;
    
    -- Robust debt field extraction
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

    -- Insert into sale_transactions with full debt tracking & type-safe UUID cashier_id
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

    -- Process items and deduct stock
    v_items := payload->'items';
    IF v_items IS NOT NULL AND jsonb_array_length(v_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_to_recordset(v_items) AS x(
            id TEXT,
            product_id TEXT,
            productId TEXT,
            product_name TEXT,
            productName TEXT,
            quantity NUMERIC,
            unit_name TEXT,
            unitName TEXT,
            unit_price NUMERIC,
            unitPrice NUMERIC,
            multiplier NUMERIC,
            line_total NUMERIC,
            lineTotal NUMERIC,
            is_bundle BOOLEAN,
            isBundle BOOLEAN,
            bundle_id TEXT,
            bundleId TEXT,
            bundle_components JSONB,
            bundleComponents JSONB
        ) LOOP
            v_prod_id := COALESCE(v_item.product_id, v_item.productId);
            v_qty := COALESCE(v_item.quantity, 1);
            v_multiplier := COALESCE(v_item.multiplier, 1);
            
            -- Insert line item
            INSERT INTO public.sale_transaction_items (
                id,
                transaction_id,
                product_id,
                product_name,
                quantity,
                unit_name,
                unit_price,
                multiplier,
                line_total
            ) VALUES (
                COALESCE(v_item.id, 'item_' || floor(extract(epoch from now()) * 1000)::text || '_' || v_prod_id),
                v_tx_id,
                v_prod_id,
                COALESCE(v_item.product_name, v_item.productName, 'ສິນຄ້າ'),
                v_qty,
                COALESCE(v_item.unit_name, v_item.unitName, 'ອັນ'),
                COALESCE(v_item.unit_price, v_item.unitPrice, 0),
                v_multiplier,
                COALESCE(v_item.line_total, v_item.lineTotal, 0)
            ) ON CONFLICT (id) DO NOTHING;

            -- Deduct stock if regular tracked product
            IF v_prod_id IS NOT NULL AND v_prod_id <> 'p_custom' AND NOT COALESCE(v_item.is_bundle, v_item.isBundle, false) THEN
                SELECT track_stock, allow_negative_stock, current_stock_base_units 
                INTO v_track_stock, v_allow_neg, v_current_stock
                FROM public.products
                WHERE id = v_prod_id
                FOR UPDATE;

                IF FOUND AND (v_track_stock IS TRUE OR v_track_stock IS NULL) THEN
                    v_units_to_deduct := v_qty * v_multiplier;
                    v_new_stock := v_current_stock - v_units_to_deduct;

                    UPDATE public.products
                    SET current_stock_base_units = v_new_stock,
                        updated_at = now()
                    WHERE id = v_prod_id;

                    INSERT INTO public.inventory_movements (
                        product_id,
                        product_name,
                        movement_type,
                        reference_type,
                        reference_id,
                        quantity_change,
                        balance_before,
                        balance_after,
                        note,
                        created_at,
                        created_by
                    ) VALUES (
                        v_prod_id,
                        COALESCE(v_item.product_name, v_item.productName, 'ສິນຄ້າ'),
                        'OUT_SALE',
                        'SALE_TRANSACTION',
                        v_tx_id,
                        -v_units_to_deduct,
                        v_current_stock,
                        v_new_stock,
                        'Xuất bán đơn hàng POS: ' || v_receipt_number,
                        now(),
                        COALESCE(v_cashier_name, 'ໄມ້ຄຳ (Meii)')
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;

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

GRANT EXECUTE ON FUNCTION public.process_pos_checkout(JSONB) TO anon, authenticated, service_role;
