-- ============================================================
-- Migration: Add Quotations and Quotation Items
-- ============================================================

-- 1. Create quotations table
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
    converted_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- 2. Create quotation_items table
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

-- 3. Create triggers for auto timestamps
CREATE TRIGGER update_quotations_modtime BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotation_items_modtime BEFORE UPDATE ON public.quotation_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

-- 5. Define Select Policies
CREATE POLICY select_quotations_policy ON public.quotations FOR SELECT USING (true);
CREATE POLICY select_quotation_items_policy ON public.quotation_items FOR SELECT USING (true);

-- 6. Define Modify Policies for Authenticated Role
CREATE POLICY modify_quotations_policy ON public.quotations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_quotation_items_policy ON public.quotation_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Define Modify Policies for Anonymous Role (custom auth compatibility)
CREATE POLICY modify_quotations_anon_policy ON public.quotations FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY modify_quotation_items_anon_policy ON public.quotation_items FOR ALL TO anon USING (true) WITH CHECK (true);
