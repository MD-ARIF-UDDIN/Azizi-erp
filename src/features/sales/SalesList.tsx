import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/db';
import type { OrderStatus, Account } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exportSales } from '../../lib/excelExport';
import { ReceiptVoucherPrint, type PrintableVoucherData } from '../../components/ReceiptVoucherPrint';
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
  User,
  Undo2,
  CheckCircle2
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

  // Payment & Refund Modal States
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payModalTab, setPayModalTab] = useState<'collect' | 'refund'>('collect');
  const [payingSaleId, setPayingSaleId] = useState<string | null>(null);
  const [payingSaleDetails, setPayingSaleDetails] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<'Cash' | 'Card' | 'Bank Transfer' | 'Mobile Banking'>('Cash');
  const [payAccountId, setPayAccountId] = useState('');
  const [payTxnNo, setPayTxnNo] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payPersonName, setPayPersonName] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [printableVoucherData, setPrintableVoucherData] = useState<PrintableVoucherData | null>(null);
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
          const results = await Promise.all(ids.map(sId => db.sales.getById(sId)));
          const details = results.filter(Boolean);
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
      setPayMethod('Cash');
      setPayAccountId(defaultDrawer?.id || '');
      setPayTxnNo('');
      setPayNotes('');
      setRefundReason('');
      setPayPersonName(detail?.person_name || '');
      setPayModalTab('collect');
      setPayModalOpen(true);
    } catch (err) { console.error(err); }
  };

  const handleOpenRefundModal = async (saleId: string) => {
    try {
      const detail = await db.sales.getById(saleId);
      setPayingSaleId(saleId);
      setPayingSaleDetails(detail);
      const totalPaid = (detail?.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
      const defaultDrawer = accounts.find(a => a.type === 'cash_drawer') || accounts[0];
      setPayAmount(Math.max(0, parseFloat(totalPaid.toFixed(2))));
      setPayMethod('Cash');
      setPayAccountId(defaultDrawer?.id || '');
      setPayTxnNo('');
      setPayNotes('');
      setRefundReason('');
      setPayPersonName(detail?.person_name || '');
      setPayModalTab('refund');
      setPayModalOpen(true);
    } catch (err) { console.error(err); }
  };

  const handlePrintVoucher = (p: any, sale: any) => {
    const isRef = p.is_refund || p.amount < 0 || p.notes?.includes('[Refund]');
    const targetAccount = accounts.find(a => a.id === p.account_id);
    const amountVal = Math.abs(Number(p.amount) || 0);
    const reasonText = p.refund_reason || (p.notes ? p.notes.replace(/\[Member:\s*[^\]]+\]/g, '').replace(/\[Refund\]\s*/, '').trim() : '');
    const cleanNotes = p.notes ? p.notes.replace(/\[Member:\s*[^\]]+\]/g, '').replace(/\[Refund\]\s*/, '').trim() : '';

    const payCode = p.id ? p.id.slice(0, 8).toUpperCase() : (p.created_at ? new Date(p.created_at).getTime().toString().slice(-6) : Date.now().toString().slice(-6));
    const voucherNumber = isRef ? `REF-${payCode}` : `PAY-${payCode}`;

    setPrintableVoucherData({
      type: isRef ? 'refund' : 'receipt',
      voucherNo: voucherNumber,
      date: p.payment_date || p.created_at || new Date().toISOString(),
      amount: amountVal,
      paymentMethod: p.payment_method || 'Cash',
      personName: p.person_name || sale?.person_name || undefined,
      reason: isRef ? (reasonText || 'Customer Refund / Return') : (cleanNotes || `Payment collected against invoice #${sale?.invoice_no || ''}`),
      account: targetAccount,
      sale: sale,
      transactionNo: p.transaction_no || undefined
    });

    setTimeout(() => {
      window.print();
    }, 200);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSaleId || payAmount <= 0) return;
    if (!payAccountId) {
      alert('Deposit To Account is mandatory. Please select an account.');
      return;
    }
    setPaySaving(true);
    try {
      const createdPay = await db.payments.create({
        sale_id: payingSaleId,
        amount: payAmount,
        payment_method: payMethod,
        account_id: payAccountId,
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
      if (selectedSaleId && selectedSaleId === payingSaleId) {
        setSelectedSaleDetails(detail);
      }

      const payCode = createdPay?.id ? createdPay.id.slice(0, 8).toUpperCase() : Date.now().toString().slice(-6);

      setPrintableVoucherData({
        type: 'receipt',
        voucherNo: `PAY-${payCode}`,
        date: new Date().toISOString(),
        amount: payAmount,
        paymentMethod: payMethod,
        personName: payPersonName.trim() || detail?.person_name || undefined,
        reason: payNotes ? payNotes.trim() : `Payment collected against invoice #${detail?.invoice_no || ''}`,
        account: accounts.find(a => a.id === payAccountId),
        sale: detail,
        transactionNo: payTxnNo || undefined
      });

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

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSaleId || payAmount <= 0) return;
    if (!payAccountId) {
      alert('Payout From Account is mandatory. Please select an account.');
      return;
    }
    if (!refundReason.trim()) {
      alert('Please specify the reason for the refund / money return.');
      return;
    }
    setPaySaving(true);
    try {
      const refundRecord = await (db.payments as any).refund({
        sale_id: payingSaleId,
        amount: payAmount,
        payment_method: payMethod,
        account_id: payAccountId,
        reason: refundReason.trim(),
        person_name: payPersonName.trim() || undefined
      });
      const detail = await db.sales.getById(payingSaleId);
      setPayingSaleDetails(detail);
      if (editingSaleId && editingSaleId === payingSaleId) {
        setEditingSale(detail);
        setEditingSaleItems(detail?.items || []);
      }
      if (selectedSaleId && selectedSaleId === payingSaleId) {
        setSelectedSaleDetails(detail);
      }

      const refCode = refundRecord?.id ? refundRecord.id.slice(0, 8).toUpperCase() : Date.now().toString().slice(-6);

      setPrintableVoucherData({
        type: 'refund',
        voucherNo: `REF-${refCode}`,
        sale: detail,
        amount: payAmount,
        reason: refundReason.trim(),
        personName: payPersonName.trim() || detail?.person_name || undefined,
        date: new Date().toISOString(),
        paymentMethod: payMethod,
        account: accounts.find(a => a.id === payAccountId)
      });

      const totalPaid = (detail?.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
      setPayAmount(Math.max(0, parseFloat(totalPaid.toFixed(2))));
      setRefundReason('');
      setPayPersonName('');
      await fetchSales();
    } catch (err: any) {
      alert(err.message || 'Failed to process refund.');
      console.error(err);
    } finally {
      setPaySaving(false);
    }
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
            {loading ? (
              <div className="table-container p-12 text-center bg-card border border-border rounded-xl">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold tracking-wider uppercase text-primary animate-pulse">Loading...</span>
                  <p className="text-[11px] text-muted-foreground font-medium">Please wait while invoices are being loaded...</p>
                </div>
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
                                  {totalPaid > 0 && hasPermission('Payments.Create') && (
                                    <button
                                      onClick={() => handleOpenRefundModal(s.id)}
                                      className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                      title="Return / Refund Money"
                                    >
                                      <Undo2 size={13} />
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
                      {hasPermission('Payments.Create') && (
                        <button
                          type="button"
                          onClick={() => handleOpenRefundModal(mainSale.id)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                          title="Return / Refund Money"
                        >
                          <Undo2 size={13} />
                          <span>Refund / Return</span>
                        </button>
                      )}

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
                  <div className="print-invoice-sheet bg-white text-black p-6 sm:p-8 rounded-2xl shadow-2xl border border-border/80 print:border-none print:shadow-none print:p-0 print:rounded-none space-y-8 print:space-y-0 text-xs font-sans">
                    {salesListForPrint.map((saleItem, idx) => {
                      const allPayments = saleItem.payments || [];
                      const totalCollected = allPayments.filter((p: any) => p.amount > 0).reduce((sum: number, p: any) => sum + p.amount, 0);
                      const totalRefunded = Math.abs(allPayments.filter((p: any) => p.amount < 0 || p.is_refund).reduce((sum: number, p: any) => sum + p.amount, 0));
                      const netPaid = totalCollected - totalRefunded;
                      const due = Math.max(0, saleItem.grand_total - netPaid);

                      return (
                        <div 
                          key={saleItem.id}
                          className={`w-full bg-white flex flex-col justify-between ${idx > 0 ? 'print:page-break-before-always mt-8 print:mt-0 pt-8 print:pt-0 border-t border-dashed border-gray-300 print:border-none' : ''}`}
                        >
                          <div>
                            {/* 1. Brand Header */}
                            <div className="flex items-center justify-between pb-2 border-b border-gray-300 gap-3">
                              <img src="/logo.png" alt="AZIZI Logo" className="w-16 h-16 object-contain shrink-0" />
                              <div className="text-center flex-1 space-y-0.5">
                                <div className="text-lg font-black text-[#000ba0] tracking-wide" style={{ fontFamily: "'Cairo', 'Inter', sans-serif" }}>
                                  مكتب عزيزي للكتابة وعمل الأختام ذ.م.م - فرع ۱
                                </div>
                                <div className="text-sm font-black text-[#f28f00] tracking-wider italic uppercase">
                                  AZIZI TYPING &amp; STAMP MAKING BR. 1
                                </div>
                                <div className="text-xs text-black font-bold">
                                  Mobile: 0542797933 • Email: azizitypingbr@gmail.com
                                </div>
                                <div className="text-[11px] text-gray-700 font-medium">
                                  Abu Dhabi, Musaffah M37, Near Irani Masjid
                                </div>
                              </div>
                              <div className="w-16 shrink-0" />
                            </div>

                            {/* 2. Blue Customer Invoice Banner */}
                            <div className="bg-[#000ba0] text-white flex items-center justify-between px-3.5 py-1.5 font-bold uppercase tracking-wider text-xs my-2.5 rounded-xs">
                              <span className="font-extrabold tracking-widest text-[12px]">CUSTOMER INVOICE</span>
                              <span className="bg-[#f28f00] text-white px-3 py-0.5 rounded font-mono text-xs tracking-wider">
                                # {saleItem.invoice_no}
                              </span>
                            </div>

                            {/* 3. Structured Invoice Info Grid Table */}
                            <table className="w-full border-collapse border border-gray-300 text-xs my-2.5 bg-white text-black">
                              <tbody>
                                <tr>
                                  <td className="bg-[#f28f00] text-white font-extrabold px-3 py-2 border border-gray-300 w-[22%] uppercase tracking-wider align-middle">
                                    INVOICE TO
                                  </td>
                                  <td className="px-3 py-2 border border-gray-300 text-black w-[78%]" colSpan={3}>
                                    {(() => {
                                      if (!saleItem.customer) return <span className="font-extrabold text-sm">Walk-in / Individual</span>;
                                      const companyName = saleItem.customer.customer_type === 'company' 
                                        ? saleItem.customer.name 
                                        : (saleItem.customer.company?.name || saleItem.customer.name);
                                      const companyPhone = saleItem.customer.customer_type === 'company'
                                        ? saleItem.customer.phone
                                        : (saleItem.customer.company?.phone || saleItem.customer.phone);
                                      return (
                                        <div className="flex flex-col">
                                          <span className="font-black text-black text-[13px] uppercase">{companyName}</span>
                                          <div className="flex items-center gap-4 text-[10px] text-gray-700 font-medium mt-0.5">
                                            {companyPhone && (
                                              <span><strong className="text-gray-900">Phone:</strong> {companyPhone}</span>
                                            )}
                                            {saleItem.customer.trn && (
                                              <span><strong className="text-gray-900">TRN:</strong> {saleItem.customer.trn}</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="bg-gray-50 text-gray-800 font-bold px-3 py-1.5 border border-gray-300 w-[22%]">
                                    Mr. / M/s:
                                  </td>
                                  <td className="px-3 py-1.5 border border-gray-300 text-black font-semibold w-[28%]">
                                    {(() => {
                                      const memberName = saleItem.person_name 
                                        || (saleItem.customer?.customer_type !== 'company' ? saleItem.customer?.name : '') 
                                        || saleItem.items?.[0]?.person_name 
                                        || '—';
                                      return (
                                        <span className="font-bold text-black text-[12px]">{memberName}</span>
                                      );
                                    })()}
                                  </td>
                                  <td className="bg-[#f28f00] text-white font-extrabold px-3 py-1.5 border border-gray-300 w-[22%] uppercase tracking-wider text-center">
                                    DATE
                                  </td>
                                  <td className="px-3 py-1.5 border border-gray-300 text-black font-bold text-center w-[28%]">
                                    {new Date(saleItem.created_at).toLocaleDateString()}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="bg-gray-50 text-gray-800 font-bold px-3 py-1.5 border border-gray-300 w-[22%]">
                                    Invoice No:
                                  </td>
                                  <td className="px-3 py-1.5 border border-gray-300 text-black font-bold font-mono w-[78%]" colSpan={3}>
                                    {saleItem.invoice_no}
                                  </td>
                                </tr>
                              </tbody>
                            </table>

                            {/* 4. Line Items Table */}
                            <div className="border border-gray-300 my-2.5">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-[#000ba0] text-white font-extrabold text-[11px]">
                                    <th className="px-3 py-1.5 text-center border-r border-gray-300 w-10">SR#</th>
                                    <th className="px-3 py-1.5 border-r border-gray-300">Description of Service</th>
                                    <th className="px-3 py-1.5 text-center border-r border-gray-300 w-24">QTY</th>
                                    <th className="px-3 py-1.5 text-right border-r border-gray-300 w-24">Price</th>
                                    <th className="px-3 py-1.5 text-right border-r border-gray-300 w-20">Discount</th>
                                    <th className="px-3 py-1.5 text-right w-24">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const items = saleItem.items || [];
                                    const rows: React.ReactNode[] = [];

                                    items.forEach((item: any, iIdx: number) => {
                                      rows.push(
                                        <tr key={item.id || iIdx} className="border-b border-gray-300 h-7 text-black">
                                          <td className="px-3 py-1 text-center border-r border-gray-300 font-bold">{iIdx + 1}</td>
                                          <td className="px-3 py-1 border-r border-gray-300 font-medium">
                                            <span>{item.service?.name || 'Service'}</span>
                                            {item.notes && <span className="text-[10px] text-gray-500 italic block">{item.notes}</span>}
                                          </td>
                                          <td className="px-3 py-1 text-center border-r border-gray-300 font-bold">{item.quantity}</td>
                                          <td className="px-3 py-1 text-right border-r border-gray-300 font-mono">{item.unit_price.toFixed(2)}</td>
                                          <td className="px-3 py-1 text-right border-r border-gray-300 font-mono">0.00</td>
                                          <td className="px-3 py-1 text-right font-mono font-bold">{item.subtotal.toFixed(2)}</td>
                                        </tr>
                                      );
                                    });

                                    // Fill up to 5 rows cleanly
                                    const emptyCount = Math.max(0, 5 - items.length);
                                    for (let i = 0; i < emptyCount; i++) {
                                      rows.push(
                                        <tr key={`empty-${i}`} className="border-b border-gray-300 h-7">
                                          <td className="px-3 py-1 text-center border-r border-gray-300 font-bold text-gray-400">{items.length + i + 1}</td>
                                          <td className="px-3 py-1 border-r border-gray-300"></td>
                                          <td className="px-3 py-1 border-r border-gray-300"></td>
                                          <td className="px-3 py-1 border-r border-gray-300"></td>
                                          <td className="px-3 py-1 border-r border-gray-300"></td>
                                          <td className="px-3 py-1 text-right"></td>
                                        </tr>
                                      );
                                    }

                                    return rows;
                                  })()}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-[#f28f00] text-white font-extrabold border-t border-gray-300 text-xs">
                                    <td className="px-3 py-1.5 text-center border-r border-gray-300 uppercase tracking-wider" colSpan={5}>
                                      Sub Total
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-mono font-black">
                                      {saleItem.subtotal.toFixed(2)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>

                            {/* 5. Bottom Section: Remarks & Payment Record */}
                            <div className="grid grid-cols-2 gap-3 my-2.5 items-stretch">
                              {/* Left Column: Remarks & Internal Notes */}
                              <div className="border border-gray-300 rounded-xs flex flex-col bg-white text-xs">
                                <div className="bg-gray-100 text-gray-800 font-bold px-3 py-1.5 border-b border-gray-300 text-[11px] uppercase tracking-wider">
                                  Remarks &amp; Internal Notes
                                </div>
                                <div className="p-3 flex-1 flex items-start text-xs font-semibold text-black italic leading-relaxed">
                                  {saleItem.notes || ''}
                                </div>
                              </div>

                              {/* Right Column: Payment Record & Totals */}
                              <div className="border border-gray-300 rounded-xs flex flex-col bg-white text-xs">
                                <div className="bg-[#000ba0] text-white text-center py-1 font-extrabold uppercase tracking-wider text-xs">
                                  PAYMENT ENTRY RECORD
                                </div>
                                <table className="w-full text-left border-collapse">
                                  <thead className="bg-[#000ba0] text-white font-bold border-b border-gray-300 text-[11px]">
                                    <tr>
                                      <th className="px-2.5 py-1 border-r border-gray-300">Deposit Date</th>
                                      <th className="px-2.5 py-1 border-r border-gray-300">Type</th>
                                      <th className="px-2.5 py-1 text-right">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-300 text-black">
                                    {(() => {
                                      const payments = saleItem.payments || [];
                                      const rows: React.ReactNode[] = [];

                                      payments.forEach((p: any, pIdx: number) => {
                                        const isRef = p.is_refund || p.amount < 0;
                                        rows.push(
                                          <tr key={p.id || pIdx} className="h-6 text-xs">
                                            <td className="px-2.5 py-1 border-r border-gray-300">
                                              {new Date(p.payment_date || p.created_at).toLocaleDateString()}
                                            </td>
                                            <td className={`px-2.5 py-1 border-r border-gray-300 font-bold capitalize ${isRef ? 'text-rose-700' : ''}`}>
                                              {isRef ? `↩ Refund (${p.payment_method})` : p.payment_method}
                                            </td>
                                            <td className={`px-2.5 py-1 text-right font-mono font-bold ${isRef ? 'text-rose-700' : ''}`}>
                                              {isRef ? `-${Math.abs(p.amount).toFixed(2)}` : p.amount.toFixed(2)}
                                            </td>
                                          </tr>
                                        );
                                      });

                                      const emptyPayCount = Math.max(0, 2 - payments.length);
                                      for (let i = 0; i < emptyPayCount; i++) {
                                        rows.push(
                                          <tr key={`empty-pay-${i}`} className="h-6">
                                            <td className="px-2.5 py-1 border-r border-gray-300"></td>
                                            <td className="px-2.5 py-1 border-r border-gray-300"></td>
                                            <td className="px-2.5 py-1 text-right"></td>
                                          </tr>
                                        );
                                      }

                                      return rows;
                                    })()}
                                  </tbody>
                                </table>

                                {/* Totals Summary */}
                                <div className="divide-y divide-gray-300 border-t border-gray-300">
                                  <div className="flex justify-between bg-[#000ba0] text-white font-extrabold px-3 py-1.5 text-xs">
                                    <span>Total Amount</span>
                                    <span className="font-mono">{saleItem.grand_total.toFixed(2)} AED</span>
                                  </div>
                                  <div className="flex justify-between bg-white text-black font-extrabold px-3 py-1.5 text-xs">
                                    <span>Paid Amount</span>
                                    <span className="font-mono">{totalCollected.toFixed(2)} AED</span>
                                  </div>
                                  {totalRefunded > 0 && (
                                    <div className="flex justify-between bg-rose-50 text-rose-800 font-extrabold px-3 py-1 text-xs">
                                      <span>Less: Refunded</span>
                                      <span className="font-mono">-{totalRefunded.toFixed(2)} AED</span>
                                    </div>
                                  )}
                                  {totalRefunded > 0 && (
                                    <div className="flex justify-between bg-slate-100 text-slate-900 font-extrabold px-3 py-1 text-xs">
                                      <span>Net Paid</span>
                                      <span className="font-mono">{netPaid.toFixed(2)} AED</span>
                                    </div>
                                  )}
                                  <div className={`flex justify-between font-black px-3 py-1.5 text-xs ${
                                    due > 0 ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'
                                  }`}>
                                    <span>Due Amount</span>
                                    <span className="font-mono">{due.toFixed(2)} AED</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                            onClick={() => handleOpenPayModal(mainSale.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer"
                          >
                            <CreditCard size={14} />
                            <span>Collect Due ({due.toFixed(2)} AED)</span>
                          </button>
                        ) : null;
                      })()}

                      {/* Return / Refund button */}
                      {hasPermission('Payments.Create') && (
                        <button
                          type="button"
                          onClick={() => handleOpenRefundModal(mainSale.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold transition-colors cursor-pointer"
                        >
                          <Undo2 size={14} />
                          <span>Return / Refund Money</span>
                        </button>
                      )}
                    </div>

                    {/* Payment & Refund History timeline */}
                    <div className="space-y-3 pt-3 border-t border-border/60">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <CreditCard size={14} className="text-emerald-600" />
                          Payment &amp; Refund Activity Log (Invoice #{mainSale.invoice_no})
                        </h4>
                        {hasPermission('Payments.Create') && (
                          <button
                            type="button"
                            onClick={() => handleOpenRefundModal(mainSale.id)}
                            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Undo2 size={12} /> Return Money / Refund
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-2 rounded-xl bg-muted/40 border border-border">
                          <div className="text-[10px] text-muted-foreground uppercase font-bold">Total Invoiced</div>
                          <div className="font-extrabold text-foreground">{mainSale.grand_total.toFixed(2)} AED</div>
                        </div>
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <div className="text-[10px] text-emerald-600 uppercase font-bold">Collected</div>
                          <div className="font-extrabold text-emerald-600">
                            {(mainSale.payments || []).filter((p: any) => p.amount > 0).reduce((s: number, p: any) => s + p.amount, 0).toFixed(2)} AED
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                          <div className="text-[10px] text-rose-600 uppercase font-bold">Refunded</div>
                          <div className="font-extrabold text-rose-600">
                            {Math.abs((mainSale.payments || []).filter((p: any) => p.amount < 0 || p.is_refund).reduce((s: number, p: any) => s + p.amount, 0)).toFixed(2)} AED
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                          <div className="text-[10px] text-primary uppercase font-bold">Net Balance Due</div>
                          <div className="font-extrabold text-primary">
                            {Math.max(0, mainSale.grand_total - (mainSale.payments || []).reduce((s: number, p: any) => s + p.amount, 0)).toFixed(2)} AED
                          </div>
                        </div>
                      </div>

                      <div className="relative pl-4 border-l border-border/80 space-y-2.5">
                        {(mainSale.payments || []).length === 0 ? (
                          <div className="text-xs text-muted-foreground italic py-1">No payment transactions recorded yet.</div>
                        ) : (
                          (mainSale.payments || []).map((p: any, idx: number) => {
                            const isRef = p.is_refund || p.amount < 0;
                            return (
                              <div key={p.id || idx} className="relative text-[11px]">
                                <div
                                  className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 ${
                                    isRef ? 'border-rose-500 bg-rose-50' : 'border-emerald-500 bg-emerald-50'
                                  }`}
                                />
                                <div className="flex items-center justify-between">
                                  <span className={`font-bold ${isRef ? 'text-rose-600' : 'text-emerald-700'}`}>
                                    {isRef ? '↩ Refund Returned' : '✓ Payment Received'}: {isRef ? `-${Math.abs(p.amount).toFixed(2)}` : `+${p.amount.toFixed(2)}`} AED
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    {new Date(p.payment_date || p.created_at).toLocaleDateString()} {new Date(p.payment_date || p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className="text-muted-foreground text-[10px] mt-0.5 flex items-center gap-2 flex-wrap">
                                  <span>Method: <strong>{p.payment_method}</strong></span>
                                  {p.person_name && <span>• Member: <strong>👤 {p.person_name}</strong></span>}
                                  {p.transaction_no && <span>• Txn: <code className="font-mono">{p.transaction_no}</code></span>}
                                  {p.refund_reason && <span className="text-rose-600 font-semibold">• Reason: {p.refund_reason}</span>}
                                  {p.notes && !p.refund_reason && <span>• Note: {p.notes.replace(/\[Member:\s*[^\]]+\]/g, '').trim()}</span>}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
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
        {/* PAYMENT & ADVANCE / REFUND MODAL */}
        {payModalOpen && payingSaleDetails && (() => {
          const payments = payingSaleDetails.payments || [];
          const totalCollected = payments.filter((p: any) => p.amount > 0).reduce((sum: number, p: any) => sum + p.amount, 0);
          const totalRefunded = Math.abs(payments.filter((p: any) => p.amount < 0 || p.is_refund).reduce((sum: number, p: any) => sum + p.amount, 0));
          const netPaid = totalCollected - totalRefunded;
          const grandTotal = payingSaleDetails.grand_total || 0;
          const due = Math.max(0, grandTotal - netPaid);
          const advanceCredit = Math.max(0, netPaid - grandTotal);
          const isPaid = netPaid >= grandTotal && grandTotal > 0;
          const maxRefundable = Math.max(0, netPaid);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:hidden">
              <div className="glass border border-border rounded-2xl p-6 sm:p-7 w-full max-w-3xl sm:max-w-4xl bg-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => { setPayModalOpen(false); setPayingSaleId(null); setPayingSaleDetails(null); setPrintableVoucherData(null); }}
                  className="absolute right-4 top-4 p-2 text-muted-foreground hover:text-foreground bg-muted/40 rounded-full transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>

                <div className="flex items-center gap-2 mb-4">
                  <CreditCard size={18} className={payModalTab === 'refund' ? 'text-rose-600' : 'text-emerald-600'} />
                  <div>
                    <h3 className="text-sm font-bold text-foreground leading-none">
                      {payModalTab === 'refund' ? '↩ Return Money / Refund' : 'Payments & Advance'} — #{payingSaleDetails.invoice_no}
                    </h3>
                    <span className="text-[10px] text-muted-foreground mt-1 block">{payingSaleDetails.customer?.name || 'Walk-in Customer'}</span>
                  </div>
                </div>

                {/* Tab Switcher: Collect Payment vs Return Money */}
                <div className="flex rounded-xl bg-muted/50 p-1 border border-border mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setPayModalTab('collect');
                      setPayAmount(parseFloat(due.toFixed(2)));
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      payModalTab === 'collect'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <CreditCard size={13} />
                    <span>Collect Payment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPayModalTab('refund');
                      setPayAmount(parseFloat(maxRefundable.toFixed(2)));
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      payModalTab === 'refund'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Undo2 size={13} />
                    <span>Return / Refund Money</span>
                  </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="bg-muted/30 border border-border rounded-xl p-2.5 text-center">
                    <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Grand Total</div>
                    <div className="text-xs font-bold text-foreground">{grandTotal.toFixed(2)} <span className="text-[9px] text-muted-foreground">AED</span></div>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-2.5 text-center">
                    <div className="text-[9px] font-bold text-emerald-600/70 uppercase tracking-wider mb-0.5">Collected</div>
                    <div className="text-xs font-bold text-emerald-600">{totalCollected.toFixed(2)} <span className="text-[9px]">AED</span></div>
                  </div>
                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-2.5 text-center">
                    <div className="text-[9px] font-bold text-rose-600/70 uppercase tracking-wider mb-0.5">Refunded</div>
                    <div className="text-xs font-bold text-rose-600">{totalRefunded.toFixed(2)} <span className="text-[9px]">AED</span></div>
                  </div>
                  <div className={`border rounded-xl p-2.5 text-center ${
                    advanceCredit > 0
                      ? 'bg-sky-500/10 border-sky-500/30'
                      : isPaid
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-rose-500/10 border-rose-500/30'
                  }`}>
                    <div className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${
                      advanceCredit > 0 ? 'text-sky-700' : isPaid ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {advanceCredit > 0 ? '✨ Advance' : isPaid ? 'Paid' : 'Due'}
                    </div>
                    <div className={`text-xs font-black ${
                      advanceCredit > 0 ? 'text-sky-800' : isPaid ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      {advanceCredit > 0 ? `+${advanceCredit.toFixed(2)}` : isPaid ? 'Full' : `${due.toFixed(2)}`}
                    </div>
                  </div>
                </div>

                {/* Success Callout with Printable Voucher */}
                {printableVoucherData && (
                  <div className={`p-3 rounded-xl mb-4 flex items-center justify-between gap-3 text-xs border ${
                    printableVoucherData.type === 'receipt' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      <CheckCircle2 size={16} className={printableVoucherData.type === 'receipt' ? 'text-emerald-600' : 'text-rose-600'} />
                      <span>
                        {printableVoucherData.type === 'receipt'
                          ? `Payment of ${printableVoucherData.amount.toFixed(2)} AED recorded successfully!`
                          : `Refund of ${printableVoucherData.amount.toFixed(2)} AED recorded successfully!`
                        }
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTimeout(() => window.print(), 200)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-xs cursor-pointer shrink-0 ${
                        printableVoucherData.type === 'receipt' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                      }`}
                    >
                      <Printer size={13} />
                      <span>{printableVoucherData.type === 'receipt' ? 'Print Receipt Voucher' : 'Print Refund Voucher'}</span>
                    </button>
                  </div>
                )}

                {/* Payment & Refund History Table */}
                <div className="border border-border rounded-xl overflow-hidden mb-4">
                  <div className="bg-muted/40 px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border flex justify-between items-center">
                    <span>Transaction History ({payments.length})</span>
                    <span className="text-[9px] text-muted-foreground">Net: {netPaid.toFixed(2)} AED</span>
                  </div>
                  {payments.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No payments recorded yet.</p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/20 sticky top-0">
                          <tr>
                            <th className="px-2.5 py-1 text-left text-muted-foreground font-semibold">Ref / Date</th>
                            <th className="px-2.5 py-1 text-left text-muted-foreground font-semibold">Member</th>
                            <th className="px-2.5 py-1 text-left text-muted-foreground font-semibold">Mode</th>
                            <th className="px-2.5 py-1 text-left text-muted-foreground font-semibold">Reason/Note</th>
                            <th className="px-2.5 py-1 text-right text-muted-foreground font-semibold">Amount</th>
                            <th className="px-2.5 py-1 text-center text-muted-foreground font-semibold">Voucher</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {payments.map((p: any, idx: number) => {
                            const isRef = p.is_refund || p.amount < 0;
                            const payCode = p.id ? p.id.slice(0, 8).toUpperCase() : (p.created_at ? new Date(p.created_at).getTime().toString().slice(-6) : `TXN-${idx + 1}`);
                            return (
                              <tr key={p.id || idx} className={isRef ? 'bg-rose-50/40' : ''}>
                                <td className="px-2.5 py-1">
                                  <div className={`font-mono text-[9px] font-bold ${isRef ? 'text-rose-700' : 'text-primary'}`}>
                                    {isRef ? `REF-${payCode}` : `PAY-${payCode}`}
                                  </div>
                                  <div className="text-[9px] text-muted-foreground">
                                    {new Date(p.payment_date || p.created_at).toLocaleDateString()}
                                  </div>
                                </td>
                                <td className="px-2.5 py-1">
                                  {p.person_name ? (
                                    <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-primary/10 text-primary text-[9px] font-bold">
                                      👤 {p.person_name}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-[9px] italic">General</span>
                                  )}
                                </td>
                                <td className={`px-2.5 py-1 font-semibold ${isRef ? 'text-rose-700' : 'text-foreground'}`}>
                                  {isRef ? '↩ Refund' : p.payment_method}
                                </td>
                                <td className="px-2.5 py-1 text-muted-foreground text-[10px] max-w-[120px] truncate" title={p.refund_reason || p.notes}>
                                  {p.refund_reason || (p.notes ? p.notes.replace(/\[Member:\s*[^\]]+\]/g, '').replace(/\[Refund\]\s*/, '').trim() : '—') || '—'}
                                </td>
                                <td className={`px-2.5 py-1 text-right font-bold ${isRef ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  {isRef ? `-${Math.abs(p.amount).toFixed(2)}` : `+${p.amount.toFixed(2)}`}
                                </td>
                                <td className="px-2.5 py-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handlePrintVoucher(p, payingSaleDetails)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all border cursor-pointer ${
                                      isRef
                                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 hover:border-rose-300'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 hover:border-emerald-300'
                                    }`}
                                    title={isRef ? 'Print Refund Voucher' : 'Print Receipt Voucher'}
                                  >
                                    <Printer size={10} />
                                    <span>{isRef ? 'Voucher' : 'Receipt'}</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* FORM: COLLECT PAYMENT */}
                {payModalTab === 'collect' && (
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

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Amount (AED) *</label>
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={payAmount || ''}
                          onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-bold text-foreground focus:ring-1 focus:ring-emerald-500"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Payment Mode *</label>
                        <select
                          value={payMethod}
                          onChange={(e) => setPayMethod(e.target.value as any)}
                          className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-bold text-foreground focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                        >
                          <option value="Cash">💵 Cash</option>
                          <option value="Card">💳 Card</option>
                          <option value="Bank Transfer">🏦 Bank Transfer</option>
                          <option value="Mobile Banking">📱 Mobile Banking</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Deposit To Account *</label>
                        <select
                          value={payAccountId}
                          onChange={(e) => setPayAccountId(e.target.value)}
                          required
                          className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-bold text-foreground focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                        >
                          <option value="">-- Select Account * --</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.type === 'cash_drawer' ? '💵' : a.type === 'bank' ? '🏦' : '💳'} {a.name} ({a.balance.toFixed(2)} AED)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Transaction / Reference No.</label>
                      <input
                        type="text"
                        value={payTxnNo}
                        onChange={(e) => setPayTxnNo(e.target.value)}
                        placeholder="Optional — e.g. bank ref, receipt no"
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Notes</label>
                      <input
                        type="text"
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                        placeholder="Optional remarks about this payment"
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground focus:ring-1 focus:ring-emerald-500"
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
                )}

                {/* FORM: RETURN / REFUND MONEY */}
                {payModalTab === 'refund' && (
                  <form onSubmit={handleSubmitRefund} className="border border-rose-500/20 bg-rose-500/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Undo2 size={13} /> Return Money to Customer
                      </p>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md border border-rose-200">
                        Max Refundable: {maxRefundable.toFixed(2)} AED
                      </span>
                    </div>

                    {/* Quick Amount Chips */}
                    {maxRefundable > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground">Quick:</span>
                        <button
                          type="button"
                          onClick={() => setPayAmount(parseFloat(maxRefundable.toFixed(2)))}
                          className="px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          Full ({maxRefundable.toFixed(2)} AED)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayAmount(parseFloat((maxRefundable / 2).toFixed(2)))}
                          className="px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          50% ({(maxRefundable / 2).toFixed(2)} AED)
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Refund Amount (AED) *</label>
                        <input
                          type="number"
                          min={0.01}
                          max={maxRefundable}
                          step={0.01}
                          value={payAmount || ''}
                          onChange={(e) => setPayAmount(Math.min(maxRefundable, parseFloat(e.target.value) || 0))}
                          placeholder="0.00"
                          className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-bold text-foreground focus:ring-1 focus:ring-rose-500"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Refund Mode *</label>
                        <select
                          value={payMethod}
                          onChange={(e) => setPayMethod(e.target.value as any)}
                          className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-bold text-foreground focus:ring-1 focus:ring-rose-500 cursor-pointer"
                        >
                          <option value="Cash">💵 Cash</option>
                          <option value="Card">💳 Card</option>
                          <option value="Bank Transfer">🏦 Bank Transfer</option>
                          <option value="Mobile Banking">📱 Mobile Banking</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Payout From Account *</label>
                        <select
                          value={payAccountId}
                          onChange={(e) => setPayAccountId(e.target.value)}
                          required
                          className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-bold text-foreground focus:ring-1 focus:ring-rose-500 cursor-pointer"
                        >
                          <option value="">-- Select Account * --</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.type === 'cash_drawer' ? '💵' : a.type === 'bank' ? '🏦' : '💳'} {a.name} ({a.balance.toFixed(2)} AED)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Member Allocation */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        For Member / Applicant (Optional)
                      </label>
                      <input
                        type="text"
                        value={payPersonName}
                        onChange={(e) => setPayPersonName(e.target.value)}
                        placeholder="E.g. Mohammed Ali"
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground focus:ring-1 focus:ring-rose-500"
                      />
                    </div>

                    {/* Refund Reason */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Reason for Money Return / Refund *
                      </label>
                      <textarea
                        rows={2}
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        placeholder="E.g. Visa application rejected by MOHRE, client canceled typing, overpayment return..."
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground focus:ring-1 focus:ring-rose-500"
                        required
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={paySaving || payAmount <= 0 || !refundReason.trim()}
                        className="flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer"
                      >
                        <Undo2 size={13} />
                        {paySaving ? 'Processing Refund...' : `Process & Return (${payAmount.toFixed(2)} AED)`}
                      </button>
                    </div>
                  </form>
                )}

                <div className="flex justify-end pt-3 border-t border-border mt-3">
                  <button
                    onClick={() => { setPayModalOpen(false); setPayingSaleId(null); setPayingSaleDetails(null); setPrintableVoucherData(null); }}
                    className="px-4 py-1.5 bg-secondary hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* PRINTABLE OFFICIAL RECEIPT & REFUND VOUCHER */}
        <ReceiptVoucherPrint data={printableVoucherData} />

      </div>
    </PermissionGuard>
  );
};
