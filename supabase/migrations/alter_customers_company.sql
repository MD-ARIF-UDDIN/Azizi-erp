-- ============================================================
-- Migration: Company Members & Person-Attributed Invoices
-- ============================================================

-- Add customer_type column (defaults to 'individual')
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (customer_type IN ('individual', 'company'));

-- Add members JSONB column on customers table to store list of company employees/members
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS members JSONB DEFAULT '[]'::jsonb;

-- Add person attributes to sales table
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS person_name TEXT;
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS person_phone TEXT;
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS person_email TEXT;
