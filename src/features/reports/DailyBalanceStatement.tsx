import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/db';
import { useAuth } from '../../components/AuthProvider';
import { PermissionGuard } from '../../components/PermissionGuard';
import { Logo } from '../../components/Logo';
import {
  Calendar,
  Building2,
  Printer,
  Download,
  CreditCard,
  Wallet,
  Landmark,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Layers,
  DollarSign
} from 'lucide-react';

export const DailyBalanceStatement: React.FC = () => {
  const { activeBranchId, availableBranches } = useAuth();

  // ── Branch Filter (Strictly single branch, NO "all") ──
  const initialBranchId = activeBranchId && activeBranchId !== 'all' 
    ? activeBranchId 
    : (availableBranches[0]?.id || '');

  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  // Sync if activeBranchId changes to a specific branch
  useEffect(() => {
    if (activeBranchId && activeBranchId !== 'all') {
      setSelectedBranchId(activeBranchId);
    } else if (!selectedBranchId && availableBranches.length > 0) {
      setSelectedBranchId(availableBranches[0].id);
    }
  }, [activeBranchId, availableBranches]);

  // ── Date Filters (Default to current month) ──
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [datePreset, setDatePreset] = useState<string>('this_month');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // ── Data States ──
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchData = async () => {
    if (!selectedBranchId) return;
    setLoading(true);
    try {
      const [sData, eData, pData, accData, bData] = await Promise.all([
        db.sales.getAll(selectedBranchId),
        db.expenses.getAll(selectedBranchId),
        db.payments.getAll(selectedBranchId),
        db.accounts.getAll(),
        db.branches.getAll()
      ]);

      const savedCompany = localStorage.getItem('azizi_company_profile');

      setSales(sData || []);
      setExpenses(eData || []);
      setPayments(pData || []);
      setAccounts((accData || []).filter((a: any) => !a.branch_id || a.branch_id === selectedBranchId));
      setBranches(bData || []);
      setCompanySettings(savedCompany ? JSON.parse(savedCompany) : null);
    } catch (err) {
      console.error('Failed to load Daily Balance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBranchId]);

  // ── Date Range Presets ──
  const applyPreset = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const d = now.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const d = y.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'this_week') {
      const first = new Date(now.setDate(now.getDate() - now.getDay()));
      const last = new Date();
      setStartDate(first.toISOString().split('T')[0]);
      setEndDate(last.toISOString().split('T')[0]);
    } else if (preset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(todayStr);
    } else if (preset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const last = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(last);
    } else if (preset === 'last_30_days') {
      const prev = new Date();
      prev.setDate(prev.getDate() - 30);
      setStartDate(prev.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

  // Helper for Govt Cost of a Sale
  const getSaleGovCost = (s: any) => {
    return (s.items || []).reduce((sum: number, it: any) => {
      const directItemExp = Number(it.expense || 0);
      const srvExp = (Number(it.service?.expense) || 0) * (Number(it.quantity) || 1);
      return sum + (directItemExp > 0 ? directItemExp : srvExp);
    }, 0);
  };

  // Helper for Typing Profit of a Sale
  const getSaleProfit = (s: any) => {
    const saleCost = getSaleGovCost(s);
    const saleGrandTotal = Number(s.grand_total ?? ((s.items || []).reduce((sum: number, it: any) => sum + (Number(it.subtotal) || ((Number(it.unit_price) || 0) * (Number(it.quantity) || 1))), 0) - (Number(s.discount) || 0)));
    return saleGrandTotal - saleCost;
  };

  // ── Generate All Dates in Range ──
  const dateList = useMemo(() => {
    if (!startDate || !endDate) return [];
    const list: string[] = [];
    let curr = new Date(startDate);
    const end = new Date(endDate);
    while (curr <= end) {
      list.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return list;
  }, [startDate, endDate]);

  // ── Calculate Day-by-Day Statements ──
  const { dailyRows, summaryTotals } = useMemo(() => {
    let runningBalance = 0;

    // Filter accounts if a specific account is chosen
    const relevantAccounts = selectedAccountId === 'all' 
      ? accounts 
      : accounts.filter(a => a.id === selectedAccountId);

    // Baseline current combined balance of relevant accounts
    const currentCombinedBalance = relevantAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);

    // Calculate all transactions prior to startDate to establish accurate opening balance
    const priorPayments = payments.filter(p => {
      const pDate = (p.payment_date || p.created_at)?.split('T')[0];
      const matchAcc = selectedAccountId === 'all' || p.account_id === selectedAccountId;
      return pDate < startDate && matchAcc;
    });
    const priorInflow = priorPayments.reduce((sum, p) => sum + (p.is_refund ? -Math.abs(Number(p.amount)) : Number(p.amount)), 0);

    const priorExpenses = expenses.filter(e => {
      const eDate = e.expense_date || e.created_at?.split('T')[0];
      const matchAcc = selectedAccountId === 'all' || e.account_id === selectedAccountId;
      return eDate < startDate && matchAcc;
    });
    const priorOutflow = priorExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    // Base opening balance (starting at baseline or computed prior flow)
    runningBalance = currentCombinedBalance - (priorInflow - priorOutflow);
    if (isNaN(runningBalance) || runningBalance < 0) {
      runningBalance = 0;
    }

    let totalOpeningPeriod = runningBalance;
    let grandInflow = 0;
    let grandBankCut = 0;
    let grandExpenses = 0;
    let grandProfit = 0;
    let grandNetChange = 0;

    const rows = dateList.map(dateStr => {
      const openingBalance = runningBalance;

      // 1. Sales for this day
      const daySales = sales.filter(s => {
        const sDate = s.created_at?.split('T')[0];
        return sDate === dateStr;
      });

      // 2. Customer Inflow for this day
      const dayPayments = payments.filter(p => {
        const pDate = (p.payment_date || p.created_at)?.split('T')[0];
        const matchAcc = selectedAccountId === 'all' || p.account_id === selectedAccountId;
        return pDate === dateStr && matchAcc;
      });
      const collected = dayPayments.filter(p => !p.is_refund && Number(p.amount) > 0).reduce((sum, p) => sum + Number(p.amount), 0);
      const refunded = dayPayments.filter(p => p.is_refund || Number(p.amount) < 0).reduce((sum, p) => sum + Math.abs(Number(p.amount)), 0);
      const netInflow = collected - refunded;

      // 3. Govt Fees & Portal Deductions for this day
      const dayGovCost = daySales.reduce((sum, s) => sum + getSaleGovCost(s), 0);

      // 4. Branch Operating Expenses (Non-Gov fee general expenses)
      const dayExpenses = expenses.filter(e => {
        const eDate = e.expense_date || e.created_at?.split('T')[0];
        const matchAcc = selectedAccountId === 'all' || e.account_id === selectedAccountId;
        const isGovFee = e.sale_id || e.category?.name?.toLowerCase().includes('govt') || e.title?.toLowerCase().includes('gov fee');
        return eDate === dateStr && matchAcc && !isGovFee;
      });
      const totalOperatingExp = dayExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

      // 5. Typing Profit for this day
      const dayProfit = daySales.reduce((sum, s) => sum + getSaleProfit(s), 0);

      // 6. Net Daily Change & Closing Balance
      const netDailyChange = netInflow - dayGovCost - totalOperatingExp;
      const closingBalance = openingBalance + netDailyChange;

      // Cut From Bank is strictly: Opening Balance - Closing Balance
      const dayCutFromBank = openingBalance - closingBalance;

      // Update running balance for next day
      runningBalance = closingBalance;

      // Aggregate totals
      grandInflow += netInflow;
      grandBankCut += dayCutFromBank;
      grandExpenses += totalOperatingExp;
      grandProfit += dayProfit;
      grandNetChange += netDailyChange;

      return {
        date: dateStr,
        openingBalance,
        inflow: netInflow,
        cutFromBank: dayCutFromBank,
        operatingExpenses: totalOperatingExp,
        profit: dayProfit,
        netChange: netDailyChange,
        closingBalance,
        salesCount: daySales.length,
        daySales,
        dayPayments,
        dayExpenses
      };
    });

    return {
      dailyRows: rows,
      summaryTotals: {
        totalOpening: totalOpeningPeriod,
        grandInflow,
        grandBankCut,
        grandExpenses,
        grandProfit,
        grandNetChange,
        finalClosing: runningBalance
      }
    };
  }, [dateList, sales, payments, expenses, accounts, selectedAccountId, startDate]);

  // Current active branch object
  const currentBranch = branches.find(b => b.id === selectedBranchId) || availableBranches.find(b => b.id === selectedBranchId);

  // ── CSV Export ──
  const handleExportCSV = () => {
    const branchName = currentBranch?.name || 'Branch';
    const headers = [
      'Date',
      'Opening Balance (AED)',
      'Closing Balance (AED)',
      'Cut From Bank (AED)',
      'Profit (AED)'
    ];

    const rows = dailyRows.map(r => [
      r.date,
      r.openingBalance.toFixed(2),
      r.closingBalance.toFixed(2),
      r.cutFromBank.toFixed(2),
      r.profit.toFixed(2)
    ]);

    const csvContent = [
      `"AZIZI TYPING & STAMP MAKING - DAILY BALANCE & PROFIT STATEMENT"`,
      `"Branch: ${branchName}","Period: ${startDate} to ${endDate}","Account: ${selectedAccountId === 'all' ? 'All Accounts' : accounts.find(a => a.id === selectedAccountId)?.name}"`,
      `"Opening Balance: ${summaryTotals.totalOpening.toFixed(2)} AED","Closing Balance: ${summaryTotals.finalClosing.toFixed(2)} AED","Total Cut From Bank: ${summaryTotals.grandBankCut.toFixed(2)} AED","Total Profit: ${summaryTotals.grandProfit.toFixed(2)} AED"`,
      '',
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Balance_Profit_${branchName.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <PermissionGuard permission="Reports.View" fallback="ui">
      <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
        
        {/* ── PRINT HEADER (Visible only on print) ── */}
        <div className="hidden print:block mb-6 border-b-2 border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size="md" />
              <div>
                <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">
                  {companySettings?.name || 'Azizi Documents Clearing Services'}
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  {companySettings?.tagline || 'Typing, Government Portal Services & Corporate Solutions'}
                </p>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {companySettings?.phone && `Tel: ${companySettings.phone} | `}
                  {companySettings?.email && `Email: ${companySettings.email} | `}
                  {companySettings?.trn && `TRN: ${companySettings.trn}`}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="px-3 py-1 bg-slate-100 rounded text-xs font-bold text-slate-800 border border-slate-300">
                DAILY BALANCE & PROFIT STATEMENT
              </div>
              <div className="text-xs font-bold text-slate-900 mt-1">Branch: {currentBranch?.name || 'Main Branch'}</div>
              <div className="text-[10px] text-slate-500 font-mono">Period: {startDate} to {endDate}</div>
              <div className="text-[9px] text-slate-400 font-mono">Printed: {new Date().toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* ── TOP HEADER (Screen) ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Reports & Insights</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                <Building2 size={11} />
                Branch-Specific Statement
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground m-0 flex items-center gap-2.5">
              <Landmark className="text-primary" size={26} />
              Daily Balance & Profit Statement
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track daily opening & closing liquidity, portal government fee deductions (Cut From Bank), and net typing profits.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
            >
              <Printer size={15} className="text-muted-foreground" />
              <span>Print Statement</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 text-xs font-bold flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* ── FILTER TOOLBAR ── */}
        <div className="glass border border-border rounded-2xl p-4 space-y-3 print:hidden shadow-xs">
          
          {/* Branch & Preset Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            
            {/* MANDATORY BRANCH SELECTOR (NO "ALL") */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5 shrink-0">
                <Building2 size={14} className="text-primary" />
                Select Branch *:
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border-2 border-primary/40 bg-background font-bold text-xs text-foreground focus:ring-2 focus:ring-primary outline-none cursor-pointer"
              >
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    🏢 {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* QUICK PRESETS */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-muted-foreground mr-1">Period:</span>
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'last_30_days', label: 'Last 30 Days' }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    datePreset === p.id
                      ? 'bg-primary text-white shadow-2xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* DATE RANGE & ACCOUNT PICKERS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            
            {/* Start Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Calendar size={11} /> From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="w-full px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-bold text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Calendar size={11} /> To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="w-full px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-bold text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Account Selector */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Wallet size={11} /> Filter Account (Optional)
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-bold text-foreground focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">🏦 All Branch Accounts Combined ({accounts.length} Accounts)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.type === 'bank' ? '🏛️' : a.type === 'card' ? '💳' : '💵'} {a.name} ({Number(a.balance || 0).toFixed(2)} AED)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── SUMMARY KPI STATS (Strict 4 Metrics) ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Starting Balance */}
          <div className="glass border border-border/80 rounded-2xl p-4 space-y-1 shadow-2xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Opening Balance</span>
              <Wallet size={14} className="text-primary" />
            </div>
            <div className="text-xl font-black text-foreground font-mono">
              {summaryTotals.totalOpening.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">AED</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Period Starting Liquidity</div>
          </div>

          {/* Closing Balance */}
          <div className="glass border-2 border-primary/30 bg-primary/5 rounded-2xl p-4 space-y-1 shadow-xs">
            <div className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center justify-between">
              <span>Closing Balance</span>
              <Landmark size={14} className="text-primary" />
            </div>
            <div className="text-xl font-black text-primary font-mono">
              {summaryTotals.finalClosing.toFixed(2)} <span className="text-xs font-normal text-primary/70">AED</span>
            </div>
            <div className="text-[10px] text-muted-foreground font-semibold">Period Closing Liquidity</div>
          </div>

          {/* Cut From Bank */}
          <div className="glass border border-rose-500/20 bg-rose-500/5 rounded-2xl p-4 space-y-1 shadow-2xs">
            <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center justify-between">
              <span>Cut From Bank</span>
              <CreditCard size={14} className="text-rose-600" />
            </div>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
              -{summaryTotals.grandBankCut.toFixed(2)} <span className="text-xs font-normal opacity-70">AED</span>
            </div>
            <div className="text-[10px] text-rose-600/80">Total Portal & Govt Fee Deductions</div>
          </div>

          {/* Typing Profit */}
          <div className="glass border-2 border-emerald-500/30 bg-emerald-500/10 rounded-2xl p-4 space-y-1 shadow-xs">
            <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center justify-between">
              <span>Profit</span>
              <TrendingUp size={14} className="text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
              +{summaryTotals.grandProfit.toFixed(2)} <span className="text-xs font-normal opacity-70">AED</span>
            </div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">Total Typing Margin</div>
          </div>
        </div>

        {/* ── DAILY BALANCE & PROFIT STATEMENT TABLE (Exact Requested Columns) ── */}
        <div className="glass border border-border rounded-2xl overflow-hidden shadow-xl bg-card">
          
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <Layers size={17} className="text-primary" />
              <h2 className="text-sm font-bold text-foreground m-0">
                Daily Balance Sheet ({dailyRows.length} Days)
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
                {currentBranch?.name || 'Branch'}
              </span>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              AED Currency
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="w-12 text-center px-3 py-3">#</th>
                  <th className="px-4 py-3 min-w-[150px]">Date</th>
                  <th className="text-right px-4 py-3 min-w-[140px]">Opening Balance</th>
                  <th className="text-right px-4 py-3 min-w-[140px] font-black text-foreground">Closing Balance</th>
                  <th className="text-right px-4 py-3 min-w-[150px] text-rose-700 dark:text-rose-400">Cut From Bank</th>
                  <th className="text-right px-4 py-3 min-w-[140px] bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-black">Profit</th>
                  <th className="w-16 text-center px-2 py-3 print:hidden"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-muted-foreground">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
                      <div className="text-xs font-semibold">Calculating daily balances & profit statements...</div>
                    </td>
                  </tr>
                ) : dailyRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground italic">
                      No records found for the selected branch and date range.
                    </td>
                  </tr>
                ) : (
                  dailyRows.map((row, idx) => {
                    const dateObj = new Date(row.date);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const isExpanded = expandedDate === row.date;

                    return (
                      <React.Fragment key={row.date}>
                        <tr 
                          className={`hover:bg-primary/5 transition-colors cursor-pointer ${
                            isExpanded ? 'bg-primary/10' : ''
                          }`}
                          onClick={() => setExpandedDate(isExpanded ? null : row.date)}
                        >
                          <td className="text-center px-3 py-3 font-mono text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{row.date}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-muted text-muted-foreground uppercase border border-border">
                                {dayName}
                              </span>
                              {row.salesCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
                                  {row.salesCount} {row.salesCount === 1 ? 'sale' : 'sales'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-right px-4 py-3 font-mono font-semibold text-foreground text-sm">
                            {row.openingBalance.toFixed(2)}
                          </td>
                          <td className="text-right px-4 py-3 font-mono font-black text-foreground text-sm">
                            {row.closingBalance.toFixed(2)}
                          </td>
                          <td className="text-right px-4 py-3 font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                            {row.cutFromBank > 0 ? `-${row.cutFromBank.toFixed(2)}` : '0.00'}
                          </td>
                          <td className="text-right px-4 py-3 font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 text-sm">
                            +{row.profit.toFixed(2)}
                          </td>
                          <td className="text-center px-2 py-3 print:hidden">
                            <button
                              type="button"
                              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Toggle day transaction drilldown"
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </td>
                        </tr>

                        {/* ── EXPANDED DAY DRILLDOWN ── */}
                        {isExpanded && (
                          <tr className="bg-muted/20 print:hidden">
                            <td colSpan={7} className="p-4">
                              <div className="bg-card border border-border rounded-xl p-4 space-y-4 shadow-sm">
                                
                                <div className="flex items-center justify-between border-b border-border pb-2">
                                  <div className="flex items-center gap-2">
                                    <Calendar size={15} className="text-primary" />
                                    <h3 className="text-xs font-bold text-foreground m-0">
                                      Day Breakdown for {row.date} ({dayName})
                                    </h3>
                                  </div>
                                  <div className="text-[11px] font-bold text-emerald-600">
                                    Day Profit: +{row.profit.toFixed(2)} AED
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  
                                  {/* Invoices List */}
                                  <div className="space-y-2">
                                    <div className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                                      <DollarSign size={13} className="text-primary" />
                                      Invoices Created ({row.daySales.length})
                                    </div>
                                    {row.daySales.length === 0 ? (
                                      <div className="text-xs text-muted-foreground italic p-3 bg-muted/40 rounded-lg">
                                        No invoices created on this date.
                                      </div>
                                    ) : (
                                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                        {row.daySales.map((s: any) => {
                                          const cost = getSaleGovCost(s);
                                          const prof = getSaleProfit(s);
                                          return (
                                            <div key={s.id} className="p-2 rounded-lg bg-muted/40 border border-border text-xs flex items-center justify-between">
                                              <div>
                                                <div className="font-bold font-mono text-foreground">{s.invoice_no}</div>
                                                <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                                  {s.person_name || s.customer?.name || 'Customer'}
                                                </div>
                                              </div>
                                              <div className="text-right font-mono">
                                                <div className="font-bold text-foreground">{Number(s.grand_total || 0).toFixed(2)} AED</div>
                                                <div className="text-[10px] text-rose-600">Gov: {cost.toFixed(2)}</div>
                                                <div className="text-[10px] text-emerald-600 font-bold">Profit: +{prof.toFixed(2)}</div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* Operating Bills */}
                                  <div className="space-y-2">
                                    <div className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                                      <TrendingDown size={13} className="text-amber-600" />
                                      Operating Expenses & Bills ({row.dayExpenses.length})
                                    </div>
                                    {row.dayExpenses.length === 0 ? (
                                      <div className="text-xs text-muted-foreground italic p-3 bg-muted/40 rounded-lg">
                                        No operating expenses logged on this date.
                                      </div>
                                    ) : (
                                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                        {row.dayExpenses.map((e: any) => (
                                          <div key={e.id} className="p-2 rounded-lg bg-muted/40 border border-border text-xs flex items-center justify-between">
                                            <div>
                                              <div className="font-bold text-foreground">{e.title}</div>
                                              <div className="text-[10px] text-muted-foreground">{e.category?.name || 'General'}</div>
                                            </div>
                                            <div className="font-bold font-mono text-rose-600">
                                              -{Number(e.amount || 0).toFixed(2)} AED
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>

              {/* TABLE FOOTER TOTALS */}
              {dailyRows.length > 0 && (
                <tfoot className="bg-muted/80 font-black border-t-2 border-border text-foreground text-xs">
                  <tr>
                    <td colSpan={2} className="px-4 py-3.5 text-center uppercase tracking-wider text-xs">
                      TOTALS ({dailyRows.length} Days)
                    </td>
                    <td className="text-right px-4 py-3.5 font-mono text-sm">
                      {summaryTotals.totalOpening.toFixed(2)}
                    </td>
                    <td className="text-right px-4 py-3.5 font-mono text-sm text-primary">
                      {summaryTotals.finalClosing.toFixed(2)}
                    </td>
                    <td className="text-right px-4 py-3.5 font-mono text-sm text-rose-600 dark:text-rose-400">
                      -{summaryTotals.grandBankCut.toFixed(2)}
                    </td>
                    <td className="text-right px-4 py-3.5 font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 text-sm font-black">
                      +{summaryTotals.grandProfit.toFixed(2)}
                    </td>
                    <td className="print:hidden"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── PRINT FOOTER / SIGNATURES ── */}
        <div className="hidden print:flex justify-between items-center mt-12 pt-8 border-t border-slate-300 text-xs text-slate-700">
          <div>
            <div className="w-44 border-b border-slate-400 mb-1"></div>
            <div>Prepared By (Accountant / Cashier)</div>
          </div>
          <div>
            <div className="w-44 border-b border-slate-400 mb-1"></div>
            <div>Branch Manager Verification</div>
          </div>
          <div>
            <div className="w-44 border-b border-slate-400 mb-1"></div>
            <div>Authorized Auditor Signature</div>
          </div>
        </div>

      </div>
    </PermissionGuard>
  );
};
