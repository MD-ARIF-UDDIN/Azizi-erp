import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/db';
import type { Service, Customer, Account } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ReceiptText,
  Search,
  X,
  Plus,
  Minus,
  Trash2,
  User,
  Building,
  Building2,
  Users,
  FileText,
  ChevronLeft,
  Coins,
  AlertCircle
} from 'lucide-react';

interface CartItem {
  service: Service;
  quantity: number;
  unit_price: number;
  person_name?: string;
  service_date?: string;
  staff_id?: string;
  notes?: string;
}

export const CreateSale: React.FC = () => {
  const { user, isAdmin, availableBranches } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Master Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Catalog Search & Category Filter
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [customerType, setCustomerType] = useState<'existing' | 'new'>('existing');
  const [customerId, setCustomerId] = useState('');
  const [newCustomerType, setNewCustomerType] = useState<'individual' | 'company'>('individual');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCompanyMembers, setNewCompanyMembers] = useState<{ id?: string; name: string; phone?: string; email?: string }[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberForExisting, setNewMemberForExisting] = useState('');
  const [branchId, setBranchId] = useState('');
  const [notes, setNotes] = useState('');
  
  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Advance Payment Modal States (Asked after invoice creation)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceEntries, setAdvanceEntries] = useState<{
    saleId: string;
    invoiceNo: string;
    memberName: string;
    grandTotal: number;
    amount: number;
    paymentMethod: 'Cash' | 'Card' | 'Bank Transfer' | 'Mobile Banking';
    accountId: string;
    notes: string;
  }[]>([]);
  const [createdSaleIds, setCreatedSaleIds] = useState<string[]>([]);
  const [savingAdvance, setSavingAdvance] = useState(false);

  // Floating Toast State
  const [toast, setToast] = useState<{ message: string; type: 'warning' | 'error' | 'success'; id: number } | null>(null);
  const toastTimerRef = useRef<any>(null);

  const showToast = (message: string, type: 'warning' | 'error' | 'success' = 'warning') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const id = Date.now();
    setToast({ message, type, id });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedCustomer = customers.find(c => c.id === customerId);
  const selectedCustomerRecord = selectedCustomer;
  const isCompanySelected = customerType === 'existing' 
    ? selectedCustomer?.customer_type === 'company'
    : newCustomerType === 'company';
  const companyEmployees = customerType === 'existing'
    ? (selectedCustomer?.members || [])
    : (newCustomerType === 'company' ? newCompanyMembers : []);

  const [selectedPersonName, setSelectedPersonName] = useState<string>(searchParams.get('person_name') || '');
  const [availableQuotes, setAvailableQuotes] = useState<any[]>([]);
  const [importedQuoteId, setImportedQuoteId] = useState<string>('');

  useEffect(() => {
    setCart([]);
    setImportedQuoteId('');
    setSelectedPersonName(searchParams.get('person_name') || '');
  }, [customerId, customerType, newCustomerType]);

  useEffect(() => {
    const fetchQuotesForCustomer = async () => {
      if (!customerId) {
        setAvailableQuotes([]);
        return;
      }
      try {
        const qData = await db.quotations.getAll();
        const filtered = qData.filter(q => 
          q.status !== 'Converted' && 
          q.customer_id === customerId
        );
        setAvailableQuotes(filtered);
      } catch (err) {
        console.error(err);
      }
    };
    fetchQuotesForCustomer();
  }, [customerId]);

  useEffect(() => {
    const init = async () => {
      try {
        const [c, s, cats, accs] = await Promise.all([
          db.customers.getAll(),
          db.services.getAll(),
          db.serviceCategories.getAll(),
          db.accounts.getAll()
        ]);
        setCustomers(c);
        setServices(s.filter(srv => srv.status === 'Active'));
        setCategories(cats);
        setAccounts(accs);

        const paramCustId = searchParams.get('customer_id');
        if (paramCustId) {
          const match = c.find(item => item.id === paramCustId);
          if (match) {
            setCustomerId(match.id);
            setCustomerType('existing');
          }
        }

        if (user && user.branch_id) {
          setBranchId(user.branch_id);
        } else if (availableBranches.length > 0) {
          setBranchId(availableBranches[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, [user, availableBranches, searchParams]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleQuickSelectWalkIn = () => {
    const walkin = customers.find(c => c.name.toLowerCase().includes('walk-in') || c.name.toLowerCase().includes('walkin') || c.name.toLowerCase().includes('walk in'));
    if (walkin) {
      setCustomerId(walkin.id);
      setCustomerType('existing');
    } else {
      setCustomerType('new');
      setNewCustomerType('individual');
      setNewCustomerName('Walk-In Customer');
    }
    setErrorMsg('');
  };
  const handleSelectWalkin = handleQuickSelectWalkIn;

  const filteredCatalogServices = services.filter(s => {
    const matchesCategory = selectedCategory === 'all' || s.category_id === selectedCategory;
    const categoryName = (s as any).category?.name || '';
    const matchesSearch = !serviceSearch.trim() || 
      s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      categoryName.toLowerCase().includes(serviceSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handlePersonChange = (name: string) => {
    setSelectedPersonName(name);
    setCart(prev => prev.map(item => ({
      ...item,
      person_name: name.trim() || undefined
    })));
  };

  const handleAddMemberToExisting = async () => {
    if (!newMemberForExisting.trim() || !selectedCustomer) return;
    const memberName = newMemberForExisting.trim();
    const existingMembers = selectedCustomer.members || [];
    if (existingMembers.some(m => m.name.toLowerCase() === memberName.toLowerCase())) {
      handlePersonChange(memberName);
      setNewMemberForExisting('');
      return;
    }
    const updatedMembers = [
      ...existingMembers,
      { id: crypto.randomUUID(), name: memberName }
    ];
    try {
      await db.customers.update(selectedCustomer.id, {
        members: updatedMembers,
        customer_type: 'company'
      });
      setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, members: updatedMembers, customer_type: 'company' } : c));
      handlePersonChange(memberName);
      setNewMemberForExisting('');
      showToast(`Added ${memberName} as member`, 'success');
    } catch (err) {
      console.error('Failed to add member to existing customer:', err);
    }
  };

  const addServiceToCart = (service: Service) => {
    const hasSelectedCustomer = (customerType === 'existing' && !!customerId) || (customerType === 'new' && !!newCustomerName.trim());
    if (!hasSelectedCustomer) {
      showToast('Please select a customer first.', 'warning');
      return;
    }

    const assignedPerson = selectedPersonName.trim() || undefined;
    const existingIndex = cart.findIndex(item => item.service.id === service.id && item.person_name === assignedPerson);
    if (existingIndex !== -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { 
        service, 
        quantity: 1, 
        unit_price: service.price, 
        person_name: assignedPerson,
        service_date: new Date().toISOString().split('T')[0],
        staff_id: user?.id
      }]);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSearchOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsSearchOpen(true);
      return;
    }
    if (filteredCatalogServices.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev + 1) % filteredCatalogServices.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev - 1 + filteredCatalogServices.length) % filteredCatalogServices.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetService = filteredCatalogServices[highlightIndex] || filteredCatalogServices[0];
      if (targetService) {
        addServiceToCart(targetService);
        setServiceSearch('');
        setIsSearchOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
      searchInputRef.current?.blur();
    }
  };

  const handleImportQuotation = async (qId: string) => {
    if (!qId) {
      setImportedQuoteId('');
      setCart([]);
      return;
    }
    try {
      const quote = await db.quotations.getById(qId);
      if (!quote) return;

      // Autofill notes and cart items!
      setNotes(quote.notes ? `Imported from Quotation #${quote.quotation_no}. ${quote.notes}` : `Imported from Quotation #${quote.quotation_no}.`);
      
      const loadedServices = await db.services.getAll();
      const quoteItems = quote.items || [];
      
      const newCart = quoteItems.map((qi: any) => {
        const srv = loadedServices.find(s => s.id === qi.service_id);
        return {
          service: srv || { id: qi.service_id, name: 'Service', price: qi.unit_price } as any,
          quantity: qi.quantity,
          unit_price: qi.unit_price,
          person_name: selectedPersonName || undefined,
          service_date: qi.service_date || new Date().toISOString().split('T')[0],
          staff_id: user?.id
        };
      });

      setCart(newCart);
      setImportedQuoteId(qId);
    } catch (err) {
      console.error(err);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...cart];
    const newQty = updated[index].quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].quantity = newQty;
    }
    setCart(updated);
  };

  const updatePriceOverride = (index: number, newPrice: number) => {
    if (newPrice < 0) return;
    const updated = [...cart];
    updated[index].unit_price = newPrice;
    setCart(updated);
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const grandTotal = subtotal;

  // Memoized Member Groups with Proportionate Grand Total
  const memberGroups = React.useMemo(() => {
    const map = new Map<string, { memberKey: string; displayName: string; items: CartItem[]; subtotal: number; grandTotal: number }>();
    
    cart.forEach(item => {
      const key = (item.person_name || '').trim();
      if (!map.has(key)) {
        map.set(key, {
          memberKey: key,
          displayName: key || (customerType === 'existing' && selectedCustomerRecord?.name ? `${selectedCustomerRecord.name} (General)` : 'General / Main'),
          items: [],
          subtotal: 0,
          grandTotal: 0
        });
      }
      const group = map.get(key)!;
      group.items.push(item);
      group.subtotal += item.unit_price * item.quantity;
      group.grandTotal = group.subtotal;
    });

    return Array.from(map.values());
  }, [cart, customerType, selectedCustomerRecord]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      setErrorMsg('Please select a branch.');
      return;
    }
    if (cart.length === 0) {
      setErrorMsg('Please add at least one service item to the cart.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      let finalCustomerId = customerId;
      if (customerType === 'new') {
        if (!newCustomerName.trim()) {
          setErrorMsg(newCustomerType === 'company' ? 'Company name is required.' : 'Customer name is required.');
          setSaving(false);
          return;
        }
        const custPayload: any = {
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || undefined,
          email: newCustomerEmail.trim() || undefined,
          address: newCustomerAddress.trim() || undefined,
          notes: 'Registered via billing counter.',
          customer_type: newCustomerType
        };
        if (newCustomerType === 'company') {
          custPayload.members = newCompanyMembers.filter(m => m.name.trim()).map(m => ({
            id: m.id || crypto.randomUUID(),
            name: m.name.trim(),
            phone: m.phone?.trim() || undefined,
            email: m.email?.trim() || undefined
          }));
        }
        const createdCust = await db.customers.create(custPayload);
        finalCustomerId = createdCust.id;
      } else if (customerType === 'existing' && finalCustomerId) {
        // Auto-save any newly typed or assigned person names into the existing customer's members list
        const existingCust = customers.find(c => c.id === finalCustomerId);
        if (existingCust) {
          const existingMembers = existingCust.members || [];
          const existingNames = new Set(existingMembers.map(m => m.name.toLowerCase().trim()));
          const newNames = Array.from(new Set(
            cart.map(item => item.person_name?.trim()).filter(Boolean) as string[]
          )).filter(name => !existingNames.has(name.toLowerCase()));

          if (newNames.length > 0) {
            const updatedMembers = [
              ...existingMembers,
              ...newNames.map(name => ({ id: crypto.randomUUID(), name }))
            ];
            await db.customers.update(finalCustomerId, {
              members: updatedMembers,
              customer_type: 'company'
            });
            setCustomers(prev => prev.map(c => c.id === finalCustomerId ? { ...c, members: updatedMembers, customer_type: 'company' } : c));
          }
        }
      }

      const createdSales: any[] = [];

      for (const group of memberGroups) {
        const createdSale = await db.sales.create({
          customer_id: finalCustomerId || undefined,
          branch_id: branchId,
          discount: 0,
          notes: notes ? `${notes}` : undefined,
          person_name: group.memberKey || undefined,
          items: group.items.map(item => ({
            service_id: item.service.id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            person_name: group.memberKey || undefined,
            service_date: item.service_date || new Date().toISOString().split('T')[0],
            staff_id: item.staff_id || user?.id,
            notes: item.notes || undefined
          })),
          quotation_id: importedQuoteId || undefined
        });

        createdSales.push(createdSale);
      }

      // Initialize advance payment items for the modal
      const defaultDrawer = accounts.find(a => a.type === 'cash_drawer') || accounts[0];
      const entries = createdSales.map((s, idx) => ({
        saleId: s.id,
        invoiceNo: s.invoice_no,
        memberName: s.person_name || memberGroups[idx]?.displayName || 'General',
        grandTotal: Number(s.grand_total || 0),
        amount: 0,
        paymentMethod: 'Cash' as const,
        accountId: defaultDrawer?.id || '',
        notes: ''
      }));

      setAdvanceEntries(entries);
      setCreatedSaleIds(createdSales.map(s => s.id));
      setShowAdvanceModal(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record sales invoice.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdvance = async () => {
    setSavingAdvance(true);
    try {
      for (const entry of advanceEntries) {
        if (entry.amount > 0) {
          if (!entry.accountId) {
            setErrorMsg(`Deposit To Account is mandatory. Please select an account for invoice #${entry.invoiceNo}`);
            setSavingAdvance(false);
            return;
          }
          await db.payments.create({
            sale_id: entry.saleId,
            amount: entry.amount,
            payment_method: entry.paymentMethod || 'Cash',
            account_id: entry.accountId,
            person_name: entry.memberName || undefined,
            notes: entry.notes ? entry.notes.trim() : undefined
          });
        }
      }
      setShowAdvanceModal(false);
      navigate(`/sales?created_count=${createdSaleIds.length}&print=${createdSaleIds[0]}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save advance payments.');
    } finally {
      setSavingAdvance(false);
    }
  };

  const handleSkipAdvance = () => {
    setShowAdvanceModal(false);
    navigate(`/sales?created_count=${createdSaleIds.length}&print=${createdSaleIds[0]}`);
  };

  return (
    <PermissionGuard permission="Sales.Create" fallback="ui">
      <div className="space-y-6">
        
        {/* TOP BAR */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sales')}
            className="p-2 border border-border bg-muted/30 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Invoices</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Create</h1>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl text-center font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* LEFT SECTION: SERVICES SEARCH & INVOICE ITEMS (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass border border-border rounded-2xl p-5 space-y-4 shadow-xl">
              
              {/* HEADER WITH STATS */}
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <ReceiptText size={18} />
                  </div>
                  <div>
                    <h2 className="font-bold text-foreground text-base m-0">Invoice Line Items</h2>
                  </div>
                </div>
                {cart.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {cart.length} {cart.length === 1 ? 'item' : 'items'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>

              {/* SEARCH-WISE SERVICE SELECTOR */}
              <div ref={searchContainerRef} className="space-y-2.5">
                <div className="flex gap-2 relative">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Type to search service (e.g. Visa, Emirates ID, Stamp, MOHRE...)"
                      value={serviceSearch}
                      onFocus={() => setIsSearchOpen(true)}
                      onChange={(e) => {
                        setServiceSearch(e.target.value);
                        setIsSearchOpen(true);
                        setHighlightIndex(0);
                      }}
                      onKeyDown={handleSearchKeyDown}
                      className="w-full pl-10 pr-10 py-2.5 bg-background border-2 border-border focus:border-primary rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground shadow-xs transition-all outline-none"
                    />
                    {serviceSearch ? (
                      <button
                        type="button"
                        onClick={() => {
                          setServiceSearch('');
                          searchInputRef.current?.focus();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    ) : (
                      <kbd className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-muted/60 text-muted-foreground">
                        /
                      </kbd>
                    )}
                  </div>

                  {/* Category Filter Dropdown */}
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold text-foreground cursor-pointer shrink-0 max-w-[160px]"
                  >
                    <option value="all">All Categories ({services.length})</option>
                    {categories.map(cat => {
                      const count = services.filter(s => s.category_id === cat.id).length;
                      if (count === 0) return null;
                      return (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({count})
                        </option>
                      );
                    })}
                  </select>

                  {/* SEARCH RESULTS DROPDOWN (Directly below search input bar) */}
                  {isSearchOpen && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
                      {filteredCatalogServices.length > 0 ? (
                        <div className="divide-y divide-border/60">
                          <div className="px-3.5 py-1.5 bg-muted/50 text-[11px] font-semibold text-muted-foreground flex justify-between items-center">
                            <span>{filteredCatalogServices.length} matching services</span>
                            <span className="text-[10px]">Use ↑↓ to navigate • ↵ Enter to add</span>
                          </div>
                          {filteredCatalogServices.map((service, idx) => {
                            const cartItem = cart.find(item => item.service.id === service.id && item.person_name === (selectedPersonName || undefined));
                            const inCart = !!cartItem;
                            const isHighlighted = idx === highlightIndex;
                            const catName = categories.find(c => c.id === service.category_id)?.name || (service as any).category?.name || '';

                            return (
                              <div
                                key={service.id}
                                onMouseEnter={() => setHighlightIndex(idx)}
                                onClick={() => {
                                  addServiceToCart(service);
                                  setServiceSearch('');
                                  setIsSearchOpen(false);
                                  searchInputRef.current?.focus();
                                }}
                                className={`px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                  isHighlighted ? 'bg-primary/10' : 'hover:bg-muted/50'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-bold text-xs text-foreground truncate">{service.name}</span>
                                    {catName && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border shrink-0">
                                        {catName}
                                      </span>
                                    )}
                                    {inCart && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/15 text-primary border border-primary/30 shrink-0">
                                        {cartItem.quantity} in bill
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="text-right">
                                    <span className="font-extrabold text-foreground text-sm">{service.price.toFixed(2)}</span>
                                    <span className="text-[10px] text-muted-foreground font-medium ml-1">AED</span>
                                  </div>
                                  <button
                                    type="button"
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                      isHighlighted || inCart
                                        ? 'bg-primary text-white shadow-xs'
                                        : 'bg-muted/70 text-foreground hover:bg-primary hover:text-white'
                                    }`}
                                  >
                                    <Plus size={13} />
                                    <span>Add</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-muted-foreground text-xs">
                          <div className="mb-1 text-sm font-semibold text-foreground">No services found</div>
                          <div>No service matches "<span className="text-primary font-bold">{serviceSearch}</span>". Try another keyword.</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* QUICK ADD FREQUENT CHIPS */}
                {!serviceSearch && services.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[11px] font-bold text-muted-foreground mr-1">
                      Quick Add:
                    </span>
                    {services.slice(0, 5).map(service => {
                      const inCart = cart.some(i => i.service.id === service.id);
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => addServiceToCart(service)}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                            inCart
                              ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                              : 'border-border bg-muted/30 hover:bg-muted hover:border-primary/40 text-foreground'
                          }`}
                        >
                          <span>{service.name}</span>
                          <span className="text-[10px] opacity-75 font-bold">({service.price.toFixed(0)} AED)</span>
                          <Plus size={11} className="text-primary" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* INVOICE LINE ITEMS TABLE */}
              <div className="border border-border/80 rounded-xl overflow-hidden mt-4 shadow-2xs">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">#</th>
                      <th>Service Details</th>
                      <th className="w-32 text-center">Service Date</th>
                      <th className="w-40">Member / Person</th>
                      <th className="w-44">Note / Remarks</th>
                      <th className="text-center w-28">Quantity</th>
                      <th className="w-24 text-center">Unit Price</th>
                      <th className="text-right w-24">Subtotal</th>
                      <th className="text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-muted-foreground italic">
                          <div className="max-w-xs mx-auto space-y-2">
                            <div className="p-3 rounded-full bg-muted/60 w-fit mx-auto text-muted-foreground">
                              <Search size={22} />
                            </div>
                            <div className="text-xs font-semibold text-foreground">No services added yet</div>
                            <div className="text-[11px] text-muted-foreground">Use the search bar above or click a Quick Add tag to add services to this invoice.</div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      cart.map((item, index) => (
                        <tr key={index} className="hover:bg-primary/5 transition-colors">
                          <td className="text-center font-bold text-xs text-muted-foreground">
                            {index + 1}
                          </td>
                          <td>
                            <div className="font-bold text-foreground text-xs">{item.service.name}</div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-muted-foreground">
                                Standard: {item.service.price.toFixed(2)} AED
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold border border-border">
                                Staff: {user?.name || 'Current Staff'}
                              </span>
                            </div>
                          </td>
                          <td className="text-center">
                            <input
                              type="date"
                              value={item.service_date || new Date().toISOString().split('T')[0]}
                              onChange={(e) => {
                                const updated = [...cart];
                                updated[index].service_date = e.target.value;
                                setCart(updated);
                              }}
                              className="px-2 py-1 bg-muted/50 border border-border rounded text-xs font-semibold text-foreground cursor-pointer"
                            />
                          </td>
                          <td>
                            {isCompanySelected && companyEmployees.length > 0 ? (
                              <select
                                value={item.person_name || ''}
                                onChange={(e) => {
                                  const updated = [...cart];
                                  updated[index].person_name = e.target.value || undefined;
                                  setCart(updated);
                                }}
                                className="w-full px-2 py-1 bg-muted/50 border border-border rounded text-xs font-semibold text-foreground cursor-pointer"
                              >
                                <option value="">🏢 General / Company</option>
                                {companyEmployees.map((emp: any, idx: number) => (
                                  <option key={emp.id || idx} value={emp.name}>
                                    👤 {emp.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                placeholder="Person / Member Name"
                                value={item.person_name || ''}
                                onChange={(e) => {
                                  const updated = [...cart];
                                  updated[index].person_name = e.target.value || undefined;
                                  setCart(updated);
                                }}
                                className="w-full px-2 py-1 bg-muted/50 border border-border rounded text-xs font-medium text-foreground"
                              />
                            )}
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="Note / Ref..."
                              value={item.notes || ''}
                              onChange={(e) => {
                                const updated = [...cart];
                                updated[index].notes = e.target.value;
                                setCart(updated);
                              }}
                              className="w-full px-2 py-1 bg-muted/50 border border-border rounded text-xs font-medium text-foreground placeholder:text-muted-foreground outline-none"
                            />
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, -1)}
                                className="h-6 w-6 rounded border border-border bg-muted/50 flex items-center justify-center hover:bg-secondary transition-colors cursor-pointer"
                              >
                                <Minus size={11} />
                              </button>
                              <span className="font-bold text-xs w-6 text-center text-foreground">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, 1)}
                                className="h-6 w-6 rounded border border-border bg-muted/50 flex items-center justify-center hover:bg-secondary transition-colors cursor-pointer"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                          </td>
                          <td className="text-center">
                            <input
                              type="number"
                              min={0}
                              value={item.unit_price}
                              onChange={(e) => updatePriceOverride(index, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 bg-muted/50 border border-border rounded text-center text-xs font-bold text-foreground"
                            />
                          </td>
                          <td className="text-right font-black text-foreground text-xs">
                            {(item.unit_price * item.quantity).toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">AED</span>
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              onClick={() => updateQuantity(index, -item.quantity)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
                              title="Remove line item"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>

          </div>

          {/* RIGHT SECTION: CUSTOMER, TOTALS & CHECKOUT (1 col) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass border border-border rounded-2xl p-5 space-y-4 shadow-xl">
              
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <h3 className="font-bold text-foreground text-sm m-0">Customer & Billing</h3>
                <button
                  type="button"
                  onClick={handleSelectWalkin}
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Walk-in Customer (1-Click)
                </button>
              </div>

              {/* Customer Type Selector */}
              <div className="flex rounded-lg bg-muted/50 p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setCustomerType('existing')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    customerType === 'existing'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Existing Customer
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerType('new')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    customerType === 'new'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  New Customer
                </button>
              </div>

              {/* Customer input fields */}
              {customerType === 'existing' ? (
                <div className="space-y-1.5 text-xs">
                  <label className="text-muted-foreground font-semibold flex items-center gap-1">
                    <User size={13} /> Select Customer Profile *
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground text-xs font-medium"
                    required={customerType === 'existing'}
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.customer_type === 'company' ? `${c.name} (Company)` : c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>

                  {selectedCustomer && (
                    <div className="mt-2.5 p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground flex items-center gap-1">
                          <Users size={12} className="text-primary" />
                          <span>Persons / Members ({companyEmployees.length})</span>
                        </span>
                      </div>

                      {/* Add new member to this customer inline */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <input
                          type="text"
                          placeholder="Add new person / member..."
                          value={newMemberForExisting}
                          onChange={(e) => setNewMemberForExisting(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddMemberToExisting();
                            }
                          }}
                          className="flex-1 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-medium text-foreground outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddMemberToExisting}
                          disabled={!newMemberForExisting.trim()}
                          className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold text-xs transition-all cursor-pointer shrink-0"
                        >
                          + Add
                        </button>
                      </div>

                      {companyEmployees.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto">
                          {companyEmployees.map((emp: any, idx: number) => (
                            <span
                              key={emp.id || idx}
                              onClick={() => handlePersonChange(emp.name)}
                              className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border cursor-pointer transition-all ${
                                selectedPersonName === emp.name
                                  ? 'bg-primary text-white border-primary shadow-xs'
                                  : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                              }`}
                              title="Click to assign to active line items"
                            >
                              👤 {emp.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {availableQuotes.length > 0 && (
                    <div className="space-y-1.5 text-xs mt-3 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                      <label className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                        <FileText size={13} /> Link Open Quotation
                      </label>
                      <select
                        value={importedQuoteId}
                        onChange={(e) => handleImportQuotation(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-card hover:bg-muted border border-border rounded-lg text-foreground text-xs font-semibold cursor-pointer"
                      >
                        <option value="">-- Direct Sale (No Quote) --</option>
                        {availableQuotes.map(q => (
                          <option key={q.id} value={q.id}>
                            #{q.quotation_no} - {q.grand_total.toFixed(2)} AED ({q.status})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-medium leading-tight">
                        Importing quotation auto-fills services, discount, and customer info.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 border border-border p-3.5 rounded-xl bg-slate-50">
                  {/* Company vs Individual Toggle */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-black font-bold uppercase tracking-wider">Account Type *</label>
                    <div className="flex rounded-lg bg-white p-0.5 border border-slate-200 gap-1">
                      <button
                        type="button"
                        onClick={() => setNewCustomerType('individual')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                          newCustomerType === 'individual'
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-slate-600 hover:text-black'
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
                            : 'text-slate-600 hover:text-black'
                        }`}
                      >
                        <Building2 size={13} /> Company
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="text-black font-semibold">
                      {newCustomerType === 'company' ? 'Company / Trade Name *' : 'Full Name *'}
                    </label>
                    <input
                      type="text"
                      required={customerType === 'new'}
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder={newCustomerType === 'company' ? 'E.g. Al Safa Transport LLC' : 'E.g. Mohammed Ali'}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-black text-xs font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1 text-xs">
                      <label className="text-black font-semibold">Phone Number</label>
                      <input
                        type="text"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="+971 50 000 0000"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-black text-xs font-medium"
                      />
                    </div>
                    <div className="space-y-1 text-xs">
                      <label className="text-black font-semibold">Email</label>
                      <input
                        type="email"
                        value={newCustomerEmail}
                        onChange={(e) => setNewCustomerEmail(e.target.value)}
                        placeholder="info@domain.com"
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-black text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="text-black font-semibold">Address / Office Location</label>
                    <input
                      type="text"
                      value={newCustomerAddress}
                      onChange={(e) => setNewCustomerAddress(e.target.value)}
                      placeholder="Dubai, UAE / Office No."
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-black text-xs font-medium"
                    />
                  </div>

                  {/* Company Staff / Members Section */}
                  {newCustomerType === 'company' && (
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-black flex items-center gap-1">
                          <Users size={12} className="text-primary" />
                          <span>Persons / Staff Under Company</span>
                        </label>
                        <span className="text-[10px] text-slate-500 font-semibold">{newCompanyMembers.length} added</span>
                      </div>

                      {/* Add Person Inline Bar */}
                      <div className="space-y-1.5 bg-white p-2 rounded-lg border border-slate-200">
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="text"
                            placeholder="Person / Employee Name"
                            value={newMemberName}
                            onChange={(e) => setNewMemberName(e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-black text-xs font-medium"
                          />
                          <input
                            type="text"
                            placeholder="Phone (Optional)"
                            value={newMemberPhone}
                            onChange={(e) => setNewMemberPhone(e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-black text-xs font-medium"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newMemberName.trim()) return;
                            setNewCompanyMembers([...newCompanyMembers, {
                              id: crypto.randomUUID(),
                              name: newMemberName.trim(),
                              phone: newMemberPhone.trim() || undefined
                            }]);
                            setNewMemberName('');
                            setNewMemberPhone('');
                          }}
                          className="w-full py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold rounded text-xs transition-colors flex items-center justify-center gap-1 border border-sky-200 cursor-pointer"
                        >
                          <Plus size={12} /> Add Person
                        </button>
                      </div>

                      {/* List of Added Members */}
                      {newCompanyMembers.length > 0 && (
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                          {newCompanyMembers.map((m, idx) => (
                            <div key={m.id || idx} className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200 text-xs">
                              <div className="truncate">
                                <span className="font-bold text-black">{m.name}</span>
                                {m.phone && <span className="text-[10px] text-slate-500 ml-1.5">({m.phone})</span>}
                              </div>
                              <button
                                type="button"
                                onClick={() => setNewCompanyMembers(newCompanyMembers.filter((_, i) => i !== idx))}
                                className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
                                title="Remove Person"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MEMBER / APPLICANT AUTO-ASSIGN FOR QUICK SEARCH */}
              {(customerId || customerType === 'new') && (
                <div className="space-y-1.5 p-3 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                      <User size={13} className="text-primary" />
                      <span>Default Member for Adding Services</span>
                    </label>
                    <span className="text-[9px] font-semibold text-muted-foreground">Quick Select</span>
                  </div>

                  {isCompanySelected && companyEmployees.length > 0 ? (
                    <div className="space-y-1.5">
                      <select
                        value={selectedPersonName}
                        onChange={(e) => setSelectedPersonName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-popover border border-border rounded-lg text-foreground text-xs font-semibold cursor-pointer"
                      >
                        <option value="">🏢 General / Main Company</option>
                        {companyEmployees.map((emp, idx) => (
                          <option key={emp.id || idx} value={emp.name}>
                            👤 {emp.name} {emp.phone ? `(${emp.phone})` : ''}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Or custom member name"
                        value={selectedPersonName}
                        onChange={(e) => setSelectedPersonName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-foreground text-xs font-medium"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="Applicant / Person Name"
                      value={selectedPersonName}
                      onChange={(e) => setSelectedPersonName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-foreground text-xs font-medium"
                    />
                  )}
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Each member in the cart will automatically get a separate invoice generated upon checkout.
                  </p>
                </div>
              )}

              {/* Destination Branch */}
              <div className="space-y-1 text-xs">
                <label className="text-muted-foreground font-semibold flex items-center gap-1">
                  <Building size={13} /> Branch *
                </label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-1.5 bg-popover border border-border rounded-lg text-foreground text-xs font-medium disabled:opacity-75 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">-- Select Branch --</option>
                  {availableBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Totals Summary Panel */}
              <div className="bg-muted/30 p-3.5 rounded-xl border border-border space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-bold text-foreground">{subtotal.toFixed(2)} AED</span>
                </div>

                <div className="border-t border-border pt-2 flex justify-between items-center">
                  <span className="font-bold text-foreground text-sm">Grand Total</span>
                  <span className="font-black text-primary text-base">{grandTotal.toFixed(2)} AED</span>
                </div>
              </div>

              {/* Submit Checkout Button */}
              {(() => {
                const distinctMembersCount = memberGroups.length;
                return (
                  <button
                    type="submit"
                    disabled={saving || cart.length === 0}
                    className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm shadow-md shadow-primary/20 flex items-center justify-center gap-2 transition-all cursor-pointer mt-3"
                  >
                    {saving
                      ? 'Generating Invoices...'
                      : distinctMembersCount > 1
                      ? `Generate ${distinctMembersCount} Separate Invoices`
                      : 'Finalize Sale & Generate Invoice'}
                  </button>
                );
              })()}

            </div>
          </div>

        </form>

        {/* ── ADVANCE / DOWN PAYMENT MODAL (TRIGGERED AFTER INVOICE CREATION) ── */}
        {showAdvanceModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="p-5 border-b border-border bg-muted/20 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <Coins size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Any Advance / Down Payment Received?
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {advanceEntries.length > 1
                        ? `${advanceEntries.length} Invoices created successfully. Record advance payments per member/invoice or skip.`
                        : 'Invoice created successfully. Record advance payment with note, or skip to proceed.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Body: List of invoices / members */}
              <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
                {advanceEntries.map((entry, idx) => (
                  <div key={entry.saleId} className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                    
                    {/* Invoice & Member Title */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-background border border-border text-foreground">
                          #{entry.invoiceNo}
                        </span>
                        <span className="font-bold text-xs text-foreground">
                          👤 {entry.memberName}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-muted-foreground">
                        Total Due: <strong className="text-foreground">{entry.grandTotal.toFixed(2)} AED</strong>
                      </div>
                    </div>

                    {/* Payment Inputs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                      
                      {/* Advance Amount */}
                      <div className="sm:col-span-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Advance Paid (AED)
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...advanceEntries];
                                updated[idx].amount = entry.grandTotal;
                                setAdvanceEntries(updated);
                              }}
                              className="text-[9px] font-bold text-primary hover:underline cursor-pointer"
                            >
                              Full
                            </button>
                            <span className="text-[9px] text-muted-foreground">|</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...advanceEntries];
                                updated[idx].amount = 0;
                                setAdvanceEntries(updated);
                              }}
                              className="text-[9px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              0
                            </button>
                          </div>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={entry.grandTotal}
                          step={0.01}
                          placeholder="0.00"
                          value={entry.amount || ''}
                          onChange={(e) => {
                            const val = Math.min(entry.grandTotal, parseFloat(e.target.value) || 0);
                            const updated = [...advanceEntries];
                            updated[idx].amount = val;
                            setAdvanceEntries(updated);
                          }}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-bold text-foreground text-right"
                        />
                      </div>

                      {/* Payment Mode */}
                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Payment Mode
                        </label>
                        <select
                          value={entry.paymentMethod}
                          onChange={(e) => {
                            const updated = [...advanceEntries];
                            updated[idx].paymentMethod = e.target.value as any;
                            setAdvanceEntries(updated);
                          }}
                          className="w-full px-2.5 py-2 bg-background border border-border rounded-lg text-xs font-bold text-foreground cursor-pointer"
                        >
                          <option value="Cash">💵 Cash</option>
                          <option value="Card">💳 Card</option>
                          <option value="Bank Transfer">🏦 Bank Transfer</option>
                          <option value="Mobile Banking">📱 Mobile Banking</option>
                        </select>
                      </div>

                      {/* Deposit To Account */}
                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Deposit To Account *
                        </label>
                        <select
                          value={entry.accountId}
                          onChange={(e) => {
                            const updated = [...advanceEntries];
                            updated[idx].accountId = e.target.value;
                            setAdvanceEntries(updated);
                          }}
                          required
                          className="w-full px-2.5 py-2 bg-background border border-border rounded-lg text-xs font-bold text-foreground cursor-pointer"
                        >
                          <option value="">-- Select Account * --</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.type === 'cash_drawer' ? '💵' : a.type === 'bank' ? '🏦' : '💳'} {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Note / Remarks Column */}
                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <FileText size={11} />
                          <span>Payment Note / Ref</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Receipt ref, bank slip, remarks..."
                          value={entry.notes}
                          onChange={(e) => {
                            const updated = [...advanceEntries];
                            updated[idx].notes = e.target.value;
                            setAdvanceEntries(updated);
                          }}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-medium text-foreground"
                        />
                      </div>

                    </div>
                  </div>
                ))}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleSkipAdvance}
                  disabled={savingAdvance}
                  className="px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  Skip (No Advance)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveAdvance}
                    disabled={savingAdvance}
                    className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Coins size={14} />
                    <span>{savingAdvance ? 'Saving Payments...' : 'Save Payment & Continue'}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* FLOATING TOAST NOTIFICATION (BOTTOM THEMED WITH RED CIRCLE) */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200 pointer-events-auto">
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border border-primary/30 bg-card/95 text-foreground backdrop-blur-xl ring-1 ring-primary/20">
              <div className="w-7 h-7 rounded-full bg-red-500/15 text-red-500 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertCircle size={16} />
              </div>
              <span className="text-xs font-bold text-foreground">
                {toast.message}
              </span>
              <button
                type="button"
                onClick={() => {
                  handleQuickSelectWalkIn();
                  setToast(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-md shadow-primary/25 transition-all cursor-pointer shrink-0 ml-1"
              >
                Select Walk-In
              </button>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer shrink-0 ml-0.5"
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

      </div>
    </PermissionGuard>
  );
};
