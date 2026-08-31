import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import type { JournalEntry, User } from '../../types/database';
import { PermissionGuard } from '../../components/PermissionGuard';
import {
  BookOpen,
  Search,
  Calendar,
  User as UserIcon,
  Building,
  CreditCard,
  Wallet
} from 'lucide-react';

export const JournalList: React.FC = () => {
  // Data States
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'cash_in' | 'cash_out'>('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchJournal = async () => {
    setLoading(true);
    try {
      const [jData, uData] = await Promise.all([
        db.journal.getAll({
          entry_type: typeFilter !== 'all' ? typeFilter : undefined,
          performed_by: staffFilter !== 'all' ? staffFilter : undefined,
          from_date: fromDate ? new Date(fromDate).toISOString() : undefined,
          to_date: toDate ? new Date(`${toDate}T23:59:59`).toISOString() : undefined
        }),
        db.users.getAll()
      ]);
      setEntries(jData);
      setUsers(uData);
    } catch (err) {
      console.error('Failed to load journal entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournal();
  }, [typeFilter, staffFilter, fromDate, toDate]);

  // Filtered Entries by client-side text search
  const filteredEntries = entries.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.from_account?.toLowerCase().includes(q) ||
      e.to_account?.toLowerCase().includes(q) ||
      e.reference_no?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.creator?.name?.toLowerCase().includes(q)
    );
  });

  // Dynamic Calculations on Filtered Data
  const totalCashIn = filteredEntries
    .filter(e => e.entry_type === 'cash_in')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const totalCashOut = filteredEntries
    .filter(e => e.entry_type === 'cash_out')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const netCashflow = totalCashIn - totalCashOut;

  return (
    <PermissionGuard permission="Expenses.View" fallback="ui">
      <div className="space-y-4">
        
        {/* COMPACT HEADER */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <BookOpen size={20} />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-foreground m-0">
              Cash In &amp; Out Journal
            </h1>
          </div>
        </div>

        {/* COMPACT SINGLE-ROW FILTER TOOLBAR */}
        <div className="bg-card border border-border/80 p-2.5 rounded-xl shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
              <input
                type="text"
                placeholder="Search company, employee, invoice #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-muted/40 border border-border rounded-lg text-xs font-medium text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Entry Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-muted/40 border border-border rounded-lg text-xs font-semibold text-foreground cursor-pointer focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Flow Types</option>
              <option value="cash_in">🟢 Cash In</option>
              <option value="cash_out">🔴 Cash Out</option>
            </select>

            {/* Staff Filter */}
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-muted/40 border border-border rounded-lg text-xs font-semibold text-foreground cursor-pointer focus:ring-1 focus:ring-primary max-w-[170px] truncate"
            >
              <option value="all">All Staff</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  👤 {u.name}
                </option>
              ))}
            </select>

            {/* Date Range Inline */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-lg border border-border">
              <Calendar size={12} className="text-primary" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent border-0 text-xs font-medium text-foreground focus:ring-0 p-0"
              />
              <span className="text-[10px] text-muted-foreground">-</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent border-0 text-xs font-medium text-foreground focus:ring-0 p-0"
              />
            </div>

            {/* Reset */}
            {(search || typeFilter !== 'all' || staffFilter !== 'all' || fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setTypeFilter('all');
                  setStaffFilter('all');
                  setFromDate('');
                  setToDate('');
                }}
                className="text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer px-2.5 py-1.5 bg-muted/40 hover:bg-muted rounded-lg transition-all"
              >
                Reset
              </button>
            )}

          </div>
        </div>

        {/* JOURNAL ENTRIES TABLE */}
        <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-2xs space-y-0">
          <div className="px-4 py-3 border-b border-border/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-primary" />
              <h2 className="text-xs font-bold text-foreground m-0">
                Journal Audit Log ({filteredEntries.length})
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3">From (Payer / Account)</th>
                  <th className="px-4 py-3">To (Payee / Account)</th>
                  <th className="px-4 py-3">Reference / Invoice #</th>
                  <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">Cash In (AED)</th>
                  <th className="px-4 py-3 text-right text-rose-600 dark:text-rose-400">Cash Out (AED)</th>
                  <th className="px-4 py-3">Done By (Staff)</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-foreground">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <span>Loading journal ledger records...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      <div className="max-w-xs mx-auto space-y-1">
                        <div className="font-bold text-foreground text-sm">No journal records found</div>
                        <div className="text-xs text-muted-foreground">No transactions match your current search or date parameters.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((j) => {
                    const isCashIn = j.entry_type === 'cash_in';
                    const staffName = j.creator?.name || 'Staff';

                    return (
                      <tr key={j.id} className="hover:bg-muted/30 transition-colors">
                        
                        {/* 1. Date */}
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                          <div>{new Date(j.entry_date).toLocaleDateString()}</div>
                          <div className="text-[10px] opacity-75">{new Date(j.entry_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>

                        {/* 2. From Account / Company */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {isCashIn ? (
                              <Building size={13} className="text-primary shrink-0" />
                            ) : (
                              <CreditCard size={13} className="text-amber-500 shrink-0" />
                            )}
                            <span className="font-bold text-foreground text-xs leading-tight">
                              {j.from_account}
                            </span>
                          </div>
                        </td>

                        {/* 3. To Account / Payee */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {isCashIn ? (
                              <Wallet size={13} className="text-emerald-500 shrink-0" />
                            ) : (
                              <UserIcon size={13} className="text-rose-500 shrink-0" />
                            )}
                            <span className="font-bold text-foreground text-xs leading-tight">
                              {j.to_account}
                            </span>
                          </div>
                        </td>

                        {/* 4. Reference / Invoice # */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {j.reference_no ? (
                            <span className="px-2 py-0.5 rounded bg-muted font-mono font-bold text-[11px] text-foreground border border-border">
                              {j.reference_no}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>

                        {/* 5. Cash In Column (Green or -) */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {isCashIn ? (
                            <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                              +{Number(j.amount).toFixed(2)} AED
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 font-mono text-xs">—</span>
                          )}
                        </td>

                        {/* 6. Cash Out Column (Red or -) */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {!isCashIn ? (
                            <span className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                              -{Number(j.amount).toFixed(2)} AED
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 font-mono text-xs">—</span>
                          )}
                        </td>

                        {/* 7. Done By (Staff) */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                              {staffName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-foreground text-xs">
                              {staffName}
                            </span>
                          </div>
                        </td>

                        {/* 8. Description */}
                        <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground text-[11px]" title={j.description}>
                          {j.description || '—'}
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredEntries.length > 0 && (
                <tfoot className="bg-muted/70 text-foreground font-bold border-t-2 border-border text-xs">
                  <tr>
                    <td colSpan={4} className="px-4 py-3">
                      <span className="uppercase tracking-wider text-[11px] text-muted-foreground font-extrabold">
                        Total ({filteredEntries.length} entries)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">
                      +{totalCashIn.toFixed(2)} AED
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-black text-xs text-rose-600 dark:text-rose-400">
                      -{totalCashOut.toFixed(2)} AED
                    </td>
                    <td colSpan={2} className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <span className="text-muted-foreground">Net:</span>
                        <span className={`font-mono font-bold ${netCashflow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {netCashflow >= 0 ? `+${netCashflow.toFixed(2)}` : `${netCashflow.toFixed(2)}`} AED
                        </span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>
    </PermissionGuard>
  );
};
