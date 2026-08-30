import { isSupabaseConfigured, supabase } from './supabase';
import type {
  Branch, Role, Permission, RolePermission, User, Customer,
  ServiceCategory, Service, OrderStatus, Sale, SaleItem, Payment,
  ExpenseCategory, Expense, OrderStatusHistory, AuditLog, ClientDocument,
  Quotation, QuotationItem, QuotationStatusHistory, TermsConditions
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
  QUOTATIONS: 'azizi_erp_quotations',
  QUOTATION_ITEMS: 'azizi_erp_quotation_items',
  QUOTATION_STATUS_HISTORY: 'azizi_erp_quotation_status_history',
  TERMS_CONDITIONS: 'azizi_erp_terms_conditions',
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

let _clientDocuments: ClientDocument[] = getOrSeed(KEYS.CLIENT_DOCUMENTS, () => SEED_CLIENT_DOCUMENTS(_customers));
let _quotations: Quotation[] = getOrSeed(KEYS.QUOTATIONS, () => []);
let _quotationItems: QuotationItem[] = getOrSeed(KEYS.QUOTATION_ITEMS, () => []);
let _quotationHistory: QuotationStatusHistory[] = getOrSeed(KEYS.QUOTATION_STATUS_HISTORY, () => []);
let _termsConditions: TermsConditions[] = getOrSeed(KEYS.TERMS_CONDITIONS, () => SEED_TERMS_CONDITIONS());

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
  saveToLocalStorage(KEYS.QUOTATIONS, _quotations);
  saveToLocalStorage(KEYS.QUOTATION_ITEMS, _quotationItems);
  saveToLocalStorage(KEYS.QUOTATION_STATUS_HISTORY, _quotationHistory);
  saveToLocalStorage(KEYS.TERMS_CONDITIONS, _termsConditions);
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
  const saved = localStorage.getItem('azizi_active_session');
  if (saved) {
    try {
      const u = JSON.parse(saved);
      const found = _users.find(x => x.id === u.id && !x.is_deleted);
      if (found) return found;
    } catch {}
  }
  return _users[0];
};

export const setActiveUserSession = (user: User) => {
  localStorage.setItem('azizi_active_session', JSON.stringify(user));
};

const delay = <T>(value: T, ms = 150): Promise<T> => {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
};

