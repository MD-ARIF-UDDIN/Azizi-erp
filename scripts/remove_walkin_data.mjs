import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yojqvmvmkfhshsjvhmgr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvanF2bXZta2Zoc2hzanZobWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDkzMTgsImV4cCI6MjEwMTU4NTMxOH0.wtOasir2f8LZ6ge9mzSUSUw1Kvkb-x8OEXbxT8QI0z4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function removeWalkinData() {
  // 1. Find walk-in customer records
  const { data: custs } = await supabase
    .from('customers')
    .select('id, name')
    .ilike('name', '%walk%');
  
  console.log('Found walk-in customer records:', custs);
  const custIds = (custs || []).map(c => c.id);

  if (custIds.length === 0) {
    console.log('No walk-in customers found in database.');
    return;
  }

  // 2. Find sales linked to walk-in customers
  const { data: sales } = await supabase
    .from('sales')
    .select('id, invoice_no')
    .in('customer_id', custIds);
  
  console.log('Found sales for walk-in customers:', sales);
  const saleIds = (sales || []).map(s => s.id);

  // 3. Delete or soft-delete payments
  if (saleIds.length > 0) {
    const { data: deletedPayments, error: pErr } = await supabase
      .from('payments')
      .update({ is_deleted: true })
      .in('sale_id', saleIds)
      .select();
    console.log('Soft-deleted payments by sale_id:', deletedPayments?.length, pErr);

    // Also check payments by customer_id
    const { data: deletedCustPayments, error: cpErr } = await supabase
      .from('payments')
      .update({ is_deleted: true })
      .in('customer_id', custIds)
      .select();
    console.log('Soft-deleted payments by customer_id:', deletedCustPayments?.length, cpErr);

    // 4. Delete or soft-delete expenses linked to walk-in sales
    const { data: deletedExpenses, error: eErr } = await supabase
      .from('expenses')
      .update({ is_deleted: true })
      .in('sale_id', saleIds)
      .select();
    console.log('Soft-deleted expenses linked to sales:', deletedExpenses?.length, eErr);

    // 5. Delete or soft-delete journal entries linked to these sales / payments / expenses
    const invoiceNos = (sales || []).map(s => s.invoice_no).filter(Boolean);
    for (const inv of invoiceNos) {
      const { data: delJournals } = await supabase
        .from('journal_entries')
        .update({ is_deleted: true })
        .ilike('reference_no', `%${inv}%`)
        .select();
      console.log(`Soft-deleted journal entries for invoice ${inv}:`, delJournals?.length);
    }

    // 6. Delete sale items
    const { data: deletedItems, error: itErr } = await supabase
      .from('sale_items')
      .delete()
      .in('sale_id', saleIds)
      .select();
    console.log('Deleted sale_items for walk-in sales:', deletedItems?.length, itErr);

    // 7. Soft-delete the sales
    const { data: deletedSales, error: sErr } = await supabase
      .from('sales')
      .update({ is_deleted: true })
      .in('id', saleIds)
      .select();
    console.log('Soft-deleted sales:', deletedSales?.length, sErr);
  }

  // 8. Soft-delete quotations for walk-in
  const { data: deletedQuotes } = await supabase
    .from('quotations')
    .update({ is_deleted: true })
    .in('customer_id', custIds)
    .select();
  console.log('Soft-deleted quotations:', deletedQuotes?.length);

  // 9. Soft-delete the customer
  const { data: deletedCusts } = await supabase
    .from('customers')
    .update({ is_deleted: true })
    .in('id', custIds)
    .select();
  console.log('Soft-deleted customers:', deletedCusts?.length);

  console.log('All Walk-in sales, payments, items, expenses, and customer records have been successfully cleaned up!');
}

removeWalkinData();
