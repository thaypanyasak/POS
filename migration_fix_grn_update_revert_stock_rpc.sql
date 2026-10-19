-- ============================================================================
-- MEIISHOP ERP - MIGRATION: KHẮC PHỤC TRIỆT ĐỂ LỖI CẬP NHẬT TỒN KHO KHI SỬA PHIẾU NHẬP (GRN)
-- VẤN ĐỀ XỬ LÝ:
-- 1. Chống lỗi cộng dồn tồn kho (Stock Over-accumulation) khi người dùng sửa phiếu nhập.
-- 2. Thực hiện nguyên tắc REVERT & APPLY nguyên tử (ACID Transaction):
--    - Hoàn trả lại toàn bộ số lượng hàng cũ (old_item.imported_base_units) ra khỏi kho.
--    - Tự động bù trừ chính xác nếu có mặt hàng bị xóa bỏ khỏi phiếu nhập khi sửa.
--    - Cộng số lượng hàng mới và cập nhật giá vốn (Moving Average Cost).
-- 3. Chuẩn hóa công nợ & thanh toán (Payment & Debt Consistency):
--    - remaining_debt = new_total_amount - paid_amount
--    - Nếu paid_amount >= new_total_amount -> payment_status = 'PAID', debt_amount = 0 (tránh âm nợ).
-- 4. Hỗ trợ cả 2 tên RPC: process_multi_product_grn(JSONB) và update_grn(JSONB).
-- ============================================================================

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
    
    -- Các biến phục vụ cơ chế Revert & Apply
    v_is_update BOOLEAN := FALSE;
    v_old_item RECORD;
    v_cur_stock INT8;
    v_reverted_stock INT8;
    v_legacy_prod_id TEXT;
    v_legacy_prod_name TEXT;
    v_legacy_units INT8;
