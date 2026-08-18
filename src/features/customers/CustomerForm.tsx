import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, User, Phone, Mail, MapPin, FileText, Save } from 'lucide-react';

export const CustomerForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isEdit && id) {
      const loadCustomer = async () => {
        setFetching(true);
        try {
          const cust = await db.customers.getById(id);
          if (cust) {
            setForm({
              name: cust.name || '',
              phone: cust.phone || '',
              email: cust.email || '',
              address: cust.address || '',
              notes: cust.notes || ''
            });
          }
        } catch (err: any) {
          setErrorMsg('Failed to load customer profile.');
        } finally {
          setFetching(false);
        }
      };
      loadCustomer();
    }
  }, [id, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrorMsg('Customer name is required.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (isEdit && id) {
        await db.customers.update(id, form);
      } else {
        await db.customers.create(form);
      }
      navigate('/customers');
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
        <span className="text-sm text-muted-foreground">Loading Customer Profile...</span>
      </div>
    );
  }

  return (
    <PermissionGuard permission={isEdit ? "Customer.Update" : "Customer.Create"} fallback="ui">
      <div className="w-full space-y-6">
        {/* TOP BAR */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/customers')}
            className="p-2 border border-border bg-muted/30 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">eCustomers</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">
              {isEdit ? 'Edit' : 'Create'}
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
          {/* Customer Name */}
          <div className="space-y-1.5 text-xs">
            <label htmlFor="name" className="text-muted-foreground font-semibold flex items-center gap-1">
              <User size={13} /> Full Client Name *
            </label>
            <input
              id="name"
              type="text"
              placeholder="E.g. Mohammed Rahman"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
              required
              disabled={loading}
            />
          </div>

          {/* Contact Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phone */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="phone" className="text-muted-foreground font-semibold flex items-center gap-1">
                <Phone size={13} /> Contact Number
              </label>
              <input
                id="phone"
                type="text"
                placeholder="E.g. +8801700000000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5 text-xs">
              <label htmlFor="email" className="text-muted-foreground font-semibold flex items-center gap-1">
                <Mail size={13} /> Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="E.g. customer@domain.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
                disabled={loading}
              />
            </div>
          </div>

          {/* Physical Address */}
          <div className="space-y-1.5 text-xs">
            <label htmlFor="address" className="text-muted-foreground font-semibold flex items-center gap-1">
              <MapPin size={13} /> Address Details
            </label>
            <input
              id="address"
              type="text"
              placeholder="E.g. Suite 402, Motijheel C/A, Dhaka"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
              disabled={loading}
            />
          </div>

          {/* Notes / Special Remarks */}
          <div className="space-y-1.5 text-xs">
            <label htmlFor="notes" className="text-muted-foreground font-semibold flex items-center gap-1">
              <FileText size={13} /> Custom Remarks / Internal Notes
            </label>
            <textarea
              id="notes"
              placeholder="E.g. Corporate client, handles visit visa packages..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm resize-none animate-none"
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => navigate('/customers')}
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
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </PermissionGuard>
  );
};
