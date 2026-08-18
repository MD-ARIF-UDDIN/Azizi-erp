import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { db } from '../lib/db';
import {
  LayoutDashboard,
  Receipt,
  Users,
  Briefcase,
  TrendingDown,
  DollarSign,
  UserCheck,
  FileBarChart2,
  Settings,
  LogOut,
  Building,
  Shield,
  ChevronsUpDown,
  Check,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  Menu,
  X,
  Calendar
} from 'lucide-react';

import { Logo } from '../components/Logo';

/* ────────────── Sidebar Link (single item) ────────────── */

interface SidebarLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  permission?: string;
  badge?: number;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ to, icon, label, collapsed, permission, badge }) => {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  if (permission && !hasPermission(permission)) return null;

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-200 group relative font-bold ${
        isActive
          ? 'bg-primary text-white shadow-md'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
      }`}
    >
      <div className={`flex-shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
        {icon}
      </div>
      {!collapsed && <span>{label}</span>}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isActive ? 'bg-white text-primary' : 'bg-rose-500 text-white'}`}>
          {badge}
        </span>
      )}
      
      {collapsed && badge !== undefined && badge > 0 && (
        <span className="absolute top-1 right-1 bg-rose-500 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0">
          {badge}
        </span>
      )}
      
      {collapsed && (
        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-foreground text-white text-xs font-semibold rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-[60] whitespace-nowrap">
          {label}
        </div>
      )}
    </Link>
  );
};

/* ────────────── Sidebar Dropdown (expandable group) ────────────── */

interface SidebarDropdownProps {
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
  permission?: string;
  links: { to: string; label: string; permission?: string }[];
}

const SidebarDropdown: React.FC<SidebarDropdownProps> = ({ label, icon, collapsed, permission, links }) => {
  const location = useLocation();
  const { hasPermission } = useAuth();

  const [isOpen, setIsOpen] = useState(false);

  const allowedLinks = links.filter(link => !link.permission || hasPermission(link.permission));
  const isAllowed = !permission || hasPermission(permission);

  const isAnyActive = allowedLinks.some(link => {
    if (link.to === '/sales' || link.to === '/customers' || link.to === '/services' || link.to === '/expenses' || link.to === '/payments') {
      return location.pathname === link.to;
    }
    return location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to));
  });

  React.useEffect(() => {
    if (isAnyActive && !collapsed) setIsOpen(true);
  }, [location.pathname, collapsed, isAnyActive]);

  if (!isAllowed || allowedLinks.length === 0) return null;


  return (
    <div>
      <button
        onClick={() => { if (!collapsed) setIsOpen(!isOpen); }}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-bold transition-all duration-200 group relative ${
          isAnyActive && !isOpen
            ? 'bg-primary/5 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`flex-shrink-0 transition-transform duration-200 ${isAnyActive ? 'scale-110 text-primary' : 'group-hover:scale-105'}`}>
            {icon}
          </div>
          {!collapsed && <span>{label}</span>}
        </div>
        {!collapsed && (
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 opacity-50 ${isOpen ? 'rotate-180' : ''}`}
          />
        )}

        {collapsed && (
          <div className="absolute left-full ml-3 w-44 bg-card text-card-foreground text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-xl border border-border z-[60] p-1.5">
            <div className="font-bold px-2 py-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1">{label}</div>
            {allowedLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`block px-2 py-1.5 rounded-md transition-colors ${
                  location.pathname === link.to
                    ? 'bg-primary text-white font-bold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground font-bold'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </button>

      {!collapsed && isOpen && (
        <div className="ml-5 pl-3 border-l-2 border-border mt-1 space-y-0.5">
          {allowedLinks.map(link => {
            const isChildActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center px-2.5 py-1.5 rounded-md text-xs font-bold transition-all duration-200 ${
                  isChildActive
                    ? 'text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ────────────── Sidebar Section Heading ────────────── */

const SidebarSection: React.FC<{ label: string; collapsed: boolean }> = ({ label, collapsed }) => (
  !collapsed ? (
    <div className="px-3 pt-5 pb-1">
      <span className="text-[10px] uppercase tracking-wider font-black text-muted-foreground">{label}</span>
    </div>
  ) : <div className="pt-3" />
);

/* ════════════════════════ MAIN LAYOUT ════════════════════════ */

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    activeBranchId,
    setActiveBranchId,
    logout,
    isAdmin,
    availableBranches,
    allUsersList,
    login
  } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
  const [showBranchSwitcher, setShowBranchSwitcher] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [expiryCount, setExpiryCount] = useState(0);

  useEffect(() => {
    const fetchDocCount = async () => {
      try {
        const docs = await db.clientDocuments.getAll();
        const count = docs.filter(d => {
          const expiry = new Date(d.expiry_date);
          const today = new Date();
          expiry.setHours(0,0,0,0);
          today.setHours(0,0,0,0);
          const diff = expiry.getTime() - today.getTime();
          const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
          return days <= 60;
        }).length;
        setExpiryCount(count);
      } catch (err) {
        console.error(err);
      }
    };
    fetchDocCount();
  }, [location.pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleImpersonate = async (email: string) => {
    await login(email);
    setShowUserSwitcher(false);
    navigate('/');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const activeBranchName = activeBranchId === 'all'
    ? 'All Branches'
    : availableBranches.find(b => b.id === activeBranchId)?.name || 'Select Branch';

  const currentUserRoleName = allUsersList.find(u => u.id === user?.id)?.role?.name || 'User';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground relative">
      {/* Backdrop for mobile navigation drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ═══════ SIDEBAR ═══════ */}
      {(() => {
        const isCollapsedResponsive = collapsed && !mobileOpen;
        return (
          <aside
            className={`bg-card flex flex-col justify-between transition-all duration-300 z-50 border-r border-border fixed inset-y-0 left-0 md:static md:translate-x-0 ${
              mobileOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full md:translate-x-0'
            } ${isCollapsedResponsive ? 'md:w-[68px]' : 'md:w-[260px]'}`}
          >
            <div className="flex-1 flex flex-col min-h-0">
              {/* Logo */}
              <div className="flex h-16 items-center justify-between px-4 border-b border-border">
                {!isCollapsedResponsive ? (
                  <>
                    <div className="flex items-center gap-2.5">
                      <Logo size={32} />
                      <div>
                        <span className="font-bold text-sm text-foreground tracking-wide">AZIZI TYPING</span>
                        <div className="text-[9px] text-muted-foreground -mt-0.5">Stamp Making - ERP</div>
                      </div>
                    </div>
                    {/* Desktop Collapse Button */}
                    <button
                      onClick={() => setCollapsed(true)}
                      className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all md:block hidden"
                      title="Collapse Sidebar"
                    >
                      <PanelLeftClose size={16} />
                    </button>
                    {/* Mobile Close Button */}
                    <button
                      onClick={() => setMobileOpen(false)}
                      className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all md:hidden block"
                      title="Close Navigation"
                    >
                      <X size={18} />
                    </button>
                  </>
                ) : (
                  <div className="w-full flex justify-center py-1 md:block hidden">
                    <button
                      onClick={() => setCollapsed(false)}
                      className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all"
                      title="Expand Sidebar"
                    >
                      <PanelLeft size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <nav className="flex-1 space-y-0.5 px-3 py-3 overflow-y-auto">
                <SidebarLink to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" collapsed={isCollapsedResponsive} />

                <SidebarSection label="Business" collapsed={isCollapsedResponsive} />

                <SidebarDropdown
                  label="eSales"
                  icon={<Receipt size={18} />}
                  collapsed={isCollapsedResponsive}
                  permission="Sales.View"
                  links={[
                    { to: '/sales', label: 'List', permission: 'Sales.View' },
                    { to: '/sales/create', label: 'Create', permission: 'Sales.Create' }
                  ]}
                />
            <SidebarDropdown
              label="eCustomers"
              icon={<Users size={18} />}
              collapsed={isCollapsedResponsive}
              permission="Customer.View"
              links={[
                { to: '/customers', label: 'List', permission: 'Customer.View' },
                { to: '/customers/create', label: 'Create', permission: 'Customer.Create' }
              ]}
            />

            <SidebarDropdown
              label="eServices"
              icon={<Briefcase size={18} />}
              collapsed={isCollapsedResponsive}
              permission="Customer.View"
              links={[
                { to: '/services', label: 'List', permission: 'Customer.View' },
                { to: '/services/create', label: 'Create', permission: 'Customer.Create' },
                { to: '/services/category/create', label: 'Create Category', permission: 'Customer.Create' }
              ]}
            />

            <SidebarSection label="Finance" collapsed={isCollapsedResponsive} />

            <SidebarDropdown
              label="eExpenses"
              icon={<TrendingDown size={18} />}
              collapsed={isCollapsedResponsive}
              permission="Expenses.View"
              links={[
                { to: '/expenses', label: 'List', permission: 'Expenses.View' },
                { to: '/expenses/create', label: 'Create', permission: 'Expenses.Create' },
                { to: '/expenses/category/create', label: 'Create Category', permission: 'Expenses.Create' }
              ]}
            />

            <SidebarDropdown
              label="ePayments"
              icon={<DollarSign size={18} />}
              collapsed={isCollapsedResponsive}
              permission="Payments.View"
              links={[
                { to: '/payments', label: 'List', permission: 'Payments.View' },
                { to: '/payments/create', label: 'Create', permission: 'Payments.Create' }
              ]}
            />

            <SidebarSection label="Administration" collapsed={isCollapsedResponsive} />

            <SidebarLink to="/rbac" icon={<UserCheck size={18} />} label="Users & Roles" collapsed={isCollapsedResponsive} permission="Users.View" />
            <SidebarLink to="/expiry-tracker" icon={<Calendar size={18} />} label="Expiry Tracker" collapsed={isCollapsedResponsive} permission="Sales.View" badge={expiryCount > 0 ? expiryCount : undefined} />
            <SidebarLink to="/reports" icon={<FileBarChart2 size={18} />} label="Reports" collapsed={isCollapsedResponsive} permission="Reports.View" />
            <SidebarDropdown
              label="Settings"
              icon={<Settings size={18} />}
              collapsed={isCollapsedResponsive}
              permission="Settings.Update"
              links={[
                { to: '/settings?tab=company', label: 'Company Settings', permission: 'Settings.Update' },
                { to: '/settings?tab=branches', label: 'Branch Settings', permission: 'Settings.Update' }
              ]}
            />
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-destructive/70 hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors group relative text-[13px]"
          >
            <LogOut size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            {!isCollapsedResponsive && <span className="font-medium">Log Out</span>}
            {isCollapsedResponsive && (
              <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-foreground text-white text-xs font-medium rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-[60] whitespace-nowrap">
                Log Out
              </div>
            )}
          </button>
        </div>
      </aside>
        );
      })()}

      {/* ═══════ MAIN CONTENT ═══════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6 z-20 bg-card">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all md:hidden block"
              title="Open Navigation"
            >
              <Menu size={20} />
            </button>
            <span className="text-muted-foreground text-sm hidden md:inline">
              Welcome, <strong className="text-foreground font-semibold">{user?.name}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Branch Selector */}
            <div className="relative">
              <button
                onClick={() => setShowBranchSwitcher(!showBranchSwitcher)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-all ${
                  !isAdmin ? 'opacity-75 cursor-not-allowed' : ''
                }`}
                disabled={!isAdmin}
              >
                <Building size={15} className="text-primary" />
                <span className="font-medium text-xs max-w-[120px] truncate">{activeBranchName}</span>
                {isAdmin && <ChevronsUpDown size={13} className="text-muted-foreground" />}
              </button>

              {showBranchSwitcher && isAdmin && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowBranchSwitcher(false)} />
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-xl z-50 p-1.5">
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Branch View</div>
                    <button
                      onClick={() => { setActiveBranchId('all'); setShowBranchSwitcher(false); }}
                      className="w-full text-left flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
                    >
                      <span>All Branches</span>
                      {activeBranchId === 'all' && <Check size={14} className="text-primary" />}
                    </button>
                    {availableBranches.map(b => (
                      <button
                        key={b.id}
                        onClick={() => { setActiveBranchId(b.id); setShowBranchSwitcher(false); }}
                        className="w-full text-left flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
                      >
                        <span className="truncate">{b.name}</span>
                        {activeBranchId === b.id && <Check size={14} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Session Impersonator */}
            <div className="relative">
              <button
                onClick={() => setShowUserSwitcher(!showUserSwitcher)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-sm transition-all"
              >
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs uppercase">
                  {user?.name.charAt(0)}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="font-semibold text-xs leading-none">{user?.name}</div>
                  <div className="text-[10px] text-muted-foreground leading-none mt-0.5">{currentUserRoleName}</div>
                </div>
                <ChevronsUpDown size={13} className="text-muted-foreground" />
              </button>

              {showUserSwitcher && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserSwitcher(false)} />
                  <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card shadow-xl z-50 p-2">
                    <div className="px-2 py-1 border-b border-border pb-2 mb-2">
                      <div className="font-semibold text-sm flex items-center gap-1.5">
                        <Shield size={14} className="text-primary" />
                        Role Impersonator
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Switch identities to test permissions.
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      {allUsersList.map(u => {
                        const isCurrent = u.id === user?.id;
                        return (
                          <button
                            key={u.id}
                            onClick={() => handleImpersonate(u.email)}
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-accent transition-colors flex items-center justify-between ${
                              isCurrent ? 'bg-accent font-semibold text-primary' : ''
                            }`}
                          >
                            <div>
                              <div>{u.name}</div>
                              <div className="text-[10px] text-muted-foreground">{u.role?.name} • {u.branch?.name}</div>
                            </div>
                            {isCurrent && <Check size={12} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
          <div className="mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
