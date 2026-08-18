-- Seed data for Azizi Typing & Printing ERP Supabase tables
-- Execute this script right after schema.sql

-- 1. Branches Seed
INSERT INTO public.branches (id, name, address, phone, email) VALUES
('b1111111-1111-1111-1111-111111111111', 'Central Dhaka Branch', 'Motijheel C/A, Dhaka', '+8801711223344', 'dhaka@azizi.com'),
('b2222222-2222-2222-2222-222222222222', 'Chittagong GEC Branch', 'GEC Circle, Chittagong', '+8801811223344', 'ctg@azizi.com')
ON CONFLICT (id) DO NOTHING;

-- 2. Roles Seed
INSERT INTO public.roles (id, name, description) VALUES
('00000000-0000-0000-0000-000000000000', 'Owner', 'Business owner with complete multi-branch management and financial clearance.'),
('11111111-1111-1111-1111-111111111111', 'Super Admin', 'Complete system access, multi-branch overview.'),
('22222222-2222-2222-2222-222222222222', 'Branch Manager', 'Manage branch-specific sales, customers, and employees.'),
('33333333-3333-3333-3333-333333333333', 'Cashier', 'Create sales invoice, receive payments, view customer ledger.'),
('44444444-4444-4444-4444-444444444444', 'Production Exec', 'Update status of orders (Typing, Stamp making, Printing).')
ON CONFLICT (id) DO NOTHING;

-- 3. System Order Statuses Seed
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
ON CONFLICT (id) DO NOTHING;

-- 4. Permissions Seed
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
ON CONFLICT (id) DO NOTHING;

-- 5. Role Permissions Mapping Seed
-- Owner and Admin get all
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000000', id FROM public.permissions ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '11111111-1111-1111-1111-111111111111', id FROM public.permissions ON CONFLICT DO NOTHING;

-- Manager mappings
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '22222222-2222-2222-2222-222222222222', id FROM public.permissions 
WHERE name IN ('Customer.View', 'Customer.Create', 'Customer.Update', 'Sales.View', 'Sales.Create', 'Sales.Update', 'Payments.View', 'Payments.Create', 'Expenses.View', 'Expenses.Create', 'Expenses.Update', 'Branches.View', 'Users.View', 'Users.Create', 'Users.Update', 'Reports.View') ON CONFLICT DO NOTHING;

-- Cashier mappings
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '33333333-3333-3333-3333-333333333333', id FROM public.permissions 
WHERE name IN ('Customer.View', 'Customer.Create', 'Customer.Update', 'Sales.View', 'Sales.Create', 'Payments.View', 'Payments.Create', 'Reports.View') ON CONFLICT DO NOTHING;

-- Production Exec mappings
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '44444444-4444-4444-4444-444444444444', id FROM public.permissions 
WHERE name IN ('Sales.View', 'Sales.Update') ON CONFLICT DO NOTHING;

-- 6. Employees Users Seed
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  owner_id UUID := '00000000-0000-0000-0000-00000000000a';
  encrypted_pw TEXT;
BEGIN
  -- Generate bcrypt hash for password '123456'
  encrypted_pw := extensions.crypt('123456', extensions.gen_salt('bf', 10));

  -- Insert Owner into auth.users if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = owner_id) THEN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', owner_id, 'authenticated', 'authenticated', 'admin@gmail.com', encrypted_pw, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  END IF;

  -- Insert Owner into auth.identities if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE id = owner_id OR user_id = owner_id) THEN
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (owner_id, owner_id, jsonb_build_object('sub', owner_id, 'email', 'admin@gmail.com'), 'email', owner_id, null, now(), now());
  END IF;

  -- Insert Owner Profile into public.users
  INSERT INTO public.users (id, auth_user_id, name, email, phone, role_id, branch_id, permissions, status)
  VALUES (owner_id, owner_id, 'Owner admin', 'admin@gmail.com', '+8801700000000', '00000000-0000-0000-0000-000000000000', 'b1111111-1111-1111-1111-111111111111', ARRAY['Customer.View', 'Customer.Create', 'Customer.Update', 'Customer.Delete', 'Sales.View', 'Sales.Create', 'Sales.Update', 'Sales.Delete', 'Payments.View', 'Payments.Create', 'Payments.Delete', 'Expenses.View', 'Expenses.Create', 'Expenses.Update', 'Expenses.Delete', 'Branches.View', 'Branches.Create', 'Branches.Update', 'Branches.Delete', 'Users.View', 'Users.Create', 'Users.Update', 'Users.Delete', 'Roles.View', 'Roles.Update', 'Reports.View', 'Settings.Update'], 'Active')
  ON CONFLICT (id) DO NOTHING;

