import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { Service, Customer, TermsConditions } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  User,
  Building2,
  Users,
  FileText,
  Percent,
  ChevronLeft,
  Calendar
} from 'lucide-react';

interface CartItem {
  service: Service;
  quantity: number;
  unit_price: number;
  assigned_customer_id?: string;
}

export const CreateQuotation: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Master Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);

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
  const [validUntil, setValidUntil] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [termsList, setTermsList] = useState<TermsConditions[]>([]);
  const [selectedTermIds, setSelectedTermIds] = useState<string[]>([]);

  const selectedCustomerRecord = customers.find(c => c.id === customerId);
  const isCompanySelected = customerType === 'existing'
    ? selectedCustomerRecord?.customer_type === 'company'
    : newCustomerType === 'company';
  const companyEmployees = customerType === 'existing'
    ? (isCompanySelected && selectedCustomerRecord?.members ? selectedCustomerRecord.members : [])
    : (newCustomerType === 'company' ? newCompanyMembers : []);

  useEffect(() => {
    setCart([]);
  }, [customerId, customerType, newCustomerType]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const cData = await db.customers.getAll();
        const sData = await db.services.getAll();
        
        setCustomers(cData);
        setServices(sData.filter(s => s.status === 'Active'));

        if (user) {
          setBranchId(user.branch_id);
        }

        const walkin = cData.find(c => c.name.toLowerCase().includes('walk-in'));
        if (walkin) {
          setCustomerId(walkin.id);
        }

        // Set default valid until date to 30 days from now
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);
        setValidUntil(defaultDate.toISOString().split('T')[0]);

        const tData = await db.termsConditions.getAll();
        setTermsList(tData);
      } catch (err) {
        console.error(err);
      }
    };
    loadData();
  }, [user]);

  const addServiceToCart = (service: Service) => {
    const defaultAssignedId = customerId;
    const existingIndex = cart.findIndex(item => item.service.id === service.id && item.assigned_customer_id === defaultAssignedId);
    
    if (!isCompanySelected && existingIndex !== -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { 
        service, 
        quantity: 1, 
        unit_price: service.price, 
        assigned_customer_id: defaultAssignedId || undefined 
      }]);
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

  const handleSave = async (status: 'Draft' | 'Sent') => {
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

      // Group cart items by assigned member
      const groups: Record<string, CartItem[]> = {};
      cart.forEach(item => {
        const assignedId = item.assigned_customer_id || finalCustomerId;
        if (!groups[assignedId]) groups[assignedId] = [];
        groups[assignedId].push(item);
      });

      const groupKeys = Object.keys(groups);
      const total_subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

      // Distribute discount proportionally
      let remainingDiscount = discount;
      let remainingSubtotal = total_subtotal;
      const groupDiscounts: Record<string, number> = {};

      groupKeys.forEach((key, idx) => {
        if (idx === groupKeys.length - 1) {
          groupDiscounts[key] = remainingDiscount;
        } else {
          const groupSub = groups[key].reduce((s, i) => s + i.unit_price * i.quantity, 0);
          const groupDisc = remainingSubtotal > 0 
            ? Math.round((discount * (groupSub / total_subtotal)) * 100) / 100 
            : 0;
          groupDiscounts[key] = Math.min(remainingDiscount, groupDisc);
          remainingDiscount -= groupDiscounts[key];
          remainingSubtotal -= groupSub;
        }
      });

      const createdQuotationIds: string[] = [];
      for (const key of groupKeys) {
        const groupItems = groups[key];
        const groupDisc = groupDiscounts[key];
        
        const memberObj = key !== finalCustomerId 
          ? companyEmployees.find(emp => emp.id === key) 
          : undefined;

        const createdQuote = await db.quotations.create({
          customer_id: finalCustomerId || undefined,
          branch_id: branchId,
          discount: groupDisc,
          status,
          valid_until: validUntil || undefined,
          notes: notes ? `${notes}` : undefined,
          terms_conditions_ids: selectedTermIds,
          items: groupItems.map(item => ({
            service_id: item.service.id,
            quantity: item.quantity,
            unit_price: item.unit_price
          })),
          person_name: memberObj?.name,
          person_phone: memberObj?.phone,
          person_email: memberObj?.email
        });
        createdQuotationIds.push(createdQuote.id);
      }

      navigate(`/quotations?highlight=${createdQuotationIds.join(',')}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record quotation.');
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
            onClick={() => navigate('/quotations')}
            className="p-2 border border-border bg-muted/30 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">eQuotations</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Create</h1>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl text-center font-medium">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT SECTION: CART & SERVICE SELECTION (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass border border-border rounded-2xl p-6 space-y-6 shadow-xl">
              
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <ShoppingCart className="text-primary" size={20} />
                <h2 className="font-bold text-foreground text-lg m-0">Quotation Items Catalog</h2>
              </div>

              {/* Service Cards Grid */}
              {services.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-3 font-medium">
                    Tap a service card to add it to the quotation:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {services.map(service => {
                      const cartItem = cart.find(item => item.service.id === service.id);
                      const inCart = !!cartItem;
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => addServiceToCart(service)}
                          style={inCart ? { background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' } : undefined}
                          className={`
                            relative text-left p-3 rounded-xl border transition-all duration-150 group cursor-pointer
                            ${inCart
                              ? 'border-primary/50 shadow-sm'
                              : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40 hover:shadow-sm'
                            }
                          `}
                        >
                          {inCart && (
                            <span className="absolute top-1.5 right-1.5 bg-primary text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                              {cartItem.quantity}
                            </span>
                          )}

                          <div className={`text-[11px] font-bold leading-snug mb-1 ${inCart ? 'text-primary' : 'text-foreground group-hover:text-primary'} transition-colors`}>
                            {service.name}
                          </div>
                          <div className={`text-[11px] font-semibold ${inCart ? 'text-primary/80' : 'text-muted-foreground'}`}>
                            {service.price.toFixed(2)} AED
                          </div>

                          {!inCart && (
                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus size={11} className="text-primary" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-4">
                  No active services found. Please add services in the Services module.
                </p>
              )}

              {/* Cart Table Grid */}
              <div className="border border-border/80 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold border-b border-border">
                    <tr>
                      <th className="px-4 py-3">Service Details</th>
                      {isCompanySelected && <th className="px-4 py-3 w-48">Assign To</th>}
                      <th className="px-4 py-3 text-center w-32">Qty</th>
                      <th className="px-4 py-3 w-32">Unit Price</th>
                      <th className="px-4 py-3 text-right">Subtotal</th>
                      <th className="px-4 py-3 text-center w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={isCompanySelected ? 6 : 5} className="px-4 py-10 text-center text-muted-foreground italic">
                          Shopping cart is empty. Tap a service card above to add items.
                        </td>
                      </tr>
                    ) : (
                      cart.map((item, index) => (
                        <tr key={index} className="hover:bg-muted/10">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{item.service.name}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Standard: {item.service.price.toFixed(2)} AED
                            </div>
                          </td>
                          {isCompanySelected && (
                            <td className="px-4 py-3">
                              <select
                                value={item.assigned_customer_id || customerId}
                                onChange={(e) => {
                                  const updated = [...cart];
                                  updated[index].assigned_customer_id = e.target.value;
                                  setCart(updated);
                                }}
                                className="w-full px-2 py-1 bg-muted/50 border border-border rounded text-xs text-foreground animate-none"
                              >
                                <option value={customerId}>Company Account (Direct)</option>
                                {companyEmployees.map(emp => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, -1)}
                                className="p-1 border border-border hover:bg-secondary rounded text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <Minus size={10} />
                              </button>
                              <span className="font-bold text-xs w-6 text-center text-foreground">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, 1)}
                                className="p-1 border border-border hover:bg-secondary rounded text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updatePriceOverride(index, parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 bg-muted/50 border border-border rounded text-xs text-foreground text-right"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">
                            {(item.unit_price * item.quantity).toFixed(2)} AED
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...cart];
                                updated.splice(index, 1);
                                setCart(updated);
                              }}
                              className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors cursor-pointer"
                            >
                              <Trash2 size={12} />
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

          {/* RIGHT SECTION: DETAILS & ACTION PANEL (1 col) */}
          <div className="space-y-4">
            
            {/* Customer Details Box */}
            <div className="glass border border-border rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <User className="text-primary" size={18} />
                <h2 className="font-bold text-foreground text-sm m-0">Customer Assignment</h2>
              </div>

              {/* Selector for new vs existing */}
              <div className="flex bg-muted/55 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setCustomerType('existing')}
                  className={`flex-1 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    customerType === 'existing'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Existing Customer
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerType('new')}
                  className={`flex-1 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    customerType === 'new'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  New Register
                </button>
              </div>

              {customerType === 'existing' ? (
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground">Select Customer</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select Customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} {c.customer_type === 'company' ? ' [Company]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {/* Company vs Individual Toggle */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-extrabold text-black">Account Type *</label>
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

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-extrabold text-black">
                      {newCustomerType === 'company' ? 'Company / Trade Name *' : 'Full Name *'}
                    </label>
                    <input
                      type="text"
                      placeholder={newCustomerType === 'company' ? 'E.g. Al Safa Transport LLC' : 'E.g. Mohammed Ali'}
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-black"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider font-extrabold text-black">Phone</label>
                      <input
                        type="text"
                        placeholder="+971 50 000 0000"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-black"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider font-extrabold text-black">Email</label>
                      <input
                        type="email"
                        placeholder="client@gmail.com"
                        value={newCustomerEmail}
                        onChange={(e) => setNewCustomerEmail(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-black"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-extrabold text-black">Address</label>
                    <input
                      type="text"
                      placeholder="Musaffah M37, Abu Dhabi"
                      value={newCustomerAddress}
                      onChange={(e) => setNewCustomerAddress(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-black"
                    />
                  </div>

                  {/* Company Staff / Members Section */}
                  {newCustomerType === 'company' && (
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-wider font-extrabold text-black flex items-center gap-1">
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
            </div>

            {/* Quotation Parameters Box */}
            <div className="glass border border-border rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <FileText className="text-primary" size={18} />
                <h2 className="font-bold text-foreground text-sm m-0">Quotation Summary</h2>
              </div>

              {/* Branch Selector */}
              {isAdmin && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground">Branch Store</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select Branch...</option>
                    {user?.branch_id && (
                      <option value={user.branch_id}>My Branch ({user.branch?.name})</option>
                    )}
                  </select>
                </div>
              )}

              {/* Valid Until Selector */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground flex items-center gap-1">
                  <Calendar size={11} className="text-primary" />
                  Valid Until *
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Discount */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground flex items-center gap-1">
                  <Percent size={11} className="text-primary" />
                  Discount (AED)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground font-semibold"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground">Notes / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Terms, details, stamp blueprints..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Terms & Conditions Selection */}
              <div className="space-y-2 border-t border-border/80 pt-3">
                <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground block">Apply Terms & Conditions</label>
                {termsList.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">No terms configured in global settings.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                    {termsList.map(t => {
                      const isSelected = selectedTermIds.includes(t.id);
                      return (
                        <label key={t.id} className="flex items-start gap-2 bg-muted/20 hover:bg-muted/30 p-2 rounded-lg border border-border/60 text-[11px] font-medium text-foreground cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setSelectedTermIds(selectedTermIds.filter(id => id !== t.id));
                              } else {
                                setSelectedTermIds([...selectedTermIds, t.id]);
                              }
                            }}
                            className="mt-0.5 cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-foreground block">{t.title}</span>
                            <span className="text-muted-foreground block text-[10px] leading-tight mt-0.5">{t.content}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Summary Calculations */}
              <div className="space-y-2 pt-2 border-t border-border/80">
                <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                  <span>Cart Subtotal:</span>
                  <span>{subtotal.toFixed(2)} AED</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-xs font-semibold text-rose-400">
                    <span>Discount Deduction:</span>
                    <span>- {discount.toFixed(2)} AED</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black border-t border-dashed border-border/50 pt-2 text-foreground">
                  <span>GRAND TOTAL:</span>
                  <span className="text-primary">{grandTotal.toFixed(2)} AED</span>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => handleSave('Draft')}
                  disabled={saving}
                  className="w-full bg-secondary hover:bg-muted text-foreground px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm border border-border cursor-pointer disabled:opacity-50 text-center"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSave('Sent')}
                  disabled={saving}
                  className="w-full bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 text-center"
                >
                  {saving ? 'Saving...' : 'Save & Send'}
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </PermissionGuard>
  );
};
