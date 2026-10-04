-- Seed login account: arif@gmail.com / support123
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  target_user_id UUID := '00000000-0000-0000-0000-00000000000b';
  owner_role_id UUID;
  default_branch_id UUID;
  encrypted_pw TEXT;
BEGIN
  -- Get Owner or Super Admin role
  SELECT id INTO owner_role_id FROM public.roles WHERE LOWER(name) IN ('owner', 'super admin') LIMIT 1;
  IF owner_role_id IS NULL THEN
    SELECT id INTO owner_role_id FROM public.roles LIMIT 1;
  END IF;

  -- Get default branch
  SELECT id INTO default_branch_id FROM public.branches LIMIT 1;

  -- Encrypt password
  encrypted_pw := extensions.crypt('support123', extensions.gen_salt('bf', 10));

  -- Insert/Update auth.users if auth schema exists
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = 'arif@gmail.com') THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
        confirmation_token, email_change, email_change_token_new, recovery_token
      )
      VALUES (
        '00000000-0000-0000-0000-000000000000', target_user_id, 'authenticated', 'authenticated', 
        'arif@gmail.com', encrypted_pw, now(), 
        '{"provider":"email","providers":["email"]}', '{"name":"Arif"}', 
        now(), now(), '', '', '', ''
      );
    ELSE
      UPDATE auth.users 
      SET encrypted_password = encrypted_pw, updated_at = now()
      WHERE LOWER(email) = 'arif@gmail.com';
    END IF;

    -- auth.identities
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE id = target_user_id OR user_id = target_user_id) THEN
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (target_user_id, target_user_id, jsonb_build_object('sub', target_user_id, 'email', 'arif@gmail.com'), 'email', target_user_id, null, now(), now())
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Upsert in public.users
  IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(email) = 'arif@gmail.com') THEN
    UPDATE public.users
    SET 
      name = 'Arif',
      password = 'support123',
      role_id = COALESCE(role_id, owner_role_id),
      branch_id = COALESCE(branch_id, default_branch_id),
      status = 'Active',
      is_deleted = false,
      permissions = ARRAY[
        'Customer.View', 'Customer.Create', 'Customer.Update', 'Customer.Delete',
        'Sales.View', 'Sales.Create', 'Sales.Update', 'Sales.Delete',
        'Payments.View', 'Payments.Create', 'Payments.Delete',
        'Expenses.View', 'Expenses.Create', 'Expenses.Update', 'Expenses.Delete',
        'Branches.View', 'Branches.Create', 'Branches.Update', 'Branches.Delete',
        'Users.View', 'Users.Create', 'Users.Update', 'Users.Delete',
        'Roles.View', 'Roles.Update', 'Reports.View', 'Settings.Update'
      ],
      updated_at = now()
    WHERE LOWER(email) = 'arif@gmail.com';
  ELSE
    INSERT INTO public.users (
      id, auth_user_id, name, email, password, phone, role_id, branch_id, permissions, status, is_deleted, created_at, updated_at
    )
    VALUES (
      target_user_id, target_user_id, 'Arif', 'arif@gmail.com', 'support123', '+971500000001',
      owner_role_id, default_branch_id,
      ARRAY[
        'Customer.View', 'Customer.Create', 'Customer.Update', 'Customer.Delete',
        'Sales.View', 'Sales.Create', 'Sales.Update', 'Sales.Delete',
        'Payments.View', 'Payments.Create', 'Payments.Delete',
        'Expenses.View', 'Expenses.Create', 'Expenses.Update', 'Expenses.Delete',
        'Branches.View', 'Branches.Create', 'Branches.Update', 'Branches.Delete',
        'Users.View', 'Users.Create', 'Users.Update', 'Users.Delete',
        'Roles.View', 'Roles.Update', 'Reports.View', 'Settings.Update'
      ],
      'Active', false, now(), now()
    );
  END IF;

END $$;
