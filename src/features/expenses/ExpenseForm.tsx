import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { ExpenseCategory } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Tag, DollarSign, Calendar, FileText, User, CreditCard, Save } from 'lucide-react';

export const ExpenseForm: React.FC = () => {
  const { user, isAdmin, availableBranches } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [form, setForm] = useState({
    category_id: '',
    branch_id: '',
    amount: 0,
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    paid_to: '',
    payment_method: 'Cash' as 'Cash' | 'Card' | 'Mobile Banking' | 'Bank Transfer'
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const cats = await db.expenseCategories.getAll();
        setCategories(cats);
        if (user && !form.branch_id) {
          setForm(prev => ({ ...prev, branch_id: user.branch_id }));
        }
      } catch (err) {
        console.error('Failed to load master data', err);
      }
    };
    loadMasterData();
  }, [user]);

  useEffect(() => {
    if (isEdit && id) {
      const loadExpense = async () => {
        setFetching(true);
        try {
          const exp = await db.expenses.getById(id);
          if (exp) {
            setForm({
              category_id: exp.category_id || '',
              branch_id: exp.branch_id || '',
              amount: exp.amount || 0,
              expense_date: exp.expense_date ? new Date(exp.expense_date).toISOString().split('T')[0] : '',
              description: exp.description || '',
              paid_to: exp.paid_to || '',
              payment_method: exp.payment_method as any
            });
          }
        } catch (err: any) {
          setErrorMsg('Failed to load expense item details.');
        } finally {
          setFetching(false);
        }
      };
      loadExpense();
    }
  }, [id, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category_id) {
      setErrorMsg('Please select an expense category.');
      return;
    }
    if (!form.branch_id) {
      setErrorMsg('Please select a branch.');
      return;
    }
    if (form.amount <= 0) {
      setErrorMsg('Please enter a positive amount.');
      return;
    }
    if (!form.expense_date) {
      setErrorMsg('Please select an expense date.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (isEdit && id) {
        await db.expenses.update(id, form);
      } else {
        await db.expenses.create(form);
      }
      navigate('/expenses');
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <span className="text-sm text-muted-foreground">Loading Expense Details...</span>
      </div>
    );
  }

  return (
    <PermissionGuard permission={isEdit ? "Expenses.Create" : "Expenses.Create"} fallback="ui">
      <div className="w-full space-y-6">
        {/* TOP BAR */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/expenses')}
            className="p-2 border border-border bg-muted/30 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Expenses</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">
              {isEdit ? 'Edit Expense' : 'Create Expense'}
            </h1>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl text-center font-medium">
            {errorMsg}
          </div>
        )}

        {/* FORM CONTAINER */}
        <form onSubmit={handleSubmit} className="glass border border-border rounded-2xl p-6 space-y-5 shadow-xl">
          {/* Grid Layout: Category and Branch */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Select */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="category" className="text-muted-foreground font-semibold flex items-center gap-1">
                <Tag size={13} /> Expense Category *
              </label>
              <select
                id="category"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-sm"
                required
                disabled={loading}
              >
                <option value="">-- Choose Category --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Branch Select */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="branch" className="text-muted-foreground font-semibold flex items-center gap-1">
                <DollarSign size={13} /> Target Branch *
              </label>
              <select
                id="branch"
                value={form.branch_id}
                onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                disabled={!isAdmin || loading}
                className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-sm disabled:opacity-75 disabled:cursor-not-allowed"
                required
              >
                <option value="">-- Select Branch --</option>
                {availableBranches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid Layout: Amount and Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="amount" className="text-muted-foreground font-semibold flex items-center gap-1">
                <DollarSign size={13} /> Spent Amount (AED) *
              </label>
              <input
                id="amount"
                type="number"
                min={0.01}
                step={0.01}
                placeholder="E.g. 500.00"
                value={form.amount || ''}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
                required
                disabled={loading}
              />
            </div>

            {/* Expense Date */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="date" className="text-muted-foreground font-semibold flex items-center gap-1">
                <Calendar size={13} /> Expense Date *
              </label>
              <input
                id="date"
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Grid Layout: Paid To and Payment Method */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Paid To */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="paid_to" className="text-muted-foreground font-semibold flex items-center gap-1">
                <User size={13} /> Paid To / Vendor Name
              </label>
              <input
                id="paid_to"
                type="text"
                placeholder="E.g. Paper Supply Ltd or Landlord"
                value={form.paid_to}
                onChange={(e) => setForm({ ...form, paid_to: e.target.value })}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
                disabled={loading}
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="method" className="text-muted-foreground font-semibold flex items-center gap-1">
                <CreditCard size={13} /> Payment Method
              </label>
              <select
                id="method"
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value as any })}
                className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-sm"
                disabled={loading}
              >
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Mobile Banking">Mobile Banking</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5 text-xs">
            <label htmlFor="description" className="text-muted-foreground font-semibold flex items-center gap-1">
              <FileText size={13} /> Description / Special Notes
            </label>
            <input
              id="description"
              type="text"
              placeholder="E.g. Purchased 5 rims of A4 paper for printer 2."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => navigate('/expenses')}
              className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:bg-secondary/40 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow-md transition-colors"
            >
              <Save size={14} />
              {loading ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </PermissionGuard>
  );
};