END $$;

-- 7. Service Categories Seed
INSERT INTO public.service_categories (id, name, description) VALUES
('c1111111-1111-1111-1111-111111111111', 'Visa Services', 'Employment visa, family visa, visit visa renewals and applications.'),
('c2222222-2222-2222-2222-222222222222', 'Emirates ID', 'New Emirates ID registration and renewals.'),
('c3333333-3333-3333-3333-333333333333', 'MOHRE Services', 'Work permit composing and submissions.'),
('c4444444-4444-4444-4444-444444444444', 'MOFA Attestation', 'MOFA degree, marriage, and birth certificate attestation.'),
('c5555555-5555-5555-5555-555555555555', 'Business Services', 'Trade license renewals, corporate setups.'),
('c6666666-6666-6666-6666-666666666666', 'Printing & Stamp Making', 'Company stamp design, photocopying, and color printing.')
ON CONFLICT (id) DO NOTHING;

-- 8. Services Seed
INSERT INTO public.services (id, category_id, name, description, price, status) VALUES
('d1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'New Employment Visa', 'Full process for new employee entry visa composing.', 1500.00, 'Active'),
('d1111111-1111-1111-1111-111111111112', 'c1111111-1111-1111-1111-111111111111', 'Visa Renewal', 'Employment or residence visa renewal composing.', 1200.00, 'Active'),
('d1111111-1111-1111-1111-111111111113', 'c1111111-1111-1111-1111-111111111111', 'Family Visa', 'Sponsoring family members residence visas.', 2000.00, 'Active'),
('d1111111-1111-1111-1111-111111111114', 'c1111111-1111-1111-1111-111111111111', 'Visit Visa', 'Tourist or leisure visit visa applications.', 800.00, 'Active'),
('d2222222-2222-2222-2222-222222222221', 'c2222222-2222-2222-2222-222222222222', 'New Emirates ID', 'Biometrics scheduling and new ID registration.', 250.00, 'Active'),
('d2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'Emirates ID Renewal', 'Form typing for Emirates ID renewal.', 250.00, 'Active'),
('d3333333-3333-3333-3333-333333333331', 'c3333333-3333-3333-3333-333333333333', 'Work Permit', 'MOHRE work contract draft and permit composing.', 600.00, 'Active'),
('d4444444-4444-4444-4444-444444444441', 'c4444444-4444-4444-4444-444444444444', 'MOFA Attestation', 'Attesting legal documents from Ministry of Foreign Affairs.', 150.00, 'Active'),
('d5555555-5555-5555-5555-555555555551', 'c5555555-5555-5555-5555-555555555555', 'Trade License', 'DED trade license renewal and corporate forms typing.', 3000.00, 'Active'),
('d6666666-6666-6666-6666-666666666661', 'c6666666-6666-6666-6666-666666666666', 'Company Stamp', 'Custom-designed self-ink or rubber official company stamp.', 120.00, 'Active')
ON CONFLICT (id) DO NOTHING;

-- 9. Expense Categories Seed
INSERT INTO public.expense_categories (id, name, description) VALUES
('e1111111-1111-1111-1111-111111111111', 'Shop Rent', 'Monthly lease rental fee.'),
('e2222222-2222-2222-2222-222222222222', 'Utility Electricity', 'Electric bills and gas supplies.'),
('e3333333-3333-3333-3333-333333333333', 'Paper & Stationery', 'Purchases of A4 paper rims, cardboards, rubber materials.'),
('e4444444-4444-4444-4444-444444444444', 'Printer Toner / Ink Refill', 'Printer cartridge refills and laser toners.'),
('e5555555-5555-5555-5555-555555555555', 'Staff Salaries', 'Wages for typists and stamp designers.')
ON CONFLICT (id) DO NOTHING;