// ---------------------------------------------------------
// COMBINED DB CRUD API (SUPABASE + LOCAL STORAGE FALLBACK)
// ---------------------------------------------------------
export const db = {
  branches: {
    getAll: async () => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('branches').select('*').eq('is_deleted', false);
        if (error) throw error;
        return data as Branch[];
      }
      return delay(_branches.filter(b => !b.is_deleted));
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
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('roles').select('*').eq('is_deleted', false);
        if (error) throw error;
        return data as Role[];
      }
      return delay(_roles.filter(r => !r.is_deleted));
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
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('permissions').select('*');
        if (error) throw error;
        return data as Permission[];
      }
      return delay(_permissions);
    },
  },

  rolePermissions: {
    getByRoleId: async (roleId: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('role_permissions').select('*').eq('role_id', roleId);
        if (error) throw error;
        return data as RolePermission[];
      }
      return delay(_rolePermissions.filter(rp => rp.role_id === roleId));
    },
    updateRolePermissions: async (roleId: string, permissionIds: string[]) => {
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
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('users').select('*, role:roles(*), branch:branches(*)').eq('is_deleted', false);
        if (error) throw error;
        return data as User[];
      }
      return delay(_users.filter(u => !u.is_deleted).map(u => ({
        ...u,
        role: _roles.find(r => r.id === u.role_id),
        branch: _branches.find(b => b.id === u.branch_id)
      })));
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
      const userPassword = data.password || 'password';
      if (isSupabaseConfigured && supabase) {
        const payload = { ...data, password: userPassword };
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
      if (isSupabaseConfigured && supabase) {
        const updatePayload: any = { ...data };
        if (!updatePayload.password) delete updatePayload.password;
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
      let customersList: Customer[] = [];
      let salesList: Sale[] = [];
      let paymentsList: Payment[] = [];

      if (isSupabaseConfigured && supabase) {
        const { data: c, error: cErr } = await supabase.from('customers').select('*').eq('is_deleted', false);
        const { data: s, error: sErr } = await supabase.from('sales').select('*').eq('is_deleted', false);
        const { data: p, error: pErr } = await supabase.from('payments').select('*').eq('is_deleted', false);
        if (cErr || sErr || pErr) throw cErr || sErr || pErr;
        customersList = c || [];
        salesList = s || [];
        paymentsList = p || [];
      } else {
        customersList = _customers.filter(c => !c.is_deleted);
        salesList = _sales.filter(s => !s.is_deleted);
        paymentsList = _payments.filter(p => !p.is_deleted);
      }

      return customersList.map(c => {
        const customerSales = salesList.filter(s => s.customer_id === c.id);
        const saleIds = customerSales.map(s => s.id);
        const totalPurchased = customerSales.reduce((sum: number, s: Sale) => sum + s.grand_total, 0);
        const totalPaid = paymentsList
          .filter((p: Payment) => saleIds.includes(p.sale_id))
          .reduce((sum: number, p: Payment) => sum + p.amount, 0);
        const due = Math.max(0, totalPurchased - totalPaid);

        return {
          ...c,
          due,
          total_paid: totalPaid,
          total_purchased: totalPurchased,
          sales_count: customerSales.length
        };
      });
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
          const { data: s, error: sErr } = await supabase.from('sales').select('*').eq('customer_id', id).eq('is_deleted', false);
          const { data: p, error: pErr } = await supabase.from('payments').select('*').eq('is_deleted', false);
          const { data: b, error: bErr } = await supabase.from('branches').select('*');
          const { data: st, error: stErr } = await supabase.from('order_statuses').select('*');
          if (sErr || pErr || bErr || stErr) throw sErr || pErr || bErr || stErr;

          salesList = s || [];
          paymentsList = p || [];
          branchesList = b || [];
          statusesList = st || [];
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
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('service_categories').select('*').eq('is_deleted', false);
        if (error) throw error;
        return data as ServiceCategory[];
      }
      return delay(_categories.filter(c => !c.is_deleted));
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
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('services').select('*, category:service_categories(*)').eq('is_deleted', false);
        if (error) throw error;
        return data as Service[];
      }
      return delay(_services.filter(s => !s.is_deleted).map(s => ({
        ...s,
        category: _categories.find(c => c.id === s.category_id)
      })));
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
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('order_statuses').select('*').eq('is_deleted', false).order('sequence', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) {
          const defaultStatuses = SEED_ORDER_STATUSES();
          const { data: seeded, error: seedErr } = await supabase.from('order_statuses').upsert(defaultStatuses, { onConflict: 'id' }).select();
          if (!seedErr && seeded && seeded.length > 0) return seeded as OrderStatus[];
        }
        return (data || []) as OrderStatus[];
      }
      return delay(_statuses.filter(s => !s.is_deleted).sort((a, b) => a.sequence - b.sequence));
    },
    create: async (data: Omit<OrderStatus, 'id' | 'is_deleted' | 'is_system' | 'created_at' | 'updated_at'>) => {
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
      if (isSupabaseConfigured && supabase) {
        let query = supabase.from('sales').select('*, customer:customers(*), branch:branches(*), employee:users!employee_id(*), order_status:order_statuses(*)').eq('is_deleted', false);
        if (branchId) {
          query = query.eq('branch_id', branchId);
        }
        const { data, error } = await query;
        if (error) throw error;

        // Fetch inner items and payments
        const resolvedSales = [];
        for (const s of (data || [])) {
          const { data: items } = await supabase.from('sale_items').select('*, service:services(*), staff:users!staff_id(*)').eq('sale_id', s.id);
          const { data: pList } = await supabase.from('payments').select('*').eq('sale_id', s.id).eq('is_deleted', false);
          resolvedSales.push({
            ...s,
            items: items || [],
            payments: pList || []
          });
        }
        return resolvedSales;
      }

      let list = _sales.filter(s => !s.is_deleted);
      if (branchId) {
        list = list.filter(s => s.branch_id === branchId);
      }
      return delay(list.map(s => ({
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
        payments: _payments.filter((p: Payment) => p.sale_id === s.id && !p.is_deleted)
      })));
    },
    getById: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data: s, error: sErr } = await supabase.from('sales').select('*, customer:customers(*), branch:branches(*), employee:users!employee_id(*), order_status:order_statuses(*)').eq('id', id).eq('is_deleted', false).maybeSingle();
        if (sErr) throw sErr;
        if (!s) return undefined;

        const { data: items } = await supabase.from('sale_items').select('*, service:services(*), staff:users!staff_id(*)').eq('sale_id', id);
        const { data: paymentsList } = await supabase.from('payments').select('*').eq('sale_id', id).eq('is_deleted', false);
        const { data: history } = await supabase.from('order_status_history').select('*, new_status:order_statuses(*), user:users(*)').eq('sale_id', id).order('created_at', { ascending: false });

        return {
          ...s,
          items: items || [],
          payments: paymentsList || [],
          history: history || []
        };
      }

      const s = _sales.find(x => x.id === id && !x.is_deleted);
      if (!s) return delay(undefined);

      const items = _saleItems.filter((si: SaleItem) => si.sale_id === s.id).map((si: SaleItem) => ({
        ...si,
        service: _services.find(srv => srv.id === si.service_id),
        staff: _users.find(u => u.id === (si.staff_id || s.employee_id))
      }));

      const paymentsList = _payments.filter((p: Payment) => p.sale_id === s.id && !p.is_deleted);
      
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
      items: Array<{ service_id: string; quantity: number; unit_price: number; person_name?: string; service_date?: string; staff_id?: string }>;
      initialPayment?: { amount: number; payment_method: Payment['payment_method'] };
      person_name?: string;
      person_phone?: string;
      person_email?: string;
      quotation_id?: string;
    }) => {
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
            staff_id: item.staff_id ? sanitizeUUID(item.staff_id) : employeeId
          }));
          const { error: itemsErr } = await supabase.from('sale_items').insert(itemsPayload);
          if (itemsErr) throw itemsErr;

          if (data.initialPayment && data.initialPayment.amount > 0) {
            const { error: pErr } = await supabase.from('payments').insert([{
              id: generateUUID(),
              sale_id: createdSale.id,
              amount: data.initialPayment.amount,
              payment_method: data.initialPayment.payment_method,
              payment_date: new Date().toISOString(),
              transaction_no: (data.initialPayment as any).transaction_no || null,
              notes: (data.initialPayment as any).notes || null,
              created_by: employeeId,
              updated_by: employeeId
            }]);
            if (pErr) throw pErr;
          }

          if (data.quotation_id) {
            await supabase.from('quotations').update({ 
              status: 'Converted',
              remarks: `Converted to Sale Invoice #${invoice_no}`,
              updated_at: new Date().toISOString()
            }).eq('id', data.quotation_id);
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

      saveAll();
      logAudit(activeUser.id, 'INSERT_SALE', 'sales', saleId, null, newSale);
      
      return delay(newSale);
    },
    updateStatus: async (saleId: string, newStatusId: string, remarks?: string) => {
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
    addItem: async (saleId: string, item: { service_id: string; quantity: number; unit_price: number; person_name?: string; service_date?: string; staff_id?: string }) => {
      const activeUser = getActiveUserSession();
      const employeeId = sanitizeUUID(activeUser?.id);
      const targetStaffId = item.staff_id ? sanitizeUUID(item.staff_id) : employeeId;
      const now = new Date();
      const subtotal = item.unit_price * item.quantity;
      const serviceDate = item.service_date || now.toISOString().split('T')[0];

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
    getBySaleId: async (saleId: string) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from('payments').select('*').eq('sale_id', saleId).eq('is_deleted', false);
        if (error) throw error;
        return data as Payment[];
      }
      return delay(_payments.filter((p: Payment) => p.sale_id === saleId && !p.is_deleted));
    },
    create: async (data: {
      sale_id: string;
      amount: number;
      payment_method: Payment['payment_method'];
      transaction_no?: string;
      notes?: string;
    }) => {
      const activeUser = getActiveUserSession();
      const employeeId = sanitizeUUID(activeUser?.id);

      if (isSupabaseConfigured && supabase) {
        const payload = {
          ...data,
          id: generateUUID(),
          received_by: employeeId,
          created_by: employeeId,
          updated_by: employeeId
        };
        const { data: created, error } = await supabase.from('payments').insert([payload]).select().single();
        if (error) throw error;

        // Recalculate Sale Payment Status
        const { data: sale } = await supabase.from('sales').select('grand_total').eq('id', data.sale_id).maybeSingle();
        const { data: allPayments } = await supabase.from('payments').select('amount').eq('sale_id', data.sale_id).eq('is_deleted', false);

        const grand_total = sale?.grand_total || 0;
        const totalPaid = (allPayments || []).reduce((sum: number, p: any) => sum + p.amount, 0);

        let payment_status: Sale['payment_status'] = 'Unpaid';
        if (totalPaid >= grand_total) payment_status = 'Paid';
        else if (totalPaid > 0) payment_status = 'Partially Paid';

        await supabase.from('sales').update({ payment_status, updated_by: employeeId }).eq('id', data.sale_id);
        return created as Payment;
      }

      const newPay: Payment = {
        ...data,
        id: generateUUID(),
        payment_date: new Date().toISOString(),
        received_by: activeUser.id,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: activeUser.id,
        updated_by: activeUser.id
      };
      _payments.push(newPay);

      const saleIndex = _sales.findIndex(s => s.id === data.sale_id);
      if (saleIndex !== -1) {
        const sale = _sales[saleIndex];
        const allSalePayments = _payments.filter((p: Payment) => p.sale_id === data.sale_id && !p.is_deleted);
        const totalPaid = allSalePayments.reduce((sum: number, p: Payment) => sum + p.amount, 0);
        
        let payment_status: Sale['payment_status'] = 'Unpaid';
        if (totalPaid >= sale.grand_total) payment_status = 'Paid';
        else if (totalPaid > 0) payment_status = 'Partially Paid';

        _sales[saleIndex] = { ...sale, payment_status, updated_by: activeUser.id, updated_at: new Date().toISOString() };
      }

      saveAll();
      logAudit(activeUser.id, 'INSERT_PAYMENT', 'payments', newPay.id, null, newPay);
      return delay(newPay);
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
        if (error) throw error;
        return data as Expense[];
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
        if (error) throw error;
        return data as Expense;
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
      if (isSupabaseConfigured && supabase) {
        const { data: created, error } = await supabase.from('expenses').insert([data]).select().single();
        if (error) throw error;
        return created as Expense;
      }
      const newExp: Expense = {
        ...data,
        id: generateUUID(),
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      _expenses.push(newExp);
      saveAll();
      logAudit(getActiveUserSession().id, 'INSERT', 'expenses', newExp.id, null, newExp);
      return delay(newExp);
    },
    update: async (id: string, data: Partial<Omit<Expense, 'id' | 'created_at' | 'updated_at'>>) => {
      if (isSupabaseConfigured && supabase) {
        const { data: updated, error } = await supabase.from('expenses').update(data).eq('id', id).select().single();
        if (error) throw error;
        return updated as Expense;
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
  }
};
