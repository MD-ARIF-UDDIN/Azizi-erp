import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { ClientDocument, Customer } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import {
  Calendar,
  AlertTriangle,
  CheckCircle,
  Bell,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  User,
  Clock
} from 'lucide-react';

export const ExpiryTracker: React.FC = () => {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocType, setSelectedDocType] = useState<string>('All');
  const [timeframeFilter, setTimeframeFilter] = useState<'All' | 'Critical' | 'Upcoming' | 'Safe'>('All');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');


  // CRUD Form State
  const [showModal, setShowModal] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    customer_id: string;
    document_type: ClientDocument['document_type'];
    document_number: string;
    expiry_date: string;
    notes: string;
    status: ClientDocument['status'];
    notified: boolean;
  }>({
    customer_id: '',
    document_type: 'Visa',
    document_number: '',
    expiry_date: '',
    notes: '',
    status: 'Active',
    notified: false
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const docs = await db.clientDocuments.getAll();
      setDocuments(docs);
      const custs = await db.customers.getAll();
      setCustomers(custs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_id || !form.expiry_date) return;
    setErrorMsg('');
    try {
      if (editingDocId) {
        await db.clientDocuments.update(editingDocId, form);
        setSuccessMsg('Document record updated successfully.');
      } else {
        await db.clientDocuments.create(form);
        setSuccessMsg('Document record created successfully.');
      }
      setShowModal(false);
      setEditingDocId(null);
      setForm({
        customer_id: '',
        document_type: 'Visa',
        document_number: '',
        expiry_date: '',
        notes: '',
        status: 'Active',
        notified: false
      });
      loadData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save document expiry record.');
    }
  };


  const handleEdit = (doc: ClientDocument) => {
    setEditingDocId(doc.id);
    setForm({
      customer_id: doc.customer_id,
      document_type: doc.document_type,
      document_number: doc.document_number || '',
      expiry_date: doc.expiry_date,
      notes: doc.notes || '',
      status: doc.status,
      notified: doc.notified
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this document tracking record?')) {
      try {
        await db.clientDocuments.delete(id);
        setSuccessMsg('Document record deleted successfully.');
        loadData();
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleToggleNotified = async (doc: ClientDocument) => {
    try {
      await db.clientDocuments.update(doc.id, { notified: !doc.notified });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Expiry Calculations
  const getDaysRemaining = (expiryDateStr: string) => {
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    // Reset hours
    expiry.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getExpirySeverity = (days: number) => {
    if (days < 0) return { label: 'Expired', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', icon: <AlertTriangle size={12} /> };
    if (days <= 30) return { label: 'Urgent (<30d)', color: 'text-rose-450 bg-rose-450/10 border-rose-450/20', icon: <Clock size={12} /> };
    if (days <= 60) return { label: 'Upcoming (<60d)', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', icon: <Bell size={12} /> };
    return { label: 'Safe', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: <CheckCircle size={12} /> };
  };

  // Filter Logic
  const filteredDocs = documents.filter(doc => {
    const custName = doc.customer?.name || '';
    const matchesSearch =
      custName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.document_number && doc.document_number.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDocType = selectedDocType === 'All' ? true : doc.document_type === selectedDocType;

    const daysLeft = getDaysRemaining(doc.expiry_date);
    let matchesTimeframe = true;
    if (timeframeFilter === 'Critical') {
      matchesTimeframe = daysLeft <= 30;
    } else if (timeframeFilter === 'Upcoming') {
      matchesTimeframe = daysLeft > 30 && daysLeft <= 60;
    } else if (timeframeFilter === 'Safe') {
      matchesTimeframe = daysLeft > 60;
    }

    return matchesSearch && matchesDocType && matchesTimeframe;
  });

  const criticalCount = documents.filter(d => getDaysRemaining(d.expiry_date) <= 30).length;
  const upcomingCount = documents.filter(d => {
    const days = getDaysRemaining(d.expiry_date);
    return days > 30 && days <= 60;
  }).length;

  return (
    <PermissionGuard permission="Sales.View" fallback="ui">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Renewals Hub</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Visa & Expiry Tracker</h1>
          </div>
          <button
            onClick={() => {
              setEditingDocId(null);
              setForm({
                customer_id: '',
                document_type: 'Visa',
                document_number: '',
                expiry_date: '',
                notes: '',
                status: 'Active',
                notified: false
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer self-start sm:self-auto"
          >
            <Plus size={15} />
            Track Document Expiry
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-4 rounded-xl flex items-center gap-2 font-medium">
            <CheckCircle size={16} />
            {successMsg}
          </div>
        )}

        {/* Highlight Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border border-border bg-rose-500/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-rose-500 tracking-wider">Critical Expiries</span>
              <h2 className="text-2xl font-extrabold text-foreground mt-1">{criticalCount}</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Expiring in 30 days or less</p>
            </div>
            <AlertTriangle className="text-rose-500 opacity-60" size={32} />
          </div>

          <div className="p-4 rounded-2xl border border-border bg-amber-500/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Upcoming Expiries</span>
              <h2 className="text-2xl font-extrabold text-foreground mt-1">{upcomingCount}</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Expiring within 60 days</p>
            </div>
            <Bell className="text-amber-500 opacity-60" size={32} />
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-primary tracking-wider">Active Logs</span>
              <h2 className="text-2xl font-extrabold text-foreground mt-1">{documents.length}</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Total documents being tracked</p>
            </div>
            <Calendar className="text-primary opacity-60" size={32} />
          </div>
        </div>

        {/* Directory Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card border border-border p-4 rounded-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client name or document number..."
              className="w-full pl-9 pr-4 py-2 bg-secondary/30 border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="bg-secondary/30 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="All">All Documents</option>
              <option value="Visa">Visas Only</option>
              <option value="Emirates ID">Emirates IDs Only</option>
              <option value="Passport">Passports Only</option>
              <option value="Trade License">Trade Licenses Only</option>
              <option value="Other">Others</option>
            </select>

            <div className="flex rounded-xl border border-border overflow-hidden p-0.5 bg-secondary/15">
              {(['All', 'Critical', 'Upcoming', 'Safe'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setTimeframeFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    timeframeFilter === tab
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Document Grid */}
        {loading ? (
          <div className="h-60 bg-muted/10 border border-dashed border-border rounded-2xl animate-pulse" />
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-12 bg-muted/5 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center p-6 space-y-3">
            <Clock size={36} className="text-muted-foreground" />
            <h3 className="font-bold text-foreground text-sm">No Expiries Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm">No tracked documents match your current filter parameters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map(doc => {
              const daysLeft = getDaysRemaining(doc.expiry_date);
              const severity = getExpirySeverity(daysLeft);

              return (
                <div key={doc.id} className="glass p-5 rounded-2xl border border-border bg-card/65 flex flex-col justify-between hover:shadow-lg transition-all group">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {doc.document_type}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${severity.color}`}>
                        {severity.icon}
                        {severity.label}
                      </span>
                    </div>

                    <div>
                      <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                        <User size={13} className="text-primary shrink-0" />
                        {doc.customer?.name}
                      </div>
                      {doc.document_number && (
                        <div className="text-[10px] text-muted-foreground font-mono mt-1">
                          No: {doc.document_number}
                        </div>
                      )}
                    </div>

                    <div className="bg-secondary/20 rounded-xl p-3 space-y-2 text-xs border border-border/40">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Expiry Date:</span>
                        <span className="font-bold text-foreground">{doc.expiry_date}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Status Tracker:</span>
                        <span className={`font-semibold ${daysLeft < 0 ? 'text-rose-500' : daysLeft <= 60 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {daysLeft < 0 ? 'Expired' : `${daysLeft} days left`}
                        </span>
                      </div>
                    </div>

                    {doc.notes && (
                      <p className="text-[11px] text-muted-foreground italic bg-secondary/10 p-2 rounded-lg border border-border/20">
                        "{doc.notes}"
                      </p>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between gap-3">
                    <button
                      onClick={() => handleToggleNotified(doc)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        doc.notified
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-secondary/40 text-muted-foreground border-border hover:text-foreground'
                      }`}
                    >
                      <Bell size={11} />
                      {doc.notified ? 'Notified' : 'Mark Notified'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleEdit(doc)}
                        className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-black flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                        title="Edit Expiry Tracking"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                        title="Remove Tracking"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Editor Form */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass border border-border rounded-2xl p-6 space-y-6 shadow-2xl relative bg-background w-full max-w-md">
              <button
                onClick={() => setShowModal(false)}
                className="absolute right-4 top-4 p-1.5 text-muted-foreground hover:text-foreground bg-muted/40 rounded-full transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>

              <div>
                <h2 className="font-bold text-foreground text-base m-0">
                  {editingDocId ? 'Edit Document Details' : 'Track New Document Expiry'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {errorMsg && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-lg text-center font-medium">
                    {errorMsg}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Select Customer</label>
                  <select
                    required
                    value={form.customer_id}
                    onChange={(e) => setForm(prev => ({ ...prev, customer_id: e.target.value }))}
                    disabled={!!editingDocId}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Choose Client --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone || 'No phone'})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">Document Type</label>
                    <select
                      value={form.document_type}
                      onChange={(e) => setForm(prev => ({ ...prev, document_type: e.target.value as any }))}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="Visa">Visa</option>
                      <option value="Emirates ID">Emirates ID</option>
                      <option value="Passport">Passport</option>
                      <option value="Trade License">Trade License</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">Expiry Date</label>
                    <input
                      type="date"
                      required
                      value={form.expiry_date}
                      onChange={(e) => setForm(prev => ({ ...prev, expiry_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Document Number (Optional)</label>
                  <input
                    type="text"
                    value={form.document_number}
                    onChange={(e) => setForm(prev => ({ ...prev, document_number: e.target.value }))}
                    placeholder="e.g. Visa UID or EID Number"
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Internal Notes / Reminders</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Enter document notes or renew triggers..."
                  />
                </div>

                <div className="flex items-center gap-2 py-1.5">
                  <input
                    id="notified"
                    type="checkbox"
                    checked={form.notified}
                    onChange={(e) => setForm(prev => ({ ...prev, notified: e.target.checked }))}
                    className="h-4 w-4 text-primary focus:ring-primary border-border bg-muted/50 rounded"
                  />
                  <label htmlFor="notified" className="text-muted-foreground font-semibold cursor-pointer">
                    Client already notified about this expiry
                  </label>
                </div>

                <div className="flex gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-secondary hover:bg-muted text-foreground py-2.5 rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary-hover text-white py-2.5 rounded-lg font-bold transition-colors cursor-pointer shadow-md shadow-primary/10"
                  >
                    {editingDocId ? 'Save Edits' : 'Save Expiry'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
};
