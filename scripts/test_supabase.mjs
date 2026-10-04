import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cqpwdrokavkasmvapmsl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxcHdkcm9rYXZrYXNtdmFwbXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NDU0NjIsImV4cCI6MjEwNTMyMTQ2Mn0.EmSuoIYQNNb8RXo83quSxLY-k6TSjF0oBGsl3gbNTp8';

console.log('Testing connection to Supabase:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    // 1. Check roles
    const { data: roles, error: rolesErr } = await supabase.from('roles').select('*');
    if (rolesErr) {
      console.log('Roles query response:', rolesErr.message, '(Code:', rolesErr.code, ')');
    } else {
      console.log('✅ Successfully connected to Supabase! Roles found:', roles?.length);
      console.log('Roles:', roles);
    }

    // 2. Check users
    const { data: users, error: usersErr } = await supabase.from('users').select('*');
    if (usersErr) {
      console.log('Users query response:', usersErr.message);
    } else {
      console.log('Users count:', users?.length);
      console.log('Users:', users?.map(u => ({ id: u.id, email: u.email, name: u.name, role_id: u.role_id })));
    }
  } catch (err) {
    console.error('Connection exception:', err);
  }
}

testConnection();
