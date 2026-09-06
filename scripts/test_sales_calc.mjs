import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yojqvmvmkfhshsjvhmgr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvanF2bXZta2Zoc2hzanZobWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDkzMTgsImV4cCI6MjEwMTU4NTMxOH0.wtOasir2f8LZ6ge9mzSUSUw1Kvkb-x8OEXbxT8QI0z4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSalesGetAll() {
  const { data: sales, error } = await supabase.from('sales').select('*, customer:customers(*), branch:branches(*), employee:users!employee_id(*), order_status:order_statuses(*)').eq('is_deleted', false).order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching sales:', error);
    return;
  }

  const saleIds = sales.map(s => s.id);
  const [{ data: allItems }, { data: allPayments }, { data: allExpenses }, { data: allUsers }] = await Promise.all([
    supabase.from('sale_items').select('*, service:services(*)').in('sale_id', saleIds),
    supabase.from('payments').select('*').in('sale_id', saleIds).or('is_deleted.is.null,is_deleted.eq.false'),
    supabase.from('expenses').select('*').in('sale_id', saleIds).eq('is_deleted', false),
    supabase.from('users').select('id, name')
  ]);

  const userMap = new Map((allUsers || []).map(u => [u.id, u]));

  const itemsBySale = new Map();
  (allItems || []).forEach(item => {
    if (!itemsBySale.has(item.sale_id)) itemsBySale.set(item.sale_id, []);
    itemsBySale.get(item.sale_id).push({
      ...item,
      staff: item.staff_id ? userMap.get(item.staff_id) : undefined
    });
  });

  const expensesBySale = new Map();
  (allExpenses || []).forEach(exp => {
    if (!expensesBySale.has(exp.sale_id)) expensesBySale.set(exp.sale_id, []);
    expensesBySale.get(exp.sale_id).push(exp);
  });

  const paymentsBySale = new Map();
  (allPayments || []).forEach(p => {
    if (!paymentsBySale.has(p.sale_id)) paymentsBySale.set(p.sale_id, []);
    paymentsBySale.get(p.sale_id).push(p);
  });

  const result = sales.map(s => {
    const saleItemsList = itemsBySale.get(s.id) || [];
    const saleExps = expensesBySale.get(s.id) || [];
    
    const enrichedItems = saleItemsList.map(it => {
      const matchedExps = saleExps.filter(e => e.sale_item_id === it.id || (e.description && e.description.includes(it.id)));
      const loggedExpAmount = matchedExps.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const directExp = Number(it.expense || 0);
      const srvCost = (Number(it.service?.expense) || 0) * (Number(it.quantity) || 1);
      const finalExp = loggedExpAmount > 0 ? loggedExpAmount : (directExp > 0 ? directExp : srvCost);
      return {
        ...it,
        expense: finalExp,
        expenses: matchedExps
      };
    });

    return {
      ...s,
      items: enrichedItems,
      payments: paymentsBySale.get(s.id) || [],
      expenses: saleExps
    };
  });

  for (const s of result) {
    const saleCost = (s.items || []).reduce((sum, it) => sum + Number(it.expense || 0), 0);
    const profit = Number(s.grand_total || 0) - saleCost;
    console.log(`Sale: ${s.invoice_no} | Grand Total: ${s.grand_total} AED | Govt Service Charge: ${saleCost} AED | Profit: ${profit} AED`);
    for (const it of s.items) {
      console.log(`   - ${it.service?.name}: price=${it.unit_price}, exp=${it.expense}, staff=${it.staff?.name}`);
    }
  }
}

testSalesGetAll().catch(console.error);
