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
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  Menu,
  X,
  Calendar,
  FileText,
  Search,
  Plus,
  Clock,
  CreditCard,
  BookOpen
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
      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-all duration-150 group relative font-medium ${
        isActive
          ? 'bg-white text-primary font-semibold shadow-xs border border-border/70 relative before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:bg-primary before:rounded-r-sm'
          : 'text-black hover:bg-slate-200/60 font-semibold'
      }`}
    >
      <div className={`flex-shrink-0 transition-transform duration-150 ${isActive ? 'text-primary' : 'text-black'}`}>
        {icon}
      </div>
      {!collapsed && <span className={isActive ? 'text-primary' : 'text-black'}>{label}</span>}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${isActive ? 'bg-primary/10 text-primary' : 'bg-rose-500 text-white'}`}>
          {badge}
        </span>
      )}
      
      {collapsed && badge !== undefined && badge > 0 && (
        <span className="absolute top-1 right-1 bg-rose-500 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0">
          {badge}
        </span>
      )}
      
      {collapsed && (
        <div className="absolute left-full ml-3 px-2.5 py-1 bg-black text-white text-xs font-semibold rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-md z-[60] whitespace-nowrap">
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
  badge?: number;
  links: { to: string; label: string; permission?: string; badge?: number }[];
}

const SidebarDropdown: React.FC<SidebarDropdownProps> = ({ label, icon, collapsed, permission, badge, links }) => {
  const location = useLocation();
  const { hasPermission } = useAuth();

  const [isOpen, setIsOpen] = useState(false);

  const allowedLinks = links.filter(link => !link.permission || hasPermission(link.permission));
  const isAllowed = !permission || hasPermission(permission);

  const isAnyActive = allowedLinks.some(link => {
    if (link.to === '/sales' || link.to === '/quotations' || link.to === '/customers' || link.to === '/services' || link.to === '/expenses' || link.to === '/payments' || link.to === '/expiry-tracker') {
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
        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] font-semibold transition-all duration-150 group relative cursor-pointer ${
          isAnyActive && !isOpen
            ? 'bg-white/90 text-primary border border-border/70'
            : 'text-black hover:bg-slate-200/60'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`flex-shrink-0 transition-transform duration-150 ${isAnyActive ? 'text-primary' : 'text-black'}`}>
            {icon}
          </div>
          {!collapsed && <span className={isAnyActive && !isOpen ? 'text-primary' : 'text-black'}>{label}</span>}
        </div>
        
        <div className="flex items-center gap-1.5">
          {!collapsed && badge !== undefined && badge > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0">
              {badge}
            </span>
          )}
          {!collapsed && (
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 text-black ${isOpen ? 'rotate-180' : ''}`}
            />
          )}
        </div>

        {collapsed && badge !== undefined && badge > 0 && (
          <span className="absolute top-1 right-1 bg-rose-500 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0">
            {badge}
          </span>
        )}

        {collapsed && (
          <div className="absolute left-full ml-3 w-44 bg-white text-black text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-lg border border-slate-200 z-[60] p-1.5">
            <div className="font-bold px-2 py-1 text-black text-[10px] uppercase tracking-wider mb-1 font-heading">{label}</div>
            {allowedLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center justify-between px-2 py-1.5 rounded-md transition-colors ${
                  location.pathname === link.to
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-black hover:bg-slate-100 font-semibold'
                }`}
              >
                <span>{link.label}</span>
                {link.badge !== undefined && link.badge > 0 && (
                  <span className="bg-rose-500 text-white text-[9px] font-bold px-1 rounded-full">
                    {link.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </button>

      {!collapsed && isOpen && (
        <div className="ml-4 pl-2.5 border-l border-slate-300 mt-1 space-y-0.5">
          {allowedLinks.map(link => {
            const isChildActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all duration-150 ${
                  isChildActive
                    ? 'text-primary bg-white font-bold shadow-2xs border border-border/70'
                    : 'text-black hover:bg-slate-200/50 font-medium'
                }`}
              >
                <span>{link.label}</span>
                {link.badge !== undefined && link.badge > 0 && (
                  <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                    {link.badge}
                  </span>
                )}
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
    <div className="px-3 pt-4 pb-1">
      <span className="text-[10px] uppercase tracking-wider font-extrabold text-black/70 font-heading">{label}</span>
    </div>
  ) : <div className="pt-2" />
);

/* ════════════════════════ MAIN LAYOUT ════════════════════════ */

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    logout,
    allUsersList
  } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
            className={`bg-[#f1f5f9] flex flex-col justify-between transition-all duration-200 z-50 border-r border-slate-200 fixed inset-y-0 left-0 md:static md:translate-x-0 ${
              mobileOpen ? 'translate-x-0 w-[240px]' : '-translate-x-full md:translate-x-0'
            } ${isCollapsedResponsive ? 'md:w-[68px]' : 'md:w-[240px]'}`}
          >
            <div className="flex-1 flex flex-col min-h-0">
              {/* Logo */}
              <div className="flex h-15 items-center justify-between px-3.5 border-b border-slate-200">
                {!isCollapsedResponsive ? (
                  <>
                    <div className="flex items-center gap-2.5">
                      <Logo size={28} />
                      <div>
                        <span className="font-heading font-extrabold text-sm text-black tracking-tight leading-none block">AZIZI ERP</span>
                        <div className="text-[9px] font-bold text-black/70 font-heading tracking-wide mt-0.5">Typing & Services</div>
                      </div>
                    </div>
                    {/* Desktop Collapse Button */}
                    <button
                      onClick={() => setCollapsed(true)}
                      className="p-1 hover:bg-slate-200 text-black hover:text-primary rounded-md transition-all md:block hidden cursor-pointer"
                      title="Collapse Sidebar"
                    >
                      <PanelLeftClose size={15} />
                    </button>
                    {/* Mobile Close Button */}
                    <button
                      onClick={() => setMobileOpen(false)}
                      className="p-1 hover:bg-slate-200 text-black hover:text-primary rounded-md transition-all md:hidden block cursor-pointer"
                      title="Close Navigation"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <div className="w-full flex justify-center py-1 md:block hidden">
                    <button
                      onClick={() => setCollapsed(false)}
                      className="p-1 hover:bg-slate-200 text-black hover:text-primary rounded-md transition-all cursor-pointer"
                      title="Expand Sidebar"
                    >
                      <PanelLeft size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <nav className="flex-1 space-y-0.5 px-2.5 py-2.5 overflow-y-auto">
                <SidebarLink to="/" icon={<LayoutDashboard size={17} />} label="Dashboard" collapsed={isCollapsedResponsive} />

                {/* 1. OPERATIONS */}
                <SidebarSection label="Operations" collapsed={isCollapsedResponsive} />

                <SidebarDropdown
                  label="Customers"
                  icon={<Users size={17} />}
                  collapsed={isCollapsedResponsive}
                  permission="Customer.View"
                  links={[
                    { to: '/customers', label: 'Customer List', permission: 'Customer.View' },
                    { to: '/customers/create', label: 'Add Customer', permission: 'Customer.Create' }
                  ]}
                />

                <SidebarDropdown
                  label="Services"
                  icon={<Briefcase size={17} />}
                  collapsed={isCollapsedResponsive}
                  permission="Customer.View"
                  links={[
                    { to: '/services', label: 'Services List', permission: 'Customer.View' },
                    { to: '/services/create', label: 'Add Service', permission: 'Customer.Create' },
                    { to: '/services/category/create', label: 'Add Category', permission: 'Customer.Create' }
                  ]}
                />

                <SidebarDropdown
                  label="Quotations"
                  icon={<FileText size={17} />}
                  collapsed={isCollapsedResponsive}
                  permission="Sales.View"
                  links={[
                    { to: '/quotations', label: 'Quotations List', permission: 'Sales.View' },
                    { to: '/quotations/create', label: 'Create Quotation', permission: 'Sales.Create' }
                  ]}
                />

                <SidebarDropdown
                  label="Invoices"
                  icon={<Receipt size={17} />}
                  collapsed={isCollapsedResponsive}
                  permission="Sales.View"
                  links={[
                    { to: '/sales', label: 'Invoices List', permission: 'Sales.View' },
                    { to: '/sales/create', label: 'Create Invoice', permission: 'Sales.Create' }
                  ]}
                />

                <SidebarDropdown
                  label="Expiry Tracker"
                  icon={<Calendar size={17} />}
                  collapsed={isCollapsedResponsive}
                  permission="Sales.View"
                  badge={expiryCount > 0 ? expiryCount : undefined}
                  links={[
                    { to: '/expiry-tracker', label: 'Expiry Tracker', permission: 'Sales.View', badge: expiryCount > 0 ? expiryCount : undefined },
                    { to: '/expiry-tracker/types', label: 'Document Types', permission: 'Sales.View' }
                  ]}
                />

                {/* 2. FINANCE & ACCOUNTS */}
                <SidebarSection label="Finance & Accounts" collapsed={isCollapsedResponsive} />

                <SidebarLink
                  to="/accounts"
                  icon={<CreditCard size={17} />}
                  label="Cards & Wallets"
                  collapsed={isCollapsedResponsive}
                  permission="Expenses.View"
                />

                <SidebarLink
                  to="/journal"
                  icon={<BookOpen size={17} />}
                  label="Journal (Cash Flow)"
                  collapsed={isCollapsedResponsive}
                  permission="Expenses.View"
                />

                <SidebarDropdown
                  label="Payments"
                  icon={<DollarSign size={17} />}
                  collapsed={isCollapsedResponsive}
                  permission="Payments.View"
                  links={[
                    { to: '/payments', label: 'Payments List', permission: 'Payments.View' },
                    { to: '/payments/create', label: 'Record Payment', permission: 'Payments.Create' }
                  ]}
                />

                <SidebarDropdown
                  label="Expenses"
                  icon={<TrendingDown size={17} />}
                  collapsed={isCollapsedResponsive}
                  permission="Expenses.View"
                  links={[
                    { to: '/expenses', label: 'Expenses List', permission: 'Expenses.View' },
                    { to: '/expenses/create', label: 'Record Expense', permission: 'Expenses.Create' },
                    { to: '/expenses/category/create', label: 'Expense Categories', permission: 'Expenses.Create' }
                  ]}
                />

                {/* 3. REPORTS & AUDIT */}
                <SidebarSection label="Reports & Insights" collapsed={isCollapsedResponsive} />

                <SidebarDropdown
                  label="Reports"
                  icon={<FileBarChart2 size={17} />}
                  collapsed={isCollapsedResponsive}
                  permission="Reports.View"
                  links={[
                    { to: '/daily-sheet', label: 'Daily Sheet', permission: 'Reports.View' },
                    { to: '/reports', label: 'Reports Center', permission: 'Reports.View' }
                  ]}
                />

                {/* 4. ADMINISTRATION */}
                <SidebarSection label="Administration" collapsed={isCollapsedResponsive} />

                <SidebarLink to="/rbac" icon={<UserCheck size={17} />} label="Users & Roles" collapsed={isCollapsedResponsive} permission="Users.View" />

                <SidebarDropdown
                  label="Settings"
                  icon={<Settings size={17} />}
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
        <div className="p-2.5 border-t border-slate-200 space-y-1.5 bg-[#f1f5f9]">
          {/* User Profile Info Card */}
          <div className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-bold text-black shadow-2xs">
            <div className="flex items-center gap-2 truncate">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px] uppercase shrink-0 font-heading">
                {user?.name?.charAt(0) || 'U'}
              </div>
              {!isCollapsedResponsive && (
                <div className="text-left truncate">
                  <div className="font-bold text-[11px] leading-none truncate text-black">{user?.name}</div>
                  <div className="text-[9px] text-black/75 leading-none mt-1 truncate font-semibold">{currentUserRoleName}</div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors group relative text-xs font-semibold cursor-pointer"
          >
            <LogOut size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            {!isCollapsedResponsive && <span>Sign Out</span>}
            {isCollapsedResponsive && (
              <div className="absolute left-full ml-3 px-2 py-1 bg-slate-900 text-white text-xs font-medium rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-md z-[60] whitespace-nowrap">
                Sign Out
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
        <header className="h-14 border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 bg-white shrink-0 shadow-2xs">
          {/* Left section: Mobile menu & Global Quick Search button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-md transition-all md:hidden cursor-pointer"
              title="Open Navigation"
            >
              <Menu size={18} />
            </button>

            {/* Quick Command Palette Button */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all text-xs font-medium w-52 sm:w-80 justify-between cursor-pointer"
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
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600 font-semibold">
              <Clock size={12} className="text-primary" />
              <span>{currentTime}</span>
            </div>

            {/* Global New Invoice F2 Button */}
            <button
              onClick={() => navigate('/sales/create')}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-md text-xs font-bold shadow-xs transition-all cursor-pointer font-heading"
              title="Create New Invoice (Press F2)"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">New Invoice</span>
              <kbd className="bg-white/20 text-white border-white/30 text-[9px] px-1 py-0.2 ml-0.5">F2</kbd>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f8fafc]">
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
