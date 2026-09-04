import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yojqvmvmkfhshsjvhmgr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvanF2bXZta2Zoc2hzanZobWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDkzMTgsImV4cCI6MjEwMTU4NTMxOH0.wtOasir2f8LZ6ge9mzSUSUw1Kvkb-x8OEXbxT8QI0z4';

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

async function seedOwnerAccount() {
  console.log('--- Seeding Owner Account ---');
  console.log('Target Email: developer@gmail.com');
  console.log('Target Password: password configured');

  try {
    // 1. Fetch or create Owner role
    let { data: roles, error: rolesErr } = await supabase.from('roles').select('*');
    if (rolesErr) {
      console.error('Error fetching roles:', rolesErr.message);
      return;
    }

    let ownerRole = roles?.find(r => r.name?.toLowerCase() === 'owner');
    if (!ownerRole) {
      console.log('Owner role not found, looking for Super Admin...');
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

    // 3. Check if user developer@gmail.com already exists in public.users
    const { data: existingUsers, error: userFetchErr } = await supabase
      .from('users')
      .select('*')
      .ilike('email', 'developer@gmail.com');

    if (userFetchErr) {
      console.error('Error querying users:', userFetchErr.message);
      return;
    }

    const userData = {
      name: 'Developer (Owner)',
      email: 'developer@gmail.com',
      password: '123456',
      phone: '+971500000000',
      role_id: ownerRole ? ownerRole.id : null,
      branch_id: defaultBranch ? defaultBranch.id : null,
      permissions: ALL_PERMISSIONS,
      status: 'Active',
      is_deleted: false,
      updated_at: new Date().toISOString()
    };

    if (existingUsers && existingUsers.length > 0) {
      const existing = existingUsers[0];
      console.log(`User developer@gmail.com exists (ID: ${existing.id}). Updating...`);
      const { data: updated, error: updateErr } = await supabase
        .from('users')
        .update(userData)
        .eq('id', existing.id)
        .select();

      if (updateErr) {
        console.error('Failed to update user:', updateErr.message);
      } else {
        console.log('✅ Successfully updated owner account:', updated);
      }
    } else {
      console.log('User does not exist. Creating new owner user...');
      const { data: created, error: insertErr } = await supabase
        .from('users')
        .insert([userData])
        .select();

      if (insertErr) {
        console.error('Failed to insert user:', insertErr.message);
      } else {
        console.log('✅ Successfully created owner account:', created);
      }
    }

    // Try signing up in Supabase Auth as well if email auth is enabled
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: 'developer@gmail.com',
        password: '123456'
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
    console.log('Email: developer@gmail.com');
    console.log('Password: 123456');
    console.log('-------------------------------------------');
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

seedOwnerAccount();
