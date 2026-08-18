import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Tag, FileText, Save } from 'lucide-react';

export const CategoryForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [form, setForm] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isEdit && id) {
      const loadCategory = async () => {
        setFetching(true);
        try {
          const cat = await db.serviceCategories.getById(id);
          if (cat) {
            setForm({
              name: cat.name || '',
              description: cat.description || ''
            });
          }
        } catch (err: any) {
          setErrorMsg('Failed to load category details.');
        } finally {
          setFetching(false);
        }
      };
      loadCategory();
    }
  }, [id, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrorMsg('Category name is required.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (isEdit && id) {
        await db.serviceCategories.update(id, form);
      } else {
        await db.serviceCategories.create(form);
      }
      navigate('/services');
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
        <span className="text-sm text-muted-foreground">Loading Category Details...</span>
      </div>
    );
  }

  return (
    <PermissionGuard permission="Customer.Update" fallback="ui">
      <div className="w-full space-y-6">
        {/* TOP BAR */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/services')}
            className="p-2 border border-border bg-muted/30 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Services & Items</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">
              {isEdit ? 'Edit Category' : 'Create Category'}
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
          {/* Category Name */}
          <div className="space-y-1.5 text-xs">
            <label htmlFor="name" className="text-muted-foreground font-semibold flex items-center gap-1">
              <Tag size={13} /> Category Name *
            </label>
            <input
              id="name"
              type="text"
              placeholder="E.g. Visa Services or Business Registration"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
              required
              disabled={loading}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5 text-xs">
            <label htmlFor="description" className="text-muted-foreground font-semibold flex items-center gap-1">
              <FileText size={13} /> Description / Scope
            </label>
            <textarea
              id="description"
              placeholder="E.g. Details regarding Ministry rules, corporate processing..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm resize-none"
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => navigate('/services')}
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
              {loading ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      </div>
    </PermissionGuard>
  );
};
