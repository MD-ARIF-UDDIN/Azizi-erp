import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { Service, Customer } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  User,
  Building,
  FileText,
  Percent,
  ChevronLeft
} from 'lucide-react';

interface CartItem {
  service: Service;
  quantity: number;
  unit_price: number;
  assigned_customer_id?: string;
}

export const CreateSale: React.FC = () => {
  const { user, isAdmin, availableBranches } = useAuth();
  const navigate = useNavigate();

  // Master Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Form States
  const [customerType, setCustomerType] = useState<'existing' | 'new'>('existing');
  const [customerId, setCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
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
  const isCompanySelected = selectedCustomerRecord?.customer_type === 'company';
  const companyEmployees = isCompanySelected && selectedCustomerRecord?.members
    ? selectedCustomerRecord.members
    : [];

  useEffect(() => {
    setCart([]);
  }, [customerId, customerType]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const cData = await db.customers.getAll();
        const sData = await db.services.getAll();
        
        setCustomers(cData);
        // Only allow selling active services
        setServices(sData.filter(s => s.status === 'Active'));

        // Default branch
        if (user) {
          setBranchId(user.branch_id);
        }

        // Auto-select walk-in customer if exists
        const walkin = cData.find(c => c.name.toLowerCase().includes('walk-in'));
        if (walkin) {
          setCustomerId(walkin.id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadData();
  }, [user]);

  // Add a service directly from card click
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
          setErrorMsg('New customer name is required.');
          setSaving(false);
          return;
        }
        const createdCust = await db.customers.create({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || '+880000000000',
          email: newCustomerEmail.trim() || undefined,
          address: newCustomerAddress.trim() || undefined,
          notes: 'Registered via billing counter.'
        });
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

      // Distribute initial payment sequentially
      let remainingPayment = hasInitialPayment ? paymentAmount : 0;
      const groupPayments: Record<string, number> = {};

      groupKeys.forEach((key) => {
        const groupSub = groups[key].reduce((s, i) => s + i.unit_price * i.quantity, 0);
        const groupDisc = groupDiscounts[key];
        const groupTotal = Math.max(0, groupSub - groupDisc);

        const payForGroup = Math.min(remainingPayment, groupTotal);
        groupPayments[key] = payForGroup;
        remainingPayment -= payForGroup;
      });

      // Save sales
      const createdSaleIds: string[] = [];
      for (const key of groupKeys) {
        const groupItems = groups[key];
        const groupDisc = groupDiscounts[key];
        const payAmount = groupPayments[key] || 0;
        
        const memberObj = key !== finalCustomerId 
          ? companyEmployees.find(emp => emp.id === key) 
          : undefined;

        const createdSale = await db.sales.create({
          customer_id: finalCustomerId || undefined,
          branch_id: branchId,
          discount: groupDisc,
          notes: notes ? `${notes}` : undefined,
          items: groupItems.map(item => ({
            service_id: item.service.id,
            quantity: item.quantity,
            unit_price: item.unit_price
          })),
          initialPayment: payAmount > 0 ? {
            amount: payAmount,
            payment_method: paymentMethod
          } : undefined,
          person_name: memberObj?.name,
          person_phone: memberObj?.phone,
          person_email: memberObj?.email
        });
        createdSaleIds.push(createdSale.id);
      }

      navigate(`/sales?print=${createdSaleIds.join(',')}`);
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
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">eSales</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Create</h1>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl text-center font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT SECTION: CART & SERVICE SELECTION (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass border border-border rounded-2xl p-6 space-y-6 shadow-xl">
              
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <ShoppingCart className="text-primary" size={20} />
                <h2 className="font-bold text-foreground text-lg m-0">Bill Items Catalog</h2>
              </div>

              {/* Service Cards Grid — tap to add */}
              {services.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-3 font-medium">
                    Tap a service card to add it to the bill:
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
                          {/* Quantity badge when in cart */}
                          {inCart && (
                            <span className="absolute top-1.5 right-1.5 bg-primary text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                              {cartItem.quantity}
                            </span>
                          )}

                          <div className={`text-[11px] font-bold leading-snug mb-1 ${inCart ? 'text-primary' : 'text-foreground group-hover:text-primary'} transition-colors`}
                               style={inCart ? undefined : { paddingRight: '0' }}>
                            {service.name}
                          </div>
                          <div className={`text-[11px] font-semibold ${inCart ? 'text-primary/80' : 'text-muted-foreground'}`}>
                            {service.price.toFixed(2)} AED
                          </div>

                          {/* Hover plus icon */}
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
                          Shopping cart is empty. Tap a service card above to begin billing.
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
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, -1)}
                                className="h-6 w-6 rounded border border-border bg-muted/30 flex items-center justify-center hover:bg-secondary transition-colors"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="font-semibold text-sm w-6 text-center text-foreground">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, 1)}
                                className="h-6 w-6 rounded border border-border bg-muted/30 flex items-center justify-center hover:bg-secondary transition-colors"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              value={item.unit_price}
                              onChange={(e) => updatePriceOverride(index, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 bg-muted/50 border border-border rounded text-center text-xs text-foreground"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground">
                            {(item.unit_price * item.quantity).toFixed(2)} AED
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => updateQuantity(index, -item.quantity)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded"
                            >
                              <Trash2 size={14} />
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

          {/* RIGHT SECTION: METADATA, TOTALS & CHEKOUT (1 col) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass border border-border rounded-2xl p-6 space-y-6 shadow-xl">
              
              <div className="border-b border-border pb-3">
                <h3 className="font-bold text-foreground text-md m-0">Billing & Destination</h3>
              </div>

              {/* Customer Type Selector */}
              <div className="flex rounded-lg bg-muted/50 p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setCustomerType('existing')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    customerType === 'existing'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Existing Customer
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerType('new')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    customerType === 'new'
                      ? 'bg-primary text-white shadow-sm'
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
                    className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground text-xs"
                    required={customerType === 'existing'}
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map(c => {
                      const parentCompanyName = c.company?.name;
                      const displayLabel = c.customer_type === 'individual' && parentCompanyName
                        ? `${c.name} (Member of ${parentCompanyName})`
                        : c.customer_type === 'company'
                        ? `${c.name} (Company Account)`
                        : c.name;
                      return (
                        <option key={c.id} value={c.id}>
                          {displayLabel} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div className="space-y-3.5 border border-border/60 p-3 rounded-xl bg-muted/20">
                  <div className="space-y-1.5 text-xs">
                    <label className="text-muted-foreground font-semibold">Full Name *</label>
                    <input
                      type="text"
                      required={customerType === 'new'}
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Enter customer's name"
                      className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <label className="text-muted-foreground font-semibold">Phone Number</label>
                    <input
                      type="text"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="E.g. +8801700000000"
                      className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <label className="text-muted-foreground font-semibold">Email Address</label>
                    <input
                      type="email"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      placeholder="customer@domain.com"
                      className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <label className="text-muted-foreground font-semibold">Address</label>
                    <input
                      type="text"
                      value={newCustomerAddress}
                      onChange={(e) => setNewCustomerAddress(e.target.value)}
                      placeholder="City, Area, Road"
                      className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground"
                    />
                  </div>
                </div>
              )}

              {/* Branch Selector */}
              <div className="space-y-1.5 text-xs">
                <label className="text-muted-foreground font-semibold flex items-center gap-1">
                  <Building size={13} /> Destination Branch *
                </label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground disabled:opacity-75 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">-- Select Branch --</option>
                  {availableBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Order Notes */}
              <div className="space-y-1.5 text-xs">
                <label className="text-muted-foreground font-semibold flex items-center gap-1">
                  <FileText size={13} /> Order Instruction / Remarks
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground resize-none"
                  placeholder="E.g. Font style, stamp border design info..."
                />
              </div>

              {/* Billing Totals Panel */}
              <div className="bg-muted/25 p-4 rounded-xl border border-border/80 space-y-3.5 text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-semibold text-foreground">{subtotal.toFixed(2)} AED</span>
                </div>

                {/* Discount input */}
                <div className="flex justify-between items-center gap-3">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Percent size={12} /> Apply Discount
                  </span>
                  <div className="relative w-28">
                    <input
                      type="number"
                      min={0}
                      max={subtotal}
                      value={discount}
                      onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-2 py-1 text-right bg-muted/50 border border-border rounded text-foreground font-semibold pr-8"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">AED</span>
                  </div>
                </div>

                <div className="border-t border-border/60 my-2 pt-2.5 flex justify-between items-center text-sm font-bold">
                  <span className="text-foreground">Grand Total</span>
                  <span className="text-primary text-md">{grandTotal.toFixed(2)} AED</span>
                </div>
              </div>

              {/* Take Payment Checkbox */}
              {grandTotal > 0 && (
                <div className="space-y-3 border-t border-border/50 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-foreground">
                    <input
                      type="checkbox"
                      checked={hasInitialPayment}
                      onChange={(e) => setHasInitialPayment(e.target.checked)}
                      className="rounded border-border bg-muted/50 text-primary focus:ring-primary"
                    />
                    Record Downpayment Collection
                  </label>

                  {hasInitialPayment && (
                    <div className="bg-muted/30 p-3 rounded-xl border border-border/80 space-y-3 animate-fade-in text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Method</label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value as any)}
                            className="w-full px-2 py-1 bg-popover border border-border rounded text-foreground"
                          >
                            <option value="Cash">Cash</option>
                            <option value="Card">Card</option>
                            <option value="Mobile Banking">Mobile Banking</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Paid Amount</label>
                          <input
                            type="number"
                            min={1}
                            max={grandTotal}
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(Math.min(grandTotal, parseFloat(e.target.value) || 0))}
                            className="w-full px-2 py-1 bg-muted/50 border border-border rounded text-foreground text-right font-semibold"
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
                className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all"
              >
                {saving ? 'Creating Order Invoice...' : 'Finalize Sale & Checkout'}
              </button>

            </div>
          </div>

        </form>

      </div>
    </PermissionGuard>
  );
};
