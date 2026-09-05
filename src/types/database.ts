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
  customer_type?: 'individual' | 'company';
  company_id?: string;
  company?: Customer;
  due?: number;
  total_paid?: number;
  total_purchased?: number;
  sales_count?: number;
  members?: { id?: string; name: string; phone?: string; email?: string }[];
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
  expense?: number;
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
  person_name?: string;
  person_phone?: string;
  person_email?: string;
  quotation_id?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  service_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  expense?: number;
  account_id?: string;
  expense_id?: string;
  person_name?: string;
  service_date?: string;
  staff_id?: string;
  notes?: string;
  staff?: User;
  service?: Service;
  account?: Account;
  expenses?: Expense[];
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  sale_id: string;
  amount: number;
  payment_method: 'Cash' | 'Card' | 'Mobile Banking' | 'Bank Transfer';
  account_id?: string;
  transaction_no?: string;
  payment_date: string;
  notes?: string;
  person_name?: string;
  received_by?: string;
  is_refund?: boolean;
  refund_reason?: string;
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
  sale_id?: string;
  sale_item_id?: string;
  account_id?: string;
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

export interface DocumentType {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientDocument {
  id: string;
  customer_id: string;
  document_type: string;
  document_number?: string;
  expiry_date: string;
  notified: boolean;
  notes?: string;
  status: 'Active' | 'Expired' | 'Renewed';
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

export interface Quotation {
  id: string;
  quotation_no: string;
  customer_id?: string;
  branch_id: string;
  employee_id?: string;
  discount: number;
  subtotal: number;
  grand_total: number;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Converted';
  valid_until?: string;
  notes?: string;
  person_name?: string;
  person_phone?: string;
  person_email?: string;
  converted_sale_id?: string;
  terms_conditions_ids?: string[];
  terms_conditions?: TermsConditions[];
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  service_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
  updated_at: string;
}

export interface QuotationStatusHistory {
  id: string;
  quotation_id: string;
  status: string;
  remarks?: string;
  changed_at: string;
  changed_by?: string;
}

export interface TermsConditions {
  id: string;
  title: string;
  content: string;
  sequence: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'card' | 'cash_drawer' | 'bank' | 'other';
  bank_name?: string;
  account_number?: string;
  balance: number;
  branch_id?: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  branch?: Branch;
}

export interface AccountTransaction {
  id: string;
  account_id: string;
  transaction_type: 'deposit' | 'withdrawal' | 'expense' | 'income' | 'transfer';
  amount: number;
  balance_after?: number;
  sale_id?: string;
  expense_id?: string;
  payment_id?: string;
  related_account_id?: string;
  description?: string;
  reference_no?: string;
  created_at: string;
  created_by?: string;
  account?: Account;
  related_account?: Account;
}

export interface JournalEntry {
  id: string;
  entry_date: string;
  entry_type: 'cash_in' | 'cash_out' | 'transfer' | 'adjustment';
  from_account: string;
  to_account: string;
  from_account_id?: string;
  to_account_id?: string;
  amount: number;
  sale_id?: string;
  payment_id?: string;
  expense_id?: string;
  reference_no?: string;
  description?: string;
  performed_by?: string;
  created_at: string;
  created_by?: string;
  creator?: User;
  sale?: { id: string; invoice_no: string; customer_id?: string };
}


