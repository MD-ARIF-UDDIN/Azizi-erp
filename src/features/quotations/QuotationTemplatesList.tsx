import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { QuotationTemplate, Service, TermsConditions } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useNavigate } from 'react-router-dom';
import {
  LayoutTemplate,
  Plus,
  Search,
  Trash2,
  Edit2,
  FileText,
  ArrowRight,
  X,
  Check
} from 'lucide-react';

export const QuotationTemplatesList: React.FC = () => {
  const navigate = useNavigate();

  // Data states
  const [templates, setTemplates] = useState<QuotationTemplate[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [termsList, setTermsList] = useState<TermsConditions[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal states for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formTermIds, setFormTermIds] = useState<string[]>([]);
  const [formItems, setFormItems] = useState<{ service_id: string; quantity: number; unit_price: number; notes?: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // New item selector in modal
  const [selectedServiceToAdd, setSelectedServiceToAdd] = useState('');
  const [selectedQtyToAdd, setSelectedQtyToAdd] = useState(1);
  const [selectedPriceToAdd, setSelectedPriceToAdd] = useState<number>(0);
  const [selectedNotesToAdd, setSelectedNotesToAdd] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [tpls, svcs, terms] = await Promise.all([
        db.quotationTemplates.getAll(),
        db.services.getAll(),
        db.termsConditions.getAll()
      ]);
      setTemplates(tpls || []);
      setServices((svcs || []).filter(s => s.status === 'Active'));
      setTermsList(terms || []);
    } catch (err) {
      console.error('Failed to load quotation templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleOpenCreate = () => {
    setEditingTemplateId(null);
    setFormName('');
    setFormDescription('');
    setFormNotes('');
    setFormTermIds([]);
    setFormItems([]);
    setSelectedServiceToAdd('');
    setSelectedQtyToAdd(1);
    setSelectedPriceToAdd(0);
    setSelectedNotesToAdd('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (template: QuotationTemplate) => {
    setEditingTemplateId(template.id);
    setFormName(template.name);
    setFormDescription(template.description || '');
    setFormNotes(template.notes || '');
    setFormTermIds(template.terms_conditions_ids || []);
    setFormItems(template.items || []);
    setSelectedServiceToAdd('');
    setSelectedQtyToAdd(1);
    setSelectedPriceToAdd(0);
    setSelectedNotesToAdd('');
    setIsModalOpen(true);
  };

  const handleAddItemToForm = () => {
    if (!selectedServiceToAdd) return;
    const svc = services.find(s => s.id === selectedServiceToAdd);
    if (!svc) return;

    setFormItems(prev => [
      ...prev,
      {
        service_id: svc.id,
        quantity: selectedQtyToAdd > 0 ? selectedQtyToAdd : 1,
        unit_price: selectedPriceToAdd >= 0 ? selectedPriceToAdd : svc.price,
        notes: selectedNotesToAdd.trim() || svc.name
      }
    ]);

    setSelectedServiceToAdd('');
    setSelectedQtyToAdd(1);
    setSelectedPriceToAdd(0);
    setSelectedNotesToAdd('');
  };

  const handleRemoveItemFromForm = (index: number) => {
    setFormItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleTermId = (termId: string) => {
    setFormTermIds(prev =>
      prev.includes(termId) ? prev.filter(id => id !== termId) : [...prev, termId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    if (formItems.length === 0) {
      alert('Please add at least one service item to the template.');
      return;
    }

    setSaving(true);
    try {
      if (editingTemplateId) {
        await db.quotationTemplates.update(editingTemplateId, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          notes: formNotes.trim() || undefined,
          terms_conditions_ids: formTermIds,
          items: formItems
        });
      } else {
        await db.quotationTemplates.create({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          notes: formNotes.trim() || undefined,
          terms_conditions_ids: formTermIds,
          items: formItems
        });
      }
      setIsModalOpen(false);
      await fetchAll();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: QuotationTemplate) => {
    if (!window.confirm(`Are you sure you want to delete template "${template.name}"?`)) return;
    try {
      await db.quotationTemplates.delete(template.id);
      await fetchAll();
    } catch (err) {
      console.error(err);
      alert('Failed to delete template.');
    }
  };

  const handleUseInQuotation = (templateId: string) => {
    navigate(`/quotations/create?template_id=${templateId}`);
  };

  const filteredTemplates = templates.filter(t => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      t.items.some(it => {
        const s = services.find(srv => srv.id === it.service_id);
        return s?.name.toLowerCase().includes(q) || (it.notes && it.notes.toLowerCase().includes(q));
      })
    );
  });

  const formSubtotal = formItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  return (
    <PermissionGuard permission="Sales.View" fallback="ui">
      <div className="space-y-6">

        {/* ── Top Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <LayoutTemplate size={18} />
              </div>
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Quotations</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Quotation Templates</h1>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer font-heading self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>New Template</span>
          </button>
        </div>

        {/* ── Search & Filter Bar ── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <input
              type="text"
              placeholder="Search templates by package name, service, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-xs font-medium text-foreground focus:border-primary outline-hidden shadow-2xs"
            />
          </div>
          <span className="text-xs text-muted-foreground font-semibold">
            {filteredTemplates.length} {filteredTemplates.length === 1 ? 'template' : 'templates'} found
          </span>
        </div>

        {/* ── Template Cards Grid ── */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-muted-foreground">Loading quotation templates...</span>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-12 text-center bg-card border border-border rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <LayoutTemplate size={24} />
            </div>
            <h3 className="font-bold text-sm text-foreground m-0">No quotation templates found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Create reusable package templates (e.g. Family Visa, Trade License Renewal, Golden Visa) to save time when issuing quotes.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              <Plus size={14} />
              <span>Create First Template</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredTemplates.map((template) => {
              const subtotal = template.items.reduce((s, it) => s + (it.unit_price * it.quantity), 0);

              return (
                <div
                  key={template.id}
                  className="bg-card border border-border rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                          <FileText size={18} />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-foreground m-0 leading-tight group-hover:text-primary transition-colors">
                            {template.name}
                          </h3>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            <span>{template.items.length} {template.items.length === 1 ? 'service' : 'services'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-black text-foreground text-base leading-none font-heading">
                          {subtotal.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-bold mt-0.5">AED</div>
                      </div>
                    </div>

                    {/* Description */}
                    {template.description && (
                      <p className="text-xs text-muted-foreground m-0 line-clamp-2 leading-relaxed">
                        {template.description}
                      </p>
                    )}

                    {/* Services Included */}
                    <div className="bg-muted/30 rounded-xl p-3 border border-border/60 space-y-2">
                      <div className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground">
                        Included Services:
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {template.items.map((item, idx) => {
                          const s = services.find(srv => srv.id === item.service_id);
                          return (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="truncate text-foreground pr-2 font-medium">
                                <span className="font-bold text-primary mr-1">{item.quantity}x</span>
                                {s?.name || item.notes || 'Service Item'}
                              </span>
                              <span className="font-semibold text-muted-foreground shrink-0 text-[11px]">
                                {(item.unit_price * item.quantity).toFixed(0)} AED
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Terms Attached Indicator */}
                    {template.terms_conditions_ids && template.terms_conditions_ids.length > 0 && (
                      <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                        <Check size={12} className="text-emerald-500" />
                        <span>{template.terms_conditions_ids.length} standard terms attached</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-border/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(template)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                        title="Edit Template"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(template)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete Template"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUseInQuotation(template.id)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer font-heading"
                    >
                      <span>Use in Quote</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════ CREATE / EDIT TEMPLATE MODAL ═══════ */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
              
              <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <LayoutTemplate size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground m-0">
                      {editingTemplateId ? 'Edit Quotation Template' : 'Create Quotation Template'}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto space-y-4 pr-1">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Template / Package Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VIP Golden Visa Package, LLC Setup"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground focus:border-primary outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Description / Scope <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Short summary of what this package covers..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground focus:border-primary outline-hidden"
                  />
                </div>

                {/* Services in Template */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-foreground">
                      Package Line Items ({formItems.length}) <span className="text-destructive">*</span>
                    </label>
                  </div>

                  {/* Add service item form */}
                  <div className="bg-muted/40 p-3 rounded-xl border border-border space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-6">
                        <select
                          value={selectedServiceToAdd}
                          onChange={(e) => {
                            const svcId = e.target.value;
                            setSelectedServiceToAdd(svcId);
                            const found = services.find(s => s.id === svcId);
                            if (found) {
                              setSelectedPriceToAdd(found.price);
                              setSelectedNotesToAdd(found.name);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold text-foreground cursor-pointer"
                        >
                          <option value="">-- Choose a Service --</option>
                          {services.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.price} AED)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={selectedQtyToAdd}
                          onChange={(e) => setSelectedQtyToAdd(parseInt(e.target.value) || 1)}
                          className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold text-foreground text-center"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Rate"
                          value={selectedPriceToAdd || ''}
                          onChange={(e) => setSelectedPriceToAdd(parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold text-foreground text-right"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddItemToForm}
                          disabled={!selectedServiceToAdd}
                          className="w-full py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* List of added items */}
                  {formItems.length > 0 ? (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto divide-y divide-border/60 border border-border/80 rounded-xl p-2 bg-background">
                      {formItems.map((it, idx) => {
                        const s = services.find(srv => srv.id === it.service_id);
                        return (
                          <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                            <div className="flex-1 truncate pr-2">
                              <span className="font-bold text-foreground">{it.quantity}x</span>{' '}
                              <span className="font-medium text-foreground">{s?.name || it.notes}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-bold text-foreground">{(it.unit_price * it.quantity).toFixed(2)} AED</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveItemFromForm(idx)}
                                className="text-muted-foreground hover:text-destructive p-1 rounded-md"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic py-2 text-center">
                      No services added to this package yet. Use selector above to add.
                    </div>
                  )}
                </div>

                {/* Terms and Conditions Selector */}
                {termsList.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <label className="block text-xs font-bold text-foreground">
                      Attach Terms & Conditions
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {termsList.map(term => (
                        <label
                          key={term.id}
                          className={`flex items-start gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                            formTermIds.includes(term.id)
                              ? 'bg-primary/10 border-primary text-primary font-bold'
                              : 'bg-muted/20 border-border text-foreground hover:bg-muted/40'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formTermIds.includes(term.id)}
                            onChange={() => handleToggleTermId(term.id)}
                            className="mt-0.5 rounded text-primary"
                          />
                          <span className="leading-tight">{term.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="pt-2 border-t border-border">
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Preset Notes / Instructions <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Standard notes to print on quotations using this template..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground focus:border-primary outline-hidden resize-none"
                  />
                </div>

                {/* Financial Summary */}
                <div className="bg-muted/40 p-3 rounded-xl border border-border flex items-center justify-between text-xs">
                  <div>
                    <div className="text-muted-foreground">{formItems.length} {formItems.length === 1 ? 'service item' : 'service items'} configured</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground font-bold uppercase">Package Subtotal</div>
                    <div className="text-base font-black text-primary font-heading">{formSubtotal.toFixed(2)} AED</div>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-secondary hover:bg-muted text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || formItems.length === 0}
                    className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 font-heading"
                  >
                    {saving ? 'Saving...' : editingTemplateId ? 'Update Template' : 'Create Template'}
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
