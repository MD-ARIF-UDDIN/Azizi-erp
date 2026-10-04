import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { Account, Customer } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ChevronLeft, 
  Receipt, 
  Save, 
  Coins,
  Search,
  AlertCircle
} from 'lucide-react';
import { TransactionConfirmModal } from '../../components/TransactionConfirmModal';

export const PaymentForm: React.FC = () => {
  const { user, activeBranchId, availableBranches } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const saleIdParam = searchParams.get('sale_id');
  const initialModeParam = searchParams.get('mode') === 'advance' ? 'advance' : 'invoice';

  // Mode Selection: 'invoice' (against existing invoice) | 'advance' (new advance invoice + payment)
  const [mode, setMode] = useState<'invoice' | 'advance'>(saleIdParam ? 'invoice' : initialModeParam);

  // Master Data
  const [unpaidSales, setUnpaidSales] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Existing Invoice Mode Form States
  const [saleId, setSaleId] = useState(saleIdParam || '');

  // Advance Mode Form States
  const [customerType, setCustomerType] = useState<'existing' | 'new'>('existing');
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedPersonName, setSelectedPersonName] = useState('');
  const [newMemberForExisting, setNewMemberForExisting] = useState('');
  const [createInvoiceContainer, setCreateInvoiceContainer] = useState(false);

  // New Customer Form States
  const [newCustomerType, setNewCustomerType] = useState<'individual' | 'company'>('individual');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCompanyMemberName, setNewCompanyMemberName] = useState('');

  // Common Financial Form States
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Bank Transfer' | 'Mobile Banking'>('Cash');
  const [accountId, setAccountId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [transactionNo, setTransactionNo] = useState('');
  const [notes, setNotes] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Selected existing customer object
  const selectedCustomer = customers.find(c => c.id === customerId);
  const customerMembers = selectedCustomer?.members || [];

  // Allocations to settle unpaid invoices during advance collection
  const [settleAllocations, setSettleAllocations] = useState<{ [saleId: string]: number }>({});

  const customerUnpaidSales = React.useMemo(() => {
    if (mode !== 'advance' || customerType !== 'existing' || !customerId) return [];
    return unpaidSales.filter(s => s.customer_id === customerId);
  }, [mode, customerType, customerId, unpaidSales]);

  const totalCustomerDue = React.useMemo(() => {
    return customerUnpaidSales.reduce((sum, s) => {
      const pPaid = (s.payments || []).reduce((pSum: number, p: any) => pSum + (Number(p.amount) || 0), 0);
      return sum + Math.max(0, (Number(s.grand_total) || 0) - pPaid);
    }, 0);
  }, [customerUnpaidSales]);

  const totalAllocatedToDues = React.useMemo(() => {
    return Object.values(settleAllocations).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [settleAllocations]);

  const advanceSurplus = Math.max(0, amount - totalAllocatedToDues);

  const handleToggleSettleInvoice = (sId: string, maxDue: number) => {
    setSettleAllocations(prev => {
      const copy = { ...prev };
      if (copy[sId] !== undefined) {
        delete copy[sId];
      } else {
        const currentlyAllocated = Object.values(copy).reduce((sum, v) => sum + v, 0);
        const remainingBudget = Math.max(0, amount - currentlyAllocated);
        copy[sId] = remainingBudget > 0 ? Math.min(maxDue, remainingBudget) : maxDue;
      }
      return copy;
    });
  };

  const handleUpdateSettleAmount = (sId: string, val: number, maxDue: number) => {
    setSettleAllocations(prev => ({
      ...prev,
      [sId]: Math.min(maxDue, Math.max(0, val))
    }));
  };

  const handleAutoAllocateAllDues = () => {
    let remainingBudget = amount;
    const newAllocs: { [saleId: string]: number } = {};
    for (const s of customerUnpaidSales) {
      const pPaid = (s.payments || []).reduce((pSum: number, p: any) => pSum + (Number(p.amount) || 0), 0);
      const sDue = Math.max(0, (Number(s.grand_total) || 0) - pPaid);
      if (sDue > 0) {
        const take = remainingBudget > 0 ? Math.min(sDue, remainingBudget) : sDue;
        newAllocs[s.id] = take;
        if (remainingBudget > 0) remainingBudget -= take;
      }
    }
    setSettleAllocations(newAllocs);
  };

  const handleClearSettleAllocations = () => {
    setSettleAllocations({});
  };

  useEffect(() => {
    const loadData = async () => {
      setFetching(true);
      try {
        const [allSales, allAccounts, allCustomers] = await Promise.all([
          db.sales.getAll(),
          db.accounts.getAll(),
          db.customers.getAll()
        ]);

        // Filter sales that are Unpaid or Partially Paid
        const unpaid = allSales.filter(s => s.payment_status !== 'Paid');
        setUnpaidSales(unpaid);
        setAccounts(allAccounts);
        setCustomers(allCustomers);

        // Default branch
        const defaultBranch = (activeBranchId && activeBranchId !== 'all')
          ? activeBranchId
          : (user?.branch_id || availableBranches[0]?.id || 'b1111111-1111-1111-1111-111111111111');
        setBranchId(defaultBranch);

        // Default account (cash drawer preferred)
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
  }, [saleIdParam, activeBranchId]);

  // Handle existing sale selection change
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

  // Switch between mode tabs
  const handleModeChange = (newMode: 'invoice' | 'advance') => {
    setMode(newMode);
    setErrorMsg('');
    if (newMode === 'advance') {
      if (mode === 'invoice' && amount === (selectedSale?.remaining || 0)) {
        setAmount(0);
      }
    } else {
      if (selectedSale) {
        setAmount(selectedSale.remaining);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (amount <= 0) {
      setErrorMsg('Payment amount must be greater than zero.');
      return;
    }
    if (!accountId) {
      setErrorMsg('Deposit To Account is mandatory. Please select an account.');
      return;
    }

    if (mode === 'invoice') {
      if (!saleId) {
        setErrorMsg('Please select a sales invoice reference.');
        return;
      }
      if (selectedSale && amount > selectedSale.remaining) {
        // Overpayment is allowed — surplus will credit to customer advance wallet
      }
    } else {
      // Advance mode validations
      if (customerType === 'existing') {
        if (!customerId) {
          setErrorMsg('Please select an existing customer for this advance payment.');
          return;
        }
      } else {
        if (!newCustomerName.trim()) {
          setErrorMsg(newCustomerType === 'company' ? 'Company name is required.' : 'Customer name is required.');
          return;
        }
      }
    }

    if (mode === 'advance' && totalAllocatedToDues > amount) {
      setErrorMsg(`Total allocated to settle invoices (${totalAllocatedToDues.toFixed(2)} AED) cannot exceed the collected amount (${amount.toFixed(2)} AED).`);
      return;
    }

    setShowConfirmModal(true);
  };

  const executeSavePayment = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    setErrorMsg('');

    try {
      if (mode === 'invoice') {
        // Direct payment against existing invoice
        await db.payments.create({
          sale_id: saleId,
          customer_id: selectedSale?.customer_id,
          amount,
          payment_method: paymentMethod,
          account_id: accountId,
          transaction_no: transactionNo || undefined,
          notes: notes || undefined
        });
        navigate('/payments');
      } else {
        // Advance Payment Flow:
        let finalCustomerId = customerId;
        let finalPersonName = selectedPersonName.trim() || undefined;

        // 1. Create or update customer record if necessary
        if (customerType === 'new') {
          const membersList = (newCustomerType === 'company' && newCompanyMemberName.trim())
            ? [{ id: crypto.randomUUID(), name: newCompanyMemberName.trim() }]
            : [];

          const createdCust = await db.customers.create({
            name: newCustomerName.trim(),
            phone: newCustomerPhone.trim() || undefined,
            email: newCustomerEmail.trim() || undefined,
            address: newCustomerAddress.trim() || undefined,
            customer_type: newCustomerType,
            members: membersList,
            notes: 'Registered via Advance Payment.'
          });
          finalCustomerId = createdCust.id;
          finalPersonName = newCompanyMemberName.trim() || undefined;
        } else if (customerType === 'existing' && finalCustomerId) {
          // If a new member name was typed for existing customer, save it to customer members list
          if (newMemberForExisting.trim()) {
            finalPersonName = newMemberForExisting.trim();
            const existingCust = customers.find(c => c.id === finalCustomerId);
            if (existingCust) {
              const existingMembers = existingCust.members || [];
              const exists = existingMembers.some(m => m.name.toLowerCase() === finalPersonName!.toLowerCase());
              if (!exists) {
                const updatedMembers = [
                  ...existingMembers,
                  { id: crypto.randomUUID(), name: finalPersonName }
                ];
                await db.customers.update(finalCustomerId, {
                  members: updatedMembers,
                  customer_type: 'company'
                });
              }
            }
          }
        }

        const effectiveBranchId = branchId || (activeBranchId && activeBranchId !== 'all' ? activeBranchId : availableBranches[0]?.id || 'b1111111-1111-1111-1111-111111111111');

        if (customerType === 'existing' && totalAllocatedToDues > 0) {
          // Flow C: Settle selected unpaid invoices + deposit surplus into wallet
          for (const [sId, allocAmt] of Object.entries(settleAllocations)) {
            if (allocAmt > 0) {
              const targetSale = unpaidSales.find(s => s.id === sId);
              await db.payments.create({
                sale_id: sId,
                customer_id: finalCustomerId,
                branch_id: effectiveBranchId,
                amount: allocAmt,
                payment_method: paymentMethod,
                account_id: accountId,
                transaction_no: transactionNo || undefined,
                person_name: finalPersonName || targetSale?.person_name || undefined,
                notes: notes ? `[Invoice #${targetSale?.invoice_no || ''} Settled] ${notes}` : `Settled from payment collection`
              });
            }
          }

          if (advanceSurplus > 0) {
            await db.payments.create({
              customer_id: finalCustomerId,
              branch_id: effectiveBranchId,
              amount: advanceSurplus,
              payment_method: paymentMethod,
              account_id: accountId,
              transaction_no: transactionNo || undefined,
              person_name: finalPersonName || undefined,
              notes: notes ? `[Advance Deposit] ${notes}` : 'Customer advance payment (Wallet Deposit)'
            });
          }
        } else if (createInvoiceContainer) {
          // Flow B (Draft Invoice Container):
          // Create an empty Sales Invoice with this payment attached for adding services later
          const createdSale = await db.sales.create({
            customer_id: finalCustomerId || undefined,
            branch_id: effectiveBranchId,
            discount: 0,
            notes: notes ? `[Advance Payment] ${notes}` : 'Advance Payment Collection (Draft Container)',
            person_name: finalPersonName || undefined,
            items: []
          });

          await db.payments.create({
            sale_id: createdSale.id,
            customer_id: finalCustomerId || undefined,
            branch_id: effectiveBranchId,
            amount,
            payment_method: paymentMethod,
            account_id: accountId,
            transaction_no: transactionNo || undefined,
            person_name: finalPersonName || undefined,
            notes: notes ? `[Advance] ${notes}` : 'Advance payment collected (Draft Invoice Container)'
          });
        } else {
          // Flow A (Default: Pure Customer Advance Wallet Deposit — NO invoice generated):
          await db.payments.create({
            customer_id: finalCustomerId || undefined,
            branch_id: effectiveBranchId,
            amount,
            payment_method: paymentMethod,
            account_id: accountId,
            transaction_no: transactionNo || undefined,
            person_name: finalPersonName || undefined,
            notes: notes ? `[Advance Deposit] ${notes}` : 'Customer advance payment (Wallet Deposit)'
          });
        }

        navigate('/payments');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching && !selectedSale && unpaidSales.length === 0 && customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <span className="text-sm text-muted-foreground">Loading Payment Form Data...</span>
      </div>
    );
  }

  // Filtered customer list for advance search
  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.members && c.members.some(m => m.name.toLowerCase().includes(q)))
    );
  });

  return (
    <PermissionGuard permission="Payments.Create" fallback="ui">
      <div className="w-full space-y-5">
        {/* TOP BAR */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/payments')}
              className="p-2 border border-border bg-muted/30 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Payments</div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">
                {mode === 'advance' ? 'Record Advance Payment' : 'Record Invoice Payment'}
              </h1>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl text-center font-medium flex items-center justify-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* FORM CONTAINER */}
        <form onSubmit={handleSubmit} className="glass border border-border rounded-2xl p-6 space-y-6 shadow-sm">
          
          {/* FLOW SELECTION SEGMENT TABS */}
          <div className="p-1 bg-muted/60 border border-border/80 rounded-xl grid grid-cols-2 gap-1 max-w-md mx-auto sm:mx-0">
            <button
              type="button"
              disabled={loading || !!saleIdParam}
              onClick={() => handleModeChange('invoice')}
              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'invoice'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <Receipt size={14} />
              <span>Against Invoice</span>
            </button>
            <button
              type="button"
              disabled={loading || !!saleIdParam}
              onClick={() => handleModeChange('advance')}
              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'advance'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <Coins size={14} />
              <span>Advance Payment</span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* MODE 1: AGAINST UNPAID SALES INVOICE                      */}
          {/* ========================================================= */}
          {mode === 'invoice' && (
            <div className="space-y-4">
              <div className="space-y-1.5 text-xs">
                <label htmlFor="sale" className="text-foreground font-medium">
                  Select Invoice *
                </label>
                <select
                  id="sale"
                  value={saleId}
                  onChange={(e) => handleSaleChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground font-medium cursor-pointer focus:ring-2 focus:ring-primary/20 outline-none"
                  required
                  disabled={loading || !!saleIdParam}
                >
                  <option value="">-- Choose Invoice --</option>
                  {unpaidSales.map(s => {
                    const customerLabel = s.customer 
                      ? s.person_name 
                        ? `${s.person_name} (${s.customer.name})`
                        : s.customer.name
                      : (s.person_name || 'Walk-in Customer');
                    return (
                      <option key={s.id} value={s.id}>
                        {s.invoice_no} — {customerLabel} (Due: {Number((s.grand_total || 0) - (s.payments || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)).toFixed(2)} AED)
                      </option>
                    );
                  })}
                </select>
                {saleIdParam && (
                  <p className="text-[11px] text-muted-foreground">Invoice preselected from previous screen.</p>
                )}
              </div>

              {/* Selected Invoice Details */}
              {selectedSale && (
                <div className="bg-muted/30 p-4 rounded-xl border border-border/70 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[11px]">Invoice Date</span>
                    <div className="font-semibold text-foreground mt-0.5">{new Date(selectedSale.created_at).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">Grand Total</span>
                    <div className="font-semibold text-foreground mt-0.5">{(selectedSale.grand_total ?? 0).toFixed(2)} AED</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">Paid</span>
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{(selectedSale.totalPaid ?? 0).toFixed(2)} AED</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">Balance Due</span>
                    <div className="font-bold text-rose-600 dark:text-rose-400 mt-0.5">{(selectedSale.remaining ?? 0).toFixed(2)} AED</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* MODE 2: ADVANCE PAYMENT (CUSTOMER & MEMBER SELECTION)      */}
          {/* ========================================================= */}
          {mode === 'advance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Customer
                </span>

                {/* Existing vs New Customer Switch */}
                <div className="flex rounded-lg bg-muted/70 p-0.5 border border-border gap-0.5">
                  <button
                    type="button"
                    onClick={() => { setCustomerType('existing'); setSelectedPersonName(''); setNewMemberForExisting(''); }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      customerType === 'existing'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Existing Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCustomerType('new'); setCustomerId(''); }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      customerType === 'new'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    + New Customer
                  </button>
                </div>
              </div>

              {/* 2A. EXISTING CUSTOMER */}
              {customerType === 'existing' ? (
                <div className="space-y-3">
                  <div className="space-y-1.5 text-xs">
                    {/* Search & Select Unified */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-4 relative">
                        <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Filter customers..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                      </div>
                      <div className="sm:col-span-8">
                        <select
                          id="customerSelect"
                          value={customerId}
                          onChange={(e) => {
                            setCustomerId(e.target.value);
                            setSelectedPersonName('');
                            setNewMemberForExisting('');
                          }}
                          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground cursor-pointer focus:ring-2 focus:ring-primary/20 outline-none"
                          required={mode === 'advance' && customerType === 'existing'}
                        >
                          <option value="">-- Select Customer --</option>
                          {filteredCustomers.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.phone ? `(${c.phone})` : ''} {c.customer_type === 'company' ? '— Company' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Selected Customer Members (if company or has members) */}
                  {selectedCustomer && customerMembers.length > 0 && (
                    <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Select Member / Representative (Optional):</div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => { setSelectedPersonName(''); setNewMemberForExisting(''); }}
                          className={`text-xs px-2.5 py-1 rounded-lg font-medium border cursor-pointer transition-all ${
                            !selectedPersonName && !newMemberForExisting
                              ? 'bg-primary text-white border-primary shadow-xs'
                              : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                          }`}
                        >
                          Direct Company
                        </button>
                        {customerMembers.map((m: any, idx: number) => (
                          <button
                            key={m.id || idx}
                            type="button"
                            onClick={() => { setSelectedPersonName(m.name); setNewMemberForExisting(''); }}
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium border cursor-pointer transition-all ${
                              selectedPersonName === m.name && !newMemberForExisting
                                ? 'bg-primary text-white border-primary shadow-xs'
                                : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                            }`}
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* 2B. NEW CUSTOMER FORM */
                <div className="space-y-3 p-4 border border-border/80 rounded-xl bg-muted/20">
                  <div className="flex rounded-lg bg-background p-0.5 border border-border max-w-xs">
                    <button
                      type="button"
                      onClick={() => setNewCustomerType('individual')}
                      className={`flex-1 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                        newCustomerType === 'individual'
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Individual
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCustomerType('company')}
                      className={`flex-1 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                        newCustomerType === 'company'
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Company
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1 text-xs sm:col-span-2">
                      <label className="text-foreground font-medium">
                        {newCustomerType === 'company' ? 'Company Name *' : 'Full Name *'}
                      </label>
                      <input
                        type="text"
                        required={mode === 'advance' && customerType === 'new'}
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder={newCustomerType === 'company' ? 'Company name...' : 'Customer name...'}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-xs"
                      />
                    </div>
                    <div className="space-y-1 text-xs">
                      <label className="text-muted-foreground font-medium">Phone Number</label>
                      <input
                        type="text"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="Mobile / phone..."
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-xs"
                      />
                    </div>
                    <div className="space-y-1 text-xs">
                      <label className="text-muted-foreground font-medium">Email Address</label>
                      <input
                        type="email"
                        value={newCustomerEmail}
                        onChange={(e) => setNewCustomerEmail(e.target.value)}
                        placeholder="Email (optional)..."
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-xs"
                      />
                    </div>
                    <div className="space-y-1 text-xs sm:col-span-2">
                      <label className="text-muted-foreground font-medium">Address / Location</label>
                      <input
                        type="text"
                        value={newCustomerAddress}
                        onChange={(e) => setNewCustomerAddress(e.target.value)}
                        placeholder="Location (optional)..."
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-xs"
                      />
                    </div>
                    {newCustomerType === 'company' && (
                      <div className="space-y-1 text-xs sm:col-span-2">
                        <label className="text-muted-foreground font-medium">Member / Contact Person</label>
                        <input
                          type="text"
                          value={newCompanyMemberName}
                          onChange={(e) => setNewCompanyMemberName(e.target.value)}
                          placeholder="Contact person name (optional)..."
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Draft Invoice Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="createInvoiceContainer"
                  type="checkbox"
                  checked={createInvoiceContainer}
                  onChange={(e) => setCreateInvoiceContainer(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                />
                <label htmlFor="createInvoiceContainer" className="text-xs font-medium text-foreground cursor-pointer select-none">
                  Create an empty draft invoice for this advance
                </label>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* OPTIONAL: SETTLE OUTSTANDING INVOICES WITH THIS PAYMENT   */}
          {/* ========================================================= */}
          {mode === 'advance' && customerType === 'existing' && customerUnpaidSales.length > 0 && (
            <div className="border border-sky-500/20 bg-sky-500/5 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                  <span>Customer has {customerUnpaidSales.length} unpaid invoice{customerUnpaidSales.length !== 1 ? 's' : ''} ({totalCustomerDue.toFixed(2)} AED)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoAllocateAllDues}
                    className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-medium transition-all cursor-pointer"
                  >
                    Auto-Settle
                  </button>
                  {totalAllocatedToDues > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSettleAllocations}
                      className="px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground text-[11px] transition-all cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Invoices list */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {customerUnpaidSales.map(s => {
                  const pPaid = (s.payments || []).reduce((pSum: number, p: any) => pSum + (Number(p.amount) || 0), 0);
                  const sDue = Math.max(0, (Number(s.grand_total) || 0) - pPaid);
                  const isSelected = settleAllocations[s.id] !== undefined;
                  const currentAlloc = settleAllocations[s.id] || 0;

                  return (
                    <div
                      key={s.id}
                      className={`p-2 rounded-lg border transition-all flex items-center justify-between gap-2 text-xs ${
                        isSelected ? 'bg-sky-500/10 border-sky-500/30' : 'bg-background border-border/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`settle-${s.id}`}
                          checked={isSelected}
                          onChange={() => handleToggleSettleInvoice(s.id, sDue)}
                          className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                        <label htmlFor={`settle-${s.id}`} className="cursor-pointer font-medium text-foreground">
                          #{s.invoice_no} <span className="text-muted-foreground font-normal">({new Date(s.created_at).toLocaleDateString()})</span>
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">Due: {sDue.toFixed(2)} AED</span>
                        {isSelected && (
                          <input
                            type="number"
                            min={0.01}
                            max={sDue}
                            step={0.01}
                            value={currentAlloc || ''}
                            onChange={(e) => handleUpdateSettleAmount(s.id, parseFloat(e.target.value) || 0, sDue)}
                            className="w-20 px-2 py-0.5 bg-background border border-sky-500/40 rounded text-xs font-semibold text-right"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalAllocatedToDues > 0 && (
                <div className="flex items-center justify-between text-xs pt-1 text-muted-foreground">
                  <span>Settling Invoices: <strong className="text-foreground">{totalAllocatedToDues.toFixed(2)} AED</strong></span>
                  <span>To Advance Wallet: <strong className="text-foreground">{advanceSurplus.toFixed(2)} AED</strong></span>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* PAYMENT DETAILS                                           */}
          {/* ========================================================= */}
          <div className="space-y-4 pt-2 border-t border-border/60">
            <div className="text-xs font-bold text-foreground uppercase tracking-wider">
              Payment Details
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Amount */}
              <div className="space-y-1.5 text-xs">
                <label htmlFor="amount" className="text-foreground font-medium">
                  Amount (AED) *
                </label>
                <input
                  id="amount"
                  type="number"
                  min={0.01}
                  max={999999}
                  step={0.01}
                  placeholder="0.00"
                  value={amount || ''}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                  required
                  disabled={loading || (mode === 'invoice' && !selectedSale)}
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5 text-xs">
                <label htmlFor="method" className="text-foreground font-medium">
                  Payment Method *
                </label>
                <select
                  id="method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground cursor-pointer focus:ring-2 focus:ring-primary/20 outline-none"
                  required
                  disabled={loading}
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Mobile Banking">Mobile Banking</option>
                </select>
              </div>

              {/* Deposit Account */}
              <div className="space-y-1.5 text-xs">
                <label htmlFor="account" className="text-foreground font-medium">
                  Deposit Account *
                </label>
                <select
                  id="account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground cursor-pointer focus:ring-2 focus:ring-primary/20 outline-none"
                  disabled={loading}
                >
                  <option value="">-- Select Account --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.balance.toFixed(2)} AED)
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch Selector (In Advance Mode) */}
              {mode === 'advance' ? (
                <div className="space-y-1.5 text-xs">
                  <label htmlFor="branch" className="text-foreground font-medium">
                    Branch *
                  </label>
                  <select
                    id="branch"
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground cursor-pointer focus:ring-2 focus:ring-primary/20 outline-none"
                    disabled={loading}
                  >
                    {availableBranches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs">
                  <label htmlFor="txNo" className="text-muted-foreground font-medium">
                    Reference / Tx ID
                  </label>
                  <input
                    id="txNo"
                    type="text"
                    placeholder="Optional..."
                    value={transactionNo}
                    onChange={(e) => setTransactionNo(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                    disabled={loading}
                  />
                </div>
              )}
            </div>

            {/* Grid 2: Notes & Optional Reference (for Advance Mode) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mode === 'advance' && (
                <div className="space-y-1.5 text-xs">
                  <label htmlFor="txNo" className="text-muted-foreground font-medium">
                    Reference / Tx ID
                  </label>
                  <input
                    id="txNo"
                    type="text"
                    placeholder="Optional ref, card code, transfer id..."
                    value={transactionNo}
                    onChange={(e) => setTransactionNo(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                    disabled={loading}
                  />
                </div>
              )}
              <div className={`space-y-1.5 text-xs ${mode !== 'advance' ? 'sm:col-span-2' : ''}`}>
                <label htmlFor="notes" className="text-muted-foreground font-medium">
                  Notes / Remarks
                </label>
                <input
                  id="notes"
                  placeholder="Optional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => navigate('/payments')}
              className="px-4 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading || 
                amount <= 0 || 
                (mode === 'invoice' && !selectedSale) ||
                (mode === 'advance' && customerType === 'existing' && !customerId) ||
                (mode === 'advance' && customerType === 'new' && !newCustomerName.trim())
              }
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              {loading 
                ? 'Recording...' 
                : mode === 'advance' 
                ? 'Record Advance Payment' 
                : 'Record Payment'
              }
            </button>
          </div>
        </form>

        {/* CONFIRMATION MODAL */}
        <TransactionConfirmModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={executeSavePayment}
          loading={loading}
          type="payment"
          title={mode === 'advance' ? 'Confirm Advance Payment Collection' : 'Confirm Payment Collection'}
          subtitle={
            mode === 'advance'
              ? createInvoiceContainer
                ? 'A new sales invoice with 0 services will be created and marked as Paid for this advance.'
                : 'Payment will be deposited directly to your selected account and credited to customer advance wallet.'
              : amount > (selectedSale?.remaining ?? 0)
                ? `Invoice will be marked Paid and the surplus of ${(amount - (selectedSale?.remaining ?? 0)).toFixed(2)} AED will be credited to the customer's advance wallet.`
                : 'Please verify the payment details before depositing to account.'
          }
          amount={amount}
          currency="AED"
          confirmText={mode === 'advance' ? 'Confirm & Record Advance' : 'Confirm & Collect Payment'}
          details={[
            ...(mode === 'invoice' ? [
              {
                label: 'Sales Invoice',
                value: selectedSale?.invoice_no ? `#${selectedSale.invoice_no}` : '-',
                highlight: true
              },
              {
                label: 'Customer / Client',
                value: selectedSale?.customer
                  ? selectedSale?.person_name
                    ? `${selectedSale.person_name} (${selectedSale.customer.name})`
                    : selectedSale.customer.name
                  : (selectedSale?.person_name || 'Customer')
              },
              {
                label: 'Current Remaining Due',
                value: `${(selectedSale?.remaining ?? 0).toFixed(2)} AED`
              },
              amount > (selectedSale?.remaining ?? 0)
                ? {
                    label: '⚠️ Overpayment — Advance Surplus',
                    value: `+${(amount - (selectedSale?.remaining ?? 0)).toFixed(2)} AED → credited to customer wallet`,
                    highlight: true
                  }
                : {
                    label: 'New Remaining Balance',
                    value: `${Math.max(0, (selectedSale?.remaining ?? 0) - amount).toFixed(2)} AED`
                  }
            ] : [
              {
                label: 'Payment Mode',
                value: createInvoiceContainer
                  ? 'Draft Sales Invoice Container'
                  : 'Customer Advance Wallet (Direct Deposit)',
                highlight: true
              },
              {
                label: 'Customer',
                value: customerType === 'existing'
                  ? (selectedCustomer?.name || 'Selected Customer')
                  : `${newCustomerName} (${newCustomerType === 'company' ? 'Company' : 'Individual'})`
              },
              ...(selectedPersonName || newMemberForExisting || (newCustomerType === 'company' && newCompanyMemberName) ? [{
                label: 'Member / Person',
                value: newMemberForExisting || selectedPersonName || newCompanyMemberName
              }] : []),
              {
                label: 'Target Branch',
                value: availableBranches.find(b => b.id === branchId)?.name || 'Active Branch'
              },
              ...(totalAllocatedToDues > 0 ? [
                {
                  label: 'Applied to Settle Invoices',
                  value: `${totalAllocatedToDues.toFixed(2)} AED (${Object.keys(settleAllocations).length} invoice${Object.keys(settleAllocations).length !== 1 ? 's' : ''})`,
                  highlight: true
                },
                {
                  label: 'Remaining Credited to Advance',
                  value: `${advanceSurplus.toFixed(2)} AED`,
                  badge: true,
                  badgeColor: 'sky' as const
                }
              ] : [])
            ]),
            {
              label: 'Deposit To Account',
              value: accounts.find(a => a.id === accountId)?.name || 'Account',
              highlight: true
            },
            {
              label: 'Payment Method',
              value: paymentMethod,
              badge: true,
              badgeColor: 'emerald'
            },
            ...(transactionNo ? [{ label: 'Tx / Ref #', value: transactionNo }] : []),
            ...(notes ? [{ label: 'Internal Note', value: notes }] : [])
          ]}
        />
      </div>
    </PermissionGuard>
  );
};
