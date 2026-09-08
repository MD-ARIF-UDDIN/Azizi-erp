-- Migration: Allow Standalone Customer Advance Payments (Wallet Deposits) without requiring sale_id
ALTER TABLE public.payments ALTER COLUMN sale_id DROP NOT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
