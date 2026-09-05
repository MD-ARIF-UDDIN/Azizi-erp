import { isSupabaseConfigured, supabase } from './supabase';
import type {
  Branch, Role, Permission, RolePermission, User, Customer,
  ServiceCategory, Service, OrderStatus, Sale, SaleItem, Payment,
  ExpenseCategory, Expense, OrderStatusHistory, AuditLog, ClientDocument, DocumentType,
  Quotation, QuotationItem, QuotationStatusHistory, TermsConditions,
  Account, AccountTransaction, JournalEntry
} from '../types/database';

// A mock helper to generate UUIDs locally
const generateUUID = () => crypto.randomUUID();

export const isValidUUID = (uuid?: string | null): boolean => {
  if (!uuid || typeof uuid !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid.trim());
};

export const sanitizeUUID = (uuid?: string | null): string | null => {
  if (!uuid || typeof uuid !== 'string') return null;
  const trimmed = uuid.trim();
  return isValidUUID(trimmed) ? trimmed : null;
};

// Local Storage Keys
const KEYS = {
  BRANCHES: 'azizi_erp_branches',
  ROLES: 'azizi_erp_roles',
  PERMISSIONS: 'azizi_erp_permissions',
  ROLE_PERMISSIONS: 'azizi_erp_role_permissions',
  USERS: 'azizi_erp_users',
  CUSTOMERS: 'azizi_erp_customers',
  SERVICE_CATEGORIES: 'azizi_erp_service_categories',
  SERVICES: 'azizi_erp_services',
  ORDER_STATUSES: 'azizi_erp_order_statuses',
  SALES: 'azizi_erp_sales',
  SALE_ITEMS: 'azizi_erp_sale_items',
  PAYMENTS: 'azizi_erp_payments',
  EXPENSE_CATEGORIES: 'azizi_erp_expense_categories',
  EXPENSES: 'azizi_erp_expenses',
  ORDER_STATUS_HISTORY: 'azizi_erp_order_status_history',
  AUDIT_LOGS: 'azizi_erp_audit_logs',
  CLIENT_DOCUMENTS: 'azizi_erp_client_documents',
  DOCUMENT_TYPES: 'azizi_erp_document_types',
  QUOTATIONS: 'azizi_erp_quotations',
  QUOTATION_ITEMS: 'azizi_erp_quotation_items',
  QUOTATION_STATUS_HISTORY: 'azizi_erp_quotation_status_history',
  TERMS_CONDITIONS: 'azizi_erp_terms_conditions',
  ACCOUNTS: 'azizi_erp_accounts',
  ACCOUNT_TRANSACTIONS: 'azizi_erp_account_transactions',
  JOURNAL_ENTRIES: 'azizi_erp_journal_entries',
};

// Seed Helper
const getOrSeed = <T>(key: string, seedFn: () => T[]): T[] => {
  const data = localStorage.getItem(key);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse localStorage key:', key, e);
    }
  }
  const seeded = seedFn();
  localStorage.setItem(key, JSON.stringify(seeded));
  return seeded;
};

