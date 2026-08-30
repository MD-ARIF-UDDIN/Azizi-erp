import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { exportPayments } from '../../lib/excelExport';
import {
  DollarSign,
  Search,
  Calendar,
  Wallet,
  Building,
  User,
  Receipt,
  Plus,
  Download
} from 'lucide-react';

export const PaymentList: React.FC = () => {
  const { activeBranchId } = useAuth();
  const navigate = useNavigate();
  
  // Data States
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      // In local storage, we resolve relations manually or use db services
      // Fetching all sales first to filter payments by branch if needed
      const allSales = await db.sales.getAll();
      const allUsers = await db.users.getAll();
      
      // Let's resolve payments
      const resolved: any[] = [];
      for (const sale of allSales) {
        const salePayments = await db.payments.getBySaleId(sale.id);
        salePayments.forEach(p => {
          resolved.push({
            ...p,
            sale_invoice: sale.invoice_no,
            sale_branch_id: sale.branch_id,
            sale_branch_name: sale.branch?.name || 'Central Branch',
            sale_customer_name: sale.customer 
              ? sale.person_name
                ? `${sale.person_name} (${sale.customer.name})`
                : sale.customer.company?.name
                ? `${sale.customer.name} (${sale.customer.company.name})`
                : sale.customer.name
              : 'Walk-in Customer',
            received_by_name: allUsers.find(u => u.id === p.received_by)?.name || 'Cashier'
          });
        });
      }

      // Sort by date desc
      resolved.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
      
      setPayments(resolved);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [activeBranchId]);

  // Filter logic
  const filteredPayments = payments.filter(p => {
    const matchesBranch = activeBranchId === 'all' ? true : p.sale_branch_id === activeBranchId;
    const matchesSearch =
      p.sale_invoice.toLowerCase().includes(search.toLowerCase()) ||
      p.sale_customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.transaction_no && p.transaction_no.includes(search));
      
    const matchesMethod = methodFilter ? p.payment_method === methodFilter : true;

    return matchesBranch && matchesSearch && matchesMethod;
  });

  // Aggregates
  const totalCollected = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <PermissionGuard permission="Payments.View" fallback="ui">
      <div className="space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Payments</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">List</h1>
          </div>
          <button
            onClick={() => navigate('/payments/create')}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-md transition-all self-start sm:self-auto"
          >
            <Plus size={14} />
            Record Payment
          </button>
        </div>

        {/* METRICS HEADER CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass border border-border p-5 rounded-2xl flex items-center gap-4 shadow-md">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign size={20} />
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-semibold uppercase">Total Revenue Collected</span>
              <h3 className="text-lg font-bold text-foreground mt-0.5">{totalCollected.toFixed(2)} AED</h3>
            </div>
          </div>
          <div className="glass border border-border p-5 rounded-2xl flex items-center gap-4 shadow-md">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Receipt size={20} />
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-semibold uppercase">Transaction Ledger Entries</span>
              <h3 className="text-lg font-bold text-foreground mt-0.5">{filteredPayments.length} Receipts</h3>
            </div>
          </div>
          <div className="glass border border-border p-5 rounded-2xl flex items-center gap-4 shadow-md">
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
              <Wallet size={20} />
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-semibold uppercase">Active Register View</span>
              <h3 className="text-sm font-semibold text-foreground mt-0.5">
                {activeBranchId === 'all' ? 'Consolidated All Branches' : 'Filtered Branch'}
              </h3>
            </div>
          </div>
        </div>

        {/* TOOLBAR FILTER */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search by invoice number, transaction reference, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-2 bg-popover border border-border rounded-lg text-xs text-foreground w-full sm:w-auto"
            >
              <option value="">All Payment Modes</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Mobile Banking">Mobile Banking (bKash/Nagad)</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>

            <button
              onClick={() => exportPayments(filteredPayments)}
              className="flex items-center gap-1.5 border border-border text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap w-full sm:w-auto justify-center"
            >
              <Download size={14} />
              Export Excel
            </button>
          </div>
        </div>

        {/* DATA TABLE */}
        {loading && payments.length === 0 ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-10 bg-muted/30 rounded-md" />
            <div className="h-28 bg-muted/30 rounded-md" />
          </div>
        ) : (
          <div className="table-container">
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th className="text-center" style={{ width: '45px' }}>SL</th>
                    <th>Transaction Date</th>
                    <th>Invoice Reference</th>
                    <th>Customer Details</th>
                    <th>Method & Reference</th>
                    <th>Received By</th>
                    <th className="text-right">Amount Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <div className="max-w-xs mx-auto space-y-1">
                          <div className="font-bold text-black text-sm font-heading">No payment records found</div>
                          <div className="text-xs text-slate-500">No financial receipts matching search parameters were found.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p, idx) => (
                      <tr key={p.id}>
                        <td className="text-center font-semibold text-xs text-slate-500">
                          {idx + 1}
                        </td>
                        <td>
                          <div className="text-black font-semibold flex items-center gap-1.5 text-xs">
                            <Calendar size={13} className="text-primary" />
                            {new Date(p.payment_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        </td>
                        <td>
                          <div className="font-bold text-black text-xs leading-tight">#{p.sale_invoice}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                            <Building size={10} /> {p.sale_branch_name}
                          </div>
                        </td>
                        <td>
                          <div className="font-bold text-black text-xs leading-tight">
                            {p.sale_customer_name}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1 text-black font-semibold text-xs">
                            <Wallet size={12} className="text-primary" />
                            {p.payment_method}
                          </div>
                          {p.transaction_no && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Ref: {p.transaction_no}
                            </div>
                          )}
                        </td>
                        <td className="text-slate-600 text-xs font-medium">
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            {p.received_by_name}
                          </span>
                        </td>
                        <td className="text-right font-black text-emerald-700 text-sm font-heading">
                          +{p.amount.toFixed(2)} AED
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </PermissionGuard>
  );
};
