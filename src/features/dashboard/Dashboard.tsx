import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { useAuth } from '../../components/AuthProvider';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Clock,
  ArrowUpRight,
  Bell
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export const Dashboard: React.FC = () => {
  const { activeBranchId, availableBranches, isAdmin } = useAuth();
  
  // Data States
  const [sales, setSales] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expiryDocs, setExpiryDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const branchFilter = activeBranchId === 'all' ? undefined : activeBranchId;
        const sData = await db.sales.getAll(branchFilter);
        const eData = await db.expenses.getAll(branchFilter);
        
        // Resolve payments based on filtered branch
        const allUsers = await db.users.getAll();
        const pList: any[] = [];
        for (const sale of sData) {
          const sPayments = await db.payments.getBySaleId(sale.id);
          sPayments.forEach(p => {
            pList.push({
              ...p,
              sale_invoice: sale.invoice_no,
              sale_customer_name: sale.customer?.name || 'Walk-in Customer',
              received_by_name: allUsers.find(u => u.id === p.received_by)?.name || 'Cashier'
            });
          });
        }
        
        // Sort payments desc
        pList.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

        // Fetch tracked documents
        const docs = await db.clientDocuments.getAll();
        docs.sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

        setSales(sData);
        setExpenses(eData);
        setPayments(pList);
        setExpiryDocs(docs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, [activeBranchId]);

  // Date Check Helpers
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);

  // METRICS
  const todaySalesAmount = sales
    .filter(s => s.created_at.startsWith(todayStr))
    .reduce((sum, s) => sum + s.grand_total, 0);

  const monthlySalesAmount = sales
    .filter(s => s.created_at.startsWith(currentMonthPrefix))
    .reduce((sum, s) => sum + s.grand_total, 0);

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const pendingOrders = sales.filter(s => s.order_status?.name !== 'Completed' && s.order_status?.name !== 'Cancelled').length;
  const completedOrders = sales.filter(s => s.order_status?.name === 'Completed').length;

  const recentSales = sales.slice(0, 5);
  const recentPayments = payments.slice(0, 5);

  // CHART DATA
  const getTrendData = () => {
    const trendMap: Record<string, { date: string; sales: number; expenses: number }> = {};
    const now = new Date();
    
    for (let i = 9; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      trendMap[dateStr] = { date: displayStr, sales: 0, expenses: 0 };
    }

    sales.forEach(s => {
      const dateStr = s.created_at.split('T')[0];
      if (trendMap[dateStr]) trendMap[dateStr].sales += s.grand_total;
    });

    expenses.forEach(e => {
      const dateStr = e.expense_date;
      if (trendMap[dateStr]) trendMap[dateStr].expenses += e.amount;
    });

    return Object.values(trendMap);
  };

  const getCategoryData = () => {
    const catMap: Record<string, number> = {};
    sales.forEach(s => {
      s.items?.forEach((item: any) => {
        const catName = item.service?.category?.name || 'Uncategorized';
        catMap[catName] = (catMap[catName] || 0) + item.subtotal;
      });
    });

    const colors = ['#10b981', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
    return Object.entries(catMap).map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length]
    }));
  };

  const getBranchPerformanceData = () => {
    return availableBranches.map(b => {
      const branchSales = sales.filter(s => s.branch_id === b.id);
      const branchExpenses = expenses.filter(e => e.branch_id === b.id);
      
      return {
        name: b.name.split(' ')[0],
        Sales: branchSales.reduce((sum, s) => sum + s.grand_total, 0),
        Expenses: branchExpenses.reduce((sum, e) => sum + e.amount, 0)
      };
    });
  };

  const trendData = getTrendData();
  const categoryData = getCategoryData();
  const branchData = getBranchPerformanceData();

  // Chart theme (light mode)
  const chartAxisColor = '#94a3b8';
  const chartGridColor = '#e2e8f0';

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your business operations across all branches.
        </p>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-card rounded-xl border border-border animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Today's Sales */}
            <div className="bg-card border border-border p-5 rounded-xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Today's Sales</span>
                <h3 className="text-xl font-bold text-foreground">{todaySalesAmount.toFixed(2)} AED</h3>
                <p className="text-[11px] text-emerald-600 font-medium">Recorded today</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShoppingCart size={20} />
              </div>
            </div>

            {/* Monthly Revenue */}
            <div className="bg-card border border-border p-5 rounded-xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Monthly Sales</span>
                <h3 className="text-xl font-bold text-foreground">{monthlySalesAmount.toFixed(2)} AED</h3>
                <p className="text-[11px] text-muted-foreground">Current month</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <DollarSign size={20} />
              </div>
            </div>

            {/* Net Profit */}
            <div className="bg-card border border-border p-5 rounded-xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Net Cash Profit</span>
                <h3 className={`text-xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {netProfit.toFixed(2)} AED
                </h3>
                <div className="text-[11px] flex items-center gap-2 mt-0.5">
                  <span className="text-emerald-600">+{totalRevenue.toFixed(0)} In</span>
                  <span className="text-rose-500">-{totalExpenses.toFixed(0)} Out</span>
                </div>
              </div>
              <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                {netProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              </div>
            </div>

            {/* Job Queue */}
            <div className="bg-card border border-border p-5 rounded-xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Job Queue</span>
                <h3 className="text-xl font-bold text-foreground">{pendingOrders} Pending</h3>
                <p className="text-[11px] text-emerald-600 font-medium">{completedOrders} completed</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Clock size={20} />
              </div>
            </div>

          </div>

          {/* Document Expiry Alerts */}
          {expiryDocs.some(d => {
            const expiry = new Date(d.expiry_date);
            const today = new Date();
            expiry.setHours(0,0,0,0);
            today.setHours(0,0,0,0);
            const diff = expiry.getTime() - today.getTime();
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            return days <= 60;
          }) && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs font-semibold gap-3">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-amber-500 shrink-0" />
                <span>
                  You have client documents expiring within the next 2 months. Check the Expiry Tracker to notify them.
                </span>
              </div>
              <Link to="/expiry-tracker" className="text-[11px] bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0">
                Open Tracker
              </Link>
            </div>
          )}

          {/* CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            
            {/* Area Chart */}
            <div className="lg:col-span-2 bg-card border border-border p-5 rounded-xl space-y-4">
              <div>
                <h3 className="font-semibold text-foreground text-sm m-0">Revenue & Expense Trend</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Last 10 days overview.</p>
              </div>
              
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                    <XAxis dataKey="date" stroke={chartAxisColor} fontSize={11} tickLine={false} />
                    <YAxis stroke={chartAxisColor} fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'white', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="sales" name="Sales" stroke="#10b981" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" fillOpacity={1} fill="url(#colorExpenses)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Donut */}
            <div className="lg:col-span-1 bg-card border border-border p-5 rounded-xl space-y-4">
              <div>
                <h3 className="font-semibold text-foreground text-sm m-0">Revenue by Service</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Category breakdown.</p>
              </div>

              <div className="h-52 w-full flex items-center justify-center">
                {categoryData.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No sales data yet.</span>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => `${parseFloat(val || 0).toFixed(2)} AED`}
                        contentStyle={{ backgroundColor: 'white', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Legend */}
              <div className="space-y-1.5 text-xs">
                {categoryData.slice(0, 5).map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground truncate">
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                      {entry.name}
                    </span>
                    <span className="font-semibold text-foreground">{entry.value.toFixed(0)} AED</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RECENT TABLES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* Recent Invoices */}
            <div className="bg-card border border-border p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-semibold text-foreground text-sm m-0">Recent Invoices</h3>
                <Link to="/sales" className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5">
                  View All <ArrowUpRight size={13} />
                </Link>
              </div>

              <div className="space-y-2">
                {recentSales.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center italic">No invoices recorded yet.</p>
                ) : (
                  recentSales.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-all text-xs">
                      <div>
                        <div className="font-semibold text-foreground">{s.invoice_no}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {s.customer?.name || 'Walk-in'} • {s.branch?.name}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="font-bold text-foreground">{s.grand_total.toFixed(2)} AED</div>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border border-primary/20 bg-primary/5 text-primary">
                          {s.order_status?.name}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Payments */}
            <div className="bg-card border border-border p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-semibold text-foreground text-sm m-0">Recent Payments</h3>
                <Link to="/payments" className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5">
                  View Log <ArrowUpRight size={13} />
                </Link>
              </div>

              <div className="space-y-2">
                {recentPayments.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center italic">No payments logged yet.</p>
                ) : (
                  recentPayments.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-all text-xs">
                      <div>
                        <div className="font-semibold text-foreground">{p.sale_invoice}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {p.sale_customer_name} • {p.payment_method}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-600">+{p.amount.toFixed(2)} AED</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Ref: {p.transaction_no || 'Cash'}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Branch Performance */}
          {isAdmin && (
            <div className="bg-card border border-border p-5 rounded-xl space-y-4">
              <div>
                <h3 className="font-semibold text-foreground text-sm m-0">Branch Performance</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Sales vs expenses comparison.</p>
              </div>
              
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                    <XAxis dataKey="name" stroke={chartAxisColor} fontSize={11} tickLine={false} />
                    <YAxis stroke={chartAxisColor} fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'white', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    />
                    <Legend />
                    <Bar dataKey="Sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
};
