-- =========================================================================
-- AZIZI ERP: COMPLETE DATABASE SCHEMA, MASTER DATA & SEED USER
-- Target Supabase Project: https://cqpwdrokavkasmvapmsl.supabase.co
-- Seed User: support@gmail.com / support123 (Owner Role)
-- =========================================================================

SET client_min_messages = warning;

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 2. Timestamp Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- =========================================================================
-- 3. CORE TABLES
-- =========================================================================

-- Branches
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permissions
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Role Permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

-- Users (Employees / Admins)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    name TEXT NOT NULL,
    username TEXT,
    email TEXT NOT NULL UNIQUE,
    password TEXT DEFAULT 'support123',
    phone TEXT,
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    permissions TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customers (Individuals & Corporate Companies)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    customer_type TEXT NOT NULL DEFAULT 'individual',
    company_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    members JSONB DEFAULT '[]'::jsonb,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service Categories
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Services
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    expense NUMERIC(10, 2) DEFAULT 0.00 CHECK (expense >= 0),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order Statuses
CREATE TABLE IF NOT EXISTS public.order_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6b7280',
    sequence INT NOT NULL DEFAULT 0,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document Types
CREATE TABLE IF NOT EXISTS public.document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client Documents
CREATE TABLE IF NOT EXISTS public.client_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    document_number TEXT,
    expiry_date DATE NOT NULL,
    notified BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Renewed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Accounts (Cash Drawers, Bank Accounts, Payment Cards)
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

-- Quotations
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_no TEXT NOT NULL UNIQUE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    employee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    grand_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted')),
    valid_until DATE,
    notes TEXT,
    person_name TEXT,
    person_phone TEXT,
    person_email TEXT,
    remarks TEXT,
    terms_conditions_ids UUID[] DEFAULT '{}',
    converted_sale_id UUID,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Quotation Items
CREATE TABLE IF NOT EXISTS public.quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quotation Templates
CREATE TABLE IF NOT EXISTS public.quotation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    terms_conditions_ids JSONB DEFAULT '[]'::jsonb,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Terms & Conditions
CREATE TABLE IF NOT EXISTS public.terms_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    sequence INT NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sales (Invoices)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_no TEXT NOT NULL UNIQUE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    employee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    grand_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
    payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Partially Paid', 'Paid')),
    order_status_id UUID NOT NULL REFERENCES public.order_statuses(id) ON DELETE RESTRICT,
    notes TEXT,
    person_name TEXT,
    person_phone TEXT,
    person_email TEXT,
    quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Sale Items
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
    staff_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    person_name TEXT,
    service_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    expense NUMERIC(10, 2) DEFAULT 0.00,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    expense_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expense Categories
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    paid_to TEXT,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount <> 0),
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    transaction_no TEXT,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    person_name TEXT,
    sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    is_refund BOOLEAN NOT NULL DEFAULT false,
    refund_reason TEXT,
    received_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Account Transactions
CREATE TABLE IF NOT EXISTS public.account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'expense', 'income', 'transfer', 'top_up', 'adjustment')),
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

-- Journal Entries (General Ledger / Cash Flow)
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

