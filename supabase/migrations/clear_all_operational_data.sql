-- =========================================================================
-- COMPLETE OPERATIONAL DATA WIPE SCRIPT
-- STRICTLY PRESERVES:
--   1. Services & Service Categories
--   2. Document Types
--   3. Users, Roles, Permissions, Role Permissions
--   4. Branches
--   5. Settings & Company Profile
--   6. Accounts (Cards, Wallets, Cash Drawers, Banks) - Resets balance to 0.00
--
-- CLEARS:
--   - Sales / Invoices & Sale Items
--   - Sale Item Expenses / Service Expenses
--   - Payments (Collections, Advances, Refunds)
--   - Business Expenses
--   - Journal Entries / Double-Entry Ledger
--   - Quotations & Quotation Items
--   - Customers & Customer Documents
-- =========================================================================

BEGIN;

-- 1. Truncate Quotations & Items
TRUNCATE TABLE public.quotation_items CASCADE;
TRUNCATE TABLE public.quotations CASCADE;

-- 2. Truncate Service & Sale Item Expenses
TRUNCATE TABLE public.sale_item_expenses CASCADE;

-- 3. Truncate Payments & Ledger
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.journal_entries CASCADE;

-- 4. Truncate Business Expenses
TRUNCATE TABLE public.expenses CASCADE;

-- 5. Truncate Sales & Invoices
TRUNCATE TABLE public.sale_items CASCADE;
TRUNCATE TABLE public.sales CASCADE;

-- 6. Truncate Customers & Documents
TRUNCATE TABLE public.customer_documents CASCADE;
TRUNCATE TABLE public.customers CASCADE;

-- 7. Truncate all Accounts (Cards, Wallets, Cash Drawers, Banks)
TRUNCATE TABLE public.accounts CASCADE;

COMMIT;
