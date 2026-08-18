import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { ServiceCategory } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Briefcase, Tag, DollarSign, FileText, Settings, Save } from 'lucide-react';

export const ServiceForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [form, setForm] = useState({
    name: '',
    category_id: '',
    price: 0,
    description: '',
    status: 'Active' as 'Active' | 'Inactive'
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await db.serviceCategories.getAll();
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (isEdit && id) {
      const loadService = async () => {
        setFetching(true);
        try {
          const srv = await db.services.getById(id);
          if (srv) {
            setForm({
              name: srv.name || '',
              category_id: srv.category_id || '',
              price: srv.price || 0,
              description: srv.description || '',
              status: srv.status as 'Active' | 'Inactive'
            });
          }
        } catch (err: any) {
          setErrorMsg('Failed to load service item details.');
        } finally {
          setFetching(false);
        }
      };
      loadService();
    }
  }, [id, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrorMsg('Service name is required.');
      return;
    }
    if (!form.category_id) {
      setErrorMsg('Please select a service category.');
      return;
    }
    if (form.price < 0) {
      setErrorMsg('Price cannot be negative.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (isEdit && id) {
        await db.services.update(id, form);
      } else {
        await db.services.create(form);
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
        <span className="text-sm text-muted-foreground">Loading Service Item Details...</span>
      </div>
    );
  }

  return (
    <PermissionGuard permission={isEdit ? "Customer.Update" : "Customer.Update"} fallback="ui">
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
              {isEdit ? 'Edit Service' : 'Create Service'}
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
          {/* Service Name */}
          <div className="space-y-1.5 text-xs">
            <label htmlFor="name" className="text-muted-foreground font-semibold flex items-center gap-1">
              <Briefcase size={13} /> Service Name *
            </label>
            <input
              id="name"
              type="text"
              placeholder="E.g. Visa Composing or Laser Print Black & White"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
              required
              disabled={loading}
            />
          </div>

          {/* Grid Layout: Category and Price */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Select */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="category" className="text-muted-foreground font-semibold flex items-center gap-1">
                <Tag size={13} /> Division Category *
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

            {/* Price */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="price" className="text-muted-foreground font-semibold flex items-center gap-1">
                <DollarSign size={13} /> Standard Rate (AED) *
              </label>
              <input
                id="price"
                type="number"
                min={0}
                step={0.01}
                placeholder="E.g. 150.00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5 text-xs">
            <label htmlFor="description" className="text-muted-foreground font-semibold flex items-center gap-1">
              <FileText size={13} /> Service Description
            </label>
            <input
              id="description"
              type="text"
              placeholder="E.g. Single-side typing with formatting, includes paper."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
              disabled={loading}
            />
          </div>

          {/* Status Selection */}
          <div className="space-y-1.5 text-xs">
            <label htmlFor="status" className="text-muted-foreground font-semibold flex items-center gap-1">
              <Settings size={13} /> Active Status
            </label>
            <select
              id="status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as any })}
              className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-sm"
              disabled={loading}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive (Delist from Catalog)</option>
            </select>
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
              {loading ? 'Saving...' : 'Save Service'}
            </button>
          </div>
        </form>
      </div>
    </PermissionGuard>
  );
};
