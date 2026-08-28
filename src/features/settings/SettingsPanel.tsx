import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { db } from '../../lib/db';
import type { Branch } from '../../types/database';
import {
  Building,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { TermsConditionsManager } from './TermsConditionsManager';

export const SettingsPanel: React.FC = () => {
  useAuth();
  
  // States
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'company';

  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Company Profile Settings State (stored in localStorage for reactive receipts)
  const [companyForm, setCompanyForm] = useState({
    name: 'Azizi Typing, Print & Stamp',
    address: 'Motijheel C/A, Dhaka, Bangladesh',
    phone: '+8801711223344',
    email: 'info@azizi.com',
    tax_rate: 0
  });

  const [branchForm, setBranchForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: ''
  });
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);

  const [successMsg, setSuccessMsg] = useState('');

  const loadBranches = async () => {
    try {
      const list = await db.branches.getAll();
      setBranches(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      // Load company profile from localStorage if exists
      const saved = localStorage.getItem('azizi_company_profile');
      if (saved) {
        try {
          setCompanyForm(JSON.parse(saved));
        } catch {}
      }
      await loadBranches();
      setLoading(false);
    };
    init();
  }, []);

  const handleCompanySave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('azizi_company_profile', JSON.stringify(companyForm));
    setSuccessMsg('Company settings updated successfully.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name) return;
    try {
      if (editingBranchId) {
        await db.branches.update(editingBranchId, branchForm);
        setSuccessMsg('Branch updated successfully.');
      } else {
        await db.branches.create(branchForm);
        setSuccessMsg('Branch created successfully.');
      }
      setBranchForm({ name: '', address: '', phone: '', email: '' });
      setEditingBranchId(null);
      await loadBranches();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditBranch = (branch: Branch) => {
    setEditingBranchId(branch.id);
    setBranchForm({
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || ''
    });
  };

  const handleDeleteBranch = async (id: string) => {
    if (confirm('Are you sure you want to delete this branch?')) {
      try {
        await db.branches.delete(id);
        setSuccessMsg('Branch deleted successfully.');
        await loadBranches();
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) {
        console.error(err);
      }
    }
  };


  return (
    <PermissionGuard permission="Settings.Update" fallback="ui">
      <div className="space-y-6">
        
        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">ERP Global Settings</h1>
          <p className="text-sm text-muted-foreground">Configure profile descriptors, receipt headers, and custom order status queues.</p>
        </div>

        {/* TAB CONTROLS */}
        <div className="flex gap-2 border-b border-border pb-px">
          <button
            onClick={() => setSearchParams({ tab: 'company' })}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'company'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Company Profile
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'branches' })}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'branches'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Branch Settings
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'terms' })}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'terms'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Terms & Conditions
          </button>
        </div>

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-4 rounded-xl flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} />
            {successMsg}
          </div>
        )}

        {loading ? (
          <div className="h-40 bg-muted/30 rounded-2xl animate-pulse" />
        ) : (
          <div className="w-full">
            {activeTab === 'company' && (
              <div className="glass border border-border p-6 rounded-2xl space-y-6 shadow-xl">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <Building className="text-primary" size={20} />
                  <h2 className="font-bold text-foreground text-lg m-0">Company Registry Profile</h2>
                </div>

                <form onSubmit={handleCompanySave} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">Legal Entity Name</label>
                    <input
                      type="text"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground"
                      placeholder="Azizi Typing, Print & Stamp"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">Support Helpdesk Email</label>
                    <input
                      type="email"
                      value={companyForm.email}
                      onChange={(e) => setCompanyForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground"
                      placeholder="info@azizi.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">Corporate Helpline</label>
                    <input
                      type="text"
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground"
                      placeholder="+88017..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">General Tax Rate (%)</label>
                    <input
                      type="number"
                      min={0}
                      value={companyForm.tax_rate}
                      onChange={(e) => setCompanyForm(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Head Office Address</label>
                  <textarea
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, address: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground resize-none"
                    placeholder="Enter physical location..."
                  />
                </div>

                <div className="flex justify-end pt-3 border-t border-border">
                  <button
                    type="submit"
                    className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg font-semibold shadow-md transition-colors"
                  >
                    Save Company Profile
                  </button>
                </div>
              </form>
            </div>
            )}

            {activeTab === 'branches' && (
              <div className="glass border border-border p-6 rounded-2xl space-y-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Building className="text-primary" size={20} />
                    <h2 className="font-bold text-foreground text-lg m-0">Branch Registry & Outlets</h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Branches List */}
                  <div className="lg:col-span-2 space-y-3">
                    <h3 className="font-semibold text-foreground text-sm mb-2">Active Branches</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {branches.map((b) => (
                        <div key={b.id} className="p-4 rounded-xl border border-border bg-card/50 flex flex-col justify-between group">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-foreground">{b.name}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleEditBranch(b)}
                                  className="p-1 hover:bg-muted text-muted-foreground hover:text-primary rounded cursor-pointer"
                                  title="Edit Branch"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteBranch(b.id)}
                                  className="p-1 hover:bg-muted text-muted-foreground hover:text-destructive rounded cursor-pointer"
                                  title="Delete Branch"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                            <div className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
                              {b.address && (
                                <div className="flex items-start gap-1">
                                  <MapPin size={12} className="mt-0.5 shrink-0" />
                                  <span>{b.address}</span>
                                </div>
                              )}
                              {b.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone size={12} className="shrink-0" />
                                  <span>{b.phone}</span>
                                </div>
                              )}
                              {b.email && (
                                <div className="flex items-center gap-1">
                                  <Mail size={12} className="shrink-0" />
                                  <span>{b.email}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add/Edit Form */}
                  <div className="p-4 rounded-xl border border-border bg-card/30">
                    <h3 className="font-semibold text-foreground text-sm mb-3">
                      {editingBranchId ? 'Edit Branch' : 'Add New Branch'}
                    </h3>
                    <form onSubmit={handleBranchSubmit} className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Branch Name</label>
                        <input
                          type="text"
                          required
                          value={branchForm.name}
                          onChange={(e) => setBranchForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="e.g. Mirpur Branch"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Email Address</label>
                        <input
                          type="email"
                          value={branchForm.email}
                          onChange={(e) => setBranchForm(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="mirpur@azizi.com"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Phone Number</label>
                        <input
                          type="text"
                          value={branchForm.phone}
                          onChange={(e) => setBranchForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="+8801..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-muted-foreground font-semibold">Physical Address</label>
                        <textarea
                          value={branchForm.address}
                          onChange={(e) => setBranchForm(prev => ({ ...prev, address: e.target.value }))}
                          rows={2}
                          className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Enter location address..."
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          type="submit"
                          className="flex-1 bg-primary hover:bg-primary-hover text-white py-2 rounded-lg font-semibold shadow-md transition-colors cursor-pointer"
                        >
                          {editingBranchId ? 'Update Branch' : 'Add Branch'}
                        </button>
                        {editingBranchId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBranchId(null);
                              setBranchForm({ name: '', address: '', phone: '', email: '' });
                            }}
                            className="px-3 bg-secondary hover:bg-muted text-foreground border border-border rounded-lg transition-colors cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'terms' && (
              <TermsConditionsManager />
            )}
          </div>
        )}

      </div>
    </PermissionGuard>
  );
};
