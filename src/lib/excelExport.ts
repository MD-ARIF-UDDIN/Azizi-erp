import * as XLSX from 'xlsx';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString();
  } catch (e) {
    return dateStr;
  }
};

export const exportToExcel = (headers: string[], rows: (string | number)[][], fileName: string, sheetName: string = 'Sheet1') => {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Auto-fit column widths
  const colWidths = headers.map((_, colIdx) => {
    let maxLen = headers[colIdx].length;
    for (let rIdx = 1; rIdx < data.length; rIdx++) {
      const val = data[rIdx][colIdx];
      if (val !== undefined && val !== null) {
        maxLen = Math.max(maxLen, String(val).length);
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 10), 50) }; // min 10, max 50 width
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

// 1. Customers Export
export const exportCustomers = (customers: any[]) => {
  const headers = [
    'SL',
    'Customer Name',
    'Customer Type',
    'Parent Company',
    'Phone',
    'Email',
    'Address',
    'Notes',
    'Grand Total (AED)',
    'Total Paid (AED)',
    'Outstanding Due (AED)',
    'Total Orders',
    'Registered Date'
  ];
  
  const rows = customers.map((c, idx) => [
    idx + 1,
    c.name || '',
    c.customer_type === 'company' ? 'Company' : 'Individual',
    c.company?.name || '',
    c.phone || '',
    c.email || '',
    c.address || '',
    c.notes || '',
    Number((c.total_purchased || 0).toFixed(2)),
    Number((c.total_paid || 0).toFixed(2)),
    Number((c.due || 0).toFixed(2)),
    c.sales_count || 0,
    formatDate(c.created_at)
  ]);
  
  exportToExcel(headers, rows, 'Customers_List', 'Customers');
};

// 2. Sales Export
export const exportSales = (sales: any[]) => {
  const headers = [
    'SL',
    'Invoice No',
    'Date & Time',
    'Branch',
    'Customer Name',
    'Customer Type',
    'Members / Persons',
    'Contact Phone',
    'Contact Email',
    'Job Status',
    'Payment Status',
    'Subtotal (AED)',
    'Discount (AED)',
    'Grand Total (AED)',
    'Total Paid (AED)',
    'Outstanding Due (AED)',
    'Notes',
    'Items Summary'
  ];

  const rows = sales.map((s, idx) => {
    const totalPaid = s.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
    const due = Math.max(0, s.grand_total - totalPaid);
    const itemsSummary = s.items?.map((item: any) => `${item.service?.name || 'Service'} (x${item.quantity})`).join(', ') || '';
    const memberNames = Array.from(new Set([
      ...(s.person_name ? [s.person_name.trim()] : []),
      ...((s.items || []).map((item: any) => item.person_name?.trim()).filter(Boolean))
    ])).filter(Boolean);
    const membersStr = memberNames.join(', ');
    
    return [
      idx + 1,
      `#${s.invoice_no}`,
      s.created_at ? new Date(s.created_at).toLocaleString() : '',
      s.branch?.name || '',
      s.customer?.name || 'Walk-in Customer',
      s.customer?.customer_type ? (s.customer.customer_type === 'company' ? 'Company' : 'Individual') : 'Walk-in',
      membersStr,
      s.person_phone || s.customer?.phone || '',
      s.person_email || s.customer?.email || '',
      s.order_status?.name || '',
      s.payment_status || 'Unpaid',
      Number(s.subtotal.toFixed(2)),
      Number(s.discount.toFixed(2)),
      Number(s.grand_total.toFixed(2)),
      Number(totalPaid.toFixed(2)),
      Number(due.toFixed(2)),
      s.notes || '',
      itemsSummary
    ];
  });

  exportToExcel(headers, rows, 'Sales_Invoice_List', 'Sales');
};

// 3. Services Export
export const exportServices = (services: any[]) => {
  const headers = [
    'SL',
    'Service Name',
    'Category',
    'Selling Price (AED)',
    'Our Expense (AED)',
    'Gross Profit (AED)'
  ];

  const rows = services.map((s, idx) => {
    const price = s.price || 0;
    const expense = s.expense || 0;
    const profit = price - expense;
    return [
      idx + 1,
      s.name || '',
      s.category?.name || 'Uncategorized',
      Number(price.toFixed(2)),
      Number(expense.toFixed(2)),
      Number(profit.toFixed(2))
    ];
  });

  exportToExcel(headers, rows, 'Services_Catalog', 'Services');
};

// 3b. Service Categories Export
export const exportServiceCategories = (categories: any[], services: any[]) => {
  const headers = [
    'SL',
    'Category Name',
    'Description',
    'Linked Service Items Count'
  ];

  const rows = categories.map((c, idx) => {
    const itemCount = services.filter(s => s.category_id === c.id).length;
    return [
      idx + 1,
      c.name || '',
      c.description || 'No description listed.',
      itemCount
    ];
  });

  exportToExcel(headers, rows, 'Service_Categories_List', 'Categories');
};

// 4. Expenses Export
export const exportExpenses = (expenses: any[]) => {
  const headers = [
    'SL',
    'Expense Date',
    'Category',
    'Branch',
    'Paid To',
    'Payment Method',
    'Description',
    'Amount (AED)'
  ];

  const rows = expenses.map((e, idx) => [
    idx + 1,
    e.expense_date || '',
    e.category?.name || 'Uncategorized',
    e.branch?.name || '',
    e.paid_to || 'N/A',
    e.payment_method || 'Cash',
    e.description || '',
    Number(e.amount.toFixed(2))
  ]);

  exportToExcel(headers, rows, 'Expenses_Log', 'Expenses');
};

// 4b. Expense Categories Export
export const exportExpenseCategories = (categories: any[]) => {
  const headers = [
    'SL',
    'Category Name',
    'Description'
  ];

  const rows = categories.map((c, idx) => [
    idx + 1,
    c.name || '',
    c.description || ''
  ]);

  exportToExcel(headers, rows, 'Expense_Categories_List', 'Categories');
};

// 5. Payments Export
export const exportPayments = (payments: any[]) => {
  const headers = [
    'SL',
    'Payment Date',
    'Invoice No',
    'Branch',
    'Customer Name',
    'For Member',
    'Received By',
    'Payment Method',
    'Transaction No',
    'Amount (AED)',
    'Notes'
  ];

  const rows = payments.map((p, idx) => [
    idx + 1,
    formatDate(p.payment_date),
    `#${p.sale_invoice}`,
    p.sale_branch_name || '',
    p.sale_customer_name || 'Walk-in Customer',
    p.person_name || 'All Members / General',
    p.received_by_name || 'Cashier',
    p.payment_method || 'Cash',
    p.transaction_no || 'N/A',
    Number(p.amount.toFixed(2)),
    p.notes || ''
  ]);

  exportToExcel(headers, rows, 'Payments_Log', 'Payments');
};

// 6. RBAC Users Export
export const exportUsers = (users: any[]) => {
  const headers = [
    'SL',
    'Employee Name',
    'Email',
    'Phone',
    'Role',
    'Branch',
    'Status'
  ];

  const rows = users.map((u, idx) => [
    idx + 1,
    u.name || '',
    u.email || '',
    u.phone || '',
    u.role?.name || '',
    u.branch?.name || '',
    u.status || 'Active'
  ]);

  exportToExcel(headers, rows, 'Employees_List', 'Employees');
};

// 6b. RBAC Roles Export
export const exportRoles = (roles: any[], rolePermsMap: Record<string, string[]>, permissions: any[]) => {
  const headers = [
    'SL',
    'Role Name',
    'Description',
    'Permissions Assigned'
  ];

  const rows = roles.map((r, idx) => {
    const permIds = rolePermsMap[r.id] || [];
    const permNames = permIds.map(id => permissions.find(p => p.id === id)?.name || id).join(', ');
    return [
      idx + 1,
      r.name || '',
      r.description || '',
      permNames || 'None'
    ];
  });

  exportToExcel(headers, rows, 'Roles_List', 'Roles');
};

// 6c. RBAC Branches Export
export const exportBranches = (branches: any[]) => {
  const headers = [
    'SL',
    'Branch Name',
    'Address',
    'Phone',
    'Email'
  ];

  const rows = branches.map((b, idx) => [
    idx + 1,
    b.name || '',
    b.address || '',
    b.phone || '',
    b.email || ''
  ]);

  exportToExcel(headers, rows, 'Branches_List', 'Branches');
};

// 7. Report - Sales Report
export const exportSalesReport = (sales: any[], startDate: string, endDate: string) => {
  const headers = [
    'SL',
    'Invoice No',
    'Date',
    'Branch',
    'Customer',
    'Subtotal (AED)',
    'Discount (AED)',
    'Grand Total (AED)',
    'Paid (AED)',
    'Due (AED)'
  ];

  const rows = sales.map((s, idx) => {
    const customerText = s.customer 
      ? s.person_name
        ? `${s.person_name} (${s.customer.name})`
        : s.customer.company?.name
        ? `${s.customer.name} (${s.customer.company.name})`
        : s.customer.name
      : 'Walk-in';

    return [
      idx + 1,
      s.invoice_no,
      formatDate(s.created_at),
      s.branch?.name || '',
      customerText,
      Number(s.subtotal.toFixed(2)),
      Number(s.discount.toFixed(2)),
      Number(s.grand_total.toFixed(2)),
      Number(s.total_paid.toFixed(2)),
      Number(s.due_balance.toFixed(2))
    ];
  });

  exportToExcel(headers, rows, `Sales_Report_${startDate}_to_${endDate}`, 'Sales Report');
};

// 8. Report - Expenses Report
export const exportExpensesReport = (expenses: any[], startDate: string, endDate: string) => {
  const headers = [
    'SL',
    'Expense Date',
    'Category',
    'Branch',
    'Paid To',
    'Payment Method',
    'Description',
    'Amount (AED)'
  ];

  const rows = expenses.map((e, idx) => [
    idx + 1,
    e.expense_date || '',
    e.category?.name || 'Uncategorized',
    e.branch?.name || '',
    e.paid_to || 'N/A',
    e.payment_method || 'Cash',
    e.description || '',
    Number(e.amount.toFixed(2))
  ]);

  exportToExcel(headers, rows, `Expenses_Report_${startDate}_to_${endDate}`, 'Expenses Report');
};

// 9. Report - Service Performance Report
export const exportServicePerformanceReport = (performanceList: any[], startDate: string, endDate: string) => {
  const headers = [
    'SL',
    'Service Name',
    'Category',
    'Quantity Sold',
    'Gross revenue Generated (AED)'
  ];

  const rows = performanceList.map((sp, idx) => [
    idx + 1,
    sp.serviceName || '',
    sp.categoryName || '',
    sp.quantitySold || 0,
    Number((sp.totalGross || 0).toFixed(2))
  ]);

  exportToExcel(headers, rows, `Service_Performance_${startDate}_to_${endDate}`, 'Services Performance');
};

// 10. Report - Daily Balance Report
export const exportBalanceReport = (balanceList: any[], startDate: string, endDate: string) => {
  const headers = [
    'SL',
    'Date',
    'Starting Balance (AED)',
    'Collections (+) (AED)',
    'Expenses (-) (AED)',
    'Net Change (AED)',
    'Ending Balance (AED)',
    'Opening Due (AED)',
    'Ending Due (AED)'
  ];

  const rows = balanceList.map((item, idx) => [
    idx + 1,
    item.date || '',
    Number(item.opening.toFixed(2)),
    Number(item.collections.toFixed(2)),
    Number(item.expenses.toFixed(2)),
    Number(item.net.toFixed(2)),
    Number(item.closing.toFixed(2)),
    Number(item.openingDue.toFixed(2)),
    Number(item.closingDue.toFixed(2))
  ]);

  exportToExcel(headers, rows, `Daily_Balance_Report_${startDate}_to_${endDate}`, 'Ledger Balance');
};
