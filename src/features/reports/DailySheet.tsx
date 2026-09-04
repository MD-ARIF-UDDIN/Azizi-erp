import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { useAuth } from '../../components/AuthProvider';
import { PermissionGuard } from '../../components/PermissionGuard';
import { Logo } from '../../components/Logo';
import {
  Calendar,
  User,
  Printer,
  Download,
  CreditCard,
  Layers
} from 'lucide-react';

export const DailySheet: React.FC = () => {
  const { activeBranchId, availableBranches } = useAuth();

  // ── Filters: Date and Staff ──
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');

  // ── Data States ──
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchFilter = activeBranchId === 'all' ? undefined : activeBranchId;
      const [sData, eData, uData] = await Promise.all([
        db.sales.getAll(branchFilter),
        db.expenses.getAll(branchFilter),
        db.users.getAll()
      ]);

      setSales(sData || []);
      setExpenses(eData || []);
      setUsers(uData || []);
    } catch (err) {
      console.error('Failed to load Daily Sheet data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeBranchId]);

  // Quick Date Helpers
  const setQuickDate = (type: 'today' | 'yesterday') => {
    const d = new Date();
    if (type === 'yesterday') {
      d.setDate(d.getDate() - 1);
    }
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // ── Filter by Date ──
  const daySales = sales.filter(s => {
    const sDate = s.created_at?.split('T')[0];
    return sDate === selectedDate;
  });

  const dayExpenses = expenses.filter(e => {
    return e.expense_date === selectedDate;
  });

  // ── Filter by Staff ──
  const filteredSales = daySales.filter(s => {
    if (selectedStaffId === 'all') return true;
    const isSaleEmployee = s.employee_id === selectedStaffId || s.employee?.id === selectedStaffId;
    const hasItemStaff = s.items?.some((it: any) => it.staff_id === selectedStaffId || it.staff?.id === selectedStaffId);
    return isSaleEmployee || hasItemStaff;
  });

  const filteredExpenses = dayExpenses.filter(e => {
    if (selectedStaffId === 'all') return true;
    return e.user_id === selectedStaffId || e.created_by === selectedStaffId;
  });

  let totalGrossSales = 0;
  let totalSalesExpense = 0;
  let totalDiscount = 0;
  let totalCollected = 0;
  let totalRefunded = 0;
  let totalDue = 0;
  let totalProfit = 0;

  let cashAmount = 0;
  let cardAmount = 0;
  let bankAmount = 0;

  filteredSales.forEach(s => {
    const sGrandTotal = Number(s.grand_total || 0);
    totalGrossSales += sGrandTotal;
    totalDiscount += Number(s.discount || 0);

    const saleCost = s.items?.reduce((sum: number, it: any) => sum + (Number(it.quantity || 1) * Number(it.service?.expense || 0)), 0) || 0;
    totalSalesExpense += saleCost;
    
    // Resolve payments & refunds
    const sPayments = s.payments || [];
    const sCollected = sPayments.filter((p: any) => !p.is_refund && Number(p.amount) > 0).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const sRefunded = sPayments.filter((p: any) => p.is_refund || Number(p.amount) < 0).reduce((sum: number, p: any) => sum + Math.abs(Number(p.amount)), 0);
    const sNetPaid = sCollected - sRefunded;

    totalCollected += sCollected;
    totalRefunded += sRefunded;
    
    const sDue = Math.max(0, sGrandTotal - sNetPaid);
    totalDue += sDue;

    // Profit calculation: Grand Total - Expense
    const invoiceProfit = sGrandTotal - saleCost;
    totalProfit += invoiceProfit;

    // Payment methods breakdown
    sPayments.forEach((p: any) => {
      const method = (p.payment_method || '').toLowerCase();
      const amt = Number(p.amount || 0);
      if (method.includes('cash')) {
        cashAmount += amt;
      } else if (method.includes('card') || method.includes('pos') || method.includes('credit') || method.includes('debit')) {
        cardAmount += amt;
      } else {
        bankAmount += amt;
      }
    });
  });

  const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netCashInHand = cashAmount - totalExpenseAmount;

  // Selected Staff Display Name
  const selectedStaffName = selectedStaffId === 'all' 
    ? 'All Staff Members' 
    : (users.find(u => u.id === selectedStaffId)?.name || 'Selected Staff');

  // Selected Branch Name
  const activeBranchName = activeBranchId === 'all'
    ? 'All Branches'
    : (availableBranches.find(b => b.id === activeBranchId)?.name || 'Main Branch');

  // ── Export CSV ──
  const handleExportCSV = () => {
    const headers = [
      '#',
      'Time',
      'Invoice No',
      'Company',
      'Member / Person Name',
      'Phone',
      'Service',
      'Staff',
      'Grand Total (AED)',
      'Expense / Cost (AED)',
      'Paid (AED)',
      'Returned (AED)',
      'Due (AED)',
      'Profit (AED)',
      'Payment Method'
    ];

    const rows = filteredSales.map((s, idx) => {
      const sPayments = s.payments || [];
      const sCollected = sPayments.filter((p: any) => !p.is_refund && Number(p.amount) > 0).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const sRefunded = sPayments.filter((p: any) => p.is_refund || Number(p.amount) < 0).reduce((sum: number, p: any) => sum + Math.abs(Number(p.amount)), 0);
      const sNetPaid = sCollected - sRefunded;
      const sDue = Math.max(0, Number(s.grand_total || 0) - sNetPaid);
      
      const companyName = s.customer?.customer_type === 'company' 
        ? s.customer.name 
        : (s.customer?.company?.name || '—');
        
      const memberNames = s.person_name 
        || Array.from(new Set(s.items?.map((it: any) => it.person_name).filter(Boolean))).join(', ') 
        || s.customer?.name || '—';

      const serviceNames = s.items?.map((it: any) => `${it.service?.name || 'Service'} (x${it.quantity})`).join('; ') || 'General Service';
      const staffName = s.employee?.name || s.items?.[0]?.staff?.name || 'Staff';
      const methods = Array.from(new Set(s.payments?.map((p: any) => p.payment_method) || [])).join(', ') || 'Unpaid';
      const timeStr = s.created_at ? new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      const sGrandTotal = Number(s.grand_total || 0);
      const saleCost = s.items?.reduce((sum: number, it: any) => sum + (Number(it.quantity || 1) * Number(it.service?.expense || 0)), 0) || 0;
      const invoiceProfit = sGrandTotal - saleCost;

      return [
        (idx + 1).toString(),
        timeStr,
        s.invoice_no || '',
        companyName,
        memberNames,
        s.customer?.phone || '',
        serviceNames,
        staffName,
        sGrandTotal.toFixed(2),
        saleCost.toFixed(2),
        sCollected.toFixed(2),
        sRefunded.toFixed(2),
        sDue.toFixed(2),
        invoiceProfit.toFixed(2),
        methods
      ];
    });

    const csvContent = [
      `"AZIZI TYPING & STAMP MAKING - DAILY CLOSING STATEMENT"`,
      `"Date: ${selectedDate}","Staff: ${selectedStaffName}","Branch: ${activeBranchName}"`,
      `"Total Sales: ${totalGrossSales.toFixed(2)} AED","Total Invoice Expense: ${totalSalesExpense.toFixed(2)} AED","Total Profit: ${totalProfit.toFixed(2)} AED","Total Collected: ${totalCollected.toFixed(2)} AED","Total Returned: ${totalRefunded.toFixed(2)} AED","Total Expenses: ${totalExpenseAmount.toFixed(2)} AED","Net Cash: ${netCashInHand.toFixed(2)} AED"`,
      '',
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `daily_sheet_${selectedDate}_${selectedStaffId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <PermissionGuard permission="Reports.View" fallback="ui">
      {/* ── SCOPED PRINT STYLES FOR LANDSCAPE A4 CORPORATE REPORTING ── */}
      <style>{`
        @page {
          size: A4 landscape !important;
          margin: 6mm 8mm 6mm 8mm !important;
        }
        @media print {
          html, body, #root, main, #root > div {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            overflow: visible !important;
          }
          .daily-sheet-print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .daily-report-table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            margin: 0 !important;
          }
          .daily-report-table th, 
          .daily-report-table td {
            border: 1px solid #94a3b8 !important;
            padding: 4px 5px !important;
            font-size: 7.5pt !important;
            line-height: 1.2 !important;
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            box-sizing: border-box !important;
          }
          .daily-report-table thead th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            font-size: 7pt !important;
            letter-spacing: 0.02em !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="daily-sheet-print-container space-y-5 print:space-y-3 print:p-0 print:m-0 print:bg-white print:text-slate-900">
        
        {/* ── SCREEN VIEW: HEADER & CONTROLS ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground m-0 flex items-center gap-2">
              <Layers className="text-primary" size={20} />
              Daily Closing &amp; Transaction Sheet
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Daily transaction ledger, cash collections, expense logs &amp; shift reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-card hover:bg-muted border border-border rounded-xl text-xs font-bold text-foreground shadow-2xs transition-all cursor-pointer"
            >
              <Printer size={14} className="text-primary" />
              <span>Print / Download PDF</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* ── SCREEN VIEW: FILTER CONTROLS ── */}
        <div className="bg-card border border-border/80 p-3 rounded-2xl shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            
            {/* 1. Date Picker + Quick Pills */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
              <Calendar size={13} className="text-muted-foreground ml-2 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2 py-1 bg-transparent text-foreground text-xs font-semibold focus:outline-none cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setQuickDate('today')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedDate === getTodayStr()
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setQuickDate('yesterday')}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all cursor-pointer"
              >
                Yesterday
              </button>
            </div>

            {/* 2. Staff Wise Filter */}
            <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-1 rounded-xl border border-border/60 flex-1 min-w-[200px] max-w-sm">
              <User size={13} className="text-muted-foreground shrink-0" />
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full bg-transparent text-foreground text-xs font-semibold focus:outline-none cursor-pointer py-1"
              >
                <option value="all">All Staff Members ({users.length})</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.role?.name ? `(${u.role.name})` : ''}
                  </option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* ── PRINT VIEW: CORPORATE REPORT HEADER ── */}
        <div className="hidden print:block pb-2 border-b-2 border-slate-800">
          <div className="flex items-center justify-between gap-4">
            {/* Logo & Company Title */}
            <div className="flex items-center gap-3">
              <Logo size={42} />
              <div>
                <h1 className="text-base font-extrabold text-[#000ba0] tracking-tight uppercase leading-none font-heading m-0">
                  AZIZI TYPING &amp; STAMP MAKING
                </h1>
                <p className="text-[8.5pt] font-semibold text-slate-700 mt-0.5 mb-0">
                  Typing, Business Setup, Document Clearing &amp; Stamp Services
                </p>
                <p className="text-[7.5pt] text-slate-500 font-medium m-0">
                  Abu Dhabi, Musaffah M37 • Phone: +971 54 279 7933 • Branch: {activeBranchName}
                </p>
              </div>
            </div>

            {/* Report Title & Metadata Box */}
            <div className="text-right border-l-2 border-slate-300 pl-4 space-y-0.5 min-w-[240px]">
              <div className="text-[9.5pt] font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded inline-block border border-slate-300">
                DAILY TRANSACTION &amp; CLOSING SHEET
              </div>
              <div className="text-[8pt] text-slate-700">
                <span>Date: <strong className="text-slate-900 font-mono">{selectedDate}</strong></span>
                <span className="mx-2">•</span>
                <span>Branch: <strong className="text-slate-900">{activeBranchName}</strong></span>
              </div>
              <div className="text-[8pt] text-slate-700">
                <span>Staff: <strong className="text-slate-900">{selectedStaffName}</strong></span>
              </div>
              <div className="text-[7pt] text-slate-400 font-mono">
                Printed: {new Date().toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* ── PRINT VIEW: SHIFT CLOSING CASH DRAWER SUMMARY ── */}
        <div className="hidden print:grid grid-cols-7 gap-2 pb-2 text-[8pt] print-avoid-break">
          <div className="border border-slate-300 bg-slate-50 p-1.5 rounded text-center">
            <div className="text-[6.5pt] uppercase font-bold text-slate-500">Invoices</div>
            <div className="text-[9.5pt] font-black text-slate-900 font-mono mt-0.5">{filteredSales.length}</div>
          </div>
          <div className="border border-slate-300 bg-slate-50 p-1.5 rounded text-center">
            <div className="text-[6.5pt] uppercase font-bold text-slate-500">Gross Sales</div>
            <div className="text-[9.5pt] font-black text-slate-900 font-mono mt-0.5">{totalGrossSales.toFixed(2)} <span className="text-[6.5pt] font-normal">AED</span></div>
          </div>
          <div className="border border-slate-300 bg-rose-50/60 p-1.5 rounded text-center">
            <div className="text-[6.5pt] uppercase font-bold text-rose-800">Invoice Expenses</div>
            <div className="text-[9.5pt] font-black text-rose-700 font-mono mt-0.5">{totalSalesExpense.toFixed(2)} <span className="text-[6.5pt] font-normal">AED</span></div>
          </div>
          <div className="border border-slate-300 bg-emerald-50/60 p-1.5 rounded text-center">
            <div className="text-[6.5pt] uppercase font-bold text-emerald-800">Total Collected</div>
            <div className="text-[9.5pt] font-black text-emerald-700 font-mono mt-0.5">+{totalCollected.toFixed(2)} <span className="text-[6.5pt] font-normal">AED</span></div>
          </div>
          <div className="border border-slate-300 bg-slate-50 p-1.5 rounded text-center">
            <div className="text-[6.5pt] uppercase font-bold text-slate-500">Cash In Hand</div>
            <div className="text-[9.5pt] font-black text-slate-800 font-mono mt-0.5">{cashAmount.toFixed(2)} <span className="text-[6.5pt] font-normal">AED</span></div>
          </div>
          <div className="border-2 border-slate-800 bg-slate-100 p-1.5 rounded text-center">
            <div className="text-[6.5pt] uppercase font-black text-slate-900">Net Cash In Drawer</div>
            <div className="text-[9.5pt] font-black text-slate-900 font-mono mt-0.5">{netCashInHand.toFixed(2)} <span className="text-[6.5pt] font-normal">AED</span></div>
          </div>
          <div className="border border-slate-300 bg-amber-50/60 p-1.5 rounded text-center">
            <div className="text-[6.5pt] uppercase font-bold text-amber-800">Outstanding Dues</div>
            <div className="text-[9.5pt] font-black text-amber-700 font-mono mt-0.5">{totalDue.toFixed(2)} <span className="text-[6.5pt] font-normal">AED</span></div>
          </div>
        </div>

        {/* ── SCREEN VIEW: SUMMARY KPI CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 print:hidden">
          
          {/* Total Invoices */}
          <div className="bg-card border border-border/80 px-3.5 py-2.5 rounded-xl shadow-2xs">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
              Invoices
            </span>
            <div className="text-base font-bold text-foreground mt-0.5">
              {filteredSales.length}
            </div>
          </div>

          {/* Gross Billing */}
          <div className="bg-card border border-border/80 px-3.5 py-2.5 rounded-xl shadow-2xs">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
              Gross Sales
            </span>
            <div className="text-base font-bold text-foreground mt-0.5">
              {totalGrossSales.toFixed(2)} <span className="text-[10px] text-muted-foreground font-normal">AED</span>
            </div>
          </div>

          {/* Invoice Expense / Cost */}
          <div className="bg-card border border-border/80 px-3.5 py-2.5 rounded-xl shadow-2xs">
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider block">
              Inv. Expenses
            </span>
            <div className="text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {totalSalesExpense.toFixed(2)} <span className="text-[10px] text-muted-foreground font-normal">AED</span>
            </div>
          </div>

          {/* Gross Profit */}
          <div className="bg-card border border-border/80 px-3.5 py-2.5 rounded-xl shadow-2xs">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider block">
              Gross Profit
            </span>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              +{totalProfit.toFixed(2)} <span className="text-[10px] text-muted-foreground font-normal">AED</span>
            </div>
          </div>

          {/* Total Collected */}
          <div className="bg-card border border-border/80 px-3.5 py-2.5 rounded-xl shadow-2xs">
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider block">
              Collected
            </span>
            <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">
              +{totalCollected.toFixed(2)} <span className="text-[10px] text-muted-foreground font-normal">AED</span>
            </div>
          </div>

          {/* Operational Expenses */}
          <div className="bg-card border border-border/80 px-3.5 py-2.5 rounded-xl shadow-2xs">
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider block">
              Daily Exp. Out
            </span>
            <div className="text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              -{totalExpenseAmount.toFixed(2)} <span className="text-[10px] text-muted-foreground font-normal">AED</span>
            </div>
          </div>

          {/* Net Cash In Hand */}
          <div className="bg-card border border-border/80 px-3.5 py-2.5 rounded-xl shadow-2xs">
            <span className="text-[10px] text-primary font-bold uppercase tracking-wider block">
              Net Cash in Hand
            </span>
            <div className={`text-base font-black mt-0.5 ${netCashInHand >= 0 ? 'text-primary' : 'text-rose-600'}`}>
              {netCashInHand.toFixed(2)} <span className="text-[10px] text-muted-foreground font-normal">AED</span>
            </div>
          </div>

          {/* Due Balance */}
          <div className="bg-card border border-border/80 px-3.5 py-2.5 rounded-xl shadow-2xs">
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider block">
              Due / Unpaid
            </span>
            <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {totalDue.toFixed(2)} <span className="text-[10px] text-muted-foreground font-normal">AED</span>
            </div>
          </div>

        </div>

        {/* ── SCREEN VIEW: PAYMENT METHODS MINI-BAR ── */}
        <div className="bg-card border border-border/80 px-4 py-2 rounded-xl shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center gap-1.5 font-bold text-muted-foreground text-[11px]">
            <CreditCard size={13} className="text-primary" />
            <span>Collections Breakdown:</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground text-[11px]">Cash:</span>
              <strong className="text-foreground font-mono">{cashAmount.toFixed(2)} AED</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground text-[11px]">Card / POS:</span>
              <strong className="text-foreground font-mono">{cardAmount.toFixed(2)} AED</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              <span className="text-muted-foreground text-[11px]">Bank Transfer:</span>
              <strong className="text-foreground font-mono">{bankAmount.toFixed(2)} AED</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-muted-foreground text-[11px]">Uncollected Dues:</span>
              <strong className="text-amber-600 dark:text-amber-400 font-mono">{totalDue.toFixed(2)} AED</strong>
            </div>
          </div>
        </div>

        {/* ── DAILY TRANSACTIONS TABLE ── */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xs print:border-none print:shadow-none print:overflow-visible">

          <div className="overflow-x-auto print:overflow-visible">
            <table className="daily-report-table w-full text-left text-xs border-collapse">
              <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border print:bg-slate-100 print:text-slate-900">
                <tr className="divide-x divide-border/60">
                  <th style={{ width: '3%' }} className="px-2 py-2 text-center border-r border-border/60">#</th>
                  <th style={{ width: '5%' }} className="px-2 py-2 border-r border-border/60">Time</th>
                  <th style={{ width: '7%' }} className="px-2 py-2 border-r border-border/60">Invoice #</th>
                  <th style={{ width: '15%' }} className="px-2 py-2 border-r border-border/60">Company / Client</th>
                  <th style={{ width: '12%' }} className="px-2 py-2 border-r border-border/60">Member Name</th>
                  <th style={{ width: '16%' }} className="px-2 py-2 border-r border-border/60">Services Rendered</th>
                  <th style={{ width: '6%' }} className="px-2 py-2 border-r border-border/60">Staff</th>
                  <th style={{ width: '6%' }} className="px-2 py-2 text-right border-r border-border/60">Total</th>
                  <th style={{ width: '6%' }} className="px-2 py-2 text-right border-r border-border/60">Expense</th>
                  <th style={{ width: '6%' }} className="px-2 py-2 text-right border-r border-border/60">Paid</th>
                  <th style={{ width: '6%' }} className="px-2 py-2 text-right border-r border-border/60">Returned</th>
                  <th style={{ width: '6%' }} className="px-2 py-2 text-right border-r border-border/60">Due</th>
                  <th style={{ width: '6%' }} className="px-2 py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-foreground print:divide-slate-300 print:text-slate-900">
                {loading ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold tracking-wider uppercase text-primary animate-pulse">Loading...</span>
                        <p className="text-[11px] text-muted-foreground font-medium">Please wait while transaction data is being loaded...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-12 text-center text-muted-foreground italic">
                      No invoices recorded for {selectedDate} with the selected staff filter.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((s, idx) => {
                    const sPayments = s.payments || [];
                    const sCollected = sPayments.filter((p: any) => !p.is_refund && Number(p.amount) > 0).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                    const sRefunded = sPayments.filter((p: any) => p.is_refund || Number(p.amount) < 0).reduce((sum: number, p: any) => sum + Math.abs(Number(p.amount)), 0);
                    const sNetPaid = sCollected - sRefunded;
                    const sDue = Math.max(0, Number(s.grand_total || 0) - sNetPaid);

                    const staffName = s.employee?.name || s.items?.[0]?.staff?.name || 'Staff';
                    const timeStr = s.created_at ? new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    const methods = Array.from(new Set(s.payments?.map((p: any) => p.payment_method) || [])).join(', ') || 'Unpaid';

                    const companyName = s.customer?.customer_type === 'company' 
                      ? s.customer.name 
                      : (s.customer?.company?.name || null);

                    const memberNames = s.person_name 
                      || Array.from(new Set(s.items?.map((it: any) => it.person_name).filter(Boolean))).join(', ') 
                      || (s.customer?.customer_type !== 'company' ? s.customer?.name : '—');

                    const sGrandTotal = Number(s.grand_total || 0);
                    const saleCost = s.items?.reduce((sum: number, it: any) => sum + (Number(it.quantity || 1) * Number(it.service?.expense || 0)), 0) || 0;
                    const invoiceProfit = sGrandTotal - saleCost;

                    return (
                      <tr key={s.id} className="divide-x divide-border/60 hover:bg-muted/40 transition-colors print:hover:bg-transparent print-avoid-break">
                        <td className="px-2 py-1.5 text-center font-mono text-muted-foreground print:text-slate-700 border-r border-border/60">{idx + 1}</td>
                        <td className="px-2 py-1.5 font-mono text-muted-foreground print:text-slate-700 whitespace-nowrap border-r border-border/60">{timeStr}</td>
                        <td className="px-2 py-1.5 font-bold font-mono text-foreground print:text-slate-900 whitespace-nowrap border-r border-border/60">
                          {s.invoice_no}
                        </td>
                        
                        {/* Company Column */}
                        <td className="px-2 py-1.5 border-r border-border/60">
                          {companyName ? (
                            <div>
                              <span className="font-semibold text-foreground print:text-slate-900">{companyName}</span>
                              <span className="ml-1 px-1 py-0.2 rounded text-[8px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 print:border-slate-300">
                                Co
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground print:text-slate-500 italic">Walk-in / Individual</span>
                          )}
                        </td>

                        {/* Member Name Column */}
                        <td className="px-2 py-1.5 border-r border-border/60">
                          <div className="font-medium text-foreground print:text-slate-900 leading-tight">
                            {memberNames || '—'}
                          </div>
                          {s.customer?.phone && (
                            <div className="text-[9px] text-muted-foreground print:text-slate-500 font-mono">{s.customer.phone}</div>
                          )}
                        </td>

                        {/* Service Column */}
                        <td className="px-2 py-1.5 border-r border-border/60">
                          <div className="space-y-0.5">
                            {s.items?.map((it: any, iIdx: number) => (
                              <div key={iIdx} className="text-[9.5pt] print:text-[7pt] leading-tight flex items-start gap-1">
                                <span className="font-semibold text-foreground print:text-slate-900">• {it.service?.name || 'Service'}</span>
                                <span className="text-muted-foreground print:text-slate-600 font-mono shrink-0">(x{it.quantity})</span>
                                {it.person_name && (
                                  <span className="text-primary print:text-slate-600 text-[9px] font-medium shrink-0">[{it.person_name}]</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Staff Column */}
                        <td className="px-2 py-1.5 whitespace-nowrap border-r border-border/60">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-muted print:bg-slate-100 text-foreground print:text-slate-900 font-medium text-[10px]">
                            {staffName}
                          </span>
                        </td>

                        {/* Total Financials */}
                        <td className="px-2 py-1.5 text-right font-bold text-foreground print:text-slate-900 whitespace-nowrap font-mono border-r border-border/60">
                          {sGrandTotal.toFixed(2)}
                        </td>

                        {/* Expense Column */}
                        <td className="px-2 py-1.5 text-right font-semibold text-rose-600 print:text-slate-800 whitespace-nowrap font-mono border-r border-border/60">
                          {saleCost.toFixed(2)}
                        </td>

                        {/* Paid Column */}
                        <td className="px-2 py-1.5 text-right font-semibold text-emerald-600 print:text-slate-900 whitespace-nowrap font-mono border-r border-border/60">
                          <div>{sCollected > 0 ? `+${sCollected.toFixed(2)}` : '0.00'}</div>
                          <div className="text-[8px] text-muted-foreground print:text-slate-500 font-normal truncate">{methods}</div>
                        </td>

                        {/* Returned Column */}
                        <td className="px-2 py-1.5 text-right font-semibold whitespace-nowrap font-mono border-r border-border/60">
                          {sRefunded > 0 ? (
                            <span className="text-rose-600 print:text-rose-700 font-bold">-{sRefunded.toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground print:text-slate-400">0.00</span>
                          )}
                        </td>

                        {/* Due Column */}
                        <td className="px-2 py-1.5 text-right font-semibold whitespace-nowrap font-mono border-r border-border/60">
                          {sDue > 0 ? (
                            <span className="text-amber-600 print:text-rose-700 font-bold">{sDue.toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground print:text-slate-400">0.00</span>
                          )}
                        </td>

                        {/* Profit Column */}
                        <td className="px-2 py-1.5 text-right font-black whitespace-nowrap font-mono">
                          <span className={invoiceProfit >= 0 ? "text-emerald-600 print:text-slate-900" : "text-rose-600 print:text-slate-900"}>
                            {invoiceProfit >= 0 ? `+${invoiceProfit.toFixed(2)}` : invoiceProfit.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Footer Totals */}
              {filteredSales.length > 0 && (
                <tfoot className="bg-muted/80 font-bold border-t-2 border-border text-foreground print:bg-slate-200 print:text-slate-900 print-avoid-break">
                  <tr className="divide-x divide-border/60">
                    <td colSpan={7} className="px-2 py-2 text-right uppercase tracking-wider text-[8.5pt] font-extrabold font-heading border-r border-border/60">
                      Daily Ledger Totals ({filteredSales.length} Invoices):
                    </td>
                    <td className="px-2 py-2 text-right text-[8.5pt] font-black text-primary print:text-slate-900 font-mono border-r border-border/60">
                      {totalGrossSales.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right text-[8.5pt] font-black text-rose-600 print:text-slate-900 font-mono border-r border-border/60">
                      {totalSalesExpense.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right text-[8.5pt] font-black text-emerald-600 print:text-slate-900 font-mono border-r border-border/60">
                      +{totalCollected.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right text-[8.5pt] font-black text-rose-600 print:text-slate-900 font-mono border-r border-border/60">
                      {totalRefunded > 0 ? `-${totalRefunded.toFixed(2)}` : '0.00'}
                    </td>
                    <td className="px-2 py-2 text-right text-[8.5pt] font-black text-amber-600 print:text-slate-900 font-mono border-r border-border/60">
                      {totalDue.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right text-[8.5pt] font-black text-emerald-600 print:text-slate-900 font-mono">
                      +{totalProfit.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>



        {/* ── PRINT VIEW ONLY: OFFICIAL VERIFICATION & SIGN-OFF BOX ── */}
        <div className="hidden print:block pt-5 mt-4 border-t-2 border-slate-300 print-avoid-break">
          <div className="grid grid-cols-3 gap-8 text-center text-[8pt]">
            <div className="space-y-6">
              <div className="font-bold text-slate-700 uppercase tracking-wider">Prepared By (Cashier / Staff)</div>
              <div className="border-t border-slate-400 pt-1 text-slate-500 font-medium">Signature &amp; Date</div>
            </div>
            <div className="space-y-6">
              <div className="font-bold text-slate-700 uppercase tracking-wider">Verified By (Accountant / Manager)</div>
              <div className="border-t border-slate-400 pt-1 text-slate-500 font-medium">Signature &amp; Date</div>
            </div>
            <div className="space-y-6">
              <div className="font-bold text-slate-700 uppercase tracking-wider">Approved By (Owner / Director)</div>
              <div className="border-t border-slate-400 pt-1 text-slate-500 font-medium">Official Stamp &amp; Signature</div>
            </div>
          </div>
          
          <div className="text-center text-[7pt] text-slate-400 font-medium pt-4 mt-2 border-t border-slate-200">
            This is an official computer-generated transaction closing report from Azizi Typing &amp; Stamp Making ERP System.
          </div>
        </div>

      </div>
    </PermissionGuard>
  );
};