-- Order Status History
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    previous_status_id UUID REFERENCES public.order_statuses(id) ON DELETE SET NULL,
    new_status_id UUID NOT NULL REFERENCES public.order_statuses(id) ON DELETE RESTRICT,
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 4. ATTACH AUTOMATIC TIMESTAMP TRIGGERS
-- =========================================================================
DROP TRIGGER IF EXISTS update_branches_modtime ON public.branches;
CREATE TRIGGER update_branches_modtime BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roles_modtime ON public.roles;
CREATE TRIGGER update_roles_modtime BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_permissions_modtime ON public.permissions;
CREATE TRIGGER update_permissions_modtime BEFORE UPDATE ON public.permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_role_permissions_modtime ON public.role_permissions;
CREATE TRIGGER update_role_permissions_modtime BEFORE UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_modtime ON public.users;
CREATE TRIGGER update_users_modtime BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_modtime ON public.customers;
CREATE TRIGGER update_customers_modtime BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_categories_modtime ON public.service_categories;
CREATE TRIGGER update_service_categories_modtime BEFORE UPDATE ON public.service_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_services_modtime ON public.services;
CREATE TRIGGER update_services_modtime BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_order_statuses_modtime ON public.order_statuses;
CREATE TRIGGER update_order_statuses_modtime BEFORE UPDATE ON public.order_statuses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_types_modtime ON public.document_types;
CREATE TRIGGER update_document_types_modtime BEFORE UPDATE ON public.document_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_documents_modtime ON public.client_documents;
CREATE TRIGGER update_client_documents_modtime BEFORE UPDATE ON public.client_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounts_modtime ON public.accounts;
CREATE TRIGGER update_accounts_modtime BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotations_modtime ON public.quotations;
CREATE TRIGGER update_quotations_modtime BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotation_items_modtime ON public.quotation_items;
CREATE TRIGGER update_quotation_items_modtime BEFORE UPDATE ON public.quotation_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotation_templates_modtime ON public.quotation_templates;
CREATE TRIGGER update_quotation_templates_modtime BEFORE UPDATE ON public.quotation_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_terms_conditions_modtime ON public.terms_conditions;
CREATE TRIGGER update_terms_conditions_modtime BEFORE UPDATE ON public.terms_conditions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_modtime ON public.sales;
CREATE TRIGGER update_sales_modtime BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sale_items_modtime ON public.sale_items;
CREATE TRIGGER update_sale_items_modtime BEFORE UPDATE ON public.sale_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_modtime ON public.payments;
CREATE TRIGGER update_payments_modtime BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expense_categories_modtime ON public.expense_categories;
CREATE TRIGGER update_expense_categories_modtime BEFORE UPDATE ON public.expense_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_modtime ON public.expenses;
CREATE TRIGGER update_expenses_modtime BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS branches_all_policy ON public.branches;
    CREATE POLICY branches_all_policy ON public.branches FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS roles_all_policy ON public.roles;
    CREATE POLICY roles_all_policy ON public.roles FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS permissions_all_policy ON public.permissions;
    CREATE POLICY permissions_all_policy ON public.permissions FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS role_permissions_all_policy ON public.role_permissions;
    CREATE POLICY role_permissions_all_policy ON public.role_permissions FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS users_all_policy ON public.users;
    CREATE POLICY users_all_policy ON public.users FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS customers_all_policy ON public.customers;
    CREATE POLICY customers_all_policy ON public.customers FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_categories_all_policy ON public.service_categories;
    CREATE POLICY service_categories_all_policy ON public.service_categories FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS services_all_policy ON public.services;
    CREATE POLICY services_all_policy ON public.services FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS order_statuses_all_policy ON public.order_statuses;
    CREATE POLICY order_statuses_all_policy ON public.order_statuses FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS document_types_all_policy ON public.document_types;
    CREATE POLICY document_types_all_policy ON public.document_types FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS client_documents_all_policy ON public.client_documents;
    CREATE POLICY client_documents_all_policy ON public.client_documents FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS accounts_all_policy ON public.accounts;
    CREATE POLICY accounts_all_policy ON public.accounts FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS account_transactions_all_policy ON public.account_transactions;
    CREATE POLICY account_transactions_all_policy ON public.account_transactions FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS journal_entries_all_policy ON public.journal_entries;
    CREATE POLICY journal_entries_all_policy ON public.journal_entries FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS quotations_all_policy ON public.quotations;
    CREATE POLICY quotations_all_policy ON public.quotations FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS quotation_items_all_policy ON public.quotation_items;
    CREATE POLICY quotation_items_all_policy ON public.quotation_items FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS quotation_templates_all_policy ON public.quotation_templates;
    CREATE POLICY quotation_templates_all_policy ON public.quotation_templates FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS terms_conditions_all_policy ON public.terms_conditions;
    CREATE POLICY terms_conditions_all_policy ON public.terms_conditions FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS sales_all_policy ON public.sales;
    CREATE POLICY sales_all_policy ON public.sales FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS sale_items_all_policy ON public.sale_items;
    CREATE POLICY sale_items_all_policy ON public.sale_items FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS payments_all_policy ON public.payments;
    CREATE POLICY payments_all_policy ON public.payments FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS expense_categories_all_policy ON public.expense_categories;
    CREATE POLICY expense_categories_all_policy ON public.expense_categories FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS expenses_all_policy ON public.expenses;
    CREATE POLICY expenses_all_policy ON public.expenses FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS order_status_history_all_policy ON public.order_status_history;
    CREATE POLICY order_status_history_all_policy ON public.order_status_history FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS audit_logs_all_policy ON public.audit_logs;
    CREATE POLICY audit_logs_all_policy ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
