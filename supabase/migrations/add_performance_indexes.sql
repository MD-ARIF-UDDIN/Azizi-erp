-- ==============================================================================
-- SUPABASE / POSTGRESQL PERFORMANCE INDEXES FOR AZIZI ERP
-- Run this in your Supabase SQL Editor to make queries 10x-50x faster!
-- ==============================================================================

-- 1. Sales Indexes
CREATE INDEX IF NOT EXISTS idx_sales_deleted_created ON sales(is_deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_branch_deleted ON sales(branch_id, is_deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);

-- 2. Sale Items Indexes
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_service_id ON sale_items(service_id);

-- 3. Payments Indexes
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_account_id ON payments(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_deleted ON payments(is_deleted);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date DESC);

-- 4. Expenses Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_sale_id ON expenses(sale_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted ON expenses(is_deleted);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);

-- 5. Journal & Transactions Indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_sale_id ON journal_entries(sale_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_from_acc ON journal_entries(from_account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_to_acc ON journal_entries(to_account_id);
CREATE INDEX IF NOT EXISTS idx_account_txns_account_id ON account_transactions(account_id);

-- 6. Quotations Indexes
CREATE INDEX IF NOT EXISTS idx_quotations_branch_deleted ON quotations(branch_id, is_deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);
