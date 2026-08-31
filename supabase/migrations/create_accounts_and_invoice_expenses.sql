-- =========================================================================
-- MIGRATION: Accounts, Cards (Wallets), Transactions & Invoice-Level Expenses
-- =========================================================================

-- 1. Accounts & Wallets Table (Cash Drawer, Portal Cards, Bank Accounts)
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('card', 'cash_drawer', 'bank', 'other')),
  bank_name text,
  account_number text,
  balance numeric NOT NULL DEFAULT 0,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- 2. Account Transactions Table (Deposits, Top-ups, Gov Expense Deductions, Transfers)
CREATE TABLE IF NOT EXISTS account_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'expense', 'income', 'transfer')),
  amount numeric NOT NULL,
  balance_after numeric,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  related_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  description text,
  reference_no text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Add sale_id and account_id to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES sales(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

-- 4. Add account_id to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

-- 5. Journal Entries Table (Cash In & Cash Out Double Entry Journal)
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date timestamptz NOT NULL DEFAULT now(),
  entry_type text NOT NULL CHECK (entry_type IN ('cash_in', 'cash_out', 'transfer', 'adjustment')),
  from_account text NOT NULL,
  to_account text NOT NULL,
  from_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  to_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL,
  reference_no text,
  description text,
  performed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- 6. Enable RLS and public policies (matching app conventions)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Allow public access to accounts') THEN
    CREATE POLICY "Allow public access to accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_transactions' AND policyname = 'Allow public access to account_transactions') THEN
    CREATE POLICY "Allow public access to account_transactions" ON account_transactions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'Allow public access to journal_entries') THEN
    CREATE POLICY "Allow public access to journal_entries" ON journal_entries FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
