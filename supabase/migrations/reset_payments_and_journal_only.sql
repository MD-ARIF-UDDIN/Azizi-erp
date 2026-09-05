-- =========================================================================
-- FRESH START: Payments & Double-Entry Journal Records ONLY
-- =========================================================================
-- This script:
--   1. Ensures `payments` and `journal_entries` tables exist with all columns.
--   2. Enables RLS and public policies for payments & journal.
--   3. Adds performance indexes for payments and journal.
--   4. Clears all previous records from `payments` and `journal_entries`.
--   5. Resets all invoice payment statuses in `sales` back to 'Unpaid'.
--   (Does NOT touch accounts, wallets, expenses, customers, services, or users)
-- =========================================================================

-- 1. Ensure Payments Table Exists with All Necessary Columns
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Card', 'Mobile Banking', 'Bank Transfer')),
    account_id UUID,
    sale_item_id UUID,
    person_name TEXT,
    transaction_no TEXT,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    is_refund BOOLEAN NOT NULL DEFAULT false,
    refund_reason TEXT,
    received_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Ensure all optional columns are present
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS account_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS person_name TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS sale_item_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_refund BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Allow negative amounts for refunds
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_amount_check CHECK (amount <> 0);

-- 2. Ensure Journal Entries Table Exists with All Necessary Columns
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    entry_type TEXT NOT NULL CHECK (entry_type IN ('cash_in', 'cash_out', 'transfer', 'adjustment')),
    from_account TEXT NOT NULL,
    to_account TEXT NOT NULL,
    from_account_id UUID,
    to_account_id UUID,
    amount NUMERIC(12, 2) NOT NULL,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
    reference_no TEXT,
    description TEXT,
    performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- 3. Enable RLS and Policies for Payments and Journal
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_all_policy') THEN
    CREATE POLICY payments_all_policy ON public.payments FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'journal_entries_all_policy') THEN
    CREATE POLICY journal_entries_all_policy ON public.journal_entries FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Create Performance Indexes for Fast Lookups
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON public.payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_deleted ON public.payments(is_deleted);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_sale_id ON public.journal_entries(sale_id);

-- 5. CLEAR EXISTING PAYMENT & JOURNAL DATA (FRESH START)
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.journal_entries CASCADE;

-- 6. Reset invoice payment statuses to 'Unpaid'
UPDATE public.sales 
SET payment_status = 'Unpaid',
    updated_at = NOW();

-- Fresh restart of payments and journal complete!
