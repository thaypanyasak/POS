-- ============================================================================
-- MIGRATION: MODULE QUẢN LÝ KHÁCH HÀNG & THEO DÕI CÔNG NỢ (CUSTOMERS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all actions on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow all actions for authenticated on customers" ON public.customers;

CREATE POLICY "Allow all actions on customers" 
    ON public.customers FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.customers TO anon, authenticated, service_role;

-- Indexes for lightning-fast search
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers(created_at DESC);

-- Enable Realtime Sync via Supabase (Safely check if already member to avoid error 42710)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_rel pr
        JOIN pg_publication p ON p.oid = pr.prpubid
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE p.pubname = 'supabase_realtime'
          AND n.nspname = 'public'
          AND c.relname = 'customers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
    END IF;
END $$;

-- 2. Add customer_id and customer_phone to sale_transactions table to strongly link bills to customers
ALTER TABLE public.sale_transactions 
ADD COLUMN IF NOT EXISTS customer_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS customer_phone TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_sale_transactions_customer_id ON public.sale_transactions(customer_id);

-- 2. Add customer_id and customer_phone to sale_transactions table to strongly link bills to customers
ALTER TABLE public.sale_transactions 
ADD COLUMN IF NOT EXISTS customer_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS customer_phone TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_sale_transactions_customer_id ON public.sale_transactions(customer_id);

