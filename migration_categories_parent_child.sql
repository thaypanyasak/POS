-- ============================================================================
-- Migration: Add parent_id to categories for 2-tier Category hierarchy (Cha - Con)
-- MeiiShop POS - Supabase PostgreSQL
-- ============================================================================

-- 1. Bổ sung cột parent_id vào bảng categories
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- 2. Đánh Index để tối ưu truy vấn danh mục con cực nhanh (< 1ms)
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);

COMMENT ON COLUMN public.categories.parent_id IS 'ID danh mục cha (NULL nếu là danh mục gốc / độc lập)';