const saveToLocalStorage = <T>(key: string, data: T[]): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ---------------------------------------------------------
// SEED DATA GENERATORS
// ---------------------------------------------------------
const SEED_BRANCHES = (): Branch[] => [
  { id: 'b1111111-1111-1111-1111-111111111111', name: 'Central Dhaka Branch', address: 'Motijheel C/A, Dhaka', phone: '+8801711223344', email: 'dhaka@azizi.com', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'b2222222-2222-2222-2222-222222222222', name: 'Chittagong GEC Branch', address: 'GEC Circle, Chittagong', phone: '+8801811223344', email: 'ctg@azizi.com', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const SEED_ROLES = (): Role[] => [
  { id: '00000000-0000-0000-0000-000000000000', name: 'Owner', description: 'Business owner with complete multi-branch management and financial clearance.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '11111111-1111-1111-1111-111111111111', name: 'Super Admin', description: 'Complete system access, multi-branch overview.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Branch Manager', description: 'Manage branch-specific sales, customers, and employees.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Cashier', description: 'Create sales invoice, receive payments, view customer ledger.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Production Exec', description: 'Update status of orders (Typing, Stamp making, Printing).', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const SEED_PERMISSIONS = (): Permission[] => {
  const list = [
    'Customer.View', 'Customer.Create', 'Customer.Update', 'Customer.Delete',
    'Sales.View', 'Sales.Create', 'Sales.Update', 'Sales.Delete',
    'Payments.View', 'Payments.Create', 'Payments.Delete',
    'Expenses.View', 'Expenses.Create', 'Expenses.Update', 'Expenses.Delete',
    'Branches.View', 'Branches.Create', 'Branches.Update', 'Branches.Delete',
    'Users.View', 'Users.Create', 'Users.Update', 'Users.Delete',
    'Roles.View', 'Roles.Update', 'Reports.View', 'Settings.Update'
  ];
  return list.map((p, index) => {
    const pad = (index + 1).toString().padStart(12, '0');
    return {
      id: `a0000000-0000-0000-0000-${pad}`,
      name: p,
      description: `Grants capability to perform action: ${p}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  });
};

const SEED_ROLE_PERMISSIONS = (roles: Role[], permissions: Permission[]): RolePermission[] => {
  const mappings: RolePermission[] = [];
  const owner = roles.find(r => r.name === 'Owner');
  const admin = roles.find(r => r.name === 'Super Admin');
  const manager = roles.find(r => r.name === 'Branch Manager');
  const cashier = roles.find(r => r.name === 'Cashier');
  const prod = roles.find(r => r.name === 'Production Exec');

  permissions.forEach(p => {
    // Owner gets everything
    if (owner) {
      mappings.push({ id: generateUUID(), role_id: owner.id, permission_id: p.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    // Admin gets everything
    if (admin) {
      mappings.push({ id: generateUUID(), role_id: admin.id, permission_id: p.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    // Manager gets most, except settings and branch deletion
    if (manager && !['Settings.Update', 'Branches.Delete', 'Roles.Update', 'Users.Delete'].includes(p.name)) {
      mappings.push({ id: generateUUID(), role_id: manager.id, permission_id: p.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    // Cashier gets Sales, Customers, Payments, and select reports
    if (cashier && (p.name.startsWith('Customer') || p.name.startsWith('Sales') || p.name.startsWith('Payments') || p.name === 'Reports.View')) {
      mappings.push({ id: generateUUID(), role_id: cashier.id, permission_id: p.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    // Production gets Sales.View (to see what is ordered) and sales status update (Sales.Update)
    if (prod && (p.name === 'Sales.View' || p.name === 'Sales.Update')) {
      mappings.push({ id: generateUUID(), role_id: prod.id, permission_id: p.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
  });

  return mappings;
};

const SEED_USERS = (roles: Role[], branches: Branch[]): User[] => [
  { id: '00000000-0000-0000-0000-00000000000a', name: 'Owner admin', email: 'admin@gmail.com', phone: '+8801700000000', role_id: '00000000-0000-0000-0000-000000000000', branch_id: branches[0].id, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), permissions: ['Customer.View', 'Customer.Create', 'Customer.Update', 'Customer.Delete', 'Sales.View', 'Sales.Create', 'Sales.Update', 'Sales.Delete', 'Payments.View', 'Payments.Create', 'Payments.Delete', 'Expenses.View', 'Expenses.Create', 'Expenses.Update', 'Expenses.Delete', 'Branches.View', 'Branches.Create', 'Branches.Update', 'Branches.Delete', 'Users.View', 'Users.Create', 'Users.Update', 'Users.Delete', 'Roles.View', 'Roles.Update', 'Reports.View', 'Settings.Update'] },
  { id: '11111111-1111-1111-1111-11111111111a', name: 'Al-Amin Arif', email: 'admin@azizi.com', phone: '+8801700000001', role_id: roles[1].id, branch_id: branches[0].id, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), permissions: ['Customer.View', 'Customer.Create', 'Customer.Update', 'Customer.Delete', 'Sales.View', 'Sales.Create', 'Sales.Update', 'Sales.Delete', 'Payments.View', 'Payments.Create', 'Payments.Delete', 'Expenses.View', 'Expenses.Create', 'Expenses.Update', 'Expenses.Delete', 'Branches.View', 'Branches.Create', 'Branches.Update', 'Branches.Delete', 'Users.View', 'Users.Create', 'Users.Update', 'Users.Delete', 'Roles.View', 'Roles.Update', 'Reports.View', 'Settings.Update'] },
  { id: '22222222-2222-2222-2222-22222222222a', name: 'Rahat Khan', email: 'manager@azizi.com', phone: '+8801700000002', role_id: roles[2].id, branch_id: branches[1].id, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), permissions: ['Customer.View', 'Customer.Create', 'Customer.Update', 'Sales.View', 'Sales.Create', 'Sales.Update', 'Payments.View', 'Payments.Create', 'Expenses.View', 'Expenses.Create', 'Expenses.Update', 'Branches.View', 'Users.View', 'Users.Create', 'Users.Update', 'Reports.View'] },
  { id: '33333333-3333-3333-3333-33333333333a', name: 'Mitu Akter', email: 'cashier@azizi.com', phone: '+8801700000003', role_id: roles[3].id, branch_id: branches[0].id, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), permissions: ['Customer.View', 'Customer.Create', 'Customer.Update', 'Sales.View', 'Sales.Create', 'Payments.View', 'Payments.Create', 'Reports.View'] },
];

const SEED_CUSTOMERS = (): Customer[] => [
  { id: 'c0000000-0000-0000-0000-000000000001', name: 'Walk-in Customer', phone: '+971500000000', email: 'walkin@azizi.ae', address: 'Musaffah, Abu Dhabi', notes: 'General counter walk-in customer', customer_type: 'individual', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

const SEED_CATEGORIES = (): ServiceCategory[] => [
  { id: 'c1111111-1111-1111-1111-111111111111', name: 'Visa Services', description: 'Employment visa, family visa, visit visa renewals and applications.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'c2222222-2222-2222-2222-222222222222', name: 'Emirates ID', description: 'New Emirates ID registration and renewals.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'c3333333-3333-3333-3333-333333333333', name: 'MOHRE Services', description: 'Work permit composing and submissions.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'c4444444-4444-4444-4444-444444444444', name: 'MOFA Attestation', description: 'MOFA degree, marriage, and birth certificate attestation.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'c5555555-5555-5555-5555-555555555555', name: 'Business Services', description: 'Trade license renewals, corporate setups.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'c6666666-6666-6666-6666-666666666666', name: 'Printing & Stamp Making', description: 'Company stamp design, photocopying, and color printing.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

const SEED_SERVICES = (): Service[] => [
  { id: 'd1111111-1111-1111-1111-111111111111', category_id: 'c1111111-1111-1111-1111-111111111111', name: 'New Employment Visa', description: 'Full process for new employee entry visa composing.', price: 1500.00, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'd1111111-1111-1111-1111-111111111112', category_id: 'c1111111-1111-1111-1111-111111111111', name: 'Visa Renewal', description: 'Employment or residence visa renewal composing.', price: 1200.00, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'd1111111-1111-1111-1111-111111111113', category_id: 'c1111111-1111-1111-1111-111111111111', name: 'Family Visa', description: 'Sponsoring family members residence visas.', price: 2000.00, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'd1111111-1111-1111-1111-111111111114', category_id: 'c1111111-1111-1111-1111-111111111111', name: 'Visit Visa', description: 'Tourist or leisure visit visa applications.', price: 800.00, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'd2222222-2222-2222-2222-222222222221', category_id: 'c2222222-2222-2222-2222-222222222222', name: 'New Emirates ID', description: 'Biometrics scheduling and new ID registration.', price: 250.00, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'd2222222-2222-2222-2222-222222222222', category_id: 'c2222222-2222-2222-2222-222222222222', name: 'Emirates ID Renewal', description: 'Form typing for Emirates ID renewal.', price: 250.00, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'd3333333-3333-3333-3333-333333333331', category_id: 'c3333333-3333-3333-3333-333333333333', name: 'Work Permit', description: 'MOHRE work contract draft and permit composing.', price: 600.00, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'd4444444-4444-4444-4444-444444444441', category_id: 'c4444444-4444-4444-4444-444444444444', name: 'MOFA Attestation', description: 'Attesting legal documents from Ministry of Foreign Affairs.', price: 150.00, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'd5555555-5555-5555-5555-555555555551', category_id: 'c5555555-5555-5555-5555-555555555555', name: 'Trade License', description: 'DED trade license renewal and corporate forms typing.', price: 3000.00, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'd6666666-6666-6666-6666-666666666661', category_id: 'c6666666-6666-6666-6666-666666666666', name: 'Company Stamp', description: 'Custom-designed self-ink or rubber official company stamp.', price: 120.00, status: 'Active', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

const SEED_ORDER_STATUSES = (): OrderStatus[] => [
  { id: '11111111-0000-0000-0000-000000000001', name: 'Pending', color: '#ef4444', sequence: 1, is_system: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '11111111-0000-0000-0000-000000000002', name: 'Designing', color: '#f97316', sequence: 2, is_system: false, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '11111111-0000-0000-0000-000000000003', name: 'Typing', color: '#06b6d4', sequence: 3, is_system: false, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '11111111-0000-0000-0000-000000000004', name: 'Printing', color: '#3b82f6', sequence: 4, is_system: false, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '11111111-0000-0000-0000-000000000005', name: 'Stamp Making', color: '#8b5cf6', sequence: 5, is_system: false, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '11111111-0000-0000-0000-000000000006', name: 'Waiting Approval', color: '#eab308', sequence: 6, is_system: false, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '11111111-0000-0000-0000-000000000007', name: 'Ready', color: '#10b981', sequence: 7, is_system: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '11111111-0000-0000-0000-000000000008', name: 'Delivered', color: '#64748b', sequence: 8, is_system: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '11111111-0000-0000-0000-000000000009', name: 'Completed', color: '#22c55e', sequence: 9, is_system: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '11111111-0000-0000-0000-000000000010', name: 'Cancelled', color: '#000000', sequence: 10, is_system: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const SEED_EXPENSE_CATEGORIES = (): ExpenseCategory[] => [
  { id: 'e1111111-1111-1111-1111-111111111111', name: 'Shop Rent', description: 'Monthly lease rental fee.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'e2222222-2222-2222-2222-222222222222', name: 'Utility Electricity', description: 'Electric bills and gas supplies.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'e3333333-3333-3333-3333-333333333333', name: 'Paper & Stationery', description: 'Purchases of A4 paper rims, cardboards, rubber materials.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'e4444444-4444-4444-4444-444444444444', name: 'Printer Toner / Ink Refill', description: 'Printer cartridge refills and laser toners.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'e5555555-5555-5555-5555-555555555555', name: 'Staff Salaries', description: 'Wages for typists and stamp designers.', is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

// Helper to seed some past transactions for dashboard demo graphs
const SEED_SALES_AND_FINANCIALS = (
  branches: Branch[],
  users: User[],
  custs: Customer[],
  srvs: Service[],
  statuses: OrderStatus[],
  expenseCats: ExpenseCategory[]
) => {
  const sales: Sale[] = [];
  const saleItems: SaleItem[] = [];
  const payments: Payment[] = [];
  const expenses: Expense[] = [];
  const history: OrderStatusHistory[] = [];
  const logs: AuditLog[] = [];

  const now = new Date();
  for (let i = 0; i < 25; i++) {
    const saleDate = new Date();
    saleDate.setDate(now.getDate() - (i % 15));
    saleDate.setHours(10 + (i % 8), 15 + (i * 3) % 45, 0);

    const b = branches[i % branches.length];
    const u = users.find(x => x.branch_id === b.id) || users[0];
    const c = custs[i % custs.length];
    const s1 = srvs[i % srvs.length];
    const s2 = srvs[(i + 2) % srvs.length];

    const quantity1 = (i % 3) + 1;
    const quantity2 = (i % 2) + 1;
    const subtotal = (s1.price * quantity1) + (s2.price * quantity2);
    const discount = i % 5 === 0 ? 20.00 : 0.00;
    const grand_total = Math.max(0, subtotal - discount);

    const serialStr = (i + 1).toString().padStart(4, '0');
    const invoice_no = `INV-${serialStr}`;

    let order_status = statuses.find(s => s.name === 'Completed')!;
    let pay_status: 'Paid' | 'Partially Paid' | 'Unpaid' = 'Paid';
    if (i === 1) {
      order_status = statuses.find(s => s.name === 'Pending')!;
      pay_status = 'Unpaid';
    } else if (i === 3) {
      order_status = statuses.find(s => s.name === 'Ready')!;
      pay_status = 'Partially Paid';
    } else if (i === 5) {
      order_status = statuses.find(s => s.name === 'Typing')!;
      pay_status = 'Unpaid';
    }

    const sale_id = `sale-uuid-${i}`;
    
    sales.push({
      id: sale_id,
      invoice_no,
      customer_id: c.id,
      branch_id: b.id,
      employee_id: u.id,
      discount,
      subtotal,
      grand_total,
      payment_status: pay_status,
      order_status_id: order_status.id,
      notes: i % 4 === 0 ? 'Urgent delivery required.' : undefined,
      is_deleted: false,
      created_at: saleDate.toISOString(),
      updated_at: saleDate.toISOString(),
    });

    const item1_id = `item-uuid-${i}-1`;
    saleItems.push({
      id: item1_id,
      sale_id,
      service_id: s1.id,
      staff_id: u.id,
      quantity: quantity1,
      unit_price: s1.price,
      subtotal: s1.price * quantity1,
      created_at: saleDate.toISOString(),
      updated_at: saleDate.toISOString(),
    });

    const item2_id = `item-uuid-${i}-2`;
    saleItems.push({
      id: item2_id,
      sale_id,
      service_id: s2.id,
      staff_id: u.id,
      quantity: quantity2,
      unit_price: s2.price,
      subtotal: s2.price * quantity2,
      created_at: saleDate.toISOString(),
      updated_at: saleDate.toISOString(),
    });

    if (pay_status === 'Paid') {
      payments.push({
        id: `pay-uuid-${i}`,
        sale_id,
        amount: grand_total,
        payment_method: i % 3 === 0 ? 'Mobile Banking' : 'Cash',
        transaction_no: i % 3 === 0 ? `TXN${Date.now() - i * 1000}` : undefined,
        payment_date: saleDate.toISOString(),
        received_by: u.id,
        is_deleted: false,
        created_at: saleDate.toISOString(),
        updated_at: saleDate.toISOString(),
      });
    } else if (pay_status === 'Partially Paid') {
      payments.push({
        id: `pay-uuid-${i}-part`,
        sale_id,
        amount: Math.round(grand_total / 2),
        payment_method: 'Cash',
        payment_date: saleDate.toISOString(),
        received_by: u.id,
        is_deleted: false,
        created_at: saleDate.toISOString(),
        updated_at: saleDate.toISOString(),
      });
    }

    history.push({
      id: `hist-uuid-${i}`,
      sale_id,
      previous_status_id: undefined,
      new_status_id: order_status.id,
      changed_by: u.id,
      remarks: 'Invoice initialized.',
      created_at: saleDate.toISOString(),
    });
  }

  for (let i = 0; i < 8; i++) {
    const expenseDate = new Date();
    expenseDate.setDate(now.getDate() - (i * 3));
    const b = branches[i % branches.length];
    const cat = expenseCats[i % expenseCats.length];
    const amount = (i + 1) * 350;

    expenses.push({
      id: `exp-uuid-${i}`,
      category_id: cat.id,
      branch_id: b.id,
      amount,
      expense_date: expenseDate.toISOString().split('T')[0],
      description: `Payment for ${cat.name}`,
      paid_to: i % 2 === 0 ? 'Dhaka Paper House' : 'Staff wages',
      payment_method: i % 4 === 0 ? 'Mobile Banking' : 'Cash',
      is_deleted: false,
      created_at: expenseDate.toISOString(),
      updated_at: expenseDate.toISOString(),
    });
  }

  return { sales, saleItems, payments, expenses, history, logs };
};

// ---------------------------------------------------------
// DATABASE INIT OR RESTORE (LOCAL STORAGE ENGINE)
// ---------------------------------------------------------
let _branches = getOrSeed(KEYS.BRANCHES, SEED_BRANCHES);
let _roles = getOrSeed(KEYS.ROLES, SEED_ROLES);
let _permissions = getOrSeed(KEYS.PERMISSIONS, SEED_PERMISSIONS);
let _rolePermissions = getOrSeed(KEYS.ROLE_PERMISSIONS, () => SEED_ROLE_PERMISSIONS(_roles, _permissions));
let _users = getOrSeed(KEYS.USERS, () => SEED_USERS(_roles, _branches));
let _customers = getOrSeed(KEYS.CUSTOMERS, SEED_CUSTOMERS);
let _categories = getOrSeed(KEYS.SERVICE_CATEGORIES, SEED_CATEGORIES);
let _services = getOrSeed(KEYS.SERVICES, SEED_SERVICES);
let _statuses = getOrSeed(KEYS.ORDER_STATUSES, SEED_ORDER_STATUSES);
let _expenseCats = getOrSeed(KEYS.EXPENSE_CATEGORIES, SEED_EXPENSE_CATEGORIES);

const finData = getOrSeed(KEYS.SALES, () => {
  const seededFin = SEED_SALES_AND_FINANCIALS(_branches, _users, _customers, _services, _statuses, _expenseCats);
  saveToLocalStorage(KEYS.SALE_ITEMS, seededFin.saleItems);
  saveToLocalStorage(KEYS.PAYMENTS, seededFin.payments);
  saveToLocalStorage(KEYS.EXPENSES, seededFin.expenses);
  saveToLocalStorage(KEYS.ORDER_STATUS_HISTORY, seededFin.history);
  saveToLocalStorage(KEYS.AUDIT_LOGS, seededFin.logs);
  return seededFin.sales;
});

let _sales: Sale[] = finData;
let _saleItems: SaleItem[] = JSON.parse(localStorage.getItem(KEYS.SALE_ITEMS) || '[]');
let _payments: Payment[] = JSON.parse(localStorage.getItem(KEYS.PAYMENTS) || '[]');
let _expenses: Expense[] = JSON.parse(localStorage.getItem(KEYS.EXPENSES) || '[]');
let _history: OrderStatusHistory[] = JSON.parse(localStorage.getItem(KEYS.ORDER_STATUS_HISTORY) || '[]');
let _logs: AuditLog[] = JSON.parse(localStorage.getItem(KEYS.AUDIT_LOGS) || '[]');

const SEED_CLIENT_DOCUMENTS = (customers: Customer[]) => {
  const now = new Date();
  const d1 = new Date(now);
  d1.setDate(now.getDate() + 15);
  const d2 = new Date(now);
  d2.setDate(now.getDate() + 45);

  return [
    {
      id: 'doc-uuid-1',
      customer_id: customers[0]?.id || 'c1-cust',
      document_type: 'Visa' as const,
      document_number: 'V123456789',
      expiry_date: d2.toISOString().split('T')[0],
      notified: false,
      notes: 'Visa renewal due soon.',
      status: 'Active' as const,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    {
      id: 'doc-uuid-2',
      customer_id: customers[1]?.id || 'c2-cust',
      document_type: 'Emirates ID' as const,
      document_number: '784-1995-1234567-1',
      expiry_date: d1.toISOString().split('T')[0],
      notified: false,
      notes: 'Need to notify client about Emirates ID biometric scheduling.',
      status: 'Active' as const,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  ];
};

const SEED_TERMS_CONDITIONS = (): TermsConditions[] => {
  const now = new Date();
  return [
    {
      id: 'tc-uuid-1',
      title: 'Validity',
      content: 'This quotation is valid for 15 days from the date of issue.',
      sequence: 1,
      is_deleted: false,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    },
    {
      id: 'tc-uuid-2',
      title: 'Payment Terms',
      content: '50% advance payment is required to initiate orders. Remaining balance must be cleared upon delivery.',
      sequence: 2,
      is_deleted: false,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    },
    {
      id: 'tc-uuid-3',
      title: 'Verification',
      content: 'Customers must carefully verify typed contents (names, spelling, numbers) before official submission.',
      sequence: 3,
      is_deleted: false,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    }
  ];
};

const SEED_ACCOUNTS = (): Account[] => [];

const SEED_DOCUMENT_TYPES = (): DocumentType[] => [
  { id: 'dt111111-1111-1111-1111-111111111111', name: 'Visa', description: 'UAE Residence / Employment / Partner Visa', is_active: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'dt222222-2222-2222-2222-222222222222', name: 'Emirates ID', description: 'National Identity Card', is_active: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'dt333333-3333-3333-3333-333333333333', name: 'Passport', description: 'National Passport', is_active: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'dt444444-4444-4444-4444-444444444444', name: 'Trade License', description: 'Economic Department Commercial License', is_active: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'dt555555-5555-5555-5555-555555555555', name: 'Labor Card', description: 'MOHRE Work Permit / Labor Card', is_active: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'dt666666-6666-6666-6666-666666666666', name: 'Medical Insurance', description: 'Daman / Thiqa / Private Health Insurance', is_active: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'dt777777-7777-7777-7777-777777777777', name: 'Tenancy Contract (Ejari)', description: 'Tawtheeq / Ejari Lease Agreement', is_active: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'dt888888-8888-8888-8888-888888888888', name: 'Establishment Card', description: 'Immigration & Labor Company Card', is_active: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'dt999999-9999-9999-9999-999999999999', name: 'Commercial Register', description: 'Chamber of Commerce Certificate', is_active: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'dt000000-0000-0000-0000-000000000000', name: 'Other', description: 'Other General Document Types', is_active: true, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

let _clientDocuments: ClientDocument[] = getOrSeed(KEYS.CLIENT_DOCUMENTS, () => SEED_CLIENT_DOCUMENTS(_customers));
let _documentTypes: DocumentType[] = getOrSeed(KEYS.DOCUMENT_TYPES, SEED_DOCUMENT_TYPES);
let _quotations: Quotation[] = getOrSeed(KEYS.QUOTATIONS, () => []);
let _quotationItems: QuotationItem[] = getOrSeed(KEYS.QUOTATION_ITEMS, () => []);
let _quotationHistory: QuotationStatusHistory[] = getOrSeed(KEYS.QUOTATION_STATUS_HISTORY, () => []);
let _termsConditions: TermsConditions[] = getOrSeed(KEYS.TERMS_CONDITIONS, () => SEED_TERMS_CONDITIONS());
let _accounts: Account[] = getOrSeed(KEYS.ACCOUNTS, SEED_ACCOUNTS);
let _accountTransactions: AccountTransaction[] = getOrSeed(KEYS.ACCOUNT_TRANSACTIONS, () => []);
let _journalEntries: JournalEntry[] = getOrSeed(KEYS.JOURNAL_ENTRIES, () => []);

const saveAll = () => {
  saveToLocalStorage(KEYS.BRANCHES, _branches);
  saveToLocalStorage(KEYS.ROLES, _roles);
  saveToLocalStorage(KEYS.PERMISSIONS, _permissions);
  saveToLocalStorage(KEYS.ROLE_PERMISSIONS, _rolePermissions);
  saveToLocalStorage(KEYS.USERS, _users);
  saveToLocalStorage(KEYS.CUSTOMERS, _customers);
  saveToLocalStorage(KEYS.SERVICE_CATEGORIES, _categories);
  saveToLocalStorage(KEYS.SERVICES, _services);
  saveToLocalStorage(KEYS.ORDER_STATUSES, _statuses);
  saveToLocalStorage(KEYS.SALES, _sales);
  saveToLocalStorage(KEYS.SALE_ITEMS, _saleItems);
  saveToLocalStorage(KEYS.PAYMENTS, _payments);
  saveToLocalStorage(KEYS.EXPENSE_CATEGORIES, _expenseCats);
  saveToLocalStorage(KEYS.EXPENSES, _expenses);
  saveToLocalStorage(KEYS.ORDER_STATUS_HISTORY, _history);
  saveToLocalStorage(KEYS.AUDIT_LOGS, _logs);
  saveToLocalStorage(KEYS.CLIENT_DOCUMENTS, _clientDocuments);
  saveToLocalStorage(KEYS.DOCUMENT_TYPES, _documentTypes);
  saveToLocalStorage(KEYS.QUOTATIONS, _quotations);
  saveToLocalStorage(KEYS.QUOTATION_ITEMS, _quotationItems);
  saveToLocalStorage(KEYS.QUOTATION_STATUS_HISTORY, _quotationHistory);
  saveToLocalStorage(KEYS.TERMS_CONDITIONS, _termsConditions);
  saveToLocalStorage(KEYS.ACCOUNTS, _accounts);
  saveToLocalStorage(KEYS.ACCOUNT_TRANSACTIONS, _accountTransactions);
  saveToLocalStorage(KEYS.JOURNAL_ENTRIES, _journalEntries);
};

const logAudit = (userId: string | undefined, action: string, tableName: string, recordId: string, oldData?: any, newData?: any) => {
  const log: AuditLog = {
    id: generateUUID(),
    user_id: userId,
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData ? JSON.parse(JSON.stringify(oldData)) : undefined,
    new_data: newData ? JSON.parse(JSON.stringify(newData)) : undefined,
    created_at: new Date().toISOString()
  };
  _logs.unshift(log);
  saveToLocalStorage(KEYS.AUDIT_LOGS, _logs);
};

export const getActiveUserSession = (): User => {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('azizi_active_session') : null;
  if (saved) {
    try {
      const u = JSON.parse(saved);
      if (u && u.id) {
        const found = _users.find(x => x.id === u.id && !x.is_deleted);
        return found || u;
      }
    } catch {}
  }
  return _users[0];
};

export const setActiveUserSession = (user: User) => {
  localStorage.setItem('azizi_active_session', JSON.stringify(user));
};

// ---------------------------------------------------------
// HIGH PERFORMANCE IN-MEMORY CACHE (0ms Sub-Second Navigation)
// ---------------------------------------------------------
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const _memCache = new Map<string, CacheEntry<any>>();

export const getCached = <T>(key: string): T | undefined => {
  const entry = _memCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > entry.ttl) {
    _memCache.delete(key);
    return undefined;
  }
  return entry.data;
};

export const setCached = <T>(key: string, data: T, ttlMs: number = 10000): T => {
  _memCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs
  });
  return data;
};

export const invalidateCache = (prefix?: string) => {
  if (!prefix) {
    _memCache.clear();
    return;
  }
  for (const key of _memCache.keys()) {
    if (key.startsWith(prefix)) {
      _memCache.delete(key);
    }
  }
};

const delay = <T>(value: T): Promise<T> => {
  return Promise.resolve(value);
};

// ---------------------------------------------------------
// COMBINED DB CRUD API (SUPABASE + LOCAL STORAGE FALLBACK)
// ---------------------------------------------------------
export const db = {
  branches: {
    getAll: async () => {
      const cacheKey = 'branches:all';
      const cached = getCached<Branch[]>(cacheKey);
      if (cached) return cached;

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('branches').select('*').eq('is_deleted', false);
        if (error) throw error;
        return setCached(cacheKey, data as Branch[], 30000);
      }
      return setCached(cacheKey, _branches.filter(b => !b.is_deleted), 30000);
    },
    getById: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('branches').select('*').eq('id', id).eq('is_deleted', false).maybeSingle();
        if (error) throw error;
        return data as Branch;
      }
      return delay(_branches.find(b => b.id === id && !b.is_deleted));
    },
    create: async (data: Omit<Branch, 'id' | 'is_deleted' | 'created_at' | 'updated_at'>) => {
      invalidateCache('branches');
      if (isSupabaseConfigured && supabase) {
        const { data: created, error } = await supabase.from('branches').insert([data]).select().single();
        if (error) throw error;
        return created as Branch;
      }
      const newBranch: Branch = {
        ...data,
        id: generateUUID(),
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      _branches.push(newBranch);
      saveAll();
      logAudit(getActiveUserSession().id, 'INSERT', 'branches', newBranch.id, null, newBranch);
      return delay(newBranch);
    },
    update: async (id: string, data: Partial<Omit<Branch, 'id' | 'created_at' | 'updated_at'>>) => {
      invalidateCache('branches');
      if (isSupabaseConfigured && supabase) {
        const { data: updated, error } = await supabase.from('branches').update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated as Branch;
      }
      const index = _branches.findIndex(b => b.id === id);
      if (index === -1) throw new Error('Branch not found');
      const old = _branches[index];
      const updated = { ...old, ...data, updated_at: new Date().toISOString() };
      _branches[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'UPDATE', 'branches', id, old, updated);
      return delay(updated);
    },
    delete: async (id: string) => {
      invalidateCache('branches');
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('branches').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
        return true;
      }
      const index = _branches.findIndex(b => b.id === id);
      if (index === -1) throw new Error('Branch not found');
      const old = _branches[index];
      const updated = { ...old, is_deleted: true, updated_at: new Date().toISOString() };
      _branches[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'DELETE_SOFT', 'branches', id, old, updated);
      return delay(true);
    }
  },

  roles: {
    getAll: async () => {
      const cacheKey = 'roles:all';
      const cached = getCached<Role[]>(cacheKey);
      if (cached) return cached;

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('roles').select('*').eq('is_deleted', false);
        if (error) throw error;
        return setCached(cacheKey, data as Role[], 30000);
      }
      return setCached(cacheKey, _roles.filter(r => !r.is_deleted), 30000);
    },
    getById: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('roles').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return data as Role;
      }
      return delay(_roles.find(r => r.id === id && !r.is_deleted));
    },
    create: async (data: Omit<Role, 'id' | 'is_deleted' | 'created_at' | 'updated_at'>) => {
      invalidateCache('roles');
      if (isSupabaseConfigured && supabase) {
        const { data: created, error } = await supabase.from('roles').insert([data]).select().single();
        if (error) throw error;
        return created as Role;
      }
      const newRole: Role = {
        ...data,
        id: generateUUID(),
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      _roles.push(newRole);
      saveAll();
      logAudit(getActiveUserSession().id, 'INSERT', 'roles', newRole.id, null, newRole);
      return delay(newRole);
    },
    update: async (id: string, data: Partial<Omit<Role, 'id' | 'created_at' | 'updated_at'>>) => {
      invalidateCache('roles');
      if (isSupabaseConfigured && supabase) {
        const { data: updated, error } = await supabase.from('roles').update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated as Role;
      }
      const index = _roles.findIndex(r => r.id === id);
      if (index === -1) throw new Error('Role not found');
      const old = _roles[index];
      const updated = { ...old, ...data, updated_at: new Date().toISOString() };
      _roles[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'UPDATE', 'roles', id, old, updated);
      return delay(updated);
    }
  },

  permissions: {
    getAll: async () => {
      const cacheKey = 'permissions:all';
      const cached = getCached<Permission[]>(cacheKey);
      if (cached) return cached;

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('permissions').select('*');
        if (error) throw error;
        return setCached(cacheKey, data as Permission[], 60000);
      }
      return setCached(cacheKey, _permissions, 60000);
    },
  },

  rolePermissions: {
    getByRoleId: async (roleId: string) => {
      const cacheKey = `role_permissions:${roleId}`;
      const cached = getCached<RolePermission[]>(cacheKey);
      if (cached) return cached;

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('role_permissions').select('*').eq('role_id', roleId);
        if (error) throw error;
        return setCached(cacheKey, data as RolePermission[], 60000);
      }
      return setCached(cacheKey, _rolePermissions.filter(rp => rp.role_id === roleId), 60000);
    },
    updateRolePermissions: async (roleId: string, permissionIds: string[]) => {
      invalidateCache('role_permissions');
      if (isSupabaseConfigured && supabase) {
        // Delete existing
        const { error: delErr } = await supabase.from('role_permissions').delete().eq('role_id', roleId);
        if (delErr) throw delErr;
        // Insert new
        if (permissionIds.length > 0) {
          const insertPayload = permissionIds.map(pId => ({ role_id: roleId, permission_id: pId }));
          const { data, error } = await supabase.from('role_permissions').insert(insertPayload).select();
          if (error) throw error;
          return data as RolePermission[];
        }
        return [];
      }
      const old = _rolePermissions.filter(rp => rp.role_id === roleId);
      _rolePermissions = _rolePermissions.filter(rp => rp.role_id !== roleId);
      const newPerms = permissionIds.map(pId => ({
        id: generateUUID(),
        role_id: roleId,
        permission_id: pId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      _rolePermissions.push(...newPerms);
      saveAll();
      logAudit(getActiveUserSession().id, 'UPDATE_ROLE_PERMISSIONS', 'role_permissions', roleId, old, newPerms);
      return delay(newPerms);
    }
  },

  users: {
    getAll: async () => {
      const cacheKey = 'users:all';
      const cached = getCached<User[]>(cacheKey);
      if (cached) return cached;

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('users').select('*, role:roles(*), branch:branches(*)').eq('is_deleted', false);
        if (error) throw error;
        return setCached(cacheKey, data as User[], 20000);
      }
      return setCached(cacheKey, _users.filter(u => !u.is_deleted).map(u => ({
        ...u,
        role: _roles.find(r => r.id === u.role_id),
        branch: _branches.find(b => b.id === u.branch_id)
      })), 20000);
    },
    getById: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('users').select('*, role:roles(*), branch:branches(*)').eq('id', id).maybeSingle();
        if (error) throw error;
        return data as User;
      }
      const u = _users.find(x => x.id === id && !x.is_deleted);
      if (!u) return delay(undefined);
      return delay({
        ...u,
        role: _roles.find(r => r.id === u.role_id),
        branch: _branches.find(b => b.id === u.branch_id)
      });
    },
    create: async (data: Omit<User, 'id' | 'is_deleted' | 'created_at' | 'updated_at'>) => {
      invalidateCache('users');
      const userPassword = data.password || 'password';
      if (isSupabaseConfigured && supabase) {
        const payload: any = { ...data, password: userPassword };
        delete payload.role;
        delete payload.branch;
        const { data: created, error } = await supabase.from('users').insert([payload]).select().single();
        if (error) throw error;
        return created as User;
      }
      const newUser: User = {
        ...data,
        password: userPassword,
        id: generateUUID(),
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      _users.push(newUser);
      saveAll();
      logAudit(getActiveUserSession().id, 'INSERT', 'users', newUser.id, null, newUser);
      return delay(newUser);
    },
    update: async (id: string, data: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>) => {
      invalidateCache('users');
      if (isSupabaseConfigured && supabase) {
        const updatePayload: any = { ...data };
        if (!updatePayload.password) delete updatePayload.password;
        delete updatePayload.role;
        delete updatePayload.branch;
        const { data: updated, error } = await supabase.from('users').update(updatePayload).eq('id', id).select().single();
        if (error) throw error;
        return updated as User;
      }
      const index = _users.findIndex(u => u.id === id);
      if (index === -1) throw new Error('User not found');
      const old = _users[index];
      const updatedPassword = data.password ? data.password : old.password;
      const updated = { ...old, ...data, password: updatedPassword, updated_at: new Date().toISOString() };
      _users[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'UPDATE', 'users', id, old, updated);
      return delay(updated);
    },
    delete: async (id: string) => {
      invalidateCache('users');
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('users').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
        return true;
      }
      const index = _users.findIndex(u => u.id === id);
      if (index === -1) throw new Error('User not found');
      const old = _users[index];
      const updated = { ...old, is_deleted: true, updated_at: new Date().toISOString() };
      _users[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'DELETE_SOFT', 'users', id, old, updated);
      return delay(true);
    }
  },

  customers: {
    getAll: async () => {
      const cacheKey = 'customers:all';
      const cached = getCached<Customer[]>(cacheKey);
      if (cached) return cached;

      let customersList: Customer[] = [];
      let salesList: { id: string; customer_id?: string; grand_total: number }[] = [];
      let paymentsList: { sale_id: string; amount: number }[] = [];

      if (isSupabaseConfigured && supabase) {
        const [{ data: c, error: cErr }, { data: s }, { data: p }] = await Promise.all([
          supabase.from('customers').select('*').eq('is_deleted', false).order('created_at', { ascending: false }),
          supabase.from('sales').select('id, customer_id, grand_total').eq('is_deleted', false),
          supabase.from('payments').select('sale_id, amount').or('is_deleted.is.null,is_deleted.eq.false')
        ]);
        if (cErr) throw cErr;
        customersList = c || [];
        salesList = (s || []).map(x => ({ id: x.id, customer_id: x.customer_id, grand_total: Number(x.grand_total || 0) }));
        paymentsList = (p || []).map(x => ({ sale_id: x.sale_id, amount: Number(x.amount || 0) }));
      } else {
        customersList = _customers.filter(c => !c.is_deleted);
        salesList = _sales.filter(s => !s.is_deleted);
        paymentsList = _payments.filter(p => !p.is_deleted);
      }

      // Pre-aggregate payments by sale_id for O(1) lookup
      const paymentsMap = new Map<string, number>();
      paymentsList.forEach(p => {
        paymentsMap.set(p.sale_id, (paymentsMap.get(p.sale_id) || 0) + p.amount);
      });

      // Pre-aggregate sales by customer_id for O(1) lookup
      const salesMap = new Map<string, { totalPurchased: number; totalPaid: number; count: number }>();
      salesList.forEach(s => {
        if (!s.customer_id) return;
        const current = salesMap.get(s.customer_id) || { totalPurchased: 0, totalPaid: 0, count: 0 };
        current.totalPurchased += s.grand_total;
        current.totalPaid += (paymentsMap.get(s.id) || 0);
        current.count += 1;
        salesMap.set(s.customer_id, current);
      });

      const res = customersList.map(c => {
        const stat = salesMap.get(c.id) || { totalPurchased: 0, totalPaid: 0, count: 0 };
        const due = Math.max(0, stat.totalPurchased - stat.totalPaid);

        return {
          ...c,
          due,
          total_paid: stat.totalPaid,
          total_purchased: stat.totalPurchased,
          sales_count: stat.count
        };
      });

      return setCached(cacheKey, res, 15000);
    },
    getById: async (id: string) => {
      let customerRecord: Customer | undefined;
      let salesList: Sale[] = [];
      let paymentsList: Payment[] = [];
      let branchesList: Branch[] = [];
      let statusesList: OrderStatus[] = [];

      if (isSupabaseConfigured && supabase) {
        const { data: c, error: cErr } = await supabase.from('customers').select('*').eq('id', id).eq('is_deleted', false).maybeSingle();
        if (cErr) throw cErr;
        customerRecord = c;

        if (customerRecord) {
          const [{ data: s }, { data: b }, { data: st }] = await Promise.all([
            supabase.from('sales').select('*').eq('customer_id', id).eq('is_deleted', false).order('created_at', { ascending: false }),
            supabase.from('branches').select('*'),
            supabase.from('order_statuses').select('*')
          ]);

          salesList = s || [];
          branchesList = b || [];
          statusesList = st || [];

          if (salesList.length > 0) {
            const sIds = salesList.map(x => x.id);
            const { data: p } = await supabase.from('payments').select('*').in('sale_id', sIds).or('is_deleted.is.null,is_deleted.eq.false');
            paymentsList = p || [];
          }
        }
      } else {
        customerRecord = _customers.find(x => x.id === id && !x.is_deleted);
        if (customerRecord) {
          salesList = _sales.filter(s => s.customer_id === id && !s.is_deleted);
          paymentsList = _payments.filter(p => !p.is_deleted);
          branchesList = _branches;
          statusesList = _statuses;
        }
      }

      if (!customerRecord) return undefined;

      const totalPurchased = salesList.reduce((sum: number, s: Sale) => sum + s.grand_total, 0);
      const saleIds = salesList.map(s => s.id);
      const totalPaid = paymentsList
        .filter((p: Payment) => saleIds.includes(p.sale_id))
        .reduce((sum: number, p: Payment) => sum + p.amount, 0);
      const due = Math.max(0, totalPurchased - totalPaid);

      const historySales = salesList.map(s => {
        const salePayments = paymentsList.filter(p => p.sale_id === s.id);
        const salePaidAmount = salePayments.reduce((sum: number, p: Payment) => sum + p.amount, 0);
        const remaining = Math.max(0, s.grand_total - salePaidAmount);
        return {
          ...s,
          payments: salePayments,
          total_paid: salePaidAmount,
          remaining,
          customer: _customers.find(c => c.id === s.customer_id) || customerRecord,
          branch: branchesList.find(b => b.id === s.branch_id),
          status: statusesList.find(st => st.id === s.order_status_id)
        };
      });

      return {
        ...customerRecord,
        due,
        total_paid: totalPaid,
        total_purchased: totalPurchased,
        sales: historySales,
        sales_count: salesList.length
      };
    },
    create: async (data: Omit<Customer, 'id' | 'is_deleted' | 'created_at' | 'updated_at'>) => {
      invalidateCache('customers');
      invalidateCache('sales');
      if (isSupabaseConfigured && supabase) {
        const payload = { ...data, id: generateUUID() };
        const { data: created, error } = await supabase.from('customers').insert([payload]).select().single();
        if (error) throw error;
        return created as Customer;
      }
      const newCust: Customer = {
        ...data,
        id: generateUUID(),
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      _customers.push(newCust);
      saveAll();
      logAudit(getActiveUserSession().id, 'INSERT', 'customers', newCust.id, null, newCust);
      return delay(newCust);
    },
    update: async (id: string, data: Partial<Omit<Customer, 'id' | 'created_at' | 'updated_at'>>) => {
      invalidateCache('customers');
      invalidateCache('sales');
      if (isSupabaseConfigured && supabase) {
        const { data: updated, error } = await supabase.from('customers').update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated as Customer;
      }
      const index = _customers.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Customer not found');
      const old = _customers[index];
      const updated = { ...old, ...data, updated_at: new Date().toISOString() };
      _customers[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'UPDATE', 'customers', id, old, updated);
      return delay(updated);
    },
    delete: async (id: string) => {
      invalidateCache('customers');
      invalidateCache('sales');
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('customers').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
        return true;
      }
      const index = _customers.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Customer not found');
      const old = _customers[index];
      const updated = { ...old, is_deleted: true, updated_at: new Date().toISOString() };
      _customers[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'DELETE_SOFT', 'customers', id, old, updated);
      return delay(true);
    },
    deleteAll: async () => {
      invalidateCache('customers');
      invalidateCache('sales');
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('customers').update({ is_deleted: true }).neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        return true;
      }
      _customers = [];
      saveAll();
      return delay(true);
    }
  },

  serviceCategories: {
    getAll: async () => {
      const cacheKey = 'service_categories:all';
      const cached = getCached<ServiceCategory[]>(cacheKey);
      if (cached) return cached;

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('service_categories').select('*').eq('is_deleted', false);
        if (error) throw error;
        return setCached(cacheKey, data as ServiceCategory[], 30000);
      }
      return setCached(cacheKey, _categories.filter(c => !c.is_deleted), 30000);
    },
    getById: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('service_categories').select('*').eq('id', id).eq('is_deleted', false).maybeSingle();
        if (error) throw error;
        return data as ServiceCategory;
      }
      return delay(_categories.find(c => c.id === id && !c.is_deleted));
    },
    create: async (data: Omit<ServiceCategory, 'id' | 'is_deleted' | 'created_at' | 'updated_at'>) => {
      invalidateCache('service_categories');
      invalidateCache('services');
      if (isSupabaseConfigured && supabase) {
        const { data: created, error } = await supabase.from('service_categories').insert([data]).select().single();
        if (error) throw error;
        return created as ServiceCategory;
      }
      const newCat: ServiceCategory = {
        ...data,
        id: generateUUID(),
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      _categories.push(newCat);
      saveAll();
      logAudit(getActiveUserSession().id, 'INSERT', 'service_categories', newCat.id, null, newCat);
      return delay(newCat);
    },
    update: async (id: string, data: Partial<Omit<ServiceCategory, 'id' | 'created_at' | 'updated_at'>>) => {
      invalidateCache('service_categories');
      invalidateCache('services');
      if (isSupabaseConfigured && supabase) {
        const { data: updated, error } = await supabase.from('service_categories').update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated as ServiceCategory;
      }
      const index = _categories.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Category not found');
      const old = _categories[index];
      const updated = { ...old, ...data, updated_at: new Date().toISOString() };
      _categories[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'UPDATE', 'service_categories', id, old, updated);
      return delay(updated);
    },
    delete: async (id: string) => {
      invalidateCache('service_categories');
      invalidateCache('services');
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('service_categories').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
        return true;
      }
      const index = _categories.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Category not found');
      const old = _categories[index];
      const updated = { ...old, is_deleted: true, updated_at: new Date().toISOString() };
      _categories[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'DELETE_SOFT', 'service_categories', id, old, updated);
      return delay(true);
    }
  },

  services: {
    getAll: async () => {
      const cacheKey = 'services:all';
      const cached = getCached<Service[]>(cacheKey);
      if (cached) return cached;

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('services').select('*, category:service_categories(*)').eq('is_deleted', false);
        if (error) throw error;
        return setCached(cacheKey, data as Service[], 25000);
      }
      return setCached(cacheKey, _services.filter(s => !s.is_deleted).map(s => ({
        ...s,
        category: _categories.find(c => c.id === s.category_id)
      })), 25000);
    },
    getById: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('services').select('*, category:service_categories(*)').eq('id', id).eq('is_deleted', false).maybeSingle();
        if (error) throw error;
        return data as Service;
      }
      const srv = _services.find(s => s.id === id && !s.is_deleted);
      if (!srv) return delay(undefined);
      return delay({
        ...srv,
        category: _categories.find(c => c.id === srv.category_id)
      });
    },
    create: async (data: Omit<Service, 'id' | 'is_deleted' | 'created_at' | 'updated_at'>) => {
      invalidateCache('services');
      if (isSupabaseConfigured && supabase) {
        const payload = { ...data, id: generateUUID() };
        const { data: created, error } = await supabase.from('services').insert([payload]).select().single();
        if (error) throw error;
        return created as Service;
      }
      const newSrv: Service = {
        ...data,
        id: generateUUID(),
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      _services.push(newSrv);
      saveAll();
      logAudit(getActiveUserSession().id, 'INSERT', 'services', newSrv.id, null, newSrv);
      return delay(newSrv);
    },
    update: async (id: string, data: Partial<Omit<Service, 'id' | 'created_at' | 'updated_at'>>) => {
      invalidateCache('services');
      if (isSupabaseConfigured && supabase) {
        const { data: updated, error } = await supabase.from('services').update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated as Service;
      }
      const index = _services.findIndex(s => s.id === id);
      if (index === -1) throw new Error('Service not found');
      const old = _services[index];
      const updated = { ...old, ...data, updated_at: new Date().toISOString() };
      _services[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'UPDATE', 'services', id, old, updated);
      return delay(updated);
    },
    delete: async (id: string) => {
      invalidateCache('services');
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('services').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
        return true;
      }
      const index = _services.findIndex(s => s.id === id);
      if (index === -1) throw new Error('Service not found');
      const old = _services[index];
      const updated = { ...old, is_deleted: true, updated_at: new Date().toISOString() };
      _services[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'DELETE_SOFT', 'services', id, old, updated);
      return delay(true);
    }
  },

  orderStatuses: {
    getAll: async () => {
      const cacheKey = 'order_statuses:all';
      const cached = getCached<OrderStatus[]>(cacheKey);
      if (cached) return cached;

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('order_statuses').select('*').eq('is_deleted', false).order('sequence', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) {
          const defaultStatuses = SEED_ORDER_STATUSES();
          const { data: seeded, error: seedErr } = await supabase.from('order_statuses').upsert(defaultStatuses, { onConflict: 'id' }).select();
          if (!seedErr && seeded && seeded.length > 0) return setCached(cacheKey, seeded as OrderStatus[], 30000);
        }
        return setCached(cacheKey, (data || []) as OrderStatus[], 30000);
      }
      return setCached(cacheKey, _statuses.filter(s => !s.is_deleted).sort((a, b) => a.sequence - b.sequence), 30000);
    },
    create: async (data: Omit<OrderStatus, 'id' | 'is_deleted' | 'is_system' | 'created_at' | 'updated_at'>) => {
      invalidateCache('order_statuses');
      if (isSupabaseConfigured && supabase) {
        const { data: created, error } = await supabase.from('order_statuses').insert([data]).select().single();
        if (error) throw error;
        return created as OrderStatus;
      }
      const newStatus: OrderStatus = {
        ...data,
        id: generateUUID(),
        is_system: false,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      _statuses.push(newStatus);
      saveAll();
      logAudit(getActiveUserSession().id, 'INSERT', 'order_statuses', newStatus.id, null, newStatus);
      return delay(newStatus);
    },
    update: async (id: string, data: Partial<Omit<OrderStatus, 'id' | 'is_system' | 'created_at' | 'updated_at'>>) => {
      invalidateCache('order_statuses');
      if (isSupabaseConfigured && supabase) {
        const { data: updated, error } = await supabase.from('order_statuses').update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated as OrderStatus;
      }
      const index = _statuses.findIndex(s => s.id === id);
      if (index === -1) throw new Error('Status not found');
      const old = _statuses[index];
      const updated = { ...old, ...data, updated_at: new Date().toISOString() };
      _statuses[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'UPDATE', 'order_statuses', id, old, updated);
      return delay(updated);
    },
    delete: async (id: string) => {
      invalidateCache('order_statuses');
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('order_statuses').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
        return true;
      }
      const index = _statuses.findIndex(s => s.id === id);
      if (index === -1) throw new Error('Status not found');
      const old = _statuses[index];
      if (old.is_system) throw new Error('Cannot delete system-configured status');
      const updated = { ...old, is_deleted: true, updated_at: new Date().toISOString() };
      _statuses[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'DELETE_SOFT', 'order_statuses', id, old, updated);
      return delay(true);
    }
  },

  sales: {
    getAll: async (branchId?: string) => {
      const cacheKey = `sales:${branchId || 'all'}`;
      const cached = getCached<Sale[]>(cacheKey);
      if (cached) return cached;

      if (isSupabaseConfigured && supabase) {
        let query = supabase.from('sales').select('*, customer:customers(*), branch:branches(*), employee:users!employee_id(*), order_status:order_statuses(*)').eq('is_deleted', false).order('created_at', { ascending: false });
        if (branchId) {
          query = query.eq('branch_id', branchId);
        }
        const { data: sales, error } = await query;
        if (error) throw error;
        if (!sales || sales.length === 0) return setCached(cacheKey, [], 10000);

        const saleIds = sales.map(s => s.id);

        const [{ data: allItems }, { data: allPayments }] = await Promise.all([
          supabase.from('sale_items').select('id, sale_id, service_id, quantity, unit_price, subtotal, person_name, service:services(id, name, code)').in('sale_id', saleIds),
          supabase.from('payments').select('*').in('sale_id', saleIds).or('is_deleted.is.null,is_deleted.eq.false')
        ]);

        const itemsBySale = new Map<string, any[]>();
        (allItems || []).forEach(item => {
          if (!itemsBySale.has(item.sale_id)) itemsBySale.set(item.sale_id, []);
          itemsBySale.get(item.sale_id)!.push(item);
        });

        const paymentsBySale = new Map<string, any[]>();
        (allPayments || []).forEach(p => {
          if (!paymentsBySale.has(p.sale_id)) paymentsBySale.set(p.sale_id, []);
          paymentsBySale.get(p.sale_id)!.push(p);
        });

        const result = sales.map(s => ({
          ...s,
          items: itemsBySale.get(s.id) || [],
          payments: paymentsBySale.get(s.id) || []
        }));

        return setCached(cacheKey, result, 10000);
      }

      let list = _sales.filter(s => !s.is_deleted);
      if (branchId) {
        list = list.filter(s => s.branch_id === branchId);
      }
      const result = list.map(s => ({
        ...s,
        customer: _customers.find(c => c.id === s.customer_id),
        branch: _branches.find(b => b.id === s.branch_id),
        employee: _users.find(u => u.id === s.employee_id),
        order_status: _statuses.find(os => os.id === s.order_status_id),
        items: _saleItems.filter((si: SaleItem) => si.sale_id === s.id).map((si: SaleItem) => ({
          ...si,
          service: _services.find(srv => srv.id === si.service_id),
          staff: _users.find(u => u.id === (si.staff_id || s.employee_id))
        })),
        payments: _payments.filter((p: Payment) => p.sale_id === s.id && !p.is_deleted).map(p => ({
          ...p,
          is_refund: p.is_refund || p.amount < 0 || p.notes?.includes('[Refund]'),
          refund_reason: p.refund_reason || (p.notes?.includes('[Refund]') ? p.notes.replace(/\[Refund\]\s*/, '').replace(/\[Member:\s*[^\]]+\]/g, '').trim() : undefined),
          person_name: p.person_name || (p.notes?.match(/\[Member:\s*(.*?)\]/)?.[1]) || undefined
        }))
      }));

      return setCached(cacheKey, result, 10000);
    },
    getById: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data: s, error: sErr } = await supabase.from('sales').select('*, customer:customers(*), branch:branches(*), employee:users!employee_id(*), order_status:order_statuses(*)').eq('id', id).eq('is_deleted', false).maybeSingle();
        if (sErr) throw sErr;
        if (!s) return undefined;

        const { data: rawItems } = await supabase.from('sale_items').select('*, service:services(*), staff:users!staff_id(*)').eq('sale_id', id);
        const { data: paymentsList } = await supabase.from('payments').select('*').eq('sale_id', id).or('is_deleted.is.null,is_deleted.eq.false').order('created_at', { ascending: true });
        const { data: history } = await supabase.from('order_status_history').select('*, new_status:order_statuses(*), user:users(*)').eq('sale_id', id).order('created_at', { ascending: false });
        const { data: dbExpenses } = await supabase.from('expenses').select('*').eq('sale_id', id).eq('is_deleted', false);

        const localExpenses = _expenses.filter((e: Expense) => e.sale_id === id && !e.is_deleted);
        const allSaleExpenses: any[] = [...(dbExpenses || [])];
        for (const le of localExpenses) {
          if (!allSaleExpenses.some(e => e.id === le.id)) {
            allSaleExpenses.push(le);
          }
        }

        const itemsList = rawItems || [];
        const items = itemsList.map((si: any) => {
          const itemExps = allSaleExpenses.filter((e: any) => {
            if (e.sale_item_id === si.id) return true;
            if (e.id === si.expense_id) return true;
            if (e.description && (e.description.includes(`[Item: ${si.id}]`) || e.description.includes(si.id))) return true;
            if (itemsList.length === 1) return true;
            return false;
          });
          const itemExpTotal = itemExps.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
          return {
            ...si,
            expenses: itemExps,
            expense: itemExpTotal > 0 ? itemExpTotal : (Number(si.expense) || 0)
          };
        });

        return {
          ...s,
          items: items,
          payments: (paymentsList || []).map((p: any) => ({
            ...p,
            is_refund: p.is_refund || p.amount < 0 || p.notes?.includes('[Refund]'),
            refund_reason: p.refund_reason || (p.notes?.includes('[Refund]') ? p.notes.replace(/\[Refund\]\s*/, '').replace(/\[Member:\s*[^\]]+\]/g, '').trim() : undefined),
            person_name: p.person_name || (p.notes?.match(/\[Member:\s*(.*?)\]/)?.[1]) || undefined
          })),
          history: history || []
        };
      }

      const s = _sales.find(x => x.id === id && !x.is_deleted);
      if (!s) return delay(undefined);
      const allSaleExpenses = _expenses.filter((e: Expense) => e.sale_id === s.id && !e.is_deleted);
      const itemsList = _saleItems.filter((si: SaleItem) => si.sale_id === s.id);
      const items = itemsList.map((si: SaleItem) => {
        const itemExpenses = allSaleExpenses.filter((e: Expense) => {
          if (e.sale_item_id === si.id) return true;
          if (e.id === si.expense_id) return true;
          if (e.description && (e.description.includes(`[Item: ${si.id}]`) || e.description.includes(si.id))) return true;
          if (itemsList.length === 1) return true;
          return false;
        });
        const itemExpenseTotal = itemExpenses.reduce((sum: number, e: Expense) => sum + (Number(e.amount) || 0), 0);
        return {
          ...si,
          service: _services.find(srv => srv.id === si.service_id),
          staff: _users.find(u => u.id === (si.staff_id || s.employee_id)),
          account: _accounts.find(a => a.id === si.account_id),
          expenses: itemExpenses,
          expense: itemExpenseTotal > 0 ? itemExpenseTotal : (Number(si.expense) || 0)
        };
      });

      const paymentsList = _payments.filter((p: Payment) => p.sale_id === s.id && !p.is_deleted).map(p => ({
        ...p,
        is_refund: p.is_refund || p.amount < 0 || p.notes?.includes('[Refund]'),
        refund_reason: p.refund_reason || (p.notes?.includes('[Refund]') ? p.notes.replace(/\[Refund\]\s*/, '').replace(/\[Member:\s*[^\]]+\]/g, '').trim() : undefined),
        person_name: p.person_name || (p.notes?.match(/\[Member:\s*(.*?)\]/)?.[1]) || undefined
      }));
      
      const statusHistory = _history.filter((h: OrderStatusHistory) => h.sale_id === s.id).map((h: OrderStatusHistory) => ({
        ...h,
        previous_status: _statuses.find(os => os.id === h.previous_status_id),
        new_status: _statuses.find(os => os.id === h.new_status_id),
        user: _users.find(u => u.id === h.changed_by)
      })).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return delay({
        ...s,
        customer: _customers.find(c => c.id === s.customer_id),
        branch: _branches.find(b => b.id === s.branch_id),
        employee: _users.find(u => u.id === s.employee_id),
        order_status: _statuses.find(os => os.id === s.order_status_id),
        items,
        payments: paymentsList,
        history: statusHistory
      });
    },
    create: async (data: {
      customer_id?: string;
      branch_id: string;
      discount: number;
      notes?: string;
      items: Array<{ service_id: string; quantity: number; unit_price: number; person_name?: string; service_date?: string; staff_id?: string; notes?: string }>;
      initialPayment?: { amount: number; payment_method: Payment['payment_method'] };
      person_name?: string;
      person_phone?: string;
      person_email?: string;
      quotation_id?: string;
      expenses?: Array<{ amount: number; description: string; account_id?: string; category_id?: string; payment_method?: Expense['payment_method'] }>;
    }) => {
      invalidateCache('sales');
      invalidateCache('customers');
      invalidateCache('accounts');
      invalidateCache('journal');
      invalidateCache('payments');
      const subtotal = data.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
      const grand_total = Math.max(0, subtotal - data.discount);
      const activeUser = getActiveUserSession();
      const now = new Date();

      if (isSupabaseConfigured && supabase) {
        // Fetch pending status safely
        let pendingStatusId = '11111111-0000-0000-0000-000000000001';
        const { data: stData } = await supabase.from('order_statuses').select('id').ilike('name', 'Pending').limit(1).maybeSingle();
        if (stData?.id) {
          pendingStatusId = stData.id;
        } else {
          // Check if any order status exists
          const { data: anyStatus } = await supabase.from('order_statuses').select('id').order('sequence', { ascending: true }).limit(1).maybeSingle();
          if (anyStatus?.id) {
            pendingStatusId = anyStatus.id;
          } else {
            // Auto-seed default statuses into supabase
            const defaultStatuses = SEED_ORDER_STATUSES();
            await supabase.from('order_statuses').upsert(defaultStatuses, { onConflict: 'id' });
          }
        }

        const { count } = await supabase.from('sales').select('*', { count: 'exact', head: true });
        const invoiceSeq = (count || 0) + 1;
        const serialStr = invoiceSeq.toString().padStart(4, '0');
        const invoice_no = `INV-${serialStr}`;

        const paidAmount = data.initialPayment ? data.initialPayment.amount : 0;
        let payment_status: Sale['payment_status'] = 'Unpaid';
        if (paidAmount >= grand_total) payment_status = 'Paid';
        else if (paidAmount > 0) payment_status = 'Partially Paid';

        const saleId = generateUUID();
        const customerId = sanitizeUUID(data.customer_id);
        const employeeId = sanitizeUUID(activeUser?.id);
        const quotationId = sanitizeUUID(data.quotation_id);

        const { data: createdSale, error: saleErr } = await supabase.from('sales').insert([{
          id: saleId,
          invoice_no,
          customer_id: customerId,
          branch_id: data.branch_id,
          employee_id: employeeId,
          discount: Number(data.discount) || 0,
          subtotal: Number(subtotal) || 0,
          grand_total: Number(grand_total) || 0,
          payment_status,
          order_status_id: pendingStatusId,
          notes: data.notes || null,
          created_by: employeeId,
          updated_by: employeeId,
          person_name: data.person_name || null,
          person_phone: data.person_phone || null,
          person_email: data.person_email || null,
          quotation_id: quotationId
        }]).select().single();

        if (saleErr) throw saleErr;

        if (createdSale) {
          const itemsPayload = data.items.map(item => ({
            id: generateUUID(),
            sale_id: createdSale.id,
            service_id: item.service_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.unit_price * item.quantity,
            service_date: item.service_date || new Date().toISOString().split('T')[0],
            person_name: item.person_name || null,
            staff_id: item.staff_id ? sanitizeUUID(item.staff_id) : employeeId,
            notes: item.notes || null
          }));

          const { error: itemsErr } = await supabase.from('sale_items').insert(itemsPayload);
          if (itemsErr) {
            // Fallback in case notes column is pending in db schema
            const fallbackPayload = itemsPayload.map(({ notes, ...rest }) => rest);
            const { error: fbErr } = await supabase.from('sale_items').insert(fallbackPayload);
            if (fbErr) throw fbErr;
          }

          if (data.initialPayment && data.initialPayment.amount > 0) {
            await db.payments.create({
              sale_id: createdSale.id,
              amount: data.initialPayment.amount,
              payment_method: data.initialPayment.payment_method,
              transaction_no: (data.initialPayment as any).transaction_no || undefined,
              notes: (data.initialPayment as any).notes || undefined,
              person_name: data.person_name || undefined
            });
          }

          if (data.quotation_id) {
            await supabase.from('quotations').update({ 
              status: 'Converted',
              remarks: `Converted to Sale Invoice #${invoice_no}`,
              updated_at: new Date().toISOString()
            }).eq('id', data.quotation_id);
          }

          if (data.expenses && data.expenses.length > 0) {
            for (const exp of data.expenses) {
              if (exp.amount > 0) {
                await db.expenses.create({
                  amount: exp.amount,
                  description: exp.description || `Cost for ${data.person_name ? `${data.person_name} ` : ''}Invoice #${invoice_no}`,
                  category_id: exp.category_id || _expenseCats[0]?.id || '11111111-2222-3333-4444-555555555555',
                  branch_id: data.branch_id,
                  expense_date: now.toISOString().split('T')[0],
                  payment_method: exp.payment_method || (exp.account_id ? 'Card' : 'Cash'),
                  sale_id: createdSale.id,
                  account_id: exp.account_id
                });
              }
            }
          }
        }
        return createdSale as Sale;
      }

      const invoiceSeq = _sales.length + 1;
      const serialStr = invoiceSeq.toString().padStart(4, '0');
      const invoice_no = `INV-${serialStr}`;
      const pendingStatus = _statuses.find(os => os.name === 'Pending') || _statuses[0];
      const saleId = generateUUID();

      const createdItems: SaleItem[] = data.items.map(item => ({
        id: generateUUID(),
        sale_id: saleId,
        service_id: item.service_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.unit_price * item.quantity,
        person_name: item.person_name || undefined,
        service_date: item.service_date || now.toISOString().split('T')[0],
        staff_id: item.staff_id || activeUser.id,
        notes: item.notes || undefined,
        created_at: item.service_date ? new Date(item.service_date).toISOString() : now.toISOString(),
        updated_at: now.toISOString()
      }));

      const paidAmount = data.initialPayment ? data.initialPayment.amount : 0;
      let payment_status: Sale['payment_status'] = 'Unpaid';
      if (paidAmount >= grand_total) payment_status = 'Paid';
      else if (paidAmount > 0) payment_status = 'Partially Paid';

      const newSale: Sale = {
        id: saleId,
        invoice_no,
        customer_id: data.customer_id,
        branch_id: data.branch_id,
        employee_id: activeUser.id,
        discount: data.discount,
        subtotal,
        grand_total,
        payment_status,
        order_status_id: pendingStatus.id,
        notes: data.notes,
        is_deleted: false,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        created_by: activeUser.id,
        updated_by: activeUser.id,
        person_name: data.person_name,
        person_phone: data.person_phone,
        person_email: data.person_email,
        quotation_id: data.quotation_id
      };

      _sales.push(newSale);
      _saleItems.push(...createdItems);

      if (data.quotation_id) {
        const qIndex = _quotations.findIndex(x => x.id === data.quotation_id);
        if (qIndex !== -1) {
          _quotations[qIndex] = {
            ..._quotations[qIndex],
            status: 'Converted',
            converted_sale_id: saleId,
            updated_at: now.toISOString()
          };

          const hist: QuotationStatusHistory = {
            id: generateUUID(),
            quotation_id: data.quotation_id,
            status: 'Converted',
            remarks: `Converted to Sale Invoice #${invoice_no}`,
            changed_at: now.toISOString(),
            changed_by: activeUser.id
          };
          _quotationHistory.unshift(hist);
        }
      }

      if (data.initialPayment && data.initialPayment.amount > 0) {
        const newPay: Payment = {
          id: generateUUID(),
          sale_id: saleId,
          amount: data.initialPayment.amount,
          payment_method: data.initialPayment.payment_method,
          payment_date: now.toISOString(),
          received_by: activeUser.id,
          is_deleted: false,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
          created_by: activeUser.id,
          updated_by: activeUser.id
        };
        _payments.push(newPay);
      }

      const hist: OrderStatusHistory = {
        id: generateUUID(),
        sale_id: saleId,
        previous_status_id: undefined,
        new_status_id: pendingStatus.id,
        changed_by: activeUser.id,
        remarks: 'Order Invoice Created',
        created_at: now.toISOString()
      };
      _history.push(hist);

      if (data.expenses && data.expenses.length > 0) {
        for (const exp of data.expenses) {
          if (exp.amount > 0) {
            await db.expenses.create({
              amount: exp.amount,
              description: exp.description || `Cost for ${data.person_name ? `${data.person_name} ` : ''}Invoice #${invoice_no}`,
              category_id: exp.category_id || _expenseCats[0]?.id || '11111111-2222-3333-4444-555555555555',
              branch_id: data.branch_id,
              expense_date: now.toISOString().split('T')[0],
              payment_method: exp.payment_method || (exp.account_id ? 'Card' : 'Cash'),
              sale_id: saleId,
              account_id: exp.account_id
            });
          }
        }
      }

      saveAll();
      logAudit(activeUser.id, 'INSERT_SALE', 'sales', saleId, null, newSale);
      
      return delay(newSale);
    },
    getExpenses: async (saleId: string) => {
      const allExpenses = await db.expenses.getAll();
      return allExpenses.filter(e => e.sale_id === saleId);
    },
    updateStatus: async (saleId: string, newStatusId: string, remarks?: string) => {
      invalidateCache('sales');
      const activeUser = getActiveUserSession();
      const employeeId = sanitizeUUID(activeUser?.id);
      
      if (isSupabaseConfigured && supabase) {
        const { data: old } = await supabase.from('sales').select('order_status_id').eq('id', saleId).maybeSingle();
        const oldStatusId = old?.order_status_id;
        
        const { data: updated, error } = await supabase.from('sales').update({ order_status_id: newStatusId, updated_by: employeeId }).eq('id', saleId).select().single();
        if (error) throw error;

        // Record history
        await supabase.from('order_status_history').insert([{
          sale_id: saleId,
          previous_status_id: sanitizeUUID(oldStatusId),
          new_status_id: newStatusId,
          changed_by: employeeId,
          remarks: remarks || 'Status updated via dashboard'
        }]);

        return updated as Sale;
      }

      const index = _sales.findIndex(s => s.id === saleId);
      if (index === -1) throw new Error('Sale not found');
      const oldSale = _sales[index];
      
      if (oldSale.order_status_id === newStatusId) return delay(oldSale);

      const updated = {
        ...oldSale,
        order_status_id: newStatusId,
        updated_by: activeUser.id,
        updated_at: new Date().toISOString()
      };
      _sales[index] = updated;

      const hist: OrderStatusHistory = {
        id: generateUUID(),
        sale_id: saleId,
        previous_status_id: oldSale.order_status_id,
        new_status_id: newStatusId,
        changed_by: activeUser.id,
        remarks: remarks || 'Status updated via dashboard',
        created_at: new Date().toISOString()
      };
      _history.push(hist);

      saveAll();
      logAudit(activeUser.id, 'UPDATE_SALE_STATUS', 'sales', saleId, oldSale, updated);
      return delay(updated);
    },
    delete: async (id: string) => {
      invalidateCache('sales');
      invalidateCache('customers');
      invalidateCache('accounts');
      invalidateCache('journal');
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('sales').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
        return true;
      }
      const index = _sales.findIndex(s => s.id === id);
      if (index === -1) throw new Error('Sale not found');
      const old = _sales[index];
      const updated = { ...old, is_deleted: true, updated_at: new Date().toISOString() };
      _sales[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'DELETE_SOFT_SALE', 'sales', id, old, updated);
      return delay(true);
    },
    addItem: async (saleId: string, item: { service_id: string; quantity: number; unit_price: number; expense?: number; account_id?: string; person_name?: string; service_date?: string; staff_id?: string }) => {
      invalidateCache('sales');
      invalidateCache('customers');
      invalidateCache('accounts');
      invalidateCache('journal');
      const activeUser = getActiveUserSession();
      const employeeId = sanitizeUUID(activeUser?.id);
      const targetStaffId = item.staff_id ? sanitizeUUID(item.staff_id) : employeeId;
      const now = new Date();
      const subtotal = item.unit_price * item.quantity;
      const serviceDate = item.service_date || now.toISOString().split('T')[0];

      let createdExpenseId: string | undefined = undefined;
      const numExpense = Number(item.expense) || 0;
      if (numExpense > 0 && item.account_id) {
        const srv = _services.find(s => s.id === item.service_id);
        const cats = await db.expenseCategories.getAll();
        const govCat = cats.find(c => c.name.toLowerCase().includes('gov') || c.name.toLowerCase().includes('visa') || c.name.toLowerCase().includes('cost')) || cats[0];
        const exp = await db.expenses.create({
          category_id: govCat?.id || '',
          branch_id: _sales.find(s => s.id === saleId)?.branch_id || '',
          amount: numExpense,
          expense_date: serviceDate,
          description: `${srv?.name || 'Service'} Gov Fee${item.person_name ? ` (${item.person_name})` : ''}`,
          payment_method: 'Card',
          account_id: item.account_id,
          sale_id: saleId
        });
        createdExpenseId = exp.id;
      }

      if (isSupabaseConfigured && supabase) {
        const { error: itemErr } = await supabase.from('sale_items').insert([{
          sale_id: saleId,
          service_id: item.service_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal,
          person_name: item.person_name || null,
          service_date: serviceDate,
          staff_id: targetStaffId
        }]);
        if (itemErr) throw itemErr;

        const { data: allItems } = await supabase.from('sale_items').select('subtotal').eq('sale_id', saleId);
        const newSubtotal = (allItems || []).reduce((s: number, i: any) => s + i.subtotal, 0);
        const { data: saleRow } = await supabase.from('sales').select('discount').eq('id', saleId).maybeSingle();
        const newGrandTotal = Math.max(0, newSubtotal - (saleRow?.discount || 0));

        const { data: updated, error: upErr } = await supabase.from('sales').update({
          subtotal: newSubtotal,
          grand_total: newGrandTotal,
          updated_by: employeeId
        }).eq('id', saleId).select().single();
        if (upErr) throw upErr;
        return updated as Sale;
      }

      const saleIndex = _sales.findIndex(s => s.id === saleId);
      if (saleIndex === -1) throw new Error('Sale not found');
      const newItem: SaleItem = {
        id: generateUUID(),
        sale_id: saleId,
        service_id: item.service_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal,
        expense: numExpense > 0 ? numExpense : undefined,
        account_id: item.account_id || undefined,
        expense_id: createdExpenseId,
        person_name: item.person_name || undefined,
        service_date: serviceDate,
        staff_id: item.staff_id || activeUser.id,
        created_at: item.service_date ? new Date(item.service_date).toISOString() : now.toISOString(),
        updated_at: now.toISOString()
      };
      _saleItems.push(newItem);
      const allItems = _saleItems.filter(si => si.sale_id === saleId);
      const newSubtotal = allItems.reduce((s, i) => s + i.subtotal, 0);
      const oldSale = _sales[saleIndex];
      const newGrandTotal = Math.max(0, newSubtotal - oldSale.discount);
      const updated = { ...oldSale, subtotal: newSubtotal, grand_total: newGrandTotal, updated_at: now.toISOString() };
      _sales[saleIndex] = updated;
      saveAll();
      logAudit(activeUser.id, 'ADD_SALE_ITEM', 'sale_items', newItem.id, null, newItem);
      return delay(updated as Sale);
    },
    updateItemCost: async (saleId: string, saleItemId: string, expense: number, account_id?: string) => {
      const activeUser = getActiveUserSession();
      const now = new Date().toISOString();
      const idx = _saleItems.findIndex(si => si.id === saleItemId);
      if (idx === -1) throw new Error('Item not found');
      const old = _saleItems[idx];

      // Remove old expense if exists
      if (old.expense_id) {
        try {
          await db.expenses.delete(old.expense_id);
        } catch (e) {
          console.warn('Could not remove old expense:', e);
        }
      }

      let createdExpenseId: string | undefined = undefined;
      const numExpense = Number(expense) || 0;
      if (numExpense > 0 && account_id) {
        const srv = _services.find(s => s.id === old.service_id);
        const sale = _sales.find(s => s.id === saleId);
        const cats = await db.expenseCategories.getAll();
        const govCat = cats.find(c => c.name.toLowerCase().includes('gov') || c.name.toLowerCase().includes('visa') || c.name.toLowerCase().includes('cost')) || cats[0];
        const exp = await db.expenses.create({
          category_id: govCat?.id || '',
          branch_id: sale?.branch_id || '',
          amount: numExpense,
          expense_date: now.split('T')[0],
          description: `${srv?.name || 'Service'} Gov Fee${old.person_name ? ` (${old.person_name})` : ''}`,
          payment_method: 'Card',
          account_id: account_id,
          sale_id: saleId
        });
        createdExpenseId = exp.id;
      }

      const updatedItem: SaleItem = {
        ...old,
        expense: numExpense > 0 ? numExpense : 0,
        account_id: account_id || undefined,
        expense_id: createdExpenseId,
        updated_at: now
      };
      _saleItems[idx] = updatedItem;
      saveAll();
      logAudit(activeUser.id, 'UPDATE_SALE_ITEM_COST', 'sale_items', saleItemId, old, updatedItem);
      return delay(updatedItem);
    },
    addServiceExpense: async (data: {
      sale_id: string;
      sale_item_id: string;
      amount: number;
      account_id?: string;
      description?: string;
      expense_date?: string;
      category_id?: string;
    }) => {
      const now = new Date().toISOString();
      const sale = _sales.find(s => s.id === data.sale_id);
      const item = _saleItems.find(si => si.id === data.sale_item_id);
      const srv = item ? _services.find(s => s.id === item.service_id) : undefined;
      
      const cats = await db.expenseCategories.getAll();
      const govCat = cats.find(c => c.name.toLowerCase().includes('gov') || c.name.toLowerCase().includes('visa') || c.name.toLowerCase().includes('cost')) || cats[0];
      
      const defaultDesc = `${srv?.name || 'Service'} Gov Fee${item?.person_name ? ` (${item.person_name})` : ''}`;
      const desc = data.description ? data.description.trim() : defaultDesc;

      const exp = await db.expenses.create({
        category_id: data.category_id || govCat?.id || '',
        branch_id: sale?.branch_id || '',
        amount: Number(data.amount) || 0,
        expense_date: data.expense_date || now.split('T')[0],
        description: desc,
        payment_method: 'Card',
        account_id: data.account_id,
        sale_id: data.sale_id,
        sale_item_id: data.sale_item_id
      });

      return exp;
    },
    deleteServiceExpense: async (expenseId: string) => {
      return await db.expenses.delete(expenseId);
    },
    removeItem: async (saleId: string, saleItemId: string) => {
      const activeUser = getActiveUserSession();
      const employeeId = sanitizeUUID(activeUser?.id);
      const now = new Date();

      if (isSupabaseConfigured && supabase) {
        const { error: delErr } = await supabase.from('sale_items').delete().eq('id', saleItemId);
        if (delErr) throw delErr;
        const { data: allItems } = await supabase.from('sale_items').select('subtotal').eq('sale_id', saleId);
        const newSubtotal = (allItems || []).reduce((s: number, i: any) => s + i.subtotal, 0);
        const { data: saleRow } = await supabase.from('sales').select('discount').eq('id', saleId).maybeSingle();
        const newGrandTotal = Math.max(0, newSubtotal - (saleRow?.discount || 0));
        const { data: updated, error: upErr } = await supabase.from('sales').update({
          subtotal: newSubtotal, grand_total: newGrandTotal, updated_by: employeeId
        }).eq('id', saleId).select().single();
        if (upErr) throw upErr;
        return updated as Sale;
      }

      const idx = _saleItems.findIndex(si => si.id === saleItemId);
      if (idx !== -1) {
        const old = _saleItems[idx];
        if (old.expense_id) {
          try {
            await db.expenses.delete(old.expense_id);
          } catch (e) {
            console.warn('Could not remove expense for deleted item:', e);
          }
        }
        _saleItems.splice(idx, 1);
        const saleIndex = _sales.findIndex(s => s.id === saleId);
        if (saleIndex !== -1) {
          const allItems = _saleItems.filter(si => si.sale_id === saleId);
          const newSubtotal = allItems.reduce((s, i) => s + i.subtotal, 0);
          const oldSale = _sales[saleIndex];
          const newGrandTotal = Math.max(0, newSubtotal - oldSale.discount);
          _sales[saleIndex] = { ...oldSale, subtotal: newSubtotal, grand_total: newGrandTotal, updated_at: now.toISOString() };
          logAudit(activeUser.id, 'REMOVE_SALE_ITEM', 'sale_items', saleItemId, old, null);
        }
        saveAll();
      }
      return delay(true);
    }
  },

  payments: {
    getAll: async (branchId?: string) => {
      const cacheKey = `payments:${branchId || 'all'}`;
      const cached = getCached<any[]>(cacheKey);
      if (cached) return cached;

      if (isSupabaseConfigured && supabase) {
        try {
          const [paymentsRes, salesRes, customersRes, branchesRes, usersRes] = await Promise.all([
            supabase.from('payments').select('*').or('is_deleted.is.null,is_deleted.eq.false').order('created_at', { ascending: false }),
            supabase.from('sales').select('id, invoice_no, branch_id, customer_id, person_name').eq('is_deleted', false),
            supabase.from('customers').select('id, name, customer_type').eq('is_deleted', false),
            supabase.from('branches').select('id, name'),
            supabase.from('users').select('id, name')
          ]);

          if (paymentsRes.data) {
            const salesMap = new Map((salesRes.data || []).map(s => [s.id, s]));
            const customersMap = new Map((customersRes.data || []).map(c => [c.id, c]));
            const branchesMap = new Map((branchesRes.data || []).map(b => [b.id, b]));
            const usersMap = new Map((usersRes.data || []).map(u => [u.id, u]));

            let list = paymentsRes.data.map((p: any) => {
              const sale = salesMap.get(p.sale_id);
              const customer = sale?.customer_id ? customersMap.get(sale.customer_id) : undefined;
              const branch = sale?.branch_id ? branchesMap.get(sale.branch_id) : undefined;
              const user = p.received_by ? usersMap.get(p.received_by) : undefined;

              let saleCustomerName = 'Walk-in Customer';
              if (customer) {
                if (sale?.person_name) {
                  saleCustomerName = `${sale.person_name} (${customer.name})`;
                } else {
                  saleCustomerName = customer.name;
                }
              } else if (sale?.person_name) {
                saleCustomerName = sale.person_name;
              }

              return {
                ...p,
                payment_date: p.payment_date || p.created_at || new Date().toISOString(),
                is_refund: p.is_refund || p.amount < 0 || p.notes?.includes('[Refund]'),
                refund_reason: p.refund_reason || (p.notes?.includes('[Refund]') ? p.notes.replace(/\[Refund\]\s*/, '').replace(/\[Member:\s*[^\]]+\]/g, '').trim() : undefined),
                person_name: p.person_name || (p.notes?.match(/\[Member:\s*(.*?)\]/)?.[1]) || sale?.person_name || undefined,
                sale_invoice: sale?.invoice_no || '',
                sale_branch_id: sale?.branch_id || '',
                sale_branch_name: branch?.name || 'Central Branch',
                sale_customer_name: saleCustomerName,
                received_by_name: user?.name || 'Cashier'
              };
            });

            if (branchId && branchId !== 'all') {
              list = list.filter((p: any) => p.sale_branch_id === branchId);
            }
            return setCached(cacheKey, list, 10000);
          }
        } catch (supaErr) {
          console.warn('Supabase payments.getAll fallback:', supaErr);
        }
      }

      let list = _payments.filter(p => !p.is_deleted);
      const mapped = list.map(p => {
        const sale = _sales.find(s => s.id === p.sale_id);
        const customer = sale?.customer_id ? _customers.find(c => c.id === sale.customer_id) : undefined;
        const branch = sale?.branch_id ? _branches.find(b => b.id === sale.branch_id) : undefined;
        const user = p.received_by ? _users.find(u => u.id === p.received_by) : undefined;

        let saleCustomerName = 'Walk-in Customer';
        if (customer) {
          if (sale?.person_name) {
            saleCustomerName = `${sale.person_name} (${customer.name})`;
          } else if (customer.company?.name) {
            saleCustomerName = `${customer.name} (${customer.company.name})`;
          } else {
            saleCustomerName = customer.name;
          }
        } else if (sale?.person_name) {
          saleCustomerName = sale.person_name;
        }

        return {
          ...p,
          is_refund: p.is_refund || p.amount < 0 || p.notes?.includes('[Refund]'),
          refund_reason: p.refund_reason || (p.notes?.includes('[Refund]') ? p.notes.replace(/\[Refund\]\s*/, '').replace(/\[Member:\s*[^\]]+\]/g, '').trim() : undefined),
          person_name: p.person_name || (p.notes?.match(/\[Member:\s*(.*?)\]/)?.[1]) || sale?.person_name || undefined,
          sale_invoice: sale?.invoice_no || '',
          sale_branch_id: sale?.branch_id || '',
          sale_branch_name: branch?.name || 'Central Branch',
          sale_customer_name: saleCustomerName,
          received_by_name: user?.name || 'Cashier'
        };
      });

      let res = mapped;
      if (branchId && branchId !== 'all') {
        res = mapped.filter(p => p.sale_branch_id === branchId);
      }
      res.sort((a, b) => new Date(b.payment_date || b.created_at).getTime() - new Date(a.payment_date || a.created_at).getTime());
      return setCached(cacheKey, res, 10000);
    },
    getBySaleId: async (saleId: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('payments').select('*').eq('sale_id', saleId).or('is_deleted.is.null,is_deleted.eq.false').order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map((p: any) => ({
          ...p,
          is_refund: p.is_refund || p.amount < 0 || p.notes?.includes('[Refund]'),
          refund_reason: p.refund_reason || (p.notes?.includes('[Refund]') ? p.notes.replace(/\[Refund\]\s*/, '').replace(/\[Member:\s*[^\]]+\]/g, '').trim() : undefined),
          person_name: p.person_name || (p.notes?.match(/\[Member:\s*(.*?)\]/)?.[1]) || undefined
        })) as Payment[];
      }
      return delay(_payments.filter((p: Payment) => p.sale_id === saleId && !p.is_deleted).map(p => ({
        ...p,
        is_refund: p.is_refund || p.amount < 0 || p.notes?.includes('[Refund]'),
        refund_reason: p.refund_reason || (p.notes?.includes('[Refund]') ? p.notes.replace(/\[Refund\]\s*/, '').replace(/\[Member:\s*[^\]]+\]/g, '').trim() : undefined),
        person_name: p.person_name || (p.notes?.match(/\[Member:\s*(.*?)\]/)?.[1]) || undefined
      })));
    },
    create: async (data: {
      sale_id: string;
      amount: number;
      payment_method?: Payment['payment_method'];
      account_id?: string;
      transaction_no?: string;
      notes?: string;
      person_name?: string;
    }) => {
      invalidateCache('payments');
      invalidateCache('sales');
      invalidateCache('accounts');
      invalidateCache('journal');
      invalidateCache('customers');
      const activeUser = getActiveUserSession();
      const employeeId = sanitizeUUID(activeUser?.id);
      const payId = generateUUID();
      const now = new Date().toISOString();
      const amount = Number(data.amount) || 0;

      // Resolve account and payment method
      let targetAccount = data.account_id ? _accounts.find(a => a.id === data.account_id) : undefined;
      if (!targetAccount && !data.payment_method) {
        targetAccount = _accounts.find(a => a.type === 'cash_drawer') || _accounts[0];
      }

      let resolvedMethod: Payment['payment_method'] = data.payment_method || 'Cash';
      if (!data.payment_method && targetAccount) {
        if (targetAccount.type === 'cash_drawer') resolvedMethod = 'Cash';
        else if (targetAccount.type === 'card') resolvedMethod = 'Card';
        else if (targetAccount.type === 'bank') resolvedMethod = 'Bank Transfer';
      }

      // Deposit into account if account is linked
      if (targetAccount && amount > 0) {
        const accIdx = _accounts.findIndex(a => a.id === targetAccount?.id);
        if (accIdx !== -1) {
          _accounts[accIdx].balance += amount;
          _accounts[accIdx].updated_at = now;
          const txn: AccountTransaction = {
            id: generateUUID(),
            account_id: targetAccount.id,
            transaction_type: 'income',
            amount: amount,
            balance_after: _accounts[accIdx].balance,
            sale_id: data.sale_id,
            payment_id: payId,
            description: `Payment received for ${data.person_name ? `${data.person_name} ` : ''}Invoice`,
            created_at: now,
            created_by: activeUser?.id
          };
          _accountTransactions.unshift(txn);
        }
      }

      // Find sale and customer company/name
      let sale = _sales.find(s => s.id === data.sale_id);
      let saleInvoiceNo = sale?.invoice_no;
      let salePersonName = sale?.person_name;
      let cust = sale?.customer_id ? _customers.find(c => c.id === sale.customer_id) : undefined;

      if ((!sale || !saleInvoiceNo) && isSupabaseConfigured && supabase && data.sale_id) {
        try {
          const { data: supaSale } = await supabase.from('sales').select('id, invoice_no, person_name, customer_id').eq('id', data.sale_id).maybeSingle();
          if (supaSale) {
            saleInvoiceNo = supaSale.invoice_no;
            salePersonName = supaSale.person_name || salePersonName;
            if (supaSale.customer_id) {
              const { data: supaCust } = await supabase.from('customers').select('id, name, customer_type').eq('id', supaSale.customer_id).maybeSingle();
              if (supaCust) {
                cust = supaCust as any;
              }
            }
          }
        } catch (e) {
          console.warn('Could not load sale for payment journal:', e);
        }
      }

      const clientName = data.person_name || salePersonName || (cust as any)?.company?.name || cust?.name || 'Client / Customer';
      const cleanInvoiceNo = saleInvoiceNo ? saleInvoiceNo.replace(/^#/, '') : undefined;
      const referenceNo = cleanInvoiceNo ? `#${cleanInvoiceNo}` : undefined;
      const journalDesc = `Payment collected from ${clientName}${cleanInvoiceNo ? ` for Invoice #${cleanInvoiceNo}` : ''}`;

      // Embed member tag in notes for seamless database compatibility
      const memberTag = data.person_name ? `[Member: ${data.person_name}]` : '';
      const combinedNotes = [memberTag, data.notes].filter(Boolean).join(' ') || undefined;

      // Auto-create Double Entry Journal Record (Cash In)
      const journalEntry: JournalEntry = {
        id: generateUUID(),
        entry_date: now,
        entry_type: 'cash_in',
        from_account: clientName,
        to_account: targetAccount?.name || 'Main Cash Drawer',
        to_account_id: targetAccount?.id,
        amount: amount,
        sale_id: data.sale_id,
        payment_id: payId,
        reference_no: referenceNo,
        description: journalDesc,
        performed_by: activeUser?.id,
        created_at: now,
        created_by: activeUser?.id,
        sale: saleInvoiceNo ? { id: data.sale_id, invoice_no: cleanInvoiceNo! } : undefined
      };
      _journalEntries.unshift(journalEntry);

      if (isSupabaseConfigured && supabase) {
        let validEmployeeId: string | null = null;
        if (employeeId) {
          try {
            const { data: uRow } = await supabase.from('users').select('id').eq('id', employeeId).maybeSingle();
            if (uRow) validEmployeeId = uRow.id;
          } catch {
            validEmployeeId = null;
          }
        }

        let validAccountId: string | null = null;
        if (targetAccount?.id) {
          const checkAccId = sanitizeUUID(targetAccount.id);
          if (checkAccId) {
            try {
              const { data: accRow } = await supabase.from('accounts').select('id').eq('id', checkAccId).maybeSingle();
              if (accRow) validAccountId = accRow.id;
            } catch {
              validAccountId = null;
            }
          }
        }

        const cleanSaleId = sanitizeUUID(data.sale_id) || data.sale_id;

        const basePayload: any = {
          id: payId,
          sale_id: cleanSaleId,
          amount,
          payment_method: resolvedMethod,
          account_id: validAccountId,
          payment_date: now,
          transaction_no: data.transaction_no || null,
          notes: combinedNotes || null,
          is_deleted: false,
          received_by: validEmployeeId,
          created_by: validEmployeeId,
          updated_by: validEmployeeId
        };

        try {
          let { data: created, error } = await supabase.from('payments').insert([basePayload]).select().single();

          if (error) {
            console.warn('Initial Supabase payment insert failed, trying schema fallback:', error.message);
            const fallbackPayload: any = {
              id: payId,
              sale_id: cleanSaleId,
              amount,
              payment_method: resolvedMethod,
              transaction_no: data.transaction_no || null,
              notes: combinedNotes || null,
              is_deleted: false
            };
            const fbRes = await supabase.from('payments').insert([fallbackPayload]).select().single();
            created = fbRes.data;
            error = fbRes.error;
          }

          if (!error && created) {
            if (validAccountId) {
              try {
                const { data: curAcc } = await supabase.from('accounts').select('balance').eq('id', validAccountId).maybeSingle();
                const newBalance = (curAcc?.balance || 0) + amount;
                await supabase.from('accounts').update({ balance: newBalance }).eq('id', validAccountId);
                await supabase.from('account_transactions').insert([{
                  account_id: validAccountId,
                  transaction_type: 'income',
                  amount: amount,
                  balance_after: newBalance,
                  sale_id: cleanSaleId,
                  payment_id: payId,
                  reference_no: referenceNo || null,
                  description: `Payment received for ${data.person_name ? `${data.person_name} ` : ''}Invoice #${cleanInvoiceNo || ''}`,
                  created_by: validEmployeeId
                }]);
              } catch (accErr) {
                console.warn('Account balance update warning:', accErr);
              }
            }

            try {
              await supabase.from('journal_entries').insert([{
                id: journalEntry.id,
                entry_date: journalEntry.entry_date,
                entry_type: journalEntry.entry_type,
                from_account: journalEntry.from_account,
                to_account: journalEntry.to_account,
                amount: journalEntry.amount,
                description: journalEntry.description,
                sale_id: sanitizeUUID(data.sale_id),
                payment_id: sanitizeUUID(payId),
                to_account_id: validAccountId,
                reference_no: referenceNo || null,
                performed_by: validEmployeeId,
                created_by: validEmployeeId
              }]);
            } catch (jErr) {
              console.warn('Journal entry insert warning:', jErr);
            }

            // Recalculate Sale Payment Status
            try {
              const { data: saleData } = await supabase.from('sales').select('grand_total').eq('id', data.sale_id).maybeSingle();
              const { data: allPayments } = await supabase.from('payments').select('amount').eq('sale_id', data.sale_id).or('is_deleted.is.null,is_deleted.eq.false');

              const grand_total = Number(saleData?.grand_total || 0);
              const totalPaid = (allPayments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

              let payment_status: Sale['payment_status'] = 'Unpaid';
              if (totalPaid >= grand_total && grand_total > 0) payment_status = 'Paid';
              else if (totalPaid > 0) payment_status = 'Partially Paid';

              await supabase.from('sales').update({ payment_status, updated_by: validEmployeeId }).eq('id', data.sale_id);
            } catch (statusErr) {
              console.warn('Sale status update warning:', statusErr);
            }

            invalidateCache('payments');
            invalidateCache('sales');
            invalidateCache('accounts');
            invalidateCache('journal');
            invalidateCache('customers');

            return {
              ...created,
              person_name: data.person_name || undefined
            } as Payment;
          } else if (error) {
            console.error('Supabase payment insert error:', error);
          }
        } catch (supaErr) {
          console.warn('Supabase payment insert fallback:', supaErr);
        }
      }

      const newPay: Payment = {
        ...data,
        id: payId,
        amount,
        payment_method: resolvedMethod,
        account_id: targetAccount?.id,
        notes: combinedNotes,
        person_name: data.person_name,
        payment_date: now,
        received_by: activeUser?.id,
        is_deleted: false,
        created_at: now,
        updated_at: now,
        created_by: activeUser?.id,
        updated_by: activeUser?.id
      };
      _payments.push(newPay);

      const saleIndex = _sales.findIndex(s => s.id === data.sale_id);
      if (saleIndex !== -1) {
        const sale = _sales[saleIndex];
        const allSalePayments = _payments.filter((p: Payment) => p.sale_id === data.sale_id && !p.is_deleted);
        const totalPaid = allSalePayments.reduce((sum: number, p: Payment) => sum + Number(p.amount || 0), 0);
        
        let payment_status: Sale['payment_status'] = 'Unpaid';
        if (totalPaid >= sale.grand_total && sale.grand_total > 0) payment_status = 'Paid';
        else if (totalPaid > 0) payment_status = 'Partially Paid';

        _sales[saleIndex] = { ...sale, payment_status, updated_by: activeUser?.id, updated_at: now };
      }

      saveAll();
      logAudit(activeUser?.id, 'INSERT_PAYMENT', 'payments', newPay.id, null, newPay);
      return delay(newPay);
    },

    refund: async (data: {
      sale_id: string;
      amount: number;
      account_id?: string;
      payment_method?: Payment['payment_method'];
      reason: string;
      person_name?: string;
    }) => {
      invalidateCache('payments');
      invalidateCache('sales');
      invalidateCache('accounts');
      invalidateCache('journal');
      invalidateCache('customers');
      const activeUser = getActiveUserSession();
      const employeeId = sanitizeUUID(activeUser?.id);
      const payId = generateUUID();
      const now = new Date().toISOString();
      const refundAmount = Math.abs(Number(data.amount) || 0);

      if (refundAmount <= 0) {
        throw new Error('Refund amount must be greater than 0');
      }

      // Resolve account and payment method
      let targetAccount = data.account_id ? _accounts.find(a => a.id === data.account_id) : undefined;
      if (!targetAccount && !data.payment_method) {
        targetAccount = _accounts.find(a => a.type === 'cash_drawer') || _accounts[0];
      }

      let resolvedMethod: Payment['payment_method'] = data.payment_method || 'Cash';
      if (!data.payment_method && targetAccount) {
        if (targetAccount.type === 'cash_drawer') resolvedMethod = 'Cash';
        else if (targetAccount.type === 'card') resolvedMethod = 'Card';
        else if (targetAccount.type === 'bank') resolvedMethod = 'Bank Transfer';
      }

      // Deduct from account (Money goes OUT to customer)
      if (targetAccount) {
        const accIdx = _accounts.findIndex(a => a.id === targetAccount?.id);
        if (accIdx !== -1) {
          _accounts[accIdx].balance -= refundAmount;
          _accounts[accIdx].updated_at = now;
          const txn: AccountTransaction = {
            id: generateUUID(),
            account_id: targetAccount.id,
            transaction_type: 'withdrawal',
            amount: refundAmount,
            balance_after: _accounts[accIdx].balance,
            sale_id: data.sale_id,
            payment_id: payId,
            description: `Refund returned for ${data.person_name ? `${data.person_name} ` : ''}Invoice: ${data.reason}`,
            created_at: now,
            created_by: activeUser?.id
          };
          _accountTransactions.unshift(txn);
        }
      }

      // Find sale and customer company/name
      let sale = _sales.find(s => s.id === data.sale_id);
      let saleInvoiceNo = sale?.invoice_no;
      let salePersonName = sale?.person_name;
      let cust = sale?.customer_id ? _customers.find(c => c.id === sale.customer_id) : undefined;

      if ((!sale || !saleInvoiceNo) && isSupabaseConfigured && supabase && data.sale_id) {
        try {
          const { data: supaSale } = await supabase.from('sales').select('id, invoice_no, person_name, customer_id').eq('id', data.sale_id).maybeSingle();
          if (supaSale) {
            saleInvoiceNo = supaSale.invoice_no;
            salePersonName = supaSale.person_name || salePersonName;
            if (supaSale.customer_id) {
              const { data: supaCust } = await supabase.from('customers').select('id, name, customer_type').eq('id', supaSale.customer_id).maybeSingle();
              if (supaCust) {
                cust = supaCust as any;
              }
            }
          }
        } catch (e) {
          console.warn('Could not load sale for refund journal:', e);
        }
      }

      const clientName = data.person_name || salePersonName || (cust as any)?.company?.name || cust?.name || 'Client / Customer';
      const cleanInvoiceNo = saleInvoiceNo ? saleInvoiceNo.replace(/^#/, '') : undefined;
      const referenceNo = cleanInvoiceNo ? `#${cleanInvoiceNo}` : undefined;
      const journalDesc = `Refund returned to ${clientName}${cleanInvoiceNo ? ` for Invoice #${cleanInvoiceNo}` : ''}: ${data.reason}`;

      // Embed tags in notes for seamless database compatibility
      const memberTag = data.person_name ? `[Member: ${data.person_name}]` : '';
      const reasonTag = `[Refund] ${data.reason}`;
      const combinedNotes = [reasonTag, memberTag].filter(Boolean).join(' ');

      // Auto-create Double Entry Journal Record (Cash Out)
      const journalEntry: JournalEntry = {
        id: generateUUID(),
        entry_date: now,
        entry_type: 'cash_out',
        from_account: targetAccount?.name || 'Main Cash Drawer',
        from_account_id: targetAccount?.id,
        to_account: clientName,
        amount: refundAmount,
        sale_id: data.sale_id,
        payment_id: payId,
        reference_no: referenceNo,
        description: journalDesc,
        performed_by: activeUser?.id,
        created_at: now,
        created_by: activeUser?.id,
        sale: saleInvoiceNo ? { id: data.sale_id, invoice_no: cleanInvoiceNo! } : undefined
      };
      _journalEntries.unshift(journalEntry);

      if (isSupabaseConfigured && supabase) {
        let validEmployeeId: string | null = null;
        if (employeeId) {
          try {
            const { data: uRow } = await supabase.from('users').select('id').eq('id', employeeId).maybeSingle();
            if (uRow) validEmployeeId = uRow.id;
          } catch {
            validEmployeeId = null;
          }
        }

        let validAccountId: string | null = null;
        if (targetAccount?.id) {
          const checkAccId = sanitizeUUID(targetAccount.id);
          if (checkAccId) {
            try {
              const { data: accRow } = await supabase.from('accounts').select('id').eq('id', checkAccId).maybeSingle();
              if (accRow) validAccountId = accRow.id;
            } catch {
              validAccountId = null;
            }
          }
        }

        const cleanSaleId = sanitizeUUID(data.sale_id) || data.sale_id;

        const basePayload: any = {
          id: payId,
          sale_id: cleanSaleId,
          amount: -refundAmount,
          payment_method: resolvedMethod,
          account_id: validAccountId,
          payment_date: now,
          notes: combinedNotes,
          is_deleted: false,
          received_by: validEmployeeId,
          created_by: validEmployeeId,
          updated_by: validEmployeeId
        };

        try {
          let { data: created, error } = await supabase.from('payments').insert([basePayload]).select().single();

          if (error) {
            console.warn('Initial Supabase refund insert failed, trying schema fallback:', error.message);
            const fallbackPayload: any = {
              id: payId,
              sale_id: cleanSaleId,
              amount: -refundAmount,
              payment_method: resolvedMethod,
              notes: combinedNotes,
              is_deleted: false
            };
            const fbRes = await supabase.from('payments').insert([fallbackPayload]).select().single();
            created = fbRes.data;
            error = fbRes.error;
          }

          if (!error && created) {
            if (validAccountId) {
              try {
                const { data: curAcc } = await supabase.from('accounts').select('balance').eq('id', validAccountId).maybeSingle();
                const newBalance = (curAcc?.balance || 0) - refundAmount;
                await supabase.from('accounts').update({ balance: newBalance }).eq('id', validAccountId);
                await supabase.from('account_transactions').insert([{
                  account_id: validAccountId,
                  transaction_type: 'withdrawal',
                  amount: refundAmount,
                  balance_after: newBalance,
                  sale_id: cleanSaleId,
                  payment_id: payId,
                  reference_no: referenceNo || null,
                  description: `Refund returned for ${data.person_name ? `${data.person_name} ` : ''}Invoice #${cleanInvoiceNo || ''}: ${data.reason}`,
                  created_by: validEmployeeId
                }]);
              } catch (accErr) {
                console.warn('Account balance update warning:', accErr);
              }
            }

            try {
              await supabase.from('journal_entries').insert([{
                id: journalEntry.id,
                entry_date: journalEntry.entry_date,
                entry_type: journalEntry.entry_type,
                from_account: journalEntry.from_account,
                to_account: journalEntry.to_account,
                amount: journalEntry.amount,
                description: journalEntry.description,
                sale_id: sanitizeUUID(data.sale_id),
                payment_id: sanitizeUUID(payId),
                from_account_id: validAccountId,
                reference_no: referenceNo || null,
                performed_by: validEmployeeId,
                created_by: validEmployeeId
              }]);
            } catch (jErr) {
              console.warn('Journal entry insert warning:', jErr);
            }

            // Recalculate Sale Payment Status
            try {
              const { data: saleData } = await supabase.from('sales').select('grand_total').eq('id', data.sale_id).maybeSingle();
              const { data: allPayments } = await supabase.from('payments').select('amount').eq('sale_id', data.sale_id).or('is_deleted.is.null,is_deleted.eq.false');

              const grand_total = Number(saleData?.grand_total || 0);
              const netPaid = (allPayments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

              let payment_status: Sale['payment_status'] = 'Unpaid';
              if (netPaid >= grand_total && grand_total > 0) payment_status = 'Paid';
              else if (netPaid > 0) payment_status = 'Partially Paid';

              await supabase.from('sales').update({ payment_status, updated_by: validEmployeeId }).eq('id', data.sale_id);
            } catch (statusErr) {
              console.warn('Sale status update warning:', statusErr);
            }

            invalidateCache('payments');
            invalidateCache('sales');
            invalidateCache('accounts');
            invalidateCache('journal');
            invalidateCache('customers');

            return {
              ...created,
              is_refund: true,
              refund_reason: data.reason,
              person_name: data.person_name || undefined
            } as Payment;
          } else if (error) {
            console.error('Supabase payment refund error:', error);
          }
        } catch (supaErr) {
          console.warn('Supabase payment refund fallback:', supaErr);
        }
      }

      const newPay: Payment = {
        id: payId,
        sale_id: data.sale_id,
        amount: -refundAmount,
        payment_method: resolvedMethod,
        account_id: targetAccount?.id,
        notes: combinedNotes,
        person_name: data.person_name,
        is_refund: true,
        refund_reason: data.reason,
        payment_date: now,
        received_by: activeUser?.id,
        is_deleted: false,
        created_at: now,
        updated_at: now,
        created_by: activeUser?.id,
        updated_by: activeUser?.id
      };
      _payments.push(newPay);

      const saleIndex = _sales.findIndex(s => s.id === data.sale_id);
      if (saleIndex !== -1) {
        const sale = _sales[saleIndex];
        const allSalePayments = _payments.filter((p: Payment) => p.sale_id === data.sale_id && !p.is_deleted);
        const netPaid = allSalePayments.reduce((sum: number, p: Payment) => sum + Number(p.amount || 0), 0);
        
        let payment_status: Sale['payment_status'] = 'Unpaid';
        if (netPaid >= sale.grand_total && sale.grand_total > 0) payment_status = 'Paid';
        else if (netPaid > 0) payment_status = 'Partially Paid';

        _sales[saleIndex] = { ...sale, payment_status, updated_by: activeUser?.id, updated_at: now };
      }

      saveAll();
      logAudit(activeUser?.id, 'REFUND_PAYMENT', 'payments', newPay.id, null, newPay);
      return delay(newPay);
    },
    clearAll: async () => {
      invalidateCache('payments');
      invalidateCache('sales');
      invalidateCache('accounts');
      invalidateCache('journal');
      invalidateCache('customers');
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        } catch (e) {
          console.warn('Supabase payments clear error:', e);
        }
      }
      _payments = [];
      saveToLocalStorage(KEYS.PAYMENTS, []);
      return true;
    }
  },

  expenseCategories: {
    getAll: async () => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('expense_categories').select('*').eq('is_deleted', false);
        if (error) throw error;
        return data as ExpenseCategory[];
      }
      return delay(_expenseCats.filter(e => !e.is_deleted));
    },
    getById: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('expense_categories').select('*').eq('id', id).eq('is_deleted', false).maybeSingle();
        if (error) throw error;
        return data as ExpenseCategory;
      }
      return delay(_expenseCats.find(c => c.id === id && !c.is_deleted));
    },
    create: async (data: Omit<ExpenseCategory, 'id' | 'is_deleted' | 'created_at' | 'updated_at'>) => {
      if (isSupabaseConfigured && supabase) {
        const { data: created, error } = await supabase.from('expense_categories').insert([data]).select().single();
        if (error) throw error;
        return created as ExpenseCategory;
      }
      const newCat: ExpenseCategory = {
        ...data,
        id: generateUUID(),
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      _expenseCats.push(newCat);
      saveAll();
      logAudit(getActiveUserSession().id, 'INSERT', 'expense_categories', newCat.id, null, newCat);
      return delay(newCat);
    },
    update: async (id: string, data: Partial<Omit<ExpenseCategory, 'id' | 'created_at' | 'updated_at'>>) => {
      if (isSupabaseConfigured && supabase) {
        const { data: updated, error } = await supabase.from('expense_categories').update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated as ExpenseCategory;
      }
      const index = _expenseCats.findIndex(e => e.id === id);
      if (index === -1) throw new Error('Category not found');
      const old = _expenseCats[index];
      const updated = { ...old, ...data, updated_at: new Date().toISOString() };
      _expenseCats[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'UPDATE', 'expense_categories', id, old, updated);
      return delay(updated);
    },
    delete: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('expense_categories').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
        return true;
      }
      const index = _expenseCats.findIndex(e => e.id === id);
      if (index === -1) throw new Error('Category not found');
      const old = _expenseCats[index];
      const updated = { ...old, is_deleted: true, updated_at: new Date().toISOString() };
      _expenseCats[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'DELETE_SOFT', 'expense_categories', id, old, updated);
      return delay(true);
    }
  },

  expenses: {
    getAll: async (branchId?: string) => {
      if (isSupabaseConfigured && supabase) {
        let query = supabase.from('expenses').select('*, category:expense_categories(*), branch:branches(*)').eq('is_deleted', false);
        if (branchId) {
          query = query.eq('branch_id', branchId);
        }
        const { data, error } = await query;
        if (!error && data) return data as Expense[];
      }

      let list = _expenses.filter(e => !e.is_deleted);
      if (branchId) {
        list = list.filter(e => e.branch_id === branchId);
      }
      return delay(list.map(e => ({
        ...e,
        category: _expenseCats.find(ec => ec.id === e.category_id),
        branch: _branches.find(b => b.id === e.branch_id)
      })));
    },
    getById: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('expenses').select('*, category:expense_categories(*), branch:branches(*)').eq('id', id).eq('is_deleted', false).maybeSingle();
        if (!error && data) return data as Expense;
      }
      const exp = _expenses.find(e => e.id === id && !e.is_deleted);
      if (!exp) return delay(undefined);
      return delay({
        ...exp,
        category: _expenseCats.find(ec => ec.id === exp.category_id),
        branch: _branches.find(b => b.id === exp.branch_id)
      });
    },
    create: async (data: Omit<Expense, 'id' | 'is_deleted' | 'created_at' | 'updated_at'>) => {
      const activeUser = getActiveUserSession();
      const now = new Date().toISOString();
      const expId = generateUUID();
      const amount = Number(data.amount) || 0;

      // Deduct from account if account_id is specified
      if (data.account_id) {
        const accIdx = _accounts.findIndex(a => a.id === data.account_id);
        if (accIdx !== -1) {
          _accounts[accIdx].balance -= amount;
          _accounts[accIdx].updated_at = now;
          const txn: AccountTransaction = {
            id: generateUUID(),
            account_id: data.account_id,
            transaction_type: 'expense',
            amount: -amount,
            balance_after: _accounts[accIdx].balance,
            expense_id: expId,
            sale_id: data.sale_id,
            description: data.description || 'Service/Gov expense',
            created_at: now,
            created_by: activeUser?.id
          };
          _accountTransactions.unshift(txn);
        }
      }

      const sourceAcc = data.account_id ? _accounts.find(a => a.id === data.account_id) : _accounts.find(a => a.type === 'cash_drawer') || _accounts[0];
      const beneficiary = (data as any).paid_to || activeUser?.name || 'Staff Expense';
      let sale = data.sale_id ? _sales.find(s => s.id === data.sale_id) : undefined;
      let saleInvoiceNo = sale?.invoice_no;

      if ((!sale || !saleInvoiceNo) && isSupabaseConfigured && supabase && data.sale_id) {
        try {
          const { data: supaSale } = await supabase.from('sales').select('id, invoice_no, person_name').eq('id', data.sale_id).maybeSingle();
          if (supaSale) {
            saleInvoiceNo = supaSale.invoice_no;
          }
        } catch (e) {
          console.warn('Could not load sale for expense journal:', e);
        }
      }

      const cleanInvoiceNo = saleInvoiceNo ? saleInvoiceNo.replace(/^#/, '') : undefined;
      const referenceNo = cleanInvoiceNo ? `#${cleanInvoiceNo}` : undefined;

      // Auto-create Double Entry Journal Record (Cash Out)
      const journalEntry: JournalEntry = {
        id: generateUUID(),
        entry_date: now,
        entry_type: 'cash_out',
        from_account: sourceAcc ? sourceAcc.name : 'Main Cash Drawer',
        from_account_id: data.account_id,
        to_account: beneficiary,
        amount: amount,
        expense_id: expId,
        sale_id: data.sale_id,
        reference_no: referenceNo,
        description: data.description || `Expense paid to ${beneficiary}`,
        performed_by: activeUser?.id,
        created_at: now,
        created_by: activeUser?.id,
        sale: cleanInvoiceNo ? { id: data.sale_id!, invoice_no: cleanInvoiceNo } : undefined
      };
      _journalEntries.unshift(journalEntry);

      const encodedDesc = data.sale_item_id && data.description && !data.description.includes(data.sale_item_id)
        ? `[Item: ${data.sale_item_id}] ${data.description}`
        : (data.description || `Expense paid to ${beneficiary}`);

      if (isSupabaseConfigured && supabase) {
        let validEmployeeId = sanitizeUUID(activeUser?.id);
        if (validEmployeeId) {
          try {
            const { data: uRow } = await supabase.from('users').select('id').eq('id', validEmployeeId).maybeSingle();
            if (!uRow) validEmployeeId = null;
          } catch {
            validEmployeeId = null;
          }
        }

        try {
          const { sale_item_id, ...cleanExpenseData } = data as any;
          const { data: created, error } = await supabase.from('expenses').insert([{
            ...cleanExpenseData,
            description: encodedDesc,
            id: expId,
            amount,
            is_deleted: false,
            sale_id: sanitizeUUID(data.sale_id),
            account_id: sanitizeUUID(data.account_id),
            branch_id: sanitizeUUID(data.branch_id),
            created_by: validEmployeeId,
            updated_by: validEmployeeId
          }]).select().single();
          if (!error && created) {
            if (data.account_id) {
              const acc = _accounts.find(a => a.id === data.account_id);
              if (acc) {
                await supabase.from('accounts').update({ balance: acc.balance }).eq('id', acc.id);
              }
            }
            await supabase.from('journal_entries').insert([{
              id: journalEntry.id,
              entry_date: journalEntry.entry_date,
              entry_type: journalEntry.entry_type,
              from_account: journalEntry.from_account,
              to_account: journalEntry.to_account,
              amount: journalEntry.amount,
              description: journalEntry.description,
              sale_id: sanitizeUUID(data.sale_id),
              expense_id: sanitizeUUID(expId),
              from_account_id: data.account_id ? sanitizeUUID(data.account_id) : null,
              reference_no: referenceNo || null,
              performed_by: validEmployeeId,
              created_by: validEmployeeId
            }]);
            return {
              ...created,
              sale_item_id: data.sale_item_id
            } as Expense;
          }
        } catch (e) {
          console.warn('Supabase expense create fallback:', e);
        }
      }

      const newExp: Expense = {
        ...data,
        description: encodedDesc,
        id: expId,
        amount,
        is_deleted: false,
        created_at: now,
        updated_at: now
      };
      _expenses.push(newExp);
      saveAll();
      logAudit(activeUser?.id, 'INSERT', 'expenses', newExp.id, null, newExp);
      return delay(newExp);
    },
    update: async (id: string, data: Partial<Omit<Expense, 'id' | 'created_at' | 'updated_at'>>) => {
      if (isSupabaseConfigured && supabase) {
        const { data: updated, error } = await supabase.from('expenses').update(data).eq('id', id).select().single();
        if (!error && updated) return updated as Expense;
      }
      const index = _expenses.findIndex(e => e.id === id);
      if (index === -1) throw new Error('Expense not found');
      const old = _expenses[index];
      const updated = { ...old, ...data, updated_at: new Date().toISOString() };
      _expenses[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'UPDATE', 'expenses', id, old, updated);
      return delay(updated);
    },
    delete: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('expenses').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
        return true;
      }
      const index = _expenses.findIndex(e => e.id === id);
      if (index === -1) throw new Error('Expense not found');
      const old = _expenses[index];
      const updated = { ...old, is_deleted: true, updated_at: new Date().toISOString() };
      _expenses[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'DELETE_SOFT', 'expenses', id, old, updated);
      return delay(true);
    }
  },

  accounts: {
    getAll: async (branchId?: string) => {
      const cacheKey = `accounts:${branchId || 'all'}`;
      const cached = getCached<Account[]>(cacheKey);
      if (cached) return cached;

      if (isSupabaseConfigured && supabase) {
        let query = supabase.from('accounts').select('*, branch:branches(*)').eq('is_deleted', false).order('created_at', { ascending: true });
        if (branchId) query = query.eq('branch_id', branchId);
        const { data, error } = await query;
        if (!error && data) {
          if (data.length === 0) return setCached(cacheKey, [], 10000);

          // Compute live balance for each account from payments, expenses, and transactions in parallel
          const [{ data: allPayments }, { data: allExpenses }, { data: allTxns }] = await Promise.all([
            supabase.from('payments').select('account_id, amount').eq('is_deleted', false),
            supabase.from('expenses').select('account_id, amount').eq('is_deleted', false),
            supabase.from('account_transactions').select('account_id, amount, transaction_type')
          ]);

          const res = data.map((acc: any) => {
            const payIn = (allPayments || []).filter((p: any) => p.account_id === acc.id).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
            const expOut = (allExpenses || []).filter((e: any) => e.account_id === acc.id).reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
            const txns = (allTxns || [])
              .filter((t: any) => t.account_id === acc.id && (t.transaction_type === 'transfer' || t.transaction_type === 'top_up' || t.transaction_type === 'adjustment'))
              .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
            
            const liveBalance = payIn - expOut + txns;
            return {
              ...acc,
              balance: liveBalance !== 0 ? liveBalance : (Number(acc.balance) || 0)
            } as Account;
          });

          return setCached(cacheKey, res, 10000);
        }
      }
      let list = _accounts.filter(a => !a.is_deleted);
      if (branchId) list = list.filter(a => !a.branch_id || a.branch_id === branchId);
      const res = list.map(a => {
        const payIn = _payments.filter(p => p.account_id === a.id && !p.is_deleted).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const expOut = _expenses.filter(e => e.account_id === a.id && !e.is_deleted).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const txns = _accountTransactions
          .filter(t => t.account_id === a.id && ((t.transaction_type as string) === 'deposit' || (t.transaction_type as string) === 'withdrawal' || (t.transaction_type as string) === 'transfer'))
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        
        const computedBalance = payIn - expOut + txns;
        const finalBalance = computedBalance !== 0 ? computedBalance : (Number(a.balance) || 0);
        a.balance = finalBalance;

        return {
          ...a,
          balance: finalBalance,
          branch: _branches.find(b => b.id === a.branch_id)
        };
      });

      return setCached(cacheKey, res, 10000);
    },
    getById: async (id: string) => {
      const all = await db.accounts.getAll();
      return all.find(a => a.id === id);
    },
    create: async (data: Omit<Account, 'id' | 'is_deleted' | 'created_at' | 'updated_at'>) => {
      invalidateCache('accounts');
      invalidateCache('journal');
      const activeUser = getActiveUserSession();
      const id = generateUUID();
      const now = new Date().toISOString();
      const newAcc: Account = {
        ...data,
        id,
        balance: Number(data.balance) || 0,
        is_active: data.is_active !== undefined ? data.is_active : true,
        is_deleted: false,
        created_at: now,
        updated_at: now,
        created_by: activeUser?.id
      };

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: created, error } = await supabase.from('accounts').insert([{
            id: newAcc.id,
            name: newAcc.name,
            type: newAcc.type,
            bank_name: newAcc.bank_name || null,
            account_number: newAcc.account_number || null,
            balance: newAcc.balance,
            branch_id: sanitizeUUID(newAcc.branch_id),
            is_active: newAcc.is_active,
            is_deleted: false,
            created_by: sanitizeUUID(activeUser?.id)
          }]).select().single();
          if (!error && created) {
            return created as Account;
          }
        } catch (e) {
          console.warn('Supabase account create fallback:', e);
        }
      }

      _accounts.push(newAcc);
      saveAll();
      logAudit(activeUser?.id, 'INSERT_ACCOUNT', 'accounts', id, null, newAcc);
      return delay(newAcc);
    },
    update: async (id: string, data: Partial<Omit<Account, 'id' | 'created_at' | 'updated_at'>>) => {
      invalidateCache('accounts');
      invalidateCache('journal');
      const activeUser = getActiveUserSession();
      const now = new Date().toISOString();

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: updated, error } = await supabase.from('accounts').update({
            ...data,
            updated_at: now,
            updated_by: sanitizeUUID(activeUser?.id)
          }).eq('id', id).select().single();
          if (!error && updated) return updated as Account;
        } catch (e) {
          console.warn('Supabase account update fallback:', e);
        }
      }

      const idx = _accounts.findIndex(a => a.id === id);
      if (idx === -1) throw new Error('Account not found');
      const old = _accounts[idx];
      const updated = { ...old, ...data, updated_at: now, updated_by: activeUser?.id };
      _accounts[idx] = updated;
      saveAll();
      logAudit(activeUser?.id, 'UPDATE_ACCOUNT', 'accounts', id, old, updated);
      return delay(updated);
    },
    delete: async (id: string) => {
      invalidateCache('accounts');
      invalidateCache('journal');
      const activeUser = getActiveUserSession();
      if (isSupabaseConfigured && supabase) {
        await supabase.from('accounts').update({ is_deleted: true }).eq('id', id);
      }
      const idx = _accounts.findIndex(a => a.id === id);
      if (idx !== -1) {
        _accounts[idx].is_deleted = true;
        _accounts[idx].updated_at = new Date().toISOString();
        saveAll();
        logAudit(activeUser?.id, 'DELETE_ACCOUNT', 'accounts', id, null, null);
      }
      return delay(true);
    },
    topUp: async (
      targetOrObj: string | { target_account_id: string; amount: number; source_account_id?: string; notes?: string },
      amountArg?: number,
      fromAccountIdArg?: string,
      notesArg?: string
    ) => {
      const activeUser = getActiveUserSession();
      const now = new Date().toISOString();

      let targetAccountId: string;
      let numAmount: number;
      let fromAccountId: string | undefined;
      let notes: string | undefined;

      if (typeof targetOrObj === 'object') {
        targetAccountId = targetOrObj.target_account_id;
        numAmount = Number(targetOrObj.amount) || 0;
        fromAccountId = targetOrObj.source_account_id;
        notes = targetOrObj.notes;
      } else {
        targetAccountId = targetOrObj;
        numAmount = Number(amountArg) || 0;
        fromAccountId = fromAccountIdArg;
        notes = notesArg;
      }

      if (isNaN(numAmount) || numAmount <= 0) throw new Error('Valid positive amount required.');

      let targetAcc = _accounts.find(a => a.id === targetAccountId);
      let fromAcc = fromAccountId ? _accounts.find(a => a.id === fromAccountId) : undefined;

      if (fromAcc) {
        fromAcc.balance -= numAmount;
        fromAcc.updated_at = now;
        const fromTxn: AccountTransaction = {
          id: generateUUID(),
          account_id: fromAcc.id,
          transaction_type: 'transfer',
          amount: -numAmount,
          balance_after: fromAcc.balance,
          related_account_id: targetAccountId,
          description: notes ? `Transfer to ${targetAcc?.name || 'Card'}: ${notes}` : `Transfer to ${targetAcc?.name || 'Card'}`,
          created_at: now,
          created_by: activeUser?.id
        };
        _accountTransactions.unshift(fromTxn);
      }

      if (targetAcc) {
        targetAcc.balance += numAmount;
        targetAcc.updated_at = now;
        const toTxn: AccountTransaction = {
          id: generateUUID(),
          account_id: targetAcc.id,
          transaction_type: 'deposit',
          amount: numAmount,
          balance_after: targetAcc.balance,
          related_account_id: fromAccountId,
          description: notes ? `Top-up ${fromAcc ? `from ${fromAcc.name}` : ''}: ${notes}` : `Top-up ${fromAcc ? `from ${fromAcc.name}` : ''}`,
          created_at: now,
          created_by: activeUser?.id
        };
        _accountTransactions.unshift(toTxn);
      }

      // Create 2 Journal Records for Double-Entry Accounting: Cash Out from Source, Cash In to Target
      const journalEntriesToInsert: JournalEntry[] = [];

      if (fromAcc) {
        // 1. Cash Out from source account
        journalEntriesToInsert.push({
          id: generateUUID(),
          entry_date: now,
          entry_type: 'cash_out',
          from_account: fromAcc.name,
          to_account: targetAcc?.name || 'Portal Card',
          from_account_id: fromAccountId,
          to_account_id: targetAccountId,
          amount: numAmount,
          description: notes ? `Transfer Out to ${targetAcc?.name}: ${notes}` : `Transfer Out to ${targetAcc?.name}`,
          performed_by: activeUser?.id,
          created_at: now,
          created_by: activeUser?.id
        });

        // 2. Cash In to target account
        journalEntriesToInsert.push({
          id: generateUUID(),
          entry_date: now,
          entry_type: 'cash_in',
          from_account: fromAcc.name,
          to_account: targetAcc?.name || 'Portal Card',
          from_account_id: fromAccountId,
          to_account_id: targetAccountId,
          amount: numAmount,
          description: notes ? `Transfer In from ${fromAcc.name}: ${notes}` : `Transfer In from ${fromAcc.name}`,
          performed_by: activeUser?.id,
          created_at: now,
          created_by: activeUser?.id
        });
      } else {
        // Direct Top-Up Deposit (Cash In)
        journalEntriesToInsert.push({
          id: generateUUID(),
          entry_date: now,
          entry_type: 'cash_in',
          from_account: 'Direct Cash Deposit',
          to_account: targetAcc?.name || 'Portal Card',
          to_account_id: targetAccountId,
          amount: numAmount,
          description: notes || `Top-up deposit for ${targetAcc?.name}`,
          performed_by: activeUser?.id,
          created_at: now,
          created_by: activeUser?.id
        });
      }

      _journalEntries.unshift(...journalEntriesToInsert);

      saveAll();
      logAudit(activeUser?.id, 'TOP_UP_ACCOUNT', 'accounts', targetAccountId, null, { amount: numAmount, fromAccountId, notes });

      if (isSupabaseConfigured && supabase) {
        try {
          if (fromAcc) {
            await supabase.from('accounts').update({ balance: fromAcc.balance }).eq('id', fromAcc.id);
            await supabase.from('account_transactions').insert([{
              account_id: fromAcc.id,
              transaction_type: 'transfer',
              amount: -numAmount,
              balance_after: fromAcc.balance,
              related_account_id: targetAccountId,
              description: notes ? `Transfer to ${targetAcc?.name || 'Card'}: ${notes}` : `Transfer to ${targetAcc?.name || 'Card'}`,
              created_by: sanitizeUUID(activeUser?.id)
            }]);
          }
          if (targetAcc) {
            await supabase.from('accounts').update({ balance: targetAcc.balance }).eq('id', targetAcc.id);
            await supabase.from('account_transactions').insert([{
              account_id: targetAcc.id,
              transaction_type: 'deposit',
              amount: numAmount,
              balance_after: targetAcc.balance,
              related_account_id: fromAccountId,
              description: notes ? `Top-up ${fromAcc ? `from ${fromAcc.name}` : ''}: ${notes}` : `Top-up ${fromAcc ? `from ${fromAcc.name}` : ''}`,
              created_by: sanitizeUUID(activeUser?.id)
            }]);
          }
          await supabase.from('journal_entries').insert(
            journalEntriesToInsert.map(j => ({
              ...j,
              from_account_id: sanitizeUUID(j.from_account_id),
              to_account_id: sanitizeUUID(j.to_account_id),
              performed_by: sanitizeUUID(activeUser?.id),
              created_by: sanitizeUUID(activeUser?.id)
            }))
          );
        } catch (supaErr) {
          console.warn('Supabase topup sync warning:', supaErr);
        }
      }

      return delay({ targetAccount: targetAcc, fromAccount: fromAcc });
    },
    getTransactions: async (accountId?: string) => {
      if (isSupabaseConfigured && supabase) {
        let query = supabase.from('account_transactions').select('*, account:accounts!account_id(*), related_account:accounts!related_account_id(*)').order('created_at', { ascending: false }).limit(100);
        if (accountId) query = query.eq('account_id', accountId);
        const { data, error } = await query;
        if (!error && data) return data as AccountTransaction[];
      }
      let list = _accountTransactions;
      if (accountId) list = list.filter(t => t.account_id === accountId);
      return delay(list.map(t => ({
        ...t,
        account: _accounts.find(a => a.id === t.account_id),
        related_account: _accounts.find(a => a.id === t.related_account_id)
      })));
    }
  },

  auditLogs: {
    getAll: async () => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('audit_logs').select('*, user:users(*)').order('created_at', { ascending: false });
        if (error) throw error;
        return data as AuditLog[];
      }
      return delay(_logs.map((l: AuditLog) => ({
        ...l,
        user: _users.find(u => u.id === l.user_id)
      })));
    }
  },

  clientDocuments: {
    getAll: async () => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('client_documents').select('*, customer:customers(*)').order('expiry_date', { ascending: true });
        if (error) throw error;
        return data as ClientDocument[];
      }
      return delay(_clientDocuments.map((d: any) => ({
        ...d,
        customer: _customers.find(c => c.id === d.customer_id)
      })));
    },
    getByCustomerId: async (customerId: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('client_documents').select('*').eq('customer_id', customerId).order('expiry_date', { ascending: true });
        if (error) throw error;
        return data as ClientDocument[];
      }
      return delay(_clientDocuments.filter((d: any) => d.customer_id === customerId));
    },
    create: async (data: Omit<ClientDocument, 'id' | 'created_at' | 'updated_at'>) => {
      if (isSupabaseConfigured && supabase) {
        const { data: created, error } = await supabase.from('client_documents').insert([data]).select().single();
        if (error) throw error;
        return created as ClientDocument;
      }
      const newDoc: ClientDocument = {
        ...data,
        id: generateUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      _clientDocuments.push(newDoc);
      saveAll();
      logAudit(getActiveUserSession().id, 'INSERT', 'client_documents', newDoc.id, null, newDoc);
      return delay(newDoc);
    },
    update: async (id: string, data: Partial<Omit<ClientDocument, 'id' | 'created_at' | 'updated_at'>>) => {
      if (isSupabaseConfigured && supabase) {
        const { data: updated, error } = await supabase.from('client_documents').update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated as ClientDocument;
      }
      const index = _clientDocuments.findIndex((d: any) => d.id === id);
      if (index === -1) throw new Error('Document not found');
      const old = _clientDocuments[index];
      const updated = { ...old, ...data, updated_at: new Date().toISOString() };
      _clientDocuments[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'UPDATE', 'client_documents', id, old, updated);
      return delay(updated);
    },
    delete: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('client_documents').delete().eq('id', id);
        if (error) throw error;
        return true;
      }
      const index = _clientDocuments.findIndex((d: any) => d.id === id);
      if (index === -1) throw new Error('Document not found');
      const old = _clientDocuments[index];
      _clientDocuments.splice(index, 1);
      saveAll();
      logAudit(getActiveUserSession().id, 'DELETE', 'client_documents', id, old, null);
      return delay(true);
    }
  },

  documentTypes: {
    getAll: async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase.from('document_types').select('*').eq('is_deleted', false).order('name', { ascending: true });
          if (!error && data && data.length > 0) return data as DocumentType[];
        } catch (e) {
          console.warn('Supabase document_types fallback:', e);
        }
      }
      return delay(_documentTypes.filter(d => !d.is_deleted));
    },
    getById: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase.from('document_types').select('*').eq('id', id).single();
          if (!error && data) return data as DocumentType;
        } catch (e) {}
      }
      return delay(_documentTypes.find(d => d.id === id) || null);
    },
    create: async (data: Omit<DocumentType, 'id' | 'created_at' | 'updated_at'>) => {
      const newDocType: DocumentType = {
        ...data,
        id: generateUUID(),
        is_active: data.is_active ?? true,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: created, error } = await supabase.from('document_types').insert([newDocType]).select().single();
          if (!error && created) return created as DocumentType;
        } catch (e) {
          console.warn('Supabase document_types fallback:', e);
        }
      }
      _documentTypes.push(newDocType);
      saveAll();
      logAudit(getActiveUserSession()?.id, 'INSERT', 'document_types', newDocType.id, null, newDocType);
      return delay(newDocType);
    },
    update: async (id: string, data: Partial<Omit<DocumentType, 'id' | 'created_at' | 'updated_at'>>) => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: updated, error } = await supabase.from('document_types').update(data).eq('id', id).select().single();
          if (!error && updated) return updated as DocumentType;
        } catch (e) {
          console.warn('Supabase document_types fallback:', e);
        }
      }
      const index = _documentTypes.findIndex(d => d.id === id);
      if (index === -1) throw new Error('Document type not found');
      const old = _documentTypes[index];
      const updated = { ...old, ...data, updated_at: new Date().toISOString() };
      _documentTypes[index] = updated;
      saveAll();
      logAudit(getActiveUserSession()?.id, 'UPDATE', 'document_types', id, old, updated);
      return delay(updated);
    },
    delete: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { error } = await supabase.from('document_types').update({ is_deleted: true }).eq('id', id);
          if (!error) return true;
        } catch (e) {
          console.warn('Supabase document_types fallback:', e);
        }
      }
      const index = _documentTypes.findIndex(d => d.id === id);
      if (index === -1) throw new Error('Document type not found');
      const old = _documentTypes[index];
      _documentTypes[index] = { ...old, is_deleted: true, updated_at: new Date().toISOString() };
      saveAll();
      logAudit(getActiveUserSession()?.id, 'DELETE', 'document_types', id, old, null);
      return delay(true);
    }
  },

  quotations: {
    getAll: async (branchId?: string) => {
      if (isSupabaseConfigured && supabase) {
        let query = supabase.from('quotations').select('*, customer:customers(*), branch:branches(*), employee:users!employee_id(*), converted_sale:sales!quotations_converted_sale_id_fkey(*)').eq('is_deleted', false);
        if (branchId) {
          query = query.eq('branch_id', branchId);
        }
        const { data, error } = await query;
        if (error) throw error;

        const resolvedQuotations = [];
        const { data: terms } = await supabase.from('terms_conditions').select('*');
        for (const q of (data || [])) {
          const { data: items } = await supabase.from('quotation_items').select('*, service:services(*)').eq('quotation_id', q.id);
          const qTerms = (terms || []).filter(t => (q.terms_conditions_ids || []).includes(t.id));
          resolvedQuotations.push({
            ...q,
            items: items || [],
            terms_conditions: qTerms
          });
        }
        return resolvedQuotations;
      }

      let list = _quotations.filter(q => !q.is_deleted);
      if (branchId) {
        list = list.filter(q => q.branch_id === branchId);
      }
      return delay(list.map(q => ({
        ...q,
        customer: _customers.find(c => c.id === q.customer_id),
        branch: _branches.find(b => b.id === q.branch_id),
        employee: _users.find(u => u.id === q.employee_id),
        converted_sale: _sales.find(s => s.id === q.converted_sale_id),
        terms_conditions: _termsConditions.filter(t => (q.terms_conditions_ids || []).includes(t.id)),
        items: _quotationItems.filter((qi: QuotationItem) => qi.quotation_id === q.id).map((qi: QuotationItem) => ({
          ...qi,
          service: _services.find(srv => srv.id === qi.service_id)
        }))
      })));
    },
    getById: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data: q, error: qErr } = await supabase.from('quotations').select('*, customer:customers(*), branch:branches(*), employee:users!employee_id(*), converted_sale:sales!quotations_converted_sale_id_fkey(*)').eq('id', id).eq('is_deleted', false).maybeSingle();
        if (qErr) throw qErr;
        if (!q) return undefined;

        const { data: items } = await supabase.from('quotation_items').select('*, service:services(*)').eq('quotation_id', id);
        
        let qTerms: any[] = [];
        if (q.terms_conditions_ids && q.terms_conditions_ids.length > 0) {
          const { data: terms } = await supabase.from('terms_conditions').select('*').in('id', q.terms_conditions_ids);
          qTerms = terms || [];
        }

        return {
          ...q,
          items: items || [],
          terms_conditions: qTerms
        };
      }

      const q = _quotations.find(x => x.id === id && !x.is_deleted);
      if (!q) return delay(undefined);

      const items = _quotationItems.filter((qi: QuotationItem) => qi.quotation_id === q.id).map((qi: QuotationItem) => ({
        ...qi,
        service: _services.find(srv => srv.id === qi.service_id)
      }));

      return delay({
        ...q,
        customer: _customers.find(c => c.id === q.customer_id),
        branch: _branches.find(b => b.id === q.branch_id),
        employee: _users.find(u => u.id === q.employee_id),
        converted_sale: _sales.find(s => s.id === q.converted_sale_id),
        terms_conditions: _termsConditions.filter(t => (q.terms_conditions_ids || []).includes(t.id)),
        items
      });
    },
    create: async (data: {
      customer_id?: string;
      branch_id: string;
      discount: number;
      status?: Quotation['status'];
      valid_until?: string;
      notes?: string;
      terms_conditions_ids?: string[];
      items: Array<{ service_id: string; quantity: number; unit_price: number }>;
      person_name?: string;
      person_phone?: string;
      person_email?: string;
    }) => {
      const subtotal = data.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
      const grand_total = Math.max(0, subtotal - data.discount);
      const activeUser = getActiveUserSession();
      const now = new Date();

      if (isSupabaseConfigured && supabase) {
        const { count } = await supabase.from('quotations').select('*', { count: 'exact', head: true });
        const quoteSeq = (count || 0) + 1;
        const { data: branchData } = await supabase.from('branches').select('name').eq('id', data.branch_id).maybeSingle();
        const branchName = branchData?.name || 'Branch';
        const branchPrefix = branchName.replace(/\s+/g, '').substring(0, 3).toUpperCase();
        const dateStr = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0') + now.getDate().toString().padStart(2, '0');
        const serialStr = quoteSeq.toString().padStart(4, '0');
        const quotation_no = `QT-${branchPrefix}-${dateStr}-${serialStr}`;

        const quoteId = generateUUID();
        const customerId = sanitizeUUID(data.customer_id);
        const employeeId = sanitizeUUID(activeUser?.id);

        const { data: createdQuote, error: qErr } = await supabase.from('quotations').insert([{
          id: quoteId,
          quotation_no,
          customer_id: customerId,
          branch_id: data.branch_id,
          employee_id: employeeId,
          discount: Number(data.discount) || 0,
          subtotal: Number(subtotal) || 0,
          grand_total: Number(grand_total) || 0,
          status: data.status || 'Draft',
          valid_until: data.valid_until || null,
          notes: data.notes || null,
          terms_conditions_ids: data.terms_conditions_ids || [],
          created_by: employeeId,
          updated_by: employeeId,
          person_name: data.person_name || null,
          person_phone: data.person_phone || null,
          person_email: data.person_email || null
        }]).select().single();

        if (qErr) throw qErr;

        const itemsPayload = data.items.map(item => ({
          quotation_id: createdQuote.id,
          service_id: item.service_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.unit_price * item.quantity
        }));
        const { error: itemsErr } = await supabase.from('quotation_items').insert(itemsPayload);
        if (itemsErr) throw itemsErr;

        await supabase.from('quotation_status_history').insert([{
          quotation_id: createdQuote.id,
          status: data.status || 'Draft',
          remarks: 'Quotation Created',
          changed_by: employeeId
        }]);

        return createdQuote as Quotation;
      }

      const quoteSeq = _quotations.length + 1;
      const branch = _branches.find(b => b.id === data.branch_id);
      const branchName = branch ? branch.name : 'Branch';
      const branchPrefix = branchName.replace(/\s+/g, '').substring(0, 3).toUpperCase();
      const dateStr = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0') + now.getDate().toString().padStart(2, '0');
      const serialStr = quoteSeq.toString().padStart(4, '0');
      const quotation_no = `QT-${branchPrefix}-${dateStr}-${serialStr}`;
      const quoteId = generateUUID();

      const createdItems: QuotationItem[] = data.items.map(item => ({
        id: generateUUID(),
        quotation_id: quoteId,
        service_id: item.service_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.unit_price * item.quantity,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      }));

      const newQuote: Quotation = {
        id: quoteId,
        quotation_no,
        customer_id: data.customer_id,
        branch_id: data.branch_id,
        employee_id: activeUser.id,
        discount: data.discount,
        subtotal,
        grand_total,
        status: data.status || 'Draft',
        valid_until: data.valid_until,
        notes: data.notes,
        terms_conditions_ids: data.terms_conditions_ids || [],
        person_name: data.person_name,
        person_phone: data.person_phone,
        person_email: data.person_email,
        is_deleted: false,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        created_by: activeUser.id,
        updated_by: activeUser.id
      };

      _quotations.push(newQuote);
      _quotationItems.push(...createdItems);

      const hist: QuotationStatusHistory = {
        id: generateUUID(),
        quotation_id: quoteId,
        status: data.status || 'Draft',
        remarks: 'Quotation Created',
        changed_at: now.toISOString(),
        changed_by: activeUser.id
      };
      _quotationHistory.unshift(hist);

      saveAll();
      logAudit(activeUser.id, 'INSERT', 'quotations', quoteId, null, newQuote);
      return delay(newQuote);
    },
    update: async (id: string, data: Partial<Omit<Quotation, 'id' | 'created_at' | 'updated_at'>>) => {
      if (isSupabaseConfigured && supabase) {
        const { data: updated, error } = await supabase.from('quotations').update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated as Quotation;
      }

      const index = _quotations.findIndex(q => q.id === id);
      if (index === -1) throw new Error('Quotation not found');
      const old = _quotations[index];
      const updated = { ...old, ...data, updated_at: new Date().toISOString() };
      _quotations[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'UPDATE', 'quotations', id, old, updated);
      return delay(updated);
    },
    updateStatus: async (id: string, status: Quotation['status'], remarks?: string) => {
      const activeUser = getActiveUserSession();
      if (isSupabaseConfigured && supabase) {
        const { data: updated, error } = await supabase.from('quotations').update({ status }).eq('id', id).select().single();
        if (error) throw error;

        const { error: histError } = await supabase.from('quotation_status_history').insert([{
          quotation_id: id,
          status,
          remarks,
          changed_by: activeUser.id
        }]);
        if (histError) throw histError;

        return updated as Quotation;
      }

      const index = _quotations.findIndex(q => q.id === id);
      if (index === -1) throw new Error('Quotation not found');
      const old = _quotations[index];
      const updated = { ...old, status, updated_at: new Date().toISOString() };
      _quotations[index] = updated;

      const hist: QuotationStatusHistory = {
        id: generateUUID(),
        quotation_id: id,
        status,
        remarks,
        changed_at: new Date().toISOString(),
        changed_by: activeUser.id
      };
      _quotationHistory.unshift(hist);

      saveAll();
      logAudit(activeUser.id, 'UPDATE_STATUS', 'quotations', id, old, updated);
      return delay(updated);
    },
    getStatusHistory: async (quotationId: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('quotation_status_history')
          .select('*, changed_by_user:users(name)')
          .eq('quotation_id', quotationId)
          .order('changed_at', { ascending: false });
        if (error) throw error;
        return data.map(item => ({
          ...item,
          changed_by_name: item.changed_by_user?.name || 'System'
        }));
      }

      const list = _quotationHistory.filter(h => h.quotation_id === quotationId);
      return list.map(h => {
        const u = _users.find(x => x.id === h.changed_by);
        return {
          ...h,
          changed_by_name: u ? u.name : 'System'
        };
      }).sort((a,b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
    },
    delete: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('quotations').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
        return true;
      }

      const index = _quotations.findIndex(q => q.id === id);
      if (index === -1) throw new Error('Quotation not found');
      const old = _quotations[index];
      const updated = { ...old, is_deleted: true, updated_at: new Date().toISOString() };
      _quotations[index] = updated;
      saveAll();
      logAudit(getActiveUserSession().id, 'DELETE_SOFT', 'quotations', id, old, updated);
      return delay(true);
    },
    convertToSale: async (id: string) => {
      const activeUser = getActiveUserSession();
      let quotation: any;
      if (isSupabaseConfigured && supabase) {
        const { data: q, error: qErr } = await supabase.from('quotations').select('*').eq('id', id).maybeSingle();
        if (qErr) throw qErr;
        if (!q) throw new Error('Quotation not found');
        const { data: items } = await supabase.from('quotation_items').select('*').eq('quotation_id', id);
        quotation = { ...q, items: items || [] };
      } else {
        const q = _quotations.find(x => x.id === id && !x.is_deleted);
        if (!q) throw new Error('Quotation not found');
        const items = _quotationItems.filter(qi => qi.quotation_id === id);
        quotation = { ...q, items };
      }

      if (quotation.status === 'Converted') {
        throw new Error('Quotation has already been converted to a sale.');
      }

      const createdSale = await db.sales.create({
        customer_id: quotation.customer_id || undefined,
        branch_id: quotation.branch_id,
        discount: quotation.discount,
        notes: quotation.notes ? `Converted from Quotation #${quotation.quotation_no}. ${quotation.notes}` : `Converted from Quotation #${quotation.quotation_no}.`,
        items: quotation.items.map((item: any) => ({
          service_id: item.service_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          staff_id: activeUser.id
        })),
        person_name: quotation.person_name,
        person_phone: quotation.person_phone,
        person_email: quotation.person_email,
        quotation_id: id
      });

      if (isSupabaseConfigured && supabase) {
        const { error: updErr } = await supabase.from('quotations').update({
          status: 'Converted',
          converted_sale_id: createdSale.id
        }).eq('id', id);
        if (updErr) throw updErr;

        await supabase.from('quotation_status_history').insert([{
          quotation_id: id,
          status: 'Converted',
          remarks: `Converted to Sale Invoice #${createdSale.invoice_no}`,
          changed_by: activeUser.id
        }]);
      } else {
        const qIndex = _quotations.findIndex(x => x.id === id);
        if (qIndex !== -1) {
          _quotations[qIndex] = {
            ..._quotations[qIndex],
            status: 'Converted',
            converted_sale_id: createdSale.id,
            updated_at: new Date().toISOString()
          };
          
          const hist: QuotationStatusHistory = {
            id: generateUUID(),
            quotation_id: id,
            status: 'Converted',
            remarks: `Converted to Sale Invoice #${createdSale.invoice_no}`,
            changed_at: new Date().toISOString(),
            changed_by: activeUser.id
          };
          _quotationHistory.unshift(hist);
          
          saveAll();
        }
      }

      return createdSale;
    }
  },
  termsConditions: {
    getAll: async () => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('terms_conditions').select('*').eq('is_deleted', false).order('sequence', { ascending: true });
        if (error) throw error;
        return data as TermsConditions[];
      }
      const active = _termsConditions.filter(t => !t.is_deleted).sort((a, b) => a.sequence - b.sequence);
      return delay(active);
    },
    getById: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('terms_conditions').select('*').eq('id', id).eq('is_deleted', false).maybeSingle();
        if (error) throw error;
        return data as TermsConditions;
      }
      const term = _termsConditions.find(t => t.id === id && !t.is_deleted);
      return delay(term);
    },
    create: async (data: Omit<TermsConditions, 'id' | 'is_deleted' | 'created_at' | 'updated_at'>) => {
      const activeUser = getActiveUserSession();
      const now = new Date();
      const id = generateUUID();
      const newTerm: TermsConditions = {
        ...data,
        id,
        is_deleted: false,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      };

      if (isSupabaseConfigured && supabase) {
        const { data: created, error } = await supabase.from('terms_conditions').insert([newTerm]).select().single();
        if (error) throw error;
        return created as TermsConditions;
      }

      _termsConditions.push(newTerm);
      saveAll();
      logAudit(activeUser.id, 'INSERT_TERM', 'terms_conditions', id, null, newTerm);
      return newTerm;
    },
    update: async (id: string, data: Partial<Omit<TermsConditions, 'id' | 'created_at' | 'updated_at'>>) => {
      const activeUser = getActiveUserSession();
      const now = new Date();

      if (isSupabaseConfigured && supabase) {
        const { data: updated, error } = await supabase.from('terms_conditions').update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated as TermsConditions;
      }

      const idx = _termsConditions.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('Term & Condition not found');
      const old = _termsConditions[idx];
      const updated = { ...old, ...data, updated_at: now.toISOString() };
      _termsConditions[idx] = updated;
      saveAll();
      logAudit(activeUser.id, 'UPDATE_TERM', 'terms_conditions', id, old, updated);
      return updated;
    },
    delete: async (id: string) => {
      const activeUser = getActiveUserSession();
      const now = new Date();

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('terms_conditions').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
        return true;
      }

      const idx = _termsConditions.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('Term & Condition not found');
      const old = _termsConditions[idx];
      const updated = { ...old, is_deleted: true, updated_at: now.toISOString() };
      _termsConditions[idx] = updated;
      saveAll();
      logAudit(activeUser.id, 'DELETE_TERM', 'terms_conditions', id, old, updated);
      return true;
    }
  },

  journal: {
    getAll: async (filters?: { entry_type?: string; performed_by?: string; from_date?: string; to_date?: string }) => {
      const cacheKey = `journal:${JSON.stringify(filters || {})}`;
      const cached = getCached<JournalEntry[]>(cacheKey);
      if (cached) return cached;

      if (isSupabaseConfigured && supabase) {
        let q = supabase.from('journal_entries').select('*, creator:users(id, name, username, email)').order('entry_date', { ascending: false });
        if (filters?.entry_type && filters.entry_type !== 'all') q = q.eq('entry_type', filters.entry_type);
        if (filters?.performed_by) q = q.eq('performed_by', filters.performed_by);
        const { data, error } = await q;
        if (!error && data) {
          const salesIds = Array.from(new Set(data.map(j => j.sale_id).filter(Boolean)));
          const salesMap = new Map<string, string>();
          if (salesIds.length > 0) {
            try {
              const { data: salesList } = await supabase.from('sales').select('id, invoice_no').in('id', salesIds);
              (salesList || []).forEach(s => salesMap.set(s.id, s.invoice_no));
            } catch (e) {
              console.warn('Could not batch load sales for journal references:', e);
            }
          }
          const res = data.map((j: any) => {
            const rawRef = j.reference_no;
            const matchedInv = j.sale_id ? salesMap.get(j.sale_id) : undefined;
            const saleRef = matchedInv ? (matchedInv.startsWith('#') ? matchedInv : `#${matchedInv}`) : undefined;
            const descMatch = j.description?.match(/#(INV-[A-Za-z0-9-]+)/)?.[0];
            return {
              ...j,
              reference_no: rawRef || saleRef || descMatch || undefined
            } as JournalEntry;
          });
          return setCached(cacheKey, res, 10000);
        }
      }
      let list = _journalEntries;
      if (filters?.entry_type && filters.entry_type !== 'all') {
        list = list.filter(j => j.entry_type === filters.entry_type);
      }
      if (filters?.performed_by) {
        list = list.filter(j => j.performed_by === filters.performed_by || j.created_by === filters.performed_by);
      }
      if (filters?.from_date) {
        list = list.filter(j => j.entry_date >= filters.from_date!);
      }
      if (filters?.to_date) {
        list = list.filter(j => j.entry_date <= filters.to_date!);
      }
      const res = list.map(j => {
        const foundSale = j.sale_id ? _sales.find(s => s.id === j.sale_id) : undefined;
        const rawRef = j.reference_no;
        const saleRef = foundSale?.invoice_no ? (foundSale.invoice_no.startsWith('#') ? foundSale.invoice_no : `#${foundSale.invoice_no}`) : undefined;
        const descMatch = j.description?.match(/#(INV-[A-Za-z0-9-]+)/)?.[0];
        return {
          ...j,
          creator: _users.find(u => u.id === j.performed_by || u.id === j.created_by),
          sale: foundSale ? { id: foundSale.id, invoice_no: foundSale.invoice_no } : (j as any).sale,
          reference_no: rawRef || saleRef || descMatch || undefined
        };
      });
      return setCached(cacheKey, res, 10000);
    },
    create: async (data: Omit<JournalEntry, 'id' | 'created_at'>) => {
      invalidateCache('journal');
      invalidateCache('accounts');
      const activeUser = getActiveUserSession();
      const now = new Date().toISOString();
      const entry: JournalEntry = {
        ...data,
        id: generateUUID(),
        entry_date: data.entry_date || now,
        created_at: now,
        created_by: activeUser?.id,
        performed_by: data.performed_by || activeUser?.id
      };
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: created, error } = await supabase.from('journal_entries').insert([{
            ...entry,
            sale_id: sanitizeUUID(entry.sale_id),
            payment_id: sanitizeUUID(entry.payment_id),
            expense_id: sanitizeUUID(entry.expense_id),
            from_account_id: sanitizeUUID(entry.from_account_id),
            to_account_id: sanitizeUUID(entry.to_account_id),
            performed_by: sanitizeUUID(entry.performed_by),
            created_by: sanitizeUUID(entry.created_by)
          }]).select().single();
          if (!error && created) return created as JournalEntry;
        } catch (e) {
          console.warn('Supabase journal entry fallback:', e);
        }
      }
      _journalEntries.unshift(entry);
      saveAll();
      return delay(entry);
    },
    clearAll: async () => {
      invalidateCache('journal');
      invalidateCache('accounts');
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('journal_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        } catch (e) {
          console.warn('Supabase journal clear error:', e);
        }
      }
      _journalEntries = [];
      saveToLocalStorage(KEYS.JOURNAL_ENTRIES, []);
      return true;
    }
  }
};

