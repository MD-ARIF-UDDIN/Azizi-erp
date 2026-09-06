import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../lib/db';
import type { Account } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import { useAuth } from '../../components/AuthProvider';
import { TransactionConfirmModal, type ConfirmDetailItem } from '../../components/TransactionConfirmModal';
import {
  CreditCard,
  Wallet,
  Building2,
  Plus,
  ArrowRightLeft,
  Search,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  BookOpen
} from 'lucide-react';

export const AccountList: React.FC = () => {
  const { activeBranchId } = useAuth();
  
  // Data States
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'card' | 'cash_drawer' | 'bank'>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form: Create / Edit Account
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<Account['type']>('card');
  const [formBankName, setFormBankName] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formBalance, setFormBalance] = useState<number>(0);
  const [formSaving, setFormSaving] = useState(false);

  // Form: Top-Up / Transfer
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferNotes, setTransferNotes] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const accs = await db.accounts.getAll();
      setAccounts(accs);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeBranchId]);

  // Open Add / Edit Modal
  const openAddModal = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      setFormName(account.name);
      setFormType(account.type);
      setFormBankName(account.bank_name || '');
      setFormAccountNumber(account.account_number || '');
      setFormBalance(account.balance);
    } else {
      setEditingAccount(null);
      setFormName('');
      setFormType('card');
      setFormBankName('');
      setFormAccountNumber('');
      setFormBalance(0);
    }
    setModalError('');
    setShowAddModal(true);
  };

  // Open Top-Up Modal
  const openTopUpModal = (preselectedToId?: string) => {
    let toId = preselectedToId;
    let fromId = '';

    const drawer = accounts.find(a => a.type === 'cash_drawer');
    const firstNonDrawer = accounts.find(a => a.id !== drawer?.id);

    if (toId) {
      // If destination is preselected, default fromId to cash drawer or another account that isn't toId
      fromId = (toId === drawer?.id ? firstNonDrawer?.id : drawer?.id) || '';
    } else {
      // If nothing preselected, default fromId to drawer and toId to first non-drawer card
      fromId = drawer?.id || accounts[0]?.id || '';
      toId = firstNonDrawer?.id || accounts.find(a => a.id !== fromId)?.id || '';
    }

    setTransferFromId(fromId);
    setTransferToId(toId || '');
    setTransferAmount(0);
    setTransferNotes('');
    setModalError('');
    setShowTopUpModal(true);
  };

  const handleTransferFromChange = (newFromId: string) => {
    setTransferFromId(newFromId);
    if (newFromId && newFromId === transferToId) {
      // Automatically shift destination to another account
      const otherAcc = accounts.find(a => a.id !== newFromId);
      setTransferToId(otherAcc?.id || '');
    }
  };

  const handleTransferToChange = (newToId: string) => {
    setTransferToId(newToId);
    if (newToId && newToId === transferFromId) {
      // Automatically shift source to another account
      const otherFrom = accounts.find(a => a.id !== newToId);
      setTransferFromId(otherFrom?.id || '');
    }
  };

  // Handle Save Account
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setModalError('Account / Card name is required.');
      return;
    }
    setFormSaving(true);
    try {
      if (editingAccount) {
        await db.accounts.update(editingAccount.id, {
          name: formName.trim(),
          type: formType,
          bank_name: formBankName.trim() || undefined,
          account_number: formAccountNumber.trim() || undefined,
          balance: Number(formBalance)
        });
      } else {
        await db.accounts.create({
          name: formName.trim(),
          type: formType,
          bank_name: formBankName.trim() || undefined,
          account_number: formAccountNumber.trim() || undefined,
          balance: Number(formBalance),
          is_active: true,
          branch_id: activeBranchId === 'all' ? undefined : activeBranchId
        });
      }
      setShowAddModal(false);
      await fetchData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save account.');
    } finally {
      setFormSaving(false);
    }
  };

  const [showConfirmTransferModal, setShowConfirmTransferModal] = useState(false);

  // Handle Top-Up / Transfer Step 1: Validation & Open Confirmation Modal
  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferToId) {
      setModalError('Please select a destination account/card.');
      return;
    }
    if (transferFromId && transferFromId === transferToId) {
      setModalError('Source and destination accounts cannot be the same. Please choose different accounts.');
      return;
    }
    if (Number(transferAmount) <= 0) {
      setModalError('Please enter a valid amount greater than 0.');
      return;
    }

    setModalError('');
    setShowConfirmTransferModal(true);
  };

  // Handle Top-Up / Transfer Step 2: Confirmed Execution
  const handleExecuteTransfer = async () => {
    setTransferSaving(true);
    try {
      await db.accounts.topUp({
        target_account_id: transferToId,
        amount: Number(transferAmount),
        source_account_id: transferFromId || undefined,
        notes: transferNotes.trim() || undefined
      });
      setShowConfirmTransferModal(false);
      setShowTopUpModal(false);
      await fetchData();
    } catch (err: any) {
      setShowConfirmTransferModal(false);
      setModalError(err.message || 'Failed to complete transfer.');
    } finally {
      setTransferSaving(false);
    }
  };

  // Handle Delete
  const handleDeleteAccount = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove "${name}"?`)) {
      await db.accounts.delete(id);
      await fetchData();
    }
  };

  // Filtered Accounts
  const filteredAccounts = accounts.filter(a => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.bank_name?.toLowerCase().includes(q) ||
      a.account_number?.includes(q)
    );
  });

  const totalFilteredBalance = filteredAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  return (
    <PermissionGuard permission="Expenses.View" fallback="ui">
      <div className="space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Wallets &amp; Cards</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground m-0">Cards &amp; Accounts</h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/journal"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <BookOpen size={14} />
              <span>Cash Journal</span>
            </Link>

            <button
              type="button"
              onClick={() => openTopUpModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-secondary/80 hover:bg-secondary border border-border rounded-lg text-xs font-bold text-foreground transition-all cursor-pointer shadow-xs"
            >
              <ArrowRightLeft size={14} className="text-primary" />
              <span>Transfer / Top-Up</span>
            </button>

            <button
              type="button"
              onClick={() => openAddModal()}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <Plus size={15} />
              <span>Add Account / Card</span>
            </button>
          </div>
        </div>

        {/* TOOLBAR FILTERS */}
        <div className="flex flex-col lg:flex-row gap-3 bg-muted/30 p-3 rounded-xl border border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search by card name, bank, provider, account number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 bg-popover border border-border rounded-lg text-xs text-foreground font-semibold cursor-pointer"
            >
              <option value="all">All Account Types</option>
              <option value="card">Portal Cards (ICP, Amer, etc.)</option>
              <option value="cash_drawer">Cash Drawers</option>
              <option value="bank">Bank Accounts</option>
            </select>

            {(search || typeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setTypeFilter('all');
                }}
                className="px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg transition-all cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* MAIN TABLE (SAME STANDARD STRUCTURE AS SALES & CUSTOMERS) */}
        <div className="w-full">
          <div className="w-full space-y-4">
            {loading ? (
              <div className="table-container p-12 text-center bg-card border border-border rounded-xl">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold tracking-wider uppercase text-primary animate-pulse">Loading...</span>
                  <p className="text-[11px] text-muted-foreground font-medium">Please wait while accounts and cards are being loaded...</p>
                </div>
              </div>
            ) : (
              <div className="table-container">
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th className="text-center" style={{ width: '45px' }}>SL</th>
                        <th>Account / Card Name</th>
                        <th>Account Type</th>
                        <th>Bank / Provider</th>
                        <th>Card / Account #</th>
                        <th className="text-right">Available Balance</th>
                        <th className="text-center" style={{ width: '160px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500">
                            <div className="max-w-xs mx-auto space-y-1">
                              <div className="font-bold text-black text-sm font-heading">No accounts found</div>
                              <div className="text-xs text-slate-500">Click "Add Account / Card" to register your first card or cash drawer.</div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredAccounts.map((account, idx) => {
                          const isCard = account.type === 'card';
                          const isDrawer = account.type === 'cash_drawer';
                          const typeLabel = isDrawer ? 'Cash Drawer' : isCard ? 'Portal Card' : 'Bank Account';

                          return (
                            <tr key={account.id} className="transition-colors hover:bg-muted/30">
                              
                              {/* Serial */}
                              <td className="text-center font-semibold text-xs text-slate-500">
                                {idx + 1}
                              </td>

                              {/* Name */}
                              <td>
                                <div className="font-bold text-black text-xs flex items-center gap-1.5">
                                  {isDrawer ? (
                                    <Wallet size={14} className="text-primary shrink-0" />
                                  ) : isCard ? (
                                    <CreditCard size={14} className="text-primary shrink-0" />
                                  ) : (
                                    <Building2 size={14} className="text-primary shrink-0" />
                                  )}
                                  <span>{account.name}</span>
                                </div>
                              </td>

                              {/* Type */}
                              <td>
                                <span className="text-xs text-slate-600 font-medium">
                                  {typeLabel}
                                </span>
                              </td>

                              {/* Bank / Provider */}
                              <td>
                                <span className="text-xs text-slate-600 font-medium">
                                  {account.bank_name || '—'}
                                </span>
                              </td>

                              {/* Account / Card # */}
                              <td>
                                <span className="font-mono text-xs text-slate-600">
                                  {account.account_number ? `•••• ${account.account_number.slice(-4)}` : '—'}
                                </span>
                              </td>

                              {/* Available Balance */}
                              <td className="text-right font-mono font-bold text-xs text-black">
                                {Number(account.balance).toFixed(2)} AED
                              </td>

                              {/* Actions */}
                              <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openTopUpModal(account.id)}
                                    className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="Top-Up / Transfer Funds"
                                  >
                                    <ArrowRightLeft size={13} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => openAddModal(account)}
                                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-black flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="Edit Account"
                                  >
                                    <Edit2 size={13} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAccount(account.id, account.name)}
                                    className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="Delete Account"
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
                    {filteredAccounts.length > 0 && (
                      <tfoot>
                        <tr>
                          <td colSpan={5} className="font-bold text-xs text-black uppercase">
                            Total ({filteredAccounts.length} accounts / cards)
                          </td>
                          <td className="text-right font-mono font-bold text-xs text-black">
                            {totalFilteredBalance.toFixed(2)} AED
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODAL: ADD / EDIT ACCOUNT */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm m-0">
                      {editingAccount ? 'Edit Card / Account' : 'Add New Card / Account'}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleSaveAccount} className="space-y-3.5">
                {/* Account Type */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Account / Wallet Type *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormType('card')}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        formType === 'card'
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      <CreditCard size={14} />
                      <span>Portal Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormType('cash_drawer')}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        formType === 'cash_drawer'
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      <Wallet size={14} />
                      <span>Cash Drawer</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormType('bank')}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        formType === 'bank'
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      <Building2 size={14} />
                      <span>Bank Account</span>
                    </button>
                  </div>
                </div>

                {/* Account Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Card / Account Name *</label>
                  <input
                    type="text"
                    required
                    placeholder={formType === 'card' ? 'E.g. ICP E-Dirham Card or Amer Card' : formType === 'cash_drawer' ? 'E.g. Cash Drawer' : 'Company ENBD Checking'}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground outline-none focus:border-primary"
                  />
                </div>

                {/* Bank / Provider & Card Number */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground">Bank / Provider</label>
                    <input
                      type="text"
                      placeholder="E.g. FAB Bank / ENBD"
                      value={formBankName}
                      onChange={(e) => setFormBankName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground">Last 4 Digits / Acc #</label>
                    <input
                      type="text"
                      placeholder="E.g. 7829"
                      value={formAccountNumber}
                      onChange={(e) => setFormAccountNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Opening Balance */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    {editingAccount ? 'Current Balance (AED)' : 'Opening Balance (AED)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formBalance}
                    onChange={(e) => setFormBalance(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-bold font-mono text-foreground outline-none focus:border-primary"
                  />
                </div>

                {/* Submit buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSaving}
                    className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    {formSaving ? 'Saving...' : editingAccount ? 'Save Changes' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: TOP-UP / TRANSFER FUNDS */}
        {showTopUpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <ArrowRightLeft size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm m-0">Top-Up / Transfer Balance</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTopUpModal(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleTransfer} className="space-y-3.5">
                {/* From Account */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">From Account (Source)</label>
                  <select
                    value={transferFromId}
                    onChange={(e) => handleTransferFromChange(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">-- Direct External Deposit (No source deduction) --</option>
                    {accounts.map(a => (
                      <option 
                        key={a.id} 
                        value={a.id}
                        disabled={a.id === transferToId}
                      >
                        {a.name} (Bal: {Number(a.balance).toFixed(2)} AED){a.id === transferToId ? ' — [Destination]' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Select "Cash Drawer" if taking physical cash to deposit into card.
                  </p>
                </div>

                {/* To Account */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">To Account / Card (Destination) *</label>
                  <select
                    required
                    value={transferToId}
                    onChange={(e) => handleTransferToChange(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">-- Select Destination Card/Account --</option>
                    {accounts.map(a => (
                      <option 
                        key={a.id} 
                        value={a.id}
                        disabled={a.id === transferFromId}
                      >
                        💳 {a.name} (Current Bal: {Number(a.balance).toFixed(2)} AED){a.id === transferFromId ? ' — [Source Account]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Transfer Amount (AED) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      placeholder="0.00"
                      value={transferAmount || ''}
                      onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)}
                      className="w-full pl-3 pr-12 py-2.5 bg-background border border-border rounded-xl text-sm font-black font-mono text-primary outline-none focus:border-primary"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      AED
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Reference / Notes</label>
                  <input
                    type="text"
                    placeholder="E.g. CDM deposit receipt #9910"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground outline-none focus:border-primary"
                  />
                </div>

                {/* Submit buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
                  <button
                    type="button"
                    onClick={() => setShowTopUpModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRightLeft size={14} />
                    <span>Proceed with Transfer</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CONFIRMATION MODAL FOR ACCOUNT TOP-UP / TRANSFER */}
        {(() => {
          const fromAcc = accounts.find(a => a.id === transferFromId);
          const targetAcc = accounts.find(a => a.id === transferToId);
          const amt = Number(transferAmount) || 0;

          if (!targetAcc) return null;

          const details: ConfirmDetailItem[] = [];
          if (transferNotes.trim()) {
            details.push({
              label: 'Note / Ref',
              value: transferNotes.trim()
            });
          }

          return (
            <TransactionConfirmModal
              isOpen={showConfirmTransferModal}
              onClose={() => setShowConfirmTransferModal(false)}
              onConfirm={handleExecuteTransfer}
              type="transfer"
              title="Confirm Transfer"
              subtitle="Please check the accounts and balances below."
              amount={amt}
              currency="AED"
              confirmText="Confirm Transfer"
              cancelText="Back to Edit"
              loading={transferSaving}
              transferFlow={{
                fromAccountName: fromAcc?.name,
                fromCurrentBalance: fromAcc ? Number(fromAcc.balance) : undefined,
                fromNewBalance: fromAcc ? Number(fromAcc.balance) - amt : undefined,
                toAccountName: targetAcc.name,
                toCurrentBalance: Number(targetAcc.balance),
                toNewBalance: Number(targetAcc.balance) + amt
              }}
              details={details}
            />
          );
        })()}

      </div>
    </PermissionGuard>
  );
};
