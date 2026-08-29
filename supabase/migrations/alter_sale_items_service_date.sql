-- Migration: Add service_date (and person_name if missing) to sale_items

ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS service_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS person_name TEXT;

-- Backfill existing rows: set service_date from created_at timestamp
UPDATE public.sale_items 
SET service_date = created_at::date 
WHERE service_date IS NULL;
