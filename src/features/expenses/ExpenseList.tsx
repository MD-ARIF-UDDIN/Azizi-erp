import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { Expense, ExpenseCategory, Branch } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import {
  TrendingDown,
  Plus,
  Edit2,
  Trash2,
  Search,
  Calendar,
  Layers,
  Tag,
  DollarSign,
  Briefcase
} from 'lucide-react';

export const ExpenseList: React.FC = () => {
  const { hasPermission, activeBranchId } = useAuth();
  const navigate = useNavigate();
  
  // Data States
  const [expenses, setExpenses] = useState<(Expense & { category?: ExpenseCategory; branch?: Branch })[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'expenses' | 'categories'>('expenses');

  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchFilter = activeBranchId === 'all' ? undefined : activeBranchId;
      const eData = await db.expenses.getAll(branchFilter);
      const cData = await db.expenseCategories.getAll();
      
      setExpenses(eData);
      setCategories(cData);
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
    const matchesSearch =
      (e.paid_to && e.paid_to.toLowerCase().includes(search.toLowerCase())) ||
      (e.description && e.description.toLowerCase().includes(search.toLowerCase())) ||
      e.category?.name.toLowerCase().includes(search.toLowerCase());

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

        {/* LOADING SKELETON */}
        {loading ? (
          <div className="space-y-3">
            <div className="h-10 bg-muted/30 rounded-xl animate-pulse" />
            <div className="h-32 bg-muted/30 rounded-xl animate-pulse" />
          </div>
        ) : (
          <>
            {/* EXPENSES TAB PANEL */}
            {activeTab === 'expenses' && (
              <div className="space-y-5">
                
                {/* Aggregates Dashboard Banner */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="glass border border-border p-5 rounded-2xl flex items-center gap-4 shadow-md">
                    <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">Today's Expenses</span>
                      <h3 className="text-md font-bold text-foreground mt-0.5">{todayExpenses.toFixed(2)} AED</h3>
                    </div>
                  </div>
                  <div className="glass border border-border p-5 rounded-2xl flex items-center gap-4 shadow-md">
                    <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">This Month's Expenses</span>
                      <h3 className="text-md font-bold text-foreground mt-0.5">{monthlyExpenses.toFixed(2)} AED</h3>
                    </div>
                  </div>
                  <div className="glass border border-border p-5 rounded-2xl flex items-center gap-4 shadow-md">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Briefcase size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">Total Cumulative Selected</span>
                      <h3 className="text-md font-bold text-foreground mt-0.5">{totalAmount.toFixed(2)} AED</h3>
                    </div>
                  </div>
                </div>

                {/* Filter and Add Toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input
                      type="text"
                      placeholder="Search paid to, description..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                    />
                  </div>

                  {hasPermission('Expenses.Create') && (
                    <button
                      onClick={() => navigate('/expenses/create')}
                      className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all self-stretch sm:self-auto justify-center"
                    >
                      <Plus size={14} />
                      Log Expense
                    </button>
                  )}
                </div>

                {/* Expenses Log Table */}
                <div className="glass border border-border rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-secondary/40 border-b border-border text-muted-foreground text-xs uppercase font-semibold">
                        <tr>
                          <th className="px-4 py-4 text-center w-12">SL</th>
                          <th className="px-6 py-4">Expense Date</th>
                          <th className="px-6 py-4">Category</th>
                          <th className="px-6 py-4">Branch</th>
                          <th className="px-6 py-4">Paid To</th>
                          <th className="px-6 py-4">Method</th>
                          <th className="px-6 py-4 text-right">Amount</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {filteredExpenses.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                              No expense records matching filters were found.
                            </td>
                          </tr>
                        ) : (
                          filteredExpenses.map((e, idx) => (
                            <tr key={e.id} className="hover:bg-muted/25 transition-colors">
                              <td className="px-4 py-4 text-center text-muted-foreground font-semibold">
                                {idx + 1}
                              </td>
                              <td className="px-6 py-4 text-foreground">
                                <div className="font-semibold">{e.expense_date}</div>
                                {e.description && <div className="text-[10px] text-muted-foreground mt-0.5">{e.description}</div>}
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold">
                                  <Tag size={12} />
                                  {e.category?.name || 'General'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-muted-foreground text-xs font-semibold">
                                {e.branch?.name}
                              </td>
                              <td className="px-6 py-4 text-foreground font-medium">
                                {e.paid_to || 'N/A'}
                              </td>
                              <td className="px-6 py-4 text-muted-foreground text-xs">
                                {e.payment_method}
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-rose-400">
                                -{e.amount.toFixed(2)} AED
                              </td>
                              <td className="px-6 py-4 text-right space-x-1">
                                {hasPermission('Expenses.Update') && (
                                  <button
                                    onClick={() => navigate(`/expenses/edit/${e.id}`)}
                                    className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                )}
                                {hasPermission('Expenses.Delete') && (
                                  <button
                                    onClick={() => handleDeleteExpense(e.id)}
                                    className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
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

            {/* EXPENSE CATEGORIES PANEL */}
            {activeTab === 'categories' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground font-medium">
                    Categorize expenditures (such as Shop Rent, Utilities, Paper, Toner) for financial statements.
                  </span>
                  {hasPermission('Expenses.Create') && (
                    <button
                      onClick={() => navigate('/expenses/category/create')}
                      className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all"
                    >
                      <Plus size={14} />
                      Add Category
                    </button>
                  )}
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
    </PermissionGuard>
  );
};
