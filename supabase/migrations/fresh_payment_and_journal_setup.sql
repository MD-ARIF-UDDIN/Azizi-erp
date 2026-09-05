-- =========================================================================
-- COMPLETE MIGRATION & FRESH RESTART: Payments, Journals, Accounts & Ledgers
-- =========================================================================
-- Description:
--   1. Ensures all tables (accounts, payments, journal_entries, account_transactions)
--      exist with full columns, constraints, and RLS policies.
--   2. Seeds standard default Cash Drawers and Portal Accounts.
--   3. Safely resets/clears test payment & journal data for a fresh start.
--   4. Resets invoice payment statuses back to 'Unpaid' and account balances to 0.00.
-- =========================================================================

-- STEP 1: Ensure Accounts Table Exists with All Columns
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('card', 'cash_drawer', 'bank', 'other')),
    bank_name TEXT,
    account_number TEXT,
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- STEP 2: Ensure Payments Table Exists with All Columns
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Card', 'Mobile Banking', 'Bank Transfer')),
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
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

-- Ensure all optional columns exist on payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS person_name TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS sale_item_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_refund BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Drop positive-only constraint to allow refunds (negative amounts)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_amount_check CHECK (amount <> 0);

-- STEP 3: Ensure Account Transactions Table Exists with All Columns
CREATE TABLE IF NOT EXISTS public.account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'expense', 'income', 'transfer', 'top_up', 'adjustment')),
    amount NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2),
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    related_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    description TEXT,
    reference_no TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- STEP 4: Ensure Double-Entry Journal Entries Table Exists with All Columns
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    entry_type TEXT NOT NULL CHECK (entry_type IN ('cash_in', 'cash_out', 'transfer', 'adjustment')),
    from_account TEXT NOT NULL,
    to_account TEXT NOT NULL,
    from_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
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

-- STEP 5: Add account_id and sale_id to Expenses Table
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- STEP 6: Enable RLS & Policies
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'accounts_all_policy') THEN
    CREATE POLICY accounts_all_policy ON public.accounts FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_all_policy') THEN
    CREATE POLICY payments_all_policy ON public.payments FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_transactions' AND policyname = 'account_transactions_all_policy') THEN
    CREATE POLICY account_transactions_all_policy ON public.account_transactions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'journal_entries_all_policy') THEN
    CREATE POLICY journal_entries_all_policy ON public.journal_entries FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- STEP 7: Performance Indexes
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON public.payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_account_id ON public.payments(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_deleted ON public.payments(is_deleted);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_sale_id ON public.journal_entries(sale_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_from_acc ON public.journal_entries(from_account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_to_acc ON public.journal_entries(to_account_id);
CREATE INDEX IF NOT EXISTS idx_account_txns_account_id ON public.account_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_txns_created_at ON public.account_transactions(created_at DESC);

-- STEP 8: Seed Default Accounts / Cash Drawers
INSERT INTO public.accounts (id, name, type, bank_name, account_number, balance, is_active, is_deleted)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Main Cash Drawer', 'cash_drawer', NULL, NULL, 0.00, true, false),
  ('a2222222-2222-2222-2222-222222222222', 'ICP / E-Dirham Card', 'card', 'FAB Bank', '7829', 0.00, true, false),
  ('a3333333-3333-3333-3333-333333333333', 'Amer & Tasheel Portal Card', 'card', 'ENBD Bank', '4310', 0.00, true, false),
  ('a4444444-4444-4444-4444-444444444444', 'Corporate Bank Account', 'bank', 'Mashreq Bank', '9012', 0.00, true, false)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name,
    type = EXCLUDED.type,
    bank_name = EXCLUDED.bank_name,
    account_number = EXCLUDED.account_number,
    is_active = true,
    is_deleted = false;

-- STEP 9: FRESH START - Clear All Payment, Journal & Transaction Data
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.journal_entries CASCADE;
TRUNCATE TABLE public.account_transactions CASCADE;

-- STEP 10: Reset Invoice Payment Statuses & Account Balances
UPDATE public.sales 
SET payment_status = 'Unpaid',
    updated_at = NOW();

UPDATE public.accounts
SET balance = 0.00,
    updated_at = NOW();

-- Clean restart complete!
