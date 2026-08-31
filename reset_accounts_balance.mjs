import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yojqvmvmkfhshsjvhmgr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvanF2bXZta2Zoc2hzanZobWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDkzMTgsImV4cCI6MjEwMTU4NTMxOH0.wtOasir2f8LZ6ge9mzSUSUw1Kvkb-x8OEXbxT8QI0z4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetAccounts() {
  console.log('Resetting all accounts balance to 0 in Supabase...');
  try {
    const { data: accounts, error: fetchErr } = await supabase.from('accounts').select('*');
    if (fetchErr) {
      console.log('Fetch accounts error (table might not exist in Supabase):', fetchErr.message);
    } else {
      console.log(`Found ${accounts?.length || 0} accounts in Supabase:`, accounts.map(a => `${a.name}: ${a.balance}`));
      for (const a of accounts) {
        const { error: updateErr } = await supabase
          .from('accounts')
          .update({ balance: 0 })
          .eq('id', a.id);
        if (updateErr) {
          console.error(`Update error for ${a.name}:`, updateErr.message);
        } else {
          console.log(`Reset ${a.name} to 0`);
        }
      }
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

resetAccounts();
