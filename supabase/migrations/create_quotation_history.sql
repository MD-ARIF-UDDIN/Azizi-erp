-- ============================================================
-- Migration: Add Quotation Status History Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quotation_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    remarks TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.quotation_status_history ENABLE ROW LEVEL SECURITY;

-- Select policies (accessible to everyone)
CREATE POLICY select_quotation_history_policy ON public.quotation_status_history FOR SELECT USING (true);

-- Modify policies for Authenticated and Anonymous Roles
CREATE POLICY modify_quotation_history_policy ON public.quotation_status_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_quotation_history_anon_policy ON public.quotation_status_history FOR ALL TO anon USING (true) WITH CHECK (true);
