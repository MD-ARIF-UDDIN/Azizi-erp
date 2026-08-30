-- Migration: Add staff_id to sale_items
ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
