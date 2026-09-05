-- =========================================================================
-- SQL SCRIPT: Empty All Payment, Transaction & Journal Data
-- =========================================================================
-- This script safely removes all:
--   1. Payments & Refunds (payments)
--   2. Cash In / Cash Out Journal entries (journal_entries)
--   3. Account Transactions / Ledger history (account_transactions)
-- And resets:
--   - sales.payment_status back to 'Unpaid'
--   - accounts.balance back to 0.00
-- =========================================================================

-- 1. Truncate payment, journal and transaction tables
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.journal_entries CASCADE;
TRUNCATE TABLE public.account_transactions CASCADE;

-- 2. Reset payment status for all sales/invoices
UPDATE public.sales 
SET payment_status = 'Unpaid',
    updated_at = NOW();

-- 3. Reset account balances to 0.00 (optional / clean start)
UPDATE public.accounts
SET balance = 0.00,
    updated_at = NOW();

-- (Optional) If you also want to clear test expenses, uncomment the following line:
-- TRUNCATE TABLE public.expenses CASCADE;
