export interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  auth_user_id?: string;
  name: string;
  email: string;
  phone?: string;
  role_id: string;
  branch_id: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  role?: Role;
  branch?: Branch;
  permissions?: string[];
  password?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  status: 'Active' | 'Inactive';
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderStatus {
  id: string;
  name: string;
  color: string;
  sequence: number;
  is_system: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  invoice_no: string;
  customer_id?: string;
  branch_id: string;
  employee_id?: string;
  discount: number;
  subtotal: number;
  grand_total: number;
  payment_status: 'Unpaid' | 'Partially Paid' | 'Paid';
  order_status_id: string;
  notes?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  service_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  sale_id: string;
  amount: number;
  payment_method: 'Cash' | 'Card' | 'Mobile Banking' | 'Bank Transfer';
  transaction_no?: string;
  payment_date: string;
  notes?: string;
  received_by?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  category_id: string;
  branch_id: string;
  amount: number;
  expense_date: string;
  description?: string;
  paid_to?: string;
  payment_method: 'Cash' | 'Card' | 'Mobile Banking' | 'Bank Transfer';
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderStatusHistory {
  id: string;
  sale_id: string;
  previous_status_id?: string;
  new_status_id: string;
  changed_by?: string;
  remarks?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data?: any;
  new_data?: any;
  created_at: string;
}

export interface ClientDocument {
  id: string;
  customer_id: string;
  document_type: 'Visa' | 'Emirates ID' | 'Passport' | 'Trade License' | 'Other';
  document_number?: string;
  expiry_date: string;
  notified: boolean;
  notes?: string;
  status: 'Active' | 'Expired' | 'Renewed';
  created_at: string;
  updated_at: string;
  customer?: Customer;
}
