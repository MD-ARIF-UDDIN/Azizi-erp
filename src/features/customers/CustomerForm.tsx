import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { Customer } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, User, Building2, Phone, Mail, MapPin, FileText, Save, Link2, Plus, Trash2 } from 'lucide-react';

export const CustomerForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    customer_type: 'individual' as 'individual' | 'company',
    company_id: '' as string | undefined
  });
  const [companies, setCompanies] = useState<Customer[]>([]);
  const [members, setMembers] = useState<{ id?: string; name: string; phone?: string; email?: string }[]>([]);
  const [deletedMemberIds, setDeletedMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const all = await db.customers.getAll();
        setCompanies(all.filter((c: any) => c.customer_type === 'company'));
      } catch (err) {
        console.error(err);
      }
    };
    loadCompanies();
  }, []);

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
              notes: cust.notes || '',
              customer_type: cust.customer_type || 'individual',
              company_id: cust.company_id || ''
            });
            if (cust.customer_type === 'company' && cust.members) {
              setMembers(cust.members.map((e: any) => ({
                id: e.id,
                name: e.name,
                phone: e.phone || '',
                email: e.email || ''
              })));
            }
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
    if (!form.name.trim()) { setErrorMsg('Customer name is required.'); return; }
    setLoading(true);
    setErrorMsg('');
    try {
      const payload: any = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
        customer_type: form.customer_type,
        company_id: form.customer_type === 'individual' && form.company_id ? form.company_id : undefined,
      };

      if (form.customer_type === 'company') {
        payload.members = members.filter(m => m.name.trim()).map(m => ({
          id: m.id || crypto.randomUUID(),
          name: m.name.trim(),
          phone: m.phone?.trim() || undefined,
          email: m.email?.trim() || undefined
        }));
      }

      if (isEdit && id) {
        await db.customers.update(id, payload);
      } else {
        await db.customers.create(payload);
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
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/customers')} className="p-2 border border-border bg-muted/30 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Customers</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">{isEdit ? 'Edit' : 'Register'}</h1>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl text-center font-medium">{errorMsg}</div>
        )}

        <form onSubmit={handleSubmit} className="glass border border-border rounded-2xl p-6 space-y-6 shadow-xl">

          {/* Customer Type Toggle */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Customer Type *</label>
            <div className="flex rounded-xl bg-muted/40 p-1 border border-border gap-1">
              <button type="button" onClick={() => setForm({ ...form, customer_type: 'individual' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${form.customer_type === 'individual' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                disabled={loading}>
                <User size={15} /> Individual Person
              </button>
              <button type="button" onClick={() => setForm({ ...form, customer_type: 'company', company_id: '' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${form.customer_type === 'company' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                disabled={loading}>
                <Building2 size={15} /> Company / Organization
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {form.customer_type === 'company'
                ? 'Company accounts consolidate billing across all their registered members.'
                : 'Individual persons can optionally be linked to a company as a member.'}
            </p>
          </div>

          {/* Company-specific fields */}
          {form.customer_type === 'company' && (
            <>
              {/* Compact Company Members Table */}
              <div className="space-y-2.5 p-3.5 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-foreground font-bold uppercase tracking-wider flex items-center gap-1">
                    <User size={13} className="text-primary" /> Company Members / Employees ({members.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setMembers([...members, { name: '', phone: '', email: '' }])}
                    className="flex items-center gap-1 bg-primary hover:bg-primary-hover text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                    disabled={loading}
                  >
                    <Plus size={12} /> Add Member
                  </button>
                </div>
                {members.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic text-center py-2">No company members added yet. Add employees using the button above.</p>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden bg-background">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-muted text-muted-foreground uppercase font-semibold text-[10px] border-b border-border">
                        <tr>
                          <th className="px-3 py-2 w-[40%]">Member Name *</th>
                          <th className="px-3 py-2 w-[28%]">Contact Phone</th>
                          <th className="px-3 py-2 w-[27%]">Email Address</th>
                          <th className="px-3 py-2 text-center w-[5%]"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {members.map((member, idx) => (
                          <tr key={idx} className="hover:bg-muted/10">
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                placeholder="Full Name"
                                value={member.name}
                                onChange={(e) => {
                                  const updated = [...members];
                                  updated[idx].name = e.target.value;
                                  setMembers(updated);
                                }}
                                className="w-full px-2 py-1 bg-transparent border-0 hover:bg-muted/40 focus:bg-background focus:ring-1 focus:ring-primary rounded text-xs text-foreground font-semibold"
                                required
                                disabled={loading}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                placeholder="Phone number"
                                value={member.phone || ''}
                                onChange={(e) => {
                                  const updated = [...members];
                                  updated[idx].phone = e.target.value;
                                  setMembers(updated);
                                }}
                                className="w-full px-2 py-1 bg-transparent border-0 hover:bg-muted/40 focus:bg-background focus:ring-1 focus:ring-primary rounded text-xs text-foreground"
                                disabled={loading}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="email"
                                placeholder="Email"
                                value={member.email || ''}
                                onChange={(e) => {
                                  const updated = [...members];
                                  updated[idx].email = e.target.value;
                                  setMembers(updated);
                                }}
                                className="w-full px-2 py-1 bg-transparent border-0 hover:bg-muted/40 focus:bg-background focus:ring-1 focus:ring-primary rounded text-xs text-foreground"
                                disabled={loading}
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...members];
                                  const removed = updated.splice(idx, 1)[0];
                                  if (removed.id) {
                                    setDeletedMemberIds([...deletedMemberIds, removed.id]);
                                  }
                                  setMembers(updated);
                                }}
                                className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
                                disabled={loading}
                                title="Remove Member"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Individual: Link to Company */}
          {form.customer_type === 'individual' && companies.length > 0 && (
            <div className="space-y-1.5 text-xs p-3 bg-muted/20 border border-border/60 rounded-xl">
              <label className="text-muted-foreground font-semibold flex items-center gap-1">
                <Link2 size={13} /> Link to Company <span className="font-normal ml-1 text-muted-foreground">(Optional)</span>
              </label>
              <select value={form.company_id || ''} onChange={(e) => setForm({ ...form, company_id: e.target.value || undefined })} className="w-full px-2.5 py-1.5 bg-popover border border-border rounded-lg text-foreground text-xs" disabled={loading}>
                <option value="">-- No company (standalone individual) --</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {form.company_id && (
                <p className="text-[10px] text-primary font-medium mt-1">✓ Billing will be consolidated to the company account.</p>
              )}
            </div>
          )}

          {/* General Customer Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 space-y-1.5 text-xs">
              <label htmlFor="name" className="text-muted-foreground font-semibold flex items-center gap-1">
                <User size={13} /> {form.customer_type === 'company' ? 'Company Name *' : 'Full Client Name *'}
              </label>
              <input id="name" type="text" placeholder={form.customer_type === 'company' ? 'E.g. Al-Bader LLC' : 'E.g. Mohammed Rahman'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-2.5 py-1.5 bg-muted/50 border border-border rounded-lg text-xs" required disabled={loading} />
            </div>
            <div className="space-y-1.5 text-xs">
              <label htmlFor="phone" className="text-muted-foreground font-semibold flex items-center gap-1"><Phone size={13} /> Contact Number</label>
              <input id="phone" type="text" placeholder="E.g. +971501234567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-2.5 py-1.5 bg-muted/50 border border-border rounded-lg text-xs" disabled={loading} />
            </div>
            <div className="space-y-1.5 text-xs">
              <label htmlFor="email" className="text-muted-foreground font-semibold flex items-center gap-1"><Mail size={13} /> Email Address</label>
              <input id="email" type="email" placeholder="E.g. customer@domain.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-2.5 py-1.5 bg-muted/50 border border-border rounded-lg text-xs" disabled={loading} />
            </div>
          </div>

          {/* Secondary Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5 text-xs">
              <label htmlFor="address" className="text-muted-foreground font-semibold flex items-center gap-1"><MapPin size={13} /> Address Details</label>
              <input id="address" type="text" placeholder="E.g. Musaffah M37, Abu Dhabi" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-2.5 py-1.5 bg-muted/50 border border-border rounded-lg text-xs" disabled={loading} />
            </div>
            <div className="space-y-1.5 text-xs">
              <label htmlFor="notes" className="text-muted-foreground font-semibold flex items-center gap-1"><FileText size={13} /> Custom Remarks / Internal Notes</label>
              <input id="notes" type="text" placeholder="E.g. Corporate client, visit visa packages..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-2.5 py-1.5 bg-muted/50 border border-border rounded-lg text-xs" disabled={loading} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button type="button" onClick={() => navigate('/customers')} className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:bg-secondary/40 transition-colors" disabled={loading}>Cancel</button>
            <button type="submit" disabled={loading} className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-lg text-xs font-semibold shadow-md transition-colors cursor-pointer">
              <Save size={14} />
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </PermissionGuard>
  );
};
