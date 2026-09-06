import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yojqvmvmkfhshsjvhmgr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvanF2bXZta2Zoc2hzanZobWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDkzMTgsImV4cCI6MjEwMTU4NTMxOH0.wtOasir2f8LZ6ge9mzSUSUw1Kvkb-x8OEXbxT8QI0z4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function syncExpenseJournal() {
  const { data: expenses } = await supabase.from('expenses').select('*, sale:sales(id, invoice_no, person_name)').eq('is_deleted', false);
  const { data: journals } = await supabase.from('journal_entries').select('*');
  const { data: accounts } = await supabase.from('accounts').select('*');

  const existingExpenseJournalIds = new Set((journals || []).map(j => j.expense_id).filter(Boolean));

  console.log(`Found ${expenses?.length || 0} expenses, ${journals?.length || 0} journals.`);

  for (const exp of (expenses || [])) {
    if (existingExpenseJournalIds.has(exp.id)) {
      console.log(`Expense ${exp.id} already has journal entry.`);
      continue;
    }

    const acc = accounts?.find(a => a.id === exp.account_id) || accounts?.find(a => a.type === 'bank') || accounts?.[0];
    const rawInv = exp.sale?.invoice_no || exp.description?.match(/#(INV-[A-Za-z0-9-]+)/)?.[0];
    const cleanInv = rawInv ? (rawInv.startsWith('#') ? rawInv : `#${rawInv}`) : null;
    const beneficiary = exp.paid_to || 'Government Portal';
    const fromAccountName = acc ? acc.name : (exp.payment_method ? `${exp.payment_method} Account` : 'Corporate Card Account');

    console.log(`Creating cash_out journal for expense ${exp.id} (${cleanInv || 'General'}) - ${exp.amount} AED`);

    const { error: jErr } = await supabase.from('journal_entries').insert([{
      entry_date: exp.expense_date ? new Date(exp.expense_date).toISOString() : new Date().toISOString(),
      entry_type: 'cash_out',
      from_account: fromAccountName,
      to_account: beneficiary,
      from_account_id: acc?.id || null,
      amount: exp.amount,
      sale_id: exp.sale_id || null,
      expense_id: exp.id,
      reference_no: cleanInv,
      description: exp.description || `Expense paid to ${beneficiary} for ${cleanInv || 'General'}`,
      performed_by: exp.created_by || null,
      created_by: exp.created_by || null
    }]);

    if (jErr) {
      console.error(`Failed to insert journal for expense ${exp.id}:`, jErr);
    } else {
      console.log(`Successfully created journal entry for expense ${exp.id}`);
    }
  }

  const { data: finalJournals } = await supabase.from('journal_entries').select('*').order('entry_date', { ascending: false });
  console.log('\n--- Final Journal Entries ---');
  console.log(JSON.stringify(finalJournals, null, 2));
}

syncExpenseJournal().catch(console.error);
