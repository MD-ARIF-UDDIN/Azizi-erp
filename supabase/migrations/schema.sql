-- Init Schema for Azizi Typing & Printing ERP
-- Suppress warnings
SET client_min_messages = warning;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

------------------------------------------------------------
-- TABLES
------------------------------------------------------------

-- 1. Branches
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

-- 2. Roles
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Permissions
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. RolePermissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

-- 5. Users (Employees)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- linked to auth.users in Supabase
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    permissions TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Customers
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Service Categories
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Services
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

-- 9. Order Statuses
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

-- 10. Sales
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
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- 11. Sale Items
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Card', 'Mobile Banking', 'Bank Transfer')),
    transaction_no TEXT,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    received_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- 13. Expense Categories
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    paid_to TEXT,
    payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Card', 'Mobile Banking', 'Bank Transfer')),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Order Status History
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    previous_status_id UUID REFERENCES public.order_statuses(id) ON DELETE SET NULL,
    new_status_id UUID NOT NULL REFERENCES public.order_statuses(id) ON DELETE RESTRICT,
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Audit Logs
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

-- 17. Client Documents
CREATE TABLE IF NOT EXISTS public.client_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('Visa', 'Emirates ID', 'Passport', 'Trade License', 'Other')),
    document_number TEXT,
    expiry_date DATE NOT NULL,
    notified BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Renewed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


------------------------------------------------------------
-- AUTOMATIC TIMESTAMPS TRIGGER FUNCTION
------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Attach update trigger to tables
CREATE TRIGGER update_branches_modtime BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roles_modtime BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_permissions_modtime BEFORE UPDATE ON public.permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_role_permissions_modtime BEFORE UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_modtime BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_modtime BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_categories_modtime BEFORE UPDATE ON public.service_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_services_modtime BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_statuses_modtime BEFORE UPDATE ON public.order_statuses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_modtime BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sale_items_modtime BEFORE UPDATE ON public.sale_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_modtime BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expense_categories_modtime BEFORE UPDATE ON public.expense_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_modtime BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_documents_modtime BEFORE UPDATE ON public.client_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
------------------------------------------------------------
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;


-- Select policies: All authenticated users can read basic master datasets
CREATE POLICY select_branches_policy ON public.branches FOR SELECT USING (true);
CREATE POLICY select_roles_policy ON public.roles FOR SELECT USING (true);
CREATE POLICY select_permissions_policy ON public.permissions FOR SELECT USING (true);
CREATE POLICY select_role_permissions_policy ON public.role_permissions FOR SELECT USING (true);
CREATE POLICY select_users_policy ON public.users FOR SELECT USING (true);
CREATE POLICY select_customers_policy ON public.customers FOR SELECT USING (true);
CREATE POLICY select_service_categories_policy ON public.service_categories FOR SELECT USING (true);
CREATE POLICY select_services_policy ON public.services FOR SELECT USING (true);
CREATE POLICY select_order_statuses_policy ON public.order_statuses FOR SELECT USING (true);
CREATE POLICY select_sales_policy ON public.sales FOR SELECT USING (true);
CREATE POLICY select_sale_items_policy ON public.sale_items FOR SELECT USING (true);
CREATE POLICY select_payments_policy ON public.payments FOR SELECT USING (true);
CREATE POLICY select_expense_categories_policy ON public.expense_categories FOR SELECT USING (true);
CREATE POLICY select_expenses_policy ON public.expenses FOR SELECT USING (true);
CREATE POLICY select_order_status_history_policy ON public.order_status_history FOR SELECT USING (true);
CREATE POLICY select_client_documents_policy ON public.client_documents FOR SELECT USING (true);


-- Insert/Update/Delete policies matching access levels (for simplicity, authorized via a helper role function or auth uid checks)
-- Standard PostgreSQL users can write if authenticated
CREATE POLICY modify_branches_policy ON public.branches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_roles_policy ON public.roles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_role_permissions_policy ON public.role_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_users_policy ON public.users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_customers_policy ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_service_categories_policy ON public.service_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_services_policy ON public.services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_order_statuses_policy ON public.order_statuses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_sales_policy ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_sale_items_policy ON public.sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_payments_policy ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_expense_categories_policy ON public.expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_expenses_policy ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_order_status_history_policy ON public.order_status_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY insert_audit_logs_policy ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY modify_client_documents_policy ON public.client_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- Anon role policies: needed because the app uses a custom auth system (not Supabase Auth),
-- so API calls arrive as 'anon' rather than 'authenticated'.
CREATE POLICY modify_branches_anon_policy ON public.branches FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY modify_roles_anon_policy ON public.roles FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY modify_role_permissions_anon_policy ON public.role_permissions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY modify_users_anon_policy ON public.users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY modify_customers_anon_policy ON public.customers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY modify_service_categories_anon_policy ON public.service_categories FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY modify_services_anon_policy ON public.services FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY modify_order_statuses_anon_policy ON public.order_statuses FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY modify_sales_anon_policy ON public.sales FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY modify_sale_items_anon_policy ON public.sale_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY modify_payments_anon_policy ON public.payments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY modify_expense_categories_anon_policy ON public.expense_categories FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY modify_expenses_anon_policy ON public.expenses FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY modify_order_status_history_anon_policy ON public.order_status_history FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY insert_audit_logs_anon_policy ON public.audit_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY modify_client_documents_anon_policy ON public.client_documents FOR ALL TO anon USING (true) WITH CHECK (true);

