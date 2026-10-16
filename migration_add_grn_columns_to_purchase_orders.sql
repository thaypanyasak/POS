-- ==============================================================================
-- Migration: Add Single-Product GRN Columns to purchase_orders table
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- if you wish to store single-product receipt fields directly on the purchase_orders table.
-- Note: The frontend web and Flutter apps already support both schema versions automatically!

ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS product_id TEXT REFERENCES public.products(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS product_name TEXT,
ADD COLUMN IF NOT EXISTS imported_base_units INT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS tier1_qty INT4 DEFAULT 0,
ADD COLUMN IF NOT EXISTS tier2_qty INT4 DEFAULT 0,
ADD COLUMN IF NOT EXISTS tier3_qty INT4 DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_thb NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS cost_lak INT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_per_base_unit INT8 DEFAULT 0;

-- Refresh PostgREST schema cache to ensure columns are recognized immediately
NOTIFY pgrst, 'reload schema';
