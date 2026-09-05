import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { Account } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, CreditCard, DollarSign, FileText, Receipt, Save, Wallet } from 'lucide-react';

export const PaymentForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const saleIdParam = searchParams.get('sale_id');

  // Master Data
  const [unpaidSales, setUnpaidSales] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Form States
  const [saleId, setSaleId] = useState(saleIdParam || '');
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Bank Transfer' | 'Mobile Banking'>('Cash');
  const [accountId, setAccountId] = useState('');
  const [transactionNo, setTransactionNo] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setFetching(true);
      try {
        const [allSales, allAccounts] = await Promise.all([
          db.sales.getAll(),
          db.accounts.getAll()
        ]);
        // Filter sales that are Unpaid or Partially Paid
        const unpaid = allSales.filter(s => s.payment_status !== 'Paid');
        setUnpaidSales(unpaid);
        setAccounts(allAccounts);

        const drawer = allAccounts.find(a => a.type === 'cash_drawer') || allAccounts[0];
        if (drawer) setAccountId(drawer.id);

        const initialId = saleIdParam || saleId;
        if (initialId) {
          const target = allSales.find(s => s.id === initialId);
          if (target) {
            const totalPaid = (target.payments || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
            const remaining = Math.max(0, (Number(target.grand_total) || 0) - totalPaid);
            setSelectedSale({ ...target, remaining, totalPaid });
            setSaleId(target.id);
            setAmount(remaining);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    };
    loadData();
  }, [saleIdParam]);

  const handleSaleChange = (selectedId: string) => {
    setSaleId(selectedId);
    if (!selectedId) {
      setSelectedSale(null);
      setAmount(0);
      return;
    }

    const target = unpaidSales.find(s => s.id === selectedId);
    if (target) {
      const totalPaid = (target.payments || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      const remaining = Math.max(0, (Number(target.grand_total) || 0) - totalPaid);
      setSelectedSale({ ...target, remaining, totalPaid });
      setAmount(remaining);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleId) {
      setErrorMsg('Please select a sales invoice reference.');
      return;
    }
    if (amount <= 0) {
      setErrorMsg('Payment amount must be greater than zero.');
      return;
    }
    if (selectedSale && amount > selectedSale.remaining) {
      setErrorMsg(`Amount cannot exceed the remaining due of ${selectedSale.remaining.toFixed(2)} AED.`);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      await db.payments.create({
        sale_id: saleId,
        amount,
        payment_method: paymentMethod,
        account_id: accountId || undefined,
        transaction_no: transactionNo || undefined,
        notes: notes || undefined
      });
      navigate('/payments');
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching && !selectedSale) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <span className="text-sm text-muted-foreground">Loading Invoice Ledger Dues...</span>
      </div>
    );
  }

  return (
    <PermissionGuard permission="Payments.Create" fallback="ui">
      <div className="w-full space-y-6">
        {/* TOP BAR */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/payments')}
            className="p-2 border border-border bg-muted/30 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Payments</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Create</h1>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl text-center font-medium">
            {errorMsg}
          </div>
        )}

        {/* FORM CONTAINER */}
        <form onSubmit={handleSubmit} className="glass border border-border rounded-2xl p-6 space-y-5 shadow-xl">
          {/* Invoice Selector */}
          <div className="space-y-1.5 text-xs">
            <label htmlFor="sale" className="text-muted-foreground font-semibold flex items-center gap-1">
              <Receipt size={13} /> Select Unpaid Sales Invoice *
            </label>
            <select
              id="sale"
              value={saleId}
              onChange={(e) => handleSaleChange(e.target.value)}
              className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-sm"
              required
              disabled={loading || !!saleIdParam}
            >
              <option value="">-- Choose Invoice Reference --</option>
              {unpaidSales.map(s => {
                const customerLabel = s.customer 
                  ? s.person_name 
                    ? `${s.person_name} (Company: ${s.customer.name})`
                    : s.customer.company?.name
                    ? `${s.customer.name} (Company: ${s.customer.company.name})`
                    : s.customer.name
                  : 'Walk-in Customer';
                return (
                  <option key={s.id} value={s.id}>
                    {s.invoice_no} - {customerLabel} (Total: {s.grand_total.toFixed(2)} AED)
                  </option>
                );
              })}
            </select>
            {saleIdParam && (
              <p className="text-[10px] text-muted-foreground mt-1">Invoice locked to redirect parameter.</p>
            )}
          </div>

          {/* Selected Invoice Details Panel */}
          {selectedSale && (
            <div className="bg-muted/25 p-4 rounded-xl border border-border/80 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Invoice Date</span>
                <div className="font-semibold mt-0.5">{new Date(selectedSale.created_at).toLocaleDateString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Grand Total</span>
                <div className="font-semibold mt-0.5">{(selectedSale.grand_total ?? 0).toFixed(2)} AED</div>
              </div>
              <div>
                <span className="text-muted-foreground">Amount Paid</span>
                <div className="font-semibold text-emerald-400 mt-0.5">{(selectedSale.totalPaid ?? 0).toFixed(2)} AED</div>
              </div>
              <div>
                <span className="text-muted-foreground">Remaining Dues</span>
                <div className="font-bold text-rose-400 mt-0.5">{(selectedSale.remaining ?? 0).toFixed(2)} AED</div>
              </div>
            </div>
          )}

          {/* Grid Layout: Amount and Payment Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="amount" className="text-muted-foreground font-semibold flex items-center gap-1">
                <DollarSign size={13} /> Collected Amount (AED) *
              </label>
              <input
                id="amount"
                type="number"
                min={0.01}
                max={selectedSale?.remaining || 999999}
                step={0.01}
                placeholder="E.g. 250.00"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
                required
                disabled={loading || !selectedSale}
              />
            </div>

            {/* Payment Method & Deposit Account */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="method" className="text-muted-foreground font-semibold flex items-center gap-1">
                <CreditCard size={13} /> Payment Method / Mode *
              </label>
              <select
                id="method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-sm font-semibold text-foreground cursor-pointer"
                required
                disabled={loading || !selectedSale}
              >
                <option value="Cash">💵 Cash</option>
                <option value="Card">💳 Card</option>
                <option value="Bank Transfer">🏦 Bank Transfer</option>
                <option value="Mobile Banking">📱 Mobile Banking</option>
              </select>
            </div>

            {/* Deposit To Account */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="account" className="text-muted-foreground font-semibold flex items-center gap-1">
                <Wallet size={13} /> Deposit To Account (Optional)
              </label>
              <select
                id="account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-sm font-semibold text-foreground cursor-pointer"
                disabled={loading || !selectedSale}
              >
                <option value="">-- Auto-resolve / Default Drawer --</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.type === 'cash_drawer' ? '💵' : a.type === 'bank' ? '🏦' : '💳'} {a.name} ({a.balance.toFixed(2)} AED)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid Layout: Transaction Reference and Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Transaction No */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="txNo" className="text-muted-foreground font-semibold flex items-center gap-1">
                <FileText size={13} /> Transaction ID / Ref No
              </label>
              <input
                id="txNo"
                type="text"
                placeholder="E.g. bKash TxID or Bank Reference"
                value={transactionNo}
                onChange={(e) => setTransactionNo(e.target.value)}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
                disabled={loading || !selectedSale}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="notes" className="text-muted-foreground font-semibold flex items-center gap-1">
                <FileText size={13} /> Internal Notes / Remarks
              </label>
              <input
                id="notes"
                placeholder="E.g. Paid in full, bkash fee added..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
                disabled={loading || !selectedSale}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => navigate('/payments')}
              className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:bg-secondary/40 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedSale || amount <= 0}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow-md transition-colors"
            >
              <Save size={14} />
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </PermissionGuard>
  );
};
