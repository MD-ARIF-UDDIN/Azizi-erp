import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yojqvmvmkfhshsjvhmgr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvanF2bXZta2Zoc2hzanZobWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDkzMTgsImV4cCI6MjEwMTU4NTMxOH0.wtOasir2f8LZ6ge9mzSUSUw1Kvkb-x8OEXbxT8QI0z4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function backfill() {
  // 1. Ensure "Government Fees & Service Costs" category exists
  let { data: catList } = await supabase
    .from('expense_categories')
    .select('*')
    .ilike('name', '%Government%')
    .eq('is_deleted', false);

  let govCatId = catList?.[0]?.id;
  if (!govCatId) {
    const { data: newCat, error: catErr } = await supabase
      .from('expense_categories')
      .insert([{
        name: 'Government Fees & Service Costs',
        description: 'Direct government typing fees, portal charges, and service fulfillment costs.',
        is_deleted: false
      }])
      .select()
      .single();
    if (catErr) {
      console.error('Error creating expense category:', catErr);
      return;
    }
    govCatId = newCat.id;
    console.log('Created Government Fees category:', govCatId);
  } else {
    console.log('Found existing Government Fees category:', govCatId);
  }

  // 2. Get card account for government fees
  const { data: accounts } = await supabase.from('accounts').select('*').eq('is_deleted', false);
  const cardAccount = accounts?.find(a => a.type === 'bank' || a.name.toLowerCase().includes('card')) || accounts?.[0];
  console.log('Card Account for Fees:', cardAccount?.name, cardAccount?.id);

  // 3. Fetch all sale items with service and sale info
  const { data: saleItems, error: itemsErr } = await supabase
    .from('sale_items')
    .select('*, service:services(*), sale:sales(*)');

  if (itemsErr) {
    console.error('Error fetching sale items:', itemsErr);
    return;
  }

  // 4. Fetch existing expenses
  const { data: existingExpenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('is_deleted', false);

  console.log(`\nChecking ${saleItems?.length || 0} sale items...`);

  for (const item of (saleItems || [])) {
    const srvExpense = Number(item.service?.expense) || 0;
    if (srvExpense <= 0) {
      console.log(`Skipping item ${item.id} (${item.service?.name}) - cost is 0`);
      continue;
    }

    const totalExpenseAmount = srvExpense * (Number(item.quantity) || 1);
    const sale = item.sale;
    if (!sale) {
      console.log(`Skipping item ${item.id} - no sale linked`);
      continue;
    }

    // Check if expense already exists for this item or sale
    const alreadyExists = (existingExpenses || []).some(e => 
      e.sale_item_id === item.id || 
      e.id === item.expense_id || 
      (e.sale_id === sale.id && e.description?.includes(item.id))
    );

    if (alreadyExists) {
      console.log(`Expense already exists for item ${item.id} (#${sale.invoice_no})`);
      continue;
    }

    console.log(`Creating expense for item ${item.id}: ${item.service?.name} (#${sale.invoice_no}) - ${totalExpenseAmount} AED`);

    const expDate = item.service_date || sale.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];
    const personName = item.person_name || sale.person_name;
    const desc = `[Item: ${item.id}] ${item.service?.name} Gov Fee (#${sale.invoice_no}${personName ? ` - ${personName}` : ''})`;

    const { data: newExp, error: expErr } = await supabase
      .from('expenses')
      .insert([{
        category_id: govCatId,
        branch_id: sale.branch_id,
        amount: totalExpenseAmount,
        expense_date: expDate,
        description: desc,
        paid_to: 'Government Portal',
        payment_method: 'Card',
        sale_id: sale.id,
        sale_item_id: item.id,
        account_id: cardAccount?.id || null,
        is_deleted: false
      }])
      .select()
      .single();

    if (expErr) {
      console.error(`Failed to insert expense for item ${item.id}:`, expErr);
      continue;
    }

    console.log(`Created expense ${newExp.id}. Updating sale_item...`);

    const { error: updateErr } = await supabase
      .from('sale_items')
      .update({
        expense: totalExpenseAmount,
        expense_id: newExp.id,
        account_id: cardAccount?.id || null
      })
      .eq('id', item.id);

    if (updateErr) {
      console.error(`Failed to update sale_item ${item.id}:`, updateErr);
    } else {
      console.log(`Updated sale_item ${item.id} with expense ${totalExpenseAmount} AED`);
    }
  }

  console.log('\n--- Final Expenses in Supabase ---');
  const { data: allFinalExpenses } = await supabase
    .from('expenses')
    .select('*, sale:sales(invoice_no, person_name), category:expense_categories(name)')
    .eq('is_deleted', false);
  console.log(JSON.stringify(allFinalExpenses, null, 2));
}

backfill().catch(console.error);
