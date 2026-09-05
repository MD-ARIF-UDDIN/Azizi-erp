-- =========================================================================
-- COMPLETE CONSOLIDATED MIGRATION: All Tables, Columns & Constraints
-- =========================================================================

-- 1. Helper function for updated_at timestamps (if not already present)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';


-- 2. Ensure Missing Tables Exist
-- -------------------------------------------------------------
-- Document Types Table
CREATE TABLE IF NOT EXISTS public.document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_types_name_unique ON public.document_types(name);

DROP TRIGGER IF EXISTS update_document_types_modtime ON public.document_types;
CREATE TRIGGER update_document_types_modtime
    BEFORE UPDATE ON public.document_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_types' AND policyname = 'select_document_types_policy') THEN
        CREATE POLICY select_document_types_policy ON public.document_types FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_types' AND policyname = 'modify_document_types_auth_policy') THEN
        CREATE POLICY modify_document_types_auth_policy ON public.document_types FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_types' AND policyname = 'modify_document_types_anon_policy') THEN
        CREATE POLICY modify_document_types_anon_policy ON public.document_types FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Seed document types safely
INSERT INTO public.document_types (name, description, is_active)
SELECT d.name, d.description, d.is_active
FROM (VALUES
    ('Visa', 'Residency / Employment / Visit Visas', true),
    ('Emirates ID', 'Emirates Identity Authority Cards', true),
    ('Passport', 'Client & Dependent Passports', true),
    ('Trade License', 'DED & Commercial Trade Licenses', true),
    ('Labour Card', 'MOHRE Work Permit Cards', true),
    ('Tenancy Contract', 'Ejari / Tawtheeq Leases', true),
    ('Medical Insurance', 'Health Insurance Cards / Policies', true),
    ('Other', 'Miscellaneous Documents', true)
) AS d(name, description, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM public.document_types dt WHERE dt.name = d.name
);

-- Accounts & Wallets Table (Cards, Cash Drawer, Bank Accounts)
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('card', 'cash_drawer', 'bank', 'other')),
    bank_name TEXT,
    account_number TEXT,
    balance NUMERIC NOT NULL DEFAULT 0,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'accounts_all_policy') THEN
        CREATE POLICY accounts_all_policy ON public.accounts FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Account Transactions Table
CREATE TABLE IF NOT EXISTS public.account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    balance_after NUMERIC,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    related_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    description TEXT,
    reference_no TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_transactions' AND policyname = 'account_transactions_all_policy') THEN
        CREATE POLICY account_transactions_all_policy ON public.account_transactions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Journal Entries Table (Cash In & Cash Out Double Entry Journal)
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    entry_type TEXT NOT NULL CHECK (entry_type IN ('cash_in', 'cash_out', 'transfer', 'adjustment')),
    from_account TEXT NOT NULL,
    to_account TEXT NOT NULL,
    from_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
    reference_no TEXT,
    description TEXT,
    performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'journal_entries_all_policy') THEN
        CREATE POLICY journal_entries_all_policy ON public.journal_entries FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 3. Add All Missing Columns across All Tables
-- -------------------------------------------------------------
-- Customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS members JSONB DEFAULT '[]'::jsonb;

-- Users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT DEFAULT 'password';

-- Services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS expense NUMERIC(10, 2) DEFAULT 0.00;

-- Sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS person_name TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS person_phone TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS person_email TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS quotation_id UUID;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Sale Items
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS person_name TEXT;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS service_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS expense NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS account_id UUID;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS expense_id UUID;

-- Expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS account_id UUID;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS person_name TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS sale_item_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS account_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_refund BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Quotations (if quotations table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quotations') THEN
        ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS remarks TEXT;
        ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS terms_conditions_ids UUID[] DEFAULT '{}';
        ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS person_name TEXT;
        ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS person_phone TEXT;
        ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS person_email TEXT;
    END IF;
END $$;


-- 4. Fix Restrictive Check Constraints
-- -------------------------------------------------------------
-- Payments: Allow negative amounts for refunds
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_amount_check CHECK (amount <> 0);

-- Client Documents: Drop restrictive document_type enum check
ALTER TABLE public.client_documents DROP CONSTRAINT IF EXISTS client_documents_document_type_check;

-- Account Transactions: Expand allowed transaction types
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_transactions') THEN
        ALTER TABLE public.account_transactions DROP CONSTRAINT IF EXISTS account_transactions_transaction_type_check;
        ALTER TABLE public.account_transactions ADD CONSTRAINT account_transactions_transaction_type_check 
            CHECK (transaction_type IN ('deposit', 'withdrawal', 'expense', 'income', 'transfer', 'top_up', 'adjustment'));
    END IF;
END $$;


-- 5. Safe Data Cleanup (Ensure is_deleted is not null)
-- -------------------------------------------------------------
UPDATE public.payments SET is_deleted = false WHERE is_deleted IS NULL;
UPDATE public.sales SET is_deleted = false WHERE is_deleted IS NULL;
UPDATE public.expenses SET is_deleted = false WHERE is_deleted IS NULL;


-- 6. Safe Performance Indexes
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_staff_id ON public.sale_items(staff_id);
CREATE INDEX IF NOT EXISTS idx_expenses_sale_item_id ON public.expenses(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale_item_id ON public.payments(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_sales_quotation_id ON public.sales(quotation_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_customer ON public.client_documents(customer_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_sale ON public.journal_entries(sale_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(entry_date);
