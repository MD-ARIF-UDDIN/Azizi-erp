import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { useAuth } from '../../components/AuthProvider';
import { PermissionGuard } from '../../components/PermissionGuard';
import {
  Download,
  Printer,
  Calendar,
  Layers,
  Briefcase,
  DollarSign,
  TrendingDown,
  X
} from 'lucide-react';


export const ReportsCenter: React.FC = () => {
  const { activeBranchId } = useAuth();
  
  // Tab control
  const [activeTab, setActiveTab] = useState<'sales' | 'expenses' | 'services' | 'balance'>('balance');


  // Date Filters
  const getFirstOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  };
  const getToday = () => new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(getFirstOfMonth());
  const [endDate, setEndDate] = useState(getToday());

  // Data
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Audit Modal State ---
  const [selectedReportDate, setSelectedReportDate] = useState<string | null>(null);
  const [dateSales, setDateSales] = useState<any[]>([]);
  const [datePayments, setDatePayments] = useState<any[]>([]);
  const [dateExpenses, setDateExpenses] = useState<any[]>([]);


  const fetchReportData = async () => {
    setLoading(true);
    try {
      const branchFilter = activeBranchId === 'all' ? undefined : activeBranchId;
      const sData = await db.sales.getAll(branchFilter);
      const eData = await db.expenses.getAll(branchFilter);
      
      // Let's resolve sales payments
      const resolvedSales = sData.map(sale => {
        const totalPaid = sale.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
        const due = Math.max(0, sale.grand_total - totalPaid);
        return {
          ...sale,
          total_paid: totalPaid,
          due_balance: due
        };
      });

      setSales(resolvedSales);
      setExpenses(eData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeBranchId]);

  // Date Filtering Logic
  const filteredSales = sales.filter(s => {
    const saleDate = s.created_at.split('T')[0];
    return saleDate >= startDate && saleDate <= endDate;
  });

  const filteredExpenses = expenses.filter(e => {
    return e.expense_date >= startDate && e.expense_date <= endDate;
  });

  // Gross aggregations
  const totalSalesSub = filteredSales.reduce((sum, s) => sum + s.subtotal, 0);
  const totalSalesDisc = filteredSales.reduce((sum, s) => sum + s.discount, 0);
  const totalSalesGrand = filteredSales.reduce((sum, s) => sum + s.grand_total, 0);
  const totalSalesPaid = filteredSales.reduce((sum, s) => sum + s.total_paid, 0);
  const totalSalesDue = filteredSales.reduce((sum, s) => sum + s.due_balance, 0);

  const totalExpenseCost = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Service performance aggregation
  const getServicePerformance = () => {
    const performanceMap: Record<string, { serviceName: string; categoryName: string; quantitySold: number; totalGross: number }> = {};
    
    filteredSales.forEach(s => {
      s.items?.forEach((item: any) => {
        const sId = item.service_id;
        const sName = item.service?.name || 'Deleted Service';
        const cName = item.service?.category?.name || 'Uncategorized';
        
        if (!performanceMap[sId]) {
          performanceMap[sId] = {
            serviceName: sName,
            categoryName: cName,
            quantitySold: 0,
            totalGross: 0
          };
        }
        performanceMap[sId].quantitySold += item.quantity;
        performanceMap[sId].totalGross += item.subtotal;
      });
    });

    return Object.values(performanceMap).sort((a,b) => b.totalGross - a.totalGross);
  };

  const servicePerformanceList = getServicePerformance();
  const totalQuantitySold = servicePerformanceList.reduce((sum, sp) => sum + sp.quantitySold, 0);
  const totalServiceGross = servicePerformanceList.reduce((sum, sp) => sum + sp.totalGross, 0);

  const getDailyBalanceReport = () => {
    // Collect all payments across all sales
    const allPayments: { date: string; amount: number }[] = [];
    sales.forEach(s => {
      s.payments?.forEach((p: any) => {
        allPayments.push({
          date: p.payment_date.split('T')[0],
          amount: p.amount
        });
      });
    });

    const allExpensesFormatted = expenses.map(e => ({
      date: e.expense_date,
      amount: e.amount
    }));

    const allSalesFormatted = sales.map(s => ({
      date: s.created_at.split('T')[0],
      amount: s.grand_total
    }));

    // Calculate starting balance and starting dues before selected startDate
    const paymentsBeforeStart = allPayments
      .filter(p => p.date < startDate)
      .reduce((sum, p) => sum + p.amount, 0);
    const expensesBeforeStart = allExpensesFormatted
      .filter(e => e.date < startDate)
      .reduce((sum, e) => sum + e.amount, 0);
    const salesBeforeStart = allSalesFormatted
      .filter(s => s.date < startDate)
      .reduce((sum, s) => sum + s.amount, 0);

    let runningBalance = paymentsBeforeStart - expensesBeforeStart;
    let runningDue = Math.max(0, salesBeforeStart - paymentsBeforeStart);

    // Generate continuous date range
    const dateList: string[] = [];
    let curr = new Date(startDate);
    const end = new Date(endDate);
    while (curr <= end) {
      dateList.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    // Map metrics for each date
    const dailyReport = dateList.map(date => {
      const dayPayments = allPayments
        .filter(p => p.date === date)
        .reduce((sum, p) => sum + p.amount, 0);
      const dayExpenses = allExpensesFormatted
        .filter(e => e.date === date)
        .reduce((sum, e) => sum + e.amount, 0);
      const daySales = allSalesFormatted
        .filter(s => s.date === date)
        .reduce((sum, s) => sum + s.amount, 0);

      const opening = runningBalance;
      const openingDue = runningDue;

      const net = dayPayments - dayExpenses;
      runningBalance += net;
      const closing = runningBalance;

      // Dues logic: Dues increase with new sales, decrease with collections
      runningDue = Math.max(0, runningDue + daySales - dayPayments);
      const closingDue = runningDue;

      return {
        date,
        opening,
        collections: dayPayments,
        expenses: dayExpenses,
        net,
        closing,
        openingDue,
        closingDue
      };
    });

    return dailyReport.reverse();
  };

  const dailyBalanceList = getDailyBalanceReport();




  // Dynamic CSV Exporter
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = '';

    if (activeTab === 'sales') {
      headers = ['Invoice No', 'Date', 'Branch', 'Customer', 'Subtotal', 'Discount', 'Grand Total', 'Paid', 'Due', 'Payment Status'];
      rows = filteredSales.map(s => [
        s.invoice_no,
        new Date(s.created_at).toLocaleDateString(),
        s.branch?.name || '',
        s.customer?.name || 'Walk-in',
        s.subtotal.toString(),
        s.discount.toString(),
        s.grand_total.toString(),
        s.total_paid.toString(),
        s.due_balance.toString(),
        s.payment_status
      ]);
      filename = `sales_report_${startDate}_to_${endDate}.csv`;
    } else if (activeTab === 'expenses') {
      headers = ['Date', 'Category', 'Branch', 'Paid To', 'Method', 'Description', 'Amount'];
      rows = filteredExpenses.map(e => [
        e.expense_date,
        e.category?.name || '',
        e.branch?.name || '',
        e.paid_to || '',
        e.payment_method,
        e.description || '',
        e.amount.toString()
      ]);
      filename = `expenses_report_${startDate}_to_${endDate}.csv`;
    } else if (activeTab === 'services') {
      headers = ['Service Name', 'Category', 'Quantity Sold', 'Gross Revenue'];
      rows = servicePerformanceList.map(sp => [
        sp.serviceName,
        sp.categoryName,
        sp.quantitySold.toString(),
        sp.totalGross.toString()
      ]);
      filename = `services_performance_${startDate}_to_${endDate}.csv`;
    } else if (activeTab === 'balance') {
      headers = ['Date', 'Starting Balance (AED)', 'Collections (AED)', 'Expenses (AED)', 'Net Change (AED)', 'Ending Balance (AED)', 'Opening Due (AED)', 'Ending Due (AED)'];
      rows = dailyBalanceList.map(item => [
        item.date,
        item.opening.toFixed(2),
        item.collections.toFixed(2),
        item.expenses.toFixed(2),
        item.net.toFixed(2),
        item.closing.toFixed(2),
        item.openingDue.toFixed(2),
        item.closingDue.toFixed(2)
      ]);
      filename = `daily_balance_report_${startDate}_to_${endDate}.csv`;
    }




    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const applyQuickFilter = (filterType: 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'year' | 'last_30' | 'last_90' | 'last_year') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (filterType === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (filterType === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (filterType === 'week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      setStartDate(sevenDaysAgo.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (filterType === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (filterType === 'last_month') {
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(firstDayLastMonth.toISOString().split('T')[0]);
      setEndDate(lastDayLastMonth.toISOString().split('T')[0]);
    } else if (filterType === 'year') {
      const firstDayYear = new Date(today.getFullYear(), 0, 1);
      setStartDate(firstDayYear.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (filterType === 'last_30') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (filterType === 'last_90') {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(today.getDate() - 90);
      setStartDate(ninetyDaysAgo.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (filterType === 'last_year') {
      const firstDayLastYear = new Date(today.getFullYear() - 1, 0, 1);
      const lastDayLastYear = new Date(today.getFullYear() - 1, 11, 31);
      setStartDate(firstDayLastYear.toISOString().split('T')[0]);
      setEndDate(lastDayLastYear.toISOString().split('T')[0]);
    }
  };

  const openDateDetails = (dateStr: string) => {
    const daySales = sales.filter(s => s.created_at.split('T')[0] === dateStr);
    
    const dayPayments: any[] = [];
    sales.forEach(s => {
      s.payments?.forEach((p: any) => {
        if (p.payment_date.split('T')[0] === dateStr) {
          dayPayments.push({
            ...p,
            invoice_no: s.invoice_no,
            customer: s.customer
          });
        }
      });
    });

    const dayExpenses = expenses.filter(e => e.expense_date === dateStr);

    setSelectedReportDate(dateStr);
    setDateSales(daySales);
    setDatePayments(dayPayments);
    setDateExpenses(dayExpenses);
  };

  const getRecentMonths = () => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      const value = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      months.push({ label, value });
    }
    return months;
  };

  const handleMonthChange = (monthVal: string) => {
    if (!monthVal) return;
    const [year, month] = monthVal.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  };



  return (
    <PermissionGuard permission="Reports.View" fallback="ui">
      <div className="space-y-6 print:p-0 print:bg-white print:text-black">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">ERP Reports Center</h1>
            <p className="text-sm text-muted-foreground">Perform audits, check branch metrics, run tax reports, and compile receipts.</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-4 py-2 bg-muted/100 hover:bg-secondary border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
            >
              <Printer size={14} />
              Print Report
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-colors"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>

        {/* DATE RANGE FILTERS PANEL */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-2xl border border-border print:hidden">
          <div className="md:col-span-2 space-y-1">
            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
              <Calendar size={13} /> Select Date Range
            </span>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground"
              />
              <select
                onChange={(e) => handleMonthChange(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground font-semibold cursor-pointer"
                defaultValue=""
              >
                <option value="" disabled>Select Month</option>
                {getRecentMonths().map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              <button
                type="button"
                onClick={() => applyQuickFilter('today')}
                className="px-2 py-1 bg-background hover:bg-secondary border border-border rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyQuickFilter('yesterday')}
                className="px-2 py-1 bg-background hover:bg-secondary border border-border rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => applyQuickFilter('week')}
                className="px-2 py-1 bg-background hover:bg-secondary border border-border rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => applyQuickFilter('last_30')}
                className="px-2 py-1 bg-background hover:bg-secondary border border-border rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => applyQuickFilter('last_90')}
                className="px-2 py-1 bg-background hover:bg-secondary border border-border rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                Last 90 Days
              </button>
              <button
                type="button"
                onClick={() => applyQuickFilter('month')}
                className="px-2 py-1 bg-background hover:bg-secondary border border-border rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => applyQuickFilter('last_month')}
                className="px-2 py-1 bg-background hover:bg-secondary border border-border rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                Last Month
              </button>
              <button
                type="button"
                onClick={() => applyQuickFilter('year')}
                className="px-2 py-1 bg-background hover:bg-secondary border border-border rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                This Year
              </button>
              <button
                type="button"
                onClick={() => applyQuickFilter('last_year')}
                className="px-2 py-1 bg-background hover:bg-secondary border border-border rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                Last Year
              </button>
            </div>
          </div>

          <div className="md:col-span-2 space-y-1">
            <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
              <Layers size={13} /> Select Report Tab
            </span>
            <div className="bg-background border border-border p-1 rounded-lg flex gap-1 mt-1">
              <button
                onClick={() => setActiveTab('sales')}
                className={`flex-1 py-1 px-3 rounded text-[11px] font-semibold transition-all ${
                  activeTab === 'sales' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sales Ledger
              </button>
              <button
                onClick={() => setActiveTab('expenses')}
                className={`flex-1 py-1 px-3 rounded text-[11px] font-semibold transition-all ${
                  activeTab === 'expenses' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Expense Report
              </button>
              <button
                onClick={() => setActiveTab('services')}
                className={`flex-1 py-1 px-3 rounded text-[11px] font-semibold transition-all ${
                  activeTab === 'services' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Service Performance
              </button>
              <button
                onClick={() => setActiveTab('balance')}
                className={`flex-1 py-1 px-3 rounded text-[11px] font-semibold transition-all ${
                  activeTab === 'balance' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Overall Balance
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic header for printed output */}
        <div className="hidden print:block text-center border-b pb-4 mb-6 space-y-1.5">
          <h2 className="text-2xl font-bold text-black uppercase">Azizi Typing, Print & Stamp ERP</h2>
          <div className="text-sm font-semibold text-zinc-700">Financial Audit Statements</div>
          <div className="text-xs text-zinc-600">
            Report Type: {activeTab === 'sales' ? 'Sales Ledger Statement' : activeTab === 'expenses' ? 'Expenditure Ledger Statement' : activeTab === 'services' ? 'Service Performance Summary' : 'Overall Customer Balance Ledger'}
          </div>
          <div className="text-xs text-zinc-500">
            Period: {startDate} to {endDate} • Branch ID: {activeBranchId === 'all' ? 'All Branches' : activeBranchId}
          </div>
        </div>

        {/* LOADING SKELETON */}
        {loading ? (
          <div className="space-y-3">
            <div className="h-10 bg-muted/30 rounded-xl animate-pulse" />
            <div className="h-40 bg-muted/30 rounded-xl animate-pulse" />
          </div>
        ) : (
          <>
            {/* 1. SALES REPORT TAB PANEL */}
            {activeTab === 'sales' && (
              <div className="space-y-6">
                
                {/* Cumulative summary totals */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                  <div className="glass border border-border/80 p-4 rounded-xl text-center shadow-sm">
                    <span className="text-[9px] text-muted-foreground font-semibold uppercase">Total Gross Bill</span>
                    <div className="text-sm font-bold text-foreground mt-1">{totalSalesSub.toFixed(2)}</div>
                  </div>
                  <div className="glass border border-border/80 p-4 rounded-xl text-center shadow-sm">
                    <span className="text-[9px] text-rose-400 font-semibold uppercase">Discounts Granted</span>
                    <div className="text-sm font-bold text-rose-400 mt-1">-{totalSalesDisc.toFixed(2)}</div>
                  </div>
                  <div className="glass border border-border/80 p-4 rounded-xl text-center shadow-sm bg-primary/5 border-primary/20">
                    <span className="text-[9px] text-primary font-semibold uppercase">Net Billing</span>
                    <div className="text-sm font-bold text-foreground mt-1">{totalSalesGrand.toFixed(2)}</div>
                  </div>
                  <div className="glass border border-border/80 p-4 rounded-xl text-center shadow-sm">
                    <span className="text-[9px] text-emerald-400 font-semibold uppercase">Revenue Collections</span>
                    <div className="text-sm font-bold text-emerald-400 mt-1">+{totalSalesPaid.toFixed(2)}</div>
                  </div>
                  <div className="glass border border-border/80 p-4 rounded-xl text-center shadow-sm">
                    <span className="text-[9px] text-amber-400 font-semibold uppercase">Outstanding Due</span>
                    <div className="text-sm font-bold text-amber-400 mt-1">{totalSalesDue.toFixed(2)}</div>
                  </div>
                </div>

                {/* Sales list data grid */}
                <div className="glass border border-border rounded-2xl overflow-hidden shadow-xl print:border-none print:shadow-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold print:text-zinc-700">
                        <tr>
                          <th className="px-5 py-3">Invoice No</th>
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Branch</th>
                          <th className="px-5 py-3">Customer</th>
                          <th className="px-5 py-3 text-right">Subtotal</th>
                          <th className="px-5 py-3 text-right">Discount</th>
                          <th className="px-5 py-3 text-right">Grand Total</th>
                          <th className="px-5 py-3 text-right">Paid</th>
                          <th className="px-5 py-3 text-right">Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 text-muted-foreground print:text-zinc-800">
                        {filteredSales.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-5 py-10 text-center text-muted-foreground">
                              No invoice records found in the specified range.
                            </td>
                          </tr>
                        ) : (
                          filteredSales.map(s => (
                            <tr key={s.id} className="hover:bg-muted/10 print:hover:bg-transparent">
                              <td className="px-5 py-3 font-semibold text-foreground print:text-black">{s.invoice_no}</td>
                              <td className="px-5 py-3">{new Date(s.created_at).toLocaleDateString()}</td>
                              <td className="px-5 py-3">{s.branch?.name}</td>
                              <td className="px-5 py-3 text-foreground print:text-black">
                                 {s.customer 
                                   ? s.person_name
                                     ? `${s.person_name} (${s.customer.name})`
                                     : s.customer.company?.name
                                     ? `${s.customer.name} (${s.customer.company.name})`
                                     : s.customer.name
                                   : 'Walk-in'}
                               </td>
                              <td className="px-5 py-3 text-right">{s.subtotal.toFixed(2)}</td>
                              <td className="px-5 py-3 text-right text-rose-400">-{s.discount.toFixed(2)}</td>
                              <td className="px-5 py-3 text-right text-foreground print:text-black font-semibold">{s.grand_total.toFixed(2)}</td>
                              <td className="px-5 py-3 text-right text-emerald-400">+{s.total_paid.toFixed(2)}</td>
                              <td className="px-5 py-3 text-right text-amber-400 font-semibold">{s.due_balance.toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* 2. EXPENSES REPORT TAB PANEL */}
            {activeTab === 'expenses' && (
              <div className="space-y-6">
                
                {/* Total Cost summary card */}
                <div className="glass border border-border/80 p-5 rounded-xl max-w-sm flex items-center gap-4 shadow-sm bg-rose-500/5">
                  <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <TrendingDown size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">Total Expenditures</span>
                    <h3 className="text-md font-bold text-rose-400 mt-0.5">-{totalExpenseCost.toFixed(2)} AED</h3>
                  </div>
                </div>

                {/* Expenses Log Table */}
                <div className="glass border border-border rounded-2xl overflow-hidden shadow-xl print:border-none print:shadow-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold print:text-zinc-700">
                        <tr>
                          <th className="px-5 py-3">Expense Date</th>
                          <th className="px-5 py-3">Category</th>
                          <th className="px-5 py-3">Branch</th>
                          <th className="px-5 py-3">Paid To</th>
                          <th className="px-5 py-3">Method</th>
                          <th className="px-5 py-3">Description</th>
                          <th className="px-5 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 text-muted-foreground print:text-zinc-800">
                        {filteredExpenses.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                              No expense records logged in the specified range.
                            </td>
                          </tr>
                        ) : (
                          filteredExpenses.map(e => (
                            <tr key={e.id} className="hover:bg-muted/10 print:hover:bg-transparent">
                              <td className="px-5 py-3 text-foreground print:text-black font-semibold">{e.expense_date}</td>
                              <td className="px-5 py-3 font-semibold text-primary">{e.category?.name}</td>
                              <td className="px-5 py-3">{e.branch?.name}</td>
                              <td className="px-5 py-3 text-foreground print:text-black">{e.paid_to || 'N/A'}</td>
                              <td className="px-5 py-3">{e.payment_method}</td>
                              <td className="px-5 py-3 italic">{e.description || 'N/A'}</td>
                              <td className="px-5 py-3 text-right text-rose-400 font-bold">-{e.amount.toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* 3. SERVICE PERFORMANCE REPORT TAB PANEL */}
            {activeTab === 'services' && (
              <div className="space-y-6">
                
                {/* Summaries */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl">
                  <div className="glass border border-border/80 p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Briefcase size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">Total items sold</span>
                      <div className="text-sm font-bold text-foreground mt-0.5">{totalQuantitySold} Units</div>
                    </div>
                  </div>
                  <div className="glass border border-border/80 p-4 rounded-xl flex items-center gap-3.5 shadow-sm bg-emerald-500/5">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <DollarSign size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">Total Gross Value</span>
                      <div className="text-sm font-bold text-foreground mt-0.5">{totalServiceGross.toFixed(2)} AED</div>
                    </div>
                  </div>
                </div>

                {/* Performance table */}
                <div className="glass border border-border rounded-2xl overflow-hidden shadow-xl print:border-none print:shadow-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold print:text-zinc-700">
                        <tr>
                          <th className="px-6 py-3.5">Service Name</th>
                          <th className="px-6 py-3.5">Category</th>
                          <th className="px-6 py-3.5 text-center">Quantity Sold</th>
                          <th className="px-6 py-3.5 text-right">Gross revenue Generated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 text-muted-foreground print:text-zinc-800">
                        {servicePerformanceList.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                              No service transactions mapped in the specified range.
                            </td>
                          </tr>
                        ) : (
                          servicePerformanceList.map((sp, index) => (
                            <tr key={index} className="hover:bg-muted/10 print:hover:bg-transparent">
                              <td className="px-6 py-3.5 text-foreground print:text-black font-semibold">{sp.serviceName}</td>
                              <td className="px-6 py-3.5 font-semibold text-primary">{sp.categoryName}</td>
                              <td className="px-6 py-3.5 text-center font-bold text-foreground print:text-black">{sp.quantitySold}</td>
                              <td className="px-6 py-3.5 text-right font-extrabold text-emerald-400">
                                {sp.totalGross.toFixed(2)} AED
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* 4. OVERALL BALANCE REPORT TAB PANEL */}
            {activeTab === 'balance' && (
              <div className="space-y-6">
                
                {/* Dues summary cards */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 w-full">
                  <div className="glass border border-border/80 p-4 rounded-xl flex flex-col justify-between shadow-sm bg-primary/5 border-primary/20">
                    <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block">Opening Cash Balance</span>
                    <div className="text-xs font-extrabold text-foreground mt-2">
                      {(dailyBalanceList[dailyBalanceList.length - 1]?.opening || 0).toFixed(2)} AED
                    </div>
                  </div>
                  
                  <div className="glass border border-border/80 p-4 rounded-xl flex flex-col justify-between shadow-sm bg-emerald-500/5 border-emerald-500/20">
                    <span className="text-[9px] text-emerald-450 font-bold uppercase tracking-wider block">Range Collections (+)</span>
                    <div className="text-xs font-extrabold text-emerald-400 mt-2">
                      +{dailyBalanceList.reduce((sum, b) => sum + b.collections, 0).toFixed(2)} AED
                    </div>
                  </div>

                  <div className="glass border border-border/80 p-4 rounded-xl flex flex-col justify-between shadow-sm bg-rose-500/5 border-rose-500/20">
                    <span className="text-[9px] text-rose-450 font-bold uppercase tracking-wider block">Range Expenses (-)</span>
                    <div className="text-xs font-extrabold text-rose-405 mt-2">
                      -{dailyBalanceList.reduce((sum, b) => sum + b.expenses, 0).toFixed(2)} AED
                    </div>
                  </div>

                  <div className="glass border border-border/80 p-4 rounded-xl flex flex-col justify-between shadow-sm bg-emerald-600/10 border-emerald-500/35">
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block">Ending Cash Balance</span>
                    <div className="text-xs font-black text-emerald-350 mt-2">
                      {(dailyBalanceList[0]?.closing || 0).toFixed(2)} AED
                    </div>
                  </div>

                  <div className="glass border border-border/80 p-4 rounded-xl flex flex-col justify-between shadow-sm bg-amber-500/5 border-amber-500/20">
                    <span className="text-[9px] text-amber-450 font-bold uppercase tracking-wider block">Opening Outstanding Due</span>
                    <div className="text-xs font-extrabold text-amber-400 mt-2">
                      {(dailyBalanceList[dailyBalanceList.length - 1]?.openingDue || 0).toFixed(2)} AED
                    </div>
                  </div>

                  <div className="glass border border-border/80 p-4 rounded-xl flex flex-col justify-between shadow-sm bg-amber-500/10 border-amber-500/35">
                    <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider block">Ending Outstanding Due</span>
                    <div className="text-xs font-black text-amber-400 mt-2">
                      {(dailyBalanceList[0]?.closingDue || 0).toFixed(2)} AED
                    </div>
                  </div>
                </div>

                {/* Balance table */}
                <div className="glass border border-border rounded-2xl overflow-hidden shadow-xl print:border-none print:shadow-none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold print:text-zinc-700">
                        <tr>
                          <th className="px-6 py-3.5">Date</th>
                          <th className="px-6 py-3.5 text-right">Starting Balance</th>
                          <th className="px-6 py-3.5 text-right">Collections (+)</th>
                          <th className="px-6 py-3.5 text-right">Expenses (-)</th>
                          <th className="px-6 py-3.5 text-right">Net Change</th>
                          <th className="px-6 py-3.5 text-right">Ending Balance</th>
                          <th className="px-6 py-3.5 text-right">Opening Due</th>
                          <th className="px-6 py-3.5 text-right">Ending Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 text-muted-foreground print:text-zinc-800">
                        {dailyBalanceList.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                              No data records mapped in the specified range.
                            </td>
                          </tr>
                        ) : (
                          dailyBalanceList.map((item, index) => (
                            <tr
                              key={index}
                              onClick={() => openDateDetails(item.date)}
                              className="hover:bg-muted/20 transition-all cursor-pointer hover:shadow-sm"
                              title="Click to view daily audit details"
                            >
                              <td className="px-6 py-3.5 text-foreground print:text-black font-semibold">{item.date}</td>
                              <td className="px-6 py-3.5 text-right text-foreground font-medium">{item.opening.toFixed(2)} AED</td>
                              <td className="px-6 py-3.5 text-right text-emerald-400 font-semibold">+{item.collections.toFixed(2)} AED</td>
                              <td className="px-6 py-3.5 text-right text-rose-400 font-semibold">-{item.expenses.toFixed(2)} AED</td>
                              <td className={`px-6 py-3.5 text-right font-bold ${item.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {item.net >= 0 ? '+' : ''}{item.net.toFixed(2)} AED
                              </td>
                              <td className="px-6 py-3.5 text-right font-extrabold text-foreground print:text-black">{item.closing.toFixed(2)} AED</td>
                              <td className="px-6 py-3.5 text-right text-amber-500 font-semibold">{item.openingDue.toFixed(2)} AED</td>
                              <td className="px-6 py-3.5 text-right text-amber-500 font-bold">{item.closingDue.toFixed(2)} AED</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </>


        )}

      </div>

      {/* DAILY AUDIT DETAIL MODAL */}
      {selectedReportDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:hidden overflow-y-auto">
          <div className="glass border border-border rounded-2xl shadow-2xl relative w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-background my-8">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20 flex-shrink-0">
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-wider">Audit Daily Ledger</div>
                <h3 className="font-bold text-foreground text-sm">Statements for {selectedReportDate}</h3>
              </div>
              <button
                onClick={() => setSelectedReportDate(null)}
                className="p-2 text-muted-foreground hover:text-foreground bg-muted/40 rounded-full transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              
              {/* Daily Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted/25 p-3.5 rounded-xl border border-border/80 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Invoiced</span>
                  <div className="text-sm font-bold text-foreground mt-1">
                    {dateSales.reduce((sum, s) => sum + s.grand_total, 0).toFixed(2)} AED
                  </div>
                </div>
                <div className="bg-emerald-500/5 p-3.5 rounded-xl border border-emerald-500/20 text-center">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold">Total Collections</span>
                  <div className="text-sm font-bold text-emerald-400 mt-1">
                    +{datePayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)} AED
                  </div>
                </div>
                <div className="bg-rose-500/5 p-3.5 rounded-xl border border-rose-500/20 text-center">
                  <span className="text-[10px] text-rose-450 uppercase font-semibold">Total Expenses</span>
                  <div className="text-sm font-bold text-rose-400 mt-1">
                    -{dateExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)} AED
                  </div>
                </div>
              </div>

              {/* Grid layout for Sales and Payments */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. SALES GENERATED */}
                <div className="space-y-2">
                  <h4 className="font-bold text-foreground text-sm border-b border-border pb-1">Sales Invoices ({dateSales.length})</h4>
                  <div className="border border-border rounded-xl overflow-hidden max-h-[250px] overflow-y-auto bg-muted/10">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold border-b border-border">
                        <tr>
                          <th className="px-3 py-2">Invoice No</th>
                          <th className="px-3 py-2">Customer</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {dateSales.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground italic">No sales generated.</td>
                          </tr>
                        ) : (
                          dateSales.map(s => (
                            <tr key={s.id} className="hover:bg-muted/20">
                              <td className="px-3 py-2 font-semibold text-foreground">{s.invoice_no}</td>
                              <td className="px-3 py-2">{s.customer?.name || 'Walk-in'}</td>
                              <td className="px-3 py-2 text-right font-semibold">{s.grand_total.toFixed(2)} AED</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                  s.payment_status === 'Paid' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
                                  s.payment_status === 'Partially Paid' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                                  'bg-rose-500/15 text-rose-450 border border-rose-500/20'
                                }`}>{s.payment_status}</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. PAYMENTS COLLECTED */}
                <div className="space-y-2">
                  <h4 className="font-bold text-foreground text-sm border-b border-border pb-1">Payment Collections ({datePayments.length})</h4>
                  <div className="border border-border rounded-xl overflow-hidden max-h-[250px] overflow-y-auto bg-muted/10">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold border-b border-border">
                        <tr>
                          <th className="px-3 py-2">Invoice Ref</th>
                          <th className="px-3 py-2">Customer</th>
                          <th className="px-3 py-2">Method</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {datePayments.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground italic">No payments collected.</td>
                          </tr>
                        ) : (
                          datePayments.map((p, idx) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="px-3 py-2 font-semibold text-foreground">#{p.invoice_no}</td>
                              <td className="px-3 py-2">{p.customer?.name || 'Walk-in'}</td>
                              <td className="px-3 py-2 font-medium">{p.payment_method}</td>
                              <td className="px-3 py-2 text-right font-bold text-emerald-400">+{p.amount.toFixed(2)} AED</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* 3. EXPENSES TABLE (FULL WIDTH BELOW) */}
              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-foreground text-sm border-b border-border pb-1">Expenses Logged ({dateExpenses.length})</h4>
                <div className="border border-border rounded-xl overflow-hidden max-h-[200px] overflow-y-auto bg-muted/10">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold border-b border-border">
                      <tr>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Paid To</th>
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {dateExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground italic">No expenses logged.</td>
                        </tr>
                      ) : (
                        dateExpenses.map(e => (
                          <tr key={e.id} className="hover:bg-muted/20">
                            <td className="px-3 py-2 font-semibold text-primary">{e.category?.name}</td>
                            <td className="px-3 py-2">{e.paid_to || 'N/A'}</td>
                            <td className="px-3 py-2">{e.payment_method}</td>
                            <td className="px-3 py-2 italic">{e.description || 'N/A'}</td>
                            <td className="px-3 py-2 text-right font-bold text-rose-450">-{e.amount.toFixed(2)} AED</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex justify-end px-6 py-4 border-t border-border bg-muted/20 flex-shrink-0">
              <button
                onClick={() => setSelectedReportDate(null)}
                className="px-4 py-2 bg-secondary hover:bg-muted text-foreground rounded-lg font-bold transition-colors cursor-pointer"
              >
                Close Audit View
              </button>
            </div>

          </div>
        </div>
      )}
    </PermissionGuard>

  );
};
