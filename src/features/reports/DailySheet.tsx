import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { useAuth } from '../../components/AuthProvider';
import { PermissionGuard } from '../../components/PermissionGuard';
import {
  Calendar,
  User,
  Printer,
  Download,
  TrendingDown,
  CreditCard,
  Layers
} from 'lucide-react';

export const DailySheet: React.FC = () => {
  const { activeBranchId, availableBranches } = useAuth();

  // ── Filters: ONLY Date and Staff ──
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

  // ── Aggregate Metrics ──
  let totalGrossSales = 0;
  let totalDiscount = 0;
  let totalCollected = 0;
  let totalDue = 0;
  let totalProfit = 0;

  let cashAmount = 0;
  let cardAmount = 0;
  let bankAmount = 0;

  filteredSales.forEach(s => {
    const sGrandTotal = Number(s.grand_total || 0);
    totalGrossSales += sGrandTotal;
    totalDiscount += Number(s.discount || 0);
    
    // Resolve payments
    const sPayments = s.payments || [];
    const sPaid = sPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    totalCollected += sPaid;
    
    const sDue = Math.max(0, sGrandTotal - sPaid);
    totalDue += sDue;

    // Profit calculation: Margin based strictly on collected amount
    const saleCost = s.items?.reduce((sum: number, it: any) => sum + (Number(it.quantity || 1) * Number(it.service?.expense || 0)), 0) || 0;
    const potentialMargin = Math.max(0, sGrandTotal - saleCost);
    const paidRatio = sGrandTotal > 0 ? Math.min(1, sPaid / sGrandTotal) : 0;
    const collectedProfit = potentialMargin * paidRatio;
    totalProfit += collectedProfit;

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
      'Paid (AED)',
      'Due (AED)',
      'Profit (AED)',
      'Payment Method'
    ];

    const rows = filteredSales.map((s, idx) => {
      const sPaid = s.payments?.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0;
      const sDue = Math.max(0, Number(s.grand_total || 0) - sPaid);
      
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
      const potentialMargin = Math.max(0, sGrandTotal - saleCost);
      const paidRatio = sGrandTotal > 0 ? Math.min(1, sPaid / sGrandTotal) : 0;
      const collectedProfit = potentialMargin * paidRatio;

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
        sPaid.toFixed(2),
        sDue.toFixed(2),
        collectedProfit.toFixed(2),
        methods
      ];
    });

    const csvContent = [
      `"AZIZI TYPING & STAMP MAKING - DAILY SHEET"`,
      `"Date: ${selectedDate}","Staff: ${selectedStaffName}","Branch: ${activeBranchName}"`,
      `"Total Sales: ${totalGrossSales.toFixed(2)} AED","Total Profit: ${totalProfit.toFixed(2)} AED","Total Collected: ${totalCollected.toFixed(2)} AED","Total Expenses: ${totalExpenseAmount.toFixed(2)} AED","Net Cash: ${netCashInHand.toFixed(2)} AED"`,
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
      <div className="space-y-5 print:p-0 print:m-0 print:bg-white print:text-black">
        
        {/* ── HEADER & CONTROLS (Screen view) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground m-0 flex items-center gap-2">
              <Layers className="text-primary" size={20} />
              Daily Sheet
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Daily transaction log, cash collections, expenses &amp; staff performance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-card hover:bg-muted border border-border rounded-xl text-xs font-bold text-foreground shadow-2xs transition-all cursor-pointer"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* ── COMPACT FILTERS TOOLBAR: DATE WISE & STAFF WISE ── */}
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

        {/* ── PRINT HEADER (Visible only during Print / PDF) ── */}
        <div className="hidden print:block pb-4 mb-4 border-b border-gray-300 text-center space-y-1">
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-gray-200">
            <img src="/logo.png" alt="AZIZI Logo" className="w-12 h-12 object-contain" />
            <div>
              <h2 className="text-base font-bold text-[#000ba0] tracking-wide">
                AZIZI TYPING &amp; STAMP MAKING
              </h2>
              <p className="text-[11px] text-gray-700 font-semibold">
                Abu Dhabi, Musaffah M37 • Phone: 0542797933
              </p>
            </div>
            <div className="text-right text-[10px] text-gray-600 font-mono">
              Printed: {new Date().toLocaleString()}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs">
            <div className="font-bold text-black uppercase tracking-wider text-sm bg-gray-100 px-3 py-1 rounded">
              DAILY TRANSACTION &amp; CLOSING SHEET
            </div>
            <div className="text-right font-medium text-black">
              <span>Date: <strong>{selectedDate}</strong></span> • 
              <span className="ml-2">Staff: <strong>{selectedStaffName}</strong></span> • 
              <span className="ml-2">Branch: <strong>{activeBranchName}</strong></span>
            </div>
          </div>
        </div>

        {/* ── MINIMAL KPI SUMMARY CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 print:hidden">
          
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

          {/* Expenses */}
          <div className="bg-card border border-border/80 px-3.5 py-2.5 rounded-xl shadow-2xs">
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider block">
              Expenses
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

        {/* ── PAYMENT METHODS MINI-BAR (CLEAN & MINIMAL) ── */}
        <div className="bg-card border border-border/80 px-4 py-2 rounded-xl shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center gap-1.5 font-bold text-muted-foreground text-[11px]">
            <CreditCard size={13} className="text-primary" />
            <span>Breakdown:</span>
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
              <span className="text-muted-foreground text-[11px]">Uncollected:</span>
              <strong className="text-amber-600 dark:text-amber-400 font-mono">{totalDue.toFixed(2)} AED</strong>
            </div>
          </div>
        </div>

        {/* ── DAILY TRANSACTIONS TABLE ── */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xs print:border-none print:shadow-none">

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border print:bg-gray-100 print:text-black">
                <tr>
                  <th className="px-3 py-2.5 text-center w-8">#</th>
                  <th className="px-3 py-2.5 w-16">Time</th>
                  <th className="px-3 py-2.5 w-24">Invoice #</th>
                  <th className="px-3 py-2.5">Company</th>
                  <th className="px-3 py-2.5">Member Name</th>
                  <th className="px-3 py-2.5">Service</th>
                  <th className="px-3 py-2.5 w-24">Staff</th>
                  <th className="px-3 py-2.5 text-right w-20">Total</th>
                  <th className="px-3 py-2.5 text-right w-20">Paid</th>
                  <th className="px-3 py-2.5 text-right w-20">Due</th>
                  <th className="px-3 py-2.5 text-right w-20">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-foreground print:text-black">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                      <div className="inline-block h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                      <p>Loading daily sheet transactions...</p>
                    </td>
                  </tr>
                ) : filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground italic">
                      No invoices recorded for {selectedDate} with the selected staff filter.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((s, idx) => {
                    const sPaid = s.payments?.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0) || 0;
                    const sDue = Math.max(0, Number(s.grand_total || 0) - sPaid);
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
                    const potentialMargin = Math.max(0, sGrandTotal - saleCost);
                    const paidRatio = sGrandTotal > 0 ? Math.min(1, sPaid / sGrandTotal) : 0;
                    const collectedProfit = potentialMargin * paidRatio;

                    return (
                      <tr key={s.id} className="hover:bg-muted/40 transition-colors print:hover:bg-transparent">
                        <td className="px-3 py-2.5 text-center font-mono text-muted-foreground">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">{timeStr}</td>
                        <td className="px-3 py-2.5 font-bold font-mono text-foreground whitespace-nowrap">
                          {s.invoice_no}
                        </td>
                        
                        {/* Company Column */}
                        <td className="px-3 py-2.5">
                          {companyName ? (
                            <div>
                              <span className="font-semibold text-foreground">{companyName}</span>
                              <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                Co.
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">Walk-in / Individual</span>
                          )}
                        </td>

                        {/* Member Name Column */}
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-foreground">
                            {memberNames || '—'}
                          </div>
                          {s.customer?.phone && (
                            <div className="text-[10px] text-muted-foreground font-mono">{s.customer.phone}</div>
                          )}
                        </td>

                        {/* Service Column */}
                        <td className="px-3 py-2.5">
                          <div className="space-y-0.5 max-w-xs">
                            {s.items?.map((it: any, iIdx: number) => (
                              <div key={iIdx} className="truncate text-[11px] flex items-center gap-1">
                                <span className="font-semibold text-foreground">{it.service?.name || 'Service'}</span>
                                <span className="text-muted-foreground font-mono">x{it.quantity}</span>
                                {it.person_name && (
                                  <span className="text-primary text-[10px] font-medium truncate">({it.person_name})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Staff Column */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-muted text-foreground font-medium text-[11px]">
                            {staffName}
                          </span>
                        </td>

                        {/* Financials */}
                        <td className="px-3 py-2.5 text-right font-bold text-foreground whitespace-nowrap">
                          {sGrandTotal.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-emerald-600 whitespace-nowrap">
                          <div>+{sPaid.toFixed(2)}</div>
                          <div className="text-[9px] text-muted-foreground font-normal truncate">{methods}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                          {sDue > 0 ? (
                            <span className="text-amber-600 font-bold">{sDue.toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground">0.00</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-black whitespace-nowrap">
                          {collectedProfit > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">+{collectedProfit.toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground">0.00</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Footer Totals */}
              {filteredSales.length > 0 && (
                <tfoot className="bg-muted/80 font-bold border-t-2 border-border text-foreground print:bg-gray-200 print:text-black">
                  <tr>
                    <td colSpan={7} className="px-3 py-2.5 text-right uppercase tracking-wider text-xs">
                      Daily Totals:
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-black text-primary print:text-black">
                      {totalGrossSales.toFixed(2)} AED
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-black text-emerald-600 print:text-black">
                      +{totalCollected.toFixed(2)} AED
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-black text-amber-600 print:text-black">
                      {totalDue.toFixed(2)} AED
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-black text-emerald-600 print:text-black">
                      +{totalProfit.toFixed(2)} AED
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── EXPENSES OF THE DAY (If any) ── */}
        {filteredExpenses.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-border bg-rose-500/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown size={16} className="text-rose-600" />
                <h3 className="text-xs font-bold text-foreground m-0">
                  Daily Expenses Log ({filteredExpenses.length})
                </h3>
              </div>
              <strong className="text-xs text-rose-600 font-bold">
                Total Out: -{totalExpenseAmount.toFixed(2)} AED
              </strong>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="px-3.5 py-2 w-10">#</th>
                    <th className="px-3.5 py-2">Category</th>
                    <th className="px-3.5 py-2">Description</th>
                    <th className="px-3.5 py-2">Paid To</th>
                    <th className="px-3.5 py-2">Method</th>
                    <th className="px-3.5 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-foreground">
                  {filteredExpenses.map((e, idx) => (
                    <tr key={e.id} className="hover:bg-muted/20">
                      <td className="px-3.5 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="px-3.5 py-2 font-semibold text-rose-600">{e.category?.name || 'Expense'}</td>
                      <td className="px-3.5 py-2 text-muted-foreground">{e.description || '—'}</td>
                      <td className="px-3.5 py-2">{e.paid_to || '—'}</td>
                      <td className="px-3.5 py-2 text-muted-foreground">{e.payment_method}</td>
                      <td className="px-3.5 py-2 text-right font-bold text-rose-600">
                        -{Number(e.amount || 0).toFixed(2)} AED
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </PermissionGuard>
  );
};
