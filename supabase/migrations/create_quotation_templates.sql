-- ============================================================
-- Migration: Add Quotation Templates Table
-- ============================================================

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

-- Triggers for auto timestamps
CREATE TRIGGER update_quotation_templates_modtime 
BEFORE UPDATE ON public.quotation_templates 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.quotation_templates ENABLE ROW LEVEL SECURITY;

-- Select policy
CREATE POLICY select_quotation_templates_policy ON public.quotation_templates FOR SELECT USING (true);

-- Modify policies for Authenticated & Anon roles
CREATE POLICY modify_quotation_templates_auth_policy ON public.quotation_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_quotation_templates_anon_policy ON public.quotation_templates FOR ALL TO anon USING (true) WITH CHECK (true);
