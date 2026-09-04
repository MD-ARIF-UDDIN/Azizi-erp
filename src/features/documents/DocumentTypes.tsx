import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { DocumentType, ClientDocument } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import {
  FileText,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  Layers,
  FileCheck,
  Check,
  ShieldAlert
} from 'lucide-react';

export const DocumentTypes: React.FC = () => {
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [clientDocs, setClientDocs] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<DocumentType | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    is_active: boolean;
  }>({
    name: '',
    description: '',
    is_active: true
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [types, docs] = await Promise.all([
        db.documentTypes.getAll(),
        db.clientDocuments.getAll()
      ]);
      setDocTypes(types || []);
      setClientDocs(docs || []);
    } catch (err) {
      console.error('Failed to load document types:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingType(null);
    setFormData({
      name: '',
      description: '',
      is_active: true
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const openEditModal = (dt: DocumentType) => {
    setEditingType(dt);
    setFormData({
      name: dt.name,
      description: dt.description || '',
      is_active: dt.is_active ?? true
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Document type name is required.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      if (editingType) {
        await db.documentTypes.update(editingType.id, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          is_active: formData.is_active
        });
        setSuccessMsg(`Document type "${formData.name.trim()}" updated successfully.`);
      } else {
        // Check for duplicate name
        const duplicate = docTypes.some(
          d => d.name.toLowerCase() === formData.name.trim().toLowerCase()
        );
        if (duplicate) {
          setErrorMsg('A document type with this name already exists.');
          setSaving(false);
          return;
        }

        await db.documentTypes.create({
          name: formData.name.trim(),
          description: formData.description.trim(),
          is_active: formData.is_active,
          is_deleted: false
        });
        setSuccessMsg(`Document type "${formData.name.trim()}" created successfully.`);
      }

      setShowModal(false);
      loadData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save document type.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (dt: DocumentType) => {
    try {
      await db.documentTypes.update(dt.id, { is_active: !dt.is_active });
      loadData();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleDelete = async (dt: DocumentType) => {
    const usageCount = clientDocs.filter(
      d => d.document_type?.toLowerCase() === dt.name.toLowerCase()
    ).length;

    const message = usageCount > 0
      ? `Warning: There are ${usageCount} document(s) currently registered under "${dt.name}". Are you sure you want to delete this document type?`
      : `Are you sure you want to delete "${dt.name}"?`;

    if (window.confirm(message)) {
      try {
        await db.documentTypes.delete(dt.id);
        setSuccessMsg(`Document type "${dt.name}" removed successfully.`);
        loadData();
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) {
        console.error('Failed to delete document type:', err);
      }
    }
  };

  // Filtered List
  const filteredTypes = docTypes.filter(dt => {
    const matchesSearch =
      dt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dt.description && dt.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'active') return dt.is_active;
    if (statusFilter === 'inactive') return !dt.is_active;
    return true;
  });

  const totalActive = docTypes.filter(dt => dt.is_active).length;
  const totalTracked = clientDocs.length;

  return (
    <PermissionGuard permission="Sales.View" fallback="ui">
      <div className="space-y-5">
        
        {/* ── HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground m-0 flex items-center gap-2">
              <FileText className="text-primary" size={20} />
              Document Types
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage custom document categories (Visa, Emirates ID, Passports, Trade Licenses) for the Expiry Tracker.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Document Type</span>
          </button>
        </div>

        {/* ── FEEDBACK ALERTS ── */}
        {successMsg && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-semibold animate-in fade-in duration-200">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── KPI METRICS RIBBON ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card border border-border/80 p-3.5 rounded-2xl shadow-2xs flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Layers size={18} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Total Types</span>
              <div className="text-lg font-black text-foreground mt-0.5">{docTypes.length} Categories</div>
            </div>
          </div>

          <div className="bg-card border border-border/80 p-3.5 rounded-2xl shadow-2xs flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Active Status</span>
              <div className="text-lg font-black text-emerald-600 mt-0.5">{totalActive} Active Types</div>
            </div>
          </div>

          <div className="bg-card border border-border/80 p-3.5 rounded-2xl shadow-2xs flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <FileCheck size={18} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">Tracked Documents</span>
              <div className="text-lg font-black text-blue-600 mt-0.5">{totalTracked} Customer Docs</div>
            </div>
          </div>
        </div>

        {/* ── SEARCH & FILTER CONTROLS ── */}
        <div className="bg-card border border-border/80 p-3 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <input
              type="text"
              placeholder="Search document types by name or description..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-muted/40 border border-border/60 rounded-xl text-xs text-foreground placeholder:text-muted-foreground font-medium focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60 self-start sm:self-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
              }`}
            >
              All ({docTypes.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
              }`}
            >
              Active ({totalActive})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
              }`}
            >
              Inactive ({docTypes.length - totalActive})
            </button>
          </div>
        </div>

        {/* ── DOCUMENT TYPES TABLE ── */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th style={{ width: '4%' }} className="px-3 py-2.5 text-center">#</th>
                  <th style={{ width: '22%' }} className="px-3 py-2.5">Document Type Name</th>
                  <th style={{ width: '38%' }} className="px-3 py-2.5">Description</th>
                  <th style={{ width: '14%' }} className="px-3 py-2.5 text-center">Tracked Docs</th>
                  <th style={{ width: '12%' }} className="px-3 py-2.5 text-center">Status</th>
                  <th style={{ width: '10%' }} className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-foreground">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold tracking-wider uppercase text-primary animate-pulse">Loading...</span>
                        <p className="text-[11px] text-muted-foreground font-medium">Please wait while document types are being loaded...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredTypes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground italic">
                      No document types found. Click "Add Document Type" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredTypes.map((dt, idx) => {
                    const usageCount = clientDocs.filter(
                      d => d.document_type?.toLowerCase() === dt.name.toLowerCase()
                    ).length;

                    return (
                      <tr key={dt.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5 text-center font-mono text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-primary" />
                            <span>{dt.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {dt.description || <span className="italic text-muted-foreground/60">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                            usageCount > 0
                              ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {usageCount} docs
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => handleToggleActive(dt)}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                              dt.is_active
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 border border-rose-500/20 hover:bg-rose-500/20'
                            }`}
                            title="Click to toggle status"
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${dt.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span>{dt.is_active ? 'Active' : 'Inactive'}</span>
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditModal(dt)}
                              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-primary rounded-lg transition-colors cursor-pointer"
                              title="Edit Document Type"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(dt)}
                              className="p-1.5 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Delete Document Type"
                            >
                              <Trash2 size={13} />
                            </button>
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

        {/* ── CREATE / EDIT MODAL ── */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
              
              {/* Modal Header */}
              <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground m-0">
                      {editingType ? 'Edit Document Type' : 'New Document Type'}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {editingType ? 'Update document category details' : 'Add a new document category to tracking'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {errorMsg && (
                  <div className="flex items-center gap-2 p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-semibold">
                    <ShieldAlert size={15} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">
                    Document Type Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Visa, Labor Card, Ejari..."
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-muted/30 border border-border/70 rounded-xl text-xs text-foreground placeholder:text-muted-foreground font-semibold focus:outline-none focus:border-primary focus:bg-card"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">
                    Description / Purpose
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of this document type or authority..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-muted/30 border border-border/70 rounded-xl text-xs text-foreground placeholder:text-muted-foreground font-medium focus:outline-none focus:border-primary focus:bg-card resize-none"
                  />
                </div>

                {/* Active Status */}
                <div className="flex items-center justify-between p-3 bg-muted/30 border border-border/70 rounded-xl">
                  <div>
                    <span className="text-xs font-bold text-foreground block">Active Status</span>
                    <span className="text-[10px] text-muted-foreground">Make this document type selectable in Expiry Tracker</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Modal Actions */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3.5 py-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check size={14} />
                    <span>{saving ? 'Saving...' : editingType ? 'Update Type' : 'Create Type'}</span>
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
