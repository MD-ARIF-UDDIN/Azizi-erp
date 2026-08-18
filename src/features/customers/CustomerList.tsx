import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { Customer, ClientDocument, Service } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Minus,
  Trash2,
  X,
  Search,
  Phone,
  Mail,
  MapPin,
  FileText,
  AlertTriangle,
  History,
  Calendar,
  Printer,
  ShoppingCart,
  Zap,
  Percent,
  CreditCard,
  MessageSquare
} from 'lucide-react';

const handleWhatsAppShare = (sale: any) => {
  const customerName = sale.customer?.name || 'Customer';
  const invoiceNo = sale.invoice_no;
  const grandTotal = sale.grand_total.toFixed(2);
  const itemsText = sale.items?.map((i: any) => `• ${i.service?.name || 'Service'} (Qty: ${i.quantity}) - ${(i.subtotal || 0).toFixed(2)} AED`).join('\n') || '';
  const totalPaid = sale.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
  const due = Math.max(0, sale.grand_total - totalPaid).toFixed(2);

  const message = `*AZIZI TYPING & STAMP MAKING*
Musaffah M37, Abu Dhabi
Tel: 0542797933

Dear *${customerName}*,
Here is the summary of your invoice:

*Invoice No:* #${invoiceNo}
*Date:* ${new Date(sale.created_at).toLocaleDateString()}

*Services Billing:*
${itemsText}

*Grand Total:* ${grandTotal} AED
*Outstanding Dues:* ${due} AED

Thank you for choosing AZIZI!`;

  const rawPhone = sale.customer?.phone || '';
  const phone = rawPhone.replace(/\D/g, ''); // Remove non-numeric characters
  const url = phone 
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
    
  window.open(url, '_blank');
};

const getDaysRemaining = (expiryDateStr: string) => {
  const expiry = new Date(expiryDateStr);
  const today = new Date();
  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};



interface QsCartItem {
  service: Service;
  quantity: number;
  unit_price: number;
}

