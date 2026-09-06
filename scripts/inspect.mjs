import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yojqvmvmkfhshsjvhmgr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvanF2bXZta2Zoc2hzanZobWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDkzMTgsImV4cCI6MjEwMTU4NTMxOH0.wtOasir2f8LZ6ge9mzSUSUw1Kvkb-x8OEXbxT8QI0z4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('--- Expense Categories ---');
  const { data: expCats } = await supabase.from('expense_categories').select('*');
  console.log(expCats);

  console.log('\n--- Accounts ---');
  const { data: accounts } = await supabase.from('accounts').select('*');
  console.log(accounts);

  console.log('\n--- Current Expenses ---');
  const { data: expenses } = await supabase.from('expenses').select('*');
  console.log(expenses);

  console.log('\n--- Sale Items with Service and Sale info ---');
  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('*, service:services(*), sale:sales(id, invoice_no, person_name, customer_id, branch_id, created_at)');
  console.log(JSON.stringify(saleItems, null, 2));
}

main().catch(console.error);
