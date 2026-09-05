import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { exportPayments } from '../../lib/excelExport';
import { ReceiptVoucherPrint } from '../../components/ReceiptVoucherPrint';
import {
  DollarSign,
  Search,
  Calendar,
  Wallet,
  Building,
  User,
  Receipt,
  Plus,
  Download,
  Printer
} from 'lucide-react';

export const PaymentList: React.FC = () => {
  const { activeBranchId } = useAuth();
  const navigate = useNavigate();
  
  // Data States
  const [payments, setPayments] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [printableVoucherData, setPrintableVoucherData] = useState<any | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const [allPayments, allAccounts] = await Promise.all([
        db.payments.getAll(activeBranchId),
        db.accounts.getAll()
      ]);
      setAccounts(allAccounts);
      setPayments(allPayments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [activeBranchId]);

  const handlePrintVoucher = async (p: any) => {
    const isRef = p.is_refund || p.amount < 0 || p.notes?.includes('[Refund]');
    const targetAccount = accounts.find(a => a.id === p.account_id);
    const amountVal = Math.abs(Number(p.amount) || 0);
    const reasonText = p.refund_reason || (p.notes ? p.notes.replace(/\[Member:\s*[^\]]+\]/g, '').replace(/\[Refund\]\s*/, '').trim() : '');
    const cleanNotes = p.notes ? p.notes.replace(/\[Member:\s*[^\]]+\]/g, '').replace(/\[Refund\]\s*/, '').trim() : '';

    let saleDetail = null;
    if (p.sale_id) {
      try {
        saleDetail = await db.sales.getById(p.sale_id);
      } catch (err) {
        console.warn('Could not fetch full sale details for print voucher:', err);
      }
    }

    const payCode = p.id ? p.id.slice(0, 8).toUpperCase() : (p.created_at ? new Date(p.created_at).getTime().toString().slice(-6) : Date.now().toString().slice(-6));
    const voucherNumber = isRef ? `REF-${payCode}` : `PAY-${payCode}`;

    setPrintableVoucherData({
      type: isRef ? 'refund' : 'receipt',
      voucherNo: voucherNumber,
      date: p.payment_date || p.created_at || new Date().toISOString(),
      amount: amountVal,
      paymentMethod: p.payment_method || 'Cash',
      personName: p.person_name || saleDetail?.person_name || undefined,
      reason: isRef ? (reasonText || 'Customer Refund / Return') : (cleanNotes || `Payment collected against invoice #${p.sale_invoice || saleDetail?.invoice_no || ''}`),
      account: targetAccount,
      sale: saleDetail || {
        invoice_no: p.sale_invoice,
        customer: { name: p.sale_customer_name },
        grand_total: saleDetail?.grand_total || amountVal,
        payment_status: 'Paid'
      },
      transactionNo: p.transaction_no || undefined
    });

    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Filter logic
  const filteredPayments = payments.filter(p => {
    const matchesBranch = activeBranchId === 'all' ? true : p.sale_branch_id === activeBranchId;
    const matchesSearch =
      p.sale_invoice.toLowerCase().includes(search.toLowerCase()) ||
      p.sale_customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.person_name && p.person_name.toLowerCase().includes(search.toLowerCase())) ||
      (p.transaction_no && p.transaction_no.includes(search)) ||
      (p.id && p.id.toLowerCase().includes(search.toLowerCase()));
      
    const matchesMethod = methodFilter ? p.payment_method === methodFilter : true;

    return matchesBranch && matchesSearch && matchesMethod;
  });

  // Aggregates
  const totalCollected = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <PermissionGuard permission="Payments.View" fallback="ui">
      <div className={`space-y-6 ${printableVoucherData ? 'print:hidden' : ''}`}>
        
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
              placeholder="Search by invoice number, transaction reference, customer, member name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-xs flex-1 sm:flex-none font-semibold text-foreground cursor-pointer"
            >
              <option value="">All Payment Methods</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Mobile Banking">Mobile Banking</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>

            <button
              onClick={() => exportPayments(filteredPayments)}
              className="flex items-center gap-1.5 border border-border text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <Download size={14} />
              Export Excel
            </button>
          </div>
        </div>

        {/* DATA TABLE */}
        {loading ? (
          <div className="table-container p-12 text-center bg-card border border-border rounded-xl">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold tracking-wider uppercase text-primary animate-pulse">Loading...</span>
              <p className="text-[11px] text-muted-foreground font-medium">Please wait while payments ledger is being loaded...</p>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th className="text-center" style={{ width: '45px' }}>SL</th>
                    <th>Receipt No / Date</th>
                    <th>Invoice Reference</th>
                    <th>Customer &amp; Member</th>
                    <th>Method &amp; Account</th>
                    <th>Note / Remarks</th>
                    <th>Received By</th>
                    <th className="text-right">Amount Collected</th>
                    <th className="text-center" style={{ width: '90px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        <div className="max-w-xs mx-auto space-y-1">
                          <div className="font-bold text-black text-sm font-heading">No payment records found</div>
                          <div className="text-xs text-slate-500">No financial receipts matching search parameters were found.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p, idx) => {
                      const isRef = p.is_refund || p.amount < 0 || p.notes?.includes('[Refund]');
                      const payCode = p.id ? p.id.slice(0, 8).toUpperCase() : (p.created_at ? new Date(p.created_at).getTime().toString().slice(-6) : `PAY-${idx + 1}`);
                      return (
                        <tr key={p.id || idx} className={isRef ? 'bg-rose-50/30' : ''}>
                          <td className="text-center font-semibold text-xs text-slate-500">
                            {idx + 1}
                          </td>
                          <td>
                            <div className={`font-mono text-[10px] font-bold ${isRef ? 'text-rose-700' : 'text-primary'}`}>
                              {isRef ? `REF-${payCode}` : `PAY-${payCode}`}
                            </div>
                            <div className="text-black font-medium flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                              <Calendar size={11} className="text-muted-foreground" />
                              {p.payment_date || p.created_at ? new Date(p.payment_date || p.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
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
                            {p.person_name && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                                  👤 For: {p.person_name}
                                </span>
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center gap-1 text-black font-semibold text-xs">
                              <Wallet size={12} className="text-primary" />
                              {isRef ? '↩ Refund' : p.payment_method}
                            </div>
                            {(() => {
                              const acc = accounts.find(a => a.id === p.account_id);
                              if (!acc) return null;
                              return (
                                <div className="text-[10px] font-bold text-primary flex items-center gap-1 mt-0.5">
                                  <span>{acc.type === 'cash_drawer' ? '💵' : acc.type === 'bank' ? '🏦' : '💳'} {acc.name}</span>
                                </div>
                              );
                            })()}
                            {p.transaction_no && (
                              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                Ref: {p.transaction_no}
                              </div>
                            )}
                          </td>
                          <td>
                            {p.refund_reason || p.notes ? (
                              <div className="text-xs text-foreground font-medium max-w-[180px] truncate" title={p.refund_reason || p.notes}>
                                {p.refund_reason || p.notes.replace(/\[Member:\s*[^\]]+\]/g, '').replace(/\[Refund\]\s*/, '').trim() || '—'}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">—</span>
                            )}
                          </td>
                          <td className="text-slate-600 text-xs font-medium">
                            <span className="flex items-center gap-1">
                              <User size={12} />
                              {p.received_by_name || 'Staff'}
                            </span>
                          </td>
                          <td className={`text-right font-black text-sm font-heading ${isRef ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {isRef ? `-${Math.abs(p.amount).toFixed(2)}` : `+${p.amount.toFixed(2)}`} AED
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              onClick={() => handlePrintVoucher(p)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold transition-all border shadow-sm cursor-pointer ${
                                isRef
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 hover:border-rose-300'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 hover:border-emerald-300'
                              }`}
                              title={isRef ? 'Print Refund Voucher' : 'Print Receipt Voucher'}
                            >
                              <Printer size={11} />
                              <span>{isRef ? 'Voucher' : 'Receipt'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PRINTABLE OFFICIAL RECEIPT & REFUND VOUCHER */}
        <ReceiptVoucherPrint data={printableVoucherData} />

      </div>
    </PermissionGuard>
  );
};
