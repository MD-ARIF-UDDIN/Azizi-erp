import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { Account, Customer, Service } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ChevronLeft, 
  CreditCard, 
  DollarSign, 
  FileText, 
  Receipt, 
  Save, 
  Wallet,
  Coins,
  User,
  Building2,
  Users,
  Plus,
  Search,
  CheckCircle2,
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
  const [services, setServices] = useState<Service[]>([]);

  // Existing Invoice Mode Form States
  const [saleId, setSaleId] = useState(saleIdParam || '');

  // Advance Mode Form States
  const [customerType, setCustomerType] = useState<'existing' | 'new'>('existing');
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedPersonName, setSelectedPersonName] = useState('');
  const [newMemberForExisting, setNewMemberForExisting] = useState('');

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

  useEffect(() => {
    const loadData = async () => {
      setFetching(true);
      try {
        const [allSales, allAccounts, allCustomers, allServices] = await Promise.all([
          db.sales.getAll(),
          db.accounts.getAll(),
          db.customers.getAll(),
          db.services.getAll()
        ]);

        // Filter sales that are Unpaid or Partially Paid
        const unpaid = allSales.filter(s => s.payment_status !== 'Paid');
        setUnpaidSales(unpaid);
        setAccounts(allAccounts);
        setCustomers(allCustomers);
        setServices(allServices);

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
        setErrorMsg(`Amount cannot exceed the remaining due of ${selectedSale.remaining.toFixed(2)} AED.`);
        return;
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

        // 2. Find or create an Advance Payment service
        let advanceService = services.find(s => 
          s.name.toLowerCase().includes('advance') || 
          s.name.toLowerCase().includes('deposit')
        );

        if (!advanceService) {
          if (services.length > 0) {
            advanceService = services[0];
          } else {
            // Auto create an advance service category & service if none exist
            const categories = await db.serviceCategories.getAll();
            const catId = categories[0]?.id || 'c1111111-1111-1111-1111-111111111111';
            advanceService = await db.services.create({
              name: 'Advance Payment / Deposit',
              category_id: catId,
              price: 0,
              expense: 0,
              status: 'Active'
            });
          }
        }

        const effectiveBranchId = branchId || (activeBranchId && activeBranchId !== 'all' ? activeBranchId : availableBranches[0]?.id || 'b1111111-1111-1111-1111-111111111111');

        // 3. Create a new Sales Invoice for this Advance
        const createdSale = await db.sales.create({
          customer_id: finalCustomerId || undefined,
          branch_id: effectiveBranchId,
          discount: 0,
          notes: notes ? `[Advance Payment] ${notes}` : 'Advance Payment Collection',
          person_name: finalPersonName || undefined,
          items: [{
            service_id: advanceService.id,
            quantity: 1,
            unit_price: amount,
            expense: 0,
            person_name: finalPersonName || undefined,
            service_date: new Date().toISOString().split('T')[0],
            notes: notes || 'Advance payment collection'
          }]
        });

        // 4. Record the Payment against the newly created sales invoice
        await db.payments.create({
          sale_id: createdSale.id,
          amount,
          payment_method: paymentMethod,
          account_id: accountId,
          transaction_no: transactionNo || undefined,
          person_name: finalPersonName || undefined,
          notes: notes ? `[Advance] ${notes}` : 'Advance payment collected'
        });

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
        <form onSubmit={handleSubmit} className="glass border border-border rounded-2xl p-6 space-y-6 shadow-xl">
          
          {/* FLOW SELECTION SEGMENT TABS */}
          <div className="p-1 bg-muted/70 border border-border rounded-xl grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={loading || !!saleIdParam}
              onClick={() => handleModeChange('invoice')}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'invoice'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <Receipt size={15} />
              <span>Against Existing Invoice</span>
            </button>
            <button
              type="button"
              disabled={loading || !!saleIdParam}
              onClick={() => handleModeChange('advance')}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'advance'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <Coins size={15} />
              <span>Advance Payment</span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* MODE 1: AGAINST UNPAID SALES INVOICE                      */}
          {/* ========================================================= */}
          {mode === 'invoice' && (
            <div className="space-y-4">
              {/* Invoice Selector */}
              <div className="space-y-1.5 text-xs">
                <label htmlFor="sale" className="text-muted-foreground font-semibold flex items-center gap-1">
                  <Receipt size={13} /> Select Unpaid Sales Invoice *
                </label>
                <select
                  id="sale"
                  value={saleId}
                  onChange={(e) => handleSaleChange(e.target.value)}
                  className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-sm text-foreground font-semibold cursor-pointer"
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
                      : (s.person_name || 'Walk-in Customer');
                    return (
                      <option key={s.id} value={s.id}>
                        {s.invoice_no} - {customerLabel} (Total: {Number(s.grand_total || 0).toFixed(2)} AED)
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
            </div>
          )}

          {/* ========================================================= */}
          {/* MODE 2: ADVANCE PAYMENT (CUSTOMER & MEMBER SELECTION)      */}
          {/* ========================================================= */}
          {mode === 'advance' && (
            <div className="space-y-5 border-b border-border/60 pb-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <User size={14} /> Customer &amp; Member Details
                </span>

                {/* Existing vs New Customer Toggle */}
                <div className="flex rounded-lg bg-muted p-0.5 border border-border gap-1">
                  <button
                    type="button"
                    onClick={() => { setCustomerType('existing'); setSelectedPersonName(''); setNewMemberForExisting(''); }}
                    className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      customerType === 'existing'
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <User size={12} /> Existing Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCustomerType('new'); setCustomerId(''); }}
                    className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      customerType === 'new'
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Plus size={12} /> New Customer
                  </button>
                </div>
              </div>

              {/* 2A. EXISTING CUSTOMER FLOW */}
              {customerType === 'existing' ? (
                <div className="space-y-3 bg-muted/20 border border-border p-4 rounded-xl">
                  <div className="space-y-1.5 text-xs">
                    <label htmlFor="customerSelect" className="text-muted-foreground font-semibold flex items-center justify-between">
                      <span>Select Customer / Company *</span>
                      <span className="text-[10px] text-muted-foreground font-normal">({filteredCustomers.length} available)</span>
                    </label>

                    {/* Quick Search */}
                    <div className="relative mb-1">
                      <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search customer name, phone, or member..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs font-medium text-foreground"
                      />
                    </div>

                    <select
                      id="customerSelect"
                      value={customerId}
                      onChange={(e) => {
                        setCustomerId(e.target.value);
                        setSelectedPersonName('');
                        setNewMemberForExisting('');
                      }}
                      className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-sm text-foreground font-semibold cursor-pointer"
                      required={mode === 'advance' && customerType === 'existing'}
                    >
                      <option value="">-- Choose Customer / Company * --</option>
                      {filteredCustomers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.customer_type === 'company' ? '🏢' : '👤'} {c.name} {c.phone ? `(${c.phone})` : ''} {c.members && c.members.length > 0 ? `[${c.members.length} members]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected Customer & Members Section */}
                  {selectedCustomer && (
                    <div className="p-3 rounded-xl border border-border bg-card/60 space-y-3 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <Users size={13} className="text-primary" />
                          <span>Member / Person for this Advance</span>
                        </span>
                        {selectedPersonName && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                            Assigned to: {selectedPersonName}
                          </span>
                        )}
                      </div>

                      {/* Select existing member or direct */}
                      <div className="space-y-1 text-xs">
                        <label className="text-muted-foreground font-medium">Select Existing Member (or leave direct to company):</label>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => { setSelectedPersonName(''); setNewMemberForExisting(''); }}
                            className={`text-xs px-2.5 py-1 rounded-lg font-semibold border cursor-pointer transition-all ${
                              !selectedPersonName && !newMemberForExisting
                                ? 'bg-primary text-white border-primary shadow-xs'
                                : 'bg-muted/40 text-muted-foreground border-border hover:border-primary/40'
                            }`}
                          >
                            🏢 Direct Customer ({selectedCustomer.name})
                          </button>
                          {customerMembers.map((m: any, idx: number) => (
                            <button
                              key={m.id || idx}
                              type="button"
                              onClick={() => { setSelectedPersonName(m.name); setNewMemberForExisting(''); }}
                              className={`text-xs px-2.5 py-1 rounded-lg font-semibold border cursor-pointer transition-all flex items-center gap-1 ${
                                selectedPersonName === m.name && !newMemberForExisting
                                  ? 'bg-primary text-white border-primary shadow-xs'
                                  : 'bg-muted/40 text-muted-foreground border-border hover:border-primary/40'
                              }`}
                            >
                              <User size={11} /> {m.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Add new member input for existing customer */}
                      <div className="space-y-1 text-xs pt-1 border-t border-border/50">
                        <label className="text-muted-foreground font-medium">Or Enter a New Member Name:</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Type new person / member name..."
                            value={newMemberForExisting}
                            onChange={(e) => {
                              setNewMemberForExisting(e.target.value);
                              setSelectedPersonName(e.target.value);
                            }}
                            className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-medium text-foreground outline-none"
                          />
                          {newMemberForExisting && (
                            <span className="text-[10px] text-primary font-bold whitespace-nowrap flex items-center gap-1">
                              <CheckCircle2 size={12} /> Auto-adds to company
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* 2B. NEW CUSTOMER FLOW */
                <div className="space-y-3 border border-border p-4 rounded-xl bg-muted/20">
                  {/* Company vs Individual Toggle */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Account Type *</label>
                    <div className="flex rounded-lg bg-background p-0.5 border border-border gap-1">
                      <button
                        type="button"
                        onClick={() => setNewCustomerType('individual')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                          newCustomerType === 'individual'
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <User size={13} /> Individual
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCustomerType('company')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                          newCustomerType === 'company'
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Building2 size={13} /> Company
                      </button>
                    </div>
                  </div>

                  {/* Customer / Company Name */}
                  <div className="space-y-1 text-xs">
                    <label className="text-foreground font-semibold">
                      {newCustomerType === 'company' ? 'Company / Trade Name *' : 'Customer Full Name *'}
                    </label>
                    <input
                      type="text"
                      required={mode === 'advance' && customerType === 'new'}
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder={newCustomerType === 'company' ? 'E.g. Al Safa Transport LLC' : 'E.g. Mohammed Ali'}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-xs font-medium"
                    />
                  </div>

                  {/* Phone & Email */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1 text-xs">
                      <label className="text-muted-foreground font-semibold">Phone Number</label>
                      <input
                        type="text"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="+971 50 000 0000"
                        className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-xs font-medium"
                      />
                    </div>
                    <div className="space-y-1 text-xs">
                      <label className="text-muted-foreground font-semibold">Email Address</label>
                      <input
                        type="email"
                        value={newCustomerEmail}
                        onChange={(e) => setNewCustomerEmail(e.target.value)}
                        placeholder="info@domain.com"
                        className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-xs font-medium"
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-1 text-xs">
                    <label className="text-muted-foreground font-semibold">Address / Office Location</label>
                    <input
                      type="text"
                      value={newCustomerAddress}
                      onChange={(e) => setNewCustomerAddress(e.target.value)}
                      placeholder="E.g. Musaffah M37, Abu Dhabi, UAE"
                      className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-foreground text-xs font-medium"
                    />
                  </div>

                  {/* Member Name (Optional for New Company) */}
                  {newCustomerType === 'company' && (
                    <div className="space-y-1 text-xs pt-1 border-t border-border/50">
                      <label className="text-foreground font-semibold flex items-center justify-between">
                        <span>Member / Employee Name</span>
                        <span className="text-[10px] text-muted-foreground font-normal">(Optional — will save if empty)</span>
                      </label>
                      <input
                        type="text"
                        value={newCompanyMemberName}
                        onChange={(e) => setNewCompanyMemberName(e.target.value)}
                        placeholder="E.g. Ahmed (Manager) — or leave blank if no member"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-xs font-medium"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* FINANCIAL COLLECTION DETAILS (COMMON TO BOTH MODES)       */}
          {/* ========================================================= */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign size={14} /> Collection &amp; Financial Details
            </div>

            {/* Grid Layout: Amount, Payment Method, Deposit Account, Branch */}
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
                  max={mode === 'invoice' ? (selectedSale?.remaining || 999999) : 999999}
                  step={0.01}
                  placeholder="E.g. 250.00"
                  value={amount || ''}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm font-bold text-foreground"
                  required
                  disabled={loading || (mode === 'invoice' && !selectedSale)}
                />
              </div>

              {/* Payment Method / Mode */}
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
                  disabled={loading}
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
                  <Wallet size={13} /> Deposit To Account *
                </label>
                <select
                  id="account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-sm font-semibold text-foreground cursor-pointer"
                  disabled={loading}
                >
                  <option value="">-- Select Deposit Account * --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.type === 'cash_drawer' ? '💵' : a.type === 'bank' ? '🏦' : '💳'} {a.name} ({a.balance.toFixed(2)} AED)
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch Selector (In Advance Mode) */}
              {mode === 'advance' && (
                <div className="space-y-1.5 text-xs">
                  <label htmlFor="branch" className="text-muted-foreground font-semibold flex items-center gap-1">
                    <Building2 size={13} /> Target Branch *
                  </label>
                  <select
                    id="branch"
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-sm font-semibold text-foreground cursor-pointer"
                    disabled={loading}
                  >
                    {availableBranches.map(b => (
                      <option key={b.id} value={b.id}>
                        🏢 {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                  placeholder="E.g. Bank Transfer Ref, Card Auth Code, or TxID"
                  value={transactionNo}
                  onChange={(e) => setTransactionNo(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground font-medium"
                  disabled={loading}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5 text-xs">
                <label htmlFor="notes" className="text-muted-foreground font-semibold flex items-center gap-1">
                  <FileText size={13} /> Internal Notes / Remarks
                </label>
                <input
                  id="notes"
                  placeholder={mode === 'advance' ? 'E.g. Advance for employee visa processing...' : 'E.g. Paid in full, bkash fee added...'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground font-medium"
                  disabled={loading}
                />
              </div>
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
              disabled={
                loading || 
                amount <= 0 || 
                (mode === 'invoice' && !selectedSale) ||
                (mode === 'advance' && customerType === 'existing' && !customerId) ||
                (mode === 'advance' && customerType === 'new' && !newCustomerName.trim())
              }
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow-md transition-colors cursor-pointer"
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
              ? 'A new sales invoice will be generated and marked as Paid for this advance collection.'
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
              {
                label: 'New Remaining Balance',
                value: `${Math.max(0, (selectedSale?.remaining ?? 0) - amount).toFixed(2)} AED`
              }
            ] : [
              {
                label: 'Payment Type',
                value: 'Advance Payment (Generates Sales Invoice)',
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
              }
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
