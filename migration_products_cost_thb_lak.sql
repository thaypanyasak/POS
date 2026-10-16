-- ============================================================================
-- Migration: Add direct carton cost columns (cost_lak, cost_thb) to products table
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ============================================================================

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS cost_lak INT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_thb NUMERIC(10, 2) DEFAULT 0.00;

-- Optional backfill from existing cost_per_base_unit and units
UPDATE public.products p
SET cost_lak = p.cost_per_base_unit * COALESCE(
    (SELECT u.multiplier FROM public.product_units u WHERE u.product_id = p.id AND (u.unit_name = 'ແກັດ' OR u.unit_name = 'ລັງ' OR u.multiplier > 1) ORDER BY u.multiplier DESC LIMIT 1),
    1
)
WHERE p.cost_lak IS NULL OR p.cost_lak = 0;
