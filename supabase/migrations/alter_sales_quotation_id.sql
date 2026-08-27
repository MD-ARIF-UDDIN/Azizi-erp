-- ============================================================
-- Migration: Add quotation_id column to sales table
-- ============================================================

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL;
