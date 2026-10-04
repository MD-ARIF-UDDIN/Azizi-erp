import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cqpwdrokavkasmvapmsl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxcHdkcm9rYXZrYXNtdmFwbXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NDU0NjIsImV4cCI6MjEwNTMyMTQ2Mn0.EmSuoIYQNNb8RXo83quSxLY-k6TSjF0oBGsl3gbNTp8';

const supabase = createClient(supabaseUrl, supabaseKey);

const ALL_PERMISSIONS = [
  'Customer.View', 'Customer.Create', 'Customer.Update', 'Customer.Delete',
  'Sales.View', 'Sales.Create', 'Sales.Update', 'Sales.Delete',
  'Payments.View', 'Payments.Create', 'Payments.Delete',
  'Expenses.View', 'Expenses.Create', 'Expenses.Update', 'Expenses.Delete',
  'Branches.View', 'Branches.Create', 'Branches.Update', 'Branches.Delete',
  'Users.View', 'Users.Create', 'Users.Update', 'Users.Delete',
  'Roles.View', 'Roles.Update', 'Reports.View', 'Settings.Update'
];

async function seedUser() {
  const email = 'arif@gmail.com';
  const password = 'support123';
  const name = 'Arif';

  console.log(`--- Seeding Account for ${email} ---`);

  try {
    // 1. Fetch roles
    let { data: roles, error: rolesErr } = await supabase.from('roles').select('*');
    if (rolesErr) {
      console.error('Error fetching roles:', rolesErr.message);
      return;
    }

    let ownerRole = roles?.find(r => r.name?.toLowerCase() === 'owner');
    if (!ownerRole) {
      ownerRole = roles?.find(r => r.name?.toLowerCase() === 'super admin');
    }
    if (!ownerRole && roles && roles.length > 0) {
      ownerRole = roles[0];
    }
    console.log('Assigned Role:', ownerRole?.name, `(${ownerRole?.id})`);

    // 2. Fetch branch
    let { data: branches, error: branchesErr } = await supabase.from('branches').select('*');
    if (branchesErr) {
      console.error('Error fetching branches:', branchesErr.message);
      return;
    }
    const defaultBranch = branches && branches.length > 0 ? branches[0] : null;
    console.log('Assigned Branch:', defaultBranch?.name, `(${defaultBranch?.id})`);

    // 3. Check existing user in public.users
    const { data: existingUsers, error: userFetchErr } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email);

    if (userFetchErr) {
      console.error('Error querying users:', userFetchErr.message);
      return;
    }

    const userData = {
      name: name,
      email: email,
      password: password,
      phone: '+971500000001',
      role_id: ownerRole ? ownerRole.id : null,
      branch_id: defaultBranch ? defaultBranch.id : null,
      permissions: ALL_PERMISSIONS,
      status: 'Active',
      is_deleted: false,
      updated_at: new Date().toISOString()
    };

    if (existingUsers && existingUsers.length > 0) {
      const existing = existingUsers[0];
      console.log(`User ${email} exists (ID: ${existing.id}). Updating...`);
      const { data: updated, error: updateErr } = await supabase
        .from('users')
        .update(userData)
        .eq('id', existing.id)
        .select();

      if (updateErr) {
        console.error('Failed to update user:', updateErr.message);
      } else {
        console.log('✅ Successfully updated account in public.users:', updated);
      }
    } else {
      console.log(`User ${email} does not exist. Creating new user...`);
      const { data: created, error: insertErr } = await supabase
        .from('users')
        .insert([userData])
        .select();

      if (insertErr) {
        console.error('Failed to insert user:', insertErr.message);
      } else {
        console.log('✅ Successfully created account in public.users:', created);
      }
    }

    // Try signing up in Supabase Auth
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email,
        password: password
      });
      if (authErr) {
        console.log('Note on Supabase Auth SignUp:', authErr.message);
      } else {
        console.log('Supabase Auth user status:', authData.user ? 'Created/Registered' : 'Not returned');
      }
    } catch (e) {
      console.log('Auth signup note:', e.message);
    }

    console.log('-------------------------------------------');
    console.log('Login credentials:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Role: ${ownerRole?.name || 'Owner'}`);
    console.log('-------------------------------------------');
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

seedUser();
