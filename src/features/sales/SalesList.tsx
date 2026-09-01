import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/db';
import type { OrderStatus, Account } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exportSales } from '../../lib/excelExport';
import {
  Plus,
  Search,
  Printer,
  ReceiptText,
  Activity,
  Clock,
  X,
  CreditCard,
  MessageSquare,
  Download,
  Pencil,
  Trash2,
  Wallet,
  Building2,
  User
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
  const { hasPermission, activeBranchId, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const printId = searchParams.get('print');

  // Data States
  const [sales, setSales] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<OrderStatus[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'today' | 'unpaid' | 'completed'>('all');
  const [sortField, setSortField] = useState<'created_at' | 'grand_total'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Detail Modal States
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedSaleDetails, setSelectedSaleDetails] = useState<any | null>(null);
  const selectedSaleIdRef = useRef<string | null>(null);
  selectedSaleIdRef.current = selectedSaleId;
  const lastAutoPrintedRef = useRef<string | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatusId, setNewStatusId] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');

  // Edit Invoice & Per-Service Expenses Modal States
  const [editItemsModalOpen, setEditItemsModalOpen] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<any | null>(null);
  const [editingSaleItems, setEditingSaleItems] = useState<any[]>([]);
  const [selectedServiceItemId, setSelectedServiceItemId] = useState<string | null>(null);
  const [serviceExpenseModalOpen, setServiceExpenseModalOpen] = useState(false);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [addServiceId, setAddServiceId] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [addPrice, setAddPrice] = useState(0);
  const [editSaving, setEditSaving] = useState(false);

  // New Gov Fee / Expense form for selected service:
  const [svcExpenseAmount, setSvcExpenseAmount] = useState<number>(0);
  const [svcExpenseAccountId, setSvcExpenseAccountId] = useState('');
  const [svcExpenseDesc, setSvcExpenseDesc] = useState('');
  const [svcExpenseSaving, setSvcExpenseSaving] = useState(false);

  // Payment Modal States
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingSaleId, setPayingSaleId] = useState<string | null>(null);
  const [payingSaleDetails, setPayingSaleDetails] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payAccountId, setPayAccountId] = useState('');
  const [payTxnNo, setPayTxnNo] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payPersonName, setPayPersonName] = useState('');
  const [paySaving, setPaySaving] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // Shift & Overview Metrics
  const todaySales = sales.filter(s => s.created_at?.startsWith(todayStr));
  const todayTotalAmount = todaySales.reduce((sum, s) => sum + (s.grand_total || 0), 0);
  const todayPaidAmount = todaySales.reduce((sum, s) => {
    const paid = (s.payments || []).reduce((pSum: number, p: any) => pSum + (p.amount || 0), 0);
    return sum + paid;
  }, 0);
  const totalUnpaidDues = sales.reduce((sum, s) => {
    const paid = (s.payments || []).reduce((pSum: number, p: any) => pSum + (p.amount || 0), 0);
    return sum + Math.max(0, (s.grand_total || 0) - paid);
  }, 0);

  const handleCloseDetail = () => {
    selectedSaleIdRef.current = null;
    setSelectedSaleDetails(null);
    setSelectedSaleId(null);
  };

  const fetchSales = async () => {
    setLoading(true);
    try {
      const branchFilterVal = activeBranchId === 'all' ? undefined : activeBranchId;
      const [sData, osData, aData] = await Promise.all([
        db.sales.getAll(branchFilterVal),
        db.orderStatuses.getAll(),
        db.accounts.getAll(branchFilterVal)
      ]);
      
      setSales(sData);
      setStatuses(osData);
      setAccounts(aData);

      // Refresh Detail Panel if still actively open
      const currentId = selectedSaleIdRef.current;
      if (currentId) {
        const detail = await db.sales.getById(currentId);
        if (selectedSaleIdRef.current === currentId) {
          setSelectedSaleDetails(detail);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [activeBranchId]);

  useEffect(() => {
    if (printId && lastAutoPrintedRef.current !== printId) {
      lastAutoPrintedRef.current = printId;
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
            selectedSaleIdRef.current = ids[0];
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedSaleDetails) {
        handleCloseDetail();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSaleDetails]);

  const handleOpenDetail = async (id: string) => {
    setSelectedSaleId(id);
    selectedSaleIdRef.current = id;
    setLoading(true);
    try {
      const detail = await db.sales.getById(id);
      if (selectedSaleIdRef.current === id) {
        setSelectedSaleDetails(detail);
      }
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

  const handleOpenEditItems = async (saleId: string, preselectedItemId?: string) => {
    try {
      setEditingSaleId(saleId);
      const detail = await db.sales.getById(saleId);
      setEditingSale(detail);
      const items = detail?.items || [];
      setEditingSaleItems(items);
      const svcs = await db.services.getAll();
      setAllServices(svcs.filter(s => s.status === 'Active'));
      setAddServiceId('');
      setAddQty(1);
      setAddPrice(0);

      const defaultCard = accounts.find(a => a.type === 'card') || accounts[0];
      setSvcExpenseAccountId(defaultCard?.id || '');
      setSvcExpenseAmount(0);
      setSvcExpenseDesc('');

      if (preselectedItemId && items.some((i: any) => i.id === preselectedItemId)) {
        setSelectedServiceItemId(preselectedItemId);
      } else if (items.length > 0) {
        setSelectedServiceItemId(items[0].id);
      } else {
        setSelectedServiceItemId(null);
      }

      setEditItemsModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenServiceExpenseModal = (serviceItemId: string) => {
    setSelectedServiceItemId(serviceItemId);
    const defaultCard = accounts.find(a => a.type === 'card') || accounts[0];
    setSvcExpenseAccountId(defaultCard?.id || '');
    setSvcExpenseAmount(0);
    setSvcExpenseDesc('');
    setServiceExpenseModalOpen(true);
  };

  const handleAddServiceExpense = async () => {
    if (!editingSaleId || !selectedServiceItemId || svcExpenseAmount <= 0) return;
    setSvcExpenseSaving(true);
    try {
      await db.sales.addServiceExpense({
        sale_id: editingSaleId,
        sale_item_id: selectedServiceItemId,
        amount: Number(svcExpenseAmount),
        account_id: svcExpenseAccountId || undefined,
        description: svcExpenseDesc.trim() || undefined
      });

      const detail = await db.sales.getById(editingSaleId);
      setEditingSale(detail);
      const items = detail?.items || [];
      setEditingSaleItems(items);

      setSvcExpenseAmount(0);
      setSvcExpenseDesc('');
      await fetchSales();
    } catch (err) {
      console.error('Failed to add service expense:', err);
    } finally {
      setSvcExpenseSaving(false);
    }
  };

  const handleDeleteServiceExpense = async (expenseId: string) => {
    if (!editingSaleId || !window.confirm('Delete this expense? The card/account balance will be restored.')) return;
    setSvcExpenseSaving(true);
    try {
      await db.sales.deleteServiceExpense(expenseId);
      const detail = await db.sales.getById(editingSaleId);
      setEditingSale(detail);
      const items = detail?.items || [];
      setEditingSaleItems(items);
      await fetchSales();
    } catch (err) {
      console.error('Failed to delete service expense:', err);
    } finally {
      setSvcExpenseSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!editingSaleId || !addServiceId || addQty <= 0) return;
    setEditSaving(true);
    try {
      // Automatically assign the service to this invoice's member
      const memberName = editingSale?.person_name || editingSaleItems[0]?.person_name || undefined;

      await db.sales.addItem(editingSaleId, {
        service_id: addServiceId,
        quantity: addQty,
        unit_price: addPrice,
        person_name: memberName,
        staff_id: user?.id
      });
      const detail = await db.sales.getById(editingSaleId);
      setEditingSale(detail);
      const items = detail?.items || [];
      setEditingSaleItems(items);
      setAddServiceId('');
      setAddQty(1);
      setAddPrice(0);

      if (!selectedServiceItemId && items.length > 0) {
        setSelectedServiceItemId(items[items.length - 1].id);
      }
      await fetchSales();
    } catch (err) {
      console.error(err);
    } finally {
      setEditSaving(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!editingSaleId || !window.confirm('Remove this service item from the invoice? Any linked card expenses will be refunded.')) return;
    setEditSaving(true);
    try {
      await db.sales.removeItem(editingSaleId, itemId);
      const detail = await db.sales.getById(editingSaleId);
      setEditingSale(detail);
      const items = detail?.items || [];
      setEditingSaleItems(items);
      if (selectedServiceItemId === itemId) {
        setSelectedServiceItemId(items[0]?.id || null);
      }
      await fetchSales();
    } catch (err) {
      console.error(err);
    } finally {
      setEditSaving(false);
    }
  };

  const handleOpenPayModal = async (saleId: string) => {
    try {
      const detail = await db.sales.getById(saleId);
      setPayingSaleId(saleId);
      setPayingSaleDetails(detail);
      const totalPaid = (detail?.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
      const due = Math.max(0, (detail?.grand_total || 0) - totalPaid);
      const defaultDrawer = accounts.find(a => a.type === 'cash_drawer') || accounts[0];
      setPayAmount(parseFloat(due.toFixed(2)));
      setPayAccountId(defaultDrawer?.id || '');
      setPayTxnNo('');
      setPayNotes('');
      setPayPersonName(detail?.person_name || '');
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
        account_id: payAccountId || undefined,
        transaction_no: payTxnNo || undefined,
        notes: payNotes || undefined,
        person_name: payPersonName.trim() || undefined
      });
      const detail = await db.sales.getById(payingSaleId);
      setPayingSaleDetails(detail);
      if (editingSaleId && editingSaleId === payingSaleId) {
        setEditingSale(detail);
        setEditingSaleItems(detail?.items || []);
      }
      const totalPaid = (detail?.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
      const due = Math.max(0, (detail?.grand_total || 0) - totalPaid);
      setPayAmount(parseFloat(due.toFixed(2)));
      setPayTxnNo('');
      setPayNotes('');
      setPayPersonName('');
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

    // Quick filter check
    let matchesQuick = true;
    if (quickFilter === 'today') {
      matchesQuick = s.created_at?.startsWith(todayStr);
    } else if (quickFilter === 'unpaid') {
      matchesQuick = s.payment_status !== 'Paid';
    } else if (quickFilter === 'completed') {
      matchesQuick = s.order_status?.name?.toLowerCase().includes('complete');
    }

    return matchesSearch && matchesStatus && matchesPayment && matchesQuick;
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
      <div className="space-y-5 print:p-0 print:bg-white print:text-black">
        
        {/* HEADER & SHIFT METRICS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Invoices & Billing</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Invoices Hub</h1>
          </div>
          {hasPermission('Sales.Create') && (
            <button
              onClick={() => navigate('/sales/create')}
              className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition-all self-start sm:self-auto cursor-pointer"
            >
              <Plus size={16} />
              <span>Create New Invoice</span>
              <kbd className="bg-white/20 text-white border-white/30 text-[9px] px-1 py-0.5">F2</kbd>
            </button>
          )}
        </div>

        {/* SHIFT SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
          <div className="glass p-3.5 rounded-xl border border-border">
            <div className="text-[11px] font-bold text-black uppercase">Today's Invoices</div>
            <div className="text-xl font-extrabold text-black font-heading mt-0.5">{todaySales.length}</div>
          </div>
          <div className="glass p-3.5 rounded-xl border border-border">
            <div className="text-[11px] font-bold text-black uppercase">Today's Total</div>
            <div className="text-xl font-extrabold text-black font-heading mt-0.5">{todayTotalAmount.toFixed(2)} <span className="text-xs font-semibold text-black/70">AED</span></div>
          </div>
          <div className="glass p-3.5 rounded-xl border border-border">
            <div className="text-[11px] font-bold text-emerald-700 uppercase">Today Collected</div>
            <div className="text-xl font-extrabold text-emerald-600 font-heading mt-0.5">{todayPaidAmount.toFixed(2)} <span className="text-xs font-semibold text-black/70">AED</span></div>
          </div>
          <div className="glass p-3.5 rounded-xl border border-border">
            <div className="text-[11px] font-bold text-rose-700 uppercase">Outstanding Dues</div>
            <div className="text-xl font-extrabold text-rose-600 font-heading mt-0.5">{totalUnpaidDues.toFixed(2)} <span className="text-xs font-semibold text-black/70">AED</span></div>
          </div>
        </div>

        {/* TOOLBAR & FAST FILTER CHIPS */}
        <div className="bg-card p-3 rounded-xl border border-border space-y-2.5 print:hidden shadow-sm">
          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setQuickFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                quickFilter === 'all'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted/50 text-slate-700 hover:text-black hover:bg-slate-200'
              }`}
            >
              All Invoices ({sales.length})
            </button>
            <button
              onClick={() => setQuickFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                quickFilter === 'today'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted/50 text-slate-700 hover:text-black hover:bg-slate-200'
              }`}
            >
              <span>Today's Shift</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 font-bold">{todaySales.length}</span>
            </button>
            <button
              onClick={() => setQuickFilter('unpaid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                quickFilter === 'unpaid'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'bg-muted/50 text-rose-700 hover:text-rose-900 hover:bg-rose-100'
              }`}
            >
              <span>Unpaid & Dues</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-200 font-bold">
                {sales.filter(s => s.payment_status !== 'Paid').length}
              </span>
            </button>
            <button
              onClick={() => setQuickFilter('completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                quickFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-muted/50 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100'
              }`}
            >
              <span>Completed</span>
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-2.5 pt-1 border-t border-border/60">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
              <input
                type="text"
                placeholder="Search invoice #, customer name, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
              />
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-2 bg-popover border border-border rounded-lg text-xs font-medium text-foreground"
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
                className="px-2.5 py-2 bg-popover border border-border rounded-lg text-xs font-medium text-foreground"
              >
                <option value="">All Payments</option>
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
                className="px-2.5 py-2 bg-popover border border-border rounded-lg text-xs font-medium text-foreground"
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
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-border text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all w-full sm:w-auto justify-center cursor-pointer"
                title="Export list to Excel"
              >
                <Download size={14} />
                <span>Excel</span>
              </button>
            </div>
          </div>
        </div>


        {/* MAIN FULL VIEW */}
        <div className="w-full">
          
          {/* Sales Grid/Table */}
          <div className="w-full space-y-4 print:hidden">
            {loading && sales.length === 0 ? (
              <div className="space-y-3">
                <div className="h-10 bg-muted/30 rounded-md animate-pulse" />
                <div className="h-28 bg-muted/30 rounded-md animate-pulse" />
              </div>
            ) : (
              <div className="table-container">
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-center" style={{ width: '45px' }}>SL</th>
                        <th>Invoice ID & Time</th>
                        <th>Customer</th>
                        <th>Members / Persons</th>
                        <th>Job Status</th>
                        <th>Payment Status</th>
                        <th className="text-right">Net Value</th>
                        <th className="text-center" style={{ width: '160px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-500">
                            <div className="max-w-xs mx-auto space-y-1">
                              <div className="font-bold text-black text-sm font-heading">No matching invoices found</div>
                              <div className="text-xs text-slate-500">Try adjusting your search query or quick filter chips above.</div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredSales.map((s, idx) => {
                          const isSelected = selectedSaleId === s.id;
                          const totalPaid = (s.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                          const remainingDue = Math.max(0, (s.grand_total || 0) - totalPaid);
                          const memberNames = Array.from(new Set([
                            ...(s.person_name ? [s.person_name.trim()] : []),
                            ...((s.items || []).map((item: any) => item.person_name?.trim()).filter(Boolean))
                          ])).filter(Boolean);

                          return (
                            <tr
                              key={s.id}
                              className={`transition-colors cursor-pointer ${
                                isSelected ? 'bg-primary/5 font-medium' : ''
                              }`}
                              onClick={() => handleOpenDetail(s.id)}
                            >
                              {/* Serial */}
                              <td className="text-center font-semibold text-xs text-slate-500">
                                {idx + 1}
                              </td>

                              {/* Invoice & Time */}
                              <td>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-bold text-xs tracking-tight text-black bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200">
                                    #{s.invoice_no}
                                  </span>
                                  {(s as any).quotation_id && (
                                    <span className="badge badge-Draft text-[10px]">
                                      Quote
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-1.5 font-medium">
                                  <span className="text-black font-semibold">{new Date(s.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                  <span className="text-slate-300">•</span>
                                  <span>{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  {s.branch?.name && (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-semibold text-slate-700 ml-0.5 border border-slate-200 truncate max-w-[90px]">
                                      {s.branch.name}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Customer */}
                              <td>
                                <div className="font-bold text-black text-xs leading-tight">
                                  {s.customer ? (
                                    <span>{s.customer.name}</span>
                                  ) : (
                                    <span className="text-slate-500 font-normal italic">Walk-in Customer</span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap items-center gap-1.5">
                                  {s.customer?.phone ? (
                                    <span className="font-medium">{s.customer?.phone}</span>
                                  ) : null}
                                  {s.customer?.customer_type === 'company' && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 font-semibold border border-sky-200">
                                      Company
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Members / Persons */}
                              <td>
                                {memberNames.length > 0 ? (
                                  <div className="space-y-0.5">
                                    <div className="font-semibold text-xs text-black max-w-[180px] truncate" title={memberNames.join(', ')}>
                                      {memberNames.join(', ')}
                                    </div>
                                    {memberNames.length > 1 && (
                                      <div className="text-[10px] text-slate-500 font-medium">
                                        {memberNames.length} persons
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">—</span>
                                )}
                              </td>

                              {/* Job Status */}
                              <td>
                                <span
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold border font-heading"
                                  style={{
                                    borderColor: `${s.order_status?.color || '#10b981'}40`,
                                    color: s.order_status?.color || '#10b981',
                                    backgroundColor: `${s.order_status?.color || '#10b981'}10`
                                  }}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: s.order_status?.color || '#10b981' }}
                                  />
                                  {s.order_status?.name || 'Processing'}
                                </span>
                              </td>

                              {/* Payment Status & Due / Advance */}
                              <td>
                                {totalPaid > s.grand_total ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-900 border border-sky-300 font-heading">
                                      Advance Paid
                                    </span>
                                    <div className="text-[11px] font-black text-sky-800 mt-0.5 font-heading">
                                      +{(totalPaid - s.grand_total).toFixed(2)} AED
                                    </div>
                                  </div>
                                ) : remainingDue <= 0 && (s.grand_total > 0 || (s.payments || []).length > 0) ? (
                                  <span className="badge badge-Paid">
                                    Paid Full
                                  </span>
                                ) : totalPaid > 0 ? (
                                  <div>
                                    <span className="badge badge-Partial">
                                      Partial ({totalPaid.toFixed(2)} AED)
                                    </span>
                                    <div className="text-[11px] font-bold text-amber-700 mt-0.5 font-heading">
                                      Due: {remainingDue.toFixed(2)} AED
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="badge badge-Unpaid">
                                      Unpaid
                                    </span>
                                    <div className="text-[11px] font-bold text-rose-700 mt-0.5 font-heading">
                                      Due: {remainingDue.toFixed(2)} AED
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* Grand Total */}
                              <td className="text-right font-black text-black text-sm font-heading">
                                {s.grand_total.toFixed(2)} <span className="text-[10px] font-medium text-slate-500">AED</span>
                              </td>

                              {/* Quick Actions */}
                              <td onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleOpenPayModal(s.id)}
                                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                                      remainingDue > 0
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                        : totalPaid > s.grand_total
                                        ? 'bg-sky-600 hover:bg-sky-700 text-white'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    }`}
                                    title={
                                      remainingDue > 0
                                        ? `Collect Payment (${remainingDue.toFixed(2)} AED Due)`
                                        : totalPaid > s.grand_total
                                        ? `Advance Received (+${(totalPaid - s.grand_total).toFixed(2)} AED)`
                                        : "View Payment History"
                                    }
                                  >
                                    <CreditCard size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleOpenDetail(s.id)}
                                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-black flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="View Full Details"
                                  >
                                    <Clock size={13} />
                                  </button>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const detail = await db.sales.getById(s.id);
                                      setSelectedSaleId(s.id);
                                      selectedSaleIdRef.current = s.id;
                                      setSelectedSaleDetails(detail);
                                      setTimeout(() => {
                                        window.print();
                                      }, 400);
                                    }}
                                    className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="Print Invoice"
                                  >
                                    <Printer size={13} />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const detail = await db.sales.getById(s.id);
                                      handleWhatsAppShare(detail);
                                    }}
                                    className="w-7 h-7 rounded-full bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="Send WhatsApp Receipt"
                                  >
                                    <MessageSquare size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditItems(s.id)}
                                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-black flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="Edit Invoice Items"
                                  >
                                    <Pencil size={13} />
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
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md print:p-0 print:bg-white print:static overflow-y-auto"
                onClick={(e) => {
                  if (e.target === e.currentTarget) handleCloseDetail();
                }}
              >
                <div className="relative w-full max-w-4xl max-h-[94vh] overflow-y-auto print:max-h-none print:overflow-visible my-auto space-y-4 print:space-y-0 print:my-0 print:w-full">
                  
                  {/* TOP CONTROL TOOLBAR (Hidden in Print / PDF) */}
                  <div className="sticky top-0 z-20 flex items-center justify-between p-3.5 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-xl print:hidden">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <ReceiptText size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-foreground">Invoice Document Preview</div>
                        <div className="text-[11px] text-muted-foreground">Invoice #{mainSale.invoice_no} • {new Date(mainSale.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer"
                      >
                        <Printer size={14} />
                        <span>Print / Save PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleWhatsAppShare(mainSale)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                      >
                        <MessageSquare size={14} />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCloseDetail}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl transition-colors cursor-pointer"
                        title="Close (Esc)"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* PRINTABLE INVOICE PAPER SHEET */}
                  <div className="print-invoice-sheet bg-white text-black p-6 sm:p-8 rounded-2xl shadow-2xl border border-border/80 print:border-none print:shadow-none print:p-0 print:rounded-none space-y-8 print:space-y-0">
                    {salesListForPrint.map((saleItem, idx) => (
                      <div 
                        key={saleItem.id}
                        className={`w-full ${idx > 0 ? 'print:page-break-before-always mt-8 print:mt-0 pt-8 print:pt-0 border-t border-dashed border-gray-300 print:border-none' : ''}`}
                      >
                        {/* Print Invoice branding header with raw logo */}
                        <div className="flex items-center justify-between pb-3 border-b border-gray-300 gap-3">
                          <img src="/logo.png" alt="AZIZI Logo" className="w-14 h-14 object-contain shrink-0" />
                          <div className="text-center flex-1 space-y-0.5">
                            <div className="text-lg font-bold text-[#000ba0] font-serif tracking-wide italic">
                              مكتب عزيزي للكتابة وعمل الأختام ذ.م.م - فرع ١
                            </div>
                            <div className="text-base font-black text-[#f28f00] tracking-wide italic uppercase">
                              AZIZI TYPING &amp; STAMP MAKING Br. 1
                            </div>
                            <div className="text-xs text-black font-bold">
                              Mobile: 0542797933 • Email: azizitypingbr@gmail.com
                            </div>
                            <div className="text-[11px] text-gray-700 font-semibold">
                              Abu Dhabi, Musaffah M37, Near Irani Masjid
                            </div>
                          </div>
                          <div className="w-14 shrink-0" />
                        </div>

                        {/* Blue Banner Header */}
                        <div className="bg-[#000ba0] text-white flex items-center justify-between px-4 py-1.5 font-bold uppercase tracking-wider text-xs my-3 rounded-sm shadow-sm">
                          <span>Customer Invoice</span>
                          <span className="bg-[#f28f00] text-white px-3 py-0.5 rounded font-mono text-[11px] tracking-widest">
                            # {saleItem.invoice_no}
                          </span>
                        </div>

                        {/* Customer & Date Metadata Grid Table */}
                        <table className="w-full border-collapse border border-gray-300 text-xs my-3 bg-white text-black">
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
                                        <span className="font-extrabold text-black">{saleItem.person_name}</span>
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
                                        <span className="font-extrabold text-black">{saleItem.customer.name}</span>
                                        <span className="text-xs text-[#000ba0] font-semibold mt-0.5">
                                          Company Account: {parentName} (Consolidated Billing)
                                        </span>
                                      </div>
                                    );
                                  }
                                  return <span className="text-black">{saleItem.customer.name}</span>;
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
                              <td className="px-3 py-2 border border-gray-300 text-[#000ba0] font-bold w-1/4">
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
                                <th className="px-3 py-2.5 text-center border-r border-gray-300 w-[5%] print:w-[6%]">No</th>
                                <th className="px-3 py-2.5 text-center border-r border-gray-300 w-[13%] print:w-[14%]">Date</th>
                                <th className="px-3 py-2.5 border-r border-gray-300 w-[38%] print:w-[47%]">Description of Service</th>
                                <th className="px-3 py-2.5 text-center border-r border-gray-300 w-[14%] print:hidden">Staff</th>
                                <th className="px-3 py-2.5 text-center border-r border-gray-300 w-[8%] print:w-[9%]">Qty</th>
                                <th className="px-3 py-2.5 text-right border-r border-gray-300 w-[10%] print:w-[10%]">Rate</th>
                                <th className="px-3 py-2.5 text-right w-[12%] print:w-[14%]">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-300">
                              {(() => {
                                const items = saleItem.items || [];
                                const totalRows = 11;
                                const rows: React.ReactNode[] = [];
                                
                                // Render actual items
                                items.forEach((item: any, index: number) => {
                                  const itemDate = item.service_date 
                                    ? new Date(item.service_date).toLocaleDateString()
                                    : new Date(item.created_at || saleItem.created_at).toLocaleDateString();
                                  rows.push(
                                    <tr key={item.id} className="h-8 hover:bg-gray-50/50">
                                      <td className="px-3 py-1.5 text-center border-r border-gray-300 text-black font-semibold">{index + 1}</td>
                                      <td className="px-3 py-1.5 text-center border-r border-gray-300 text-black font-medium">{itemDate}</td>
                                      <td className="px-3 py-1.5 border-r border-gray-300 text-black font-bold text-left">
                                         <div>{item.service?.name}</div>
                                         {item.person_name && (
                                           <div className="font-normal text-[11px] text-gray-700 italic">
                                             👤 For: {item.person_name}
                                           </div>
                                         )}
                                         {item.notes && (
                                           <div className="font-normal text-[10px] text-gray-600">
                                             📝 Note / Ref: {item.notes}
                                           </div>
                                         )}
                                      </td>
                                      <td className="px-3 py-1.5 text-center border-r border-gray-300 text-black text-[11px] font-medium print:hidden">
                                        <span className="px-2 py-0.5 rounded bg-muted/80 text-foreground font-semibold border border-border/60">
                                          {item.staff?.name || item.staff_id || saleItem.employee?.name || 'Staff'}
                                        </span>
                                      </td>
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
                                      <td className="px-3 py-1.5 border-r border-gray-300 print:hidden"></td>
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
                              <tr className="bg-[#f28f00] text-white font-bold border-t border-gray-300 print:hidden">
                                <td className="px-3 py-2 text-center border-r border-gray-300" colSpan={6}>
                                  Sub Total
                                </td>
                                <td className="px-3 py-2 text-right text-white font-bold">
                                  {saleItem.subtotal.toFixed(2)}
                                </td>
                              </tr>
                              <tr className="bg-[#f28f00] text-white font-bold border-t border-gray-300 hidden print:table-row">
                                <td className="px-3 py-2 text-center border-r border-gray-300" colSpan={5}>
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
                              Remarks &amp; Internal Notes
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

                                  payments.forEach((p: any, pIdx: number) => {
                                    rows.push(
                                      <tr key={p.id || pIdx} className="h-7">
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

                  {/* BOTTOM WORKFLOW & ACTIONS PANEL (Hidden on Print / PDF) */}
                  <div className="p-4 bg-card border border-border rounded-2xl shadow-xl space-y-4 print:hidden">
                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {hasPermission('Sales.Update') && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewStatusId(mainSale.order_status_id);
                            setStatusModalOpen(true);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold shadow-md transition-colors cursor-pointer"
                        >
                          <Activity size={14} />
                          <span>Update Job Status</span>
                        </button>
                      )}

                      {/* Due collection button */}
                      {(() => {
                        const totalPaid = mainSale.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
                        const due = mainSale.grand_total - totalPaid;
                        return due > 0 && hasPermission('Payments.Create') ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/payments/create?sale_id=${mainSale.id}`)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold transition-colors cursor-pointer"
                          >
                            <CreditCard size={14} />
                            <span>Collect Due ({due.toFixed(2)} AED)</span>
                          </button>
                        ) : null;
                      })()}
                    </div>

                    {/* Job Status Workflow history timeline */}
                    <div className="space-y-3 pt-3 border-t border-border/60">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Clock size={14} className="text-primary" />
                        Job Status Workflow Timeline (Invoice #{mainSale.invoice_no})
                      </h4>
                      
                      <div className="relative pl-4 border-l border-border/80 space-y-3">
                        {mainSale.history?.map((h: any) => (
                          <div key={h.id} className="relative text-[11px] text-muted-foreground">
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
        {/* EDIT INVOICE & SERVICES MODAL */}
        {editItemsModalOpen && editingSaleId && (() => {
          const totalSubtotal = editingSaleItems.reduce((sum: number, item: any) => sum + (Number(item.subtotal) || (Number(item.unit_price) * Number(item.quantity)) || 0), 0);
          const totalGovCost = editingSaleItems.reduce((sum: number, item: any) => {
            const itemExps = item.expenses || [];
            const itemExpTotal = itemExps.length > 0
              ? itemExps.reduce((eSum: number, e: any) => eSum + (Number(e.amount) || 0), 0)
              : Number(item.expense || 0);
            return sum + itemExpTotal;
          }, 0);
          const totalNetProfit = totalSubtotal - totalGovCost;
          const totalPaid = (editingSale?.payments || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
          const remainingDue = Math.max(0, (editingSale?.grand_total || totalSubtotal) - totalPaid);

          // Get the single applicant/member for this invoice
          const invoiceMember = editingSale?.person_name || editingSaleItems[0]?.person_name || null;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md">
              <div className="border border-slate-200/90 rounded-3xl p-5 sm:p-7 w-[96vw] max-w-[1280px] bg-white shadow-2xl relative max-h-[94vh] flex flex-col space-y-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3.5 shrink-0">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-inner">
                      <ReceiptText size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-black font-heading text-slate-900 tracking-tight">
                          Invoice #{editingSale?.invoice_no}
                        </h2>
                        {invoiceMember ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-sky-100 text-sky-900 font-bold font-heading border border-sky-200 inline-flex items-center gap-1.5">
                            <User size={13} className="text-sky-600" />
                            <span>Member: <strong>{invoiceMember}</strong></span>
                          </span>
                        ) : (
                          <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold font-heading">
                            General Invoice
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 mt-1 font-sans flex-wrap">
                        <span className="flex items-center gap-1 text-slate-800 font-semibold">
                          <Building2 size={14} className="text-slate-400" />
                          <span>Client: {editingSale?.customer?.name || 'Walk-in Client'}</span>
                        </span>
                        {editingSale?.customer?.phone && (
                          <span className="text-slate-400 font-sans">({editingSale.customer.phone})</span>
                        )}
                        <span>•</span>
                        <span>Date: <strong className="text-slate-700">{new Date(editingSale?.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</strong></span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditItemsModalOpen(false); setEditingSaleId(null); setSelectedServiceItemId(null); }}
                    className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-all cursor-pointer"
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Sleek Financial Summary Ribbon */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0 bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200/80">
                  <div className="bg-white rounded-xl p-2.5 border border-slate-200/60 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-heading block">Total Billed</span>
                    <p className="text-base sm:text-lg font-black font-heading text-slate-900 mt-0.5">
                      {totalSubtotal.toFixed(2)} <span className="text-[10px] font-bold text-slate-400">AED</span>
                    </p>
                  </div>

                  <div className="bg-white rounded-xl p-2.5 border border-rose-100 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 font-heading block">Gov / Card Costs</span>
                    <p className="text-base sm:text-lg font-black font-heading text-rose-600 mt-0.5">
                      -{totalGovCost.toFixed(2)} <span className="text-[10px] font-bold text-rose-400">AED</span>
                    </p>
                  </div>

                  <div className="bg-white rounded-xl p-2.5 border border-emerald-100 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 font-heading block">Net Typing Profit</span>
                    <p className="text-base sm:text-lg font-black font-heading text-emerald-700 mt-0.5">
                      +{totalNetProfit.toFixed(2)} <span className="text-[10px] font-bold text-emerald-500">AED</span>
                    </p>
                  </div>

                  <div className="bg-white rounded-xl p-2.5 border border-sky-100 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 font-heading block">Total Collected</span>
                    <p className="text-base sm:text-lg font-black font-heading text-sky-800 mt-0.5">
                      {totalPaid.toFixed(2)} <span className="text-[10px] font-bold text-sky-400">AED</span>
                    </p>
                  </div>

                  {(() => {
                    const invoiceGrandTotal = editingSale?.grand_total || totalSubtotal;
                    const advanceCredit = Math.max(0, totalPaid - invoiceGrandTotal);
                    const isDue = remainingDue > 0;

                    return (
                      <div className={`rounded-xl p-2.5 border shadow-2xs col-span-2 sm:col-span-1 ${
                        advanceCredit > 0
                          ? 'bg-sky-50/90 border-sky-300'
                          : isDue
                          ? 'bg-amber-50/70 border-amber-200'
                          : 'bg-emerald-50/70 border-emerald-200'
                      }`}>
                        <span className={`text-[10px] font-bold uppercase tracking-wider font-heading block ${
                          advanceCredit > 0 ? 'text-sky-900 font-black' : isDue ? 'text-amber-800' : 'text-emerald-800'
                        }`}>
                          {advanceCredit > 0 ? '✨ Advance Credit' : isDue ? 'Balance Due' : 'Status'}
                        </span>
                        <p className={`text-base sm:text-lg font-black font-heading mt-0.5 ${
                          advanceCredit > 0 ? 'text-sky-900' : isDue ? 'text-amber-800' : 'text-emerald-700'
                        }`}>
                          {advanceCredit > 0 ? `+${advanceCredit.toFixed(2)} AED` : isDue ? `${remainingDue.toFixed(2)} AED` : 'Fully Settled'}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* SERVICES TABLE */}
                <div className="flex-1 overflow-hidden flex flex-col space-y-2.5 min-h-0">
                  <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-black font-heading text-slate-900 tracking-wide uppercase">
                        Services on Invoice ({editingSaleItems.length})
                      </h3>
                      {invoiceMember && (
                        <span className="text-xs text-slate-500 font-medium">
                          for {invoiceMember}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenPayModal(editingSaleId)}
                      className="text-xs font-bold font-heading text-primary hover:text-primary-hover flex items-center gap-1.5 cursor-pointer bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-xl border border-primary/20 transition-all shadow-2xs"
                    >
                      <CreditCard size={14} />
                      <span>Payment History ({(editingSale?.payments || []).length})</span>
                    </button>
                  </div>

                  {/* Services Table */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden flex-1 overflow-y-auto bg-white shadow-xs">
                    <table className="w-full text-left text-sm border-collapse font-sans">
                      <thead className="bg-slate-100 text-slate-700 font-bold font-heading text-xs uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="text-center py-3 px-3 w-10">#</th>
                          <th className="py-3 px-4 min-w-[240px]">Service Name</th>
                          <th className="text-center py-3 px-3 w-16">Qty</th>
                          <th className="text-right py-3 px-4 w-28">Rate</th>
                          <th className="text-right py-3 px-4 w-32">Total Billed</th>
                          <th className="text-right py-3 px-4 w-40">Gov Costs &amp; Deductions</th>
                          <th className="text-right py-3 px-4 w-32">Net Profit</th>
                          <th className="text-center py-3 px-3 w-14"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {editingSaleItems.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-500">
                              <div className="max-w-md mx-auto space-y-1">
                                <ReceiptText size={24} className="mx-auto text-slate-400 opacity-60" />
                                <div className="font-bold font-heading text-slate-700 text-sm">
                                  No services on this invoice yet
                                </div>
                                <div className="text-xs text-slate-400 font-sans">Use the form below to add a service item.</div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          editingSaleItems.map((item: any, idx: number) => {
                            const itemExps = item.expenses || [];
                            const itemExpTotal = itemExps.length > 0
                              ? itemExps.reduce((eSum: number, e: any) => eSum + (Number(e.amount) || 0), 0)
                              : Number(item.expense || 0);
                            const itemPrice = Number(item.subtotal || (Number(item.unit_price || 0) * Number(item.quantity || 1)));
                            const itemProfit = itemPrice - itemExpTotal;

                            return (
                              <tr key={item.id} className="hover:bg-slate-50/90 transition-colors">
                                <td className="text-center font-bold font-heading text-slate-400 py-3.5 px-3">
                                  {idx + 1}
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-bold font-heading text-slate-900 text-sm leading-snug">
                                    {item.service?.name || 'Service'}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                                    Staff: {item.staff?.name || editingSale?.employee?.name || 'Staff'}
                                  </div>
                                </td>
                                <td className="text-center py-3.5 px-3">
                                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold font-heading text-xs">
                                    {item.quantity}
                                  </span>
                                </td>
                                <td className="text-right font-heading font-semibold text-slate-700 py-3.5 px-4 whitespace-nowrap">
                                  {Number(item.unit_price).toFixed(2)}
                                </td>
                                <td className="text-right font-heading font-bold text-slate-900 py-3.5 px-4 whitespace-nowrap">
                                  {itemPrice.toFixed(2)} <span className="text-[10px] text-slate-400">AED</span>
                                </td>
                                <td className="text-right py-3.5 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenServiceExpenseModal(item.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-heading transition-all inline-flex items-center gap-1.5 cursor-pointer border ${
                                      itemExpTotal > 0
                                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 shadow-2xs'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                    title="View & Record Government Fees and Card Deductions for this service"
                                  >
                                    <Wallet size={13} className={itemExpTotal > 0 ? 'text-rose-600' : 'text-slate-400'} />
                                    <span>{itemExpTotal > 0 ? `-${itemExpTotal.toFixed(2)} AED` : '+ Log Fee'}</span>
                                    {itemExps.length > 0 && (
                                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-200 text-rose-900">
                                        {itemExps.length}
                                      </span>
                                    )}
                                  </button>
                                </td>
                                <td className="text-right font-heading font-black text-emerald-600 py-3.5 px-4 whitespace-nowrap">
                                  +{itemProfit.toFixed(2)} <span className="text-[10px] text-emerald-700">AED</span>
                                </td>
                                <td className="text-center py-3.5 px-3">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.id)}
                                    disabled={editSaving}
                                    className="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Remove Service from Invoice"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* SIMPLE & DIRECT ADD SERVICE SECTION FOR THIS MEMBER */}
                  <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 shrink-0 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold font-heading uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Plus size={14} className="text-primary font-bold" />
                        <span>Add Service to this Invoice</span>
                      </span>
                      {invoiceMember && (
                        <span className="text-xs font-semibold text-slate-500">
                          Adding for: <strong className="text-sky-800">👤 {invoiceMember}</strong>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      {/* Service Selector */}
                      <div className="sm:col-span-6">
                        <label className="text-[10px] font-bold font-heading uppercase tracking-wider text-slate-600 block mb-1">
                          Select Service
                        </label>
                        <select
                          value={addServiceId}
                          onChange={(e) => {
                            const svc = allServices.find(s => s.id === e.target.value);
                            setAddServiceId(e.target.value);
                            if (svc) setAddPrice(svc.price);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold font-sans text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer"
                        >
                          <option value="">-- Choose a Service --</option>
                          {allServices.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.price.toFixed(2)} AED)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Qty */}
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold font-heading uppercase tracking-wider text-slate-600 block mb-1 text-center">
                          Qty
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={addQty}
                          onChange={(e) => setAddQty(parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold font-heading text-slate-800 text-center focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>

                      {/* Rate */}
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold font-heading uppercase tracking-wider text-slate-600 block mb-1">
                          Rate (AED)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={addPrice}
                          onChange={(e) => setAddPrice(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold font-heading text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>

                      {/* Add Button */}
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddItem}
                          disabled={editSaving || !addServiceId}
                          className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold font-heading rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>Add Item</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2.5 border-t border-slate-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenPayModal(editingSaleId)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold font-heading text-slate-800 transition-all cursor-pointer shadow-2xs w-full sm:w-auto justify-center"
                  >
                    <CreditCard size={15} className="text-emerald-600" />
                    <span>Payment History &amp; Record Payment</span>
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-bold ${
                      remainingDue > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {remainingDue > 0 ? `${remainingDue.toFixed(2)} AED Due` : 'Fully Paid'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setEditItemsModalOpen(false); setEditingSaleId(null); setSelectedServiceItemId(null); }}
                    className="px-7 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold font-heading rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer w-full sm:w-auto text-center"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* SERVICE GOV FEE & EXPENSE HISTORY SUB-MODAL */}
        {serviceExpenseModalOpen && selectedServiceItemId && (() => {
          const selectedItem = editingSaleItems.find((i: any) => i.id === selectedServiceItemId);
          if (!selectedItem) return null;

          const selectedItemExps: any[] = selectedItem.expenses || [];
          const selectedItemExpTotal = selectedItemExps.length > 0
            ? selectedItemExps.reduce((eSum: number, e: any) => eSum + (Number(e.amount) || 0), 0)
            : Number(selectedItem.expense || 0);
          const selectedItemSubtotal = Number(selectedItem.subtotal || (Number(selectedItem.unit_price || 0) * Number(selectedItem.quantity || 1)));
          const selectedItemProfit = selectedItemSubtotal - selectedItemExpTotal;

          return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
              <div className="border border-slate-200 rounded-3xl p-5 sm:p-6 w-full max-w-2xl bg-white shadow-2xl relative max-h-[90vh] flex flex-col space-y-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                      <Wallet size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold font-heading text-slate-900 leading-tight">
                        {selectedItem.service?.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-sans flex items-center gap-2 flex-wrap">
                        <span>Invoice #{editingSale?.invoice_no}</span>
                        {selectedItem.person_name && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-slate-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                              👤 Member: {selectedItem.person_name}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setServiceExpenseModalOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Mini Summary Cards */}
                <div className="grid grid-cols-3 gap-2.5 shrink-0">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] uppercase font-bold font-heading text-slate-500">Service Billed</span>
                    <p className="text-base font-black font-heading text-slate-900 mt-0.5">{selectedItemSubtotal.toFixed(2)} <span className="text-[10px] text-slate-500">AED</span></p>
                  </div>
                  <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] uppercase font-bold font-heading text-rose-600">Gov Fees Logged</span>
                    <p className="text-base font-black font-heading text-rose-600 mt-0.5">-{selectedItemExpTotal.toFixed(2)} <span className="text-[10px] text-rose-400">AED</span></p>
                  </div>
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] uppercase font-bold font-heading text-emerald-700">Net Profit</span>
                    <p className="text-base font-black font-heading text-emerald-700 mt-0.5">+{selectedItemProfit.toFixed(2)} <span className="text-[10px] text-emerald-500">AED</span></p>
                  </div>
                </div>

                {/* Logged Expenses List */}
                <div className="flex-1 overflow-hidden flex flex-col space-y-2 min-h-0">
                  <div className="flex items-center justify-between shrink-0">
                    <span className="text-xs font-bold font-heading uppercase tracking-wider text-slate-800">
                      Logged Gov Fees &amp; Card Deductions ({selectedItemExps.length})
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 overflow-y-auto bg-white shadow-2xs">
                    {selectedItemExps.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-xs italic">
                        No government fees or expenses logged for this service yet.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs sm:text-sm border-collapse font-sans">
                        <thead className="bg-slate-100 text-slate-700 font-bold font-heading text-[11px] uppercase tracking-wider sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Fee Description</th>
                            <th className="py-2 px-3">Paid From (Card / Drawer)</th>
                            <th className="py-2 px-3 text-right">Amount</th>
                            <th className="py-2 px-3 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedItemExps.map((exp: any) => {
                            const acc = accounts.find(a => a.id === exp.account_id);
                            const cleanDesc = exp.description?.replace(/\[Item:[^\]]+\]\s*/g, '') || 'Gov Fee';

                            return (
                              <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2 px-3 text-slate-500 whitespace-nowrap text-xs">
                                  {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString() : '—'}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-900 text-xs sm:text-sm">
                                  {cleanDesc}
                                </td>
                                <td className="py-2 px-3 text-slate-700 font-medium text-xs sm:text-sm">
                                  <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                    <span>{acc?.type === 'card' ? '💳' : acc?.type === 'cash_drawer' ? '💵' : '🏦'}</span>
                                    <span>{acc?.name || 'Cash Drawer'}</span>
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right font-heading font-black text-rose-600 whitespace-nowrap text-xs sm:text-sm">
                                  -{Number(exp.amount).toFixed(2)} AED
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteServiceExpense(exp.id)}
                                    disabled={svcExpenseSaving}
                                    className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Delete Fee (restores balance)"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Add Gov Fee Form */}
                <div className="bg-amber-50/40 border border-amber-400/30 rounded-2xl p-3.5 space-y-2 shrink-0 shadow-2xs">
                  <span className="text-xs font-bold font-heading text-amber-900 uppercase tracking-wider block">
                    + Record Gov Fee / Card Deduction
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold font-heading uppercase text-slate-600 block mb-0.5">Amount (AED)</label>
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={svcExpenseAmount || ''}
                        onChange={(e) => setSvcExpenseAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-heading font-bold text-rose-600 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold font-heading uppercase text-slate-600 block mb-0.5">Paid From (Card / Drawer)</label>
                      <select
                        value={svcExpenseAccountId}
                        onChange={(e) => setSvcExpenseAccountId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold font-sans text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
                      >
                        <option value="">-- Select Card / Drawer --</option>
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.type === 'card' ? '💳' : a.type === 'cash_drawer' ? '💵' : '🏦'} {a.name} ({Number(a.balance).toFixed(2)} AED)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold font-heading uppercase text-slate-600 block mb-0.5">Fee Description</label>
                    <input
                      type="text"
                      value={svcExpenseDesc}
                      onChange={(e) => setSvcExpenseDesc(e.target.value)}
                      placeholder="E.g. ICP Portal Fee, Amer Cancellation, Medical..."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium font-sans text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddServiceExpense}
                    disabled={svcExpenseSaving || svcExpenseAmount <= 0}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold font-heading rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                  >
                    <Plus size={14} /> {svcExpenseSaving ? 'Saving Fee...' : 'Add Fee to Service'}
                  </button>
                </div>

                {/* Footer */}
                <div className="flex justify-end pt-2 border-t border-slate-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => setServiceExpenseModalOpen(false)}
                    className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold font-heading rounded-xl transition-all cursor-pointer"
                  >
                    Back to Invoice
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
        {/* PAYMENT & ADVANCE MODAL */}
        {payModalOpen && payingSaleDetails && (() => {
          const totalPaid = (payingSaleDetails.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
          const grandTotal = payingSaleDetails.grand_total || 0;
          const due = Math.max(0, grandTotal - totalPaid);
          const advanceCredit = Math.max(0, totalPaid - grandTotal);
          const isPaid = totalPaid >= grandTotal;

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
                  <CreditCard size={18} className="text-emerald-600" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground leading-none">Payments &amp; Advance — #{payingSaleDetails.invoice_no}</h3>
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
                    <div className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wider mb-1">Total Collected</div>
                    <div className="text-sm font-bold text-emerald-600">{totalPaid.toFixed(2)} <span className="text-[10px]">AED</span></div>
                  </div>
                  <div className={`border rounded-xl p-3 text-center ${
                    advanceCredit > 0
                      ? 'bg-sky-500/10 border-sky-500/30'
                      : isPaid
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-rose-500/10 border-rose-500/30'
                  }`}>
                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                      advanceCredit > 0 ? 'text-sky-700' : isPaid ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {advanceCredit > 0 ? '✨ Advance Credit' : isPaid ? 'Status' : 'Outstanding Due'}
                    </div>
                    <div className={`text-sm font-black ${
                      advanceCredit > 0 ? 'text-sky-800' : isPaid ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      {advanceCredit > 0 ? `+${advanceCredit.toFixed(2)} AED` : isPaid ? 'Fully Paid' : `${due.toFixed(2)} AED`}
                    </div>
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
                          <th className="px-3 py-2 text-left text-muted-foreground font-semibold">For Member</th>
                          <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Method</th>
                          <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Txn #</th>
                          <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Note</th>
                          <th className="px-3 py-2 text-right text-muted-foreground font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(payingSaleDetails.payments || []).map((p: any, idx: number) => (
                          <tr key={p.id || idx} className="border-t border-border/40">
                            <td className="px-3 py-2 text-muted-foreground">{new Date(p.payment_date || p.created_at).toLocaleDateString()}</td>
                            <td className="px-3 py-2">
                              {p.person_name ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                                  👤 {p.person_name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[10px] italic">General</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-medium text-foreground">{p.payment_method}</td>
                            <td className="px-3 py-2 text-muted-foreground font-mono">{p.transaction_no || '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground text-[11px] max-w-[150px] truncate" title={p.notes}>
                              {p.notes ? p.notes.replace(/\[Member:\s*[^\]]+\]/g, '').trim() || '—' : '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-600">{p.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Collect / Advance Payment Form */}
                <form onSubmit={handleSubmitPayment} className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                      {isPaid ? '+ Record Advance / Additional Payment' : 'Collect Payment'}
                    </p>
                    {isPaid && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-100 text-sky-900 rounded-md border border-sky-200">
                        Will be saved as Advance
                      </span>
                    )}
                  </div>

                  {/* Member Allocation Field */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                      <span>Payment For Member / Applicant</span>
                      <span className="text-[9px] font-normal text-muted-foreground">Select member or whole invoice</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={payPersonName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPayPersonName(val);
                          const saleItems = payingSaleDetails.items || [];
                          const matching = saleItems.filter((it: any) => it.person_name === val);
                          const itemTotal = matching.reduce((s: number, it: any) => s + it.subtotal, 0);
                          if (itemTotal > 0) {
                            setPayAmount(parseFloat(itemTotal.toFixed(2)));
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="">Entire Invoice / All Members</option>
                        {Array.from(new Set((payingSaleDetails.items || []).map((it: any) => it.person_name).filter(Boolean))).map((m: any, idx: number) => {
                          const itemTotal = (payingSaleDetails.items || []).filter((it: any) => it.person_name === m).reduce((s: number, it: any) => s + it.subtotal, 0);
                          return (
                            <option key={idx} value={m}>
                              👤 {m} ({itemTotal.toFixed(2)} AED)
                            </option>
                          );
                        })}
                      </select>
                      <input
                        type="text"
                        value={payPersonName}
                        onChange={(e) => setPayPersonName(e.target.value)}
                        placeholder="Or type custom member name"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Amount (AED)</label>
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={payAmount || ''}
                        onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-bold text-foreground focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Deposit To Account</label>
                      <select
                        value={payAccountId}
                        onChange={(e) => setPayAccountId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs font-bold text-foreground focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      >
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.type === 'cash_drawer' ? '💵' : a.type === 'bank' ? '🏦' : '💳'} {a.name} ({a.balance.toFixed(2)} AED)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Advance Notification Callout */}
                  {payAmount > due && due > 0 && (
                    <div className="text-xs font-bold font-heading text-sky-900 bg-sky-50 border border-sky-200 px-3 py-2 rounded-xl">
                      Taking advance: +{(payAmount - due).toFixed(2)} AED
                    </div>
                  )}

                  {isPaid && payAmount > 0 && (
                    <div className="text-xs font-bold font-heading text-sky-900 bg-sky-50 border border-sky-200 px-3 py-2 rounded-xl">
                      Taking advance: +{payAmount.toFixed(2)} AED
                    </div>
                  )}

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
                      placeholder="Optional remarks about this payment (e.g. advance for medical & visa)"
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
                      {paySaving ? 'Recording...' : payAmount > due || isPaid ? 'Record Advance Payment' : 'Record Payment'}
                    </button>
                  </div>
                </form>

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
