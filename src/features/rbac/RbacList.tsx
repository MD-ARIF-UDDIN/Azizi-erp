import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { User, Role, Branch, Permission } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { exportUsers, exportRoles, exportBranches } from '../../lib/excelExport';
import {
  Users,
  Shield,
  Building,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Mail,
  Phone,
  CheckSquare,
  Square,
  X,
  Download,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';

export const RbacList: React.FC = () => {
  const { hasPermission, reloadSession } = useAuth();
  const [activeTab, setActiveTab] = useState<'employees' | 'roles' | 'branches'>('employees');
  
  // Data States
  const [users, setUsers] = useState<(User & { role?: Role; branch?: Branch })[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rolePermsMap, setRolePermsMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  // Modal / Form States
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    role_id: '',
    branch_id: '',
    status: 'Active' as User['status'],
    password: ''
  });

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: ''
  });
  const [branchForm, setBranchForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: ''
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [u, r, p, b] = await Promise.all([
        db.users.getAll(),
        db.roles.getAll(),
        db.permissions.getAll(),
        db.branches.getAll()
      ]);
      setUsers(u);
      setRoles(r);
      setPermissions(p);
      setBranches(b);

      // Fetch role-permissions map
      const map: Record<string, string[]> = {};
      for (const role of r) {
        const rpList = await db.rolePermissions.getByRoleId(role.id);
        map[role.id] = rpList.map(item => item.permission_id);
      }
      setRolePermsMap(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Employee Form Submit (Pure Role-Based)
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name || !userForm.email || !userForm.role_id || !userForm.branch_id) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (!editingUser && (!userForm.password || userForm.password.length < 4)) {
      setErrorMsg('Please provide a login password (at least 4 characters).');
      return;
    }

    const payload = {
      ...userForm,
      permissions: [] // Pure role-based: clear custom overrides
    };

    try {
      if (editingUser) {
        await db.users.update(editingUser.id, payload);
      } else {
        await db.users.create(payload);
      }
      setShowUserModal(false);
      setEditingUser(null);
      setUserForm({ name: '', email: '', phone: '', role_id: '', branch_id: '', status: 'Active', password: '' });
      setErrorMsg('');
      await fetchData();
      reloadSession();
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed.');
    }
  };

  // Branch Form Submit
  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name) {
      setErrorMsg('Branch name is required.');
      return;
    }

    try {
      if (editingBranch) {
        await db.branches.update(editingBranch.id, branchForm);
      } else {
        await db.branches.create(branchForm);
      }
      setShowBranchModal(false);
      setEditingBranch(null);
      setBranchForm({ name: '', address: '', phone: '', email: '' });
      setErrorMsg('');
      await fetchData();
      reloadSession();
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed.');
    }
  };

  // Role Form Submit
  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name) {
      setErrorMsg('Role name is required.');
      return;
    }

    try {
      await db.roles.create(roleForm);
      setShowRoleModal(false);
      setRoleForm({ name: '', description: '' });
      setErrorMsg('');
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed.');
    }
  };

  // Delete Handlers
  const handleDeleteUser = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      await db.users.delete(id);
      await fetchData();
      reloadSession();
    }
  };

  const handleDeleteBranch = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this branch?')) {
      await db.branches.delete(id);
      await fetchData();
      reloadSession();
    }
  };

  // Matrix Checkbox Toggle
  const handlePermissionToggle = async (roleId: string, permissionId: string) => {
    if (!hasPermission('Roles.Update')) return;
    const currentList = rolePermsMap[roleId] || [];
    let newList: string[];

    if (currentList.includes(permissionId)) {
      newList = currentList.filter(id => id !== permissionId);
    } else {
      newList = [...currentList, permissionId];
    }

    // Optimistic Update
    setRolePermsMap(prev => ({
      ...prev,
      [roleId]: newList
    }));

    try {
      await db.rolePermissions.updateRolePermissions(roleId, newList);
      reloadSession();
    } catch (err) {
      console.error('Failed to update role permissions:', err);
      // Revert if error
      fetchData();
    }
  };

  // Filters search query for employees
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.phone?.includes(searchQuery)
  );

  return (
    <PermissionGuard permission="Users.View" fallback="ui">
      <div className="space-y-6">
        {/* PAGE HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">
              Users & Access Control
            </h1>
          </div>

          {/* TAB TRIGGERS */}
          <div className="bg-secondary/40 border border-border p-1 rounded-xl flex gap-1 self-start">
            <button
              onClick={() => setActiveTab('employees')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'employees'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users size={14} />
              Employees
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'roles'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield size={14} />
              Roles & Permissions
            </button>
            <button
              onClick={() => setActiveTab('branches')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'branches'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building size={14} />
              Branches
            </button>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading ? (
          <div className="table-container p-12 text-center bg-card border border-border rounded-xl">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold tracking-wider uppercase text-primary animate-pulse">Loading...</span>
              <p className="text-[11px] text-muted-foreground font-medium">Please wait while users and roles are being loaded...</p>
            </div>
          </div>
        ) : (
          <>
            {/* EMPLOYEES TAB PANEL */}
            {activeTab === 'employees' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:max-w-xs px-4 py-2 rounded-lg border border-border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                  />
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => exportUsers(filteredUsers)}
                      className="flex items-center gap-1.5 border border-border text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer w-full sm:w-auto justify-center"
                    >
                      <Download size={14} />
                      Export Excel
                    </button>
                    {hasPermission('Users.Create') && (
                      <button
                        onClick={() => {
                          setEditingUser(null);
                          setShowPassword(false);
                          setUserForm({
                            name: '',
                            email: '',
                            phone: '',
                            role_id: roles[0]?.id || '',
                            branch_id: branches[0]?.id || '',
                            status: 'Active',
                            password: ''
                          });
                          setShowUserModal(true);
                        }}
                        className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all w-full sm:w-auto justify-center"
                      >
                        <Plus size={14} />
                        Add Employee
                      </button>
                    )}
                  </div>
                </div>

                {/* Employees Grid Card */}
                <div className="glass border border-border rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-secondary/40 border-b border-border text-muted-foreground text-xs uppercase font-semibold">
                        <tr>
                          <th className="px-6 py-4">Name & Contact</th>
                          <th className="px-6 py-4">Branch</th>
                          <th className="px-6 py-4">Access Role</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                              No employees found.
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map(u => (
                            <tr key={u.id} className="hover:bg-muted/25 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-semibold text-foreground">{u.name}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                                  <span className="flex items-center gap-1"><Mail size={12} /> {u.email}</span>
                                  {u.phone && <span className="flex items-center gap-1"><Phone size={12} /> {u.phone}</span>}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-muted-foreground">
                                {u.branch?.name || <span className="italic text-xs text-muted-foreground/60">No Branch</span>}
                              </td>
                              <td className="px-6 py-4">
                                <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5">
                                  <Shield size={12} />
                                  {u.role?.name || 'Staff'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  u.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  u.status === 'Suspended' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                  'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                                }`}>
                                  {u.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right space-x-1.5">
                                {hasPermission('Users.Update') && (
                                  <button
                                    onClick={() => {
                                      setEditingUser(u);
                                      setShowPassword(false);
                                      setUserForm({
                                        name: u.name,
                                        email: u.email,
                                        phone: u.phone || '',
                                        role_id: u.role_id,
                                        branch_id: u.branch_id,
                                        status: u.status,
                                        password: ''
                                      });
                                      setShowUserModal(true);
                                    }}
                                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-black inline-flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="Edit User"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                )}
                                {hasPermission('Users.Delete') && (
                                  <button
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 inline-flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="Delete User"
                                  >
                                    <Trash2 size={13} />
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

            {/* ROLES & PERMISSIONS MATRIX TAB PANEL */}
            {activeTab === 'roles' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 border border-border p-4 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Lock className="text-primary mt-0.5" size={16} />
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Granular RBAC Security Matrix</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Toggle checkboxes below to grant or revoke specific permissions in real-time. Super Admins bypass all restriction gates.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                    <button
                      onClick={() => exportRoles(roles, rolePermsMap, permissions)}
                      className="flex items-center gap-1.5 border border-border text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer w-full sm:w-auto justify-center"
                    >
                      <Download size={14} />
                      Export Excel
                    </button>
                    {hasPermission('Roles.Update') && (
                      <button
                        onClick={() => {
                          setRoleForm({ name: '', description: '' });
                          setShowRoleModal(true);
                        }}
                        className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all w-full sm:w-auto justify-center"
                      >
                        <Plus size={14} />
                        Add New Role
                      </button>
                    )}
                  </div>
                </div>

                {/* MATRIX GRID TABLE */}
                <div className="glass border border-border rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-secondary/40 border-b border-border text-muted-foreground text-xs uppercase font-semibold">
                        <tr>
                          <th className="px-6 py-4 min-w-[200px]">Permission Directive</th>
                          {roles.map(r => (
                            <th key={r.id} className="px-6 py-4 text-center">
                              {r.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {permissions.map(p => (
                          <tr key={p.id} className="hover:bg-muted/25 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-foreground text-xs">{p.name}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{p.description}</div>
                            </td>
                            {roles.map(r => {
                              const hasPerm = (rolePermsMap[r.id] || []).includes(p.id);
                              const isSuperAdmin = r.name === 'Super Admin' || r.name === 'Owner';
                              return (
                                <td key={r.id} className="px-6 py-4 text-center">
                                  <button
                                    onClick={() => handlePermissionToggle(r.id, p.id)}
                                    disabled={isSuperAdmin || !hasPermission('Roles.Update')}
                                    className={`inline-flex items-center justify-center p-1 rounded transition-colors ${
                                      isSuperAdmin
                                        ? 'text-primary opacity-60 cursor-not-allowed'
                                        : !hasPermission('Roles.Update')
                                        ? 'text-muted-foreground opacity-50 cursor-not-allowed'
                                        : 'text-muted-foreground hover:text-primary'
                                    }`}
                                  >
                                    {isSuperAdmin || hasPerm ? (
                                      <CheckSquare size={18} className="text-primary" />
                                    ) : (
                                      <Square size={18} />
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* BRANCHES TAB PANEL */}
            {activeTab === 'branches' && (
              <div className="space-y-4">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => exportBranches(branches)}
                    className="flex items-center gap-1.5 border border-border text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
                  >
                    <Download size={14} />
                    Export Excel
                  </button>
                  {hasPermission('Branches.Create') && (
                    <button
                      onClick={() => {
                        setEditingBranch(null);
                        setBranchForm({ name: '', address: '', phone: '', email: '' });
                        setShowBranchModal(true);
                      }}
                      className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all"
                    >
                      <Plus size={14} />
                      Add New Branch
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {branches.map(b => (
                    <div key={b.id} className="glass border border-border p-5 rounded-2xl flex flex-col justify-between space-y-4 shadow-md">
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-foreground text-lg">{b.name}</h3>
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase">
                            Operational
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{b.address || 'No Address Listed'}</p>
                      </div>

                      <div className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          <Phone size={12} className="text-primary" />
                          <span>Phone: {b.phone || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail size={12} className="text-primary" />
                          <span>Email: {b.email || 'N/A'}</span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        {hasPermission('Branches.Update') && (
                          <button
                            onClick={() => {
                              setEditingBranch(b);
                              setBranchForm({
                                name: b.name,
                                address: b.address || '',
                                phone: b.phone || '',
                                email: b.email || ''
                              });
                              setShowBranchModal(true);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Edit2 size={12} />
                            Edit
                          </button>
                        )}
                        {hasPermission('Branches.Delete') && (
                          <button
                            onClick={() => handleDeleteBranch(b.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 text-xs text-destructive hover:bg-destructive/20 transition-colors"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* EMPLOYEE ADD/EDIT MODAL */}
        {showUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="glass border border-border w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-bold text-foreground text-lg">{editingUser ? 'Edit Employee Details' : 'Register New Employee'}</h3>
                <button onClick={() => setShowUserModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {errorMsg && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-lg text-center font-medium">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleUserSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Employee Full Name *</label>
                  <input
                    type="text"
                    required
                    value={userForm.name}
                    onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">Work Email *</label>
                    <input
                      type="email"
                      required
                      value={userForm.email}
                      onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">Phone Number</label>
                    <input
                      type="text"
                      value={userForm.phone}
                      onChange={(e) => setUserForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground"
                    />
                  </div>
                </div>

                {/* Password Field with Show/Hide and Generator */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-muted-foreground font-semibold flex items-center gap-1.5">
                      <KeyRound size={12} className="text-primary" />
                      <span>{editingUser ? 'Change Password (Optional)' : 'Login Password *'}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const randomPass = 'Azizi@' + Math.floor(1000 + Math.random() * 9000);
                        setUserForm(prev => ({ ...prev, password: randomPass }));
                        setShowPassword(true);
                      }}
                      className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      ⚡ Auto Generate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!editingUser}
                      placeholder={editingUser ? 'Leave blank to keep existing password' : 'Enter login password (min 4 chars)'}
                      value={userForm.password}
                      onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full pl-3 pr-10 py-2 bg-muted/50 border border-border rounded-lg text-foreground font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-1"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {editingUser && (
                    <p className="text-[10px] text-muted-foreground italic">
                      Leave blank if you don't want to change this employee's current password.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">Access Role *</label>
                    <select
                      value={userForm.role_id}
                      onChange={(e) => setUserForm(prev => ({ ...prev, role_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground"
                    >
                      <option value="">Select Role</option>
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">Assigned Branch *</label>
                    <select
                      value={userForm.branch_id}
                      onChange={(e) => setUserForm(prev => ({ ...prev, branch_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground"
                    >
                      <option value="">Select Branch</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Employment Status</label>
                  <select
                    value={userForm.status}
                    onChange={(e) => setUserForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-popover border border-border rounded-lg text-foreground"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>

                {/* ROLE PERMISSION INFO BANNER */}
                {userForm.role_id && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-primary">
                        <Shield size={15} />
                        <span>Role: {roles.find(r => r.id === userForm.role_id)?.name}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {(rolePermsMap[userForm.role_id] || []).length} Granted Permissions
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5 max-h-[160px] overflow-y-auto">
                      {((rolePermsMap[userForm.role_id] || []).map(pId => permissions.find(p => p.id === pId)?.name).filter(Boolean) as string[]).map(pName => (
                        <span key={pName} className="text-[11px] bg-background px-2.5 py-1 rounded-md border border-border text-foreground font-medium shadow-2xs">
                          {pName}
                        </span>
                      ))}
                      {(rolePermsMap[userForm.role_id] || []).length === 0 && (
                        <span className="text-xs text-muted-foreground italic">No permissions assigned to this role yet. Configure in Roles tab.</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowUserModal(false)}
                    className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold"
                  >
                    {editingUser ? 'Save Changes' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* BRANCH ADD/EDIT MODAL */}
        {showBranchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass border border-border w-full max-w-md rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-bold text-foreground text-lg">{editingBranch ? 'Edit Branch Info' : 'Establish New Branch'}</h3>
                <button onClick={() => setShowBranchModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>

              {errorMsg && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-lg text-center font-medium">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleBranchSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Branch Name *</label>
                  <input
                    type="text"
                    required
                    value={branchForm.name}
                    onChange={(e) => setBranchForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Physical Address</label>
                  <textarea
                    value={branchForm.address}
                    onChange={(e) => setBranchForm(prev => ({ ...prev, address: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">Contact Email</label>
                    <input
                      type="email"
                      value={branchForm.email}
                      onChange={(e) => setBranchForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-muted-foreground font-semibold">Phone Helpline</label>
                    <input
                      type="text"
                      value={branchForm.phone}
                      onChange={(e) => setBranchForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowBranchModal(false)}
                    className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold"
                  >
                    {editingBranch ? 'Save Changes' : 'Create Branch'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ROLE ADD MODAL */}
        {showRoleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass border border-border w-full max-w-md rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-bold text-foreground text-lg">Create Custom Access Role</h3>
                <button onClick={() => setShowRoleModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>

              {errorMsg && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-lg text-center font-medium">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleRoleSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Role Name *</label>
                  <input
                    type="text"
                    required
                    value={roleForm.name}
                    onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground"
                    placeholder="E.g. Visa Processing Expert"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground font-semibold">Role Description</label>
                  <textarea
                    value={roleForm.description}
                    onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground resize-none"
                    placeholder="Specify target capabilities..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowRoleModal(false)}
                    className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold"
                  >
                    Create Role
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
