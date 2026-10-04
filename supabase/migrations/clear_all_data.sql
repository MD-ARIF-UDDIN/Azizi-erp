-- =========================================================================
-- SAFE COMPLETE DATA RESET SCRIPT
-- =========================================================================
-- STRICTLY PRESERVES:
--   1. Services & Service Categories
--   2. Users, Roles, Permissions, Role Permissions, Branches
--   3. System Lookups (Order Statuses, Document Types, Quotation Templates, Terms)
--
-- CLEARS:
--   All other existing operational and transaction tables dynamically!
-- =========================================================================

DO $$ 
DECLARE
    r RECORD;
    preserve_tables TEXT[] := ARRAY[
        'users',
        'roles',
        'permissions',
        'role_permissions',
        'branches',
        'services',
        'service_categories',
        'document_types',
        'order_statuses',
        'terms_conditions',
        'quotation_templates'
    ];
BEGIN
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename != ALL(preserve_tables)
    ) LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE;';
        RAISE NOTICE 'Truncated table: %', r.tablename;
    END LOOP;
END $$;