BEGIN
    -- 1. Trích xuất thông tin Header phiếu nhập
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
    v_notes := payload->>'notes';

    -- 2. Kiểm tra danh sách items mới
    v_items := payload->'items';
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RAISE EXCEPTION 'Phiếu nhập kho phải có ít nhất 1 sản phẩm!';
    END IF;

    -- 3. CẬP NHẬT CÔNG NỢ & TIỀN THANH TOÁN (PAYMENT & DEBT CONSISTENCY)
    v_paid_amount_lak := COALESCE((payload->>'paid_amount_lak')::INT8, 0);
    IF v_paid_amount_lak >= v_total_lak THEN
        v_payment_status := 'PAID';
        v_debt_amount_lak := 0;
        v_paid_amount_lak := v_total_lak; -- Tránh tiền trả vượt quá tổng tiền làm nợ bị âm
    ELSIF v_paid_amount_lak > 0 THEN
        v_payment_status := 'PARTIAL';
        v_debt_amount_lak := v_total_lak - v_paid_amount_lak;
    ELSE
        v_payment_status := 'DEBT';
        v_paid_amount_lak := 0;
        v_debt_amount_lak := v_total_lak;
    END IF;

    -- 4. BƯỚC 1 & 2: KIỂM TRA PHIẾU CŨ & HOÀN TÁC (REVERT) SỐ LƯỢNG CŨ RA KHỎI KHO
    SELECT EXISTS(SELECT 1 FROM public.purchase_orders WHERE id = v_po_code) INTO v_is_update;

    IF v_is_update THEN
        -- 4.1. Trường hợp phiếu đã có danh sách items trong purchase_order_items
        IF EXISTS (SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id = v_po_code) THEN
            FOR v_old_item IN
                SELECT product_id, product_name, imported_base_units
                FROM public.purchase_order_items
                WHERE purchase_order_id = v_po_code
            LOOP
                IF v_old_item.product_id IS NOT NULL AND v_old_item.imported_base_units > 0 THEN
                    -- Khóa dòng sản phẩm để trừ trả lại số lượng cũ
                    SELECT COALESCE(current_stock_base_units, 0)
                    INTO v_cur_stock
                    FROM public.products
                    WHERE id = v_old_item.product_id
                    FOR UPDATE;

                    IF FOUND THEN
                        -- Trừ trả lại tồn kho cũ: stock = stock - old_quantity
                        v_reverted_stock := v_cur_stock - v_old_item.imported_base_units;

                        UPDATE public.products
                        SET current_stock_base_units = v_reverted_stock,
                            updated_at = NOW()
                        WHERE id = v_old_item.product_id;

                        -- Ghi Thẻ kho Thao tác Hoàn kho cũ (ADJUST_OUT)
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
                            v_old_item.product_id,
                            COALESCE(v_old_item.product_name, 'ສິນຄ້າ'),
                            'ADJUST_OUT',
                            'PURCHASE_ORDER',
                            v_po_code,
                            -v_old_item.imported_base_units,
                            v_cur_stock,
                            v_reverted_stock,
                            'ຮອນຄືນສະຕັອກເກົ່າກ່ອນອັບເດດໃບຮັບ: ' || v_po_code,
                            NOW(),
                            v_receiver_name
                        );
                    END IF;
                END IF;
            END LOOP;
        ELSE
            -- 4.2. Tương thích ngược: Phiếu cũ đơn sản phẩm lưu trên header purchase_orders
            SELECT product_id, product_name, COALESCE(imported_base_units, 0)
            INTO v_legacy_prod_id, v_legacy_prod_name, v_legacy_units
            FROM public.purchase_orders
            WHERE id = v_po_code;

            IF v_legacy_prod_id IS NOT NULL AND v_legacy_units > 0 THEN
                SELECT COALESCE(current_stock_base_units, 0)
                INTO v_cur_stock
                FROM public.products
                WHERE id = v_legacy_prod_id
                FOR UPDATE;

                IF FOUND THEN
                    v_reverted_stock := v_cur_stock - v_legacy_units;

                    UPDATE public.products
                    SET current_stock_base_units = v_reverted_stock,
                        updated_at = NOW()
                    WHERE id = v_legacy_prod_id;

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
                        v_legacy_prod_id,
                        COALESCE(v_legacy_prod_name, 'ສິນຄ້າ'),
                        'ADJUST_OUT',
                        'PURCHASE_ORDER',
                        v_po_code,
                        -v_legacy_units,
                        v_cur_stock,
                        v_reverted_stock,
                        'ຮອນຄືນສະຕັອກເກົ່າ (Single PO) ກ່ອນອັບເດດ: ' || v_po_code,
                        NOW(),
                        v_receiver_name
                    );
                END IF;
            END IF;
        END IF;

        -- Xóa các dòng purchase_order_items cũ sau khi đã hoàn tồn kho xong
        DELETE FROM public.purchase_order_items WHERE purchase_order_id = v_po_code;
    END IF;

    -- 5. LẤY THÔNG TIN SẢN PHẨM ĐẦU TIÊN & TÍNH TỔNG SỐ LƯỢNG MỚI
    v_first_prod_id := v_items->0->>'product_id';
    v_first_prod_name := COALESCE(v_items->0->>'product_name', 'ສິນຄ້າຮັບເຂົ້າ');
    IF jsonb_array_length(v_items) > 1 THEN
        v_first_prod_name := v_first_prod_name || ' (+' || (jsonb_array_length(v_items) - 1)::TEXT || ' ລາຍການ)';
    END IF;

    v_total_base_units := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_total_base_units := v_total_base_units + COALESCE((v_item->>'base_units_added')::INT8, 0);
    END LOOP;

    -- 6. BƯỚC 4: CẬP NHẬT HEADER VÀO BẢNG purchase_orders
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

    -- Dọn dẹp items cũ nếu có (phòng hờ trường hợp tạo mới)
    IF NOT v_is_update THEN
        DELETE FROM public.purchase_order_items WHERE purchase_order_id = v_po_code;
    END IF;

    -- 7. BƯỚC 3: DUYỆT TỪNG MÓN MỚI, GHI ITEMS & CỘNG KHO (APPLY NEW QUANTITY)
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_item_count := v_item_count + 1;
        v_prod_id := v_item->>'product_id';
        v_base_units_added := COALESCE((v_item->>'base_units_added')::INT8, 0);
        v_cost_per_base := COALESCE((v_item->>'cost_per_base_unit')::INT8, 0);
        v_cost_lak := COALESCE((v_item->>'cost_lak_entered')::INT8, 0);
        v_cost_thb := COALESCE((v_item->>'cost_thb_entered')::NUMERIC, 0.00);

        -- 7.1. Insert dòng chi tiết vào purchase_order_items
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

        -- 7.2. Cập nhật products: stock mới = stock hiện tại + số lượng mới
        SELECT 
            COALESCE(current_stock_base_units, 0),
            COALESCE(cost_per_base_unit, 0)
        INTO v_old_stock, v_old_cost
        FROM public.products
        WHERE id = v_prod_id
        FOR UPDATE;

        IF FOUND THEN
            v_new_stock := v_old_stock + v_base_units_added;
            
            -- Tính giá vốn bình quân di động (Moving Average Cost)
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

            -- Ghi Thẻ kho Thao tác Nhập kho (IN_PURCHASE)
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
                CASE 
                    WHEN v_is_update THEN 'ຮັບສິນຄ້າເຂົ້າສາງ (ອັບເດດໃບຮັບ): ' || v_po_code
                    ELSE 'ຮັບສິນຄ້າເຂົ້າສາງເລກທີ: ' || v_po_code
                END,
                NOW(),
                v_receiver_name
            );
        END IF;

        -- 7.3. Cập nhật giá bán lẻ product_units nếu có overrides
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

    -- 8. GHI NHẬN LỊCH SỬ THANH TOÁN & CÔNG NỢ (supplier_debt_payments)
    IF v_is_update THEN
        -- Xóa các log ghi nhận ban đầu cũ để tránh trùng lặp khi sửa phiếu
        DELETE FROM public.supplier_debt_payments
        WHERE purchase_order_id = v_po_code
          AND (note LIKE '%Initial payment%' OR note LIKE '%Outstanding Debt%' OR note LIKE '%ອັບເດດໃບຮັບ%');
    END IF;

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
            CASE 
                WHEN v_is_update THEN 'ຊຳລະເບື້ອງຕົ້ນ (ອັບເດດໃບຮັບ) (Updated initial payment at GRN)'
                ELSE 'ຊຳລະເບື້ອງຕົ້ນຕອນຮັບສິນຄ້າ (Initial payment at GRN)'
            END,
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
            CASE 
                WHEN v_is_update THEN 'ບັນທຶກໜີ້ສິນ (ອັບເດດໃບຮັບ) (Updated debt recorded)'
                ELSE 'ບັນທຶກໜີ້ສິນ (Outstanding Debt recorded)'
            END,
            NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'po_code', v_po_code,
        'is_update', v_is_update,
        'item_count', v_item_count,
        'total_base_units', v_total_base_units,
        'total_lak', v_total_lak,
        'paid_amount_lak', v_paid_amount_lak,
        'debt_amount_lak', v_debt_amount_lak,
        'payment_status', v_payment_status,
        'message', CASE 
            WHEN v_is_update THEN 'ອັບເດດໃບຮັບສິນຄ້າ ແລະ ປັບປຸງສະຕັອກສຳເລັດ (GRN updated & stock reconciled with ACID revert & apply)'
            ELSE 'ບັນທຶກຮັບສິນຄ້າເຂົ້າສາງສຳເລັດ (GRN processed successfully)'
        END
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Alias RPC function: update_grn(payload JSONB)
CREATE OR REPLACE FUNCTION public.update_grn(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.process_multi_product_grn(payload);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_multi_product_grn(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_grn(JSONB) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
