import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { TermsConditions } from '../../types/database';
import {
  Plus,
  Trash2,
  Edit2,
  FileText
} from 'lucide-react';

export const TermsConditionsManager: React.FC = () => {
  const [terms, setTerms] = useState<TermsConditions[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [form, setForm] = useState({
    title: '',
    content: '',
    sequence: 1
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadTerms = async () => {
    try {
      setLoading(true);
      const list = await db.termsConditions.getAll();
      setTerms(list);
      if (!editingId) {
        setForm(prev => ({ ...prev, sequence: list.length + 1 }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTerms();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setErrorMsg('Title and Content are required.');
      return;
    }
    setErrorMsg('');
    try {
      if (editingId) {
        await db.termsConditions.update(editingId, {
          title: form.title.trim(),
          content: form.content.trim(),
          sequence: form.sequence
        });
        setSuccessMsg('Terms & Conditions updated successfully.');
      } else {
        await db.termsConditions.create({
          title: form.title.trim(),
          content: form.content.trim(),
          sequence: form.sequence
        });
        setSuccessMsg('Terms & Conditions created successfully.');
      }
      setForm({ title: '', content: '', sequence: terms.length + 2 });
      setEditingId(null);
      await loadTerms();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to save terms and conditions.');
    }
  };

  const handleEdit = (t: TermsConditions) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      content: t.content,
      sequence: t.sequence
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this term & condition?')) {
      try {
        await db.termsConditions.delete(id);
        setSuccessMsg('Term & Condition deleted successfully.');
        await loadTerms();
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (loading && terms.length === 0) {
    return <div className="h-40 bg-muted/30 rounded-2xl animate-pulse" />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      {/* Form Card */}
      <div className="lg:col-span-1 glass border border-border p-6 rounded-2xl space-y-4 shadow-xl self-start">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <FileText className="text-primary" size={18} />
          <h3 className="font-bold text-foreground text-sm m-0">
            {editingId ? 'Edit Term & Condition' : 'Add Term & Condition'}
          </h3>
        </div>

        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-[11px] p-3 rounded-lg font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 text-[11px] p-3 rounded-lg font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="text-muted-foreground font-semibold">Title (e.g. Validity)</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Validity"
              className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-muted-foreground font-semibold">Content</label>
            <textarea
              rows={4}
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder="Enter the detailed terms here..."
              className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-muted-foreground font-semibold">Sequence (Display Order)</label>
            <input
              type="number"
              value={form.sequence}
              onChange={e => setForm({ ...form, sequence: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ title: '', content: '', sequence: terms.length + 1 });
                }}
                className="flex-1 py-2 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              {editingId ? 'Save Changes' : 'Create Term'}
            </button>
          </div>
        </form>
      </div>

      {/* List Card */}
      <div className="lg:col-span-2 glass border border-border p-6 rounded-2xl space-y-4 shadow-xl">
        <div className="border-b border-border pb-3">
          <h3 className="font-bold text-foreground text-sm m-0">Terms & Conditions Registry</h3>
        </div>

        {terms.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-8">
            No terms & conditions registered yet. Add one using the form on the left.
          </p>
        ) : (
          <div className="space-y-3">
            {terms.map(t => (
              <div key={t.id} className="p-4 bg-muted/10 border border-border/80 rounded-xl space-y-2 text-xs flex justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground">{t.title}</span>
                    <span className="text-[9px] bg-primary/10 border border-primary/20 text-primary font-bold px-1.5 py-0.5 rounded">
                      Seq: {t.sequence}
                    </span>
                  </div>
                  <p className="text-muted-foreground whitespace-pre-line leading-relaxed">{t.content}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => handleEdit(t)}
                    className="p-2 bg-primary/10 hover:bg-primary hover:text-white text-primary rounded-lg transition-all cursor-pointer flex items-center justify-center"
                    title="Edit Term"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-2 bg-destructive/10 hover:bg-destructive hover:text-white text-destructive rounded-lg transition-all cursor-pointer flex items-center justify-center"
                    title="Delete Term"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
