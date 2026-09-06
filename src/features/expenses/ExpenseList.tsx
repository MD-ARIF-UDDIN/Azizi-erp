import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { Expense, ExpenseCategory, Branch, Account } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { exportExpenses, exportExpenseCategories } from '../../lib/excelExport';
import {
  TrendingDown,
  Plus,
  Edit2,
  Trash2,
  Search,
  Calendar,
  Layers,
  Tag,
  Briefcase,
  Download,
  Printer,
  CreditCard,
  Wallet,
  FileText
} from 'lucide-react';

export const ExpenseList: React.FC = () => {
  const { hasPermission, activeBranchId } = useAuth();
  const navigate = useNavigate();
  
  // Data States
  const [expenses, setExpenses] = useState<(Expense & { category?: ExpenseCategory; branch?: Branch })[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'expenses' | 'categories'>('expenses');

  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchFilter = activeBranchId === 'all' ? undefined : activeBranchId;
      const [eData, cData, aData] = await Promise.all([
        db.expenses.getAll(branchFilter),
        db.expenseCategories.getAll(),
        db.accounts.getAll()
      ]);
      
      setExpenses(eData);
      setCategories(cData);
      setAccounts(aData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeBranchId]);

  const handleDeleteExpense = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense entry?')) {
      await db.expenses.delete(id);
      await fetchData();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const associated = expenses.filter(e => e.category_id === id);
    if (associated.length > 0) {
      alert(`Cannot delete category. There are ${associated.length} expense records linked to it.`);
      return;
    }

    if (window.confirm('Are you sure you want to delete this expense category?')) {
      await db.expenseCategories.delete(id);
      await fetchData();
    }
  };

  // Filter
  const filteredExpenses = expenses.filter(e => {
    const invNo = (e as any).sale?.invoice_no || e.description?.match(/#(INV-[A-Za-z0-9-]+)/)?.[0] || '';
    const personName = (e as any).sale?.person_name || '';
    const q = search.toLowerCase();
    const matchesSearch =
      (e.paid_to && e.paid_to.toLowerCase().includes(q)) ||
      (e.description && e.description.toLowerCase().includes(q)) ||
      (e.category?.name && e.category.name.toLowerCase().includes(q)) ||
      invNo.toLowerCase().includes(q) ||
      personName.toLowerCase().includes(q);

    return matchesSearch;
  });

  // Aggregates based on filtered list
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayExpenses = filteredExpenses
    .filter(e => e.expense_date === todayStr)
    .reduce((sum, e) => sum + e.amount, 0);

  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthlyExpenses = filteredExpenses
    .filter(e => e.expense_date.startsWith(currentMonthPrefix))
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <PermissionGuard permission="Expenses.View" fallback="ui">
      <div className="space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Expenses</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">List</h1>
          </div>

          <div className="bg-secondary/40 border border-border p-1 rounded-xl flex gap-1 self-start">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'expenses'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TrendingDown size={14} />
              Expenses Log
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'categories'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers size={14} />
              Expense Categories
            </button>
          </div>
        </div>

        {/* METRIC CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 flex items-center gap-4">
            <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20">
              <TrendingDown size={22} />
            </div>
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Expenses</div>
              <div className="text-xl font-black text-rose-600 font-heading">
                {totalAmount.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">AED</span>
              </div>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
              <Calendar size={22} />
            </div>
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Today's Expenses</div>
              <div className="text-xl font-black text-amber-600 font-heading">
                {todayExpenses.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">AED</span>
              </div>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl border border-indigo-500/20">
              <Briefcase size={22} />
            </div>
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">This Month</div>
              <div className="text-xl font-black text-indigo-600 font-heading">
                {monthlyExpenses.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">AED</span>
              </div>
            </div>
          </div>
        </div>

        {/* TAB PANELS */}
        <div className="card p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading expenses...</div>
          ) : (
            <>
              {/* EXPENSES LOG PANEL */}
              {activeTab === 'expenses' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="relative w-full sm:w-80">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        placeholder="Search description, invoice #, paid to..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-xs bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => exportExpenses(filteredExpenses)}
                        className="flex items-center gap-1.5 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3.5 py-2 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer w-full sm:w-auto justify-center"
                        title="Export filtered expenses to Excel (.xlsx)"
                      >
                        <Download size={14} />
                        <span>Excel</span>
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 border border-border text-foreground bg-muted/60 hover:bg-muted px-3.5 py-2 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer w-full sm:w-auto justify-center"
                        title="Print or Save Expenses as PDF"
                      >
                        <Printer size={14} className="text-primary" />
                        <span>PDF</span>
                      </button>
                      {hasPermission('Expenses.Create') && (
                        <button
                          onClick={() => navigate('/expenses/create')}
                          className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all w-full sm:w-auto justify-center cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>Log Expense</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expenses Log Table */}
                  <div className="table-container">
                    <div className="overflow-x-auto">
                      <table>
                        <thead>
                          <tr>
                            <th className="text-center" style={{ width: '45px' }}>SL</th>
                            <th>Expense Date &amp; Description</th>
                            <th>Linked Invoice</th>
                            <th>Category</th>
                            <th>Branch</th>
                            <th>Paid To</th>
                            <th>Account &amp; Method</th>
                            <th className="text-right">Amount</th>
                            <th className="text-center" style={{ width: '120px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredExpenses.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-12 text-center text-slate-500">
                                <div className="max-w-xs mx-auto space-y-1">
                                  <div className="font-bold text-black text-sm font-heading">No expense records found</div>
                                  <div className="text-xs text-slate-500">No expense records matching the filters were found.</div>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredExpenses.map((e, idx) => {
                              const rawInv = (e as any).sale?.invoice_no || e.description?.match(/#(INV-[A-Za-z0-9-]+)/)?.[0]?.replace('#', '');
                              const cleanInv = rawInv ? (rawInv.startsWith('#') ? rawInv : `#${rawInv}`) : null;
                              const person = (e as any).sale?.person_name;
                              const acc = accounts.find(a => a.id === e.account_id);

                              return (
                                <tr key={e.id}>
                                  <td className="text-center font-semibold text-xs text-slate-500">
                                    {idx + 1}
                                  </td>
                                  <td>
                                    <div className="font-bold text-black text-xs leading-tight">{e.expense_date}</div>
                                    {e.description && (
                                      <div className="text-[11px] text-slate-600 mt-0.5 max-w-xs truncate" title={e.description}>
                                        {e.description}
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    {cleanInv ? (
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => navigate('/sales')}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 cursor-pointer"
                                          title="View in Sales Invoices"
                                        >
                                          <FileText size={11} />
                                          {cleanInv}
                                        </button>
                                        {person && (
                                          <div className="text-[10px] text-slate-500 flex items-center gap-0.5 mt-0.5">
                                            <span>👤 {person}</span>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-xs italic">— General —</span>
                                    )}
                                  </td>
                                  <td>
                                    <span className="inline-flex items-center gap-1 text-xs text-slate-700 font-medium">
                                      <Tag size={12} className="text-primary" />
                                      {e.category?.name || 'General'}
                                    </span>
                                  </td>
                                  <td className="text-slate-600 text-xs font-semibold">
                                    {e.branch?.name || '—'}
                                  </td>
                                  <td className="text-black font-semibold text-xs">
                                    {e.paid_to || '—'}
                                  </td>
                                  <td className="text-slate-600 text-xs">
                                    <div>{e.payment_method}</div>
                                    {acc && (
                                      <div className="text-[10px] font-bold text-primary flex items-center gap-1 mt-0.5">
                                        {acc.type === 'card' ? <CreditCard size={10} /> : <Wallet size={10} />}
                                        <span>{acc.name}</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="text-right font-black text-rose-700 text-xs font-heading">
                                    -{e.amount.toFixed(2)} AED
                                  </td>
                                  <td>
                                    <div className="flex items-center justify-center gap-1.5">
                                      {hasPermission('Expenses.Update') && (
                                        <button
                                          onClick={() => navigate(`/expenses/edit/${e.id}`)}
                                          className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-black flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                          title="Edit Expense"
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                      )}
                                      {hasPermission('Expenses.Delete') && (
                                        <button
                                          onClick={() => handleDeleteExpense(e.id)}
                                          className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                          title="Delete Expense"
                                        >
                                          <Trash2 size={13} />
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

                </div>
              )}

              {/* EXPENSE CATEGORIES PANEL */}
              {activeTab === 'categories' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-xs text-muted-foreground font-medium">
                      Categorize expenditures (such as Shop Rent, Utilities, Paper, Toner, Gov Fees) for financial statements.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => exportExpenseCategories(categories)}
                        className="flex items-center gap-1.5 border border-border text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap"
                      >
                        <Download size={14} />
                        Export Excel
                      </button>
                      {hasPermission('Expenses.Create') && (
                        <button
                          onClick={() => navigate('/expenses/category/create')}
                          className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all whitespace-nowrap"
                        >
                          <Plus size={14} />
                          Add Category
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map(c => {
                      const count = expenses.filter(e => e.category_id === c.id).length;
                      const totalCost = expenses
                        .filter(e => e.category_id === c.id)
                        .reduce((sum, e) => sum + e.amount, 0);

                      return (
                        <div key={c.id} className="glass border border-border p-5 rounded-2xl flex flex-col justify-between space-y-4 shadow-md">
                          <div>
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-foreground text-md m-0">{c.name}</h3>
                              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                                {count} Record{count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">{c.description || 'No description listed.'}</p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-border/40">
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Total spent: {totalCost.toFixed(0)} AED</span>
                            <div className="flex gap-1.5">
                              {hasPermission('Expenses.Create') && (
                                <button
                                  onClick={() => navigate(`/expenses/category/edit/${c.id}`)}
                                  className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <Edit2 size={12} />
                                </button>
                              )}
                              {hasPermission('Expenses.Create') && (
                                <button
                                  onClick={() => handleDeleteCategory(c.id)}
                                  className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
};