export const CustomerList: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  
  // Data States
  const [customers, setCustomers] = useState<(Customer & { due: number; sales_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedCustDocs, setSelectedCustDocs] = useState<ClientDocument[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDueOnly, setFilterDueOnly] = useState(false);
  const [printSaleData, setPrintSaleData] = useState<any | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // --- Quick Sale State ---
  const [qsCustomer, setQsCustomer] = useState<any | null>(null);
  const [qsServices, setQsServices] = useState<Service[]>([]);
  const [qsCart, setQsCart] = useState<QsCartItem[]>([]);
  const [qsDiscount, setQsDiscount] = useState(0);
  const [qsNotes, setQsNotes] = useState('');
  const [qsHasPayment, setQsHasPayment] = useState(false);
  const [qsPayAmount, setQsPayAmount] = useState(0);
  const [qsPayMethod, setQsPayMethod] = useState<'Cash' | 'Card' | 'Mobile Banking' | 'Bank Transfer'>('Cash');
  const [qsSaving, setQsSaving] = useState(false);
  const [qsError, setQsError] = useState('');

  // --- Quick Payment State ---
  const [qpCustomer, setQpCustomer] = useState<any | null>(null);
  const [qpSales, setQpSales] = useState<any[]>([]);
  const [qpSelectedSaleId, setQpSelectedSaleId] = useState('');
  const [qpAmount, setQpAmount] = useState(0);
  const [qpMethod, setQpMethod] = useState<'Cash' | 'Card' | 'Mobile Banking' | 'Bank Transfer'>('Cash');
  const [qpTxNo, setQpTxNo] = useState('');
  const [qpNotes, setQpNotes] = useState('');
  const [qpSaving, setQpSaving] = useState(false);
  const [qpError, setQpError] = useState('');

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await db.customers.getAll();
      let allDocs: ClientDocument[] = [];
      try {
        allDocs = await db.clientDocuments.getAll();
      } catch (docErr) {
        console.error('Failed to load client documents:', docErr);
      }

      const mapped = data.map((c: any) => {
        const customerDocs = allDocs.filter((d: any) => d.customer_id === c.id);
        return {
          ...c,
          documents: customerDocs
        };
      });

      setCustomers(mapped);

      // If a customer is open in detail view, refresh their details
      if (selectedCustomer) {
        const refreshed = await db.customers.getById(selectedCustomer.id);
        setSelectedCustomer(refreshed);
        const docs = await db.clientDocuments.getByCustomerId(selectedCustomer.id);
        setSelectedCustDocs(docs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenDetail = async (cust: Customer) => {
    setLoading(true);
    try {
      const detailed = await db.customers.getById(cust.id);
      setSelectedCustomer(detailed);
      const docs = await db.clientDocuments.getByCustomerId(cust.id);
      setSelectedCustDocs(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this customer? This soft-deletes the record.')) {
      await db.customers.delete(id);
      setSelectedCustomer(null);
      await fetchCustomers();
    }
  };

  const handlePrintSale = async (saleId: string) => {
    setIsPrinting(true);
    try {
      const detail = await db.sales.getById(saleId);
      setPrintSaleData(detail);
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          setPrintSaleData(null);
          setIsPrinting(false);
        }, 500);
      }, 400);
    } catch (err) {
      console.error(err);
      setIsPrinting(false);
    }
  };

  // --- Quick Sale Handlers ---
  const openQuickSale = async (cust: any) => {
    const services = await db.services.getAll();
    setQsServices(services.filter(s => s.status === 'Active'));
    setQsCustomer(cust);
    setQsCart([]);
    setQsDiscount(0);
    setQsNotes('');
    setQsHasPayment(false);
    setQsPayAmount(0);
    setQsPayMethod('Cash');
    setQsError('');
  };

  const qsAddService = (service: Service) => {
    const idx = qsCart.findIndex(i => i.service.id === service.id);
    if (idx !== -1) {
      const updated = [...qsCart];
      updated[idx].quantity += 1;
      setQsCart(updated);
    } else {
      setQsCart([...qsCart, { service, quantity: 1, unit_price: service.price }]);
    }
  };

  const qsUpdateQty = (idx: number, delta: number) => {
    const updated = [...qsCart];
    const newQty = updated[idx].quantity + delta;
    if (newQty <= 0) updated.splice(idx, 1);
    else updated[idx].quantity = newQty;
    setQsCart(updated);
  };

  const qsSubmit = async () => {
    if (qsCart.length === 0) { setQsError('Add at least one service.'); return; }
    const branchId = user?.branch_id;
    if (!branchId) { setQsError('No branch assigned to your account.'); return; }
    setQsSaving(true);
    setQsError('');
    try {
      const subtotal = qsCart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const grandTotal = Math.max(0, subtotal - qsDiscount);
      const createdSale = await db.sales.create({
        customer_id: qsCustomer?.id,
        branch_id: branchId,
        discount: qsDiscount,
        notes: qsNotes || undefined,
        items: qsCart.map(i => ({ service_id: i.service.id, quantity: i.quantity, unit_price: i.unit_price })),
        initialPayment: qsHasPayment && qsPayAmount > 0
          ? { amount: Math.min(qsPayAmount, grandTotal), payment_method: qsPayMethod }
          : undefined
      });
      // Print immediately
      await handlePrintSale(createdSale.id);
      setQsCustomer(null);
      await fetchCustomers();
    } catch (err: any) {
      setQsError(err.message || 'Failed to create sale.');
    } finally {
      setQsSaving(false);
    }
  };

  const qsSubtotal = qsCart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const qsGrandTotal = Math.max(0, qsSubtotal - qsDiscount);

  // --- Quick Payment Handlers ---
  const openQuickPayment = async (cust: any) => {
    setLoading(true);
    setQpError('');
    try {
      const detailed = await db.customers.getById(cust.id);
      if (!detailed || !detailed.sales) {
        setQpError('Customer sales not found.');
        return;
      }
      
      const unpaidSales = detailed.sales.filter((s: any) => s.payment_status !== 'Paid');
      
      if (unpaidSales.length === 0) {
        alert('This customer has no unpaid invoices.');
        return;
      }

      const resolvedSales = [];
      for (const sale of unpaidSales) {
        const payments = await db.payments.getBySaleId(sale.id);
        const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const remaining = Math.max(0, sale.grand_total - totalPaid);
        if (remaining > 0) {
          resolvedSales.push({
            ...sale,
            remaining,
            totalPaid
          });
        }
      }

      if (resolvedSales.length === 0) {
        alert('This customer has no outstanding dues.');
        return;
      }

      setQpCustomer(cust);
      setQpSales(resolvedSales);
      setQpSelectedSaleId(resolvedSales[0].id);
      setQpAmount(resolvedSales[0].remaining);
      setQpMethod('Cash');
      setQpTxNo('');
      setQpNotes('');
    } catch (err: any) {
      console.error(err);
      alert('Failed to load unpaid invoices: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQpSelectedSaleChange = (saleId: string) => {
    setQpSelectedSaleId(saleId);
    const sale = qpSales.find(s => s.id === saleId);
    if (sale) {
      setQpAmount(sale.remaining);
    } else {
      setQpAmount(0);
    }
  };

  const qpSubmit = async () => {
    if (!qpSelectedSaleId) {
      setQpError('Please select an invoice.');
      return;
    }
    if (qpAmount <= 0) {
      setQpError('Amount must be greater than zero.');
      return;
    }
    const targetSale = qpSales.find(s => s.id === qpSelectedSaleId);
    if (targetSale && qpAmount > targetSale.remaining) {
      setQpError(`Amount cannot exceed the remaining due of ${targetSale.remaining.toFixed(2)} AED.`);
      return;
    }

    setQpSaving(true);
    setQpError('');
    try {
      await db.payments.create({
        sale_id: qpSelectedSaleId,
        amount: qpAmount,
        payment_method: qpMethod,
        transaction_no: qpTxNo || undefined,
        notes: qpNotes || undefined
      });
      setQpCustomer(null);
      await fetchCustomers();
    } catch (err: any) {
      setQpError(err.message || 'Payment recording failed.');
    } finally {
      setQpSaving(false);
    }
  };

  // Search & Filter
  const filteredCustomers = customers.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesDue = filterDueOnly ? c.due > 0 : true;

    return matchesSearch && matchesDue;
  });

  return (
    <PermissionGuard permission="Customer.View" fallback="ui">
      {/* MAIN FULL VIEW */}
      <div className="w-full">
        
        {/* CUSTOMER DIRECTORY LISTING */}
        <div className="w-full space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">eCustomers</div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">List</h1>
            </div>
             {hasPermission('Customer.Create') && (
              <button
                onClick={() => navigate('/customers/create')}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-md transition-all self-start sm:self-auto"
              >
                <Plus size={14} />
                Register Customer
              </button>
            )}
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder="Search by name, phone, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              />
            </div>
            
            <button
              onClick={() => setFilterDueOnly(!filterDueOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all w-full sm:w-auto justify-center ${
                filterDueOnly
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-semibold'
                  : 'border-border text-muted-foreground hover:bg-secondary/40'
              }`}
            >
              <AlertTriangle size={14} />
              Show Due Balance Only
            </button>
          </div>

          {/* Main Grid Table */}
          {loading && customers.length === 0 ? (
            <div className="space-y-3">
              <div className="h-12 bg-muted/30 rounded-xl animate-pulse" />
              <div className="h-24 bg-muted/30 rounded-xl animate-pulse" />
            </div>
          ) : (
            <div className="glass border border-border rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-secondary/40 border-b border-border text-muted-foreground text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-4 text-center w-12">SL</th>
                      <th className="px-6 py-4">Customer Details</th>
                      <th className="px-6 py-4">Dues Balance</th>
                      <th className="px-6 py-4">Document Expiry</th>
                      <th className="px-6 py-4">Orders</th>
                      <th className="px-6 py-4 text-center w-52">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                          No customers found. Register one or change filters.
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((c: any, idx) => {
                        const anyDocExpiringSoon = c.documents?.some((doc: any) => getDaysRemaining(doc.expiry_date) <= 7);
                        return (
                          <tr
                            key={c.id}
                            onClick={() => handleOpenDetail(c)}
                            className={`hover:bg-muted/25 transition-colors cursor-pointer ${
                              selectedCustomer?.id === c.id ? 'bg-secondary/25 font-semibold' : ''
                            } ${
                              anyDocExpiringSoon ? 'bg-rose-500/10 border-l-4 border-l-rose-500 hover:bg-rose-500/20' : ''
                            }`}
                          >
                          <td className="px-4 py-4 text-center text-muted-foreground font-semibold">
                            {idx + 1}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-foreground">{c.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1.5">
                              {c.phone && <span className="flex items-center gap-1"><Phone size={12} /> {c.phone}</span>}
                              {c.email && <span className="flex items-center gap-1"><Mail size={12} /> {c.email}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {c.due > 0 ? (
                              <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                {c.due.toFixed(2)} AED
                              </span>
                            ) : (
                              <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                                Clear
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              const docs = c.documents || [];
                              if (docs.length === 0) {
                                return <span className="text-muted-foreground text-xs italic">No documents</span>;
                              }
                              
                              const displayDocs = docs.slice(0, 3);
                              const hasMore = docs.length > 3;
                              
                              return (
                                <div className="flex flex-wrap gap-1 items-center">
                                  {displayDocs.map((doc: any) => {
                                    const daysLeft = getDaysRemaining(doc.expiry_date);
                                    return (
                                      <span
                                        key={doc.id}
                                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                          daysLeft < 0 ? 'bg-rose-500/15 text-rose-400 border-rose-500/20' :
                                          daysLeft <= 7 ? 'bg-rose-500/25 text-rose-350 border-rose-500/30 font-bold' :
                                          daysLeft <= 30 ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' :
                                          'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                                        }`}
                                        title={`${doc.document_type} - Expires ${doc.expiry_date}`}
                                      >
                                        {doc.document_type}: {daysLeft < 0 ? 'Exp' : `${daysLeft}d`}
                                      </span>
                                    );
                                  })}
                                  {hasMore && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenDetail(c);
                                      }}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 hover:bg-primary hover:text-white transition-all cursor-pointer"
                                    >
                                      +{docs.length - 3} more
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground font-semibold">
                            {c.sales_count} Invoice{c.sales_count !== 1 ? 's' : ''}
                          </td>
                          <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenDetail(c)}
                                className="px-2.5 py-1.5 bg-secondary hover:bg-secondary-foreground/10 text-foreground text-xs font-bold rounded-lg transition-all"
                              >
                                Details
                              </button>
                              {hasPermission('Sales.Create') && (
                                <button
                                  title="Quick Sale"
                                  onClick={() => openQuickSale(c)}
                                  className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-white transition-all"
                                >
                                  <Zap size={13} />
                                </button>
                              )}
                              {hasPermission('Payments.Create') && c.due > 0 && (
                                <button
                                  title="Quick Payment"
                                  onClick={() => openQuickPayment(c)}
                                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white transition-all"
                                >
                                  <CreditCard size={13} />
                                </button>
                              )}
                              {hasPermission('Sales.View') && c.sales_count > 0 && (
                                <button
                                  title="View & Print Invoices"
                                  onClick={() => handleOpenDetail(c)}
                                  className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                                  disabled={isPrinting}
                                >
                                  <Printer size={13} />
                                </button>
                              )}
                            </div>
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
        </div>

        {/* CUSTOMER PROFILE DETAIL PANEL (Pops up in a modal overlay) */}
        {selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="glass border border-border rounded-2xl p-6 space-y-6 shadow-2xl relative bg-background w-full max-w-2xl max-h-[90vh] overflow-y-auto my-8">
              
              {/* Close Button */}
              <button
                onClick={() => setSelectedCustomer(null)}
                className="absolute right-4 top-4 p-2 text-muted-foreground hover:text-foreground bg-muted/40 rounded-full transition-colors"
              >
                <X size={16} />
              </button>

              {/* Detail Header */}
              <div className="flex items-start justify-between border-b border-border pb-4">
                <div>
                  <h2 className="font-bold text-foreground text-lg m-0">{selectedCustomer.name}</h2>
                  <span className="text-xs text-muted-foreground">Customer ID: #{selectedCustomer.id.slice(0, 8)}</span>
                </div>
              </div>

              {/* Due Alert Panel */}
              {selectedCustomer.due > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs p-4 rounded-xl flex items-start gap-2.5">
                  <AlertTriangle className="flex-shrink-0 mt-0.5" size={16} />
                  <div>
                    <div className="font-bold">Outstanding Due Alert</div>
                    <div className="mt-0.5">This customer has an unpaid balance of <strong className="text-foreground font-extrabold">{selectedCustomer.due.toFixed(2)} AED</strong>.</div>
                  </div>
                </div>
              )}

              {/* Information Cards */}
              <div className="space-y-3.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <MapPin className="text-primary flex-shrink-0 mt-0.5" size={14} />
                  <div>
                    <div className="text-muted-foreground font-semibold">Billing Address</div>
                    <div className="text-foreground mt-0.5">{selectedCustomer.address || 'No billing address provided.'}</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <FileText className="text-primary flex-shrink-0 mt-0.5" size={14} />
                  <div>
                    <div className="text-muted-foreground font-semibold">Staff Notes</div>
                    <div className="text-foreground mt-0.5 italic">{selectedCustomer.notes || 'No administrative notes.'}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-border/60">
                {hasPermission('Sales.Create') && (
                  <button
                    onClick={() => navigate(`/sales/create?customer_id=${selectedCustomer.id}`)}
                    className="flex-1 py-2 flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs rounded-lg font-semibold shadow-md transition-colors"
                  >
                    <ShoppingCart size={13} />
                    New Sale
                  </button>
                )}
                {hasPermission('Customer.Update') && (
                  <button
                    onClick={() => navigate(`/customers/edit/${selectedCustomer.id}`)}
                    className="flex-1 py-2 text-center border border-border text-xs rounded-lg font-semibold hover:text-foreground transition-colors"
                  >
                    Edit Profile
                  </button>
                )}
                {hasPermission('Customer.Delete') && (
                  <button
                    onClick={() => handleDelete(selectedCustomer.id)}
                    className="py-2 px-3 bg-destructive/10 text-destructive text-xs rounded-lg font-semibold hover:bg-destructive/20 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* CLIENT DOCUMENTS EXPIRES */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Calendar size={14} className="text-primary" />
                  Tracked Visas & Documents
                </h3>

                {selectedCustDocs.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-4 bg-muted/20 rounded-xl border border-dashed border-border">
                    No documents currently tracked.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedCustDocs.map(d => {
                      const expiry = new Date(d.expiry_date);
                      const today = new Date();
                      expiry.setHours(0,0,0,0);
                      today.setHours(0,0,0,0);
                      const diff = expiry.getTime() - today.getTime();
                      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                      const isUrgent = days <= 60;

                      return (
                        <div key={d.id} className="p-3 rounded-xl border border-border bg-muted/25 flex flex-col justify-between text-xs">
                          <div>
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-foreground">{d.document_type}</span>
                              {d.document_number && <span className="font-mono text-[10px] text-muted-foreground">{d.document_number}</span>}
                            </div>
                            <div className="mt-1.5 text-muted-foreground flex justify-between">
                              <span>Expires:</span>
                              <span className={`font-semibold ${isUrgent ? 'text-amber-500' : 'text-foreground'}`}>
                                {d.expiry_date} ({days < 0 ? 'Expired' : `${days}d left`})
                              </span>
                            </div>
                            {d.notes && <div className="mt-1.5 text-[10px] italic text-muted-foreground">"{d.notes}"</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* TRANSACTION LEDGER HISTORY */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <History size={14} className="text-primary" />
                  Invoice History Ledger
                </h3>
                
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {selectedCustomer.sales?.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-4 bg-muted/20 rounded-xl border border-dashed border-border">
                      No invoices recorded.
                    </div>
                  ) : (
                    selectedCustomer.sales?.map((s: any) => (
                      <div
                        key={s.id}
                        className="bg-muted/25 border border-border/80 p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-mono font-bold text-[10px] tracking-wide">
                            # {s.invoice_no}
                          </span>
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {new Date(s.created_at).toLocaleDateString()} • {s.branch?.name}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right space-y-1.5">
                            <div className="font-bold text-foreground">{s.grand_total.toFixed(2)} AED</div>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                              s.payment_status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              s.payment_status === 'Partially Paid' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {s.payment_status}
                            </span>
                          </div>
                          {hasPermission('Sales.View') && (
                            <button
                              title="Print Invoice"
                              onClick={() => handlePrintSale(s.id)}
                              disabled={isPrinting}
                              className="p-2 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-white transition-all flex-shrink-0 disabled:opacity-50"
                            >
                              {isPrinting ? (
                                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Printer size={13} />
                              )}
                            </button>
                          )}
                          {hasPermission('Sales.View') && (
                            <button
                              title="Share Invoice Details on WhatsApp"
                              onClick={async () => {
                                const detail = await db.sales.getById(s.id);
                                handleWhatsAppShare(detail);
                              }}
                              className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white transition-all flex-shrink-0"
                            >
                              <MessageSquare size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* QUICK SALE MODAL */}
      {qsCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:hidden overflow-y-auto">
          <div className="glass border border-border rounded-2xl shadow-2xl relative w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col my-4">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Zap size={16} className="text-primary" />
                </div>
                <div>
                  <div className="text-xs font-bold text-primary uppercase tracking-wider">Quick Sale</div>
                  <div className="font-bold text-foreground text-sm">{qsCustomer.name}</div>
                </div>
              </div>
              <button
                onClick={() => setQsCustomer(null)}
                className="p-2 text-muted-foreground hover:text-foreground bg-muted/40 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

              {/* LEFT: Service Cards + Cart */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 border-r border-border/60">

                {/* Service Cards */}
                <div>
                  <p className="text-xs text-muted-foreground font-semibold mb-3">Tap a service to add it to the bill:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {qsServices.map(service => {
                      const cartItem = qsCart.find(i => i.service.id === service.id);
                      const inCart = !!cartItem;
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => qsAddService(service)}
                          style={inCart ? { background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' } : undefined}
                          className={`relative text-left p-3 rounded-xl border transition-all duration-150 group cursor-pointer ${
                            inCart
                              ? 'border-primary/50 shadow-sm'
                              : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                          }`}
                        >
                          {inCart && (
                            <span className="absolute top-1.5 right-1.5 bg-primary text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                              {cartItem.quantity}
                            </span>
                          )}
                          <div className={`text-[11px] font-bold leading-snug mb-1 pr-5 ${inCart ? 'text-primary' : 'text-foreground group-hover:text-primary'} transition-colors`}>
                            {service.name}
                          </div>
                          <div className={`text-[11px] font-semibold ${inCart ? 'text-primary/80' : 'text-muted-foreground'}`}>
                            {service.price.toFixed(2)} AED
                          </div>
                          {!inCart && (
                            <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus size={11} className="text-primary" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cart Table */}
                <div className="border border-border/80 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold border-b border-border">
                      <tr>
                        <th className="px-3 py-2.5">Service</th>
                        <th className="px-3 py-2.5 text-center w-28">Qty</th>
                        <th className="px-3 py-2.5 text-right">Amount</th>
                        <th className="px-3 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {qsCart.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground italic">
                            No items yet — tap a service card above.
                          </td>
                        </tr>
                      ) : (
                        qsCart.map((item, idx) => (
                          <tr key={item.service.id} className="hover:bg-muted/10">
                            <td className="px-3 py-2.5">
                              <div className="font-semibold text-foreground">{item.service.name}</div>
                              <div className="text-[10px] text-muted-foreground">{item.unit_price.toFixed(2)} AED each</div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-center gap-1.5">
                                <button type="button" onClick={() => qsUpdateQty(idx, -1)} className="h-6 w-6 rounded border border-border bg-muted/30 flex items-center justify-center hover:bg-secondary transition-colors"><Minus size={10} /></button>
                                <span className="font-semibold text-sm w-5 text-center text-foreground">{item.quantity}</span>
                                <button type="button" onClick={() => qsUpdateQty(idx, 1)} className="h-6 w-6 rounded border border-border bg-muted/30 flex items-center justify-center hover:bg-secondary transition-colors"><Plus size={10} /></button>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-foreground">
                              {(item.unit_price * item.quantity).toFixed(2)} AED
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button type="button" onClick={() => qsUpdateQty(idx, -item.quantity)} className="text-muted-foreground hover:text-destructive p-1 rounded"><Trash2 size={12} /></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* RIGHT: Totals + Payment + Submit */}
              <div className="w-full lg:w-72 flex-shrink-0 p-5 space-y-4 overflow-y-auto bg-muted/10">

                {/* Notes */}
                <div className="space-y-1 text-xs">
                  <label className="text-muted-foreground font-semibold flex items-center gap-1"><FileText size={12} /> Remarks</label>
                  <textarea
                    value={qsNotes}
                    onChange={e => setQsNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground resize-none text-xs"
                    placeholder="Font style, notes..."
                  />
                </div>

                {/* Totals */}
                <div className="bg-muted/25 p-4 rounded-xl border border-border/80 space-y-3 text-xs">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-semibold text-foreground">{qsSubtotal.toFixed(2)} AED</span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-muted-foreground flex items-center gap-1"><Percent size={11} /> Discount</span>
                    <div className="relative w-24">
                      <input
                        type="number"
                        min={0}
                        max={qsSubtotal}
                        value={qsDiscount}
                        onChange={e => setQsDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-2 py-1 text-right bg-muted/50 border border-border rounded text-foreground font-semibold pr-7"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">AED</span>
                    </div>
                  </div>
                  <div className="border-t border-border/60 pt-2.5 flex justify-between items-center text-sm font-bold">
                    <span className="text-foreground">Grand Total</span>
                    <span className="text-primary">{qsGrandTotal.toFixed(2)} AED</span>
                  </div>
                </div>

                {/* Payment toggle */}
                {qsGrandTotal > 0 && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-foreground">
                      <input
                        type="checkbox"
                        checked={qsHasPayment}
                        onChange={e => { setQsHasPayment(e.target.checked); if (e.target.checked) setQsPayAmount(qsGrandTotal); }}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      Record Payment Now
                    </label>
                    {qsHasPayment && (
                      <div className="bg-muted/30 p-3 rounded-xl border border-border/80 space-y-2 text-xs">
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Method</label>
                          <select value={qsPayMethod} onChange={e => setQsPayMethod(e.target.value as any)} className="w-full px-2 py-1.5 bg-popover border border-border rounded text-foreground text-xs">
                            <option value="Cash">Cash</option>
                            <option value="Card">Card</option>
                            <option value="Mobile Banking">Mobile Banking</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground font-semibold">Amount Paid (AED)</label>
                          <input
                            type="number"
                            min={1}
                            max={qsGrandTotal}
                            value={qsPayAmount}
                            onChange={e => setQsPayAmount(Math.min(qsGrandTotal, parseFloat(e.target.value) || 0))}
                            className="w-full px-2 py-1.5 bg-muted/50 border border-border rounded text-foreground text-right font-semibold"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {qsError && (
                  <div className="text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg p-3 font-medium">
                    {qsError}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="button"
                  onClick={qsSubmit}
                  disabled={qsSaving || qsCart.length === 0}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all"
                >
                  {qsSaving ? (
                    <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating...</>
                  ) : (
                    <><Printer size={15} /> Finalize & Print Invoice</>
                  )}
                </button>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK PAYMENT MODAL */}
      {qpCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:hidden overflow-y-auto">
          <div className="glass border border-border w-full max-w-md rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4 bg-background">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-emerald-400" />
                <h3 className="font-bold text-foreground text-md">Quick Payment</h3>
              </div>
              <button onClick={() => setQpCustomer(null)} className="text-muted-foreground hover:text-foreground bg-muted/40 rounded-full p-1 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div className="flex justify-between items-center bg-muted/20 p-2.5 rounded-xl border border-border/60">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Customer</span>
                  <span className="font-bold text-foreground text-sm">{qpCustomer.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Outstanding Dues</span>
                  <span className="font-extrabold text-amber-500 text-sm">{qpCustomer.due.toFixed(2)} AED</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground font-semibold">Select Sales Invoice to Collect</label>
                <select
                  value={qpSelectedSaleId}
                  onChange={e => handleQpSelectedSaleChange(e.target.value)}
                  className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground text-xs focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  {qpSales.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.invoice_no} (Remaining Due: {s.remaining.toFixed(2)} AED)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground font-semibold">Payment Method</label>
                  <select
                    value={qpMethod}
                    onChange={e => setQpMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground text-xs focus:ring-2 focus:ring-primary/50 outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Mobile Banking">Mobile Banking</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground font-semibold">Amount to Collect (AED)</label>
                  <input
                    type="number"
                    min={0.01}
                    max={qpSales.find(s => s.id === qpSelectedSaleId)?.remaining || 999999}
                    step={0.01}
                    value={qpAmount || ''}
                    onChange={e => setQpAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground text-xs focus:ring-2 focus:ring-primary/50 outline-none font-semibold text-right"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground font-semibold flex items-center gap-1">Transaction / Ref Number</label>
                <input
                  type="text"
                  placeholder="E.g. Bank reference, TxID"
                  value={qpTxNo}
                  onChange={e => setQpTxNo(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground text-xs focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground font-semibold">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="Optional payment remarks..."
                  value={qpNotes}
                  onChange={e => setQpNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground text-xs focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              {qpError && (
                <div className="text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg p-3 font-medium">
                  {qpError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setQpCustomer(null)}
                  className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={qpSubmit}
                  disabled={qpSaving || qpAmount <= 0}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
                >
                  {qpSaving ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Record Payment'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* HIDDEN PRINT-ONLY INVOICE — rendered when printSaleData is set */}
      {printSaleData && (
        <div className="hidden print:block fixed inset-0 bg-white p-8 z-[9999] text-black text-xs">
          {/* Company Header */}
          <div className="text-center space-y-1 pb-4 border-b border-gray-300">
            <div className="text-xl font-bold text-[#000ba0] font-serif tracking-wide italic">
              مكتب عزيزي للكتابة وعمل الأختام ذ.م.م - فرع ١
            </div>
            <div className="text-lg font-black text-[#f28f00] tracking-wide italic uppercase">
              AZIZI TYPING &amp; STAMP MAKING Br. 1
            </div>
            <div className="text-xs text-black font-bold">
              Mobile: 0542797933 • Email: azizitypingbr@gmail.com
            </div>
            <div className="text-[11px] text-gray-700 font-semibold">
              Abu Dhabi, Musaffah M37, Near Irani Masjid
            </div>
          </div>

          {/* Banner */}
          <div className="bg-[#000ba0] text-white flex items-center justify-between px-4 py-1.5 font-bold uppercase tracking-wider text-xs my-3 rounded-sm">
            <span>Customer Invoice</span>
            <span className="bg-[#f28f00] text-white px-3 py-0.5 rounded font-mono text-[11px] tracking-widest">
              # {printSaleData.invoice_no}
            </span>
          </div>

          {/* Metadata */}
          <table className="w-full border-collapse border border-gray-300 text-xs my-3">
            <tbody>
              <tr>
                <td className="bg-[#f28f00] text-white font-bold px-3 py-2 border border-gray-300 w-1/4 uppercase">Invoice To</td>
                <td className="px-3 py-2 border border-gray-300 text-black font-bold text-sm" colSpan={3}>
                  {printSaleData.customer?.name || 'Walk-in Customer'}
                </td>
              </tr>
              <tr>
                <td className="bg-gray-100 text-gray-700 font-bold px-3 py-2 border border-gray-300 w-1/4">Mr. / M/s:</td>
                <td className="px-3 py-2 border border-gray-300 text-black font-semibold w-1/4">{printSaleData.customer?.email || 'N/A'}</td>
                <td className="bg-[#f28f00] text-white font-bold px-3 py-2 border border-gray-300 w-1/4 uppercase text-center">Date</td>
                <td className="px-3 py-2 border border-gray-300 text-black font-bold text-center w-1/4">
                  {new Date(printSaleData.created_at).toLocaleDateString()}
                </td>
              </tr>
              <tr>
                <td className="bg-gray-100 text-gray-700 font-bold px-3 py-2 border border-gray-300 w-1/4">Invoice No:</td>
                <td className="px-3 py-2 border border-gray-300 text-[#000ba0] font-bold w-1/4">{printSaleData.invoice_no}</td>
                <td className="bg-gray-100 text-gray-700 font-bold px-3 py-2 border border-gray-300 w-1/4 text-center">Cashier</td>
                <td className="px-3 py-2 border border-gray-300 text-black font-semibold text-center w-1/4">
                  {printSaleData.employee?.name || 'Staff'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Items */}
          <div className="border border-gray-300 rounded-sm overflow-hidden my-3">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#000ba0] text-white font-bold">
                <tr>
                  <th className="px-3 py-2.5 text-center border-r border-gray-300 w-[8%]">No</th>
                  <th className="px-3 py-2.5 border-r border-gray-300 w-[57%]">Description of Service</th>
                  <th className="px-3 py-2.5 text-center border-r border-gray-300 w-[10%]">Qty</th>
                  <th className="px-3 py-2.5 text-right border-r border-gray-300 w-[10%]">Rate</th>
                  <th className="px-3 py-2.5 text-right w-[15%]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {(() => {
                  const items = printSaleData.items || [];
                  const totalRows = 11;
                  const rows: React.ReactNode[] = [];
                  items.forEach((item: any, index: number) => {
                    rows.push(
                      <tr key={item.id} className="h-8">
                        <td className="px-3 py-1.5 text-center border-r border-gray-300 font-semibold">{index + 1}</td>
                        <td className="px-3 py-1.5 border-r border-gray-300 font-bold">{item.service?.name}</td>
                        <td className="px-3 py-1.5 text-center border-r border-gray-300">{item.quantity}</td>
                        <td className="px-3 py-1.5 text-right border-r border-gray-300">{item.unit_price.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right font-bold">{item.subtotal.toFixed(2)}</td>
                      </tr>
                    );
                  });
                  for (let i = 0; i < Math.max(0, totalRows - items.length); i++) {
                    rows.push(
                      <tr key={`e-${i}`} className="h-8">
                        <td className="px-3 py-1.5 text-center border-r border-gray-300 font-semibold">{items.length + i + 1}</td>
                        <td className="px-3 py-1.5 border-r border-gray-300" />
                        <td className="px-3 py-1.5 border-r border-gray-300" />
                        <td className="px-3 py-1.5 border-r border-gray-300" />
                        <td className="px-3 py-1.5" />
                      </tr>
                    );
                  }
                  return rows;
                })()}
              </tbody>
              <tfoot>
                <tr className="bg-[#f28f00] text-white font-bold border-t border-gray-300">
                  <td className="px-3 py-2 text-center border-r border-gray-300" colSpan={4}>Sub Total</td>
                  <td className="px-3 py-2 text-right">{printSaleData.subtotal?.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Bottom: Notes + Payments */}
          <div className="grid grid-cols-2 gap-4 my-3">
            <div className="border border-gray-300 rounded-sm">
              <div className="bg-gray-100 border-b border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700">Remarks</div>
              <div className="p-3 text-xs italic">{printSaleData.notes || 'Thank you for choosing AZIZI!'}</div>
            </div>
            <div className="border border-gray-300 rounded-sm text-xs">
              <div className="bg-[#000ba0] text-white text-center py-1.5 font-bold uppercase">Payment Record</div>
              <table className="w-full border-collapse">
                <thead className="bg-[#f28f00] text-white font-bold">
                  <tr>
                    <th className="px-3 py-1.5 border-r border-gray-300">Date</th>
                    <th className="px-3 py-1.5 border-r border-gray-300">Method</th>
                    <th className="px-3 py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {(printSaleData.payments || []).map((p: any) => (
                    <tr key={p.id} className="h-7">
                      <td className="px-3 py-1 border-r border-gray-300">{new Date(p.payment_date).toLocaleDateString()}</td>
                      <td className="px-3 py-1 border-r border-gray-300 font-semibold">{p.payment_method}</td>
                      <td className="px-3 py-1 text-right font-semibold">{p.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  {Array.from({ length: Math.max(0, 4 - (printSaleData.payments?.length || 0)) }).map((_, i) => (
                    <tr key={`ep-${i}`} className="h-7">
                      <td className="px-3 py-1 border-r border-gray-300" />
                      <td className="px-3 py-1 border-r border-gray-300" />
                      <td className="px-3 py-1" />
                    </tr>
                  ))}
                </tbody>
              </table>
              {(() => {
                const paid = (printSaleData.payments || []).reduce((s: number, p: any) => s + p.amount, 0);
                const due = Math.max(0, printSaleData.grand_total - paid);
                return (
                  <>
                    <div className="flex justify-between bg-[#000ba0] text-white font-bold px-3 py-1.5 text-xs">
                      <span>Total</span><span>{printSaleData.grand_total?.toFixed(2)} AED</span>
                    </div>
                    <div className="flex justify-between bg-white text-black font-bold px-3 py-1.5 text-xs border-t border-gray-300">
                      <span>Paid</span><span>{paid.toFixed(2)} AED</span>
                    </div>
                    <div className={`flex justify-between font-extrabold px-3 py-1.5 text-xs ${due > 0 ? 'bg-[#fadbd8] text-[#78281f]' : 'bg-green-50 text-green-700'}`}>
                      <span>Due</span><span>{due.toFixed(2)} AED</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </PermissionGuard>
  );
};