END $$;

-- =========================================================================
-- 6. MASTER SEED DATA
-- =========================================================================

-- Branches
INSERT INTO public.branches (id, name, address, phone, email) VALUES
('b1111111-1111-1111-1111-111111111111', 'Main Branch (Dubai)', 'Al Garhoud, Dubai, UAE', '+97142000000', 'dubai@azizi.com'),
('b2222222-2222-2222-2222-222222222222', 'Deira Branch', 'Deira Commercial Center, Dubai', '+97143000000', 'deira@azizi.com')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address;

-- Roles
INSERT INTO public.roles (id, name, description) VALUES
('00000000-0000-0000-0000-000000000000', 'Owner', 'Business owner with complete multi-branch management and financial clearance.'),
('11111111-1111-1111-1111-111111111111', 'Super Admin', 'Complete system access, multi-branch overview.'),
('22222222-2222-2222-2222-222222222222', 'Branch Manager', 'Manage branch-specific sales, customers, and employees.'),
('33333333-3333-3333-3333-333333333333', 'Cashier', 'Create sales invoice, receive payments, view customer ledger.'),
('44444444-4444-4444-4444-444444444444', 'Production Exec', 'Update status of orders (Typing, Stamp making, Printing).')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Permissions
INSERT INTO public.permissions (id, name, description) VALUES
('a0000000-0000-0000-0000-000000000001', 'Customer.View', 'Grants capability to view customer profiles.'),
('a0000000-0000-0000-0000-000000000002', 'Customer.Create', 'Grants capability to register customer profiles.'),
('a0000000-0000-0000-0000-000000000003', 'Customer.Update', 'Grants capability to modify customer profiles.'),
('a0000000-0000-0000-0000-000000000004', 'Customer.Delete', 'Grants capability to soft-delete customer profiles.'),
('a0000000-0000-0000-0000-000000000005', 'Sales.View', 'Grants capability to view sales invoice ledgers.'),
('a0000000-0000-0000-0000-000000000006', 'Sales.Create', 'Grants capability to create sales invoices.'),
('a0000000-0000-0000-0000-000000000007', 'Sales.Update', 'Grants capability to transition job workflow statuses.'),
('a0000000-0000-0000-0000-000000000008', 'Sales.Delete', 'Grants capability to soft-delete sales invoices.'),
('a0000000-0000-0000-0000-000000000009', 'Payments.View', 'Grants capability to view receipts cashbook.'),
('a0000000-0000-0000-0000-000000000010', 'Payments.Create', 'Grants capability to record collections payments.'),
('a0000000-0000-0000-0000-000000000011', 'Payments.Delete', 'Grants capability to remove payment receipts.'),
('a0000000-0000-0000-0000-000000000012', 'Expenses.View', 'Grants capability to view operating expense logs.'),
('a0000000-0000-0000-0000-000000000013', 'Expenses.Create', 'Grants capability to log shop expenditures.'),
('a0000000-0000-0000-0000-000000000014', 'Expenses.Update', 'Grants capability to edit expenditure details.'),
('a0000000-0000-0000-0000-000000000015', 'Expenses.Delete', 'Grants capability to delete expenditure entries.'),
('a0000000-0000-0000-0000-000000000016', 'Branches.View', 'Grants capability to inspect operational branch registers.'),
('a0000000-0000-0000-0000-000000000017', 'Branches.Create', 'Grants capability to register physical business branches.'),
('a0000000-0000-0000-0000-000000000018', 'Branches.Update', 'Grants capability to update branch details.'),
('a0000000-0000-0000-0000-000000000019', 'Branches.Delete', 'Grants capability to delete business branches.'),
('a0000000-0000-0000-0000-000000000020', 'Users.View', 'Grants capability to inspect employee list.'),
('a0000000-0000-0000-0000-000000000021', 'Users.Create', 'Grants capability to register employees.'),
('a0000000-0000-0000-0000-000000000022', 'Users.Update', 'Grants capability to edit employee profiles.'),
('a0000000-0000-0000-0000-000000000023', 'Users.Delete', 'Grants capability to terminate employees.'),
('a0000000-0000-0000-0000-000000000024', 'Roles.View', 'Grants capability to view roles.'),
('a0000000-0000-0000-0000-000000000025', 'Roles.Update', 'Grants capability to modify role security permissions matrix.'),
('a0000000-0000-0000-0000-000000000026', 'Reports.View', 'Grants capability to inspect financial analytics reports.'),
('a0000000-0000-0000-0000-000000000027', 'Settings.Update', 'Grants capability to modify global ERP settings.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Role Permissions Mappings
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000000', id FROM public.permissions ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '11111111-1111-1111-1111-111111111111', id FROM public.permissions ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '22222222-2222-2222-2222-222222222222', id FROM public.permissions 
WHERE name IN ('Customer.View', 'Customer.Create', 'Customer.Update', 'Sales.View', 'Sales.Create', 'Sales.Update', 'Payments.View', 'Payments.Create', 'Expenses.View', 'Expenses.Create', 'Expenses.Update', 'Branches.View', 'Users.View', 'Users.Create', 'Users.Update', 'Reports.View') 
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '33333333-3333-3333-3333-333333333333', id FROM public.permissions 
WHERE name IN ('Customer.View', 'Customer.Create', 'Customer.Update', 'Sales.View', 'Sales.Create', 'Payments.View', 'Payments.Create', 'Reports.View') 
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '44444444-4444-4444-4444-444444444444', id FROM public.permissions 
WHERE name IN ('Sales.View', 'Sales.Update') 
ON CONFLICT DO NOTHING;

-- Order Statuses
INSERT INTO public.order_statuses (id, name, color, sequence, is_system) VALUES
('11111111-0000-0000-0000-000000000001', 'Pending', '#ef4444', 1, TRUE),
('11111111-0000-0000-0000-000000000002', 'Designing', '#f97316', 2, FALSE),
('11111111-0000-0000-0000-000000000003', 'Typing', '#06b6d4', 3, FALSE),
('11111111-0000-0000-0000-000000000004', 'Printing', '#3b82f6', 4, FALSE),
('11111111-0000-0000-0000-000000000005', 'Stamp Making', '#8b5cf6', 5, FALSE),
('11111111-0000-0000-0000-000000000006', 'Waiting Approval', '#eab308', 6, FALSE),
('11111111-0000-0000-0000-000000000007', 'Ready', '#10b981', 7, TRUE),
('11111111-0000-0000-0000-000000000008', 'Delivered', '#64748b', 8, TRUE),
('11111111-0000-0000-0000-000000000009', 'Completed', '#22c55e', 9, TRUE),
('11111111-0000-0000-0000-000000000010', 'Cancelled', '#000000', 10, TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, sequence = EXCLUDED.sequence;

-- Document Types
INSERT INTO public.document_types (name, description, is_active) VALUES
('Visa', 'Residency / Employment / Visit Visas', true),
('Emirates ID', 'Emirates Identity Authority Cards', true),
('Passport', 'Client & Dependent Passports', true),
('Trade License', 'DED & Commercial Trade Licenses', true),
('Labour Card', 'MOHRE Work Permit Cards', true),
('Tenancy Contract', 'Ejari / Tawtheeq Leases', true),
('Medical Insurance', 'Health Insurance Cards / Policies', true),
('Other', 'Miscellaneous Documents', true)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- Service Categories
INSERT INTO public.service_categories (id, name, description) VALUES
('c1111111-1111-1111-1111-111111111111', 'Visa Services', 'Employment visa, family visa, visit visa renewals and applications.'),
('c2222222-2222-2222-2222-222222222222', 'Emirates ID', 'New Emirates ID registration and renewals.'),
('c3333333-3333-3333-3333-333333333333', 'MOHRE Services', 'Work permit composing and submissions.'),
('c4444444-4444-4444-4444-444444444444', 'MOFA Attestation', 'MOFA degree, marriage, and birth certificate attestation.'),
('c5555555-5555-5555-5555-555555555555', 'Business Services', 'Trade license renewals, corporate setups.'),
('c6666666-6666-6666-6666-666666666666', 'Printing & Stamp Making', 'Company stamp design, photocopying, and color printing.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Services
INSERT INTO public.services (id, category_id, name, description, price, expense, status) VALUES
('d1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'New Employment Visa', 'Full process for new employee entry visa composing.', 1500.00, 1100.00, 'Active'),
('d1111111-1111-1111-1111-111111111112', 'c1111111-1111-1111-1111-111111111111', 'Visa Renewal', 'Employment or residence visa renewal composing.', 1200.00, 900.00, 'Active'),
('d1111111-1111-1111-1111-111111111113', 'c1111111-1111-1111-1111-111111111111', 'Family Visa', 'Sponsoring family members residence visas.', 2000.00, 1400.00, 'Active'),
('d1111111-1111-1111-1111-111111111114', 'c1111111-1111-1111-1111-111111111111', 'Visit Visa', 'Tourist or leisure visit visa applications.', 800.00, 500.00, 'Active'),
('d2222222-2222-2222-2222-222222222221', 'c2222222-2222-2222-2222-222222222222', 'New Emirates ID', 'Biometrics scheduling and new ID registration.', 250.00, 180.00, 'Active'),
('d2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'Emirates ID Renewal', 'Form typing for Emirates ID renewal.', 250.00, 180.00, 'Active'),
('d3333333-3333-3333-3333-333333333331', 'c3333333-3333-3333-3333-333333333333', 'Work Permit', 'MOHRE work contract draft and permit composing.', 600.00, 400.00, 'Active'),
('d4444444-4444-4444-4444-444444444441', 'c4444444-4444-4444-4444-444444444444', 'MOFA Attestation', 'Attesting legal documents from Ministry of Foreign Affairs.', 150.00, 100.00, 'Active'),
('d5555555-5555-5555-5555-555555555551', 'c5555555-5555-5555-5555-555555555555', 'Trade License', 'DED trade license renewal and corporate forms typing.', 3000.00, 2200.00, 'Active'),
('d6666666-6666-6666-6666-666666666661', 'c6666666-6666-6666-6666-666666666666', 'Company Stamp', 'Custom-designed self-ink or rubber official company stamp.', 120.00, 40.00, 'Active')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price, expense = EXCLUDED.expense;

-- Expense Categories
INSERT INTO public.expense_categories (id, name, description) VALUES
('e1111111-1111-1111-1111-111111111111', 'Shop Rent', 'Monthly lease rental fee.'),
('e2222222-2222-2222-2222-222222222222', 'Utility Electricity', 'Electric bills and gas supplies.'),
('e3333333-3333-3333-3333-333333333333', 'Paper & Stationery', 'Purchases of A4 paper rims, cardboards, rubber materials.'),
('e4444444-4444-4444-4444-444444444444', 'Printer Toner / Ink Refill', 'Printer cartridge refills and laser toners.'),
('e5555555-5555-5555-5555-555555555555', 'Staff Salaries', 'Wages for typists and stamp designers.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Terms & Conditions (Strict Hex UUIDs)
INSERT INTO public.terms_conditions (id, title, content, sequence) VALUES
('77777777-0000-0000-0000-000000000001', 'Validity', 'This quotation is valid for 15 days from the date of issue.', 1),
('77777777-0000-0000-0000-000000000002', 'Payment Terms', '50% advance payment is required to initiate orders. Remaining balance must be cleared upon delivery.', 2),
('77777777-0000-0000-0000-000000000003', 'Verification', 'Customers must carefully verify typed contents (names, spelling, numbers) before official submission.', 3)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content;

-- Default Cash Drawer & Bank Accounts (Strict Hex UUIDs)
INSERT INTO public.accounts (id, name, type, bank_name, balance, branch_id) VALUES
('88888888-0000-0000-0000-000000000001', 'Main Cash Drawer', 'cash_drawer', NULL, 0.00, 'b1111111-1111-1111-1111-111111111111'),
('88888888-0000-0000-0000-000000000002', 'Emirates NBD Corporate', 'bank', 'Emirates NBD', 0.00, 'b1111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, bank_name = EXCLUDED.bank_name;


-- =========================================================================
-- 7. SEED USER ACCOUNT: support@gmail.com / support123 (Owner Role)
-- =========================================================================
DO $$
DECLARE
  target_user_id UUID := '00000000-0000-0000-0000-00000000000c';
  owner_role_id UUID := '00000000-0000-0000-0000-000000000000';
  default_branch_id UUID := 'b1111111-1111-1111-1111-111111111111';
  encrypted_pw TEXT;
  all_perms TEXT[] := ARRAY[
    'Customer.View', 'Customer.Create', 'Customer.Update', 'Customer.Delete',
    'Sales.View', 'Sales.Create', 'Sales.Update', 'Sales.Delete',
    'Payments.View', 'Payments.Create', 'Payments.Delete',
    'Expenses.View', 'Expenses.Create', 'Expenses.Update', 'Expenses.Delete',
    'Branches.View', 'Branches.Create', 'Branches.Update', 'Branches.Delete',
    'Users.View', 'Users.Create', 'Users.Update', 'Users.Delete',
    'Roles.View', 'Roles.Update', 'Reports.View', 'Settings.Update'
  ];
BEGIN
  -- Generate bcrypt hash for 'support123'
  encrypted_pw := extensions.crypt('support123', extensions.gen_salt('bf', 10));

  -- Insert/Update auth.users (Supabase Auth)
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = 'support@gmail.com') THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
        confirmation_token, email_change, email_change_token_new, recovery_token
      )
      VALUES (
        '00000000-0000-0000-0000-000000000000', target_user_id, 'authenticated', 'authenticated', 
        'support@gmail.com', encrypted_pw, now(), 
        '{"provider":"email","providers":["email"]}', '{"name":"Support Admin"}', 
        now(), now(), '', '', '', ''
      );
    ELSE
      UPDATE auth.users 
      SET encrypted_password = encrypted_pw, updated_at = now()
      WHERE LOWER(email) = 'support@gmail.com';
    END IF;

    -- auth.identities
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE id = target_user_id OR user_id = target_user_id) THEN
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (target_user_id, target_user_id, jsonb_build_object('sub', target_user_id, 'email', 'support@gmail.com'), 'email', target_user_id, null, now(), now())
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Insert/Update public.users (ERP Employee Profile)
  IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(email) = 'support@gmail.com') THEN
    UPDATE public.users
    SET 
      name = 'Support Admin',
      password = 'support123',
      role_id = owner_role_id,
      branch_id = default_branch_id,
      permissions = all_perms,
      status = 'Active',
      is_deleted = false,
      updated_at = now()
    WHERE LOWER(email) = 'support@gmail.com';
  ELSE
    INSERT INTO public.users (
      id, auth_user_id, name, username, email, password, phone, role_id, branch_id, permissions, status, is_deleted, created_at, updated_at
    )
    VALUES (
      target_user_id, target_user_id, 'Support Admin', 'support', 'support@gmail.com', 'support123', '+971500000002',
      owner_role_id, default_branch_id,
      all_perms,
      'Active', false, now(), now()
    );
  END IF;

END $$;
