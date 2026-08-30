import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/db';
import type { Service, Customer } from '../../types/database';
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
  Percent,
  ChevronLeft
} from 'lucide-react';

interface CartItem {
  service: Service;
  quantity: number;
  unit_price: number;
  person_name?: string;
  service_date?: string;
  staff_id?: string;
}

export const CreateSale: React.FC = () => {
  const { user, isAdmin, availableBranches } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Master Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

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
  const [branchId, setBranchId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  
  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Initial Payment Toggle
  const [hasInitialPayment, setHasInitialPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Mobile Banking' | 'Bank Transfer'>('Cash');

  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedCustomerRecord = customers.find(c => c.id === customerId);
  const isCompanySelected = customerType === 'existing' 
    ? selectedCustomerRecord?.customer_type === 'company'
    : newCustomerType === 'company';
  const companyEmployees = customerType === 'existing'
    ? (isCompanySelected && selectedCustomerRecord?.members ? selectedCustomerRecord.members : [])
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
        const [c, s, cats] = await Promise.all([
          db.customers.getAll(),
          db.services.getAll(),
          db.serviceCategories.getAll()
        ]);
        setCustomers(c);
        setServices(s.filter(srv => srv.status === 'Active'));
        setCategories(cats);

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

  const handleSelectWalkin = () => {
    const walkin = customers.find(c => c.name.toLowerCase().includes('walk-in') || c.name.toLowerCase().includes('walkin'));
    if (walkin) {
      setCustomerId(walkin.id);
      setCustomerType('existing');
    }
  };

  const filteredCatalogServices = services.filter(s => {
    const matchesCategory = selectedCategory === 'all' || s.category_id === selectedCategory;
    const categoryName = (s as any).category?.name || '';
    const matchesSearch = !serviceSearch.trim() || 
      s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      categoryName.toLowerCase().includes(serviceSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addServiceToCart = (service: Service) => {
    const existingIndex = cart.findIndex(item => item.service.id === service.id && item.person_name === (selectedPersonName || undefined));
    if (existingIndex !== -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { 
        service, 
        quantity: 1, 
        unit_price: service.price, 
        person_name: selectedPersonName || undefined,
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
      setDiscount(0);
      return;
    }
    try {
      const quote = await db.quotations.getById(qId);
      if (!quote) return;

      // Autofill discount, notes, and cart items!
      setDiscount(quote.discount);
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
  const grandTotal = Math.max(0, subtotal - discount);

  // Sync initial payment when total changes
  useEffect(() => {
    if (hasInitialPayment && paymentAmount === 0) {
      setPaymentAmount(grandTotal);
    }
  }, [grandTotal, hasInitialPayment]);

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
    if (discount < 0 || discount > subtotal) {
      setErrorMsg('Invalid discount amount.');
      return;
    }
    if (hasInitialPayment && (paymentAmount <= 0 || paymentAmount > grandTotal)) {
      setErrorMsg('Initial payment must be greater than zero and cannot exceed grand total.');
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
      }

      const total_subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
      const grand_total = Math.max(0, total_subtotal - discount);
      const paidAmount = hasInitialPayment ? Math.min(paymentAmount, grand_total) : 0;

      const createdSale = await db.sales.create({
        customer_id: finalCustomerId || undefined,
        branch_id: branchId,
        discount: discount,
        notes: notes ? `${notes}` : undefined,
        items: cart.map(item => ({
          service_id: item.service.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          person_name: item.person_name || undefined,
          service_date: item.service_date || new Date().toISOString().split('T')[0],
          staff_id: item.staff_id || user?.id
        })),
        initialPayment: paidAmount > 0 ? {
          amount: paidAmount,
          payment_method: paymentMethod
        } : undefined,
        quotation_id: importedQuoteId || undefined
      });

      navigate(`/sales?print=${createdSale.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record sales invoice.');
    } finally {
      setSaving(false);
    }
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
                    <div className="text-[11px] text-muted-foreground">Search and add typing, visa, or document services</div>
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
              <div ref={searchContainerRef} className="relative space-y-2.5">
                <div className="flex gap-2">
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
                </div>

                {/* SEARCH RESULTS DROPDOWN */}
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
              <div className="border border-border/80 rounded-xl overflow-hidden mt-4">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">#</th>
                      <th>Service Details</th>
                      <th className="w-36 text-center">Service Date</th>
                      {isCompanySelected && companyEmployees.length > 0 && <th className="w-44">Person Under Company</th>}
                      <th className="text-center w-28">Quantity</th>
                      <th className="w-24 text-center">Unit Price</th>
                      <th className="text-right w-24">Subtotal</th>
                      <th className="text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={isCompanySelected && companyEmployees.length > 0 ? 8 : 7} className="py-12 text-center text-muted-foreground italic">
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
                        <tr key={index} className="hover:bg-primary/5">
                          <td className="text-center font-bold text-xs text-muted-foreground">
                            {index + 1}
                          </td>
                          <td>
                            <div className="font-bold text-foreground text-xs">{item.service.name}</div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-muted-foreground">
                                Standard: {item.service.price.toFixed(2)} AED
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-semibold border border-primary/20">
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
                          {isCompanySelected && companyEmployees.length > 0 && (
                            <td>
                              <select
                                value={item.person_name || ''}
                                onChange={(e) => {
                                  const updated = [...cart];
                                  updated[index].person_name = e.target.value || undefined;
                                  setCart(updated);
                                }}
                                className="w-full px-2 py-1 bg-muted/50 border border-border rounded text-xs font-semibold text-foreground cursor-pointer"
                              >
                                <option value="">🏢 General Company</option>
                                {companyEmployees.map(emp => (
                                  <option key={emp.id || emp.name} value={emp.name}>
                                    👤 {emp.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )}
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

                {/* Discount */}
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Percent size={12} /> Discount
                  </span>
                  <div className="relative w-28">
                    <input
                      type="number"
                      min={0}
                      max={subtotal}
                      value={discount}
                      onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-2 py-1 text-right bg-background border border-border rounded text-foreground font-bold pr-8 text-xs"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">AED</span>
                  </div>
                </div>

                <div className="border-t border-border pt-2.5 flex justify-between items-center">
                  <span className="font-bold text-foreground text-sm">Grand Total</span>
                  <span className="font-black text-primary text-base">{grandTotal.toFixed(2)} AED</span>
                </div>
              </div>

              {/* Payment Section & Fast Cash Presets */}
              {grandTotal > 0 && (
                <div className="space-y-2.5 border-t border-border pt-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-foreground">
                    <input
                      type="checkbox"
                      checked={hasInitialPayment}
                      onChange={(e) => {
                        setHasInitialPayment(e.target.checked);
                        if (e.target.checked && paymentAmount === 0) {
                          setPaymentAmount(grandTotal);
                        }
                      }}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    Collect Downpayment / Cash Now
                  </label>

                  {hasInitialPayment && (
                    <div className="bg-muted/20 p-3 rounded-xl border border-border space-y-2.5 text-xs">
                      {/* Fast Amount Presets */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setPaymentAmount(grandTotal)}
                          className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold text-[10px] border border-primary/20 hover:bg-primary hover:text-white transition-all cursor-pointer"
                        >
                          Exact (Full)
                        </button>
                        {[50, 100, 200, 500].filter(a => a <= grandTotal).map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setPaymentAmount(amt)}
                            className="px-2 py-0.5 rounded bg-muted hover:bg-secondary text-foreground font-semibold text-[10px] border border-border transition-all cursor-pointer"
                          >
                            {amt} AED
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-muted-foreground font-semibold text-[11px] block mb-1">Method</label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value as any)}
                            className="w-full px-2 py-1.5 bg-popover border border-border rounded-lg text-foreground text-xs font-medium"
                          >
                            <option value="Cash">Cash</option>
                            <option value="Card">Card</option>
                            <option value="Mobile Banking">Mobile Banking</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-muted-foreground font-semibold text-[11px] block mb-1">Paid Amount</label>
                          <input
                            type="number"
                            min={1}
                            max={grandTotal}
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(Math.min(grandTotal, parseFloat(e.target.value) || 0))}
                            className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-foreground text-right font-bold text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Checkout Button */}
              <button
                type="submit"
                disabled={saving || cart.length === 0}
                className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm shadow-md shadow-primary/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {saving ? 'Processing Invoice...' : 'Finalize Sale & Checkout'}
              </button>

            </div>
          </div>

        </form>

      </div>
    </PermissionGuard>
  );
};
