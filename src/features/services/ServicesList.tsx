import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { Service, ServiceCategory } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { exportServices, exportServiceCategories } from '../../lib/excelExport';
import {
  Plus,
  Edit2,
  Trash2,
  Tag,
  Briefcase,
  Layers,
  Download
} from 'lucide-react';

export const ServicesList: React.FC = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  
  // Data States
  const [services, setServices] = useState<(Service & { category?: ServiceCategory })[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'categories'>('catalog');

  const fetchData = async () => {
    setLoading(true);
    try {
      const sData = await db.services.getAll();
      const cData = await db.serviceCategories.getAll();
      setServices(sData);
      setCategories(cData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteService = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      await db.services.delete(id);
      await fetchData();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const associated = services.filter(s => s.category_id === id);
    if (associated.length > 0) {
      alert(`Cannot delete category. There are ${associated.length} active service items linked to it. Remove or relocate items first.`);
      return;
    }

    if (window.confirm('Are you sure you want to delete this service category?')) {
      await db.serviceCategories.delete(id);
      await fetchData();
    }
  };

  return (
    <PermissionGuard permission="Customer.View" fallback="ui">
      <div className="space-y-6">
        
        {/* PAGE HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Services & Items</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">List</h1>
          </div>

          {/* Tab Switcher */}
          <div className="bg-secondary/40 border border-border p-1 rounded-xl flex gap-1 self-start">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'catalog'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Briefcase size={14} />
              Services Catalog
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'categories'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers size={14} />
              Service Categories
            </button>
          </div>
        </div>

        {/* LOADING SKELETON */}
        {loading ? (
          <div className="space-y-3">
            <div className="h-10 w-full bg-muted/30 rounded-xl animate-pulse" />
            <div className="h-32 w-full bg-muted/30 rounded-xl animate-pulse" />
          </div>
        ) : (
          <>
            {/* SERVICES CATALOG PANEL */}
            {activeTab === 'catalog' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground font-medium">
                    Showing {services.length} registered typing & printing items.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportServices(services)}
                      className="flex items-center gap-1.5 border border-border text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
                    >
                      <Download size={14} />
                      Export Excel
                    </button>
                    {hasPermission('Customer.Update') && (
                      <button
                        onClick={() => navigate('/services/create')}
                        className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all"
                      >
                        <Plus size={14} />
                        Add Service Item
                      </button>
                    )}
                  </div>
                </div>

                <div className="glass border border-border rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-secondary/40 border-b border-border text-muted-foreground text-xs uppercase font-semibold">
                        <tr>
                          <th className="px-4 py-4 text-center w-12">SL</th>
                          <th className="px-6 py-4">Service Name</th>
                          <th className="px-6 py-4">Category</th>
                          <th className="px-6 py-4">Base Price</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {services.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                              No service items registered. Please add service items.
                            </td>
                          </tr>
                        ) : (
                          services.map((s, idx) => (
                            <tr key={s.id} className="hover:bg-muted/25 transition-colors">
                              <td className="px-4 py-4 text-center text-muted-foreground font-semibold">
                                {idx + 1}
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-semibold text-foreground">{s.name}</div>
                                {s.description && <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>}
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold">
                                  <Tag size={12} />
                                  {s.category?.name || 'Uncategorized'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-foreground font-bold">
                                {s.price.toFixed(2)} AED
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  s.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                                }`}>
                                  {s.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right space-x-2">
                                {hasPermission('Customer.Update') && (
                                  <button
                                    onClick={() => navigate(`/services/edit/${s.id}`)}
                                    className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                )}
                                {hasPermission('Customer.Delete') && (
                                  <button
                                    onClick={() => handleDeleteService(s.id)}
                                    className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SERVICE CATEGORIES PANEL */}
            {activeTab === 'categories' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center w-full">
                  <div />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportServiceCategories(categories, services)}
                      className="flex items-center gap-1.5 border border-border text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
                    >
                      <Download size={14} />
                      Export Excel
                    </button>
                    {hasPermission('Customer.Update') && (
                      <button
                        onClick={() => navigate('/services/category/create')}
                        className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all"
                      >
                        <Plus size={14} />
                        Add Category
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map(c => {
                    const itemCount = services.filter(s => s.category_id === c.id).length;
                    return (
                      <div key={c.id} className="glass border border-border p-5 rounded-2xl flex flex-col justify-between space-y-4 shadow-md">
                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-foreground text-md m-0">{c.name}</h3>
                            <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                              {itemCount} Item{itemCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">{c.description || 'No description listed.'}</p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                          {hasPermission('Customer.Update') && (
                            <button
                              onClick={() => navigate(`/services/category/edit/${c.id}`)}
                              className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                          {hasPermission('Customer.Delete') && (
                            <button
                              onClick={() => handleDeleteCategory(c.id)}
                              className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PermissionGuard>
  );
};
