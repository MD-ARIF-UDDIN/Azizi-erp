-- Add expense column to services table
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS expense NUMERIC(10, 2) DEFAULT 0.00 CHECK (expense >= 0);
