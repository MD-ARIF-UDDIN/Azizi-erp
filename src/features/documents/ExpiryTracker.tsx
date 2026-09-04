import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/db';
import type { ClientDocument, Customer, DocumentType } from '../../types/database';
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
  Clock,
  FileText
} from 'lucide-react';

export const ExpiryTracker: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
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
    document_type: string;
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
      const [docs, custs, types] = await Promise.all([
        db.clientDocuments.getAll(),
        db.customers.getAll(),
        db.documentTypes.getAll()
      ]);
      setDocuments(docs || []);
      setCustomers(custs || []);
      setDocTypes(types || []);
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
        document_type: docTypes[0]?.name || 'Visa',
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
    expiry.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getExpirySeverity = (days: number) => {
    if (days < 0) {
      return {
        label: 'Expired',
        color: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
        badgeColor: 'bg-rose-500',
        icon: <AlertTriangle size={12} className="text-rose-500" />
      };
    }
    if (days <= 30) {
      return {
        label: 'Critical',
        color: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
        badgeColor: 'bg-rose-500',
        icon: <AlertTriangle size={12} className="text-rose-500" />
      };
    }
    if (days <= 60) {
      return {
        label: 'Expiring Soon',
        color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        badgeColor: 'bg-amber-500',
        icon: <Bell size={12} className="text-amber-500" />
      };
    }
    return {
      label: 'Safe',
      color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      badgeColor: 'bg-emerald-500',
      icon: <CheckCircle size={12} className="text-emerald-500" />
    };
  };

  // Filter Pipeline
  const filteredDocs = documents.filter(doc => {
    const customer = doc.customer || customers.find(c => c.id === doc.customer_id);
    const customerName = customer?.name || '';
    const docNumber = doc.document_number || '';

    const matchesSearch =
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      docNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDocType =
      selectedDocType === 'All' || doc.document_type?.toLowerCase() === selectedDocType.toLowerCase();

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
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground m-0 flex items-center gap-2">
              <Calendar className="text-primary" size={20} />
              Expiry Tracker &amp; Reminders
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track renewal timelines for Visas, Emirates IDs, Passports &amp; Trade Licenses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/expiry-tracker/types')}
              className="flex items-center gap-1.5 bg-card hover:bg-muted border border-border text-foreground px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
            >
              <FileText size={14} className="text-primary" />
              <span>Document Types</span>
            </button>

            <button
              onClick={() => {
                setEditingDocId(null);
                setForm({
                  customer_id: '',
                  document_type: docTypes[0]?.name || 'Visa',
                  document_number: '',
                  expiry_date: '',
                  notes: '',
                  status: 'Active',
                  notified: false
                });
                setShowModal(true);
              }}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>Track Document Expiry</span>
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs p-3 rounded-xl flex items-center gap-2 font-medium">
            <CheckCircle size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Highlight Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border border-border bg-rose-500/5 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-rose-500 tracking-wider">Critical Expiries</span>
              <h2 className="text-2xl font-black text-foreground mt-1">{criticalCount}</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Expiring in 30 days or less</p>
            </div>
            <AlertTriangle className="text-rose-500 opacity-60" size={32} />
          </div>

          <div className="p-4 rounded-2xl border border-border bg-amber-500/5 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Upcoming Expiries</span>
              <h2 className="text-2xl font-black text-foreground mt-1">{upcomingCount}</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Expiring within 60 days</p>
            </div>
            <Bell className="text-amber-500 opacity-60" size={32} />
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-primary tracking-wider">Active Logs</span>
              <h2 className="text-2xl font-black text-foreground mt-1">{documents.length}</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Total documents being tracked</p>
            </div>
            <Calendar className="text-primary opacity-60" size={32} />
          </div>
        </div>

        {/* Directory Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card border border-border/80 p-3.5 rounded-2xl shadow-2xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client name or document number..."
              className="w-full pl-9 pr-4 py-1.5 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="bg-muted/40 border border-border/60 rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
            >
              <option value="All">All Documents</option>
              {docTypes.map(dt => (
                <option key={dt.id} value={dt.name}>{dt.name}</option>
              ))}
              {docTypes.length === 0 && (
                <>
                  <option value="Visa">Visas Only</option>
                  <option value="Emirates ID">Emirates IDs Only</option>
                  <option value="Passport">Passports Only</option>
                  <option value="Trade License">Trade Licenses Only</option>
                  <option value="Other">Others</option>
                </>
              )}
            </select>

            <div className="flex rounded-xl border border-border/60 overflow-hidden p-0.5 bg-muted/40">
              {(['All', 'Critical', 'Upcoming', 'Safe'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setTimeframeFilter(tab)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    timeframeFilter === tab
                      ? 'bg-primary text-white shadow-2xs'
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
          <div className="p-12 text-center bg-card border border-border rounded-2xl">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold tracking-wider uppercase text-primary animate-pulse">Loading...</span>
              <p className="text-[11px] text-muted-foreground font-medium">Please wait while tracked documents are being loaded...</p>
            </div>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border flex flex-col items-center justify-center p-6 space-y-3">
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
                <div key={doc.id} className="p-4 rounded-2xl border border-border bg-card flex flex-col justify-between hover:shadow-md transition-all group shadow-2xs">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
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
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          No: {doc.document_number}
                        </div>
                      )}
                    </div>

                    <div className="bg-muted/30 rounded-xl p-3 space-y-1.5 text-xs border border-border/40">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Expiry Date:</span>
                        <span className="font-bold text-foreground font-mono">{doc.expiry_date}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Status Tracker:</span>
                        <span className={`font-bold font-mono ${daysLeft < 0 ? 'text-rose-500' : daysLeft <= 60 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {daysLeft < 0 ? 'Expired' : `${daysLeft} days left`}
                        </span>
                      </div>
                    </div>

                    {doc.notes && (
                      <p className="text-[11px] text-muted-foreground italic bg-muted/20 p-2 rounded-lg border border-border/30 m-0">
                        {doc.notes}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between">
                    <button
                      onClick={() => handleToggleNotified(doc)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        doc.notified
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                      }`}
                    >
                      {doc.notified ? '✓ Client Notified' : 'Mark Notified'}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(doc)}
                        className="p-1.5 hover:bg-muted text-muted-foreground hover:text-primary rounded-lg transition-colors cursor-pointer"
                        title="Edit Document"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="p-1.5 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Delete Record"
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

        {/* Modal for CRUD */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-xl p-5 space-y-4 relative animate-in zoom-in-95 duration-150">
              <button
                onClick={() => setShowModal(false)}
                className="absolute right-4 top-4 p-1 rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>

              <div>
                <h2 className="font-bold text-foreground text-base m-0">
                  {editingDocId ? 'Edit Document Details' : 'Track New Document Expiry'}
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Enter customer document expiration information
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                {errorMsg && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs p-2.5 rounded-xl font-medium">
                    {errorMsg}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Select Customer *</label>
                  <select
                    required
                    value={form.customer_id}
                    onChange={(e) => setForm(prev => ({ ...prev, customer_id: e.target.value }))}
                    disabled={!!editingDocId}
                    className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-foreground focus:outline-none focus:border-primary font-semibold"
                  >
                    <option value="">-- Choose Client --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone || 'No phone'})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">Document Type</label>
                    <select
                      value={form.document_type}
                      onChange={(e) => setForm(prev => ({ ...prev, document_type: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-foreground focus:outline-none focus:border-primary font-semibold"
                    >
                      {docTypes.filter(d => d.is_active).map(dt => (
                        <option key={dt.id} value={dt.name}>{dt.name}</option>
                      ))}
                      {docTypes.length === 0 && (
                        <>
                          <option value="Visa">Visa</option>
                          <option value="Emirates ID">Emirates ID</option>
                          <option value="Passport">Passport</option>
                          <option value="Trade License">Trade License</option>
                          <option value="Other">Other</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">Expiry Date *</label>
                    <input
                      type="date"
                      required
                      value={form.expiry_date}
                      onChange={(e) => setForm(prev => ({ ...prev, expiry_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-foreground focus:outline-none focus:border-primary font-semibold"
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
                    className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-foreground focus:outline-none focus:border-primary font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Internal Notes / Reminders</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 bg-muted/40 border border-border/70 rounded-xl text-foreground resize-none focus:outline-none focus:border-primary font-medium"
                    placeholder="Enter document notes or renew triggers..."
                  />
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input
                    id="notified"
                    type="checkbox"
                    checked={form.notified}
                    onChange={(e) => setForm(prev => ({ ...prev, notified: e.target.checked }))}
                    className="h-4 w-4 text-primary focus:ring-primary border-border bg-muted/40 rounded cursor-pointer"
                  />
                  <label htmlFor="notified" className="text-muted-foreground font-semibold cursor-pointer">
                    Client already notified about this expiry
                  </label>
                </div>

                <div className="flex gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-muted hover:bg-muted/80 text-foreground py-2 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary-hover text-white py-2 rounded-xl font-bold transition-colors cursor-pointer shadow-2xs"
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
