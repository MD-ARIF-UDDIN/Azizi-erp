-- ============================================================
-- Migration: Add Terms and Conditions Table
-- ============================================================

-- 1. Create terms_conditions table
CREATE TABLE IF NOT EXISTS public.terms_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    sequence INT NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add terms_conditions_ids column to quotations table
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS terms_conditions_ids UUID[] DEFAULT '{}';

-- 3. Create triggers for auto timestamps on terms_conditions
CREATE TRIGGER update_terms_conditions_modtime 
    BEFORE UPDATE ON public.terms_conditions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.terms_conditions ENABLE ROW LEVEL SECURITY;

-- 5. Define Select Policies
CREATE POLICY select_terms_conditions_policy ON public.terms_conditions FOR SELECT USING (true);

-- 6. Define Modify Policies for Authenticated Role
CREATE POLICY modify_terms_conditions_policy ON public.terms_conditions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Define Modify Policies for Anonymous Role
CREATE POLICY modify_terms_conditions_anon_policy ON public.terms_conditions FOR ALL TO anon USING (true) WITH CHECK (true);
