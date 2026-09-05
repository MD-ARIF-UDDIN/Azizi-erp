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

        {/* PRINTABLE OFFICIAL RECEIPT & REFUND VOUCHER (HIDDEN ON SCREEN, POPULATED ON PRINT) */}
        {printableVoucherData && (
          <div className="hidden print:block fixed inset-0 bg-white text-black p-6 sm:p-8 font-sans text-xs print-voucher-sheet">
            <div className="max-w-3xl mx-auto border-2 border-[#000ba0] p-6 rounded-xl space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b-2 border-gray-200 pb-3">
                <div className="flex items-center gap-3">
                  <img src="/logo.png" alt="AZIZI" className="w-16 h-16 object-contain" />
                  <div>
                    <div className="text-base font-black text-[#000ba0] leading-tight" style={{ fontFamily: "'Cairo', 'Inter', sans-serif" }}>
                      مكتب عزيزي للكتابة وعمل الأختام ذ.م.م - فرع ۱
                    </div>
                    <div className="text-xs font-black text-[#f28f00] tracking-wider uppercase">
                      AZIZI TYPING &amp; STAMP MAKING BR. 1
                    </div>
                    <div className="text-[10px] text-gray-600 font-semibold mt-0.5">
                      Musaffah M37, Abu Dhabi, UAE • Tel: 0542797933 • azizitypingbr@gmail.com
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`px-3 py-1 text-white font-extrabold text-xs rounded uppercase tracking-wider ${
                    printableVoucherData.type === 'receipt' ? 'bg-[#000ba0]' : 'bg-[#be123c]'
                  }`}>
                    {printableVoucherData.type === 'receipt' ? 'RECEIPT VOUCHER' : 'REFUND VOUCHER'}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-1 font-bold">
                    No: {printableVoucherData.voucherNo || `PAY-${Date.now().toString().slice(-6)}`}
                  </div>
                </div>
              </div>

              {/* Banner / Title in Arabic & English */}
              <div className={`py-1.5 px-4 text-center font-black tracking-wide text-xs rounded text-white ${
                printableVoucherData.type === 'receipt' ? 'bg-[#000ba0]' : 'bg-[#be123c]'
              }`}>
                {printableVoucherData.type === 'receipt' 
                  ? 'OFFICIAL PAYMENT RECEIPT VOUCHER • سند قبض رسمي' 
                  : 'OFFICIAL PAYMENT RETURN & REFUND VOUCHER • سند صرف واسترجاع'}
              </div>

              {/* Voucher Main Info Grid */}
              <table className="w-full border-collapse border border-gray-300 text-xs">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="p-2 bg-gray-50 font-bold text-gray-700 w-1/4 border-r border-gray-300">
                      Date &amp; Time:
                    </td>
                    <td className="p-2 font-semibold text-black w-1/4 border-r border-gray-300">
                      {new Date(printableVoucherData.date).toLocaleString()}
                    </td>
                    <td className="p-2 bg-gray-50 font-bold text-gray-700 w-1/4 border-r border-gray-300">
                      Invoice Reference #:
                    </td>
                    <td className="p-2 font-mono font-bold text-[#000ba0] w-1/4">
                      {printableVoucherData.sale?.invoice_no || '—'}
                    </td>
                  </tr>

                  {(() => {
                    const custName = printableVoucherData.sale?.customer?.name || printableVoucherData.sale?.sale_customer_name || 'Walk-in Customer';
                    const compName = printableVoucherData.sale?.customer?.company?.name || printableVoucherData.sale?.sale_customer_company_name;
                    const rawPerson = printableVoucherData.personName?.trim();
                    const isDistinctMember = Boolean(
                      rawPerson &&
                      rawPerson !== '' &&
                      rawPerson.toLowerCase() !== custName.toLowerCase() &&
                      (!compName || rawPerson.toLowerCase() !== compName.toLowerCase())
                    );

                    return (
                      <tr className="border-b border-gray-300">
                        <td className="p-2 bg-gray-50 font-bold text-gray-700 border-r border-gray-300">
                          {printableVoucherData.type === 'receipt' ? 'Received From:' : 'Paid / Returned To:'}
                        </td>
                        <td className="p-2 font-bold text-black border-r border-gray-300" colSpan={isDistinctMember ? 1 : 3}>
                          {custName}
                          {compName && (
                            <span className="text-[11px] text-gray-600 block font-semibold">({compName})</span>
                          )}
                        </td>
                        {isDistinctMember && (
                          <>
                            <td className="p-2 bg-gray-50 font-bold text-gray-700 border-r border-gray-300">
                              For Member / Applicant:
                            </td>
                            <td className="p-2 font-bold text-black">
                              {rawPerson}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })()}

                  <tr className="border-b border-gray-300">
                    <td className="p-2 bg-gray-50 font-bold text-gray-700 border-r border-gray-300">
                      Payment Mode:
                    </td>
                    <td className="p-2 font-bold text-black border-r border-gray-300" colSpan={printableVoucherData.transactionNo ? 1 : 3}>
                      {printableVoucherData.paymentMethod || 'Cash'}
                    </td>
                    {printableVoucherData.transactionNo && (
                      <>
                        <td className="p-2 bg-gray-50 font-bold text-gray-700 border-r border-gray-300">
                          Transaction / Ref No:
                        </td>
                        <td className="p-2 font-mono font-bold text-black">
                          {printableVoucherData.transactionNo}
                        </td>
                      </>
                    )}
                  </tr>

                  <tr className="border-b border-gray-300">
                    <td className="p-2 bg-gray-50 font-bold text-gray-700 border-r border-gray-300">
                      {printableVoucherData.type === 'receipt' ? 'Payment Remarks / Purpose:' : 'Reason for Refund:'}
                    </td>
                    <td className="p-2 italic text-gray-900" colSpan={3}>
                      {printableVoucherData.reason || (printableVoucherData.type === 'receipt' ? 'Settlement of typing and government services invoice' : 'Application cancellation / fee return')}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Amount Highlight Box */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                printableVoucherData.type === 'receipt' 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
                  : 'bg-rose-50 border-rose-300 text-rose-950'
              }`}>
                <div>
                  <span className="text-[11px] uppercase font-black tracking-wider block">
                    {printableVoucherData.type === 'receipt' ? 'AMOUNT RECEIVED (المبلغ المستلم)' : 'AMOUNT REFUNDED (المبلغ المسترجع)'}
                  </span>
                  <span className="text-xs text-gray-600 font-medium italic">
                    Currency: United Arab Emirates Dirham (AED)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono tracking-tight">
                    {printableVoucherData.amount.toFixed(2)} AED
                  </span>
                </div>
              </div>

              {/* Invoice Summary Status if Available */}
              {printableVoucherData.sale && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">Invoice Grand Total</span>
                    <span className="font-mono font-bold text-gray-900">{(Number(printableVoucherData.sale.grand_total) || 0).toFixed(2)} AED</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">Status</span>
                    <span className={`font-bold uppercase text-[11px] ${
                      printableVoucherData.sale.payment_status === 'Paid' ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {printableVoucherData.sale.payment_status || 'Paid'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">Payment Channel</span>
                    <span className="font-bold text-gray-900">{printableVoucherData.paymentMethod || 'Cash'}</span>
                  </div>
                </div>
              )}

              {/* Signatures & Stamp Footer */}
              <div className="grid grid-cols-3 gap-4 pt-6 text-center text-xs">
                <div className="space-y-8">
                  <span className="font-bold text-gray-700 block">Received By (Cashier)</span>
                  <div className="border-t border-gray-400 pt-1 font-semibold text-gray-900">
                    Authorized Cashier
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center text-[9px] text-gray-400 font-bold uppercase">
                    Official Stamp
                  </div>
                </div>
                <div className="space-y-8">
                  <span className="font-bold text-gray-700 block">Customer / Payer Signature</span>
                  <div className="border-t border-gray-400 pt-1 font-semibold text-gray-900">
                    Signature &amp; Date
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <div className="border-t border-gray-200 pt-2 text-center text-[9px] text-gray-500">
                Thank you for your business. Computer generated official voucher — Azizi Typing &amp; Stamp Making Br. 1
              </div>
            </div>
          </div>
        )}

      </div>
    </PermissionGuard>
  );
};
