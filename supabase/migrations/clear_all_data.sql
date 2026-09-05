-- =========================================================================
-- COMPLETE WIPE SCRIPT: Truncate ALL tables
-- STRICTLY PRESERVES ONLY:
--   1. Users (plus Roles, Permissions, Role Permissions, Branches)
--   2. Services (plus Service Categories)
--   3. Document Types
-- =========================================================================

-- Dynamic truncation of all tables except the preserved list
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
        'document_types'
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
