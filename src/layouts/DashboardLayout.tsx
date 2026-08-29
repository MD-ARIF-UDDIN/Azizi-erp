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
  Calendar,
  FileText,
  Search,
  Plus,
  Clock
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
    if (link.to === '/sales' || link.to === '/quotations' || link.to === '/customers' || link.to === '/services' || link.to === '/expenses' || link.to === '/payments') {
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
  
  // Command Palette State
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteResults, setPaletteResults] = useState<{ customers: any[]; services: any[]; sales: any[] }>({
    customers: [],
    services: [],
    sales: []
  });
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  const navigate = useNavigate();
  const location = useLocation();

  const [expiryCount, setExpiryCount] = useState(0);

  // Live Clock Tick
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Global Keyboard Shortcuts (F2: New Invoice, F4: Invoices, Ctrl+K: Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input/textarea (except Ctrl+K and Escape)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      } else if (!isInput) {
        if (e.key === 'F2') {
          e.preventDefault();
          navigate('/sales/create');
        } else if (e.key === 'F4') {
          e.preventDefault();
          navigate('/sales');
        } else if (e.key === 'F8') {
          e.preventDefault();
          navigate('/customers');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Command Palette Search Handler
  useEffect(() => {
    if (!commandPaletteOpen || !paletteQuery.trim()) {
      setPaletteResults({ customers: [], services: [], sales: [] });
      return;
    }

    const searchMaster = async () => {
      try {
        const q = paletteQuery.toLowerCase();
        const [cList, sList, salesList] = await Promise.all([
          db.customers.getAll(),
          db.services.getAll(),
          db.sales.getAll()
        ]);

        const matchedCustomers = cList.filter(c => 
          c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
        ).slice(0, 4);

        const matchedServices = sList.filter(s =>
          s.name.toLowerCase().includes(q)
        ).slice(0, 4);

        const matchedSales = salesList.filter(s =>
          s.invoice_no.toLowerCase().includes(q) ||
          (s.customer && s.customer.name.toLowerCase().includes(q))
        ).slice(0, 4);

        setPaletteResults({
          customers: matchedCustomers,
          services: matchedServices,
          sales: matchedSales
        });
      } catch (err) {
        console.error(err);
      }
    };

    const debounce = setTimeout(searchMaster, 150);
    return () => clearTimeout(debounce);
  }, [paletteQuery, commandPaletteOpen]);

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

                <SidebarDropdown
                  label="eQuotations"
                  icon={<FileText size={18} />}
                  collapsed={isCollapsedResponsive}
                  permission="Sales.View"
                  links={[
                    { to: '/quotations', label: 'List', permission: 'Sales.View' },
                    { to: '/quotations/create', label: 'Create', permission: 'Sales.Create' }
                  ]}
                />

                <SidebarDropdown
                  label="Invoices"
                  icon={<Receipt size={18} />}
                  collapsed={isCollapsedResponsive}
                  permission="Sales.View"
                  links={[
                    { to: '/sales', label: 'List', permission: 'Sales.View' },
                    { to: '/sales/create', label: 'Create', permission: 'Sales.Create' }
                  ]}
                />

                <SidebarSection label="Finance" collapsed={isCollapsedResponsive} />

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
                { to: '/settings?tab=branches', label: 'Branch Settings', permission: 'Settings.Update' },
                { to: '/settings?tab=terms', label: 'Terms & Conditions', permission: 'Settings.Update' }
              ]}
            />
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border space-y-2">
          {/* Branch Selector (Sidebar version) */}
          {!isCollapsedResponsive && (
            <div className="relative w-full">
              <button
                onClick={() => { setShowBranchSwitcher(!showBranchSwitcher); setShowUserSwitcher(false); }}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-border bg-muted/20 hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer ${
                  !isAdmin ? 'opacity-75 cursor-not-allowed' : ''
                }`}
                disabled={!isAdmin}
              >
                <div className="flex items-center gap-2 truncate">
                  <Building size={14} className="text-primary shrink-0" />
                  <span className="truncate">{activeBranchName}</span>
                </div>
                {isAdmin && <ChevronsUpDown size={12} className="text-muted-foreground shrink-0" />}
              </button>

              {showBranchSwitcher && isAdmin && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowBranchSwitcher(false)} />
                  <div className="absolute left-0 bottom-full mb-2 w-56 rounded-xl border border-border bg-card shadow-xl z-50 p-1.5">
                    <div className="px-2 py-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Branch View</div>
                    <button
                      onClick={() => { setActiveBranchId('all'); setShowBranchSwitcher(false); }}
                      className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-accent transition-colors font-medium text-foreground cursor-pointer"
                    >
                      <span>All Branches</span>
                      {activeBranchId === 'all' && <Check size={12} className="text-primary" />}
                    </button>
                    {availableBranches.map(b => (
                      <button
                        key={b.id}
                        onClick={() => { setActiveBranchId(b.id); setShowBranchSwitcher(false); }}
                        className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-accent transition-colors font-medium text-foreground cursor-pointer"
                      >
                        <span className="truncate">{b.name}</span>
                        {activeBranchId === b.id && <Check size={12} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* User Impersonator (Sidebar version) */}
          <div className="relative w-full">
            <button
              onClick={() => { setShowUserSwitcher(!showUserSwitcher); setShowBranchSwitcher(false); }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-border bg-muted/20 hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px] uppercase shrink-0">
                  {user?.name.charAt(0)}
                </div>
                {!isCollapsedResponsive && (
                  <div className="text-left truncate">
                    <div className="font-bold text-[11px] leading-none truncate">{user?.name}</div>
                    <div className="text-[9px] text-muted-foreground leading-none mt-0.5 truncate">{currentUserRoleName}</div>
                  </div>
                )}
              </div>
              {!isCollapsedResponsive && <ChevronsUpDown size={12} className="text-muted-foreground shrink-0" />}
            </button>

            {showUserSwitcher && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserSwitcher(false)} />
                <div className="absolute left-0 bottom-full mb-2 w-60 rounded-xl border border-border bg-card shadow-xl z-50 p-2">
                  <div className="px-2 py-1 border-b border-border pb-1.5 mb-1.5">
                    <div className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                      <Shield size={12} className="text-primary" />
                      Impersonate Profile
                    </div>
                  </div>
                  <div className="space-y-0.5 max-h-48 overflow-y-auto">
                    {allUsersList.map(u => {
                      const isCurrent = u.id === user?.id;
                      return (
                        <button
                          key={u.id}
                          onClick={() => handleImpersonate(u.email)}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] hover:bg-accent transition-colors flex items-center justify-between font-medium text-foreground cursor-pointer ${
                            isCurrent ? 'bg-accent font-bold text-primary' : ''
                          }`}
                        >
                          <div className="truncate">
                            <div className="truncate">{u.name}</div>
                            <div className="text-[9px] text-muted-foreground truncate">{u.role?.name} • {u.branch?.name}</div>
                          </div>
                          {isCurrent && <Check size={10} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-destructive/70 hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors group relative text-[13px] font-bold cursor-pointer"
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
        {/* Top Speed Bar (Desktop + Mobile) */}
        <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card shrink-0 shadow-2xs">
          {/* Left section: Mobile menu & Global Quick Search button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all md:hidden cursor-pointer"
              title="Open Navigation"
            >
              <Menu size={18} />
            </button>

            {/* Quick Command Palette Button */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all text-xs font-semibold w-52 sm:w-80 justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <Search size={14} className="text-primary shrink-0" />
                <span className="truncate">Search customers, invoices, services...</span>
              </div>
              <kbd className="hidden sm:inline-flex text-[9px]">Ctrl K</kbd>
            </button>
          </div>

          {/* Right section: Live Time & Quick Invoice button */}
          <div className="flex items-center gap-2.5">
            {/* Live Clock */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border text-[11px] font-mono text-muted-foreground font-semibold">
              <Clock size={12} className="text-primary" />
              <span>{currentTime}</span>
            </div>

            {/* Branch Badge */}
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/5 text-primary text-xs font-bold border border-primary/20">
              <Building size={12} />
              <span className="truncate max-w-[120px]">{activeBranchName}</span>
            </div>

            {/* Global New Invoice F2 Button */}
            <button
              onClick={() => navigate('/sales/create')}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer"
              title="Create New Invoice (Press F2)"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">New Invoice</span>
              <kbd className="bg-white/20 text-white border-white/30 text-[9px] px-1 py-0.2 ml-0.5">F2</kbd>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 bg-background">
          <div className="mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* ═══════ COMMAND PALETTE MODAL (Ctrl+K) ═══════ */}
      {commandPaletteOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-16 px-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setCommandPaletteOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
              <Search size={18} className="text-primary shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Type to search customers, services, invoices, or shortcuts..."
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none border-none ring-0"
              />
              <kbd className="text-[10px]">ESC</kbd>
            </div>

            {/* Results Area */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-3">
              {!paletteQuery.trim() ? (
                <div className="p-3 space-y-2 text-xs">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-2">
                    Quick Navigation Shortcuts
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => { navigate('/sales/create'); setCommandPaletteOpen(false); }}
                      className="flex items-center justify-between p-2 rounded-xl bg-muted/40 hover:bg-primary hover:text-white transition-all text-left text-xs font-semibold cursor-pointer group"
                    >
                      <span className="flex items-center gap-2">
                        <Receipt size={14} className="text-primary group-hover:text-white" />
                        Create Invoice
                      </span>
                      <kbd className="group-hover:bg-white/20 group-hover:text-white">F2</kbd>
                    </button>
                    <button
                      onClick={() => { navigate('/sales'); setCommandPaletteOpen(false); }}
                      className="flex items-center justify-between p-2 rounded-xl bg-muted/40 hover:bg-primary hover:text-white transition-all text-left text-xs font-semibold cursor-pointer group"
                    >
                      <span className="flex items-center gap-2">
                        <Receipt size={14} className="text-primary group-hover:text-white" />
                        Invoices List
                      </span>
                      <kbd className="group-hover:bg-white/20 group-hover:text-white">F4</kbd>
                    </button>
                    <button
                      onClick={() => { navigate('/customers'); setCommandPaletteOpen(false); }}
                      className="flex items-center justify-between p-2 rounded-xl bg-muted/40 hover:bg-primary hover:text-white transition-all text-left text-xs font-semibold cursor-pointer group"
                    >
                      <span className="flex items-center gap-2">
                        <Users size={14} className="text-primary group-hover:text-white" />
                        Customers Directory
                      </span>
                      <kbd className="group-hover:bg-white/20 group-hover:text-white">F8</kbd>
                    </button>
                    <button
                      onClick={() => { navigate('/quotations/create'); setCommandPaletteOpen(false); }}
                      className="flex items-center justify-between p-2 rounded-xl bg-muted/40 hover:bg-primary hover:text-white transition-all text-left text-xs font-semibold cursor-pointer group"
                    >
                      <span className="flex items-center gap-2">
                        <FileText size={14} className="text-primary group-hover:text-white" />
                        Create Quotation
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Matching Customers */}
                  {paletteResults.customers.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-2">Customers</div>
                      {paletteResults.customers.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { navigate('/customers'); setCommandPaletteOpen(false); }}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-primary/10 hover:text-primary transition-all text-left text-xs cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-foreground">{c.name}</div>
                            <div className="text-[10px] text-muted-foreground">{c.phone || c.email || 'Customer'}</div>
                          </div>
                          <span className="text-[10px] font-bold text-primary">Open →</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Matching Services */}
                  {paletteResults.services.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-2">Services Catalog</div>
                      {paletteResults.services.map(s => (
                        <button
                          key={s.id}
                          onClick={() => { navigate('/sales/create'); setCommandPaletteOpen(false); }}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-primary/10 hover:text-primary transition-all text-left text-xs cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-foreground">{s.name}</div>
                            <div className="text-[10px] text-muted-foreground">{s.price.toFixed(2)} AED</div>
                          </div>
                          <span className="text-[10px] font-bold text-primary">Add to Bill →</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Matching Invoices */}
                  {paletteResults.sales.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-2">Invoices</div>
                      {paletteResults.sales.map(sale => (
                        <button
                          key={sale.id}
                          onClick={() => { navigate('/sales'); setCommandPaletteOpen(false); }}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-primary/10 hover:text-primary transition-all text-left text-xs cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-foreground">Invoice #{sale.invoice_no}</div>
                            <div className="text-[10px] text-muted-foreground">{sale.customer?.name || 'Walk-in'} • {sale.grand_total.toFixed(2)} AED</div>
                          </div>
                          <span className="text-[10px] font-bold text-primary">View →</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {paletteResults.customers.length === 0 && paletteResults.services.length === 0 && paletteResults.sales.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground italic">
                      No records matched "{paletteQuery}".
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Palette Footer */}
            <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Quick shortcuts enabled for rush hour</span>
              <span>Press <kbd className="text-[9px]">F2</kbd> anywhere for New Invoice</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
