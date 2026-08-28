import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { OrderStatus } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exportSales } from '../../lib/excelExport';
import {
  Plus,
  Search,
  Printer,
  Activity,
  Clock,
  X,
  CreditCard,
  MessageSquare,
  Download,
  Pencil,
  Trash2
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


export const SalesList: React.FC = () => {
  const { hasPermission, activeBranchId } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const printId = searchParams.get('print');

  // Data States
  const [sales, setSales] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<OrderStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [sortField, setSortField] = useState<'created_at' | 'grand_total'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Detail Modal States
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedSaleDetails, setSelectedSaleDetails] = useState<any | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatusId, setNewStatusId] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');

  // Edit Items Modal States
  const [editItemsModalOpen, setEditItemsModalOpen] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editingSaleItems, setEditingSaleItems] = useState<any[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [addServiceId, setAddServiceId] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [addPrice, setAddPrice] = useState(0);
  const [editSaving, setEditSaving] = useState(false);

  // Payment Modal States
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingSaleId, setPayingSaleId] = useState<string | null>(null);
  const [payingSaleDetails, setPayingSaleDetails] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<'Cash' | 'Card' | 'Mobile Banking' | 'Bank Transfer'>('Cash');
  const [payTxnNo, setPayTxnNo] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paySaving, setPaySaving] = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const branchFilterVal = activeBranchId === 'all' ? undefined : activeBranchId;
      const sData = await db.sales.getAll(branchFilterVal);
      const osData = await db.orderStatuses.getAll();
      
      setSales(sData);
      setStatuses(osData);

      // Refresh Detail Panel if open
      if (selectedSaleId) {
        const detail = await db.sales.getById(selectedSaleId);
        setSelectedSaleDetails(detail);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [activeBranchId, selectedSaleId]);

  useEffect(() => {
    if (printId) {
      const triggerAutoPrint = async () => {
        try {
          const ids = printId.split(',');
          const details = [];
          for (const sId of ids) {
            const detail = await db.sales.getById(sId);
            if (detail) details.push(detail);
          }
          if (details.length > 0) {
            setSelectedSaleDetails(details.length === 1 ? details[0] : details);
            setSelectedSaleId(ids[0]);
            setSearchParams({}, { replace: true });
            setTimeout(() => {
              window.print();
            }, 600);
          }
        } catch (err) {
          console.error(err);
        }
      };
      triggerAutoPrint();
    }
  }, [printId]);

  const handleOpenDetail = async (id: string) => {
    setSelectedSaleId(id);
    setLoading(true);
    try {
      const detail = await db.sales.getById(id);
      setSelectedSaleDetails(detail);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSaleId || !newStatusId) return;

    try {
      await db.sales.updateStatus(selectedSaleId, newStatusId, statusRemarks);
      setStatusModalOpen(false);
      setNewStatusId('');
      setStatusRemarks('');
      await fetchSales();
    } catch (err) {
      console.error(err);
    }
  };



  const handlePrint = () => {
    window.print();
  };

  const handleOpenEditItems = async (saleId: string) => {
    try {
      setEditingSaleId(saleId);
      const detail = await db.sales.getById(saleId);
      setEditingSaleItems(detail?.items || []);
      const svcs = await db.services.getAll();
      setAllServices(svcs.filter(s => s.status === 'Active'));
      setAddServiceId('');
      setAddQty(1);
      setAddPrice(0);
      setEditItemsModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItem = async () => {
    if (!editingSaleId || !addServiceId || addQty <= 0) return;
    setEditSaving(true);
    try {
      await db.sales.addItem(editingSaleId, { service_id: addServiceId, quantity: addQty, unit_price: addPrice });
      const detail = await db.sales.getById(editingSaleId);
      setEditingSaleItems(detail?.items || []);
      setAddServiceId('');
      setAddQty(1);
      setAddPrice(0);
      await fetchSales();
    } catch (err) { console.error(err); }
    finally { setEditSaving(false); }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!editingSaleId || !window.confirm('Remove this item from the invoice?')) return;
    setEditSaving(true);
    try {
      await db.sales.removeItem(editingSaleId, itemId);
      const detail = await db.sales.getById(editingSaleId);
      setEditingSaleItems(detail?.items || []);
      await fetchSales();
    } catch (err) { console.error(err); }
    finally { setEditSaving(false); }
  };

  const handleOpenPayModal = async (saleId: string) => {
    try {
      const detail = await db.sales.getById(saleId);
      setPayingSaleId(saleId);
      setPayingSaleDetails(detail);
      const totalPaid = (detail?.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
      const due = Math.max(0, (detail?.grand_total || 0) - totalPaid);
      setPayAmount(parseFloat(due.toFixed(2)));
      setPayMethod('Cash');
      setPayTxnNo('');
      setPayNotes('');
      setPayModalOpen(true);
    } catch (err) { console.error(err); }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSaleId || payAmount <= 0) return;
    setPaySaving(true);
    try {
      await db.payments.create({
        sale_id: payingSaleId,
        amount: payAmount,
        payment_method: payMethod,
        transaction_no: payTxnNo || undefined,
        notes: payNotes || undefined
      });
      const detail = await db.sales.getById(payingSaleId);
      setPayingSaleDetails(detail);
      const totalPaid = (detail?.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
      const due = Math.max(0, (detail?.grand_total || 0) - totalPaid);
      setPayAmount(parseFloat(due.toFixed(2)));
      setPayTxnNo('');
      setPayNotes('');
      await fetchSales();
    } catch (err) { console.error(err); }
    finally { setPaySaving(false); }
  };

  // Sort & Filter
  const filteredSales = sales.filter(s => {
    const matchesSearch =
      s.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
      (s.customer && s.customer.name.toLowerCase().includes(search.toLowerCase())) ||
      (s.customer && s.customer.phone && s.customer.phone.includes(search));

    const matchesStatus = statusFilter ? s.order_status_id === statusFilter : true;
    const matchesPayment = paymentFilter ? s.payment_status === paymentFilter : true;

    return matchesSearch && matchesStatus && matchesPayment;
  }).sort((a, b) => {
    let multiplier = sortOrder === 'desc' ? -1 : 1;
    if (sortField === 'created_at') {
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * multiplier;
    } else {
      return (a.grand_total - b.grand_total) * multiplier;
    }
  });

  return (
    <PermissionGuard permission="Sales.View" fallback="ui">
      <div className="space-y-6 print:p-0 print:bg-white print:text-black">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Invoices</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">List</h1>
          </div>
          {hasPermission('Sales.Create') && (
            <button
              onClick={() => navigate('/sales/create')}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-md transition-all self-start sm:self-auto"
            >
              <Plus size={14} />
              Billing Checkout
            </button>
          )}
        </div>

        {/* TOOLBAR FILTERS */}
        <div className="flex flex-col lg:flex-row gap-3 bg-muted/30 p-3 rounded-xl border border-border print:hidden">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search by invoice no, customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-popover border border-border rounded-lg text-xs text-foreground"
            >
              <option value="">All Job Statuses</option>
              {statuses.map(st => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>

            {/* Payment Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 bg-popover border border-border rounded-lg text-xs text-foreground"
            >
              <option value="">All Payment Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>

            {/* Sort Field */}
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-') as [any, any];
                setSortField(field);
                setSortOrder(order);
              }}
              className="px-3 py-2 bg-popover border border-border rounded-lg text-xs text-foreground"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="grand_total-desc">Highest Bill</option>
              <option value="grand_total-asc">Lowest Bill</option>
            </select>

            <button
              onClick={(e) => {
                e.stopPropagation();
                exportSales(filteredSales);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-border text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all w-full sm:w-auto justify-center cursor-pointer"
            >
              <Download size={14} />
              Export Excel
            </button>
          </div>
        </div>

        {/* MAIN FULL VIEW */}
        <div className="w-full">
          
          {/* Sales Grid/Table */}
          <div className="w-full space-y-4 print:hidden">
            {loading && sales.length === 0 ? (
              <div className="space-y-3">
                <div className="h-10 bg-muted/30 rounded-xl animate-pulse" />
                <div className="h-28 bg-muted/30 rounded-xl animate-pulse" />
              </div>
            ) : (
              <div className="glass border border-border rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-secondary/40 border-b border-border text-muted-foreground text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-4 text-center w-12">SL</th>
                        <th className="px-5 py-4">Invoice No & Date</th>
                        <th className="px-5 py-4">Quotation Ref</th>
                        <th className="px-5 py-4">Customer</th>
                        <th className="px-5 py-4">Job Status</th>
                        <th className="px-5 py-4">Payment</th>
                        <th className="px-5 py-4 text-right">Bill Amount</th>
                        <th className="px-5 py-4 text-center w-36">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredSales.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">
                            No invoices matched selection filters.
                          </td>
                        </tr>
                      ) : (
                        filteredSales.map((s, idx) => {
                          const isSelected = selectedSaleId === s.id;
                          return (
                            <tr
                              key={s.id}
                              className={`hover:bg-muted/25 transition-colors ${
                                isSelected ? 'bg-secondary/25 font-medium' : ''
                              }`}
                            >
                              <td className="px-4 py-4 text-center text-muted-foreground font-semibold">
                                {idx + 1}
                              </td>
                              <td className="px-5 py-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary font-mono font-bold text-[11px] tracking-wide">
                                  # {s.invoice_no}
                                </span>
                                <div className="text-[10px] text-muted-foreground mt-1.5">
                                  {new Date(s.created_at).toLocaleString()} • {s.branch?.name}
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                {(s as any).quotation_id ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                    Linked
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">—</span>
                                )}
                              </td>
                              <td className="px-5 py-4">
                                {s.customer ? (
                                  <>
                                    <div className="text-foreground font-medium flex flex-wrap items-center gap-1.5">
                                      {s.person_name ? (
                                        <>
                                          <span>{s.person_name}</span>
                                          <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-semibold">
                                            Company: {s.customer.name}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <span>{s.customer.name}</span>
                                          {s.customer.company && (
                                            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-semibold">
                                              Billed to: {s.customer.company.name}
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{s.person_phone || s.customer.phone || 'No phone'}</div>
                                  </>
                                ) : (
                                  <div className="text-foreground font-medium">Walk-in Customer</div>
                                )}
                              </td>
                              <td className="px-5 py-4">
                                <span
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border"
                                  style={{
                                    borderColor: `${s.order_status?.color}25`,
                                    color: s.order_status?.color,
                                    backgroundColor: `${s.order_status?.color}10`
                                  }}
                                >
                                  {s.order_status?.name}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  s.payment_status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  s.payment_status === 'Partially Paid' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                  'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}>
                                  {s.payment_status}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-right font-bold text-foreground">
                                 {s.grand_total.toFixed(2)} AED
                              </td>
                              <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleOpenDetail(s.id)}
                                    className="px-2.5 py-1.5 bg-secondary hover:bg-secondary-foreground/10 text-foreground text-xs font-bold rounded-lg transition-all cursor-pointer"
                                  >
                                    Details
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const detail = await db.sales.getById(s.id);
                                      setSelectedSaleId(s.id);
                                      setSelectedSaleDetails(detail);
                                      setTimeout(() => {
                                        window.print();
                                      }, 400);
                                    }}
                                    className="p-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg transition-all inline-flex items-center justify-center align-middle cursor-pointer"
                                    title="Print Invoice"
                                  >
                                    <Printer size={13} />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const detail = await db.sales.getById(s.id);
                                      handleWhatsAppShare(detail);
                                    }}
                                    className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-lg transition-all inline-flex items-center justify-center align-middle cursor-pointer"
                                    title="Share Invoice Details on WhatsApp"
                                  >
                                    <MessageSquare size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditItems(s.id)}
                                    className="p-1.5 bg-violet-500/10 hover:bg-violet-500 text-violet-500 hover:text-white rounded-lg transition-all inline-flex items-center justify-center align-middle cursor-pointer"
                                    title="Edit Invoice Items"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleOpenPayModal(s.id)}
                                    className="p-1.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-600 hover:text-white rounded-lg transition-all inline-flex items-center justify-center align-middle cursor-pointer"
                                    title="Collect Payment / View Payment History"
                                  >
                                    <CreditCard size={13} />
                                  </button>
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

          {/* RIGHT DETAIL INVOICE SHEET (Pops up in a modal overlay) */}
          {selectedSaleDetails && (() => {
            const mainSale = Array.isArray(selectedSaleDetails)
              ? selectedSaleDetails[0]
              : selectedSaleDetails;
            
            const salesListForPrint = Array.isArray(selectedSaleDetails)
              ? selectedSaleDetails
              : [selectedSaleDetails];

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:p-0 print:bg-white overflow-y-auto">
                <div className="glass border border-border rounded-2xl p-6 shadow-2xl relative bg-white print:border-none print:shadow-none print:p-0 print:static print-invoice-sheet w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8">
                  
                  {/* Close Button */}
                  <button
                    onClick={() => { setSelectedSaleDetails(null); setSelectedSaleId(null); }}
                    className="absolute right-4 top-4 p-2 text-muted-foreground hover:text-foreground print:hidden bg-muted/40 rounded-full transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>

                  <div className="space-y-8 print:space-y-0">
                    {salesListForPrint.map((saleItem, idx) => (
                      <div 
                        key={saleItem.id}
                        className={`w-full ${idx > 0 ? 'print:page-break-before-always mt-8 print:mt-0 pt-8 print:pt-0 border-t border-dashed border-gray-300 print:border-none' : ''}`}
                      >
                        {/* Print Invoice branding header */}
                        <div className="text-center space-y-1 pb-4 border-b border-gray-300">
                          <div className="text-xl font-bold text-[#000ba0] font-serif tracking-wide italic">
                            مكتب عزيزي للكتابة وعمل الأختام ذ.م.م - فرع ١
                          </div>
                          <div className="text-lg font-black text-[#f28f00] tracking-wide italic uppercase">
                            AZIZI TYPING & STAMP MAKING Br. 1
                          </div>
                          <div className="text-xs text-black font-bold">
                            Mobile: 0542797933 • Email: azizitypingbr@gmail.com
                          </div>
                          <div className="text-[11px] text-gray-700 font-semibold">
                            Abu Dhabi, Musaffah M37, Near Irani Masjid
                          </div>
                        </div>

                        {/* Blue Banner Header */}
                        <div className="bg-[#000ba0] text-white flex items-center justify-between px-4 py-1.5 font-bold uppercase tracking-wider text-xs my-3 rounded-sm shadow-sm">
                          <span>Customer Invoice</span>
                          <span className="bg-[#f28f00] text-white px-3 py-0.5 rounded font-mono text-[11px] tracking-widest">
                            # {saleItem.invoice_no}
                          </span>
                        </div>

                        {/* Customer & Date Metadata Grid Table */}
                        <table className="w-full border-collapse border border-gray-300 text-xs my-3 bg-white">
                          <tbody>
                            <tr>
                              <td className="bg-[#f28f00] text-white font-bold px-3 py-2 border border-gray-300 w-1/4 uppercase tracking-wider">
                                Invoice To
                              </td>
                              <td className="px-3 py-2 border border-gray-300 text-black font-bold text-sm w-3/4" colSpan={3}>
                                {(() => {
                                  if (!saleItem.customer) return 'Walk-in Customer';
                                  if (saleItem.person_name) {
                                    return (
                                      <div className="flex flex-col">
                                        <span className="font-extrabold text-foreground">{saleItem.person_name}</span>
                                        <span className="text-xs text-[#000ba0] font-semibold mt-0.5">
                                          Company Account: {saleItem.customer.name} (Consolidated Billing)
                                        </span>
                                      </div>
                                    );
                                  }
                                  const parentName = saleItem.customer.company?.name;
                                  if (parentName) {
                                    return (
                                      <div className="flex flex-col">
                                        <span className="font-extrabold text-foreground">{saleItem.customer.name}</span>
                                        <span className="text-xs text-[#000ba0] font-semibold mt-0.5">
                                          Company Account: {parentName} (Consolidated Billing)
                                        </span>
                                      </div>
                                    );
                                  }
                                  return saleItem.customer.name;
                                })()}
                              </td>
                            </tr>
                            <tr>
                              <td className="bg-gray-100 text-gray-700 font-bold px-3 py-2 border border-gray-300 w-1/4">
                                Mr. / M/s:
                              </td>
                              <td className="px-3 py-2 border border-gray-300 text-black font-semibold w-1/4">
                                {saleItem.customer?.email || 'N/A'}
                              </td>
                              <td className="bg-[#f28f00] text-white font-bold px-3 py-2 border border-gray-300 w-1/4 uppercase tracking-wider text-center">
                                Date
                              </td>
                              <td className="px-3 py-2 border border-gray-300 text-black font-bold text-center w-1/4">
                                {new Date(saleItem.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                            <tr>
                              <td className="bg-gray-100 text-gray-700 font-bold px-3 py-2 border border-gray-300 w-1/4">
                                Invoice No:
                              </td>
                              <td className="px-3 py-2 border border-gray-300 text-primary font-bold w-1/4">
                                {saleItem.invoice_no}
                              </td>
                              <td className="bg-gray-100 text-gray-700 font-bold px-3 py-2 border border-gray-300 w-1/4 text-center">
                                Cashier
                              </td>
                              <td className="px-3 py-2 border border-gray-300 text-black font-semibold text-center w-1/4">
                                {saleItem.employee?.name || 'Staff'}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Items List Table */}
                        <div className="border border-gray-300 rounded-sm overflow-hidden my-3 text-xs bg-white">
                          <table className="w-full text-left border-collapse">
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
                                const items = saleItem.items || [];
                                const totalRows = 11;
                                const rows: React.ReactNode[] = [];
                                
                                // Render actual items
                                items.forEach((item: any, index: number) => {
                                  rows.push(
                                    <tr key={item.id} className="h-8 hover:bg-gray-50/50">
                                      <td className="px-3 py-1.5 text-center border-r border-gray-300 text-black font-semibold">{index + 1}</td>
                                      <td className="px-3 py-1.5 border-r border-gray-300 text-black font-bold text-left">{item.service?.name}</td>
                                      <td className="px-3 py-1.5 text-center border-r border-gray-300 text-black">{item.quantity}</td>
                                      <td className="px-3 py-1.5 text-right border-r border-gray-300 text-black">{item.unit_price.toFixed(2)}</td>
                                      <td className="px-3 py-1.5 text-right text-black font-bold">{item.subtotal.toFixed(2)}</td>
                                    </tr>
                                  );
                                });

                                // Render remaining empty rows up to 11
                                const emptyCount = Math.max(0, totalRows - items.length);
                                for (let i = 0; i < emptyCount; i++) {
                                  const rowNum = items.length + i + 1;
                                  rows.push(
                                    <tr key={`empty-${i}`} className="h-8">
                                      <td className="px-3 py-1.5 text-center border-r border-gray-300 text-black font-semibold">{rowNum}</td>
                                      <td className="px-3 py-1.5 border-r border-gray-300"></td>
                                      <td className="px-3 py-1.5 border-r border-gray-300"></td>
                                      <td className="px-3 py-1.5 border-r border-gray-300"></td>
                                      <td className="px-3 py-1.5 text-right"></td>
                                    </tr>
                                  );
                                }

                                return rows;
                              })()}
                            </tbody>
                            <tfoot>
                              <tr className="bg-[#f28f00] text-white font-bold border-t border-gray-300">
                                <td className="px-3 py-2 text-center border-r border-gray-300" colSpan={4}>
                                  Sub Total
                                </td>
                                <td className="px-3 py-2 text-right text-white font-bold">
                                  {saleItem.subtotal.toFixed(2)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Bottom Section: Remarks & Payment Record Side-by-Side */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3 items-stretch">
                          
                          {/* Left Column: Remarks/Comments */}
                          <div className="border border-gray-300 rounded-sm flex flex-col bg-white">
                            <div className="bg-gray-100 border-b border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700">
                              Remarks & Internal Notes
                            </div>
                            <div className="p-3 text-xs text-black font-semibold whitespace-pre-wrap flex-1 italic">
                              {saleItem.notes || 'Document completed successfully. Thank you for choosing AZIZI!'}
                            </div>
                          </div>

                          {/* Right Column: Payments Log */}
                          <div className="border border-gray-300 rounded-sm flex flex-col bg-white text-xs">
                            <div className="bg-[#000ba0] text-white text-center py-1.5 font-bold uppercase tracking-wider text-xs">
                              Payment Entry Record
                            </div>
                            <table className="w-full text-left border-collapse flex-1">
                              <thead className="bg-[#f28f00] text-white font-bold border-b border-gray-300">
                                <tr>
                                  <th className="px-3 py-1.5 border-r border-gray-300">Deposit Date</th>
                                  <th className="px-3 py-1.5 border-r border-gray-300">Type</th>
                                  <th className="px-3 py-1.5 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-300">
                                {(() => {
                                  const payments = saleItem.payments || [];
                                  const maxPayRows = 4;
                                  const rows: React.ReactNode[] = [];

                                  payments.forEach((p: any, idx: number) => {
                                    rows.push(
                                      <tr key={p.id || idx} className="h-7">
                                        <td className="px-3 py-1 border-r border-gray-300 text-black">
                                          {new Date(p.payment_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-3 py-1 border-r border-gray-300 text-black font-semibold capitalize">
                                          {p.payment_method}
                                        </td>
                                        <td className="px-3 py-1 text-right text-black font-semibold">
                                          {p.amount.toFixed(2)}
                                        </td>
                                      </tr>
                                    );
                                  });

                                  const emptyPayCount = Math.max(0, maxPayRows - payments.length);
                                  for (let i = 0; i < emptyPayCount; i++) {
                                    rows.push(
                                      <tr key={`empty-pay-${i}`} className="h-7">
                                        <td className="px-3 py-1 border-r border-gray-300"></td>
                                        <td className="px-3 py-1 border-r border-gray-300"></td>
                                        <td className="px-3 py-1 text-right"></td>
                                      </tr>
                                    );
                                  }

                                  return rows;
                                })()}
                              </tbody>
                            </table>

                            {/* Totals Summary */}
                            <div className="border-t border-gray-300">
                              {(() => {
                                const totalPaid = saleItem.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
                                const due = Math.max(0, saleItem.grand_total - totalPaid);
                                return (
                                  <div className="divide-y divide-gray-300">
                                    {/* Total Amount in Blue */}
                                    <div className="flex justify-between bg-[#000ba0] text-white font-bold px-3 py-2 text-xs">
                                      <span>Total Amount</span>
                                      <span>{saleItem.grand_total.toFixed(2)} AED</span>
                                    </div>
                                    {/* Paid Amount in White */}
                                    <div className="flex justify-between bg-white text-black font-bold px-3 py-2 text-xs">
                                      <span>Paid Amount</span>
                                      <span>{totalPaid.toFixed(2)} AED</span>
                                    </div>
                                    {/* Due Amount in Pink */}
                                    <div className={`flex justify-between font-extrabold px-3 py-2 text-xs ${
                                      due > 0 ? 'bg-[#fadbd8] text-[#78281f]' : 'bg-green-50 text-green-700'
                                    }`}>
                                      <span>Due Amount</span>
                                      <span>{due.toFixed(2)} AED</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons (Hidden on print) */}
                  <div className="flex flex-col gap-2 pt-3 border-t border-gray-300 print:hidden text-xs">
                    <div className="flex gap-2">
                      <button
                        onClick={handlePrint}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-border font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all cursor-pointer"
                      >
                        <Printer size={14} />
                        Print Receipts
                      </button>
                      <button
                        onClick={() => handleWhatsAppShare(mainSale)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md transition-colors cursor-pointer"
                      >
                        <MessageSquare size={14} />
                        WhatsApp Share
                      </button>
                      {hasPermission('Sales.Update') && (
                        <button
                          onClick={() => {
                            setNewStatusId(mainSale.order_status_id);
                            setStatusModalOpen(true);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold shadow-md transition-colors cursor-pointer"
                        >
                          <Activity size={14} />
                          Update Job Status
                        </button>
                      )}
                    </div>

                    {/* Due collection button */}
                    {(() => {
                      const totalPaid = mainSale.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
                      const due = mainSale.grand_total - totalPaid;
                      return due > 0 && hasPermission('Payments.Create') ? (
                        <button
                          onClick={() => navigate(`/payments/create?sale_id=${mainSale.id}`)}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-bold transition-colors cursor-pointer"
                        >
                          <CreditCard size={14} />
                          Collect Remaining due ({due.toFixed(2)} AED)
                        </button>
                      ) : null;
                    })()}
                  </div>

                  {/* Job Status Workflow history timeline */}
                  <div className="space-y-3 pt-3 border-t border-border/40 print:hidden">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Clock size={14} className="text-primary" />
                      Job Status Workflow Timeline (Invoice #{mainSale.invoice_no})
                    </h4>
                    
                    <div className="relative pl-4 border-l border-border/80 space-y-4">
                      {mainSale.history?.map((h: any) => (
                        <div key={h.id} className="relative text-[11px] text-muted-foreground">
                          {/* Bullet */}
                          <div
                            className="absolute -left-[21px] top-1 h-2 w-2 rounded-full border bg-background"
                            style={{ borderColor: h.new_status?.color || '#a78bfa' }}
                          />
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">
                              {h.new_status?.name}
                            </span>
                            <span className="text-[9px] text-muted-foreground/80">
                              {new Date(h.created_at).toLocaleDateString()} {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="mt-0.5">{h.remarks || 'No remarks recorded.'}</p>
                          <div className="text-[9px] text-primary/70 mt-0.5">By: {h.user?.name || 'Staff'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>


        {/* WORKFLOW STATUS UPDATE MODAL */}
        {statusModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:hidden">
            <div className="glass border border-border w-full max-w-md rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-bold text-foreground text-md">Update Job Progress Status</h3>
                <button onClick={() => setStatusModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleStatusChange} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Select Target Job Status</label>
                  <select
                    value={newStatusId}
                    onChange={(e) => setNewStatusId(e.target.value)}
                    className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground"
                    required
                  >
                    {statuses.map(st => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Status Update Remarks / Action Details</label>
                  <textarea
                    value={statusRemarks}
                    onChange={(e) => setStatusRemarks(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground resize-none"
                    placeholder="E.g. Stamp composed and ready for molding, printing completed..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setStatusModalOpen(false)}
                    className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold"
                  >
                    Transition Workflow
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* EDIT SALE ITEMS MODAL */}
        {editItemsModalOpen && editingSaleId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass border border-border rounded-2xl p-6 w-full max-w-xl bg-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => { setEditItemsModalOpen(false); setEditingSaleId(null); }}
                className="absolute right-4 top-4 p-2 text-muted-foreground hover:text-foreground bg-muted/40 rounded-full transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-2 mb-5">
                <Pencil size={16} className="text-violet-500" />
                <div>
                  <h3 className="text-sm font-bold text-foreground leading-none">Edit Invoice Items</h3>
                  <span className="text-[10px] text-muted-foreground mt-1 block">Add or remove line items from this sale invoice</span>
                </div>
              </div>

              {/* Current Items */}
              <div className="border border-border rounded-xl overflow-hidden mb-5">
                <div className="bg-muted/40 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                  Current Items ({editingSaleItems.length})
                </div>
                {editingSaleItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-5">No items on this invoice.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-muted/20">
                      <tr>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Service</th>
                        <th className="px-3 py-2 text-center text-muted-foreground font-semibold">Qty</th>
                        <th className="px-3 py-2 text-right text-muted-foreground font-semibold">Price</th>
                        <th className="px-3 py-2 text-right text-muted-foreground font-semibold">Total</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editingSaleItems.map((item: any) => (
                        <tr key={item.id} className="border-t border-border/40">
                          <td className="px-3 py-2 font-medium text-foreground">{item.service?.name || 'Service'}</td>
                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">{item.unit_price.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-bold">{item.subtotal.toFixed(2)}</td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={editSaving}
                              className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Add New Item */}
              <div className="border border-violet-500/20 bg-violet-500/5 rounded-xl p-4 space-y-3">
                <p className="text-[11px] font-bold text-violet-600 uppercase tracking-wider">Add New Item</p>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Service</label>
                  <select
                    value={addServiceId}
                    onChange={(e) => {
                      const svc = allServices.find(s => s.id === e.target.value);
                      setAddServiceId(e.target.value);
                      if (svc) setAddPrice(svc.price);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-violet-500 cursor-pointer"
                  >
                    <option value="">-- Select a Service --</option>
                    {allServices.map(s => (
                      <option key={s.id} value={s.id}>{s.name} — {s.price.toFixed(2)} AED</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={addQty}
                      onChange={(e) => setAddQty(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Unit Price (AED)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={addPrice}
                      onChange={(e) => setAddPrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground font-semibold">
                    Subtotal: <strong className="text-foreground">{(addQty * addPrice).toFixed(2)} AED</strong>
                  </span>
                  <button
                    onClick={handleAddItem}
                    disabled={editSaving || !addServiceId}
                    className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-xs font-bold rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    <Plus size={13} />
                    Add to Invoice
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border mt-4">
                <button
                  onClick={() => { setEditItemsModalOpen(false); setEditingSaleId(null); }}
                  className="px-4 py-2 bg-secondary hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
        {/* PAYMENT MODAL */}
        {payModalOpen && payingSaleDetails && (() => {
          const totalPaid = (payingSaleDetails.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
          const grandTotal = payingSaleDetails.grand_total || 0;
          const due = Math.max(0, grandTotal - totalPaid);
          const isPaid = due <= 0;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="glass border border-border rounded-2xl p-6 w-full max-w-lg bg-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => { setPayModalOpen(false); setPayingSaleId(null); setPayingSaleDetails(null); }}
                  className="absolute right-4 top-4 p-2 text-muted-foreground hover:text-foreground bg-muted/40 rounded-full transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>

                <div className="flex items-center gap-2 mb-5">
                  <CreditCard size={16} className="text-emerald-600" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground leading-none">Payment — #{payingSaleDetails.invoice_no}</h3>
                    <span className="text-[10px] text-muted-foreground mt-1 block">{payingSaleDetails.customer?.name || 'Walk-in Customer'}</span>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-muted/30 border border-border rounded-xl p-3 text-center">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Grand Total</div>
                    <div className="text-sm font-bold text-foreground">{grandTotal.toFixed(2)} <span className="text-[10px] text-muted-foreground">AED</span></div>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-center">
                    <div className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wider mb-1">Total Paid</div>
                    <div className="text-sm font-bold text-emerald-600">{totalPaid.toFixed(2)} <span className="text-[10px]">AED</span></div>
                  </div>
                  <div className={`border rounded-xl p-3 text-center ${isPaid ? 'bg-blue-500/5 border-blue-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isPaid ? 'text-blue-500/70' : 'text-rose-500/70'}`}>Outstanding Due</div>
                    <div className={`text-sm font-bold ${isPaid ? 'text-blue-500' : 'text-rose-500'}`}>{due.toFixed(2)} <span className="text-[10px]">AED</span></div>
                  </div>
                </div>

                {/* Payment History */}
                <div className="border border-border rounded-xl overflow-hidden mb-5">
                  <div className="bg-muted/40 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                    Payment History ({(payingSaleDetails.payments || []).length})
                  </div>
                  {(payingSaleDetails.payments || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No payments recorded yet.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-muted/20">
                        <tr>
                          <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Date</th>
                          <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Method</th>
                          <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Txn #</th>
                          <th className="px-3 py-2 text-right text-muted-foreground font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(payingSaleDetails.payments || []).map((p: any, idx: number) => (
                          <tr key={p.id || idx} className="border-t border-border/40">
                            <td className="px-3 py-2 text-muted-foreground">{new Date(p.payment_date || p.created_at).toLocaleDateString()}</td>
                            <td className="px-3 py-2 font-medium text-foreground">{p.payment_method}</td>
                            <td className="px-3 py-2 text-muted-foreground font-mono">{p.transaction_no || '—'}</td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-600">{p.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Collect Payment Form */}
                {!isPaid ? (
                  <form onSubmit={handleSubmitPayment} className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-4 space-y-3">
                    <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Collect Payment</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Amount (AED)</label>
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          max={due}
                          value={payAmount}
                          onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-bold text-foreground focus:ring-1 focus:ring-emerald-500"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Method</label>
                        <select
                          value={payMethod}
                          onChange={(e) => setPayMethod(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                        >
                          <option value="Cash">Cash</option>
                          <option value="Card">Card</option>
                          <option value="Mobile Banking">Mobile Banking</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Transaction / Reference No.</label>
                      <input
                        type="text"
                        value={payTxnNo}
                        onChange={(e) => setPayTxnNo(e.target.value)}
                        placeholder="Optional — e.g. bank ref, receipt no"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Notes</label>
                      <input
                        type="text"
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                        placeholder="Optional remarks about this payment"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={paySaving || payAmount <= 0}
                        className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer"
                      >
                        <CreditCard size={13} />
                        Record Payment
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="text-center py-3 text-xs font-bold text-emerald-600 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                    ✓ Invoice fully paid. No outstanding balance.
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-border mt-4">
                  <button
                    onClick={() => { setPayModalOpen(false); setPayingSaleId(null); setPayingSaleDetails(null); }}
                    className="px-4 py-2 bg-secondary hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </PermissionGuard>
  );
};
